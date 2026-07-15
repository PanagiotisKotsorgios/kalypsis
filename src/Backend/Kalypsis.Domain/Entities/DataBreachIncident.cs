using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

public enum BreachSeverity
{
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
}

public enum BreachContainmentStatus
{
    InProgress = 0,
    Contained = 1,
    Resolved = 2
}

public enum BreachTenantScope
{
    AllTenants = 0,
    Specific = 1
}

/// <summary>
/// GDPR Άρθρο 33 — Καταγραφή περιστατικού παραβίασης προσωπικών δεδομένων.
///
/// Ο Πάροχος (Kalypsis) ως Εκτελών την Επεξεργασία υποχρεούται να ειδοποιεί
/// τους Υπεύθυνους Επεξεργασίας (γραφεία-πελάτες) «χωρίς αδικαιολόγητη
/// καθυστέρηση» και να ενημερώνει την ΑΠΔΠΧ εντός 72 ωρών από τη γνώση της
/// παραβίασης. Η οντότητα αυτή κρατά το πλήρες audit trail: διάγνωση,
/// σκοπός, μέτρα, χρόνος ειδοποίησης controllers, χρόνος ειδοποίησης αρχής.
///
/// Platform-scoped (BaseEntity, όχι TenantEntity) γιατί ένα incident μπορεί
/// να επηρεάζει πολλαπλά ή όλα τα γραφεία. Το πεδίο <see cref="TenantsScope"/>
/// + <see cref="AffectedTenantIdsJson"/> λέει ποια γραφεία επηρεάζονται.
/// </summary>
public class DataBreachIncident : BaseEntity
{
    /// <summary>«BR-XXXXXX» — user-facing reference σε ενδεχόμενη επικοινωνία με ΑΠΔΠΧ.</summary>
    public string IncidentCode { get; set; } = string.Empty;

    /// <summary>Πότε το πληροφορηθήκαμε — από αυτό ξεκινά το 72h clock.</summary>
    public DateTime DiscoveredAt { get; set; }

    /// <summary>Πότε πραγματικά συνέβη (αν διαφέρει από τη γνώση).</summary>
    public DateTime? OccurredAt { get; set; }

    public BreachSeverity Severity { get; set; } = BreachSeverity.Medium;
    public BreachContainmentStatus ContainmentStatus { get; set; } = BreachContainmentStatus.InProgress;
    public BreachTenantScope TenantsScope { get; set; } = BreachTenantScope.AllTenants;

    /// <summary>JSON array of TenantIds — γεμίζει μόνο όταν TenantsScope==Specific.</summary>
    public string? AffectedTenantIdsJson { get; set; }

    /// <summary>Σύντομη περιγραφή για internal use (Art. 33 §5(a) — nature).</summary>
    public string Nature { get; set; } = string.Empty;

    /// <summary>Comma-separated λίστα κατηγοριών (π.χ. «email, phone, IBAN»). Art. 33 §3(a).</summary>
    public string? AffectedDataCategories { get; set; }

    /// <summary>Κατά προσέγγιση αριθμός επηρεαζόμενων υποκειμένων. Art. 33 §3(a).</summary>
    public int? EstimatedAffectedSubjects { get; set; }

    /// <summary>Τι κάναμε για την περιορίσουμε/αντιμετωπίσουμε. Art. 33 §3(d).</summary>
    public string? Mitigations { get; set; }

    /// <summary>Timestamp όταν στείλαμε email/notification στους affected controllers.</summary>
    public DateTime? TenantsNotifiedAt { get; set; }

    /// <summary>Timestamp όταν ειδοποιήσαμε την ΑΠΔΠΧ (Art. 33 §1 — 72h clock).</summary>
    public DateTime? AuthorityNotifiedAt { get; set; }

    /// <summary>Reference number της ειδοποίησης προς ΑΠΔΠΧ, αν υπάρχει.</summary>
    public string? AuthorityReference { get; set; }

    public Guid ReportedByUserId { get; set; }
    public User? ReportedByUser { get; set; }

    public DateTime? ClosedAt { get; set; }
    public string? ClosureNotes { get; set; }
}
