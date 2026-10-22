using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public class ProducerSnapshotExportTests
{
    private sealed record OfficeStaff(Guid? TenantId, Guid? AgencyOfficeId) : ICurrentUser
    {
        public Guid? UserId { get; } = Guid.NewGuid();
        public Role? Role => Kalypsis.Domain.Enums.Role.AgencyUser;
        public string? Email => "staff@example.gr";
        public bool IsAuthenticated => true;
        public bool IsPlatformLevel => false;
        public bool IsImpersonating => false;
        public bool AgencyOfficeIsHeadquarters => false;
    }

    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    [InlineData("pdf")]
    public async Task PartnerFiles_UseSelectedOfficeIdentity_AndKeepAllSnapshotRows(string format)
    {
        var tenantId = Guid.NewGuid();
        var officeId = Guid.NewGuid();
        var database = Guid.NewGuid().ToString("N");
        using (var seed = TestScaffold.NewDb(TestScaffold.AgencyStaff(tenantId), TestScaffold.Clock, database))
        {
            seed.Tenants.Add(new Tenant { Id = tenantId, Name = "Κεντρική εταιρεία", Code = "HQ", VatNumber = "123456789" });
            seed.AgencyOffices.Add(new AgencyOffice { Id = officeId, TenantId = tenantId, Name = "Γραφείο Πατρών",
                Code = "PATRA", Address = "Κορίνθου 10", City = "Πάτρα", PostalCode = "26221",
                Phone = "2610123456", Email = "patra@example.gr" });
            await seed.SaveChangesAsync();
        }
        var staff = new OfficeStaff(tenantId, officeId);
        using var db = TestScaffold.NewDb(staff, TestScaffold.Clock, database);
        var controller = new TableExportsController(db, staff);
        var officeResult = await controller.Office();
        var office = Assert.IsType<TableExportsController.ExportOfficeIdentity>(Assert.IsType<OkObjectResult>(officeResult.Result).Value);
        Assert.Equal("Γραφείο Πατρών", office.Name);
        Assert.Equal("PATRA", office.Code);
        Assert.Equal("Κορίνθου 10, Πάτρα, 26221", office.AddressLine);
        Assert.Equal("2610123456", office.ContactPhone);
        Assert.Equal("patra@example.gr", office.ContactEmail);
        Assert.Equal("123456789", office.VatNumber);

        // The browser has filtered/sorted the full list and selected these columns.
        // More than 25 rows ensures export is not truncated to the current page.
        var rows = Enumerable.Range(1, 61).Reverse()
            .Select(i => new string?[] { $"P-{i:0000}", $"Συνεργάτης {i}", "Κατ. Α" }).ToArray();
        var snapshot = new TableExportsController.TableSnapshot("Συνεργάτες", ["Κωδικός", "Όνομα", "Κατηγορία"], rows,
            "Κατάσταση: Ενεργός · Κατηγορία: Α");
        var file = Assert.IsType<FileContentResult>(await controller.Export(snapshot, format));
        Assert.NotEmpty(file.FileContents);
        if (format == "csv")
        {
            Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, file.FileContents.Take(3).ToArray());
            using var reader = new StreamReader(new MemoryStream(file.FileContents), Encoding.UTF8, true);
            var csv = await reader.ReadToEndAsync();
            Assert.StartsWith($"\"{office.Name}\"", csv);
            Assert.Contains(office.ContactEmail!, csv);
            Assert.Contains("\"Κωδικός\",\"Όνομα\",\"Κατηγορία\"", csv);
            Assert.Equal(61, csv.Split('\n').Count(line => line.StartsWith("\"P-")));
            Assert.True(csv.IndexOf("P-0061", StringComparison.Ordinal) < csv.IndexOf("P-0001", StringComparison.Ordinal));
            Assert.DoesNotContain("Κεντρική εταιρεία", csv);
            Assert.DoesNotContain('\uFFFD', csv);
        }
        else if (format == "xlsx")
        {
            using var workbook = new XLWorkbook(new MemoryStream(file.FileContents));
            var sheet = workbook.Worksheets.First();
            Assert.Equal(office.Name, sheet.Cell(1, 1).GetString());
            Assert.Contains(office.ContactEmail!, sheet.Cell(2, 1).GetString());
            Assert.Equal("Κατηγορία", sheet.Cell(4, 3).GetString());
            Assert.Equal("P-0061", sheet.Cell(5, 1).GetString());
            Assert.Equal("P-0001", sheet.Cell(65, 1).GetString());
            Assert.Equal("Κατ. Α", sheet.Cell(65, 3).GetString());
        }
        else Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(file.FileContents.Take(8).ToArray()));
    }

    [Fact]
    public async Task OfficeIdentity_UsesTenantWhenNoBranchIsSelected_AndStaffExportPolicy()
    {
        var staff = new OfficeStaff(Guid.NewGuid(), null);
        using var db = TestScaffold.NewDb(staff, TestScaffold.Clock);
        db.Tenants.Add(new Tenant { Id = staff.TenantId!.Value, Name = "Ασφαλιστικό γραφείο", Code = "HQ",
            AddressLine = "Αθήνα", ContactEmail = "hq@example.gr", ContactPhone = "2101234567" });
        await db.SaveChangesAsync();
        var result = await new TableExportsController(db, staff).Office();
        var office = Assert.IsType<TableExportsController.ExportOfficeIdentity>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal("Ασφαλιστικό γραφείο", office.Name);
        Assert.Equal("Αθήνα", office.AddressLine);
        var policy = Assert.Single(typeof(TableExportsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal("AgencyStaff", policy.Policy);
        Assert.Empty(typeof(TableExportsController).GetMethod(nameof(TableExportsController.Office))!.GetCustomAttributes(typeof(AuthorizeAttribute), true));
    }

    [Fact]
    public async Task OfficeIdentity_CannotResolveAnotherTenantsOffice_OrSilentlyUseHeadquarters()
    {
        var otherTenant = Guid.NewGuid();
        var officeId = Guid.NewGuid();
        var database = Guid.NewGuid().ToString("N");
        using (var seed = TestScaffold.NewDb(TestScaffold.AgencyStaff(otherTenant), TestScaffold.Clock, database))
        {
            seed.Tenants.Add(new Tenant { Id = otherTenant, Name = "Άλλο γραφείο", Code = "OTHER" });
            seed.AgencyOffices.Add(new AgencyOffice { Id = officeId, TenantId = otherTenant, Name = "Ιδιωτικά στοιχεία", Code = "PRIVATE" });
            await seed.SaveChangesAsync();
        }
        var staff = new OfficeStaff(Guid.NewGuid(), officeId);
        using var db = TestScaffold.NewDb(staff, TestScaffold.Clock, database);
        var controller = new TableExportsController(db, staff);
        Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => controller.Office())).StatusCode);
        var snapshot = new TableExportsController.TableSnapshot("Συνεργάτες", ["Όνομα"], [["Μαρία"]]);
        Assert.Equal(404, (await Assert.ThrowsAsync<AppException>(() => controller.Export(snapshot, "csv"))).StatusCode);
    }
}
