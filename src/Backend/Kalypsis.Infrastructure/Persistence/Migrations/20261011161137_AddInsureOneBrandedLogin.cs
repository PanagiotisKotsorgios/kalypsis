using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInsureOneBrandedLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LoginBackgroundPath",
                table: "insureone_office_settings",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LoginSecurityText",
                table: "insureone_office_settings",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LoginSubtitle",
                table: "insureone_office_settings",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LoginSupportLabel",
                table: "insureone_office_settings",
                type: "varchar(180)",
                maxLength: 180,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LoginTitle",
                table: "insureone_office_settings",
                type: "varchar(180)",
                maxLength: 180,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoginBackgroundPath",
                table: "insureone_office_settings");

            migrationBuilder.DropColumn(
                name: "LoginSecurityText",
                table: "insureone_office_settings");

            migrationBuilder.DropColumn(
                name: "LoginSubtitle",
                table: "insureone_office_settings");

            migrationBuilder.DropColumn(
                name: "LoginSupportLabel",
                table: "insureone_office_settings");

            migrationBuilder.DropColumn(
                name: "LoginTitle",
                table: "insureone_office_settings");
        }
    }
}
