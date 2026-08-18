using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

/// <summary>
/// Rounds out the Παραμετρικά filter story started by
/// 20260818200000_AddPolicyCarrierUseCode. Adds three sister columns —
/// CarrierBranchCode, CarrierPackageCode, CarrierCoverageCode — so the
/// production-list Κλάδος / Πακέτο / Κάλυψη filters can target the raw
/// carrier token when the enum / SpecsJson path can't match.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260818201000_AddPolicyCarrierBranchPackageCoverage")]
public partial class AddPolicyCarrierBranchPackageCoverage : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "CarrierBranchCode",
            table: "policies",
            type: "varchar(64)",
            maxLength: 64,
            nullable: true,
            collation: "utf8mb4_0900_ai_ci");

        migrationBuilder.AddColumn<string>(
            name: "CarrierPackageCode",
            table: "policies",
            type: "varchar(120)",
            maxLength: 120,
            nullable: true,
            collation: "utf8mb4_0900_ai_ci");

        migrationBuilder.AddColumn<string>(
            name: "CarrierCoverageCode",
            table: "policies",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true,
            collation: "utf8mb4_0900_ai_ci");

        migrationBuilder.CreateIndex(
            name: "IX_policies_CarrierBranchCode",
            table: "policies",
            column: "CarrierBranchCode");

        migrationBuilder.CreateIndex(
            name: "IX_policies_CarrierPackageCode",
            table: "policies",
            column: "CarrierPackageCode");

        migrationBuilder.CreateIndex(
            name: "IX_policies_CarrierCoverageCode",
            table: "policies",
            column: "CarrierCoverageCode");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_policies_CarrierBranchCode",
            table: "policies");
        migrationBuilder.DropIndex(
            name: "IX_policies_CarrierPackageCode",
            table: "policies");
        migrationBuilder.DropIndex(
            name: "IX_policies_CarrierCoverageCode",
            table: "policies");

        migrationBuilder.DropColumn(
            name: "CarrierBranchCode",
            table: "policies");
        migrationBuilder.DropColumn(
            name: "CarrierPackageCode",
            table: "policies");
        migrationBuilder.DropColumn(
            name: "CarrierCoverageCode",
            table: "policies");
    }
}
