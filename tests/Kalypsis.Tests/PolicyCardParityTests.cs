using System.Text.Json.Nodes;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;
public class PolicyCardParityTests
{
    private static Policy Policy()=>new(){PolicyNumber="CARD-1",PolicyType=PolicyType.Auto,SpecsJson="{\"carrier\":{\"keep\":[1,true]},\"vehicle\":{\"vin\":\"OLD\",\"make\":\"Toyota\"}}",NetPremium=80m,VatAmount=20m};
    [Fact]public void Card_preserves_carrier_data_and_legacy_amounts_and_reads_all_optional_fields()
    {
        var p=Policy();var changes=PolicyCardExtras.Fields.ToDictionary(x=>"card:"+x.Key,x=>x.Value.Kind switch{"date"=>"2026-10-24","integer"=>x.Key=="year"?"2020":"3","boolean"=>"true","guid"=>Guid.NewGuid().ToString(),_=>"δοκιμή"});
        PolicyRiskProfile.Apply(p,changes,new HashSet<Guid>());var values=PolicyRiskProfile.Read(p);foreach(var (key,value) in changes)Assert.Equal(value,values[key]);
        var root=JsonNode.Parse(p.SpecsJson!)!;Assert.Equal("OLD",root["vehicle"]!["vin"]!.ToString());Assert.Equal("1",root["carrier"]!["keep"]![0]!.ToString());Assert.Equal(80,p.NetPremium);Assert.Equal(20,p.VatAmount);
        Assert.True(p.PaidOnCredit);Assert.Equal(new DateOnly(2026,10,24),p.PaymentPromisedOn);Assert.Equal("δοκιμή",p.Notes);Assert.DoesNotContain("MedicalExamsNotes",p.SpecsJson!);
    }
    [Fact]public void Single_field_clear_does_not_erase_other_card_fields()
    {
        var p=Policy();PolicyRiskProfile.Apply(p,new Dictionary<string,string>{{"card:brand","Ford"},{"card:notes","keep"},{"card:paymentPromisedOn","2026-10-25"}},new HashSet<Guid>());
        PolicyRiskProfile.Apply(p,new Dictionary<string,string>{{"card:paymentPromisedOn",""},{"card:brand",""}},new HashSet<Guid>());var values=PolicyRiskProfile.Read(p);Assert.Null(p.PaymentPromisedOn);Assert.Equal("",values["card:brand"]);Assert.Equal("keep",p.Notes);Assert.Equal("OLD",JsonNode.Parse(p.SpecsJson!)!["vehicle"]!["vin"]!.ToString());
    }
    [Theory][InlineData("card:year","1800")][InlineData("card:year","2020.5")][InlineData("card:insuredAgeAtIssue","150")][InlineData("card:commissionPolicyYear","0")][InlineData("card:paidOnCredit","yes")][InlineData("card:paymentPromisedOn","2026-02-30")][InlineData("card:supplierOfficeId","bad")][InlineData("card:premium","999")][InlineData("card:creditReason",null)]
    public void Invalid_edits_are_atomic(string key,string value){var p=Policy();var original=p.SpecsJson;Assert.Throws<AppException>(()=>PolicyRiskProfile.Apply(p,new Dictionary<string,string>{{"card:notes","must not save"},{key,value}},new HashSet<Guid>()));Assert.Equal(original,p.SpecsJson);Assert.Null(p.Notes);}
    [Fact]public async Task Foreign_references_and_foreign_parent_are_rejected()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var p=Policy();p.Id=Guid.NewGuid();p.TenantId=current.TenantId!.Value;db.Policies.Add(p);await db.SaveChangesAsync();var api=new PolicyRiskProfileController(db,current);
        Assert.Equal(404,(await Assert.ThrowsAsync<AppException>(()=>api.CardOptions(Guid.NewGuid(),default))).StatusCode);
        Assert.Equal(400,(await Assert.ThrowsAsync<AppException>(()=>api.Update(p.Id,new(new(){{"card:supplierOfficeId",Guid.NewGuid().ToString()}}),default))).StatusCode);
        Assert.IsType<OkObjectResult>((await api.CardOptions(p.Id,default)).Result);
    }
}
