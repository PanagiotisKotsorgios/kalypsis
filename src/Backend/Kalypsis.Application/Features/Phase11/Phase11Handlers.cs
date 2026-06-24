using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase11;

// ============================================================================
// Phase 11 — Compact CRUD handlers for the remaining ALIS gap features.
// Each section: Dto + Body + List + Create + Update + Delete (where applicable).
// ============================================================================

/* ============================================================================
   GROUP POLICIES (Ομαδικά Συμβόλαια)
   ========================================================================= */

public record GroupPolicyDto(
    Guid Id, string GroupNumber, string Name,
    Guid PolicyHolderCustomerId, string PolicyHolderName,
    Guid InsuranceCompanyId, string InsuranceCompanyName,
    DateOnly StartDate, DateOnly? EndDate,
    decimal Premium, string Currency, string Status, int MemberCount, string? Notes);

public record GroupPolicyBody(
    string GroupNumber, string Name,
    Guid PolicyHolderCustomerId, Guid InsuranceCompanyId,
    DateOnly StartDate, DateOnly? EndDate,
    decimal Premium, string Currency, string Status, string? Notes);

public record GroupPolicyMemberDto(
    Guid Id, Guid GroupPolicyId, string FullName, string? Afm, string? Amka,
    DateOnly? BirthDate, string? Relationship, DateOnly EnrolledFrom, DateOnly? EnrolledTo,
    decimal? IndividualPremium);

public record GroupPolicyMemberBody(
    Guid GroupPolicyId, string FullName, string? Afm, string? Amka,
    DateOnly? BirthDate, string? Relationship, DateOnly EnrolledFrom, DateOnly? EnrolledTo,
    decimal? IndividualPremium);

public record ListGroupPoliciesQuery() : IRequest<IReadOnlyList<GroupPolicyDto>>;
public class ListGroupPoliciesHandler : IRequestHandler<ListGroupPoliciesQuery, IReadOnlyList<GroupPolicyDto>>
{
    private readonly IAppDbContext _db;
    public ListGroupPoliciesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GroupPolicyDto>> Handle(ListGroupPoliciesQuery _, CancellationToken ct)
    {
        var rows = await _db.GroupPolicies
            .Include(x => x.PolicyHolder)
            .Include(x => x.InsuranceCompany)
            .OrderByDescending(x => x.StartDate)
            .Take(500)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    internal static GroupPolicyDto Map(GroupPolicy g) => new(
        g.Id, g.GroupNumber, g.Name,
        g.PolicyHolderCustomerId,
        g.PolicyHolder is null ? "" : (g.PolicyHolder.CompanyName ?? $"{g.PolicyHolder.FirstName} {g.PolicyHolder.LastName}".Trim()),
        g.InsuranceCompanyId, g.InsuranceCompany?.Name ?? "",
        g.StartDate, g.EndDate, g.Premium, g.Currency, g.Status, g.MemberCount, g.Notes);
}

public class GroupPolicyBodyValidator : AbstractValidator<GroupPolicyBody>
{
    public GroupPolicyBodyValidator()
    {
        RuleFor(x => x.GroupNumber).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Currency).NotEmpty().MaximumLength(3);
        RuleFor(x => x.Premium).GreaterThanOrEqualTo(0);
    }
}

public record CreateGroupPolicyCommand(GroupPolicyBody Body) : IRequest<GroupPolicyDto>;
public class CreateGroupPolicyHandler : IRequestHandler<CreateGroupPolicyCommand, GroupPolicyDto>
{
    private readonly IAppDbContext _db;
    public CreateGroupPolicyHandler(IAppDbContext db) => _db = db;
    public async Task<GroupPolicyDto> Handle(CreateGroupPolicyCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.GroupPolicies.AnyAsync(x => x.GroupNumber == b.GroupNumber, ct))
            throw new AppException("group_number_taken",
                $"Υπάρχει ήδη ομαδικό με αριθμό {b.GroupNumber}.", 409,
                title: "Αριθμός σε χρήση",
                why: $"Ο αριθμός ομάδας «{b.GroupNumber}» χρησιμοποιείται. Πρέπει να είναι μοναδικός στο γραφείο.",
                fix: "Επιλέξτε διαφορετικό αριθμό ή ανοίξτε το υπάρχον ομαδικό για να το επεξεργαστείτε.",
                fixLink: "/app/group-policies");

        var entity = new GroupPolicy
        {
            Id = Guid.NewGuid(),
            GroupNumber = b.GroupNumber.Trim(),
            Name = b.Name.Trim(),
            PolicyHolderCustomerId = b.PolicyHolderCustomerId,
            InsuranceCompanyId = b.InsuranceCompanyId,
            StartDate = b.StartDate, EndDate = b.EndDate,
            Premium = b.Premium, Currency = b.Currency.ToUpperInvariant(),
            Status = b.Status, Notes = b.Notes
        };
        _db.GroupPolicies.Add(entity);
        await _db.SaveChangesAsync(ct);
        entity = await _db.GroupPolicies
            .Include(x => x.PolicyHolder).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == entity.Id, ct);
        return ListGroupPoliciesHandler.Map(entity);
    }
}

public record UpdateGroupPolicyCommand(Guid Id, GroupPolicyBody Body) : IRequest<GroupPolicyDto>;
public class UpdateGroupPolicyHandler : IRequestHandler<UpdateGroupPolicyCommand, GroupPolicyDto>
{
    private readonly IAppDbContext _db;
    public UpdateGroupPolicyHandler(IAppDbContext db) => _db = db;
    public async Task<GroupPolicyDto> Handle(UpdateGroupPolicyCommand r, CancellationToken ct)
    {
        var e = await _db.GroupPolicies.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("GroupPolicy");
        var b = r.Body;
        e.GroupNumber = b.GroupNumber.Trim(); e.Name = b.Name.Trim();
        e.PolicyHolderCustomerId = b.PolicyHolderCustomerId;
        e.InsuranceCompanyId = b.InsuranceCompanyId;
        e.StartDate = b.StartDate; e.EndDate = b.EndDate;
        e.Premium = b.Premium; e.Currency = b.Currency.ToUpperInvariant();
        e.Status = b.Status; e.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        e = await _db.GroupPolicies.Include(x => x.PolicyHolder).Include(x => x.InsuranceCompany)
            .FirstAsync(x => x.Id == e.Id, ct);
        return ListGroupPoliciesHandler.Map(e);
    }
}

