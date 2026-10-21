using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Policies;
using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using MediatR;
using Xunit;

namespace Kalypsis.Tests;

public sealed class VehicleOwnershipRulesTests
{
    [Theory]
    [InlineData("""{"ownerCount":"2","vehicleOwnership":[{"percentage":60},{"percentage":40}]}""")]
    [InlineData("""{"ownerCount":3,"vehicleOwnership":[{"percentage":33.33},{"percentage":33.33},{"percentage":33.34}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":60},{"percentage":null}]}""")]
    [InlineData("""{"make":"Toyota"}""")]
    [InlineData(null)]
    public void Valid_and_legacy_specs_are_accepted(string? specs) => VehicleOwnershipRules.Validate(specs);

    [Theory]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":60},{"percentage":50}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":40},{"percentage":50}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":-1},{"percentage":null}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":100.01},{"percentage":null}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"percentage":33.333},{"percentage":null}]}""")]
    [InlineData("""{"ownerCount":3,"vehicleOwnership":[{"percentage":60},{"percentage":40}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"vatNumber":"123"},{"percentage":null}]}""")]
    [InlineData("""{"ownerCount":2,"vehicleOwnership":[{"vatNumber":"123456789"},{"vatNumber":"123456789"}]}""")]
    public void Invalid_shares_are_rejected(string specs) => Assert.Throws<AppException>(() => VehicleOwnershipRules.Validate(specs));

    [Fact]
    public async Task Valid_ownership_persists_without_changing_contract_financials()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value, PolicyNumber = "OWNERS",
            VehicleRegistrationPlate = "ABC1234", Premium = 100, NetPremium = 80, Currency = "EUR",
            SpecsJson = """{"make":"Toyota","insurer":{"keep":true}}""" };
        db.Policies.Add(policy); await db.SaveChangesAsync();
        const string updated = """{"make":"Toyota","insurer":{"keep":true},"ownerCount":2,"vehicleOwnership":[{"name":"Άννα","percentage":60},{"name":"Γιάννης","percentage":40}]}""";
        await new UpdatePolicyVehicleHandler(db, current, new DetailMediator()).Handle(
            new UpdatePolicyVehicleCommand(policy.Id, new UpdatePolicyVehicleBody(SpecsJson: updated, ReplaceDetails: true)), default);
        db.ChangeTracker.Clear();
        var stored = await db.Policies.SingleAsync();
        Assert.Equal(updated, stored.SpecsJson); Assert.Equal(100, stored.Premium); Assert.Equal(80, stored.NetPremium);
        Assert.Equal("ABC1234", stored.VehicleRegistrationPlate); Assert.Equal("EUR", stored.Currency);
    }

    [Fact]
    public async Task Invalid_ownership_does_not_change_the_policy_or_vehicle()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var policy = new Policy { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value, PolicyNumber = "OWNERS",
            VehicleRegistrationPlate = "ABC1234", Premium = 100, SpecsJson = """{"make":"Toyota"}""" };
        db.Policies.Add(policy); await db.SaveChangesAsync();
        var command = new UpdatePolicyVehicleCommand(policy.Id, new UpdatePolicyVehicleBody(
            VehicleRegistrationPlate: "CHANGE",
            SpecsJson: """{"ownerCount":2,"vehicleOwnership":[{"percentage":60},{"percentage":60}]}""",
            ReplaceDetails: true));
        await Assert.ThrowsAsync<AppException>(() => new UpdatePolicyVehicleHandler(db, current, null!).Handle(command, default));
        Assert.Equal("ABC1234", policy.VehicleRegistrationPlate);
        db.ChangeTracker.Clear();
        var stored = await db.Policies.SingleAsync();
        Assert.Equal("ABC1234", stored.VehicleRegistrationPlate); Assert.Equal(100, stored.Premium);
        Assert.Equal("""{"make":"Toyota"}""", stored.SpecsJson);
    }

    private sealed class DetailMediator : IMediator
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
