using System.Reflection;
using FluentValidation;
using Kalypsis.Application.Behaviors;
using Kalypsis.Application.Common;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace Kalypsis.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);
            cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(assembly);

        services.AddScoped<FileUploadGate>();

        return services;
    }
}
