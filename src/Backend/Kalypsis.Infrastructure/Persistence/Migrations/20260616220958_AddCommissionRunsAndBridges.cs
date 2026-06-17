using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommissionRunsAndBridges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PermissionsJson",
                table: "users",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "commission_runs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Month = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<int>(type: "int", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    FinalisedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    GeneratedByUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    FilterInsuranceCompanyId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    FilterProducerId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    FilterPolicyType = table.Column<int>(type: "int", nullable: true),
                    FilterPackageCode = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LineCount = table.Column<int>(type: "int", nullable: false),
                    TotalCommission = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    TotalPremium = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false, defaultValue: "EUR")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_runs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_commission_runs_insurance_companies_FilterInsuranceCompanyId",
                        column: x => x.FilterInsuranceCompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_commission_runs_producers_FilterProducerId",
                        column: x => x.FilterProducerId,
                        principalTable: "producers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_commission_runs_users_GeneratedByUserId",
                        column: x => x.GeneratedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "company_bridges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    InsuranceCompanyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    ConfigJson = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    AutoSync = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    LastSyncRows = table.Column<int>(type: "int", nullable: false),
                    LastSyncStatus = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_bridges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_company_bridges_insurance_companies_InsuranceCompanyId",
                        column: x => x.InsuranceCompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "commission_run_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CommissionRunId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PolicyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProducerId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    InsuranceCompanyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PolicyType = table.Column<int>(type: "int", nullable: false),
                    PackageCode = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Premium = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    RatePercent = table.Column<decimal>(type: "decimal(8,4)", precision: 8, scale: 4, nullable: false),
                    CommissionAmount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: false),
                    IsOverridden = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    OriginalCommissionAmount = table.Column<decimal>(type: "decimal(14,2)", precision: 14, scale: 2, nullable: true),
                    OverrideReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false, defaultValue: "EUR")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_run_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_commission_run_lines_commission_runs_CommissionRunId",
                        column: x => x.CommissionRunId,
                        principalTable: "commission_runs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_commission_run_lines_insurance_companies_InsuranceCompanyId",
                        column: x => x.InsuranceCompanyId,
                        principalTable: "insurance_companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_commission_run_lines_policies_PolicyId",
                        column: x => x.PolicyId,
                        principalTable: "policies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_commission_run_lines_producers_ProducerId",
                        column: x => x.ProducerId,
                        principalTable: "producers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_CommissionRunId",
                table: "commission_run_lines",
                column: "CommissionRunId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_InsuranceCompanyId",
                table: "commission_run_lines",
                column: "InsuranceCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_PolicyId",
                table: "commission_run_lines",
                column: "PolicyId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_ProducerId",
                table: "commission_run_lines",
                column: "ProducerId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_TenantId_CommissionRunId_ProducerId",
                table: "commission_run_lines",
                columns: new[] { "TenantId", "CommissionRunId", "ProducerId" });

            migrationBuilder.CreateIndex(
                name: "IX_commission_runs_FilterInsuranceCompanyId",
                table: "commission_runs",
                column: "FilterInsuranceCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_runs_FilterProducerId",
                table: "commission_runs",
                column: "FilterProducerId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_runs_GeneratedByUserId",
                table: "commission_runs",
                column: "GeneratedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_commission_runs_TenantId_Year_Month",
                table: "commission_runs",
                columns: new[] { "TenantId", "Year", "Month" });

            migrationBuilder.CreateIndex(
                name: "IX_company_bridges_InsuranceCompanyId",
                table: "company_bridges",
                column: "InsuranceCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_company_bridges_TenantId_InsuranceCompanyId",
                table: "company_bridges",
                columns: new[] { "TenantId", "InsuranceCompanyId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "commission_run_lines");

            migrationBuilder.DropTable(
                name: "company_bridges");

            migrationBuilder.DropTable(
                name: "commission_runs");

            migrationBuilder.DropColumn(
                name: "PermissionsJson",
                table: "users");
        }
    }
}
