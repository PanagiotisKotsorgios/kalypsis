using System.Text;
using ClosedXML.Excel;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class ProductionGrowthExportTests
{
    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    [InlineData("pdf")]
    public async Task Persisted_customer_needs_to_filtered_grouped_export_include_every_match_beyond_page_one(string format)
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant); var clock = TestScaffold.Clock;
        await using var db = TestScaffold.NewDb(current,clock);
        db.Tenants.Add(new Tenant {Id=tenant,Name="Γραφείο αύξησης παραγωγής",Code="GROWTH"});
        var athens = new Customer {Id=Guid.NewGuid(),TenantId=tenant,CustomerNumber="C-ATH",FirstName="Μαρία",LastName="Δοκιμή",City="Αθήνα"};
        var patra = new Customer {Id=Guid.NewGuid(),TenantId=tenant,CustomerNumber="C-PAT",FirstName="Πελάτης εκτός φίλτρου",City="Πάτρα"};
        db.Customers.AddRange(athens,patra);
        for(var index=0;index<32;index++) db.CustomerInsuranceNeeds.Add(new CustomerInsuranceNeed {Id=Guid.NewGuid(),TenantId=tenant,CustomerId=athens.Id,Kind="Home",Title=$"Ακίνητο {index:D2}",HasAsset=true,Priority=5});
        db.CustomerInsuranceNeeds.AddRange(
            new CustomerInsuranceNeed {Id=Guid.NewGuid(),TenantId=tenant,CustomerId=patra.Id,Kind="Home",Title="Εκτός φίλτρου πόλης",HasAsset=true},
            new CustomerInsuranceNeed {Id=Guid.NewGuid(),TenantId=tenant,CustomerId=athens.Id,Kind="Home",Title="Ήδη ασφαλισμένο",HasAsset=true,IsInsured=true},
            new CustomerInsuranceNeed {Id=Guid.NewGuid(),TenantId=tenant,CustomerId=athens.Id,Kind="Health",Title="Εκτός φίλτρου είδους",HasAsset=true});
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        var source = await new GetProductionGrowthHandler(db,current,clock).Handle(new(),default);
        var matching = source.Where(row=>row.IsOpportunity&&row.City=="Αθήνα"&&row.NeedKind=="Home").OrderBy(row=>row.NeedTitle).ToArray();
        Assert.Equal(32,matching.Length); Assert.Equal(35,source.Count);
        string?[][] rows = [["ΟΜΑΔΑ: Ασφάλιση κατοικίας · 32 εγγραφές","",""],..matching.Select(row=>new string?[] {$"{row.CustomerNumber} · {row.CustomerName}",$"Ασφάλιση κατοικίας · {row.NeedTitle}","Πρόταση ασφάλισης"})];
        var snapshot = new TableExportsController.TableSnapshot("Λίστες αύξησης παραγωγής",["Πελάτης","Προτεινόμενη ασφάλιση / ανάγκη","Κατάσταση ασφάλισης"],rows,
            "Προτάσεις ασφάλισης · Πόλη: Αθήνα · Είδος ασφάλισης: Ασφάλιση κατοικίας · Ομαδοποίηση: Ανά είδος ασφάλισης",32);
        var result = Assert.IsType<FileContentResult>(await new TableExportsController(db,current).Export(snapshot,format));
        Assert.NotEmpty(result.FileContents); Assert.EndsWith($".{format}",result.FileDownloadName);
        if(format=="csv")
        {
            Assert.Equal(new byte[]{0xEF,0xBB,0xBF},result.FileContents.Take(3));
            var text=Encoding.UTF8.GetString(result.FileContents);
            Assert.Contains("Γραφείο αύξησης παραγωγής",text); Assert.Contains("32 εγγραφές",text);
            foreach(var row in matching) Assert.Contains($"Ασφάλιση κατοικίας · {row.NeedTitle}",text);
            foreach(var excluded in new[]{"Πάτρα","Ήδη ασφαλισμένο","Εκτός φίλτρου είδους"}) Assert.DoesNotContain(excluded,text);
            Assert.DoesNotContain('\uFFFD',text);
        }
        else if(format=="xlsx")
        {
            using var workbook=new XLWorkbook(new MemoryStream(result.FileContents)); var sheet=workbook.Worksheets.First();
            Assert.Equal("Γραφείο αύξησης παραγωγής",sheet.Cell(1,1).GetString());
            Assert.Equal(snapshot.Headers[1],sheet.Cell(4,2).GetString());
            Assert.True(sheet.Cell(5,1).Style.Font.Bold);
            for(var index=0;index<matching.Length;index++) Assert.Equal($"Ασφάλιση κατοικίας · {matching[index].NeedTitle}",sheet.Cell(index+6,2).GetString());
            Assert.Contains("Πόλη: Αθήνα",sheet.Cell(2,1).GetString());
        }
        else
        {
            Assert.Equal("application/pdf",result.ContentType);
            Assert.StartsWith("%PDF-",Encoding.ASCII.GetString(result.FileContents));
            Assert.True(result.FileContents.Length>1000);
        }
        Assert.Equal(35,await db.CustomerInsuranceNeeds.CountAsync());
        Assert.All(db.ChangeTracker.Entries(),entry=>Assert.Equal(EntityState.Unchanged,entry.State));
    }
}
