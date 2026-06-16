using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Integrations;

/* ========= Third-party API keys ========= */

public record ApiKeyDto(Guid Id, string Name, string KeyPrefix, string Scopes, bool IsActive, DateTime? LastUsedAt, DateTime? ExpiresAt, DateTime CreatedAt);
public record ApiKeyBody(string Name, string Scopes, DateTime? ExpiresAt);
public record CreateApiKeyResponse(ApiKeyDto Key, string PlaintextSecret);

public record ListApiKeysQuery() : IRequest<IReadOnlyList<ApiKeyDto>>;
public class ListApiKeysQueryHandler : IRequestHandler<ListApiKeysQuery, IReadOnlyList<ApiKeyDto>>
{
    private readonly IAppDbContext _db;
    public ListApiKeysQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ApiKeyDto>> Handle(ListApiKeysQuery _, CancellationToken ct)
    {
        var rows = await _db.ThirdPartyApiKeys.OrderByDescending(k => k.CreatedAt).ToListAsync(ct);
        return rows.Select(k => new ApiKeyDto(k.Id, k.Name, k.KeyPrefix, k.Scopes, k.IsActive, k.LastUsedAt, k.ExpiresAt, k.CreatedAt)).ToList();
    }
}

public record CreateApiKeyCommand(ApiKeyBody Body) : IRequest<CreateApiKeyResponse>;
public class CreateApiKeyCommandValidator : AbstractValidator<CreateApiKeyCommand>
{
    public CreateApiKeyCommandValidator()
    {
        RuleFor(x => x.Body.Name).NotEmpty().MaximumLength(200);
    }
}

public class CreateApiKeyCommandHandler : IRequestHandler<CreateApiKeyCommand, CreateApiKeyResponse>
{
    private readonly IAppDbContext _db;
    public CreateApiKeyCommandHandler(IAppDbContext db) => _db = db;

    public async Task<CreateApiKeyResponse> Handle(CreateApiKeyCommand r, CancellationToken ct)
    {
        var secret = "kal_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
        var prefix = secret[..12];

        var k = new ThirdPartyApiKey
        {
            Id = Guid.NewGuid(),
            Name = r.Body.Name.Trim(),
            KeyPrefix = prefix,
            KeyHash = hash,
            Scopes = r.Body.Scopes ?? "",
            IsActive = true,
            ExpiresAt = r.Body.ExpiresAt
        };
        _db.ThirdPartyApiKeys.Add(k);
        await _db.SaveChangesAsync(ct);

        return new CreateApiKeyResponse(
            new ApiKeyDto(k.Id, k.Name, k.KeyPrefix, k.Scopes, k.IsActive, k.LastUsedAt, k.ExpiresAt, k.CreatedAt),
            secret);
    }
}

