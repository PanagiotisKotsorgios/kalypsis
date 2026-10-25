using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommissionCalculationBases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Value",
                table: "commission_rules",
                type: "decimal(14,4)",
                precision: 14,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,4)",
                oldPrecision: 10,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "ProducerPercent",
                table: "commission_rules",
                type: "decimal(14,4)",
                precision: 14,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "AgencyPercent",
                table: "commission_rules",
                type: "decimal(14,4)",
                precision: 14,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(65,30)",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AgencyCalculationBase",
                table: "commission_rules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IncomingCalculationBase",
                table: "commission_rules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "IncomingPercent",
                table: "commission_rules",
                type: "decimal(8,4)",
                precision: 8,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverCommissionCalculationBase",
                table: "commission_rules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OverCommissionPercent",
                table: "commission_rules",
                type: "decimal(14,4)",
                precision: 14,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProducerCalculationBase",
                table: "commission_rules",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgencyCalculationBase",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "IncomingCalculationBase",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "IncomingPercent",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "OverCommissionCalculationBase",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "OverCommissionPercent",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "ProducerCalculationBase",
                table: "commission_rules");

            migrationBuilder.AlterColumn<decimal>(
                name: "Value",
                table: "commission_rules",
                type: "decimal(10,4)",
                precision: 10,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(14,4)",
                oldPrecision: 14,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "ProducerPercent",
                table: "commission_rules",
                type: "decimal(65,30)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(14,4)",
                oldPrecision: 14,
                oldScale: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "AgencyPercent",
                table: "commission_rules",
                type: "decimal(65,30)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(14,4)",
                oldPrecision: 14,
                oldScale: 4,
                oldNullable: true);
        }
    }
}
