using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Legal-compliance dashboard for the tenant (γραφείο-controller). Reports
/// which of its customers have the required GDPR + IDD documentation on
/// record, and flags gaps that the AgencyAdmin should fix.
///
/// Read-only, tenant-scoped. Every metric here is computed against live
/// data — no snapshot table, no caching — so numbers always match reality.
/// </summary>
[ApiController]
[Route("api/compliance-dashboard")]
[Authorize(Policy = "AgencyStaff")]
public class ComplianceDashboardController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ComplianceDashboardController(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public record ComplianceGapCustomerDto(Guid Id, string DisplayName, string? Email, string? Phone);

    public record ComplianceDashboardDto(
        int TotalCustomers,
        int CustomersWithPrivacyNotice,
        int CustomersMissingPrivacyNotice,
        int SensitivePolicyCustomers,
        int SensitivePolicyCustomersWithHealthConsent,
        int SensitivePolicyCustomersMissingHealthConsent,
        IReadOnlyList<ComplianceGapCustomerDto> MissingPrivacyNoticeSample,
        IReadOnlyList<ComplianceGapCustomerDto> MissingHealthConsentSample);

    [HttpGet]
    public async Task<ActionResult<ComplianceDashboardDto>> Get(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Customer scope — δεν μετράμε ανώνυμοποιημένους πελάτες.
        var customersBase = _db.Customers
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.AnonymizedAt == null);

        var totalCustomers = await customersBase.CountAsync(ct);

        // «Ενεργή» συγκατάθεση = Granted && RevokedAt IS NULL.
        var privacyNoticeCustomerIds = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && c.Type == ConsentType.PrivacyNotice
                        && c.Granted && c.RevokedAt == null)
            .Select(c => c.CustomerId)
            .Distinct()
            .ToListAsync(ct);
        var withPrivacyNotice = privacyNoticeCustomerIds.Count;
        var missingPrivacyNotice = totalCustomers - withPrivacyNotice;

        // Sensitive policies = Life / Health / Accident. Ίδιο pattern με τα
        // πρότυπα εγγράφων: όποιος έχει τέτοιο συμβόλαιο ΠΡΕΠΕΙ να έχει και
        // Άρθρο 9 συγκατάθεση.
        var sensitiveCustomerIds = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && (p.PolicyType == PolicyType.Life
                            || p.PolicyType == PolicyType.Health))
            .Select(p => p.CustomerId)
            .Distinct()
            .ToListAsync(ct);

        var healthConsentCustomerIds = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && c.Type == ConsentType.HealthDataProcessing
                        && c.Granted && c.RevokedAt == null)
            .Select(c => c.CustomerId)
            .Distinct()
            .ToListAsync(ct);
        var healthConsentSet = new HashSet<Guid>(healthConsentCustomerIds);

        var sensitiveWithHealthConsent = sensitiveCustomerIds.Count(id => healthConsentSet.Contains(id));
        var sensitiveMissingHealthConsent = sensitiveCustomerIds.Count - sensitiveWithHealthConsent;

        // Δείγματα (10 πελάτες) των πιο ουσιωδών κενών — link στη
        // CustomerDetail σελίδα για γρήγορη επίλυση.
        var missingPrivacyIds = await customersBase
            .Where(c => !privacyNoticeCustomerIds.Contains(c.Id))
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => c.Id)
            .Take(10)
            .ToListAsync(ct);
        var missingPrivacySample = await BuildGapSampleAsync(missingPrivacyIds, ct);

        var missingHealthIds = sensitiveCustomerIds
            .Where(id => !healthConsentSet.Contains(id))
            .Take(10)
            .ToList();
        var missingHealthSample = await BuildGapSampleAsync(missingHealthIds, ct);

        return Ok(new ComplianceDashboardDto(
            totalCustomers,
            withPrivacyNotice,
            missingPrivacyNotice,
            sensitiveCustomerIds.Count,
            sensitiveWithHealthConsent,
            sensitiveMissingHealthConsent,
            missingPrivacySample,
            missingHealthSample));
    }

    private async Task<IReadOnlyList<ComplianceGapCustomerDto>> BuildGapSampleAsync(
        IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return Array.Empty<ComplianceGapCustomerDto>();
        var rows = await _db.Customers
            .Where(c => ids.Contains(c.Id) && c.DeletedAt == null)
            .Select(c => new
            {
                c.Id,
                c.Type,
                c.FirstName,
                c.LastName,
                c.CompanyName,
                c.Email,
                c.Phone
            })
            .ToListAsync(ct);
        return rows.Select(c => new ComplianceGapCustomerDto(
            c.Id,
            c.Type == CustomerType.Individual
                ? $"{c.FirstName} {c.LastName}".Trim()
                : (c.CompanyName ?? ""),
            c.Email, c.Phone
        )).ToList();
    }
}
