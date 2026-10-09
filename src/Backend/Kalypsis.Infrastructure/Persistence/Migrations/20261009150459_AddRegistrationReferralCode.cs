using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistrationReferralCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReferralCode",
                table: "registration_requests",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_registration_requests_ReferralCode",
                table: "registration_requests",
                column: "ReferralCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_registration_requests_ReferralCode",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "ReferralCode",
                table: "registration_requests");
        }
    }
}