public record DeleteGroupPolicyCommand(Guid Id) : IRequest<Unit>;
public class DeleteGroupPolicyHandler : IRequestHandler<DeleteGroupPolicyCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteGroupPolicyHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteGroupPolicyCommand r, CancellationToken ct)
    {
        var e = await _db.GroupPolicies.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("GroupPolicy");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record ListGroupPolicyMembersQuery(Guid GroupPolicyId) : IRequest<IReadOnlyList<GroupPolicyMemberDto>>;
public class ListGroupPolicyMembersHandler : IRequestHandler<ListGroupPolicyMembersQuery, IReadOnlyList<GroupPolicyMemberDto>>
{
    private readonly IAppDbContext _db;
    public ListGroupPolicyMembersHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GroupPolicyMemberDto>> Handle(ListGroupPolicyMembersQuery r, CancellationToken ct)
    {
        var rows = await _db.GroupPolicyMembers
            .Where(x => x.GroupPolicyId == r.GroupPolicyId)
            .OrderBy(x => x.FullName).ToListAsync(ct);
        return rows.Select(m => new GroupPolicyMemberDto(
            m.Id, m.GroupPolicyId, m.FullName, m.Afm, m.Amka,
            m.BirthDate, m.Relationship, m.EnrolledFrom, m.EnrolledTo, m.IndividualPremium)).ToList();
    }
}

public record AddGroupPolicyMemberCommand(GroupPolicyMemberBody Body) : IRequest<GroupPolicyMemberDto>;
public class AddGroupPolicyMemberHandler : IRequestHandler<AddGroupPolicyMemberCommand, GroupPolicyMemberDto>
{
    private readonly IAppDbContext _db;
    public AddGroupPolicyMemberHandler(IAppDbContext db) => _db = db;
    public async Task<GroupPolicyMemberDto> Handle(AddGroupPolicyMemberCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var m = new GroupPolicyMember
        {
            Id = Guid.NewGuid(),
            GroupPolicyId = b.GroupPolicyId,
            FullName = b.FullName.Trim(), Afm = b.Afm, Amka = b.Amka,
            BirthDate = b.BirthDate, Relationship = b.Relationship,
            EnrolledFrom = b.EnrolledFrom, EnrolledTo = b.EnrolledTo,
            IndividualPremium = b.IndividualPremium
        };
        _db.GroupPolicyMembers.Add(m);

        var group = await _db.GroupPolicies.FirstOrDefaultAsync(x => x.Id == b.GroupPolicyId, ct)
            ?? throw AppException.NotFound("GroupPolicy");
        group.MemberCount = await _db.GroupPolicyMembers.CountAsync(x => x.GroupPolicyId == b.GroupPolicyId, ct) + 1;

        await _db.SaveChangesAsync(ct);
        return new GroupPolicyMemberDto(m.Id, m.GroupPolicyId, m.FullName, m.Afm, m.Amka,
            m.BirthDate, m.Relationship, m.EnrolledFrom, m.EnrolledTo, m.IndividualPremium);
    }
}

public record RemoveGroupPolicyMemberCommand(Guid Id) : IRequest<Unit>;
public class RemoveGroupPolicyMemberHandler : IRequestHandler<RemoveGroupPolicyMemberCommand, Unit>
{
    private readonly IAppDbContext _db;
    public RemoveGroupPolicyMemberHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(RemoveGroupPolicyMemberCommand r, CancellationToken ct)
    {
        var m = await _db.GroupPolicyMembers.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Member");
        m.DeletedAt = DateTime.UtcNow;

        var group = await _db.GroupPolicies.FirstOrDefaultAsync(x => x.Id == m.GroupPolicyId, ct);
        if (group != null)
        {
            group.MemberCount = Math.Max(0, await _db.GroupPolicyMembers
                .CountAsync(x => x.GroupPolicyId == m.GroupPolicyId && x.DeletedAt == null, ct) - 1);
        }
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   CLAIM PROVISIONS (Προβλέψεις)
   ========================================================================= */

public record ClaimProvisionDto(
    Guid Id, Guid ClaimId, string ClaimNumber,
    decimal ReserveAmount, decimal? IncurredButNotReported, string Currency,
    DateOnly EvaluationDate, string? AssessorName, string? Notes);

public record ClaimProvisionBody(
    Guid ClaimId, decimal ReserveAmount, decimal? IncurredButNotReported,
    string Currency, DateOnly EvaluationDate, string? AssessorName, string? Notes);

public record ListClaimProvisionsQuery(Guid? ClaimId) : IRequest<IReadOnlyList<ClaimProvisionDto>>;
public class ListClaimProvisionsHandler : IRequestHandler<ListClaimProvisionsQuery, IReadOnlyList<ClaimProvisionDto>>
{
    private readonly IAppDbContext _db;
    public ListClaimProvisionsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ClaimProvisionDto>> Handle(ListClaimProvisionsQuery r, CancellationToken ct)
    {
        var q = _db.ClaimProvisions.Include(x => x.Claim).AsQueryable();
        if (r.ClaimId.HasValue) q = q.Where(x => x.ClaimId == r.ClaimId);
        var rows = await q.OrderByDescending(x => x.EvaluationDate).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static ClaimProvisionDto Map(ClaimProvision p) => new(
        p.Id, p.ClaimId, p.Claim?.ClaimNumber ?? "",
        p.ReserveAmount, p.IncurredButNotReported, p.Currency,
        p.EvaluationDate, p.AssessorName, p.Notes);
}

public record CreateClaimProvisionCommand(ClaimProvisionBody Body) : IRequest<ClaimProvisionDto>;
public class CreateClaimProvisionHandler : IRequestHandler<CreateClaimProvisionCommand, ClaimProvisionDto>
{
    private readonly IAppDbContext _db;
    public CreateClaimProvisionHandler(IAppDbContext db) => _db = db;
    public async Task<ClaimProvisionDto> Handle(CreateClaimProvisionCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var entity = new ClaimProvision
        {
            Id = Guid.NewGuid(),
            ClaimId = b.ClaimId,
            ReserveAmount = b.ReserveAmount,
            IncurredButNotReported = b.IncurredButNotReported,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            EvaluationDate = b.EvaluationDate,
            AssessorName = b.AssessorName, Notes = b.Notes
        };
        _db.ClaimProvisions.Add(entity);
        await _db.SaveChangesAsync(ct);
        entity = await _db.ClaimProvisions.Include(x => x.Claim).FirstAsync(x => x.Id == entity.Id, ct);
        return ListClaimProvisionsHandler.Map(entity);
    }
}

public record DeleteClaimProvisionCommand(Guid Id) : IRequest<Unit>;
public class DeleteClaimProvisionHandler : IRequestHandler<DeleteClaimProvisionCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteClaimProvisionHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteClaimProvisionCommand r, CancellationToken ct)
    {
        var e = await _db.ClaimProvisions.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Provision");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   CLAIM INDEMNITIES (Αποζημιώσεις)
   ========================================================================= */

public record ClaimIndemnityDto(
    Guid Id, Guid ClaimId, string ClaimNumber,
    string PaymentNumber, DateOnly PaidOn, decimal Amount, string Currency,
    string PayeeType, string? PayeeName, Guid? GarageId, string? GarageName,
    string PaymentMethod, string? Reference, string? Notes);

public record ClaimIndemnityBody(
    Guid ClaimId, string PaymentNumber, DateOnly PaidOn, decimal Amount, string Currency,
    string PayeeType, string? PayeeName, Guid? GarageId,
    string PaymentMethod, string? Reference, string? Notes);

public record ListClaimIndemnitiesQuery(Guid? ClaimId) : IRequest<IReadOnlyList<ClaimIndemnityDto>>;
public class ListClaimIndemnitiesHandler : IRequestHandler<ListClaimIndemnitiesQuery, IReadOnlyList<ClaimIndemnityDto>>
{
    private readonly IAppDbContext _db;
    public ListClaimIndemnitiesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<ClaimIndemnityDto>> Handle(ListClaimIndemnitiesQuery r, CancellationToken ct)
    {
        var q = _db.ClaimIndemnities.Include(x => x.Claim).Include(x => x.Garage).AsQueryable();
        if (r.ClaimId.HasValue) q = q.Where(x => x.ClaimId == r.ClaimId);
        var rows = await q.OrderByDescending(x => x.PaidOn).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static ClaimIndemnityDto Map(ClaimIndemnity i) => new(
        i.Id, i.ClaimId, i.Claim?.ClaimNumber ?? "",
        i.PaymentNumber, i.PaidOn, i.Amount, i.Currency,
        i.PayeeType, i.PayeeName, i.GarageId, i.Garage?.Name,
        i.PaymentMethod, i.Reference, i.Notes);
}

public record CreateClaimIndemnityCommand(ClaimIndemnityBody Body) : IRequest<ClaimIndemnityDto>;
public class CreateClaimIndemnityHandler : IRequestHandler<CreateClaimIndemnityCommand, ClaimIndemnityDto>
{
    private readonly IAppDbContext _db;
    public CreateClaimIndemnityHandler(IAppDbContext db) => _db = db;
    public async Task<ClaimIndemnityDto> Handle(CreateClaimIndemnityCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.ClaimIndemnities.AnyAsync(x => x.PaymentNumber == b.PaymentNumber, ct))
            throw new AppException("payment_number_taken",
                $"Υπάρχει ήδη αποζημίωση με αρ. {b.PaymentNumber}.", 409,
                title: "Αριθμός σε χρήση",
                why: "Ο αριθμός πληρωμής αποζημίωσης πρέπει να είναι μοναδικός.",
                fix: "Επιλέξτε άλλο αριθμό ή αφήστε το σύστημα να τον γεννήσει αυτόματα.",
                fixLink: "/app/indemnities");
        var entity = new ClaimIndemnity
        {
            Id = Guid.NewGuid(),
            ClaimId = b.ClaimId,
            PaymentNumber = b.PaymentNumber.Trim(),
            PaidOn = b.PaidOn, Amount = b.Amount,
            Currency = b.Currency.ToUpperInvariant(),
            PayeeType = b.PayeeType, PayeeName = b.PayeeName,
            GarageId = b.GarageId, PaymentMethod = b.PaymentMethod,
            Reference = b.Reference, Notes = b.Notes
        };
        _db.ClaimIndemnities.Add(entity);
        await _db.SaveChangesAsync(ct);
        entity = await _db.ClaimIndemnities.Include(x => x.Claim).Include(x => x.Garage)
            .FirstAsync(x => x.Id == entity.Id, ct);
        return ListClaimIndemnitiesHandler.Map(entity);
    }
}

public record DeleteClaimIndemnityCommand(Guid Id) : IRequest<Unit>;
public class DeleteClaimIndemnityHandler : IRequestHandler<DeleteClaimIndemnityCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteClaimIndemnityHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteClaimIndemnityCommand r, CancellationToken ct)
    {
        var e = await _db.ClaimIndemnities.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Indemnity");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   GARAGES (Συνεργεία)
   ========================================================================= */

public record GarageDto(
    Guid Id, string Code, string Name, string? Afm, string? Address, string? City,
    string? PostalCode, string? Phone, string? Email, string? Specialty,
    bool IsApproved, string? Iban, bool IsActive, string? Notes);

public record GarageBody(
    string Code, string Name, string? Afm, string? Address, string? City,
    string? PostalCode, string? Phone, string? Email, string? Specialty,
    bool IsApproved, string? Iban, bool IsActive, string? Notes);

public record ListGaragesQuery() : IRequest<IReadOnlyList<GarageDto>>;
public class ListGaragesHandler : IRequestHandler<ListGaragesQuery, IReadOnlyList<GarageDto>>
{
    private readonly IAppDbContext _db;
    public ListGaragesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GarageDto>> Handle(ListGaragesQuery _, CancellationToken ct)
    {
        var rows = await _db.Garages.OrderBy(x => x.Name).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static GarageDto Map(Garage g) => new(
        g.Id, g.Code, g.Name, g.Afm, g.Address, g.City, g.PostalCode,
        g.Phone, g.Email, g.Specialty, g.IsApproved, g.Iban, g.IsActive, g.Notes);
}

public class GarageBodyValidator : AbstractValidator<GarageBody>
{
    public GarageBodyValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}

public record CreateGarageCommand(GarageBody Body) : IRequest<GarageDto>;
public class CreateGarageHandler : IRequestHandler<CreateGarageCommand, GarageDto>
{
    private readonly IAppDbContext _db;
    public CreateGarageHandler(IAppDbContext db) => _db = db;
    public async Task<GarageDto> Handle(CreateGarageCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.Garages.AnyAsync(x => x.Code == b.Code, ct))
            throw new AppException("garage_code_taken",
                "Υπάρχει ήδη συνεργείο με αυτόν τον κωδικό.", 409,
                title: "Κωδικός σε χρήση",
                why: $"Ο κωδικός συνεργείου «{b.Code}» χρησιμοποιείται ήδη.",
                fix: "Διαλέξτε διαφορετικό κωδικό για το νέο συνεργείο.",
                fixLink: "/app/garages");
        var g = new Garage
        {
            Id = Guid.NewGuid(),
            Code = b.Code.Trim(), Name = b.Name.Trim(), Afm = b.Afm,
            Address = b.Address, City = b.City, PostalCode = b.PostalCode,
            Phone = b.Phone, Email = b.Email, Specialty = b.Specialty,
            IsApproved = b.IsApproved, Iban = b.Iban, IsActive = b.IsActive, Notes = b.Notes
        };
        _db.Garages.Add(g);
        await _db.SaveChangesAsync(ct);
        return ListGaragesHandler.Map(g);
    }
}

public record UpdateGarageCommand(Guid Id, GarageBody Body) : IRequest<GarageDto>;
public class UpdateGarageHandler : IRequestHandler<UpdateGarageCommand, GarageDto>
{
    private readonly IAppDbContext _db;
    public UpdateGarageHandler(IAppDbContext db) => _db = db;
    public async Task<GarageDto> Handle(UpdateGarageCommand r, CancellationToken ct)
    {
        var g = await _db.Garages.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Garage");
        var b = r.Body;
        g.Code = b.Code.Trim(); g.Name = b.Name.Trim(); g.Afm = b.Afm;
        g.Address = b.Address; g.City = b.City; g.PostalCode = b.PostalCode;
        g.Phone = b.Phone; g.Email = b.Email; g.Specialty = b.Specialty;
        g.IsApproved = b.IsApproved; g.Iban = b.Iban; g.IsActive = b.IsActive; g.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        return ListGaragesHandler.Map(g);
    }
}

public record DeleteGarageCommand(Guid Id) : IRequest<Unit>;
public class DeleteGarageHandler : IRequestHandler<DeleteGarageCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteGarageHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteGarageCommand r, CancellationToken ct)
    {
        var g = await _db.Garages.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Garage");
        g.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   GL ACCOUNTS (Λογιστικό σχέδιο) + GL ENTRIES (Άρθρα)
   ========================================================================= */

public record GlAccountDto(Guid Id, string Code, string Name, string Type, string? Category, bool IsActive, int DisplayOrder);
public record GlAccountBody(string Code, string Name, string Type, string? Category, bool IsActive, int DisplayOrder);

public record ListGlAccountsQuery() : IRequest<IReadOnlyList<GlAccountDto>>;
public class ListGlAccountsHandler : IRequestHandler<ListGlAccountsQuery, IReadOnlyList<GlAccountDto>>
{
    private readonly IAppDbContext _db;
    public ListGlAccountsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GlAccountDto>> Handle(ListGlAccountsQuery _, CancellationToken ct)
    {
        var rows = await _db.GlAccounts.OrderBy(x => x.DisplayOrder).ThenBy(x => x.Code).Take(1000).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static GlAccountDto Map(GlAccount a) => new(a.Id, a.Code, a.Name, a.Type, a.Category, a.IsActive, a.DisplayOrder);
}

public record CreateGlAccountCommand(GlAccountBody Body) : IRequest<GlAccountDto>;
public class CreateGlAccountHandler : IRequestHandler<CreateGlAccountCommand, GlAccountDto>
{
    private readonly IAppDbContext _db;
    public CreateGlAccountHandler(IAppDbContext db) => _db = db;
    public async Task<GlAccountDto> Handle(CreateGlAccountCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.GlAccounts.AnyAsync(x => x.Code == b.Code, ct))
            throw new AppException("gl_code_taken",
                "Υπάρχει ήδη λογαριασμός με αυτόν τον κωδικό.", 409,
                title: "Κωδικός σε χρήση",
                why: $"Ο κωδικός «{b.Code}» χρησιμοποιείται ήδη στο λογιστικό σχέδιο.",
                fix: "Επιλέξτε διαφορετικό κωδικό λογαριασμού.",
                fixLink: "/app/gl/accounts");
        var a = new GlAccount
        {
            Id = Guid.NewGuid(), Code = b.Code.Trim(), Name = b.Name.Trim(),
            Type = b.Type, Category = b.Category, IsActive = b.IsActive, DisplayOrder = b.DisplayOrder
        };
        _db.GlAccounts.Add(a);
        await _db.SaveChangesAsync(ct);
        return ListGlAccountsHandler.Map(a);
    }
}

public record UpdateGlAccountCommand(Guid Id, GlAccountBody Body) : IRequest<GlAccountDto>;
public class UpdateGlAccountHandler : IRequestHandler<UpdateGlAccountCommand, GlAccountDto>
{
    private readonly IAppDbContext _db;
    public UpdateGlAccountHandler(IAppDbContext db) => _db = db;
    public async Task<GlAccountDto> Handle(UpdateGlAccountCommand r, CancellationToken ct)
    {
        var a = await _db.GlAccounts.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Account");
        var b = r.Body;
        a.Code = b.Code.Trim(); a.Name = b.Name.Trim(); a.Type = b.Type;
        a.Category = b.Category; a.IsActive = b.IsActive; a.DisplayOrder = b.DisplayOrder;
        await _db.SaveChangesAsync(ct);
        return ListGlAccountsHandler.Map(a);
    }
}

public record DeleteGlAccountCommand(Guid Id) : IRequest<Unit>;
public class DeleteGlAccountHandler : IRequestHandler<DeleteGlAccountCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteGlAccountHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteGlAccountCommand r, CancellationToken ct)
    {
        var inUse = await _db.GlEntries.AnyAsync(x => x.AccountId == r.Id, ct);
        if (inUse) throw new AppException("gl_account_in_use",
            "Δεν διαγράφεται λογαριασμός που έχει άρθρα.", 409,
            title: "Σε χρήση",
            why: "Ο λογαριασμός έχει ήδη κινήσεις στο βιβλίο. Η διαγραφή θα έσπαγε την λογιστική ισορροπία.",
            fix: "Απενεργοποιήστε τον λογαριασμό αντί να τον διαγράψετε.",
            fixLink: "/app/gl/accounts");
        var a = await _db.GlAccounts.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Account");
        a.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record GlEntryDto(
    Guid Id, string EntryNumber, DateOnly EntryDate,
    Guid AccountId, string AccountCode, string AccountName,
    string Description, decimal Debit, decimal Credit, string Currency,
    string? RelatedDocumentRef, Guid? CustomerId, Guid? ProducerId, Guid? PolicyId);

public record GlEntryBody(
    string EntryNumber, DateOnly EntryDate,
    Guid AccountId, string Description, decimal Debit, decimal Credit,
    string Currency, string? RelatedDocumentRef,
    Guid? CustomerId, Guid? ProducerId, Guid? PolicyId);

public record ListGlEntriesQuery(DateOnly? From, DateOnly? To, Guid? AccountId) : IRequest<IReadOnlyList<GlEntryDto>>;
public class ListGlEntriesHandler : IRequestHandler<ListGlEntriesQuery, IReadOnlyList<GlEntryDto>>
{
    private readonly IAppDbContext _db;
    public ListGlEntriesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<GlEntryDto>> Handle(ListGlEntriesQuery r, CancellationToken ct)
    {
        var q = _db.GlEntries.Include(x => x.Account).AsQueryable();
        if (r.From.HasValue) q = q.Where(x => x.EntryDate >= r.From);
        if (r.To.HasValue) q = q.Where(x => x.EntryDate <= r.To);
        if (r.AccountId.HasValue) q = q.Where(x => x.AccountId == r.AccountId);
        var rows = await q.OrderByDescending(x => x.EntryDate).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static GlEntryDto Map(GlEntry e) => new(
        e.Id, e.EntryNumber, e.EntryDate,
        e.AccountId, e.Account?.Code ?? "", e.Account?.Name ?? "",
        e.Description, e.Debit, e.Credit, e.Currency,
        e.RelatedDocumentRef, e.CustomerId, e.ProducerId, e.PolicyId);
}

public record CreateGlEntryCommand(GlEntryBody Body) : IRequest<GlEntryDto>;
public class CreateGlEntryHandler : IRequestHandler<CreateGlEntryCommand, GlEntryDto>
{
    private readonly IAppDbContext _db;
    public CreateGlEntryHandler(IAppDbContext db) => _db = db;
    public async Task<GlEntryDto> Handle(CreateGlEntryCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (b.Debit < 0 || b.Credit < 0)
            throw new AppException("gl_negative",
                "Δεν επιτρέπονται αρνητικά ποσά.", 400,
                title: "Αρνητικό ποσό",
                why: "Στη λογιστική, χρέωση και πίστωση είναι πάντα θετικά. Για αντίστροφη κίνηση αλλάξτε στήλη.",
                fix: "Καταχωρήστε θετικό ποσό στην σωστή στήλη (Debit ή Credit).");

        var entity = new GlEntry
        {
            Id = Guid.NewGuid(),
            EntryNumber = string.IsNullOrWhiteSpace(b.EntryNumber)
                ? $"GL-{DateTime.UtcNow:yyMMddHHmmss}" : b.EntryNumber.Trim(),
            EntryDate = b.EntryDate, AccountId = b.AccountId,
            Description = b.Description.Trim(),
            Debit = b.Debit, Credit = b.Credit,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            RelatedDocumentRef = b.RelatedDocumentRef,
            CustomerId = b.CustomerId, ProducerId = b.ProducerId, PolicyId = b.PolicyId
        };
        _db.GlEntries.Add(entity);
        await _db.SaveChangesAsync(ct);
        entity = await _db.GlEntries.Include(x => x.Account).FirstAsync(x => x.Id == entity.Id, ct);
        return ListGlEntriesHandler.Map(entity);
    }
}

public record DeleteGlEntryCommand(Guid Id) : IRequest<Unit>;
public class DeleteGlEntryHandler : IRequestHandler<DeleteGlEntryCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteGlEntryHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteGlEntryCommand r, CancellationToken ct)
    {
        var e = await _db.GlEntries.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Entry");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record GlSummaryDto(decimal TotalDebit, decimal TotalCredit, decimal Balance,
    IReadOnlyList<GlSummaryRow> ByAccount);
public record GlSummaryRow(string AccountCode, string AccountName, string Type, decimal Debit, decimal Credit, decimal Balance);

public record GetGlSummaryQuery(DateOnly? From, DateOnly? To) : IRequest<GlSummaryDto>;
public class GetGlSummaryHandler : IRequestHandler<GetGlSummaryQuery, GlSummaryDto>
{
    private readonly IAppDbContext _db;
    public GetGlSummaryHandler(IAppDbContext db) => _db = db;
    public async Task<GlSummaryDto> Handle(GetGlSummaryQuery r, CancellationToken ct)
    {
        var q = _db.GlEntries.Include(x => x.Account).AsQueryable();
        if (r.From.HasValue) q = q.Where(x => x.EntryDate >= r.From);
        if (r.To.HasValue) q = q.Where(x => x.EntryDate <= r.To);

        var rows = await q.ToListAsync(ct);
        var totalDebit = rows.Sum(x => x.Debit);
        var totalCredit = rows.Sum(x => x.Credit);
        var byAccount = rows
            .Where(x => x.Account != null)
            .GroupBy(x => new { x.AccountId, x.Account!.Code, x.Account.Name, x.Account.Type })
            .Select(g => new GlSummaryRow(g.Key.Code, g.Key.Name, g.Key.Type,
                g.Sum(x => x.Debit), g.Sum(x => x.Credit), g.Sum(x => x.Debit) - g.Sum(x => x.Credit)))
            .OrderBy(x => x.AccountCode)
            .ToList();

        return new GlSummaryDto(totalDebit, totalCredit, totalDebit - totalCredit, byAccount);
    }
}

/* ============================================================================
   CASH ACCOUNTS + MOVEMENTS (Κατάσταση Ταμείου)
   ========================================================================= */

public record CashAccountDto(Guid Id, string Code, string Name, string Currency, decimal CurrentBalance, bool IsActive, string? Notes);
public record CashAccountBody(string Code, string Name, string Currency, bool IsActive, string? Notes);

public record ListCashAccountsQuery() : IRequest<IReadOnlyList<CashAccountDto>>;
public class ListCashAccountsHandler : IRequestHandler<ListCashAccountsQuery, IReadOnlyList<CashAccountDto>>
{
    private readonly IAppDbContext _db;
    public ListCashAccountsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CashAccountDto>> Handle(ListCashAccountsQuery _, CancellationToken ct)
    {
        var rows = await _db.CashAccounts.OrderBy(x => x.Name).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static CashAccountDto Map(CashAccount c) => new(c.Id, c.Code, c.Name, c.Currency, c.CurrentBalance, c.IsActive, c.Notes);
}

public record CreateCashAccountCommand(CashAccountBody Body) : IRequest<CashAccountDto>;
public class CreateCashAccountHandler : IRequestHandler<CreateCashAccountCommand, CashAccountDto>
{
    private readonly IAppDbContext _db;
    public CreateCashAccountHandler(IAppDbContext db) => _db = db;
    public async Task<CashAccountDto> Handle(CreateCashAccountCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.CashAccounts.AnyAsync(x => x.Code == b.Code, ct))
            throw new AppException("cash_code_taken",
                "Υπάρχει ήδη ταμείο με αυτόν τον κωδικό.", 409,
                title: "Κωδικός σε χρήση",
                why: $"Ο κωδικός «{b.Code}» χρησιμοποιείται.",
                fix: "Επιλέξτε διαφορετικό κωδικό για το νέο ταμείο.",
                fixLink: "/app/cash");
        var c = new CashAccount
        {
            Id = Guid.NewGuid(), Code = b.Code.Trim(), Name = b.Name.Trim(),
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            CurrentBalance = 0, IsActive = b.IsActive, Notes = b.Notes
        };
        _db.CashAccounts.Add(c);
        await _db.SaveChangesAsync(ct);
        return ListCashAccountsHandler.Map(c);
    }
}

public record CashMovementDto(Guid Id, Guid CashAccountId, string CashAccountName,
    DateOnly MovementDate, string Direction, decimal Amount, string Currency,
    string Reason, string? Reference);

public record CashMovementBody(Guid CashAccountId, DateOnly MovementDate, string Direction,
    decimal Amount, string Currency, string Reason, string? Reference);

public record ListCashMovementsQuery(Guid? CashAccountId, DateOnly? From, DateOnly? To) : IRequest<IReadOnlyList<CashMovementDto>>;
public class ListCashMovementsHandler : IRequestHandler<ListCashMovementsQuery, IReadOnlyList<CashMovementDto>>
{
    private readonly IAppDbContext _db;
    public ListCashMovementsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CashMovementDto>> Handle(ListCashMovementsQuery r, CancellationToken ct)
    {
        var q = _db.CashMovements.Include(x => x.CashAccount).AsQueryable();
        if (r.CashAccountId.HasValue) q = q.Where(x => x.CashAccountId == r.CashAccountId);
        if (r.From.HasValue) q = q.Where(x => x.MovementDate >= r.From);
        if (r.To.HasValue) q = q.Where(x => x.MovementDate <= r.To);
        var rows = await q.OrderByDescending(x => x.MovementDate).Take(500).ToListAsync(ct);
        return rows.Select(m => new CashMovementDto(
            m.Id, m.CashAccountId, m.CashAccount?.Name ?? "",
            m.MovementDate, m.Direction, m.Amount, m.Currency,
            m.Reason, m.Reference)).ToList();
    }
}

public record CreateCashMovementCommand(CashMovementBody Body) : IRequest<CashMovementDto>;
public class CreateCashMovementHandler : IRequestHandler<CreateCashMovementCommand, CashMovementDto>
{
    private readonly IAppDbContext _db;
    public CreateCashMovementHandler(IAppDbContext db) => _db = db;
    public async Task<CashMovementDto> Handle(CreateCashMovementCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var account = await _db.CashAccounts.FirstOrDefaultAsync(x => x.Id == b.CashAccountId, ct)
            ?? throw AppException.NotFound("CashAccount");

        var m = new CashMovement
        {
            Id = Guid.NewGuid(), CashAccountId = b.CashAccountId,
            MovementDate = b.MovementDate, Direction = b.Direction,
            Amount = b.Amount, Currency = string.IsNullOrWhiteSpace(b.Currency) ? account.Currency : b.Currency.ToUpperInvariant(),
            Reason = b.Reason, Reference = b.Reference
        };
        _db.CashMovements.Add(m);

        var sign = b.Direction == "In" ? 1m : -1m;
        account.CurrentBalance += sign * b.Amount;

        await _db.SaveChangesAsync(ct);
        return new CashMovementDto(m.Id, m.CashAccountId, account.Name,
            m.MovementDate, m.Direction, m.Amount, m.Currency, m.Reason, m.Reference);
    }
}

/* ============================================================================
   NAME DAYS (Εορτολόγιο)
   ========================================================================= */

public record NameDayDto(Guid Id, string Name, int Month, int Day, string? Notes, bool IsActive);
public record NameDayBody(string Name, int Month, int Day, string? Notes, bool IsActive);

public record ListNameDaysQuery(int? Month) : IRequest<IReadOnlyList<NameDayDto>>;
public class ListNameDaysHandler : IRequestHandler<ListNameDaysQuery, IReadOnlyList<NameDayDto>>
{
    private readonly IAppDbContext _db;
    public ListNameDaysHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<NameDayDto>> Handle(ListNameDaysQuery r, CancellationToken ct)
    {
        var q = _db.NameDays.AsQueryable();
        if (r.Month.HasValue) q = q.Where(x => x.Month == r.Month);
        var rows = await q.OrderBy(x => x.Month).ThenBy(x => x.Day).ThenBy(x => x.Name).Take(1000).ToListAsync(ct);
        return rows.Select(n => new NameDayDto(n.Id, n.Name, n.Month, n.Day, n.Notes, n.IsActive)).ToList();
    }
}

public record TodaysCelebratingCustomersDto(Guid CustomerId, string CustomerName, string CustomerNumber,
    string? Phone, string? Email, string NameDay);

public record GetTodaysCelebrantsQuery(int? Day, int? Month) : IRequest<IReadOnlyList<TodaysCelebratingCustomersDto>>;
public class GetTodaysCelebrantsHandler : IRequestHandler<GetTodaysCelebrantsQuery, IReadOnlyList<TodaysCelebratingCustomersDto>>
{
    private readonly IAppDbContext _db;
    public GetTodaysCelebrantsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<TodaysCelebratingCustomersDto>> Handle(GetTodaysCelebrantsQuery r, CancellationToken ct)
    {
        var today = DateTime.Today;
        var day = r.Day ?? today.Day;
        var month = r.Month ?? today.Month;

        var nameDays = await _db.NameDays
            .Where(x => x.Day == day && x.Month == month && x.IsActive)
            .ToListAsync(ct);
        var names = nameDays.Select(n => n.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var customers = await _db.Customers
            .Where(c => c.FirstName != null && c.DeletedAt == null)
            .ToListAsync(ct);

        return customers
            .Where(c => names.Any(n => string.Equals(n, c.FirstName, StringComparison.OrdinalIgnoreCase)))
            .Select(c => new TodaysCelebratingCustomersDto(
                c.Id,
                c.CompanyName ?? $"{c.FirstName} {c.LastName}".Trim(),
                c.CustomerNumber,
                c.MobilePhone ?? c.Phone, c.Email,
                c.FirstName ?? ""))
            .ToList();
    }
}

public record CreateNameDayCommand(NameDayBody Body) : IRequest<NameDayDto>;
public class CreateNameDayHandler : IRequestHandler<CreateNameDayCommand, NameDayDto>
{
    private readonly IAppDbContext _db;
    public CreateNameDayHandler(IAppDbContext db) => _db = db;
    public async Task<NameDayDto> Handle(CreateNameDayCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var entity = new NameDay
        {
            Id = Guid.NewGuid(),
            Name = b.Name.Trim(), Month = b.Month, Day = b.Day,
            Notes = b.Notes, IsActive = b.IsActive
        };
        _db.NameDays.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new NameDayDto(entity.Id, entity.Name, entity.Month, entity.Day, entity.Notes, entity.IsActive);
    }
}

public record DeleteNameDayCommand(Guid Id) : IRequest<Unit>;
public class DeleteNameDayHandler : IRequestHandler<DeleteNameDayCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteNameDayHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteNameDayCommand r, CancellationToken ct)
    {
        var e = await _db.NameDays.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("NameDay");
        e.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   MYDATA SUBMISSIONS (Διαβιβάσεις ΑΑΔΕ)
   ========================================================================= */

public record MyDataSubmissionDto(
    Guid Id, string SubmissionNumber, string TransmissionKind,
    DateOnly PeriodFrom, DateOnly PeriodTo, DateTime SubmittedAt,
    string Status, int InvoiceCount, decimal TotalAmount, string Currency,
    string? AadeMark, string? AadeUid, string? ErrorMessage, string? Notes);

public record MyDataSubmissionBody(
    string TransmissionKind, DateOnly PeriodFrom, DateOnly PeriodTo,
    int InvoiceCount, decimal TotalAmount, string Currency, string? Notes);

public record ListMyDataSubmissionsQuery() : IRequest<IReadOnlyList<MyDataSubmissionDto>>;
public class ListMyDataSubmissionsHandler : IRequestHandler<ListMyDataSubmissionsQuery, IReadOnlyList<MyDataSubmissionDto>>
{
    private readonly IAppDbContext _db;
    public ListMyDataSubmissionsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<MyDataSubmissionDto>> Handle(ListMyDataSubmissionsQuery _, CancellationToken ct)
    {
        var rows = await _db.MyDataSubmissions.OrderByDescending(x => x.SubmittedAt).Take(500).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static MyDataSubmissionDto Map(MyDataSubmission s) => new(
        s.Id, s.SubmissionNumber, s.TransmissionKind,
        s.PeriodFrom, s.PeriodTo, s.SubmittedAt,
        s.Status, s.InvoiceCount, s.TotalAmount, s.Currency,
        s.AadeMark, s.AadeUid, s.ErrorMessage, s.Notes);
}

public record CreateMyDataSubmissionCommand(MyDataSubmissionBody Body) : IRequest<MyDataSubmissionDto>;
public class CreateMyDataSubmissionHandler : IRequestHandler<CreateMyDataSubmissionCommand, MyDataSubmissionDto>
{
    private readonly IAppDbContext _db;
    public CreateMyDataSubmissionHandler(IAppDbContext db) => _db = db;
    public async Task<MyDataSubmissionDto> Handle(CreateMyDataSubmissionCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var nextSeq = await _db.MyDataSubmissions.CountAsync(ct) + 1;
        var entity = new MyDataSubmission
        {
            Id = Guid.NewGuid(),
            SubmissionNumber = $"MD-{DateTime.UtcNow:yyyy}-{nextSeq:D5}",
            TransmissionKind = b.TransmissionKind,
            PeriodFrom = b.PeriodFrom, PeriodTo = b.PeriodTo,
            SubmittedAt = DateTime.UtcNow,
            Status = "Pending",
            InvoiceCount = b.InvoiceCount,
            TotalAmount = b.TotalAmount,
            Currency = string.IsNullOrWhiteSpace(b.Currency) ? "EUR" : b.Currency.ToUpperInvariant(),
            Notes = b.Notes
        };
        _db.MyDataSubmissions.Add(entity);
        await _db.SaveChangesAsync(ct);
        return ListMyDataSubmissionsHandler.Map(entity);
    }
}

public record MarkMyDataSubmissionCommand(Guid Id, string Status, string? AadeMark, string? AadeUid, string? ErrorMessage) : IRequest<MyDataSubmissionDto>;
public class MarkMyDataSubmissionHandler : IRequestHandler<MarkMyDataSubmissionCommand, MyDataSubmissionDto>
{
    private readonly IAppDbContext _db;
    public MarkMyDataSubmissionHandler(IAppDbContext db) => _db = db;
    public async Task<MyDataSubmissionDto> Handle(MarkMyDataSubmissionCommand r, CancellationToken ct)
    {
        var e = await _db.MyDataSubmissions.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Submission");
        e.Status = r.Status;
        e.AadeMark = r.AadeMark;
        e.AadeUid = r.AadeUid;
        e.ErrorMessage = r.ErrorMessage;
        await _db.SaveChangesAsync(ct);
        return ListMyDataSubmissionsHandler.Map(e);
    }
}

/* ============================================================================
   DOCUMENT TEMPLATES + NUMBERING RULES
   ========================================================================= */

public record DocumentTemplateDto(
    Guid Id, string Code, string Name, string Kind, string PageSize, string Orientation,
    string? HeaderHtml, string? BodyHtml, string? FooterHtml, bool IsDefault, bool IsActive);

public record DocumentTemplateBody(
    string Code, string Name, string Kind, string PageSize, string Orientation,
    string? HeaderHtml, string? BodyHtml, string? FooterHtml, bool IsDefault, bool IsActive);

public record ListDocumentTemplatesQuery(string? Kind) : IRequest<IReadOnlyList<DocumentTemplateDto>>;
public class ListDocumentTemplatesHandler : IRequestHandler<ListDocumentTemplatesQuery, IReadOnlyList<DocumentTemplateDto>>
{
    private readonly IAppDbContext _db;
    public ListDocumentTemplatesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DocumentTemplateDto>> Handle(ListDocumentTemplatesQuery r, CancellationToken ct)
    {
        var q = _db.DocumentTemplates.AsQueryable();
        if (!string.IsNullOrEmpty(r.Kind)) q = q.Where(x => x.Kind == r.Kind);
        var rows = await q.OrderBy(x => x.Kind).ThenBy(x => x.Name).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static DocumentTemplateDto Map(DocumentTemplate t) => new(
        t.Id, t.Code, t.Name, t.Kind, t.PageSize, t.Orientation,
        t.HeaderHtml, t.BodyHtml, t.FooterHtml, t.IsDefault, t.IsActive);
}

public record SaveDocumentTemplateCommand(Guid? Id, DocumentTemplateBody Body) : IRequest<DocumentTemplateDto>;
public class SaveDocumentTemplateHandler : IRequestHandler<SaveDocumentTemplateCommand, DocumentTemplateDto>
{
    private readonly IAppDbContext _db;
    public SaveDocumentTemplateHandler(IAppDbContext db) => _db = db;
    public async Task<DocumentTemplateDto> Handle(SaveDocumentTemplateCommand r, CancellationToken ct)
    {
        var b = r.Body;
        DocumentTemplate t;
        if (r.Id.HasValue)
        {
            t = await _db.DocumentTemplates.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
                ?? throw AppException.NotFound("Template");
        }
        else
        {
            if (await _db.DocumentTemplates.AnyAsync(x => x.Code == b.Code, ct))
                throw new AppException("doc_template_code_taken",
                    "Υπάρχει ήδη πρότυπο με αυτόν τον κωδικό.", 409,
                    title: "Κωδικός σε χρήση",
                    why: $"Ο κωδικός «{b.Code}» χρησιμοποιείται από άλλο πρότυπο.",
                    fix: "Επιλέξτε διαφορετικό κωδικό.",
                    fixLink: "/app/document-templates");
            t = new DocumentTemplate { Id = Guid.NewGuid() };
            _db.DocumentTemplates.Add(t);
        }
        t.Code = b.Code.Trim(); t.Name = b.Name.Trim(); t.Kind = b.Kind;
        t.PageSize = b.PageSize; t.Orientation = b.Orientation;
        t.HeaderHtml = b.HeaderHtml; t.BodyHtml = b.BodyHtml; t.FooterHtml = b.FooterHtml;
        t.IsDefault = b.IsDefault; t.IsActive = b.IsActive;

        if (b.IsDefault)
        {
            // Unset other defaults for the same kind
            var others = await _db.DocumentTemplates
                .Where(x => x.Kind == b.Kind && x.Id != t.Id && x.IsDefault)
                .ToListAsync(ct);
            foreach (var o in others) o.IsDefault = false;
        }

        await _db.SaveChangesAsync(ct);
        return ListDocumentTemplatesHandler.Map(t);
    }
}

public record DeleteDocumentTemplateCommand(Guid Id) : IRequest<Unit>;
public class DeleteDocumentTemplateHandler : IRequestHandler<DeleteDocumentTemplateCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteDocumentTemplateHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteDocumentTemplateCommand r, CancellationToken ct)
    {
        var t = await _db.DocumentTemplates.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Template");
        t.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record DocumentNumberingRuleDto(
    Guid Id, string DocumentKind, string Prefix, string Suffix, int Padding,
    int NextNumber, int? ResetYear, bool IsActive);

public record DocumentNumberingRuleBody(
    string DocumentKind, string Prefix, string Suffix, int Padding,
    int NextNumber, int? ResetYear, bool IsActive);

public record ListDocumentNumberingRulesQuery() : IRequest<IReadOnlyList<DocumentNumberingRuleDto>>;
public class ListDocumentNumberingRulesHandler : IRequestHandler<ListDocumentNumberingRulesQuery, IReadOnlyList<DocumentNumberingRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListDocumentNumberingRulesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<DocumentNumberingRuleDto>> Handle(ListDocumentNumberingRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.DocumentNumberingRules.OrderBy(x => x.DocumentKind).ToListAsync(ct);
        return rows.Select(n => new DocumentNumberingRuleDto(
            n.Id, n.DocumentKind, n.Prefix, n.Suffix, n.Padding,
            n.NextNumber, n.ResetYear, n.IsActive)).ToList();
    }
}

public record SaveDocumentNumberingRuleCommand(Guid? Id, DocumentNumberingRuleBody Body) : IRequest<DocumentNumberingRuleDto>;
public class SaveDocumentNumberingRuleHandler : IRequestHandler<SaveDocumentNumberingRuleCommand, DocumentNumberingRuleDto>
{
    private readonly IAppDbContext _db;
    public SaveDocumentNumberingRuleHandler(IAppDbContext db) => _db = db;
    public async Task<DocumentNumberingRuleDto> Handle(SaveDocumentNumberingRuleCommand r, CancellationToken ct)
    {
        var b = r.Body;
        DocumentNumberingRule rule;
        if (r.Id.HasValue)
        {
            rule = await _db.DocumentNumberingRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
                ?? throw AppException.NotFound("Rule");
        }
        else
        {
            if (await _db.DocumentNumberingRules.AnyAsync(x => x.DocumentKind == b.DocumentKind, ct))
                throw new AppException("numbering_rule_exists",
                    $"Υπάρχει ήδη κανόνας για «{b.DocumentKind}».", 409,
                    title: "Κανόνας υπάρχει",
                    why: "Κάθε τύπος εγγράφου μπορεί να έχει έναν μόνο ενεργό κανόνα αρίθμησης.",
                    fix: "Επεξεργαστείτε τον υπάρχοντα κανόνα αντί να δημιουργήσετε νέο.",
                    fixLink: "/app/numbering");
            rule = new DocumentNumberingRule { Id = Guid.NewGuid() };
            _db.DocumentNumberingRules.Add(rule);
        }
        rule.DocumentKind = b.DocumentKind; rule.Prefix = b.Prefix; rule.Suffix = b.Suffix;
        rule.Padding = b.Padding; rule.NextNumber = b.NextNumber;
        rule.ResetYear = b.ResetYear; rule.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return new DocumentNumberingRuleDto(rule.Id, rule.DocumentKind, rule.Prefix, rule.Suffix,
            rule.Padding, rule.NextNumber, rule.ResetYear, rule.IsActive);
    }
}

public record DeleteDocumentNumberingRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteDocumentNumberingRuleHandler : IRequestHandler<DeleteDocumentNumberingRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteDocumentNumberingRuleHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteDocumentNumberingRuleCommand r, CancellationToken ct)
    {
        var rule = await _db.DocumentNumberingRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Rule");
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
