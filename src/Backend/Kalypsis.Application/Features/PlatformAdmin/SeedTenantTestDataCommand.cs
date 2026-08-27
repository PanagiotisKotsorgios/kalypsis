using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Application.Features.PlatformAdmin;

/// <summary>
/// PLATFORM-ADMIN ONLY. Additive test-data seed for a single tenant —
/// unlike WipeAndReseedDemoCommand this NEVER deletes anything. Fills
/// the target tenant with a mix of customers, producers, policies (mix
/// of Auto / Home / Health / Life), receipts, endorsements, cancellations,
/// credit notes, claims, financial movements and appointments so every
/// screen has content to test against.
///
/// Idempotency: every seeded row tags <c>Notes</c> / <c>Reference</c> /
/// <c>ExternalRef</c> with the marker <see cref="Marker"/>. Re-running
/// the command skips buckets that already contain marker rows above a
/// small threshold — so hitting the endpoint five times in a row does
/// not multiply the data.
///
/// Safety: the caller is expected to have set
/// <see cref="PlatformSetting.OutboundEmailsDisabled"/> to true before
/// invoking; the handler itself refuses to run when it is false, so an
/// unattended re-run can never trigger the notification pipeline into
/// real customer inboxes.
/// </summary>
public record SeedTenantTestDataCommand(Guid TenantId) : IRequest<SeedTenantTestDataResult>;

public record SeedTenantTestDataResult(
    int CustomersCreated, int ProducersCreated, int PoliciesCreated,
    int ReceiptsCreated, int PaymentsCreated, int EndorsementsCreated,
    int CancellationsCreated, int CreditNotesCreated, int ClaimsCreated,
    int MovementsCreated, int AppointmentsCreated,
    string Notes);

