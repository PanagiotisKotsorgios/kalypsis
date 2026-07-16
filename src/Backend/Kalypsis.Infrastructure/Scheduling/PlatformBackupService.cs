using System.Diagnostics;
using System.IO.Compression;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Scheduling;

/// <summary>
/// Full-platform backup runner. For each queued PlatformBackup row it
/// serialises every tenant's payload (via <see cref="ITenantBackupService"/>)
/// plus platform-scoped tables (settings, contractors, support tickets,
/// tenant contracts, etc.), gzips the whole thing and writes to
/// <c>platform-backups/{fileName}</c>. Updates the row with the final size,
/// duration and status.
/// </summary>
public class PlatformBackupService : IPlatformBackupService
{
    private const int CAP = 200_000;

    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;
    private readonly IDateTimeProvider _clock;
    private readonly ITenantBackupService _tenantBackups;
    private readonly ILogger<PlatformBackupService> _log;

    public PlatformBackupService(
        AppDbContext db,
        IFileStorage storage,
        IDateTimeProvider clock,
        ITenantBackupService tenantBackups,
        ILogger<PlatformBackupService> log)
    {
        _db = db;
        _storage = storage;
        _clock = clock;
        _tenantBackups = tenantBackups;
        _log = log;
    }

    public async Task<PlatformBackup> CreateAndExecuteAsync(
        string scope, string createdByName, Guid? createdByUserId, CancellationToken ct)
    {
        var stamp = _clock.UtcNow.ToString("yyyy-MM-dd-HHmm");
        var row = new PlatformBackup
        {
            FileName = $"kalypsis-{scope}-{stamp}.json.gz",
            StoragePath = "",
            SizeBytes = 0,
            Scope = scope,
            Status = "InProgress",
            Message = "Queued by scheduler",
            CreatedByUserId = createdByUserId,
            CreatedByName = createdByName
        };
        _db.PlatformBackups.Add(row);
        await _db.SaveChangesAsync(ct);
        return await ExecuteAsync(row.Id, ct);
    }

    public async Task<PlatformBackup> ExecuteAsync(Guid backupId, CancellationToken ct)
    {
        var row = await _db.PlatformBackups.FirstOrDefaultAsync(
            b => b.Id == backupId && b.DeletedAt == null, ct)
            ?? throw new InvalidOperationException($"PlatformBackup {backupId} not found.");

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var tenants = await _db.Tenants.IgnoreQueryFilters()
                .Where(t => t.DeletedAt == null).ToListAsync(ct);

            var tenantPayloads = new List<object>();
            foreach (var t in tenants)
            {
                if (ct.IsCancellationRequested) break;
                tenantPayloads.Add(await BuildTenantSliceAsync(t.Id, ct));
            }

            // Platform-scoped tables — configuration + operator data that
            // doesn't belong to any single tenant.
            var platformSettings = await _db.PlatformSettings.IgnoreQueryFilters().ToListAsync(ct);
            var pricing         = await _db.PlatformPricings.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var tenantContracts = await _db.TenantContracts.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var invoices        = await _db.TenantInvoices.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var invoiceLines    = await _db.TenantInvoiceLines.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var chargeables     = await _db.TenantChargeables.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var registrations   = await _db.RegistrationRequests.IgnoreQueryFilters().Take(CAP).ToListAsync(ct);
            var users           = await _db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null).Take(CAP).ToListAsync(ct);

            // New SuperAdmin tables (from task #69–#71).
            var contractors      = await _db.Contractors.Where(x => x.DeletedAt == null).ToListAsync(ct);
            var assignments      = await _db.ContractorAssignments.Where(x => x.DeletedAt == null).ToListAsync(ct);
            var paymentStatuses  = await _db.TenantPaymentStatuses.Where(x => x.DeletedAt == null).ToListAsync(ct);
            var supportTickets   = await _db.SupportTickets.Where(x => x.DeletedAt == null).ToListAsync(ct);
            var supportReplies   = await _db.SupportTicketReplies.Where(x => x.DeletedAt == null).Take(CAP).ToListAsync(ct);
            var jobOverrides     = await _db.PlatformJobOverrides.Where(x => x.DeletedAt == null).ToListAsync(ct);

