using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Tenant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public SubscriptionPlan SubscriptionPlan { get; set; } = SubscriptionPlan.Trial;

    // Branding & operational defaults editable by the agency admin
    public string? LogoUrl { get; set; }
    public string? BrandColorHex { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? AddressLine { get; set; }
    public string? VatNumber { get; set; }
    public string DefaultCurrency { get; set; } = "EUR";
    public int DefaultPolicyDurationMonths { get; set; } = 12;

    /// <summary>Set when the agency admin completes the onboarding wizard. Null = still onboarding.</summary>
    public DateTime? OnboardingCompletedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Customer> Customers { get; set; } = new List<Customer>();
    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
}
