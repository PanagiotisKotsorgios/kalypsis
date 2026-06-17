using System.Globalization;
using System.Text;

namespace Kalypsis.Application.Common;

/// <summary>
/// RFC 4180 CSV with UTF-8 BOM and `;` separator so Excel opens it cleanly
/// in Greek/EU locales without needing a Text Import Wizard.
/// </summary>
public static class CsvWriter
{
    public static byte[] Build(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<object?>> rows)
    {
        var sb = new StringBuilder();
        sb.Append(string.Join(";", headers.Select(Escape)));
        sb.Append("\r\n");
        foreach (var row in rows)
        {
            sb.Append(string.Join(";", row.Select(FormatCell)));
            sb.Append("\r\n");
        }
        var bom = new byte[] { 0xEF, 0xBB, 0xBF };
        var body = Encoding.UTF8.GetBytes(sb.ToString());
        var result = new byte[bom.Length + body.Length];
        Buffer.BlockCopy(bom, 0, result, 0, bom.Length);
        Buffer.BlockCopy(body, 0, result, bom.Length, body.Length);
        return result;
    }

    private static string FormatCell(object? value)
    {
        if (value is null) return string.Empty;
        return value switch
        {
            DateTime dt => Escape(dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)),
            DateOnly d => Escape(d.ToString("yyyy-MM-dd")),
            decimal m => Escape(m.ToString("0.00", CultureInfo.InvariantCulture)),
            double db => Escape(db.ToString("0.00", CultureInfo.InvariantCulture)),
            bool b => b ? "1" : "0",
            _ => Escape(value.ToString() ?? string.Empty)
        };
    }

    private static string Escape(string value)
    {
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        return value;
    }
}
