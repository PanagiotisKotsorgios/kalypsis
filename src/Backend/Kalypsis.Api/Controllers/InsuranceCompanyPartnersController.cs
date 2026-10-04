using Kalypsis.Application.Common;
using Kalypsis.Application.Abstractions;
using Kalypsis.Api.Authorization;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Rich, office-owned relationships for broker/agency companies.  These are
/// deliberately not the same as the carrier ParentCompanyId hierarchy used
/// by parametric imports.
/// </summary>
[ApiController]
[Route("api/insurance-companies/{companyId:guid}/partners")]
[Authorize(Policy = "AgencyStaff")]
public sealed class InsuranceCompanyPartnersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public InsuranceCompanyPartnersController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record PartnerDto(Guid Id, Guid PartnerInsuranceCompanyId, string PartnerName,
        string PartnerCode, bool PartnerIsBroker, string RelationshipType, string? CooperationCode,
        string? ContactName, string? ContactEmail, string? ContactPhone, string? Notes,
        bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);

    public record PartnerBody(Guid PartnerInsuranceCompanyId, string? RelationshipType,
        string? CooperationCode, string? ContactName, string? ContactEmail,
        string? ContactPhone, string? Notes, bool IsActive = true);

    private Guid TenantId => _current.TenantId ?? throw AppException.Forbidden();

    private async Task<InsuranceCompany> Company(Guid companyId, CancellationToken ct)
        => await _db.InsuranceCompanies.IgnoreQueryFilters()
               .FirstOrDefaultAsync(c => c.Id == companyId && c.DeletedAt == null
                   && (c.TenantId == null || c.TenantId == TenantId), ct)
           ?? throw AppException.NotFound("Εταιρεία ή πρακτορείο");

    private async Task<InsuranceCompany> PartnerCompany(Guid partnerId, CancellationToken ct)
        => await _db.InsuranceCompanies.IgnoreQueryFilters()
               .FirstOrDefaultAsync(c => c.Id == partnerId && c.DeletedAt == null
                   && (c.TenantId == null || c.TenantId == TenantId), ct)
           ?? throw AppException.Validation("Η συνεργαζόμενη εταιρεία δεν βρέθηκε ή δεν είναι διαθέσιμη στο γραφείο.");

    [HttpGet]
    [RequirePermission("documents.read")]
    public async Task<ActionResult<IReadOnlyList<PartnerDto>>> List(Guid companyId, CancellationToken ct)
    {
        var company = await Company(companyId, ct);
        if (!company.IsBroker || company.TenantId is null)
            return Ok(Array.Empty<PartnerDto>());

        var rows = await _db.InsuranceCompanyPartners
            .Where(row => row.InsuranceCompanyId == companyId)
            .Join(_db.InsuranceCompanies.IgnoreQueryFilters().Where(c => c.DeletedAt == null
                    && (c.TenantId == null || c.TenantId == TenantId)),
                row => row.PartnerInsuranceCompanyId, target => target.Id,
                (row, target) => new PartnerDto(row.Id, target.Id, target.Name, target.Code,
                    target.IsBroker, row.RelationshipType, row.CooperationCode, row.ContactName,
                    row.ContactEmail, row.ContactPhone, row.Notes, row.IsActive,
                    row.CreatedAt, row.UpdatedAt))
            .OrderBy(row => row.PartnerName)
            .ThenBy(row => row.RelationshipType)
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    [RequirePermission("documents.write")]
    public async Task<ActionResult<PartnerDto>> Create(Guid companyId, [FromBody] PartnerBody body, CancellationToken ct)
    {
        var company = await Company(companyId, ct);
        if (!company.IsBroker)
            throw AppException.Validation("Οι συνεργασίες ασφαλιστικών καταχωρούνται μόνο σε πρακτορείο.");
        EnsureOfficeOwned(company);
        if (body.PartnerInsuranceCompanyId == companyId)
            throw AppException.Validation("Το πρακτορείο δεν μπορεί να συνδεθεί με τον εαυτό του.");
        var target = await PartnerCompany(body.PartnerInsuranceCompanyId, ct);

        var existing = await _db.InsuranceCompanyPartners.IgnoreQueryFilters()
            .FirstOrDefaultAsync(row => row.TenantId == TenantId
                && row.InsuranceCompanyId == companyId
                && row.PartnerInsuranceCompanyId == target.Id, ct);
        var row = existing ?? new InsuranceCompanyPartner
        {
            Id = Guid.NewGuid(), TenantId = TenantId, InsuranceCompanyId = companyId,
            PartnerInsuranceCompanyId = target.Id, CreatedAt = _clock.UtcNow
        };
        row.RelationshipType = Normalize(body.RelationshipType, "Συνεργαζόμενη ασφαλιστική");
        row.CooperationCode = Clean(body.CooperationCode);
        row.ContactName = Clean(body.ContactName);
        row.ContactEmail = Clean(body.ContactEmail);
        row.ContactPhone = Clean(body.ContactPhone);
        row.Notes = Clean(body.Notes);
        row.IsActive = body.IsActive;
        row.DeletedAt = null;
        row.UpdatedAt = existing is null ? null : _clock.UtcNow;
        if (existing is null) _db.InsuranceCompanyPartners.Add(row);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row, target));
    }

    [HttpPut("{partnerId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> Update(Guid companyId, Guid partnerId, [FromBody] PartnerBody body, CancellationToken ct)
    {
        var company = await Company(companyId, ct);
        if (!company.IsBroker)
            throw AppException.Validation("Οι συνεργασίες ασφαλιστικών καταχωρούνται μόνο σε πρακτορείο.");
        EnsureOfficeOwned(company);
        var row = await _db.InsuranceCompanyPartners.FirstOrDefaultAsync(item => item.Id == partnerId
            && item.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Συνεργασία πρακτορείου");
        if (body.PartnerInsuranceCompanyId == companyId)
            throw AppException.Validation("Το πρακτορείο δεν μπορεί να συνδεθεί με τον εαυτό του.");
        var target = await PartnerCompany(body.PartnerInsuranceCompanyId, ct);
        var duplicate = await _db.InsuranceCompanyPartners.AnyAsync(item => item.Id != partnerId
            && item.InsuranceCompanyId == companyId
            && item.PartnerInsuranceCompanyId == target.Id, ct);
        if (duplicate)
            throw AppException.Validation("Η εταιρεία υπάρχει ήδη στη λίστα συνεργασιών του πρακτορείου.");
        row.PartnerInsuranceCompanyId = target.Id;
        row.RelationshipType = Normalize(body.RelationshipType, "Συνεργαζόμενη ασφαλιστική");
        row.CooperationCode = Clean(body.CooperationCode);
        row.ContactName = Clean(body.ContactName);
        row.ContactEmail = Clean(body.ContactEmail);
        row.ContactPhone = Clean(body.ContactPhone);
        row.Notes = Clean(body.Notes);
        row.IsActive = body.IsActive;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(row, target));
    }

    [HttpDelete("{partnerId:guid}")]
    [RequirePermission("documents.write")]
    public async Task<IActionResult> Delete(Guid companyId, Guid partnerId, CancellationToken ct)
    {
        var company = await Company(companyId, ct);
        EnsureOfficeOwned(company);
        var row = await _db.InsuranceCompanyPartners.FirstOrDefaultAsync(item => item.Id == partnerId
            && item.InsuranceCompanyId == companyId, ct)
            ?? throw AppException.NotFound("Συνεργασία πρακτορείου");
        row.IsActive = false;
        row.DeletedAt = _clock.UtcNow;
        row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static PartnerDto ToDto(InsuranceCompanyPartner row, InsuranceCompany target)
        => new(row.Id, target.Id, target.Name, target.Code, target.IsBroker, row.RelationshipType,
            row.CooperationCode, row.ContactName, row.ContactEmail, row.ContactPhone, row.Notes,
            row.IsActive, row.CreatedAt, row.UpdatedAt);

    private static void EnsureOfficeOwned(InsuranceCompany company)
    {
        if (!company.IsBroker || company.TenantId is null)
            throw AppException.Validation("Τα πρακτορεία παραγωγής δημιουργούνται και διαχειρίζονται ξεχωριστά από κάθε γραφείο.");
    }

    private static string Normalize(string? value, string fallback)
        => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static string? Clean(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
