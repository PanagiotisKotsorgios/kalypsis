# Kalypsis — Insurance Platform SaaS

Multi-tenant insurance agency platform. Phase 1 ships a Client Portal MVP; the architecture
and domain model are designed up-front to accommodate the full agency management system
(Producer Portal, Commission, Claims, Renewals, Integrations Hub).

## Stack

- **Backend** — ASP.NET Core (net10.0 targeting), Clean Architecture, CQRS via MediatR,
  EF Core 9 + Pomelo MySQL provider, JWT auth, BCrypt password hashing, FluentValidation.
- **Frontend** — React 18 + TypeScript + Vite, Material UI 6, React Router, TanStack Query,
  axios, react-i18next (Greek primary, English secondary).
- **Database** — MySQL 8 (configurable server version).
- **Storage** — Local filesystem (development) behind an `IFileStorage` abstraction;
  swap-in MinIO / S3 for production.

## Solution layout

```
src/
  Backend/
    Kalypsis.Api/             ASP.NET Core host (controllers, JWT, CORS, Swagger)
    Kalypsis.Application/     CQRS handlers, abstractions, validation
    Kalypsis.Domain/          Entities, enums, base types  (zero dependencies)
    Kalypsis.Infrastructure/  EF Core DbContext, configurations, auth, storage
  Frontend/
    web/                      React + Vite client
```

## Prerequisites

- .NET 10 SDK (a .NET 9 runtime is also fine — projects target net10.0 but pin EF Core 9)
- Node.js 20+ and npm
- MySQL 8 running locally on port 3306 (or update the connection string)

## Backend — first run

1. Create the database:

   ```sql
   CREATE DATABASE kalypsis_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Adjust `src/Backend/Kalypsis.Api/appsettings.Development.json` if your MySQL user / password
   are not `root` / empty.

3. Apply the migration:

   ```powershell
   dotnet ef database update `
     --project src\Backend\Kalypsis.Infrastructure\Kalypsis.Infrastructure.csproj `
     --startup-project src\Backend\Kalypsis.Api\Kalypsis.Api.csproj
   ```

4. Run the API:

   ```powershell
   dotnet run --project src\Backend\Kalypsis.Api\Kalypsis.Api.csproj
   ```

   Health check: `GET http://localhost:5000/api/health`
   Swagger UI: `http://localhost:5000/swagger`

> The JWT secret in `appsettings.Development.json` is for development only. Set
> `Jwt:Secret` (32+ chars) via user secrets or environment variables in any shared environment.

## Frontend — first run

```powershell
cd src\Frontend\web
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api/*` to the backend on port 5000.

The login screen currently issues a mock JWT and infers the role from the email substring
(`platform...@`, `admin...@`, `employee...@`, `producer...@`, otherwise customer) so each
dashboard shell is reachable for review. Real authentication wires up in Checkpoint 3.

## Roles & dashboards

| Role               | Label (EL)               | Dashboard shell |
|--------------------|--------------------------|-----------------|
| `PlatformAdmin`    | Διαχειριστής Πλατφόρμας  | Tenants, users, reports |
| `PlatformEmployee` | Υπάλληλος Πλατφόρμας     | Tenants, reports |
| `AgencyAdmin`      | Διαχειριστής Γραφείου    | Customers, policies, documents, users, claims, tasks, producers, reports |
| `AgencyUser`       | Υπάλληλος Γραφείου       | Customers, policies, documents, tasks, claims |
| `Producer`         | Παραγωγός                | Policies, customers, profile |
| `Customer`         | Πελάτης                  | Policies, documents, notifications, profile (Client Portal MVP) |

## Internationalization

`react-i18next` loads `el` (Greek, default) and `en` (English) at boot. The language is
persisted in `localStorage` (`kalypsis_lang`). The `LanguageToggle` component appears on the
login screen and in the top app bar.

## Checkpoints covered so far

- [x] Checkpoint 1 — Solution scaffold, backend + frontend boot
- [x] Checkpoint 2 — Full domain model, EF Core configs, multi-tenant + soft-delete
      query filters, initial migration
- [ ] Checkpoint 3+ — Auth, tenant management, customer/policy CRUD, documents, client
      portal, notifications, security hardening, reporting, future-proofing interfaces
