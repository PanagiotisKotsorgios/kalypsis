using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

public class Customer : TenantEntity
{
    public string CustomerNumber { get; set; } = string.Empty;
    public CustomerType Type { get; set; }

    public string? FirstName { get; set; }
    public string? LastName { get; set; }

    public string? CompanyName { get; set; }
    public string? VatNumber { get; set; }

    public string? Email { get; set; }
    public string? Phone { get; set; }

    public string? Address { get; set; }
    public string? City { get; set; }
    public string? PostalCode { get; set; }

    public DateOnly? BirthDate { get; set; }

    public string? Notes { get; set; }

    public ICollection<Policy> Policies { get; set; } = new List<Policy>();
}
