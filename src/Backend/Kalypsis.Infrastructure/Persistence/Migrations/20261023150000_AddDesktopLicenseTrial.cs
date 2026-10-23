using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Kalypsis.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261023150000_AddDesktopLicenseTrial")]
public sealed class AddDesktopLicenseTrial : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // MySQL DDL can commit before migration history: safe to retry after interruption.
        foreach (var column in new[] { "TrialStartedAtUtc", "TrialExpiresAtUtc" })
        {
            migrationBuilder.Sql($"SET @desktop_trial_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'desktop_licenses' AND column_name = '{column}'), 'SELECT 1', 'ALTER TABLE `desktop_licenses` ADD COLUMN `{column}` datetime(6) NULL');");
            migrationBuilder.Sql("PREPARE desktop_trial_stmt FROM @desktop_trial_ddl;");
            migrationBuilder.Sql("EXECUTE desktop_trial_stmt;");
            migrationBuilder.Sql("DEALLOCATE PREPARE desktop_trial_stmt;");
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("TrialStartedAtUtc", "desktop_licenses");
        migrationBuilder.DropColumn("TrialExpiresAtUtc", "desktop_licenses");
    }
}
