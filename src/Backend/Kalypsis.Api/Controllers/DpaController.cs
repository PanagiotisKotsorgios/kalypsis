using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// GDPR Άρθρο 28 — αποδοχή της Σύμβασης Επεξεργασίας Προσωπικών Δεδομένων
/// (Data Processing Agreement) ανά γραφείο-controller.
///
/// - <c>GET /current</c> — δημόσιο, επιστρέφει την τρέχουσα έκδοση + ημερομηνία.
/// - <c>GET /status</c> — authenticated, αν το τρέχον γραφείο έχει αποδεχθεί
///   την τρέχουσα έκδοση.
/// - <c>POST /accept</c> — μόνο AgencyAdmin, καταγράφει την αποδοχή με IP/UA
///   snapshot για non-repudiation.
/// - <c>GET /acceptances</c> — μόνο PlatformAdmin, λίστα όλων των αποδοχών
///   ανά γραφείο για audit.
/// </summary>
[ApiController]
[Route("api/gdpr/dpa")]
public class DpaController : ControllerBase
{
    /// <summary>Η ενεργή έκδοση του πλήρους νομικού πλαισίου. Από v2.0 και πάνω
    /// η αποδοχή αφορά τα ΤΕΣΣΕΡΑ εμπορικά έγγραφα ως ενιαία δέσμη:
    ///
    ///   1. Σύμβαση Παροχής Υπηρεσιών Πλατφόρμας (MSA)
    ///   2. Σύμβαση Επεξεργασίας Προσωπικών Δεδομένων (DPA, Άρθρο 28 GDPR)
    ///   3. Συμφωνία Επιπέδου Υπηρεσίας (SLA)
    ///   4. Πολιτική Αποδεκτής Χρήσης (AUP)
    ///
    /// Η ενδοπλατφορμική routing διατηρεί το «dpa» prefix για συμβατότητα
    /// με τον υπάρχοντα κώδικα, αλλά conceptually πλέον καλύπτεται όλη η
    /// δέσμη. Bump όταν αλλάξει έστω και ένα από τα 4 έγγραφα.</summary>
    public const string CurrentVersion = "suite-v1.0";

    /// <summary>Ημερομηνία δημοσίευσης της τρέχουσας έκδοσης της δέσμης.</summary>
    public static readonly DateOnly CurrentVersionPublishedOn = new(2026, 7, 16);

    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public DpaController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record DpaCurrentDto(string Version, DateOnly PublishedOn);

    public record DpaStatusDto(
        string CurrentVersion,
        bool AcceptedCurrent,
        string? AcceptedVersion,
        DateTime? AcceptedAt,
        string? AcceptedByName);

    public record AcceptDpaBody(string Version);

    public record DpaAcceptanceRowDto(
        Guid Id,
        Guid TenantId,
        string? TenantName,
        string Version,
        DateTime AcceptedAt,
        string AcceptedByName,
        string AcceptedByEmail,
        string? IpAddress);

    /// <summary>Ανοιχτό — η σελίδα /dpa διαβάζει από εδώ την έκδοση.</summary>
    [HttpGet("current")]
    [AllowAnonymous]
    public ActionResult<DpaCurrentDto> Current()
        => Ok(new DpaCurrentDto(CurrentVersion, CurrentVersionPublishedOn));

    [HttpGet("status")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<DpaStatusDto>> Status(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var latest = await _db.DpaAcceptances
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderByDescending(x => x.AcceptedAt)
            .FirstOrDefaultAsync(ct);
        var acceptedCurrent = latest != null && latest.Version == CurrentVersion;
        return Ok(new DpaStatusDto(
            CurrentVersion,
            acceptedCurrent,
            latest?.Version,
            latest?.AcceptedAt,
            latest?.AcceptedByName));
    }

    [HttpPost("accept")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<DpaStatusDto>> Accept(
        [FromBody] AcceptDpaBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Forbidden();

        var version = (body.Version ?? "").Trim();
        if (version != CurrentVersion)
            throw new AppException("dpa_version_mismatch",
                $"Η έκδοση που στείλατε ({version}) δεν είναι η τρέχουσα ({CurrentVersion}).", 409);

        // Idempotent: αν το γραφείο έχει ήδη αποδεχθεί αυτή την έκδοση, δεν
        // δημιουργούμε δεύτερη γραμμή (unique index θα το απέρριπτε ούτως ή άλλως).
        var existing = await _db.DpaAcceptances.FirstOrDefaultAsync(
            x => x.TenantId == tenantId && x.Version == version && x.DeletedAt == null, ct);
        if (existing != null)
        {
            return Ok(new DpaStatusDto(CurrentVersion, true, existing.Version,
                existing.AcceptedAt, existing.AcceptedByName));
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Χρήστης");

        var row = new DpaAcceptance
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Version = version,
            AcceptedAt = _clock.UtcNow,
            AcceptedByUserId = userId,
            AcceptedByName = $"{user.FirstName} {user.LastName}".Trim(),
            AcceptedByEmail = user.Email,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = TruncateUa(HttpContext.Request.Headers.UserAgent.ToString()),
        };
        _db.DpaAcceptances.Add(row);
        await _db.SaveChangesAsync(ct);

        return Ok(new DpaStatusDto(CurrentVersion, true, row.Version,
            row.AcceptedAt, row.AcceptedByName));
    }

    [HttpGet("acceptances")]
    [Authorize(Policy = "PlatformLevel")]
    public async Task<ActionResult<IReadOnlyList<DpaAcceptanceRowDto>>> ListAcceptances(
        CancellationToken ct)
    {
        // Bypass tenant filter — PlatformAdmin needs cross-tenant visibility.
        var rows = await _db.DpaAcceptances
            .IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .OrderByDescending(x => x.AcceptedAt)
            .Take(1000)
            .ToListAsync(ct);
        var tenantIds = rows.Select(x => x.TenantId).Distinct().ToList();
        var tenantNames = await _db.Tenants
            .IgnoreQueryFilters()
            .Where(t => tenantIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        return Ok(rows.Select(x => new DpaAcceptanceRowDto(
            x.Id, x.TenantId,
            tenantNames.TryGetValue(x.TenantId, out var name) ? name : null,
            x.Version, x.AcceptedAt, x.AcceptedByName, x.AcceptedByEmail, x.IpAddress
        )).ToList());
    }

    private static string? TruncateUa(string? ua) =>
        string.IsNullOrEmpty(ua) ? null : (ua.Length > 500 ? ua.Substring(0, 500) : ua);
}
