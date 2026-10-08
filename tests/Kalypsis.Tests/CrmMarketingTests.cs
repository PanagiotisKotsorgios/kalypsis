using System.Text.Json;
using Kalypsis.Application.Features.Marketing;
using Xunit;

namespace Kalypsis.Tests;

public sealed class CrmMarketingTests
{
    [Fact]
    public void NewCampaignChannels_are_limited_to_office_email_and_sms_providers()
    {
        Assert.Equal(new[] { MarketingChannels.Email, MarketingChannels.Sms }, MarketingChannels.All);
        Assert.Equal(new[] { MarketingChannels.Email, MarketingChannels.Sms },
            MarketingChannels.Parse(JsonSerializer.Serialize(new[] { "Email", "Sms", "Viber" })));
    }

    [Fact]
    public void EmptyChannels_default_to_email()
    {
        Assert.Equal(new[] { MarketingChannels.Email }, MarketingChannels.Parse(null));
    }
}
