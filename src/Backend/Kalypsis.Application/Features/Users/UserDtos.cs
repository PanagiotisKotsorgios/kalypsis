using Kalypsis.Domain.Enums;

namespace Kalypsis.Application.Features.Users;

public record UserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    Role Role,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record CreateEmployeeRequest(
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    string Password,
    Role Role);

public record CreateEmployeeResponse(UserDto User);
