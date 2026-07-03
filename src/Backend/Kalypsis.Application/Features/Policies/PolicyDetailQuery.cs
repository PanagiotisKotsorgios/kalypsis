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
    decimal CoversGrossTotal);

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
        var p = await _db.Policies.IgnoreQueryFilters()
            .Include(x => x.Customer)
            .Include(x => x.InsuranceCompany)
            .Include(x => x.Producer)
            .Include(x => x.CreatedByUser)
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
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
        string? renewalProducerName = null;
        if (p.RenewalTransferToProducerId.HasValue)
            renewalProducerName = await _db.Producers.IgnoreQueryFilters()
                .Where(x => x.Id == p.RenewalTransferToProducerId).Select(x => x.Name).FirstOrDefaultAsync(ct);
        string? renewalCarrierName = null;
        if (p.RenewalTransferToCarrierId.HasValue)
            renewalCarrierName = await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(x => x.Id == p.RenewalTransferToCarrierId).Select(x => x.Name).FirstOrDefaultAsync(ct);

        string? renewedFromNumber = null;
        if (p.RenewedFromPolicyId.HasValue)
            renewedFromNumber = await _db.Policies.IgnoreQueryFilters()
                .Where(x => x.Id == p.RenewedFromPolicyId).Select(x => x.PolicyNumber).FirstOrDefaultAsync(ct);

        var customerDisplay = p.Customer.Type == CustomerType.Individual
            ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim()
            : p.Customer.CompanyName ?? "—";
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
            covers, coversGrossTotal);
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
    decimal? OtherChargesAmount = null);

public record UpdatePolicyExtendedCommand(Guid Id, UpdatePolicyExtendedBody Body) : IRequest<PolicyDetailDto>;

public class UpdatePolicyExtendedHandler : IRequestHandler<UpdatePolicyExtendedCommand, PolicyDetailDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IMediator _mediator;

    public UpdatePolicyExtendedHandler(IAppDbContext db, ICurrentUser current, IMediator mediator)
    {
        _db = db; _current = current; _mediator = mediator;
    }

    public async Task<PolicyDetailDto> Handle(UpdatePolicyExtendedCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var b = r.Body;
        p.PaymentFrequency = b.PaymentFrequency;
        p.PremiumIncludesVat = b.PremiumIncludesVat;
        p.SpecialCommissionPercent = b.SpecialCommissionPercent;
        p.SpecsJson = b.SpecsJson;
        p.NextRenewalDate = b.NextRenewalDate;
        p.RenewalTransferToProducerId = b.RenewalTransferToProducerId;
        p.RenewalTransferToCarrierId = b.RenewalTransferToCarrierId;
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

        await _db.SaveChangesAsync(ct);
        return await _mediator.Send(new GetPolicyDetailQuery(p.Id), ct);
    }
}
