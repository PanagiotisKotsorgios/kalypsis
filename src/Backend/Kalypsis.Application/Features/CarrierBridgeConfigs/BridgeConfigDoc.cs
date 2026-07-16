namespace Kalypsis.Application.Features.CarrierBridgeConfigs;

/*
 * BridgeConfigDoc — the JSON shape stored in CarrierBridgeConfig.ConfigJson.
 * Any field the SuperAdmin can tweak from the visual builder lives here.
 * Adding a new option = add a property here + a control in the builder UI +
 * a case in ExecuteBridgeConfigService. Nothing else.
 *
 * Kept intentionally flat / property-only (no polymorphism) so the JSON
 * round-trips cleanly through System.Text.Json on both frontend and backend
 * without custom converters. The frontend TS interface mirrors this shape.
 */

public class BridgeConfigDoc
{
    /// <summary>xlsx / csv / txt / zip</summary>
    public string FileType { get; set; } = "xlsx";

    // ─── XLSX/CSV parsing hints ────────────────────────────────────────
    /// <summary>Excel sheet name. Null = first sheet.</summary>
    public string? SheetName { get; set; }

    /// <summary>1-based row index containing headers. Data starts on the next row.</summary>
    public int HeaderRow { get; set; } = 1;

    /// <summary>CSV/TXT delimiter (";" | "," | "|" | "\t"). Ignored for xlsx.</summary>
    public string CsvDelimiter { get; set; } = ";";

    /// <summary>"utf-8" | "windows-1253" | "iso-8859-7". Ignored for xlsx.</summary>
    public string Encoding { get; set; } = "utf-8";

    /// <summary>How many first data rows to skip (after the header row).</summary>
    public int SkipRows { get; set; } = 0;

    // ─── Column mapping ────────────────────────────────────────────────
    public List<ColumnMapping> Mappings { get; set; } = new();

    // ─── Row-level filters ─────────────────────────────────────────────
    public List<RowFilter> Filters { get; set; } = new();

    // ─── Global transformations ────────────────────────────────────────
    /// <summary>Date format for parsing dates in this file (e.g. "dd/MM/yyyy").</summary>
    public string DateFormat { get; set; } = "dd/MM/yyyy";

    /// <summary>Decimal separator (",", "." )</summary>
    public string DecimalSeparator { get; set; } = ",";

    /// <summary>Currency string stripped from numeric fields before parsing (e.g. "€").</summary>
    public string? CurrencyStrip { get; set; }
}

/// <summary>
/// One row per target field the config wants to populate. Source is the
/// column name (from headers) or an ordinal like "col:5". Transform allows
/// per-field tweaks (trim, uppercase, split, concat...).
/// </summary>
public class ColumnMapping
{
    /// <summary>Target field name in the canonical model. Free-form for now;
    /// we don't hard-validate against a schema so the SuperAdmin can shape
    /// the output to match whatever the downstream import expects.</summary>
    public string Target { get; set; } = "";

    /// <summary>Header name from row HeaderRow. "col:5" targets the 5th column
    /// by position when headers are unreliable.</summary>
    public string Source { get; set; } = "";

    /// <summary>Optional field-level transformation. "none" | "trim" | "upper" |
    /// "lower" | "digitsOnly" | "asDate" | "asNumber". More can be added.</summary>
    public string Transform { get; set; } = "none";

    /// <summary>Default value when source is missing/empty.</summary>
    public string? DefaultValue { get; set; }

    /// <summary>Optional Regex applied to the value; ${1} etc. can be used in Replacement.
    /// Empty = no regex step.</summary>
    public string? RegexPattern { get; set; }
    public string? RegexReplacement { get; set; }
}

/// <summary>
/// Include/exclude rows based on a source column matching a value. Multiple
/// filters AND together. Empty list = keep every row.
/// </summary>
public class RowFilter
{
    public string Source { get; set; } = "";
    /// <summary>"equals" | "notEquals" | "contains" | "notEmpty" | "empty"</summary>
    public string Op { get; set; } = "equals";
    public string? Value { get; set; }
}
