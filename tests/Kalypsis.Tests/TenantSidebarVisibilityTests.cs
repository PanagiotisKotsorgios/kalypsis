using Kalypsis.Application.Features.Tenants;
using Xunit;

namespace Kalypsis.Tests;

public class TenantSidebarVisibilityTests
{
    [Fact]
    public void Normalize_keeps_sidebar_and_page_container_keys_only()
    {
        var result = TenantSidebarVisibility.Normalize([
            "item:/carrier-bridges-hub",
            "group:production",
            "container:/carrier-bridges-hub/production-bridges",
            "container:/carrier bridges/invalid",
            "unknown:value",
            "container:/carrier-bridges-hub/production-bridges"
        ]);

        Assert.Equal([
            "container:/carrier-bridges-hub/production-bridges",
            "group:production",
            "item:/carrier-bridges-hub"
        ], result);
    }
}
