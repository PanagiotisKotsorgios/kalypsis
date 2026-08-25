using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// «ΕΡΜΗΣ» — Kalypsis-native messaging module.
///
/// A full Outlook-style inbox living entirely on the Kalypsis cloud so
/// agencies stop routing sensitive customer/policy info through external
/// email providers. Messages are tenant-scoped and end-to-end tracked in
/// the platform's audit log; recipients see them in real time and get
/// an optional email nudge (via the tenant's existing Brevo integration)
/// pointing them back to the app.
///
/// The wire model is deliberately simple:
///   • ErmesMessage      — one row per composed message (with folder = Sent,
///                          Draft or Trash from the author's perspective).
///   • ErmesRecipient    — one row per (message × recipient user), mirroring
///                          the message into that user's inbox with its own
///                          read/starred/folder state.
///   • ErmesTeam         — an addressable group ("Ομάδα Marketing", etc.).
///     ErmesTeamMember   — a user in a team.
///   • ErmesBlock        — a user this user does not want to receive from
///                          ("μπλοκάρισμα ανεπιθύμητων").
/// </summary>
public class ErmesMessage : TenantEntity
{
    /// <summary>Author user (always a real signed-in user; system-generated
    /// messages use the tenant's «κοινός» system-user id).</summary>
    public Guid SenderUserId { get; set; }
    public string SenderDisplay { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;

    /// <summary>Subject line; 400 chars matches Outlook's soft cap.</summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>Rich-text body as sanitised HTML (bold/italic/lists/links).
    /// Sanitised on write to strip script/style/on* handlers.</summary>
    public string BodyHtml { get; set; } = string.Empty;

    /// <summary>Plain-text fallback for the list preview line.</summary>
    public string Preview { get; set; } = string.Empty;

    /// <summary>Message this one replies to / forwards from — powers the
    /// «Απάντηση» / «Προώθηση» threading.</summary>
    public Guid? InReplyToMessageId { get; set; }

    /// <summary>The thread-root message id — shared by every message in a
    /// reply chain. Equal to Id for a top-level message.</summary>
    public Guid ThreadId { get; set; }

    /// <summary>Folder from the SENDER's perspective. Recipients keep their
    /// own folder state on ErmesRecipient.</summary>
    /// Values: Sent / Draft / Trash.
    public string SenderFolder { get; set; } = "Sent";

    /// <summary>«★» flag from the sender's perspective.</summary>
    public bool SenderStarred { get; set; }

    /// <summary>When the message actually went out (null while a draft).</summary>
    public DateTime? SentAt { get; set; }

    /// <summary>«Σπουδαίο» flag — surfaces the message with a red-flag chip.</summary>
    public bool IsImportant { get; set; }

    /// <summary>Free-form JSON list of attachment stubs — we don't yet host
    /// binary uploads inside Ermes; the field stores {name, sizeBytes,
    /// documentId} for policy/customer documents already in Kalypsis.</summary>
    public string? AttachmentsJson { get; set; }

    /// <summary>Automation tag — set when the platform generates the message
    /// on the tenant's behalf (e.g. «monthly-production-list»). Lets the UI
    /// badge the row and lets an admin filter automations out of the search.</summary>
    public string? AutomationSource { get; set; }

    /// <summary>Free-form category / label chosen by the sender at compose
    /// time («Εργασία», «Παραγωγή», «Πελάτης», …). Displayed as a chip in
    /// the list row and searchable in the filter box.</summary>
    public string? Category { get; set; }

    /// <summary>True → also fire an external email to every recipient's
    /// registered address via the platform's Brevo integration. Best-
    /// effort: failures are logged but never abort the in-app send.</summary>
    public bool ExternalEmailRequested { get; set; }
    public bool ExternalEmailDelivered { get; set; }
    public string? ExternalEmailStatus { get; set; }

    /// <summary>Optional channel this message was posted to — set when the
    /// operator sends from the ΕΡΜΗΣ Channel view (Discord-style feed).
    /// Points at an ErmesTeam.Id; the channel query filters by this
    /// column so a channel is a persistent chronological feed even if
    /// individual recipients later archive or delete their copies.</summary>
    public Guid? ChannelId { get; set; }

    /// <summary>Per-recipient E2E envelopes for this message. When set,
    /// <see cref="BodyHtml"/> is a UI placeholder («[Κρυπτογραφημένο μήνυμα]»)
    /// and the actual plaintext lives inside the envelope keyed by each
    /// recipient's user id. The server NEVER holds the plaintext — decryption
    /// happens in the recipient's browser with a private key that never
    /// leaves IndexedDB.
    ///
    /// Shape (serialised JSON):
    /// {
    ///   "&lt;recipientUserId&gt;": {
    ///     "ivB64": "…", "ctB64": "…", "senderPubSpkiB64": "…"
    ///   }, …
    /// }
    ///
    /// Null / empty → the message is plain HTML (older messages, senders
    /// without a keypair yet, or recipients missing keys). The client
    /// falls back to <see cref="BodyHtml"/> in that case.</summary>
    public string? EncryptedEnvelopesJson { get; set; }
}

/// <summary>
/// Physical attachment stored on the tenant's DB (base64 blob column) —
/// keeps ΕΡΜΗΣ self-contained without depending on the tenant having an
/// object storage bucket configured. Cap enforced client-side + server-
/// side; base64 balloon means a 5 MB file lands at ~7 MB in the column.
/// </summary>
public class ErmesAttachment : TenantEntity
{
    public Guid MessageId { get; set; }
    public ErmesMessage? Message { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public byte[] ContentBytes { get; set; } = Array.Empty<byte>();
    public Guid UploadedByUserId { get; set; }

    /// <summary>When non-null, <see cref="ContentBytes"/> holds AES-256-GCM
    /// ciphertext encrypted with a per-attachment file key that lives INSIDE
    /// the parent message's per-recipient envelope — the server never has
    /// the key and cannot decrypt. The IV lives here (base64 of a 12-byte
    /// nonce) so the client can decrypt after fetching the ciphertext.
    /// Null → the attachment is plaintext (older uploads, or messages
    /// sent to peers that don't all have keypairs).</summary>
    public string? EncryptionIvB64 { get; set; }

    /// <summary>The original file name, encrypted with the same file key.
    /// When set, <see cref="FileName"/> is a placeholder («encrypted.bin»)
    /// and the real name is inside the ciphertext (client decrypts before
    /// showing it in the reader). Stored as base64 of AES-GCM ciphertext
    /// with its own IV prefixed (first 12 bytes).</summary>
    public string? EncryptedFileNameB64 { get; set; }
}

/// <summary>
/// A recipient row — one per (message × user). Splitting recipients out of
/// the message keeps read/starred/folder state per user and allows To/Cc/Bcc
/// semantics without duplicating the message body.
/// </summary>
public class ErmesRecipient : TenantEntity
{
    public Guid MessageId { get; set; }
    public ErmesMessage? Message { get; set; }

