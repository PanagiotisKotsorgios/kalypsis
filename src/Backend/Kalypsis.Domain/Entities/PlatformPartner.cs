using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A carrier / partner displayed on the public landing trust strip.
/// Managed by the platform superadmin from /app/platform/partners.
/// </summary>
public class PlatformPartner : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? Url { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
