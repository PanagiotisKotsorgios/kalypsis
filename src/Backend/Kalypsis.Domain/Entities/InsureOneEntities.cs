using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-office presentation and access settings for the InsureOne partner desk.
/// The public slug is deliberately owned by the office and resolved server-side
/// before authentication; it is never treated as a tenant id supplied by the
/// browser.
/// </summary>
public class InsureOneOfficeSettings : TenantEntity
{
    public Guid AgencyOfficeId { get; set; }
    public AgencyOffice AgencyOffice { get; set; } = null!;

    public string Slug { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public string? DisplayName { get; set; }
    public string? WelcomeMessage { get; set; }
    public string PrimaryColor { get; set; } = "#0b6fb8";
    public string SecondaryColor { get; set; } = "#0b2545";
    public string? SupportEmail { get; set; }
    public string? SupportPhone { get; set; }
    public string? LogoPath { get; set; }
    /// <summary>Stable JSON array of branch keys permitted in this desk.</summary>
    public string AllowedBranchesJson { get; set; } = "[]";
}

/// <summary>
/// Extra InsureOne identity and policy flags attached to the existing
/// PartnerPortalAccess record. User credentials remain in the central User
/// table so password, lockout, refresh-token and 2FA rules stay consistent.
/// </summary>
public class InsureOnePartnerPermission : TenantEntity
{
    public Guid PartnerPortalAccessId { get; set; }
    public PartnerPortalAccess PartnerPortalAccess { get; set; } = null!;
    public string PermissionCode { get; set; } = string.Empty;
    public bool IsAllowed { get; set; } = true;
}
