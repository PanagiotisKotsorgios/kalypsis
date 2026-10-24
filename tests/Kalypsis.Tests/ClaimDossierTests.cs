using System.Reflection;
using System.Text;
using FluentValidation;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Claims;
using Kalypsis.Claims;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Xunit;
namespace Kalypsis.Tests;
public class ClaimDossierTests
{
 private sealed class Files:IFileStorage
 {
  public Dictionary<string,byte[]> Data {get;}=[];
  public async Task<string> UploadAsync(string prefix,string name,string mime,Stream stream,CancellationToken ct=default){using var output=new MemoryStream();await stream.CopyToAsync(output,ct);var key=prefix+"/"+Guid.NewGuid()+"_"+name;Data.Add(key,output.ToArray());return key;}
  public Task<Stream> DownloadAsync(string path,CancellationToken ct=default)=>Task.FromResult<Stream>(new MemoryStream(Data[path],false));
  public Task DeleteAsync(string path,CancellationToken ct=default){Data.Remove(path);return Task.CompletedTask;}
 }
 private static FormFile Pdf(string name="δήλωση.pdf"){var data=Encoding.ASCII.GetBytes("%PDF-1.4\nclaim evidence\n%%EOF");return new FormFile(new MemoryStream(data),0,data.Length,"file",name){Headers=new HeaderDictionary(),ContentType="application/octet-stream"};}
 private static ClaimDossierController Controller(Kalypsis.Infrastructure.Persistence.AppDbContext db,ICurrentUser user,Files files)=>new(db,user,files){ControllerContext=new ControllerContext{HttpContext=new DefaultHttpContext()}};
 [Fact] public async Task All_dossier_fields_and_linked_garage_roundtrip_without_destroying_older_clients_data()
 {
  var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);var c=await ClaimCardParityTests.Seed(db,user.TenantId!.Value,"DOS1");var garage=new Garage{Id=Guid.NewGuid(),TenantId=user.TenantId.Value,Code="G1",Name="Συνεργείο"};db.Garages.Add(garage);db.ClaimKinds.Add(new(){Id=Guid.NewGuid(),TenantId=user.TenantId.Value,Code="GLASS",Name="Θραύση κρυστάλλων",BranchCode=""});await db.SaveChangesAsync();
  var body=new UpdateClaimBody(c.IncidentDate,c.ReportedDate,1200,800,"Description",Kind:"GLASS",ReplaceDossier:true,CarrierClaimNumber:"INS-001",IncidentTime:"14:35",IncidentLocation:"Δοκιμαστική οδός",IncidentCity:"Αθήνα",IncidentCause:"Σύγκρουση",DamageDescription:"Μπροστινό τμήμα",PoliceInvolved:true,PoliceStation:"Τροχαία",PoliceReportNumber:"POL1",GarageId:garage.Id,AssessorName:"Εκτιμητής",AssessorPhone:"6900000000",AssessorEmail:"qa@example.com",CarrierContactName:"Υπεύθυνος",CarrierContactPhone:"2100000000",ReportedToCarrierDate:new(2026,1,3),InspectionDate:new(2026,1,4),RepairStartedDate:new(2026,1,5),RepairCompletedDate:new(2026,1,8),NextActionDate:new(2026,1,9),ClosedDate:new(2026,1,10));
  new UpdateClaimCommandValidator().ValidateAndThrow(new(c.Id,body));var handler=new UpdateClaimCommandHandler(db,user);var dto=await handler.Handle(new(c.Id,body),default);Assert.Equal("INS-001",dto.CarrierClaimNumber);Assert.Equal("14:35",dto.IncidentTime);Assert.Equal("Συνεργείο",dto.GarageName);Assert.Equal("GLASS",dto.Kind);Assert.Equal("qa@example.com",dto.AssessorEmail);Assert.True(dto.PoliceInvolved);
  var old=await handler.Handle(new(c.Id,new(c.IncidentDate,c.ReportedDate,1000,700,"Old caller")),default);Assert.Equal("POL1",old.PoliceReportNumber);Assert.Equal(garage.Id,old.GarageId);Assert.Equal(new DateOnly(2026,1,8),old.RepairCompletedDate);
  var cleared=await handler.Handle(new(c.Id,body with{CarrierClaimNumber=null,IncidentTime=null,GarageId=null,PoliceInvolved=null,DamageDescription=null}),default);Assert.Null(cleared.CarrierClaimNumber);Assert.Null(cleared.IncidentTime);Assert.Null(cleared.GarageId);Assert.Null(cleared.PoliceInvolved);
 }
 [Theory][InlineData("IncidentTime","24:00")][InlineData("IncidentTime","12:99")][InlineData("AssessorPhone","letters")][InlineData("AssessorEmail","invalid")]
 public void Claim_validation_rejects_invalid_contact_and_time_fields(string key,string raw){var body=new UpdateClaimBody(new(2026,1,1),new(2026,1,2),0,0,null);var property=typeof(UpdateClaimBody).GetProperty(key)!;property.SetValue(body,raw);Assert.False(new UpdateClaimCommandValidator().Validate(new UpdateClaimCommand(Guid.NewGuid(),body)).IsValid);}
 [Fact] public async Task Kinds_are_branch_scoped_can_be_renamed_and_disabled_without_losing_historical_claims()
 {
  var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);var controller=Controller(db,user,new());var auto=(ClaimKindRow)((OkObjectResult)(await controller.CreateKind(new("GLASS","Κρύσταλλα","Auto"))).Result!).Value!;await controller.CreateKind(new("GLASS","Τζάμια κατοικίας","Home"));
  var list=(IReadOnlyList<ClaimKindRow>)((OkObjectResult)(await controller.Kinds("Auto",false)).Result!).Value!;Assert.Equal("Κρύσταλλα",Assert.Single(list.Where(x=>x.Code=="GLASS")).Name);
  var claim=await ClaimCardParityTests.Seed(db,user.TenantId!.Value,"KIND1");claim.Kind="GLASS";await db.SaveChangesAsync();await controller.UpdateKind(auto.Id,new("GLASS","Νέα ονομασία","Auto"));await Assert.ThrowsAsync<AppException>(()=>controller.UpdateKind(auto.Id,new("CHANGED","Name","Auto")));await controller.DisableKind(auto.Id);Assert.Equal("GLASS",(await db.Claims.SingleAsync(x=>x.Id==claim.Id)).Kind);
  await controller.CreateKind(new("Fire","Πυρκαγιά",IsActive:false));claim.Kind="VehicleDamage";await db.SaveChangesAsync();await Assert.ThrowsAsync<AppException>(()=>new UpdateClaimCommandHandler(db,user).Handle(new(claim.Id,new(claim.IncidentDate,claim.ReportedDate,0,0,null,Kind:"Fire")),default));
 }
 [Fact] public async Task Evidence_upload_list_filter_preview_download_rename_and_soft_delete_work_with_claim_scoping()
 {
  var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);var claim=await ClaimCardParityTests.Seed(db,user.TenantId!.Value,"FILES1");var storage=new Files();var controller=Controller(db,user,storage);
  var uploaded=(ClaimAttachmentRow)((OkObjectResult)(await controller.Upload(claim.Id,Pdf(),"Δήλωση","AccidentStatement")).Result!).Value!;Assert.Equal("application/pdf",uploaded.MimeType);Assert.Equal("δήλωση.pdf",uploaded.FileName);Assert.Single(storage.Data);
  var page=(ClaimAttachmentPage)((OkObjectResult)(await controller.Files(claim.Id,"Δήλωση","AccidentStatement",1,10)).Result!).Value!;Assert.Equal(1,page.Total);Assert.Single(page.Items);
  var download=Assert.IsType<FileStreamResult>(await controller.Download(uploaded.Id));using(var buffer=new MemoryStream()){await download.FileStream.CopyToAsync(buffer);Assert.StartsWith("%PDF-",Encoding.ASCII.GetString(buffer.ToArray()));}var preview=Assert.IsType<FileStreamResult>(await controller.Preview(uploaded.Id));Assert.Equal("application/pdf",preview.ContentType);await preview.FileStream.DisposeAsync();
  var patched=(ClaimAttachmentRow)((OkObjectResult)(await controller.UpdateFile(uploaded.Id,new("Νέος τίτλος","Other","Σημείωση"))).Result!).Value!;Assert.Equal("Νέος τίτλος",patched.Title);Assert.Equal("δήλωση.pdf",patched.FileName);
  var outsider=TestScaffold.AgencyStaff(Guid.NewGuid());var foreign=Controller(db,outsider,storage);await Assert.ThrowsAsync<AppException>(()=>foreign.Download(uploaded.Id));await Assert.ThrowsAsync<AppException>(()=>foreign.Files(claim.Id,null,null));
  await controller.DeleteFile(uploaded.Id);Assert.Empty(await db.ClaimAttachments.ToListAsync());Assert.NotNull((await db.ClaimAttachments.IgnoreQueryFilters().SingleAsync()).DeletedAt);Assert.Single(storage.Data);
 }
 [Fact] public async Task Invalid_attachments_and_foreign_garages_are_rejected_before_storage_or_claim_changes()
 {
  var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);var claim=await ClaimCardParityTests.Seed(db,user.TenantId!.Value,"FILES2");var storage=new Files();var controller=Controller(db,user,storage);await Assert.ThrowsAsync<AppException>(()=>controller.Upload(claim.Id,Pdf("fake.png"),null));await Assert.ThrowsAsync<AppException>(()=>controller.Upload(Guid.NewGuid(),Pdf(),null));Assert.Empty(storage.Data);
  var other=TestScaffold.AgencyStaff(Guid.NewGuid());var foreignGarage=new Garage{Id=Guid.NewGuid(),TenantId=other.TenantId!.Value,Code="G2",Name="Foreign"};await using(var foreignDb=new Kalypsis.Infrastructure.Persistence.AppDbContext((DbContextOptions<Kalypsis.Infrastructure.Persistence.AppDbContext>)db.GetService<IDbContextOptions>(),other,TestScaffold.Clock)){foreignDb.Garages.Add(foreignGarage);await foreignDb.SaveChangesAsync();}await Assert.ThrowsAsync<AppException>(()=>new UpdateClaimCommandHandler(db,user).Handle(new(claim.Id,new(claim.IncidentDate,claim.ReportedDate,0,0,null,GarageId:foreignGarage.Id,ReplaceDossier:true)),default));Assert.Null(claim.GarageId);
 }
 [Fact] public async Task New_claim_uses_the_selected_office_kind_and_rejects_inactive_or_other_branch_codes()
 {
  var user=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(user,TestScaffold.Clock);var seed=await ClaimCardParityTests.Seed(db,user.TenantId!.Value,"CREATE1");seed.Policy.PolicyType=PolicyType.Auto;db.ClaimKinds.AddRange(new(){Id=Guid.NewGuid(),TenantId=user.TenantId.Value,Code="CUSTOM",Name="Είδος γραφείου",BranchCode="Auto"},new(){Id=Guid.NewGuid(),TenantId=user.TenantId.Value,Code="HOME",Name="Είδος κατοικίας",BranchCode="Home"},new(){Id=Guid.NewGuid(),TenantId=user.TenantId.Value,Code="OFF",Name="Ανενεργό",IsActive=false});await db.SaveChangesAsync();var handler=new CreateClaimCommandHandler(db,user,TestScaffold.Clock);var created=await handler.Handle(new(new(seed.PolicyId,new(2026,1,5),new(2026,1,6),100,"New",Kind:"CUSTOM")),default);Assert.Equal("CUSTOM",created.Kind);await Assert.ThrowsAsync<AppException>(()=>handler.Handle(new(new(seed.PolicyId,new(2026,1,5),null,0,null,Kind:"OFF")),default));await Assert.ThrowsAsync<AppException>(()=>handler.Handle(new(new(seed.PolicyId,new(2026,1,5),null,0,null,Kind:"HOME")),default));
 }
 [Fact] public async Task Customer_can_read_only_their_own_claim_evidence_and_does_not_receive_internal_notes()
 {
  var staff=TestScaffold.AgencyStaff(Guid.NewGuid());await using var db=TestScaffold.NewDb(staff,TestScaffold.Clock);var own=await ClaimCardParityTests.Seed(db,staff.TenantId!.Value,"OWN1");var other=await ClaimCardParityTests.Seed(db,staff.TenantId.Value,"OTHER1");var account=new User{Id=Guid.NewGuid(),TenantId=staff.TenantId.Value,Email="claim-customer@example.invalid",PasswordHash="fixture",CustomerId=own.Policy.CustomerId,Role=Role.Customer};db.Users.Add(account);await db.SaveChangesAsync();var storage=new Files();var admin=Controller(db,staff,storage);var row=(ClaimAttachmentRow)((OkObjectResult)(await admin.Upload(own.Id,Pdf(),"Δήλωση",notes:"Internal note")).Result!).Value!;
  var customer=new FakeUser(account.Id,staff.TenantId,Role.Customer,false,false);var controller=Controller(db,customer,storage);var page=(ClaimAttachmentPage)((OkObjectResult)(await controller.Files(own.Id,null,null)).Result!).Value!;Assert.Null(Assert.Single(page.Items).Notes);await Assert.ThrowsAsync<AppException>(()=>controller.Files(other.Id,null,null));var download=Assert.IsType<FileStreamResult>(await controller.Download(row.Id));await download.FileStream.DisposeAsync();
 }
 [Fact] public void Every_write_endpoint_requires_agency_staff_and_file_validation_is_shared()
 {
  foreach(var name in new[]{"CreateKind","UpdateKind","DisableKind","Upload","UpdateFile","DeleteFile"})Assert.Contains(typeof(ClaimDossierController).GetMethod(name)!.GetCustomAttributes<AuthorizeAttribute>(),a=>a.Policy=="AgencyStaff");
  Assert.Throws<ArgumentException>(()=>ClaimDossierRules.ValidateFile("file.exe",3,[0x4D,0x5A,0]));Assert.Throws<ArgumentException>(()=>ClaimDossierRules.ValidateFile("file.pdf",ClaimDossierRules.MaxFileBytes+1,[0x25,0x50,0x44,0x46,0x2D]));Assert.Equal("photo.png",ClaimDossierRules.FileName("../../photo.png"));
 }
}
