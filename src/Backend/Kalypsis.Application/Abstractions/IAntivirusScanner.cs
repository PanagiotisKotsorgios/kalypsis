namespace Kalypsis.Application.Abstractions;

/// <summary>
/// Abstraction over an antivirus daemon (ClamAV, Windows Defender APIs, etc).
/// The default no-op implementation reports every file clean, so handlers can
/// always call <see cref="ScanAsync"/> without worrying whether AV is wired up
/// in this deployment. Swap in a real ClamAV client by registering a different
/// implementation in DependencyInjection.
/// </summary>
public interface IAntivirusScanner
{
    Task<AntivirusScanResult> ScanAsync(Stream content, string fileName, CancellationToken ct = default);
    bool IsEnabled { get; }
}

public sealed record AntivirusScanResult(bool Clean, string? Signature = null)
{
    public static readonly AntivirusScanResult AssumedClean = new(true);
}
