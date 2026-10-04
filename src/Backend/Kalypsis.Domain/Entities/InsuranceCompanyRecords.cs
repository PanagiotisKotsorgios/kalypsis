using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>Tenant-owned folders used to organise an insurer's working file.</summary>
public class InsuranceCompanyFolder : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public Guid? ParentFolderId { get; set; }
    public InsuranceCompanyFolder? ParentFolder { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = "#0b2545";
    public int SortOrder { get; set; }
}

/// <summary>One uploaded file in an insurer's office-specific file.</summary>
public class InsuranceCompanyDocument : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public Guid? FolderId { get; set; }
    public InsuranceCompanyFolder? Folder { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string Category { get; set; } = "Γενικά";
    public string? Description { get; set; }
    public string? TagsJson { get; set; }
    public string? MetadataJson { get; set; }
    public DateOnly? DocumentDate { get; set; }
    public DateOnly? ExpiresOn { get; set; }
    public bool IsConfidential { get; set; }
    public Guid? UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }
}

/// <summary>Office-defined document category shown in the company file.</summary>
public class InsuranceCompanyCategory : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#1976d2";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>Multiple named contacts and escalation roles for an insurer.</summary>
public class InsuranceCompanyContact : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? Department { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Mobile { get; set; }
    public string? Notes { get; set; }
    public string PreferredChannel { get; set; } = "Email";
    public bool IsPrimary { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>One dated interaction with an insurer or its representatives.</summary>
public class InsuranceCompanyCommunication : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public string Kind { get; set; } = "Email";
    public string Direction { get; set; } = "Outbound";
    public string? Subject { get; set; }
    public string? Body { get; set; }
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public DateTime OccurredAt { get; set; }
}

/// <summary>Per-insurer custom field definition created by the office.</summary>
public class InsuranceCompanyFieldDefinition : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text";
    public string? OptionsJson { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>Value for an insurer-specific custom field.</summary>
public class InsuranceCompanyFieldValue : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;
    public Guid DefinitionId { get; set; }
    public InsuranceCompanyFieldDefinition Definition { get; set; } = null!;
    public string? Value { get; set; }
}

/// <summary>
/// A tenant-owned relationship from a broker/agency to another company.
/// This is intentionally separate from <see cref="InsuranceCompany.ParentCompanyId"/>
/// because that property is reserved for the carrier-parametric hierarchy.
/// An agency can therefore keep a rich, editable list of insurers, networks,
/// sub-companies and other business partners without changing policy routing.
/// </summary>
public class InsuranceCompanyPartner : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    public Guid PartnerInsuranceCompanyId { get; set; }
    public InsuranceCompany PartnerInsuranceCompany { get; set; } = null!;

    public string RelationshipType { get; set; } = "Συνεργαζόμενη ασφαλιστική";
    public string? CooperationCode { get; set; }
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}
