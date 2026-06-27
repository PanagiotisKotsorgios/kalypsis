namespace Kalypsis.Domain.Enums;

/// <summary>
/// Platform-wide carrier parameter taxonomy. These rows are maintained by the
/// superadmin once and inherited by every agency through the carrier code.
/// </summary>
public enum CompanyParameterItemKind
{
    Branch = 1,
    Coverage = 2,
    Use = 3,
    Package = 4,
    BridgeCode = 5,
    Field = 6,
    Other = 99
}
