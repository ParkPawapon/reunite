# API contract v1

## Catalog and read-endpoint assignment status

BE003 is implemented: public `GET /api/v1/locations` reads PostgreSQL and returns ordered, paginated locationId/locationName/nullable detail with the standard response envelope. Invalid, unknown and duplicate query parameters return 422.

Implemented read assignments: BE002, BE005, BE006. Pending assignments BE007, BE008 retain their explicit 501 starters. Integration coverage checks real PostgreSQL data, validation, pagination and privacy for delivered tasks. See [backend handoff](tasks/BACKEND_ENDPOINT_HANDOFF_TH.md).

## Private student profile and account notifications

All routes below derive identity from the session, accept no target user ID, return `Cache-Control: no-store` and require authentication. Mutations also require the configured same Origin. The existing login/me response remains the minimal `{ userId, name, email }` contract.

| Method/path                     | Behavior                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /profile`                  | Returns own `userId`, `name`, `email`, nullable `firstName`, `lastName`, `studentId`, `faculty`, `department`, `major`, `phone`, `avatarVersion`                                                 |
| `PATCH /profile`                | Replaces editable profile fields; first/last name and email required; the five optional student/contact fields accept strings or null; optional `currentPassword` is required when email changes |
| `GET /profile/avatar`           | Returns only own normalized `image/webp` bytes, or 404; this is a binary exception to the JSON success envelope                                                                                  |
| `PUT /profile/avatar`           | Raw JPEG/PNG/WebP body with matching `Content-Type`, at most 2 MiB; returns updated profile after decoding, metadata removal and WebP normalization                                              |
| `DELETE /profile/avatar`        | Removes own photo; returns updated profile; no-op removal creates no extra notification                                                                                                          |
| `GET /notifications?before=123` | Returns `{ items, unreadCount, nextCursor }`; 20 newest items, exclusive positive integer cursor, 21st row determines next cursor; no query parameters besides `before`                          |
| `PATCH /notifications`          | JSON `{ "throughId": 123 }`; marks only the current owner's unread rows up through that ID; returns `{ "updated": true }`                                                                        |

Profile input uses `firstName`/`lastName` (1–100 characters), canonical email (up to 255), student ID (8–20 digits or null), faculty/department/major (up to 180), phone (up to 20, common numeric punctuation). Blank optional text becomes null. Unknown fields, invalid IDs and duplicate query parameters return 422. Duplicate email/student ID or concurrent password changes return 409 without partial updates. Email confirmation uses the existing 10-attempt/15-minute database throttle under a separate hashed profile key; invalid/missing current password returns 422 `PASSWORD_REQUIRED`, exhausted budget returns 429. This does not implement email verification or account recovery.

Avatar decoding accepts still images only, checks actual decoded format against MIME, limits decoded pixels to 16 million, resizes to at most 384×384, and stores at most 128 KiB of WebP with a SHA-256 version. No uploaded URL or filename is accepted. Oversized input returns 413, unsupported MIME 415 and corrupt/mismatched/animated images 422. Unauthenticated requests return 401, and cross-origin mutations 403. URLs under `/profile/avatar?v=<version>` are cache-busting references for the same private image, not public resources or other-account selectors.

Each notification contains `notificationId`, `kind` (`PROFILE_UPDATED` or `AVATAR_UPDATED`), UTC ISO `createdAt` and nullable `readAt`. Events come only from actual profile/photo changes and commit atomically with them. No personal-field snapshots, dummy alerts, matching/claim events, email delivery or notification image publishing are implemented. Mark-read preserves events with newer IDs. The client refreshes on opening/focus/account edits and every 60 seconds while visible.

| Method / path             | Authentication   | Behavior                                                                             |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| GET `/health/live`        | none             | `{status:"live"}`; no database access                                                |
| GET `/health/ready`       | none             | `{status:"ready"}` after bounded database ping; otherwise 503                        |
| POST `/auth/login`        | credentials      | Profile and opaque HttpOnly cookie; previous browser token revoked after valid login |
| POST `/auth/logout`       | optional session | Revoke current token and clear cookie; idempotent                                    |
| GET `/auth/me`            | session          | Own `{userId,name,email}`                                                            |
| GET `/categories`         | none             | Paginated `[{categoryId,categoryName}]`, ordered by category ID                      |
| GET `/locations`          | none             | Paginated `[{locationId,locationName,detail}]` (implemented in BE003)                |
| GET `/item-reports`       | none             | Paginated public reports, optional filters, newest report ID first                   |
| GET `/item-reports/:id`   | none             | Public single report or 404; reporter identity omitted                               |
| POST `/item-reports`      | session          | Create report as current user, `OPEN`; 201                                           |
| PATCH `/item-reports/:id` | owner session    | Safe field update; other owners/missing reports return 404                           |
| GET `/claims`             | session          | Currently 501; BE007 restores own claims only                                        |
| GET `/claims/:id`         | claimant session | Currently 501; BE008 restores own claim or non-disclosing 404                        |
| POST `/claims`            | session          | Current claimant, supplied report/evidence, DB `PENDING` and timestamp; 201          |

## Requests and output

Mutations require an `Origin` equal to configured `APP_BASE_URL`'s origin, including login/logout. Missing, `null`, cross-site and foreign origins return 403. JSON bodies require `Content-Type: application/json`, are capped at 32 KiB even when chunked, and reject unknown fields. GETs have no cross-origin allow headers. Browser authentication is same-origin.

Login body: `{ "email": "person@example.test", "password": "user supplied" }`. Email boundary whitespace is trimmed and email is lowercased consistently with provisioning and database storage; password whitespace is preserved and length bounded at 128. Wrong/unknown credentials share 401 `INVALID_CREDENTIALS`. Ten attempts per normalized account identifier per 15-minute fixed window are allowed, including successful attempts; later attempts return 429 `RATE_LIMITED`. This DB-backed counter is shared across app instances.

For local verification, `bun run db:seed --development-only` prepares one account and writes its generated credentials to `tmp/local-seed/login-account.json` (excluded from Git/Docker). Send that file's email and password to `POST /api/v1/auth/login` with same-origin `Origin` and `Content-Type: application/json`. A successful response is HTTP 200 with `data: { userId, name, email }` and the HttpOnly session cookie; the JSON never contains a password, password hash or session token. `GET /api/v1/auth/me` returns the same profile with that cookie, and `POST /api/v1/auth/logout` revokes it. The login form uses this API and navigates to the protected dashboard after success. Seed runs never create an HTTP registration endpoint.

Report creation:

```json
{
  "categoryId": 1,
  "locationId": 1,
  "type": "LOST",
  "title": "Bag",
  "description": "Optional text",
  "image": "/reference-only/bag.jpg",
  "eventDatetime": "2026-11-04T12:30:00+07:00"
}
```

IDs in JSON must be positive 32-bit integers. Catalog IDs must already exist. `title` is trimmed, required, max 255; description is nullable/optional, max 10000; image is nullable/optional, max 500, HTTP(S) without credentials or an absolute single-slash application path. No image fetching or file uploading occurs. Date/time must be valid ISO 8601 with timezone. `type`: `LOST` or `FOUND`. Output: `{reportId,categoryId,locationId,type,title,description,image,eventDatetime,status,createdAt,updatedAt}`. Dates serialize as UTC, e.g. `2026-11-04T05:30:00.000Z`. createdAt is submission metadata, distinct from the eventDatetime incident instant; pre-0004 reports use the migration instant because historical submission time is unknown. Public output omits reporter IDs/profiles.

PATCH accepts only `title`, `description`, `image`, `categoryId`, `locationId`, with at least one field. Nullable fields can be explicitly cleared with `null`. Ownership, type, status, event date/time, createdAt and updatedAt cannot be supplied or rewritten by clients. PostgreSQL maintains updatedAt on successful UPDATE statements.

Claim creation: `{ "reportId": 1, "evidence": "Private identifying details" }`. Evidence is required after trimming, max 10000. Output to the authenticated claimant: `{claimId,reportId,userId,evidence,status,claimDate,updatedAt}`. Clients cannot supply identity, status, claimDate or updatedAt. Only existing report FK eligibility is enforced; no undocumented LOST/FOUND, self-claim, duplicate-request, lifecycle or approval rule is assumed. Those decisions must be made before public release.

## Error statuses

400 malformed/missing JSON; 401 absent/invalid/expired session or credentials; 403 failed origin check; 404 missing/not-owned object; 409 uniqueness conflict; 413 oversized JSON; 415 non-JSON content type; 422 validation/invalid reference/check constraint; 429 account login throttle; 500 sanitized unexpected failure; 503 readiness/connectivity failures. Validation messages do not echo rejected input. Database codes, SQL, stacks and secrets never enter response bodies.

There is no registration, catalog write API, status-transition API, claim approval endpoint, matching endpoint, item-report upload or notification publishing endpoint. Private profile photos and typed account notifications use the implemented routes above.
