using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase11;

internal static class GarageInput
{
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
        if (await db.Garages.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant && x.Code == b.Code && x.Id != updating, ct))
            throw new AppException("garage_code_taken", "Υπάρχει ήδη συνεργείο με αυτόν τον κωδικό. Επιλέξτε διαφορετικό κωδικό ή αφήστε τον κενό για αυτόματη δημιουργία.", 409);
        return b;
    }
}
