using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Gdpr;

public record CustomerExportDto(
    object Customer,
    object Policies,
    object Documents,
    object Claims,
    object Consents,
    object Communications,
    object ServiceRequests,
    DateTime ExportedAt);

/* ============= Customer data export (Right to Access / Portability) ============= */

public record ExportCustomerDataQuery(Guid CustomerId) : IRequest<CustomerExportDto>;

public class ExportCustomerDataHandler : IRequestHandler<ExportCustomerDataQuery, CustomerExportDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public ExportCustomerDataHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<CustomerExportDto> Handle(ExportCustomerDataQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // If a Customer is logged in we lock the export to their own record.
        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var theirCustomer = await _db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (theirCustomer is null || theirCustomer.Value != request.CustomerId)
                throw AppException.Forbidden();
        }

        var customer = await _db.Customers
            .Where(c => c.TenantId == tenantId && c.Id == request.CustomerId)
            .Select(c => new
            {
                c.Id, c.CustomerNumber, c.Type, c.Status, c.FirstName, c.LastName, c.CompanyName,
                c.VatNumber, c.TaxOffice, c.GemiNumber, c.LegalForm,
                c.Email, c.Phone, c.AltPhone, c.MobilePhone,
                c.Amka, c.IdNumber, c.PassportNumber,
                c.Address, c.City, c.PostalCode, c.Region,
                c.BirthDate, c.Gender, c.MaritalStatus, c.Occupation, c.Employer,
                c.Source, c.TagsJson, c.Notes, c.CreatedAt
            })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Πελάτης");

        var policies = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.CustomerId == request.CustomerId)
            .Select(p => new {
                p.Id, p.PolicyNumber, p.PolicyType, p.Status, p.StartDate, p.EndDate,
                p.Premium, p.Currency, p.PaymentFrequency, p.PremiumIncludesVat, p.SpecsJson,
                Company = p.InsuranceCompany.Name
            })
            .ToListAsync(ct);

        var documents = await _db.PolicyDocuments
            .Where(d => d.TenantId == tenantId && d.Policy.CustomerId == request.CustomerId)
            .Select(d => new { d.Id, d.FileName, d.DocumentType, d.SizeBytes, d.CreatedAt })
            .ToListAsync(ct);

        var claims = await _db.Claims
            .Where(cl => cl.TenantId == tenantId && cl.Policy.CustomerId == request.CustomerId)
            .Select(cl => new { cl.Id, cl.ClaimNumber, cl.Status, cl.IncidentDate, cl.ReportedDate, cl.ClaimedAmount, cl.ApprovedAmount })
            .ToListAsync(ct);

        var consents = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId)
            .Select(c => new { c.Id, c.Type, c.Granted, c.GrantedAt, c.RevokedAt, c.Method, c.Version })
            .ToListAsync(ct);

        var comms = await _db.CommunicationLogs
            .Where(c => c.TenantId == tenantId && c.CustomerId == request.CustomerId)
            .Select(c => new { c.Id, c.Kind, c.Direction, c.OccurredAt, c.Subject, c.Body })
            .ToListAsync(ct);

        var reqs = await _db.ServiceRequests
            .Where(s => s.TenantId == tenantId && s.CustomerId == request.CustomerId)
            .Select(s => new { s.Id, s.RequestNumber, s.Type, s.Status, s.Subject, s.Description, s.CreatedAt, s.ResolvedAt })
            .ToListAsync(ct);

        return new CustomerExportDto(customer, policies, documents, claims, consents, comms, reqs, _clock.UtcNow);
    }
}

/* ============= Anonymize (Right to Erasure) ============= */

public record AnonymizeCustomerCommand(Guid CustomerId) : IRequest<Unit>;

public class AnonymizeCustomerHandler : IRequestHandler<AnonymizeCustomerCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public AnonymizeCustomerHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public async Task<Unit> Handle(AnonymizeCustomerCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var customer = await _db.Customers
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id == request.CustomerId, ct)
            ?? throw AppException.NotFound("Πελάτης");

        // Business constraint: do not anonymize if active policies exist (legal/tax reasons).
        var hasActive = await _db.Policies
            .AnyAsync(p => p.TenantId == tenantId && p.CustomerId == customer.Id
                           && p.Status == Domain.Enums.PolicyStatus.Active && p.DeletedAt == null, ct);
        if (hasActive)
            throw AppException.Conflict("Δεν επιτρέπεται ανωνυμοποίηση όσο υπάρχουν ενεργά συμβόλαια.");

        var anonId = Guid.NewGuid().ToString("N")[..8];
        customer.FirstName = $"ANON-{anonId}";
        customer.LastName = "Anonymized";
        customer.CompanyName = null;
        customer.Email = $"anon-{anonId}@example.invalid";
        customer.Phone = null;
        customer.AltPhone = null;
        customer.MobilePhone = null;
        customer.Amka = null;
        customer.IdNumber = null;
        customer.PassportNumber = null;
        customer.Address = null;
        customer.City = null;
        customer.PostalCode = null;
        customer.Region = null;
        customer.BirthDate = null;
        customer.Gender = null;
        customer.MaritalStatus = null;
        customer.Occupation = null;
        customer.Employer = null;
        customer.Notes = null;
        customer.PhotoUrl = null;
        customer.AnonymizedAt = _clock.UtcNow;
        customer.Status = CustomerStatus.Blocked;

        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
