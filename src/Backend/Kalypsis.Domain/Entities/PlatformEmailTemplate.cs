using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Phase 8.5 — Platform-level email template. Distinct from
/// <see cref="EmailTemplate"/> (per-tenant). These templates are sent by the
/// Kalypsis platform itself to agencies and end users — welcome emails,
/// contract notifications, system announcements, renewal warnings, etc.
///
/// The superadmin manages them from `/app/platform/email-templates`. Each
/// template has a code (unique), a trigger event, optional Brevo template id
/// (if the email is sent via Brevo's hosted templates), HTML + plain bodies,
/// and a JSON sample of merge variables for the preview.
/// </summary>
public class PlatformEmailTemplate : BaseEntity
{
    public string Code { get; set; } = string.Empty;            // unique e.g. "platform.welcome"
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;
    public string? BodyPlain { get; set; }
    public string Language { get; set; } = "el";

    /// <summary>Event that triggers automatic sending. Null = manual only.</summary>
    public string? TriggerEvent { get; set; }                   // tenant.created / tenant.contract.signed / etc.

    /// <summary>Sample JSON of merge variables used by the live preview.</summary>
    public string? SampleVariablesJson { get; set; }

    /// <summary>Optional Brevo hosted template id — when set the API call uses templateId instead of HTML body.</summary>
    public int? BrevoTemplateId { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsSystem { get; set; }                          // seeded — cannot be deleted

    public DateTime? LastSentAt { get; set; }
    public int TimesSent { get; set; }
}
