using System.Text.Json;
using FluentValidation;
using Kalypsis.Application.Common;

namespace Kalypsis.Api.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (ValidationException ex)
        {
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            ctx.Response.ContentType = "application/json";
            var errors = ex.Errors.GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = "validation",
                message = "Σφάλμα επικύρωσης δεδομένων.",
                errors
            }));
        }
        catch (AppException ex)
        {
            ctx.Response.StatusCode = ex.StatusCode;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = ex.Code,
                message = ex.Message,
                title = ex.Title,
                why = ex.WhyText,
                fix = ex.FixText,
                fixLink = ex.FixLink,
                severity = ex.Severity
            }, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = "internal_error",
                message = "Παρουσιάστηκε εσωτερικό σφάλμα.",
                title = "Απρόσμενο σφάλμα",
                why = "Κάτι πήγε στραβά στον διακομιστή. Δεν φταίτε εσείς.",
                fix = "Δοκιμάστε ξανά σε λίγο. Αν το πρόβλημα επιμένει, επικοινωνήστε με την υποστήριξη με το ακριβές μήνυμα που βλέπετε.",
                severity = "error"
            }));
        }
    }
}
