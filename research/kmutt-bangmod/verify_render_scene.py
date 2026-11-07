"""Check the saved Blender delivery, using Blender's Python interpreter."""

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    raw = args.model.read_bytes()
    if bpy.context.scene.get("sourceGlbSha256") != hashlib.sha256(raw).hexdigest():
        raise ValueError("Saved Blender scene was not generated from the current GLB")
    size = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20 : 20 + size])
    expected = {node["extras"]["featureId"]: node["extras"] for node in gltf["nodes"] if "featureId" in node.get("extras", {})}
    modeled = {obj["featureId"]: obj for obj in bpy.context.scene.objects if "featureId" in obj}
    if len(expected) != 39 or modeled.keys() != expected.keys():
        raise ValueError("Saved Blender scene does not contain the 39 model records")
    for id_, props in expected.items():
        if modeled[id_]["heightM"] != props["heightM"]:
            raise ValueError(f"Saved Blender height metadata is stale: {id_}")
        if any(obj.hide_render for obj in (modeled[id_], *modeled[id_].children_recursive)):
            raise ValueError(f"An isolated review view hid a building in the saved campus scene: {id_}")
    if len(bpy.data.cameras) != 15:
        raise ValueError("Expected fifteen campus and building cameras")
    if bpy.data.libraries:
        raise ValueError("Delivery scene depends on an external Blender library")
    textures = [image for image in bpy.data.images if image.source == "FILE"]
    if len(textures) != 1 or tuple(textures[0].size) != (2048, 2048) or textures[0].packed_file is None:
        raise ValueError("Expected one packed 2048-square sign atlas")
    view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    offset = 28 + size + view.get("byteOffset", 0)
    image_data = raw[offset : offset + view["byteLength"]]
    if hashlib.sha256(bytes(textures[0].packed_file.data)).digest() != hashlib.sha256(image_data).digest():
        raise ValueError("Saved Blender lettering atlas differs from the current GLB")
    if bpy.context.scene.render.engine != "CYCLES" or bpy.context.scene.cycles.samples != 96:
        raise ValueError("Final scene must retain Cycles 96-sample render settings")
    print("PASS editable Blender scene: current GLB SHA-256, 39 buildings, 15 cameras, current packed sign atlas, no external libraries, Cycles 96 samples")


if __name__ == "__main__":
    main()
