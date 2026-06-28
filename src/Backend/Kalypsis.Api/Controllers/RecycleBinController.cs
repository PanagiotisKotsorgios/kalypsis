using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Premium;
using Kalypsis.Domain.Common;
using Kalypsis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Api.Controllers;

[ApiController]
[Route("api/recycle-bin")]
[Authorize(Policy = "AgencyAdmin")]
public class RecycleBinController : ControllerBase
{
    private const int RetentionDays = 30;
    private const int MaxMaterializedPerCategory = 2000;
    private readonly Kalypsis.Infrastructure.Persistence.AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IDateTimeProvider _clock;

    public RecycleBinController(
        Kalypsis.Infrastructure.Persistence.AppDbContext db,
        ICurrentUser current,
        IDateTimeProvider clock)
    {
        _db = db;
        _current = current;
        _clock = clock;
    }

    public record RecycleCategoryDto(string Key, string Label, int Count);
    public record RecycleItemDto(
        string Category,
        string CategoryLabel,
        Guid Id,
        string Title,
        string? Subtitle,
        DateTime DeletedAt,
        DateTime ExpiresAt,
        int DaysLeft);

    public record RecyclePageDto(
        IReadOnlyList<RecycleCategoryDto> Categories,
        IReadOnlyList<RecycleItemDto> Items,
        int Total,
        int Page,
        int PageSize,
        int RetentionDays);

    public record RestoreResultDto(string Category, Guid Id, bool Restored);

