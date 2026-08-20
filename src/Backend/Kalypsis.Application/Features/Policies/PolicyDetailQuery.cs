using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

// ============================================================================
// PolicyDetailDto — the full record. Includes every Phase 12 field plus
// counts/snapshots of related entities so the detail drawer can render
// everything in one network round-trip.
// ============================================================================

/// <summary>Per-cover breakdown line for the policy detail drawer.</summary>
public record PolicyCoverDto(
    Guid Id, string CoverCode, string? CoverName,
    decimal GrossPremium, decimal NetPremium,
    decimal? CoverageAmount,
    decimal? CommissionPercent,          // per-cover producer % (null → uses rule fallback)
    decimal? AgencyCommissionPercent);   // per-cover agency %   (null → uses rule fallback)

public record PolicyDetailDto(
    // Core
    Guid Id, string PolicyNumber, PolicyType PolicyType, PolicyStatus Status,
    DateOnly StartDate, DateOnly EndDate,
    DateTime CreatedAt, DateTime? UpdatedAt,
    string? CreatedByName,

    // Parties
    Guid CustomerId, string CustomerDisplay, string? CustomerEmail, string? CustomerPhone, string? CustomerVat,
    Guid InsuranceCompanyId, string InsuranceCompanyName, string? InsuranceCompanyCode,
    Guid? ProducerId, string? ProducerName, string? ProducerCode,

    // Financials
    decimal Premium, string Currency, PaymentFrequency PaymentFrequency, bool PremiumIncludesVat,
    decimal? SpecialCommissionPercent,
    string? SpecsJson,

    // Tax / duty breakdown (all optional). When any of these are set the
    // drawer renders a proper Καθαρό / ΦΠΑ / Χαρτόσημο / Εισφορές line
    // under the gross premium.
    decimal? NetPremium,
    decimal? VatAmount,
    decimal? StampDutyAmount,
    decimal? InsuranceContributionAmount,
    decimal? OtherChargesAmount,

    // Renewal preservation (Phase 12 BluByte parity)
    DateOnly? NextRenewalDate,
    Guid? RenewalTransferToProducerId, string? RenewalTransferToProducerName,
    Guid? RenewalTransferToCarrierId, string? RenewalTransferToCarrierName,
    bool RetainCommissionsOnRenewal, bool RetainDocumentNumberOnRenewal, bool RetainSpecialCommissionsOnRenewal,
    string? RenewalInstructions,

    // Delivery + collection method
    DateOnly? DeliveredAt, string? DeliveredTo, string? DeliveryMethod,
    string? PaymentCollectionMethod,

    // History
    Guid? RenewedFromPolicyId, string? RenewedFromPolicyNumber,

    // Related counts (so the drawer can render badge numbers without a second fetch per tab)
    int EndorsementCount, int CancellationCount, int ClaimCount, int CommissionTxnCount,
    int DocumentCount, int ReceiptCount,

    // Quick financial totals
    decimal TotalReceived, decimal Outstanding,
    decimal TotalCommissions,

    // Cover breakdown — populated when the policy has PolicyCover rows
    // (either from a carrier bridge or manual entry). Empty otherwise;
    // in that case the drawer just shows the flat Premium field.
    // CoversGrossTotal is provided pre-summed so the frontend can
    // display it prominently as "Σύνολο από καλύψεις".
    IReadOnlyList<PolicyCoverDto> Covers,
    decimal CoversGrossTotal,

    // ALIS-parity fields — nullable, safe to omit for legacy rows.
    string? ApplicationNumber = null,
    Guid? ContractPartyCustomerId = null,
    string? ContractPartyDisplay = null,
    Guid? PreviousInsuranceCompanyId = null,
    string? PreviousInsuranceCompanyName = null,
    DateOnly? IssuedAt = null,
    string? VehicleRegistrationPlate = null,
    // Motor-only extras (nullable for non-motor policies)
    string? DriverVatNumber = null,
    string? ReasonForCirculation = null,
    // Per-policy commission override (v2 of ALIS #1)
    string? SpecialLevelPercentsJson = null,
    // Bridge-supplied agency commission for this policy — summed from the
    // FinancialMovements that were created when the bridge import ran.
    // Non-null only for policies that landed via a carrier bridge; manual
    // policies stay at null (they never had a bridge posting).
    decimal? BridgeAgencyCommissionAmount = null);

public record GetPolicyDetailQuery(Guid Id) : IRequest<PolicyDetailDto>;

