using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProducerLinksToTasksAndAppointments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProducerId",
                table: "appointments",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<Guid>(
                name: "ProducerId",
                table: "agency_tasks",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateIndex(
                name: "IX_appointments_ProducerId",
                table: "appointments",
                column: "ProducerId");

            migrationBuilder.CreateIndex(
                name: "IX_agency_tasks_ProducerId",
                table: "agency_tasks",
                column: "ProducerId");

            migrationBuilder.AddForeignKey(
                name: "FK_agency_tasks_producers_ProducerId",
                table: "agency_tasks",
                column: "ProducerId",
                principalTable: "producers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_appointments_producers_ProducerId",
                table: "appointments",
                column: "ProducerId",
                principalTable: "producers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_agency_tasks_producers_ProducerId",
                table: "agency_tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_appointments_producers_ProducerId",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_appointments_ProducerId",
                table: "appointments");

            migrationBuilder.DropIndex(
                name: "IX_agency_tasks_ProducerId",
                table: "agency_tasks");

            migrationBuilder.DropColumn(
                name: "ProducerId",
                table: "appointments");

            migrationBuilder.DropColumn(
                name: "ProducerId",
                table: "agency_tasks");
        }
    }
}
