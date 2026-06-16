using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class MarketingCampaign : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;

    public string? SegmentKey { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;

    public int Recipients { get; set; }
    public int Sent { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ScheduledFor { get; set; }
}

public class DeliveryRecord : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public DeliveryChannel Channel { get; set; } = DeliveryChannel.Email;
    public DeliveryStatus Status { get; set; } = DeliveryStatus.Pending;

    public DateTime? DispatchedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? AcknowledgedAt { get; set; }

    public string? Reference { get; set; }
    public string? Notes { get; set; }
}

public class DocumentFolder : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public Guid? ParentFolderId { get; set; }
    public DocumentFolder? Parent { get; set; }

    public string Color { get; set; } = "#0b2545";
}

public class PartnerPortalAccess : TenantEntity
{
    public Guid ProducerId { get; set; }
    public Producer Producer { get; set; } = null!;

    public bool IsActive { get; set; } = true;
    public bool CanIssuePolicies { get; set; } = false;
    public bool CanViewCommissions { get; set; } = true;
    public bool CanViewCustomers { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class ThirdPartyApiKey : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public string Scopes { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public class DiasCode : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public string RfCode { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public DiasPaymentStatus Status { get; set; } = DiasPaymentStatus.Pending;
    public DateTime? PaidAt { get; set; }
    public string? BankReference { get; set; }
    public DateOnly DueDate { get; set; }
}

public class AccountingExport : TenantEntity
{
    public int Year { get; set; }
    public int Month { get; set; }
    public DateTime RunAt { get; set; }
    public ImportStatus Status { get; set; } = ImportStatus.Pending;
    public int Entries { get; set; }
    public string? FileName { get; set; }
    public string? Notes { get; set; }
}

public class KepyoReport : TenantEntity
{
    public int Year { get; set; }
    public DateTime RunAt { get; set; }
    public ImportStatus Status { get; set; } = ImportStatus.Pending;
    public int Suppliers { get; set; }
    public int Customers { get; set; }
    public decimal TotalAmount { get; set; }
    public string? FileName { get; set; }
}

public class MagneticImport : TenantEntity
{
    public string FileName { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public ImportStatus Status { get; set; } = ImportStatus.Pending;
    public int Rows { get; set; }
    public int Matched { get; set; }
    public int Failed { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }
}
