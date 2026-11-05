"""Campus grounds from mapped paths and documented schematic landscaping."""

import itertools
from collections import defaultdict
from math import cos, pi, sin, sqrt
from random import Random

from facades import paint, solid
from geometry import Surface
from shapely import set_precision, union_all
from shapely.geometry import LineString, Point, shape


def surface_mesh(glb, label, layers):
    surfaces = defaultdict(Surface)
    for geometry, y, color in layers:
        if not geometry.is_empty:
            solid(surfaces[color], set_precision(geometry, 0.001), y - 0.025, y)
    return [
        glb.primitive(surface, paint(glb, f"{label} #{color}", color))
        for color, surface in surfaces.items()
        if surface.indices
    ]


def track_lines(track):
    lines = []
    for step in range(1, 7):
        inset = track.buffer(-step * 1.15)
        if not inset.is_empty:
            lines.append(inset.boundary.buffer(0.045))
    return union_all(lines)


def field_lines(field):
    corners = list(field.minimum_rotated_rectangle.exterior.coords)[:4]
    a, b, c, d = (complex(*p) for p in corners)
    if abs(b - a) < abs(d - a):
        a, b, c, d = b, c, d, a
    center = (a + c) / 2
    long, short = (b - a) / 2, (d - a) / 2

    def line(points):
        world = [center + long * x + short * y for x, y in points]
        return LineString([(p.real, p.imag) for p in world])

    features = [
        line(
            [(-0.94, -0.88), (0.94, -0.88), (0.94, 0.88), (-0.94, 0.88), (-0.94, -0.88)]
        ),
        line([(0, -0.88), (0, 0.88)]),
        Point(center.real, center.imag).buffer(9.15, quad_segs=28).boundary,
    ]
    for side in (-1, 1):
        for depth, width in ((0.3, 0.52), (0.105, 0.25)):
            end, inside = 0.94 * side, (0.94 - depth) * side
            features.append(
                line([(end, -width), (inside, -width), (inside, width), (end, width)])
            )
    return union_all(features).buffer(0.065).intersection(field)


def ellipsoid(surface, center, scale, rng):
    """Add a small, irregular canopy lobe with outward smooth normals."""
    count = 14
    rings = []
    for j in range(1, 8):
        angle = pi * j / 8
        points = []
        for k in range(count):
            azimuth = 2 * pi * k / count
            normal = (sin(angle) * cos(azimuth), cos(angle), sin(angle) * sin(azimuth))
            radius = rng.uniform(0.95, 1.05)
            points.append(
                tuple(c + s * n * radius for c, s, n in zip(center, scale, normal))
            )
        rings.append(points)
    top = (center[0], center[1] + scale[1], center[2])
    bottom = (center[0], center[1] - scale[1], center[2])

    def face(a, b, c):
        normals = []
        for point in (a, b, c):
            normal = tuple((p - o) / (s * s) for p, o, s in zip(point, center, scale))
            length = sqrt(sum(value * value for value in normal))
            normals.append(tuple(value / length for value in normal))
        surface.triangle_with_normals((a, b, c), normals)

    for k in range(count):
        nxt = (k + 1) % count
        face(top, rings[0][nxt], rings[0][k])
        for upper, lower in itertools.pairwise(rings):
            face(upper[k], upper[nxt], lower[k])
            face(upper[nxt], lower[nxt], lower[k])
        face(rings[-1][k], rings[-1][nxt], bottom)


