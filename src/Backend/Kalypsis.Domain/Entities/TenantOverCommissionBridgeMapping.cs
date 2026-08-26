using Kalypsis.Domain.Common;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// Per-(tenant, carrier) mapping profile that describes HOW to parse
/// the specific file format the tenant receives from that carrier.
/// Different agencies get different producer-scoped exports from the
/// same insurer (column order, sheet name, encoding, delimiter,
/// header row) — this row captures one tenant's customisation so the
/// OC-bridge importer knows what to feed the parser.
///
/// The concrete config lives in <see cref="ConfigJson"/> as free-form
/// JSON so we can evolve the schema without a migration each time a
/// new carrier variant appears. The current shape (documented in the
/// admin editor UI) is roughly:
///
///   {
///     "sheetName": "Sheet1",                 // for .xlsx
///     "headerRowIndex": 0,
///     "encoding": "cp1253",                  // for .csv/.txt
///     "delimiter": ";",
///     "skipTrailerRows": 0,
///     "fieldMap": {
///       "policyNumber": "AR_SIMV",           // canonical → source column
///       "producerCode": "KOD_SYN",
///       "netPremium":   "NETO",
///       "commissionAmt":"PROMH"
///     },
///     "notes": "prev. version had Sheet «Data»; verified against 09/2026"
///   }
///
/// <see cref="IsReady"/> is the user-facing gate: even if a mapping row
/// exists, availability only flips to «Διαθέσιμο» when the operator
/// marks it ready after a successful test-parse. Prevents half-configured
/// mappings from causing bad imports on a live bridge run.
/// </summary>
public class TenantOverCommissionBridgeMapping : TenantEntity
{
    public Guid InsuranceCompanyId { get; set; }
    public InsuranceCompany InsuranceCompany { get; set; } = null!;

    /// <summary>JSON blob — see class summary for current schema shape.</summary>
    public string ConfigJson { get; set; } = "{}";

    /// <summary>True after the operator has tested the mapping against
    /// a real sample and confirmed it works. Only ready mappings count
    /// for OC availability on the tenant surface.</summary>
    public bool IsReady { get; set; }

    public DateTime? LastTestedAt { get; set; }
    public string? LastTestResult { get; set; }
    public Guid? LastEditedByUserId { get; set; }
}
