using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using Kalypsis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Integrations;

/// <summary>
/// Office-scoped OpenAI adapter. Every request resolves the encrypted key from
/// the current office's IntegrationSettings (the DbContext office filter is
/// applied automatically). There is no platform-wide fallback key.
/// </summary>
public sealed class OfficeAiService : IAiService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUser _current;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<OfficeAiService> _log;

    public OfficeAiService(AppDbContext db, ICurrentUser current, IHttpClientFactory http, ILogger<OfficeAiService> log)
    { _db = db; _current = current; _http = http; _log = log; }

    public string Model => "office-openai";

    public async Task<AiChurnResult> ScoreChurnAsync(Guid customerId, CancellationToken ct = default)
    {
        var tenant = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var policies = await _db.Policies.AsNoTracking().Where(p => p.TenantId == tenant && p.CustomerId == customerId && p.DeletedAt == null)
            .Select(p => new { p.EndDate, p.Status, p.PaidOnCredit, p.PaymentPromisedOn }).ToListAsync(ct);
        var claims = await _db.Claims.AsNoTracking().CountAsync(c => c.TenantId == tenant && c.Policy.CustomerId == customerId && c.DeletedAt == null, ct);
        var lastContact = await _db.CommunicationLogs.AsNoTracking().Where(c => c.TenantId == tenant && c.CustomerId == customerId && c.DeletedAt == null)
            .OrderByDescending(c => c.OccurredAt).Select(c => (DateTime?)c.OccurredAt).FirstOrDefaultAsync(ct);

        var factors = new List<AiChurnFactor>();
        var score = 0d;
        if (policies.Any(p => p.EndDate.DayNumber - today.DayNumber <= 30)) { score += .28; factors.Add(new("Επικείμενη λήξη", .28, "Υπάρχει συμβόλαιο που λήγει μέσα στις επόμενες 30 ημέρες.")); }
        if (policies.Any(p => p.EndDate < today)) { score += .24; factors.Add(new("Ληγμένο συμβόλαιο", .24, "Δεν έχει καταγραφεί έγκαιρη ανανέωση.")); }
        if (claims >= 2) { score += .18; factors.Add(new("Πολλαπλές ζημιές", .18, $"Υπάρχουν {claims} καταχωρημένες ζημιές.")); }
        else if (claims == 1) { score += .10; factors.Add(new("Ιστορικό ζημιάς", .10, "Υπάρχει τουλάχιστον μία καταχωρημένη ζημιά.")); }
        if (!lastContact.HasValue || (DateTime.UtcNow - lastContact.Value).TotalDays > 180) { score += .18; factors.Add(new("Έλλειψη επικοινωνίας", .18, "Δεν υπάρχει πρόσφατη επικοινωνία τους τελευταίους έξι μήνες.")); }
        if (policies.Count == 1) { score += .08; factors.Add(new("Μοναδικό συμβόλαιο", .08, "Υπάρχει ευκαιρία διατήρησης και συμπληρωματικής κάλυψης.")); }
        if (policies.Any(p => p.PaidOnCredit || (p.PaymentPromisedOn.HasValue && p.PaymentPromisedOn.Value < today))) { score += .12; factors.Add(new("Οικονομική εκκρεμότητα", .12, "Υπάρχει πίστωση ή εκπρόθεσμη υπόσχεση πληρωμής.")); }
        score = Math.Min(1, Math.Round(score, 2));
        var band = score >= .70 ? "Critical" : score >= .45 ? "At-risk" : score >= .25 ? "Watch" : "Safe";
        await RecordAsync(AiTaskType.ChurnScore, "rules", $"customer:{customerId}", $"score:{score:0.00};band:{band}", 0, 0, true, null, ct);
        return new AiChurnResult(score, band, factors.OrderByDescending(x => x.Weight).ToList());
    }

    public async Task<string> SummarisePortfolioAsync(Guid tenantId, CancellationToken ct = default)
    {
        var effectiveTenant = _current.TenantId ?? tenantId;
        var customers = await _db.Customers.AsNoTracking().CountAsync(c => c.TenantId == effectiveTenant && c.DeletedAt == null, ct);
        var policies = await _db.Policies.AsNoTracking().Where(p => p.TenantId == effectiveTenant && p.DeletedAt == null).ToListAsync(ct);
        var prompt = $"Γράψε σύντομη επιχειρησιακή σύνοψη στα ελληνικά για ασφαλιστικό γραφείο. Πελάτες: {customers}. Συμβόλαια: {policies.Count}. Ενεργά: {policies.Count(p => p.Status == PolicyStatus.Active)}. Λήξεις 30 ημερών: {policies.Count(p => p.EndDate <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30))}. Μην δώσεις ασφαλιστική ή νομική συμβουλή· μόνο προτεραιότητες λειτουργίας.";
        var result = await CompleteAsync(AiTaskType.PortfolioSummary, prompt, ct);
        return result.Success && !string.IsNullOrWhiteSpace(result.Text) ? result.Text! : $"Το γραφείο έχει {customers} πελάτες και {policies.Count} συμβόλαια. Δώστε προτεραιότητα σε λήξεις και εκκρεμείς επικοινωνίες.";
    }

    public async Task<AiDraftResult> DraftCommunicationAsync(AiDraftRequest req, CancellationToken ct = default)
    {
        var vars = req.Variables is null ? "" : string.Join("; ", req.Variables.Select(x => $"{x.Key}: {x.Value}"));
        var prompt = $"Σύνταξε επαγγελματικό email ή SMS στα ελληνικά για ασφαλιστικό γραφείο. Τύπος: {req.Task}. Στοιχεία: {vars}. Επέστρεψε πρώτα SUBJECT: και μετά BODY:. Μην επινοήσεις στοιχεία και μην δώσεις δεσμευτική ασφαλιστική ή νομική συμβουλή.";
        var result = await CompleteAsync(req.Task, prompt, ct);
        if (!result.Success) return new AiDraftResult(false, null, null, result.Error);
        var text = result.Text ?? "";
        var subject = text.StartsWith("SUBJECT:", StringComparison.OrdinalIgnoreCase) ? text.Split('\n', 2)[0][8..].Trim() : "Επικοινωνία από το γραφείο μας";
        var body = text.Contains('\n') ? text[(text.IndexOf('\n') + 1)..].Replace("BODY:", "", StringComparison.OrdinalIgnoreCase).Trim() : text;
        return new AiDraftResult(true, subject, body, null);
    }

    public async Task<AiExtractPolicyResult> ExtractPolicyFromPdfAsync(Stream pdf, CancellationToken ct = default)
    {
        var key = await GetSettingAsync("OpenAiApiKey", ct);
        if (string.IsNullOrWhiteSpace(key)) return new(false, null, null, null, null, null, null, null, "Ρυθμίστε πρώτα το office OpenAI key από τις Ρυθμίσεις AI.");
        using var buffer = new MemoryStream(); await pdf.CopyToAsync(buffer, ct);
        var model = await GetSettingAsync("OpenAiModel", ct) ?? "gpt-4o-mini";
        var prompt = "Διάβασε το ασφαλιστήριο PDF και επέστρεψε μόνο JSON με πεδία policyNumber, carrier, productType, startDate (yyyy-MM-dd), endDate (yyyy-MM-dd), premium (δεκαδικός), fullJson. Αν λείπει πεδίο, βάλε null. Μην επινοήσεις στοιχεία.";
        try
        {
            using var client = _http.CreateClient("openai");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
            var payload = new { model, temperature = 0.1, input = new[] { new { role = "user", content = new object[] {
                new { type = "input_file", filename = "policy.pdf", file_data = "data:application/pdf;base64," + Convert.ToBase64String(buffer.ToArray()) },
                new { type = "input_text", text = prompt }
            } } } };
            using var response = await client.PostAsJsonAsync("responses", payload, ct);
            var raw = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"OpenAI HTTP {(int)response.StatusCode}");
            using var document = JsonDocument.Parse(raw);
            var text = ReadResponseText(document.RootElement);
            var jsonText = text.Trim().Trim('`'); if (jsonText.StartsWith("json", StringComparison.OrdinalIgnoreCase)) jsonText = jsonText[4..].Trim();
            using var extracted = JsonDocument.Parse(jsonText); var root = extracted.RootElement;
            var usage = document.RootElement.TryGetProperty("usage", out var u) ? u : default;
            var input = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("input_tokens", out var i) ? i.GetInt32() : 0;
            var output = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("output_tokens", out var o) ? o.GetInt32() : 0;
            await RecordAsync(AiTaskType.ExtractPolicyPdf, model, prompt, text, input, output, true, null, ct);
            return new(true, ReadString(root, "policyNumber"), ReadString(root, "carrier"), ReadString(root, "productType"), ReadDate(root, "startDate"), ReadDate(root, "endDate"), ReadDecimal(root, "premium"), jsonText, null);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Office OpenAI PDF extraction failed");
            await RecordAsync(AiTaskType.ExtractPolicyPdf, model, prompt, null, 0, 0, false, ex.Message[..Math.Min(ex.Message.Length, 500)], ct);
            return new(false, null, null, null, null, null, null, null, "Δεν ήταν δυνατή η εξαγωγή από το PDF. Ελέγξτε το office OpenAI key και το αρχείο.");
        }
    }

    public async Task<IReadOnlyList<(Guid CustomerId, string Display, double Match)>> SemanticSearchAsync(string query, int take = 10, CancellationToken ct = default)
    {
        var tenant = _current.TenantId ?? throw Kalypsis.Application.Common.AppException.Forbidden();
        var term = query.Trim(); if (term.Length == 0) return Array.Empty<(Guid, string, double)>();
        var rows = await _db.Customers.AsNoTracking().Where(c => c.TenantId == tenant && c.DeletedAt == null &&
            (((c.FirstName ?? "") + " " + (c.LastName ?? "")).Contains(term) || (c.CompanyName ?? "").Contains(term) ||
             (c.Email ?? "").Contains(term) || (c.Phone ?? "").Contains(term) || (c.VatNumber ?? "").Contains(term)))
            .Take(Math.Clamp(take, 1, 50)).Select(c => new { c.Id, c.FirstName, c.LastName, c.CompanyName }).ToListAsync(ct);
        return rows.Select(c => new ValueTuple<Guid, string, double>(c.Id, string.IsNullOrWhiteSpace(c.CompanyName) ? $"{c.FirstName} {c.LastName}".Trim() : c.CompanyName!, 1d)).ToList();
    }

    public async Task<bool> IsConfiguredAsync(CancellationToken ct = default) => !string.IsNullOrWhiteSpace(await GetSettingAsync("OpenAiApiKey", ct));

    private async Task<(bool Success, string? Text, string? Error)> CompleteAsync(AiTaskType task, string prompt, CancellationToken ct)
    {
        var key = await GetSettingAsync("OpenAiApiKey", ct);
        if (string.IsNullOrWhiteSpace(key)) { await RecordAsync(task, "not-configured", "", null, 0, 0, false, "Δεν έχει ρυθμιστεί office OpenAI key.", ct); return (false, null, "Δεν έχει ρυθμιστεί το OpenAI API key του γραφείου."); }
        var model = await GetSettingAsync("OpenAiModel", ct) ?? "gpt-4o-mini";
        try
        {
            using var client = _http.CreateClient("openai"); client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
            using var response = await client.PostAsJsonAsync("chat/completions", new { model, temperature = 0.2, messages = new[] { new { role = "system", content = "Είσαι βοηθός ασφαλιστικού γραφείου. Μην παρέχεις δεσμευτική ασφαλιστική ή νομική συμβουλή." }, new { role = "user", content = prompt } } }, ct);
            var raw = await response.Content.ReadAsStringAsync(ct); if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"OpenAI HTTP {(int)response.StatusCode}: {raw[..Math.Min(raw.Length, 300)]}");
            using var json = JsonDocument.Parse(raw); var text = json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            var usage = json.RootElement.TryGetProperty("usage", out var u) ? u : default;
            var input = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("prompt_tokens", out var i) ? i.GetInt32() : 0;
            var output = usage.ValueKind != JsonValueKind.Undefined && usage.TryGetProperty("completion_tokens", out var o) ? o.GetInt32() : 0;
            await RecordAsync(task, model, prompt[..Math.Min(prompt.Length, 500)], text, input, output, true, null, ct); return (true, text, null);
        }
        catch (Exception ex) { _log.LogWarning(ex, "Office OpenAI request failed"); await RecordAsync(task, model, prompt[..Math.Min(prompt.Length, 500)], null, 0, 0, false, ex.Message[..Math.Min(ex.Message.Length, 500)], ct); return (false, null, "Η κλήση στο OpenAI απέτυχε. Ελέγξτε το office key και το μοντέλο."); }
    }

    private async Task<string?> GetSettingAsync(string keyName, CancellationToken ct) { var tenant = _current.TenantId; if (!tenant.HasValue) return null; return await _db.IntegrationSettings.AsNoTracking().Where(x => x.TenantId == tenant.Value && (x.Service == "Ai" || x.Service == "OpenAI") && x.KeyName == keyName).Select(x => x.Value).FirstOrDefaultAsync(ct); }
    private async Task RecordAsync(AiTaskType task, string model, string? prompt, string? response, int input, int output, bool success, string? error, CancellationToken ct) { var tenant = _current.TenantId; if (!tenant.HasValue) return; _db.AiInvocations.Add(new AiInvocation { Id = Guid.NewGuid(), TenantId = tenant.Value, UserId = _current.UserId, TaskType = task, Model = model, PromptRedacted = prompt, ResponseRedacted = response, PromptTokens = input, CompletionTokens = output, Success = success, ErrorMessage = error }); await _db.SaveChangesAsync(ct); }
    private static string ReadResponseText(JsonElement root) { if (root.TryGetProperty("output_text", out var direct)) return direct.GetString() ?? ""; if (root.TryGetProperty("output", out var output)) foreach (var item in output.EnumerateArray()) if (item.TryGetProperty("content", out var content)) foreach (var part in content.EnumerateArray()) if (part.TryGetProperty("text", out var text)) return text.GetString() ?? ""; return ""; }
    private static string? ReadString(JsonElement root, string name) => root.TryGetProperty(name, out var value) && value.ValueKind != JsonValueKind.Null ? value.GetString() : null;
    private static DateOnly? ReadDate(JsonElement root, string name) => DateOnly.TryParse(ReadString(root, name), CultureInfo.InvariantCulture, DateTimeStyles.None, out var value) ? value : null;
    private static decimal? ReadDecimal(JsonElement root, string name) => decimal.TryParse(ReadString(root, name), NumberStyles.Any, CultureInfo.InvariantCulture, out var value) ? value : root.TryGetProperty(name, out var number) && number.TryGetDecimal(out var numeric) ? numeric : null;
}
