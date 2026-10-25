using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>Applies the most specific active receivable policy before exposure grows.</summary>
public static class CreditControlGuard
{
    public static async Task EnsureExposureAllowedAsync(IAppDbContext db, Guid tenantId, Guid customerId,
        Guid? insuranceCompanyId, PolicyType policyType, string currency, decimal proposedPremium,
        Guid? replacingPolicyId, DateOnly asOf, CancellationToken ct)
    {
        var rules = await db.CreditControlRules.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.IsActive
                && x.EffectiveFrom <= asOf && (!x.EffectiveTo.HasValue || x.EffectiveTo >= asOf)
                && (!x.InsuranceCompanyId.HasValue || x.InsuranceCompanyId == insuranceCompanyId)
                && (!x.PolicyType.HasValue || x.PolicyType == policyType)
                && (string.IsNullOrEmpty(x.Currency) || x.Currency == currency))
            .OrderByDescending(x => x.InsuranceCompanyId.HasValue ? 1 : 0)
            .ThenByDescending(x => x.PolicyType.HasValue ? 1 : 0)
            .ThenByDescending(x => !string.IsNullOrEmpty(x.Currency) ? 1 : 0)
            .ThenByDescending(x => x.EffectiveFrom)
            .ToListAsync(ct);
        var rule = rules.FirstOrDefault();
        if (rule is null || rule.IsException) return;

        var policies = await db.Policies.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.DeletedAt == null
                && x.Status != PolicyStatus.Draft && x.Status != PolicyStatus.Cancelled && x.Status != PolicyStatus.Prospect
                && !x.PaidDirectlyToCarrier
                && (!rule.InsuranceCompanyId.HasValue || x.InsuranceCompanyId == rule.InsuranceCompanyId.Value)
                && (!rule.PolicyType.HasValue || x.PolicyType == rule.PolicyType.Value)
                && x.Currency == currency)
            .Select(x => new { x.Id, x.Premium, x.PaidOnCredit, x.PaymentPromisedOn })
            .ToListAsync(ct);
        var ids = policies.Select(x => x.Id).ToArray();
        var charges = ids.Length == 0 ? [] : await db.FinancialMovements.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.PolicyId.HasValue && ids.Contains(x.PolicyId.Value) && x.Kind == FinancialMovementKind.CustomerCharge)
            .GroupBy(x => x.PolicyId).Select(g => new { PolicyId = g.Key!.Value, Amount = g.Sum(x => x.Amount) }).ToListAsync(ct);
        var receipts = ids.Length == 0 ? [] : await db.Receipts.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.PolicyId.HasValue && ids.Contains(x.PolicyId.Value) && x.Currency == currency)
            .GroupBy(x => x.PolicyId).Select(g => new { PolicyId = g.Key!.Value, Amount = g.Sum(x => x.Amount) }).ToListAsync(ct);
        var otherCredits = ids.Length == 0 ? [] : await db.FinancialMovements.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.PolicyId.HasValue && ids.Contains(x.PolicyId.Value) && x.Kind == FinancialMovementKind.CustomerCredit && x.ReceiptId == null)
            .GroupBy(x => x.PolicyId).Select(g => new { PolicyId = g.Key!.Value, Amount = g.Sum(x => x.Amount) }).ToListAsync(ct);
        var installmentRows = ids.Length == 0 ? [] : await db.PolicyInstallments.AsNoTracking()
            .Where(x => x.TenantId == tenantId && ids.Contains(x.PolicyId) && x.DeletedAt == null && !x.PaidAt.HasValue)
            .Select(x => new { x.PolicyId, x.DueDate }).ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var balances = policies.Select(p =>
        {
            var charge = charges.FirstOrDefault(x => x.PolicyId == p.Id)?.Amount ?? p.Premium;
            var credit = (receipts.FirstOrDefault(x => x.PolicyId == p.Id)?.Amount ?? 0m)
                + (otherCredits.FirstOrDefault(x => x.PolicyId == p.Id)?.Amount ?? 0m);
            var due = installmentRows.Where(x => x.PolicyId == p.Id && x.DueDate < today).Select(x => x.DueDate).ToList();
            if (due.Count == 0 && p.PaidOnCredit && p.PaymentPromisedOn.HasValue && p.PaymentPromisedOn.Value < today)
                due.Add(p.PaymentPromisedOn.Value);
            return new { Balance = Math.Max(0m, charge - credit), OverdueDays = due.Count == 0 ? 0 : due.Max(x => today.DayNumber - x.DayNumber) };
        }).ToList();

        // Receipts that predate policy-level allocation still reduce the party's
        // total exposure. Policy-linked receipts were already counted above.
        var unallocatedReceipts = await db.Receipts.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.PolicyId == null && x.Currency == currency)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var unallocatedCredits = await db.FinancialMovements.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.PolicyId == null
                && x.Kind == FinancialMovementKind.CustomerCredit && x.ReceiptId == null && x.Currency == currency)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var existingOutstanding = Math.Max(0m, balances.Sum(x => x.Balance) - unallocatedReceipts - unallocatedCredits);
        var openPolicies = balances.Count(x => x.Balance > 0.005m);
        var outstanding = existingOutstanding + Math.Max(0m, proposedPremium);
        var oldestOverdue = balances.Select(x => x.OverdueDays).DefaultIfEmpty(0).Max();
        var addedOpenPolicy = !replacingPolicyId.HasValue && proposedPremium > 0.005m ? 1 : 0;
        var violation = rule.MaximumOutstanding.HasValue && outstanding > rule.MaximumOutstanding.Value
            || rule.MaximumOpenPolicies.HasValue && openPolicies + addedOpenPolicy > rule.MaximumOpenPolicies.Value
            || rule.MaximumOverdueDays.HasValue && oldestOverdue > rule.MaximumOverdueDays.Value;
        if (!violation) return;

        var reasons = new List<string>();
        if (rule.MaximumOutstanding.HasValue && outstanding > rule.MaximumOutstanding.Value)
            reasons.Add($"το υπόλοιπο θα γίνει {outstanding:N2} {currency} (όριο {rule.MaximumOutstanding.Value:N2})");
        if (rule.MaximumOpenPolicies.HasValue && openPolicies + addedOpenPolicy > rule.MaximumOpenPolicies.Value)
            reasons.Add($"θα υπάρχουν {openPolicies + addedOpenPolicy} ανοικτά συμβόλαια (όριο {rule.MaximumOpenPolicies.Value})");
        if (rule.MaximumOverdueDays.HasValue && oldestOverdue > rule.MaximumOverdueDays.Value)
            reasons.Add($"υπάρχει ληξιπρόθεσμη οφειλή {oldestOverdue} ημερών (όριο {rule.MaximumOverdueDays.Value})");
        throw AppException.Validation("Δεν μπορεί να αυξηθεί η ασφαλιστική έκθεση: " + string.Join(" · ", reasons) + ". Ελέγξτε τα οικονομικά ή την ισχύουσα εξαίρεση του πελάτη.");
    }
}
