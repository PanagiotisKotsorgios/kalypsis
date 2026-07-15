using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

// ============================================================================
// Federation module — sports championships / clubs / athletes / results.
// A federation IS a tenant (TenantId scoped) so it reuses the same multi-
// tenant machinery, auth, and audit trails as the insurance side of the
// platform. FederationAdmin / FederationEmployee / ClubManager roles gate
// which surfaces each user reaches.
// ============================================================================

/// <summary>Πρωτάθλημα — a single championship the federation is hosting.</summary>
public class Championship : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    /// <summary>Sport / discipline — «Στίβος», «Κολύμβηση», …</summary>
    public string Sport { get; set; } = string.Empty;
    public string? Location { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    /// <summary>Draft / Published / RegistrationOpen / RegistrationClosed / InProgress / Completed / Cancelled.</summary>
    public ChampionshipStatus Status { get; set; } = ChampionshipStatus.Draft;

    /// <summary>Free-form description shown on the public page — regulations,
    /// notes, venue info.</summary>
    public string? Description { get; set; }

    /// <summary>Deadline for club registration submission.</summary>
    public DateOnly? RegistrationDeadline { get; set; }

    // ==== Fee model ==========================================================
    /// <summary>Base entry fee per participating club (regardless of athlete
    /// count). Zero if the federation only charges per-athlete.</summary>
    public decimal ClubEntryFee { get; set; }
    /// <summary>Fee per athlete a club brings. This is the primary lever
    /// the operator asked for — «αναλογικά με το ποσα ατομα φερνει».</summary>
    public decimal FeePerAthlete { get; set; }
    public string Currency { get; set; } = "EUR";

    // ==== Attachments ========================================================
    /// <summary>Path to the uploaded προκήρυξη PDF (relative to the storage
    /// root). Null until the federation admin uploads one.</summary>
    public string? AnnouncementFilePath { get; set; }
    public string? AnnouncementFileName { get; set; }

    public ICollection<ChampionshipCategory> Categories { get; set; } = new List<ChampionshipCategory>();
    public ICollection<ChampionshipRegistration> Registrations { get; set; } = new List<ChampionshipRegistration>();
}

public enum ChampionshipStatus
{
    Draft = 0,
    Published = 1,
    RegistrationOpen = 2,
    RegistrationClosed = 3,
    InProgress = 4,
    Completed = 5,
    Cancelled = 9
}

/// <summary>Κατηγορία — one race / weight / age bracket inside a championship.</summary>
public class ChampionshipCategory : TenantEntity
{
    public Guid ChampionshipId { get; set; }
    public Championship Championship { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    /// <summary>Optional age restriction — «Παίδες Α», «Άνδρες», etc.</summary>
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    /// <summary>M / F / Mixed. Free text so exotic categories work.</summary>
    public string? Gender { get; set; }
    /// <summary>Display ordering inside the championship.</summary>
    public int SortOrder { get; set; }
}

/// <summary>Σύλλογος — a club that participates in the federation.</summary>
public class Club : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    /// <summary>Federation-wide unique short code, e.g. «ΓΣΑ», «ΠΑΟΚ».</summary>
    public string Code { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>User account of the club's manager (nullable — a club may be
    /// federation-managed until the manager signs up).</summary>
    public Guid? ManagerUserId { get; set; }

    public ICollection<Athlete> Athletes { get; set; } = new List<Athlete>();
}

/// <summary>Αθλητής — belongs to exactly one club at a time.</summary>
public class Athlete : TenantEntity
{
    public Guid ClubId { get; set; }
    public Club Club { get; set; } = null!;

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateOnly? BirthDate { get; set; }
    /// <summary>M / F / Other.</summary>
    public string? Gender { get; set; }

    /// <summary>Federation-issued athlete number / license id.</summary>
    public string? LicenseNumber { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Δήλωση Συμμετοχής — one row per (Club × Championship).</summary>
public class ChampionshipRegistration : TenantEntity
{
    public Guid ChampionshipId { get; set; }
    public Championship Championship { get; set; } = null!;

    public Guid ClubId { get; set; }
    public Club Club { get; set; } = null!;

    /// <summary>Snapshotted at submission time so a later fee change on the
    /// Championship doesn't rewrite what the club was billed.</summary>
    public DateOnly SubmittedOn { get; set; }
    public decimal TotalFee { get; set; }
    public string Currency { get; set; } = "EUR";

    public RegistrationPaymentStatus PaymentStatus { get; set; } = RegistrationPaymentStatus.Pending;
    public DateOnly? PaidOn { get; set; }
    public string? PaymentReference { get; set; }
    public string? Notes { get; set; }

    public ICollection<RegistrationAthlete> Athletes { get; set; } = new List<RegistrationAthlete>();
}

public enum RegistrationPaymentStatus
{
    Pending = 0,      // αναμένουμε πληρωμή
    Partial = 1,      // μερική
    Paid = 2,         // εξοφλήθηκε
    Waived = 3,       // απαλλάχθηκε
    Overdue = 9       // ληξιπρόθεσμο
}

/// <summary>Junction — athlete enrolled in a category of a registration.</summary>
public class RegistrationAthlete : TenantEntity
{
    public Guid RegistrationId { get; set; }
    public ChampionshipRegistration Registration { get; set; } = null!;

    public Guid AthleteId { get; set; }
    public Athlete Athlete { get; set; } = null!;

    public Guid CategoryId { get; set; }
    public ChampionshipCategory Category { get; set; } = null!;

    /// <summary>Assigned lane / start number in that category. Null until the
    /// draw is executed.</summary>
    public int? StartNumber { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Αποτέλεσμα — one result row per athlete per category.</summary>
public class ChampionshipResult : TenantEntity
{
    public Guid RegistrationAthleteId { get; set; }
    public RegistrationAthlete RegistrationAthlete { get; set; } = null!;

    /// <summary>Ranking inside the category (1 = πρώτος).</summary>
    public int? Rank { get; set; }
    /// <summary>Free-form score / time — «10.42», «1:23.45», «124 kg».
    /// Kept as string because different sports need different units.</summary>
    public string? Score { get; set; }
    public string? Notes { get; set; }

    /// <summary>User that entered the result — audit trail so we know which
    /// employee submitted what number.</summary>
    public Guid? EnteredByUserId { get; set; }
    public DateTime? EnteredAt { get; set; }
}
