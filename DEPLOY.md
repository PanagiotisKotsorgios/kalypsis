# Deploying Kalypsis on Coolify

This repo ships with a production-ready Docker Compose stack:

```
mysql (8.4)  ←  api (.NET 10)  ←  web (Vite + nginx)
```

Everything is committed at the repo root — Coolify only needs a few clicks.

## 1. Pick the right Coolify source

In the Coolify dashboard:

**New Resource → Applications → Public Repository**
(or **Private Repository (with GitHub App)** if you make the repo private later)

Use the URL:

```
https://github.com/PanagiotisKotsorgios/kalypsis
```

When Coolify asks for the **build pack**, choose **Docker Compose**.
Set the **compose file** path to `docker-compose.yml` (the default at the
repo root).

Coolify will detect three services (`mysql`, `api`, `web`) and create one
managed app per service automatically.

> Don't pick "Dockerfile" — that's only for single-service deploys, and
> Kalypsis needs all three to talk over the internal docker network.

## 2. Fill in environment variables

In Coolify's **Environment Variables** panel, set the secrets listed in
[`.env.example`](./.env.example). The bare minimum:

| Key                  | Example                              |
| -------------------- | ------------------------------------ |
| `DB_PASSWORD`        | a strong random string               |
| `DB_ROOT_PASSWORD`   | another strong random string         |
| `JWT_SECRET`         | `openssl rand -base64 48`            |
| `PUBLIC_ORIGIN`      | `https://kalypsis.example.com`       |
| `BREVO_API_KEY`      | (optional) Brevo SMTP API key        |

Leave `WEB_PORT=80` unless you have multiple stacks fighting for the same
port — Coolify's reverse proxy will front-route TLS to it.

## 3. Domain + HTTPS

Point your DNS at the Coolify server and assign the domain to the **web**
service. Coolify will request a Let's Encrypt cert automatically.

## 4. First boot

On startup the API runs `MigrateAsync()` against the MySQL container, which
creates all tables and seeds the platform-admin user from `appsettings.json`:

```
Email:    superadmin@kalypsis.gr
Password: Kalypsis@2026!
```

**Change this password immediately** after the first sign-in (Profile →
Change password), or override it before the first deploy by setting
`Seed__PlatformAdminPassword` in Coolify's env.

## 5. Persistent volumes

Two named volumes survive redeploys:

- `mysql_data`  — the database files
- `uploads_data` — uploaded documents / contract PDFs

Coolify will list these under **Storages**.

## 6. Logs & healthchecks

Both Dockerfiles ship a `HEALTHCHECK`, so Coolify shows green/red status
out of the box. Live logs:

- API     → `dotnet`-prefixed JSON lines on stdout
- Web     → standard nginx access/error logs
- MySQL   → standard mysqld output

## 7. Local smoke-test

You don't need Coolify to verify the stack — `docker compose` builds the
whole thing in one command:

```
cp .env.example .env
docker compose up --build
```

Open <http://localhost> for the SPA. The API is internal-only by default
(uncomment the `ports:` block in `docker-compose.yml` to expose it for
debugging).
