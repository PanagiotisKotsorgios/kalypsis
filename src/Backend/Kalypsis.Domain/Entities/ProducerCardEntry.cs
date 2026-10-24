using Kalypsis.Domain.Common;
namespace Kalypsis.Domain.Entities;
/// <summary>Owned profile records; monetary settings are not ledger postings.</summary>
public class ProducerCardEntry : TenantEntity
{
    public Guid ProducerId {get;set;}
    public string Kind {get;set;} = "";
    public string DataJson {get;set;} = "{}";
}
