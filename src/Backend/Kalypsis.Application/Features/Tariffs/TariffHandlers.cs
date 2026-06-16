using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Tariffs;

public record TariffDto(
    Guid Id, string Name, PolicyType PolicyType,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    decimal BasePremium, string Currency, decimal? CommissionPercent,
    string? FactorsJson, string? Notes,
    bool IsActive, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record TariffBody(
    string Name, PolicyType PolicyType,
    Guid? InsuranceCompanyId, decimal BasePremium, string Currency,
    decimal? CommissionPercent, string? FactorsJson, string? Notes,
    bool IsActive, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

public record ListTariffsQuery() : IRequest<IReadOnlyList<TariffDto>>;
public class ListTariffsQueryHandler : IRequestHandler<ListTariffsQuery, IReadOnlyList<TariffDto>>
{
    private readonly IAppDbContext _db;
    public ListTariffsQueryHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<TariffDto>> Handle(ListTariffsQuery _, CancellationToken ct)
    {
        var rows = await _db.Tariffs.Include(t => t.InsuranceCompany)
            .OrderByDescending(t => t.IsActive).ThenBy(t => t.Name).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static TariffDto Map(Tariff t) => new(
        t.Id, t.Name, t.PolicyType, t.InsuranceCompanyId, t.InsuranceCompany?.Name,
        t.BasePremium, t.Currency, t.CommissionPercent, t.FactorsJson, t.Notes,
        t.IsActive, t.EffectiveFrom, t.EffectiveTo);
}

public class TariffBodyValidator : AbstractValidator<TariffBody>
{
    public TariffBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BasePremium).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}

public record CreateTariffCommand(TariffBody Body) : IRequest<TariffDto>;
public class CreateTariffCommandValidator : AbstractValidator<CreateTariffCommand>
{ public CreateTariffCommandValidator() { RuleFor(x => x.Body).SetValidator(new TariffBodyValidator()); } }

public class CreateTariffCommandHandler : IRequestHandler<CreateTariffCommand, TariffDto>
{
    private readonly IAppDbContext _db;
    public CreateTariffCommandHandler(IAppDbContext db) => _db = db;
    public async Task<TariffDto> Handle(CreateTariffCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var t = new Tariff
        {
            Id = Guid.NewGuid(), Name = b.Name.Trim(), PolicyType = b.PolicyType,
            InsuranceCompanyId = b.InsuranceCompanyId, BasePremium = b.BasePremium,
            Currency = b.Currency.ToUpperInvariant(), CommissionPercent = b.CommissionPercent,
            FactorsJson = b.FactorsJson, Notes = b.Notes,
            IsActive = b.IsActive, EffectiveFrom = b.EffectiveFrom, EffectiveTo = b.EffectiveTo
        };
        _db.Tariffs.Add(t);
        await _db.SaveChangesAsync(ct);
        t = await _db.Tariffs.Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == t.Id, ct);
        return ListTariffsQueryHandler.Map(t);
    }
}

public record UpdateTariffCommand(Guid Id, TariffBody Body) : IRequest<TariffDto>;
public class UpdateTariffCommandValidator : AbstractValidator<UpdateTariffCommand>
{ public UpdateTariffCommandValidator() { RuleFor(x => x.Body).SetValidator(new TariffBodyValidator()); } }

public class UpdateTariffCommandHandler : IRequestHandler<UpdateTariffCommand, TariffDto>
{
    private readonly IAppDbContext _db;
    public UpdateTariffCommandHandler(IAppDbContext db) => _db = db;
    public async Task<TariffDto> Handle(UpdateTariffCommand r, CancellationToken ct)
    {
        var t = await _db.Tariffs.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Tariff");
        var b = r.Body;
        t.Name = b.Name.Trim(); t.PolicyType = b.PolicyType;
        t.InsuranceCompanyId = b.InsuranceCompanyId; t.BasePremium = b.BasePremium;
        t.Currency = b.Currency.ToUpperInvariant(); t.CommissionPercent = b.CommissionPercent;
        t.FactorsJson = b.FactorsJson; t.Notes = b.Notes;
        t.IsActive = b.IsActive; t.EffectiveFrom = b.EffectiveFrom; t.EffectiveTo = b.EffectiveTo;
        await _db.SaveChangesAsync(ct);
        t = await _db.Tariffs.Include(x => x.InsuranceCompany).FirstAsync(x => x.Id == t.Id, ct);
        return ListTariffsQueryHandler.Map(t);
    }
}

public record DeleteTariffCommand(Guid Id) : IRequest<Unit>;
public class DeleteTariffCommandHandler : IRequestHandler<DeleteTariffCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteTariffCommandHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteTariffCommand r, CancellationToken ct)
    {
        var t = await _db.Tariffs.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Tariff");
        t.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
