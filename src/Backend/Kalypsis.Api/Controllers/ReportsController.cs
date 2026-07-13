using System.Globalization;
using System.Text;
using Kalypsis.Application.Features.Reports;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    public ReportsController(IMediator mediator) => _mediator = mediator;

    [HttpGet("agency")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<AgencyReportDto>> Agency(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetAgencyReportQuery(), cancellationToken));

    [HttpGet("producer")]
    [Authorize(Policy = "Producer")]
    public async Task<ActionResult<ProducerReportDto>> Producer(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetProducerReportQuery(), cancellationToken));

    [HttpGet("agency-user")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<AgencyUserReportDto>> AgencyUser(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetAgencyUserReportQuery(), cancellationToken));

    [HttpGet("platform")]
    [Authorize(Policy = "PlatformLevel")]
    public async Task<ActionResult<PlatformReportDto>> Platform(CancellationToken cancellationToken)
        => Ok(await _mediator.Send(new GetPlatformReportQuery(), cancellationToken));

    /// <summary>
    /// Λίστες παραγωγής — production report with server-side filtering +
    /// group-by. Powers the /app/production-report page and the CSV export.
    /// </summary>
    [HttpGet("production")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ProductionReportDto>> Production(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? carrierId,
        [FromQuery] Guid? producerId,
        [FromQuery] PolicyType? policyType,
        [FromQuery] string groupBy = "month",
        [FromQuery] bool includeCancelled = false,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(
            new GetProductionReportQuery(from, to, carrierId, producerId, policyType, groupBy, includeCancelled),
            cancellationToken));

    /// <summary>
    /// Same filters as /reports/production but streams a CSV attachment so
    /// the operator can hand a spreadsheet to their λογιστή. Semicolon-
    /// separated + UTF-8 BOM so Greek Excel opens it without wizardry.
    /// </summary>
    [HttpGet("production/export.csv")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> ProductionCsv(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? carrierId,
        [FromQuery] Guid? producerId,
        [FromQuery] PolicyType? policyType,
        [FromQuery] string groupBy = "month",
        [FromQuery] bool includeCancelled = false,
        CancellationToken cancellationToken = default)
    {
        var report = await _mediator.Send(
            new GetProductionReportQuery(from, to, carrierId, producerId, policyType, groupBy, includeCancelled),
            cancellationToken);
        var el = CultureInfo.GetCultureInfo("el-GR");
        var sb = new StringBuilder();
        sb.AppendLine($"Λίστα παραγωγής;{report.From:yyyy-MM-dd};έως;{report.To:yyyy-MM-dd};ομαδοποίηση;{report.GroupBy}");
        sb.AppendLine("Ομάδα;Συμβόλαια;Νέα;Ανανεώσεις;Μικτό ασφάλιστρο;Καθαρό ασφάλιστρο;Προμήθεια γραφείου;Προμήθεια συνεργατών");
        foreach (var r in report.Rows)
            sb.AppendLine(string.Join(';',
                Csv(r.GroupLabel),
                r.PolicyCount.ToString(el),
                r.NewCount.ToString(el),
                r.RenewalCount.ToString(el),
                r.GrossPremium.ToString("F2", el),
                r.NetPremium.ToString("F2", el),
                r.AgencyCommission.ToString("F2", el),
                r.ProducerCommission.ToString("F2", el)));
        // Grand total on the last line so the accountant can eyeball it.
        var t = report.Totals;
        sb.AppendLine(string.Join(';',
            "ΣΥΝΟΛΟ",
            t.PolicyCount.ToString(el),
            t.NewCount.ToString(el),
            t.RenewalCount.ToString(el),
            t.GrossPremium.ToString("F2", el),
            t.NetPremium.ToString("F2", el),
            t.AgencyCommission.ToString("F2", el),
            t.ProducerCommission.ToString("F2", el)));

        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        var fileName = $"paragogi-{report.From:yyyyMMdd}-{report.To:yyyyMMdd}.csv";
        return File(bytes, "text/csv; charset=utf-8", fileName);
    }

    private static string Csv(string? s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return (s.Contains(';') || s.Contains('"') || s.Contains('\n'))
            ? "\"" + s.Replace("\"", "\"\"") + "\""
            : s;
    }
}
