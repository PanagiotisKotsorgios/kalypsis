using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Enums;
using Kalypsis.Domain.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record CustomerHistoryRow(string Id, DateTime Date, string Kind, string Title, string? Reference, string? Details,
    IReadOnlyList<AuditFieldChange>? Changes = null);
public record CustomerHistoryPage(IReadOnlyList<CustomerHistoryRow> Items, int Total, int Page, int PageSize);
public record GetCustomerHistoryQuery(Guid CustomerId, string? Search, string? Kind, DateTime? From, DateTime? To, int Page = 1)
    : IRequest<CustomerHistoryPage>;

/// <summary>Customer-scoped history. Explicit tenant and office scope retain archived records.
/// Only allowlisted, non-sensitive field changes of accessible entities are exposed.</summary>
public class CustomerHistoryHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<GetCustomerHistoryQuery, CustomerHistoryPage>
{
    public async Task<CustomerHistoryPage> Handle(GetCustomerHistoryQuery request, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var all = current.Role == Role.AgencyAdmin || (current.IsPlatformLevel && !current.IsImpersonating);
        var user = all ? null : await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == current.UserId && u.TenantId == tenant, ct);
        var permissions = user is null ? [] : PermissionCatalog.ResolveEffective(user.Role, user.PermissionsJson);
        bool Can(string permission) => all || permissions.Contains(permission);
        if (!Can("customers.read") || !Can("policies.read")) throw AppException.Forbidden();
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(
            c => c.Id == request.CustomerId && c.TenantId == tenant && c.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        var policies = await HistoryRows(db.Policies, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
        var policyIds = policies.Select(p => p.Id).ToArray();
        var endorsements = await HistoryRows(db.PolicyEndorsements, tenant).Where(p => policyIds.Contains(p.PolicyId)).ToListAsync(ct);
        var cancellations = await HistoryRows(db.PolicyCancellations, tenant).Where(p => policyIds.Contains(p.PolicyId)).ToListAsync(ct);
        var communications = await HistoryRows(db.CommunicationLogs, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
        var contacts = await HistoryRows(db.CustomerContacts, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
        var subjects = new Dictionary<string, (string Entity, string Kind, string? Reference)>
        {
            [customer.Id.ToString()] = ("Customer", "customer", customer.CustomerNumber)
        };
        foreach (var p in policies) subjects[p.Id.ToString()] = ("Policy", "policy", p.PolicyNumber);
        foreach (var p in endorsements) subjects[p.Id.ToString()] = ("PolicyEndorsement", "endorsement", p.EndorsementNumber);
        foreach (var p in cancellations) subjects[p.Id.ToString()] = ("PolicyCancellation", "cancellation", p.CancellationNumber);
        foreach (var p in communications) subjects[p.Id.ToString()] = ("CommunicationLog", "communication", p.Subject);
        foreach (var p in contacts) subjects[p.Id.ToString()] = ("CustomerContact", "customer", $"{p.FirstName} {p.LastName}");
        var additional = new List<CustomerHistoryRow>();
        additional.AddRange(contacts.Select(p => new CustomerHistoryRow("contact-" + p.Id, p.CreatedAt, "customer", "Καταχώρηση επαφής", $"{p.FirstName} {p.LastName}", p.Role)));
        var consents = await HistoryRows(db.ConsentRecords, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
        foreach (var p in consents)
        {
            subjects[p.Id.ToString()] = ("ConsentRecord", "consent", "Συγκατάθεση πελάτη");
            additional.Add(new("consent-" + p.Id, p.GrantedAt, "consent", p.Granted ? "Χορήγηση συγκατάθεσης" : "Καταγραφή άρνησης συγκατάθεσης", null, p.Notes));
            if (p.RevokedAt is DateTime revoked) additional.Add(new("revoke-" + p.Id, revoked, "consent", "Ανάκληση συγκατάθεσης", null, p.Notes));
        }
        if (Can("documents.read"))
        {
            var documents = await HistoryRows(db.PolicyDocuments, tenant).Where(p => policyIds.Contains(p.PolicyId)).ToListAsync(ct);
            foreach (var p in documents)
            {
                subjects[p.Id.ToString()] = ("PolicyDocument", "document", p.FileName);
                additional.Add(new("document-" + p.Id, p.CreatedAt, "document", "Προσθήκη εγγράφου συμβολαίου", p.FileName, p.Notes));
            }
        }
        if (Can("tasks.read"))
        {
            var tasks = await HistoryRows(db.AgencyTasks, tenant).Where(p => p.CustomerId == customer.Id || (p.PolicyId.HasValue && policyIds.Contains(p.PolicyId.Value))).ToListAsync(ct);
            foreach (var p in tasks)
            {
                subjects[p.Id.ToString()] = ("AgencyTask", "task", p.Title);
                additional.Add(new("task-" + p.Id, p.CreatedAt, "task", "Καταχώρηση εργασίας", p.Title, p.Description));
            }
        }
        if (Can("claims.read"))
        {
            var claims = await HistoryRows(db.Claims, tenant).Where(p => policyIds.Contains(p.PolicyId)).ToListAsync(ct);
            foreach (var p in claims)
            {
                subjects[p.Id.ToString()] = ("Claim", "claim", p.ClaimNumber);
                additional.Add(new("claim-" + p.Id, p.CreatedAt, "claim", "Καταχώρηση ζημιάς", p.ClaimNumber, p.Description));
            }
        }
        if (Can("receipts.read"))
        {
            var receipts = await HistoryRows(db.Receipts, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
            foreach (var p in receipts)
            {
                subjects[p.Id.ToString()] = ("Receipt", "receipt", p.Number);
                additional.Add(new("receipt-" + p.Id, p.CreatedAt, "receipt", "Καταχώρηση είσπραξης", p.Number, p.Notes));
            }
        }
        if (Can("financials.read"))
        {
            var credits = await HistoryRows(db.CreditNotes, tenant).Where(p => p.CustomerId == customer.Id).ToListAsync(ct);
            foreach (var p in credits)
            {
                subjects[p.Id.ToString()] = ("CreditNote", "credit", p.CreditNoteNumber);
                additional.Add(new("credit-" + p.Id, p.CreatedAt, "credit", "Καταχώρηση πιστωτικού", p.CreditNoteNumber, p.Description));
            }
        }
        var ids = subjects.Keys.ToArray();
        var logs = await db.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenant && ids.Contains(a.EntityId))
            .Select(a => new { a.Id, a.CreatedAt, a.EntityId, a.EntityName, a.Action, a.OldValues, a.NewValues }).ToListAsync(ct);
        var rows = new List<CustomerHistoryRow>();
        rows.AddRange(additional);
        rows.Add(new("customer-" + customer.Id, customer.CreatedAt, "customer", "Καταχώρηση πελάτη", customer.CustomerNumber, null));
        rows.AddRange(policies.Select(p => new CustomerHistoryRow("policy-" + p.Id, p.CreatedAt, "policy", "Καταχώρηση συμβολαίου", p.PolicyNumber, null)));
        rows.AddRange(endorsements.Select(p => new CustomerHistoryRow("endorsement-" + p.Id, p.CreatedAt, "endorsement", "Πρόσθετη πράξη", p.EndorsementNumber, p.Description)));
        rows.AddRange(cancellations.Select(p => new CustomerHistoryRow("cancellation-" + p.Id, p.CreatedAt, "cancellation", "Αίτημα ακύρωσης", p.CancellationNumber, p.ReasonText)));
        rows.AddRange(communications.Select(p => new CustomerHistoryRow("communication-" + p.Id, p.OccurredAt, "communication", p.Subject, p.RelatedPolicyNumber, p.Body)));
        foreach (var log in logs)
        {
            var subject = subjects[log.EntityId];
            if (subject.Entity != log.EntityName) continue;
            var action = log.Action switch
            {
                "Added" or "Created" or "Create" => "Δημιουργία",
                "Modified" or "Updated" or "Update" => "Ενημέρωση",
                "Deleted" or "Delete" => "Διαγραφή",
                _ => "Καταγεγραμμένη ενέργεια"
            };
            // Creation snapshots already appear above; audit rows add changes rather than duplicate them.
            if (action == "Δημιουργία") continue;
            var changes = AuditChangeReader.Read(log.OldValues, log.NewValues, knownFieldsOnly: true, entityName: log.EntityName);
            rows.Add(new("audit-" + log.Id, log.CreatedAt, subject.Kind, action, subject.Reference,
                changes.Count == 0 ? null : "Πεδία αλλαγής: " + string.Join(", ", changes.Select(c => c.Label)), changes));
        }
        IEnumerable<CustomerHistoryRow> filtered = rows;
        if (request.From is DateTime from) filtered = filtered.Where(r => r.Date >= from);
        if (request.To is DateTime to) filtered = filtered.Where(r => r.Date <= to);
        if (!string.IsNullOrWhiteSpace(request.Kind)) filtered = filtered.Where(r => r.Kind == request.Kind);
        if (!string.IsNullOrWhiteSpace(request.Search))
            filtered = filtered.Where(r => $"{r.Title} {r.Reference} {r.Details} {string.Join(" ", r.Changes?.Select(c => $"{c.Before} {c.After}") ?? [])}"
                .Contains(request.Search.Trim(), StringComparison.OrdinalIgnoreCase));
        var ordered = filtered.OrderByDescending(r => r.Date).ThenBy(r => r.Id).ToArray();
        const int size = 30;
        var page = Math.Clamp(request.Page, 1, Math.Max(1, (ordered.Length + size - 1) / size));
        return new(ordered.Skip((page - 1) * size).Take(size).ToArray(), ordered.Length, page, size);
    }

    private IQueryable<T> HistoryRows<T>(DbSet<T> set, Guid tenant) where T : TenantEntity
    {
        // History must survive soft deletion. Reapply exactly the office access
        // predicate used by AppDbContext before including archived children.
        var office = current.AgencyOfficeId;
        var bypassOffice = office is null || (current.IsPlatformLevel && !current.IsImpersonating);
        var headquarters = current.AgencyOfficeIsHeadquarters;
        return set.IgnoreQueryFilters().AsNoTracking().Where(p => p.TenantId == tenant &&
            (bypassOffice || p.AgencyOfficeScopeId == office || (headquarters && p.AgencyOfficeScopeId == null)));
    }

}
