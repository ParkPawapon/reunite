"""Render isolated north, east, south, west and roof views for exterior review."""

import argparse
import sys
from math import ceil, pi
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from render import camera_for, configure_cycles

VIEWS = {
    "north": (pi, 0),
    "east": (-pi / 2, 0),
    "south": (0, 0),
    "west": (pi / 2, 0),
    "roof-oblique": (-pi / 4, 0.87),
}
COLUMNS = 6
CELL_WIDTH = 960
CELL_HEIGHT = 750


def label(stage, name, x, z, material):
    data = bpy.data.curves.new(name, "FONT")
    data.body = name
    data.align_x = "CENTER"
    data.size = 0.052
    data.materials.append(material)
    object_ = bpy.data.objects.new(name, data)
    stage.objects.link(object_)
    object_.location = (x, -1.8, z)
    object_.rotation_euler.x = pi / 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--device", choices=("OPTIX", "CUDA", "CPU"), default="OPTIX")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    bpy.context.view_layer.update()
    scene = bpy.context.scene
    campus = next(obj for obj in scene.objects if obj.name == "Buildings")
    records = []
    for root in campus.children:
        meshes = [obj for obj in (root, *root.children_recursive) if obj.type == "MESH"]
        source = [
            (obj.data, obj.matrix_world.copy(), tuple(map(Vector, obj.bound_box)))
            for obj in meshes
        ]
        if not source:
            raise ValueError(f"No exterior mesh for {root.name}")
        records.append((root["featureId"], source))
    records.sort(
        key=lambda entry: (entry[0][0], int(entry[0][1:].split("-")[0]), entry[0])
    )
    if len(records) != 39:
        raise ValueError("Expected 39 isolated building records")
    for obj in list(scene.objects):
        obj.hide_render = True

    rows = ceil(len(records) / COLUMNS)
    configure_cycles(scene, args.device, True)
    scene.render.resolution_x = COLUMNS * CELL_WIDTH
    scene.render.resolution_y = rows * CELL_HEIGHT
    scene.view_settings.exposure = 0.15
    world = bpy.data.worlds.new("Elevation studio")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.68, 0.71, 0.74, 1)
    background.inputs["Strength"].default_value = 0.42
    scene.world = world
    sun = bpy.data.lights.new("Elevation key", "SUN")
    sun.energy = 1.4
    sun.angle = 0.12
    key = bpy.data.objects.new(sun.name, sun)
    key.rotation_euler = (Vector((2, 5, -6))).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(key)
    material = bpy.data.materials.new("Building ID")
    material.diffuse_color = (0.04, 0.05, 0.055, 1)
    scene.camera = camera_for(
        scene, "Elevation sheet", Vector(), (0, -1, 0), scale=COLUMNS
    )

    for view, (yaw, pitch) in VIEWS.items():
        stage = bpy.data.collections.new(view)
        scene.collection.children.link(stage)
        rotation = Matrix.Rotation(pitch, 4, "X") @ Matrix.Rotation(yaw, 4, "Z")
        for index, (id_, source) in enumerate(records):
            points = [
                rotation @ transform @ corner
                for _, transform, corners in source
                for corner in corners
            ]
            low = Vector(tuple(min(p[axis] for p in points) for axis in range(3)))
            high = Vector(tuple(max(p[axis] for p in points) for axis in range(3)))
            center = (low + high) / 2
            size = high - low
            scale = min(0.84 / size.x, 0.58 / size.z)
            x = index % COLUMNS - (COLUMNS - 1) / 2
            z = ((rows - 1) / 2 - index // COLUMNS) * (CELL_HEIGHT / CELL_WIDTH)
            move = Matrix.Translation(Vector((x, 0, z + 0.04)) - center * scale)
            for data, transform, _ in source:
                mesh = bpy.data.objects.new(id_, data)
                stage.objects.link(mesh)
                mesh.matrix_world = move @ Matrix.Scale(scale, 4) @ rotation @ transform
            label(stage, id_, x, z - 0.33, material)
        scene.render.filepath = str((args.output / f"{view}.png").resolve())
        bpy.ops.render.render(write_still=True)
        for obj in list(stage.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(stage)
    print(f"Rendered {len(records)} records in {len(VIEWS)} views")


if __name__ == "__main__":
    main()
