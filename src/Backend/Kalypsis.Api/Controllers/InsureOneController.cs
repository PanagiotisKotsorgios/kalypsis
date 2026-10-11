using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Auth;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// InsureOne's first partner-desk slice. Public slug discovery/login is kept
/// separate from the authenticated office administration endpoints, while it
/// still issues the same central Kalypsis JWT and refresh-token session.
/// </summary>
[ApiController]
[Route("api/insureone")]
public sealed class InsureOneController : ControllerBase
{
    private static readonly string[] DefaultPermissions =
    [
        "quoting.read", "quoting.create", "quotes.save", "quotes.history", "quotes.export"
    ];

    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IPasswordHasher _hasher;
    private readonly IPackageService _packages;
    private readonly IMediator _mediator;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _uploadGate;
    private readonly ICarrierAdapterRegistry _carrierAdapters;
    private readonly IDateTimeProvider _clock;

    public InsureOneController(
        AppDbContext db,
        ICurrentUser current,
        IPasswordHasher hasher,
        IPackageService packages,
        IMediator mediator,
        IFileStorage storage,
        FileUploadGate uploadGate,
        ICarrierAdapterRegistry carrierAdapters,
        IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _hasher = hasher;
        _packages = packages;
        _mediator = mediator;
        _storage = storage;
        _uploadGate = uploadGate;
        _carrierAdapters = carrierAdapters;
        _clock = clock;
    }

    [HttpGet("public/{slug}")]
    [AllowAnonymous]
    public async Task<ActionResult<InsureOneBrandingDto>> PublicBranding(string slug, CancellationToken ct)
    {
        var settings = await FindSettings(slug, ct);
        if (settings is null || !settings.IsEnabled)
            return NotFound(new { code = "insureone_not_available", message = "Η σελίδα InsureOne δεν είναι διαθέσιμη." });

        return Ok(ToBranding(settings));
    }

    [HttpGet("public/{slug}/logo")]
    [AllowAnonymous]
    public async Task<IActionResult> PublicLogo(string slug, CancellationToken ct)
    {
        var settings = await FindSettings(slug, ct);
        if (settings is null || !settings.IsEnabled || string.IsNullOrWhiteSpace(settings.LogoPath))
            return NoContent();

        try
        {
            var stream = await _storage.DownloadAsync(settings.LogoPath, ct);
            var fileName = Path.GetFileName(settings.LogoPath);
            return File(stream, GuessMime(fileName), fileName);
        }
        catch (FileNotFoundException) { return NoContent(); }
        catch (DirectoryNotFoundException) { return NoContent(); }
    }

