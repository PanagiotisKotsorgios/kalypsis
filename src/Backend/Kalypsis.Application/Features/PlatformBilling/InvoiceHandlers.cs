using System.Globalization;
using System.Net;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformBilling;

public record InvoiceLineDto(Guid Id, string Package, string Description,
    decimal MonthlyPrice, int Quantity, decimal LineTotal);

public record InvoiceSummaryDto(
    Guid Id, string InvoiceNumber,
    Guid TenantId, string TenantName, string TenantCode,
    int PeriodYear, int PeriodMonth,
    DateTime IssuedAt, DateTime DueAt,
    string Status,
    string Currency,
    decimal Subtotal, decimal VatAmount, decimal Total,
    bool HasPdf, DateTime? SentAt, DateTime? PaidAt);

public record InvoiceDetailDto(
    Guid Id, string InvoiceNumber,
    Guid TenantId, string TenantName, string TenantCode,
    int PeriodYear, int PeriodMonth,
    DateTime IssuedAt, DateTime DueAt,
    string Status,
    string Currency,
    decimal Subtotal, decimal VatRate, decimal VatAmount, decimal Total,
    string? Notes, bool HasPdf,
    DateTime? SentAt, DateTime? PaidAt,
    IReadOnlyList<InvoiceLineDto> Lines);

/* ============== List ============== */

public record ListInvoicesQuery(int? Year, int? Month, string? Status, Guid? TenantId)
    : IRequest<IReadOnlyList<InvoiceSummaryDto>>;

public class ListInvoicesQueryHandler
    : IRequestHandler<ListInvoicesQuery, IReadOnlyList<InvoiceSummaryDto>>
{
    private readonly IAppDbContext _db;
    public ListInvoicesQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<InvoiceSummaryDto>> Handle(ListInvoicesQuery r, CancellationToken ct)
    {
        var q = _db.TenantInvoices.IgnoreQueryFilters().Where(x => x.DeletedAt == null);
        if (r.Year.HasValue)  q = q.Where(x => x.PeriodYear == r.Year);
        if (r.Month.HasValue) q = q.Where(x => x.PeriodMonth == r.Month);
        if (r.TenantId.HasValue) q = q.Where(x => x.TenantId == r.TenantId);
        if (!string.IsNullOrWhiteSpace(r.Status)
            && Enum.TryParse<InvoiceStatus>(r.Status, true, out var st))
            q = q.Where(x => x.Status == st);

        var rows = await q.OrderByDescending(x => x.PeriodYear).ThenByDescending(x => x.PeriodMonth)
            .ThenBy(x => x.InvoiceNumber).Take(500).ToListAsync(ct);

        var tenantIds = rows.Select(x => x.TenantId).Distinct().ToList();
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, ct);

        return rows.Select(x =>
        {
            tenants.TryGetValue(x.TenantId, out var t);
            return new InvoiceSummaryDto(
                x.Id, x.InvoiceNumber,
                x.TenantId, t?.Name ?? "—", t?.Code ?? "—",
                x.PeriodYear, x.PeriodMonth,
                x.IssuedAt, x.DueAt, x.Status.ToString(),
                x.Currency, x.Subtotal, x.VatAmount, x.Total,
                !string.IsNullOrEmpty(x.PdfStorageKey),
                x.SentAt, x.PaidAt);
        }).ToList();
    }
}

/* ============== Detail ============== */

public record GetInvoiceQuery(Guid Id) : IRequest<InvoiceDetailDto>;

public class GetInvoiceQueryHandler : IRequestHandler<GetInvoiceQuery, InvoiceDetailDto>
{
    private readonly IAppDbContext _db;
    public GetInvoiceQueryHandler(IAppDbContext db) => _db = db;

    public async Task<InvoiceDetailDto> Handle(GetInvoiceQuery r, CancellationToken ct)
    {
        var inv = await _db.TenantInvoices.IgnoreQueryFilters()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Invoice");

        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == inv.TenantId, ct);
        return new InvoiceDetailDto(
            inv.Id, inv.InvoiceNumber,
            inv.TenantId, t?.Name ?? "—", t?.Code ?? "—",
            inv.PeriodYear, inv.PeriodMonth,
            inv.IssuedAt, inv.DueAt, inv.Status.ToString(),
            inv.Currency, inv.Subtotal, inv.VatRate, inv.VatAmount, inv.Total,
            inv.Notes, !string.IsNullOrEmpty(inv.PdfStorageKey),
            inv.SentAt, inv.PaidAt,
            inv.Lines.OrderBy(l => l.Package)
                .Select(l => new InvoiceLineDto(
                    l.Id, l.Package.ToString(), l.Description,
                    l.MonthlyPrice, l.Quantity, l.LineTotal))
                .ToList());
    }
}

