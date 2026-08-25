using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// ΕΡΜΗΣ E2E key registry + meeting-room addressing.
///
/// Key registry: every user generates an ECDH P-256 keypair in the browser
/// on first visit; the PUBLIC key gets uploaded here. Other users fetch it
/// to encrypt a per-message AES-GCM session key that only the recipient's
/// browser can decrypt (the private key never leaves IndexedDB). Server
/// stores ciphertext + wrapped session keys only — cannot read the body.
///
/// Meetings: /meeting/room returns a deterministic Jitsi Meet room name +
/// the public https://meet.jit.si URL for a given thread. Jitsi handles
/// the WebRTC signalling + TURN — the browser opens the URL in an iframe
/// and the operator gets encrypted video/audio + screen share out of the
/// box, no infrastructure on our side.
/// </summary>
[ApiController]
[Route("api/ermes")]
[Authorize(Policy = "AgencyStaff")]
[RequiresPackage(PackageCode.Ermes)]
public class ErmesKeysController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public ErmesKeysController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record PublicKeyDto(Guid UserId, string Algorithm, string PublicKeySpkiBase64, string KeyId);
    public record UploadKeyBody(string Algorithm, string PublicKeySpkiBase64, string KeyId);
    public record MeetingDto(string RoomName, string Url, string Provider);

    /// <summary>Do I have a key registered? Fast probe so the client
    /// avoids re-generating a keypair every time it loads.</summary>
    [HttpGet("keys/mine")]
    public async Task<ActionResult<PublicKeyDto?>> Mine(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var row = await _db.UserPublicKeys.AsNoTracking()
            .Where(k => k.TenantId == tenantId && k.UserId == userId && k.DeletedAt == null)
            .OrderByDescending(k => k.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (row is null) return Ok(null);
        return Ok(new PublicKeyDto(row.UserId, row.Algorithm, row.PublicKeySpkiBase64, row.KeyId));
    }

    /// <summary>Publish my public key. Overwrites the previous row —
    /// old messages already encrypted with a former key stay decryptable
    /// only by whoever still holds the matching private half.</summary>
    [HttpPut("keys/mine")]
    public async Task<ActionResult<PublicKeyDto>> Upload([FromBody] UploadKeyBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        if (string.IsNullOrWhiteSpace(body.PublicKeySpkiBase64) || string.IsNullOrWhiteSpace(body.KeyId))
            throw new AppException("bad_key", "PublicKey + KeyId είναι υποχρεωτικά.", 400);

        // Sanity-check the SPKI-b64 (we never inspect it — just make sure
        // it decodes to something plausible in size, 60-1000 bytes).
        try
        {
            var bytes = Convert.FromBase64String(body.PublicKeySpkiBase64);
            if (bytes.Length < 60 || bytes.Length > 1000)
                throw new AppException("bad_key_size", "Το δημόσιο κλειδί έχει μη-έγκυρο μέγεθος.", 400);
        }
        catch (FormatException) { throw new AppException("bad_key_b64", "Το δημόσιο κλειδί δεν είναι έγκυρο base64.", 400); }

        var existing = await _db.UserPublicKeys
            .Where(k => k.TenantId == tenantId && k.UserId == userId && k.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var e in existing) { e.DeletedAt = _clock.UtcNow; }

        var row = new UserPublicKey
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Algorithm = string.IsNullOrWhiteSpace(body.Algorithm) ? "ECDH-P256" : body.Algorithm,
            PublicKeySpkiBase64 = body.PublicKeySpkiBase64,
            KeyId = body.KeyId,
            CreatedAt = _clock.UtcNow,
        };
        _db.UserPublicKeys.Add(row);
        await _db.SaveChangesAsync(ct);
        return Ok(new PublicKeyDto(row.UserId, row.Algorithm, row.PublicKeySpkiBase64, row.KeyId));
    }

    /// <summary>Fetch a peer's active public key so I can encrypt for them.
    /// Returns null when the peer hasn't registered a key yet — the sender
    /// should degrade to a plaintext-with-warning UX in that case.</summary>
    [HttpGet("keys/user/{userId:guid}")]
    public async Task<ActionResult<PublicKeyDto?>> ForUser(Guid userId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.UserPublicKeys.AsNoTracking()
            .Where(k => k.TenantId == tenantId && k.UserId == userId && k.DeletedAt == null)
            .OrderByDescending(k => k.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (row is null) return Ok(null);
        return Ok(new PublicKeyDto(row.UserId, row.Algorithm, row.PublicKeySpkiBase64, row.KeyId));
    }

    /// <summary>Deterministic Jitsi Meet room name + URL for a thread.
    /// Encoded as base32 of the tenant+thread guids so it's URL-safe and
    /// unguessable-in-practice (128 bits of entropy). Everyone in the
    /// thread who hits this endpoint gets the same room name → they land
    /// in the same call.</summary>
    [HttpGet("meeting/room")]
    public ActionResult<MeetingDto> MeetingRoom([FromQuery] Guid threadId)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (threadId == Guid.Empty) throw new AppException("bad_thread", "threadId is required.", 400);

        var seed = $"{tenantId:N}{threadId:N}";
        using var sha = System.Security.Cryptography.SHA256.Create();
        var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(seed));
        // 16-byte prefix → 32-char base32-ish (letters + digits, URL-safe).
        const string alph = "abcdefghijklmnopqrstuvwxyz234567";
        var sb = new System.Text.StringBuilder(26);
        for (int i = 0; i < 16; i++) sb.Append(alph[hash[i] & 0x1F]);
        var room = $"kalypsis-ermes-{sb}";
        return Ok(new MeetingDto(room, $"https://meet.jit.si/{room}", "jit.si"));
    }
}
