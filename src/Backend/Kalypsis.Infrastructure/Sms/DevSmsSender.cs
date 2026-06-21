using Kalypsis.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Sms;

/// <summary>
/// Development SMS implementation — logs the message and returns success.
/// Swap with TwilioSmsSender (or similar) in production via DI.
/// </summary>
public class DevSmsSender : ISmsSender
{
    private readonly ILogger<DevSmsSender> _log;
    public DevSmsSender(ILogger<DevSmsSender> log) => _log = log;

    public Task<SmsResult> SendAsync(SmsMessage message, CancellationToken cancellationToken = default)
    {
        _log.LogInformation("[DEV SMS] to={Phone} body={Body}", message.ToPhone, message.Body);
        return Task.FromResult(new SmsResult(true));
    }

    public Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
}
