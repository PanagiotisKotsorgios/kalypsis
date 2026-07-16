using System.Text.Json;
using ClosedXML.Excel;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CarrierBridgeConfigs;

public record CarrierBridgeConfigDto(
    Guid Id, Guid InsuranceCompanyId, string CarrierName, string CarrierCode,
    string FileType, string RecordType,
    string ConfigJson,
    int Version, bool Enabled, string? Notes,
    DateTime CreatedAt, DateTime? UpdatedAt);

/* ============================ List ============================ */

public record ListBridgeConfigsQuery : IRequest<IReadOnlyList<CarrierBridgeConfigDto>>;
public class ListBridgeConfigsHandler : IRequestHandler<ListBridgeConfigsQuery, IReadOnlyList<CarrierBridgeConfigDto>>
{
    private readonly IAppDbContext _db;
    public ListBridgeConfigsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CarrierBridgeConfigDto>> Handle(ListBridgeConfigsQuery _, CancellationToken ct)
    {
        var configs = await _db.CarrierBridgeConfigs
            .Where(c => c.DeletedAt == null)
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .ToListAsync(ct);
        var carrierIds = configs.Select(c => c.InsuranceCompanyId).Distinct().ToList();
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => carrierIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Code })
            .ToListAsync(ct);
        var lookup = carriers.ToDictionary(x => x.Id, x => (x.Name, x.Code));
        return configs.Select(c =>
        {
            lookup.TryGetValue(c.InsuranceCompanyId, out var carrier);
            return new CarrierBridgeConfigDto(
                c.Id, c.InsuranceCompanyId, carrier.Name ?? "—", carrier.Code ?? "—",
                c.FileType, c.RecordType, c.ConfigJson,
                c.Version, c.Enabled, c.Notes,
                c.CreatedAt, c.UpdatedAt);
        }).ToList();
    }
}

public record GetBridgeConfigQuery(Guid CarrierId, string RecordType) : IRequest<CarrierBridgeConfigDto?>;
public class GetBridgeConfigHandler : IRequestHandler<GetBridgeConfigQuery, CarrierBridgeConfigDto?>
{
    private readonly IAppDbContext _db;
    public GetBridgeConfigHandler(IAppDbContext db) => _db = db;
    public async Task<CarrierBridgeConfigDto?> Handle(GetBridgeConfigQuery r, CancellationToken ct)
    {
        var c = await _db.CarrierBridgeConfigs
            .FirstOrDefaultAsync(x => x.InsuranceCompanyId == r.CarrierId
                && x.RecordType == r.RecordType && x.DeletedAt == null, ct);
        if (c == null) return null;
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.Id == r.CarrierId)
            .Select(x => new { x.Name, x.Code })
            .FirstOrDefaultAsync(ct);
        return new CarrierBridgeConfigDto(
            c.Id, c.InsuranceCompanyId, carrier?.Name ?? "—", carrier?.Code ?? "—",
            c.FileType, c.RecordType, c.ConfigJson,
            c.Version, c.Enabled, c.Notes,
            c.CreatedAt, c.UpdatedAt);
    }
}

/* ============================ Save ============================ */

public record UpsertBridgeConfigCommand(
    Guid CarrierId, string FileType, string RecordType,
    string ConfigJson, bool Enabled, string? Notes) : IRequest<CarrierBridgeConfigDto>;

public class UpsertBridgeConfigValidator : AbstractValidator<UpsertBridgeConfigCommand>
{
    public UpsertBridgeConfigValidator()
    {
        RuleFor(x => x.CarrierId).NotEmpty();
        RuleFor(x => x.FileType).Must(f => f is "xlsx" or "csv" or "txt" or "zip")
            .WithMessage("Unsupported file type");
        RuleFor(x => x.RecordType).NotEmpty();
        RuleFor(x => x.ConfigJson).NotEmpty();
    }
}

