using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>Family graph, customer assets and insurance opportunities.</summary>
[ApiController]
[Route("api/customers/{customerId:guid}/family")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerFamilyController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CustomerFamilyController(IMediator mediator, IAppDbContext db, ICurrentUser current)
    { _mediator = mediator; _db = db; _current = current; }

    public record IndependentMemberBody(string FullName, string Relation, DateTime? BirthDate,
        string? Gender, string? Amka, bool IsBeneficiary, decimal? BeneficiarySharePercent,
        string? Notes, string? AfmVat, string? Occupation, string? Email,
        string? MobilePhone, bool CanReceiveMarketing);

    [HttpPost("independent-members")]
    public async Task<ActionResult<CustomerFamilyMember>> CreateIndependentMember(Guid customerId, [FromBody] IndependentMemberBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId && c.TenantId == tenantId && c.DeletedAt == null, ct))
            throw AppException.NotFound("Πελάτης");
        if (string.IsNullOrWhiteSpace(body.FullName) || body.FullName.Length > 200) return BadRequest("Συμπληρώστε ονοματεπώνυμο έως 200 χαρακτήρες.");
        var member = new CustomerFamilyMember { TenantId = tenantId, CustomerId = customerId };
        ApplyIndependentMember(member, body);
        _db.CustomerFamilyMembers.Add(member);
        await _db.SaveChangesAsync(ct);
        return Ok(member);
    }

    [HttpPut("independent-members/{memberId:guid}")]
    public async Task<ActionResult<CustomerFamilyMember>> UpdateIndependentMember(Guid customerId, Guid memberId, [FromBody] IndependentMemberBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var member = await _db.CustomerFamilyMembers.FirstOrDefaultAsync(m => m.Id == memberId && m.CustomerId == customerId && m.TenantId == tenantId && m.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Μέλος οικογένειας");
        if (string.IsNullOrWhiteSpace(body.FullName) || body.FullName.Length > 200) return BadRequest("Συμπληρώστε ονοματεπώνυμο έως 200 χαρακτήρες.");
        ApplyIndependentMember(member, body);
        member.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(member);
    }

    [HttpDelete("independent-members/{memberId:guid}")]
    public async Task<IActionResult> DeleteIndependentMember(Guid customerId, Guid memberId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var member = await _db.CustomerFamilyMembers.FirstOrDefaultAsync(m => m.Id == memberId && m.CustomerId == customerId && m.TenantId == tenantId && m.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Μέλος οικογένειας");
        member.DeletedAt = DateTime.UtcNow;
        member.UpdatedAt = member.DeletedAt;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void ApplyIndependentMember(CustomerFamilyMember member, IndependentMemberBody body)
    {
        member.FullName = body.FullName.Trim();
        member.Relation = string.IsNullOrWhiteSpace(body.Relation) ? "Other" : body.Relation.Trim();
        member.BirthDate = body.BirthDate;
        member.Gender = body.Gender?.Trim();
        member.Amka = body.Amka?.Trim();
        member.IsBeneficiary = body.IsBeneficiary;
        member.BeneficiarySharePercent = body.BeneficiarySharePercent;
        member.Notes = body.Notes?.Trim();
        member.AfmVat = body.AfmVat?.Trim();
        member.Occupation = body.Occupation?.Trim();
        member.Email = body.Email?.Trim();
        member.MobilePhone = body.MobilePhone?.Trim();
        member.CanReceiveMarketing = body.CanReceiveMarketing;
    }

    [HttpPost("assets")]
    public async Task<ActionResult<CustomerAsset>> CreateAsset(Guid customerId, [FromBody] CustomerAsset body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId && c.TenantId == tenantId && c.DeletedAt == null, ct))
            throw AppException.NotFound("Πελάτης");
        if (string.IsNullOrWhiteSpace(body.AssetKind)) return BadRequest("Επιλέξτε είδος περιουσίας.");
        if (body.FamilyMemberId is Guid familyId && !await _db.CustomerFamilyMembers.AnyAsync(m => m.Id == familyId && m.CustomerId == customerId && m.TenantId == tenantId && m.DeletedAt == null, ct))
            return BadRequest("Το μέλος οικογένειας δεν ανήκει στον πελάτη.");
        body.Id = Guid.NewGuid(); body.TenantId = tenantId; body.CustomerId = customerId;
        body.CreatedAt = DateTime.UtcNow; body.UpdatedAt = null; body.DeletedAt = null;
        _db.CustomerAssets.Add(body);
        await _db.SaveChangesAsync(ct);
        return Ok(body);
    }

    [HttpPut("assets/{assetId:guid}")]
    public async Task<ActionResult<CustomerAsset>> UpdateAsset(Guid customerId, Guid assetId, [FromBody] CustomerAsset body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var asset = await _db.CustomerAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.CustomerId == customerId && a.TenantId == tenantId && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Περιουσία πελάτη");
        if (string.IsNullOrWhiteSpace(body.AssetKind)) return BadRequest("Επιλέξτε είδος περιουσίας.");
        if (body.FamilyMemberId is Guid familyId && !await _db.CustomerFamilyMembers.AnyAsync(m => m.Id == familyId && m.CustomerId == customerId && m.TenantId == tenantId && m.DeletedAt == null, ct))
            return BadRequest("Το μέλος οικογένειας δεν ανήκει στον πελάτη.");
        foreach (var property in typeof(CustomerAsset).GetProperties().Where(p => p.CanRead && p.CanWrite &&
                     p.Name is not (nameof(CustomerAsset.Id) or nameof(CustomerAsset.TenantId) or nameof(CustomerAsset.CustomerId)
                         or nameof(CustomerAsset.AgencyOfficeScopeId) or nameof(CustomerAsset.CreatedAt)
                         or nameof(CustomerAsset.UpdatedAt) or nameof(CustomerAsset.DeletedAt))))
            property.SetValue(asset, property.GetValue(body));
        asset.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(asset);
    }

    [HttpDelete("assets/{assetId:guid}")]
    public async Task<IActionResult> DeleteAsset(Guid customerId, Guid assetId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var asset = await _db.CustomerAssets.FirstOrDefaultAsync(a => a.Id == assetId && a.CustomerId == customerId && a.TenantId == tenantId && a.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Περιουσία πελάτη");
        asset.DeletedAt = DateTime.UtcNow;
        asset.UpdatedAt = asset.DeletedAt;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<CustomerFamilyProfileDto>> Get(Guid customerId, CancellationToken ct)
        => Ok(await _mediator.Send(new GetCustomerFamilyProfileQuery(customerId), ct));

    [HttpPut("profile")]
    public async Task<ActionResult<CustomerProfileDto>> UpdateProfile(Guid customerId, [FromBody] CustomerProfileBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerProfileCommand(customerId, body), ct));

    [HttpPost("relationships")]
    public async Task<ActionResult<CustomerFamilyMemberDto>> CreateRelationship(Guid customerId, [FromBody] CustomerRelationshipBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCustomerRelationshipCommand(customerId, body), ct));

    [HttpPut("relationships/{relationshipId:guid}")]
    public async Task<ActionResult<CustomerFamilyMemberDto>> UpdateRelationship(Guid customerId, Guid relationshipId, [FromBody] UpdateCustomerRelationshipBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerRelationshipCommand(customerId, relationshipId, body), ct));

    [HttpDelete("relationships/{relationshipId:guid}")]
    public async Task<IActionResult> DeleteRelationship(Guid customerId, Guid relationshipId, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCustomerRelationshipCommand(customerId, relationshipId), ct);
        return NoContent();
    }

    [HttpPost("needs")]
    public async Task<ActionResult<CustomerNeedDto>> CreateNeed(Guid customerId, [FromBody] CustomerNeedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new CreateCustomerNeedCommand(customerId, body), ct));

    [HttpPut("needs/{needId:guid}")]
    public async Task<ActionResult<CustomerNeedDto>> UpdateNeed(Guid customerId, Guid needId, [FromBody] CustomerNeedBody body, CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateCustomerNeedCommand(customerId, needId, body), ct));

    [HttpDelete("needs/{needId:guid}")]
    public async Task<IActionResult> DeleteNeed(Guid customerId, Guid needId, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCustomerNeedCommand(customerId, needId), ct);
        return NoContent();
    }
}

