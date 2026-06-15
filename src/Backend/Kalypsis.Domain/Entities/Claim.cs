using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Claim : TenantEntity
{
    public string ClaimNumber { get; set; } = string.Empty;

    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public DateOnly IncidentDate { get; set; }
    public DateOnly ReportedDate { get; set; }

    public ClaimStatus Status { get; set; } = ClaimStatus.Reported;

    public decimal? ClaimedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string? Description { get; set; }
}
