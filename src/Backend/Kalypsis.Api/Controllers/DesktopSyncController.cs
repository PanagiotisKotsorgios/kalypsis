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
    private readonly ILogger<DesktopSyncController> _logger;

    public DesktopSyncController(
        AppDbContext db,
        Kalypsis.Application.Abstractions.ICurrentUser current,
        ILogger<DesktopSyncController> logger)
    {
        _db = db;
        _current = current;
        _logger = logger;
    }

    public sealed record SyncRequest(
        string? ClientId,
        DateTime? SinceUtc,
        string? ConflictPolicy,
        string? DeletionPolicy,
        JsonElement Data);

    [HttpGet("health")]
    public ActionResult<object> Health()
        => Ok(new { ok = true, protocol = "kalypsis-desktop-sync", version = 6, serverTimeUtc = DateTime.UtcNow });

    [HttpPost("sync")]
    [RequestSizeLimit(64L * 1024 * 1024)]
    public async Task<ActionResult<object>> Sync([FromBody] SyncRequest request, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var conflict = NormalizeConflict(request.ConflictPolicy);
        var warnings = new List<string>();
        var dataNode = JsonNode.Parse(request.Data.GetRawText())?.AsObject() ?? new JsonObject();
        var syncData = ToSyncElement(dataNode);

        var pushed = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        pushed["customers"] = await UpsertAsync<Customer>(syncData, "customers", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("πελάτες", warnings, ct);

        pushed["producers"] = await UpsertAsync<Producer>(syncData, "producers", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("συνεργάτες", warnings, ct);

        pushed["carriers"] = await UpsertAsync<InsuranceCompany>(syncData, "carriers", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("ασφαλιστικές", warnings, ct);

        // Desktop and Cloud use independent catalogue IDs.  Resolve the
        // references by stable producer/carrier codes before policies are
        // materialised, otherwise a valid local policy would violate a Cloud
        // foreign key even though both sides contain the same company.
        var carrierMap = await BuildCarrierMapAsync(syncData, tenantId, ct);
        var producerMap = await BuildProducerMapAsync(syncData, tenantId, ct);
        var customerMap = await BuildCustomerMapAsync(syncData, tenantId, ct);
        var removedPolicies = RewriteReferences(dataNode, carrierMap, producerMap, customerMap);
        if (removedPolicies > 0)
            warnings.Add($"{removedPolicies} εγγραφές συμβολαίων παραλείφθηκαν επειδή έλειπε ο απαιτούμενος πελάτης ή η ασφαλιστική εταιρεία.");
        syncData = ToSyncElement(dataNode);

        pushed["customerRelationships"] = await UpsertAsync<CustomerRelationship>(syncData, "customerRelationships", tenantId, conflict, warnings, ct);
        pushed["customerFamilyMembers"] = await UpsertAsync<CustomerFamilyMember>(syncData, "customerFamilyMembers", tenantId, conflict, warnings, ct);
        pushed["customerAssets"] = await UpsertAsync<CustomerAsset>(syncData, "customerAssets", tenantId, conflict, warnings, ct);
        pushed["customerInsuranceNeeds"] = await UpsertAsync<CustomerInsuranceNeed>(syncData, "customerInsuranceNeeds", tenantId, conflict, warnings, ct);
        pushed["customerContacts"] = await UpsertAsync<CustomerContact>(syncData, "customerContacts", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("οικογένεια και ανάγκες πελατών", warnings, ct);

        pushed["policies"] = await UpsertAsync<Policy>(syncData, "policies", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("συμβόλαια", warnings, ct);
        pushed["policyObjects"] = await UpsertAsync<PolicyObject>(syncData, "policyObjects", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("αντικείμενα συμβολαίων", warnings, ct);
        pushed["policyCovers"] = await UpsertAsync<PolicyCover>(syncData, "policyCovers", tenantId, conflict, warnings, ct);
        pushed["policyInstallments"] = await UpsertAsync<PolicyInstallment>(syncData, "policyInstallments", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("καλύψεις και δόσεις", warnings, ct);
        pushed["claims"] = await UpsertAsync<Claim>(syncData, "claims", tenantId, conflict, warnings, ct);
        pushed["receipts"] = await UpsertAsync<Receipt>(syncData, "receipts", tenantId, conflict, warnings, ct);
        pushed["payments"] = await UpsertAsync<Payment>(syncData, "payments", tenantId, conflict, warnings, ct);
        pushed["tasks"] = await UpsertAsync<AgencyTask>(syncData, "tasks", tenantId, conflict, warnings, ct);
        pushed["appointments"] = await UpsertAsync<Appointment>(syncData, "appointments", tenantId, conflict, warnings, ct);
        pushed["instructions"] = await UpsertAsync<AgencyInstruction>(syncData, "instructions", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("λειτουργικά δεδομένα", warnings, ct);

        pushed["producerCardEntries"] = await UpsertAsync<ProducerCardEntry>(syncData, "producerCardEntries", tenantId, conflict, warnings, ct);
        pushed["claimInvolvedParties"] = await UpsertAsync<ClaimInvolvedParty>(syncData, "claimInvolvedParties", tenantId, conflict, warnings, ct);
        pushed["emailTemplates"] = await UpsertAsync<EmailTemplate>(syncData, "emailTemplates", tenantId, conflict, warnings, ct);
        pushed["overCommissionStatements"] = await UpsertAsync<OverCommissionStatement>(syncData, "overCommissionStatements", tenantId, conflict, warnings, ct);
        pushed["generalFinancialEntries"] = await UpsertAsync<GeneralFinancialEntry>(syncData, "generalFinancialEntries", tenantId, conflict, warnings, ct);
        pushed["advancePayments"] = await UpsertAsync<AdvancePayment>(syncData, "advancePayments", tenantId, conflict, warnings, ct);
        pushed["creditNotes"] = await UpsertAsync<CreditNote>(syncData, "creditNotes", tenantId, conflict, warnings, ct);
        pushed["partyLedgerEntries"] = await UpsertAsync<PartyLedgerEntry>(syncData, "partyLedgerEntries", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("καρτέλες συναλλασσομένων", warnings, ct);
        pushed["ledgerAllocations"] = await UpsertAsync<LedgerAllocation>(syncData, "ledgerAllocations", tenantId, conflict, warnings, ct);
        await FlushSyncPhaseAsync("επικοινωνία και οικονομικά", warnings, ct);

        // Pull after the push so both sides converge to the same server state.
        // A full pull is used for the first sync; later calls can pass SinceUtc
        // to keep the payload small.  DeletedAt is included, so the client can
        // apply the configured tombstone policy without physical deletes.
        var exported = await ExportAsync(tenantId, request.SinceUtc, ct);
        return Ok(new
        {
            protocol = "kalypsis-desktop-sync",
            version = 6,
            serverTimeUtc = DateTime.UtcNow,
            lastSyncUtc = DateTime.UtcNow,
            conflictPolicy = conflict,
            deletionPolicy = NormalizeDeletion(request.DeletionPolicy),
            pushed,
            warnings,
            data = exported.Data,
            summary = exported.Summary,
        });
    }

    private async Task<int> UpsertAsync<T>(JsonElement data, string key, Guid tenantId, string conflict,
        List<string> warnings, CancellationToken ct)
        where T : BaseEntity
    {
        if (!data.TryGetProperty(key, out var rows) || rows.ValueKind != JsonValueKind.Array)
            return 0;

        var items = new List<T>();
        // Track the scalar members supplied by Desktop for every entity.
        // The two clients do not have identical schemas; replacing an entire
        // Cloud row would erase Cloud-only fields (including financial links).
        var suppliedFields = new Dictionary<Guid, HashSet<string>>();
        var rowNumber = 0;
        foreach (var rawRow in rows.EnumerateArray())
        {
            rowNumber++;
            try
            {
                var normalized = NormalizeDesktopRow<T>(rawRow);
                var item = normalized.Deserialize<T>(SyncJson);
                if (item is not null)
                {
                    items.Add(item);
                    suppliedFields[item.Id] = normalized.EnumerateObject()
                        .Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
                }
            }
            catch (Exception ex)
            {
                // One legacy/forward-compatible row must not abort the complete
                // bridge.  Keep the warning intentionally value-free: sync
                // responses must never echo customer data or secrets.
                _logger.LogWarning(ex, "Desktop sync skipped invalid {Entity} row {RowNumber}", key, rowNumber);
                warnings.Add($"Παραλείφθηκε μία μη συμβατή εγγραφή από το {key} (γραμμή {rowNumber}).");
            }
        }
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
            if(existing is TenantEntity foreignTenant&&foreignTenant.TenantId!=tenantId)continue;

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

            var hasIncomingTimestamp = suppliedFields.TryGetValue(item.Id, out var timeFields)
                && (timeFields.Contains("UpdatedAt") || timeFields.Contains("CreatedAt"));
            if (conflict == "cloud_wins" && hasIncomingTimestamp)
            {
                // The desktop row loses only when the cloud row is newer.
                // When there is no comparable timestamp, cloud wins by choice.
                var localUpdated = existing.UpdatedAt ?? existing.CreatedAt;
                var incomingUpdated = item.UpdatedAt ?? item.CreatedAt;
                if (incomingUpdated < localUpdated) continue;
            }
            else if (conflict == "local_wins" && hasIncomingTimestamp)
            {
                var localUpdated = existing.UpdatedAt ?? existing.CreatedAt;
                var incomingUpdated = item.UpdatedAt ?? item.CreatedAt;
                if (incomingUpdated <= localUpdated) continue;
            }
            else if (conflict == "last_write_wins" && hasIncomingTimestamp)
            {
                var cloudUpdated = existing.UpdatedAt ?? existing.CreatedAt;
                var desktopUpdated = item.UpdatedAt ?? item.CreatedAt;
                // A sync must not blindly replace newer Cloud rows with the
                // same older desktop snapshot. Use the row timestamps for the
                // advertised Last Write Wins policy.
                if (desktopUpdated <= cloudUpdated) continue;
            }

            if(suppliedFields.TryGetValue(item.Id,out var fields))
            {
                // An incoming snapshot owns only members it actually sent.
                var entry=_db.Entry(existing);
                foreach(var property in entry.Properties)
                    if(property.Metadata.Name is not ("Id" or "TenantId")&&fields.Contains(property.Metadata.Name))
                        property.CurrentValue=typeof(T).GetProperty(property.Metadata.Name)?.GetValue(item);
            }
            else _db.Entry(existing).CurrentValues.SetValues(item);
            if (existing is TenantEntity existingTenant) existingTenant.TenantId = tenantId;
            if (existing is InsuranceCompany existingScopedCarrier) existingScopedCarrier.TenantId = tenantId;
            processed++;
        }
        return processed;
    }

    private static JsonElement ToSyncElement(JsonObject node)
        => JsonSerializer.SerializeToElement(node, SyncJson);

    private async Task FlushSyncPhaseAsync(string phase, List<string> warnings, CancellationToken ct)
    {
        if (!_db.ChangeTracker.HasChanges()) return;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // The entity write can already have committed before the paired
            // audit write fails (AppDbContext persists those in two steps).
            // Clear the tracker and continue with the next phase; a single
            // legacy row must never turn the entire bridge into a 500 response.
            _logger.LogWarning(ex, "Desktop sync phase {Phase} was partially skipped", phase);
            _db.ChangeTracker.Clear();
            warnings.Add($"Ο συγχρονισμός ολοκληρώθηκε με προειδοποίηση στο στάδιο «{phase}».");
        }
    }

    private async Task<Dictionary<Guid, Guid>> BuildCarrierMapAsync(JsonElement data, Guid tenantId, CancellationToken ct)
    {
        var rows = data.TryGetProperty("carriers", out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().ToList()
            : new List<JsonElement>();
        var cloud = await _db.InsuranceCompanies.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == null || x.TenantId == tenantId).ToListAsync(ct);
        var map = cloud.ToDictionary(x => x.Id, x => x.Id);
        foreach (var row in rows)
        {
            if (!TryGuid(row, "Id", out var localId)) continue;
            if (cloud.FirstOrDefault(x => x.Id == localId) is { } byId)
            {
                map[localId] = byId.Id;
                continue;
            }
            var code = NormalizeKey(GetText(row, "Code"));
            var match = cloud.FirstOrDefault(x => !string.IsNullOrWhiteSpace(code)
                && string.Equals(NormalizeKey(x.Code), code, StringComparison.OrdinalIgnoreCase));
            if (match is not null) map[localId] = match.Id;
        }
        return map;
    }

    private async Task<Dictionary<Guid, Guid>> BuildProducerMapAsync(JsonElement data, Guid tenantId, CancellationToken ct)
    {
        var rows = data.TryGetProperty("producers", out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().ToList()
            : new List<JsonElement>();
        var cloud = await _db.Producers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var map = cloud.ToDictionary(x => x.Id, x => x.Id);
        foreach (var row in rows)
        {
            if (!TryGuid(row, "Id", out var localId)) continue;
            if (cloud.FirstOrDefault(x => x.Id == localId) is { } byId)
            {
                map[localId] = byId.Id;
                continue;
            }
            var code = NormalizeKey(GetText(row, "Code"));
            var match = cloud.FirstOrDefault(x => !string.IsNullOrWhiteSpace(code)
                && string.Equals(NormalizeKey(x.Code), code, StringComparison.OrdinalIgnoreCase));
            if (match is not null) map[localId] = match.Id;
        }
        return map;
    }

    private async Task<Dictionary<Guid, Guid>> BuildCustomerMapAsync(JsonElement data, Guid tenantId, CancellationToken ct)
    {
        var rows = data.TryGetProperty("customers", out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().ToList()
            : new List<JsonElement>();
        var cloud = await _db.Customers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId).ToListAsync(ct);
        var map = cloud.ToDictionary(x => x.Id, x => x.Id);
        foreach (var row in rows)
        {
            if (!TryGuid(row, "Id", out var localId)) continue;
            if (cloud.FirstOrDefault(x => x.Id == localId) is { } byId)
            {
                map[localId] = byId.Id;
                continue;
            }
            var number = NormalizeKey(GetText(row, "CustomerNumber") ?? GetText(row, "CustomerCode"));
            var match = cloud.FirstOrDefault(x => !string.IsNullOrWhiteSpace(number)
                && string.Equals(NormalizeKey(x.CustomerNumber), number, StringComparison.OrdinalIgnoreCase));
            if (match is not null) map[localId] = match.Id;
        }
        return map;
    }

    private static int RewriteReferences(
        JsonObject data,
        IReadOnlyDictionary<Guid, Guid> carriers,
        IReadOnlyDictionary<Guid, Guid> producers,
        IReadOnlyDictionary<Guid, Guid> customers)
    {
        var removedPolicies = 0;
        var policyIds = new HashSet<Guid>();
        if (data["policies"] is JsonArray policies)
        {
            for (var i = policies.Count - 1; i >= 0; i--)
            {
                if (policies[i] is not JsonObject row) continue;
                var customerOk = RewriteRequired(row, "CustomerId", customers);
                var carrierOk = RewriteRequired(row, "InsuranceCompanyId", carriers);
                if (!customerOk || !carrierOk)
                {
                    policies.RemoveAt(i);
                    removedPolicies++;
                    continue;
                }
                RewriteOptional(row, "ContractPartyCustomerId", customers);
                RewriteOptional(row, "PreviousInsuranceCompanyId", carriers);
                RewriteOptional(row, "ProducerId", producers);
                row.Remove("CreatedByUserId"); // web users are not shared with Desktop
                if (TryGuid(row, "Id", out var policyId)) policyIds.Add(policyId);
            }
        }

        RewriteRows(data["claims"] as JsonArray, "PolicyId", policyIds);
        RewriteRows(data["receipts"] as JsonArray, "CustomerId", customers.Keys.ToHashSet());
        RewriteOptionalRows(data["receipts"] as JsonArray, "PolicyId", policyIds);
        RewriteOptionalRows(data["payments"] as JsonArray, "PolicyId", policyIds);
        RewriteOptionalRows(data["payments"] as JsonArray, "BeneficiaryInsuranceCompanyId", carriers);
        RewriteOptionalRows(data["payments"] as JsonArray, "BeneficiaryProducerId", producers);
        RewriteOptionalRows(data["tasks"] as JsonArray, "CustomerId", customers);
        RewriteOptionalRows(data["tasks"] as JsonArray, "ProducerId", producers);
        RewriteOptionalRows(data["tasks"] as JsonArray, "PolicyId", policyIds);
        RewriteOptionalRows(data["appointments"] as JsonArray, "CustomerId", customers);
        RewriteOptionalRows(data["appointments"] as JsonArray, "ProducerId", producers);
        RewriteOptionalRows(data["appointments"] as JsonArray, "PolicyId", policyIds);
        RewriteRequiredRows(data["producerCardEntries"] as JsonArray, "ProducerId", producers);
        RewriteRequiredRows(data["overCommissionStatements"] as JsonArray, "ProducerId", producers);
        RewriteRequiredRows(data["overCommissionStatements"] as JsonArray, "InsuranceCompanyId", carriers);
        RewriteOptionalRows(data["generalFinancialEntries"] as JsonArray, "PolicyId", policyIds);
        RewriteOptionalRows(data["generalFinancialEntries"] as JsonArray, "CustomerId", customers);
        RewriteOptionalRows(data["generalFinancialEntries"] as JsonArray, "ProducerId", producers);
        RewriteOptionalRows(data["creditNotes"] as JsonArray, "PolicyId", policyIds);
        RewriteOptionalRows(data["creditNotes"] as JsonArray, "CustomerId", customers);
        RewriteOptionalRows(data["creditNotes"] as JsonArray, "ProducerId", producers);
        RewriteOptionalRows(data["creditNotes"] as JsonArray, "InsuranceCompanyId", carriers);
        RewriteRequiredRows(data["customerRelationships"] as JsonArray, "CustomerId", customers);
        RewriteRequiredRows(data["customerRelationships"] as JsonArray, "RelatedCustomerId", customers);
        RewriteRequiredRows(data["customerFamilyMembers"] as JsonArray, "CustomerId", customers);
        RewriteRequiredRows(data["customerAssets"] as JsonArray, "CustomerId", customers);
        RewriteRequiredRows(data["customerInsuranceNeeds"] as JsonArray, "CustomerId", customers);
        RewriteRequiredRows(data["customerContacts"] as JsonArray, "CustomerId", customers);
        if (data["partyLedgerEntries"] is JsonArray ledger)
            for (var i = ledger.Count - 1; i >= 0; i--)
            {
                if (ledger[i] is not JsonObject line) continue;
                var kind = line["PartyKind"]?.ToString() ?? "";
                var partyMap = kind.Equals("Producer", StringComparison.OrdinalIgnoreCase) ? producers :
                    kind.Equals("Carrier", StringComparison.OrdinalIgnoreCase) ||
                    kind.Equals("InsuranceCompany", StringComparison.OrdinalIgnoreCase) ? carriers : customers;
                if (!RewriteRequired(line, "PartyId", partyMap)) ledger.RemoveAt(i);
                else RewriteOptional(line, "PolicyId", policyIds.ToDictionary(x => x, x => x));
            }
        var claimIds = (data["claims"] as JsonArray)?.OfType<JsonObject>()
            .Select(x => TryGuid(x, "Id", out var id) ? id : Guid.Empty)
            .Where(x => x != Guid.Empty).ToHashSet() ?? new HashSet<Guid>();
        RewriteRows(data["claimInvolvedParties"] as JsonArray, "ClaimId", claimIds);
        return removedPolicies;
    }

    private static bool RewriteRequired(JsonObject row, string property, IReadOnlyDictionary<Guid, Guid> map)
    {
        if (!TryGuid(row, property, out var value) || !map.TryGetValue(value, out var mapped)) return false;
        row[property] = mapped.ToString();
        return true;
    }

    private static void RewriteOptional(JsonObject row, string property, IReadOnlyDictionary<Guid, Guid> map)
    {
        if (!TryGuid(row, property, out var value)) return;
        if (map.TryGetValue(value, out var mapped)) row[property] = mapped.ToString();
        else row.Remove(property);
    }

    private static void RewriteRows(JsonArray? rows, string property, IReadOnlySet<Guid> allowed)
    {
        if (rows is null) return;
        for (var i = rows.Count - 1; i >= 0; i--)
        {
            if (rows[i] is not JsonObject row) continue;
            if (!TryGuid(row, property, out var value) || !allowed.Contains(value)) rows.RemoveAt(i);
        }
    }

    private static void RewriteRequiredRows(JsonArray? rows, string property, IReadOnlyDictionary<Guid, Guid> map)
    {
        if (rows is null) return;
        for (var i = rows.Count - 1; i >= 0; i--)
            if (rows[i] is JsonObject row && !RewriteRequired(row, property, map)) rows.RemoveAt(i);
    }

    private static void RewriteOptionalRows(JsonArray? rows, string property, IReadOnlyDictionary<Guid, Guid> map)
    {
        if (rows is null) return;
        for (var i = rows.Count - 1; i >= 0; i--)
            if (rows[i] is JsonObject row) RewriteOptional(row, property, map);
    }

    private static void RewriteOptionalRows(JsonArray? rows, string property, IReadOnlySet<Guid> allowed)
    {
        if (rows is null) return;
        for (var i = rows.Count - 1; i >= 0; i--)
            if (rows[i] is JsonObject row && TryGuid(row, property, out var value) && !allowed.Contains(value)) row.Remove(property);
    }

    private static bool TryGuid(JsonElement row, string property, out Guid value)
    {
        value = Guid.Empty;
        return row.TryGetProperty(property, out var token) && token.ValueKind == JsonValueKind.String
            && Guid.TryParse(token.GetString(), out value);
    }

    private static bool TryGuid(JsonObject row, string property, out Guid value)
    {
        value = Guid.Empty;
        return row.TryGetPropertyValue(property, out var token) && token is JsonValue json
            && json.TryGetValue<string>(out var raw) && Guid.TryParse(raw, out value);
    }

    private static string? GetText(JsonElement row, string property)
        => row.TryGetProperty(property, out var token) && token.ValueKind == JsonValueKind.String
            ? token.GetString() : null;

    private static string NormalizeKey(string? value)
        => string.IsNullOrWhiteSpace(value) ? string.Empty : value.Replace('\u00B7', '-').Trim();

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
                if (node.TryGetPropertyValue(alias, out var value))
                {
                    node[canonical] = value?.DeepClone();
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
                Alias("SecondaryEmail","Email2");
                Alias("SecondaryMobilePhone","MobilePhone2");
                if (!node.ContainsKey("Status")&&(node.ContainsKey("IsInactive")||node.ContainsKey("CustomerCategory")))
                {
                    var category=node["CustomerCategory"]?.GetValue<string>()??"";
                    var prospect=category.Contains("πιθαν",StringComparison.OrdinalIgnoreCase)||category.Contains("prospect",StringComparison.OrdinalIgnoreCase)||category.Contains("potential",StringComparison.OrdinalIgnoreCase);
                    node["Status"]=prospect?"Prospect":node["IsInactive"] is JsonValue inactive&&inactive.TryGetValue<bool>(out var isInactive)&&isInactive?"Inactive":"Active";
                }
                DateOnlyAlias("BirthDate", "BirthDate");
                DateOnlyAlias("DriverLicenseIssueDate", "DriverLicenseIssuedOn");
                DateOnlyAlias("DriverLicenseExpiryDate", "DriverLicenseExpiresOn");
                break;
            case nameof(CustomerContact):
                Alias("Role", "Label");
                if (node["FullName"] is JsonValue fullNameValue && fullNameValue.TryGetValue<string>(out var fullName))
                {
                    var parts = fullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (!node.ContainsKey("FirstName")) node["FirstName"] = parts.Length > 0 ? parts[0][..Math.Min(parts[0].Length, 100)] : "";
                    if (!node.ContainsKey("LastName")) node["LastName"] = parts.Length > 1 ? parts[1][..Math.Min(parts[1].Length, 100)] : "";
                }
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
                // Desktop uses the business names EffectiveFrom/To, GrossPremium
                // and Plate.  The web domain stores these as StartDate/EndDate,
                // Premium and VehicleRegistrationPlate.  Keep the direction of
                // the alias explicit; leaving the dates unmapped makes a desktop
                // policy materialise with DateOnly.MinValue (which MySQL rejects).
                Alias("StartDate", "EffectiveFrom");
                Alias("EndDate", "EffectiveTo");
                Alias("Premium", "GrossPremium");
                Alias("VehicleRegistrationPlate", "Plate");
                Alias("PolicyType", "LineOfBusiness", "CarrierBranchCode");
                DateOnlyAlias("StartDate", "EffectiveFrom");
                DateOnlyAlias("EndDate", "EffectiveTo");
                DateOnlyAlias("IssuedAt", "IssuedAt");
                DateOnlyAlias("NextRenewalDate", "NextRenewalDate");
                DateOnlyAlias("HandoverDate", "HandoverDate");
                DateOnlyAlias("DeliveredAt", "DeliveredAt");
                DateOnlyAlias("OfficeReceivedAt", "OfficeReceivedAt");
                DateOnlyAlias("PaymentPromisedOn", "PaymentPromisedOn");
                NormalizeCurrency(node);
                break;
            case nameof(PolicyObject):
                Alias("Identifier", "Reference");
                break;
            case nameof(PolicyCover):
                Alias("GrossPremium", "Premium");
                Alias("CoverageAmount", "SumInsured");
                break;
            case nameof(PolicyInstallment):
                Alias("Ordinal", "InstallmentNumber");
                Alias("PaidAt", "PaidOn");
                Alias("ReceiptReference", "Reference");
                DateOnlyAlias("DueDate", "DueDate");
                DateOnlyAlias("PaidAt", "PaidOn");
                break;
            case nameof(Receipt):
                Alias("Number", "ReceiptNumber");
                Alias("ReceivedOn", "ReceiptDate");
                Alias("Method", "PaymentMethod");
                Alias("TransactionReference", "Reference");
                NormalizeCurrency(node);
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
                NormalizeCurrency(node);
                break;
            case nameof(Claim):
                DateOnlyAlias("IncidentDate", "IncidentDate");
                DateOnlyAlias("ReportedDate", "ReportedDate");
                Alias("ClaimedAmount", "EstimatedAmount");
                Alias("Description", "Notes");
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
            case nameof(ClaimInvolvedParty):
                Alias("Role", "Kind");
                Alias("InsuranceCompany", "InsuredWith");
                Alias("PolicyNumber", "InsurancePolicyNumber");
                break;
            case nameof(GeneralFinancialEntry):
                Alias("Kind", "Direction");
                Alias("Counterparty", "CounterpartyName");
                Alias("Reference", "DocumentNumber");
                NormalizeCurrency(node);
                break;
            case nameof(AdvancePayment):
                Alias("PartyType", "PartyKind");
                Alias("AllocatedAmount", "SettledAmount");
                Alias("PaymentMethod", "Method");
                DateOnlyAlias("ReceivedOn", "ReceivedOn");
                NormalizeCurrency(node);
                break;
            case nameof(CreditNote):
                Alias("CreditNoteNumber", "Number");
                Alias("Description", "Reason");
                DateOnlyAlias("IssuedAt", "Date");
                if (!node.ContainsKey("Kind")) node["Kind"] = "Manual";
                if (!node.ContainsKey("Status")) node["Status"] = "Issued";
                NormalizeCurrency(node);
                break;
        }

        // The desktop demo seeder marks every value with a centred dot.  The
        // production database is intentionally conservative about legacy text
        // encodings, so preserve the visible marker while using a portable
        // hyphen.  This is also safe for real records entered with that glyph.
        NormalizeTextMarkers(node);

        // A few catalog columns pre-date the richer domain model (notably the
        // carrier country code).  Keep the bridge compatible with those deployed
        // schemas instead of allowing one oversized legacy value to abort the
        // whole sync transaction.
        if (typeof(T) == typeof(InsuranceCompany) && node.TryGetPropertyValue("Country", out var country)
            && country is JsonValue countryValue && countryValue.TryGetValue<string>(out var countryText))
            node["Country"] = NormalizeCountryCode(countryText);

        // Demo/legacy desktop seeders append a human-readable marker to
        // values (for example "Active · Δοκιμή 17").  That marker is useful
        // in a local table, but it is not a valid enum token in the web
        // domain.  Normalize enum-shaped fields centrally so one such label
        // cannot abort the whole sync request.
        NormalizeEnumProperties(typeof(T), node);

        return JsonSerializer.SerializeToElement(node, SyncJson);
    }

    private static void NormalizeTextMarkers(JsonObject node)
    {
        foreach (var property in node.ToList())
        {
            if (property.Value is JsonValue value && value.TryGetValue<string>(out var text)
                && text.Contains('\u00B7', StringComparison.Ordinal))
                node[property.Key] = text.Replace('\u00B7', '-');
        }
    }

    private static void NormalizeCurrency(JsonObject node)
    {
        if (!node.TryGetPropertyValue("Currency", out var value) || value is not JsonValue json
            || !json.TryGetValue<string>(out var raw))
            return;

        var token = raw.Trim().ToUpperInvariant();
        if (token.Length >= 3)
            token = token[..3];
        else if (token.Length == 0)
            token = "EUR";
        node["Currency"] = token;
    }

    private static string NormalizeCountryCode(string raw)
    {
        var value = raw.Trim();
        if (value.Contains("Ελλάδ", StringComparison.OrdinalIgnoreCase)
            || value.Contains("GREECE", StringComparison.OrdinalIgnoreCase)
            || value.Contains("GR", StringComparison.OrdinalIgnoreCase))
            return "GR";

        var letters = new string(value.Where(char.IsLetter).ToArray()).ToUpperInvariant();
        return letters.Length >= 2 ? letters[..2] : (letters.Length == 1 ? $"{letters}X" : "GR");
    }

    private static void NormalizeEnumProperties(Type entityType, JsonObject node)
    {
        foreach (var property in entityType.GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
        {
            var nullable = Nullable.GetUnderlyingType(property.PropertyType);
            var enumType = nullable ?? property.PropertyType;
            if (!enumType.IsEnum || !node.TryGetPropertyValue(property.Name, out var value) || value is null)
                continue;
            if (value is not JsonValue jsonValue || !jsonValue.TryGetValue<string>(out var raw))
                continue;

            var token = NormalizeEnumToken(property.Name, enumType, raw);
            if (token is not null)
                node[property.Name] = token;
            else if (nullable is not null)
                node.Remove(property.Name);
            else
                node[property.Name] = Enum.GetNames(enumType).FirstOrDefault() ?? "0";
        }
    }

    private static string? NormalizeEnumToken(string propertyName, Type enumType, string raw)
    {
        var token = raw.Trim();
        var marker = token.IndexOf("· Δοκιμή", StringComparison.OrdinalIgnoreCase);
        if (marker >= 0) token = token[..marker].Trim();

        var translated = propertyName switch
        {
            "Type" when token.Contains("Φυσικ", StringComparison.OrdinalIgnoreCase) => "Individual",
            "Type" when token.Contains("Νομικ", StringComparison.OrdinalIgnoreCase) ||
                         token.Contains("Εταιρ", StringComparison.OrdinalIgnoreCase) => "Company",
            "Method" when token.Contains("μετρη", StringComparison.OrdinalIgnoreCase) => "Cash",
            "Method" when token.Contains("κάρτ", StringComparison.OrdinalIgnoreCase) => "Card",
            "Method" when token.Contains("τραπεζ", StringComparison.OrdinalIgnoreCase) => "BankTransfer",
            "Method" when token.Contains("επιταγ", StringComparison.OrdinalIgnoreCase) => "Cheque",
            "Method" when token.Contains("γραμμάτι", StringComparison.OrdinalIgnoreCase) => "PromissoryNote",
            "BeneficiaryType" when token.Contains("ασφαλισ", StringComparison.OrdinalIgnoreCase) => "InsuranceCompany",
            "BeneficiaryType" when token.Contains("συνεργ", StringComparison.OrdinalIgnoreCase) => "Producer",
            "BeneficiaryType" when token.Contains("προμηθευ", StringComparison.OrdinalIgnoreCase) => "Vendor",
            "PolicyType" when token.Contains("αυτοκ", StringComparison.OrdinalIgnoreCase) => "Auto",
            "PolicyType" when token.Contains("κατοικ", StringComparison.OrdinalIgnoreCase) => "Home",
            "PolicyType" when token.Contains("υγει", StringComparison.OrdinalIgnoreCase) => "Health",
            "PolicyType" when token.Contains("ζω", StringComparison.OrdinalIgnoreCase) => "Life",
            "PolicyType" when token.Contains("επιχειρ", StringComparison.OrdinalIgnoreCase) => "Business",
            "PolicyType" when token.Contains("ταξιδ", StringComparison.OrdinalIgnoreCase) => "Travel",
            _ => token,
        };

        if (Enum.TryParse(enumType, translated, ignoreCase: true, out var parsed))
            return parsed?.ToString();
        if (int.TryParse(translated, out var numeric) && Enum.IsDefined(enumType, numeric))
            return Enum.GetName(enumType, numeric);
        return null;
    }

    private async Task<(Dictionary<string, JsonElement> Data, Dictionary<string, int> Summary)> ExportAsync(
        Guid tenantId, DateTime? sinceUtc, CancellationToken ct)
    {
        var customers = await _db.Customers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var customerRelationships = await _db.CustomerRelationships.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var customerFamilyMembers = await _db.CustomerFamilyMembers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var customerAssets = await _db.CustomerAssets.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var customerInsuranceNeeds = await _db.CustomerInsuranceNeeds.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var customerContacts = await _db.CustomerContacts.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var producers = await _db.Producers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == null || x.TenantId == tenantId).ToListAsync(ct);
        var policies = await _db.Policies.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var policyObjects = await _db.PolicyObjects.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var policyCovers = await _db.PolicyCovers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var policyInstallments = await _db.PolicyInstallments.IgnoreQueryFilters().AsNoTracking()
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
        var producerCardEntries = await _db.ProducerCardEntries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var claimInvolvedParties = await _db.ClaimInvolvedParties.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var emailTemplates = await _db.EmailTemplates.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var overCommissionStatements = await _db.OverCommissionStatements.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var generalFinancialEntries = await _db.GeneralFinancialEntries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var advancePayments = await _db.AdvancePayments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var creditNotes = await _db.CreditNotes.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var partyLedgerEntries = await _db.PartyLedgerEntries.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);
        var ledgerAllocations = await _db.LedgerAllocations.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.TenantId == tenantId && (sinceUtc == null || x.UpdatedAt >= sinceUtc || x.CreatedAt >= sinceUtc || x.DeletedAt >= sinceUtc)).ToListAsync(ct);

        var data = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase)
        {
            ["customers"] = JsonSerializer.SerializeToElement(customers, new JsonSerializerOptions(SyncJson){DefaultIgnoreCondition=JsonIgnoreCondition.Never}),
            ["customerRelationships"] = JsonSerializer.SerializeToElement(customerRelationships, SyncJson),
            ["customerFamilyMembers"] = JsonSerializer.SerializeToElement(customerFamilyMembers, SyncJson),
            ["customerAssets"] = JsonSerializer.SerializeToElement(customerAssets, SyncJson),
            ["customerInsuranceNeeds"] = JsonSerializer.SerializeToElement(customerInsuranceNeeds, SyncJson),
            ["customerContacts"] = JsonSerializer.SerializeToElement(customerContacts, SyncJson),
            ["producers"] = JsonSerializer.SerializeToElement(producers, SyncJson),
            ["carriers"] = JsonSerializer.SerializeToElement(carriers, SyncJson),
            ["policies"] = JsonSerializer.SerializeToElement(policies, SyncJson),
            ["policyObjects"] = JsonSerializer.SerializeToElement(policyObjects, SyncJson),
            ["policyCovers"] = JsonSerializer.SerializeToElement(policyCovers, SyncJson),
            ["policyInstallments"] = JsonSerializer.SerializeToElement(policyInstallments, SyncJson),
            ["claims"] = JsonSerializer.SerializeToElement(claims, SyncJson),
            ["receipts"] = JsonSerializer.SerializeToElement(receipts, SyncJson),
            ["payments"] = JsonSerializer.SerializeToElement(payments, SyncJson),
            ["tasks"] = JsonSerializer.SerializeToElement(tasks, SyncJson),
            ["appointments"] = JsonSerializer.SerializeToElement(appointments, SyncJson),
            ["instructions"] = JsonSerializer.SerializeToElement(instructions, SyncJson),
            ["producerCardEntries"] = JsonSerializer.SerializeToElement(producerCardEntries, SyncJson),
            ["claimInvolvedParties"] = JsonSerializer.SerializeToElement(claimInvolvedParties, SyncJson),
            ["emailTemplates"] = JsonSerializer.SerializeToElement(emailTemplates, SyncJson),
            ["overCommissionStatements"] = JsonSerializer.SerializeToElement(overCommissionStatements, SyncJson),
            ["generalFinancialEntries"] = JsonSerializer.SerializeToElement(generalFinancialEntries, SyncJson),
            ["advancePayments"] = JsonSerializer.SerializeToElement(advancePayments, SyncJson),
            ["creditNotes"] = JsonSerializer.SerializeToElement(creditNotes, SyncJson),
            ["partyLedgerEntries"] = JsonSerializer.SerializeToElement(partyLedgerEntries, SyncJson),
            ["ledgerAllocations"] = JsonSerializer.SerializeToElement(ledgerAllocations, SyncJson),
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
