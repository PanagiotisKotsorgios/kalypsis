using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public sealed class CustomSoftwarePortalAccount : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; } = true;
    public int FailedLoginAttempts { get; set; }
    public DateTime? LockedUntil { get; set; }
    public int SessionVersion { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public string PreferencesJson { get; set; } = "{}";
    public ICollection<CustomSoftwareProjectAccess> ProjectAccesses { get; set; } = new List<CustomSoftwareProjectAccess>();
}

public sealed class CustomSoftwareProject : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Description { get; set; }
    public string Status { get; set; } = "planning";
    public string Currency { get; set; } = "EUR";
    public decimal? TotalCost { get; set; }
    public DateOnly? StartedOn { get; set; }
    public DateOnly? TargetDate { get; set; }
    public string? RepositoryUrl { get; set; }
    public string? ProjectDownloadUrl { get; set; }
    public string? AdminNotes { get; set; }
    public ICollection<CustomSoftwareProjectAccess> UserAccesses { get; set; } = new List<CustomSoftwareProjectAccess>();
    public ICollection<CustomSoftwareProjectRecord> Records { get; set; } = new List<CustomSoftwareProjectRecord>();
}

public sealed class CustomSoftwareProjectAccess : BaseEntity
{
    public Guid ProjectId { get; set; }
    public CustomSoftwareProject Project { get; set; } = null!;
    public Guid AccountId { get; set; }
    public CustomSoftwarePortalAccount Account { get; set; } = null!;
    public string AccessLevel { get; set; } = "owner";
}

public sealed class CustomSoftwareProjectRecord : BaseEntity
{
    public Guid ProjectId { get; set; }
    public CustomSoftwareProject Project { get; set; } = null!;
    public Guid? ParentRecordId { get; set; }
    public CustomSoftwareProjectRecord? ParentRecord { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string? DetailsJson { get; set; }
    public int SortOrder { get; set; }
    public decimal? Amount { get; set; }
    public DateOnly? DueOn { get; set; }
    public DateOnly? IssuedOn { get; set; }
    public string? StorageKey { get; set; }
    public string? FileName { get; set; }
    public string? ContentType { get; set; }
    public long? SizeBytes { get; set; }
}
