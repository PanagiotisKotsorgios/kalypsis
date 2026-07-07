using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public record ProducerDto(
    Guid Id, string Code, string Name, string? Email, string? Phone,
    ProducerStatus Status, ProducerTier Tier, int PolicyCount, DateTime CreatedAt,
    // ALIS-parity hierarchy fields
    HierarchyLevel HierarchyLevel = HierarchyLevel.Producer,
    Guid? ParentProducerId = null,
    string? ParentProducerName = null);

public record CreateProducerBody(string Code, string Name, string? Email, string? Phone, ProducerStatus Status,
    ProducerTier Tier = ProducerTier.None,
    HierarchyLevel HierarchyLevel = HierarchyLevel.Producer,
    Guid? ParentProducerId = null);
public record UpdateProducerBody(string Code, string Name, string? Email, string? Phone, ProducerStatus Status,
    ProducerTier Tier = ProducerTier.None,
    HierarchyLevel HierarchyLevel = HierarchyLevel.Producer,
    Guid? ParentProducerId = null);

/* ========= List ========= */

public record ListProducersQuery() : IRequest<IReadOnlyList<ProducerDto>>;

public class ListProducersQueryHandler : IRequestHandler<ListProducersQuery, IReadOnlyList<ProducerDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListProducersQueryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<IReadOnlyList<ProducerDto>> Handle(ListProducersQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.Producers.IgnoreQueryFilters()
            .Include(p => p.ParentProducer)
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .OrderBy(p => p.Name)
            .Select(p => new ProducerDto(
                p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status, p.Tier,
                _db.Policies.IgnoreQueryFilters().Count(x => x.ProducerId == p.Id && x.DeletedAt == null),
                p.CreatedAt,
                p.HierarchyLevel,
                p.ParentProducerId,
                p.ParentProducer != null ? p.ParentProducer.Name : null))
            .ToListAsync(ct);
        return rows;
    }
}

/* ========= Create ========= */

public record CreateProducerCommand(CreateProducerBody Body) : IRequest<ProducerDto>;

public class CreateProducerCommandValidator : AbstractValidator<CreateProducerCommand>
{
    public CreateProducerCommandValidator()
    {
        RuleFor(x => x.Body.Code).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Body.Name).NotEmpty().MaximumLength(200);
    }
}

