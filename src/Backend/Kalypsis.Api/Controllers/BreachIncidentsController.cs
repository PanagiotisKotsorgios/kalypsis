using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// GDPR Άρθρο 33 — μητρώο περιστατικών παραβίασης δεδομένων.
///
/// Μόνο PlatformAdmin/Employee μπορεί να δημιουργήσει, να ενημερώσει και
/// να ενεργοποιήσει την ειδοποίηση προς τα affected γραφεία-controllers.
/// Το endpoint <c>notify-tenants</c> στέλνει email + in-app notification και
/// σφραγίζει το <see cref="DataBreachIncident.TenantsNotifiedAt"/>.
/// </summary>
[ApiController]
[Route("api/platform/breach-incidents")]
[Authorize(Policy = "PlatformLevel")]
public class BreachIncidentsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    private readonly IEmailSender _email;

    public BreachIncidentsController(
        IAppDbContext db, ICurrentUser current, IDateTimeProvider clock, IEmailSender email)
    {
        _db = db; _current = current; _clock = clock; _email = email;
    }

    public record BreachDto(
        Guid Id,
        string IncidentCode,
        DateTime DiscoveredAt,
        DateTime? OccurredAt,
        string Severity,
        string ContainmentStatus,
        string TenantsScope,
        Guid[] AffectedTenantIds,
        string Nature,
        string? AffectedDataCategories,
        int? EstimatedAffectedSubjects,
        string? Mitigations,
        DateTime? TenantsNotifiedAt,
        DateTime? AuthorityNotifiedAt,
        string? AuthorityReference,
        DateTime? ClosedAt,
        string? ClosureNotes,
        double HoursSinceDiscovery,
        bool Past72h);

    public record CreateBreachBody(
        DateTime DiscoveredAt,
        DateTime? OccurredAt,
        BreachSeverity Severity,
        BreachTenantScope TenantsScope,
        Guid[]? AffectedTenantIds,
        string Nature,
        string? AffectedDataCategories,
        int? EstimatedAffectedSubjects,
        string? Mitigations);

    public record UpdateBreachBody(
        BreachSeverity Severity,
        BreachContainmentStatus ContainmentStatus,
        BreachTenantScope TenantsScope,
        Guid[]? AffectedTenantIds,
        string Nature,
        string? AffectedDataCategories,
        int? EstimatedAffectedSubjects,
        string? Mitigations,
        DateTime? AuthorityNotifiedAt,
        string? AuthorityReference);

    public record CloseBreachBody(string? ClosureNotes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BreachDto>>> List(CancellationToken ct)
    {
        var rows = await _db.DataBreachIncidents
            .IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .OrderByDescending(x => x.DiscoveredAt)
            .Take(500)
            .ToListAsync(ct);
        return Ok(rows.Select(Map).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BreachDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _db.DataBreachIncidents
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραβίαση");
        return Ok(Map(row));
    }

    [HttpPost]
    public async Task<ActionResult<BreachDto>> Create(
        [FromBody] CreateBreachBody body, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.Nature))
            throw new AppException("breach_nature_required", "Απαιτείται περιγραφή της παραβίασης.", 400);

        // «BR-XXXXXX» με retry loop ώστε να μη συγκρουόμαστε με ήδη-εκδοθέντα codes.
        string code = string.Empty;
        for (var i = 0; i < 8; i++)
        {
            var candidate = "BR-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
            var exists = await _db.DataBreachIncidents.IgnoreQueryFilters()
                .AnyAsync(x => x.IncidentCode == candidate, ct);
            if (!exists) { code = candidate; break; }
        }
        if (string.IsNullOrEmpty(code))
            code = "BR-" + DateTime.UtcNow.Ticks.ToString()[^6..];

        var row = new DataBreachIncident
        {
            Id = Guid.NewGuid(),
            IncidentCode = code,
            DiscoveredAt = body.DiscoveredAt == default ? _clock.UtcNow : body.DiscoveredAt,
            OccurredAt = body.OccurredAt,
            Severity = body.Severity,
            ContainmentStatus = BreachContainmentStatus.InProgress,
            TenantsScope = body.TenantsScope,
            AffectedTenantIdsJson = body.TenantsScope == BreachTenantScope.Specific
                ? JsonSerializer.Serialize(body.AffectedTenantIds ?? Array.Empty<Guid>())
                : null,
            Nature = body.Nature.Trim(),
            AffectedDataCategories = body.AffectedDataCategories?.Trim(),
            EstimatedAffectedSubjects = body.EstimatedAffectedSubjects,
            Mitigations = body.Mitigations?.Trim(),
            ReportedByUserId = userId,
        };
        _db.DataBreachIncidents.Add(row);
        await _db.SaveChangesAsync(ct);
        return Ok(Map(row));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<BreachDto>> Update(
        Guid id, [FromBody] UpdateBreachBody body, CancellationToken ct)
    {
        var row = await _db.DataBreachIncidents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραβίαση");
        if (row.ClosedAt.HasValue)
            throw new AppException("breach_closed", "Το περιστατικό έχει κλείσει και δεν επιτρέπεται τροποποίηση.", 409);

        row.Severity = body.Severity;
        row.ContainmentStatus = body.ContainmentStatus;
        row.TenantsScope = body.TenantsScope;
        row.AffectedTenantIdsJson = body.TenantsScope == BreachTenantScope.Specific
            ? JsonSerializer.Serialize(body.AffectedTenantIds ?? Array.Empty<Guid>())
            : null;
        row.Nature = body.Nature?.Trim() ?? row.Nature;
        row.AffectedDataCategories = body.AffectedDataCategories?.Trim();
        row.EstimatedAffectedSubjects = body.EstimatedAffectedSubjects;
        row.Mitigations = body.Mitigations?.Trim();
        row.AuthorityNotifiedAt = body.AuthorityNotifiedAt;
        row.AuthorityReference = body.AuthorityReference?.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(Map(row));
    }

    /// <summary>Στέλνει email + in-app notification σε όλους τους AgencyAdmin
    /// των γραφείων που επηρεάζονται (ή σε όλα αν TenantsScope==AllTenants).
    /// Idempotent: αν έχει ήδη γίνει, επιστρέφει σφάλμα 409.</summary>
    [HttpPost("{id:guid}/notify-tenants")]
    public async Task<ActionResult<BreachDto>> NotifyTenants(Guid id, CancellationToken ct)
    {
        var row = await _db.DataBreachIncidents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραβίαση");
        if (row.TenantsNotifiedAt.HasValue)
            throw new AppException("breach_already_notified",
                $"Τα γραφεία έχουν ήδη ειδοποιηθεί στις {row.TenantsNotifiedAt:yyyy-MM-dd HH:mm} UTC.", 409);

        var affectedTenantIds = row.TenantsScope == BreachTenantScope.Specific
            ? JsonSerializer.Deserialize<Guid[]>(row.AffectedTenantIdsJson ?? "[]") ?? Array.Empty<Guid>()
            : Array.Empty<Guid>();

        // AgencyAdmin users από τα affected tenants (ή από όλα, όταν AllTenants).
        var admins = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.DeletedAt == null && u.IsActive
                        && u.Role == Role.AgencyAdmin
                        && (row.TenantsScope == BreachTenantScope.AllTenants
                            || affectedTenantIds.Contains(u.TenantId)))
            .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.TenantId })
            .ToListAsync(ct);

        var subject = $"[Kalypsis] Ειδοποίηση παραβίασης δεδομένων {row.IncidentCode}";
        var htmlBody = BuildEmail(row);

        int emailFails = 0;
        foreach (var admin in admins)
        {
            try
            {
                await _email.SendAsync(new EmailMessage(
                    admin.Email,
                    $"{admin.FirstName} {admin.LastName}".Trim(),
                    subject,
                    htmlBody), ct);
            }
            catch { emailFails++; }

            // In-app Notification για κάθε admin (αντέχει το email fallback).
            _db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                TenantId = admin.TenantId,
                UserId = admin.Id,
                Category = "gdpr-breach",
                Title = $"Ειδοποίηση παραβίασης δεδομένων {row.IncidentCode}",
                Body = row.Nature,
                Link = "/app/agency-settings",
                IsRead = false,
                CreatedAt = _clock.UtcNow,
                UpdatedAt = _clock.UtcNow,
            });
        }

        row.TenantsNotifiedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(Map(row));
    }

    [HttpPost("{id:guid}/close")]
    public async Task<ActionResult<BreachDto>> Close(
        Guid id, [FromBody] CloseBreachBody body, CancellationToken ct)
    {
        var row = await _db.DataBreachIncidents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Παραβίαση");
        if (row.ClosedAt.HasValue)
            return Ok(Map(row)); // idempotent
        row.ClosedAt = _clock.UtcNow;
        row.ClosureNotes = body.ClosureNotes?.Trim();
        row.ContainmentStatus = BreachContainmentStatus.Resolved;
        await _db.SaveChangesAsync(ct);
        return Ok(Map(row));
    }

    private BreachDto Map(DataBreachIncident x)
    {
        var affected = x.TenantsScope == BreachTenantScope.Specific
            ? (JsonSerializer.Deserialize<Guid[]>(x.AffectedTenantIdsJson ?? "[]") ?? Array.Empty<Guid>())
            : Array.Empty<Guid>();
        var hours = (_clock.UtcNow - x.DiscoveredAt).TotalHours;
        return new BreachDto(
            x.Id, x.IncidentCode, x.DiscoveredAt, x.OccurredAt,
            x.Severity.ToString(), x.ContainmentStatus.ToString(), x.TenantsScope.ToString(),
            affected, x.Nature, x.AffectedDataCategories, x.EstimatedAffectedSubjects,
            x.Mitigations, x.TenantsNotifiedAt, x.AuthorityNotifiedAt, x.AuthorityReference,
            x.ClosedAt, x.ClosureNotes, hours, hours > 72 && !x.AuthorityNotifiedAt.HasValue);
    }

    private static string BuildEmail(DataBreachIncident x) => $@"
