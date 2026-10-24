using Microsoft.EntityFrameworkCore;
using System.Reflection;
using System.Text.Json;
using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Xunit;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kalypsis.Tests;

public sealed class CustomerDesktopCardParityTests
{
    [Fact]
    public async Task Customer_sync_cannot_claim_an_existing_row_from_another_tenant()
    {
        var storage=Guid.NewGuid().ToString("N");var foreignTenant=Guid.NewGuid();var id=Guid.NewGuid();
        await using(var seed=TestScaffold.NewDb(TestScaffold.PlatformAdmin(),TestScaffold.Clock,storage))
        {seed.Customers.Add(new(){Id=id,TenantId=foreignTenant,CustomerNumber="C-FOREIGN",FirstName="Untouched"});await seed.SaveChangesAsync();}
        var user=TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db=TestScaffold.NewDb(user,TestScaffold.Clock,storage);
        var controller=new DesktopSyncController(db,user,NullLogger<DesktopSyncController>.Instance);
        var payload=JsonSerializer.SerializeToElement(new{customers=new[]{new{Id=id,CustomerCode="C-ATTACK",FirstName="Changed"}}});
        var task=(Task<int>)typeof(DesktopSyncController).GetMethod("UpsertAsync",BindingFlags.NonPublic|BindingFlags.Instance)!.MakeGenericMethod(typeof(Customer)).Invoke(controller,[payload,"customers",user.TenantId!.Value,"last_write_wins",new List<string>(),CancellationToken.None])!;
        Assert.Equal(0,await task);
        var row=await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(db.Customers.IgnoreQueryFilters(),c=>c.Id==id);
        Assert.Equal(foreignTenant,row.TenantId);Assert.Equal("Untouched",row.FirstName);
    }
    [Fact]
    public async Task Updating_desktop_customer_clears_sent_nulls_but_keeps_unsent_office_data()
    {
        var user=TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);
        var customer=new Customer{TenantId=user.TenantId!.Value,CustomerNumber="C-SYNC",FirstName="Preserve",Phone="2100000000",SecondaryEmail="old@example.invalid",AssignedAdvisorId=Guid.NewGuid(),Status=Kalypsis.Domain.Enums.CustomerStatus.Blocked};
        db.Customers.Add(customer);await db.SaveChangesAsync();
        var advisor=customer.AssignedAdvisorId;
        var controller=new DesktopSyncController(db,user,NullLogger<DesktopSyncController>.Instance);
        var payload=JsonSerializer.SerializeToElement(new{customers=new[]{new{customer.Id,CustomerCode="C-SYNC",Phone="",Email2=(string?)null}}});
        var task=(Task<int>)typeof(DesktopSyncController).GetMethod("UpsertAsync",BindingFlags.NonPublic|BindingFlags.Instance)!.MakeGenericMethod(typeof(Customer)).Invoke(controller,[payload,"customers",user.TenantId.Value,"last_write_wins",new List<string>(),CancellationToken.None])!;
        Assert.Equal(1,await task);await db.SaveChangesAsync();
        Assert.True(string.IsNullOrEmpty(customer.Phone));Assert.Null(customer.SecondaryEmail);
        Assert.Equal("Preserve",customer.FirstName);Assert.Equal(advisor,customer.AssignedAdvisorId);
        Assert.Equal(Kalypsis.Domain.Enums.CustomerStatus.Blocked,customer.Status);
    }
    private static JsonElement Normalize(object row)
        =>(JsonElement)typeof(DesktopSyncController).GetMethod("NormalizeDesktopRow",BindingFlags.Static|BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(Customer)).Invoke(null,[JsonSerializer.SerializeToElement(row)])!;

    [Fact]
    public void Customer_desktop_contact_and_identity_aliases_reach_web_fields()
    {
        var row=Normalize(new{CustomerCode="QA-CARD",Kind="Individual",AfmVat="012345678",LegalName="Επωνυμία",Origin="Referral",Email2="second@example.invalid",MobilePhone2="6900000001",AltPhone="2100000001",ThirdPhone="2100000002",BirthDate="1985-07-15T00:00:00",DriverLicenseIssuedOn="2010-01-28T00:00:00",DriverLicenseExpiresOn="2030-01-28T00:00:00",HasDrivingLicense=true,IsDriver=true,IsNewDriver=false});
        Assert.Equal("QA-CARD",row.GetProperty("CustomerNumber").GetString());
        Assert.Equal("012345678",row.GetProperty("VatNumber").GetString());
        Assert.Equal("second@example.invalid",row.GetProperty("SecondaryEmail").GetString());
        Assert.Equal("6900000001",row.GetProperty("SecondaryMobilePhone").GetString());
        Assert.Equal("2100000001",row.GetProperty("AltPhone").GetString());
        Assert.Equal("2100000002",row.GetProperty("ThirdPhone").GetString());
        Assert.Equal("1985-07-15",row.GetProperty("BirthDate").GetString());
        Assert.Equal("2010-01-28",row.GetProperty("DriverLicenseIssueDate").GetString());
        Assert.False(row.GetProperty("IsNewDriver").GetBoolean());
    }

    [Theory]
    [InlineData(false,"", "Active")]
    [InlineData(true,"", "Inactive")]
    [InlineData(false,"Πιθανός πελάτης", "Prospect")]
    [InlineData(false,"Prospect", "Prospect")]
    public void Legacy_desktop_customer_status_is_preserved(bool inactive,string category,string expected)
        =>Assert.Equal(expected,Normalize(new{IsInactive=inactive,CustomerCategory=category}).GetProperty("Status").GetString());

    [Theory]
    [InlineData("Active")]
    [InlineData("Inactive")]
    [InlineData("Prospect")]
    [InlineData("Blocked")]
    [InlineData("Churned")]
    public void Explicit_shared_status_wins_over_legacy_flags(string status)
        =>Assert.Equal(status,Normalize(new{Status=status,IsInactive=false}).GetProperty("Status").GetString());
}