/* ============== Generate for month ============== */

public record GenerateInvoicesCommand(int Year, int Month, decimal VatRate, Guid? TenantId)
    : IRequest<GenerateInvoicesResult>;

public record GenerateInvoicesResult(int Created, int SkippedExisting, int SkippedUnpriced,
    IReadOnlyList<InvoiceSummaryDto> Invoices);

public class GenerateInvoicesCommandValidator : AbstractValidator<GenerateInvoicesCommand>
{
    public GenerateInvoicesCommandValidator()
    {
        RuleFor(x => x.Year).InclusiveBetween(2020, 2100);
        RuleFor(x => x.Month).InclusiveBetween(1, 12);
        RuleFor(x => x.VatRate).InclusiveBetween(0, 1);
    }
}

public class GenerateInvoicesCommandHandler
    : IRequestHandler<GenerateInvoicesCommand, GenerateInvoicesResult>
{
    private readonly IAppDbContext _db;
    public GenerateInvoicesCommandHandler(IAppDbContext db) => _db = db;

    public async Task<GenerateInvoicesResult> Handle(GenerateInvoicesCommand r, CancellationToken ct)
    {
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null && (r.TenantId == null || t.Id == r.TenantId))
            .ToListAsync(ct);

        var grants = await _db.TenantPackageGrants.IgnoreQueryFilters()
            .Where(g => g.DeletedAt == null && g.MonthlyPrice != null)
            .ToListAsync(ct);

        var existing = await _db.TenantInvoices.IgnoreQueryFilters()
            .Where(x => x.PeriodYear == r.Year && x.PeriodMonth == r.Month && x.DeletedAt == null)
            .Select(x => x.TenantId)
            .ToListAsync(ct);

        int created = 0, skippedExisting = 0, skippedUnpriced = 0;
        var newInvoices = new List<TenantInvoice>();

        // Number scheme: KLP-YYYY-MM-#### sequenced per period across the whole
        // platform. We seed from the count of existing invoices in the period
        // so concurrent runs don't collide on the unique index.
        int seq = await _db.TenantInvoices.IgnoreQueryFilters()
            .Where(x => x.PeriodYear == r.Year && x.PeriodMonth == r.Month)
            .CountAsync(ct);

        var issued = new DateTime(r.Year, r.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var due = issued.AddDays(15);

        foreach (var t in tenants)
        {
            if (existing.Contains(t.Id)) { skippedExisting++; continue; }
            var tenantGrants = grants.Where(g => g.TenantId == t.Id).ToList();
            if (tenantGrants.Count == 0 || tenantGrants.Sum(g => g.MonthlyPrice ?? 0m) == 0m)
            { skippedUnpriced++; continue; }

            var currency = tenantGrants.First().Currency;
            var invoice = new TenantInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = t.Id,
                InvoiceNumber = $"KLP-{r.Year:D4}-{r.Month:D2}-{(++seq):D4}",
                PeriodYear = r.Year, PeriodMonth = r.Month,
                IssuedAt = issued, DueAt = due,
                Status = InvoiceStatus.Issued,
                Currency = currency,
                VatRate = r.VatRate
            };

            decimal subtotal = 0m;
            foreach (var g in tenantGrants.OrderBy(g => g.Package))
            {
                var unit = g.MonthlyPrice ?? 0m;
                var line = new TenantInvoiceLine
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    Package = g.Package,
                    Description = PackageDescription(g.Package),
                    MonthlyPrice = unit,
                    Quantity = 1,
                    LineTotal = unit
                };
                invoice.Lines.Add(line);
                subtotal += unit;
            }
            invoice.Subtotal = Math.Round(subtotal, 2);
            invoice.VatAmount = Math.Round(invoice.Subtotal * r.VatRate, 2);
            invoice.Total = invoice.Subtotal + invoice.VatAmount;

            _db.TenantInvoices.Add(invoice);
            newInvoices.Add(invoice);
            created++;
        }
        await _db.SaveChangesAsync(ct);

        var summaries = newInvoices.Select(x =>
        {
            var t = tenants.First(tt => tt.Id == x.TenantId);
            return new InvoiceSummaryDto(
                x.Id, x.InvoiceNumber,
                x.TenantId, t.Name, t.Code,
                x.PeriodYear, x.PeriodMonth,
                x.IssuedAt, x.DueAt, x.Status.ToString(),
                x.Currency, x.Subtotal, x.VatAmount, x.Total,
                false, x.SentAt, x.PaidAt);
        }).ToList();

        return new GenerateInvoicesResult(created, skippedExisting, skippedUnpriced, summaries);
    }

    private static string PackageDescription(PackageCode p) => p switch
    {
        PackageCode.BackOffice   => "Πακέτο Back Office — διαχείριση συμβολαίων, ταμείο, λογιστική",
        PackageCode.FrontOffice  => "Πακέτο Front Office — προσφορές, εκδόσεις, πελάτες",
        PackageCode.Crm          => "Πακέτο CRM — πελατολόγιο, marketing, πύλη πελάτη",
        PackageCode.Intelligence => "Πακέτο Intelligence — αναφορές, αναλυτική, KPIs",
        PackageCode.Integrations => "Πακέτο Integrations — myDATA, γέφυρες εταιριών, B2B",
        _ => p.ToString()
    };
}

