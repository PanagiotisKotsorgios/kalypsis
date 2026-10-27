using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddIndependentCustomerFamilyMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "customer_family_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CustomerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Relation = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FullName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    BirthDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Gender = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amka = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsBeneficiary = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    BeneficiarySharePercent = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    Notes = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AfmVat = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Occupation = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Email = table.Column<string>(type: "varchar(256)", maxLength: 256, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MobilePhone = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CanReceiveMarketing = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    AgencyOfficeScopeId = table.Column<Guid>(type: "char(36)", nullable: true, collation: "ascii_general_ci")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customer_family_members", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_customer_family_members_TenantId_CustomerId",
                table: "customer_family_members",
                columns: new[] { "TenantId", "CustomerId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer_family_members");
        }
    }
}
