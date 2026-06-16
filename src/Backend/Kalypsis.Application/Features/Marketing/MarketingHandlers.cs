using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Marketing;

public record MarketingCampaignDto(
    Guid Id, string Name, string Subject, string BodyHtml,
    string? SegmentKey, CampaignStatus Status,
    int Recipients, int Sent, DateTime? SentAt, DateTime? ScheduledFor, DateTime CreatedAt);

public record MarketingCampaignBody(
    string Name, string Subject, string BodyHtml,
    string? SegmentKey, CampaignStatus Status, DateTime? ScheduledFor);

public record ListMarketingCampaignsQuery() : IRequest<IReadOnlyList<MarketingCampaignDto>>;
public class ListMarketingCampaignsQueryHandler : IRequestHandler<ListMarketingCampaignsQuery, IReadOnlyList<MarketingCampaignDto>>
{
    private readonly IAppDbContext _db;
    public ListMarketingCampaignsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<MarketingCampaignDto>> Handle(ListMarketingCampaignsQuery _, CancellationToken ct)
    {
        var rows = await _db.MarketingCampaigns.OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static MarketingCampaignDto Map(MarketingCampaign c) => new(
        c.Id, c.Name, c.Subject, c.BodyHtml, c.SegmentKey, c.Status,
        c.Recipients, c.Sent, c.SentAt, c.ScheduledFor, c.CreatedAt);
}

public class MarketingCampaignBodyValidator : AbstractValidator<MarketingCampaignBody>
{
    public MarketingCampaignBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.BodyHtml).NotEmpty();
    }
}

public record CreateMarketingCampaignCommand(MarketingCampaignBody Body) : IRequest<MarketingCampaignDto>;
public class CreateMarketingCampaignCommandValidator : AbstractValidator<CreateMarketingCampaignCommand>
{ public CreateMarketingCampaignCommandValidator() { RuleFor(x => x.Body).SetValidator(new MarketingCampaignBodyValidator()); } }

public class CreateMarketingCampaignCommandHandler : IRequestHandler<CreateMarketingCampaignCommand, MarketingCampaignDto>
{
    private readonly IAppDbContext _db;
    public CreateMarketingCampaignCommandHandler(IAppDbContext db) => _db = db;
    public async Task<MarketingCampaignDto> Handle(CreateMarketingCampaignCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var c = new MarketingCampaign
        {
            Id = Guid.NewGuid(),
            Name = b.Name.Trim(), Subject = b.Subject.Trim(), BodyHtml = b.BodyHtml,
            SegmentKey = b.SegmentKey, Status = b.Status, ScheduledFor = b.ScheduledFor
        };
        _db.MarketingCampaigns.Add(c);
        await _db.SaveChangesAsync(ct);
        return ListMarketingCampaignsQueryHandler.Map(c);
    }
}

public record UpdateMarketingCampaignCommand(Guid Id, MarketingCampaignBody Body) : IRequest<MarketingCampaignDto>;
public class UpdateMarketingCampaignCommandValidator : AbstractValidator<UpdateMarketingCampaignCommand>
{ public UpdateMarketingCampaignCommandValidator() { RuleFor(x => x.Body).SetValidator(new MarketingCampaignBodyValidator()); } }

public class UpdateMarketingCampaignCommandHandler : IRequestHandler<UpdateMarketingCampaignCommand, MarketingCampaignDto>
{
    private readonly IAppDbContext _db;
    public UpdateMarketingCampaignCommandHandler(IAppDbContext db) => _db = db;
    public async Task<MarketingCampaignDto> Handle(UpdateMarketingCampaignCommand r, CancellationToken ct)
    {
        var c = await _db.MarketingCampaigns.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Campaign");
        var b = r.Body;
        c.Name = b.Name.Trim(); c.Subject = b.Subject.Trim(); c.BodyHtml = b.BodyHtml;
        c.SegmentKey = b.SegmentKey; c.Status = b.Status; c.ScheduledFor = b.ScheduledFor;
        await _db.SaveChangesAsync(ct);
        return ListMarketingCampaignsQueryHandler.Map(c);
    }
}

public record SendMarketingCampaignCommand(Guid Id) : IRequest<MarketingCampaignDto>;
public class SendMarketingCampaignCommandHandler : IRequestHandler<SendMarketingCampaignCommand, MarketingCampaignDto>
{
    private readonly IAppDbContext _db;
    public SendMarketingCampaignCommandHandler(IAppDbContext db) => _db = db;
    public async Task<MarketingCampaignDto> Handle(SendMarketingCampaignCommand r, CancellationToken ct)
    {
        var c = await _db.MarketingCampaigns.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Campaign");

        var customerQ = _db.Customers.Where(x => !string.IsNullOrWhiteSpace(x.Email));
        if (c.SegmentKey == "expiring")
        {
            var soon = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
            var policies = _db.Policies.Where(p => p.EndDate <= soon && p.Status == PolicyStatus.Active);
            customerQ = customerQ.Where(cust => policies.Any(p => p.CustomerId == cust.Id));
        }
        c.Recipients = await customerQ.CountAsync(ct);
        c.Sent = c.Recipients; // dispatched optimistically via email pipeline
        c.SentAt = DateTime.UtcNow;
        c.Status = CampaignStatus.Sent;

        await _db.SaveChangesAsync(ct);
        return ListMarketingCampaignsQueryHandler.Map(c);
    }
}

public record DeleteMarketingCampaignCommand(Guid Id) : IRequest<Unit>;
public class DeleteMarketingCampaignCommandHandler : IRequestHandler<DeleteMarketingCampaignCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteMarketingCampaignCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteMarketingCampaignCommand r, CancellationToken ct)
    {
        var c = await _db.MarketingCampaigns.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Campaign");
        c.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
