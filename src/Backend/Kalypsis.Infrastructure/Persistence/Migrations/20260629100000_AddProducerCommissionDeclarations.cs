using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Producer-side reconciliation table: each row is one producer self-reporting
    /// the commission they expected for a specific policy. Discrepancies vs the
    /// agency's CommissionRunLines emit a notification to the agency admins.
    /// </summary>
    [Migration("20260629100000_AddProducerCommissionDeclarations")]
    public partial class AddProducerCommissionDeclarations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "producer_commission_declarations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    TenantId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProducerId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PolicyId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(14,2)", nullable: false),
                    ExpectedPercent = table.Column<decimal>(type: "decimal(7,2)", nullable: true),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DeclaredAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    RecordedAmount = table.Column<decimal>(type: "decimal(14,2)", nullable: true),
                    DifferenceAmount = table.Column<decimal>(type: "decimal(14,2)", nullable: true),
                    ReconciliationStatus = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_producer_commission_declarations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pcd_producers",
                        column: x => x.ProducerId,
                        principalTable: "producers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_pcd_policies",
                        column: x => x.PolicyId,
                        principalTable: "policies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_pcd_tenant_producer",
                table: "producer_commission_declarations",
                columns: new[] { "TenantId", "ProducerId" });

            migrationBuilder.CreateIndex(
                name: "IX_pcd_policy",
                table: "producer_commission_declarations",
                column: "PolicyId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "producer_commission_declarations");
        }
    }
}
