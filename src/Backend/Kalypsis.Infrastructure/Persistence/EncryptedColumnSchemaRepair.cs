using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>Repair pre-encryption varchar widths using EF's actual, case-sensitive table mappings.</summary>
public static class EncryptedColumnSchemaRepair
{
    public sealed record Target(string Table, string Column, int MinimumLength);

    public static IReadOnlyList<Target> Targets(IModel model) => model.GetEntityTypes()
        .Where(entity => entity.GetTableName() is not null)
        .SelectMany(entity => entity.GetProperties()
            .Where(property => property.GetValueConverter() is EncryptedStringConverter && property.GetMaxLength().HasValue)
            .Select(property => new Target(entity.GetTableName()!, property.GetColumnName(StoreObjectIdentifier.Table(entity.GetTableName()!, entity.GetSchema()))!, property.GetMaxLength()!.Value)))
        .Distinct().ToArray();

    private sealed record Column(string Table, string Name, string Type, long? Length, bool Nullable, string? Default, string? Charset, string? Collation, string Comment, string Extra);
    private static string Identifier(string name) => "`" + name.Replace("`", "``", StringComparison.Ordinal) + "`";
    private static string Literal(string value, bool noBackslashEscapes) => "'" + (noBackslashEscapes ? value : value.Replace("\\", "\\\\", StringComparison.Ordinal)).Replace("'", "''", StringComparison.Ordinal) + "'";

    public static async Task EnsureAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var connection = db.Database.GetDbConnection();
        var opened = connection.State != ConnectionState.Open;
        if (opened) await db.Database.OpenConnectionAsync(ct);
        try
        {
            await using var modeCommand = connection.CreateCommand();
            modeCommand.CommandText = "SELECT @@SESSION.sql_mode";
            var noBackslashEscapes = Convert.ToString(await modeCommand.ExecuteScalarAsync(ct), CultureInfo.InvariantCulture)?.Split(',').Contains("NO_BACKSLASH_ESCAPES", StringComparer.OrdinalIgnoreCase) == true;
            foreach (var target in Targets(db.Model))
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_COMMENT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema AND LOWER(TABLE_NAME) = LOWER(@table) AND LOWER(COLUMN_NAME) = LOWER(@column)";
                foreach (var (name, value) in new[] { ("@schema", connection.Database), ("@table", target.Table), ("@column", target.Column) })
                {
                    var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.Value = value; command.Parameters.Add(parameter);
                }
                var candidates = new List<Column>();
                await using (var reader = await command.ExecuteReaderAsync(ct))
                {
                    while (await reader.ReadAsync(ct)) candidates.Add(new Column(reader.GetString(0), reader.GetString(1), reader.GetString(2),
                        reader.IsDBNull(3) ? null : Convert.ToInt64(reader.GetValue(3), CultureInfo.InvariantCulture), reader.GetString(4) == "YES",
                        reader.IsDBNull(5) ? null : reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetString(8), reader.GetString(9)));
                }
                // Linux can contain both Garages and garages; never widen the wrong table.
                // Windows lower_case_table_names normalizes names, so a unique insensitive match is allowed.
                var column = candidates.FirstOrDefault(candidate => candidate.Table == target.Table && candidate.Name == target.Column)
                    ?? (candidates.Count == 1 ? candidates[0] : null);
                if (column is null)
                {
                    if (candidates.Count > 1) throw new InvalidOperationException($"Ambiguous encrypted column mapping: {target.Table}.{target.Column}");
                    continue; // A later safety-net CREATE TABLE may introduce this entity.
                }
                if (column.Length is null || column.Length >= target.MinimumLength) continue; // TEXT / already widened.
                if (column.Type is not ("varchar" or "char") || column.Extra.Length != 0)
                    throw new InvalidOperationException($"Cannot safely widen encrypted column {column.Table}.{column.Name} ({column.Type}, {column.Extra}).");

                var charset = column.Charset is null ? "" : " CHARACTER SET " + Identifier(column.Charset);
                var collation = column.Collation is null ? "" : " COLLATE " + Identifier(column.Collation);
                var nullable = column.Nullable ? " NULL" : " NOT NULL";
                var defaultValue = column.Default is not null ? " DEFAULT " + Literal(column.Default, noBackslashEscapes) : column.Nullable ? " DEFAULT NULL" : "";
                await using var alter = connection.CreateCommand();
                alter.CommandText = $"ALTER TABLE {Identifier(column.Table)} MODIFY COLUMN {Identifier(column.Name)} varchar({target.MinimumLength}){charset}{collation}{nullable}{defaultValue} COMMENT {Literal(column.Comment, noBackslashEscapes)}";
                await alter.ExecuteNonQueryAsync(ct);
                logger.LogInformation("Encrypted-column schema repair widened {Table}.{Column} from {OldLength} to {NewLength} characters.", column.Table, column.Name, column.Length, target.MinimumLength);
            }
        }
        finally { if (opened) await db.Database.CloseConnectionAsync(); }
    }
}
