using System.Text.Json;
using System.Text.RegularExpressions;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Marketing;

public static class MarketingChannels
{
    public const string Email = "Email";
    public const string Sms = "Sms";
    public const string Viber = "Viber";
    public static readonly string[] All = { Email, Sms, Viber };

    public static string[] Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new[] { Email };
        try
        {
            var channels = JsonSerializer.Deserialize<string[]>(json ?? "[]") ?? Array.Empty<string>();
            return channels.Where(channel => All.Contains(channel, StringComparer.OrdinalIgnoreCase))
                .Select(channel => All.First(allowed => allowed.Equals(channel, StringComparison.OrdinalIgnoreCase)))
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        }
        catch { return Array.Empty<string>(); }
    }
}

public record MarketingCampaignDto(
    Guid Id, string Name, string Subject, string BodyHtml, string? SmsBody, string? ViberBody,
    IReadOnlyList<string> Channels, string? SegmentKey, string? OccupationFilter, string? NeedKindFilter,
    bool OnlyUninsuredNeeds, CampaignStatus Status,
    int Recipients, int Sent, int Failed, DateTime? SentAt, DateTime? ScheduledFor, DateTime CreatedAt);

public record MarketingCampaignBody(
    string Name, string Subject, string BodyHtml, string? SmsBody, string? ViberBody,
    IReadOnlyList<string>? Channels, string? SegmentKey, string? OccupationFilter, string? NeedKindFilter,
    bool OnlyUninsuredNeeds, CampaignStatus Status, DateTime? ScheduledFor);

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
        c.Id, c.Name, c.Subject, c.BodyHtml, c.SmsBody, c.ViberBody,
        MarketingChannels.Parse(c.ChannelsJson), c.SegmentKey, c.OccupationFilter, c.NeedKindFilter,
        c.OnlyUninsuredNeeds, c.Status, c.Recipients, c.Sent, c.Failed, c.SentAt, c.ScheduledFor, c.CreatedAt);
}

public class MarketingCampaignBodyValidator : AbstractValidator<MarketingCampaignBody>
{
    public MarketingCampaignBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.BodyHtml).NotEmpty();
        RuleFor(x => x.Status).NotEqual(CampaignStatus.Sent).WithMessage("Only dispatch can mark a campaign as sent.");
        RuleFor(x => x.SmsBody).MaximumLength(1600);
        RuleFor(x => x.ViberBody).MaximumLength(4000);
        RuleFor(x => x.OccupationFilter).MaximumLength(120);
        RuleFor(x => x.NeedKindFilter).Must(kind => string.IsNullOrWhiteSpace(kind) || CustomerNeedCatalog.Keys.Contains(kind))
            .WithMessage("Unknown insurance need.");
        RuleFor(x => x.Channels).Must(channels => channels is { Count: > 0 }
                && channels.All(channel => MarketingChannels.All.Contains(channel, StringComparer.OrdinalIgnoreCase)))
            .WithMessage("Select at least one valid delivery channel.");
        When(x => x.Status == CampaignStatus.Scheduled,
            () => RuleFor(x => x.ScheduledFor).NotNull().WithMessage("A scheduled campaign needs a dispatch time."));
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
        var c = MarketingCampaignMapper.Create(r.Body);
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
        if (c.Status == CampaignStatus.Sent)
            throw new AppException("campaign_sent_locked", "A sent campaign cannot be edited. Create a new campaign for a new delivery.", 409);
        MarketingCampaignMapper.Apply(c, r.Body);
        await _db.SaveChangesAsync(ct);
        return ListMarketingCampaignsQueryHandler.Map(c);
    }
}

public record SendMarketingCampaignCommand(Guid Id) : IRequest<MarketingCampaignDto>;
public class SendMarketingCampaignCommandHandler : IRequestHandler<SendMarketingCampaignCommand, MarketingCampaignDto>
{
    private readonly IAppDbContext _db;
    private readonly IEmailSender _email;
    private readonly ISmsSender _sms;
    private readonly IViberSender _viber;

    public SendMarketingCampaignCommandHandler(IAppDbContext db, IEmailSender email, ISmsSender sms, IViberSender viber)
    { _db = db; _email = email; _sms = sms; _viber = viber; }

