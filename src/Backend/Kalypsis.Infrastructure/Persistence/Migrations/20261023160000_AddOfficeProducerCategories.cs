using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOfficeProducerCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProducerCategories_TenantId_Code",
                table: "ProducerCategories");

            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                table: "producers",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_producers_CategoryId",
                table: "producers",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ProducerCategories_TenantId_AgencyOfficeScopeId_Code",
                table: "ProducerCategories",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Code" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_producers_ProducerCategories_CategoryId",
                table: "producers",
                column: "CategoryId",
                principalTable: "ProducerCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_producers_ProducerCategories_CategoryId",
                table: "producers");

            migrationBuilder.DropIndex(
                name: "IX_producers_CategoryId",
                table: "producers");

            migrationBuilder.DropIndex(
                name: "IX_ProducerCategories_TenantId_AgencyOfficeScopeId_Code",
                table: "ProducerCategories");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "producers");

            migrationBuilder.CreateIndex(
                name: "IX_ProducerCategories_TenantId_Code",
                table: "ProducerCategories",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }
    }
}
