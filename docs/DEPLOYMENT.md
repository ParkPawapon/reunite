# Deployment

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
