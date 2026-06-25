using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase14;

/* ============================================================================
   DEFAULT VALUE RULES — evaluate at policy-entry time to prefill fields.
   ========================================================================= */

public record DefaultValueRuleDto(
    Guid Id, string Name,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    PolicyType? PolicyType, string? CoverCode, string? PackageCode,
    string ValuesJson, int Priority, bool IsActive, string? Notes);

public record DefaultValueRuleBody(
    string Name,
    Guid? InsuranceCompanyId, PolicyType? PolicyType, string? CoverCode, string? PackageCode,
    string ValuesJson, int Priority, bool IsActive, string? Notes);

public record ListDefaultValueRulesQuery() : IRequest<IReadOnlyList<DefaultValueRuleDto>>;
public class ListDefaultValueRulesHandler : IRequestHandler<ListDefaultValueRulesQuery, IReadOnlyList<DefaultValueRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListDefaultValueRulesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DefaultValueRuleDto>> Handle(ListDefaultValueRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.DefaultValueRules.Include(x => x.InsuranceCompany)
            .OrderByDescending(x => x.Priority).ThenBy(x => x.Name).ToListAsync(ct);
        return rows.Select(r => new DefaultValueRuleDto(
            r.Id, r.Name,
            r.InsuranceCompanyId, r.InsuranceCompany?.Name,
            r.PolicyType, r.CoverCode, r.PackageCode,
            r.ValuesJson, r.Priority, r.IsActive, r.Notes)).ToList();
    }
}

public record SaveDefaultValueRuleCommand(Guid? Id, DefaultValueRuleBody Body) : IRequest<DefaultValueRuleDto>;
public class SaveDefaultValueRuleHandler : IRequestHandler<SaveDefaultValueRuleCommand, DefaultValueRuleDto>
{
    private readonly IAppDbContext _db;
    public SaveDefaultValueRuleHandler(IAppDbContext db) => _db = db;
    public async Task<DefaultValueRuleDto> Handle(SaveDefaultValueRuleCommand r, CancellationToken ct)
    {
        var b = r.Body;
        // Validate JSON
        try { JsonDocument.Parse(b.ValuesJson); }
        catch
        {
            throw new AppException("invalid_values_json", "Το πεδίο τιμών δεν είναι έγκυρο JSON.", 400,
                title: "Μη έγκυρο JSON",
                why: "Πρέπει να είναι έγκυρο JSON object, π.χ. {\"Currency\":\"EUR\",\"PaymentFrequency\":\"Annual\"}.",
                fix: "Διορθώστε τη σύνταξη και ξαναπροσπαθήστε.");
        }

        DefaultValueRule rule;
        if (r.Id.HasValue)
        {
            rule = await _db.DefaultValueRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
                ?? throw AppException.NotFound("Rule");
        }
        else
        {
            rule = new DefaultValueRule { Id = Guid.NewGuid() };
            _db.DefaultValueRules.Add(rule);
        }
        rule.Name = b.Name.Trim();
        rule.InsuranceCompanyId = b.InsuranceCompanyId;
        rule.PolicyType = b.PolicyType;
        rule.CoverCode = b.CoverCode;
        rule.PackageCode = b.PackageCode;
        rule.ValuesJson = b.ValuesJson;
        rule.Priority = b.Priority;
        rule.IsActive = b.IsActive;
        rule.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);

        var carrierName = rule.InsuranceCompanyId.HasValue
            ? await _db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(x => x.Id == rule.InsuranceCompanyId).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;

        return new DefaultValueRuleDto(rule.Id, rule.Name,
            rule.InsuranceCompanyId, carrierName,
            rule.PolicyType, rule.CoverCode, rule.PackageCode,
            rule.ValuesJson, rule.Priority, rule.IsActive, rule.Notes);
    }
}

