using System.Collections.Concurrent;

namespace Kalypsis.Api.Defense;

/// <summary>
/// In-memory IP blocklist with automatic temporary bans. Tracks "violations"
/// (rate-limit rejections, auth failures, suspicious 4xx) per IP in a rolling
/// 10-minute window; when an IP exceeds the threshold it's blocked for 30
/// minutes. Admins can also block manually.
///
/// In-memory is deliberate: ASP.NET process restarts wipe the table, which is
/// fine — restarts are rare and a determined attacker would be re-detected
/// within seconds. Trades persistence for zero-DB-load on every request.
/// </summary>
public sealed class IpBlockService
{
    public const int ViolationThreshold = 12;
    public static readonly TimeSpan ViolationWindow = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan AutoBlockDuration = TimeSpan.FromMinutes(30);

    private readonly ConcurrentDictionary<string, IpRecord> _table = new();
    private readonly ILogger<IpBlockService> _logger;

    public IpBlockService(ILogger<IpBlockService> logger) { _logger = logger; }

    public bool IsBlocked(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return false;
        if (!_table.TryGetValue(ip, out var rec)) return false;
        if (rec.BlockedUntil > DateTime.UtcNow) return true;
        return false;
    }

    public DateTime? BlockedUntil(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return null;
        if (!_table.TryGetValue(ip, out var rec)) return null;
        return rec.BlockedUntil > DateTime.UtcNow ? rec.BlockedUntil : null;
    }

    /// <summary>
    /// Record a single violation for this IP. Three "weights" so a 429 from
    /// the limiter isn't punished as harshly as a malformed/probing request:
    ///   weight=1 — generic suspicious activity, 429 from rate limiter
    ///   weight=2 — failed authentication
    ///   weight=4 — known-bad request shape (path traversal, oversized body, etc.)
    /// </summary>
    public void RecordViolation(string? ip, string reason, int weight = 1)
    {
        if (string.IsNullOrWhiteSpace(ip)) return;
        var now = DateTime.UtcNow;
        var rec = _table.AddOrUpdate(ip,
            _ => new IpRecord { WindowStart = now, ViolationScore = weight },
            (_, existing) =>
            {
                if (now - existing.WindowStart > ViolationWindow)
                {
                    existing.WindowStart = now;
                    existing.ViolationScore = weight;
                }
                else
                {
                    existing.ViolationScore += weight;
                }
                if (existing.ViolationScore >= ViolationThreshold && existing.BlockedUntil < now)
                {
                    existing.BlockedUntil = now.Add(AutoBlockDuration);
                    existing.LastBlockReason = reason;
                }
                return existing;
            });
        if (rec.BlockedUntil > now && rec.LastBlockReason == reason)
        {
            _logger.LogWarning("Auto-blocked IP {Ip} until {Until} — reason: {Reason}", ip, rec.BlockedUntil, reason);
        }
    }

    public void Block(string ip, TimeSpan duration, string reason)
    {
        if (string.IsNullOrWhiteSpace(ip)) return;
        _table.AddOrUpdate(ip,
            _ => new IpRecord { WindowStart = DateTime.UtcNow, BlockedUntil = DateTime.UtcNow.Add(duration), LastBlockReason = reason },
            (_, existing) =>
            {
                existing.BlockedUntil = DateTime.UtcNow.Add(duration);
                existing.LastBlockReason = reason;
                return existing;
            });
        _logger.LogWarning("Manually blocked IP {Ip} for {Duration} — reason: {Reason}", ip, duration, reason);
    }

    public bool Unblock(string ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return false;
        if (_table.TryGetValue(ip, out var rec))
        {
            rec.BlockedUntil = DateTime.MinValue;
            rec.ViolationScore = 0;
            _logger.LogInformation("Unblocked IP {Ip}", ip);
            return true;
        }
        return false;
    }

    public IReadOnlyList<IpBlockEntry> Snapshot()
    {
        var now = DateTime.UtcNow;
        return _table
            .Where(kv => kv.Value.BlockedUntil > now || kv.Value.ViolationScore > 0)
            .Select(kv => new IpBlockEntry(kv.Key, kv.Value.ViolationScore, kv.Value.BlockedUntil, kv.Value.LastBlockReason))
            .OrderByDescending(e => e.BlockedUntil)
            .Take(200)
            .ToList();
    }

    private sealed class IpRecord
    {
        public DateTime WindowStart;
        public int ViolationScore;
        public DateTime BlockedUntil;
        public string? LastBlockReason;
    }
}

public record IpBlockEntry(string Ip, int Score, DateTime BlockedUntil, string? Reason);
