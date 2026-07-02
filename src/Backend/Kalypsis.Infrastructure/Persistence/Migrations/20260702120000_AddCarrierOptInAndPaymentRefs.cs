using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Two independent changes shipped together for 2026-07-02:
    ///
    ///  1. Receipts + Payments get an optional TransactionReference column
    ///     (POS terminal / Ζ report / cheque / bank tx). Payment additionally
    ///     gets a nullable PolicyId FK so a payment against a specific contract
    ///     can be recorded (mid-term company billing).
    ///
    ///  2. New `tenant_carrier_optins` table — per-tenant opt-in list against
    ///     the universal carrier catalog. When a row exists the tenant sees
    ///     that carrier in Γέφυρες / policy pickers / dashboard filters;
    ///     universal carriers without a row stay in the catalog but are
    ///     hidden from operational surfaces.
    /// </summary>
    [Migration("20260702120000_AddCarrierOptInAndPaymentRefs")]
    public partial class AddCarrierOptInAndPaymentRefs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* ── receipts ──────────────────────────────────────────────── */
            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                table: "receipts",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true,
                collation: "utf8mb4_0900_ai_ci");

            /* ── payments ──────────────────────────────────────────────── */
            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                table: "payments",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true,
                collation: "utf8mb4_0900_ai_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "PolicyId",
                table: "payments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_payments_PolicyId",
                table: "payments",
                column: "PolicyId");

            migrationBuilder.AddForeignKey(
                name: "FK_payments_policies_PolicyId",
                table: "payments",
                column: "PolicyId",
                principalTable: "policies",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            /* ── tenant_carrier_optins ─────────────────────────────────── */
            migrationBuilder.CreateTable(
                name: "tenant_carrier_optins",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    InsuranceCompanyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    EnabledAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_carrier_optins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_tenant_carrier_optins_insurance_companies_InsuranceCompanyId",
                        column: x => x.InsuranceCompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_carrier_optins_InsuranceCompanyId",
                table: "tenant_carrier_optins",
                column: "InsuranceCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_tenant_carrier_optins_TenantId_InsuranceCompanyId",
                table: "tenant_carrier_optins",
                columns: new[] { "TenantId", "InsuranceCompanyId" },
                unique: true,
                filter: "`DeletedAt` IS NULL");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "tenant_carrier_optins");

            migrationBuilder.DropForeignKey(
                name: "FK_payments_policies_PolicyId",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_payments_PolicyId",
                table: "payments");

            migrationBuilder.DropColumn(name: "PolicyId", table: "payments");
            migrationBuilder.DropColumn(name: "TransactionReference", table: "payments");
            migrationBuilder.DropColumn(name: "TransactionReference", table: "receipts");
        }
    }
}
