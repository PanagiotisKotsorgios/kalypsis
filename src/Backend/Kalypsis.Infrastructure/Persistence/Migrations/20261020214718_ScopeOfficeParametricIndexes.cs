using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeOfficeParametricIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MySQL DDL implicitly commits. A failed first deployment may
            // therefore have dropped some legacy indexes before retrying this
            // migration. Every operation must be restart-safe.
            DropIndexIfExists(migrationBuilder, "RegisterTemplates", "IX_RegisterTemplates_TenantId_Code");
            DropIndexIfExists(migrationBuilder, "MovementTypes", "IX_MovementTypes_TenantId_Code");
            DropIndexIfExists(migrationBuilder, "IntegrationSettings", "IX_IntegrationSettings_TenantId_Service_KeyName");
            DropIndexIfExists(migrationBuilder, "CustomFieldDefinitions", "IX_CustomFieldDefinitions_TenantId_EntityType_Code");
            DropIndexIfExists(migrationBuilder, "branches", "IX_branches_TenantId_Code");
            DropIndexIfExists(migrationBuilder, "BackofficeBridgeConnections", "IX_BackofficeBridgeConnections_TenantId_Bridge");

            // bridge_code_mappings is a legacy safety-net table created by
            // DataSeeder. Its physical index name predates the EF convention,
            // and older installations also lack AgencyOfficeScopeId.
            AddColumnIfMissing(migrationBuilder, "bridge_code_mappings", "AgencyOfficeScopeId",
                "ALTER TABLE `bridge_code_mappings` ADD COLUMN `AgencyOfficeScopeId` char(36) NULL COLLATE ascii_general_ci");
            DropIndexIfExists(migrationBuilder, "bridge_code_mappings", "IX_bridge_code_mappings_TenantId_Kind_SourceCarrier_RawCode");
            DropIndexIfExists(migrationBuilder, "bridge_code_mappings", "IX_bcm_tenant_kind_carrier_raw");

            CreateIndexIfMissing(migrationBuilder, "RegisterTemplates", "IX_RegisterTemplates_TenantId_AgencyOfficeScopeId_Code",
                "CREATE UNIQUE INDEX `IX_RegisterTemplates_TenantId_AgencyOfficeScopeId_Code` ON `RegisterTemplates` (`TenantId`, `AgencyOfficeScopeId`, `Code`)");
            CreateIndexIfMissing(migrationBuilder, "MovementTypes", "IX_MovementTypes_TenantId_AgencyOfficeScopeId_Code",
                "CREATE UNIQUE INDEX `IX_MovementTypes_TenantId_AgencyOfficeScopeId_Code` ON `MovementTypes` (`TenantId`, `AgencyOfficeScopeId`, `Code`)");
            CreateIndexIfMissing(migrationBuilder, "IntegrationSettings", "IX_IntegrationSettings_TenantId_AgencyOfficeScopeId_Service_Key~",
                "CREATE UNIQUE INDEX `IX_IntegrationSettings_TenantId_AgencyOfficeScopeId_Service_Key~` ON `IntegrationSettings` (`TenantId`, `AgencyOfficeScopeId`, `Service`, `KeyName`)");
            CreateIndexIfMissing(migrationBuilder, "CustomFieldDefinitions", "IX_CustomFieldDefinitions_TenantId_AgencyOfficeScopeId_EntityTy~",
                "CREATE UNIQUE INDEX `IX_CustomFieldDefinitions_TenantId_AgencyOfficeScopeId_EntityTy~` ON `CustomFieldDefinitions` (`TenantId`, `AgencyOfficeScopeId`, `EntityType`, `Code`)");
            CreateIndexIfMissing(migrationBuilder, "bridge_code_mappings", "IX_bridge_code_mappings_TenantId_AgencyOfficeScopeId_Kind_Sourc~",
                "CREATE UNIQUE INDEX `IX_bridge_code_mappings_TenantId_AgencyOfficeScopeId_Kind_Sourc~` ON `bridge_code_mappings` (`TenantId`, `AgencyOfficeScopeId`, `Kind`, `SourceCarrier`, `RawCode`)");
            CreateIndexIfMissing(migrationBuilder, "branches", "IX_branches_TenantId_AgencyOfficeScopeId_Code",
                "CREATE UNIQUE INDEX `IX_branches_TenantId_AgencyOfficeScopeId_Code` ON `branches` (`TenantId`, `AgencyOfficeScopeId`, `Code`)");
            CreateIndexIfMissing(migrationBuilder, "BackofficeBridgeConnections", "IX_BackofficeBridgeConnections_TenantId_AgencyOfficeScopeId_Bri~",
                "CREATE UNIQUE INDEX `IX_BackofficeBridgeConnections_TenantId_AgencyOfficeScopeId_Bri~` ON `BackofficeBridgeConnections` (`TenantId`, `AgencyOfficeScopeId`, `Bridge`)");
        }

        private static void DropIndexIfExists(MigrationBuilder migrationBuilder, string table, string index)
            => RunConditionalDdl(migrationBuilder,
                $"EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '{table}' AND index_name = '{index}')",
                $"ALTER TABLE `{table}` DROP INDEX `{index}`");

        private static void CreateIndexIfMissing(MigrationBuilder migrationBuilder, string table, string index, string createSql)
            => RunConditionalDdl(migrationBuilder,
                $"EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{table}') AND NOT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '{table}' AND index_name = '{index}')",
                createSql);

        private static void AddColumnIfMissing(MigrationBuilder migrationBuilder, string table, string column, string addSql)
            => RunConditionalDdl(migrationBuilder,
                $"EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '{table}') AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '{table}' AND column_name = '{column}')",
                addSql);

        private static void RunConditionalDdl(MigrationBuilder migrationBuilder, string condition, string ddl)
        {
            var escapedDdl = ddl.Replace("'", "''");
            migrationBuilder.Sql($"SET @kalypsis_migration_ddl = IF({condition}, '{escapedDdl}', 'SELECT 1')");
            migrationBuilder.Sql("PREPARE kalypsis_migration_stmt FROM @kalypsis_migration_ddl");
            migrationBuilder.Sql("EXECUTE kalypsis_migration_stmt");
            migrationBuilder.Sql("DEALLOCATE PREPARE kalypsis_migration_stmt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegisterTemplates_TenantId_AgencyOfficeScopeId_Code",
                table: "RegisterTemplates");

            migrationBuilder.DropIndex(
                name: "IX_MovementTypes_TenantId_AgencyOfficeScopeId_Code",
                table: "MovementTypes");

            migrationBuilder.DropIndex(
                name: "IX_IntegrationSettings_TenantId_AgencyOfficeScopeId_Service_Key~",
                table: "IntegrationSettings");

            migrationBuilder.DropIndex(
                name: "IX_CustomFieldDefinitions_TenantId_AgencyOfficeScopeId_EntityTy~",
                table: "CustomFieldDefinitions");

            migrationBuilder.DropIndex(
                name: "IX_bridge_code_mappings_TenantId_AgencyOfficeScopeId_Kind_Sourc~",
                table: "bridge_code_mappings");

            migrationBuilder.DropIndex(
                name: "IX_branches_TenantId_AgencyOfficeScopeId_Code",
                table: "branches");

            migrationBuilder.DropIndex(
                name: "IX_BackofficeBridgeConnections_TenantId_AgencyOfficeScopeId_Bri~",
                table: "BackofficeBridgeConnections");

            migrationBuilder.CreateIndex(
                name: "IX_RegisterTemplates_TenantId_Code",
                table: "RegisterTemplates",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovementTypes_TenantId_Code",
                table: "MovementTypes",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IntegrationSettings_TenantId_Service_KeyName",
                table: "IntegrationSettings",
                columns: new[] { "TenantId", "Service", "KeyName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldDefinitions_TenantId_EntityType_Code",
                table: "CustomFieldDefinitions",
                columns: new[] { "TenantId", "EntityType", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bridge_code_mappings_TenantId_Kind_SourceCarrier_RawCode",
                table: "bridge_code_mappings",
                columns: new[] { "TenantId", "Kind", "SourceCarrier", "RawCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_branches_TenantId_Code",
                table: "branches",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BackofficeBridgeConnections_TenantId_Bridge",
                table: "BackofficeBridgeConnections",
                columns: new[] { "TenantId", "Bridge" },
                unique: true);
        }
    }
}
