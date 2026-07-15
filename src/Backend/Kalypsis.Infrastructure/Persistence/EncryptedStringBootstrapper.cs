using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Kalypsis.Infrastructure.Persistence;

/// <summary>
/// Παίρνει το master key από <c>DataProtection:MasterKey</c> στο configuration
/// (=Coolify env var <c>DataProtection__MasterKey</c>), κατασκευάζει ένα
/// <see cref="SensitiveDataEncryptor"/> και το δίνει στον static
/// <see cref="EncryptedStringConverter"/>.
///
/// Καλείται μία φορά μετά το <c>app.Build()</c> στο Program.cs — ΠΡΙΝ τον
/// πρώτο DbContext access — ώστε οι EF converters να έχουν έγκυρο κλειδί.
///
/// Development fallback: αν λείπει το env var σε Development, γεννιέται
/// ephemeral κλειδί (rebuild ανά container start) με warning. Σε Production
/// το Program.cs ήδη κάνει hard refuse-to-boot, οπότε εδώ δεν φτάνουμε ποτέ
/// με κενό key.
/// </summary>
public sealed class EncryptedStringBootstrapper
{
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;
    private readonly ILogger<EncryptedStringBootstrapper> _logger;

    public EncryptedStringBootstrapper(
        IConfiguration config,
        IHostEnvironment env,
        ILogger<EncryptedStringBootstrapper> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;
    }

    public void Initialize()
    {
        var master = _config["DataProtection:MasterKey"];
        if (string.IsNullOrWhiteSpace(master))
        {
            if (_env.IsDevelopment())
            {
                master = "kalypsis-dev-ephemeral-master-key-DO-NOT-USE-IN-PRODUCTION";
                _logger.LogWarning(
                    "DataProtection:MasterKey unset — using ephemeral development key. " +
                    "Any data encrypted with this key will be UNREADABLE by production " +
                    "instances that use the real Coolify env var.");
            }
            else
            {
                throw new InvalidOperationException(
                    "DataProtection:MasterKey is required in non-development environments.");
            }
        }
        var encryptor = SensitiveDataEncryptor.FromMasterKey(master);
        EncryptedStringConverter.Bootstrap(encryptor);
        _logger.LogInformation("EncryptedStringConverter primed (AES-256-GCM, master key derived via HKDF).");
    }
}
