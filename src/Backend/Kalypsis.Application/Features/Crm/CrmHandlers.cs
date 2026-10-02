using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Crm;

public record CrmGroupDto(Guid Id, string Name, string EntityType, string? Description, bool IsDynamic, bool IsActive, int MemberCount, DateTime CreatedAt, string? FilterJson = null);
public record CrmGroupBody(string Name, string EntityType, string? Description, bool IsDynamic, string? FilterJson, IReadOnlyList<Guid>? MemberIds);
public record CrmGroupMemberDto(Guid Id, Guid EntityId, string EntityType, string DisplayName, string? Email, string? Phone);

public record ListCrmGroupsQuery(string? EntityType) : IRequest<IReadOnlyList<CrmGroupDto>>;
public record GetCrmGroupMembersQuery(Guid GroupId) : IRequest<IReadOnlyList<CrmGroupMemberDto>>;
public record CreateCrmGroupCommand(CrmGroupBody Body) : IRequest<CrmGroupDto>;
public record UpdateCrmGroupCommand(Guid Id, CrmGroupBody Body) : IRequest<CrmGroupDto>;
public record DeleteCrmGroupCommand(Guid Id) : IRequest<Unit>;
public record SetCrmGroupMembersCommand(Guid GroupId, IReadOnlyList<Guid> MemberIds) : IRequest<CrmGroupDto>;
public record RefreshCrmGroupCommand(Guid GroupId) : IRequest<CrmGroupDto>;

internal sealed record CrmGroupFilter(string? Search, bool HasEmail, bool HasPhone, string? Status);

internal static class CrmGroupDynamicMaterializer
{
    public static async Task RefreshAsync(CrmGroup group, IAppDbContext db, CancellationToken ct)
    {
        if (!group.IsDynamic) return;
        var filter = Parse(group.FilterJson);
        var ids = group.EntityType == "Producer"
            ? await ProducerIds(filter, db, ct)
            : await CustomerIds(filter, db, ct);

        var old = await db.CrmGroupMembers.Where(x => x.GroupId == group.Id && x.DeletedAt == null).ToListAsync(ct);
        db.CrmGroupMembers.RemoveRange(old);
        group.Members.Clear();
        foreach (var id in ids.Distinct())
        {
            var member = new CrmGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, EntityId = id, EntityType = group.EntityType };
            group.Members.Add(member);
            db.CrmGroupMembers.Add(member);
        }
        await db.SaveChangesAsync(ct);
    }

    private static CrmGroupFilter Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new CrmGroupFilter(null, false, false, null);
        try { return System.Text.Json.JsonSerializer.Deserialize<CrmGroupFilter>(json) ?? new CrmGroupFilter(null, false, false, null); }
        catch { return new CrmGroupFilter(null, false, false, null); }
    }

    private static async Task<List<Guid>> CustomerIds(CrmGroupFilter f, IAppDbContext db, CancellationToken ct)
    {
        var q = db.Customers.Where(x => x.DeletedAt == null);
        if (f.HasEmail) q = q.Where(x => x.Email != null && x.Email != "");
        if (f.HasPhone) q = q.Where(x => (x.MobilePhone ?? x.Phone) != null && (x.MobilePhone ?? x.Phone) != "");
        if (Enum.TryParse<CustomerStatus>(f.Status, true, out var status)) q = q.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = $"%{f.Search.Trim()}%";
            q = q.Where(x => EF.Functions.Like(x.FirstName ?? "", s) || EF.Functions.Like(x.LastName ?? "", s)
                || EF.Functions.Like(x.CompanyName ?? "", s) || EF.Functions.Like(x.Email ?? "", s)
                || EF.Functions.Like(x.Phone ?? "", s) || EF.Functions.Like(x.MobilePhone ?? "", s));
        }
        return await q.Select(x => x.Id).Take(10000).ToListAsync(ct);
    }

    private static async Task<List<Guid>> ProducerIds(CrmGroupFilter f, IAppDbContext db, CancellationToken ct)
    {
        var q = db.Producers.Where(x => x.DeletedAt == null);
        if (f.HasEmail) q = q.Where(x => x.Email != null && x.Email != "");
        if (f.HasPhone) q = q.Where(x => x.Phone != null && x.Phone != "");
        if (Enum.TryParse<ProducerStatus>(f.Status, true, out var status)) q = q.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var s = $"%{f.Search.Trim()}%";
            q = q.Where(x => EF.Functions.Like(x.Name, s) || EF.Functions.Like(x.Email ?? "", s) || EF.Functions.Like(x.Phone ?? "", s));
        }
        return await q.Select(x => x.Id).Take(10000).ToListAsync(ct);
    }
}

