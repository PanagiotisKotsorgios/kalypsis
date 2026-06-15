using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Singleton row holding platform-wide configuration that can be edited by the
/// Platform admin through the UI (e.g. email sender credentials).
/// </summary>
public class PlatformSetting : BaseEntity
{
    public string? BrevoApiKey { get; set; }
    public string? BrevoSenderEmail { get; set; }
    public string? BrevoSenderName { get; set; }
    public string? SupportEmail { get; set; }
    public string? AppBaseUrl { get; set; }

    public Guid? LastUpdatedByUserId { get; set; }
    public User? LastUpdatedByUser { get; set; }
}
