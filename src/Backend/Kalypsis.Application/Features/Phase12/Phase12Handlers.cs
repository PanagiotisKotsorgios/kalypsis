using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase12;

// ============================================================================
// Phase 12 — BluByte parity. CQRS handlers for friendly settlements, victims,
// settlement payments, caller-ID logs, ΥΣΑΕ submissions, vehicle models,
// customer merge utility, and policy persistency analytics.
// ============================================================================

/* ============================================================================
   FRIENDLY SETTLEMENT (Φιλικός Διακανονισμός)
   ========================================================================= */
public record FriendlySettlementDto(
    Guid Id, Guid ClaimId, string ClaimNumber,
    string SettlementFileNumber, DateOnly DeclarationDate,
    string? SettlementAuthority, DateOnly? SettlementDate,
    decimal? AgreedAmount, decimal? VatAmount, decimal? FeeAmount, decimal? InterestAmount,
    string Currency, string Status,
    string? OtherPartyInsurer, string? OtherPartyPolicy,
    string? AppraisorName, DateOnly? AppraisalDate, string? Notes,
    int VictimCount);

public record FriendlySettlementBody(
    Guid ClaimId, string SettlementFileNumber, DateOnly DeclarationDate,
    string? SettlementAuthority, DateOnly? SettlementDate,
    decimal? AgreedAmount, decimal? VatAmount, decimal? FeeAmount, decimal? InterestAmount,
    string Currency, string Status,
    string? OtherPartyInsurer, string? OtherPartyPolicy,
    string? AppraisorName, DateOnly? AppraisalDate, string? Notes);

public record ListFriendlySettlementsQuery(string? Status) : IRequest<IReadOnlyList<FriendlySettlementDto>>;
public class ListFriendlySettlementsHandler : IRequestHandler<ListFriendlySettlementsQuery, IReadOnlyList<FriendlySettlementDto>>
{
    private readonly IAppDbContext _db;
    public ListFriendlySettlementsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<FriendlySettlementDto>> Handle(ListFriendlySettlementsQuery r, CancellationToken ct)
    {
        var q = _db.FriendlySettlements.Include(x => x.Claim).AsQueryable();
        if (!string.IsNullOrEmpty(r.Status)) q = q.Where(x => x.Status == r.Status);
        var rows = await q.OrderByDescending(x => x.DeclarationDate).Take(500).ToListAsync(ct);
        var counts = await _db.ClaimVictims
            .Where(v => rows.Select(r => r.Id).Contains(v.FriendlySettlementId ?? Guid.Empty))
            .GroupBy(v => v.FriendlySettlementId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() }).ToListAsync(ct);
        var countMap = counts.ToDictionary(c => c.Id, c => c.Count);
        return rows.Select(s => Map(s, countMap.GetValueOrDefault(s.Id, 0))).ToList();
    }
    internal static FriendlySettlementDto Map(FriendlySettlement s, int victimCount) => new(
        s.Id, s.ClaimId, s.Claim?.ClaimNumber ?? "",
        s.SettlementFileNumber, s.DeclarationDate,
        s.SettlementAuthority, s.SettlementDate,
        s.AgreedAmount, s.VatAmount, s.FeeAmount, s.InterestAmount,
        s.Currency, s.Status,
        s.OtherPartyInsurer, s.OtherPartyPolicy,
        s.AppraisorName, s.AppraisalDate, s.Notes, victimCount);
}

public record CreateFriendlySettlementCommand(FriendlySettlementBody Body) : IRequest<FriendlySettlementDto>;
public class CreateFriendlySettlementHandler : IRequestHandler<CreateFriendlySettlementCommand, FriendlySettlementDto>
{
    private readonly IAppDbContext _db;
    public CreateFriendlySettlementHandler(IAppDbContext db) => _db = db;
    public async Task<FriendlySettlementDto> Handle(CreateFriendlySettlementCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.FriendlySettlements.AnyAsync(x => x.SettlementFileNumber == b.SettlementFileNumber, ct))
            throw new AppException("settlement_file_taken",
                "Υπάρχει ήδη φιλικός διακανονισμός με αυτόν τον αριθμό φακέλου.", 409,
                title: "Αρ. φακέλου σε χρήση",
                why: "Ο αριθμός φακέλου πρέπει να είναι μοναδικός για παρακολούθηση από τη ΥΣΑΕ.",
                fix: "Επιλέξτε διαφορετικό αριθμό φακέλου ή ανοίξτε τον υπάρχοντα.",
                fixLink: "/app/friendly-settlements");
        var claim = await _db.Claims.FirstOrDefaultAsync(c => c.Id == b.ClaimId, ct)
            ?? throw AppException.NotFound("Claim");
        claim.IsFriendlySettlement = true;

