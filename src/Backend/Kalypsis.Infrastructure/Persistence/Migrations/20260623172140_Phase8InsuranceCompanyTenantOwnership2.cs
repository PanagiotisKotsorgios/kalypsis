using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Phase8InsuranceCompanyTenantOwnership2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: previous DB state is missing the contact/notes/tenant columns entirely.
            // Add columns if absent and alter Country (which does exist as varchar(2)).
            // The legacy unique index on Code may or may not exist depending on DB state.
            migrationBuilder.Sql(@"
                SET @ix := (SELECT COUNT(*) FROM information_schema.statistics
                            WHERE table_schema = DATABASE() AND table_name = 'insurance_companies'
                              AND index_name = 'IX_insurance_companies_Code');
                SET @sql := IF(@ix > 0, 'ALTER TABLE insurance_companies DROP INDEX IX_insurance_companies_Code', 'SELECT 1');
                PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;");

            migrationBuilder.Sql(@"
                ALTER TABLE insurance_companies
                    MODIFY COLUMN Country varchar(80) CHARACTER SET utf8mb4 NULL;");

            // MySQL 8 doesn't support ADD COLUMN IF NOT EXISTS; do each conditionally via prepared statements.
            string AddIfMissing(string col, string type) => $@"
                SET @c := (SELECT COUNT(*) FROM information_schema.columns
                           WHERE table_schema = DATABASE() AND table_name = 'insurance_companies'
                             AND column_name = '{col}');
                SET @sql := IF(@c = 0, 'ALTER TABLE insurance_companies ADD COLUMN {col} {type} NULL', 'SELECT 1');
                PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;";

            migrationBuilder.Sql(AddIfMissing("TenantId", "char(36) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("Notes", "varchar(2000) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("ContactPhone", "varchar(40) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("ContactName", "varchar(160) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("ContactEmail", "varchar(160) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("AgentCode", "varchar(80) CHARACTER SET utf8mb4"));
            migrationBuilder.Sql(AddIfMissing("AfmVat", "varchar(40) CHARACTER SET utf8mb4"));

            migrationBuilder.CreateIndex(
                name: "IX_insurance_companies_TenantId_Code",
                table: "insurance_companies",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_insurance_companies_TenantId_Code",
                table: "insurance_companies");

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(2000)",
                oldMaxLength: 2000,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Country",
                table: "insurance_companies",
                type: "varchar(2)",
                maxLength: 2,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(80)",
                oldMaxLength: 80,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "ContactPhone",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "ContactName",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(160)",
                oldMaxLength: 160,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "ContactEmail",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(160)",
                oldMaxLength: 160,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "AgentCode",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(80)",
                oldMaxLength: 80,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "AfmVat",
                table: "insurance_companies",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(40)",
                oldMaxLength: 40,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_insurance_companies_Code",
                table: "insurance_companies",
                column: "Code",
                unique: true);
        }
    }
}
