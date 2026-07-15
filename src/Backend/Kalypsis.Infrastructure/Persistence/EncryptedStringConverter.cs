using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>
/// EF Core ValueConverter που κρυπτογραφεί strings on-write με AES-256-GCM
/// (μέσω <see cref="SensitiveDataEncryptor"/>) και τα αποκρυπτογραφεί on-read.
/// Το master key έρχεται από το Coolify env var <c>DataProtection__MasterKey</c>
/// — καμία εξάρτηση σε on-disk keyring.
///
/// Ανθεκτικό σε:
///   - Legacy plaintext values (γραμμένα πριν ενεργοποιηθεί το encryption):
///     αναγνωρίζονται από την απουσία του "kx1:" prefix και επιστρέφονται
///     ως έχουν. Την πρώτη φορά που θα ξαναγραφτεί η γραμμή, θα σωθεί
///     κρυπτογραφημένη (self-healing).
///   - Missing bootstrap (π.χ. design-time / EF migrations tooling χωρίς
///     host): γίνεται passthrough. Στο production το Program.cs refuses to
///     boot αν λείπει το master key, οπότε αυτό συμβαίνει μόνο σε tooling.
///   - Decryption failure (tampered ciphertext, wrong master key, corruption):
///     επιστρέφει το raw ciphertext αντί να πετάξει — καλύτερο ένα «γίνεται
///     ορατή η στήλη ως κρυπτογραφημένη» από «κρασάρει όλο το page».
/// </summary>
public sealed class EncryptedStringConverter : ValueConverter<string, string>
{
    private static SensitiveDataEncryptor? _encryptor;
    private const string Marker = "kx1:";

    public EncryptedStringConverter() : base(
        v => Protect(v),
        v => Unprotect(v))
    { }

    /// <summary>
    /// Καλείται μία φορά από <c>Program.cs</c> μετά το <c>app.Build()</c>
    /// με τον resolved <see cref="SensitiveDataEncryptor"/>. Πρέπει να τρέξει
    /// πριν φορτωθεί οποιοδήποτε DbContext ώστε οι converters να έχουν key.
    /// </summary>
    public static void Bootstrap(SensitiveDataEncryptor encryptor) => _encryptor = encryptor;

    private static string Protect(string v)
    {
        if (_encryptor is null) return v;
        if (string.IsNullOrEmpty(v)) return v;
        if (v.StartsWith(Marker, StringComparison.Ordinal)) return v; // ήδη κρυπτογραφημένο
        return Marker + _encryptor.Protect(v);
    }

    private static string Unprotect(string v)
    {
        if (_encryptor is null) return v;
        if (string.IsNullOrEmpty(v)) return v;
        if (!v.StartsWith(Marker, StringComparison.Ordinal)) return v; // legacy plaintext
        try { return _encryptor.Unprotect(v[Marker.Length..]); }
        catch { return v; }
    }
}
