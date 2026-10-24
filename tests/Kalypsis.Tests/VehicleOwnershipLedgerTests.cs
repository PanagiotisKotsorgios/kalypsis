using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.VehicleOwnership;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class VehicleOwnershipLedgerTests
{
    private static readonly DateOnly Today = new(2026,8,26);
    private static readonly DateTimeOffset Now = new(2026,8,26,12,0,0,TimeSpan.Zero);
    private static OwnershipPerson Person(string name, decimal? share=100,Guid? customer=null) => new(Guid.NewGuid(),customer??Guid.NewGuid(),name,"",share,new(2026,7,1));
    private static OwnershipLedger Initial(OwnershipPerson owner) => OwnershipRules.Replace(new(1,0,owner.Id,[owner],[]),[owner],owner.Id,new(new(2026,7,1)),Today,Now);
    [Fact] public void Partial_then_full_transfer_merges_shares_without_rounding_drift_and_keeps_history()
    {
        var anna=Person("Άννα");var bob=Person("Βασίλης",0);var first=Initial(anna);
        var partial=OwnershipRules.Transfer(first,anna.Id,bob,33.33m,false,new(new(2026,7,2),"Πώληση"),Today,Now);
        Assert.Equal(66.67m,partial.Owners.Single(p=>p.Id==anna.Id).Percentage);Assert.Equal(100m,partial.Owners.Sum(p=>p.Percentage));Assert.Equal(anna.Id,partial.PrimaryOwnerId);
        var full=OwnershipRules.Transfer(partial,anna.Id,bob,66.67m,false,new(new(2026,7,3),"Πώληση"),Today,Now);
        Assert.Single(full.Owners);Assert.Equal(100m,full.Owners[0].Percentage);Assert.Equal(bob.Id,full.PrimaryOwnerId);Assert.Equal(3,full.Revision);
        Assert.Equal(100m,full.Events[1].Before[0].Percentage);Assert.Equal(anna.Id,first.PrimaryOwnerId);Assert.Equal(100m,first.Owners[0].Percentage);
        var reversed=OwnershipRules.ReverseLast(full,new(new(2026,7,4),"Λάθος μεταβίβαση"),Today,Now);
        Assert.Equal(4,reversed.Revision);Assert.Equal(anna.Id,reversed.PrimaryOwnerId);Assert.Equal(66.67m,reversed.Owners.Single(p=>p.Id==anna.Id).Percentage);
        Assert.Equal(full.Events[^1].Id,reversed.Events[^1].ReversesId);Assert.Equal(4,reversed.Events.Length);
    }
    [Theory]
    [InlineData(-1)] [InlineData(0)] [InlineData(100.01)] [InlineData(33.333)]
    public void Transfer_rejects_invalid_amounts(decimal share)
    {var a=Person("Α");Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(Initial(a),a.Id,Person("Β",0),share,false,new(Today,"Πώληση"),Today,Now));}
    [Fact] public void Duplicate_people_invalid_totals_dates_and_self_transfers_are_rejected()
    {
        var a=Person("Α");var state=Initial(a);var b=Person("Β",50);
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Replace(state,[a with{Percentage=50},b with{CustomerId=a.CustomerId}],a.Id,new(Today,"Διόρθωση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Replace(state,[a with{Percentage=50},b with{Percentage=49.99m}],a.Id,new(Today,"Διόρθωση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Replace(state,[a with{CustomerId=null}],a.Id,new(Today,"Διόρθωση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(state,a.Id,a,10,false,new(Today,"Πώληση"),Today,Now));
        var shared=OwnershipRules.Replace(state,[a with{Percentage=50},b],a.Id,new(Today,"Συνιδιοκτησία"),Today,Now);
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(shared,a.Id,b with{CustomerId=a.CustomerId},10,false,new(Today,"Πώληση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(state,a.Id,b,10,false,new(Today.AddDays(1),"Πώληση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(state,a.Id,b,10,false,new(new(2026,6,30),"Πώληση"),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(state,a.Id,b,10,false,new(Today),Today,Now));
        Assert.Throws<OwnershipException>(()=>OwnershipRules.ReverseLast(state,new(Today,"Διόρθωση"),Today,Now));
    }
    [Fact] public void Legacy_unknown_shares_stay_unknown_and_technical_json_is_preserved()
    {
        var person=Person("Α");var legacy=OwnershipRules.Legacy("{\"insurer\":{\"keep\":true}}",Guid.NewGuid(),person.CustomerId!.Value,"Α","012345678");
        Assert.Null(legacy.Owners[0].Percentage);Assert.Equal("012345678",legacy.Owners[0].VatNumber);
        Assert.Throws<OwnershipException>(()=>OwnershipRules.Transfer(legacy,legacy.PrimaryOwnerId,Person("Β",0),10,false,new(Today,"Πώληση"),Today,Now));
        var current=OwnershipRules.Replace(legacy,[legacy.Owners[0] with{Percentage=100}],legacy.PrimaryOwnerId,new(Today),Today,Now);
        var specs=OwnershipRules.ToSpecs("{\"insurer\":{\"keep\":true}}",current);Assert.True(OwnershipRules.Object(specs)["insurer"]!["keep"]!.GetValue<bool>());
        Assert.Equal(current.PrimaryOwnerId,OwnershipRules.Deserialize(OwnershipRules.Serialize(current)).PrimaryOwnerId);
    }
    [Fact] public void Legacy_manual_owner_is_not_silently_linked_to_an_unrelated_policyholder()
    {
        var state=OwnershipRules.Legacy("{\"vehicleOwnership\":[{\"name\":\"Άλλος ιδιοκτήτης\",\"vatNumber\":\"123456789\",\"percentage\":100}]}",Guid.NewGuid(),Guid.NewGuid(),"Συμβαλλόμενος","012345678");
        Assert.Null(state.Owners[0].CustomerId);Assert.Equal("Άλλος ιδιοκτήτης",state.Owners[0].Name);
    }
    [Fact] public async Task Registry_updates_current_vehicle_owner_but_never_historical_policy_or_financials()
    {
        var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);
        var old=new Customer{TenantId=user.TenantId!.Value,FirstName="Άννα",LastName="Πρώτη",CustomerNumber="C1",VatNumber="012345678"};
        var next=new Customer{TenantId=user.TenantId.Value,FirstName="Βασίλης",LastName="Νέος",CustomerNumber="C2",VatNumber="123456789"};
        var policy=new Policy{TenantId=user.TenantId.Value,PolicyNumber="OWN-1",VehicleRegistrationPlate="ΑΒΕ1234",CustomerId=old.Id,Customer=old,Premium=134,NetPremium=100,StartDate=new(2026,7,1),EndDate=new(2027,7,1),SpecsJson="{\"make\":\"Toyota\",\"insurer\":{\"keep\":true}}"};
        db.Customers.AddRange(old,next);db.Policies.Add(policy);await db.SaveChangesAsync();
        var handler=new VehicleOwnershipHandler(db,user,TestScaffold.Clock);var initial=await handler.Handle(new GetVehicleOwnership(policy.Id),default);
        var first=initial.Ledger.Owners[0] with{Percentage=100};
        var saved=await handler.Handle(new ChangeVehicleOwnership(policy.Id,new(0,"replace",new(new(2026,7,1)),[first],first.Id)),default);
        var recipient=new OwnershipPerson(Guid.NewGuid(),next.Id,"untrusted","",0);
        var transfer=await handler.Handle(new ChangeVehicleOwnership(policy.Id,new(saved.Ledger.Revision,"transfer",new(new(2026,7,2),"Πώληση"),FromOwnerId:first.Id,Recipient:recipient,Percentage:100)),default);
        Assert.Equal(next.Id,OwnershipRules.Primary(transfer.Ledger).CustomerId);Assert.Equal("Νέος Βασίλης",OwnershipRules.Primary(transfer.Ledger).Name);
        Assert.Equal(old.Id,policy.CustomerId);Assert.Equal(134,policy.Premium);Assert.Equal(new DateOnly(2026,7,1),policy.StartDate);Assert.DoesNotContain("vehicleOwnershipLedger",policy.SpecsJson);
        var list=await new VehicleRegisterQueryHandler(db,user).Handle(new(),default);Assert.Equal(next.Id,Assert.Single(list).Owners[0].CustomerId);
        var stale=await Assert.ThrowsAsync<AppException>(()=>handler.Handle(new ChangeVehicleOwnership(policy.Id,new(1,"reverse",new(Today,"Λάθος"))),default));Assert.Equal(409,stale.StatusCode);
        await Assert.ThrowsAsync<AppException>(()=>new DeleteCustomerCommandHandler(db,user,TestScaffold.Clock).Handle(new(next.Id),default));
        var foreign=new VehicleOwnershipHandler(db,TestScaffold.AgencyStaff(Guid.NewGuid()),TestScaffold.Clock);
        await Assert.ThrowsAsync<AppException>(()=>foreign.Handle(new GetVehicleOwnership(policy.Id),default));
    }
    [Fact] public async Task Revision_is_a_real_database_concurrency_token()
    {
        var user=TestScaffold.AgencyStaff(Guid.NewGuid());var name=Guid.NewGuid().ToString();await using var a=TestScaffold.NewDb(user,TestScaffold.Clock,name);await using var b=TestScaffold.NewDb(user,TestScaffold.Clock,name);
        var row=new VehicleOwnershipRegister{TenantId=user.TenantId!.Value,VehicleKey="TEST",Revision=1};a.VehicleOwnershipRegisters.Add(row);await a.SaveChangesAsync();
        var stale=await b.VehicleOwnershipRegisters.SingleAsync();row.Revision=2;await a.SaveChangesAsync();stale.Revision=2;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(()=>b.SaveChangesAsync());
    }
}
