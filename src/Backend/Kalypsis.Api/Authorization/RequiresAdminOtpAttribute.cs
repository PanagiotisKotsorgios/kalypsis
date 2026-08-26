using Kalypsis.Application.Abstractions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Kalypsis.Api.Authorization;

/// <summary>
/// Guards a destructive action with an out-of-band 6-digit code. Client
/// must FIRST hit POST /api/platform/admin-otp/request with the action
/// name (+ optional target), receive a token, ask the operator to type
/// the code emailed to info@mykalypsis.gr, POST /verify, THEN retry
/// the destructive endpoint with an <c>X-Admin-OTP-Token</c> header
/// carrying the verified token.
///
/// The filter CONSUMES the token — a used token cannot be replayed for
/// a second destructive call. If the caller wants to delete two things
/// they need two separate challenges.
///
/// Target matching: pass a per-request target descriptor (e.g. the
/// resource id) via <c>TargetFromRoute</c> or <c>TargetFromBody</c> so
/// that a code issued for resource A can never be used to destroy
/// resource B. Set both to null for actions that scope over the whole
/// platform (e.g. wipe-all).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequiresAdminOtpAttribute : Attribute, IAsyncAuthorizationFilter
{
    public string Action { get; }
    /// <summary>Name of a route parameter to use as the target
    /// discriminator (e.g. "id"). Preferred — the route id is
    /// tamper-proof, whereas a body parameter can be swapped mid-flight.</summary>
    public string? TargetFromRoute { get; init; }

    public RequiresAdminOtpAttribute(string action) => Action = action;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var sp = context.HttpContext.RequestServices;
        var otp = sp.GetRequiredService<IAdminActionOtpService>();
        var current = sp.GetRequiredService<ICurrentUser>();

        if (!current.IsAuthenticated || current.UserId is null)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var token = context.HttpContext.Request.Headers["X-Admin-OTP-Token"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            context.Result = new ObjectResult(new
            {
                code = "otp_required",
                message = "Απαιτείται 6-ψήφια επιβεβαίωση από τον κωδικό που στάλθηκε στο info@mykalypsis.gr.",
                action = Action,
            }) { StatusCode = 428 };
            return;
        }

        // Resolve target discriminator. Route id is the trustworthy path
        // — matches the URL the caller actually hits. Body-derived
        // targets would let a caller send a challenge for id X and use
        // it on id Y by swapping the body — rejected by design.
        string? target = null;
        if (!string.IsNullOrEmpty(TargetFromRoute)
            && context.RouteData.Values.TryGetValue(TargetFromRoute, out var v)
            && v is not null)
            target = v.ToString();

        var consumed = await otp.ConsumeAsync(token, Action, target,
            current.UserId.Value, context.HttpContext.RequestAborted);
        if (!consumed)
        {
            context.Result = new ObjectResult(new
            {
                code = "otp_invalid_or_used",
                message = "Ο κωδικός δεν είναι πλέον έγκυρος. Ζητήστε νέο.",
                action = Action,
            }) { StatusCode = 401 };
        }
    }
}
