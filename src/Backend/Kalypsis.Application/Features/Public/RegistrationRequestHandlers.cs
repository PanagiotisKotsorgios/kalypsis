using System.Net;
using System.Text;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

public record RegistrationRequestDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? VatNumber,
    string? LicenseNumber,
    string? City,
    string? Message,
    string ReferenceCode,
    string Status,
    string? ReviewNotes,
    DateTime? ReviewedAt,
    string? IpAddress,
    DateTime SubmittedAt,
    // Producer-match hint surfaced to the SuperAdmin UI. When
    // MatchedProducerTenantName is non-null, the applicant's email
    // matches a Producer row inside an existing tenant — approving
    // as "producer mode" attaches them there instead of creating a
    // new γραφείο. See ApproveRegistrationRequestCommand.Mode.
    Guid? MatchedProducerId,
    Guid? MatchedProducerTenantId,
    string? MatchedProducerTenantName
);

public record RegistrationRequestSummaryDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? City,
    string ReferenceCode,
    string Status,
    DateTime SubmittedAt
);

public record RegistrationRequestStatsDto(int Total, int New, int Reviewing, int Approved, int Rejected);

/* ========================================================================
 * Public — anonymous submission from the /register form.
 * ====================================================================== */

public record SubmitRegistrationRequestCommand(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? VatNumber,
    string? LicenseNumber,
    string? City,
    string? Message,
    string? IpAddress,
    string? UserAgent,
    bool DpaAccepted,
    string? DpaVersion
) : IRequest<RegistrationRequestDto>;

public class SubmitRegistrationRequestCommandValidator : AbstractValidator<SubmitRegistrationRequestCommand>
{
    public SubmitRegistrationRequestCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(50);
        When(x => !string.IsNullOrWhiteSpace(x.OrganizationName), () =>
            RuleFor(x => x.OrganizationName!).MaximumLength(200));
        When(x => !string.IsNullOrWhiteSpace(x.VatNumber), () =>
            RuleFor(x => x.VatNumber!).MaximumLength(20));
        When(x => !string.IsNullOrWhiteSpace(x.LicenseNumber), () =>
            RuleFor(x => x.LicenseNumber!).MaximumLength(60));
        When(x => !string.IsNullOrWhiteSpace(x.City), () =>
            RuleFor(x => x.City!).MaximumLength(120));
        When(x => !string.IsNullOrWhiteSpace(x.Message), () =>
            RuleFor(x => x.Message!).MaximumLength(2000));
        // GDPR Άρθρο 28 — η αποδοχή του DPA είναι αδιαπραγμάτευτη για να μπορέσουμε
        // να επεξεργαστούμε δεδομένα πελατών του γραφείου νόμιμα.
        RuleFor(x => x.DpaAccepted).Equal(true)
            .WithMessage("Απαιτείται αποδοχή της Σύμβασης Επεξεργασίας Προσωπικών Δεδομένων (DPA).");
        RuleFor(x => x.DpaVersion).NotEmpty().MaximumLength(20)
            .WithMessage("Λείπει η έκδοση του αποδεκτού DPA.");
    }
}

