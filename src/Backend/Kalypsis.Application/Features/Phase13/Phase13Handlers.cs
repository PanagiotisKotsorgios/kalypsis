using System.Text;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Phase13;

// ============================================================================
// Phase 13 — Mega-batch closing all remaining BluByte parity items.
// Each section: DTOs + Body + List/Save/Delete handlers.
// External integrations expose stub client interfaces — wire real SOAP/HTTP
// once credentials are configured via IntegrationSettings.
// ============================================================================

/* ============================================================================
   INTEGRATION SETTINGS (credentials per external service)
   ========================================================================= */
public record IntegrationSettingDto(Guid Id, string Service, string KeyName, string? Value, bool IsSecret, string? Notes);
public record IntegrationSettingBody(string Service, string KeyName, string? Value, bool IsSecret, string? Notes);

public record ListIntegrationSettingsQuery(string? Service) : IRequest<IReadOnlyList<IntegrationSettingDto>>;
public class ListIntegrationSettingsHandler : IRequestHandler<ListIntegrationSettingsQuery, IReadOnlyList<IntegrationSettingDto>>
{
    private readonly IAppDbContext _db;
    public ListIntegrationSettingsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<IntegrationSettingDto>> Handle(ListIntegrationSettingsQuery r, CancellationToken ct)
    {
        var q = _db.IntegrationSettings.AsQueryable();
        if (!string.IsNullOrEmpty(r.Service)) q = q.Where(x => x.Service == r.Service);
        var rows = await q.OrderBy(x => x.Service).ThenBy(x => x.KeyName).ToListAsync(ct);
        return rows.Select(s => new IntegrationSettingDto(
            s.Id, s.Service, s.KeyName,
            s.IsSecret && !string.IsNullOrEmpty(s.Value) ? "•••••••" : s.Value,
            s.IsSecret, s.Notes)).ToList();
    }
}

public record SaveIntegrationSettingCommand(IntegrationSettingBody Body) : IRequest<IntegrationSettingDto>;
public class SaveIntegrationSettingHandler : IRequestHandler<SaveIntegrationSettingCommand, IntegrationSettingDto>
{
    private readonly IAppDbContext _db;
    public SaveIntegrationSettingHandler(IAppDbContext db) => _db = db;
    public async Task<IntegrationSettingDto> Handle(SaveIntegrationSettingCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var existing = await _db.IntegrationSettings
            .FirstOrDefaultAsync(x => x.Service == b.Service && x.KeyName == b.KeyName, ct);
        if (existing is null)
        {
            existing = new IntegrationSetting { Id = Guid.NewGuid(), Service = b.Service, KeyName = b.KeyName };
            _db.IntegrationSettings.Add(existing);
        }
        // Don't overwrite secret with the redacted mask
        if (!(b.IsSecret && b.Value == "•••••••")) existing.Value = b.Value;
        existing.IsSecret = b.IsSecret;
        existing.Notes = b.Notes;
        await _db.SaveChangesAsync(ct);
        return new IntegrationSettingDto(existing.Id, existing.Service, existing.KeyName,
            existing.IsSecret ? "•••••••" : existing.Value, existing.IsSecret, existing.Notes);
    }
}

/* ============================================================================
   CUSTOM FIELDS ENGINE (Σχεδιαστής Αρχείων)
   ========================================================================= */
public record CustomFieldDefDto(Guid Id, string EntityType, string Code, string Label, string Kind,
    string? Options, string? LookupEntity, bool IsRequired, int DisplayOrder, bool IsActive, string? HelpText);
public record CustomFieldDefBody(string EntityType, string Code, string Label, string Kind,
    string? Options, string? LookupEntity, bool IsRequired, int DisplayOrder, bool IsActive, string? HelpText);

public record ListCustomFieldDefsQuery(string EntityType) : IRequest<IReadOnlyList<CustomFieldDefDto>>;
public class ListCustomFieldDefsHandler : IRequestHandler<ListCustomFieldDefsQuery, IReadOnlyList<CustomFieldDefDto>>
{
    private readonly IAppDbContext _db;
    public ListCustomFieldDefsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CustomFieldDefDto>> Handle(ListCustomFieldDefsQuery r, CancellationToken ct)
    {
        var rows = await _db.CustomFieldDefinitions
            .Where(x => x.EntityType == r.EntityType)
            .OrderBy(x => x.DisplayOrder).ThenBy(x => x.Label).ToListAsync(ct);
        return rows.Select(f => new CustomFieldDefDto(f.Id, f.EntityType, f.Code, f.Label, f.Kind,
            f.Options, f.LookupEntity, f.IsRequired, f.DisplayOrder, f.IsActive, f.HelpText)).ToList();
    }
}

public record SaveCustomFieldDefCommand(Guid? Id, CustomFieldDefBody Body) : IRequest<CustomFieldDefDto>;
public class SaveCustomFieldDefHandler : IRequestHandler<SaveCustomFieldDefCommand, CustomFieldDefDto>
{
    private readonly IAppDbContext _db;
    public SaveCustomFieldDefHandler(IAppDbContext db) => _db = db;
    public async Task<CustomFieldDefDto> Handle(SaveCustomFieldDefCommand r, CancellationToken ct)
    {
        var b = r.Body;
        CustomFieldDefinition f;
        if (r.Id.HasValue)
        {
            f = await _db.CustomFieldDefinitions.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
                ?? throw AppException.NotFound("Field");
        }
        else
        {
            if (await _db.CustomFieldDefinitions.AnyAsync(x => x.EntityType == b.EntityType && x.Code == b.Code, ct))
                throw new AppException("field_code_taken",
                    $"Υπάρχει ήδη πεδίο «{b.Code}» στο {b.EntityType}.", 409,
                    title: "Κωδικός σε χρήση",
                    why: "Οι κωδικοί custom πεδίων πρέπει να είναι μοναδικοί ανά είδος οντότητας.",
                    fix: "Επιλέξτε διαφορετικό κωδικό.",
                    fixLink: "/app/custom-fields");
            f = new CustomFieldDefinition { Id = Guid.NewGuid() };
            _db.CustomFieldDefinitions.Add(f);
        }
        f.EntityType = b.EntityType; f.Code = b.Code.Trim(); f.Label = b.Label.Trim();
        f.Kind = b.Kind; f.Options = b.Options; f.LookupEntity = b.LookupEntity;
        f.IsRequired = b.IsRequired; f.DisplayOrder = b.DisplayOrder;
        f.IsActive = b.IsActive; f.HelpText = b.HelpText;
        await _db.SaveChangesAsync(ct);
        return new CustomFieldDefDto(f.Id, f.EntityType, f.Code, f.Label, f.Kind,
            f.Options, f.LookupEntity, f.IsRequired, f.DisplayOrder, f.IsActive, f.HelpText);
    }
}

