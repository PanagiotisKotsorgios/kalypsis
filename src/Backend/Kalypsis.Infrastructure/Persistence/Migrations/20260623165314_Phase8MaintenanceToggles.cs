using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase8MaintenanceToggles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LaunchGateEnabled",
                table: "platform_settings",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LaunchGateMessage",
                table: "platform_settings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LaunchGateTitle",
                table: "platform_settings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceMessage",
                table: "platform_settings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "MaintenanceModeEnabled",
                table: "platform_settings",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MaintenanceTitle",
                table: "platform_settings",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LaunchGateEnabled",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "LaunchGateMessage",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "LaunchGateTitle",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "MaintenanceMessage",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "MaintenanceModeEnabled",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "MaintenanceTitle",
                table: "platform_settings");
        }
    }
}
