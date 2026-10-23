using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Kalypsis.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261023120000_AddGarageProfilesAndCompanyLinks")]
public sealed class AddGarageProfilesAndCompanyLinks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Retry-safe DDL: MySQL can commit schema changes before migration history.
        migrationBuilder.Sql("SET @garage_profile_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Garages' AND column_name = 'ProfileJson'), 'SELECT 1', 'ALTER TABLE `Garages` ADD COLUMN `ProfileJson` longtext CHARACTER SET utf8mb4 NULL');");
        migrationBuilder.Sql("PREPARE garage_profile_stmt FROM @garage_profile_ddl;");
        migrationBuilder.Sql("EXECUTE garage_profile_stmt;");
        migrationBuilder.Sql("DEALLOCATE PREPARE garage_profile_stmt;");
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS `GarageInsuranceCompanies` (
              `Id` char(36) COLLATE ascii_general_ci NOT NULL,
              `GarageId` char(36) COLLATE ascii_general_ci NOT NULL,
              `InsuranceCompanyId` char(36) COLLATE ascii_general_ci NOT NULL,
              `TenantId` char(36) COLLATE ascii_general_ci NOT NULL,
              `AgencyOfficeScopeId` char(36) COLLATE ascii_general_ci NULL,
              `CreatedAt` datetime(6) NOT NULL,
              `UpdatedAt` datetime(6) NULL,
              `DeletedAt` datetime(6) NULL,
              PRIMARY KEY (`Id`),
              UNIQUE KEY `IX_GarageCompanies_Tenant_Garage_Company` (`TenantId`,`GarageId`,`InsuranceCompanyId`),
              KEY `IX_GarageInsuranceCompanies_GarageId` (`GarageId`),
              KEY `IX_GarageInsuranceCompanies_InsuranceCompanyId` (`InsuranceCompanyId`),
              CONSTRAINT `FK_GarageCompanies_Garage` FOREIGN KEY (`GarageId`) REFERENCES `Garages` (`Id`) ON DELETE RESTRICT,
              CONSTRAINT `FK_GarageCompanies_Company` FOREIGN KEY (`InsuranceCompanyId`) REFERENCES `insurance_companies` (`Id`) ON DELETE RESTRICT
            ) CHARACTER SET=utf8mb4;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("GarageInsuranceCompanies");
        migrationBuilder.DropColumn("ProfileJson", "Garages");
    }
}
