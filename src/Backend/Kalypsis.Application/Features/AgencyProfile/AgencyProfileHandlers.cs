using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.AgencyProfile;

public record AgencyProfileDto(
    Guid TenantId,
    string Name,
    string Code,
    SubscriptionPlan SubscriptionPlan,
    string? LogoUrl,
    string? BrandColorHex,
    string? ContactEmail,
    string? ContactPhone,
    string? AddressLine,
    string? VatNumber,
    string DefaultCurrency,
    int DefaultPolicyDurationMonths);

public record UpdateAgencyProfileBody(
    string Name,
    string? LogoUrl,
    string? BrandColorHex,
    string? ContactEmail,
    string? ContactPhone,
    string? AddressLine,
    string? VatNumber,
    string DefaultCurrency,
    int DefaultPolicyDurationMonths);

public record GetMyAgencyProfileQuery() : IRequest<AgencyProfileDto>;

public class GetMyAgencyProfileQueryHandler : IRequestHandler<GetMyAgencyProfileQuery, AgencyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetMyAgencyProfileQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<AgencyProfileDto> Handle(GetMyAgencyProfileQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");
        return new AgencyProfileDto(
            t.Id, t.Name, t.Code, t.SubscriptionPlan,
            t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone,
            t.AddressLine, t.VatNumber, t.DefaultCurrency, t.DefaultPolicyDurationMonths);
    }
}

public record UpdateMyAgencyProfileCommand(UpdateAgencyProfileBody Body) : IRequest<AgencyProfileDto>;

public class UpdateMyAgencyProfileCommandValidator : AbstractValidator<UpdateMyAgencyProfileCommand>
{
    public UpdateMyAgencyProfileCommandValidator()
    {
        RuleFor(x => x.Body.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Body.DefaultCurrency).NotEmpty().Length(3);
        RuleFor(x => x.Body.DefaultPolicyDurationMonths).InclusiveBetween(1, 60);
        When(x => !string.IsNullOrWhiteSpace(x.Body.BrandColorHex), () =>
            RuleFor(x => x.Body.BrandColorHex!).Matches(@"^#?[0-9A-Fa-f]{6}$"));
        When(x => !string.IsNullOrWhiteSpace(x.Body.ContactEmail), () =>
            RuleFor(x => x.Body.ContactEmail!).EmailAddress());
    }
}

public class UpdateMyAgencyProfileCommandHandler : IRequestHandler<UpdateMyAgencyProfileCommand, AgencyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateMyAgencyProfileCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<AgencyProfileDto> Handle(UpdateMyAgencyProfileCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var b = request.Body;
        t.Name = b.Name.Trim();
        t.LogoUrl = string.IsNullOrWhiteSpace(b.LogoUrl) ? null : b.LogoUrl.Trim();
        t.BrandColorHex = string.IsNullOrWhiteSpace(b.BrandColorHex) ? null : Normalise(b.BrandColorHex);
        t.ContactEmail = string.IsNullOrWhiteSpace(b.ContactEmail) ? null : b.ContactEmail.Trim().ToLowerInvariant();
        t.ContactPhone = string.IsNullOrWhiteSpace(b.ContactPhone) ? null : b.ContactPhone.Trim();
        t.AddressLine = string.IsNullOrWhiteSpace(b.AddressLine) ? null : b.AddressLine.Trim();
        t.VatNumber = string.IsNullOrWhiteSpace(b.VatNumber) ? null : b.VatNumber.Trim();
        t.DefaultCurrency = b.DefaultCurrency.Trim().ToUpperInvariant();
        t.DefaultPolicyDurationMonths = b.DefaultPolicyDurationMonths;
        await _db.SaveChangesAsync(ct);

        return new AgencyProfileDto(
            t.Id, t.Name, t.Code, t.SubscriptionPlan,
            t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone,
            t.AddressLine, t.VatNumber, t.DefaultCurrency, t.DefaultPolicyDurationMonths);
    }

    private static string Normalise(string color)
    {
        var c = color.Trim();
        return c.StartsWith("#") ? c.ToUpperInvariant() : "#" + c.ToUpperInvariant();
    }
}

/* ========= Logo upload / download ========= */

public record UploadAgencyLogoCommand(
    string FileName,
    string ContentType,
    long SizeBytes,
    Stream Content) : IRequest<AgencyProfileDto>;

