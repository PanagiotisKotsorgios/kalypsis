using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSyncedCustomerAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "customer_assets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    VehicleSpecsJson = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    FamilyMemberId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    AssetKind = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Address = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    City = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PostalCode = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Country = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Plate = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Brand = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Model = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    YearOfConstruction = table.Column<int>(type: "int", nullable: true),
                    EngineCc = table.Column<int>(type: "int", nullable: true),
                    Vin = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ChassisNumber = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FuelType = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Transmission = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Color = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LicenseCountry = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    VehicleUse = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    InsuranceClass = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TaxableHorsepower = table.Column<int>(type: "int", nullable: true),
                    DoorCount = table.Column<int>(type: "int", nullable: true),
                    SeatCount = table.Column<int>(type: "int", nullable: true),
                    OwnerCount = table.Column<int>(type: "int", nullable: true),
                    EstimatedValue = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    FirstLicenseDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    PurchaseDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    WasPurchasedNew = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    IsYoungDriver = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    HasSunroof = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    HasAlarm = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    HasImmobilizer = table.Column<bool>(type: "tinyint(1)", nullable: true),
                    Value = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    AreaSquareMeters = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    ConstructionYear = table.Column<int>(type: "int", nullable: true),
                    ConstructionType = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BusinessActivity = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Kad = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EmployeeCount = table.Column<int>(type: "int", nullable: true),
                    IsInsuredWithUs = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CurrentCarrierName = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CurrentPolicyExpiresOn = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    InterestScore = table.Column<int>(type: "int", nullable: true),
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
                    table.PrimaryKey("PK_customer_assets", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_customer_assets_TenantId_CustomerId",
                table: "customer_assets",
                columns: new[] { "TenantId", "CustomerId" });

            migrationBuilder.CreateIndex(
                name: "IX_customer_assets_TenantId_FamilyMemberId",
                table: "customer_assets",
                columns: new[] { "TenantId", "FamilyMemberId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer_assets");
        }
    }
}
