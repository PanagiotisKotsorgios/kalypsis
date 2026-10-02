using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCrmGroupsAndOfficeProviderSecrets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "registration_requests",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "FollowUpAt",
                table: "registration_requests",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRead",
                table: "registration_requests",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReadAt",
                table: "registration_requests",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TriageStatus",
                table: "registration_requests",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "Value",
                table: "IntegrationSettings",
                type: "varchar(3000)",
                maxLength: 3000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(2000)",
                oldMaxLength: 2000,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "PaymentDueDate",
                table: "customers",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "crm_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    EntityType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsDynamic = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    FilterJson = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_groups", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "producer_communication_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProducerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci"),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Direction = table.Column<int>(type: "int", nullable: false),
                    Outcome = table.Column<int>(type: "int", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    Subject = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Body = table.Column<string>(type: "varchar(4000)", maxLength: 4000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_producer_communication_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_producer_communication_logs_producers_ProducerId",
                        column: x => x.ProducerId,
                        principalTable: "producers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_producer_communication_logs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "crm_group_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    GroupId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    EntityId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    EntityType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crm_group_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_crm_group_members_crm_groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "crm_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_registration_requests_Category",
                table: "registration_requests",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_registration_requests_IsRead_CreatedAt",
                table: "registration_requests",
                columns: new[] { "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_registration_requests_TriageStatus_FollowUpAt",
                table: "registration_requests",
                columns: new[] { "TriageStatus", "FollowUpAt" });

            migrationBuilder.CreateIndex(
                name: "IX_crm_group_members_GroupId",
                table: "crm_group_members",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_crm_group_members_TenantId_GroupId_EntityType_EntityId",
                table: "crm_group_members",
                columns: new[] { "TenantId", "GroupId", "EntityType", "EntityId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_crm_groups_TenantId_EntityType_Name",
                table: "crm_groups",
                columns: new[] { "TenantId", "EntityType", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_producer_communication_logs_ProducerId",
                table: "producer_communication_logs",
                column: "ProducerId");

            migrationBuilder.CreateIndex(
                name: "IX_producer_communication_logs_TenantId_ProducerId_OccurredAt",
                table: "producer_communication_logs",
                columns: new[] { "TenantId", "ProducerId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_producer_communication_logs_UserId",
                table: "producer_communication_logs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "crm_group_members");

            migrationBuilder.DropTable(
                name: "producer_communication_logs");

            migrationBuilder.DropTable(
                name: "crm_groups");

            migrationBuilder.DropIndex(
                name: "IX_registration_requests_Category",
                table: "registration_requests");

            migrationBuilder.DropIndex(
                name: "IX_registration_requests_IsRead_CreatedAt",
                table: "registration_requests");

            migrationBuilder.DropIndex(
                name: "IX_registration_requests_TriageStatus_FollowUpAt",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "FollowUpAt",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "IsRead",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "ReadAt",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "TriageStatus",
                table: "registration_requests");

            migrationBuilder.DropColumn(
                name: "PaymentDueDate",
                table: "customers");

            migrationBuilder.AlterColumn<string>(
                name: "Value",
                table: "IntegrationSettings",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(3000)",
                oldMaxLength: 3000,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
