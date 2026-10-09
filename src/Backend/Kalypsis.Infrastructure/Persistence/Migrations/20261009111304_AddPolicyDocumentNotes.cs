using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPolicyDocumentNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "policy_documents",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Notes",
                table: "policy_documents");
        }
    }
}
