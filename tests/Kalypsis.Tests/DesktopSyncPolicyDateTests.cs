using System.Reflection;
using System.Text.Json;
using Kalypsis.Api.Controllers;
using Kalypsis.Domain.Entities;
using Xunit;

namespace Kalypsis.Tests;

public sealed class DesktopSyncPolicyDateTests
{
    [Fact]
    public void Desktop_delivery_timestamp_is_accepted_as_policy_date()
    {
        var row = JsonSerializer.SerializeToElement(new
        {
            PolicyNumber = "TEST-DELIVERY",
            EffectiveFrom = "2026-10-01T00:00:00",
            EffectiveTo = "2027-10-01T00:00:00",
            DeliveredAt = "2026-10-27T15:30:00",
        });
        var normalized = (JsonElement)typeof(DesktopSyncController)
            .GetMethod("NormalizeDesktopRow", BindingFlags.Static | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(Policy)).Invoke(null, [row])!;

        Assert.Equal("2026-10-27", normalized.GetProperty("DeliveredAt").GetString());
        Assert.Equal(new DateOnly(2026, 10, 27),
            normalized.Deserialize<Policy>()!.DeliveredAt);
    }
}
