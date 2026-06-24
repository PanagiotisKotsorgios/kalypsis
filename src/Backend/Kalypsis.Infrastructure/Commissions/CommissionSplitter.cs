using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Infrastructure.Commissions;

/// <summary>
/// Computes commission splits using the agency's <see cref="OverCommissionRule"/>
/// rows. The default split when no rules exist: 40% agency, 40% writing agent,
/// 20% manager. Recipients are resolved from the policy's producer chain via
/// <see cref="ProducerHierarchyLink"/>.
/// </summary>
public class CommissionSplitter : ICommissionSplitter
{
    private readonly AppDbContext _db;
    private readonly IDateTimeProvider _clock;

    public CommissionSplitter(AppDbContext db, IDateTimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<CommissionSplitOutput> SplitAsync(CommissionSplitInput input, CancellationToken ct = default)
    {
        var policy = await _db.Policies
            .Where(p => p.Id == input.PolicyId)
            .Select(p => new { p.Id, p.TenantId, p.ProducerId, p.CreatedByUserId })
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Policy not found");

        // Create the parent CommissionTransaction record.
        var transaction = new CommissionTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = policy.TenantId,
            PolicyId = policy.Id,
            ProducerId = policy.ProducerId,
            Amount = input.CarrierCommission,
            Currency = input.Currency,
            Status = CommissionTransactionStatus.Pending,
            TransactionDate = DateOnly.FromDateTime(_clock.UtcNow)
        };
        _db.CommissionTransactions.Add(transaction);

        // Build the splits.
        var splits = await BuildSplitsAsync(policy.TenantId, policy.ProducerId, policy.CreatedByUserId,
            input.CarrierCommission, input.Currency, ct);

        foreach (var s in splits)
        {
            _db.CommissionSplits.Add(new CommissionSplit
            {
                Id = Guid.NewGuid(),
                TenantId = policy.TenantId,
                ParentTransactionId = transaction.Id,
                RecipientUserId = s.UserId,
                RecipientProducerId = s.ProducerId,
                Role = s.Role,
                Percentage = s.Percentage,
                Amount = s.Amount,
                Currency = input.Currency,
                IsClawback = false
            });
        }

        await _db.SaveChangesAsync(ct);

        return new CommissionSplitOutput(transaction.Id,
            splits.Select(x => ((Guid?)x.UserId, (Guid?)x.ProducerId, x.Role, x.Percentage, x.Amount)).ToList());
    }

    public async Task<bool> ApplyClawbackAsync(Guid policyId, decimal refundedCommission, CancellationToken ct = default)
    {
        var prior = await _db.CommissionSplits.IgnoreQueryFilters()
            .Include(s => s.ParentTransaction)
            .Where(s => s.ParentTransaction.PolicyId == policyId && !s.IsClawback)
            .ToListAsync(ct);
        if (prior.Count == 0) return false;

        // Pro-rata the clawback across the recipients of the original payment.
        var originalTotal = prior.Sum(s => s.Amount);
        if (originalTotal == 0m) return false;

        foreach (var s in prior)
        {
            var share = s.Amount / originalTotal;
            _db.CommissionSplits.Add(new CommissionSplit
            {
                Id = Guid.NewGuid(),
                TenantId = s.TenantId,
                ParentTransactionId = s.ParentTransactionId,
                RecipientUserId = s.RecipientUserId,
                RecipientProducerId = s.RecipientProducerId,
                Role = s.Role,
                Percentage = s.Percentage,
                Amount = -Math.Round(refundedCommission * share, 2),
                Currency = s.Currency,
                IsClawback = true
            });
        }
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<List<SplitRow>> BuildSplitsAsync(Guid tenantId, Guid? producerId, Guid? createdByUserId,
        decimal total, string currency, CancellationToken ct)
    {
        var rules = await _db.OverCommissionRules
            .Where(r => r.TenantId == tenantId && r.DeletedAt == null)
            .ToListAsync(ct);

        // Default fallback: 40/40/20.
        if (rules.Count == 0)
        {
            return new List<SplitRow>
            {
                new(createdByUserId, producerId, "Agent",   0.40m, Math.Round(total * 0.40m, 2)),
                new(null,             null,       "Manager", 0.20m, Math.Round(total * 0.20m, 2)),
                new(null,             null,       "Agency",  0.40m, Math.Round(total * 0.40m, 2)),
            };
        }

        // Walk rules where this policy's producer is the SubordinateProducer — those rules
        // assign overrides to their managers. The remainder goes to the writing agent.
        var rows = new List<SplitRow>();
        decimal assigned = 0m;
        if (producerId.HasValue)
        {
            foreach (var rule in rules.Where(r => r.IsActive && r.SubordinateProducerId == producerId.Value))
            {
                var slice = Math.Round(total * (rule.Percentage / 100m), 2);
                rows.Add(new SplitRow(null, rule.ManagerProducerId, $"Manager-L{rule.Level}", rule.Percentage / 100m, slice));
                assigned += slice;
            }
        }
        // Writing agent gets the rest.
        var residual = Math.Round(total - assigned, 2);
        if (residual > 0)
        {
            rows.Add(new SplitRow(createdByUserId, producerId, "Agent", residual / total, residual));
        }
        return rows;
    }

    private record SplitRow(Guid? UserId, Guid? ProducerId, string Role, decimal Percentage, decimal Amount);
}
