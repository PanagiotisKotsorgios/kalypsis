using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260807170000_AddDesktopLicensing")]
public partial class AddDesktopLicensing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "desktop_licenses",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                RegistrationCode = table.Column<string>(type: "varchar(24)", maxLength: 24, nullable: false),
                InstallationId = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                ClientTokenHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                CompanyName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                ContactName = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false),
                Email = table.Column<string>(type: "varchar(254)", maxLength: 254, nullable: false),
                Phone = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true),
                AfmVat = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                MachineName = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: true),
                OsVersion = table.Column<string>(type: "varchar(240)", maxLength: 240, nullable: true),
                AppVersion = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true),
                LastSeenAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                AnnualPrice = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                Currency = table.Column<string>(type: "varchar(8)", maxLength: 8, nullable: false),
                AccessStartsAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                AccessExpiresAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                IsBlocked = table.Column<bool>(type: "tinyint(1)", nullable: false),
                BlockReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                AdminNotes = table.Column<string>(type: "longtext", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_desktop_licenses", x => x.Id))
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateTable(
            name: "desktop_license_payments",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                DesktopLicenseId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                Amount = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                Currency = table.Column<string>(type: "varchar(8)", maxLength: 8, nullable: false),
                PaidAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                AccessStartsAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                AccessExpiresAtUtc = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                PaymentMethod = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true),
                Reference = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true),
                Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                RecordedByUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_desktop_license_payments", x => x.Id);
                table.ForeignKey(
                    name: "FK_desktop_license_payments_desktop_licenses_DesktopLicenseId",
                    column: x => x.DesktopLicenseId,
                    principalTable: "desktop_licenses",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            })
            .Annotation("MySql:CharSet", "utf8mb4");

        migrationBuilder.CreateIndex(
            name: "IX_desktop_licenses_InstallationId",
            table: "desktop_licenses",
            column: "InstallationId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_desktop_licenses_RegistrationCode",
            table: "desktop_licenses",
            column: "RegistrationCode",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_desktop_license_payments_DesktopLicenseId_PaidAtUtc",
            table: "desktop_license_payments",
            columns: new[] { "DesktopLicenseId", "PaidAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "desktop_license_payments");
        migrationBuilder.DropTable(name: "desktop_licenses");
    }
}
