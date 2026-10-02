using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Crm;

public static class CrmOpportunityStages
{
    public const string New = "New";
    public const string Contacted = "Contacted";
    public const string Quoted = "Quoted";
    public const string FollowUp = "FollowUp";
    public const string Won = "Won";
    public const string Lost = "Lost";
    public static readonly string[] All = { New, Contacted, Quoted, FollowUp, Won, Lost };
}

public record CrmOpportunityDto(
    Guid Id, string Title, string Stage, string? Product, string? Carrier,
    decimal? EstimatedValue, DateTime? NextActionAt, string? LostReason, string? Notes,
    Guid? CustomerId, string? CustomerName, Guid? ProducerId, string? ProducerName,
    Guid? AssignedToUserId, string? AssignedToUserName, DateTime CreatedAt, DateTime? UpdatedAt);

public record CrmOpportunityBody(
    string Title, string Stage, string? Product, string? Carrier, decimal? EstimatedValue,
    DateTime? NextActionAt, string? LostReason, string? Notes, Guid? CustomerId,
    Guid? ProducerId, Guid? AssignedToUserId);

public record ListCrmOpportunitiesQuery(string? Search, string? Stage, DateTime? From, DateTime? To)
    : IRequest<IReadOnlyList<CrmOpportunityDto>>;
public record CreateCrmOpportunityCommand(CrmOpportunityBody Body) : IRequest<CrmOpportunityDto>;
public record UpdateCrmOpportunityCommand(Guid Id, CrmOpportunityBody Body) : IRequest<CrmOpportunityDto>;
public record DeleteCrmOpportunityCommand(Guid Id) : IRequest<Unit>;

public sealed class CrmOpportunityBodyValidator : AbstractValidator<CrmOpportunityBody>
{
    public CrmOpportunityBodyValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(240);
        RuleFor(x => x.Stage).Must(x => CrmOpportunityStages.All.Contains(x, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Μη έγκυρο στάδιο ευκαιρίας.");
        RuleFor(x => x.Product).MaximumLength(160);
        RuleFor(x => x.Carrier).MaximumLength(160);
        RuleFor(x => x.EstimatedValue).GreaterThanOrEqualTo(0).When(x => x.EstimatedValue.HasValue);
        RuleFor(x => x.LostReason).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(4000);
    }
}

internal static class CrmOpportunityMapper
{
    public static CrmOpportunityDto Map(CrmOpportunity x) => new(
        x.Id, x.Title, x.Stage, x.Product, x.Carrier, x.EstimatedValue, x.NextActionAt,
        x.LostReason, x.Notes, x.CustomerId,
        x.Customer == null ? null : x.Customer.Type == Domain.Enums.CustomerType.Company
            ? x.Customer.CompanyName ?? x.Customer.CustomerNumber
            : $"{x.Customer.FirstName} {x.Customer.LastName}".Trim(),
        x.ProducerId, x.Producer == null ? null : x.Producer.Name,
        x.AssignedToUserId, x.AssignedToUser == null ? null : $"{x.AssignedToUser.FirstName} {x.AssignedToUser.LastName}".Trim(),
        x.CreatedAt, x.UpdatedAt);
}

public sealed class ListCrmOpportunitiesHandler : IRequestHandler<ListCrmOpportunitiesQuery, IReadOnlyList<CrmOpportunityDto>>
{
    private readonly IAppDbContext _db;
    public ListCrmOpportunitiesHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CrmOpportunityDto>> Handle(ListCrmOpportunitiesQuery r, CancellationToken ct)
    {
        var q = _db.CrmOpportunities
            .Include(x => x.Customer)
            .Include(x => x.Producer)
            .Include(x => x.AssignedToUser)
            .Where(x => x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(r.Stage)) q = q.Where(x => x.Stage == r.Stage);
        if (r.From.HasValue) q = q.Where(x => x.NextActionAt >= r.From.Value);
        if (r.To.HasValue) q = q.Where(x => x.NextActionAt <= r.To.Value);
        if (!string.IsNullOrWhiteSpace(r.Search))
        {
            var s = $"%{r.Search.Trim()}%";
            q = q.Where(x => EF.Functions.Like(x.Title, s)
                || EF.Functions.Like(x.Product ?? "", s)
                || EF.Functions.Like(x.Carrier ?? "", s)
                || EF.Functions.Like(x.Customer!.FirstName ?? "", s)
                || EF.Functions.Like(x.Customer!.LastName ?? "", s)
                || EF.Functions.Like(x.Customer!.CompanyName ?? "", s)
                || EF.Functions.Like(x.Producer!.Name ?? "", s));
        }
        var rows = await q.OrderBy(x => x.NextActionAt == null).ThenBy(x => x.NextActionAt).ThenByDescending(x => x.CreatedAt)
            .Take(2000).ToListAsync(ct);
        return rows.Select(CrmOpportunityMapper.Map).ToList();
    }
}

public sealed class CreateCrmOpportunityHandler : IRequestHandler<CreateCrmOpportunityCommand, CrmOpportunityDto>
{
    private readonly IAppDbContext _db;
    public CreateCrmOpportunityHandler(IAppDbContext db) => _db = db;
    public async Task<CrmOpportunityDto> Handle(CreateCrmOpportunityCommand r, CancellationToken ct)
    {
        await ValidateLinks(r.Body, ct);
        var b = r.Body;
        var entity = new CrmOpportunity
        {
            Id = Guid.NewGuid(), Title = b.Title.Trim(), Stage = NormalizeStage(b.Stage),
            Product = Trim(b.Product), Carrier = Trim(b.Carrier), EstimatedValue = b.EstimatedValue,
            NextActionAt = b.NextActionAt, LostReason = Trim(b.LostReason), Notes = Trim(b.Notes),
            CustomerId = b.CustomerId, ProducerId = b.ProducerId, AssignedToUserId = b.AssignedToUserId
        };
        _db.CrmOpportunities.Add(entity);
        await _db.SaveChangesAsync(ct);
        await LoadLinks(entity, ct);
        return CrmOpportunityMapper.Map(entity);
    }

