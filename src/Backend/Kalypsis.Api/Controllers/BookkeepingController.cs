using System.Text.Json;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Ermes;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Μηχανογράφιση («bookkeeping as a service») — endpoints that let
/// the Platform team run the day-to-day data entry for small offices
/// that opted in.
///
/// TWO SURFACES:
///   /api/bookkeeping/*                          — tenant self-service
///   /api/platform/bookkeeping/tenants/{id}/*    — platform admin
///
/// Tenant isolation: tenant-surface endpoints run under the normal
/// tenant filter; platform-surface endpoints use IgnoreQueryFilters()
/// on the specific tenant id passed in the URL. Cross-tenant access
/// requires PlatformAdmin AND the tenant id in the URL — no route
/// returns "the whole world" for a non-platform caller.
/// </summary>
[ApiController]
public class BookkeepingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;
    private readonly IMediator _mediator;
    private readonly ILogger<BookkeepingController> _logger;

    public BookkeepingController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock,
        IMediator mediator, ILogger<BookkeepingController> logger)
    { _db = db; _current = current; _clock = clock; _mediator = mediator; _logger = logger; }

    // ── Acceptable-Use Policy version ────────────────────────────
    // Bumping this constant invalidates every tenant's prior acceptance
    // — legal can push a new AUP without a data migration; the client's
    // next upload attempt gets HTTP 428 and the acceptance dialog
    // reopens. NEVER bump silently — always coordinate with a UX-side
    // copy update.
    public const string CurrentTermsVersion = "2026-08-26.v1";

    // ── DTOs shared across both surfaces ────────────────────────────
    public record ProgramDto(bool Enabled, string Mode, string? ContactRequestNote,
        bool Onboarded, DateTime? OnboardedAt, DateTime? CreatedAt,
        DateTime? TermsAcceptedAt, string? TermsAcceptedVersion, string CurrentTermsVersion);
    public record FolderDto(Guid Id, Guid? ParentFolderId, string Name, string Origin,
        int DisplayOrder, DateTime CreatedAt, int FileCount);
    public record FileDto(Guid Id, Guid FolderId, string FileName, string MimeType,
        long SizeBytes, string UploadedBy, string? Notes, string Status,
        DateTime CreatedAt, string? UploadedByDisplay);
    public record NoteDto(Guid Id, Guid? FolderId, Guid? FileId,
        Guid AuthorUserId, string AuthorDisplay, string AuthorRole,
        string Body, DateTime CreatedAt);
    public record ActivityDto(Guid Id, string Kind, string Title, string? Body,
        Guid AuthorUserId, string AuthorDisplay, string? Category,
        bool AutoNotified, DateTime CreatedAt);
    public record CredentialDto(Guid Id, string CarrierName, string PortalUrl,
        string? Notes, bool Active, DateTime? LastVerifiedAt, DateTime CreatedAt);
    public record TenantOverviewDto(Guid TenantId, string TenantName, string Mode,
        bool Onboarded, DateTime? OnboardedAt, int FolderCount, int FileCount,
        int PendingFiles, DateTime? LastActivityAt);

    public record TogglePlanBody(bool Enabled, string? Mode, string? ContactRequestNote);
    public record CreateFolderBody(Guid? ParentFolderId, string Name, int DisplayOrder = 0);
    public record RenameFolderBody(string Name, int DisplayOrder = 0);
    public record UpdateFileBody(string? Notes, string? Status);
    public record CreateNoteBody(Guid? FolderId, Guid? FileId, string Body);
    public record CreateActivityBody(string Kind, string Title, string? Body,
        string? Category, bool AutoNotify);
    public record UpsertCredentialBody(string CarrierName, string PortalUrl,
        string Username, string Password, string? Notes);
    public record MoveFolderBody(Guid? NewParentFolderId, int? NewDisplayOrder);
    public record MoveFilesBody(IReadOnlyList<Guid> FileIds, Guid TargetFolderId);
    public record BulkFilesBody(IReadOnlyList<Guid> FileIds);
    public record BulkStatusBody(IReadOnlyList<Guid> FileIds, string Status);

    // ═══════════════════════════════════════════════════════════════
    // TENANT SELF-SERVICE
    // ═══════════════════════════════════════════════════════════════

    /// <summary>Read this tenant's μηχανογράφιση opt-in state. Returns
    /// a default disabled record when nothing exists yet — no 404 to
    /// keep the frontend logic simple.</summary>
    [HttpGet("/api/bookkeeping/program")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<ProgramDto>> MyProgram(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.BookkeepingPrograms.AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (row is null) return Ok(new ProgramDto(false, "files", null, false, null, null,
            TermsAcceptedAt: null, TermsAcceptedVersion: null, CurrentTermsVersion: CurrentTermsVersion));
        return Ok(new ProgramDto(row.Enabled, row.Mode, row.ContactRequestNote,
            row.Onboarded, row.OnboardedAt, row.CreatedAt,
            row.TermsAcceptedAt, row.TermsAcceptedVersion, CurrentTermsVersion));
    }

    /// <summary>Turn μηχανογράφιση on/off + optionally leave a contact-
    /// request note («Θέλω πληροφορίες για το πώς παραδίδουμε τα
    /// αρχεία»). Kept upsert-style — the tenant may flip the switch
    /// multiple times.</summary>
    [HttpPut("/api/bookkeeping/program")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ProgramDto>> ToggleProgram([FromBody] TogglePlanBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var row = await _db.BookkeepingPrograms
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (row is null)
        {
            row = new BookkeepingProgram
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CreatedAt = _clock.UtcNow,
            };
            _db.BookkeepingPrograms.Add(row);
        }
        row.DeletedAt = null;
        row.Enabled = body.Enabled;
        if (!string.IsNullOrWhiteSpace(body.Mode)) row.Mode = body.Mode!;
        row.ContactRequestNote = body.ContactRequestNote;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProgramDto(row.Enabled, row.Mode, row.ContactRequestNote,
            row.Onboarded, row.OnboardedAt, row.CreatedAt,
            row.TermsAcceptedAt, row.TermsAcceptedVersion, CurrentTermsVersion));
    }

    /// <summary>Records the tenant's acceptance of the current Acceptable
    /// Use Policy version. Required before any file upload — see
    /// RequireTermsAsync. Any AgencyAdmin can accept on behalf of the
    /// tenant; we log the user id for audit.</summary>
    [HttpPost("/api/bookkeeping/program/accept-terms")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<ProgramDto>> AcceptTerms([FromBody] AcceptTermsBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        if (body?.Version != CurrentTermsVersion)
            throw new AppException("terms_version_mismatch",
                "Ο κωδικός έκδοσης δεν ταιριάζει με το τρέχον AUP — ανανεώστε τη σελίδα.", 400);
        var row = await _db.BookkeepingPrograms
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct);
        if (row is null)
        {
            row = new BookkeepingProgram
            {
                Id = Guid.NewGuid(), TenantId = tenantId,
                Enabled = false, CreatedAt = _clock.UtcNow,
            };
            _db.BookkeepingPrograms.Add(row);
        }
        row.TermsAcceptedAt = _clock.UtcNow;
        row.TermsAcceptedByUserId = userId;
        row.TermsAcceptedVersion = CurrentTermsVersion;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProgramDto(row.Enabled, row.Mode, row.ContactRequestNote,
            row.Onboarded, row.OnboardedAt, row.CreatedAt,
            row.TermsAcceptedAt, row.TermsAcceptedVersion, CurrentTermsVersion));
    }

    public record AcceptTermsBody(string Version);

    /// <summary>List folders + files for the caller's tenant. Sorted
    /// depth-first by DisplayOrder so the frontend can render a tree
    /// without another round trip.</summary>
    [HttpGet("/api/bookkeeping/tree")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<object>> MyTree(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        return Ok(await LoadTree(tenantId, ct));
    }

    // ── Tenant-side folder management ────────────────────────────────
    // Mirror of AdminCreateFolder / AdminRenameFolder / AdminDeleteFolder
    // but scoped to the caller's tenant. Enables tenants to organise their
    // own material — create subfolders, rename, remove empty folders —
    // without asking Kalypsis Ops to touch anything. AgencyAdmin only for
    // write actions: staff-level users can browse + upload but not
    // restructure the tree.

    /// <summary>Create a folder in the caller's tenant. Optionally nested
    /// under <see cref="CreateFolderBody.ParentFolderId"/>. The parent
    /// MUST belong to the same tenant — server double-checks to prevent
    /// folder-id spoofing across tenants.</summary>
    [HttpPost("/api/bookkeeping/folders")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<FolderDto>> CreateOwnFolder(
        [FromBody] CreateFolderBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Όνομα φακέλου κενό.");
        if (body.Name.Trim().Length > 200) throw AppException.Validation("Όνομα φακέλου πολύ μεγάλο (max 200).");
        if (body.ParentFolderId is Guid pid)
        {
            var parentOk = await _db.BookkeepingFolders
                .AnyAsync(x => x.Id == pid && x.TenantId == tenantId && x.DeletedAt == null, ct);
            if (!parentOk) throw AppException.NotFound("Parent folder");
        }
        var f = new BookkeepingFolder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ParentFolderId = body.ParentFolderId,
            Name = body.Name.Trim(),
            Origin = "custom",
            DisplayOrder = body.DisplayOrder,
            CreatedAt = _clock.UtcNow,
        };
        _db.BookkeepingFolders.Add(f);
        await _db.SaveChangesAsync(ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, 0));
    }

    [HttpPut("/api/bookkeeping/folders/{folderId:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<FolderDto>> RenameOwnFolder(Guid folderId,
        [FromBody] RenameFolderBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var f = await _db.BookkeepingFolders
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Όνομα κενό.");
        f.Name = body.Name.Trim();
        f.DisplayOrder = body.DisplayOrder;
        await _db.SaveChangesAsync(ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, 0));
    }

    /// <summary>Soft-delete a tenant-owned folder. REFUSES if the folder
    /// still contains files or child folders — the tenant must clear
    /// them first, no cascade. Prevents accidental mass-delete via a
    /// mis-clicked «X» on a root folder.</summary>
    [HttpDelete("/api/bookkeeping/folders/{folderId:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<IActionResult> DeleteOwnFolder(Guid folderId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var f = await _db.BookkeepingFolders
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        var hasChildren = await _db.BookkeepingFolders
            .AnyAsync(x => x.ParentFolderId == folderId && x.DeletedAt == null, ct);
        if (hasChildren) throw new AppException("folder_has_children",
            "Ο φάκελος περιέχει υποφακέλους. Διαγράψτε τους πρώτα.", 409);
        var hasFiles = await _db.BookkeepingFiles
            .AnyAsync(x => x.FolderId == folderId && x.DeletedAt == null, ct);
        if (hasFiles) throw new AppException("folder_has_files",
            "Ο φάκελος περιέχει αρχεία. Μεταφέρετε ή διαγράψτε τα πρώτα.", 409);
        f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Move one or more tenant-owned files into a target
    /// folder. Powers the tenant-side drag-and-drop of file rows onto
    /// folder rows in the tree. Both the files AND the target folder
    /// must belong to the caller's tenant — cross-tenant ids are
    /// filtered out by the query scope, matching the admin variant's
    /// silent-skip semantics for extras but returning 404 for a bogus
    /// target folder id. Empty file list = no-op success.</summary>
    [HttpPost("/api/bookkeeping/files/move")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<object>> MoveOwnFiles(
        [FromBody] MoveFilesBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        if (body.FileIds == null || body.FileIds.Count == 0)
            return Ok(new { moved = 0 });
        var target = await _db.BookkeepingFolders
            .FirstOrDefaultAsync(f => f.Id == body.TargetFolderId && f.TenantId == tenantId && f.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Target folder");
        var files = await _db.BookkeepingFiles
            .Where(x => x.TenantId == tenantId && body.FileIds.Contains(x.Id) && x.DeletedAt == null)
            .ToListAsync(ct);
        var moved = 0;
        foreach (var f in files)
        {
            if (f.FolderId == target.Id) continue;   // already there
            f.FolderId = target.Id;
            moved++;
        }
        if (moved > 0) await _db.SaveChangesAsync(ct);
        return Ok(new { moved });
    }

    /// <summary>Reparent (drag-and-drop) OR reorder a tenant-owned
    /// folder. Passing <c>NewParentFolderId = null</c> promotes it to
    /// root. Cycle-guarded — moving a folder under one of its own
    /// descendants is refused. Same tenant-isolation checks as the
    /// admin variant (<c>AdminMoveFolder</c>) — a folder id from
    /// another tenant is rejected as NotFound, not silently ignored.</summary>
    [HttpPatch("/api/bookkeeping/folders/{folderId:guid}/move")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<FolderDto>> MoveOwnFolder(Guid folderId,
        [FromBody] MoveFolderBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var f = await _db.BookkeepingFolders
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        if (body.NewParentFolderId is Guid pid)
        {
            if (pid == folderId)
                throw AppException.Validation("Ένας φάκελος δεν μπορεί να είναι γονέας του εαυτού του.");
            // Cycle guard: walk the target's ancestry, refuse if we hit folderId.
            var cursorId = (Guid?)pid;
            var seen = new HashSet<Guid>();
            while (cursorId is Guid cid)
            {
                if (cid == folderId)
                    throw AppException.Validation("Ο φάκελος δεν μπορεί να μετακινηθεί κάτω από κάποιον υποφάκελό του.");
                if (!seen.Add(cid)) break; // corrupted cycle in existing data — bail out
                var next = await _db.BookkeepingFolders
                    .Where(x => x.Id == cid && x.DeletedAt == null)
                    .Select(x => x.ParentFolderId).FirstOrDefaultAsync(ct);
                cursorId = next;
            }
            var parentOk = await _db.BookkeepingFolders
                .AnyAsync(x => x.Id == pid && x.TenantId == tenantId && x.DeletedAt == null, ct);
            if (!parentOk) throw AppException.NotFound("Parent folder");
        }
        f.ParentFolderId = body.NewParentFolderId;
        if (body.NewDisplayOrder is int ord) f.DisplayOrder = ord;
        await _db.SaveChangesAsync(ct);
        var count = await _db.BookkeepingFiles
            .CountAsync(x => x.FolderId == f.Id && x.DeletedAt == null, ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, count));
    }

    /// <summary>Tenant-side file upload. Same 16 MB cap as ΕΡΜΗΣ
    /// attachments. Tenants can only upload into their OWN folders —
    /// the server double-checks the folder's TenantId to prevent
    /// folder-id spoofing across tenants.</summary>
    [HttpPost("/api/bookkeeping/files")]
    [RequestSizeLimit(20_000_000)]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<FileDto>> UploadOwnFile(
        [FromForm] IFormFile file, [FromForm] Guid folderId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        // Terms gate — tenant must have accepted the current AUP version
        // before ANY upload. Enforced server-side so a modified client
        // can't sneak files in without acknowledging the policy.
        await RequireTermsAsync(tenantId, ct);
        var folder = await _db.BookkeepingFolders
            .FirstOrDefaultAsync(f => f.Id == folderId && f.TenantId == tenantId && f.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        var dto = await UploadFileInternal(tenantId, userId, folder, file, "tenant", ct);
        return Ok(dto);
    }

    /// <summary>Throws 428 «Precondition Required» when the tenant has
    /// not accepted the current AUP version. Called at the start of
    /// every upload path (tenant + admin). Admin uploads also require
    /// tenant acceptance — the platform team is uploading on the
    /// tenant's behalf, and the tenant has to have agreed that
    /// documents will be stored.</summary>
    private async Task RequireTermsAsync(Guid tenantId, CancellationToken ct)
    {
        var row = await _db.BookkeepingPrograms.AsNoTracking().IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.DeletedAt == null, ct);
        var accepted = row is { TermsAcceptedAt: not null }
            && string.Equals(row.TermsAcceptedVersion, CurrentTermsVersion, StringComparison.Ordinal);
        if (!accepted)
            throw new AppException("terms_not_accepted",
                "Το γραφείο πρέπει να αποδεχτεί την Πολιτική Χρήσης Μηχανογράφισης πριν από κάθε upload.",
                428);
    }

    [HttpGet("/api/bookkeeping/files/{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> DownloadOwnFile(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var f = await _db.BookkeepingFiles
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        var bytes = SensitiveDataEncryptor.IsAvailable
            ? SensitiveDataEncryptor.Instance.UnprotectBytes(f.ContentBytes)
            : f.ContentBytes;
        return File(bytes, f.MimeType, f.FileName);
    }

    /// <summary>Tenant-side file soft-delete. Sets DeletedAt so the file
    /// disappears from the tree but is recoverable if the platform team
    /// needs to. Tenants can only delete their own tenant's files —
    /// enforced by the TenantId filter below.</summary>
    [HttpDelete("/api/bookkeeping/files/{id:guid}")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<IActionResult> DeleteOwnFile(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var f = await _db.BookkeepingFiles
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("/api/bookkeeping/notes")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<NoteDto>> CreateOwnNote([FromBody] CreateNoteBody body, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var display = await _db.Users.Where(u => u.Id == userId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct) ?? "";
        return Ok(await CreateNoteInternal(tenantId, userId, display, "tenant", body, ct));
    }

    [HttpGet("/api/bookkeeping/activities")]
    [Authorize(Policy = "AgencyStaff")]
    public async Task<ActionResult<IReadOnlyList<ActivityDto>>> MyActivities(CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var rows = await _db.BookkeepingActivities.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt)
            .Take(200)
            .ToListAsync(ct);
        return Ok(rows.Select(a => new ActivityDto(a.Id, a.Kind, a.Title, a.Body,
            a.AuthorUserId, a.AuthorDisplay, a.Category, a.AutoNotified, a.CreatedAt)).ToList());
    }

    // ═══════════════════════════════════════════════════════════════
    // PLATFORM ADMIN
    // ═══════════════════════════════════════════════════════════════

    /// <summary>List every tenant that has μηχανογράφιση enabled. Feeds
    /// the platform admin's tenant picker in «Διοίκηση → Μηχανογράφιση
    /// γραφείων».</summary>
    [HttpGet("/api/platform/bookkeeping/tenants")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<TenantOverviewDto>>> ListTenants(CancellationToken ct)
    {
        // We use IgnoreQueryFilters everywhere on the platform surface —
        // the caller is a PlatformAdmin, they must see every tenant.
        var progs = await _db.BookkeepingPrograms.IgnoreQueryFilters()
            .Where(p => p.Enabled && p.DeletedAt == null)
            .ToListAsync(ct);
        var tenantIds = progs.Select(p => p.TenantId).ToList();
        var tenants = await _db.Tenants.IgnoreQueryFilters()
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        var folderCounts = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .Where(f => tenantIds.Contains(f.TenantId) && f.DeletedAt == null)
            .GroupBy(f => f.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);
        var fileGroups = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(f => tenantIds.Contains(f.TenantId) && f.DeletedAt == null)
            .GroupBy(f => f.TenantId)
            .Select(g => new {
                TenantId = g.Key,
                Total = g.Count(),
                Pending = g.Count(x => x.Status == "pending"),
            }).ToListAsync(ct);
        var fileByTenant = fileGroups.ToDictionary(x => x.TenantId);
        var lastAct = await _db.BookkeepingActivities.IgnoreQueryFilters()
            .Where(a => tenantIds.Contains(a.TenantId) && a.DeletedAt == null)
            .GroupBy(a => a.TenantId)
            .Select(g => new { TenantId = g.Key, LastAt = g.Max(x => x.CreatedAt) })
            .ToDictionaryAsync(x => x.TenantId, x => x.LastAt, ct);
        var result = progs.Select(p => new TenantOverviewDto(
            p.TenantId,
            tenants.TryGetValue(p.TenantId, out var name) ? name : "(unknown)",
            p.Mode,
            p.Onboarded,
            p.OnboardedAt,
            folderCounts.GetValueOrDefault(p.TenantId, 0),
            fileByTenant.TryGetValue(p.TenantId, out var fg) ? fg.Total : 0,
            fileByTenant.TryGetValue(p.TenantId, out fg) ? fg.Pending : 0,
            lastAct.TryGetValue(p.TenantId, out var last) ? last : null
        )).OrderByDescending(x => x.LastActivityAt ?? DateTime.MinValue).ToList();
        return Ok(result);
    }

    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/tree")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> AdminTree(Guid tenantId, CancellationToken ct)
        => Ok(await LoadTree(tenantId, ct, ignoreFilters: true));

    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/folders")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FolderDto>> AdminCreateFolder(Guid tenantId,
        [FromBody] CreateFolderBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Όνομα φακέλου κενό.");
        // Guard: parent folder must belong to the same tenant.
        if (body.ParentFolderId is Guid pid)
        {
            var parentOk = await _db.BookkeepingFolders.IgnoreQueryFilters()
                .AnyAsync(x => x.Id == pid && x.TenantId == tenantId && x.DeletedAt == null, ct);
            if (!parentOk) throw AppException.NotFound("Parent folder");
        }
        var f = new BookkeepingFolder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ParentFolderId = body.ParentFolderId,
            Name = body.Name.Trim(),
            Origin = "custom",
            DisplayOrder = body.DisplayOrder,
            CreatedAt = _clock.UtcNow,
        };
        _db.BookkeepingFolders.Add(f);
        await _db.SaveChangesAsync(ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, 0));
    }

    [HttpPut("/api/platform/bookkeeping/tenants/{tenantId:guid}/folders/{folderId:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FolderDto>> AdminRenameFolder(Guid tenantId, Guid folderId,
        [FromBody] RenameFolderBody body, CancellationToken ct)
    {
        var f = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Όνομα κενό.");
        f.Name = body.Name.Trim();
        f.DisplayOrder = body.DisplayOrder;
        await _db.SaveChangesAsync(ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, 0));
    }

    /// <summary>Move a folder — reparent it under a different folder (or
    /// to root) AND/OR change its DisplayOrder among siblings. Powers
    /// the drag-drop tree UI. Guards against creating cycles by refusing
    /// to reparent a folder under itself or any of its descendants.</summary>
    [HttpPatch("/api/platform/bookkeeping/tenants/{tenantId:guid}/folders/{folderId:guid}/move")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FolderDto>> AdminMoveFolder(Guid tenantId, Guid folderId,
        [FromBody] MoveFolderBody body, CancellationToken ct)
    {
        var f = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        if (body.NewParentFolderId is Guid pid)
        {
            if (pid == folderId)
                throw AppException.Validation("Ένας φάκελος δεν μπορεί να είναι γονέας του εαυτού του.");
            // Cycle guard: walk the target's ancestry, refuse if we hit folderId.
            var cursorId = (Guid?)pid;
            var seen = new HashSet<Guid>();
            while (cursorId is Guid cid)
            {
                if (cid == folderId)
                    throw AppException.Validation("Ο φάκελος δεν μπορεί να μετακινηθεί κάτω από κάποιον υποφάκελό του.");
                if (!seen.Add(cid)) break; // corrupted cycle in existing data — bail out
                var next = await _db.BookkeepingFolders.IgnoreQueryFilters()
                    .Where(x => x.Id == cid && x.TenantId == tenantId && x.DeletedAt == null)
                    .Select(x => x.ParentFolderId).FirstOrDefaultAsync(ct);
                cursorId = next;
            }
            // Parent must exist in this tenant.
            var parentOk = await _db.BookkeepingFolders.IgnoreQueryFilters()
                .AnyAsync(x => x.Id == pid && x.TenantId == tenantId && x.DeletedAt == null, ct);
            if (!parentOk) throw AppException.NotFound("Parent folder");
        }
        f.ParentFolderId = body.NewParentFolderId;
        if (body.NewDisplayOrder is int ord) f.DisplayOrder = ord;
        await _db.SaveChangesAsync(ct);
        var count = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .CountAsync(x => x.FolderId == f.Id && x.DeletedAt == null, ct);
        return Ok(new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, count));
    }

    [HttpDelete("/api/platform/bookkeeping/tenants/{tenantId:guid}/folders/{folderId:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> AdminDeleteFolder(Guid tenantId, Guid folderId, CancellationToken ct)
    {
        var f = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == folderId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        // Soft-delete the folder + its files. Children (subfolders + files
        // deep) are NOT recursively touched — the platform admin has to
        // clean them out first. Keeps accidental drops recoverable.
        var hasChildren = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .AnyAsync(x => x.ParentFolderId == folderId && x.DeletedAt == null, ct);
        var hasFiles = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .AnyAsync(x => x.FolderId == folderId && x.DeletedAt == null, ct);
        if (hasChildren || hasFiles)
            throw AppException.Validation("Ο φάκελος δεν είναι άδειος — καθαρίστε πρώτα το περιεχόμενο.");
        f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/files")]
    [RequestSizeLimit(20_000_000)]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FileDto>> AdminUploadFile(Guid tenantId,
        [FromForm] IFormFile file, [FromForm] Guid folderId, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        // Even a platform-admin upload requires the tenant to have
        // accepted the AUP first — the tenant is the data controller,
        // we're the processor, and consent is theirs to give.
        await RequireTermsAsync(tenantId, ct);
        var folder = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == folderId && f.TenantId == tenantId && f.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Folder");
        return Ok(await UploadFileInternal(tenantId, userId, folder, file, "admin", ct));
    }

    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/{fileId:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> AdminDownloadFile(Guid tenantId, Guid fileId, CancellationToken ct)
    {
        var f = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == fileId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        // Decrypt the stored blob before streaming. UnprotectBytes returns
        // the input unchanged if the magic byte isn't present → legacy
        // plaintext rows still work during the rollout.
        var bytes = SensitiveDataEncryptor.IsAvailable
            ? SensitiveDataEncryptor.Instance.UnprotectBytes(f.ContentBytes)
            : f.ContentBytes;
        return File(bytes, f.MimeType, f.FileName);
    }

    [HttpPut("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/{fileId:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FileDto>> AdminUpdateFile(Guid tenantId, Guid fileId,
        [FromBody] UpdateFileBody body, CancellationToken ct)
    {
        var f = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == fileId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        if (body.Notes is not null) f.Notes = body.Notes;
        if (body.Status is not null) f.Status = body.Status;
        await _db.SaveChangesAsync(ct);
        return Ok(FileToDto(f, null));
    }

    /// <summary>«Replace» semantics — same folder, delete old + upload
    /// new. Kept as an explicit endpoint so admins can swap a corrupted
    /// document without having to re-create the metadata (status,
    /// notes) from scratch.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/{fileId:guid}/replace")]
    [RequestSizeLimit(20_000_000)]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<FileDto>> AdminReplaceFile(Guid tenantId, Guid fileId,
        [FromForm] IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw AppException.Validation("Απαιτείται αρχείο.");
        await RequireTermsAsync(tenantId, ct);
        var f = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == fileId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        f.FileName = string.IsNullOrWhiteSpace(file.FileName) ? f.FileName : file.FileName;
        f.MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? f.MimeType : file.ContentType;
        f.SizeBytes = ms.Length;
        // Encrypt at rest before persisting. SizeBytes stays the
        // plaintext length so UX «X MB uploaded» stays honest.
        var raw = ms.ToArray();
        f.ContentBytes = SensitiveDataEncryptor.IsAvailable
            ? SensitiveDataEncryptor.Instance.ProtectBytes(raw)
            : raw;
        await _db.SaveChangesAsync(ct);
        return Ok(FileToDto(f, null));
    }

    [HttpDelete("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/{fileId:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> AdminDeleteFile(Guid tenantId, Guid fileId, CancellationToken ct)
    {
        var f = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == fileId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("File");
        f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Move a batch of files into a target folder. Powers both
    /// drag-drop of a single file across folders and the multi-select
    /// «Μετακίνηση σε…» bulk action. Silently skips any id that isn't
    /// in this tenant — no cross-tenant leak, no confusing 404 when
    /// the frontend ships a stale selection.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/bulk-move")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> AdminBulkMoveFiles(Guid tenantId,
        [FromBody] MoveFilesBody body, CancellationToken ct)
    {
        if (body.FileIds == null || body.FileIds.Count == 0)
            return Ok(new { moved = 0 });
        var target = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(f => f.Id == body.TargetFolderId && f.TenantId == tenantId && f.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Target folder");
        var files = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && body.FileIds.Contains(x.Id) && x.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var f in files) f.FolderId = target.Id;
        await _db.SaveChangesAsync(ct);
        return Ok(new { moved = files.Count });
    }

    /// <summary>Batch-delete files by id.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/bulk-delete")]
    [Authorize(Policy = "PlatformAdmin")]
    [RequiresAdminOtp("bookkeeping.file.bulk-delete", TargetFromRoute = "tenantId")]
    public async Task<ActionResult<object>> AdminBulkDeleteFiles(Guid tenantId,
        [FromBody] BulkFilesBody body, CancellationToken ct)
    {
        if (body.FileIds == null || body.FileIds.Count == 0) return Ok(new { deleted = 0 });
        var files = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && body.FileIds.Contains(x.Id) && x.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var f in files) f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { deleted = files.Count });
    }

    /// <summary>Batch-set status on a selection of files. Feeds the
    /// «Επιλέξτε όλα → Σημείωση ως processed» toolbar action.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/files/bulk-status")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> AdminBulkStatus(Guid tenantId,
        [FromBody] BulkStatusBody body, CancellationToken ct)
    {
        if (body.FileIds == null || body.FileIds.Count == 0) return Ok(new { updated = 0 });
        var allowed = new HashSet<string> { "pending", "processed", "rejected" };
        if (!allowed.Contains(body.Status ?? ""))
            throw AppException.Validation("Άκυρη κατάσταση.");
        var files = await _db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && body.FileIds.Contains(x.Id) && x.DeletedAt == null)
            .ToListAsync(ct);
        foreach (var f in files) f.Status = body.Status;
        await _db.SaveChangesAsync(ct);
        return Ok(new { updated = files.Count });
    }

    [HttpDelete("/api/platform/bookkeeping/tenants/{tenantId:guid}/files")]
    [Authorize(Policy = "PlatformAdmin")]
    [RequiresAdminOtp("bookkeeping.files.delete-all", TargetFromRoute = "tenantId")]
    public async Task<IActionResult> AdminDeleteAllFiles(Guid tenantId, [FromQuery] Guid? folderId, CancellationToken ct)
    {
        // Bulk-clear either a folder's files or the entire tenant's files.
        // Aggressive — the platform admin invokes it deliberately from
        // the «Καθαρισμός» toolbar button.
        var q = _db.BookkeepingFiles.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null);
        if (folderId is Guid fid) q = q.Where(x => x.FolderId == fid);
        var toGo = await q.ToListAsync(ct);
        foreach (var f in toGo) f.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { deleted = toGo.Count });
    }

    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/notes")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<NoteDto>> AdminCreateNote(Guid tenantId,
        [FromBody] CreateNoteBody body, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var display = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct) ?? "Kalypsis";
        return Ok(await CreateNoteInternal(tenantId, userId, display, "admin", body, ct));
    }

    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/notes")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<NoteDto>>> AdminListNotes(Guid tenantId,
        [FromQuery] Guid? folderId, [FromQuery] Guid? fileId, CancellationToken ct)
    {
        var q = _db.BookkeepingNotes.IgnoreQueryFilters()
            .Where(n => n.TenantId == tenantId && n.DeletedAt == null);
        if (folderId is Guid fld) q = q.Where(n => n.FolderId == fld);
        if (fileId is Guid fil) q = q.Where(n => n.FileId == fil);
        var rows = await q.OrderByDescending(n => n.CreatedAt).Take(500).ToListAsync(ct);
        return Ok(rows.Select(n => new NoteDto(n.Id, n.FolderId, n.FileId,
            n.AuthorUserId, n.AuthorDisplay, n.AuthorRole, n.Body, n.CreatedAt)).ToList());
    }

    /// <summary>Log a «latest thing done» activity for the tenant. If
    /// AutoNotify is set, immediately fires an ΕΡΜΗΣ message to every
    /// AgencyAdmin of that tenant so they know the work is done
    /// («Μηχανογραφήθηκε ο μήνας 08/2026»). Notification failures are
    /// logged but never abort the activity write.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/activities")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<ActivityDto>> AdminCreateActivity(Guid tenantId,
        [FromBody] CreateActivityBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Title)) throw AppException.Validation("Τίτλος κενός.");
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var display = await _db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == userId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct) ?? "Kalypsis";
        var act = new BookkeepingActivity
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Kind = string.IsNullOrWhiteSpace(body.Kind) ? "note" : body.Kind,
            Title = body.Title.Trim(),
            Body = body.Body,
            AuthorUserId = userId,
            AuthorDisplay = display,
            Category = string.IsNullOrWhiteSpace(body.Category) ? null : body.Category.Trim(),
            CreatedAt = _clock.UtcNow,
        };
        _db.BookkeepingActivities.Add(act);
        await _db.SaveChangesAsync(ct);

        if (body.AutoNotify)
        {
            try
            {
                var admins = await _db.Users.IgnoreQueryFilters()
                    .Where(u => u.TenantId == tenantId && u.DeletedAt == null
                        && (u.Role == Kalypsis.Domain.Enums.Role.AgencyAdmin
                            || u.Role == Kalypsis.Domain.Enums.Role.AgencyUser))
                    .Select(u => u.Id).ToListAsync(ct);
                if (admins.Count > 0)
                {
                    var subject = $"Μηχανογράφιση — {act.Title}";
                    var bodyHtml = $"<p>{System.Net.WebUtility.HtmlEncode(act.Title)}</p>" +
                        (string.IsNullOrWhiteSpace(act.Body)
                            ? ""
                            : $"<p>{System.Net.WebUtility.HtmlEncode(act.Body)}</p>") +
                        (string.IsNullOrWhiteSpace(act.Category) ? "" :
                            $"<p><em>Κατηγορία: {System.Net.WebUtility.HtmlEncode(act.Category)}</em></p>");
                    var msgId = await _mediator.Send(new SendErmesCommand(
                        Subject: subject,
                        BodyHtml: bodyHtml,
                        Recipients: admins.Select(a => new ErmesRecipientInput(a, "To")).ToList(),
                        TeamIds: new List<Guid>(),
                        InReplyToMessageId: null,
                        IsImportant: false,
                        SaveAsDraft: false,
                        AutomationSource: "bookkeeping-activity",
                        Category: act.Category,
                        SendExternalEmail: false), ct);
                    act.AutoNotified = true;
                    act.NotificationMessageId = msgId;
                    await _db.SaveChangesAsync(ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bookkeeping activity notify failed for tenant {TenantId}", tenantId);
            }
        }
        return Ok(new ActivityDto(act.Id, act.Kind, act.Title, act.Body,
            act.AuthorUserId, act.AuthorDisplay, act.Category, act.AutoNotified, act.CreatedAt));
    }

    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/activities")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<ActivityDto>>> AdminListActivities(Guid tenantId, CancellationToken ct)
    {
        var rows = await _db.BookkeepingActivities.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId && a.DeletedAt == null)
            .OrderByDescending(a => a.CreatedAt).Take(500).ToListAsync(ct);
        return Ok(rows.Select(a => new ActivityDto(a.Id, a.Kind, a.Title, a.Body,
            a.AuthorUserId, a.AuthorDisplay, a.Category, a.AutoNotified, a.CreatedAt)).ToList());
    }

    [HttpPut("/api/platform/bookkeeping/tenants/{tenantId:guid}/onboarded")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<ProgramDto>> AdminMarkOnboarded(Guid tenantId, [FromBody] bool onboarded, CancellationToken ct)
    {
        var p = await _db.BookkeepingPrograms.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, ct)
            ?? throw AppException.NotFound("Program");
        p.Onboarded = onboarded;
        p.OnboardedAt = onboarded ? _clock.UtcNow : null;
        await _db.SaveChangesAsync(ct);
        return Ok(new ProgramDto(p.Enabled, p.Mode, p.ContactRequestNote, p.Onboarded, p.OnboardedAt, p.CreatedAt,
            p.TermsAcceptedAt, p.TermsAcceptedVersion, CurrentTermsVersion));
    }

    /// <summary>Apply the platform-wide default folder structure to a
    /// tenant that just onboarded. Idempotent — folders with the same
    /// name are skipped, so re-applying doesn't duplicate.</summary>
    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/apply-defaults")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<FolderDto>>> AdminApplyDefaultStructure(Guid tenantId, CancellationToken ct)
    {
        var defaults = await GetOrDefaultStructureAsync(ct);
        var existing = await _db.BookkeepingFolders.IgnoreQueryFilters()
            .Where(f => f.TenantId == tenantId && f.DeletedAt == null && f.ParentFolderId == null)
            .Select(f => f.Name).ToListAsync(ct);
        var existingSet = existing.ToHashSet();
        var added = new List<BookkeepingFolder>();
        var order = 0;
        foreach (var name in defaults)
        {
            order++;
            if (existingSet.Contains(name)) continue;
            var f = new BookkeepingFolder
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ParentFolderId = null,
                Name = name,
                Origin = "default",
                DisplayOrder = order,
                CreatedAt = _clock.UtcNow,
            };
            _db.BookkeepingFolders.Add(f);
            added.Add(f);
        }
        if (added.Count > 0) await _db.SaveChangesAsync(ct);
        return Ok(added.Select(f => new FolderDto(f.Id, null, f.Name, f.Origin, f.DisplayOrder, f.CreatedAt, 0)).ToList());
    }

    // ── Default structure (platform-wide, stored in LandingContent as JSON) ─
    // Reuse the KV store we already have for editable settings — one row
    // per SectionKey, PayloadJson = JSON array of folder names. Saves us
    // adding another table for a single-row config.
    private const string DefaultStructureKey = "bookkeeping-default-folders";
    private static readonly string[] BuiltInDefaults = new[]
    {
        "Έσοδα", "Έξοδα", "Παραστατικά", "Βιβλία",
        "Προμήθειες", "Υπερπρομήθειες", "Πληρωμές",
        "Τραπεζικές κινήσεις", "Παρακρατούμενοι φόροι", "Λοιπά",
    };

    private async Task<List<string>> GetOrDefaultStructureAsync(CancellationToken ct)
    {
        var row = await _db.LandingContents.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.SectionKey == DefaultStructureKey && x.DeletedAt == null, ct);
        if (row is null) return BuiltInDefaults.ToList();
        try
        {
            var arr = JsonSerializer.Deserialize<List<string>>(row.PayloadJson);
            return (arr ?? new List<string>()).Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
        }
        catch { return BuiltInDefaults.ToList(); }
    }

    [HttpGet("/api/platform/bookkeeping/default-structure")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<string>>> AdminGetDefaults(CancellationToken ct)
        => Ok(await GetOrDefaultStructureAsync(ct));

    [HttpPut("/api/platform/bookkeeping/default-structure")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<string>>> AdminSetDefaults(
        [FromBody] IReadOnlyList<string> folders, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var clean = folders.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Distinct().Take(50).ToList();
        var row = await _db.LandingContents
            .FirstOrDefaultAsync(x => x.SectionKey == DefaultStructureKey, ct);
        var json = JsonSerializer.Serialize(clean);
        if (row is null)
        {
            _db.LandingContents.Add(new LandingContent
            {
                Id = Guid.NewGuid(),
                SectionKey = DefaultStructureKey,
                PayloadJson = json,
                UpdatedByUserId = userId,
                CreatedAt = _clock.UtcNow,
            });
        }
        else { row.DeletedAt = null; row.PayloadJson = json; row.UpdatedByUserId = userId; }
        await _db.SaveChangesAsync(ct);
        return Ok(clean);
    }

    // ── Portal credentials (encrypted at rest, PlatformAdmin-only) ──
    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/credentials")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<IReadOnlyList<CredentialDto>>> AdminListCredentials(Guid tenantId, CancellationToken ct)
    {
        var rows = await _db.BookkeepingPortalCredentials.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null)
            .OrderBy(x => x.CarrierName).ToListAsync(ct);
        return Ok(rows.Select(c => new CredentialDto(c.Id, c.CarrierName, c.PortalUrl,
            c.Notes, c.Active, c.LastVerifiedAt, c.CreatedAt)).ToList());
    }

    /// <summary>Reveals the plaintext for a single credential. Kept as a
    /// separate endpoint (not part of the list response) so PlatformAdmin
    /// has to explicitly request each secret — matches how password
    /// managers show credentials on click, not on list.</summary>
    [HttpGet("/api/platform/bookkeeping/tenants/{tenantId:guid}/credentials/{id:guid}/reveal")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<object>> AdminRevealCredential(Guid tenantId, Guid id, CancellationToken ct)
    {
        var c = await _db.BookkeepingPortalCredentials.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Credential");
        // EncryptedStringConverter auto-decrypts on load — the values on
        // the entity are already plaintext. We just return them.
        return Ok(new { c.CarrierName, c.PortalUrl, c.UsernameCipher, c.PasswordCipher });
    }

    [HttpPost("/api/platform/bookkeeping/tenants/{tenantId:guid}/credentials")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<ActionResult<CredentialDto>> AdminUpsertCredential(Guid tenantId,
        [FromBody] UpsertCredentialBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.CarrierName)) throw AppException.Validation("Carrier κενός.");
        var c = await _db.BookkeepingPortalCredentials.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.CarrierName == body.CarrierName && x.DeletedAt == null, ct);
        if (c is null)
        {
            c = new BookkeepingPortalCredential
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CarrierName = body.CarrierName.Trim(),
                CreatedAt = _clock.UtcNow,
            };
            _db.BookkeepingPortalCredentials.Add(c);
        }
        c.PortalUrl = body.PortalUrl?.Trim() ?? "";
        c.UsernameCipher = body.Username ?? "";
        c.PasswordCipher = body.Password ?? "";
        c.Notes = body.Notes;
        c.Active = true;
        await _db.SaveChangesAsync(ct);
        return Ok(new CredentialDto(c.Id, c.CarrierName, c.PortalUrl, c.Notes, c.Active, c.LastVerifiedAt, c.CreatedAt));
    }

    [HttpDelete("/api/platform/bookkeeping/tenants/{tenantId:guid}/credentials/{id:guid}")]
    [Authorize(Policy = "PlatformAdmin")]
    public async Task<IActionResult> AdminDeleteCredential(Guid tenantId, Guid id, CancellationToken ct)
    {
        var c = await _db.BookkeepingPortalCredentials.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Credential");
        c.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ═══════════════════════════════════════════════════════════════
    // Shared helpers
    // ═══════════════════════════════════════════════════════════════

    private async Task<object> LoadTree(Guid tenantId, CancellationToken ct, bool ignoreFilters = false)
    {
        IQueryable<BookkeepingFolder> foldersQ = _db.BookkeepingFolders;
        IQueryable<BookkeepingFile> filesQ = _db.BookkeepingFiles;
        if (ignoreFilters)
        {
            foldersQ = foldersQ.IgnoreQueryFilters();
            filesQ = filesQ.IgnoreQueryFilters();
        }
        var folders = await foldersQ.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.DeletedAt == null)
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Name).ToListAsync(ct);
        var files = await filesQ.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.DeletedAt == null)
            .OrderByDescending(f => f.CreatedAt).ToListAsync(ct);
        var uploaderIds = files.Select(f => f.UploadedByUserId).Distinct().ToList();
        var uploaders = await _db.Users.IgnoreQueryFilters()
            .Where(u => uploaderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => (u.FirstName + " " + u.LastName).Trim(), ct);
        var fileCounts = files.GroupBy(x => x.FolderId).ToDictionary(g => g.Key, g => g.Count());
        return new
        {
            folders = folders.Select(f => new FolderDto(f.Id, f.ParentFolderId, f.Name, f.Origin,
                f.DisplayOrder, f.CreatedAt, fileCounts.GetValueOrDefault(f.Id, 0))).ToList(),
            files = files.Select(f => FileToDto(f, uploaders.GetValueOrDefault(f.UploadedByUserId, ""))).ToList(),
        };
    }

    private static FileDto FileToDto(BookkeepingFile f, string? uploader)
        => new(f.Id, f.FolderId, f.FileName, f.MimeType, f.SizeBytes,
            f.UploadedBy, f.Notes, f.Status, f.CreatedAt, uploader);

    private async Task<FileDto> UploadFileInternal(Guid tenantId, Guid userId, BookkeepingFolder folder,
        IFormFile file, string uploadedBy, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw AppException.Validation("Απαιτείται αρχείο.");
        const long max = 16L * 1024 * 1024;
        if (file.Length > max) throw AppException.Validation($"Μέγιστο {max / (1024 * 1024)} MB.");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var raw = ms.ToArray();
        // Encrypt the payload at rest with AES-256-GCM before persisting.
        // The magic-byte envelope lets old plaintext rows still decode
        // through UnprotectBytes for a graceful rollout.
        var stored = SensitiveDataEncryptor.IsAvailable
            ? SensitiveDataEncryptor.Instance.ProtectBytes(raw)
            : raw;
        var f = new BookkeepingFile
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FolderId = folder.Id,
            FileName = string.IsNullOrWhiteSpace(file.FileName) ? "file" : file.FileName,
            MimeType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            SizeBytes = raw.LongLength,      // plaintext size — honest UX
            ContentBytes = stored,           // ciphertext bytes on disk
            UploadedBy = uploadedBy,
            UploadedByUserId = userId,
            Status = "pending",
            CreatedAt = _clock.UtcNow,
        };
        _db.BookkeepingFiles.Add(f);
        await _db.SaveChangesAsync(ct);
        return FileToDto(f, null);
    }

    private async Task<NoteDto> CreateNoteInternal(Guid tenantId, Guid userId, string display,
        string authorRole, CreateNoteBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Body)) throw AppException.Validation("Κείμενο κενό.");
        if (body.FolderId is null && body.FileId is null)
            throw AppException.Validation("Απαιτείται φάκελος ή αρχείο.");
        var n = new BookkeepingNote
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FolderId = body.FolderId,
            FileId = body.FileId,
            AuthorUserId = userId,
            AuthorDisplay = display,
            AuthorRole = authorRole,
            Body = body.Body.Trim(),
            CreatedAt = _clock.UtcNow,
        };
        _db.BookkeepingNotes.Add(n);
        await _db.SaveChangesAsync(ct);
        return new NoteDto(n.Id, n.FolderId, n.FileId, n.AuthorUserId, n.AuthorDisplay,
            n.AuthorRole, n.Body, n.CreatedAt);
    }
}
