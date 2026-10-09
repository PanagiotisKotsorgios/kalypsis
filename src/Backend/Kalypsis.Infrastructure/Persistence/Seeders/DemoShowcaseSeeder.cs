using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence.Seeders;

/// <summary>
/// Adds the operational data that makes the demo tenant useful for a live
/// walkthrough. Every row is identified by a DEMO-SHOWCASE marker (or a demo
/// policy number), so the operation is safe to run on every application boot.
/// It deliberately does not create files with fake storage paths.
/// </summary>
internal static class DemoShowcaseSeeder
{
    private const string Marker = "DEMO-SHOWCASE";

    public static async Task SeedAsync(
        AppDbContext db,
        IDateTimeProvider clock,
        Tenant tenant,
        User? admin,
        ILogger log,
        CancellationToken ct)
    {
        try
        {
            var now = clock.UtcNow;
            var today = DateOnly.FromDateTime(now);
            var customers = await db.Customers.IgnoreQueryFilters()
                .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null)
                .OrderBy(x => x.CustomerNumber).ToListAsync(ct);
            var producers = await db.Producers.IgnoreQueryFilters()
                .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null)
                .OrderBy(x => x.Code).ToListAsync(ct);
            var policies = await db.Policies.IgnoreQueryFilters()
                .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null && x.PolicyNumber.StartsWith("DEMO-"))
                .OrderBy(x => x.PolicyNumber).ToListAsync(ct);
            var carriers = await db.InsuranceCompanies.IgnoreQueryFilters()
                .Where(x => x.DeletedAt == null && (x.TenantId == null || x.TenantId == tenant.Id))
                .OrderBy(x => x.Name).ToListAsync(ct);

            if (customers.Count == 0 || policies.Count == 0 || carriers.Count == 0)
            {
                log.LogWarning("Demo showcase skipped: base demo data is not ready (customers={Customers}, policies={Policies}, carriers={Carriers})",
                    customers.Count, policies.Count, carriers.Count);
                return;
            }

            await EnrichBaseRecordsAsync(db, tenant, admin, customers, producers, policies, today, now, ct);
            await SeedOfficeAssignmentsAsync(db, tenant, admin, now, ct);
            await SeedCustomerProfilesAsync(db, tenant, customers, today, now, ct);
            await SeedPolicyDetailsAsync(db, tenant, policies, customers, today, now, ct);
            await SeedCommissionDataAsync(db, tenant, policies, producers, carriers, today, now, ct);
            await SeedMoneyFlowAsync(db, tenant, policies, customers, producers, carriers, admin, today, now, ct);
            await SeedClaimsAndDeliveryAsync(db, tenant, policies, customers, today, now, ct);
            await SeedCrmAndOperationsAsync(db, tenant, policies, customers, producers, admin, now, ct);
            await SeedWebsiteAndCashboxAsync(db, tenant, policies, customers, admin, today, now, ct);
            await SeedRequestsAndOperationalShowcaseAsync(db, tenant, policies, customers, producers, carriers, admin, today, now, ct);

            log.LogInformation("Demo showcase data ready for {Tenant}: {Customers} customers, {Policies} policies, {Producers} partners",
                tenant.Code, customers.Count, policies.Count, producers.Count);
        }
        catch (Exception ex)
        {
            // Demo data is optional. Never hold the API in a migration/startup
            // retry loop because a new showcase entity changed independently.
            log.LogError(ex, "Demo showcase seed failed; the application will continue without optional showcase rows.");
        }
    }

    private static async Task EnrichBaseRecordsAsync(
        AppDbContext db, Tenant tenant, User? admin, IReadOnlyList<Customer> customers,
        IReadOnlyList<Producer> producers, IReadOnlyList<Policy> policies,
        DateOnly today, DateTime now, CancellationToken ct)
    {
        foreach (var customer in customers.Take(12))
        {
            customer.PaymentDueDate ??= today.AddDays(14);
            customer.Notes ??= "Δείγμα επίδειξης KALYPSIS — ενδεικτικά στοιχεία για παρουσίαση.";
            if (customer.Type == CustomerType.Individual)
            {
                customer.FatherName ??= "Νικόλαος";
                customer.Nationality ??= "Ελληνική";
                customer.Region ??= "Αττική";
                customer.Occupation ??= "Ελεύθερος επαγγελματίας";
                customer.MaritalStatus ??= "Έγγαμος";
                customer.DriverLicenseNumber ??= $"DEMO-LIC-{customer.CustomerNumber[^4..]}";
                customer.DriverLicenseClass ??= "Β";
                customer.DriverLicenseExpiryDate ??= today.AddYears(4);
            }
        }

        foreach (var producer in producers.Take(8))
        {
            producer.TaxId ??= "099999999";
            producer.TaxOffice ??= "ΔΟΥ Αθηνών";
            producer.BusinessType ??= "Ατομική επιχείρηση";
            producer.ProfessionalCategory ??= "Ασφαλιστικός διαμεσολαβητής";
            producer.HasContract = true;
            producer.ContractNumber ??= $"DEMO-CON-{producer.Code}";
            producer.ContractStartDate ??= today.AddMonths(-18);
            producer.ContractEndDate ??= today.AddMonths(18);
            producer.Address ??= "Λεωφόρος Δημοκρατίας 10";
            producer.City ??= "Αθήνα";
            producer.PostalCode ??= "10431";
            producer.Website ??= "https://demo.kalypsis.gr";
            producer.ProfessionalLicenseNumber ??= $"ΜΗΤΡΩΟ-{producer.Code}";
            producer.LicenseExpiryDate ??= today.AddYears(2);
            producer.Iban ??= "GR1601101250000000012300695";
            producer.BankName ??= "Τράπεζα Demo";
            producer.PaymentMethod ??= "Τραπεζική μεταφορά";
            producer.Notes ??= "Ενεργός συνεργάτης demo με ενδεικτικό χαρτοφυλάκιο.";
            producer.GoalTargetMode = producer.Code is "P001" or "P002" ? "Vehicles" : "Premium";
            producer.GoalFirstTargetCount ??= 20;
            producer.GoalCountStep ??= 10;
        }

        foreach (var (policy, index) in policies.Take(18).Select((p, i) => (p, i)))
        {
            // Keep all lifecycle states visible in the demo lists (the rest of
            // the seeded portfolio retains its naturally mixed statuses).
            if (index == 0) policy.Status = PolicyStatus.Active;
            if (index == 1) policy.Status = PolicyStatus.Undelivered;
            if (index == 2) policy.Status = PolicyStatus.PendingRenewal;
            if (index == 3) policy.Status = PolicyStatus.Prospect;
            if (index == 4) policy.Status = PolicyStatus.Cancelled;
            if (index == 5) policy.Status = PolicyStatus.Expired;
            policy.CreatedByUserId ??= admin?.Id;
            policy.NetPremium ??= decimal.Round(policy.Premium * .75m, 2);
            policy.VatAmount ??= decimal.Round(policy.Premium - policy.NetPremium.Value, 2);
            policy.StampDutyAmount ??= decimal.Round(policy.Premium * .024m, 2);
            policy.IssuedAt ??= policy.StartDate.AddDays(-2);
            policy.HandoverDate ??= policy.StartDate.AddDays(1);
            policy.OfficeReceivedAt ??= policy.StartDate.AddDays(-1);
            policy.PaymentCollectionMethod ??= index % 3 == 0 ? "Τραπεζική μεταφορά" : "Ταμείο γραφείου";
            policy.ApplicationNumber ??= $"DEMO-AI-{index + 1:D5}";
            policy.NextRenewalDate ??= policy.EndDate.AddDays(-30);
            policy.DeliveredTo ??= "Ο ίδιος ο πελάτης";
            policy.DeliveryMethod ??= "Ηλεκτρονικό ταχυδρομείο";
            policy.DeliveredAt ??= index % 4 == 0 ? null : policy.StartDate.AddDays(2);
            policy.PaidDirectlyToCarrier = index % 5 == 0;
            if (index % 4 == 0)
            {
                policy.PaidOnCredit = true;
                policy.PaymentPromisedOn ??= today.AddDays(10 + index);
                policy.CreditReason ??= "Ενδεικτική πίστωση για την επίδειξη της καρτέλας.";
            }
            policy.VehicleRegistrationPlate ??= policy.PolicyType == PolicyType.Auto ? $"DEMO-{(index + 1):D3}" : null;
            policy.CarrierUseCode ??= policy.PolicyType == PolicyType.Auto ? "ΙΧ" : null;
            policy.CarrierBranchCode ??= policy.PolicyType.ToString().ToUpperInvariant();
            policy.CarrierPackageCode ??= "DEMO-ΠΑΚΕΤΟ";
            policy.CarrierCoverageCode ??= "ΒΑΣΙΚΗ, ΠΡΟΑΙΡΕΤΙΚΗ";
            policy.Characteristic ??= policy.PolicyType == PolicyType.Auto ? "Όχημα επίδειξης" : "Ενδεικτικό πρόγραμμα κάλυψης";
            policy.Notes ??= "Πλήρες ενδεικτικό συμβόλαιο για παρουσίαση του KALYPSIS.";
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedOfficeAssignmentsAsync(AppDbContext db, Tenant tenant, User? admin, DateTime now, CancellationToken ct)
    {
        if (admin is null) return;
        var office = await db.AgencyOffices.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.IsHeadquarters && x.IsActive)
            .OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (office is null) return;

        var users = await db.Users.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.IsActive)
            .ToListAsync(ct);
        foreach (var user in users)
        {
            if (!await db.UserAgencyOffices.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.UserId == user.Id && x.AgencyOfficeId == office.Id, ct))
            {
                db.UserAgencyOffices.Add(new UserAgencyOffice
                {
                    Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = user.Id,
                    AgencyOfficeId = office.Id, IsPrimary = user.Id == admin.Id, CreatedAt = now
                });
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedCustomerProfilesAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Customer> customers, DateOnly today, DateTime now, CancellationToken ct)
    {
        var needKinds = new[] { ("Όχημα", "Δεύτερο όχημα", true, true), ("Κατοικία", "Ασφάλιση κατοικίας", true, false), ("Υγεία", "Οικογενειακό πρόγραμμα υγείας", false, false) };
        foreach (var customer in customers.Take(15))
        {
            foreach (var (kind, title, hasAsset, insured) in needKinds.Take(customer.Id.GetHashCode() % 3 == 0 ? 3 : 2))
            {
                if (!await db.CustomerInsuranceNeeds.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.CustomerId == customer.Id && x.Kind == kind, ct))
                {
                    db.CustomerInsuranceNeeds.Add(new CustomerInsuranceNeed
                    {
                        Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customer.Id,
                        Kind = kind, Title = title, HasAsset = hasAsset, IsInsured = insured,
                        Priority = insured ? 2 : 1, NextContactAt = today.AddDays(14),
                        Notes = insured ? "Υφιστάμενη κάλυψη — προτείνεται έλεγχος ανανέωσης." : "Ευκαιρία cross-selling για την επίδειξη CRM.", CreatedAt = now
                    });
                }
            }

            if (!await db.CustomerContacts.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.CustomerId == customer.Id, ct))
            {
                db.CustomerContacts.Add(new CustomerContact
                {
                    Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customer.Id,
                    FirstName = "Μαρία", LastName = "Δημητρίου", Role = "Υπεύθυνη επικοινωνίας",
                    Email = $"contact.{customer.CustomerNumber.ToLowerInvariant()}@demo.gr", Phone = "+30 210 555 0101",
                    Notes = "Εναλλακτικό πρόσωπο επικοινωνίας", IsPrimary = false, CreatedAt = now
                });
            }

            foreach (var type in new[] { ConsentType.PrivacyNotice, ConsentType.EmailMarketing, ConsentType.SmsMarketing, ConsentType.IddDemandsAndNeeds })
            {
                if (!await db.ConsentRecords.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.CustomerId == customer.Id && x.Type == type && x.RevokedAt == null, ct))
                {
                    db.ConsentRecords.Add(new ConsentRecord
                    {
                        Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customer.Id,
                        Type = type, Granted = type != ConsentType.SmsMarketing || customer.Id.GetHashCode() % 2 == 0,
                        GrantedAt = now.AddDays(-20), Method = ConsentMethod.PaperForm,
                        Version = "demo-v1", Notes = "Ενδεικτική συγκατάθεση demo", CreatedAt = now.AddDays(-20)
                    });
                }
            }
        }

        if (customers.Count > 1 && !await db.CustomerRelationships.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.CustomerId == customers[0].Id && x.RelatedCustomerId == customers[1].Id, ct))
        {
            db.CustomerRelationships.AddRange(
                new CustomerRelationship { Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customers[0].Id, RelatedCustomerId = customers[1].Id, RelationshipType = CustomerRelationshipType.Spouse, Notes = "Οικογενειακή σχέση demo", CreatedAt = now },
                new CustomerRelationship { Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customers[1].Id, RelatedCustomerId = customers[0].Id, RelationshipType = CustomerRelationshipType.Spouse, Notes = "Οικογενειακή σχέση demo", CreatedAt = now });
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedPolicyDetailsAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Customer> customers, DateOnly today, DateTime now, CancellationToken ct)
    {
        foreach (var (policy, index) in policies.Take(20).Select((p, i) => (p, i)))
        {
            var obj = await db.PolicyObjects.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct);
            if (obj is null)
            {
                var isAuto = policy.PolicyType == PolicyType.Auto;
                obj = new PolicyObject
                {
                    Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id,
                    ObjectKind = isAuto ? "Όχημα" : policy.PolicyType switch { PolicyType.Home => "Κατοικία", PolicyType.Health => "Ασφαλιζόμενα πρόσωπα", PolicyType.Life => "Ζωή", _ => "Επαγγελματικός κίνδυνος" },
                    FbcLinkCode = $"{Marker}-OBJ-{index + 1:D3}", Identifier = isAuto ? policy.VehicleRegistrationPlate : $"DEMO-OBJ-{index + 1:D3}",
                    Description = isAuto ? "Toyota Corolla — ενδεικτικό όχημα" : "Ενδεικτικό ασφαλιζόμενο αντικείμενο",
                    Characteristic = isAuto ? "2022 · Ιδιωτική χρήση · 1.400cc" : "Πλήρης ενδεικτική περιγραφή", CreatedAt = now
                };
                db.PolicyObjects.Add(obj);
            }

            if (!await db.PolicyCovers.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
            {
                var net = policy.NetPremium ?? decimal.Round(policy.Premium * .75m, 2);
                db.PolicyCovers.AddRange(
                    new PolicyCover { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, PolicyObjectId = obj.Id, CoverCode = "DEMO-MTPL", CoverName = "Αστική ευθύνη", GrossPremium = decimal.Round(policy.Premium * .62m, 2), NetPremium = decimal.Round(net * .62m, 2), CoverageAmount = 1000000m, CommissionPercent = 10m, AgencyCommissionPercent = 6m, CreatedAt = now },
                    new PolicyCover { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, PolicyObjectId = obj.Id, CoverCode = "DEMO-OPT", CoverName = "Προαιρετική κάλυψη", GrossPremium = decimal.Round(policy.Premium * .38m, 2), NetPremium = decimal.Round(net * .38m, 2), CoverageAmount = 250000m, CommissionPercent = 10m, AgencyCommissionPercent = 6m, CreatedAt = now });
            }

            // Keep one ready-to-edit manual green-card record in the showcase
            // tenant. It deliberately remains a draft: the walkthrough can
            // demonstrate the real issue-PDF and delivery actions.
            if (policy.PolicyType == PolicyType.Auto &&
                !await db.GreenCards.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id && x.DeletedAt == null, ct))
            {
                var customer = customers.FirstOrDefault(x => x.Id == policy.CustomerId);
                var customerName = customer is null ? string.Empty : customer.Type == CustomerType.Individual
                    ? $"{customer.FirstName} {customer.LastName}".Trim()
                    : customer.CompanyName ?? string.Empty;
                db.GreenCards.Add(new GreenCard
                {
                    Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id,
                    CardNumber = $"{Marker}-GREEN-{index + 1:D3}", Status = GreenCardStatus.Draft,
                    ValidFrom = policy.StartDate, ValidTo = policy.EndDate,
                    HolderName = customerName, InsuredName = customerName,
                    VehicleRegistrationPlate = policy.VehicleRegistrationPlate ?? $"DEMO-{index + 1:D3}",
                    VehicleMakeModel = "Toyota Corolla · ενδεικτικό όχημα",
                    Territories = "GR, AL, BG, IT",
                    IssuingOffice = tenant.Name,
                    Notes = "Ενδεικτική πράσινη κάρτα demo — έτοιμη για έκδοση PDF.",
                    CreatedAt = now
                });
            }

            if (!await db.PolicyInstallments.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
            {
                var half = decimal.Round(policy.Premium / 2m, 2);
                db.PolicyInstallments.AddRange(
                    new PolicyInstallment { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, Ordinal = 1, DueDate = policy.StartDate, Amount = half, Currency = "EUR", PaidAt = index % 3 == 0 ? policy.StartDate : null, PaidVia = index % 3 == 0 ? "Τραπεζική μεταφορά" : null, ReceiptReference = index % 3 == 0 ? $"DEMO-REC-{index + 1:D3}" : null, CreatedAt = now },
                    new PolicyInstallment { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, Ordinal = 2, DueDate = policy.StartDate.AddMonths(6), Amount = policy.Premium - half, Currency = "EUR", CreatedAt = now });
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedCommissionDataAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Producer> producers, IReadOnlyList<InsuranceCompany> carriers, DateOnly today, DateTime now, CancellationToken ct)
    {
        var types = new[] { PolicyType.Auto, PolicyType.Home, PolicyType.Health, PolicyType.Life, PolicyType.Business, PolicyType.Travel };
        foreach (var type in types)
        {
            if (!await db.CommissionRules.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyType == type && x.AgencyPercent == 16m, ct))
            {
                db.CommissionRules.Add(new CommissionRule
                {
                    Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyType = type, CommissionType = CommissionType.Percentage,
                    Value = 16m, AgencyPercent = 16m, ProducerPercent = 10m,
                    LevelPercentsJson = "{\"Producer\":10,\"Agency\":6}", EffectiveFrom = today.AddMonths(-12), CreatedAt = now
                });
            }
        }
        await db.SaveChangesAsync(ct);

        foreach (var (policy, index) in policies.Take(14).Select((p, i) => (p, i)))
        {
            var net = policy.NetPremium ?? decimal.Round(policy.Premium * .75m, 2);
            var producerRate = policy.ProducerId.HasValue ? 10m : 0m;
            var agencyRate = policy.ProducerId.HasValue ? 6m : 16m;
            if (!await db.PolicyCommissionSplits.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
            {
                if (producerRate > 0)
                    db.PolicyCommissionSplits.Add(new PolicyCommissionSplit { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, HierarchyLevel = HierarchyLevel.Producer, ProducerId = policy.ProducerId, Percent = producerRate, GrossAmount = decimal.Round(net * producerRate / 100m, 2), NetAmount = decimal.Round(net * producerRate / 100m, 2), CreatedAt = now });
                db.PolicyCommissionSplits.Add(new PolicyCommissionSplit { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, HierarchyLevel = HierarchyLevel.Agency, Percent = agencyRate, GrossAmount = decimal.Round(net * agencyRate / 100m, 2), NetAmount = decimal.Round(net * agencyRate / 100m, 2), CreatedAt = now });
            }
            if (policy.ProducerId.HasValue && !await db.CommissionTransactions.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
            {
                var amount = decimal.Round(net * producerRate / 100m, 2);
                db.CommissionTransactions.Add(new CommissionTransaction { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, ProducerId = policy.ProducerId, Amount = amount, Currency = "EUR", Status = index % 3 == 0 ? CommissionTransactionStatus.Paid : CommissionTransactionStatus.Pending, TransactionDate = policy.StartDate, SettledDate = index % 3 == 0 ? policy.StartDate.AddDays(10) : null, CreatedAt = now });
            }
            if (policy.ProducerId.HasValue && !await db.ProducerCommissionDeclarations.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
            {
                db.ProducerCommissionDeclarations.Add(new ProducerCommissionDeclaration { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, ProducerId = policy.ProducerId.Value, ExpectedAmount = decimal.Round(net * producerRate / 100m, 2), ExpectedPercent = producerRate, Currency = "EUR", Notes = "Δήλωση συνεργάτη demo", DeclaredAt = now.AddDays(-5), ReconciliationStatus = index % 4 == 0 ? "diff_small" : "match", CreatedAt = now });
            }
        }
        await db.SaveChangesAsync(ct);

        var lastMonth = now.AddMonths(-1);
        var run = await db.CommissionRuns.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.Title == $"{Marker} · Εκκαθάριση {lastMonth:MM/yyyy}", ct);
        if (run is null)
        {
            var runPolicies = policies.Take(10).ToList();
            run = new CommissionRun { Id = Guid.NewGuid(), TenantId = tenant.Id, Year = lastMonth.Year, Month = lastMonth.Month, Title = $"{Marker} · Εκκαθάριση {lastMonth:MM/yyyy}", Status = CommissionRunStatus.Finalised, GeneratedAt = lastMonth.AddDays(3), FinalisedAt = lastMonth.AddDays(7), GeneratedByUserId = null, LineCount = runPolicies.Count, TotalPremium = runPolicies.Sum(x => x.Premium), TotalCommission = decimal.Round(runPolicies.Sum(x => (x.NetPremium ?? x.Premium) * .10m / 100m), 2), Currency = "EUR", Notes = "Ενδεικτική οριστικοποιημένη εκκαθάριση για παρουσίαση.", CreatedAt = now };
            db.CommissionRuns.Add(run);
            await db.SaveChangesAsync(ct);
            foreach (var policy in runPolicies)
            {
                db.CommissionRunLines.Add(new CommissionRunLine { Id = Guid.NewGuid(), TenantId = tenant.Id, CommissionRunId = run.Id, PolicyId = policy.Id, ProducerId = policy.ProducerId, InsuranceCompanyId = policy.InsuranceCompanyId, PolicyType = policy.PolicyType, PackageCode = policy.CarrierPackageCode, Premium = policy.Premium, RatePercent = policy.ProducerId.HasValue ? 10m : 16m, CommissionAmount = decimal.Round((policy.NetPremium ?? policy.Premium) * (policy.ProducerId.HasValue ? .10m : .16m), 2), Currency = "EUR", CreatedAt = now });
            }
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task SeedMoneyFlowAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Customer> customers, IReadOnlyList<Producer> producers, IReadOnlyList<InsuranceCompany> carriers, User? admin, DateOnly today, DateTime now, CancellationToken ct)
    {
        var receipts = new List<Receipt>();
        foreach (var (policy, index) in policies.Take(12).Select((p, i) => (p, i)))
        {
            if (!await db.Receipts.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Number == $"{Marker}-RECEIPT-{index + 1:D3}", ct))
            {
                var receipt = new Receipt { Id = Guid.NewGuid(), TenantId = tenant.Id, Number = $"{Marker}-RECEIPT-{index + 1:D3}", ReceivedOn = policy.StartDate.AddDays(3), CustomerId = policy.CustomerId, PolicyId = policy.Id, Method = index % 2 == 0 ? PaymentMethod.BankTransfer : PaymentMethod.Card, Amount = decimal.Round(policy.Premium * (index % 4 == 0 ? .5m : 1m), 2), Currency = "EUR", Notes = index % 4 == 0 ? "Μερική είσπραξη — υπόλοιπο πελάτη" : "Πλήρης είσπραξη demo", RecordedByUserId = admin?.Id, TransactionReference = $"DEMO-TX-{index + 1:D6}", CreatedAt = now };
                db.Receipts.Add(receipt); receipts.Add(receipt);
            }
        }
        await db.SaveChangesAsync(ct);
        foreach (var receipt in receipts)
        {
            if (!await db.FinancialMovements.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.ReceiptId == receipt.Id, ct))
                db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), TenantId = tenant.Id, MovementDate = receipt.ReceivedOn, Kind = FinancialMovementKind.CustomerCredit, Amount = receipt.Amount, Currency = "EUR", Description = "Είσπραξη πελάτη για demo συμβόλαιο", PolicyId = receipt.PolicyId, CustomerId = receipt.CustomerId, ReceiptId = receipt.Id, CreatedAt = now });
        }

        foreach (var (policy, index) in policies.Take(8).Select((p, i) => (p, i)))
        {
            var carrier = carriers.FirstOrDefault(x => x.Id == policy.InsuranceCompanyId) ?? carriers[0];
            var number = $"{Marker}-PAYMENT-{index + 1:D3}";
            if (!await db.Payments.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Number == number, ct))
            {
                db.Payments.Add(new Payment { Id = Guid.NewGuid(), TenantId = tenant.Id, Number = number, PaidOn = policy.StartDate.AddDays(5), BeneficiaryType = BeneficiaryType.InsuranceCompany, BeneficiaryInsuranceCompanyId = carrier.Id, BeneficiaryName = carrier.Name, Method = PaymentMethod.BankTransfer, Amount = policy.Premium, CommissionsNetted = decimal.Round((policy.NetPremium ?? policy.Premium) * .16m, 2), Currency = "EUR", Notes = "Πληρωμή ασφαλιστικής εταιρείας demo", TransactionReference = $"DEMO-BANK-{index + 1:D6}", PolicyId = policy.Id, CreatedAt = now });
            }
            if (policy.ProducerId.HasValue && !await db.Payments.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Number == $"{Marker}-PARTNER-{index + 1:D3}", ct))
            {
                db.Payments.Add(new Payment { Id = Guid.NewGuid(), TenantId = tenant.Id, Number = $"{Marker}-PARTNER-{index + 1:D3}", PaidOn = policy.StartDate.AddDays(12), BeneficiaryType = BeneficiaryType.Producer, BeneficiaryProducerId = policy.ProducerId, Method = PaymentMethod.BankTransfer, Amount = decimal.Round((policy.NetPremium ?? policy.Premium) * .10m, 2), CommissionsNetted = 0m, Currency = "EUR", Notes = "Πληρωμή προμήθειας συνεργάτη demo", TransactionReference = $"DEMO-PARTNER-{index + 1:D6}", PolicyId = policy.Id, CreatedAt = now });
            }
        }
        await db.SaveChangesAsync(ct);
        var payments = await db.Payments.IgnoreQueryFilters().Where(x => x.TenantId == tenant.Id && x.Number.StartsWith(Marker)).ToListAsync(ct);
        foreach (var payment in payments)
        {
            if (!await db.FinancialMovements.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PaymentId == payment.Id, ct))
                db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), TenantId = tenant.Id, MovementDate = payment.PaidOn, Kind = payment.BeneficiaryType == BeneficiaryType.Producer ? FinancialMovementKind.PartnerCharge : FinancialMovementKind.CompanyCharge, Amount = payment.Amount, Currency = "EUR", Description = payment.BeneficiaryType == BeneficiaryType.Producer ? "Οφειλή προς συνεργάτη demo" : "Πληρωμή προς ασφαλιστική εταιρεία demo", PolicyId = payment.PolicyId, ProducerId = payment.BeneficiaryProducerId, InsuranceCompanyId = payment.BeneficiaryInsuranceCompanyId, PaymentId = payment.Id, CreatedAt = now });
        }
        foreach (var policy in policies.Take(12))
        {
            if (!await db.FinancialMovements.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id && x.Kind == FinancialMovementKind.CommissionEarned, ct))
                db.FinancialMovements.Add(new FinancialMovement { Id = Guid.NewGuid(), TenantId = tenant.Id, MovementDate = policy.StartDate, Kind = FinancialMovementKind.CommissionEarned, Amount = decimal.Round((policy.NetPremium ?? policy.Premium) * .16m, 2), Currency = "EUR", Description = "Κερδισμένη προμήθεια γραφείου demo", PolicyId = policy.Id, ProducerId = policy.ProducerId, InsuranceCompanyId = policy.InsuranceCompanyId, CreatedAt = now });
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedClaimsAndDeliveryAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Customer> customers, DateOnly today, DateTime now, CancellationToken ct)
    {
        var claims = new List<Claim>();
        foreach (var (policy, index) in policies.Take(6).Select((p, i) => (p, i)))
        {
            var number = $"{Marker}-CLAIM-{index + 1:D3}";
            var claim = await db.Claims.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.ClaimNumber == number, ct);
            if (claim is null)
            {
                var status = (ClaimStatus)((index % 5) + 1);
                claim = new Claim { Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimNumber = number, PolicyId = policy.Id, IncidentDate = policy.StartDate.AddDays(30 + index), ReportedDate = policy.StartDate.AddDays(33 + index), Status = status, ClaimedAmount = 950m + index * 380m, ApprovedAmount = status is ClaimStatus.Approved or ClaimStatus.Paid or ClaimStatus.Closed ? 800m + index * 280m : null, Description = index % 2 == 0 ? "Υλικές ζημιές από τροχαίο περιστατικό demo." : "Ζημιά παρμπρίζ — ενδεικτική καταχώρηση.", AffectsBonusMalus = index % 2 == 0, UsaeCode = "DEMO-USAE", UsaeKind = "Υλικές ζημιές", UsaeStatus = index % 2 == 0 ? "Accepted" : "NotSent", LiabilityPercent = index % 2 == 0 ? 50m : 0m, IsFriendlySettlement = index % 2 == 0, CreatedAt = now };
                db.Claims.Add(claim); claims.Add(claim);
            }
        }
        await db.SaveChangesAsync(ct);
        foreach (var (claim, index) in claims.Select((x, i) => (x, i)))
        {
            if (!await db.ClaimProvisions.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.ClaimId == claim.Id, ct))
                db.ClaimProvisions.Add(new ClaimProvision { Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimId = claim.Id, ReserveAmount = claim.ClaimedAmount ?? 0m, IncurredButNotReported = index % 2 == 0 ? 100m : 0m, Currency = "EUR", EvaluationDate = today, AssessorName = "Αξιολογητής Demo", Notes = "Ενδεικτικό αποθεματικό ζημιάς.", CreatedAt = now });
            if (claim.Status is ClaimStatus.Paid or ClaimStatus.Closed && !await db.ClaimIndemnities.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.ClaimId == claim.Id, ct))
                db.ClaimIndemnities.Add(new ClaimIndemnity { Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimId = claim.Id, PaymentNumber = $"{Marker}-INDEMNITY-{index + 1:D3}", PaidOn = today.AddDays(-index), Amount = claim.ApprovedAmount ?? 0m, Currency = "EUR", PayeeType = "Customer", PayeeName = "Πελάτης demo", PaymentMethod = "BankTransfer", Reference = "DEMO-CLAIM-PAY", Notes = "Ενδεικτική αποζημίωση.", CreatedAt = now });
        }

        foreach (var (policy, index) in policies.Take(14).Select((p, i) => (p, i)))
        {
            if (!await db.DeliveryRecords.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.PolicyId == policy.Id, ct))
                db.DeliveryRecords.Add(new DeliveryRecord { Id = Guid.NewGuid(), TenantId = tenant.Id, PolicyId = policy.Id, Channel = index % 3 == 0 ? DeliveryChannel.Portal : DeliveryChannel.Email, Status = index % 4 == 0 ? DeliveryStatus.Pending : DeliveryStatus.Delivered, DispatchedAt = policy.IssuedAt?.ToDateTime(TimeOnly.MinValue), DeliveredAt = policy.DeliveredAt?.ToDateTime(TimeOnly.MinValue), AcknowledgedAt = index % 4 == 0 ? null : policy.DeliveredAt?.ToDateTime(TimeOnly.MinValue).AddHours(3), Reference = $"{Marker}-DELIVERY-{index + 1:D3}", Notes = "Ενδεικτική παράδοση συμβολαίου.", CreatedAt = now });
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedCrmAndOperationsAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Customer> customers, IReadOnlyList<Producer> producers, User? admin, DateTime now, CancellationToken ct)
    {
        if (!await db.CrmGroups.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Name == $"{Marker} · Πελάτες προς ανανέωση", ct))
        {
            var group = new CrmGroup { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = $"{Marker} · Πελάτες προς ανανέωση", EntityType = "Customer", Description = "Έξυπνη demo ομάδα για ανανεώσεις και follow-up.", IsDynamic = true, FilterJson = JsonSerializer.Serialize(new { status = "Active", renewalDays = 30 }), IsActive = true, CreatedAt = now };
            db.CrmGroups.Add(group); await db.SaveChangesAsync(ct);
            foreach (var customer in customers.Take(8)) db.CrmGroupMembers.Add(new CrmGroupMember { Id = Guid.NewGuid(), TenantId = tenant.Id, GroupId = group.Id, EntityId = customer.Id, EntityType = "Customer", CreatedAt = now });
        }
        if (!await db.MarketingCampaigns.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Name == $"{Marker} · Καμπάνια ανανεώσεων", ct))
            db.MarketingCampaigns.Add(new MarketingCampaign { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = $"{Marker} · Καμπάνια ανανεώσεων", Subject = "Η ασφάλισή σας ανανεώνεται σύντομα", BodyHtml = "<p>Αγαπητέ πελάτη, η ομάδα του demo γραφείου είναι διαθέσιμη για την ανανέωσή σας.</p>", SmsBody = "Η ασφάλισή σας ανανεώνεται σύντομα. Επικοινωνήστε με το demo γραφείο.", ChannelsJson = "[\"Email\",\"Sms\"]", SegmentKey = "demo-renewals", Status = CampaignStatus.Sent, Recipients = 8, Sent = 7, Failed = 1, SentAt = now.AddDays(-3), CreatedAt = now });

        if (customers.Count > 0 && !await db.CommunicationLogs.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Subject.StartsWith(Marker), ct))
        {
            foreach (var (customer, index) in customers.Take(8).Select((x, i) => (x, i)))
                db.CommunicationLogs.Add(new CommunicationLog { Id = Guid.NewGuid(), TenantId = tenant.Id, CustomerId = customer.Id, UserId = admin?.Id, Kind = index % 3 == 0 ? CommunicationKind.Phone : CommunicationKind.Email, Direction = CommunicationDirection.Outbound, Outcome = index % 2 == 0 ? CommunicationOutcome.Resolved : CommunicationOutcome.FollowUpRequired, OccurredAt = now.AddDays(-index - 1), DurationSeconds = 300, Subject = $"{Marker} · Επικοινωνία με πελάτη", Body = "Ενημέρωση για ανανέωση, εισπράξεις και συμπληρωματικές καλύψεις.", RelatedPolicyId = policies.ElementAtOrDefault(index)?.Id, RelatedPolicyNumber = policies.ElementAtOrDefault(index)?.PolicyNumber, CreatedAt = now });
        }
        if (producers.Count > 0 && !await db.ProducerCommunicationLogs.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Subject.StartsWith(Marker), ct))
        {
            foreach (var producer in producers.Take(5)) db.ProducerCommunicationLogs.Add(new ProducerCommunicationLog { Id = Guid.NewGuid(), TenantId = tenant.Id, ProducerId = producer.Id, UserId = admin?.Id, Kind = CommunicationKind.Meeting, Direction = CommunicationDirection.Internal, Outcome = CommunicationOutcome.Resolved, OccurredAt = now.AddDays(-4), DurationSeconds = 1800, Subject = $"{Marker} · Συνάντηση συνεργάτη", Body = "Έλεγχος παραγωγής, εκκαθάρισης και στόχων συνεργάτη.", CreatedAt = now });
        }
        if (customers.Count > 0 && !await db.AgencyTasks.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Title.StartsWith(Marker), ct))
        {
            foreach (var (policy, index) in policies.Take(6).Select((x, i) => (x, i)))
                db.AgencyTasks.Add(new AgencyTask { Id = Guid.NewGuid(), TenantId = tenant.Id, Title = $"{Marker} · Follow-up συμβολαίου", Description = "Επικοινωνία με πελάτη για ανανέωση/εκκρεμή πληρωμή.", Status = index == 0 ? AgencyTaskStatus.InProgress : AgencyTaskStatus.Open, Priority = index == 0 ? AgencyTaskPriority.Urgent : AgencyTaskPriority.Normal, AssignedToUserId = admin?.Id, CustomerId = policy.CustomerId, PolicyId = policy.Id, ProducerId = policy.ProducerId, DueAt = now.AddDays(2 + index), CreatedAt = now });
        }
        if (customers.Count > 0 && !await db.Appointments.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Title.StartsWith(Marker), ct))
            db.Appointments.Add(new Appointment { Id = Guid.NewGuid(), TenantId = tenant.Id, Title = $"{Marker} · Ραντεβού ανανέωσης", Description = "Παρουσίαση καλύψεων και οικονομικής εικόνας.", Location = "Κεντρικό γραφείο demo", StartsAt = now.AddDays(3).Date.AddHours(11), EndsAt = now.AddDays(3).Date.AddHours(12), Status = AppointmentStatus.Scheduled, AssignedToUserId = admin?.Id, CustomerId = customers[0].Id, PolicyId = policies[0].Id, ProducerId = policies[0].ProducerId, CreatedAt = now });
        if (admin is not null && !await db.Notifications.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Title.StartsWith(Marker), ct))
            db.Notifications.AddRange(
                new Notification { Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = admin.Id, Title = $"{Marker} · Εκκρεμής πληρωμή", Body = "Υπάρχει ενδεικτική εκκρεμότητα πελάτη για επίδειξη.", Category = "payment-reminder", Link = "/app/financials?tab=payments", IsRead = false, CreatedAt = now },
                new Notification { Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = admin.Id, Title = $"{Marker} · Νέα ζημιά", Body = "Καταχωρήθηκε νέα ενδεικτική ζημιά demo.", Category = "claim-update", Link = "/app/claims", IsRead = false, CreatedAt = now.AddHours(-2) });
        if (producers.Count > 0 && !await db.PartnerPortalAccesses.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.ProducerId == producers[0].Id, ct))
            db.PartnerPortalAccesses.Add(new PartnerPortalAccess { Id = Guid.NewGuid(), TenantId = tenant.Id, ProducerId = producers[0].Id, IsActive = true, CanIssuePolicies = true, CanViewCommissions = true, CanViewCustomers = true, Notes = "Demo portal access με πλήρη δικαιώματα επίδειξης.", LastLoginAt = now.AddDays(-1), CreatedAt = now });
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedWebsiteAndCashboxAsync(AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies, IReadOnlyList<Customer> customers, User? admin, DateOnly today, DateTime now, CancellationToken ct)
    {
        var website = await db.OfficeWebsites.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.Slug == "demo", ct);
        if (website is null)
        {
            website = new OfficeWebsite { Id = Guid.NewGuid(), TenantId = tenant.Id, Slug = "demo", SiteName = "ΓΡΑΦΕΙΟ DEMO ΑΣΦΑΛΙΣΕΩΝ", Tagline = "Ασφάλιση με ανθρώπινη υποστήριξη", HeroTitle = "Η ασφάλειά σας, οργανωμένη σε ένα μέρος", HeroBody = "Ζητήστε προσφορά, ενημερωθείτε για τις καλύψεις σας και επικοινωνήστε με την ομάδα μας.", BrandColorHex = "#0b2545", PostsJson = "[{\"title\":\"Νέα προγράμματα αυτοκινήτου\",\"published\":true}]", OffersJson = "[{\"title\":\"Έλεγχος ασφαλιστηρίου\",\"cta\":\"Επικοινωνήστε μαζί μας\"}]", BannersJson = "[{\"text\":\"Δωρεάν έλεγχος καλύψεων\",\"color\":\"#f4b942\"}]", FormConfigJson = "{\"products\":[\"Αυτοκίνητο\",\"Κατοικία\",\"Υγεία\"]}", IsPublished = true, CreatedAt = now };
            db.OfficeWebsites.Add(website); await db.SaveChangesAsync(ct);
            db.OfficeWebsiteRequests.Add(new OfficeWebsiteRequest { Id = Guid.NewGuid(), TenantId = tenant.Id, OfficeWebsiteId = website.Id, FullName = "Γιώργος Επισκέπτης", Email = "lead@demo.gr", Phone = "+30 690 555 0199", Product = "Ασφάλιση κατοικίας", Message = "Θέλω μία ενδεικτική προσφορά.", PreferredContact = "Email", ConsentGiven = true, Status = "New", Source = "demo-website", CreatedAt = now.AddDays(-2) });
            foreach (var path in new[] { "/", "/prosfores", "/epikoinonia", "/asfalisi-aftokinitou", "/asfalisi-katoikias" })
                db.OfficeWebsiteEvents.Add(new OfficeWebsiteEvent { Id = Guid.NewGuid(), TenantId = tenant.Id, OfficeWebsiteId = website.Id, EventType = "page_view", Path = path, Referrer = "https://google.example", Source = "organic", Campaign = "demo-launch", Device = path == "/" ? "desktop" : "mobile", SessionKeyHash = $"{Marker}-{path.GetHashCode():X}", CreatedAt = now.AddHours(-path.Length) });
        }

        var cash = await db.CashAccounts.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.Code == "DEMO-CASH", ct);
        if (cash is null)
        {
            cash = new CashAccount { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "DEMO-CASH", Name = "Κεντρικό ταμείο demo", Currency = "EUR", IsActive = true, Notes = "Ενδεικτικό ταμείο με εισπράξεις και αποδόσεις.", CreatedAt = now };
            db.CashAccounts.Add(cash); await db.SaveChangesAsync(ct);
            var receipt = await db.Receipts.IgnoreQueryFilters().Where(x => x.TenantId == tenant.Id && x.Number.StartsWith(Marker)).OrderBy(x => x.Number).FirstOrDefaultAsync(ct);
            var payment = await db.Payments.IgnoreQueryFilters().Where(x => x.TenantId == tenant.Id && x.Number.StartsWith(Marker)).OrderBy(x => x.Number).FirstOrDefaultAsync(ct);
            db.CashMovements.AddRange(
                new CashMovement { Id = Guid.NewGuid(), TenantId = tenant.Id, CashAccountId = cash.Id, MovementDate = today.AddDays(-4), Direction = "In", Amount = receipt?.Amount ?? 320m, Currency = "EUR", Reason = "Είσπραξη πελάτη", Reference = $"{Marker}-CASH-IN", RelatedReceiptId = receipt?.Id, CreatedAt = now },
                new CashMovement { Id = Guid.NewGuid(), TenantId = tenant.Id, CashAccountId = cash.Id, MovementDate = today.AddDays(-2), Direction = "Out", Amount = payment?.Amount ?? 180m, Currency = "EUR", Reason = "Απόδοση σε ασφαλιστική εταιρεία", Reference = $"{Marker}-CASH-OUT", RelatedPaymentId = payment?.Id, CreatedAt = now });
            cash.CurrentBalance = (receipt?.Amount ?? 320m) - (payment?.Amount ?? 180m);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Fills the newer operational screens that otherwise look empty in a
    /// fresh demo tenant. All rows carry a stable DEMO-SHOWCASE marker and
    /// are created only when their natural key is missing.
    /// </summary>
    private static async Task SeedRequestsAndOperationalShowcaseAsync(
        AppDbContext db, Tenant tenant, IReadOnlyList<Policy> policies,
        IReadOnlyList<Customer> customers, IReadOnlyList<Producer> producers,
        IReadOnlyList<InsuranceCompany> carriers, User? admin,
        DateOnly today, DateTime now, CancellationToken ct)
    {
        var demoCustomers = customers
            .Where(x => x.CustomerNumber.StartsWith("DEMO-", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.CustomerNumber)
            .ToList();
        if (demoCustomers.Count == 0) return;

        var demoPolicies = policies.ToList();
        var customer = demoCustomers[0];
        var policyForCustomer = demoPolicies.FirstOrDefault(x => x.CustomerId == customer.Id) ?? demoPolicies.FirstOrDefault();

        // Service requests: one row for each type and a mix of lifecycle
        // states, so the agency and customer portals both have useful data.
        var requestSeeds = new[]
        {
            ("DEMO-REQ-001", ServiceRequestType.NewPolicy, ServiceRequestStatus.Submitted, "Νέα προσφορά ασφάλισης κατοικίας", "Παρακαλώ ετοιμάστε προσφορά για κύρια κατοικία και ενημερώστε με για τις διαθέσιμες καλύψεις.", false),
            ("DEMO-REQ-002", ServiceRequestType.PolicyChange, ServiceRequestStatus.InReview, "Αλλαγή στοιχείων συμβολαίου", "Χρειάζεται ενημέρωση της διεύθυνσης αλληλογραφίας και προσθήκη δεύτερου οδηγού.", false),
            ("DEMO-REQ-003", ServiceRequestType.AccidentReport, ServiceRequestStatus.AwaitingCustomerInfo, "Δήλωση τροχαίου ατυχήματος", "Το ατύχημα έγινε σε διασταύρωση και αναμένουμε φωτογραφίες και το έντυπο δήλωσης.", true),
            ("DEMO-REQ-004", ServiceRequestType.DocumentRequest, ServiceRequestStatus.Resolved, "Αποστολή αντιγράφου ασφαλιστηρίου", "Παρακαλώ αποστείλετε το τελευταίο αντίγραφο του ασφαλιστηρίου σε PDF.", false),
            ("DEMO-REQ-005", ServiceRequestType.GeneralQuestion, ServiceRequestStatus.Closed, "Ερώτηση για την επόμενη ανανέωση", "Θα ήθελα να γνωρίζω πότε ξεκινά η διαδικασία ανανέωσης και ποια δικαιολογητικά χρειάζονται.", false),
            ("DEMO-REQ-006", ServiceRequestType.NewPolicy, ServiceRequestStatus.Rejected, "Αίτημα επαγγελματικής ασφάλισης", "Ζητήθηκε πρόγραμμα επαγγελματικής ευθύνης· το αίτημα απορρίφθηκε επειδή λείπουν στοιχεία κινδύνου.", false)
        };

        foreach (var (number, type, status, subject, description, accident) in requestSeeds)
        {
            if (await db.ServiceRequests.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.RequestNumber == number, ct))
                continue;

            var requestCustomer = demoCustomers[(number[^1] - '1') % demoCustomers.Count];
            var requestPolicy = demoPolicies.FirstOrDefault(x => x.CustomerId == requestCustomer.Id) ?? policyForCustomer;
            db.ServiceRequests.Add(new ServiceRequest
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, RequestNumber = number,
                CustomerId = requestCustomer.Id, Type = type, Status = status,
                Subject = subject, Description = description, RelatedPolicyId = requestPolicy?.Id,
                IncidentDate = accident ? today.AddDays(-9) : null,
                IncidentLocation = accident ? "Λεωφόρος Κηφισίας, Αθήνα" : null,
                OtherPartyInfo = accident ? "Τρίτο όχημα ΙΧ — στοιχεία καταχωρημένα στο έντυπο" : null,
                AssignedToUserId = admin?.Id,
                AgencyNotes = status is ServiceRequestStatus.Resolved or ServiceRequestStatus.Closed
                    ? "Ολοκληρώθηκε από το γραφείο demo και ενημερώθηκε ο πελάτης."
                    : "Εκκρεμεί επόμενη ενέργεια από τον υπεύθυνο του γραφείου.",
                ResolvedAt = status is ServiceRequestStatus.Resolved or ServiceRequestStatus.Closed ? now.AddDays(-2) : null,
                CreatedAt = now.AddDays(-(number[^1] - '0'))
            });
        }
        await db.SaveChangesAsync(ct);

        // Approved repair shops for the claims/settlements walkthrough.
        var garages = await db.Garages.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null && x.Code.StartsWith("DEMO-GAR-"))
            .ToListAsync(ct);
        if (garages.Count == 0)
        {
            db.Garages.AddRange(
                new Garage { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "DEMO-GAR-001", Name = "AutoFix Κέντρο Επισκευών", Afm = "099999901", Address = "Λεωφόρος Αθηνών 120", City = "Αθήνα", PostalCode = "10441", Phone = "2105551200", Email = "service@autofix-demo.gr", Specialty = "Αμάξωμα και μηχανικές επισκευές", IsApproved = true, IsActive = true, Iban = "GR1601101250000000012300701", Notes = "Συνεργείο επίσημου δικτύου demo." },
                new Garage { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "DEMO-GAR-002", Name = "GlassPoint Κρύσταλλα", Afm = "099999902", Address = "Οδό Πατησίων 88", City = "Αθήνα", PostalCode = "11251", Phone = "2105551201", Email = "glass@glasspoint-demo.gr", Specialty = "Κρύσταλλα και παρμπρίζ", IsApproved = true, IsActive = true, Notes = "Εναλλακτικό συνεργείο για ζημιές κρυστάλλων." });
            await db.SaveChangesAsync(ct);
            garages = await db.Garages.IgnoreQueryFilters().Where(x => x.TenantId == tenant.Id && x.Code.StartsWith("DEMO-GAR-")).ToListAsync(ct);
        }

        // A friendly-settlement file and its victim/payment breakdown.
        var claim = await db.Claims.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenant.Id && x.DeletedAt == null)
            .OrderBy(x => x.ClaimNumber).FirstOrDefaultAsync(ct);
        if (claim is not null && !await db.FriendlySettlements.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.SettlementFileNumber == $"{Marker}-FRIENDLY-001", ct))
        {
            claim.IsFriendlySettlement = true;
            var settlement = new FriendlySettlement
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimId = claim.Id,
                SettlementFileNumber = $"{Marker}-FRIENDLY-001", DeclarationDate = today.AddDays(-18),
                SettlementAuthority = "Φιλικός διακανονισμός", SettlementDate = today.AddDays(-10),
                AgreedAmount = 1250m, VatAmount = 300m, FeeAmount = 45m, InterestAmount = 0m,
                Currency = "EUR", Status = "InProgress", OtherPartyInsurer = carriers.FirstOrDefault()?.Name,
                OtherPartyPolicy = "DEMO-THIRD-2026-001", AppraisorName = "Νίκος Εκτιμητής",
                AppraisalDate = today.AddDays(-14), Notes = "Demo φάκελος για έλεγχο ροής φιλικού διακανονισμού.", CreatedAt = now
            };
            db.FriendlySettlements.Add(settlement);
            var victim = new ClaimVictim
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimId = claim.Id, FriendlySettlementId = settlement.Id,
                FullName = "Αντώνης Παπαδόπουλος", Afm = "099999903", Phone = "6905551202",
                Address = "Οδός Ερμού 15, Αθήνα", VictimType = "Vehicle", VehiclePlate = "DEMO-002",
                Description = "Ζημιά στο πίσω μέρος του οχήματος", ReserveAmount = 1250m, PaidAmount = 500m,
                Currency = "EUR", Status = "Open", CreatedAt = now
            };
            db.ClaimVictims.Add(victim);
            db.SettlementPayments.Add(new SettlementPayment
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, ClaimVictimId = victim.Id,
                PaidOn = today.AddDays(-7), PayeeType = "Victim", PayeeName = victim.FullName,
                GarageId = garages.FirstOrDefault()?.Id, NetAmount = 400m, VatAmount = 96m,
                FeeAmount = 4m, InterestAmount = 0m, TotalAmount = 500m, Currency = "EUR",
                PaymentMethod = "BankTransfer", Reference = $"{Marker}-SETTLEMENT-PAY-001",
                Notes = "Μερική καταβολή αποζημίωσης demo.", CreatedAt = now
            });
            await db.SaveChangesAsync(ct);
        }

        // Partner network and members, for the networks/producer hierarchy UI.
        var network = await db.PartnerNetworks.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.Id && x.Code == "DEMO-NET-01", ct);
        if (network is null && producers.Count > 0)
        {
            network = new PartnerNetwork
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "DEMO-NET-01", Name = "Δίκτυο Συνεργατών Demo",
                Description = "Ενδεικτικό δίκτυο παραγωγών με διαφορετικούς ρόλους και στόχους.",
                NetworkType = "Δίκτυο συνεργατών", Status = "Ενεργό", ManagerName = "Νίκος Παπαδάκης",
                Email = "network@demo-kalypsis.gr", Phone = "2105551300", SecondaryEmail = "support@demo-kalypsis.gr",
                SecondaryPhone = "6905551300", TaxId = "099999904", TaxOffice = "ΔΟΥ Αθηνών",
                BusinessType = "Ασφαλιστικό δίκτυο", ProfessionalCategory = "Ασφαλιστική διαμεσολάβηση",
                Address = "Λεωφόρος Συγγρού 100", City = "Αθήνα", PostalCode = "11741",
                Website = "https://demo.kalypsis.gr", ContractNumber = "DEMO-NET-CON-01",
                ContractStartDate = today.AddMonths(-6), ContractEndDate = today.AddMonths(18),
                CommissionPolicyJson = "{\"producer\":10,\"office\":6}", Notes = "Demo δίκτυο για παρουσίαση.", CreatedAt = now
            };
            db.PartnerNetworks.Add(network);
            await db.SaveChangesAsync(ct);
            foreach (var (producer, index) in producers.Take(3).Select((x, i) => (x, i)))
                db.PartnerNetworkMembers.Add(new PartnerNetworkMember { Id = Guid.NewGuid(), TenantId = tenant.Id, PartnerNetworkId = network.Id, ProducerId = producer.Id, Role = index == 0 ? "Υπεύθυνος δικτύου" : "Συνεργάτης", IsActive = true, JoinedAt = today.AddMonths(-index - 1), CommissionPercentOverride = index == 0 ? 11m : null, TargetPercent = 100m, Notes = "Demo μέλος δικτύου.", CreatedAt = now });
        }

        // Goals, over-commission statements and car model lookup records.
        if (producers.Count > 0 && !await db.ProductionGoals.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Notes != null && x.Notes.StartsWith(Marker), ct))
        {
            db.ProductionGoals.AddRange(
                new ProductionGoal { Id = Guid.NewGuid(), TenantId = tenant.Id, ProducerId = producers[0].Id, Year = today.Year, Month = today.Month, PolicyType = PolicyType.Auto, TargetPremium = 25000m, TargetPolicies = 40, Notes = $"{Marker} · Μηνιαίος στόχος αυτοκινήτου", CreatedAt = now },
                new ProductionGoal { Id = Guid.NewGuid(), TenantId = tenant.Id, ProducerId = null, Year = today.Year, Month = today.Month, TargetPremium = 75000m, TargetPolicies = 100, Notes = $"{Marker} · Κοινός στόχος γραφείου", CreatedAt = now });
        }
        if (producers.Count > 0 && carriers.Count > 0 && !await db.OverCommissionStatements.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Reference == $"{Marker}-OC-001", ct))
        {
            db.OverCommissionStatements.Add(new OverCommissionStatement
            {
                Id = Guid.NewGuid(), TenantId = tenant.Id, InsuranceCompanyId = carriers[0].Id, ProducerId = producers[0].Id,
                Year = today.Year, Month = today.Month, GrossAmount = 640m, NetAmount = 640m, Currency = "EUR",
                Reference = $"{Marker}-OC-001", Notes = "Ενδεικτική κατάσταση υπερπρομήθειας demo.",
                PaidOn = now.AddDays(-5), ProducerSharePercent = 80m, EnteredByUserId = admin?.Id,
                PeriodFrom = today.AddMonths(-1).ToDateTime(TimeOnly.MinValue), PeriodTo = today.ToDateTime(TimeOnly.MinValue),
                BasePremiumsGross = 16000m, BasePremiumsNet = 14000m, ProducerDirectCommission = 1400m
            });
        }
        if (!await db.VehicleModels.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Manufacturer == "DEMO", ct))
        {
            db.VehicleModels.AddRange(
                new VehicleModel { Id = Guid.NewGuid(), TenantId = tenant.Id, Manufacturer = "DEMO", Model = "Corolla", Trim = "Hybrid Active", EngineCc = 1798, HorsePower = 122, FuelType = "Υβριδικό", Category = "Επιβατικό", IsActive = true, CreatedAt = now },
                new VehicleModel { Id = Guid.NewGuid(), TenantId = tenant.Id, Manufacturer = "DEMO", Model = "Puma", Trim = "Titanium", EngineCc = 999, HorsePower = 125, FuelType = "Βενζίνη", Category = "Επιβατικό", IsActive = true, CreatedAt = now });
        }

        // Saved filters and a small AI conversation make the advanced package
        // demonstrable without calling an external provider.
        if (admin is not null && !await db.SavedReports.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Name.StartsWith(Marker), ct))
            db.SavedReports.Add(new SavedReport { Id = Guid.NewGuid(), TenantId = tenant.Id, OwnerUserId = admin.Id, Entity = "production-lists", Name = $"{Marker} · Ενεργά συμβόλαια", FiltersJson = "{\"status\":\"Active\",\"period\":\"current-month\"}", IsShared = true, CreatedAt = now });
        if (admin is not null && !await db.ReportDefinitions.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Name.StartsWith(Marker), ct))
            db.ReportDefinitions.Add(new ReportDefinition { Id = Guid.NewGuid(), TenantId = tenant.Id, Name = $"{Marker} · Παραγωγή ανά εταιρεία", Entity = ReportEntity.Policies, OwnerUserId = admin.Id, FieldsJson = "[{\"path\":\"policyNumber\",\"label\":\"Αρ. συμβολαίου\"},{\"path\":\"premium\",\"label\":\"Μικτά\"}]", GroupByJson = "[\"insuranceCompany\"]", AggregationsJson = "[{\"path\":\"premium\",\"fn\":\"SUM\"}]", Visibility = "Tenant", IsScheduled = false, CreatedAt = now });

        var prompt = await db.AiPromptTemplates.IgnoreQueryFilters().Where(x => x.TenantId == tenant.Id && x.DeletedAt == null).OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (admin is not null && prompt is not null && !await db.AiConversations.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenant.Id && x.Title.StartsWith(Marker), ct))
        {
            var conversation = new AiConversation { Id = Guid.NewGuid(), TenantId = tenant.Id, Title = $"{Marker} · Έλεγχος χαρτοφυλακίου", Kind = "PromptRun", PromptTemplateId = prompt.Id, CustomerId = customer.Id, PolicyId = policyForCustomer?.Id, UserId = admin.Id, LastMessageAt = now.AddHours(-1), Status = "Completed", ResultPreview = "Εντοπίστηκαν 3 συμβόλαια προς ανανέωση και 2 ευκαιρίες συμπληρωματικής κάλυψης.", CreatedAt = now.AddDays(-1) };
            db.AiConversations.Add(conversation);
            db.AiConversationMessages.AddRange(
                new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenant.Id, ConversationId = conversation.Id, Role = "user", Content = "Δώσε μου σύντομη εικόνα για τον πελάτη και τις επόμενες ενέργειες.", PromptTokens = 24, CompletionTokens = 0, ContentStored = true, CreatedAt = now.AddHours(-1) },
                new AiConversationMessage { Id = Guid.NewGuid(), TenantId = tenant.Id, ConversationId = conversation.Id, Role = "assistant", Content = "Ο πελάτης έχει ενεργά συμβόλαια και χρειάζεται υπενθύμιση ανανέωσης. Προτείνεται επικοινωνία μέσα στην εβδομάδα.", PromptTokens = 24, CompletionTokens = 39, ContentStored = true, CreatedAt = now.AddMinutes(-58) });
            db.AiInvocations.Add(new AiInvocation { Id = Guid.NewGuid(), TenantId = tenant.Id, UserId = admin.Id, TaskType = AiTaskType.PortfolioSummary, Model = "demo-stub", PromptRedacted = "Περίληψη πελατολογίου demo", ResponseRedacted = "Demo αποτέλεσμα πρόβλεψης/επόμενης ενέργειας.", PromptTokens = 24, CompletionTokens = 39, Success = true, CreatedAt = now.AddMinutes(-58) });
        }

        await db.SaveChangesAsync(ct);
    }
}
