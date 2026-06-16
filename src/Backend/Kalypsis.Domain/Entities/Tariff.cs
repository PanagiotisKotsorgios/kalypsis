using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Tariff : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public PolicyType PolicyType { get; set; }

    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public decimal BasePremium { get; set; }
    public string Currency { get; set; } = "EUR";

    public decimal? CommissionPercent { get; set; }
    public string? FactorsJson { get; set; }
    public string? Notes { get; set; }

    public bool IsActive { get; set; } = true;
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

public class CoverNote : TenantEntity
{
    public string Number { get; set; } = string.Empty;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid? InsuranceCompanyId { get; set; }
    public InsuranceCompany? InsuranceCompany { get; set; }

    public PolicyType PolicyType { get; set; }

    public DateOnly ValidFrom { get; set; }
    public DateOnly ValidUntil { get; set; }

    public decimal? EstimatedPremium { get; set; }
    public string Currency { get; set; } = "EUR";

    public CoverNoteStatus Status { get; set; } = CoverNoteStatus.Active;

    public Guid? ConvertedToPolicyId { get; set; }
    public Policy? ConvertedToPolicy { get; set; }

    public string? Subject { get; set; }
    public string? Notes { get; set; }
}

public class Branch : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FieldsJson { get; set; }
    public string? CoveragesJson { get; set; }
    public bool IsActive { get; set; } = true;
}
