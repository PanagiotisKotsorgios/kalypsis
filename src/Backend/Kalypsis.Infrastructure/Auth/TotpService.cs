using System.Security.Cryptography;
using System.Text;
using Kalypsis.Application.Abstractions;

namespace Kalypsis.Infrastructure.Auth;

/// <summary>
/// RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s window). No third-party library required.
/// Compatible with Google Authenticator, Aegis, 1Password, etc.
/// </summary>
public class TotpService : ITotpService
{
    private const int Step = 30;
    private const int Digits = 6;

    public string GenerateSecret()
    {
        var bytes = new byte[20];
        RandomNumberGenerator.Fill(bytes);
        return Base32Encode(bytes);
    }

    public string BuildOtpAuthUri(string base32Secret, string issuer, string accountLabel)
    {
        var safeIssuer = Uri.EscapeDataString(issuer);
        var safeAccount = Uri.EscapeDataString(accountLabel);
        return $"otpauth://totp/{safeIssuer}:{safeAccount}?secret={base32Secret}&issuer={safeIssuer}&digits={Digits}&period={Step}";
    }

    public bool VerifyCode(string base32Secret, string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        if (!int.TryParse(code, out var typed)) return false;

        var key = Base32Decode(base32Secret);
        var unix = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var step = unix / Step;

        for (var skew = -1; skew <= 1; skew++)
        {
            if (Generate(key, step + skew) == typed) return true;
        }
        return false;
    }

    public IReadOnlyList<(string Plain, string Hash)> GenerateRecoveryCodes(int count = 10)
    {
        var list = new List<(string, string)>(count);
        for (var i = 0; i < count; i++)
        {
            var raw = new byte[5];
            RandomNumberGenerator.Fill(raw);
            var plain = Convert.ToHexString(raw).ToLowerInvariant(); // 10 hex chars
            list.Add((plain, Hash(plain)));
        }
        return list;
    }

    public bool VerifyRecoveryCode(string typedCode, string storedHash) =>
        FixedTimeEquals(Hash(typedCode.Trim().ToLowerInvariant()), storedHash);

    private static int Generate(byte[] key, long step)
    {
        var counter = BitConverter.GetBytes(step);
        if (BitConverter.IsLittleEndian) Array.Reverse(counter);
        using var hmac = new HMACSHA1(key);
        var hash = hmac.ComputeHash(counter);
        var offset = hash[^1] & 0x0F;
        var binary = (hash[offset] & 0x7F) << 24
                   | (hash[offset + 1] & 0xFF) << 16
                   | (hash[offset + 2] & 0xFF) << 8
                   | (hash[offset + 3] & 0xFF);
        var mod = (int)Math.Pow(10, Digits);
        return binary % mod;
    }

    private static string Hash(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private static string Base32Encode(byte[] data)
    {
        var sb = new StringBuilder();
        int bits = 0, value = 0;
        foreach (var b in data)
        {
            value = (value << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                bits -= 5;
                sb.Append(Alphabet[(value >> bits) & 0x1F]);
            }
        }
        if (bits > 0) sb.Append(Alphabet[(value << (5 - bits)) & 0x1F]);
        return sb.ToString();
    }

    private static byte[] Base32Decode(string s)
    {
        s = s.TrimEnd('=').ToUpperInvariant();
        var output = new List<byte>(s.Length * 5 / 8);
        int bits = 0, value = 0;
        foreach (var c in s)
        {
            var i = Alphabet.IndexOf(c);
            if (i < 0) continue;
            value = (value << 5) | i;
            bits += 5;
            if (bits >= 8)
            {
                bits -= 8;
                output.Add((byte)((value >> bits) & 0xFF));
            }
        }
        return output.ToArray();
    }
}
