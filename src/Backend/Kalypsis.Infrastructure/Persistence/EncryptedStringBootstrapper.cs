using Microsoft.AspNetCore.DataProtection;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>
/// Resolves an <see cref="IDataProtector"/> from DI and hands it to the static
/// <see cref="EncryptedStringConverter"/>. Καλείται μία φορά μετά το
/// <c>app.Build()</c> στο Program.cs — ΠΡΙΝ τον πρώτο DbContext access — ώστε
/// οι converters στο <c>OnModelCreating</c> να έχουν έγκυρο protector.
///
/// Ο purpose string «Kalypsis.EF.Sensitive» απομονώνει τα κρυπτογραφημένα
/// column values από τυχόν άλλα uses του DataProtection (π.χ. auth cookies)
/// — αν κάποιος διαρρεύσει το κλειδί, δεν μπορεί να decrypt cross-purpose.
/// </summary>
public sealed class EncryptedStringBootstrapper
{
    private readonly IDataProtectionProvider _provider;

    public EncryptedStringBootstrapper(IDataProtectionProvider provider) => _provider = provider;

    public void Initialize() =>
        EncryptedStringConverter.Bootstrap(_provider.CreateProtector("Kalypsis.EF.Sensitive.v1"));
}
