using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Auth;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Services;
using Kalypsis.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Kalypsis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        var serverVersion = configuration["Database:ServerVersion"] is { Length: > 0 } v
            ? ServerVersion.Parse(v)
            : new MySqlServerVersion(new Version(8, 0, 36));

        services.AddDbContext<AppDbContext>(opt =>
            opt.UseMySql(connectionString, serverVersion,
                mysql => mysql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)));

        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services.AddSingleton<IDateTimeProvider, SystemClock>();
        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();

        services.AddHttpClient("brevo");
        services.AddScoped<IEmailSender, BrevoEmailSender>();

        return services;
    }
}
