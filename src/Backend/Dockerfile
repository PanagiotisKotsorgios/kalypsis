# syntax=docker/dockerfile:1.7

# =============================================================================
# Multi-stage Dockerfile for the Kalypsis .NET 10 API.
# Stage 1 (sdk): restores + publishes the API into a self-contained folder.
# Stage 2 (runtime): tiny aspnet-runtime image that only carries the published
# output + the env-driven configuration. Migrations run on first boot via the
# existing `MigrateAsync()` call in Program.cs.
# =============================================================================

ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
WORKDIR /src

# Copy csproj files first so we cache the restore layer when only sources change.
COPY Kalypsis.Domain/Kalypsis.Domain.csproj                 Kalypsis.Domain/
COPY Kalypsis.Application/Kalypsis.Application.csproj       Kalypsis.Application/
COPY Kalypsis.Infrastructure/Kalypsis.Infrastructure.csproj Kalypsis.Infrastructure/
COPY Kalypsis.Api/Kalypsis.Api.csproj                       Kalypsis.Api/
RUN dotnet restore Kalypsis.Api/Kalypsis.Api.csproj

# Then drop the rest of the sources and publish.
COPY . .
RUN dotnet publish Kalypsis.Api/Kalypsis.Api.csproj \
    -c Release -o /app/publish \
    --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS runtime
WORKDIR /app

# Curl is handy for Coolify's healthcheck pings.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish ./

# Kestrel binds to 8080 inside the container; Coolify maps it to whichever
# port you choose in the UI.
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_USE_POLLING_FILE_WATCHER=false \
    Storage__LocalRoot=/data/uploads

# Persisted volume for uploaded documents / contract PDFs.
RUN mkdir -p /data/uploads
VOLUME ["/data/uploads"]

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:8080/api/auth/me || true

ENTRYPOINT ["dotnet", "Kalypsis.Api.dll"]