public sealed class CrmGroupBodyValidator : AbstractValidator<CrmGroupBody>
{
    public CrmGroupBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(160);
        RuleFor(x => x.EntityType).Must(x => x is "Customer" or "Producer")
            .WithMessage("Το CRM group πρέπει να αφορά πελάτες ή συνεργάτες.");
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.FilterJson).MaximumLength(10000);
    }
}

internal static class CrmGroupMapper
{
    public static CrmGroupDto Map(CrmGroup g) => new(g.Id, g.Name, g.EntityType, g.Description, g.IsDynamic, g.IsActive, g.Members.Count, g.CreatedAt, g.FilterJson);
}

public sealed class ListCrmGroupsHandler : IRequestHandler<ListCrmGroupsQuery, IReadOnlyList<CrmGroupDto>>
{
    private readonly IAppDbContext _db;
    public ListCrmGroupsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CrmGroupDto>> Handle(ListCrmGroupsQuery r, CancellationToken ct)
    {
        var q = _db.CrmGroups.Include(x => x.Members).AsQueryable();
        if (!string.IsNullOrWhiteSpace(r.EntityType)) q = q.Where(x => x.EntityType == r.EntityType);
        return await q.Where(x => x.DeletedAt == null).OrderBy(x => x.EntityType).ThenBy(x => x.Name)
            .Select(x => new CrmGroupDto(x.Id, x.Name, x.EntityType, x.Description, x.IsDynamic, x.IsActive, x.Members.Count, x.CreatedAt, x.FilterJson))
            .ToListAsync(ct);
    }
}

public sealed class GetCrmGroupMembersHandler : IRequestHandler<GetCrmGroupMembersQuery, IReadOnlyList<CrmGroupMemberDto>>
{
    private readonly IAppDbContext _db;
    public GetCrmGroupMembersHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CrmGroupMemberDto>> Handle(GetCrmGroupMembersQuery r, CancellationToken ct)
    {
        var group = await _db.CrmGroups.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == r.GroupId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM group");
        await CrmGroupDynamicMaterializer.RefreshAsync(group, _db, ct);
        var members = await _db.CrmGroupMembers.Where(x => x.GroupId == group.Id && x.DeletedAt == null).ToListAsync(ct);
        if (group.EntityType == "Producer")
        {
            var ids = members.Select(x => x.EntityId).ToList();
            var producers = await _db.Producers.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            return members.Select(m => producers.TryGetValue(m.EntityId, out var p)
                ? new CrmGroupMemberDto(m.Id, m.EntityId, m.EntityType, p.Name, p.Email, p.Phone)
                : new CrmGroupMemberDto(m.Id, m.EntityId, m.EntityType, "Μη διαθέσιμος συνεργάτης", null, null)).ToList();
        }
        else
        {
            var ids = members.Select(x => x.EntityId).ToList();
            var customers = await _db.Customers.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            return members.Select(m => customers.TryGetValue(m.EntityId, out var c)
                ? new CrmGroupMemberDto(m.Id, m.EntityId, m.EntityType,
                    c.Type == CustomerType.Company ? c.CompanyName ?? c.CustomerNumber : $"{c.FirstName} {c.LastName}".Trim(), c.Email, c.MobilePhone ?? c.Phone)
                : new CrmGroupMemberDto(m.Id, m.EntityId, m.EntityType, "Μη διαθέσιμος πελάτης", null, null)).ToList();
        }
    }
}

