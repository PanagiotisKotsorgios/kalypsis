using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Endpoints that let the frontend request + verify a 6-digit
/// out-of-band code before a destructive PlatformAdmin action fires.
/// Codes email to info@mykalypsis.gr via Brevo. See
/// <see cref="AdminActionChallenge"/> for the threat model.
/// </summary>
[ApiController]
[Route("api/platform/admin-otp")]
[Authorize(Policy = "PlatformAdmin")]
public class AdminOtpController : ControllerBase
{
    private readonly IAdminActionOtpService _otp;
    private readonly ICurrentUser _current;
    public AdminOtpController(IAdminActionOtpService otp, ICurrentUser current)
    { _otp = otp; _current = current; }

    public record RequestBody(string Action, string? Target);
    public record VerifyBody(string Token, string Code);

    /// <summary>Kick off a challenge: server generates + emails a code,
    /// hands back an opaque token the client stores locally. The
    /// PLAINTEXT code is never returned — an attacker inspecting the
    /// browser can't skip the email step.</summary>
    [HttpPost("request")]
    public async Task<ActionResult<object>> RequestChallenge([FromBody] RequestBody body, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        if (string.IsNullOrWhiteSpace(body?.Action))
            throw AppException.Validation("Action is required.");
        try
        {
            var res = await _otp.RequestAsync(body.Action, body.Target, userId, ct);
            return Ok(new {
                token = res.Token,
                expiresAt = res.ExpiresAt,
                emailedTo = res.EmailedTo,
            });
        }
        catch (InvalidOperationException ex)
        {
            throw new AppException("otp_email_failed", ex.Message, 502);
        }
    }

    /// <summary>Verify a submitted 6-digit code for a token. After 5
    /// wrong tries the challenge is permanently locked out. The USER
    /// verifying must be the SAME user who requested — a stolen JWT
    /// on a different session can't verify someone else's challenge.</summary>
    [HttpPost("verify")]
    public async Task<ActionResult<object>> Verify([FromBody] VerifyBody body, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var res = await _otp.VerifyAsync(body?.Token ?? "", body?.Code ?? "", userId, ct);
        if (!res.Verified)
            return Ok(new { verified = false, reason = res.Reason, attemptsRemaining = res.AttemptsRemaining });
        return Ok(new { verified = true, attemptsRemaining = res.AttemptsRemaining });
    }
}
