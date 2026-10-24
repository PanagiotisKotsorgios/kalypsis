using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
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
        var policy = await _db.Policies
            .FirstOrDefaultAsync(p => p.Id == c.Id && p.TenantId == tenantId && p.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συμβόλαιο");

        var blockers = new List<DeletePolicyBlocker>();
        var ownership = await _db.VehicleOwnershipRegisters.CountAsync(r => r.TenantId == tenantId && r.AnchorPolicyId == policy.Id, ct);
        if (ownership > 0) blockers.Add(new DeletePolicyBlocker("vehicle_ownership", ownership, "Το συμβόλαιο συνδέεται με μητρώο ιδιοκτησίας και ιστορικό μεταβιβάσεων οχήματος."));

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
                $"Υπάρχουν {claims} καταγεγραμμένες ζημίες για αυτό το συμβόλαιο. Διαγράψτε πρώτα το σχετικό ιστορικό ζημιών."));

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

        void Add(string kind, int count, string label)
        {
            if (count > 0)
                blockers.Add(new DeletePolicyBlocker(kind, count,
                    $"Υπάρχουν {count} συνδεδεμένες εγγραφές {label}. Διαγράψτε πρώτα αυτό το ιστορικό και επαναλάβετε τη διαγραφή."));
        }

        // Every operational/history relationship is a hard blocker, including
        // completed workflows. A completed cancellation or endorsement is
        // still accounting/audit history and must never be orphaned.
        Add("cancellations", await _db.PolicyCancellations.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "ακυρώσεων");
        Add("endorsements", await _db.PolicyEndorsements.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "πρόσθετων πράξεων");
        Add("receipts", await _db.Receipts.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "εισπράξεων");
        Add("payments", await _db.Payments.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "πληρωμών");
        Add("financial-movements", await _db.FinancialMovements.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "οικονομικών κινήσεων");
        Add("general-financial-entries", await _db.GeneralFinancialEntries.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "γενικών οικονομικών εγγραφών");
        Add("objects", await _db.PolicyObjects.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "ασφαλισμένων αντικειμένων/οχημάτων");
        Add("covers", await _db.PolicyCovers.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "καλύψεων");
        Add("installments", await _db.PolicyInstallments.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "δόσεων συμβολαίου");
        Add("billing-installments", await _db.Installments.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "οικονομικών δόσεων");
        Add("green-cards", await _db.GreenCards.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "πράσινων καρτών");
        Add("credit-notes", await _db.CreditNotes.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "πιστωτικών");
        Add("deliveries", await _db.DeliveryRecords.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "παραδόσεων");
        Add("dias", await _db.DiasCodes.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "κωδικών πληρωμής");
        Add("commission-splits", await _db.PolicyCommissionSplits.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "κατανομών προμηθειών");
        Add("cover-adjustments", await _db.PolicyCoverAdjustments.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "ιστορικού προμηθειών καλύψεων");
        Add("payment-notices", await _db.PaymentNotices.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "ειδοποιητηρίων");
        Add("carrier-orders", await _db.CarrierOrders.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "παραγγελιών προς εταιρεία");
        Add("online-payments", await _db.OnlinePaymentSessions.CountAsync(x => x.PolicyId == policy.Id && x.DeletedAt == null, ct), "online πληρωμών");
        Add("communications", await _db.CommunicationLogs.CountAsync(x => x.RelatedPolicyId == policy.Id && x.DeletedAt == null, ct), "επικοινωνιών");
        Add("service-requests", await _db.ServiceRequests.CountAsync(x => x.RelatedPolicyId == policy.Id && x.DeletedAt == null, ct), "αιτημάτων εξυπηρέτησης");
        Add("applications", await _db.PolicyApplications.CountAsync(x => x.IssuedPolicyId == policy.Id && x.DeletedAt == null, ct), "αιτήσεων έκδοσης");

        if (blockers.Count > 0)
            return new DeletePolicyResultDto(false, blockers);

        policy.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return new DeletePolicyResultDto(true, Array.Empty<DeletePolicyBlocker>());
    }
}
