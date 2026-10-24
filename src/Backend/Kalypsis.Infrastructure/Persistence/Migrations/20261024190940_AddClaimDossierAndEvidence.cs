using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClaimDossierAndEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Older installations use utf8mb4_unicode_ci GUIDs in claims/Garages,
            // while newer EF schemas use ascii_general_ci. Keep these relationships
            // in the EF model for deletion checks, but omit physical MySQL FKs, as
            // the existing claim_involved_parties bootstrap does. Claim-scoped API
            // writes validate every parent; claims, garages and evidence soft-delete.

            migrationBuilder.AddColumn<string>(
                name: "AssessorEmail",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AssessorName",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AssessorPhone",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CarrierClaimNumber",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CarrierContactName",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CarrierContactPhone",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ClosedDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DamageDescription",
                table: "claims",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "GarageId",
                table: "claims",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<string>(
                name: "IncidentCause",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IncidentCity",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IncidentLocation",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IncidentTime",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "InspectionDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "NextActionDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PoliceInvolved",
                table: "claims",
                type: "tinyint(1)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PoliceReportNumber",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PoliceStation",
                table: "claims",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "RepairCompletedDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "RepairStartedDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ReportedToCarrierDate",
                table: "claims",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "claim_attachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DocumentKind = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FileName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StoragePath = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MimeType = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_claim_attachments", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "claim_kinds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Code = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Name = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BranchCode = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_claim_kinds", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_claims_GarageId",
                table: "claims",
                column: "GarageId");

            migrationBuilder.CreateIndex(
                name: "IX_claim_attachments_ClaimId",
                table: "claim_attachments",
                column: "ClaimId");

            migrationBuilder.CreateIndex(
                name: "IX_claim_attachments_TenantId_ClaimId",
                table: "claim_attachments",
                columns: new[] { "TenantId", "ClaimId" });

            migrationBuilder.CreateIndex(
                name: "IX_claim_kinds_TenantId_Code_BranchCode",
                table: "claim_kinds",
                columns: new[] { "TenantId", "Code", "BranchCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropTable(
                name: "claim_attachments");

            migrationBuilder.DropTable(
                name: "claim_kinds");

            migrationBuilder.DropIndex(
                name: "IX_claims_GarageId",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "AssessorEmail",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "AssessorName",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "AssessorPhone",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "CarrierClaimNumber",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "CarrierContactName",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "CarrierContactPhone",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "ClosedDate",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "DamageDescription",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "GarageId",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IncidentCause",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IncidentCity",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IncidentLocation",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IncidentTime",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "InspectionDate",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "NextActionDate",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "PoliceInvolved",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "PoliceReportNumber",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "PoliceStation",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "RepairCompletedDate",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "RepairStartedDate",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "ReportedToCarrierDate",
                table: "claims");
        }
    }
}