    [HttpPost("public/{slug}/login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<LoginResponse>> PartnerLogin(
        string slug,
        [FromBody] InsureOneLoginRequest request,
        CancellationToken ct)
    {
        var settings = await FindSettings(slug, ct);
        if (settings is null || !settings.IsEnabled)
            throw AppException.Unauthorized("Δεν ήταν δυνατή η σύνδεση στο InsureOne.");

        var identifier = request.Identifier?.Trim() ?? string.Empty;
        if (identifier.Length == 0 || string.IsNullOrWhiteSpace(request.Password))
            throw AppException.Unauthorized("Λανθασμένα στοιχεία σύνδεσης.");
        var access = await _db.PartnerPortalAccesses
            .IgnoreQueryFilters()
            .Include(x => x.User)
            .Where(x => x.TenantId == settings.TenantId
                && x.AgencyOfficeScopeId == settings.AgencyOfficeId
                && x.IsActive
                && x.DeletedAt == null
                && x.UserId != null
                && (x.LoginCode == identifier || x.User!.Email == identifier.ToLower()))
            .FirstOrDefaultAsync(ct);

        // Keep the same generic response for an unknown identifier and a bad
        // password. The central LoginCommand still applies lockout, 2FA,
        // email-code and audit rules to the resolved user.
        if (access?.User is null || !access.User.IsActive)
            throw AppException.Unauthorized("Λανθασμένα στοιχεία σύνδεσης.");

        if (!await _packages.HasAsync(settings.TenantId, PackageCode.FrontOffice, ct))
            throw new AppException("package_not_licensed", "Το InsureOne δεν είναι ενεργό για το συγκεκριμένο γραφείο.", 403);

        var login = await _mediator.Send(new LoginCommand(
            access.User.Email,
            request.Password,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString()), ct);

        if (!login.RequiresTwoFactor && !login.RequiresEmailCode)
        {
            access.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return Ok(login);
    }

    [HttpGet("me")]
    [Authorize(Policy = "InsureOnePartner")]
    public async Task<ActionResult<InsureOnePartnerMeDto>> Me(CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var access = await _db.PartnerPortalAccesses
            .Include(x => x.Producer)
            .Include(x => x.User)
            .Where(x => x.UserId == userId && x.IsActive)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.Forbidden("Δεν υπάρχει ενεργή πρόσβαση InsureOne για τον χρήστη.");

        var settings = await _db.InsureOneOfficeSettings
            .Include(x => x.AgencyOffice)
            .FirstOrDefaultAsync(x => x.AgencyOfficeId == access.AgencyOfficeScopeId, ct);
        if (settings is null || !settings.IsEnabled)
            throw AppException.Forbidden("Το InsureOne δεν είναι ενεργό για το γραφείο σας.");

        return Ok(new InsureOnePartnerMeDto(
            access.Id,
            access.LoginCode ?? access.User?.Email ?? string.Empty,
            access.Producer.Name,
            settings.AgencyOffice.Name,
            ToBranding(settings),
            ParsePermissions(access.PermissionsJson)));
    }

    /// <summary>
    /// Phase 2 partner workspace summary.  The query is deliberately scoped
    /// to the authenticated partner, not merely the tenant: two sub-users of
    /// the same office must never see each other's quotation history.
    /// </summary>
    [HttpGet("workspace")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneWorkspaceDto>> Workspace(CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quoting.read", ct);
        var userId = access.UserId!.Value;
        var quotes = _db.Quotes.AsNoTracking()
            .Where(x => x.TenantId == settings.TenantId && x.CreatedByUserId == userId);
        var now = _clock.UtcNow;
        var total = await quotes.CountAsync(ct);
        var month = await quotes.CountAsync(x => x.CreatedAt >= new DateTime(now.Year, now.Month, 1), ct);
        var active = await quotes.CountAsync(x => x.Status == QuoteStatus.Quoted || x.Status == QuoteStatus.Bound, ct);
        var expiring = await quotes.CountAsync(x => x.ExpiresAt != null && x.ExpiresAt >= now && x.ExpiresAt <= now.AddDays(7), ct);
        return Ok(new InsureOneWorkspaceDto(total, month, active, expiring,
            ParsePermissions(access.PermissionsJson), access.CanIssuePolicies, access.CanViewCustomers,
            settings.Slug, settings.DisplayName ?? settings.AgencyOffice.Name));
    }

    [HttpGet("customers")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<IReadOnlyList<InsureOneCustomerDto>>> Customers([FromQuery] string? search, CancellationToken ct)
    {
        var (access, _) = await ResolvePartnerAsync("customers.read", ct);
        if (!access.CanViewCustomers) throw AppException.Forbidden("Δεν έχετε δικαίωμα προβολής πελατών.");
        var term = (search ?? string.Empty).Trim();
        var query = _db.Customers.AsNoTracking().Where(x => x.DeletedAt == null);
        if (term.Length > 0)
            query = query.Where(x => (x.FirstName + " " + x.LastName).Contains(term) || (x.Email ?? "").Contains(term) || (x.Phone ?? "").Contains(term));
        var rows = await query.OrderBy(x => x.LastName).ThenBy(x => x.FirstName).Take(30)
            .Select(x => new InsureOneCustomerDto(x.Id, (x.FirstName + " " + x.LastName).Trim(), x.Email, x.Phone))
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpGet("quotes")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneQuotePageDto>> Quotes(
        [FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? productType,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var (access, settings) = await ResolvePartnerAsync("quotes.history", ct);
        var userId = access.UserId!.Value;
        page = Math.Clamp(page, 1, 10_000);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = _db.Quotes.AsNoTracking().Include(x => x.Customer).Include(x => x.Offers)
            .Where(x => x.TenantId == settings.TenantId && x.CreatedByUserId == userId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuoteStatus>(status, true, out var parsedStatus)) query = query.Where(x => x.Status == parsedStatus);
        if (!string.IsNullOrWhiteSpace(productType)) query = query.Where(x => x.ProductType == productType.Trim());
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(x => x.QuoteNumber.Contains(s) || x.ProductType.Contains(s)
                || (x.Customer != null && ((x.Customer.FirstName + " " + x.Customer.LastName).Contains(s) || (x.Customer.Email ?? "").Contains(s))));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Ok(new InsureOneQuotePageDto(rows.Select(ToQuote).ToList(), total, page, pageSize));
    }

    [HttpGet("quotes/{id:guid}")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneQuoteDto>> Quote(Guid id, CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quotes.history", ct);
        var row = await _db.Quotes.AsNoTracking().Include(x => x.Customer).Include(x => x.Offers)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == settings.TenantId && x.CreatedByUserId == access.UserId, ct)
            ?? throw AppException.NotFound("Προσφορά");
        return Ok(ToQuote(row));
    }

    [HttpPost("quotes")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneQuoteDto>> CreateQuote([FromBody] InsureOneCreateQuoteRequest request, CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quoting.create", ct);
        if (string.IsNullOrWhiteSpace(request.ProductType) || request.ProductType.Length > 50)
            throw AppException.Validation("Επιλέξτε κλάδο ασφάλισης.");
        if (string.IsNullOrWhiteSpace(request.RiskInputsJson) || request.RiskInputsJson.Length > 30_000)
            throw AppException.Validation("Τα στοιχεία κινδύνου δεν είναι έγκυρα.");
        try { using var _ = JsonDocument.Parse(request.RiskInputsJson); }
        catch { throw AppException.Validation("Τα στοιχεία κινδύνου δεν είναι έγκυρα."); }
        if (request.CustomerId is Guid customerId)
        {
            if (!access.CanViewCustomers) throw AppException.Forbidden("Δεν έχετε δικαίωμα σύνδεσης πελατών.");
            var ownsCustomer = await _db.Customers.AnyAsync(x => x.Id == customerId && x.TenantId == settings.TenantId, ct);
            if (!ownsCustomer) throw AppException.NotFound("Πελάτης");
        }

        var quote = new Quote
        {
            Id = Guid.NewGuid(), TenantId = settings.TenantId, CreatedByUserId = access.UserId,
            QuoteNumber = $"Q-{_clock.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            CustomerId = request.CustomerId, ProductType = request.ProductType.Trim(),
            RiskInputsJson = request.RiskInputsJson, Status = QuoteStatus.Submitted,
            ExpiresAt = _clock.UtcNow.AddDays(14)
        };
        _db.Quotes.Add(quote);

        var requestedCarriers = request.OnlyCarriers?.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var carriers = requestedCarriers is { Length: > 0 }
            ? _carrierAdapters.All.Where(a => requestedCarriers.Contains(a.CarrierCode, StringComparer.OrdinalIgnoreCase)).ToList()
            : _carrierAdapters.All.ToList();
        var results = new List<(ICarrierAdapter Adapter, CarrierQuoteResult Result, CarrierOperationLog Log)>();
        foreach (var adapter in carriers)
        {
            var started = _clock.UtcNow;
            CarrierQuoteResult result;
            CarrierOperationLog log;
            try
            {
                result = await adapter.GetQuoteAsync(new CarrierQuoteRequest(quote.ProductType, quote.RiskInputsJson), ct);
                log = new CarrierOperationLog
                {
                    Id = Guid.NewGuid(), TenantId = settings.TenantId, CarrierCode = adapter.CarrierCode,
                    Operation = CarrierOperation.Quote, CorrelationId = quote.QuoteNumber,
                    Success = result.Success, DurationMs = Math.Max(0, (int)(_clock.UtcNow - started).TotalMilliseconds),
                    ResponseSummary = result.Success ? "Quote received" : result.ErrorMessage
                };
            }
            catch (Exception ex)
            {
                result = new CarrierQuoteResult(false, null, "EUR", null, null, null, null, null, ex.Message);
                log = new CarrierOperationLog
                {
                    Id = Guid.NewGuid(), TenantId = settings.TenantId, CarrierCode = adapter.CarrierCode,
                    Operation = CarrierOperation.Quote, CorrelationId = quote.QuoteNumber, Success = false,
                    DurationMs = Math.Max(0, (int)(_clock.UtcNow - started).TotalMilliseconds), ErrorMessage = ex.Message[..Math.Min(1000, ex.Message.Length)]
                };
            }
            results.Add((adapter, result, log));
        }
        foreach (var (adapter, result, log) in results)
        {
            _db.CarrierOperationLogs.Add(log);
            if (!result.Success || result.Premium is null) continue;
            quote.Offers.Add(new QuoteOffer
            {
                Id = Guid.NewGuid(), TenantId = settings.TenantId, QuoteId = quote.Id,
                CarrierCode = adapter.CarrierCode, CarrierProductCode = result.CarrierProductCode,
                Premium = result.Premium.Value, Currency = result.Currency, Commission = result.Commission,
                CoverageSummary = result.CoverageSummary, RawResponseRedacted = result.RawResponseRedacted, ValidUntil = result.ValidUntil
            });
        }
        quote.Status = quote.Offers.Count > 0 ? QuoteStatus.Quoted : QuoteStatus.Rejected;
        AddAudit(settings.TenantId, nameof(Quote), quote.Id, "InsureOne.Quote.Created", new { quote.QuoteNumber, quote.ProductType });
        await _db.SaveChangesAsync(ct);
        var saved = await _db.Quotes.AsNoTracking().Include(x => x.Customer).Include(x => x.Offers).FirstAsync(x => x.Id == quote.Id, ct);
        return Ok(ToQuote(saved));
    }

    [HttpPost("quotes/{quoteId:guid}/offers/{offerId:guid}/select")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneQuoteDto>> SelectOffer(Guid quoteId, Guid offerId, CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quotes.save", ct);
        var quote = await _db.Quotes.Include(x => x.Offers).Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == quoteId && x.TenantId == settings.TenantId && x.CreatedByUserId == access.UserId, ct)
            ?? throw AppException.NotFound("Προσφορά");
        var offer = quote.Offers.FirstOrDefault(x => x.Id == offerId) ?? throw AppException.NotFound("Προσφορά ασφαλιστικής");
        foreach (var item in quote.Offers) item.Selected = item.Id == offer.Id;
        quote.SelectedOfferId = offer.Id;
        quote.Status = QuoteStatus.Bound;
        AddAudit(settings.TenantId, nameof(QuoteOffer), offer.Id, "InsureOne.QuoteOffer.Selected", new { quote.QuoteNumber, offer.CarrierCode });
        await _db.SaveChangesAsync(ct);
        return Ok(ToQuote(quote));
    }

    [HttpPost("quotes/{quoteId:guid}/application")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneApplicationDto>> SubmitApplication(Guid quoteId, [FromBody] InsureOneApplicationRequest request, CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quotes.save", ct);
        if (!access.CanIssuePolicies) throw AppException.Forbidden("Η υποβολή προς έκδοση δεν έχει ενεργοποιηθεί για τον λογαριασμό σας.");
        var quote = await _db.Quotes.Include(x => x.Offers).Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == quoteId && x.TenantId == settings.TenantId && x.CreatedByUserId == access.UserId, ct)
            ?? throw AppException.NotFound("Προσφορά");
        var selected = quote.Offers.FirstOrDefault(x => x.Id == quote.SelectedOfferId) ?? throw AppException.Validation("Επιλέξτε πρώτα μία προσφορά.");
        var application = new PolicyApplication
        {
            Id = Guid.NewGuid(), TenantId = settings.TenantId, QuoteId = quote.Id, SelectedOfferId = selected.Id,
            ApplicationNumber = $"APP-{_clock.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
            Status = "Submitted"
        };
        _db.PolicyApplications.Add(application);
        AddAudit(settings.TenantId, nameof(PolicyApplication), application.Id, "InsureOne.Application.Submitted", new { quote.QuoteNumber, application.ApplicationNumber, request.StartDate, request.EndDate });
        await _db.SaveChangesAsync(ct);
        return Ok(new InsureOneApplicationDto(application.Id, application.ApplicationNumber, application.Status, quote.QuoteNumber, selected.CarrierCode));
    }

    [HttpGet("quotes/export")]
    [Authorize(Policy = "InsureOnePartner")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<IActionResult> ExportQuotes([FromQuery] string? status, CancellationToken ct)
    {
        var (access, settings) = await ResolvePartnerAsync("quotes.export", ct);
        var query = _db.Quotes.AsNoTracking().Include(x => x.Customer).Include(x => x.Offers)
            .Where(x => x.TenantId == settings.TenantId && x.CreatedByUserId == access.UserId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<QuoteStatus>(status, true, out var parsed)) query = query.Where(x => x.Status == parsed);
        var rows = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var sb = new StringBuilder("Κωδικός;Κλάδος;Πελάτης;Κατάσταση;Προσφορές;Επιλεγμένη;Δημιουργία\r\n");
        foreach (var row in rows)
        {
            var customer = row.Customer is null ? "" : $"{row.Customer.FirstName} {row.Customer.LastName}".Trim();
            var selected = row.Offers.FirstOrDefault(x => x.Selected)?.CarrierCode ?? "";
            sb.AppendLine(string.Join(';', CsvCell(row.QuoteNumber), CsvCell(row.ProductType), CsvCell(customer), CsvCell(row.Status.ToString()), row.Offers.Count, CsvCell(selected), row.CreatedAt.ToString("yyyy-MM-dd HH:mm")));
        }
        return File(new UTF8Encoding(true).GetBytes(sb.ToString()), "text/csv; charset=utf-8", $"insureone-quotes-{_clock.UtcNow:yyyyMMdd}.csv");
    }

    /// <summary>
    /// Office-level management metrics for the InsureOne administration desk.
    /// This endpoint deliberately aggregates only the selected office and
    /// never exposes another tenant's partner or quotation activity.
    /// </summary>
    [HttpGet("admin/analytics")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneAdminAnalyticsDto>> AdminAnalytics([FromQuery] Guid? officeId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var office = await ResolveOffice(officeId, tenantId, ct);
        var now = _clock.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1);

        var accesses = await _db.PartnerPortalAccesses
            .IgnoreQueryFilters()
            .Include(x => x.User)
            .Include(x => x.Producer)
            .Where(x => x.TenantId == tenantId && x.AgencyOfficeScopeId == office.Id && x.DeletedAt == null)
            .OrderBy(x => x.Producer.Name)
            .ToListAsync(ct);
        var userIds = accesses.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).ToArray();
        var quotes = _db.Quotes.AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.CreatedByUserId.HasValue && userIds.Contains(x.CreatedByUserId.Value));
        var totalQuotes = await quotes.CountAsync(ct);
        var monthQuotes = await quotes.CountAsync(x => x.CreatedAt >= monthStart, ct);
        var selectedQuotes = await quotes.CountAsync(x => x.SelectedOfferId != null, ct);
        var expiringQuotes = await quotes.CountAsync(x => x.ExpiresAt != null && x.ExpiresAt >= now && x.ExpiresAt <= now.AddDays(7), ct);

        var byUser = await quotes
            .GroupBy(x => x.CreatedByUserId!.Value)
            .Select(g => new { UserId = g.Key, Quotes = g.Count(), Selected = g.Count(x => x.SelectedOfferId != null), ThisMonth = g.Count(x => x.CreatedAt >= monthStart) })
            .ToListAsync(ct);
        var statsByUser = byUser.ToDictionary(x => x.UserId);

        var partnerStats = accesses.Select(access =>
        {
            var stats = access.UserId.HasValue && statsByUser.TryGetValue(access.UserId.Value, out var value)
                ? value
                : null;
            return new InsureOnePartnerAnalyticsDto(
                access.Id,
                access.Producer.Name,
                access.User?.Email ?? string.Empty,
                access.IsActive,
                access.LastLoginAt,
                stats?.Quotes ?? 0,
                stats?.ThisMonth ?? 0,
                stats?.Selected ?? 0,
                access.CanIssuePolicies,
                ParsePermissions(access.PermissionsJson));
        }).ToList();

        return Ok(new InsureOneAdminAnalyticsDto(
            office.Id,
            office.Name,
            accesses.Count,
            accesses.Count(x => x.IsActive),
            accesses.Count(x => x.CanIssuePolicies),
            totalQuotes,
            monthQuotes,
            selectedQuotes,
            expiringQuotes,
            partnerStats));
    }

    [HttpGet("settings")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneBrandingDto>> GetSettings([FromQuery] Guid? officeId, CancellationToken ct)
    {
        var settings = await GetOrCreateSettings(officeId, ct);
        return Ok(ToBranding(settings));
    }

    [HttpPut("settings")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOneBrandingDto>> UpdateSettings(
        [FromBody] UpdateInsureOneSettingsRequest request,
        CancellationToken ct)
    {
        var settings = await GetOrCreateSettings(request.AgencyOfficeId, ct);
        settings.Slug = NormaliseSlug(request.Slug, settings.AgencyOffice.Name);
        settings.IsEnabled = request.IsEnabled;
        settings.DisplayName = Clean(request.DisplayName, 180);
        settings.WelcomeMessage = Clean(request.WelcomeMessage, 1000);
        settings.PrimaryColor = NormaliseColor(request.PrimaryColor, "#0B6FB8");
        settings.SecondaryColor = NormaliseColor(request.SecondaryColor, "#0B2545");
        settings.SupportEmail = CleanEmail(request.SupportEmail);
        settings.SupportPhone = Clean(request.SupportPhone, 60);
        settings.AllowedBranchesJson = JsonSerializer.Serialize(
            (request.AllowedBranches ?? Array.Empty<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));

        var duplicate = await _db.InsureOneOfficeSettings
            .IgnoreQueryFilters()
            .AnyAsync(x => x.Slug == settings.Slug && x.Id != settings.Id, ct);
        if (duplicate) throw new AppException("insureone_slug_taken", "Το συγκεκριμένο URL χρησιμοποιείται ήδη από άλλο γραφείο.", 409);

        AddAudit(tenantId: settings.TenantId, entityName: nameof(InsureOneOfficeSettings), entityId: settings.Id,
            action: "InsureOne.Settings.Updated", metadata: new { settings.AgencyOfficeId, settings.Slug, settings.IsEnabled });
        await _db.SaveChangesAsync(ct);
        return Ok(ToBranding(settings));
    }

    [HttpPost("settings/logo")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<InsureOneBrandingDto>> UploadLogo(
        [FromForm] IFormFile file,
        [FromForm] Guid? officeId,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw AppException.Validation("Επιλέξτε ένα αρχείο λογοτύπου.");
        var settings = await GetOrCreateSettings(officeId, ct);
        await using var content = file.OpenReadStream();
        var type = await _uploadGate.InspectAsync(file.FileName, file.ContentType, file.Length, content, FileUploadKind.Image, 4_000_000, ct);
        var old = settings.LogoPath;
        settings.LogoPath = await _storage.UploadAsync($"insureone/{settings.TenantId}/{settings.AgencyOfficeId}", file.FileName, type, content, ct);
        AddAudit(settings.TenantId, nameof(InsureOneOfficeSettings), settings.Id, "InsureOne.Settings.LogoUpdated", new { hasLogo = true });
        await _db.SaveChangesAsync(ct);
        if (!string.IsNullOrWhiteSpace(old))
        {
            try { await _storage.DeleteAsync(old, ct); } catch { /* best effort */ }
        }
        return Ok(ToBranding(settings));
    }

    [HttpGet("partners")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<IReadOnlyList<InsureOnePartnerDto>>> ListPartners([FromQuery] Guid? officeId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var office = await ResolveOffice(officeId, tenantId, ct);
        var rows = await _db.PartnerPortalAccesses
            .IgnoreQueryFilters()
            .Include(x => x.User)
            .Include(x => x.Producer)
            .Where(x => x.TenantId == tenantId && x.AgencyOfficeScopeId == office.Id && x.DeletedAt == null)
            .OrderBy(x => x.Producer.Name)
            .ToListAsync(ct);

        return Ok(rows.Select(x => ToPartner(x)).ToList());
    }

    [HttpPost("partners")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOnePartnerDto>> CreatePartner([FromBody] CreateInsureOnePartnerRequest request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var office = await ResolveOffice(request.AgencyOfficeId, tenantId, ct);
        var email = CleanEmail(request.Email) ?? throw AppException.Validation("Το email είναι υποχρεωτικό.");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            throw AppException.Validation("Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");

        if (await _db.Users.IgnoreQueryFilters().AnyAsync(x => x.Email == email && x.DeletedAt == null, ct))
            throw new AppException("user_email_taken", "Το email χρησιμοποιείται ήδη από χρήστη.", 409);

        var producer = request.ProducerId.HasValue
            ? await _db.Producers.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == request.ProducerId.Value && x.TenantId == tenantId && x.DeletedAt == null, ct)
            : null;
        if (request.ProducerId.HasValue && producer is null) throw AppException.NotFound("Συνεργάτης");
        producer ??= new Producer
        {
            Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeScopeId = office.Id,
            Code = $"INS-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
            Name = $"{request.FirstName.Trim()} {request.LastName.Trim()}",
            Email = email, Phone = Clean(request.Phone, 60)
        };
        if (producer.Id != Guid.Empty && producer.CreatedAt == default) _db.Producers.Add(producer);

        var loginCode = string.IsNullOrWhiteSpace(request.LoginCode) ? email : request.LoginCode.Trim();
        var loginCodeTaken = await _db.PartnerPortalAccesses.IgnoreQueryFilters()
            .AnyAsync(x => x.TenantId == tenantId && x.LoginCode == loginCode && x.DeletedAt == null, ct);
        if (loginCodeTaken) throw new AppException("insureone_login_code_taken", "Ο κωδικός σύνδεσης χρησιμοποιείται ήδη.", 409);

        var user = new User
        {
            Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeScopeId = office.Id,
            Email = email, PasswordHash = _hasher.Hash(request.Password),
            FirstName = request.FirstName.Trim(), LastName = request.LastName.Trim(),
            Phone = Clean(request.Phone, 60), Role = Role.Producer, ProducerId = producer.Id,
            IsActive = true, PreferredLanguage = "el"
        };
        _db.Users.Add(user);
        _db.UserAgencyOffices.Add(new UserAgencyOffice
        {
            Id = Guid.NewGuid(), TenantId = tenantId, UserId = user.Id,
            AgencyOfficeId = office.Id, IsPrimary = true
        });

        var access = new PartnerPortalAccess
        {
            Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeScopeId = office.Id,
            ProducerId = producer.Id, UserId = user.Id, LoginCode = loginCode,
            PermissionsJson = JsonSerializer.Serialize((request.Permissions ?? DefaultPermissions).Distinct()),
            IsActive = true, CanIssuePolicies = request.CanIssuePolicies,
            CanViewCommissions = request.CanViewCommissions, CanViewCustomers = request.CanViewCustomers,
            Notes = Clean(request.Notes, 1000)
        };
        _db.PartnerPortalAccesses.Add(access);
        AddAudit(tenantId, nameof(PartnerPortalAccess), access.Id, "InsureOne.Partner.Created",
            new { access.ProducerId, access.LoginCode, access.CanIssuePolicies, access.CanViewCommissions, access.CanViewCustomers });
        await _db.SaveChangesAsync(ct);
        return Ok(ToPartner(access, user, producer));
    }

    [HttpPut("partners/{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<ActionResult<InsureOnePartnerDto>> UpdatePartner(Guid id, [FromBody] UpdateInsureOnePartnerRequest request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var access = await _db.PartnerPortalAccesses.IgnoreQueryFilters()
            .Include(x => x.User).Include(x => x.Producer)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης InsureOne");
        if (request.LoginCode is not null)
        {
            var code = request.LoginCode.Trim();
            var duplicate = await _db.PartnerPortalAccesses.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenantId && x.LoginCode == code && x.Id != id && x.DeletedAt == null, ct);
            if (duplicate) throw new AppException("insureone_login_code_taken", "Ο κωδικός σύνδεσης χρησιμοποιείται ήδη.", 409);
            access.LoginCode = code;
        }
        access.IsActive = request.IsActive;
        access.CanIssuePolicies = request.CanIssuePolicies;
        access.CanViewCommissions = request.CanViewCommissions;
        access.CanViewCustomers = request.CanViewCustomers;
        access.Notes = Clean(request.Notes, 1000);
        if (request.Permissions is not null) access.PermissionsJson = JsonSerializer.Serialize(request.Permissions.Distinct());
        if (access.User is not null)
        {
            access.User.IsActive = request.IsActive;
            if (!string.IsNullOrWhiteSpace(request.NewPassword))
            {
                if (request.NewPassword.Length < 8) throw AppException.Validation("Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
                access.User.PasswordHash = _hasher.Hash(request.NewPassword);
            }
            if (request.Phone is not null) access.User.Phone = Clean(request.Phone, 60);
        }
        AddAudit(tenantId, nameof(PartnerPortalAccess), access.Id, "InsureOne.Partner.Updated",
            new { access.ProducerId, access.LoginCode, access.IsActive, access.CanIssuePolicies, access.CanViewCommissions, access.CanViewCustomers });
        await _db.SaveChangesAsync(ct);
        return Ok(ToPartner(access));
    }

    [HttpDelete("partners/{id:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    [RequiresPackage(PackageCode.FrontOffice)]
    public async Task<IActionResult> RevokePartner(Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var access = await _db.PartnerPortalAccesses.IgnoreQueryFilters()
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης InsureOne");
        access.IsActive = false;
        access.DeletedAt = DateTime.UtcNow;
        if (access.User is not null) access.User.IsActive = false;
        AddAudit(tenantId, nameof(PartnerPortalAccess), access.Id, "InsureOne.Partner.Revoked", new { access.ProducerId });
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<(PartnerPortalAccess Access, InsureOneOfficeSettings Settings)> ResolvePartnerAsync(string permission, CancellationToken ct)
    {
        var userId = _current.UserId ?? throw AppException.Unauthorized();
        var access = await _db.PartnerPortalAccesses
            .IgnoreQueryFilters()
            .Include(x => x.User)
            .Include(x => x.Producer)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.IsActive && x.DeletedAt == null, ct)
            ?? throw AppException.Forbidden("Δεν υπάρχει ενεργή πρόσβαση InsureOne για τον χρήστη.");
        if (access.User is null || !access.User.IsActive)
            throw AppException.Forbidden("Ο λογαριασμός συνεργάτη δεν είναι ενεργός.");
        if (_current.AgencyOfficeId is Guid officeId && access.AgencyOfficeScopeId != officeId)
            throw AppException.Forbidden("Η πρόσβαση InsureOne δεν ανήκει στο επιλεγμένο γραφείο.");
        var settings = await _db.InsureOneOfficeSettings
            .Include(x => x.AgencyOffice)
            .FirstOrDefaultAsync(x => x.TenantId == access.TenantId && x.AgencyOfficeId == access.AgencyOfficeScopeId && x.DeletedAt == null && x.IsEnabled, ct)
            ?? throw AppException.Forbidden("Το InsureOne δεν είναι ενεργό για το γραφείο σας.");
        if (!HasPermission(access, permission))
            throw AppException.Forbidden("Δεν έχετε το απαιτούμενο δικαίωμα για αυτή την ενέργεια.");
        if (!await _packages.HasAsync(settings.TenantId, PackageCode.FrontOffice, ct))
            throw new AppException("package_not_licensed", "Το InsureOne δεν είναι ενεργό για το συγκεκριμένο γραφείο.", 403);
        return (access, settings);
    }

    private static bool HasPermission(PartnerPortalAccess access, string permission)
    {
        var permissions = ParsePermissions(access.PermissionsJson);
        if (permissions.Contains(permission, StringComparer.OrdinalIgnoreCase)) return true;
        return permission switch
        {
            "quoting.read" or "quotes.history" => permissions.Contains("quoting.read", StringComparer.OrdinalIgnoreCase),
            "quoting.create" or "quotes.save" => permissions.Contains("quoting.create", StringComparer.OrdinalIgnoreCase)
                || permissions.Contains("quotes.save", StringComparer.OrdinalIgnoreCase),
            "customers.read" => access.CanViewCustomers || permissions.Contains("customers.read", StringComparer.OrdinalIgnoreCase),
            "quotes.export" => permissions.Contains("quotes.export", StringComparer.OrdinalIgnoreCase),
            _ => false
        };
    }

    private static InsureOneQuoteDto ToQuote(Quote quote)
    {
        var customer = quote.Customer is null ? null : $"{quote.Customer.FirstName} {quote.Customer.LastName}".Trim();
        return new InsureOneQuoteDto(
            quote.Id, quote.QuoteNumber, quote.ProductType, quote.Status.ToString(), customer,
            quote.CustomerId, quote.CreatedAt, quote.ExpiresAt, quote.SelectedOfferId,
            quote.Offers.OrderBy(x => x.Premium).Select(x => new InsureOneOfferDto(
                x.Id, x.CarrierCode, x.CarrierProductCode, x.Premium, x.Currency, x.Commission,
                x.CoverageSummary, x.ValidUntil, x.Selected)).ToList(), quote.RiskInputsJson);
    }

    private static string CsvCell(string value)
        => $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";

    private async Task<InsureOneOfficeSettings?> FindSettings(string slug, CancellationToken ct)
    {
        var clean = NormaliseSlug(slug, string.Empty);
        return await _db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .Include(x => x.AgencyOffice)
            .FirstOrDefaultAsync(x => x.Slug == clean && x.DeletedAt == null && x.AgencyOffice.IsActive, ct);
    }

    private async Task<InsureOneOfficeSettings> GetOrCreateSettings(Guid? requestedOfficeId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var office = await ResolveOffice(requestedOfficeId, tenantId, ct);
        var settings = await _db.InsureOneOfficeSettings.IgnoreQueryFilters()
            .Include(x => x.AgencyOffice)
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.AgencyOfficeId == office.Id && x.DeletedAt == null, ct);
        if (settings is not null) return settings;
        settings = new InsureOneOfficeSettings
        {
            Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeId = office.Id,
            Slug = NormaliseSlug(office.Code, office.Name), DisplayName = office.Name,
            WelcomeMessage = "Συνδεθείτε στο InsureOne του γραφείου σας για να ξεκινήσετε τιμολόγηση.",
            SupportEmail = office.Email, SupportPhone = office.Phone, AgencyOffice = office
        };
        _db.InsureOneOfficeSettings.Add(settings);
        await _db.SaveChangesAsync(ct);
        return settings;
    }

    private async Task<AgencyOffice> ResolveOffice(Guid? requestedId, Guid tenantId, CancellationToken ct)
    {
        var query = _db.AgencyOffices.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.IsActive && x.DeletedAt == null);
        if (requestedId.HasValue) return await query.FirstOrDefaultAsync(x => x.Id == requestedId.Value, ct) ?? throw AppException.NotFound("Γραφείο");
        if (_current.AgencyOfficeId is Guid current) return await query.FirstOrDefaultAsync(x => x.Id == current, ct) ?? throw AppException.NotFound("Γραφείο");
        return await query.OrderByDescending(x => x.IsHeadquarters).FirstOrDefaultAsync(ct) ?? throw AppException.NotFound("Γραφείο");
    }

    private InsureOneBrandingDto ToBranding(InsureOneOfficeSettings settings)
        => new(settings.AgencyOfficeId, settings.Slug, settings.IsEnabled,
            settings.DisplayName ?? settings.AgencyOffice.Name,
            settings.WelcomeMessage, settings.PrimaryColor, settings.SecondaryColor,
            settings.SupportEmail ?? settings.AgencyOffice.Email,
            settings.SupportPhone ?? settings.AgencyOffice.Phone,
            string.IsNullOrWhiteSpace(settings.LogoPath) ? null : $"/api/insureone/public/{settings.Slug}/logo",
            ParseBranches(settings.AllowedBranchesJson));

    private static InsureOnePartnerDto ToPartner(PartnerPortalAccess access, User? user = null, Producer? producer = null)
    {
        user ??= access.User;
        producer ??= access.Producer;
        return new InsureOnePartnerDto(access.Id, access.UserId, access.ProducerId,
            producer?.Name ?? "", user?.Email ?? "", user?.FirstName ?? "", user?.LastName ?? "", user?.Phone,
            access.LoginCode ?? user?.Email ?? "", access.IsActive, access.CanIssuePolicies,
            access.CanViewCommissions, access.CanViewCustomers, access.LastLoginAt,
            access.Notes, ParsePermissions(access.PermissionsJson));
    }

    private static string[] ParsePermissions(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return DefaultPermissions;
        try { return JsonSerializer.Deserialize<string[]>(json) ?? DefaultPermissions; }
        catch { return DefaultPermissions; }
    }

    private static string[] ParseBranches(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    private static string NormaliseSlug(string? raw, string fallback)
    {
        var value = string.IsNullOrWhiteSpace(raw) ? fallback : raw.Trim().ToLowerInvariant();
        value = value.Replace(' ', '-');
        value = Regex.Replace(value, "[^a-z0-9-]", "");
        value = Regex.Replace(value, "-+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(value) ? $"office-{Guid.NewGuid():N}"[..15] : value[..Math.Min(value.Length, 90)];
    }

    private static string NormaliseColor(string? raw, string fallback)
    {
        var value = raw?.Trim() ?? string.Empty;
        return Regex.IsMatch(value, "^#?[0-9a-fA-F]{6}$") ? (value.StartsWith('#') ? value.ToUpperInvariant() : $"#{value.ToUpperInvariant()}") : fallback;
    }

    private static string? Clean(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];
    private static string? CleanEmail(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
    private static string GuessMime(string name) => Path.GetExtension(name).ToLowerInvariant() switch { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp", ".svg" => "image/svg+xml", _ => "application/octet-stream" };

    private void AddAudit(Guid tenantId, string entityName, Guid entityId, string action, object metadata)
        => _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), TenantId = tenantId, UserId = _current.UserId,
            EntityName = entityName, EntityId = entityId.ToString(), Action = action,
            Category = "Data", Metadata = JsonSerializer.Serialize(metadata),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = HttpContext.Request.Headers.UserAgent.ToString(), CreatedAt = DateTime.UtcNow
        });
}

public record InsureOneLoginRequest(string Identifier, string Password);
public record InsureOneBrandingDto(Guid AgencyOfficeId, string Slug, bool IsEnabled, string DisplayName, string? WelcomeMessage, string PrimaryColor, string SecondaryColor, string? SupportEmail, string? SupportPhone, string? LogoUrl, string[] AllowedBranches);
public record InsureOnePartnerMeDto(Guid AccessId, string LoginCode, string ProducerName, string OfficeName, InsureOneBrandingDto Branding, string[] Permissions);
public record InsureOneWorkspaceDto(int TotalQuotes, int QuotesThisMonth, int ActiveQuotes, int ExpiringThisWeek, string[] Permissions, bool CanIssuePolicies, bool CanViewCustomers, string Slug, string OfficeName);
public record InsureOneCustomerDto(Guid Id, string Name, string? Email, string? Phone);
public record InsureOneOfferDto(Guid Id, string CarrierCode, string? CarrierProductCode, decimal Premium, string Currency, decimal? Commission, string? CoverageSummary, DateTime? ValidUntil, bool Selected);
public record InsureOneQuoteDto(Guid Id, string QuoteNumber, string ProductType, string Status, string? CustomerName, Guid? CustomerId, DateTime CreatedAt, DateTime? ExpiresAt, Guid? SelectedOfferId, IReadOnlyList<InsureOneOfferDto> Offers, string RiskInputsJson);
public record InsureOneQuotePageDto(IReadOnlyList<InsureOneQuoteDto> Items, int Total, int Page, int PageSize);
public record InsureOneCreateQuoteRequest(string ProductType, string RiskInputsJson, Guid? CustomerId, IReadOnlyList<string>? OnlyCarriers);
public record InsureOneApplicationRequest(DateOnly? StartDate, DateOnly? EndDate, string? Notes);
public record InsureOneApplicationDto(Guid Id, string ApplicationNumber, string Status, string QuoteNumber, string CarrierCode);
public record UpdateInsureOneSettingsRequest(Guid? AgencyOfficeId, string Slug, bool IsEnabled, string? DisplayName, string? WelcomeMessage, string? PrimaryColor, string? SecondaryColor, string? SupportEmail, string? SupportPhone, string[]? AllowedBranches);
public record CreateInsureOnePartnerRequest(Guid? AgencyOfficeId, Guid? ProducerId, string FirstName, string LastName, string Email, string Password, string? LoginCode, string? Phone, bool CanIssuePolicies, bool CanViewCommissions, bool CanViewCustomers, string[]? Permissions, string? Notes);
public record UpdateInsureOnePartnerRequest(bool IsActive, bool CanIssuePolicies, bool CanViewCommissions, bool CanViewCustomers, string? LoginCode, string? NewPassword, string[]? Permissions, string? Notes, string? Phone);
public record InsureOnePartnerDto(Guid Id, Guid? UserId, Guid ProducerId, string ProducerName, string Email, string FirstName, string LastName, string? Phone, string LoginCode, bool IsActive, bool CanIssuePolicies, bool CanViewCommissions, bool CanViewCustomers, DateTime? LastLoginAt, string? Notes, string[] Permissions);
public record InsureOneAdminAnalyticsDto(Guid AgencyOfficeId, string OfficeName, int TotalPartners, int ActivePartners, int PartnersWithIssuance, int TotalQuotes, int QuotesThisMonth, int SelectedQuotes, int ExpiringQuotes, IReadOnlyList<InsureOnePartnerAnalyticsDto> Partners);
public record InsureOnePartnerAnalyticsDto(Guid AccessId, string PartnerName, string Email, bool IsActive, DateTime? LastLoginAt, int TotalQuotes, int QuotesThisMonth, int SelectedQuotes, bool CanIssuePolicies, string[] Permissions);
