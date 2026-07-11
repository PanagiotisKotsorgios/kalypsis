using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A GDPR Article 17 «right to erasure» request logged for the γραφείο. Any
/// user can file one; the AgencyAdmin reviews, decides, and marks it done.
/// The workflow is deliberately auditable (append-only status transitions
/// with a note trail) since GDPR requires it be traceable.
/// </summary>
public class GdprErasureRequest : TenantEntity
{
    public string RequesterName { get; set; } = string.Empty;
    public string RequesterEmail { get; set; } = string.Empty;
    public string? RequesterPhone { get; set; }

    /// <summary>Optional link to the customer record whose data is being
    /// requested for erasure. When set, the AgencyAdmin UI surfaces a
    /// "Ανοιγμα καρτέλας" link.</summary>
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string Reason { get; set; } = string.Empty;

    /// <summary>Pending / InReview / Approved / Rejected / Completed.</summary>
    public string Status { get; set; } = "Pending";

    public string? Notes { get; set; }

    public Guid? HandledByUserId { get; set; }
    public User? HandledByUser { get; set; }
    public string? HandledByName { get; set; }
    public DateTime? HandledAt { get; set; }
}
