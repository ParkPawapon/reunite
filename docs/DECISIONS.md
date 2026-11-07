# Decisions and open requirements

## Inspected sources

The repository initially had no commits or application files, only the master prompt and two PDFs. All three are preserved. `DATABASE SYSTEMS (4).pdf`: scope p4, ERD p6, relational schema p7, dictionary p10–14. `Web Programming I (1).pdf`: scope p4, wireframes p6–10, ERD p12, relational schema p13, dictionary p16–20. Text was extracted and ERD/wireframe pages rendered for inspection. Their five-table schemas agree.

## Accepted technical decisions

1. One Next.js App Router deployable, modular application/domain/repository layers. Bun workspaces/lockfile, Node 24 LTS server. No extra backend or ORM.
2. Preserve the documented SQL schema and statuses. The prompt abbreviates `AS ID` for some identity columns; both dictionaries specify `GENERATED ALWAYS AS IDENTITY`, which is used consistently.
3. Credential auth with Argon2id, expiring/revocable hashed opaque DB sessions; technical tables `auth_sessions`, `auth_login_throttles`, `schema_migrations` are distinct from five business tables. The additional throttle migration supplies cross-instance account protection without changing business entities.
4. Conservative privacy default: claims are claimant-only; public reports expose no owner identity/profile. Report PATCH is owner-only and excludes status, type and event date/time. These are explicit foundation restrictions pending business policy, not an invented lifecycle/approval rule.
5. Only report-FK existence is known for claim eligibility. No unsupported LOST/FOUND, self-claim or approval restriction is implemented. Evidence is required; status/time come from DB defaults.
6. No production catalog seed: real campus locations and category data require approval. Test data is labeled synthetic and isolated.
7. Outfit + Noto Sans Thai and centralized baseline typography. The initial foundation deferred page design; subsequent explicit requests supplied the palette and authorized the Agent Honk loader and email/password login. `docs/design/` records those implementations and checks. The wireframe's 85% remains illustrative; no matching API or fabricated result exists. The AI presentation title is future scope, not a foundation algorithm.
8. Package metadata checked 2026-11-04: Next 16.4.5/React 19.3.1; MUI/material-nextjs 9.5.0 supports Next 16 and supplies `v16-appRouter`; Tailwind 4.3.4; pg 8.23.1; Zod 4.6.7; Argon2 0.45.2. TypeScript 6.0.3 stays within typescript-eslint 8.72.1's `<6.1` peer range; ESLint 9.39.5 avoids plugin peer conflicts with 10. All are pinned through bun.lock. Node 24.18.0 is a supported LTS; PostgreSQL 18.4 and Bun 1.3.14 image tags were verified in registry metadata.

## Official implementation references

The subsequent database-hardening request authorizes migration 0004's additive metadata, normalization, constraints and query-aligned indexes. Original migration checksums remain unchanged. The database stays at eight tables (five business entities plus three technical tables). Canonical email storage reuses UNIQUE(email) rather than duplicating it with a second functional unique index. Existing user/report creation history is unknown and is labeled as migration-time backfill; claim_date is preserved. SQL triggers maintain update times for all write paths. The auth cleanup CLI uses only already-defined expiry/window semantics, has a preview default and does not install a scheduler. Claim duplicate/retry/approval policy, business retention and a status-history entity remain undecided rather than being inferred from technical authorization.

- [Next standalone/monorepo tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [MUI Next integration](https://mui.com/material-ui/integrations/nextjs/) and [Tailwind 4 layers](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4/)
- [Bun workspaces](https://bun.com/docs/pm/workspaces)
- [node-postgres transactions](https://node-postgres.com/features/transactions)
- [Node release support](https://nodejs.org/en/about/previous-releases) and [PostgreSQL support](https://www.postgresql.org/support/versioning/)

## OPEN_DECISIONS

The later user request authorizes personal student profiles, profile-photo upload and an in-app notification bell. Migrations 0005–0006 implement these within nine physical tables. Avatars use bounded normalized WebP in PostgreSQL, with no external storage service and no ephemeral container uploads. Notification types are limited to actual profile/photo changes; no unsupported claim/matching/announcement policy is inferred. Existing legacy names and sessions are preserved, and unknown student details remain null. Email editing requires current-password confirmation; email verification/recovery remain outside the implemented scope. See DATABASE.md, API_CONTRACT.md and design/profile-notifications.md for the implemented limits.

Final platform/brand approval beyond the Reunite working name; verification of the supplied palette's official brand status; business location/category catalog population; public report visibility; onboarding/self-registration, recovery and production provisioning; report lifecycle transitions and date corrections; claim eligibility and approval authority; upload/storage provider and validation; AI matching methodology/model/evaluation; personal/evidence privacy, PDPA handling and retention/deletion; production proxy/TLS, least-privilege roles and operational edge limits. The separate campus study includes attributed map data and exterior models, with measured accuracy and field-survey limits documented in `research/kmutt-bangmod/README.md`; it does not populate the business catalogs.
