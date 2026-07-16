using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.OverCommissionStatements;

public record OverCommissionStatementDto(
    Guid Id, Guid InsuranceCompanyId, string InsuranceCompanyName,
    Guid ProducerId, string ProducerName, string? ProducerCode,
    int Year, int Month,
    decimal GrossAmount, decimal NetAmount, string Currency,
    string? Reference, string? Notes,
    DateTime? PaidOn,
    decimal ProducerSharePercent,
    decimal ProducerAmount,   // computed: Gross × ProducerSharePercent / 100
    decimal OfficeAmount,     // computed: Gross − ProducerAmount (goes to έδρα)
    DateTime CreatedAt, DateTime? UpdatedAt);

public record ListOverCommissionStatementsQuery(
    int? Year, int? Month,
    Guid? InsuranceCompanyId, Guid? ProducerId,
    string? Search) : IRequest<IReadOnlyList<OverCommissionStatementDto>>;

public class ListOverCommissionStatementsHandler
    : IRequestHandler<ListOverCommissionStatementsQuery, IReadOnlyList<OverCommissionStatementDto>>
{
    private readonly IAppDbContext _db;
    public ListOverCommissionStatementsHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<OverCommissionStatementDto>> Handle(
        ListOverCommissionStatementsQuery r, CancellationToken ct)
    {
        var q = _db.OverCommissionStatements.Where(s => s.DeletedAt == null);
        if (r.Year.HasValue) q = q.Where(s => s.Year == r.Year.Value);
        if (r.Month.HasValue) q = q.Where(s => s.Month == r.Month.Value);
        if (r.InsuranceCompanyId.HasValue) q = q.Where(s => s.InsuranceCompanyId == r.InsuranceCompanyId.Value);
        if (r.ProducerId.HasValue) q = q.Where(s => s.ProducerId == r.ProducerId.Value);

        var rows = await q.OrderByDescending(s => s.Year).ThenByDescending(s => s.Month)
                          .ThenBy(s => s.InsuranceCompanyId).ToListAsync(ct);

        var carrierIds = rows.Select(x => x.InsuranceCompanyId).Distinct().ToList();
        var producerIds = rows.Select(x => x.ProducerId).Distinct().ToList();

        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => carrierIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var producers = await _db.Producers.IgnoreQueryFilters()
            .Where(x => producerIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name, x.Code })
            .ToListAsync(ct);
        var producerMap = producers.ToDictionary(x => x.Id, x => (x.Name, x.Code));

        var mapped = rows.Select(s =>
        {
            var (producer, office) = SplitCalculator.Split(s.GrossAmount, s.ProducerSharePercent);
            return new OverCommissionStatementDto(
                s.Id, s.InsuranceCompanyId, carriers.GetValueOrDefault(s.InsuranceCompanyId, "—"),
                s.ProducerId,
                producerMap.TryGetValue(s.ProducerId, out var p) ? p.Name : "—",
                producerMap.TryGetValue(s.ProducerId, out var p2) ? p2.Code : null,
                s.Year, s.Month,
                s.GrossAmount, s.NetAmount, s.Currency,
                s.Reference, s.Notes,
                s.PaidOn,
                s.ProducerSharePercent, producer, office,
                s.CreatedAt, s.UpdatedAt);
        }).AsEnumerable();

        // Client-side search across carrier/producer name — cheap because we
        // already materialised the small list. Server-side would need joins
        // that don't play well with the query filter setup on Producers.
        if (!string.IsNullOrEmpty(r.Search))
        {
            var s = r.Search.ToLowerInvariant();
            mapped = mapped.Where(x =>
                x.InsuranceCompanyName.ToLower().Contains(s)
                || x.ProducerName.ToLower().Contains(s)
                || (x.ProducerCode ?? "").ToLower().Contains(s)
                || (x.Reference ?? "").ToLower().Contains(s));
        }

        return mapped.ToList();
    }
}

public record UpsertOverCommissionStatementCommand(
    Guid? Id,
    Guid InsuranceCompanyId, Guid ProducerId,
    int Year, int Month,
    decimal GrossAmount, decimal NetAmount, string Currency,
    string? Reference, string? Notes,
    DateTime? PaidOn,
    decimal ProducerSharePercent) : IRequest<OverCommissionStatementDto>;

/// <summary>
/// Rounds the producer/office split to 2 decimals with the office getting
/// whatever's left after producer rounding — avoids the £0.01-drift that
/// bites naive round(share) + round(rest) pairs.
/// </summary>
internal static class SplitCalculator
{
    public static (decimal Producer, decimal Office) Split(decimal gross, decimal producerPct)
    {
        var pct = Math.Clamp(producerPct, 0m, 100m);
        var producer = Math.Round(gross * pct / 100m, 2, MidpointRounding.AwayFromZero);
        var office = Math.Round(gross - producer, 2, MidpointRounding.AwayFromZero);
        return (producer, office);
    }
}


