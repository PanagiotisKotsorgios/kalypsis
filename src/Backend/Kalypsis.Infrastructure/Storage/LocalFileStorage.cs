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
        var relative = Path.Combine(keyPrefix.Replace("..", string.Empty), safeFileName);
        var absolute = Path.Combine(_root, relative);
        Directory.CreateDirectory(Path.GetDirectoryName(absolute)!);

        await using var fs = File.Create(absolute);
        await content.CopyToAsync(fs, cancellationToken);
        return relative.Replace('\\', '/');
    }

    public Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var absolute = Path.Combine(_root, storagePath);
        Stream stream = File.OpenRead(absolute);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        var absolute = Path.Combine(_root, storagePath);
        if (File.Exists(absolute)) File.Delete(absolute);
        return Task.CompletedTask;
    }
}
