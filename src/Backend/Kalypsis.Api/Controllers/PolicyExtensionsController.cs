using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/policies/{policyId:guid}")]
[Authorize(Policy = "AgencyStaff")]
public class PolicyExtensionsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public PolicyExtensionsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    /* ===================== POLICY OBJECTS ===================== */

    public record ObjectDto(Guid Id, string ObjectKind, string? FbcLinkCode, string? Identifier,
        string? Description, string? Characteristic, decimal CoversTotal);
    public record ObjectBody(string ObjectKind, string? FbcLinkCode, string? Identifier,
        string? Description, string? Characteristic);

    [HttpGet("objects")]
    public async Task<ActionResult<IReadOnlyList<ObjectDto>>> ListObjects(Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.PolicyObjects
            .Where(o => o.TenantId == tenantId && o.PolicyId == policyId && o.DeletedAt == null)
            .Include(o => o.Covers.Where(c => c.DeletedAt == null))
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(ct);
        return Ok(rows.Select(o => new ObjectDto(o.Id, o.ObjectKind, o.FbcLinkCode, o.Identifier,
            o.Description, o.Characteristic, o.Covers.Sum(c => c.GrossPremium))).ToList());
    }

    [HttpPost("objects")]
    public async Task<ActionResult<ObjectDto>> CreateObject(Guid policyId, [FromBody] ObjectBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.ObjectKind))
            throw new AppException("object_kind_required", "Συμπληρώστε το είδος αντικειμένου.", 400);
        var o = new PolicyObject
        {
            Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = policyId,
            ObjectKind = body.ObjectKind.Trim(),
            FbcLinkCode = body.FbcLinkCode?.Trim(),
            Identifier = body.Identifier?.Trim(),
            Description = body.Description?.Trim(),
            Characteristic = body.Characteristic?.Trim(),
            CreatedAt = _clock.UtcNow
        };
        _db.PolicyObjects.Add(o);
        await _db.SaveChangesAsync(ct);
        return Ok(new ObjectDto(o.Id, o.ObjectKind, o.FbcLinkCode, o.Identifier, o.Description, o.Characteristic, 0m));
    }

    [HttpPut("objects/{objectId:guid}")]
    public async Task<ActionResult<ObjectDto>> UpdateObject(Guid policyId, Guid objectId,
        [FromBody] ObjectBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var o = await _db.PolicyObjects.FirstOrDefaultAsync(
            x => x.Id == objectId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντικείμενο");
        o.ObjectKind = body.ObjectKind?.Trim() ?? o.ObjectKind;
        o.FbcLinkCode = body.FbcLinkCode?.Trim();
        o.Identifier = body.Identifier?.Trim();
        o.Description = body.Description?.Trim();
        o.Characteristic = body.Characteristic?.Trim();
        o.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new ObjectDto(o.Id, o.ObjectKind, o.FbcLinkCode, o.Identifier, o.Description, o.Characteristic, 0m));
    }

    [HttpDelete("objects/{objectId:guid}")]
    public async Task<ActionResult> DeleteObject(Guid policyId, Guid objectId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var o = await _db.PolicyObjects.FirstOrDefaultAsync(
            x => x.Id == objectId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αντικείμενο");
        o.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /* ===================== POLICY COVERS ===================== */

    public record CoverDto(Guid Id, Guid? PolicyObjectId, string CoverCode, string? CoverName,
        decimal GrossPremium, decimal NetPremium, decimal? CoverageAmount,
        decimal? CommissionPercent, decimal? AgencyCommissionPercent);
    public record CoverBody(Guid? PolicyObjectId, string CoverCode, string? CoverName,
        decimal GrossPremium, decimal NetPremium, decimal? CoverageAmount,
        decimal? CommissionPercent, decimal? AgencyCommissionPercent);

    [HttpGet("covers")]
    public async Task<ActionResult<IReadOnlyList<CoverDto>>> ListCovers(Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.PolicyCovers
            .Where(c => c.TenantId == tenantId && c.PolicyId == policyId && c.DeletedAt == null)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);
        return Ok(rows.Select(MapCoverDto).ToList());
    }

    [HttpPost("covers")]
    public async Task<ActionResult<CoverDto>> CreateCover(Guid policyId, [FromBody] CoverBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.CoverCode))
            throw new AppException("cover_code_required", "Συμπληρώστε τον κωδικό κάλυψης.", 400);
        var c = new PolicyCover
        {
            Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = policyId,
            PolicyObjectId = body.PolicyObjectId,
            CoverCode = body.CoverCode.Trim().ToUpperInvariant(),
            CoverName = body.CoverName?.Trim(),
            GrossPremium = body.GrossPremium,
            NetPremium = body.NetPremium,
            CoverageAmount = body.CoverageAmount,
            CommissionPercent = body.CommissionPercent,
            AgencyCommissionPercent = body.AgencyCommissionPercent,
            CreatedAt = _clock.UtcNow
        };
        _db.PolicyCovers.Add(c);
        await _db.SaveChangesAsync(ct);
        await SyncPolicyPremiumFromCoversAsync(tenantId, policyId, ct);
        return Ok(MapCoverDto(c));
    }

    [HttpPut("covers/{coverId:guid}")]
    public async Task<ActionResult<CoverDto>> UpdateCover(Guid policyId, Guid coverId, [FromBody] CoverBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.PolicyCovers.FirstOrDefaultAsync(
            x => x.Id == coverId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κάλυψη");
        if (string.IsNullOrWhiteSpace(body.CoverCode))
            throw new AppException("cover_code_required", "Συμπληρώστε τον κωδικό κάλυψης.", 400);
        c.PolicyObjectId = body.PolicyObjectId;
        c.CoverCode = body.CoverCode.Trim().ToUpperInvariant();
        c.CoverName = body.CoverName?.Trim();
        c.GrossPremium = body.GrossPremium;
        c.NetPremium = body.NetPremium;
        c.CoverageAmount = body.CoverageAmount;
        c.CommissionPercent = body.CommissionPercent;
        c.AgencyCommissionPercent = body.AgencyCommissionPercent;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        await SyncPolicyPremiumFromCoversAsync(tenantId, policyId, ct);
        return Ok(MapCoverDto(c));
    }

    [HttpDelete("covers/{coverId:guid}")]
    public async Task<ActionResult> DeleteCover(Guid policyId, Guid coverId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.PolicyCovers.FirstOrDefaultAsync(
            x => x.Id == coverId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κάλυψη");
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        await SyncPolicyPremiumFromCoversAsync(tenantId, policyId, ct);
        return NoContent();
    }

    public record CoverAdjustmentBody(decimal NewAgencyPercent, string? Reason, Guid? SourceBridgeRunId);

    public record CoverAdjustmentDto(
        Guid Id, Guid PolicyCoverId, string CoverCode, string? CoverName,
        decimal? OldAgencyPercent, decimal? NewAgencyPercent,
        decimal? OldProducerPercent, decimal? NewProducerPercent,
        decimal AgencyAmountDelta, decimal ProducerAmountDelta,
        string? Reason, DateTime CreatedAt);

    /// <summary>
    /// Bridge-triggered commission adjustment. Given a new agency % from the
    /// carrier file, mutate the cover so the producer's % is scaled by the
    /// same ratio (see PolicyPremiumMath.ApplyBridgeAgencyPercentChange for
    /// the math) and persist a PolicyCoverAdjustment audit row so the office
    /// can trace exactly why a producer's commission line dropped.
    /// </summary>
    [HttpPost("covers/{coverId:guid}/apply-agency-adjustment")]
    public async Task<ActionResult<CoverAdjustmentDto>> ApplyAgencyAdjustment(
        Guid policyId, Guid coverId, [FromBody] CoverAdjustmentBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.PolicyCovers.FirstOrDefaultAsync(
            x => x.Id == coverId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Κάλυψη");

        var result = Kalypsis.Application.Features.Policies.PolicyPremiumMath
            .ApplyBridgeAgencyPercentChange(c, body.NewAgencyPercent);

        var audit = new Kalypsis.Domain.Entities.PolicyCoverAdjustment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyCoverId = c.Id,
            PolicyId = policyId,
            OldAgencyPercent = result.OldAgencyPercent,
            NewAgencyPercent = result.NewAgencyPercent,
            OldProducerPercent = result.OldProducerPercent,
            NewProducerPercent = result.NewProducerPercent,
            AgencyAmountDelta = result.AgencyAmountDelta,
            ProducerAmountDelta = result.ProducerAmountDelta,
            Reason = body.Reason ?? result.Reason,
            SourceBridgeRunId = body.SourceBridgeRunId,
            CreatedAt = _clock.UtcNow
        };
        _db.PolicyCoverAdjustments.Add(audit);
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new CoverAdjustmentDto(
            audit.Id, c.Id, c.CoverCode, c.CoverName,
            audit.OldAgencyPercent, audit.NewAgencyPercent,
            audit.OldProducerPercent, audit.NewProducerPercent,
            audit.AgencyAmountDelta, audit.ProducerAmountDelta,
            audit.Reason, audit.CreatedAt));
    }

    public record BulkCoverRow(string CoverCode, string? CoverName,
        decimal GrossPremium, decimal NetPremium,
        decimal? CoverageAmount, decimal? CommissionPercent, decimal? AgencyCommissionPercent);
    public record BulkCoverImportBody(IReadOnlyList<BulkCoverRow> Rows, bool ReplaceExisting);
    public record BulkCoverImportResult(int Created, int UpdatedExisting, int Skipped);

    /// <summary>
    /// Batch import of PolicyCover rows for a single policy — typically fed
    /// by a CSV/XLSX paste from a carrier file that the bridge doesn't parse.
    /// When ReplaceExisting is true, matching CoverCode rows on the policy
    /// are updated in place instead of duplicated. All amounts are recognised
    /// in Policy.Currency; conversion is a caller-side concern.
    /// </summary>
    [HttpPost("covers/bulk-import")]
    public async Task<ActionResult<BulkCoverImportResult>> BulkImportCovers(
        Guid policyId, [FromBody] BulkCoverImportBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var policy = await _db.Policies.FirstOrDefaultAsync(
            p => p.Id == policyId && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var existing = await _db.PolicyCovers
            .Where(c => c.PolicyId == policyId && c.TenantId == tenantId && c.DeletedAt == null)
            .ToListAsync(ct);
        var existingByCode = existing.GroupBy(c => c.CoverCode, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        int created = 0, updated = 0, skipped = 0;
        foreach (var r in body.Rows)
        {
            var code = (r.CoverCode ?? "").Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(code)) { skipped++; continue; }

            if (body.ReplaceExisting && existingByCode.TryGetValue(code, out var current))
            {
                current.CoverName = r.CoverName?.Trim() ?? current.CoverName;
                current.GrossPremium = r.GrossPremium;
                current.NetPremium = r.NetPremium;
                current.CoverageAmount = r.CoverageAmount;
                current.CommissionPercent = r.CommissionPercent;
                current.AgencyCommissionPercent = r.AgencyCommissionPercent;
                current.UpdatedAt = _clock.UtcNow;
                updated++;
                continue;
            }
            _db.PolicyCovers.Add(new PolicyCover
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PolicyId = policyId,
                CoverCode = code,
                CoverName = r.CoverName?.Trim(),
                GrossPremium = r.GrossPremium,
                NetPremium = r.NetPremium,
                CoverageAmount = r.CoverageAmount,
                CommissionPercent = r.CommissionPercent,
                AgencyCommissionPercent = r.AgencyCommissionPercent,
                CreatedAt = _clock.UtcNow
            });
            created++;
        }
        await _db.SaveChangesAsync(ct);
        await SyncPolicyPremiumFromCoversAsync(tenantId, policyId, ct);
        return Ok(new BulkCoverImportResult(created, updated, skipped));
    }

    /// <summary>Full history of bridge-triggered % adjustments on a policy.</summary>
    [HttpGet("cover-adjustments")]
    public async Task<ActionResult<IReadOnlyList<CoverAdjustmentDto>>> ListCoverAdjustments(
        Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await (from a in _db.PolicyCoverAdjustments
                          join c in _db.PolicyCovers on a.PolicyCoverId equals c.Id
                          where a.TenantId == tenantId && a.PolicyId == policyId && a.DeletedAt == null
                          orderby a.CreatedAt descending
                          select new CoverAdjustmentDto(
                              a.Id, c.Id, c.CoverCode, c.CoverName,
                              a.OldAgencyPercent, a.NewAgencyPercent,
                              a.OldProducerPercent, a.NewProducerPercent,
                              a.AgencyAmountDelta, a.ProducerAmountDelta,
                              a.Reason, a.CreatedAt)).ToListAsync(ct);
        return Ok(rows);
    }

    private static CoverDto MapCoverDto(PolicyCover c) => new(
        c.Id, c.PolicyObjectId, c.CoverCode, c.CoverName,
        c.GrossPremium, c.NetPremium, c.CoverageAmount,
        c.CommissionPercent, c.AgencyCommissionPercent);

    /// <summary>Recompute Policy.Premium = Σ(covers.GrossPremium) after any
    /// mutation so the drawer's aggregate always matches what the operator
    /// sees in the breakdown table.</summary>
    private async Task SyncPolicyPremiumFromCoversAsync(Guid tenantId, Guid policyId, CancellationToken ct)
    {
        var policy = await _db.Policies.FirstOrDefaultAsync(
            p => p.Id == policyId && p.TenantId == tenantId && p.DeletedAt == null, ct);
        if (policy is null) return;
        var covers = await _db.PolicyCovers
            .Where(c => c.PolicyId == policyId && c.TenantId == tenantId && c.DeletedAt == null)
            .ToListAsync(ct);
        if (Kalypsis.Application.Features.Policies.PolicyPremiumMath
            .TrySyncPolicyPremiumFromCovers(policy, covers))
        {
            await _db.SaveChangesAsync(ct);
        }
    }

    /* ===================== POLICY INSTALLMENTS ===================== */

    public record InstallmentDto(Guid Id, int Ordinal, DateOnly DueDate, decimal Amount, string Currency,
        DateOnly? PaidAt, string? PaidVia, string? ReceiptReference);
    public record InstallmentMarkPaidBody(string? PaidVia, string? ReceiptReference);

    [HttpGet("installments")]
    public async Task<ActionResult<IReadOnlyList<InstallmentDto>>> ListInstallments(Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.PolicyInstallments
            .Where(i => i.TenantId == tenantId && i.PolicyId == policyId && i.DeletedAt == null)
            .OrderBy(i => i.Ordinal)
            .ToListAsync(ct);
        return Ok(rows.Select(i => new InstallmentDto(i.Id, i.Ordinal, i.DueDate, i.Amount, i.Currency,
            i.PaidAt, i.PaidVia, i.ReceiptReference)).ToList());
    }

    /// <summary>Generates installments according to the policy's PaymentFrequency.</summary>
    [HttpPost("installments/generate")]
    public async Task<ActionResult<IReadOnlyList<InstallmentDto>>> GenerateInstallments(Guid policyId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.FirstOrDefaultAsync(
            x => x.Id == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        // Drop any existing un-paid installments first so re-generating is safe.
        var existing = await _db.PolicyInstallments
            .Where(i => i.TenantId == tenantId && i.PolicyId == policyId && i.PaidAt == null && i.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var e in existing) e.DeletedAt = _clock.UtcNow;

        int count = p.PaymentFrequency switch
        {
            Kalypsis.Domain.Enums.PaymentFrequency.Annual => 1,
            Kalypsis.Domain.Enums.PaymentFrequency.Semiannual => 2,
            Kalypsis.Domain.Enums.PaymentFrequency.Quarterly => 4,
            Kalypsis.Domain.Enums.PaymentFrequency.Monthly => 12,
            Kalypsis.Domain.Enums.PaymentFrequency.Single => 1,
            _ => 1
        };
        var perInstallment = Math.Round(p.Premium / count, 2);
        // Distribute remainder into the last installment so the total matches.
        var distributed = perInstallment * count;
        var lastAdjust = p.Premium - distributed;

        var startDate = p.StartDate;
        for (int n = 1; n <= count; n++)
        {
            var due = count switch
            {
                12 => startDate.AddMonths(n - 1),
                4 => startDate.AddMonths((n - 1) * 3),
                2 => startDate.AddMonths((n - 1) * 6),
                _ => startDate
            };
            var amount = (n == count) ? perInstallment + lastAdjust : perInstallment;
            _db.PolicyInstallments.Add(new PolicyInstallment
            {
                Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = policyId,
                Ordinal = n, DueDate = due, Amount = amount, Currency = p.Currency,
                CreatedAt = _clock.UtcNow
            });
        }
        await _db.SaveChangesAsync(ct);

        var rows = await _db.PolicyInstallments
            .Where(i => i.TenantId == tenantId && i.PolicyId == policyId && i.DeletedAt == null)
            .OrderBy(i => i.Ordinal)
            .ToListAsync(ct);
        return Ok(rows.Select(i => new InstallmentDto(i.Id, i.Ordinal, i.DueDate, i.Amount, i.Currency,
            i.PaidAt, i.PaidVia, i.ReceiptReference)).ToList());
    }

    [HttpPost("installments/{installmentId:guid}/mark-paid")]
    public async Task<ActionResult<InstallmentDto>> MarkInstallmentPaid(Guid policyId, Guid installmentId,
        [FromBody] InstallmentMarkPaidBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var i = await _db.PolicyInstallments.FirstOrDefaultAsync(
            x => x.Id == installmentId && x.PolicyId == policyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Δόση");
        i.PaidAt = DateOnly.FromDateTime(_clock.UtcNow);
        i.PaidVia = body.PaidVia?.Trim();
        i.ReceiptReference = body.ReceiptReference?.Trim();
        i.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new InstallmentDto(i.Id, i.Ordinal, i.DueDate, i.Amount, i.Currency,
            i.PaidAt, i.PaidVia, i.ReceiptReference));
    }
}

/* =================== UPCOMING RENEWALS + BULK RENEWAL =================== */

[ApiController]
[Route("api/renewals")]
[Authorize(Policy = "AgencyStaff")]
public class RenewalsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public RenewalsController(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public record UpcomingDto(Guid PolicyId, string PolicyNumber, string CustomerDisplay,
        string InsuranceCompanyName, string PolicyType, DateOnly EndDate, decimal Premium, string Currency,
        int DaysToRenewal);

    [HttpGet("upcoming")]
    public async Task<ActionResult<IReadOnlyList<UpcomingDto>>> Upcoming(
        [FromQuery] int days = 90, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff = today.AddDays(Math.Clamp(days, 1, 365));
        var rows = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.EndDate >= today && p.EndDate <= cutoff)
            .Include(p => p.Customer)
            .Include(p => p.InsuranceCompany)
            .OrderBy(p => p.EndDate)
            .Take(500)
            .ToListAsync(ct);
        return Ok(rows.Select(p =>
        {
            var name = p.Customer is null
                ? string.Empty
                : (p.Customer.CompanyName ?? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim());
            return new UpcomingDto(p.Id, p.PolicyNumber, name,
                p.InsuranceCompany?.Name ?? string.Empty, p.PolicyType.ToString(),
                p.EndDate, p.Premium, p.Currency, p.EndDate.DayNumber - today.DayNumber);
        }).ToList());
    }

    public record BulkRenewBody(IReadOnlyList<Guid> PolicyIds, int RenewalTermDays);

    [HttpPost("bulk")]
    public async Task<ActionResult<int>> BulkRenew([FromBody] BulkRenewBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var sourcePolicies = await _db.Policies.IgnoreQueryFilters()
            .Where(p => body.PolicyIds.Contains(p.Id) && p.TenantId == tenantId && p.DeletedAt == null)
            .ToListAsync(ct);
        var nowUtc = DateTime.UtcNow;
        var count = 0;
        var term = body.RenewalTermDays > 0 ? body.RenewalTermDays : 365;
        foreach (var src in sourcePolicies)
        {
            var renewal = new Policy
            {
                Id = Guid.NewGuid(), TenantId = tenantId,
                PolicyNumber = $"{src.PolicyNumber}-R",
                CustomerId = src.CustomerId,
                InsuranceCompanyId = src.InsuranceCompanyId,
                ProducerId = src.ProducerId,
                PolicyType = src.PolicyType,
                VehicleUseCategory = src.VehicleUseCategory,
                Status = Kalypsis.Domain.Enums.PolicyStatus.Active,
                StartDate = src.EndDate.AddDays(1),
                EndDate = src.EndDate.AddDays(1).AddDays(term),
                Premium = src.Premium,
                Currency = src.Currency,
                PaymentFrequency = src.PaymentFrequency,
                PaymentCollectionMethod = src.PaymentCollectionMethod,
                SpecsJson = src.SpecsJson,
                RenewedFromPolicyId = src.Id,
                CreatedAt = nowUtc
            };
            _db.Policies.Add(renewal);
            src.Status = Kalypsis.Domain.Enums.PolicyStatus.Renewed;
            src.UpdatedAt = nowUtc;
            count++;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(count);
    }
}
