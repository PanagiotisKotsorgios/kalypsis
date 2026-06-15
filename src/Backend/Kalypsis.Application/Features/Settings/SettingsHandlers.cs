using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Settings;

public record GetPlatformSettingsQuery() : IRequest<PlatformSettingsDto>;

public class GetPlatformSettingsQueryHandler : IRequestHandler<GetPlatformSettingsQuery, PlatformSettingsDto>
{
    private readonly IAppDbContext _db;
    public GetPlatformSettingsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<PlatformSettingsDto> Handle(GetPlatformSettingsQuery request, CancellationToken cancellationToken)
    {
        var s = await _db.PlatformSettings
            .IgnoreQueryFilters()
            .OrderBy(x => x.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (s is null) return new PlatformSettingsDto(null, false, null, null, null, null, null);

        var masked = string.IsNullOrEmpty(s.BrevoApiKey)
            ? null
            : s.BrevoApiKey.Length <= 8
                ? new string('•', s.BrevoApiKey.Length)
                : $"{s.BrevoApiKey[..4]}{new string('•', s.BrevoApiKey.Length - 8)}{s.BrevoApiKey[^4..]}";

        return new PlatformSettingsDto(
            masked,
            !string.IsNullOrWhiteSpace(s.BrevoApiKey),
            s.BrevoSenderEmail,
            s.BrevoSenderName,
            s.SupportEmail,
            s.AppBaseUrl,
            s.UpdatedAt);
    }
}

public record UpdatePlatformSettingsCommand(UpdatePlatformSettingsRequest Request) : IRequest<PlatformSettingsDto>;

public class UpdatePlatformSettingsCommandValidator : AbstractValidator<UpdatePlatformSettingsCommand>
{
    public UpdatePlatformSettingsCommandValidator()
    {
        When(x => !string.IsNullOrWhiteSpace(x.Request.BrevoSenderEmail), () =>
            RuleFor(x => x.Request.BrevoSenderEmail!).EmailAddress());
        When(x => !string.IsNullOrWhiteSpace(x.Request.SupportEmail), () =>
            RuleFor(x => x.Request.SupportEmail!).EmailAddress());
    }
}

public class UpdatePlatformSettingsCommandHandler : IRequestHandler<UpdatePlatformSettingsCommand, PlatformSettingsDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdatePlatformSettingsCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PlatformSettingsDto> Handle(UpdatePlatformSettingsCommand request, CancellationToken cancellationToken)
    {
        var r = request.Request;
        var existing = await _db.PlatformSettings
            .IgnoreQueryFilters()
            .OrderBy(s => s.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            existing = new PlatformSetting { Id = Guid.NewGuid() };
            _db.PlatformSettings.Add(existing);
        }

        // Empty BrevoApiKey means "keep current"; "" string means "clear" — distinguish via null vs empty.
        if (r.BrevoApiKey is not null)
            existing.BrevoApiKey = string.IsNullOrWhiteSpace(r.BrevoApiKey) ? null : r.BrevoApiKey.Trim();

        existing.BrevoSenderEmail = string.IsNullOrWhiteSpace(r.BrevoSenderEmail) ? null : r.BrevoSenderEmail.Trim().ToLowerInvariant();
        existing.BrevoSenderName = string.IsNullOrWhiteSpace(r.BrevoSenderName) ? null : r.BrevoSenderName.Trim();
        existing.SupportEmail = string.IsNullOrWhiteSpace(r.SupportEmail) ? null : r.SupportEmail.Trim().ToLowerInvariant();
        existing.AppBaseUrl = string.IsNullOrWhiteSpace(r.AppBaseUrl) ? null : r.AppBaseUrl.Trim().TrimEnd('/');
        existing.LastUpdatedByUserId = _currentUser.UserId;

        await _db.SaveChangesAsync(cancellationToken);

        return await new GetPlatformSettingsQueryHandler(_db).Handle(new GetPlatformSettingsQuery(), cancellationToken);
    }
}

public record SendTestEmailCommand(string ToEmail) : IRequest<SendTestEmailResponse>;

public class SendTestEmailCommandHandler : IRequestHandler<SendTestEmailCommand, SendTestEmailResponse>
{
    private readonly IEmailSender _email;
    public SendTestEmailCommandHandler(IEmailSender email) => _email = email;

    public async Task<SendTestEmailResponse> Handle(SendTestEmailCommand request, CancellationToken cancellationToken)
    {
        var html = @"<p>Αυτό είναι test email από την πλατφόρμα <strong>Kalypsis</strong>.</p>
<p>Αν το λαμβάνετε, οι ρυθμίσεις Brevo είναι σωστές. ✅</p>";
        var result = await _email.SendAsync(new EmailMessage(
            request.ToEmail, "Kalypsis Test", "Kalypsis — Test email", html), cancellationToken);
        return new SendTestEmailResponse(result.Success, result.ErrorMessage);
    }
}
