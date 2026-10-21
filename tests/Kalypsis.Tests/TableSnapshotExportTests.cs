using System.Text;
using ClosedXML.Excel;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public class TableSnapshotExportTests
{
    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    [InlineData("pdf")]
    public async Task Export_FormatsTheSuppliedRowsAndColumnOrder_WithOfficeHeading(string format)
    {
        var tenantId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenantId);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Γραφείο δοκιμής", Code = "OFFICE" });
        await db.SaveChangesAsync();
        var controller = new TableExportsController(db, current);
        var snapshot = new TableExportsController.TableSnapshot("Λίστα πελατών", ["Πόλη", "Πελάτης"],
            [["Αθήνα", "Νίκος Άλφα"], ["Αθήνα", "Μαρία Ωμέγα"]], "Πόλη: Αθήνα");
        var result = Assert.IsType<FileContentResult>(await controller.Export(snapshot, format));
        Assert.EndsWith($".{format}", result.FileDownloadName);
        Assert.NotEmpty(result.FileContents);
        if (format == "csv")
        {
            var csv = Encoding.UTF8.GetString(result.FileContents);
            Assert.StartsWith("\"Γραφείο δοκιμής\"", csv);
            Assert.Contains("\"Πόλη\",\"Πελάτης\"", csv);
            Assert.True(csv.IndexOf("Νίκος Άλφα", StringComparison.Ordinal) < csv.IndexOf("Μαρία Ωμέγα", StringComparison.Ordinal));
            Assert.DoesNotContain("Kalypsis — Λίστα πελατών", csv);
        }
        else if (format == "xlsx")
        {
            using var stream = new MemoryStream(result.FileContents);
            using var workbook = new XLWorkbook(stream);
            var sheet = workbook.Worksheets.First();
            Assert.Equal("Γραφείο δοκιμής", sheet.Cell(1, 1).GetString());
            Assert.Equal("Πόλη", sheet.Cell(4, 1).GetString());
            Assert.Equal("Πελάτης", sheet.Cell(4, 2).GetString());
            Assert.Equal("Νίκος Άλφα", sheet.Cell(5, 2).GetString());
            Assert.Equal("Μαρία Ωμέγα", sheet.Cell(6, 2).GetString());
            Assert.Contains("Πόλη: Αθήνα", sheet.Cell(2, 1).GetString());
        }
        else
        {
            Assert.Equal("application/pdf", result.ContentType);
            Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(result.FileContents.Take(8).ToArray()));
        }
    }

    [Fact]
    public async Task Export_RejectsMalformedRowsAndUnsupportedFormat()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var controller = new TableExportsController(db, current);
        await Assert.ThrowsAsync<AppException>(() => controller.Export(
            new TableExportsController.TableSnapshot("Λίστα", ["Πελάτης"], [["Ένα", "Δύο"]]), "pdf"));
        await Assert.ThrowsAsync<AppException>(() => controller.Export(
            new TableExportsController.TableSnapshot("Λίστα", [], []), "pdf"));
        await Assert.ThrowsAsync<AppException>(() => controller.Export(
            new TableExportsController.TableSnapshot("Λίστα", ["Πελάτης"], []), "invalid"));
    }
}
