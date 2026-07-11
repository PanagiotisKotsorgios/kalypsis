using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-tenant policy for scheduled backups. Singleton row per tenant. The
/// hosted <c>AutoBackupService</c> polls this table on a short interval and
/// creates a fresh backup whenever <c>LastAutoBackupAt</c> is older than
/// <c>FrequencyDays</c>.
/// </summary>
public class TenantBackupPolicy : TenantEntity
{
    public bool Enabled { get; set; } = false;

    /// <summary>1 = daily, 7 = weekly, 30 = monthly (approx). 0 = every run.</summary>
    public int FrequencyDays { get; set; } = 7;

    /// <summary>How many most-recent auto backups to keep. Older ones are
    /// pruned by the same hosted service to keep disk usage bounded.</summary>
    public int RetentionCount { get; set; } = 8;

    public DateTime? LastAutoBackupAt { get; set; }

    public Guid? LastEditedByUserId { get; set; }
    public User? LastEditedByUser { get; set; }
}
