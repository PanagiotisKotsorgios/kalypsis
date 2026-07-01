using System.Globalization;
using System.Text.Json;
using ClosedXML.Excel;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CarrierBridges;

// ============================================================================
// Phase 15 — Carrier bridge xlsx import.
// Each carrier exposes data in a different format. We define a per-carrier
// mapping that knows which Excel columns to read and produces a uniform
// PreviewRow that the UI renders in an Excel-like table with diff badges.
// ============================================================================

/// <summary>One row as it appears in the preview UI before commit.</summary>
public record BridgeImportRow(
    int Index,
    string? PolicyNumber, string? ProposalNumber,
    string? CustomerName, string? CustomerVat,
    DateOnly? IssueDate, DateOnly? StartDate, DateOnly? EndDate,
    decimal? GrossPremium, decimal? NetPremium,
    decimal? PartnerCommission, decimal? AgencyCommission,
    string? CarrierName, string? PartnerCode,
    Dictionary<string, string> Raw,
    List<BridgeImportNote> Notes,
    string Status,                                   // Ready / WarnDiff / Error / Duplicate
    string RowType = "New",                          // New / Renewal / Cancellation / Endorsement / GreenCard
    Guid? LinkedPolicyId = null,
    string? LinkedPolicyNumber = null,
    string? PlateNumber = null);                     // ERGO auto: col5 is the license plate

/// <summary>A single warning attached to a row — usually a diff vs parameterization.</summary>
public record BridgeImportNote(string Field, string Severity, string Message);

/// <summary>Carrier list — what the agency may import. Only carriers the agency has
/// already added as InsuranceCompany are selectable.</summary>
public record AvailableCarrierDto(
    Guid InsuranceCompanyId, string Name, string Code,
    bool BridgeAvailable, string? BridgeFormat, string? UnavailableReason);

public record ListAvailableCarrierBridgesQuery() : IRequest<IReadOnlyList<AvailableCarrierDto>>;
public class ListAvailableCarrierBridgesHandler : IRequestHandler<ListAvailableCarrierBridgesQuery, IReadOnlyList<AvailableCarrierDto>>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public ListAvailableCarrierBridgesHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    // Carriers we know how to parse. Keyed by uppercase carrier name/code substrings.
    // - ERGO ships a single .xlsx.
    // - GRAND COVER ships a .zip containing Policies.csv, Customers.csv,
    //   Objects.csv, Covers.csv and one FBC00100_<class>.csv per vehicle
    //   class (1 = passenger cars, 6 = vintage, 26 = trucks, 28 = other
    //   cars, 77 = old car), all CP1253-encoded semicolon-separated.
    private static readonly HashSet<string> SupportedTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        "ERGO",
        "GRAND COVER",
        "GRANDCOVER"
    };

    public async Task<IReadOnlyList<AvailableCarrierDto>> Handle(ListAvailableCarrierBridgesQuery _, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        // Subcompanies of a broker share the broker's bridge — they don't get
        // their own slot here. So we exclude any row with a ParentCompanyId.
        // Top-level brokers (πρακτορεία) and standalone carriers only.
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.DeletedAt == null
                && (c.TenantId == null || c.TenantId == tenantId)
                && c.ParentCompanyId == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        return carriers.Select(c =>
        {
            var token = SupportedTokens.FirstOrDefault(s =>
                (c.Code ?? "").ToUpperInvariant().Contains(s) ||
                (c.Name ?? "").ToUpperInvariant().Contains(s));
            return new AvailableCarrierDto(
                c.Id, c.Name, c.Code,
                token != null,
                token,
                token == null ? "format_not_supported_yet" : null);
        }).ToList();
    }
}

/* ============================================================================
   PREVIEW — parse xlsx and return rows for the user to review (no DB writes).
   ========================================================================= */

public record PreviewBridgeImportCommand(
    Guid InsuranceCompanyId, string FileName, byte[] FileContent,
    string Lob = "auto") : IRequest<BridgeImportPreviewResult>;   // "auto" | "fire"

public record BridgeImportPreviewResult(
    string Carrier, string Format, int RowCount,
    IReadOnlyList<BridgeImportRow> Rows,
    int ReadyCount, int WarnCount, int ErrorCount, int DuplicateCount);

