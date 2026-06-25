namespace Kalypsis.Domain.Enums;

/// <summary>
/// Tiers an agency uses to bucket its partner network for commission rules.
/// "A" is the top earner band, "E" the entry band. "None" is the fallback for
/// brand-new producers that have not been classified yet. Distinct from the
/// <see cref="Entities.ProducerCategory"/> reference-catalog entity.
/// </summary>
public enum ProducerTier
{
    None = 0,
    A = 1,
    B = 2,
    C = 3,
    D = 4,
    E = 5
}
