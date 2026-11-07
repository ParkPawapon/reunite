# Exterior detail review — 2026-11-06

This iteration retains the campus coordinates, all 39 building identities, existing
height assumptions and walking network. The current model has 43 signs. It refines the existing exterior
study; it does not certify the buildings as surveyed replicas.

## Implemented geometry

- N13 now has a white curved roof-edge trellis with crossing ribs and longitudinal
  ties, upper louvre panels and posts, two ribbed service shutters and an open
  service bay. Hanging climbers use small two-sided leaves and curved stems.
  [The atlas photograph](https://bgm.kmutt.ac.th/MapNavi/N13.html) supplies the visible
  form; dimensions and plant placement remain interpretations. Projecting members
  are kept clear of the adjacent N12 footprint.
- N10's entry has a three-level glazed bay with pale spandrels, an inset stair
  flight, handrails and white portal frames beside it. The signs now include
  `สำนัก / หอสมุด` and `LIBRARY`, following the
  [library photograph](https://bgm.kmutt.ac.th/MapNavi/N10.html).
- N20's entrance fins have deep projecting profiles and sloping lower returns,
  following the [photographed fin shape](https://bgm.kmutt.ac.th/MapNavi/N20.html).
  This refines the existing assumed massing; it does not establish the heights or
  position of every wing.
- S14 has a two-chord triangulated entrance soffit and tall round columns,
  following [the photographed entrance structure](https://bgm.kmutt.ac.th/MapNavi/S14.html).
  The roof study and its KMUTT lettering remain in place.
- LX's round entrance columns now have smoother circular sections, and modeled
  door pull handles have depth and closed exposed returns.

- Profiled rims replace the flat frame faces on existing modeled windows and doors.
  Their sloped faces have geometric normals. Glazing bars now project from the glass
  and have closed exposed returns. The joinery validator covers 37 building records;
  the two remaining service buildings have no glazed joinery in the study.
- N9/FIBO has stacked ventilation panels in the opaque strip, projecting curtain-wall
  mullions, floor-edge aluminium fascias following the curved bay, and bars across
  the existing narrow glazed slot. The [FIBO photographs](https://fibo.kmutt.ac.th/about/new-building/)
  and [university atlas](https://bgm.kmutt.ac.th/MapNavi/N9.html) support these features.
- N11/SIT has horizontal screens in the two upper rows of the modeled entrance
  elevation and bracing behind the left upper screens, following the
  [atlas photograph](https://bgm.kmutt.ac.th/MapNavi/N11.html). The existing canopy,
  columns and sign are retained. [Virtual Tour camera 16](https://www.kmutt.ac.th/virtual/bangmod/#media-index=16)
  provides additional entrance context.

All section sizes, blade spacing, brace placement and façade depths remain photo
interpretations. The refinement adds no generic air conditioners, roof equipment,
unseen doors or additional floor counts. N13's large code in the atlas photograph
looks like an image annotation; it is not sufficient evidence for a physical sign.

## Browser rendering

`daylight-environment.ts` builds a local analytic sky and ground, then filters it
once into a 256-pixel PMREM for PBR material reflections. It uses the same light
direction as the existing key light, without a second sun disc. No photograph,
satellite tile, HDR download or external texture is needed. The temporary sky,
ground and generator are disposed immediately; the returned environment target is
disposed with the viewer, including failed and aborted loads.

This follows the primary [Three.js Sky](https://threejs.org/docs/pages/Sky.html)
and [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html) APIs. The
viewer keeps on-demand rendering, 360° horizontal orbit and the existing limit
above the ground plane.

## Reference research

Reviewed [BuildingGeneratorThreeJS](https://github.com/achrefelouafi/BuildingGeneratorThreeJS)
for code-based architectural assembly, and
[blender-codex-mcp](https://github.com/webita/blender-codex-mcp/blob/main/docs/ARTICLE_EN.md)
for its inspect/render/export feedback workflow. These are workflow references;
neither establishes KMUTT dimensions, photographic fidelity, production readiness
or that a particular visual result was created with Codex. No code or assets from
these repositories were copied or installed.

Building appearance continues to come from the university reference register and
the local Virtual Tour captures. No new on-site survey or all-side photographic
coverage was obtained in this iteration. Google satellite remains a separate
position-comparison link in the viewer; its imagery is not extracted into the GLB.

## Reproducible checks

Run these in the pinned Python environment after changing geometry:

```powershell
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/build.py --check
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/build_detail.py --check
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/verify_joinery.py
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/verify_landmarks.py
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/verify_reveal_normals.py
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/verify_web_model.py
& tmp/campus-3d/venv/Scripts/python.exe research/kmutt-bangmod/audit_navigation.py --check
```

The joinery check rejects degenerate triangles and normals that disagree with face
winding by more than 2°. The web comparison checks every decoded position against
the authoring GLB, with a 2 mm compression-error limit. Neither tolerance measures
agreement with the actual buildings. `verify_render_scene.py` additionally checks
the saved scene's source GLB SHA-256, preventing a previous Blender scene from
passing as the current model. Current measurements belong in [PERFORMANCE.md](PERFORMANCE.md).

`verify_landmarks.py` checks the four added landmark structures, tube/leaf face
winding, their projected clearance from neighboring buildings and campus limits,
the N13 trellis above the roof, N10's stair flight, N20's fin projection and the
depth of S14's two-chord truss.

The render pipeline now has fifteen 4K views plus the loading poster. Four added
views show N13, N10, N20 and the S14 entrance. The N20 image is explicitly an
isolated facade study: surrounding meshes are hidden only while that image is
rendered, then restored before saving. All 39 buildings remain visible in the
saved campus scene and interactive viewer. The saved-scene check rejects hidden
building objects.

## Remaining accuracy limits

All metre heights remain estimated, including 15 records with nominal heights.
Unseen elevations, rear services, roof details, opening dimensions and sign
positions need direction-tagged photographs and measured control dimensions.
Six records still lack evidence for a modeled physical sign. Four facilities in
the university's 43-facility inventory remain outside the 39 modeled records.
Physical Android/iOS performance and field-verified entrances remain pending.

The [per-building accuracy register](ACCURACY-REGISTER.md) expands these limits
into all 39 height/footprint records and all 39 route endpoints, with source links.
Current [landmark measurements](PERFORMANCE.md#landmark-detail-assets--2026-11-06)
use the requested 10 Mbps baseline. Earlier results remain associated with their
original asset hashes.

The web asset derives flat normals only for planar recess returns, using standard
[glTF behavior](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes).
All positions, triangles, materials and smooth structural normals remain present.
The authoring asset is unchanged by this storage adjustment. The dedicated check
compares every affected decoded face against its authored stored normal and
enforces a maximum 1° difference; the observed maximum is 0.567° across 74,664 faces.
