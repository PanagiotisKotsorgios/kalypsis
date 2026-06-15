namespace Kalypsis.Application.Common;

public class AppException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }

    public AppException(string code, string message, int statusCode = 400) : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    public static AppException NotFound(string what) => new("not_found", $"{what} δεν βρέθηκε.", 404);
    public static AppException Unauthorized(string message = "Μη εξουσιοδοτημένη πρόσβαση.") => new("unauthorized", message, 401);
    public static AppException Forbidden(string message = "Δεν επιτρέπεται η ενέργεια.") => new("forbidden", message, 403);
    public static AppException Conflict(string message) => new("conflict", message, 409);
    public static AppException Validation(string message) => new("validation", message, 400);
}
