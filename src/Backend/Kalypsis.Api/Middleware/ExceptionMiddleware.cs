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
        // Tenant-boundary violation from the SaveChanges guard in AppDbContext.
        // We log loudly (this should never happen in legitimate flows) and
        // respond with 403 + a generic message so an attacker probing for
        // cross-tenant writes can't infer schema details from the error.
        catch (InvalidOperationException ex) when (ex.Message.StartsWith("Cross-tenant", StringComparison.Ordinal))
        {
            _logger.LogError(ex, "Cross-tenant write blocked");
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
            {
                code = "forbidden",
                message = "Δεν επιτρέπεται η ενέργεια.",
                severity = "error"
            }));
        }
        // Missing files on disk (deleted/never-uploaded/legacy paths) shouldn't 500.
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            _logger.LogWarning(ex, "Storage file missing — {Message}", ex.Message);
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = "storage_missing",
                message = "Το αρχείο δεν είναι πλέον διαθέσιμο.",
                title = "Αρχείο μη διαθέσιμο",
                why = "Το αρχείο που ζητήσατε δεν βρέθηκε στον αποθηκευτικό χώρο. Πιθανώς έχει διαγραφεί ή δεν ανέβηκε ποτέ.",
                fix = "Αν χρειάζεστε αυτό το αρχείο, επικοινωνήστε με την υποστήριξη.",
                severity = "warning"
            }));
        }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status400BadRequest)
        {
            _logger.LogWarning(ex, "Bad HTTP request");
            ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = "bad_request",
                message = "Λανθασμένο αίτημα.",
                title = "Λάθος αίτημα",
                why = ex.Message,
                severity = "warning"
            }));
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // Client closed the connection; nothing to do.
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