    public Guid RecipientUserId { get; set; }
    public string RecipientDisplay { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;

    /// <summary>«To» / «Cc» / «Bcc». Bcc rows are invisible to other
    /// recipients — the API strips them from responses unless the caller
    /// is the sender or the Bcc target themselves.</summary>
    public string Kind { get; set; } = "To";

    /// <summary>Folder from THIS recipient's perspective.
    /// Values: Inbox / Spam / Trash / Archive.</summary>
    public string Folder { get; set; } = "Inbox";

    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public bool IsStarred { get; set; }
}

/// <summary>
/// Addressable group so «Ομάδα Marketing» can be picked as a single
/// recipient. On send we fan out into per-user ErmesRecipient rows.
/// </summary>
public class ErmesTeam : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid CreatedByUserId { get; set; }
}

public class ErmesTeamMember : TenantEntity
{
    public Guid TeamId { get; set; }
    public ErmesTeam? Team { get; set; }
    public Guid UserId { get; set; }
    public string UserDisplay { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
}

/// <summary>
/// «Ανεπιθύμητοι» — a per-user block list. Messages from a blocked sender
/// land straight in the recipient's Spam folder.
/// </summary>
public class ErmesBlock : TenantEntity
{
    /// <summary>The user who added the block (i.e. the target of unwanted
    /// messages).</summary>
    public Guid OwnerUserId { get; set; }
    public Guid BlockedUserId { get; set; }
    public string BlockedDisplay { get; set; } = string.Empty;
    public string BlockedEmail { get; set; } = string.Empty;
    public string? Reason { get; set; }
}
