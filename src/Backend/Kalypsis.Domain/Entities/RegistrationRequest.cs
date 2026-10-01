using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public enum RegistrationRequestStatus
{
    New = 0,
    Reviewing = 1,
    Approved = 2,
    Rejected = 3
}

/// <summary>
/// Internal triage state for a registration request. This is intentionally
/// separate from <see cref="RegistrationRequestStatus"/>: approving a
/// request provisions an account, while triage actions (pending, done,
/// follow-up) are safe workflow labels for the platform team.
/// </summary>
public enum RegistrationRequestTriageStatus
{
    New = 0,
    Pending = 1,
    Completed = 2
}

/// <summary>
/// A self-service signup submitted from the public /register page. The
/// platform superadmin reviews these from /app/platform/registrations and
/// either provisions a tenant for the applicant or rejects with notes.
/// </summary>
public class RegistrationRequest : BaseEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? OrganizationName { get; set; }
    public string? VatNumber { get; set; }
    public string? LicenseNumber { get; set; }
    public string? City { get; set; }
    public string? Message { get; set; }
    public string ReferenceCode { get; set; } = string.Empty;

    public RegistrationRequestStatus Status { get; set; } = RegistrationRequestStatus.New;
    public RegistrationRequestTriageStatus TriageStatus { get; set; } = RegistrationRequestTriageStatus.New;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string? Category { get; set; }
    public DateTime? FollowUpAt { get; set; }
    public string? ReviewNotes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // GDPR Άρθρο 28 — αποδοχή της Σύμβασης Επεξεργασίας Προσωπικών Δεδομένων
    // κατά τη στιγμή της αίτησης εγγραφής. Nullable για συμβατότητα με παλιές
    // εγγραφές που δημιουργήθηκαν πριν αυτό το checkpoint· η νέα φόρμα το
    // επιβάλλει ως υποχρεωτικό.
    public bool DpaAccepted { get; set; }
    public string? DpaVersion { get; set; }
    public DateTime? DpaAcceptedAt { get; set; }

    // ── Producer self-registration link ────────────────────────────
    // When someone registers with an email that already appears as a
    // Producer inside an existing tenant (e.g. an agency added them by
    // email before they created a login), we stamp the match here so
    // the SuperAdmin sees «this is not a new agency — this is producer
    // X from tenant Y» and can approve them straight into that tenant
    // as a Producer user rather than spinning up a new γραφείο.
    // Populated at submit time by DetectMatchingProducerAsync.
    // Superadmin can override at approve time (mode=agency vs producer).
    public Guid? MatchedProducerId { get; set; }
    public Guid? MatchedProducerTenantId { get; set; }
    public string? MatchedProducerTenantName { get; set; }
}
