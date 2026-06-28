using Kalypsis.Application.Features.Premium;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/me/premium-features")]
[Authorize]
public class MyPremiumFeaturesController : ControllerBase
{
    private readonly IMediator _mediator;
    public MyPremiumFeaturesController(IMediator mediator) => _mediator = mediator;

    // GET /api/me/premium-features → { codes: [...] }
    // Returns the merged list of premium feature codes the current tenant has
    // unlocked across all its TenantPackageGrants.
    [HttpGet]
    public async Task<ActionResult<MyPremiumFeaturesDto>> Get(CancellationToken ct)
        => Ok(await _mediator.Send(new GetMyPremiumFeaturesQuery(), ct));

    // GET /api/me/premium-features/catalogue → list of all well-known codes
    // for the upgrade dialog.
    [HttpGet("catalogue")]
    [AllowAnonymous]
    public ActionResult<IReadOnlyList<string>> Catalogue() => Ok(PremiumFeatureCodes.All);
}

[ApiController]
[Route("api/platform/tenants/{tenantId:guid}/premium-features")]
[Authorize(Policy = "PlatformAdmin")]
public class PlatformTenantPremiumFeaturesController : ControllerBase
{
    private readonly IMediator _mediator;
    public PlatformTenantPremiumFeaturesController(IMediator mediator) => _mediator = mediator;

    public record SetBody(IReadOnlyList<string> Codes);

    // PUT /api/platform/tenants/{tenantId}/premium-features  body: { codes: [...] }
    // Superadmin sets the premium feature codes for a tenant. The list is whitelisted
    // against PremiumFeatureCodes.All — unknown codes are dropped silently.
    [HttpPut]
    public async Task<ActionResult<MyPremiumFeaturesDto>> Set(
        Guid tenantId,
        [FromBody] SetBody body,
        CancellationToken ct)
        => Ok(await _mediator.Send(new SetTenantPremiumFeaturesCommand(tenantId, body.Codes ?? Array.Empty<string>()), ct));
}
