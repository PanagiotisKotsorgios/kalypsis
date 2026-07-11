using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A single backup snapshot of a tenant's data. The compressed JSON archive
/// itself lives on disk under <c>{Storage__LocalRoot}/backups/{tenantId}/…</c>
/// so we can stream it to the user without ever loading the whole payload
/// into memory. This row is just the manifest — everything you need to
/// list / download / delete without touching the filesystem.
/// </summary>
public class TenantBackup : TenantEntity
{
    /// <summary>Friendly filename shown to the user, e.g. "kalypsis-2026-07-11_143201.json.gz".</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Server-side absolute path used by the download endpoint.</summary>
    public string StoragePath { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    /// <summary>«Manual» = user-triggered, «Auto» = scheduled by the retention runner.</summary>
    public string Kind { get; set; } = "Manual";

    /// <summary>Row counts by domain, JSON — surfaces in the list UI so the
    /// operator knows what the snapshot contains without downloading it.</summary>
    public string? SummaryJson { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
    public string? CreatedByName { get; set; }
}