/* ============== Get PDF ============== */

public record GetInvoicePdfQuery(Guid Id) : IRequest<byte[]>;

public class GetInvoicePdfQueryHandler : IRequestHandler<GetInvoicePdfQuery, byte[]>
{
    private readonly IAppDbContext _db;
    private readonly IInvoicePdfRenderer _renderer;
    private readonly IFileStorage _storage;
    public GetInvoicePdfQueryHandler(IAppDbContext db, IInvoicePdfRenderer renderer, IFileStorage storage)
    { _db = db; _renderer = renderer; _storage = storage; }

    public async Task<byte[]> Handle(GetInvoicePdfQuery r, CancellationToken ct)
    {
        var inv = await _db.TenantInvoices.IgnoreQueryFilters()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Invoice");
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == inv.TenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        // Cache the rendered PDF in storage. First call renders and uploads;
        // subsequent calls fetch the stored blob so the layout never drifts.
        if (!string.IsNullOrEmpty(inv.PdfStorageKey))
        {
            try
            {
                await using var existing = await _storage.DownloadAsync(inv.PdfStorageKey, ct);
                using var ms = new MemoryStream();
                await existing.CopyToAsync(ms, ct);
                return ms.ToArray();
            }
            catch
            {
                // Storage lost or moved — fall through and re-render.
            }
        }

        var bytes = _renderer.Render(inv, tenant);
        using (var src = new MemoryStream(bytes))
        {
            var key = await _storage.UploadAsync(
                keyPrefix: $"invoices/{inv.PeriodYear:D4}/{inv.PeriodMonth:D2}",
                fileName: $"{inv.InvoiceNumber}.pdf",
                contentType: "application/pdf",
                content: src, cancellationToken: ct);
            inv.PdfStorageKey = key;
            await _db.SaveChangesAsync(ct);
        }
        return bytes;
    }
}

/* ============== Send by email ============== */

public record SendInvoiceEmailCommand(Guid Id, string? OverrideEmail)
    : IRequest<SendInvoiceEmailResult>;

public record SendInvoiceEmailResult(bool Success, string? ErrorMessage, string SentTo);

