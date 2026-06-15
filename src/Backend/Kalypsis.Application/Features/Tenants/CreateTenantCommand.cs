using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Tenants;

public record CreateTenantCommand(CreateTenantRequest Request) : IRequest<CreateTenantResponse>;

public class CreateTenantCommandValidator : AbstractValidator<CreateTenantCommand>
{
    public CreateTenantCommandValidator()
    {
        RuleFor(x => x.Request.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Request.Code).NotEmpty().MaximumLength(64).Matches("^[A-Za-z0-9_-]+$");
        RuleFor(x => x.Request.AdminEmail).NotEmpty().EmailAddress();
        RuleFor(x => x.Request.AdminFirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Request.AdminLastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Request.AdminPassword).NotEmpty().MinimumLength(8);
    }
}

public class CreateTenantCommandHandler : IRequestHandler<CreateTenantCommand, CreateTenantResponse>
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public CreateTenantCommandHandler(IAppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<CreateTenantResponse> Handle(CreateTenantCommand request, CancellationToken cancellationToken)
    {
        var r = request.Request;
        var code = r.Code.Trim().ToUpperInvariant();
        var email = r.AdminEmail.Trim().ToLowerInvariant();

        var codeExists = await _db.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Code == code, cancellationToken);
        if (codeExists) throw AppException.Conflict($"Ο κωδικός γραφείου '{code}' υπάρχει ήδη.");

        var emailExists = await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, cancellationToken);
        if (emailExists) throw AppException.Conflict($"Ο χρήστης με email '{email}' υπάρχει ήδη.");

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Name = r.Name.Trim(),
            Code = code,
            IsActive = true,
            SubscriptionPlan = r.SubscriptionPlan
        };
        _db.Tenants.Add(tenant);

        var admin = new User
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Email = email,
            PasswordHash = _hasher.Hash(r.AdminPassword),
            FirstName = r.AdminFirstName.Trim(),
            LastName = r.AdminLastName.Trim(),
            Phone = r.AdminPhone?.Trim(),
            Role = Role.AgencyAdmin,
            IsActive = true,
            PreferredLanguage = "el"
        };
        _db.Users.Add(admin);

        await _db.SaveChangesAsync(cancellationToken);

        var dto = new TenantDto(tenant.Id, tenant.Name, tenant.Code, tenant.IsActive, tenant.SubscriptionPlan, tenant.CreatedAt, 1, 0);
        return new CreateTenantResponse(dto, admin.Id, admin.Email);
    }
}
