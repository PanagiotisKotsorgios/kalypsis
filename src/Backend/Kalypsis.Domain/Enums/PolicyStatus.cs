namespace Kalypsis.Domain.Enums;

public enum PolicyStatus
{
    Draft = 1,
    Active = 2,
    Expired = 3,
    Cancelled = 4,
    Renewed = 5,
    PendingRenewal = 6,
    /// <summary>ALIS-parity — «Απαράδοτο». Insurer has issued the policy but
    /// the office hasn't handed it over to the customer yet.</summary>
    Undelivered = 7,
    /// <summary>The application has been sent to the insurer but no policy
    /// number has been assigned yet — common during motor issue.</summary>
    AwaitingIssue = 8
}
