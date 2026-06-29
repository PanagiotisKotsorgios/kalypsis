using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;
using Kalypsis.Application.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Storage;

/// <summary>
/// Talks ClamAV's INSTREAM protocol over TCP. Designed for a Coolify deployment
/// where ClamAV runs as a sidecar container — the host is the docker service
/// name (e.g. "clamav"), reachable on the internal docker network, never
/// localhost.
///
/// Config (appsettings / env vars — Coolify env panel):
///   Clamav:Host       — DNS name / IP of the daemon. Unset → scanner disabled.
///   Clamav:Port       — TCP port (default 3310)
///   Clamav:FailClosed — when true, refuse uploads if ClamAV is unreachable.
///                        Default false: log a warning and accept (degrades to
///                        magic-byte safety only).
///   Clamav:TimeoutMs  — connect + read timeout in milliseconds (default 8000)
///   Clamav:MaxBytes   — refuse to scan beyond this size (default 25 MB)
///
/// INSTREAM protocol:
///   client → "zINSTREAM\0"
///   client → [4-byte big-endian length][chunk] repeated
///   client → 4-byte 0 (terminator)
///   server → "stream: OK\0"     -> clean
///           or "stream: <sig> FOUND\0" -> infected
///           or "INSTREAM size limit exceeded\0" etc.
/// </summary>
public sealed class ClamAvScanner : IAntivirusScanner
{
    private readonly string _host;
    private readonly int _port;
    private readonly bool _failClosed;
    private readonly int _timeoutMs;
    private readonly long _maxBytes;
    private readonly ILogger<ClamAvScanner> _logger;

    public bool IsEnabled => !string.IsNullOrWhiteSpace(_host);

    public ClamAvScanner(IConfiguration config, ILogger<ClamAvScanner> logger)
    {
        _logger = logger;
        _host = config["Clamav:Host"] ?? string.Empty;
        _port = int.TryParse(config["Clamav:Port"], out var p) ? p : 3310;
        _failClosed = bool.TryParse(config["Clamav:FailClosed"], out var fc) && fc;
        _timeoutMs = int.TryParse(config["Clamav:TimeoutMs"], out var t) ? t : 8000;
        _maxBytes = long.TryParse(config["Clamav:MaxBytes"], out var m) ? m : 25L * 1024 * 1024;
    }

    public async Task<AntivirusScanResult> ScanAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        if (!IsEnabled) return AntivirusScanResult.AssumedClean;
        if (!content.CanSeek)
        {
            _logger.LogWarning("AV scan skipped — stream not seekable ({File}).", fileName);
            return _failClosed ? new AntivirusScanResult(false, "stream_not_seekable") : AntivirusScanResult.AssumedClean;
        }

        if (content.Length > _maxBytes)
        {
            _logger.LogInformation("AV scan skipped — file exceeds Clamav:MaxBytes ({Size} > {Max}).", content.Length, _maxBytes);
            return _failClosed
                ? new AntivirusScanResult(false, "av_size_limit_exceeded")
                : AntivirusScanResult.AssumedClean;
        }

        var startPos = content.Position;
        try
        {
            using var tcp = new TcpClient { SendTimeout = _timeoutMs, ReceiveTimeout = _timeoutMs };
            using var connectCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            connectCts.CancelAfter(_timeoutMs);
            await tcp.ConnectAsync(_host, _port, connectCts.Token);

            using var net = tcp.GetStream();
            // Command line: "zINSTREAM" terminated by NUL (z = null-terminated reply).
            var cmd = Encoding.ASCII.GetBytes("zINSTREAM\0");
            await net.WriteAsync(cmd, ct);

            content.Position = 0;
            var buffer = new byte[32 * 1024];
            var lenBuf = new byte[4];
            int read;
            while ((read = await content.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
            {
                BinaryPrimitives.WriteInt32BigEndian(lenBuf, read);
                await net.WriteAsync(lenBuf, ct);
                await net.WriteAsync(buffer.AsMemory(0, read), ct);
            }
            BinaryPrimitives.WriteInt32BigEndian(lenBuf, 0);
            await net.WriteAsync(lenBuf, ct);
            await net.FlushAsync(ct);

            // Read until NUL terminator.
            using var ms = new MemoryStream();
            var rbuf = new byte[256];
            while (true)
            {
                var n = await net.ReadAsync(rbuf, ct);
                if (n <= 0) break;
                for (int i = 0; i < n; i++)
                {
                    if (rbuf[i] == 0) goto done;
                    ms.WriteByte(rbuf[i]);
                }
            }
            done:
            var reply = Encoding.ASCII.GetString(ms.ToArray()).Trim();
            content.Position = startPos;

            if (reply.EndsWith(" OK", StringComparison.Ordinal))
                return AntivirusScanResult.AssumedClean;
            if (reply.Contains(" FOUND", StringComparison.Ordinal))
            {
                // "stream: Eicar-Test-Signature FOUND"
                var sig = reply.Replace("stream: ", "").Replace(" FOUND", "").Trim();
                _logger.LogWarning("ClamAV flagged {File}: {Signature}", fileName, sig);
                return new AntivirusScanResult(false, sig);
            }

            _logger.LogWarning("ClamAV returned unexpected reply for {File}: {Reply}", fileName, reply);
            return _failClosed
                ? new AntivirusScanResult(false, "av_unknown_reply")
                : AntivirusScanResult.AssumedClean;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ClamAV scan failed for {File} (host {Host}:{Port}).", fileName, _host, _port);
            content.Position = startPos;
            return _failClosed
                ? new AntivirusScanResult(false, "av_unavailable")
                : AntivirusScanResult.AssumedClean;
        }
    }
}
