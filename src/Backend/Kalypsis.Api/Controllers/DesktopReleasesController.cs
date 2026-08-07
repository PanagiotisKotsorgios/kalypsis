using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Kalypsis.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// First-party catalog and Platform Admin management surface for the public
/// Kalypsis Desktop GitHub releases repository. The GitHub credential is read
/// only on the API server and is never returned to the SPA.
/// </summary>
[ApiController]
[Route("api")]
public sealed partial class DesktopReleasesController : ControllerBase
{
    private const long MaxAssetBytes = 550L * 1024 * 1024;
    private const string PublicCacheKey = "desktop-releases:public";
    private static readonly JsonSerializerOptions GitHubJson = new(JsonSerializerDefaults.Web);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<DesktopReleasesController> _logger;

    public DesktopReleasesController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IMemoryCache cache,
        ILogger<DesktopReleasesController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>All published desktop releases and their downloadable assets.</summary>
    [AllowAnonymous]
    [HttpGet("public/desktop-releases")]
    public async Task<ActionResult<IReadOnlyList<DesktopReleaseDto>>> ListPublic(CancellationToken ct)
    {
        if (_cache.TryGetValue(PublicCacheKey, out IReadOnlyList<DesktopReleaseDto>? cached) && cached is not null)
            return Ok(cached);

        // Public repositories can be read anonymously. Keeping this call
        // anonymous means a bad/missing admin token can never break downloads.
        var releases = await ListFromGitHubAsync(requireToken: false, ct);
        var published = releases.Where(r => !r.Draft).ToList();
        _cache.Set(PublicCacheKey, published, TimeSpan.FromMinutes(5));
        return Ok(published);
    }

    /// <summary>All releases, including drafts, for the Platform Admin manager.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/desktop-releases")]
    public async Task<ActionResult<IReadOnlyList<DesktopReleaseDto>>> ListForAdmin(CancellationToken ct) =>
        Ok(await ListFromGitHubAsync(requireToken: true, ct));

    public sealed record CreateDesktopReleaseRequest(
        string TagName,
        string Name,
        string? Body,
        bool Draft = true,
        bool Prerelease = false,
        bool GenerateReleaseNotes = false);

    /// <summary>Create a GitHub release. Draft-first is recommended so assets can be checked before publishing.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/desktop-releases")]
    public async Task<ActionResult<DesktopReleaseDto>> Create(
        [FromBody] CreateDesktopReleaseRequest body,
        CancellationToken ct)
    {
        if (!body.Draft)
            throw AppException.Validation("Οι νέες desktop εκδόσεις πρέπει να δημιουργούνται ως πρόχειρες και να δημοσιεύονται αφού ανέβουν τα αρχεία τους.");
        var tag = ValidateTag(body.TagName);
        var name = ValidateReleaseName(body.Name);
        var payload = new
        {
            tag_name = tag,
            name,
            body = body.Body?.Trim() ?? string.Empty,
            draft = body.Draft,
            prerelease = body.Prerelease,
            generate_release_notes = body.GenerateReleaseNotes
        };

        using var request = CreateGitHubRequest(HttpMethod.Post, RepositoryPath("releases"), requireToken: true);
        request.Content = JsonContent(payload);
        var release = await SendForJsonAsync<GitHubRelease>(request, ct);
        InvalidatePublicCatalog();
        return Created($"/api/platform/desktop-releases/{release.Id}", Map(release));
    }

    public sealed record UpdateDesktopReleaseRequest(
        string Name,
        string? Body,
        bool Draft,
        bool Prerelease,
        bool MakeLatest = false);

