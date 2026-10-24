using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.VehicleOwnership;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace Kalypsis.Application.Features.Policies;

public sealed record VehicleOwnershipWorkspace(OwnershipLedger Ledger, string Plate, string Vin);
public sealed record GetVehicleOwnership(Guid PolicyId) : IRequest<VehicleOwnershipWorkspace>;
public sealed record ChangeVehicleOwnershipBody(int ExpectedRevision, string Operation, OwnershipChange Change,
    OwnershipPerson[]? Owners = null, Guid? PrimaryOwnerId = null, Guid? FromOwnerId = null,
    OwnershipPerson? Recipient = null, decimal? Percentage = null, bool MakePrimary = false);
public sealed record ChangeVehicleOwnership(Guid PolicyId, ChangeVehicleOwnershipBody Body) : IRequest<VehicleOwnershipWorkspace>;

public sealed class VehicleOwnershipHandler(IAppDbContext db, ICurrentUser current, IDateTimeProvider clock)
    : IRequestHandler<GetVehicleOwnership, VehicleOwnershipWorkspace>, IRequestHandler<ChangeVehicleOwnership, VehicleOwnershipWorkspace>
{
    public async Task<VehicleOwnershipWorkspace> Handle(GetVehicleOwnership request, CancellationToken ct)
    {
        var (_, register, initial, plate, vin, _) = await Load(request.PolicyId, ct);
        return new(register is null ? initial : OwnershipRules.Deserialize(register.LedgerJson), plate, vin);
    }
    public async Task<VehicleOwnershipWorkspace> Handle(ChangeVehicleOwnership request, CancellationToken ct)
    {
        var (policy, register, initial, plate, vin, key) = await Load(request.PolicyId, ct);
        var ledger = register is null ? initial : OwnershipRules.Deserialize(register.LedgerJson);
        var body = request.Body;
        if(body.Change is null)throw AppException.Validation("Συμπληρώστε τα στοιχεία μεταβολής.");
        if (body.ExpectedRevision != ledger.Revision) throw AppException.Conflict("Η ιδιοκτησία άλλαξε από άλλο χρήστη. Ανανεώστε την καρτέλα και επαναλάβετε.");
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(clock.UtcNow, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens")));
        try
        {
            OwnershipLedger next;
            if (body.Operation == "replace") next = OwnershipRules.Replace(ledger, await Resolve(body.Owners ?? [], ct),
                body.PrimaryOwnerId ?? Guid.Empty, body.Change, today, clock.UtcNow);
            else if (body.Operation == "transfer")
            {
                var recipient = (await Resolve([body.Recipient ?? throw AppException.Validation("Επιλέξτε νέο ιδιοκτήτη.")], ct))[0];
                next = OwnershipRules.Transfer(ledger, body.FromOwnerId ?? Guid.Empty, recipient, body.Percentage ?? 0,
                    body.MakePrimary, body.Change, today, clock.UtcNow);
            }
            else if (body.Operation == "reverse") next = OwnershipRules.ReverseLast(ledger, body.Change, today, clock.UtcNow);
            else throw AppException.Validation("Μη υποστηριζόμενη μεταβολή ιδιοκτησίας.");
            // All current and restored links must still belong to this office.
            await Resolve(next.Owners, ct);
            if (register is null)
            {
                register = new VehicleOwnershipRegister { TenantId = policy.TenantId, AgencyOfficeScopeId = current.AgencyOfficeId ?? policy.AgencyOfficeScopeId,
                    VehicleKey = key, Plate = plate, Vin = vin, AnchorPolicyId = policy.Id };
                db.VehicleOwnershipRegisters.Add(register);
            }
            next = next with { Events = [..next.Events[..^1], next.Events[^1] with { Actor = current.Email ?? current.UserId?.ToString() ?? "" }] };
            register.LedgerJson = OwnershipRules.Serialize(next); register.Revision = next.Revision;
            register.PrimaryCustomerId = OwnershipRules.Primary(next).CustomerId!.Value;
            await db.SaveChangesAsync(ct);
            return new(next, plate, vin);
        }
        catch (OwnershipException ex) { throw AppException.Validation(ex.Message); }
        catch (DbUpdateConcurrencyException) { throw AppException.Conflict("Άλλος χρήστης αποθήκευσε μεταβολή ιδιοκτησίας. Ανανεώστε την καρτέλα."); }
        catch (DbUpdateException ex) when (register?.Revision == 1 && ex.InnerException?.Message.Contains("Duplicate entry", StringComparison.OrdinalIgnoreCase) == true) { throw AppException.Conflict("Το μητρώο ιδιοκτησίας δημιουργήθηκε ήδη. Ανανεώστε την καρτέλα και επαναλάβετε."); }
    }
    private async Task<OwnershipPerson[]> Resolve(OwnershipPerson[] rows, CancellationToken ct)
    {
        if(rows.Any(p=>p is null))throw AppException.Validation("Μη έγκυρη εγγραφή ιδιοκτήτη.");
        var ids = rows.Where(p => p.CustomerId.HasValue).Select(p => p.CustomerId!.Value).Distinct().ToArray();
        var people = await db.Customers.AsNoTracking().Where(c => c.TenantId == current.TenantId && ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
        if (people.Count != ids.Length) throw AppException.Validation("Ο επιλεγμένος πελάτης δεν είναι διαθέσιμος σε αυτό το γραφείο.");
        return rows.Select(p => p.CustomerId.HasValue ? p with { Name = Display(people[p.CustomerId.Value]), VatNumber = people[p.CustomerId.Value].VatNumber ?? "" } : p).ToArray();
    }
    private async Task<(Policy, VehicleOwnershipRegister?, OwnershipLedger, string, string, string)> Load(Guid id, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var policy = await db.Policies.AsNoTracking().Include(p => p.Customer).FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenant, ct)
            ?? throw AppException.NotFound("Συμβόλαιο οχήματος");
        string vin;
        try { var specs = OwnershipRules.Object(policy.SpecsJson); vin = Normalize(((specs["vehicle"] as JsonObject)?["vin"] ?? specs["vin"])?.ToString()); }
        catch (OwnershipException ex) { throw AppException.Validation(ex.Message); }
        var plate = Normalize(policy.VehicleRegistrationPlate);
        if (plate.Length == 0 && vin.Length == 0) throw AppException.Validation("Το όχημα χρειάζεται πινακίδα ή αριθμό πλαισίου.");
        var scope = current.AgencyOfficeId ?? policy.AgencyOfficeScopeId;
        var key = (scope?.ToString("N") ?? "headquarters") + ":" + (vin.Length > 0 ? "VIN:" + vin : "PLATE:" + plate);
        var candidates = await db.VehicleOwnershipRegisters.Where(r => r.TenantId == tenant &&
            (r.AnchorPolicyId == id || r.VehicleKey == key || (vin != "" && r.Vin == vin) || (plate != "" && r.Plate == plate))).ToListAsync(ct);
        var register = candidates.FirstOrDefault(r => r.AnchorPolicyId == id || vin.Length > 0 && r.Vin == vin)
            ?? candidates.FirstOrDefault(r => r.Plate == plate && (vin.Length == 0 || r.Vin.Length == 0 || r.Vin == vin));
        // Do not infer ownership dates from insurance dates.
        OwnershipLedger initial;
        try { initial = OwnershipRules.Legacy(policy.SpecsJson, policy.Id, policy.CustomerId, Display(policy.Customer), policy.Customer?.VatNumber ?? ""); }
        catch (OwnershipException ex) { throw AppException.Validation(ex.Message); }
        return (policy, register, initial, plate, vin, key);
    }
    private static string Display(Customer? c) => c is null ? "" : c.Type != Kalypsis.Domain.Enums.CustomerType.Individual && !string.IsNullOrWhiteSpace(c.CompanyName) ? c.CompanyName : string.Join(" ", new[] { c.LastName, c.FirstName }.Where(s => !string.IsNullOrWhiteSpace(s)));
    public static string Normalize(string? value)
    {
        const string greek = "ΑΒΕΖΗΙΚΜΝΟΡΤΥΧ", latin = "ABEZHIKMNOPTYX";
        return new string((value ?? "").ToUpperInvariant().Where(char.IsLetterOrDigit).Select(c => greek.IndexOf(c) is var i && i >= 0 ? latin[i] : c).ToArray());
    }
}
