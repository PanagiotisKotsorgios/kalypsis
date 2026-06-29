using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

// ============================================================================
// Two-way producer ↔ customer mapping derived from Policy.ProducerId.
// One customer can have policies through several producers; the DTOs aggregate
// across the customer (or the producer) so the UI shows one row per pair.
// ============================================================================

public record ProducerCustomerLineDto(
    Guid CustomerId,
    string CustomerNumber,
    string CustomerDisplay,
    string? Email,
    string? Phone,
    string? City,
    int PolicyCount,
    decimal TotalPremium,
    string Currency,
    DateOnly? LatestPolicyStart);

public record CustomerProducerLineDto(
    Guid ProducerId,
    string ProducerCode,
    string ProducerName,
    int PolicyCount,
    decimal TotalPremium,
    string Currency,
    DateOnly? LatestPolicyStart);

// ===== Customers owned by a given producer ==================================

public record ListProducerCustomersQuery(Guid ProducerId) : IRequest<IReadOnlyList<ProducerCustomerLineDto>>;

public class ListProducerCustomersHandler : IRequestHandler<ListProducerCustomersQuery, IReadOnlyList<ProducerCustomerLineDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListProducerCustomersHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<ProducerCustomerLineDto>> Handle(ListProducerCustomersQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.Policies
            .Include(p => p.Customer)
            .Where(p => p.TenantId == tenantId
                        && p.ProducerId == q.ProducerId
                        && p.DeletedAt == null
                        && p.Customer != null
                        && p.Customer.DeletedAt == null)
            .ToListAsync(ct);

        return rows
            .GroupBy(p => p.Customer!)
            .Select(g =>
            {
                var c = g.Key;
                var display = c.Type == CustomerType.Company
                    ? (c.CompanyName ?? c.CustomerNumber)
                    : $"{c.FirstName} {c.LastName}".Trim();
                return new ProducerCustomerLineDto(
                    c.Id,
                    c.CustomerNumber,
                    string.IsNullOrWhiteSpace(display) ? c.CustomerNumber : display,
                    c.Email,
                    c.Phone,
                    c.City,
                    g.Count(),
                    g.Sum(p => p.Premium),
                    g.Select(p => p.Currency).FirstOrDefault() ?? "EUR",
                    g.Max(p => (DateOnly?)p.StartDate));
            })
            .OrderByDescending(x => x.LatestPolicyStart)
            .ToList();
    }
}

// ===== Producers that have policies for a given customer ====================

public record ListCustomerProducersQuery(Guid CustomerId) : IRequest<IReadOnlyList<CustomerProducerLineDto>>;

public class ListCustomerProducersHandler : IRequestHandler<ListCustomerProducersQuery, IReadOnlyList<CustomerProducerLineDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListCustomerProducersHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<CustomerProducerLineDto>> Handle(ListCustomerProducersQuery q, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.Policies
            .Include(p => p.Producer)
            .Where(p => p.TenantId == tenantId
                        && p.CustomerId == q.CustomerId
                        && p.DeletedAt == null
                        && p.Producer != null
                        && p.Producer.DeletedAt == null)
            .ToListAsync(ct);

        return rows
            .GroupBy(p => p.Producer!)
            .Select(g => new CustomerProducerLineDto(
                g.Key.Id,
                g.Key.Code,
                g.Key.Name,
                g.Count(),
                g.Sum(p => p.Premium),
                g.Select(p => p.Currency).FirstOrDefault() ?? "EUR",
                g.Max(p => (DateOnly?)p.StartDate)))
            .OrderByDescending(x => x.LatestPolicyStart)
            .ToList();
    }
}
