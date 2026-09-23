using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Common.Exports;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

/// <summary>
/// A producer-owned export: completed commission-run rows plus the current
/// per-policy forecast calculated from the office's commission matrices.
/// The producer can download their own figures, but cannot alter or compare
/// the office configuration that produced them.
/// </summary>
public record ExportProducerSelfCommissionsQuery(int? Year, string Format) : IRequest<ExportResult>;

public class ExportProducerSelfCommissionsQueryHandler
    : IRequestHandler<ExportProducerSelfCommissionsQuery, ExportResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IMediator _mediator;

    public ExportProducerSelfCommissionsQueryHandler(IAppDbContext db, ICurrentUser current, IMediator mediator)
    {
        _db = db;
        _current = current;
        _mediator = mediator;
    }

    public async Task<ExportResult> Handle(ExportProducerSelfCommissionsQuery request, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var producerId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId)
            .Select(u => u.ProducerId)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Συνεργάτης");

        var settledRows = await _mediator.Send(new GetProducerSelfCommissionsQuery(request.Year), ct);
        var forecastRows = await _db.PolicyCommissionSplits
            .Where(s => s.ProducerId == producerId && s.Policy.Status == PolicyStatus.Active)
            .Select(s => new
            {
                s.Policy.PolicyNumber,
                CustomerDisplay = s.Policy.Customer.Type == CustomerType.Company
                    ? s.Policy.Customer.CompanyName
                    : (s.Policy.Customer.FirstName + " " + s.Policy.Customer.LastName).Trim(),
                CarrierName = s.Policy.InsuranceCompany.Name,
                s.Policy.PolicyType,
                s.Policy.Premium,
                s.Percent,
                s.GrossAmount,
                s.NetAmount
            })
            .OrderBy(x => x.PolicyNumber)
            .ToListAsync(ct);

        var rows = new List<IReadOnlyList<string>>();
        rows.AddRange(settledRows.Select(x => (IReadOnlyList<string>)new[]
        {
            "Εκκαθάριση",
            $"{x.Year}-{x.Month:00}",
            x.PolicyNumber,
            "",
            x.InsuranceCompanyName,
            x.PolicyType.ToString(),
            x.RunStatus.ToString(),
            ExportFormatter.FormatDecimal(x.Premium),
            ExportFormatter.FormatDecimal(x.RatePercent) + "%",
            ExportFormatter.FormatDecimal(x.CommissionAmount),
            "",
        }));
        rows.AddRange(forecastRows.Select(x => (IReadOnlyList<string>)new[]
        {
            "Εκτίμηση επόμενης προμήθειας",
            "Επόμενη εκκαθάριση",
            x.PolicyNumber,
            x.CustomerDisplay ?? "",
            x.CarrierName,
            x.PolicyType.ToString(),
            "Ενεργό",
            ExportFormatter.FormatDecimal(x.Premium),
            ExportFormatter.FormatDecimal(x.Percent) + "%",
            ExportFormatter.FormatDecimal(x.GrossAmount),
            ExportFormatter.FormatDecimal(x.NetAmount),
        }));

        var sheet = new Sheet(
            "Οι προμήθειές μου",
            new[]
            {
                "Τύπος", "Περίοδος", "Συμβόλαιο", "Πελάτης", "Ασφαλιστική", "Κλάδος", "Κατάσταση",
                "Ασφάλιστρο", "Ποσοστό", "Μικτή προμήθεια", "Καθαρή προμήθεια"
            },
            rows,
            request.Year.HasValue ? $"Έτος {request.Year}" : "Όλες οι διαθέσιμες εκκαθαρίσεις");

        var format = (request.Format ?? "xlsx").Trim().ToLowerInvariant();
        var suffix = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");
        return format switch
        {
            "csv" => new ExportResult(ExportFormatter.BuildCsv(sheet), "text/csv; charset=utf-8", $"producer-commissions-{suffix}.csv"),
            "xlsx" => new ExportResult(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"producer-commissions-{suffix}.xlsx"),
            _ => throw new AppException("export_bad_format", "Επιλέξτε μορφή CSV ή XLSX.", 400)
        };
    }
}
