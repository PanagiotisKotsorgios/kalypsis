using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAffiliateReferralTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AffiliateLifetimeFreeUnlocked",
                table: "tenants",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferredByTenantId",
                table: "tenants",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_tenants_ReferredByTenantId",
                table: "tenants",
                column: "ReferredByTenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tenants_ReferredByTenantId",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "AffiliateLifetimeFreeUnlocked",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "ReferredByTenantId",
                table: "tenants");
        }
    }
}
