using System.Globalization;
using System.Reflection;
using System.Text.Json;
using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
namespace Kalypsis.Application.Features.Producers;

public record ProducerCardDto(Guid Id, Dictionary<string,string> Values, DateTime CreatedAt, DateTime? UpdatedAt);
public record GetProducerCardQuery(Guid Id):IRequest<ProducerCardDto>;
public sealed class GetProducerCardHandler(IAppDbContext db,ICurrentUser current):IRequestHandler<GetProducerCardQuery,ProducerCardDto>
{
    public async Task<ProducerCardDto> Handle(GetProducerCardQuery r,CancellationToken ct){var tenant=current.TenantId??throw AppException.Forbidden();var p=await db.Producers.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==r.Id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Συνεργάτης");return new(p.Id,ProducerCardSchema.Values(p,false),p.CreatedAt,p.UpdatedAt);}
}
public record SaveProducerCardFieldsCommand(Guid Id,Dictionary<string,string?> Changes):IRequest<ProducerCardDto>;
public sealed class SaveProducerCardFieldsHandler(IAppDbContext db,ICurrentUser current,IMediator mediator):IRequestHandler<SaveProducerCardFieldsCommand,ProducerCardDto>
{
    public async Task<ProducerCardDto> Handle(SaveProducerCardFieldsCommand r,CancellationToken ct)
    {
        var tenant=current.TenantId??throw AppException.Forbidden();var row=await db.Producers.FirstOrDefaultAsync(x=>x.Id==r.Id&&x.TenantId==tenant&&x.DeletedAt==null,ct)??throw AppException.NotFound("Συνεργάτης");
        var draft=new Producer();foreach(var p in typeof(Producer).GetProperties().Where(p=>p.CanWrite&&(p.PropertyType.IsValueType||p.PropertyType==typeof(string))))p.SetValue(draft,p.GetValue(row));
        try{
            foreach(var (key,value) in r.Changes){var field=ProducerCardSchema.Definition.Fields.SingleOrDefault(x=>x.Key==key)??throw new FormatException("Μη υποστηριζόμενο πεδίο συνεργάτη.");ProducerCardSchema.Set(draft,field,value??"",false);}
            var values=ProducerCardSchema.Values(draft,false);ProducerCardSchema.ValidateDates(values);
            if(string.IsNullOrWhiteSpace(draft.Code)||string.IsNullOrWhiteSpace(draft.Name))throw new FormatException("Συμπληρώστε κωδικό και όνομα συνεργάτη.");
            if(draft.GoalLevelCount<1||draft.GoalLevelCount>12||draft.GoalCountStep is <1)throw new FormatException("Τα επίπεδα στόχων πρέπει να είναι 1–12 και το βήμα πλήθους τουλάχιστον 1.");
            if(values["creditCurrency"] is {Length:>0} currency&&(currency.Length!=3||!currency.All(char.IsAsciiLetter)))throw new FormatException("Συμπληρώστε νόμισμα τριών γραμμάτων.");
            if(await db.Producers.IgnoreQueryFilters().AnyAsync(x=>x.TenantId==tenant&&x.Id!=row.Id&&x.Code==draft.Code.Trim().ToUpperInvariant(),ct))throw new FormatException("Ο κωδικός συνεργάτη χρησιμοποιείται ήδη.");
            var refs=ProducerCardSchema.Definition.Fields.Where(x=>x.Kind=="producer").Select(x=>values.GetValueOrDefault(x.Key)).Where(x=>!string.IsNullOrEmpty(x)).Select(x=>Guid.Parse(x!)).ToHashSet();
            if(refs.Contains(row.Id))throw new FormatException("Ο συνεργάτης δεν μπορεί να συνδέεται με τον εαυτό του στην ιεραρχία.");
            var all=await db.Producers.AsNoTracking().Where(x=>x.TenantId==tenant&&x.DeletedAt==null).ToListAsync(ct);if(refs.Any(id=>!all.Any(x=>x.Id==id)))throw new FormatException("Επιλέξτε διαθέσιμο συνεργάτη του γραφείου.");
            // Every configured parent edge is checked, not only direct self-parenting.
            var byId=all.ToDictionary(x=>x.Id);var queue=new Queue<Guid>(refs);var seen=new HashSet<Guid>();while(queue.TryDequeue(out var id)){if(id==row.Id)throw new FormatException("Η σύνδεση δημιουργεί κύκλο στην ιεραρχία.");if(!seen.Add(id)||!byId.TryGetValue(id,out var parent))continue;var pv=ProducerCardSchema.Values(parent,false);foreach(var f in ProducerCardSchema.Definition.Fields.Where(x=>x.Kind=="producer"))if(Guid.TryParse(pv.GetValueOrDefault(f.Key),out var next))queue.Enqueue(next);}
            // Keep native goals and metadata in the same save as the existing core
            // handler, preserving its user linking and category checks.
            var body=JsonSerializer.Deserialize<UpdateProducerBody>(JsonSerializer.Serialize(draft),new JsonSerializerOptions{PropertyNameCaseInsensitive=true})!;
            foreach(var f in ProducerCardSchema.Definition.Fields.Where(x=>x.Section=="goals"))typeof(Producer).GetProperty(f.Web)?.SetValue(row,typeof(Producer).GetProperty(f.Web)?.GetValue(draft));
            await mediator.Send(new UpdateProducerCommand(row.Id,body),ct);
            return new(row.Id,ProducerCardSchema.Values(row,false),row.CreatedAt,row.UpdatedAt);
        }catch(Exception ex)when(ex is FormatException or ArgumentException or OverflowException){throw AppException.Validation(ex.Message);}
    }
}
