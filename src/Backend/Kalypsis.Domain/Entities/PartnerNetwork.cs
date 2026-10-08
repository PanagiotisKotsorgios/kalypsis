using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Optional tenant-owned grouping for producers, broker networks and teams.
/// It is deliberately separate from Producer.ParentProducerId: a producer can
/// participate in more than one network without changing the commission tree.
/// </summary>
public class PartnerNetwork : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string NetworkType { get; set; } = "Δίκτυο συνεργατών";
    public string Status { get; set; } = "Ενεργό";
    public string? ManagerName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? SecondaryEmail { get; set; }
    public string? SecondaryPhone { get; set; }
    public string? TaxId { get; set; }
    public string? TaxOffice { get; set; }
    public string? BusinessType { get; set; }
    public string? ProfessionalCategory { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }
    public string? Website { get; set; }
    public string? LogoPath { get; set; }
    public string? ContractNumber { get; set; }
    public DateOnly? ContractStartDate { get; set; }
    public DateOnly? ContractEndDate { get; set; }
    public string? CommissionPolicyJson { get; set; }
    public string? Notes { get; set; }

    public ICollection<PartnerNetworkMember> Members { get; set; } = new List<PartnerNetworkMember>();
    public ICollection<PartnerNetworkDocument> Documents { get; set; } = new List<PartnerNetworkDocument>();
}

public class PartnerNetworkMember : TenantEntity
{
    public Guid PartnerNetworkId { get; set; }
    public PartnerNetwork PartnerNetwork { get; set; } = null!;
    public Guid ProducerId { get; set; }
    public Producer Producer { get; set; } = null!;
    public string Role { get; set; } = "Συνεργάτης";
    public bool IsActive { get; set; } = true;
    public DateOnly? JoinedAt { get; set; }
    public DateOnly? LeftAt { get; set; }
    public decimal? CommissionPercentOverride { get; set; }
    public decimal? TargetPercent { get; set; }
    public string? Notes { get; set; }
}

public class PartnerNetworkDocument : TenantEntity
{
    public Guid PartnerNetworkId { get; set; }
    public PartnerNetwork PartnerNetwork { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string Category { get; set; } = "Γενικά";
    public string? Notes { get; set; }
    public Guid? UploadedByUserId { get; set; }
}
