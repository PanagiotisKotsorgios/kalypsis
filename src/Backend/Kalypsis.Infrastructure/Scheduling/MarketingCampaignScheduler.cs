using Kalypsis.Application.Features.Marketing;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>Dispatches campaigns marked Scheduled once their requested time arrives.</summary>
public sealed class MarketingCampaignScheduler : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<MarketingCampaignScheduler> _logger;

    public MarketingCampaignScheduler(IServiceScopeFactory scopes, ILogger<MarketingCampaignScheduler> logger)
    { _scopes = scopes; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DispatchDueCampaigns(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            { _logger.LogError(ex, "Scheduled campaign dispatch failed."); }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task DispatchDueCampaigns(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
        var dueIds = await db.MarketingCampaigns.IgnoreQueryFilters()
            .Where(campaign => campaign.DeletedAt == null
                && campaign.Status == CampaignStatus.Scheduled
                && campaign.ScheduledFor != null
                && campaign.ScheduledFor <= DateTime.UtcNow)
            .Select(campaign => campaign.Id)
            .ToListAsync(ct);

        foreach (var campaignId in dueIds)
        {
            await mediator.Send(new SendMarketingCampaignCommand(campaignId), ct);
            _logger.LogInformation("Scheduled marketing campaign {CampaignId} dispatched.", campaignId);
        }
    }
}
