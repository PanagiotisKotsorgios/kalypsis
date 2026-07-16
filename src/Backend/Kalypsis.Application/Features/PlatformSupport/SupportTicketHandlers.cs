using FluentValidation;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.PlatformSupport;

public record SupportReplyDto(
    Guid Id, DateTime At, string Author, string Body, bool NotifiedTenant);

public record SupportTicketDto(
    Guid Id, Guid TenantId, string TenantName, string TenantCode,
    string Subject, string Body,
    string Priority, string Status, string Channel,
    string? Assignee,
    DateTime OpenedAt, DateTime? ResolvedAt,
    IReadOnlyList<SupportReplyDto> Replies);

/* ============================ Ticket CRUD ============================ */

public record ListTicketsQuery(string? Status, string? Priority) : IRequest<IReadOnlyList<SupportTicketDto>>;
public class ListTicketsHandler : IRequestHandler<ListTicketsQuery, IReadOnlyList<SupportTicketDto>>
{
    private readonly IAppDbContext _db;
    public ListTicketsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SupportTicketDto>> Handle(ListTicketsQuery r, CancellationToken ct)
    {
        var q = _db.SupportTickets.Where(t => t.DeletedAt == null);
        if (!string.IsNullOrEmpty(r.Status)) q = q.Where(t => t.Status == r.Status);
        if (!string.IsNullOrEmpty(r.Priority)) q = q.Where(t => t.Priority == r.Priority);
        var rows = await q.OrderByDescending(t => t.OpenedAt).ToListAsync(ct);

        var ids = rows.Select(t => t.Id).ToList();
        var replies = await _db.SupportTicketReplies
            .Where(r => ids.Contains(r.SupportTicketId) && r.DeletedAt == null)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(t => new SupportTicketDto(
            t.Id, t.TenantId, t.TenantName, t.TenantCode,
            t.Subject, t.Body, t.Priority, t.Status, t.Channel, t.Assignee,
            t.OpenedAt, t.ResolvedAt,
            replies.Where(r => r.SupportTicketId == t.Id)
                   .Select(r => new SupportReplyDto(r.Id, r.CreatedAt, r.Author, r.Body, r.NotifiedTenant))
                   .ToList()
        )).ToList();
    }
}

public record CreateTicketCommand(
    Guid TenantId, string Subject, string Body,
    string Priority, string Channel, string? Assignee) : IRequest<SupportTicketDto>;

public class CreateTicketValidator : AbstractValidator<CreateTicketCommand>
{
    public CreateTicketValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(400);
        RuleFor(x => x.Body).NotEmpty();
        RuleFor(x => x.Priority).Must(p => p is "High" or "Normal" or "Low");
        RuleFor(x => x.Channel).Must(c => c is "Email" or "Internal" or "Phone");
    }
}

public class CreateTicketHandler : IRequestHandler<CreateTicketCommand, SupportTicketDto>
{
    private readonly IAppDbContext _db;
    public CreateTicketHandler(IAppDbContext db) => _db = db;
    public async Task<SupportTicketDto> Handle(CreateTicketCommand r, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == r.TenantId && t.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        var t = new SupportTicket
        {
            TenantId = r.TenantId,
            TenantName = tenant.Name,
            TenantCode = tenant.Code,
            Subject = r.Subject.Trim(),
            Body = r.Body.Trim(),
            Priority = r.Priority,
            Channel = r.Channel,
            Assignee = string.IsNullOrWhiteSpace(r.Assignee) ? null : r.Assignee.Trim(),
            OpenedAt = DateTime.UtcNow,
            Status = "Open"
        };
        _db.SupportTickets.Add(t);
        await _db.SaveChangesAsync(ct);
        return new SupportTicketDto(t.Id, t.TenantId, t.TenantName, t.TenantCode,
            t.Subject, t.Body, t.Priority, t.Status, t.Channel, t.Assignee,
            t.OpenedAt, t.ResolvedAt, new List<SupportReplyDto>());
    }
}

public record UpdateTicketCommand(
    Guid Id, string? Status, string? Priority, string? Assignee) : IRequest<SupportTicketDto>;

public class UpdateTicketHandler : IRequestHandler<UpdateTicketCommand, SupportTicketDto>
{
    private readonly IAppDbContext _db;
    public UpdateTicketHandler(IAppDbContext db) => _db = db;
    public async Task<SupportTicketDto> Handle(UpdateTicketCommand r, CancellationToken ct)
    {
        var t = await _db.SupportTickets.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("SupportTicket");
        if (!string.IsNullOrEmpty(r.Status))
        {
            t.Status = r.Status;
            // ResolvedAt tracks the transition to Resolved. Clearing it on
            // re-open matters so downstream reports see the correct "still
            // open" state.
            if (r.Status == "Resolved" && t.ResolvedAt == null) t.ResolvedAt = DateTime.UtcNow;
            else if (r.Status != "Resolved") t.ResolvedAt = null;
        }
        if (!string.IsNullOrEmpty(r.Priority)) t.Priority = r.Priority;
        if (r.Assignee != null) t.Assignee = string.IsNullOrWhiteSpace(r.Assignee) ? null : r.Assignee.Trim();
        await _db.SaveChangesAsync(ct);
        return await BuildDtoAsync(_db, t, ct);
    }