        var s = new FriendlySettlement
        {
            Id = Guid.NewGuid(), ClaimId = b.ClaimId,
            SettlementFileNumber = b.SettlementFileNumber.Trim(),
            DeclarationDate = b.DeclarationDate,
            SettlementAuthority = b.SettlementAuthority,
            SettlementDate = b.SettlementDate,
            AgreedAmount = b.AgreedAmount, VatAmount = b.VatAmount,
            FeeAmount = b.FeeAmount, InterestAmount = b.InterestAmount,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            Status = b.Status, OtherPartyInsurer = b.OtherPartyInsurer,
            OtherPartyPolicy = b.OtherPartyPolicy,
            AppraisorName = b.AppraisorName, AppraisalDate = b.AppraisalDate,
            Notes = b.Notes
        };
        _db.FriendlySettlements.Add(s);
        await _db.SaveChangesAsync(ct);
        s = await _db.FriendlySettlements.Include(x => x.Claim).FirstAsync(x => x.Id == s.Id, ct);
        return ListFriendlySettlementsHandler.Map(s, 0);
    }
}

public record UpdateFriendlySettlementCommand(Guid Id, FriendlySettlementBody Body) : IRequest<FriendlySettlementDto>;
public class UpdateFriendlySettlementHandler : IRequestHandler<UpdateFriendlySettlementCommand, FriendlySettlementDto>
{
    private readonly IAppDbContext _db;
    public UpdateFriendlySettlementHandler(IAppDbContext db) => _db = db;
    public async Task<FriendlySettlementDto> Handle(UpdateFriendlySettlementCommand r, CancellationToken ct)
    {
        var s = await _db.FriendlySettlements.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Settlement");
        var b = r.Body;
        s.SettlementFileNumber = b.SettlementFileNumber.Trim();
        s.DeclarationDate = b.DeclarationDate;
        s.SettlementAuthority = b.SettlementAuthority;
        s.SettlementDate = b.SettlementDate;
        s.AgreedAmount = b.AgreedAmount; s.VatAmount = b.VatAmount;
        s.FeeAmount = b.FeeAmount; s.InterestAmount = b.InterestAmount;
        s.Currency = b.Currency.ToUpperInvariant();
        s.Status = b.Status;
        s.OtherPartyInsurer = b.OtherPartyInsurer;
        s.OtherPartyPolicy = b.OtherPartyPolicy;
        s.AppraisorName = b.AppraisorName; s.AppraisalDate = b.AppraisalDate;
        s.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        var victims = await _db.ClaimVictims.CountAsync(v => v.FriendlySettlementId == s.Id, ct);
        s = await _db.FriendlySettlements.Include(x => x.Claim).FirstAsync(x => x.Id == s.Id, ct);
        return ListFriendlySettlementsHandler.Map(s, victims);
    }
}

/* ============================================================================
   VICTIMS (Παθόντες) + SETTLEMENT PAYMENTS (Πληρωμές παθόντα)
   ========================================================================= */
public record ClaimVictimDto(
    Guid Id, Guid ClaimId, Guid? FriendlySettlementId,
    string FullName, string? Afm, string? Phone, string? Address,
    string VictimType, string? VehiclePlate, string? Description,
    decimal? ReserveAmount, decimal? PaidAmount, string Currency, string Status);

public record ClaimVictimBody(
    Guid ClaimId, Guid? FriendlySettlementId,
    string FullName, string? Afm, string? Phone, string? Address,
    string VictimType, string? VehiclePlate, string? Description,
    decimal? ReserveAmount, string Currency, string Status);

public record ListClaimVictimsQuery(Guid? ClaimId, Guid? SettlementId) : IRequest<IReadOnlyList<ClaimVictimDto>>;
public class ListClaimVictimsHandler : IRequestHandler<ListClaimVictimsQuery, IReadOnlyList<ClaimVictimDto>>
{
    private readonly IAppDbContext _db;
    public ListClaimVictimsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ClaimVictimDto>> Handle(ListClaimVictimsQuery r, CancellationToken ct)
    {
        var q = _db.ClaimVictims.AsQueryable();
        if (r.ClaimId.HasValue) q = q.Where(x => x.ClaimId == r.ClaimId);
        if (r.SettlementId.HasValue) q = q.Where(x => x.FriendlySettlementId == r.SettlementId);
        var rows = await q.OrderBy(x => x.FullName).ToListAsync(ct);
        return rows.Select(v => new ClaimVictimDto(
            v.Id, v.ClaimId, v.FriendlySettlementId,
            v.FullName, v.Afm, v.Phone, v.Address,
            v.VictimType, v.VehiclePlate, v.Description,
            v.ReserveAmount, v.PaidAmount, v.Currency, v.Status)).ToList();
    }
}

