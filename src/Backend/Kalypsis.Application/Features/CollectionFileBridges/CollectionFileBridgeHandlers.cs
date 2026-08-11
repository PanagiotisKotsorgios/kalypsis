using System.Globalization;
using System.Text;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.CollectionFileBridges;

// ============================================================================
// Ατλαντική Ένωση — Αρχείο εισπράξεων (Filcoldt.txt)
//
// The carrier ships collections as a zipped folder named
// «Collect_YYYYMMDDhhmmss.zip» containing a single fixed-width text file
// «Filcoldt.txt» in ISO-8859-7 (Greek Windows-1253) with CRLF terminators.
//
// One line = one receipt. Whitespace-separated columns (verified against
// sample dumps):
//   1  Branch code (2 = motor, 3 = fire, 14 = life, …)
//   2  Customer / party number
//   3  Policy number
//   4  Year
//   5  Instalment / period
//   6  Receipt / παραστατικό number
//   7  Reserved (usually 0)
//   8  Reserved (usually 0)
//   9  Received-on date YYYYMMDD
//  10  Amount (comma decimal, e.g. "56,50")
//  11  Method code + text prefix (e.g. "0ΠΛ")
//  12  Reserved
//
// We are conservative: the commit path only writes rows whose PolicyNumber
// matches a live Policy in the tenant. Unmatched rows surface as warnings
// in the preview; the operator can fix and re-upload.
// ============================================================================

/// <summary>One parsed row from a collection-file. Zero DB writes at preview time.</summary>
public record CollectionFileRow(
    int Index,
    string RawLine,
    string? BranchCode,
    string? PartyNumber,
    string? PolicyNumber,
    int? Year,
    int? Instalment,
    string? ReceiptNumber,
    DateOnly? ReceivedOn,
    decimal? Amount,
    string? MethodCode,
    // Populated at preview time by matching against the DB.
    Guid? MatchedPolicyId,
    string? MatchedPolicyCustomerName,
    // "Ready" / "Unmatched" / "Duplicate" / "Error"
    string Status,
    string? Note);

public record CollectionFilePreviewDto(
    string CarrierName,
    int RowCount,
    int ReadyCount,
    int UnmatchedCount,
    int DuplicateCount,
    int ErrorCount,
    decimal TotalAmount,
    IReadOnlyList<CollectionFileRow> Rows);

// ---------------------------------------------------------------------------
// Preview command — parses the file, matches to policies, does NOT write.
// ---------------------------------------------------------------------------
public record PreviewCollectionFileCommand(
    Guid InsuranceCompanyId,
    string FileName,
    byte[] FileContent) : IRequest<CollectionFilePreviewDto>;

