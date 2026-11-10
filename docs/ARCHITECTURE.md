# Architecture

The modular monolith has one deployable application, `apps/web`. App Router pages and API Route Handlers use the same Next.js build. Bun is the workspace/package manager and script launcher; Node 24.18.0 runs Next and CLI tools. This avoids an additional backend service and distributed infrastructure.

The request path is Route Handler → HTTP presentation adapter → application service → domain repository port → PostgreSQL adapter → database query utility → `pg`. `lib/composition.ts` explicitly constructs services with repository dependencies. Route files only bind HTTP methods and declare Node/dynamic execution. They perform no SQL or authorization logic.

Domain types and ports contain no React, Next, Zod, SQL or database imports. Application services depend on domain contracts and browser-safe expected errors. Infrastructure implements ports and carries `server-only` guards. Presentation validates external data, extracts sessions, shapes output and maps sanitized errors. ESLint restricts domain/application and package dependency directions; modules cannot import UI frameworks. Relative cross-module domain imports are explicit ports/types; there is no global service registry or reverse database-to-web dependency.

`packages/database` owns one lazily initialized, bounded `pg.Pool` per Node process, typed query plumbing and a same-client transaction helper. SQL stays in repository adapters. No pool is opened during build imports. `packages/shared` exports only safe types and `AppError`; no server implementation or secret is exported to clients. Login UI lives in `components/auth`, while browser-safe validation and the same-origin API adapter live in `modules/auth/presentation`. It receives an HttpOnly session through the existing server API; no database or server configuration enters the client bundle. The campus study consumes checked-in attributed geographic data independently of the business database.

Next standalone output traces from the repository root, retaining workspace and native Argon2 dependencies. The runtime entry is `apps/web/server.js` inside standalone. Docker uses Node's non-root `node` user. Web startup does not migrate or provision users.

Each API response is no-store. A generated request ID links sanitized status/duration logs to errors without logging request bodies, query strings, passwords, cookies, evidence or SQL exceptions.

## Profile and account notifications

`modules/users` owns student-profile types/ports, the profile application service, PostgreSQL adapter and browser-safe validation/transport. `modules/notifications` owns typed private account events, owner-scoped listing and mark-read. `lib/http/account-handlers.ts` composes authenticated HTTP boundaries for the thin `/api/v1/profile`, `/profile/avatar` and `/notifications` routes. Image decoding stays in server-only infrastructure; clients never import sharp or SQL.

Profile/photo updates and their typed notification inserts use a single parameterized SQL data-modifying CTE, so both commit or roll back together. Profile queries explicitly omit image bytes and password hashes; the separate authenticated photo route reads only its current owner's bounded normalized WebP. The private student fields do not enlarge the existing auth/me DTO. The UI shell accepts the active page and safe name/email/avatar-version view data; the profile component owns editable state and the bell owns notification resource state. Both reuse the established theme and motion policy. Bun standalone tracing explicitly includes sharp's installed native companion libraries.

## Public launch page

`app/coming-soon/page.tsx` composes the approved public announcement from `components/coming-soon/`. A cached external-store clock updates only the countdown; its fixed Thai-midnight launch instant is shared with meaningful boundary tests. The shell and local poster are server-rendered, while the Three.js scene is imported after hydration. It has no API/database dependency.

The scene controller owns its request, WebGL context, input controls, observers, cached shadows and GPU resources. React cleanup aborts pending work and disposes the scene; model/context failures retry a new canvas, while a failed JavaScript chunk offers a full-document reload. Shared motion preferences govern the scene and original `AnimatedGoose`. The former generic root loader is scoped to `/login` to keep public launch HTML usable without JavaScript; existing resource-route skeletons remain.

## Backend assignment starter

BE003 and BE002, BE005, BE006 read endpoints are integrated through module-owned presentation, application services and parameterized SQL repositories. BE007, BE008 retain explicit 501 starters. Shared routing/composition remains unchanged. See [backend handoff](tasks/BACKEND_ENDPOINT_HANDOFF_TH.md).
