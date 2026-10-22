using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Common.Exports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Formats a table snapshot already displayed by the authenticated browser.
/// No entity is looked up or read on behalf of the supplied rows, so browser-only
/// filters, sorting and column selection survive identically in every format.
/// </summary>
[ApiController]
[Route("api/table-exports")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("exports.run")]
public sealed class TableExportsController(IAppDbContext db, ICurrentUser current) : ControllerBase
{
    public record TableSnapshot(string Title, string[] Headers, string?[][] Rows, string? Subtitle = null, int? RecordCount = null);
    public record ExportOfficeIdentity(string Name, string? Code, string? ContactEmail, string? ContactPhone,
        string? AddressLine, string? VatNumber);

    // Printing needs the very same selected-office identity as downloaded files.
    // Expose only the branding already present in exports, under the same permissions.
    [HttpGet("office")]
    public async Task<ActionResult<ExportOfficeIdentity>> Office(CancellationToken ct = default)
        => Ok(await ResolveOffice(ct));

    private async Task<ExportOfficeIdentity> ResolveOffice(CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var tenant = await db.Tenants.AsNoTracking().Where(x => x.Id == tenantId)
            .Select(x => new { x.Name, x.Code, x.AddressLine, x.ContactPhone, x.ContactEmail, x.VatNumber })
            .FirstOrDefaultAsync(ct);
        var office = current.AgencyOfficeId.HasValue
            ? await db.AgencyOffices.AsNoTracking()
                .Where(x => x.Id == current.AgencyOfficeId.Value && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => new { x.Name, x.Code, x.Address, x.City, x.PostalCode, x.Phone, x.Email })
                .FirstOrDefaultAsync(ct)
            : null;
        if (current.AgencyOfficeId.HasValue && office is null) throw AppException.NotFound("Γραφείο");
        var address = office is null ? tenant?.AddressLine
            : string.Join(", ", new[] { office.Address, office.City, office.PostalCode }.Where(value => !string.IsNullOrWhiteSpace(value)));
        return new(office?.Name ?? tenant?.Name ?? "Γραφείο", office?.Code ?? tenant?.Code,
            office?.Email ?? tenant?.ContactEmail, office?.Phone ?? tenant?.ContactPhone, address, tenant?.VatNumber);
    }

    [HttpPost]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Export([FromBody] TableSnapshot body,
        [FromQuery] string format = "pdf", CancellationToken ct = default)
    {
        var normalizedFormat = format.ToLowerInvariant();
        if (normalizedFormat is not ("csv" or "xlsx" or "pdf"))
            throw AppException.Validation("Επιλέξτε μορφή CSV, Excel ή PDF.");
        if (body.Headers is null || body.Headers.Length is < 1 or > 50
            || body.Headers.Any(header => string.IsNullOrWhiteSpace(header) || header.Length > 200)
            || body.Rows is null || body.Rows.Length > 5000
            || body.RecordCount is < 0 || body.RecordCount > body.Rows.Length
            || body.Rows.Any(row => row is null || row.Length != body.Headers.Length
                || row.Any(value => value?.Length > 20_000)))
            throw AppException.Validation("Ο πίνακας εξαγωγής δεν είναι έγκυρος ή υπερβαίνει τα όρια εξαγωγής.");
        var office = await ResolveOffice(ct);
        var details = new[]
        {
            office.AddressLine, office.ContactPhone, office.ContactEmail,
            string.IsNullOrWhiteSpace(office.VatNumber) ? null : $"ΑΦΜ: {office.VatNumber}"
        }.Where(value => !string.IsNullOrWhiteSpace(value));
        var title = string.IsNullOrWhiteSpace(body.Title) ? "Λίστα" : body.Title.Trim()[..Math.Min(body.Title.Trim().Length, 200)];
        var subtitle = string.Join(" · ", new[] { title, body.Subtitle, $"{body.RecordCount ?? body.Rows.Length} εγγραφές" }.Where(value => !string.IsNullOrWhiteSpace(value)));
        var sheet = new Sheet(title, body.Headers,
            body.Rows.Select(row => (IReadOnlyList<string>)row.Select(value => value ?? "").ToArray()).ToArray(),
            subtitle, office.Name, string.Join(" · ", details), HeaderTitle: office.Name);
        var bytes = normalizedFormat switch
        {
            "csv" => ExportFormatter.BuildCsv(sheet),
            "xlsx" => ExportFormatter.BuildXlsx(sheet),
            _ => ExportFormatter.BuildPdf(sheet)
        };
        var mime = normalizedFormat switch
        {
            "csv" => "text/csv;charset=utf-8",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            _ => "application/pdf"
        };
        return File(bytes, mime, $"table-{DateTime.UtcNow:yyyyMMdd-HHmm}.{normalizedFormat}");
    }
}
