# Agent Honk loading screen

The Reunite loading screen contains one original goose illustration, one short loading message and an accessible pause control. The user requested a centered composition with much less copy, a cuter character and more balanced proportions. Headers, campaign lines, corner notes and decorative clue cards were removed from the delivered UI.

## Character and motion

Agent Honk is a friendly goose detective: a rounded white head, a narrower continuous S-shaped neck, peach trench coat, soft fedora, small webbed feet and binoculars. The body sits between the two feet; the tail balances the binoculars on the other side. The outline uses a consistent warm brown, with lighter inner seams and small cheek accents. The two sleeved wings connect at the shoulders and grip the binoculars. The drawing is an original editable SVG authored in code.

The 6.4-second loop looks in either direction, pauses to observe and blinks. A slower 3.2-second breathing motion and a small foot movement add life without moving the surrounding layout. Motion 14.9.1's `motion/react-mini` drives the SVG through native browser animations. React state updates only for controls and browser preferences, not on every frame.

The screen follows the actual Suspense or map-loading lifecycle. It has no invented progress percentage or simulated search result. The shared resource loader has no minimum waiting period; the separately requested login welcome sequence lasts 1.3 seconds after hydration and includes a form skeleton. The map retains its initial 2D view and existing success/error fallback. The static preview is at `/research/loading-screen`; it remains visible intentionally for design inspection.

The pause button has a 44 × 44 CSS-pixel target and an accessible name. Browser motion preference changes are observed with `matchMedia` and `useSyncExternalStore`, including changes made while the page is open. The screen stops moving in a hidden document and resumes only when appropriate. The server renders a static pose first, so hydration and JavaScript-disabled rendering remain useful. The SVG is decorative; a single polite, atomic status message announces the actual loading state.

## Source files

- `apps/web/public/illustrations/agent-honk.svg`: editable vector artwork, with transparent surroundings.
- `scripts/generate-mascot.mjs`: generates the inline React artwork and binds all its colours to palette variables. It rejects external images, scripts and event attributes in the vector source.
- `apps/web/src/components/loading/`: shared view, scoped styles and Motion lifecycle.
- `apps/web/src/app/loading.tsx`: route Suspense fallback.
- `apps/web/src/app/research/kmutt-bangmod/campus-loading.tsx`: adapter for the existing map-loading boundary.

## Palette

`apps/web/src/theme/colors.json` is the source for the supplied brand colours, all eleven orange steps, the light/dark status pairs and semantic UI roles. The background, white surface and dark ink follow the supplied visual reference. Muted text and border neutrals supplement those values. Dark status values are stored for future use; this change does not introduce a dark-theme switch.

`scripts/design-tokens.mjs` generates 43 CSS variables. MUI reads the same JSON through `colors.ts`, and Tailwind exposes semantic aliases through `globals.css`. Outfit and Noto Sans Thai remain the typefaces.

The brand orange `#FA4616` has 3.53:1 contrast against white. Primary controls use the supplied orange 600, `#C83A13`, which has 5.16:1 against white. Normal-size muted text has 5.97:1 against the page background. Nine unit cases enforce at least 4.5:1 for normal text and functional roles. These checks cover the selected pairs, not certification of an entire application.

## Reference research

Reviewed on 2026-11-05. These are relevant repositories, not an exhaustive list of GitHub or an independent ranking of visual quality. Their documentation was used as reference; the illustration and component are specific to this project.

| Repository / primary source                                                                                  | Relevant guidance used here                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [Oil UI](https://github.com/oil-oil/oil-ui)                                                                  | A product-specific visual concept, one focal point and browser screenshot review.                                |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill)                                                       | A consistent direction and inspection at real desktop and mobile sizes.                                          |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)                                     | Separation of visual tokens, typography, accessible colours and interaction rules.                               |
| [Frontend Design for Codex / Claude / Gemini](https://github.com/Ilm-Alan/frontend-design)                   | Concrete visual decisions and consistent tokens. The supplied palette takes precedence over its example presets. |
| [Anthropic frontend-design reference](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Distinctive imagery and visual hierarchy related to the actual product.                                          |
| [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills)                                           | Reduced-motion support, focus states, semantic markup and restrained React work.                                 |
| [Motion](https://github.com/motiondivision/motion)                                                           | Installed runtime dependency, pinned to 14.9.1 under MIT.                                                        |

Implementation APIs were checked against the [Motion installation guide](https://motion.dev/docs/react-installation), [scoped animation controls](https://motion.dev/docs/react-use-animate), [accessibility guide](https://motion.dev/docs/react-accessibility) and [bundle-size guidance](https://motion.dev/docs/react-reduce-bundle-size). Next.js loading conventions were read from the documentation bundled with the installed Next.js version.

The Superdesign project retains the palette references and draft history: [Agent Honk canvas](https://superdesign.dev/teams/2bd0cb6b-a54d-4689-8a42-2fd9dba9cb75/projects/891b933e-284b-4882-976f-a8f92627cb25). Later user instructions to reduce copy and improve character proportions supersede the initial design draft.

## Verification

```powershell
bun run design:tokens:check
bun run design:mascot:check
bun run test:unit
bun run lint
bun run typecheck
bun run build
bunx playwright install chromium
bun run test:browser
```

The browser suite covers five viewport sizes, real animation/pause/resume, initial and live reduced-motion changes, simulated document visibility, preserved keyboard focus, static server rendering without JavaScript and actual map loading success/failure. CI installs Chromium and runs the suite against the production server after building. Browser checks do not replace physical-device testing.