    public async Task<MarketingCampaignDto> Handle(SendMarketingCampaignCommand r, CancellationToken ct)
    {
        var campaign = await _db.MarketingCampaigns.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Campaign");
        if (campaign.Status == CampaignStatus.Sent) return ListMarketingCampaignsQueryHandler.Map(campaign);

        var audience = await ResolveAudience(campaign, ct);
        var audienceIds = audience.Select(customer => customer.Id).ToList();
        var consents = await _db.ConsentRecords.IgnoreQueryFilters()
            .Where(consent => consent.TenantId == campaign.TenantId && audienceIds.Contains(consent.CustomerId)
                && consent.DeletedAt == null && consent.Granted && consent.RevokedAt == null)
            .GroupBy(consent => consent.CustomerId)
            .ToDictionaryAsync(group => group.Key, group => group.Select(consent => consent.Type).ToHashSet(), ct);
        var channels = MarketingChannels.Parse(campaign.ChannelsJson);
        var sent = 0;
        var failed = 0;

        foreach (var customer in audience)
        {
            var granted = consents.GetValueOrDefault(customer.Id) ?? new HashSet<ConsentType>();
            var name = CustomerName(customer);
            var htmlBody = Render(campaign.BodyHtml, customer);
            var smsBody = Render(string.IsNullOrWhiteSpace(campaign.SmsBody) ? StripHtml(campaign.BodyHtml) : campaign.SmsBody, customer);
            var viberBody = Render(string.IsNullOrWhiteSpace(campaign.ViberBody) ? smsBody : campaign.ViberBody, customer);

            if (channels.Contains(MarketingChannels.Email) && !string.IsNullOrWhiteSpace(customer.Email))
            {
                if (granted.Contains(ConsentType.EmailMarketing))
                {
                    var result = await _email.SendAsync(new EmailMessage(customer.Email!, name, Render(campaign.Subject, customer), htmlBody), ct);
                    if (result.Success) { sent++; AddCommunication(campaign, customer, CommunicationKind.Email, campaign.Subject, "Email campaign sent."); }
                    else failed++;
                }
                else failed++;
            }
            else if (channels.Contains(MarketingChannels.Email)) failed++;

            var phone = customer.MobilePhone ?? customer.Phone;
            if (channels.Contains(MarketingChannels.Sms) && !string.IsNullOrWhiteSpace(phone))
            {
                if (granted.Contains(ConsentType.SmsMarketing))
                {
                    var result = await _sms.SendAsync(new SmsMessage(phone!, smsBody), ct);
                    _db.SmsLogs.Add(new SmsLog
                    {
                        Id = Guid.NewGuid(), TenantId = campaign.TenantId, CustomerId = customer.Id,
                        Provider = "campaign", ToNumber = phone!, Body = smsBody,
                        ProviderMessageId = null, Status = result.Success ? "Sent" : "Failed",
                        FailureReason = result.ErrorMessage, QueuedAt = DateTime.UtcNow
                    });
                    if (result.Success) { sent++; AddCommunication(campaign, customer, CommunicationKind.Sms, campaign.Name, "SMS campaign sent."); }
                    else failed++;
                }
                else failed++;
            }
            else if (channels.Contains(MarketingChannels.Sms)) failed++;

            if (channels.Contains(MarketingChannels.Viber) && !string.IsNullOrWhiteSpace(phone))
            {
                if (granted.Contains(ConsentType.ViberMarketing))
                {
                    var result = await _viber.SendAsync(new ViberMessage(phone!, viberBody), ct);
                    _db.ViberLogs.Add(new ViberLog
                    {
                        Id = Guid.NewGuid(), TenantId = campaign.TenantId, CustomerId = customer.Id,
                        Provider = "campaign", ToNumber = phone!, Body = viberBody,
                        ProviderMessageId = result.ProviderMessageId, Status = result.Success ? "Sent" : "Failed",
                        FailureReason = result.ErrorMessage, QueuedAt = DateTime.UtcNow
                    });
                    if (result.Success) { sent++; AddCommunication(campaign, customer, CommunicationKind.Sms, campaign.Name, "Viber campaign sent."); }
                    else failed++;
                }
                else failed++;
            }
            else if (channels.Contains(MarketingChannels.Viber)) failed++;
        }

        campaign.Recipients = audience.Count;
        campaign.Sent = sent;
        campaign.Failed = failed;
        campaign.SentAt = DateTime.UtcNow;
        campaign.Status = CampaignStatus.Sent;
        await _db.SaveChangesAsync(ct);
        return ListMarketingCampaignsQueryHandler.Map(campaign);
    }

