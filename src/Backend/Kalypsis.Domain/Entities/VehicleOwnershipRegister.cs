using Kalypsis.Domain.Common;
namespace Kalypsis.Domain.Entities;

/// <summary>Vehicle-level ownership, independent of historical policyholders and financial transactions.</summary>
public sealed class VehicleOwnershipRegister : TenantEntity
{
    public string VehicleKey { get; set; } = "";
    public string Plate { get; set; } = "";
    public string Vin { get; set; } = "";
    public Guid AnchorPolicyId { get; set; }
    public Guid PrimaryCustomerId { get; set; }
    public string LedgerJson { get; set; } = "";
    public int Revision { get; set; }
}
