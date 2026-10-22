using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase13;

public static class AdvancePaymentRules
{
    public static string Direction(string? direction) => direction is "Incoming" or "Outgoing" ? direction
        : throw new AppException("advance_direction_required", "Επιλέξτε εισερχόμενη ή εξερχόμενη προκαταβολή.", 400);

    public static void PositiveAmount(decimal amount)
    {
        if (amount <= 0 || amount > 9999999999.99m || decimal.Round(amount, 2) != amount)
            throw new AppException("advance_invalid_amount", "Το ποσό πρέπει να είναι θετικό, με έως δύο δεκαδικά ψηφία.", 400);
    }

    public static async Task PartyExists(IAppDbContext db, string partyType, Guid? customerId, Guid? producerId, Guid? companyId, CancellationToken ct)
    {
        var exists = partyType switch
        {
            "Customer" => customerId.HasValue && await db.Customers.AnyAsync(p => p.Id == customerId && p.DeletedAt == null, ct),
            "Producer" => producerId.HasValue && await db.Producers.AnyAsync(p => p.Id == producerId && p.DeletedAt == null, ct),
            "Carrier" => companyId.HasValue && await db.InsuranceCompanies.AnyAsync(p => p.Id == companyId && p.DeletedAt == null, ct),
            _ => false
        };
        if (!exists) throw new AppException("advance_party_required", "Επιλέξτε διαθέσιμο αντισυμβαλλόμενο του γραφείου σας.", 400);
    }

    public static async Task Save(IAppDbContext db, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            throw new AppException("advance_changed", "Η προκαταβολή άλλαξε από άλλη ενέργεια. Ανανεώστε τη λίστα και δοκιμάστε ξανά.", 409);
        }
    }

    // Shared by creation and later linking, so the one-step form cannot bypass
    // the same tenant, counterparty, currency and finalised-run checks.
    public static async Task ValidateTarget(IAppDbContext db, AdvancePayment advance, Guid targetId, string targetType, CancellationToken ct)
    {
        if (targetType is not ("Policy" or "CommissionRun"))
            throw AppException.Validation("Επιλέξτε συμβόλαιο ή οριστικοποιημένη εκκαθάριση.");
        if (targetType == "CommissionRun")
        {
            var targets = await CommissionRuns(db, advance, ct);
            if (!targets.Any(target => target.Id == targetId))
                throw AppException.Validation("Η εκκαθάριση δεν αφορά εξερχόμενη προκαταβολή του ίδιου συνεργάτη και νομίσματος.");
            return;
        }
        var policy = await db.Policies.FirstOrDefaultAsync(x => x.Id == targetId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Policy");
        var a = advance;
        var belongsToParty = a.PartyType switch
        {
            "Customer" => a.CustomerId.HasValue && policy.CustomerId == a.CustomerId.Value,
            "Producer" => a.ProducerId.HasValue && policy.ProducerId == a.ProducerId.Value,
            "Carrier" => a.InsuranceCompanyId.HasValue && policy.InsuranceCompanyId == a.InsuranceCompanyId.Value,
            _ => false
        };
        if (!belongsToParty)
            throw new AppException("advance_policy_party_mismatch", "Το συμβόλαιο δεν ανήκει στον αντισυμβαλλόμενο της προκαταβολής.", 400);
        if (!string.Equals(policy.Currency, a.Currency, StringComparison.OrdinalIgnoreCase))
            throw new AppException("advance_currency_mismatch", "Το νόμισμα του συμβολαίου διαφέρει από το νόμισμα της προκαταβολής.", 400);
    }

    public static async Task<IReadOnlyList<AdvanceCommissionRunDto>> CommissionRuns(IAppDbContext db, AdvancePayment advance, CancellationToken ct)
    {
        if (advance.Direction != "Outgoing" || advance.PartyType != "Producer" || advance.ProducerId == null)
            return Array.Empty<AdvanceCommissionRunDto>();
        var rows = await db.CommissionRunLines
            .Where(l => l.DeletedAt == null && l.ProducerId == advance.ProducerId && l.Currency == advance.Currency
                && l.CommissionRun.Currency == advance.Currency && l.CommissionRun.DeletedAt == null && l.CommissionRun.Status == CommissionRunStatus.Finalised)
            .GroupBy(l => new { l.CommissionRunId, l.CommissionRun.Year, l.CommissionRun.Month, l.CommissionRun.Title, l.Currency })
            .Select(group => new { group.Key, Amount = group.Sum(l => l.CommissionAmount) })
            .OrderByDescending(row => row.Key.Year).ThenByDescending(row => row.Key.Month).ToListAsync(ct);
        return rows.Where(row => row.Amount > 0).Select(row => new AdvanceCommissionRunDto(row.Key.CommissionRunId,
            $"Εκκαθάριση {row.Key.Month:00}/{row.Key.Year} · {row.Key.Title}", row.Amount, row.Key.Currency)).ToList();
    }
}

