using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/production-lists")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("production.read")]
public class ProductionListsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public ProductionListsController(IMediator mediator, AppDbContext db, ICurrentUser current)
    { _mediator = mediator; _db = db; _current = current; }

    [HttpGet]
    public async Task<ActionResult<ProductionListResultDto>> Get(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] Guid? producerId,
        [FromQuery] string? policyType, [FromQuery] PolicyStatus? status,
        [FromQuery] string? vehicleUseCategory, [FromQuery] string? coverCode,
        [FromQuery] string? packageCode,
        [FromQuery] string? groupBy, CancellationToken ct)
        => Ok(await _mediator.Send(new GetProductionListQuery(
            new ProductionFilters(from, to, insuranceCompanyId, producerId,
                ProductionFilters.ParseBranch(policyType), status,
                ProductionFilters.ParseUse(vehicleUseCategory), coverCode, groupBy, packageCode,
                ProductionFilters.RawUseFallback(vehicleUseCategory),
                ProductionFilters.RawBranchFallback(policyType))), ct));

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? insuranceCompanyId, [FromQuery] Guid? producerId,
        [FromQuery] string? policyType, [FromQuery] PolicyStatus? status,
        [FromQuery] string? vehicleUseCategory, [FromQuery] string? coverCode,
        [FromQuery] string? packageCode,
        [FromQuery] string? groupBy, [FromQuery] string format = "csv",
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new ExportProductionListQuery(
            new ProductionFilters(from, to, insuranceCompanyId, producerId,
                ProductionFilters.ParseBranch(policyType), status,
                ProductionFilters.ParseUse(vehicleUseCategory), coverCode, groupBy, packageCode,
                ProductionFilters.RawUseFallback(vehicleUseCategory),
                ProductionFilters.RawBranchFallback(policyType)),
            format), ct);
        return File(result.Content, result.MimeType, result.FileName);
    }

    public record CarrierCodeBackfillResult(
        int PoliciesScanned,
        int PackageCodeSet,
        int CoverageCodeSet,
        int RemainingWithoutUseCode,
        int RemainingWithoutBranchCode,
        string Note);

    /// <summary>
    /// One-off backfill of Policy.CarrierPackageCode / CarrierCoverageCode
    /// for policies that were imported before those columns existed. Reads
    /// the codes out of SpecsJson (both bridge- and manual-created policies
    /// stash them there under coverCode / packageCode / cover_code /
    /// coverage_code keys). CarrierUseCode and CarrierBranchCode CAN'T be
    /// backfilled — they were never persisted anywhere on the old policies,
    /// so the response reports how many rows still lack them (operator
    /// needs to re-import the carrier xlsx to populate those).
    /// </summary>
    [HttpPost("backfill-carrier-codes")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<CarrierCodeBackfillResult>> BackfillCarrierCodes(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var candidates = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                && (p.CarrierPackageCode == null || p.CarrierCoverageCode == null)
                && p.SpecsJson != null)
            .Select(p => new { p.Id, p.SpecsJson, p.CarrierPackageCode, p.CarrierCoverageCode })
            .ToListAsync(ct);

        int pkgSet = 0, covSet = 0;
        foreach (var row in candidates)
        {
            if (string.IsNullOrWhiteSpace(row.SpecsJson)) continue;
            string? cover = null, pkg = null;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(row.SpecsJson);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.Value.ValueKind != System.Text.Json.JsonValueKind.String) continue;
                    var v = prop.Value.GetString();
                    if (string.IsNullOrWhiteSpace(v)) continue;
                    var name = prop.Name;
                    if (cover is null && (
                        name.Equals("coverCode",     StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("cover_code",    StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("coverageCode",  StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("coverage_code", StringComparison.OrdinalIgnoreCase)))
                        cover = v.Trim();
                    if (pkg is null && (
                        name.Equals("packageCode",  StringComparison.OrdinalIgnoreCase) ||
                        name.Equals("package_code", StringComparison.OrdinalIgnoreCase)))
                        pkg = v.Trim();
                }
            }
            catch { /* malformed SpecsJson — skip */ }

            if (cover is not null || pkg is not null)
            {
                var stub = new Domain.Entities.Policy { Id = row.Id };
                _db.Policies.Attach(stub);
                if (cover is not null && row.CarrierCoverageCode is null)
                {
                    stub.CarrierCoverageCode = cover;
                    _db.Entry(stub).Property(x => x.CarrierCoverageCode).IsModified = true;
                    covSet++;
                }
                if (pkg is not null && row.CarrierPackageCode is null)
                {
                    stub.CarrierPackageCode = pkg;
                    _db.Entry(stub).Property(x => x.CarrierPackageCode).IsModified = true;
                    pkgSet++;
                }
            }
        }
        await _db.SaveChangesAsync(ct);

        var stillMissingUse = await _db.Policies
            .CountAsync(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.CarrierUseCode == null && p.VehicleUseCategory == null, ct);
        var stillMissingBranch = await _db.Policies
            .CountAsync(p => p.TenantId == tenantId && p.DeletedAt == null
                && p.CarrierBranchCode == null && p.PolicyType == PolicyType.Other, ct);

        return Ok(new CarrierCodeBackfillResult(
            PoliciesScanned: candidates.Count,
            PackageCodeSet: pkgSet,
            CoverageCodeSet: covSet,
            RemainingWithoutUseCode: stillMissingUse,
            RemainingWithoutBranchCode: stillMissingBranch,
            Note: stillMissingUse == 0 && stillMissingBranch == 0
                ? "Όλα τα συμβόλαια έχουν πλέον carrier codes."
                : "Οι στήλες Χρήση/Κλάδος δεν είναι διαθέσιμες στο SpecsJson παλαιότερων συμβολαίων — επαναφέρετε τα ίδια bridge αρχεία για να συμπληρωθούν."));
    }
}
