using System.Security.Cryptography;
using System.Text;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>
/// AES-256-GCM authenticated encryption για sensitive DB columns.
///
/// Το master key δεν κάθεται σε δίσκο — έρχεται από το Coolify env var
/// <c>DataProtection__MasterKey</c> (min 32 chars, CSPRNG). Από εκεί
/// HKDF-SHA256 παράγει ένα σταθερό 32-byte AES key scoped στο purpose
/// «Kalypsis.EF.Sensitive.v1». Έτσι:
///
///  - Δεν χρειάζεται persistent volume ή on-disk keyring
///  - Ένα leak του MySQL dump ΜΟΝΟ ΤΟΥ δεν αρκεί για decryption
///  - Rotation = καινούριο master key + re-encryption pass (manual)
///
/// Envelope format: nonce(12) || tag(16) || ciphertext(n), base64-encoded.
/// Ο <c>EncryptedStringConverter</c> βάζει επιπλέον το prefix «kx1:» ώστε
/// να διακρίνει legacy plaintext από encrypted πεδία.
/// </summary>
public sealed class SensitiveDataEncryptor
{
    private const int NonceSize = 12;   // AES-GCM standard nonce size
    private const int TagSize = 16;     // AES-GCM 128-bit auth tag

    private readonly byte[] _key;

    public SensitiveDataEncryptor(byte[] key)
    {
        if (key is null) throw new ArgumentNullException(nameof(key));
        if (key.Length != 32)
            throw new ArgumentException("AES-256 απαιτεί 32-byte κλειδί.", nameof(key));
        _key = key;
    }

    /// <summary>
    /// Παράγει sub-key από το master key του env var μέσω HKDF-SHA256.
    /// Το purpose string («Kalypsis.EF.Sensitive.v1») απομονώνει το key
    /// από άλλα uses του ίδιου master key — αν αύριο κρυπτογραφήσουμε
    /// π.χ. attachments, θα χρησιμοποιήσουμε άλλο purpose → άλλο derived
    /// key → cross-purpose leak δεν αποκαλύπτει DB columns.
    /// </summary>
    public static SensitiveDataEncryptor FromMasterKey(string masterKey)
    {
        if (string.IsNullOrWhiteSpace(masterKey))
            throw new ArgumentException("Master key κενό.", nameof(masterKey));
        var ikm = Encoding.UTF8.GetBytes(masterKey);
        var salt = Encoding.UTF8.GetBytes("Kalypsis-DP-Salt-v1");
        var info = Encoding.UTF8.GetBytes("Kalypsis.EF.Sensitive.v1");
        var derived = HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, outputLength: 32, salt, info);
        return new SensitiveDataEncryptor(derived);
    }

    public string Protect(string plaintext)
    {
        var pt = Encoding.UTF8.GetBytes(plaintext);
        var nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);
        var ct = new byte[pt.Length];
        var tag = new byte[TagSize];
        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(nonce, pt, ct, tag);

        var payload = new byte[NonceSize + TagSize + ct.Length];
        Buffer.BlockCopy(nonce, 0, payload, 0, NonceSize);
        Buffer.BlockCopy(tag,   0, payload, NonceSize, TagSize);
        Buffer.BlockCopy(ct,    0, payload, NonceSize + TagSize, ct.Length);
        return Convert.ToBase64String(payload);
    }

    public string Unprotect(string base64Payload)
    {
        var payload = Convert.FromBase64String(base64Payload);
        if (payload.Length < NonceSize + TagSize)
            throw new CryptographicException("Payload μικρότερο από το minimum envelope.");
        var nonce = new byte[NonceSize];
        var tag = new byte[TagSize];
        var ct = new byte[payload.Length - NonceSize - TagSize];
        Buffer.BlockCopy(payload, 0,                         nonce, 0, NonceSize);
        Buffer.BlockCopy(payload, NonceSize,                 tag,   0, TagSize);
        Buffer.BlockCopy(payload, NonceSize + TagSize,       ct,    0, ct.Length);

        var pt = new byte[ct.Length];
        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, ct, tag, pt); // throws CryptographicException on tampering
        return Encoding.UTF8.GetString(pt);
    }
}