    private static readonly IReadOnlyList<IRecycleCategory> Categories = new IRecycleCategory[]
    {
        Cat<User>("users", "Χρήστες", u => $"{u.FirstName} {u.LastName}".TrimOr(u.Email), u => $"{u.Email} · {u.Role}"),
        Cat<Customer>("customers", "Πελάτες", c => c.Type == Kalypsis.Domain.Enums.CustomerType.Individual
            ? $"{c.FirstName} {c.LastName}".TrimOr(c.CustomerNumber)
            : (c.CompanyName ?? c.CustomerNumber), c => $"{c.CustomerNumber} · {c.Email ?? c.Phone ?? "χωρίς στοιχεία"}"),
        Cat<Policy>("policies", "Συμβόλαια", p => p.PolicyNumber, p => $"{p.PolicyType} · {p.Status} · {p.StartDate:yyyy-MM-dd} → {p.EndDate:yyyy-MM-dd}"),
        Cat<PolicyEndorsement>("endorsements", "Πρόσθετες πράξεις", e => e.EndorsementNumber, e => $"{e.Type} · {e.Status} · {e.PremiumDelta:0.00} {e.Currency}"),
        Cat<PolicyCancellation>("cancellations", "Ακυρώσεις", c => c.CancellationNumber, c => $"{c.Status} · επιστροφή {c.RefundAmount:0.00} {c.Currency}"),
        Cat<PolicyDocument>("documents", "Έγγραφα", d => d.FileName, d => $"{d.DocumentType} · {(d.SizeBytes / 1024m):0} KB"),
        Cat<Notification>("notifications", "Ειδοποιήσεις", n => n.Title, n => $"{n.Category ?? "Ενημέρωση"} · {Short(n.Body)}"),
        Cat<Claim>("claims", "Ζημιές", c => c.ClaimNumber, c => $"{c.Status} · {c.IncidentDate:yyyy-MM-dd}"),
        Cat<Producer>("producers", "Συνεργάτες", p => p.Name, p => $"{p.Code} · {p.Status}"),
        Cat<Receipt>("receipts", "Εισπράξεις", r => r.Number, r => $"{r.ReceivedOn:yyyy-MM-dd} · {r.Amount:0.00} {r.Currency}"),
        Cat<Payment>("payments", "Πληρωμές", p => p.Number, p => $"{p.PaidOn:yyyy-MM-dd} · {p.Amount:0.00} {p.Currency}"),
        Cat<CreditNote>("credit-notes", "Πιστωτικά", c => c.CreditNoteNumber, c => $"{c.Status} · {c.Amount:0.00} {c.Currency}"),
        Cat<AgencyTask>("tasks", "Εργασίες", t => t.Title, t => $"{t.Status} · {t.DueAt?.ToString("yyyy-MM-dd") ?? "χωρίς λήξη"}"),
        Cat<ServiceRequest>("requests", "Αιτήματα", r => r.Subject, r => $"{r.RequestNumber} · {r.Type} · {r.Status}"),
        Cat<ServiceRequestAttachment>("request-attachments", "Συνημμένα αιτημάτων", a => a.FileName, a => $"{a.Category} · {(a.SizeBytes / 1024m):0} KB"),
        Cat<MarketingCampaign>("campaigns", "Καμπάνιες", c => c.Name, c => $"{c.ChannelsJson} · {c.Status}"),
        Cat<CustomerRelationship>("customer-relationships", "Σχέσεις πελατών", r => $"Σχέση {r.RelationshipType}", r => $"{r.CustomerId} ↔ {r.RelatedCustomerId}"),
        Cat<CustomerInsuranceNeed>("customer-needs", "Ανάγκες πελατών", n => n.Title.TrimOr(n.Kind), n => $"{n.Kind} · {(n.IsInsured ? "ασφαλισμένο" : "μη ασφαλισμένο")}"),
        Cat<CustomerContact>("customer-contacts", "Επαφές πελατών", c => $"{c.FirstName} {c.LastName}".TrimOr(c.Email ?? c.Phone ?? c.Id.ToString()), c => $"{c.Role ?? "επαφή"} · {c.Email ?? c.Phone ?? "χωρίς στοιχεία"}"),
        Cat<CommunicationLog>("communications", "Επικοινωνίες", c => c.Subject.TrimOr(c.Kind.ToString()), c => $"{c.Direction} · {c.Outcome} · {c.OccurredAt:yyyy-MM-dd HH:mm}"),
        Cat<ConsentRecord>("consents", "Συναινέσεις", c => c.Type.ToString(), c => $"{(c.Granted ? "ενεργή" : "μη ενεργή")} · {c.Method} · {c.GrantedAt:yyyy-MM-dd}"),
        Cat<Appointment>("appointments", "Ραντεβού", a => a.Title, a => $"{a.Status} · {a.StartsAt:yyyy-MM-dd HH:mm}"),
        Cat<Tariff>("tariffs", "Τιμολόγια / Tariffs", t => t.Name, t => $"{t.PolicyType} · {t.BasePremium:0.00} {t.Currency}"),
        Cat<CoverNote>("cover-notes", "Cover notes", c => c.Number, c => $"{c.PolicyType} · {c.Status} · {c.ValidFrom:yyyy-MM-dd} → {c.ValidUntil:yyyy-MM-dd}"),
        Cat<Branch>("branches", "Κλάδοι", b => b.Name.TrimOr(b.Code), b => $"{b.Code} · {(b.IsActive ? "ενεργός" : "ανενεργός")}"),
        Cat<CompanyBridge>("company-bridges", "Γέφυρες εταιριών", b => b.Name, b => $"{b.Kind} · {(b.AutoSync ? "auto sync" : "manual")} · {b.LastSyncStatus ?? "χωρίς sync"}"),
        Cat<CompanyBridgeRun>("bridge-runs", "Εκτελέσεις γεφυρών", r => r.SourceFile.TrimOr(r.Id.ToString()), r => $"{r.Status} · {r.RowsTotal} γραμμές · {r.StartedAt:yyyy-MM-dd HH:mm}"),
        Cat<CommissionRule>("commission-rules", "Κανόνες προμηθειών", r => $"Κανόνας προμήθειας {r.ProducerTier?.ToString() ?? "γενικός"}", r => $"{r.PolicyType?.ToString() ?? "Όλοι οι κλάδοι"} · {r.AgencyPercent ?? r.Value:0.00}% / {r.ProducerPercent ?? 0m:0.00}%"),
        Cat<CommissionRun>("commission-runs", "Εκκαθαρίσεις προμηθειών", r => r.Title.TrimOr($"{r.Month:00}/{r.Year}"), r => $"{r.Status} · {r.TotalCommission:0.00} {r.Currency}"),
        Cat<OverCommissionRule>("over-commission-rules", "Υπερπρομήθειες", r => $"Υπερπρομήθεια {r.Level}", r => $"{r.Percentage:0.00}% · {r.PolicyType?.ToString() ?? "Όλοι οι κλάδοι"}"),
        Cat<ProductionGoal>("production-goals", "Στόχοι παραγωγής", g => $"Στόχος {g.Month?.ToString("00") ?? "έτους"}/{g.Year}", g => $"{g.TargetPremium:0.00} · {g.TargetPolicies?.ToString() ?? "χωρίς πλήθος"} συμβόλαια"),
        Cat<FinancialMovement>("financial-movements", "Οικονομικές κινήσεις", m => m.Description.TrimOr(m.Kind.ToString()), m => $"{m.MovementDate:yyyy-MM-dd} · {m.Amount:0.00} {m.Currency}"),
        Cat<Security>("securities", "Αξιόγραφα", s => s.Number, s => $"{s.Kind} · {s.Status} · {s.Amount:0.00} {s.Currency}"),
        Cat<BankConnection>("bank-connections", "Τραπεζικές συνδέσεις", b => b.BankName, b => $"{b.AccountName ?? "λογαριασμός"} · {b.Iban ?? "χωρίς IBAN"}"),
        Cat<ThirdPartyApiKey>("api-keys", "API keys", k => k.Name, k => $"{k.KeyPrefix} · {k.Scopes}"),
        Cat<DiasCode>("dias-codes", "Κωδικοί ΔΙΑΣ", d => d.RfCode, d => $"{d.Status} · {d.Amount:0.00} {d.Currency} · λήξη {d.DueDate:yyyy-MM-dd}"),
        Cat<AccountingExport>("accounting-exports", "Λογιστικές εξαγωγές", e => e.FileName.TrimOr($"Εξαγωγή {e.Month:00}/{e.Year}"), e => $"{e.Status} · {e.Entries} εγγραφές"),
        Cat<KepyoReport>("kepyo-reports", "ΚΕΠΥΟ", k => k.FileName.TrimOr($"ΚΕΠΥΟ {k.Year}"), k => $"{k.Status} · {k.TotalAmount:0.00}"),
        Cat<MagneticImport>("magnetic-imports", "Μαγνητικά αρχεία", m => m.FileName, m => $"{m.Source} · {m.Status} · {m.Rows} γραμμές"),
        Cat<EmailTemplate>("email-templates", "Πρότυπα email", e => e.Name, e => $"{e.Code} · {e.Subject}"),
        Cat<DeliveryRecord>("delivery-records", "Παραδόσεις συμβολαίων", d => d.Reference.TrimOr(d.Channel.ToString()), d => $"{d.Status} · {d.DispatchedAt?.ToString("yyyy-MM-dd HH:mm") ?? "χωρίς αποστολή"}"),
        Cat<DocumentFolder>("document-folders", "Φάκελοι εγγράφων", f => f.Name, f => f.Description),
        Cat<PartnerPortalAccess>("partner-portal-access", "Πρόσβαση συνεργατών", a => $"Πρόσβαση συνεργάτη {a.ProducerId}", a => $"{(a.IsActive ? "ενεργή" : "ανενεργή")} · τελευταίο login {a.LastLoginAt?.ToString("yyyy-MM-dd") ?? "ποτέ"}"),
        Cat<GroupPolicy>("group-policies", "Ομαδικά συμβόλαια", g => g.Name.TrimOr(g.GroupNumber), g => $"{g.GroupNumber} · {g.Status} · {g.MemberCount} μέλη"),
        Cat<GroupPolicyMember>("group-policy-members", "Μέλη ομαδικών", m => m.FullName, m => $"{m.Relationship ?? "μέλος"} · {m.IndividualPremium?.ToString("0.00") ?? "χωρίς ασφάλιστρο"}"),
        Cat<ClaimProvision>("claim-provisions", "Προβλέψεις ζημιών", p => $"Πρόβλεψη {p.ReserveAmount:0.00} {p.Currency}", p => $"{p.EvaluationDate:yyyy-MM-dd} · {p.AssessorName ?? "χωρίς εκτιμητή"}"),
        Cat<ClaimIndemnity>("claim-indemnities", "Αποζημιώσεις", i => i.PaymentNumber, i => $"{i.PayeeName ?? i.PayeeType} · {i.Amount:0.00} {i.Currency}"),
        Cat<Garage>("garages", "Συνεργεία", g => g.Name, g => $"{g.Code} · {g.City ?? "χωρίς πόλη"} · {g.Phone ?? "χωρίς τηλέφωνο"}"),
        Cat<GlAccount>("gl-accounts", "Λογιστικό σχέδιο", a => $"{a.Code} {a.Name}".Trim(), a => $"{a.Type} · {a.Category ?? "χωρίς κατηγορία"}"),
        Cat<GlEntry>("gl-entries", "Άρθρα λογιστικής", e => e.EntryNumber, e => $"{e.EntryDate:yyyy-MM-dd} · Χ {e.Debit:0.00} / Π {e.Credit:0.00} {e.Currency}"),
        Cat<NameDay>("name-days", "Εορτολόγιο", n => n.Name, n => $"{n.Day:00}/{n.Month:00} · {n.Notes ?? "χωρίς σημείωση"}"),
        Cat<DocumentTemplate>("document-templates", "Πρότυπα εντύπων", t => t.Name.TrimOr(t.Code), t => $"{t.Kind} · {t.PageSize} · {t.Orientation}"),
        Cat<DocumentNumberingRule>("document-numbering", "Κανόνες αρίθμησης", r => r.DocumentKind, r => $"{r.Prefix}{r.NextNumber.ToString().PadLeft(r.Padding, '0')}{r.Suffix}"),
        Cat<FriendlySettlement>("friendly-settlements", "Φιλικοί διακανονισμοί", s => s.SettlementFileNumber, s => $"{s.Status} · {s.DeclarationDate:yyyy-MM-dd}"),
        Cat<ClaimVictim>("claim-victims", "Παθόντες ζημιών", v => v.FullName, v => $"{v.VictimType} · {v.Status} · {v.VehiclePlate ?? "χωρίς πινακίδα"}"),
        Cat<SettlementPayment>("settlement-payments", "Πληρωμές διακανονισμών", p => p.Reference.TrimOr(p.PayeeName ?? p.PayeeType), p => $"{p.PaidOn:yyyy-MM-dd} · {p.TotalAmount:0.00} {p.Currency}"),
        Cat<UsaeSubmission>("usae-submissions", "ΥΣΑΕ", u => u.SubmissionNumber, u => $"{u.Status} · {u.SubmittedAt:yyyy-MM-dd HH:mm}"),
        Cat<VehicleModel>("vehicle-models", "Μοντέλα οχημάτων", v => $"{v.Manufacturer} {v.Model}".Trim(), v => $"{v.Trim ?? ""} · {v.EngineCc?.ToString() ?? "-"} cc · {v.Category ?? "χωρίς κατηγορία"}"),
        Cat<IntegrationSetting>("integration-settings", "Ρυθμίσεις integrations", s => $"{s.Service} / {s.KeyName}", s => s.IsSecret ? "μυστική τιμή" : s.Value),
        Cat<CustomFieldDefinition>("custom-fields", "Custom fields", f => f.Label.TrimOr(f.Code), f => $"{f.EntityType} · {f.Kind}"),
        Cat<MovementType>("movement-types", "Τύποι κινήσεων", m => m.Name.TrimOr(m.Code), m => $"{m.Category} · {m.Party}"),
        Cat<BonusMalusRule>("bonus-malus-rules", "Bonus-Malus κανόνες", r => r.Name, r => $"{r.PolicyTypeFilter} · {r.AdjustmentPercent:0.00}%"),
        Cat<RenewalRule>("renewal-rules", "Κανόνες ανανέωσης", r => r.Name, r => $"{r.PolicyTypeFilter} · σειρά {r.DisplayOrder}"),
        Cat<RegisterTemplate>("register-templates", "Μητρώα", r => r.Name.TrimOr(r.Code), r => $"{r.PolicyTypeFilter} · {(r.IsDefault ? "default" : "custom")}"),
        Cat<AdvancePayment>("advance-payments", "Προκαταβολές", a => a.Number, a => $"{a.PartyType} · {a.Amount:0.00} {a.Currency} · {a.Status}"),
        Cat<ReconciliationLink>("reconciliation-links", "Συσχετίσεις κινήσεων", r => $"{r.SourceType} → {r.TargetType}", r => $"{r.LinkedOn:yyyy-MM-dd} · {r.Amount:0.00} {r.Currency}"),
        Cat<TachyPaymentBatch>("tachy-batches", "Ταχυπληρωμές", b => b.BatchNumber, b => $"{b.Status} · {b.PolicyCount} συμβόλαια · {b.TotalAmount:0.00} {b.Currency}"),
        Cat<EditableDocument>("editable-documents", "Επεξεργάσιμα έγγραφα", d => d.Title, d => $"{d.EntityType} · {(d.IsFinalised ? "οριστικοποιημένο" : "πρόχειρο")}"),
        Cat<InfoCenterExport>("info-center-exports", "Εξαγωγές Info Center", e => e.BatchNumber, e => $"{e.Kind} · {e.Status} · {e.RecordCount} εγγραφές"),
        Cat<SapBridgeMapping>("sap-mappings", "SAP mappings", m => m.SapAccount, m => $"{m.CostCenter ?? "χωρίς cost center"} · {(m.ExportEnabled ? "export on" : "export off")}"),
        Cat<PeriodLock>("period-locks", "Κλειδώματα περιόδων", l => $"{l.Scope} πριν {l.LockedBefore:yyyy-MM-dd}", l => l.Reason)
    };

