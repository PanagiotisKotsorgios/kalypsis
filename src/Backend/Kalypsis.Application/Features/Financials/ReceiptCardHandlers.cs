using System.Globalization;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using Kalypsis.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
namespace Kalypsis.Application.Features.Financials;

public record ReceiptCardDto(ReceiptDto Receipt, Dictionary<string,string?> Related, IReadOnlyList<ReceiptHistoryDto> History);
public record ReceiptHistoryDto(DateTime Date, string Action, string User);
public record GetReceiptCardQuery(Guid Id) : IRequest<ReceiptCardDto>;
public sealed class GetReceiptCardQueryHandler(IAppDbContext db, ICurrentUser current) : IRequestHandler<GetReceiptCardQuery, ReceiptCardDto>
{
    public async Task<ReceiptCardDto> Handle(GetReceiptCardQuery r, CancellationToken ct)
    {
        var tenant = current.TenantId ?? throw AppException.Forbidden();
        var row = await db.Receipts.Include(x=>x.Customer).Include(x=>x.Policy)!.ThenInclude(x=>x!.InsuranceCompany)
            .Include(x=>x.Policy)!.ThenInclude(x=>x!.Producer)
            .FirstOrDefaultAsync(x=>x.Id==r.Id && x.TenantId==tenant && x.DeletedAt==null,ct) ?? throw AppException.NotFound("Είσπραξη");
        var c=row.Customer; var p=row.Policy;
        var related=new Dictionary<string,string?> {
            ["CustomerCode"]=c.CustomerNumber, ["CustomerVat"]=c.VatNumber, ["CustomerPhone"]=c.MobilePhone??c.Phone,
            ["CustomerEmail"]=c.Email, ["CustomerAddress"]=string.Join(", ",new[]{c.Address,c.City,c.PostalCode}.Where(x=>!string.IsNullOrWhiteSpace(x))),
            ["Carrier"]=p?.InsuranceCompany?.Name, ["Producer"]=p?.Producer?.Name, ["Branch"]=p?.PolicyType.ToString(),
            ["PolicyStart"]=p?.StartDate.ToString("dd/MM/yyyy"), ["PolicyEnd"]=p?.EndDate.ToString("dd/MM/yyyy"),
            ["CreatedAt"]=row.CreatedAt.ToString("O"), ["UpdatedAt"]=row.UpdatedAt?.ToString("O")
        };
        if(p!=null) {
            var paid=await db.Receipts.Where(x=>x.PolicyId==p.Id && x.Currency==p.Currency && x.TenantId==tenant && x.DeletedAt==null).SumAsync(x=>x.Amount,ct);
            string Money(decimal n)=>n.ToString("F2",CultureInfo.InvariantCulture)+" "+p.Currency;
            related["premium"]=Money(p.Premium); related["netPremium"]=p.NetPremium.HasValue?Money(p.NetPremium.Value):null;
            related["policyCurrency"]=p.Currency; related["totalReceived"]=Money(paid);
            related["remaining"]=Money(p.PaidDirectlyToCarrier?0:Math.Max(0,p.Premium-paid));
            var carrier=(await CarrierCommissionLedger.BalancesAsync(db,tenant,ct,p.Id)).SingleOrDefault();
            related["carrierCommissionReceived"]=Money(carrier?.Received??0);
            related["paymentStatus"]=p.PaidDirectlyToCarrier?"Πληρωμή στην ασφαλιστική":paid>=p.Premium?"Εξοφλημένο":paid>0?"Μερικώς εξοφλημένο":"Ανεξόφλητο";
        }
        var id=r.Id.ToString();
        var history=await db.AuditLogs.AsNoTracking().Where(x=>x.TenantId==tenant && x.EntityName==nameof(Receipt) && x.EntityId==id && x.DeletedAt==null)
            .OrderByDescending(x=>x.CreatedAt).Select(x=>new ReceiptHistoryDto(x.CreatedAt,x.Action,x.UserId.HasValue?x.UserId.Value.ToString():"Γραφείο")).ToListAsync(ct);
        return new(ListReceiptsQueryHandler.Map(row),related,history);
    }
}

public record UpdateReceiptFieldsCommand(Guid Id, Dictionary<string,string?> Changes) : IRequest<ReceiptDto>;
public sealed class UpdateReceiptFieldsCommandHandler(IAppDbContext db, ICurrentUser current, IMediator mediator) : IRequestHandler<UpdateReceiptFieldsCommand,ReceiptDto>
{
    public async Task<ReceiptDto> Handle(UpdateReceiptFieldsCommand r,CancellationToken ct)
    {
        var tenant=current.TenantId??throw AppException.Forbidden();
        var row=await db.Receipts.FirstOrDefaultAsync(x=>x.Id==r.Id && x.TenantId==tenant && x.DeletedAt==null,ct)??throw AppException.NotFound("Είσπραξη");
        string Value(string key,string? fallback)=>r.Changes.TryGetValue(key,out var v)?v?.Trim()??"":fallback??"";
        var core=new[]{"number","receivedOn","customerId","policyId","method","amount","currency","notes","transactionReference"};
        if(r.Changes.Keys.Any(k=>!core.Contains(k)&&!ReceiptDossierRules.Keys.Contains(k)))throw AppException.Validation("Μη επιτρεπόμενο πεδίο είσπραξης.");
        ReceiptBody body;
        try {
            var customer=Guid.Parse(Value("customerId",row.CustomerId.ToString()));
            var policyText=Value("policyId",row.PolicyId?.ToString()); Guid? policy=string.IsNullOrWhiteSpace(policyText)?null:Guid.Parse(policyText);
            if(customer!=row.CustomerId&&!r.Changes.ContainsKey("policyId"))policy=null;
            body=new ReceiptBody(Value("number",row.Number),
                DateOnly.ParseExact(Value("receivedOn",row.ReceivedOn.ToString("yyyy-MM-dd")),"yyyy-MM-dd",CultureInfo.InvariantCulture),customer,policy,
                Enum.Parse<PaymentMethod>(Value("method",row.Method.ToString())),
                decimal.Parse(Value("amount",row.Amount.ToString(CultureInfo.InvariantCulture)),NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture),
                Value("currency",row.Currency),Value("notes",row.Notes),Value("transactionReference",row.TransactionReference),
                r.Changes.Where(x=>ReceiptDossierRules.Keys.Contains(x.Key)).ToDictionary(x=>x.Key,x=>x.Value));
        } catch(Exception ex) when(ex is FormatException or ArgumentException or OverflowException) {
            throw AppException.Validation("Ελέγξτε τις τιμές των πεδίων: "+ex.Message);
        }
        // The existing posting handler updates the linked movement, never creates a second one.
        return await mediator.Send(new UpdateReceiptCommand(r.Id,body),ct);
    }
}
