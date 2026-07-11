using System.IO.Compression;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

public class TenantBackupService : ITenantBackupService
{
    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly IDateTimeProvider _clock;
    private readonly ILogger<TenantBackupService> _log;

    public TenantBackupService(
        AppDbContext db,
        IFileStorage storage,
        IDateTimeProvider clock,
        ILogger<TenantBackupService> log)
    {
        _db = db;
        _storage = storage;
        _clock = clock;
        _log = log;
    }

    public async Task<TenantBackup> CreateAsync(
        Guid tenantId, string kind, Guid? createdByUserId, string? createdByName, CancellationToken ct)
    {
        const int CAP = 200_000;

        // IgnoreQueryFilters on the writer path — the auto-backup job runs
        // without an authenticated tenant context, so the global filter would
        // otherwise return zero rows. Safe because we explicitly scope on
        // TenantId in every Where.
        var customers    = await _db.Customers   .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var policies     = await _db.Policies    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var claims       = await _db.Claims      .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var receipts     = await _db.Receipts    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var payments     = await _db.Payments    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var tasks        = await _db.AgencyTasks .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var appointments = await _db.Appointments.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var producers    = await _db.Producers   .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var carriers     = await _db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var notes        = await _db.AgencyInstructions.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);

        var summary = new Dictionary<string, int>
        {
            ["customers"] = customers.Count,
            ["policies"] = policies.Count,
            ["claims"] = claims.Count,
            ["receipts"] = receipts.Count,
            ["payments"] = payments.Count,
            ["tasks"] = tasks.Count,
            ["appointments"] = appointments.Count,
            ["producers"] = producers.Count,
            ["carriers"] = carriers.Count,
            ["instructions"] = notes.Count,
        };

        var payload = new
        {
            format = "kalypsis-tenant-backup",
            version = 1,
            tenantId,
            createdAt = _clock.UtcNow,
            createdBy = createdByName,
            summary,
            data = new
            {
                customers, policies, claims, receipts, payments,
                tasks, appointments, producers, carriers, instructions = notes,
            },
        };

