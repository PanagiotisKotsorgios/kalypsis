using Kalypsis.Application.Common;
using Kalypsis.Application.Features.Phase11;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Persistence.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using MySqlConnector;
using Xunit;

namespace Kalypsis.Tests;

public sealed class GarageProfileTests
{
    [Fact]
    public void Garage_schema_changes_are_included_in_the_migration_snapshot()
    {
        TestScaffold.EnsureEncryptorBooted();
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=127.0.0.1;Database=metadata_only;User=test", new MySqlServerVersion(new Version(8, 4, 11))).Options,
            TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock);
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot!.Model;
        foreach (var type in new[] { typeof(Garage), typeof(GarageInsuranceCompany) })
        {
            var expected = snapshot.FindEntityType(type.FullName!)!;
            var actual = db.Model.FindEntityType(type)!;
            Assert.Equal(expected.GetTableName(), actual.GetTableName());
            Assert.Equal(expected.GetProperties().Select(p => (p.Name, p.IsNullable, Column: p.GetColumnType())).OrderBy(p => p.Name),
                actual.GetProperties().Select(p => (p.Name, p.IsNullable, Column: p.GetColumnType())).OrderBy(p => p.Name));
            Assert.Equal(expected.GetIndexes().Select(i => (i.GetDatabaseName(), i.IsUnique)).OrderBy(i => i.Item1),
                actual.GetIndexes().Select(i => (i.GetDatabaseName(), i.IsUnique)).OrderBy(i => i.Item1));
            Assert.Equal(expected.GetForeignKeys().Select(f => (f.GetConstraintName(), f.DeleteBehavior)).OrderBy(f => f.Item1),
                actual.GetForeignKeys().Select(f => (f.GetConstraintName(), f.DeleteBehavior)).OrderBy(f => f.Item1));
        }
    }

    private static GarageBody Body(GarageDto? current = null, GarageProfile? profile = null, Guid[]? companies = null) =>
        new(current?.Code, current?.Name ?? "Συνεργείο δοκιμής", null, "Διεύθυνση", "Αθήνα", "11111", "2101234567", "office@example.com", "Φανοποιείο", true, null, true, null, profile, companies);

    [Fact]
    public async Task Profiles_and_company_links_persist_preserve_legacy_edits_and_can_be_removed_and_restored()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid());
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var company = new InsuranceCompany { Id = Guid.NewGuid(), TenantId = current.TenantId, Name = "Εταιρεία", Code = "G" };
        db.InsuranceCompanies.Add(company); await db.SaveChangesAsync();
        var profile = new GarageProfile(OwnerName: "Ιδιοκτήτης", Region: "Αττική", MobilePhone: "6912345678", ContactName: "Υπεύθυνος", ContactEmail: "first@example.com", SecondContactName: "Δεύτερη επαφή", SecondContactEmail: "second@example.com", OpeningHours: "09:00–17:00", VehicleBrands: "Toyota", Website: "https://example.com");
        var garage = await new CreateGarageHandler(db, current).Handle(new(Body(profile: profile, companies: [company.Id, company.Id])), default);
        Assert.Equal(profile, garage.Profile); Assert.Equal(company.Id, Assert.Single(garage.InsuranceCompanies!).Id);
        db.ChangeTracker.Clear();
        var listed = Assert.Single(await new ListGaragesHandler(db).Handle(new(), default));
        Assert.Equal(profile, listed.Profile); Assert.Equal("Εταιρεία", Assert.Single(listed.InsuranceCompanies!).Name);
        var update = new UpdateGarageHandler(db, current);
        var legacy = await update.Handle(new(garage.Id, Body(listed)), default);
        Assert.Equal(profile, legacy.Profile); Assert.Single(legacy.InsuranceCompanies!);
        var cleared = await update.Handle(new(garage.Id, Body(legacy, profile with { ContactEmail = null }, [])), default);
        Assert.Null(cleared.Profile!.ContactEmail); Assert.Equal(profile.SecondContactEmail, cleared.Profile.SecondContactEmail); Assert.Empty(cleared.InsuranceCompanies!);
        var restored = await update.Handle(new(garage.Id, Body(cleared, companies: [company.Id])), default);
        Assert.Single(restored.InsuranceCompanies!);
        Assert.Single(db.GarageInsuranceCompanies.IgnoreQueryFilters());
        var blocked = await Assert.ThrowsAsync<AppException>(() => new DeleteGarageHandler(db).Handle(new(garage.Id), default));
        Assert.Equal(409, blocked.StatusCode);
        await update.Handle(new(garage.Id, Body(restored, companies: [])), default);
        await new DeleteGarageHandler(db).Handle(new(garage.Id), default);
        Assert.Empty(db.Garages);
    }

    [Fact]
    public async Task Another_tenants_company_or_a_missing_company_cannot_be_attached()
    {
        var tenant = Guid.NewGuid(); var current = TestScaffold.AgencyStaff(tenant);
        var database = Guid.NewGuid().ToString("N");
        await using var db = TestScaffold.NewDb(current, TestScaffold.Clock, database);
        await using var adminDb = TestScaffold.NewDb(TestScaffold.PlatformAdmin(), TestScaffold.Clock, database);
        var foreign = new InsuranceCompany { TenantId = Guid.NewGuid(), Name = "Foreign company", Code = "FOREIGN" };
        adminDb.InsuranceCompanies.Add(foreign); await adminDb.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new CreateGarageHandler(db, current).Handle(new(Body(companies: [foreign.Id])), default));
        await Assert.ThrowsAsync<AppException>(() => new CreateGarageHandler(db, current).Handle(new(Body(companies: [Guid.NewGuid()])), default));
        Assert.Empty(db.Garages);
    }

    [Theory]
    [InlineData("phone")]
    [InlineData("email")]
    [InlineData("website")]
    public async Task Invalid_contact_values_are_rejected_before_any_garage_is_written(string field)
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var profile = field switch { "phone" => new GarageProfile(ContactPhone: "abc"), "email" => new GarageProfile(SecondContactEmail: "not an email"), _ => new GarageProfile(Website: "javascript:alert(1)") };
        await Assert.ThrowsAsync<AppException>(() => new CreateGarageHandler(db, current).Handle(new(Body(profile: profile)), default));
        Assert.Empty(db.Garages);
    }

    [Fact]
    public async Task Garage_with_linked_indemnities_cannot_be_deleted()
    {
        var current = TestScaffold.AgencyStaff(Guid.NewGuid()); await using var db = TestScaffold.NewDb(current, TestScaffold.Clock);
        var garage = await new CreateGarageHandler(db, current).Handle(new(Body()), default);
        db.ClaimIndemnities.Add(new ClaimIndemnity { Id = Guid.NewGuid(), TenantId = current.TenantId!.Value, GarageId = garage.Id, ClaimId = Guid.NewGuid(), PaymentNumber = "TEST", Amount = 10 });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AppException>(() => new DeleteGarageHandler(db).Handle(new(garage.Id), default));
        Assert.Null((await db.Garages.FindAsync(garage.Id))!.DeletedAt);
    }

    [MySqlSchemaFact]
    public async Task MySQL_upgrade_preserves_garages_and_supports_retry_safe_profile_and_multiple_company_storage()
    {
        TestScaffold.EnsureEncryptorBooted();
        var connection = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("KALYPSIS_TEST_MYSQL")!) { Database = "", Pooling = false };
        await using var admin = new MySqlConnection(connection.ConnectionString); await admin.OpenAsync();
        var database = "kalypsis_garage_test_" + Guid.NewGuid().ToString("N");
        await using var command = admin.CreateCommand(); command.CommandText = $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4"; await command.ExecuteNonQueryAsync();
        try
        {
            connection.Database = database;
            var current = TestScaffold.AgencyStaff(Guid.NewGuid());
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql(connection.ConnectionString, new MySqlServerVersion(new Version(8, 4, 11))).Options, current, TestScaffold.Clock);
            // Exercise the real provider schema for this aggregate without
            // creating hundreds of unrelated application tables in this test.
            var statements = db.Database.GenerateCreateScript().Split(';');
            var tables = new[] { "insurance_companies", "Garages", "GarageInsuranceCompanies", "audit_logs" };
            foreach (var table in tables)
                await db.Database.ExecuteSqlRawAsync(statements.Single(sql => sql.TrimStart().StartsWith($"CREATE TABLE `{table}`", StringComparison.Ordinal)) + ";");
            foreach (var sql in statements.Where(sql => sql.TrimStart().StartsWith("CREATE", StringComparison.Ordinal)
                && sql.Contains(" INDEX ", StringComparison.Ordinal) && tables.Any(table => sql.Contains($" ON `{table}`", StringComparison.Ordinal))))
                await db.Database.ExecuteSqlRawAsync(sql + ";");
            var legacy = await new CreateGarageHandler(db, current).Handle(new(Body()), default);
            await db.Database.ExecuteSqlRawAsync("DROP TABLE `GarageInsuranceCompanies`");
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE `Garages` DROP COLUMN `ProfileJson`");
            var migration = new AddGarageProfilesAndCompanyLinks();
            // EF migrations execute their session variables and PREPARE on a
            // single open connection. Separate ExecuteSqlRaw calls otherwise
            // return/reset that connection between these statements.
            await db.Database.OpenConnectionAsync();
            foreach (var pass in new[] { 1, 2 })
                foreach (var operation in migration.UpOperations.Cast<SqlOperation>()) await db.Database.ExecuteSqlRawAsync(operation.Sql);
            db.ChangeTracker.Clear();
            Assert.Equal(legacy.Id, (await db.Garages.SingleAsync()).Id);
            var companies = new[] { new InsuranceCompany { Name = "Company 1", Code = "G1", TenantId = current.TenantId }, new InsuranceCompany { Name = "Company 2", Code = "G2", TenantId = current.TenantId } };
            db.InsuranceCompanies.AddRange(companies); await db.SaveChangesAsync();
            var updated = await new UpdateGarageHandler(db, current).Handle(new(legacy.Id, Body(legacy, new GarageProfile(OwnerName: "Ιδιοκτήτης", ContactEmail: "owner@example.com"), companies.Select(x => x.Id).ToArray())), default);
            Assert.Equal(2, updated.InsuranceCompanies!.Count); Assert.Equal("Ιδιοκτήτης", updated.Profile!.OwnerName);
            db.ChangeTracker.Clear();
            Assert.Equal(2, Assert.Single(await new ListGaragesHandler(db).Handle(new(), default)).InsuranceCompanies!.Count);
        }
        finally { command.CommandText = $"DROP DATABASE `{database}`"; await command.ExecuteNonQueryAsync(); }
    }
}
