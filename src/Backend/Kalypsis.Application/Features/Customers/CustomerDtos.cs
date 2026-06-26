using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Customers;

public record CustomerDto(
    Guid Id,
    string CustomerNumber,
    CustomerType Type,
    string? FirstName,
    string? LastName,
    string? CompanyName,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? City,
    DateTime CreatedAt,
    bool HasPortalAccount);

public record CreateCustomerRequest(
    CustomerType Type,
    string? FirstName,
    string? LastName,
    string? CompanyName,
    string? VatNumber,
    string? Email,
    string? Phone,
    string? Address,
    string? City,
    string? PostalCode,
    DateOnly? BirthDate,
    string? Notes,
    bool CreatePortalAccount,
    string? Occupation = null);

public record CreateCustomerResponse(
    CustomerDto Customer,
    string? PortalEmail,
    string? PortalTemporaryPassword);
