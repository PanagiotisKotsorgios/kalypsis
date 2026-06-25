using System.Globalization;
using Kalypsis.Api.Authorization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Bridges;
using Kalypsis.Application.Features.CommissionRuns;
using Kalypsis.Application.Features.Users;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/commission-runs")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(Kalypsis.Domain.Enums.PackageCode.BackOffice)]
public class CommissionRunsController : ControllerBase
{
    private readonly IMediator _m;
    public CommissionRunsController(IMediator m) => _m = m;

    [HttpGet]
    [RequirePermission("commissions.read")]
    public async Task<ActionResult<IReadOnlyList<CommissionRunDto>>> List([FromQuery] int? year, CancellationToken ct)
        => Ok(await _m.Send(new ListCommissionRunsQuery(year), ct));

    [HttpPost]
    [RequirePermission("commissions.run")]
    public async Task<ActionResult<CommissionRunDto>> Generate([FromBody] GenerateCommissionRunBody body, CancellationToken ct)
        => Ok(await _m.Send(new GenerateCommissionRunCommand(body), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("commissions.read")]
    public async Task<ActionResult<CommissionRunDetailDto>> Detail(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new GetCommissionRunDetailQuery(id), ct));

    [HttpPost("lines/{lineId:guid}/override")]
    [RequirePermission("commissions.run")]
    public async Task<ActionResult<CommissionRunLineDto>> Override(Guid lineId, [FromBody] OverrideBody body, CancellationToken ct)
        => Ok(await _m.Send(new OverrideCommissionLineCommand(lineId, body.Amount, body.Reason), ct));
    public record OverrideBody(decimal Amount, string? Reason);

    [HttpPost("{id:guid}/finalise")]
    [RequirePermission("commissions.run")]
    public async Task<ActionResult<CommissionRunDto>> Finalise(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new FinaliseCommissionRunCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("commissions.run")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { await _m.Send(new DeleteCommissionRunCommand(id), ct); return NoContent(); }

    [HttpGet("{id:guid}/export.csv")]
    [RequirePermission("commissions.read")]
    public async Task<IActionResult> ExportCsv(Guid id, CancellationToken ct)
    {
        var detail = await _m.Send(new GetCommissionRunDetailQuery(id), ct);
        var headers = new[] { "Συμβόλαιο","Πελάτης/Παραγωγός","Εταιρεία","Κλάδος","Πακέτο","Ασφάλιστρο","Ποσοστό %","Προμήθεια","Override","Λόγος" };
        var rows = detail.Lines.Select(l => (IReadOnlyList<object?>)new object?[] {
            l.PolicyNumber, l.ProducerName ?? "(χωρίς)", l.InsuranceCompanyName,
            l.PolicyType.ToString(), l.PackageCode ?? "",
            l.Premium, l.RatePercent, l.CommissionAmount,
            l.IsOverridden ? "ΝΑΙ" : "", l.OverrideReason ?? ""
        }).ToList();
        var bytes = CsvWriter.Build(headers, rows);
        var name = $"commission-run-{detail.Run.Year}-{detail.Run.Month:00}.csv";
        return File(bytes, "text/csv; charset=utf-8", name);
    }
}

// CommissionRulesController moved to CommissionRulesController.cs (dedicated CRUD).

[ApiController]
[Route("api/company-bridges")]
[Authorize(Policy = "AgencyAdmin")]
[RequiresPackage(Kalypsis.Domain.Enums.PackageCode.Integrations)]
public class CompanyBridgesController : ControllerBase
{
    private readonly IMediator _m;
    public CompanyBridgesController(IMediator m) => _m = m;

