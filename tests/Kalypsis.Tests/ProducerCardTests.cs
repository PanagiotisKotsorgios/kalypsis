using System.Text;
using System.Text.Json;
using FluentValidation;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Behaviors;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kalypsis.Tests;
public sealed class ProducerCardTests
{
    [Theory]
    [InlineData("email","bad@email")]
    [InlineData("phone","abcdef12345")]
    [InlineData("taxId","1234567890")]
    [InlineData("birthDate","2026-02-30")]
    [InlineData("iban","GR0000000000000000000000000")]
    [InlineData("goalLevelCount","2147483648")]
    [InlineData("goalLevelCount","")]
    [InlineData("goalMaximumCommissionPercent","12.555")]
    public void Invalid_fields_are_rejected(string key,string value)
        =>Assert.Throws<FormatException>(()=>ProducerCardSchema.Normalize(ProducerCardSchema.Definition.Fields.Single(x=>x.Key==key),value));

    [Fact]
    public void Schema_has_single_purpose_tabs_and_preserves_unknown_extensions()
    {
        var schema=ProducerCardSchema.Definition;
        Assert.Equal(15,schema.Tabs.Length);Assert.DoesNotContain(schema.Tabs,x=>x.Label.Contains('&'));
        Assert.Equal(schema.Fields.Length,schema.Fields.Select(x=>x.Key).Distinct().Count());
        var p=new Producer{Code="QA",Name="Partner",AdditionalInfoJson="{\"legacy\":{\"value\":17},\"producerCard\":{\"futureField\":\"keep\"}}"};
        var f=schema.Fields.Single(x=>x.Key=="birthDate");ProducerCardSchema.Set(p,f,"1985-07-15",false);
        Assert.Equal("1985-07-15",ProducerCardSchema.Values(p,false)["birthDate"]);
        Assert.Equal("keep",ProducerCardSchema.Metadata(p.AdditionalInfoJson)["futureField"]);
        Assert.Equal(17,JsonDocument.Parse(p.AdditionalInfoJson!).RootElement.GetProperty("legacy").GetProperty("value").GetInt32());
    }

