namespace Kalypsis.Domain.Enums;

public enum CommissionType
{
    Percentage = 1,
    FixedAmount = 2
}

public enum CommissionTransactionStatus
{
    Pending = 1,
    Approved = 2,
    Paid = 3,
    Cancelled = 4
}
