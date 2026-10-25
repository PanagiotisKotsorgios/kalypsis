using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProducerPaymentWithholding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GrossCommissionAmount",
                table: "payments",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ProducerWithholdingAmount",
                table: "payments",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ProducerWithholdingPercent",
                table: "payments",
                type: "decimal(65,30)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GrossCommissionAmount",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "ProducerWithholdingAmount",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "ProducerWithholdingPercent",
                table: "payments");
        }
    }
}
