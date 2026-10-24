using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record DeleteCustomerCommand(Guid Id) : IRequest<Unit>;

public class DeleteCustomerCommandHandler : IRequestHandler<DeleteCustomerCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public DeleteCustomerCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<Unit> Handle(DeleteCustomerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.Id == request.Id
                && c.TenantId == tenantId
                && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");

        var relationshipCount = await _db.CustomerRelationships.CountAsync(x =>
            (x.CustomerId == request.Id || x.RelatedCustomerId == request.Id) && x.DeletedAt == null, ct);
        var ownershipLinks = await _db.VehicleOwnershipRegisters.CountAsync(r => r.TenantId == tenantId && r.LedgerJson.Contains(request.Id.ToString()), ct);
        var blockers = new[]
        {
            new DeletionBlocker("ιδιοκτησία / ιστορικό οχημάτων", ownershipLinks),
            new DeletionBlocker("συμβόλαια", await _db.Policies.CountAsync(x =>
                (x.CustomerId == request.Id || x.ContractPartyCustomerId == request.Id) && x.DeletedAt == null, ct)),
            new DeletionBlocker("εισπράξεις", await _db.Receipts.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("βεβαιώσεις κάλυψης", await _db.CoverNotes.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("πιστωτικά", await _db.CreditNotes.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("αξιόγραφα", await _db.Securities.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("οικονομικές κινήσεις", await _db.FinancialMovements.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("γενικές οικονομικές εγγραφές", await _db.GeneralFinancialEntries.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("επικοινωνίες", await _db.CommunicationLogs.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("πρόσθετες επαφές", await _db.CustomerContacts.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("οικογενειακές σχέσεις", relationshipCount),
            new DeletionBlocker("ασφαλιστικές ανάγκες", await _db.CustomerInsuranceNeeds.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("συγκαταθέσεις GDPR", await _db.ConsentRecords.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("υπογεγραμμένα έντυπα", await _db.CustomerFormSignings.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("ραντεβού", await _db.Appointments.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("εργασίες", await _db.AgencyTasks.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("αιτήματα εξυπηρέτησης", await _db.ServiceRequests.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("ευκαιρίες CRM", await _db.CrmOpportunities.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("προσφορές", await _db.Quotes.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("φακέλους εγγράφων", await _db.DocumentFolders.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("προφίλ κινδύνου", await _db.RiskProfiles.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("ειδοποιητήρια πληρωμής", await _db.PaymentNotices.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("online πληρωμές", await _db.OnlinePaymentSessions.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("παραστατικά myDATA", await _db.MyDataInvoices.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("μηνύματα SMS", await _db.SmsLogs.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("μηνύματα Viber", await _db.ViberLogs.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
            new DeletionBlocker("συνδεδεμένους χρήστες", await _db.Users.CountAsync(x => x.CustomerId == request.Id && x.DeletedAt == null, ct)),
        };
        DeletionProtection.ThrowIfBlocked($"πελάτη «{customer.CustomerNumber}»", blockers);

        customer.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