        var jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = false,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        };

        byte[] compressed;
        using (var ms = new MemoryStream())
        {
            using (var gz = new GZipStream(ms, CompressionLevel.SmallestSize, leaveOpen: true))
                await JsonSerializer.SerializeAsync(gz, payload, jsonOptions, ct);
            compressed = ms.ToArray();
        }

        var stamp = _clock.UtcNow.ToString("yyyyMMdd_HHmmss");
        var fileName = $"kalypsis-{tenantId:N}-{stamp}.json.gz";
        var keyPrefix = $"backups/{tenantId:N}";
        string storagePath;
        await using (var upStream = new MemoryStream(compressed))
            storagePath = await _storage.UploadAsync(keyPrefix, fileName, "application/gzip", upStream, ct);

        var row = new TenantBackup
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FileName = fileName,
            StoragePath = storagePath,
            SizeBytes = compressed.LongLength,
            Kind = kind,
            SummaryJson = JsonSerializer.Serialize(summary),
            CreatedByUserId = createdByUserId,
            CreatedByName = createdByName,
            CreatedAt = _clock.UtcNow,
            UpdatedAt = _clock.UtcNow,
        };
        _db.TenantBackups.Add(row);
        await _db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<Dictionary<string, int>> ReadSummaryAsync(Guid backupId, Guid tenantId, CancellationToken ct)
    {
        var row = await _db.TenantBackups.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == backupId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw new InvalidOperationException("Backup not found");

        if (!string.IsNullOrEmpty(row.SummaryJson))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<Dictionary<string, int>>(row.SummaryJson);
                if (parsed != null) return parsed;
            }
            catch { /* fall through to read from file */ }
        }

        // Fallback — parse the summary from the archive itself.
        using var stream = await _storage.DownloadAsync(row.StoragePath, ct);
        using var gz = new GZipStream(stream, CompressionMode.Decompress);
        using var doc = await JsonDocument.ParseAsync(gz, cancellationToken: ct);
        if (doc.RootElement.TryGetProperty("summary", out var summaryEl))
            return JsonSerializer.Deserialize<Dictionary<string, int>>(summaryEl.GetRawText()) ?? new();
        return new();
    }

    public async Task<RestoreResult> RestoreAsync(
        Guid backupId, Guid tenantId, RestoreOptions options, CancellationToken ct)
    {
        var row = await _db.TenantBackups.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == backupId && x.TenantId == tenantId && x.DeletedAt == null, ct)
            ?? throw new InvalidOperationException("Backup not found");

        // Parse the archive up-front so a corrupt file fails BEFORE we open
        // the destructive transaction.
        using var stream = await _storage.DownloadAsync(row.StoragePath, ct);
        using var gz = new GZipStream(stream, CompressionMode.Decompress);
        using var doc = await JsonDocument.ParseAsync(gz, cancellationToken: ct);

        var root = doc.RootElement;
        if (!root.TryGetProperty("data", out var data))
            throw new InvalidOperationException("Backup archive missing `data` root property.");

        int cCustomers = 0, cPolicies = 0, cClaims = 0, cReceipts = 0, cPayments = 0;
        int cTasks = 0, cAppointments = 0, cProducers = 0, cCarriers = 0, cInstructions = 0;

        // FK-safe insert order — Customers before Policies (Policy.CustomerId),
        // Carriers before Policies (Policy.InsuranceCompanyId), Producers before
        // Policies (Policy.ProducerId), Policies before Claims/Receipts/Payments.
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            cCarriers     = await UpsertAsync<InsuranceCompany>(data, "carriers",     tenantId, ct);
            cProducers    = await UpsertAsync<Producer>         (data, "producers",    tenantId, ct);
            cCustomers    = await UpsertAsync<Customer>         (data, "customers",    tenantId, ct);
            cPolicies     = await UpsertAsync<Policy>           (data, "policies",     tenantId, ct);
            cClaims       = await UpsertAsync<Claim>            (data, "claims",       tenantId, ct);
            cReceipts     = await UpsertAsync<Receipt>          (data, "receipts",     tenantId, ct);
            cPayments     = await UpsertAsync<Payment>          (data, "payments",     tenantId, ct);
            cTasks        = await UpsertAsync<AgencyTask>       (data, "tasks",        tenantId, ct);
            cAppointments = await UpsertAsync<Appointment>      (data, "appointments", tenantId, ct);
            if (options.IncludeInstructions)
                cInstructions = await UpsertAsync<AgencyInstruction>(data, "instructions", tenantId, ct);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }

        var total = cCustomers + cPolicies + cClaims + cReceipts + cPayments
                  + cTasks + cAppointments + cProducers + cCarriers + cInstructions;

        _log.LogInformation("Tenant {TenantId} restored from backup {BackupId}: {Total} rows upserted.",
            tenantId, backupId, total);

        return new RestoreResult(
            cCustomers, cPolicies, cClaims, cReceipts, cPayments,
            cTasks, cAppointments, cProducers, cCarriers, cInstructions,
            total,
            $"Επαναφορά ολοκληρώθηκε — {total} εγγραφές ενημερώθηκαν ή προστέθηκαν.");
    }

    /// <summary>
    /// Reads an array property from the backup archive, deserialises to the
    /// entity type, forces the TenantId to the current tenant (never trust
    /// the file — a backup dropped in by mistake shouldn't leak cross-tenant),
    /// then upserts by primary key. Returns the number of processed rows.
    /// </summary>
    private async Task<int> UpsertAsync<T>(JsonElement data, string property, Guid tenantId, CancellationToken ct)
        where T : Kalypsis.Domain.Common.BaseEntity
    {
        if (!data.TryGetProperty(property, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return 0;

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        };
        var items = arr.Deserialize<List<T>>(options) ?? new();
        int count = 0;
        foreach (var item in items)
        {
            if (item is Kalypsis.Domain.Common.TenantEntity te) te.TenantId = tenantId;

            // Update if the row already exists in the tenant; insert otherwise.
            // We use ChangeTracker.Entries to avoid a per-row DB roundtrip.
            var existing = await _db.Set<T>().IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Id == item.Id, ct);
            if (existing is null)
            {
                _db.Set<T>().Add(item);
            }
            else
            {
                _db.Entry(existing).CurrentValues.SetValues(item);
            }
            count++;

            // Flush every 500 rows so we don't blow up memory on large restores.
            if (count % 500 == 0)
            {
                await _db.SaveChangesAsync(ct);
                _db.ChangeTracker.Clear();
            }
        }
        await _db.SaveChangesAsync(ct);
        return count;
    }
}
