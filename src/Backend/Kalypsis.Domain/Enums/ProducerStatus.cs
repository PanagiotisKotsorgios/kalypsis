namespace Kalypsis.Domain.Enums;

public enum ProducerStatus
{
    Active = 1,
    Suspended = 2,
    Terminated = 3,
    /// <summary>A lead partner that is not yet active in the office.</summary>
    Prospect = 4
}
