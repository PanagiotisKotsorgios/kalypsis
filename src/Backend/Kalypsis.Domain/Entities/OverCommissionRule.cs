using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class OverCommissionRule : TenantEntity
{
    public Guid ManagerProducerId { get; set; }
    public Producer ManagerProducer { get; set; } = null!;

    public Guid SubordinateProducerId { get; set; }
    public Producer SubordinateProducer { get; set; } = null!;

    public int Level { get; set; } = 1;
    public decimal Percentage { get; set; }
    public PolicyType? PolicyType { get; set; }
    public bool IsActive { get; set; } = true;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public class ProductionGoal : TenantEntity
{
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public int Year { get; set; }
    public int? Month { get; set; }
    public PolicyType? PolicyType { get; set; }

    public decimal TargetPremium { get; set; }
    public int? TargetPolicies { get; set; }
    public string? Notes { get; set; }
}
