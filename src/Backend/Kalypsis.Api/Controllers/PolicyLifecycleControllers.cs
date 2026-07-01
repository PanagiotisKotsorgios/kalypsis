using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers.PolicyLifecycle;

// ============================================================================
// Phase 9 — Policy lifecycle controllers: endorsements, cancellations,
// credit notes, and the bulk commission editor. All AgencyStaff/Admin-gated
// under the BackOffice package.
// ============================================================================

/* ============ ENDORSEMENTS (Πρόσθετες πράξεις) ============ */

[ApiController]
[Route("api/endorsements")]
[Authorize(Policy = "AgencyStaff")]
public class EndorsementsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public EndorsementsController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record EndorsementDto(Guid Id, Guid PolicyId, string PolicyNumber,
        string EndorsementNumber, EndorsementType Type, EndorsementStatus Status,
        DateOnly IssuedAt, DateOnly EffectiveFrom, DateOnly? EffectiveTo,
        string Description, string? CarrierReference,
        decimal PremiumDelta, decimal CommissionDelta, string Currency,
        string? ChangesJson, string? Notes, DateTime CreatedAt);

    public record UpsertEndorsementBody(Guid PolicyId, EndorsementType Type,
        DateOnly IssuedAt, DateOnly EffectiveFrom, DateOnly? EffectiveTo,
        string Description, string? CarrierReference,
        decimal PremiumDelta, decimal CommissionDelta,
        string? ChangesJson, string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EndorsementDto>>> List(
        [FromQuery] Guid? policyId, [FromQuery] EndorsementStatus? status, CancellationToken ct)
    {
        var q = _db.PolicyEndorsements.Where(e => e.DeletedAt == null);
        if (policyId.HasValue) q = q.Where(e => e.PolicyId == policyId.Value);
        if (status.HasValue) q = q.Where(e => e.Status == status.Value);
        return Ok(await q.OrderByDescending(e => e.IssuedAt)
            .Select(e => new EndorsementDto(e.Id, e.PolicyId, e.Policy.PolicyNumber,
                e.EndorsementNumber, e.Type, e.Status,
                e.IssuedAt, e.EffectiveFrom, e.EffectiveTo,
                e.Description, e.CarrierReference,
                e.PremiumDelta, e.CommissionDelta, e.Currency,
                e.ChangesJson, e.Notes, e.CreatedAt))
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<ActionResult<EndorsementDto>> Create([FromBody] UpsertEndorsementBody body, CancellationToken ct)
    {
        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Id == body.PolicyId, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        // Auto-generate endorsement number
        var year = body.IssuedAt.Year;
        var lastSeq = await _db.PolicyEndorsements
            .Where(e => e.EndorsementNumber.StartsWith($"PP-{year}-"))
            .CountAsync(ct);
        var number = $"PP-{year}-{(lastSeq + 1):D5}";

        var e = new PolicyEndorsement
        {
            Id = Guid.NewGuid(),
            PolicyId = body.PolicyId,
            EndorsementNumber = number,
            Type = body.Type,
            Status = EndorsementStatus.Draft,
            IssuedAt = body.IssuedAt,
            EffectiveFrom = body.EffectiveFrom,
            EffectiveTo = body.EffectiveTo,
            Description = body.Description.Trim(),
            CarrierReference = body.CarrierReference,
            PremiumDelta = body.PremiumDelta,
            CommissionDelta = body.CommissionDelta,
            Currency = policy.Currency,
            ChangesJson = body.ChangesJson,
            Notes = body.Notes,
            CreatedByUserId = _current.UserId
        };
        _db.PolicyEndorsements.Add(e);
        await _db.SaveChangesAsync(ct);
        return Ok(await GetDto(e.Id, ct));
    }

    [HttpPost("{id:guid}/issue")]
    public async Task<ActionResult<EndorsementDto>> Issue(Guid id, CancellationToken ct)
    {
        var e = await _db.PolicyEndorsements.Include(x => x.Policy).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρόσθετη πράξη");
        if (e.Status != EndorsementStatus.Draft) return BadRequest(new { code = "not_draft" });
        e.Status = EndorsementStatus.Issued;
        // Apply premium delta to the parent policy
        e.Policy.Premium += e.PremiumDelta;
        e.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(await GetDto(e.Id, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult> Cancel(Guid id, [FromBody] string reason, CancellationToken ct)
    {
        var e = await _db.PolicyEndorsements.Include(x => x.Policy).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρόσθετη πράξη");
        if (e.Status == EndorsementStatus.Cancelled) return BadRequest(new { code = "already_cancelled" });
        // Reverse premium delta if it was already applied
        if (e.Status == EndorsementStatus.Issued) e.Policy.Premium -= e.PremiumDelta;
        e.Status = EndorsementStatus.Cancelled;
        e.CancelledAt = _clock.UtcNow;
        e.CancellationReasonText = reason;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<EndorsementDto>> Update(Guid id, [FromBody] UpsertEndorsementBody body, CancellationToken ct)
    {
        var e = await _db.PolicyEndorsements.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρόσθετη πράξη");
        if (e.Status != EndorsementStatus.Draft)
            return BadRequest(new { code = "not_editable", message = "Μόνο πρόχειρες πράξεις μπορούν να επεξεργαστούν." });
        e.Type = body.Type;
        e.IssuedAt = body.IssuedAt;
        e.EffectiveFrom = body.EffectiveFrom;
        e.EffectiveTo = body.EffectiveTo;
        e.Description = body.Description.Trim();
        e.CarrierReference = body.CarrierReference;
        e.PremiumDelta = body.PremiumDelta;
        e.CommissionDelta = body.CommissionDelta;
        e.ChangesJson = body.ChangesJson;
        e.Notes = body.Notes;
        e.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(await GetDto(e.Id, ct));
    }

    private async Task<EndorsementDto> GetDto(Guid id, CancellationToken ct)
    {
        var e = await _db.PolicyEndorsements.Include(x => x.Policy).FirstAsync(x => x.Id == id, ct);
        return new EndorsementDto(e.Id, e.PolicyId, e.Policy.PolicyNumber, e.EndorsementNumber,
            e.Type, e.Status, e.IssuedAt, e.EffectiveFrom, e.EffectiveTo,
            e.Description, e.CarrierReference, e.PremiumDelta, e.CommissionDelta, e.Currency,
            e.ChangesJson, e.Notes, e.CreatedAt);
    }
}

/* ============ CANCELLATIONS (Ακυρώσεις) ============ */

[ApiController]
[Route("api/policy-cancellations")]
[Authorize(Policy = "AgencyStaff")]
public class PolicyCancellationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public PolicyCancellationsController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record CancellationDto(Guid Id, Guid PolicyId, string PolicyNumber,
        string CancellationNumber, PolicyCancellationStatus Status,
        Guid? ReasonId, string? ReasonName, string? ReasonText,
        DateOnly RequestedAt, DateOnly EffectiveFrom,
        string RefundMethod, decimal RefundAmount, decimal? PenaltyAmount, decimal? CommissionClawback,
        string Currency, Guid? CreditNoteId, string? CarrierReference, string? Notes,
        DateTime CreatedAt);

    public record CreateCancellationBody(Guid PolicyId, Guid? ReasonId, string? ReasonText,
        DateOnly EffectiveFrom, string RefundMethod, decimal? CustomRefund);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CancellationDto>>> List(
        [FromQuery] Guid? policyId, [FromQuery] PolicyCancellationStatus? status, CancellationToken ct)
    {
        var q = _db.PolicyCancellations.Include(c => c.Policy).Include(c => c.Reason)
            .Where(c => c.DeletedAt == null);
        if (policyId.HasValue) q = q.Where(c => c.PolicyId == policyId.Value);
        if (status.HasValue) q = q.Where(c => c.Status == status.Value);
        return Ok(await q.OrderByDescending(c => c.RequestedAt)
            .Select(c => new CancellationDto(c.Id, c.PolicyId, c.Policy.PolicyNumber,
                c.CancellationNumber, c.Status, c.ReasonId, c.Reason!.Name, c.ReasonText,
                c.RequestedAt, c.EffectiveFrom, c.RefundMethod, c.RefundAmount,
                c.PenaltyAmount, c.CommissionClawback, c.Currency,
                c.CreditNoteId, c.CarrierReference, c.Notes, c.CreatedAt))
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<ActionResult<CancellationDto>> Create([FromBody] CreateCancellationBody body, CancellationToken ct)
    {
        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Id == body.PolicyId, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        if (policy.Status == PolicyStatus.Cancelled)
            return BadRequest(new { code = "already_cancelled" });

        var refund = ComputeRefund(policy, body.EffectiveFrom, body.RefundMethod, body.CustomRefund);

        var year = body.EffectiveFrom.Year;
        var lastSeq = await _db.PolicyCancellations.CountAsync(c => c.CancellationNumber.StartsWith($"AK-{year}-"), ct);
        var number = $"AK-{year}-{(lastSeq + 1):D5}";

        var c = new PolicyCancellation
        {
            Id = Guid.NewGuid(),
            PolicyId = body.PolicyId,
            CancellationNumber = number,
            Status = PolicyCancellationStatus.Draft,
            ReasonId = body.ReasonId,
            ReasonText = body.ReasonText,
            RequestedAt = DateOnly.FromDateTime(_clock.UtcNow),
            EffectiveFrom = body.EffectiveFrom,
            RefundMethod = body.RefundMethod,
            RefundAmount = refund,
            Currency = policy.Currency,
            CreatedByUserId = _current.UserId
        };
        _db.PolicyCancellations.Add(c);
        await _db.SaveChangesAsync(ct);
        return Ok(await GetDto(c.Id, ct));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult> Approve(Guid id, CancellationToken ct)
    {
        var c = await _db.PolicyCancellations.Include(x => x.Policy).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Ακύρωση");
        if (c.Status == PolicyCancellationStatus.Effective) return BadRequest(new { code = "already_effective" });
        c.Status = PolicyCancellationStatus.Effective;
        c.ApprovedAt = _clock.UtcNow;
        c.ApprovedByUserId = _current.UserId;
        c.Policy.Status = PolicyStatus.Cancelled;

        // Auto-mint a credit note for the refund
        if (c.RefundAmount > 0 && c.CreditNoteId == null)
        {
            var year = c.EffectiveFrom.Year;
            var noteSeq = await _db.CreditNotes.CountAsync(n => n.CreditNoteNumber.StartsWith($"PI-{year}-"), ct);
            var note = new CreditNote
            {
                Id = Guid.NewGuid(),
                CreditNoteNumber = $"PI-{year}-{(noteSeq + 1):D5}",
                Kind = CreditNoteKind.CancellationRefund,
                Status = CreditNoteStatus.Issued,
                IssuedAt = DateOnly.FromDateTime(_clock.UtcNow),
                CustomerId = c.Policy.CustomerId,
                PolicyId = c.PolicyId,
                Amount = c.RefundAmount,
                Currency = c.Currency,
                Description = $"Επιστροφή από ακύρωση {c.CancellationNumber}",
                RelatedDocumentRef = c.CancellationNumber,
                CreatedByUserId = _current.UserId
            };
            _db.CreditNotes.Add(note);
            c.CreditNoteId = note.Id;
        }
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static decimal ComputeRefund(Policy policy, DateOnly effectiveFrom, string method, decimal? custom)
    {
        if (method == "Custom" && custom.HasValue) return Math.Max(0m, custom.Value);
        if (method == "Full") return policy.Premium;
        var totalDays = policy.EndDate.DayNumber - policy.StartDate.DayNumber;
        if (totalDays <= 0) return 0m;
        var remainingDays = Math.Max(0, policy.EndDate.DayNumber - effectiveFrom.DayNumber);
        var proRata = policy.Premium * remainingDays / totalDays;
        return method == "ShortRate"
            ? Math.Round(proRata * 0.80m, 2)  // 20% short-rate penalty (typical)
            : Math.Round(proRata, 2);
    }

    private async Task<CancellationDto> GetDto(Guid id, CancellationToken ct)
    {
        var c = await _db.PolicyCancellations.Include(x => x.Policy).Include(x => x.Reason).FirstAsync(x => x.Id == id, ct);
        return new CancellationDto(c.Id, c.PolicyId, c.Policy.PolicyNumber, c.CancellationNumber,
            c.Status, c.ReasonId, c.Reason?.Name, c.ReasonText,
            c.RequestedAt, c.EffectiveFrom, c.RefundMethod, c.RefundAmount,
            c.PenaltyAmount, c.CommissionClawback, c.Currency,
            c.CreditNoteId, c.CarrierReference, c.Notes, c.CreatedAt);
    }
}

/* ============ CANCELLATION REASONS (catalog) ============ */

[ApiController]
[Route("api/cancellation-reasons")]
[Authorize(Policy = "AgencyStaff")]
public class CancellationReasonsController : ControllerBase
{
    private readonly AppDbContext _db;
    public CancellationReasonsController(AppDbContext db) => _db = db;

    public record ReasonDto(Guid Id, string Code, string Name, bool TriggersRefund, bool TriggersCreditNote, bool IsActive, int DisplayOrder);
    public record UpsertBody(string Code, string Name, bool TriggersRefund, bool TriggersCreditNote, bool IsActive, int DisplayOrder);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReasonDto>>> List(CancellationToken ct) =>
        Ok(await _db.CancellationReasons.Where(r => r.DeletedAt == null)
            .OrderBy(r => r.DisplayOrder).ThenBy(r => r.Name)
            .Select(r => new ReasonDto(r.Id, r.Code, r.Name, r.TriggersRefund, r.TriggersCreditNote, r.IsActive, r.DisplayOrder))
            .ToListAsync(ct));

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ReasonDto>> Create([FromBody] UpsertBody body, CancellationToken ct)
    {
        var r = new CancellationReason { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(),
            Name = body.Name.Trim(), TriggersRefund = body.TriggersRefund,
            TriggersCreditNote = body.TriggersCreditNote, IsActive = body.IsActive,
            DisplayOrder = body.DisplayOrder };
        _db.CancellationReasons.Add(r);
        await _db.SaveChangesAsync(ct);
        return Ok(new ReasonDto(r.Id, r.Code, r.Name, r.TriggersRefund, r.TriggersCreditNote, r.IsActive, r.DisplayOrder));
    }
}

/* ============ CREDIT NOTES (Πιστωτικά) ============ */

[ApiController]
[Route("api/credit-notes")]
[Authorize(Policy = "AgencyStaff")]
public class CreditNotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public CreditNotesController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    public record CreditNoteDto(Guid Id, string CreditNoteNumber, CreditNoteKind Kind, CreditNoteStatus Status,
        DateOnly IssuedAt, Guid? CustomerId, Guid? PolicyId, decimal Amount, string Currency,
        string Description, string? RelatedDocumentRef, DateTime CreatedAt);

    public record UpsertCreditNoteBody(CreditNoteKind Kind, DateOnly IssuedAt,
        Guid? CustomerId, Guid? InsuranceCompanyId, Guid? ProducerId, Guid? PolicyId,
        decimal Amount, decimal? VatAmount, string Currency, string Description,
        string? RelatedDocumentRef, string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CreditNoteDto>>> List(
        [FromQuery] Guid? customerId, [FromQuery] Guid? policyId, [FromQuery] CreditNoteStatus? status, CancellationToken ct)
    {
        var q = _db.CreditNotes.Where(n => n.DeletedAt == null);
        if (customerId.HasValue) q = q.Where(n => n.CustomerId == customerId.Value);
        if (policyId.HasValue) q = q.Where(n => n.PolicyId == policyId.Value);
        if (status.HasValue) q = q.Where(n => n.Status == status.Value);
        return Ok(await q.OrderByDescending(n => n.IssuedAt)
            .Select(n => new CreditNoteDto(n.Id, n.CreditNoteNumber, n.Kind, n.Status,
                n.IssuedAt, n.CustomerId, n.PolicyId, n.Amount, n.Currency,
                n.Description, n.RelatedDocumentRef, n.CreatedAt))
            .ToListAsync(ct));
    }

    [HttpPost]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CreditNoteDto>> Create([FromBody] UpsertCreditNoteBody body, CancellationToken ct)
    {
        var year = body.IssuedAt.Year;
        var seq = await _db.CreditNotes.CountAsync(n => n.CreditNoteNumber.StartsWith($"PI-{year}-"), ct);
        var n = new CreditNote
        {
            Id = Guid.NewGuid(),
            CreditNoteNumber = $"PI-{year}-{(seq + 1):D5}",
            Kind = body.Kind,
            Status = CreditNoteStatus.Issued,
            IssuedAt = body.IssuedAt,
            CustomerId = body.CustomerId,
            InsuranceCompanyId = body.InsuranceCompanyId,
            ProducerId = body.ProducerId,
            PolicyId = body.PolicyId,
            Amount = body.Amount,
            VatAmount = body.VatAmount,
            Currency = body.Currency,
            Description = body.Description.Trim(),
            RelatedDocumentRef = body.RelatedDocumentRef,
            Notes = body.Notes,
            CreatedByUserId = _current.UserId
        };
        _db.CreditNotes.Add(n);
        await _db.SaveChangesAsync(ct);
        return Ok(new CreditNoteDto(n.Id, n.CreditNoteNumber, n.Kind, n.Status, n.IssuedAt,
            n.CustomerId, n.PolicyId, n.Amount, n.Currency, n.Description, n.RelatedDocumentRef, n.CreatedAt));
    }
}

/* ============ BULK COMMISSION EDITOR ============ */

[ApiController]
[Route("api/bulk-commissions")]
[Authorize(Policy = "AgencyAdmin")]
public class BulkCommissionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ICurrentUser _current;
    public BulkCommissionsController(AppDbContext db, IDateTimeProvider clock, ICurrentUser current)
    { _db = db; _clock = clock; _current = current; }

    private async Task EnsurePremiumAsync(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        await Kalypsis.Application.Features.Premium.PremiumGate.RequireAsync(
            _db, tenantId, Kalypsis.Application.Features.Premium.PremiumFeatureCodes.BulkCommissions, ct);
    }

    public record FilterBody(
        Guid? InsuranceCompanyId, Guid? ProducerId, PolicyType? PolicyType,
        DateOnly? StartDateFrom, DateOnly? StartDateTo,
        VehicleUseCategory? VehicleUseCategory = null,
        string? CoverCode = null, string? PackageCode = null);

    public record PreviewBody(FilterBody Filter, string Operation, decimal Value);
    // Operation: "SetPercentage" / "SetFixed" / "MultiplyBy" / "AddFixed"

    public record PreviewRow(Guid PolicyId, string PolicyNumber, decimal Premium, string Currency,
        decimal CurrentCommission, decimal NewCommission, decimal Delta);
    public record PreviewResponse(int AffectedCount, decimal TotalDelta, IReadOnlyList<PreviewRow> Sample);

    [HttpPost("preview")]
    public async Task<ActionResult<PreviewResponse>> Preview([FromBody] PreviewBody body, CancellationToken ct)
    {
        await EnsurePremiumAsync(ct);
        var q = BuildQuery(body.Filter);
        var policies = ApplyJsonFilters(await q.Take(2000).ToListAsync(ct), body.Filter);
        var rows = new List<PreviewRow>();
        decimal totalDelta = 0m;
        foreach (var p in policies)
        {
            // Pull the matching commission transaction for THIS policy (if any).
            var ct1 = await _db.CommissionTransactions
                .Where(x => x.PolicyId == p.Id && x.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(ct);
            var current = ct1?.Amount ?? 0m;
            var nv = body.Operation switch
            {
                "SetPercentage" => Math.Round(p.Premium * body.Value / 100m, 2),
                "SetFixed"      => Math.Round(body.Value, 2),
                "MultiplyBy"    => Math.Round(current * body.Value, 2),
                "AddFixed"      => Math.Round(current + body.Value, 2),
                _ => current
            };
            var delta = nv - current;
            totalDelta += delta;
            rows.Add(new PreviewRow(p.Id, p.PolicyNumber, p.Premium, p.Currency, current, nv, delta));
        }
        return Ok(new PreviewResponse(rows.Count, Math.Round(totalDelta, 2), rows.Take(50).ToList()));
    }

    [HttpPost("apply")]
    public async Task<ActionResult<PreviewResponse>> Apply([FromBody] PreviewBody body, CancellationToken ct)
    {
        await EnsurePremiumAsync(ct);
        var q = BuildQuery(body.Filter);
        var policies = ApplyJsonFilters(await q.Take(2000).ToListAsync(ct), body.Filter);
        var rows = new List<PreviewRow>();
        decimal totalDelta = 0m;
        foreach (var p in policies)
        {
            var existing = await _db.CommissionTransactions
                .Where(x => x.PolicyId == p.Id && x.DeletedAt == null)
                .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
            var current = existing?.Amount ?? 0m;
            var nv = body.Operation switch
            {
                "SetPercentage" => Math.Round(p.Premium * body.Value / 100m, 2),
                "SetFixed"      => Math.Round(body.Value, 2),
                "MultiplyBy"    => Math.Round(current * body.Value, 2),
                "AddFixed"      => Math.Round(current + body.Value, 2),
                _ => current
            };
            if (existing == null)
            {
                _db.CommissionTransactions.Add(new CommissionTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = p.TenantId,
                    PolicyId = p.Id,
                    Amount = nv,
                    Currency = p.Currency,
                    Status = CommissionTransactionStatus.Pending,
                    TransactionDate = DateOnly.FromDateTime(_clock.UtcNow),
                    CreatedAt = _clock.UtcNow
                });
            }
            else
            {
                existing.Amount = nv;
                existing.UpdatedAt = _clock.UtcNow;
            }
            var delta = nv - current;
            totalDelta += delta;
            rows.Add(new PreviewRow(p.Id, p.PolicyNumber, p.Premium, p.Currency, current, nv, delta));
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new PreviewResponse(rows.Count, Math.Round(totalDelta, 2), rows.Take(50).ToList()));
    }

    private IQueryable<Policy> BuildQuery(FilterBody f)
    {
        var q = _db.Policies.Where(p => p.DeletedAt == null);
        if (f.InsuranceCompanyId.HasValue)
        {
            // Cascade broker → all subs. Picking a broker returns policies
            // across the whole hierarchy; picking a sub (or standalone)
            // returns only that carrier's policies.
            var ids = _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(c => c.DeletedAt == null
                    && (c.Id == f.InsuranceCompanyId.Value
                        || c.ParentCompanyId == f.InsuranceCompanyId.Value))
                .Select(c => c.Id);
            q = q.Where(p => ids.Contains(p.InsuranceCompanyId));
        }
        if (f.ProducerId.HasValue) q = q.Where(p => p.ProducerId == f.ProducerId.Value);
        if (f.PolicyType.HasValue) q = q.Where(p => p.PolicyType == f.PolicyType.Value);
        if (f.VehicleUseCategory.HasValue) q = q.Where(p => p.VehicleUseCategory == f.VehicleUseCategory.Value);
        if (f.StartDateFrom.HasValue) q = q.Where(p => p.StartDate >= f.StartDateFrom.Value);
        if (f.StartDateTo.HasValue) q = q.Where(p => p.StartDate <= f.StartDateTo.Value);
        // CoverCode / PackageCode live inside Policy.SpecsJson — apply them as
        // post-filters on the materialized rows since EF can't translate
        // System.Text.Json parsing to SQL.
        return q;
    }

    /// <summary>Post-filter materialized policies by JSON-stored cover / package codes.</summary>
    private static List<Policy> ApplyJsonFilters(List<Policy> rows, FilterBody f)
    {
        var cover = string.IsNullOrWhiteSpace(f.CoverCode) ? null : f.CoverCode!.Trim().ToUpperInvariant();
        var pkg = string.IsNullOrWhiteSpace(f.PackageCode) ? null : f.PackageCode!.Trim().ToUpperInvariant();
        if (cover is null && pkg is null) return rows;

        static string? Extract(string? json, params string[] keys)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                foreach (var k in keys)
                    if (doc.RootElement.TryGetProperty(k, out var prop)
                        && prop.ValueKind == System.Text.Json.JsonValueKind.String)
                        return prop.GetString()?.Trim().ToUpperInvariant();
            }
            catch { }
            return null;
        }
        return rows.Where(p =>
            (cover is null || string.Equals(Extract(p.SpecsJson, "coverCode", "coverageCode", "coverage", "cover"), cover))
            && (pkg is null || string.Equals(Extract(p.SpecsJson, "packageCode", "package"), pkg))).ToList();
    }
}
