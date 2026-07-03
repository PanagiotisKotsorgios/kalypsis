using Kalypsis.Application.Features.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    public AuthController(IMediator mediator) => _mediator = mediator;

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new LoginCommand(
            request.Email,
            request.Password,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString()), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Mobile app entry point. Only Role.Customer accounts can authenticate here —
    /// any other role gets a 403, even with correct credentials.
    /// </summary>
    [HttpPost("mobile/login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> MobileLogin([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new MobileLoginCommand(request.Email, request.Password), cancellationToken);
        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthenticatedUserDto>> Me(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetCurrentUserQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? body, CancellationToken ct)
    {
        // Best-effort: revoke the presented refresh token so it can't be reused.
        // The access token can't be invalidated client-side (it's stateless JWT)
        // but it will expire quickly and any refresh attempt is now dead.
        Guid? userId = null;
        if (Guid.TryParse(User.FindFirst("sub")?.Value, out var u)) userId = u;
        await _mediator.Send(new LogoutCommand(body?.RefreshToken, userId), ct);
        return Ok(new { ok = true });
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> Refresh(
        [FromBody] RefreshTokenRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new RefreshTokenCommand(request.RefreshToken), ct);
        return Ok(result);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _mediator.Send(new ForgotPasswordCommand(request.Email, ip), cancellationToken);
        return Ok(result);
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("password-reset")]
    public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new ResetPasswordCommand(request.Token, request.NewPassword), cancellationToken);
        return Ok(result);
    }

    // Second leg of the 2FA login flow. /auth/login returns a challenge token
    // when 2FA is enabled; the client posts that + the TOTP / recovery code
    // here to exchange it for real session tokens.
    [HttpPost("2fa/login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> CompleteTwoFactorLogin(
        [FromBody] CompleteTwoFactorLoginRequest request,
        CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _mediator.Send(
            new CompleteTwoFactorLoginCommand(request.ChallengeToken, request.Code, ip, ua), ct);
        return Ok(result);
    }

    public record EmailCodeLoginRequest(string ChallengeToken, string Code);

    /// <summary>Second leg of the email-code login flow. See LoginCommand for details.</summary>
    [HttpPost("email-code-login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> CompleteEmailCodeLogin(
        [FromBody] EmailCodeLoginRequest request,
        CancellationToken ct)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers.UserAgent.ToString();
        var result = await _mediator.Send(
            new CompleteEmailCodeLoginCommand(request.ChallengeToken, request.Code, ip, ua), ct);
        return Ok(result);
    }
}
