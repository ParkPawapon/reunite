"""Photo-informed exterior structures, independent of the GLB writer and viewer."""

from math import cos, hypot, pi, sin
from random import Random

from shapely.geometry import Point
from wall import Opening, Wall


def subtract(a, b):
    return tuple(x - y for x, y in zip(a, b, strict=True))


def unit(vector):
    length = hypot(*vector)
    if length < 1e-9:
        raise ValueError("Zero-length exterior structural member")
    return tuple(value / length for value in vector)


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def tube(surface, points, radius, *, sides=8):
    """Capped tube with transported radial normals, including curved trellis ribs."""
    if len(points) < 2 or radius <= 0 or sides < 6:
        raise ValueError("Invalid exterior tube")
    rings, tangents, previous = [], [], None
    for index, point in enumerate(points):
        tangent = unit(subtract(points[min(index + 1, len(points) - 1)],
                                points[max(0, index - 1)]))
        reference = previous or ((1, 0, 0) if abs(tangent[1]) > 0.9 else (0, 1, 0))
        projection = sum(x * y for x, y in zip(reference, tangent, strict=True))
        normal = unit(tuple(x - projection * y for x, y in zip(reference, tangent, strict=True)))
        binormal = cross(tangent, normal)
        ring = []
        for side in range(sides):
            angle = side * 2 * pi / sides
            radial = tuple(cos(angle) * x + sin(angle) * y
                           for x, y in zip(normal, binormal, strict=True))
            vertex = tuple(x + radius * y for x, y in zip(point, radial, strict=True))
            ring.append((vertex, radial))
        rings.append(ring)
        tangents.append(tangent)
        previous = normal
    for first, second in zip(rings, rings[1:]):
        for side in range(sides):
            next_ = (side + 1) % sides
            a, b, c, d = first[side], first[next_], second[next_], second[side]
            for face in ((a, b, c), (a, c, d)):
                surface.triangle_with_normals(tuple(v for v, _ in face), tuple(n for _, n in face))
    for ring, point, tangent, start in (
        (rings[0], points[0], tangents[0], True),
        (rings[-1], points[-1], tangents[-1], False),
    ):
        normal = tuple(-axis for axis in tangent) if start else tangent
        for side in range(sides):
            a, b = ring[side][0], ring[(side + 1) % sides][0]
            surface.triangle((point, b, a) if start else (point, a, b), normal)


def leaf(surface, center, angle, size):
    dx, dz = cos(angle) * size, sin(angle) * size
    a = (center[0] - dx, center[1] - size * 0.5, center[2] - dz)
    b = (center[0] - dz * 0.36, center[1], center[2] + dx * 0.36)
    c = (center[0] + dx, center[1] + size * 0.5, center[2] + dz)
    d = (center[0] + dz * 0.36, center[1], center[2] - dx * 0.36)
    Wall.profiled_quad(surface, a, b, c, d)
    Wall.profiled_quad(surface, d, c, b, a)


def greenhouse(edge, surfaces, height, interior, solid):
    """N13: service bays, continuous upper louvres and the visible white trellis."""
    # The mapped N12 wall meets this corner; keep projecting members clear of it.
    left, right = 0.45, edge.length - 0.95
    service_top = height * 0.50
    openings = []
    for bay in range(3):
        a = left + (right - left) * (bay / 3 + 0.015)
        b = left + (right - left) * ((bay + 1) / 3 - 0.015)
        depth = edge.recess_depth(interior, a, b, 0.25)
        openings.append(Opening(a, b, 0.10, service_top, depth, "shadow" if bay == 2 else "service"))
        if bay != 2:
            for row in range(1, round(service_top / 0.11)):
                y = 0.10 + row * 0.11
                edge.panel(surfaces["metal"], a, b, y, y + 0.014, -depth + 0.016)
    edge.story(surfaces, "wall", 0, height, openings)
    solid(surfaces["trim"], edge.band(0.10, right + 0.08, -0.10, 0.25),
          height - 0.04, height + 0.10)
    solid(surfaces["trim"], edge.band(0.10, right + 0.08, 0.015, 0.53),
          service_top + 0.06, service_top + 0.23)
    lower, upper = height * 0.59, height * 0.92
    edge.panel(surfaces["shadow"], left, right, lower, upper, 0.035)
    for row in range(13):
        y = lower + (upper - lower) * row / 13
        solid(surfaces["screen"], edge.band(left, right, 0.055, 0.20), y, y + 0.082)
    bays = max(3, round((right - left) / 3.5))
    for bay in range(bays + 1):
        x = left + (right - left) * bay / bays
        solid(surfaces["trellis"], edge.band(x - 0.045, x + 0.045, 0.025, 0.24),
              service_top + 0.22, height + 0.10)
    # Model only the photographed roof-edge strip; do not fill unseen roof areas.
    rib_count = max(4, round((right - left) / 1.45))
    spacing = (right - left) / rib_count
    for rib in range(rib_count):
        center = left + spacing * (rib + 0.5)
        for direction in (-1, 1):
            points = []
            for step in range(17):
                t = step / 16
                x = center + direction * spacing * (t - 0.5) * 0.78
                y = height - 0.20 + 2.55 * sin(t * pi / 2)
                offset = -0.13 - 2.30 * (1 - cos(t * pi / 2))
                point = edge.point(x, y, offset)
                if not interior.covers(Point(point[0], -point[2])):
                    raise ValueError("N13 trellis leaves the mapped roof")
                points.append(point)
            tube(surfaces["trellis"], points, 0.033)
    for t in (0.30, 0.66, 0.94):
        y = height - 0.20 + 2.55 * sin(t * pi / 2)
        offset = -0.13 - 2.30 * (1 - cos(t * pi / 2))
        tube(surfaces["trellis"], [edge.point(left, y, offset), edge.point(right, y, offset)], 0.024)
    random = Random(1313)
    for strand in range(27):
        x = left + (right - left) * (strand + 0.5) / 27
        length = random.uniform(0.40, 1.18)
        for branch in range(3):
            points = [edge.point(x + sin(i * 0.45 + strand + branch) * 0.025 + (branch - 1) * 0.10,
                                 height + 0.04 - length * i / 11,
                                 0.25 + branch * 0.05) for i in range(12)]
            tube(surfaces["vine"], points, 0.009, sides=6)
            for point in points:
                shade = surfaces["vine-light"] if random.random() > 0.67 else surfaces["vine"]
                leaf(shade, point, random.uniform(0, 2 * pi), random.uniform(0.075, 0.14))


