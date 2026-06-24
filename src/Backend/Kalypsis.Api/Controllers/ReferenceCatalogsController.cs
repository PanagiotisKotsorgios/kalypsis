using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

// ============================================================================
// Phase 9 — Reference catalogs (Banks, Tax offices, Customer/Producer categories,
// Cities, Nationalities, Occupations, Legal forms). Single controller for
// brevity — each entity gets a GET + POST + PUT + DELETE.
// ============================================================================

public static class CatalogCommonHelpers
{
    public static ActionResult NotFoundEnvelope(string entity) => new ObjectResult(new
    {
        code = "not_found",
        message = $"{entity} δεν βρέθηκε.",
        title = "Δεν βρέθηκε",
        why = $"Το {entity} που ζητήσατε δεν υπάρχει στη βάση ή έχει διαγραφεί.",
        fix = "Επιστρέψτε στη λίστα και ξανα-επιλέξτε.",
        severity = "error"
    }) { StatusCode = 404 };
}

[ApiController]
[Route("api/lookups/banks")]
[Authorize(Policy = "AgencyStaff")]
public class BanksController : ControllerBase
{
    private readonly AppDbContext _db;
    public BanksController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, string? Swift, string? AccountIban, bool IsActive, int DisplayOrder);
    public record Body(string Code, string Name, string? Swift, string? AccountIban, bool IsActive, int DisplayOrder);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.Banks.Where(b => b.DeletedAt == null).OrderBy(b => b.DisplayOrder).ThenBy(b => b.Name)
            .Select(b => new Dto(b.Id, b.Code, b.Name, b.Swift, b.AccountIban, b.IsActive, b.DisplayOrder)).ToListAsync(ct));

    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var b = new Bank { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(), Name = body.Name.Trim(),
            Swift = body.Swift, AccountIban = body.AccountIban, IsActive = body.IsActive, DisplayOrder = body.DisplayOrder };
        _db.Banks.Add(b); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(b.Id, b.Code, b.Name, b.Swift, b.AccountIban, b.IsActive, b.DisplayOrder));
    }
    [HttpPut("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Update(Guid id, [FromBody] Body body, CancellationToken ct) {
        var b = await _db.Banks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return CatalogCommonHelpers.NotFoundEnvelope("Τράπεζα");
        b.Code = body.Code.Trim().ToUpperInvariant(); b.Name = body.Name.Trim();
        b.Swift = body.Swift; b.AccountIban = body.AccountIban; b.IsActive = body.IsActive; b.DisplayOrder = body.DisplayOrder;
        await _db.SaveChangesAsync(ct);
        return Ok(new Dto(b.Id, b.Code, b.Name, b.Swift, b.AccountIban, b.IsActive, b.DisplayOrder));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var b = await _db.Banks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return CatalogCommonHelpers.NotFoundEnvelope("Τράπεζα");
        b.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/tax-offices")]
[Authorize(Policy = "AgencyStaff")]
public class TaxOfficesController : ControllerBase
{
    private readonly AppDbContext _db;
    public TaxOfficesController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, string? City, bool IsActive);
    public record Body(string Code, string Name, string? City, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.TaxOffices.Where(t => t.DeletedAt == null).OrderBy(t => t.Name)
            .Select(t => new Dto(t.Id, t.Code, t.Name, t.City, t.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var t = new TaxOffice { Id = Guid.NewGuid(), Code = body.Code.Trim(), Name = body.Name.Trim(), City = body.City, IsActive = body.IsActive };
        _db.TaxOffices.Add(t); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(t.Id, t.Code, t.Name, t.City, t.IsActive));
    }
    [HttpPut("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Update(Guid id, [FromBody] Body body, CancellationToken ct) {
        var t = await _db.TaxOffices.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return CatalogCommonHelpers.NotFoundEnvelope("Δ.Ο.Υ.");
        t.Code = body.Code.Trim(); t.Name = body.Name.Trim(); t.City = body.City; t.IsActive = body.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new Dto(t.Id, t.Code, t.Name, t.City, t.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var t = await _db.TaxOffices.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return CatalogCommonHelpers.NotFoundEnvelope("Δ.Ο.Υ.");
        t.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/customer-categories")]
[Authorize(Policy = "AgencyStaff")]
public class CustomerCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public CustomerCategoriesController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, string? ColorHex, int DisplayOrder, bool IsActive);
    public record Body(string Code, string Name, string? ColorHex, int DisplayOrder, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.CustomerCategories.Where(c => c.DeletedAt == null).OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Code, c.Name, c.ColorHex, c.DisplayOrder, c.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new CustomerCategory { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(), Name = body.Name.Trim(),
            ColorHex = body.ColorHex, DisplayOrder = body.DisplayOrder, IsActive = body.IsActive };
        _db.CustomerCategories.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.ColorHex, c.DisplayOrder, c.IsActive));
    }
    [HttpPut("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Update(Guid id, [FromBody] Body body, CancellationToken ct) {
        var c = await _db.CustomerCategories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Κατηγορία πελάτη");
        c.Code = body.Code.Trim().ToUpperInvariant(); c.Name = body.Name.Trim();
        c.ColorHex = body.ColorHex; c.DisplayOrder = body.DisplayOrder; c.IsActive = body.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.ColorHex, c.DisplayOrder, c.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.CustomerCategories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Κατηγορία πελάτη");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/producer-categories")]
[Authorize(Policy = "AgencyStaff")]
public class ProducerCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProducerCategoriesController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, int DisplayOrder, bool IsActive);
    public record Body(string Code, string Name, int DisplayOrder, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.ProducerCategories.Where(c => c.DeletedAt == null).OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Code, c.Name, c.DisplayOrder, c.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new ProducerCategory { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(),
            Name = body.Name.Trim(), DisplayOrder = body.DisplayOrder, IsActive = body.IsActive };
        _db.ProducerCategories.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.DisplayOrder, c.IsActive));
    }
    [HttpPut("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Update(Guid id, [FromBody] Body body, CancellationToken ct) {
        var c = await _db.ProducerCategories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Κατηγορία συνεργάτη");
        c.Code = body.Code.Trim().ToUpperInvariant(); c.Name = body.Name.Trim();
        c.DisplayOrder = body.DisplayOrder; c.IsActive = body.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.DisplayOrder, c.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.ProducerCategories.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Κατηγορία συνεργάτη");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/legal-forms")]
