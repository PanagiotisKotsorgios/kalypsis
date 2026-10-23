using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Features.Phase11;

internal static class GarageInput
{
    public static GarageProfile? ReadProfile(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<GarageProfile>(json); }
        catch (JsonException) { return null; }
    }

    public static async Task ApplyDetails(IAppDbContext db, Garage garage, GarageBody body, CancellationToken ct)
    {
        if (body.Profile is not null) garage.ProfileJson = JsonSerializer.Serialize(body.Profile);
        if (body.InsuranceCompanyIds is null) return; // Legacy clients preserve existing relationships.
        var ids = body.InsuranceCompanyIds.Distinct().ToArray();
        var existing = await db.GarageInsuranceCompanies.IgnoreQueryFilters()
            .Where(x => x.TenantId == garage.TenantId && x.GarageId == garage.Id).ToListAsync(ct);
        foreach (var link in existing)
            link.DeletedAt = ids.Contains(link.InsuranceCompanyId) ? null : DateTime.UtcNow;
        foreach (var id in ids.Except(existing.Select(x => x.InsuranceCompanyId)))
            db.GarageInsuranceCompanies.Add(new GarageInsuranceCompany { Id = Guid.NewGuid(), TenantId = garage.TenantId,
                AgencyOfficeScopeId = garage.AgencyOfficeScopeId, Garage = garage, GarageId = garage.Id, InsuranceCompanyId = id });
    }

    public static async Task<GarageBody> Prepare(IAppDbContext db, ICurrentUser current, GarageBody body, Guid? updating, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        var code = body.Code?.Trim() ?? "";
        if (code.Length == 0 && updating is null) code = $"G-{Guid.NewGuid():N}";
        var b = body with { Code = code, Name = body.Name?.Trim() ?? "", Afm = Clean(body.Afm), Address = Clean(body.Address),
            City = Clean(body.City), PostalCode = Clean(body.PostalCode), Phone = Clean(body.Phone), Email = Clean(body.Email),
            Specialty = Clean(body.Specialty), Iban = Clean(body.Iban), Notes = Clean(body.Notes) };
        await new GarageBodyValidator().ValidateAndThrowAsync(b, ct);
        if (b.Profile is not null)
        {
            foreach (var property in typeof(GarageProfile).GetProperties())
            {
                var value = (string?)property.GetValue(b.Profile);
                var limit = property.Name is "Services" ? 1000 : property.Name is "Website" ? 500 : 200;
                if (value?.Length > limit) throw AppException.Validation($"Το πεδίο {property.Name} υπερβαίνει τους {limit} χαρακτήρες.");
                var contactKey = property.Name.EndsWith("Phone") ? "phone" : property.Name.EndsWith("Email") ? "email" : null;
                if (contactKey is not null && ContactValueRules.Error(contactKey, value) is { } error) throw AppException.Validation(error);
            }
            if (!string.IsNullOrWhiteSpace(b.Profile.Website) && (!Uri.TryCreate(b.Profile.Website, UriKind.Absolute, out var url)
                || url.Scheme is not ("https" or "http") || !string.IsNullOrEmpty(url.UserInfo)))
                throw AppException.Validation("Συμπληρώστε έγκυρο σύνδεσμο ιστοσελίδας με https:// ή http://.");
        }
        if (b.InsuranceCompanyIds is { } companies)
        {
            if (companies.Count > 100 || companies.Contains(Guid.Empty)) throw AppException.Validation("Επιλέξτε έως 100 έγκυρες ασφαλιστικές εταιρείες.");
            var allowed = await db.InsuranceCompanies.Where(x => companies.Contains(x.Id) && x.DeletedAt == null
                && (x.TenantId == null || x.TenantId == tenant)).Select(x => x.Id).ToListAsync(ct);
            if (companies.Distinct().Except(allowed).Any()) throw AppException.Validation("Μία ασφαλιστική εταιρεία δεν είναι διαθέσιμη στο γραφείο σας.");
        }
        if (await db.Garages.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant && x.Code == b.Code && x.Id != updating, ct))
            throw new AppException("garage_code_taken", "Υπάρχει ήδη συνεργείο με αυτόν τον κωδικό. Επιλέξτε διαφορετικό κωδικό ή αφήστε τον κενό για αυτόματη δημιουργία.", 409);
        return b;
    }
}
