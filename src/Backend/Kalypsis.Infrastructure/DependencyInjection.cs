using Kalypsis.Application.Abstractions;
using Kalypsis.Infrastructure.Auth;
using Kalypsis.Infrastructure.Billing;
using Kalypsis.Infrastructure.Carriers;
using Kalypsis.Infrastructure.Commissions;
using Kalypsis.Infrastructure.Integrations;
using Kalypsis.Infrastructure.Pdf;
using Kalypsis.Infrastructure.Persistence;
using Kalypsis.Infrastructure.Reports;
using Kalypsis.Infrastructure.Scheduling;
using Kalypsis.Infrastructure.Services;
using Kalypsis.Infrastructure.Sms;
using Kalypsis.Infrastructure.Storage;
using Kalypsis.Infrastructure.Workflows;
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
        services.AddSingleton<IFileSafetyService, Kalypsis.Infrastructure.Storage.FileSafetyService>();
        // ClamAV is opt-in: when Clamav:Host is set in Coolify env vars, the
        // sidecar daemon is reached over the docker network and INSTREAM-scans
        // every upload. Until then, the noop scanner returns "clean" — magic
        // -byte safety in FileSafetyService still runs either way.
        if (!string.IsNullOrWhiteSpace(configuration["Clamav:Host"]))
        {
            services.AddSingleton<IAntivirusScanner, Kalypsis.Infrastructure.Storage.ClamAvScanner>();
        }
        else
        {
            services.AddSingleton<IAntivirusScanner, Kalypsis.Infrastructure.Storage.NoopAntivirusScanner>();
        }
        services.AddSingleton<IInvoicePdfRenderer, InvoicePdfRenderer>();

        services.AddHttpClient("brevo");
        services.AddScoped<IEmailSender, BrevoEmailSender>();
        services.AddScoped<ISmsSender, DevSmsSender>();
        services.AddSingleton<ITotpService, TotpService>();

        services.AddHostedService<PolicyRenewalReminderJob>();
        services.AddHostedService<MarketingCampaignScheduler>();
        services.AddHostedService<ProducerMonthlySnapshotJob>();

        // Auto-backup: polls TenantBackupPolicies hourly, creates snapshots
        // when due, prunes older auto backups beyond retention count.
        services.AddScoped<Kalypsis.Application.Abstractions.ITenantBackupService,
            Kalypsis.Infrastructure.Scheduling.TenantBackupService>();
        services.AddHostedService<Kalypsis.Infrastructure.Scheduling.AutoBackupJob>();

        // === Phase 3: pluggable integration surface ==========================
        // Every carrier we already seed in InsuranceCompanies gets a stub adapter.
        // Real adapters are dropped into Kalypsis.Carriers.{Code} and registered here.
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("INTERAMERICAN", "Interamerican"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("ETHNIKI",      "Εθνική Ασφαλιστική"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("EUROLIFE",     "Eurolife FFH"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("ERGO",         "ERGO"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("ALLIANZ",      "Allianz"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("NN",           "NN Hellas"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("GENERALI",     "Generali"));
        services.AddSingleton<ICarrierAdapter>(_ => new StubCarrierAdapter("INTERLIFE",    "Interlife"));
        services.AddSingleton<ICarrierAdapterRegistry, CarrierAdapterRegistry>();

        services.AddScoped<IMyDataClient, StubMyDataClient>();
        services.AddScoped<IBankStatementParser, StubBankStatementParser>();
        services.AddScoped<IPaymentReconciler, PaymentReconciler>();
        services.AddScoped<ICommissionSplitter, CommissionSplitter>();
        services.AddScoped<IOcrService, StubOcrService>();
        services.AddScoped<IFileScanner, StubFileScanner>();
        services.AddScoped<IMailboxSyncer, StubMailboxSyncer>();
        services.AddScoped<ITelephonyAdapter, StubTelephonyAdapter>();
        services.AddScoped<IAudioTranscriber, StubAudioTranscriber>();
        services.AddScoped<IAiService, StubAiService>();
        services.AddScoped<ISubscriptionBilling, StubSubscriptionBilling>();
        services.AddScoped<IWorkflowEngine, WorkflowEngine>();
        services.AddScoped<IReportRunner, ReportRunner>();

        // === Phase 4: Datawise / WebInsurer parity ============================
        services.AddSingleton<IPlateLookupService, StubPlateLookupService>();
        services.AddSingleton<IPaymentNoticeCodeGenerator, StubPaymentNoticeCodeGenerator>();
        services.AddScoped<IPlafondService, PlafondService>();
        services.AddScoped<IQuoteDelivery, QuoteDelivery>();
        services.AddScoped<IViberSender, StubViberSender>();

        services.AddSingleton<IOnlinePaymentGateway, StubEposPiraeus>();
        services.AddSingleton<IOnlinePaymentGateway, StubEposNbg>();
        services.AddSingleton<IOnlinePaymentGateway, StubEposAlpha>();
        services.AddSingleton<IOnlinePaymentGateway, StubEposEurobank>();
        services.AddSingleton<IOnlinePaymentGateway, StubEpay>();
        services.AddSingleton<IOnlinePaymentGateway, StubDias>();
        services.AddSingleton<IOnlinePaymentGateway, StubVivaWallet>();
        services.AddSingleton<IOnlinePaymentGateway, StubStripeCard>();
        services.AddSingleton<IOnlinePaymentGatewayRegistry, OnlinePaymentGatewayRegistry>();

        services.AddSingleton<IBackofficeBridgeAdapter, StubBlueByteBridge>();
        services.AddSingleton<IBackofficeBridgeAdapter, StubAlisBridge>();
        services.AddSingleton<IBackofficeBridgeAdapter, StubOneSoftBridge>();
        services.AddSingleton<IBackofficeBridgeRegistry, BackofficeBridgeRegistry>();

        // === Phase 5: Modular packaging ======================================
        services.AddScoped<IPackageService, Kalypsis.Infrastructure.Packaging.PackageService>();

        return services;
    }
}
