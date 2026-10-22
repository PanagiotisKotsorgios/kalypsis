using Kalypsis.Application.Features.Tenants;
using Xunit;

namespace Kalypsis.Tests;

public class TenantSidebarVisibilityTests
{
    [Fact]
    public void Affiliate_button_can_be_hidden_and_restored_without_changing_other_office_preferences()
    {
        const string key = "item:/affiliate-program";
        var hidden = TenantSidebarVisibility.Parse(TenantSidebarVisibility.Serialize([key, "item:/customers"]));
        Assert.Contains(key, hidden);
        Assert.Contains("item:/customers", hidden);
        var restored = TenantSidebarVisibility.Parse(TenantSidebarVisibility.Serialize(hidden.Where(item => item != key)));
        Assert.DoesNotContain(key, restored);
        Assert.Equal(["item:/customers"], restored);
        Assert.Empty(TenantSidebarVisibility.Parse(null));
    }

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

    [Fact]
    public void Normalize_keeps_bridge_visibility_keys_for_admin_configuration()
    {
        var result = TenantSidebarVisibility.Normalize([
            "item:/carrier-bridges",
            "item:/collection-files-bridges",
            "item:/bridge-code-mappings",
            "group:financials"
        ]);

        Assert.Contains("item:/carrier-bridges", result);
        Assert.Contains("item:/collection-files-bridges", result);
        Assert.Contains("item:/bridge-code-mappings", result);
        Assert.Contains("group:financials", result);
    }
}
