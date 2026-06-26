using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerFamilyNeedsAndCampaignChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChannelsJson",
                table: "marketing_campaigns",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "[\"Email\"]")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "Failed",
                table: "marketing_campaigns",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NeedKindFilter",
                table: "marketing_campaigns",
                type: "varchar(40)",
                maxLength: 40,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "OccupationFilter",
                table: "marketing_campaigns",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "OnlyUninsuredNeeds",
                table: "marketing_campaigns",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SmsBody",
                table: "marketing_campaigns",
                type: "varchar(1600)",
                maxLength: 1600,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ViberBody",
                table: "marketing_campaigns",
                type: "varchar(4000)",
                maxLength: 4000,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "customer_insurance_needs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Kind = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Title = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    HasAsset = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsInsured = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Priority = table.Column<int>(type: "int", nullable: false),
                    NextContactAt = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_insurance_needs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_customer_insurance_needs_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "customer_relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RelatedCustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    RelationshipType = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_relationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_customer_relationships_customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_customer_relationships_customers_RelatedCustomerId",
                        column: x => x.RelatedCustomerId,
                        principalTable: "customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_customer_insurance_needs_CustomerId",
                table: "customer_insurance_needs",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_insurance_needs_TenantId_CustomerId_Kind",
                table: "customer_insurance_needs",
                columns: new[] { "TenantId", "CustomerId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_customer_insurance_needs_TenantId_Kind_HasAsset_IsInsured",
                table: "customer_insurance_needs",
                columns: new[] { "TenantId", "Kind", "HasAsset", "IsInsured" });

            migrationBuilder.CreateIndex(
                name: "IX_customer_relationships_CustomerId",
                table: "customer_relationships",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_relationships_RelatedCustomerId",
                table: "customer_relationships",
                column: "RelatedCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_customer_relationships_TenantId_CustomerId_RelatedCustomerId",
                table: "customer_relationships",
                columns: new[] { "TenantId", "CustomerId", "RelatedCustomerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_customer_relationships_TenantId_RelatedCustomerId",
                table: "customer_relationships",
                columns: new[] { "TenantId", "RelatedCustomerId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer_insurance_needs");

            migrationBuilder.DropTable(
                name: "customer_relationships");

            migrationBuilder.DropColumn(
                name: "ChannelsJson",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "Failed",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "NeedKindFilter",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "OccupationFilter",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "OnlyUninsuredNeeds",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "SmsBody",
                table: "marketing_campaigns");

            migrationBuilder.DropColumn(
                name: "ViberBody",
                table: "marketing_campaigns");
        }
    }
}