[Authorize(Policy = "AgencyStaff")]
public class LegalFormsController : ControllerBase
{
    private readonly AppDbContext _db;
    public LegalFormsController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, bool IsActive);
    public record Body(string Code, string Name, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.LegalForms.Where(c => c.DeletedAt == null).OrderBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Code, c.Name, c.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new LegalForm { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(),
            Name = body.Name.Trim(), IsActive = body.IsActive };
        _db.LegalForms.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.IsActive));
    }
    [HttpPut("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Update(Guid id, [FromBody] Body body, CancellationToken ct) {
        var c = await _db.LegalForms.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Νομική μορφή");
        c.Code = body.Code.Trim().ToUpperInvariant(); c.Name = body.Name.Trim(); c.IsActive = body.IsActive;
        await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.LegalForms.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Νομική μορφή");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/nationalities")]
[Authorize(Policy = "AgencyStaff")]
public class NationalitiesController : ControllerBase
{
    private readonly AppDbContext _db;
    public NationalitiesController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Iso2, string Name, bool IsActive);
    public record Body(string Iso2, string Name, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.Nationalities.Where(c => c.DeletedAt == null).OrderBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Iso2, c.Name, c.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new Nationality { Id = Guid.NewGuid(), Iso2 = body.Iso2.Trim().ToUpperInvariant(),
            Name = body.Name.Trim(), IsActive = body.IsActive };
        _db.Nationalities.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Iso2, c.Name, c.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.Nationalities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Υπηκοότητα");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/cities")]
[Authorize(Policy = "AgencyStaff")]
public class CitiesController : ControllerBase
{
    private readonly AppDbContext _db;
    public CitiesController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Name, string? Region, string? PostalCode, int DisplayOrder);
    public record Body(string Name, string? Region, string? PostalCode, int DisplayOrder);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.Cities.Where(c => c.DeletedAt == null).OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Name, c.Region, c.PostalCode, c.DisplayOrder)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new City { Id = Guid.NewGuid(), Name = body.Name.Trim(), Region = body.Region,
            PostalCode = body.PostalCode, DisplayOrder = body.DisplayOrder };
        _db.Cities.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Name, c.Region, c.PostalCode, c.DisplayOrder));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.Cities.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Πόλη");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}

[ApiController]
[Route("api/lookups/occupations")]
[Authorize(Policy = "AgencyStaff")]
public class OccupationsController : ControllerBase
{
    private readonly AppDbContext _db;
    public OccupationsController(AppDbContext db) => _db = db;
    public record Dto(Guid Id, string Code, string Name, string? Category, bool IsActive);
    public record Body(string Code, string Name, string? Category, bool IsActive);

    [HttpGet] public async Task<ActionResult<IReadOnlyList<Dto>>> List(CancellationToken ct) =>
        Ok(await _db.Occupations.Where(c => c.DeletedAt == null).OrderBy(c => c.Name)
            .Select(c => new Dto(c.Id, c.Code, c.Name, c.Category, c.IsActive)).ToListAsync(ct));
    [HttpPost][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult<Dto>> Create([FromBody] Body body, CancellationToken ct) {
        var c = new Occupation { Id = Guid.NewGuid(), Code = body.Code.Trim().ToUpperInvariant(),
            Name = body.Name.Trim(), Category = body.Category, IsActive = body.IsActive };
        _db.Occupations.Add(c); await _db.SaveChangesAsync(ct);
        return Ok(new Dto(c.Id, c.Code, c.Name, c.Category, c.IsActive));
    }
    [HttpDelete("{id:guid}")][Authorize(Policy = "AgencyAdmin")] public async Task<ActionResult> Delete(Guid id, CancellationToken ct) {
        var c = await _db.Occupations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (c is null) return CatalogCommonHelpers.NotFoundEnvelope("Επάγγελμα");
        c.DeletedAt = DateTime.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }
}
