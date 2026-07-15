using System.Globalization;
using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

// ============================================================================
// Federation module — one controller family, mounted under /api/federation/*.
// Grouped this way (instead of one file per entity) because the surfaces are
// deeply intertwined — a Championship needs Categories, a Registration needs
// Athletes filtered by their Club, etc. — and the operator's mental model
// treats them as a single subsystem.
//
// Payment tracking and results entry live here too so the FederationAdmin has
// one place to reason about who owes what and what happened on the day.
// ============================================================================

// ---- Championships ---------------------------------------------------------

[ApiController]
[Route("api/federation/championships")]
[Authorize(Policy = "FederationStaff")]
public class ChampionshipsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public ChampionshipsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ChampionshipDto(
        Guid Id, string Name, string Sport, string? Location,
        DateOnly StartDate, DateOnly EndDate,
        ChampionshipStatus Status, string? Description,
        DateOnly? RegistrationDeadline,
        decimal ClubEntryFee, decimal FeePerAthlete, string Currency,
        string? AnnouncementFileName,
        int RegistrationCount, int AthleteCount,
        decimal TotalCollected, decimal TotalOutstanding);

    public record ChampionshipBody(
        string Name, string Sport, string? Location,
        DateOnly StartDate, DateOnly EndDate,
        ChampionshipStatus Status, string? Description,
        DateOnly? RegistrationDeadline,
        decimal ClubEntryFee, decimal FeePerAthlete, string Currency);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ChampionshipDto>>> List(CancellationToken ct)
        => Ok(await ListInternal(ct));

    // Extracted so the CSV export can share the exact same aggregation
    // (headline counts, collected vs outstanding) as the JSON endpoint.
    private async Task<List<ChampionshipDto>> ListInternal(CancellationToken ct)
    {
        _ = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.Championships.OrderByDescending(c => c.StartDate).ToListAsync(ct);
        var regs = await _db.ChampionshipRegistrations.ToListAsync(ct);
        var regAths = await _db.RegistrationAthletes.ToListAsync(ct);
        return rows.Select(c => {
            var myRegs = regs.Where(r => r.ChampionshipId == c.Id).ToList();
            var myRegIds = myRegs.Select(r => r.Id).ToHashSet();
            var athCount = regAths.Count(a => myRegIds.Contains(a.RegistrationId));
            return new ChampionshipDto(
                c.Id, c.Name, c.Sport, c.Location, c.StartDate, c.EndDate, c.Status,
                c.Description, c.RegistrationDeadline, c.ClubEntryFee, c.FeePerAthlete, c.Currency,
                c.AnnouncementFileName,
                RegistrationCount: myRegs.Count,
                AthleteCount: athCount,
                TotalCollected: myRegs.Where(r => r.PaymentStatus == RegistrationPaymentStatus.Paid).Sum(r => r.TotalFee),
                TotalOutstanding: myRegs.Where(r => r.PaymentStatus != RegistrationPaymentStatus.Paid
                                                && r.PaymentStatus != RegistrationPaymentStatus.Waived).Sum(r => r.TotalFee));
        }).ToList();
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ChampionshipDto>> Get(Guid id, CancellationToken ct)
    {
        var c = await _db.Championships.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρωτάθλημα");
        var myRegs = await _db.ChampionshipRegistrations.Where(r => r.ChampionshipId == id).ToListAsync(ct);
        var athCount = await _db.RegistrationAthletes.CountAsync(a =>
            _db.ChampionshipRegistrations.Any(r => r.Id == a.RegistrationId && r.ChampionshipId == id), ct);
        return Ok(new ChampionshipDto(
            c.Id, c.Name, c.Sport, c.Location, c.StartDate, c.EndDate, c.Status,
            c.Description, c.RegistrationDeadline, c.ClubEntryFee, c.FeePerAthlete, c.Currency,
            c.AnnouncementFileName,
            myRegs.Count,
            athCount,
            myRegs.Where(r => r.PaymentStatus == RegistrationPaymentStatus.Paid).Sum(r => r.TotalFee),
            myRegs.Where(r => r.PaymentStatus != RegistrationPaymentStatus.Paid
                            && r.PaymentStatus != RegistrationPaymentStatus.Waived).Sum(r => r.TotalFee)));
    }

    [HttpPost]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<ActionResult<Guid>> Create([FromBody] ChampionshipBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var c = new Championship {
            TenantId = tenantId,
            Name = body.Name, Sport = body.Sport, Location = body.Location,
            StartDate = body.StartDate, EndDate = body.EndDate,
            Status = body.Status, Description = body.Description,
            RegistrationDeadline = body.RegistrationDeadline,
            ClubEntryFee = body.ClubEntryFee, FeePerAthlete = body.FeePerAthlete,
            Currency = body.Currency ?? "EUR",
            CreatedAt = _clock.UtcNow,
        };
        _db.Championships.Add(c);
        await _db.SaveChangesAsync(ct);
        return Ok(c.Id);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ChampionshipBody body, CancellationToken ct)
    {
        var c = await _db.Championships.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρωτάθλημα");
        c.Name = body.Name; c.Sport = body.Sport; c.Location = body.Location;
        c.StartDate = body.StartDate; c.EndDate = body.EndDate;
        c.Status = body.Status; c.Description = body.Description;
        c.RegistrationDeadline = body.RegistrationDeadline;
        c.ClubEntryFee = body.ClubEntryFee; c.FeePerAthlete = body.FeePerAthlete;
        c.Currency = body.Currency ?? "EUR";
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await _db.Championships.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Πρωτάθλημα");
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ==== Excel/CSV export — one row per championship ========================
    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(CancellationToken ct)
    {
        var rows = await ListInternal(ct);
        return FederationCsv.Write("championships", new[] {
            "Όνομα","Άθλημα","Τοποθεσία","Έναρξη","Λήξη","Κατάσταση",
            "Σύλλογοι","Αθλητές","Είσπραξε","Οφείλει"
        }, rows.Select(r => new object?[] {
            r.Name, r.Sport, r.Location, r.StartDate, r.EndDate, r.Status,
            r.RegistrationCount, r.AthleteCount, r.TotalCollected, r.TotalOutstanding
        }));
    }

    // ==== Categories =========================================================
    public record CategoryDto(Guid Id, Guid ChampionshipId, string Name, int? MinAge, int? MaxAge, string? Gender, int SortOrder);
    public record CategoryBody(string Name, int? MinAge, int? MaxAge, string? Gender, int SortOrder);

    [HttpGet("{id:guid}/categories")]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> ListCategories(Guid id, CancellationToken ct)
    {
        var rows = await _db.ChampionshipCategories
            .Where(c => c.ChampionshipId == id)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .ToListAsync(ct);
        return Ok(rows.Select(c => new CategoryDto(c.Id, c.ChampionshipId, c.Name, c.MinAge, c.MaxAge, c.Gender, c.SortOrder)).ToList());
    }

    [HttpPost("{id:guid}/categories")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<ActionResult<Guid>> CreateCategory(Guid id, [FromBody] CategoryBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var cat = new ChampionshipCategory {
            TenantId = tenantId, ChampionshipId = id,
            Name = body.Name, MinAge = body.MinAge, MaxAge = body.MaxAge,
            Gender = body.Gender, SortOrder = body.SortOrder,
            CreatedAt = _clock.UtcNow,
        };
        _db.ChampionshipCategories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return Ok(cat.Id);
    }

    [HttpPut("categories/{catId:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> UpdateCategory(Guid catId, [FromBody] CategoryBody body, CancellationToken ct)
    {
        var cat = await _db.ChampionshipCategories.FirstOrDefaultAsync(x => x.Id == catId, ct)
            ?? throw AppException.NotFound("Κατηγορία");
        cat.Name = body.Name; cat.MinAge = body.MinAge; cat.MaxAge = body.MaxAge;
        cat.Gender = body.Gender; cat.SortOrder = body.SortOrder;
        cat.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("categories/{catId:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> DeleteCategory(Guid catId, CancellationToken ct)
    {
        var cat = await _db.ChampionshipCategories.FirstOrDefaultAsync(x => x.Id == catId, ct)
            ?? throw AppException.NotFound("Κατηγορία");
        cat.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

// ---- Clubs -----------------------------------------------------------------

[ApiController]
[Route("api/federation/clubs")]
[Authorize(Policy = "FederationStaff")]
public class FederationClubsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public FederationClubsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ClubDto(Guid Id, string Name, string Code, string? City,
        string? ContactName, string? ContactEmail, string? ContactPhone,
        string? Notes, bool IsActive, int AthleteCount);
    public record ClubBody(string Name, string Code, string? City,
        string? ContactName, string? ContactEmail, string? ContactPhone,
        string? Notes, bool IsActive);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClubDto>>> List(CancellationToken ct)
        => Ok(await ListInternal(ct));

    private async Task<List<ClubDto>> ListInternal(CancellationToken ct)
    {
        var rows = await _db.Clubs.OrderBy(c => c.Name).ToListAsync(ct);
        var athCounts = await _db.Athletes.GroupBy(a => a.ClubId)
            .Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct);
        var m = athCounts.ToDictionary(x => x.Key, x => x.N);
        return rows.Select(c => new ClubDto(c.Id, c.Name, c.Code, c.City,
            c.ContactName, c.ContactEmail, c.ContactPhone,
            c.Notes, c.IsActive,
            m.TryGetValue(c.Id, out var n) ? n : 0)).ToList();
    }

    [HttpPost]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<ActionResult<Guid>> Create([FromBody] ClubBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        // Resurrect a soft-deleted row on the same code so the operator
        // doesn't hit a duplicate-key on the unique (TenantId, Code) index.
        var existing = await _db.Clubs.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == body.Code, ct);
        if (existing is not null && existing.DeletedAt is null)
            throw new AppException("club_code_exists", "Υπάρχει ήδη σύλλογος με αυτόν τον κωδικό.", 400);
        if (existing is not null) {
            existing.DeletedAt = null;
            existing.Name = body.Name; existing.City = body.City;
            existing.ContactName = body.ContactName; existing.ContactEmail = body.ContactEmail;
            existing.ContactPhone = body.ContactPhone; existing.Notes = body.Notes;
            existing.IsActive = body.IsActive; existing.UpdatedAt = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
            return Ok(existing.Id);
        }
        var c = new Club {
            TenantId = tenantId, Name = body.Name, Code = body.Code, City = body.City,
            ContactName = body.ContactName, ContactEmail = body.ContactEmail,
            ContactPhone = body.ContactPhone, Notes = body.Notes, IsActive = body.IsActive,
            CreatedAt = _clock.UtcNow,
        };
        _db.Clubs.Add(c);
        await _db.SaveChangesAsync(ct);
        return Ok(c.Id);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ClubBody body, CancellationToken ct)
    {
        var c = await _db.Clubs.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Σύλλογος");
        c.Name = body.Name; c.Code = body.Code; c.City = body.City;
        c.ContactName = body.ContactName; c.ContactEmail = body.ContactEmail;
        c.ContactPhone = body.ContactPhone; c.Notes = body.Notes; c.IsActive = body.IsActive;
        c.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await _db.Clubs.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Σύλλογος");
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(CancellationToken ct)
    {
        var rows = await ListInternal(ct);
        return FederationCsv.Write("clubs", new[] {
            "Όνομα","Κωδικός","Πόλη","Υπεύθυνος","Email","Τηλέφωνο","Αθλητές","Ενεργός"
        }, rows.Select(r => new object?[] {
            r.Name, r.Code, r.City, r.ContactName, r.ContactEmail, r.ContactPhone,
            r.AthleteCount, r.IsActive ? "Ναι" : "Όχι"
        }));
    }
}

// ---- Athletes --------------------------------------------------------------

[ApiController]
[Route("api/federation/athletes")]
[Authorize(Policy = "FederationStaff")]
public class FederationAthletesController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public FederationAthletesController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record AthleteDto(Guid Id, Guid ClubId, string ClubName, string FirstName,
        string LastName, DateOnly? BirthDate, string? Gender, string? LicenseNumber,
        string? Notes, bool IsActive);
    public record AthleteBody(Guid ClubId, string FirstName, string LastName,
        DateOnly? BirthDate, string? Gender, string? LicenseNumber, string? Notes, bool IsActive);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AthleteDto>>> List(
        [FromQuery] Guid? clubId, CancellationToken ct)
        => Ok(await ListInternal(clubId, ct));

    private async Task<List<AthleteDto>> ListInternal(Guid? clubId, CancellationToken ct)
    {
        var q = _db.Athletes.AsQueryable();
        if (clubId is Guid cid) q = q.Where(a => a.ClubId == cid);
        var rows = await q.OrderBy(a => a.LastName).ThenBy(a => a.FirstName).ToListAsync(ct);
        var clubs = await _db.Clubs.ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        return rows.Select(a => new AthleteDto(a.Id, a.ClubId,
            clubs.TryGetValue(a.ClubId, out var cn) ? cn : "—",
            a.FirstName, a.LastName, a.BirthDate, a.Gender, a.LicenseNumber,
            a.Notes, a.IsActive)).ToList();
    }

    [HttpPost]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<ActionResult<Guid>> Create([FromBody] AthleteBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var a = new Athlete {
            TenantId = tenantId, ClubId = body.ClubId,
            FirstName = body.FirstName, LastName = body.LastName,
            BirthDate = body.BirthDate, Gender = body.Gender,
            LicenseNumber = body.LicenseNumber, Notes = body.Notes, IsActive = body.IsActive,
            CreatedAt = _clock.UtcNow,
        };
        _db.Athletes.Add(a);
        await _db.SaveChangesAsync(ct);
        return Ok(a.Id);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] AthleteBody body, CancellationToken ct)
    {
        var a = await _db.Athletes.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Αθλητής");
        a.ClubId = body.ClubId;
        a.FirstName = body.FirstName; a.LastName = body.LastName;
        a.BirthDate = body.BirthDate; a.Gender = body.Gender;
        a.LicenseNumber = body.LicenseNumber; a.Notes = body.Notes; a.IsActive = body.IsActive;
        a.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var a = await _db.Athletes.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Αθλητής");
        a.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv([FromQuery] Guid? clubId, CancellationToken ct)
    {
        var rows = await ListInternal(clubId, ct);
        return FederationCsv.Write("athletes", new[] {
            "Επώνυμο","Όνομα","Σύλλογος","Γέννηση","Φύλο","Δελτίο","Ενεργός"
        }, rows.Select(r => new object?[] {
            r.LastName, r.FirstName, r.ClubName, r.BirthDate, r.Gender, r.LicenseNumber,
            r.IsActive ? "Ναι" : "Όχι"
        }));
    }
}

// ---- Registrations + Payment tracking --------------------------------------

[ApiController]
[Route("api/federation/registrations")]
[Authorize(Policy = "FederationStaff")]
public class FederationRegistrationsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public FederationRegistrationsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record RegistrationLine(Guid Id, Guid AthleteId, string AthleteName, Guid CategoryId, string CategoryName, int? StartNumber);
    public record RegistrationDto(Guid Id, Guid ChampionshipId, string ChampionshipName,
        Guid ClubId, string ClubName, DateOnly SubmittedOn,
        decimal TotalFee, string Currency,
        RegistrationPaymentStatus PaymentStatus, DateOnly? PaidOn, string? PaymentReference,
        string? Notes,
        int AthleteCount,
        IReadOnlyList<RegistrationLine> Athletes);

    public record RegistrationBody(Guid ChampionshipId, Guid ClubId,
        DateOnly SubmittedOn, string? Notes,
        IReadOnlyList<RegistrationAthleteInput> Athletes);
    public record RegistrationAthleteInput(Guid AthleteId, Guid CategoryId, int? StartNumber);
    public record PaymentBody(RegistrationPaymentStatus Status, DateOnly? PaidOn, string? PaymentReference);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RegistrationDto>>> List(
        [FromQuery] Guid? championshipId, [FromQuery] Guid? clubId, CancellationToken ct)
        => Ok(await ListInternal(championshipId, clubId, ct));

    private async Task<List<RegistrationDto>> ListInternal(
        Guid? championshipId, Guid? clubId, CancellationToken ct)
    {
        var q = _db.ChampionshipRegistrations.AsQueryable();
        if (championshipId is Guid cid) q = q.Where(r => r.ChampionshipId == cid);
        if (clubId is Guid clid) q = q.Where(r => r.ClubId == clid);
        var regs = await q.OrderByDescending(r => r.SubmittedOn).ToListAsync(ct);
        var regIds = regs.Select(r => r.Id).ToList();

        var athletesFlat = await _db.RegistrationAthletes
            .Where(a => regIds.Contains(a.RegistrationId)).ToListAsync(ct);
        var athletes = await _db.Athletes.ToDictionaryAsync(a => a.Id, ct);
        var cats = await _db.ChampionshipCategories.ToDictionaryAsync(c => c.Id, ct);
        var champs = await _db.Championships.ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var clubs = await _db.Clubs.ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        return regs.Select(r => {
            var mine = athletesFlat.Where(a => a.RegistrationId == r.Id).ToList();
            var lines = mine.Select(ra => {
                var ath = athletes.GetValueOrDefault(ra.AthleteId);
                var cat = cats.GetValueOrDefault(ra.CategoryId);
                return new RegistrationLine(
                    ra.Id, ra.AthleteId,
                    ath is null ? "—" : $"{ath.LastName} {ath.FirstName}",
                    ra.CategoryId, cat?.Name ?? "—", ra.StartNumber);
            }).ToList();
            return new RegistrationDto(
                r.Id, r.ChampionshipId, champs.TryGetValue(r.ChampionshipId, out var cn) ? cn : "—",
                r.ClubId, clubs.TryGetValue(r.ClubId, out var cln) ? cln : "—",
                r.SubmittedOn, r.TotalFee, r.Currency,
                r.PaymentStatus, r.PaidOn, r.PaymentReference, r.Notes,
                mine.Count, lines);
        }).ToList();
    }

    [HttpPost]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<ActionResult<Guid>> Create([FromBody] RegistrationBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var champ = await _db.Championships.FirstOrDefaultAsync(c => c.Id == body.ChampionshipId, ct)
            ?? throw AppException.NotFound("Πρωτάθλημα");
        // Snapshot the fee at submission time so the club's owed amount
        // doesn't retroactively change if the federation edits FeePerAthlete
        // after the deadline.
        var athCount = body.Athletes?.Count ?? 0;
        var total = champ.ClubEntryFee + champ.FeePerAthlete * athCount;
        var reg = new ChampionshipRegistration {
            TenantId = tenantId,
            ChampionshipId = body.ChampionshipId, ClubId = body.ClubId,
            SubmittedOn = body.SubmittedOn,
            TotalFee = total, Currency = champ.Currency,
            PaymentStatus = RegistrationPaymentStatus.Pending,
            Notes = body.Notes,
            CreatedAt = _clock.UtcNow,
        };
        _db.ChampionshipRegistrations.Add(reg);
        if (body.Athletes is not null)
            foreach (var a in body.Athletes)
                _db.RegistrationAthletes.Add(new RegistrationAthlete {
                    TenantId = tenantId, RegistrationId = reg.Id,
                    AthleteId = a.AthleteId, CategoryId = a.CategoryId,
                    StartNumber = a.StartNumber, CreatedAt = _clock.UtcNow,
                });
        await _db.SaveChangesAsync(ct);
        return Ok(reg.Id);
    }

    [HttpPost("{id:guid}/payment")]
    [Authorize(Policy = "FederationStaff")]
    public async Task<IActionResult> UpdatePayment(Guid id, [FromBody] PaymentBody body, CancellationToken ct)
    {
        var reg = await _db.ChampionshipRegistrations.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Δήλωση");
        reg.PaymentStatus = body.Status;
        reg.PaidOn = body.PaidOn;
        reg.PaymentReference = body.PaymentReference;
        reg.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "FederationAdmin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var reg = await _db.ChampionshipRegistrations.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw AppException.NotFound("Δήλωση");
        reg.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] Guid? championshipId, [FromQuery] Guid? clubId, CancellationToken ct)
    {
        var rows = await ListInternal(championshipId, clubId, ct);
        return FederationCsv.Write("registrations", new[] {
            "Πρωτάθλημα","Σύλλογος","Υποβλήθηκε","Αθλητές","Χρέωση","Κατάσταση","Πληρώθηκε","Αναφορά"
        }, rows.Select(r => new object?[] {
            r.ChampionshipName, r.ClubName, r.SubmittedOn, r.AthleteCount,
            r.TotalFee, r.PaymentStatus, r.PaidOn, r.PaymentReference
        }));
    }
}

// ---- Results ---------------------------------------------------------------

[ApiController]
[Route("api/federation/results")]
[Authorize(Policy = "FederationStaff")]
public class FederationResultsController : ControllerBase
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    public FederationResultsController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    { _db = db; _current = current; _clock = clock; }

    public record ResultLine(
        Guid RegistrationAthleteId, string AthleteName, string ClubName,
        Guid CategoryId, string CategoryName,
        int? StartNumber, int? Rank, string? Score, string? Notes);

    public record UpsertResultBody(Guid RegistrationAthleteId, int? Rank, string? Score, string? Notes);

    /// <summary>All results for a championship, grouped implicitly by category
    /// (frontend groups). Returns the full grid so on-the-day updates from any
    /// employee land in the same in-memory view.</summary>
    [HttpGet("{championshipId:guid}")]
    public async Task<ActionResult<IReadOnlyList<ResultLine>>> List(Guid championshipId, CancellationToken ct)
        => Ok(await ListInternal(championshipId, ct));

    private async Task<List<ResultLine>> ListInternal(Guid championshipId, CancellationToken ct)
    {
        var regs = await _db.ChampionshipRegistrations
            .Where(r => r.ChampionshipId == championshipId)
            .Select(r => new { r.Id, r.ClubId })
            .ToListAsync(ct);
        var regIds = regs.Select(r => r.Id).ToHashSet();
        var regAths = await _db.RegistrationAthletes
            .Where(ra => regIds.Contains(ra.RegistrationId))
            .ToListAsync(ct);
        var raIds = regAths.Select(x => x.Id).ToList();
        var results = await _db.ChampionshipResults
            .Where(r => raIds.Contains(r.RegistrationAthleteId))
            .ToDictionaryAsync(r => r.RegistrationAthleteId, ct);
        var athletes = await _db.Athletes.ToDictionaryAsync(a => a.Id, ct);
        var clubs = await _db.Clubs.ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var cats = await _db.ChampionshipCategories.ToDictionaryAsync(c => c.Id, ct);
        var regToClub = regs.ToDictionary(x => x.Id, x => x.ClubId);

        return regAths.Select(ra => {
            var ath = athletes.GetValueOrDefault(ra.AthleteId);
            var cat = cats.GetValueOrDefault(ra.CategoryId);
            var res = results.GetValueOrDefault(ra.Id);
            var clubId = regToClub.GetValueOrDefault(ra.RegistrationId);
            return new ResultLine(
                ra.Id,
                ath is null ? "—" : $"{ath.LastName} {ath.FirstName}",
                clubs.TryGetValue(clubId, out var cn) ? cn : "—",
                ra.CategoryId, cat?.Name ?? "—",
                ra.StartNumber, res?.Rank, res?.Score, res?.Notes);
        }).OrderBy(x => x.CategoryName).ThenBy(x => x.Rank ?? int.MaxValue).ToList();
    }

    /// <summary>Upsert a single result. Called from the live-entry table so
    /// staff can type as races finish, without a bulk submit step.</summary>
    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertResultBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var res = await _db.ChampionshipResults
            .FirstOrDefaultAsync(r => r.RegistrationAthleteId == body.RegistrationAthleteId, ct);
        if (res is null)
        {
            res = new ChampionshipResult {
                TenantId = tenantId,
                RegistrationAthleteId = body.RegistrationAthleteId,
                CreatedAt = _clock.UtcNow,
            };
            _db.ChampionshipResults.Add(res);
        }
        res.Rank = body.Rank;
        res.Score = body.Score;
        res.Notes = body.Notes;
        res.EnteredByUserId = _current.UserId;
        res.EnteredAt = _clock.UtcNow;
        res.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{championshipId:guid}/export.csv")]
    public async Task<IActionResult> ExportCsv(Guid championshipId, CancellationToken ct)
    {
        var lines = await ListInternal(championshipId, ct);
        return FederationCsv.Write($"results-{championshipId:N}", new[] {
            "Κατηγορία","Σύλλογος","Αθλητής","Νούμερο","Θέση","Επίδοση","Σημ."
        }, lines.Select(l => new object?[] {
            l.CategoryName, l.ClubName, l.AthleteName, l.StartNumber, l.Rank, l.Score, l.Notes
        }));
    }
}

// ---- Shared CSV writer -----------------------------------------------------

internal static class FederationCsv
{
    private static readonly CultureInfo El = CultureInfo.GetCultureInfo("el-GR");

    /// <summary>UTF-8 BOM + semicolon-separated so Greek Excel opens it
    /// straight — same pattern the reports module uses.</summary>
    public static IActionResult Write(string fileStem, IReadOnlyList<string> headers, IEnumerable<object?[]> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(';', headers.Select(Csv)));
        foreach (var row in rows)
            sb.AppendLine(string.Join(';', row.Select(Format)));
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }
            .Concat(Encoding.UTF8.GetBytes(sb.ToString()))
            .ToArray();
        return new FileContentResult(bytes, "text/csv; charset=utf-8") {
            FileDownloadName = $"{fileStem}.csv"
        };
    }

    private static string Format(object? v) => v switch
    {
        null => "",
        DateOnly d => d.ToString("yyyy-MM-dd"),
        DateTime dt => dt.ToString("yyyy-MM-dd HH:mm"),
        decimal m => m.ToString("F2", El),
        double d => d.ToString("F2", El),
        int i => i.ToString(El),
        long l => l.ToString(El),
        bool b => b ? "Ναι" : "Όχι",
        string s => Csv(s),
        _ => Csv(v.ToString() ?? ""),
    };

    private static string Csv(string s) =>
        (s.Contains(';') || s.Contains('"') || s.Contains('\n'))
            ? "\"" + s.Replace("\"", "\"\"") + "\""
            : s;
}
