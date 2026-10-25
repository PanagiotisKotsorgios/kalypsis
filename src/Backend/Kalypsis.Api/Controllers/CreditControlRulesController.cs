using Kalypsis.Api.Authorization;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/credit-control-rules")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("policies.read")]
public sealed class CreditControlRulesController(AppDbContext db) : ControllerBase
{
    public sealed record RuleDto(Guid Id, Guid CustomerId, string CustomerName, Guid? InsuranceCompanyId,
        PolicyType? PolicyType, string? Currency, decimal? MaximumOutstanding, int? MaximumOverdueDays,
        int? MaximumOpenPolicies, DateOnly EffectiveFrom, DateOnly? EffectiveTo, bool IsException,
        bool IsActive, string? Notes);
    public sealed record RuleBody(Guid CustomerId, Guid? InsuranceCompanyId, PolicyType? PolicyType,
        string? Currency, decimal? MaximumOutstanding, int? MaximumOverdueDays, int? MaximumOpenPolicies,
        DateOnly EffectiveFrom, DateOnly? EffectiveTo, bool IsException, bool IsActive, string? Notes);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RuleDto>>> List(CancellationToken ct)
    {
        var rows = await db.CreditControlRules.AsNoTracking().Include(x => x.Customer)
            .OrderBy(x => x.Customer!.LastName).ThenBy(x => x.Customer!.CompanyName)
            .ThenByDescending(x => x.EffectiveFrom).ToListAsync(ct);
        return Ok(rows.Select(Map).ToList());
    }

    [HttpPost]
    [RequirePermission("policies.write")]
    public async Task<ActionResult<RuleDto>> Create([FromBody] RuleBody body, CancellationToken ct)
    {
        Validate(body);
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == body.CustomerId && x.DeletedAt == null, ct);
        if (customer is null) return NotFound("Δεν βρέθηκε ο πελάτης.");
        if (body.InsuranceCompanyId.HasValue && !await db.InsuranceCompanies.AnyAsync(x => x.Id == body.InsuranceCompanyId && x.DeletedAt == null, ct))
            return BadRequest("Δεν βρέθηκε η ασφαλιστική εταιρεία.");
        var row = new CreditControlRule { Id = Guid.NewGuid(), CustomerId = customer.Id,
            InsuranceCompanyId = body.InsuranceCompanyId, PolicyType = body.PolicyType,
            Currency = CleanCurrency(body.Currency), MaximumOutstanding = body.MaximumOutstanding,
            MaximumOverdueDays = body.MaximumOverdueDays, MaximumOpenPolicies = body.MaximumOpenPolicies,
            EffectiveFrom = body.EffectiveFrom, EffectiveTo = body.EffectiveTo, IsException = body.IsException,
            IsActive = body.IsActive, Notes = Trim(body.Notes) };
        db.CreditControlRules.Add(row);
        await db.SaveChangesAsync(ct);
        await db.Entry(row).Reference(x => x.Customer).LoadAsync(ct);
        return Ok(Map(row));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("policies.write")]
    public async Task<ActionResult<RuleDto>> Update(Guid id, [FromBody] RuleBody body, CancellationToken ct)
    {
        Validate(body);
        var row = await db.CreditControlRules.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        if (!await db.Customers.AnyAsync(x => x.Id == body.CustomerId && x.DeletedAt == null, ct)) return NotFound("Δεν βρέθηκε ο πελάτης.");
        if (body.InsuranceCompanyId.HasValue && !await db.InsuranceCompanies.AnyAsync(x => x.Id == body.InsuranceCompanyId && x.DeletedAt == null, ct))
            return BadRequest("Δεν βρέθηκε η ασφαλιστική εταιρεία.");
        row.CustomerId = body.CustomerId; row.InsuranceCompanyId = body.InsuranceCompanyId;
        row.PolicyType = body.PolicyType; row.Currency = CleanCurrency(body.Currency);
        row.MaximumOutstanding = body.MaximumOutstanding; row.MaximumOverdueDays = body.MaximumOverdueDays;
        row.MaximumOpenPolicies = body.MaximumOpenPolicies; row.EffectiveFrom = body.EffectiveFrom;
        row.EffectiveTo = body.EffectiveTo; row.IsException = body.IsException; row.IsActive = body.IsActive;
        row.Notes = Trim(body.Notes);
        await db.SaveChangesAsync(ct);
        await db.Entry(row).Reference(x => x.Customer).LoadAsync(ct);
        return Ok(Map(row));
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("policies.write")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await db.CreditControlRules.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        row.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void Validate(RuleBody body)
    {
        if (body.CustomerId == Guid.Empty) throw new BadHttpRequestException("Επιλέξτε πελάτη.");
        if (body.MaximumOutstanding < 0 || body.MaximumOverdueDays < 0 || body.MaximumOpenPolicies < 0)
            throw new BadHttpRequestException("Τα όρια δεν μπορούν να είναι αρνητικά.");
        if (!body.IsException && !body.MaximumOutstanding.HasValue && !body.MaximumOverdueDays.HasValue && !body.MaximumOpenPolicies.HasValue)
            throw new BadHttpRequestException("Ορίστε τουλάχιστον ένα πιστωτικό όριο.");
        if (body.EffectiveTo.HasValue && body.EffectiveTo.Value < body.EffectiveFrom)
            throw new BadHttpRequestException("Η λήξη ισχύος πρέπει να είναι ίση ή μεταγενέστερη της έναρξης.");
        if (body.Currency is { Length: > 0 } currency && currency.Trim().Length != 3)
            throw new BadHttpRequestException("Το νόμισμα πρέπει να είναι τριγράμματο, π.χ. EUR.");
        if (body.Notes?.Length > 1000) throw new BadHttpRequestException("Οι σημειώσεις έχουν μέγιστο μήκος 1.000 χαρακτήρες.");
    }

    private static RuleDto Map(CreditControlRule x) => new(x.Id, x.CustomerId,
        x.Customer?.Type == CustomerType.Company ? x.Customer.CompanyName ?? x.Customer.CustomerNumber
            : $"{x.Customer?.FirstName} {x.Customer?.LastName}".Trim(), x.InsuranceCompanyId, x.PolicyType,
        x.Currency, x.MaximumOutstanding, x.MaximumOverdueDays, x.MaximumOpenPolicies,
        x.EffectiveFrom, x.EffectiveTo, x.IsException, x.IsActive, x.Notes);
    private static string? CleanCurrency(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
    private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
