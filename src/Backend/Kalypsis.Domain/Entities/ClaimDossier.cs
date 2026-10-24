using System;
using Kalypsis.Domain.Common;
namespace Kalypsis.Domain.Entities;

public class ClaimKind : TenantEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string BranchCode { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
public class ClaimAttachment : TenantEntity
{
    public Guid ClaimId { get; set; }
    public Claim Claim { get; set; } = null!;
    public string Title { get; set; } = "";
    public string DocumentKind { get; set; } = "Other";
    public string FileName { get; set; } = "";
    public string StoragePath { get; set; } = "";
    public string MimeType { get; set; } = "";
    public long SizeBytes { get; set; }
    public string? Notes { get; set; }
}
