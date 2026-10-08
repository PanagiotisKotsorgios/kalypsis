using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Office-owned producer networks. A network is an organisational layer only:
/// it never replaces the producer, policy or commission hierarchy.
/// </summary>
[ApiController]
[Route("api/partner-networks")]
[Authorize(Policy = "AgencyStaff")]
public sealed class PartnerNetworksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IFileStorage _storage;
    private readonly FileUploadGate _gate;
    private readonly IDateTimeProvider _clock;

    public PartnerNetworksController(AppDbContext db, ICurrentUser current, IFileStorage storage,
        FileUploadGate gate, IDateTimeProvider clock)
    {
        _db = db; _current = current; _storage = storage; _gate = gate; _clock = clock;
    }

    private Guid TenantId => _current.TenantId ?? throw AppException.Forbidden();

    public record NetworkDto(Guid Id, string Code, string Name, string? Description, string NetworkType,
        string Status, string? ManagerName, string? Email, string? Phone, string? SecondaryEmail,
        string? SecondaryPhone, string? TaxId, string? TaxOffice, string? BusinessType,
        string? ProfessionalCategory, string? Address, string? City, string? PostalCode,
        string? Website, string? LogoPath, string? ContractNumber, DateOnly? ContractStartDate,
        DateOnly? ContractEndDate, string? CommissionPolicyJson, string? Notes, int MemberCount,
        int ActiveMemberCount, int PolicyCount, decimal GrossPremium, decimal ProducerCommission,
        decimal OfficeCommission, DateTime CreatedAt);

    public record MemberDto(Guid Id, Guid ProducerId, string ProducerName, string ProducerCode,
        string Role, bool IsActive, DateOnly? JoinedAt, DateOnly? LeftAt,
        decimal? CommissionPercentOverride, decimal? TargetPercent, string? Notes);

    public record DocumentDto(Guid Id, string FileName, string MimeType, long SizeBytes,
        string Category, string? Notes, DateTime CreatedAt);

    public record DetailDto(NetworkDto Network, IReadOnlyList<MemberDto> Members,
        IReadOnlyList<DocumentDto> Documents);

    public record NetworkBody(string Code, string Name, string? Description, string? NetworkType,
        string? Status, string? ManagerName, string? Email, string? Phone, string? SecondaryEmail,
        string? SecondaryPhone, string? TaxId, string? TaxOffice, string? BusinessType,
        string? ProfessionalCategory, string? Address, string? City, string? PostalCode,
        string? Website, string? ContractNumber, DateOnly? ContractStartDate, DateOnly? ContractEndDate,
        string? CommissionPolicyJson, string? Notes);

    public record MemberBody(Guid ProducerId, string? Role, bool IsActive = true,
        DateOnly? JoinedAt = null, DateOnly? LeftAt = null,
        decimal? CommissionPercentOverride = null, decimal? TargetPercent = null, string? Notes = null);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NetworkDto>>> List([FromQuery] string? search,
        [FromQuery] string? status, [FromQuery] string? type, CancellationToken ct)
    {
        var tenantId = TenantId;
        var q = _db.PartnerNetworks.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            q = q.Where(x => x.Code.Contains(term) || x.Name.Contains(term) ||
                (x.ManagerName != null && x.ManagerName.Contains(term)) ||
                (x.Email != null && x.Email.Contains(term)));
        }
        if (!string.IsNullOrWhiteSpace(status) && status != "all") q = q.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(type) && type != "all") q = q.Where(x => x.NetworkType == type);
        var rows = await q.OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(await BuildDtos(rows, tenantId, ct));
    }

    [HttpGet("{id:guid}/detail")]
    public async Task<ActionResult<DetailDto>> Detail(Guid id, CancellationToken ct)
    {
        var network = await FindNetwork(id, ct);
        var members = await _db.PartnerNetworkMembers.AsNoTracking()
            .Include(x => x.Producer)
            .Where(x => x.PartnerNetworkId == id && x.DeletedAt == null)
            .OrderByDescending(x => x.IsActive).ThenBy(x => x.Producer.Name).ToListAsync(ct);
        var documents = await _db.PartnerNetworkDocuments.AsNoTracking()
            .Where(x => x.PartnerNetworkId == id && x.DeletedAt == null)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var dto = (await BuildDtos(new[] { network }, TenantId, ct)).Single();
        return Ok(new DetailDto(dto, members.Select(ToMemberDto).ToList(), documents.Select(ToDocumentDto).ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<NetworkDto>> Create([FromBody] NetworkBody body, CancellationToken ct)
    {
        ValidateBody(body);
        var tenantId = TenantId;
        var code = body.Code.Trim().ToUpperInvariant();
        if (await _db.PartnerNetworks.AnyAsync(x => x.TenantId == tenantId && x.Code == code && x.DeletedAt == null, ct))
            throw new AppException("partner_network_code_taken", "Ο κωδικός δικτύου χρησιμοποιείται ήδη.", 409);
        var now = _clock.UtcNow;
        var row = new PartnerNetwork { Id = Guid.NewGuid(), TenantId = tenantId, Code = code, Name = body.Name.Trim(),
            Description = Clean(body.Description), NetworkType = Clean(body.NetworkType) ?? "Δίκτυο συνεργατών",
            Status = Clean(body.Status) ?? "Ενεργό", ManagerName = Clean(body.ManagerName), Email = CleanEmail(body.Email),
            Phone = Clean(body.Phone), SecondaryEmail = CleanEmail(body.SecondaryEmail), SecondaryPhone = Clean(body.SecondaryPhone),
            TaxId = Clean(body.TaxId), TaxOffice = Clean(body.TaxOffice), BusinessType = Clean(body.BusinessType),
            ProfessionalCategory = Clean(body.ProfessionalCategory), Address = Clean(body.Address), City = Clean(body.City),
            PostalCode = Clean(body.PostalCode), Website = Clean(body.Website), ContractNumber = Clean(body.ContractNumber),
            ContractStartDate = body.ContractStartDate, ContractEndDate = body.ContractEndDate,
            CommissionPolicyJson = Clean(body.CommissionPolicyJson), Notes = Clean(body.Notes), CreatedAt = now };
        _db.PartnerNetworks.Add(row); await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Detail), new { id = row.Id }, (await BuildDtos(new[] { row }, tenantId, ct)).Single());
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<NetworkDto>> Update(Guid id, [FromBody] NetworkBody body, CancellationToken ct)
    {
        ValidateBody(body);
        var row = await FindNetwork(id, ct);
        var code = body.Code.Trim().ToUpperInvariant();
        if (await _db.PartnerNetworks.AnyAsync(x => x.TenantId == TenantId && x.Id != id && x.Code == code && x.DeletedAt == null, ct))
            throw new AppException("partner_network_code_taken", "Ο κωδικός δικτύου χρησιμοποιείται ήδη.", 409);
        row.Code = code; row.Name = body.Name.Trim(); row.Description = Clean(body.Description);
        row.NetworkType = Clean(body.NetworkType) ?? "Δίκτυο συνεργατών"; row.Status = Clean(body.Status) ?? "Ενεργό";
        row.ManagerName = Clean(body.ManagerName); row.Email = CleanEmail(body.Email); row.Phone = Clean(body.Phone);
        row.SecondaryEmail = CleanEmail(body.SecondaryEmail); row.SecondaryPhone = Clean(body.SecondaryPhone);
        row.TaxId = Clean(body.TaxId); row.TaxOffice = Clean(body.TaxOffice); row.BusinessType = Clean(body.BusinessType);
        row.ProfessionalCategory = Clean(body.ProfessionalCategory); row.Address = Clean(body.Address); row.City = Clean(body.City);
        row.PostalCode = Clean(body.PostalCode); row.Website = Clean(body.Website); row.ContractNumber = Clean(body.ContractNumber);
        row.ContractStartDate = body.ContractStartDate; row.ContractEndDate = body.ContractEndDate;
        row.CommissionPolicyJson = Clean(body.CommissionPolicyJson); row.Notes = Clean(body.Notes); row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok((await BuildDtos(new[] { row }, TenantId, ct)).Single());
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var row = await FindNetwork(id, ct); row.DeletedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<MemberDto>> AddMember(Guid id, [FromBody] MemberBody body, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        var producer = await _db.Producers.FirstOrDefaultAsync(x => x.Id == body.ProducerId && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Συνεργάτης");
        if (await _db.PartnerNetworkMembers.AnyAsync(x => x.PartnerNetworkId == id && x.ProducerId == body.ProducerId && x.DeletedAt == null, ct))
            throw new AppException("partner_network_member_exists", "Ο συνεργάτης ανήκει ήδη στο δίκτυο.", 409);
        var row = new PartnerNetworkMember { Id = Guid.NewGuid(), TenantId = TenantId, PartnerNetworkId = id,
            ProducerId = producer.Id, Role = Clean(body.Role) ?? "Συνεργάτης", IsActive = body.IsActive, JoinedAt = body.JoinedAt,
            LeftAt = body.LeftAt, CommissionPercentOverride = body.CommissionPercentOverride, TargetPercent = body.TargetPercent,
            Notes = Clean(body.Notes), CreatedAt = _clock.UtcNow, Producer = producer };
        _db.PartnerNetworkMembers.Add(row); await _db.SaveChangesAsync(ct); return Ok(ToMemberDto(row));
    }

    [HttpPut("{id:guid}/members/{memberId:guid}")]
    public async Task<ActionResult<MemberDto>> UpdateMember(Guid id, Guid memberId, [FromBody] MemberBody body, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        var row = await _db.PartnerNetworkMembers.Include(x => x.Producer)
            .FirstOrDefaultAsync(x => x.Id == memberId && x.PartnerNetworkId == id && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Μέλος δικτύου");
        row.Role = Clean(body.Role) ?? "Συνεργάτης"; row.IsActive = body.IsActive; row.JoinedAt = body.JoinedAt; row.LeftAt = body.LeftAt;
        row.CommissionPercentOverride = body.CommissionPercentOverride; row.TargetPercent = body.TargetPercent; row.Notes = Clean(body.Notes); row.UpdatedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct); return Ok(ToMemberDto(row));
    }

    [HttpDelete("{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> DeleteMember(Guid id, Guid memberId, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        var row = await _db.PartnerNetworkMembers.FirstOrDefaultAsync(x => x.Id == memberId && x.PartnerNetworkId == id && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Μέλος δικτύου");
        row.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("{id:guid}/documents")]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<DocumentDto>> UploadDocument(Guid id, [FromForm] string? category,
        [FromForm] string? notes, IFormFile file, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        if (file is null || file.Length == 0) throw AppException.Validation("Επιλέξτε αρχείο για ανέβασμα.");
        await using var stream = file.OpenReadStream();
        var safeType = await _gate.InspectAsync(file.FileName, file.ContentType, file.Length, stream,
            FileUploadKind.Document, maxBytes: 50_000_000, ct);
        var path = await _storage.UploadAsync($"partner-networks/{TenantId:N}/{id:N}", file.FileName, safeType, stream, ct);
        var doc = new PartnerNetworkDocument { Id = Guid.NewGuid(), TenantId = TenantId, PartnerNetworkId = id,
            FileName = Path.GetFileName(file.FileName), StoragePath = path, MimeType = safeType, SizeBytes = file.Length,
            Category = Clean(category) ?? "Γενικά", Notes = Clean(notes), UploadedByUserId = _current.UserId, CreatedAt = _clock.UtcNow };
        _db.PartnerNetworkDocuments.Add(doc); await _db.SaveChangesAsync(ct); return Ok(ToDocumentDto(doc));
    }

    [HttpGet("{id:guid}/documents/{documentId:guid}/download")]
    public async Task<IActionResult> DownloadDocument(Guid id, Guid documentId, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        var doc = await _db.PartnerNetworkDocuments.FirstOrDefaultAsync(x => x.Id == documentId && x.PartnerNetworkId == id && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Έγγραφο");
        var stream = await _storage.DownloadAsync(doc.StoragePath, ct);
        return File(stream, doc.MimeType, doc.FileName);
    }

    [HttpDelete("{id:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid id, Guid documentId, CancellationToken ct)
    {
        await FindNetwork(id, ct);
        var doc = await _db.PartnerNetworkDocuments.FirstOrDefaultAsync(x => x.Id == documentId && x.PartnerNetworkId == id && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Έγγραφο");
        doc.DeletedAt = _clock.UtcNow; await _db.SaveChangesAsync(ct);
        try { await _storage.DeleteAsync(doc.StoragePath, ct); } catch { /* metadata remains auditable */ }
        return NoContent();
    }

    private async Task<PartnerNetwork> FindNetwork(Guid id, CancellationToken ct)
        => await _db.PartnerNetworks.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == TenantId && x.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Δίκτυο συνεργατών");

    private async Task<List<NetworkDto>> BuildDtos(IEnumerable<PartnerNetwork> networks, Guid tenantId, CancellationToken ct)
    {
        var rows = networks.ToList(); var ids = rows.Select(x => x.Id).ToList();
        var members = await _db.PartnerNetworkMembers.AsNoTracking().Where(x => ids.Contains(x.PartnerNetworkId) && x.TenantId == tenantId && x.DeletedAt == null).ToListAsync(ct);
        var producerIds = members.Select(x => x.ProducerId).Distinct().ToList();
        var policies = await _db.Policies.AsNoTracking().Where(x => x.TenantId == tenantId && x.DeletedAt == null && x.ProducerId.HasValue && producerIds.Contains(x.ProducerId.Value)).ToListAsync(ct);
        var policyIds = policies.Select(x => x.Id).ToList();
        var splits = await _db.PolicyCommissionSplits.AsNoTracking()
            .Where(x => x.TenantId == tenantId && policyIds.Contains(x.PolicyId) && x.ProducerId.HasValue && producerIds.Contains(x.ProducerId.Value))
            .ToListAsync(ct);
        return rows.Select(row => {
            var memberRows = members.Where(x => x.PartnerNetworkId == row.Id).ToList();
            var pids = memberRows.Select(x => x.ProducerId).ToHashSet();
            var networkPolicies = policies.Where(x => x.ProducerId.HasValue && pids.Contains(x.ProducerId.Value)).ToList();
            var gross = networkPolicies.Sum(x => x.Premium);
            // The network's office share is deliberately reported as the remainder
            // of any explicit producer commission split, never a new calculation.
            var networkPolicyIds = networkPolicies.Select(x => x.Id).ToHashSet();
            var producerCommission = splits.Where(x => networkPolicyIds.Contains(x.PolicyId)).Sum(x => x.GrossAmount);
            return new NetworkDto(row.Id, row.Code, row.Name, row.Description, row.NetworkType, row.Status, row.ManagerName,
                row.Email, row.Phone, row.SecondaryEmail, row.SecondaryPhone, row.TaxId, row.TaxOffice, row.BusinessType,
                row.ProfessionalCategory, row.Address, row.City, row.PostalCode, row.Website, row.LogoPath, row.ContractNumber,
                row.ContractStartDate, row.ContractEndDate, row.CommissionPolicyJson, row.Notes, memberRows.Count,
                memberRows.Count(x => x.IsActive), networkPolicies.Count, gross, producerCommission, gross - producerCommission, row.CreatedAt);
        }).ToList();
    }

    private static MemberDto ToMemberDto(PartnerNetworkMember x) => new(x.Id, x.ProducerId, x.Producer?.Name ?? "", x.Producer?.Code ?? "",
        x.Role, x.IsActive, x.JoinedAt, x.LeftAt, x.CommissionPercentOverride, x.TargetPercent, x.Notes);
    private static DocumentDto ToDocumentDto(PartnerNetworkDocument x) => new(x.Id, x.FileName, x.MimeType, x.SizeBytes, x.Category, x.Notes, x.CreatedAt);
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string? CleanEmail(string? value) => Clean(value)?.ToLowerInvariant();
    private static void ValidateBody(NetworkBody body)
    {
        if (string.IsNullOrWhiteSpace(body.Code)) throw AppException.Validation("Ο κωδικός δικτύου είναι υποχρεωτικός.");
        if (string.IsNullOrWhiteSpace(body.Name)) throw AppException.Validation("Το όνομα δικτύου είναι υποχρεωτικό.");
        if (body.Code.Length > 64 || body.Name.Length > 200) throw AppException.Validation("Ο κωδικός ή το όνομα είναι πολύ μεγάλο.");
    }
}
