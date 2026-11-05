# Bangmod viewer measurements

Measured locally on 2026-11-05 against the production Next.js server at
`http://127.0.0.1:3000/research/kmutt-bangmod`. This report applies to the exterior review assets identified below. These are desktop browser measurements with mobile emulation; physical phone measurements remain pending.

## Conditions

- Chromium 156.0.8078.4, Playwright 1.64.1, ANGLE Direct3D11 on NVIDIA GeForce RTX 5050.
- Viewport 390 × 844, device pixel ratio 2, mobile and touch enabled.
- Chrome DevTools CPU throttle 4×, download 4 Mbps, upload 1 Mbps, latency 150 ms.
- Cache disabled, fresh browser context per load, three trials per asset alternating authoring and web assets. Blender rendering and image encoding had finished before measurement.
- Both models use the same page; the authoring comparison substitutes only the model fetch URL. All six initial 2D views downloaded zero GLBs.
- Ready time begins just before selecting detailed mode and includes deferred viewer code, model transfer, parsing and initial rendering.

## Model identity

| Asset  | SHA-256                                                            |
| ------ | ------------------------------------------------------------------ |
| detail | `9698c18a730db3d2b0784a29a515287d94f0b9d4de43d73526d41fc68ea1d0f1` |
| web    | `7bf7d8b46136d0692e012d7ee4581d9276bce93ca594366c49e2de7f25a08075` |

## Load results

| Measurement                   | Float32 authoring GLB | Quantized web GLB |
| ----------------------------- | --------------------: | ----------------: |
| Decoded asset bytes           |            16,923,920 |        13,900,264 |
| Encoded HTTP body bytes       |             5,639,104 |         5,478,571 |
| Median model request duration |              11.537 s |          11.184 s |
| Median click to ready         |              13.446 s |          12.748 s |

The decoded asset is 17.87% smaller; HTTP transfer is 2.85% smaller because the server already compresses both assets. The observed ready-time difference in these three trials is 0.698 s. Three samples do not establish a general performance improvement. Detailed mode still takes about 13 seconds on this throttled connection, so the viewer retains its initial 2D map and on-demand 3D modes.

## Orbit responsiveness

An eight-second requestAnimationFrame driver sends pointer movement through OrbitControls after a real pointerdown. The same viewport, DPR and CPU throttle apply. Instrumentation counts clears of the main WebGL framebuffer. Before/after screenshots confirm camera movement. The final report uses this driver instead of the input-rate-limited serial Playwright mouse loop.

| Measurement                 | Authoring GLB | Web GLB |
| --------------------------- | ------------: | ------: |
| Render submissions / second |         60.00 |   59.99 |
| Median submission interval  |       16.6 ms | 16.6 ms |
| 95th percentile interval    |       18.3 ms | 18.3 ms |

These values measure browser render cadence on this computer. They do not measure GPU command completion, battery use, thermal throttling or phone GPU performance. No frame-cadence improvement is established.

Raw results and the exact local scripts are in `tmp/campus-3d/exterior-survey-refinement/mobile-performance.json`, `tmp/campus-3d/survey-measure-mobile.cjs` and `tmp/campus-3d/survey-measure-orbit.cjs`. Run the load script followed by the orbit script with Blender stopped. They use the isolated Playwright installation under `tmp/campus-3d`. Earlier measurements remain in `tmp/campus-3d/refinement/` and describe the previous assets.

## Geometry and release checks

`verify_web_model.py` compares all 826,989 decoded positions against the authoring asset. Maximum three-dimensional displacement is 1.655 mm. This is compression error relative to the study model, independent of geographic or building accuracy. Khronos glTF Validator reports zero errors and zero warnings on all three GLBs.

Before treating mobile performance as verified, repeat loading, orbit, selection, GPS and recovery checks on physical Android and iOS devices, including a lower-end device. Record hardware, OS, browser, network, memory pressure and sustained use. Those checks have not been performed here.

## Later loading UI change

The shared Agent Honk SVG loader was integrated after these measurements. The model hashes still identify the current geometry; the loading-time samples above describe the earlier poster-based loading UI. Browser animation, reduced-motion and map success/error tests cover the new loader. Its loading performance has not been reprofiled on a physical handset.
