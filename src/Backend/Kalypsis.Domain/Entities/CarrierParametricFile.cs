using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Phase 10.2 — Parametric file for an insurance carrier.
///
/// Two-tier model:
///   - <see cref="TenantId"/> NULL → broadcast file managed by the SUPERADMIN.
///     Uploaded once, available to every tenant. Each tenant must then
///     "install" the latest version.
///   - <see cref="TenantId"/> set → tenant-installed file: a snapshot of the
///     broadcast file that the agency has explicitly activated and is using.
///
/// One active broadcast per (InsuranceCompanyCode + Kind) at a time; one
/// active tenant install per tenant + carrier.
/// </summary>
public class CarrierParametricFile : BaseEntity
{
    /// <summary>Null = global/broadcast (superadmin). Non-null = tenant-installed copy.</summary>
    public Guid? TenantId { get; set; }

    /// <summary>Carrier code (e.g. INTERAMERICAN/ETHNIKI). Carriers identified by code so files broadcast across all tenants regardless of carrier-id mismatches.</summary>
    public string InsuranceCompanyCode { get; set; } = string.Empty;
    public string InsuranceCompanyName { get; set; } = string.Empty;

    /// <summary>Type of parametric content: Tariff / Coverage / Commission / Package / Other.</summary>
    public string Kind { get; set; } = "Tariff";

    public string Version { get; set; } = string.Empty;        // e.g. "2026.06"
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    public string? FileKey { get; set; }                       // path in IFileStorage
    public string? OriginalFileName { get; set; }
    public long? FileSizeBytes { get; set; }
    public string? FileContentType { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>For tenant-installed rows: the broadcast file id this copy is based on.</summary>
    public Guid? BroadcastFileId { get; set; }
    public CarrierParametricFile? BroadcastFile { get; set; }
    public DateTime? InstalledAt { get; set; }

    public Guid? UploadedByUserId { get; set; }
    public string? ChangelogNotes { get; set; }
}
