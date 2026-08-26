using System.Security.Cryptography;
using Kalypsis.Infrastructure.Persistence;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Unit tests for the AES-256-GCM encryptor + its byte-blob API. These
/// don't touch a database — they exercise the crypto primitive directly.
/// Cover: round-trip, tamper detection, legacy-plaintext fallback, KEK
/// derivation determinism (HKDF).
/// </summary>
public class SensitiveDataEncryptorTests
{
    private static SensitiveDataEncryptor Enc()
        => SensitiveDataEncryptor.FromMasterKey("test-master-key-of-sufficient-length-for-hkdf");

    // ── String round-trips ──────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("hello world")]
    [InlineData("Ελληνικά με UTF-8 · μηχανογράφιση")]
    [InlineData("VERY LONG " + "PADDING" + "PADDING" + "PADDING")]
    public void ProtectUnprotect_RoundTrips(string plaintext)
    {
        var enc = Enc();
        var wire = enc.Protect(plaintext);
        var back = enc.Unprotect(wire);
        Assert.Equal(plaintext, back);
    }

    [Fact]
    public void Protect_IsNonDeterministic()
    {
        // Two protects of the same plaintext should NEVER match — random nonce.
        var enc = Enc();
        Assert.NotEqual(enc.Protect("same"), enc.Protect("same"));
    }

    [Fact]
    public void Unprotect_TamperedCiphertext_Throws()
    {
        var enc = Enc();
        var wire = enc.Protect("secret");
        // Flip one byte in the ciphertext — GCM auth tag MUST reject.
        var raw = Convert.FromBase64String(wire);
        raw[raw.Length - 1] ^= 0x01;
        var tampered = Convert.ToBase64String(raw);
        Assert.ThrowsAny<CryptographicException>(() => enc.Unprotect(tampered));
    }

    // ── Blob (byte[]) round-trips ────────────────────────────────────

    [Fact]
    public void ProtectBytes_UnprotectBytes_RoundTrips()
    {
        var enc = Enc();
        var plaintext = new byte[10_000];
        new Random(42).NextBytes(plaintext);
        var wire = enc.ProtectBytes(plaintext);
        Assert.NotEqual(plaintext, wire);           // must not equal plaintext
        Assert.True(wire.Length > plaintext.Length); // envelope adds ≥ 29 bytes
        var back = enc.UnprotectBytes(wire);
        Assert.Equal(plaintext, back);
    }

    [Fact]
    public void UnprotectBytes_LegacyPlaintext_PassesThrough()
    {
        // Any byte[] that does NOT start with the magic byte (0x01) is
        // treated as legacy plaintext and returned unchanged. Critical
        // for the rollout — old rows written before at-rest encryption
        // was enabled must still decode.
        var enc = Enc();
        var legacy = new byte[] { 0xFF, 0xAA, 0xBB, 0xCC };
        var back = enc.UnprotectBytes(legacy);
        Assert.Equal(legacy, back);
    }

    [Fact]
    public void UnprotectBytes_EmptyInput_ReturnsEmpty()
    {
        Assert.Equal(Array.Empty<byte>(), Enc().UnprotectBytes(Array.Empty<byte>()));
    }

    [Fact]
    public void UnprotectBytes_TamperedCiphertext_Throws()
    {
        var enc = Enc();
        var wire = enc.ProtectBytes(new byte[] { 1, 2, 3, 4, 5 });
        wire[wire.Length - 1] ^= 0x01;
        Assert.ThrowsAny<CryptographicException>(() => enc.UnprotectBytes(wire));
    }

    // ── Key derivation ───────────────────────────────────────────────

    [Fact]
    public void FromMasterKey_IsDeterministic()
    {
        // HKDF derivation must be stable — otherwise every process
        // restart would break existing ciphertexts. Encrypt with one
        // instance, decrypt with a freshly-derived one.
        var a = SensitiveDataEncryptor.FromMasterKey("stable-master-key");
        var b = SensitiveDataEncryptor.FromMasterKey("stable-master-key");
        var wire = a.Protect("stable");
        Assert.Equal("stable", b.Unprotect(wire));
    }

    [Fact]
    public void FromMasterKey_DifferentMastersDontShareKey()
    {
        var a = SensitiveDataEncryptor.FromMasterKey("master-A");
        var b = SensitiveDataEncryptor.FromMasterKey("master-B");
        var wire = a.Protect("secret");
        Assert.ThrowsAny<CryptographicException>(() => b.Unprotect(wire));
    }
}
