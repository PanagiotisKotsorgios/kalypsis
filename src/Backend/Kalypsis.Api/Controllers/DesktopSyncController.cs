using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Kalypsis.Domain.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

/// <summary>
/// Secure bridge used by KALYPSIS Desktop.  It deliberately excludes users,
/// refresh tokens, secrets and platform configuration.  Only the tenant's
/// operational records are exchanged, and every row is re-scoped to the
/// authenticated tenant before it is inserted or updated.
/// </summary>
[ApiController]
[Route("api/desktop-sync")]
[Authorize(Policy = "AgencyStaff")]
public sealed class DesktopSyncController : ControllerBase
{
    private static readonly JsonSerializerOptions SyncJson = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly AppDbContext _db;
    private readonly Kalypsis.Application.Abstractions.ICurrentUser _current;

    public DesktopSyncController(AppDbContext db, Kalypsis.Application.Abstractions.ICurrentUser current)
    {
        _db = db;
        _current = current;
    }

    public sealed record SyncRequest(
        string? ClientId,
        DateTime? SinceUtc,
        string? ConflictPolicy,
        string? DeletionPolicy,
        JsonElement Data);

    [HttpGet("health")]
    public ActionResult<object> Health()
        => Ok(new { ok = true, protocol = "kalypsis-desktop-sync", version = 1, serverTimeUtc = DateTime.UtcNow });

    [HttpPost("sync")]
    [RequestSizeLimit(64L * 1024 * 1024)]
    public async Task<ActionResult<object>> Sync([FromBody] SyncRequest request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var conflict = NormalizeConflict(request.ConflictPolicy);

        var pushed = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        pushed["customers"] = await UpsertAsync<Customer>(request.Data, "customers", tenantId, conflict, ct);
        pushed["producers"] = await UpsertAsync<Producer>(request.Data, "producers", tenantId, conflict, ct);
        pushed["carriers"] = await UpsertAsync<InsuranceCompany>(request.Data, "carriers", tenantId, conflict, ct);
        pushed["policies"] = await UpsertAsync<Policy>(request.Data, "policies", tenantId, conflict, ct);
        pushed["claims"] = await UpsertAsync<Claim>(request.Data, "claims", tenantId, conflict, ct);
        pushed["receipts"] = await UpsertAsync<Receipt>(request.Data, "receipts", tenantId, conflict, ct);
        pushed["payments"] = await UpsertAsync<Payment>(request.Data, "payments", tenantId, conflict, ct);
        pushed["tasks"] = await UpsertAsync<AgencyTask>(request.Data, "tasks", tenantId, conflict, ct);
        pushed["appointments"] = await UpsertAsync<Appointment>(request.Data, "appointments", tenantId, conflict, ct);
        pushed["instructions"] = await UpsertAsync<AgencyInstruction>(request.Data, "instructions", tenantId, conflict, ct);
        await _db.SaveChangesAsync(ct);

        // Pull after the push so both sides converge to the same server state.
        // A full pull is used for the first sync; later calls can pass SinceUtc
        // to keep the payload small.  DeletedAt is included, so the client can
        // apply the configured tombstone policy without physical deletes.
        var data = await ExportAsync(tenantId, request.SinceUtc, ct);
        return Ok(new
        {
            protocol = "kalypsis-desktop-sync",
            version = 1,
            serverTimeUtc = DateTime.UtcNow,
            lastSyncUtc = DateTime.UtcNow,
            conflictPolicy = conflict,
            deletionPolicy = NormalizeDeletion(request.DeletionPolicy),
            pushed,
            data = data.Data,
            summary = data.Summary,
        });
    }

