using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public enum CompanyBridgeKind
{
    Manual = 1,
    ApiPull = 2,
    Email = 3,
    Ftp = 4,
    Webhook = 5
}

public class CompanyBridge : TenantEntity
{
    public string Name { get; set; } = string.Empty;

    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public CompanyBridgeKind Kind { get; set; } = CompanyBridgeKind.Manual;

    /// <summary>JSON config (endpoint, credentials reference, mapping, schedule).</summary>
    public string? ConfigJson { get; set; }

    public bool IsActive { get; set; } = true;
    public bool AutoSync { get; set; } = false;

    public DateTime? LastSyncAt { get; set; }
    public int LastSyncRows { get; set; }
    public string? LastSyncStatus { get; set; }
    public string? Notes { get; set; }
}
