using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvancePaymentDirection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MySQL commits DDL before EF records migration history. A retry
            // after interruption must not fail or reclassify legacy entries.
            migrationBuilder.Sql("SET @kalypsis_advance_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'AdvancePayments' AND column_name = 'Direction'), 'SELECT 1', 'ALTER TABLE `AdvancePayments` ADD COLUMN `Direction` varchar(12) CHARACTER SET utf8mb4 NULL');");
            migrationBuilder.Sql("PREPARE kalypsis_advance_stmt FROM @kalypsis_advance_ddl;");
            migrationBuilder.Sql("EXECUTE kalypsis_advance_stmt;");
            migrationBuilder.Sql("DEALLOCATE PREPARE kalypsis_advance_stmt;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Direction",
                table: "AdvancePayments");
        }
    }
}