    /// <summary>Edit release notes/status. Setting Draft=false publishes the release.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpPatch("platform/desktop-releases/{releaseId:long}")]
    public async Task<ActionResult<DesktopReleaseDto>> Update(
        long releaseId,
        [FromBody] UpdateDesktopReleaseRequest body,
        CancellationToken ct)
    {
        if (!body.Draft)
        {
            using var get = CreateGitHubRequest(HttpMethod.Get, RepositoryPath($"releases/{releaseId}"), requireToken: true);
            var current = await SendForJsonAsync<GitHubRelease>(get, ct);
            if (!current.Assets.Any(a => string.Equals(a.Name, "kalypsis-desktop-win-Setup.exe", StringComparison.OrdinalIgnoreCase)))
                throw AppException.Validation("Πριν από τη δημοσίευση ανεβάστε τον εγκαταστάτη με ακριβές όνομα kalypsis-desktop-win-Setup.exe, ώστε να λειτουργεί το σταθερό κουμπί λήψης.");
        }

        var payload = new Dictionary<string, object?>
        {
            ["name"] = ValidateReleaseName(body.Name),
            ["body"] = body.Body?.Trim() ?? string.Empty,
            ["draft"] = body.Draft,
            ["prerelease"] = body.Prerelease
        };
        if (body.MakeLatest && !body.Draft && !body.Prerelease)
            payload["make_latest"] = "true";

        using var request = CreateGitHubRequest(HttpMethod.Patch, RepositoryPath($"releases/{releaseId}"), requireToken: true);
        request.Content = JsonContent(payload);
        var release = await SendForJsonAsync<GitHubRelease>(request, ct);
        InvalidatePublicCatalog();
        return Ok(Map(release));
    }

    /// <summary>
    /// Stream one raw asset to GitHub. The browser sends the File as the request
    /// body, avoiding a second in-memory copy of installers that can exceed 250 MB.
    /// </summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpPost("platform/desktop-releases/{releaseId:long}/assets")]
    [RequestSizeLimit(600_000_000)]
    public async Task<ActionResult<DesktopReleaseAssetDto>> UploadAsset(
        long releaseId,
        [FromQuery] string name,
        [FromQuery] bool replace,
        CancellationToken ct)
    {
        var fileName = ValidateFileName(name);
        var contentLength = Request.ContentLength;
        if (contentLength is null or <= 0)
            throw new AppException("desktop_asset_empty", "Το αρχείο είναι κενό ή δεν έχει δηλωμένο μέγεθος.", 400);
        if (contentLength > MaxAssetBytes)
            throw new AppException("desktop_asset_too_large", "Το αρχείο ξεπερνά το όριο των 550 MB.", 413);

        if (replace)
            await DeleteExistingAssetWithSameNameAsync(releaseId, fileName, ct);

        var owner = RepositoryValue("Owner", "PanagiotisKotsorgios");
        var repository = RepositoryValue("Repository", "kalypsis-desktop-releases");
        var uploadUrl = $"https://uploads.github.com/repos/{Uri.EscapeDataString(owner)}/{Uri.EscapeDataString(repository)}" +
                        $"/releases/{releaseId}/assets?name={Uri.EscapeDataString(fileName)}";

        using var request = CreateGitHubRequest(HttpMethod.Post, uploadUrl, requireToken: true);
        var streamContent = new StreamContent(Request.Body);
        streamContent.Headers.ContentLength = contentLength;
        streamContent.Headers.ContentType = MediaTypeHeaderValue.TryParse(Request.ContentType, out var mediaType)
            ? mediaType
            : new MediaTypeHeaderValue("application/octet-stream");
        request.Content = streamContent;

        var asset = await SendForJsonAsync<GitHubAsset>(request, ct);
        InvalidatePublicCatalog();
        return Created(asset.BrowserDownloadUrl, Map(asset));
    }

    /// <summary>Delete a mistaken or obsolete asset from a release.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpDelete("platform/desktop-releases/assets/{assetId:long}")]
    public async Task<IActionResult> DeleteAsset(long assetId, CancellationToken ct)
    {
        using var request = CreateGitHubRequest(HttpMethod.Delete, RepositoryPath($"releases/assets/{assetId}"), requireToken: true);
        await SendWithoutBodyAsync(request, ct);
        InvalidatePublicCatalog();
        return NoContent();
    }

    private async Task<IReadOnlyList<DesktopReleaseDto>> ListFromGitHubAsync(bool requireToken, CancellationToken ct)
    {
        var all = new List<GitHubRelease>();
        for (var page = 1; ; page++)
        {
            using var request = CreateGitHubRequest(
                HttpMethod.Get,
                RepositoryPath($"releases?per_page=100&page={page}"),
                requireToken);
            var batch = await SendForJsonAsync<List<GitHubRelease>>(request, ct);
            all.AddRange(batch);
            if (batch.Count < 100) break;
        }
        return all.Select(Map).ToList();
    }

