# Verification

This file records executed verification by revision. Historical sections retain the limits that applied at the time; the delivery section records the subsequent hosted checks.

## Pull-request delivery (2026-11-07, Asia/Bangkok)

- Integrated the teammate's BE003 location endpoint in PR #12 and delivered account APIs (BE004), the account workspace (FE005), system recovery pages (FE006), campus exterior assets (MAP002) and the approved launch page (FE007) as separate tasks. Each PR contains one signed task commit; the repository additionally records its required merge commit.
- Hosted checks passed before merging each task: frozen Bun install, high/critical dependency audit, environment validation, real PostgreSQL migration/cleanup checks, formatting, generated design assets, lint, strict types, unit/integration tests, production build, Chromium browser checks, Docker build and non-root container live/ready smoke. Repository policy and CodeQL checks are also required. See the merged PR checks for the exact source revision and run logs.
- The owner-authorized review bypass uses ParkPawapon's existing permission. The one-review/CODEOWNERS rule remains active; required checks, signatures and branch integrity remain enforced with no bypass actors for those checks.
- Fixed a race in the stalled-login-chunk browser fixture. It settles the previous request while failures remain enabled and restores chunk delivery only on the user's real document reload. The ready-form assertions remain enabled; no checks were skipped or timeouts increased.
- Hosted animation diagnostics identified four finite hover/focus transitions on the pause button during an idle assertion. The browser test now awaits their actual `finished` promises before requiring zero running animations. Infinite effects are excluded from that wait and must still be stopped; no timeout or assertion was relaxed.
- Fixed protected-page prerendering by awaiting request headers before reading runtime configuration. The exact workspace build passed with `APP_BASE_URL` and `DATABASE_URL` absent; the Docker build no longer needs deployment-only settings or credentials. Real request validation and session guards stay enabled.
- Final local application suites: 62 unit, 40 PostgreSQL integration and 31 browser tests PASS. The browser server uses disposable test data, preserving the normal local account/database.
- BE002 categories remains assigned to its original teammate and intentionally returns 501; BE003 locations returns real paginated data. This delivery does not deploy a production service or certify surveyed building dimensions, physical-phone performance or complete accessibility compliance.

## Coming Soon production page (2026-11-07, Asia/Bangkok)

- `bun run build`, `bun run typecheck`, `bun run lint`, `bun run format:check` and `git diff --check`: PASS. `/coming-soon` is statically prerendered and served by the real Next.js standalone application.
- `bun run test:unit`: 62 passing tests. New coverage checks Thai-midnight/deadline arithmetic and quantization-safe geometry batching without changing source positions, normals, UVs or material distinctions.
- `bun run test:integration`: 40 passing tests in isolated schemas after integrating BE003; no production database reseed was performed.
- `bun run test:browser`: all 31 tests PASS, including seven new Coming Soon cases and the existing login, shell, profile, notification, loader and system-state regressions. Test-server SQL failure output from the intentional profile-recovery fixture remains expected.
- The new production checks cover local-only resource requests, SSR and no-JavaScript content, real GPU/CSS pause with a live countdown, pixel changes through a full horizontal orbit/keyboard reset, reduced motion, responsive widths 320–1920 px and automated axe WCAG A/AA scans. They also cover HTTP model failure, fresh-canvas context-loss recovery, GPU context disposal after client navigation, timezone/deadline behavior and real login navigation, delayed model loading, hidden/offscreen rendering suspension and failed scene-chunk reload recovery.
- The generic loader is scoped to `/login`; this prevents a streamed fallback from hiding the public announcement when JavaScript is disabled. Other route-local skeletons remain, and the complete regression suite passes.
- Local production preview: <http://localhost:3000/coming-soon>. Details and source map: `docs/design/coming-soon.md`. Screenshots: ignored `tmp/coming-soon/production-1440.png` and `production-390.png`.
- At the initial local page verification, Docker and hosted checks had not run. Subsequent hosted/container verification is recorded in the delivery section above. Physical-phone FPS/thermal behavior and production deployment remain unverified.

## Profile/dashboard refinement and system states (2026-11-06)

- Production build, strict typecheck and lint pass after the component/motion refinement. The database/API contracts and existing migrations are unchanged in this revision.
- Unit/integration suites remain 57 and 38 passing tests. Browser suite passes all 24 tests, including all 22 distinct status designs, responsive overflow/selected WCAG rules, 404 without JavaScript, genuine redirect/JSON error semantics, delayed profile/photo loading, and actual error-boundary retry.
- Recovery fixtures alter only the managed disposable test schema and restore their temporary view/table changes in finally. The induced PostgreSQL error in test-server output is expected. Normal local profile data is not overwritten by these fixtures.
- Dashboard/profile links now use client navigation; campus links retain document navigation. The avatar initial scales correctly, image decoding has a real fixed-size Skeleton, and profile placeholders have the actual 2/4/2 field geometry.
- `experimental.globalNotFound` is explicitly enabled in the pinned Next version to ensure a useful 404 without relying on the root loading boundary's JavaScript streaming swap. Regression checks cover both HTTP status and visible no-JS content.
- `/research/system-states` and `/status/<code>` are noindex design previews, not false HTTP failures. Actual unmatched URLs and application error boundaries are wired; proxy-level error pages remain deployment configuration.
- No push, merge, bypass or hosted CI dispatch was performed. The previously documented Docker daemon limitation remains.

## Profile, shell and notifications (2026-11-06)

- `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun run format:check`, `git diff --check`: PASS.
- `bun run test`: PASS, 57 unit and 38 PostgreSQL integration tests. Added coverage includes legacy profile upgrade/session preservation, nine-table schema, real profile persistence, owner isolation, canonical email confirmation and uniqueness, atomic/no-op notification events, bounded streaming image uploads, MIME mismatch/corruption/decompression limits, metadata removal, private image retrieval/deletion, cursor pagination and read boundaries preserving newer events.
- `bun run build`: PASS. The first standalone browser run exposed missing sharp companion Windows DLLs despite a successful build. Explicit Bun-aware native tracing fixed packaging, and real upload/browser checks now pass against standalone output.
- `bun run test:browser`: PASS, 20 tests against a production standalone server and disposable schema in the separate test DB. Covers existing login/loading/map behavior plus real profile/photo saves and reload, notification loading/empty/read/failure/retry states, focus restoration after read/retry, four profile viewport widths, reduced-motion transitions and selected automated WCAG A/AA rules. Contrast checks wait for finite entry/exit transitions to finish. This is not physical-device or full accessibility certification.
- Local migration runner applied `0005` and `0006`; `bun run db:migrate:status` reports all six migrations applied. Before/after digests verified the existing user's legacy account fields and existing session were unchanged at migration time. No student values or alert demonstrations were fabricated. Existing `0001`–`0004` files were not edited.
- Running Local standalone on port 3000: verified actual login, protected dashboard/profile, live private notification response/panel, Footer link removal, and logout of the successful verification session. The normal account's personal data was not overwritten by the isolated browser fixtures.
- Docker runtime remains unverified: `docker info` cannot connect to `dockerDesktopLinuxEngine`; the Docker Desktop executable was not found at the standard installed location. No hosted CI run, push, merge or bypass was performed for these local changes.

The eight-table statements below describe the historical 0004 verification, before the later authorized profile/notification migrations.

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