def tree_mesh(glb, grounds, landscape, mapped_trees):
    rng = Random("KMUTT Bangmod landscaping")
    min_x, min_y, max_x, max_y = grounds.bounds
    positions = [p for p in mapped_trees if grounds.covers(p)]
    for ix in range(int(min_x), int(max_x) + 1, 12):
        for iy in range(int(min_y), int(max_y) + 1, 12):
            p = Point(ix + rng.uniform(-4, 4), iy + rng.uniform(-4, 4))
            if not grounds.covers(p) or any(p.distance(q) < 9 for q in positions):
                continue
            if landscape.covers(p) or rng.random() < 0.18:
                positions.append(p)
    surfaces = defaultdict(Surface)
    foliage = ("416339", "587340", "6a8149", "3c654a", "647d45")
    for p in positions:
        height, radius = rng.uniform(5, 11), rng.uniform(2.15, 3.75)
        solid(surfaces["72563d"], p.buffer(0.16, quad_segs=2), 0.04, height * 0.78)
        for i in range(4):
            angle = i * (2 * pi / 3)
            offset = 0 if i == 3 else radius * 0.47
            center = (
                p.x + cos(angle) * offset,
                height * (0.78 if i == 3 else 0.68),
                -p.y + sin(angle) * offset,
            )
            ellipsoid(
                surfaces[rng.choice(foliage)],
                center,
                (radius * 0.72, height * 0.28, radius * 0.69),
                rng,
            )
    print(
        f"Landscaping: {len(positions)} modeled trees, including {sum(grounds.covers(p) for p in mapped_trees)} mapped tree locations"
    )
    return [
        glb.primitive(surface, paint(glb, f"Landscape #{color}", color))
        for color, surface in surfaces.items()
    ]


def site_meshes(glb, footprints, raw_context, project):
    objects = {id_: geom for id_, _, geom in footprints}
    campus = objects["campus"]
    buildings = union_all(
        [geom for _, props, geom in footprints if props["kind"] == "building"]
    )
    water = union_all(
        [geom for _, props, geom in footprints if props["kind"] == "water"]
    ).difference(buildings.buffer(0.25))
    green = union_all(
        [geom for _, props, geom in footprints if props["kind"] == "green"]
    )
    track, field = objects["running-track"], objects["sports-field"]
    lines, mapped_trees = defaultdict(list), []
    for feature in raw_context["features"]:
        props = feature["properties"]
        geom = project(shape(feature["geometry"]))
        if props["kind"] == "tree":
            mapped_trees.append(geom)
        else:
            name = "road" if props["kind"] == "service" else "walk"
            lines[name].append(geom.buffer(props["widthM"] / 2, quad_segs=3))
    clear = campus.difference(union_all([buildings, water, track]))
    road = union_all(lines["road"]).intersection(clear)
    walks = union_all(lines["walk"]).intersection(clear).difference(road)
    usable = campus.buffer(-4.6).difference(
        union_all(
            [
                buildings.buffer(4.6),
                water.buffer(4.7),
                track.buffer(5),
                road.buffer(3),
                walks.buffer(2.4),
            ]
        )
    )
    platform = Surface()
    solid(platform, campus, -1.8, 0)
    yield (
        "Campus platform",
        [glb.primitive(platform, paint(glb, "Campus ground", "a9a69a"))],
    )
    yield (
        "Mapped drives and footways",
        surface_mesh(
            glb,
            "Paving",
            [
                (road, 0.042, "656d6d"),
                (walks, 0.049, "c4bdab"),
                (
                    road.buffer(0.22)
                    .intersection(clear)
                    .difference(road)
                    .difference(walks),
                    0.074,
                    "aaa79d",
                ),
            ],
        ),
    )
    planted = union_all([green, water.buffer(4.0), track.buffer(2.3)]).intersection(
        clear
    )
    planted = planted.difference(road).difference(walks).difference(water)
    yield (
        "Planted areas and ponds",
        surface_mesh(
            glb,
            "Ground cover",
            [
                (
                    planted,
                    0.034,
                    "788952",
                ),
            ],
        )
        + [
            glb.primitive(
                surface,
                paint(glb, "Pond water", "356a6c", metallic=0.16, roughness=0.3),
            )
            for surface in [water_surface(water)]
        ],
    )
    yield (
        "Athletics field and running lanes",
        surface_mesh(
            glb,
            "Sports surfaces",
            [
                (track, 0.043, "9f5140"),
                (field, 0.057, "597d43"),
                (track_lines(track).difference(field), 0.063, "d8c8b3"),
                (field_lines(field), 0.067, "dce0c9"),
            ],
        ),
    )
    yield "Modeled trees", tree_mesh(glb, usable, green.buffer(2.0), mapped_trees)


def water_surface(water):
    surface = Surface()
    solid(surface, water, 0.015, 0.06)
    return surface
