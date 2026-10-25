using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record PartyLedgerLineDto(Guid Id, string PartyKind, Guid PartyId, string PartyName,
    DateTime EntryDate, DateTime? DueDate, decimal Debit, decimal Credit,
    decimal OpenDebit, decimal OpenCredit, string Currency, string Description,
    string? DocumentNumber, Guid? PolicyId, string? CollectionCentreCode,
    string? CostCentreCode, string? Notes, bool IsAutomatic = false);
public record PartyLedgerAccountDto(string PartyKind, Guid PartyId, string PartyName,
    IReadOnlyList<PartyLedgerLineDto> Entries, IReadOnlyDictionary<string, decimal> Balances,
    IReadOnlyDictionary<string, decimal> Overdue, IReadOnlyDictionary<string, decimal> Age1To30,
    IReadOnlyDictionary<string, decimal> Age31To60, IReadOnlyDictionary<string, decimal> Age61To90,
    IReadOnlyDictionary<string, decimal> AgeOver90);
public record ListPartyLedgerQuery(string PartyKind, Guid PartyId) : IRequest<PartyLedgerAccountDto>;

public sealed class ListPartyLedgerHandler : IRequestHandler<ListPartyLedgerQuery, PartyLedgerAccountDto>
{
    private readonly IAppDbContext _db;
    public ListPartyLedgerHandler(IAppDbContext db) => _db = db;
    public async Task<PartyLedgerAccountDto> Handle(ListPartyLedgerQuery q, CancellationToken ct)
    {
        var kind = NormalizeKind(q.PartyKind);
        var name = await PartyName(kind, q.PartyId, ct);
        var lines = await _db.PartyLedgerEntries.Where(x => x.PartyKind == kind && x.PartyId == q.PartyId)
            .OrderByDescending(x => x.EntryDate).ToListAsync(ct);
        var ids = lines.Select(x => x.Id).ToArray();
        var allocations = ids.Length == 0 ? [] : await _db.LedgerAllocations
            .Where(x => ids.Contains(x.DebitEntryId) || ids.Contains(x.CreditEntryId)).ToListAsync(ct);
        var today = DateTime.UtcNow.Date;
        var mapped = lines.Select(x =>
        {
            var debitApplied = allocations.Where(a => a.DebitEntryId == x.Id).Sum(a => a.Amount);
            var creditApplied = allocations.Where(a => a.CreditEntryId == x.Id).Sum(a => a.Amount);
            return new PartyLedgerLineDto(x.Id, kind, q.PartyId, name, x.EntryDate, x.DueDate,
                x.Debit, x.Credit, Math.Max(0, x.Debit - debitApplied), Math.Max(0, x.Credit - creditApplied),
                x.Currency, x.Description, x.DocumentNumber, x.PolicyId, x.CollectionCentreCode,
                x.CostCentreCode, x.Notes);
        }).ToList();
        // Include posted journal activity in the same account view. Automatic
        // rows are read-only and link back to their source document.
        var movements = await _db.FinancialMovements.AsNoTracking()
            .Include(x => x.Policy).Include(x => x.Receipt).Include(x => x.Payment)
            .Where(x => x.DeletedAt == null && (kind == "Customer"
                    ? x.CustomerId == q.PartyId && (x.Kind == FinancialMovementKind.CustomerCharge || x.Kind == FinancialMovementKind.CustomerCredit)
                : kind == "Producer"
                    ? x.ProducerId == q.PartyId && (x.Kind == FinancialMovementKind.PartnerCharge || x.Kind == FinancialMovementKind.PartnerCredit || x.Kind == FinancialMovementKind.OverCommissionEarned)
                : x.InsuranceCompanyId == q.PartyId && (x.Kind == FinancialMovementKind.CompanyCharge || x.Kind == FinancialMovementKind.CompanyCredit
                    || x.Kind == FinancialMovementKind.CommissionEarned || x.Kind == FinancialMovementKind.CarrierCommissionReceived)))
            .OrderByDescending(x => x.MovementDate).ToListAsync(ct);
        var automatic = movements.Select(x =>
        {
            var (debit, credit) = (kind, x.Kind) switch
            {
                ("Customer", FinancialMovementKind.CustomerCharge) => (x.Amount, 0m),
                ("Customer", FinancialMovementKind.CustomerCredit) => (0m, x.Amount),
                ("Producer", FinancialMovementKind.PartnerCharge) => (x.Amount, 0m),
                ("Producer", FinancialMovementKind.PartnerCredit or FinancialMovementKind.OverCommissionEarned) => (0m, x.Amount),
                ("InsuranceCompany", FinancialMovementKind.CompanyCharge) => (x.Amount, 0m),
                ("InsuranceCompany", FinancialMovementKind.CompanyCredit) => (0m, x.Amount),
                ("InsuranceCompany", FinancialMovementKind.CommissionEarned) => (0m, x.Amount),
                ("InsuranceCompany", FinancialMovementKind.CarrierCommissionReceived) => (x.Amount, 0m),
                _ => (0m, 0m)
            };
            return new PartyLedgerLineDto(x.Id, kind, q.PartyId, name,
                x.MovementDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), null, debit, credit, debit, credit,
                x.Currency, x.Description ?? x.Kind.ToString(), x.Receipt?.Number ?? x.Payment?.Number ?? x.Policy?.PolicyNumber,
                x.PolicyId, null, null, null, true);
        }).ToList();
        mapped.AddRange(automatic.Where(a => !lines.Any(m => m.PolicyId.HasValue && m.PolicyId == a.PolicyId
            && m.Currency == a.Currency && m.EntryDate.Date == a.EntryDate.Date
            && m.Debit == a.Debit && m.Credit == a.Credit)));
        mapped = mapped.OrderByDescending(x => x.EntryDate).ThenBy(x => x.IsAutomatic).ToList();
        var currencies = mapped.Select(x => x.Currency).Distinct().ToArray();
        Dictionary<string, decimal> Roll(Func<PartyLedgerLineDto, decimal> amount) => currencies.ToDictionary(
            c => c, c => mapped.Where(x => x.Currency == c).Sum(amount));
        decimal Open(PartyLedgerLineDto x) => x.OpenDebit - x.OpenCredit;
        var overdue = Roll(x => x.DueDate.HasValue && x.DueDate.Value.Date < today ? x.OpenDebit : 0);
        var age30 = Roll(x => x.OpenDebit > 0 && x.DueDate.HasValue && (today - x.DueDate.Value.Date).Days is >= 1 and <= 30 ? x.OpenDebit : 0);
        var age60 = Roll(x => x.OpenDebit > 0 && x.DueDate.HasValue && (today - x.DueDate.Value.Date).Days is >= 31 and <= 60 ? x.OpenDebit : 0);
        var age90 = Roll(x => x.OpenDebit > 0 && x.DueDate.HasValue && (today - x.DueDate.Value.Date).Days is >= 61 and <= 90 ? x.OpenDebit : 0);
        var ageOver90 = Roll(x => x.OpenDebit > 0 && x.DueDate.HasValue && (today - x.DueDate.Value.Date).Days > 90 ? x.OpenDebit : 0);
        var balances = currencies.ToDictionary(c => c, c => mapped.Where(x => x.Currency == c).Sum(Open));
        return new PartyLedgerAccountDto(kind, q.PartyId, name, mapped, balances, overdue, age30, age60, age90, ageOver90);
    }
    internal static string NormalizeKind(string kind) => kind.Trim() switch
    {
        "Customer" => "Customer", "Producer" => "Producer", "InsuranceCompany" => "InsuranceCompany",
        _ => throw AppException.Validation("Μη έγκυρος τύπος συναλλασσομένου.")
    };
    private async Task<string> PartyName(string kind, Guid id, CancellationToken ct) => kind switch
    {
        "Customer" => await _db.Customers.Where(x => x.Id == id).Select(x => x.Type == Kalypsis.Domain.Enums.CustomerType.Company
            ? x.CompanyName ?? x.CustomerNumber : (x.FirstName + " " + x.LastName).Trim()).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Customer"),
        "Producer" => await _db.Producers.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Producer"),
        _ => await _db.InsuranceCompanies.Where(x => x.Id == id).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Insurance company")
    };
}

