using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Landing-page dashboard showcase images. The superadmin uploads one PNG/JPG
/// per tab key; the public landing reads them and renders them in place of the
/// built-in SVG mockups.
///
/// Files live under wwwroot/showcase/{key}.{ext} so they're served directly by
/// UseStaticFiles — no DB round-trip on the public read path.
/// </summary>
[ApiController]
[Route("api")]
public class ShowcaseImagesController : ControllerBase
{
    // Whitelist of allowed tab keys — keeps the filesystem clean and avoids
    // path-traversal mistakes.
    private static readonly HashSet<string> AllowedKeys =
        new(StringComparer.OrdinalIgnoreCase) { "customers", "policies", "quotes", "commissions", "reports" };

    // Allowed mime → file extension map. Anything else is rejected.
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = "png",
        ["image/jpeg"] = "jpg",
        ["image/webp"] = "webp"
    };

    private readonly IWebHostEnvironment _env;
    public ShowcaseImagesController(IWebHostEnvironment env) => _env = env;

    public record ShowcaseImageDto(string Key, string Url, long Size, DateTime UpdatedAt);

    private string Dir => Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "showcase");

    private ShowcaseImageDto? FindExisting(string key)
    {
        if (!Directory.Exists(Dir)) return null;
        foreach (var ext in AllowedTypes.Values)
        {
            var path = Path.Combine(Dir, $"{key.ToLowerInvariant()}.{ext}");
            if (System.IO.File.Exists(path))
            {
                var info = new FileInfo(path);
                return new ShowcaseImageDto(
                    key.ToLowerInvariant(),
                    $"/showcase/{key.ToLowerInvariant()}.{ext}",
                    info.Length,
                    info.LastWriteTimeUtc);
            }
        }
        return null;
    }

    /// <summary>Public read — landing page calls this. No auth needed.</summary>
    [AllowAnonymous]
    [HttpGet("public/showcase-images")]
    public ActionResult<IReadOnlyList<ShowcaseImageDto>> Public()
    {
        var result = new List<ShowcaseImageDto>();
        foreach (var key in AllowedKeys)
        {
            var hit = FindExisting(key);
            if (hit != null) result.Add(hit);
        }
        return Ok(result);
    }

    /// <summary>Admin list — same payload as Public but includes empty slots.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [HttpGet("platform/showcase-images")]
    public ActionResult<IReadOnlyList<ShowcaseImageDto?>> AdminList() =>
        Ok(AllowedKeys.Select(k => (object)(FindExisting(k) ?? new ShowcaseImageDto(k, "", 0, DateTime.MinValue))).ToList());

    /// <summary>Admin upload (drag-and-drop). Replaces any existing image for the key.</summary>
    [Authorize(Policy = "PlatformAdmin")]
    [RequestSizeLimit(10_000_000)]
    [HttpPost("platform/showcase-images/{key}")]
    public async Task<ActionResult<ShowcaseImageDto>> Upload(string key, IFormFile file, CancellationToken ct)
    {
        key = (key ?? "").Trim().ToLowerInvariant();
        if (!AllowedKeys.Contains(key))
            return BadRequest(new { code = "unknown_key", message = "Unknown tab key." });
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "no_file" });
        if (!AllowedTypes.TryGetValue(file.ContentType, out var ext))
            return BadRequest(new { code = "unsupported_type", message = "Only PNG, JPEG, or WebP allowed." });

        Directory.CreateDirectory(Dir);

        // Delete any prior image (which may have a different extension)
        foreach (var oldExt in AllowedTypes.Values)
        {
            var oldPath = Path.Combine(Dir, $"{key}.{oldExt}");
            if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
        }

        var destPath = Path.Combine(Dir, $"{key}.{ext}");
        await using (var fs = System.IO.File.Create(destPath))
            await file.CopyToAsync(fs, ct);

        var info = new FileInfo(destPath);
        return Ok(new ShowcaseImageDto(key, $"/showcase/{key}.{ext}", info.Length, info.LastWriteTimeUtc));
    }

    [Authorize(Policy = "PlatformAdmin")]
    [HttpDelete("platform/showcase-images/{key}")]
    public ActionResult Delete(string key)
    {
        key = (key ?? "").Trim().ToLowerInvariant();
        if (!AllowedKeys.Contains(key))
            return BadRequest(new { code = "unknown_key" });
        foreach (var ext in AllowedTypes.Values)
        {
            var path = Path.Combine(Dir, $"{key}.{ext}");
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        }
        return NoContent();
    }
}
