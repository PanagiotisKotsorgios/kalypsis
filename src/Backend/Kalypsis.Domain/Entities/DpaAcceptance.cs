using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// GDPR Άρθρο 28 §3 — καταγραφή της αποδοχής της Σύμβασης Επεξεργασίας
/// Προσωπικών Δεδομένων (Data Processing Agreement) από κάθε γραφείο-controller
/// προς την Kalypsis-processor.
///
/// Κάθε νέα έκδοση του DPA (π.χ. αλλαγή sub-processor, νέο TOM section)
/// επιβάλλει νέα αποδοχή — γι' αυτό ο <see cref="Version"/> είναι μέρος του
/// μοναδικού συνδυασμού. Το IP + UserAgent προσφέρουν non-repudiation στο
/// επίπεδο που περιμένει η ΑΠΔΠΧ σε τυπική ελεγχο-διαπίστωση.
/// </summary>
public class DpaAcceptance : TenantEntity
{
    /// <summary>π.χ. «v1.0» — ταιριάζει με το version string στη σελίδα /dpa.</summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>UTC timestamp της αποδοχής.</summary>
    public DateTime AcceptedAt { get; set; }

    /// <summary>Ο χρήστης που πάτησε «Αποδοχή» (πάντα AgencyAdmin).</summary>
    public Guid AcceptedByUserId { get; set; }
    public User? AcceptedByUser { get; set; }

    /// <summary>Ονοματεπώνυμο του υπογράφοντα κατά τη στιγμή της αποδοχής
    /// (snapshot — δεν αλλάζει αν αργότερα αλλάξει το User record).</summary>
    public string AcceptedByName { get; set; } = string.Empty;

    /// <summary>Email snapshot ίδιο σκεπτικό.</summary>
    public string AcceptedByEmail { get; set; } = string.Empty;

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
