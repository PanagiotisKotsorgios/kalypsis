using System.Collections.Generic;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Carriers;
using Kalypsis.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Kalypsis.Tests;

public sealed class InsureOnePartnerWorkspaceTests
{
    [Fact]
    public async Task Partner_can_create_list_select_and_submit_quote_in_own_workspace()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var producerId = Guid.NewGuid();
        var officeId = Guid.NewGuid();
        var current = new OfficeUser(userId, tenantId, Role.Producer, null);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(current, clock);
        SeedPartner(db, tenantId, userId, producerId, officeId, canIssue: true,
            permissions: new[] { "quoting.read", "quoting.create", "quotes.save", "quotes.history", "quotes.export" });
        await db.SaveChangesAsync();

        var controller = CreateController(db, current, clock);
        var created = await controller.CreateQuote(new InsureOneCreateQuoteRequest("Auto", "{\"plate\":\"ΙΚΧ1234\"}", null, null), default);
        var createResult = Assert.IsType<OkObjectResult>(created.Result);
        var quote = Assert.IsType<InsureOneQuoteDto>(createResult.Value);
        Assert.Equal("Quoted", quote.Status);
        Assert.Single(quote.Offers);

        var list = await controller.Quotes(null, null, null, 1, 20, default);
        var listResult = Assert.IsType<OkObjectResult>(list.Result);
        var page = Assert.IsType<InsureOneQuotePageDto>(listResult.Value);
        Assert.Equal(1, page.Total);
        Assert.Equal(quote.Id, page.Items[0].Id);

        var selected = await controller.SelectOffer(quote.Id, quote.Offers[0].Id, default);
        var selectedResult = Assert.IsType<OkObjectResult>(selected.Result);
        var selectedQuote = Assert.IsType<InsureOneQuoteDto>(selectedResult.Value);
        Assert.Equal("Bound", selectedQuote.Status);
        Assert.Equal(quote.Offers[0].Id, selectedQuote.SelectedOfferId);

