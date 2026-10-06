using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Common.Forms;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.GreenCards;

public record GreenCardDto(
    Guid Id,
    Guid PolicyId,
    string PolicyNumber,
    Guid CustomerId,
    string CustomerName,
    string CardNumber,
    GreenCardStatus Status,
    DateOnly ValidFrom,
    DateOnly ValidTo,
    string HolderName,
    string InsuredName,
    string VehicleRegistrationPlate,
    string? VehicleMakeModel,
    string? VehicleVin,
    string? Territories,
    string? IssuingOffice,
    string? DeliveryMethod,
    string? Notes,
    DateTime? IssuedAt,
    DateTime? DeliveredAt,
    Guid? PolicyDocumentId);

public record GreenCardBody(
    string? CardNumber,
    GreenCardStatus? Status,
    DateOnly ValidFrom,
    DateOnly ValidTo,
    string? HolderName,
    string? InsuredName,
    string? VehicleRegistrationPlate,
    string? VehicleMakeModel,
    string? VehicleVin,
    string? Territories,
    string? IssuingOffice,
    string? DeliveryMethod,
    string? Notes);

public record ListGreenCardsQuery(Guid PolicyId) : IRequest<IReadOnlyList<GreenCardDto>>;

public sealed class ListGreenCardsQueryHandler : IRequestHandler<ListGreenCardsQuery, IReadOnlyList<GreenCardDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public ListGreenCardsQueryHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<IReadOnlyList<GreenCardDto>> Handle(ListGreenCardsQuery request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var q = _db.GreenCards
            .Include(x => x.Policy).ThenInclude(x => x.Customer)
            .Where(x => x.TenantId == tenantId && x.PolicyId == request.PolicyId && x.DeletedAt == null);

        if (_current.Role == Role.Customer)
        {
            var userId = _current.UserId ?? throw AppException.Unauthorized();
            var customerId = await _db.Users.Where(x => x.Id == userId).Select(x => x.CustomerId).FirstOrDefaultAsync(ct);
            if (customerId is null) return Array.Empty<GreenCardDto>();
            q = q.Where(x => x.Policy.CustomerId == customerId);
        }

        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    internal static GreenCardDto Map(GreenCard x)
    {
        var customer = x.Policy.Customer;
        var display = customer.Type == CustomerType.Individual
            ? $"{customer.FirstName} {customer.LastName}".Trim()
            : customer.CompanyName ?? string.Empty;
        return new GreenCardDto(
            x.Id, x.PolicyId, x.Policy.PolicyNumber, customer.Id, display,
            x.CardNumber, x.Status, x.ValidFrom, x.ValidTo,
            x.HolderName, x.InsuredName, x.VehicleRegistrationPlate,
            x.VehicleMakeModel, x.VehicleVin, x.Territories, x.IssuingOffice,
            x.DeliveryMethod, x.Notes, x.IssuedAt, x.DeliveredAt, x.PolicyDocumentId);
    }
}

public record CreateGreenCardCommand(Guid PolicyId, GreenCardBody Body) : IRequest<GreenCardDto>;

