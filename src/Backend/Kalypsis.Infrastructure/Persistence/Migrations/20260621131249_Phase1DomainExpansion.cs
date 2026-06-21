using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase1DomainExpansion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedLoginAttempts",
                table: "users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockedUntil",
                table: "users",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentFrequency",
                table: "policies",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "PremiumIncludesVat",
                table: "policies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SpecsJson",
                table: "policies",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AltPhone",
                table: "customers",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Amka",
                table: "customers",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "AnonymizedAt",
                table: "customers",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AssignedAdvisorId",
                table: "customers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "Employer",
                table: "customers",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GemiNumber",
                table: "customers",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "customers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IdNumber",
                table: "customers",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LegalForm",
                table: "customers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MaritalStatus",
                table: "customers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MobilePhone",
                table: "customers",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                table: "customers",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PassportNumber",
                table: "customers",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                table: "customers",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Region",
                table: "customers",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "customers",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "customers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TagsJson",
                table: "customers",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TaxOffice",
                table: "customers",
                type: "varchar(60)",
                maxLength: 60,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "communication_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Direction = table.Column<int>(type: "int", nullable: false),
                    Outcome = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    Subject = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Body = table.Column<string>(type: "varchar(4000)", maxLength: 4000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RelatedPolicyNumber = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RelatedPolicyId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_communication_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_communication_logs_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_communication_logs_policies_RelatedPolicyId",
                        column: x => x.RelatedPolicyId,
                        principalTable: "policies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_communication_logs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "consent_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Granted = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Method = table.Column<int>(type: "int", nullable: false),
                    IpAddress = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_consent_records", x => x.Id);
                    table.ForeignKey(
                        name: "FK_consent_records_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_customers_AssignedAdvisorId",
                table: "customers",
                column: "AssignedAdvisorId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_TenantId_Status",
                table: "customers",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_communication_logs_CustomerId",
                table: "communication_logs",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_communication_logs_RelatedPolicyId",
                table: "communication_logs",
                column: "RelatedPolicyId");

            migrationBuilder.CreateIndex(
                name: "IX_communication_logs_TenantId_CustomerId_OccurredAt",
                table: "communication_logs",
                columns: new[] { "TenantId", "CustomerId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_communication_logs_UserId",
                table: "communication_logs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_records_CustomerId",
                table: "consent_records",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_consent_records_TenantId_CustomerId_Type",
                table: "consent_records",
                columns: new[] { "TenantId", "CustomerId", "Type" });

            migrationBuilder.AddForeignKey(
                name: "FK_customers_users_AssignedAdvisorId",
                table: "customers",
                column: "AssignedAdvisorId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_customers_users_AssignedAdvisorId",
                table: "customers");

            migrationBuilder.DropTable(
                name: "communication_logs");

            migrationBuilder.DropTable(
                name: "consent_records");

            migrationBuilder.DropIndex(
                name: "IX_customers_AssignedAdvisorId",
                table: "customers");

            migrationBuilder.DropIndex(
                name: "IX_customers_TenantId_Status",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "FailedLoginAttempts",
                table: "users");

            migrationBuilder.DropColumn(
                name: "LockedUntil",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PaymentFrequency",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "PremiumIncludesVat",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "SpecsJson",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "AltPhone",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Amka",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "AnonymizedAt",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "AssignedAdvisorId",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Employer",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "GemiNumber",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "IdNumber",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "LegalForm",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "MaritalStatus",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "MobilePhone",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Occupation",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "PassportNumber",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Region",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TagsJson",
                table: "customers");

            migrationBuilder.DropColumn(
                name: "TaxOffice",
                table: "customers");
        }
    }
}