public class UploadAgencyLogoCommandHandler : IRequestHandler<UploadAgencyLogoCommand, AgencyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _gate;
    private readonly ICurrentUser _current;

    public UploadAgencyLogoCommandHandler(IAppDbContext db, IFileStorage storage, FileUploadGate gate, ICurrentUser current)
    {
        _db = db; _storage = storage; _gate = gate; _current = current;
    }

    public async Task<AgencyProfileDto> Handle(UploadAgencyLogoCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        if (request.SizeBytes <= 0)
            throw new AppException("logo_empty",
                "Empty file.", 400,
                title: "Κενό αρχείο",
                why: "Το αρχείο λογότυπου που ανεβάσατε έχει μηδενικό μέγεθος. Πιθανώς διακόπηκε το upload ή το αρχείο είναι κατεστραμμένο.",
                fix: "Επιλέξτε ξανά το αρχείο από τον υπολογιστή σας και βεβαιωθείτε ότι ανοίγει κανονικά πριν το ανεβάσετε.");

        if (request.SizeBytes > 4_000_000)
            throw new AppException("logo_too_large",
                "Max logo size is 4 MB.", 400,
                title: "Λογότυπο υπερβολικά μεγάλο",
                why: $"Ανεβάσατε αρχείο {request.SizeBytes / 1024} KB. Το όριο είναι 4 MB ώστε να φορτώνει γρήγορα παντού στο εκτυπώσιμα παραστατικά και emails.",
                fix: "Μειώστε το μέγεθος του αρχείου σε εργαλείο όπως tinypng.com ή εξάγετέ το ξανά σε μικρότερη ανάλυση (συνιστάται 512×512 PNG).");

        // Magic-byte + extension + AV pipeline. Replaces the loose content-type
        // sniff that came before — a renamed .exe won't pass this gate.
        var safeType = await _gate.InspectAsync(
            request.FileName, request.ContentType, request.SizeBytes, request.Content,
            FileUploadKind.Image, maxBytes: 4_000_000, ct: ct);

        var oldPath = t.LogoUrl;
        var key = $"branding/{tenantId}";
        var path = await _storage.UploadAsync(key, request.FileName, safeType, request.Content, ct);
        t.LogoUrl = path;
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(oldPath) && oldPath != path)
        {
            try { await _storage.DeleteAsync(oldPath, ct); } catch { /* best effort */ }
        }

        return new AgencyProfileDto(
            t.Id, t.Name, t.Code, t.SubscriptionPlan,
            t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone,
            t.AddressLine, t.VatNumber, t.DefaultCurrency, t.DefaultPolicyDurationMonths);
    }
}

public record GetMyAgencyLogoQuery() : IRequest<(Stream Stream, string FileName, string MimeType)?>;

public class GetMyAgencyLogoQueryHandler : IRequestHandler<GetMyAgencyLogoQuery, (Stream Stream, string FileName, string MimeType)?>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public GetMyAgencyLogoQueryHandler(IAppDbContext db, IFileStorage storage, ICurrentUser current)
    {
        _db = db; _storage = storage; _current = current;
    }

    public async Task<(Stream Stream, string FileName, string MimeType)?> Handle(GetMyAgencyLogoQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct);
        if (t is null || string.IsNullOrWhiteSpace(t.LogoUrl)) return null;
        if (t.LogoUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return null;
        // Legacy frontend asset paths (e.g. "/static/kalypsis-logo.jpg") aren't in
        // our storage root — treat them as "no logo" rather than blowing up.
        if (t.LogoUrl.StartsWith("/static/", StringComparison.OrdinalIgnoreCase)) return null;

        Stream stream;
        try
        {
            stream = await _storage.DownloadAsync(t.LogoUrl, ct);
        }
        catch (FileNotFoundException) { return null; }
        catch (DirectoryNotFoundException) { return null; }
        catch (InvalidOperationException) { return null; }

        var fileName = Path.GetFileName(t.LogoUrl);
        var mime = GuessMime(fileName);
        return (stream, fileName, mime);
    }

    private static string GuessMime(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".svg" => "image/svg+xml",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }
}

public record DeleteMyAgencyLogoCommand() : IRequest<AgencyProfileDto>;

public class DeleteMyAgencyLogoCommandHandler : IRequestHandler<DeleteMyAgencyLogoCommand, AgencyProfileDto>
{
    private readonly IAppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly ICurrentUser _current;

    public DeleteMyAgencyLogoCommandHandler(IAppDbContext db, IFileStorage storage, ICurrentUser current)
    {
        _db = db; _storage = storage; _current = current;
    }

    public async Task<AgencyProfileDto> Handle(DeleteMyAgencyLogoCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var t = await _db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == tenantId, ct)
            ?? throw AppException.NotFound("Tenant");

        var old = t.LogoUrl;
        t.LogoUrl = null;
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(old) && !old.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            try { await _storage.DeleteAsync(old, ct); } catch { /* best effort */ }
        }

        return new AgencyProfileDto(
            t.Id, t.Name, t.Code, t.SubscriptionPlan,
            t.LogoUrl, t.BrandColorHex, t.ContactEmail, t.ContactPhone,
            t.AddressLine, t.VatNumber, t.DefaultCurrency, t.DefaultPolicyDurationMonths);
    }
}
