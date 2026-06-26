using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Abstractions;

public interface IInvoicePdfRenderer
{
    /// <summary>
    /// Render the invoice (with its lines + tenant) to a PDF byte array.
    /// Implementation is responsible for layout, branding, VAT presentation.
    /// </summary>
    byte[] Render(TenantInvoice invoice, Tenant tenant);
}
