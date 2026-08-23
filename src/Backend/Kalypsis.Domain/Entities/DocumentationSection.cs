using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One node of the public «Οδηγίες Χρήσης» documentation tree served at
/// /documentation (public) and /app/documentation (in-app). Not a
/// TenantEntity — the documentation is platform-wide content the
/// PlatformAdmin edits from /app/platform/documentation. Every office
/// sees the same published tree.
/// </summary>
public class DocumentationSection : BaseEntity
{
    /// <summary>URL-safe unique identifier used as the in-page anchor
    /// («welcome», «customers-create», …). Also the parent pointer for
    /// child sections. Immutable once created.</summary>
    public string Slug { get; set; } = "";

    /// <summary>Slug of the parent section — null for top-level entries.</summary>
    public string? ParentSlug { get; set; }

    /// <summary>Human-readable title rendered as the heading + TOC label.</summary>
    public string Title { get; set; } = "";

    /// <summary>Sanitised HTML body — output of the RichTextEditor, may
    /// contain <img> tags whose src points to /api/documentation/assets/{id}.</summary>
    public string BodyHtml { get; set; } = "";

    /// <summary>Comma-separated Greek + English keywords for the in-page
    /// search filter and SEO. Free-form; not indexed at the DB level.</summary>
    public string? Keywords { get; set; }

    /// <summary>Sort order within the same parent (siblings ordered ASC).</summary>
    public int DisplayOrder { get; set; }

    /// <summary>When false, the section is a draft — visible only to
    /// PlatformAdmin in the editor, hidden from the public reader.</summary>
    public bool IsPublished { get; set; } = true;
}

/// <summary>
/// Binary asset (usually a screenshot) uploaded by the PlatformAdmin
/// from the documentation editor. Served back through the API so URLs
/// are stable regardless of storage backend.
/// </summary>
public class DocumentationAsset : BaseEntity
{
    /// <summary>Original filename (kept for UI display + downloads).</summary>
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    /// <summary>Path within IFileStorage — same shape other uploads use.</summary>
    public string StoragePath { get; set; } = "";
    public Guid? UploadedByUserId { get; set; }
}
