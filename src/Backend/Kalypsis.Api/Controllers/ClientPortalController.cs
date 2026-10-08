using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Consents;
using Kalypsis.Application.Features.Gdpr;
using Kalypsis.Application.Features.Requests;
using Kalypsis.Api.Authorization;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// "ME"-scoped endpoints the mobile client portal uses for GDPR self-service.
/// Resolves the customer record off the current Customer user.
/// </summary>
[ApiController]
[Route("api/me")]
[Authorize]
[RequiresPackage(PackageCode.Crm)]
public class ClientPortalController : ControllerBase
{
    private readonly IMediator _m;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ClientPortalController(IMediator m, IAppDbContext db, ICurrentUser current)
    {
        _m = m;
        _db = db;
        _current = current;
    }

    private async Task<Guid> ResolveMyCustomerIdAsync(CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var customerId = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
        if (customerId is null) throw AppException.Forbidden("Δεν υπάρχει συνδεδεμένος πελάτης.");
        return customerId.Value;
    }

    [HttpGet("consents")]
    public async Task<ActionResult<IReadOnlyList<ConsentDto>>> MyConsents(CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new ListCustomerConsentsQuery(id), ct));
    }

    [HttpPost("consents")]
    public async Task<ActionResult<ConsentDto>> Grant([FromBody] GrantConsentBody body, CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new GrantConsentCommand(id, body, HttpContext.Connection.RemoteIpAddress?.ToString()), ct));
    }

    [HttpPost("consents/revoke")]
    public async Task<ActionResult> Revoke([FromBody] RevokeConsentBody body, CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        await _m.Send(new RevokeConsentCommand(id, body), ct);
        return NoContent();
    }

    [HttpGet("export")]
    public async Task<ActionResult<CustomerExportDto>> ExportMyData(CancellationToken ct)
    {
        var id = await ResolveMyCustomerIdAsync(ct);
        return Ok(await _m.Send(new ExportCustomerDataQuery(id), ct));
    }

    /// <summary>
    /// Single read model for the customer portal. Every collection is scoped by
    /// the authenticated customer's id and the office scope resolved by the
    /// middleware; no client-provided customer or office id is accepted.
    /// </summary>
    [HttpGet("portal")]
    public async Task<ActionResult> Portal(CancellationToken ct)
    {
        var customerId = await ResolveMyCustomerIdAsync(ct);
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();

        var customer = await _db.Customers
            .Where(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null)
            .Select(x => new
            {
                x.Id, x.CustomerNumber, x.Type, x.Status, x.FirstName, x.LastName,
                x.CompanyName, x.Email, x.Phone, x.MobilePhone, x.AltPhone,
                x.Address, x.City, x.PostalCode, x.Region, x.BirthDate, x.Occupation,
                x.VatNumber, x.Notes, x.PhotoUrl, x.PaymentDueDate
            })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Πελάτης");

        var policies = await _db.Policies
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.DeletedAt == null)
            .OrderByDescending(x => x.StartDate)
            .Select(x => new
            {
                x.Id, x.PolicyNumber, x.ApplicationNumber, x.PolicyType, x.Status,
                x.StartDate, x.EndDate, x.IssuedAt, x.Premium, x.NetPremium, x.Currency,
                x.VehicleRegistrationPlate, x.HandoverDate, x.DeliveredAt,
                InsuranceCompany = x.InsuranceCompany.Name,
                Producer = x.Producer == null ? null : x.Producer.Name,
                Covers = x.Covers.OrderBy(c => c.CoverName).Select(c => new
                {
                    c.CoverCode, c.CoverName, c.GrossPremium, c.NetPremium, c.CoverageAmount
                }).ToList(),
                Objects = x.Objects.Select(o => new { o.Id, o.ObjectKind, o.Identifier, o.Description, o.Characteristic }).ToList()
            })
            .ToListAsync(ct);

        var policyIds = policies.Select(x => x.Id).ToArray();
        var documents = await _db.PolicyDocuments
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && policyIds.Contains(x.PolicyId))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id, x.PolicyId, x.FileName, x.MimeType, x.SizeBytes, x.DocumentType, x.CreatedAt
            })
            .ToListAsync(ct);

        var greenCards = await _db.GreenCards
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && policyIds.Contains(x.PolicyId))
            .OrderByDescending(x => x.ValidTo)
            .Select(x => new
            {
                x.Id, x.PolicyId, x.CardNumber, x.Status, x.ValidFrom, x.ValidTo,
                x.HolderName, x.InsuredName, x.VehicleRegistrationPlate,
                x.VehicleMakeModel, x.Territories, x.DeliveredAt,
                PolicyNumber = x.Policy.PolicyNumber
            })
            .ToListAsync(ct);

        var claims = await _db.Claims
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null && policyIds.Contains(x.PolicyId))
            .OrderByDescending(x => x.ReportedDate)
            .Select(x => new
            {
                x.Id, x.ClaimNumber, x.PolicyId, x.IncidentDate, x.ReportedDate,
                x.Status, x.ClaimedAmount, x.ApprovedAmount, x.Description,
                PolicyNumber = x.Policy.PolicyNumber
            })
            .ToListAsync(ct);

        var requests = await _db.ServiceRequests
            .Where(x => x.TenantId == tenantId && x.CustomerId == customerId && x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .Select(x => new
            {
                x.Id, x.RequestNumber, x.Type, x.Status, x.Subject, x.Description,
                x.RelatedPolicyId, x.IncidentDate, x.IncidentLocation, x.CreatedAt, x.ResolvedAt
            })
            .ToListAsync(ct);

        var notifications = await _db.Notifications
            .Where(x => x.TenantId == tenantId && x.UserId == userId && x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt)
            .Take(50)
            .Select(x => new { x.Id, x.Title, x.Body, x.Category, x.Link, x.IsRead, x.CreatedAt })
            .ToListAsync(ct);

        var officeId = HttpContext.Items.TryGetValue(
            Kalypsis.Infrastructure.Auth.AgencyOfficeScopeMiddleware.OfficeIdItem, out var officeRaw)
            && officeRaw is Guid officeGuid
            ? officeGuid
            : (Guid?)null;
        var office = officeId is Guid oid
            ? await _db.AgencyOffices.IgnoreQueryFilters()
                .Where(x => x.Id == oid && x.TenantId == tenantId && x.DeletedAt == null)
                .Select(x => new { x.Id, x.Code, x.Name, x.City, x.Address, x.PostalCode, x.Phone, x.Email })
                .FirstOrDefaultAsync(ct)
            : null;
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .Where(x => x.Id == tenantId)
            .Select(x => new { x.Name, x.LogoUrl, x.BrandColorHex, x.ContactEmail, x.ContactPhone, x.AddressLine })
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            tenant,
            office,
            customer,
            policies,
            documents,
            greenCards,
            consents = await _m.Send(new ListCustomerConsentsQuery(customerId), ct),
            claims,
            requests,
            notifications,
            summary = new
            {
                totalPolicies = policies.Count,
                activePolicies = policies.Count(x => x.Status == PolicyStatus.Active),
                documents = documents.Count,
                openClaims = claims.Count(x => x.Status is not ClaimStatus.Closed and not ClaimStatus.Paid),
                pendingRequests = requests.Count(x => x.Status is not ServiceRequestStatus.Resolved and not ServiceRequestStatus.Closed)
            }
        });
    }

    [HttpPost("portal/requests")]
    public async Task<ActionResult<ServiceRequestDto>> CreatePortalRequest(
        [FromBody] CreateServiceRequestBody body, CancellationToken ct)
    {
        var customerId = await ResolveMyCustomerIdAsync(ct);
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (body.RelatedPolicyId is Guid policyId)
        {
            var belongsToCustomer = await _db.Policies.AnyAsync(
                x => x.Id == policyId && x.TenantId == tenantId && x.CustomerId == customerId && x.DeletedAt == null, ct);
            if (!belongsToCustomer) throw AppException.NotFound("Συμβόλαιο");
        }
        return Ok(await _m.Send(new CreateServiceRequestCommand(body with { CustomerId = null }), ct));
    }

    [HttpPost("portal/notifications/{id:guid}/read")]
    public async Task<ActionResult> MarkNotificationRead(Guid id, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var notification = await _db.Notifications.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.UserId == userId && x.DeletedAt == null, ct);
        if (notification is null) throw AppException.NotFound("Ειδοποίηση");
        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