    [Fact]
    public async Task Inline_fields_merge_without_erasing_native_or_metadata_fields_and_parent_cycles_fail()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);
        var p=new Producer{TenantId=current.TenantId!.Value,Code="PARTNER",Name="Original",Notes="keep notes",AdditionalInfoJson="{\"source\":\"legacy\"}"};
        var child=new Producer{TenantId=p.TenantId,Code="CHILD",Name="Child",ParentProducerId=p.Id};db.AddRange(p,child);await db.SaveChangesAsync();
        var services=new ServiceCollection();services.AddLogging();services.AddSingleton<IAppDbContext>(db).AddSingleton<ICurrentUser>(current);
        services.AddMediatR(c=>c.RegisterServicesFromAssemblyContaining<SaveProducerCardFieldsCommand>());
        services.AddValidatorsFromAssemblyContaining<CreateProducerCommand>();services.AddTransient(typeof(IPipelineBehavior<,>),typeof(ValidationBehavior<,>));
        await using var provider=services.BuildServiceProvider();var mediator=provider.GetRequiredService<IMediator>();
        var saved=await mediator.Send(new SaveProducerCardFieldsCommand(p.Id,new(){{"phone","2631051070"},{"birthDate","1985-07-15"}}));
        Assert.Equal("keep notes",p.Notes);Assert.Equal("Original",p.Name);Assert.Equal("2631051070",saved.Values["phone"]);
        Assert.Equal("legacy",JsonDocument.Parse(p.AdditionalInfoJson!).RootElement.GetProperty("source").GetString());
        await Assert.ThrowsAsync<AppException>(()=>mediator.Send(new SaveProducerCardFieldsCommand(p.Id,new(){{"parentProducerId",child.Id.ToString()}})));
        Assert.Null(p.ParentProducerId);
        await mediator.Send(new SaveProducerCardFieldsCommand(p.Id,new(){{"goalLevelCount","6"},{"goalFirstTargetPremium","1200.50"}}));
        Assert.Equal(6,p.GoalLevelCount);Assert.Equal(1200.50m,p.GoalFirstTargetPremium);
    }

    [Fact]
    public async Task Legacy_rates_contacts_and_declarations_share_native_storage_and_no_duplicate_money()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);
        var tenant=current.TenantId!.Value;var p=new Producer{TenantId=tenant,Code="QA",Name="QA"};var company=new InsuranceCompany{TenantId=tenant,Code="C",Name="Carrier"};
        var policy=new Policy{TenantId=tenant,Producer=p,Customer=new(){TenantId=tenant},InsuranceCompany=company,PolicyNumber="POL-1",Currency="EUR"};db.Policies.Add(policy);await db.SaveChangesAsync();
        var controller=new ProducerCardController(db,current,null!,new EphemeralDataProtectionProvider()){ControllerContext=new(){HttpContext=new DefaultHttpContext()}};
        static ProducerCardController.EntryDto D(ActionResult<ProducerCardController.EntryDto> r)=>(ProducerCardController.EntryDto)((OkObjectResult)r.Result!).Value!;
        var rate=D(await controller.Add(p.Id,"rates",new(new(){{"insuranceCompanyId",company.Id.ToString()},{"lineOfBusiness","Auto"},{"expectedPercent","12.5"},{"effectiveFrom","2026-01-01"},{"effectiveTo","2026-12-31"}}),default));
        Assert.Single(db.ProducerExpectedRates);Assert.Equal(12.5m,db.ProducerExpectedRates.Single().ExpectedPercent);
        await controller.Update(p.Id,"rates",rate.Id,new(new(){{"expectedPercent","13"}}),default);
        Assert.Single(db.ProducerExpectedRates);Assert.Equal(13m,db.ProducerExpectedRates.Single().ExpectedPercent);
        Assert.Equal(new DateOnly(2026,12,31),db.ProducerExpectedRates.Single().EffectiveTo);
        var contact=D(await controller.Add(p.Id,"contacts",new(new(){{"label","Λογιστήριο"},{"kind","Email"},{"value","test@example.invalid"}}),default));
        Assert.Single(db.CustomFieldValues);await controller.Update(p.Id,"contacts",contact.Id,new(new(){{"value","second@example.invalid"}}),default);
        Assert.Equal("second@example.invalid",db.CustomFieldValues.Single().Value);
        var declaration=D(await controller.Add(p.Id,"declarations",new(new(){{"policyId",policy.Id.ToString()},{"year","2026"},{"month","10"},{"declaredAmount","25"},{"currency","EUR"},{"status","Pending"}}),default));
        Assert.Single(db.ProducerCommissionDeclarations);Assert.Equal(25m,db.ProducerCommissionDeclarations.Single().ExpectedAmount);
        Assert.Empty(db.FinancialMovements);Assert.Empty(db.Payments);
        await controller.Delete(p.Id,"rates",rate.Id,default);Assert.Empty(await db.ProducerExpectedRates.ToListAsync());
        await controller.Delete(p.Id,"contacts",contact.Id,default);Assert.Empty(await db.CustomFieldValues.ToListAsync());
    }

    [Fact]
    public async Task Secrets_files_overlap_and_tenant_isolation_are_enforced()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var tenant=current.TenantId!.Value;
        var p=new Producer{TenantId=tenant,Code="QA",Name="QA"};var c=new InsuranceCompany{TenantId=tenant,Code="C",Name="C"};db.AddRange(p,c);await db.SaveChangesAsync();
        var controller=new ProducerCardController(db,current,null!,new EphemeralDataProtectionProvider()){ControllerContext=new(){HttpContext=new DefaultHttpContext()}};
        static ProducerCardController.EntryDto D(ActionResult<ProducerCardController.EntryDto> r)=>(ProducerCardController.EntryDto)((OkObjectResult)r.Result!).Value!;
        var account=D(await controller.Add(p.Id,"companies",new(new(){{"insuranceCompanyId",c.Id.ToString()},{"producerCode","001;002"},{"quotePassword","secret-value"}}),default));
        Assert.False(account.Values.ContainsKey("quotePassword"));Assert.Equal("true",account.Values["hasQuotePassword"]);
        Assert.DoesNotContain("secret-value",db.ProducerCardEntries.Single().DataJson);
        account=D(await controller.Update(p.Id,"companies",account.Id,new(new(){{"quotePassword",""},{"notes","keep password"}}),default));Assert.Equal("true",account.Values["hasQuotePassword"]);
        account=D(await controller.Update(p.Id,"companies",account.Id,new(new(){{"quotePassword",null}}),default));Assert.Equal("false",account.Values["hasQuotePassword"]);
        var file=D(await controller.Add(p.Id,"documents",new(new(){{"title","QA"},{"fileName","../../qa.txt"},{"contentBase64",Convert.ToBase64String(Encoding.UTF8.GetBytes("δοκιμή"))}}),default));
        Assert.Equal("qa.txt",file.Values["fileName"]);Assert.False(file.Values.ContainsKey("contentBase64"));
        Assert.DoesNotContain(db.AuditLogs,log=>(log.NewValues??"").Contains("secret-value")||(log.NewValues??"").Contains(Convert.ToBase64String(Encoding.UTF8.GetBytes("δοκιμή"))));
        var download=(FileContentResult)await controller.FileContent(p.Id,file.Id,default);Assert.Equal("δοκιμή",Encoding.UTF8.GetString(download.FileContents));
        await controller.Add(p.Id,"withholdings",new(new(){{"effectiveFrom","2026-01-01"},{"effectiveTo","2026-06-30"},{"percent","10"}}),default);
        await Assert.ThrowsAsync<AppException>(()=>controller.Add(p.Id,"withholdings",new(new(){{"effectiveFrom","2026-06-30"},{"percent","15"}}),default));
        await Assert.ThrowsAsync<AppException>(()=>controller.Entries(Guid.NewGuid(),"contacts",default));
        await Assert.ThrowsAsync<AppException>(()=>controller.Update(p.Id,"companies",Guid.NewGuid(),new(new(){{"notes","foreign"}}),default));
        await Assert.ThrowsAsync<AppException>(()=>controller.Add(p.Id,"transfers",new(new()),default));
    }

    [Fact]
    public async Task Dated_expected_rates_apply_to_each_contract_start_without_rewriting_actual_commissions()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var tenant=current.TenantId!.Value;
        var p=new Producer{TenantId=tenant,Code="DATED",Name="Dated partner"};var c=new InsuranceCompany{TenantId=tenant,Code="C",Name="Carrier"};var customer=new Customer{TenantId=tenant};
        db.AddRange(p,c,customer,new User{Id=current.UserId!.Value,TenantId=tenant,ProducerId=p.Id,Email="qa@example.invalid"});
        foreach(var month in new[]{2,8})db.Policies.Add(new Policy{TenantId=tenant,ProducerId=p.Id,Customer=customer,InsuranceCompany=c,PolicyNumber="POL-"+month,Status=Kalypsis.Domain.Enums.PolicyStatus.Active,PolicyType=Kalypsis.Domain.Enums.PolicyType.Auto,Premium=100,StartDate=new(2026,month,1),EndDate=new(2027,month,1)});
        db.ProducerExpectedRates.AddRange(new(){TenantId=tenant,ProducerId=p.Id,InsuranceCompanyId=c.Id,PolicyType=Kalypsis.Domain.Enums.PolicyType.Auto,ExpectedPercent=10,EffectiveFrom=new(2026,1,1),EffectiveTo=new(2026,6,30)},new(){TenantId=tenant,ProducerId=p.Id,InsuranceCompanyId=c.Id,PolicyType=Kalypsis.Domain.Enums.PolicyType.Auto,ExpectedPercent=20,EffectiveFrom=new(2026,7,1)});
        await db.SaveChangesAsync();
        var rows=await new Kalypsis.Application.Features.ProducerPortal.GetMyRateComparisonHandler(db,current).Handle(new(),default);
        var row=Assert.Single(rows);Assert.Equal(30m,row.MyExpectedAmount);Assert.Equal(15m,row.MyExpectedPercent);Assert.Empty(db.PolicyCommissionSplits);Assert.Empty(db.FinancialMovements);
    }
}
