# Bangmod viewer measurements

The current model is measured in [landmark detail assets](#landmark-detail-assets--2026-11-06)
at the requested 10 Mbps baseline. Earlier [10 Mbps](#10-mbps-baseline--2026-11-06)
and [4 Mbps measurements](#current-assets--2026-11-06) retain their original asset hashes.
The following 2026-11-05 results are retained for the earlier asset hashes, against
the production Next.js server at `http://127.0.0.1:3000/research/kmutt-bangmod`.
These are desktop browser measurements with mobile emulation; physical phone
measurements remain pending.

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

The shared Agent Honk SVG loader was integrated after the 2026-11-05 measurements.
The loading-time samples above describe the earlier poster-based loading UI and
earlier geometry. Browser animation, reduced-motion and map success/error tests
cover the new loader. The section below measures the current geometry and loader;
physical handset profiling remains pending.

## Current assets — 2026-11-06

Measured after the joinery, FIBO/SIT detail and local daylight changes, with Blender
and other browser checks stopped. Conditions remain Chromium 156.0.8078.4,
Playwright 1.64.1, RTX 5050 / ANGLE Direct3D11, 390 × 844, DPR 2, CPU 4×,
4 Mbps down / 1 Mbps up, 150 ms latency and cache disabled. Three fresh contexts
per asset alternate authoring/web. All six initial 2D views downloaded zero GLBs.

| Asset  | SHA-256                                                            |
| ------ | ------------------------------------------------------------------ |
| detail | `caa75a577ff198700aa3b6e4a3cf6b6496c18ee90e2bd7efd8357dbdc9fd6c25` |
| web    | `535ab0ca157ac574257673056e64ef32ef521e1a4a190022fe2794abf668c6f1` |

| Measurement                   | Float32 authoring GLB | Quantized web GLB |
| ----------------------------- | --------------------: | ----------------: |
| Decoded asset bytes           |            20,555,720 |        16,746,172 |
| Encoded HTTP body bytes       |             6,537,619 |         6,339,878 |
| Median model request duration |              13.315 s |          12.948 s |
| Median click to ready         |              15.248 s |          14.977 s |

The current web file is 15.97 MiB decoded. Additional joinery costs 2,845,908
decoded bytes over the previous web file. The viewer therefore retains its 2D
initial view and explicit 3D loading. These samples establish approximately
15-second readiness under this emulated connection, not fast loading on phones.
Changes since the earlier report include geometry, lighting and loading UI; these
measurements do not isolate their individual costs.

The separate eight-second requestAnimationFrame pointer driver produced:

| Measurement                 | Authoring GLB | Web GLB |
| --------------------------- | ------------: | ------: |
| Render submissions / second |         60.00 |   59.62 |
| Median submission interval  |       16.6 ms | 16.7 ms |
| 95th percentile interval    |       18.3 ms | 18.9 ms |

This counts main-framebuffer clears on this desktop GPU. It does not measure GPU
completion, sustained thermal behavior, battery consumption or physical handset
frame rate. No improvement in orbit cadence is claimed.

`verify_web_model.py` compares 1,023,433 vertices with maximum displacement
1.655 mm. `verify_joinery.py` checks 243,304 joinery triangles across 37 records,
with maximum face/shading-normal disagreement 0.295°. Khronos glTF Validator
reports zero errors and zero warnings for the basic, detailed and web GLBs.
These checks concern the authored assets and compression, not survey accuracy.

Raw measurements, before/after orbit screenshots, rendered outputs and the exact
measurement scripts are under `tmp/campus-3d/joinery-review/`,
`tmp/campus-3d/joinery-measure-mobile.cjs` and
`tmp/campus-3d/joinery-measure-orbit.cjs`. The editable Blender scene contains the
current GLB SHA-256, all 39 records, eleven cameras and its packed sign atlas.

## 10 Mbps baseline — 2026-11-06

10 Mbps is the user-supplied operating assumption, not a measurement of the user
population's connection speeds. This run uses the production local Next.js server,
the current web GLB SHA-256 above, Chromium 156.0.8078.4 / Playwright 1.64.1 and
RTX 5050 / ANGLE Direct3D11. The mobile viewport is 390 × 844 at DPR 2, CPU slowdown
is 4×, upload is 1 Mbps and latency is 150 ms. Blender and other browser checks
were stopped during measurement.

Three fresh browser contexts each perform a first load and then a reload in the
same context. HTTP cache is enabled; it is empty for each first load. The browser
process and GPU driver are shared, so GPU shader caches are not independently
cleared. These are mobile emulation results on a desktop GPU, not measurements
from a physical Android or iOS device.

| Phase, median of three visits                       |   First visit |  Repeat visit |
| --------------------------------------------------- | ------------: | ------------: |
| Click to start of GLB request                       |       0.530 s |       0.107 s |
| GLB request start to decoded ArrayBuffer available  |       5.451 s |       0.395 s |
| ArrayBuffer available to observing the ready viewer |       0.834 s |       0.711 s |
| **Click to ready viewer**                           |   **6.815 s** |   **1.217 s** |
| Observed click-to-ready range                       | 6.804–7.366 s | 1.198–1.222 s |
| GLB network response status from CDP                |           200 |           304 |

Component medians are calculated separately and need not sum to the total median.
The last phase includes parsing, scene setup, procedural lighting, shader setup,
render submission, React updates and observation overhead. It is not an isolated
parse time or GPU-completion measurement. The timing starts at the detailed-mode
interaction after the initial plan is ready; it does not include initial page
navigation.

The full response transfers a compressed body of **6,339,878 bytes** (6.34 MB),
which becomes **16,746,172 bytes** (15.97 MiB) after HTTP decoding. At 10 Mbps
(1.25 MB/s), transmitting that compressed body alone has an ideal minimum of
5.072 seconds. The measured first-visit resource duration median is 5.304 seconds;
making the ArrayBuffer available takes slightly longer. The initial 15-second
result at 4 Mbps therefore does not describe the 10 Mbps baseline.

For repeat visits, CDP reports HTTP 304: the browser validates and reuses its
cached body. ResourceTiming reports `transferSize: 300` for those requests; that
is browser timing accounting for the response, not a wire-packet measurement.
`encodedBodySize` still describes the cached representation and must not be
reported as another 6.34 MB download. All six initial 2D views downloaded zero
GLBs, and all six detailed-mode visits completed without page errors.

The larger network budget does not establish phone GPU speed, available memory,
thermal behavior or geometric accuracy. The [accuracy register](ACCURACY-REGISTER.md)
lists height evidence, footprints and unverified entrances for all 39 records.
Physical handset testing and field measurements remain separate acceptance work.

Reproduce with the repository's Playwright dependency:

```powershell
node research/kmutt-bangmod/measure-loading.mjs --mbps 10 --expect-gpu "RTX 5050"
```

`--url`, `--latency`, `--cpu`, `--trials` and `--output` configure other explicitly
named scenarios. Raw results are in `tmp/campus-3d/network-10mbps/loading.json`.
That measurement-only iteration preceded the landmark refinement below. Its
geometry and hashes were unchanged from the preceding joinery refinement.

## Landmark detail assets — 2026-11-06

This version adds the N13 greenhouse trellis, N10 glazed entry/stair, N20 fin
profiles, S14 entrance truss and additional library lettering. It contains
1,052,103 vertices and 43 signs on 33 building records. All 39 records remain.

| Asset  | SHA-256                                                            | Decoded bytes |
| ------ | ------------------------------------------------------------------ | ------------: |
| detail | `ba72aad02c0c47c495eb709f66cf332029ea8782bda9bc62ac3f5cb7047a72b9` |    21,219,432 |
| web    | `d279a25eabcf6fbb15fb49834cdcf454ef7eb7826c0f7da111464f19f5d033f8` |    16,689,960 |

The web file is 15.92 MiB. Its geometry, triangle count and materials are retained;
only planar recess returns derive flat normals. This saves 604,464 bytes compared
with the first landmark export. Smooth ribs, plants and all other authored normals
are retained. `verify_reveal_normals.py` measures a maximum 0.567° difference on
74,664 affected faces, within its 1° bound. Position displacement remains at most
1.655 mm relative to the authoring model. These are representation checks, not
field-survey accuracy.

Using the same 10 Mbps / 1 Mbps upload, 150 ms latency, CPU 4×, DPR 2, 390 × 844,
Chromium 156 / RTX 5050 conditions, three fresh contexts and three repeat visits
produced the following results after rendering and functional checks had stopped:

| Measurement                     |   First visit |  Repeat visit |
| ------------------------------- | ------------: | ------------: |
| Median click to ready           |       7.085 s |       6.860 s |
| Observed range                  | 7.036–7.642 s | 6.839–6.871 s |
| HTTP status for the GLB         |           200 |           200 |
| Encoded body bytes per response |     6,602,414 |     6,602,414 |

Repeat visits in these contexts downloaded the body again. The earlier 1.217-second
cache result belongs to the previous joinery asset and must not be applied to this
version. Reducing the decoded buffer size did not restore that cache behavior in
this run. No universal browser cache-size limit or physical-phone performance is
inferred from these six visits. All six initial 2D views downloaded zero GLBs; the
app retains explicit on-demand detailed mode.

Raw results are in `tmp/campus-3d/landmark-review/mobile-performance.json`. The
pre-adjustment run is retained as `loading-before-reveal-opt.json`. Reproduce with:

```powershell
node research/kmutt-bangmod/measure-loading.mjs --mbps 10 --expect-gpu "RTX 5050" --output tmp/campus-3d/landmark-review/mobile-performance.json
```

Khronos Validator reports zero errors and warnings on all three assets. The four
landmark checks cover 29,792 steel/planting faces and projected clearance from
neighboring buildings. The saved authoring scene contains fifteen cameras and
restores all 39 buildings after the explicitly isolated N20 review image. Fifteen
4K images, a loading poster and five elevation sheets were produced on RTX 5050.
Orbit, selection, GPS, 2D fallback and download recovery checks pass; frame cadence
was not reprofiled for this geometry. Physical Android/iOS testing remains pending.
