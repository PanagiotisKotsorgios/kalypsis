using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Registration/check endpoints used by Kalypsis Desktop and the complete
/// Platform Admin surface for annual Desktop access and payment history.
/// </summary>
[ApiController]
[Route("api")]
public sealed class DesktopLicensesController : ControllerBase
{
    private const int WarningDays = 20;
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public DesktopLicensesController(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    public sealed record RegisterDesktopRequest(
        [Required, StringLength(64, MinimumLength = 20)] string InstallationId,
        [Required, StringLength(200, MinimumLength = 2)] string CompanyName,
        [Required, StringLength(160, MinimumLength = 2)] string ContactName,
        [Required, EmailAddress, StringLength(254)] string Email,
        [StringLength(40)] string? Phone,
        [StringLength(30)] string? AfmVat,
        [StringLength(160)] string? MachineName,
        [StringLength(240)] string? OsVersion,
        [StringLength(40)] string? AppVersion);

    public sealed record CheckDesktopRequest(
        [Required, StringLength(64, MinimumLength = 20)] string InstallationId,
        [StringLength(160)] string? MachineName,
        [StringLength(240)] string? OsVersion,
        [StringLength(40)] string? AppVersion);

    public sealed record DesktopLicenseStatusResponse(
        string Status,
        bool CanUse,
        string RegistrationCode,
        string CompanyName,
        DateTime? AccessStartsAtUtc,
        DateTime? AccessExpiresAtUtc,
        int? DaysRemaining,
        int WarningDays,
        decimal AnnualPrice,
        string Currency,
        string PaymentUrl,
        string Message);

    [AllowAnonymous]
    [EnableRateLimiting("desktop-license-register")]
    [HttpPost("public/desktop-license/register")]
    public async Task<ActionResult<DesktopLicenseStatusResponse>> Register(
        [FromBody] RegisterDesktopRequest request,
        CancellationToken cancellationToken)
    {
        var token = ReadClientToken();
        if (token is null)
            return Unauthorized(new { message = "Λείπει το μυστικό αναγνωριστικό της εγκατάστασης." });

        var installationId = request.InstallationId.Trim();
        var tokenHash = HashToken(token);
        var license = await _db.DesktopLicenses.IgnoreQueryFilters()
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.InstallationId == installationId && x.DeletedAt == null, cancellationToken);

        if (license is not null && !TokenMatches(license.ClientTokenHash, tokenHash))
            return Conflict(new { message = "Η εγκατάσταση είναι ήδη καταχωρημένη με διαφορετικό αναγνωριστικό. Επικοινωνήστε με την Kalypsis." });

        if (license is null)
        {
            license = new DesktopLicense
            {
                Id = Guid.NewGuid(),
                RegistrationCode = await NewRegistrationCodeAsync(cancellationToken),
                InstallationId = installationId,
                ClientTokenHash = tokenHash,
                AnnualPrice = DefaultAnnualPrice(),
                Currency = DefaultCurrency()
            };
            _db.DesktopLicenses.Add(license);
        }

        license.CompanyName = request.CompanyName.Trim();
        license.ContactName = request.ContactName.Trim();
        license.Email = request.Email.Trim().ToLowerInvariant();
        license.Phone = Clean(request.Phone);
        license.AfmVat = Clean(request.AfmVat);
        license.MachineName = Clean(request.MachineName);
        license.OsVersion = Clean(request.OsVersion);
        license.AppVersion = Clean(request.AppVersion);
        license.LastSeenAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ToStatus(license));
    }

    [AllowAnonymous]
    [EnableRateLimiting("desktop-license-check")]
    [HttpPost("public/desktop-license/check")]
    public async Task<ActionResult<DesktopLicenseStatusResponse>> Check(
        [FromBody] CheckDesktopRequest request,
        CancellationToken cancellationToken)
    {
        var token = ReadClientToken();
        if (token is null)
            return Unauthorized(new { message = "Λείπει το μυστικό αναγνωριστικό της εγκατάστασης." });

        var tokenHash = HashToken(token);
        var license = await _db.DesktopLicenses.IgnoreQueryFilters()
            .Include(x => x.Payments.Where(p => p.DeletedAt == null))
            .FirstOrDefaultAsync(x => x.InstallationId == request.InstallationId.Trim() && x.DeletedAt == null, cancellationToken);

        if (license is null || !TokenMatches(license.ClientTokenHash, tokenHash))
            return Unauthorized(new { message = "Η άδεια της εγκατάστασης δεν αναγνωρίστηκε." });

        license.MachineName = Clean(request.MachineName) ?? license.MachineName;
        license.OsVersion = Clean(request.OsVersion) ?? license.OsVersion;
        license.AppVersion = Clean(request.AppVersion) ?? license.AppVersion;
        license.LastSeenAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(ToStatus(license));
    }

    public sealed record DesktopPaymentResponse(
        Guid Id,
        decimal Amount,
        string Currency,
        DateTime PaidAtUtc,
        DateTime AccessStartsAtUtc,
        DateTime AccessExpiresAtUtc,
        string? PaymentMethod,
        string? Reference,
        string? Notes);

    public sealed record DesktopLicenseAdminResponse(
        Guid Id,
        string RegistrationCode,
        string Status,
        string CompanyName,
        string ContactName,
        string Email,
        string? Phone,
        string? AfmVat,
        string? MachineName,
        string? OsVersion,
        string? AppVersion,
        DateTime? LastSeenAtUtc,
        decimal AnnualPrice,
        string Currency,
        DateTime? AccessStartsAtUtc,
        DateTime? AccessExpiresAtUtc,
        int? DaysRemaining,
        bool IsBlocked,
        string? BlockReason,
        string? AdminNotes,
        DateTime CreatedAt,
        IReadOnlyList<DesktopPaymentResponse> Payments);

    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/desktop-licenses")]
    public async Task<ActionResult<IReadOnlyList<DesktopLicenseAdminResponse>>> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = _db.DesktopLicenses.IgnoreQueryFilters()
            .Where(x => x.DeletedAt == null)
            .Include(x => x.Payments.Where(p => p.DeletedAt == null))
            .AsSplitQuery()
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.CompanyName.Contains(term)
                || x.ContactName.Contains(term)
                || x.Email.Contains(term)
                || x.RegistrationCode.Contains(term));
        }

        var licenses = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(cancellationToken);
        var result = licenses.Select(ToAdmin).ToList();
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            result = result.Where(x => x.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        return Ok(result);
    }

    public sealed record RecordPaymentRequest(
        [Range(0.01, 1000000)] decimal Amount,
        [StringLength(8)] string? Currency,
        DateTime? PaidAtUtc,
        DateTime? AccessStartsAtUtc,
        [StringLength(80)] string? PaymentMethod,
        [StringLength(120)] string? Reference,
        [StringLength(1000)] string? Notes);

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/desktop-licenses/{id:guid}/payments")]
    public async Task<ActionResult<DesktopLicenseAdminResponse>> RecordPayment(
        Guid id,
        [FromBody] RecordPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var license = await FindLicenseAsync(id, cancellationToken);
        var paidAt = NormalizeUtc(request.PaidAtUtc ?? DateTime.UtcNow);
        var startsAt = NormalizeUtc(request.AccessStartsAtUtc ?? paidAt);
        if (startsAt > DateTime.UtcNow.AddMinutes(5))
            return BadRequest(new { message = "Η έναρξη πρόσβασης δεν μπορεί να είναι μελλοντική." });
        var expiresAt = startsAt.AddDays(365);
        var currency = NormalizeCurrency(request.Currency ?? license.Currency);

        license.AnnualPrice = request.Amount;
        license.Currency = currency;
        license.AccessStartsAtUtc = startsAt;
        license.AccessExpiresAtUtc = expiresAt;
        license.IsBlocked = false;
        license.BlockReason = null;
        var payment = new DesktopLicensePayment
        {
            Id = Guid.NewGuid(),
            DesktopLicenseId = license.Id,
            DesktopLicense = license,
            Amount = request.Amount,
            Currency = currency,
            PaidAtUtc = paidAt,
            AccessStartsAtUtc = startsAt,
            AccessExpiresAtUtc = expiresAt,
            PaymentMethod = Clean(request.PaymentMethod),
            Reference = Clean(request.Reference),
            Notes = Clean(request.Notes),
            RecordedByUserId = CurrentUserId()
        };
        _db.DesktopLicensePayments.Add(payment);
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToAdmin(license));
    }

    public sealed record UpdateDesktopLicenseRequest(
        bool? IsBlocked,
        [StringLength(500)] string? BlockReason,
        [Range(0.01, 1000000)] decimal? AnnualPrice,
        [StringLength(8)] string? Currency,
        [StringLength(1000)] string? AdminNotes,
        [StringLength(200)] string? CompanyName,
        [StringLength(160)] string? ContactName,
        [EmailAddress, StringLength(254)] string? Email,
        [StringLength(40)] string? Phone);

    [Authorize(Policy = "PlatformAdmin")]
    [HttpPatch("platform/desktop-licenses/{id:guid}")]
    public async Task<ActionResult<DesktopLicenseAdminResponse>> Update(
        Guid id,
        [FromBody] UpdateDesktopLicenseRequest request,
        CancellationToken cancellationToken)
    {
        var license = await FindLicenseAsync(id, cancellationToken);
        if (request.IsBlocked.HasValue) license.IsBlocked = request.IsBlocked.Value;
        if (request.BlockReason is not null) license.BlockReason = Clean(request.BlockReason);
        if (request.AnnualPrice.HasValue) license.AnnualPrice = request.AnnualPrice.Value;
        if (request.Currency is not null) license.Currency = NormalizeCurrency(request.Currency);
        if (request.AdminNotes is not null) license.AdminNotes = Clean(request.AdminNotes);
        if (request.CompanyName is not null) license.CompanyName = request.CompanyName.Trim();
        if (request.ContactName is not null) license.ContactName = request.ContactName.Trim();
        if (request.Email is not null) license.Email = request.Email.Trim().ToLowerInvariant();
        if (request.Phone is not null) license.Phone = Clean(request.Phone);
        if (request.IsBlocked == false) license.BlockReason = null;
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(ToAdmin(license));
    }

    private async Task<DesktopLicense> FindLicenseAsync(Guid id, CancellationToken cancellationToken)
        => await _db.DesktopLicenses.IgnoreQueryFilters()
            .Include(x => x.Payments.Where(p => p.DeletedAt == null))
            .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt == null, cancellationToken)
            ?? throw new KeyNotFoundException("Desktop license not found.");

    private DesktopLicenseStatusResponse ToStatus(DesktopLicense license)
    {
        var (status, canUse, days, message) = State(license);
        return new DesktopLicenseStatusResponse(
            status, canUse, license.RegistrationCode, license.CompanyName,
            license.AccessStartsAtUtc, license.AccessExpiresAtUtc, days, WarningDays,
            license.AnnualPrice, license.Currency, PaymentUrl(), message);
    }

    private DesktopLicenseAdminResponse ToAdmin(DesktopLicense license)
    {
        var (status, _, days, _) = State(license);
        return new DesktopLicenseAdminResponse(
            license.Id, license.RegistrationCode, status, license.CompanyName,
            license.ContactName, license.Email, license.Phone, license.AfmVat,
            license.MachineName, license.OsVersion, license.AppVersion, license.LastSeenAtUtc,
            license.AnnualPrice, license.Currency, license.AccessStartsAtUtc,
            license.AccessExpiresAtUtc, days, license.IsBlocked, license.BlockReason,
            license.AdminNotes, license.CreatedAt,
            license.Payments.OrderByDescending(x => x.PaidAtUtc).Select(x => new DesktopPaymentResponse(
                x.Id, x.Amount, x.Currency, x.PaidAtUtc, x.AccessStartsAtUtc,
                x.AccessExpiresAtUtc, x.PaymentMethod, x.Reference, x.Notes)).ToList());
    }

    private static (string Status, bool CanUse, int? Days, string Message) State(DesktopLicense license)
    {
        if (license.IsBlocked)
            return ("Blocked", false, null, string.IsNullOrWhiteSpace(license.BlockReason)
                ? "Η πρόσβαση έχει ανασταλεί από την Kalypsis."
                : license.BlockReason);

        if (!license.AccessExpiresAtUtc.HasValue)
            return ("PendingPayment", false, null, "Η εγγραφή ολοκληρώθηκε. Απαιτείται πληρωμή και ενεργοποίηση από την Kalypsis.");

        var now = DateTime.UtcNow;
        if (license.AccessStartsAtUtc.HasValue && NormalizeUtc(license.AccessStartsAtUtc.Value) > now)
            return ("PendingPayment", false, null, "Η πληρωμή έχει καταχωρηθεί, αλλά η περίοδος πρόσβασης δεν έχει ξεκινήσει ακόμη.");

        var expires = NormalizeUtc(license.AccessExpiresAtUtc.Value);
        var remaining = Math.Max(0, (int)Math.Ceiling((expires - now).TotalDays));
        if (expires <= now)
            return ("Expired", false, 0, "Η ετήσια πρόσβαση έληξε. Απαιτείται ανανέωση για να συνεχίσετε.");
        if (remaining <= WarningDays)
            return ("Expiring", true, remaining, $"Η ετήσια πρόσβαση λήγει σε {remaining} ημέρες. Προγραμματίστε την ανανέωσή της.");
        return ("Active", true, remaining, "Η ετήσια πρόσβαση είναι ενεργή.");
    }

    private string? ReadClientToken()
    {
        var token = Request.Headers["X-Kalypsis-Desktop-Token"].FirstOrDefault()?.Trim();
        return token is { Length: >= 32 and <= 256 } ? token : null;
    }

    private static string HashToken(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static bool TokenMatches(string expectedHash, string actualHash)
    {
        if (expectedHash.Length != actualHash.Length) return false;
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expectedHash), Encoding.ASCII.GetBytes(actualHash));
    }

    private async Task<string> NewRegistrationCodeAsync(CancellationToken cancellationToken)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var bytes = RandomNumberGenerator.GetBytes(10);
            var chars = bytes.Select(b => alphabet[b % alphabet.Length]).ToArray();
            var code = $"KD-{new string(chars, 0, 5)}-{new string(chars, 5, 5)}";
            if (!await _db.DesktopLicenses.IgnoreQueryFilters().AnyAsync(x => x.RegistrationCode == code, cancellationToken))
                return code;
        }
        throw new InvalidOperationException("Could not allocate a Desktop registration code.");
    }

    private decimal DefaultAnnualPrice()
        => decimal.TryParse(_configuration["DesktopLicensing:DefaultAnnualPrice"], NumberStyles.Number, CultureInfo.InvariantCulture, out var price)
            && price >= 0 ? price : 0m;

    private string DefaultCurrency() => NormalizeCurrency(_configuration["DesktopLicensing:Currency"] ?? "EUR");
    private string PaymentUrl() => _configuration["DesktopLicensing:PaymentUrl"]?.Trim() ?? "https://mykalypsis.gr/contact";
    private static string NormalizeCurrency(string value) => string.IsNullOrWhiteSpace(value) ? "EUR" : value.Trim().ToUpperInvariant()[..Math.Min(8, value.Trim().Length)];
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    private Guid? CurrentUserId()
        => Guid.TryParse(User.FindFirstValue("sub"), out var id) ? id : null;
}
