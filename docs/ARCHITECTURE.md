# Kalypsis Insurance Platform — Architecture

> Last updated: 2026-06-17

This document is the engineering / commercial overview of the platform: what's
in the box, how it's wired together, where each piece lives in the repo, and
which parts are live vs. roadmap.

---

## 1. Product summary

Kalypsis is a multi-tenant SaaS for the Greek insurance market that unifies
agency operations in a single browser-based application:

- **CRM** for individual and company customers
- **Contract lifecycle**: issuance, cover notes, renewals, documents,
  branded customer portal with PDF preview / print / "police mode"
- **Producer network**: own portal, 9-level over-commission pyramid, monthly
  commission runs with manual overrides, Excel export
- **Financial circuit**: receipts, payments with commission netting,
  securities (cheques / promissory notes), customer / partner / company
  ledgers, real-time KPIs
- **Greek-market integrations**: ΔΙΑΣ RF codes, KEPYO yearly reports,
  accounting exports, magnetic-media imports, per-carrier bridges
- **Marketing**: campaigns with HTML body and smart audience segments
- **Platform operations**: per-tenant branding (logo, color, contact),
  super-admin tenant impersonation with cross-tenant CRUD and bulk actions,
  audit log of every mutation

Six roles are wired end-to-end (PlatformAdmin, PlatformEmployee, AgencyAdmin,
AgencyUser, Producer, Customer), each with its own dashboard and a granular
permission catalogue (37 codes) the agency admin can grant per employee.

---

## 2. Technology stack

### Backend (`src/Backend/`)

| Layer            | Tech                                                        |
|------------------|-------------------------------------------------------------|
| Runtime          | .NET 10 (`net10.0`)                                         |
| Architecture     | Clean Architecture — Domain / Application / Infrastructure / API |
| Mediation        | MediatR with FluentValidation pipeline behavior             |
| Persistence      | EF Core 9.0.15 + Pomelo MySQL provider                      |
| Auth             | JWT (HS256) + refresh tokens, BCrypt password hashing       |
| File storage     | `IFileStorage` abstraction; `LocalFileStorage` in dev       |
| Email            | Brevo HTTP API (transactional + reset emails)               |
| Validation       | FluentValidation per command/body                           |
| Audit            | Auto-emitted from `AppDbContext.SaveChangesAsync` snapshot  |
| CSV export       | Custom `CsvWriter` (UTF-8 BOM, `;` separator)               |

### Frontend (`src/Frontend/web/`)

| Layer            | Tech                                          |
|------------------|-----------------------------------------------|
| Build            | Vite 5 + TypeScript                           |
| UI               | React 18 + Material-UI 6                      |
| Data fetching    | TanStack Query                                |
| Routing          | React Router 6                                |
| i18n             | react-i18next (Greek primary, English secondary) |
| Charts           | Recharts                                      |
| Forms            | Controlled MUI inputs                         |

### Infrastructure

| Concern          | Setup                                         |
|------------------|-----------------------------------------------|
| Database         | MySQL (Pomelo provider, EF migrations)        |
| Dev orchestration| Two processes: `dotnet run` (API at 5134) + `npm run dev` (Vite at 5173 with proxy) |
| Static uploads   | Local `wwwroot/uploads/` in dev               |
| HTTPS            | Behind a reverse proxy in production          |

---

## 3. Multi-tenant model

The database carries a `TenantEntity` base for every per-agency table.
Two layers enforce isolation:

1. **EF global query filters** (`AppDbContext.OnModelCreating`) auto-rewrite
   every query to `WHERE TenantId = @current AND DeletedAt IS NULL`.
2. **Authorization policies** in `Program.cs` (PlatformAdmin, PlatformLevel,
   AgencyAdmin, AgencyStaff, Producer) restrict controller endpoints.

PlatformAdmin / PlatformEmployee bypass the tenant filter for support, but
can scope themselves into a single tenant via `X-Impersonate-Tenant` —
existing queries Just Work because `ICurrentUser.TenantId` returns the
impersonated id instead of the user's actual one.

Per-employee permissions are an extra layer on top: a `[RequirePermission]`
attribute on controllers reads `User.PermissionsJson` (falling back to role
defaults from `PermissionCatalog`) and returns 403 when missing. The
effective set ships with `/auth/me` so the frontend can feature-gate UI.

---

## 4. Module inventory

22 BlueByte-grade modules are live end-to-end (entities + handlers +
controllers + React pages):

### Customers & Contracts
- Customer CRM, customer portal accounts, customer detail with portal account
- Policy CRUD with renewals + cancellation
- Customer-facing contract detail page (PDF preview, download, print, "police mode")
- New-contract wizard (3-step) posting `ServiceRequest` to the agency
- Cover Notes (CRUD + print)
- Documents per policy + Document Manager (folders)

### Operations
- Appointments + calendar list
- Service Requests with attachments
- Branch designer (parametric branches)
- Delivery tracking
- Tariffs (parametric pricing per company × branch)
- Marketing campaigns (HTML editor + smart segments)

### Commercial / Financial
- Producers (CRUD + portal account issuance)
- Commission rules + monthly **Commission Runs** with filters (company /
  producer / branch / package), manual line override, **9-level
  over-commission application**, finalise → emits PartnerCredit
  FinancialMovements, **Excel/CSV export**
- Receipts, Payments (with netting), Securities (cheques / promissory notes)
- Financial Movements ledger (filtered, charted, with summary)
- Bank Connections, DIAS RF codes, Production Goals + Stats

