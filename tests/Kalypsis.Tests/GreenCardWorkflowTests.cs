using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.GreenCards;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class GreenCardWorkflowTests
{
    private static async Task<(AppDbContext Db, FakeUser Current, Policy Policy, FixedClock Clock)> Setup()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); var clock = TestScaffold.Clock;
        var db = TestScaffold.NewDb(current, clock); var tenant = current.TenantId!.Value;
        var customer = new Customer { Id=Guid.NewGuid(),TenantId=tenant,FirstName="Άννα",LastName="Δοκιμή",Type=CustomerType.Individual };
        var company = new InsuranceCompany {Id=Guid.NewGuid(),TenantId=tenant,Name="Εταιρεία δοκιμών"};
        var policy = new Policy {Id=Guid.NewGuid(),TenantId=tenant,Customer=customer,CustomerId=customer.Id,InsuranceCompany=company,InsuranceCompanyId=company.Id,
            PolicyNumber="POL-GC",PolicyType=PolicyType.Auto,Status=PolicyStatus.Active,StartDate=new(2026,1,1),EndDate=new(2027,1,1),Premium=100,Currency="EUR",VehicleRegistrationPlate="ABC1234"};
        db.Tenants.Add(new Tenant {Id=tenant,Name="Γραφείο δοκιμών",Code="TEST-GC"}); db.Policies.Add(policy); await db.SaveChangesAsync();
        return (db,current,policy,clock);
    }
    private static GreenCardBody Body() => new(null,null,new(2026,1,1),new(2027,1,1),null,null,null,null,null,"GR, IT",null,"Παράδοση από το γραφείο",null);

    [Fact]
    public async Task Existing_handlers_create_pdf_then_record_delivery_without_changing_the_policy()
    {
        var (db,current,policy,clock)=await Setup(); await using var context=db; var storage=new Storage();
        var card=await new CreateGreenCardCommandHandler(db,current).Handle(new(policy.Id,Body()),default);
        Assert.Equal(GreenCardStatus.Draft,card.Status);
        var issued=await new IssueGreenCardCommandHandler(db,current,storage,clock).Handle(new(policy.Id,card.Id),default);
        Assert.Equal(GreenCardStatus.Issued,issued.Status); Assert.Equal(clock.UtcNow,issued.IssuedAt); Assert.NotNull(issued.PolicyDocumentId);
        Assert.StartsWith("%PDF-",Encoding.ASCII.GetString(storage.Content));
        var delivered=await new DeliverGreenCardCommandHandler(db,current,clock).Handle(new(policy.Id,card.Id,"Παράδοση από το γραφείο"),default);
        Assert.Equal(GreenCardStatus.Delivered,delivered.Status); Assert.Equal(clock.UtcNow,delivered.DeliveredAt);
        Assert.Equal(issued.PolicyDocumentId,delivered.PolicyDocumentId); Assert.Equal(1,await db.GreenCards.CountAsync());
        Assert.Equal(DocumentType.GreenCard,(await db.PolicyDocuments.SingleAsync()).DocumentType);
        Assert.Equal(100,policy.Premium); Assert.Equal(PolicyStatus.Active,policy.Status);
    }

    [Fact]
    public async Task Failed_upload_leaves_draft_and_retry_reuses_the_card_and_document()
    {
        var (db,current,policy,clock)=await Setup(); await using var context=db; var storage=new Storage {FailUpload=true};
        var card=await new CreateGreenCardCommandHandler(db,current).Handle(new(policy.Id,Body()),default);
        var handler=new IssueGreenCardCommandHandler(db,current,storage,clock);
        await Assert.ThrowsAsync<IOException>(()=>handler.Handle(new(policy.Id,card.Id),default));
        var saved=await db.GreenCards.SingleAsync(); Assert.Equal(GreenCardStatus.Draft,saved.Status); Assert.Null(saved.IssuedAt); Assert.Null(saved.PolicyDocumentId);
        Assert.Empty(await db.PolicyDocuments.ToListAsync());
        storage.FailUpload=false;
        var issued=await handler.Handle(new(policy.Id,card.Id),default);
        var retried=await handler.Handle(new(policy.Id,card.Id),default);
        Assert.Equal(issued.PolicyDocumentId,retried.PolicyDocumentId); Assert.Equal(1,await db.PolicyDocuments.CountAsync()); Assert.Equal(1,await db.GreenCards.CountAsync());
    }

    [Fact]
    public async Task Delivery_requires_an_issued_pdf_and_another_tenant_cannot_issue_the_card()
    {
        var (db,current,policy,clock)=await Setup(); await using var context=db;
        var card=await new CreateGreenCardCommandHandler(db,current).Handle(new(policy.Id,Body()),default);
        await Assert.ThrowsAsync<AppException>(()=>new DeliverGreenCardCommandHandler(db,current,clock).Handle(new(policy.Id,card.Id,null),default));
        await Assert.ThrowsAsync<AppException>(()=>new IssueGreenCardCommandHandler(db,TestScaffold.AgencyStaff(Guid.NewGuid()),new Storage(),clock).Handle(new(policy.Id,card.Id),default));
        Assert.Equal(GreenCardStatus.Draft,(await db.GreenCards.SingleAsync()).Status);
    }

    private sealed class Storage : IFileStorage
    {
        public bool FailUpload {get;set;}
        public byte[] Content {get;private set;}=[];
        public async Task<string> UploadAsync(string keyPrefix,string fileName,string contentType,Stream content,CancellationToken cancellationToken=default)
        {
            if(FailUpload)throw new IOException("Test upload failure");
            using var memory=new MemoryStream(); await content.CopyToAsync(memory,cancellationToken); Content=memory.ToArray(); return $"{keyPrefix}/{fileName}";
        }
        public Task<Stream> DownloadAsync(string storagePath,CancellationToken cancellationToken=default)=>Task.FromResult<Stream>(new MemoryStream(Content));
        public Task DeleteAsync(string storagePath,CancellationToken cancellationToken=default)=>Task.CompletedTask;
    }
}