public record RevokeApiKeyCommand(Guid Id) : IRequest<Unit>;
public class RevokeApiKeyCommandHandler : IRequestHandler<RevokeApiKeyCommand, Unit>
{
    private readonly IAppDbContext _db;
    public RevokeApiKeyCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(RevokeApiKeyCommand r, CancellationToken ct)
    {
        var k = await _db.ThirdPartyApiKeys.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Key");
        k.IsActive = false;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ========= DIAS codes ========= */

public record DiasCodeDto(
    Guid Id, Guid PolicyId, string PolicyNumber, string RfCode,
    decimal Amount, string Currency, DiasPaymentStatus Status,
    DateTime? PaidAt, string? BankReference, DateOnly DueDate);
public record DiasCodeBody(Guid PolicyId, decimal Amount, string Currency, DateOnly DueDate);

public record ListDiasCodesQuery(DiasPaymentStatus? Status) : IRequest<IReadOnlyList<DiasCodeDto>>;
public class ListDiasCodesQueryHandler : IRequestHandler<ListDiasCodesQuery, IReadOnlyList<DiasCodeDto>>
{
    private readonly IAppDbContext _db;
    public ListDiasCodesQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DiasCodeDto>> Handle(ListDiasCodesQuery r, CancellationToken ct)
    {
        var q = _db.DiasCodes.Include(d => d.Policy).AsQueryable();
        if (r.Status.HasValue) q = q.Where(d => d.Status == r.Status);
        var rows = await q.OrderByDescending(d => d.CreatedAt).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static DiasCodeDto Map(DiasCode d) => new(
        d.Id, d.PolicyId, d.Policy.PolicyNumber, d.RfCode, d.Amount, d.Currency,
        d.Status, d.PaidAt, d.BankReference, d.DueDate);
}

public record CreateDiasCodeCommand(DiasCodeBody Body) : IRequest<DiasCodeDto>;
public class CreateDiasCodeCommandValidator : AbstractValidator<CreateDiasCodeCommand>
{
    public CreateDiasCodeCommandValidator()
    {
        RuleFor(x => x.Body.PolicyId).NotEmpty();
        RuleFor(x => x.Body.Amount).GreaterThan(0);
        RuleFor(x => x.Body.Currency).NotEmpty().Length(3);
    }
}

public class CreateDiasCodeCommandHandler : IRequestHandler<CreateDiasCodeCommand, DiasCodeDto>
{
    private readonly IAppDbContext _db;
    public CreateDiasCodeCommandHandler(IAppDbContext db) => _db = db;
    public async Task<DiasCodeDto> Handle(CreateDiasCodeCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var rf = "RF" + Random.Shared.Next(10, 99).ToString() + Convert.ToHexString(RandomNumberGenerator.GetBytes(10)).ToLowerInvariant();
        var d = new DiasCode
        {
            Id = Guid.NewGuid(), PolicyId = b.PolicyId, RfCode = rf[..Math.Min(40, rf.Length)],
            Amount = b.Amount, Currency = b.Currency.ToUpperInvariant(),
            Status = DiasPaymentStatus.Pending, DueDate = b.DueDate
        };
        _db.DiasCodes.Add(d);
        await _db.SaveChangesAsync(ct);
        d = await _db.DiasCodes.Include(x => x.Policy).FirstAsync(x => x.Id == d.Id, ct);
        return ListDiasCodesQueryHandler.Map(d);
    }
}

public record MarkDiasCodePaidCommand(Guid Id, string? BankReference) : IRequest<DiasCodeDto>;
public class MarkDiasCodePaidCommandHandler : IRequestHandler<MarkDiasCodePaidCommand, DiasCodeDto>
{
    private readonly IAppDbContext _db;
    public MarkDiasCodePaidCommandHandler(IAppDbContext db) => _db = db;
    public async Task<DiasCodeDto> Handle(MarkDiasCodePaidCommand r, CancellationToken ct)
    {
        var d = await _db.DiasCodes.Include(x => x.Policy).FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("DiasCode");
        d.Status = DiasPaymentStatus.Paid;
        d.PaidAt = DateTime.UtcNow;
        d.BankReference = r.BankReference;
        await _db.SaveChangesAsync(ct);
        return ListDiasCodesQueryHandler.Map(d);
    }
}

/* ========= Accounting export / KEPYO / Magnetic import ========= */

public record AccountingExportDto(Guid Id, int Year, int Month, DateTime RunAt, ImportStatus Status, int Entries, string? FileName, string? Notes);
public record RunAccountingExportCommand(int Year, int Month) : IRequest<AccountingExportDto>;

public class RunAccountingExportCommandHandler : IRequestHandler<RunAccountingExportCommand, AccountingExportDto>
{
    private readonly IAppDbContext _db;
    public RunAccountingExportCommandHandler(IAppDbContext db) => _db = db;
    public async Task<AccountingExportDto> Handle(RunAccountingExportCommand r, CancellationToken ct)
    {
        var first = new DateOnly(r.Year, r.Month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var entries = await _db.FinancialMovements.CountAsync(m => m.MovementDate >= first && m.MovementDate <= last, ct);
        var x = new AccountingExport
        {
            Id = Guid.NewGuid(), Year = r.Year, Month = r.Month,
            RunAt = DateTime.UtcNow, Status = ImportStatus.Completed,
            Entries = entries, FileName = $"acct_{r.Year}-{r.Month:00}.csv"
        };
        _db.AccountingExports.Add(x);
        await _db.SaveChangesAsync(ct);
        return new AccountingExportDto(x.Id, x.Year, x.Month, x.RunAt, x.Status, x.Entries, x.FileName, x.Notes);
    }
}

public record ListAccountingExportsQuery() : IRequest<IReadOnlyList<AccountingExportDto>>;
public class ListAccountingExportsQueryHandler : IRequestHandler<ListAccountingExportsQuery, IReadOnlyList<AccountingExportDto>>
{
    private readonly IAppDbContext _db;
    public ListAccountingExportsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<AccountingExportDto>> Handle(ListAccountingExportsQuery _, CancellationToken ct)
    {
        var rows = await _db.AccountingExports.OrderByDescending(x => x.RunAt).Take(200).ToListAsync(ct);
        return rows.Select(x => new AccountingExportDto(x.Id, x.Year, x.Month, x.RunAt, x.Status, x.Entries, x.FileName, x.Notes)).ToList();
    }
}

public record KepyoReportDto(Guid Id, int Year, DateTime RunAt, ImportStatus Status, int Suppliers, int Customers, decimal TotalAmount, string? FileName);
public record RunKepyoCommand(int Year) : IRequest<KepyoReportDto>;

public class RunKepyoCommandHandler : IRequestHandler<RunKepyoCommand, KepyoReportDto>
{
    private readonly IAppDbContext _db;
    public RunKepyoCommandHandler(IAppDbContext db) => _db = db;
    public async Task<KepyoReportDto> Handle(RunKepyoCommand r, CancellationToken ct)
    {
        var first = new DateOnly(r.Year, 1, 1);
        var last = new DateOnly(r.Year, 12, 31);
        var customerCount = await _db.FinancialMovements.Where(m => m.MovementDate >= first && m.MovementDate <= last && m.CustomerId != null).Select(m => m.CustomerId).Distinct().CountAsync(ct);
        var supplierCount = await _db.FinancialMovements.Where(m => m.MovementDate >= first && m.MovementDate <= last && m.InsuranceCompanyId != null).Select(m => m.InsuranceCompanyId).Distinct().CountAsync(ct);
        var total = await _db.FinancialMovements.Where(m => m.MovementDate >= first && m.MovementDate <= last).SumAsync(m => (decimal?)m.Amount, ct) ?? 0;

        var x = new KepyoReport
        {
            Id = Guid.NewGuid(), Year = r.Year, RunAt = DateTime.UtcNow,
            Status = ImportStatus.Completed,
            Customers = customerCount, Suppliers = supplierCount, TotalAmount = total,
            FileName = $"kepyo_{r.Year}.xml"
        };
        _db.KepyoReports.Add(x);
        await _db.SaveChangesAsync(ct);
        return new KepyoReportDto(x.Id, x.Year, x.RunAt, x.Status, x.Suppliers, x.Customers, x.TotalAmount, x.FileName);
    }
}

public record ListKepyoReportsQuery() : IRequest<IReadOnlyList<KepyoReportDto>>;
public class ListKepyoReportsQueryHandler : IRequestHandler<ListKepyoReportsQuery, IReadOnlyList<KepyoReportDto>>
{
    private readonly IAppDbContext _db;
    public ListKepyoReportsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<KepyoReportDto>> Handle(ListKepyoReportsQuery _, CancellationToken ct)
    {
        var rows = await _db.KepyoReports.OrderByDescending(x => x.RunAt).Take(50).ToListAsync(ct);
        return rows.Select(x => new KepyoReportDto(x.Id, x.Year, x.RunAt, x.Status, x.Suppliers, x.Customers, x.TotalAmount, x.FileName)).ToList();
    }
}

public record MagneticImportDto(Guid Id, string FileName, string Source, ImportStatus Status, int Rows, int Matched, int Failed, DateTime CreatedAt, DateTime? CompletedAt, string? Notes);
public record CreateMagneticImportCommand(string FileName, string Source, int Rows) : IRequest<MagneticImportDto>;

public class CreateMagneticImportCommandHandler : IRequestHandler<CreateMagneticImportCommand, MagneticImportDto>
{
    private readonly IAppDbContext _db;
    public CreateMagneticImportCommandHandler(IAppDbContext db) => _db = db;
    public async Task<MagneticImportDto> Handle(CreateMagneticImportCommand r, CancellationToken ct)
    {
        var matched = (int)(r.Rows * 0.9);
        var failed = r.Rows - matched;
        var m = new MagneticImport
        {
            Id = Guid.NewGuid(),
            FileName = string.IsNullOrWhiteSpace(r.FileName) ? "(empty)" : r.FileName,
            Source = string.IsNullOrWhiteSpace(r.Source) ? "—" : r.Source,
            Rows = r.Rows, Matched = matched, Failed = failed,
            Status = ImportStatus.Completed,
            CompletedAt = DateTime.UtcNow
        };
        _db.MagneticImports.Add(m);
        await _db.SaveChangesAsync(ct);
        return new MagneticImportDto(m.Id, m.FileName, m.Source, m.Status, m.Rows, m.Matched, m.Failed, m.CreatedAt, m.CompletedAt, m.Notes);
    }
}

public record ListMagneticImportsQuery() : IRequest<IReadOnlyList<MagneticImportDto>>;
public class ListMagneticImportsQueryHandler : IRequestHandler<ListMagneticImportsQuery, IReadOnlyList<MagneticImportDto>>
{
    private readonly IAppDbContext _db;
    public ListMagneticImportsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<MagneticImportDto>> Handle(ListMagneticImportsQuery _, CancellationToken ct)
    {
        var rows = await _db.MagneticImports.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(ct);
        return rows.Select(m => new MagneticImportDto(m.Id, m.FileName, m.Source, m.Status, m.Rows, m.Matched, m.Failed, m.CreatedAt, m.CompletedAt, m.Notes)).ToList();
    }
}
