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

    // Phase 8 — Launch gate: when true, agency-side roles (AgencyAdmin/User/Producer)
    // see <c>LaunchGatePage</c> instead of their dashboards. Platform staff + customers
    // are unaffected. Used during pre-launch to expose only the Customer Portal.
    public bool LaunchGateEnabled { get; set; }
    public string? LaunchGateTitle { get; set; }
    public string? LaunchGateMessage { get; set; }

    // Phase 8 — Site-wide maintenance: when true, EVERYONE (including customers and
    // platform staff who haven't overridden) sees a full-screen maintenance page.
    // Used for major migrations or outages.
    public bool MaintenanceModeEnabled { get; set; }
    public string? MaintenanceTitle { get; set; }
    public string? MaintenanceMessage { get; set; }

    public Guid? LastUpdatedByUserId { get; set; }
    public User? LastUpdatedByUser { get; set; }

    /// <summary>
    /// Global email-code 2FA gate. When true, every successful password login
    /// pauses at a challenge step: the backend emails a 6-digit code via Brevo
    /// and the client must POST it to /api/auth/email-code-login to receive
    /// session tokens. Toggled by the Platform admin from Ρυθμίσεις.
    /// </summary>
    public bool RequireEmailLoginCode { get; set; }

    // Per-user monthly usage limits for outbound communications. Read by the
    // profile-page Usage Monitor to draw progress bars and popup «pay for
    // more» when a channel reaches capacity. Nulls fall back to hard-coded
    // defaults in GetMyUsageMonitorHandler.
    public int? EmailMonthlyLimit { get; set; }
    public int? SmsMonthlyLimit { get; set; }
    public int? ViberMonthlyLimit { get; set; }
    public int? PhoneMonthlyLimit { get; set; }
}
