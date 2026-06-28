using System.Globalization;
using Kalypsis.Application.Common.Exports;
using Kalypsis.Application.Features.Claims;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Domain.Enums;
using MediatR;

namespace Kalypsis.Application.Features.ParagogiExports;

// ============================================================================
// Server-side CSV / XLSX / PDF exports for every ΠΑΡΑΓΩΓΗ sidebar item:
// Customers, Policies, Claims, Producers.
// Delegates row loading to each entity's existing list handler so filter logic
// stays in ONE place; we just format and stream.
// ============================================================================

public enum ParagogiEntity { Customers, Policies, Claims, Producers }

public record ExportParagogiQuery(
    ParagogiEntity Entity,
    string Format,                                 // "csv" | "xlsx" | "pdf"
    string? Search,
    PolicyStatus? PolicyStatus = null,
    PolicyType? PolicyType = null,
    ClaimStatus? ClaimStatus = null) : IRequest<ExportResult>;

public class ExportParagogiHandler : IRequestHandler<ExportParagogiQuery, ExportResult>
{
    private readonly IMediator _mediator;
    public ExportParagogiHandler(IMediator mediator) { _mediator = mediator; }

    public async Task<ExportResult> Handle(ExportParagogiQuery q, CancellationToken ct)
    {
        var ts = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");
        var fmt = q.Format.ToLowerInvariant();
        var entityKey = q.Entity.ToString().ToLowerInvariant();
        var name = $"{entityKey}-{ts}";

        var sheet = q.Entity switch
        {
            ParagogiEntity.Customers => await BuildCustomersAsync(q, ct),
            ParagogiEntity.Policies  => await BuildPoliciesAsync(q, ct),
            ParagogiEntity.Claims    => await BuildClaimsAsync(q, ct),
            ParagogiEntity.Producers => await BuildProducersAsync(q, ct),
            _ => throw new ArgumentOutOfRangeException()
        };

        return fmt switch
        {
            "csv"  => new ExportResult(ExportFormatter.BuildCsv(sheet), "text/csv", $"{name}.csv"),
            "xlsx" => new ExportResult(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx"),
            "pdf"  => new ExportResult(ExportFormatter.BuildPdf(sheet), "application/pdf", $"{name}.pdf"),
            _ => throw new ArgumentException("Unsupported format: " + q.Format)
        };
    }

    // ---- per-entity row builders ------------------------------------------------

    private async Task<Sheet> BuildCustomersAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListCustomersQuery(q.Search), ct);
        return new Sheet(
            "Πελάτες",
            new[] { "Α/Α", "Όνομα/Επωνυμία", "ΑΦΜ", "Email", "Τηλέφωνο", "Πόλη", "Δημ.", "Πύλη" },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.CustomerNumber,
                c.Type == CustomerType.Company
                    ? c.CompanyName ?? ""
                    : $"{c.FirstName} {c.LastName}".Trim(),
                c.VatNumber ?? "",
                c.Email ?? "",
                c.Phone ?? "",
                c.City ?? "",
                c.CreatedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                c.HasPortalAccount ? "Ναι" : "Όχι"
            }).ToList());
    }

    private async Task<Sheet> BuildPoliciesAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(
            new ListPoliciesQuery(q.Search, q.PolicyStatus, q.PolicyType, null), ct);
        return new Sheet(
            "Συμβόλαια",
            new[] { "Αρ.Συμβ.", "Πελάτης", "Εταιρία", "Συνεργάτης", "Κλάδος", "Κατάσταση", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Νόμισμα" },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.PolicyNumber,
                p.CustomerDisplay,
                p.InsuranceCompanyName,
                p.ProducerName ?? "",
                p.PolicyType.ToString(),
                p.Status.ToString(),
                p.StartDate.ToString("yyyy-MM-dd"),
                p.EndDate.ToString("yyyy-MM-dd"),
                p.Premium.ToString("F2", CultureInfo.InvariantCulture),
                p.Currency
            }).ToList());
    }

    private async Task<Sheet> BuildClaimsAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListClaimsQuery(q.ClaimStatus, null), ct);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            rows = rows.Where(c =>
                (c.ClaimNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (c.PolicyNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (c.CustomerDisplay?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)).ToList();
        }
        return new Sheet(
            "Ζημίες",
            new[] { "Αρ.Ζημίας", "Συμβόλαιο", "Πελάτης", "Εταιρία", "Κλάδος", "Κατάσταση", "Συμβάν", "Αναγγελία", "Διεκδικ.", "Εγκρ." },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.ClaimNumber,
                c.PolicyNumber,
                c.CustomerDisplay,
                c.InsuranceCompanyName,
                c.PolicyType.ToString(),
                c.Status.ToString(),
                c.IncidentDate.ToString("yyyy-MM-dd"),
                c.ReportedDate.ToString("yyyy-MM-dd"),
                c.ClaimedAmount?.ToString("F2", CultureInfo.InvariantCulture) ?? "",
                c.ApprovedAmount?.ToString("F2", CultureInfo.InvariantCulture) ?? ""
            }).ToList());
    }

    private async Task<Sheet> BuildProducersAsync(ExportParagogiQuery q, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListProducersQuery(), ct);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            rows = rows.Where(p =>
                p.Code.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                p.Name.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                (p.Email?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                (p.Phone?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false))
                .ToList();
        }
        return new Sheet(
            "Συνεργάτες",
            new[] { "Κωδικός", "Όνομα", "Email", "Τηλέφωνο", "Κατάσταση", "Συμβόλαια", "Δημ." },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.Code, p.Name, p.Email ?? "", p.Phone ?? "",
                p.Status.ToString(),
                p.PolicyCount.ToString(CultureInfo.InvariantCulture),
                p.CreatedAt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            }).ToList());
    }

}
