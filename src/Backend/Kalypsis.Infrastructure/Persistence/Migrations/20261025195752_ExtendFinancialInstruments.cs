using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExtendFinancialInstruments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "securities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci",
                oldClrType: typeof(Guid),
                oldType: "char(36)")
                .OldAnnotation("Relational:Collation", "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "BankAccount",
                table: "securities",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "securities",
                type: "longtext",
                nullable: false,
                defaultValue: "Incoming")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DrawerName",
                table: "securities",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EndorserName",
                table: "securities",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "HolderName",
                table: "securities",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "PartyId",
                table: "securities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "PartyKind",
                table: "securities",
                type: "longtext",
                nullable: false,
                defaultValue: "Customer")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PartyName",
                table: "securities",
                type: "longtext",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PlaceOfIssue",
                table: "securities",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "PolicyId",
                table: "securities",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<decimal>(
                name: "SettledAmount",
                table: "securities",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "SecurityEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SecurityId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Kind = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OccurredOn = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    Counterparty = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReversesEventId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Notes = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SecurityEvents_securities_SecurityId",
                        column: x => x.SecurityId,
                        principalTable: "securities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_securities_PolicyId",
                table: "securities",
                column: "PolicyId");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityEvents_SecurityId",
                table: "SecurityEvents",
                column: "SecurityId");

            migrationBuilder.AddForeignKey(
                name: "FK_securities_policies_PolicyId",
                table: "securities",
                column: "PolicyId",
                principalTable: "policies",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_securities_policies_PolicyId",
                table: "securities");

            migrationBuilder.DropTable(
                name: "SecurityEvents");

            migrationBuilder.DropIndex(
                name: "IX_securities_PolicyId",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "BankAccount",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "Direction",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "DrawerName",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "EndorserName",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "HolderName",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "PartyId",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "PartyKind",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "PartyName",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "PlaceOfIssue",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "PolicyId",
                table: "securities");

            migrationBuilder.DropColumn(
                name: "SettledAmount",
                table: "securities");

            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "securities",
                type: "char(36)",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                collation: "ascii_general_ci",
                oldClrType: typeof(Guid),
                oldType: "char(36)",
                oldNullable: true)
                .OldAnnotation("Relational:Collation", "ascii_general_ci");
        }
    }
}