    private async Task<int> UpsertAsync<T>(JsonElement data, string key, Guid tenantId, string conflict, CancellationToken ct)
        where T : BaseEntity
    {
        if (!data.TryGetProperty(key, out var rows) || rows.ValueKind != JsonValueKind.Array)
            return 0;

        var items = rows.EnumerateArray()
            .Select(NormalizeDesktopRow<T>)
            .Select(row => row.Deserialize<T>(SyncJson))
            .Where(row => row is not null)
            .Cast<T>()
            .ToList();
        var processed = 0;
        foreach (var item in items)
        {
            if (item.Id == Guid.Empty) item.Id = Guid.NewGuid();
            if (item is TenantEntity tenant) tenant.TenantId = tenantId;
            if (item is InsuranceCompany carrier) carrier.TenantId = tenantId;

            // Older desktop databases may contain demo/legacy customers
            // without a customer number.  CustomerNumber is unique in the
            // web database, so allowing several empty values would make an
            // otherwise valid sync fail with a database duplicate-key error.
            // Use a deterministic, non-user-facing bridge identifier instead
            // of changing any of the customer's actual profile data.  The
            // same desktop row gets the same value on every subsequent sync.
            if (item is Customer customer && string.IsNullOrWhiteSpace(customer.CustomerNumber))
                customer.CustomerNumber = $"DESKTOP-{item.Id:N}";

            // Required relationships cannot be represented by an orphaned
            // desktop row.  Skip those rows instead of creating an invalid FK
            // or a record that can never be opened in the web application.
            if (item is Claim claim && claim.PolicyId == Guid.Empty) continue;
            if (item is Receipt receipt && receipt.CustomerId == Guid.Empty) continue;

            var existing = await _db.Set<T>().IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Id == item.Id, ct);

            // Global carriers are read-only catalog rows.  Never allow a
            // desktop tenant to overwrite one belonging to another tenant.
            if (existing is InsuranceCompany existingCarrier)
            {
                // A null TenantId is the shared carrier catalogue.  It must
                // never be claimed or mutated by a tenant sync.
                if (existingCarrier.TenantId is null || existingCarrier.TenantId != tenantId)
                    continue;
            }

            if (existing is null)
            {
                // The desktop may carry a copy of a global catalogue row. Do
                // not create a tenant duplicate when the same carrier code is
                // already present globally.
                if (item is InsuranceCompany incomingCarrier &&
                    !string.IsNullOrWhiteSpace(incomingCarrier.Code) &&
                    await _db.InsuranceCompanies.IgnoreQueryFilters().AnyAsync(
                        x => x.TenantId == null && x.Code == incomingCarrier.Code, ct))
                    continue;
                _db.Set<T>().Add(item);
                processed++;
                continue;
            }

            if (conflict == "cloud_wins")
            {
                // The desktop row loses only when the cloud row is newer.
                // When there is no comparable timestamp, cloud wins by choice.
                var localUpdated = existing.UpdatedAt ?? existing.CreatedAt;
                var incomingUpdated = item.UpdatedAt ?? item.CreatedAt;
                if (incomingUpdated < localUpdated) continue;
            }
            else if (conflict == "local_wins")
            {
                var localUpdated = existing.UpdatedAt ?? existing.CreatedAt;
                var incomingUpdated = item.UpdatedAt ?? item.CreatedAt;
                if (incomingUpdated <= localUpdated) continue;
            }

            _db.Entry(existing).CurrentValues.SetValues(item);
            if (existing is TenantEntity existingTenant) existingTenant.TenantId = tenantId;
            if (existing is InsuranceCompany existingScopedCarrier) existingScopedCarrier.TenantId = tenantId;
            processed++;
        }
        return processed;
    }

    /// <summary>
    /// Desktop and Web deliberately keep their native models (DateOnly vs
    /// DateTime, richer Greek field names, and local-only fields).  The sync
    /// envelope therefore accepts the desktop shape and normalises only the
    /// stable cross-platform aliases before EF materialises the cloud model.
    /// Unknown fields remain ignored, which keeps the bridge forwards
    /// compatible when either product gains a new local field.
    /// </summary>
    private static JsonElement NormalizeDesktopRow<T>(JsonElement source)
    {
        var node = JsonNode.Parse(source.GetRawText())?.AsObject() ?? new JsonObject();

        void Alias(string canonical, params string[] aliases)
        {
            if (node.ContainsKey(canonical)) return;
            foreach (var alias in aliases)
            {
                if (node.TryGetPropertyValue(alias, out var value) && value is not null)
                {
                    node[canonical] = value.DeepClone();
                    return;
                }
            }
        }

        void DateOnlyAlias(string canonical, params string[] aliases)
        {
            Alias(canonical, aliases);
            if (node[canonical] is JsonValue value && value.TryGetValue<string>(out var raw) &&
                DateTime.TryParse(raw, out var date))
                node[canonical] = date.ToString("yyyy-MM-dd");
        }

        switch (typeof(T).Name)
        {
            case nameof(Customer):
                Alias("CustomerNumber", "CustomerCode");
                Alias("Type", "Kind");
                if (node["Type"] is JsonValue customerType &&
                    customerType.TryGetValue<string>(out var customerTypeName))
                    node["Type"] = customerTypeName switch
                    {
                        "Legal" or "Business" or "法人" => "Company",
                        _ => customerTypeName,
                    };
                Alias("CompanyName", "LegalName");
                Alias("VatNumber", "AfmVat");
                Alias("Source", "Origin");
                DateOnlyAlias("BirthDate", "BirthDate");
                DateOnlyAlias("DriverLicenseIssueDate", "DriverLicenseIssuedOn");
                DateOnlyAlias("DriverLicenseExpiryDate", "DriverLicenseExpiresOn");
                break;
            case nameof(Producer):
                Alias("TaxId", "AfmVat");
                Alias("Iban", "BankAccount");
                Alias("ProfessionalCategory", "PartnerCategory", "OverCommissionCategory");
                Alias("HasContract", "HasSignedContract");
                DateOnlyAlias("ContractStartDate", "ContractFrom");
                DateOnlyAlias("ContractEndDate", "ContractTo");
                DateOnlyAlias("LicenseExpiryDate", "RegistryTo");
                if (!node.ContainsKey("Status") && node.TryGetPropertyValue("IsActive", out var active) &&
                    active is JsonValue activeValue && activeValue.TryGetValue<bool>(out var isActive))
                    node["Status"] = isActive ? "Active" : "Inactive";
                break;
            case nameof(Policy):
                Alias("EffectiveFrom", "StartDate");
                Alias("EffectiveTo", "EndDate");
                Alias("GrossPremium", "Premium");
                Alias("Plate", "VehicleRegistrationPlate");
                Alias("LineOfBusiness", "CarrierBranchCode");
                break;
            case nameof(Receipt):
                Alias("Number", "ReceiptNumber");
                Alias("ReceivedOn", "ReceiptDate");
                Alias("Method", "PaymentMethod");
                Alias("TransactionReference", "Reference");
                break;
            case nameof(Payment):
                Alias("Number", "PaymentNumber");
                Alias("PaidOn", "PaymentDate");
                Alias("BeneficiaryType", "RecipientKind");
                Alias("BeneficiaryName", "RecipientName");
                Alias("Method", "PaymentMethod");
                Alias("TransactionReference", "Reference");
                if (node["BeneficiaryType"] is JsonValue beneficiary &&
                    beneficiary.TryGetValue<string>(out var beneficiaryName))
                    node["BeneficiaryType"] = beneficiaryName switch
                    {
                        "Carrier" => "InsuranceCompany",
                        "Customer" => "Vendor",
                        _ => beneficiaryName,
                    };
                break;
            case nameof(Claim):
                DateOnlyAlias("IncidentDate", "IncidentDate");
                DateOnlyAlias("ReportedDate", "ReportedDate");
                Alias("ClaimedAmount", "EstimatedAmount");
                Alias("ApprovedAmount", "SettledAmount");
                if (node["Status"] is JsonValue claimStatus &&
                    claimStatus.TryGetValue<string>(out var claimStatusName))
                    node["Status"] = claimStatusName switch
                    {
                        "Pending" or "InProgress" => "UnderReview",
                        "Settled" => "Paid",
                        _ => claimStatusName,
                    };
                break;
            case nameof(AgencyTask):
                Alias("CustomerId", "RelatedCustomerId");
                Alias("DueAt", "DueDate");
                break;
            case nameof(Appointment):
                Alias("AssignedToUserId", "OwnerUserId");
                break;
            case nameof(AgencyInstruction):
                Alias("ContentHtml", "Body");
                Alias("UpdatedByUserId", "AuthorUserId");
                break;
        }

        return JsonSerializer.SerializeToElement(node, SyncJson);
    }

    private async Task<(Dictionary<string, JsonElement> Data, Dictionary<string, int> Summary)> ExportAsync(
        Guid tenantId, DateTime? sinceUtc, CancellationToken ct)
    {
        var customers = await _db.Customers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var producers = await _db.Producers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == null || x.TenantId == tenantId).ToListAsync(ct);
        var policies = await _db.Policies.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var claims = await _db.Claims.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var receipts = await _db.Receipts.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var payments = await _db.Payments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var tasks = await _db.AgencyTasks.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var appointments = await _db.Appointments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var instructions = await _db.AgencyInstructions.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);

        var data = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase)
        {
            ["customers"] = JsonSerializer.SerializeToElement(customers, SyncJson),
            ["producers"] = JsonSerializer.SerializeToElement(producers, SyncJson),
            ["carriers"] = JsonSerializer.SerializeToElement(carriers, SyncJson),
            ["policies"] = JsonSerializer.SerializeToElement(policies, SyncJson),
            ["claims"] = JsonSerializer.SerializeToElement(claims, SyncJson),
            ["receipts"] = JsonSerializer.SerializeToElement(receipts, SyncJson),
            ["payments"] = JsonSerializer.SerializeToElement(payments, SyncJson),
            ["tasks"] = JsonSerializer.SerializeToElement(tasks, SyncJson),
            ["appointments"] = JsonSerializer.SerializeToElement(appointments, SyncJson),
            ["instructions"] = JsonSerializer.SerializeToElement(instructions, SyncJson),
        };
        var summary = data.ToDictionary(x => x.Key, x => x.Value.GetArrayLength(), StringComparer.OrdinalIgnoreCase);
        return (data, summary);
    }

    private static string NormalizeConflict(string? value)
        => value?.Trim().ToLowerInvariant() switch
        {
            "local_wins" => "local_wins",
            "cloud_wins" => "cloud_wins",
            "keep_both" => "keep_both",
            _ => "last_write_wins",
        };

    private static string NormalizeDeletion(string? value)
        => value?.Trim().ToLowerInvariant() switch
        {
            "cloud_only" => "cloud_only",
            "local_only" => "local_only",
            "delete_both" => "delete_both",
            _ => "keep_both",
        };
}
