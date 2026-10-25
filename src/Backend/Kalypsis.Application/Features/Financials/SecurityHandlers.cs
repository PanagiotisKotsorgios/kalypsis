using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Financials;

public record SecurityEventDto(Guid Id, string Kind, DateTime OccurredOn, decimal Amount,
    string? Counterparty, string? Notes, string? PreviousValuesJson = null, string? NewValuesJson = null,
    Guid? ReceiptId = null, Guid? PaymentId = null);

public record SecurityDto(
    Guid Id, string Number, SecurityKind Kind, SecurityStatus Status,
    Guid? CustomerId, string CustomerName,
    Guid? IssuingBankId, string? IssuingBankName,
    DateOnly IssueDate, DateOnly MaturityDate, DateOnly? PaidDate,
    decimal Amount, string Currency, string? Notes,
    string Direction = "Incoming", string PartyKind = "Customer", Guid? PartyId = null,
    string? PartyName = null, decimal SettledAmount = 0, decimal OutstandingAmount = 0,
    string? BankAccount = null, string? DrawerName = null, string? HolderName = null,
    string? EndorserName = null, string? PlaceOfIssue = null, Guid? PolicyId = null);

public record SecurityBody(
    string Number, SecurityKind Kind, SecurityStatus Status,
    Guid? CustomerId, Guid? IssuingBankId,
    DateOnly IssueDate, DateOnly MaturityDate, DateOnly? PaidDate,
    decimal Amount, string Currency, string? Notes,
    string Direction = "Incoming", string PartyKind = "Customer", Guid? PartyId = null,
    string? PartyName = null, decimal SettledAmount = 0, string? BankAccount = null,
    string? DrawerName = null, string? HolderName = null, string? EndorserName = null,
    string? PlaceOfIssue = null, Guid? PolicyId = null);

public record ListSecuritiesQuery(SecurityStatus? Status, string? Direction = null,
    DateOnly? DueFrom = null, DateOnly? DueTo = null) : IRequest<IReadOnlyList<SecurityDto>>;

public class ListSecuritiesQueryHandler : IRequestHandler<ListSecuritiesQuery, IReadOnlyList<SecurityDto>>
{
    private readonly IAppDbContext _db;
    public ListSecuritiesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SecurityDto>> Handle(ListSecuritiesQuery r, CancellationToken ct)
    {
        var q = _db.Securities.Include(s => s.Customer).Include(s => s.IssuingBank).AsQueryable();
        if (r.Status.HasValue) q = q.Where(s => s.Status == r.Status);
        if (!string.IsNullOrWhiteSpace(r.Direction)) q = q.Where(s => s.Direction == r.Direction);
        if (r.DueFrom.HasValue) q = q.Where(s => s.MaturityDate >= r.DueFrom.Value);
        if (r.DueTo.HasValue) q = q.Where(s => s.MaturityDate <= r.DueTo.Value);
        var rows = await q.OrderBy(s => s.MaturityDate).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static SecurityDto Map(Security s)
    {
        var name = s.Customer is null ? (s.PartyName ?? "—") : s.Customer.Type == CustomerType.Individual
            ? $"{s.Customer.FirstName} {s.Customer.LastName}".Trim()
            : s.Customer.CompanyName ?? "—";
        return new SecurityDto(s.Id, s.Number, s.Kind, s.Status, s.CustomerId, name,
            s.IssuingBankId, s.IssuingBank?.BankName,
            s.IssueDate, s.MaturityDate, s.PaidDate, s.Amount, s.Currency, s.Notes,
            s.Direction, s.PartyKind, s.PartyId, string.IsNullOrWhiteSpace(s.PartyName) ? name : s.PartyName,
            s.SettledAmount, Math.Max(0, s.Amount - s.SettledAmount), s.BankAccount,
            s.DrawerName, s.HolderName, s.EndorserName, s.PlaceOfIssue, s.PolicyId);
    }
}

public record GetSecurityEventsQuery(Guid Id) : IRequest<IReadOnlyList<SecurityEventDto>>;
public sealed class GetSecurityEventsHandler : IRequestHandler<GetSecurityEventsQuery, IReadOnlyList<SecurityEventDto>>
{
    private readonly IAppDbContext _db;
    public GetSecurityEventsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SecurityEventDto>> Handle(GetSecurityEventsQuery q, CancellationToken ct)
    {
        if (!await _db.Securities.AnyAsync(x => x.Id == q.Id, ct)) throw AppException.NotFound("Security");
        return await _db.SecurityEvents.Where(x => x.SecurityId == q.Id)
            .OrderByDescending(x => x.OccurredOn).Select(x => new SecurityEventDto(
                x.Id, x.Kind, x.OccurredOn, x.Amount, x.Counterparty, x.Notes,
                x.PreviousValuesJson, x.NewValuesJson, x.ReceiptId, x.PaymentId)).ToListAsync(ct);
    }
}

public class SecurityBodyValidator : AbstractValidator<SecurityBody>
{
    public SecurityBodyValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(40);
        RuleFor(x => x.CustomerId).NotEmpty().When(x => x.Direction == "Incoming" || x.PartyKind == "Customer");
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.SettledAmount).GreaterThanOrEqualTo(0).LessThanOrEqualTo(x => x.Amount);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.IssueDate).LessThanOrEqualTo(x => x.MaturityDate);
        RuleFor(x => x.Direction).Must(x => x is "Incoming" or "Outgoing");
        RuleFor(x => x.PartyKind).Must(x => x is "Customer" or "Producer" or "InsuranceCompany" or "Other");
        RuleFor(x => x.PartyName).MaximumLength(200);
        RuleFor(x => x.BankAccount).MaximumLength(100);
        RuleFor(x => x.DrawerName).MaximumLength(200);
        RuleFor(x => x.HolderName).MaximumLength(200);
        RuleFor(x => x.EndorserName).MaximumLength(200);
        RuleFor(x => x.PlaceOfIssue).MaximumLength(200);
    }
}

