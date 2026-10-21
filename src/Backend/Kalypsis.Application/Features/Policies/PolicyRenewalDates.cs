namespace Kalypsis.Application.Features.Policies;

public static class PolicyRenewalDates
{
    /// <summary>Follow expiry unless an office deliberately recorded a different renewal date.</summary>
    public static DateOnly FollowExpiry(DateOnly? renewal, DateOnly previousExpiry, DateOnly nextExpiry)
        => renewal is null || renewal == previousExpiry ? nextExpiry : renewal.Value;
}
