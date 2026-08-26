using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.PlatformAdmin;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// GUARDS on WipeAndReseedDemoCommand. A regression here would let a
/// single wrong click delete every user in production — the exact
/// incident we're preventing. These tests fail loudly if either the
/// env-var gate or the typed-confirmation gate stops firing.
///
/// The handler needs several real dependencies (IPasswordHasher,
/// IPackageService) even though we NEVER let it reach the wipe logic
/// — the guards short-circuit before touching anything. We pass tiny
/// dummies for the constructor's benefit and rely on the fact that
/// AppException is thrown before any dependency is used.
/// </summary>
public class WipeAndReseedGuardTests : IDisposable
{
    // Snapshot the process env var + the test-override slot so each test
    // starts clean and finishes clean.
    private readonly string? _originalEnv;
    private readonly string? _originalOverride;

    public WipeAndReseedGuardTests()
    {
        _originalEnv = Environment.GetEnvironmentVariable("KALYPSIS_ALLOW_DEMO_WIPE");
        _originalOverride = WipeAndReseedDemoCommandHandler.AllowedOverrideForTests;
        Environment.SetEnvironmentVariable("KALYPSIS_ALLOW_DEMO_WIPE", null);
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = null;
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable("KALYPSIS_ALLOW_DEMO_WIPE", _originalEnv);
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = _originalOverride;
    }

    private static WipeAndReseedDemoCommandHandler Handler()
    {
        var user = TestScaffold.PlatformAdmin();
        var db = TestScaffold.NewDb(user, TestScaffold.Clock);
        return new WipeAndReseedDemoCommandHandler(
            db, new NoopHasher(), TestScaffold.Clock, new NoopPackages(),
            NullLogger<WipeAndReseedDemoCommandHandler>.Instance);
    }

    // ── ENV VAR GATE ─────────────────────────────────────────────────

    [Fact]
    public async Task Handler_Refuses_WhenEnvFlag_NotSet()
    {
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr", WipeAndReseedConfirmation.RequiredPhrase),
                default));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("wipe_not_permitted", ex.Code);
    }

    [Fact]
    public async Task Handler_Refuses_WhenEnvFlag_IsFalse()
    {
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = "false";
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr", WipeAndReseedConfirmation.RequiredPhrase),
                default));
        Assert.Equal(403, ex.StatusCode);
        Assert.Equal("wipe_not_permitted", ex.Code);
    }

    [Fact]
    public async Task Handler_Refuses_WhenEnvFlag_IsGarbage()
    {
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = "yes-please";
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr", WipeAndReseedConfirmation.RequiredPhrase),
                default));
        Assert.Equal(403, ex.StatusCode);
    }

    // ── CONFIRMATION PHRASE GATE ─────────────────────────────────────

    [Fact]
    public async Task Handler_Refuses_WhenPhrase_Missing()
    {
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = "true";
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr", ConfirmationPhrase: ""),
                default));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal("wipe_confirmation_missing", ex.Code);
    }

    [Fact]
    public async Task Handler_Refuses_WhenPhrase_IsWrong()
    {
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = "true";
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr", ConfirmationPhrase: "yes wipe it"),
                default));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task Handler_Refuses_WhenPhrase_IsCaseMismatched()
    {
        // The comparison is Ordinal (byte-for-byte), not case-insensitive.
        // ΔΙΑΓΡΑΦΩ-ΤΑ-ΠΑΝΤΑ != διαγραφω-τα-παντα → refuse.
        WipeAndReseedDemoCommandHandler.AllowedOverrideForTests = "true";
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            Handler().Handle(
                new WipeAndReseedDemoCommand("admin@x.gr",
                    ConfirmationPhrase: WipeAndReseedConfirmation.RequiredPhrase.ToLowerInvariant()),
                default));
        Assert.Equal(400, ex.StatusCode);
    }

    // ── Confirmation phrase is not empty / trivial ────────────────────

    [Fact]
    public void RequiredPhrase_IsHardToTypeAccidentally()
    {
        // Guardrail on the guardrail: someone could edit
        // WipeAndReseedConfirmation.RequiredPhrase down to "" or "y"
        // and silently break the whole safety story. Assert a minimum
        // length + a distinctive Greek character so that regression
        // trips this test rather than shipping to prod.
        var p = WipeAndReseedConfirmation.RequiredPhrase;
        Assert.True(p.Length >= 10, "Confirmation phrase must be ≥10 chars.");
        Assert.Contains('Δ', p);   // Greek delta — no accidental keyboard-language collision
    }

    // ── Tiny dummies — real implementations would drag in migrations,
    //    hashers, etc. We never reach them; both gates short-circuit. ──

    private sealed class NoopHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string hash) => password == hash;
    }

    private sealed class NoopPackages : IPackageService
    {
        public Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default) => Task.FromResult(true);
        public Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default)
            => Task.FromResult<IReadOnlySet<PackageCode>>(new HashSet<PackageCode>());
        public Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default) => Task.CompletedTask;
        public Task GrantAllDefaultsAsync(Guid tenantId, Guid? enabledByUserId, CancellationToken ct = default) => Task.CompletedTask;
        public void InvalidateCache(Guid tenantId) { }
    }
}
