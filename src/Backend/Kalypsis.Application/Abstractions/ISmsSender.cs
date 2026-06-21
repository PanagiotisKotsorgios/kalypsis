namespace Kalypsis.Application.Abstractions;

public record SmsMessage(string ToPhone, string Body);
public record SmsResult(bool Success, string? ErrorMessage = null);

/// <summary>
/// Pluggable SMS gateway. Production implementations: Twilio, Viva SMS, Vonage, etc.
/// Development uses <c>DevSmsSender</c> which only writes to the log.
/// </summary>
public interface ISmsSender
{
    Task<SmsResult> SendAsync(SmsMessage message, CancellationToken cancellationToken = default);
    Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default);
}

public interface ITotpService
{
    /// <summary>Generate a fresh random Base32 secret (160 bits).</summary>
    string GenerateSecret();

    /// <summary>Build the otpauth:// URI an authenticator app can QR-scan.</summary>
    string BuildOtpAuthUri(string base32Secret, string issuer, string accountLabel);

    /// <summary>Verify a 6-digit code, allowing ±1 step (30s) clock skew.</summary>
    bool VerifyCode(string base32Secret, string code);

    /// <summary>Generate N one-time recovery codes (returned plaintext + hashes for storage).</summary>
    IReadOnlyList<(string Plain, string Hash)> GenerateRecoveryCodes(int count = 10);

    /// <summary>Verify a typed recovery code against the stored hash.</summary>
    bool VerifyRecoveryCode(string typedCode, string storedHash);
}
