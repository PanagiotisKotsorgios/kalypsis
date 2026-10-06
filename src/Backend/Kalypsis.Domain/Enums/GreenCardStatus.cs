namespace Kalypsis.Domain.Enums;

/// <summary>Operational lifecycle for a manually issued international motor green card.</summary>
public enum GreenCardStatus
{
    Draft = 1,
    Issued = 2,
    Delivered = 3,
    Expired = 4,
    Cancelled = 5
}
