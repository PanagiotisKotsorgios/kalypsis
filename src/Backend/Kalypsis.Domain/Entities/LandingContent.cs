using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Key/value store for editable content blocks on the public landing page
/// (hero copy, ΕΡΜΗΣ showcase, feature grids, testimonial quotes, etc.).
/// One row per section, with a free-form JSON payload the frontend
/// deserialises and falls back on hardcoded defaults for anything missing.
/// Global content — not tenant-scoped.
/// </summary>
public class LandingContent : BaseEntity
{
    /// <summary>Slug-safe section identifier — e.g. "ermes-showcase",
    /// "hero", "pricing-cta". Unique per row.</summary>
    public string SectionKey { get; set; } = "";

    /// <summary>Free-form JSON payload with the section's fields. Frontend
    /// parses on read; defaults kick in when a field is missing.</summary>
    public string PayloadJson { get; set; } = "{}";

    public Guid? UpdatedByUserId { get; set; }
}
