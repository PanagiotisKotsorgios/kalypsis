using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>Office-owned public website content and lead collection.</summary>
public sealed class OfficeWebsite : TenantEntity
{
    public string Slug { get; set; } = string.Empty;
    public string? CustomDomain { get; set; }
    public string SiteName { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string HeroTitle { get; set; } = string.Empty;
    public string HeroBody { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string BrandColorHex { get; set; } = "#1f7bb3";
    public string PostsJson { get; set; } = "[]";
    public string OffersJson { get; set; } = "[]";
    public string BannersJson { get; set; } = "[]";
    public string FormConfigJson { get; set; } = "{}";
    public bool IsPublished { get; set; }
    public ICollection<OfficeWebsiteRequest> Requests { get; set; } = new List<OfficeWebsiteRequest>();
}

public sealed class OfficeWebsiteRequest : TenantEntity
{
    public Guid OfficeWebsiteId { get; set; }
    public OfficeWebsite OfficeWebsite { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Product { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? PreferredContact { get; set; }
    public bool ConsentGiven { get; set; }
    public string Status { get; set; } = "New";
    public string? Source { get; set; }
    public DateTime? ContactedAt { get; set; }
    public string? InternalNotes { get; set; }
}

/// <summary>
/// Anonymous, first-party website measurement. No IP address or personal
/// identity is stored; the session key is hashed before persistence.
/// </summary>
public sealed class OfficeWebsiteEvent : TenantEntity
{
    public Guid OfficeWebsiteId { get; set; }
    public OfficeWebsite OfficeWebsite { get; set; } = null!;
    public string EventType { get; set; } = "page_view";
    public string? Path { get; set; }
    public string? Referrer { get; set; }
    public string? Source { get; set; }
    public string? Campaign { get; set; }
    public string? Device { get; set; }
    public string? SessionKeyHash { get; set; }
}
