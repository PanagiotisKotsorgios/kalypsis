using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
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
    private readonly IDateTimeProvider _clock;

    public ComplianceDashboardController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record ComplianceGapCustomerDto(Guid Id, string DisplayName, string? Email, string? Phone);

    public record ComplianceDashboardDto(
        int TotalCustomers,
        int CustomersWithPrivacyNotice,
        int CustomersMissingPrivacyNotice,
        int SensitivePolicyCustomers,
        int SensitivePolicyCustomersWithHealthConsent,
        int SensitivePolicyCustomersMissingHealthConsent,
        int CustomersWithIddNeedsAssessment,
        int CustomersMissingIddNeedsAssessment,
        int HighValueCustomers,
        int HighValueCustomersWithAmlKyc,
        int HighValueCustomersMissingAmlKyc,
        IReadOnlyList<ComplianceGapCustomerDto> MissingPrivacyNoticeSample,
        IReadOnlyList<ComplianceGapCustomerDto> MissingHealthConsentSample,
        IReadOnlyList<ComplianceGapCustomerDto> MissingIddSample,
        IReadOnlyList<ComplianceGapCustomerDto> MissingAmlKycSample);

    public record BackfillDto(int Created, int AlreadyPresent);

    [HttpGet]
    public async Task<ActionResult<ComplianceDashboardDto>> Get(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        // Customer scope — δεν μετράμε ανώνυμοποιημένους πελάτες.
        var customersBase = _db.Customers
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.AnonymizedAt == null);

        var totalCustomers = await customersBase.CountAsync(ct);

        // Helper: επιστρέφει τους customer ids που έχουν ενεργή συγκατάθεση
        // ενός συγκεκριμένου τύπου («Granted && RevokedAt IS NULL»).
        async Task<HashSet<Guid>> ActiveConsentSet(ConsentType type)
        {
            var ids = await _db.ConsentRecords
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                            && c.Type == type
                            && c.Granted && c.RevokedAt == null)
                .Select(c => c.CustomerId)
                .Distinct()
                .ToListAsync(ct);
            return new HashSet<Guid>(ids);
        }

        var privacySet = await ActiveConsentSet(ConsentType.PrivacyNotice);
        var healthSet  = await ActiveConsentSet(ConsentType.HealthDataProcessing);
        var iddSet     = await ActiveConsentSet(ConsentType.IddDemandsAndNeeds);
        var amlSet     = await ActiveConsentSet(ConsentType.AmlKycDeclaration);

        var withPrivacyNotice = privacySet.Count;
        var missingPrivacyNotice = totalCustomers - withPrivacyNotice;

        // Sensitive policies = Life / Health. Ίδιο pattern με τα πρότυπα
        // εγγράφων: όποιος έχει τέτοιο συμβόλαιο ΠΡΕΠΕΙ να έχει και Άρθρο 9
        // συγκατάθεση.
        var sensitiveCustomerIds = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && (p.PolicyType == PolicyType.Life
                            || p.PolicyType == PolicyType.Health))
            .Select(p => p.CustomerId)
            .Distinct()
            .ToListAsync(ct);

        var sensitiveWithHealthConsent = sensitiveCustomerIds.Count(id => healthSet.Contains(id));
        var sensitiveMissingHealthConsent = sensitiveCustomerIds.Count - sensitiveWithHealthConsent;

        // IDD Demands & Needs: υποχρεωτικό για ΚΑΘΕ πελάτη με συμβόλαιο.
        // Όχι μόνο για sensitive — Ν.4583/2018 Άρθρο 27.
        var customersWithAnyPolicy = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .Select(p => p.CustomerId).Distinct().ToListAsync(ct);
        var customersWithIdd = customersWithAnyPolicy.Count(id => iddSet.Contains(id));
        var customersMissingIdd = customersWithAnyPolicy.Count - customersWithIdd;

        // High-value cohort για AML/KYC: πελάτες με ≥1 συμβόλαιο ετησίως
        // ≥15.000€ (κατώφλι Ν.4557/2018) Ή συμβόλαιο Ζωής (πάντα ΚΥΚ).
        const decimal AmlThreshold = 15_000m;
        var highValueCustomerIds = await _db.Policies
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null
                        && (p.Premium >= AmlThreshold || p.PolicyType == PolicyType.Life))
            .Select(p => p.CustomerId).Distinct().ToListAsync(ct);
        var highValueWithAml = highValueCustomerIds.Count(id => amlSet.Contains(id));
        var highValueMissingAml = highValueCustomerIds.Count - highValueWithAml;

        // Δείγματα (10 πελάτες) των πιο ουσιωδών κενών — link στη
        // CustomerDetail σελίδα για γρήγορη επίλυση.
        var missingPrivacyIds = await customersBase
            .Where(c => !privacySet.Contains(c.Id))
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => c.Id)
            .Take(10)
            .ToListAsync(ct);
        var missingPrivacySample = await BuildGapSampleAsync(missingPrivacyIds, ct);

        var missingHealthIds = sensitiveCustomerIds.Where(id => !healthSet.Contains(id)).Take(10).ToList();
        var missingHealthSample = await BuildGapSampleAsync(missingHealthIds, ct);

        var missingIddIds = customersWithAnyPolicy.Where(id => !iddSet.Contains(id)).Take(10).ToList();
        var missingIddSample = await BuildGapSampleAsync(missingIddIds, ct);

        var missingAmlIds = highValueCustomerIds.Where(id => !amlSet.Contains(id)).Take(10).ToList();
        var missingAmlSample = await BuildGapSampleAsync(missingAmlIds, ct);

        return Ok(new ComplianceDashboardDto(
            totalCustomers,
            withPrivacyNotice,
            missingPrivacyNotice,
            sensitiveCustomerIds.Count,
            sensitiveWithHealthConsent,
            sensitiveMissingHealthConsent,
            customersWithIdd,
            customersMissingIdd,
            highValueCustomerIds.Count,
            highValueWithAml,
            highValueMissingAml,
            missingPrivacySample,
            missingHealthSample,
            missingIddSample,
            missingAmlSample));
    }

    /// <summary>
    /// One-off backfill για παλιούς πελάτες που δημιουργήθηκαν πριν την
    /// ενεργοποίηση του mandatory Άρθρου 13 checkbox στη φόρμα δημιουργίας.
    /// Δημιουργεί ΕΝΑ ConsentRecord PrivacyNotice ανά customer που δεν έχει,
    /// με Method=Verbal + Version=«backfill» ώστε στο audit να διακρίνεται
    /// η legacy καταγωγή.
    ///
    /// Idempotent: εκτέλεση δεύτερης φοράς δεν διπλογράφει.
    /// </summary>
    [HttpPost("backfill-privacy-notice")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<BackfillDto>> BackfillPrivacyNotice(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();

        var existingPrivacyCustomerIds = await _db.ConsentRecords
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null
                        && c.Type == ConsentType.PrivacyNotice
                        && c.Granted && c.RevokedAt == null)
            .Select(c => c.CustomerId).Distinct().ToListAsync(ct);
        var existingSet = new HashSet<Guid>(existingPrivacyCustomerIds);

        var candidateIds = await _db.Customers
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.AnonymizedAt == null)
            .Select(c => c.Id).ToListAsync(ct);

        var toCreate = candidateIds.Where(id => !existingSet.Contains(id)).ToList();
        var now = _clock.UtcNow;

        foreach (var cid in toCreate)
        {
            _db.ConsentRecords.Add(new ConsentRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CustomerId = cid,
                Type = ConsentType.PrivacyNotice,
                Granted = true,
                GrantedAt = now,
                Method = ConsentMethod.Verbal,
                Version = "backfill-legacy",
                Notes = "Backfilled: πελάτης δημιουργήθηκε πριν την ενεργοποίηση του mandatory checkbox. Το γραφείο δηλώνει ότι είχε δώσει την Ενημέρωση προφορικά.",
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
            });
        }
        if (toCreate.Count > 0) await _db.SaveChangesAsync(ct);
        return Ok(new BackfillDto(toCreate.Count, existingSet.Count));
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
