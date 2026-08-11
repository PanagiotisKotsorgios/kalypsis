using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.GeneralFinancialEntries;

public record GeneralFinancialEntryDto(
    Guid Id, string Kind, string Category, string? Subcategory,
    DateTime EntryDate, decimal Amount, string Currency,
    string? Description, string? Counterparty, string? Reference,
    Guid? PolicyId, Guid? CustomerId, Guid? ProducerId,
    DateTime CreatedAt, DateTime? UpdatedAt);

public record ListGeneralFinancialEntriesQuery(
    int? Year, int? Month, string? Kind, string? Category, string? Search)
    : IRequest<IReadOnlyList<GeneralFinancialEntryDto>>;

public class ListGeneralFinancialEntriesHandler
    : IRequestHandler<ListGeneralFinancialEntriesQuery, IReadOnlyList<GeneralFinancialEntryDto>>
{
    private readonly IAppDbContext _db;
    public ListGeneralFinancialEntriesHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<GeneralFinancialEntryDto>> Handle(
        ListGeneralFinancialEntriesQuery r, CancellationToken ct)
    {
        var q = _db.GeneralFinancialEntries.Where(x => x.DeletedAt == null);
        if (r.Year.HasValue)  q = q.Where(x => x.EntryDate.Year  == r.Year.Value);
        if (r.Month.HasValue) q = q.Where(x => x.EntryDate.Month == r.Month.Value);
        if (!string.IsNullOrEmpty(r.Kind)) q = q.Where(x => x.Kind == r.Kind);
        if (!string.IsNullOrEmpty(r.Category)) q = q.Where(x => x.Category == r.Category);
        if (!string.IsNullOrEmpty(r.Search))
        {
            var s = r.Search;
            q = q.Where(x => (x.Description ?? "").Contains(s)
                          || (x.Counterparty ?? "").Contains(s)
                          || (x.Reference    ?? "").Contains(s)
                          || x.Category.Contains(s));
        }
        var rows = await q.OrderByDescending(x => x.EntryDate).Take(2000).ToListAsync(ct);
        return rows.Select(x => new GeneralFinancialEntryDto(
            x.Id, x.Kind, x.Category, x.Subcategory,
            x.EntryDate, x.Amount, x.Currency,
            x.Description, x.Counterparty, x.Reference,
            x.PolicyId, x.CustomerId, x.ProducerId,
            x.CreatedAt, x.UpdatedAt)).ToList();
    }
}

public record UpsertGeneralFinancialEntryCommand(
    Guid? Id, string Kind, string Category, string? Subcategory,
    DateTime EntryDate, decimal Amount, string Currency,
    string? Description, string? Counterparty, string? Reference,
    Guid? PolicyId, Guid? CustomerId, Guid? ProducerId)
    : IRequest<GeneralFinancialEntryDto>;

public class UpsertGeneralFinancialEntryValidator : AbstractValidator<UpsertGeneralFinancialEntryCommand>
{
    public UpsertGeneralFinancialEntryValidator()
    {
        RuleFor(x => x.Kind).Must(k => k == "Income" || k == "Expense")
            .WithMessage("Kind πρέπει να είναι Income ή Expense.");
        RuleFor(x => x.Category).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Amount).GreaterThan(0m).WithMessage("Το ποσό πρέπει να είναι θετικό.");
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}

public class UpsertGeneralFinancialEntryHandler
    : IRequestHandler<UpsertGeneralFinancialEntryCommand, GeneralFinancialEntryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpsertGeneralFinancialEntryHandler(IAppDbContext db, ICurrentUser current)
    { _db = db; _current = current; }

    public async Task<GeneralFinancialEntryDto> Handle(
        UpsertGeneralFinancialEntryCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        GeneralFinancialEntry row;
        if (r.Id.HasValue)
        {
            row = await _db.GeneralFinancialEntries
                .FirstOrDefaultAsync(x => x.Id == r.Id.Value && x.DeletedAt == null, ct)
                ?? throw AppException.NotFound("Entry");
        }
        else
        {
            row = new GeneralFinancialEntry { TenantId = tenantId };
            _db.GeneralFinancialEntries.Add(row);
        }
        row.Kind = r.Kind;
        row.Category = r.Category.Trim();
        row.Subcategory = string.IsNullOrWhiteSpace(r.Subcategory) ? null : r.Subcategory.Trim();
        row.EntryDate = r.EntryDate;
        row.Amount = r.Amount;
        row.Currency = r.Currency;
        row.Description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        row.Counterparty = string.IsNullOrWhiteSpace(r.Counterparty) ? null : r.Counterparty.Trim();
        row.Reference = string.IsNullOrWhiteSpace(r.Reference) ? null : r.Reference.Trim();
        row.PolicyId = r.PolicyId;
        row.CustomerId = r.CustomerId;
        row.ProducerId = r.ProducerId;
        row.EnteredByUserId = _current.UserId;
        await _db.SaveChangesAsync(ct);
        return new GeneralFinancialEntryDto(
            row.Id, row.Kind, row.Category, row.Subcategory,
            row.EntryDate, row.Amount, row.Currency,
            row.Description, row.Counterparty, row.Reference,
            row.PolicyId, row.CustomerId, row.ProducerId,
            row.CreatedAt, row.UpdatedAt);
    }
}

public record DeleteGeneralFinancialEntryCommand(Guid Id) : IRequest;
public class DeleteGeneralFinancialEntryHandler : IRequestHandler<DeleteGeneralFinancialEntryCommand>
{
    private readonly IAppDbContext _db;
    public DeleteGeneralFinancialEntryHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteGeneralFinancialEntryCommand r, CancellationToken ct)
    {
        var row = await _db.GeneralFinancialEntries
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Entry");
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

// ─────────────────────────────────────────────────────────────────────
// Rollup — monthly totals per category for the P&L card
// ─────────────────────────────────────────────────────────────────────
public record GeneralFinancialRollupRow(string Kind, string Category, decimal Total);
public record GeneralFinancialRollupQuery(int Year, int? Month)
    : IRequest<IReadOnlyList<GeneralFinancialRollupRow>>;

public class GeneralFinancialRollupHandler
    : IRequestHandler<GeneralFinancialRollupQuery, IReadOnlyList<GeneralFinancialRollupRow>>
{
    private readonly IAppDbContext _db;
    public GeneralFinancialRollupHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GeneralFinancialRollupRow>> Handle(
        GeneralFinancialRollupQuery r, CancellationToken ct)
    {
        var q = _db.GeneralFinancialEntries
            .Where(x => x.DeletedAt == null && x.EntryDate.Year == r.Year);
        if (r.Month.HasValue) q = q.Where(x => x.EntryDate.Month == r.Month.Value);
        var rows = await q.GroupBy(x => new { x.Kind, x.Category })
            .Select(g => new GeneralFinancialRollupRow(g.Key.Kind, g.Key.Category, g.Sum(v => v.Amount)))
            .OrderBy(g => g.Kind).ThenByDescending(g => g.Total)
            .ToListAsync(ct);
        return rows;
    }
}