public class SubmitRegistrationRequestCommandHandler
    : IRequestHandler<SubmitRegistrationRequestCommand, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    public SubmitRegistrationRequestCommandHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestDto> Handle(SubmitRegistrationRequestCommand r, CancellationToken ct)
    {
        // KLP-XXXXXX. Loop with a hard cap so we don't spin forever if the RNG
        // unluckily collides with an already-issued code.
        string code = string.Empty;
        for (var i = 0; i < 8; i++)
        {
            var candidate = "KLP-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
            var exists = await _db.RegistrationRequests.AnyAsync(x => x.ReferenceCode == candidate, ct);
            if (!exists) { code = candidate; break; }
        }
        if (string.IsNullOrEmpty(code))
            code = "KLP-" + DateTime.UtcNow.Ticks.ToString()[^6..];

        var email = r.Email.Trim().ToLowerInvariant();

        // Producer-match detection. If an agency added this email as a
        // Producer before the person clicked "Register", we stamp the
        // match on the request so the SuperAdmin can approve them as a
        // Producer under the existing tenant instead of provisioning a
        // brand-new γραφείο. Only picks up the FIRST active match — if
        // the same email is a producer in multiple tenants (rare) the
        // SuperAdmin sees the first one and can pick manually.
        var match = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null && p.Email != null && p.Email.ToLower() == email)
            .Select(p => new { p.Id, p.TenantId })
            .FirstOrDefaultAsync(ct);
        string? matchedTenantName = null;
        if (match is not null)
        {
            matchedTenantName = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.Id == match.TenantId && t.DeletedAt == null)
                .Select(t => t.Name).FirstOrDefaultAsync(ct);
        }

        var rec = new RegistrationRequest
        {
            Id = Guid.NewGuid(),
            FirstName = r.FirstName.Trim(),
            LastName  = r.LastName.Trim(),
            Email     = email,
            Phone     = r.Phone.Trim(),
            OrganizationName = string.IsNullOrWhiteSpace(r.OrganizationName) ? null : r.OrganizationName.Trim(),
            VatNumber        = string.IsNullOrWhiteSpace(r.VatNumber)        ? null : r.VatNumber.Trim(),
            LicenseNumber    = string.IsNullOrWhiteSpace(r.LicenseNumber)    ? null : r.LicenseNumber.Trim(),
            City             = string.IsNullOrWhiteSpace(r.City)             ? null : r.City.Trim(),
            Message          = string.IsNullOrWhiteSpace(r.Message)          ? null : r.Message.Trim(),
            ReferenceCode    = code,
            Status           = RegistrationRequestStatus.New,
            IpAddress        = string.IsNullOrWhiteSpace(r.IpAddress) ? null : r.IpAddress,
            UserAgent        = string.IsNullOrWhiteSpace(r.UserAgent) ? null : r.UserAgent,
            DpaAccepted      = r.DpaAccepted,
            DpaVersion       = string.IsNullOrWhiteSpace(r.DpaVersion) ? null : r.DpaVersion.Trim(),
            DpaAcceptedAt    = r.DpaAccepted ? DateTime.UtcNow : (DateTime?)null,
            MatchedProducerId       = match?.Id,
            MatchedProducerTenantId = match?.TenantId,
            MatchedProducerTenantName = matchedTenantName,
        };
        _db.RegistrationRequests.Add(rec);
        await _db.SaveChangesAsync(ct);
        return RegistrationRequestMapper.Map(rec);
    }
}

/* ========================================================================
 * Superadmin — list, get, update status.
 * ====================================================================== */

public record ListRegistrationRequestsQuery(string? Status, string? Search)
    : IRequest<IReadOnlyList<RegistrationRequestSummaryDto>>;

public class ListRegistrationRequestsQueryHandler
    : IRequestHandler<ListRegistrationRequestsQuery, IReadOnlyList<RegistrationRequestSummaryDto>>
{
    private readonly IAppDbContext _db;
    public ListRegistrationRequestsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<RegistrationRequestSummaryDto>> Handle(
        ListRegistrationRequestsQuery r, CancellationToken ct)
    {
        var q = _db.RegistrationRequests.Where(x => x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(r.Status)
            && Enum.TryParse<RegistrationRequestStatus>(r.Status, true, out var st))
        {
            q = q.Where(x => x.Status == st);
        }
        if (!string.IsNullOrWhiteSpace(r.Search))
        {
            var s = r.Search.Trim().ToLower();
            q = q.Where(x =>
                EF.Functions.Like(x.Email.ToLower(),     $"%{s}%") ||
                EF.Functions.Like(x.FirstName.ToLower(), $"%{s}%") ||
                EF.Functions.Like(x.LastName.ToLower(),  $"%{s}%") ||
                EF.Functions.Like(x.ReferenceCode.ToLower(), $"%{s}%") ||
                (x.OrganizationName != null && EF.Functions.Like(x.OrganizationName.ToLower(), $"%{s}%")));
        }
        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(x => new RegistrationRequestSummaryDto(
            x.Id, x.FirstName, x.LastName, x.Email, x.Phone,
            x.OrganizationName, x.City, x.ReferenceCode, x.Status.ToString(), x.CreatedAt
        )).ToList();
    }
}

public record GetRegistrationRequestQuery(Guid Id) : IRequest<RegistrationRequestDto>;

public class GetRegistrationRequestQueryHandler
    : IRequestHandler<GetRegistrationRequestQuery, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    public GetRegistrationRequestQueryHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestDto> Handle(GetRegistrationRequestQuery r, CancellationToken ct)
    {
        var rec = await _db.RegistrationRequests
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("RegistrationRequest");
        return RegistrationRequestMapper.Map(rec);
    }
}

