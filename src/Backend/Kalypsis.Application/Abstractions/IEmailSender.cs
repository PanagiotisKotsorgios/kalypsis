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
}
