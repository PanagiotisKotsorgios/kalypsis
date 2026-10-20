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
            migrationBuilder.DropIndex(
                name: "IX_RegisterTemplates_TenantId_Code",
                table: "RegisterTemplates");

            migrationBuilder.DropIndex(
                name: "IX_MovementTypes_TenantId_Code",
                table: "MovementTypes");

            migrationBuilder.DropIndex(
                name: "IX_IntegrationSettings_TenantId_Service_KeyName",
                table: "IntegrationSettings");

            migrationBuilder.DropIndex(
                name: "IX_CustomFieldDefinitions_TenantId_EntityType_Code",
                table: "CustomFieldDefinitions");

            migrationBuilder.DropIndex(
                name: "IX_bridge_code_mappings_TenantId_Kind_SourceCarrier_RawCode",
                table: "bridge_code_mappings");

            migrationBuilder.DropIndex(
                name: "IX_branches_TenantId_Code",
                table: "branches");

            migrationBuilder.DropIndex(
                name: "IX_BackofficeBridgeConnections_TenantId_Bridge",
                table: "BackofficeBridgeConnections");

            migrationBuilder.CreateIndex(
                name: "IX_RegisterTemplates_TenantId_AgencyOfficeScopeId_Code",
                table: "RegisterTemplates",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovementTypes_TenantId_AgencyOfficeScopeId_Code",
                table: "MovementTypes",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IntegrationSettings_TenantId_AgencyOfficeScopeId_Service_Key~",
                table: "IntegrationSettings",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Service", "KeyName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldDefinitions_TenantId_AgencyOfficeScopeId_EntityTy~",
                table: "CustomFieldDefinitions",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "EntityType", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bridge_code_mappings_TenantId_AgencyOfficeScopeId_Kind_Sourc~",
                table: "bridge_code_mappings",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Kind", "SourceCarrier", "RawCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_branches_TenantId_AgencyOfficeScopeId_Code",
                table: "branches",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BackofficeBridgeConnections_TenantId_AgencyOfficeScopeId_Bri~",
                table: "BackofficeBridgeConnections",
                columns: new[] { "TenantId", "AgencyOfficeScopeId", "Bridge" },
                unique: true);
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