    [HttpGet]
    public async Task<ActionResult<RecyclePageDto>> List(
        [FromQuery] string? category,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        await EnsurePremiumAsync(tenantId, PremiumFeatureCodes.RecycleBin, ct);
        var now = _clock.UtcNow;
        var cutoff = now.AddDays(-RetentionDays);
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);

        var categoryDtos = new List<RecycleCategoryDto>();
        foreach (var cat in Categories)
        {
            var count = await cat.CountAsync(_db, tenantId, cutoff, ct);
            categoryDtos.Add(new RecycleCategoryDto(cat.Key, cat.Label, count));
        }

        var selected = string.IsNullOrWhiteSpace(category) || category == "all"
            ? Categories
            : Categories.Where(c => string.Equals(c.Key, category, StringComparison.OrdinalIgnoreCase)).ToList();
        if (selected.Count == 0) throw AppException.NotFound("Κατηγορία κάδου");

        var items = new List<RecycleItemDto>();
        foreach (var cat in selected)
            items.AddRange(await cat.ListAsync(_db, tenantId, cutoff, now, search, ct));

        var ordered = items.OrderByDescending(x => x.DeletedAt).ToList();
        var total = ordered.Count;
        var paged = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new RecyclePageDto(categoryDtos, paged, total, page, pageSize, RetentionDays));
    }

    [HttpPost("{category}/{id:guid}/restore")]
    public async Task<ActionResult<RestoreResultDto>> Restore(string category, Guid id, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        await EnsurePremiumAsync(tenantId, PremiumFeatureCodes.RecycleBin, ct);
        var cat = Categories.FirstOrDefault(c => string.Equals(c.Key, category, StringComparison.OrdinalIgnoreCase))
            ?? throw AppException.NotFound("Κατηγορία κάδου");

        var restored = await cat.RestoreAsync(_db, tenantId, id, _clock.UtcNow, ct);
        if (!restored) throw AppException.NotFound("Διαγραμμένη εγγραφή");

        return Ok(new RestoreResultDto(cat.Key, id, true));
    }

    private static RecycleCategory<TEntity> Cat<TEntity>(
        string key,
        string label,
        Func<TEntity, string> title,
        Func<TEntity, string?> subtitle)
        where TEntity : BaseEntity
        => new(key, label, title, subtitle);

    private static string Short(string? value)
    {
        var s = value?.Trim();
        if (string.IsNullOrWhiteSpace(s)) return "—";
        return s.Length <= 90 ? s : s[..90] + "…";
    }

    private async Task EnsurePremiumAsync(Guid tenantId, string code, CancellationToken ct)
    {
        var rows = await _db.TenantPackageGrants
            .Where(g => g.TenantId == tenantId && g.DeletedAt == null && g.PremiumFeaturesJson != null)
            .Select(g => g.PremiumFeaturesJson!)
            .ToListAsync(ct);
        foreach (var json in rows)
            foreach (var c in PremiumFeatureJson.TryParseCodes(json))
                if (string.Equals(c, code, StringComparison.OrdinalIgnoreCase)) return;
        throw new AppException(
            "premium_required",
            "Αυτή η δυνατότητα απαιτεί αναβάθμιση πλάνου.",
            402,
            title: "Premium δυνατότητα",
            why: $"Το {code} είναι premium feature. Επικοινωνήστε με το Kalypsis για ενεργοποίηση.");
    }

    private interface IRecycleCategory
    {
        string Key { get; }
        string Label { get; }
        Task<int> CountAsync(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, DateTime cutoff, CancellationToken ct);
        Task<IReadOnlyList<RecycleItemDto>> ListAsync(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, DateTime cutoff, DateTime now, string? search, CancellationToken ct);
        Task<bool> RestoreAsync(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, Guid id, DateTime now, CancellationToken ct);
    }

    private sealed class RecycleCategory<TEntity> : IRecycleCategory where TEntity : BaseEntity
    {
        private readonly Func<TEntity, string> _title;
        private readonly Func<TEntity, string?> _subtitle;

        public RecycleCategory(string key, string label, Func<TEntity, string> title, Func<TEntity, string?> subtitle)
        {
            Key = key;
            Label = label;
            _title = title;
            _subtitle = subtitle;
        }

        public string Key { get; }
        public string Label { get; }

        public async Task<int> CountAsync(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, DateTime cutoff, CancellationToken ct)
            => await BaseQuery(db, tenantId, cutoff).CountAsync(ct);

        public async Task<IReadOnlyList<RecycleItemDto>> ListAsync(
            Kalypsis.Infrastructure.Persistence.AppDbContext db,
            Guid tenantId,
            DateTime cutoff,
            DateTime now,
            string? search,
            CancellationToken ct)
        {
            var rows = await BaseQuery(db, tenantId, cutoff)
                .OrderByDescending(x => x.DeletedAt)
                .Take(MaxMaterializedPerCategory)
                .ToListAsync(ct);

            var q = rows.Select(x =>
            {
                var deletedAt = x.DeletedAt ?? now;
                var expiresAt = deletedAt.AddDays(RetentionDays);
                return new RecycleItemDto(
                    Key,
                    Label,
                    x.Id,
                    Clean(_title(x)),
                    Clean(_subtitle(x)),
                    deletedAt,
                    expiresAt,
                    Math.Max(0, (int)Math.Ceiling((expiresAt - now).TotalDays)));
            });

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(x =>
                    x.Title.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                    (x.Subtitle?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false) ||
                    x.Id.ToString().Contains(s, StringComparison.OrdinalIgnoreCase) ||
                    x.CategoryLabel.Contains(s, StringComparison.OrdinalIgnoreCase));
            }

            return q.ToList();
        }

        public async Task<bool> RestoreAsync(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, Guid id, DateTime now, CancellationToken ct)
        {
            var row = await ScopeTenant(db.Set<TEntity>().IgnoreQueryFilters(), tenantId)
                .FirstOrDefaultAsync(x => x.Id == id && x.DeletedAt != null, ct);
            if (row is null) return false;

            row.DeletedAt = null;
            row.UpdatedAt = now;
            await db.SaveChangesAsync(ct);
            return true;
        }

        private static IQueryable<TEntity> BaseQuery(Kalypsis.Infrastructure.Persistence.AppDbContext db, Guid tenantId, DateTime cutoff)
            => ScopeTenant(db.Set<TEntity>().IgnoreQueryFilters(), tenantId)
                .Where(x => x.DeletedAt != null && x.DeletedAt >= cutoff);

        private static IQueryable<TEntity> ScopeTenant(IQueryable<TEntity> q, Guid tenantId)
        {
            if (typeof(TenantEntity).IsAssignableFrom(typeof(TEntity)))
                q = q.Where(x => EF.Property<Guid>(x, nameof(TenantEntity.TenantId)) == tenantId);
            return q;
        }

        private static string Clean(string? value) => string.IsNullOrWhiteSpace(value) ? "—" : value.Trim();
    }
}

internal static class RecycleBinStringExtensions
{
    public static string TrimOr(this string? value, string fallback)
    {
        var v = value?.Trim();
        return string.IsNullOrWhiteSpace(v) ? fallback : v;
    }
}