public class PreviewCollectionFileHandler : IRequestHandler<PreviewCollectionFileCommand, CollectionFilePreviewDto>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public PreviewCollectionFileHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CollectionFilePreviewDto> Handle(PreviewCollectionFileCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.InsuranceCompanyId && c.DeletedAt == null
                && (c.TenantId == null || c.TenantId == tenantId), ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρία");

        var carrierKey = (carrier.Code + " " + carrier.Name).ToUpperInvariant();
        var isAtlantic = carrierKey.Contains("ATLANTIC") || carrierKey.Contains("ATLANTIKI")
            || carrierKey.Contains("ΑΤΛΑΝΤΙΚΗ");
        if (!isAtlantic)
            throw new AppException("collection_bridge_not_supported",
                "Η γέφυρα αρχείων εισπράξεων υποστηρίζει μόνο Ατλαντική Ένωση προς το παρόν.", 400);

        var rows = ParseAtlanticCollectionFile(r.FileContent);

        // Match to policies (only ones from THIS carrier so we don't cross-post
        // an Atlantic receipt onto a same-numbered policy from another carrier).
        var policyNumbers = rows.Where(x => !string.IsNullOrEmpty(x.PolicyNumber))
            .Select(x => x.PolicyNumber!).Distinct().ToList();
        var matches = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId
                     && p.InsuranceCompanyId == carrier.Id
                     && p.DeletedAt == null
                     && policyNumbers.Contains(p.PolicyNumber))
            .Join(_db.Customers.IgnoreQueryFilters(), p => p.CustomerId, c => c.Id,
                (p, c) => new {
                    p.Id, p.PolicyNumber,
                    Name = c.CompanyName ?? ((c.FirstName ?? "") + " " + (c.LastName ?? "")).Trim()
                })
            .ToListAsync(ct);
        var matchDict = matches.GroupBy(x => x.PolicyNumber, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => (g.First().Id, g.First().Name),
                StringComparer.OrdinalIgnoreCase);

        // Existing receipts with matching (Amount, ReceivedOn, TransactionReference) so
        // re-uploading the same monthly file doesn't create duplicate credits.
        var existingRefs = (await _db.Receipts.IgnoreQueryFilters()
            .Where(rc => rc.TenantId == tenantId && rc.DeletedAt == null
                && rc.TransactionReference != null
                && rc.TransactionReference.StartsWith("ATLANT-"))
            .Select(rc => rc.TransactionReference!)
            .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        var enriched = new List<CollectionFileRow>(rows.Count);
        foreach (var row in rows)
        {
            string status = "Ready";
            string? note = null;
            Guid? matchedId = null;
            string? matchedName = null;

            if (row.Amount is null || row.ReceivedOn is null || string.IsNullOrEmpty(row.PolicyNumber))
            {
                status = "Error";
                note = "Λείπουν βασικά πεδία (ασφαλιστήριο / ημ/νία / ποσό).";
            }
            else if (!matchDict.TryGetValue(row.PolicyNumber!, out var m))
            {
                status = "Unmatched";
                note = $"Το ασφαλιστήριο {row.PolicyNumber} δεν βρέθηκε στη γέφυρα «{carrier.Name}».";
            }
            else
            {
                matchedId = m.Id;
                matchedName = m.Name;
                var reference = BuildReference(row);
                if (existingRefs.Contains(reference))
                {
                    status = "Duplicate";
                    note = "Η ίδια είσπραξη έχει ήδη καταχωρηθεί σε προηγούμενη εισαγωγή.";
                }
            }

            enriched.Add(row with
            {
                MatchedPolicyId = matchedId,
                MatchedPolicyCustomerName = matchedName,
                Status = status,
                Note = note ?? row.Note
            });
        }

        var readyCount = enriched.Count(x => x.Status == "Ready");
        var unmatchedCount = enriched.Count(x => x.Status == "Unmatched");
        var duplicateCount = enriched.Count(x => x.Status == "Duplicate");
        var errorCount = enriched.Count(x => x.Status == "Error");
        var total = enriched.Where(x => x.Status == "Ready" && x.Amount.HasValue).Sum(x => x.Amount!.Value);

        return new CollectionFilePreviewDto(
            carrier.Name, enriched.Count,
            readyCount, unmatchedCount, duplicateCount, errorCount,
            total, enriched);
    }

    internal static string BuildReference(CollectionFileRow row) =>
        $"ATLANT-{row.ReceivedOn?.ToString("yyyyMMdd")}-{row.PolicyNumber}-{row.ReceiptNumber}-{row.Amount?.ToString("0.00", CultureInfo.InvariantCulture)}";

    /// <summary>
    /// Parse the Ατλαντική Filcoldt.txt (or a Collect_YYYYMMDDhhmmss.zip
    /// containing it). CP1253 encoding; whitespace-separated fixed columns.
    /// </summary>
    internal static List<CollectionFileRow> ParseAtlanticCollectionFile(byte[] content)
    {
        // Autodetect zip vs raw txt via PK magic.
        var isZip = content.Length >= 4 && content[0] == 0x50 && content[1] == 0x4B
            && (content[2] == 0x03 || content[2] == 0x05 || content[2] == 0x07);

        byte[] textBytes;
        if (isZip)
        {
            using var ms = new MemoryStream(content);
            using var zip = new System.IO.Compression.ZipArchive(ms, System.IO.Compression.ZipArchiveMode.Read);
            var entry = zip.Entries.FirstOrDefault(e => e.Name.Equals("Filcoldt.txt", StringComparison.OrdinalIgnoreCase))
                ?? throw new AppException("collection_missing_filcoldt",
                    "Το ZIP δεν περιέχει αρχείο Filcoldt.txt.", 400);
            using var es = entry.Open();
            using var mm = new MemoryStream();
            es.CopyTo(mm);
            textBytes = mm.ToArray();
        }
        else
        {
            textBytes = content;
        }

        // CP1253 = Windows Greek (code page 1253).
        Encoding enc;
        try { enc = Encoding.GetEncoding(1253); }
        catch { enc = Encoding.UTF8; }
        var text = enc.GetString(textBytes);
        var lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        var rows = new List<CollectionFileRow>(lines.Length);
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i];
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed)) continue;

            // Whitespace-split — fixed-width means the same field always
            // lands in the same slot even when digit lengths vary. Robust
            // against changes in padding widths across Atlantiki releases.
            var tokens = trimmed.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length < 10)
            {
                rows.Add(new CollectionFileRow(i + 1, line,
                    null, null, null, null, null, null, null, null, null,
                    null, null, "Error", "Ανεπαρκείς στήλες στη γραμμή."));
                continue;
            }

            string branch = tokens[0];
            string party = tokens[1];
            string policyNo = tokens[2];
            int? year = int.TryParse(tokens[3], out var y) ? y : (int?)null;
            int? instalment = int.TryParse(tokens[4], out var inst) ? inst : (int?)null;
            string receiptNo = tokens[5];
            // tokens[6], tokens[7] are usually zero-fillers
            string dateStr = tokens[8];
            string amountStr = tokens[9];
            string method = tokens.Length > 10 ? tokens[10] : "";

            DateOnly? receivedOn = null;
            if (dateStr.Length == 8 && int.TryParse(dateStr[..4], out var yy)
                && int.TryParse(dateStr.Substring(4, 2), out var mm)
                && int.TryParse(dateStr.Substring(6, 2), out var dd))
            {
                try { receivedOn = new DateOnly(yy, mm, dd); }
                catch { }
            }

            decimal? amount = decimal.TryParse(amountStr.Replace(',', '.'),
                NumberStyles.Number, CultureInfo.InvariantCulture, out var amt) ? amt : (decimal?)null;

            rows.Add(new CollectionFileRow(i + 1, line,
                branch, party, policyNo, year, instalment, receiptNo,
                receivedOn, amount, method,
                null, null, "Ready", null));
        }
        return rows;
    }
}

