namespace Kalypsis.Domain.Enums;

public enum CarrierAdapterStatus { Disabled = 0, Enabled = 1, Sandbox = 2 }
public enum QuoteStatus { Draft = 1, Submitted = 2, Quoted = 3, Bound = 4, Expired = 5, Rejected = 6 }
public enum CarrierOperation { Quote = 1, IssuePolicy = 2, RenewPolicy = 3, CancelPolicy = 4, FetchDocuments = 5 }
public enum InstallmentStatus { Scheduled = 1, Due = 2, Paid = 3, PartiallyPaid = 4, Overdue = 5, Waived = 6 }
public enum BankStatementMatchStatus { Unmatched = 0, Matched = 1, Ambiguous = 2, Ignored = 3 }
public enum MyDataInvoiceStatus { Draft = 1, Submitted = 2, Accepted = 3, Cancelled = 4, Failed = 5 }
public enum WorkflowEvent {
    CustomerCreated = 1, PolicyIssued = 2, PolicyAboutToExpire = 3, PolicyExpired = 4,
    PolicyCancelled = 5, InstallmentDue = 6, InstallmentOverdue = 7, ClaimReported = 8,
    PaymentReceived = 9, RequestSubmitted = 10, RequestResolved = 11, ConsentRevoked = 12
}
public enum WorkflowAction {
    SendEmail = 1, SendSms = 2, CreateTask = 3, CreateNotification = 4, CreateRequest = 5,
    AssignAdvisor = 6, TagCustomer = 7, ChangePolicyStatus = 8, Webhook = 9
}
public enum MailboxProvider { Gmail = 1, Outlook = 2, Imap = 3 }
public enum CallDirection { Inbound = 1, Outbound = 2 }
public enum CallStatus { Ringing = 1, Answered = 2, Missed = 3, Voicemail = 4, Ended = 5 }
public enum SubscriptionState { Trial = 1, Active = 2, PastDue = 3, Cancelled = 4, Expired = 5 }
public enum ReportEntity { Customers = 1, Policies = 2, Claims = 3, Commissions = 4, Requests = 5, Documents = 6, Communications = 7 }
public enum AiTaskType { ExtractPolicyPdf = 1, DraftEmail = 2, DraftSms = 3, ChurnScore = 4, PortfolioSummary = 5, SemanticSearch = 6, NextBestAction = 7 }

// Phase 4 — Datawise parity
public enum CoverageTier { Basic = 1, FireTheft = 2, Mixed = 3, Comprehensive = 4 }
public enum ApplicationStatus { Draft = 1, Submitted = 2, SentToCarrier = 3, Pending = 4, Issued = 5, Rejected = 6, Cancelled = 7 }
public enum PlafondRegime { TypoPlirono = 1, PlironoTypono = 2, Koumparas = 3 }
public enum PaymentNoticeKind { D = 1, F = 2, R = 3, W = 4 }
public enum PaymentNoticeStatus { Open = 1, Paid = 2, Cancelled = 3, Expired = 4 }
public enum CarrierOrderStatus { Submitted = 1, InProgress = 2, Completed = 3, Cancelled = 4 }
public enum OnlinePaymentGatewayType { EposPiraeus = 1, EposNbg = 2, EposAlpha = 3, EposEurobank = 4, Epay = 5, Dias = 6, VivaWallet = 7, StripeCard = 8 }
public enum OnlinePaymentSessionStatus { Created = 1, Authorized = 2, Captured = 3, Failed = 4, Refunded = 5, Expired = 6 }
public enum MessagingChannel { Email = 1, Sms = 2, Viber = 3 }
public enum BackofficeBridge { BlueByte = 1, Alis = 2, OneSoft = 3 }

// Phase 5 — Modular packaging.
// The superadmin assigns one or more packages per tenant; nav + endpoints
// gate themselves on the assigned set. See PricingPage.tsx for the
// customer-facing description of each package.
public enum PackageCode
{
    /// <summary>Customers, policies, cashier, commissions, accounting exports — replaces a legacy ALIS-style back-office.</summary>
    BackOffice = 1,
    /// <summary>Multi-carrier quoting, risk profiles, issuance, plafond, carrier orders — replaces a WebInsurer-style front-office.</summary>
    FrontOffice = 2,
    /// <summary>Customer portal, mobile app, requests, appointments, marketing, messaging.</summary>
    Crm = 3,
    /// <summary>Reports/report-builder, goals, audit logs, AI assistants, workflows.</summary>
    Intelligence = 4,
    /// <summary>myDATA, online payments, telephony, mailbox sync, multi-branch, backoffice bridges.</summary>
    Integrations = 5
}
