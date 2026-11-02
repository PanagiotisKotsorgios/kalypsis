using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Auth;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PortalClaim = System.Security.Claims.Claim;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/custom-software-portal")]
public sealed class CustomSoftwarePortalController : ControllerBase
{
    private const string PortalTokenClaim = "custom_software_portal";
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IFileStorage _fileStorage;
    private readonly IFileSafetyService _fileSafety;
    private readonly JwtOptions _jwt;

    public CustomSoftwarePortalController(
        AppDbContext db,
        IPasswordHasher passwordHasher,
        IFileStorage fileStorage,
        IFileSafetyService fileSafety,
        IOptions<JwtOptions> jwt)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _fileStorage = fileStorage;
        _fileSafety = fileSafety;
        _jwt = jwt.Value;
    }

    public sealed record LoginBody(string Email, string Password);
    public sealed record LoginResult(
        string AccessToken,
        DateTime ExpiresAt,
        Guid AccountId,
        string Email,
        string FirstName,
        string LastName,
        string PreferencesJson);
    public sealed record ProjectRecordDto(
        Guid Id,
        Guid? ParentRecordId,
        string Kind,
        string Title,
        string? Description,
        string? Status,
        string? DetailsJson,
        int SortOrder,
        decimal? Amount,
        DateOnly? DueOn,
        DateOnly? IssuedOn,
        bool HasFile,
        string? FileName,
        string? ContentType,
        long? SizeBytes);

    [HttpPost("auth/login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResult>> Login(LoginBody body, CancellationToken ct)
    {
        var email = body.Email.Trim().ToLowerInvariant();
        var account = await _db.CustomSoftwarePortalAccounts
            .SingleOrDefaultAsync(x => x.Email == email, ct);

        if (account is null || !account.IsActive
            || (account.LockedUntil is not null && account.LockedUntil > DateTime.UtcNow)
            || !_passwordHasher.Verify(body.Password, account.PasswordHash))
        {
            if (account is not null && account.IsActive)
            {
                account.FailedLoginAttempts++;
                if (account.FailedLoginAttempts >= 8)
                {
                    account.LockedUntil = DateTime.UtcNow.AddMinutes(15);
                    account.FailedLoginAttempts = 0;
                }
                await _db.SaveChangesAsync(ct);
            }
            return Unauthorized(new { message = "Τα στοιχεία σύνδεσης δεν είναι σωστά ή ο λογαριασμός δεν είναι διαθέσιμος." });
        }

        account.FailedLoginAttempts = 0;
        account.LockedUntil = null;
        account.LastLoginAt = DateTime.UtcNow;
        account.MustChangePassword = false;
        await _db.SaveChangesAsync(ct);

        var expiresAt = DateTime.UtcNow.AddHours(4);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims:
            [
                new PortalClaim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
                new PortalClaim(JwtRegisteredClaimNames.Email, account.Email),
                new PortalClaim("custom_software_portal", "true"),
                new PortalClaim("portal_session_version", account.SessionVersion.ToString()),
                new PortalClaim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            ],
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return Ok(new LoginResult(
            new JwtSecurityTokenHandler().WriteToken(token),
            expiresAt,
            account.Id,
            account.Email,
            account.FirstName,
            account.LastName,
            account.PreferencesJson));
    }

    [HttpGet("me")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<ActionResult> Me(CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        return Ok(new
        {
            account.Id,
            account.Email,
            account.FirstName,
            account.LastName,
            account.Phone,
            account.PreferencesJson,
            Projects = await _db.CustomSoftwareProjectAccesses
                .Where(x => x.AccountId == account.Id)
                .OrderBy(x => x.Project.Name)
                .Select(x => new
                {
                    x.Project.Id,
                    x.Project.Name,
                    x.Project.Summary,
                    x.Project.Status,
                    x.Project.TargetDate,
                    x.Project.TotalCost,
                    x.Project.Currency
                })
                .ToListAsync(ct)
        });
    }

    [HttpGet("projects/{projectId:guid}")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<ActionResult> Project(Guid projectId, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (!await HasProjectAccessAsync(account.Id, projectId, ct)) return NotFound();

        var project = await _db.CustomSoftwareProjects
            .Where(x => x.Id == projectId)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.ClientName,
                x.Summary,
                x.Description,
                x.Status,
                x.Currency,
                x.TotalCost,
                x.StartedOn,
                x.TargetDate,
                x.RepositoryUrl,
                x.ProjectDownloadUrl,
                Records = x.Records
                    .OrderBy(r => r.SortOrder)
                    .ThenBy(r => r.CreatedAt)
                    .Select(r => new ProjectRecordDto(
                        r.Id, r.ParentRecordId, r.Kind, r.Title, r.Description, r.Status,
                        r.DetailsJson, r.SortOrder, r.Amount, r.DueOn, r.IssuedOn,
                        r.StorageKey != null, r.FileName, r.ContentType, r.SizeBytes))
                    .ToList()
            })
            .SingleOrDefaultAsync(ct);

        return project is null ? NotFound() : Ok(project);
    }

    [HttpPut("profile")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<ActionResult> UpdateProfile(UpdateProfileBody body, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.FirstName) || body.FirstName.Trim().Length > 100
            || string.IsNullOrWhiteSpace(body.LastName) || body.LastName.Trim().Length > 100
            || (body.Phone?.Length ?? 0) > 40)
            return BadRequest(new { message = "Ελέγξτε τα στοιχεία του προφίλ σας." });

        try
        {
            using var json = JsonDocument.Parse(body.PreferencesJson ?? "{}");
            if (json.RootElement.ValueKind != JsonValueKind.Object)
                return BadRequest(new { message = "Οι προτιμήσεις πρέπει να είναι αντικείμενο JSON." });
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "Οι προτιμήσεις δεν έχουν έγκυρη μορφή." });
        }

        var account = await GetCurrentAccountAsync(ct);
        account.FirstName = body.FirstName.Trim();
        account.LastName = body.LastName.Trim();
        account.Phone = string.IsNullOrWhiteSpace(body.Phone) ? null : body.Phone.Trim();
        account.PreferencesJson = body.PreferencesJson ?? "{}";
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public sealed record UpdateProfileBody(string FirstName, string LastName, string? Phone, string? PreferencesJson);
    public sealed record ChangePasswordBody(string CurrentPassword, string NewPassword);

    [HttpPost("change-password")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<ActionResult> ChangePassword(ChangePasswordBody body, CancellationToken ct)
    {
        if (body.NewPassword.Length < 12 || body.NewPassword.Length > 200)
            return BadRequest(new { message = "Ο νέος κωδικός πρέπει να περιέχει τουλάχιστον 12 χαρακτήρες." });

        var account = await GetCurrentAccountAsync(ct);
        if (!_passwordHasher.Verify(body.CurrentPassword, account.PasswordHash))
            return BadRequest(new { message = "Ο τρέχων κωδικός δεν είναι σωστός." });

        account.PasswordHash = _passwordHasher.Hash(body.NewPassword);
        account.MustChangePassword = false;
        account.SessionVersion++;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Ο κωδικός άλλαξε. Συνδεθείτε ξανά με τον νέο κωδικό." });
    }

    [HttpPost("logout")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<ActionResult> Logout(CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        account.SessionVersion++;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("documents/{recordId:guid}/download")]
    [Authorize(Policy = "CustomSoftwarePortal")]
    public async Task<IActionResult> Download(Guid recordId, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        var record = await _db.CustomSoftwareProjectRecords
            .Where(x => x.Id == recordId && x.StorageKey != null)
            .Select(x => new { x.ProjectId, x.StorageKey, x.FileName, x.ContentType })
            .SingleOrDefaultAsync(ct);
        if (record is null || !await HasProjectAccessAsync(account.Id, record.ProjectId, ct))
            return NotFound();

        var stream = await _fileStorage.DownloadAsync(record.StorageKey!, ct);
        return File(stream, record.ContentType ?? "application/octet-stream", record.FileName ?? "project-file");
    }

    private async Task<CustomSoftwarePortalAccount> GetCurrentAccountAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var accountId)
            || !int.TryParse(User.FindFirstValue("portal_session_version"), out var sessionVersion))
            throw AppException.Unauthorized();

        var account = await _db.CustomSoftwarePortalAccounts
            .SingleOrDefaultAsync(x => x.Id == accountId && x.IsActive, ct);
        if (account is null || account.SessionVersion != sessionVersion)
            throw AppException.Unauthorized();
        return account;
    }

    private Task<bool> HasProjectAccessAsync(Guid accountId, Guid projectId, CancellationToken ct) =>
        _db.CustomSoftwareProjectAccesses.AnyAsync(x => x.AccountId == accountId && x.ProjectId == projectId, ct);

    private static object RecordView(CustomSoftwareProjectRecord r) => new
    {
        r.Id,
        r.ParentRecordId,
        r.Kind,
        r.Title,
        r.Description,
        r.Status,
        r.DetailsJson,
        r.SortOrder,
        r.Amount,
        r.DueOn,
        r.IssuedOn,
        HasFile = r.StorageKey != null,
        r.FileName,
        r.ContentType,
        r.SizeBytes
    };
}