public record SetAdvanceDirectionCommand(Guid Id, string Direction) : MediatR.IRequest<MediatR.Unit>;
public sealed class SetAdvanceDirectionHandler(IAppDbContext db) : MediatR.IRequestHandler<SetAdvanceDirectionCommand, MediatR.Unit>
{
    public async Task<MediatR.Unit> Handle(SetAdvanceDirectionCommand request, CancellationToken ct)
    {
        var advance = await db.AdvancePayments.FirstOrDefaultAsync(a => a.Id == request.Id && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Προκαταβολή");
        var direction = AdvancePaymentRules.Direction(request.Direction);
        if (advance.Direction == direction) return MediatR.Unit.Value;
        if (advance.Direction != null && advance.AllocatedAmount > 0)
            throw new AppException("advance_direction_locked", "Δεν αλλάζει η κατεύθυνση προκαταβολής που έχει ήδη κατανεμηθεί.", 409);
        advance.Direction = direction;
        await AdvancePaymentRules.Save(db, ct);
        return MediatR.Unit.Value;
    }
}

public record AdvanceCommissionRunDto(Guid Id, string Reference, decimal CommissionAmount, string Currency);
public record PreviewAdvanceCommissionRunsQuery(Guid ProducerId, string Currency) : MediatR.IRequest<IReadOnlyList<AdvanceCommissionRunDto>>;
public sealed class PreviewAdvanceCommissionRunsHandler(IAppDbContext db) : MediatR.IRequestHandler<PreviewAdvanceCommissionRunsQuery, IReadOnlyList<AdvanceCommissionRunDto>>
{
    public async Task<IReadOnlyList<AdvanceCommissionRunDto>> Handle(PreviewAdvanceCommissionRunsQuery request, CancellationToken ct)
    {
        var currency = request.Currency?.Trim().ToUpperInvariant();
        if (currency?.Length != 3 || !currency.All(char.IsAsciiLetter))
            throw AppException.Validation("Επιλέξτε έγκυρο νόμισμα.");
        await AdvancePaymentRules.PartyExists(db, "Producer", null, request.ProducerId, null, ct);
        return await AdvancePaymentRules.CommissionRuns(db, new AdvancePayment
        {
            Direction = "Outgoing", PartyType = "Producer", ProducerId = request.ProducerId, Currency = currency
        }, ct);
    }
}

public record GetAdvanceCommissionRunsQuery(Guid AdvanceId) : MediatR.IRequest<IReadOnlyList<AdvanceCommissionRunDto>>;
public sealed class GetAdvanceCommissionRunsHandler(IAppDbContext db) : MediatR.IRequestHandler<GetAdvanceCommissionRunsQuery, IReadOnlyList<AdvanceCommissionRunDto>>
{
    public async Task<IReadOnlyList<AdvanceCommissionRunDto>> Handle(GetAdvanceCommissionRunsQuery request, CancellationToken ct)
    {
        var advance = await db.AdvancePayments.FirstOrDefaultAsync(a => a.Id == request.AdvanceId && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Προκαταβολή");
        return await AdvancePaymentRules.CommissionRuns(db, advance, ct);
    }
}
