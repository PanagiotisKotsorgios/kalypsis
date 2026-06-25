namespace Kalypsis.Domain.Enums;

/// <summary>
/// Vehicle-use classification used by Greek motor insurance — every category
/// carries a distinct risk profile and therefore can have its own commission
/// percentages. Set on a Policy to record what kind of vehicle, and on a
/// CommissionRule to scope the rule to a specific use category.
/// </summary>
public enum VehicleUseCategory
{
    /// <summary>Not specified / not a vehicle policy.</summary>
    None = 0,
    /// <summary>Επιβατικό Ιδιωτικής Χρήσης — private passenger car.</summary>
    EIX = 1,
    /// <summary>Επιβατικό Δημόσιας Χρήσης — taxi / public-use passenger vehicle.</summary>
    EDX = 2,
    /// <summary>Φορτηγό Ιδιωτικής Χρήσης — private truck / van.</summary>
    FIX = 3,
    /// <summary>Φορτηγό Δημόσιας Χρήσης — public-use truck.</summary>
    FDX = 4,
    /// <summary>Λεωφορείο Ιδιωτικής Χρήσης — private bus.</summary>
    LIX = 5,
    /// <summary>Λεωφορείο Δημόσιας Χρήσης — public-use bus.</summary>
    LDX = 6,
    /// <summary>Μοτοσικλέτα / δίκυκλο.</summary>
    Motorcycle = 7,
    /// <summary>Αγροτικό — agricultural vehicle.</summary>
    Agricultural = 8,
    /// <summary>Εργοταξιακό / μηχάνημα έργου.</summary>
    Construction = 9
}
