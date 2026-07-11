using Kalypsis.Application.Features.Users;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// AgencyAdmin manages what each employee can do in the backoffice. The
/// role gives a default set of permissions; individual grants override.
///
/// Two URL surfaces are exposed for the same handlers:
///
///   /api/permissions/user/{id}       — the shape the existing frontend
///                                       dialog (UserPermissionsDialog) calls.
///   /api/users/{id}/permissions      — REST-conventional alternative.
///
/// Same handlers back both; either path works.
/// </summary>
[ApiController]
[Authorize(Policy = "AgencyAdmin")]
public class UserPermissionsController : ControllerBase
{
    private readonly IMediator _mediator;
    public UserPermissionsController(IMediator mediator) => _mediator = mediator;

    // ---------------------------------------------------------------------
    // Catalog — the full list of grantable permission codes.
    // ---------------------------------------------------------------------

    [HttpGet("api/permissions/catalog")]
    [HttpGet("api/permission-catalog")]
    public async Task<ActionResult<string[]>> GetCatalog(CancellationToken ct)
        => Ok(await _mediator.Send(new GetPermissionCatalogQuery(), ct));

    // ---------------------------------------------------------------------
    // Per-user permissions — GET / PUT.
    // ---------------------------------------------------------------------

    [HttpGet("api/permissions/user/{id:guid}")]
    [HttpGet("api/users/{id:guid}/permissions")]
    public async Task<ActionResult<UserPermissionsDto>> Get(Guid id, CancellationToken ct)
        => Ok(await _mediator.Send(new GetUserPermissionsQuery(id), ct));

    public record SetUserPermissionsBody(string[]? Permissions);

    [HttpPut("api/permissions/user/{id:guid}")]
    [HttpPut("api/users/{id:guid}/permissions")]
    public async Task<ActionResult<UserPermissionsDto>> Set(
        Guid id,
        [FromBody] SetUserPermissionsBody body,
        CancellationToken ct)
        => Ok(await _mediator.Send(new SetUserPermissionsCommand(id, body.Permissions), ct));
}
