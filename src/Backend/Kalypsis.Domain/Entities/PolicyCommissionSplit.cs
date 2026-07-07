using Kalypsis.Domain.Common;
using Kalypsis.Domain.Enums;

namespace Kalypsis.Domain.Entities;

/// <summary>
/// One row per (policy × hierarchy level) — the auditable "at time of save,
/// this is what each person in the chain earned" ledger. Materialised by
/// PolicyCommissionCalculator on policy create + update, and rewritten (delete
/// + reinsert) when the premium or the matched CommissionRule changes.
///
/// Splits DO NOT replace <see cref="CommissionTransaction"/> — transactions
/// remain the payable ledger tied to CommissionRuns. Splits are the immutable
/// snapshot of "what the calculator decided at this moment", so we can render
/// the ALIS-style F9 matrix on any policy without re-running the engine.
/// </summary>
public class PolicyCommissionSplit : TenantEntity
{
    public Guid PolicyId { get; set; }
    public Policy Policy { get; set; } = null!;

    public HierarchyLevel HierarchyLevel { get; set; }

    /// <summary>
    /// The specific producer node paid at this level, if we could resolve one
    /// by walking up the leaf producer's ParentProducer chain. Null means the
    /// level was defined in the rule but no chain node matched — e.g. a
    /// producer with no Manager still shows an Agency row.
    /// </summary>
    public Guid? ProducerId { get; set; }
    public Producer? Producer { get; set; }

    public decimal Percent { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal TaxWithholdingAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "EUR";
}