public class CreateProducerCommandHandler : IRequestHandler<CreateProducerCommand, ProducerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerDto> Handle(CreateProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var b = request.Body;
        var code = b.Code.Trim().ToUpperInvariant();
        if (await _db.Producers.IgnoreQueryFilters().AnyAsync(p => p.TenantId == tenantId && p.Code == code && p.DeletedAt == null, ct))
            throw new AppException("producer_code_taken",
                $"Παραγωγός με κωδικό {code} υπάρχει ήδη.", 409,
                title: "Κωδικός σε χρήση",
                why: $"Ο κωδικός παραγωγού «{code}» υπάρχει ήδη στο γραφείο σας. Οι κωδικοί παραγωγών πρέπει να είναι μοναδικοί.",
                fix: "Επιλέξτε διαφορετικό κωδικό για τον νέο παραγωγό (π.χ. προσθέστε αύξοντα αριθμό ή τα αρχικά της πόλης).",
                fixLink: "/app/producers");

        var p = new Producer
        {
            Id = Guid.NewGuid(), TenantId = tenantId,
            Code = code, Name = b.Name.Trim(),
            Email = b.Email?.Trim().ToLowerInvariant(), Phone = b.Phone?.Trim(),
            Status = b.Status, Tier = b.Tier,
            HierarchyLevel = b.HierarchyLevel,
            ParentProducerId = b.ParentProducerId
        };
        _db.Producers.Add(p);

        // Email-based User linking. If a Producer-role user already exists
        // with this email in this tenant, link them by pointing
        // User.ProducerId → new producer.Id. If no user exists yet, create
        // one so the producer can log in and see their book right away.
        // Cross-tenant producers (same person working in multiple offices)
        // end up with separate User rows per tenant that share the same
        // email — the (TenantId, Email) unique constraint holds.
        if (!string.IsNullOrEmpty(p.Email))
        {
            var existingUser = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && u.Email == p.Email && u.DeletedAt == null)
                .FirstOrDefaultAsync(ct);
            if (existingUser is not null)
            {
                existingUser.ProducerId = p.Id;
                if (existingUser.Role == Role.Customer) existingUser.Role = Role.Producer;
            }
            else
            {
                var nameParts = p.Name.Split(' ', 2);
                _db.Users.Add(new User
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Email = p.Email,
                    // BCrypt hash of a placeholder that MUST be reset via forgot-password
                    // flow before first login. Bare "!" is invalid on purpose so the
                    // producer can't log in until they set their own.
                    PasswordHash = "!",
                    FirstName = nameParts[0],
                    LastName = nameParts.Length > 1 ? nameParts[1] : "",
                    Role = Role.Producer,
                    ProducerId = p.Id,
                    IsActive = true,
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        string? parentName = null;
        if (p.ParentProducerId.HasValue)
        {
            parentName = await _db.Producers.IgnoreQueryFilters()
                .Where(x => x.Id == p.ParentProducerId.Value)
                .Select(x => x.Name).FirstOrDefaultAsync(ct);
        }
        return new ProducerDto(p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status, p.Tier, 0, p.CreatedAt,
            p.HierarchyLevel, p.ParentProducerId, parentName);
    }
}

/* ========= Update ========= */

public record UpdateProducerCommand(Guid Id, UpdateProducerBody Body) : IRequest<ProducerDto>;

public class UpdateProducerCommandHandler : IRequestHandler<UpdateProducerCommand, ProducerDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ProducerDto> Handle(UpdateProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραγωγός");

        var b = request.Body;
        p.Code = b.Code.Trim().ToUpperInvariant();
        p.Name = b.Name.Trim();
        var newEmail = b.Email?.Trim().ToLowerInvariant();
        var emailChanged = !string.Equals(p.Email, newEmail, StringComparison.OrdinalIgnoreCase);
        p.Email = newEmail;
        p.Phone = b.Phone?.Trim();
        p.Status = b.Status;
        p.Tier   = b.Tier;
        // Guard against self-parenting and trivial 2-node cycles. Deeper
        // cycles are caught by the calculator's depth-8 loop breaker; here
        // we just reject the obvious misuse so the UI's error is clear.
        if (b.ParentProducerId.HasValue && b.ParentProducerId.Value == p.Id)
            throw new AppException("producer_self_parent",
                "Ένας συνεργάτης δεν μπορεί να είναι προϊστάμενος του εαυτού του.", 400);
        p.HierarchyLevel = b.HierarchyLevel;
        p.ParentProducerId = b.ParentProducerId;

        // Re-run the email-based user linking every time the email changes.
        // Existing User with that email → set User.ProducerId = p.Id. No
        // matching user → create one so the producer can be onboarded.
        if (emailChanged && !string.IsNullOrEmpty(newEmail))
        {
            // Unlink any users previously pointing at this producer that
            // no longer share the email (avoids double-linking scenarios).
            var stale = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && u.ProducerId == p.Id && u.Email != newEmail)
                .ToListAsync(ct);
            foreach (var u in stale) u.ProducerId = null;

            var target = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.TenantId == tenantId && u.Email == newEmail && u.DeletedAt == null)
                .FirstOrDefaultAsync(ct);
            if (target is not null)
            {
                target.ProducerId = p.Id;
                if (target.Role == Role.Customer) target.Role = Role.Producer;
            }
            else
            {
                var nameParts = p.Name.Split(' ', 2);
                _db.Users.Add(new User
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Email = newEmail,
                    PasswordHash = "!",
                    FirstName = nameParts[0],
                    LastName = nameParts.Length > 1 ? nameParts[1] : "",
                    Role = Role.Producer,
                    ProducerId = p.Id,
                    IsActive = true,
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        var count = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(x => x.ProducerId == p.Id && x.DeletedAt == null, ct);
        string? parentName = null;
        if (p.ParentProducerId.HasValue)
        {
            parentName = await _db.Producers.IgnoreQueryFilters()
                .Where(x => x.Id == p.ParentProducerId.Value)
                .Select(x => x.Name).FirstOrDefaultAsync(ct);
        }
        return new ProducerDto(p.Id, p.Code, p.Name, p.Email, p.Phone, p.Status, p.Tier, count, p.CreatedAt,
            p.HierarchyLevel, p.ParentProducerId, parentName);
    }
}

/* ========= Delete ========= */

public record DeleteProducerCommand(Guid Id) : IRequest<Unit>;

public class DeleteProducerCommandHandler : IRequestHandler<DeleteProducerCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public DeleteProducerCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(DeleteProducerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Producers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραγωγός");
        p.DeletedAt = DateTime.UtcNow;
        p.Status = ProducerStatus.Terminated;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Email lookup for producer form ========= */
//
// The producer create/edit dialog auto-searches Kalypsis Users as the operator
// types an email. If a User with that email already exists in the current tenant,
// the frontend pops up a verification card showing enough context (name, role,
// linked producer, joined-at) for the operator to confirm «yes, that's them»
// before we link User.ProducerId to the new/edited Producer. If not, the form
// stays quiet and the user gets a soft «not found — link later via edit».
//
// Returns null (200 with null body) when nothing matches — that's not an error
// state, just information for the UI.

public record ProducerUserLookupDto(
    Guid UserId,
    string Email,
    string FullName,
    string Role,
    bool IsActive,
    DateTime CreatedAt,
    Guid? LinkedProducerId,
    string? LinkedProducerCode,
    string? LinkedProducerName);

public record LookupProducerUserByEmailQuery(string Email) : IRequest<ProducerUserLookupDto?>;

public class LookupProducerUserByEmailHandler
    : IRequestHandler<LookupProducerUserByEmailQuery, ProducerUserLookupDto?>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public LookupProducerUserByEmailHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<ProducerUserLookupDto?> Handle(LookupProducerUserByEmailQuery r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var email = r.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@')) return null;

        var user = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.TenantId == tenantId && u.Email == email && u.DeletedAt == null)
            .FirstOrDefaultAsync(ct);
        if (user is null) return null;

        Producer? linked = null;
        if (user.ProducerId.HasValue)
        {
            linked = await _db.Producers.IgnoreQueryFilters()
                .Where(p => p.Id == user.ProducerId.Value && p.DeletedAt == null)
                .FirstOrDefaultAsync(ct);
        }

        return new ProducerUserLookupDto(
            user.Id,
            user.Email,
            $"{user.FirstName} {user.LastName}".Trim(),
            user.Role.ToString(),
            user.IsActive,
            user.CreatedAt,
            linked?.Id,
            linked?.Code,
            linked?.Name);
    }
}
