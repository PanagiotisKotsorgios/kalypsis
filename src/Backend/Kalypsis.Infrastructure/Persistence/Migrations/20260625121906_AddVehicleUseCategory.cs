using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleUseCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "VehicleUseCategory",
                table: "policies",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VehicleUseCategory",
                table: "commission_rules",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VehicleUseCategory",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "VehicleUseCategory",
                table: "commission_rules");
        }
    }
}
