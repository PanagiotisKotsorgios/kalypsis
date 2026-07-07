namespace Kalypsis.Domain.Enums;

/// <summary>
/// Position of a producer within the agency's commission hierarchy. Matches
/// ALIS's F9 «Προμήθειες» matrix, which pays every level in the chain — the
/// end sales agent (Producer), then their supervisor (Manager), unit lead
/// (Unit), team assistant (Assistant), and finally the agency house cut
/// (Agency).
///
/// A flat brokerage where the agency owner writes their own policies just
/// uses <see cref="Producer"/> and <see cref="Agency"/> — Manager/Unit/
/// Assistant stay unpopulated and the calculator skips them.
/// </summary>
public enum HierarchyLevel
{
    Producer  = 1,
    Manager   = 2,
    Unit      = 3,
    Assistant = 4,
    Agency    = 5
}
