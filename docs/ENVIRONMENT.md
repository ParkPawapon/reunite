# Environment

`bun run env:check` validates server and DB configuration without connecting. It prints invalid field names rather than supplied values. CI runs this check before migrations.

Run `bun run env:setup` after install. It creates root `.env` from the example with a random hex password, then copies the same configuration into `apps/web/.env.local` only if each target is absent. Existing files are never overwritten. Root scripts/Compose use `.env`; local Next uses `.env.local`. Keep both in sync when changing DB settings. Examples are tracked; actual env files, test configuration, logs and credentials are ignored in Git and Docker context.

| Variable                                              | Meaning / default                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                                          | Required PostgreSQL connection string for host-local scripts/web                                         |
| APP_BASE_URL                                          | Required HTTP(S) origin (no path/query/credentials); exact mutation Origin allowlist                     |
| NEXT_PUBLIC_APP_NAME                                  | Non-sensitive build-time display name, `Lost & Found`                                                    |
| LOG_LEVEL                                             | `info`, `error`, or `silent`; default info                                                               |
| PORT                                                  | Next HTTP port; local/container default 3000                                                             |
| DB_POOL_MAX                                           | Integer 1–50, default 10                                                                                 |
| DB_SSL                                                | `disable` locally or `verify-full` for TLS; default disable                                              |
| DB_SSL_CA                                             | Optional PEM certificate, accepts literal `\n`; certificate verification remains enabled                 |
| SESSION_COOKIE_NAME                                   | Default `lost_found_session`, validated cookie name; optional `__Host-` prefix requires production HTTPS |
| SESSION_TTL_DAYS                                      | Integer 1–30, default 7                                                                                  |
| NODE_ENV                                              | Next sets dev/production; tests use test; production makes cookies Secure                                |
| POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD       | Compose DB initialization only; random local password from setup                                         |
| POSTGRES_HOST_PORT                                    | Loopback host binding; default 5432                                                                      |
| TEST_DATABASE_URL                                     | Required only for integration suite; distinct `_test` DB                                                 |
| PROVISION_NAME / PROVISION_EMAIL / PROVISION_PASSWORD | Development provisioning shell inputs; never commit                                                      |

`DATABASE_URL` is validated lazily on first server DB use, so a production build needs no DB credentials or network database. `APP_BASE_URL`/session configuration is validated when authentication/mutations need it. Failures log/return sanitized errors; CLI/environment diagnostics never print the URL or supplied credentials. Database TLS query parameters are rejected in URLs: use `DB_SSL`/`DB_SSL_CA` to prevent pg URL parsing from overriding explicit certificate verification.

Host-local Next/scripts connect to `localhost:POSTGRES_HOST_PORT`. Containers use Compose DNS `postgres:5432`; the web/migrate service constructs that URL explicitly and does not pass the host-local URL through. Generated passwords are URL-safe hex. If manually choosing values, URI-encode reserved characters in the URL. Compose interpolates user/password into its URL, so use URI-safe credentials there or adapt the URL via a deployment override. Avoid printing resolved Compose configuration in shared logs; use `docker compose config --quiet`.

The display name is inlined at build, including Docker `NEXT_PUBLIC_APP_NAME` build argument. Server secrets are runtime-only; do not pass them as build args. Docker production cookies require an HTTPS origin/reverse proxy; local Next development uses HttpOnly/SameSite cookies without Secure. Set provider-required TLS and an HTTPS origin in production. The local Compose DB setup is not a production identity/privilege configuration.
