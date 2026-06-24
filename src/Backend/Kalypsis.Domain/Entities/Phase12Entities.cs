using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 12 — BluByte InsuranceWorks parity. Greek-insurance-specific features
// the legacy desktop app exposed that modern brokers still need.
// ============================================================================

// ----- Φιλικός Διακανονισμός (friendly settlement / direct settlement) -----
public class FriendlySettlement : TenantEntity
{
    public Guid ClaimId { get; set; }
    public string SettlementFileNumber { get; set; } = string.Empty;   // αρ. φακέλου
    public DateOnly DeclarationDate { get; set; }                       // ημ. δήλωσης
    public string? SettlementAuthority { get; set; }                    // αρμόδιος φορέας
    public DateOnly? SettlementDate { get; set; }                       // ημ. συμβιβασμού
    public decimal? AgreedAmount { get; set; }
    public decimal? VatAmount { get; set; }
    public decimal? FeeAmount { get; set; }                              // δικαστικά / έξοδα
    public decimal? InterestAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Status { get; set; } = "Open";                        // Open / InProgress / Closed / Disputed
    public string? OtherPartyInsurer { get; set; }                      // αντίθετη ασφαλιστική
    public string? OtherPartyPolicy { get; set; }
    public string? AppraisorName { get; set; }                          // πραγματογνώμονας
    public DateOnly? AppraisalDate { get; set; }
    public string? Notes { get; set; }

    public Claim? Claim { get; set; }
    public List<ClaimVictim> Victims { get; set; } = new();
}

// ----- Παθόντες (victims / claimants per claim) -----
public class ClaimVictim : TenantEntity
{
    public Guid ClaimId { get; set; }
    public Guid? FriendlySettlementId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Afm { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string VictimType { get; set; } = "Person";                  // Person / Vehicle / Property
    public string? VehiclePlate { get; set; }
    public string? Description { get; set; }                            // περιγραφή ζημιάς
    public decimal? ReserveAmount { get; set; }                          // πρόβλεψη ποσού
    public decimal? PaidAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string Status { get; set; } = "Open";                        // Open / Settled / Rejected

    public Claim? Claim { get; set; }
    public FriendlySettlement? FriendlySettlement { get; set; }
    public List<SettlementPayment> Payments { get; set; } = new();
}

// ----- Παροχές / πληρωμές ανά παθόντα (payments breakdown per victim) -----
public class SettlementPayment : TenantEntity
{
    public Guid ClaimVictimId { get; set; }
    public DateOnly PaidOn { get; set; }
    public string PayeeType { get; set; } = "Victim";                   // Victim / Hospital / Garage / Other
    public string? PayeeName { get; set; }
    public Guid? GarageId { get; set; }
    public decimal NetAmount { get; set; }
    public decimal VatAmount { get; set; }
    public decimal FeeAmount { get; set; }                                // δικαστικά / έξοδα
    public decimal InterestAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "EUR";
    public string PaymentMethod { get; set; } = "BankTransfer";
    public string? Reference { get; set; }
    public string? Notes { get; set; }

    public ClaimVictim? Victim { get; set; }
}

// ----- Αναγνώριση Κλήσης (caller-ID log) -----
public class CallerIdLog : TenantEntity
{
    public DateTime ReceivedAt { get; set; }
    public string CallerNumber { get; set; } = string.Empty;
    public Guid? MatchedCustomerId { get; set; }
    public string? MatchedCustomerName { get; set; }
    public string? Direction { get; set; } = "Inbound";                 // Inbound / Outbound
    public int? DurationSeconds { get; set; }
    public bool Answered { get; set; }
    public Guid? HandledByUserId { get; set; }
    public string? Notes { get; set; }

    public Customer? MatchedCustomer { get; set; }
    public User? HandledByUser { get; set; }
}

// ----- ΥΣΑΕ submissions (auxiliary tracker — claims-side, separate from myDATA) -----
public class UsaeSubmission : TenantEntity
{
    public Guid ClaimId { get; set; }
    public string SubmissionNumber { get; set; } = string.Empty;
    public DateTime SubmittedAt { get; set; }
    public string Status { get; set; } = "Pending";                     // Pending / Accepted / Rejected
    public string? AcknowledgementCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? PayloadJson { get; set; }

    public Claim? Claim { get; set; }
}

// ----- Αξιόγραφα-έγγραφο: Vehicle Models (lookup table for cars) -----
public class VehicleModel : TenantEntity
{
    public string Manufacturer { get; set; } = string.Empty;             // εργοστάσιο
    public string Model { get; set; } = string.Empty;
    public string? Trim { get; set; }
    public int? EngineCc { get; set; }
    public int? HorsePower { get; set; }
    public string? FuelType { get; set; }
    public string? Category { get; set; }                                // passenger / van / motorcycle / truck
    public bool IsActive { get; set; } = true;
}
