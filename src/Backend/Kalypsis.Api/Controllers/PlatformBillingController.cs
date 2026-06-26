using Kalypsis.Application.Features.PlatformBilling;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/platform/billing")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformBillingController : ControllerBase
{
    private readonly IMediator _m;
    public PlatformBillingController(IMediator m) => _m = m;

    /* -------- pricing per (tenant × package) -------- */

    [HttpGet("tenants")]
    public async Task<ActionResult<IReadOnlyList<TenantBillingRowDto>>> ListTenants(CancellationToken ct)
        => Ok(await _m.Send(new GetTenantBillingRowsQuery(), ct));

    [HttpGet("summary")]
    public async Task<ActionResult<PlatformBillingSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _m.Send(new GetPlatformBillingSummaryQuery(), ct));

    public record SetPriceBody(string Package, decimal? MonthlyPrice, string Currency);

    [HttpPut("tenants/{tenantId:guid}/package-price")]
    public async Task<ActionResult<TenantPackagePriceDto>> SetPrice(
        Guid tenantId, [FromBody] SetPriceBody body, CancellationToken ct)
    {
        if (!Enum.TryParse<PackageCode>(body.Package, true, out var pkg))
            return BadRequest(new { code = "validation", message = "Άγνωστος κωδικός πακέτου." });
        var dto = await _m.Send(new SetTenantPackagePriceCommand(
            tenantId, pkg, body.MonthlyPrice, body.Currency ?? "EUR"), ct);
        return Ok(dto);
    }

    /* -------- invoices -------- */

    [HttpGet("invoices")]
    public async Task<ActionResult<IReadOnlyList<InvoiceSummaryDto>>> ListInvoices(
        [FromQuery] int? year, [FromQuery] int? month, [FromQuery] string? status,
        [FromQuery] Guid? tenantId, CancellationToken ct)
        => Ok(await _m.Send(new ListInvoicesQuery(year, month, status, tenantId), ct));

    [HttpGet("invoices/{id:guid}")]
    public async Task<ActionResult<InvoiceDetailDto>> GetInvoice(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new GetInvoiceQuery(id), ct));

    public record GenerateBody(int Year, int Month, decimal VatRate, Guid? TenantId);

    [HttpPost("invoices/generate")]
    public async Task<ActionResult<GenerateInvoicesResult>> Generate(
        [FromBody] GenerateBody body, CancellationToken ct)
        => Ok(await _m.Send(new GenerateInvoicesCommand(
            body.Year, body.Month, body.VatRate, body.TenantId), ct));

    [HttpGet("invoices/{id:guid}/pdf")]
    public async Task<IActionResult> GetInvoicePdf(Guid id, CancellationToken ct)
    {
        var bytes = await _m.Send(new GetInvoicePdfQuery(id), ct);
        var inv = await _m.Send(new GetInvoiceQuery(id), ct);
        return File(bytes, "application/pdf", $"{inv.InvoiceNumber}.pdf");
    }

    public record SendEmailBody(string? OverrideEmail);

    [HttpPost("invoices/{id:guid}/email")]
    public async Task<ActionResult<SendInvoiceEmailResult>> SendEmail(
        Guid id, [FromBody] SendEmailBody body, CancellationToken ct)
        => Ok(await _m.Send(new SendInvoiceEmailCommand(id, body.OverrideEmail), ct));

    public record StatusBody(string Status);

    [HttpPatch("invoices/{id:guid}/status")]
    public async Task<ActionResult<InvoiceDetailDto>> SetStatus(
        Guid id, [FromBody] StatusBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpdateInvoiceStatusCommand(id, body.Status), ct));

    [HttpDelete("invoices/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _m.Send(new DeleteInvoiceCommand(id), ct);
        return NoContent();
    }
}
