using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Producers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Kalypsis.Api.Controllers;

[ApiController,Route("api/producers/{producerId:guid}/card"),Authorize(Policy="AgencyStaff")]
[RequiresPackage(PackageCode.BackOffice),RequirePermission("producers.read")]
public sealed partial class ProducerCardController(IAppDbContext db,ICurrentUser current,IMediator mediator,IDataProtectionProvider protection):ControllerBase
{
    public record EntryDto(Guid Id,string Kind,Dictionary<string,string> Values,DateTime CreatedAt,DateTime? UpdatedAt);
    public record EntryBody(Dictionary<string,string?> Values);
    private async Task<Producer> Own(Guid id,CancellationToken ct){var tenant=current.TenantId??throw AppException.Forbidden();return await db.Producers.FirstOrDefaultAsync(x=>x.Id==id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Συνεργάτης");}
    [HttpGet] public async Task<ActionResult<ProducerCardDto>> Get(Guid producerId,CancellationToken ct)=>Ok(await mediator.Send(new GetProducerCardQuery(producerId),ct));
    [HttpPatch("fields"),RequirePermission("producers.write")] public async Task<ActionResult<ProducerCardDto>> Fields(Guid producerId,Dictionary<string,string?> changes,CancellationToken ct)=>Ok(await mediator.Send(new SaveProducerCardFieldsCommand(producerId,changes),ct));
    [HttpGet("production")] public async Task<IActionResult> Production(Guid producerId,CancellationToken ct)
    {
        var owner=await Own(producerId,ct);var rows=await db.Policies.AsNoTracking().Where(x=>x.ProducerId==producerId&&x.TenantId==owner.TenantId&&x.DeletedAt==null)
            .OrderByDescending(x=>x.StartDate).Select(x=>new{x.Id,x.PolicyNumber,CustomerName=x.Customer.Type==CustomerType.Individual?x.Customer.LastName+" "+x.Customer.FirstName:x.Customer.CompanyName,Company=x.InsuranceCompany.Name,x.StartDate,x.EndDate,x.Premium,x.NetPremium,x.Currency,Status=x.Status.ToString(),PolicyType=x.PolicyType.ToString(),Commission=db.PolicyCommissionSplits.Where(s=>s.PolicyId==x.Id&&s.ProducerId==producerId&&s.DeletedAt==null).Sum(s=>(decimal?)s.GrossAmount)??0}).ToListAsync(ct);return Ok(rows);
    }
    [HttpGet("network")] public async Task<IActionResult> Network(Guid producerId,CancellationToken ct){var p=await Own(producerId,ct);var rows=await db.Producers.AsNoTracking().Where(x=>x.TenantId==p.TenantId&&x.DeletedAt==null&&x.ParentProducerId==producerId).Select(x=>new{x.Id,x.Code,x.Name,Status=x.Status.ToString(),HierarchyLevel=x.HierarchyLevel.ToString()}).ToListAsync(ct);return Ok(rows);}
    [HttpGet("entries/{kind}")] public async Task<ActionResult<IReadOnlyList<EntryDto>>> Entries(Guid producerId,string kind,CancellationToken ct)
    {
        var owner=await Own(producerId,ct);Definition(kind);var rows=await db.ProducerCardEntries.AsNoTracking().Where(x=>x.ProducerId==producerId&&x.TenantId==owner.TenantId&&x.Kind==kind&&x.DeletedAt==null).OrderByDescending(x=>x.CreatedAt).ToListAsync(ct);return Ok(await MergeLegacy(owner,kind,rows.Select(Public).ToList(),ct));
    }
    [HttpPost("entries/{kind}"),RequirePermission("producers.write")] public Task<ActionResult<EntryDto>> Add(Guid producerId,string kind,EntryBody body,CancellationToken ct)=>SaveEntry(producerId,kind,null,body,ct);
    [HttpPut("entries/{kind}/{entryId:guid}"),RequirePermission("producers.write")] public Task<ActionResult<EntryDto>> Update(Guid producerId,string kind,Guid entryId,EntryBody body,CancellationToken ct)=>SaveEntry(producerId,kind,entryId,body,ct);
    private static ProducerEntryDefinition Definition(string kind)=>ProducerEntrySchema.Definitions.SingleOrDefault(x=>x.Key==kind)??throw AppException.Validation("Μη υποστηριζόμενη ενότητα.");
    private static EntryDto Public(ProducerCardEntry row)=>new(row.Id,row.Kind,ProducerEntrySchema.Public(ProducerEntrySchema.Read(row.DataJson)),row.CreatedAt,row.UpdatedAt);
    private async Task<ActionResult<EntryDto>> SaveEntry(Guid producerId,string kind,Guid? entryId,EntryBody body,CancellationToken ct)
    {
        var owner=await Own(producerId,ct);Definition(kind);if(kind=="transfers")throw AppException.Validation("Οι μεταφορές χαρτοφυλακίου είναι μόνο για προβολή ιστορικού.");var row=entryId.HasValue?await db.ProducerCardEntries.FirstOrDefaultAsync(x=>x.Id==entryId&&x.ProducerId==producerId&&x.Kind==kind&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct):null;
        var addEntry=row==null;
        if(row==null){if(entryId.HasValue&&!await LegacyExists(owner,kind,entryId.Value,ct))throw AppException.NotFound("Εγγραφή");row=new ProducerCardEntry{Id=entryId??Guid.NewGuid(),ProducerId=producerId,TenantId=owner.TenantId,AgencyOfficeScopeId=owner.AgencyOfficeScopeId,Kind=kind};}
        if(entryId.HasValue&&string.IsNullOrWhiteSpace(row.DataJson)){var legacy=(await MergeLegacy(owner,kind,new List<EntryDto>(),ct)).FirstOrDefault(x=>x.Id==entryId);if(legacy!=null)row.DataJson=JsonSerializer.Serialize(legacy.Values);}
        else if(addEntry&&entryId.HasValue){var legacy=(await MergeLegacy(owner,kind,new List<EntryDto>(),ct)).FirstOrDefault(x=>x.Id==entryId);if(legacy!=null)row.DataJson=JsonSerializer.Serialize(legacy.Values);}
        Dictionary<string,string> values;try{values=ProducerEntrySchema.Normalize(kind,body.Values,ProducerEntrySchema.Read(row.DataJson));}catch(Exception ex)when(ex is FormatException or ArgumentException){throw AppException.Validation(ex.Message);}
        foreach(var key in new[]{"insuranceCompanyId","agencyOfficeId","policyId","fromProducerId","toProducerId"})if(Guid.TryParse(values.GetValueOrDefault(key),out var id)){
            var found=key=="insuranceCompanyId"?await db.InsuranceCompanies.AnyAsync(x=>x.Id==id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct):key=="agencyOfficeId"?await db.AgencyOffices.AnyAsync(x=>x.Id==id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct):key=="policyId"?await db.Policies.AnyAsync(x=>x.Id==id&&x.ProducerId==producerId&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct):await db.Producers.AnyAsync(x=>x.Id==id&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct);if(!found)throw AppException.Validation("Η συνδεδεμένη εγγραφή δεν είναι διαθέσιμη στο γραφείο.");
        }
        foreach(var key in new[]{"quotePassword","issuePassword"})if(body.Values.TryGetValue(key,out var secret)&&!string.IsNullOrEmpty(secret))values[key]=protection.CreateProtector("ProducerCard",owner.TenantId.ToString(),producerId.ToString(),row.Id.ToString(),key).Protect(secret);
        if(kind=="documents"){
            if(!values.TryGetValue("contentBase64",out var blob)||string.IsNullOrEmpty(blob))throw AppException.Validation("Επιλέξτε αρχείο.");
            values["fileName"]=Path.GetFileName(values["fileName"].Replace('\\','/'));if(string.IsNullOrWhiteSpace(values["fileName"]))throw AppException.Validation("Μη έγκυρο όνομα αρχείου.");values["sizeBytes"]=Convert.FromBase64String(blob).Length.ToString();
        }
        if(kind=="withholdings"){
            var all=await db.ProducerCardEntries.AsNoTracking().Where(x=>x.ProducerId==producerId&&x.TenantId==owner.TenantId&&x.Kind==kind&&x.Id!=row.Id&&x.DeletedAt==null).ToListAsync(ct);
            DateOnly Begin(Dictionary<string,string> v)=>DateOnly.TryParse(v.GetValueOrDefault("effectiveFrom"),out var d)?d:DateOnly.MinValue;DateOnly End(Dictionary<string,string> v)=>DateOnly.TryParse(v.GetValueOrDefault("effectiveTo"),out var d)?d:DateOnly.MaxValue;
            if(all.Any(x=>{var v=ProducerEntrySchema.Read(x.DataJson);return Begin(v)<=End(values)&&Begin(values)<=End(v);}))throw AppException.Validation("Υπάρχει όρος παρακράτησης με επικαλυπτόμενες ημερομηνίες.");
        }
        if(addEntry){if(await db.ProducerCardEntries.CountAsync(x=>x.ProducerId==producerId&&x.Kind==kind&&x.TenantId==owner.TenantId&&x.DeletedAt==null,ct)>=1000)throw AppException.Validation("Η ενότητα έχει φτάσει τις 1000 εγγραφές.");db.ProducerCardEntries.Add(row);}
        await SaveLegacy(owner,row,values,ct);row.DataJson=JsonSerializer.Serialize(values);await db.SaveChangesAsync(ct);return Ok(Public(row));
    }
    [HttpDelete("entries/{kind}/{entryId:guid}"),RequirePermission("producers.write")] public async Task<IActionResult> Delete(Guid producerId,string kind,Guid entryId,CancellationToken ct){var p=await Own(producerId,ct);Definition(kind);if(kind=="transfers")throw AppException.Validation("Οι μεταφορές χαρτοφυλακίου είναι μόνο για προβολή ιστορικού.");var row=await db.ProducerCardEntries.FirstOrDefaultAsync(x=>x.Id==entryId&&x.ProducerId==producerId&&x.TenantId==p.TenantId&&x.Kind==kind&&x.DeletedAt==null,ct);if(row==null&&!await LegacyExists(p,kind,entryId,ct))throw AppException.NotFound("Εγγραφή");if(row!=null)row.DeletedAt=DateTime.UtcNow;await DeleteLegacy(p,kind,entryId,ct);await db.SaveChangesAsync(ct);return NoContent();}
    [HttpGet("entries/documents/{entryId:guid}/file")] public async Task<IActionResult> FileContent(Guid producerId,Guid entryId,CancellationToken ct){var p=await Own(producerId,ct);var row=await db.ProducerCardEntries.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==entryId&&x.ProducerId==producerId&&x.TenantId==p.TenantId&&x.Kind=="documents"&&x.DeletedAt==null,ct)??throw AppException.NotFound("Έγγραφο");var values=ProducerEntrySchema.Read(row.DataJson);Response.Headers["X-Content-Type-Options"]="nosniff";Response.Headers["Content-Security-Policy"]="sandbox";return File(Convert.FromBase64String(values.GetValueOrDefault("contentBase64")??""),"application/octet-stream",Path.GetFileName(values.GetValueOrDefault("fileName")??"document"));}
    [HttpGet("history")] public async Task<IActionResult> History(Guid producerId,CancellationToken ct){var p=await Own(producerId,ct);var ownIds=await db.ProducerCardEntries.IgnoreQueryFilters().Where(x=>x.ProducerId==producerId&&x.TenantId==p.TenantId).Select(x=>x.Id.ToString()).ToListAsync(ct);var id=producerId.ToString();var rows=await db.AuditLogs.AsNoTracking().Where(x=>x.TenantId==p.TenantId&&x.DeletedAt==null&&(x.EntityName==nameof(Producer)&&x.EntityId==id||x.EntityName==nameof(ProducerCardEntry)&&ownIds.Contains(x.EntityId))).OrderByDescending(x=>x.CreatedAt).ToListAsync(ct);var users=await db.Users.Where(x=>x.TenantId==p.TenantId).ToDictionaryAsync(x=>x.Id,x=>x.FirstName+" "+x.LastName,ct);return Ok(rows.Select(x=>new{x.Id,Date=x.CreatedAt,x.Action,User=x.UserId.HasValue?users.GetValueOrDefault(x.UserId.Value)??"Γραφείο":"Σύστημα",Entity=x.EntityName,Changes=x.EntityName==nameof(Producer)?ProducerChanges(x.OldValues,x.NewValues):new[]{new{Field="Εγγραφή καρτέλας",Before="",After="Τα στοιχεία ενημερώθηκαν"}}}));}
    private static Dictionary<string,JsonElement> AuditProperties(string? json){try{return JsonSerializer.Deserialize<Dictionary<string,JsonElement>>(json??"{}")??new();}catch(JsonException){return new();}}
    private static object[] ProducerChanges(string? before,string? after)
    {
        var a=AuditProperties(before);var b=AuditProperties(after);var oldMeta=ProducerCardSchema.Metadata(a.GetValueOrDefault("AdditionalInfoJson").ToString());var newMeta=ProducerCardSchema.Metadata(b.GetValueOrDefault("AdditionalInfoJson").ToString());
        string Value(ProducerCardField f,bool old)=>f.Web.StartsWith('$')?(old?oldMeta:newMeta).GetValueOrDefault(f.Key)??"":(old?a:b).GetValueOrDefault(f.Web).ToString();
        return ProducerCardSchema.Definition.Fields.Where(f=>Value(f,true)!=Value(f,false)).Select(f=>(object)new{Field=f.Label,Before=Value(f,true),After=Value(f,false)}).ToArray();
    }
}
