using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One person / entity involved in a claim beyond the policyholder — the
/// other driver, the passenger who filed a personal-injury claim, a witness,
/// the garage that repaired the vehicle, etc. ALIS surfaces these under
/// «F5 Ζημιάδες Εμπλεκόμενοι» on the customer card so operators can browse
/// «who else was in the incident?» without opening every claim.
/// </summary>
public class ClaimInvolvedParty : TenantEntity
{
    public Guid ClaimId { get; set; }
    public Claim Claim { get; set; } = null!;

    /// <summary>
    /// Ρόλος στο ατύχημα / ζημιά. Free string so tenants can extend without
    /// a schema migration (Driver, Passenger, Pedestrian, Cyclist, Witness,
    /// OwnerOfOther, Garage, InsuranceExpert, Attorney, Other, ...).
    /// </summary>
    public string Role { get; set; } = "Other";

    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    /// <summary>ΑΦΜ — required for property/injury settlement paperwork.</summary>
    public string? VatNumber { get; set; }
    /// <summary>Αριθμός κυκλοφορίας του δικού τους οχήματος (αν εφαρμόζεται).</summary>
    public string? VehiclePlate { get; set; }
    public string? InsuranceCompany { get; set; }
    public string? PolicyNumber { get; set; }
    /// <summary>Ελεύθερο κείμενο — σοβαρότητα τραυματισμού, τι έγινε, κ.λπ.</summary>
    public string? Notes { get; set; }
}
