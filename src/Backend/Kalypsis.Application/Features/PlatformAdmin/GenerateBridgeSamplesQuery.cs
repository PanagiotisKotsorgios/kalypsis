using System.IO.Compression;
using ClosedXML.Excel;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformAdmin;

/// <summary>
/// Generates a ZIP with 3 ERGO-format xlsx sample files per demo tenant.
/// Each xlsx mixes:
///   • ~10 rows with REAL policy numbers from that tenant → will match
///     the existing πρωτασφαλιστήριο and light up the «matched» path.
///   • 2–3 rows with fake policy numbers → will fail matching for the
///     «χωρίς πρωτασφαλιστήριο» troubleshooting scenario.
///   • 1–2 rows with mismatched premium (small drift) → triggers the
///     bridge diff propagation flow.
///   • 1 row with negative premium → parsed as an Ακύρωση by the ERGO
///     parser (see CarrierBridgeHandlers.ParseErgo).
///
/// Superadmin downloads the zip, extracts, then re-uploads each xlsx
/// through the Γέφυρες page to exercise the entire import flow end
/// to end.
/// </summary>
public record GenerateBridgeSamplesQuery : IRequest<GenerateBridgeSamplesResult>;

public record GenerateBridgeSamplesResult(byte[] ZipBytes, string FileName);

