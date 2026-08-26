using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Tests;

/// <summary>
/// Shared scaffolding for tests that need an <see cref="AppDbContext"/>,
/// an <see cref="ICurrentUser"/>, and a fixed clock. Each test gets a
/// FRESH in-memory EF Core database — no cross-test bleed. The database
/// name is randomised per call so parallel tests don't collide.
///
/// SensitiveDataEncryptor is bootstrapped once per process with a
/// deterministic test master key. That's enough to exercise the
/// encrypted-string converters and the ProtectBytes / UnprotectBytes
/// blob path without touching the real production key.
/// </summary>
public static class TestScaffold
{
    private static readonly object _initLock = new();
    private static bool _encryptorBooted;

    /// <summary>Ensure the process-wide SensitiveDataEncryptor is
    /// primed with a deterministic test key. Idempotent + thread-safe.</summary>
    public static void EnsureEncryptorBooted()
    {
        if (_encryptorBooted) return;
        lock (_initLock)
        {
            if (_encryptorBooted) return;
            var enc = SensitiveDataEncryptor.FromMasterKey(
                "kalypsis-tests-master-key-deterministic-do-not-use-in-prod");
            EncryptedStringConverter.Bootstrap(enc);
            SensitiveDataEncryptor.SetInstance(enc);
            _encryptorBooted = true;
        }
    }

    public static AppDbContext NewDb(ICurrentUser current, IDateTimeProvider clock, string? name = null)
    {
        EnsureEncryptorBooted();
        var opts = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name ?? Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(opts, current, clock);
    }

    public static FakeUser AgencyStaff(Guid tenantId, Guid? userId = null, Role role = Role.AgencyAdmin)
        => new(userId ?? Guid.NewGuid(), tenantId, role, isPlatform: false, isImpersonating: false);

    public static FakeUser PlatformAdmin(Guid? userId = null)
        => new(userId ?? Guid.NewGuid(), TenantId: null, Role.PlatformAdmin, isPlatform: true, isImpersonating: false);

    public static FixedClock ClockAt(DateTime instant) => new(instant);
    public static FixedClock Clock => new(new DateTime(2026, 8, 26, 12, 0, 0, DateTimeKind.Utc));
}

/// <summary>Stand-in for <see cref="ICurrentUser"/> — pass whatever
/// tenant / user / role you need for the test in question.</summary>
public sealed record FakeUser(
    Guid? UserId, Guid? TenantId, Role? Role, bool isPlatform, bool isImpersonating) : ICurrentUser
{
    public string? Email => "test@example.com";
    public bool IsAuthenticated => UserId is not null;
    public bool IsPlatformLevel => isPlatform;
    public bool IsImpersonating => isImpersonating;
}

public sealed class FixedClock : IDateTimeProvider
{
    public FixedClock(DateTime instant) { UtcNow = instant; }
    public DateTime UtcNow { get; set; }
}
