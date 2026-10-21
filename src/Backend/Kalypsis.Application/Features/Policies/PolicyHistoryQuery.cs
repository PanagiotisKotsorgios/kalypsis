using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

public record PolicyHistoryEntry(string Id, Guid PolicyId, string Kind, DateOnly Date, string Number,
    string PolicyNumber, string? Company, DateOnly? From, DateOnly? To, string Status, decimal Amount, string Currency, string? Description);
public record PolicyHistoryDto(IReadOnlyList<PolicyHistoryEntry> Entries, bool Incomplete);
public record GetPolicyHistoryQuery(Guid PolicyId) : IRequest<PolicyHistoryDto>;

public sealed class GetPolicyHistoryHandler(IAppDbContext db, ICurrentUser current) : IRequestHandler<GetPolicyHistoryQuery, PolicyHistoryDto>
{
    public async Task<PolicyHistoryDto> Handle(GetPolicyHistoryQuery request, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        IQueryable<Policy> allowed = db.Policies.AsNoTracking().Where(p => p.TenantId == tenantId && p.DeletedAt == null);
        if (current.Role == Role.Customer)
        {
            var customerId = await db.Users.Where(u => u.Id == current.UserId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) throw AppException.Forbidden();
            allowed = allowed.Where(p => p.CustomerId == customerId);
        }
        else if (current.Role == Role.Producer)
        {
            var producerId = await db.Users.Where(u => u.Id == current.UserId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
            if (producerId is null) throw AppException.Forbidden();
            allowed = allowed.Where(p => p.ProducerId == producerId);
        }
        var selected = await allowed.Include(p => p.InsuranceCompany).FirstOrDefaultAsync(p => p.Id == request.PolicyId, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");
        var chain = new Dictionary<Guid, Policy> { [selected.Id] = selected };
        var parent = selected.RenewedFromPolicyId;
        var incomplete = false;
        for (var depth = 0; parent.HasValue; depth++)
        {
            if (depth >= 100 || chain.ContainsKey(parent.Value)) { incomplete = true; break; }
            var previous = await allowed.Include(p => p.InsuranceCompany).FirstOrDefaultAsync(p => p.Id == parent.Value, ct);
            if (previous is null) { incomplete = true; break; }
            chain[previous.Id] = previous;
            parent = previous.RenewedFromPolicyId;
        }
        var frontier = chain.Keys.ToList();
        for (var depth = 0; frontier.Count > 0; depth++)
        {
            if (depth >= 100) { incomplete = true; break; }
            var next = await allowed.Include(p => p.InsuranceCompany)
                .Where(p => p.RenewedFromPolicyId.HasValue && frontier.Contains(p.RenewedFromPolicyId.Value)).ToListAsync(ct);
            frontier = next.Where(p => !chain.ContainsKey(p.Id)).Select(p => p.Id).ToList();
            foreach (var policy in next) chain.TryAdd(policy.Id, policy);
        }
        var ids = chain.Keys.ToList();
        var entries = chain.Values.Select(p => new PolicyHistoryEntry("policy:" + p.Id, p.Id,
            p.RenewedFromPolicyId.HasValue ? "Renewal" : "Initial", p.IssuedAt ?? p.StartDate,
            p.PolicyNumber, p.PolicyNumber, p.InsuranceCompany?.Name, p.StartDate, p.EndDate,
            p.Status.ToString(), p.Premium, p.Currency, p.RenewedFromPolicyId.HasValue && chain.TryGetValue(p.RenewedFromPolicyId.Value, out var previous)
                ? "Ανανέωση του " + previous.PolicyNumber : null)).ToList();
        var endorsements = await db.PolicyEndorsements.AsNoTracking().Where(e => e.TenantId == tenantId && e.DeletedAt == null && ids.Contains(e.PolicyId)).ToListAsync(ct);
        entries.AddRange(endorsements.Select(e => new PolicyHistoryEntry("endorsement:" + e.Id, e.PolicyId, "Endorsement", e.IssuedAt,
            e.EndorsementNumber, chain[e.PolicyId].PolicyNumber, chain[e.PolicyId].InsuranceCompany?.Name,
            e.EffectiveFrom, e.EffectiveTo, e.Status.ToString(), e.PremiumDelta, e.Currency, e.Description)));
        var cancellations = await db.PolicyCancellations.AsNoTracking().Where(c => c.TenantId == tenantId && c.DeletedAt == null && ids.Contains(c.PolicyId)).ToListAsync(ct);
        entries.AddRange(cancellations.Select(c => new PolicyHistoryEntry("cancellation:" + c.Id, c.PolicyId, "Cancellation", c.RequestedAt,
            c.CancellationNumber, chain[c.PolicyId].PolicyNumber, chain[c.PolicyId].InsuranceCompany?.Name,
            c.EffectiveFrom, null, c.Status.ToString(), -c.RefundAmount, c.Currency, c.ReasonText)));
        return new PolicyHistoryDto(entries.OrderBy(e => e.Date).ThenBy(e => e.Kind == "Initial" ? 0 : 1).ThenBy(e => e.Id).ToList(), incomplete);
    }
}
