# API contract v1

## Catalog and read-endpoint assignment status

BE003 is implemented: public `GET /api/v1/locations` reads PostgreSQL and returns ordered, paginated locationId/locationName/nullable detail with the standard response envelope. Invalid, unknown and duplicate query parameters return 422.

Implemented read assignments: BE002, BE005, BE006, BE007, BE008. All assigned catalog, signed-in report and own-claim read endpoints now return their documented real-data responses. Integration coverage checks real PostgreSQL data, validation, pagination and privacy for delivered tasks. See [backend handoff](tasks/BACKEND_ENDPOINT_HANDOFF_TH.md).

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

Each notification contains `notificationId`, `kind` (`PROFILE_UPDATED`, `AVATAR_UPDATED`, `MATCH_SUGGESTED`), UTC ISO `createdAt` and nullable `readAt`. Events commit atomically with actual account changes or an accepted current matching result. No personal-field snapshots, dummy alerts, claim events, email delivery or notification image publishing are implemented. Mark-read preserves events with newer IDs. The client refreshes on opening/focus/account edits and every 10 seconds while visible.

## Item matching and item photos

| Method/path                          | Authentication      | Behavior                                                                             |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------ |
| `GET /matches?before=123`            | Session             | Own current match suggestions, 20 items/keyset cursor, job counts and service status |
| `GET /item-reports/:id/images`       | Session             | `{ imageCount, images }` URLs for up to 3 normalized item photos                     |
| `GET /item-reports/:id/image`        | Session             | Normalized item WebP (`?slot=1..3`, default `1`), 404 if absent                      |
| `GET /item-reports/:id/image/access` | Owner               | `{ hasImage, imageCount, maxImages, slots }` for photo controls; 404 otherwise       |
| `PUT /item-reports/:id/image`        | Owner + same-origin | Raw JPEG/PNG/WebP, <=4 MiB (`?slot=1..3\|next`); stores up to 3 item photos          |
| `DELETE /item-reports/:id/image`     | Owner + same-origin | Clears stored photo (`?slot=1..3\|all`) and compacts remaining slots                 |

See [MATCHING.md](MATCHING.md) for the exact match DTO, privacy, provider contract, cost reservations, retries and release limitations. The dashboard matching panel and its polling were removed at the user's request; the authenticated API remains available. The notification bell uses 10-second polling while visible, not a WebSocket or an instantaneous-delivery guarantee.

| Method / path                    | Authentication       | Behavior                                                                               |
| -------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| GET `/health/live`               | none                 | `{status:"live"}`; no database access                                                  |
| GET `/health/ready`              | none                 | `{status:"ready"}` after bounded database ping; otherwise 503                          |
| POST `/auth/login`               | credentials          | Profile and opaque HttpOnly cookie; previous browser token revoked after valid login   |
| POST `/auth/logout`              | optional session     | Revoke current token and clear cookie; idempotent                                      |
| GET `/auth/me`                   | session              | Own `{userId,name,email}`                                                              |
| GET `/categories`                | none                 | Paginated `[{categoryId,categoryName}]`, ordered by category ID                        |
| GET `/locations`                 | none                 | Paginated `[{locationId,locationName,detail}]` (implemented in BE003)                  |
| GET `/item-reports`              | session              | Paginated reports, optional filters, newest report ID first                            |
| GET `/item-reports/:id`          | session              | Single report or 404 with viewer-specific `isOwner`; reporter identity omitted         |
| POST `/item-reports`             | session              | Create report as current user, `OPEN`; 201                                             |
| PATCH `/item-reports/:id`        | owner session        | Safe field update; other owners/missing reports return 404                             |
| PATCH `/item-reports/:id/status` | owner session        | Report status lifecycle transition (`RESOLVED`, `CLOSED`); non-owner returns 404       |
| GET `/item-reports/me`           | session              | Paginated own reports, newest first, with optional `type`, `status` and `q` filters    |
| GET `/item-reports/:id/claims`   | report-owner session | Paginated claims submitted on owned report; non-owner returns 404 (BE012)              |
| GET `/claims`                    | session              | Own claims only, newest first, with optional `reportId` filter                         |
| GET `/claims/:id`                | claimant session     | Own claim/evidence or non-disclosing 404                                               |
| POST `/claims`                   | session              | Current claimant, supplied report/evidence, DB `PENDING` and timestamp; 201            |
| PATCH `/claims/:id/status`       | report-owner session | Review and approve/reject claim (`APPROVED`, `REJECTED`); non-report-owner returns 404 |

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

IDs in JSON must be positive 32-bit integers. Catalog IDs must already exist. `title` is trimmed, required, max 255; description is nullable/optional, max 10000; image is nullable/optional, max 500, HTTP(S) without credentials or an absolute single-slash application path. No image fetching or file uploading occurs. Date/time must be valid ISO 8601 with timezone. `type`: `LOST` or `FOUND`. Output: `{reportId,categoryId,locationId,type,title,description,image,eventDatetime,status,createdAt,updatedAt}`. Dates serialize as UTC, e.g. `2026-11-04T05:30:00.000Z`. createdAt is submission metadata, distinct from the eventDatetime incident instant; pre-0004 reports use the migration instant because historical submission time is unknown. Report responses omit reporter IDs/profiles. The authenticated detail endpoint adds the viewer-specific boolean `isOwner`.

PATCH accepts only `title`, `description`, `image`, `categoryId`, `locationId`, `eventDatetime`, with at least one field. Nullable fields can be explicitly cleared with `null`. Ownership, type, status, createdAt and updatedAt cannot be supplied or rewritten by clients. PostgreSQL maintains updatedAt on successful UPDATE statements.

Both report lists accept `q` for a case-insensitive literal substring of the report title. It is trimmed and limited to 255 characters. A blank value is equivalent to omitting it, and characters such as `%` and `_` are literal. Search and status (`OPEN`, `RESOLVED`, `CLOSED`) apply before pagination. The dashboard defaults to open reports, while **รายการของฉัน** defaults to all statuses. The signed-in **รายการของฉัน** page at `/reports/mine` uses the owner-scoped list and existing report edit and close endpoints.

Claim creation: `{ "reportId": 1, "evidence": "Private identifying details" }`. Evidence is required after trimming, max 10000. Output to the authenticated claimant: `{claimId,reportId,userId,evidence,status,claimDate,updatedAt}`. Clients cannot supply identity, status, claimDate or updatedAt. Only existing report FK eligibility is enforced; no undocumented LOST/FOUND, self-claim, duplicate-request, lifecycle or approval rule is assumed. The report detail dialog offers submission for other users’ open found reports. Each claimant can view only their own submissions. The report owner reviews incoming claims in the same dialog. Claim approval is a claim status change. Return confirmation uses its existing separate workflow.

## Error statuses

400 malformed/missing JSON; 401 absent/invalid/expired session or credentials; 403 failed origin check; 404 missing/not-owned object; 409 uniqueness conflict; 413 oversized JSON; 415 non-JSON content type; 422 validation/invalid reference/check constraint; 429 account login throttle; 500 sanitized unexpected failure; 503 readiness/connectivity failures. Validation messages do not echo rejected input. Database codes, SQL, stacks and secrets never enter response bodies.

There is no registration, catalog write API, or external notification publishing endpoint. The report lifecycle, claim review, own report feed, and incoming claims feed (BE009–BE012) are implemented with the ownership checks listed above. Matching and item-image payloads and limits are documented in [MATCHING.md](MATCHING.md). Profile photos are private. Item-report images follow the report's visibility.
