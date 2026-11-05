# Architecture

The modular monolith has one deployable application, `apps/web`. App Router pages and API Route Handlers use the same Next.js build. Bun is the workspace/package manager and script launcher; Node 24.18.0 runs Next and CLI tools. This avoids an additional backend service and distributed infrastructure.

The request path is Route Handler → HTTP presentation adapter → application service → domain repository port → PostgreSQL adapter → database query utility → `pg`. `lib/composition.ts` explicitly constructs services with repository dependencies. Route files only bind HTTP methods and declare Node/dynamic execution. They perform no SQL or authorization logic.

Domain types and ports contain no React, Next, Zod, SQL or database imports. Application services depend on domain contracts and browser-safe expected errors. Infrastructure implements ports and carries `server-only` guards. Presentation validates external data, extracts sessions, shapes output and maps sanitized errors. ESLint restricts domain/application and package dependency directions; modules cannot import UI frameworks. Relative cross-module domain imports are explicit ports/types; there is no global service registry or reverse database-to-web dependency.

`packages/database` owns one lazily initialized, bounded `pg.Pool` per Node process, typed query plumbing and a same-client transaction helper. SQL stays in repository adapters. No pool is opened during build imports. `packages/shared` exports only safe types and `AppError`; no server implementation or secret is exported to clients. Login UI lives in `components/auth`, while browser-safe validation and the same-origin API adapter live in `modules/auth/presentation`. It receives an HttpOnly session through the existing server API; no database or server configuration enters the client bundle. The campus study consumes checked-in attributed geographic data independently of the business database.

Next standalone output traces from the repository root, retaining workspace and native Argon2 dependencies. The runtime entry is `apps/web/server.js` inside standalone. Docker uses Node's non-root `node` user. Web startup does not migrate or provision users.

Each API response is no-store. A generated request ID links sanitized status/duration logs to errors without logging request bodies, query strings, passwords, cookies, evidence or SQL exceptions.
