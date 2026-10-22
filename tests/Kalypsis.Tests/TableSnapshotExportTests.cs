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
    public async Task OverCommissions_KeepTheFilteredTableItsSubtotalsAndCurrencyValuesInEveryFormat(string format)
    {
        var tenantId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenantId);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Γραφείο υπερπρομηθειών", Code = "OFFICE" });
        await db.SaveChangesAsync();
        string?[][] rows = [
            ["ΟΜΑΔΑ: Συνεργάτης Α · 1 εγγραφές", "", "", ""],
            ["10/2026", "Συνεργάτης Α", "40,00 €", "20,00 €"],
            ["Υποσύνολο · Συνεργάτης Α · EUR", "", "40,00 €", "20,00 €"],
            ["Σύνολα · EUR", "", "40,00 €", "20,00 €"]
        ];
        var snapshot = new TableExportsController.TableSnapshot("Υπερπρομήθειες", ["Περίοδος", "Παραγωγός", "Μικτά", "Στην έδρα"], rows,
            "Μήνας: 10 · Απλήρωτα · Ομαδοποίηση: Ανά συνεργάτη", RecordCount: 1);
        var result = Assert.IsType<FileContentResult>(await new TableExportsController(db, current).Export(snapshot, format));
        Assert.NotEmpty(result.FileContents);
        if (format == "csv")
        {
            Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, result.FileContents.Take(3).ToArray());
            var csv = Encoding.UTF8.GetString(result.FileContents);
            Assert.Contains("Γραφείο υπερπρομηθειών", csv);
            Assert.Contains("\"10/2026\",\"Συνεργάτης Α\",\"40,00 €\",\"20,00 €\"", csv);
            Assert.Contains("Υποσύνολο · Συνεργάτης Α · EUR", csv);
            Assert.Contains("Σύνολα · EUR", csv);
            Assert.True(csv.IndexOf("ΟΜΑΔΑ:", StringComparison.Ordinal) < csv.IndexOf("10/2026", StringComparison.Ordinal));
        }
        else if (format == "xlsx")
        {
            using var workbook = new XLWorkbook(new MemoryStream(result.FileContents));
            var sheet = workbook.Worksheets.First();
            Assert.Equal("Γραφείο υπερπρομηθειών", sheet.Cell(1, 1).GetString());
            Assert.Contains("1 εγγραφές", sheet.Cell(2, 1).GetString());
            for (var row = 0; row < rows.Length; row++)
                for (var column = 0; column < rows[row].Length; column++)
                    Assert.Equal(rows[row][column], sheet.Cell(row + 5, column + 1).GetString());
            Assert.True(sheet.Cell(5, 1).Style.Font.Bold);
            Assert.True(sheet.Cell(7, 1).Style.Font.Bold);
            Assert.True(sheet.Cell(8, 1).Style.Font.Bold);
        }
        else Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(result.FileContents.Take(8).ToArray()));
    }

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
            Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, result.FileContents.Take(3).ToArray());
            using var reader = new StreamReader(new MemoryStream(result.FileContents), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var csv = await reader.ReadToEndAsync();
            Assert.StartsWith("\"Γραφείο δοκιμής\"", csv);
            Assert.Contains("\"Πόλη\",\"Πελάτης\"", csv);
            Assert.Contains("Νίκος Άλφα", csv);
            Assert.Contains("Μαρία Ωμέγα", csv);
            Assert.True(csv.IndexOf("Νίκος Άλφα", StringComparison.Ordinal) < csv.IndexOf("Μαρία Ωμέγα", StringComparison.Ordinal));
            Assert.DoesNotContain("Kalypsis — Λίστα πελατών", csv);
            Assert.DoesNotContain('\uFFFD', csv);
            Assert.DoesNotContain('\uFEFF', csv);
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
        await Assert.ThrowsAsync<AppException>(() => controller.Export(
            new TableExportsController.TableSnapshot("Λίστα", ["Πελάτης"], [], RecordCount: 1), "csv"));
        await Assert.ThrowsAsync<AppException>(() => controller.Export(
            new TableExportsController.TableSnapshot("Λίστα", ["Πελάτης"], [], RecordCount: -1), "csv"));
    }

    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    [InlineData("pdf")]
    public async Task GroupedSnapshot_PreservesFilteredSectionsAndOfficeBranding(string format)
    {
        var tenantId = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenantId);
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Ασφαλιστικό γραφείο", Code = "OFFICE" });
        await db.SaveChangesAsync();
        var controller = new TableExportsController(db, current);
        var snapshot = new TableExportsController.TableSnapshot("Αύξηση παραγωγής", ["Πελάτης", "Ανάγκη"],
            [["ΟΜΑΔΑ: Συνεργάτης Α · 1 εγγραφές", ""], ["Μαρία", "Κατοικία"],
             ["ΟΜΑΔΑ: Συνεργάτης Β · 1 εγγραφές", ""], ["Νίκος", "Υγεία"]], RecordCount: 2);
        var result = Assert.IsType<FileContentResult>(await controller.Export(snapshot, format));
        Assert.NotEmpty(result.FileContents);
        if (format == "csv")
        {
            var csv = Encoding.UTF8.GetString(result.FileContents);
            Assert.Contains("ΟΜΑΔΑ: Συνεργάτης Α", csv);
            Assert.Contains("ΟΜΑΔΑ: Συνεργάτης Β", csv);
            Assert.Contains("Μαρία", csv);
            Assert.Contains("Νίκος", csv);
            Assert.DoesNotContain("Kalypsis — Αύξηση παραγωγής", csv);
        }
        else if (format == "xlsx")
        {
            using var workbook = new XLWorkbook(new MemoryStream(result.FileContents));
            var sheet = workbook.Worksheets.First();
            Assert.Equal("Ασφαλιστικό γραφείο", sheet.Cell(1, 1).GetString());
            Assert.Contains("2 εγγραφές", sheet.Cell(2, 1).GetString());
            Assert.Contains("ΟΜΑΔΑ: Συνεργάτης Α", sheet.Cell(5, 1).GetString());
            Assert.True(sheet.Cell(5, 1).Style.Font.Bold);
            Assert.Equal("Μαρία", sheet.Cell(6, 1).GetString());
            Assert.Equal("Νίκος", sheet.Cell(8, 1).GetString());
        }
        else Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(result.FileContents.Take(8).ToArray()));
    }
}
