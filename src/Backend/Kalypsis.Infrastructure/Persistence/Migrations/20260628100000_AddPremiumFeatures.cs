using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Adds a JSON column to TenantPackageGrants to hold the list of premium
    /// feature codes unlocked WITHIN that package for the tenant. See
    /// PremiumFeatureCodes in the application layer for the well-known values.
    /// </summary>
    [Migration("20260628100000_AddPremiumFeatures")]
    public partial class AddPremiumFeatures : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PremiumFeaturesJson",
                table: "TenantPackageGrants",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PremiumFeaturesJson",
                table: "TenantPackageGrants");
        }
    }
}
