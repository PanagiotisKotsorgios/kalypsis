using Kalypsis.Application.Common;
using Kalypsis.Domain.Entities;

namespace Kalypsis.Application.Features.Customers;

public static class CustomerInputValidation
{
    // Enforce the current persistence limits without changing schemas or truncating user data.
    private static readonly Dictionary<string, int> Limits = new()
    {
        ["FirstName"] = 100, ["LastName"] = 100, ["CompanyName"] = 200, ["TaxOffice"] = 60,
        ["GemiNumber"] = 40, ["LegalForm"] = 20, ["IdNumber"] = 32, ["PassportNumber"] = 32,
        ["Address"] = 255, ["City"] = 100, ["Region"] = 100, ["Gender"] = 20, ["MaritalStatus"] = 20,
        ["Occupation"] = 120, ["Employer"] = 200, ["Source"] = 60, ["TagsJson"] = 2000, ["Notes"] = 2000,
    };

    public static void Ensure(CreateCustomerRequest request, Customer? previous = null)
    {
        foreach (var property in typeof(CreateCustomerRequest).GetProperties().Where(p => p.PropertyType == typeof(string)))
        {
            var value = (string?)property.GetValue(request);
            var oldValue = previous is null ? null : (string?)typeof(Customer).GetProperty(property.Name)?.GetValue(previous);
            if (previous is not null && value?.Trim() == oldValue?.Trim()) continue;
            ContactValueRules.Ensure(property.Name, value);
            if (Limits.TryGetValue(property.Name, out var limit) && value?.Trim().Length > limit)
                throw AppException.Validation($"Το πεδίο υπερβαίνει το επιτρεπόμενο όριο των {limit} χαρακτήρων.");
        }
        if (((previous is null || request.Type != previous.Type) && !Enum.IsDefined(request.Type)) ||
            ((previous is null || request.Status != previous.Status) && !Enum.IsDefined(request.Status)))
            throw AppException.Validation("Μη έγκυρος τύπος ή κατάσταση πελάτη.");
        if (request.BirthDate != previous?.BirthDate && request.BirthDate > DateOnly.FromDateTime(DateTime.UtcNow))
            throw AppException.Validation("Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική.");
        if ((previous is null || request.DriverLicenseIssueDate != previous.DriverLicenseIssueDate || request.DriverLicenseExpiryDate != previous.DriverLicenseExpiryDate)
            && request.DriverLicenseIssueDate > request.DriverLicenseExpiryDate)
            throw AppException.Validation("Η λήξη διπλώματος δεν μπορεί να προηγείται της έκδοσης.");
    }
}