public sealed class CreateGreenCardCommandHandler : IRequestHandler<CreateGreenCardCommand, GreenCardDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public CreateGreenCardCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<GreenCardDto> Handle(CreateGreenCardCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var policy = await LoadPolicy(request.PolicyId, tenantId, ct);
        ValidateDates(request.Body.ValidFrom, request.Body.ValidTo);
        var id = Guid.NewGuid();
        var card = new GreenCard
        {
            Id = id,
            TenantId = tenantId,
            PolicyId = policy.Id,
            CardNumber = Clean(request.Body.CardNumber) ?? $"GC-{DateTime.UtcNow:yyyy}-{id.ToString("N")[..8].ToUpperInvariant()}",
            Status = request.Body.Status ?? GreenCardStatus.Draft,
            ValidFrom = request.Body.ValidFrom,
            ValidTo = request.Body.ValidTo,
            HolderName = Clean(request.Body.HolderName) ?? CustomerName(policy.Customer),
            InsuredName = Clean(request.Body.InsuredName) ?? CustomerName(policy.Customer),
            VehicleRegistrationPlate = Clean(request.Body.VehicleRegistrationPlate) ?? policy.VehicleRegistrationPlate ?? string.Empty,
            VehicleMakeModel = Clean(request.Body.VehicleMakeModel),
            VehicleVin = Clean(request.Body.VehicleVin),
            Territories = Clean(request.Body.Territories),
            IssuingOffice = Clean(request.Body.IssuingOffice),
            DeliveryMethod = Clean(request.Body.DeliveryMethod),
            Notes = Clean(request.Body.Notes)
        };
        await EnsureCardNumberAvailable(card.CardNumber, tenantId, null, ct);
        _db.GreenCards.Add(card);
        await _db.SaveChangesAsync(ct);
        card.Policy = policy;
        return ListGreenCardsQueryHandler.Map(card);
    }

    private async Task<Policy> LoadPolicy(Guid id, Guid tenantId, CancellationToken ct)
        => await _db.Policies.Include(x => x.Customer).Include(x => x.InsuranceCompany)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Policy");

    internal static void ValidateDates(DateOnly from, DateOnly to)
    {
        if (to < from) throw AppException.Validation("Η λήξη της πράσινης κάρτας πρέπει να είναι μετά την έναρξη.");
    }

    internal static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    internal static string CustomerName(Customer customer) => customer.Type == CustomerType.Individual
        ? $"{customer.FirstName} {customer.LastName}".Trim()
        : customer.CompanyName ?? string.Empty;

    internal async Task EnsureCardNumberAvailable(string number, Guid tenantId, Guid? excludeId, CancellationToken ct)
    {
        if (await _db.GreenCards.AnyAsync(x => x.TenantId == tenantId && x.CardNumber == number && x.DeletedAt == null && (!excludeId.HasValue || x.Id != excludeId.Value), ct))
            throw AppException.Validation("Ο αριθμός πράσινης κάρτας χρησιμοποιείται ήδη.");
    }
}

public record UpdateGreenCardCommand(Guid PolicyId, Guid Id, GreenCardBody Body) : IRequest<GreenCardDto>;

