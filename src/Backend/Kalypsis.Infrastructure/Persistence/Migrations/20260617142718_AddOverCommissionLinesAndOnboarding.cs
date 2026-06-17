using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOverCommissionLinesAndOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OnboardingCompletedAt",
                table: "tenants",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOverCommission",
                table: "commission_run_lines",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OnBehalfOfProducerId",
                table: "commission_run_lines",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<int>(
                name: "OverCommissionLevel",
                table: "commission_run_lines",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_commission_run_lines_OnBehalfOfProducerId",
                table: "commission_run_lines",
                column: "OnBehalfOfProducerId");

            migrationBuilder.AddForeignKey(
                name: "FK_commission_run_lines_producers_OnBehalfOfProducerId",
                table: "commission_run_lines",
                column: "OnBehalfOfProducerId",
                principalTable: "producers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_commission_run_lines_producers_OnBehalfOfProducerId",
                table: "commission_run_lines");

            migrationBuilder.DropIndex(
                name: "IX_commission_run_lines_OnBehalfOfProducerId",
                table: "commission_run_lines");

            migrationBuilder.DropColumn(
                name: "OnboardingCompletedAt",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "IsOverCommission",
                table: "commission_run_lines");

            migrationBuilder.DropColumn(
                name: "OnBehalfOfProducerId",
                table: "commission_run_lines");

            migrationBuilder.DropColumn(
                name: "OverCommissionLevel",
                table: "commission_run_lines");
        }
    }
}