public record CreateSecurityCommand(SecurityBody Body) : IRequest<SecurityDto>;
public class CreateSecurityCommandValidator : AbstractValidator<CreateSecurityCommand>
{ public CreateSecurityCommandValidator() { RuleFor(x => x.Body).SetValidator(new SecurityBodyValidator()); } }

public class CreateSecurityCommandHandler : IRequestHandler<CreateSecurityCommand, SecurityDto>
{
    private readonly IAppDbContext _db;
    public CreateSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<SecurityDto> Handle(CreateSecurityCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (b.SettledAmount != 0)
            throw new ValidationException("Η εξόφληση καταχωρείται ως ξεχωριστή ενέργεια, ώστε να δημιουργηθεί το αντίστοιχο παραστατικό και ιστορικό.");
        if (b.CustomerId.HasValue && !await _db.Customers.AnyAsync(x => x.Id == b.CustomerId, ct)) throw AppException.NotFound("Customer");
        if (b.PolicyId.HasValue && !await _db.Policies.AnyAsync(x => x.Id == b.PolicyId && x.CustomerId == b.CustomerId, ct))
            throw new ValidationException("Το συμβόλαιο δεν αντιστοιχεί στον πελάτη του αξιογράφου.");
        if (b.Direction == "Outgoing" && b.PartyKind == "Producer" && (!b.PartyId.HasValue || !await _db.Producers.AnyAsync(x => x.Id == b.PartyId, ct)))
            throw new ValidationException("Επιλέξτε έγκυρο συνεργάτη για το εξερχόμενο αξιόγραφο.");
        if (b.Direction == "Outgoing" && b.PartyKind == "InsuranceCompany" && (!b.PartyId.HasValue || !await _db.InsuranceCompanies.AnyAsync(x => x.Id == b.PartyId, ct)))
            throw new ValidationException("Επιλέξτε έγκυρη ασφαλιστική εταιρεία για το εξερχόμενο αξιόγραφο.");
        var s = new Security
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), Kind = b.Kind, Status = SecurityStatus.Open,
            CustomerId = b.CustomerId, IssuingBankId = b.IssuingBankId,
            IssueDate = b.IssueDate, MaturityDate = b.MaturityDate, PaidDate = b.PaidDate,
            Amount = b.Amount, SettledAmount = b.SettledAmount,
            Currency = b.Currency.ToUpperInvariant(), Notes = b.Notes,
            Direction = b.Direction, PartyKind = b.PartyKind, PartyId = b.PartyId,
            PartyName = b.PartyName?.Trim() ?? string.Empty, BankAccount = b.BankAccount?.Trim(),
            DrawerName = b.DrawerName?.Trim(), HolderName = b.HolderName?.Trim(),
            EndorserName = b.EndorserName?.Trim(), PlaceOfIssue = b.PlaceOfIssue?.Trim(), PolicyId = b.PolicyId
        };
        _db.Securities.Add(s);
        await _db.SaveChangesAsync(ct);
        s = await _db.Securities.Include(x => x.Customer).Include(x => x.IssuingBank).FirstAsync(x => x.Id == s.Id, ct);
        return ListSecuritiesQueryHandler.Map(s);
    }
}

