# Security baseline

Passwords use Argon2id (19 MiB memory, 2 iterations, parallelism 1), random salts and bounded input. Unknown users incur a dummy hash verification and receive the same credential error. Opaque session tokens contain 256 bits of randomness; only SHA-256 token digests are stored. Login generates a new token and revokes the previous supplied browser token; expired tokens are rejected and logout deletes the token. Cookies are scoped to `/`, HttpOnly, SameSite=Lax, with Secure under production Node. Set an HTTPS APP_BASE_URL for production.

Every mutation validates exact configured Origin, rejects missing/null/foreign Origin and cross-site fetch metadata. CORS is not enabled. SameSite is defense in depth; it does not replace Origin checking. Requests made with non-browser clients also need the explicit Origin header. Trust no forwarded IP/host or inbound request ID for authorization.

Ten login attempts per normalized account identifier are allowed per fixed 15-minute DB window, shared atomically across instances. Successful attempts also consume the budget; callers receive 429 after exhaustion. The key is a SHA-256 account digest, which is pseudonymous, not anonymous. This limits per-account guessing but does not prevent distributed attacks across many accounts, resource exhaustion or deliberate account lockout. Production edge/global rate controls and monitoring remain operational requirements. No untrusted proxy-IP policy is invented.

All SQL values are parameterized; identifiers are application-owned. Ownership is checked in the report application service and scoped UPDATE predicate. Claim queries always scope to the claimant; even a report owner cannot read another user's evidence under the current privacy default. Personal user profiles/password hashes are excluded from public report output. Authenticated own profile/evidence responses are private and no-store. Public report text/images are author-supplied; no image is fetched, uploaded or rendered by this foundation. Approve a report-publication/privacy policy before public launch.

Responses sanitize exceptions. Structured logs contain only method, generated request ID, status and duration; no URL/query, credentials, tokens, names, evidence, raw DB errors or request bodies. Security headers include nosniff, frame denial, referrer policy, disabled camera/mic/location, and a CSP for frame ancestors/base/object sources. This is a baseline CSP, not a complete nonce-based script policy. HSTS and TLS termination belong to the HTTPS deployment configuration and are not claimed for local HTTP.

`server-only` protects infrastructure imports; shared/client code contains no server implementation. Runtime DB configuration rejects URL TLS overrides and never sets certificate verification false for TLS. Production should use least-privilege credentials distinct from migration/bootstrap credentials. Secrets and temporary DB files are ignored in Git/Docker context. Never publish generated `.next` or env files as public artifacts.

Migration 0004 enforces canonical lowercase/trimmed email with the existing unique constraint, nonblank required text and database-maintained update timestamps. Conflicting legacy data aborts the migration without silent repair or deletion. Business foreign keys remain non-cascading. `db:cleanup-auth` previews only expired technical auth state; explicit `--apply` removes bounded batches transactionally and skips locked rows. It never purges users/reports/evidence or substitutes for a business retention policy. No scheduler or claim deduplication/approval rule is introduced.

## Release requirements still open

- Approved onboarding/provisioning and account recovery policy; the only provisioning CLI is explicitly for non-production.
- Claim eligibility/approval authority, report lifecycle and public-read policy.
- PDPA/privacy notice, consent/lawful processing, access/erasure and retention policy for identities, reports, evidence, hashed throttling keys and expired sessions. This scaffold makes no legal-compliance claim.
- Approved scheduled cleanup, backups/restore rehearsal, production TLS/proxy/secret management, least-privilege roles, edge abuse limits and monitoring.
- Item-report attachment storage/validation policy and AI methodology before implementing those capabilities. Private profile-photo validation/storage is implemented separately as described below.

No admin roles, reset-password flow, OAuth provider, AI scores or approval actions are fabricated.

## Student profile and account notifications

The new profile, photo and notification routes authenticate every read and mutation. Identity is session-derived; callers cannot select another account. Student/contact data and normalized photo bytes never enter public auth DTOs, logs, static output or shared browser storage. Mutations enforce Origin. Changing the login email requires the current password and a separate database-backed confirmation budget; there is no unimplemented verification badge or verification-mail promise.

Avatar bodies are streamed with a 2 MiB limit even without Content-Length. Only still JPEG/PNG/WebP with matching decoded format are accepted; decoder pixels and processing time are bounded. Re-encoding strips EXIF/GPS and embedded originals. Files are not served by uploaded names, URLs or filesystem paths. Authenticated GET serves only WebP with no-store, nosniff and same-origin resource policy. Stored bytes are bounded to 128 KiB per user. PostgreSQL backups now contain those photos, so production retention and erasure policy must include them. The native decoder remains a dependency requiring routine patching and deployment resource limits.

Notifications are private typed account events without user-provided HTML, messages or personal-data copies. Profile/photo updates and event insertion are atomic. Reading is owner-scoped and bounded by the fetched ID; newer arrivals stay unread. There is no notification composer, broadcast endpoint or fake activity feed. Email/push delivery and business-specific triggers require separately defined behavior.
