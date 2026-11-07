"""Render the detailed GLB in Blender Cycles from a reproducible local scene."""

import argparse
import hashlib
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--device", choices=("OPTIX", "CUDA", "CPU"), default="OPTIX")
    output_mode = parser.add_mutually_exclusive_group()
    output_mode.add_argument("--preview", action="store_true")
    output_mode.add_argument("--loading-poster", action="store_true")
    parser.add_argument(
        "--view", help="Render only the named output, such as bangmod-s15"
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if args.loading_poster and args.view:
        parser.error("--view is for the campus and building renders")
    return args


def configure_cycles(scene, device, preview):
    scene.render.engine = "CYCLES"
    if device != "CPU":
        cycles = bpy.context.preferences.addons["cycles"].preferences
        cycles.compute_device_type = device
        cycles.refresh_devices()
        enabled = []
        for item in cycles.devices:
            item.use = item.type == device
            if item.use:
                enabled.append(item.name)
        if not enabled:
            raise RuntimeError(f"No {device} render device is available")
        scene.cycles.device = "GPU"
        print(f"Cycles device: {device} / {', '.join(enabled)}", flush=True)
    else:
        scene.cycles.device = "CPU"
        print("Cycles device: CPU", flush=True)
    scene.cycles.samples = 20 if preview else 96
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = 0.025 if preview else 0.014
    scene.render.resolution_x = 1440 if preview else 3840
    scene.render.resolution_y = 960 if preview else 2560
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.48


def texture_surfaces():
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        shader = next(
            (
                node
                for node in material.node_tree.nodes
                if node.type == "BSDF_PRINCIPLED"
            ),
            None,
        )
        if shader is None:
            continue
        if material.name.startswith(("Glazing #", "Glazed spandrel #")):
            glass_finish(material.node_tree, shader)
            continue
        if material.name.startswith("Pond water"):
            scale, strength, depth = 1.8, 0.29, 0.08
        elif material.name.startswith(("Campus ground", "Ground cover", "Landscape #")):
            scale, strength, depth = 5.2, 0.24, 0.018
        elif material.name.startswith(("Paving", "Stone terrace", "Sports surfaces")):
            scale, strength, depth = 12.0, 0.22, 0.006
        elif material.name.startswith(("Sheet metal roof", "Timber-coloured cladding")):
            scale, strength, depth = 18.0, 0.15, 0.002
        elif material.name.startswith(
            (
                "Roof membrane",
                "Facade #",
                "Opening reveal",
                "Slab and coping",
                "Entrance canopy and posts",
            )
        ):
            scale, strength, depth = 23.0, 0.17, 0.003
        else:
            continue
        nodes, links = material.node_tree.nodes, material.node_tree.links
        coords = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        noise.inputs["Detail"].default_value = 3.0
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = strength
        bump.inputs["Distance"].default_value = depth
        links.new(coords.outputs["Object"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
        if material.name.startswith(
            ("Roof membrane", "Paving", "Facade #", "Ground cover", "Landscape #")
        ):
            tone = nodes.new("ShaderNodeValToRGB")
            tone.color_ramp.elements[0].color = (0.94, 0.94, 0.94, 1)
            tone.color_ramp.elements[1].color = (1, 1, 1, 1)
            variation = nodes.new("ShaderNodeMixRGB")
            variation.blend_type = "MULTIPLY"
            variation.inputs[0].default_value = 1
            variation.inputs[1].default_value = shader.inputs[
                "Base Color"
            ].default_value
            links.new(noise.outputs["Fac"], tone.inputs["Fac"])
            links.new(tone.outputs["Color"], variation.inputs[2])
            links.new(variation.outputs["Color"], shader.inputs["Base Color"])


def glass_finish(tree, shader):
    """Subtle reflectance variation on modeled glazing without image textures."""
    nodes, links = tree.nodes, tree.links
    shader.inputs["IOR"].default_value = 1.49
    shader.inputs["Coat Weight"].default_value = 0.23
    shader.inputs["Coat Roughness"].default_value = 0.16
    coords = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.31
    noise.inputs["Detail"].default_value = 1
    variation = nodes.new("ShaderNodeMapRange")
    roughness = shader.inputs["Roughness"].default_value
    variation.inputs["To Min"].default_value = roughness - 0.05
    variation.inputs["To Max"].default_value = roughness + 0.04
    links.new(coords.outputs["Object"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], variation.inputs["Value"])
    links.new(variation.outputs["Result"], shader.inputs["Roughness"])


def studio(scene):
    world = bpy.data.worlds.new("Bangmod daylight")
    world.use_nodes = True
    scene.world = world
    nodes, links = world.node_tree.nodes, world.node_tree.links
    background = nodes.get("Background")
    sky = nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_elevation = 0.7
    sky.sun_rotation = 2.35
    sky.sun_size = 0.065
    sky.sun_intensity = 0.72
    sky.altitude = 0.05
    sky.dust_density = 0.6
    background.inputs["Strength"].default_value = 0.21
    links.new(sky.outputs["Color"], background.inputs["Color"])

    bpy.ops.mesh.primitive_plane_add(size=3200, location=(0, 0, -1.92))
    plane = bpy.context.object
    plane.name = "Neutral studio backing"
    material = bpy.data.materials.new("Warm matte backdrop")
    material.diffuse_color = (0.39, 0.43, 0.42, 1)
    material.use_nodes = True
    material.node_tree.nodes.get("Principled BSDF").inputs[
        "Base Color"
    ].default_value = material.diffuse_color
    material.node_tree.nodes.get("Principled BSDF").inputs[
        "Roughness"
    ].default_value = 0.91
    plane.data.materials.append(material)
    return sky


def camera_for(scene, name, center, direction, scale=None, vertices=None):
    camera = bpy.data.cameras.new(name)
    camera.type = "ORTHO"
    camera.clip_end = 5000
    camera_object = bpy.data.objects.new(name, camera)
    scene.collection.objects.link(camera_object)
    offset = Vector(direction).normalized() * 1200
    camera_object.location = center + offset
    camera_object.rotation_euler = (-offset).to_track_quat("-Z", "Y").to_euler()
    if scale is None:
        view = camera_object.rotation_euler.to_matrix().transposed()
        projected = [view @ (p - center) for p in vertices]
        x0, x1 = min(p.x for p in projected), max(p.x for p in projected)
        y0, y1 = min(p.y for p in projected), max(p.y for p in projected)
        aspect = scene.render.resolution_x / scene.render.resolution_y
        camera.ortho_scale = max(x1 - x0, (y1 - y0) * aspect) * 1.12
        local_shift = Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0))
        camera_object.location += view.transposed() @ local_shift
    else:
        camera.ortho_scale = scale
    return camera_object


def building_bounds(scene, feature_id):
    root = next(obj for obj in scene.objects if obj.get("featureId") == feature_id)
    return [
        obj.matrix_world @ Vector(corner)
        for obj in [root, *root.children_recursive]
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]


def closeup(scene, name, center, offset, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 3000
    camera = bpy.data.objects.new(name, data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector(offset)
    camera.rotation_euler = (
        (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    return camera


def main():
    args = arguments()
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    scene = bpy.context.scene
    scene["sourceGlbSha256"] = hashlib.sha256(args.model.read_bytes()).hexdigest()
    configure_cycles(scene, args.device, args.preview)
    bpy.context.view_layer.update()
    mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
    bounds = [
        obj.matrix_world @ Vector(corner)
        for obj in mesh_objects
        for corner in obj.bound_box
    ]
    lx_points = building_bounds(scene, "N16")
    lx_center = sum(lx_points, Vector()) / len(lx_points)
    texture_surfaces()
    sky = studio(scene)
    if args.loading_poster:
        scene.render.resolution_x = 1200
        scene.render.resolution_y = 675
        platform = next(obj for obj in mesh_objects if obj.name == "Campus platform")
        points = [
            platform.matrix_world @ vertex.co for vertex in platform.data.vertices
        ]
        points.extend(lx_points)
        scene.camera = camera_for(
            scene, "Loading poster", Vector(), (0.9, -1.45, 1.55), vertices=points
        )
        scene.render.filepath = str((args.output / "bangmod-loading.png").resolve())
        bpy.ops.render.render(write_still=True)
        return
    scene["attribution"] = (
        "OpenStreetMap contributors; Overture Maps Foundation and upstream sources; KMUTT campus atlas."
    )
    scene["detail_basis"] = (
        "Photo-informed exterior study. See the accompanying NOTICE and research README."
    )
    s3_points = building_bounds(scene, "S3")
    s3_center = sum(s3_points, Vector()) / len(s3_points)
    fibo_points = building_bounds(scene, "N9")
    fibo_center = sum(fibo_points, Vector()) / len(fibo_points)
    s4_points = [
        point
        for levels in (3, 4, 8, 11)
        for point in building_bounds(scene, f"S4-{levels}-floors")
    ]
    s4_center = sum(s4_points, Vector()) / len(s4_points)
    n7_points = building_bounds(scene, "N7")
    n7_center = sum(n7_points, Vector()) / len(n7_points)
    n11_points = building_bounds(scene, "N11")
    n11_center = sum(n11_points, Vector()) / len(n11_points)
    s14_points = building_bounds(scene, "S14")
    s14_center = sum(s14_points, Vector()) / len(s14_points)
    cameras = [
        camera_for(
            scene,
            "Campus overview",
            Vector((0, 0, 0)),
            (0.9, -1.45, 1.28),
            vertices=bounds,
        ),
        camera_for(
            scene,
            "LX and Emerald Pond",
            lx_center + Vector((0, -9, -2)),
            (1.2, -1.3, 0.86),
            scale=178,
        ),
        closeup(
            scene,
            "LX at pedestrian height",
            Vector((35, 39, 15)),
            (21, -24, -12.6),
            26,
        ),
        camera_for(
            scene,
            "LX roof and stepped podium",
            lx_center + Vector((2, 0, 6)),
            (0.75, -1.1, 1.65),
            scale=132,
        ),
        camera_for(
            scene,
            "S3 and its campus approach",
            s3_center + Vector((0, 4, 0)),
            (0.42, 1.45, 0.77),
            scale=128,
        ),
        closeup(
            scene,
            "FIBO from its campus approach",
            fibo_center + Vector((0, 0, -2)),
            (62, -45, 3),
            38,
        ),
        camera_for(
            scene,
            "Wissawa Wattana blocks",
            s4_center,
            (1.35, -0.72, 0.73),
            scale=195,
        ),
        closeup(
            scene,
            "S15 entrance and timber screens",
            Vector((-56, -97, 6.2)),
            (4, 38, -2.6),
            21,
        ),
        camera_for(scene, "N7 laboratory and lower wing", n7_center,
                   (0.9, -1.35, 0.95), scale=175),
        closeup(scene, "N11 metal entrance canopy", Vector((-24.5, 110.7, 6)),
                (0, -31, -2.7), 25),
        camera_for(scene, "S14 memorial barrel roof", s14_center,
                   (1.4, -0.35, 1.25), scale=135),
        closeup(scene, "N13 greenhouse trellis", Vector((-112.2, 52.3, 4.3)),
                (27, -23, -1.5), 43),
        closeup(scene, "N10 glazed entry and stair bay", Vector((10.4, 102.5, 5.2)),
                (0, -15, -3.4), 20),
        closeup(scene, "N20 isolated tapered-fin study", Vector((-55.1, -9.7, 10)),
                (2, -24, -7.7), 25),
        closeup(scene, "S14 entrance space frame", Vector((-202.3, -91.5, 5.4)),
                (25, -2, -3.6), 27),
    ]
    named_cameras = dict(
        zip(
            (
                "bangmod-campus",
                "bangmod-lx",
                "bangmod-lx-plaza",
                "bangmod-lx-roof",
                "bangmod-s3",
                "bangmod-fibo",
                "bangmod-s4",
                "bangmod-s15",
                "bangmod-n7",
                "bangmod-n11",
                "bangmod-s14",
                "bangmod-n13",
                "bangmod-n10",
                "bangmod-n20",
                "bangmod-s14-entry",
            ),
            cameras,
            strict=True,
        )
    )
    if args.view and args.view not in named_cameras:
        raise ValueError(f"Unknown view: {args.view}")
    for name, camera in named_cameras.items():
        if args.view and name != args.view:
            continue
        sky.sun_rotation = {
            "bangmod-s3": 0.65,
            "bangmod-fibo": 1.90,
            "bangmod-s15": 0.82,
            "bangmod-n11": 0.65,
            "bangmod-n10": 0.65,
            "bangmod-n13": 1.90,
            "bangmod-n20": 0.65,
            "bangmod-s14-entry": 1.90,
        }.get(name, 2.35)
        scene.camera = camera
        scene.render.filepath = str((args.output / f"{name}.png").resolve())
        # An explicitly isolated detail study avoids placing a camera in N19.
        # The campus model and all other views retain their complete surroundings.
        hidden = []
        if name == "bangmod-n20":
            root = next(obj for obj in scene.objects if obj.get("featureId") == "N20")
            keep = {root, *root.children_recursive}
            for obj in mesh_objects:
                if obj not in keep and not obj.hide_render:
                    hidden.append(obj)
                    obj.hide_render = True
        try:
            bpy.ops.render.render(write_still=True)
        finally:
            for obj in hidden:
                obj.hide_render = False
    if not args.preview:
        sky.sun_rotation = 2.35
        scene.camera = cameras[0]
        scene.render.filepath = "//bangmod-campus.png"
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(
            filepath=str((args.output / "kmutt-bangmod.blend").resolve())
        )


if __name__ == "__main__":
    main()
