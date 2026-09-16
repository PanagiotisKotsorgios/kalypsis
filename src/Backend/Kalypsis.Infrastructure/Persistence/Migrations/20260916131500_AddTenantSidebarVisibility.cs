using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

/// <summary>
/// Stores presentation-only sidebar preferences per office. The default is an
/// empty JSON array, preserving every existing office's navigation exactly.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260916131500_AddTenantSidebarVisibility")]
public partial class AddTenantSidebarVisibility : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "HiddenSidebarItemsJson",
            table: "tenants",
            type: "longtext",
            nullable: false,
            defaultValue: "[]")
            .Annotation("MySql:CharSet", "utf8mb4");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "HiddenSidebarItemsJson",
            table: "tenants");
    }
}
