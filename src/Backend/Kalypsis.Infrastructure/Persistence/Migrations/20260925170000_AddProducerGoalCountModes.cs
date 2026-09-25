using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

/// <summary>Add count-based producer goal checkpoints (policies or vehicles).</summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260925170000_AddProducerGoalCountModes")]
public partial class AddProducerGoalCountModes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "GoalTargetMode",
            table: "producers",
            type: "varchar(16)",
            maxLength: 16,
            nullable: false,
            defaultValue: "Premium");

        migrationBuilder.AddColumn<int>(
            name: "GoalFirstTargetCount",
            table: "producers",
            type: "int",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "GoalCountStep",
            table: "producers",
            type: "int",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "GoalTargetMode", table: "producers");
        migrationBuilder.DropColumn(name: "GoalFirstTargetCount", table: "producers");
        migrationBuilder.DropColumn(name: "GoalCountStep", table: "producers");
    }
}
