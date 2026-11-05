# Login loading refinement

## Visual direction

Agent Honk's search desk carries the existing “เพื่อนช่วยหา” concept. An outlined viewfinder, a small illustrated route card, the yellow key and a slow dotted trail give the existing vector goose a more deliberate setting. They are decorative drawings, not geographic data or search results. The login task remains a single email/password form with a clear primary action. The supplied palette and Outfit/Noto Sans Thai typography remain in use. The removed English field captions and administrator-account sentence remain absent.

The skeleton occupies the same shell and control geometry as the final form. Text and fields fade in place, so entrance transforms do not displace the reserved positions. Mobile keeps the compact mascot header and hides the larger scene decorations. No new account, SSO or recovery features are introduced.

## Loading and motion

The welcome lasts 1,300 ms after hydration, including the first 600 ms of central goose and the following skeleton stage. The separate form chunk downloads from the start. A slow download continues to show the skeleton until it genuinely resolves; failure or a 15-second module timeout shows a reload action. Authentication submission retains its separate pending state and request timeout.

The existing Motion mini animation drives the goose. CSS adds a small key float, a slow trail and short opacity transitions. MUI Skeleton supplies the wave. The shell's pause control stops the continuous scene and skeleton animations. Reduced-motion preferences stop them, including live preference changes, and hidden documents pause the animation. The skeleton contains no focusable dummy inputs. A polite status describes readiness; the real form preserves keyboard focus already placed on the scene controls.

## Reference research

Reviewed 2026-11-05. These are selected primary references, not a complete GitHub inventory or a claim that every referenced project guarantees visual quality. Repository instructions were consulted as design references without installing third-party skills or running their scripts.

| Source                                                                   | Decision informed                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [Oil UI](https://github.com/oil-oil/oil-ui)                              | Start from the actual product/character, choose one coherent scene and review browser screenshots. |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill)                   | Restrained interactions, a consistent design system and concrete browser review.                   |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Consistent spacing, contrast, focus and motion rules.                                              |
| [Frontend Design](https://github.com/Ilm-Alan/frontend-design)           | Codex-compatible frontend design reference already reviewed for the original login.                |
| [Official MUI Skeleton](https://mui.com/material-ui/react-skeleton/)     | Rounded/text placeholder geometry and wave animation.                                              |
| [Official Motion useAnimate](https://motion.dev/docs/react-use-animate)  | Scoped native animation and cleanup.                                                               |

Installed Next.js lazy-loading documentation was read before splitting the component. The illustration remains the existing project SVG with code-authored scene details; no external mascot or stock artwork is copied.

## Verification scope

The browser suite checks the 1.3-second welcome deadline with Playwright's controlled browser clock and cached form code, independently of host scheduling or cold download/compilation time. Separate real-time cases delay the actual form chunk on desktop and mobile, compare skeleton/control geometry, check skeleton accessibility and motion controls, and abort/retry the chunk. A request held beyond the 15-second module timeout also verifies that the reload action restores the form. Real login/session/logout and map resource checks remain included. Style/lint/type/build, unit and PostgreSQL integration checks remain required. These checks cover the implemented behavior and selected automated accessibility rules, not physical-device certification.