public class UpsertOverCommissionStatementValidator : AbstractValidator<UpsertOverCommissionStatementCommand>
{
    public UpsertOverCommissionStatementValidator()
    {
        RuleFor(x => x.InsuranceCompanyId).NotEmpty();
        RuleFor(x => x.ProducerId).NotEmpty();
        RuleFor(x => x.Year).InclusiveBetween(2000, 2100);
        RuleFor(x => x.Month).InclusiveBetween(1, 12);
        RuleFor(x => x.GrossAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.NetAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.ProducerSharePercent).InclusiveBetween(0m, 100m)
            .WithMessage("Το % παραγωγού πρέπει να είναι μεταξύ 0 και 100.");
    }
}

public class UpsertOverCommissionStatementHandler
    : IRequestHandler<UpsertOverCommissionStatementCommand, OverCommissionStatementDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertOverCommissionStatementHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<OverCommissionStatementDto> Handle(
        UpsertOverCommissionStatementCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        OverCommissionStatement row;
        if (r.Id.HasValue)
        {
            row = await _db.OverCommissionStatements
                .FirstOrDefaultAsync(x => x.Id == r.Id.Value && x.DeletedAt == null, ct)
                ?? throw AppException.NotFound("Statement");
        }
        else
        {
            // Upsert-by-natural-key so re-entering the same month for the
            // same producer + carrier updates the amounts instead of
            // creating a duplicate.
            row = await _db.OverCommissionStatements.FirstOrDefaultAsync(
                x => x.TenantId == tenantId
                  && x.InsuranceCompanyId == r.InsuranceCompanyId
                  && x.ProducerId == r.ProducerId
                  && x.Year == r.Year && x.Month == r.Month
                  && x.DeletedAt == null, ct);
            if (row == null)
            {
                row = new OverCommissionStatement { TenantId = tenantId };
                _db.OverCommissionStatements.Add(row);
            }
        }
        row.InsuranceCompanyId = r.InsuranceCompanyId;
        row.ProducerId = r.ProducerId;
        row.Year = r.Year;
        row.Month = r.Month;
        row.GrossAmount = r.GrossAmount;
        row.NetAmount = r.NetAmount == 0 ? r.GrossAmount : r.NetAmount;
        row.Currency = r.Currency;
        row.Reference = string.IsNullOrWhiteSpace(r.Reference) ? null : r.Reference.Trim();
        row.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        row.PaidOn = r.PaidOn;
        row.ProducerSharePercent = Math.Clamp(r.ProducerSharePercent, 0m, 100m);
        row.EnteredByUserId = _current.UserId;

        await _db.SaveChangesAsync(ct);

        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.Id == row.InsuranceCompanyId).Select(x => x.Name).FirstOrDefaultAsync(ct);
        var producer = await _db.Producers.IgnoreQueryFilters()
            .Where(x => x.Id == row.ProducerId).Select(x => new { x.Name, x.Code }).FirstOrDefaultAsync(ct);

        var (producerAmt, officeAmt) = SplitCalculator.Split(row.GrossAmount, row.ProducerSharePercent);
        return new OverCommissionStatementDto(
            row.Id, row.InsuranceCompanyId, carrier ?? "—",
            row.ProducerId, producer?.Name ?? "—", producer?.Code,
            row.Year, row.Month,
            row.GrossAmount, row.NetAmount, row.Currency,
            row.Reference, row.Notes,
            row.PaidOn,
            row.ProducerSharePercent, producerAmt, officeAmt,
            row.CreatedAt, row.UpdatedAt);
    }
}

/* ============================ Bulk upsert ============================ */

public record BulkStatementRow(
    Guid InsuranceCompanyId, Guid ProducerId,
    int Year, int Month,
    decimal GrossAmount, decimal NetAmount, string Currency,
    string? Reference, string? Notes,
    DateTime? PaidOn,
    decimal ProducerSharePercent);

public record BulkUpsertRowResult(int Index, bool Success, string? Error, Guid? Id);
public record BulkUpsertResult(int Inserted, int Updated, int Failed, IReadOnlyList<BulkUpsertRowResult> Rows);

public record BulkUpsertOverCommissionStatementsCommand(
    IReadOnlyList<BulkStatementRow> Rows) : IRequest<BulkUpsertResult>;

