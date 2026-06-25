using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Platform-wide newsletter list — captured from the pre-login landing page.
/// Not tenant-scoped; the platform admin manages the full list and sends
/// broadcast campaigns to it.
/// </summary>
public class NewsletterSubscriber : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }            // e.g. "landing", "footer"
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    /// <summary>Set when the subscriber clicks an Unsubscribe link in a campaign.</summary>
    public DateTime? UnsubscribedAt { get; set; }
}

/// <summary>One mass-mail campaign sent to the subscriber list.</summary>
public class NewsletterCampaign : BaseEntity
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? TextBody { get; set; }
    public Guid? SentByUserId { get; set; }
    public DateTime? SentAt { get; set; }
    public int Recipients { get; set; }
    public int Sent { get; set; }
    public int Failed { get; set; }
    public string Status { get; set; } = "Draft";  // Draft / Sending / Sent / PartialFailure
}