<html><body style='font-family: sans-serif; color: #0b2545; line-height: 1.6;'>
  <h2>Ειδοποίηση Παραβίασης Προσωπικών Δεδομένων</h2>
  <p>Ως Εκτελών την Επεξεργασία (Άρθρο 28 GDPR), σας ειδοποιούμε για το παρακάτω περιστατικό
  που ενδέχεται να αφορά δεδομένα των πελατών σας:</p>
  <table style='border-collapse: collapse; width: 100%;'>
    <tr><td style='padding: 4px 8px;'><strong>Κωδικός</strong></td><td>{x.IncidentCode}</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Χρόνος γνώσης</strong></td><td>{x.DiscoveredAt:yyyy-MM-dd HH:mm} UTC</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Σοβαρότητα</strong></td><td>{x.Severity}</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Φύση</strong></td><td>{System.Net.WebUtility.HtmlEncode(x.Nature)}</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Κατηγορίες δεδομένων</strong></td><td>{System.Net.WebUtility.HtmlEncode(x.AffectedDataCategories ?? "—")}</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Κατά προσέγγιση υποκείμενα</strong></td><td>{x.EstimatedAffectedSubjects?.ToString() ?? "—"}</td></tr>
    <tr><td style='padding: 4px 8px;'><strong>Μέτρα</strong></td><td>{System.Net.WebUtility.HtmlEncode(x.Mitigations ?? "—")}</td></tr>
  </table>
  <p>Παρακαλούμε αξιολογήστε την επίπτωση στους δικούς σας υποκείμενα και αν χρειάζεται
  ειδοποιήστε τους. Είμαστε στη διάθεσή σας για περαιτέρω πληροφορίες.</p>
  <p>— Kalypsis · <a href='mailto:info@mykalypsis.gr'>info@mykalypsis.gr</a></p>
</body></html>";
}