public class UpsertBridgeConfigHandler : IRequestHandler<UpsertBridgeConfigCommand, CarrierBridgeConfigDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertBridgeConfigHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<CarrierBridgeConfigDto> Handle(UpsertBridgeConfigCommand r, CancellationToken ct)
    {
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.CarrierId && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Insurance company");

        // Validate the JSON round-trips through the doc shape so bad payloads
        // fail on save, not at import-time when a policy is trying to enter.
        try { JsonSerializer.Deserialize<BridgeConfigDoc>(r.ConfigJson); }
        catch (Exception ex)
        { throw AppException.Validation($"Invalid config JSON: {ex.Message}"); }

        var row = await _db.CarrierBridgeConfigs.FirstOrDefaultAsync(
            x => x.InsuranceCompanyId == r.CarrierId && x.RecordType == r.RecordType && x.DeletedAt == null, ct);
        if (row == null)
        {
            row = new CarrierBridgeConfig { InsuranceCompanyId = r.CarrierId, RecordType = r.RecordType, Version = 0 };
            _db.CarrierBridgeConfigs.Add(row);
        }
        row.FileType = r.FileType;
        row.ConfigJson = r.ConfigJson;
        row.Enabled = r.Enabled;
        row.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        row.Version += 1;
        row.LastUpdatedByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);

        return new CarrierBridgeConfigDto(row.Id, row.InsuranceCompanyId, carrier.Name, carrier.Code,
            row.FileType, row.RecordType, row.ConfigJson, row.Version, row.Enabled, row.Notes,
            row.CreatedAt, row.UpdatedAt);
    }
}

public record DeleteBridgeConfigCommand(Guid Id) : IRequest;
public class DeleteBridgeConfigHandler : IRequestHandler<DeleteBridgeConfigCommand>
{
    private readonly IAppDbContext _db;
    public DeleteBridgeConfigHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteBridgeConfigCommand r, CancellationToken ct)
    {
        var row = await _db.CarrierBridgeConfigs.FirstOrDefaultAsync(
            x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("BridgeConfig");
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

/* ============================ Detect columns from sample ============================ */

public record DetectColumnsCommand(
    string FileType, string? SheetName, int HeaderRow, string CsvDelimiter, string Encoding,
    byte[] FileContent) : IRequest<DetectColumnsResult>;

public record DetectColumnsResult(
    IReadOnlyList<string> Columns,
    int TotalRows,
    IReadOnlyList<IReadOnlyList<string>> SampleRows,
    IReadOnlyList<string> SheetNames);

public class DetectColumnsHandler : IRequestHandler<DetectColumnsCommand, DetectColumnsResult>
{
    static DetectColumnsHandler()
    {
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
    }

    public Task<DetectColumnsResult> Handle(DetectColumnsCommand r, CancellationToken ct)
    {
        return r.FileType switch
        {
            "xlsx" => Task.FromResult(FromXlsx(r)),
            "csv" or "txt" => Task.FromResult(FromCsv(r)),
            _ => throw AppException.Validation($"Detect not supported for file type {r.FileType}")
        };
    }

    private static DetectColumnsResult FromXlsx(DetectColumnsCommand r)
    {
        using var stream = new MemoryStream(r.FileContent);
        using var wb = new XLWorkbook(stream);
        var sheetNames = wb.Worksheets.Select(w => w.Name).ToList();
        var sheet = string.IsNullOrEmpty(r.SheetName)
            ? wb.Worksheets.First()
            : wb.Worksheets.FirstOrDefault(w => w.Name == r.SheetName) ?? wb.Worksheets.First();

        var headerRow = Math.Max(1, r.HeaderRow);
        var headers = sheet.Row(headerRow).CellsUsed()
            .Select(c => c.GetString().Trim())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        var samples = new List<IReadOnlyList<string>>();
        var lastRow = Math.Min(sheet.LastRowUsed()?.RowNumber() ?? headerRow, headerRow + 10);
        for (int rowNo = headerRow + 1; rowNo <= lastRow; rowNo++)
        {
            var row = sheet.Row(rowNo);
            var cells = new List<string>();
            for (int col = 1; col <= headers.Count; col++)
                cells.Add(row.Cell(col).GetString().Trim());
            samples.Add(cells);
        }
        var totalRows = (sheet.LastRowUsed()?.RowNumber() ?? headerRow) - headerRow;
        return new DetectColumnsResult(headers, Math.Max(0, totalRows), samples, sheetNames);
    }

    private static DetectColumnsResult FromCsv(DetectColumnsCommand r)
    {
        var encoding = ResolveEncoding(r.Encoding);
        var text = encoding.GetString(r.FileContent);
        var lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
        var delim = string.IsNullOrEmpty(r.CsvDelimiter) ? ";" : r.CsvDelimiter;
        var headerRow = Math.Max(1, r.HeaderRow);
        if (lines.Length < headerRow)
            return new DetectColumnsResult(new List<string>(), 0, new List<IReadOnlyList<string>>(), new List<string>());
        var headers = lines[headerRow - 1].Split(delim).Select(s => s.Trim()).ToList();
        var samples = new List<IReadOnlyList<string>>();
        for (int i = headerRow; i < Math.Min(lines.Length, headerRow + 10); i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i])) continue;
            samples.Add(lines[i].Split(delim).Select(s => s.Trim()).ToList());
        }
        return new DetectColumnsResult(headers, Math.Max(0, lines.Length - headerRow), samples, new List<string> { "(text)" });
    }

    private static System.Text.Encoding ResolveEncoding(string name)
    {
        return name switch
        {
            "windows-1253" or "cp1253" => System.Text.Encoding.GetEncoding(1253),
            "iso-8859-7" => System.Text.Encoding.GetEncoding("iso-8859-7"),
            _ => System.Text.Encoding.UTF8
        };
    }
}

