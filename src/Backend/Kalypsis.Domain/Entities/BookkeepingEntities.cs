using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ── Μηχανογράφιση («bookkeeping as a service») ──────────────────────
//
// Small offices that don't want to run their own bookkeeping staff opt
// in to a service where the Kalypsis platform team enters the data for
// them. This module holds the shared filesystem-like workspace where:
//
//   • Platform admin browses per-tenant folder trees, uploads files
//     from PC, drags-and-drops, deletes, replaces
//   • Tenant uploads source documents (contracts, receipts, bank
//     statements) into their folders
//   • Both sides leave notes on folders / files for coordination
//   • Platform admin logs activity ("Μηχανογραφήθηκε ο μήνας 08/2026")
//     which auto-sends an ΕΡΜΗΣ notification to the tenant
//
// Alternative flow: tenant hands over portal credentials for the
// insurance companies + the platform team logs in and pulls the data
// themselves — captured in BookkeepingPortalCredential.
//
// Multi-tenant isolation: TenantEntity → the global query filter blocks
// cross-tenant reads by AgencyStaff. PlatformAdmin bypasses the filter
// (must, so we can service every tenant we've onboarded).

/// <summary>Per-tenant switch — does this office use our μηχανογράφιση
/// service? When enabled, the tenant appears in the Platform admin's
/// «Μηχανογράφιση γραφείων» list. The alternative flow flag decides
/// whether we ingest uploaded documents or log in to carrier portals
/// on their behalf.</summary>
public class BookkeepingProgram : TenantEntity
{
    public bool Enabled { get; set; }
    /// <summary>«files» → tenant uploads documents into shared folders.
    /// «portals» → tenant gave us portal codes for the insurance carriers
    /// and we log in ourselves. «hybrid» → both.</summary>
    public string Mode { get; set; } = "files";
    /// <summary>Free-form request-for-contact note from the tenant when
    /// they opt in. Platform admin reads it to arrange the flow.
    /// Encrypted at rest via EncryptedStringConverter.</summary>
    public string? ContactRequestNote { get; set; }
    /// <summary>Set by the platform admin once the account has been
    /// on-boarded and folders + credentials arranged.</summary>
    public bool Onboarded { get; set; }
    public DateTime? OnboardedAt { get; set; }

    // ── Terms-of-use acceptance ────────────────────────────────────
    // The tenant must explicitly accept the Bookkeeping AUP (Acceptable
    // Use Policy) before any file upload is allowed:
    //   • No copyrighted material they don't hold rights to
    //   • No content prohibited by Greek/EU law
    //   • Kalypsis is a storage / workflow platform — the tenant is
    //     solely responsible for what they upload
    // TermsAcceptedAt IS NULL → upload endpoints return 428 «terms not
    // accepted». Version bumps invalidate the acceptance (a new
    // TermsVersion the client doesn't recognise re-shows the acceptance
    // gate) so legal can push a policy update without a data migration.
    public DateTime? TermsAcceptedAt { get; set; }
    public Guid? TermsAcceptedByUserId { get; set; }
    public string? TermsAcceptedVersion { get; set; }
}

/// <summary>Folder in the tenant's μηχανογράφιση workspace. Can nest —
/// ParentFolderId points at another folder in the same tenant. NULL
/// parent = root-level. Paths are computed at read time by climbing
/// the tree.</summary>
public class BookkeepingFolder : TenantEntity
{
    public Guid? ParentFolderId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>«default» → seeded from the platform's default folder
    /// structure (Έσοδα / Έξοδα / Παραστατικά / Βιβλία). «custom» →
    /// created manually by admin or tenant.</summary>
    public string Origin { get; set; } = "custom";
    /// <summary>Sort order among siblings — lets the admin arrange the
    /// tree visually without renaming folders.</summary>
    public int DisplayOrder { get; set; }
}

/// <summary>A file uploaded to a bookkeeping folder. Content lives in
/// the DB (blob column) for now — matches how ΕΡΜΗΣ attachments work
/// and keeps ops simple until we have a real object-storage bucket.
/// 16MB cap per file (enforced client + server).</summary>
public class BookkeepingFile : TenantEntity
{
    public Guid FolderId { get; set; }
    public BookkeepingFolder? Folder { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public byte[] ContentBytes { get; set; } = Array.Empty<byte>();
    /// <summary>«tenant» → uploaded by an AgencyStaff of the tenant.
    /// «admin»  → uploaded by a PlatformAdmin doing μηχανογράφιση.
    /// Renders as a chip in the file list so both sides know who owns
    /// each document.</summary>
    public string UploadedBy { get; set; } = "tenant";
    public Guid UploadedByUserId { get; set; }
    public string? Notes { get; set; }
    /// <summary>«pending» / «processed» / «rejected». Set by the
    /// platform admin as they work through the tenant's inbox — the
    /// tenant sees the state as a status chip.</summary>
    public string Status { get; set; } = "pending";
}

/// <summary>Free-form note on either a folder OR a file, used as a
/// mini-chat between the platform admin and the tenant. Kept separate
/// from the file/folder row so multiple notes coexist chronologically
/// without step-on-each-other edits.</summary>
public class BookkeepingNote : TenantEntity
{
    /// <summary>Exactly one of these is non-null — enforced in the
    /// application layer (no DB check constraint yet).</summary>
    public Guid? FolderId { get; set; }
    public Guid? FileId { get; set; }
    public Guid AuthorUserId { get; set; }
    public string AuthorDisplay { get; set; } = string.Empty;
    public string AuthorRole { get; set; } = "tenant";   // «tenant» / «admin»
    public string Body { get; set; } = string.Empty;
}

/// <summary>The «latest thing done» activity feed the platform admin
/// keeps per tenant. Every entry can optionally auto-fire an ΕΡΜΗΣ
/// notification to the tenant's operators (see AutoNotify).</summary>
public class BookkeepingActivity : TenantEntity
{
    public string Kind { get; set; } = "note";
    /// <summary>Short human-readable summary («Μηχανογραφήθηκε ο μήνας
    /// 08/2026», «Ανέβηκε αναλυτικό προμηθειών»).</summary>
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public Guid AuthorUserId { get; set; }
    public string AuthorDisplay { get; set; } = string.Empty;
    public bool AutoNotified { get; set; }
    /// <summary>Optional pointer to the ΕΡΜΗΣ message we fired so the
    /// admin can trace back what the tenant received.</summary>
    public Guid? NotificationMessageId { get; set; }
    /// <summary>Free-form category tag: «Προμήθειες» / «Υπερπρομήθειες»
    /// / «Έξοδα» / «Πληρωμές» / «Βιβλία» — powers a chip filter in the
    /// activity feed.</summary>
    public string? Category { get; set; }
}

/// <summary>Portal credentials for an insurance carrier. Ephemeral —
/// stored encrypted at rest via the platform's column encryption
/// converter. Only PlatformAdmin can read them (blocked from AgencyStaff
/// by the controller layer). Enables the «you give us the codes, we log
/// in» alternative to file uploads.</summary>
public class BookkeepingPortalCredential : TenantEntity
{
    public string CarrierName { get; set; } = string.Empty;
    public string PortalUrl { get; set; } = string.Empty;
    public string UsernameCipher { get; set; } = string.Empty;
    public string PasswordCipher { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public bool Active { get; set; } = true;
    public DateTime? LastVerifiedAt { get; set; }
}
