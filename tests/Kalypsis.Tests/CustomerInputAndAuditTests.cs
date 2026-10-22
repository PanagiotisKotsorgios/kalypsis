using Kalypsis.Application.Common;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Features.Customers;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kalypsis.Tests;

public class CustomerInputAndAuditTests
{
    [Theory]
    [InlineData("phone", "2101234567", true)]
    [InlineData("phone", "210 123 4567", true)]
    [InlineData("phone", "+30 (210) 123-4567", true)]
    [InlineData("phone", "0030 210 1234567", true)]
    [InlineData("phone", "+442012345678", true)]
    [InlineData("phone", "210123456", false)]
    [InlineData("phone", "21012345678", false)]
    [InlineData("phone", "abc2101234567", false)]
    [InlineData("phone", "210+1234567", false)]
    [InlineData("phone", "+1234567890123456", false)]
    [InlineData("phone", "+3021012345678", false)]
    [InlineData("mobilePhone", "6912345678", true)]
    [InlineData("secondaryMobilePhone", "γράμματα", false)]
    [InlineData("thirdPhone", "", true)]
    [InlineData("email", "person+test@example.gr", true)]
    [InlineData("secondaryEmail", "abc", false)]
    [InlineData("email", "a b@example.gr", false)]
    [InlineData("email", "a@@example.gr", false)]
    [InlineData("email", "a@example", false)]
    [InlineData("email", "a..b@example.gr", false)]
    [InlineData("email", ".a@example.gr", false)]
    [InlineData("email", "a@-example.gr", false)]
    [InlineData("email", "a@exa_mple.gr", false)]
    [InlineData("email", "δοκιμή@παράδειγμα.gr", true)]
    [InlineData("email", null, true)]
    [InlineData("vatNumber", "012345678", true)]
    [InlineData("vatNumber", "1234567890", false)]
    [InlineData("vatNumber", "12345678", false)]
    [InlineData("vatNumber", "12345678A", false)]
    [InlineData("vatNumber", "123 456 789", false)]
    [InlineData("amka", "01234567890", true)]
    [InlineData("amka", "12345", false)]
    [InlineData("postalCode", "30100", true)]
    [InlineData("postalCode", "301 00", true)]
    [InlineData("postalCode", "30abc", false)]
    [InlineData("photoUrl", "https://example.gr/image.png", true)]
    [InlineData("photoUrl", "javascript:alert(1)", false)]
    [InlineData("photoUrl", "file:///C:/image.png", false)]
    public void Input_formats_are_checked_without_mutating_values(string field, string? value, bool valid) =>
        Assert.Equal(valid, ContactValueRules.Error(field, value) is null);

    private static CreateCustomerRequest ValidRequest() => new(CustomerType.Individual, "Δοκιμή", "Πελάτη", null,
        "012345678", "valid@example.gr", "2101234567", null, "Αθήνα", "10431", null, null, false);

