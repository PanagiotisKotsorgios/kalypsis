using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kalypsis.Infrastructure.Persistence.Migrations;

/// <summary>Per-producer configuration for the read-only incentive goal plan.</summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260923173000_AddProducerGoalPlan")]
public partial class AddProducerGoalPlan : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "GoalBaseCommissionPercent",
            table: "producers",
            type: "decimal(7,2)",
            precision: 7,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "GoalCommissionIncreasePercent",
            table: "producers",
            type: "decimal(7,2)",
            precision: 7,
            scale: 2,
            nullable: false,
            defaultValue: 1m);

        migrationBuilder.AddColumn<int>(
            name: "GoalLevelCount",
            table: "producers",
            type: "int",
            nullable: false,
            defaultValue: 4);

        migrationBuilder.AddColumn<decimal>(
            name: "GoalFirstTargetPremium",
            table: "producers",
            type: "decimal(14,2)",
            precision: 14,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "GoalMaximumCommissionPercent",
            table: "producers",
            type: "decimal(7,2)",
            precision: 7,
            scale: 2,
            nullable: false,
            defaultValue: 14m);

        migrationBuilder.AddColumn<bool>(
            name: "GoalPlanEnabled",
            table: "producers",
            type: "tinyint(1)",
            nullable: false,
            defaultValue: true);

        migrationBuilder.AddColumn<decimal>(
            name: "GoalPremiumStep",
            table: "producers",
            type: "decimal(14,2)",
            precision: 14,
            scale: 2,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "GoalBaseCommissionPercent", table: "producers");
        migrationBuilder.DropColumn(name: "GoalCommissionIncreasePercent", table: "producers");
        migrationBuilder.DropColumn(name: "GoalLevelCount", table: "producers");
        migrationBuilder.DropColumn(name: "GoalFirstTargetPremium", table: "producers");
        migrationBuilder.DropColumn(name: "GoalMaximumCommissionPercent", table: "producers");
        migrationBuilder.DropColumn(name: "GoalPlanEnabled", table: "producers");
        migrationBuilder.DropColumn(name: "GoalPremiumStep", table: "producers");
    }
}
