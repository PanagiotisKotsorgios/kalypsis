using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

/// <summary>
/// Adds Policy.CarrierUseCode — the raw «Χρήση οχήματος» token from the
/// carrier's own coding scheme (ERGO "000", ATLANTIC "01", or a
/// Παραμετρικά code like «Ε.Ι.Χ.ΜΟΤ»). Powers the production-list Use
/// filter for tenants whose Παραμετρικά rows don't map onto the strict
/// VehicleUseCategory enum, so filtering works end-to-end without
/// forcing every carrier's codes through Kalypsis' shortlist.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260818200000_AddPolicyCarrierUseCode")]
public partial class AddPolicyCarrierUseCode : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CarrierUseCode",
            table: "policies",
            type: "varchar(64)",
            maxLength: 64,
            nullable: true,
            collation: "utf8mb4_0900_ai_ci");

        migrationBuilder.CreateIndex(
            name: "IX_policies_CarrierUseCode",
            table: "policies",
            column: "CarrierUseCode");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_policies_CarrierUseCode",
            table: "policies");

        migrationBuilder.DropColumn(
            name: "CarrierUseCode",
            table: "policies");
    }
}
