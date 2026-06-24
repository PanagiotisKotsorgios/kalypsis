using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Operations;

/* ========= Delivery records ========= */

public record DeliveryRecordDto(
    Guid Id, Guid PolicyId, string PolicyNumber,
    DeliveryChannel Channel, DeliveryStatus Status,
    DateTime? DispatchedAt, DateTime? DeliveredAt, DateTime? AcknowledgedAt,
    string? Reference, string? Notes);

public record DeliveryRecordBody(
    Guid PolicyId, DeliveryChannel Channel, DeliveryStatus Status,
    DateTime? DispatchedAt, DateTime? DeliveredAt, DateTime? AcknowledgedAt,
    string? Reference, string? Notes);

public record ListDeliveryRecordsQuery(DeliveryStatus? Status) : IRequest<IReadOnlyList<DeliveryRecordDto>>;
public class ListDeliveryRecordsQueryHandler : IRequestHandler<ListDeliveryRecordsQuery, IReadOnlyList<DeliveryRecordDto>>
{
    private readonly IAppDbContext _db;
    public ListDeliveryRecordsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DeliveryRecordDto>> Handle(ListDeliveryRecordsQuery r, CancellationToken ct)
    {
        var q = _db.DeliveryRecords.Include(d => d.Policy).AsQueryable();
        if (r.Status.HasValue) q = q.Where(d => d.Status == r.Status);
        var rows = await q.OrderByDescending(d => d.CreatedAt).Take(1000).ToListAsync(ct);
        return rows.Select(d => new DeliveryRecordDto(
            d.Id, d.PolicyId, d.Policy.PolicyNumber, d.Channel, d.Status,
            d.DispatchedAt, d.DeliveredAt, d.AcknowledgedAt, d.Reference, d.Notes)).ToList();
    }
}

public class DeliveryRecordBodyValidator : AbstractValidator<DeliveryRecordBody>
{
    public DeliveryRecordBodyValidator() { RuleFor(x => x.PolicyId).NotEmpty(); }
}

public record UpsertDeliveryRecordCommand(Guid? Id, DeliveryRecordBody Body) : IRequest<DeliveryRecordDto>;
public class UpsertDeliveryRecordCommandValidator : AbstractValidator<UpsertDeliveryRecordCommand>
{ public UpsertDeliveryRecordCommandValidator() { RuleFor(x => x.Body).SetValidator(new DeliveryRecordBodyValidator()); } }

public class UpsertDeliveryRecordCommandHandler : IRequestHandler<UpsertDeliveryRecordCommand, DeliveryRecordDto>
{
    private readonly IAppDbContext _db;
    public UpsertDeliveryRecordCommandHandler(IAppDbContext db) => _db = db;
    public async Task<DeliveryRecordDto> Handle(UpsertDeliveryRecordCommand r, CancellationToken ct)
    {
        var b = r.Body;
        DeliveryRecord d;
        if (r.Id.HasValue)
        {
            d = await _db.DeliveryRecords.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Delivery");
        }
        else
        {
            d = new DeliveryRecord { Id = Guid.NewGuid() };
            _db.DeliveryRecords.Add(d);
        }
        d.PolicyId = b.PolicyId;
        d.Channel = b.Channel; d.Status = b.Status;
        d.DispatchedAt = b.DispatchedAt; d.DeliveredAt = b.DeliveredAt; d.AcknowledgedAt = b.AcknowledgedAt;
        d.Reference = b.Reference; d.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        d = await _db.DeliveryRecords.Include(x => x.Policy).FirstAsync(x => x.Id == d.Id, ct);
        return new DeliveryRecordDto(d.Id, d.PolicyId, d.Policy.PolicyNumber, d.Channel, d.Status,
            d.DispatchedAt, d.DeliveredAt, d.AcknowledgedAt, d.Reference, d.Notes);
    }
}

