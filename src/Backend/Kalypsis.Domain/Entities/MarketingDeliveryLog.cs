using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Immutable-ish audit row for every CRM campaign delivery attempt. The
/// rendered content is kept so an operator can preview exactly what went out,
/// even after a campaign template is edited.
/// </summary>
public class MarketingDeliveryLog : TenantEntity
{
    public Guid CampaignId { get; set; }
    public MarketingCampaign Campaign { get; set; } = null!;
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string CampaignName { get; set; } = string.Empty;
    public string Channel { get; set; } = "Email";
    public string Provider { get; set; } = string.Empty;
    public string Status { get; set; } = "Queued";
    public string? RecipientName { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? BodyHtml { get; set; }
    public string? BodyText { get; set; }
    public string? ProviderMessageId { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime SentAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? OpenedAt { get; set; }
    public DateTime? ClickedAt { get; set; }
    public DateTime? UnsubscribedAt { get; set; }
}
