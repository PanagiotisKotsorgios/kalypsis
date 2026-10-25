using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCommissionRuleSelectionCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AgreementNumber",
                table: "commission_rules",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "InsuranceYear",
                table: "commission_rules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumDeductible",
                table: "commission_rules",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumGrossPremium",
                table: "commission_rules",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumDeductible",
                table: "commission_rules",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MinimumGrossPremium",
                table: "commission_rules",
                type: "decimal(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "commission_rules",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_commission_rules_TenantId_InsuranceCompanyId_PolicyType_Insu~",
                table: "commission_rules",
                columns: new[] { "TenantId", "InsuranceCompanyId", "PolicyType", "InsuranceYear", "Priority" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_commission_rules_TenantId_InsuranceCompanyId_PolicyType_Insu~",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "AgreementNumber",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "InsuranceYear",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "MaximumDeductible",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "MaximumGrossPremium",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "MinimumDeductible",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "MinimumGrossPremium",
                table: "commission_rules");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "commission_rules");
        }
    }
}
