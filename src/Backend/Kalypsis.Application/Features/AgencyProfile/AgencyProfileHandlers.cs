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
