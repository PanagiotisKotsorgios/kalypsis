using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Phase 9 — Reference catalogs (Βοηθητικά αρχεία). Per-tenant lookup tables
// that drive dropdowns in forms across the BackOffice. Each agency curates
// their own list; the seeder pre-loads a sensible starter set.
// ============================================================================

public class Bank : TenantEntity
{
    public string Code { get; set; } = string.Empty;                 // e.g. "PIRAEUS"
    public string Name { get; set; } = string.Empty;
    public string? Swift { get; set; }
    public string? AccountIban { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public class TaxOffice : TenantEntity
{
    public string Code { get; set; } = string.Empty;                 // DOY code
    public string Name { get; set; } = string.Empty;
    public string? City { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CustomerCategory : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ColorHex { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ProducerCategory : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Nationality : TenantEntity
{
    public string Iso2 { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class Occupation : TenantEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public bool IsActive { get; set; } = true;
}

public class City : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Region { get; set; }                              // νομός
    public string? PostalCode { get; set; }
    public int DisplayOrder { get; set; }
}

public class LegalForm : TenantEntity
{
    public string Code { get; set; } = string.Empty;                 // ΑΕ / ΕΠΕ / ΙΚΕ / ΟΕ / ΕΕ / ΑΤΟΜ
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
