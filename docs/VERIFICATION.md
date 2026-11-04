# Verification

This file records local executed results, not a hosted CI run. The final implementation report updates the command outcomes after verification.

## Database hardening verification (0004, 2026-11-04)

- `bun install --frozen-lockfile`, `bun run format:check`, `bun run lint`, `bun run typecheck`, and `bun run build`: PASS.
- `bun run test`: PASS, 60 tests (32 unit, 28 PostgreSQL integration). Covers clean migrations, populated 0003-to-0004 upgrade, Unicode whitespace/nonblank checks, canonical email conflicts on insert/update, automatic timestamps, unchanged incident/claim dates, foreign-key deletion behavior, index definitions, safe cleanup preview/batches/locked rows, and rollback with legacy invalid data.
- `bun run db:migrate` applied 0004 to the local development DB; `db:migrate:status` reports 0001–0004 applied. Repeating migrate applies nothing. Original 0001–0003 SHA-256 checksums remain unchanged.
- `bun run db:cleanup-auth`: PASS in preview mode. Applying cleanup is exercised against isolated test data, preserving active sessions/current throttle windows and all business records.
- `bun run start` with actual HTTP smoke: PASS for normalized whitespace/case email login, native Argon2, safe cookies, report/claim timestamp output, ownership, client metadata rejection and logout. Temporary smoke records are removed in finally.
- Bundled Chromium browser smoke: PASS for fonts/MUI hydration/layer precedence and live/ready; zero browser errors or external requests.
- `docker compose config --quiet`: PASS. Container execution remains unverified because the Docker Linux engine is unavailable; hosted CI was not dispatched.

EXPLAIN ANALYZE benchmark uses the actual repository SELECTs and normal planner settings against 500 synthetic users, 40,000 reports and 80,000 claims. Both replacement composite indexes are selected; result IDs/order are unchanged. A representative local run reduced filtered-out rows from 1,980 to zero for the report feed and 9,969 to zero for own claims, with shared buffer accesses from 39 to 23 and 153 to 22 respectively. These are synthetic-workload observations, not production latency guarantees. The latest local plan summaries are in ignored tmp/database-index-plans.json; CI reruns the plan assertions.

No business eligibility, duplicate/retry, approval or personal-data retention policy was inferred. There are still eight physical tables. Technical auth expiry cleanup follows the existing session TTL and 15-minute throttle window; scheduling and business retention remain open decisions.

## Original foundation verification (before 0004)

`bun run dev` also passed real HTTP checks for the home page, liveness and database readiness. Next generated its standard `apps/web/AGENTS.md` guidance during that run; it is retained. Verification app servers and the temporary PostgreSQL cluster were stopped afterward. Automatic approval review rejected recursive cleanup with "blocked by policy" and no further reason; downloaded binaries, the temporary cluster/password file, and smoke scripts/logs remain ignored under `tmp/`. They are excluded from Git and Docker context. Use the documented Compose/database setup to rerun DB-dependent checks.

Verified on 2026-11-04:

| Executed command / check                                                        | Result                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install` and `bun install --frozen-lockfile`                               | PASS; one Bun lockfile; no ORM/query builder in manifests or lockfile                                                                                                        |
| `bun run env:setup` / `bun run env:check`                                       | PASS; random ignored local credentials; existing file hashes unchanged on repeat setup                                                                                       |
| `bun run format:check`                                                          | PASS                                                                                                                                                                         |
| `bun run lint`                                                                  | PASS; zero warnings                                                                                                                                                          |
| `bun run typecheck`                                                             | PASS; production, generated route types and tests                                                                                                                            |
| `bun run test:unit`                                                             | PASS; 31 tests                                                                                                                                                               |
| `bun run test:integration`                                                      | PASS; 13 real PostgreSQL tests, including guarded CLI provisioning                                                                                                           |
| `bun run test`                                                                  | PASS; 44 tests total                                                                                                                                                         |
| `bun run db:migrate` / `bun run db:migrate:status`                              | PASS; 0001–0003 applied; repeat migration applies nothing                                                                                                                    |
| `bun run build`                                                                 | PASS; Next 16.4.5 standalone output; both Google fonts downloaded successfully                                                                                               |
| `bun run start`                                                                 | PASS; actual generated `apps/web/server.js` starts, with static/public files copied correctly                                                                                |
| `node --env-file=.env --conditions=react-server --import tsx tmp/api-smoke.mjs` | PASS; real standalone HTTP auth/native Argon2, secure cookie attributes, reports/claims, ownership, validation, logout; temporary seeded rows removed                        |
| `node tmp/browser-smoke.cjs` using bundled Playwright/Chromium                  | PASS; page/headers, Latin + Thai fonts, MUI SSR/hydration, CSS-layer utility precedence, live/ready HTTP; 3 successful font responses, zero browser errors/external requests |
| Client asset scan                                                               | PASS; 18 emitted client assets do not contain the generated local DB password; no env files in standalone tree                                                               |
| `docker compose config --quiet`                                                 | PASS                                                                                                                                                                         |
| `docker compose build web`                                                      | BLOCKED; Docker Linux engine unavailable before build starts                                                                                                                 |
| Linux image/non-root container/Compose runtime checks                           | NOT RUN locally; depend on Docker engine                                                                                                                                     |
| Hosted GitHub Actions                                                           | NOT RUN; workflow created, not dispatched                                                                                                                                    |

The smoke scripts are ignored local QA artifacts, not extra production dependencies. The committed regression suites are under `tests/`. Docker's backend log reports failure opening/removing `sailor-ingest.sock` and exits before the Linux engine is available. No Docker reset, socket deletion or operating-system reconfiguration was performed.

A rebuild during the standalone smoke server run failed with Windows EPERM on the loaded Argon2 binary. After stopping that verifier, `bun run build` passed again. This resolved verification issue is documented in the development troubleshooting guide.

Initial environment: Windows PowerShell, Node 24.18.0, Bun 1.3.14, Docker client 29.7.2 / Compose 5.4.0. Docker's Linux engine was unavailable. Real PostgreSQL 18.4 EDB portable binaries were downloaded into ignored `tmp/` for local integration verification; no portable binary or data is a project dependency or tracked artifact. The normal documented developer setup uses Compose.

Migrations applied to the local development database and to a separate temporary integration schema. Integration tests use real PostgreSQL and real repository/application/HTTP handlers; they do not mock database behavior. Unit HTTP failure tests use injected failing dependencies to validate sanitization/readiness. No test is silently skipped when PostgreSQL is unavailable.
