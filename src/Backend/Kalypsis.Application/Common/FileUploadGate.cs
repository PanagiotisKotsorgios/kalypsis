using Kalypsis.Application.Abstractions;

namespace Kalypsis.Application.Common;

/// <summary>
/// Convenience facade so every upload handler runs the SAME safety pipeline:
///   1) Size cap per kind
///   2) Magic-byte + extension allowlist (IFileSafetyService)
///   3) Antivirus scan (IAntivirusScanner — no-op until ClamAV is wired)
///
/// Throws AppException on any rejection so callers don't have to compose the
/// same three error paths over and over.
/// </summary>
public sealed class FileUploadGate
{
    private readonly IFileSafetyService _safety;
    private readonly IAntivirusScanner _av;

    public FileUploadGate(IFileSafetyService safety, IAntivirusScanner av)
    {
        _safety = safety;
        _av = av;
    }

    /// <summary>
    /// Runs all safety checks. Returns the detected/declared content-type the
    /// caller should persist (instead of trusting the client-supplied one).
    /// </summary>
    public async Task<string> InspectAsync(
        string fileName,
        string? declaredContentType,
        long sizeBytes,
        Stream content,
        FileUploadKind kind,
        long? maxBytes = null,
        CancellationToken ct = default)
    {
        var cap = maxBytes ?? DefaultMax(kind);
        if (sizeBytes > cap)
            throw new AppException("file_too_large",
                $"Το αρχείο ξεπερνά το όριο των {cap / (1024 * 1024)} MB.", 400);

        var safety = await _safety.InspectAsync(fileName, declaredContentType, content, kind, ct);
        if (!safety.Allowed)
            throw new AppException(
                safety.RejectionCode ?? "file_rejected",
                safety.RejectionMessage ?? "Το αρχείο απορρίφθηκε για λόγους ασφαλείας.", 400,
                title: "Μη ασφαλές αρχείο",
                why: "Η μεταφόρτωση ελέγχει το πραγματικό περιεχόμενο του αρχείου, όχι μόνο την επέκταση.");

        // AV runs even when the no-op scanner is registered (zero-cost) so when
        // a real ClamAV impl drops in later, every caller picks it up.
        var av = await _av.ScanAsync(content, fileName, ct);
        if (!av.Clean)
            throw new AppException("file_infected",
                $"Εντοπίστηκε απειλή στο αρχείο ({av.Signature ?? "άγνωστη υπογραφή"}).", 400,
                title: "Επικίνδυνο αρχείο",
                why: "Ο antivirus εντόπισε γνωστό κακόβουλο μοτίβο στο περιεχόμενο.");
        if (content.CanSeek) content.Position = 0;

        return safety.DetectedContentType
            ?? (string.IsNullOrWhiteSpace(declaredContentType) ? "application/octet-stream" : declaredContentType);
    }

    private static long DefaultMax(FileUploadKind kind) => kind switch
    {
        FileUploadKind.Image       => 4 * 1024 * 1024,   // 4 MB — logos / photos
        FileUploadKind.Spreadsheet => 16 * 1024 * 1024,  // 16 MB — carrier batches
        _                          => 8 * 1024 * 1024    // 8 MB — generic docs
    };
}