public record AddClaimVictimCommand(ClaimVictimBody Body) : IRequest<ClaimVictimDto>;
public class AddClaimVictimHandler : IRequestHandler<AddClaimVictimCommand, ClaimVictimDto>
{
    private readonly IAppDbContext _db;
    public AddClaimVictimHandler(IAppDbContext db) => _db = db;
    public async Task<ClaimVictimDto> Handle(AddClaimVictimCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var v = new ClaimVictim
        {
            Id = Guid.NewGuid(),
            ClaimId = b.ClaimId, FriendlySettlementId = b.FriendlySettlementId,
            FullName = b.FullName.Trim(), Afm = b.Afm, Phone = b.Phone, Address = b.Address,
            VictimType = b.VictimType, VehiclePlate = b.VehiclePlate, Description = b.Description,
            ReserveAmount = b.ReserveAmount, PaidAmount = 0,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            Status = b.Status
        };
        _db.ClaimVictims.Add(v);
        await _db.SaveChangesAsync(ct);
        return new ClaimVictimDto(v.Id, v.ClaimId, v.FriendlySettlementId,
            v.FullName, v.Afm, v.Phone, v.Address, v.VictimType, v.VehiclePlate, v.Description,
            v.ReserveAmount, v.PaidAmount, v.Currency, v.Status);
    }
}

