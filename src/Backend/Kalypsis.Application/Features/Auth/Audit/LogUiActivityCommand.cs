using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;

namespace Kalypsis.Application.Features.Audit;

/// <summary>
/// Persists a bounded batch of privacy-safe browser interaction events. The
/// browser deliberately sends labels and paths only; it never sends form or
/// search values to the audit trail.
/// </summary>
public record LogUiActivityCommand(
    IReadOnlyList<UiActivityEventDto>? Events,
    string? IpAddress,
    string? UserAgent) : IRequest<int>;

public class LogUiActivityCommandHandler : IRequestHandler<LogUiActivityCommand, int>
{
    private static readonly HashSet<string> AllowedCategories = new(StringComparer.Ordinal)
    {
        "Navigation", "Click", "Search", "Form", "Authentication", "Data", "System"
    };

    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTimeProvider _clock;

    public LogUiActivityCommandHandler(IAppDbContext db, ICurrentUser currentUser, IDateTimeProvider clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<int> Handle(LogUiActivityCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId ?? throw AppException.Unauthorized();
        var events = request.Events?.Take(50).ToList() ?? [];
        if (events.Count == 0) return 0;

        var now = _clock.UtcNow;
        var ipAddress = Clean(request.IpAddress, 64, null);
        var userAgent = Clean(request.UserAgent, 512, null);

        foreach (var activity in events)
        {
            var category = Clean(activity.Category, 48, "Click")!;
            if (!AllowedCategories.Contains(category)) category = "Click";

            var eventId = Guid.NewGuid();
            _db.AuditLogs.Add(new AuditLog
            {
                Id = eventId,
                CreatedAt = now,
                TenantId = _currentUser.TenantId,
                UserId = userId,
                EntityName = "EmployeeActivity",
                EntityId = eventId.ToString("N"),
                Action = Clean(activity.Action, 64, "Interaction")!,
                Category = category,
                PagePath = CleanPagePath(activity.PagePath),
                Target = Clean(activity.Target, 256, "Χωρίς τίτλο"),
                Metadata = "{\"source\":\"browser\"}",
                IpAddress = ipAddress,
                UserAgent = userAgent
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        return events.Count;
    }

    private static string? Clean(string? value, int maxLength, string? fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var clean = new string(value.Trim().Where(c => !char.IsControl(c)).ToArray());
        if (clean.Length == 0) return fallback;
        return clean.Length <= maxLength ? clean : clean[..maxLength];
    }

    private static string CleanPagePath(string? value)
    {
        var path = Clean(value, 512, "/app")!;
        return path.StartsWith("/app", StringComparison.Ordinal) ? path : "/app";
    }
}
