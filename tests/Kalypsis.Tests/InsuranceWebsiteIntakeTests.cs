using System.Text.Json;
using Kalypsis.Api.Controllers;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class InsuranceWebsiteIntakeTests
{
    private sealed class CapturingEmail : IEmailSender
    {
        public List<EmailMessage> Messages { get; } = [];
        public Task<EmailResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        { Messages.Add(message); return Task.FromResult(new EmailResult(true)); }
        public Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<KeyValidationResult> ValidateKeyAsync(CancellationToken cancellationToken = default) => Task.FromResult(new KeyValidationResult(true, null, null, null, null));
    }

    private static PublicOfficeWebsiteController.InsuranceRequestBody ValidRequest(string type = "Κατοικία") =>
        new("Δοκιμή Αιτήματος", type, "Αθήνα", "insurance-test@example.com", "2101234567", "phone", "Πρόταση για κατοικία", true);

    [Theory]
    [InlineData("Αυτοκίνητο")]
    [InlineData("Κατοικία")]
    [InlineData("Υγεία")]
    [InlineData("Ζωή")]
    [InlineData("Επαγγελματική ασφάλιση")]
    public async Task Product_request_is_persisted_unpublished_and_returns_real_reference(string type)
    {
        var tenant = new Tenant { Id = Guid.NewGuid(), Code = "PLATFORM", Name = "KALYPSIS", ContactEmail = "office@example.com" };
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock);
        db.Tenants.Add(tenant);
        db.Users.Add(new User { Id = Guid.NewGuid(), TenantId = tenant.Id, Email = "admin@example.com", Role = Role.PlatformAdmin });
        await db.SaveChangesAsync();
        var mail = new CapturingEmail();
        var controller = new PublicOfficeWebsiteController(db, mail, TestScaffold.Clock);

        var result = Assert.IsType<OkObjectResult>(await controller.SubmitKalypsisInsuranceRequest(ValidRequest(type), default));
        var response = JsonSerializer.SerializeToElement(result.Value);
        var reference = response.GetProperty("reference").GetString();
        Assert.StartsWith("KI-", reference);
        var request = await db.OfficeWebsiteRequests.IgnoreQueryFilters().SingleAsync();
        Assert.Equal(tenant.Id, request.TenantId);
        Assert.Equal(type, request.Product);
        Assert.Equal("insurance-test@example.com", request.Email);
        Assert.Contains(reference!, request.Message);
        Assert.True(request.ConsentGiven);
        Assert.False((await db.OfficeWebsites.IgnoreQueryFilters().SingleAsync()).IsPublished);
        Assert.Single(await db.Notifications.IgnoreQueryFilters().ToListAsync());
        var sent = Assert.Single(mail.Messages);
        Assert.Equal("office@example.com", sent.ToEmail);
        Assert.Contains(reference!, sent.Subject);
    }

    [Theory]
    [InlineData("consent")]
    [InlineData("email")]
    [InlineData("phone")]
    [InlineData("type")]
    [InlineData("subject")]
    public async Task Invalid_request_is_rejected_without_database_or_email_side_effects(string invalid)
    {
        await using var db = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock);
        var mail = new CapturingEmail();
        var body = ValidRequest();
        body = invalid switch
        {
            "consent" => body with { ConsentGiven = false },
            "email" => body with { Email = "invalid" },
            "phone" => body with { Phone = "123" },
            "type" => body with { InsuranceType = "Unknown" },
            _ => body with { InsuranceSubject = "" }
        };
        var controller = new PublicOfficeWebsiteController(db, mail, TestScaffold.Clock);
        Assert.IsType<BadRequestObjectResult>(await controller.SubmitKalypsisInsuranceRequest(body, default));
        Assert.Empty(await db.OfficeWebsiteRequests.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(mail.Messages);
    }
}
