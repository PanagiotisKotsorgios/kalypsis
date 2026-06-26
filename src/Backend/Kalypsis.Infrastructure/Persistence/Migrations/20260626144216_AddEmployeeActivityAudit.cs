using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeActivityAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "audit_logs",
                type: "varchar(48)",
                maxLength: 48,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Metadata",
                table: "audit_logs",
                type: "text",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PagePath",
                table: "audit_logs",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Target",
                table: "audit_logs",
                type: "varchar(256)",
                maxLength: 256,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_TenantId_Category_CreatedAt",
                table: "audit_logs",
                columns: new[] { "TenantId", "Category", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_TenantId_UserId_CreatedAt",
                table: "audit_logs",
                columns: new[] { "TenantId", "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_audit_logs_TenantId_Category_CreatedAt",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_TenantId_UserId_CreatedAt",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Metadata",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "PagePath",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Target",
                table: "audit_logs");
        }
    }
}
