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

        var mapped = rows.Select(s => new OverCommissionStatementDto(
            s.Id, s.InsuranceCompanyId, carriers.GetValueOrDefault(s.InsuranceCompanyId, "—"),
            s.ProducerId,
            producerMap.TryGetValue(s.ProducerId, out var p) ? p.Name : "—",
            producerMap.TryGetValue(s.ProducerId, out var p2) ? p2.Code : null,
            s.Year, s.Month,
            s.GrossAmount, s.NetAmount, s.Currency,
            s.Reference, s.Notes,
            s.PaidOn,
            s.CreatedAt, s.UpdatedAt
        )).AsEnumerable();

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
    DateTime? PaidOn) : IRequest<OverCommissionStatementDto>;

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
        row.EnteredByUserId = _current.UserId;

        await _db.SaveChangesAsync(ct);

        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.Id == row.InsuranceCompanyId).Select(x => x.Name).FirstOrDefaultAsync(ct);
        var producer = await _db.Producers.IgnoreQueryFilters()
            .Where(x => x.Id == row.ProducerId).Select(x => new { x.Name, x.Code }).FirstOrDefaultAsync(ct);

        return new OverCommissionStatementDto(
            row.Id, row.InsuranceCompanyId, carrier ?? "—",
            row.ProducerId, producer?.Name ?? "—", producer?.Code,
            row.Year, row.Month,
            row.GrossAmount, row.NetAmount, row.Currency,
            row.Reference, row.Notes,
            row.PaidOn,
            row.CreatedAt, row.UpdatedAt);
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
