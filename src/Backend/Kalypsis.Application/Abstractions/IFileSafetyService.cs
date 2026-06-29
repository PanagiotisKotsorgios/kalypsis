namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Inspects a file before it's persisted. Returns "safe" / "rejected with reason".
/// Implementations should run BOTH a magic-byte check (so renamed .exe → .pdf
/// doesn't slip through) AND an allowlist of MIME types and extensions.
/// </summary>
public interface IFileSafetyService
{
    /// <summary>
    /// Validates declared content-type + extension against magic bytes and
    /// the allowlist. Reads up to 16 bytes from the start of the stream
    /// then rewinds it for the caller to use.
    /// </summary>
    Task<FileSafetyResult> InspectAsync(string fileName, string? declaredContentType, Stream content, FileUploadKind kind, CancellationToken ct = default);
}

public enum FileUploadKind
{
    /// <summary>PDF / image / Office docs typical for policy/claim documents.</summary>
    Document,
    /// <summary>Image only — logos, photos, scanned cards.</summary>
    Image,
    /// <summary>Spreadsheets and CSV — carrier batches, parametric files.</summary>
    Spreadsheet
}

public sealed record FileSafetyResult(
    bool Allowed,
    string? RejectionCode = null,
    string? RejectionMessage = null,
    string? DetectedContentType = null);
