using Kalypsis.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Storage;

/// <summary>
/// Magic-byte sniffing + extension/MIME allowlist. Detects renamed executables
/// and refuses anything outside the allowlist. Does NOT do antivirus scanning
/// (Coolify-deployed Kalypsis has no AV daemon) but closes the most common
/// "I uploaded malware.exe disguised as report.pdf" hole.
/// </summary>
public sealed class FileSafetyService : IFileSafetyService
{
    private readonly ILogger<FileSafetyService> _logger;
    public FileSafetyService(ILogger<FileSafetyService> logger) { _logger = logger; }

    // Magic-byte signatures we recognise. Keep small and surgical — we don't try
    // to identify every format on earth, just the few we actually accept.
    private static readonly (byte[] Magic, string Mime)[] Signatures =
    {
        (new byte[] { 0x25, 0x50, 0x44, 0x46 },                         "application/pdf"),                 // %PDF
        (new byte[] { 0x89, 0x50, 0x4E, 0x47 },                         "image/png"),                       // PNG
        (new byte[] { 0xFF, 0xD8, 0xFF },                               "image/jpeg"),                      // JPEG
        (new byte[] { 0x47, 0x49, 0x46, 0x38 },                         "image/gif"),                       // GIF
        (new byte[] { 0x52, 0x49, 0x46, 0x46 },                         "image/webp"),                      // RIFF (also covers WAV — fine, we won't accept it)
        (new byte[] { 0x50, 0x4B, 0x03, 0x04 },                         "application/zip"),                 // ZIP (xlsx/docx/odt all start here)
        (new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 }, "application/vnd.ms-office"),       // Old OLE compound (doc/xls/ppt)
    };

    // Magic-byte signatures we want to BLOCK even if the extension claims otherwise.
    private static readonly (byte[] Magic, string Name)[] Blocklist =
    {
        (new byte[] { 0x4D, 0x5A }, "Windows PE (.exe/.dll)"),
        (new byte[] { 0x7F, 0x45, 0x4C, 0x46 }, "Linux ELF"),
        (new byte[] { 0xCA, 0xFE, 0xBA, 0xBE }, "Mach-O / Java class"),
        (new byte[] { 0xFE, 0xED, 0xFA, 0xCE }, "Mach-O 32"),
        (new byte[] { 0xFE, 0xED, 0xFA, 0xCF }, "Mach-O 64"),
        (new byte[] { 0x23, 0x21 },             "Shell script (#!)"),
    };

    private static readonly HashSet<string> DocumentExts = new(StringComparer.OrdinalIgnoreCase)
    { ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".docx", ".doc", ".odt", ".rtf", ".txt" };
    private static readonly HashSet<string> ImageExts = new(StringComparer.OrdinalIgnoreCase)
    { ".png", ".jpg", ".jpeg", ".gif", ".webp" };
    private static readonly HashSet<string> SpreadsheetExts = new(StringComparer.OrdinalIgnoreCase)
    { ".xlsx", ".xls", ".csv", ".ods", ".txt" };

    public async Task<FileSafetyResult> InspectAsync(
        string fileName, string? declaredContentType, Stream content, FileUploadKind kind, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return new FileSafetyResult(false, "name_empty", "Το αρχείο δεν έχει όνομα.");

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var allowedExts = kind switch
        {
            FileUploadKind.Image       => ImageExts,
            FileUploadKind.Spreadsheet => SpreadsheetExts,
            _                          => DocumentExts
        };
        if (!allowedExts.Contains(ext))
            return new FileSafetyResult(false, "ext_not_allowed",
                $"Η επέκταση «{ext}» δεν επιτρέπεται για αυτόν τον τύπο μεταφόρτωσης.");

        // Read first 16 bytes for sniffing, then rewind for the caller.
        if (!content.CanSeek)
            return new FileSafetyResult(false, "stream_not_seekable", "Η μεταφόρτωση δεν είναι έγκυρη.");
        var buffer = new byte[16];
        var bytesRead = await content.ReadAsync(buffer.AsMemory(0, buffer.Length), ct);
        content.Position = 0;

        // 1) Hard blocklist — even if extension is whitelisted, refuse known-bad headers.
        foreach (var (magic, name) in Blocklist)
        {
            if (bytesRead >= magic.Length && StartsWith(buffer, magic))
            {
                _logger.LogWarning("Rejected upload {File} — magic header matched blocklist entry {Name}", fileName, name);
                return new FileSafetyResult(false, "blocked_signature",
                    $"Το περιεχόμενο φαίνεται να είναι εκτελέσιμο ({name}).");
            }
        }

        // 2) Magic must match one of our known signatures (txt/csv have no magic — allowed
        //    when extension is .txt or .csv since the content is plain).
        string? detected = null;
        foreach (var (magic, mime) in Signatures)
        {
            if (bytesRead >= magic.Length && StartsWith(buffer, magic)) { detected = mime; break; }
        }

        if (detected is null && ext is not ".csv" and not ".txt")
        {
            return new FileSafetyResult(false, "unknown_signature",
                "Το περιεχόμενο δεν αντιστοιχεί σε αναγνωρισμένο τύπο αρχείου.");
        }

        // 3) Sanity-check declared content-type isn't wildly off. Office docs come in as
        //    application/zip at the magic-byte level so we accept zip→office aliasing.
        if (!string.IsNullOrWhiteSpace(declaredContentType) && detected is not null)
        {
            var dt = detected;
            if (dt == "application/zip" && declaredContentType.Contains("openxmlformats", StringComparison.OrdinalIgnoreCase))
            {
                // Office .docx/.xlsx — fine.
            }
            else if (dt == "application/vnd.ms-office" && (declaredContentType.Contains("msword") || declaredContentType.Contains("ms-excel")))
            {
                // Legacy office — fine.
            }
            else if (!declaredContentType.Contains(dt.Split('/').Last(), StringComparison.OrdinalIgnoreCase)
                     && !dt.Contains(declaredContentType.Split('/').Last(), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Upload {File}: declared {Declared} but detected {Detected}", fileName, declaredContentType, dt);
                // Not a hard fail — content-types lie a lot — but the magic-byte allowlist
                // already gates this, so we just record and continue.
            }
        }

        return new FileSafetyResult(true, DetectedContentType: detected ?? declaredContentType);
    }

    private static bool StartsWith(byte[] buffer, byte[] prefix)
    {
        for (int i = 0; i < prefix.Length; i++)
            if (buffer[i] != prefix[i]) return false;
        return true;
    }
}