/// <summary>Driver-license fields on a customer — needed for Auto policies.</summary>
[ApiController]
[Route("api/customers/{customerId:guid}/driver-license")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerDriverLicenseController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public CustomerDriverLicenseController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record DriverLicenseDto(string? Number, string? Class, DateOnly? IssueDate, DateOnly? ExpiryDate);

    [HttpGet]
    public async Task<ActionResult<DriverLicenseDto>> Get(Guid customerId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Customers
            .FirstOrDefaultAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        return Ok(new DriverLicenseDto(c.DriverLicenseNumber, c.DriverLicenseClass,
            c.DriverLicenseIssueDate, c.DriverLicenseExpiryDate));
    }

    [HttpPut]
    public async Task<ActionResult<DriverLicenseDto>> Update(Guid customerId, [FromBody] DriverLicenseDto body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = await _db.Customers
            .FirstOrDefaultAsync(x => x.Id == customerId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Πελάτης");
        c.DriverLicenseNumber = body.Number?.Trim();
        c.DriverLicenseClass = body.Class?.Trim();
        c.DriverLicenseIssueDate = body.IssueDate;
        c.DriverLicenseExpiryDate = body.ExpiryDate;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new DriverLicenseDto(c.DriverLicenseNumber, c.DriverLicenseClass,
            c.DriverLicenseIssueDate, c.DriverLicenseExpiryDate));
    }
}