public class GenerateBridgeSamplesQueryHandler
    : IRequestHandler<GenerateBridgeSamplesQuery, GenerateBridgeSamplesResult>
{
    private readonly IAppDbContext _db;

    public GenerateBridgeSamplesQueryHandler(IAppDbContext db) => _db = db;

    public async Task<GenerateBridgeSamplesResult> Handle(GenerateBridgeSamplesQuery r, CancellationToken ct)
    {
        // Grab every demo tenant that has a DEMOxx code (created by the
        // reseed step). If the operator hasn't run the reseed yet, we fall
        // back to any tenant so the samples are still useful.
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => t.DeletedAt == null && t.Code.StartsWith("DEMO"))
            .Select(t => new { t.Id, t.Code, t.Name })
            .ToListAsync(ct);
        if (tenants.Count == 0)
        {
            tenants = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.DeletedAt == null)
                .Select(t => new { t.Id, t.Code, t.Name })
                .Take(5).ToListAsync(ct);
        }

        using var zipStream = new MemoryStream();
        using (var zip = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var tenant in tenants)
            {
                var policies = await _db.Policies.IgnoreQueryFilters()
                    .Include(p => p.Customer)
                    .Where(p => p.TenantId == tenant.Id && p.DeletedAt == null)
                    .OrderByDescending(p => p.CreatedAt)
                    .Take(15)
                    .Select(p => new BridgePolicyRow(
                        p.PolicyNumber,
                        p.Customer.Type == CustomerType.Individual
                            ? $"{p.Customer.FirstName} {p.Customer.LastName}"
                            : (p.Customer.CompanyName ?? p.Customer.CustomerNumber),
                        p.StartDate, p.EndDate, p.Premium))
                    .ToListAsync(ct);
                if (policies.Count == 0) continue;

                // Scenario 1 — clean, should match all
                AddXlsxToZip(zip, $"{tenant.Code}/ERGO_success.xlsx",
                    BuildErgoWorkbook(policies, driftPct: 0m, unlinkedCount: 0, cancellations: 0));

                // Scenario 2 — warnings: small drift + a couple of unlinked
                AddXlsxToZip(zip, $"{tenant.Code}/ERGO_warnings.xlsx",
                    BuildErgoWorkbook(policies, driftPct: 0.05m, unlinkedCount: 2, cancellations: 1));

                // Scenario 3 — failed: many unlinked + a cancellation row
                AddXlsxToZip(zip, $"{tenant.Code}/ERGO_failed.xlsx",
                    BuildErgoWorkbook(policies, driftPct: 0m, unlinkedCount: 6, cancellations: 2));
            }
        }

        return new GenerateBridgeSamplesResult(zipStream.ToArray(), "bridge-samples.zip");
    }

    private record BridgePolicyRow(string PolicyNumber, string CustomerName, DateOnly StartDate, DateOnly EndDate, decimal Premium);

    /// <summary>
    /// Builds an ERGO-format workbook. Row 1 is the header, row 2 has the
    /// carrier / partner code metadata (matches ParseErgo's expectations),
    /// rows 3+ are data.
    /// </summary>
    private static XLWorkbook BuildErgoWorkbook(
        List<BridgePolicyRow> policies, decimal driftPct, int unlinkedCount, int cancellations)
    {
        var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("Data");

        // Header
        var headers = new[]
        {
            "ΕΤΑΙΡΙΑ", "ΣΥΝΕΡΓΑΤΗΣ", "ΟΝΟΜΑΤΕΠΩΝΥΜΟ", "ΑΣΦΑΛΙΣΤΗΡΙΟ", "ΑΡ.ΠΡΟΤΑΣΗΣ",
            "ΗΜ.ΕΚΔΟΣΗΣ", "ΗΜ.ΕΝΑΡΞΗΣ", "ΗΜ.ΛΗΞΗΣ",
            "ΜΕΙΚΤΟ", "ΚΑΘΑΡΟ", "ΠΡΟΜ.ΣΥΝ", "ΠΡΟΜ.ΓΡΑΦ"
        };
        for (int c = 0; c < headers.Length; c++)
            ws.Cell(1, c + 1).Value = headers[c];
        ws.Row(1).Style.Font.Bold = true;

        // Carrier metadata on row 2 (ParseErgo reads it there)
        ws.Cell(2, 1).Value = "ERGO HELLAS";
        ws.Cell(2, 2).Value = "AGT-DEMO";

        int row = 2;
        var rng = new Random(policies[0].PolicyNumber.GetHashCode());

        // Matched rows
        foreach (var p in policies.Take(10))
        {
            row++;
            var premium = driftPct > 0m
                ? decimal.Round(p.Premium * (1m + ((decimal)rng.NextDouble() - 0.5m) * driftPct * 2), 2)
                : p.Premium;
            WriteRow(ws, row, p.PolicyNumber, p.CustomerName, p.StartDate, p.EndDate, premium);
        }

        // Intentionally-unlinked rows (random policy numbers → won't match)
        for (int u = 0; u < unlinkedCount; u++)
        {
            row++;
            var fakeNumber = $"FAKE-{rng.Next(1000000, 9999999)}";
            var fakeCustomer = $"ΆΓΝΩΣΤΟΣ ΠΕΛΑΤΗΣ {u + 1}";
            var fakeStart = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-rng.Next(30, 300)));
            WriteRow(ws, row, fakeNumber, fakeCustomer, fakeStart, fakeStart.AddYears(1), rng.Next(200, 1500));
        }

        // Cancellation rows (negative premium → parsed as Ακύρωση)
        for (int c = 0; c < cancellations && c < policies.Count; c++)
        {
            row++;
            var p = policies[c];
            WriteRow(ws, row, p.PolicyNumber, p.CustomerName, p.StartDate, p.EndDate,
                gross: -Math.Round(p.Premium * 0.4m, 2));
        }

        ws.Columns().AdjustToContents();
        return wb;
    }

    private static void WriteRow(
        IXLWorksheet ws, int row, string policyNumber, string customerName,
        DateOnly start, DateOnly end, decimal gross)
    {
        ws.Cell(row, 3).Value = customerName;
        ws.Cell(row, 4).Value = policyNumber;
        ws.Cell(row, 5).Value = ""; // proposal/plate
        ws.Cell(row, 6).Value = start.AddDays(-3).ToDateTime(TimeOnly.MinValue);   // issue date
        ws.Cell(row, 7).Value = start.ToDateTime(TimeOnly.MinValue);
        ws.Cell(row, 8).Value = end.ToDateTime(TimeOnly.MinValue);
        ws.Cell(row, 9).Value = (double)gross;                       // ΜΕΙΚΤΟ
        ws.Cell(row, 10).Value = (double)(gross * 0.9m);            // ΚΑΘΑΡΟ (approx)
        ws.Cell(row, 11).Value = (double)(gross * 0.10m);           // ΠΡΟΜ.ΣΥΝ
        ws.Cell(row, 12).Value = (double)(gross * 0.05m);           // ΠΡΟΜ.ΓΡΑΦ
    }

    private static void AddXlsxToZip(ZipArchive zip, string path, XLWorkbook wb)
    {
        var entry = zip.CreateEntry(path, CompressionLevel.Optimal);
        using var stream = entry.Open();
        wb.SaveAs(stream);
    }
}
