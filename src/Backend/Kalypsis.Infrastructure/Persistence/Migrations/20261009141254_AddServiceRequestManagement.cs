using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRequestManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAt",
                table: "service_requests",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRead",
                table: "service_requests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReadAt",
                table: "service_requests",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "service_request_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ServiceRequestId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AuthorRole = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AuthorUserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Body = table.Column<string>(type: "varchar(4000)", maxLength: 4000, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_request_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_service_request_messages_service_requests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "service_requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_service_request_messages_users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_service_requests_TenantId_IsRead_ArchivedAt",
                table: "service_requests",
                columns: new[] { "TenantId", "IsRead", "ArchivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_service_request_messages_AuthorUserId",
                table: "service_request_messages",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_service_request_messages_ServiceRequestId",
                table: "service_request_messages",
                column: "ServiceRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_service_request_messages_TenantId_ServiceRequestId_CreatedAt",
                table: "service_request_messages",
                columns: new[] { "TenantId", "ServiceRequestId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "service_request_messages");

            migrationBuilder.DropIndex(
                name: "IX_service_requests_TenantId_IsRead_ArchivedAt",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "IsRead",
                table: "service_requests");

            migrationBuilder.DropColumn(
                name: "ReadAt",
                table: "service_requests");
        }
    }
}
