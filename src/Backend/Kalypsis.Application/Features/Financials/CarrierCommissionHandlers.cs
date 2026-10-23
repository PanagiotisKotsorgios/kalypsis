using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record CarrierCommissionBalanceDto(Guid PolicyId, string PolicyNumber, Guid InsuranceCompanyId,
    string InsuranceCompanyName, string CustomerName, DateOnly StartDate, string Currency,
    bool PaidDirectlyToCarrier, decimal Expected, decimal Received, decimal Outstanding, decimal Credit);
public record CarrierCommissionReceiptDto(Guid Id, Guid PolicyId, DateOnly ReceivedOn, decimal Amount, string Currency, string? Notes,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName);
public record CarrierCommissionReceiptBody(Guid PolicyId, DateOnly ReceivedOn, decimal Amount, string? Notes);
public record ListCarrierCommissionBalancesQuery() : IRequest<IReadOnlyList<CarrierCommissionBalanceDto>>;
public record ListCarrierCommissionReceiptsQuery(Guid PolicyId) : IRequest<IReadOnlyList<CarrierCommissionReceiptDto>>;
public record SaveCarrierCommissionReceiptCommand(Guid Id, CarrierCommissionReceiptBody Body) : IRequest<CarrierCommissionReceiptDto>;
public record DeleteCarrierCommissionReceiptCommand(Guid Id) : IRequest<Unit>;

/// <summary>One journal source for policy cards and the financial workspace.
/// CommissionEarned is accrual/import data; only CarrierCommissionReceived
/// represents a carrier remittance. Customer receipts are never counted here.</summary>
public static class CarrierCommissionLedger
{
    public static async Task<IReadOnlyList<CarrierCommissionBalanceDto>> BalancesAsync(
        IAppDbContext db, Guid tenantId, CancellationToken ct, Guid? policyId = null)
    {
        var production = await ProductionListBuilder.BuildRowsAsync(db, tenantId,
            new ProductionFilters(null, null, null, null, null, null, null, null, null), ct, policyId, includeAll: true);
        var query = db.Policies.Where(p => p.TenantId == tenantId && p.DeletedAt == null);
        if (policyId.HasValue) query = query.Where(p => p.Id == policyId);
        var policies = await query.Select(p => new { p.Id, p.InsuranceCompanyId, p.Currency, p.PaidDirectlyToCarrier }).ToListAsync(ct);
        var metadata = policies.ToDictionary(p => p.Id);
        var journal = db.FinancialMovements.Where(m => m.TenantId == tenantId && m.DeletedAt == null
            && m.Kind == FinancialMovementKind.CarrierCommissionReceived && m.PolicyId != null);
        if (policyId.HasValue) journal = journal.Where(m => m.PolicyId == policyId);
        var receipts = await journal.Select(m => new { m.PolicyId, m.Amount, m.Currency, m.InsuranceCompanyId }).ToListAsync(ct);
        var amounts = receipts.GroupBy(m => (m.PolicyId!.Value, m.Currency, m.InsuranceCompanyId))
            .ToDictionary(g => g.Key, g => g.Sum(m => m.Amount));
        return production.Where(row => metadata.ContainsKey(row.PolicyId)).Select(row =>
        {
            var policy = metadata[row.PolicyId];
            var expected = row.Status is nameof(PolicyStatus.Prospect) or nameof(PolicyStatus.Draft) or nameof(PolicyStatus.Cancelled)
                ? 0m : Math.Max(0m, row.AgencyCommission);
            var received = amounts.GetValueOrDefault((row.PolicyId, policy.Currency, (Guid?)policy.InsuranceCompanyId));
            return new CarrierCommissionBalanceDto(row.PolicyId, row.PolicyNumber, policy.InsuranceCompanyId,
                row.InsuranceCompany, row.CustomerName, row.StartDate, policy.Currency,
                policy.PaidDirectlyToCarrier, expected, received, Math.Max(0m, expected - received), Math.Max(0m, received - expected));
        }).ToList();
    }

    internal static CarrierCommissionReceiptDto Map(FinancialMovement movement) => new(movement.Id,
        movement.PolicyId!.Value, movement.MovementDate, movement.Amount, movement.Currency, movement.Description,
        movement.InsuranceCompanyId, movement.InsuranceCompany?.Name);
}

public class ListCarrierCommissionBalancesHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<ListCarrierCommissionBalancesQuery, IReadOnlyList<CarrierCommissionBalanceDto>>
{
    public Task<IReadOnlyList<CarrierCommissionBalanceDto>> Handle(ListCarrierCommissionBalancesQuery request, CancellationToken ct) =>
        CarrierCommissionLedger.BalancesAsync(db, current.TenantId ?? throw AppException.Forbidden(), ct);
}

public class ListCarrierCommissionReceiptsHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<ListCarrierCommissionReceiptsQuery, IReadOnlyList<CarrierCommissionReceiptDto>>
{
    public async Task<IReadOnlyList<CarrierCommissionReceiptDto>> Handle(ListCarrierCommissionReceiptsQuery request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        if (!await db.Policies.AnyAsync(p => p.Id == request.PolicyId && p.TenantId == tenant, ct))
            throw AppException.NotFound("Συμβόλαιο");
        var rows = await db.FinancialMovements.Include(m => m.InsuranceCompany).Where(m => m.TenantId == tenant && m.PolicyId == request.PolicyId
                && m.Kind == FinancialMovementKind.CarrierCommissionReceived && m.DeletedAt == null)
            .OrderByDescending(m => m.MovementDate).ThenByDescending(m => m.CreatedAt).ToListAsync(ct);
        return rows.Select(CarrierCommissionLedger.Map).ToList();
    }
}

public class SaveCarrierCommissionReceiptHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<SaveCarrierCommissionReceiptCommand, CarrierCommissionReceiptDto>
{
    public async Task<CarrierCommissionReceiptDto> Handle(SaveCarrierCommissionReceiptCommand request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var body = request.Body;
        if (request.Id == Guid.Empty || body.PolicyId == Guid.Empty || body.ReceivedOn == default
            || body.Amount <= 0m || body.Amount > 999999999999.99m || decimal.Round(body.Amount, 2) != body.Amount
            || body.Notes?.Trim().Length > 500)
            throw AppException.Validation("Συμπληρώστε ημερομηνία και θετικό ποσό με έως δύο δεκαδικά. Οι σημειώσεις επιτρέπουν έως 500 χαρακτήρες.");
        var policy = await db.Policies.FirstOrDefaultAsync(p => p.Id == body.PolicyId && p.TenantId == tenant && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        if (policy.Status is PolicyStatus.Prospect or PolicyStatus.Draft)
            throw AppException.Validation("Δεν καταχωρούνται προμήθειες για πιθανά συμβόλαια ή πρόχειρα.");
        var movement = await db.FinancialMovements.FirstOrDefaultAsync(m => m.Id == request.Id && m.TenantId == tenant, ct);
        if (movement is not null && (movement.Kind != FinancialMovementKind.CarrierCommissionReceived || movement.PolicyId != policy.Id))
            throw AppException.NotFound("Καταβολή προμήθειας");
        if (movement is not null && (movement.Currency != policy.Currency || movement.InsuranceCompanyId != policy.InsuranceCompanyId))
            throw new AppException("commission_receipt_policy_changed", "Το νόμισμα ή η ασφαλιστική του συμβολαίου έχει αλλάξει. Η παλιά καταβολή διατηρεί τα αρχικά στοιχεία της· διορθώστε τη σύνδεση του συμβολαίου ή διαγράψτε την καταβολή και καταχωρήστε τη σωστή.", 409);
        if (movement is null)
        {
            // Reusing an inaccessible or voided journal ID must not restore it
            // or turn it into an unrelated financial transaction.
            if (await db.FinancialMovements.IgnoreQueryFilters().AnyAsync(m => m.Id == request.Id, ct))
                throw AppException.NotFound("Καταβολή προμήθειας");
            movement = new FinancialMovement { Id = request.Id, TenantId = tenant,
                AgencyOfficeScopeId = policy.AgencyOfficeScopeId, PolicyId = policy.Id,
                Kind = FinancialMovementKind.CarrierCommissionReceived };
            db.FinancialMovements.Add(movement);
        }
        movement.InsuranceCompanyId = policy.InsuranceCompanyId;
        movement.MovementDate = body.ReceivedOn;
        movement.Currency = policy.Currency; // Never accept currency/tenant/company from the browser.
        movement.Amount = body.Amount;
        movement.Description = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim();
        await db.SaveChangesAsync(ct); // Same ID makes retries idempotent: one journal entry, not two.
        return CarrierCommissionLedger.Map(movement);
    }
}

public class DeleteCarrierCommissionReceiptHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    : IRequestHandler<DeleteCarrierCommissionReceiptCommand, Unit>
{
    public async Task<Unit> Handle(DeleteCarrierCommissionReceiptCommand request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var movement = await db.FinancialMovements.FirstOrDefaultAsync(m => m.Id == request.Id && m.TenantId == tenant
            && m.Kind == FinancialMovementKind.CarrierCommissionReceived && m.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Καταβολή προμήθειας");
        movement.DeletedAt = clock.UtcNow; // Preserve audit; all balances derive from active journal entries.
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
