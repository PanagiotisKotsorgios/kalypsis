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
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var tenant = await db.Tenants.AsNoTracking().Where(x => x.Id == tenantId)
            .Select(x => new { x.Name, x.AddressLine, x.ContactPhone, x.ContactEmail, x.VatNumber })
            .FirstOrDefaultAsync(ct);
        var office = current.AgencyOfficeId.HasValue
            ? await db.AgencyOffices.AsNoTracking()
                .Where(x => x.Id == current.AgencyOfficeId.Value && x.TenantId == tenantId)
                .Select(x => new { x.Name, x.Address, x.City, x.PostalCode, x.Phone, x.Email })
                .FirstOrDefaultAsync(ct)
            : null;
        var officeName = office?.Name ?? tenant?.Name ?? "Γραφείο";
        var details = new[]
        {
            office is null ? tenant?.AddressLine : string.Join(", ", new[] { office.Address, office.City, office.PostalCode }.Where(value => !string.IsNullOrWhiteSpace(value))),
            office?.Phone ?? tenant?.ContactPhone, office?.Email ?? tenant?.ContactEmail,
            string.IsNullOrWhiteSpace(tenant?.VatNumber) ? null : $"ΑΦΜ: {tenant!.VatNumber}"
        }.Where(value => !string.IsNullOrWhiteSpace(value));
        var title = string.IsNullOrWhiteSpace(body.Title) ? "Λίστα" : body.Title.Trim()[..Math.Min(body.Title.Trim().Length, 200)];
        var subtitle = string.Join(" · ", new[] { title, body.Subtitle, $"{body.RecordCount ?? body.Rows.Length} εγγραφές" }.Where(value => !string.IsNullOrWhiteSpace(value)));
        var sheet = new Sheet(title, body.Headers,
            body.Rows.Select(row => (IReadOnlyList<string>)row.Select(value => value ?? "").ToArray()).ToArray(),
            subtitle, officeName, string.Join(" · ", details), HeaderTitle: officeName);
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
