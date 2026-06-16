namespace Kalypsis.Domain.Enums;

public enum ServiceRequestType
{
    NewPolicy = 1,
    AccidentReport = 2,
    DocumentRequest = 3,
    PolicyChange = 4,
    GeneralQuestion = 99
}

public enum ServiceRequestStatus
{
    Submitted = 1,
    InReview = 2,
    AwaitingCustomerInfo = 3,
    Resolved = 4,
    Closed = 5,
    Rejected = 6
}

public enum AttachmentCategory
{
    DrivingLicense = 1,
    VehicleRegistration = 2,
    AccidentPhoto = 3,
    AccidentReport = 4,
    IdCard = 5,
    Other = 99
}