public class GetPolicyDetailQueryHandler : IRequestHandler<GetPolicyDetailQuery, PolicyDetailDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public GetPolicyDetailQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<PolicyDetailDto> Handle(GetPolicyDetailQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        // KEEP the global tenant filter active here. IgnoreQueryFilters()
        // cascades to every Include() — Producer, ContractPartyCustomer,
        // PreviousInsuranceCompany — which means that if a bug ever let a
        // foreign-tenant GUID land on one of those FKs, the resolved name
        // would come back from a different office. With the default filter
        // on, the top-level row is tenant-scoped AND every Include is too;
        // any FK pointing to a foreign tenant naturally resolves to null.
        var p = await _db.Policies
            .Include(x => x.Customer)
            .Include(x => x.InsuranceCompany)
            .Include(x => x.Producer)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ContractPartyCustomer)
            .Include(x => x.PreviousInsuranceCompany)
            .FirstOrDefaultAsync(x => x.Id == request.Id, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        // Role-based access check (Customer can only see their own).
        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId != p.CustomerId) throw AppException.Forbidden();
        }

        // Pull related counts + totals in parallel-safe single-context order.
        var endorsementCount = await _db.PolicyEndorsements.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);
        var cancellationCount = await _db.PolicyCancellations.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);
        var claimCount = await _db.Claims.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);
        var commissionTxnCount = await _db.CommissionTransactions.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);
        var documentCount = await _db.PolicyDocuments.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);
        var receiptCount = await _db.Receipts.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == p.Id && x.DeletedAt == null, ct);

        var totalReceived = await _db.Receipts.IgnoreQueryFilters()
            .Where(x => x.PolicyId == p.Id && x.DeletedAt == null)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
        var totalCommissions = await _db.CommissionTransactions.IgnoreQueryFilters()
            .Where(x => x.PolicyId == p.Id && x.DeletedAt == null)
            .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;

        // Bridge-supplied agency commission — summed from every
        // FinancialMovement the carrier-bridge commit wrote for this
        // policy with kind = CommissionEarned. Wrapped so a missing FK
        // (legacy DBs where the FinancialMovement.PolicyId column was
        // added by the safety net after the row) doesn't fail the load.
        decimal? bridgeAgencyCommission = null;
        try
        {
            var raw = await _db.FinancialMovements.IgnoreQueryFilters()
                .Where(fm => fm.PolicyId == p.Id
                    && fm.DeletedAt == null
                    && fm.Kind == FinancialMovementKind.CommissionEarned)
                .SumAsync(fm => (decimal?)fm.Amount, ct);
            if (raw is not null) bridgeAgencyCommission = raw;
        }
        catch { /* best-effort */ }

        // Cover breakdown. Wrapped so a missing table (partial deploy on an
        // old DB) doesn't fail the whole detail load — the safety net will
        // create policy_covers on the next boot.
        List<PolicyCoverDto> covers = new();
        try
        {
            covers = await _db.PolicyCovers.IgnoreQueryFilters()
                .Where(c => c.PolicyId == p.Id && c.DeletedAt == null)
                .OrderBy(c => c.CoverCode)
                .Select(c => new PolicyCoverDto(
                    c.Id, c.CoverCode, c.CoverName,
                    c.GrossPremium, c.NetPremium, c.CoverageAmount,
                    c.CommissionPercent, c.AgencyCommissionPercent))
                .ToListAsync(ct);
        }
        catch { covers = new List<PolicyCoverDto>(); }
        var coversGrossTotal = covers.Sum(c => c.GrossPremium);

        // Renewal transfer-to names (so UI doesn't need a second lookup).
        // Default query filter kept ACTIVE so a foreign-tenant Producer /
        // Policy id planted into these FKs resolves as null instead of
        // leaking the other office's name. InsuranceCompany allows the
        // global catalog (TenantId==null) too.
        string? renewalProducerName = null;
        if (p.RenewalTransferToProducerId.HasValue)
            renewalProducerName = await _db.Producers
                .Where(x => x.Id == p.RenewalTransferToProducerId).Select(x => x.Name).FirstOrDefaultAsync(ct);
        string? renewalCarrierName = null;
        if (p.RenewalTransferToCarrierId.HasValue)
            renewalCarrierName = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(x => x.Id == p.RenewalTransferToCarrierId && x.DeletedAt == null
                    && (x.TenantId == null || x.TenantId == tenantId))
                .Select(x => x.Name).FirstOrDefaultAsync(ct);

        string? renewedFromNumber = null;
        if (p.RenewedFromPolicyId.HasValue)
            renewedFromNumber = await _db.Policies
                .Where(x => x.Id == p.RenewedFromPolicyId).Select(x => x.PolicyNumber).FirstOrDefaultAsync(ct);

        var customerDisplay = p.Customer.Type == CustomerType.Individual
            ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim()
            : p.Customer.CompanyName ?? "—";
        string? contractPartyDisplay = null;
        if (p.ContractPartyCustomer is not null)
        {
            contractPartyDisplay = p.ContractPartyCustomer.Type == CustomerType.Individual
                ? $"{p.ContractPartyCustomer.FirstName} {p.ContractPartyCustomer.LastName}".Trim()
                : p.ContractPartyCustomer.CompanyName ?? "—";
        }
        var createdByName = p.CreatedByUser is null ? null : $"{p.CreatedByUser.FirstName} {p.CreatedByUser.LastName}".Trim();

        return new PolicyDetailDto(
            p.Id, p.PolicyNumber, p.PolicyType, p.Status,
            p.StartDate, p.EndDate, p.CreatedAt, p.UpdatedAt, createdByName,
            p.CustomerId, customerDisplay, p.Customer.Email, p.Customer.MobilePhone ?? p.Customer.Phone, p.Customer.VatNumber,
            p.InsuranceCompanyId, p.InsuranceCompany.Name, p.InsuranceCompany.Code,
            p.ProducerId, p.Producer?.Name, p.Producer?.Code,
            p.Premium, p.Currency, p.PaymentFrequency, p.PremiumIncludesVat,
            p.SpecialCommissionPercent,
            p.SpecsJson,
            p.NetPremium, p.VatAmount, p.StampDutyAmount, p.InsuranceContributionAmount, p.OtherChargesAmount,
            p.NextRenewalDate,
            p.RenewalTransferToProducerId, renewalProducerName,
            p.RenewalTransferToCarrierId, renewalCarrierName,
            p.RetainCommissionsOnRenewal, p.RetainDocumentNumberOnRenewal, p.RetainSpecialCommissionsOnRenewal,
            p.RenewalInstructions,
            p.DeliveredAt, p.DeliveredTo, p.DeliveryMethod,
            p.PaymentCollectionMethod,
            p.RenewedFromPolicyId, renewedFromNumber,
            endorsementCount, cancellationCount, claimCount, commissionTxnCount,
            documentCount, receiptCount,
            totalReceived, p.Premium - totalReceived,
            totalCommissions,
            covers, coversGrossTotal,
            p.ApplicationNumber,
            p.ContractPartyCustomerId, contractPartyDisplay,
            p.PreviousInsuranceCompanyId, p.PreviousInsuranceCompany?.Name,
            p.IssuedAt,
            p.VehicleRegistrationPlate,
            p.DriverVatNumber,
            p.ReasonForCirculation,
            p.SpecialLevelPercentsJson,
            bridgeAgencyCommission);
    }
}

