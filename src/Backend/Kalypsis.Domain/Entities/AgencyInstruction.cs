using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-tenant instructions / handbook / notes maintained by the AgencyAdmin
/// and readable by every staff member of the same γραφείο. Rendered as
/// sanitised HTML in the sidebar page and exportable to PDF for print.
///
/// One row per tenant (singleton). We store a full row rather than a
/// column on Tenant so it can be soft-deleted and audited independently.
/// </summary>
public class AgencyInstruction : TenantEntity
{
    /// <summary>Free-text title, defaults to «Οδηγίες γραφείου».</summary>
    public string Title { get; set; } = "Οδηγίες γραφείου";

    /// <summary>Rendered HTML. Sanitised on write to strip &lt;script&gt; etc.</summary>
    public string ContentHtml { get; set; } = string.Empty;

    /// <summary>Who last edited — surfaced in the read-only view so staff
    /// know who to ask about a specific line.</summary>
    public Guid? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }
    public string? UpdatedByName { get; set; }
}
