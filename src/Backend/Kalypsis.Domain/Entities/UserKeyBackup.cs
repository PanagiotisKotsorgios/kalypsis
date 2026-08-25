using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Passphrase-wrapped backup of a user's ΕΡΜΗΣ private key. Stored so the
/// user can recover on a new device / after clearing browser data without
/// losing access to all past E2E-encrypted messages.
///
/// The server holds only ciphertext + the PBKDF2 salt + IV. The passphrase
/// is never sent — the KEK is derived client-side and used to unwrap the
/// PKCS8-exported private key in the browser. Compromising this row alone
/// buys an attacker nothing without also brute-forcing the passphrase.
/// </summary>
public class UserKeyBackup : TenantEntity
{
    public Guid UserId { get; set; }
    /// <summary>The keyId this backup corresponds to — matches
    /// <see cref="UserPublicKey.KeyId"/>. Lets a user hold multiple
    /// historical backups if they've rotated keys.</summary>
    public string KeyId { get; set; } = "";
    /// <summary>PBKDF2 salt, base64. 16 bytes.</summary>
    public string SaltB64 { get; set; } = "";
    /// <summary>AES-GCM IV, base64. 12 bytes.</summary>
    public string IvB64 { get; set; } = "";
    /// <summary>The wrapped (encrypted) PKCS8 private key, base64.</summary>
    public string WrappedB64 { get; set; } = "";
    /// <summary>The matching SPKI public key, base64. Kept alongside so
    /// restore can rebuild the full keypair without another server hit.</summary>
    public string PublicSpkiB64 { get; set; } = "";
    /// <summary>KDF params — recorded so we can rotate parameters in
    /// future without breaking old backups.</summary>
    public string KdfName { get; set; } = "PBKDF2-SHA256";
    public int KdfIterations { get; set; } = 200_000;
}
