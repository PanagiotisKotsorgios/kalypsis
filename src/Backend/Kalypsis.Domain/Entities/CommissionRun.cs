using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public enum CommissionRunStatus { Draft = 1, Finalised = 2, Cancelled = 3 }

public class CommissionRun : TenantEntity
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string Title { get; set; } = string.Empty;
    public CommissionRunStatus Status { get; set; } = CommissionRunStatus.Draft;

    public DateTime GeneratedAt { get; set; }
    public DateTime? FinalisedAt { get; set; }

    public Guid? GeneratedByUserId { get; set; }
    public User? GeneratedByUser { get; set; }

    public Guid? FilterInsuranceCompanyId { get; set; }
    public InsuranceCompany? FilterInsuranceCompany { get; set; }

    public Guid? FilterProducerId { get; set; }
    public Producer? FilterProducer { get; set; }

    public PolicyType? FilterPolicyType { get; set; }
    public string? FilterPackageCode { get; set; }

    public int LineCount { get; set; }
    public decimal TotalCommission { get; set; }
    public decimal TotalPremium { get; set; }
    public string Currency { get; set; } = "EUR";

    public string? Notes { get; set; }

    public ICollection<CommissionRunLine> Lines { get; set; } = new List<CommissionRunLine>();
}

public class CommissionRunLine : TenantEntity
{
    public Guid CommissionRunId { get; set; }
    public CommissionRun CommissionRun { get; set; } = null!;

    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public PolicyType PolicyType { get; set; }
    public string? PackageCode { get; set; }

    public decimal Premium { get; set; }
    public decimal RatePercent { get; set; }
    public decimal CommissionAmount { get; set; }

    public bool IsOverridden { get; set; }
    public decimal? OriginalCommissionAmount { get; set; }
    public string? OverrideReason { get; set; }

    public string Currency { get; set; } = "EUR";
}
