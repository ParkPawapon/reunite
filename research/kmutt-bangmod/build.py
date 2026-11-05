"""Rebuild the Bangmod GLB and catalog without accessing the network."""

import argparse
import csv
import io
import json
from pathlib import Path

from geometry import extrude, load_footprints
from glb import Glb
from massing import height_break, massing_surfaces

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public/research/kmutt-bangmod"
CATALOG = ROOT / "apps/web/src/app/research/kmutt-bangmod/catalog.generated.json"
PREFIX = "kmutt-bangmod"

SURFACES = {
    # Layer offsets prevent depth fighting where campus context overlaps.
    "boundary": (-1.8, 0, (0.77, 0.78, 0.77), (0.57, 0.60, 0.59)),
    "green": (0, 0.025, (0.56, 0.64, 0.53), (0.56, 0.64, 0.53)),
    "track": (0, 0.05, (0.63, 0.48, 0.44), (0.63, 0.48, 0.44)),
    "sport": (0, 0.075, (0.54, 0.64, 0.52), (0.54, 0.64, 0.52)),
    "water": (0, 0.1, (0.43, 0.58, 0.64), (0.43, 0.58, 0.64)),
}


def build():
    snapshot = json.loads((PUBLIC / f"{PREFIX}.geojson").read_text(encoding="utf-8"))
    footprints, origin = load_footprints(snapshot)
    metadata = snapshot["metadata"]
    glb = Glb(metadata["attribution"])
    campus_context, buildings, catalog = [], [], []
    for id_, props, polygon in footprints:
        kind = props["kind"]
        extras = {"featureId": id_, **props, "footprintAreaM2": round(polygon.area, 1)}
        if kind == "building":
            extras.pop("kind")
            catalog.append(extras)
            name = f"{props['code']} | {props['nameEn']}"
            surface = "Building"
            bottom, top = 0, props["heightM"]
            roof_color, wall_color = (0.86, 0.87, 0.86), (0.69, 0.73, 0.74)
        else:
            name = props["nameTh"]
            surface = kind.title()
            bottom, top, roof_color, wall_color = SURFACES[kind]
        roof, walls = extrude(polygon, bottom, top)
        if kind == "building" and (massing := height_break(id_, polygon)):
            roof, walls = massing_surfaces(polygon, top, props["floorCount"], massing)
            # Catalog fields describe the source inventory; massing evidence lives on the node.
            extras = {**extras, **massing.metadata()}
        mesh = glb.append(
            "meshes",
            {
                "name": name,
                "primitives": [
                    glb.primitive(roof, glb.material(f"{surface} top", roof_color)),
                    glb.primitive(walls, glb.material(f"{surface} side", wall_color)),
                ],
            },
        )
        node = glb.append("nodes", {"name": name, "mesh": mesh, "extras": extras})
        (buildings if kind == "building" else campus_context).append(node)

    nodes = [
        glb.append("nodes", {"name": "Buildings", "children": buildings}),
        glb.append("nodes", {"name": "Campus context", "children": campus_context}),
    ]
    glb.append(
        "scenes",
        {
            "name": metadata["name"],
            "nodes": nodes,
            "extras": {
                **metadata,
                "originUtmMetres": origin,
                "axes": "+X east, +Y up, -Z grid north",
            },
        },
    )
    csv_file = io.StringIO(newline="")
    columns = [
        "featureId",
        "code",
        "nameTh",
        "nameEn",
        "part",
        "footprintAreaM2",
        "footprintBasis",
        "footprintNote",
        "heightM",
        "heightBasis",
        "floorCount",
        "floorHeightM",
        "heightSource",
        "footprintSources",
    ]
    writer = csv.DictWriter(csv_file, columns, lineterminator="\n")
    writer.writeheader()
    for building in catalog:
        writer.writerow(
            {
                **building,
                "footprintSources": " | ".join(
                    s["url"] for s in building["footprintSources"]
                ),
            }
        )
    return {
        PUBLIC / f"{PREFIX}.glb": glb.encode(),
        PUBLIC / f"{PREFIX}.csv": csv_file.getvalue().encode("utf-8-sig"),
        CATALOG: (
            json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n"
        ).encode("utf-8"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="compare generated files with the existing outputs",
    )
    check = parser.parse_args().check
    for path, data in build().items():
        if check:
            if not path.exists() or path.read_bytes() != data:
                parser.exit(1, f"Stale file: {path.relative_to(ROOT)}\n")
        else:
            path.write_bytes(data)
        print(f"{path.relative_to(ROOT)} ({len(data):,} bytes)")


if __name__ == "__main__":
    main()