public class PreviewBridgeImportHandler : IRequestHandler<PreviewBridgeImportCommand, BridgeImportPreviewResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public PreviewBridgeImportHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<BridgeImportPreviewResult> Handle(PreviewBridgeImportCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.InsuranceCompanyId && c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId), ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρία");

        var carrierKey = (carrier.Code + " " + carrier.Name).ToUpperInvariant();
        var isErgo = carrierKey.Contains("ERGO");
        var isGrandCover = carrierKey.Contains("GRAND COVER") || carrierKey.Contains("GRANDCOVER");
        if (!isErgo && !isGrandCover)
            throw new AppException("bridge_format_not_supported",
                "Δεν υπάρχει διαθέσιμος αναλυτής για αυτή την εταιρία ακόμη.", 400,
                title: "Μη υποστηριζόμενος αναλυτής",
                why: "Κάθε εταιρία στέλνει το αρχείο της σε διαφορετική μορφή. Έχουμε υλοποιήσει μέχρι στιγμής ERGO και Grand Cover.",
                fix: "Επιλέξτε ERGO ή Grand Cover, ή ζητήστε υποστήριξη για τη συγκεκριμένη εταιρία.");

        // File-shape detection. ERGO ships one .xlsx; Grand Cover ships a
        // .zip with the CSV pack. We sniff the magic bytes so an admin can
        // upload either regardless of the filename.
        var isZip = r.FileContent.Length >= 4
            && r.FileContent[0] == 0x50 && r.FileContent[1] == 0x4B
            && (r.FileContent[2] == 0x03 || r.FileContent[2] == 0x05 || r.FileContent[2] == 0x07);
        // xlsx is technically a zip too, but its central directory has an
        // [Content_Types].xml. We treat as zip-pack only when the archive
        // contains a Policies.csv entry at root.
        List<BridgeImportRow> rows;
        string format;
        if (isGrandCover)
        {
            if (!isZip)
                throw new AppException("grand_cover_zip_required",
                    "Το Grand Cover εξάγει τα δεδομένα σε αρχείο .zip. Ανεβάστε το πλήρες πακέτο εξαγωγής.",
                    400,
                    title: "Λάθος μορφή αρχείου",
                    why: "Δεν εντοπίστηκε αρχείο zip.",
                    fix: "Από το Grand Cover επιλέξτε «Εξαγωγή Συμβολαίων» και ανεβάστε το .zip που κατέβηκε αυτούσιο.");
            rows = ParseGrandCoverZip(r.FileContent);
            format = "GRAND_COVER";
        }
        else
        {
            using var stream = new MemoryStream(r.FileContent);
            XLWorkbook wb;
            try { wb = new XLWorkbook(stream); }
            catch (Exception ex)
            {
                throw new AppException("xlsx_invalid",
                    "Δεν είναι έγκυρο αρχείο Excel.", 400,
                    title: "Ακατάλληλο αρχείο",
                    why: ex.Message,
                    fix: "Σιγουρευτείτε ότι ανεβάζετε .xlsx από ERGO χωρίς αλλαγές.");
            }
            rows = ParseErgo(wb);
            format = "ERGO";
        }

        // LOB sanity check — refuse a mis-routed upload (auto file into fire
        // slot or the other way around). Only ERGO ships two separate
        // .xlsx (one per LOB) so this only applies there; Grand Cover's
        // .zip is mixed by design.
        if (format == "ERGO")
        {
            var sample = rows.Take(20).ToList();
            var hasPlates = sample.Count(x => !string.IsNullOrEmpty(x.PlateNumber));
            var lob = (r.Lob ?? "auto").ToLowerInvariant();
            if (lob == "auto" && sample.Count > 0 && hasPlates == 0)
                throw new AppException("lob_mismatch_auto",
                    "Το αρχείο δεν φαίνεται να είναι αυτοκινήτου — δεν εντοπίστηκαν πινακίδες σε καμία γραμμή.", 400,
                    title: "Λάθος κλάδος",
                    why: "Επιλέξατε «Αυτοκίνητο» αλλά οι πρώτες γραμμές δεν έχουν αριθμό πινακίδας.",
                    fix: "Ανεβάστε το αρχείο στο πεδίο «Πυρός / Περιουσίας» ή επιλέξτε το σωστό xlsx από ERGO.");
            if (lob == "fire" && sample.Count > 0 && hasPlates > sample.Count / 2)
                throw new AppException("lob_mismatch_fire",
                    "Το αρχείο φαίνεται να είναι αυτοκινήτου — εντοπίστηκαν πινακίδες σε πολλές γραμμές.", 400,
                    title: "Λάθος κλάδος",
                    why: "Επιλέξατε «Πυρός / Περιουσίας» αλλά οι περισσότερες γραμμές έχουν αριθμό πινακίδας.",
                    fix: "Ανεβάστε το αρχείο στο πεδίο «Αυτοκίνητο».");
        }

        await ApplyDiffsAsync(rows, carrier.Id, ct);

        return new BridgeImportPreviewResult(
            carrier.Name, format,
            rows.Count, rows,
            rows.Count(x => x.Status == "Ready"),
            rows.Count(x => x.Status == "WarnDiff"),
            rows.Count(x => x.Status == "Error"),
            rows.Count(x => x.Status == "Duplicate"));
    }

    // ========================================================================
    // ERGO format: 12 columns. Header at row 1. Data from row 2.
    // 0 Εταιρεία (ΓΕΦ) — "ERGO HELLAS"
    // 1 Συνεργάτης (ΓΕΦ)
    // 2 Συμβαλλόμενος (ονοματ.)
    // 3 Συμβόλαιο
    // 4 Αρ. προσφοράς
    // 5 Ημ. έκδοσης
    // 6 Ημ. έναρξης
    // 7 Ημ. λήξης
    // 8 Ποσό μεικτό
    // 9 Καθαρό
    // 10 Προμήθεια συνεργάτη
    // 11 Προμήθεια γραφείου
    // ========================================================================
    private static List<BridgeImportRow> ParseErgo(XLWorkbook wb)
    {
        // ERGO xlsx column layout (verified from real samples):
        //  col1: ΕΤΑΙΡΙΑ           (carrier — only filled on row 2)
        //  col2: ΣΥΝΕΡΓΑΤΗΣ        (partner code — only filled on row 2 for some files)
        //  col3: ΟΝΟΜΑΤΕΠΩΝΥΜΟ     (customer name / company name)
        //  col4: ΑΣΦΑΛΙΣΤΗΡΙΟ      (policy number — e.g. "02069746703" — NOT an AFM)
        //  col5: ΑΡ.ΠΡΟΤΑΣΗΣ       (proposal num / for auto = LICENSE PLATE e.g. "ΖΚΝ2307")
        //  col6: ΗΜ.ΕΚΔΟΣΗΣ        (issue date)
        //  col7: ΗΜ.ΕΝΑΡΞΗΣ        (start date)
        //  col8: ΗΜ.ΛΗΞΗΣ          (end date)
        //  col9–12: ΜΕΙΚΤΟ / ΚΑΘΑΡΟ / ΠΡΟΜ.ΣΥΝ / ΠΡΟΜ.ΓΡΑΦ
        // ERGO does NOT export the customer's AFM — we cannot validate it
        // and we cannot match policies by AFM. Customer matching at commit
        // time uses name (with carrier scope).
        var ws = wb.Worksheets.First();
        var rows = new List<BridgeImportRow>();
        var lastRow = ws.LastRowUsed();
        if (lastRow is null) return rows;

        var lastRowNum = lastRow.RowNumber();
        var lastColumnNum = Math.Max(12, ws.LastColumnUsed()?.ColumnNumber() ?? 12);
        var carrierName = ws.Cell(2, 1).GetString().Trim();
        var partnerCodeFromHeader = ws.Cell(2, 2).GetString().Trim();

        for (int rn = 2; rn <= lastRowNum; rn++)
        {
            var notes = new List<BridgeImportNote>();
            var raw = new Dictionary<string, string>();
            for (int col = 1; col <= lastColumnNum; col++)
            {
                var header = ws.Cell(1, col).GetString().Trim();
                raw[string.IsNullOrWhiteSpace(header) ? $"col{col}" : header] = ws.Cell(rn, col).GetString();
            }

            string? customerName = ws.Cell(rn, 3).GetString().Trim();
            string? policyNumber = ws.Cell(rn, 4).GetString().Trim();
            string? plateOrProposal = ws.Cell(rn, 5).GetString().Trim();

            if (string.IsNullOrWhiteSpace(customerName) && string.IsNullOrWhiteSpace(policyNumber))
                continue; // skip empty separator/footer rows

            DateOnly? issue = ParseDate(ws.Cell(rn, 6).Value);
            DateOnly? start = ParseDate(ws.Cell(rn, 7).Value);
            DateOnly? end = ParseDate(ws.Cell(rn, 8).Value);
            decimal? gross = ParseAmount(ws.Cell(rn, 9).Value);
            decimal? net = ParseAmount(ws.Cell(rn, 10).Value);
            decimal? partnerComm = ParseAmount(ws.Cell(rn, 11).Value);
            decimal? agencyComm = ParseAmount(ws.Cell(rn, 12).Value);

            // Heuristic: if col5 looks like a Greek license plate (3 letters + 4 digits,
            // possibly with leading spaces), keep it as plate; otherwise it's a proposal #.
            string? plate = null;
            string? proposal = null;
            if (!string.IsNullOrEmpty(plateOrProposal))
            {
                var cleaned = new string(plateOrProposal.Where(c => !char.IsWhiteSpace(c)).ToArray());
                var letters = cleaned.TakeWhile(char.IsLetter).Count();
                var digits  = cleaned.SkipWhile(char.IsLetter).All(char.IsDigit);
                if (letters is >= 2 and <= 3 && digits && cleaned.Length is >= 5 and <= 8) plate = cleaned;
                else proposal = plateOrProposal;
            }

            // Validations
            var status = "Ready";
            if (string.IsNullOrWhiteSpace(policyNumber))
            { status = "Error"; notes.Add(new BridgeImportNote("Ασφαλιστήριο", "error", "Αριθμός ασφαλιστηρίου λείπει")); }

            if (string.IsNullOrWhiteSpace(customerName))
            { status = "Error"; notes.Add(new BridgeImportNote("Συμβαλλόμενος", "error", "Όνομα/Επωνυμία λείπει")); }

            if (!gross.HasValue)
            { status = "Error"; notes.Add(new BridgeImportNote("Μεικτό", "error", "Μη έγκυρο μεικτό ποσό")); }
            else if (gross.Value == 0m)
                notes.Add(new BridgeImportNote("Μεικτό", "warn", "Μηδενικό ασφάλιστρο"));

            // ===== Row-type detection =====
            // The ERGO xlsx mixes new contracts with cancellation lines (negative
            // amounts), endorsements (short duration vs annual), green cards
            // (very small premium with motor-specific proposal prefix or "ΠΡ.ΚΑΡΤΑ"
            // text), and renewals (issue date close to prior policy end).
            // We infer the type here; the diff pass (ApplyDiffsAsync) reconciles
            // with the live DB to upgrade "New" → "Renewal" when a prior policy fits.
            string rowType = "New";
            var rawConcat = string.Join(" ", raw.Values).ToUpperInvariant();
            var isGreenCardText =
                rawConcat.Contains("ΠΡΑΣΙΝΗ ΚΑΡΤΑ") || rawConcat.Contains("ΠΡ.ΚΑΡΤΑ")
                || rawConcat.Contains("ΠΡ. ΚΑΡΤΑ") || rawConcat.Contains("GREEN CARD");

            if (gross.HasValue && gross.Value < 0)
            {
                rowType = "Cancellation";
                notes.Add(new BridgeImportNote("Τύπος", "info", "Αρνητικό ποσό → ακυρωτική κίνηση"));
            }
            else if (isGreenCardText)
            {
                rowType = "GreenCard";
                notes.Add(new BridgeImportNote("Τύπος", "info", "Αναγνωρίστηκε ως Πράσινη Κάρτα"));
            }
            else if (start.HasValue && end.HasValue)
            {
                var durationDays = end.Value.DayNumber - start.Value.DayNumber;
                // Pure green cards typically last 15–45 days and have a small premium.
                if (durationDays is >= 10 and <= 45 && gross.HasValue && gross.Value > 0 && gross.Value <= 80)
                {
                    rowType = "GreenCard";
                    notes.Add(new BridgeImportNote("Τύπος", "info",
                        $"Διάρκεια {durationDays} ημέρες & μικρό ποσό ({gross.Value:0.00} €) → πιθανή Πράσινη Κάρτα"));
                }
                else if (durationDays < 60)
                {
                    rowType = "Endorsement";
                    notes.Add(new BridgeImportNote("Τύπος", "info", $"Διάρκεια {durationDays} ημέρες → πρόσθετη πράξη"));
                }
            }

            if (start.HasValue && end.HasValue && end.Value <= start.Value)
                notes.Add(new BridgeImportNote("Λήξη", "warn", "Λήξη πριν την έναρξη"));

            rows.Add(new BridgeImportRow(
                rn - 1, policyNumber, proposal,
                customerName, null,                     // ERGO file has no AFM — leave VAT empty
                issue, start, end,
                gross, net, partnerComm, agencyComm,
                carrierName, partnerCodeFromHeader,
                raw, notes, status, rowType, null, null, plate));
        }

        return rows;
    }

    // ========================================================================
    // GRAND COVER format: multi-CSV .zip.
    //
    //   Policies.csv    Α/Α;Εταιρία;Κλάδος;Κατηγορία;Συμβόλαιο;Απόδειξη;
    //                   Πρόταση;Χαρακτ/κό;Πελάτης;Ασφαλιζόμ.;Συνεργάτης;
    //                   Εισπράκτορας;Πωλητής;ΠρώτηΕναρξη;Εκδοση;Εναρξη;
    //                   Λήξη;Διακοπή;Καθαρά;Μικτά;ΠρομΣυνεργάτη;
    //                   ΦόροςΣυνεργάτη;Πακέτο;ΗμΕκτύπωσης;EPaymentCode;
    //                   ΥποΣυνεργάτης;Παρατηρήσεις;Λεπτομέρειες
    //
    //   Customers.csv   Κωδικός;Ονομα;Περιγραφή;Πατρώνυμο;Α.Α.Τ;Α.Φ.Μ;…
    //                   → provides the VAT + address that Policies.csv only
    //                   references by numeric customer id.
    //
    //   Objects.csv     Α/Α (policy);Α/Α (obj);FbcLinkCode;Χαρακτ/κό;
    //                   Κωδ.Αντικειμένου
    //
    //   Covers.csv      Απόδειξη;Αντικείμενο;Κάλυψη;Ασφάλιστρα;Καθαρά;
    //                   ΚαλΚεφάλαιο
    //                   → per-cover breakdown; joined by Απόδειξη+Αντικείμενο.
    //
    //   FBC00100_N.csv  Α/Α;ΙΠΠΟΙ/ΚΥΒΙΚΑ;ΕΡΓΟΣΤΑΣΙΟ[;ΜΟΝΤΕΛΟ];ΧΡΗΣΗ[;ΧΡΗΣΗ2];
    //                   [ΑΞΙΑ;]ΕΤΟΣ
    //                   → vehicle spec per class N (1=cars, 6=vintage,
    //                     26=trucks, 28=other cars, 77=old car). Joined
    //                     by Objects.FbcLinkCode = FBC.Α/Α.
    //
    // All files are CP1253-encoded, semicolon-separated, one row per line.
    // ========================================================================
    private static List<BridgeImportRow> ParseGrandCoverZip(byte[] zipBytes)
    {
        var rows = new List<BridgeImportRow>();
        using var ms = new MemoryStream(zipBytes);
        using var archive = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Read);

        // Load each CSV we recognise. Case-insensitive filename lookup so
        // the pack still parses if a file was renamed with different case.
        Dictionary<string, List<Dictionary<string, string>>> tables =
            new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, List<Dictionary<string, string>>> fbc =
            new(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in archive.Entries)
        {
            if (string.IsNullOrEmpty(entry.Name)) continue;
            if (!entry.Name.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)) continue;
            using var es = entry.Open();
            using var cms = new MemoryStream();
            es.CopyTo(cms);
            var parsed = ParseCp1253Csv(cms.ToArray());
            if (entry.Name.StartsWith("FBC00100_", StringComparison.OrdinalIgnoreCase))
                fbc[Path.GetFileNameWithoutExtension(entry.Name)] = parsed;
            else
                tables[Path.GetFileNameWithoutExtension(entry.Name)] = parsed;
        }

        if (!tables.TryGetValue("Policies", out var policies) || policies.Count == 0)
            throw new AppException("grand_cover_missing_policies",
                "Το αρχείο δεν περιέχει Policies.csv.", 400,
                title: "Ελλιπές πακέτο εξαγωγής",
                why: "Απαιτούμε τουλάχιστον Policies.csv για να ξεκινήσει η εισαγωγή.",
                fix: "Επαναλάβετε την εξαγωγή από το Grand Cover χωρίς να αφαιρέσετε αρχεία.");

        tables.TryGetValue("Customers", out var customers);
        tables.TryGetValue("Objects", out var objects);
        tables.TryGetValue("Covers", out var covers);

        // --- Build lookup indexes -------------------------------------------
        // Customers.csv keyed by numeric Κωδικός → gives us name + AFM +
        // phone + address per row.
        var customerById = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        if (customers != null)
        {
            foreach (var c in customers)
            {
                var code = FirstNonEmpty(c, "Κωδικός", "code");
                if (!string.IsNullOrEmpty(code)) customerById[code] = c;
            }
        }

        // Objects grouped by policy Α/Α (first column). Grand Cover uses two
        // columns named Α/Α — the first is the policy id, the second is the
        // object id. `ParseCp1253Csv` renames the duplicate to "Α/Α_2".
        var objectsByPolicy = new Dictionary<string, List<Dictionary<string, string>>>(StringComparer.Ordinal);
        if (objects != null)
        {
            foreach (var o in objects)
            {
                var polId = FirstNonEmpty(o, "Α/Α", "policyId");
                if (string.IsNullOrEmpty(polId)) continue;
                if (!objectsByPolicy.TryGetValue(polId, out var list))
                    objectsByPolicy[polId] = list = new List<Dictionary<string, string>>();
                list.Add(o);
            }
        }

        // FBC vehicle rows keyed by (fileClass, Α/Α). We collapse into a
        // single "linkCode → spec" dict because Objects.csv already knows
        // which FBC file to consult via FbcLinkCode; but if the caller
        // renamed the FBC files we still want to find the row, so we build a
        // global lookup keyed by Α/Α across every FBC file.
        var fbcByLinkCode = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        foreach (var kv in fbc)
        {
            foreach (var row in kv.Value)
            {
                var id = FirstNonEmpty(row, "Α/Α", "id");
                if (!string.IsNullOrEmpty(id)) fbcByLinkCode[id] = row;
            }
        }

        // Covers grouped by (Απόδειξη, Αντικείμενο). We collapse into per-
        // policy totals + a small list of cover codes so previews stay
        // compact.
        var coversByReceipt = new Dictionary<string, List<Dictionary<string, string>>>(StringComparer.Ordinal);
        if (covers != null)
        {
            foreach (var cv in covers)
            {
                var receipt = FirstNonEmpty(cv, "Απόδειξη", "receipt");
                if (string.IsNullOrEmpty(receipt)) continue;
                if (!coversByReceipt.TryGetValue(receipt, out var list))
                    coversByReceipt[receipt] = list = new List<Dictionary<string, string>>();
                list.Add(cv);
            }
        }

        // --- Produce a BridgeImportRow per Policies.csv row -----------------
        int index = 0;
        foreach (var p in policies)
        {
            index++;
            var notes = new List<BridgeImportNote>();
            var policyId = FirstNonEmpty(p, "Α/Α", "id");
            var subCarrierNumeric = FirstNonEmpty(p, "Εταιρία", "carrier");
            var branchCode = FirstNonEmpty(p, "Κλάδος", "branch");
            var policyNumber = FirstNonEmpty(p, "Συμβόλαιο", "policy");
            var receiptNumber = FirstNonEmpty(p, "Απόδειξη", "receipt");
            var proposal = FirstNonEmpty(p, "Πρόταση", "proposal");
            var plate = FirstNonEmpty(p, "Χαρακτ/κό", "plate");
            var customerId = FirstNonEmpty(p, "Πελάτης", "customer");
            var producerCode = FirstNonEmpty(p, "Συνεργάτης", "producer");
            var subProducerCode = FirstNonEmpty(p, "ΥποΣυνεργάτης");
            var firstStart = ParseGcDate(FirstNonEmpty(p, "ΠρώτηΕναρξη"));
            var issue = ParseGcDate(FirstNonEmpty(p, "Εκδοση", "issue"));
            var start = ParseGcDate(FirstNonEmpty(p, "Εναρξη", "start"));
            var end = ParseGcDate(FirstNonEmpty(p, "Λήξη", "end"));
            var cancelled = ParseGcDate(FirstNonEmpty(p, "Διακοπή"));
            var net = ParseGcAmount(FirstNonEmpty(p, "Καθαρά", "net"));
            var gross = ParseGcAmount(FirstNonEmpty(p, "Μικτά", "gross"));
            var partnerComm = ParseGcAmount(FirstNonEmpty(p, "ΠρομΣυνεργάτη", "partnerCommission"));
            var partnerCommTax = ParseGcAmount(FirstNonEmpty(p, "ΦόροςΣυνεργάτη"));
            var packageCode = FirstNonEmpty(p, "Πακέτο", "package");
            var epayment = FirstNonEmpty(p, "EPaymentCode");

            // Preview raw pack — everything the user might want to see in the
            // side panel. The commit path uses these where relational fields
            // don't exist on Policy yet (package, cover breakdown, etc.).
            var raw = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in p) raw[kv.Key] = kv.Value;

            // ---- Customer enrichment ---------------------------------------
            string? customerName = null;
            string? customerVat = null;
            if (!string.IsNullOrEmpty(customerId) && customerById.TryGetValue(customerId, out var custRow))
            {
                customerName = FirstNonEmpty(custRow, "Ονομα", "name");
                customerVat  = FirstNonEmpty(custRow, "Α.Φ.Μ", "afm", "vat");
                var phone    = FirstNonEmpty(custRow, "Τηλέφωνο", "phone");
                var mobile   = FirstNonEmpty(custRow, "Κινητό", "mobile");
                var email    = FirstNonEmpty(custRow, "Email", "email");
                if (!string.IsNullOrEmpty(customerVat)) raw["Customer.ΑΦΜ"] = customerVat;
                if (!string.IsNullOrEmpty(phone))       raw["Customer.Τηλ"] = phone;
                if (!string.IsNullOrEmpty(mobile))      raw["Customer.Κινητό"] = mobile;
                if (!string.IsNullOrEmpty(email))       raw["Customer.Email"] = email;
            }

            // ---- Objects + vehicle spec enrichment -------------------------
            if (!string.IsNullOrEmpty(policyId) && objectsByPolicy.TryGetValue(policyId, out var objList))
            {
                var summaries = new List<string>();
                foreach (var o in objList)
                {
                    var link = FirstNonEmpty(o, "FbcLinkCode");
                    var objKind = FirstNonEmpty(o, "Κωδ.Αντικειμένου");
                    if (!string.IsNullOrEmpty(link) && fbcByLinkCode.TryGetValue(link, out var fbcRow))
                    {
                        var hpCc = FirstNonEmpty(fbcRow, "ΙΠΠΟΙ/ΚΥΒΙΚΑ");
                        var make = FirstNonEmpty(fbcRow, "ΕΡΓΟΣΤΑΣΙΟ");
                        var model = FirstNonEmpty(fbcRow, "ΜΟΝΤΕΛΟ");
                        var use = FirstNonEmpty(fbcRow, "ΧΡΗΣΗ");
                        var year = FirstNonEmpty(fbcRow, "ΕΤΟΣ");
                        summaries.Add(string.Join(" ", new[] { make, model, hpCc, use, year }.Where(s => !string.IsNullOrWhiteSpace(s))));
                    }
                    else summaries.Add(objKind);
                }
                if (summaries.Count > 0)
                    raw["Αντικείμενα"] = string.Join(" | ", summaries.Where(s => !string.IsNullOrWhiteSpace(s)));
            }

            // ---- Cover breakdown enrichment --------------------------------
            if (!string.IsNullOrEmpty(receiptNumber) && coversByReceipt.TryGetValue(receiptNumber, out var covRows))
            {
                var codes = covRows
                    .Select(cv => FirstNonEmpty(cv, "Κάλυψη"))
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.Ordinal)
                    .ToList();
                if (codes.Count > 0) raw["Καλύψεις"] = string.Join(", ", codes);
                var coverSum = covRows.Sum(cv => ParseGcAmount(FirstNonEmpty(cv, "Ασφάλιστρα")) ?? 0m);
                if (coverSum > 0) raw["Καλύψεις Σύνολο"] = coverSum.ToString("F2", CultureInfo.InvariantCulture);
            }

            // Copy structured keys back onto the raw pack so downstream
            // reporting / commit can pick them up without re-parsing.
            if (!string.IsNullOrEmpty(subCarrierNumeric)) raw["Sub.Carrier.Id"] = subCarrierNumeric;
            if (!string.IsNullOrEmpty(branchCode))       raw["Κλάδος.Code"] = branchCode;
            if (!string.IsNullOrEmpty(packageCode))      raw["Πακέτο.Code"] = packageCode;
            if (!string.IsNullOrEmpty(producerCode))     raw["Συνεργάτης.Code"] = producerCode;
            if (!string.IsNullOrEmpty(subProducerCode) && subProducerCode != "0")
                raw["ΥποΣυνεργάτης.Code"] = subProducerCode;
            if (!string.IsNullOrEmpty(epayment)) raw["EPaymentCode"] = epayment;

            // ---- Validation + row-type detection ---------------------------
            var status = "Ready";
            if (string.IsNullOrWhiteSpace(policyNumber))
            {
                status = "Error";
                notes.Add(new BridgeImportNote("Συμβόλαιο", "error", "Αριθμός συμβολαίου λείπει"));
            }
            if (string.IsNullOrWhiteSpace(customerName))
            {
                status = "Error";
                notes.Add(new BridgeImportNote("Πελάτης", "error", "Πελάτης χωρίς όνομα (ελλείπει από Customers.csv)"));
            }
            if (!gross.HasValue)
            {
                status = "Error";
                notes.Add(new BridgeImportNote("Μικτά", "error", "Μη έγκυρο ποσό ασφαλίστρου"));
            }
            else if (gross.Value == 0m)
                notes.Add(new BridgeImportNote("Μικτά", "warn", "Μηδενικό ασφάλιστρο"));

            string rowType = "New";
            if (gross.HasValue && gross.Value < 0)
            {
                rowType = "Cancellation";
                notes.Add(new BridgeImportNote("Τύπος", "info", "Αρνητικό ποσό → ακυρωτική κίνηση"));
            }
            else if (cancelled.HasValue)
            {
                rowType = "Cancellation";
                notes.Add(new BridgeImportNote("Τύπος", "info",
                    $"Ημ. διακοπής {cancelled:dd/MM/yyyy} → ακύρωση συμβολαίου"));
            }
            else if (start.HasValue && end.HasValue)
            {
                var days = end.Value.DayNumber - start.Value.DayNumber;
                if (days is >= 10 and <= 45 && gross.HasValue && gross.Value > 0 && gross.Value <= 80)
                {
                    rowType = "GreenCard";
                    notes.Add(new BridgeImportNote("Τύπος", "info",
                        $"Διάρκεια {days} ημέρες & μικρό ποσό ({gross.Value:0.00} €) → πιθανή Πράσινη Κάρτα"));
                }
                else if (days < 60)
                {
                    rowType = "Endorsement";
                    notes.Add(new BridgeImportNote("Τύπος", "info", $"Διάρκεια {days} ημέρες → πρόσθετη πράξη"));
                }
                else if (firstStart.HasValue && firstStart.Value != start.Value)
                {
                    rowType = "Renewal";
                    notes.Add(new BridgeImportNote("Τύπος", "info",
                        $"Πρώτη έναρξη {firstStart:dd/MM/yyyy} → ανανέωση"));
                }
            }

            if (start.HasValue && end.HasValue && end.Value <= start.Value)
                notes.Add(new BridgeImportNote("Λήξη", "warn", "Λήξη πριν την έναρξη"));

            rows.Add(new BridgeImportRow(
                index,
                policyNumber,
                proposal,
                customerName,
                customerVat,
                issue,
                start,
                end,
                gross,
                net,
                partnerComm,
                null,                 // Grand Cover exports partner tax, not agency commission — leave agency null
                null,                 // CarrierName resolved at commit time via Sub.Carrier.Id mapping
                producerCode,
                raw,
                notes,
                status,
                rowType,
                null,
                null,
                string.IsNullOrWhiteSpace(plate) ? null : plate.Trim()));
        }

        return rows;
    }

    /// <summary>Pull the first non-null / non-empty value across the given keys.</summary>
    private static string? FirstNonEmpty(Dictionary<string, string> row, params string[] keys)
    {
        foreach (var k in keys)
        {
            if (row.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v))
                return v.Trim();
        }
        return null;
    }

    /// <summary>Parse a CP1253-encoded semicolon-separated CSV into a
    /// list of column→value dicts. Duplicate column headers are disambiguated
    /// by suffixing "_2", "_3", … since Grand Cover ships two "Α/Α" columns
    /// in Objects.csv (policy Α/Α + object Α/Α).</summary>
    // CP1253 (Windows-Greek) isn't in .NET's default provider set — register
    // the CodePages provider exactly once. This is idempotent and cheap.
    private static readonly bool _cp1253Registered = RegisterCp1253();
    private static bool RegisterCp1253()
    {
        try { System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance); }
        catch { /* already registered by another consumer — ignore */ }
        return true;
    }

    private static List<Dictionary<string, string>> ParseCp1253Csv(byte[] bytes)
    {
        _ = _cp1253Registered;
        var enc = System.Text.Encoding.GetEncoding(1253);
        var text = enc.GetString(bytes);
        var rows = new List<Dictionary<string, string>>();
        var lines = text.Split('\n');
        if (lines.Length == 0) return rows;

        var header = SplitCsvLine(lines[0].TrimEnd('\r'));
        // Disambiguate duplicate column names.
        var seen = new Dictionary<string, int>(StringComparer.Ordinal);
        for (int i = 0; i < header.Count; i++)
        {
            var h = header[i];
            if (!seen.TryAdd(h, 1)) header[i] = $"{h}_{++seen[h]}";
        }

        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i].TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = SplitCsvLine(line);
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int c = 0; c < header.Count; c++)
                dict[header[c]] = c < cols.Count ? cols[c] : "";
            rows.Add(dict);
        }
        return rows;
    }

    /// <summary>Semicolon-separated CSV splitter that respects the quote
    /// convention Grand Cover uses (fields may be quoted when they contain a
    /// literal semicolon).</summary>
    private static List<string> SplitCsvLine(string line)
    {
        var cols = new List<string>();
        var buf = new System.Text.StringBuilder();
        bool inQuote = false;
        for (int i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"') { inQuote = !inQuote; continue; }
            if (ch == ';' && !inQuote) { cols.Add(buf.ToString()); buf.Clear(); continue; }
            buf.Append(ch);
        }
        cols.Add(buf.ToString());
        return cols;
    }

    /// <summary>Parse dd/MM/yyyy dates the way Grand Cover exports them.</summary>
    private static DateOnly? ParseGcDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (DateOnly.TryParseExact(s.Trim(), "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return d;
        if (DateOnly.TryParse(s.Trim(), new CultureInfo("el-GR"), DateTimeStyles.None, out var d2))
            return d2;
        return null;
    }

    /// <summary>Parse "12,34 €" style amounts (Greek locale, optional € suffix).</summary>
    private static decimal? ParseGcAmount(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var cleaned = s.Replace("€", "").Replace(" ", "").Trim();
        if (cleaned.Length == 0) return null;
        cleaned = cleaned.Replace(".", "").Replace(',', '.');   // 1.234,56 → 1234.56
        if (decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var v))
            return v;
        return null;
    }

    /// <summary>Pass over the parsed rows and attach parameterization-diff notes
    /// without mutating the data. Also detect duplicates against existing policies,
    /// link renewals/endorsements to prior policies, and flag missing parameterization.</summary>
    private async Task ApplyDiffsAsync(List<BridgeImportRow> rows, Guid carrierId, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        static bool IsLifecycle(string rowType) => rowType is "Cancellation" or "Endorsement" or "GreenCard";

        var policyNumbers = rows.Where(r => !string.IsNullOrEmpty(r.PolicyNumber))
            .Select(r => r.PolicyNumber!).Distinct().ToList();
        var existingByNumber = policyNumbers.Count == 0
            ? new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase)
            : (await _db.Policies.IgnoreQueryFilters()
                .Where(p => p.TenantId == tenantId && p.InsuranceCompanyId == carrierId && policyNumbers.Contains(p.PolicyNumber) && p.DeletedAt == null)
                .Select(p => new { p.Id, p.PolicyNumber }).ToListAsync(ct))
                .ToDictionary(p => p.PolicyNumber, p => p.Id, StringComparer.OrdinalIgnoreCase);

        // In-file duplicates: when ERGO emits two lines for the same policy number
        // (endorsement / pro-rata), keep the first one importable and flag the rest.
        var seenInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var inFileDups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (int j = 0; j < rows.Count; j++)
        {
            var pn = rows[j].PolicyNumber;
            if (string.IsNullOrEmpty(pn)) continue;
            if (!seenInFile.Add(pn)) inFileDups.Add($"{rows[j].Index}|{pn}");
        }

        // Pull active default-value rules for this carrier so we can compute diffs.
        var rules = await _db.DefaultValueRules
            .Where(x => x.IsActive && (x.InsuranceCompanyId == null || x.InsuranceCompanyId == carrierId))
            .ToListAsync(ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var commissionRules = await _db.CommissionRules.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.DeletedAt == null
                && x.EffectiveFrom <= today
                && (x.EffectiveTo == null || x.EffectiveTo >= today)
                && (!x.InsuranceCompanyId.HasValue || x.InsuranceCompanyId == carrierId))
            .ToListAsync(ct);
        var carrierCode = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(c => c.Id == carrierId && c.DeletedAt == null)
            .Select(c => c.Code)
            .FirstOrDefaultAsync(ct);
        var companyParams = string.IsNullOrWhiteSpace(carrierCode)
            ? new List<CompanyParameterItem>()
            : await _db.CompanyParameterItems.IgnoreQueryFilters()
                .Include(p => p.InsuranceCompany)
                .Where(p => p.DeletedAt == null && p.IsActive && p.InsuranceCompany.Code == carrierCode
                    && (!p.EffectiveFrom.HasValue || p.EffectiveFrom <= today)
                    && (!p.EffectiveTo.HasValue || p.EffectiveTo >= today))
                .ToListAsync(ct);
        var configuredBranches = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.Branch && p.PolicyType.HasValue)
            .Select(p => p.PolicyType!.Value)
            .ToHashSet();
        var bridgeMappings = companyParams
            .Where(p => p.Kind == CompanyParameterItemKind.BridgeCode
                && string.Equals(p.BridgeSystem, "ERGO", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var producerRows = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && p.DeletedAt == null)
            .ToListAsync(ct);
        var producerByCode = producerRows.ToDictionary(p => p.Code, StringComparer.OrdinalIgnoreCase);

        // For renewal-linking: ERGO has no AFM, so we match by normalized customer
        // name within the same carrier. We pull every policy for this carrier that
        // belongs to a customer whose normalized name appears in the file.
        static string NormName(string s) => new string((s ?? "").ToUpperInvariant()
            .Where(ch => !char.IsWhiteSpace(ch) && (char.IsLetterOrDigit(ch))).ToArray());

        var nameSet = rows.Where(r => !string.IsNullOrEmpty(r.CustomerName))
            .Select(r => NormName(r.CustomerName!)).Distinct().ToHashSet();

        var rawExisting = await (from p in _db.Policies.IgnoreQueryFilters()
                                 join c in _db.Customers.IgnoreQueryFilters() on p.CustomerId equals c.Id
                                 where p.TenantId == tenantId && p.InsuranceCompanyId == carrierId && p.DeletedAt == null
                                 select new {
                                     p.Id, p.PolicyNumber, p.StartDate, p.EndDate,
                                     CompanyName = c.CompanyName, FirstName = c.FirstName, LastName = c.LastName
                                 }).ToListAsync(ct);

        var existingByName = rawExisting
            .Select(x => new {
                Key = NormName(x.CompanyName ?? $"{x.FirstName} {x.LastName}"),
                x.Id, x.PolicyNumber, x.StartDate, x.EndDate
            })
            .Where(x => nameSet.Contains(x.Key))
            .GroupBy(x => x.Key)
            .ToDictionary(g => g.Key, g => g.Select(x => (x.Id, x.PolicyNumber, x.StartDate, x.EndDate)).ToList());

        // Cross-row scan: for a given customer (name-normalized) find consecutive periods
        // from the file and flag any gap.
        var rowsByName = rows.Where(r => !string.IsNullOrEmpty(r.CustomerName) && r.StartDate.HasValue && r.EndDate.HasValue)
            .GroupBy(r => NormName(r.CustomerName!));

        for (int i = 0; i < rows.Count; i++)
        {
            var r = rows[i];
            var status = r.Status;
            var rowType = r.RowType;
            Guid? linkedId = null;
            string? linkedNumber = null;

            if (!string.IsNullOrEmpty(r.PolicyNumber) && existingByNumber.TryGetValue(r.PolicyNumber, out var existingPolicyId))
            {
                if (IsLifecycle(rowType))
                {
                    linkedId = existingPolicyId;
                    linkedNumber = r.PolicyNumber;
                    r.Notes.Add(new BridgeImportNote("Συμβόλαιο", "info",
                        "Θα συνδεθεί αυτόματα με το υπάρχον συμβόλαιο ως κίνηση κύκλου ζωής."));
                }
                else
                {
                    status = "Duplicate";
                    r.Notes.Add(new BridgeImportNote("Συμβόλαιο", "warn", "Υπάρχει ήδη συμβόλαιο με αυτόν τον αριθμό — θα παραλειφθεί"));
                }
            }
            else if (!string.IsNullOrEmpty(r.PolicyNumber) && inFileDups.Contains($"{r.Index}|{r.PolicyNumber}") && !IsLifecycle(rowType))
            {
                status = "Duplicate";
                r.Notes.Add(new BridgeImportNote("Συμβόλαιο", "warn",
                    "Δεύτερη εμφάνιση του ίδιου ασφαλιστηρίου σε αυτό το αρχείο (π.χ. πρόσθετη πράξη) — θα παραλειφθεί στην εισαγωγή"));
            }

            // Renewal linking by customer name — if the row's start-date is within 90 days
            // of a prior policy's end-date for the same (carrier, customer name), mark as
            // Renewal and link. If we cannot find a prior policy, we STILL mark the row
            // as a Renewal (because ERGO files only ship renewals/portfolio movements —
            // they're never wholly new contracts the agency has never seen) and flag for
            // manual linking in the UI.
            var nameKey = !string.IsNullOrEmpty(r.CustomerName) ? NormName(r.CustomerName!) : "";
            if (IsLifecycle(rowType) && !linkedId.HasValue && !string.IsNullOrEmpty(nameKey)
                && r.StartDate.HasValue && existingByName.TryGetValue(nameKey, out var activePolicies))
            {
                var coveredPolicies = activePolicies
                    .Where(p => r.StartDate!.Value >= p.StartDate && r.StartDate.Value <= p.EndDate)
                    .OrderByDescending(p => p.EndDate)
                    .ToList();
                if (coveredPolicies.Count == 1)
                {
                    linkedId = coveredPolicies[0].Id;
                    linkedNumber = coveredPolicies[0].PolicyNumber;
                    r.Notes.Add(new BridgeImportNote("Συμβόλαιο", "info",
                        $"Θα συνδεθεί αυτόματα με το ενεργό συμβόλαιο {linkedNumber}."));
                }
            }

            var parentAppearsEarlierInFile = !string.IsNullOrEmpty(r.PolicyNumber)
                && rows.Any(x => x.Index < r.Index && x.PolicyNumber == r.PolicyNumber && !IsLifecycle(x.RowType));
            if (IsLifecycle(rowType) && !linkedId.HasValue && !parentAppearsEarlierInFile)
            {
                status = "Error";
                r.Notes.Add(new BridgeImportNote("Συμβόλαιο", "error",
                    "Δεν βρέθηκε ασφαλές συμβόλαιο-στόχος για την αυτόματη σύνδεση της κίνησης."));
            }

            if (!string.IsNullOrEmpty(nameKey) && r.StartDate.HasValue && rowType == "New"
                && existingByName.TryGetValue(nameKey, out var prior))
            {
                var bestMatch = prior
                    .OrderByDescending(p => p.EndDate)
                    .FirstOrDefault(p => Math.Abs(p.EndDate.DayNumber - r.StartDate!.Value.DayNumber) <= 90
                                       && p.PolicyNumber != r.PolicyNumber);
                if (bestMatch.Id != Guid.Empty)
                {
                    rowType = "Renewal";
                    linkedId = bestMatch.Id;
                    linkedNumber = bestMatch.PolicyNumber;
                    r.Notes.Add(new BridgeImportNote("Τύπος", "info",
                        $"Συνδέθηκε ως ανανέωση του {bestMatch.PolicyNumber} (λήξη {bestMatch.EndDate:dd/MM/yyyy})"));
                }
            }
            // Renewal flag for unlinked: ERGO sheets are portfolio movements — anything
            // we couldn't link is still treated as a renewal pending manual link.
            if (rowType == "New" && r.GrossPremium.HasValue && r.GrossPremium.Value > 0)
            {
                rowType = "Renewal";
                r.Notes.Add(new BridgeImportNote("Τύπος", "warn",
                    "Ανανέωση χωρίς σύνδεση — δεν βρέθηκε προηγούμενο συμβόλαιο. Συνδέστε το χειροκίνητα ή δημιουργήστε το προηγούμενο από το popup."));
            }

            // Gap detection — across rows in THIS file for the same customer name.
            // If two rows have a gap > 1 day, flag the second.
            var sameCust = rowsByName.FirstOrDefault(g => g.Key == nameKey);
            if (sameCust != null && r.StartDate.HasValue)
            {
                var earlierEnd = sameCust
                    .Where(x => x.EndDate.HasValue && x.Index < r.Index && x.EndDate < r.StartDate)
                    .OrderByDescending(x => x.EndDate).FirstOrDefault();
                if (earlierEnd is not null)
                {
                    var gap = r.StartDate.Value.DayNumber - earlierEnd.EndDate!.Value.DayNumber;
                    if (gap > 1)
                        r.Notes.Add(new BridgeImportNote("Κενό κάλυψης", "warn",
                            $"Κενό {gap} ημερών από την προηγούμενη κάλυψη ({earlierEnd.EndDate:dd/MM/yy} → {r.StartDate:dd/MM/yy})"));
                }
            }

            // Missing-parameterization auto-create suggestion (info only — actual creation
            // happens at commit time so the user can review).
            if (!string.IsNullOrEmpty(r.PartnerCode))
            {
                var producerExists = await _db.Producers.IgnoreQueryFilters()
                    .AnyAsync(p => p.Code == r.PartnerCode && p.DeletedAt == null, ct);
                if (!producerExists)
                    r.Notes.Add(new BridgeImportNote("Συνεργάτης", "info",
                        $"Δεν υπάρχει συνεργάτης «{r.PartnerCode}» — θα δημιουργηθεί αυτόματα στην εισαγωγή"));
            }

            var rowPolicyType = !string.IsNullOrEmpty(r.PlateNumber) ? PolicyType.Auto : PolicyType.Other;
            if (companyParams.Count == 0)
            {
                r.Notes.Add(new BridgeImportNote("Παραμετρικά εταιρείας", "warn",
                    "Δεν υπάρχουν κεντρικά παραμετρικά Kalypsis για αυτή την εταιρεία. Η γέφυρα θα εισαχθεί, αλλά λείπει αυτόματη αντιστοίχιση κλάδων/καλύψεων/χρήσεων."));
                if (status == "Ready") status = "WarnDiff";
            }
            else
            {
                if (configuredBranches.Count > 0 && !configuredBranches.Contains(rowPolicyType))
                {
                    r.Notes.Add(new BridgeImportNote("Κλάδος", "warn",
                        $"Ο κλάδος {rowPolicyType} δεν είναι ενεργός στα κεντρικά παραμετρικά της εταιρείας."));
                    if (status == "Ready") status = "WarnDiff";
                }

                if (bridgeMappings.Count > 0 && !bridgeMappings.Any(m =>
                        string.Equals(m.BridgeCode, r.RowType, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(m.Code, $"ERGO_{r.RowType}", StringComparison.OrdinalIgnoreCase)))
                {
                    r.Notes.Add(new BridgeImportNote("Mapping γέφυρας", "warn",
                        $"Δεν υπάρχει ενεργό mapping ERGO για τύπο κίνησης {r.RowType}. Ελέγξτε την κεντρική παραμετροποίηση εταιρείας."));
                    if (status == "Ready") status = "WarnDiff";
                }

                if (r.RowType == "GreenCard" && !companyParams.Any(p =>
                        p.Kind == CompanyParameterItemKind.Coverage &&
                        (string.Equals(p.Code, "GREEN_CARD", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(p.BridgeCode, r.RowType, StringComparison.OrdinalIgnoreCase))))
                {
                    r.Notes.Add(new BridgeImportNote("Κάλυψη", "warn",
                        "Η Πράσινη Κάρτα ήρθε από γέφυρα αλλά δεν βρέθηκε αντίστοιχη κάλυψη GREEN_CARD στα κεντρικά παραμετρικά."));
                    if (status == "Ready") status = "WarnDiff";
                }
            }

            // Diff against parameterization (default value rules) — but never auto-apply.
            // Find the most-specific matching rule and compare premium / currency / etc.
            var matching = rules
                .Where(x => !x.InsuranceCompanyId.HasValue || x.InsuranceCompanyId == carrierId)
                .OrderByDescending(x => Specificity(x))
                .FirstOrDefault();
            if (matching != null)
            {
                try
                {
                    using var doc = JsonDocument.Parse(matching.ValuesJson);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        if (prop.Name.Equals("Currency", StringComparison.OrdinalIgnoreCase))
                        {
                            // We don't have currency on the row; ERGO files are EUR by default. Skip.
                        }
                        else if (prop.Name.Equals("SpecialCommissionPercent", StringComparison.OrdinalIgnoreCase) && r.GrossPremium.HasValue && r.AgencyCommission.HasValue)
                        {
                            var actual = Math.Round(r.AgencyCommission.Value / r.GrossPremium.Value * 100m, 1);
                            var expected = prop.Value.GetDecimal();
                            if (Math.Abs(actual - expected) > 0.5m)
                            {
                                r.Notes.Add(new BridgeImportNote(
                                    "Προμήθεια %",
                                    "info",
                                    $"Προμήθεια γραφείου {actual}% ≠ προεπιλεγμένη {expected}% (ισχύει η τιμή από τη γέφυρα)"));
                                if (status == "Ready") status = "WarnDiff";
                            }
                        }
                    }
                }
                catch { /* ignore malformed rule */ }
            }

            Producer? matchedProducer = null;
            if (!string.IsNullOrEmpty(r.PartnerCode)) producerByCode.TryGetValue(r.PartnerCode, out matchedProducer);
            var producerId = matchedProducer?.Id;
            var producerTier = matchedProducer?.Tier ?? ProducerTier.None;
            var commissionRule = commissionRules
                .Where(rule =>
                    (!rule.ProducerId.HasValue         || rule.ProducerId == producerId) &&
                    (!rule.ProducerTier.HasValue       || rule.ProducerTier == producerTier) &&
                    (!rule.InsuranceCompanyId.HasValue || rule.InsuranceCompanyId == carrierId) &&
                    (!rule.PolicyType.HasValue         || rule.PolicyType == rowPolicyType) &&
                    rule.CoverCode == null &&
                    !rule.VehicleUseCategory.HasValue)
                .OrderByDescending(rule =>
                    (rule.ProducerId.HasValue ? 32 : 0) +
                    (rule.ProducerTier.HasValue ? 16 : 0) +
                    (rule.InsuranceCompanyId.HasValue ? 2 : 0) +
                    (rule.PolicyType.HasValue ? 1 : 0))
                .FirstOrDefault();

            if (commissionRule is not null && r.GrossPremium.HasValue && r.GrossPremium.Value != 0m)
            {
                if (commissionRule.AgencyPercent.HasValue && r.AgencyCommission.HasValue)
                {
                    var bridgeAgencyPct = Math.Round(r.AgencyCommission.Value / r.GrossPremium.Value * 100m, 2);
                    if (Math.Abs(bridgeAgencyPct - commissionRule.AgencyPercent.Value) > 0.5m)
                    {
                        r.Notes.Add(new BridgeImportNote("Προμήθεια γραφείου", "warn",
                            $"Η γέφυρα δίνει {bridgeAgencyPct:0.##}% ενώ η παραμετροποίηση έχει {commissionRule.AgencyPercent.Value:0.##}%. Δεν αλλάζει η γέφυρα· ελέγξτε τη σύμβαση/παραμετροποίηση."));
                        if (status == "Ready") status = "WarnDiff";
                    }
                }

                if (commissionRule.ProducerPercent.HasValue && r.PartnerCommission.HasValue)
                {
                    var expectedProducerAmount = Math.Round(Math.Abs(r.GrossPremium.Value) * commissionRule.ProducerPercent.Value / 100m, 2);
                    if (Math.Abs(Math.Abs(r.PartnerCommission.Value) - expectedProducerAmount) > 0.50m)
                    {
                        r.Notes.Add(new BridgeImportNote("Προμήθεια συνεργάτη", "warn",
                            $"Με βάση την παραμετροποίηση ο συνεργάτης πρέπει να πάρει {expectedProducerAmount:0.00}€. Η γέφυρα δείχνει {Math.Abs(r.PartnerCommission.Value):0.00}€. Ελέγξτε τη σύμβαση ή επικοινωνήστε για επίλυση."));
                        if (status == "Ready") status = "WarnDiff";
                    }
                }
            }

            if (status != r.Status || rowType != r.RowType || linkedId != r.LinkedPolicyId)
                rows[i] = r with { Status = status, RowType = rowType, LinkedPolicyId = linkedId, LinkedPolicyNumber = linkedNumber };
        }
    }

    private static int Specificity(DefaultValueRule x) =>
        (x.InsuranceCompanyId.HasValue ? 1 : 0)
        + (x.PolicyType.HasValue ? 1 : 0)
        + (x.CoverCode != null ? 1 : 0)
        + (x.PackageCode != null ? 1 : 0);

    private static DateOnly? ParseDate(XLCellValue v)
    {
        if (v.IsDateTime) return DateOnly.FromDateTime(v.GetDateTime());
        var s = v.ToString();
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        foreach (var fmt in new[] { "d/M/yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "d/M/yyyy HH:mm", "dd/MM/yyyy HH:mm" })
        {
            if (DateOnly.TryParseExact(s, fmt, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
        }
        return DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var any) ? any : null;
    }

    private static decimal? ParseAmount(XLCellValue v)
    {
        if (v.IsNumber) return (decimal)v.GetNumber();
        var s = v.ToString();
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim().Replace("€", "").Replace(" ", "");
        // ERGO sometimes uses "141,00" — try el-GR then invariant.
        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.GetCultureInfo("el-GR"), out var elg)) return elg;
        if (decimal.TryParse(s.Replace(",", "."), NumberStyles.Any, CultureInfo.InvariantCulture, out var inv)) return inv;
        return null;
    }
}

/* ============================================================================
   COMMIT — write the previewed rows into the DB.
   ========================================================================= */

public record CommitBridgeImportCommand(
    Guid InsuranceCompanyId, string SourceFile,
    IReadOnlyList<BridgeImportRow> Rows) : IRequest<CompanyBridgeRunSummary>;

public record CompanyBridgeRunSummary(
    Guid RunId,
    int RowsCreated,
    int RowsSkipped,
    int RowsFailed,
    int LifecycleRowsApplied,
    int FinancialMovementsCreated,
    int DocumentWarnings);

public class CommitBridgeImportHandler : IRequestHandler<CommitBridgeImportCommand, CompanyBridgeRunSummary>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CommitBridgeImportHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CompanyBridgeRunSummary> Handle(CommitBridgeImportCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.InsuranceCompanyId && c.DeletedAt == null && (c.TenantId == null || c.TenantId == tenantId), ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρία");

        // Ensure a CompanyBridge row exists for this carrier so we can track runs.
        var bridge = await _db.CompanyBridges
            .FirstOrDefaultAsync(b => b.InsuranceCompanyId == carrier.Id, ct);
        if (bridge is null)
        {
            bridge = new CompanyBridge
            {
                Id = Guid.NewGuid(),
                Name = $"{carrier.Name} — auto-bridge",
                InsuranceCompanyId = carrier.Id,
                Kind = CompanyBridgeKind.Manual,
                IsActive = true,
                AutoSync = false,
                Notes = "Created automatically on first xlsx import"
            };
            _db.CompanyBridges.Add(bridge);
        }

        var run = new CompanyBridgeRun
        {
            Id = Guid.NewGuid(),
            BridgeId = bridge.Id,
            StartedAt = DateTime.UtcNow,
            Status = "Running",
            SourceFile = r.SourceFile,
            TriggeredByUserId = _current.UserId,
            RowsTotal = r.Rows.Count
        };
        _db.CompanyBridgeRuns.Add(run);

        var log = new System.Text.StringBuilder();

        // Per-commit caches so the same producer/customer is reused across rows
        // and we don't violate (TenantId, Code) unique indexes by adding twice.
        var producerCache = new Dictionary<string, Producer>(StringComparer.OrdinalIgnoreCase);
        var customerCache = new Dictionary<string, Customer>(StringComparer.OrdinalIgnoreCase);
        // Dedupe (TenantId, PolicyNumber) within the same file — ERGO sometimes
        // emits a second line per policy (e.g. endorsement / pro-rata) under the
        // same policy number, which would otherwise violate the unique index.
        var policyNumbersThisCommit = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static string CustKey(string s) => new string((s ?? "").ToUpperInvariant()
            .Where(c => !char.IsWhiteSpace(c) && char.IsLetterOrDigit(c)).ToArray());

        // Pull once: every existing producer + customer for this tenant, so per-row
        // lookups are local.
        var allProducers = await _db.Producers.IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null).ToListAsync(ct);
        foreach (var p in allProducers) producerCache[p.Code] = p;

        var allCustomers = await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null).ToListAsync(ct);
        foreach (var c in allCustomers)
        {
            var nameForKey = c.CompanyName ?? $"{c.FirstName} {c.LastName}";
            var k = CustKey(nameForKey);
            if (!string.IsNullOrEmpty(k)) customerCache[k] = c;
        }

        var policiesByNumber = (await _db.Policies.IgnoreQueryFilters()
                .Where(p => p.TenantId == tenantId && p.InsuranceCompanyId == carrier.Id && p.DeletedAt == null)
                .ToListAsync(ct))
            .GroupBy(p => p.PolicyNumber, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var policiesById = policiesByNumber.Values.ToDictionary(p => p.Id);
        var affectedPolicies = new Dictionary<Guid, Policy>();
        var lifecycleRowsApplied = 0;
        var financialMovementsCreated = 0;

        var knownEndorsementReferences = (await _db.PolicyEndorsements.IgnoreQueryFilters()
                .Where(e => e.TenantId == tenantId && e.DeletedAt == null && e.CarrierReference != null)
                .Select(e => e.CarrierReference!)
                .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);
        var knownCancellationReferences = (await _db.PolicyCancellations.IgnoreQueryFilters()
                .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.CarrierReference != null)
                .Select(c => c.CarrierReference!)
                .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        static bool IsLifecycle(string rowType) => rowType is "Cancellation" or "Endorsement" or "GreenCard";
        static DateOnly AccountingDate(BridgeImportRow row) =>
            row.IssueDate ?? row.StartDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        static string Marker(string bridgeReference, FinancialMovementKind kind) =>
            $"[bridge:{bridgeReference}:{kind}]";

        var knownFinancialMarkers = (await _db.FinancialMovements.IgnoreQueryFilters()
                .Where(m => m.TenantId == tenantId && m.DeletedAt == null
                    && m.Description != null && m.Description.StartsWith("[bridge:"))
                .Select(m => m.Description!)
                .ToListAsync(ct))
            .Select(description => description[..(description.IndexOf(']') + 1)])
            .ToHashSet(StringComparer.Ordinal);
        var knownReceiptMarkers = (await _db.Receipts.IgnoreQueryFilters()
                .Where(receipt => receipt.TenantId == tenantId && receipt.DeletedAt == null
                    && receipt.Notes != null && receipt.Notes.StartsWith("[bridge:"))
                .Select(receipt => receipt.Notes!)
                .ToListAsync(ct))
            .Select(notes => notes[..(notes.IndexOf(']') + 1)])
            .ToHashSet(StringComparer.Ordinal);

        void AddFinancialMovement(
            Policy policy,
            BridgeImportRow row,
            string bridgeReference,
            FinancialMovementKind kind,
            decimal amount,
            string description,
            Guid? receiptId = null)
        {
            if (amount == 0m) return;
            var marker = Marker(bridgeReference, kind);
            if (!knownFinancialMarkers.Add(marker)) return;

            _db.FinancialMovements.Add(new FinancialMovement
            {
                Id = Guid.NewGuid(),
                MovementDate = AccountingDate(row),
                Kind = kind,
                Amount = amount,
                Currency = policy.Currency,
                PolicyId = policy.Id,
                CustomerId = policy.CustomerId,
                ProducerId = policy.ProducerId,
                InsuranceCompanyId = policy.InsuranceCompanyId,
                ReceiptId = receiptId,
                Description = $"{marker} {description}"
            });
            financialMovementsCreated++;
        }

        void PostBridgeFinancials(Policy policy, BridgeImportRow row, string bridgeReference, bool isCancellation)
        {
            var gross = row.GrossPremium ?? 0m;
            var agencyCommission = row.AgencyCommission ?? 0m;
            if (isCancellation)
            {
                AddFinancialMovement(policy, row, bridgeReference, FinancialMovementKind.Adjustment,
                    -Math.Abs(gross), $"Cancellation from bridge for policy {policy.PolicyNumber}");
                AddFinancialMovement(policy, row, bridgeReference, FinancialMovementKind.CommissionEarned,
                    -Math.Abs(agencyCommission), $"Commission reversal from bridge cancellation {policy.PolicyNumber}");
                return;
            }

            if (gross > 0m)
                AddFinancialMovement(policy, row, bridgeReference, FinancialMovementKind.CustomerCharge,
                    gross, $"Bridge premium charge for policy {policy.PolicyNumber}");
            if (agencyCommission != 0m)
                AddFinancialMovement(policy, row, bridgeReference, FinancialMovementKind.CommissionEarned,
                    agencyCommission, $"Bridge agency commission for policy {policy.PolicyNumber}");

            var paymentSignal = string.Join(" ", row.Raw.Select(x => $"{x.Key} {x.Value}")).ToUpperInvariant();
            var isExplicitlyPaid = paymentSignal.Contains("PAID") || paymentSignal.Contains("SETTLED")
                || paymentSignal.Contains("ΕΞΟΦΛ") || paymentSignal.Contains("ΠΛΗΡΩ");
            if (!isExplicitlyPaid || gross <= 0m) return;

            var receiptMarker = Marker(bridgeReference, FinancialMovementKind.CustomerCredit);
            Guid? receiptId = null;
            if (knownReceiptMarkers.Add(receiptMarker))
            {
                var receipt = new Receipt
                {
                    Id = Guid.NewGuid(),
                    Number = $"BRG-{bridgeReference[^8..]}",
                    ReceivedOn = AccountingDate(row),
                    CustomerId = policy.CustomerId,
                    PolicyId = policy.Id,
                    Method = PaymentMethod.Other,
                    Amount = gross,
                    Currency = policy.Currency,
                    Notes = $"{receiptMarker} Paid according to bridge source.",
                    RecordedByUserId = _current.UserId
                };
                _db.Receipts.Add(receipt);
                receiptId = receipt.Id;
            }
            AddFinancialMovement(policy, row, bridgeReference, FinancialMovementKind.CustomerCredit,
                gross, $"Bridge payment for policy {policy.PolicyNumber}", receiptId);
        }

        foreach (var row in r.Rows)
        {
            try
            {
                if (row.Status == "Error" || row.Status == "Duplicate")
                {
                    run.RowsSkipped++;
                    log.AppendLine($"row {row.Index}: skipped ({row.Status})");
                    continue;
                }
                // Unlinked renewals are NOT importable — the user must either link them
                // to the prior policy or manually create it before commit.
                if (row.RowType == "Renewal" && !row.LinkedPolicyId.HasValue)
                {
                    run.RowsSkipped++;
                    log.AppendLine($"row {row.Index}: skipped (renewal without linked prior policy)");
                    continue;
                }
                if (string.IsNullOrWhiteSpace(row.PolicyNumber) || string.IsNullOrWhiteSpace(row.CustomerName))
                {
                    run.RowsSkipped++;
                    log.AppendLine($"row {row.Index}: skipped (missing policy number or customer name)");
                    continue;
                }

                var bridgeReference = BuildBridgeReference(carrier.Id, row);
                if (IsLifecycle(row.RowType))
                {
                    Policy? parentPolicy = null;
                    if (row.LinkedPolicyId.HasValue && policiesById.TryGetValue(row.LinkedPolicyId.Value, out var linkedPolicy))
                        parentPolicy = linkedPolicy;
                    else if (policiesByNumber.TryGetValue(row.PolicyNumber!, out var sameNumberPolicy))
                        parentPolicy = sameNumberPolicy;

                    if (parentPolicy is null)
                    {
                        run.RowsSkipped++;
                        log.AppendLine($"row {row.Index}: skipped (no parent policy for {row.RowType})");
                        continue;
                    }

                    if (row.RowType == "Cancellation")
                    {
                        if (!knownCancellationReferences.Add(bridgeReference))
                        {
                            run.RowsSkipped++;
                            log.AppendLine($"row {row.Index}: skipped (cancellation already imported)");
                            continue;
                        }

                        var accountingDate = AccountingDate(row);
                        var refund = Math.Abs(row.GrossPremium ?? 0m);
                        var cancellation = new PolicyCancellation
                        {
                            Id = Guid.NewGuid(),
                            PolicyId = parentPolicy.Id,
                            CancellationNumber = $"AK-{accountingDate.Year}-BRG-{bridgeReference[^8..]}",
                            Status = PolicyCancellationStatus.Effective,
                            ReasonText = "Automatic carrier bridge cancellation.",
                            RequestedAt = accountingDate,
                            EffectiveFrom = row.StartDate ?? accountingDate,
                            RefundMethod = "Custom",
                            RefundAmount = refund,
                            CommissionClawback = row.AgencyCommission.HasValue ? Math.Abs(row.AgencyCommission.Value) : null,
                            Currency = parentPolicy.Currency,
                            CarrierReference = bridgeReference,
                            Notes = "Imported automatically from carrier bridge.",
                            CreatedByUserId = _current.UserId,
                            ApprovedByUserId = _current.UserId,
                            ApprovedAt = DateTime.UtcNow
                        };
                        _db.PolicyCancellations.Add(cancellation);
                        parentPolicy.Status = PolicyStatus.Cancelled;

                        if (refund > 0m)
                        {
                            var creditNote = new CreditNote
                            {
                                Id = Guid.NewGuid(),
                                CreditNoteNumber = $"PI-{accountingDate.Year}-BRG-{bridgeReference[^8..]}",
                                Kind = CreditNoteKind.CancellationRefund,
                                Status = CreditNoteStatus.Issued,
                                IssuedAt = accountingDate,
                                CustomerId = parentPolicy.CustomerId,
                                PolicyId = parentPolicy.Id,
                                Amount = refund,
                                Currency = parentPolicy.Currency,
                                Description = $"Carrier bridge cancellation refund {cancellation.CancellationNumber}",
                                RelatedDocumentRef = cancellation.CancellationNumber,
                                CreatedByUserId = _current.UserId
                            };
                            _db.CreditNotes.Add(creditNote);
                            cancellation.CreditNoteId = creditNote.Id;
                        }
                        PostBridgeFinancials(parentPolicy, row, bridgeReference, isCancellation: true);
                    }
                    else
                    {
                        if (!knownEndorsementReferences.Add(bridgeReference))
                        {
                            run.RowsSkipped++;
                            log.AppendLine($"row {row.Index}: skipped ({row.RowType} already imported)");
                            continue;
                        }

                        var issuedAt = AccountingDate(row);
                        var premiumDelta = row.GrossPremium ?? 0m;
                        _db.PolicyEndorsements.Add(new PolicyEndorsement
                        {
                            Id = Guid.NewGuid(),
                            PolicyId = parentPolicy.Id,
                            EndorsementNumber = $"PP-{issuedAt.Year}-BRG-{bridgeReference[^8..]}",
                            Type = row.RowType == "GreenCard" ? EndorsementType.AddCoverage : EndorsementType.PremiumAdjustment,
                            Status = EndorsementStatus.Issued,
                            IssuedAt = issuedAt,
                            EffectiveFrom = row.StartDate ?? issuedAt,
                            EffectiveTo = row.EndDate,
                            Description = row.RowType == "GreenCard"
                                ? "Green card imported from carrier bridge"
                                : "Endorsement imported from carrier bridge",
                            CarrierReference = bridgeReference,
                            PremiumDelta = premiumDelta,
                            CommissionDelta = row.AgencyCommission ?? 0m,
                            Currency = parentPolicy.Currency,
                            ChangesJson = JsonSerializer.Serialize(new { source = "carrier-bridge", rowType = row.RowType, row.Index }),
                            Notes = "Imported automatically from carrier bridge.",
                            CreatedByUserId = _current.UserId
                        });
                        parentPolicy.Premium = Math.Max(0m, parentPolicy.Premium + premiumDelta);
                        PostBridgeFinancials(parentPolicy, row, bridgeReference, isCancellation: false);
                    }

                    affectedPolicies[parentPolicy.Id] = parentPolicy;
                    run.RowsCreated++;
                    lifecycleRowsApplied++;
                    log.AppendLine($"row {row.Index}: {row.RowType} attached to {parentPolicy.PolicyNumber}");
                    continue;
                }

                if (!policyNumbersThisCommit.Add(row.PolicyNumber!))
                {
                    run.RowsSkipped++;
                    log.AppendLine($"row {row.Index}: skipped (policy {row.PolicyNumber} already added earlier in this file)");
                    continue;
                }

                // ERGO files don't ship AFM, so we match the customer by normalized name
                // (uppercase, whitespace-free). Reuse the per-commit cache so the same
                // customer isn't inserted multiple times for repeating rows.
                var rawName = row.CustomerName!.Trim();
                var nameKey = CustKey(rawName);
                if (!customerCache.TryGetValue(nameKey, out var customerEntity))
                {
                    var looksCompany = rawName.Contains("ΕΠΕ") || rawName.Contains("ΑΕ") || rawName.Contains("ΟΕ")
                                       || rawName.Contains("Α.Ε") || rawName.Contains("Α.Ε.")
                                       || rawName.Contains("ΕΤΑΙΡ", StringComparison.OrdinalIgnoreCase);
                    var parts = rawName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    customerEntity = new Customer
                    {
                        Id = Guid.NewGuid(),
                        CustomerNumber = $"IMP-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                        Type = looksCompany ? CustomerType.Company : CustomerType.Individual,
                        CompanyName = looksCompany ? rawName : null,
                        FirstName = !looksCompany && parts.Length >= 1 ? parts[0] : null,
                        LastName  = !looksCompany && parts.Length >= 2 ? string.Join(' ', parts.Skip(1)) : null,
                        VatNumber = row.CustomerVat
                    };
                    _db.Customers.Add(customerEntity);
                    customerCache[nameKey] = customerEntity;
                }

                // Auto-create producer if the bridge references a code we don't have.
                // Cache hits avoid (TenantId, Code) unique-index violations on bulk imports.
                Guid? producerId = null;
                if (!string.IsNullOrEmpty(row.PartnerCode))
                {
                    if (!producerCache.TryGetValue(row.PartnerCode, out var producer))
                    {
                        producer = new Producer
                        {
                            Id = Guid.NewGuid(),
                            Code = row.PartnerCode,
                            Name = $"Auto-imported {row.PartnerCode}",
                            Status = ProducerStatus.Active
                        };
                        _db.Producers.Add(producer);
                        producerCache[row.PartnerCode] = producer;
                        log.AppendLine($"row {row.Index}: auto-created producer {row.PartnerCode}");
                    }
                    producerId = producer.Id;
                }

                // Determine the policy status from the imported row type.
                var policyStatus = row.RowType switch
                {
                    "Cancellation" => PolicyStatus.Cancelled,
                    "Renewal"      => PolicyStatus.Active,
                    "Endorsement"  => PolicyStatus.Active,
                    _              => PolicyStatus.Active
                };

                var policy = new Policy
                {
                    Id = Guid.NewGuid(),
                    PolicyNumber = row.PolicyNumber!,
                    CustomerId = customerEntity.Id,
                    InsuranceCompanyId = carrier.Id,
                    ProducerId = producerId,
                    PolicyType = !string.IsNullOrEmpty(row.PlateNumber) ? PolicyType.Auto : PolicyType.Other,
                    Status = policyStatus,
                    StartDate = row.StartDate ?? DateOnly.FromDateTime(DateTime.Today),
                    EndDate = row.EndDate ?? (row.StartDate ?? DateOnly.FromDateTime(DateTime.Today)).AddYears(1),
                    Premium = Math.Abs(row.GrossPremium ?? 0m),
                    Currency = "EUR",
                    RenewedFromPolicyId = row.LinkedPolicyId,
                    SpecsJson = !string.IsNullOrEmpty(row.PlateNumber) || !string.IsNullOrEmpty(row.ProposalNumber)
                        ? System.Text.Json.JsonSerializer.Serialize(new {
                            plate = row.PlateNumber,
                            proposal = row.ProposalNumber,
                            importedFrom = "ERGO-xlsx",
                            bridgeReference
                          })
                        : null,
                    CreatedByUserId = _current.UserId
                };
                _db.Policies.Add(policy);
                policiesByNumber[policy.PolicyNumber] = policy;
                policiesById[policy.Id] = policy;
                affectedPolicies[policy.Id] = policy;
                PostBridgeFinancials(policy, row, bridgeReference, isCancellation: false);
                run.RowsCreated++;
                log.AppendLine($"row {row.Index}: {row.PolicyNumber} created as {row.RowType}"
                    + (row.LinkedPolicyId.HasValue ? $" linked to {row.LinkedPolicyNumber}" : ""));
            }
            catch (Exception ex)
            {
                run.RowsFailed++;
                log.AppendLine($"row {row.Index}: ERROR {ex.Message}");
            }
        }

        var affectedPolicyIds = affectedPolicies.Keys.ToList();
        var policiesWithDocuments = affectedPolicyIds.Count == 0
            ? new HashSet<Guid>()
            : (await _db.PolicyDocuments.IgnoreQueryFilters()
                .Where(d => d.TenantId == tenantId && d.DeletedAt == null && affectedPolicyIds.Contains(d.PolicyId))
                .Select(d => d.PolicyId)
                .Distinct()
                .ToListAsync(ct)).ToHashSet();
        var policiesNeedingDocuments = affectedPolicies.Values
            .Where(policy => !policiesWithDocuments.Contains(policy.Id))
            .ToList();
        var notificationRecipients = await _db.Users.IgnoreQueryFilters()
            .Where(user => user.TenantId == tenantId && user.DeletedAt == null && user.IsActive
                && (user.Role == Role.AgencyAdmin || user.Role == Role.AgencyUser))
            .Select(user => user.Id)
            .ToListAsync(ct);
        var warningLinks = policiesNeedingDocuments
            .Select(policy => $"/app/policies?documentPolicyId={policy.Id}")
            .ToList();
        var existingWarnings = warningLinks.Count == 0
            ? new HashSet<string>()
            : (await _db.Notifications.IgnoreQueryFilters()
                .Where(notification => notification.TenantId == tenantId
                    && notification.Category == "document-required"
                    && notification.Link != null
                    && warningLinks.Contains(notification.Link))
                .Select(notification => $"{notification.UserId}|{notification.Link}")
                .ToListAsync(ct)).ToHashSet();

        foreach (var policy in policiesNeedingDocuments)
        {
            var link = $"/app/policies?documentPolicyId={policy.Id}";
            foreach (var userId in notificationRecipients)
            {
                if (!existingWarnings.Add($"{userId}|{link}")) continue;
                _db.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Title = "Policy document required",
                    Body = $"Policy {policy.PolicyNumber} or one of its lifecycle movements came from a carrier bridge without an attached file. Upload the policy PDF or the relevant document in the policy card.",
                    Category = "document-required",
                    Link = link
                });
            }
        }

        run.Status = run.RowsFailed > 0 && run.RowsCreated == 0 ? "Failed" : "Completed";
        run.CompletedAt = DateTime.UtcNow;
        run.ResultJson = log.ToString();

        bridge.LastSyncAt = run.CompletedAt;
        bridge.LastSyncRows = run.RowsCreated;
        bridge.LastSyncStatus = run.Status;

        await _db.SaveChangesAsync(ct);
        return new CompanyBridgeRunSummary(
            run.Id,
            run.RowsCreated,
            run.RowsSkipped,
            run.RowsFailed,
            lifecycleRowsApplied,
            financialMovementsCreated,
            policiesNeedingDocuments.Count);
    }

    private static string BuildBridgeReference(Guid carrierId, BridgeImportRow row)
    {
        var payload = string.Join("|", new[]
        {
            carrierId.ToString("N"), row.PolicyNumber, row.RowType,
            row.IssueDate?.ToString("yyyy-MM-dd"), row.StartDate?.ToString("yyyy-MM-dd"), row.EndDate?.ToString("yyyy-MM-dd"),
            row.GrossPremium?.ToString("0.00", CultureInfo.InvariantCulture),
            row.NetPremium?.ToString("0.00", CultureInfo.InvariantCulture),
            row.PartnerCommission?.ToString("0.00", CultureInfo.InvariantCulture),
            row.AgencyCommission?.ToString("0.00", CultureInfo.InvariantCulture),
            row.ProposalNumber, row.PlateNumber
        });
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(payload));
        return $"BRG-{Convert.ToHexString(bytes)[..16]}";
    }
}
