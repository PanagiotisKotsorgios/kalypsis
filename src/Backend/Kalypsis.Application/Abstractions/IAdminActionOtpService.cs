namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Out-of-band verification for destructive PlatformAdmin actions. See
/// AdminActionChallenge entity for the full threat model. A caller
/// stealing a JWT alone cannot destroy data — they'd also need access
/// to the platform's info@ mailbox to read the 6-digit code.
/// </summary>
public interface IAdminActionOtpService
{
    /// <summary>Generate + email a 6-digit code for a specific action.
    /// Returns the opaque bearer token the client stores locally + will
    /// present on /verify. The plaintext code is NEVER returned to the
    /// client — it only goes to the emailed inbox.</summary>
    Task<RequestChallengeResult> RequestAsync(string action, string? target,
        Guid requestedByUserId, CancellationToken ct = default);

    /// <summary>Verify a submitted code against a token. On success,
    /// marks the challenge as Verified so the destructive endpoint's
    /// attribute filter will admit the follow-up request. Wrong code
    /// increments Attempts — after 5 wrongs, the challenge is
    /// permanently rejected to blunt brute force.</summary>
    Task<VerifyChallengeResult> VerifyAsync(string token, string code,
        Guid verifiedByUserId, CancellationToken ct = default);

    /// <summary>Consume a Verified challenge for a specific action +
    /// target. Called by the [RequiresAdminOtp] filter. Returns true
    /// if a matching Verified challenge existed AND was successfully
    /// marked ConsumedAt. Second call with the same token returns
    /// false — used-once, no replay.</summary>
    Task<bool> ConsumeAsync(string token, string action, string? target,
        Guid actingUserId, CancellationToken ct = default);
}

public record RequestChallengeResult(string Token, DateTime ExpiresAt, string EmailedTo);
public record VerifyChallengeResult(bool Verified, string? Reason, int AttemptsRemaining);