/* ========= Update Phase 12 fields ========= */

public record UpdatePolicyExtendedBody(
    PaymentFrequency PaymentFrequency, bool PremiumIncludesVat,
    decimal? SpecialCommissionPercent,
    string? SpecsJson,
    DateOnly? NextRenewalDate,
    Guid? RenewalTransferToProducerId, Guid? RenewalTransferToCarrierId,
    bool RetainCommissionsOnRenewal, bool RetainDocumentNumberOnRenewal, bool RetainSpecialCommissionsOnRenewal,
    string? RenewalInstructions,
    DateOnly? DeliveredAt, string? DeliveredTo, string? DeliveryMethod,
    string? PaymentCollectionMethod = null,
    // Tax / duty breakdown (all optional — null means "not tracked separately").
    decimal? NetPremium = null,
    decimal? VatAmount = null,
    decimal? StampDutyAmount = null,
    decimal? InsuranceContributionAmount = null,
    decimal? OtherChargesAmount = null,
    // ALIS-parity fields — all optional. Null clears; missing = unchanged
    // isn't distinguishable from null on a record, but the drawer always
    // sends the full body, so the round-trip preserves what the user typed.
    string? ApplicationNumber = null,
    Guid? ContractPartyCustomerId = null,
    Guid? PreviousInsuranceCompanyId = null,
    DateOnly? IssuedAt = null,
    string? VehicleRegistrationPlate = null,
    // Motor-only extras
    string? DriverVatNumber = null,
    string? ReasonForCirculation = null,
    // Per-policy commission override
    string? SpecialLevelPercentsJson = null);

public record UpdatePolicyExtendedCommand(Guid Id, UpdatePolicyExtendedBody Body) : IRequest<PolicyDetailDto>;

