using Kalypsis.Api.Controllers;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Tests for the ΕΡΜΗΣ key registry + meeting-room + passphrase-wrapped
/// key backup endpoints. Focus: determinism of the meeting-room name
/// derivation, backup upload/download round-trip, tenant isolation on
/// key registry.
/// </summary>
public class ErmesKeysControllerTests
{
    private static ErmesKeysController Ctl(
        Kalypsis.Infrastructure.Persistence.AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        Kalypsis.Application.Abstractions.IDateTimeProvider clock)
        => new(db, current, clock);

    // ── Meeting-room determinism ─────────────────────────────────────

    [Fact]
    public void MeetingRoom_SameThread_SameTenant_SameRoom()
    {
        var tenantId = Guid.NewGuid();
        var threadId = Guid.NewGuid();
        var user = TestScaffold.AgencyStaff(tenantId);
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var ctl = Ctl(db, user, TestScaffold.Clock);
        var a = (ctl.MeetingRoom(threadId).Result as OkObjectResult)!.Value as ErmesKeysController.MeetingDto;
        var b = (ctl.MeetingRoom(threadId).Result as OkObjectResult)!.Value as ErmesKeysController.MeetingDto;
        Assert.NotNull(a); Assert.NotNull(b);
        Assert.Equal(a!.RoomName, b!.RoomName);
        Assert.Equal(a.Url, b.Url);
        Assert.StartsWith("https://meet.jit.si/kalypsis-ermes-", a.Url);
    }

    [Fact]
    public void MeetingRoom_DifferentTenant_DifferentRoom_ForSameThread()
    {
        var threadId = Guid.NewGuid();
        var userA = TestScaffold.AgencyStaff(Guid.NewGuid());
        var userB = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var dbA = TestScaffold.NewDb(userA, TestScaffold.Clock);
        using var dbB = TestScaffold.NewDb(userB, TestScaffold.Clock);
        var roomA = ((Ctl(dbA, userA, TestScaffold.Clock).MeetingRoom(threadId).Result as OkObjectResult)!.Value
            as ErmesKeysController.MeetingDto)!.RoomName;
        var roomB = ((Ctl(dbB, userB, TestScaffold.Clock).MeetingRoom(threadId).Result as OkObjectResult)!.Value
            as ErmesKeysController.MeetingDto)!.RoomName;
        Assert.NotEqual(roomA, roomB);
    }

    [Fact]
    public void MeetingRoom_EmptyThread_Rejects()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var ctl = Ctl(db, user, TestScaffold.Clock);
        var ex = Assert.Throws<AppException>(() => ctl.MeetingRoom(Guid.Empty));
        Assert.Equal(400, ex.StatusCode);
    }

    // ── Backup upload + get ──────────────────────────────────────────

    [Fact]
    public async Task PutBackup_ThenGet_ReturnsSameBlob()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var ctl = Ctl(db, user, TestScaffold.Clock);
        var body = new ErmesKeysController.UploadKeyBackupBody(
            KeyId: Guid.NewGuid().ToString(),
            SaltB64: "AAAAAAAAAAAAAAAAAAAAAA==",   // 16 bytes zeroed
            IvB64:   "AAAAAAAAAAAAAAAA",             // 12 bytes zeroed
            WrappedB64: "AABBCCDDEEFF",
            PublicSpkiB64: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...");

        var putRes = await ctl.PutBackup(body, default);
        var putOk = Assert.IsType<OkObjectResult>(putRes.Result);
        var putDto = Assert.IsType<ErmesKeysController.KeyBackupDto>(putOk.Value);
        Assert.Equal(body.KeyId, putDto.KeyId);

        var getRes = await ctl.GetBackup(default);
        var getOk = Assert.IsType<OkObjectResult>(getRes.Result);
        var getDto = Assert.IsType<ErmesKeysController.KeyBackupDto>(getOk.Value);
        Assert.Equal(body.WrappedB64, getDto.WrappedB64);
        Assert.Equal(body.KeyId, getDto.KeyId);
    }

    [Fact]
    public async Task GetBackup_WithoutAnyBackup_Returns404()
    {
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var ctl = Ctl(db, user, TestScaffold.Clock);
        var res = await ctl.GetBackup(default);
        Assert.IsType<NotFoundResult>(res.Result);
    }

    [Fact]
    public async Task PutBackup_OversizedWrappedKey_Rejects()
    {
        // The controller refuses wrapped blobs > 4000 chars — protects
        // against a rogue client stuffing garbage into the column.
        var user = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        var ctl = Ctl(db, user, TestScaffold.Clock);
        var body = new ErmesKeysController.UploadKeyBackupBody(
            "kid", "salt", "iv", new string('A', 5000), "spki");
        var ex = await Assert.ThrowsAsync<AppException>(() => ctl.PutBackup(body, default));
        Assert.Equal(400, ex.StatusCode);
    }

    // ── Public key tenant isolation ──────────────────────────────────

    [Fact]
    public async Task ForUser_OnlyReturnsKeys_InSameTenant()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var peerInA = Guid.NewGuid();
        var peerInB = Guid.NewGuid();
        var clock = TestScaffold.Clock;

        // Seed both tenants' public keys through separate contexts of
        // the same shared DB.
        var userA = TestScaffold.AgencyStaff(tenantA);
        var userB = TestScaffold.AgencyStaff(tenantB);
        using var dbA = TestScaffold.NewDb(userA, clock, name: "keys-iso-db");
        using var dbB = TestScaffold.NewDb(userB, clock, name: "keys-iso-db");
        dbA.UserPublicKeys.Add(new UserPublicKey
        {
            Id = Guid.NewGuid(), TenantId = tenantA, UserId = peerInA,
            PublicKeySpkiBase64 = "aaaa", KeyId = "kA", CreatedAt = clock.UtcNow,
        });
        dbB.UserPublicKeys.Add(new UserPublicKey
        {
            Id = Guid.NewGuid(), TenantId = tenantB, UserId = peerInB,
            PublicKeySpkiBase64 = "bbbb", KeyId = "kB", CreatedAt = clock.UtcNow,
        });
        await dbA.SaveChangesAsync();
        await dbB.SaveChangesAsync();

        // User in tenant A tries to fetch tenant B's peer key → must
        // come back null (not throw, not return the wrong key).
        var ctlA = Ctl(dbA, userA, clock);
        var res = await ctlA.ForUser(peerInB, default);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        Assert.Null(ok.Value);
    }
}