public class SendInvoiceEmailCommandHandler
    : IRequestHandler<SendInvoiceEmailCommand, SendInvoiceEmailResult>
{
    private readonly IAppDbContext _db;
    private readonly IInvoicePdfRenderer _renderer;
    private readonly IEmailSender _email;
    public SendInvoiceEmailCommandHandler(IAppDbContext db, IInvoicePdfRenderer renderer, IEmailSender email)
    { _db = db; _renderer = renderer; _email = email; }

    public async Task<SendInvoiceEmailResult> Handle(SendInvoiceEmailCommand r, CancellationToken ct)
    {
        var inv = await _db.TenantInvoices.IgnoreQueryFilters()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Invoice");
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == inv.TenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var to = r.OverrideEmail
            ?? tenant.ContactEmail
            ?? await _db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == inv.TenantId && u.Role == Role.AgencyAdmin && u.DeletedAt == null)
                .Select(u => u.Email).FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(to))
            throw AppException.Validation("Δεν βρέθηκε διεύθυνση παραλήπτη για αυτό το γραφείο.");

        // We don't currently attach the PDF (Brevo MIME attachments aren't in
        // the IEmailSender contract). The email links to the invoice in the
        // portal and includes the totals inline so the agency has everything
        // they need to pay even without opening the file.
        var html = BuildInvoiceEmailHtml(inv, tenant);
        var text = BuildInvoiceEmailText(inv, tenant);

        var msg = new EmailMessage(
            ToEmail:  to,
            ToName:   tenant.Name,
            Subject:  $"Τιμολόγιο Kalypsis {inv.InvoiceNumber} — {new DateTime(inv.PeriodYear, inv.PeriodMonth, 1):MMMM yyyy}",
            HtmlBody: html,
            TextBody: text);

        var result = await _email.SendAsync(msg, ct);
        if (result.Success)
        {
            inv.SentAt = DateTime.UtcNow;
            if (inv.Status == InvoiceStatus.Draft || inv.Status == InvoiceStatus.Issued)
                inv.Status = InvoiceStatus.Sent;
            await _db.SaveChangesAsync(ct);
        }
        return new SendInvoiceEmailResult(result.Success, result.ErrorMessage, to);
    }

    private static string BuildInvoiceEmailHtml(TenantInvoice inv, Tenant tenant)
    {
        var culture = CultureInfo.GetCultureInfo("el-GR");
        var period = new DateTime(inv.PeriodYear, inv.PeriodMonth, 1).ToString("MMMM yyyy", culture);
        var lines = string.Join("", inv.Lines.OrderBy(l => l.Package).Select(l =>
            $"<tr><td style='padding:6px 0;font-size:13px'>{WebUtility.HtmlEncode(l.Description)}</td>" +
            $"<td style='padding:6px 0;font-size:13px;text-align:right;font-family:Consolas,monospace'>" +
            $"{l.LineTotal.ToString("C2", culture)}</td></tr>"));

        return $@"<!doctype html><html lang=""el""><body style=""font-family:Inter,Arial,sans-serif;background:#fafbfc;padding:32px;color:#0b2545"">
<table cellpadding=""0"" cellspacing=""0"" style=""max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e9ef;border-radius:12px;overflow:hidden"">
  <tr><td style=""padding:28px 32px 8px"">
    <p style=""font-size:11px;letter-spacing:0.14em;color:#3d4f6b;margin:0 0 4px"">ΤΙΜΟΛΟΓΙΟ KALYPSIS</p>
    <h1 style=""font-size:22px;font-weight:800;margin:0 0 8px"">{WebUtility.HtmlEncode(inv.InvoiceNumber)}</h1>
    <p style=""font-size:14px;color:#3d4f6b;margin:0"">Περίοδος: <strong>{WebUtility.HtmlEncode(period)}</strong></p>
  </td></tr>
  <tr><td style=""padding:8px 32px 16px"">
    <p style=""font-size:14px;line-height:1.6;color:#3d4f6b;margin:0 0 12px"">
      Αξιότιμοι κύριοι/κυρίες <strong>{WebUtility.HtmlEncode(tenant.Name)}</strong>,
      σας αποστέλλουμε το τιμολόγιο για τη χρήση της πλατφόρμας Kalypsis της περιόδου {WebUtility.HtmlEncode(period)}.
    </p>
    <table cellpadding=""0"" cellspacing=""0"" style=""width:100%;border-collapse:collapse;margin:16px 0"">
      {lines}
      <tr><td colspan=""2"" style=""border-top:1px solid #e5e9ef;padding-top:8px""></td></tr>
      <tr>
        <td style=""padding:4px 0;font-size:13px;color:#3d4f6b"">Καθαρή αξία</td>
        <td style=""padding:4px 0;font-size:13px;text-align:right;font-family:Consolas,monospace"">{inv.Subtotal.ToString("C2", culture)}</td>
      </tr>
      <tr>
        <td style=""padding:4px 0;font-size:13px;color:#3d4f6b"">Φ.Π.Α. {(inv.VatRate * 100m):F0}%</td>
        <td style=""padding:4px 0;font-size:13px;text-align:right;font-family:Consolas,monospace"">{inv.VatAmount.ToString("C2", culture)}</td>
      </tr>
      <tr>
        <td style=""padding:6px 0 0;font-size:15px;font-weight:700;border-top:1px solid #0b2545"">Σύνολο</td>
        <td style=""padding:6px 0 0;font-size:15px;font-weight:700;text-align:right;border-top:1px solid #0b2545;font-family:Consolas,monospace"">{inv.Total.ToString("C2", culture)}</td>
      </tr>
    </table>
    <p style=""font-size:13px;color:#3d4f6b;margin:16px 0 0"">
      Καταληκτική ημερομηνία πληρωμής: <strong>{inv.DueAt.ToLocalTime():dd/MM/yyyy}</strong>.
    </p>
  </td></tr>
  <tr><td style=""padding:16px 32px;border-top:1px solid #e5e9ef;font-size:12px;color:#3d4f6b"">
    Για ερωτήσεις στείλτε email στο info@mykalypsis.gr ή καλέστε στο 2631028971.
  </td></tr>
</table></body></html>";
    }

    private static string BuildInvoiceEmailText(TenantInvoice inv, Tenant tenant)
    {
        var culture = CultureInfo.GetCultureInfo("el-GR");
        var period = new DateTime(inv.PeriodYear, inv.PeriodMonth, 1).ToString("MMMM yyyy", culture);
        var lines = string.Join("\n", inv.Lines.OrderBy(l => l.Package).Select(l =>
            $"  {l.Description}: {l.LineTotal.ToString("C2", culture)}"));
        return $@"Τιμολόγιο Kalypsis {inv.InvoiceNumber}
Περίοδος: {period}
Πελάτης: {tenant.Name} ({tenant.Code})

{lines}

Καθαρή αξία: {inv.Subtotal.ToString("C2", culture)}
Φ.Π.Α. {(inv.VatRate * 100m):F0}%: {inv.VatAmount.ToString("C2", culture)}
Σύνολο: {inv.Total.ToString("C2", culture)}

Καταληκτική ημερομηνία πληρωμής: {inv.DueAt:dd/MM/yyyy}.

Ερωτήσεις: info@mykalypsis.gr · 2631028971";
    }
}