public record GetRegistrationRequestStatsQuery() : IRequest<RegistrationRequestStatsDto>;

public class GetRegistrationRequestStatsQueryHandler
    : IRequestHandler<GetRegistrationRequestStatsQuery, RegistrationRequestStatsDto>
{
    private readonly IAppDbContext _db;
    public GetRegistrationRequestStatsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestStatsDto> Handle(GetRegistrationRequestStatsQuery _, CancellationToken ct)
    {
        var rows = await _db.RegistrationRequests
            .Where(x => x.DeletedAt == null)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int by(RegistrationRequestStatus s) => rows.FirstOrDefault(r => r.Status == s)?.Count ?? 0;
        var total = rows.Sum(r => r.Count);
        return new RegistrationRequestStatsDto(
            total,
            by(RegistrationRequestStatus.New),
            by(RegistrationRequestStatus.Reviewing),
            by(RegistrationRequestStatus.Approved),
            by(RegistrationRequestStatus.Rejected));
    }
}

public record UpdateRegistrationRequestStatusCommand(Guid Id, string Status, string? ReviewNotes)
    : IRequest<RegistrationRequestDto>;

public class UpdateRegistrationRequestStatusCommandValidator
    : AbstractValidator<UpdateRegistrationRequestStatusCommand>
{
    public UpdateRegistrationRequestStatusCommandValidator()
    {
        RuleFor(x => x.Status).NotEmpty()
            .Must(s => Enum.TryParse<RegistrationRequestStatus>(s, true, out _))
            .WithMessage("Invalid status. Use New / Reviewing / Approved / Rejected.");
        When(x => !string.IsNullOrWhiteSpace(x.ReviewNotes), () =>
            RuleFor(x => x.ReviewNotes!).MaximumLength(2000));
    }
}

public class UpdateRegistrationRequestStatusCommandHandler
    : IRequestHandler<UpdateRegistrationRequestStatusCommand, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public UpdateRegistrationRequestStatusCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<RegistrationRequestDto> Handle(UpdateRegistrationRequestStatusCommand r, CancellationToken ct)
    {
        var rec = await _db.RegistrationRequests
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("RegistrationRequest");

        var next = Enum.Parse<RegistrationRequestStatus>(r.Status, true);
        rec.Status = next;
        rec.ReviewNotes = string.IsNullOrWhiteSpace(r.ReviewNotes) ? null : r.ReviewNotes.Trim();
        // Stamp reviewer only for terminal/working states, not when reset to New.
        if (next != RegistrationRequestStatus.New)
        {
            rec.ReviewedAt = DateTime.UtcNow;
            rec.ReviewedByUserId = _currentUser.UserId;
        }
        else
        {
            rec.ReviewedAt = null;
            rec.ReviewedByUserId = null;
        }
        await _db.SaveChangesAsync(ct);
        return RegistrationRequestMapper.Map(rec);
    }
}

internal static class RegistrationRequestMapper
{
    public static RegistrationRequestDto Map(RegistrationRequest r) => new(
        r.Id, r.FirstName, r.LastName, r.Email, r.Phone,
        r.OrganizationName, r.VatNumber, r.LicenseNumber, r.City, r.Message,
        r.ReferenceCode, r.Status.ToString(), r.ReviewNotes, r.ReviewedAt,
        r.IpAddress, r.CreatedAt,
        r.MatchedProducerId, r.MatchedProducerTenantId, r.MatchedProducerTenantName
    );
}

/* ========================================================================
 * Superadmin — approve a request and provision the agency.
 *
 * This is the heavy operation: it creates a Tenant + AgencyAdmin User from
 * the application data, hashes the password the superadmin chose, marks
 * the request as Approved, and optionally fires a welcome email through
 * IEmailSender so the new admin gets their credentials.
 * ====================================================================== */

public record ApproveRegistrationRequestResult(
    RegistrationRequestDto Request,
    Guid TenantId,
    string TenantCode,
    Guid UserId,
    bool EmailSent,
    string? EmailError
);

public record ApproveRegistrationRequestCommand(
    Guid Id,
    string Password,
    bool SendWelcomeEmail,
    // Provisioning mode. Defaults to "agency" (create new tenant +
    // AgencyAdmin user — original behaviour). Set to "producer" when
    // the request has a MatchedProducerId and the SuperAdmin agrees
    // to just create a Producer user under the existing tenant — no
    // new γραφείο, no duplicate data. Client picks based on the
    // matched-producer hint that /list surfaces.
    string? Mode = null
) : IRequest<ApproveRegistrationRequestResult>;

