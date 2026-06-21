using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Consents;

public record ConsentDto(
    Guid Id,
    Guid CustomerId,
    ConsentType Type,
    bool Granted,
    DateTime GrantedAt,
    DateTime? RevokedAt,
    ConsentMethod Method,
    string? Version);

public record GrantConsentBody(ConsentType Type, ConsentMethod Method, string? Version);
public record RevokeConsentBody(ConsentType Type, string? Reason);

/* ============= List for customer ============= */

public record ListCustomerConsentsQuery(Guid CustomerId) : IRequest<IReadOnlyList<ConsentDto>>;

public class ListCustomerConsentsHandler : IRequestHandler<ListCustomerConsentsQuery, IReadOnlyList<ConsentDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListCustomerConsentsHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ConsentDto>> Handle(ListCustomerConsentsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        return await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId && c.DeletedAt == null)
            .OrderByDescending(c => c.GrantedAt)
            .Select(c => new ConsentDto(c.Id, c.CustomerId, c.Type, c.Granted, c.GrantedAt, c.RevokedAt, c.Method, c.Version))
            .ToListAsync(ct);
    }
}

/* ============= Grant ============= */

public record GrantConsentCommand(Guid CustomerId, GrantConsentBody Body, string? IpAddress) : IRequest<ConsentDto>;

public class GrantConsentHandler : IRequestHandler<GrantConsentCommand, ConsentDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public GrantConsentHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<ConsentDto> Handle(GrantConsentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == request.CustomerId, ct)
            ?? throw AppException.NotFound("Πελάτης");

        // Close any existing live consent of the same type first.
        var existing = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId
                        && c.Type == request.Body.Type && c.RevokedAt == null && c.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var prior in existing) prior.RevokedAt = _clock.UtcNow;

        var record = new ConsentRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customer.Id,
            Type = request.Body.Type,
            Granted = true,
            GrantedAt = _clock.UtcNow,
            Method = request.Body.Method,
            Version = request.Body.Version,
            IpAddress = request.IpAddress
        };
        _db.ConsentRecords.Add(record);
        await _db.SaveChangesAsync(ct);

        return new ConsentDto(record.Id, record.CustomerId, record.Type, record.Granted,
            record.GrantedAt, record.RevokedAt, record.Method, record.Version);
    }
}

/* ============= Revoke ============= */

public record RevokeConsentCommand(Guid CustomerId, RevokeConsentBody Body) : IRequest<Unit>;

public class RevokeConsentHandler : IRequestHandler<RevokeConsentCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public RevokeConsentHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(RevokeConsentCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var live = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId
                        && c.Type == request.Body.Type && c.RevokedAt == null && c.DeletedAt == null)
            .ToListAsync(ct);

        foreach (var c in live)
        {
            c.RevokedAt = _clock.UtcNow;
            if (!string.IsNullOrWhiteSpace(request.Body.Reason)) c.Notes = request.Body.Reason;
        }
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