public class BulkUpsertOverCommissionStatementsHandler
    : IRequestHandler<BulkUpsertOverCommissionStatementsCommand, BulkUpsertResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public BulkUpsertOverCommissionStatementsHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<BulkUpsertResult> Handle(
        BulkUpsertOverCommissionStatementsCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Pre-load any existing rows that match the natural keys the client
        // is about to send. Lets us split inserts vs updates without one
        // round-trip per row.
        var keys = r.Rows.Select(x => new { x.InsuranceCompanyId, x.ProducerId, x.Year, x.Month }).ToList();
        var carrierIds = r.Rows.Select(x => x.InsuranceCompanyId).Distinct().ToList();
        var producerIds = r.Rows.Select(x => x.ProducerId).Distinct().ToList();
        var years = r.Rows.Select(x => x.Year).Distinct().ToList();
        var months = r.Rows.Select(x => x.Month).Distinct().ToList();

        var existing = await _db.OverCommissionStatements
            .Where(s => s.TenantId == tenantId && s.DeletedAt == null
                     && carrierIds.Contains(s.InsuranceCompanyId)
                     && producerIds.Contains(s.ProducerId)
                     && years.Contains(s.Year) && months.Contains(s.Month))
            .ToListAsync(ct);
        // Small in-memory join — the natural-key lookup we actually need.
        var existingByKey = existing.ToDictionary(
            s => (s.InsuranceCompanyId, s.ProducerId, s.Year, s.Month),
            s => s);

        var results = new List<BulkUpsertRowResult>();
        int inserted = 0, updated = 0, failed = 0;

        for (int i = 0; i < r.Rows.Count; i++)
        {
            var row = r.Rows[i];
            try
            {
                if (row.InsuranceCompanyId == Guid.Empty) throw new Exception("Λείπει η ασφαλιστική.");
                if (row.ProducerId == Guid.Empty) throw new Exception("Λείπει ο παραγωγός.");
                if (row.Year < 2000 || row.Year > 2100) throw new Exception("Άκυρο έτος.");
                if (row.Month < 1 || row.Month > 12) throw new Exception("Άκυρος μήνας.");
                if (row.GrossAmount < 0) throw new Exception("Αρνητικά μικτά.");

                var key = (row.InsuranceCompanyId, row.ProducerId, row.Year, row.Month);
                if (existingByKey.TryGetValue(key, out var s))
                {
                    s.GrossAmount = row.GrossAmount;
                    s.NetAmount = row.NetAmount == 0 ? row.GrossAmount : row.NetAmount;
                    s.Currency = row.Currency;
                    s.Reference = string.IsNullOrWhiteSpace(row.Reference) ? null : row.Reference.Trim();
                    s.Notes = string.IsNullOrWhiteSpace(row.Notes) ? null : row.Notes.Trim();
                    s.PaidOn = row.PaidOn;
                    s.ProducerSharePercent = Math.Clamp(row.ProducerSharePercent, 0m, 100m);
                    s.EnteredByUserId = _current.UserId;
                    updated++;
                    results.Add(new BulkUpsertRowResult(i, true, null, s.Id));
                }
                else
                {
                    var fresh = new OverCommissionStatement
                    {
                        TenantId = tenantId,
                        InsuranceCompanyId = row.InsuranceCompanyId,
                        ProducerId = row.ProducerId,
                        Year = row.Year, Month = row.Month,
                        GrossAmount = row.GrossAmount,
                        NetAmount = row.NetAmount == 0 ? row.GrossAmount : row.NetAmount,
                        Currency = row.Currency,
                        Reference = string.IsNullOrWhiteSpace(row.Reference) ? null : row.Reference.Trim(),
                        Notes = string.IsNullOrWhiteSpace(row.Notes) ? null : row.Notes.Trim(),
                        PaidOn = row.PaidOn,
                        ProducerSharePercent = Math.Clamp(row.ProducerSharePercent, 0m, 100m),
                        EnteredByUserId = _current.UserId
                    };
                    _db.OverCommissionStatements.Add(fresh);
                    // Register in the dict so a duplicate (same natural key) later in
                    // the batch is treated as an update against the pending insert.
                    existingByKey[key] = fresh;
                    inserted++;
                    results.Add(new BulkUpsertRowResult(i, true, null, fresh.Id));
                }
            }
            catch (Exception ex)
            {
                failed++;
                results.Add(new BulkUpsertRowResult(i, false, ex.Message, null));
            }
        }

        if (inserted + updated > 0)
            await _db.SaveChangesAsync(ct);

        return new BulkUpsertResult(inserted, updated, failed, results);
    }
}

public record DeleteOverCommissionStatementCommand(Guid Id) : IRequest;
public class DeleteOverCommissionStatementHandler : IRequestHandler<DeleteOverCommissionStatementCommand>
{
    private readonly IAppDbContext _db;
    public DeleteOverCommissionStatementHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteOverCommissionStatementCommand r, CancellationToken ct)
    {
        var row = await _db.OverCommissionStatements
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Statement");
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
