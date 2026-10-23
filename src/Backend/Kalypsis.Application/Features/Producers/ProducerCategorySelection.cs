using Kalypsis.Application.Abstractions;
using Kalypsis.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Kalypsis.Application.Features.Producers;

public static class ProducerCategorySelection
{
    public static async Task<string?> ValidateAsync(IAppDbContext db, ICurrentUser current,
        Guid? categoryId, Guid? previousCategoryId, CancellationToken ct)
    {
        if (categoryId is null) return null;
        var category = await db.ProducerCategories.FirstOrDefaultAsync(x => x.Id == categoryId
            && x.TenantId == current.TenantId && x.DeletedAt == null
            && (x.AgencyOfficeScopeId == current.AgencyOfficeId
                || current.AgencyOfficeIsHeadquarters && x.AgencyOfficeScopeId == null), ct);
        if (category is null || !category.IsActive && categoryId != previousCategoryId)
            throw new AppException("producer_category_unavailable",
                "Επιλέξτε ενεργή κατηγορία από τις Κατηγορίες συνεργατών του γραφείου σας ή αφήστε την επιλογή κενή.", 400);
        return category.Name;
    }
}