public record DeleteCustomFieldDefCommand(Guid Id) : IRequest<Unit>;
public class DeleteCustomFieldDefHandler : IRequestHandler<DeleteCustomFieldDefCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteCustomFieldDefHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteCustomFieldDefCommand r, CancellationToken ct)
    {
        var f = await _db.CustomFieldDefinitions.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Field");
        f.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record CustomFieldValueDto(Guid Id, Guid FieldId, string FieldCode, string FieldLabel, string Kind, string? Value);
public record SetCustomFieldValueBody(Guid FieldId, string EntityType, Guid EntityId, string? Value);

public record GetCustomFieldValuesQuery(string EntityType, Guid EntityId) : IRequest<IReadOnlyList<CustomFieldValueDto>>;
public class GetCustomFieldValuesHandler : IRequestHandler<GetCustomFieldValuesQuery, IReadOnlyList<CustomFieldValueDto>>
{
    private readonly IAppDbContext _db;
    public GetCustomFieldValuesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CustomFieldValueDto>> Handle(GetCustomFieldValuesQuery r, CancellationToken ct)
    {
        var defs = await _db.CustomFieldDefinitions
            .Where(d => d.EntityType == r.EntityType && d.IsActive)
            .OrderBy(d => d.DisplayOrder).ToListAsync(ct);
        var values = await _db.CustomFieldValues
            .Where(v => v.EntityType == r.EntityType && v.EntityId == r.EntityId)
            .ToListAsync(ct);
        return defs.Select(d => {
            var v = values.FirstOrDefault(x => x.FieldId == d.Id);
            return new CustomFieldValueDto(v?.Id ?? Guid.Empty, d.Id, d.Code, d.Label, d.Kind, v?.Value);
        }).ToList();
    }
}

public record SetCustomFieldValueCommand(SetCustomFieldValueBody Body) : IRequest<Unit>;
public class SetCustomFieldValueHandler : IRequestHandler<SetCustomFieldValueCommand, Unit>
{
    private readonly IAppDbContext _db;
    public SetCustomFieldValueHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(SetCustomFieldValueCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var existing = await _db.CustomFieldValues
            .FirstOrDefaultAsync(x => x.FieldId == b.FieldId && x.EntityId == b.EntityId, ct);
        if (existing is null)
        {
            _db.CustomFieldValues.Add(new CustomFieldValue
            {
                Id = Guid.NewGuid(), FieldId = b.FieldId,
                EntityType = b.EntityType, EntityId = b.EntityId, Value = b.Value
            });
        }
        else
        {
            existing.Value = b.Value;
        }
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   MOVEMENT TYPES (Είδη Κινήσεων)
   ========================================================================= */
public record MovementTypeDto(Guid Id, string Code, string Name, string Category, string Party,
    bool AutoChargeCustomer, bool AutoOffsetCarrier, Guid? GlAccountId, string ReceiptNumberPrefix,
    int ReceiptPadding, bool IsCashType, bool IsActive, int DisplayOrder);
public record MovementTypeBody(string Code, string Name, string Category, string Party,
    bool AutoChargeCustomer, bool AutoOffsetCarrier, Guid? GlAccountId, string ReceiptNumberPrefix,
    int ReceiptPadding, bool IsCashType, bool IsActive, int DisplayOrder);

public record ListMovementTypesQuery() : IRequest<IReadOnlyList<MovementTypeDto>>;
public class ListMovementTypesHandler : IRequestHandler<ListMovementTypesQuery, IReadOnlyList<MovementTypeDto>>
{
    private readonly IAppDbContext _db;
    public ListMovementTypesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<MovementTypeDto>> Handle(ListMovementTypesQuery _, CancellationToken ct)
    {
        var rows = await _db.MovementTypes.OrderBy(x => x.DisplayOrder).ThenBy(x => x.Name).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }
    internal static MovementTypeDto Map(MovementType m) => new(m.Id, m.Code, m.Name, m.Category, m.Party,
        m.AutoChargeCustomer, m.AutoOffsetCarrier, m.GlAccountId, m.ReceiptNumberPrefix,
        m.ReceiptPadding, m.IsCashType, m.IsActive, m.DisplayOrder);
}

public record SaveMovementTypeCommand(Guid? Id, MovementTypeBody Body) : IRequest<MovementTypeDto>;
public class SaveMovementTypeHandler : IRequestHandler<SaveMovementTypeCommand, MovementTypeDto>
{
    private readonly IAppDbContext _db;
    public SaveMovementTypeHandler(IAppDbContext db) => _db = db;
    public async Task<MovementTypeDto> Handle(SaveMovementTypeCommand r, CancellationToken ct)
    {
        var b = r.Body;
        MovementType m;
        if (r.Id.HasValue)
        {
            m = await _db.MovementTypes.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
                ?? throw AppException.NotFound("MovementType");
        }
        else
        {
            if (await _db.MovementTypes.AnyAsync(x => x.Code == b.Code, ct))
                throw new AppException("movement_type_code_taken",
                    $"Υπάρχει ήδη είδος κίνησης «{b.Code}».", 409,
                    title: "Κωδικός σε χρήση",
                    why: "Τα είδη κινήσεων πρέπει να έχουν μοναδικό κωδικό.",
                    fix: "Επιλέξτε διαφορετικό κωδικό.",
                    fixLink: "/app/movement-types");
            m = new MovementType { Id = Guid.NewGuid() };
            _db.MovementTypes.Add(m);
        }
        m.Code = b.Code.Trim(); m.Name = b.Name.Trim(); m.Category = b.Category; m.Party = b.Party;
        m.AutoChargeCustomer = b.AutoChargeCustomer; m.AutoOffsetCarrier = b.AutoOffsetCarrier;
        m.GlAccountId = b.GlAccountId;
        m.ReceiptNumberPrefix = b.ReceiptNumberPrefix; m.ReceiptPadding = b.ReceiptPadding;
        m.IsCashType = b.IsCashType; m.IsActive = b.IsActive; m.DisplayOrder = b.DisplayOrder;
        await _db.SaveChangesAsync(ct);
        return ListMovementTypesHandler.Map(m);
    }
}

public record DeleteMovementTypeCommand(Guid Id) : IRequest<Unit>;
public class DeleteMovementTypeHandler : IRequestHandler<DeleteMovementTypeCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteMovementTypeHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteMovementTypeCommand r, CancellationToken ct)
    {
        var m = await _db.MovementTypes.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("MovementType");
        m.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   BONUS-MALUS ENGINE
   ========================================================================= */
public record BonusMalusRuleDto(Guid Id, string Name, Guid? InsuranceCompanyId, string PolicyTypeFilter,
    int ClaimsCountFrom, int ClaimsCountTo, decimal AdjustmentPercent, string AdjustmentDirection,
    DateOnly EffectiveFrom, DateOnly? EffectiveTo, bool IsActive);
public record BonusMalusRuleBody(string Name, Guid? InsuranceCompanyId, string PolicyTypeFilter,
    int ClaimsCountFrom, int ClaimsCountTo, decimal AdjustmentPercent, string AdjustmentDirection,
    DateOnly EffectiveFrom, DateOnly? EffectiveTo, bool IsActive);

public record ListBonusMalusRulesQuery() : IRequest<IReadOnlyList<BonusMalusRuleDto>>;
public class ListBonusMalusRulesHandler : IRequestHandler<ListBonusMalusRulesQuery, IReadOnlyList<BonusMalusRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListBonusMalusRulesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<BonusMalusRuleDto>> Handle(ListBonusMalusRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.BonusMalusRules.OrderBy(x => x.ClaimsCountFrom).ToListAsync(ct);
        return rows.Select(r => new BonusMalusRuleDto(r.Id, r.Name, r.InsuranceCompanyId, r.PolicyTypeFilter,
            r.ClaimsCountFrom, r.ClaimsCountTo, r.AdjustmentPercent, r.AdjustmentDirection,
            r.EffectiveFrom, r.EffectiveTo, r.IsActive)).ToList();
    }
}

public record SaveBonusMalusRuleCommand(Guid? Id, BonusMalusRuleBody Body) : IRequest<BonusMalusRuleDto>;
public class SaveBonusMalusRuleHandler : IRequestHandler<SaveBonusMalusRuleCommand, BonusMalusRuleDto>
{
    private readonly IAppDbContext _db;
    public SaveBonusMalusRuleHandler(IAppDbContext db) => _db = db;
    public async Task<BonusMalusRuleDto> Handle(SaveBonusMalusRuleCommand r, CancellationToken ct)
    {
        var b = r.Body;
        BonusMalusRule rule;
        if (r.Id.HasValue)
        {
            rule = await _db.BonusMalusRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        }
        else
        {
            rule = new BonusMalusRule { Id = Guid.NewGuid() };
            _db.BonusMalusRules.Add(rule);
        }
        rule.Name = b.Name.Trim(); rule.InsuranceCompanyId = b.InsuranceCompanyId;
        rule.PolicyTypeFilter = b.PolicyTypeFilter;
        rule.ClaimsCountFrom = b.ClaimsCountFrom; rule.ClaimsCountTo = b.ClaimsCountTo;
        rule.AdjustmentPercent = b.AdjustmentPercent; rule.AdjustmentDirection = b.AdjustmentDirection;
        rule.EffectiveFrom = b.EffectiveFrom; rule.EffectiveTo = b.EffectiveTo;
        rule.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return new BonusMalusRuleDto(rule.Id, rule.Name, rule.InsuranceCompanyId, rule.PolicyTypeFilter,
            rule.ClaimsCountFrom, rule.ClaimsCountTo, rule.AdjustmentPercent, rule.AdjustmentDirection,
            rule.EffectiveFrom, rule.EffectiveTo, rule.IsActive);
    }
}

public record DeleteBonusMalusRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteBonusMalusRuleHandler : IRequestHandler<DeleteBonusMalusRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteBonusMalusRuleHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteBonusMalusRuleCommand r, CancellationToken ct)
    {
        var rule = await _db.BonusMalusRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public record EvaluateBonusMalusCommand(Guid PolicyId) : IRequest<EvaluateBonusMalusResult>;
public record EvaluateBonusMalusResult(int ClaimCount, decimal AdjustmentPercent, string Direction,
    decimal NewPremium, decimal NewCommissionPercent, string? AppliedRuleName);

public class EvaluateBonusMalusHandler : IRequestHandler<EvaluateBonusMalusCommand, EvaluateBonusMalusResult>
{
    private readonly IAppDbContext _db;
    public EvaluateBonusMalusHandler(IAppDbContext db) => _db = db;
    public async Task<EvaluateBonusMalusResult> Handle(EvaluateBonusMalusCommand r, CancellationToken ct)
    {
        var policy = await _db.Policies.FirstOrDefaultAsync(p => p.Id == r.PolicyId, ct)
            ?? throw AppException.NotFound("Policy");

        var claimCount = await _db.Claims.CountAsync(c => c.PolicyId == r.PolicyId
            && c.AffectsBonusMalus && c.IncidentDate >= policy.StartDate, ct);

        var rules = await _db.BonusMalusRules
            .Where(x => x.IsActive
                && (x.InsuranceCompanyId == null || x.InsuranceCompanyId == policy.InsuranceCompanyId)
                && x.EffectiveFrom <= DateOnly.FromDateTime(DateTime.UtcNow)
                && (x.EffectiveTo == null || x.EffectiveTo >= DateOnly.FromDateTime(DateTime.UtcNow))
                && x.ClaimsCountFrom <= claimCount && x.ClaimsCountTo >= claimCount)
            .OrderByDescending(x => x.ClaimsCountFrom)
            .ToListAsync(ct);

        var match = rules.FirstOrDefault(x => x.PolicyTypeFilter == "*" || x.PolicyTypeFilter == policy.PolicyType.ToString());

        var adjPct = match?.AdjustmentPercent ?? 0m;
        var newPremium = policy.Premium * (1m + adjPct / 100m);

        return new EvaluateBonusMalusResult(claimCount, adjPct,
            match?.AdjustmentDirection ?? "None",
            Math.Round(newPremium, 2),
            policy.SpecialCommissionPercent ?? 0m,
            match?.Name);
    }
}

/* ============================================================================
   RENEWAL RULES (declarative engine)
   ========================================================================= */
public record RenewalRuleDto(Guid Id, string Name, string PolicyTypeFilter, Guid? InsuranceCompanyId,
    string ConditionJson, string ActionJson, int DisplayOrder, bool IsActive);
public record RenewalRuleBody(string Name, string PolicyTypeFilter, Guid? InsuranceCompanyId,
    string ConditionJson, string ActionJson, int DisplayOrder, bool IsActive);

public record ListRenewalRulesQuery() : IRequest<IReadOnlyList<RenewalRuleDto>>;
public class ListRenewalRulesHandler : IRequestHandler<ListRenewalRulesQuery, IReadOnlyList<RenewalRuleDto>>
{
    private readonly IAppDbContext _db;
    public ListRenewalRulesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<RenewalRuleDto>> Handle(ListRenewalRulesQuery _, CancellationToken ct)
    {
        var rows = await _db.RenewalRules.OrderBy(x => x.DisplayOrder).ToListAsync(ct);
        return rows.Select(r => new RenewalRuleDto(r.Id, r.Name, r.PolicyTypeFilter, r.InsuranceCompanyId,
            r.ConditionJson, r.ActionJson, r.DisplayOrder, r.IsActive)).ToList();
    }
}

public record SaveRenewalRuleCommand(Guid? Id, RenewalRuleBody Body) : IRequest<RenewalRuleDto>;
public class SaveRenewalRuleHandler : IRequestHandler<SaveRenewalRuleCommand, RenewalRuleDto>
{
    private readonly IAppDbContext _db;
    public SaveRenewalRuleHandler(IAppDbContext db) => _db = db;
    public async Task<RenewalRuleDto> Handle(SaveRenewalRuleCommand r, CancellationToken ct)
    {
        var b = r.Body;
        RenewalRule rule;
        if (r.Id.HasValue)
        {
            rule = await _db.RenewalRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        }
        else
        {
            rule = new RenewalRule { Id = Guid.NewGuid() };
            _db.RenewalRules.Add(rule);
        }
        rule.Name = b.Name.Trim(); rule.PolicyTypeFilter = b.PolicyTypeFilter;
        rule.InsuranceCompanyId = b.InsuranceCompanyId;
        rule.ConditionJson = b.ConditionJson; rule.ActionJson = b.ActionJson;
        rule.DisplayOrder = b.DisplayOrder; rule.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return new RenewalRuleDto(rule.Id, rule.Name, rule.PolicyTypeFilter, rule.InsuranceCompanyId,
            rule.ConditionJson, rule.ActionJson, rule.DisplayOrder, rule.IsActive);
    }
}

public record DeleteRenewalRuleCommand(Guid Id) : IRequest<Unit>;
public class DeleteRenewalRuleHandler : IRequestHandler<DeleteRenewalRuleCommand, Unit>
{
    private readonly IAppDbContext _db;
    public DeleteRenewalRuleHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(DeleteRenewalRuleCommand r, CancellationToken ct)
    {
        var rule = await _db.RenewalRules.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Rule");
        rule.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   REGISTER TEMPLATES (Μητρώα — column designer)
   ========================================================================= */
public record RegisterTemplateDto(Guid Id, string Code, string Name, string PolicyTypeFilter,
    string ColumnsJson, bool ShowSubtotals, string? GroupByField, bool IsDefault, bool IsActive);
public record RegisterTemplateBody(string Code, string Name, string PolicyTypeFilter,
    string ColumnsJson, bool ShowSubtotals, string? GroupByField, bool IsDefault, bool IsActive);

public record ListRegisterTemplatesQuery() : IRequest<IReadOnlyList<RegisterTemplateDto>>;
public class ListRegisterTemplatesHandler : IRequestHandler<ListRegisterTemplatesQuery, IReadOnlyList<RegisterTemplateDto>>
{
    private readonly IAppDbContext _db;
    public ListRegisterTemplatesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<RegisterTemplateDto>> Handle(ListRegisterTemplatesQuery _, CancellationToken ct)
    {
        var rows = await _db.RegisterTemplates.OrderBy(x => x.Name).ToListAsync(ct);
        return rows.Select(r => new RegisterTemplateDto(r.Id, r.Code, r.Name, r.PolicyTypeFilter,
            r.ColumnsJson, r.ShowSubtotals, r.GroupByField, r.IsDefault, r.IsActive)).ToList();
    }
}

public record SaveRegisterTemplateCommand(Guid? Id, RegisterTemplateBody Body) : IRequest<RegisterTemplateDto>;
public class SaveRegisterTemplateHandler : IRequestHandler<SaveRegisterTemplateCommand, RegisterTemplateDto>
{
    private readonly IAppDbContext _db;
    public SaveRegisterTemplateHandler(IAppDbContext db) => _db = db;
    public async Task<RegisterTemplateDto> Handle(SaveRegisterTemplateCommand r, CancellationToken ct)
    {
        var b = r.Body;
        RegisterTemplate t;
        if (r.Id.HasValue)
        {
            t = await _db.RegisterTemplates.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Template");
        }
        else
        {
            if (await _db.RegisterTemplates.AnyAsync(x => x.Code == b.Code, ct))
                throw new AppException("register_template_code_taken",
                    $"Υπάρχει ήδη μητρώο «{b.Code}».", 409,
                    title: "Κωδικός σε χρήση", why: "Πρέπει να είναι μοναδικός.",
                    fix: "Επιλέξτε άλλον.", fixLink: "/app/register-templates");
            t = new RegisterTemplate { Id = Guid.NewGuid() };
            _db.RegisterTemplates.Add(t);
        }
        t.Code = b.Code.Trim(); t.Name = b.Name.Trim();
        t.PolicyTypeFilter = b.PolicyTypeFilter; t.ColumnsJson = b.ColumnsJson;
        t.ShowSubtotals = b.ShowSubtotals; t.GroupByField = b.GroupByField;
        t.IsDefault = b.IsDefault; t.IsActive = b.IsActive;
        await _db.SaveChangesAsync(ct);
        return new RegisterTemplateDto(t.Id, t.Code, t.Name, t.PolicyTypeFilter,
            t.ColumnsJson, t.ShowSubtotals, t.GroupByField, t.IsDefault, t.IsActive);
    }
}

/* ============================================================================
   ADVANCE PAYMENTS (Προκαταβολές)
   ========================================================================= */
public record AdvancePaymentDto(Guid Id, string Number, DateOnly ReceivedOn, string PartyType,
    Guid? CustomerId, string? CustomerName, Guid? ProducerId, string? ProducerName,
    Guid? InsuranceCompanyId, string? InsuranceCompanyName,
    decimal Amount, decimal AllocatedAmount, string Currency, string PaymentMethod,
    string? Reference, string Status, string? Notes);
public record AdvancePaymentBody(string Number, DateOnly ReceivedOn, string PartyType,
    Guid? CustomerId, Guid? ProducerId, Guid? InsuranceCompanyId,
    decimal Amount, string Currency, string PaymentMethod, string? Reference, string? Notes);

public record ListAdvancePaymentsQuery(string? Status, string? PartyType) : IRequest<IReadOnlyList<AdvancePaymentDto>>;
public class ListAdvancePaymentsHandler : IRequestHandler<ListAdvancePaymentsQuery, IReadOnlyList<AdvancePaymentDto>>
{
    private readonly IAppDbContext _db;
    public ListAdvancePaymentsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<AdvancePaymentDto>> Handle(ListAdvancePaymentsQuery r, CancellationToken ct)
    {
        var q = _db.AdvancePayments.AsQueryable();
        if (!string.IsNullOrEmpty(r.Status)) q = q.Where(x => x.Status == r.Status);
        if (!string.IsNullOrEmpty(r.PartyType)) q = q.Where(x => x.PartyType == r.PartyType);
        var rows = await q.OrderByDescending(x => x.ReceivedOn).Take(500).ToListAsync(ct);

        var custIds = rows.Where(r => r.CustomerId.HasValue).Select(r => r.CustomerId!.Value).ToList();
        var prodIds = rows.Where(r => r.ProducerId.HasValue).Select(r => r.ProducerId!.Value).ToList();
        var compIds = rows.Where(r => r.InsuranceCompanyId.HasValue).Select(r => r.InsuranceCompanyId!.Value).ToList();
        var customers = await _db.Customers.Where(c => custIds.Contains(c.Id))
            .Select(c => new { c.Id, Name = c.CompanyName ?? (c.FirstName + " " + c.LastName) }).ToListAsync(ct);
        var producers = await _db.Producers.Where(p => prodIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name }).ToListAsync(ct);
        var companies = await _db.InsuranceCompanies.IgnoreQueryFilters().Where(c => compIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Name }).ToListAsync(ct);

        return rows.Select(a => new AdvancePaymentDto(a.Id, a.Number, a.ReceivedOn, a.PartyType,
            a.CustomerId, customers.FirstOrDefault(c => c.Id == a.CustomerId)?.Name?.Trim(),
            a.ProducerId, producers.FirstOrDefault(p => p.Id == a.ProducerId)?.Name,
            a.InsuranceCompanyId, companies.FirstOrDefault(c => c.Id == a.InsuranceCompanyId)?.Name,
            a.Amount, a.AllocatedAmount, a.Currency, a.PaymentMethod,
            a.Reference, a.Status, a.Notes)).ToList();
    }
}

public record CreateAdvancePaymentCommand(AdvancePaymentBody Body) : IRequest<AdvancePaymentDto>;
public class CreateAdvancePaymentHandler : IRequestHandler<CreateAdvancePaymentCommand, AdvancePaymentDto>
{
    private readonly IAppDbContext _db;
    public CreateAdvancePaymentHandler(IAppDbContext db) => _db = db;
    public async Task<AdvancePaymentDto> Handle(CreateAdvancePaymentCommand r, CancellationToken ct)
    {
        var b = r.Body;
        if (await _db.AdvancePayments.AnyAsync(x => x.Number == b.Number, ct))
            throw new AppException("advance_number_taken",
                $"Υπάρχει ήδη προκαταβολή «{b.Number}».", 409,
                title: "Αριθμός σε χρήση", why: "Πρέπει να είναι μοναδικός.",
                fix: "Επιλέξτε άλλον αριθμό.", fixLink: "/app/advance-payments");
        var a = new AdvancePayment
        {
            Id = Guid.NewGuid(), Number = b.Number.Trim(), ReceivedOn = b.ReceivedOn,
            PartyType = b.PartyType, CustomerId = b.CustomerId, ProducerId = b.ProducerId,
            InsuranceCompanyId = b.InsuranceCompanyId,
            Amount = b.Amount, AllocatedAmount = 0,
            Currency = b.Currency.ToUpperInvariant(),
            PaymentMethod = b.PaymentMethod, Reference = b.Reference,
            Status = "Open", Notes = b.Notes
        };
        _db.AdvancePayments.Add(a);
        await _db.SaveChangesAsync(ct);
        return new AdvancePaymentDto(a.Id, a.Number, a.ReceivedOn, a.PartyType,
            a.CustomerId, null, a.ProducerId, null, a.InsuranceCompanyId, null,
            a.Amount, a.AllocatedAmount, a.Currency, a.PaymentMethod, a.Reference, a.Status, a.Notes);
    }
}

public record AllocateAdvanceCommand(Guid AdvanceId, Guid PolicyId, decimal Amount) : IRequest<AdvancePaymentDto>;
public class AllocateAdvanceHandler : IRequestHandler<AllocateAdvanceCommand, AdvancePaymentDto>
{
    private readonly IAppDbContext _db;
    public AllocateAdvanceHandler(IAppDbContext db) => _db = db;
    public async Task<AdvancePaymentDto> Handle(AllocateAdvanceCommand r, CancellationToken ct)
    {
        var a = await _db.AdvancePayments.FirstOrDefaultAsync(x => x.Id == r.AdvanceId, ct)
            ?? throw AppException.NotFound("AdvancePayment");
        var available = a.Amount - a.AllocatedAmount;
        if (r.Amount > available)
            throw new AppException("advance_over_allocation",
                $"Δεν επαρκεί το υπόλοιπο της προκαταβολής (διαθέσιμο: {available:F2} {a.Currency}).", 400,
                title: "Ανεπαρκές υπόλοιπο",
                why: "Το ποσό αντιστοίχισης ξεπερνά το διαθέσιμο υπόλοιπο της προκαταβολής.",
                fix: "Μειώστε το ποσό αντιστοίχισης ή προσθέστε νέα προκαταβολή.");
        _db.ReconciliationLinks.Add(new ReconciliationLink
        {
            Id = Guid.NewGuid(),
            SourceType = "Advance", SourceId = a.Id,
            TargetType = "Policy", TargetId = r.PolicyId,
            Amount = r.Amount, Currency = a.Currency,
            LinkedOn = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        a.AllocatedAmount += r.Amount;
        a.Status = a.AllocatedAmount >= a.Amount ? "FullyAllocated" :
                   a.AllocatedAmount > 0 ? "PartiallyAllocated" : "Open";
        await _db.SaveChangesAsync(ct);
        return new AdvancePaymentDto(a.Id, a.Number, a.ReceivedOn, a.PartyType,
            a.CustomerId, null, a.ProducerId, null, a.InsuranceCompanyId, null,
            a.Amount, a.AllocatedAmount, a.Currency, a.PaymentMethod, a.Reference, a.Status, a.Notes);
    }
}

/* ============================================================================
   RECONCILIATION (Συσχέτιση Κινήσεων / Αναντιστοίχιστα)
   ========================================================================= */
public record UnmatchedRow(string Type, Guid Id, string Reference, DateOnly Date, decimal Amount,
    string Currency, string PartyName);
public record UnmatchedDto(IReadOnlyList<UnmatchedRow> Receipts, IReadOnlyList<UnmatchedRow> Payments, IReadOnlyList<UnmatchedRow> Advances);

public record GetUnmatchedQuery() : IRequest<UnmatchedDto>;
public class GetUnmatchedHandler : IRequestHandler<GetUnmatchedQuery, UnmatchedDto>
{
    private readonly IAppDbContext _db;
    public GetUnmatchedHandler(IAppDbContext db) => _db = db;
    public async Task<UnmatchedDto> Handle(GetUnmatchedQuery _, CancellationToken ct)
    {
        var linkedReceiptIds = await _db.ReconciliationLinks
            .Where(l => l.SourceType == "Receipt").Select(l => l.SourceId).Distinct().ToListAsync(ct);
        var linkedPaymentIds = await _db.ReconciliationLinks
            .Where(l => l.SourceType == "Payment").Select(l => l.SourceId).Distinct().ToListAsync(ct);

        var unmatchedReceipts = await _db.Receipts
            .Include(x => x.Customer)
            .Where(r => !linkedReceiptIds.Contains(r.Id))
            .OrderByDescending(r => r.ReceivedOn).Take(200).ToListAsync(ct);
        var unmatchedPayments = await _db.Payments
            .Where(p => !linkedPaymentIds.Contains(p.Id))
            .OrderByDescending(p => p.PaidOn).Take(200).ToListAsync(ct);
        var openAdvances = await _db.AdvancePayments
            .Where(a => a.Status != "FullyAllocated" && a.Status != "Refunded")
            .OrderByDescending(a => a.ReceivedOn).Take(200).ToListAsync(ct);

        return new UnmatchedDto(
            unmatchedReceipts.Select(r => new UnmatchedRow("Receipt", r.Id, r.Number, r.ReceivedOn, r.Amount, r.Currency,
                (r.Customer.CompanyName ?? $"{r.Customer.FirstName} {r.Customer.LastName}").Trim())).ToList(),
            unmatchedPayments.Select(p => new UnmatchedRow("Payment", p.Id, p.Number, p.PaidOn, p.Amount, p.Currency, "—")).ToList(),
            openAdvances.Select(a => new UnmatchedRow("Advance", a.Id, a.Number, a.ReceivedOn,
                a.Amount - a.AllocatedAmount, a.Currency, a.PartyType)).ToList());
    }
}

public record LinkReconciliationBody(string SourceType, Guid SourceId, string TargetType, Guid TargetId, decimal Amount, string Currency);
public record LinkReconciliationCommand(LinkReconciliationBody Body) : IRequest<Unit>;
public class LinkReconciliationHandler : IRequestHandler<LinkReconciliationCommand, Unit>
{
    private readonly IAppDbContext _db;
    public LinkReconciliationHandler(IAppDbContext db) => _db = db;
    public async Task<Unit> Handle(LinkReconciliationCommand r, CancellationToken ct)
    {
        _db.ReconciliationLinks.Add(new ReconciliationLink
        {
            Id = Guid.NewGuid(),
            SourceType = r.Body.SourceType, SourceId = r.Body.SourceId,
            TargetType = r.Body.TargetType, TargetId = r.Body.TargetId,
            Amount = r.Body.Amount, Currency = r.Body.Currency,
            LinkedOn = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        await _db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

/* ============================================================================
   TACHYPAYMENTS (Ταχυπληρωμές — ΕΛ.ΤΑ. postal payment slips)
   ========================================================================= */
public record TachyBatchDto(Guid Id, string BatchNumber, DateTime CreatedAt, DateOnly DueDate,
    int PolicyCount, decimal TotalAmount, string Currency, string Status, string? ExportFilePath);

public record CreateTachyBatchBody(DateOnly DueDate, List<Guid> PolicyIds, decimal SurchargePerSlip);

public record CreateTachyBatchCommand(CreateTachyBatchBody Body) : IRequest<TachyBatchDto>;
public class CreateTachyBatchHandler : IRequestHandler<CreateTachyBatchCommand, TachyBatchDto>
{
    private readonly IAppDbContext _db;
    public CreateTachyBatchHandler(IAppDbContext db) => _db = db;
    public async Task<TachyBatchDto> Handle(CreateTachyBatchCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var policies = await _db.Policies.Where(p => b.PolicyIds.Contains(p.Id)).ToListAsync(ct);
        if (policies.Count == 0)
            throw new AppException("tachy_no_policies",
                "Δεν επιλέξατε συμβόλαια.", 400,
                title: "Άδεια παρτίδα", why: "Πρέπει να επιλέξετε τουλάχιστον ένα ανεξόφλητο συμβόλαιο.",
                fix: "Επιστρέψτε και επιλέξτε συμβόλαια από τη λίστα ανεξόφλητων.",
                fixLink: "/app/tachypayments");

        var seq = await _db.TachyPaymentBatches.CountAsync(ct) + 1;
        var batch = new TachyPaymentBatch
        {
            Id = Guid.NewGuid(),
            BatchNumber = $"TPB-{DateTime.UtcNow:yyyyMM}-{seq:D4}",
            CreatedAt = DateTime.UtcNow, DueDate = b.DueDate,
            PolicyCount = policies.Count, TotalAmount = policies.Sum(p => p.Premium + b.SurchargePerSlip),
            Currency = policies.First().Currency, Status = "Created"
        };
        _db.TachyPaymentBatches.Add(batch);
        foreach (var p in policies)
        {
            _db.TachyPaymentLines.Add(new TachyPaymentLine
            {
                Id = Guid.NewGuid(), BatchId = batch.Id, PolicyId = p.Id,
                PaymentCode = $"TP{batch.BatchNumber[3..]}-{p.PolicyNumber}",
                Amount = p.Premium, Surcharge = b.SurchargePerSlip,
                Status = "Pending"
            });
        }
        await _db.SaveChangesAsync(ct);
        return new TachyBatchDto(batch.Id, batch.BatchNumber, batch.CreatedAt, batch.DueDate,
            batch.PolicyCount, batch.TotalAmount, batch.Currency, batch.Status, batch.ExportFilePath);
    }
}

public record ListTachyBatchesQuery() : IRequest<IReadOnlyList<TachyBatchDto>>;
public class ListTachyBatchesHandler : IRequestHandler<ListTachyBatchesQuery, IReadOnlyList<TachyBatchDto>>
{
    private readonly IAppDbContext _db;
    public ListTachyBatchesHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<TachyBatchDto>> Handle(ListTachyBatchesQuery _, CancellationToken ct)
    {
        var rows = await _db.TachyPaymentBatches.OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync(ct);
        return rows.Select(b => new TachyBatchDto(b.Id, b.BatchNumber, b.CreatedAt, b.DueDate,
            b.PolicyCount, b.TotalAmount, b.Currency, b.Status, b.ExportFilePath)).ToList();
    }
}

public record ExportTachyBatchCommand(Guid Id) : IRequest<byte[]>;
public class ExportTachyBatchHandler : IRequestHandler<ExportTachyBatchCommand, byte[]>
{
    private readonly IAppDbContext _db;
    public ExportTachyBatchHandler(IAppDbContext db) => _db = db;
    public async Task<byte[]> Handle(ExportTachyBatchCommand r, CancellationToken ct)
    {
        var batch = await _db.TachyPaymentBatches.FirstOrDefaultAsync(x => x.Id == r.Id, ct)
            ?? throw AppException.NotFound("Batch");
        var lines = await _db.TachyPaymentLines.Include(x => x.Policy)
            .Where(l => l.BatchId == r.Id).ToListAsync(ct);

        // ΕΛ.ΤΑ. format — fixed-width or CSV depending on agreement; CSV is the safe default.
        var sb = new StringBuilder();
        sb.AppendLine("PaymentCode,PolicyNumber,Amount,Surcharge,DueDate");
        foreach (var l in lines)
            sb.AppendLine($"{l.PaymentCode},{l.Policy?.PolicyNumber},{l.Amount:F2},{l.Surcharge:F2},{batch.DueDate:yyyy-MM-dd}");

        batch.Status = "Exported";
        await _db.SaveChangesAsync(ct);
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}

/* ============================================================================
   AAΔE / ΓΕΜΗ / ΥΣΑΕ / ΔΙΑΣ — clients (interfaces + stub implementations)
   ========================================================================= */
public interface IAadeClient { Task<AadeLookupResponse> LookupByAfmAsync(string afm, CancellationToken ct); }
public record AadeLookupResponse(bool Found, string? CompanyName, string? Doy, string? LegalForm,
    string? Address, string? PostalCode, string? City, string? ErrorCode);

public interface IGemiClient { Task<GemiLookupResponse> LookupByAfmAsync(string afm, CancellationToken ct); }
public record GemiLookupResponse(bool Found, string? GemiNumber, string? CompanyName, string? Activity, string? Status);

public interface IUsaeClient { Task<UsaeSubmitResponse> SubmitClaimAsync(Guid claimId, string payloadJson, CancellationToken ct); }
public record UsaeSubmitResponse(bool Accepted, string? AcknowledgementCode, string? ErrorMessage);

public interface IDiasClient { Task<DiasResponse> SubmitDebitAsync(string payloadJson, CancellationToken ct); }
public record DiasResponse(bool Accepted, string? TransactionId, string? ErrorMessage);

/// <summary>
/// Stub clients — return "credentials missing" responses until IntegrationSettings populated.
/// Replace bodies with real SOAP/HTTP calls when keys are wired in.
/// </summary>
public class StubAadeClient : IAadeClient
{
    private readonly IAppDbContext _db;
    public StubAadeClient(IAppDbContext db) => _db = db;
    public async Task<AadeLookupResponse> LookupByAfmAsync(string afm, CancellationToken ct)
    {
        var configured = await _db.IntegrationSettings.AnyAsync(x => x.Service == "Aade", ct);
        if (!configured) return new AadeLookupResponse(false, null, null, null, null, null, null, "credentials_missing");
        // TODO: wire real ΑΑΔΕ rgWsBasStoixN SOAP service
        return new AadeLookupResponse(false, null, null, null, null, null, null, "not_implemented_yet");
    }
}

public class StubGemiClient : IGemiClient
{
    private readonly IAppDbContext _db;
    public StubGemiClient(IAppDbContext db) => _db = db;
    public async Task<GemiLookupResponse> LookupByAfmAsync(string afm, CancellationToken ct)
    {
        var configured = await _db.IntegrationSettings.AnyAsync(x => x.Service == "Gemi", ct);
        return new GemiLookupResponse(false, null, null, null, configured ? "not_implemented_yet" : "credentials_missing");
    }
}

public class StubUsaeClient : IUsaeClient
{
    private readonly IAppDbContext _db;
    public StubUsaeClient(IAppDbContext db) => _db = db;
    public async Task<UsaeSubmitResponse> SubmitClaimAsync(Guid claimId, string payloadJson, CancellationToken ct)
    {
        var configured = await _db.IntegrationSettings.AnyAsync(x => x.Service == "Usae", ct);
        return new UsaeSubmitResponse(false, null, configured ? "not_implemented_yet" : "credentials_missing");
    }
}

public class StubDiasClient : IDiasClient
{
    private readonly IAppDbContext _db;
    public StubDiasClient(IAppDbContext db) => _db = db;
    public async Task<DiasResponse> SubmitDebitAsync(string payloadJson, CancellationToken ct)
    {
        var configured = await _db.IntegrationSettings.AnyAsync(x => x.Service == "Dias", ct);
        return new DiasResponse(false, null, configured ? "not_implemented_yet" : "credentials_missing");
    }
}

/* ============================================================================
   CONTACT EXPORT (vCard / Outlook)
   ========================================================================= */
public record ExportContactCommand(string EntityType, Guid EntityId, string Format) : IRequest<byte[]>;
public class ExportContactHandler : IRequestHandler<ExportContactCommand, byte[]>
{
    private readonly IAppDbContext _db;
    public ExportContactHandler(IAppDbContext db) => _db = db;
    public async Task<byte[]> Handle(ExportContactCommand r, CancellationToken ct)
    {
        if (r.EntityType != "Customer")
            throw new AppException("contact_export_only_customer",
                "Η εξαγωγή υποστηρίζεται προς το παρόν μόνο για πελάτες.", 400,
                title: "Μη υποστηριζόμενος τύπος",
                why: "Άλλοι τύποι (παραγωγοί, εταιρίες) θα προστεθούν σε επόμενη έκδοση.",
                fix: "Επιλέξτε πελάτη και ξαναπροσπαθήστε.");

        var c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == r.EntityId, ct)
            ?? throw AppException.NotFound("Customer");

        _db.ContactExportLogs.Add(new ContactExportLog
        {
            Id = Guid.NewGuid(), EntityType = r.EntityType, EntityId = r.EntityId,
            Format = r.Format, ExportedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        var name = c.CompanyName ?? $"{c.FirstName} {c.LastName}".Trim();
        return r.Format switch
        {
            "vCard" => Encoding.UTF8.GetBytes(BuildVCard(c, name)),
            "Csv" => Encoding.UTF8.GetBytes(BuildCsv(c, name)),
            _ => Encoding.UTF8.GetBytes(BuildVCard(c, name))
        };
    }

    private static string BuildVCard(Customer c, string name)
    {
        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCARD");
        sb.AppendLine("VERSION:3.0");
        sb.AppendLine($"FN:{name}");
        if (!string.IsNullOrEmpty(c.LastName)) sb.AppendLine($"N:{c.LastName};{c.FirstName};;;");
        if (!string.IsNullOrEmpty(c.CompanyName)) sb.AppendLine($"ORG:{c.CompanyName}");
        if (!string.IsNullOrEmpty(c.Email)) sb.AppendLine($"EMAIL:{c.Email}");
        if (!string.IsNullOrEmpty(c.MobilePhone)) sb.AppendLine($"TEL;TYPE=CELL:{c.MobilePhone}");
        if (!string.IsNullOrEmpty(c.Phone)) sb.AppendLine($"TEL;TYPE=WORK:{c.Phone}");
        if (!string.IsNullOrEmpty(c.Address))
            sb.AppendLine($"ADR;TYPE=HOME:;;{c.Address};{c.City};{c.Region};{c.PostalCode};");
        if (c.BirthDate.HasValue) sb.AppendLine($"BDAY:{c.BirthDate:yyyy-MM-dd}");
        if (!string.IsNullOrEmpty(c.VatNumber)) sb.AppendLine($"NOTE:ΑΦΜ {c.VatNumber}");
        sb.AppendLine("END:VCARD");
        return sb.ToString();
    }

    private static string BuildCsv(Customer c, string name)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Name,FirstName,LastName,Company,Email,Mobile,Phone,Address,City,PostalCode,AFM,DOY");
        sb.AppendLine($"\"{name}\",\"{c.FirstName}\",\"{c.LastName}\",\"{c.CompanyName}\",{c.Email},{c.MobilePhone},{c.Phone},\"{c.Address}\",\"{c.City}\",{c.PostalCode},{c.VatNumber},\"{c.TaxOffice}\"");
        return sb.ToString();
    }
}

/* ============================================================================
   EDITABLE DOCUMENTS (mail-merge from DocumentTemplate)
   ========================================================================= */
public record EditableDocumentDto(Guid Id, Guid TemplateId, string EntityType, Guid EntityId,
    string Title, string RenderedHtml, string? FileKey, bool IsFinalised, DateTime CreatedAt);

public record CreateEditableDocumentBody(Guid TemplateId, string EntityType, Guid EntityId, string Title);

public record CreateEditableDocumentCommand(CreateEditableDocumentBody Body) : IRequest<EditableDocumentDto>;
public class CreateEditableDocumentHandler : IRequestHandler<CreateEditableDocumentCommand, EditableDocumentDto>
{
    private readonly IAppDbContext _db;
    public CreateEditableDocumentHandler(IAppDbContext db) => _db = db;
    public async Task<EditableDocumentDto> Handle(CreateEditableDocumentCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var template = await _db.DocumentTemplates.FirstOrDefaultAsync(x => x.Id == b.TemplateId, ct)
            ?? throw AppException.NotFound("Template");

        var bodyHtml = template.BodyHtml ?? "";
        var headerHtml = template.HeaderHtml ?? "";
        var footerHtml = template.FooterHtml ?? "";
        var mergedTokens = await BuildTokensAsync(b.EntityType, b.EntityId, ct);
        foreach (var (k, v) in mergedTokens)
        {
            bodyHtml = bodyHtml.Replace("{{" + k + "}}", v);
            headerHtml = headerHtml.Replace("{{" + k + "}}", v);
            footerHtml = footerHtml.Replace("{{" + k + "}}", v);
        }

        var doc = new EditableDocument
        {
            Id = Guid.NewGuid(), TemplateId = b.TemplateId,
            EntityType = b.EntityType, EntityId = b.EntityId,
            Title = b.Title.Trim(),
            RenderedHtml = headerHtml + bodyHtml + footerHtml,
            IsFinalised = false
        };
        _db.EditableDocuments.Add(doc);
        await _db.SaveChangesAsync(ct);
        return new EditableDocumentDto(doc.Id, doc.TemplateId, doc.EntityType, doc.EntityId,
            doc.Title, doc.RenderedHtml, doc.FileKey, doc.IsFinalised, doc.CreatedAt);
    }

    private async Task<Dictionary<string, string>> BuildTokensAsync(string entityType, Guid id, CancellationToken ct)
    {
        var tokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (entityType == "Customer")
        {
            var c = await _db.Customers.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (c != null)
            {
                tokens["FullName"] = c.CompanyName ?? $"{c.FirstName} {c.LastName}".Trim();
                tokens["FirstName"] = c.FirstName ?? "";
                tokens["LastName"] = c.LastName ?? "";
                tokens["CompanyName"] = c.CompanyName ?? "";
                tokens["AFM"] = c.VatNumber ?? "";
                tokens["DOY"] = c.TaxOffice ?? "";
                tokens["Email"] = c.Email ?? "";
                tokens["Phone"] = c.Phone ?? c.MobilePhone ?? "";
                tokens["Address"] = c.Address ?? "";
                tokens["City"] = c.City ?? "";
                tokens["PostalCode"] = c.PostalCode ?? "";
            }
        }
        else if (entityType == "Policy")
        {
            var p = await _db.Policies.Include(x => x.Customer).Include(x => x.InsuranceCompany)
                .FirstOrDefaultAsync(x => x.Id == id, ct);
            if (p != null)
            {
                tokens["PolicyNumber"] = p.PolicyNumber;
                tokens["StartDate"] = p.StartDate.ToString("dd/MM/yyyy");
                tokens["EndDate"] = p.EndDate.ToString("dd/MM/yyyy");
                tokens["Premium"] = p.Premium.ToString("F2") + " " + p.Currency;
                tokens["CustomerName"] = (p.Customer.CompanyName ?? $"{p.Customer.FirstName} {p.Customer.LastName}").Trim();
                tokens["CarrierName"] = p.InsuranceCompany.Name;
            }
        }
        tokens["Today"] = DateTime.Today.ToString("dd/MM/yyyy");
        return tokens;
    }
}

public record ListEditableDocumentsQuery(string EntityType, Guid EntityId) : IRequest<IReadOnlyList<EditableDocumentDto>>;
public class ListEditableDocumentsHandler : IRequestHandler<ListEditableDocumentsQuery, IReadOnlyList<EditableDocumentDto>>
{
    private readonly IAppDbContext _db;
    public ListEditableDocumentsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<EditableDocumentDto>> Handle(ListEditableDocumentsQuery r, CancellationToken ct)
    {
        var rows = await _db.EditableDocuments
            .Where(x => x.EntityType == r.EntityType && x.EntityId == r.EntityId)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return rows.Select(d => new EditableDocumentDto(d.Id, d.TemplateId, d.EntityType, d.EntityId,
            d.Title, d.RenderedHtml, d.FileKey, d.IsFinalised, d.CreatedAt)).ToList();
    }
}

/* ============================================================================
   INFO CENTER export (Ελληνικό Κέντρο Πληροφοριών)
   ========================================================================= */
public record InfoCenterExportDto(Guid Id, string BatchNumber, DateTime CreatedAt, string Kind,
    int RecordCount, string Status, string? FileKey, string? ResponseCode, string? Notes);

public record CreateInfoCenterExportCommand(string Kind) : IRequest<InfoCenterExportDto>;
public class CreateInfoCenterExportHandler : IRequestHandler<CreateInfoCenterExportCommand, InfoCenterExportDto>
{
    private readonly IAppDbContext _db;
    public CreateInfoCenterExportHandler(IAppDbContext db) => _db = db;
    public async Task<InfoCenterExportDto> Handle(CreateInfoCenterExportCommand r, CancellationToken ct)
    {
        int count = r.Kind switch
        {
            "Vehicles" => await _db.Policies.CountAsync(p => p.PolicyType == Domain.Enums.PolicyType.Auto, ct),
            "Customers" => await _db.Customers.CountAsync(ct),
            "Policies" => await _db.Policies.CountAsync(ct),
            _ => 0
        };
        var seq = await _db.InfoCenterExports.CountAsync(ct) + 1;
        var ex = new InfoCenterExport
        {
            Id = Guid.NewGuid(),
            BatchNumber = $"IC-{DateTime.UtcNow:yyyyMM}-{seq:D4}",
            CreatedAt = DateTime.UtcNow, Kind = r.Kind, RecordCount = count, Status = "Created"
        };
        _db.InfoCenterExports.Add(ex);
        await _db.SaveChangesAsync(ct);
        return new InfoCenterExportDto(ex.Id, ex.BatchNumber, ex.CreatedAt, ex.Kind,
            ex.RecordCount, ex.Status, ex.FileKey, ex.ResponseCode, ex.Notes);
    }
}

public record ListInfoCenterExportsQuery() : IRequest<IReadOnlyList<InfoCenterExportDto>>;
public class ListInfoCenterExportsHandler : IRequestHandler<ListInfoCenterExportsQuery, IReadOnlyList<InfoCenterExportDto>>
{
    private readonly IAppDbContext _db;
    public ListInfoCenterExportsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<InfoCenterExportDto>> Handle(ListInfoCenterExportsQuery _, CancellationToken ct)
    {
        var rows = await _db.InfoCenterExports.OrderByDescending(x => x.CreatedAt).Take(200).ToListAsync(ct);
        return rows.Select(e => new InfoCenterExportDto(e.Id, e.BatchNumber, e.CreatedAt, e.Kind,
            e.RecordCount, e.Status, e.FileKey, e.ResponseCode, e.Notes)).ToList();
    }
}

/* ============================================================================
   SAP BRIDGE
   ========================================================================= */
public record SapBridgeMappingDto(Guid Id, Guid MovementTypeId, string MovementTypeName,
    string SapAccount, string? CostCenter, string? ProfitCenter, bool ExportEnabled);
public record SapBridgeMappingBody(Guid MovementTypeId, string SapAccount, string? CostCenter,
    string? ProfitCenter, bool ExportEnabled);

public record ListSapBridgeMappingsQuery() : IRequest<IReadOnlyList<SapBridgeMappingDto>>;
public class ListSapBridgeMappingsHandler : IRequestHandler<ListSapBridgeMappingsQuery, IReadOnlyList<SapBridgeMappingDto>>
{
    private readonly IAppDbContext _db;
    public ListSapBridgeMappingsHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<SapBridgeMappingDto>> Handle(ListSapBridgeMappingsQuery _, CancellationToken ct)
    {
        var rows = await _db.SapBridgeMappings.Include(x => x.MovementType).ToListAsync(ct);
        return rows.Select(m => new SapBridgeMappingDto(m.Id, m.MovementTypeId,
            m.MovementType?.Name ?? "", m.SapAccount, m.CostCenter, m.ProfitCenter, m.ExportEnabled)).ToList();
    }
}

public record SaveSapBridgeMappingCommand(Guid? Id, SapBridgeMappingBody Body) : IRequest<SapBridgeMappingDto>;
public class SaveSapBridgeMappingHandler : IRequestHandler<SaveSapBridgeMappingCommand, SapBridgeMappingDto>
{
    private readonly IAppDbContext _db;
    public SaveSapBridgeMappingHandler(IAppDbContext db) => _db = db;
    public async Task<SapBridgeMappingDto> Handle(SaveSapBridgeMappingCommand r, CancellationToken ct)
    {
        var b = r.Body;
        SapBridgeMapping m;
        if (r.Id.HasValue)
        {
            m = await _db.SapBridgeMappings.FirstOrDefaultAsync(x => x.Id == r.Id, ct) ?? throw AppException.NotFound("Mapping");
        }
        else
        {
            if (await _db.SapBridgeMappings.AnyAsync(x => x.MovementTypeId == b.MovementTypeId, ct))
                throw new AppException("sap_mapping_exists",
                    "Υπάρχει ήδη SAP mapping για αυτό το είδος κίνησης.", 409,
                    title: "Διπλό mapping", why: "Κάθε είδος κίνησης μπορεί να έχει ένα μόνο SAP mapping.",
                    fix: "Επεξεργαστείτε το υπάρχον αντί να δημιουργήσετε νέο.",
                    fixLink: "/app/sap-bridge");
            m = new SapBridgeMapping { Id = Guid.NewGuid() };
            _db.SapBridgeMappings.Add(m);
        }
        m.MovementTypeId = b.MovementTypeId; m.SapAccount = b.SapAccount.Trim();
        m.CostCenter = b.CostCenter; m.ProfitCenter = b.ProfitCenter;
        m.ExportEnabled = b.ExportEnabled;
        await _db.SaveChangesAsync(ct);
        var mt = await _db.MovementTypes.FirstOrDefaultAsync(x => x.Id == m.MovementTypeId, ct);
        return new SapBridgeMappingDto(m.Id, m.MovementTypeId, mt?.Name ?? "",
            m.SapAccount, m.CostCenter, m.ProfitCenter, m.ExportEnabled);
    }
}

/* ============================================================================
   PERIOD LOCKS
   ========================================================================= */
public record PeriodLockDto(Guid Id, DateOnly LockedBefore, string Scope, bool AutoAdvanceDaily, string? Reason);
public record PeriodLockBody(DateOnly LockedBefore, string Scope, bool AutoAdvanceDaily, string? Reason);

public record ListPeriodLocksQuery() : IRequest<IReadOnlyList<PeriodLockDto>>;
public class ListPeriodLocksHandler : IRequestHandler<ListPeriodLocksQuery, IReadOnlyList<PeriodLockDto>>
{
    private readonly IAppDbContext _db;
    public ListPeriodLocksHandler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<PeriodLockDto>> Handle(ListPeriodLocksQuery _, CancellationToken ct)
    {
        var rows = await _db.PeriodLocks.OrderBy(x => x.Scope).ToListAsync(ct);
        return rows.Select(p => new PeriodLockDto(p.Id, p.LockedBefore, p.Scope, p.AutoAdvanceDaily, p.Reason)).ToList();
    }
}

public record SavePeriodLockCommand(PeriodLockBody Body) : IRequest<PeriodLockDto>;
public class SavePeriodLockHandler : IRequestHandler<SavePeriodLockCommand, PeriodLockDto>
{
    private readonly IAppDbContext _db;
    public SavePeriodLockHandler(IAppDbContext db) => _db = db;
    public async Task<PeriodLockDto> Handle(SavePeriodLockCommand r, CancellationToken ct)
    {
        var b = r.Body;
        var p = await _db.PeriodLocks.FirstOrDefaultAsync(x => x.Scope == b.Scope, ct);
        if (p is null)
        {
            p = new PeriodLock { Id = Guid.NewGuid(), Scope = b.Scope };
            _db.PeriodLocks.Add(p);
        }
        p.LockedBefore = b.LockedBefore;
        p.AutoAdvanceDaily = b.AutoAdvanceDaily;
        p.Reason = b.Reason;
        await _db.SaveChangesAsync(ct);
        return new PeriodLockDto(p.Id, p.LockedBefore, p.Scope, p.AutoAdvanceDaily, p.Reason);
    }
}

/* ============================================================================
   NAMED REPORTS (4500 / 506 / 507 / 610 — analytics aggregates)
   ========================================================================= */
public record CustomerDirectoryRowDto(Guid Id, string CustomerNumber, string FullName,
    DateOnly? BirthDate, string? FirstName, string? Email, string? MobilePhone, int PolicyCount);

public record Report4500Query(int? Month, int? Day, string? Name) : IRequest<IReadOnlyList<CustomerDirectoryRowDto>>;
public class Report4500Handler : IRequestHandler<Report4500Query, IReadOnlyList<CustomerDirectoryRowDto>>
{
    private readonly IAppDbContext _db;
    public Report4500Handler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CustomerDirectoryRowDto>> Handle(Report4500Query r, CancellationToken ct)
    {
        var q = _db.Customers.AsQueryable();
        if (r.Month.HasValue) q = q.Where(c => c.BirthDate != null && c.BirthDate!.Value.Month == r.Month);
        if (r.Day.HasValue) q = q.Where(c => c.BirthDate != null && c.BirthDate!.Value.Day == r.Day);
        if (!string.IsNullOrEmpty(r.Name)) q = q.Where(c => c.FirstName == r.Name);
        var rows = await q.OrderBy(c => c.LastName).Take(1000).ToListAsync(ct);
        var ids = rows.Select(x => x.Id).ToList();
        var counts = await _db.Policies.Where(p => ids.Contains(p.CustomerId))
            .GroupBy(p => p.CustomerId)
            .Select(g => new { Id = g.Key, Count = g.Count() }).ToListAsync(ct);
        var map = counts.ToDictionary(c => c.Id, c => c.Count);
        return rows.Select(c => new CustomerDirectoryRowDto(c.Id, c.CustomerNumber,
            (c.CompanyName ?? $"{c.FirstName} {c.LastName}").Trim(),
            c.BirthDate, c.FirstName, c.Email, c.MobilePhone, map.GetValueOrDefault(c.Id, 0))).ToList();
    }
}

public record UnpaidPolicyRowDto(Guid Id, string PolicyNumber, string CustomerName, DateOnly StartDate,
    DateOnly EndDate, decimal Premium, decimal Allocated, decimal Outstanding, int DaysOverdue, string Currency);

public record Report507Query(int? MaxDaysOverdue) : IRequest<IReadOnlyList<UnpaidPolicyRowDto>>;
public class Report507Handler : IRequestHandler<Report507Query, IReadOnlyList<UnpaidPolicyRowDto>>
{
    private readonly IAppDbContext _db;
    public Report507Handler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<UnpaidPolicyRowDto>> Handle(Report507Query r, CancellationToken ct)
    {
        var policies = await _db.Policies.Include(p => p.Customer)
            .Where(p => p.Status != Domain.Enums.PolicyStatus.Cancelled
                     && p.Status != Domain.Enums.PolicyStatus.Draft).ToListAsync(ct);
        var policyIds = policies.Select(x => x.Id).ToList();
        var receiptsByPolicy = await _db.Receipts
            .Where(rc => rc.PolicyId.HasValue && policyIds.Contains(rc.PolicyId!.Value))
            .GroupBy(rc => rc.PolicyId!.Value)
            .Select(g => new { Id = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync(ct);
        var map = receiptsByPolicy.ToDictionary(x => x.Id, x => x.Total);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = policies.Select(p => {
            var allocated = map.GetValueOrDefault(p.Id, 0m);
            var outstanding = p.Premium - allocated;
            var days = (today.DayNumber - p.StartDate.DayNumber);
            return new UnpaidPolicyRowDto(p.Id, p.PolicyNumber,
                (p.Customer.CompanyName ?? $"{p.Customer.FirstName} {p.Customer.LastName}").Trim(),
                p.StartDate, p.EndDate, p.Premium, allocated, outstanding, days, p.Currency);
        }).Where(x => x.Outstanding > 0).ToList();
        if (r.MaxDaysOverdue.HasValue) rows = rows.Where(x => x.DaysOverdue <= r.MaxDaysOverdue).ToList();
        return rows.OrderByDescending(x => x.DaysOverdue).Take(500).ToList();
    }
}

public record CustomerAgingRow(Guid CustomerId, string CustomerName, decimal Current,
    decimal Days30, decimal Days60, decimal Days90, decimal Over90, decimal Total);

public record Report506Query() : IRequest<IReadOnlyList<CustomerAgingRow>>;
public class Report506Handler : IRequestHandler<Report506Query, IReadOnlyList<CustomerAgingRow>>
{
    private readonly IAppDbContext _db;
    public Report506Handler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CustomerAgingRow>> Handle(Report506Query _, CancellationToken ct)
    {
        var unpaid = await new Report507Handler(_db).Handle(new Report507Query(null), ct);
        var grouped = unpaid.GroupBy(x => x.CustomerName).Select(g => {
            decimal current = 0, d30 = 0, d60 = 0, d90 = 0, over = 0;
            foreach (var row in g)
            {
                if (row.DaysOverdue <= 0) current += row.Outstanding;
                else if (row.DaysOverdue <= 30) d30 += row.Outstanding;
                else if (row.DaysOverdue <= 60) d60 += row.Outstanding;
                else if (row.DaysOverdue <= 90) d90 += row.Outstanding;
                else over += row.Outstanding;
            }
            return new CustomerAgingRow(Guid.Empty, g.Key, current, d30, d60, d90, over,
                current + d30 + d60 + d90 + over);
        }).OrderByDescending(x => x.Total).Take(500).ToList();
        return grouped;
    }
}

public record CarrierAgingRow(Guid CarrierId, string CarrierName, int OpenClaimCount,
    decimal TotalPremium, decimal TotalCommissionDue);

public record Report610Query() : IRequest<IReadOnlyList<CarrierAgingRow>>;
public class Report610Handler : IRequestHandler<Report610Query, IReadOnlyList<CarrierAgingRow>>
{
    private readonly IAppDbContext _db;
    public Report610Handler(IAppDbContext db) => _db = db;
    public async Task<IReadOnlyList<CarrierAgingRow>> Handle(Report610Query _, CancellationToken ct)
    {
        var data = await _db.Policies.Include(p => p.InsuranceCompany)
            .Where(p => p.Status != Domain.Enums.PolicyStatus.Cancelled)
            .GroupBy(p => new { p.InsuranceCompanyId, p.InsuranceCompany.Name })
            .Select(g => new CarrierAgingRow(g.Key.InsuranceCompanyId, g.Key.Name,
                g.Count(), g.Sum(x => x.Premium), g.Sum(x => x.Premium) * 0.15m))
            .OrderByDescending(x => x.TotalPremium).ToListAsync(ct);
        return data;
    }
}