### Platform-level
- Multi-tenant administration with **tenant impersonation**
- All-users page with bulk actions
- Per-agency logo upload (branded navbar for that tenant's members)
- Audit log
- API keys (HMAC, one-time secret reveal)
- Onboarding wizard (4 steps, fires once per tenant)

### Public site
- Greek-first landing page with real stats (`/api/public/stats`)
- Pricing, Contact, FAQ (26 questions, 7 categories, search)
- Newsletter signup, marketing legal pages, cookie banner
- Login, register, forgot/reset password (Brevo emails)
- Scroll-reveal entrance animations on every section

### Status pages
- "Under Maintenance" launch gate (see §6) for agency users

---

## 5. Repository layout

```
src/
├─ Backend/
│  ├─ Kalypsis.Domain/        # Entities + enums (no dependencies)
│  ├─ Kalypsis.Application/   # CQRS handlers, validators, services
│  ├─ Kalypsis.Infrastructure/# EF DbContext, migrations, file storage
│  └─ Kalypsis.Api/           # ASP.NET Core controllers, Program.cs
├─ Frontend/web/              # Vite + React + TS app
└─ ...
docs/
├─ ARCHITECTURE.md            # This file
├─ LAUNCH_READINESS.md        # Launch checklist + verdict
├─ Kalypsis_Platform_Greek.docx  # Greek sales brochure
└─ generate_brochure.py       # Regenerator script for the brochure
```

---

## 6. Launch gate

For the public launch we ship only the **Customer Portal**. Agency users
(AgencyAdmin, AgencyUser, Producer) land on a branded "Under Maintenance"
screen instead of their dashboards. The backend is untouched — every entity,
every handler, every controller stays live — so flipping the gate off is a
one-line change.

Implementation: `App.tsx` computes `isGated` from the user's role plus the
`VITE_LAUNCH_GATE` env var (default `true`). When gated, `/app/*` renders
`UnderMaintenancePage` instead of `AppLayout`. PlatformAdmin /
PlatformEmployee bypass for support; staff can also flip the gate
client-side with `?staff=1` (persisted in localStorage).

To go fully live: set `VITE_LAUNCH_GATE=false` at deploy time and redeploy
the frontend.

---

## 7. Data flow examples

### Issuing a contract
1. `POST /api/policies` from AgencyStaff with body
2. `CreatePolicyCommandHandler` validates, inserts Policy + emits audit
3. Per-policy commission lines materialise during the monthly run, not
   at issuance

### Running monthly commissions
1. AgencyAdmin opens **Εκκαθαρίσεις Προμηθειών** and triggers
   `POST /api/commission-runs` with optional filters
2. `GenerateCommissionRunCommandHandler` pulls all in-scope policies,
   matches each against `CommissionRule` rows (most-specific wins, default
   10% if nothing matches), then BFS-walks `OverCommissionRule` up to
   9 levels emitting `OVR` lines
3. AgencyAdmin may override any line; recompute totals on save
4. `POST /api/commission-runs/{id}/finalise` locks the run and emits
   one `PartnerCredit` `FinancialMovement` per producer
5. `GET /api/commission-runs/{id}/export.csv` streams a UTF-8 BOM CSV

### Customer-facing contract view
1. Customer logs in (Customer role)
2. `CustomerDashboardPage` shows active policies + recent docs
3. Click contract row → `CustomerContractDetailsPage` fetches `/api/policies/{id}` + `/api/documents?policyId=`
4. View PDF inline (`Dialog` with `iframe` + blob URL), download, print, or
   open Police Mode (fullscreen navy gradient, 96px policy number)

---

## 8. Security posture

- BCrypt (cost 12) for passwords, SHA-256 for refresh / reset tokens, never
  stored in plaintext
- JWT short-lived (1h), refresh tokens 30d, both rotated on use
- Multi-tenant isolation enforced at DB query level (EF query filters)
- Role-based authorization (5 policies) + per-permission `[RequirePermission]`
- Audit log written from `SaveChangesAsync` snapshot — old / new values,
  user id, tenant id, timestamp
- Soft delete everywhere (DeletedAt timestamp); no destructive removals
  without explicit action
- Reset password links use `kal_` prefix + 24-byte hex, SHA-256 hashed
  in DB, one-time use
- File uploads validated by content type and size (4 MB logo, 50 MB
  documents)
- CORS limited to the configured frontend origin
- `Authorize` attribute on every controller; `[AllowAnonymous]` only on
  public stats, newsletter, and the auth endpoints

---

## 9. Observability

Live today:
- Structured logs via `ILoggerFactory` in handlers and services
- Full audit log surfaced at `/app/audit` for PlatformAdmin
- Per-tenant overview at `/api/tenants/{id}/overview` (counts and last
  user login)

Roadmap (documented in `LAUNCH_READINESS.md`):
- Application Performance Monitoring (Application Insights / OpenTelemetry)
- Error reporting (Sentry)
- Uptime monitoring with the real `99,98%` reflected in `/api/public/stats`

---

## 10. Documentation

| File                                  | Purpose                                |
|---------------------------------------|----------------------------------------|
| `docs/ARCHITECTURE.md`                | This document                          |
| `docs/LAUNCH_READINESS.md`            | Pre-launch checklist + go/no-go        |
| `docs/Kalypsis_Platform_Greek.docx`   | Greek-language sales brochure          |
| `docs/generate_brochure.py`           | Script that regenerates the brochure   |
| `CLAUDE.md` (root)                    | Engineering notes for AI pair-programming |
