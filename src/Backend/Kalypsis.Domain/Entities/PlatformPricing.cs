using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Singleton (one row) holding the entire editable pricing catalog:
/// base plans (with extras-per-office / extras-per-user), addons, and
/// ad-hoc service defaults. Stored as JSON so the superadmin can add
/// / remove / edit rows without a schema migration each time.
///
/// The plans page + chargeables page both read from here; the old
/// hard-coded PLAN_DEFAULTS + ADDON_DEFAULTS + SERVICE_DEFAULTS
/// arrays in the frontend became defaults for fresh installs only,
/// applied by the seeder when this row is missing.
/// </summary>
public class PlatformPricing : BaseEntity
{
    /// <summary>Serialized <see cref="Catalog"/>. Format v1.</summary>
    public string CatalogJson { get; set; } = "{}";
    public int Version { get; set; } = 1;

    public Guid? LastUpdatedByUserId { get; set; }
    public User? LastUpdatedByUser { get; set; }
}
