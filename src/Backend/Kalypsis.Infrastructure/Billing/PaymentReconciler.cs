using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Billing;

/// <summary>
/// Greedy reconciler: matches each unmatched bank line to the single best open
/// installment whose amount equals the line amount AND whose policy number
/// appears in the line reference. Ambiguous matches (multiple candidates) are
/// flagged for human review.
/// </summary>
public class PaymentReconciler : IPaymentReconciler
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;

    public PaymentReconciler(AppDbContext db, IDateTimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<ReconciliationResult> ReconcileAsync(Guid bankStatementImportId, CancellationToken ct = default)
    {
        var lines = await _db.BankStatementLines
            .Where(l => l.ImportId == bankStatementImportId
                        && l.MatchStatus == BankStatementMatchStatus.Unmatched
                        && l.DeletedAt == null)
            .ToListAsync(ct);

        if (lines.Count == 0) return new ReconciliationResult(0, 0, 0);

        var tenantId = lines[0].TenantId;
        var open = await _db.Installments
            .Include(i => i.Policy)
            .Where(i => i.TenantId == tenantId && i.DeletedAt == null
                        && (i.Status == InstallmentStatus.Scheduled
                            || i.Status == InstallmentStatus.Due
                            || i.Status == InstallmentStatus.Overdue
                            || i.Status == InstallmentStatus.PartiallyPaid))
            .ToListAsync(ct);

        int matched = 0, ambiguous = 0, unmatched = 0;

        foreach (var line in lines)
        {
            var candidates = open
                .Where(i => i.Amount - i.PaidAmount == line.Amount)
                .Where(i => line.Reference != null && line.Reference.Contains(i.Policy.PolicyNumber, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (candidates.Count == 1)
            {
                var inst = candidates[0];
                inst.PaidAmount += line.Amount;
                inst.Status = inst.PaidAmount >= inst.Amount ? InstallmentStatus.Paid : InstallmentStatus.PartiallyPaid;
                _db.InstallmentPayments.Add(new Domain.Entities.InstallmentPayment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    InstallmentId = inst.Id,
                    Amount = line.Amount,
                    PaidOn = line.TransactionDate,
                    Method = "BankTransfer",
                    Reference = line.Reference,
                    BankStatementLineId = line.Id
                });
                line.MatchStatus = BankStatementMatchStatus.Matched;
                line.MatchedInstallmentId = inst.Id;
                matched++;
            }
            else if (candidates.Count > 1)
            {
                line.MatchStatus = BankStatementMatchStatus.Ambiguous;
                ambiguous++;
            }
            else
            {
                unmatched++;
            }
        }

        // Update import counters
        var import = await _db.BankStatementImports.FirstAsync(i => i.Id == bankStatementImportId, ct);
        import.MatchedLines = matched;
        import.UnmatchedLines = lines.Count - matched;

        await _db.SaveChangesAsync(ct);
        return new ReconciliationResult(matched, ambiguous, unmatched);
    }
}
