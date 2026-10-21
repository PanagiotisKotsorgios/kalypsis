using System.Text.Json;

namespace Kalypsis.Application.Features.GreenCards;

public static class GreenCardVehicleDefaults
{
    public static (string? MakeModel, string? Vin) FromSpecs(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return (null, null);
        try
        {
            using var document = JsonDocument.Parse(specsJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return (null, null);
            var nested = root.TryGetProperty("vehicle", out var vehicle) && vehicle.ValueKind == JsonValueKind.Object ? vehicle : default;
            string? Text(string key)
            {
                if (root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString()))
                    return value.GetString()!.Trim();
                if (nested.ValueKind == JsonValueKind.Object && nested.TryGetProperty(key, out value) && value.ValueKind == JsonValueKind.String)
                    return string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString()!.Trim();
                return null;
            }
            var makeModel = string.Join(" ", new[] { Text("make"), Text("model") }.Where(value => value is not null));
            return (string.IsNullOrWhiteSpace(makeModel) ? null : makeModel, Text("vin"));
        }
        catch (JsonException) { return (null, null); }
    }
}
