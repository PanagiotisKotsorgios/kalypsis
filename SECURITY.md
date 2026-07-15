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
| `DataProtection__MasterKey`                  | ≥ 32 chars, CSPRNG-generated. Master key for AES-256-GCM column encryption. **Losing it = losing every encrypted column.** |
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

## Application-level encryption at rest

Sensitive columns are encrypted at the EF layer with **AES-256-GCM** (via
`SensitiveDataEncryptor`). The master key comes from the Coolify env var
`DataProtection__MasterKey` and gets derived per-purpose through HKDF-SHA256
— **no persistent volume needed, no on-disk keyring**.

### Affected columns

- **Customer PII** — `Amka`, `IdNumber`, `PassportNumber`, `DriverLicenseNumber`
- **Financial identifiers** — `BankConnection.Iban`, `BankStatementLine.CounterpartyIban`,
  `Bank.AccountIban`, `Garage.Iban`
- **Third-party integration secrets** — `CarrierConnection.ClientSecretEncrypted`,
  `MailboxConnection.{AccessToken,RefreshToken,ImapPassword}Encrypted`,
  `TelephonyConnection.{AccountSid,AuthToken}Encrypted`,
  `BackofficeBridgeConnection.SecretEncrypted`

Ciphertext envelope: `kx1:` + base64(nonce(12) ‖ tag(16) ‖ ciphertext). The
prefix lets the read path distinguish encrypted values from legacy plaintext
(older rows written before this feature shipped keep working — they self-heal
to encrypted on the next write).

### Backup story

You only need to back up **two things** to restore a Kalypsis production
instance:

1. The **MySQL data volume** (`mysql_data_v2`) — encrypted ciphertext rows
2. The **Coolify app config export** (Menu → «Configuration» → export) —
   contains `DataProtection__MasterKey` alongside every other env var

A DB dump alone is **useless to an attacker** without the master key. That's
the whole point of moving away from a volume-based keyring: even if someone
walks off with `mysqldump` output, they can't decrypt anything.

### Setting the master key on a fresh Coolify install

1. Generate the key:
   ```bash
   openssl rand -base64 48
   ```
2. Coolify → your app → **Environment Variables** → add
   `DATA_PROTECTION_MASTER_KEY=<the-generated-value>`.
3. Deploy. The API refuses to boot in production if this is missing, ≤ 32
   chars, or looks like a placeholder (`change-me`, `xxxx`, `placeholder`, …).

### Rotating the master key

Rotation requires re-encrypting existing rows because the derived AES key
changes when the master changes. The safe procedure:

1. **Keep the OLD key handy** — you can only decrypt existing ciphertext with it.
2. Set a NEW `DATA_PROTECTION_MASTER_KEY` and redeploy.
3. **Re-encrypt loop**: touch every encrypted row (update-in-place). The
   converter reads with the new key first; if that fails (because the row was
   still encrypted under the old key), the value shows as ciphertext.

Until re-encryption support ships as an automated command, plan rotations
during a maintenance window. Rotate ONLY if the current key is suspected to
have leaked — not as routine hygiene. `Jwt__Secret` rotates every 6-12 months;
this one you leave alone unless something goes wrong.

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

## Data breach registry (GDPR Art. 33)

`PlatformAdmin → Παραβιάσεις Δεδομένων` (`/app/platform/breach-incidents`) is
the internal register mandated by Article 33. Every suspected or confirmed
personal-data breach must land there **as soon as it becomes known** — that
timestamp starts the 72-hour clock for notifying the ΑΠΔΠΧ.

Workflow:
1. Create the incident (severity, scope, nature, categories, subject-count
   estimate, mitigations). The `IncidentCode` `BR-XXXXXX` is what you quote
   to the authority.
2. Hit **Ειδοποίηση γραφείων** — the API sends email + in-app notification
   to every `AgencyAdmin` in the affected tenants (or all tenants when
   scope = `AllTenants`) and stamps `TenantsNotifiedAt`. Idempotent.
3. When you file with the ΑΠΔΠΧ (portal or email), edit the incident and
   set `AuthorityNotifiedAt` + `AuthorityReference`. Rows past 72h without
   this stamp turn red in the list — your visual overdue signal.
4. Once contained and root-caused, use **Κλείσιμο** with a short note.

## Retention cleanup

`RetentionCleanupJob` runs every 24 hours (first run 5 min after boot) and
prunes:

- `AuditLog` rows older than **12 months** (matches the Privacy policy)
- `Notification` rows older than **6 months** where `ReadAt IS NOT NULL`
- `CommunicationLog` rows older than **24 months**

Batched at 500 rows per transaction so it can't lock the DB. Failures per
category are logged and skipped, not fatal. To pause the job, remove the
`AddHostedService<RetentionCleanupJob>` line in
`Infrastructure/DependencyInjection.cs`.

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