public sealed class CreateCrmGroupHandler : IRequestHandler<CreateCrmGroupCommand, CrmGroupDto>
{
    private readonly IAppDbContext _db;
    public CreateCrmGroupHandler(IAppDbContext db) => _db = db;
    public async Task<CrmGroupDto> Handle(CreateCrmGroupCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.CrmGroups.AnyAsync(x => x.EntityType == b.EntityType && x.Name == b.Name.Trim(), ct))
            throw new AppException("crm_group_exists", "Υπάρχει ήδη ομάδα με αυτό το όνομα.", 409);
        var group = new CrmGroup { Id = Guid.NewGuid(), Name = b.Name.Trim(), EntityType = b.EntityType,
            Description = string.IsNullOrWhiteSpace(b.Description) ? null : b.Description.Trim(), IsDynamic = b.IsDynamic,
            FilterJson = b.FilterJson };
        await ValidateMembersAsync(b.EntityType, b.MemberIds, ct);
        _db.CrmGroups.Add(group);
        AddMembers(group, b.MemberIds);
        await _db.SaveChangesAsync(ct);
        await CrmGroupDynamicMaterializer.RefreshAsync(group, _db, ct);
        return CrmGroupMapper.Map(group);
    }

    private void AddMembers(CrmGroup group, IReadOnlyList<Guid>? ids)
    {
        foreach (var id in (ids ?? Array.Empty<Guid>()).Distinct())
            group.Members.Add(new CrmGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, EntityId = id, EntityType = group.EntityType });
    }

    private async Task ValidateMembersAsync(string entityType, IReadOnlyList<Guid>? ids, CancellationToken ct)
    {
        var distinct = (ids ?? Array.Empty<Guid>()).Distinct().ToList();
        if (distinct.Count == 0) return;
        var count = entityType == "Customer"
            ? await _db.Customers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct)
            : await _db.Producers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct);
        if (count != distinct.Count)
            throw new AppException("crm_group_member_invalid", "Ένα ή περισσότερα μέλη δεν ανήκουν στο συγκεκριμένο γραφείο ή δεν είναι πλέον ενεργά.", 400);
    }
}

public sealed class UpdateCrmGroupHandler : IRequestHandler<UpdateCrmGroupCommand, CrmGroupDto>
{
    private readonly IAppDbContext _db;
    public UpdateCrmGroupHandler(IAppDbContext db) => _db = db;
    public async Task<CrmGroupDto> Handle(UpdateCrmGroupCommand r, CancellationToken ct)
    {
        var group = await _db.CrmGroups.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM group");
        var b = r.Body;
        await ValidateMembersAsync(b.EntityType, b.MemberIds, ct);
        group.Name = b.Name.Trim(); group.EntityType = b.EntityType; group.Description = b.Description?.Trim();
        group.IsDynamic = b.IsDynamic; group.FilterJson = b.FilterJson;
        _db.CrmGroupMembers.RemoveRange(group.Members);
        group.Members.Clear();
        foreach (var id in (b.MemberIds ?? Array.Empty<Guid>()).Distinct())
            group.Members.Add(new CrmGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, EntityId = id, EntityType = group.EntityType });
        await _db.SaveChangesAsync(ct);
        await CrmGroupDynamicMaterializer.RefreshAsync(group, _db, ct);
        return CrmGroupMapper.Map(group);
    }

    private async Task ValidateMembersAsync(string entityType, IReadOnlyList<Guid>? ids, CancellationToken ct)
    {
        var distinct = (ids ?? Array.Empty<Guid>()).Distinct().ToList();
        if (distinct.Count == 0) return;
        var count = entityType == "Customer"
            ? await _db.Customers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct)
            : await _db.Producers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct);
        if (count != distinct.Count)
            throw new AppException("crm_group_member_invalid", "Ένα ή περισσότερα μέλη δεν ανήκουν στο συγκεκριμένο γραφείο ή δεν είναι πλέον ενεργά.", 400);
    }
}

public sealed class RefreshCrmGroupHandler : IRequestHandler<RefreshCrmGroupCommand, CrmGroupDto>
{
    private readonly IAppDbContext _db;
    public RefreshCrmGroupHandler(IAppDbContext db) => _db = db;
    public async Task<CrmGroupDto> Handle(RefreshCrmGroupCommand r, CancellationToken ct)
    {
        var group = await _db.CrmGroups.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == r.GroupId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM group");
        if (!group.IsDynamic) return CrmGroupMapper.Map(group);
        await CrmGroupDynamicMaterializer.RefreshAsync(group, _db, ct);
        return CrmGroupMapper.Map(group);
    }
}

