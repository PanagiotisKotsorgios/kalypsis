using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Platform-wide announcement banner shown to every user after login until
/// they dismiss it. Authored by Platform admins from
/// /app/platform/announcements, typically after a redeploy to publish
/// release notes. Not tenant-scoped — one announcement reaches every
/// office. Users dismiss with the × on the banner; the dismissal is
/// stored per-user in <see cref="UserAnnouncementDismissal"/> so it
/// never appears again for that user (but stays visible to everyone
/// who hasn't seen it yet).
/// </summary>
public class PlatformAnnouncement : BaseEntity
{
    /// <summary>Short headline shown bold on the banner (~60 chars).</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Body text. Plain text; newlines rendered as line breaks by
    /// the client. Not markdown to keep the render trivially safe.</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>«info» (default, blue), «success» (green, releases),
    /// «warning» (amber, planned maintenance), «error» (red, outages).
    /// Any other value falls back to info on the client.</summary>
    public string Severity { get; set; } = "info";

    /// <summary>Free-form version tag surfaced next to the title, e.g.
    /// «2.11.0» or «Δεκέμβριος 2026». Optional.</summary>
    public string? Version { get; set; }

    /// <summary>Optional URL rendered as a «Μάθε περισσότερα» link on the
    /// banner. Same-origin recommended; the client opens in a new tab.</summary>
    public string? LinkUrl { get; set; }
    public string? LinkLabel { get; set; }

    /// <summary>Toggled off by admin without deleting — the row stays in
    /// history but is filtered out of the active-for-user query. Default
    /// true so a fresh create is immediately visible.</summary>
    public bool IsEnabled { get; set; } = true;

    /// <summary>Author of the announcement (Platform admin).</summary>
    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
}

/// <summary>
/// One row per (announcement, user) that records the user pressing × on
/// a banner. Presence of a row = "never show this to this user again".
/// Platform-scope (no tenant) — a user's dismissal follows them across
/// tenants they're impersonating.
/// </summary>
public class UserAnnouncementDismissal : BaseEntity
{
    public Guid AnnouncementId { get; set; }
    public PlatformAnnouncement Announcement { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime DismissedAt { get; set; }
}
