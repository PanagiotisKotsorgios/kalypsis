using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A registered Kalypsis Desktop installation. The client secret is stored
/// only as a SHA-256 hash; the raw token never persists on the platform.
/// Access state is derived from IsBlocked + AccessExpiresAtUtc + payments.
/// </summary>
public class DesktopLicense : BaseEntity
{
    public string RegistrationCode { get; set; } = string.Empty;
    public string InstallationId { get; set; } = string.Empty;
    public string ClientTokenHash { get; set; } = string.Empty;

    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AfmVat { get; set; }

    public string? MachineName { get; set; }
    public string? OsVersion { get; set; }
    public string? AppVersion { get; set; }
    public DateTime? LastSeenAtUtc { get; set; }

    public decimal AnnualPrice { get; set; }
    public string Currency { get; set; } = "EUR";
    public DateTime? AccessStartsAtUtc { get; set; }
    public DateTime? AccessExpiresAtUtc { get; set; }
    public bool IsBlocked { get; set; }
    public string? BlockReason { get; set; }
    public string? AdminNotes { get; set; }

    public ICollection<DesktopLicensePayment> Payments { get; set; } = new List<DesktopLicensePayment>();
}

/// <summary>Immutable payment history for a Desktop license.</summary>
public class DesktopLicensePayment : BaseEntity
{
    public Guid DesktopLicenseId { get; set; }
    public DesktopLicense? DesktopLicense { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public DateTime PaidAtUtc { get; set; }
    public DateTime AccessStartsAtUtc { get; set; }
    public DateTime AccessExpiresAtUtc { get; set; }
    public string? PaymentMethod { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Guid? RecordedByUserId { get; set; }
}
