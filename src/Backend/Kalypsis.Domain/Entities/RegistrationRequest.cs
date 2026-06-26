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
    public string? ReviewNotes { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByUserId { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