public class ApproveRegistrationRequestCommandValidator : AbstractValidator<ApproveRegistrationRequestCommand>
{
    public ApproveRegistrationRequestCommandValidator()
    {
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
    }
}

public class ApproveRegistrationRequestCommandHandler
    : IRequestHandler<ApproveRegistrationRequestCommand, ApproveRegistrationRequestResult>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IEmailSender _email;
    private readonly ICurrentUser _currentUser;
    private readonly IPackageService _packages;

    public ApproveRegistrationRequestCommandHandler(
        IAppDbContext db, IPasswordHasher hasher, IEmailSender email,
        ICurrentUser currentUser, IPackageService packages)
    {
        _db = db;
        _hasher = hasher;
        _email = email;
        _currentUser = currentUser;
        _packages = packages;
    }

    public async Task<ApproveRegistrationRequestResult> Handle(
        ApproveRegistrationRequestCommand r, CancellationToken ct)
    {
        var rec = await _db.RegistrationRequests
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("RegistrationRequest");

        if (rec.Status == RegistrationRequestStatus.Approved)
            throw new AppException("registration_already_approved",
                "Η αίτηση έχει ήδη εγκριθεί.", 409,
                title: "Ήδη εγκεκριμένη αίτηση",
                why: "Αυτή η αίτηση εγγραφής έχει ήδη μετατραπεί σε ενεργό γραφείο. Δεν μπορούμε να την επεξεργαστούμε ξανά.",
                fix: "Δείτε το γραφείο στη λίστα Tenants ή απορρίψτε την αίτηση αν δεν είναι πλέον σχετική.",
                fixLink: "/app/tenants");

        var email = rec.Email.Trim().ToLowerInvariant();
        var emailTaken = await _db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.Email == email && u.DeletedAt == null, ct);
        if (emailTaken)
            throw new AppException("admin_email_taken",
                $"Το email '{email}' χρησιμοποιείται ήδη.", 409,
                title: "Email σε χρήση",
                why: $"Ένας χρήστης με email {email} υπάρχει ήδη στην πλατφόρμα. Δεν μπορούμε να δημιουργήσουμε νέο λογαριασμό με το ίδιο email.",
                fix: "Ζητήστε από τον αιτούντα ένα διαφορετικό email, ή απορρίψτε την αίτηση.",
                fixLink: "/app/all-users");

        // ── Producer-mode branch ────────────────────────────────
        // When the registration was flagged as matching an existing
        // Producer AND the SuperAdmin picked "producer" mode, we skip
        // tenant creation entirely and just onboard a Producer user
        // under the matched tenant. That's the "agency added the
        // producer by email first, now the producer is signing up"
        // flow the user asked for.
        if (string.Equals(r.Mode, "producer", StringComparison.OrdinalIgnoreCase))
        {
            if (rec.MatchedProducerTenantId is not Guid producerTenantId)
                throw new AppException("producer_mode_no_match",
                    "Δεν βρέθηκε συνδεδεμένος συνεργάτης για producer-mode. Επιλέξτε agency-mode.", 400);
            var producerTenant = await _db.Tenants.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == producerTenantId && t.DeletedAt == null, ct)
                ?? throw AppException.NotFound("Matched tenant");

            var producerUser = new User
            {
                Id = Guid.NewGuid(),
                TenantId = producerTenant.Id,
                Email = email,
                PasswordHash = _hasher.Hash(r.Password),
                FirstName = rec.FirstName.Trim(),
                LastName = rec.LastName.Trim(),
                Phone = rec.Phone,
                Role = Role.Producer,     // NOT AgencyAdmin — scoped to their own book
                IsActive = true,
                PreferredLanguage = "el",
                ProducerId = rec.MatchedProducerId,   // link back to the Producer row
            };
            _db.Users.Add(producerUser);
            rec.Status = RegistrationRequestStatus.Approved;
            rec.ReviewedAt = DateTime.UtcNow;
            rec.ReviewedByUserId = _currentUser.UserId;
            var stampP = $"Provisioned as PRODUCER under tenant={producerTenant.Code} " +
                         $"({producerTenant.Id}) linked to Producer={rec.MatchedProducerId}. user={producerUser.Id}";
            rec.ReviewNotes = string.IsNullOrWhiteSpace(rec.ReviewNotes) ? stampP : $"{rec.ReviewNotes}\n{stampP}";
            await _db.SaveChangesAsync(ct);

            return new ApproveRegistrationRequestResult(
                RegistrationRequestMapper.Map(rec),
                producerTenant.Id, producerTenant.Code, producerUser.Id,
                EmailSent: false, EmailError: "Producer-mode: welcome email skipped by design.");
        }

        // ── Agency-mode (default, original behaviour) ─────────────
        // Tenant code — derived from organization name (or last name fallback),
        // ascii-fied to A–Z0–9, uppercased. Suffix with -2, -3, … on collision.
        var seed = !string.IsNullOrWhiteSpace(rec.OrganizationName) ? rec.OrganizationName! : rec.LastName;
        var code = await BuildUniqueTenantCodeAsync(seed, ct);

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = string.IsNullOrWhiteSpace(rec.OrganizationName)
                ? $"{rec.FirstName} {rec.LastName}".Trim()
                : rec.OrganizationName!.Trim(),
            Code = code,
            IsActive = true,
            SubscriptionPlan = SubscriptionPlan.Trial,
            ContactEmail = email,
            ContactPhone = rec.Phone,
            VatNumber = rec.VatNumber
        };
        _db.Tenants.Add(tenant);

        var admin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = email,
            PasswordHash = _hasher.Hash(r.Password),
            FirstName = rec.FirstName.Trim(),
            LastName = rec.LastName.Trim(),
            Phone = rec.Phone,
            Role = Role.AgencyAdmin,
            IsActive = true,
            PreferredLanguage = "el"
        };
        _db.Users.Add(admin);

        rec.Status = RegistrationRequestStatus.Approved;
        rec.ReviewedAt = DateTime.UtcNow;
        rec.ReviewedByUserId = _currentUser.UserId;
        // Stamp the provisioning result in ReviewNotes so it's traceable
        // without adding new columns to the registration request table.
        var stamp = $"Provisioned: tenant={tenant.Code} ({tenant.Id}), user={admin.Id}";
        rec.ReviewNotes = string.IsNullOrWhiteSpace(rec.ReviewNotes)
            ? stamp
            : $"{rec.ReviewNotes}\n{stamp}";

        await _db.SaveChangesAsync(ct);

        // Grant every package to the fresh γραφείο so the AgencyAdmin's
        // first login has a working sidebar (BackOffice/FrontOffice/Crm/
        // Intelligence/Integrations items are all package-gated). Without
        // this the operator sees only Dashboard + Ermes + Docs and thinks
        // the app is broken. Superadmin can revoke individually later from
        // /app/tenants/{id}.
        await _packages.GrantAllDefaultsAsync(tenant.Id, _currentUser.UserId, ct);

        // Welcome email is fire-and-forget for the request — if Brevo is down
        // we still want the user provisioned. We surface any error to the UI
        // so the superadmin can resend manually instead of failing the whole
        // approve action.
        bool emailSent = false;
        string? emailError = null;
        if (r.SendWelcomeEmail)
        {
            try
            {
                var msg = BuildWelcomeEmail(rec, tenant, r.Password);
                var result = await _email.SendAsync(msg, ct);
                emailSent = result.Success;
                if (!result.Success) emailError = result.ErrorMessage;
            }
            catch (Exception ex)
            {
                emailError = ex.Message;
            }
        }

        return new ApproveRegistrationRequestResult(
            RegistrationRequestMapper.Map(rec),
            tenant.Id, tenant.Code, admin.Id, emailSent, emailError);
    }

    private async Task<string> BuildUniqueTenantCodeAsync(string seed, CancellationToken ct)
    {
        var ascii = new StringBuilder();
        foreach (var ch in (seed ?? string.Empty).ToUpperInvariant())
        {
            if (ch is >= 'A' and <= 'Z' or >= '0' and <= '9') ascii.Append(ch);
        }
        var baseCode = ascii.Length == 0 ? "AGENCY" : ascii.ToString();
        if (baseCode.Length > 20) baseCode = baseCode[..20];

        var candidate = baseCode;
        var suffix = 2;
        while (await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Code == candidate, ct))
        {
            candidate = $"{baseCode}-{suffix++}";
            if (suffix > 999) throw new InvalidOperationException("Failed to derive a unique tenant code.");
        }
        return candidate;
    }

    private static EmailMessage BuildWelcomeEmail(RegistrationRequest rec, Tenant tenant, string password)
    {
        var displayName = $"{rec.FirstName} {rec.LastName}".Trim();
        var encEmail    = WebUtility.HtmlEncode(rec.Email);
        var encPassword = WebUtility.HtmlEncode(password);
        var encTenant   = WebUtility.HtmlEncode(tenant.Name);
        var encCode     = WebUtility.HtmlEncode(tenant.Code);
        var encName     = WebUtility.HtmlEncode(displayName);

        var html = $@"<!doctype html>
<html lang=""el"">
<head><meta charset=""utf-8""></head>
<body style=""font-family:Inter,Segoe UI,Arial,sans-serif;background:#fafbfc;margin:0;padding:32px;color:#0b2545;"">
  <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" style=""max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e9ef;border-radius:12px;overflow:hidden"">
    <tr><td style=""padding:32px 32px 8px"">
      <h1 style=""font-size:24px;font-weight:800;margin:0 0 12px;letter-spacing:-0.01em"">Καλώς ήρθατε στην Kalypsis</h1>
      <p style=""font-size:15px;line-height:1.6;color:#3d4f6b;margin:0 0 16px"">
        {encName}, ο λογαριασμός σας για το γραφείο <strong>{encTenant}</strong> έχει ενεργοποιηθεί.
      </p>
    </td></tr>
    <tr><td style=""padding:0 32px 16px"">
      <div style=""background:#fafbfc;border:1px solid #e5e9ef;border-radius:8px;padding:20px"">
        <p style=""font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#3d4f6b;margin:0 0 12px"">Στοιχεία πρόσβασης</p>
        <p style=""margin:6px 0;font-size:14px""><strong>Email:</strong> <span style=""font-family:Consolas,monospace"">{encEmail}</span></p>
        <p style=""margin:6px 0;font-size:14px""><strong>Προσωρινός κωδικός:</strong> <span style=""font-family:Consolas,monospace"">{encPassword}</span></p>
        <p style=""margin:6px 0;font-size:14px""><strong>Κωδικός γραφείου:</strong> <span style=""font-family:Consolas,monospace"">{encCode}</span></p>
      </div>
    </td></tr>
    <tr><td style=""padding:8px 32px 24px"">
      <p style=""font-size:14px;line-height:1.6;color:#3d4f6b;margin:0 0 16px"">
        Συνδεθείτε στη <a href=""https://www.mykalypsis.gr/login"" style=""color:#1f7bb3;font-weight:600;text-decoration:none"">www.mykalypsis.gr</a> με τα παραπάνω στοιχεία. Συστήνουμε να αλλάξετε τον κωδικό σας από το προφίλ σας μόλις συνδεθείτε.
      </p>
      <p style=""font-size:13px;line-height:1.6;color:#3d4f6b;margin:0"">
        Αν έχετε ερωτήσεις, απαντήστε σε αυτό το email ή καλέστε μας στο 2631028971.
      </p>
    </td></tr>
    <tr><td style=""padding:16px 32px;border-top:1px solid #e5e9ef;font-size:12px;color:#3d4f6b"">
      © {DateTime.UtcNow.Year} Kalypsis — η ελληνική πλατφόρμα ασφαλιστικού γραφείου.
    </td></tr>
  </table>
</body>
</html>";

        var text = $@"Καλώς ήρθατε στην Kalypsis

{displayName}, ο λογαριασμός σας για το γραφείο {tenant.Name} έχει ενεργοποιηθεί.

Στοιχεία πρόσβασης
  Email: {rec.Email}
  Προσωρινός κωδικός: {password}
  Κωδικός γραφείου: {tenant.Code}

Συνδεθείτε στη https://www.mykalypsis.gr/login με τα παραπάνω στοιχεία. Συστήνουμε να αλλάξετε τον κωδικό σας μόλις συνδεθείτε.

Ερωτήσεις: απαντήστε σε αυτό το email ή καλέστε μας στο 2631028971.";

        return new EmailMessage(
            ToEmail:  rec.Email,
            ToName:   displayName,
            Subject:  "Καλώς ήρθατε στην Kalypsis — τα στοιχεία πρόσβασής σας",
            HtmlBody: html,
            TextBody: text);
    }
}
