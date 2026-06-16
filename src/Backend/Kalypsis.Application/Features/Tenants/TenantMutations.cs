using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Tenants;

public record UpdateTenantBody(string Name, SubscriptionPlan SubscriptionPlan, bool IsActive);

public record UpdateTenantCommand(Guid Id, UpdateTenantBody Body) : IRequest<TenantDto>;

public class UpdateTenantCommandValidator : AbstractValidator<UpdateTenantCommand>
{
    public UpdateTenantCommandValidator()
    {
        RuleFor(x => x.Body.Name).NotEmpty().MaximumLength(200);
    }
}

public class UpdateTenantCommandHandler : IRequestHandler<UpdateTenantCommand, TenantDto>
{
    private readonly IAppDbContext _db;
    public UpdateTenantCommandHandler(IAppDbContext db) => _db = db;

    public async Task<TenantDto> Handle(UpdateTenantCommand request, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        if (string.Equals(t.Code, "PLATFORM", StringComparison.OrdinalIgnoreCase))
            throw AppException.Forbidden("Δεν επιτρέπεται η επεξεργασία του τεχνικού tenant της πλατφόρμας.");

        t.Name = request.Body.Name.Trim();
        t.SubscriptionPlan = request.Body.SubscriptionPlan;
        t.IsActive = request.Body.IsActive;
        await _db.SaveChangesAsync(ct);

        var users = await _db.Users.IgnoreQueryFilters().CountAsync(u => u.TenantId == t.Id && u.DeletedAt == null, ct);
        var customers = await _db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == t.Id && c.DeletedAt == null, ct);
        return new TenantDto(t.Id, t.Name, t.Code, t.IsActive, t.SubscriptionPlan, t.CreatedAt, users, customers);
    }
}

public record DeleteTenantCommand(Guid Id) : IRequest<Unit>;

public class DeleteTenantCommandHandler : IRequestHandler<DeleteTenantCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteTenantCommandHandler(IAppDbContext db) => _db = db;

    public async Task<Unit> Handle(DeleteTenantCommand request, CancellationToken ct)
    {
        var t = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        if (string.Equals(t.Code, "PLATFORM", StringComparison.OrdinalIgnoreCase))
            throw AppException.Forbidden("Δεν επιτρέπεται η διαγραφή του τεχνικού tenant της πλατφόρμας.");

        // Cascade-soft-delete dependent entities so they vanish from tenant filters.
        var now = DateTime.UtcNow;
        t.DeletedAt = now; t.IsActive = false;
        await _db.Users.IgnoreQueryFilters().Where(u => u.TenantId == t.Id && u.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.DeletedAt, now).SetProperty(u => u.IsActive, false), ct);
        await _db.Customers.IgnoreQueryFilters().Where(c => c.TenantId == t.Id && c.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.DeletedAt, now), ct);
        await _db.Policies.IgnoreQueryFilters().Where(p => p.TenantId == t.Id && p.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.DeletedAt, now), ct);

        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
