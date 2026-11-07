"""Build the detailed, self-contained Bangmod GLB from the checked-in source data."""

import argparse
import json

from build import PREFIX, PUBLIC
from entries import ENTRIES
from facades import OBSERVED, facade_mesh
from geometry import load_footprints, local_projection
from glb import Glb
from lx_exterior import PODIUM_FLOORS, SOLAR_STUDY
from massing import height_break
from roof_studies import GREEN_MEMBRANES, TOUR
from service_roofs import SLOPED_ROOFS
from shapely import orient_polygons, union_all
from shapely.geometry import LineString, Point, box
from signs import SIGNS, building_signs, sign_atlas
from site_model import site_meshes
from walking_graph import compile_network


def exterior_clearances(snapshot, features, campus):
    _, graph = compile_network(snapshot, features, campus)
    routes = union_all(
        [
            LineString(
                [(graph["nodes"][i][0], -graph["nodes"][i][1]) for i in (start, end)]
            )
            for start, end, *_ in graph["edges"]
        ]
    )
    obstacles = [
        geometry
        for _, props, geometry in features
        if props["kind"] in {"building", "water"}
    ]
    open_space = campus.difference(union_all(obstacles))
    return open_space, open_space.difference(routes.buffer(0.6))


def build_detail(*, compact_positions=False):
    snapshot = json.loads((PUBLIC / f"{PREFIX}.geojson").read_text(encoding="utf-8"))
    context = json.loads((PUBLIC / "site-context.geojson").read_text(encoding="utf-8"))
    metadata = snapshot["metadata"]
    features, origin = load_footprints(snapshot)
    project, _ = local_projection(metadata["originWgs84"], metadata["projectedCrs"])
    walking = json.loads((PUBLIC / "walking-network.json").read_text(encoding="utf-8"))
    footprints = {id_: footprint for id_, _, footprint in features}
    exterior_space, ground_clearance = exterior_clearances(
        snapshot, features, footprints["campus"]
    )
    frontage = {
        id_: footprints[target].representative_point()
        for id_, target in {
            "N1": "N2",
            "N2": "emerald-pond",
            "N8": "N7",
            "N9": "N7",
            "N10": "N16",
            "N11": "N16",
            "N12": "N15",
            "N13": "N16",
            "N14": "N15",
            "N15": "N16",
            "N16": "emerald-pond",
            "N19": "learning-garden",
            "N20": "N19",
            "S2-parking": "S1",
            "S6": "S5",
            "S9": "S5",
            "S14": "sports-field",
            "S15": "learning-garden",
        }.items()
    }
    for id_ in ("N7", "S3"):
        node = walking["nodes"][str(walking["reviewedApproaches"][id_]["node"])]
        frontage[id_] = project(Point(node["lon"], node["lat"]))
    entry_targets = {
        id_: footprints[entry.target].representative_point()
        if entry.target
        else frontage[id_]
        for id_, entry in ENTRIES.items()
    }
    # The registered atlas shows two circular bays alongside the taller straight wing.
    s9_wings = (
        (Point(-22.044, -283.654).buffer(8.6, quad_segs=16), 0.90),
        (Point(-22.8, -265.8).buffer(5.1, quad_segs=14), 0.74),
    )
    s9_tier = orient_polygons(box(-66.5, -273.4, -30.4, -257.0))
    if any(
        not footprints["S9"].covers(wing)
        for wing in (s9_tier, *(outline for outline, _ in s9_wings))
    ):
        raise ValueError("S9 upper volumes leave the mapped footprint")
    atlas = "https://bgm.kmutt.ac.th/MapNavi/"
    model_ids = {id_ for id_, props, _ in features if props["kind"] == "building"}
    if OBSERVED.keys() != model_ids:
        raise ValueError(
            f"Exterior profiles and footprints disagree: {OBSERVED.keys() ^ model_ids}"
        )
    glb = Glb(
        metadata["attribution"], compact_normals=True,
        compact_positions=compact_positions,
    )
    if not SIGNS.keys() <= model_ids:
        raise ValueError("Sign references an unknown building")
    atlas_letters = sign_atlas(glb)
    buildings, landscape = [], []
    for id_, props, footprint in features:
        if props["kind"] != "building":
            continue
        code = props["code"]
        name = f"{code} | {props['nameEn']}"
        west, south, east, north = footprint.bounds
        margin = 7 if id_ == "S14" else 4
        transform = glb.mesh_coordinates(
            (west - margin, -1, -north - margin),
            (east + margin, props["heightM"] + 4, -south + margin)
        )
        massing = height_break(id_, footprint)
        plaques, signage = building_signs(
            glb,
            id_,
            code,
            footprint,
            frontage.get(id_),
            entry_targets.get(id_),
            footprints,
            exterior_space,
            ground_clearance,
            atlas_letters,
        )
        mesh = glb.append(
            "meshes",
            {
                "name": name,
                "primitives": [
                    *facade_mesh(
                        glb,
                        id_,
                        props,
                        footprint,
                        frontage.get(id_),
                        entry_target=entry_targets.get(id_),
                        exterior_space=exterior_space,
                        ground_clearance=ground_clearance,
                        round_wings=s9_wings if id_ == "S9" else (),
                        upper_wing=s9_tier if id_ == "S9" else massing.upper if massing else None,
                        podium_floors=massing.lower_floors if massing else 3,
                    ),
                    *plaques,
                ],
            },
        )
        extras = {
            "featureId": id_,
            **props,
            "facadeBasis": "complex-reference"
            if id_ == "S2-seminar" or code == "S4"
            else "photo-informed",
            "facadeSource": f"{atlas}{code}.html",
            "facadeScope": "Observed elevations only; remaining sides and roofs are estimates.",
            "joineryBasis": "Profiled window rims and projecting mullions on existing openings; section sizes are visualization estimates.",
        }
        if id_ == "N9":
            extras["exteriorDetails"] = {
                "observed": ["stacked ventilation panels", "projecting curved curtain-wall grid", "continuous floor-edge fascias"],
                "source": "https://fibo.kmutt.ac.th/about/new-building/",
                "dimensionBasis": "Photo-interpreted; not field-measured.",
            }
        elif id_ == "N11":
            extras["exteriorDetails"] = {
                "observed": ["upper entry-elevation louvres", "bracing behind the upper screen"],
                "source": "https://bgm.kmutt.ac.th/MapNavi/N11.html",
                "dimensionBasis": "Photo-interpreted visible entry elevation only; not field-measured.",
            }
        if id_ in {"N10", "N13", "N20", "S14"}:
            extras["exteriorDetails"] = {
                "observed": {
                    "N10": ["three-level glazed entry", "inset side stair", "white stair portal frames"],
                    "N13": ["curved white roof-edge trellis", "continuous upper louvres", "service shutter bays", "hanging climbers"],
                    "N20": ["deep sun fins with sloping lower returns"],
                    "S14": ["two-chord triangulated entrance space frame", "tall round entrance columns"],
                }[id_],
                "source": f"{atlas}{code}.html",
                "dimensionBasis": "Photo-interpreted dimensions and placement; vegetation is illustrative, not surveyed.",
            }
        if signage:
            extras["signage"] = signage
        if massing:
            extras.update(massing.metadata())
        if id_ in ENTRIES:
            extras["entryBasis"] = (
                "Observed facade type with approximate dimensions and position."
            )
        if id_ in SLOPED_ROOFS:
            extras["roofBasis"] = (
                f"Atlas photo shows a {SLOPED_ROOFS[id_][0]} roof. Pitch and overhang are estimated."
            )
        if id_ in GREEN_MEMBRANES:
            extras.update(
                roofSource=f"{TOUR}#media-index=104",
                roofBasis="Green membrane visible in aerial panorama. Surface colour is photo-interpreted, not calibrated.",
            )
        if id_ == "S14":
            extras.update(
                roofSource=f"{TOUR}#media-index=105",
                roofBasis="Barrel-vault gym roof and KMUTT lettering visible in camera 105. Span, rise, springing and annex levels are estimates.",
            )
        if id_ == "N16":
            extras.update(
                podiumFloors=PODIUM_FLOORS,
                massingBasis="Six podium levels documented by SoA+D. Tower setbacks interpreted from photos.",
                publishedTotalHeightM=70.75,
                publishedTotalHeightDatum="Includes basement and rooftop.",
                roofBasis="Published photographs show fixed solar arrays. Model layout and dimensions are estimated.",
                roofSource=SOLAR_STUDY,
            )
        elif id_ == "S9":
            extras["massingBasis"] = (
                "Two plan-aligned round volumes and a photo-informed taller straight wing. Dimensions are estimated."
            )
        buildings.append(
            glb.append("nodes", {"name": name, "mesh": mesh, **transform, "extras": extras})
        )
    glb.mesh_coordinates()
    for name, primitives in site_meshes(glb, features, context, project):
        if primitives:
            mesh = glb.append("meshes", {"name": name, "primitives": primitives})
            landscape.append(
                glb.append(
                    "nodes",
                    {
                        "name": name,
                        "mesh": mesh,
                        "extras": {"castsShadow": name == "Modeled trees"},
                    },
                )
            )
    glb.append(
        "scenes",
        {
            "name": "KMUTT Bangmod exterior study",
            "nodes": [
                glb.append("nodes", {"name": "Buildings", "children": buildings}),
                glb.append("nodes", {"name": "Campus grounds", "children": landscape}),
            ],
            "extras": {
                **metadata,
                "originUtmMetres": origin,
                "axes": "+X east, +Y up, -Z grid north",
                "detailBasis": "Photo-informed exterior profiles, recessed openings and balcony geometry with estimated dimensions. Roads and paths from OpenStreetMap.",
            },
        },
    )
    return glb.encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for suffix, compact in (("detail", False), ("web", True)):
        output = PUBLIC / f"{PREFIX}-{suffix}.glb"
        result = build_detail(compact_positions=compact)
        if args.check:
            if not output.exists() or output.read_bytes() != result:
                parser.exit(1, f"Stale model: {output.name}\n")
        else:
            output.write_bytes(result)
        print(f"{output.name}: {len(result):,} bytes")


if __name__ == "__main__":
    main()