public sealed class SetCrmGroupMembersHandler : IRequestHandler<SetCrmGroupMembersCommand, CrmGroupDto>
{
    private readonly IAppDbContext _db;
    public SetCrmGroupMembersHandler(IAppDbContext db) => _db = db;
    public async Task<CrmGroupDto> Handle(SetCrmGroupMembersCommand r, CancellationToken ct)
    {
        var group = await _db.CrmGroups.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == r.GroupId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM group");
        var distinct = r.MemberIds.Distinct().ToList();
        var count = group.EntityType == "Customer"
            ? await _db.Customers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct)
            : await _db.Producers.CountAsync(x => distinct.Contains(x.Id) && x.DeletedAt == null, ct);
        if (count != distinct.Count)
            throw new AppException("crm_group_member_invalid", "Ένα ή περισσότερα μέλη δεν ανήκουν στο συγκεκριμένο γραφείο ή δεν είναι πλέον ενεργά.", 400);
        _db.CrmGroupMembers.RemoveRange(group.Members);
        group.Members.Clear();
        foreach (var id in r.MemberIds.Distinct())
            group.Members.Add(new CrmGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, EntityId = id, EntityType = group.EntityType });
        await _db.SaveChangesAsync(ct);
        return CrmGroupMapper.Map(group);
    }
}

public sealed class DeleteCrmGroupHandler : IRequestHandler<DeleteCrmGroupCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCrmGroupHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCrmGroupCommand r, CancellationToken ct)
    {
        var group = await _db.CrmGroups.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM group");
        group.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record ProducerCommunicationDto(Guid Id, Guid ProducerId, Guid? UserId, CommunicationKind Kind, CommunicationDirection Direction,
    CommunicationOutcome Outcome, DateTime OccurredAt, int? DurationSeconds, string Subject, string? Body);
public record CreateProducerCommunicationBody(CommunicationKind Kind, CommunicationDirection Direction, CommunicationOutcome Outcome,
    DateTime? OccurredAt, int? DurationSeconds, string Subject, string? Body);
public record ListProducerCommunicationsQuery(Guid ProducerId) : IRequest<IReadOnlyList<ProducerCommunicationDto>>;
public record CreateProducerCommunicationCommand(Guid ProducerId, CreateProducerCommunicationBody Body) : IRequest<ProducerCommunicationDto>;

public sealed class ListProducerCommunicationsHandler : IRequestHandler<ListProducerCommunicationsQuery, IReadOnlyList<ProducerCommunicationDto>>
{
    private readonly IAppDbContext _db;
    public ListProducerCommunicationsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ProducerCommunicationDto>> Handle(ListProducerCommunicationsQuery r, CancellationToken ct)
        => await _db.ProducerCommunicationLogs.Where(x => x.ProducerId == r.ProducerId && x.DeletedAt == null)
            .OrderByDescending(x => x.OccurredAt)
            .Select(x => new ProducerCommunicationDto(x.Id, x.ProducerId, x.UserId, x.Kind, x.Direction, x.Outcome, x.OccurredAt, x.DurationSeconds, x.Subject, x.Body))
            .ToListAsync(ct);
}

public sealed class CreateProducerCommunicationHandler : IRequestHandler<CreateProducerCommunicationCommand, ProducerCommunicationDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CreateProducerCommunicationHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }
    public async Task<ProducerCommunicationDto> Handle(CreateProducerCommunicationCommand r, CancellationToken ct)
    {
        var producer = await _db.Producers.FirstOrDefaultAsync(x => x.Id == r.ProducerId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Producer");
        var b = r.Body;
        if (string.IsNullOrWhiteSpace(b.Subject)) throw new AppException("communication_subject_required", "Το θέμα είναι υποχρεωτικό.", 400);
        var row = new ProducerCommunicationLog { Id = Guid.NewGuid(), TenantId = producer.TenantId, ProducerId = producer.Id,
            UserId = _current.UserId, Kind = b.Kind, Direction = b.Direction, Outcome = b.Outcome,
            OccurredAt = b.OccurredAt ?? DateTime.UtcNow, DurationSeconds = b.DurationSeconds,
            Subject = b.Subject.Trim(), Body = b.Body?.Trim() };
        _db.ProducerCommunicationLogs.Add(row);
        await _db.SaveChangesAsync(ct);
        return new ProducerCommunicationDto(row.Id, row.ProducerId, row.UserId, row.Kind, row.Direction, row.Outcome,
            row.OccurredAt, row.DurationSeconds, row.Subject, row.Body);
    }
}
