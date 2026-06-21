using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Commissions;

public record CommissionImportRow(string PolicyNumber, decimal Amount, DateOnly? PaidDate, string? Status);
public record CommissionImportResult(
    int TotalRows,
    int Matched,
    int Updated,
    int Unmatched,
    IReadOnlyList<string> UnmatchedPolicyNumbers);

/// <summary>
/// Reconcile a carrier's paid-commission CSV/Excel-as-CSV export against existing
/// CommissionTransactions. Matching is done by policy number. Status changes from
/// Pending → Paid (or Approved → Paid). Unmatched rows are returned in the report so
/// the agency can investigate.
/// </summary>
public record ImportCommissionsCommand(string CsvContent, string CompanyCode) : IRequest<CommissionImportResult>;

public class ImportCommissionsHandler : IRequestHandler<ImportCommissionsCommand, CommissionImportResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ImportCommissionsHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<CommissionImportResult> Handle(ImportCommissionsCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = ParseCsv(request.CsvContent);
        if (rows.Count == 0) return new CommissionImportResult(0, 0, 0, 0, Array.Empty<string>());

        var policyNumbers = rows.Select(r => r.PolicyNumber).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var policies = await _db.Policies
            .Where(p => p.TenantId == tenantId && policyNumbers.Contains(p.PolicyNumber))
            .Select(p => new { p.Id, p.PolicyNumber })
            .ToListAsync(ct);
        var policyIdByNumber = policies.ToDictionary(p => p.PolicyNumber, p => p.Id, StringComparer.OrdinalIgnoreCase);

        var policyIds = policies.Select(p => p.Id).ToList();
        var transactions = await _db.CommissionTransactions
            .Where(t => t.TenantId == tenantId && policyIds.Contains(t.PolicyId) && t.DeletedAt == null)
            .ToListAsync(ct);

        int matched = 0, updated = 0;
        var unmatched = new List<string>();

        foreach (var row in rows)
        {
            if (!policyIdByNumber.TryGetValue(row.PolicyNumber, out var pid))
            {
                unmatched.Add(row.PolicyNumber);
                continue;
            }
            matched++;

            // Mark every pending transaction on this policy as paid (carrier-driven reconciliation).
            var open = transactions.Where(t => t.PolicyId == pid && t.SettledDate == null).ToList();
            foreach (var tx in open)
            {
                tx.SettledDate = row.PaidDate ?? DateOnly.FromDateTime(_clock.UtcNow);
                tx.Amount = row.Amount;
                updated++;
            }
        }
        await _db.SaveChangesAsync(ct);

        return new CommissionImportResult(rows.Count, matched, updated, unmatched.Count, unmatched);
    }

    private static List<CommissionImportRow> ParseCsv(string content)
    {
        var rows = new List<CommissionImportRow>();
        if (string.IsNullOrWhiteSpace(content)) return rows;

        var lines = content.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return rows;

        var header = lines[0].Trim();
        var separator = header.Contains(';') ? ';' : ',';
        var headers = header.Split(separator).Select(h => h.Trim().Trim('"').ToLowerInvariant()).ToArray();

        int idxPolicy = Array.FindIndex(headers, h => h.Contains("policy") || h.Contains("συμβ") || h == "policynumber");
        int idxAmount = Array.FindIndex(headers, h => h.Contains("amount") || h.Contains("ποσ"));
        int idxPaid = Array.FindIndex(headers, h => h.Contains("paid") || h.Contains("πληρ"));
        int idxStatus = Array.FindIndex(headers, h => h.Contains("status") || h.Contains("κατασ"));

        if (idxPolicy < 0 || idxAmount < 0) return rows;

        for (var i = 1; i < lines.Length; i++)
        {
            var parts = lines[i].Trim().Split(separator);
            if (parts.Length <= idxPolicy || parts.Length <= idxAmount) continue;

            var policyNumber = parts[idxPolicy].Trim().Trim('"');
            var amountRaw = parts[idxAmount].Trim().Trim('"').Replace(',', '.');
            if (!decimal.TryParse(amountRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount)) continue;

            DateOnly? paid = null;
            if (idxPaid >= 0 && parts.Length > idxPaid)
            {
                if (DateOnly.TryParse(parts[idxPaid].Trim().Trim('"'), CultureInfo.InvariantCulture, DateTimeStyles.None, out var p))
                    paid = p;
            }
            string? status = idxStatus >= 0 && parts.Length > idxStatus
                ? parts[idxStatus].Trim().Trim('"')
                : null;

            rows.Add(new CommissionImportRow(policyNumber, amount, paid, status));
        }
        return rows;
    }
}
