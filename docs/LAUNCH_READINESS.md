# Kalypsis — Launch Readiness Assessment

> Snapshot: 2026-06-18

This document is the honest pre-launch checklist: what is genuinely ready,
what is wired but needs operator action before going live, and what should
explicitly be flagged as "post-launch."

The verdict (TL;DR) is at the bottom.

---

## 1. What is ready and shipping in launch mode

### 1.1 Customer Portal (the launch product)
- Customer login + email verification flow via Brevo
- Customer dashboard with active policies + recent docs
- Contract detail page with **PDF preview**, **download**, **print**, and
  **fullscreen "Police Mode"** for roadside checks
- New-contract wizard (3 steps) posting a `ServiceRequest` to the agency
- Per-agency branded logo in the navbar (for the customer's tenant)
- Notifications + service requests + documents listings
- Mobile-first responsive layout, Greek-first UI with English toggle

### 1.2 Public marketing site
- Greek landing page with: hero, partner strip, feature grid, agency /
  agent value props, **real stats** from `/api/public/stats`, FAQ teaser
  with prominent CTA to the dedicated FAQ page, final call-to-action
- Pricing page with 3 tiers + dialed-in hero image
- Contact page with form, sidebar info, dialed-in hero image
- FAQ page (26 questions across 7 categories with search + animations)
- Newsletter signup in the footer (calls `/api/public/newsletter`)
- Scroll-reveal entrance animations across every section
- Cookie banner with persistent dismiss
- Privacy / Terms / Cookies legal pages
- Login, register, forgot-password, reset-password flows

### 1.3 Authentication / accounts
- BCrypt password hashing
- JWT access tokens + rotating refresh tokens
- Forgot-password → reset email (SHA-256 hashed tokens, one-time use)
- "Remember me" toggle that switches between localStorage and sessionStorage
- Per-tenant isolation enforced at the DB query-filter level
- Six roles wired (PlatformAdmin, PlatformEmployee, AgencyAdmin, AgencyUser,
  Producer, Customer)
- Permission catalogue (37 codes) with per-employee grants and
  `[RequirePermission]` backend enforcement

### 1.4 Operations support (kept live behind PlatformAdmin)
- Tenant CRUD and platform-wide user CRUD with bulk actions
- **Tenant impersonation** (`X-Impersonate-Tenant` header switches the
  effective tenant for the entire session)
- Audit log of every mutation, including old/new values
- Per-tenant branding (logo, color, contact, VAT)

---

## 2. What is built but stays under maintenance for non-customer roles

The full agency / producer feature set is implemented, tested in
development, and reachable from the codebase — but the launch gate
hides it from end users behind the `UnderMaintenancePage`. This is a
deliberate phased rollout so we can:

- launch the customer portal independently and iterate on it without
  rolling out the entire workflow stack
- watch real ingest behavior before exposing the financial circuit
- collect agency signups with a "reserved" feel

Modules in this bucket (live in the backend, hidden in the UI for
AgencyAdmin / AgencyUser / Producer):

| Domain          | Modules                                                |
|-----------------|--------------------------------------------------------|
| CRM             | Customer CRUD, customer notes, customer portal mgmt    |
| Contracts       | Policy CRUD, renewal, cancellation, cover notes        |
| Commissions     | Rules, runs, 9-level over-commissions, finalise/export |
| Financials      | Receipts, payments, securities, financial movements    |
| Marketing       | Campaigns, delivery tracking                           |
| Operations      | Appointments, document manager, branch designer       |
| Integrations    | DIAS RF codes, bank connections, company bridges      |
| Reports         | Production stats, goals, financial summary             |
| Producer ops    | Producer dashboard with MTD/YTD commission KPIs        |

Tooling around them (Excel/CSV export, onboarding wizard, scroll-reveal
animations) is also live but hidden.

To enable them at launch+1: set `VITE_LAUNCH_GATE=false` and redeploy
the frontend. Zero backend changes required.

---

## 3. Pre-launch operator checklist

These items MUST be done before flipping the public DNS:

### 3.1 Infrastructure
- [ ] Provision production MySQL with daily automated backups + 30-day
      retention (e.g. AWS RDS / DigitalOcean Managed Database)
- [ ] Provision production app server(s) — Linux + .NET 10 runtime
      (or Docker) + a reverse proxy (Nginx / Caddy) terminating TLS
- [ ] DNS A records → app server, MX → mail provider
- [ ] TLS certificates (Let's Encrypt auto-renewal)
- [ ] CDN in front of the Vite static build (Cloudflare / Bunny)
- [ ] Storage bucket (S3-compatible) — production `IFileStorage` swap
      from `LocalFileStorage`

### 3.2 Configuration
- [ ] Set production `appsettings.Production.json`:
      `ConnectionStrings:Default`, `Jwt:Key` (32+ byte random), `Brevo:ApiKey`,
      `Cors:FrontendOrigin`, `Storage:LocalRoot` or S3 keys
- [ ] Generate a strong superadmin password (override `Seed:PlatformAdminPassword`)
- [ ] Set `VITE_API_BASE_URL` in the frontend prod build env
- [ ] Keep `VITE_LAUNCH_GATE=true` for the customer-only launch
- [ ] Configure email DKIM / SPF / DMARC for the sending domain

### 3.3 Content
- [ ] Real address / phone / hours in `PublicFooter.tsx` (currently a
      placeholder Chalandri address)
- [ ] Confirm the social profile URLs (LinkedIn / Facebook are `#`)
- [ ] Replace test seed insurance companies with real partner agreements
- [ ] Update the brochure with the production go-live date

### 3.4 Compliance & legal
- [ ] Have the lawyer review the Terms / Privacy / Cookies pages and the
      compliance notice in the footer (currently references Law 4583/2018
      and the Bank of Greece)
- [ ] Register the DPO contact and processing register
- [ ] Confirm whether registration of insurance intermediaries with the
      Bank of Greece needs to be cited explicitly anywhere on the public site
- [ ] Cookie consent — verify GA / Hotjar / etc. only fire after consent

### 3.5 Operational readiness
- [ ] Stage a dry-run customer flow: register → verify email → log in
      → see the maintenance / customer portal as appropriate
- [ ] Stage a dry-run forgot-password flow against the production Brevo
      account
- [ ] Stage tenant creation by the superadmin against production
- [ ] Smoke-test the customer portal (PDF view, download, print, police
      mode) on a real mobile device
- [ ] Set up an oncall rotation and an incident channel
- [ ] Document the on-call runbook (where logs are, how to restart, how
      to flip the launch gate)

---

## 4. Post-launch / not-yet-built

These are tracked as "for later" — none of them block the launch, but they
need to be on the next quarter's roadmap:

### 4.1 Operational
- CI/CD pipeline (GitHub Actions: build / typecheck / test on every push,
  deploy on tag)
- `docker-compose.yml` for one-command local startup (currently two terminals)
- Automated end-to-end tests (Playwright) covering the customer portal
- Application Performance Monitoring + error reporting (Sentry,
  Application Insights, or similar)
- Real uptime monitor that feeds the 99.98% figure shown on the landing page

### 4.2 Product
- Real DIAS webhook receiver (currently the RF code + mark-paid flow is
  manual)
- Real KEPYO XML output to AADE format (currently summarises the totals
  but doesn't generate the official XML)
- Direct accounting integrations (BlueByte etc.) — currently we export
  CSV; direct API push is a roadmap item
- 2FA for AgencyAdmin and PlatformAdmin (TOTP + SMS)
- Real-time notifications (SignalR / WebSocket) — currently polled
- WhatsApp / Viber marketing channel
- Native mobile apps for customers and producers (PWA exists; native
  is a separate effort)

### 4.3 Content / data
- Localise to a second EU language beyond English (a customer with
  international clients asked about French)
- Migration tooling from competing Greek systems (currently CSV import
  exists; direct migrators would be a sales accelerator)

---

## 5. Verdict

**Is Kalypsis ready to launch the Customer Portal product?**

**Yes — conditionally.**

The customer-facing flow (register agency → onboard → invite customers →
customers log in → view, download, print and "police-mode" their PDFs →
send service requests back to the agency) is feature-complete, mobile-ready,
Greek-first, branded per agency, and runs against real persisted data. The
agency-side data plane is fully wired in the backend so customer-portal
behavior is real, not stubbed.

**Conditions that must be true before flipping the DNS:**

1. The infrastructure checklist in §3.1 is done (DB backups, TLS, app
   server, file storage swap).
2. The configuration in §3.2 is set (especially `Jwt:Key`,
   `Brevo:ApiKey`, real superadmin password, and a CDN-cached frontend
   with `VITE_LAUNCH_GATE=true`).
3. The legal items in §3.4 have been reviewed by counsel.
4. The dry-runs in §3.5 pass on production.

**What is explicitly NOT launching with v1:**

- AgencyAdmin / AgencyUser / Producer dashboards (gated behind
  `UnderMaintenancePage`)
- The full BlueByte module set on the agency side
- The producer commission portal

These remain in the codebase and the database. They are launched by setting
`VITE_LAUNCH_GATE=false` and redeploying the frontend; the backend doesn't
move at all.

**Recommended launch sequence:**

1. **Soft launch** — invite 5-10 pilot agencies behind the gate. They
   can sign up but see the maintenance screen. Customers of those
   agencies use the portal in production for two weeks.
2. **Public customer portal launch** — open registration. The
   maintenance screen acts as a "reservation" page for agencies.
3. **Agency portal launch (launch+1 month)** — flip the gate. Agency
   dashboards become live for all signed-up agencies on the same day.
4. **Producer portal launch (launch+2 months)** — re-include Producer
   role in the gated set, then open it once Producer onboarding flow is
   polished.

This staging lets us collect real customer-portal data before exposing
the financial circuit, watch ingest patterns, and address any field
issues without simultaneously debugging the agency UX.
