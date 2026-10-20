using System.Text.RegularExpressions;

namespace Kalypsis.Application.Common;

/// <summary>Input format checks, not proof that a number, tax ID or mailbox exists.</summary>
public static class ContactValueRules
{
    public static string? Error(string field, string? raw)
    {
        var value = raw?.Trim() ?? "";
        if (value.Length == 0) return null; // Requiredness belongs to the particular form.
        switch (field.ToLowerInvariant())
        {
            case "phone": case "altphone": case "thirdphone": case "mobilephone": case "secondarymobilephone":
                if (!Phone(value)) return "Συμπληρώστε τηλέφωνο με 10 ψηφία ή διεθνή αριθμό με + / 00 και έως 15 ψηφία. Δεν επιτρέπονται γράμματα.";
                break;
            case "email": case "secondaryemail":
                if (!Email(value))
                    return "Συμπληρώστε έγκυρο email, π.χ. onoma@example.gr (έως 254 χαρακτήρες).";
                break;
            case "vatnumber":
                if (!Regex.IsMatch(value, @"^[0-9]{9}$")) return "Το ΑΦΜ πρέπει να περιέχει ακριβώς 9 ψηφία, χωρίς γράμματα ή κενά.";
                break;
            case "amka":
                if (!Regex.IsMatch(value, @"^[0-9]{11}$")) return "Ο ΑΜΚΑ πρέπει να περιέχει ακριβώς 11 ψηφία.";
                break;
            case "postalcode":
                if (!Regex.IsMatch(value, @"^[0-9]{3}\s?[0-9]{2}$")) return "Ο ταχυδρομικός κώδικας πρέπει να περιέχει 5 ψηφία.";
                break;
            case "photourl":
                if (value.Length > 500 || !Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
                    return "Συμπληρώστε πλήρες URL φωτογραφίας που ξεκινά με https:// ή http:// (έως 500 χαρακτήρες).";
                break;
        }
        return null;
    }

    private static bool Phone(string value)
    {
        if (value.Length > 40 || !Regex.IsMatch(value, @"^\+?[0-9 ()\-]+$")) return false;
        var compact = Regex.Replace(value, @"[ ()\-]", "");
        if (compact.StartsWith("00", StringComparison.Ordinal)) compact = "+" + compact[2..];
        if (!compact.StartsWith('+')) return Regex.IsMatch(compact, @"^[0-9]{10}$");
        if (!Regex.IsMatch(compact, @"^\+[1-9][0-9]{6,14}$")) return false;
        return !compact.StartsWith("+30", StringComparison.Ordinal) || compact.Length == 13;
    }

    private static bool Email(string value)
    {
        var separator = value.IndexOf('@');
        if (value.Length > 254 || separator is < 1 or > 64) return false;
        var local = value[..separator];
        if (local.StartsWith('.') || local.EndsWith('.') || local.Contains("..", StringComparison.Ordinal)) return false;
        return Regex.IsMatch(value, @"^[^\s@<>()\[\]:;,""\\]+@[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+$", RegexOptions.CultureInvariant);
    }

    public static void Ensure(string field, string? value, string? previous = null, bool changedOnly = false)
    {
        if (changedOnly && string.Equals(value?.Trim(), previous?.Trim(), StringComparison.Ordinal)) return;
        if (Error(field, value) is { } error) throw AppException.Validation(error);
    }
}
