using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformContractors;

public record ContractorDto(
    Guid Id, string Name, string Email, string? Phone, string? AfmVat,
    bool Active, string? Notes, DateTime CreatedAt);

public record AssignmentDto(
    Guid Id, Guid ContractorId, Guid TenantId,
    decimal MonthlyPrice, string Currency,
    DateTime StartedOn, DateTime? EndedOn, string? Notes,
    decimal KalypsisCommissionPercent,   // 0..100
    decimal KalypsisMonthlyRevenue);     // MonthlyPrice × pct / 100, rounded to cents

/* ============================ Contractor CRUD ============================ */

public record ListContractorsQuery : IRequest<IReadOnlyList<ContractorDto>>;
public class ListContractorsHandler : IRequestHandler<ListContractorsQuery, IReadOnlyList<ContractorDto>>
{
    private readonly IAppDbContext _db;
    public ListContractorsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ContractorDto>> Handle(ListContractorsQuery _, CancellationToken ct)
    {
        var rows = await _db.Contractors
            .Where(c => c.DeletedAt == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
        return rows.Select(c => new ContractorDto(
            c.Id, c.Name, c.Email, c.Phone, c.AfmVat, c.Active, c.Notes, c.CreatedAt
        )).ToList();
    }
}

public record UpsertContractorCommand(
    Guid? Id, string Name, string Email, string? Phone, string? AfmVat,
    bool Active, string? Notes) : IRequest<ContractorDto>;

public class UpsertContractorValidator : AbstractValidator<UpsertContractorCommand>
{
    public UpsertContractorValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class UpsertContractorHandler : IRequestHandler<UpsertContractorCommand, ContractorDto>
{
    private readonly IAppDbContext _db;
    public UpsertContractorHandler(IAppDbContext db) => _db = db;
    public async Task<ContractorDto> Handle(UpsertContractorCommand r, CancellationToken ct)
    {
        Contractor c;
        if (r.Id.HasValue)
        {
            c = await _db.Contractors.FirstOrDefaultAsync(x => x.Id == r.Id.Value && x.DeletedAt == null, ct)
                ?? throw AppException.NotFound("Contractor");
        }
        else
        {
            c = new Contractor();
            _db.Contractors.Add(c);
        }
        c.Name = r.Name.Trim();
        c.Email = r.Email.Trim();
        c.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone.Trim();
        c.AfmVat = string.IsNullOrWhiteSpace(r.AfmVat) ? null : r.AfmVat.Trim();
        c.Active = r.Active;
        c.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        await _db.SaveChangesAsync(ct);
        return new ContractorDto(c.Id, c.Name, c.Email, c.Phone, c.AfmVat, c.Active, c.Notes, c.CreatedAt);
    }
}

public record DeleteContractorCommand(Guid Id) : IRequest;
public class DeleteContractorHandler : IRequestHandler<DeleteContractorCommand>
{
    private readonly IAppDbContext _db;
    public DeleteContractorHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteContractorCommand r, CancellationToken ct)
    {
        var c = await _db.Contractors.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Contractor");
        c.DeletedAt = DateTime.UtcNow;
        // Cascade-delete active assignments — SuperAdmin is removing the
        // contractor entirely, not just deactivating them.
        var assignments = await _db.ContractorAssignments
            .Where(a => a.ContractorId == r.Id && a.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var a in assignments) a.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

/* ============================ Assignment CRUD ============================ */

public record ListAssignmentsQuery : IRequest<IReadOnlyList<AssignmentDto>>;
public class ListAssignmentsHandler : IRequestHandler<ListAssignmentsQuery, IReadOnlyList<AssignmentDto>>
{
    private readonly IAppDbContext _db;
    public ListAssignmentsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<AssignmentDto>> Handle(ListAssignmentsQuery _, CancellationToken ct)
    {
        var rows = await _db.ContractorAssignments
            .Where(a => a.DeletedAt == null)
            .OrderByDescending(a => a.StartedOn)
            .ToListAsync(ct);
        return rows.Select(a => new AssignmentDto(
            a.Id, a.ContractorId, a.TenantId,
            a.MonthlyPrice, a.Currency,
            a.StartedOn, a.EndedOn, a.Notes,
            a.KalypsisCommissionPercent,
            Math.Round(a.MonthlyPrice * Math.Clamp(a.KalypsisCommissionPercent, 0m, 100m) / 100m, 2, MidpointRounding.AwayFromZero)
        )).ToList();
    }
}

public record UpsertAssignmentCommand(
    Guid? Id, Guid ContractorId, Guid TenantId,
    decimal MonthlyPrice, string Currency,
    DateTime StartedOn, DateTime? EndedOn, string? Notes,
    decimal KalypsisCommissionPercent) : IRequest<AssignmentDto>;

public class UpsertAssignmentValidator : AbstractValidator<UpsertAssignmentCommand>
{
    public UpsertAssignmentValidator()
    {
        RuleFor(x => x.ContractorId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.MonthlyPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.KalypsisCommissionPercent).InclusiveBetween(0m, 100m);
    }
}

public class UpsertAssignmentHandler : IRequestHandler<UpsertAssignmentCommand, AssignmentDto>
{
    private readonly IAppDbContext _db;
    public UpsertAssignmentHandler(IAppDbContext db) => _db = db;
    public async Task<AssignmentDto> Handle(UpsertAssignmentCommand r, CancellationToken ct)
    {
        ContractorAssignment a;
        if (r.Id.HasValue)
        {
            a = await _db.ContractorAssignments.FirstOrDefaultAsync(x => x.Id == r.Id.Value && x.DeletedAt == null, ct)
                ?? throw AppException.NotFound("Assignment");
        }
        else
        {
            // Guard against dangling references — the ContractorId must resolve
            // to an active contractor row before we accept the assignment.
            var contractorExists = await _db.Contractors.AnyAsync(c => c.Id == r.ContractorId && c.DeletedAt == null, ct);
            if (!contractorExists) throw AppException.NotFound("Contractor");
            a = new ContractorAssignment();
            _db.ContractorAssignments.Add(a);
        }
        a.ContractorId = r.ContractorId;
        a.TenantId = r.TenantId;
        a.MonthlyPrice = r.MonthlyPrice;
        a.Currency = r.Currency;
        a.StartedOn = r.StartedOn;
        a.EndedOn = r.EndedOn;
        a.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
        a.KalypsisCommissionPercent = Math.Clamp(r.KalypsisCommissionPercent, 0m, 100m);
        await _db.SaveChangesAsync(ct);
        var kalypsisRev = Math.Round(a.MonthlyPrice * a.KalypsisCommissionPercent / 100m, 2, MidpointRounding.AwayFromZero);
        return new AssignmentDto(a.Id, a.ContractorId, a.TenantId, a.MonthlyPrice, a.Currency,
            a.StartedOn, a.EndedOn, a.Notes, a.KalypsisCommissionPercent, kalypsisRev);
    }
}

public record DeleteAssignmentCommand(Guid Id) : IRequest;
public class DeleteAssignmentHandler : IRequestHandler<DeleteAssignmentCommand>
{
    private readonly IAppDbContext _db;
    public DeleteAssignmentHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteAssignmentCommand r, CancellationToken ct)
    {
        var a = await _db.ContractorAssignments.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Assignment");
        a.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
