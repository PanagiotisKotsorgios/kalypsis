# Kalypsis.Tests

Backend test suite. xUnit + EF Core InMemory. Run with:

```bash
dotnet test tests/Kalypsis.Tests/Kalypsis.Tests.csproj
```

## What's covered

| File | What it verifies |
| --- | --- |
| `SensitiveDataEncryptorTests.cs` | AES-256-GCM string + blob round-trips, tamper detection, legacy plaintext passthrough (magic byte), HKDF determinism, key isolation. |
| `BookkeepingControllerTests.cs` | AUP terms gate — uploads throw 428 until accepted; file bytes are ciphertext on disk and plaintext on download; tenant A cannot see tenant B's tree; terms accept endpoint persists version + user id + timestamp. |
| `BookkeepingBulkAndMoveTests.cs` | Folder reparent + cycle guard (self and descendant); bulk move / delete / status endpoints; cross-tenant id silently skipped. |
| `ErmesKeysControllerTests.cs` | Meeting-room deterministic per (tenant, thread) + different across tenants; passphrase-wrapped key backup upload / get roundtrip; oversize backup rejected; peer key lookup respects tenant isolation. |

## What's NOT covered (yet)

- End-to-end HTTP integration via `WebApplicationFactory` — the tests here go through controller methods directly. Auth attributes (`[RequiresPackage]`, `[Authorize(Policy = "…")]`) are NOT exercised, only the handler logic behind them.
- ΕΡΜΗΣ envelope round-trip through send + read (would require MediatR wiring + more scaffolding).
- Frontend: no unit tests. Type safety via `tsc --noEmit` is the current baseline.

## Adding a test

Use `TestScaffold.NewDb(currentUser, clock)` for a fresh EF InMemory database. The scaffold also bootstraps `SensitiveDataEncryptor` with a deterministic test key so `EncryptedStringConverter` works transparently.

Isolate DBs per test by leaving `name` unset (random Guid). Share a DB between two contexts (e.g. to test cross-tenant reads) by passing the same `name`.