    private async Task<List<Customer>> ResolveAudience(MarketingCampaign campaign, CancellationToken ct)
    {
        var query = _db.Customers.IgnoreQueryFilters()
            .Where(customer => customer.TenantId == campaign.TenantId && customer.DeletedAt == null && customer.Status == CustomerStatus.Active);
        if (campaign.SegmentKey == "expiring")
        {
            var soon = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
            var expiringCustomerIds = _db.Policies.IgnoreQueryFilters()
                .Where(policy => policy.TenantId == campaign.TenantId && policy.DeletedAt == null
                    && policy.Status == PolicyStatus.Active && policy.EndDate <= soon)
                .Select(policy => policy.CustomerId);
            query = query.Where(customer => expiringCustomerIds.Contains(customer.Id));
        }
        if (campaign.SegmentKey == "with_email") query = query.Where(customer => customer.Email != null && customer.Email != "");
        if (!string.IsNullOrWhiteSpace(campaign.OccupationFilter))
        {
            var occupation = $"%{campaign.OccupationFilter.Trim()}%";
            query = query.Where(customer => EF.Functions.Like(customer.Occupation ?? "", occupation)
                || EF.Functions.Like(customer.Employer ?? "", occupation));
        }
        if (!string.IsNullOrWhiteSpace(campaign.NeedKindFilter))
        {
            var needCustomers = _db.CustomerInsuranceNeeds.IgnoreQueryFilters()
                .Where(need => need.TenantId == campaign.TenantId && need.DeletedAt == null
                    && need.Kind == campaign.NeedKindFilter && need.HasAsset);
            if (campaign.OnlyUninsuredNeeds) needCustomers = needCustomers.Where(need => !need.IsInsured);
            query = query.Where(customer => needCustomers.Select(need => need.CustomerId).Contains(customer.Id));
        }
        return await query.OrderBy(customer => customer.LastName).ThenBy(customer => customer.CompanyName).Take(1000).ToListAsync(ct);
    }

    private void AddCommunication(MarketingCampaign campaign, Customer customer, CommunicationKind kind, string subject, string body) =>
        _db.CommunicationLogs.Add(new CommunicationLog
        {
            Id = Guid.NewGuid(), TenantId = campaign.TenantId, CustomerId = customer.Id,
            Kind = kind, Direction = CommunicationDirection.Outbound, Outcome = CommunicationOutcome.Resolved,
            OccurredAt = DateTime.UtcNow, Subject = subject, Body = body
        });

    private static string CustomerName(Customer customer) => customer.Type == CustomerType.Company
        ? customer.CompanyName ?? customer.CustomerNumber
        : $"{customer.FirstName} {customer.LastName}".Trim();

    private static string Render(string template, Customer customer) => template
        .Replace("{{firstName}}", customer.FirstName ?? "", StringComparison.OrdinalIgnoreCase)
        .Replace("{{lastName}}", customer.LastName ?? "", StringComparison.OrdinalIgnoreCase)
        .Replace("{{companyName}}", customer.CompanyName ?? "", StringComparison.OrdinalIgnoreCase)
        .Replace("{{customerName}}", CustomerName(customer), StringComparison.OrdinalIgnoreCase);

    private static string StripHtml(string html) => Regex.Replace(html, "<.*?>", string.Empty).Trim();
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

internal static class MarketingCampaignMapper
{
    public static MarketingCampaign Create(MarketingCampaignBody body)
    {
        var campaign = new MarketingCampaign { Id = Guid.NewGuid() };
        Apply(campaign, body);
        return campaign;
    }

    public static void Apply(MarketingCampaign campaign, MarketingCampaignBody body)
    {
        campaign.Name = body.Name.Trim();
        campaign.Subject = body.Subject.Trim();
        campaign.BodyHtml = body.BodyHtml;
        campaign.SmsBody = string.IsNullOrWhiteSpace(body.SmsBody) ? null : body.SmsBody.Trim();
        campaign.ViberBody = string.IsNullOrWhiteSpace(body.ViberBody) ? null : body.ViberBody.Trim();
        campaign.ChannelsJson = JsonSerializer.Serialize(MarketingChannels.Parse(JsonSerializer.Serialize(body.Channels)));
        campaign.SegmentKey = string.IsNullOrWhiteSpace(body.SegmentKey) ? "all" : body.SegmentKey.Trim();
        campaign.OccupationFilter = string.IsNullOrWhiteSpace(body.OccupationFilter) ? null : body.OccupationFilter.Trim();
        campaign.NeedKindFilter = string.IsNullOrWhiteSpace(body.NeedKindFilter) ? null : body.NeedKindFilter.Trim();
        campaign.OnlyUninsuredNeeds = body.OnlyUninsuredNeeds;
        campaign.Status = body.Status;
        campaign.ScheduledFor = body.ScheduledFor;
    }
}
