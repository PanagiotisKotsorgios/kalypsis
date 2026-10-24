using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UnifyProducerCards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "EffectiveFrom",
                table: "producer_expected_rates",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "EffectiveTo",
                table: "producer_expected_rates",
                type: "date",
                nullable: true);

            // Match the claim dossier migrations: older producer GUID columns use
            // different collations. Parent/tenant ownership is enforced by the API;
            // soft deletes retain records. Avoid a physical FK that blocks upgrades.
            migrationBuilder.CreateTable(
                name: "producer_card_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProducerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Kind = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DataJson = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_producer_card_entries", x => x.Id);

                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_producer_card_entries_ProducerId",
                table: "producer_card_entries",
                column: "ProducerId");

            migrationBuilder.CreateIndex(
                name: "IX_producer_card_entries_TenantId_ProducerId_Kind",
                table: "producer_card_entries",
                columns: new[] { "TenantId", "ProducerId", "Kind" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "producer_card_entries");

            migrationBuilder.DropColumn(
                name: "EffectiveFrom",
                table: "producer_expected_rates");

            migrationBuilder.DropColumn(
                name: "EffectiveTo",
                table: "producer_expected_rates");
        }
    }
}
