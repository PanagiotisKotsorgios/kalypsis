using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Common.Exports;
using Kalypsis.Application.Features.Appointments;
using Kalypsis.Application.Features.Branches;
using Kalypsis.Application.Features.Claims;
using Kalypsis.Application.Features.CommissionRules;
using Kalypsis.Application.Features.CoverNotes;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.EmailTemplates;
using Kalypsis.Application.Features.Financials;
using Kalypsis.Application.Features.Notifications;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Application.Features.ProductionLists;
using Kalypsis.Application.Features.Tariffs;
using Kalypsis.Application.Features.Tasks;
using Kalypsis.Domain.Enums;
using MediatR;

namespace Kalypsis.Application.Features.Exports;

// Universal export endpoint. /api/exports/{entity}?format=xlsx&search=...
// Delegates row loading to existing list handlers, then formats with ExportFormatter.
// To add a new entity, add a case to Dispatch() + a Build*Async method below.

public record UniversalExportQuery(
    string Entity,
    string Format,
    string? Search) : IRequest<ExportResult>;

public class UniversalExportHandler : IRequestHandler<UniversalExportQuery, ExportResult>
{
    private readonly IMediator _mediator;
    private readonly ICurrentUser _current;

    public UniversalExportHandler(IMediator mediator, ICurrentUser current)
    {
        _mediator = mediator;
        _current = current;
    }

    public async Task<ExportResult> Handle(UniversalExportQuery q, CancellationToken ct)
    {
        var entityKey = (q.Entity ?? "").Trim().ToLowerInvariant();
        var sheet = await Dispatch(entityKey, q.Search, ct);
        var ts = DateTime.UtcNow.ToString("yyyyMMdd-HHmm");
        var name = $"{entityKey}-{ts}";
        var fmt = (q.Format ?? "xlsx").Trim().ToLowerInvariant();

        return fmt switch
        {
            "csv"  => new ExportResult(ExportFormatter.BuildCsv(sheet), "text/csv; charset=utf-8", $"{name}.csv"),
            "xlsx" => new ExportResult(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx"),
            "pdf"  => new ExportResult(ExportFormatter.BuildPdf(sheet), "application/pdf", $"{name}.pdf"),
            _ => throw new AppException("export_bad_format", $"Άγνωστος τύπος εξαγωγής: {q.Format}", 400)
        };
    }

    private async Task<Sheet> Dispatch(string entity, string? search, CancellationToken ct) => entity switch
    {
        "customers"            => await BuildCustomersAsync(search, ct),
        "policies"             => await BuildPoliciesAsync(search, ct),
        "claims"               => await BuildClaimsAsync(search, ct),
        "producers"            => await BuildProducersAsync(search, ct),
        "insurance-companies"  => await BuildInsuranceCompaniesAsync(search, ct),
        "commission-rules"     => await BuildCommissionRulesAsync(search, ct),
        "branches"             => await BuildBranchesAsync(search, ct),
        "tariffs"              => await BuildTariffsAsync(search, ct),
        "tasks"                => await BuildTasksAsync(search, ct),
        "receipts"             => await BuildReceiptsAsync(search, ct),
        "payments"             => await BuildPaymentsAsync(search, ct),
        "appointments"         => await BuildAppointmentsAsync(search, ct),
        "cover-notes"          => await BuildCoverNotesAsync(search, ct),
        "email-templates"      => await BuildEmailTemplatesAsync(search, ct),
        "notifications"        => await BuildNotificationsAsync(search, ct),
        _ => throw new AppException("export_unknown_entity", $"Δεν υπάρχει εξαγωγή για: {entity}", 400)
    };

    private static bool Match(string? haystack, string needle) =>
        !string.IsNullOrEmpty(haystack) && haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);

