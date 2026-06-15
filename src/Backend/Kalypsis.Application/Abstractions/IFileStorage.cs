namespace Kalypsis.Application.Abstractions;

public interface IFileStorage
{
    Task<string> UploadAsync(string keyPrefix, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default);
    Task<Stream> DownloadAsync(string storagePath, CancellationToken cancellationToken = default);
    Task DeleteAsync(string storagePath, CancellationToken cancellationToken = default);
}
