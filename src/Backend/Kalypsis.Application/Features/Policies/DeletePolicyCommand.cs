using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

/// <summary>
/// Hierarchical-delete result. Frontend uses this to render a clear blocking
/// dialog explaining what must be removed first ("πρώτα οι ζημίες, μετά οι
/// πρόσθετες πράξεις, τέλος το αρχικό συμβόλαιο").
/// </summary>
public record DeletePolicyResultDto(bool Deleted, IReadOnlyList<DeletePolicyBlocker> Blockers);
public record DeletePolicyBlocker(string Kind, int Count, string Message);

public record DeletePolicyCommand(Guid Id) : IRequest<DeletePolicyResultDto>;

public class DeletePolicyHandler : IRequestHandler<DeletePolicyCommand, DeletePolicyResultDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public DeletePolicyHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
        { _db = db; _current = current; _clock = clock; }

    public async Task<DeletePolicyResultDto> Handle(DeletePolicyCommand c, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var policy = await _db.Policies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == c.Id && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var blockers = new List<DeletePolicyBlocker>();

        // 1) Other policies that renewed from this one — must be deleted first.
        var renewals = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(p => p.RenewedFromPolicyId == policy.Id && p.DeletedAt == null, ct);
        if (renewals > 0)
            blockers.Add(new DeletePolicyBlocker("renewals", renewals,
                $"Υπάρχουν {renewals} ανανεωτήρια/πρόσθετες πράξεις που προέρχονται από αυτό το συμβόλαιο. Διαγράψτε πρώτα τα ανανεωτήρια."));

        // 2) Claims must be deleted/closed first.
        var claims = await _db.Claims.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct);
        if (claims > 0)
            blockers.Add(new DeletePolicyBlocker("claims", claims,
                $"Υπάρχουν {claims} καταγεγραμμένες ζημίες για αυτό το συμβόλαιο. Διαγράψτε ή κλείστε πρώτα τις ζημίες."));

        // 3) Commission transactions — locked once posted.
        var commissions = await _db.CommissionTransactions.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == policy.Id, ct);
        if (commissions > 0)
            blockers.Add(new DeletePolicyBlocker("commissions", commissions,
                $"Υπάρχουν {commissions} εγγραφές προμηθειών για αυτό το συμβόλαιο. Πρέπει πρώτα να ακυρωθούν από την ενότητα Προμήθειες."));

        // 4) Policy documents.
        var documents = await _db.PolicyDocuments.IgnoreQueryFilters()
            .CountAsync(x => x.PolicyId == policy.Id, ct);
        if (documents > 0)
            blockers.Add(new DeletePolicyBlocker("documents", documents,
                $"Υπάρχουν {documents} έγγραφα συνδεδεμένα με το συμβόλαιο. Διαγράψτε πρώτα τα έγγραφα από την καρτέλα του συμβολαίου."));

        if (blockers.Count > 0)
            return new DeletePolicyResultDto(false, blockers);

        policy.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return new DeletePolicyResultDto(true, Array.Empty<DeletePolicyBlocker>());
    }
}