        var application = await controller.SubmitApplication(quote.Id, new InsureOneApplicationRequest(null, null, null), default);
        var applicationResult = Assert.IsType<OkObjectResult>(application.Result);
        var applicationDto = Assert.IsType<InsureOneApplicationDto>(applicationResult.Value);
        Assert.Equal("Submitted", applicationDto.Status);
        Assert.Equal(quote.QuoteNumber, applicationDto.QuoteNumber);
    }

    [Fact]
    public async Task Partner_without_create_permission_cannot_start_quote()
    {
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var current = new OfficeUser(userId, tenantId, Role.Producer, null);
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(current, clock);
        SeedPartner(db, tenantId, userId, Guid.NewGuid(), Guid.NewGuid(), canIssue: false, permissions: new[] { "quoting.read" });
        await db.SaveChangesAsync();
        var controller = CreateController(db, current, clock);

        var ex = await Assert.ThrowsAsync<AppException>(() => controller.CreateQuote(new InsureOneCreateQuoteRequest("Auto", "{}", null, null), default));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task Partner_history_isolated_by_authenticated_user()
    {
        var tenantId = Guid.NewGuid();
        var firstUser = Guid.NewGuid();
        var secondUser = Guid.NewGuid();
        var officeId = Guid.NewGuid();
        var clock = TestScaffold.Clock;
        using var db = TestScaffold.NewDb(new OfficeUser(firstUser, tenantId, Role.Producer, null), clock);
        SeedPartner(db, tenantId, firstUser, Guid.NewGuid(), officeId, canIssue: false, permissions: new[] { "quoting.read", "quoting.create", "quotes.history" });
        var secondProducer = new Producer { Id = Guid.NewGuid(), TenantId = tenantId, Name = "Second", Code = "SECOND", CreatedAt = clock.UtcNow };
        var secondAccess = new PartnerPortalAccess { Id = Guid.NewGuid(), TenantId = tenantId, ProducerId = secondProducer.Id, UserId = secondUser, AgencyOfficeScopeId = officeId, IsActive = true, PermissionsJson = "[\"quoting.read\",\"quotes.history\"]", LoginCode = "second", CreatedAt = clock.UtcNow };
        var secondSettings = db.InsureOneOfficeSettings.Local.Single();
        db.Producers.Add(secondProducer); db.PartnerPortalAccesses.Add(secondAccess);
        db.Quotes.Add(new Quote { Id = Guid.NewGuid(), TenantId = tenantId, CreatedByUserId = secondUser, QuoteNumber = "Q-SECOND", ProductType = "Auto", RiskInputsJson = "{}", Status = QuoteStatus.Quoted, CreatedAt = clock.UtcNow });
        await db.SaveChangesAsync();
        var controller = CreateController(db, new OfficeUser(firstUser, tenantId, Role.Producer, null), clock);
        var result = await controller.Quotes(null, null, null, 1, 20, default);
        var page = Assert.IsType<InsureOneQuotePageDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(0, page.Total);
        _ = secondSettings;
    }

    private static void SeedPartner(AppDbContext db, Guid tenantId, Guid userId, Guid producerId, Guid officeId, bool canIssue, string[] permissions)
    {
        var office = new AgencyOffice { Id = officeId, TenantId = tenantId, Code = "HQ", Name = "Demo office", IsHeadquarters = true, IsActive = true };
        var producer = new Producer { Id = producerId, TenantId = tenantId, AgencyOfficeScopeId = officeId, Code = "P-1", Name = "Demo partner", CreatedAt = DateTime.UtcNow };
        var user = new User { Id = userId, TenantId = tenantId, AgencyOfficeScopeId = officeId, Email = $"{userId}@test.local", FirstName = "Demo", LastName = "Partner", Role = Role.Producer, ProducerId = producerId, IsActive = true, CreatedAt = DateTime.UtcNow };
        var settings = new InsureOneOfficeSettings { Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeScopeId = officeId, AgencyOfficeId = officeId, AgencyOffice = office, Slug = $"office-{officeId:N}", DisplayName = "Demo office", IsEnabled = true, PrimaryColor = "#0B6FB8", SecondaryColor = "#0B2545", CreatedAt = DateTime.UtcNow };
        var access = new PartnerPortalAccess { Id = Guid.NewGuid(), TenantId = tenantId, AgencyOfficeScopeId = officeId, ProducerId = producerId, Producer = producer, UserId = userId, User = user, LoginCode = "demo", PermissionsJson = System.Text.Json.JsonSerializer.Serialize(permissions), CanIssuePolicies = canIssue, CanViewCustomers = true, IsActive = true, CreatedAt = DateTime.UtcNow };
        db.AgencyOffices.Add(office); db.Producers.Add(producer); db.Users.Add(user); db.InsureOneOfficeSettings.Add(settings); db.PartnerPortalAccesses.Add(access);
    }

    private static InsureOneController CreateController(AppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    {
        var controller = new InsureOneController(db, current, new TestHasher(), new AlwaysPackages(), new NoopMediator(), new TestStorage(), new FileUploadGate(new SafeFiles(), new CleanAntivirus()), new CarrierAdapterRegistry(new ICarrierAdapter[] { new StubCarrierAdapter("DEMO", "Demo carrier", new[] { "Auto" }) }), clock)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
        return controller;
    }

    private sealed record OfficeUser(Guid? UserId, Guid? TenantId, Role? Role, Guid? AgencyOfficeId) : ICurrentUser
    {
        public string? Email => "test@test.local"; public bool IsAuthenticated => true; public bool IsPlatformLevel => false; public bool IsImpersonating => false; public bool AgencyOfficeIsHeadquarters => true;
    }
    private sealed class TestHasher : IPasswordHasher { public string Hash(string password) => password; public bool Verify(string password, string hash) => password == hash; }
    private sealed class AlwaysPackages : IPackageService
    {
        public Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default) => Task.FromResult(true);
        public Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default) => Task.FromResult<IReadOnlySet<PackageCode>>(new HashSet<PackageCode> { PackageCode.FrontOffice });
        public Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default) => Task.CompletedTask;
        public Task GrantAllDefaultsAsync(Guid tenantId, Guid? enabledByUserId, CancellationToken ct = default) => Task.CompletedTask;
        public void InvalidateCache(Guid tenantId) { }
    }
    private sealed class TestStorage : IFileStorage { public Task<string> UploadAsync(string keyPrefix, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default) => Task.FromResult($"{keyPrefix}/{fileName}"); public Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream()); public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default) => Task.CompletedTask; }
    private sealed class SafeFiles : IFileSafetyService { public Task<FileSafetyResult> InspectAsync(string fileName, string? declaredContentType, Stream content, FileUploadKind kind, CancellationToken ct = default) => Task.FromResult(new FileSafetyResult(true, DetectedContentType: declaredContentType)); }
    private sealed class CleanAntivirus : IAntivirusScanner { public bool IsEnabled => false; public Task<AntivirusScanResult> ScanAsync(Stream content, string fileName, CancellationToken ct = default) => Task.FromResult(AntivirusScanResult.AssumedClean); }
    private sealed class NoopMediator : IMediator
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default) => throw new InvalidOperationException();
        public Task<object?> Send(object request, CancellationToken ct = default) => throw new InvalidOperationException();
        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest => throw new InvalidOperationException();
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default) => throw new NotImplementedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Publish(object notification, CancellationToken ct = default) => Task.CompletedTask;
        public Task Publish<TNotification>(TNotification notification, CancellationToken ct = default) where TNotification : INotification => Task.CompletedTask;
    }
}
