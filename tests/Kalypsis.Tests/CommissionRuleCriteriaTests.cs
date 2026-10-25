using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class CommissionRuleCriteriaTests
{
    [Fact]
    public async Task Commission_rule_uses_start_year_premium_ranges_and_priority_before_effective_date()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "CRITERIA-1",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 200m,
            NetPremium = 150m, StartDate = new(2026, 4, 1), EndDate = new(2027, 4, 1),
            Deductible = 250m, Currency = "EUR"
        };
        db.Policies.Add(policy);
        db.CommissionRules.AddRange(
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
                AgencyPercent = 10m, Value = 10m, EffectiveFrom = new(2020, 1, 1) },
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
                AgencyPercent = 16m, Value = 16m, EffectiveFrom = new(2026, 1, 1) },
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
                AgencyPercent = 20m, Value = 20m, EffectiveFrom = new(2024, 1, 1), Priority = 5,
                InsuranceYear = 2026, MinimumGrossPremium = 100m, MaximumGrossPremium = 250m,
                MinimumDeductible = 200m, MaximumDeductible = 300m });
        await db.SaveChangesAsync();

        await new PolicyCommissionCalculator(db).RecomputeAsync(policy, default);
        await db.SaveChangesAsync();
        var split = await db.PolicyCommissionSplits.SingleAsync(x => x.PolicyId == policy.Id);
        Assert.Equal(HierarchyLevel.Agency, split.HierarchyLevel);
        Assert.Equal(20m, split.Percent);
        Assert.Equal(30m, split.GrossAmount); // net premium 150 × 20%
    }

    [Fact]
    public async Task Cover_specific_commission_rules_are_applied_per_cover_and_aggregated()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "COVER-RULES-1",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 180m,
            NetPremium = 150m, StartDate = new(2026, 4, 1), EndDate = new(2027, 4, 1), Currency = "EUR"
        };
        db.Policies.Add(policy);
        db.PolicyCovers.AddRange(
            new PolicyCover { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, CoverCode = "BASE", GrossPremium = 120m, NetPremium = 100m },
            new PolicyCover { Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, CoverCode = "LEGAL", GrossPremium = 60m, NetPremium = 50m });
        db.CommissionRules.AddRange(
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage, AgencyPercent = 16m, Value = 16m, EffectiveFrom = new(2020, 1, 1) },
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage, AgencyPercent = 25m, Value = 25m, CoverCode = "BASE", EffectiveFrom = new(2020, 1, 1) },
            new CommissionRule { Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage, AgencyPercent = 10m, Value = 10m, CoverCode = "LEGAL", EffectiveFrom = new(2020, 1, 1) });
        await db.SaveChangesAsync();

        await new PolicyCommissionCalculator(db).RecomputeAsync(policy, default);
        await db.SaveChangesAsync();

        var split = await db.PolicyCommissionSplits.SingleAsync(x => x.PolicyId == policy.Id);
        Assert.Equal(HierarchyLevel.Agency, split.HierarchyLevel);
        Assert.Equal(30m, split.GrossAmount); // BASE 100 × 25% + LEGAL 50 × 10%
        Assert.Equal(20m, split.Percent); // 30 / total net base 150
    }

    [Fact]
    public async Task Per_cover_bridge_commission_percentages_override_rules()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "COVER-OVERRIDE-1",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 120m,
            NetPremium = 100m, StartDate = new(2026, 4, 1), EndDate = new(2027, 4, 1), Currency = "EUR"
        };
        db.Policies.Add(policy);
        db.PolicyCovers.Add(new PolicyCover
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyId = policy.Id, CoverCode = "BASE",
            GrossPremium = 120m, NetPremium = 100m, AgencyCommissionPercent = 7m
        });
        db.CommissionRules.Add(new CommissionRule
        {
            Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
            AgencyPercent = 16m, Value = 16m, CoverCode = "BASE", EffectiveFrom = new(2020, 1, 1)
        });
        await db.SaveChangesAsync();

        await new PolicyCommissionCalculator(db).RecomputeAsync(policy, default);
        await db.SaveChangesAsync();

        var split = await db.PolicyCommissionSplits.SingleAsync(x => x.PolicyId == policy.Id);
        Assert.Equal(7m, split.Percent);
        Assert.Equal(7m, split.GrossAmount);
    }

    [Fact]
    public async Task Commission_calculation_bases_support_gross_incoming_and_fixed_amounts()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "BASES-1",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 120m,
            NetPremium = 100m, StartDate = new(2026, 4, 1), EndDate = new(2027, 4, 1), Currency = "EUR"
        };
        db.Policies.Add(policy);
        db.CommissionRules.Add(new CommissionRule
        {
            Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
            AgencyPercent = 15m, AgencyCalculationBase = CommissionCalculationBase.GrossPremium,
            IncomingPercent = 20m, IncomingCalculationBase = CommissionCalculationBase.GrossPremium,
            OverCommissionPercent = 50m, OverCommissionCalculationBase = CommissionCalculationBase.IncomingCommission,
            EffectiveFrom = new(2020, 1, 1)
        });
        await db.SaveChangesAsync();

        await new PolicyCommissionCalculator(db).RecomputeAsync(policy, default);
        await db.SaveChangesAsync();

        var splits = await db.PolicyCommissionSplits.Where(x => x.PolicyId == policy.Id).ToListAsync();
        Assert.Equal(2, splits.Count);
        Assert.Equal(18m, splits.Single(x => x.HierarchyLevel == HierarchyLevel.Agency).GrossAmount); // gross 120 × 15%
        Assert.Equal(12m, splits.Single(x => x.HierarchyLevel == HierarchyLevel.OverCommission).GrossAmount); // incoming 24 × 50%
    }

    [Fact]
    public async Task Fixed_commission_amount_is_not_treated_as_a_percentage()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var tenant = current.TenantId!.Value;
        var policy = new Policy
        {
            Id = Guid.NewGuid(), TenantId = tenant, PolicyNumber = "FIXED-1",
            PolicyType = PolicyType.Auto, Status = PolicyStatus.Active, Premium = 120m,
            NetPremium = 100m, StartDate = new(2026, 4, 1), EndDate = new(2027, 4, 1), Currency = "EUR"
        };
        db.Policies.Add(policy);
        db.CommissionRules.Add(new CommissionRule
        {
            Id = Guid.NewGuid(), TenantId = tenant, CommissionType = CommissionType.Percentage,
            AgencyPercent = 125m, AgencyCalculationBase = CommissionCalculationBase.FixedAmount,
            EffectiveFrom = new(2020, 1, 1)
        });
        await db.SaveChangesAsync();

        await new PolicyCommissionCalculator(db).RecomputeAsync(policy, default);
        await db.SaveChangesAsync();

        var split = await db.PolicyCommissionSplits.SingleAsync(x => x.PolicyId == policy.Id);
        Assert.Equal(125m, split.GrossAmount);
    }

    [Fact]
    public void Rule_validation_rejects_reversed_premium_and_deductible_ranges()
    {
        var body = new Kalypsis.Application.Features.CommissionRules.CommissionRuleBody(
            null, null, null, null, null, null, 10m, null, new(2026, 1, 1), null,
            MinimumGrossPremium: 500m, MaximumGrossPremium: 100m,
            MinimumDeductible: 300m, MaximumDeductible: 100m);
        var result = new Kalypsis.Application.Features.CommissionRules.CommissionRuleBodyValidator().Validate(body);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("ελάχιστο μικτό", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("ελάχιστη απαλλαγή", StringComparison.OrdinalIgnoreCase));
    }
}
