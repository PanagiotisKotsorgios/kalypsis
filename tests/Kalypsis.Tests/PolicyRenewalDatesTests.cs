using Kalypsis.Application.Features.Policies;
using Xunit;

namespace Kalypsis.Tests;

public sealed class PolicyRenewalDatesTests
{
    [Fact]
    public void Unset_renewal_defaults_to_expiry()
    {
        var expiry = new DateOnly(2027, 1, 1);
        Assert.Equal(expiry, PolicyRenewalDates.FollowExpiry(null, new DateOnly(2026, 1, 1), expiry));
    }

    [Fact]
    public void Automatic_renewal_follows_a_changed_expiry()
    {
        var oldExpiry = new DateOnly(2026, 12, 31);
        var nextExpiry = new DateOnly(2027, 1, 31);
        Assert.Equal(nextExpiry, PolicyRenewalDates.FollowExpiry(oldExpiry, oldExpiry, nextExpiry));
    }

    [Fact]
    public void A_deliberate_office_override_is_not_overwritten()
    {
        var chosen = new DateOnly(2026, 12, 15);
        Assert.Equal(chosen, PolicyRenewalDates.FollowExpiry(chosen, new DateOnly(2026, 12, 31), new DateOnly(2027, 1, 31)));
    }
}
