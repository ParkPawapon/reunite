# API contract v1

## Catalog assignment status

BE003 is implemented: public `GET /api/v1/locations` reads PostgreSQL and returns ordered, paginated locationId/locationName/nullable detail with the standard response envelope. Invalid, unknown and duplicate query parameters return 422.

BE002 remains reserved for its assignee: `GET /api/v1/categories` still returns 501 NOT_IMPLEMENTED. Its target contract below remains the assignment specification. Integration checks now validate real location data and retain the category starter assertion. See [backend handoff](tasks/BACKEND_ENDPOINT_HANDOFF_TH.md).

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
