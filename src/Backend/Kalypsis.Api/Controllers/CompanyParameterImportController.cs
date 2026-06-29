using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Bulk catalogue ingestion. PlatformAdmin uploads either:
///   - a CSV with columns: Kind,Code,Name,PolicyType,ParentCode,BridgeSystem,BridgeCode
///   - an XLSX in the IW shape (sheets Κλάδοι / Χρήσεις / Καλύψεις / Πακέτα)
/// and the rows are inserted as CompanyParameterItem entries against the
/// targeted insurance company. Same idempotency contract as the Grand Cover
/// seeder — duplicate (Kind+Code+ParentCode) tuples are skipped.
/// </summary>
[ApiController]
[Route("api/platform/company-parameters/import")]
[Authorize(Policy = "PlatformAdmin")]
public class CompanyParameterImportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;

    public CompanyParameterImportController(AppDbContext db, IDateTimeProvider clock)
    {
        _db = db; _clock = clock;
    }

    public record ImportResult(int Inserted, int Skipped, IReadOnlyList<string> Warnings);

    [HttpPost("{insuranceCompanyId:guid}")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<ImportResult>> Import(
        Guid insuranceCompanyId,
        IFormFile file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "no_file", message = "Δεν επιλέξατε αρχείο." });

        var company = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == insuranceCompanyId, ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρία");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var rows = ext switch
        {
            ".csv"  => ParseCsv(file.OpenReadStream()),
            ".xlsx" => ParseXlsxCarrier(file.OpenReadStream()),
            _ => throw new AppException("bad_format",
                $"Υποστηρίζονται μόνο .csv και .xlsx. Δώσατε {ext}.", 400)
        };

        var existing = await _db.CompanyParameterItems.IgnoreQueryFilters()
            .Where(x => x.InsuranceCompanyId == company.Id && x.DeletedAt == null)
            .Select(x => new { x.Kind, x.Code, x.ParentCode })
            .ToListAsync(ct);
        var existingKeys = existing
            .Select(x => $"{(int)x.Kind}|{x.Code.ToUpperInvariant()}|{(x.ParentCode ?? "").ToUpperInvariant()}")
            .ToHashSet(StringComparer.Ordinal);

        var inserted = 0;
        var skipped = 0;
        var warnings = new List<string>();
        var order = 0;
        foreach (var r in rows)
        {
            if (string.IsNullOrWhiteSpace(r.Code) || string.IsNullOrWhiteSpace(r.Name))
            {
                skipped++;
                if (warnings.Count < 20) warnings.Add($"Γραμμή χωρίς κωδικό/όνομα παραλείπεται.");
                continue;
            }
            var key = $"{(int)r.Kind}|{r.Code.ToUpperInvariant()}|{(r.ParentCode ?? "").ToUpperInvariant()}";
            if (!existingKeys.Add(key)) { skipped++; continue; }

            _db.CompanyParameterItems.Add(new CompanyParameterItem
            {
                Id = Guid.NewGuid(),
                InsuranceCompanyId = company.Id,
                Kind = r.Kind,
                Code = r.Code.Trim().ToUpperInvariant(),
                Name = r.Name.Trim(),
                PolicyType = r.PolicyType,
                ParentCode = string.IsNullOrWhiteSpace(r.ParentCode) ? null : r.ParentCode.Trim().ToUpperInvariant(),
                BridgeSystem = string.IsNullOrWhiteSpace(r.BridgeSystem) ? null : r.BridgeSystem.Trim().ToUpperInvariant(),
                BridgeCode = string.IsNullOrWhiteSpace(r.BridgeCode) ? null : r.BridgeCode.Trim(),
                IsActive = true,
                DisplayOrder = order++,
                Source = "BulkImport",
                CreatedAt = _clock.UtcNow
            });
            inserted++;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new ImportResult(inserted, skipped, warnings));
    }

    // ============================================================================
    // CSV parser — first line is header. Columns: Kind, Code, Name, PolicyType?,
    // ParentCode?, BridgeSystem?, BridgeCode?
    // ============================================================================
    private record ParsedRow(CompanyParameterItemKind Kind, string Code, string Name,
        PolicyType? PolicyType, string? ParentCode, string? BridgeSystem, string? BridgeCode);

    private static List<ParsedRow> ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var raw = reader.ReadToEnd();
        var lines = raw.Split('\n').Select(l => l.TrimEnd('\r')).ToList();
        if (lines.Count == 0) return new();

        var headers = SplitCsvLine(lines[0]).Select(h => h.Trim().ToLowerInvariant()).ToList();
        int idx(string n) => headers.IndexOf(n);
        var iKind = idx("kind");
        var iCode = idx("code");
        var iName = idx("name");
        var iType = idx("policytype");
        var iParent = idx("parentcode");
        var iBs = idx("bridgesystem");
        var iBc = idx("bridgecode");
        if (iKind < 0 || iCode < 0 || iName < 0)
            throw new AppException("csv_headers",
                "Το CSV χρειάζεται τουλάχιστον στήλες: Kind, Code, Name.", 400);

        var rows = new List<ParsedRow>();
        for (int i = 1; i < lines.Count; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cells = SplitCsvLine(line);
            string? cell(int n) => n >= 0 && n < cells.Count ? cells[n] : null;
            var kindStr = (cell(iKind) ?? "").Trim();
            if (!Enum.TryParse<CompanyParameterItemKind>(kindStr, true, out var kind)) continue;
            PolicyType? pt = null;
            if (Enum.TryParse<PolicyType>(cell(iType) ?? "", true, out var p)) pt = p;
            rows.Add(new ParsedRow(kind,
                cell(iCode) ?? "", cell(iName) ?? "", pt,
                cell(iParent), cell(iBs), cell(iBc)));
        }
        return rows;
    }

    private static List<string> SplitCsvLine(string line)
    {
        var cells = new List<string>();
        var sb = new StringBuilder();
        var inQuote = false;
        for (int i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuote)
            {
                if (c == '"' && i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                else if (c == '"') inQuote = false;
                else sb.Append(c);
            }
            else
            {
                if (c == '"') inQuote = true;
                else if (c == ',') { cells.Add(sb.ToString()); sb.Clear(); }
                else sb.Append(c);
            }
        }
        cells.Add(sb.ToString());
        return cells;
    }

    // ============================================================================
    // XLSX parser — recognises IW-shape sheets:
    //   Κλάδοι   → Kind=Branch (id, name, fbc)
    //   Χρήσεις  → Kind=Use (id, code, name, label)
    //   Καλύψεις → Kind=Coverage (id_branch, name, fbc, …)
    //   Πακέτα   → Kind=Package (package_id, name, company_id, company_name)
    // Other sheet layouts are ignored with a warning.
    // ============================================================================
    private static List<ParsedRow> ParseXlsxCarrier(Stream stream)
    {
        // Buffer to MemoryStream so ZipArchive can seek.
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;

        using var zip = new ZipArchive(ms, ZipArchiveMode.Read);
        var ssEntry = zip.GetEntry("xl/sharedStrings.xml");
        var sharedStrings = new List<string>();
        if (ssEntry is not null)
        {
            using var sf = ssEntry.Open();
            var doc = new XmlDocument();
            doc.Load(sf);
            foreach (XmlNode si in doc.GetElementsByTagName("si"))
            {
                var sb = new StringBuilder();
                foreach (XmlNode t in si.SelectNodes(".//*[local-name()='t']")!) sb.Append(t.InnerText);
                sharedStrings.Add(sb.ToString());
            }
        }

        var wbEntry = zip.GetEntry("xl/workbook.xml")
            ?? throw new AppException("xlsx_invalid", "Άκυρο xlsx αρχείο.", 400);
        XmlDocument wb;
        using (var wbStream = wbEntry.Open())
        {
            wb = new XmlDocument();
            wb.Load(wbStream);
        }
        var relsEntry = zip.GetEntry("xl/_rels/workbook.xml.rels");
        var rels = new Dictionary<string, string>();
        if (relsEntry is not null)
        {
            using var rs = relsEntry.Open();
            var rd = new XmlDocument(); rd.Load(rs);
            foreach (XmlNode r in rd.GetElementsByTagName("Relationship"))
                rels[r.Attributes!["Id"]!.Value] = r.Attributes["Target"]!.Value;
        }

        var sheetMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (XmlNode s in wb.GetElementsByTagName("sheet"))
        {
            var name = s.Attributes!["name"]?.Value ?? "";
            var rid = s.Attributes["r:id"]?.Value ?? s.Attributes["id"]?.Value ?? "";
            if (rels.TryGetValue(rid, out var target))
            {
                if (!target.StartsWith("xl/")) target = "xl/" + target;
                sheetMap[name] = target;
            }
        }

        List<List<string?>> ReadSheet(string path)
        {
            var e = zip.GetEntry(path);
            if (e is null) return new();
            using var s = e.Open();
            var doc = new XmlDocument(); doc.Load(s);
            var rows = new List<List<string?>>();
            foreach (XmlNode row in doc.GetElementsByTagName("row"))
            {
                var cells = new List<string?>();
                foreach (XmlNode c in row.SelectNodes(".//*[local-name()='c']")!)
                {
                    var t = c.Attributes?["t"]?.Value;
                    var v = c.SelectSingleNode(".//*[local-name()='v']")?.InnerText;
                    if (t == "s" && int.TryParse(v, out var idx) && idx < sharedStrings.Count)
                        cells.Add(sharedStrings[idx]);
                    else if (v is not null) cells.Add(v);
                    else
                    {
                        var inline = c.SelectSingleNode(".//*[local-name()='is']");
                        if (inline is not null) cells.Add(string.Concat(inline.SelectNodes(".//*[local-name()='t']")!.Cast<XmlNode>().Select(x => x.InnerText)));
                        else cells.Add(null);
                    }
                }
                rows.Add(cells);
            }
            return rows;
        }

        string? K(List<string?> r, int i) => i < r.Count ? r[i] : null;
        var output = new List<ParsedRow>();

        foreach (var kv in sheetMap)
        {
            var rows = ReadSheet(kv.Value);
            if (rows.Count < 2) continue;
            var name = kv.Key;

            if (name.Contains("Κλάδοι", StringComparison.OrdinalIgnoreCase) || name.Contains("Branches", StringComparison.OrdinalIgnoreCase))
            {
                for (int i = 1; i < rows.Count; i++)
                {
                    var r = rows[i];
                    var code = K(r, 0); var nm = K(r, 1); var fbc = K(r, 2);
                    if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(nm)) continue;
                    output.Add(new ParsedRow(CompanyParameterItemKind.Branch,
                        Code: code.Trim(), Name: nm.Trim(), PolicyType: null, ParentCode: null,
                        BridgeSystem: null, BridgeCode: fbc));
                }
            }
            else if (name.Contains("Χρήσεις", StringComparison.OrdinalIgnoreCase) || name.Contains("Uses", StringComparison.OrdinalIgnoreCase))
            {
                for (int i = 1; i < rows.Count; i++)
                {
                    var r = rows[i];
                    var id = K(r, 0); var code = K(r, 1); var nm = K(r, 2);
                    if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(nm)) continue;
                    output.Add(new ParsedRow(CompanyParameterItemKind.Use,
                        Code: code ?? id, Name: nm.Trim(), PolicyType: PolicyType.Auto, ParentCode: null,
                        BridgeSystem: null, BridgeCode: null));
                }
            }
            else if (name.Contains("Καλύψεις", StringComparison.OrdinalIgnoreCase) || name.Contains("Coverages", StringComparison.OrdinalIgnoreCase))
            {
                for (int i = 1; i < rows.Count; i++)
                {
                    var r = rows[i];
                    var nm = K(r, 1); var fbc = K(r, 2); var branchId = K(r, 3);
                    if (string.IsNullOrWhiteSpace(nm) || string.IsNullOrWhiteSpace(fbc)) continue;
                    output.Add(new ParsedRow(CompanyParameterItemKind.Coverage,
                        Code: fbc.Trim(), Name: nm.Trim(), PolicyType: null,
                        ParentCode: branchId, BridgeSystem: null, BridgeCode: null));
                }
            }
            else if (name.Contains("Πακέτα", StringComparison.OrdinalIgnoreCase) || name.Contains("Packages", StringComparison.OrdinalIgnoreCase))
            {
                for (int i = 1; i < rows.Count; i++)
                {
                    var r = rows[i];
                    var pid = K(r, 0); var nm = K(r, 1);
                    if (string.IsNullOrWhiteSpace(pid) || string.IsNullOrWhiteSpace(nm)) continue;
                    output.Add(new ParsedRow(CompanyParameterItemKind.Package,
                        Code: SanitizeId(pid), Name: nm.Trim(), PolicyType: null,
                        ParentCode: null, BridgeSystem: null, BridgeCode: pid));
                }
            }
        }
        return output;
    }

    private static string SanitizeId(string id)
    {
        var s = (id ?? "").Trim().Replace(".0", "").Replace(".", "").Replace(" ", "_");
        return string.IsNullOrEmpty(s) ? "PKG_" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant() : s.ToUpperInvariant();
    }
}
