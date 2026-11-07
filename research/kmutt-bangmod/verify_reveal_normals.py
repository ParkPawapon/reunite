"""Bound the lighting-normal change on web recess faces with derived flat normals."""

from math import acos, degrees, hypot

from verify_joinery import vectors
from verify_web_model import positions, read


def main():
    raw, raw_bytes = read("detail")
    web, web_bytes = read("web")
    maximum, faces = 0.0, 0
    for node, compact_node in zip(raw["nodes"], web["nodes"], strict=True):
        if "mesh" not in node:
            continue
        for authored, compact in zip(raw["meshes"][node["mesh"]]["primitives"],
                                      web["meshes"][compact_node["mesh"]]["primitives"], strict=True):
            material = raw["materials"][authored["material"]]["name"]
            expected = material.startswith("Opening reveal #")
            if ("NORMAL" not in compact["attributes"]) != expected:
                raise ValueError(f"Unexpected normal omission/preservation: {node['name']}, {material}")
            if not expected:
                continue
            points = list(positions(web, web_bytes, compact_node, compact))
            normals = vectors(raw, raw_bytes, authored["attributes"]["NORMAL"], "<3b", 3)
            wide = raw["accessors"][authored["indices"]]["componentType"] == 5125
            indices = vectors(raw, raw_bytes, authored["indices"], "<I" if wide else "<H", 4 if wide else 2)
            for start in range(0, len(indices), 3):
                ids = [index[0] for index in indices[start:start + 3]]
                a, b, c = [points[index] for index in ids]
                ab = [y - x for x, y in zip(a, b, strict=True)]
                ac = [y - x for x, y in zip(a, c, strict=True)]
                normal = (ab[1] * ac[2] - ab[2] * ac[1],
                          ab[2] * ac[0] - ab[0] * ac[2],
                          ab[0] * ac[1] - ab[1] * ac[0])
                length = hypot(*normal)
                if length < 1e-10:
                    raise ValueError("Derived reveal normal has collapsed")
                for index in ids:
                    stored = normals[index]
                    cosine = sum(x * y for x, y in zip(normal, stored, strict=True)) / (length * hypot(*stored))
                    angle = degrees(acos(max(-1, min(1, cosine))))
                    maximum = max(maximum, angle)
                faces += 1
    if not faces or maximum > 1:
        raise ValueError(f"Derived reveal normals exceed the 1 degree bound: {maximum}")
    print(f"{faces:,} derived reveal faces; maximum authored/derived normal difference {maximum:.3f} degrees")


if __name__ == "__main__":
    main()
