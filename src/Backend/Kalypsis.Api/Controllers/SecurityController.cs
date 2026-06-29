using Kalypsis.Api.Defense;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Platform-admin-only window into the IP block list. Lets the team see who's
/// been auto-banned, ban manually, or release a false positive.
/// </summary>
[ApiController]
[Route("api/platform/security")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformSecurityController : ControllerBase
{
    private readonly IpBlockService _blocks;
    public PlatformSecurityController(IpBlockService blocks) { _blocks = blocks; }

    [HttpGet("ip-blocks")]
    public ActionResult<IReadOnlyList<IpBlockEntry>> List() => Ok(_blocks.Snapshot());

    public record BlockBody(string Ip, int Minutes, string? Reason);

    [HttpPost("ip-blocks")]
    public IActionResult Block([FromBody] BlockBody body)
    {
        if (string.IsNullOrWhiteSpace(body.Ip)) return BadRequest(new { code = "ip_required" });
        var dur = TimeSpan.FromMinutes(Math.Clamp(body.Minutes, 1, 60 * 24));
        _blocks.Block(body.Ip.Trim(), dur, string.IsNullOrWhiteSpace(body.Reason) ? "manual" : body.Reason!);
        return Ok();
    }

    [HttpDelete("ip-blocks/{ip}")]
    public IActionResult Unblock(string ip) => _blocks.Unblock(ip) ? Ok() : NotFound();
}