public record DeleteClaimVictimCommand(Guid Id) : IRequest<Unit>;
public class DeleteClaimVictimHandler : IRequestHandler<DeleteClaimVictimCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteClaimVictimHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteClaimVictimCommand r, CancellationToken ct)
    {
        var v = await _db.ClaimVictims.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Victim");
        v.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record SettlementPaymentDto(
    Guid Id, Guid ClaimVictimId, DateOnly PaidOn,
    string PayeeType, string? PayeeName, Guid? GarageId,
    decimal NetAmount, decimal VatAmount, decimal FeeAmount, decimal InterestAmount,
    decimal TotalAmount, string Currency, string PaymentMethod, string? Reference, string? Notes);

public record SettlementPaymentBody(
    Guid ClaimVictimId, DateOnly PaidOn,
    string PayeeType, string? PayeeName, Guid? GarageId,
    decimal NetAmount, decimal VatAmount, decimal FeeAmount, decimal InterestAmount,
    string Currency, string PaymentMethod, string? Reference, string? Notes);

public record AddSettlementPaymentCommand(SettlementPaymentBody Body) : IRequest<SettlementPaymentDto>;
public class AddSettlementPaymentHandler : IRequestHandler<AddSettlementPaymentCommand, SettlementPaymentDto>
{
    private readonly IAppDbContext _db;
    public AddSettlementPaymentHandler(IAppDbContext db) => _db = db;
    public async Task<SettlementPaymentDto> Handle(AddSettlementPaymentCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var victim = await _db.ClaimVictims.FirstOrDefaultAsync(v => v.Id == b.ClaimVictimId, ct)
            ?? throw AppException.NotFound("Victim");
        var total = b.NetAmount + b.VatAmount + b.FeeAmount + b.InterestAmount;
        var p = new SettlementPayment
        {
            Id = Guid.NewGuid(),
            ClaimVictimId = b.ClaimVictimId, PaidOn = b.PaidOn,
            PayeeType = b.PayeeType, PayeeName = b.PayeeName, GarageId = b.GarageId,
            NetAmount = b.NetAmount, VatAmount = b.VatAmount,
            FeeAmount = b.FeeAmount, InterestAmount = b.InterestAmount,
            TotalAmount = total,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? victim.Currency : b.Currency.ToUpperInvariant(),
            PaymentMethod = b.PaymentMethod, Reference = b.Reference, Notes = b.Notes
        };
        _db.SettlementPayments.Add(p);
        victim.PaidAmount = (victim.PaidAmount ?? 0) + total;
        await _db.SaveChangesAsync(ct);
        return new SettlementPaymentDto(p.Id, p.ClaimVictimId, p.PaidOn,
            p.PayeeType, p.PayeeName, p.GarageId,
            p.NetAmount, p.VatAmount, p.FeeAmount, p.InterestAmount,
            p.TotalAmount, p.Currency, p.PaymentMethod, p.Reference, p.Notes);
    }
}

public record ListSettlementPaymentsQuery(Guid VictimId) : IRequest<IReadOnlyList<SettlementPaymentDto>>;
public class ListSettlementPaymentsHandler : IRequestHandler<ListSettlementPaymentsQuery, IReadOnlyList<SettlementPaymentDto>>
{
    private readonly IAppDbContext _db;
    public ListSettlementPaymentsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SettlementPaymentDto>> Handle(ListSettlementPaymentsQuery r, CancellationToken ct)
    {
        var rows = await _db.SettlementPayments
            .Where(p => p.ClaimVictimId == r.VictimId)
            .OrderByDescending(p => p.PaidOn).ToListAsync(ct);
        return rows.Select(p => new SettlementPaymentDto(
            p.Id, p.ClaimVictimId, p.PaidOn,
            p.PayeeType, p.PayeeName, p.GarageId,
            p.NetAmount, p.VatAmount, p.FeeAmount, p.InterestAmount,
            p.TotalAmount, p.Currency, p.PaymentMethod, p.Reference, p.Notes)).ToList();
    }
}

/* ============================================================================
   CALLER ID (Αναγνώριση Κλήσης)
   ========================================================================= */
public record CallerIdLogDto(
    Guid Id, DateTime ReceivedAt, string CallerNumber,
    Guid? MatchedCustomerId, string? MatchedCustomerName,
    string? Direction, int? DurationSeconds, bool Answered, string? Notes);

public record CallerIdLogBody(string CallerNumber, string? Direction);

public record ListCallerIdLogsQuery() : IRequest<IReadOnlyList<CallerIdLogDto>>;
public class ListCallerIdLogsHandler : IRequestHandler<ListCallerIdLogsQuery, IReadOnlyList<CallerIdLogDto>>
{
    private readonly IAppDbContext _db;
    public ListCallerIdLogsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CallerIdLogDto>> Handle(ListCallerIdLogsQuery _, CancellationToken ct)
    {
        var rows = await _db.CallerIdLogs.OrderByDescending(x => x.ReceivedAt).Take(200).ToListAsync(ct);
        return rows.Select(c => new CallerIdLogDto(
            c.Id, c.ReceivedAt, c.CallerNumber,
            c.MatchedCustomerId, c.MatchedCustomerName,
            c.Direction, c.DurationSeconds, c.Answered, c.Notes)).ToList();
    }
}

public record LogIncomingCallCommand(CallerIdLogBody Body) : IRequest<CallerIdLogDto>;
public class LogIncomingCallHandler : IRequestHandler<LogIncomingCallCommand, CallerIdLogDto>
{
    private readonly IAppDbContext _db;
    public LogIncomingCallHandler(IAppDbContext db) => _db = db;
    public async Task<CallerIdLogDto> Handle(LogIncomingCallCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var normalised = new string(b.CallerNumber.Where(c => char.IsDigit(c) || c == '+').ToArray());

        var match = await _db.Customers
            .Where(c => c.MobilePhone == normalised || c.Phone == normalised)
            .Select(c => new { c.Id, Name = c.CompanyName ?? (c.FirstName + " " + c.LastName) })
            .FirstOrDefaultAsync(ct);

        var log = new CallerIdLog
        {
            Id = Guid.NewGuid(),
            ReceivedAt = DateTime.UtcNow,
            CallerNumber = normalised,
            MatchedCustomerId = match?.Id,
            MatchedCustomerName = match?.Name,
            Direction = b.Direction ?? "Inbound",
            Answered = false
        };
        _db.CallerIdLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return new CallerIdLogDto(log.Id, log.ReceivedAt, log.CallerNumber,
            log.MatchedCustomerId, log.MatchedCustomerName,
            log.Direction, log.DurationSeconds, log.Answered, log.Notes);
    }
}

/* ============================================================================
   ΥΣΑΕ Submissions
   ========================================================================= */
public record UsaeSubmissionDto(
    Guid Id, Guid ClaimId, string ClaimNumber,
    string SubmissionNumber, DateTime SubmittedAt,
    string Status, string? AcknowledgementCode, string? ErrorMessage);

public record UsaeSubmissionBody(Guid ClaimId, string? PayloadJson);

public record ListUsaeSubmissionsQuery() : IRequest<IReadOnlyList<UsaeSubmissionDto>>;
public class ListUsaeSubmissionsHandler : IRequestHandler<ListUsaeSubmissionsQuery, IReadOnlyList<UsaeSubmissionDto>>
{
    private readonly IAppDbContext _db;
    public ListUsaeSubmissionsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<UsaeSubmissionDto>> Handle(ListUsaeSubmissionsQuery _, CancellationToken ct)
    {
        var rows = await _db.UsaeSubmissions.Include(x => x.Claim)
            .OrderByDescending(x => x.SubmittedAt).Take(500).ToListAsync(ct);
        return rows.Select(s => new UsaeSubmissionDto(
            s.Id, s.ClaimId, s.Claim?.ClaimNumber ?? "",
            s.SubmissionNumber, s.SubmittedAt,
            s.Status, s.AcknowledgementCode, s.ErrorMessage)).ToList();
    }
}

public record SubmitUsaeCommand(UsaeSubmissionBody Body) : IRequest<UsaeSubmissionDto>;
public class SubmitUsaeHandler : IRequestHandler<SubmitUsaeCommand, UsaeSubmissionDto>
{
    private readonly IAppDbContext _db;
    public SubmitUsaeHandler(IAppDbContext db) => _db = db;
    public async Task<UsaeSubmissionDto> Handle(SubmitUsaeCommand r, CancellationToken ct)
    {
        var claim = await _db.Claims.FirstOrDefaultAsync(c => c.Id == r.Body.ClaimId, ct)
            ?? throw AppException.NotFound("Claim");

        var seq = await _db.UsaeSubmissions.CountAsync(ct) + 1;
        var s = new UsaeSubmission
        {
            Id = Guid.NewGuid(),
            ClaimId = claim.Id,
            SubmissionNumber = $"USAE-{DateTime.UtcNow:yyyy}-{seq:D5}",
            SubmittedAt = DateTime.UtcNow,
            Status = "Pending",
            PayloadJson = r.Body.PayloadJson
        };
        _db.UsaeSubmissions.Add(s);
        claim.UsaeStatus = "Pending";
        claim.UsaeSentAt = s.SubmittedAt;
        await _db.SaveChangesAsync(ct);
        return new UsaeSubmissionDto(s.Id, s.ClaimId, claim.ClaimNumber,
            s.SubmissionNumber, s.SubmittedAt, s.Status, null, null);
    }
}

/* ============================================================================
   VEHICLE MODELS lookup
   ========================================================================= */
public record VehicleModelDto(Guid Id, string Manufacturer, string Model, string? Trim,
    int? EngineCc, int? HorsePower, string? FuelType, string? Category, bool IsActive);

public record VehicleModelBody(string Manufacturer, string Model, string? Trim,
    int? EngineCc, int? HorsePower, string? FuelType, string? Category, bool IsActive);

public record ListVehicleModelsQuery(string? Manufacturer) : IRequest<IReadOnlyList<VehicleModelDto>>;
public class ListVehicleModelsHandler : IRequestHandler<ListVehicleModelsQuery, IReadOnlyList<VehicleModelDto>>
{
    private readonly IAppDbContext _db;
    public ListVehicleModelsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<VehicleModelDto>> Handle(ListVehicleModelsQuery r, CancellationToken ct)
    {
        var q = _db.VehicleModels.AsQueryable();
        if (!string.IsNullOrEmpty(r.Manufacturer)) q = q.Where(x => x.Manufacturer == r.Manufacturer);
        var rows = await q.OrderBy(x => x.Manufacturer).ThenBy(x => x.Model).Take(1000).ToListAsync(ct);
        return rows.Select(v => new VehicleModelDto(v.Id, v.Manufacturer, v.Model, v.Trim,
            v.EngineCc, v.HorsePower, v.FuelType, v.Category, v.IsActive)).ToList();
    }
}

public record CreateVehicleModelCommand(VehicleModelBody Body) : IRequest<VehicleModelDto>;
public class CreateVehicleModelHandler : IRequestHandler<CreateVehicleModelCommand, VehicleModelDto>
{
    private readonly IAppDbContext _db;
    public CreateVehicleModelHandler(IAppDbContext db) => _db = db;
    public async Task<VehicleModelDto> Handle(CreateVehicleModelCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var v = new VehicleModel
        {
            Id = Guid.NewGuid(),
            Manufacturer = b.Manufacturer.Trim(), Model = b.Model.Trim(), Trim = b.Trim,
            EngineCc = b.EngineCc, HorsePower = b.HorsePower,
            FuelType = b.FuelType, Category = b.Category, IsActive = b.IsActive
        };
        _db.VehicleModels.Add(v);
        await _db.SaveChangesAsync(ct);
        return new VehicleModelDto(v.Id, v.Manufacturer, v.Model, v.Trim,
            v.EngineCc, v.HorsePower, v.FuelType, v.Category, v.IsActive);
    }
}

/* ============================================================================
   CUSTOMER MERGE (Συγχώνευση Πελατών)
   ========================================================================= */
public record DuplicateCustomerGroupDto(
    string GroupKey, string MatchedOn,
    IReadOnlyList<DuplicateCustomerRow> Customers);

public record DuplicateCustomerRow(
    Guid Id, string CustomerNumber, string DisplayName,
    string? Afm, string? Email, string? Phone, DateTime CreatedAt,
    int PolicyCount);

public record FindDuplicateCustomersQuery() : IRequest<IReadOnlyList<DuplicateCustomerGroupDto>>;
public class FindDuplicateCustomersHandler : IRequestHandler<FindDuplicateCustomersQuery, IReadOnlyList<DuplicateCustomerGroupDto>>
{
    private readonly IAppDbContext _db;
    public FindDuplicateCustomersHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DuplicateCustomerGroupDto>> Handle(FindDuplicateCustomersQuery _, CancellationToken ct)
    {
        var customers = await _db.Customers
            .Where(c => c.DeletedAt == null)
            .Select(c => new
            {
                c.Id, c.CustomerNumber,
                Name = c.CompanyName ?? (c.FirstName + " " + c.LastName),
                c.VatNumber, c.Email, c.MobilePhone, c.Phone, c.CreatedAt
            })
            .ToListAsync(ct);

        var groups = new List<DuplicateCustomerGroupDto>();

        // Match by AFM (most reliable)
        var byAfm = customers
            .Where(c => !string.IsNullOrWhiteSpace(c.VatNumber))
            .GroupBy(c => c.VatNumber)
            .Where(g => g.Count() > 1);
        foreach (var g in byAfm)
        {
            var policyCounts = await _db.Policies.Where(p => g.Select(x => x.Id).Contains(p.CustomerId))
                .GroupBy(p => p.CustomerId).Select(gg => new { CustomerId = gg.Key, Count = gg.Count() })
                .ToListAsync(ct);
            var pcMap = policyCounts.ToDictionary(p => p.CustomerId, p => p.Count);
            groups.Add(new DuplicateCustomerGroupDto(g.Key!, "AFM",
                g.Select(c => new DuplicateCustomerRow(
                    c.Id, c.CustomerNumber, (c.Name ?? "").Trim(),
                    c.VatNumber, c.Email, c.MobilePhone ?? c.Phone, c.CreatedAt,
                    pcMap.GetValueOrDefault(c.Id, 0))).ToList()));
        }

        // Match by email (secondary)
        var byEmail = customers
            .Where(c => !string.IsNullOrWhiteSpace(c.Email))
            .GroupBy(c => c.Email!.ToLowerInvariant())
            .Where(g => g.Count() > 1);
        foreach (var g in byEmail)
        {
            if (groups.Any(gr => g.All(c => gr.Customers.Any(r => r.Id == c.Id)))) continue;
            var policyCounts = await _db.Policies.Where(p => g.Select(x => x.Id).Contains(p.CustomerId))
                .GroupBy(p => p.CustomerId).Select(gg => new { CustomerId = gg.Key, Count = gg.Count() })
                .ToListAsync(ct);
            var pcMap = policyCounts.ToDictionary(p => p.CustomerId, p => p.Count);
            groups.Add(new DuplicateCustomerGroupDto(g.Key, "Email",
                g.Select(c => new DuplicateCustomerRow(
                    c.Id, c.CustomerNumber, (c.Name ?? "").Trim(),
                    c.VatNumber, c.Email, c.MobilePhone ?? c.Phone, c.CreatedAt,
                    pcMap.GetValueOrDefault(c.Id, 0))).ToList()));
        }

        return groups;
    }
}

public record MergeCustomersCommand(Guid KeepId, IReadOnlyList<Guid> RemoveIds) : IRequest<MergeResultDto>;
public record MergeResultDto(int PoliciesMoved, int ClaimsMoved, int ReceiptsMoved, int ContactsMoved, int DocumentsMoved, int Removed);

public class MergeCustomersHandler : IRequestHandler<MergeCustomersCommand, MergeResultDto>
{
    private readonly IAppDbContext _db;
    public MergeCustomersHandler(IAppDbContext db) => _db = db;
    public async Task<MergeResultDto> Handle(MergeCustomersCommand r, CancellationToken ct)
    {
        if (r.RemoveIds.Contains(r.KeepId))
            throw new AppException("merge_self",
                "Δεν μπορείτε να συμπεριλάβετε τον πελάτη που κρατάτε στη λίστα διαγραφής.", 400,
                title: "Άκυρη ενέργεια",
                why: "Ο πελάτης που επιλέξατε ως «κρατάμε» περιλαμβάνεται και στους «διαγραφή».",
                fix: "Αφαιρέστε τον από την λίστα διαγραφής.");

        var keep = await _db.Customers.FirstOrDefaultAsync(c => c.Id == r.KeepId, ct)
            ?? throw AppException.NotFound("Customer");

        int policiesMoved = await _db.Policies
            .Where(p => r.RemoveIds.Contains(p.CustomerId))
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CustomerId, r.KeepId), ct);

        int claimsMoved = 0; // claims follow policies — no direct relink
        int receiptsMoved = await _db.Receipts
            .Where(p => r.RemoveIds.Contains(p.CustomerId))
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CustomerId, r.KeepId), ct);
        int contactsMoved = await _db.CustomerContacts
            .Where(p => r.RemoveIds.Contains(p.CustomerId))
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.CustomerId, r.KeepId), ct);
        int documentsMoved = 0;

        await _db.Customers
            .Where(c => r.RemoveIds.Contains(c.Id))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.DeletedAt, DateTime.UtcNow), ct);

        return new MergeResultDto(policiesMoved, claimsMoved, receiptsMoved, contactsMoved, documentsMoved, r.RemoveIds.Count);
    }
}

