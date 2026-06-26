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
    DataSharingPartners = 5
}

public enum ConsentMethod
{
    OnlineForm = 1,
    PaperForm = 2,
    Verbal = 3,
    EmailReply = 4,
    MobileApp = 5
}
