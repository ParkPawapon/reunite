# Database

PostgreSQL 18.4 is pinned for Compose and CI. The two source PDFs have matching relational schemas/data dictionaries. Migration `0001` preserves their five business tables, identity integer keys, names, lengths, nullability, foreign keys, defaults and status checks: `users`, `categories`, `locations`, `item_reports`, `claims`. No catalog data is seeded into production.

`0002` adds technical `auth_sessions`: only SHA-256 digests of 256-bit random tokens, user FK, expiry and creation time. Logout deletes the row; reads enforce expiry. `0003` adds technical `auth_login_throttles`: hashed normalized account identifier, fixed-window start and atomic bounded attempt counter. `schema_migrations` tracks runner infrastructure. None of these are extra business entities.

There are nine physical tables: the five original business tables, sessions, login throttles, migration tracking and in-app account notifications. No role or approval entity is added.

## Student profile and notifications (0005–0006)

Migration `0005` adds nullable `first_name`, `last_name` (100 characters each), `student_id` (8–20 digits), `faculty`, `department`, `major` (180 characters each), `avatar_data` and `avatar_version` to `users`. Existing `phone` and canonical unique `email` are reused. Legacy personal fields remain null; the migration does not split display names, invent student identities or remove sessions. `name` expands to 201 characters to hold two 100-character names and a separator. The profile API maintains the combined display name.

The partial unique `users_student_id_unique` index prevents duplicate populated student identifiers while allowing unknown values. The 8–20-digit validation is a permissive input boundary, not certification against a university student registry. Faculty/department/major are user-entered text; no unverified academic catalog or additional entities are introduced. Optional blank values normalize to null; database checks reject whitespace-only names and academic fields.

Profile images are private, normalized WebP bytes stored in PostgreSQL, bounded to 128 KiB per account with a paired SHA-256 content version. Uploads accept still JPEG/PNG/WebP up to 2 MiB and 16 million decoded pixels, resize/crop to at most 384×384 and strip metadata. Original files and filenames are discarded. This avoids ephemeral container upload files and adds no storage-provider dependency. Database backups now contain private profile photos; include them in the approved retention/restore plan. This storage decision covers avatars only, not item-report attachments.

Migration `0006` adds `notifications`: identity `notification_id`, owner `user_id`, constrained account-event `kind`, `created_at` and nullable `read_at`. It stores no message body or personal-field copies. Profile and avatar changes create events atomically in the same SQL statement; no-op saves create none. Owner-scoped keyset pagination uses `(user_id, notification_id DESC)` and a matching partial index for unread records. Reads return 20 items plus a next cursor; the count covers all unread items. Mark-read updates only the current owner through the fetched notification ID, preserving later arrivals. Notifications cascade with their owning account; existing report/claim deletion behavior remains unchanged.

## Data integrity upgrade (0004)

| Table        | Added columns                                 | Meaning                                                                          |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| users        | created_at, updated_at (TIMESTAMPTZ NOT NULL) | Account creation and last database update                                        |
| item_reports | created_at, updated_at (TIMESTAMPTZ NOT NULL) | Submission and last database update; event_datetime remains the incident instant |
| claims       | updated_at (TIMESTAMPTZ NOT NULL)             | Last database update; claim_date remains the creation instant                    |

Defaults use the transaction timestamp for insertion. BEFORE UPDATE triggers set updated_at from statement_timestamp(), including direct SQL writes and attempts to supply an old updated_at value. Applications do not write these metadata columns. Existing user/report creation times are unknown, so their columns initialize at the migration instant, explicitly documented in SQL comments; event_datetime is never used as a substitute. Existing claims initialize updated_at from claim_date. A last-update timestamp is not a full audit history or a record of who made a change.

Email is boundary-trimmed and lowercased on every users INSERT/UPDATE, with an additional canonical-form CHECK. API login and the provisioning CLI use the same normalization for accepted email syntax. Canonical storage retains the existing UNIQUE(email) constraint and indexed equality lookup, so a second unique lower(email) index would be redundant. Required name/category/location/title/evidence fields also have nonblank CHECKs. SQL trimming covers the same whitespace characters as JavaScript String.trim(), including tabs, non-breaking spaces and Thai-text boundary whitespace, independently of the database locale. Full email syntax remains a boundary validation concern.

Before changing existing data, migration 0004 checks canonical-email collisions and blank required text. It stops atomically instead of merging/deleting accounts or fabricating replacement content. Resolve invalid records through an authorized operator and retry the unchanged migration. The upgrade holds write/schema locks and builds indexes transactionally: apply it during a planned migration window with backup/restore procedures, not on web startup. Large databases may require a separately planned concurrent-index rollout rather than this foundation migration's bounded execution budget.

