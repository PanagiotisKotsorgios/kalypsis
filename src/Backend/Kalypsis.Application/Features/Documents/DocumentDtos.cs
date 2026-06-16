using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Documents;

public record PolicyDocumentDto(
    Guid Id,
    Guid PolicyId,
    string PolicyNumber,
    Guid CustomerId,
    string CustomerDisplay,
    DocumentType DocumentType,
    string FileName,
    string MimeType,
    long SizeBytes,
    DateTime CreatedAt);
