namespace Kalypsis.Application.Common;

/// <summary>Builds the stable referral code shown in the office affiliate page.</summary>
public static class AffiliateReferralCode
{
    public static string ForTenant(Guid tenantId, string? email = null)
    {
        var source = tenantId != Guid.Empty ? tenantId.ToString() : (email ?? "office");
        var suffix = new string(source.Where(char.IsLetterOrDigit).ToArray());
        if (suffix.Length > 8) suffix = suffix[^8..];
        return $"KALY-{suffix.ToUpperInvariant().PadLeft(6, '0')}";
    }
}
