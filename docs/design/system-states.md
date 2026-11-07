# Reunite system states

Concept: “ทุกเส้นทาง มีทางไปต่อ”. The established Agent Honk, supplied palette and Outfit/Noto Sans Thai connect the pages. Each status has its own Thai explanation, illustrated SVG prop and recovery action. Access pages use an identity/ticket composition; 408/429 use a centered waiting composition; 500/503 reverse the story/copy order, with a quiet station divider for 503. The remaining scenes retain the shared hierarchy with distinct illustrations. Original goose artwork is reused, without new bitmap synthesis or third-party artwork.

## Implemented states

| Family         | Codes                                                      | Illustration concepts                                                                                                                                            |
| -------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect       | 301, 302, 303, 307, 308                                    | Moved postbox, detour cone, receipt, bridge, new signpost                                                                                                        |
| Client/request | 400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 429 | Mixed papers, ID badge, access gate, lost trail, turnstile, hourglass, overlapping records, empty frame, oversized suitcase, folder, missing puzzle piece, queue |
| Server/service | 500, 501, 502, 503, 504                                    | Tangled clue thread, unfinished blueprint, radio signal, tea break, clock                                                                                        |

The gallery is `/research/system-states`. `/status/<code>` routes are explicitly labeled **design previews** and intentionally return HTTP 200 with noindex metadata; they do not fabricate an outage or redirect. Only the allowlisted 22 codes exist. 304 has no content UI because it is a cache-validation response. No payment or other unrelated business feature is inferred from HTTP code lists.

## Actual application behavior

- Unmatched URLs return the real 404 page, with usable server-rendered content and recovery links even without JavaScript. Route-level `not-found.tsx` uses the same visual.
- Root, dashboard, profile and global error boundaries use the 500 scene and the installed Next 16.4 `retry()` callback. Retry refetches the failed segment; it is not a fake success state. No error messages, SQL details or account data are rendered.
- The installed Next.js `experimental.globalNotFound` option and `global-not-found.tsx` provide a complete 404 document without depending on a streaming swap or the normal app providers. The generic loader is now scoped to login; route-specific loading boundaries remain. This is an explicitly enabled experimental Next feature; keep the no-JS/HTTP checks when upgrading Next.
- Global error/not-found documents include their own html/body, fonts and CSS, so they do not depend on the failed layout's MUI provider. Font definitions are shared with the normal layout.
- Existing 3xx redirects retain their real Location/status behavior. Protected routes continue to send unauthenticated users to login. Existing API errors stay sanitized JSON with no-store/request IDs; validation errors do not navigate away from a partially completed form.
- Proxy-origin 502/503/504 responses that never reach Next are not intercepted by these components. A deployment proxy can use the supplied designs through its own error-page configuration. This revision does not claim that external infrastructure is configured.

## Motion and loading

Illustration breathing, prop movement and a small sparkle have independent restrained loops. Pause freezes them, hidden documents stop movement, and reduced motion gives static artwork. Body text and real recovery links remain readable in server HTML. No invented countdown, loading percentage or timed redirect is shown. Preview route navigation has a lightweight shape Skeleton. Actual error retries keep the explanation visible while the framework refetches.

## Verification and references

The browser suite opens all 22 pages and checks distinct SVG scenes, three widths (1440/390/320), no overflow, noindex, useful controls and selected automated WCAG A/AA rules. It checks real 404 status, actual root redirect, unchanged JSON 401, pause/resume/reduced motion and no-JavaScript recovery. A separate recovery test introduces read latency and a missing table only in the current registered disposable `_test` schema, verifies the profile Skeleton/500 boundary, restores the table in finally and verifies actual retry recovery. The expected server error in that test is deliberate, not a normal database migration or a production fault.

Selected primary references reviewed on 2026-11-06: [Oil UI](https://github.com/oil-oil/oil-ui), [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [Taste Skill](https://github.com/Leonxlnx/taste-skill), [MUI Skeleton](https://mui.com/material-ui/react-skeleton/), [Motion layout](https://motion.dev/docs/react-layout-animations) and the installed Next.js error/not-found/loading documentation. [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) inform the distinction between redirects, errors and previews. References guide the work; no external repository scripts were installed. Automated checks do not constitute accessibility certification or physical-device verification.
