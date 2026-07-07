using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Communications;

public record CommunicationDto(
    Guid Id,
    Guid CustomerId,
    Guid? UserId,
    CommunicationKind Kind,
    CommunicationDirection Direction,
    CommunicationOutcome Outcome,
    DateTime OccurredAt,
    int? DurationSeconds,
    string Subject,
    string? Body,
    string? RelatedPolicyNumber,
    Guid? RelatedPolicyId);

public record CreateCommunicationBody(
    CommunicationKind Kind,
    CommunicationDirection Direction,
    CommunicationOutcome Outcome,
    DateTime? OccurredAt,
    int? DurationSeconds,
    string Subject,
    string? Body,
    Guid? RelatedPolicyId);

public class CreateCommunicationBodyValidator : AbstractValidator<CreateCommunicationBody>
{
    public CreateCommunicationBodyValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Body).MaximumLength(4000);
    }
}

/* ============= List ============= */

public record ListCommunicationsQuery(Guid CustomerId, CommunicationKind? Kind) : IRequest<IReadOnlyList<CommunicationDto>>;

public class ListCommunicationsHandler : IRequestHandler<ListCommunicationsQuery, IReadOnlyList<CommunicationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListCommunicationsHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<CommunicationDto>> Handle(ListCommunicationsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.CommunicationLogs
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId && c.DeletedAt == null);
        if (request.Kind.HasValue) q = q.Where(c => c.Kind == request.Kind.Value);
        return await q.OrderByDescending(c => c.OccurredAt)
            .Select(c => new CommunicationDto(c.Id, c.CustomerId, c.UserId, c.Kind, c.Direction, c.Outcome,
                c.OccurredAt, c.DurationSeconds, c.Subject, c.Body,
                c.RelatedPolicyNumber, c.RelatedPolicyId))
            .ToListAsync(ct);
    }
}

/* ============= List by policy ============= */

public record ListPolicyCommunicationsQuery(Guid PolicyId) : IRequest<IReadOnlyList<CommunicationDto>>;

public class ListPolicyCommunicationsHandler : IRequestHandler<ListPolicyCommunicationsQuery, IReadOnlyList<CommunicationDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListPolicyCommunicationsHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<CommunicationDto>> Handle(ListPolicyCommunicationsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        return await _db.CommunicationLogs
            .Where(c => c.TenantId == tenantId && c.RelatedPolicyId == request.PolicyId && c.DeletedAt == null)
            .OrderByDescending(c => c.OccurredAt)
            .Select(c => new CommunicationDto(c.Id, c.CustomerId, c.UserId, c.Kind, c.Direction, c.Outcome,
                c.OccurredAt, c.DurationSeconds, c.Subject, c.Body,
                c.RelatedPolicyNumber, c.RelatedPolicyId))
            .ToListAsync(ct);
    }
}

/* ============= Create for policy ============= */

public record CreatePolicyCommunicationCommand(Guid PolicyId, CreateCommunicationBody Body) : IRequest<CommunicationDto>;

public class CreatePolicyCommunicationHandler : IRequestHandler<CreatePolicyCommunicationCommand, CommunicationDto>
{
    private readonly IMediator _mediator;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreatePolicyCommunicationHandler(IMediator mediator, IAppDbContext db, ICurrentUser current)
    { _mediator = mediator; _db = db; _current = current; }

    public async Task<CommunicationDto> Handle(CreatePolicyCommunicationCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        // Resolve the policy's customer so we can reuse CreateCommunicationCommand
        // (which is scoped by customer). We also force RelatedPolicyId to this
        // policy — safer than trusting whatever the client sent.
        var policyCustomer = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.Id == request.PolicyId && p.DeletedAt == null)
            .Select(p => (Guid?)p.CustomerId)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var body = request.Body with { RelatedPolicyId = request.PolicyId };
        return await _mediator.Send(new CreateCommunicationCommand(policyCustomer, body), ct);
    }
}

/* ============= Create ============= */

public record CreateCommunicationCommand(Guid CustomerId, CreateCommunicationBody Body) : IRequest<CommunicationDto>;

public class CreateCommunicationHandler : IRequestHandler<CreateCommunicationCommand, CommunicationDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public CreateCommunicationHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<CommunicationDto> Handle(CreateCommunicationCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == request.CustomerId, ct)
            ?? throw AppException.NotFound("Πελάτης");

        string? linkedNumber = null;
        if (request.Body.RelatedPolicyId.HasValue)
        {
            linkedNumber = await _db.Policies
                .Where(p => p.TenantId == tenantId && p.Id == request.Body.RelatedPolicyId.Value)
                .Select(p => p.PolicyNumber)
                .FirstOrDefaultAsync(ct);
        }

        var log = new CommunicationLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customer.Id,
            UserId = _current.UserId,
            Kind = request.Body.Kind,
            Direction = request.Body.Direction,
            Outcome = request.Body.Outcome,
            OccurredAt = request.Body.OccurredAt ?? _clock.UtcNow,
            DurationSeconds = request.Body.DurationSeconds,
            Subject = request.Body.Subject.Trim(),
            Body = request.Body.Body?.Trim(),
            RelatedPolicyId = request.Body.RelatedPolicyId,
            RelatedPolicyNumber = linkedNumber
        };
        _db.CommunicationLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        return new CommunicationDto(log.Id, log.CustomerId, log.UserId, log.Kind, log.Direction, log.Outcome,
            log.OccurredAt, log.DurationSeconds, log.Subject, log.Body, log.RelatedPolicyNumber, log.RelatedPolicyId);
    }
}