public record DeleteDefaultValueRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteDefaultValueRuleHandler : IRequestHandler<DeleteDefaultValueRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteDefaultValueRuleHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteDefaultValueRuleCommand r, CancellationToken ct)
    {
        var rule = await _db.DefaultValueRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Rule");
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record EvaluateDefaultsQuery(
    Guid? InsuranceCompanyId, PolicyType? PolicyType, string? CoverCode, string? PackageCode
) : IRequest<Dictionary<string, object?>>;

public class EvaluateDefaultsHandler : IRequestHandler<EvaluateDefaultsQuery, Dictionary<string, object?>>
{
    private readonly IAppDbContext _db;
    public EvaluateDefaultsHandler(IAppDbContext db) => _db = db;
    public async Task<Dictionary<string, object?>> Handle(EvaluateDefaultsQuery r, CancellationToken ct)
    {
        var all = await _db.DefaultValueRules
            .Where(x => x.IsActive)
            .ToListAsync(ct);

        // A rule applies only if every populated condition matches.
        var matching = all.Where(rule =>
            (!rule.InsuranceCompanyId.HasValue || rule.InsuranceCompanyId == r.InsuranceCompanyId) &&
            (!rule.PolicyType.HasValue       || rule.PolicyType == r.PolicyType) &&
            (rule.CoverCode == null          || rule.CoverCode == r.CoverCode) &&
            (rule.PackageCode == null        || rule.PackageCode == r.PackageCode)).ToList();

        // Sort least → most specific so more specific overrides earlier values.
        int Specificity(DefaultValueRule x) =>
            (x.InsuranceCompanyId.HasValue ? 1 : 0)
            + (x.PolicyType.HasValue ? 1 : 0)
            + (x.CoverCode != null ? 1 : 0)
            + (x.PackageCode != null ? 1 : 0);

        var ordered = matching.OrderBy(Specificity).ThenBy(x => x.Priority);

        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var rule in ordered)
        {
            try
            {
                using var doc = JsonDocument.Parse(rule.ValuesJson);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    result[prop.Name] = prop.Value.ValueKind switch
                    {
                        JsonValueKind.String => prop.Value.GetString(),
                        JsonValueKind.Number => prop.Value.TryGetInt64(out var i) ? (object)i : prop.Value.GetDouble(),
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.Null => null,
                        _ => prop.Value.GetRawText()
                    };
                }
            }
            catch { /* skip invalid */ }
        }
        return result;
    }
}

/* ============================================================================
   CARRIER BRIDGE IMPORT RUNS — upload a CSV and create/update policies.
   ========================================================================= */

public record CompanyBridgeRunDto(
    Guid Id, Guid BridgeId, string BridgeName,
    DateTime StartedAt, DateTime? CompletedAt,
    string Status, string? SourceFile,
    int RowsTotal, int RowsCreated, int RowsSkipped, int RowsFailed,
    string? ErrorMessage);

public record ListBridgeRunsQuery(Guid? BridgeId) : IRequest<IReadOnlyList<CompanyBridgeRunDto>>;
public class ListBridgeRunsHandler : IRequestHandler<ListBridgeRunsQuery, IReadOnlyList<CompanyBridgeRunDto>>
{
    private readonly IAppDbContext _db;
    public ListBridgeRunsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CompanyBridgeRunDto>> Handle(ListBridgeRunsQuery r, CancellationToken ct)
    {
        var q = _db.CompanyBridgeRuns.Include(x => x.Bridge).AsQueryable();
        if (r.BridgeId.HasValue) q = q.Where(x => x.BridgeId == r.BridgeId);
        var rows = await q.OrderByDescending(x => x.StartedAt).Take(200).ToListAsync(ct);
        return rows.Select(x => new CompanyBridgeRunDto(
            x.Id, x.BridgeId, x.Bridge?.Name ?? "",
            x.StartedAt, x.CompletedAt, x.Status, x.SourceFile,
            x.RowsTotal, x.RowsCreated, x.RowsSkipped, x.RowsFailed,
            x.ErrorMessage)).ToList();
    }
}

