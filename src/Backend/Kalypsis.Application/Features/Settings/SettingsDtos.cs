namespace Kalypsis.Application.Features.Settings;

public record PlatformSettingsDto(
    string? BrevoApiKeyMasked,
    bool HasBrevoApiKey,
    string? BrevoSenderEmail,
    string? BrevoSenderName,
    string? SupportEmail,
    string? AppBaseUrl,
    DateTime? UpdatedAt);

public record UpdatePlatformSettingsRequest(
    string? BrevoApiKey,
    string? BrevoSenderEmail,
    string? BrevoSenderName,
    string? SupportEmail,
    string? AppBaseUrl);

public record SendTestEmailRequest(string ToEmail);
public record SendTestEmailResponse(bool Success, string? ErrorMessage);
