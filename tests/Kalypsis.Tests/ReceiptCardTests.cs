using Kalypsis.Application.Features.Financials;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Xunit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MediatR;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Behaviors;

namespace Kalypsis.Tests;
public sealed class ReceiptCardTests
{
    [Theory]
    [InlineData("instrumentAmount","-1")]
    [InlineData("instrumentAmount","1.001")]
    [InlineData("instrumentDueOn","2026-02-31")]
    [InlineData("documentType","unknown")]
    [InlineData("withoutDocument","yes")]
    public void Invalid_dossier_values_are_rejected(string key,string value)=>Assert.Throws<FormatException>(()=>ReceiptDossierRules.Merge(null,new Dictionary<string,string?>{{key,value}}));

    [Fact]
    public void Dossier_merge_preserves_unknown_extensions_and_allows_clearing()
    {
        var json=ReceiptDossierRules.Merge("{\"externalReference\":\"001\",\"series\":\"A\"}",new Dictionary<string,string?>{{"series",null},{"bankName","Τράπεζα δοκιμής"}});
        var values=ReceiptDossierRules.Read(json);
        Assert.Equal("001",values["externalReference"]);Assert.False(values.ContainsKey("series"));Assert.Equal("Τράπεζα δοκιμής",values["bankName"]);
    }

    [Fact]
    public async Task Partial_receipts_and_metadata_edits_keep_one_cash_movement_and_correct_totals()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var tenant=current.TenantId!.Value;
        var customer=new Customer{TenantId=tenant,FirstName="Δοκιμή",LastName="Είσπραξης"};
        var company=new InsuranceCompany{TenantId=tenant,Code="RC",Name="QA"};
        var policy=new Policy{TenantId=tenant,Customer=customer,InsuranceCompany=company,PolicyNumber="RC-POL",Currency="EUR",Premium=100,StartDate=new(2026,1,1),EndDate=new(2027,1,1)};
        db.Policies.Add(policy);await db.SaveChangesAsync();
        var body=new ReceiptBody("RC-1",new(2026,6,1),customer.Id,policy.Id,PaymentMethod.Cheque,25,"EUR","keep",null,new(){{"series","A"},{"instrumentNumber","00012"},{"instrumentAmount","100.00"}});
        var created=await new CreateReceiptCommandHandler(db,current).Handle(new(body),default);
        Assert.Equal(25,db.FinancialMovements.Single().Amount);Assert.Equal("00012",created.Details!["instrumentNumber"]);
        var update=new UpdateReceiptCommandHandler(db,current);
        var metadata=await update.Handle(new(created.Id,body with{Details=new(){{"bankName","QA bank"}}}),default);
        Assert.Single(db.FinancialMovements);Assert.Equal(25,db.FinancialMovements.Single().Amount);Assert.Equal("A",metadata.Details!["series"]);
        await update.Handle(new(created.Id,body with{Amount=40,Details=null}),default);
        Assert.Single(db.FinancialMovements);Assert.Equal(40,db.FinancialMovements.Single().Amount);
        var card=await new GetReceiptCardQueryHandler(db,current).Handle(new(created.Id),default);
        Assert.Equal("60.00 EUR",card.Related["remaining"]);Assert.Equal("QA bank",card.Receipt.Details!["bankName"]);
        policy.PaidDirectlyToCarrier=true;await db.SaveChangesAsync();
        card=await new GetReceiptCardQueryHandler(db,current).Handle(new(created.Id),default);
        Assert.Equal("0.00 EUR",card.Related["remaining"]);Assert.Equal("40.00 EUR",card.Related["totalReceived"]);
    }

    [Fact]
    public async Task A_receipt_cannot_be_linked_to_another_customers_policy()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var tenant=current.TenantId!.Value;
        var owner=new Customer{TenantId=tenant};var other=new Customer{TenantId=tenant};var company=new InsuranceCompany{TenantId=tenant,Code="RC",Name="QA"};
        var policy=new Policy{TenantId=tenant,Customer=owner,InsuranceCompany=company,PolicyNumber="RC-POL",Currency="EUR",Premium=100};db.AddRange(policy,other);await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(()=>new CreateReceiptCommandHandler(db,current).Handle(new(new("RC-X",new(2026,6,1),other.Id,policy.Id,PaymentMethod.Cash,10,"EUR",null,null)),default));
        Assert.Empty(db.Receipts);Assert.Empty(db.FinancialMovements);
    }

    [Fact]
    public async Task Card_lookup_rejects_a_receipt_outside_the_current_tenant()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());var foreign=Guid.NewGuid();var database=Guid.NewGuid().ToString();Guid id;
        await using(var seed=TestScaffold.NewDb(TestScaffold.AgencyStaff(foreign),TestScaffold.Clock,database)){
            var receipt=new Receipt{TenantId=foreign,Number="FOREIGN",Customer=new(){TenantId=foreign}};seed.Receipts.Add(receipt);await seed.SaveChangesAsync();id=receipt.Id;
        }
        await using var db=TestScaffold.NewDb(current,TestScaffold.Clock,database);
        await Assert.ThrowsAsync<AppException>(()=>new GetReceiptCardQueryHandler(db,current).Handle(new(id),default));
    }

    [Fact]
    public async Task Partial_field_endpoint_preserves_unmentioned_values_and_validates_the_posting()
    {
        var current=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(current,TestScaffold.Clock);var tenant=current.TenantId!.Value;
        var customer=new Customer{TenantId=tenant,FirstName="QA"};db.Customers.Add(customer);await db.SaveChangesAsync();
        var receipt=await new CreateReceiptCommandHandler(db,current).Handle(new(new("PATCH-1",new(2026,10,24),customer.Id,null,PaymentMethod.Cash,25,"EUR","keep notes",null)),default);
        var services=new ServiceCollection();services.AddLogging();services.AddSingleton<IAppDbContext>(db).AddSingleton<ICurrentUser>(current);
        services.AddMediatR(c=>c.RegisterServicesFromAssemblyContaining<CreateReceiptCommand>());
        services.AddValidatorsFromAssemblyContaining<ReceiptBodyValidator>();services.AddTransient(typeof(IPipelineBehavior<,>),typeof(ValidationBehavior<,>));
        await using var provider=services.BuildServiceProvider();var mediator=provider.GetRequiredService<IMediator>();
        var saved=await mediator.Send(new UpdateReceiptFieldsCommand(receipt.Id,new(){{"series","A"},{"amount","40.25"}}));
        Assert.Equal(40.25m,saved.Amount);Assert.Equal("keep notes",saved.Notes);Assert.Equal("A",saved.Details!["series"]);
        Assert.Single(db.FinancialMovements);Assert.Equal(40.25m,db.FinancialMovements.Single().Amount);
        await Assert.ThrowsAsync<AppException>(()=>mediator.Send(new UpdateReceiptFieldsCommand(receipt.Id,new(){{"createdAt","2026-10-25"}})));
        await Assert.ThrowsAsync<ValidationException>(()=>mediator.Send(new UpdateReceiptFieldsCommand(receipt.Id,new(){{"amount","0"}})));
        Assert.Equal(40.25m,db.FinancialMovements.Single().Amount);
    }
}
