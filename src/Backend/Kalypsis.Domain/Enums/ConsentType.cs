namespace Kalypsis.Domain.Enums;

/// <summary>
/// GDPR consent categories. Anything outside of mandatory contract execution
/// (e.g. marketing/profiling) needs an explicit opt-in record per type.
/// </summary>
public enum ConsentType
{
    EmailMarketing = 1,
    SmsMarketing = 2,
    ViberMarketing = 6,
    PhoneMarketing = 3,
    AutomatedDecisionMaking = 4,
    DataSharingPartners = 5,

    /// <summary>Άρθρο 13 GDPR — παραλαβή της Ενημέρωσης Υποκειμένου κατά τη
    /// συλλογή δεδομένων. Δεν είναι technically «consent» (η νομική βάση
    /// είναι εκτέλεση σύμβασης) αλλά ο controller οφείλει να αποδείξει
    /// ότι δόθηκε στον πελάτη.</summary>
    PrivacyNotice = 7,

    /// <summary>Άρθρο 9§2(α) GDPR — ρητή συγκατάθεση επεξεργασίας δεδομένων
    /// υγείας. Απαιτούμενη για συμβόλαια Ζωής/Υγείας/Ατυχημάτων.</summary>
    HealthDataProcessing = 8,

    /// <summary>Ν. 4583/2018 Άρθρο 27 (IDD) — Ανάλυση Απαιτήσεων & Αναγκών.
    /// Ο διαμεσολαβητής υπογράφει με τον πελάτη το σχετικό έντυπο πριν
    /// προτείνει προϊόν.</summary>
    IddDemandsAndNeeds = 9,

    /// <summary>Ν. 4557/2018 — Δήλωση Πραγματικού Δικαιούχου & Πηγής Χρημάτων
    /// (KYC/AML). Απαιτούμενη για συμβόλαια Ζωής ή αξίας ≥15.000€/έτος.</summary>
    AmlKycDeclaration = 10
}

public enum ConsentMethod
{
    OnlineForm = 1,
    PaperForm = 2,
    Verbal = 3,
    EmailReply = 4,
    MobileApp = 5
}
