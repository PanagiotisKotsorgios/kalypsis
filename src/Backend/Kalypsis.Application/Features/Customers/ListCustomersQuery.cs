using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Customers;

public record ListCustomersQuery(
    string? Search,
    string? Occupation = null,
    string? NeedKind = null,
    bool? OnlyUninsuredNeeds = null,
    CustomerStatus? Status = null,
    int? Limit = null) : IRequest<IReadOnlyList<CustomerDto>>;

public class ListCustomersQueryHandler : IRequestHandler<ListCustomersQuery, IReadOnlyList<CustomerDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ListCustomersQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<CustomerDto>> Handle(ListCustomersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId
            ?? throw AppException.Forbidden();

        var q = _db.Customers
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null);

        if (_currentUser.Role == Role.Producer)
        {
            var userId = _currentUser.UserId ?? throw AppException.Unauthorized();
            var producerId = await _db.Users
                .Where(u => u.Id == userId).Select(u => u.ProducerId).FirstOrDefaultAsync(cancellationToken);
            if (producerId is null) return Array.Empty<CustomerDto>();
            var customerIds = _db.Policies
                .Where(p => p.ProducerId == producerId && p.DeletedAt == null)
                .Select(p => p.CustomerId).Distinct();
            q = q.Where(c => customerIds.Contains(c.Id));
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = $"%{request.Search.Trim()}%";
            q = q.Where(c =>
                EF.Functions.Like(c.FirstName ?? "", s) ||
                EF.Functions.Like(c.LastName ?? "", s) ||
                EF.Functions.Like(c.CompanyName ?? "", s) ||
                EF.Functions.Like(c.Email ?? "", s) ||
                EF.Functions.Like(c.Phone ?? "", s) ||
                EF.Functions.Like(c.MobilePhone ?? "", s) ||
                EF.Functions.Like(c.AltPhone ?? "", s) ||
                EF.Functions.Like(c.VatNumber ?? "", s) ||
                EF.Functions.Like(c.CustomerNumber, s));
        }

        if (!string.IsNullOrWhiteSpace(request.Occupation))
        {
            var occupation = $"%{request.Occupation.Trim()}%";
            q = q.Where(c => EF.Functions.Like(c.Occupation ?? "", occupation)
                || EF.Functions.Like(c.Employer ?? "", occupation));
        }

        if (!string.IsNullOrWhiteSpace(request.NeedKind))
        {
            var matchingNeedCustomers = _db.CustomerInsuranceNeeds
                .Where(n => n.TenantId == tenantId && n.DeletedAt == null && n.Kind == request.NeedKind && n.HasAsset);
            if (request.OnlyUninsuredNeeds == true)
                matchingNeedCustomers = matchingNeedCustomers.Where(n => !n.IsInsured);
            q = q.Where(c => matchingNeedCustomers.Select(n => n.CustomerId).Contains(c.Id));
        }

        if (request.Status.HasValue)
            q = q.Where(c => c.Status == request.Status.Value);

        var take = Math.Clamp(request.Limit ?? 200, 1, 5000);
        var rows = await q
            .OrderByDescending(c => c.CreatedAt)
            .Take(take)
            .Select(c => new CustomerDto(
                c.Id, c.CustomerNumber, c.Type, c.Status, c.FirstName, c.LastName,
                c.CompanyName, c.VatNumber, c.Email, c.Phone, c.City, c.Notes, c.CreatedAt,
                _db.Users.Any(u => u.CustomerId == c.Id && u.DeletedAt == null), c.PaymentDueDate)
            {
                // The list only returns the additional values required by its filters.
                // Sensitive profile-only identifiers (AMKA, identity/passport, licence)
                // remain confined to the single-customer endpoint.
                BirthDate = c.BirthDate,
                NameDayDate = c.NameDayDate,
                AltPhone = c.AltPhone,
                MobilePhone = c.MobilePhone,
                TagsJson = c.TagsJson,
                UpdatedAt = c.UpdatedAt,
                ChildrenCount = _db.CustomerRelationships.Count(r => r.CustomerId == c.Id
                    && r.RelationshipType == Kalypsis.Domain.Entities.CustomerRelationshipType.Child
                    && r.DeletedAt == null),
                HasPolicy = _db.Policies.Any(p => p.CustomerId == c.Id && p.DeletedAt == null),
                HasGdprConsent = _db.ConsentRecords.Any(x => x.CustomerId == c.Id
                    && x.Type == ConsentType.PrivacyNotice && x.Granted && x.RevokedAt == null
                    && x.DeletedAt == null),
                HasMarketingConsent = _db.ConsentRecords.Any(x => x.CustomerId == c.Id
                    && (x.Type == ConsentType.EmailMarketing || x.Type == ConsentType.SmsMarketing
                        || x.Type == ConsentType.PhoneMarketing || x.Type == ConsentType.ViberMarketing)
                    && x.Granted && x.RevokedAt == null && x.DeletedAt == null),
                HasCommunicationConsent = _db.ConsentRecords.Any(x => x.CustomerId == c.Id
                    && (x.Type == ConsentType.EmailMarketing || x.Type == ConsentType.SmsMarketing
                        || x.Type == ConsentType.PhoneMarketing || x.Type == ConsentType.ViberMarketing)
                    && x.Granted && x.RevokedAt == null && x.DeletedAt == null),
                HasNeedsForm = _db.ConsentRecords.Any(x => x.CustomerId == c.Id
                    && x.Type == ConsentType.IddDemandsAndNeeds && x.Granted && x.RevokedAt == null
                    && x.DeletedAt == null)
                    || _db.CustomerFormSignings.Any(x => x.CustomerId == c.Id
                        && x.FormCode.Contains("needs") && x.DeletedAt == null)
            })
            .ToListAsync(cancellationToken);

        if (rows.Count == 0) return rows;

        var customerIdsForRows = rows.Select(x => x.Id).ToArray();
        var producerLinks = await _db.Policies
            .Where(p => customerIdsForRows.Contains(p.CustomerId) && p.DeletedAt == null
                && p.ProducerId != null && p.Producer != null && p.Producer.DeletedAt == null)
            .Select(p => new { p.CustomerId, ProducerId = p.ProducerId!.Value, p.Producer!.Name })
            .Distinct()
            .ToListAsync(cancellationToken);
        var producerLinksByCustomer = producerLinks
            .GroupBy(x => x.CustomerId)
            .ToDictionary(
                g => g.Key,
                g => g.GroupBy(x => x.ProducerId)
                    .Select(x => new { Id = x.Key, Name = x.Select(link => link.Name).First() })
                    .OrderBy(x => x.Name)
                    .ToArray());

        return rows.Select(row => producerLinksByCustomer.TryGetValue(row.Id, out var producers)
            ? row with
            {
                ProducerIds = producers.Select(x => x.Id).ToArray(),
                ProducerNames = producers.Select(x => x.Name).ToArray()
            }
            : row with { ProducerIds = Array.Empty<Guid>(), ProducerNames = Array.Empty<string>() })
            .ToArray();
    }
}