public record DeleteDeliveryRecordCommand(Guid Id) : IRequest<Unit>;
public class DeleteDeliveryRecordCommandHandler : IRequestHandler<DeleteDeliveryRecordCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteDeliveryRecordCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteDeliveryRecordCommand r, CancellationToken ct)
    {
        var d = await _db.DeliveryRecords.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Delivery");
        d.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Document folders ========= */

public record DocumentFolderDto(Guid Id, string Name, string? Description, Guid? CustomerId, string? CustomerName, Guid? ParentFolderId, string Color);
public record DocumentFolderBody(string Name, string? Description, Guid? CustomerId, Guid? ParentFolderId, string Color);

public record ListDocumentFoldersQuery(Guid? CustomerId) : IRequest<IReadOnlyList<DocumentFolderDto>>;
public class ListDocumentFoldersQueryHandler : IRequestHandler<ListDocumentFoldersQuery, IReadOnlyList<DocumentFolderDto>>
{
    private readonly IAppDbContext _db;
    public ListDocumentFoldersQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DocumentFolderDto>> Handle(ListDocumentFoldersQuery r, CancellationToken ct)
    {
        var q = _db.DocumentFolders.Include(f => f.Customer).AsQueryable();
        if (r.CustomerId.HasValue) q = q.Where(f => f.CustomerId == r.CustomerId);
        var rows = await q.OrderBy(f => f.Name).Take(500).ToListAsync(ct);
        return rows.Select(f =>
        {
            string? name = f.Customer is null ? null
                : f.Customer.Type == CustomerType.Individual
                    ? $"{f.Customer.FirstName} {f.Customer.LastName}".Trim()
                    : f.Customer.CompanyName;
            return new DocumentFolderDto(f.Id, f.Name, f.Description, f.CustomerId, name, f.ParentFolderId, f.Color);
        }).ToList();
    }
}

public class DocumentFolderBodyValidator : AbstractValidator<DocumentFolderBody>
{ public DocumentFolderBodyValidator() { RuleFor(x => x.Name).NotEmpty().MaximumLength(200); } }

public record CreateDocumentFolderCommand(DocumentFolderBody Body) : IRequest<Guid>;
public class CreateDocumentFolderCommandValidator : AbstractValidator<CreateDocumentFolderCommand>
{ public CreateDocumentFolderCommandValidator() { RuleFor(x => x.Body).SetValidator(new DocumentFolderBodyValidator()); } }

public class CreateDocumentFolderCommandHandler : IRequestHandler<CreateDocumentFolderCommand, Guid>
{
    private readonly IAppDbContext _db;
    public CreateDocumentFolderCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Guid> Handle(CreateDocumentFolderCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var f = new DocumentFolder
        {
            Id = Guid.NewGuid(), Name = b.Name.Trim(), Description = b.Description,
            CustomerId = b.CustomerId, ParentFolderId = b.ParentFolderId,
            Color = string.IsNullOrWhiteSpace(b.Color) ? "#0b2545" : b.Color
        };
        _db.DocumentFolders.Add(f);
        await _db.SaveChangesAsync(ct);
        return f.Id;
    }
}

public record DeleteDocumentFolderCommand(Guid Id) : IRequest<Unit>;
public class DeleteDocumentFolderCommandHandler : IRequestHandler<DeleteDocumentFolderCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteDocumentFolderCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteDocumentFolderCommand r, CancellationToken ct)
    {
        var f = await _db.DocumentFolders.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Folder");
        f.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= Partner portal accesses ========= */

public record PartnerPortalAccessDto(
    Guid Id, Guid ProducerId, string ProducerName,
    bool IsActive, bool CanIssuePolicies, bool CanViewCommissions, bool CanViewCustomers,
    string? Notes, DateTime? LastLoginAt);

public record PartnerPortalAccessBody(
    Guid ProducerId, bool IsActive, bool CanIssuePolicies, bool CanViewCommissions, bool CanViewCustomers, string? Notes);

public record ListPartnerPortalAccessesQuery() : IRequest<IReadOnlyList<PartnerPortalAccessDto>>;
public class ListPartnerPortalAccessesQueryHandler : IRequestHandler<ListPartnerPortalAccessesQuery, IReadOnlyList<PartnerPortalAccessDto>>
{
    private readonly IAppDbContext _db;
    public ListPartnerPortalAccessesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PartnerPortalAccessDto>> Handle(ListPartnerPortalAccessesQuery _, CancellationToken ct)
    {
        var rows = await _db.PartnerPortalAccesses.Include(a => a.Producer).OrderBy(a => a.Producer.Name).ToListAsync(ct);
        return rows.Select(a => new PartnerPortalAccessDto(
            a.Id, a.ProducerId, a.Producer.Name,
            a.IsActive, a.CanIssuePolicies, a.CanViewCommissions, a.CanViewCustomers, a.Notes, a.LastLoginAt)).ToList();
    }
}

public record UpsertPartnerPortalAccessCommand(Guid? Id, PartnerPortalAccessBody Body) : IRequest<PartnerPortalAccessDto>;
public class UpsertPartnerPortalAccessCommandHandler : IRequestHandler<UpsertPartnerPortalAccessCommand, PartnerPortalAccessDto>
{
    private readonly IAppDbContext _db;
    public UpsertPartnerPortalAccessCommandHandler(IAppDbContext db) => _db = db;
    public async Task<PartnerPortalAccessDto> Handle(UpsertPartnerPortalAccessCommand r, CancellationToken ct)
    {
        var b = r.Body;
        PartnerPortalAccess a;
        if (r.Id.HasValue)
        {
            a = await _db.PartnerPortalAccesses.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Access");
        }
        else
        {
            if (await _db.PartnerPortalAccesses.AnyAsync(x => x.ProducerId == b.ProducerId, ct))
                throw new AppException("partner_access_exists",
                    "Υπάρχει ήδη πρόσβαση για τον συνεργάτη.", 409,
                    title: "Υπάρχει ήδη πρόσβαση",
                    why: "Ο συνεργάτης έχει ήδη ενεργή ή ανενεργή πρόσβαση στο portal. Δεν επιτρέπεται διπλή εγγραφή.",
                    fix: "Επεξεργαστείτε την υπάρχουσα πρόσβαση από τη λίστα προσβάσεων αντί να δημιουργήσετε νέα.",
                    fixLink: "/app/partner-access");
            a = new PartnerPortalAccess { Id = Guid.NewGuid() };
            _db.PartnerPortalAccesses.Add(a);
        }
        a.ProducerId = b.ProducerId; a.IsActive = b.IsActive;
        a.CanIssuePolicies = b.CanIssuePolicies;
        a.CanViewCommissions = b.CanViewCommissions;
        a.CanViewCustomers = b.CanViewCustomers; a.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        a = await _db.PartnerPortalAccesses.Include(x => x.Producer).FirstAsync(x => x.Id == a.Id, ct);
        return new PartnerPortalAccessDto(a.Id, a.ProducerId, a.Producer.Name,
            a.IsActive, a.CanIssuePolicies, a.CanViewCommissions, a.CanViewCustomers, a.Notes, a.LastLoginAt);
    }
}

public record DeletePartnerPortalAccessCommand(Guid Id) : IRequest<Unit>;
public class DeletePartnerPortalAccessCommandHandler : IRequestHandler<DeletePartnerPortalAccessCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeletePartnerPortalAccessCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeletePartnerPortalAccessCommand r, CancellationToken ct)
    {
        var a = await _db.PartnerPortalAccesses.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Access");
        a.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
