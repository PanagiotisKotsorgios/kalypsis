using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Policy : TenantEntity
{
    public string PolicyNumber { get; set; } = string.Empty;

    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;

    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public PolicyType PolicyType { get; set; }
    public PolicyStatus Status { get; set; } = PolicyStatus.Draft;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public decimal Premium { get; set; }
    public string Currency { get; set; } = "EUR";

    public Guid? CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }

    public Guid? RenewedFromPolicyId { get; set; }
    public Policy? RenewedFromPolicy { get; set; }

    public ICollection<PolicyDocument> Documents { get; set; } = new List<PolicyDocument>();
    public ICollection<Claim> Claims { get; set; } = new List<Claim>();
    public ICollection<CommissionTransaction> CommissionTransactions { get; set; } = new List<CommissionTransaction>();
}