public record UpdateSecurityCommand(Guid Id, SecurityBody Body) : IRequest<SecurityDto>;
public class UpdateSecurityCommandValidator : AbstractValidator<UpdateSecurityCommand>
{ public UpdateSecurityCommandValidator() { RuleFor(x => x.Body).SetValidator(new SecurityBodyValidator()); } }

public class UpdateSecurityCommandHandler : IRequestHandler<UpdateSecurityCommand, SecurityDto>
{
    private readonly IAppDbContext _db;
    public UpdateSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<SecurityDto> Handle(UpdateSecurityCommand r, CancellationToken ct)
    {
        var s = await _db.Securities.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Security");
        var b = r.Body;
        if (b.CustomerId.HasValue && !await _db.Customers.AnyAsync(x => x.Id == b.CustomerId, ct)) throw AppException.NotFound("Customer");
        var hasHistory = await _db.SecurityEvents.AnyAsync(x => x.SecurityId == s.Id, ct);
        if (hasHistory && (s.Number != b.Number.Trim() || s.Amount != b.Amount || s.Kind != b.Kind
            || s.Direction != b.Direction || s.PartyKind != b.PartyKind || s.PartyId != b.PartyId
            || s.CustomerId != b.CustomerId))
            throw new ValidationException("Ο αριθμός, η αξία, το είδος και ο συναλλασσόμενος δεν αλλάζουν αφού καταγραφεί ενέργεια στο αξιόγραφο.");
        if (s.SettledAmount > b.Amount) throw new ValidationException("Το ποσό δεν μπορεί να γίνει μικρότερο από όσα έχουν ήδη εισπραχθεί ή πληρωθεί.");
        if (b.PolicyId.HasValue && !await _db.Policies.AnyAsync(x => x.Id == b.PolicyId && x.CustomerId == b.CustomerId, ct))
            throw new ValidationException("Το συμβόλαιο δεν αντιστοιχεί στον πελάτη του αξιογράφου.");
        if (b.Direction == "Outgoing" && b.PartyKind == "Producer" && (!b.PartyId.HasValue || !await _db.Producers.AnyAsync(x => x.Id == b.PartyId, ct)))
            throw new ValidationException("Επιλέξτε έγκυρο συνεργάτη για το εξερχόμενο αξιόγραφο.");
        if (b.Direction == "Outgoing" && b.PartyKind == "InsuranceCompany" && (!b.PartyId.HasValue || !await _db.InsuranceCompanies.AnyAsync(x => x.Id == b.PartyId, ct)))
            throw new ValidationException("Επιλέξτε έγκυρη ασφαλιστική εταιρεία για το εξερχόμενο αξιόγραφο.");
        var beforeValues = new { s.IssueDate, s.MaturityDate, s.PaidDate, s.IssuingBankId, s.BankAccount,
            s.DrawerName, s.HolderName, s.EndorserName, s.PlaceOfIssue, s.Notes };
        s.Number = b.Number.Trim(); s.Kind = b.Kind;
        s.CustomerId = b.CustomerId; s.IssuingBankId = b.IssuingBankId;
        s.IssueDate = b.IssueDate; s.MaturityDate = b.MaturityDate; s.PaidDate = b.PaidDate;
        s.Amount = b.Amount; s.Currency = b.Currency.ToUpperInvariant(); s.Notes = b.Notes;
        s.Direction = b.Direction; s.PartyKind = b.PartyKind; s.PartyId = b.PartyId;
        s.PartyName = b.PartyName?.Trim() ?? string.Empty; s.BankAccount = b.BankAccount?.Trim();
        s.DrawerName = b.DrawerName?.Trim(); s.HolderName = b.HolderName?.Trim();
        s.EndorserName = b.EndorserName?.Trim(); s.PlaceOfIssue = b.PlaceOfIssue?.Trim(); s.PolicyId = b.PolicyId;
        var afterValues = new { s.IssueDate, s.MaturityDate, s.PaidDate, s.IssuingBankId, s.BankAccount,
            s.DrawerName, s.HolderName, s.EndorserName, s.PlaceOfIssue, s.Notes };
        if (hasHistory && System.Text.Json.JsonSerializer.Serialize(beforeValues) != System.Text.Json.JsonSerializer.Serialize(afterValues))
            _db.SecurityEvents.Add(new SecurityEvent { Id = Guid.NewGuid(), SecurityId = s.Id, Kind = "Edited",
                OccurredOn = DateTime.UtcNow, PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(beforeValues),
                NewValuesJson = System.Text.Json.JsonSerializer.Serialize(afterValues), Notes = "Ενημέρωση ημερομηνιών ή πρόσθετων στοιχείων" });
        if (s.Status is SecurityStatus.Paid or SecurityStatus.PartiallyPaid)
            s.Status = s.SettledAmount >= s.Amount ? SecurityStatus.Paid
                : s.SettledAmount > 0 ? SecurityStatus.PartiallyPaid : SecurityStatus.Open;
        await _db.SaveChangesAsync(ct);
        s = await _db.Securities.Include(x => x.Customer).Include(x => x.IssuingBank).FirstAsync(x => x.Id == s.Id, ct);
        return ListSecuritiesQueryHandler.Map(s);
    }
}