    internal static async Task<SupportTicketDto> BuildDtoAsync(IAppDbContext db, SupportTicket t, CancellationToken ct)
    {
        var replies = await db.SupportTicketReplies
            .Where(r => r.SupportTicketId == t.Id && r.DeletedAt == null)
            .OrderBy(r => r.CreatedAt)
            .Select(r => new SupportReplyDto(r.Id, r.CreatedAt, r.Author, r.Body, r.NotifiedTenant))
            .ToListAsync(ct);
        return new SupportTicketDto(t.Id, t.TenantId, t.TenantName, t.TenantCode,
            t.Subject, t.Body, t.Priority, t.Status, t.Channel, t.Assignee,
            t.OpenedAt, t.ResolvedAt, replies);
    }
}

public record DeleteTicketCommand(Guid Id) : IRequest;
public class DeleteTicketHandler : IRequestHandler<DeleteTicketCommand>
{
    private readonly IAppDbContext _db;
    public DeleteTicketHandler(IAppDbContext db) => _db = db;
    public async Task Handle(DeleteTicketCommand r, CancellationToken ct)
    {
        var t = await _db.SupportTickets.FirstOrDefaultAsync(x => x.Id == r.Id && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("SupportTicket");
        t.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}

/* ============================ Replies + Notify ============================ */

public record AddReplyCommand(Guid TicketId, string Author, string Body) : IRequest<SupportTicketDto>;
public class AddReplyHandler : IRequestHandler<AddReplyCommand, SupportTicketDto>
{
    private readonly IAppDbContext _db;
    public AddReplyHandler(IAppDbContext db) => _db = db;
    public async Task<SupportTicketDto> Handle(AddReplyCommand r, CancellationToken ct)
    {
        var t = await _db.SupportTickets.FirstOrDefaultAsync(x => x.Id == r.TicketId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("SupportTicket");
        _db.SupportTicketReplies.Add(new SupportTicketReply
        {
            SupportTicketId = t.Id,
            Author = r.Author.Trim(),
            Body = r.Body.Trim(),
            NotifiedTenant = false
        });
        // Auto-transition Open → InProgress on the first internal reply — Open
        // means "we haven't looked at it yet"; once we've written back, that
        // stops being true.
        if (t.Status == "Open") t.Status = "InProgress";
        await _db.SaveChangesAsync(ct);
        return await UpdateTicketHandler.BuildDtoAsync(_db, t, ct);
    }
}

public record NotifyTenantCommand(Guid TicketId, string Subject, string Body) : IRequest<SupportTicketDto>;
public class NotifyTenantHandler : IRequestHandler<NotifyTenantCommand, SupportTicketDto>
{
    private readonly IAppDbContext _db;
    private readonly IEmailSender _email;
    private readonly ICurrentUser _current;
    public NotifyTenantHandler(IAppDbContext db, IEmailSender email, ICurrentUser current)
    { _db = db; _email = email; _current = current; }

    public async Task<SupportTicketDto> Handle(NotifyTenantCommand r, CancellationToken ct)
    {
        var t = await _db.SupportTickets.FirstOrDefaultAsync(x => x.Id == r.TicketId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("SupportTicket");

        // Recipient candidates: all AgencyAdmins of the ticket's tenant.
        // We don't gate on IsConfiguredAsync here — the Reply row records the
        // intent even if Brevo isn't set up locally, so a dev environment
        // still sees the notification history.
        var admins = await _db.Users
            .Where(u => u.TenantId == t.TenantId && u.Role == Domain.Enums.Role.AgencyAdmin && u.DeletedAt == null)
            .Select(u => new { u.Email, Name = (u.FirstName + " " + u.LastName).Trim() })
            .ToListAsync(ct);

        var htmlBody = $"<p>{System.Net.WebUtility.HtmlEncode(r.Body).Replace("\n", "<br/>")}</p>" +
                       $"<hr/><p style='color:#666;font-size:12px'>Ticket #{t.Id.ToString()[..8]} — Kalypsis Support</p>";
        var deliveryLog = new System.Text.StringBuilder();
        foreach (var a in admins)
        {
            var result = await _email.SendAsync(new EmailMessage(a.Email, a.Name, r.Subject, htmlBody), ct);
            deliveryLog.AppendLine(result.Success
                ? $"OK → {a.Email}"
                : $"FAIL → {a.Email}: {result.ErrorMessage}");
        }

        var authorLabel = string.IsNullOrEmpty(_current.Email) ? "SuperAdmin" : _current.Email;
        _db.SupportTicketReplies.Add(new SupportTicketReply
        {
            SupportTicketId = t.Id,
            Author = authorLabel + " → πελάτης",
            Body = $"[EMAIL SENT]\nΘέμα: {r.Subject}\n\n{r.Body}\n\n---\n{deliveryLog}",
            NotifiedTenant = true
        });
        if (t.Status == "Open") t.Status = "InProgress";
        await _db.SaveChangesAsync(ct);

        return await UpdateTicketHandler.BuildDtoAsync(_db, t, ct);
    }
}
