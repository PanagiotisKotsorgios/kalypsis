using System.Text.Json;

namespace Kalypsis.Application.Features.Tenants;

/// <summary>
/// Normalises the per-tenant sidebar keys stored on <see cref="Domain.Entities.Tenant"/>.
/// The frontend owns the catalogue; this guard keeps persisted values bounded and safe
/// when they are supplied through the Platform Admin API.
/// </summary>
public static class TenantSidebarVisibility
{
    public const int MaxHiddenItems = 100;

    public static string[] Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            var items = JsonSerializer.Deserialize<string[]>(json);
            return Normalize(items);
        }
        catch (JsonException)
        {
            // A malformed legacy value must never make signing in impossible.
            return [];
        }
    }

    public static string[] Normalize(IEnumerable<string>? items)
        => (items ?? [])
            .Where(IsValidKey)
            .Select(x => x.Trim())
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .Take(MaxHiddenItems)
            .ToArray();

    public static string Serialize(IEnumerable<string>? items)
        => JsonSerializer.Serialize(Normalize(items));

    private static bool IsValidKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var key = value.Trim();
        if (key.Length is < 7 or > 160) return false;
        if (!key.StartsWith("item:/", StringComparison.Ordinal)
            && !key.StartsWith("group:", StringComparison.Ordinal)) return false;

        return key.All(c => char.IsLetterOrDigit(c) || c is ':' or '/' or '-' or '_' or '.');
    }
}
