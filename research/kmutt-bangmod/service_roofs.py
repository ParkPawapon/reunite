"""Sloped metal roof geometry for the two services buildings visible in the atlas."""

from itertools import pairwise
from math import hypot

from geometry import Surface
from shapely import constrained_delaunay_triangles, get_parts, orient_polygons
from shapely.geometry import LineString
from shapely.ops import split

SLOPED_ROOFS = {
    "N8": ("shed", 0.54, 0.62),
    "N14": ("gable", 0.92, 0.63),
}


def service_roof(footprint, outline, height, eave, profile, across):
    east, north = across
    center = outline.centroid

    def cross(point):
        return (point[0] - center.x) * east + (point[1] - center.y) * north

    bounds = [cross(point) for point in outline.exterior.coords]
    low, high = min(bounds), max(bounds)
    mid = (low + high) / 2
    if profile == "gable":
        # The ridge divides the cap into planar parts so triangulation preserves it.
        reach = max(high - low, outline.length)
        splitter = LineString(
            [
                (
                    center.x + mid * east - side * north,
                    center.y + mid * north + side * east,
                )
                for side in (-reach, reach)
            ]
        )
        parts = get_parts(split(outline, splitter))
    else:
        parts = [outline]

    def vertex(point, thickness=0):
        across_roof = cross(point)
        if profile == "gable":
            ratio = 1 - abs(across_roof - mid) / (high - mid)
        else:
            ratio = (across_roof - low) / (high - low)
        return point[0], eave + (height - eave) * ratio - thickness, -point[1]

    roof, underside = Surface(), Surface()
    for part in parts:
        triangles = orient_polygons(constrained_delaunay_triangles(part))
        for triangle in triangles.geoms:
            points = list(triangle.exterior.coords)[:3]
            top = tuple(vertex(point) for point in points)
            normal = face_normal(*top)
            roof.triangle(top, normal)
            underside.triangle(
                tuple(vertex(point, 0.12) for point in reversed(points)),
                tuple(-component for component in normal),
            )
        for start, end in pairwise(orient_polygons(part).exterior.coords):
            if profile == "gable" and all(
                abs(cross(p) - mid) < 0.0001 for p in (start, end)
            ):
                continue
            a, b, c, d = (
                vertex(start, 0.12),
                vertex(end, 0.12),
                vertex(end),
                vertex(start),
            )
            normal = face_normal(a, b, c)
            roof.triangle((a, b, c), normal)
            roof.triangle((a, c, d), normal)
    gable = Surface()
    for start, end in pairwise(footprint.exterior.coords):
        segments = [start, end]
        a, b = cross(start), cross(end)
        if profile == "gable" and min(a, b) < mid < max(a, b):
            t = (mid - a) / (b - a)
            segments.insert(
                1, tuple(s + t * (e - s) for s, e in zip(start, end, strict=True))
            )
        for first, second in pairwise(segments):
            x1, y1, z1 = vertex(first)
            x2, y2, z2 = vertex(second)
            length = hypot(x2 - x1, z2 - z1)
            normal = ((z1 - z2) / length, 0, (x2 - x1) / length)
            bottom_a, bottom_b = (x1, eave - 0.13, z1), (x2, eave - 0.13, z2)
            top_b, top_a = (x2, y2 - 0.08, z2), (x1, y1 - 0.08, z1)
            gable.triangle((bottom_a, bottom_b, top_b), normal)
            gable.triangle((bottom_a, top_b, top_a), normal)
    return roof, underside, gable


def face_normal(a, b, c):
    u = tuple(q - p for p, q in zip(a, b, strict=True))
    v = tuple(q - p for p, q in zip(a, c, strict=True))
    x, y, z = (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )
    length = hypot(x, y, z)
    return x / length, y / length, z / length
