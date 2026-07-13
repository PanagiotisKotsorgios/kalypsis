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

    // ==== Καταμερισμός Προμηθειών =============================================
    [HttpGet("commission-distribution")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<CommissionDistributionDto>> CommissionDistribution(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? producerId,
        [FromQuery] Guid? carrierId,
        [FromQuery] string? level,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(
            new GetCommissionDistributionQuery(from, to, producerId, carrierId, level),
            cancellationToken));

    [HttpGet("commission-distribution/export.csv")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> CommissionDistributionCsv(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? producerId,
        [FromQuery] Guid? carrierId,
        [FromQuery] string? level,
        CancellationToken cancellationToken = default)
    {
        var report = await _mediator.Send(
            new GetCommissionDistributionQuery(from, to, producerId, carrierId, level),
            cancellationToken);
        var el = CultureInfo.GetCultureInfo("el-GR");
        var sb = new StringBuilder();
        sb.AppendLine($"Καταμερισμός προμηθειών;{report.From:yyyy-MM-dd};έως;{report.To:yyyy-MM-dd}");
        sb.AppendLine("Συνεργάτης;Επίπεδο;Συμβόλαια;Μικτή;Παρακράτηση;Καθαρή");
        foreach (var r in report.Rows)
            sb.AppendLine(string.Join(';',
                Csv(r.ProducerName), Csv(r.Level),
                r.PolicyCount.ToString(el),
                r.Gross.ToString("F2", el),
                r.TaxWithholding.ToString("F2", el),
                r.Net.ToString("F2", el)));
        var t = report.Totals;
        sb.AppendLine(string.Join(';',
            "ΣΥΝΟΛΟ", "",
            t.PolicyCount.ToString(el),
            t.Gross.ToString("F2", el),
            t.TaxWithholding.ToString("F2", el),
            t.Net.ToString("F2", el)));
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8",
            $"katamerismos-{report.From:yyyyMMdd}-{report.To:yyyyMMdd}.csv");
    }

    // ==== Ετήσια Οικονομικά ===================================================
    [HttpGet("financials")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<FinancialReportDto>> Financials(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(new GetFinancialReportQuery(from, to), cancellationToken));

    [HttpGet("financials/export.csv")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> FinancialsCsv(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var report = await _mediator.Send(new GetFinancialReportQuery(from, to), cancellationToken);
        var el = CultureInfo.GetCultureInfo("el-GR");
        var sb = new StringBuilder();
        sb.AppendLine($"Οικονομικά;{report.From:yyyy-MM-dd};έως;{report.To:yyyy-MM-dd}");
        sb.AppendLine("Μήνας;Εισπράξεις;Πληρωμές εταιρειών;Πληρωμές συνεργατών;Προμήθειες γραφείου;Καθαρό ταμείο");
        foreach (var m in report.Months)
            sb.AppendLine(string.Join(';',
                m.Month,
                m.ReceiptsIn.ToString("F2", el),
                m.PaymentsToCarriers.ToString("F2", el),
                m.PaymentsToProducers.ToString("F2", el),
                m.CommissionsEarned.ToString("F2", el),
                m.NetCash.ToString("F2", el)));
        var t = report.Totals;
        sb.AppendLine(string.Join(';',
            "ΣΥΝΟΛΟ",
            t.ReceiptsIn.ToString("F2", el),
            t.PaymentsToCarriers.ToString("F2", el),
            t.PaymentsToProducers.ToString("F2", el),
            t.CommissionsEarned.ToString("F2", el),
            t.NetCash.ToString("F2", el)));
        sb.AppendLine();
        sb.AppendLine($"Ανοικτές απαιτήσεις πελατών;{report.OpenCustomerReceivables.ToString("F2", el)}");
        sb.AppendLine($"Ανοικτές υποχρεώσεις σε εταιρείες;{report.OpenCarrierPayables.ToString("F2", el)}");
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8",
            $"oikonomika-{report.From:yyyyMMdd}-{report.To:yyyyMMdd}.csv");
    }

    // ==== Εκκαθαριστικό Συνεργάτη =============================================
    [HttpGet("producer-statement/{producerId:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ProducerStatementDto>> ProducerStatement(
        Guid producerId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
        => Ok(await _mediator.Send(new GetProducerStatementQuery(producerId, from, to), cancellationToken));

    [HttpGet("producer-statement/{producerId:guid}/export.csv")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> ProducerStatementCsv(
        Guid producerId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken = default)
    {
        var report = await _mediator.Send(new GetProducerStatementQuery(producerId, from, to), cancellationToken);
        var el = CultureInfo.GetCultureInfo("el-GR");
        var sb = new StringBuilder();
        sb.AppendLine($"Εκκαθαριστικό συνεργάτη;{Csv(report.ProducerName)};{report.From:yyyy-MM-dd};έως;{report.To:yyyy-MM-dd}");
        sb.AppendLine("Συμβόλαιο;Πελάτης;Εταιρεία;Έναρξη;Ασφάλιστρο;Επίπεδο;Ποσοστό;Μικτή;Παρακράτηση;Καθαρή");
        foreach (var l in report.Lines)
            sb.AppendLine(string.Join(';',
                Csv(l.PolicyNumber), Csv(l.CustomerName), Csv(l.CarrierName),
                l.StartDate.ToString("yyyy-MM-dd"),
                l.Premium.ToString("F2", el),
                Csv(l.Level),
                l.Percent.ToString("F2", el),
                l.Gross.ToString("F2", el),
                l.TaxWithholding.ToString("F2", el),
                l.Net.ToString("F2", el)));
        sb.AppendLine();
        sb.AppendLine($"Μικτή προμήθεια;{report.GrossTotal.ToString("F2", el)}");
        sb.AppendLine($"Παρακράτηση φόρου;{report.TaxWithholdingTotal.ToString("F2", el)}");
        sb.AppendLine($"Καθαρή προμήθεια;{report.NetTotal.ToString("F2", el)}");
        sb.AppendLine($"Πληρωθέν στο διάστημα;{report.AmountPaid.ToString("F2", el)}");
        sb.AppendLine($"Υπόλοιπο (οφείλονται);{report.AmountOutstanding.ToString("F2", el)}");
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8",
            $"ekkatharistiko-{report.ProducerName}-{report.From:yyyyMMdd}-{report.To:yyyyMMdd}.csv");
    }
}
