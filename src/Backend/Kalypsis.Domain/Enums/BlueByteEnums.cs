namespace Kalypsis.Domain.Enums;

public enum AppointmentStatus { Scheduled = 1, Done = 2, Cancelled = 3 }

public enum PaymentMethod { Cash = 1, Card = 2, BankTransfer = 3, Cheque = 4, PromissoryNote = 5, Other = 99 }

public enum SecurityKind { Cheque = 1, PromissoryNote = 2 }
public enum SecurityStatus { Open = 1, Paid = 2, Bounced = 3, Cancelled = 4 }

public enum FinancialMovementKind
{
    CustomerCharge = 1,
    CustomerCredit = 2,
    PartnerCharge = 3,
    PartnerCredit = 4,
    CompanyCharge = 5,
    CompanyCredit = 6,
    CommissionEarned = 7,
    OverCommissionEarned = 8,
    Adjustment = 99
}

public enum BeneficiaryType { InsuranceCompany = 1, Producer = 2, Vendor = 3 }

public enum CampaignStatus { Draft = 1, Sent = 2, Scheduled = 3 }

public enum DeliveryChannel { Email = 1, Courier = 2, InPerson = 3, Portal = 4 }
public enum DeliveryStatus { Pending = 1, InTransit = 2, Delivered = 3, Failed = 4 }

public enum CoverNoteStatus { Active = 1, Converted = 2, Expired = 3, Cancelled = 4 }

public enum ImportStatus { Pending = 1, Running = 2, Completed = 3, Failed = 4 }

public enum DiasPaymentStatus { Pending = 1, Paid = 2, Cancelled = 3 }