public class SeedTenantTestDataCommandHandler
    : IRequestHandler<SeedTenantTestDataCommand, SeedTenantTestDataResult>
{
    private readonly IAppDbContext _db;
    private readonly IDateTimeProvider _clock;
    private readonly ILogger<SeedTenantTestDataCommandHandler> _log;
    public SeedTenantTestDataCommandHandler(IAppDbContext db, IDateTimeProvider clock,
        ILogger<SeedTenantTestDataCommandHandler> log)
    { _db = db; _clock = clock; _log = log; }

    // Marker string embedded in Notes / Reference / ExternalRef of every
    // seeded row so re-runs can dedupe and cleanup scripts can find them.
    public const string Marker = "[test-seed]";

    private static readonly string[] FirstNamesM = {
        "Νίκος", "Γιώργος", "Δημήτρης", "Κώστας", "Πέτρος", "Στέλιος", "Μάνος", "Σταύρος", "Παύλος", "Άρης",
        "Χρήστος", "Θανάσης", "Λευτέρης", "Μιχάλης", "Απόστολος" };
    private static readonly string[] FirstNamesF = {
        "Μαρία", "Ελένη", "Άννα", "Σοφία", "Κατερίνα", "Δήμητρα", "Χριστίνα", "Νεφέλη", "Ιωάννα", "Αγγελική",
        "Βίκυ", "Νατάσα", "Ρένα", "Θάλεια", "Αρετή" };
    private static readonly string[] LastNames = {
        "Παπαδάκης", "Γεωργίου", "Σταυρίδης", "Μιχαηλίδης", "Παππά", "Ζαφειρίου", "Νικολάου", "Πέτρου",
        "Ιωαννίδης", "Αντωνίου", "Δρακάκης", "Καραγιάννης", "Βασιλάκης", "Σιδέρης", "Λαζαρίδης",
        "Πανταζής", "Κρανάκης", "Ψυχογιός", "Μαρκόπουλος", "Χατζόπουλος" };
    private static readonly string[] Cities = {
        "Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Ηράκλειο", "Λάρισα", "Βόλος", "Χανιά", "Ιωάννινα", "Καβάλα", "Σύρος" };
    private static readonly string[] Streets = {
        "Ερμού", "Πατησίων", "Αλεξάνδρας", "Κηφισίας", "Βασ. Σοφίας", "Συγγρού", "Πειραιώς", "Σταδίου",
        "Ομονοίας", "Αχαρνών", "Ιπποκράτους", "Ακαδημίας", "Σκουφά", "Χαριλάου Τρικούπη" };

    public async Task<SeedTenantTestDataResult> Handle(SeedTenantTestDataCommand r, CancellationToken ct)
    {
        // The outbound-email guard used to require the global switch to
        // be flipped before this could run; that also silenced staff
        // password-resets and MFA codes, so it was replaced with a
        // permanent customer/producer-recipient block inside
        // BrevoEmailSender. Nothing to check here — seeded customer +
        // producer rows use @example.invalid addresses anyway, and any
        // real-recipient send that DID get triggered downstream would
        // still be caught by the sender's block.

        var tenant = await _db.Tenants.IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == r.TenantId && t.DeletedAt == null, ct)
            ?? throw AppException.NotFound("Tenant");

        var now = _clock.UtcNow;
        var rng = new Random(unchecked(tenant.Id.GetHashCode()));

        // Bucket dedup guard — count marker rows per table; skip buckets
        // that already have enough so a five-times click doesn't
        // multiply the office's dataset.
        var existingCustomers = await _db.Customers.IgnoreQueryFilters()
            .CountAsync(c => c.TenantId == r.TenantId && c.Notes != null && c.Notes.Contains(Marker), ct);
        // Producer entity has no free-form Notes field to embed the
        // marker; the seed uses a fixed Code prefix (TP-…) instead.
        var existingProducers = await _db.Producers.IgnoreQueryFilters()
            .CountAsync(p => p.TenantId == r.TenantId && p.Code.StartsWith("TP-"), ct);
        var existingPolicies = await _db.Policies.IgnoreQueryFilters()
            .CountAsync(p => p.TenantId == r.TenantId && p.Notes != null && p.Notes.Contains(Marker), ct);

        int customersCreated = 0, producersCreated = 0, policiesCreated = 0;
        int receiptsCreated = 0, paymentsCreated = 0;
        int endorsementsCreated = 0, cancellationsCreated = 0, creditNotesCreated = 0;
        int claimsCreated = 0, movementsCreated = 0, appointmentsCreated = 0;

        // Producers first — every policy needs one. Skip if we already have ≥5.
        var producers = new List<Producer>();
        if (existingProducers < 5)
        {
            for (int i = 0; i < 6; i++)
            {
                var name = $"{RandomName(rng, true)} (test #{i + 1})";
                var p = new Producer
                {
                    Id = Guid.NewGuid(),
                    TenantId = r.TenantId,
                    Name = name,
                    Code = $"TP-{i + 1:00}",
                    Email = $"producer-test-{i + 1}@example.invalid",
                    Phone = RandomPhone(rng),
                    HierarchyLevel = i < 2 ? HierarchyLevel.Producer : HierarchyLevel.Manager,
                    Status = ProducerStatus.Active,
                    CreatedAt = now.AddDays(-30 - rng.Next(300)),
                };
                _db.Producers.Add(p);
                producers.Add(p);
                producersCreated++;
            }
        }
        else
        {
            producers = await _db.Producers.IgnoreQueryFilters()
                .Where(p => p.TenantId == r.TenantId && p.DeletedAt == null && p.Status == ProducerStatus.Active)
                .Take(6).ToListAsync(ct);
        }

        // Customers — 25 fresh unless we already have ≥25.
        var customers = new List<Customer>();
        if (existingCustomers < 25)
        {
            var custNumber = await _db.Customers.IgnoreQueryFilters()
                .Where(c => c.TenantId == r.TenantId).CountAsync(ct);
            for (int i = 0; i < 30; i++)
            {
                var isCompany = rng.Next(5) == 0;
                var first = RandomName(rng, rng.Next(2) == 0);
                var last = LastNames[rng.Next(LastNames.Length)];
                var c = new Customer
                {
                    Id = Guid.NewGuid(),
                    TenantId = r.TenantId,
                    Type = isCompany ? CustomerType.Company : CustomerType.Individual,
                    CustomerNumber = $"TC-{(custNumber + i + 1):D5}",
                    FirstName = isCompany ? null : first,
                    LastName = isCompany ? null : last,
                    CompanyName = isCompany ? $"{last} & Υιοί ΙΚΕ" : null,
                    Email = $"cust-test-{i + 1}@example.invalid",
                    Phone = RandomPhone(rng),
                    MobilePhone = RandomPhone(rng),
                    VatNumber = $"09{rng.Next(10000000, 99999999)}",
                    Address = $"{Streets[rng.Next(Streets.Length)]} {rng.Next(1, 200)}",
                    City = Cities[rng.Next(Cities.Length)],
                    PostalCode = $"{rng.Next(10000, 99999)}",
                    Notes = $"{Marker} auto-generated {now:o}",
                    CreatedAt = now.AddDays(-rng.Next(400)),
                };
                _db.Customers.Add(c);
                customers.Add(c);
                customersCreated++;
            }
        }
        else
        {
            customers = await _db.Customers.IgnoreQueryFilters()
                .Where(c => c.TenantId == r.TenantId && c.DeletedAt == null)
                .Take(30).ToListAsync(ct);
        }

        // Save producers + customers first so their FKs are addressable
        // by the policies below.
        await _db.SaveChangesAsync(ct);

        // Insurance companies — pick from what already exists on the tenant.
        var carriers = await _db.InsuranceCompanies.IgnoreQueryFilters()
            .Where(x => (x.TenantId == r.TenantId || x.TenantId == null) && x.DeletedAt == null)
            .Take(10).ToListAsync(ct);
        if (carriers.Count == 0)
        {
            // No carriers exist — the tenant hasn't onboarded any. We can't
            // synthesize universal carriers safely, so stop cleanly.
            return new SeedTenantTestDataResult(customersCreated, producersCreated, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                "Tenant has no InsuranceCompanies configured. Add at least one carrier before running test-data seed.");
        }

        // Policies — mix of statuses and types across the customers.
        var policies = new List<Policy>();
        if (existingPolicies < 20)
        {
            for (int i = 0; i < 45; i++)
            {
                var cust = customers[rng.Next(customers.Count)];
                var producer = producers[rng.Next(producers.Count)];
                var carrier = carriers[rng.Next(carriers.Count)];
                var startAgoDays = rng.Next(30, 500);
                var start = DateOnly.FromDateTime(now.AddDays(-startAgoDays));
                var end = start.AddYears(1);
                var premium = 150m + rng.Next(1500);
                var policy = new Policy
                {
                    Id = Guid.NewGuid(),
                    TenantId = r.TenantId,
                    PolicyNumber = $"TP-{(i + 1):D6}",
                    CustomerId = cust.Id,
                    InsuranceCompanyId = carrier.Id,
                    ProducerId = producer.Id,
                    PolicyType = (PolicyType)((i % 6) + 1),   // Auto / Home / Health / Life / Business / Travel
                    Status = i % 12 == 11 ? PolicyStatus.Cancelled
                           : i % 8 == 7   ? PolicyStatus.Expired
                           : i % 5 == 4   ? PolicyStatus.PendingRenewal
                           : PolicyStatus.Active,
                    StartDate = start,
                    EndDate = end,
                    IssuedAt = start,
                    Premium = premium,
                    Currency = "EUR",
                    Notes = $"{Marker} auto-generated",
                    CreatedAt = now.AddDays(-startAgoDays + 1),
                };
                _db.Policies.Add(policy);
                policies.Add(policy);
                policiesCreated++;
            }
            await _db.SaveChangesAsync(ct);
        }
        else
        {
            policies = await _db.Policies.IgnoreQueryFilters()
                .Where(p => p.TenantId == r.TenantId && p.DeletedAt == null
                    && p.Notes != null && p.Notes.Contains(Marker))
                .Take(45).ToListAsync(ct);
        }

        // Receipts — one per active policy, marks the year's first premium paid.
        foreach (var policy in policies.Where(p => p.Status == PolicyStatus.Active).Take(30))
        {
            var receivedOn = policy.StartDate.AddDays(rng.Next(10));
            var rc = new Receipt
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                CustomerId = policy.CustomerId,
                PolicyId = policy.Id,
                Number = $"TR-{policy.PolicyNumber}",
                ReceivedOn = receivedOn,
                Amount = policy.Premium,
                Currency = policy.Currency,
                Method = PaymentMethod.Cash,
                Notes = Marker,
                CreatedAt = now.AddDays(-rng.Next(200)),
            };
            _db.Receipts.Add(rc);
            _db.FinancialMovements.Add(new FinancialMovement
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                MovementDate = receivedOn,
                Kind = FinancialMovementKind.CustomerCredit,
                Amount = policy.Premium,
                Currency = policy.Currency,
                CustomerId = policy.CustomerId,
                PolicyId = policy.Id,
                ReceiptId = rc.Id,
                Description = $"{Marker} Είσπραξη {rc.Number}",
            });
            receiptsCreated++;
            movementsCreated++;
        }

        // Endorsements — a couple per few policies.
        foreach (var policy in policies.Take(8))
        {
            var e = new PolicyEndorsement
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                PolicyId = policy.Id,
                EndorsementNumber = $"TE-{policy.PolicyNumber}",
                Type = EndorsementType.ChangeData,
                Status = EndorsementStatus.Issued,
                IssuedAt = policy.StartDate.AddDays(60),
                EffectiveFrom = policy.StartDate.AddDays(60),
                Description = $"{Marker} μεταβολή στοιχείων",
                PremiumDelta = 25m + rng.Next(100),
                CommissionDelta = 5m + rng.Next(20),
                Currency = policy.Currency,
                CreatedAt = now.AddDays(-rng.Next(100)),
            };
            _db.PolicyEndorsements.Add(e);
            endorsementsCreated++;
        }

        // Cancellations — for the ones we set Cancelled above.
        int seq = await _db.PolicyCancellations.IgnoreQueryFilters()
            .CountAsync(c => c.CancellationNumber.StartsWith($"AK-{now.Year}-"), ct);
        foreach (var policy in policies.Where(p => p.Status == PolicyStatus.Cancelled))
        {
            seq++;
            _db.PolicyCancellations.Add(new PolicyCancellation
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                PolicyId = policy.Id,
                CancellationNumber = $"AK-{now.Year}-{seq:D5}",
                Status = PolicyCancellationStatus.Effective,
                RequestedAt = DateOnly.FromDateTime(now),
                EffectiveFrom = DateOnly.FromDateTime(now),
                RefundMethod = "ProRata",
                RefundAmount = policy.Premium * 0.4m,
                Currency = policy.Currency,
                Notes = $"{Marker} auto-cancellation",
                ApprovedAt = now,
                CreatedAt = now.AddDays(-rng.Next(30)),
            });
            cancellationsCreated++;
        }

        // Credit notes + matching FinancialMovements — for a few refunds
        // and for the manual-refund case.
        int cnSeq = await _db.CreditNotes.IgnoreQueryFilters()
            .CountAsync(n => n.CreditNoteNumber.StartsWith($"PI-{now.Year}-"), ct);
        foreach (var policy in policies.Take(4))
        {
            cnSeq++;
            var amount = 50m + rng.Next(200);
            var number = $"PI-{now.Year}-{cnSeq:D5}";
            _db.CreditNotes.Add(new CreditNote
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                CreditNoteNumber = number,
                Kind = CreditNoteKind.Manual,
                Status = CreditNoteStatus.Issued,
                IssuedAt = DateOnly.FromDateTime(now.AddDays(-rng.Next(60))),
                CustomerId = policy.CustomerId,
                PolicyId = policy.Id,
                Amount = amount,
                Currency = policy.Currency,
                Description = $"{Marker} πιστωτικό δοκιμής",
                CreatedAt = now.AddDays(-rng.Next(60)),
            });
            _db.FinancialMovements.Add(new FinancialMovement
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                MovementDate = DateOnly.FromDateTime(now),
                Kind = FinancialMovementKind.CustomerCredit,
                Amount = amount,
                Currency = policy.Currency,
                CustomerId = policy.CustomerId,
                PolicyId = policy.Id,
                Description = $"{Marker} Πιστωτικό {number}",
            });
            creditNotesCreated++;
            movementsCreated++;
        }

        // Claims — a handful on random policies.
        foreach (var policy in policies.Where(p => p.PolicyType == PolicyType.Auto).Take(5))
        {
            _db.Claims.Add(new Claim
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                PolicyId = policy.Id,
                ClaimNumber = $"TCL-{policy.PolicyNumber}",
                Status = ClaimStatus.Reported,
                Description = $"{Marker} test claim",
                IncidentDate = DateOnly.FromDateTime(now.AddDays(-rng.Next(120))),
                ReportedDate = DateOnly.FromDateTime(now.AddDays(-rng.Next(60))),
                CreatedAt = now.AddDays(-rng.Next(60)),
            });
            claimsCreated++;
        }

        // Appointments — a couple this month across random customers.
        for (int i = 0; i < 6; i++)
        {
            var cust = customers[rng.Next(customers.Count)];
            var starts = now.AddDays(rng.Next(-10, 20)).AddHours(9 + rng.Next(8));
            _db.Appointments.Add(new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = r.TenantId,
                CustomerId = cust.Id,
                Title = $"{Marker} Ραντεβού #{i + 1}",
                StartsAt = starts,
                EndsAt = starts.AddMinutes(30 + rng.Next(4) * 15),
                Status = AppointmentStatus.Scheduled,
                Description = "Test",
                CreatedAt = now,
            });
            appointmentsCreated++;
        }

        await _db.SaveChangesAsync(ct);

        var notes = $"Seeded into tenant {tenant.Code} ({tenant.Name}). Every row carries the marker '{Marker}' for later cleanup.";
        _log.LogInformation("SeedTenantTestData completed for {Tenant}: {Customers} customers, {Policies} policies",
            tenant.Code, customersCreated, policiesCreated);

        return new SeedTenantTestDataResult(
            customersCreated, producersCreated, policiesCreated,
            receiptsCreated, paymentsCreated, endorsementsCreated,
            cancellationsCreated, creditNotesCreated, claimsCreated,
            movementsCreated, appointmentsCreated, notes);
    }

    private static string RandomName(Random rng, bool male)
    {
        var pool = male ? FirstNamesM : FirstNamesF;
        return $"{pool[rng.Next(pool.Length)]} {LastNames[rng.Next(LastNames.Length)]}";
    }

    private static string RandomPhone(Random rng) =>
        $"69{rng.Next(10000000, 99999999)}";
}
