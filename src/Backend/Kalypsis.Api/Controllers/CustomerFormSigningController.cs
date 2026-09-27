using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    public sealed record CreateFormBody(Guid? PolicyId, bool? RequireOfficeSignature, bool? RequireInsurerSignature, bool? SendInsurerEmail, string? Notes, string? FormCode = null, Dictionary<string, string?>? Fields = null);
    public sealed record PreviewFormBody(Guid? PolicyId, string? FormCode = null, Dictionary<string, string?>? Fields = null);
    public sealed record SigningDto(Guid Id, Guid CustomerId, Guid? PolicyId, string FormCode, string Status, bool? CustomerConsented, string CustomerName, string? CustomerEmail, string? OfficeEmail, string? InsurerEmail, DateTime CreatedAt, DateTime ExpiresAt, DateTime? CustomerSignedAt, DateTime? OfficeSignedAt, DateTime? InsurerSignedAt, DateTime? CompletedAt, string? FinalDocumentPath, bool HasFinalDocument);
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
        var data = BuildFormData(customer, office, policy, body.Fields);
        var draft = new CustomerFormSigning
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            PolicyId = policy?.Id,
            FormCode = formCode,
            FormVersion = formCode == "customer-needs" ? "nivis-v1" : "gdpr-consent-cover-v1",
            Status = CustomerFormSigningStatus.Draft,
            CustomerFullNameSnapshot = DisplayName(customer),
            CustomerEmailSnapshot = customer.Email,
            InsurerEmailSnapshot = policy?.InsuranceCompany?.ContactEmail,
            FormDataJson = data.Count == 0 ? null : JsonSerializer.Serialize(data),
            FileName = formCode == "customer-needs" ? "customer-needs-preview.pdf" : "gdpr-consent-preview.pdf",
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
        var templateCode = formCode == "customer-needs" ? "CUSTOMER_NEEDS" : "GDPR_CONSENT";
        if (!await _db.DocumentTemplates.AnyAsync(x => x.TenantId == tenantId && x.Code == templateCode, ct))
        {
            _db.DocumentTemplates.Add(new DocumentTemplate
            {
                TenantId = tenantId,
                Code = templateCode,
                Name = formCode == "customer-needs" ? "Έντυπο Αναγκών Πελάτη" : "Έντυπο ενημέρωσης και δήλωσης GDPR",
                Kind = formCode == "customer-needs" ? "CustomerNeeds" : "GDPR",
                PageSize = "A4",
                Orientation = "Portrait",
                IsDefault = true,
                IsActive = true,
                BodyHtml = "<h1>{{agency.name}}</h1><h2>ΕΝΗΜΕΡΩΣΗ ΥΠΟΚΕΙΜΕΝΟΥ ΔΕΔΟΜΕΝΩΝ & ΔΗΛΩΣΗ GDPR</h2><p>Πελάτης: {{customer.name}}</p><p>Email: {{customer.email}}</p><p>Η δήλωση και οι υπογραφές συμπληρώνονται ηλεκτρονικά από τον ασφαλή σύνδεσμο.</p>"
            });
        }

        // Keep the reusable template catalogue in sync with the renderer. The
        // PDF renderer is authoritative for layout, while BodyHtml gives the
        // office a readable prompt in the existing template-management page.
        if (formCode == "customer-needs" && _db.DocumentTemplates.Local.LastOrDefault() is { } needsTemplate && needsTemplate.Code == "CUSTOMER_NEEDS")
            needsTemplate.BodyHtml = "<h1>{{agency.name}}</h1><h2>ΕΝΤΥΠΟ ΑΝΑΓΚΩΝ ΠΕΛΑΤΗ</h2><p>{{customer.name}}</p><p>{{customer.email}}</p><p>{{form.vesselName}}</p><p>{{form.totalInsuredValue}}</p><p>Δήλωση και υπογραφή πελάτη, γραφείου και ασφαλιστικής όπου απαιτείται.</p>";

        var now = DateTime.UtcNow;
        var formData = BuildFormData(customer, office, policy, body.Fields);
        var signing = new CustomerFormSigning
        {
            TenantId = tenantId, CustomerId = customerId, PolicyId = policy?.Id,
            FormCode = formCode, FormVersion = formCode == "customer-needs" ? "nivis-v1" : settings.TemplateCode,
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
            FileName = formCode == "customer-needs" ? "customer-needs-form.pdf" : "gdpr-consent.pdf"
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
    public async Task<IActionResult> Export([FromQuery] string? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string format = "xlsx", CancellationToken ct = default)
    {
        var tenantId = TenantId();
        var query = _db.CustomerFormSignings.AsNoTracking().Where(x => x.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CustomerFormSigningStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        if (from.HasValue) query = query.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(x => x.CreatedAt <= to.Value);
        var rows = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var sheet = new Sheet("Έντυπα GDPR", new[] { "Id", "Πελάτης", "Email", "Κατάσταση", "Συναίνεση", "Δημιουργήθηκε", "Έληξε", "Υπογραφή πελάτη", "Υπογραφή γραφείου", "Υπογραφή ασφαλιστικής", "Ολοκληρώθηκε" }, rows.Select(x => (IReadOnlyList<string>)new[] { x.Id.ToString(), x.CustomerFullNameSnapshot, x.CustomerEmailSnapshot ?? "", x.Status.ToString(), x.CustomerConsented?.ToString() ?? "", x.CreatedAt.ToString("yyyy-MM-dd HH:mm"), x.ExpiresAt.ToString("yyyy-MM-dd HH:mm"), x.CustomerSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.OfficeSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.InsurerSignedAt?.ToString("yyyy-MM-dd HH:mm") ?? "", x.CompletedAt?.ToString("yyyy-MM-dd HH:mm") ?? "" }).ToList(), TenantLabel: tenantId.ToString());
        if (format.Equals("csv", StringComparison.OrdinalIgnoreCase)) return File(ExportFormatter.BuildCsv(sheet), "text/csv", "gdpr-forms.csv");
        return File(ExportFormatter.BuildXlsx(sheet), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "gdpr-forms.xlsx");
    }

    [Authorize(Policy = "AgencyStaff")]
    [HttpGet("api/customer-form-signings/{id:guid}/document")]
    public async Task<IActionResult> Document(Guid id, CancellationToken ct)
    {
        var row = await _db.CustomerFormSignings.FirstOrDefaultAsync(x => x.TenantId == TenantId() && x.Id == id, ct);
        if (row?.FinalDocumentPath is null) return NotFound("Το έντυπο δεν έχει ολοκληρωθεί.");
        var stream = await _storage.DownloadAsync(row.FinalDocumentPath, ct);
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
        if (s.FormCode == "customer-needs")
            return Ok(new PublicFormDto(tenant?.Name ?? "Kalypsis", tenant?.LogoUrl, s.CustomerFullNameSnapshot, s.CustomerEmailSnapshot, link.RecipientRole.ToString(), "Έντυπο Αναγκών Πελάτη", s.ExpiresAt.ToString("O"), !link.UsedAt.HasValue && s.Status is not (CustomerFormSigningStatus.Completed or CustomerFormSigningStatus.Declined), policy?.PolicyNumber, "customer-needs"));
        return Ok(new PublicFormDto(tenant?.Name ?? "Kalypsis", tenant?.LogoUrl, s.CustomerFullNameSnapshot, s.CustomerEmailSnapshot, link.RecipientRole.ToString(), "Έντυπο ενημέρωσης και δήλωσης GDPR", s.ExpiresAt.ToString("O"), !link.UsedAt.HasValue && s.Status is not (CustomerFormSigningStatus.Completed or CustomerFormSigningStatus.Declined), policy?.PolicyNumber));
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
            var accepted = signing.FormCode == "customer-needs" || body.Consented;
            signing.CustomerConsented = accepted; signing.CustomerSignaturePath = path; signing.CustomerSignedAt = now;
            signing.Status = accepted ? CustomerFormSigningStatus.PendingCustomer : CustomerFormSigningStatus.Declined;
            if (signing.FormCode == "gdpr-consent")
                _db.ConsentRecords.Add(new ConsentRecord { TenantId = signing.TenantId, CustomerId = signing.CustomerId, Type = ConsentType.PrivacyNotice, Granted = accepted, GrantedAt = now, Method = ConsentMethod.OnlineForm, IpAddress = link.IpAddress, Version = signing.FormVersion, Notes = accepted ? "Ηλεκτρονική υπογραφή εντύπου GDPR" : "Ο πελάτης δεν συναινεί" });
            if (!accepted) signing.CompletedAt = now;
        }
        else if (link.RecipientRole == CustomerFormSigningRecipientRole.Office) { signing.OfficeSignaturePath = path; signing.OfficeSignedAt = now; }
        else { signing.InsurerSignaturePath = path; signing.InsurerSignedAt = now; }
        await _db.SaveChangesAsync(ct);
        if (link.RecipientRole == CustomerFormSigningRecipientRole.Customer && (signing.FormCode == "customer-needs" || body.Consented))
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
        return signing.FormCode == "customer-needs"
            ? CustomerNeedsPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature)
            : GdprConsentPdfRenderer.Render(tenant, signing, logo, customerSignature, officeSignature, insurerSignature);
    }

    private async Task<EmailResult> SendLinkAsync(CustomerFormSigning signing, CustomerFormSigningLink link, string token, string recipient, CancellationToken ct)
        => await SendFormLinkToAddressAsync(signing, link.Email, link.DisplayName, token, ct);

    private async Task<EmailResult> SendFormLinkToAddressAsync(CustomerFormSigning signing, string email, string displayName, string token, CancellationToken ct)
    {
        var origin = (_configuration["PUBLIC_ORIGIN"] ?? _configuration["PublicOrigin"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');
        var url = $"{origin}/sign/gdpr/{token}";
        var formTitle = signing.FormCode == "customer-needs" ? "Έντυπο Αναγκών Πελάτη" : "Έντυπο GDPR";
        var subject = $"{formTitle} για ηλεκτρονική υπογραφή";
        var body = $"<p>Καλησπέρα,</p><p>Παρακαλούμε ανοίξτε τον ασφαλή σύνδεσμο για να ελέγξετε και να υπογράψετε το <strong>{formTitle}</strong> του πελάτη <strong>{System.Net.WebUtility.HtmlEncode(signing.CustomerFullNameSnapshot)}</strong>.</p><p><a href=\"{url}\">Άνοιγμα εντύπου και υπογραφή</a></p><p>Ο σύνδεσμος λήγει στις {signing.ExpiresAt.ToLocalTime():dd/MM/yyyy HH:mm}.</p>";
        return await _email.SendAsync(new EmailMessage(email, displayName, subject, body, $"Άνοιγμα {formTitle}: {url}", AllowCustomerRecipient: true), ct);
    }

    private async Task<EmailResult> SendLinkToAddressAsync(CustomerFormSigning signing, string email, string displayName, string token, CancellationToken ct)
    {
        var origin = (_configuration["PUBLIC_ORIGIN"] ?? _configuration["PublicOrigin"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');
        var url = $"{origin}/sign/gdpr/{token}";
        var subject = "Έντυπο GDPR για ηλεκτρονική υπογραφή";
        var body = $"<p>Καλησπέρα,</p><p>Παρακαλούμε ανοίξτε τον ασφαλή σύνδεσμο για να υπογράψετε το έντυπο GDPR του πελάτη <strong>{System.Net.WebUtility.HtmlEncode(signing.CustomerFullNameSnapshot)}</strong>.</p><p><a href=\"{url}\">Άνοιγμα εντύπου και υπογραφή</a></p><p>Ο σύνδεσμος λήγει στις {signing.ExpiresAt.ToLocalTime():dd/MM/yyyy HH:mm}.</p>";
        return await _email.SendAsync(new EmailMessage(email, displayName, subject, body, $"Άνοιγμα εντύπου: {url}", AllowCustomerRecipient: true), ct);
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
            : value.Equals("customer-needs", StringComparison.OrdinalIgnoreCase) ? "customer-needs" : null;

    private static Dictionary<string, string?> BuildFormData(Customer customer, Tenant office, Policy? policy, Dictionary<string, string?>? submitted)
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
        return data;
    }

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
        var header = value[..comma]; if (!header.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase)) return null;
        try { var bytes = Convert.FromBase64String(value[(comma + 1)..]); return bytes.Length is > 50 and < 2_000_000 ? bytes : null; } catch { return null; }
    }
}
