using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProducerTierAndCommissionRuleSplit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "producers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "AgencyPercent",
                table: "commission_rules",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProducerPercent",
                table: "commission_rules",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProducerTier",
                table: "commission_rules",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Tier",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "AgencyPercent",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "ProducerPercent",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "ProducerTier",
                table: "commission_rules");
        }
    }
}