    [HttpGet] [RequirePermission("bridges.read")] public async Task<ActionResult<IReadOnlyList<CompanyBridgeDto>>> List(CancellationToken ct)
        => Ok(await _m.Send(new ListCompanyBridgesQuery(), ct));
    [HttpPost] [RequirePermission("bridges.sync")] public async Task<ActionResult<CompanyBridgeDto>> Create([FromBody] CompanyBridgeBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertCompanyBridgeCommand(null, body), ct));
    [HttpPut("{id:guid}")] [RequirePermission("bridges.sync")] public async Task<ActionResult<CompanyBridgeDto>> Update(Guid id, [FromBody] CompanyBridgeBody body, CancellationToken ct)
        => Ok(await _m.Send(new UpsertCompanyBridgeCommand(id, body), ct));
    [HttpPost("{id:guid}/sync")] [RequirePermission("bridges.sync")] public async Task<ActionResult<CompanyBridgeDto>> Sync(Guid id, CancellationToken ct)
        => Ok(await _m.Send(new SyncCompanyBridgeCommand(id), ct));
    [HttpDelete("{id:guid}")] [RequirePermission("bridges.sync")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    { await _m.Send(new DeleteCompanyBridgeCommand(id), ct); return NoContent(); }
}

[ApiController]
[Route("api/permissions")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly IMediator _m;
    public PermissionsController(IMediator m) => _m = m;

    [HttpGet("catalog")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<string[]>> Catalog(CancellationToken ct)
        => Ok(await _m.Send(new GetPermissionCatalogQuery(), ct));

    [HttpGet("user/{userId:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<UserPermissionsDto>> Get(Guid userId, CancellationToken ct)
        => Ok(await _m.Send(new GetUserPermissionsQuery(userId), ct));

    [HttpPut("user/{userId:guid}")]
    [Authorize(Policy = "AgencyAdmin")]
    public async Task<ActionResult<UserPermissionsDto>> Set(Guid userId, [FromBody] SetBody body, CancellationToken ct)
        => Ok(await _m.Send(new SetUserPermissionsCommand(userId, body.Permissions), ct));
    public record SetBody(string[]? Permissions);
}

[ApiController]
[Route("api/exports")]
[Authorize(Policy = "AgencyStaff")]
[RequirePermission("exports.run")]
public class ExportsController : ControllerBase
{
    private readonly IAppDbContext _db;
    public ExportsController(IAppDbContext db) => _db = db;

    [HttpGet("customers.csv")]
    public async Task<IActionResult> Customers(CancellationToken ct)
    {
        var rows = await _db.Customers
            .Select(c => new {
                c.CustomerNumber, c.Type, c.FirstName, c.LastName, c.CompanyName,
                c.VatNumber, c.Email, c.Phone, c.City, c.Address, c.CreatedAt
            }).ToListAsync(ct);
        var headers = new[] { "Αριθμός","Τύπος","Όνομα","Επώνυμο","Επωνυμία","ΑΦΜ","Email","Τηλέφωνο","Πόλη","Διεύθυνση","Δημιουργία" };
        var data = rows.Select(r => (IReadOnlyList<object?>)new object?[] {
            r.CustomerNumber, r.Type.ToString(), r.FirstName, r.LastName, r.CompanyName,
            r.VatNumber, r.Email, r.Phone, r.City, r.Address, r.CreatedAt
        }).ToList();
        return Send(headers, data, "customers");
    }

    [HttpGet("policies.csv")]
    public async Task<IActionResult> Policies(CancellationToken ct)
    {
        var rows = await _db.Policies
            .Include(p => p.Customer).Include(p => p.InsuranceCompany).Include(p => p.Producer)
            .OrderByDescending(p => p.StartDate)
            .Take(10000)
            .ToListAsync(ct);
        var headers = new[] { "Αριθμός","Πελάτης","Εταιρεία","Συνεργάτης","Κλάδος","Κατάσταση","Έναρξη","Λήξη","Ασφάλιστρο","Νόμισμα" };
        var data = rows.Select(p => (IReadOnlyList<object?>)new object?[] {
            p.PolicyNumber,
            p.Customer.Type == Domain.Enums.CustomerType.Individual ? $"{p.Customer.FirstName} {p.Customer.LastName}".Trim() : p.Customer.CompanyName,
            p.InsuranceCompany.Name,
            p.Producer?.Name,
            p.PolicyType.ToString(), p.Status.ToString(),
            p.StartDate, p.EndDate, p.Premium, p.Currency
        }).ToList();
        return Send(headers, data, "policies");
    }

    [HttpGet("financial-movements.csv")]
    public async Task<IActionResult> FinancialMovements([FromQuery] int? year, CancellationToken ct)
    {
        IQueryable<FinancialMovement> q = _db.FinancialMovements
            .Include(m => m.Customer).Include(m => m.Producer).Include(m => m.InsuranceCompany);
        if (year.HasValue)
        {
            var first = new DateOnly(year.Value, 1, 1);
            var last = new DateOnly(year.Value, 12, 31);
            q = q.Where(m => m.MovementDate >= first && m.MovementDate <= last);
        }
        var rows = await q.OrderByDescending(m => m.MovementDate).Take(50000).ToListAsync(ct);
        var headers = new[] { "Ημερομηνία","Τύπος","Πελάτης","Συνεργάτης","Εταιρεία","Περιγραφή","Ποσό","Νόμισμα" };
        var data = rows.Select(m => (IReadOnlyList<object?>)new object?[] {
            m.MovementDate, m.Kind.ToString(),
            m.Customer is null ? "" : m.Customer.Type == Domain.Enums.CustomerType.Individual ? $"{m.Customer.FirstName} {m.Customer.LastName}".Trim() : m.Customer.CompanyName,
            m.Producer?.Name, m.InsuranceCompany?.Name,
            m.Description ?? "", m.Amount, m.Currency
        }).ToList();
        return Send(headers, data, "financial-movements");
    }

    [HttpGet("receipts.csv")]
    public async Task<IActionResult> Receipts(CancellationToken ct)
    {
        var rows = await _db.Receipts.Include(r => r.Customer).Include(r => r.Policy)
            .OrderByDescending(r => r.ReceivedOn).Take(50000).ToListAsync(ct);
        var headers = new[] { "Αριθμός","Ημερομηνία","Πελάτης","Συμβόλαιο","Τρόπος","Ποσό","Νόμισμα","Σημειώσεις" };
        var data = rows.Select(r => (IReadOnlyList<object?>)new object?[] {
            r.Number, r.ReceivedOn,
            r.Customer.Type == Domain.Enums.CustomerType.Individual ? $"{r.Customer.FirstName} {r.Customer.LastName}".Trim() : r.Customer.CompanyName,
            r.Policy?.PolicyNumber, r.Method.ToString(), r.Amount, r.Currency, r.Notes ?? ""
        }).ToList();
        return Send(headers, data, "receipts");
    }

    [HttpGet("payments.csv")]
    public async Task<IActionResult> Payments(CancellationToken ct)
    {
        var rows = await _db.Payments.Include(p => p.BeneficiaryInsuranceCompany).Include(p => p.BeneficiaryProducer)
            .OrderByDescending(p => p.PaidOn).Take(50000).ToListAsync(ct);
        var headers = new[] { "Αριθμός","Ημερομηνία","Τύπος δικαιούχου","Εταιρεία","Συνεργάτης","Άλλο","Τρόπος","Ποσό","Συμψηφισμός","Νόμισμα" };
        var data = rows.Select(p => (IReadOnlyList<object?>)new object?[] {
            p.Number, p.PaidOn, p.BeneficiaryType.ToString(),
            p.BeneficiaryInsuranceCompany?.Name, p.BeneficiaryProducer?.Name, p.BeneficiaryName,
            p.Method.ToString(), p.Amount, p.CommissionsNetted, p.Currency
        }).ToList();
        return Send(headers, data, "payments");
    }

    private FileContentResult Send(IReadOnlyList<string> headers, IReadOnlyList<IReadOnlyList<object?>> rows, string fileName)
    {
        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmm", CultureInfo.InvariantCulture);
        var bytes = CsvWriter.Build(headers, rows);
        return File(bytes, "text/csv; charset=utf-8", $"{fileName}-{stamp}.csv");
    }
}
