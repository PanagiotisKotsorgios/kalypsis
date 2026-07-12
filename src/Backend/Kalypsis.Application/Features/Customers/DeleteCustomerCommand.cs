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

        var customer = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == request.Id
                && c.TenantId == tenantId
                && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");

        // Refuse if the customer still has active data pointing at them —
        // policies, claims, receipts, communications. Soft-deleting on top
        // of live history breaks the "recent policies" queries + audit
        // trails downstream. The operator can either anonymize (GDPR
        // endpoint) or wait until the dependents are resolved.
        var policyCount = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(p => p.CustomerId == request.Id && p.DeletedAt == null, ct);
        if (policyCount > 0)
            throw new AppException("customer_has_policies",
                $"Ο πελάτης έχει {policyCount} ενεργά συμβόλαια — δεν διαγράφεται.", 400,
                title: "Δεν επιτρέπεται η διαγραφή",
                why: "Η διαγραφή θα άφηνε τα συμβόλαια χωρίς κάτοχο. Θα κρύβονταν από κάθε λίστα και ο ιστορικός κύκλος ζωής θα διακοπτόταν.",
                fix: "Διαγράψτε ή μεταφέρετε πρώτα τα συμβόλαια, ή χρησιμοποιήστε την ανωνυμοποίηση (GDPR) αντί για διαγραφή.");

        var receiptCount = await _db.Receipts.IgnoreQueryFilters()
            .CountAsync(r => r.CustomerId == request.Id && r.DeletedAt == null, ct);
        if (receiptCount > 0)
            throw new AppException("customer_has_receipts",
                $"Ο πελάτης έχει {receiptCount} αποδείξεις — δεν διαγράφεται.", 400,
                title: "Δεν επιτρέπεται η διαγραφή",
                why: "Οι αποδείξεις πρέπει να παραμείνουν συνδεδεμένες με τον πελάτη τους για λόγους λογιστικού ελέγχου.",
                fix: "Χρησιμοποιήστε την ανωνυμοποίηση (GDPR) αντί για διαγραφή αν χρειάζεται να αφαιρέσετε προσωπικά δεδομένα.");

        customer.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
