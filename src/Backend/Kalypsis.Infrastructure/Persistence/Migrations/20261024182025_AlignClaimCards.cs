using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AlignClaimCards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "claims",
                type: "varchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "EUR")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "claims",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "VehicleDamage")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("UPDATE claims c JOIN policies p ON c.PolicyId=p.Id SET c.Currency=p.Currency WHERE p.Currency IS NOT NULL AND p.Currency<>'';");

            migrationBuilder.AddColumn<decimal>(
                name: "SettledAmount",
                table: "claims",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "claim_involved_parties",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "AtFault",
                table: "claim_involved_parties",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ClaimedAmount",
                table: "claim_involved_parties",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IdNumber",
                table: "claim_involved_parties",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Currency",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "SettledAmount",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "claim_involved_parties");

            migrationBuilder.DropColumn(
                name: "AtFault",
                table: "claim_involved_parties");

            migrationBuilder.DropColumn(
                name: "ClaimedAmount",
                table: "claim_involved_parties");

            migrationBuilder.DropColumn(
                name: "IdNumber",
                table: "claim_involved_parties");
        }
    }
}
