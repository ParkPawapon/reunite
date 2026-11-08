# Development

Use Node 24.18.0 and Bun 1.3.14. Run all commands from the repository root, including on Windows PowerShell. Bun workspace filters target the named Next package; CLI scripts run TypeScript through Node + tsx with the server condition, not Bun's server runtime.

```sh
bun install --frozen-lockfile
bun run env:setup
docker compose up -d postgres
bun run db:migrate
bun run dev
```

No registration endpoint is provided. To provision a development account, set shell variables yourself, then run `bun run db:create-user --development-only`. Passwords must be 12–128 characters. Never put real passwords in source code or command arguments.

PowerShell:

```powershell
$env:PROVISION_NAME = 'Local tester'
$env:PROVISION_EMAIL = 'tester@example.test'
$securePassword = Read-Host 'Development password' -AsSecureString
$env:PROVISION_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
bun run db:create-user --development-only
Remove-Item Env:PROVISION_PASSWORD
```

POSIX shells:

```sh
export PROVISION_NAME='Local tester' PROVISION_EMAIL='tester@example.test'
read -rs PROVISION_PASSWORD
export PROVISION_PASSWORD
bun run db:create-user --development-only
unset PROVISION_PASSWORD
```

The CLI refuses production NODE_ENV, requires the explicit development flag and stores an Argon2id hash. Repeated provisioning of the same email fails safely. Catalogs remain empty until an authorized operator inserts approved category/location data with parameterized SQL. Test-only categories/locations exist only inside integration schemas.

## Local login account and development dataset

After migrations, run from the repository root:

```sh
bun run db:seed --development-only
```

This creates one interactive development account, `demo@reunite.test`, with a randomly generated password, plus a non-interactive peer fixture account (`peer@reunite.test`) and an idempotent local dataset across `categories` (5 rows), `locations` (5 rows), `item_reports` (6 rows across `LOST`/`FOUND` and `OPEN`/`RESOLVED`/`CLOSED`), and `claims` (3 rows: 2 owned by `demo@reunite.test` and 1 owned by `peer@reunite.test`). Read the login credentials from the local file `tmp/local-seed/login-account.json`, then use the email/password form at `http://localhost:3000/login` or `POST /api/v1/auth/login`. Successful login opens `/dashboard` through the existing real session API.

The seed requires a non-production environment, the explicit development flag, loopback PostgreSQL and application URLs, and no database URL query overrides. It runs inside one PostgreSQL transaction and stores Argon2id hashes in PostgreSQL. The credential file is excluded from Git and Docker and the CLI does not print its password. Keep the file private; do not paste its contents into PRs or CI settings.

Rerunning the command reuses the same credential file, accounts, and dataset rows without duplicating records. It preserves existing account fields and password hashes, including under concurrent database inserts. If an existing email has different credentials, it stops without resetting that account. The one-off `db:create-user` command remains available for separately chosen development accounts.

This command is manual development tooling, not an application startup step or a production seed. Tests exercise it in disposable schemas in the separate test database.

## Tests and local verification

For tests, create `lost_found_test` with your local PostgreSQL operator account (for Compose, `docker compose exec postgres createdb -U app_user lost_found_test` with the default user), then configure `TEST_DATABASE_URL` in ignored `.env.test` using the matching root password. See DATABASE.md for test-target safeguards.

```sh
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
bun run start
```

For raw API requests, include `Origin: http://localhost:3000` on mutations and use a cookie jar. Login requires `Content-Type: application/json`. Browser login over HTTP uses `dev`; production `start` intentionally issues Secure cookies.

For database upgrades, run migrations before deploying the new app. 0004 adds timestamps, canonical email/nonblank constraints and query-aligned indexes without modifying 0001–0003. If old data has blank required fields or email collisions after trimming/lowercasing, the migration rolls back; an authorized operator must resolve those records and retry. It does not discard data to make validation pass. See DATABASE.md for the index plan benchmark and timestamp backfill semantics.

Authentication housekeeping: `bun run db:cleanup-auth` previews one bounded batch; append `--apply` to delete only expired sessions and expired 15-minute login windows. Repeat explicitly if needed. Choose scheduling and business-data retention separately.

Run `bun run db:migrate` before starting this revision: `0005` adds nullable student/profile fields and private bounded avatar storage; `0006` adds account notifications. Existing login credentials and sessions are preserved. After login, use `/profile` or the account menu to edit personal data and upload a still JPG/PNG/WebP (2 MiB maximum). Notifications show real profile/photo changes; the normal database is not seeded with demonstration alerts. The database has nine physical tables.

The standalone build explicitly traces sharp's native companion libraries from Bun's isolated dependency layout. This is necessary for the Windows DLLs and also includes the installed platform's Linux libraries. Keep this tracing rule when updating Bun/Next/sharp. Build and run the standalone server when checking uploads; passing an in-process image unit test alone does not validate deployment packaging. Browser checks use the separate disposable test database, not local student data.

Troubleshooting: connection refused means start the DB/check the host port; readiness 503 means DB connection/query failed; authentication 401 means provision/login/check cookie expiry; mutation 403 means Origin does not match APP_BASE_URL; 429 means the account fixed-window login budget was exhausted. If build fonts fail, verify access to Google Fonts at build time; browser clients use self-hosted output. Do not disable font requirements to hide an offline failure. Frozen install failure requires a deliberate manifest/lockfile update, not a second package manager.

On Windows, stop `bun run start` before rebuilding: a running standalone server holds the native Argon2 DLL open, so replacing its output can fail with EPERM. Stop the process and rerun the build; do not remove the native dependency or relax checks.
