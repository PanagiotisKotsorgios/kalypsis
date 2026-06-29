using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Broker / πρακτορείο model on InsuranceCompany:
    ///   - ParentCompanyId nullable FK back to the same table; a broker
    ///     container points its subsidiaries at itself.
    ///   - IsBroker bool flag that flips the frontend into "show subsidiary
    ///     picker" mode.
    /// Used to model Grand Cover (IW) and similar πρακτορεία that redistribute
    /// many real carriers' products under one contract.
    /// </summary>
    [Migration("20260629140000_AddInsuranceCompanyBrokerHierarchy")]
    public partial class AddInsuranceCompanyBrokerHierarchy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentCompanyId",
                table: "insurance_companies",
                type: "char(36)",
                nullable: true,
                collation: "ascii_general_ci");

            migrationBuilder.AddColumn<bool>(
                name: "IsBroker",
                table: "insurance_companies",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_insurance_companies_ParentCompanyId",
                table: "insurance_companies",
                column: "ParentCompanyId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_companies_ParentCompanyId",
                table: "insurance_companies");
            migrationBuilder.DropColumn(name: "IsBroker", table: "insurance_companies");
            migrationBuilder.DropColumn(name: "ParentCompanyId", table: "insurance_companies");
        }
    }
}
