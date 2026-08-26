using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-tenant enable-flag for over-commission (υπερπρομήθειες) bridges.
/// When a row EXISTS for (tenantId, insuranceCompanyId) the tenant has
/// been parametrised for that carrier's OC bridge and it appears as
/// «Διαθέσιμο» on /app/over-commission-bridges. When ABSENT the
/// carrier still shows in the list but as «Μη διαθέσιμο» — the tenant
/// must arrange OC bridge setup with the Kalypsis team first.
///
/// Distinct from <see cref="TenantCarrierOptIn"/> which controls
/// general visibility of a universal carrier across every operational
/// surface (production bridges, policy pickers, etc.). This one is
/// SCOPED TO OC BRIDGES ONLY — production bridges + other surfaces
/// are untouched.
///
/// Rows are created out-of-band (SQL / admin script) today; a proper
/// admin UI can be added later. There's no state on the row itself
/// beyond «this pairing is enabled» — presence = enabled.
/// </summary>
public class TenantOverCommissionBridgeEnable : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public DateTime EnabledAt { get; set; } = DateTime.UtcNow;
    public Guid? EnabledByUserId { get; set; }
    public string? Notes { get; set; }
}
