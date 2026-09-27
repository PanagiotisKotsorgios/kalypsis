using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>Per-office switchboard for the electronic GDPR acknowledgement.</summary>
public class TenantGdprSigningSettings : TenantEntity
{
    public bool Enabled { get; set; }
    public bool RequireOfficeSignature { get; set; }
    public bool RequireInsurerSignature { get; set; }
    public bool SendInsurerEmail { get; set; }
    public int LinkExpirationDays { get; set; } = 30;
    public string TemplateCode { get; set; } = "gdpr-consent-cover-v1";
}

public enum CustomerFormSigningStatus
{
    Draft = 0,
    PendingCustomer = 1,
    PendingOffice = 2,
    PendingInsurer = 3,
    Completed = 4,
    Declined = 5,
    Expired = 6,
    Cancelled = 7
}

public enum CustomerFormSigningRecipientRole
{
    Customer = 1,
    Office = 2,
    Insurer = 3
}

/// <summary>
/// One immutable, auditable instance of a customer form. The customer and
/// policy values are snapshotted so a later edit to the CRM card cannot alter
/// what was signed.
/// </summary>
public class CustomerFormSigning : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public Guid? PolicyId { get; set; }
    public Policy? Policy { get; set; }
    public string FormCode { get; set; } = "gdpr-consent";
    public string FormVersion { get; set; } = "cover-v1";
    public CustomerFormSigningStatus Status { get; set; } = CustomerFormSigningStatus.Draft;
    public bool RequireOfficeSignature { get; set; }
    public bool RequireInsurerSignature { get; set; }
    public bool SendInsurerEmail { get; set; }
    public bool? CustomerConsented { get; set; }
    public string CustomerFullNameSnapshot { get; set; } = string.Empty;
    public string? CustomerEmailSnapshot { get; set; }
    public string? OfficeEmailSnapshot { get; set; }
    public string? InsurerEmailSnapshot { get; set; }
    /// <summary>
    /// Immutable mail-merged answers for forms that have fields in addition to
    /// the customer/policy snapshot (for example the client-needs questionnaire).
    /// It is intentionally kept on the signing instance so later CRM edits do
    /// not change a document that has already been sent for signature.
    /// </summary>
    public string? FormDataJson { get; set; }
    public string? CustomerSignaturePath { get; set; }
    public string? OfficeSignaturePath { get; set; }
    public string? InsurerSignaturePath { get; set; }
    public string? DraftDocumentPath { get; set; }
    public string? FinalDocumentPath { get; set; }
    public string FileName { get; set; } = "gdpr-consent.pdf";
    public DateTime ExpiresAt { get; set; }
    public DateTime? CustomerSignedAt { get; set; }
    public DateTime? OfficeSignedAt { get; set; }
    public DateTime? InsurerSignedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public string? Notes { get; set; }
    public ICollection<CustomerFormSigningLink> Links { get; set; } = new List<CustomerFormSigningLink>();
}

/// <summary>Single-use, hashed public link for one signer.</summary>
public class CustomerFormSigningLink : TenantEntity
{
    public Guid SigningId { get; set; }
    public CustomerFormSigning Signing { get; set; } = null!;
    public CustomerFormSigningRecipientRole RecipientRole { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
