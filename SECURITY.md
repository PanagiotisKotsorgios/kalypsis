# Kalypsis — Security Operations

Short runbook for the secrets the production API requires, how to rotate them
on Coolify, and the env-var contract for the ClamAV sidecar.

---

## Required production secrets

The API refuses to boot in non-`Development` environments if any of the
following are missing or look like placeholders.

| Env var (Coolify panel)                      | Notes |
|----------------------------------------------|-------|
| `Jwt__Secret`                                | ≥ 48 chars, CSPRNG-generated. Used to sign access tokens. |
| `ConnectionStrings__Default`                 | MySQL connection string with a non-empty `Password=`. |
| `Cors__FrontendOrigin`                       | The HTTPS origin of the SPA (e.g. `https://www.mykalypsis.gr`). Comma-separated for multiple. |
| `Brevo__ApiKey`                              | Recommended (not enforced). Without it, password reset + contact form silently won't email. |
| `Brevo__SenderEmail`                         | The verified Brevo sender (e.g. `info@mykalypsis.gr`). |

Coolify env vars use double underscores (`__`) where `appsettings.json` would
use a colon — they map to the same configuration node.

---

## Rotating the JWT secret

Rotation **invalidates every active session** (access tokens fail signature
verification, refresh tokens still exist in the DB but produce a 401).

1. Generate a new secret:
   ```bash
   openssl rand -base64 48
   ```
2. In Coolify → service → **Environment Variables** → edit `Jwt__Secret`.
3. **Redeploy** the API container.
4. Existing users are forced to log back in. No DB change needed.

Roll the JWT secret if: a token leak is suspected, a developer with access
leaves, or every 6–12 months as routine hygiene.

---

## Rotating the database password

1. On the MySQL instance (managed or self-hosted):
   ```sql
   ALTER USER 'kalypsis'@'%' IDENTIFIED BY '<new strong password>';
   FLUSH PRIVILEGES;
   ```
2. Update `ConnectionStrings__Default` in Coolify with the new password.
3. Redeploy the API. Brief 502 during the bounce.

---

## Rotating the Brevo API key

1. In Brevo dashboard → **SMTP & API** → revoke the old key, create a new one.
2. Update `Brevo__ApiKey` in Coolify.
3. Redeploy. Test by submitting the public contact form.

---

## Deploying the ClamAV antivirus sidecar (optional, recommended)

Until `Clamav__Host` is set, uploads pass through magic-byte safety only and
the AV layer reports every file clean.

### Coolify steps

1. Add a new **service** in your Coolify project: image `clamav/clamav:stable`.
2. No volumes required for the daemon itself; it pulls signatures on first
   start (≈ 250 MB download — give the container at least 1 GB RAM).
3. Wait until `clamd` reports `Self-check completed successfully.` in the logs
   (first start can take 5–10 minutes while it fetches definitions).
4. Note the **internal service name** — Coolify gives the service a DNS name
   on the project network (e.g. `clamav`).
5. In the API service env vars, set:
   ```
   Clamav__Host=clamav
   Clamav__Port=3310
   Clamav__FailClosed=false
   Clamav__TimeoutMs=8000
   Clamav__MaxBytes=26214400
   ```
6. Redeploy the API.

### Fail mode

- `Clamav__FailClosed=false` (default): if the daemon is unreachable, log a
  warning and accept the upload — magic-byte safety still applies. Good for
  graceful degradation.
- `Clamav__FailClosed=true`: refuse any upload when the daemon is unreachable.
  Use only when you're sure the sidecar is reliably running.

### Verifying it works

Upload the EICAR test string (a harmless file every AV detects):

```bash
echo -n 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.com
```

Try uploading `eicar.com` through the policy-document or attachment UI. The
API should return:

```json
{ "code": "file_infected", "message": "Εντοπίστηκε απειλή... (Eicar-Test-Signature)" }
```

---

## Incident response checklist

If you suspect a session token has leaked:

1. **Rotate `Jwt__Secret`** (see above) — kills every existing access token in
   one go.
2. Optionally, `DELETE FROM RefreshTokens WHERE UserId = '<uid>'` to force a
   re-login from the user's perspective. The new JWT secret already invalidates
   them, but this cleans the DB.
3. Review `AuditLog` rows where `Category = 'Authentication'` in the affected
   window. Pre-existing per-user lockout already throttles brute force.
4. Reset affected users' passwords. The password-reset flow revokes all their
   refresh tokens automatically (see `RefreshTokenRevoker`).

If you suspect a malicious upload landed before ClamAV was deployed:

1. Run an offline scan against the storage volume (`uploads/`).
2. Delete the offending row from `PolicyDocuments` / `ServiceRequestAttachments`
   and the file from disk.
3. Audit who uploaded it via the `AuditLog`.
