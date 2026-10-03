namespace Kalypsis.Api.Startup;

/// <summary>
/// Describes whether the database migrations and idempotent seeders have
/// completed for the current API process.
/// </summary>
public sealed class StartupReadiness
{
    private int _ready;
    private string? _lastFailure;

    public bool IsReady => Volatile.Read(ref _ready) == 1;

    // Exposed only for health diagnostics; never return the exception text to
    // an unauthenticated caller because it can contain connection details.
    public string? LastFailure => _lastFailure;

    public void MarkReady()
    {
        Volatile.Write(ref _ready, 1);
        Interlocked.Exchange(ref _lastFailure, null);
    }

    public void MarkFailure(Exception exception)
    {
        Interlocked.Exchange(ref _lastFailure, exception.GetType().Name);
    }
}