/* ============================ Preview against config ============================ */

public record PreviewBridgeConfigCommand(
    string ConfigJson, string FileType, byte[] FileContent) : IRequest<PreviewBridgeConfigResult>;

public record PreviewBridgeConfigResult(
    int TotalRows,
    int MatchedRows,
    IReadOnlyList<Dictionary<string, string>> Rows,
    IReadOnlyList<string> Warnings);

public class PreviewBridgeConfigHandler : IRequestHandler<PreviewBridgeConfigCommand, PreviewBridgeConfigResult>
{
    static PreviewBridgeConfigHandler()
    {
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
    }

    public Task<PreviewBridgeConfigResult> Handle(PreviewBridgeConfigCommand r, CancellationToken ct)
    {
        var doc = JsonSerializer.Deserialize<BridgeConfigDoc>(r.ConfigJson)
            ?? throw AppException.Validation("Empty config");

        return r.FileType switch
        {
            "xlsx" => Task.FromResult(ExecuteXlsx(doc, r.FileContent)),
            "csv" or "txt" => Task.FromResult(ExecuteCsv(doc, r.FileContent)),
            _ => throw AppException.Validation($"Preview not supported for file type {r.FileType}")
        };
    }

    private static PreviewBridgeConfigResult ExecuteXlsx(BridgeConfigDoc doc, byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var wb = new XLWorkbook(stream);
        var sheet = string.IsNullOrEmpty(doc.SheetName)
            ? wb.Worksheets.First()
            : wb.Worksheets.FirstOrDefault(w => w.Name == doc.SheetName) ?? wb.Worksheets.First();

        var headerRow = Math.Max(1, doc.HeaderRow);
        var headers = sheet.Row(headerRow).CellsUsed()
            .Select(c => c.GetString().Trim()).ToList();
        var headerIndex = headers.Select((h, i) => (h, i)).ToDictionary(x => x.h, x => x.i + 1);

        var results = new List<Dictionary<string, string>>();
        var warnings = new List<string>();
        int totalRows = 0, matchedRows = 0;

        var lastRow = sheet.LastRowUsed()?.RowNumber() ?? headerRow;
        var firstDataRow = headerRow + 1 + doc.SkipRows;
        for (int rowNo = firstDataRow; rowNo <= lastRow && matchedRows < 20; rowNo++)
        {
            totalRows++;
            var row = sheet.Row(rowNo);
            string ReadSource(string source)
            {
                if (source.StartsWith("col:", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(source.AsSpan(4), out var col))
                    return row.Cell(col).GetString().Trim();
                return headerIndex.TryGetValue(source, out var idx) ? row.Cell(idx).GetString().Trim() : "";
            }
            if (!PassesFilters(doc, ReadSource)) continue;
            matchedRows++;
            results.Add(BuildRecord(doc, ReadSource, warnings));
        }

        return new PreviewBridgeConfigResult(totalRows, matchedRows, results, warnings.Distinct().Take(20).ToList());
    }

    private static PreviewBridgeConfigResult ExecuteCsv(BridgeConfigDoc doc, byte[] bytes)
    {
        var encoding = doc.Encoding switch
        {
            "windows-1253" or "cp1253" => System.Text.Encoding.GetEncoding(1253),
            "iso-8859-7" => System.Text.Encoding.GetEncoding("iso-8859-7"),
            _ => System.Text.Encoding.UTF8
        };
        var text = encoding.GetString(bytes);
        var lines = text.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
        var delim = string.IsNullOrEmpty(doc.CsvDelimiter) ? ";" : doc.CsvDelimiter;
        var headerRow = Math.Max(1, doc.HeaderRow);
        if (lines.Length < headerRow)
            return new PreviewBridgeConfigResult(0, 0, new List<Dictionary<string, string>>(), new List<string>());

        var headers = lines[headerRow - 1].Split(delim).Select(s => s.Trim()).ToList();
        var headerIndex = headers.Select((h, i) => (h, i)).ToDictionary(x => x.h, x => x.i);

        var results = new List<Dictionary<string, string>>();
        var warnings = new List<string>();
        int totalRows = 0, matchedRows = 0;
        var startRow = headerRow + doc.SkipRows;

        for (int i = startRow; i < lines.Length && matchedRows < 20; i++)
        {
            var raw = lines[i];
            if (string.IsNullOrWhiteSpace(raw)) continue;
            totalRows++;
            var cells = raw.Split(delim).Select(s => s.Trim()).ToList();
            string ReadSource(string source)
            {
                if (source.StartsWith("col:", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(source.AsSpan(4), out var idx))
                    return idx - 1 < cells.Count ? cells[idx - 1] : "";
                return headerIndex.TryGetValue(source, out var pos) && pos < cells.Count ? cells[pos] : "";
            }
            if (!PassesFilters(doc, ReadSource)) continue;
            matchedRows++;
            results.Add(BuildRecord(doc, ReadSource, warnings));
        }
        return new PreviewBridgeConfigResult(totalRows, matchedRows, results, warnings.Distinct().Take(20).ToList());
    }

    private static bool PassesFilters(BridgeConfigDoc doc, Func<string, string> read)
    {
        foreach (var f in doc.Filters)
        {
            var v = read(f.Source);
            switch (f.Op)
            {
                case "equals":    if (v != (f.Value ?? "")) return false; break;
                case "notEquals": if (v == (f.Value ?? "")) return false; break;
                case "contains":  if (!v.Contains(f.Value ?? "", StringComparison.OrdinalIgnoreCase)) return false; break;
                case "notEmpty":  if (string.IsNullOrEmpty(v)) return false; break;
                case "empty":     if (!string.IsNullOrEmpty(v)) return false; break;
            }
        }
        return true;
    }

    private static Dictionary<string, string> BuildRecord(
        BridgeConfigDoc doc, Func<string, string> read, List<string> warnings)
    {
        var record = new Dictionary<string, string>();
        foreach (var m in doc.Mappings)
        {
            var raw = read(m.Source);
            if (string.IsNullOrEmpty(raw) && !string.IsNullOrEmpty(m.DefaultValue))
                raw = m.DefaultValue!;

            // Regex step first (if present).
            if (!string.IsNullOrEmpty(m.RegexPattern))
            {
                try { raw = System.Text.RegularExpressions.Regex.Replace(raw, m.RegexPattern!, m.RegexReplacement ?? ""); }
                catch (Exception ex) { warnings.Add($"Regex on {m.Target}: {ex.Message}"); }
            }

            // Then the named transform. Anything unrecognised leaves the value
            // as-is + records a warning so the SuperAdmin sees typos.
            var val = m.Transform switch
            {
                "none" => raw,
                "trim" => raw.Trim(),
                "upper" => raw.ToUpperInvariant(),
                "lower" => raw.ToLowerInvariant(),
                "digitsOnly" => new string(raw.Where(char.IsDigit).ToArray()),
                "asDate" => TryDate(raw, doc.DateFormat, warnings, m.Target),
                "asNumber" => TryNumber(raw, doc.DecimalSeparator, doc.CurrencyStrip, warnings, m.Target),
                _ => raw
            };
            record[m.Target] = val;
        }
        return record;
    }

    private static string TryDate(string s, string fmt, List<string> warnings, string target)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        if (DateTime.TryParseExact(s, fmt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out var d))
            return d.ToString("yyyy-MM-dd");
        warnings.Add($"asDate failed on {target}: {s}");
        return s;
    }

    private static string TryNumber(string s, string decSep, string? strip, List<string> warnings, string target)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        var clean = s;
        if (!string.IsNullOrEmpty(strip)) clean = clean.Replace(strip, "");
        clean = clean.Replace(" ", "");
        if (decSep == ",") clean = clean.Replace(".", "").Replace(",", ".");
        if (decimal.TryParse(clean, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v))
            return v.ToString(System.Globalization.CultureInfo.InvariantCulture);
        warnings.Add($"asNumber failed on {target}: {s}");
        return s;
    }
}