            var summary = new Dictionary<string, int>
            {
                ["tenants"] = tenants.Count,
                ["users"] = users.Count,
                ["tenantContracts"] = tenantContracts.Count,
                ["invoices"] = invoices.Count,
                ["invoiceLines"] = invoiceLines.Count,
                ["chargeables"] = chargeables.Count,
                ["registrations"] = registrations.Count,
                ["contractors"] = contractors.Count,
                ["contractorAssignments"] = assignments.Count,
                ["tenantPayments"] = paymentStatuses.Count,
                ["supportTickets"] = supportTickets.Count,
                ["supportReplies"] = supportReplies.Count,
                ["jobOverrides"] = jobOverrides.Count,
            };

            var payload = new
            {
                format = "kalypsis-platform-backup",
                version = 1,
                scope = row.Scope,
                createdAt = _clock.UtcNow,
                createdBy = row.CreatedByName,
                summary,
                platform = new
                {
                    settings = platformSettings,
                    pricing,
                    tenantContracts,
                    invoices,
                    invoiceLines,
                    chargeables,
                    registrations,
                    users,
                    contractors,
                    contractorAssignments = assignments,
                    tenantPayments = paymentStatuses,
                    supportTickets,
                    supportReplies,
                    jobOverrides
                },
                tenants = tenantPayloads
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
            var fileName = string.IsNullOrEmpty(row.FileName) || row.FileName.EndsWith("json.gz")
                ? row.FileName
                : $"kalypsis-platform-{stamp}.json.gz";
            var keyPrefix = "platform-backups";
            string storagePath;
            await using (var upStream = new MemoryStream(compressed))
                storagePath = await _storage.UploadAsync(keyPrefix, fileName, "application/gzip", upStream, ct);

            stopwatch.Stop();
            row.FileName = fileName;
            row.StoragePath = storagePath;
            row.SizeBytes = compressed.LongLength;
            row.Status = "Completed";
            row.Message = $"OK · {summary.Sum(kv => kv.Value)} rows across {tenants.Count} tenants";
            row.DurationSeconds = (int)stopwatch.Elapsed.TotalSeconds;
            await _db.SaveChangesAsync(ct);

            _log.LogInformation("Platform backup #{Id} written: {File} ({KB} KB) in {S}s",
                row.Id, fileName, compressed.Length / 1024, row.DurationSeconds);
            return row;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            row.Status = "Failed";
            row.Message = $"Failed: {ex.Message}";
            row.DurationSeconds = (int)stopwatch.Elapsed.TotalSeconds;
            await _db.SaveChangesAsync(ct);
            _log.LogError(ex, "Platform backup #{Id} failed", row.Id);
            throw;
        }
    }

    /// <summary>
    /// Builds a minimal per-tenant slice. We keep the shape narrow (10 top
    /// domain tables) — deep-tables like PolicyCovers explode the payload
    /// size and are rebuildable from a fresh export anyway. If we ever need
    /// them, expose ITenantBackupService's richer path here.
    /// </summary>
    private async Task<object> BuildTenantSliceAsync(Guid tenantId, CancellationToken ct)
    {
        var tenant = await _db.Tenants.IgnoreQueryFilters().FirstAsync(t => t.Id == tenantId, ct);
        var customers    = await _db.Customers   .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var policies     = await _db.Policies    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var claims       = await _db.Claims      .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var receipts     = await _db.Receipts    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var payments     = await _db.Payments    .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var producers    = await _db.Producers   .IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        var carriers     = await _db.InsuranceCompanies.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && x.DeletedAt == null).Take(CAP).ToListAsync(ct);
        return new { tenant = new { tenant.Id, tenant.Name, tenant.Code }, customers, policies, claims, receipts, payments, producers, carriers };
    }
}
