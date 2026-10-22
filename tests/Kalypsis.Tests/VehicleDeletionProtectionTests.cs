using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public sealed class VehicleDeletionProtectionTests
{
    [Theory]
    [InlineData(PolicyStatus.Active)]
    [InlineData(PolicyStatus.Draft)]
    [InlineData(PolicyStatus.Prospect)]
    [InlineData(PolicyStatus.Expired)]
    [InlineData(PolicyStatus.Cancelled)]
    [InlineData(PolicyStatus.Renewed)]
    [InlineData(PolicyStatus.PendingRenewal)]
    [InlineData(PolicyStatus.Undelivered)]
    [InlineData(PolicyStatus.AwaitingIssue)]
    public async Task Linked_vehicle_is_protected_for_every_contract_status(PolicyStatus status)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(current.TenantId!.Value); policy.Status = status;
        var receipt = new Receipt { Id = Guid.NewGuid(), TenantId = policy.TenantId, PolicyId = policy.Id,
            CustomerId = policy.CustomerId, Number = "R1", Amount = 100, ReceivedOn = new(2026, 10, 22) };
        db.AddRange(policy, receipt); await db.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyVehicleHandler(db, current, null!)
            .Handle(new(policy.Id, new(ClearVehicleRegistrationPlate: true)), default));
        Assert.Equal(409, error.StatusCode);
        Assert.Equal("deletion_blocked_by_dependencies", error.Code);
        Assert.Contains("ABC1234", error.Message);
        Assert.Contains(policy.PolicyNumber, error.Message);
        Assert.Contains("συνδεδεμένα συμβόλαια", error.Message);
        Assert.Equal("ABC1234", policy.VehicleRegistrationPlate);
        Assert.Null(policy.DeletedAt); Assert.Null(receipt.DeletedAt);
        db.ChangeTracker.Clear();
        var stored = await db.Policies.SingleAsync();
        Assert.Equal("ABC1234", stored.VehicleRegistrationPlate);
        Assert.Equal(100, stored.Premium);
        Assert.Equal("{\"make\":\"Toyota\"}", stored.SpecsJson);
        Assert.Single(await db.Receipts.ToListAsync());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Blanking_the_plate_in_vehicle_edit_cannot_bypass_deletion_protection(string plate)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(current.TenantId!.Value); db.Add(policy); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyVehicleHandler(db, current, null!)
            .Handle(new(policy.Id, new(VehicleRegistrationPlate: plate, SpecsJson: "{}", ReplaceDetails: true)), default));
        Assert.Equal("ABC1234", policy.VehicleRegistrationPlate);
        Assert.Equal("{\"make\":\"Toyota\"}", policy.SpecsJson);
    }

    [Fact]
    public async Task Policy_and_extended_edit_cannot_clear_a_linked_vehicle_or_partially_change_other_fields()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(current.TenantId!.Value); db.Add(policy); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyCommandHandler(db, current, null!).Handle(
            new(policy.Id, new UpdatePolicyBody(policy.InsuranceCompanyId, null, "Auto", policy.StartDate, policy.EndDate, 900, "USD", PolicyStatus.Draft)), default));
        await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyExtendedHandler(db, current, null!, null!).Handle(
            new(policy.Id, new UpdatePolicyExtendedBody(default, false, null, "{}", null, null, null, false, false, false, null, null, null, null)), default));
        Assert.Equal("ABC1234", policy.VehicleRegistrationPlate);
        Assert.Equal(100, policy.Premium); Assert.Equal("EUR", policy.Currency);
        Assert.Equal(PolicyStatus.Active, policy.Status);
        Assert.Equal("{\"make\":\"Toyota\"}", policy.SpecsJson);
    }

    [Fact]
    public async Task Multiple_selected_vehicles_keep_all_contracts_and_links_when_blocked()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policies = new[] { NewPolicy(current.TenantId!.Value), NewPolicy(current.TenantId.Value) };
        policies[1].VehicleRegistrationPlate = "XYZ9876";
        db.AddRange(policies); await db.SaveChangesAsync();
        foreach (var policy in policies)
            await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyVehicleHandler(db, current, null!)
                .Handle(new(policy.Id, new(ClearVehicleRegistrationPlate: true)), default));
        Assert.Equal(2, await db.Policies.CountAsync());
        Assert.All(policies, policy => { Assert.False(string.IsNullOrWhiteSpace(policy.VehicleRegistrationPlate)); Assert.Null(policy.DeletedAt); });
    }

    [Fact]
    public async Task Normal_vehicle_corrections_still_work_and_foreign_tenant_records_are_not_accessible()
    {
        var tenant = Guid.NewGuid();
        var current = TestScaffold.AgencyStaff(tenant);
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = NewPolicy(tenant); db.Add(policy); await db.SaveChangesAsync();
        await new UpdatePolicyVehicleHandler(db, current, new NoopDetailMediator()).Handle(
            new(policy.Id, new(VehicleRegistrationPlate: "NEW1234")), default);
        Assert.Equal("NEW1234", policy.VehicleRegistrationPlate);
        Assert.Equal(100, policy.Premium);
        var foreign = TestScaffold.AgencyStaff(Guid.NewGuid());
        var error = await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyVehicleHandler(db, foreign, null!)
            .Handle(new(policy.Id, new(ClearVehicleRegistrationPlate: true)), default));
        Assert.Equal(404, error.StatusCode);
        Assert.Equal("NEW1234", policy.VehicleRegistrationPlate);
    }

    private static Policy NewPolicy(Guid tenant) => new()
    {
        Id = Guid.NewGuid(), TenantId = tenant, CustomerId = Guid.NewGuid(), InsuranceCompanyId = Guid.NewGuid(),
        PolicyNumber = $"P-{Guid.NewGuid():N}", VehicleRegistrationPlate = "ABC1234", PolicyType = PolicyType.Auto,
        StartDate = new(2026, 1, 1), EndDate = new(2027, 1, 1), Status = PolicyStatus.Active,
        Premium = 100, Currency = "EUR", SpecsJson = "{\"make\":\"Toyota\"}"
    };
    private sealed class NoopDetailMediator : IMediator
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default) => Task.FromResult(default(TResponse)!);
        public Task<object?> Send(object request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest => throw new NotImplementedException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default) => throw new NotImplementedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Publish(object notification, CancellationToken ct = default) => Task.CompletedTask;
        public Task Publish<TNotification>(TNotification notification, CancellationToken ct = default) where TNotification : INotification => Task.CompletedTask;
    }
}