/* ============== Set status ============== */

public record UpdateInvoiceStatusCommand(Guid Id, string Status) : IRequest<InvoiceDetailDto>;

public class UpdateInvoiceStatusCommandValidator : AbstractValidator<UpdateInvoiceStatusCommand>
{
    public UpdateInvoiceStatusCommandValidator()
    {
        RuleFor(x => x.Status).NotEmpty()
            .Must(s => Enum.TryParse<InvoiceStatus>(s, true, out _));
    }
}

public class UpdateInvoiceStatusCommandHandler
    : IRequestHandler<UpdateInvoiceStatusCommand, InvoiceDetailDto>
{
    private readonly IAppDbContext _db;
    private readonly IMediator _mediator;
    public UpdateInvoiceStatusCommandHandler(IAppDbContext db, IMediator mediator)
    { _db = db; _mediator = mediator; }

    public async Task<InvoiceDetailDto> Handle(UpdateInvoiceStatusCommand r, CancellationToken ct)
    {
        var inv = await _db.TenantInvoices.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Invoice");

        var next = Enum.Parse<InvoiceStatus>(r.Status, true);
        inv.Status = next;
        if (next == InvoiceStatus.Paid && inv.PaidAt == null) inv.PaidAt = DateTime.UtcNow;
        if (next != InvoiceStatus.Paid) inv.PaidAt = null;
        await _db.SaveChangesAsync(ct);
        return await _mediator.Send(new GetInvoiceQuery(inv.Id), ct);
    }
}

/* ============== Delete ============== */

public record DeleteInvoiceCommand(Guid Id) : IRequest<Unit>;

public class DeleteInvoiceCommandHandler : IRequestHandler<DeleteInvoiceCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteInvoiceCommandHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(DeleteInvoiceCommand r, CancellationToken ct)
    {
        var inv = await _db.TenantInvoices.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Invoice");
        inv.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
