using System.Security.Cryptography;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common.Exports;
using Kalypsis.Application.Common.Forms;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Optional electronic GDPR form workflow. Public links contain only a
/// one-time random token; the database stores a SHA-256 hash of that token.
/// </summary>
[ApiController]
public sealed class CustomerFormSigningController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly IEmailSender _email;
    private readonly IConfiguration _configuration;

    public CustomerFormSigningController(AppDbContext db, ICurrentUser current, IFileStorage storage, IEmailSender email, IConfiguration configuration)
    { _db = db; _current = current; _storage = storage; _email = email; _configuration = configuration; }

    public sealed record SettingsDto(bool Enabled, bool RequireOfficeSignature, bool RequireInsurerSignature, bool SendInsurerEmail, int LinkExpirationDays, string TemplateCode);
    public sealed record UpdateSettingsBody(bool Enabled, bool RequireOfficeSignature, bool RequireInsurerSignature, bool SendInsurerEmail, int LinkExpirationDays, string? TemplateCode);
    public sealed record FormTemplateFieldDto(string Key, string Label, string Description);
    public sealed record FormTemplateDto(string FormCode, string Code, string Name, string Kind,
        string? HeaderHtml, string? BodyHtml, string? FooterHtml, bool IsCustomized,
        IReadOnlyList<FormTemplateFieldDto> Fields);
    public sealed record UpdateFormTemplateBody(string? Name, string? HeaderHtml, string? BodyHtml, string? FooterHtml, bool ResetToDefault = false);
    public sealed record CreateFormBody(Guid? PolicyId, bool? RequireOfficeSignature, bool? RequireInsurerSignature, bool? SendInsurerEmail, string? Notes, string? FormCode = null, Dictionary<string, string?>? Fields = null);
    public sealed record PreviewFormBody(
        Guid? PolicyId,
        string? FormCode = null,
        Dictionary<string, string?>? Fields = null,
        string? HeaderHtml = null,
        string? BodyHtml = null,
        string? FooterHtml = null);
    public sealed record SigningDto(Guid Id, Guid CustomerId, Guid? PolicyId, string FormCode, string Status, bool? CustomerConsented, string CustomerName, string? CustomerEmail, string? OfficeEmail, string? InsurerEmail, DateTime CreatedAt, DateTime ExpiresAt, DateTime? CustomerSignedAt, DateTime? OfficeSignedAt, DateTime? InsurerSignedAt, DateTime? CompletedAt, string? FinalDocumentPath, bool HasFinalDocument);
    public sealed record FormHistoryDto(Guid Id, Guid CustomerId, Guid? PolicyId, string FormCode, string Status, bool? CustomerConsented, string CustomerName, string? CustomerEmail, DateTime CreatedAt, DateTime ExpiresAt, DateTime? CustomerSignedAt, DateTime? OfficeSignedAt, DateTime? InsurerSignedAt, DateTime? CompletedAt, bool HasDraftDocument, bool HasFinalDocument, string FileName);
    public sealed record PublicFormDto(string AgencyName, string? AgencyLogoUrl, string CustomerName, string? CustomerEmail, string Role, string FormTitle, string ExpiresAt, bool CanSign, string? PolicyNumber, string FormCode = "gdpr-consent");
    public sealed record SignBody(bool Consented, string SignerName, string SignatureDataUrl);

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-settings")]
    public async Task<ActionResult<SettingsDto>> GetSettings(CancellationToken ct)
    {
        var tenantId = TenantId();
        var row = await _db.TenantGdprSigningSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        return Ok(ToSettings(row ?? new TenantGdprSigningSettings { TenantId = tenantId }));
    }

    /// <summary>Office-scoped legal form templates and their mail-merge fields.</summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-templates")]
    public async Task<ActionResult<IReadOnlyList<FormTemplateDto>>> GetFormTemplates(CancellationToken ct)
    {
        var tenantId = TenantId();
        var result = new List<FormTemplateDto>();
        foreach (var formCode in SupportedFormCodes())
        {
            var template = await EnsureFormTemplateAsync(tenantId, formCode, ct);
            result.Add(ToFormTemplateDto(formCode, template));
        }
        await _db.SaveChangesAsync(ct);
        return Ok(result);
    }

    /// <summary>Save the template used by future previews and signature requests.</summary>
    [Authorize(Policy = "AgencyAdmin")]
    [HttpPut("api/customer-form-templates/{formCode}")]
    public async Task<ActionResult<FormTemplateDto>> UpdateFormTemplate(string formCode, [FromBody] UpdateFormTemplateBody body, CancellationToken ct)
    {
        var normalized = NormalizeFormCode(formCode);
        if (normalized is null) return BadRequest("Μη υποστηριζόμενο έντυπο.");
        var tenantId = TenantId();
        var template = await EnsureFormTemplateAsync(tenantId, normalized, ct);
        template.Name = string.IsNullOrWhiteSpace(body.Name) ? template.Name : body.Name.Trim()[..Math.Min(200, body.Name.Trim().Length)];
        if (body.ResetToDefault)
        {
            var definition = TemplateFor(normalized);
            template.HeaderHtml = null;
            template.BodyHtml = definition.BodyHtml;
            template.FooterHtml = null;
        }
        else
        {
            template.HeaderHtml = SanitizeTemplateHtml(body.HeaderHtml);
            template.BodyHtml = SanitizeTemplateHtml(body.BodyHtml);
            template.FooterHtml = SanitizeTemplateHtml(body.FooterHtml);
        }
        template.IsActive = true;
        template.IsDefault = true;
        await _db.SaveChangesAsync(ct);
        return Ok(ToFormTemplateDto(normalized, template));
    }

    [Authorize(Policy = "AgencyAdmin")]
    [HttpPut("api/customer-form-settings")]
    public async Task<ActionResult<SettingsDto>> PutSettings([FromBody] UpdateSettingsBody body, CancellationToken ct)
    {
        var tenantId = TenantId();
        if (body.LinkExpirationDays is < 1 or > 90) return BadRequest("Η διάρκεια του συνδέσμου πρέπει να είναι από 1 έως 90 ημέρες.");
        var row = await _db.TenantGdprSigningSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (row is null) { row = new TenantGdprSigningSettings { TenantId = tenantId }; _db.TenantGdprSigningSettings.Add(row); }
        row.Enabled = body.Enabled;
        row.RequireOfficeSignature = body.RequireOfficeSignature;
        row.RequireInsurerSignature = body.RequireInsurerSignature;
        row.SendInsurerEmail = body.SendInsurerEmail;
        row.LinkExpirationDays = body.LinkExpirationDays;
        row.TemplateCode = string.IsNullOrWhiteSpace(body.TemplateCode) ? "gdpr-consent-cover-v1" : body.TemplateCode.Trim()[..Math.Min(80, body.TemplateCode.Trim().Length)];
        await _db.SaveChangesAsync(ct);
        return Ok(ToSettings(row));
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customers/{customerId:guid}/form-signings")]
    public async Task<ActionResult<IReadOnlyList<SigningDto>>> List(Guid customerId, CancellationToken ct)
    {
        var tenantId = TenantId();
        var rows = await _db.CustomerFormSignings
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new SigningDto(x.Id, x.CustomerId, x.PolicyId, x.FormCode, x.Status.ToString(), x.CustomerConsented, x.CustomerFullNameSnapshot, x.CustomerEmailSnapshot, x.OfficeEmailSnapshot, x.InsurerEmailSnapshot, x.CreatedAt, x.ExpiresAt, x.CustomerSignedAt, x.OfficeSignedAt, x.InsurerSignedAt, x.CompletedAt, x.FinalDocumentPath, x.FinalDocumentPath != null))
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>Office-wide history of every legal form and signing attempt.</summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-signings")]
    public async Task<ActionResult<IReadOnlyList<FormHistoryDto>>> History(
        [FromQuery] string? search,
        [FromQuery] string? formCode,
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var query = ApplyHistoryFilters(_db.CustomerFormSignings.AsNoTracking().Where(x => x.TenantId == TenantId()), search, formCode, status, from, to);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(5000).ToListAsync(ct);
        return Ok(rows.Select(ToHistoryDto).ToList());
    }

    /// <summary>
    /// Render either supported form without creating a signing record or
    /// sending email.  Preview remains available even when the optional
    /// electronic-signature workflow is disabled in office settings.
    /// </summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpPost("api/customers/{customerId:guid}/form-preview")]
    public async Task<IActionResult> Preview(Guid customerId, [FromBody] PreviewFormBody body, CancellationToken ct)
    {
        var tenantId = TenantId();
        var formCode = NormalizeFormCode(body.FormCode);
        if (formCode is null) return BadRequest("Μη υποστηριζόμενο έντυπο.");

        var customer = await _db.Customers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == customerId, ct);
        if (customer is null) return NotFound("Ο πελάτης δεν βρέθηκε.");

        Policy? policy = null;
        if (body.PolicyId.HasValue)
        {
            policy = await _db.Policies.AsNoTracking().Include(x => x.InsuranceCompany)
                .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == body.PolicyId.Value && x.CustomerId == customerId, ct);
            if (policy is null) return BadRequest("Το συμβόλαιο δεν ανήκει στον συγκεκριμένο πελάτη.");
        }

        var office = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(x => x.Id == tenantId, ct);
        var collaboratingInsurers = await GetCollaboratingInsurersAsync(tenantId, ct);
        var template = await EnsureFormTemplateAsync(tenantId, formCode, ct);
        // The template editor needs a true PDF preview before the draft is
        // saved. Use an in-memory copy for the posted draft so previewing
        // never changes the office template in the database.
        if (body.HeaderHtml is not null || body.BodyHtml is not null || body.FooterHtml is not null)
        {
            template = new DocumentTemplate
            {
                TenantId = tenantId,
                Code = template.Code,
                Name = template.Name,
                Kind = template.Kind,
                PageSize = template.PageSize,
                Orientation = template.Orientation,
                HeaderHtml = SanitizeTemplateHtml(body.HeaderHtml),
                BodyHtml = SanitizeTemplateHtml(body.BodyHtml),
                FooterHtml = SanitizeTemplateHtml(body.FooterHtml),
                IsDefault = template.IsDefault,
                IsActive = template.IsActive
            };
        }
        var data = BuildFormData(customer, office, policy, body.Fields, collaboratingInsurers);
        AddTemplateSnapshot(data, formCode, template);
        var draft = new CustomerFormSigning
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            PolicyId = policy?.Id,
            FormCode = formCode,
            FormVersion = FormVersionFor(formCode, "gdpr-consent-cover-v1"),
            Status = CustomerFormSigningStatus.Draft,
            CustomerFullNameSnapshot = DisplayName(customer),
            CustomerEmailSnapshot = customer.Email,
            InsurerEmailSnapshot = policy?.InsuranceCompany?.ContactEmail,
            FormDataJson = data.Count == 0 ? null : JsonSerializer.Serialize(data),
            FileName = FileNameFor(formCode, preview: true),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow
        };

        var pdf = await RenderDocumentAsync(draft, office, ct);
        return File(pdf, "application/pdf", draft.FileName);
    }

    /// <summary>
    /// Render a template without requiring a customer record. This keeps the
    /// office editor usable even before the first customer is created; merge
    /// fields are intentionally empty in the printable PDF.
    /// </summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpPost("api/customer-form-templates/{formCode}/preview")]
    public async Task<IActionResult> PreviewTemplate(string formCode, [FromBody] PreviewFormBody body, CancellationToken ct)
    {
        var normalized = NormalizeFormCode(formCode);
        if (normalized is null) return BadRequest("Μη υποστηριζόμενο έντυπο.");

        var tenantId = TenantId();
        var customer = new Customer
        {
            TenantId = tenantId,
            CustomerNumber = string.Empty,
            Type = CustomerType.Individual,
            Status = CustomerStatus.Active
        };
        var office = await _db.Tenants.IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(x => x.Id == tenantId, ct);
        var collaboratingInsurers = await GetCollaboratingInsurersAsync(tenantId, ct);
        var template = await EnsureFormTemplateAsync(tenantId, normalized, ct);
        if (body.HeaderHtml is not null || body.BodyHtml is not null || body.FooterHtml is not null)
        {
            template = new DocumentTemplate
            {
                TenantId = tenantId,
                Code = template.Code,
                Name = template.Name,
                Kind = template.Kind,
                PageSize = template.PageSize,
                Orientation = template.Orientation,
                HeaderHtml = SanitizeTemplateHtml(body.HeaderHtml),
                BodyHtml = SanitizeTemplateHtml(body.BodyHtml),
                FooterHtml = SanitizeTemplateHtml(body.FooterHtml),
                IsDefault = template.IsDefault,
                IsActive = template.IsActive
            };
        }
        var data = BuildFormData(customer, office, null, body.Fields, collaboratingInsurers);
        AddTemplateSnapshot(data, normalized, template);
        var draft = new CustomerFormSigning
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = Guid.Empty,
            FormCode = normalized,
            FormVersion = FormVersionFor(normalized, "gdpr-consent-cover-v1"),
            Status = CustomerFormSigningStatus.Draft,
            CustomerFullNameSnapshot = string.Empty,
            CustomerEmailSnapshot = null,
            FormDataJson = data.Count == 0 ? null : JsonSerializer.Serialize(data),
            FileName = FileNameFor(normalized, preview: true),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow
        };

        var pdf = await RenderDocumentAsync(draft, office, ct);
        return File(pdf, "application/pdf", draft.FileName);
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpPost("api/customers/{customerId:guid}/form-signings")]
    public async Task<ActionResult<SigningDto>> Create(Guid customerId, [FromBody] CreateFormBody body, CancellationToken ct)
    {
        var tenantId = TenantId();
        var settings = await _db.TenantGdprSigningSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (settings is null || !settings.Enabled)
            return BadRequest("Η ηλεκτρονική υπογραφή του εντύπου είναι απενεργοποιημένη στις ρυθμίσεις του γραφείου.");

        var customer = await _db.Customers.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == customerId, ct);
        if (customer is null) return NotFound("Ο πελάτης δεν βρέθηκε.");
        if (string.IsNullOrWhiteSpace(customer.Email)) return BadRequest("Ο πελάτης δεν έχει email στην καρτέλα του.");

        var formCode = NormalizeFormCode(body.FormCode);
        if (formCode is null) return BadRequest("Μη υποστηριζόμενο έντυπο.");

        Policy? policy = null;
        if (body.PolicyId.HasValue)
        {
            policy = await _db.Policies.Include(x => x.InsuranceCompany).FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == body.PolicyId.Value && x.CustomerId == customerId, ct);
            if (policy is null) return BadRequest("Το συμβόλαιο δεν ανήκει στον συγκεκριμένο πελάτη.");
        }
        var requireOffice = body.RequireOfficeSignature ?? settings.RequireOfficeSignature;
        var requireInsurer = body.RequireInsurerSignature ?? settings.RequireInsurerSignature;
        var sendInsurer = body.SendInsurerEmail ?? settings.SendInsurerEmail;
        var office = await _db.Tenants.IgnoreQueryFilters().FirstAsync(x => x.Id == tenantId, ct);
        var insurerEmail = policy?.InsuranceCompany?.ContactEmail;
        if (requireOffice && string.IsNullOrWhiteSpace(office.ContactEmail)) return BadRequest("Συμπληρώστε email γραφείου στις ρυθμίσεις πριν ζητήσετε υπογραφή γραφείου.");
        if ((requireInsurer || sendInsurer) && string.IsNullOrWhiteSpace(insurerEmail)) return BadRequest("Η ασφαλιστική του συμβολαίου δεν έχει email επικοινωνίας.");

        // Install the reusable template the first time the office uses the
        // workflow. It is visible in the existing Document Templates module
        // and gives future versions a stable code/version to migrate from.
        var template = TemplateFor(formCode);
        var templateCode = template.Code;
        if (!await _db.DocumentTemplates.AnyAsync(x => x.TenantId == tenantId && x.Code == templateCode, ct))
        {
            _db.DocumentTemplates.Add(new DocumentTemplate
            {
                TenantId = tenantId,
                Code = templateCode,
                Name = template.Name,
                Kind = template.Kind,
                PageSize = "A4",
                Orientation = "Portrait",
                IsDefault = true,
                IsActive = true,
                BodyHtml = template.BodyHtml
            });
        }

        // Keep the reusable template catalogue in sync with the renderer. The
        // PDF renderer is authoritative for layout, while BodyHtml gives the
        // office a readable prompt in the existing template-management page.
        var now = DateTime.UtcNow;
        var collaboratingInsurersForSigning = await GetCollaboratingInsurersAsync(tenantId, ct);
        var storedTemplate = await EnsureFormTemplateAsync(tenantId, formCode, ct);
        var formData = BuildFormData(customer, office, policy, body.Fields, collaboratingInsurersForSigning);
        AddTemplateSnapshot(formData, formCode, storedTemplate);
        var signing = new CustomerFormSigning
        {
            TenantId = tenantId, CustomerId = customerId, PolicyId = policy?.Id,
            FormCode = formCode, FormVersion = FormVersionFor(formCode, settings.TemplateCode),
            Status = CustomerFormSigningStatus.PendingCustomer,
            RequireOfficeSignature = requireOffice,
            RequireInsurerSignature = requireInsurer,
            SendInsurerEmail = sendInsurer,
            CustomerFullNameSnapshot = DisplayName(customer), CustomerEmailSnapshot = customer.Email,
            OfficeEmailSnapshot = requireOffice ? office.ContactEmail : null,
            InsurerEmailSnapshot = (requireInsurer || sendInsurer) ? insurerEmail : null,
            ExpiresAt = now.AddDays(settings.LinkExpirationDays), CreatedByUserId = _current.UserId,
            Notes = body.Notes,
            FormDataJson = formData.Count == 0 ? null : JsonSerializer.Serialize(formData),
            FileName = FileNameFor(formCode, preview: false)
        };
        _db.CustomerFormSignings.Add(signing);
        await _db.SaveChangesAsync(ct);
        var token = NewToken();
        var link = NewLink(signing, CustomerFormSigningRecipientRole.Customer, token, customer.Email!, signing.CustomerFullNameSnapshot, signing.ExpiresAt);
        _db.CustomerFormSigningLinks.Add(link);
        await _db.SaveChangesAsync(ct);
        var draft = await RenderDocumentAsync(signing, office, ct);
        signing.DraftDocumentPath = await SaveBytesAsync($"form-signing/{tenantId}/{signing.Id:N}", $"{formCode}-draft.pdf", "application/pdf", draft, ct);
        link.SentAt = now;
        await _db.SaveChangesAsync(ct);
        var sent = await SendLinkAsync(signing, link, token, "customer", ct);
        if (!sent.Success) return StatusCode(502, sent.ErrorMessage ?? "Δεν ήταν δυνατή η αποστολή email.");
        // Optional insurer notification: send the same customer link so the
        // customer can sign from the insurer's phone/tablet. It is not an
        // insurer signature request unless RequireInsurerSignature is on.
        if (sendInsurer && !requireInsurer && !string.IsNullOrWhiteSpace(insurerEmail))
            _ = await SendFormLinkToAddressAsync(signing, insurerEmail!, policy?.InsuranceCompany?.Name ?? "Ασφαλιστική εταιρεία", token, ct);
        return Ok(ToDto(signing));
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpPost("api/customer-form-signings/{id:guid}/resend")]
    public async Task<ActionResult> Resend(Guid id, CancellationToken ct)
    {
        var tenantId = TenantId();
        var signing = await _db.CustomerFormSignings.Include(x => x.Links).FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == id, ct);
        if (signing is null) return NotFound();
        var link = signing.Links.Where(x => x.RecipientRole == CustomerFormSigningRecipientRole.Customer).OrderByDescending(x => x.CreatedAt).FirstOrDefault();
        if (link is null || link.UsedAt.HasValue) return BadRequest("Δεν υπάρχει ενεργός σύνδεσμος πελάτη.");
        var settings = await _db.TenantGdprSigningSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        var token = NewToken();
        link.TokenHash = HashToken(token);
        link.ExpiresAt = DateTime.UtcNow.AddDays(settings?.LinkExpirationDays is > 0 ? settings.LinkExpirationDays : 30);
        link.SentAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        var result = await SendLinkAsync(signing, link, token, "customer", ct);
        return result.Success ? Ok(new { sent = true }) : StatusCode(502, result.ErrorMessage);
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-signings/export")]
    public async Task<IActionResult> Export([FromQuery] string? search, [FromQuery] string? formCode, [FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string format = "xlsx", CancellationToken ct = default)
    {
        var tenantId = TenantId();
        var query = ApplyHistoryFilters(_db.CustomerFormSignings.AsNoTracking().Where(x => x.TenantId == tenantId), search, formCode, status, from, to);
        var rows = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var sheet = new Sheet("Νομικά έντυπα πελατών", new[] { "Id", "Έντυπο", "Πελάτης", "Email", "Κατάσταση", "Συναίνεση", "Δημιουργήθηκε", "Έληξε", "Υπογραφή πελάτη", "Υπογραφή γραφείου", "Υπογραφή ασφαλιστικής", "Ολοκληρώθηκε" }, rows.Select(x => (IReadOnlyList<string>)new[] { x.Id.ToString(), x.FormCode, x.CustomerFullNameSnapshot, x.CustomerEmailSnapshot ?? "", x.Status.ToString(), x.CustomerConsented?.ToString() ?? "", x.CreatedAt.ToString("yyyy-MM-dd HH:mm"), x.ExpiresAt.ToString("yyyy-MM-dd HH:mm"), x.CustomerSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.OfficeSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.InsurerSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.CompletedAt?.ToString("yyyy-MM-dd HH:mm") ?? "" }).ToList(), TenantLabel: tenantId.ToString());
        if (format.Equals("csv", StringComparison.OrdinalIgnoreCase)) return File(ExportFormatter.BuildCsv(sheet), "text/csv", "gdpr-forms.csv");
        return File(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "gdpr-forms.xlsx");
    }

    /// <summary>
    /// Download all filtered legal-form PDFs as one office folder archive.
    /// Final documents are preferred; pending forms use their immutable draft.
    /// </summary>
    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-signings/export-zip")]
    public async Task<IActionResult> ExportZip(
        [FromQuery] string? search,
        [FromQuery] string? formCode,
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? ids,
        CancellationToken ct)
    {
        var tenantId = TenantId();
        var query = ApplyHistoryFilters(_db.CustomerFormSignings.AsNoTracking().Where(x => x.TenantId == tenantId), search, formCode, status, from, to);
        var requestedIds = ParseIds(ids);
        if (requestedIds.Count > 0) query = query.Where(x => requestedIds.Contains(x.Id));
        var rows = await query.OrderByDescending(x => x.CreatedAt).Take(5000).ToListAsync(ct);

        await using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            var index = new StringBuilder("Έντυπο,Πελάτης,Κατάσταση,Ημερομηνία,Αρχείο\r\n");
            foreach (var row in rows)
            {
                var path = row.FinalDocumentPath ?? row.DraftDocumentPath;
                var bytes = await ReadBytesAsync(path, ct);
                if (bytes is null) continue;

                var fileName = $"{SafeArchivePart(row.CustomerFullNameSnapshot)}-{row.FormCode}-{row.CreatedAt:yyyyMMdd}-{row.Id:N}.pdf";
                var entry = archive.CreateEntry(fileName, CompressionLevel.Fastest);
                await using (var entryStream = entry.Open())
                    await entryStream.WriteAsync(bytes, ct);
                index.Append(CsvPart(row.FormCode)).Append(',')
                    .Append(CsvPart(row.CustomerFullNameSnapshot)).Append(',')
                    .Append(CsvPart(row.Status.ToString())).Append(',')
                    .Append(CsvPart(row.CreatedAt.ToString("yyyy-MM-dd HH:mm"))).Append(',')
                    .Append(CsvPart(fileName)).Append("\r\n");
            }

            var indexEntry = archive.CreateEntry("index.csv", CompressionLevel.Fastest);
            await using var indexStream = new StreamWriter(indexEntry.Open(), new UTF8Encoding(true));
            await indexStream.WriteAsync(index.ToString());
        }

        return File(output.ToArray(), "application/zip", $"νομικά-έντυπα-{DateTime.UtcNow:yyyyMMdd-HHmm}.zip");
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-signings/{id:guid}/document")]
    public async Task<IActionResult> Document(Guid id, [FromQuery] string variant = "auto", CancellationToken ct = default)
    {
        var row = await _db.CustomerFormSignings.FirstOrDefaultAsync(x => x.TenantId == TenantId() && x.Id == id, ct);
        if (row is null) return NotFound("Το έντυπο δεν βρέθηκε.");
        var path = variant.Equals("draft", StringComparison.OrdinalIgnoreCase)
            ? row.DraftDocumentPath
            : variant.Equals("final", StringComparison.OrdinalIgnoreCase)
                ? row.FinalDocumentPath
                : row.FinalDocumentPath ?? row.DraftDocumentPath;
        if (path is null) return NotFound("Δεν υπάρχει αποθηκευμένο PDF για αυτό το έντυπο.");
        var stream = await _storage.DownloadAsync(path, ct);
        return File(stream, "application/pdf", row.FileName);
    }

    [AllowAnonymous]
    [HttpGet("api/public/gdpr-signing/{token}")]
    public async Task<ActionResult<PublicFormDto>> Public(string token, CancellationToken ct)
    {
        var link = await FindLinkAsync(token, ct);
        if (link is null) return NotFound("Ο σύνδεσμος δεν είναι έγκυρος.");
        var s = link.Signing;
        if (s.ExpiresAt < DateTime.UtcNow || link.ExpiresAt < DateTime.UtcNow) return BadRequest("Ο σύνδεσμος έχει λήξει.");
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == s.TenantId, ct);
        var policy = s.PolicyId.HasValue ? await _db.Policies.IgnoreQueryFilters().Include(x => x.InsuranceCompany).FirstOrDefaultAsync(x => x.Id == s.PolicyId.Value, ct) : null;
        return Ok(new PublicFormDto(tenant?.Name ?? "Kalypsis", tenant?.LogoUrl, s.CustomerFullNameSnapshot, s.CustomerEmailSnapshot, link.RecipientRole.ToString(), FormTitle(s.FormCode), s.ExpiresAt.ToString("O"), !link.UsedAt.HasValue && s.Status is not (CustomerFormSigningStatus.Completed or CustomerFormSigningStatus.Declined), policy?.PolicyNumber, s.FormCode));
    }

    /// <summary>
    /// Returns the immutable mail-merged draft PDF behind the one-time link.
    /// The token is the authorization; no customer data is accepted from the
    /// browser and the draft is generated from the stored signing snapshot.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("api/public/gdpr-signing/{token}/document")]
    public async Task<IActionResult> PublicDocument(string token, CancellationToken ct)
    {
        var link = await FindLinkAsync(token, ct);
        if (link is null) return NotFound("Ο σύνδεσμος δεν είναι έγκυρος.");
        var signing = link.Signing;
        if (signing.ExpiresAt < DateTime.UtcNow || link.ExpiresAt < DateTime.UtcNow)
            return BadRequest("Ο σύνδεσμος έχει λήξει.");

        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == signing.TenantId, ct);
        if (tenant is null) return NotFound("Το γραφείο δεν βρέθηκε.");

        if (!string.IsNullOrWhiteSpace(signing.DraftDocumentPath))
        {
            try
            {
                var stream = await _storage.DownloadAsync(signing.DraftDocumentPath, ct);
                return File(stream, "application/pdf", signing.FileName);
            }
            catch
            {
                // Older records may not have a persisted draft; render it on demand.
            }
        }

        var pdf = await RenderDocumentAsync(signing, tenant, ct);
        return File(pdf, "application/pdf", signing.FileName);
    }

    [AllowAnonymous]
    [HttpPost("api/public/gdpr-signing/{token}/sign")]
    public async Task<ActionResult<PublicFormDto>> Sign(string token, [FromBody] SignBody body, CancellationToken ct)
    {
        var link = await FindLinkAsync(token, ct);
        if (link is null) return NotFound("Ο σύνδεσμος δεν είναι έγκυρος.");
        var signing = link.Signing;
        if (link.UsedAt.HasValue) return BadRequest("Ο σύνδεσμος έχει ήδη χρησιμοποιηθεί.");
        if (signing.ExpiresAt < DateTime.UtcNow || link.ExpiresAt < DateTime.UtcNow) return BadRequest("Ο σύνδεσμος έχει λήξει.");
        if (string.IsNullOrWhiteSpace(body.SignerName) || body.SignerName.Length > 240) return BadRequest("Το ονοματεπώνυμο υπογραφής είναι υποχρεωτικό.");
        var image = DecodeSignature(body.SignatureDataUrl);
        if (image is null) return BadRequest("Η χειρόγραφη υπογραφή δεν είναι έγκυρη.");
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstAsync(x => x.Id == signing.TenantId, ct);
        var now = DateTime.UtcNow;
        var roleName = link.RecipientRole.ToString().ToLowerInvariant();
        var path = await SaveBytesAsync($"form-signing/{signing.TenantId}/{signing.Id:N}", $"{roleName}-signature.png", "image/png", image, ct);
        link.UsedAt = now; link.IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(); link.UserAgent = Request.Headers.UserAgent.ToString();
        if (link.RecipientRole == CustomerFormSigningRecipientRole.Customer)
        {
            var accepted = signing.FormCode != "gdpr-consent" || body.Consented;
            signing.CustomerConsented = accepted; signing.CustomerSignaturePath = path; signing.CustomerSignedAt = now;
            signing.Status = accepted ? CustomerFormSigningStatus.PendingCustomer : CustomerFormSigningStatus.Declined;
            if (signing.FormCode == "gdpr-consent")
                _db.ConsentRecords.Add(new ConsentRecord { TenantId = signing.TenantId, CustomerId = signing.CustomerId, Type = ConsentType.PrivacyNotice, Granted = accepted, GrantedAt = now, Method = ConsentMethod.OnlineForm, IpAddress = link.IpAddress, Version = signing.FormVersion, Notes = accepted ? "Ηλεκτρονική υπογραφή εντύπου GDPR" : "Ο πελάτης δεν συναινεί" });
            if (!accepted) signing.CompletedAt = now;
        }
        else if (link.RecipientRole == CustomerFormSigningRecipientRole.Office) { signing.OfficeSignaturePath = path; signing.OfficeSignedAt = now; }
        else { signing.InsurerSignaturePath = path; signing.InsurerSignedAt = now; }
        await _db.SaveChangesAsync(ct);
        if (link.RecipientRole == CustomerFormSigningRecipientRole.Customer && (signing.FormCode != "gdpr-consent" || body.Consented))
            await IssueAdditionalLinksAsync(signing, tenant, ct);
        await CompleteIfReadyAsync(signing, tenant, ct);
        await _db.SaveChangesAsync(ct);
        return await Public(token, ct);
    }

    private async Task IssueAdditionalLinksAsync(CustomerFormSigning signing, Tenant tenant, CancellationToken ct)
    {
        var settings = await _db.TenantGdprSigningSettings.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == signing.TenantId, ct);
        if (settings is null) return;
        var existing = await _db.CustomerFormSigningLinks.IgnoreQueryFilters().Where(x => x.SigningId == signing.Id).ToListAsync(ct);
        var recipients = new List<(CustomerFormSigningRecipientRole Role, string? Email, string Name)>
        {
            (CustomerFormSigningRecipientRole.Office, signing.RequireOfficeSignature ? tenant.ContactEmail : null, tenant.Name)
        };
        var policy = signing.PolicyId.HasValue ? await _db.Policies.IgnoreQueryFilters().Include(x => x.InsuranceCompany).FirstOrDefaultAsync(x => x.Id == signing.PolicyId.Value, ct) : null;
        recipients.Add((CustomerFormSigningRecipientRole.Insurer, signing.RequireInsurerSignature ? policy?.InsuranceCompany?.ContactEmail : null, policy?.InsuranceCompany?.Name ?? "Ασφαλιστική εταιρεία"));
        foreach (var recipient in recipients)
        {
            if (string.IsNullOrWhiteSpace(recipient.Email) || existing.Any(x => x.RecipientRole == recipient.Role)) continue;
            var token = NewToken();
            var link = NewLink(signing, recipient.Role, token, recipient.Email!, recipient.Name, signing.ExpiresAt);
            _db.CustomerFormSigningLinks.Add(link);
            await _db.SaveChangesAsync(ct);
            link.SentAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await SendLinkAsync(signing, link, token, recipient.Role.ToString().ToLowerInvariant(), ct);
        }
        var officeRequired = signing.RequireOfficeSignature;
        var insurerRequired = signing.RequireInsurerSignature;
        signing.Status = officeRequired ? CustomerFormSigningStatus.PendingOffice : insurerRequired ? CustomerFormSigningStatus.PendingInsurer : CustomerFormSigningStatus.Completed;
    }

    private async Task CompleteIfReadyAsync(CustomerFormSigning signing, Tenant tenant, CancellationToken ct)
    {
        if (signing.Status == CustomerFormSigningStatus.Declined)
        {
            if (signing.FinalDocumentPath is null)
            {
                var declinedPdf = await RenderDocumentAsync(signing, tenant, ct);
                signing.FinalDocumentPath = await SaveBytesAsync($"form-signing/{signing.TenantId}/{signing.Id:N}", $"{signing.FormCode}-declined.pdf", "application/pdf", declinedPdf, ct);
            }
            return;
        }
        if (signing.CustomerSignedAt is null) return;
        if (signing.RequireOfficeSignature && signing.OfficeSignedAt is null) { signing.Status = CustomerFormSigningStatus.PendingOffice; return; }
        if (signing.RequireInsurerSignature && signing.InsurerSignedAt is null) { signing.Status = CustomerFormSigningStatus.PendingInsurer; return; }
        if (signing.FinalDocumentPath is not null) return;
        var pdf = await RenderDocumentAsync(signing, tenant, ct);
        signing.FinalDocumentPath = await SaveBytesAsync($"form-signing/{signing.TenantId}/{signing.Id:N}", $"{signing.FormCode}-signed.pdf", "application/pdf", pdf, ct);
        signing.Status = CustomerFormSigningStatus.Completed; signing.CompletedAt = DateTime.UtcNow;
    }

    private async Task<byte[]> RenderDocumentAsync(CustomerFormSigning signing, Tenant tenant, CancellationToken ct)
    {
        var logo = await ReadBytesAsync(tenant.LogoUrl, ct);
        var customerSignature = await ReadBytesAsync(signing.CustomerSignaturePath, ct);
        var officeSignature = await ReadBytesAsync(signing.OfficeSignaturePath, ct);
        var insurerSignature = await ReadBytesAsync(signing.InsurerSignaturePath, ct);
        if (HasCustomTemplate(signing.FormDataJson))
            return EditableFormPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature);
        return signing.FormCode switch
        {
            "customer-needs" => CustomerNeedsPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature),
            "intermediary-information" => IntermediaryInformationPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature),
            "document-receipt" => DocumentReceiptPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature),
            _ => GdprConsentPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature)
        };
    }

    private async Task<EmailResult> SendLinkAsync(CustomerFormSigning signing, CustomerFormSigningLink link, string token, string recipient, CancellationToken ct)
        => await SendFormLinkToAddressAsync(signing, link.Email, link.DisplayName, token, ct);

    private async Task<EmailResult> SendFormLinkToAddressAsync(CustomerFormSigning signing, string email, string displayName, string token, CancellationToken ct)
    {
        var origin = (_configuration["PUBLIC_ORIGIN"] ?? _configuration["PublicOrigin"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');
        var url = $"{origin}/sign/gdpr/{token}";
        var formTitle = FormTitle(signing.FormCode);
        var subject = $"{formTitle} για ηλεκτρονική υπογραφή";
        var body = $"<p>Καλησπέρα,</p><p>Παρακαλούμε ανοίξτε τον ασφαλή σύνδεσμο για να ελέγξετε και να υπογράψετε το <strong>{formTitle}</strong> του πελάτη <strong>{System.Net.WebUtility.HtmlEncode(signing.CustomerFullNameSnapshot)}</strong>.</p><p><a href=\"{url}\">Άνοιγμα εντύπου και υπογραφή</a></p><p>Ο σύνδεσμος λήγει στις {signing.ExpiresAt.ToLocalTime():dd/MM/yyyy HH:mm}.</p>";
        return await _email.SendAsync(new EmailMessage(email, displayName, subject, body, $"Άνοιγμα {formTitle}: {url}", AllowCustomerRecipient: true), ct);
    }

    private async Task<EmailResult> SendLinkToAddressAsync(CustomerFormSigning signing, string email, string displayName, string token, CancellationToken ct)
    {
        var origin = (_configuration["PUBLIC_ORIGIN"] ?? _configuration["PublicOrigin"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');
        var url = $"{origin}/sign/gdpr/{token}";
        var formTitle = FormTitle(signing.FormCode);
        var subject = $"{formTitle} για ηλεκτρονική υπογραφή";
        var body = $"<p>Καλησπέρα,</p><p>Παρακαλούμε ανοίξτε τον ασφαλή σύνδεσμο για να διαβάσετε και να υπογράψετε το <strong>{formTitle}</strong> του πελάτη <strong>{System.Net.WebUtility.HtmlEncode(signing.CustomerFullNameSnapshot)}</strong>.</p><p><a href=\"{url}\">Άνοιγμα εντύπου και υπογραφή</a></p><p>Ο σύνδεσμος λήγει στις {signing.ExpiresAt.ToLocalTime():dd/MM/yyyy HH:mm}.</p>";
        return await _email.SendAsync(new EmailMessage(email, displayName, subject, body, $"Άνοιγμα {formTitle}: {url}", AllowCustomerRecipient: true), ct);
    }

    private async Task<CustomerFormSigningLink?> FindLinkAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var hash = HashToken(token);
        return await _db.CustomerFormSigningLinks.IgnoreQueryFilters().Include(x => x.Signing).FirstOrDefaultAsync(x => x.TokenHash == hash && x.DeletedAt == null, ct);
    }

    private async Task<string> SaveBytesAsync(string prefix, string fileName, string contentType, byte[] bytes, CancellationToken ct)
        => await _storage.UploadAsync(prefix, fileName, contentType, new MemoryStream(bytes), ct);

    private async Task<byte[]?> ReadBytesAsync(string? path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try { await using var stream = await _storage.DownloadAsync(path, ct); using var ms = new MemoryStream(); await stream.CopyToAsync(ms, ct); return ms.ToArray(); }
        catch { return null; }
    }

    private static string? NormalizeFormCode(string? value)
        => string.IsNullOrWhiteSpace(value) || value.Equals("gdpr-consent", StringComparison.OrdinalIgnoreCase)
            ? "gdpr-consent"
            : value.Equals("customer-needs", StringComparison.OrdinalIgnoreCase) ? "customer-needs"
            : value.Equals("intermediary-information", StringComparison.OrdinalIgnoreCase) ? "intermediary-information"
            : value.Equals("document-receipt", StringComparison.OrdinalIgnoreCase) ? "document-receipt"
            : null;

    private static IReadOnlyList<string> SupportedFormCodes() => new[]
    {
        "gdpr-consent", "customer-needs", "intermediary-information", "document-receipt"
    };

    private async Task<DocumentTemplate> EnsureFormTemplateAsync(Guid tenantId, string formCode, CancellationToken ct)
    {
        var definition = TemplateFor(formCode);
        var tracked = _db.DocumentTemplates.Local.FirstOrDefault(
            x => x.TenantId == tenantId && x.Code == definition.Code && x.DeletedAt == null);
        if (tracked is not null) return tracked;
        var template = await _db.DocumentTemplates.FirstOrDefaultAsync(
            x => x.TenantId == tenantId && x.Code == definition.Code, ct);
        if (template is not null) return template;

        template = new DocumentTemplate
        {
            TenantId = tenantId,
            Code = definition.Code,
            Name = definition.Name,
            Kind = definition.Kind,
            PageSize = "A4",
            Orientation = "Portrait",
            IsDefault = true,
            IsActive = true,
            BodyHtml = definition.BodyHtml
        };
        _db.DocumentTemplates.Add(template);
        return template;
    }

    private static FormTemplateDto ToFormTemplateDto(string formCode, DocumentTemplate template)
    {
        var definition = TemplateFor(formCode);
        var customized = IsTemplateCustomized(template, definition);
        return new FormTemplateDto(
            formCode,
            template.Code,
            template.Name,
            template.Kind,
            template.HeaderHtml,
            customized ? template.BodyHtml : definition.BodyHtml,
            template.FooterHtml,
            customized,
            FormTemplateFields(formCode));
    }

    private static IReadOnlyList<FormTemplateFieldDto> FormTemplateFields(string formCode)
    {
        var fields = new List<FormTemplateFieldDto>
        {
        new FormTemplateFieldDto("customer.name", "Ονοματεπώνυμο πελάτη", "Συμπληρώνεται από την καρτέλα πελάτη."),
        new FormTemplateFieldDto("customer.email", "Email πελάτη", "Συμπληρώνεται από την καρτέλα πελάτη."),
        new FormTemplateFieldDto("customer.phone", "Τηλέφωνο πελάτη", "Κινητό/σταθερό από την καρτέλα πελάτη."),
        new FormTemplateFieldDto("customer.address", "Διεύθυνση πελάτη", "Διεύθυνση, πόλη και ΤΚ."),
        new FormTemplateFieldDto("customer.vatNumber", "ΑΦΜ πελάτη", "ΑΦΜ από την καρτέλα πελάτη."),
        new FormTemplateFieldDto("customer.notes", "Σημειώσεις πελάτη", "Οι σημειώσεις της καρτέλας πελάτη."),
        new FormTemplateFieldDto("office.name", "Επωνυμία γραφείου", "Στοιχεία του ενεργού γραφείου."),
        new FormTemplateFieldDto("office.address", "Διεύθυνση γραφείου", "Διεύθυνση γραφείου."),
        new FormTemplateFieldDto("office.email", "Email γραφείου", "Email γραφείου."),
        new FormTemplateFieldDto("office.phone", "Τηλέφωνο γραφείου", "Τηλέφωνο γραφείου."),
        new FormTemplateFieldDto("office.vatNumber", "ΑΦΜ γραφείου", "ΑΦΜ γραφείου."),
        new FormTemplateFieldDto("policy.number", "Αριθμός συμβολαίου", "Από το επιλεγμένο συμβόλαιο."),
        new FormTemplateFieldDto("policy.insuranceCompany", "Ασφαλιστική εταιρεία", "Από το επιλεγμένο συμβόλαιο."),
        new FormTemplateFieldDto("contactDate", "Ημερομηνία επικοινωνίας", "Ημερομηνία δημιουργίας του εντύπου."),
        new FormTemplateFieldDto("deliveryDate", "Ημερομηνία παράδοσης", "Προεπιλεγμένη ημερομηνία παράδοσης."),
        new FormTemplateFieldDto("documentsReceived", "Έγγραφα που παραλήφθηκαν", "Επεξεργάσιμο πεδίο παραλαβής εγγράφων."),
        new FormTemplateFieldDto("today", "Σήμερα", "Η σημερινή ημερομηνία.")
        };

        void Add(string key, string label, string description = "Πρόσθετο δυναμικό πεδίο του εντύπου.")
            => fields.Add(new FormTemplateFieldDto(key, label, description));

        if (formCode.Equals("intermediary-information", StringComparison.OrdinalIgnoreCase))
        {
            Add("intermediaryCategory", "Επαγγελματική ιδιότητα");
            Add("legalActivity", "Νομικός τρόπος δραστηριότητας");
            Add("represents", "Ασφαλιστικές που εκπροσωπεί");
            Add("providesAdvice", "Παρέχει συμβουλή");
            Add("singleInformationPointUrl", "Ενιαίο σημείο πληροφόρησης");
            Add("collaboratingInsurers", "Συνεργαζόμενες ασφαλιστικές");
            Add("remunerationNature", "Τρόπος αμοιβής");
            Add("remunerationMethod", "Μέθοδος αμοιβής");
            Add("ownershipDisclosure", "Συμμετοχές / δεσμοί ιδιοκτησίας");
            Add("investmentBasedInsurance", "Ασφάλιση βασιζόμενη σε επενδύσεις");
            Add("premiumCollectionMandate", "Εντολή είσπραξης ασφαλίστρων");
            Add("complaintsProcedure", "Διαδικασία παραπόνων");
            Add("outOfCourtDisputes", "Εξωδικαστική επίλυση διαφορών");
        }
        else if (formCode.Equals("document-receipt", StringComparison.OrdinalIgnoreCase))
        {
            Add("deliveryMethod", "Τρόπος παράδοσης");
            Add("receiptNotes", "Παρατηρήσεις παραλαβής");
        }
        else if (formCode.Equals("customer-needs", StringComparison.OrdinalIgnoreCase))
        {
            Add("coverageVehicle", "Ασφάλιση οχήματος");
            Add("coverageVessel", "Ασφάλιση σκάφους");
            Add("coverageHome", "Ασφάλιση κατοικίας / εξοχικού");
            Add("coverageBusiness", "Ασφάλιση επιχείρησης");
            Add("coverageProfessional", "Επαγγελματική αστική ευθύνη");
            Add("coverageOtherText", "Άλλο ενδιαφέρον");
            Add("vesselName", "Όνομα σκάφους");
            Add("registrationNumber", "Νηολόγιο / αριθμός");
            Add("flag", "Σημαία");
            Add("hullNumber", "Hull No");
            Add("vesselType", "Τύπος σκάφους");
            Add("maker", "Κατασκευαστής");
            Add("hullMaterial", "Υλικό κατασκευής");
            Add("yearBuilt", "Έτος κατασκευής");
            Add("maxSpeed", "Μέγιστη ταχύτητα");
            Add("purchaseDate", "Ημερομηνία αγοράς");
            Add("purchasePrice", "Τιμή αγοράς");
            Add("length", "Μήκος");
            Add("beam", "Πλάτος");
            Add("draft", "Βύθισμα");
            Add("use", "Χρήση");
            Add("crewDetails", "Πλήρωμα");
            foreach (var engine in new[] { "inboard", "outboard", "inoutboard" })
            {
                var engineLabel = engine switch
                {
                    "inboard" => "Εσωλέμβια",
                    "outboard" => "Εξωλέμβια",
                    _ => "Εσω-εξωλέμβια"
                };
                Add($"engine_{engine}_maker", $"{engineLabel}: κατασκευαστής");
                Add($"engine_{engine}_serial", $"{engineLabel}: serial no");
                Add($"engine_{engine}_hp", $"{engineLabel}: ίπποι / HP");
                Add($"engine_{engine}_year", $"{engineLabel}: έτος");
                Add($"engine_{engine}_fuel", $"{engineLabel}: καύσιμα");
            }
            Add("largerLiabilityLimit", "Μεγαλύτερο όριο αστικής ευθύνης");
            Add("laidUpPeriod", "Περίοδος εκτός νερού");
            Add("laidUpLocation", "Πού θα είναι το σκάφος");
            Add("marina", "Σε μαρίνα");
            Add("moorings", "Προσδέσεις");
            Add("cruisingLimits", "Περιορισμοί πλεύσης");
            Add("automaticFireExtinguishing", "Αυτόματο σύστημα πυρόσβεσης");
            Add("waterSkiers", "Water skiers / liability");
            Add("racingRisks", "Racing risks");
            Add("replacementValues", "Αξίες αντικατάστασης");
            Add("insuredHull", "Ασφαλιζόμενη αξία: κύτος / hull");
            Add("insuredMachinery", "Ασφαλιζόμενη αξία: μηχανές");
            Add("insuredRigging", "Ασφαλιζόμενη αξία: ιστία / ιστός");
            Add("insuredOutboard", "Ασφαλιζόμενη αξία: εξωλέμβια");
            Add("insuredDinghy", "Ασφαλιζόμενη αξία: βοηθητικό σκάφος");
            Add("insuredNavigation", "Ασφαλιζόμενη αξία: εξοπλισμός ναυσιπλοΐας");
            Add("insuredLifeRaft", "Ασφαλιζόμενη αξία: σωστική λέμβος");
            Add("insuredAutopilot", "Ασφαλιζόμενη αξία: αυτόματος πιλότος");
            Add("insuredOther", "Ασφαλιζόμενη αξία: άλλος εξοπλισμός");
            Add("insuredPersonalItems", "Ασφαλιζόμενη αξία: προσωπικά αντικείμενα");
            Add("totalInsuredValue", "Σύνολο ασφαλιζόμενης αξίας");
            Add("roadTransit", "Οδική μεταφορά");
            Add("claimsLastFiveYears", "Ζημιές τελευταίας 5ετίας");
            Add("loan", "Υπάρχει δάνειο");
            Add("loanAmount", "Ποσό δανείου");
            Add("insuredFrom", "Ασφαλιστική περίοδος από");
            Add("insuredTo", "Ασφαλιστική περίοδος έως");
            Add("city", "Πόλη υπογραφής");
            Add("premiumPayment", "Πληρωμή ασφαλίστρων");
            Add("additionalInformation", "Παρατηρήσεις / πρόσθετες πληροφορίες");
        }

        return fields;
    }

    private static bool IsTemplateCustomized(DocumentTemplate template, (string Code, string Name, string Kind, string BodyHtml) definition)
    {
        var body = template.BodyHtml ?? "";
        var isDefaultBody = string.Equals(body, definition.BodyHtml, StringComparison.Ordinal)
            || string.Equals(body, LegacyTemplateBody(definition.Code), StringComparison.Ordinal);
        return !string.IsNullOrWhiteSpace(template.HeaderHtml)
            || !string.IsNullOrWhiteSpace(template.FooterHtml)
            || !isDefaultBody;
    }

    private static void AddTemplateSnapshot(Dictionary<string, string?> data, string formCode, DocumentTemplate template)
    {
        var definition = TemplateFor(formCode);
        if (!IsTemplateCustomized(template, definition)) return;
        data["__templateCustom"] = "true";
        data["__templateHeaderHtml"] = MergeTemplate(template.HeaderHtml, data);
        data["__templateBodyHtml"] = MergeTemplate(template.BodyHtml, data);
        data["__templateFooterHtml"] = MergeTemplate(template.FooterHtml, data);
    }

    private static bool HasCustomTemplate(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.TryGetProperty("__templateCustom", out var marker)
                && marker.ValueKind == JsonValueKind.String
                && string.Equals(marker.GetString(), "true", StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    private static string? MergeTemplate(string? html, IReadOnlyDictionary<string, string?> data)
    {
        if (string.IsNullOrWhiteSpace(html)) return html;
        var values = new Dictionary<string, string?>(data, StringComparer.OrdinalIgnoreCase)
        {
            // Keep the aliases used by the older Document Templates designer
            // working alongside the new office-scoped field palette.
            ["agency.name"] = Get(data, "officeName"),
            ["agency.address"] = Get(data, "officeAddress"),
            ["agency.email"] = Get(data, "officeEmail"),
            ["agency.phone"] = Get(data, "officePhone"),
            ["agency.vatNumber"] = Get(data, "officeVatNumber"),
            ["customer.name"] = Get(data, "customerName"),
            ["customer.fullName"] = Get(data, "customerName"),
            ["customer.email"] = Get(data, "email"),
            ["customer.phone"] = Get(data, "phone"),
            ["customer.address"] = Get(data, "address"),
            ["customer.vatNumber"] = Get(data, "vatNumber"),
            ["customer.notes"] = Get(data, "customerNotes"),
            ["office.name"] = Get(data, "officeName"),
            ["office.address"] = Get(data, "officeAddress"),
            ["office.email"] = Get(data, "officeEmail"),
            ["office.phone"] = Get(data, "officePhone"),
            ["office.vatNumber"] = Get(data, "officeVatNumber"),
            ["policy.number"] = Get(data, "policyNumber"),
            ["policy.insuranceCompany"] = Get(data, "insuranceCompany"),
            ["form.customerName"] = Get(data, "customerName"),
            ["form.policyNumber"] = Get(data, "policyNumber"),
            ["form.insuranceCompany"] = Get(data, "insuranceCompany"),
            ["form.contactDate"] = Get(data, "contactDate"),
            ["form.deliveryDate"] = Get(data, "deliveryDate"),
            ["form.documentsReceived"] = Get(data, "documentsReceived"),
            ["today"] = DateTime.Today.ToString("dd/MM/yyyy")
        };
        return Regex.Replace(html, @"\{\{\s*([^{}]+?)\s*\}\}", match =>
        {
            var key = match.Groups[1].Value.Trim();
            return values.TryGetValue(key, out var value)
                ? System.Net.WebUtility.HtmlEncode(value ?? "")
                : match.Value;
        });
    }

    private static string? Get(IReadOnlyDictionary<string, string?> data, string key)
        => data.TryGetValue(key, out var value) ? value : null;

    private static string? SanitizeTemplateHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var value = Regex.Replace(html, @"<\s*(script|style|iframe|object|embed)[^>]*>.*?<\s*/\s*\1\s*>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        value = Regex.Replace(value, @"\s+on[a-z]+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]+)", "", RegexOptions.IgnoreCase);
        value = Regex.Replace(value, @"(href|src)\s*=\s*(""\s*javascript:[^""]*""|'\s*javascript:[^']*')", "", RegexOptions.IgnoreCase);
        return value.Trim();
    }

    private static string FormTitle(string formCode) => formCode switch
    {
        "customer-needs" => "Έντυπο Αναγκών Πελάτη",
        "intermediary-information" => "Πληροφορίες Ασφαλιστικού Διαμεσολαβητή",
        "document-receipt" => "Απόδειξη Παραλαβής Εντύπων",
        _ => "Έντυπο ενημέρωσης και δήλωσης GDPR"
    };

    private static string FormVersionFor(string formCode, string defaultVersion) => formCode switch
    {
        "customer-needs" => "nivis-v1",
        "intermediary-information" => "intermediary-information-v1",
        "document-receipt" => "document-receipt-v1",
        _ => defaultVersion
    };

    private static string FileNameFor(string formCode, bool preview) => formCode switch
    {
        "customer-needs" => preview ? "customer-needs-preview.pdf" : "customer-needs-form.pdf",
        "intermediary-information" => preview ? "intermediary-information-preview.pdf" : "intermediary-information.pdf",
        "document-receipt" => preview ? "document-receipt-preview.pdf" : "document-receipt.pdf",
        _ => preview ? "gdpr-consent-preview.pdf" : "gdpr-consent.pdf"
    };

    private static (string Code, string Name, string Kind, string BodyHtml) TemplateFor(string formCode) => formCode switch
    {
        "customer-needs" => ("CUSTOMER_NEEDS", "Έντυπο Αναγκών Πελάτη", "CustomerNeeds", DefaultEditorHtml("customer-needs")),
        "intermediary-information" => ("INTERMEDIARY_INFORMATION", "Πληροφορίες Ασφαλιστικού Διαμεσολαβητή", "IntermediaryInformation", DefaultEditorHtml("intermediary-information")),
        "document-receipt" => ("DOCUMENT_RECEIPT", "Απόδειξη Παραλαβής Εντύπων", "DocumentReceipt", DefaultEditorHtml("document-receipt")),
        _ => ("GDPR_CONSENT", "Έντυπο ενημέρωσης και δήλωσης GDPR", "GDPR", DefaultEditorHtml("gdpr-consent"))
    };

    private static string LegacyTemplateBody(string code) => code switch
    {
        "CUSTOMER_NEEDS" => "<h1>{{agency.name}}</h1><h2>ΕΝΤΥΠΟ ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ</h2><p>{{customer.name}}</p>",
        "INTERMEDIARY_INFORMATION" => "<h1>{{agency.name}}</h1><h2>ΠΛΗΡΟΦΟΡΙΕΣ ΑΣΦΑΛΙΣΤΙΚΟΥ ΔΙΑΜΕΣΟΛΑΒΗΤΗ</h2><p>Άρθρα 28 και 29 ν. 4583/2018</p><p>{{customer.name}}</p>",
        "DOCUMENT_RECEIPT" => "<h1>{{agency.name}}</h1><h2>ΑΠΟΔΕΙΞΗ ΠΑΡΑΛΑΒΗΣ ΕΝΤΥΠΩΝ</h2><p>{{customer.name}}</p><p>{{form.documentsReceived}}</p>",
        _ => "<h1>{{agency.name}}</h1><h2>ΕΝΗΜΕΡΩΣΗ ΥΠΟΚΕΙΜΕΝΟΥ ΔΕΔΟΜΕΝΩΝ & ΔΗΛΩΣΗ GDPR</h2><p>Πελάτης: {{customer.name}}</p><p>Email: {{customer.email}}</p>"
    };

    /// <summary>
    /// The editor starts with the same complete text as the established PDF
    /// renderer. Legacy offices may still have the short pre-editor body in
    /// the database; that body is upgraded in the DTO without overwriting it.
    /// </summary>
    private static string DefaultEditorHtml(string formCode) => formCode switch
    {
        "customer-needs" => """
            <h1>ΕΝΤΥΠΟ ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ</h1>
            <p>(Σύμφωνα με το άρθρο 11 ΠΔ 190/2006 και το άρθρο 5 παρ. 4 της Πράξης 31/2013 της ΤτΕ)</p>
            <h2>Κώδικας Δεοντολογίας</h2>
            <p>Βάσει των πράξεων της Τράπεζας της Ελλάδος, οφείλουμε να σας προτείνουμε ρεαλιστικές και σύγχρονες ασφαλιστικές λύσεις που ανταποκρίνονται στις πραγματικές σας ανάγκες. Το ερωτηματολόγιο συγκεντρώνει τα στοιχεία που είναι απαραίτητα για την εξατομικευμένη πρόταση.</p>
            <h2>Προσωπικά στοιχεία πελάτη — στοιχεία επικοινωνίας</h2>
            <p><strong>Ονοματεπώνυμο:</strong> {{customer.name}} · <strong>Ημερομηνία γέννησης:</strong> {{birthDate}}</p>
            <p><strong>ΑΦΜ:</strong> {{vatNumber}} · <strong>ΔΟΥ:</strong> {{taxOffice}}</p>
            <p><strong>Επάγγελμα:</strong> {{occupation}} · <strong>Email:</strong> {{customer.email}}</p>
            <p><strong>Τηλέφωνα:</strong> {{customer.phone}} · <strong>Διεύθυνση:</strong> {{customer.address}}</p>
            <h2>Επιθυμητές ασφαλιστικές καλύψεις</h2>
            <ul><li>Ασφάλιση οχήματος: {{coverageVehicle}}</li><li>Ασφάλιση σκάφους: {{coverageVessel}}</li><li>Ασφάλιση κατοικίας / εξοχικού: {{coverageHome}}</li><li>Ασφάλιση επιχείρησης: {{coverageBusiness}}</li><li>Επαγγελματική αστική ευθύνη: {{coverageProfessional}}</li><li>Άλλο ενδιαφέρον: {{coverageOtherText}}</li></ul>
            <h2>Στοιχεία περιουσίας — σκάφος / vessel</h2>
            <p><strong>Όνομα:</strong> {{vesselName}} · <strong>Νηολόγιο:</strong> {{registrationNumber}} · <strong>Σημαία:</strong> {{flag}}</p>
            <p><strong>Hull No:</strong> {{hullNumber}} · <strong>Τύπος:</strong> {{vesselType}} · <strong>Κατασκευαστής:</strong> {{maker}}</p>
            <p><strong>Υλικό:</strong> {{hullMaterial}} · <strong>Έτος:</strong> {{yearBuilt}} · <strong>Μέγιστη ταχύτητα:</strong> {{maxSpeed}}</p>
            <p><strong>Ημερομηνία αγοράς:</strong> {{purchaseDate}} · <strong>Τιμή αγοράς:</strong> {{purchasePrice}} · <strong>Μήκος:</strong> {{length}} · <strong>Πλάτος:</strong> {{beam}} · <strong>Βύθισμα:</strong> {{draft}}</p>
            <p><strong>Χρήση:</strong> {{use}} · <strong>Πλήρωμα:</strong> {{crewDetails}}</p>
            <h2>Κύριες μηχανές</h2>
            <p><strong>Εσωλέμβια:</strong> {{engine_inboard_maker}} · {{engine_inboard_serial}} · {{engine_inboard_hp}} HP · {{engine_inboard_year}} · {{engine_inboard_fuel}}</p>
            <p><strong>Εξωλέμβια:</strong> {{engine_outboard_maker}} · {{engine_outboard_serial}} · {{engine_outboard_hp}} HP · {{engine_outboard_year}} · {{engine_outboard_fuel}}</p>
            <p><strong>Εσω-εξωλέμβια:</strong> {{engine_inoutboard_maker}} · {{engine_inoutboard_serial}} · {{engine_inoutboard_hp}} HP · {{engine_inoutboard_year}} · {{engine_inoutboard_fuel}}</p>
            <h2>Κίνδυνοι, αξίες και περίοδος ασφάλισης</h2>
            <p><strong>Μεγαλύτερο όριο αστικής ευθύνης:</strong> {{largerLiabilityLimit}} · <strong>Εκτός νερού:</strong> {{laidUpPeriod}} · <strong>Τοποθεσία:</strong> {{laidUpLocation}}</p>
            <p><strong>Μαρίνα:</strong> {{marina}} · <strong>Προσδέσεις:</strong> {{moorings}} · <strong>Περιορισμοί πλεύσης:</strong> {{cruisingLimits}}</p>
            <p><strong>Αυτόματη πυρόσβεση:</strong> {{automaticFireExtinguishing}} · <strong>Water skiers:</strong> {{waterSkiers}} · <strong>Racing risks:</strong> {{racingRisks}}</p>
            <p><strong>Αξίες αντικατάστασης:</strong> {{replacementValues}} · <strong>Οδική μεταφορά:</strong> {{roadTransit}}</p>
            <p><strong>Ζημιές τελευταίας 5ετίας:</strong> {{claimsLastFiveYears}} · <strong>Δάνειο:</strong> {{loan}} · <strong>Ποσό:</strong> {{loanAmount}}</p>
            <p><strong>Ασφαλιστική περίοδος:</strong> {{insuredFrom}} έως {{insuredTo}} · <strong>Πληρωμή ασφαλίστρων:</strong> {{premiumPayment}}</p>
            <h2>Παρατηρήσεις / πρόσθετες πληροφορίες</h2><p>{{additionalInformation}}</p>
            <h2>Δήλωση</h2>
            <p>Δηλώνω ότι οι παραπάνω απαντήσεις είναι αληθείς, ακριβείς και πλήρεις και ότι δεν έχω αποκρύψει πληροφορία που θα μπορούσε να επηρεάσει την απόφαση των ασφαλιστών σχετικά με την πρόταση ασφάλισης.</p>
            <p>Η παρούσα πρόταση αποτελεί τη βάση και αναπόσπαστο τμήμα του ασφαλιστηρίου συμβολαίου, σε περίπτωση έκδοσης. Οποιαδήποτε μεταβολή στα στοιχεία πρέπει να γνωστοποιείται άμεσα στο γραφείο.</p>
            """,
        "intermediary-information" => """
            <h1>ΕΝΤΥΠΟ ΠΑΡΟΧΗΣ ΠΛΗΡΟΦΟΡΙΩΝ ΑΣΦΑΛΙΣΤΙΚΟΥ ΔΙΑΜΕΣΟΛΑΒΗΤΗ</h1>
            <p>Άρθρα 28, 29 και 33 του ν. 4583/2018</p>
            <h2>1. Ταυτότητα και επαγγελματική ιδιότητα</h2>
            <p><strong>Επωνυμία / διακριτικός τίτλος:</strong> {{office.name}} · <strong>Διεύθυνση:</strong> {{office.address}}</p>
            <p><strong>Email / τηλέφωνο:</strong> {{office.email}} / {{office.phone}} · <strong>ΑΦΜ:</strong> {{office.vatNumber}}</p>
            <p><strong>Επαγγελματική ιδιότητα:</strong> {{intermediaryCategory}} · <strong>Αριθμός ειδικού μητρώου:</strong> {{registryNumber}} · <strong>Έτος:</strong> {{registryYear}}</p>
            <p><strong>Ενιαίο σημείο πληροφόρησης:</strong> {{singleInformationPointUrl}} · <strong>Νομικός τρόπος δραστηριότητας:</strong> {{legalActivity}}</p>
            <h2>2. Ρόλος, συμβουλή και ασφαλιστικές επιχειρήσεις</h2>
            <p><strong>Ενεργεί για λογαριασμό:</strong> {{represents}} · <strong>Παρέχει συμβουλή:</strong> {{providesAdvice}}</p>
            <p><strong>Συνεργαζόμενες ασφαλιστικές:</strong> {{collaboratingInsurers}}</p>
            <p><strong>Επενδυτικά προϊόντα βασιζόμενα σε ασφάλιση:</strong> {{investmentBasedInsurance}} · <strong>Εντολή είσπραξης ασφαλίστρων:</strong> {{premiumCollectionMandate}}</p>
            <h2>3. Αμοιβή, καταγγελίες και εξωδικαστική επίλυση</h2>
            <p><strong>Φύση αμοιβής:</strong> {{remunerationNature}} · <strong>Τρόπος αμοιβής:</strong> {{remunerationMethod}}</p>
            <p><strong>Συμμετοχές / δεσμοί ιδιοκτησίας:</strong> {{ownershipDisclosure}}</p>
            <p><strong>Διαδικασία αιτιάσεων / καταγγελιών:</strong> {{complaintsProcedure}} · <strong>Εξωδικαστική επίλυση:</strong> {{outOfCourtDisputes}}</p>
            <h2>4. Στοιχεία πελάτη και προτεινόμενη σύμβαση</h2>
            <p><strong>Πελάτης:</strong> {{customer.name}} · <strong>Email:</strong> {{customer.email}}</p>
            <p><strong>Αριθμός συμβολαίου:</strong> {{policy.number}} · <strong>Ασφαλιστική:</strong> {{policy.insuranceCompany}}</p>
            <p>Ο πελάτης δηλώνει ότι έλαβε τις παραπάνω πληροφορίες εγκαίρως, σε σαφή και κατανοητή μορφή, πριν από τη σύναψη της ασφαλιστικής σύμβασης.</p>
            """,
        "document-receipt" => """
            <h1>ΑΠΟΔΕΙΞΗ ΠΑΡΑΛΑΒΗΣ ΕΝΤΥΠΩΝ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ</h1>
            <p>Ημερομηνίες επικοινωνίας, παράδοσης και παραλαβής εγγράφων</p>
            <h2>Στοιχεία πελάτη και γραφείου</h2>
            <p><strong>Πελάτης:</strong> {{customer.name}} · <strong>Email:</strong> {{customer.email}}</p>
            <p><strong>Αριθμός συμβολαίου:</strong> {{policy.number}} · <strong>Ασφαλιστική:</strong> {{policy.insuranceCompany}}</p>
            <p><strong>Γραφείο / διαμεσολαβητής:</strong> {{office.name}} · <strong>Email γραφείου:</strong> {{office.email}}</p>
            <h2>Στοιχεία παράδοσης</h2>
            <p><strong>Ημερομηνία επικοινωνίας:</strong> {{contactDate}} · <strong>Ημερομηνία παράδοσης / παραλαβής:</strong> {{deliveryDate}}</p>
            <p><strong>Τρόπος παράδοσης:</strong> {{deliveryMethod}} · <strong>Παρατηρήσεις:</strong> {{receiptNotes}}</p>
            <h2>Έγγραφα που παραδόθηκαν και παραλήφθηκαν</h2>
            <p>{{documentsReceived}}</p>
            <p>Ο πελάτης βεβαιώνει ότι παρέλαβε τα παραπάνω έγγραφα και είχε τη δυνατότητα να τα διαβάσει, να ζητήσει διευκρινίσεις και να κρατήσει αντίγραφό τους. Η παρούσα απόδειξη δεν τροποποιεί τους όρους του ασφαλιστηρίου ή τις νόμιμες υποχρεώσεις ενημέρωσης.</p>
            """,
        _ => """
            <h1>ΕΝΗΜΕΡΩΣΗ ΥΠΟΚΕΙΜΕΝΟΥ ΔΕΔΟΜΕΝΩΝ & ΔΗΛΩΣΗ GDPR</h1>
            <p>Άρθρα 13 και 14 Γενικού Κανονισμού Προστασίας Δεδομένων (ΕΕ) 2016/679</p>
            <h2>Υπεύθυνος επεξεργασίας</h2>
            <p><strong>Γραφείο:</strong> {{office.name}} · <strong>Διεύθυνση:</strong> {{office.address}}</p>
            <p><strong>Email:</strong> {{office.email}} · <strong>Τηλέφωνο:</strong> {{office.phone}} · <strong>ΑΦΜ:</strong> {{office.vatNumber}}</p>
            <h2>Στοιχεία που συλλέγουμε και σκοποί επεξεργασίας</h2>
            <p>Συλλέγονται στοιχεία ταυτοποίησης, επικοινωνίας, οικονομικά και ασφαλιστικά στοιχεία για την αξιολόγηση, έκδοση, διαχείριση και εξυπηρέτηση ασφαλιστικών συμβάσεων, την επικοινωνία με τις ασφαλιστικές εταιρείες και την τήρηση των νόμιμων υποχρεώσεων.</p>
            <p>Για συμβόλαια ζωής ή υγείας ενδέχεται να ζητηθούν δεδομένα υγείας, ειδική κατηγορία δεδομένων κατά το άρθρο 9 GDPR, μόνο με ξεχωριστή ρητή συγκατάθεση.</p>
            <h2>Αποδέκτες και διαβιβάσεις</h2>
            <p>Τα δεδομένα κοινοποιούνται στις ασφαλιστικές εταιρείες που σχετίζονται με τα συμβόλαια του πελάτη, σε παρόχους τεχνολογίας και αποστολής email ως εκτελούντες την επεξεργασία και στις αρμόδιες αρχές όπου απαιτείται από τον νόμο. Δεν πραγματοποιούνται τακτικές διαβιβάσεις εκτός ΕΟΧ.</p>
            <h2>Διάρκεια διατήρησης και δικαιώματα</h2>
            <p>Τα δεδομένα διατηρούνται όσο ισχύει η ασφαλιστική σχέση και για όσο απαιτείται από τις φορολογικές και λοιπές νόμιμες υποχρεώσεις.</p>
            <p>Έχετε δικαίωμα πρόσβασης, διόρθωσης, διαγραφής όπου επιτρέπεται, περιορισμού, φορητότητας, εναντίωσης και ανάκλησης συγκατάθεσης χωρίς αναδρομική επίπτωση.</p>
            <h2>Στοιχεία πελάτη</h2>
            <p><strong>Ονοματεπώνυμο / Επωνυμία:</strong> {{customer.name}} · <strong>Email:</strong> {{customer.email}}</p>
            <p><strong>Τηλέφωνο:</strong> {{customer.phone}} · <strong>Διεύθυνση:</strong> {{customer.address}} · <strong>ΑΦΜ:</strong> {{customer.vatNumber}}</p>
            <h2>Δήλωση επιλογής</h2>
            <p>Έχω ενημερωθεί για την επεξεργασία των προσωπικών μου δεδομένων όπως ορίζεται στο παρόν έγγραφο. Ημερομηνία: {{contactDate}}</p>
            """
    };

    private static Dictionary<string, string?> BuildFormData(Customer customer, Tenant office, Policy? policy, Dictionary<string, string?>? submitted, string? collaboratingInsurers = null)
    {
        var data = submitted is null
            ? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, string?>(submitted, StringComparer.OrdinalIgnoreCase);
        // CRM values always win over editable questionnaire answers. This is
        // what makes the customer-card fields genuinely auto-completed and
        // keeps a sent form immutable when the card is edited later.
        data["customerName"] = DisplayName(customer);
        data["birthDate"] = customer.BirthDate?.ToString("dd/MM/yyyy");
        data["vatNumber"] = customer.VatNumber;
        data["taxOffice"] = customer.TaxOffice;
        data["occupation"] = customer.Occupation;
        data["email"] = customer.Email;
        data["phone"] = string.Join(" / ", new[] { customer.MobilePhone, customer.Phone, customer.AltPhone }.Where(x => !string.IsNullOrWhiteSpace(x)));
        data["address"] = string.Join(", ", new[] { customer.Address, customer.City, customer.PostalCode, customer.Region }.Where(x => !string.IsNullOrWhiteSpace(x)));
        data["customerNotes"] = customer.Notes;
        data["officeName"] = office.Name;
        data["officeAddress"] = office.AddressLine;
        data["officeEmail"] = office.ContactEmail;
        data["officePhone"] = office.ContactPhone;
        data["officeVatNumber"] = office.VatNumber;
        data["policyNumber"] = policy?.PolicyNumber;
        data["insuranceCompany"] = policy?.InsuranceCompany?.Name;
        SetIfBlank(data, "registryNumber", office.TteRegistrationNumber);
        SetIfBlank(data, "registryYear", office.TteRegistrationYear?.ToString());
        SetIfBlank(data, "singleInformationPointUrl", "https://insuranceregistry.uhc.gr/");
        SetIfBlank(data, "collaboratingInsurers", string.IsNullOrWhiteSpace(collaboratingInsurers) ? null : collaboratingInsurers);
        SetIfBlank(data, "contactDate", DateTime.UtcNow.ToLocalTime().ToString("dd/MM/yyyy"));
        SetIfBlank(data, "deliveryDate", DateTime.UtcNow.ToLocalTime().ToString("dd/MM/yyyy"));
        SetIfBlank(data, "documentsReceived", "Έντυπο GDPR; Έντυπο Αναγκών Πελάτη; Πληροφορίες Ασφαλιστικού Διαμεσολαβητή");
        return data;
    }

    private static void SetIfBlank(Dictionary<string, string?> data, string key, string? value)
    {
        if (!data.TryGetValue(key, out var current) || string.IsNullOrWhiteSpace(current))
            data[key] = value;
    }

    private async Task<string> GetCollaboratingInsurersAsync(Guid tenantId, CancellationToken ct)
    {
        // Resolve IDs first, then load carrier names separately. This avoids
        // provider-specific navigation/distinct/order translation failures in
        // the preview endpoint while still deriving the list from the office's
        // actual policies.
        var companyIds = await _db.Policies.AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .Select(x => x.InsuranceCompanyId)
            .Distinct()
            .ToListAsync(ct);
        if (companyIds.Count == 0) return string.Empty;

        var names = await _db.InsuranceCompanies.AsNoTracking()
            .Where(x => companyIds.Contains(x.Id))
            .Select(x => x.Name)
            .ToListAsync(ct);
        return string.Join(", ", names
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase));
    }

    private static IQueryable<CustomerFormSigning> ApplyHistoryFilters(
        IQueryable<CustomerFormSigning> query,
        string? search,
        string? formCode,
        string? status,
        DateTime? from,
        DateTime? to)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => EF.Functions.Like(x.CustomerFullNameSnapshot, $"%{term}%")
                || (x.CustomerEmailSnapshot != null && EF.Functions.Like(x.CustomerEmailSnapshot, $"%{term}%")));
        }
        if (!string.IsNullOrWhiteSpace(formCode))
            query = query.Where(x => x.FormCode == formCode.Trim());
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CustomerFormSigningStatus>(status, true, out var parsed))
            query = query.Where(x => x.Status == parsed);
        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value.Date);
        if (to.HasValue) query = query.Where(x => x.CreatedAt < to.Value.Date.AddDays(1));
        return query;
    }

    private static IReadOnlySet<Guid> ParseIds(string? value)
        => (value ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Guid.TryParse(x, out var id) ? id : Guid.Empty)
            .Where(x => x != Guid.Empty)
            .ToHashSet();

    private static FormHistoryDto ToHistoryDto(CustomerFormSigning x) => new(
        x.Id, x.CustomerId, x.PolicyId, x.FormCode, x.Status.ToString(), x.CustomerConsented,
        x.CustomerFullNameSnapshot, x.CustomerEmailSnapshot, x.CreatedAt, x.ExpiresAt,
        x.CustomerSignedAt, x.OfficeSignedAt, x.InsurerSignedAt, x.CompletedAt,
        !string.IsNullOrWhiteSpace(x.DraftDocumentPath), !string.IsNullOrWhiteSpace(x.FinalDocumentPath), x.FileName);

    private static string SafeArchivePart(string value)
    {
        var name = string.IsNullOrWhiteSpace(value) ? "χωρίς-πελάτη" : value.Trim();
        foreach (var invalid in Path.GetInvalidFileNameChars()) name = name.Replace(invalid, '-');
        return name.Length > 80 ? name[..80].Trim() : name;
    }

    private static string CsvPart(string? value)
        => "\"" + (value ?? string.Empty).Replace("\"", "\"\"") + "\"";

    private Guid TenantId() => _current.TenantId ?? throw new UnauthorizedAccessException();
    private static string DisplayName(Customer c) => c.Type == CustomerType.Company ? c.CompanyName ?? c.CustomerNumber : string.Join(" ", new[] { c.FirstName, c.LastName }.Where(x => !string.IsNullOrWhiteSpace(x))).Trim() is { Length: > 0 } n ? n : c.CustomerNumber;
    private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
    private static CustomerFormSigningLink NewLink(CustomerFormSigning signing, CustomerFormSigningRecipientRole role, string token, string email, string name, DateTime expires) => new() { TenantId = signing.TenantId, SigningId = signing.Id, RecipientRole = role, TokenHash = HashToken(token), Email = email.Trim(), DisplayName = name, ExpiresAt = expires };
    private static SettingsDto ToSettings(TenantGdprSigningSettings x) => new(x.Enabled, x.RequireOfficeSignature, x.RequireInsurerSignature, x.SendInsurerEmail, x.LinkExpirationDays, x.TemplateCode);
    private static SigningDto ToDto(CustomerFormSigning x) => new(x.Id, x.CustomerId, x.PolicyId, x.FormCode, x.Status.ToString(), x.CustomerConsented, x.CustomerFullNameSnapshot, x.CustomerEmailSnapshot, x.OfficeEmailSnapshot, x.InsurerEmailSnapshot, x.CreatedAt, x.ExpiresAt, x.CustomerSignedAt, x.OfficeSignedAt, x.InsurerSignedAt, x.CompletedAt, x.FinalDocumentPath, x.FinalDocumentPath != null);
    private static byte[]? DecodeSignature(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 4_000_000) return null;
        var comma = value.IndexOf(','); if (comma < 0) return null;
        var header = value[..comma].Trim();
        if (!header.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) || !header.Contains(";base64", StringComparison.OrdinalIgnoreCase)) return null;
        var payload = value[(comma + 1)..].Trim().Replace("\r", string.Empty).Replace("\n", string.Empty).Replace(" ", string.Empty);
        try { var bytes = Convert.FromBase64String(payload); return bytes.Length is > 50 and < 2_000_000 ? bytes : null; } catch { return null; }
    }
}
