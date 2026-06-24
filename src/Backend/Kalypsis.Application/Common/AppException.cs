namespace Kalypsis.Application.Common;

/// <summary>
/// Rich application-level exception. Carries everything the frontend needs to
/// render a clear popup explaining what went wrong AND where to go to fix it.
///
/// Phase 10.1 extends ALIS's vague "operation failed" popups with:
///   - <see cref="Title"/>     — short Greek headline ("Δεν υπολογίστηκε προμήθεια")
///   - <see cref="Message"/>   — root cause sentence
///   - <see cref="WhyText"/>   — explanation of *why* this happened (often the
///                              missing configuration / data dependency)
///   - <see cref="FixText"/>   — actionable step-by-step instruction
///   - <see cref="FixLink"/>   — deep-link to the page that fixes it
///   - <see cref="Severity"/>  — error / warning / info — drives popup color
/// </summary>
public class AppException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public string? Title { get; }
    public string? WhyText { get; }
    public string? FixText { get; }
    public string? FixLink { get; }
    public string Severity { get; }     // error / warning / info

    public AppException(
        string code,
        string message,
        int statusCode = 400,
        string? title = null,
        string? why = null,
        string? fix = null,
        string? fixLink = null,
        string severity = "error") : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Title = title;
        WhyText = why;
        FixText = fix;
        FixLink = fixLink;
        Severity = severity;
    }

    public static AppException NotFound(string what) => new("not_found", $"{what} δεν βρέθηκε.", 404,
        title: "Δεν βρέθηκε",
        why: $"Το {what} που ζητήσατε δεν υπάρχει στη βάση ή έχει διαγραφεί.",
        fix: "Επιστρέψτε στη λίστα και ξανα-επιλέξτε.");

    public static AppException Unauthorized(string message = "Μη εξουσιοδοτημένη πρόσβαση.") =>
        new("unauthorized", message, 401, title: "Απαιτείται σύνδεση",
            why: "Η συνεδρία σας έληξε ή δεν είστε συνδεδεμένοι.",
            fix: "Συνδεθείτε ξανά για να συνεχίσετε.",
            fixLink: "/login");

    public static AppException Forbidden(string message = "Δεν επιτρέπεται η ενέργεια.") =>
        new("forbidden", message, 403, title: "Δεν επιτρέπεται",
            why: "Ο ρόλος ή το πακέτο σας δεν περιλαμβάνει αυτή τη λειτουργία.",
            fix: "Επικοινωνήστε με τον διαχειριστή της πλατφόρμας.");

    public static AppException Conflict(string message) => new("conflict", message, 409,
        title: "Σύγκρουση",
        why: "Η ενέργεια θα δημιουργούσε διπλή εγγραφή ή θα παραβίαζε έναν κανόνα ακεραιότητας.",
        fix: "Ελέγξτε τα δεδομένα και ξαναπροσπαθήστε.");

    public static AppException Validation(string message) => new("validation", message, 400,
        title: "Μη έγκυρα δεδομένα", why: "Κάποιο πεδίο δεν συμπληρώθηκε σωστά ή λείπει.",
        fix: "Ελέγξτε τα κόκκινα πεδία της φόρμας και διορθώστε.");

    /// <summary>
    /// Specifically for the "commission = 0" type of confusing ALIS error —
    /// explains which configuration is missing and links to it.
    /// </summary>
    public static AppException MissingConfiguration(string what, string fixWhere, string fixLink)
        => new("missing_configuration",
            $"Λείπει η παραμετροποίηση: {what}",
            400,
            title: "Λείπει παραμετροποίηση",
            why: $"Δεν έχετε ορίσει τιμή για: {what}. Χωρίς αυτή την παραμετροποίηση δεν είναι δυνατός ο υπολογισμός.",
            fix: $"Μεταβείτε στο «{fixWhere}» και συμπληρώστε τις τιμές. Μετά επανυπολογίστε αυτή την εγγραφή.",
            fixLink: fixLink,
            severity: "warning");
}
