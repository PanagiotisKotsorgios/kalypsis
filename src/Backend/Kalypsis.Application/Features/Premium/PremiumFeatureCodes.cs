namespace Kalypsis.Application.Features.Premium;

/// <summary>
/// Well-known premium feature codes. These sit ABOVE the baseline package
/// functionality — a tenant must have the underlying package AND the premium
/// code in TenantPackageGrant.PremiumFeaturesJson to access the feature.
///
/// Keep this list in sync with src/Frontend/web/src/auth/PremiumContext.tsx
/// and the upgrade dialog catalogue.
/// </summary>
public static class PremiumFeatureCodes
{
    /// <summary>Recycle bin with restore-after-30-days. Sits above BackOffice.</summary>
    public const string RecycleBin = "recycle-bin";

    /// <summary>Branded PDF / XLSX exports beyond simple CSV. Sits above BackOffice.</summary>
    public const string AdvancedExports = "advanced-exports";

    /// <summary>Producer-side reconciliation: per-field diff vs agency's system.</summary>
    public const string ProducerReconciliation = "producer-reconciliation";

    /// <summary>Bulk commission rule editor (rather than one row at a time).</summary>
    public const string BulkCommissions = "bulk-commissions";

    /// <summary>Multi-branch agency office switching.</summary>
    public const string MultiBranch = "multi-branch";

    /// <summary>Premium analytics dashboards + scheduled reports.</summary>
    public const string PremiumReports = "premium-reports";

    public static readonly IReadOnlyList<string> All = new[]
    {
        RecycleBin, AdvancedExports, ProducerReconciliation,
        BulkCommissions, MultiBranch, PremiumReports
    };
}
