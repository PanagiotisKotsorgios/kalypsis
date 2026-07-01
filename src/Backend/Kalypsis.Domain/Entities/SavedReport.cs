using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A saved filter set for one of the reporting pages (production-lists,
/// commission-runs, financials). The «Report» here is really a bookmark:
/// name + entity + JSON blob of filters that the page rehydrates when opened.
/// </summary>
public class SavedReport : TenantEntity
{
    public Guid OwnerUserId { get; set; }

    /// <summary>What page this saved filter applies to (e.g. «production-lists»).</summary>
    public string Entity { get; set; } = string.Empty;

    /// <summary>User-visible label.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Free-form JSON of the filter state at save time.</summary>
    public string FiltersJson { get; set; } = "{}";

    /// <summary>Shared with other agency users? Otherwise private to owner.</summary>
    public bool IsShared { get; set; }
}