def tapered_fins(edge, surface, bottom, top):
    """N20's deep projecting fins have a sloping lower return in the atlas."""
    count = max(3, round(edge.length / 2.5))
    profile = ((bottom, 0.025), (bottom + 0.62, 1.04), (top, 1.04), (top, 0.025))
    for index in range(count):
        center = edge.length * (index + 0.5) / count
        a = [edge.point(center - 0.075, y, depth) for y, depth in profile]
        b = [edge.point(center + 0.075, y, depth) for y, depth in profile]
        Wall.profiled_quad(surface, *a)
        Wall.profiled_quad(surface, *b[::-1])
        for i in range(4):
            next_ = (i + 1) % 4
            Wall.profiled_quad(surface, a[i], b[i], b[next_], a[next_])


def canopy_space_frame(edge, surface, left, right, reach, head):
    """S14's photographed two-chord triangulated entrance soffit."""
    columns = max(3, round((right - left) / 1.7))
    rows = max(2, round(reach / 1.7))
    upper, lower = head + 0.035, head - 0.59
    for level in (upper, lower):
        for row in range(rows + 1):
            offset = 0.05 + (reach - 0.12) * row / rows
            tube(surface, [edge.point(left, level, offset), edge.point(right, level, offset)], 0.033)
        for column in range(columns + 1):
            along = left + (right - left) * column / columns
            tube(surface, [edge.point(along, level, 0.05), edge.point(along, level, reach - 0.07)], 0.033)
    for row in range(rows):
        for column in range(columns):
            x0, x1 = [left + (right - left) * i / columns for i in (column, column + 1)]
            z0, z1 = [0.05 + (reach - 0.12) * i / rows for i in (row, row + 1)]
            center = edge.point((x0 + x1) / 2, lower, (z0 + z1) / 2)
            for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1)):
                tube(surface, [center, edge.point(x, upper, z)], 0.026)


def library_stairs(edge, surfaces, door, storey, interior, solid):
    """An inset stair bay beside the glazed library entrance, within the footprint."""
    left, right = door.right + 0.35, min(edge.length - 0.4, door.right + 4.6)
    run = 7.8
    if right - left < 2.4 or not interior.covers(edge.band(left, right, -run, -0.01)):
        raise ValueError("N10 photographed stair bay does not fit the mapped footprint")
    steps = round(storey / 0.16)
    for step in range(steps):
        solid(surfaces["terrace"], edge.band(left, right, -run * (step + 1) / steps,
                                          -run * step / steps),
              0.035, storey * (step + 1) / steps)
    for along in (left + 0.10, right - 0.10):
        tube(surfaces["metal"], [edge.point(along, 0.98, -0.12),
                                  edge.point(along, storey + 0.98, -run)], 0.033)
        for step in range(0, steps + 1, 4):
            y, offset = storey * step / steps, -run * step / steps
            tube(surfaces["metal"], [edge.point(along, y + 0.03, offset),
                                      edge.point(along, y + 0.98, offset)], 0.021)
    for offset in (-0.35, -3.8, -7.4):
        for along in (left - 0.08, right + 0.08):
            solid(surfaces["trim"], edge.band(along - 0.11, along + 0.11, offset - 0.13, offset + 0.13),
                  0.05, storey * 2.92)
        solid(surfaces["trim"], edge.band(left - 0.19, right + 0.19, offset - 0.15, offset + 0.15),
              storey * 2.82, storey * 2.94)
    return left - 0.20, right + 0.20, run