    private async Task ValidateLinks(CrmOpportunityBody b, CancellationToken ct)
    {
        if (b.CustomerId.HasValue && !await _db.Customers.AnyAsync(x => x.Id == b.CustomerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Customer");
        if (b.ProducerId.HasValue && !await _db.Producers.AnyAsync(x => x.Id == b.ProducerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Producer");
        if (b.AssignedToUserId.HasValue && !await _db.Users.AnyAsync(x => x.Id == b.AssignedToUserId && x.DeletedAt == null, ct)) throw AppException.NotFound("User");
    }
    private async Task LoadLinks(CrmOpportunity e, CancellationToken ct)
    {
        if (e.CustomerId.HasValue) e.Customer = await _db.Customers.FirstOrDefaultAsync(x => x.Id == e.CustomerId, ct);
        if (e.ProducerId.HasValue) e.Producer = await _db.Producers.FirstOrDefaultAsync(x => x.Id == e.ProducerId, ct);
        if (e.AssignedToUserId.HasValue) e.AssignedToUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == e.AssignedToUserId, ct);
    }
    internal static string NormalizeStage(string stage) => CrmOpportunityStages.All.First(x => x.Equals(stage.Trim(), StringComparison.OrdinalIgnoreCase));
    internal static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class UpdateCrmOpportunityHandler : IRequestHandler<UpdateCrmOpportunityCommand, CrmOpportunityDto>
{
    private readonly IAppDbContext _db;
    public UpdateCrmOpportunityHandler(IAppDbContext db) => _db = db;
    public async Task<CrmOpportunityDto> Handle(UpdateCrmOpportunityCommand r, CancellationToken ct)
    {
        var e = await _db.CrmOpportunities.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM opportunity");
        var b = r.Body;
        if (b.CustomerId.HasValue && !await _db.Customers.AnyAsync(x => x.Id == b.CustomerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Customer");
        if (b.ProducerId.HasValue && !await _db.Producers.AnyAsync(x => x.Id == b.ProducerId && x.DeletedAt == null, ct)) throw AppException.NotFound("Producer");
        if (b.AssignedToUserId.HasValue && !await _db.Users.AnyAsync(x => x.Id == b.AssignedToUserId && x.DeletedAt == null, ct)) throw AppException.NotFound("User");
        e.Title = b.Title.Trim(); e.Stage = CreateCrmOpportunityHandler.NormalizeStage(b.Stage);
        e.Product = CreateCrmOpportunityHandler.Trim(b.Product); e.Carrier = CreateCrmOpportunityHandler.Trim(b.Carrier);
        e.EstimatedValue = b.EstimatedValue; e.NextActionAt = b.NextActionAt;
        e.LostReason = CreateCrmOpportunityHandler.Trim(b.LostReason); e.Notes = CreateCrmOpportunityHandler.Trim(b.Notes);
        e.CustomerId = b.CustomerId; e.ProducerId = b.ProducerId; e.AssignedToUserId = b.AssignedToUserId;
        e.Customer = null;
        e.Producer = null;
        e.AssignedToUser = null;
        await _db.SaveChangesAsync(ct);
        if (e.CustomerId.HasValue) e.Customer = await _db.Customers.FirstOrDefaultAsync(x => x.Id == e.CustomerId, ct);
        if (e.ProducerId.HasValue) e.Producer = await _db.Producers.FirstOrDefaultAsync(x => x.Id == e.ProducerId, ct);
        if (e.AssignedToUserId.HasValue) e.AssignedToUser = await _db.Users.FirstOrDefaultAsync(x => x.Id == e.AssignedToUserId, ct);
        return CrmOpportunityMapper.Map(e);
    }
}

public sealed class DeleteCrmOpportunityHandler : IRequestHandler<DeleteCrmOpportunityCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCrmOpportunityHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCrmOpportunityCommand r, CancellationToken ct)
    {
        var e = await _db.CrmOpportunities.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("CRM opportunity");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
