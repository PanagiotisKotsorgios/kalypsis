using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public class InsuranceCompany : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Country { get; set; }
    public string? Website { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
}