public record PartyLedgerEntryBody(string PartyKind, Guid PartyId, DateTime EntryDate, DateTime? DueDate,
    decimal Debit, decimal Credit, string Currency, string Description, string? DocumentNumber,
    Guid? PolicyId, string? CollectionCentreCode, string? CostCentreCode, string? Notes);
public record CreatePartyLedgerEntryCommand(PartyLedgerEntryBody Body) : IRequest<PartyLedgerLineDto>;
public sealed class PartyLedgerEntryValidator : AbstractValidator<PartyLedgerEntryBody>
{
    public PartyLedgerEntryValidator()
    {
        RuleFor(x => x.PartyKind).Must(x => x is "Customer" or "Producer" or "InsuranceCompany");
        RuleFor(x => x.PartyId).NotEmpty(); RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Debit).GreaterThanOrEqualTo(0); RuleFor(x => x.Credit).GreaterThanOrEqualTo(0);
        RuleFor(x => x).Must(x => (x.Debit > 0 && x.Credit == 0) || (x.Credit > 0 && x.Debit == 0))
            .WithMessage("Καταχωρίστε χρέωση ή πίστωση, όχι και τα δύο.");
        RuleFor(x => x.DocumentNumber).MaximumLength(100); RuleFor(x => x.CollectionCentreCode).MaximumLength(80);
        RuleFor(x => x.CostCentreCode).MaximumLength(80);
    }
}
public sealed class CreatePartyLedgerEntryHandler : IRequestHandler<CreatePartyLedgerEntryCommand, PartyLedgerLineDto>
{
    private readonly IAppDbContext _db;
    public CreatePartyLedgerEntryHandler(IAppDbContext db) => _db = db;
    public async Task<PartyLedgerLineDto> Handle(CreatePartyLedgerEntryCommand r, CancellationToken ct)
    {
        new PartyLedgerEntryValidator().ValidateAndThrow(r.Body);
        var b = r.Body; var kind = ListPartyLedgerHandler.NormalizeKind(b.PartyKind);
        var name = kind switch
        {
            "Customer" => await _db.Customers.Where(x => x.Id == b.PartyId).Select(x => x.CustomerNumber).FirstOrDefaultAsync(ct),
            "Producer" => await _db.Producers.Where(x => x.Id == b.PartyId).Select(x => x.Name).FirstOrDefaultAsync(ct),
            _ => await _db.InsuranceCompanies.Where(x => x.Id == b.PartyId).Select(x => x.Name).FirstOrDefaultAsync(ct)
        };
        if (name is null) throw AppException.NotFound("Counterparty");
        var row = new PartyLedgerEntry
        {
            PartyKind = kind, PartyId = b.PartyId, EntryDate = b.EntryDate, DueDate = b.DueDate,
            Debit = b.Debit, Credit = b.Credit, Currency = b.Currency.ToUpperInvariant(),
            Description = b.Description.Trim(), DocumentNumber = Clean(b.DocumentNumber), PolicyId = b.PolicyId,
            CollectionCentreCode = Clean(b.CollectionCentreCode), CostCentreCode = Clean(b.CostCentreCode), Notes = Clean(b.Notes)
        };
        _db.PartyLedgerEntries.Add(row); await _db.SaveChangesAsync(ct);
        return new PartyLedgerLineDto(row.Id, kind, b.PartyId, name, row.EntryDate, row.DueDate, row.Debit,
            row.Credit, row.Debit, row.Credit, row.Currency, row.Description, row.DocumentNumber,
            row.PolicyId, row.CollectionCentreCode, row.CostCentreCode, row.Notes);
    }
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public record UpdatePartyLedgerEntryCommand(Guid Id, PartyLedgerEntryBody Body) : IRequest<PartyLedgerLineDto>;
public sealed class UpdatePartyLedgerEntryHandler : IRequestHandler<UpdatePartyLedgerEntryCommand, PartyLedgerLineDto>
{
    private readonly IAppDbContext _db;
    public UpdatePartyLedgerEntryHandler(IAppDbContext db) => _db = db;
    public async Task<PartyLedgerLineDto> Handle(UpdatePartyLedgerEntryCommand r, CancellationToken ct)
    {
        new PartyLedgerEntryValidator().ValidateAndThrow(r.Body);
        var row = await _db.PartyLedgerEntries.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Entry");
        if (await _db.LedgerAllocations.AnyAsync(x => x.DebitEntryId == row.Id || x.CreditEntryId == row.Id, ct))
            throw AppException.Validation("Η γραμμή έχει συμψηφιστεί. Αφαιρέστε πρώτα τον συμψηφισμό για να την αλλάξετε.");
        var b = r.Body; var kind = ListPartyLedgerHandler.NormalizeKind(b.PartyKind);
        var name = kind switch
        {
            "Customer" => await _db.Customers.Where(x => x.Id == b.PartyId).Select(x => x.Type == CustomerType.Company ? x.CompanyName ?? x.CustomerNumber : (x.FirstName + " " + x.LastName).Trim()).FirstOrDefaultAsync(ct),
            "Producer" => await _db.Producers.Where(x => x.Id == b.PartyId).Select(x => x.Name).FirstOrDefaultAsync(ct),
            _ => await _db.InsuranceCompanies.Where(x => x.Id == b.PartyId).Select(x => x.Name).FirstOrDefaultAsync(ct)
        };
        if (name is null) throw AppException.NotFound("Counterparty");
        row.PartyKind = kind; row.PartyId = b.PartyId; row.EntryDate = b.EntryDate; row.DueDate = b.DueDate;
        row.Debit = b.Debit; row.Credit = b.Credit; row.Currency = b.Currency.ToUpperInvariant();
        row.Description = b.Description.Trim(); row.DocumentNumber = Clean(b.DocumentNumber); row.PolicyId = b.PolicyId;
        row.CollectionCentreCode = Clean(b.CollectionCentreCode); row.CostCentreCode = Clean(b.CostCentreCode); row.Notes = Clean(b.Notes);
        await _db.SaveChangesAsync(ct);
        return new PartyLedgerLineDto(row.Id, kind, b.PartyId, name, row.EntryDate, row.DueDate, row.Debit,
            row.Credit, row.Debit, row.Credit, row.Currency, row.Description, row.DocumentNumber,
            row.PolicyId, row.CollectionCentreCode, row.CostCentreCode, row.Notes);
    }
    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public record AllocateLedgerBody(Guid DebitEntryId, Guid CreditEntryId, decimal Amount, DateTime AllocatedOn, string? Notes);
public record AllocateLedgerCommand(AllocateLedgerBody Body) : IRequest;
public sealed class AllocateLedgerHandler : IRequestHandler<AllocateLedgerCommand>
{
    private readonly IAppDbContext _db;
    public AllocateLedgerHandler(IAppDbContext db) => _db = db;
    public async Task Handle(AllocateLedgerCommand r, CancellationToken ct)
    {
        var b = r.Body; if (b.Amount <= 0) throw AppException.Validation("Το ποσό συμψηφισμού πρέπει να είναι θετικό.");
        var debit = await _db.PartyLedgerEntries.FirstOrDefaultAsync(x => x.Id == b.DebitEntryId, ct) ?? throw AppException.NotFound("Debit entry");
        var credit = await _db.PartyLedgerEntries.FirstOrDefaultAsync(x => x.Id == b.CreditEntryId, ct) ?? throw AppException.NotFound("Credit entry");
        if (debit.Debit <= 0 || credit.Credit <= 0 || debit.PartyKind != credit.PartyKind || debit.PartyId != credit.PartyId || debit.Currency != credit.Currency)
            throw AppException.Validation("Ο συμψηφισμός απαιτεί χρέωση και πίστωση του ίδιου συναλλασσομένου και νομίσματος.");
        var debitUsed = await _db.LedgerAllocations.Where(x => x.DebitEntryId == debit.Id).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        var creditUsed = await _db.LedgerAllocations.Where(x => x.CreditEntryId == credit.Id).SumAsync(x => (decimal?)x.Amount, ct) ?? 0;
        if (b.Amount > debit.Debit - debitUsed || b.Amount > credit.Credit - creditUsed)
            throw AppException.Validation("Το ποσό υπερβαίνει το διαθέσιμο υπόλοιπο της χρέωσης ή της πίστωσης.");
        _db.LedgerAllocations.Add(new LedgerAllocation { DebitEntryId = debit.Id, CreditEntryId = credit.Id,
            Amount = b.Amount, AllocatedOn = b.AllocatedOn == default ? DateTime.UtcNow : b.AllocatedOn, Notes = b.Notes });
        await _db.SaveChangesAsync(ct);
    }
}

public record DeletePartyLedgerEntryCommand(Guid Id) : IRequest;
public sealed class DeletePartyLedgerEntryHandler : IRequestHandler<DeletePartyLedgerEntryCommand>
{
    private readonly IAppDbContext _db;
    public DeletePartyLedgerEntryHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeletePartyLedgerEntryCommand r, CancellationToken ct)
    {
        var row = await _db.PartyLedgerEntries.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Entry");
        if (await _db.LedgerAllocations.AnyAsync(x => x.DebitEntryId == row.Id || x.CreditEntryId == row.Id, ct))
            throw AppException.Validation("Η γραμμή έχει συμψηφισμούς. Ακυρώστε πρώτα τους συμψηφισμούς.");
        row.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct);
    }
}
