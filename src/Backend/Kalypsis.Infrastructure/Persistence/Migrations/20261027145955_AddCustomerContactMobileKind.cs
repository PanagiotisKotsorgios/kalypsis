using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerContactMobileKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "customer_contacts",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Other")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MobilePhone",
                table: "customer_contacts",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Kind",
                table: "customer_contacts");

            migrationBuilder.DropColumn(
                name: "MobilePhone",
                table: "customer_contacts");
        }
    }
}
