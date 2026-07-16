using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-carrier bridge parsing configuration built visually by the SuperAdmin
/// through the browser instead of hard-coded in an analyzer. Stores the whole
/// pipeline as JSON: file type, sheet/header hints, column-to-target mappings,
/// transformations and filters. A runtime interpreter reads the JSON + a file
/// upload and produces normalized rows — no code change needed to onboard a
/// new carrier once the config exists.
///
/// Distinct from the shipped analyzers (ERGO / Grand Cover / Ατλαντική /
/// Interlife) which are still coded in Kalypsis.Application/CarrierBridges.
/// When both exist the shipped analyzer wins; this config takes over only
/// for carriers marked "InDevelopment" in the platform catalog.
/// </summary>
public class CarrierBridgeConfig : BaseEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    /// <summary>"xlsx" | "csv" | "txt" | "zip"</summary>
    public string FileType { get; set; } = "xlsx";

    /// <summary>What the config produces. "Policy" | "Customer" | "Receipt" | "Commission"</summary>
    public string RecordType { get; set; } = "Policy";

    /// <summary>Full config document — see BridgeConfigDoc in the handlers project for the shape.</summary>
    public string ConfigJson { get; set; } = "{}";

    /// <summary>Version bump on every save. Lets the SuperAdmin roll back via manifest history.</summary>
    public int Version { get; set; } = 1;

    /// <summary>False = the runtime skips this config even if it exists. Lets an operator
    /// experiment without breaking the live import path.</summary>
    public bool Enabled { get; set; } = true;

    public Guid? LastUpdatedByUserId { get; set; }
    public string? Notes { get; set; }
}