public class UpdatePolicyExtendedHandler : IRequestHandler<UpdatePolicyExtendedCommand, PolicyDetailDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IMediator _mediator;
    private readonly PolicyCommissionCalculator _commissionCalc;

    public UpdatePolicyExtendedHandler(IAppDbContext db, ICurrentUser current, IMediator mediator,
        PolicyCommissionCalculator commissionCalc)
    {
        _db = db; _current = current; _mediator = mediator; _commissionCalc = commissionCalc;
    }

    public async Task<PolicyDetailDto> Handle(UpdatePolicyExtendedCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        // Global filter active — cascades to any Include here (none currently).
        var p = await _db.Policies
            .FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var b = r.Body;
        // Cross-tenant FK guards. Every nullable Guid the operator can plant
        // via the body MUST be validated against tenant scope; otherwise a
        // second office's Producer / Customer / InsuranceCompany id could
        // land on this policy and the next detail-load would return that
        // office's name through the tenant-filtered Include chain.
        var renewalProducerId = await TenantFkGuard.RequireTenantOwnedAsync(_db.Producers, b.RenewalTransferToProducerId, tenantId, "Συνεργάτης ανανέωσης", ct);
        var renewalCarrierId  = await TenantFkGuard.RequireCarrierAsync(_db.InsuranceCompanies, b.RenewalTransferToCarrierId, tenantId, ct);
        var partyCustId       = await TenantFkGuard.RequireTenantOwnedAsync(_db.Customers, b.ContractPartyCustomerId, tenantId, "Συμβαλλόμενος", ct);
        var prevCarrierId     = await TenantFkGuard.RequireCarrierAsync(_db.InsuranceCompanies, b.PreviousInsuranceCompanyId, tenantId, ct);

        p.PaymentFrequency = b.PaymentFrequency;
        p.PremiumIncludesVat = b.PremiumIncludesVat;
        p.SpecialCommissionPercent = b.SpecialCommissionPercent;
        p.SpecsJson = b.SpecsJson;
        p.NextRenewalDate = b.NextRenewalDate;
        p.RenewalTransferToProducerId = renewalProducerId;
        p.RenewalTransferToCarrierId = renewalCarrierId;
        p.RetainCommissionsOnRenewal = b.RetainCommissionsOnRenewal;
        p.RetainDocumentNumberOnRenewal = b.RetainDocumentNumberOnRenewal;
        p.RetainSpecialCommissionsOnRenewal = b.RetainSpecialCommissionsOnRenewal;
        p.RenewalInstructions = b.RenewalInstructions;
        p.DeliveredAt = b.DeliveredAt;
        p.DeliveredTo = b.DeliveredTo;
        p.DeliveryMethod = b.DeliveryMethod;
        p.PaymentCollectionMethod = b.PaymentCollectionMethod;
        p.NetPremium = b.NetPremium;
        p.VatAmount = b.VatAmount;
        p.StampDutyAmount = b.StampDutyAmount;
        p.InsuranceContributionAmount = b.InsuranceContributionAmount;
        p.OtherChargesAmount = b.OtherChargesAmount;
        p.ApplicationNumber = string.IsNullOrWhiteSpace(b.ApplicationNumber) ? null : b.ApplicationNumber.Trim();
        p.ContractPartyCustomerId = partyCustId;
        p.PreviousInsuranceCompanyId = prevCarrierId;
        p.IssuedAt = b.IssuedAt;
        p.VehicleRegistrationPlate = string.IsNullOrWhiteSpace(b.VehicleRegistrationPlate)
            ? null : b.VehicleRegistrationPlate.Trim().ToUpperInvariant();
        p.DriverVatNumber = string.IsNullOrWhiteSpace(b.DriverVatNumber)
            ? null : b.DriverVatNumber.Trim();
        p.ReasonForCirculation = string.IsNullOrWhiteSpace(b.ReasonForCirculation)
            ? null : b.ReasonForCirculation.Trim();
        // Empty-string is treated as "clear the override" so the drawer's
        // "Reset override" button just sends null.
        p.SpecialLevelPercentsJson = string.IsNullOrWhiteSpace(b.SpecialLevelPercentsJson)
            ? null : b.SpecialLevelPercentsJson.Trim();

        await _db.SaveChangesAsync(ct);

        // Recompute the matrix after the extended save — the override might
        // have changed, and even when it didn't, the tax breakdown could
        // move if NetPremium was edited. Best-effort so a partial deploy
        // never blocks the write.
        try
        {
            await _commissionCalc.RecomputeAsync(p, ct);
            await _db.SaveChangesAsync(ct);
        }
        catch { /* splits are a read-side convenience */ }

        return await _mediator.Send(new GetPolicyDetailQuery(p.Id), ct);
    }
}