    private async Task DeleteExistingAssetWithSameNameAsync(long releaseId, string fileName, CancellationToken ct)
    {
        using var get = CreateGitHubRequest(HttpMethod.Get, RepositoryPath($"releases/{releaseId}"), requireToken: true);
        var release = await SendForJsonAsync<GitHubRelease>(get, ct);
        var existing = release.Assets.FirstOrDefault(a =>
            string.Equals(a.Name, fileName, StringComparison.OrdinalIgnoreCase));
        if (existing is null) return;

        using var delete = CreateGitHubRequest(HttpMethod.Delete, RepositoryPath($"releases/assets/{existing.Id}"), requireToken: true);
        await SendWithoutBodyAsync(delete, ct);
    }

    private HttpRequestMessage CreateGitHubRequest(HttpMethod method, string pathOrUrl, bool requireToken)
    {
        var request = new HttpRequestMessage(method, pathOrUrl);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        request.Headers.UserAgent.ParseAdd("Kalypsis-Desktop-Release-Center/1.0");
        request.Headers.TryAddWithoutValidation("X-GitHub-Api-Version", "2026-03-10");

        if (requireToken)
        {
            var token = _configuration["DesktopReleases:GitHubToken"]?.Trim();
            if (string.IsNullOrWhiteSpace(token))
                throw new AppException(
                    "desktop_releases_not_configured",
                    "Δεν έχει ρυθμιστεί GitHub token για τη διαχείριση desktop εκδόσεων.",
                    503,
                    title: "Απαιτείται ρύθμιση server",
                    why: "Η δημόσια λίστα λειτουργεί χωρίς token, αλλά η δημιουργία εκδόσεων και το ανέβασμα αρχείων απαιτούν δικαίωμα εγγραφής στο GitHub repository.",
                    fix: "Ορίστε στο API το secret DesktopReleases__GitHubToken με fine-grained GitHub token και Contents: Read and write για το kalypsis-desktop-releases.");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return request;
    }

    private async Task<T> SendForJsonAsync<T>(HttpRequestMessage request, CancellationToken ct)
    {
        using var response = await _httpClientFactory.CreateClient("desktop-releases-github")
            .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
            await ThrowGitHubErrorAsync(response, ct);

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<T>(stream, GitHubJson, ct)
               ?? throw new AppException("github_empty_response", "Το GitHub επέστρεψε κενή απάντηση.", 502);
    }

    private async Task SendWithoutBodyAsync(HttpRequestMessage request, CancellationToken ct)
    {
        using var response = await _httpClientFactory.CreateClient("desktop-releases-github")
            .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
            await ThrowGitHubErrorAsync(response, ct);
    }

    private async Task ThrowGitHubErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var raw = await response.Content.ReadAsStringAsync(ct);
        var githubMessage = "GitHub API error";
        try
        {
            githubMessage = JsonSerializer.Deserialize<GitHubError>(raw, GitHubJson)?.Message ?? githubMessage;
        }
        catch (JsonException)
        {
            // Do not forward arbitrary upstream HTML or proxy bodies.
        }

        _logger.LogWarning("GitHub desktop release API returned {Status}: {Message}", (int)response.StatusCode, githubMessage);
        var status = response.StatusCode switch
        {
            HttpStatusCode.NotFound => 404,
            HttpStatusCode.UnprocessableEntity or HttpStatusCode.Conflict => 409,
            _ => 502
        };
        throw new AppException("github_release_error", $"Το GitHub δεν ολοκλήρωσε την ενέργεια: {githubMessage}", status);
    }

    private string RepositoryPath(string suffix)
    {
        var owner = RepositoryValue("Owner", "PanagiotisKotsorgios");
        var repository = RepositoryValue("Repository", "kalypsis-desktop-releases");
        return $"repos/{Uri.EscapeDataString(owner)}/{Uri.EscapeDataString(repository)}/{suffix}";
    }

    private string RepositoryValue(string key, string fallback)
    {
        var value = _configuration[$"DesktopReleases:{key}"]?.Trim();
        value = string.IsNullOrWhiteSpace(value) ? fallback : value;
        if (!GitHubNameRegex().IsMatch(value))
            throw new InvalidOperationException($"DesktopReleases:{key} contains invalid characters.");
        return value;
    }

