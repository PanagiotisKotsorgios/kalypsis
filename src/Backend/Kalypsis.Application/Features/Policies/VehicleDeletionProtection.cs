using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Features.Policies;

public static class VehicleDeletionProtection
{
    /// <summary>Vehicles are policy-backed data, not independent entities. Clearing
    /// a plate must not silently detach the vehicle from its insurance history.
    /// The linked policy itself is a blocker, including drafts and expired policies.</summary>
    public static void EnsureCanClearPlate(Policy policy, bool clearing)
    {
        if (!clearing || string.IsNullOrWhiteSpace(policy.VehicleRegistrationPlate)) return;
        DeletionProtection.ThrowIfBlocked(
            $"οχήματος «{policy.VehicleRegistrationPlate}» (συμβόλαιο «{policy.PolicyNumber}»)",
            [new DeletionBlocker("συνδεδεμένα συμβόλαια", 1)]);
    }
}