/* ============================================================================
   PERSISTENCY DASHBOARD (Διατηρησιμότητα Συμβολαίων)
   ========================================================================= */
public record PersistencyRow(string Dimension, int Issued, int Renewed, decimal PersistencyPercent, decimal PremiumRetained);
public record PersistencyDto(
    DateOnly From, DateOnly To,
    int TotalIssued, int TotalRenewed, decimal OverallPersistency,
    IReadOnlyList<PersistencyRow> ByCarrier,
    IReadOnlyList<PersistencyRow> ByProducer,
    IReadOnlyList<PersistencyRow> ByPolicyType);

public record GetPersistencyQuery(DateOnly From, DateOnly To) : IRequest<PersistencyDto>;
public class GetPersistencyHandler : IRequestHandler<GetPersistencyQuery, PersistencyDto>
{
    private readonly IAppDbContext _db;
    public GetPersistencyHandler(IAppDbContext db) => _db = db;
    public async Task<PersistencyDto> Handle(GetPersistencyQuery r, CancellationToken ct)
    {
        var policies = await _db.Policies
            .Include(p => p.InsuranceCompany)
            .Include(p => p.Producer)
            .Where(p => p.EndDate >= r.From && p.EndDate <= r.To)
            .ToListAsync(ct);

        // A policy is "renewed" if there exists another policy with RenewedFromPolicyId pointing to it.
        var renewedFromIds = await _db.Policies
            .Where(p => p.RenewedFromPolicyId != null
                        && policies.Select(x => x.Id).Contains(p.RenewedFromPolicyId!.Value))
            .Select(p => p.RenewedFromPolicyId!.Value)
            .ToListAsync(ct);
        var renewedSet = renewedFromIds.ToHashSet();

        decimal Pct(int issued, int renewed) => issued == 0 ? 0 : Math.Round(100m * renewed / issued, 2);

        var byCarrier = policies
            .GroupBy(p => p.InsuranceCompany.Name)
            .Select(g => new PersistencyRow(
                g.Key,
                g.Count(),
                g.Count(p => renewedSet.Contains(p.Id)),
                Pct(g.Count(), g.Count(p => renewedSet.Contains(p.Id))),
                g.Where(p => renewedSet.Contains(p.Id)).Sum(p => p.Premium)))
            .OrderByDescending(x => x.Issued)
            .ToList();

        var byProducer = policies
            .Where(p => p.Producer != null)
            .GroupBy(p => p.Producer!.Name)
            .Select(g => new PersistencyRow(
                g.Key,
                g.Count(),
                g.Count(p => renewedSet.Contains(p.Id)),
                Pct(g.Count(), g.Count(p => renewedSet.Contains(p.Id))),
                g.Where(p => renewedSet.Contains(p.Id)).Sum(p => p.Premium)))
            .OrderByDescending(x => x.Issued)
            .ToList();

        var byType = policies
            .GroupBy(p => p.PolicyType.ToString())
            .Select(g => new PersistencyRow(
                g.Key,
                g.Count(),
                g.Count(p => renewedSet.Contains(p.Id)),
                Pct(g.Count(), g.Count(p => renewedSet.Contains(p.Id))),
                g.Where(p => renewedSet.Contains(p.Id)).Sum(p => p.Premium)))
            .OrderByDescending(x => x.Issued)
            .ToList();

        var total = policies.Count;
        var renewed = policies.Count(p => renewedSet.Contains(p.Id));

        return new PersistencyDto(r.From, r.To, total, renewed, Pct(total, renewed),
            byCarrier, byProducer, byType);
    }
}

