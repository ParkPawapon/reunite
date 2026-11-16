# Dashboard: lost and found report board

## Current design (FE008, 2026-11-15)

The signed-in home page is a table with two tabs: **ของหาย** (owners reporting something they lost) and **ของที่พบ** (people reporting something they found). The heading is **ช่วยกันหา พากลับคืน**. Short Thai copy, the existing KMUTT color tokens, Outfit/Noto Sans Thai typography, shared sidebar/topbar/footer and existing stroke icons remain the design system. The navigation and page title use **หน้าหลัก**.

The user's brief requests a minimal interface without AI imagery. The existing screen and that brief are the visual reference; no generated art, new palette, promotional hero, fake statistics or unrelated features were introduced. The previous campus welcome components remain available in the repository, and the real map is still accessible from the sidebar.

The subsequent November 16 request removes the entire “อาจเป็นของชิ้นเดียวกัน” panel. The report board now follows the page heading directly. Its matching-specific component, styles and client schema are removed, and the dashboard no longer polls the matching endpoint. Backend matching remains separate; match notifications link to the existing dashboard rather than a removed anchor.

## Components and data boundaries

| Component                                             | Responsibility                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `components/dashboard/dashboard-content.tsx`          | Tabs, request lifecycle, pagination, retry and selected report       |
| `components/dashboard/report-table.tsx`               | Semantic table, status labels, dates, skeleton rows and empty state  |
| `components/dashboard/report-detail.tsx`              | Accessible read-only detail dialog with a fresh API response         |
| `components/dashboard/dashboard-skeleton.tsx`         | Route fallback matching the board geometry                           |
| `modules/item-reports/presentation/reports-client.ts` | Validated HTTP transport and catalog-name lookup                     |
| `components/shell/*`                                  | Shared navigation, account controls, notifications and motion policy |

The page retains its server-side session guard. Client components call the existing public report/category/location APIs; no SQL, database credentials or session tokens enter the client bundle. Backend rules and schema are unchanged.

List requests use `type=LOST` or `type=FOUND`, ten visible rows and one look-ahead row. Pagination shows the actual range on the current page; no total is fabricated. Changing tabs resets to page one. Old requests are aborted and late responses cannot overwrite the selected type. Categories and locations are read through their existing paginated endpoints, rather than assuming the first catalog page contains every name. Report responses are validated before display and HTTP failures use fixed, safe Thai copy.

Rows show item name/description, category, location, incident date and status. The incident date uses Asia/Bangkok and remains separate from the submission date displayed in the dialog. Reports are ordered by the API's descending report ID. Detail requests fetch the current public DTO, never private claim evidence or reporter profiles. Referenced images open only after a user action, in a separate tab with `noopener noreferrer`; untrusted protocols/credentials are rejected. This does not add item-image uploads.

## Interaction, loading and accessibility

- MUI tabs support arrows, focus and selection, with a shared labelled tabpanel.
- A real request drives the skeleton. Empty, failed and loaded results have distinct copy. Refresh and retry execute real requests, with bounded network timeouts.
- Horizontal scrolling stays inside the semantic table on narrow displays. Empty-state content stays within the visible board rather than the table's minimum width. The complete page must fit widths 320–1440 px, including enlarged text.
- The detail dialog supports Escape, focus trapping and focus restoration. Dates use semantic `time` elements, headers use `scope`, and status text accompanies every color marker.
- The November 16 detail-modal redesign adds a clearer title/location hierarchy, a compact photo section, matching Skeleton and contained image preview. [Modal design and component ownership](report-detail.md) records the final layout, copy and interaction checks.
- Skeleton waves and short feedback honor the shared motion preference and device reduced motion. No artificial loading delay was added.

The board displays actual API data, including the genuine empty state when no reports exist. The user subsequently authorized the manual local seed of twenty LOST and twenty FOUND reports (2026-11-16); their descriptions explicitly identify them as fictional data. Browser acceptance fixtures remain separate, inserting synthetic reports only into the managed disposable schema in the separate test database.

## Verification

The dashboard tests cover protected access, real PostgreSQL data, both tabs, pagination/reset, current details, empty/error/retry behavior, late responses, navigation, logout, motion, responsive layout and automated axe checks. Existing login/profile/notification/3D acceptance checks remain enabled. See `docs/VERIFICATION.md` for executed results and their limits; automated checks do not certify physical devices or complete accessibility conformance.

Visual review compares the existing screen and the user's table/tab brief with the rendered implementation: the existing palette and fonts are retained, headings use the agreed short copy, the 248/88 px shell remains shared, all five table data columns are present, and responsive overflow is confined to the table. The old hero/map arrangement is intentionally replaced by the requested board. IAB confirmed both tab states at 1280×720; automated production-browser checks cover 320–1440 px. No material discrepancy from the requested table/tab behavior remained in those checks.
