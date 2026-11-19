"""Author and render the original Reunite landing characters with Blender."""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, hex_color, roughness=0.38, metal=0):
    def linear(value):
        return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4

    rgb = tuple(linear(int(hex_color[i : i + 2], 16) / 255) for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    return mat


cream = material("Porcelain feathers", "FFF1DB", 0.36)
wing = material("Feather shadow", "F5DBBA", 0.47)
gold = material("Amber beak and feet", "EDA333", 0.31)
ochre = material("Beak seam", "C36B27", 0.42)
espresso = material("Dark coffee", "382016", 0.34)
orange = material("Reunite terracotta", "C83A13", 0.33)
dusk = material("Dusty slate", "526167", 0.48)
tan = material("Caramel coat", "B66E43", 0.49)
light_tan = material("Caramel lapels", "E4A97B", 0.44)
metal = material("Brass hardware", "C99344", 0.24, 0.62)
glass = material("Smoky teal lenses", "244E53", 0.23, 0.48)
peach = material("Porcelain platform", "EAB998", 0.43)
base_clay = material("Fired clay plinth", "AE6443", 0.54)
blush = material("Peach cheek", "ECAE87", 0.52)
white = material("Catchlight and porcelain trim", "FFF9E9", 0.26)


def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def use(obj, name, mat, parent=None):
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def ball(name, location, scale, mat, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=16, location=location)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler = rotation
    smooth(obj)
    return use(obj, name, mat, parent)


def cylinder(name, at, radius, depth, mat, parent=None, rotation=(0, 0, 0), bevel=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=at)
    obj = bpy.context.object
    obj.rotation_euler = rotation
    if bevel:
        mod = obj.modifiers.new("Rounded edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new("Surface normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
    return use(obj, name, mat, parent)


def ring(name, location, radius, tube, mat, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=56, minor_segments=10, location=location,
        rotation=rotation, major_radius=radius, minor_radius=tube,
    )
    obj = bpy.context.object
    smooth(obj)
    return use(obj, name, mat, parent)


def mesh(name, verts, faces, mat, parent):
    model = bpy.data.meshes.new(name)
    model.from_pydata(verts, [], faces)
    model.update()
    obj = bpy.data.objects.new(name, model)
    bpy.context.collection.objects.link(obj)
    smooth(obj)
    return use(obj, name, mat, parent)


def neck(parent, lean):
    controls = [Vector(v) for v in ((0, -.31, 1.18), (0, -1.06, 1.57), (0, -.25, 2.05), (0, -.62 + lean, 2.57))]
    verts, faces = [], []
    sides, rings = 24, 25
    for j in range(rings):
        t = j / (rings - 1)
        u = 1 - t
        a, b, c, d = controls
        center = a * u**3 + b * (3 * u**2 * t) + c * (3 * u * t**2) + d * t**3
        tangent = ((b - a) * (3 * u**2) + (c - b) * (6 * u * t) + (d - c) * (3 * t**2)).normalized()
        side = Vector((1, 0, 0))
        normal = tangent.cross(side)
        radius = .22 + .17 * u**3 + .02 * t**4
        for k in range(sides):
            angle = 2 * math.pi * k / sides
            verts.append(center + radius * (side * math.cos(angle) + normal * math.sin(angle)))
            if j:
                row = j * sides
                following = (k + 1) % sides
                faces.append((row - sides + k, row - sides + following, row + following, row + k))
    return mesh("Curved neck", verts, faces, cream, parent)


def pivot(name, parent=None):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.parent = parent
    return root


umbrella_fabric = material("Navy umbrella cloth", "296891", .73)
umbrella_edge = material("Umbrella seam", "6796B1", .63)


def folding_umbrella():
    umbrella = pivot("Umbrella")

    profiles = [(-.84, .026), (-.73, .054), (-.49, .098), (-.17, .145), (.14, .158), (.33, .138), (.46, .126), (.53, .057)]
    vertices, faces = [], []
    sides = 48
    for z, radius in profiles:
        for side in range(sides):
            angle = math.tau * side / sides
            cloth = radius * (1 + .15 * math.cos(8 * angle + z * 2.4))
            vertices.append((cloth * math.cos(angle), cloth * math.sin(angle), z))
    for row in range(len(profiles) - 1):
        for side in range(sides):
            nxt = (side + 1) % sides
            faces.append((row * sides + side, row * sides + nxt, (row + 1) * sides + nxt, (row + 1) * sides + side))
    faces += [tuple(reversed(range(sides))), tuple(range(len(vertices) - sides, len(vertices)))]
    mesh("Eight fabric pleats", vertices, faces, umbrella_fabric, umbrella)
    cylinder("Handle shaft", (0, 0, .58), .023, .4, espresso, umbrella, bevel=.006)
    cylinder("Rubber grip", (0, 0, .82), .071, .19, dusk, umbrella, bevel=.028)
    cylinder("Cinch strap", (0, 0, -.07), .153, .092, umbrella_edge, umbrella, bevel=.008)
    ball("Strap snap", (.162, .018, -.07), (.016, .028, .027), metal, umbrella)
    cylinder("Tip ferrule", (0, 0, -.852), .032, .076, dusk, umbrella, bevel=.008)
    return umbrella


def goose(name, location, size, yaw, outfit):
    parent = pivot(name)
    # Build child geometry in local space before positioning the whole figure.
    ball("Body", (0, .06, .91), (.76, 1.0, .67), tan if outfit == "Agent" else cream, parent)
    breast = ((0, -.49, 1.18), (.54, .55, .48)) if outfit == "Agent" else ((0, -.42, 1.01), (.62, .62, .58))
    ball("Breast", *breast, cream, parent)
    for x in [-.19, 0, .19]:
        ball("Tail feather", (x, .83, 1.09), (.19, .48, .17), cream, parent, (.31, 0, x * .5))
    lean = .09 if outfit == "Scout" else 0
    neck(parent, lean)
    y = -.63 + lean
    ball("Head", (0, y, 2.6), (.38, .4, .37), cream, parent)
    ball("Lower bill", (0, y - .43, 2.475), (.24, .36, .079), ochre, parent, (-.08, 0, 0))
    ball("Bill", (0, y - .45, 2.55), (.27, .40, .118), gold, parent, (-.03, 0, 0))
    for side in [-1, 1]:
        ball("Eye", (side * .304, y - .188, 2.685), (.087, .083, .10), espresso, parent)
        ball("Eye glint", (side * .349, y - .237, 2.725), (.029, .024, .027), white, parent)
        ball("Cheek", (side * .335, y - .063, 2.513), (.036, .125, .074), blush, parent)
        ball("Nostril", (side * .102, y - .52, 2.652), (.025, .034, .008), ochre, parent)
        ball("Webbed foot", (side * .34, -.31, .12), (.26, .39, .105), gold, parent, (0, 0, side * .13))
        ball("Ankle", (side * .35, -.19, .28), (.095, .105, .21), gold, parent)
        ball("Wing", (side * .59, .04, .97), (.23, .73, .39), wing, parent, (.13, side * .17, -side * .08))
        ball("Wing feather", (side * .734, .25, 1.00), (.086, .46, .18), cream, parent, (.19, side * .2, -side * .08))

    if outfit == "Agent":
        for side in [-1, 1]:
            ball("Sleeve", (side * .64, -.16, 1.057), (.215, .65, .30), tan, parent, (side * .25, side * .17, 0))
            ball("Lapel", (side * .18, -.924, 1.26), (.17, .09, .31), light_tan, parent, (.21, side * .32, 0))
        for x, z in [(.15, .78), (-.15, .78), (.14, .98), (-.14, .98)]:
            ball("Coat button", (x, -.999, z), (.044, .026, .044), metal, parent)
        brim = cylinder("Fedora brim", (.04, y + .016, 2.92), .53, .065, espresso, parent, (.07, -.16, -.1))
        brim.scale.y = .87
        ball("Fedora crown", (.04, y + .035, 3.05), (.35, .34, .26), espresso, parent, (.08, -.18, 0))
        band = cylinder("Fedora ribbon", (.052, y + .03, 2.987), .355, .078, orange, parent, (.06, -.16, 0))
        band.scale.y = .94
        ball("Binocular hold", (.44, -1.07, 1.57), (.28, .27, .23), cream, parent, (0, .15, -.24))
        binoculars = pivot("Binoculars", parent=parent)
        ball("Binocular bridge", (.20, -1.24, 1.85), (.28, .16, .075), espresso, binoculars)
        for x in [.028, .385]:
            facing = (math.pi / 2, 0, 0)
            cylinder("Binocular barrel", (x, -1.25, 1.85), .15, .39, espresso, binoculars, facing)
            ring("Brass lens rim", (x, -1.46, 1.85), .13, .017, metal, binoculars, facing)
            cylinder("Lens", (x, -1.467, 1.85), .113, .028, glass, binoculars, facing, .006)
            ball("Lens reflection", (x - .044, -1.488, 1.894), (.024, .007, .019), white, binoculars)
        binoculars.location = (.20, -1.14, 1.76)
        for part in binoculars.children:
            part.location -= binoculars.location
    elif outfit == "Scout":
        ball("Scout cap", (0, y + .02, 2.91), (.375, .35, .185), orange, parent, (0, -.1, 0))
        ball("Visor", (.014, y - .276, 2.856), (.36, .32, .037), orange, parent, (.14, 0, 0))
        ball("Cap badge", (0, y - .284, 2.985), (.09, .016, .045), white, parent)
        ball("Field bag", (.48, -.38, .83), (.30, .28, .34), dusk, parent, (.12, .13, .17))
        ball("Bag flap", (.50, -.608, .936), (.27, .083, .14), dusk, parent, (0, .1, .17))
        ball("Bag clasp", (.50, -.686, .882), (.05, .023, .05), metal, parent)
        ball("Satchel strap", (.12, -.648, 1.135), (.048, .071, .53), dusk, parent, (.52, -.65, .21))
    else:
        r = ring("Silk scarf", (0, -.637, 1.59), .282, .079, orange, parent, (.24, -.13, 0))
        r.scale.y = 1.06
        ball("Scarf knot", (.20, -.854, 1.56), (.13, .13, .11), orange, parent)
        ball("Scarf end", (.27, -.817, 1.34), (.105, .085, .29), orange, parent, (0, -.33, .19))
        ball("Scarf corner", (.35, -.783, 1.40), (.081, .08, .225), orange, parent, (.13, -.49, .19))
        ring("Key ring", (-.56, -.77, .91), .13, .029, metal, parent, (math.pi / 2, .2, 0))
        ball("Key blade", (-.55, -.77, .72), (.045, .035, .15), metal, parent, (0, -.12, 0))
    parent.location = location
    parent.scale = (size,) * 3
    parent.rotation_euler.z = math.radians(yaw)
    return parent


stage = bpy.data.objects.new("Objects", None)
bpy.context.collection.objects.link(stage)
cylinder("Fired clay base", (0, .04, -.21), 2.45, .27, base_clay, stage, bevel=.055)
cylinder("Limestone top", (0, .04, -.067), 2.42, .105, peach, stage, bevel=.032)
ring("Inset stage edge", (0, .04, -.015), 2.31, .009, white, stage)
ring("Engraved ring", (0, .04, -.012), 1.80, .009, light_tan, stage)
agent = goose("Agent", (.30, -.36, -.005), .99, -9, "Agent")
scout = goose("Scout", (-1.28, .42, -.005), .69, -23, "Scout")
keeper = goose("Keeper", (1.67, .45, -.005), .67, 21, "Keeper")

umbrella = folding_umbrella()
umbrella.location = (.20, -1.64, .18)
umbrella.rotation_euler = (.35, 1.34, .33)


def batch_by_material(parent):
    batches = {}
    for obj in parent.children:
        if obj.type == "MESH":
            batches.setdefault(obj.data.materials[0].name, []).append(obj)
    for material_name, objects in batches.items():
        if len(objects) == 1:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            bpy.context.view_layer.objects.active = obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"{parent.name} · {material_name}"


for part in (stage, agent, scout, keeper, umbrella, bpy.data.objects["Binoculars"]):
    batch_by_material(part)

# Export only the authored stage, excluding render lights, camera and paper sweep.
bpy.ops.export_scene.gltf(
    filepath=str(output / "finding-party.glb"),
    export_format="GLB",
    export_meshopt_compression_enable=True,
    export_meshopt_extension="EXT_meshopt_compression",
    export_texcoords=False,
)

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes.get("Background").inputs[0].default_value = (.48, .39, .34, 1)
world.node_tree.nodes.get("Background").inputs[1].default_value = .42


def light(name, at, aim, power, size, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", size, color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = at
    obj.rotation_euler = (Vector(aim) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


light("Warm key", (-4.5, -5.4, 7.2), (0, 0, 1.3), 780, 5.2, (1, .86, .72))
light("Cool fill", (4, -3, 4.7), (0, 0, 1.5), 335, 4.0, (.78, .89, 1))
light("Warm rim", (1.4, 4.2, 5.7), (0, 0, 1.55), 710, 3.0, (1, .76, .59))
camera = bpy.data.objects.new("Portrait camera", bpy.data.cameras.new("Portrait camera"))
bpy.context.collection.objects.link(camera)
scene = bpy.context.scene
scene.camera = camera
camera.data.type = "ORTHO"
scene.render.engine = "CYCLES"
scene.cycles.samples = 20
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.view_settings.view_transform = "AgX"


def render(filename, at, aim, scale, resolution):
    camera.location = at
    camera.rotation_euler = (Vector(aim) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = scale
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(output / filename)
    bpy.ops.render.render(write_still=True)


render("finding-party-studio.png", (5.5, -11.4, 6.3), (.15, 0, 1.3), 5.75, (1200, 1024))
for name, actor in [("agent", agent), ("keeper", keeper), ("scout", scout)]:
    for group in (stage, agent, scout, keeper, umbrella):
        for obj in group.children_recursive:
            obj.hide_render = group != actor
    x, y, z = actor.location
    scale = 3.8 if actor == agent else 2.65
    aim_z = 1.52 if actor == agent else 1.02
    render(name + ".png", (x + 2.8, y - 7, z + 3.66), (x, y - .1, z + aim_z), scale, (640, 740))

# The same mesh supplies the photograph and the final handover.
for obj in scout.children_recursive:
    obj.hide_render = True
for obj in umbrella.children_recursive:
    obj.hide_render = False
umbrella.location = (0, 0, 0)
umbrella.rotation_euler = (.35, 1.34, .33)
render("umbrella-attachment.png", (5.5, -11.4, 6.3), (0, 0, 0), 2.14, (640, 640))

finder = goose("Finder handover", (-.98, 0, 0), .78, 38, "Keeper")
owner = goose("Owner handover", (.98, .03, 0), .76, -42, "Scout")
for obj in finder.children:
    if obj.name.startswith(("Key ring", "Key blade")):
        obj.hide_render = True
umbrella.location = (.0, -.70, .95)
umbrella.rotation_euler = (.29, 1.43, .10)
umbrella.scale = (.81,) * 3
bpy.context.view_layer.update()


def offer_wing(actor, shoulder, umbrella_point):
    # Place the tips beneath the actual umbrella so both wings support it.
    grip = actor.matrix_world.inverted() @ (umbrella.matrix_world @ Vector(umbrella_point))
    grip.z -= .085
    shoulder = Vector(shoulder)
    reach = grip - shoulder
    feathers = ball("Extended wing", shoulder.lerp(grip, .55), (.185, reach.length * .67, .17), cream, actor)
    feathers.rotation_euler = reach.to_track_quat("Y", "Z").to_euler()


offer_wing(finder, (.54, -.10, 1.04), (0, 0, -.47))
offer_wing(owner, (-.54, -.10, 1.04), (0, 0, .61))


def tile(name, location, size, surface, radius=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    tile_object = use(bpy.context.object, name, surface)
    tile_object.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = tile_object.modifiers.new("Soft masonry edges", "BEVEL")
    bevel.width = radius
    bevel.segments = 2
    tile_object.modifiers.new("Flat face normals", "WEIGHTED_NORMAL")


# A miniature covered walk gives the handover a place and a time of day.
floor = material("Sandstone paving", "AD9581", .81)
seam = material("Paving joints", "5F5548", .9)
pillar = material("Warm concrete", "CEAD8A", .75)
brick = material("Terracotta wall", "A4593E", .83)
brick_band = material("Recessed terracotta", "7F4E3B", .85)
window = material("Blue tinted glazing", "34504F", .36, .19)
frame = material("Window mullions", "5A5146", .55)
wood = material("Teak bench", "875E43", .61)

tile("Floor beneath paving", (0, .3, -.10), (18, 20, .16), seam)
for row in range(-3, 6):
    for column in range(-6, 7):
        tile("Paving slab", (column * 1.03 + (row % 2) * .515, row * .78, -.026), (1.015, .765, .052), floor, .012)
tile("Courtyard facade", (0, 3.66, 1.66), (18, .25, 3.45), brick)
for z in [.33, .55, .77, 2.83, 3.07]:
    tile("Masonry course", (0, 3.52, z), (18, .023, .023), brick_band, .004)
for x in [-5.2, -2.45, .3, 3.05, 5.8]:
    tile("Window surround", (x, 3.48, 1.82), (2.24, .12, 1.61), frame)
    for dx in [-.74, 0, .74]:
        tile("Glazing pane", (x + dx, 3.41, 1.83), (.67, .025, 1.49), window, .006)
    tile("Rain ledge", (x, 3.40, 1.015), (2.31, .25, .09), pillar)
for x in [-6.62, -3.85, -1.10, 1.67, 4.42, 7.17]:
    tile("Concrete column", (x, 2.64, 1.8), (.24, .3, 3.6), pillar, .023)
    tile("Column base", (x, 2.64, .06), (.38, .42, .12), pillar)
tile("Walkway canopy", (0, 2.95, 3.25), (18, 1.4, .22), pillar, .025)
for x in [-4.95, 3.16]:
    tile("Bench seat", (x, 2.17, .45), (1.76, .38, .09), wood)
    for dx in [-.67, .67]:
        tile("Bench leg", (x + dx, 2.17, .22), (.1, .33, .43), frame)

late_sun = light("Afternoon sun", (1.4, -4.8, 6.5), (.15, .6, .65), 1700, 2.9, (1, .72, .43))
late_sun.data.shape = "DISK"
scene.cycles.samples = 32
scene.render.film_transparent = False
render("umbrella-return-courtyard.png", (-1.35, -11, 3.9), (-1.35, .2, 1.21), 8.45, (1600, 950))
