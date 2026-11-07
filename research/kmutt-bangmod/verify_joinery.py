"""Reject collapsed joinery faces and inverted shading normals in the authored GLB."""

import json
from math import acos, degrees, hypot
from struct import unpack_from

from verify_web_model import positions, read


def vectors(document, binary, accessor_id, format_, size):
    accessor = document["accessors"][accessor_id]
    view = document["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", size)
    return [
        unpack_from(format_, binary, start + i * stride)
        for i in range(accessor["count"])
    ]


def main():
    document, binary = read("detail")
    faces, worst, buildings = 0, 0.0, set()
    expected = {
        node["extras"]["featureId"] for node in document["nodes"]
        if "featureId" in node.get("extras", {})
    } - {"N8", "N14"}  # Service shutters, without modeled glazed joinery.
    roles = ("Window frame", "Aluminium mullion", "Entrance door frame")
    for node in document["nodes"]:
        if "featureId" not in node.get("extras", {}):
            continue
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            name = document["materials"][primitive["material"]]["name"]
            if not name.startswith(roles):
                continue
            points = list(positions(document, binary, node, primitive))
            normals = vectors(
                document, binary, primitive["attributes"]["NORMAL"], "<3b", 3
            )
            indices = document["accessors"][primitive["indices"]]
            wide = indices["componentType"] == 5125
            triangles = vectors(
                document, binary, primitive["indices"],
                "<I" if wide else "<H", 4 if wide else 2,
            )
            for offset in range(0, len(triangles), 3):
                ids = [index[0] for index in triangles[offset:offset + 3]]
                a, b, c = [points[index] for index in ids]
                ab = [y - x for x, y in zip(a, b, strict=True)]
                ac = [y - x for x, y in zip(a, c, strict=True)]
                cross = (ab[1] * ac[2] - ab[2] * ac[1],
                         ab[2] * ac[0] - ab[0] * ac[2],
                         ab[0] * ac[1] - ab[1] * ac[0])
                length = hypot(*cross)
                if length < 1e-10:
                    raise ValueError(
                        f"Collapsed joinery triangle: {node['name']}, {name}"
                    )
                for index in ids:
                    normal = normals[index]
                    cosine = sum(
                        x * y for x, y in zip(cross, normal, strict=True)
                    ) / (length * hypot(*normal))
                    angle = degrees(acos(max(-1, min(1, cosine))))
                    if angle > 2:
                        raise ValueError(
                            f"Joinery shading normal disagrees with winding: "
                            f"{node['name']}, {name}, {angle:.3f} degrees"
                        )
                    worst = max(worst, angle)
                faces += 1
                buildings.add(node["extras"]["featureId"])
    if not faces or buildings != expected:
        raise ValueError(f"Joinery validation coverage changed: {buildings ^ expected}")
    print(json.dumps({
        "joineryTriangles": faces, "buildingRecords": len(buildings),
        "maximumNormalAngleDegrees": round(worst, 3),
    }))


if __name__ == "__main__":
    main()