    // ---------------- Customers ----------------
    private async Task<Sheet> BuildCustomersAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListCustomersQuery(search), ct);
        return new Sheet(
            "Πελάτες",
            new[] { "Α/Α", "Τύπος", "Όνομα/Επωνυμία", "ΑΦΜ", "Email", "Τηλέφωνο", "Πόλη", "Δημ.", "Πύλη" },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.CustomerNumber,
                c.Type.ToString(),
                c.Type == CustomerType.Company
                    ? (c.CompanyName ?? "")
                    : $"{c.FirstName} {c.LastName}".Trim(),
                c.VatNumber ?? "",
                c.Email ?? "",
                c.Phone ?? "",
                c.City ?? "",
                ExportFormatter.FormatDate(c.CreatedAt),
                ExportFormatter.FormatBool(c.HasPortalAccount)
            }).ToList());
    }

    // ---------------- Policies ----------------
    private async Task<Sheet> BuildPoliciesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListPoliciesQuery(search, null, null, null), ct);
        return new Sheet(
            "Συμβόλαια",
            new[] { "Αρ.Συμβ.", "Πελάτης", "Εταιρία", "Συνεργάτης", "Κλάδος", "Κατάσταση", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Νόμισμα", "Δημιουργία" },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.PolicyNumber,
                p.CustomerDisplay,
                p.InsuranceCompanyName,
                p.ProducerName ?? "",
                p.PolicyType.ToString(),
                p.Status.ToString(),
                ExportFormatter.FormatDate(p.StartDate),
                ExportFormatter.FormatDate(p.EndDate),
                ExportFormatter.FormatDecimal(p.Premium),
                p.Currency,
                ExportFormatter.FormatDate(p.CreatedAt)
            }).ToList());
    }

    // ---------------- Claims ----------------
    private async Task<Sheet> BuildClaimsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListClaimsQuery(null, null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(c => Match(c.ClaimNumber, s) || Match(c.PolicyNumber, s) || Match(c.CustomerDisplay, s)).ToList();
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
                ExportFormatter.FormatDate(c.IncidentDate),
                ExportFormatter.FormatDate(c.ReportedDate),
                ExportFormatter.FormatDecimal(c.ClaimedAmount),
                ExportFormatter.FormatDecimal(c.ApprovedAmount)
            }).ToList());
    }

    // ---------------- Producers ----------------
    private async Task<Sheet> BuildProducersAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListProducersQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(p => Match(p.Code, s) || Match(p.Name, s) || Match(p.Email, s) || Match(p.Phone, s)).ToList();
        }
        return new Sheet(
            "Συνεργάτες",
            new[] { "Κωδικός", "Όνομα", "Email", "Τηλέφωνο", "Κατάσταση", "Κατηγορία", "Συμβόλαια", "Δημ." },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.Code, p.Name, p.Email ?? "", p.Phone ?? "",
                p.Status.ToString(),
                p.Tier.ToString(),
                p.PolicyCount.ToString(CultureInfo.InvariantCulture),
                ExportFormatter.FormatDate(p.CreatedAt)
            }).ToList());
    }

    // ---------------- Insurance Companies ----------------
    private async Task<Sheet> BuildInsuranceCompaniesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListInsuranceCompaniesQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(c => Match(c.Name, s) || Match(c.Code, s) || Match(c.Country, s)).ToList();
        }
        return new Sheet(
            "Ασφαλιστικές Εταιρίες",
            new[] { "Κωδικός", "Επωνυμία", "Χώρα", "Ενεργή" },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.Code,
                c.Name,
                c.Country ?? "",
                ExportFormatter.FormatBool(c.IsActive)
            }).ToList());
    }

    // ---------------- Commission Rules ----------------
    private async Task<Sheet> BuildCommissionRulesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListCommissionRulesQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(r =>
                Match(r.ProducerName, s) ||
                Match(r.InsuranceCompanyName, s) ||
                Match(r.CoverCode, s) ||
                Match(r.PolicyType?.ToString(), s) ||
                Match(r.ProducerTier?.ToString(), s)).ToList();
        }
        return new Sheet(
            "Κανόνες Προμηθειών",
            new[] { "Συνεργάτης", "Κατηγορία", "Εταιρία", "Κλάδος", "Κάλυψη", "Χρήση Οχήμ.", "% Έδρα", "% Συνεργάτη", "Ισχύς από", "Έως" },
            rows.Select(r => (IReadOnlyList<string>)new[]
            {
                r.ProducerName ?? "—",
                r.ProducerTier?.ToString() ?? "—",
                r.InsuranceCompanyName ?? "—",
                r.PolicyType?.ToString() ?? "—",
                r.CoverCode ?? "—",
                r.VehicleUseCategory?.ToString() ?? "—",
                ExportFormatter.FormatDecimal(r.AgencyPercent ?? r.LegacyValue ?? 0m),
                ExportFormatter.FormatDecimal(r.ProducerPercent),
                ExportFormatter.FormatDate(r.EffectiveFrom),
                ExportFormatter.FormatDate(r.EffectiveTo)
            }).ToList());
    }

    // ---------------- Branches ----------------
    private async Task<Sheet> BuildBranchesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListBranchesQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(b => Match(b.Code, s) || Match(b.Name, s) || Match(b.Description, s)).ToList();
        }
        return new Sheet(
            "Κλάδοι",
            new[] { "Κωδικός", "Όνομα", "Περιγραφή", "Ενεργός" },
            rows.Select(b => (IReadOnlyList<string>)new[]
            {
                b.Code,
                b.Name,
                b.Description ?? "",
                ExportFormatter.FormatBool(b.IsActive)
            }).ToList());
    }

    // ---------------- Tariffs ----------------
    private async Task<Sheet> BuildTariffsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListTariffsQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(t => Match(t.Name, s) || Match(t.InsuranceCompanyName, s) || Match(t.PolicyType.ToString(), s)).ToList();
        }
        return new Sheet(
            "Τιμολόγια",
            new[] { "Όνομα", "Κλάδος", "Εταιρία", "Βασικό Ασφάλ.", "Νόμισμα", "% Προμήθειας", "Σημειώσεις", "Ενεργό", "Ισχύς από", "Έως" },
            rows.Select(t => (IReadOnlyList<string>)new[]
            {
                t.Name,
                t.PolicyType.ToString(),
                t.InsuranceCompanyName ?? "",
                ExportFormatter.FormatDecimal(t.BasePremium),
                t.Currency,
                ExportFormatter.FormatDecimal(t.CommissionPercent),
                t.Notes ?? "",
                ExportFormatter.FormatBool(t.IsActive),
                ExportFormatter.FormatDate(t.EffectiveFrom),
                ExportFormatter.FormatDate(t.EffectiveTo)
            }).ToList());
    }

    // ---------------- Tasks ----------------
    private async Task<Sheet> BuildTasksAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListTasksQuery(null, null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(t => Match(t.Title, s) || Match(t.Description, s) || Match(t.AssignedToUserName, s) || Match(t.CustomerDisplay, s)).ToList();
        }
        return new Sheet(
            "Εργασίες",
            new[] { "Τίτλος", "Κατάσταση", "Προτεραιότητα", "Ανατέθηκε σε", "Πελάτης", "Συμβόλαιο", "Λήξη" },
            rows.Select(t => (IReadOnlyList<string>)new[]
            {
                t.Title,
                t.Status.ToString(),
                t.Priority.ToString(),
                t.AssignedToUserName ?? "",
                t.CustomerDisplay ?? "",
                t.PolicyNumber ?? "",
                ExportFormatter.FormatDateTime(t.DueAt)
            }).ToList());
    }

    // ---------------- Receipts ----------------
    private async Task<Sheet> BuildReceiptsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListReceiptsQuery(null, null, null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(r => Match(r.Number, s) || Match(r.CustomerName, s) || Match(r.PolicyNumber, s)).ToList();
        }
        return new Sheet(
            "Εισπράξεις",
            new[] { "Αρ.Απόδ.", "Ημ/νία", "Πελάτης", "Συμβόλαιο", "Μέθοδος", "Ποσό", "Νόμισμα", "Σημειώσεις" },
            rows.Select(r => (IReadOnlyList<string>)new[]
            {
                r.Number,
                ExportFormatter.FormatDate(r.ReceivedOn),
                r.CustomerName,
                r.PolicyNumber ?? "",
                r.Method.ToString(),
                ExportFormatter.FormatDecimal(r.Amount),
                r.Currency,
                r.Notes ?? ""
            }).ToList());
    }

    // ---------------- Payments ----------------
    private async Task<Sheet> BuildPaymentsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListPaymentsQuery(null, null, null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(p => Match(p.Number, s) || Match(p.BeneficiaryName, s) || Match(p.BeneficiaryInsuranceCompanyName, s) || Match(p.BeneficiaryProducerName, s)).ToList();
        }
        return new Sheet(
            "Πληρωμές",
            new[] { "Αρ.Πληρ.", "Ημ/νία", "Τύπος Δικαιούχου", "Δικαιούχος", "Μέθοδος", "Ποσό", "Νόμισμα", "Συμψ.Προμ.", "Σημειώσεις" },
            rows.Select(p => (IReadOnlyList<string>)new[]
            {
                p.Number,
                ExportFormatter.FormatDate(p.PaidOn),
                p.BeneficiaryType.ToString(),
                p.BeneficiaryName ?? p.BeneficiaryInsuranceCompanyName ?? p.BeneficiaryProducerName ?? "",
                p.Method.ToString(),
                ExportFormatter.FormatDecimal(p.Amount),
                p.Currency,
                ExportFormatter.FormatDecimal(p.CommissionsNetted),
                p.Notes ?? ""
            }).ToList());
    }

    // ---------------- Appointments ----------------
    private async Task<Sheet> BuildAppointmentsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListAppointmentsQuery(null, null, null, null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(a => Match(a.Title, s) || Match(a.Location, s) || Match(a.CustomerName, s)).ToList();
        }
        return new Sheet(
            "Ραντεβού",
            new[] { "Τίτλος", "Κατάσταση", "Έναρξη", "Λήξη", "Πελάτης", "Τοποθεσία", "Περιγραφή" },
            rows.Select(a => (IReadOnlyList<string>)new[]
            {
                a.Title,
                a.Status.ToString(),
                ExportFormatter.FormatDateTime(a.StartsAt),
                ExportFormatter.FormatDateTime(a.EndsAt),
                a.CustomerName ?? "",
                a.Location ?? "",
                a.Description ?? ""
            }).ToList());
    }

    // ---------------- Cover Notes ----------------
    private async Task<Sheet> BuildCoverNotesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListCoverNotesQuery(null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(c => Match(c.Number, s) || Match(c.CustomerName, s) || Match(c.InsuranceCompanyName, s)).ToList();
        }
        return new Sheet(
            "Cover Notes",
            new[] { "Αριθμός", "Πελάτης", "Εταιρία", "Κλάδος", "Κατάσταση", "Από", "Έως" },
            rows.Select(c => (IReadOnlyList<string>)new[]
            {
                c.Number,
                c.CustomerName,
                c.InsuranceCompanyName ?? "",
                c.PolicyType.ToString(),
                c.Status.ToString(),
                ExportFormatter.FormatDate(c.ValidFrom),
                ExportFormatter.FormatDate(c.ValidUntil)
            }).ToList());
    }

    // ---------------- Email Templates ----------------
    private async Task<Sheet> BuildEmailTemplatesAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListEmailTemplatesQuery(), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(e => Match(e.Name, s) || Match(e.Code, s) || Match(e.Subject, s)).ToList();
        }
        return new Sheet(
            "Πρότυπα Email",
            new[] { "Κωδικός", "Όνομα", "Θέμα", "Ενεργό" },
            rows.Select(e => (IReadOnlyList<string>)new[]
            {
                e.Code,
                e.Name,
                e.Subject,
                ExportFormatter.FormatBool(e.IsActive)
            }).ToList());
    }

    // ---------------- Notifications ----------------
    private async Task<Sheet> BuildNotificationsAsync(string? search, CancellationToken ct)
    {
        var rows = await _mediator.Send(new ListMyNotificationsQuery(null), ct);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            rows = rows.Where(n => Match(n.Title, s) || Match(n.Body, s) || Match(n.Category, s)).ToList();
        }
        return new Sheet(
            "Ειδοποιήσεις",
            new[] { "Ημ/νία", "Κατηγορία", "Τίτλος", "Κείμενο", "Αναγνωσμένη" },
            rows.Select(n => (IReadOnlyList<string>)new[]
            {
                ExportFormatter.FormatDateTime(n.CreatedAt),
                n.Category ?? "",
                n.Title,
                n.Body,
                ExportFormatter.FormatBool(n.IsRead)
            }).ToList());
    }
}
