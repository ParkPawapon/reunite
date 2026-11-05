# KMUTT Bangmod building study model

Open `/research/kmutt-bangmod` on the local Next.js app. The study is independent of Lost & Found, authentication, and PostgreSQL. The browser renders the checked-in GLB locally; no tile service, remote model requests, or API keys are needed. A searchable catalog and downloads remain available when WebGL is unavailable.

The model covers the main campus at 126 Pracha Uthit Road, including its university dormitories and FIBO parcel. It represents all **35 named campus plan codes (N1–N20, S1–S15)** as **39 building records**, with separate records for S2 parking/seminar and the four S4 engineering blocks. The university's FY 2568 inventory lists 43 facilities. The four additional inventory entries (engineering club and three unnumbered facilities) are not separately modeled. The boundary, two ponds, sports field/track, and two green areas provide campus context. No surrounding buildings or other campuses are modeled.

## Files and accuracy

- [`kmutt-bangmod.glb`](../../apps/web/public/research/kmutt-bangmod/kmutt-bangmod.glb): glTF 2.0 binary with one named node per building record, suitable for import into Blender or another glTF viewer. Coordinates use metres, +Y up, +X east, −Z grid north. The scene metadata records the WGS84 origin and corresponding UTM Zone 47N coordinates (EPSG:32647).
- [`kmutt-bangmod.geojson`](../../apps/web/public/research/kmutt-bangmod/kmutt-bangmod.geojson): reviewed WGS84 longitude/latitude footprint snapshot with feature IDs, source references, versions where available, and height method. This is the source for regenerating the model.
- [`kmutt-bangmod.csv`](../../apps/web/public/research/kmutt-bangmod/kmutt-bangmod.csv): Thai/English catalog with heights, footprint areas, and source links. Encoded as UTF-8 with a BOM for spreadsheet import.
- [`NOTICE.txt`](../../apps/web/public/research/kmutt-bangmod/NOTICE.txt): data licenses and attribution. Retain it and the GeoJSON when sharing the model.

