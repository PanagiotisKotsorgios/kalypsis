using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A CRM sales opportunity / lead. This is deliberately separate from a
/// customer, policy or task: it represents a possible piece of business
/// until the office wins or loses it.
/// </summary>
public class CrmOpportunity : TenantEntity
{
    public string Title { get; set; } = string.Empty;
    public string Stage { get; set; } = "New"; // New, Contacted, Quoted, FollowUp, Won, Lost
    public string? Product { get; set; }
    public string? Carrier { get; set; }
    public decimal? EstimatedValue { get; set; }
    public DateTime? NextActionAt { get; set; }
    public string? LostReason { get; set; }
    public string? Notes { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }
}
