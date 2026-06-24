using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Phase 7 — Commercial contract between Kalypsis and an agency tenant.
/// Each γραφείο can have one active contract at a time plus historical
/// (terminated, renewed-from) records. The signed PDF is stored via
/// <see cref="IFileStorage"/> and referenced by <see cref="ContractFileKey"/>.
/// </summary>
public class TenantContract : TenantEntity
{
    public string ContractNumber { get; set; } = string.Empty;       // e.g. KAL-2026-001
    public DateOnly SignedAt { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }                       // null = open-ended

    public string Plan { get; set; } = "Custom";                     // Starter / Pro / Enterprise / Custom
    public decimal MonthlyBaseAmount { get; set; }
    public decimal OfficeSurchargePerExtra { get; set; }
    public int OfficeIncludedCount { get; set; } = 1;
    public string Currency { get; set; } = "EUR";

    public bool AutoRenew { get; set; } = true;
    public int RenewalTermMonths { get; set; } = 12;

    public string? SignedByName { get; set; }
    public string? SignedByEmail { get; set; }
    public string? SignedByRole { get; set; }                        // "Διαχειριστής" etc.

    public string? ContractFileKey { get; set; }                     // path returned by IFileStorage
    public string? ContractFileName { get; set; }
    public long? ContractFileSizeBytes { get; set; }

    /// <summary>An older contract this one renewed or amended.</summary>
    public Guid? RenewedFromContractId { get; set; }
    public TenantContract? RenewedFromContract { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime? TerminatedAt { get; set; }
    public string? TerminationReason { get; set; }

    public string? Notes { get; set; }
}