Names and positions were cross-checked against the [campus master plan](https://bgm.kmutt.ac.th/MapNavi/MAPNAVI.html) and [KMUTT Information 2568](https://www.kmutt.ac.th/wp-content/uploads/pdf/publications/information-2568-Web.pdf#page=76) (PDF pages 76–77 and 161). Geometry uses OpenStreetMap (campus way `420312611`) and selected Overture Buildings features from release `2026-10-21.0`. N5, N6, N12, and S8 have schematic footprints based on the master plan aligned to the open map. The S8 footprint was cut out of the mapped S9 outline, which otherwise represented both. The N12 outline was trimmed at N13. Source maps and their dates differ, and neither the study boundary nor its dimensions are a survey.

All heights are estimates. Seven building records use a published floor count, six use a mapped count, eleven use the highest floor documented by an official source as a lower bound, and 15 use a nominal height. Reported floor counts are multiplied by an assumed floor height (usually 3.6 m, adjusted for parking and dormitories). The basic GLB represents exterior massing with flat roofs, including the interpreted height breaks of N7 and S3, for visualization and spatial study.

## Rebuild and verify

From the repository root, with Python 3.14:

```powershell
python -m venv tmp/campus-model-venv
& tmp/campus-model-venv/Scripts/python.exe -m pip install -r research/kmutt-bangmod/requirements.txt
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/build.py
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/build.py --check
```

The generator projects the reviewed source into metres, checks scope and overlaps, triangulates polygons with courtyards preserved, and writes the GLB and catalogs. No network access is needed to regenerate the outputs after installing the build tools. The normal Bun/Next.js build consumes the checked-in outputs and requires no Python. The Bun unit suite checks that the model and the geographic catalog agree.

## Detailed exterior and local renders

`kmutt-bangmod-detail.glb` is the optional detailed asset. It uses the same 39 building records, geographic origin, and base heights as the basic GLB. Its nodes identify the facade basis and link to exterior photos for all 35 campus codes. Window and service openings use recessed mesh geometry where the footprint allows, including jambs, sills and heads. The authoring model stores vertex normals with `KHR_mesh_quantization` and keeps positions as float32. The viewer loads `kmutt-bangmod-web.glb`, which additionally quantizes building positions to a separate uniform grid per mesh. Ground surfaces retain float32 coordinates. Both assets embed the same signs, materials and evidence. `verify_web_model.py` compares every decoded position against the authoring model and enforces a 2 mm maximum displacement. This compression tolerance is independent of the real-world accuracy of the source geometry. It draws mapped campus paths from `site-context.geojson` with assumed widths and clips pavement and landscaping to the modeled campus. The [building-by-building review](EXTERIOR-REFERENCES.md#ตรวจรายอาคาร) distinguishes observed details, approximate dimensions and areas with incomplete photo coverage.

The viewer links to the [Google Maps satellite view](https://www.google.com/maps/@?api=1&map_action=map&center=13.65145%2C100.49385&zoom=17&basemap=satellite) for side-by-side comparison in another tab. Geographic geometry and assets come from the sources listed in the notice. Rotate around the campus by dragging or using the 45-degree controls. Camera panning stays parallel to the campus plane, and the orbit stops above the horizon.

Build and check the detailed asset from the same Python environment as the base model. Render it with Blender 4.5 LTS. The script adds daylight and procedural material effects, then writes a campus view, LX, FIBO, S3, S4 and S15 close-ups, LX views of the plaza and rooftop, and an editable Blender scene. Use `--preview` for draft images or `--device CPU` on a machine without a compatible NVIDIA device.

```powershell
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/build_detail.py
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/build_detail.py --check
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/verify_web_model.py
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/audit_navigation.py --check
blender --background --factory-startup --python-exit-code 1 --python research/kmutt-bangmod/render.py -- --model apps/web/public/research/kmutt-bangmod/kmutt-bangmod-detail.glb --output tmp/campus-3d/delivery --device OPTIX
$env:PYTHONPATH = (Resolve-Path research/kmutt-bangmod).Path
blender --background --factory-startup --python-use-system-env --python-exit-code 1 --python research/kmutt-bangmod/render_elevations.py -- --model apps/web/public/research/kmutt-bangmod/kmutt-bangmod-detail.glb --output tmp/campus-3d/delivery/building-elevations
```

The 5,760 × 5,250 elevation sheets isolate each building from neighboring geometry and use a separate fit per building. They show four cardinal elevations plus an oblique roof view. Use the campus GLB and GeoJSON for relative dimensions and placement.

The detailed GLB embeds one PNG atlas of lettering drawn from the transcriptions in `signs.py`. Sign meshes and source links travel with the model. The generator uses Pillow with RAQM for Thai text shaping and the OFL fonts in `fonts/`, pinned to [Google Fonts revision bbda725](https://github.com/google/fonts/tree/bbda7253fc363238b05d97515ca71f8ae49c4fa9/ofl).

## Exterior search and loading poster

The map searches 39 building records, six outdoor areas, and four gates by code and Thai or English name. It opens with a clickable north-up plan that includes mapped roads and footpaths. Users can switch to the lightweight massing model or the detailed model, each downloaded on demand. Search and map selection share stable links such as `/research/kmutt-bangmod#place=N16`, and the selected place stays active when switching views. The map pins a point inside the selected footprint or at the mapped gate and opens a separate satellite comparison at that point.

Map labels show building codes at campus scale and names when there is space on the 3D view. Users can hide these labels with **ชื่อบนแผนที่** to inspect signs attached to building facades.

`build_navigation.py` generates search anchors, outlines, centerlines, and walking topology from the reviewed GeoJSON and [walking-network.json](../../apps/web/public/research/kmutt-bangmod/walking-network.json). Run `build_navigation.py --check` to verify the generated artifact. The page and WebGL loading states now share the Agent Honk vector loading component, with a single short status line, pause and reduced-motion support. The previous 1200 × 675 Blender poster remains an exportable campus asset. Run `render.py` with `--loading-poster` to render the source PNG, then encode it as WebP for `apps/web/public/research/kmutt-bangmod/bangmod-loading.webp`.

## Walking routes and coordinate review

Open `/research/kmutt-bangmod#from=N7&to=S3` to see the route between the mapped N7 approach and the mapped S3 main entrance. The browser connects shared OpenStreetMap nodes. It prefers footpaths over vehicle roads by applying a 20% cost penalty to shared road segments. Reported distance is the sum of physical segment lengths. Gate 2 is searchable but excluded from routing because the connecting driveway is tagged private. N19 is searchable and needs a verified connection to the walking network. Other building pins may terminate at a nearby mapped path, and the viewer labels this distinction. The route can include shared roads or stairs and has no live closure or accessibility data.

Remote review on 2026-11-04 compared gate locations against the university plan. The university identifies Gate 1 on Pracha Uthit Road and Gate 3 on Phutthabucha Road. Coordinates below are WGS84 latitude and longitude from the mapped nodes. Gate-side markers represent graph connection points where available. [University campus plan](https://bgm.kmutt.ac.th/MapNavi/MAPNAVI.html), [SIT travel directions](https://event.sit.kmutt.ac.th/en/help), [Gate 3 notice](https://bgm.kmutt.ac.th/news.php?p=47)

| Point  | WGS84                   | Evidence and use                                                                                                                                 |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate 1 | 13.6509466, 100.4963659 | [Pedestrian-side mapped node](https://www.openstreetmap.org/node/4200331141) on the Pracha Uthit footway                                         |
| Gate 2 | 13.6484332, 100.4936720 | [Mapped gate](https://www.openstreetmap.org/node/4200380479) with [private driveway](https://www.openstreetmap.org/way/935209108)                |
| Gate 3 | 13.6489746, 100.4928530 | [Street-side connection](https://www.openstreetmap.org/node/4200384989) next to the [mapped gate](https://www.openstreetmap.org/node/4200380474) |
| Gate 4 | 13.6500054, 100.4913247 | [Street-side connection](https://www.openstreetmap.org/node/4200387854) beside the Gate 4 arrow on the university plan                           |
| N7     | 13.6528948, 100.4950131 | [Mapped footpath approach](https://www.openstreetmap.org/node/4202450897), about 6.6 m from the footprint                                        |
| S3     | 13.6501700, 100.4951709 | [Mapped main entrance](https://www.openstreetmap.org/node/4200363888) connected to a mapped footpath                                             |

The Learning Garden route starts at a [mapped paved footpath](https://www.openstreetmap.org/node/4202512546) at 13.6509527, 100.4947777, about 2.1 m from the footprint.

On-site verification is still required for the N7 door coordinate, alignment at each gate, gate opening hours and permissions, and physical continuity of the shared roads and footpaths. The route and buildings are exterior only.

## Live walking position

Select **แสดงตำแหน่งของฉัน** to start a browser location watch after granting permission. A blue marker shows the device fix, with its reported horizontal accuracy. **ให้แผนที่ตามตำแหน่ง** follows that fix in the 2D or 3D camera. The location watch is limited to this page and requires HTTPS or localhost. Fixes are held in browser memory and are excluded from requests, shared URLs, and Google Maps links. Selecting stop or leaving the page clears the watch.

The generated local transform uses WGS84 and the same UTM frame as the models. Generation checks the transform against PROJ at 81 positions across the displayed extent with a 0.05 m tolerance. Browser position accuracy is independent of that projection tolerance. Fixes expire after 30 seconds and fixes with more than 100 m of reported uncertainty are withheld. Remaining distance is approximate and requires a fix within 25 m accuracy near an unambiguous segment of the selected route. The blue marker stays at the device fix. The routing graph does not change when the device leaves the selected route.

The map distinguishes footpaths, roads shared with vehicles, and stairs. Route magnification shows the selected path without changing its calculation. The Google Maps satellite link opens a separate view of the campus. The campus assets continue to use their attributed map geometry and photo references.

The [exterior reference register](EXTERIOR-REFERENCES.md) records the photo and panorama evidence for LX, FIBO, and Wissawa Wattana, as well as the dimensions that still need a survey.

## Latest exterior refinement

Official records now document N11 as five floors, N2 and N15 through floor nine, S11 and S12 through floor ten, S13 through floor eight, and S14 through floor three. These counts update heights without claiming measured metre values. The [reference register](EXTERIOR-REFERENCES.md#ยืนยันจำนวนชั้นรอบล่าสุด) records the source and date limitations.

N12 has a photo-informed continuous glazed bay with vertical and horizontal mullions; an overlapping generic glass plane that obscured this grid has been removed. Physical signs now total 42 across 33 building records. S11 and S13 code plaques follow their revised upper facade levels. Sign dimensions, typefaces and positions remain photo estimates. Fine render bump distances differ for painted concrete (3 mm), paving (6 mm), metal/timber (2 mm), and planting (18 mm). Canopy lobes have smoother 14-column, seven-ring meshes. The 78 modeled tree locations include only one mapped tree; the remaining planting is schematic.

`audit_navigation.py` checks the 434-node, 454-edge mapped walking graph for campus containment and building/water intersections, using the same 0.3 m alignment allowance as the compiler. It exports [entrance-review.csv](../../apps/web/public/research/kmutt-bangmod/entrance-review.csv), with all 39 building records, mapped endpoint coordinates, source links, gap to footprint and survey status. A nearby approach coordinate is not a surveyed door. The walk planner displays that gap for approach endpoints. N19 still requires a mapped connection. No indoor route or accessibility certification is provided.

The [performance report](PERFORMANCE.md) records actual transferred bytes, three cold loads per asset and the mobile-emulated orbit measurement, with its hardware and physical-phone limitations.

## Virtual Tour capture and geometry review — 2026-11-05

The local CUA collection contains 1,424 registered 1920 × 1080 screenshots in 52 sweeps, representing 49 distinct published cameras. Of these, 43 show exterior, roof, aerial or outdoor context; six are indoor context. Repeated rotations, sky frames and duplicate stations do not establish additional building coverage. The [capture register](VIRTUAL-TOUR-CAPTURES.json) identifies the exact public media indices, corrected menu selections, and reference scope for all 39 records. No source image is embedded as a model texture or served by the app. Public visibility is not a confirmed redistribution license.

`massing.py` applies the same N7 and S3 height breaks to the basic and detailed models. Chemistry documents offices on N7 floor ten; its northern laboratory bar uses that lower bound. The three-level lower wing is a photo estimate. S3 uses a five-level podium and the mapped fourteen-level northern tower, with an estimated split line. The official tour labels a fifth-floor futsal area, but does not supply measured tower setbacks.

The detailed S14 model now has a segmented barrel-vault roof with conforming KMUTT lettering, following aerial camera 105. Its span, rise and eave heights remain estimates. The previous FIET faculty sign was removed because that camera does not establish a sign on the S14 memorial gym. N11 and N15 have round metal entrance columns, with a taller two-level canopy at N11. Seven visible green roof membranes have distinct photographed finishes. No generic rooftop equipment was added to fill unseen areas.

Run the local capture audit separately from CI, because it needs the private reference folder:

```powershell
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/audit_captures.py tmp/campus-3d/virtual-tour-survey --archive
& tmp/campus-model-venv/Scripts/python.exe research/kmutt-bangmod/audit_captures.py tmp/campus-3d/virtual-tour-survey --check
```

The audit verifies every registered JPEG, dimensions, paths, camera identities and SHA-256 hashes. Its HTML gallery opens locally, and its ZIP passes CRC verification. It excludes the interrupted P066 sweep. Exterior coverage still does not include every facade of every building, and no coordinate or dimension has been field surveyed.

`verify_render_scene.py` runs in Blender against the saved `.blend` and current detailed GLB. It checks all 39 identities and height metadata, eleven cameras, the exact packed sign atlas, Cycles settings and absence of external libraries. `package_delivery.py <render-folder> --encode-only` encodes the eleven 4K images and loading poster for the web, and verifies all 195 elevation cells. After recording the current performance and verification results, `--archive-only` packages the editable scene, models, renders, attributed source data and Python sources with per-file SHA-256 checks and a ZIP CRC check.
