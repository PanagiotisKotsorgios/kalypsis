namespace Kalypsis.Domain.Enums;

/// <summary>Financial basis used by a commission rate or fixed amount.</summary>
public enum CommissionCalculationBase
{
    GrossPremium = 1,
    NetPremium = 2,
    IncomingCommission = 3,
    FixedAmount = 4
}
