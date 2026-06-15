using Kalypsis.Application.Abstractions;

namespace Kalypsis.Infrastructure.Services;

public sealed class SystemClock : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
