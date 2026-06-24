using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Phase 7 — PlatformAdmin endpoints to manage the commercial contract
/// between Kalypsis and each γραφείο.
/// </summary>
[ApiController]
[Route("api/platform/tenants/{tenantId:guid}/contracts")]
[Authorize(Policy = "PlatformAdmin")]
public class TenantContractsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public TenantContractsController(AppDbContext db, IDateTimeProvider clock, IFileStorage storage, ICurrentUser current)
    { _db = db; _clock = clock; _storage = storage; _current = current; }

    public record ContractDto(
        Guid Id, string ContractNumber,
        DateOnly SignedAt, DateOnly EffectiveFrom, DateOnly? EffectiveTo,
        string Plan, decimal MonthlyBaseAmount, decimal OfficeSurchargePerExtra,
        int OfficeIncludedCount, string Currency,
        bool AutoRenew, int RenewalTermMonths,
        string? SignedByName, string? SignedByEmail, string? SignedByRole,
        string? ContractFileKey, string? ContractFileName, long? ContractFileSizeBytes,
        bool IsActive, DateTime? TerminatedAt, string? TerminationReason, string? Notes,
        DateTime CreatedAt);

    public record UpsertContractBody(
        string ContractNumber,
        DateOnly SignedAt, DateOnly EffectiveFrom, DateOnly? EffectiveTo,
        string Plan, decimal MonthlyBaseAmount, decimal OfficeSurchargePerExtra,
        int OfficeIncludedCount, string Currency,
        bool AutoRenew, int RenewalTermMonths,
        string? SignedByName, string? SignedByEmail, string? SignedByRole,
        string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContractDto>>> List(Guid tenantId, CancellationToken ct) =>
        Ok(await _db.TenantContracts.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null)
            .OrderByDescending(c => c.IsActive).ThenByDescending(c => c.SignedAt)
            .Select(c => new ContractDto(c.Id, c.ContractNumber,
                c.SignedAt, c.EffectiveFrom, c.EffectiveTo,
                c.Plan, c.MonthlyBaseAmount, c.OfficeSurchargePerExtra,
                c.OfficeIncludedCount, c.Currency,
                c.AutoRenew, c.RenewalTermMonths,
                c.SignedByName, c.SignedByEmail, c.SignedByRole,
                c.ContractFileKey, c.ContractFileName, c.ContractFileSizeBytes,
                c.IsActive, c.TerminatedAt, c.TerminationReason, c.Notes,
                c.CreatedAt))
            .ToListAsync(ct));

    [HttpPost]
    public async Task<ActionResult<ContractDto>> Create(Guid tenantId, [FromBody] UpsertContractBody body, CancellationToken ct)
    {
        // Tenant existence guard
        var tenantExists = await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Id == tenantId, ct);
        if (!tenantExists) throw AppException.NotFound("Tenant");

        // Only one active contract per tenant — deactivate the previous if any
        await _db.TenantContracts.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.IsActive && c.DeletedAt == null)
            .ForEachAsync(c => { c.IsActive = false; c.TerminatedAt = _clock.UtcNow; c.TerminationReason ??= "Superseded by new contract."; }, ct);

        var contract = new TenantContract
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ContractNumber = body.ContractNumber.Trim(),
            SignedAt = body.SignedAt,
            EffectiveFrom = body.EffectiveFrom,
            EffectiveTo = body.EffectiveTo,
            Plan = body.Plan,
            MonthlyBaseAmount = body.MonthlyBaseAmount,
            OfficeSurchargePerExtra = body.OfficeSurchargePerExtra,
            OfficeIncludedCount = Math.Max(0, body.OfficeIncludedCount),
            Currency = string.IsNullOrWhiteSpace(body.Currency) ? "EUR" : body.Currency.ToUpperInvariant(),
            AutoRenew = body.AutoRenew,
            RenewalTermMonths = body.RenewalTermMonths,
            SignedByName = body.SignedByName,
            SignedByEmail = body.SignedByEmail,
            SignedByRole = body.SignedByRole,
            Notes = body.Notes,
            IsActive = true
        };
        _db.TenantContracts.Add(contract);
        await _db.SaveChangesAsync(ct);

        return Ok(ToDto(contract));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ContractDto>> Update(Guid tenantId, Guid id, [FromBody] UpsertContractBody body, CancellationToken ct)
    {
        var c = await _db.TenantContracts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Contract");
        c.ContractNumber = body.ContractNumber.Trim();
        c.SignedAt = body.SignedAt;
        c.EffectiveFrom = body.EffectiveFrom;
        c.EffectiveTo = body.EffectiveTo;
        c.Plan = body.Plan;
        c.MonthlyBaseAmount = body.MonthlyBaseAmount;
        c.OfficeSurchargePerExtra = body.OfficeSurchargePerExtra;
        c.OfficeIncludedCount = Math.Max(0, body.OfficeIncludedCount);
        c.Currency = string.IsNullOrWhiteSpace(body.Currency) ? "EUR" : body.Currency.ToUpperInvariant();
        c.AutoRenew = body.AutoRenew;
        c.RenewalTermMonths = body.RenewalTermMonths;
        c.SignedByName = body.SignedByName;
        c.SignedByEmail = body.SignedByEmail;
        c.SignedByRole = body.SignedByRole;
        c.Notes = body.Notes;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    public record TerminateBody(string Reason);

    [HttpPost("{id:guid}/terminate")]
    public async Task<ActionResult> Terminate(Guid tenantId, Guid id, [FromBody] TerminateBody body, CancellationToken ct)
    {
        var c = await _db.TenantContracts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Contract");
        c.IsActive = false;
        c.TerminatedAt = _clock.UtcNow;
        c.TerminationReason = body.Reason;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [RequestSizeLimit(20_000_000)]
    [HttpPost("{id:guid}/upload")]
    public async Task<ActionResult<ContractDto>> Upload(Guid tenantId, Guid id, IFormFile file, CancellationToken ct)
    {
        var c = await _db.TenantContracts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Contract");
        if (file is null || file.Length == 0) return BadRequest(new { code = "no_file" });
        if (file.ContentType != "application/pdf") return BadRequest(new { code = "pdf_only", message = "Μόνο PDF γίνεται δεκτό." });

        // Delete prior file (if any) — keep storage tidy
        if (!string.IsNullOrEmpty(c.ContractFileKey))
            try { await _storage.DeleteAsync(c.ContractFileKey, ct); } catch { /* ignore */ }

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadAsync($"contracts/{tenantId:N}", file.FileName, file.ContentType, stream, ct);

        c.ContractFileKey = key;
        c.ContractFileName = file.FileName;
        c.ContractFileSizeBytes = file.Length;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid tenantId, Guid id, CancellationToken ct)
    {
        var c = await _db.TenantContracts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Contract");
        if (string.IsNullOrEmpty(c.ContractFileKey)) return NotFound(new { code = "no_file" });
        var stream = await _storage.DownloadAsync(c.ContractFileKey, ct);
        return File(stream, "application/pdf", c.ContractFileName ?? $"{c.ContractNumber}.pdf");
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid tenantId, Guid id, CancellationToken ct)
    {
        var c = await _db.TenantContracts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Contract");
        c.DeletedAt = _clock.UtcNow;
        if (c.IsActive) { c.IsActive = false; c.TerminatedAt = _clock.UtcNow; }
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static ContractDto ToDto(TenantContract c) => new(
        c.Id, c.ContractNumber, c.SignedAt, c.EffectiveFrom, c.EffectiveTo,
        c.Plan, c.MonthlyBaseAmount, c.OfficeSurchargePerExtra, c.OfficeIncludedCount, c.Currency,
        c.AutoRenew, c.RenewalTermMonths,
        c.SignedByName, c.SignedByEmail, c.SignedByRole,
        c.ContractFileKey, c.ContractFileName, c.ContractFileSizeBytes,
        c.IsActive, c.TerminatedAt, c.TerminationReason, c.Notes, c.CreatedAt);
}