    [Fact]
    public void Creation_and_updates_enforce_formats_and_cross_field_dates()
    {
        var request = ValidRequest();
        CustomerInputValidation.Ensure(request);
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { Phone = "letters" }));
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { VatNumber = "1234567890" }));
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { Email = "invalid" }));
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { BirthDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)) }));
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { DriverLicenseIssueDate = new(2026, 1, 1), DriverLicenseExpiryDate = new(2025, 1, 1) }));
        var legacy = new Customer { Phone = "legacy", VatNumber = "old", Email = "old", Type = CustomerType.Individual };
        // Updating an unrelated field remains possible on imported/legacy records.
        CustomerInputValidation.Ensure(request with { Phone = "legacy", VatNumber = "old", Email = "old" }, legacy);
        Assert.Throws<AppException>(() => CustomerInputValidation.Ensure(request with { Phone = "another invalid" }, legacy));
    }

    [Fact]
    public async Task Invalid_channel_profile_contact_and_customer_edits_cannot_bypass_the_server()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var customer = new Customer { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value,
            Type = CustomerType.Individual, CustomerNumber = "VALIDATION", FirstName = "Δοκιμή", Phone = "2101234567" };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new UpdateCustomerCommandHandler(db, current)
            .Handle(new(customer.Id, ValidRequest() with { Phone = "bad" }), default));
        Assert.Equal("2101234567", customer.Phone);
        await Assert.ThrowsAsync<AppException>(() => new UpdateCustomerCommunicationFieldHandler(db, current)
            .Handle(new(customer.Id, new("thirdPhone", "bad")), default));
        await Assert.ThrowsAsync<AppException>(() => new UpdateCustomerProfileHandler(db, current)
            .Handle(new(customer.Id, new(null, null, null, "letters", null)), default));
        await Assert.ThrowsAsync<AppException>(() => new CreateContactHandler(db, current)
            .Handle(new(customer.Id, new("Επαφή", "Δοκιμής", null, "bad-email", "2101234567", null, false)), default));
        Assert.Empty(await db.CustomerContacts.ToListAsync());
        Assert.Null(customer.ThirdPhone);
    }

    [Fact]
    public void Audit_preserves_old_new_null_and_missing_and_never_exposes_secrets()
    {
        var changes = AuditChangeReader.Read(
            """{"Phone":"2101234567","Email":null,"Status":2,"PasswordHash":"old-secret","Unknown":"private","UpdatedAt":"old"}""",
            """{"Phone":"2109876543","Email":"new@example.gr","Status":1,"PasswordHash":"new-secret","Unknown":"other","UpdatedAt":"new"}""",
            knownFieldsOnly: true, entityName: "Customer");
        Assert.Equal(3, changes.Count);
        var phone = Assert.Single(changes, c => c.Field == "Phone");
        Assert.Equal("Τηλέφωνο", phone.Label);
        Assert.Equal("2101234567", phone.Before);
        Assert.Equal("2109876543", phone.After);
        Assert.True(phone.BeforeRecorded && phone.AfterRecorded);
        var email = Assert.Single(changes, c => c.Field == "Email");
        Assert.True(email.BeforeRecorded);
        Assert.Null(email.Before);
        Assert.Equal("Active", changes.Single(c => c.Field == "Status").Before);
        Assert.Equal("Prospect", changes.Single(c => c.Field == "Status").After);
        var legacy = Assert.Single(AuditChangeReader.Read(null, """{"Phone":"2101234567"}"""));
        Assert.False(legacy.BeforeRecorded);
        Assert.True(legacy.AfterRecorded);
        Assert.Empty(AuditChangeReader.Read("{broken", "not JSON"));
        Assert.Empty(AuditChangeReader.Read("{}", """{"Password":"secret","Token":"secret","Secret":"secret","ApiKey":"secret"}"""));
        Assert.Empty(AuditChangeReader.Read("""{"Phone":"same"}""", """{"Phone":"same"}"""));
    }

    [Fact]
    public async Task All_general_profile_and_licence_fields_round_trip_without_overwriting_other_data()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var request = ValidRequest() with {
            BirthDate = new(1990, 5, 20), Gender = "Female", Nationality = "Ελληνική", MaritalStatus = "Married",
            PassportNumber = "PASSPORT1", FatherName = "Πατέρας", MotherName = "Μητέρα", SpouseName = "Σύζυγος",
            GemiNumber = "123456789012", LegalForm = "ΙΚΕ", Source = "Σύσταση", TagsJson = "[\"VIP\"]",
            PhotoUrl = "https://example.gr/photo.png", Zone = "Δυτική Ελλάδα", DriverLicenseNumber = "LICENCE1",
            DriverLicenseClass = "Β", DriverLicenseIssueDate = new(2010, 1, 1), DriverLicenseExpiryDate = new(2030, 1, 1),
            PaymentDueDate = new(2026, 12, 1), Occupation = "Ασφαλιστής", Employer = "Επιχείρηση",
            MobilePhone = "6912345678", ActivityCode = "6622", AltPhone = "2109876543", Amka = "01234567890"
        };
        var create = new CreateCustomerCommandHandler(db, current, new NoPortalHasher(), new NoPortalPackages());
        await Assert.ThrowsAsync<AppException>(() => create.Handle(new(request with { Phone = "invalid" }), default));
        Assert.Empty(await db.Customers.ToListAsync());
        var created = await create.Handle(new(request), default);
        var edited = await new UpdateCustomerCommandHandler(db, current).Handle(new(created.Customer.Id,
            request with { FirstName = "Νέο όνομα" }), default);
        var loaded = await new GetCustomerQueryHandler(db, current).Handle(new(edited.Id), default);
        foreach (var property in typeof(CreateCustomerRequest).GetProperties()
            .Where(p => p.Name is not ("CreatePortalAccount" or "FirstName")))
            Assert.Equal(property.GetValue(request), typeof(CustomerDto).GetProperty(property.Name)!.GetValue(loaded));
        Assert.Equal("Νέο όνομα", loaded.FirstName);
        var profile = await new GetCustomerFamilyProfileHandler(db, current, TestScaffold.Clock).Handle(new(loaded.Id), default);
        Assert.Equal(loaded.Occupation, profile.Profile.Occupation);
        Assert.Equal(loaded.MaritalStatus, profile.Profile.MaritalStatus);
        Assert.Equal(loaded.Nationality, profile.Profile.Nationality);
        Assert.Equal(loaded.MobilePhone, profile.Profile.MobilePhone);
        var history = await new CustomerHistoryHandler(db, current).Handle(new(loaded.Id, null, null, null, null), default);
        var name = Assert.Single(history.Items.SelectMany(row => row.Changes ?? []), change => change.Field == "FirstName");
        Assert.Equal(request.FirstName, name.Before);
        Assert.Equal("Νέο όνομα", name.After);
    }

    // Customer creation without portal must not touch authentication or packages.
    private sealed class NoPortalHasher : IPasswordHasher
    {
        public string Hash(string password) => throw new InvalidOperationException("Unexpected portal creation");
        public bool Verify(string password, string hash) => throw new InvalidOperationException("Unexpected authentication");
    }
    private sealed class NoPortalPackages : IPackageService
    {
        public Task<bool> HasAsync(Guid tenantId, PackageCode package, CancellationToken ct = default) => throw new InvalidOperationException("Unexpected portal creation");
        public Task<IReadOnlySet<PackageCode>> GetEnabledAsync(Guid tenantId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SetAsync(Guid tenantId, IEnumerable<PackageCode> packages, Guid? enabledByUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task GrantAllDefaultsAsync(Guid tenantId, Guid? enabledByUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public void InvalidateCache(Guid tenantId) => throw new NotSupportedException();
    }
}
