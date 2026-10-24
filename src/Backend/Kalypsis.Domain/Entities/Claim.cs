using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Claim : TenantEntity
{
    public string? CarrierClaimNumber { get; set; }
    public string? IncidentTime { get; set; }
    public string? IncidentLocation { get; set; }
    public string? IncidentCity { get; set; }
    public string? IncidentCause { get; set; }
    public string? DamageDescription { get; set; }
    public bool? PoliceInvolved { get; set; }
    public string? PoliceStation { get; set; }
    public string? PoliceReportNumber { get; set; }
    public Guid? GarageId { get; set; }
    public Garage? Garage { get; set; }
    public string? AssessorName { get; set; }
    public string? AssessorPhone { get; set; }
    public string? AssessorEmail { get; set; }
    public string? CarrierContactName { get; set; }
    public string? CarrierContactPhone { get; set; }
    public DateOnly? ReportedToCarrierDate { get; set; }
    public DateOnly? InspectionDate { get; set; }
    public DateOnly? RepairStartedDate { get; set; }
    public DateOnly? RepairCompletedDate { get; set; }
    public DateOnly? NextActionDate { get; set; }
    public DateOnly? ClosedDate { get; set; }

    public string Kind { get; set; } = "VehicleDamage";
    public decimal? SettledAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string ClaimNumber { get; set; } = string.Empty;

    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public DateOnly IncidentDate { get; set; }
    public DateOnly ReportedDate { get; set; }

    public ClaimStatus Status { get; set; } = ClaimStatus.Reported;

    public decimal? ClaimedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string? Description { get; set; }

    // Phase 12 — Greek insurance specifics (BluByte parity)
    public bool AffectsBonusMalus { get; set; } = true;       // false for glass breakage, etc.
    public string? UsaeCode { get; set; }                       // κωδικός ΥΣΑΕ
    public string? UsaeKind { get; set; }                       // είδος ΥΣΑΕ
    public string UsaeStatus { get; set; } = "NotSent";        // NotSent/Pending/Accepted/Rejected
    public decimal? LiabilityPercent { get; set; }             // ευθύνη
    public bool IsInternalDamage { get; set; }                 // εσωτερική vs εξωτερική ζημία
    public DateTime? UsaeSentAt { get; set; }
    public string? UsaeReceiptCode { get; set; }
    public bool IsFriendlySettlement { get; set; }             // Φιλικός Διακανονισμός
}
