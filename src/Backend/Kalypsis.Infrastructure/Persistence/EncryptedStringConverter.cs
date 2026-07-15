using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>
/// EF Core ValueConverter που κρυπτογραφεί strings on-write με ASP.NET
/// DataProtection (AES-256-GCM + HMAC-SHA256, κλειδί από PersistKeysToFileSystem)
/// και τα αποκρυπτογραφεί on-read.
///
/// Ανθεκτικό σε:
///   - Legacy plaintext values (γραμμένα πριν ενεργοποιηθεί το encryption):
///     αναγνωρίζονται από την απουσία του "kx1:" prefix και επιστρέφονται
///     ως έχουν. Την πρώτη φορά που θα ξαναγραφτεί η γραμμή, θα σωθεί
///     κρυπτογραφημένη (self-healing).
///   - Missing bootstrap (π.χ. design-time / migration tooling χωρίς host):
///     αν ο protector δεν έχει αρχικοποιηθεί, γίνεται passthrough.
///   - Decryption failure (rotation χωρίς backward key, corruption):
///     επιστρέφει το raw ciphertext αντί να πετάξει — καλύτερο ένα «γίνεται
///     ορατή η στήλη ως κρυπτογραφημένη» από «κρασάρει όλο το page».
/// </summary>
public sealed class EncryptedStringConverter : ValueConverter<string, string>
{
    private static IDataProtector? _protector;
    private const string Marker = "kx1:";

    public EncryptedStringConverter() : base(
        v => Protect(v),
        v => Unprotect(v))
    { }

    /// <summary>
    /// Καλείται μία φορά από <c>DependencyInjection.AddInfrastructure</c> με
    /// τον resolved <see cref="IDataProtector"/>. Πρέπει να τρέξει πριν
    /// φορτωθεί οποιοδήποτε DbContext ώστε οι converters να έχουν key.
    /// </summary>
    public static void Bootstrap(IDataProtector protector) => _protector = protector;

    private static string Protect(string v)
    {
        if (_protector is null) return v;
        if (string.IsNullOrEmpty(v)) return v;
        if (v.StartsWith(Marker, StringComparison.Ordinal)) return v; // ήδη κρυπτογραφημένο
        return Marker + _protector.Protect(v);
    }

    private static string Unprotect(string v)
    {
        if (_protector is null) return v;
        if (string.IsNullOrEmpty(v)) return v;
        if (!v.StartsWith(Marker, StringComparison.Ordinal)) return v; // legacy plaintext
        try { return _protector.Unprotect(v[Marker.Length..]); }
        catch { return v; }
    }
}
