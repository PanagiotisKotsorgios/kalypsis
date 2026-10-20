using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Kalypsis.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261020120000_AddCustomerAdditionalCommunicationChannels")]
public class AddCustomerAdditionalCommunicationChannels : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("ThirdPhone", "customers", "varchar(40)", maxLength: 40, nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>("SecondaryMobilePhone", "customers", "varchar(40)", maxLength: 40, nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.AddColumn<string>("SecondaryEmail", "customers", "varchar(256)", maxLength: 256, nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("ThirdPhone", "customers");
        migrationBuilder.DropColumn("SecondaryMobilePhone", "customers");
        migrationBuilder.DropColumn("SecondaryEmail", "customers");
    }
}
