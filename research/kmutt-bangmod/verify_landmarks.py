"""Check that source-backed landmark structures survive GLB export with valid faces."""

from math import hypot
import json

from build import PUBLIC
from geometry import load_footprints
from shapely import union_all
from shapely.geometry import MultiPoint, Point
from verify_joinery import vectors
from verify_web_model import positions, read


def main():
    document, binary = read("detail")
    expected = {"N10", "N13", "N20", "S14"}
    snapshot = json.loads((PUBLIC / "kmutt-bangmod.geojson").read_text(encoding="utf-8"))
    features, _ = load_footprints(snapshot)
    outlines = {id_: shape for id_, _, shape in features}
    checked, faces = set(), 0
    for node in document["nodes"]:
        id_ = node.get("extras", {}).get("featureId")
        if id_ not in expected:
            continue
        evidence = node["extras"].get("exteriorDetails", {})
        if not evidence.get("observed") or not evidence.get("source", "").endswith(f"/{id_}.html"):
            raise ValueError(f"Missing exterior evidence for {id_}")
        groups = {}
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            material = document["materials"][primitive["material"]]["name"]
            points = list(positions(document, binary, node, primitive))
            groups[material] = points
            if not material.startswith(("Painted exterior steel", "Climbing planting")):
                continue
            projected = MultiPoint([(point[0], -point[2]) for point in points])
            others = union_all([shape for other_id, props, shape in features
                                if props["kind"] == "building" and other_id != id_])
            if not outlines["campus"].covers(projected) or others.intersects(projected):
                overlaps = [other_id for other_id, props, shape in features
                            if props["kind"] == "building" and other_id != id_
                            and shape.intersects(projected)]
                raise ValueError(f"New exterior members leave campus or enter another building: {id_}, {material}, {overlaps}")
            normals = vectors(document, binary, primitive["attributes"]["NORMAL"], "<3b", 3)
            accessor = document["accessors"][primitive["indices"]]
            wide = accessor["componentType"] == 5125
            indices = vectors(document, binary, primitive["indices"], "<I" if wide else "<H", 4 if wide else 2)
            for offset in range(0, len(indices), 3):
                ids = [index[0] for index in indices[offset:offset + 3]]
                a, b, c = [points[index] for index in ids]
                ab = [y - x for x, y in zip(a, b, strict=True)]
                ac = [y - x for x, y in zip(a, c, strict=True)]
                normal = (ab[1] * ac[2] - ab[2] * ac[1],
                          ab[2] * ac[0] - ab[0] * ac[2],
                          ab[0] * ac[1] - ab[1] * ac[0])
                length = hypot(*normal)
                if length < 1e-11:
                    raise ValueError(f"Collapsed exterior face in {id_}")
                for index in ids:
                    shading = normals[index]
                    cosine = sum(x * y for x, y in zip(normal, shading, strict=True)) / (length * hypot(*shading))
                    if cosine < 0.70:
                        raise ValueError(f"Inverted or broken exterior tube/leaf shading in {id_}, {material}: {cosine:.4f}")
                faces += 1
        if id_ in {"N13", "S14"}:
            steel = next((p for name, p in groups.items() if name.startswith("Painted exterior steel")), [])
            if not steel:
                raise ValueError(f"Missing structural members in {id_}")
            heights = [point[1] for point in steel]
            if id_ == "N13" and max(heights) < node["extras"]["heightM"] + 2.2:
                raise ValueError("N13 trellis is missing above the roof")
            if id_ == "S14" and not (8 < min(heights) < max(heights) < 9.1):
                raise ValueError("S14 canopy truss lost its two-chord depth")
        if id_ == "N10":
            stairs = next((p for name, p in groups.items() if name.startswith("Stone terrace")), [])
            if not stairs or max(point[1] for point in stairs) < 3.5:
                raise ValueError("N10 stair flight is missing")
        if id_ == "N20":
            fins = next((p for name, p in groups.items() if name.startswith("Slab and coping")), [])
            projection = max((Point(point[0], -point[2]).distance(outlines[id_]) for point in fins), default=0)
            if not 0.95 < projection < 1.15:
                raise ValueError("N20 deep tapered fins are missing or exceed their profile")
        checked.add(id_)
    if checked != expected or faces < 1000:
        raise ValueError("Landmark verification did not cover the new exterior structures")
    print(f"Checked {len(checked)} landmark records and {faces:,} steel/planting faces")


if __name__ == "__main__":
    main()
