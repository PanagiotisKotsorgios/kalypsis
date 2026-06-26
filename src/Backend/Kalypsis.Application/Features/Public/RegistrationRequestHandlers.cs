using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Public;

public record RegistrationRequestDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? VatNumber,
    string? LicenseNumber,
    string? City,
    string? Message,
    string ReferenceCode,
    string Status,
    string? ReviewNotes,
    DateTime? ReviewedAt,
    string? IpAddress,
    DateTime SubmittedAt
);

public record RegistrationRequestSummaryDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? City,
    string ReferenceCode,
    string Status,
    DateTime SubmittedAt
);

public record RegistrationRequestStatsDto(int Total, int New, int Reviewing, int Approved, int Rejected);

/* ========================================================================
 * Public — anonymous submission from the /register form.
 * ====================================================================== */

public record SubmitRegistrationRequestCommand(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string? OrganizationName,
    string? VatNumber,
    string? LicenseNumber,
    string? City,
    string? Message,
    string? IpAddress,
    string? UserAgent
) : IRequest<RegistrationRequestDto>;

public class SubmitRegistrationRequestCommandValidator : AbstractValidator<SubmitRegistrationRequestCommand>
{
    public SubmitRegistrationRequestCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(50);
        When(x => !string.IsNullOrWhiteSpace(x.OrganizationName), () =>
            RuleFor(x => x.OrganizationName!).MaximumLength(200));
        When(x => !string.IsNullOrWhiteSpace(x.VatNumber), () =>
            RuleFor(x => x.VatNumber!).MaximumLength(20));
        When(x => !string.IsNullOrWhiteSpace(x.LicenseNumber), () =>
            RuleFor(x => x.LicenseNumber!).MaximumLength(60));
        When(x => !string.IsNullOrWhiteSpace(x.City), () =>
            RuleFor(x => x.City!).MaximumLength(120));
        When(x => !string.IsNullOrWhiteSpace(x.Message), () =>
            RuleFor(x => x.Message!).MaximumLength(2000));
    }
}

public class SubmitRegistrationRequestCommandHandler
    : IRequestHandler<SubmitRegistrationRequestCommand, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    public SubmitRegistrationRequestCommandHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestDto> Handle(SubmitRegistrationRequestCommand r, CancellationToken ct)
    {
        // KLP-XXXXXX. Loop with a hard cap so we don't spin forever if the RNG
        // unluckily collides with an already-issued code.
        string code = string.Empty;
        for (var i = 0; i < 8; i++)
        {
            var candidate = "KLP-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
            var exists = await _db.RegistrationRequests.AnyAsync(x => x.ReferenceCode == candidate, ct);
            if (!exists) { code = candidate; break; }
        }
        if (string.IsNullOrEmpty(code))
            code = "KLP-" + DateTime.UtcNow.Ticks.ToString()[^6..];

        var rec = new RegistrationRequest
        {
            Id = Guid.NewGuid(),
            FirstName = r.FirstName.Trim(),
            LastName  = r.LastName.Trim(),
            Email     = r.Email.Trim().ToLowerInvariant(),
            Phone     = r.Phone.Trim(),
            OrganizationName = string.IsNullOrWhiteSpace(r.OrganizationName) ? null : r.OrganizationName.Trim(),
            VatNumber        = string.IsNullOrWhiteSpace(r.VatNumber)        ? null : r.VatNumber.Trim(),
            LicenseNumber    = string.IsNullOrWhiteSpace(r.LicenseNumber)    ? null : r.LicenseNumber.Trim(),
            City             = string.IsNullOrWhiteSpace(r.City)             ? null : r.City.Trim(),
            Message          = string.IsNullOrWhiteSpace(r.Message)          ? null : r.Message.Trim(),
            ReferenceCode    = code,
            Status           = RegistrationRequestStatus.New,
            IpAddress        = string.IsNullOrWhiteSpace(r.IpAddress) ? null : r.IpAddress,
            UserAgent        = string.IsNullOrWhiteSpace(r.UserAgent) ? null : r.UserAgent
        };
        _db.RegistrationRequests.Add(rec);
        await _db.SaveChangesAsync(ct);
        return RegistrationRequestMapper.Map(rec);
    }
}

/* ========================================================================
 * Superadmin — list, get, update status.
 * ====================================================================== */

public record ListRegistrationRequestsQuery(string? Status, string? Search)
    : IRequest<IReadOnlyList<RegistrationRequestSummaryDto>>;

