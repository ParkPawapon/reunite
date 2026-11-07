# Coming Soon — ก่อนภารกิจเริ่ม

The approved cinematic design is implemented as the public Next.js route `/coming-soon`. Open <http://localhost:3000/coming-soon> after starting the application. Visual approval was provided on 7 November 2026 (Asia/Bangkok).

Launch is **24 November 2026 / 24 พฤศจิกายน 2569, 00:00 Asia/Bangkok**: `2026-11-24T00:00:00+07:00`, equivalent to `2026-11-23T17:00:00Z`.

## Visual direction

A cream frame surrounds a deep orange theatre. The actual Bang Mod campus model is the central scene, with original three-dimensional key/card props, two orbital search trajectories, warm PBR lighting and cached shadows. Agent Honk retains the original layered SVG artwork and uses the existing Motion animation component. The countdown sits in a cream console with a Thai launch date. Outfit, Noto Sans Thai and all colors come from the existing theme; there are no runtime font/CDN/design-service requests.

The [approved version 4 canvas](https://superdesign.dev/teams/2bd0cb6b-a54d-4689-8a42-2fd9dba9cb75/projects/891b933e-284b-4882-976f-a8f92627cb25?node=draft-variant-882d0334-9f2e-4b5b-ab6d-0a2c73772c47) is retained as the design reference. Local design artifacts remain in the ignored `.superdesign/tmp/`; they are not application dependencies.

## Production source

| File under `apps/web/src/`                          | Responsibility                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/coming-soon/page.tsx`                          | Public server composition and metadata; statically prerendered                       |
| `components/coming-soon/coming-soon-experience.tsx` | Page composition, hydration and shared motion policy                                 |
| `components/coming-soon/countdown.tsx`              | Stable-width countdown, launch date and real login destination                       |
| `components/coming-soon/launch.ts`                  | One fixed launch instant and countdown calculation                                   |
| `components/coming-soon/launch-clock.ts`            | Cached external-store snapshot, visibility reconciliation and bounded timer lifetime |
| `components/coming-soon/campus-world.tsx`           | Local poster, lazy scene import, fresh-canvas retry and accessible controls          |
| `components/coming-soon/scene.ts`                   | WebGL lifecycle, orbit/input, resize, visibility and rendering                       |
| `components/coming-soon/scene-geometry.ts`          | Quantization-safe static batching and resource disposal                              |
| `components/coming-soon/scene-props.ts`             | Original 3D clues and orbital locator animation; colors read from theme variables    |
| `components/coming-soon/coming-soon.module.css`     | Scoped responsive composition and motion                                             |

The page loads the existing `/research/kmutt-bangmod/kmutt-bangmod-web.glb`. The local `/coming-soon/bangmod-launch.png` poster was captured from the approved scene. Next Image optimizes the poster. Original model provenance remains available through the footer attribution and `/research/kmutt-bangmod/NOTICE.txt`.

The database, authentication API and root/login/dashboard destinations retain their existing behavior. The generic loading fallback was moved from `app/loading.tsx` to `app/login/loading.tsx`: public announcement HTML must remain visible without JavaScript. Dashboard, profile, map and status routes retain their own loading boundaries.

## Countdown and motion

Server HTML contains the actual date, poster and stable countdown placeholders. Hydration starts a cached `useSyncExternalStore` clock; only the countdown subtree updates. The timer stops at the launch instant, never goes negative, and displays a real `/login` action without automatic redirection. Browser timezone changes do not alter the fixed launch instant. Decorative pause does not pause time.

The original shared `useMotionPolicy` controls the goose, CSS decoration and renderer. Initial text reveals do not restart when motion is resumed. Reduced motion preserves a static scene and manual controls. Hidden tabs stop scene rendering and reconcile the clock on return; the renderer also suspends while outside the viewport.

## Scene lifecycle and fidelity

Three.js is imported separately after hydration, so countdown/date/poster readiness does not depend on the large model. The scene supports drag, arrow-key and button rotation, Home/reset, full horizontal orbit, and polar angles from 0.28 to `Math.PI * 0.48`, excluding underside views. Native vertical touch scrolling is retained.

The frame loop is capped at 30 FPS, with a maximum device pixel ratio of 1.5 on desktop and 1.25 on narrow screens. Shadows are cached. Asset fetches have a 45-second timeout and an abort signal. Unmount, aborted initialization, errors and context loss dispose controls, observers, animation frames, shadow maps, geometries, shared materials/textures, bitmaps and the WebGL context. Module-import failure offers document reload; model/context failure retries with a fresh canvas.

Static batching converts integer/normalized attributes to floating point before applying transforms. It merges compatible primitives only when their rendering properties match, and verifies triangle count and transformed bounds. The approved source retains 39 feature records and 628,128 triangles. The prototype measured approximately 0.0000013 m of bounds change from batching and 220 draw calls including props; these are processing measurements, not surveyed building accuracy. The original GLB and geographic datasets are not rewritten. Existing survey limitations remain in the campus accuracy register.

## Verification

Meaningful unit coverage checks Thai midnight, the final millisecond, day/hour/minute carry, expired values, quantized positions, normalized normals/UVs, material separation and source immutability. The geometry tests live beside the frontend code so they resolve the frontend's Three.js dependency within its workspace.

`tests/browser/coming-soon.spec.ts` verifies the real production build: public SSR and local assets, actual GPU draw suspension during pause, countdown continuity, pixel changes through a complete orbit and keyboard reset, reduced motion, responsive widths 320–1920 px, automated axe WCAG A/AA scans, JavaScript-disabled content, missing WebGL, model HTTP failure, context loss/retry, timezone/deadline boundaries and real login navigation, lazy-chunk reload recovery, visibility/offscreen suspension and a pause chosen during model download. WebGL calls are instrumented only by the test; no debug API is shipped.

Commands:

```sh
bun run typecheck
bun run lint
bun run format:check
bun run test:unit
bun run test:integration
bun run build
bun run test:browser
```

The browser suite uses the managed disposable database on port 3100. The user's normal local data is not reseeded. Current command outcomes are recorded in `docs/VERIFICATION.md`; screenshots are local QA artifacts under `tmp/coming-soon/`.

Physical-phone frame rate, thermal behavior and hosted deployment/CI are outside the executed local checks. Browser mobile layouts are emulated; the local renderer does not certify the existing model as an as-built survey.
