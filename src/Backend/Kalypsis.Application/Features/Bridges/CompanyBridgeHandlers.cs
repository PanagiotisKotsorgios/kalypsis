using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Bridges;

public record CompanyBridgeDto(
    Guid Id, string Name,
    Guid InsuranceCompanyId, string InsuranceCompanyName,
    CompanyBridgeKind Kind, string? ConfigJson,
    bool IsActive, bool AutoSync,
    DateTime? LastSyncAt, int LastSyncRows, string? LastSyncStatus,
    string? Notes);

public record CompanyBridgeBody(
    string Name, Guid InsuranceCompanyId, CompanyBridgeKind Kind,
    string? ConfigJson, bool IsActive, bool AutoSync, string? Notes);

public record ListCompanyBridgesQuery() : IRequest<IReadOnlyList<CompanyBridgeDto>>;
public class ListCompanyBridgesQueryHandler : IRequestHandler<ListCompanyBridgesQuery, IReadOnlyList<CompanyBridgeDto>>
{
    private readonly IAppDbContext _db;
    public ListCompanyBridgesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CompanyBridgeDto>> Handle(ListCompanyBridgesQuery _, CancellationToken ct)
    {
        var rows = await _db.CompanyBridges
            .Include(b => b.InsuranceCompany)
            .OrderBy(b => b.InsuranceCompany.Name)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static CompanyBridgeDto Map(CompanyBridge b) => new(
        b.Id, b.Name, b.InsuranceCompanyId, b.InsuranceCompany.Name, b.Kind, b.ConfigJson,
        b.IsActive, b.AutoSync, b.LastSyncAt, b.LastSyncRows, b.LastSyncStatus, b.Notes);
}

public class CompanyBridgeBodyValidator : AbstractValidator<CompanyBridgeBody>
{
    public CompanyBridgeBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.InsuranceCompanyId).NotEmpty();
    }
}

public record UpsertCompanyBridgeCommand(Guid? Id, CompanyBridgeBody Body) : IRequest<CompanyBridgeDto>;
public class UpsertCompanyBridgeCommandValidator : AbstractValidator<UpsertCompanyBridgeCommand>
{ public UpsertCompanyBridgeCommandValidator() { RuleFor(x => x.Body).SetValidator(new CompanyBridgeBodyValidator()); } }

public class UpsertCompanyBridgeCommandHandler : IRequestHandler<UpsertCompanyBridgeCommand, CompanyBridgeDto>
{
    private readonly IAppDbContext _db;
    public UpsertCompanyBridgeCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CompanyBridgeDto> Handle(UpsertCompanyBridgeCommand r, CancellationToken ct)
    {
        var b = r.Body;
        CompanyBridge bridge;
        if (r.Id.HasValue)
        {
            bridge = await _db.CompanyBridges.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Bridge");
        }
        else
        {
            bridge = new CompanyBridge { Id = Guid.NewGuid() };
            _db.CompanyBridges.Add(bridge);
        }
        bridge.Name = b.Name.Trim();
        bridge.InsuranceCompanyId = b.InsuranceCompanyId;
        bridge.Kind = b.Kind;
        bridge.ConfigJson = b.ConfigJson;
        bridge.IsActive = b.IsActive;
        bridge.AutoSync = b.AutoSync;
        bridge.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        bridge = await _db.CompanyBridges.Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == bridge.Id, ct);
        return ListCompanyBridgesQueryHandler.Map(bridge);
    }
}

/// <summary>
/// Trigger a manual sync of the bridge. In dev this records a stub MagneticImport
/// so the agency sees the file in the imports list — real connectors (FTP, API)
/// hook in here later.
/// </summary>
public record SyncCompanyBridgeCommand(Guid Id) : IRequest<CompanyBridgeDto>;
public class SyncCompanyBridgeCommandHandler : IRequestHandler<SyncCompanyBridgeCommand, CompanyBridgeDto>
{
    private readonly IAppDbContext _db;
    public SyncCompanyBridgeCommandHandler(IAppDbContext db) => _db = db;
    public async Task<CompanyBridgeDto> Handle(SyncCompanyBridgeCommand r, CancellationToken ct)
    {
        var bridge = await _db.CompanyBridges.Include(b => b.InsuranceCompany).FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Bridge");
        if (!bridge.IsActive) throw AppException.Validation("Η γέφυρα είναι ανενεργή.");

        var rows = Random.Shared.Next(5, 30);
        var matched = (int)(rows * 0.9);
        var failed = rows - matched;

        _db.MagneticImports.Add(new MagneticImport
        {
            Id = Guid.NewGuid(),
            FileName = $"{bridge.InsuranceCompany.Code}_{DateTime.UtcNow:yyyyMMddHHmm}.csv",
            Source = $"{bridge.Name} ({bridge.InsuranceCompany.Name})",
            Status = ImportStatus.Completed,
            Rows = rows,
            Matched = matched,
            Failed = failed,
            CompletedAt = DateTime.UtcNow
        });

        bridge.LastSyncAt = DateTime.UtcNow;
        bridge.LastSyncRows = rows;
        bridge.LastSyncStatus = $"OK · {matched} matched, {failed} failed";

        await _db.SaveChangesAsync(ct);
        return ListCompanyBridgesQueryHandler.Map(bridge);
    }
}

public record DeleteCompanyBridgeCommand(Guid Id) : IRequest<Unit>;
public class DeleteCompanyBridgeCommandHandler : IRequestHandler<DeleteCompanyBridgeCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCompanyBridgeCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCompanyBridgeCommand r, CancellationToken ct)
    {
        var bridge = await _db.CompanyBridges.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Bridge");
        bridge.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
