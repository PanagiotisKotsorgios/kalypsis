using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCreditControlRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NewValuesJson",
                table: "SecurityEvents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "PaymentId",
                table: "SecurityEvents",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "PreviousValuesJson",
                table: "SecurityEvents",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "ReceiptId",
                table: "SecurityEvents",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "CreditControlRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    InsuranceCompanyId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    PolicyType = table.Column<int>(type: "int", nullable: true),
                    Currency = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MaximumOutstanding = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    MaximumOverdueDays = table.Column<int>(type: "int", nullable: true),
                    MaximumOpenPolicies = table.Column<int>(type: "int", nullable: true),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    IsException = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
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
                    table.PrimaryKey("PK_CreditControlRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CreditControlRules_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CreditControlRules_insurance_companies_InsuranceCompanyId",
                        column: x => x.InsuranceCompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id");
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CreditControlRules_CustomerId",
                table: "CreditControlRules",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CreditControlRules_InsuranceCompanyId",
                table: "CreditControlRules",
                column: "InsuranceCompanyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CreditControlRules");

            migrationBuilder.DropColumn(
                name: "NewValuesJson",
                table: "SecurityEvents");

            migrationBuilder.DropColumn(
                name: "PaymentId",
                table: "SecurityEvents");

            migrationBuilder.DropColumn(
                name: "PreviousValuesJson",
                table: "SecurityEvents");

            migrationBuilder.DropColumn(
                name: "ReceiptId",
                table: "SecurityEvents");
        }
    }
}
