using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInsureOnePartnerPortal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LoginCode",
                table: "partner_portal_accesses",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PermissionsJson",
                table: "partner_portal_accesses",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "partner_portal_accesses",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.CreateTable(
                name: "insureone_office_settings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Slug = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsEnabled = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    DisplayName = table.Column<string>(type: "varchar(180)", maxLength: 180, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    WelcomeMessage = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PrimaryColor = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SecondaryColor = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SupportEmail = table.Column<string>(type: "varchar(256)", maxLength: 256, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SupportPhone = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    LogoPath = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AllowedBranchesJson = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insureone_office_settings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_insureone_office_settings_AgencyOffices_AgencyOfficeId",
                        column: x => x.AgencyOfficeId,
                        principalTable: "AgencyOffices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "insureone_partner_permissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PartnerPortalAccessId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PermissionCode = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsAllowed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_insureone_partner_permissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_insureone_partner_permissions_partner_portal_accesses_Partne~",
                        column: x => x.PartnerPortalAccessId,
                        principalTable: "partner_portal_accesses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_partner_portal_accesses_TenantId_LoginCode",
                table: "partner_portal_accesses",
                columns: new[] { "TenantId", "LoginCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_partner_portal_accesses_UserId",
                table: "partner_portal_accesses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_insureone_office_settings_AgencyOfficeId",
                table: "insureone_office_settings",
                column: "AgencyOfficeId");

            migrationBuilder.CreateIndex(
                name: "IX_insureone_office_settings_Slug",
                table: "insureone_office_settings",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insureone_office_settings_TenantId_AgencyOfficeId",
                table: "insureone_office_settings",
                columns: new[] { "TenantId", "AgencyOfficeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_insureone_partner_permissions_PartnerPortalAccessId",
                table: "insureone_partner_permissions",
                column: "PartnerPortalAccessId");

            migrationBuilder.CreateIndex(
                name: "IX_insureone_partner_permissions_TenantId_PartnerPortalAccessId~",
                table: "insureone_partner_permissions",
                columns: new[] { "TenantId", "PartnerPortalAccessId", "PermissionCode" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_partner_portal_accesses_users_UserId",
                table: "partner_portal_accesses",
                column: "UserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_partner_portal_accesses_users_UserId",
                table: "partner_portal_accesses");

            migrationBuilder.DropTable(
                name: "insureone_office_settings");

            migrationBuilder.DropTable(
                name: "insureone_partner_permissions");

            migrationBuilder.DropIndex(
                name: "IX_partner_portal_accesses_TenantId_LoginCode",
                table: "partner_portal_accesses");

            migrationBuilder.DropIndex(
                name: "IX_partner_portal_accesses_UserId",
                table: "partner_portal_accesses");

            migrationBuilder.DropColumn(
                name: "LoginCode",
                table: "partner_portal_accesses");

            migrationBuilder.DropColumn(
                name: "PermissionsJson",
                table: "partner_portal_accesses");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "partner_portal_accesses");
        }
    }
}
