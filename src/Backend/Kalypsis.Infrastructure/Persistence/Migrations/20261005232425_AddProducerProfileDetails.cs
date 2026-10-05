using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProducerProfileDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdditionalInfoJson",
                table: "producers",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "producers",
                type: "varchar(240)",
                maxLength: 240,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "producers",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "BusinessType",
                table: "producers",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "producers",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ContractEndDate",
                table: "producers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContractNumber",
                table: "producers",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ContractStartDate",
                table: "producers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasContract",
                table: "producers",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Iban",
                table: "producers",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "IdentityNumber",
                table: "producers",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "LicenseExpiryDate",
                table: "producers",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "producers",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PostalCode",
                table: "producers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ProfessionalCategory",
                table: "producers",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ProfessionalLicenseNumber",
                table: "producers",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryEmail",
                table: "producers",
                type: "varchar(256)",
                maxLength: 256,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecondaryPhone",
                table: "producers",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TaxId",
                table: "producers",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TaxOffice",
                table: "producers",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "producers",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdditionalInfoJson",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "BusinessType",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "City",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "ContractEndDate",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "ContractNumber",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "ContractStartDate",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "HasContract",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "Iban",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "IdentityNumber",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "LicenseExpiryDate",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "PostalCode",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "ProfessionalCategory",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "ProfessionalLicenseNumber",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "SecondaryEmail",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "SecondaryPhone",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "TaxId",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "TaxOffice",
                table: "producers");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "producers");
        }
    }
}
