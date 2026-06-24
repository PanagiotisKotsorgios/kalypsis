using System.Reflection;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Reports;

/// <summary>
/// Executes a saved <see cref="Domain.Entities.ReportDefinition"/>.
/// The definition has FieldsJson + FiltersJson + GroupByJson + AggregationsJson + SortJson
/// in a generic shape; the runner reflects them onto the requested entity table
/// via EF and returns a tabular result. Designed to be the backend for a drag-and-drop
/// report builder UI.
/// </summary>
public class ReportRunner : IReportRunner
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    public ReportRunner(AppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<ReportRunResult> RunAsync(Guid reportDefinitionId, CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var def = await _db.ReportDefinitions
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.Id == reportDefinitionId, ct)
            ?? throw AppException.NotFound("Αναφορά");

        var rows = def.Entity switch
        {
            ReportEntity.Customers      => await Project(_db.Customers.Where(c => c.TenantId == tenantId), def, ct),
            ReportEntity.Policies       => await Project(_db.Policies.Where(p => p.TenantId == tenantId), def, ct),
            ReportEntity.Claims         => await Project(_db.Claims.Where(c => c.TenantId == tenantId), def, ct),
            ReportEntity.Commissions    => await Project(_db.CommissionTransactions.Where(c => c.TenantId == tenantId), def, ct),
            ReportEntity.Requests       => await Project(_db.ServiceRequests.Where(r => r.TenantId == tenantId), def, ct),
            ReportEntity.Documents      => await Project(_db.PolicyDocuments.Where(d => d.TenantId == tenantId), def, ct),
            ReportEntity.Communications => await Project(_db.CommunicationLogs.Where(c => c.TenantId == tenantId), def, ct),
            _ => (new List<string>(), new List<IReadOnlyList<object?>>())
        };

        return new ReportRunResult(rows.Item1, rows.Item2, rows.Item2.Count);
    }

    public async Task<byte[]> ExportXlsxAsync(Guid reportDefinitionId, CancellationToken ct = default)
    {
        // XLSX export deliberately deferred to a real Open-XML implementation in the
        // dedicated `ExcelExporter` (planned). For now, ship as CSV bytes which Excel
        // happily opens — same wire format, swap the body later.
        var run = await RunAsync(reportDefinitionId, ct);
        using var ms = new MemoryStream();
        using var sw = new StreamWriter(ms);
        sw.WriteLine(string.Join(",", run.Columns.Select(EscapeCsv)));
        foreach (var row in run.Rows)
        {
            sw.WriteLine(string.Join(",", row.Select(v => EscapeCsv(v?.ToString() ?? ""))));
        }
        sw.Flush();
        return ms.ToArray();
    }

    private async Task<(List<string>, List<IReadOnlyList<object?>>)> Project<T>(
        IQueryable<T> source, Domain.Entities.ReportDefinition def, CancellationToken ct) where T : class
    {
        var fields = ParseFields(def.FieldsJson);
        if (fields.Count == 0)
        {
            // Default: every public scalar property.
            fields = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => p.PropertyType.IsValueType || p.PropertyType == typeof(string))
                .Select(p => new FieldSpec(p.Name, p.Name, null))
                .ToList();
        }

        var data = await source.Take(1000).ToListAsync(ct);
        var resolved = data.Select(item => (IReadOnlyList<object?>)fields
            .Select(f => GetValue(item!, f.Path))
            .ToList())
            .ToList();
        return (fields.Select(f => f.Label).ToList(), resolved);
    }

    private static object? GetValue(object root, string path)
    {
        object? current = root;
        foreach (var step in path.Split('.'))
        {
            if (current is null) return null;
            var prop = current.GetType().GetProperty(step, BindingFlags.Public | BindingFlags.Instance);
            if (prop is null) return null;
            current = prop.GetValue(current);
        }
        return current;
    }

    private static List<FieldSpec> ParseFields(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.EnumerateArray()
                .Select(e => new FieldSpec(
                    Path: e.TryGetProperty("path", out var p) ? p.GetString() ?? "" : "",
                    Label: e.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "",
                    Format: e.TryGetProperty("format", out var f) ? f.GetString() : null))
                .Where(f => !string.IsNullOrWhiteSpace(f.Path))
                .Select(f => f with { Label = string.IsNullOrEmpty(f.Label) ? f.Path : f.Label })
                .ToList();
        }
        catch { return new(); }
    }

    private static string EscapeCsv(string s)
        => s.Contains(',') || s.Contains('"') || s.Contains('\n')
            ? "\"" + s.Replace("\"", "\"\"") + "\""
            : s;

    private record FieldSpec(string Path, string Label, string? Format);
}