public class ListRegistrationRequestsQueryHandler
    : IRequestHandler<ListRegistrationRequestsQuery, IReadOnlyList<RegistrationRequestSummaryDto>>
{
    private readonly IAppDbContext _db;
    public ListRegistrationRequestsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<IReadOnlyList<RegistrationRequestSummaryDto>> Handle(
        ListRegistrationRequestsQuery r, CancellationToken ct)
    {
        var q = _db.RegistrationRequests.Where(x => x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(r.Status)
            && Enum.TryParse<RegistrationRequestStatus>(r.Status, true, out var st))
        {
            q = q.Where(x => x.Status == st);
        }
        if (!string.IsNullOrWhiteSpace(r.Search))
        {
            var s = r.Search.Trim().ToLower();
            q = q.Where(x =>
                EF.Functions.Like(x.Email.ToLower(),     $"%{s}%") ||
                EF.Functions.Like(x.FirstName.ToLower(), $"%{s}%") ||
                EF.Functions.Like(x.LastName.ToLower(),  $"%{s}%") ||
                EF.Functions.Like(x.ReferenceCode.ToLower(), $"%{s}%") ||
                (x.OrganizationName != null && EF.Functions.Like(x.OrganizationName.ToLower(), $"%{s}%")));
        }
        var rows = await q.OrderByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        return rows.Select(x => new RegistrationRequestSummaryDto(
            x.Id, x.FirstName, x.LastName, x.Email, x.Phone,
            x.OrganizationName, x.City, x.ReferenceCode, x.Status.ToString(), x.CreatedAt
        )).ToList();
    }
}

public record GetRegistrationRequestQuery(Guid Id) : IRequest<RegistrationRequestDto>;

public class GetRegistrationRequestQueryHandler
    : IRequestHandler<GetRegistrationRequestQuery, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    public GetRegistrationRequestQueryHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestDto> Handle(GetRegistrationRequestQuery r, CancellationToken ct)
    {
        var rec = await _db.RegistrationRequests
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("RegistrationRequest");
        return RegistrationRequestMapper.Map(rec);
    }
}

public record GetRegistrationRequestStatsQuery() : IRequest<RegistrationRequestStatsDto>;

public class GetRegistrationRequestStatsQueryHandler
    : IRequestHandler<GetRegistrationRequestStatsQuery, RegistrationRequestStatsDto>
{
    private readonly IAppDbContext _db;
    public GetRegistrationRequestStatsQueryHandler(IAppDbContext db) => _db = db;

    public async Task<RegistrationRequestStatsDto> Handle(GetRegistrationRequestStatsQuery _, CancellationToken ct)
    {
        var rows = await _db.RegistrationRequests
            .Where(x => x.DeletedAt == null)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int by(RegistrationRequestStatus s) => rows.FirstOrDefault(r => r.Status == s)?.Count ?? 0;
        var total = rows.Sum(r => r.Count);
        return new RegistrationRequestStatsDto(
            total,
            by(RegistrationRequestStatus.New),
            by(RegistrationRequestStatus.Reviewing),
            by(RegistrationRequestStatus.Approved),
            by(RegistrationRequestStatus.Rejected));
    }
}

public record UpdateRegistrationRequestStatusCommand(Guid Id, string Status, string? ReviewNotes)
    : IRequest<RegistrationRequestDto>;

public class UpdateRegistrationRequestStatusCommandValidator
    : AbstractValidator<UpdateRegistrationRequestStatusCommand>
{
    public UpdateRegistrationRequestStatusCommandValidator()
    {
        RuleFor(x => x.Status).NotEmpty()
            .Must(s => Enum.TryParse<RegistrationRequestStatus>(s, true, out _))
            .WithMessage("Invalid status. Use New / Reviewing / Approved / Rejected.");
        When(x => !string.IsNullOrWhiteSpace(x.ReviewNotes), () =>
            RuleFor(x => x.ReviewNotes!).MaximumLength(2000));
    }
}

public class UpdateRegistrationRequestStatusCommandHandler
    : IRequestHandler<UpdateRegistrationRequestStatusCommand, RegistrationRequestDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    public UpdateRegistrationRequestStatusCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    { _db = db; _currentUser = currentUser; }

    public async Task<RegistrationRequestDto> Handle(UpdateRegistrationRequestStatusCommand r, CancellationToken ct)
    {
        var rec = await _db.RegistrationRequests
            .FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("RegistrationRequest");

        var next = Enum.Parse<RegistrationRequestStatus>(r.Status, true);
        rec.Status = next;
        rec.ReviewNotes = string.IsNullOrWhiteSpace(r.ReviewNotes) ? null : r.ReviewNotes.Trim();
        // Stamp reviewer only for terminal/working states, not when reset to New.
        if (next != RegistrationRequestStatus.New)
        {
            rec.ReviewedAt = DateTime.UtcNow;
            rec.ReviewedByUserId = _currentUser.UserId;
        }
        else
        {
            rec.ReviewedAt = null;
            rec.ReviewedByUserId = null;
        }
        await _db.SaveChangesAsync(ct);
        return RegistrationRequestMapper.Map(rec);
    }
}

internal static class RegistrationRequestMapper
{
    public static RegistrationRequestDto Map(RegistrationRequest r) => new(
        r.Id, r.FirstName, r.LastName, r.Email, r.Phone,
        r.OrganizationName, r.VatNumber, r.LicenseNumber, r.City, r.Message,
        r.ReferenceCode, r.Status.ToString(), r.ReviewNotes, r.ReviewedAt,
        r.IpAddress, r.CreatedAt
    );
}
