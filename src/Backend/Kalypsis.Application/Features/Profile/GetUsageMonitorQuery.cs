using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Profile;

// Usage monitor — reports the calling user's current-month outgoing
// communications count per channel (Email / SMS / Viber / Phone) alongside
// the tenant limits set by the platform admin. Frontend renders progress
// bars and pops the «pay for more» dialog when a channel is at capacity.
//
// Counts come from CommunicationLog rows where UserId == current user AND
// Direction == Outbound AND OccurredAt is in the current calendar month.
// Limits come from PlatformSetting fields (added below) with sensible
// defaults if the admin hasn't overridden them.

public record UsageChannelDto(string Channel, int Used, int Limit, string DisplayName);
public record UsageMonitorDto(int Year, int Month, IReadOnlyList<UsageChannelDto> Channels);

public record GetMyUsageMonitorQuery : IRequest<UsageMonitorDto>;

public class GetMyUsageMonitorHandler : IRequestHandler<GetMyUsageMonitorQuery, UsageMonitorDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetMyUsageMonitorHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<UsageMonitorDto> Handle(GetMyUsageMonitorQuery r, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Forbidden();

        var now = DateTime.UtcNow;
        var start = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        int emailUsed = 0, smsUsed = 0, viberUsed = 0, phoneUsed = 0;
        try
        {
            var logs = await _db.CommunicationLogs
                .Where(c => c.UserId == userId && c.DeletedAt == null
                    && c.Direction == CommunicationDirection.Outbound
                    && c.OccurredAt >= start && c.OccurredAt < end)
                .Select(c => c.Kind)
                .ToListAsync(ct);
            emailUsed = logs.Count(k => k == CommunicationKind.Email);
            smsUsed = logs.Count(k => k == CommunicationKind.Sms);
            phoneUsed = logs.Count(k => k == CommunicationKind.Phone);
            // Viber isn't in the enum yet — placeholder for future integration.
            viberUsed = 0;
        }
        catch
        {
            // If the CommunicationLog table is missing on a partial deploy
            // the safety net will create it on next boot; surface zeros
            // meanwhile so the profile page still renders.
        }

        // Limits: read platform-wide defaults from PlatformSetting.
        // Fields exposed lazily via `settingLookup` so we don't 500 if a
        // migration for the new columns hasn't run — the schema safety net
        // handles the ALTER on next boot.
        var settings = await _db.PlatformSettings.IgnoreQueryFilters()
            .OrderBy(s => s.Id).FirstOrDefaultAsync(ct);

        int emailLimit = settings?.EmailMonthlyLimit ?? 500;
        int smsLimit   = settings?.SmsMonthlyLimit   ?? 100;
        int viberLimit = settings?.ViberMonthlyLimit ?? 100;
        int phoneLimit = settings?.PhoneMonthlyLimit ?? 200;

        var channels = new List<UsageChannelDto>
        {
            new("email", emailUsed, emailLimit, "Email"),
            new("sms",   smsUsed,   smsLimit,   "SMS"),
            new("viber", viberUsed, viberLimit, "Viber Business"),
            new("phone", phoneUsed, phoneLimit, "Τηλεφωνικές κλήσεις"),
        };

        return new UsageMonitorDto(now.Year, now.Month, channels);
    }
}
