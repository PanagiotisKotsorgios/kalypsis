using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase12BluByteParity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DeliveredAt",
                table: "policies",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveredTo",
                table: "policies",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryMethod",
                table: "policies",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "NextRenewalDate",
                table: "policies",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RenewalInstructions",
                table: "policies",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "RenewalTransferToCarrierId",
                table: "policies",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "RenewalTransferToProducerId",
                table: "policies",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<bool>(
                name: "RetainCommissionsOnRenewal",
                table: "policies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RetainDocumentNumberOnRenewal",
                table: "policies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RetainSpecialCommissionsOnRenewal",
                table: "policies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "SpecialCommissionPercent",
                table: "policies",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AffectsBonusMalus",
                table: "claims",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsFriendlySettlement",
                table: "claims",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsInternalDamage",
                table: "claims",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LiabilityPercent",
                table: "claims",
                type: "decimal(65,30)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UsaeCode",
                table: "claims",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "UsaeKind",
                table: "claims",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "UsaeReceiptCode",
                table: "claims",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "UsaeSentAt",
                table: "claims",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UsaeStatus",
                table: "claims",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CallerIdLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ReceivedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    CallerNumber = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MatchedCustomerId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    MatchedCustomerName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Direction = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    Answered = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HandledByUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CallerIdLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CallerIdLogs_customers_MatchedCustomerId",
                        column: x => x.MatchedCustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CallerIdLogs_users_HandledByUserId",
                        column: x => x.HandledByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "FriendlySettlements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SettlementFileNumber = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DeclarationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SettlementAuthority = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SettlementDate = table.Column<DateOnly>(type: "date", nullable: true),
                    AgreedAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    VatAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    FeeAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    InterestAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OtherPartyInsurer = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OtherPartyPolicy = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AppraisorName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AppraisalDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendlySettlements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FriendlySettlements_claims_ClaimId",
                        column: x => x.ClaimId,
                        principalTable: "claims",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "UsaeSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    SubmissionNumber = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SubmittedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AcknowledgementCode = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ErrorMessage = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PayloadJson = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsaeSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsaeSubmissions_claims_ClaimId",
                        column: x => x.ClaimId,
                        principalTable: "claims",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "VehicleModels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Manufacturer = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Model = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Trim = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EngineCc = table.Column<int>(type: "int", nullable: true),
                    HorsePower = table.Column<int>(type: "int", nullable: true),
                    FuelType = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Category = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleModels", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ClaimVictims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FriendlySettlementId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    FullName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Afm = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Phone = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Address = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    VictimType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    VehiclePlate = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ReserveAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    PaidAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClaimVictims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClaimVictims_FriendlySettlements_FriendlySettlementId",
                        column: x => x.FriendlySettlementId,
                        principalTable: "FriendlySettlements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ClaimVictims_claims_ClaimId",
                        column: x => x.ClaimId,
                        principalTable: "claims",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "SettlementPayments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ClaimVictimId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: false),
                    PayeeType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PayeeName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    GarageId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    NetAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    VatAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    FeeAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PaymentMethod = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Reference = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
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
                    table.PrimaryKey("PK_SettlementPayments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SettlementPayments_ClaimVictims_ClaimVictimId",
                        column: x => x.ClaimVictimId,
                        principalTable: "ClaimVictims",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CallerIdLogs_HandledByUserId",
                table: "CallerIdLogs",
                column: "HandledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CallerIdLogs_MatchedCustomerId",
                table: "CallerIdLogs",
                column: "MatchedCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CallerIdLogs_TenantId_CallerNumber",
                table: "CallerIdLogs",
                columns: new[] { "TenantId", "CallerNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_CallerIdLogs_TenantId_ReceivedAt",
                table: "CallerIdLogs",
                columns: new[] { "TenantId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ClaimVictims_ClaimId",
                table: "ClaimVictims",
                column: "ClaimId");

            migrationBuilder.CreateIndex(
                name: "IX_ClaimVictims_FriendlySettlementId",
                table: "ClaimVictims",
                column: "FriendlySettlementId");

            migrationBuilder.CreateIndex(
                name: "IX_ClaimVictims_TenantId_ClaimId",
                table: "ClaimVictims",
                columns: new[] { "TenantId", "ClaimId" });

            migrationBuilder.CreateIndex(
                name: "IX_FriendlySettlements_ClaimId",
                table: "FriendlySettlements",
                column: "ClaimId");

            migrationBuilder.CreateIndex(
                name: "IX_FriendlySettlements_TenantId_ClaimId",
                table: "FriendlySettlements",
                columns: new[] { "TenantId", "ClaimId" });

            migrationBuilder.CreateIndex(
                name: "IX_FriendlySettlements_TenantId_SettlementFileNumber",
                table: "FriendlySettlements",
                columns: new[] { "TenantId", "SettlementFileNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SettlementPayments_ClaimVictimId",
                table: "SettlementPayments",
                column: "ClaimVictimId");

            migrationBuilder.CreateIndex(
                name: "IX_SettlementPayments_TenantId_ClaimVictimId",
                table: "SettlementPayments",
                columns: new[] { "TenantId", "ClaimVictimId" });

            migrationBuilder.CreateIndex(
                name: "IX_UsaeSubmissions_ClaimId",
                table: "UsaeSubmissions",
                column: "ClaimId");

            migrationBuilder.CreateIndex(
                name: "IX_UsaeSubmissions_TenantId_ClaimId",
                table: "UsaeSubmissions",
                columns: new[] { "TenantId", "ClaimId" });

            migrationBuilder.CreateIndex(
                name: "IX_UsaeSubmissions_TenantId_SubmissionNumber",
                table: "UsaeSubmissions",
                columns: new[] { "TenantId", "SubmissionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VehicleModels_TenantId_Manufacturer_Model",
                table: "VehicleModels",
                columns: new[] { "TenantId", "Manufacturer", "Model" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CallerIdLogs");

            migrationBuilder.DropTable(
                name: "SettlementPayments");

            migrationBuilder.DropTable(
                name: "UsaeSubmissions");

            migrationBuilder.DropTable(
                name: "VehicleModels");

            migrationBuilder.DropTable(
                name: "ClaimVictims");

            migrationBuilder.DropTable(
                name: "FriendlySettlements");

            migrationBuilder.DropColumn(
                name: "DeliveredAt",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "DeliveredTo",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "DeliveryMethod",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "NextRenewalDate",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RenewalInstructions",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RenewalTransferToCarrierId",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RenewalTransferToProducerId",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RetainCommissionsOnRenewal",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RetainDocumentNumberOnRenewal",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "RetainSpecialCommissionsOnRenewal",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "SpecialCommissionPercent",
                table: "policies");

            migrationBuilder.DropColumn(
                name: "AffectsBonusMalus",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IsFriendlySettlement",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "IsInternalDamage",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "LiabilityPercent",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "UsaeCode",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "UsaeKind",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "UsaeReceiptCode",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "UsaeSentAt",
                table: "claims");

            migrationBuilder.DropColumn(
                name: "UsaeStatus",
                table: "claims");
        }
    }
}