public record RunBridgeImportCommand(Guid BridgeId, string SourceFileName, string CsvContent) : IRequest<CompanyBridgeRunDto>;
public class RunBridgeImportHandler : IRequestHandler<RunBridgeImportCommand, CompanyBridgeRunDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public RunBridgeImportHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CompanyBridgeRunDto> Handle(RunBridgeImportCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var bridge = await _db.CompanyBridges.Include(x => x.InsuranceCompany)
            .FirstOrDefaultAsync(x => x.Id == r.BridgeId && x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Bridge");

        var run = new CompanyBridgeRun
        {
            Id = Guid.NewGuid(),
            BridgeId = bridge.Id,
            StartedAt = DateTime.UtcNow,
            Status = "Running",
            SourceFile = r.SourceFileName,
            TriggeredByUserId = _current.UserId
        };
        _db.CompanyBridgeRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        // Parse CSV. Expected header:
        // PolicyNumber,CustomerVat,CustomerName,PolicyType,StartDate,EndDate,Premium,Currency
        var lines = r.CsvContent.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
        {
            run.Status = "Failed";
            run.ErrorMessage = "Empty file";
            run.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return ToDto(run, bridge);
        }

        var header = SplitCsv(lines[0]);
        int Idx(string col) => Array.FindIndex(header, h => string.Equals(h.Trim(), col, StringComparison.OrdinalIgnoreCase));
        int iNum = Idx("PolicyNumber"), iVat = Idx("CustomerVat"), iName = Idx("CustomerName"),
            iType = Idx("PolicyType"), iStart = Idx("StartDate"), iEnd = Idx("EndDate"),
            iPrem = Idx("Premium"), iCur = Idx("Currency");
        if (iNum < 0 || iVat < 0 || iPrem < 0)
        {
            run.Status = "Failed";
            run.ErrorMessage = "Missing required columns: PolicyNumber, CustomerVat, Premium.";
            run.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            return ToDto(run, bridge);
        }

        var log = new System.Text.StringBuilder();
        for (int rowIdx = 1; rowIdx < lines.Length; rowIdx++)
        {
            run.RowsTotal++;
            var cells = SplitCsv(lines[rowIdx]);
            try
            {
                var policyNo = cells[iNum].Trim();
                var vat = cells[iVat].Trim();
                if (string.IsNullOrWhiteSpace(policyNo) || string.IsNullOrWhiteSpace(vat))
                {
                    run.RowsSkipped++; log.AppendLine($"row {rowIdx}: missing key fields, skipped");
                    continue;
                }
                var exists = await _db.Policies.AnyAsync(p => p.PolicyNumber == policyNo, ct);
                if (exists)
                {
                    run.RowsSkipped++; log.AppendLine($"row {rowIdx}: {policyNo} already exists, skipped");
                    continue;
                }

                // Find or auto-create customer by VAT.
                var customer = await _db.Customers.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.VatNumber == vat && c.DeletedAt == null, ct);
                if (customer is null)
                {
                    var name = iName >= 0 ? cells[iName].Trim() : "Imported";
                    customer = new Customer
                    {
                        Id = Guid.NewGuid(),
                        CustomerNumber = $"IMP-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                        Type = CustomerType.Individual,
                        FirstName = name, LastName = "",
                        VatNumber = vat
                    };
                    _db.Customers.Add(customer);
                }

                var policyType = iType >= 0 && Enum.TryParse<PolicyType>(cells[iType].Trim(), true, out var pt) ? pt : PolicyType.Other;
                var start = iStart >= 0 && DateOnly.TryParse(cells[iStart].Trim(), out var sd) ? sd : DateOnly.FromDateTime(DateTime.Today);
                var end = iEnd >= 0 && DateOnly.TryParse(cells[iEnd].Trim(), out var ed) ? ed : start.AddYears(1);
                var premium = decimal.TryParse(cells[iPrem].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var pr) ? pr : 0m;
                var currency = iCur >= 0 ? cells[iCur].Trim() : "EUR";

                _db.Policies.Add(new Policy
                {
                    Id = Guid.NewGuid(),
                    PolicyNumber = policyNo,
                    CustomerId = customer.Id,
                    InsuranceCompanyId = bridge.InsuranceCompanyId,
                    PolicyType = policyType,
                    Status = PolicyStatus.Active,
                    StartDate = start, EndDate = end,
                    Premium = premium, Currency = currency,
                    CreatedByUserId = _current.UserId
                });
                run.RowsCreated++;
                log.AppendLine($"row {rowIdx}: {policyNo} created");
            }
            catch (Exception ex)
            {
                run.RowsFailed++;
                log.AppendLine($"row {rowIdx}: ERROR {ex.Message}");
            }
        }

        run.Status = run.RowsFailed > 0 && run.RowsCreated == 0 ? "Failed" : "Completed";
        run.CompletedAt = DateTime.UtcNow;
        run.ResultJson = log.ToString();

        // Update bridge LastSync*
        bridge.LastSyncAt = run.CompletedAt;
        bridge.LastSyncRows = run.RowsCreated;
        bridge.LastSyncStatus = run.Status;

        await _db.SaveChangesAsync(ct);
        return ToDto(run, bridge);
    }

    private static CompanyBridgeRunDto ToDto(CompanyBridgeRun x, CompanyBridge b) => new(
        x.Id, x.BridgeId, b.Name,
        x.StartedAt, x.CompletedAt, x.Status, x.SourceFile,
        x.RowsTotal, x.RowsCreated, x.RowsSkipped, x.RowsFailed, x.ErrorMessage);

    /// <summary>Minimal CSV split that respects quoted strings.</summary>
    private static string[] SplitCsv(string line)
    {
        var result = new List<string>();
        var sb = new System.Text.StringBuilder();
        bool inQuote = false;
        foreach (var c in line)
        {
            if (c == '"') { inQuote = !inQuote; continue; }
            if (c == ',' && !inQuote) { result.Add(sb.ToString()); sb.Clear(); continue; }
            sb.Append(c);
        }
        result.Add(sb.ToString());
        return result.ToArray();
    }
}
