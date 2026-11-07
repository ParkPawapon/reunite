# Dashboard and shared application shell

## Concept and scope

“สถานีเพื่อนช่วยหา” continues the Agent Honk login with the supplied KMUTT palette, Outfit and Noto Sans Thai. A deep burnt-orange sidebar anchors the white topbar and warm illustrated introduction. Cream active navigation, the yellow wordmark dot and a small existing goose illustration reinforce the detective's outfit. The topbar separates page context, account notifications, motion preferences and the real account. A compact brand signature finishes the footer; its map/tour links were removed at the user's request. An actual campus render connects the landing page to its working map. There are no invented report counts, activity feeds, search controls or unavailable menu destinations. See [profile and notifications](profile-notifications.md) for the later user-authorized account features.

Successful login opens `/dashboard`. The map remains at `/research/kmutt-bangmod`; ordinary document links preserve its separate geolocation permission policy. The university Virtual Tour is an external link with a new-tab label. BE003 is integrated: locations return real paginated PostgreSQL data. BE002 remains assigned to its teammate, and categories retain the explicit 501 starter.

## Component boundaries

| Component                                        | Responsibility                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `components/shell/app-shell.tsx`                 | Responsive frame, navigation state, shared motion policy and skip link  |
| `components/shell/topbar.tsx`                    | Menu toggle, animation pause and actual session account/logout controls |
| `components/shell/sidebar.tsx`                   | Brand and working navigation, shared by desktop and mobile Drawer       |
| `components/shell/footer.tsx`                    | Brand signature without navigation links                                |
| `components/shell/app-shell-skeleton.tsx`        | Complete frame fallback without personal data                           |
| `components/dashboard/dashboard-content.tsx`     | Welcome, shared mascot and map guidance                                 |
| `components/dashboard/campus-preview.tsx`        | Fixed-size image, real image download state and useful error fallback   |
| `components/dashboard/dashboard-skeleton.tsx`    | Reserved content geometry during route loading                          |
| `modules/auth/presentation/require-page-user.ts` | Server-side page guard using the existing session parser/service        |
| `modules/auth/presentation/logout-client.ts`     | Same-origin logout transport with success validation                    |

The Next.js page composes these parts. SQL, authentication policy and database schema remain in their established modules. User name/email come from the current server-verified session. No credentials or tokens are passed to client components or browser storage.

The page guard awaits request headers before reading runtime configuration or creating services. Protected pages therefore render per request, and the production/Docker build does not need deployment-only `APP_BASE_URL` or database credentials. Runtime configuration validation and session checks remain enforced when a real request arrives.

## Loading and motion

The content refinement separates `DashboardWelcome`, `CampusPreview` and `DashboardShortcuts`. The welcome gives the map one clear primary action; the side panel links to the existing personal profile and university Virtual Tour. Copy is shorter and the hero is more compact. The matching Dashboard Skeleton mirrors these sections. No unimplemented search, counts or report activity is added.

The latest toolbar revision keeps only the single-line page title, an icon-only motion control and a light account button. The campus badge, visible animation label, duplicate account caption and breadcrumb trail are removed. Account skeletons reserve the same avatar/name geometry as the ready toolbar.

Desktop sidebar tracks interpolate over 280 ms with aligned navigation rows; interrupted toggles retarget the current transition. Mobile Drawer enters over 240 ms and exits over 200 ms. Content sections reveal over 380 ms with a short 60 ms stagger. The image crossfades over 320 ms, its skeleton cover fades over 280 ms, and skeleton waves use a 1.65-second cycle. These are feedback durations, not resource readiness timers. Sidebar layout interpolation is confined to the dashboard's small grid; illustration/image feedback uses transform and opacity. Device reduced motion disables these transitions.

The route `loading.tsx` renders the shared shell and dashboard skeleton during streaming. Placeholder shapes are hidden from assistive technology; one polite status and `aria-busy` describe loading. No artificial dashboard delay is introduced. The campus image separately keeps its reserved 200 px area and wave skeleton until its real `onLoad` or `onError` event. On resolution the decorative cover fades out and its hidden animation stops. A failed preview retains a working map link.

The existing Motion mini goose animation is reused. The topbar pause control, live reduced-motion preference and document visibility stop continuous illustration/skeleton movement. Mobile Drawer and account-menu transitions are disabled for reduced motion. Other feedback uses short opacity, arrow and hover transitions. Desktop navigation changes between full labels and an icon rail; mobile uses MUI's modal focus management, Escape dismissal and focus restoration.

Missing, malformed, duplicate, expired or unknown sessions redirect to login. With Next.js streaming this can be an HTTP redirect or a streamed redirect meta tag; neither path renders the authenticated dashboard. Dashboard errors show a retry action without exposing server details. Logout uses the real API, prevents duplicate requests, aborts after 15 seconds, retains an actionable error on failure and returns to login after confirmed revocation.

## References and verification

Reviewed 2026-11-06: [Oil UI](https://github.com/oil-oil/oil-ui) informed product-specific composition and screenshot review; [MUI Drawer](https://mui.com/material-ui/react-drawer/) informed mobile focus handling; [shadcn Sidebar](https://ui.shadcn.com/docs/components/sidebar) informed frame/component separation; [MUI Skeleton](https://mui.com/material-ui/react-skeleton/) informed loading placeholders; [Motion useAnimate](https://motion.dev/docs/react-use-animate) informed scoped animation. These are selected primary references, not an exhaustive repository survey. No third-party design scripts or skills were installed.

[Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) informed real links, reduced motion and compositor-friendly feedback. The [UI UX Pro Max repository](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) was also reviewed for design-system consistency. The project's existing palette and typography remain authoritative.

The [dashboard artboard](https://p.superdesign.dev/draft/c0ed6185-e452-4a77-ab83-0e4ecf139fbd) records the visual direction. The running application and screenshots are used for interaction and visual verification.

Browser checks use a disposable account in an isolated test database. Coverage includes login landing, session rejection, real profile data, desktop collapse, mobile Drawer/focus, responsive overflow, selected automated WCAG A/AA checks, pause/reduced motion, delayed/failed image loading and failed/successful logout. Existing login, loading-screen and map checks stay enabled. Automated checks are not a claim of full accessibility certification or physical-device validation.

Run formatting, lint, strict typecheck, unit/integration tests, production build and `bun run test:browser` using the documented isolated database setup. Do not seed production data for visual review.