    private static string ValidateTag(string value)
    {
        var tag = value?.Trim() ?? string.Empty;
        if (tag.Length is < 1 or > 100 || !ReleaseTagRegex().IsMatch(tag))
            throw AppException.Validation("Η έκδοση πρέπει να είναι έγκυρο tag, π.χ. v2.1.0.");
        return tag;
    }

    private static string ValidateReleaseName(string value)
    {
        var name = value?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            throw AppException.Validation("Ο τίτλος έκδοσης πρέπει να έχει από 1 έως 200 χαρακτήρες.");
        return name;
    }

    private static string ValidateFileName(string value)
    {
        var decoded = Uri.UnescapeDataString(value ?? string.Empty).Trim();
        var name = Path.GetFileName(decoded);
        if (name.Length is < 1 or > 255 || name != decoded || decoded.Contains('/') || decoded.Contains('\\') || name.Any(char.IsControl))
            throw AppException.Validation("Το όνομα αρχείου δεν είναι έγκυρο.");
        return name;
    }

    private static StringContent JsonContent<T>(T value) =>
        new(JsonSerializer.Serialize(value, GitHubJson), Encoding.UTF8, "application/json");

    private void InvalidatePublicCatalog() => _cache.Remove(PublicCacheKey);

    private static DesktopReleaseDto Map(GitHubRelease release) => new(
        release.Id,
        release.TagName,
        string.IsNullOrWhiteSpace(release.Name) ? release.TagName : release.Name,
        release.Body,
        release.Draft,
        release.Prerelease,
        release.CreatedAt,
        release.PublishedAt,
        release.HtmlUrl,
        release.Assets.Select(Map).ToList());

    private static DesktopReleaseAssetDto Map(GitHubAsset asset) => new(
        asset.Id,
        asset.Name,
        asset.Label,
        asset.ContentType,
        asset.Size,
        asset.DownloadCount,
        asset.CreatedAt,
        asset.UpdatedAt,
        asset.BrowserDownloadUrl,
        asset.Digest);

    [GeneratedRegex("^[A-Za-z0-9_.-]+$")]
    private static partial Regex GitHubNameRegex();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._+/-]{0,99}$")]
    private static partial Regex ReleaseTagRegex();

    public sealed record DesktopReleaseDto(
        long Id,
        string TagName,
        string Name,
        string? Body,
        bool Draft,
        bool Prerelease,
        DateTimeOffset CreatedAt,
        DateTimeOffset? PublishedAt,
        string HtmlUrl,
        IReadOnlyList<DesktopReleaseAssetDto> Assets);

    public sealed record DesktopReleaseAssetDto(
        long Id,
        string Name,
        string? Label,
        string ContentType,
        long Size,
        int DownloadCount,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        string BrowserDownloadUrl,
        string? Digest);

    private sealed class GitHubRelease
    {
        public long Id { get; init; }
        [JsonPropertyName("tag_name")] public string TagName { get; init; } = string.Empty;
        public string? Name { get; init; }
        public string? Body { get; init; }
        public bool Draft { get; init; }
        public bool Prerelease { get; init; }
        [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; init; }
        [JsonPropertyName("published_at")] public DateTimeOffset? PublishedAt { get; init; }
        [JsonPropertyName("html_url")] public string HtmlUrl { get; init; } = string.Empty;
        public List<GitHubAsset> Assets { get; init; } = [];
    }

    private sealed class GitHubAsset
    {
        public long Id { get; init; }
        public string Name { get; init; } = string.Empty;
        public string? Label { get; init; }
        [JsonPropertyName("content_type")] public string ContentType { get; init; } = "application/octet-stream";
        public long Size { get; init; }
        [JsonPropertyName("download_count")] public int DownloadCount { get; init; }
        [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; init; }
        [JsonPropertyName("updated_at")] public DateTimeOffset UpdatedAt { get; init; }
        [JsonPropertyName("browser_download_url")] public string BrowserDownloadUrl { get; init; } = string.Empty;
        public string? Digest { get; init; }
    }

    private sealed class GitHubError
    {
        public string? Message { get; init; }
    }
}
