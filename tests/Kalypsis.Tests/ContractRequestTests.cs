using System.Net;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Public;
using Kalypsis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class ContractRequestTests
{
    private sealed class CapturingEmail(bool success = true) : IEmailSender
    {
        public List<EmailMessage> Messages { get; } = [];
        public Task<EmailResult> SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
        { Messages.Add(message); return Task.FromResult(new EmailResult(success)); }
        public Task<bool> IsConfiguredAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<KeyValidationResult> ValidateKeyAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(new KeyValidationResult(true, null, null, null, null));
    }
    private static PublicContactBody Body => new("contract", "Άννα", "Δοκιμή", "anna@example.test", "+30 210 1234567", "Αθήνα",
        "Αίτημα σύμβασης συνεργασίας KALYPSIS", "Παρακαλώ αποστείλετε τη σύμβαση συνεργασίας KALYPSIS.", true,
        CompanyName: "Γραφείο δοκιμών");
    private static FakeUser Anonymous => new(null, null, null, false, false);

    [Fact]
    public async Task Contract_request_sends_one_email_to_Kalypsis_and_preserves_a_request_without_signing_a_DPA()
    {
        await using var db = TestScaffold.NewDb(Anonymous, TestScaffold.Clock);
        db.PlatformSettings.Add(new PlatformSetting { Id = Guid.NewGuid(), SupportEmail = "support@example.test" });
        await db.SaveChangesAsync();
        var mail = new CapturingEmail();
        var result = await new SubmitPublicContactHandler(mail, db).Handle(new(Body, "127.0.0.1", "unit-test"), default);
        Assert.True(result.Delivered);
        var request = await db.RegistrationRequests.SingleAsync();
        Assert.Equal(result.Reference, request.ReferenceCode);
        Assert.Equal("Αίτημα σύμβασης συνεργασίας", request.Category);
        Assert.Equal(Body.CompanyName, request.OrganizationName); Assert.Equal(Body.AgencyOrCity, request.City);
        Assert.Contains("Συγκατάθεση επικοινωνίας: Ναι", request.Message);
        Assert.False(request.DpaAccepted); Assert.Null(request.DpaAcceptedAt); Assert.Null(request.DpaVersion);
        var email = Assert.Single(mail.Messages);
        Assert.Equal("support@example.test", email.ToEmail); Assert.Contains("[ΣΥΜΒΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ]", email.Subject);
        Assert.Contains(WebUtility.HtmlEncode(Body.CompanyName!), email.HtmlBody);
        Assert.Null(email.Attachments); // A request, not a fabricated contract.
    }

    [Theory]
    [InlineData("", "+30 210 1234567", true)]
    [InlineData("Office", "123", true)]
    [InlineData("Office", "abcdefghij", true)]
    [InlineData("Office", "1234567890123456", true)]
    [InlineData("Office", "2101234567", false)]
    public async Task Invalid_requests_cannot_bypass_required_company_phone_or_consent(string company, string phone, bool consent)
    {
        await using var db = TestScaffold.NewDb(Anonymous, TestScaffold.Clock);
        var mail = new CapturingEmail();
        await Assert.ThrowsAsync<AppException>(() => new SubmitPublicContactHandler(mail, db)
            .Handle(new(Body with { CompanyName = company, Phone = phone, Consent = consent }, null, null), default));
        Assert.Empty(mail.Messages); Assert.Empty(await db.RegistrationRequests.ToListAsync());
    }

    [Fact]
    public async Task Length_guards_and_honeypot_prevent_unwanted_submissions()
    {
        await using var db = TestScaffold.NewDb(Anonymous, TestScaffold.Clock);
        var mail = new CapturingEmail(); var handler = new SubmitPublicContactHandler(mail, db);
        foreach (var body in new[] { Body with { CompanyName = new string('x', 201) }, Body with { FirstName = new string('x', 121) }, Body with { AgencyOrCity = new string('x', 121) } })
            await Assert.ThrowsAsync<AppException>(() => handler.Handle(new(body, null, null), default));
        var result = await handler.Handle(new(Body with { Website = "bot.example" }, null, null), default);
        Assert.False(result.Delivered); Assert.Empty(mail.Messages); Assert.Empty(await db.RegistrationRequests.ToListAsync());
    }

    [Fact]
    public async Task Mail_failure_retains_request_and_reports_delivery_honestly()
    {
        await using var db = TestScaffold.NewDb(Anonymous, TestScaffold.Clock);
        var mail = new CapturingEmail(false);
        var result = await new SubmitPublicContactHandler(mail, db).Handle(new(Body with { AgencyOrCity = null }, null, null), default);
        Assert.False(result.Delivered); Assert.Single(await db.RegistrationRequests.ToListAsync());
        Assert.Equal("info@mykalypsis.gr", Assert.Single(mail.Messages).ToEmail);
    }

    [Fact]
    public async Task Html_is_encoded_and_existing_package_interest_flow_is_unchanged()
    {
        await using var db = TestScaffold.NewDb(Anonymous, TestScaffold.Clock);
        var mail = new CapturingEmail(); var handler = new SubmitPublicContactHandler(mail, db);
        await handler.Handle(new(Body with { CompanyName = "<script>alert(1)</script>" }, null, null), default);
        Assert.DoesNotContain("<script>", mail.Messages[0].HtmlBody);
        Assert.Contains("&lt;script&gt;", mail.Messages[0].HtmlBody);
        await handler.Handle(new(Body with { InquiryType = "sales", CompanyName = null, SelectedPackage = "BackOffice" }, null, null), default);
        var legacy = await db.RegistrationRequests.SingleAsync(x => x.Category == "Εκδήλωση ενδιαφέροντος πακέτου");
        Assert.True(legacy.DpaAccepted); Assert.Contains("BackOffice", legacy.Message); Assert.Contains("[SALES]", mail.Messages[1].Subject);
    }
}