/* ============================================================================
   POLICY DELIVERY (Παράδοση Συμβολαίων)
   ========================================================================= */
public record DeliveryRowDto(
    Guid PolicyId, string PolicyNumber, string CustomerName,
    DateOnly StartDate, decimal Premium, string Currency,
    DateOnly? DeliveredAt, string? DeliveredTo, string? DeliveryMethod);

public record MarkDeliveredBody(IReadOnlyList<Guid> PolicyIds, DateOnly DeliveredAt, string? DeliveredTo, string DeliveryMethod);

public record ListUndeliveredPoliciesQuery() : IRequest<IReadOnlyList<DeliveryRowDto>>;
public class ListUndeliveredPoliciesHandler : IRequestHandler<ListUndeliveredPoliciesQuery, IReadOnlyList<DeliveryRowDto>>
{
    private readonly IAppDbContext _db;
    public ListUndeliveredPoliciesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DeliveryRowDto>> Handle(ListUndeliveredPoliciesQuery _, CancellationToken ct)
    {
        var rows = await _db.Policies
            .Include(p => p.Customer)
            .Where(p => p.DeliveredAt == null)
            .OrderBy(p => p.StartDate)
            .Take(500).ToListAsync(ct);
        return rows.Select(p => new DeliveryRowDto(
            p.Id, p.PolicyNumber,
            (p.Customer.CompanyName ?? $"{p.Customer.FirstName} {p.Customer.LastName}").Trim(),
            p.StartDate, p.Premium, p.Currency,
            p.DeliveredAt, p.DeliveredTo, p.DeliveryMethod)).ToList();
    }
}

