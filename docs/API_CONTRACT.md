# API contract v1

## Backend task starter (BE002 / BE003)

The handoff revision deliberately removes the category/location list implementations for the two assignees. Both GET endpoints currently return HTTP 501 with `error.code: NOT_IMPLEMENTED` through the existing error wrapper. Their former HTTP orchestration, application implementation and SQL adapters have been removed; domain/service contracts, route wiring and database tables remain. The list behavior and pagination described below are the target contracts to restore, not currently implemented behavior for these two endpoints. See [the assignment and spoken handoff](tasks/BACKEND_ENDPOINT_HANDOFF_TH.md).

Existing automated checks remain enabled. The existing catalog integration case now verifies both explicit 501 responses, request IDs, no-store headers and service placeholders; its unauthorized/cross-origin write assertions remain active. The integrator must restore assertions against real seeded catalog data and 200 responses when each endpoint is implemented. No test skips or relaxed CI rules are introduced. The teammates' assignments do not include writing tests.

Base path: `/api/v1`. JSON success: `{ "data": ... }`, with `{ "meta": { "limit": 20, "offset": 0 } }` for lists. Errors: `{ "error": { "code": "NOT_FOUND", "message": "Report not found", "requestId": "generated UUID" } }`. Every response includes `X-Request-Id` and `Cache-Control: no-store`. Incoming request IDs are not trusted. Unsupported HTTP methods are handled by Next.js (405).

All list endpoints accept `limit` (integer 1–100, default 20) and `offset` (0–100000, default 0). Reports/claims sort by descending primary key; categories/locations ascending. Offset pagination can shift under concurrent inserts; no total count is claimed. Unknown or duplicate query parameters are rejected.

| Method / path             | Authentication   | Behavior                                                                             |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| GET `/health/live`        | none             | `{status:"live"}`; no database access                                                |
| GET `/health/ready`       | none             | `{status:"ready"}` after bounded database ping; otherwise 503                        |
| POST `/auth/login`        | credentials      | Profile and opaque HttpOnly cookie; previous browser token revoked after valid login |
| POST `/auth/logout`       | optional session | Revoke current token and clear cookie; idempotent                                    |
| GET `/auth/me`            | session          | Own `{userId,name,email}`                                                            |
| GET `/categories`         | none             | Currently 501; BE002 restores `[{categoryId,categoryName}]`                          |
| GET `/locations`          | none             | Currently 501; BE003 restores `[{locationId,locationName,detail}]`                   |
| GET `/item-reports`       | none             | Paginated reports; optional `type`, `status`, `categoryId`, `locationId`             |
| GET `/item-reports/:id`   | none             | Single report or 404                                                                 |
| POST `/item-reports`      | session          | Create report as current user, `OPEN`; 201                                           |
| PATCH `/item-reports/:id` | owner session    | Safe field update; other owners/missing reports return 404                           |
| GET `/claims`             | session          | Own claims only                                                                      |
| GET `/claims/:id`         | claimant session | Own claim or non-disclosing 404; report ownership grants no access                   |
| POST `/claims`            | session          | Current claimant, supplied report/evidence, DB `PENDING` and timestamp; 201          |

## Requests and output

Mutations require an `Origin` equal to configured `APP_BASE_URL`'s origin, including login/logout. Missing, `null`, cross-site and foreign origins return 403. JSON bodies require `Content-Type: application/json`, are capped at 32 KiB even when chunked, and reject unknown fields. GETs have no cross-origin allow headers. Browser authentication is same-origin.

Login body: `{ "email": "person@example.test", "password": "user supplied" }`. Email boundary whitespace is trimmed and email is lowercased consistently with provisioning and database storage; password whitespace is preserved and length bounded at 128. Wrong/unknown credentials share 401 `INVALID_CREDENTIALS`. Ten attempts per normalized account identifier per 15-minute fixed window are allowed, including successful attempts; later attempts return 429 `RATE_LIMITED`. This DB-backed counter is shared across app instances.

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

There is no registration, catalog write API, status-transition API, claim approval endpoint, matching endpoint, upload endpoint or notification system.
