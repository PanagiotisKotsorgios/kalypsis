using Kalypsis.Application.Features.Phase11;
using Kalypsis.Domain.Entities;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MySqlConnector;
using Xunit;

namespace Kalypsis.Tests;

public sealed class MySqlSchemaFactAttribute : FactAttribute
{
    public MySqlSchemaFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("KALYPSIS_TEST_MYSQL")))
            Skip = "Set KALYPSIS_TEST_MYSQL to an isolated MySQL test server (CREATE/DROP database permission required).";
    }
}

public sealed class EncryptedColumnSchemaTests
{
    [Fact]
    public void Repair_targets_use_actual_EF_table_case_converters_and_lengths()
    {
        TestScaffold.EnsureEncryptorBooted();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=127.0.0.1;Database=metadata_only;User=test", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new AppDbContext(options, TestScaffold.AgencyStaff(Guid.NewGuid()), TestScaffold.Clock);
        var targets = EncryptedColumnSchemaRepair.Targets(db.Model);
        Assert.Contains(new EncryptedColumnSchemaRepair.Target("Garages", "Iban", 500), targets);
        Assert.DoesNotContain(targets, target => target.Table == "garages");
        Assert.Contains(targets, target => target.Column == "AccessTokenEncrypted" && target.MinimumLength == 3000);
        Assert.DoesNotContain(targets, target => target.Column == nameof(Garage.Phone));
        Assert.DoesNotContain(targets, target => target.Column == "MedicalExamsNotes"); // Already longtext.
    }

