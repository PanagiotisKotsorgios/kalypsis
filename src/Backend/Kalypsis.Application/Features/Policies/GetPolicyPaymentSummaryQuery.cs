using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Derived payment posture for a policy: how much has been collected against
/// it, how much is left, and a single human-readable status label.
/// Computed on the fly from receipts so the schema stays unchanged.
/// </summary>
public record PolicyPaymentSummaryDto(
    Guid PolicyId, string PolicyNumber,
    decimal Premium, decimal PaidAmount, decimal RemainingAmount,
    string Status,          // "Unpaid" | "Partial" | "Paid" | "Overpaid"
    string StatusLabelGr,   // localized greek label for the chip
    DateOnly? LastReceiptDate,
    int ReceiptCount);

public record GetPolicyPaymentSummaryQuery(Guid PolicyId) : IRequest<PolicyPaymentSummaryDto>;

public class GetPolicyPaymentSummaryHandler : IRequestHandler<GetPolicyPaymentSummaryQuery, PolicyPaymentSummaryDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public GetPolicyPaymentSummaryHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<PolicyPaymentSummaryDto> Handle(GetPolicyPaymentSummaryQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var p = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == q.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var receipts = await _db.Receipts.IgnoreQueryFilters()
            .Where(r => r.PolicyId == p.Id && r.DeletedAt == null)
            .Select(r => new { r.Amount, r.ReceivedOn }).ToListAsync(ct);

        var paid = receipts.Sum(r => r.Amount);
        var remaining = p.Premium - paid;
        var lastDate = receipts.Count == 0 ? (DateOnly?)null : receipts.Max(r => r.ReceivedOn);

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
