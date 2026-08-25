using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Public half of the user's ΕΡΜΗΣ E2E encryption keypair. The private half
/// lives ONLY in the user's browser (IndexedDB) and is never sent to us.
/// Other users fetch this record to encrypt messages for the owner.
///
/// Algorithm is ECDH on P-256 (Web Crypto SubtleCrypto default) — the
/// SPKI-formatted public key is base64-encoded in PublicKeySpkiBase64.
/// KeyId is a client-generated GUID that lets us swap keys on rotation
/// without ambiguity («which key did the sender use to encrypt this?»).
/// </summary>
public class UserPublicKey : TenantEntity
{
    public Guid UserId { get; set; }
    public string Algorithm { get; set; } = "ECDH-P256";
    public string PublicKeySpkiBase64 { get; set; } = "";
    /// <summary>Client-generated key id — travels alongside the ciphertext
    /// so the recipient knows which of their historical private keys to
    /// try. Not a secret.</summary>
    public string KeyId { get; set; } = "";
    public DateTime? RotatedAt { get; set; }
}
