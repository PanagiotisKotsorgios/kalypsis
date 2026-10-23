using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Derived payment posture for a policy: how much has been collected against
/// it, how much is left, and a single human-readable status label.
/// Computed from actual office receipts and the direct-carrier payment
/// declaration. Direct payment clears the office balance, not its cashbook.
/// </summary>
public record PolicyPaymentSummaryDto(
    Guid PolicyId, string PolicyNumber,
    decimal Premium, decimal PaidAmount, decimal RemainingAmount,
    string Status,          // "Unpaid" | "Partial" | "Paid" | "Overpaid"
    string StatusLabelGr,   // localized greek label for the chip
    DateOnly? LastReceiptDate,
    int ReceiptCount,
    bool PaidDirectlyToCarrier = false);

public record GetPolicyPaymentSummaryQuery(Guid PolicyId) : IRequest<PolicyPaymentSummaryDto>;

public class GetPolicyPaymentSummaryHandler : IRequestHandler<GetPolicyPaymentSummaryQuery, PolicyPaymentSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetPolicyPaymentSummaryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<PolicyPaymentSummaryDto> Handle(GetPolicyPaymentSummaryQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies
            .FirstOrDefaultAsync(x => x.Id == q.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var receipts = await _db.Receipts
            .Where(r => r.PolicyId == p.Id && r.DeletedAt == null && r.Currency == p.Currency)
            .Select(r => new { r.Amount, r.ReceivedOn }).ToListAsync(ct);

        var paid = receipts.Sum(r => r.Amount);
        var remaining = p.Premium - paid;
        var lastDate = receipts.Count == 0 ? (DateOnly?)null : receipts.Max(r => r.ReceivedOn);

        // This flag records a declared direct payment, not an office cash
        // receipt. Preserve actual receipts without inventing office income.
        if (p.PaidDirectlyToCarrier)
            return new PolicyPaymentSummaryDto(p.Id, p.PolicyNumber,
                p.Premium, paid, 0m, "Paid", "Εξοφλημένο απευθείας στην ασφαλιστική",
                lastDate, receipts.Count, true);

        var (status, label) = (paid, remaining) switch
        {
            ( <= 0m,            _    ) => ("Unpaid",   "Ανεξόφλητο"),
            (   _,              <= 0m) when paid > p.Premium => ("Overpaid", "Υπερκάλυψη"),
            (   _,              <= 0m) => ("Paid",     "Εξοφλημένο"),
            _                          => ("Partial",  "Μερική εξόφληση")
        };

        return new PolicyPaymentSummaryDto(p.Id, p.PolicyNumber,
            p.Premium, paid, Math.Max(0m, remaining),
            status, label, lastDate, receipts.Count);
    }
}
