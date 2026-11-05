"""Compare every decoded web vertex with the float32 authoring model."""

import json
from math import dist
from struct import unpack_from

from build import PREFIX, PUBLIC


def read(suffix):
    data = (PUBLIC / f"{PREFIX}-{suffix}.glb").read_bytes()
    end = 20 + unpack_from("<I", data, 12)[0]
    return json.loads(data[20:end]), data[end + 8 :]


def positions(doc, binary, node, primitive):
    accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
    view = doc["bufferViews"][accessor["bufferView"]]
    short = accessor["componentType"] == 5123
    stride = view.get("byteStride", 8 if short else 12)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    scale, origin = node.get("scale", [1] * 3), node.get("translation", [0] * 3)
    for index in range(accessor["count"]):
        point = unpack_from("<3H" if short else "<3f", binary, start + index * stride)
        yield tuple(axis * s + o for axis, s, o in zip(point, scale, origin))


def main():
    raw, raw_bytes = read("detail")
    web, web_bytes = read("web")
    if len(raw["nodes"]) != len(web["nodes"]):
        raise ValueError("Node counts disagree")
    maximum, vertices = 0, 0
    for raw_node, web_node in zip(raw["nodes"], web["nodes"], strict=True):
        if raw_node["name"] != web_node["name"] or raw_node.get("extras") != web_node.get("extras"):
            raise ValueError("Node identity or source evidence changed")
        if "mesh" not in raw_node:
            continue
        raw_mesh = raw["meshes"][raw_node["mesh"]]
        web_mesh = web["meshes"][web_node["mesh"]]
        for a, b in zip(raw_mesh["primitives"], web_mesh["primitives"], strict=True):
            if a["material"] != b["material"]:
                raise ValueError("Web material changed")
            for p, q in zip(
                positions(raw, raw_bytes, raw_node, a),
                positions(web, web_bytes, web_node, b), strict=True,
            ):
                maximum = max(maximum, dist(p, q))
                vertices += 1
    if maximum > 0.002:
        raise ValueError(f"Decoded position error exceeds 2 mm: {maximum}")
    print(f"{vertices:,} vertices compared; maximum 3D displacement {maximum * 1000:.3f} mm")


if __name__ == "__main__":
    main()