public record MarkPoliciesDeliveredCommand(MarkDeliveredBody Body) : IRequest<int>;
public class MarkPoliciesDeliveredHandler : IRequestHandler<MarkPoliciesDeliveredCommand, int>
{
    private readonly IAppDbContext _db;
    public MarkPoliciesDeliveredHandler(IAppDbContext db) => _db = db;
    public async Task<int> Handle(MarkPoliciesDeliveredCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var n = await _db.Policies
            .Where(p => b.PolicyIds.Contains(p.Id))
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.DeliveredAt, b.DeliveredAt)
                .SetProperty(p => p.DeliveredTo, b.DeliveredTo)
                .SetProperty(p => p.DeliveryMethod, b.DeliveryMethod), ct);
        return n;
    }
}

/* ============================================================================
   ΑΦΜ / ΓΕΜΗ LOOKUP STUBS (later wired to ΑΑΔΕ/ΓΕΜΗ SOAP services)
   ========================================================================= */
public record AfmLookupDto(string Afm, string? CompanyName, string? FirstName, string? LastName,
    string? Doy, string? Address, string? PostalCode, string? City, string? LegalForm, bool Found);

public record AfmLookupQuery(string Afm) : IRequest<AfmLookupDto>;
public class AfmLookupHandler : IRequestHandler<AfmLookupQuery, AfmLookupDto>
{
    public Task<AfmLookupDto> Handle(AfmLookupQuery r, CancellationToken ct)
    {
        // TODO: wire to AADE SOAP rgWsBasStoixN. For now return a structured "not configured" envelope
        // so the UI can render a "configure credentials" message rather than crash.
        return Task.FromResult(new AfmLookupDto(r.Afm, null, null, null, null, null, null, null, null, false));
    }
}

public record GemiLookupDto(string Afm, string? GemiNumber, string? CompanyName, string? Activity,
    string? Status, bool Found);

public record GemiLookupQuery(string Afm) : IRequest<GemiLookupDto>;
public class GemiLookupHandler : IRequestHandler<GemiLookupQuery, GemiLookupDto>
{
    public Task<GemiLookupDto> Handle(GemiLookupQuery r, CancellationToken ct)
    {
        return Task.FromResult(new GemiLookupDto(r.Afm, null, null, null, null, false));
    }
}

/* ============================================================================
   VALIDATORS
   ========================================================================= */
public class FriendlySettlementBodyValidator : AbstractValidator<FriendlySettlementBody>
{
    public FriendlySettlementBodyValidator()
    {
        RuleFor(x => x.SettlementFileNumber).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Currency).NotEmpty().MaximumLength(3);
    }
}

public class ClaimVictimBodyValidator : AbstractValidator<ClaimVictimBody>
{
    public ClaimVictimBodyValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
    }
}
