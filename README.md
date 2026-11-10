# Campus Lost & Found foundation

One Next.js App Router application serves the Reunite web experience and JSON API. Bun manages workspaces; Node 24 LTS runs the application. PostgreSQL access uses `pg` and handwritten parameterized SQL. There is no ORM. The original master prompt and both project PDFs are preserved.

## Quickstart

Prerequisites: [Node 24 LTS](https://nodejs.org/en/download), [Bun 1.3.14](https://bun.com/docs/installation), and [Docker with Compose](https://docs.docker.com/get-started/get-docker/). Start the Docker engine first.

```sh
bun install --frozen-lockfile
bun run env:setup
docker compose up -d postgres
bun run db:migrate
bun run dev
```

Open <http://localhost:3000>. The root redirects to `/login`, shows a 1.3-second welcome sequence with Agent Honk and a matching form skeleton, then reveals the email/password form connected to the existing session API. The skeleton also covers the real form-chunk download on slower networks. See [Login design and verification](docs/design/login.md). `GET /api/v1/health/live` checks the process; `/api/v1/health/ready` checks PostgreSQL. Catalogs are initially empty: no campus locations or production categories have been invented.

Successful login opens the session-protected `/dashboard`: reusable Topbar, Sidebar, Footer and route skeleton, a real campus-render preview with its own loading/error state, and links to the existing campus map and university tour. Desktop navigation collapses; mobile uses an accessible Drawer. Account details and logout use the existing authentication system. See [Dashboard design and verification](docs/design/dashboard.md).

The account menu and Sidebar link to `/profile` for first/last name, student ID, faculty, department, major, phone, email and a private profile photo. The Topbar bell shows real profile/photo activity with unread counts, Skeleton, retry and read-all. The Footer retains only its brand signature. Migrations `0005`–`0006` preserve existing accounts and sessions within nine physical tables. See [Profile and notifications](docs/design/profile-notifications.md).

The public [/coming-soon](http://localhost:3000/coming-soon) page presents the approved cinematic campus scene, interactive 3D clues and Agent Honk, with a countdown to **24 November 2026 (2569), 00:00 Asia/Bangkok**. It supports pause, reduced motion, static fallback and recoverable scene loading. See [Coming Soon implementation and verification](docs/design/coming-soon.md).

The [backend assignment handoff](docs/tasks/BACKEND_ENDPOINT_HANDOFF_TH.md) records integrated BE003 and delivered BE002, BE005, BE006, BE007, BE008 read endpoints. All assigned category/report/claim reads use real PostgreSQL data; private claims remain claimant-only.

To create one local login account after migrations, run `bun run db:seed --development-only`. The command creates `demo@reunite.test` and a random password in the Git/Docker-ignored `tmp/local-seed/login-account.json`. Repeating it preserves the same account and credentials. See [local login seed safeguards](docs/DEVELOPMENT.md#one-local-login-account).

`env:setup` creates ignored root `.env` and `apps/web/.env.local` with one random local DB password. It preserves existing files; reconcile them manually if changing existing configuration. Never commit credentials. For your own passwords, URL-encode reserved characters in `DATABASE_URL` and in the Compose URL components; the generated hex password requires no encoding.

The [KMUTT Bangmod campus study](research/kmutt-bangmod/README.md) is available locally at <http://localhost:3000/research/kmutt-bangmod>. It includes a 3D viewer and downloadable GLB, GeoJSON, and building catalog for education.

## Commands

Run `bun run env:check` to validate server/database settings without connecting or printing secrets.

`bun run db:cleanup-auth` previews expired technical authentication state; append `--apply` for one bounded cleanup batch. Database migration 0004 adds maintained timestamps, canonical email/nonblank constraints and measured composite indexes. Migrations 0005–0006 extend profiles and add account notifications; the current schema has nine tables. See the [database guide](docs/DATABASE.md) for safe upgrade and retention details.

| Command                                            | Purpose                                                         |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `bun run dev`                                      | Local Next development server                                   |
| `bun run build`                                    | Next production standalone build                                |
| `bun run start`                                    | Prepare static/public assets and run the standalone Node server |
| `bun run db:migrate` / `bun run db:migrate:status` | Explicit versioned migrations / drift-aware status              |
| `bun run db:create-user --development-only`        | Guarded development provisioning; see development guide         |
| `bun run format` / `bun run format:check`          | Apply / verify formatting                                       |
| `bun run lint` / `bun run typecheck`               | Enforced lint and strict TypeScript, including tests            |
| `bun run test:unit`                                | Isolated unit and HTTP failure checks                           |
| `bun run test:integration`                         | Real PostgreSQL and API-handler integration checks              |
| `bun run test`                                     | Both test suites; requires a dedicated test database            |

For a container deployment, run `docker compose up -d postgres`, `docker compose run --rm migrate`, then `docker compose up --build -d web`. Migrations are intentionally separate from web startup. Production cookies require HTTPS; use local `dev` for browser authentication over plain HTTP.

## Repository

- `apps/web`: App Router, server modules, HTTP security, MUI/Tailwind typography.
- `packages/database`: pool, transactions, Argon2id, immutable SQL migrations and CLI tools.
- `packages/shared`: browser-safe types and expected application errors.
- `tests`: strict unit tests and isolated-schema PostgreSQL integration suite.
- `infra/docker`, `compose.yml`, `.github/workflows/ci.yml`: runtime and reproducible checks.
- `docs`: [API](docs/API_CONTRACT.md), [development](docs/DEVELOPMENT.md), [environment](docs/ENVIRONMENT.md), [database](docs/DATABASE.md), [architecture](docs/ARCHITECTURE.md), [conventions](docs/SYSTEM_CONVENTIONS.md), [deployment](docs/DEPLOYMENT.md), [security](docs/SECURITY.md), [decisions](docs/DECISIONS.md), [verification](docs/VERIFICATION.md).

This is a foundation, not a public-launch approval. Business policy for onboarding, report lifecycle, claim approval, privacy/retention, uploads and matching remains open. See the decision and security records.