    [MySqlSchemaFact]
    public async Task Real_MySQL_reproduces_legacy_IBAN_failure_then_repairs_and_saves_encrypted_garages()
    {
        TestScaffold.EnsureEncryptorBooted();
        var builder = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("KALYPSIS_TEST_MYSQL")!) { Database = "" };
        await using var admin = new MySqlConnection(builder.ConnectionString);
        await admin.OpenAsync();
        // Only this random, test-owned database is created and dropped. Never use an application database.
        var database = "kalypsis_encrypted_regression_" + Guid.NewGuid().ToString("N");
        await using var create = admin.CreateCommand(); create.CommandText = $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4";
        await create.ExecuteNonQueryAsync();
        try
        {
            builder.Database = database; builder.Pooling = false;
            var current = TestScaffold.AgencyStaff(Guid.NewGuid());
            var options = new DbContextOptionsBuilder<AppDbContext>().UseMySql(builder.ConnectionString, new MySqlServerVersion(new Version(8, 0, 36))).Options;
            await using var db = new AppDbContext(options, current, TestScaffold.Clock);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE TABLE `Garages` (
                  `Id` char(36) NOT NULL PRIMARY KEY, `TenantId` char(36) NOT NULL, `AgencyOfficeScopeId` char(36) NULL,
                  `CreatedAt` datetime(6) NOT NULL, `UpdatedAt` datetime(6) NULL, `DeletedAt` datetime(6) NULL,
                  `Code` varchar(40) NOT NULL, `Name` varchar(200) NOT NULL, `Afm` varchar(20) NULL,
                  `Address` varchar(300) NULL, `City` varchar(120) NULL, `PostalCode` varchar(20) NULL,
                  `Phone` varchar(40) NULL, `Email` varchar(160) NULL, `Specialty` varchar(80) NULL,
                  `Iban` varchar(40) NULL COMMENT 'Preserve legacy IBAN', `IsApproved` tinyint(1) NOT NULL, `IsActive` tinyint(1) NOT NULL, `Notes` varchar(2000) NULL, `ProfileJson` longtext NULL,
                  UNIQUE KEY `IX_Garage_Code` (`TenantId`, `Code`)
                );
                CREATE TABLE `audit_logs` (
                  `Id` char(36) NOT NULL PRIMARY KEY, `TenantId` char(36) NULL, `UserId` char(36) NULL,
                  `CreatedAt` datetime(6) NOT NULL, `UpdatedAt` datetime(6) NULL, `DeletedAt` datetime(6) NULL,
                  `EntityName` varchar(128) NOT NULL, `EntityId` varchar(64) NOT NULL, `Action` varchar(64) NOT NULL,
                  `Category` varchar(48) NULL, `PagePath` varchar(512) NULL, `Target` varchar(256) NULL,
                  `Metadata` text NULL, `OldValues` text NULL, `NewValues` text NULL, `IpAddress` varchar(64) NULL, `UserAgent` varchar(512) NULL
                );
                CREATE TABLE `carrier_connections` (`Id` int PRIMARY KEY, `ClientSecretEncrypted` varchar(8) NOT NULL DEFAULT 'legacy' COMMENT 'Do not change default');
                INSERT INTO `carrier_connections` (`Id`) VALUES (1);
                CREATE TABLE `bank_connections` (`Iban` varchar(1000) NULL);
                CREATE TABLE `customers` (`Amka` longtext NULL);
                """);
            var legacyId = Guid.NewGuid();
            const string iban = "GR1601101250000000012300701";
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO `Garages` (`Id`,`TenantId`,`Code`,`Name`,`CreatedAt`,`Iban`,`IsApproved`,`IsActive`) VALUES ({legacyId},{current.TenantId},'LEGACY','Legacy',UTC_TIMESTAMP(6),{iban},1,1)");
            var body = new GarageBody(null, "Νέο συνεργείο", null, null, null, null, null, null, null, true, iban, true, null);
            var handler = new CreateGarageHandler(db, current);
            var failure = await Assert.ThrowsAsync<DbUpdateException>(() => handler.Handle(new(body), default));
            Assert.IsType<MySqlException>(failure.InnerException);
            Assert.Contains("Data too long", failure.InnerException!.Message); Assert.Contains("Iban", failure.InnerException.Message);
            db.ChangeTracker.Clear();

            var caseMode = await db.Database.SqlQueryRaw<int>("SELECT @@lower_case_table_names AS Value").SingleAsync();
            if (caseMode == 0) await db.Database.ExecuteSqlRawAsync("CREATE TABLE `garages` (`Iban` varchar(10) NULL)");
            await EncryptedColumnSchemaRepair.EnsureAsync(db, NullLogger.Instance);
            var lengths = await db.Database.SqlQueryRaw<long>("SELECT CHARACTER_MAXIMUM_LENGTH AS Value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY 'Garages' AND COLUMN_NAME = 'Iban'").ToListAsync();
            // Windows normalizes physical table names; Linux must retain the exact mapped casing.
            if (caseMode == 0) { Assert.Equal(500L, Assert.Single(lengths)); Assert.Equal(10L, await db.Database.SqlQueryRaw<long>("SELECT CHARACTER_MAXIMUM_LENGTH AS Value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = BINARY 'garages' AND COLUMN_NAME = 'Iban'").SingleAsync()); }
            else Assert.Equal(500L, await db.Database.SqlQueryRaw<long>("SELECT CHARACTER_MAXIMUM_LENGTH AS Value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'garages' AND COLUMN_NAME = 'Iban'").SingleAsync());

            var saved = await handler.Handle(new(body), default);
            db.ChangeTracker.Clear();
            Assert.Equal(iban, (await db.Garages.SingleAsync(row => row.Id == saved.Id)).Iban);
            var ciphertext = await db.Database.SqlQueryRaw<string>("SELECT `Iban` AS Value FROM `Garages` WHERE `Id` = {0}", saved.Id).SingleAsync();
            Assert.StartsWith("kx1:", ciphertext); Assert.True(ciphertext.Length > 40); Assert.DoesNotContain(iban, ciphertext);
            Assert.Equal(iban, await db.Database.SqlQueryRaw<string>("SELECT `Iban` AS Value FROM `Garages` WHERE `Id` = {0}", legacyId).SingleAsync());
            Assert.Equal(1000L, await db.Database.SqlQueryRaw<long>("SELECT CHARACTER_MAXIMUM_LENGTH AS Value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_connections' AND COLUMN_NAME = 'Iban'").SingleAsync());
            await db.Database.ExecuteSqlRawAsync("INSERT INTO `carrier_connections` (`Id`) VALUES (2)");
            Assert.Equal("legacy", await db.Database.SqlQueryRaw<string>("SELECT `ClientSecretEncrypted` AS Value FROM `carrier_connections` WHERE `Id` = 2").SingleAsync());
            var nullable = await db.Database.SqlQueryRaw<string>("SELECT IS_NULLABLE AS Value FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'carrier_connections' AND COLUMN_NAME = 'ClientSecretEncrypted'").SingleAsync();
            Assert.Equal("NO", nullable);
            var audits = await db.AuditLogs.CountAsync();
            await EncryptedColumnSchemaRepair.EnsureAsync(db, NullLogger.Instance);
            Assert.Equal(audits, await db.AuditLogs.CountAsync()); Assert.Equal(2, await db.Garages.CountAsync());
        }
        finally
        {
            await using var drop = admin.CreateCommand(); drop.CommandText = $"DROP DATABASE `{database}`"; await drop.ExecuteNonQueryAsync();
        }
    }
}
