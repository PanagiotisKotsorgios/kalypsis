using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/*
 * SuperAdmin-scoped entities that back the /platform/* pages the SuperAdmin
 * uses to run the SaaS side of the business. All rows are platform-global
 * (BaseEntity, not TenantEntity) — the SuperAdmin is not scoped to any
 * tenant. TenantId is stored as a plain Guid where the record references
 * one, without a FK-tracked navigation property, to keep the platform
 * tables independent of the tenant lifecycle.
 */

/// <summary>
/// Independent contractor that manages one or more tenants' back-office at a
/// custom monthly rate outside the standard Kalypsis subscription. The
/// SuperAdmin registers contractors here; assignments to specific tenants
/// live in <see cref="ContractorAssignment"/>.
/// </summary>
public class Contractor : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AfmVat { get; set; }
    public bool Active { get; set; } = true;
    public string? Notes { get; set; }
}

/// <summary>
/// A specific contractor's engagement with a specific tenant, with the
/// monthly rate the tenant pays the contractor. Not part of Kalypsis MRR —
/// this is billed directly between contractor and tenant. Kalypsis tracks
/// it only for the SuperAdmin's fleet-wide reporting.
/// </summary>
public class ContractorAssignment : BaseEntity
{
    public Guid ContractorId { get; set; }
    public Contractor? Contractor { get; set; }

    public Guid TenantId { get; set; }
    public decimal MonthlyPrice { get; set; }
    public string Currency { get; set; } = "EUR";
    public DateTime StartedOn { get; set; }
    public DateTime? EndedOn { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Payment status of a tenant's Kalypsis subscription. One row per tenant;
/// updated by the SuperAdmin when they mark an invoice as paid. Powers the
/// «Πληρωμένα / Ληξιπρόθεσμα / Χωρίς σήμανση» KPIs on the Economics page.
/// </summary>
public class TenantPaymentStatus : BaseEntity
{
    public Guid TenantId { get; set; }
    /// <summary>Date through which the tenant's subscription is paid.</summary>
    public DateTime? PaidUntil { get; set; }
    public DateTime? LastPaidOn { get; set; }
    public string? Note { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// SuperAdmin-facing support ticket. Distinct from a customer <c>ServiceRequest</c>
/// — this is the SuperAdmin's inbox for issues raised by tenant admins. Replies
/// live in <see cref="SupportTicketReply"/>; sending a reply as «Ειδοποίηση
/// πελάτη» also fires an email + Notification for the target tenant.
/// </summary>
public class SupportTicket : BaseEntity
{
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    /// <summary>"High" | "Normal" | "Low"</summary>
    public string Priority { get; set; } = "Normal";
    /// <summary>"Open" | "InProgress" | "Waiting" | "Resolved"</summary>
    public string Status { get; set; } = "Open";
    /// <summary>"Email" | "Internal" | "Phone"</summary>
    public string Channel { get; set; } = "Internal";
    public string? Assignee { get; set; }
    public DateTime OpenedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class SupportTicketReply : BaseEntity
{
    public Guid SupportTicketId { get; set; }
    public SupportTicket? SupportTicket { get; set; }
    public string Author { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    /// <summary>True when this reply was also delivered as an email/notification to the tenant.</summary>
    public bool NotifiedTenant { get; set; }
}

/// <summary>
/// Persisted override for a background job. The runtime job list lives in
/// code (IHostedService); this table only holds SuperAdmin overrides for the
/// cron expression and enabled flag. Reading the list joins base metadata
/// from the code registry with any override rows keyed by <see cref="JobKey"/>.
/// </summary>
public class PlatformJobOverride : BaseEntity
{
    public string JobKey { get; set; } = string.Empty;
    public string? CronOverride { get; set; }
    public bool Enabled { get; set; } = true;
}

/// <summary>
/// Manifest row for a platform-wide backup archive. Distinct from
/// <see cref="TenantBackup"/> (which is per-tenant) — this is the full DB
/// dump the SuperAdmin creates. Scope indicates what's included: full,
/// db-only, uploads-only, etc.
/// </summary>
public class PlatformBackup : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    /// <summary>"full" | "db-only" | "uploads-only" | "logs-only" | "config-only"</summary>
    public string Scope { get; set; } = "full";
    public string Status { get; set; } = "InProgress";  // InProgress | Completed | Failed
    public string? Message { get; set; }
    public int DurationSeconds { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public string? CreatedByName { get; set; }
}
