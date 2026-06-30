using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// A single insured «αντικείμενο» under a policy. IW models multi-vehicle and
/// multi-property policies with one Object row per item — we mirror that.
/// Common kinds: ΕΙΧ / ΦΙΧ / ΤΑΞΙ / ΛΕΩΦ / ΜΟΤΟ for autos, ΚΑΤΟΙΚΙΑ / ΕΠΙΧΕΙΡΗΣΗ
/// for property, ΣΚΑΦΟΣ for boats, etc.
/// </summary>
public class PolicyObject : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy? Policy { get; set; }

    /// <summary>Object kind label (free-form; chosen from carrier παραμετρικά).</summary>
    public string ObjectKind { get; set; } = string.Empty;

    /// <summary>Carrier identifier code (e.g. FBC00100, IW01).</summary>
    public string? FbcLinkCode { get; set; }

    /// <summary>Plate / registration / serial / address — main identifier.</summary>
    public string? Identifier { get; set; }

    /// <summary>Free-form description: model, address, area, etc.</summary>
    public string? Description { get; set; }

    /// <summary>Per-object additional characteristic (color, year of construction, ...).</summary>
    public string? Characteristic { get; set; }

    public ICollection<PolicyCover> Covers { get; set; } = new List<PolicyCover>();
}

/// <summary>
/// One «Κάλυψη» line for a policy object. IW's Covers file structure:
/// Α/Α | Αντικείμενο | Κάλυψη | Ασφάλιστρα | Καθαρά | ΚαλΚεφάλαιο.
/// </summary>
public class PolicyCover : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy? Policy { get; set; }

    public Guid? PolicyObjectId { get; set; }
    public PolicyObject? PolicyObject { get; set; }

    /// <summary>Coverage code from the carrier's catalogue (e.g. MTPL, Α08, FH1).</summary>
    public string CoverCode { get; set; } = string.Empty;

    /// <summary>Display name from the carrier's catalogue.</summary>
    public string? CoverName { get; set; }

    /// <summary>Gross premium for this cover.</summary>
    public decimal GrossPremium { get; set; }

    /// <summary>Net premium for this cover (after taxes).</summary>
    public decimal NetPremium { get; set; }

    /// <summary>Capital insured / κάλυψη κεφαλαίου (limit).</summary>
    public decimal? CoverageAmount { get; set; }
}

/// <summary>
/// One installment of a policy's premium. Generated automatically when
/// PaymentFrequency != Annual / Single. The agency settles each installment
/// by marking it paid when a receipt arrives.
/// </summary>
public class PolicyInstallment : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy? Policy { get; set; }

    /// <summary>1-based ordinal across the policy's installment plan.</summary>
    public int Ordinal { get; set; }

    public DateOnly DueDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";

    /// <summary>Set when the agency records a receipt for this installment.</summary>
    public DateOnly? PaidAt { get; set; }

    /// <summary>Payment method captured at the time of marking paid.</summary>
    public string? PaidVia { get; set; }

    /// <summary>Receipt reference (free text — receipt #, IBAN tail, card last4).</summary>
    public string? ReceiptReference { get; set; }
}
