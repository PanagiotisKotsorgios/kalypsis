namespace Kalypsis.Application.Abstractions;

public record EmailMessage(
    string ToEmail,
    string ToName,
    string Subject,
    string HtmlBody,
    string? TextBody = null);

public record EmailResult(bool Success, string? ErrorMessage = null);

public interface IEmailSender
{
    Task<EmailResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
    Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default);
    /// <summary>Ping the provider's account endpoint using the stored key
    /// alone (no sender / template needed) — tells you «is the API key
    /// valid» in isolation, before mixing it with sender-verification
    /// failures. Returns the plan name on success so the admin can also
    /// see WHICH Brevo account the key belongs to.</summary>
    Task<KeyValidationResult> ValidateKeyAsync(CancellationToken cancellationToken = default);
}

public record KeyValidationResult(
    bool Valid,
    string? AccountEmail,
    string? PlanName,
    string? StoredKeyPreview,   // e.g. «xkeysib-…yxKuc4» — helps admin cross-check
    string? ErrorMessage);
