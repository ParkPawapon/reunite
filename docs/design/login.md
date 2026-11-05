# Reunite login

## Concept

“เพื่อนช่วยหา” introduces Agent Honk as a friendly helper who helps important belongings find their way home. The desktop composition pairs a warm illustrated scene with a quiet white form. The goose, binoculars, key and dotted trail carry the story; the email and password fields remain the primary task. Mobile uses a short brand/mascot header followed immediately by the form. The supplied orange palette, Outfit and Noto Sans Thai connect the page to the existing loading screen.

The goose's head and neck were redrawn as a continuous S curve, with a narrower neck, a smaller hat, a visible eye and a bill beneath the binoculars. The SVG remains editable; its React component is generated from the same source. Motion is shared between the loading screen and login, rather than creating a second mascot animation system.

## Implemented behavior

- `/` redirects to `/login`. A fresh visit displays the central loading screen for 2,000 ms after client hydration, then reveals the form and focuses its heading. The delay is explicitly requested for this intro; the campus map still follows actual resource readiness.
- Email/password validation uses the existing shared API schema. Email is normalized, passwords retain spaces and the existing 128-character limit. Autofill, keyboard navigation, show/hide password, field-specific errors and a submit status are supported.
- Focusing the password control closes the goose's eye and pauses its movement. The pause control, live reduced-motion preference and document visibility also control animation. The eye gesture is decorative, not a security mechanism.
- Login calls the existing same-origin API. It uses its HttpOnly, Secure, SameSite=Lax session cookie. Credentials and tokens are not stored in browser storage, URLs or client logs. The UI handles invalid credentials, throttling, service failures, malformed success responses, connection loss and a 15-second request timeout. Concurrent submission is guarded synchronously.
- Success opens the existing campus map using a full document navigation so its geolocation permission policy is applied. The map remains available through its existing public link. No new dashboard, SSO, signup or recovery service is implied.
- JavaScript-disabled rendering includes an explanatory notice in the intro and the enclosing Next.js streaming fallback.

`apps/web/src/components/auth/` contains the form and scoped styles. The API adapter and validation remain in `modules/auth/presentation/`; domain/application logic and handwritten SQL remain in their existing layers. The page is a thin Next.js composition boundary. No authentication policy or database schema changed for this design.

## References

Reviewed on 2026-11-05. The [loading-screen reference research](loading-screen.md#reference-research) records the GitHub repositories reviewed for Codex-compatible design guidance. These are selected references, not an exhaustive GitHub survey or an independently verified ranking of design quality.

The [official MUI sign-in templates](https://mui.com/material-ui/getting-started/templates/) and [source component](https://github.com/mui/material-ui/blob/master/docs/data/material/getting-started/templates/sign-in/SignIn.tsx) informed field hierarchy and responsive form spacing. Their sample social buttons, credential logging and demo handlers were not adopted. Motion behavior follows the [official scoped animation API](https://motion.dev/docs/react-use-animate). Automated accessibility checks use [Deque's Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright).

The [Superdesign project](https://superdesign.dev/teams/2bd0cb6b-a54d-4689-8a42-2fd9dba9cb75/projects/891b933e-284b-4882-976f-a8f92627cb25) preserves the supplied palette references and the [login visual draft](https://p.superdesign.dev/draft/45cdb14c-e788-46b2-909e-3c93cb5baaa9). The running application is the source for interaction verification.

## Verification

```powershell
bun run design:tokens:check
bun run design:mascot:check
bun run format:check
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run build
bunx playwright install chromium
bun run test:browser
```

Browser tests run the production build at `http://localhost:3100`. `TEST_DATABASE_URL` must identify a separate database whose name ends in `_test`; local use can place it in the ignored `.env.test`. The test server migrates a random isolated schema and provisions only a disposable test account there. The teardown records and removes that exact schema, including after Windows terminates the server process. It does not seed or clear the application's normal data. `PLAYWRIGHT_BASE_URL` can target an already-running preview; the real-auth fixture test is explicitly skipped in that mode.

The suite covers the two-second transition, form errors, password visibility, privacy pose, duplicate requests, API/network/timeout errors, JavaScript-disabled rendering, five viewport sizes, keyboard focus, 200% font sizing, selected automated WCAG A/AA rules and real login/session/logout behavior. The existing loader/map success and failure checks remain included. Automated checks do not constitute complete WCAG certification or physical mobile-device validation. Deployment still requires the existing provisioned accounts and production environment configuration.
