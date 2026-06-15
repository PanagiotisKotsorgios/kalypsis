using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class CommissionRule : TenantEntity
{
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public PolicyType? PolicyType { get; set; }

    public CommissionType CommissionType { get; set; }
    public decimal Value { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public class CommissionTransaction : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";

    public CommissionTransactionStatus Status { get; set; } = CommissionTransactionStatus.Pending;

    public DateOnly TransactionDate { get; set; }
    public DateOnly? SettledDate { get; set; }
}
