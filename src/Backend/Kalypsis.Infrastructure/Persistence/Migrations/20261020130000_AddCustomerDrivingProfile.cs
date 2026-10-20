using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Kalypsis.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261020130000_AddCustomerDrivingProfile")]
public class AddCustomerDrivingProfile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>("HasDrivingLicense", "customers", "tinyint(1)", nullable: true);
        migrationBuilder.AddColumn<bool>("IsDriver", "customers", "tinyint(1)", nullable: true);
        migrationBuilder.AddColumn<bool>("IsNewDriver", "customers", "tinyint(1)", nullable: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("HasDrivingLicense", "customers");
        migrationBuilder.DropColumn("IsDriver", "customers");
        migrationBuilder.DropColumn("IsNewDriver", "customers");
    }
}
