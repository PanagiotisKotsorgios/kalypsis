using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Claims;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace Kalypsis.Api.Controllers;
public record ClaimKindBody(string Code,string Name,string? BranchCode=null,bool IsActive=true);
public record ClaimKindRow(Guid Id,string Code,string Name,string BranchCode,bool IsActive);
public record ClaimAttachmentBody(string Title,string DocumentKind,string? Notes=null);
public record ClaimAttachmentRow(Guid Id,Guid ClaimId,string Title,string DocumentKind,string FileName,string MimeType,long SizeBytes,string? Notes,DateTime CreatedAt);
public record ClaimAttachmentPage(IReadOnlyList<ClaimAttachmentRow> Items,int Total,int Page,int PageSize);
[ApiController,Authorize,RequirePermission("claims.read")]
[Route("api")]
public class ClaimDossierController(IAppDbContext db,ICurrentUser current,IFileStorage storage):ControllerBase
{
 private Guid Tenant=>current.TenantId??throw AppException.Forbidden();
 private static AppException Invalid(string message)=>new("validation",message,400);
 private async Task<Claim> ClaimAccess(Guid id,CancellationToken ct)
 {
  var tenant=Tenant;var claim=await db.Claims.Include(x=>x.Policy).FirstOrDefaultAsync(x=>x.Id==id&&x.TenantId==tenant&&x.DeletedAt==null&&x.Policy.DeletedAt==null,ct)??throw AppException.NotFound("Ζημιά");
  if(current.Role==Role.Customer){var customer=await db.Users.Where(x=>x.Id==current.UserId&&x.TenantId==tenant&&x.DeletedAt==null).Select(x=>x.CustomerId).FirstOrDefaultAsync(ct);if(customer==null||claim.Policy.CustomerId!=customer)throw AppException.Forbidden();}return claim;
 }
 [HttpGet("claim-kinds")]
 public async Task<ActionResult<IReadOnlyList<ClaimKindRow>>> Kinds([FromQuery]string? branchCode,[FromQuery]bool all=false,CancellationToken ct=default)
 {
  var tenant=Tenant;var rows=await db.ClaimKinds.Where(x=>x.TenantId==tenant&&x.DeletedAt==null).OrderBy(x=>x.Name).ToListAsync(ct);
  var result=rows.Select(x=>new ClaimKindRow(x.Id,x.Code,x.Name,x.BranchCode,x.IsActive)).Concat(ClaimDossierRules.LegacyKinds.Where(k=>!rows.Any(x=>x.Code==k.Code&&x.BranchCode=="")).Select(k=>new ClaimKindRow(Guid.Empty,k.Code,k.Name,"",true)));
  if(branchCode!=null){var branch=ClaimDossierRules.Branch(branchCode);result=result.Where(x=>x.BranchCode==""||x.BranchCode==branch);if(!all)result=result.OrderByDescending(x=>x.BranchCode==branch&&branch!="").GroupBy(x=>x.Code).Select(g=>g.First());}if(!all)result=result.Where(x=>x.IsActive);return Ok(result.ToArray());
 }
 private static ClaimKindBody ValidateKind(ClaimKindBody body)
 {
  var code=body.Code?.Trim()??"";var name=body.Name?.Trim()??"";var branch=ClaimDossierRules.Branch(body.BranchCode);
  if(code.Length is <1 or >60||name.Length is <1 or >160||branch.Length>60)throw Invalid("Συμπληρώστε κωδικό, ονομασία και έγκυρο κλάδο.");return body with{Code=code,Name=name,BranchCode=branch};
 }
 [HttpPost("claim-kinds"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write")]
 public async Task<ActionResult<ClaimKindRow>> CreateKind([FromBody]ClaimKindBody body,CancellationToken ct=default)
 {
  body=ValidateKind(body);var tenant=Tenant;if(await db.ClaimKinds.IgnoreQueryFilters().AnyAsync(x=>x.TenantId==tenant&&x.Code==body.Code&&x.BranchCode==body.BranchCode,ct))throw new AppException("claim_kind_exists","Υπάρχει ήδη αυτός ο κωδικός στον κλάδο.",409);
  var row=new ClaimKind{Id=Guid.NewGuid(),TenantId=tenant,Code=body.Code,Name=body.Name,BranchCode=body.BranchCode!,IsActive=body.IsActive};db.ClaimKinds.Add(row);await db.SaveChangesAsync(ct);return Ok(new ClaimKindRow(row.Id,row.Code,row.Name,row.BranchCode,row.IsActive));
 }
 [HttpPut("claim-kinds/{id:guid}"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write")]
 public async Task<ActionResult<ClaimKindRow>> UpdateKind(Guid id,[FromBody]ClaimKindBody body,CancellationToken ct=default)
 {
  body=ValidateKind(body);var tenant=Tenant;var row=await db.ClaimKinds.FirstOrDefaultAsync(x=>x.Id==id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Είδος ζημιάς");
  if((row.Code!=body.Code||row.BranchCode!=body.BranchCode)&&await db.Claims.AnyAsync(x=>x.TenantId==tenant&&x.Kind==row.Code,ct))throw new AppException("claim_kind_linked","Ο κωδικός χρησιμοποιείται σε ζημιές. Μπορείτε να αλλάξετε την ονομασία ή να τον απενεργοποιήσετε.",409);
  if(await db.ClaimKinds.IgnoreQueryFilters().AnyAsync(x=>x.TenantId==tenant&&x.Id!=id&&x.Code==body.Code&&x.BranchCode==body.BranchCode,ct))throw new AppException("claim_kind_exists","Υπάρχει ήδη αυτός ο κωδικός στον κλάδο.",409);
  row.Code=body.Code;row.Name=body.Name;row.BranchCode=body.BranchCode!;row.IsActive=body.IsActive;await db.SaveChangesAsync(ct);return Ok(new ClaimKindRow(row.Id,row.Code,row.Name,row.BranchCode,row.IsActive));
 }
 [HttpDelete("claim-kinds/{id:guid}"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write")]
 public async Task<IActionResult> DisableKind(Guid id,CancellationToken ct=default){var tenant=Tenant;var row=await db.ClaimKinds.FirstOrDefaultAsync(x=>x.Id==id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Είδος ζημιάς");row.IsActive=false;await db.SaveChangesAsync(ct);return NoContent();}
 private ClaimAttachmentRow Map(ClaimAttachment row)=>new(row.Id,row.ClaimId,row.Title,row.DocumentKind,row.FileName,row.MimeType,row.SizeBytes,current.Role==Role.Customer?null:row.Notes,row.CreatedAt);
 private static ClaimAttachmentBody ValidateMetadata(ClaimAttachmentBody body){var title=body.Title?.Trim()??"";if(title.Length is <1 or >200||(body.Notes?.Length??0)>2000||!ClaimDossierRules.DocumentKinds.Any(k=>k.Code==body.DocumentKind))throw Invalid("Συμπληρώστε τίτλο έως 200 χαρακτήρες και έγκυρο είδος δικαιολογητικού.");return body with{Title=title,Notes=body.Notes?.Trim()};}
 [HttpGet("claims/{id:guid}/attachments")]
 public async Task<ActionResult<ClaimAttachmentPage>> Files(Guid id,[FromQuery]string? search,[FromQuery]string? kind,[FromQuery]int page=1,[FromQuery]int pageSize=20,CancellationToken ct=default)
 {
  await ClaimAccess(id,ct);var tenant=Tenant;var q=db.ClaimAttachments.Where(x=>x.ClaimId==id&&x.TenantId==tenant&&x.DeletedAt==null);if(!string.IsNullOrWhiteSpace(search)){search=search.Trim();q=q.Where(x=>x.Title.Contains(search)||x.FileName.Contains(search));}if(!string.IsNullOrWhiteSpace(kind))q=q.Where(x=>x.DocumentKind==kind);
  var total=await q.CountAsync(ct);pageSize=Math.Clamp(pageSize,1,100);page=Math.Clamp(page,1,Math.Max(1,(total+pageSize-1)/pageSize));var rows=await q.OrderByDescending(x=>x.CreatedAt).Skip((page-1)*pageSize).Take(pageSize).ToListAsync(ct);return Ok(new ClaimAttachmentPage(rows.Select(Map).ToArray(),total,page,pageSize));
 }
 [HttpPost("claims/{id:guid}/attachments"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write"),RequestSizeLimit(25_000_000)]
 public async Task<ActionResult<ClaimAttachmentRow>> Upload(Guid id,IFormFile file,[FromForm]string? title,[FromForm]string documentKind="Other",[FromForm]string? notes=null,CancellationToken ct=default)
 {
  await ClaimAccess(id,ct);if(file==null||file.Length<=0||file.Length>ClaimDossierRules.MaxFileBytes)throw Invalid("Επιλέξτε αρχείο έως 20 MB.");string name;try{name=ClaimDossierRules.FileName(file.FileName);}catch(ArgumentException ex){throw Invalid(ex.Message);}var body=ValidateMetadata(new(title??name,documentKind,notes));
  await using var stream=file.OpenReadStream();var header=new byte[12];var read=await stream.ReadAtLeastAsync(header,12,false,ct);string mime;try{mime=ClaimDossierRules.ValidateFile(name,file.Length,header[..read]);}catch(ArgumentException ex){throw Invalid(ex.Message);}if(!stream.CanSeek){throw Invalid("Δεν ήταν δυνατή η ανάγνωση του αρχείου.");}stream.Position=0;
  var tenant=Tenant;var key=await storage.UploadAsync($"{tenant}/claims/{id}",name,mime,stream,ct);var row=new ClaimAttachment{Id=Guid.NewGuid(),TenantId=tenant,ClaimId=id,Title=body.Title,DocumentKind=body.DocumentKind,FileName=name,MimeType=mime,StoragePath=key,SizeBytes=file.Length,Notes=body.Notes};
  try{db.ClaimAttachments.Add(row);await db.SaveChangesAsync(ct);}catch{try{await storage.DeleteAsync(key,ct);}catch{}throw;}return Ok(Map(row));
 }
 private async Task<ClaimAttachment> FileAccess(Guid id,CancellationToken ct){var tenant=Tenant;var row=await db.ClaimAttachments.FirstOrDefaultAsync(x=>x.Id==id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Δικαιολογητικό");await ClaimAccess(row.ClaimId,ct);return row;}
 [HttpGet("claim-attachments/{id:guid}/download")]
 public async Task<IActionResult> Download(Guid id,CancellationToken ct=default){var row=await FileAccess(id,ct);var stream=await storage.DownloadAsync(row.StoragePath,ct);return File(stream,row.MimeType,row.FileName);}
 [HttpGet("claim-attachments/{id:guid}/preview")]
 public async Task<IActionResult> Preview(Guid id,CancellationToken ct=default){var row=await FileAccess(id,ct);if(row.MimeType!="application/pdf"&&!row.MimeType.StartsWith("image/"))throw Invalid("Για αυτόν τον τύπο αρχείου χρησιμοποιήστε Λήψη.");Response.Headers["X-Content-Type-Options"]="nosniff";Response.Headers["Content-Disposition"]=new System.Net.Mime.ContentDisposition{FileName=row.FileName,Inline=true}.ToString();return File(await storage.DownloadAsync(row.StoragePath,ct),row.MimeType);}
 [HttpPatch("claim-attachments/{id:guid}"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write")]
 public async Task<ActionResult<ClaimAttachmentRow>> UpdateFile(Guid id,[FromBody]ClaimAttachmentBody body,CancellationToken ct=default){body=ValidateMetadata(body);var row=await FileAccess(id,ct);row.Title=body.Title;row.DocumentKind=body.DocumentKind;row.Notes=body.Notes;await db.SaveChangesAsync(ct);return Ok(Map(row));}
 [HttpDelete("claim-attachments/{id:guid}"),Authorize(Policy="AgencyStaff"),RequirePermission("claims.write")]
 public async Task<IActionResult> DeleteFile(Guid id,CancellationToken ct=default){var row=await FileAccess(id,ct);row.DeletedAt=DateTime.UtcNow;await db.SaveChangesAsync(ct);return NoContent();}
}
