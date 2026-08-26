using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Out-of-band 6-digit verification challenge protecting DESTRUCTIVE
/// platform-admin actions (wipe-reseed, backup delete, bookkeeping mass
/// delete, tenant delete, etc). Threat model: an attacker who steals
/// a PlatformAdmin JWT still cannot destroy data because they don't
/// have access to the platform's info@ mailbox where the code is sent.
///
/// Flow:
///   1. UI requests a challenge for a specific action, e.g.
///      { action: "backup.delete", target: "<backupId>" }.
///   2. Server generates a random 6-digit code + a random opaque token,
///      hashes both, stores the hashes with a 5-minute expiry, and
///      emails the CODE to the platform's info address via Brevo.
///      Returns the TOKEN to the client (never the code).
///   3. Client asks operator to type the 6-digit code, POSTs
///      {token, code} to /verify. Server hashes + compares. On success,
///      marks the row as Verified. Rate-limited to 5 attempts.
///   4. Destructive endpoint requires an `X-Admin-OTP-Token` header
///      matching a Verified challenge for the SAME action + target
///      within the last 15 minutes. Used-once — the endpoint consumes
///      the challenge (ConsumedAt) so a leaked token can't be replayed.
///
/// Nothing sensitive lives in this row — CodeHash + TokenHash are
/// SHA-256 digests. A DB dump alone can't be used to bypass the flow.
/// </summary>
public class AdminActionChallenge : BaseEntity
{
    public string Action { get; set; } = "";
    /// <summary>Free-form target descriptor. E.g. a backupId, a
    /// tenantId, or the string "all-tenants" for a wipe. Verified
    /// alongside Action — a code issued for target A cannot be used
    /// to act on target B.</summary>
    public string? Target { get; set; }
    /// <summary>SHA-256 hex of the opaque bearer token given to the
    /// client. Never store the raw token.</summary>
    public string TokenHash { get; set; } = "";
    /// <summary>SHA-256 hex of the 6-digit code emailed to the admin.
    /// Compare by re-hashing the submitted code + constant-time equals.</summary>
    public string CodeHash { get; set; } = "";
    /// <summary>The PlatformAdmin who requested the challenge. Ensures
    /// the person who types the code is the same person who initiated —
    /// a stolen JWT for user A can't verify a challenge user B started.</summary>
    public Guid RequestedByUserId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public string? EmailedTo { get; set; }
}