[ApiController]
[Route("api/platform/custom-software-portal")]
[Authorize(Policy = "PlatformAdmin")]
public sealed class PlatformCustomSoftwarePortalController : ControllerBase
{
    private const long MaxUploadBytes = 25 * 1024 * 1024;
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IFileStorage _fileStorage;
    private readonly IFileSafetyService _fileSafety;

    public PlatformCustomSoftwarePortalController(
        AppDbContext db,
        IPasswordHasher passwordHasher,
        IFileStorage fileStorage,
        IFileSafetyService fileSafety)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _fileStorage = fileStorage;
        _fileSafety = fileSafety;
    }

    public sealed record AccountBody(string Email, string FirstName, string LastName, string? Phone, string? InitialPassword, bool IsActive, IReadOnlyList<Guid> ProjectIds);
    public sealed record ProjectBody(string Name, string ClientName, string? Summary, string? Description, string Status, string Currency, decimal? TotalCost, DateOnly? StartedOn, DateOnly? TargetDate, string? RepositoryUrl, string? ProjectDownloadUrl, string? AdminNotes);
    public sealed record ProjectRecordBody(string Kind, string Title, string? Description, string? Status, string? DetailsJson, int SortOrder, decimal? Amount, DateOnly? DueOn, DateOnly? IssuedOn, Guid? ParentRecordId);

    [HttpGet("accounts")]
    public async Task<ActionResult> Accounts(CancellationToken ct)
    {
        var accounts = await _db.CustomSoftwarePortalAccounts
            .OrderBy(x => x.Email)
            .Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                x.Phone,
                x.IsActive,
                x.LastLoginAt,
                ProjectIds = x.ProjectAccesses.Select(a => a.ProjectId).ToList()
            })
            .ToListAsync(ct);
        return Ok(accounts);
    }

    [HttpPost("accounts")]
    public async Task<ActionResult> CreateAccount(AccountBody body, CancellationToken ct)
    {
        var email = body.Email.Trim().ToLowerInvariant();
        if (!IsValidEmail(email) || string.IsNullOrWhiteSpace(body.FirstName) || string.IsNullOrWhiteSpace(body.LastName))
            return BadRequest(new { message = "Συμπληρώστε έγκυρο email, όνομα και επώνυμο." });
        if (await _db.CustomSoftwarePortalAccounts.AnyAsync(x => x.Email == email, ct))
            return Conflict(new { message = "Υπάρχει ήδη portal λογαριασμός με αυτό το email." });
        if (body.InitialPassword is { Length: < 12 or > 200 })
            return BadRequest(new { message = "Ο κωδικός πρέπει να έχει από 12 έως 200 χαρακτήρες." });

        var projectIds = body.ProjectIds.Distinct().ToArray();
        var existingProjectIds = await _db.CustomSoftwareProjects
            .Where(x => projectIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToArrayAsync(ct);
        if (projectIds.Length != existingProjectIds.Length)
            return BadRequest(new { message = "Ένα ή περισσότερα έργα δεν βρέθηκαν." });

        var initialPassword = body.InitialPassword ?? Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18));
        var account = new CustomSoftwarePortalAccount
        {
            Email = email,
            FirstName = body.FirstName.Trim(),
            LastName = body.LastName.Trim(),
            Phone = body.Phone?.Trim(),
            PasswordHash = _passwordHasher.Hash(initialPassword),
            IsActive = body.IsActive,
            MustChangePassword = false,
            PreferencesJson = "{}"
        };
        _db.CustomSoftwarePortalAccounts.Add(account);
        foreach (var projectId in projectIds)
            _db.CustomSoftwareProjectAccesses.Add(new CustomSoftwareProjectAccess { AccountId = account.Id, ProjectId = projectId });
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            account.Id,
            account.Email,
            account.FirstName,
            account.LastName,
            InitialPassword = initialPassword,
            ProjectIds = projectIds
        });
    }

    [HttpPut("accounts/{accountId:guid}")]
    public async Task<ActionResult> UpdateAccount(Guid accountId, AccountBody body, CancellationToken ct)
    {
        var account = await _db.CustomSoftwarePortalAccounts
            .Include(x => x.ProjectAccesses)
            .SingleOrDefaultAsync(x => x.Id == accountId, ct);
        if (account is null) return NotFound();

        var email = body.Email.Trim().ToLowerInvariant();
        if (!IsValidEmail(email) || await _db.CustomSoftwarePortalAccounts.AnyAsync(x => x.Id != accountId && x.Email == email, ct))
            return BadRequest(new { message = "Το email δεν είναι έγκυρο ή χρησιμοποιείται ήδη." });
        if (body.InitialPassword is { Length: < 12 or > 200 })
            return BadRequest(new { message = "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες." });

        var projectIds = body.ProjectIds.Distinct().ToArray();
        var existingProjectIds = await _db.CustomSoftwareProjects.Where(x => projectIds.Contains(x.Id)).Select(x => x.Id).ToArrayAsync(ct);
        if (projectIds.Length != existingProjectIds.Length)
            return BadRequest(new { message = "Ένα ή περισσότερα έργα δεν βρέθηκαν." });

        account.Email = email;
        account.FirstName = body.FirstName.Trim();
        account.LastName = body.LastName.Trim();
        account.Phone = body.Phone?.Trim();
        account.IsActive = body.IsActive;
        foreach (var access in account.ProjectAccesses.ToArray()) _db.CustomSoftwareProjectAccesses.Remove(access);
        foreach (var projectId in projectIds)
            _db.CustomSoftwareProjectAccesses.Add(new CustomSoftwareProjectAccess { AccountId = account.Id, ProjectId = projectId });
        if (!string.IsNullOrWhiteSpace(body.InitialPassword))
        {
            account.PasswordHash = _passwordHasher.Hash(body.InitialPassword);
            account.MustChangePassword = false;
            account.SessionVersion++;
        }
        if (!account.IsActive) account.SessionVersion++;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("accounts/{accountId:guid}")]
    public async Task<ActionResult> DeactivateAccount(Guid accountId, CancellationToken ct)
    {
        var account = await _db.CustomSoftwarePortalAccounts.SingleOrDefaultAsync(x => x.Id == accountId, ct);
        if (account is null) return NotFound();
        account.IsActive = false;
        account.SessionVersion++;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("projects")]
    public async Task<ActionResult> Projects(CancellationToken ct)
    {
        var projects = await _db.CustomSoftwareProjects
            .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.ClientName,
                x.Summary,
                x.Description,
                x.Status,
                x.Currency,
                x.TotalCost,
                x.StartedOn,
                x.TargetDate,
                x.RepositoryUrl,
                x.ProjectDownloadUrl,
                x.AdminNotes,
                UserIds = x.UserAccesses.Select(a => a.AccountId).ToList(),
                Records = x.Records.OrderBy(r => r.SortOrder).ThenBy(r => r.CreatedAt)
                    .Select(r => new CustomSoftwarePortalController.ProjectRecordDto(
                        r.Id, r.ParentRecordId, r.Kind, r.Title, r.Description, r.Status,
                        r.DetailsJson, r.SortOrder, r.Amount, r.DueOn, r.IssuedOn,
                        r.StorageKey != null, r.FileName, r.ContentType, r.SizeBytes))
                    .ToList()
            })
            .ToListAsync(ct);
        return Ok(projects);
    }

    [HttpPost("projects")]
    public async Task<ActionResult> CreateProject(ProjectBody body, CancellationToken ct)
    {
        var error = ValidateProject(body);
        if (error is not null) return BadRequest(new { message = error });
        var project = new CustomSoftwareProject();
        ApplyProject(project, body);
        _db.CustomSoftwareProjects.Add(project);
        await _db.SaveChangesAsync(ct);
        return Ok(ProjectView(project, []));
    }

    [HttpPut("projects/{projectId:guid}")]
    public async Task<ActionResult> UpdateProject(Guid projectId, ProjectBody body, CancellationToken ct)
    {
        var project = await _db.CustomSoftwareProjects.SingleOrDefaultAsync(x => x.Id == projectId, ct);
        if (project is null) return NotFound();
        var error = ValidateProject(body);
        if (error is not null) return BadRequest(new { message = error });
        ApplyProject(project, body);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("projects/{projectId:guid}")]
    public async Task<ActionResult> DeleteProject(Guid projectId, CancellationToken ct)
    {
        var project = await _db.CustomSoftwareProjects.SingleOrDefaultAsync(x => x.Id == projectId, ct);
        if (project is null) return NotFound();
        var records = await _db.CustomSoftwareProjectRecords.Where(x => x.ProjectId == projectId).ToListAsync(ct);
        foreach (var record in records)
        {
            if (record.StorageKey is not null) await _fileStorage.DeleteAsync(record.StorageKey, ct);
            record.DeletedAt = DateTime.UtcNow;
        }
        var accesses = await _db.CustomSoftwareProjectAccesses.Where(x => x.ProjectId == projectId).ToListAsync(ct);
        foreach (var access in accesses) access.DeletedAt = DateTime.UtcNow;
        project.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("projects/{projectId:guid}/records")]
    public async Task<ActionResult> CreateRecord(Guid projectId, ProjectRecordBody body, CancellationToken ct)
    {
        if (!await _db.CustomSoftwareProjects.AnyAsync(x => x.Id == projectId, ct)) return NotFound();
        var error = ValidateRecord(body);
        if (error is not null) return BadRequest(new { message = error });
        if (body.ParentRecordId is Guid parentId && !await _db.CustomSoftwareProjectRecords.AnyAsync(x => x.Id == parentId && x.ProjectId == projectId, ct))
            return BadRequest(new { message = "Η φάση ή το στοιχείο αναφοράς δεν βρέθηκε." });
        var record = new CustomSoftwareProjectRecord { ProjectId = projectId };
        ApplyRecord(record, body);
        _db.CustomSoftwareProjectRecords.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(RecordView(record));
    }

    [HttpPut("projects/{projectId:guid}/records/{recordId:guid}")]
    public async Task<ActionResult> UpdateRecord(Guid projectId, Guid recordId, ProjectRecordBody body, CancellationToken ct)
    {
        var record = await _db.CustomSoftwareProjectRecords.SingleOrDefaultAsync(x => x.Id == recordId && x.ProjectId == projectId, ct);
        if (record is null) return NotFound();
        var error = ValidateRecord(body);
        if (error is not null) return BadRequest(new { message = error });
        if (body.ParentRecordId is Guid parentId && !await _db.CustomSoftwareProjectRecords.AnyAsync(x => x.Id == parentId && x.ProjectId == projectId && x.Id != recordId, ct))
            return BadRequest(new { message = "Η φάση ή το στοιχείο αναφοράς δεν βρέθηκε." });
        ApplyRecord(record, body);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("projects/{projectId:guid}/records/{recordId:guid}")]
    public async Task<ActionResult> DeleteRecord(Guid projectId, Guid recordId, CancellationToken ct)
    {
        var record = await _db.CustomSoftwareProjectRecords.SingleOrDefaultAsync(x => x.Id == recordId && x.ProjectId == projectId, ct);
        if (record is null) return NotFound();
        if (record.StorageKey is not null) await _fileStorage.DeleteAsync(record.StorageKey, ct);
        record.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("projects/{projectId:guid}/documents")]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<ActionResult> UploadDocument(Guid projectId, IFormFile file, [FromForm] string kind, [FromForm] string title, [FromForm] string? description, [FromForm] decimal? amount, [FromForm] DateOnly? dueOn, [FromForm] DateOnly? issuedOn, [FromForm] Guid? parentRecordId, CancellationToken ct)
    {
        if (!await _db.CustomSoftwareProjects.AnyAsync(x => x.Id == projectId, ct)) return NotFound();
        if (file.Length is <= 0 or > MaxUploadBytes) return BadRequest(new { message = "Το αρχείο πρέπει να είναι έως 25 MB." });
        if (!AllowedDocumentKinds.Contains(kind)) return BadRequest(new { message = "Μη έγκυρη κατηγορία αρχείου." });
        if (string.IsNullOrWhiteSpace(title) || title.Length > 300) return BadRequest(new { message = "Συμπληρώστε τίτλο έως 300 χαρακτήρες." });
        if (parentRecordId is Guid parent && !await _db.CustomSoftwareProjectRecords.AnyAsync(x => x.Id == parent && x.ProjectId == projectId, ct))
            return BadRequest(new { message = "Η φάση αναφοράς δεν βρέθηκε." });

        FileSafetyResult inspection;
        await using (var validationStream = file.OpenReadStream())
        {
            inspection = await _fileSafety.InspectAsync(
                file.FileName, file.ContentType, validationStream, FileUploadKind.Document, ct);
        }
        if (!inspection.Allowed) return BadRequest(new { message = inspection.RejectionMessage ?? "Ο τύπος αρχείου δεν επιτρέπεται." });

        string storageKey;
        await using (var stream = file.OpenReadStream())
        {
            storageKey = await _fileStorage.UploadAsync(
                $"custom-software-projects/{projectId:N}",
                Path.GetFileName(file.FileName),
                inspection.DetectedContentType ?? file.ContentType,
                stream,
                ct);
        }

        var record = new CustomSoftwareProjectRecord
        {
            ProjectId = projectId,
            ParentRecordId = parentRecordId,
            Kind = kind,
            Title = title.Trim(),
            Description = description?.Trim(),
            Amount = amount,
            DueOn = dueOn,
            IssuedOn = issuedOn,
            StorageKey = storageKey,
            FileName = Path.GetFileName(file.FileName),
            ContentType = inspection.DetectedContentType ?? file.ContentType,
            SizeBytes = file.Length
        };
        _db.CustomSoftwareProjectRecords.Add(record);
        await _db.SaveChangesAsync(ct);
        return Ok(RecordView(record));
    }

    private static readonly HashSet<string> AllowedDocumentKinds =
        new(StringComparer.OrdinalIgnoreCase) { "contract", "deliverable", "invoice", "project-file" };

    private static string? ValidateProject(ProjectBody body)
    {
        if (string.IsNullOrWhiteSpace(body.Name) || body.Name.Length > 200
            || string.IsNullOrWhiteSpace(body.ClientName) || body.ClientName.Length > 200)
            return "Συμπληρώστε όνομα έργου και πελάτη.";
        if (body.TotalCost < 0 || body.Currency.Length != 3)
            return "Ελέγξτε το κόστος και το νόμισμα.";
        if (!ValidOptionalUrl(body.RepositoryUrl) || !ValidOptionalUrl(body.ProjectDownloadUrl))
            return "Οι σύνδεσμοι πρέπει να είναι έγκυρα HTTPS URLs.";
        return null;
    }

    private static string? ValidateRecord(ProjectRecordBody body)
    {
        var kind = body.Kind.Trim().ToLowerInvariant();
        if (!RecordKinds.Contains(kind)) return "Μη έγκυρος τύπος στοιχείου έργου.";
        if (string.IsNullOrWhiteSpace(body.Title) || body.Title.Length > 300) return "Ο τίτλος είναι υποχρεωτικός.";
        if (body.Amount < 0) return "Το ποσό δεν μπορεί να είναι αρνητικό.";
        if (body.DetailsJson is not null)
        {
            try
            {
                using var details = JsonDocument.Parse(body.DetailsJson);
                if (details.RootElement.ValueKind != JsonValueKind.Object)
                    return "Οι πρόσθετες λεπτομέρειες πρέπει να είναι αντικείμενο JSON.";
            }
            catch (JsonException) { return "Οι πρόσθετες λεπτομέρειες δεν έχουν έγκυρη μορφή JSON."; }
        }
        return null;
    }

    private static readonly HashSet<string> RecordKinds =
        new(StringComparer.OrdinalIgnoreCase) { "phase", "milestone", "deliverable", "team", "cost", "note" };

    private static bool ValidOptionalUrl(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps);

    private static bool IsValidEmail(string email) =>
        email.Length <= 320 && System.Net.Mail.MailAddress.TryCreate(email, out var parsed) && parsed.Address == email;

    private static void ApplyProject(CustomSoftwareProject project, ProjectBody body)
    {
        project.Name = body.Name.Trim();
        project.ClientName = body.ClientName.Trim();
        project.Summary = body.Summary?.Trim();
        project.Description = body.Description?.Trim();
        project.Status = body.Status.Trim().ToLowerInvariant();
        project.Currency = body.Currency.Trim().ToUpperInvariant();
        project.TotalCost = body.TotalCost;
        project.StartedOn = body.StartedOn;
        project.TargetDate = body.TargetDate;
        project.RepositoryUrl = string.IsNullOrWhiteSpace(body.RepositoryUrl) ? null : body.RepositoryUrl.Trim();
        project.ProjectDownloadUrl = string.IsNullOrWhiteSpace(body.ProjectDownloadUrl) ? null : body.ProjectDownloadUrl.Trim();
        project.AdminNotes = body.AdminNotes?.Trim();
    }

    private static void ApplyRecord(CustomSoftwareProjectRecord record, ProjectRecordBody body)
    {
        record.Kind = body.Kind.Trim().ToLowerInvariant();
        record.Title = body.Title.Trim();
        record.Description = body.Description?.Trim();
        record.Status = body.Status?.Trim();
        record.DetailsJson = body.DetailsJson;
        record.SortOrder = body.SortOrder;
        record.Amount = body.Amount;
        record.DueOn = body.DueOn;
        record.IssuedOn = body.IssuedOn;
        record.ParentRecordId = body.ParentRecordId;
    }

    private static object ProjectView(CustomSoftwareProject x, IReadOnlyList<Guid> userIds) => new
    {
        x.Id, x.Name, x.ClientName, x.Summary, x.Description, x.Status, x.Currency,
        x.TotalCost, x.StartedOn, x.TargetDate, x.RepositoryUrl, x.ProjectDownloadUrl, x.AdminNotes, UserIds = userIds
    };

    private static object RecordView(CustomSoftwareProjectRecord r) => new
    {
        r.Id, r.ProjectId, r.ParentRecordId, r.Kind, r.Title, r.Description, r.Status,
        r.DetailsJson, r.SortOrder, r.Amount, r.DueOn, r.IssuedOn, HasFile = r.StorageKey != null,
        r.FileName, r.ContentType, r.SizeBytes
    };
}
