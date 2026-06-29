using Kalypsis.Application.Abstractions;

namespace Kalypsis.Infrastructure.Storage;

/// <summary>
/// Default antivirus implementation: reports every file clean. Magic-byte
/// safety still runs through <see cref="IFileSafetyService"/> independently.
/// Replace with a real ClamAV-talking implementation when a daemon is deployed.
/// </summary>
public sealed class NoopAntivirusScanner : IAntivirusScanner
{
    public bool IsEnabled => false;
    public Task<AntivirusScanResult> ScanAsync(Stream content, string fileName, CancellationToken ct = default)
        => Task.FromResult(AntivirusScanResult.AssumedClean);
}
