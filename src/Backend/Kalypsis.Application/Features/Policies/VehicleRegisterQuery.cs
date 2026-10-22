using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Policies;

public record VehicleRegisterOwner(string Name, string? VatNumber, decimal? Percentage, Guid? CustomerId);
public record VehicleRegisterRow(string Id, string Plate, Guid PrimaryPolicyId, Guid[] PolicyIds,
    VehicleRegisterOwner[] Owners, string? Make, string? Model, string? Year, string? Vin,
    string? Use, string? FuelType, string? EngineCapacity, string? Color, string? FirstRegistrationDate);
public record VehicleRegisterQuery : IRequest<IReadOnlyList<VehicleRegisterRow>>;

/// <summary>
/// One vehicle per normalized registration plate, not one row per renewal.
/// Uses existing vehicle data without changing policy history or introducing a second store.
/// </summary>
public sealed class VehicleRegisterQueryHandler(IAppDbContext db, ICurrentUser current)
    : IRequestHandler<VehicleRegisterQuery, IReadOnlyList<VehicleRegisterRow>>
{
    public async Task<IReadOnlyList<VehicleRegisterRow>> Handle(VehicleRegisterQuery request, CancellationToken ct)
    {
        var tenantId = current.TenantId ?? throw AppException.Forbidden();
        var query = db.Policies.AsNoTracking().Where(p => p.TenantId == tenantId && p.DeletedAt == null
            && p.VehicleRegistrationPlate != null && p.VehicleRegistrationPlate != "");
        // Match policy permissions, including producer/customer restrictions and office query filters.
        if (current.Role == Role.Customer)
        {
            var customerId = await db.Users.Where(u => u.Id == current.UserId).Select(u => u.CustomerId).FirstOrDefaultAsync(ct);
            if (!customerId.HasValue) return [];
            query = query.Where(p => p.CustomerId == customerId);
        }
        else if (current.Role == Role.Producer)
        {
            var producerId = await db.Users.Where(u => u.Id == current.UserId).Select(u => u.ProducerId).FirstOrDefaultAsync(ct);
            if (!producerId.HasValue) return [];
            query = query.Where(p => p.ProducerId == producerId);
        }
        // Project only vehicle/owner metadata in one query. Do not use the capped /policies list
        // or fetch every expensive financial policy-detail endpoint individually.
        var source = await query.Select(p => new {
            p.Id, p.VehicleRegistrationPlate, p.CustomerId,
            OwnerName = p.Customer.Type == CustomerType.Individual
                ? ((p.Customer.FirstName ?? "") + " " + (p.Customer.LastName ?? "")).Trim()
                : p.Customer.CompanyName,
            OwnerVat = p.Customer.VatNumber, p.StartDate, p.CreatedAt, p.SpecsJson,
            p.VehicleUseCategory, p.CarrierUseCode,
        }).ToListAsync(ct);

        return source.Where(p => !string.IsNullOrWhiteSpace(p.VehicleRegistrationPlate) && NormalizePlate(p.VehicleRegistrationPlate!).Length > 0)
            .GroupBy(p => NormalizePlate(p.VehicleRegistrationPlate!))
            .Select(group => {
                // The latest vehicle snapshot agrees with the existing vehicle detail card.
                var rows = group.OrderByDescending(p => p.StartDate).ThenByDescending(p => p.Id).ToArray();
                var latest = rows[0];
                var specs = ReadSpecs(latest.SpecsJson);
                var owners = ReadOwners(specs, latest.OwnerName ?? "", latest.OwnerVat, latest.CustomerId);
                var use = !string.IsNullOrWhiteSpace(latest.CarrierUseCode) ? latest.CarrierUseCode
                    : latest.VehicleUseCategory is null or VehicleUseCategory.None ? null : latest.VehicleUseCategory.ToString();
                return new VehicleRegisterRow(group.Key, latest.VehicleRegistrationPlate!.Trim().ToUpperInvariant(), latest.Id,
                    rows.Select(p => p.Id).ToArray(), owners,
                    Text(specs, "make"), Text(specs, "model"), Text(specs, "year"), Text(specs, "vin"), use,
                    Text(specs, "fuelType"), Text(specs, "engineCapacity"), Text(specs, "color"), Text(specs, "firstRegistrationDate"));
            }).OrderBy(row => row.Plate, StringComparer.OrdinalIgnoreCase).ToArray();
    }

    public static string NormalizePlate(string plate) => string.Concat(plate.ToUpperInvariant()
        .Where(char.IsLetterOrDigit).Select(c => c switch {
            'Α' => 'A', 'Β' => 'B', 'Ε' => 'E', 'Ζ' => 'Z', 'Η' => 'H', 'Ι' => 'I', 'Κ' => 'K',
            'Μ' => 'M', 'Ν' => 'N', 'Ο' => 'O', 'Ρ' => 'P', 'Τ' => 'T', 'Υ' => 'Y', 'Χ' => 'X', _ => c,
        }));

    private static JsonElement ReadSpecs(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return default;
        try { using var doc = JsonDocument.Parse(raw); return doc.RootElement.ValueKind == JsonValueKind.Object ? doc.RootElement.Clone() : default; }
        catch (JsonException) { return default; }
    }
    private static string? Text(JsonElement specs, string key)
    {
        if (specs.ValueKind != JsonValueKind.Object || !specs.TryGetProperty(key, out var value)
            || value.ValueKind is JsonValueKind.Null or JsonValueKind.Object or JsonValueKind.Array) return null;
        return value.ToString().Trim() is { Length: > 0 } text ? text : null;
    }
    private static VehicleRegisterOwner[] ReadOwners(JsonElement specs, string fallback, string? vat, Guid customerId)
    {
        var owners = new List<VehicleRegisterOwner>();
        if (specs.ValueKind == JsonValueKind.Object && specs.TryGetProperty("vehicleOwnership", out var saved) && saved.ValueKind == JsonValueKind.Array)
            foreach (var row in saved.EnumerateArray().Take(100))
            {
                var name = Text(row, "name"); var ownerVat = Text(row, "vatNumber");
                if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(ownerVat)) continue;
                decimal? percentage = row.ValueKind == JsonValueKind.Object && row.TryGetProperty("percentage", out var share)
                    && share.ValueKind == JsonValueKind.Number && share.TryGetDecimal(out var number) ? number : null;
                var isCustomer = !string.IsNullOrWhiteSpace(ownerVat) ? ownerVat == vat
                    : string.Equals(name, fallback, StringComparison.OrdinalIgnoreCase);
                owners.Add(new(name ?? "Χωρίς όνομα", ownerVat, percentage, isCustomer ? customerId : null));
            }
        // Legacy records have no separate owner register: retain their recorded customer,
        // but never replace an explicitly entered co-owner with the policyholder.
        return owners.Count > 0 ? owners.ToArray() : [new(fallback, vat, null, customerId)];
    }
}
