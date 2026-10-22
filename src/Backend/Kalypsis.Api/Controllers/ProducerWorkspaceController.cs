using System.Net.Mail;
using System.Text.RegularExpressions;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/producers/{producerId:guid}")]
[Authorize(Policy = "AgencyStaff")]
public sealed class ProducerWorkspaceController(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock, IMediator mediator) : ControllerBase
{
    private const string ContactMarker = "kalypsis:producer-contact:";
    public record ContactFieldDto(Guid Id, string Label, string Kind, string Value);
    public record ContactFieldBody(string Label, string Kind, string Value);
    public record ContactValueBody(string Value);
    private async Task<Producer> OwnProducer(Guid id, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        return await db.Producers.FirstOrDefaultAsync(row => row.Id == id && row.TenantId == tenant && row.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
    }
    [HttpGet("statistics")]
    public async Task<ActionResult<ProducerStatisticsDto>> Statistics(Guid producerId, [FromQuery] DateOnly from, [FromQuery] DateOnly to,
        [FromQuery] string dateField = "start", [FromQuery] string? currency = null, [FromQuery] Guid? insuranceCompanyId = null,
        [FromQuery] PolicyType? policyType = null, CancellationToken ct = default)
        => Ok(await mediator.Send(new GetProducerStatisticsQuery(producerId, from, to, dateField, currency, insuranceCompanyId, policyType), ct));

    [HttpGet("contact-fields")]
    public async Task<ActionResult<IReadOnlyList<ContactFieldDto>>> ContactFields(Guid producerId, CancellationToken ct)
    {
        var producer = await OwnProducer(producerId, ct);
        var fields = await db.CustomFieldValues.AsNoTracking().Include(row => row.Field)
            .Where(row => row.EntityType == "Producer" && row.EntityId == producerId && row.TenantId == producer.TenantId && row.DeletedAt == null
                && row.Field != null && row.Field.TenantId == producer.TenantId && row.Field.DeletedAt == null && row.Field.IsActive && row.Field.HelpText != null && row.Field.HelpText.StartsWith(ContactMarker))
            .OrderBy(row => row.Field!.DisplayOrder).ThenBy(row => row.CreatedAt).ToListAsync(ct);
        return Ok(fields.Select(row => new ContactFieldDto(row.Id, row.Field!.Label, row.Field.HelpText![ContactMarker.Length..], row.Value ?? "")).ToArray());
    }
    [HttpPost("contact-fields")]
    public async Task<ActionResult<ContactFieldDto>> AddContactField(Guid producerId, ContactFieldBody body, CancellationToken ct)
    {
        var producer = await OwnProducer(producerId, ct);
        if (string.IsNullOrWhiteSpace(body.Label) || body.Label.Length > 160) throw AppException.Validation("Συμπληρώστε τίτλο πεδίου έως 160 χαρακτήρες.");
        var value = Validate(body.Kind, body.Value);
        var count = await db.CustomFieldValues.CountAsync(row => row.EntityType == "Producer" && row.EntityId == producerId && row.DeletedAt == null && row.Field != null && row.Field.HelpText != null && row.Field.HelpText.StartsWith(ContactMarker), ct);
        if (count >= 100) throw AppException.Validation("Επιτρέπονται έως 100 πρόσθετα πεδία επικοινωνίας ανά συνεργάτη.");
        var field = new CustomFieldDefinition { Id = Guid.NewGuid(), TenantId = producer.TenantId, AgencyOfficeScopeId = producer.AgencyOfficeScopeId,
            EntityType = "Producer", Code = "CONTACT_" + Guid.NewGuid().ToString("N"), Label = body.Label.Trim(), Kind = "Text", HelpText = ContactMarker + body.Kind, DisplayOrder = count };
        var row = new CustomFieldValue { Id = Guid.NewGuid(), TenantId = producer.TenantId, AgencyOfficeScopeId = producer.AgencyOfficeScopeId,
            EntityType = "Producer", EntityId = producerId, FieldId = field.Id, Field = field, Value = value };
        db.CustomFieldDefinitions.Add(field); db.CustomFieldValues.Add(row); await db.SaveChangesAsync(ct);
        return Ok(new ContactFieldDto(row.Id, field.Label, body.Kind, value));
    }
    private async Task<CustomFieldValue> OwnField(Guid producerId, Guid fieldId, CancellationToken ct)
    {
        var producer = await OwnProducer(producerId, ct);
        return await db.CustomFieldValues.Include(row => row.Field).FirstOrDefaultAsync(row => row.Id == fieldId && row.EntityId == producerId && row.EntityType == "Producer"
            && row.TenantId == producer.TenantId && row.DeletedAt == null && row.Field != null && row.Field.TenantId == producer.TenantId && row.Field.DeletedAt == null
            && row.Field.IsActive && row.Field.HelpText != null && row.Field.HelpText.StartsWith(ContactMarker), ct) ?? throw AppException.NotFound("Πεδίο επικοινωνίας");
    }
    [HttpPut("contact-fields/{fieldId:guid}")]
    public async Task<ActionResult<ContactFieldDto>> SaveContactField(Guid producerId, Guid fieldId, ContactValueBody body, CancellationToken ct)
    {
        var row = await OwnField(producerId, fieldId, ct);
        var kind = row.Field!.HelpText![ContactMarker.Length..];
        row.Value = Validate(kind, body.Value); await db.SaveChangesAsync(ct);
        return Ok(new ContactFieldDto(row.Id, row.Field.Label, kind, row.Value));
    }
    [HttpDelete("contact-fields/{fieldId:guid}")]
    public async Task<IActionResult> RemoveContactField(Guid producerId, Guid fieldId, CancellationToken ct)
    {
        var row = await OwnField(producerId, fieldId, ct);
        row.DeletedAt = clock.UtcNow;
        if (!await db.CustomFieldValues.AnyAsync(other => other.FieldId == row.FieldId && other.Id != row.Id && other.DeletedAt == null, ct)) row.Field!.DeletedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct); return NoContent();
    }
    private static string Validate(string kind, string? raw)
    {
        if (kind is not ("Email" or "Phone" or "Url" or "Text")) throw AppException.Validation("Επιλέξτε τύπο επικοινωνίας.");
        var value = raw?.Trim() ?? "";
        if (value.Length > 2000) throw AppException.Validation("Το πεδίο δέχεται έως 2000 χαρακτήρες.");
        if (value.Length == 0) return value;
        if (kind == "Email" && (value.Length > 254 || !MailAddress.TryCreate(value, out var address) || !string.Equals(address.Address, value, StringComparison.OrdinalIgnoreCase)
            || !Regex.IsMatch(value, @"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$"))) throw AppException.Validation("Συμπληρώστε έγκυρο email.");
        if (kind == "Phone")
        {
            var compact = Regex.Replace(value, @"[ ()-]", "");
            if (compact.StartsWith("00")) compact = "+" + compact[2..];
            if (value.Length > 40 || !Regex.IsMatch(value, @"^\+?[0-9 ()-]+$")
                || !(Regex.IsMatch(compact, @"^[0-9]{10}$") || Regex.IsMatch(compact, @"^\+[1-9][0-9]{6,14}$") && (!compact.StartsWith("+30") || compact.Length == 13)))
                throw AppException.Validation("Συμπληρώστε 10 ψηφία ή έγκυρο διεθνή αριθμό με + / 00.");
        }
        if (kind == "Url" && (value.Length > 500 || !Uri.TryCreate(value, UriKind.Absolute, out var url) || url.Scheme is not ("http" or "https"))) throw AppException.Validation("Συμπληρώστε πλήρη διεύθυνση http:// ή https://.");
        return value;
    }
}