public record RecordSecurityEventBody(string Kind, DateTime OccurredOn, decimal Amount = 0,
    string? Counterparty = null, string? Notes = null);
public record RecordSecurityEventCommand(Guid Id, RecordSecurityEventBody Body) : IRequest<SecurityDto>;
public sealed class RecordSecurityEventHandler : IRequestHandler<RecordSecurityEventCommand, SecurityDto>
{
    private readonly IAppDbContext _db;
    public RecordSecurityEventHandler(IAppDbContext db) => _db = db;
    public async Task<SecurityDto> Handle(RecordSecurityEventCommand r, CancellationToken ct)
    {
        var security = await _db.Securities.Include(x => x.Customer).Include(x => x.IssuingBank)
            .FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Security");
        var b = r.Body;
        var kind = b.Kind.Trim();
        if (kind is not ("Received" or "Transferred" or "PartialSettlement" or "Settled" or "Bounced" or "Cancelled" or "Edited"))
            throw new ValidationException("Μη έγκυρη ενέργεια αξιογράφου.");
        var remaining = Math.Max(0, security.Amount - security.SettledAmount);
        var settlement = kind is "PartialSettlement" or "Settled";
        var amount = settlement ? (kind == "Settled" ? remaining : b.Amount) : Math.Max(0, b.Amount);
        if (settlement && (amount <= 0 || amount > remaining))
            throw new ValidationException("Το ποσό πρέπει να είναι μεγαλύτερο από μηδέν και έως το ανεξόφλητο υπόλοιπο.");
        if (kind == "Bounced" && security.SettledAmount <= 0)
            throw new ValidationException("Δεν υπάρχει καταχωρημένη μερική εξόφληση για αντιλογισμό.");

        var ev = new SecurityEvent
        {
            Id = Guid.NewGuid(), SecurityId = security.Id, Kind = kind,
            OccurredOn = b.OccurredOn == default ? DateTime.UtcNow : b.OccurredOn,
            Amount = amount, Counterparty = b.Counterparty?.Trim(), Notes = b.Notes?.Trim()
        };
        _db.SecurityEvents.Add(ev);
        if (settlement)
        {
            security.SettledAmount += amount;
            security.PaidDate = DateOnly.FromDateTime(ev.OccurredOn);
            security.Status = security.SettledAmount >= security.Amount
                ? SecurityStatus.Paid : SecurityStatus.PartiallyPaid;
            await CreatePrimarySettlementDocumentsAsync(security, ev, amount, ct);
        }
        else if (kind == "Bounced")
        {
            amount = Math.Min(amount <= 0 ? security.SettledAmount : amount, security.SettledAmount);
            ev.Amount = amount;
            security.SettledAmount -= amount;
            security.Status = security.SettledAmount > 0 ? SecurityStatus.PartiallyPaid : SecurityStatus.Bounced;
            await ReverseSettlementDocumentsAsync(security, amount, ct);
            AddCashMovement(security, amount, ev.OccurredOn, reverse: true, eventId: ev.Id);
        }
        else if (kind == "Transferred")
        {
            if (security.SettledAmount > 0)
                throw new ValidationException("Δεν γίνεται μεταβίβαση αξιογράφου με καταχωρημένες εξοφλήσεις. Καταχωρίστε πρώτα την αντίστοιχη λογιστική τακτοποίηση.");
            var previousHolder = security.HolderName;
            var nextHolder = string.IsNullOrWhiteSpace(b.Counterparty) ? null : b.Counterparty.Trim();
            if (nextHolder is null) throw new ValidationException("Συμπληρώστε τον νέο κάτοχο πριν από τη μεταβίβαση.");
            security.HolderName = nextHolder;
            ev.PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { holderName = previousHolder });
            ev.NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { holderName = nextHolder });
            security.Status = SecurityStatus.Transferred;
        }
        else if (kind == "Cancelled")
        {
            if (security.SettledAmount > 0m)
                throw new ValidationException("Το αξιόγραφο έχει εξοφληθεί μερικώς ή πλήρως. Καταχωρίστε πρώτα επιστροφή ή αντιλογισμό της εξόφλησης.");
            security.Status = SecurityStatus.Cancelled;
        }
        else if (kind == "Received" && security.Status == SecurityStatus.Transferred) security.Status = SecurityStatus.Open;

        await _db.SaveChangesAsync(ct);
        return ListSecuritiesQueryHandler.Map(security);
    }

    private async Task CreatePrimarySettlementDocumentsAsync(Security s, SecurityEvent ev, decimal amount, CancellationToken ct)
    {
        var date = DateOnly.FromDateTime(ev.OccurredOn);
        var reference = $"SEC-{s.Number}-{ev.Id.ToString("N")[..8]}";
        if (s.Direction == "Incoming")
        {
            if (!s.CustomerId.HasValue) throw new ValidationException("Το εισερχόμενο αξιόγραφο πρέπει να έχει συνδεδεμένο πελάτη.");
            var receipt = new Receipt { Id = Guid.NewGuid(), Number = reference, ReceivedOn = date,
                CustomerId = s.CustomerId.Value, PolicyId = s.PolicyId, Method = s.Kind == SecurityKind.Cheque ? PaymentMethod.Cheque : PaymentMethod.PromissoryNote,
                Amount = amount, Currency = s.Currency, TransactionReference = s.Number,
                Notes = $"Εξόφληση αξιογράφου {s.Number}" };
            _db.Receipts.Add(receipt);
            ev.ReceiptId = receipt.Id;
            _db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), MovementDate = date,
                Kind = FinancialMovementKind.CustomerCredit, Amount = amount, Currency = s.Currency,
                CustomerId = s.CustomerId, PolicyId = s.PolicyId, ReceiptId = receipt.Id,
                Description = $"Εξόφληση αξιογράφου {s.Number} [SEC:{ev.Id:N}]" });
            return;
        }

        if (s.PartyKind is "Producer" or "InsuranceCompany")
        {
            if (!s.PartyId.HasValue) throw new ValidationException("Επιλέξτε συνεργάτη ή ασφαλιστική εταιρεία ως δικαιούχο της πληρωμής.");
            var beneficiaryType = s.PartyKind == "Producer" ? BeneficiaryType.Producer : BeneficiaryType.InsuranceCompany;
            var payment = new Payment { Id = Guid.NewGuid(), Number = reference, PaidOn = date, BeneficiaryType = beneficiaryType,
                BeneficiaryProducerId = s.PartyKind == "Producer" ? s.PartyId : null,
                BeneficiaryInsuranceCompanyId = s.PartyKind == "InsuranceCompany" ? s.PartyId : null,
                BeneficiaryName = s.PartyName, Method = s.Kind == SecurityKind.Cheque ? PaymentMethod.Cheque : PaymentMethod.PromissoryNote,
                Amount = amount, Currency = s.Currency, PolicyId = s.PolicyId, TransactionReference = s.Number,
                Notes = $"Εξόφληση αξιογράφου {s.Number} [SEC:{ev.Id:N}]" };
            _db.Payments.Add(payment);
            ev.PaymentId = payment.Id;
            _db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), MovementDate = date,
                Kind = s.PartyKind == "InsuranceCompany" ? FinancialMovementKind.CompanyCharge : FinancialMovementKind.PartnerCharge,
                Amount = amount, Currency = s.Currency, ProducerId = s.PartyKind == "Producer" ? s.PartyId : null,
                InsuranceCompanyId = s.PartyKind == "InsuranceCompany" ? s.PartyId : null,
                PolicyId = s.PolicyId, PaymentId = payment.Id, Description = $"Πληρωμή αξιογράφου {s.Number} [SEC:{ev.Id:N}]" });
            return;
        }
        AddCashMovement(s, amount, ev.OccurredOn, reverse: false, eventId: ev.Id);
    }

    private async Task ReverseSettlementDocumentsAsync(Security s, decimal amount, CancellationToken ct)
    {
        var rows = await _db.SecurityEvents.Where(x => x.SecurityId == s.Id
                && (x.Kind == "PartialSettlement" || x.Kind == "Settled") && x.Amount > 0)
            .OrderByDescending(x => x.OccurredOn).ToListAsync(ct);
        var remaining = amount;
        foreach (var source in rows)
        {
            if (remaining <= 0m) break;
            var reverse = Math.Min(remaining, source.Amount);
            remaining -= reverse;
            if (source.ReceiptId.HasValue)
            {
                var receipt = await _db.Receipts.FirstOrDefaultAsync(x => x.Id == source.ReceiptId.Value, ct);
                if (receipt is not null) { receipt.Amount = Math.Max(0m, receipt.Amount - reverse); if (receipt.Amount == 0m) receipt.DeletedAt = DateTime.UtcNow; }
                var movement = await _db.FinancialMovements.FirstOrDefaultAsync(x => x.ReceiptId == source.ReceiptId.Value && x.DeletedAt == null, ct);
                if (movement is not null) { movement.Amount = Math.Max(0m, movement.Amount - reverse); if (movement.Amount == 0m) movement.DeletedAt = DateTime.UtcNow; }
            }
            else if (source.PaymentId.HasValue)
            {
                var payment = await _db.Payments.FirstOrDefaultAsync(x => x.Id == source.PaymentId.Value, ct);
                if (payment is not null) { payment.Amount = Math.Max(0m, payment.Amount - reverse); if (payment.Amount == 0m) payment.DeletedAt = DateTime.UtcNow; }
                var movement = await _db.FinancialMovements.FirstOrDefaultAsync(x => x.PaymentId == source.PaymentId.Value && x.DeletedAt == null, ct);
                if (movement is not null) { movement.Amount = Math.Max(0m, movement.Amount - reverse); if (movement.Amount == 0m) movement.DeletedAt = DateTime.UtcNow; }
            }
            else
            {
                var marker = $"[SEC:{source.Id:N}]";
                var movement = await _db.FinancialMovements.FirstOrDefaultAsync(x => x.DeletedAt == null
                    && x.Description != null && x.Description.Contains(marker), ct);
                if (movement is not null) { movement.Amount = Math.Max(0m, movement.Amount - reverse); if (movement.Amount == 0m) movement.DeletedAt = DateTime.UtcNow; }
            }
        }
    }

    private void AddCashMovement(Security s, decimal amount, DateTime date, bool reverse, Guid? eventId = null)
    {
        var kind = s.Direction == "Incoming"
            ? (reverse ? FinancialMovementKind.CustomerCharge : FinancialMovementKind.CustomerCredit)
            : s.PartyKind == "InsuranceCompany"
                ? (reverse ? FinancialMovementKind.CompanyCredit : FinancialMovementKind.CompanyCharge)
                : s.PartyKind == "Producer"
                    ? (reverse ? FinancialMovementKind.PartnerCredit : FinancialMovementKind.PartnerCharge)
                    : FinancialMovementKind.Adjustment;
        _db.FinancialMovements.Add(new FinancialMovement
        {
            Id = Guid.NewGuid(), MovementDate = DateOnly.FromDateTime(date), Kind = kind,
            Amount = amount, Currency = s.Currency, CustomerId = s.Direction == "Incoming" ? s.CustomerId : null,
            ProducerId = s.Direction == "Outgoing" && s.PartyKind == "Producer" ? s.PartyId : null,
            InsuranceCompanyId = s.Direction == "Outgoing" && s.PartyKind == "InsuranceCompany" ? s.PartyId : null,
            PolicyId = s.PolicyId,
            Description = $"{(reverse ? "Αντιλογισμός" : "Εξόφληση")} αξιογράφου {s.Number}{(eventId.HasValue ? $" [SEC:{eventId.Value:N}]" : string.Empty)}"
        });
    }
}

public record DeleteSecurityCommand(Guid Id) : IRequest<Unit>;
public class DeleteSecurityCommandHandler : IRequestHandler<DeleteSecurityCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteSecurityCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteSecurityCommand r, CancellationToken ct)
    {
        var s = await _db.Securities.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Security");
        if (await _db.SecurityEvents.AnyAsync(x => x.SecurityId == s.Id, ct))
            throw new ValidationException("Το αξιόγραφο έχει ιστορικό ενεργειών. Ακυρώστε το αντί να το διαγράψετε.");
        s.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