Business FKs retain ON DELETE NO ACTION: referenced users, categories, locations and reports cannot be deleted implicitly. auth_sessions retains its technical ON DELETE CASCADE. No soft-delete, personal-data purge schedule, claim deduplication or approval authority is silently chosen. Multiple claims for a user/report remain allowed until the eligibility/retry policy is approved.

## Indexes

Dictionary-listed FK, type/status/time fields and locations.location_name remain covered. Migration 0004 replaces, rather than duplicates, two indexes:

| Index                                                              | Query served                                              | Superseded index      |
| ------------------------------------------------------------------ | --------------------------------------------------------- | --------------------- |
| claims_user_claim_idx (user_id, claim_id DESC)                     | Own claims WHERE user_id, ordered pagination              | claims_user_idx       |
| item_reports_type_status_report_idx (type, status, report_id DESC) | Report feed filtered by type + status, ordered pagination | item_reports_type_idx |

The leading user_id/type columns retain the previous FK/filter use. The standalone report status/category/location indexes remain for other filter shapes. PK/unique indexes are not duplicated; there are no unneeded indexes on new timestamps without a corresponding query. The integration benchmark runs the actual repository SELECTs with EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), normal planner settings, 40,000 synthetic reports and 80,000 claims. It verifies both new indexes are selected, ordered results stay unchanged, and owner-claim reads need no sort. Observed plans are written to ignored tmp/database-index-plans.json; wall-clock ratios are not test assertions or production guarantees. Use real workload plans before adding more index combinations.

The pool is lazy, bounded 1–50 (default 10), with a 3-second connect timeout, 30-second idle timeout, 5-second server statement timeout and 6-second query timeout. Readiness shares these bounds. Rows are explicitly selected/mapped; all runtime values are parameterized. `withTransaction` runs BEGIN, operation, COMMIT/ROLLBACK on one client and releases in finally, discarding a client if rollback fails. CLI tools close pools. Next owns process termination; there is no unbounded custom shutdown hook delaying deployment.

## Migration lifecycle

```sh
bun run db:migrate:status
bun run db:migrate
```

These commands load root `.env` if present, with existing shell variables taking precedence. The runner reads numbered SQL files, hashes exact UTF-8 contents, checks ascending/unique versions and applied-prefix/checksum history, and acquires a PostgreSQL advisory lock on a dedicated client. Each pending migration and its tracking row commit atomically. Failure stops execution and rolls back that version; prior versions stay applied. Lock/client cleanup runs in finally. Concurrent runners serialize. Status validates drift without applying pending SQL. Only the tracking table bootstrap uses `IF NOT EXISTS`.

Never edit an applied SQL file, reorder history or automatically migrate at web startup. Add a forward-fix migration. Back up and rehearse restoration before production changes; there is no misleading destructive down/reset command.

## Dedicated test DB

Create a separate DB such as `lost_found_test` and put its URL in ignored `.env.test`:

```dotenv
TEST_DATABASE_URL=postgresql://app_user:YOUR_LOCAL_PASSWORD@localhost:5432/lost_found_test
```

`bun run test:integration` fails explicitly if the URL is absent, the database name does not end in `_test`, or the URL equals `DATABASE_URL`. It creates one random schema, applies real migrations, seeds temporary data, exercises SQL and API handlers without database mocks, and drops only its generated schema afterward. It never resets/drops a database. Never designate a production database as a test target.

## Authentication-state cleanup

`bun run db:cleanup-auth` is a read-only preview of up to 1000 eligible rows per technical table. `bun run db:cleanup-auth --apply` deletes one bounded batch of expired sessions (expires_at <= current time) and expired login windows (older than the implemented 15-minute window). Both deletes share one transaction, use existing expiry indexes and SKIP LOCKED, and recheck expiry before deletion. Live tokens/current throttle windows and all business tables are untouched. Counts can differ from a preview under concurrent use. Repeat explicitly to drain additional batches; no scheduler is installed. Output contains counts only, never tokens, emails or evidence. Operators can schedule the command after approving the deployment/retention policy.

SQL TIMESTAMPTZ represents instants; API output is UTC ISO 8601 regardless of DB session timezone. Future display formatting uses Asia/Bangkok. Retention/anonymization of business identities, reports and evidence remains an open policy decision; the technical cleanup command does not claim to satisfy it.
