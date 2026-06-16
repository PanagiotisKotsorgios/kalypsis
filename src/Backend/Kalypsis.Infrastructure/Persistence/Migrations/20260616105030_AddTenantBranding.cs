using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AddressLine",
                table: "tenants",
                type: "varchar(300)",
                maxLength: 300,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BrandColorHex",
                table: "tenants",
                type: "varchar(16)",
                maxLength: 16,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "tenants",
                type: "varchar(256)",
                maxLength: 256,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "tenants",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DefaultCurrency",
                table: "tenants",
                type: "varchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "EUR")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "DefaultPolicyDurationMonths",
                table: "tenants",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "tenants",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "VatNumber",
                table: "tenants",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddressLine",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "BrandColorHex",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "DefaultCurrency",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "DefaultPolicyDurationMonths",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "VatNumber",
                table: "tenants");
        }
    }
}
