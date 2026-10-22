using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase11;

public sealed class ClaimIndemnityBodyValidator : AbstractValidator<ClaimIndemnityBody>
{
    public ClaimIndemnityBodyValidator()
    {
        RuleFor(b => b.ClaimId).NotEmpty();
        RuleFor(b => b.PaymentNumber).NotEmpty().MaximumLength(40);
        RuleFor(b => b.PaidOn).NotEqual(default(DateOnly));
        RuleFor(b => b.Amount).GreaterThan(0).LessThanOrEqualTo(9999999999.99m);
        RuleFor(b => b.Currency).Matches("^[A-Z]{3}$");
        RuleFor(b => b.PayeeType).Must(value => new[] { "Customer", "Garage", "Hospital", "Other" }.Contains(value));
        RuleFor(b => b.GarageId).NotEmpty().When(b => b.PayeeType == "Garage");
        RuleFor(b => b.PayeeName).MaximumLength(200);
        RuleFor(b => b.PaymentMethod).Must(value => new[] { "Cash", "BankTransfer", "Cheque", "Card", "Other" }.Contains(value));
        RuleFor(b => b.Reference).MaximumLength(80);
        RuleFor(b => b.Notes).MaximumLength(2000);
    }
}

internal static class ClaimIndemnityRules
{
    public static async Task<ClaimIndemnityBody> Prepare(IAppDbContext db, ICurrentUser current, ClaimIndemnityBody body, Guid? excluding, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var b = body with { PaymentNumber = body.PaymentNumber?.Trim() ?? "", Currency = body.Currency?.Trim().ToUpperInvariant() ?? "",
            PayeeName = body.PayeeType == "Garage" ? null : body.PayeeName?.Trim(), GarageId = body.PayeeType == "Garage" ? body.GarageId : null,
            Reference = body.Reference?.Trim(), Notes = body.Notes?.Trim() };
        await new ClaimIndemnityBodyValidator().ValidateAndThrowAsync(b, ct);
        if (!await db.Claims.AnyAsync(x => x.Id == b.ClaimId && x.TenantId == tenant && x.DeletedAt == null, ct)) throw AppException.NotFound("Ζημιά");
        if (b.GarageId.HasValue && !await db.Garages.AnyAsync(x => x.Id == b.GarageId && x.TenantId == tenant && x.DeletedAt == null, ct)) throw AppException.NotFound("Συνεργείο");
        // The unique index also covers deleted records. Return an actionable conflict instead of a database error.
        if (await db.ClaimIndemnities.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant && x.PaymentNumber == b.PaymentNumber && x.Id != excluding, ct))
            throw new AppException("payment_number_taken", "Υπάρχει ήδη αποζημίωση με αυτόν τον αριθμό πληρωμής. Επιλέξτε διαφορετικό αριθμό.", 409);
        return b;
    }
}

public record UpdateClaimIndemnityCommand(Guid Id, ClaimIndemnityBody Body) : IRequest<ClaimIndemnityDto>;
public sealed class UpdateClaimIndemnityHandler : IRequestHandler<UpdateClaimIndemnityCommand, ClaimIndemnityDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public UpdateClaimIndemnityHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }
    public async Task<ClaimIndemnityDto> Handle(UpdateClaimIndemnityCommand request, CancellationToken ct)
    {
        var tenant = _current.TenantId ?? throw AppException.Forbidden();
        var entity = await _db.ClaimIndemnities.FirstOrDefaultAsync(x => x.Id == request.Id && x.TenantId == tenant && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Αποζημίωση");
        var b = await ClaimIndemnityRules.Prepare(_db, _current, request.Body, entity.Id, ct);
        entity.ClaimId = b.ClaimId; entity.PaymentNumber = b.PaymentNumber; entity.PaidOn = b.PaidOn;
        entity.Amount = b.Amount; entity.Currency = b.Currency; entity.PayeeType = b.PayeeType; entity.PayeeName = b.PayeeName;
        entity.GarageId = b.GarageId; entity.PaymentMethod = b.PaymentMethod; entity.Reference = b.Reference; entity.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        var saved = await _db.ClaimIndemnities.AsNoTracking().Include(x => x.Claim).Include(x => x.Garage).FirstAsync(x => x.Id == entity.Id, ct);
        return ListClaimIndemnitiesHandler.Map(saved);
    }
}