// ---------------------------------------------------------------------------
// Commit — creates Receipt rows for the Ready lines the operator confirmed.
// ---------------------------------------------------------------------------
public record CommitCollectionFileCommand(
    Guid InsuranceCompanyId,
    string FileName,
    IReadOnlyList<CollectionFileRow> Rows) : IRequest<CollectionFileCommitResult>;

public record CollectionFileCommitResult(int Created, int Skipped, int Failed, decimal TotalAmount);

public class CommitCollectionFileHandler : IRequestHandler<CommitCollectionFileCommand, CollectionFileCommitResult>
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _current;
    public CommitCollectionFileHandler(IAppDbContext db, ICurrentUser current) { _db = db; _current = current; }

    public async Task<CollectionFileCommitResult> Handle(CommitCollectionFileCommand r, CancellationToken ct)
    {
        var tenantId = _current.TenantId ?? throw AppException.Forbidden();
        var carrier = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == r.InsuranceCompanyId && c.DeletedAt == null
                && (c.TenantId == null || c.TenantId == tenantId), ct)
            ?? throw AppException.NotFound("Ασφαλιστική εταιρία");

        // Dedup guard: skip anything already imported (rowset re-committed).
        var existingRefs = (await _db.Receipts.IgnoreQueryFilters()
            .Where(rc => rc.TenantId == tenantId && rc.DeletedAt == null
                && rc.TransactionReference != null
                && rc.TransactionReference.StartsWith("ATLANT-"))
            .Select(rc => rc.TransactionReference!)
            .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);

        // Load the customer id per matched policy — we need it to attach the
        // receipt without extra round-trips.
        var policyIds = r.Rows.Where(x => x.MatchedPolicyId.HasValue)
            .Select(x => x.MatchedPolicyId!.Value).Distinct().ToList();
        var policyMap = await _db.Policies.IgnoreQueryFilters()
            .Where(p => p.TenantId == tenantId && policyIds.Contains(p.Id))
            .Select(p => new { p.Id, p.CustomerId, p.Currency })
            .ToDictionaryAsync(x => x.Id, ct);

        int created = 0, skipped = 0, failed = 0;
        decimal total = 0m;

        foreach (var row in r.Rows)
        {
            if (row.Status != "Ready" || !row.MatchedPolicyId.HasValue
                || !row.Amount.HasValue || !row.ReceivedOn.HasValue)
            {
                skipped++;
                continue;
            }
            if (!policyMap.TryGetValue(row.MatchedPolicyId.Value, out var pol))
            {
                skipped++;
                continue;
            }

            var reference = PreviewCollectionFileHandler.BuildReference(row);
            if (!existingRefs.Add(reference))
            {
                skipped++;
                continue;
            }

            try
            {
                _db.Receipts.Add(new Receipt
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Number = string.IsNullOrEmpty(row.ReceiptNumber)
                        ? $"ATL-{row.ReceivedOn:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}"
                        : $"ATL-{row.ReceiptNumber}",
                    ReceivedOn = row.ReceivedOn.Value,
                    CustomerId = pol.CustomerId,
                    PolicyId = row.MatchedPolicyId,
                    Amount = row.Amount.Value,
                    Currency = pol.Currency ?? "EUR",
                    Method = InferMethod(row.MethodCode),
                    Notes = $"Αυτόματη εισαγωγή από αρχείο εισπράξεων Ατλαντικής ({r.FileName}).",
                    TransactionReference = reference,
                    RecordedByUserId = _current.UserId
                });
                created++;
                total += row.Amount.Value;
            }
            catch
            {
                failed++;
            }
        }

        if (created > 0)
            await _db.SaveChangesAsync(ct);

        return new CollectionFileCommitResult(created, skipped, failed, total);
    }

    private static PaymentMethod InferMethod(string? code)
    {
        if (string.IsNullOrEmpty(code)) return PaymentMethod.BankTransfer;
        var upper = code.ToUpperInvariant();
        if (upper.Contains("ΠΛ")) return PaymentMethod.BankTransfer; // Πληρωμή τραπέζης — safe default
        if (upper.Contains("ΜΤ")) return PaymentMethod.Cash;
        if (upper.Contains("ΚΑΡ") || upper.Contains("POS")) return PaymentMethod.Card;
        if (upper.Contains("ΕΠ")) return PaymentMethod.Cheque;
        return PaymentMethod.Other;
    }
}