public sealed class UpdateGreenCardCommandHandler : IRequestHandler<UpdateGreenCardCommand, GreenCardDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;

    public UpdateGreenCardCommandHandler(IAppDbContext db, ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public async Task<GreenCardDto> Handle(UpdateGreenCardCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var card = await _db.GreenCards.Include(x => x.Policy).ThenInclude(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.PolicyId == request.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("GreenCard");
        CreateGreenCardCommandHandler.ValidateDates(request.Body.ValidFrom, request.Body.ValidTo);
        var number = CreateGreenCardCommandHandler.Clean(request.Body.CardNumber) ?? card.CardNumber;
        if (await _db.GreenCards.AnyAsync(x => x.TenantId == tenantId && x.CardNumber == number && x.Id != card.Id && x.DeletedAt == null, ct))
            throw AppException.Validation("Ο αριθμός πράσινης κάρτας χρησιμοποιείται ήδη.");
        card.CardNumber = number;
        if (request.Body.Status.HasValue) card.Status = request.Body.Status.Value;
        card.ValidFrom = request.Body.ValidFrom;
        card.ValidTo = request.Body.ValidTo;
        card.HolderName = CreateGreenCardCommandHandler.Clean(request.Body.HolderName) ?? card.HolderName;
        card.InsuredName = CreateGreenCardCommandHandler.Clean(request.Body.InsuredName) ?? card.InsuredName;
        card.VehicleRegistrationPlate = CreateGreenCardCommandHandler.Clean(request.Body.VehicleRegistrationPlate) ?? card.VehicleRegistrationPlate;
        card.VehicleMakeModel = CreateGreenCardCommandHandler.Clean(request.Body.VehicleMakeModel);
        card.VehicleVin = CreateGreenCardCommandHandler.Clean(request.Body.VehicleVin);
        card.Territories = CreateGreenCardCommandHandler.Clean(request.Body.Territories);
        card.IssuingOffice = CreateGreenCardCommandHandler.Clean(request.Body.IssuingOffice);
        card.DeliveryMethod = CreateGreenCardCommandHandler.Clean(request.Body.DeliveryMethod);
        card.Notes = CreateGreenCardCommandHandler.Clean(request.Body.Notes);
        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ListGreenCardsQueryHandler.Map(card);
    }
}

public record IssueGreenCardCommand(Guid PolicyId, Guid Id) : IRequest<GreenCardDto>;

public sealed class IssueGreenCardCommandHandler : IRequestHandler<IssueGreenCardCommand, GreenCardDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly IDateTimeProvider _clock;

    public IssueGreenCardCommandHandler(IAppDbContext db, ICurrentUser current, IFileStorage storage, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _storage = storage;
        _clock = clock;
    }

    public async Task<GreenCardDto> Handle(IssueGreenCardCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var card = await _db.GreenCards.Include(x => x.Policy).ThenInclude(x => x.Customer)
            .Include(x => x.Policy).ThenInclude(x => x.InsuranceCompany)
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.PolicyId == request.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("GreenCard");
        CreateGreenCardCommandHandler.ValidateDates(card.ValidFrom, card.ValidTo);
        var tenant = await _db.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, ct) ?? throw AppException.NotFound("Tenant");
        var bytes = GreenCardPdfRenderer.Render(card, card.Policy, card.Policy.Customer, tenant);
        await using var content = new MemoryStream(bytes, writable: false);
        var fileName = $"green-card-{card.CardNumber}.pdf";
        var path = await _storage.UploadAsync($"green-cards/{tenantId}/{card.Id}", fileName, "application/pdf", content, ct);
        var now = _clock.UtcNow;
        if (card.PolicyDocumentId.HasValue)
        {
            var existing = await _db.PolicyDocuments.FirstOrDefaultAsync(x => x.Id == card.PolicyDocumentId.Value && x.DeletedAt == null, ct);
            if (existing is not null)
            {
                existing.FileName = fileName;
                existing.StoragePath = path;
                existing.MimeType = "application/pdf";
                existing.SizeBytes = bytes.Length;
                existing.UpdatedAt = now;
                existing.UploadedByUserId = _current.UserId;
            }
            else card.PolicyDocumentId = null;
        }
        if (!card.PolicyDocumentId.HasValue)
        {
            var doc = new PolicyDocument
            {
                Id = Guid.NewGuid(), TenantId = tenantId, PolicyId = card.PolicyId,
                DocumentType = DocumentType.GreenCard, FileName = fileName,
                StoragePath = path, MimeType = "application/pdf", SizeBytes = bytes.Length,
                UploadedByUserId = _current.UserId
            };
            _db.PolicyDocuments.Add(doc);
            card.PolicyDocumentId = doc.Id;
        }
        card.Status = GreenCardStatus.Issued;
        card.IssuedAt = now;
        card.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);
        return ListGreenCardsQueryHandler.Map(card);
    }
}

public record DeliverGreenCardCommand(Guid PolicyId, Guid Id, string? DeliveryMethod) : IRequest<GreenCardDto>;

public sealed class DeliverGreenCardCommandHandler : IRequestHandler<DeliverGreenCardCommand, GreenCardDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public DeliverGreenCardCommandHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public async Task<GreenCardDto> Handle(DeliverGreenCardCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var card = await _db.GreenCards.Include(x => x.Policy).ThenInclude(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == request.Id && x.PolicyId == request.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("GreenCard");
        if (card.PolicyDocumentId is null) throw AppException.Validation("Εκδώστε πρώτα το PDF της πράσινης κάρτας.");
        card.Status = GreenCardStatus.Delivered;
        card.DeliveredAt = _clock.UtcNow;
        card.DeliveryMethod = CreateGreenCardCommandHandler.Clean(request.DeliveryMethod) ?? card.DeliveryMethod;
        card.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ListGreenCardsQueryHandler.Map(card);
    }
}

public record CancelGreenCardCommand(Guid PolicyId, Guid Id) : IRequest<Unit>;

public sealed class CancelGreenCardCommandHandler : IRequestHandler<CancelGreenCardCommand, Unit>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CancelGreenCardCommandHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<Unit> Handle(CancelGreenCardCommand request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var card = await _db.GreenCards.FirstOrDefaultAsync(x => x.Id == request.Id && x.PolicyId == request.PolicyId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("GreenCard");
        card.Status = GreenCardStatus.Cancelled;
        card.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
