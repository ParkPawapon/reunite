# Deployment

## Vercel + Supabase

Deploy `apps/web` as one Next.js project on Vercel. The App Router serves both the UI and `/api/v1`, so browser requests and session cookies stay on the same HTTPS origin. PostgreSQL on Supabase is accessed from the server with `pg` and the existing SQL migrations. Images are normalized before storage in PostgreSQL and count toward its space quota.

Vercel Hobby is for personal, non-commercial use. Supabase Free includes 500 MB of database space, can pause after a week of inactivity, and does not include automatic backups. This setup is sized for a school demo or small pilot. Check current quotas and plan terms before release. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Supabase plans](https://supabase.com/pricing)

### PostgreSQL first

1. Create a dedicated Supabase project. Choose Singapore to match the Vercel Function region. Disable the Data API and automatic table exposure. Reunite uses its own API and authentication. [Supabase Data API settings](https://supabase.com/docs/guides/api/securing-your-api)
2. Use the migration role with Supavisor **session mode** on port `5432` or a direct connection. The migration runner uses a session-level advisory lock. In a release shell, set `DATABASE_URL` from the Connect panel, omitting URL SSL options, and set `DB_SSL=verify-full`. Set `DB_SSL_CA` when the endpoint requires a custom trust root. Run `bun run db:migrate` and `bun run db:migrate:status`. Keep these commands separate from the Vercel build. [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
3. In a verified TLS `psql` session as the migration owner, run `CREATE ROLE reunite_runtime LOGIN;`, set its password with `\password reunite_runtime`, then apply [runtime-grants.sql](../infra/supabase/runtime-grants.sql). Reapply or update those grants when a migration introduces a new runtime object. Use the `reunite_runtime.<project-ref>` username and the **transaction mode** pooler on port `6543` for Vercel. Copy the endpoint from Connect and URL-encode reserved characters in the password. Repository queries omit named prepared statements. [Supavisor and prepared statements](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL)
4. Import only approved category and campus location data using the release operator before opening access. To provision an account, set `NODE_ENV=production`, the final HTTPS `APP_BASE_URL`, and the existing `PROVISION_NAME`, `PROVISION_EMAIL` and `PROVISION_PASSWORD` inputs privately in the release shell. With the operator database connection and `DB_SSL=verify-full`, run `bun run db:create-user --production`. Remove the provisioning inputs from the shell afterward. Use a new password per account. The development seed is for local fixtures.

### Vercel project

Import `ParkPawapon/reunite` from `main` with **Next.js**, Root Directory **`apps/web`**, **Include source files outside of the Root Directory** enabled, and **Node.js 24.x**. The checked-in `apps/web/vercel.json` sets Bun's frozen install, the Next build and `sin1` for Functions. Allow Bun to find the root workspaces and lockfile. Keep the repo's existing branch protection and check the deployment's commit against the intended release. [Vercel monorepos](https://vercel.com/docs/monorepos) · [Vercel Function regions](https://vercel.com/docs/functions/configuring-functions/region)

Set these values in the **Production** environment:

| Variable              | Value                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `APP_BASE_URL`        | Final production origin, e.g. `https://example.vercel.app`. Open that same URL for login and mutations. |
| `DATABASE_URL`        | Supavisor transaction pooler URL for `reunite_runtime`. Mark it sensitive.                              |
| `DB_SSL`              | `verify-full`                                                                                           |
| `DB_SSL_CA`           | Endpoint CA PEM when a custom trust root is required.                                                   |
| `DB_POOL_MAX`         | `2` initially. Observe Supabase connections before increasing it.                                       |
| `SESSION_COOKIE_NAME` | `__Host-reunite_session`                                                                                |
| `MATCHING_ENABLED`    | `false`                                                                                                 |
| `MATCHING_BUDGET_USD` | `0`                                                                                                     |

Keep Production secrets out of Preview. A functional preview needs a separate database and an `APP_BASE_URL` matching its own tested HTTPS origin. On Production, verify `GET /api/v1/health/live` and `/api/v1/health/ready`, then log in with a provisioned account. Check the protected dashboard, category/location lists, profile, report creation and image readback, claim ownership, and logout. Item-photo inputs are capped at 4 MiB to fit the Vercel Function payload limit and are stored as WebP up to 1 MiB. Check database size and backup/restore procedures before allowing real student data. [Vercel Function limits](https://vercel.com/docs/functions/limitations)

## Docker

The Dockerfile pins Bun 1.3.14 and Node 24.18.0 Debian images, installs from the frozen lockfile, builds standalone with monorepo tracing and copies static/public assets into `apps/web` beneath the runtime root. The final image runs `node apps/web/server.js` as non-root `node`, binds port 3000 and checks liveness with Node fetch. It contains no migration startup hook or embedded runtime credentials.

Local full-container flow:

```sh
bun run env:setup
docker compose config --quiet
docker compose up -d postgres
docker compose run --rm migrate
docker compose up --build -d web
docker compose logs -f web
docker compose down
```

Compose binds web/DB to loopback only. PostgreSQL 18.4 uses a named volume mounted at `/var/lib/postgresql`, matching the 18+ image layout. `down` preserves it. Do not use volume removal against data you need. The migrate profile uses the same pinned dependency image and read-only local migration/source mount. For a remote deploy, execute migrations as a separately authorized release step from the source checkout/artifact, then roll out the runtime image.

`GET /api/v1/health/live` is process liveness; `/health/ready` returns 503 if DB cannot be queried within pool/query bounds. A healthy process does not imply migrations were applied. Readiness does not reveal connection strings or table details. Web waits for Compose's DB healthcheck but does not assume health means schema availability.

Before public deployment: configure a trusted HTTPS reverse proxy and APP_BASE_URL; production cookies are Secure. Configure TLS to a hosted DB with `DB_SSL=verify-full` and a trusted CA when required. Use separate least-privilege runtime and migration roles; Compose's POSTGRES_USER is a development/bootstrap superuser, not a recommended production application credential. Supply secrets through runtime environment/secret management, never build args. Confirm database backup, restore and forward-fix migration procedures, privacy/retention, edge abuse controls and operational monitoring. See SECURITY.md and DECISIONS.md.

CI is configured to build a Linux image and check non-root runtime liveness and database readiness using the Linux runner's host network to reach the PostgreSQL service. Database/API integration tests also run against that real service. Local verification status and any Docker engine blocker are recorded in VERIFICATION.md. CI configuration is not evidence of a completed hosted CI run.
