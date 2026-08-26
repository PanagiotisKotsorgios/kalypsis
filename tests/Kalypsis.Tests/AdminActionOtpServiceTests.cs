using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Kalypsis.Tests;

/// <summary>
/// Tests for the OTP challenge service that gates every destructive
/// PlatformAdmin action. Verifies the full happy-path AND the four
/// abuse paths that would let an attacker bypass the guard: replay,
/// cross-user, cross-target, brute-force.
/// </summary>
public class AdminActionOtpServiceTests
{
    private static AdminActionOtpService NewService(out CapturingEmailSender email, out FixedClock clock, out Kalypsis.Infrastructure.Persistence.AppDbContext db)
    {
        var user = TestScaffold.PlatformAdmin();
        clock = TestScaffold.Clock;
        db = TestScaffold.NewDb(user, clock);
        email = new CapturingEmailSender();
        return new AdminActionOtpService(db, email, clock, NullLogger<AdminActionOtpService>.Instance);
    }

    // ── Happy path ───────────────────────────────────────────────────

    [Fact]
    public async Task Request_Verify_Consume_Succeeds()
    {
        var svc = NewService(out var email, out var clock, out var db);
        var userId = Guid.NewGuid();

        var req = await svc.RequestAsync("backup.delete", "abc", userId);
        Assert.NotEmpty(req.Token);
        Assert.Equal("info@mykalypsis.gr", req.EmailedTo);
        Assert.Single(email.Sent);

        var code = email.ExtractCodeFromLastEmail();
        Assert.Matches(@"^\d{6}$", code);

        var verify = await svc.VerifyAsync(req.Token, code, userId);
        Assert.True(verify.Verified);

        var consumed = await svc.ConsumeAsync(req.Token, "backup.delete", "abc", userId);
        Assert.True(consumed);
    }

    // ── Replay protection ────────────────────────────────────────────

    [Fact]
    public async Task Consume_TwiceOnSameToken_SecondFails()
    {
        var svc = NewService(out var email, out _, out _);
        var userId = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", userId);
        await svc.VerifyAsync(req.Token, email.ExtractCodeFromLastEmail(), userId);

        Assert.True(await svc.ConsumeAsync(req.Token, "backup.delete", "abc", userId));
        Assert.False(await svc.ConsumeAsync(req.Token, "backup.delete", "abc", userId));
    }

    // ── Cross-user ───────────────────────────────────────────────────

    [Fact]
    public async Task Verify_ByDifferentUser_Fails()
    {
        // A stolen JWT on user B can't verify user A's challenge.
        var svc = NewService(out var email, out _, out _);
        var alice = Guid.NewGuid();
        var mallory = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", alice);
        var res = await svc.VerifyAsync(req.Token, email.ExtractCodeFromLastEmail(), mallory);
        Assert.False(res.Verified);
        Assert.Equal("user_mismatch", res.Reason);
    }

    [Fact]
    public async Task Consume_ByDifferentUser_Fails()
    {
        var svc = NewService(out var email, out _, out _);
        var alice = Guid.NewGuid();
        var mallory = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", alice);
        await svc.VerifyAsync(req.Token, email.ExtractCodeFromLastEmail(), alice);
        var consumed = await svc.ConsumeAsync(req.Token, "backup.delete", "abc", mallory);
        Assert.False(consumed);
    }

    // ── Cross-target ─────────────────────────────────────────────────

    [Fact]
    public async Task Consume_ForDifferentTarget_Fails()
    {
        // A code issued for backup A must never authorise deleting backup B.
        var svc = NewService(out var email, out _, out _);
        var userId = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "backupA", userId);
        await svc.VerifyAsync(req.Token, email.ExtractCodeFromLastEmail(), userId);
        var wrongTarget = await svc.ConsumeAsync(req.Token, "backup.delete", "backupB", userId);
        Assert.False(wrongTarget);
    }

    [Fact]
    public async Task Consume_ForDifferentAction_Fails()
    {
        var svc = NewService(out var email, out _, out _);
        var userId = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", userId);
        await svc.VerifyAsync(req.Token, email.ExtractCodeFromLastEmail(), userId);
        Assert.False(await svc.ConsumeAsync(req.Token, "wipe-and-reseed", "abc", userId));
    }

    // ── Brute force ──────────────────────────────────────────────────

    [Fact]
    public async Task Verify_5_WrongCodes_LocksOut()
    {
        var svc = NewService(out var email, out _, out _);
        var userId = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", userId);
        var correct = email.ExtractCodeFromLastEmail();
        for (int i = 0; i < 5; i++)
        {
            var r = await svc.VerifyAsync(req.Token, "000000".Equals(correct) ? "111111" : "000000", userId);
            Assert.False(r.Verified);
        }
        // 6th attempt with the RIGHT code is refused — locked out.
        var final = await svc.VerifyAsync(req.Token, correct, userId);
        Assert.False(final.Verified);
        Assert.Equal("rate_limited", final.Reason);
    }

    // ── Expiry ───────────────────────────────────────────────────────

    [Fact]
    public async Task Verify_ExpiredCode_Fails()
    {
        var svc = NewService(out var email, out var clock, out _);
        var userId = Guid.NewGuid();
        var req = await svc.RequestAsync("backup.delete", "abc", userId);
        var code = email.ExtractCodeFromLastEmail();
        // Fast-forward past the 5-min lifetime.
        clock.UtcNow = clock.UtcNow.AddMinutes(6);
        var r = await svc.VerifyAsync(req.Token, code, userId);
        Assert.False(r.Verified);
        Assert.Equal("expired", r.Reason);
    }

    // ── Email failure kills the challenge ────────────────────────────

    [Fact]
    public async Task Request_WhenEmailFails_Throws()
    {
        var user = TestScaffold.PlatformAdmin();
        var clock = TestScaffold.Clock;
        var db = TestScaffold.NewDb(user, clock);
        var email = new CapturingEmailSender { AlwaysFail = true };
        var svc = new AdminActionOtpService(db, email, clock, NullLogger<AdminActionOtpService>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.RequestAsync("backup.delete", "abc", Guid.NewGuid()));
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private sealed class CapturingEmailSender : IEmailSender
    {
        public List<EmailMessage> Sent { get; } = new();
        public bool AlwaysFail { get; set; }
        public Task<EmailResult> SendAsync(EmailMessage message, CancellationToken ct = default)
        {
            Sent.Add(message);
            return Task.FromResult(AlwaysFail
                ? new EmailResult(false, "brevo simulated failure")
                : new EmailResult(true));
        }
        public Task<bool> IsConfiguredAsync(CancellationToken ct = default) => Task.FromResult(true);
        /// <summary>Pull the emailed 6-digit code out of the last HTML body.</summary>
        public string ExtractCodeFromLastEmail()
        {
            var html = Sent[^1].HtmlBody;
            var m = System.Text.RegularExpressions.Regex.Match(html, @">(\d{6})<");
            return m.Success ? m.Groups[1].Value : "";
        }
    }
}
