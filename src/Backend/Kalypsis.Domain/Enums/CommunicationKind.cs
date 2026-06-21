namespace Kalypsis.Domain.Enums;

public enum CommunicationKind
{
    Note = 1,
    Phone = 2,
    Email = 3,
    Meeting = 4,
    Sms = 5,
    WalkIn = 6
}

public enum CommunicationDirection
{
    Internal = 1,
    Inbound = 2,
    Outbound = 3
}

public enum CommunicationOutcome
{
    None = 0,
    Resolved = 1,
    FollowUpRequired = 2,
    NoAnswer = 3,
    Cancelled = 4
}
