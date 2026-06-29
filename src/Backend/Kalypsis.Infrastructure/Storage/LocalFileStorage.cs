using Kalypsis.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace Kalypsis.Infrastructure.Storage;

public sealed class LocalFileStorage : IFileStorage
{
    private readonly string _root;

    public LocalFileStorage(IConfiguration config)
    {
        _root = config["Storage:LocalRoot"]
                ?? Path.Combine(AppContext.BaseDirectory, "uploads");
        Directory.CreateDirectory(_root);
    }

    public async Task<string> UploadAsync(string keyPrefix, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default)
    {
        var safeFileName = $"{Guid.NewGuid():N}_{Path.GetFileName(fileName)}";
        var relative = Path.Combine(NormalizeRelative(keyPrefix), safeFileName);
        var absolute = ResolveInsideRoot(relative);
        Directory.CreateDirectory(Path.GetDirectoryName(absolute)!);

        await using var fs = File.Create(absolute);
        await content.CopyToAsync(fs, cancellationToken);
        return relative.Replace('\\', '/');
    }

    public Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var absolute = ResolveInsideRoot(storagePath);
        if (!File.Exists(absolute))
            throw new FileNotFoundException("Storage file not found.", storagePath);
        Stream stream = File.OpenRead(absolute);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var absolute = ResolveInsideRoot(storagePath);
        if (File.Exists(absolute)) File.Delete(absolute);
        return Task.CompletedTask;
    }

    // --- Path safety ---------------------------------------------------------
    // Strip leading slashes (so '/static/foo.jpg' becomes 'static/foo.jpg' — without
    // this Path.Combine on Linux treats a leading '/' as absolute and we escape
    // the storage root), reject .. segments, and require the resolved path to sit
    // inside _root. Anything else throws to make callers handle the miss explicitly.
    private static string NormalizeRelative(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        var p = path.Replace('\\', '/').Trim();
        while (p.StartsWith("/")) p = p[1..];
        var segments = p.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Any(s => s == ".." || s == "."))
            throw new InvalidOperationException("Path traversal not allowed.");
        return string.Join('/', segments);
    }

    private string ResolveInsideRoot(string storagePath)
    {
        var rel = NormalizeRelative(storagePath);
        var absolute = Path.GetFullPath(Path.Combine(_root, rel));
        var rootFull = Path.GetFullPath(_root);
        if (!absolute.StartsWith(rootFull, StringComparison.Ordinal))
            throw new InvalidOperationException("Resolved path escaped storage root.");
        return absolute;
    }
}
