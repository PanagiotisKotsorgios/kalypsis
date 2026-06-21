using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Reusable email body templated with Scriban-style {{merge}} fields. The system templates
/// (renewal reminders, welcome, payment overdue) are seeded per-tenant on creation; agencies
/// can edit them but not delete them.
/// </summary>
public class EmailTemplate : TenantEntity
{
    public string Code { get; set; } = string.Empty;       // unique per tenant (e.g. "renewal-30d")
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;
    public string? BodyPlain { get; set; }
    public string Language { get; set; } = "el";
    public bool IsSystem { get; set; }                     // seeded — cannot be deleted
    public bool IsActive { get; set; } = true;
}
