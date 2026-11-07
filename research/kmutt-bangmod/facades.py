"""Exterior facade studies on top of the verified building footprints."""

import itertools
from collections import defaultdict
from dataclasses import dataclass
from math import cos, hypot, pi, sin

from entries import ENTRIES, draw_entry, select_entry_wall
from exterior_features import greenhouse, library_stairs, tapered_fins
from geometry import Surface, extrude
from lx_exterior import PODIUM_FLOORS, draw_solar_arrays, tower_footprint
from roof_studies import S14_EAVE, roof_finish, s14_roof
from service_roofs import SLOPED_ROOFS, service_roof
from shapely import orient_polygons, union_all
from shapely.geometry import LineString, Point, Polygon
from wall import Opening, Wall


@dataclass(frozen=True)
class Facade:
    wall: str
    glass: str = "476268"
    trim: str = "e0dfd5"
    mode: str = "punched"
    bay: float = 3.4
    side: str | None = None
    accent: str = "d9642b"
    eave: float = 0


# Source photographs support the observed facade rhythm. Dimensions remain estimates.
OBSERVED = {
    "N1": Facade("d8d7cb", "4d6464", "e5e5db", "lobby", 4.5, "plain"),
    "N2": Facade("aeb1ac", "4b5a5c", "d4d5cd", "balcony", 4.2, "plain"),
    "N3": Facade("d6cdb7", "58625c", "e0d8c2", "fins", 3.75, "ribbon"),
    "N4": Facade("ded5ba", "57686a", "e9e2cd", "fins", 3.8, "ribbon"),
    "N5": Facade("e4dfcf", "525a55", "e8e4d7", "balcony", 3.6, "plain"),
    "N6": Facade("d0c6ac", "4c5a55", "e1d8c2", "balcony", 4.05, "punched"),
    "N7": Facade("d6d3c6", "414d4d", "e8e5d9", "balcony", 3.6, "punched"),
    "N8": Facade("dddcd3", "4a555a", "344957", "service", 4.2),
    "N9": Facade("e2e4de", "36696d", "dae2df", "fibo", 4.4),
    "N10": Facade("d5d7cc", "62918b", "e0e5db", "library", 3.5, "punched"),
    "N11": Facade("d2d5d3", "445e65", "ededdf", "lobby", 3.75, "punched"),
    "N12": Facade("e2e2d9", "405759", "ecece1", "shaft", 3.2, "ribbon", "a15342"),
    "N13": Facade("d9d9c4", "5e6357", "cbc6a7", "workshop", 3.8, "service"),
    "N14": Facade("e0dfd8", "566461", "52595a", "service", 4.1),
    "N15": Facade("dedfd3", "4c6861", "ebeade", "balcony", 3.5, "ribbon"),
    "N16": Facade("e2e5df", "476669", "f3f1e7", "lx", 4.4),
    "N17": Facade("e2dfd2", "586568", "e9e5d8", "ribbon", 3.7, "plain"),
    "N18": Facade("bcb9ac", "555e55", "cdc9bb", "workshop", 3.9, "plain"),
    "N19": Facade("ced1cf", "425259", "dce0da", "fins", 4.35, "ribbon"),
    "N20": Facade("d6d5c9", "4c6268", "dddcd1", "fins", 3.4, "punched"),
    "S1": Facade("b4b9b7", "4b656c", "cdd1ce", "ribbon", 3.1, "punched"),
    "S2-parking": Facade("dddcd5", "353e40", "e0e0d8", "garage", 4.4, "plain"),
    "S2-seminar": Facade("d7d4ca", "546164", "e4e0d6", "lobby", 4.2, "plain"),
    "S3": Facade("dce0df", "394e52", "d9dfde", "screen", 3.6, "punched"),
    "S4-3-floors": Facade(
        "aa655b", "52656a", "dccfc4", "engineering", 3.8, accent="a4514c"
    ),
    "S4-4-floors": Facade(
        "ad6d65", "506368", "e3d9d1", "engineering", 4.1, accent="ac5852"
    ),
    "S4-8-floors": Facade(
        "bcb3ad", "547175", "e0ded4", "engineering", 4.35, accent="a7524a"
    ),
    "S4-11-floors": Facade(
        "d1ccc2", "536669", "e4e1d7", "engineering", 4.05, accent="a4524c"
    ),
    "S5": Facade("b9998d", "4d6264", "e0d7ce", "residence", 3.35, "punched"),
    "S6": Facade("dcd9cf", "526972", "e6e4dc", "balcony", 3.2, "plain"),
    "S7": Facade("d8d6c8", "435963", "b35137", "lobby", 3.8, "plain", eave=0.48),
    "S8": Facade("d6d3c7", "586057", "e5e1d5", "workshop", 3.8, "plain"),
    "S9": Facade("deded4", "46645e", "e6e5dc", "balcony", 4.25, "plain"),
    "S10": Facade("aeb3ac", "4a5553", "d2d3cc", "workshop", 4.05, "plain"),
    "S11": Facade("deded4", "536d6e", "e9e8df", "ribbon", 4.3, "plain"),
    "S12": Facade("d7dcd9", "466370", "e5e5dc", "ribbon", 4.4, "plain"),
    "S13": Facade("d8d9cd", "526569", "e6e6df", "ribbon", 4.25, "plain"),
    "S14": Facade("d9ddd9", "4e666b", "e2e6df", "fins", 4.5, "ribbon", "b8c5ca"),
    "S15": Facade("9f5449", "445b62", "c5ab87", "hub", 4.2, "plain", "c1a47d"),
}
CONCRETE = "a6a79f"

WINDOWS = {
    # Margin, sill and head as fractions of a bay or storey.
    "punched": (0.23, 0.30, 0.76),
    "ribbon": (0.055, 0.32, 0.68),
    "balcony": (0.10, 0.25, 0.84),
    "residence": (0.12, 0.28, 0.72),
    "lx": (0.024, 0.19, 0.85),
    "library": (0.08, 0.12, 0.91),
    "garage": (0.06, 0.44, 0.63),
    "engineering": (0.075, 0.27, 0.77),
    "screen": (0.14, 0.32, 0.55),
    "fins": (0.06, 0.24, 0.82),
    "lobby": (0.10, 0.12, 0.88),
    "shaft": (0.075, 0.33, 0.70),
    "workshop": (0.12, 0.33, 0.73),
    "hub": (0.13, 0.18, 0.90),
}


def paint(glb, name, color, *, metallic=0, roughness=0.83):
    rgb = tuple(int(color[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return glb.material(name, rgb, metallic=metallic, roughness=roughness)


def append_surface(target, source):
    for i in range(0, len(source.indices), 3):
        indices = source.indices[i : i + 3]
        target.triangle(
            tuple(source.positions[j] for j in indices), source.normals[indices[0]]
        )


def solid(surface, polygon, bottom, top):
    for part in extrude(orient_polygons(polygon), bottom, top):
        append_surface(surface, part)


def draw_service(id_, edge, surfaces, height, front, interior):
    if not front:
        edge.panel(surfaces["wall"], 0, edge.length, 0, height)
        return
    openings = []
    center = edge.length / 2
    half = min(2.6, edge.length * 0.25)
    for left, right in (
        ((center - half, center + half),)
        if id_ == "N14"
        else ((center - half, center - 0.08), (center + 0.08, center + half))
    ):
        depth = edge.recess_depth(interior, left, right, 0.22)
        head = height * (0.77 if id_ == "N14" else 0.48)
        openings.append(Opening(left, right, 0.10, head, depth, "service"))
        for row in range(1, round(head / 0.10)):
            y = 0.10 + (head - 0.11) * row / round(head / 0.10)
            edge.panel(surfaces["metal"], left, right, y, y + 0.015, -depth + 0.012)
    if id_ == "N8":
        left, right = 0.27, edge.length - 0.27
        depth = edge.recess_depth(interior, left, right, 0.84)
        edge.story(surfaces, "wall", 0, height * 0.69, openings)
        edge.story(
            surfaces,
            "wall",
            height * 0.69,
            height,
            [Opening(left, right, height * 0.69, height - 0.04, depth, "shadow")],
        )
        draw_guard(edge, surfaces["railing"], height * 0.59, 0.035)
    else:
        edge.story(surfaces, "wall", 0, height, openings)
        for level in range(6):
            y = height * (0.39 + level * 0.052)
            for left, right in (
                (0.09, center - half - 0.09),
                (center + half + 0.09, edge.length - 0.09),
            ):
                louvre = edge.band(left, right, 0.004, 0.13)
                solid(surfaces["wall"], louvre, y, y + 0.095)


def draw_guard(edge, surface, base, offset):
    left, right = 0.16, edge.length - 0.16
    rail = edge.band(left, right, offset, offset + 0.052)
    for level in (0.48, 1.04):
        solid(surface, rail, base + level, base + level + 0.045)
    bays = max(1, round((right - left) / 1.8))
    for index in range(bays + 1):
        center = left + (right - left) * index / bays
        post = edge.band(center - 0.024, center + 0.024, offset, offset + 0.052)
        solid(surface, post, base + 0.015, base + 1.06)


def draw_louvres(
    edge, surface, left, right, bottom, top, spacing, projection, *, offset=0.025
):
    rows = max(1, round((top - bottom) / spacing))
    for row in range(rows):
        y = bottom + (top - bottom) * row / rows
        slat = edge.band(left, right, offset, projection)
        solid(surface, slat, y, y + min(0.09, spacing * 0.37))


def draw_sit_screen(edge, surfaces, opening, *, braced):
    """N11's visible upper entry elevation; unobserved elevations stay unchanged."""
    left, right, bottom, top = opening.left, opening.right, opening.bottom, opening.top
    back = -opening.depth + 0.055
    if braced:
        # The photographed X sits behind the horizontal screen, not on the glass.
        for start, end in (
            ((left, bottom), (right, top)), ((left, top), (right, bottom))
        ):
            dx, dy = end[0] - start[0], end[1] - start[1]
            length = hypot(dx, dy)
            nx, ny = -dy / length * 0.045, dx / length * 0.045
            points = [
                (start[0] + nx, start[1] + ny), (start[0] - nx, start[1] - ny),
                (end[0] - nx, end[1] - ny), (end[0] + nx, end[1] + ny),
            ]
            front = [edge.point(x, y, back + 0.065) for x, y in points]
            rear = [edge.point(x, y, back) for x, y in points]
            edge.profiled_quad(surfaces["metal"], *front)
            edge.profiled_quad(surfaces["metal"], *rear[::-1])
            for index in range(4):
                next_ = (index + 1) % 4
                edge.profiled_quad(
                    surfaces["metal"], rear[index], rear[next_], front[next_], front[index]
                )
    draw_louvres(
        edge, surfaces["metal"], left, right, bottom + 0.035, top - 0.025,
        0.16, back + 0.145, offset=back + 0.095,
    )


def draw_glazed_shaft(edge, surfaces, left, right, height, storey):
    """N12's photographed tall glazed bay. Dimensions are interpreted from photos."""
    bottom, top = 0.2, height - storey * 0.83
    edge.panel(surfaces["glass"], left, right, bottom, top, 0.022)
    columns = max(2, round((right - left) / 0.9))
    for column in range(columns + 1):
        x = left + (right - left) * column / columns
        edge.panel(surfaces["mullion"], x - 0.024, x + 0.024, bottom, top, 0.045)
    rows = max(1, round((top - bottom) / (storey * 0.5)))
    for row in range(rows + 1):
        y = bottom + (top - bottom) * row / rows
        edge.panel(surfaces["mullion"], left, right, y - 0.024, y + 0.024, 0.047)


def draw_hub_front(edge, surfaces, height, door, exterior_space, ground_clearance):
    for left, right in ((0.025, 0.31), (0.69, 0.975)):
        start, end = left * edge.length, right * edge.length
        bottom = height * 0.62
        backing = edge.band(start, end, 0.005, 0.18)
        solid(surfaces["timber"], backing, bottom, height - 0.18)
        fins = max(1, round((end - start) / 0.36))
        for i in range(fins):
            center = start + (end - start) * (i + 0.5) / fins
            fin = edge.band(center - 0.047, center + 0.047, 0.16, 0.42)
            solid(surfaces["timber"], fin, bottom - 0.035, height - 0.1)
    left, right = door.left - 0.28, door.right + 0.28
    head = height * 0.57
    if exterior_space.covers(edge.band(left, right, 0.005, 0.68)):
        lintel = edge.band(left, right, -0.015, 0.68)
        solid(surfaces["frame"], lintel, head - 0.19, head)
        for along in (left + 0.06, right - 0.06):
            jamb = edge.band(along - 0.06, along + 0.06, 0.005, 0.68)
            if ground_clearance.covers(jamb):
                solid(surfaces["frame"], jamb, 0.09, head - 0.18)
        for fraction in (0.33, 0.61):
            along = door.left + (door.right - door.left) * fraction
            pier = edge.band(along - 0.08, along + 0.08, -0.018, 0.22)
            if ground_clearance.covers(
                edge.band(along - 0.08, along + 0.08, 0.005, 0.22)
            ):
                solid(surfaces["hub-column"], pier, door.bottom, head - 0.18)
    center_left, center_right = edge.length * 0.314, edge.length * 0.686
    edge.panel(
        surfaces["trim"], center_left, center_right, height * 0.74, height, 0.022
    )
    draw_louvres(
        edge,
        surfaces["metal"],
        center_left,
        center_right,
        height * 0.74,
        height * 0.89,
        0.18,
        0.11,
    )


def draw_lx_terrace(edge, surfaces, clearance):
    """Model the broad stepped plaza edge visible in LX exterior photographs."""
    left, right = 0.55, edge.length - 0.55
    if not clearance.covers(edge.band(left, right, 0.002, 2.27)):
        raise ValueError("LX terrace conflicts with mapped campus geometry")
    for level in range(4):
        outer = 2.25 - 0.42 * level
        band = edge.band(left, right, -0.01, outer)
        solid(surfaces["terrace"], band, 0.16 * level, 0.16 * (level + 1))
        nosing = edge.band(left, right, outer - 0.065, outer + 0.012)
        solid(
            surfaces["trim"],
            nosing,
            0.16 * (level + 1) - 0.045,
            0.16 * (level + 1) + 0.006,
        )


def draw_leaning_support(edge, surface, along, height):
    bottom, top = 0.05, height
    outer, inner, radius = 1.85, 0.15, 0.53
    base_center = edge.point(along, bottom, outer)
    top_center = edge.point(along, top, inner)
    for i in range(12):
        a, b = (2 * pi * j / 12 for j in (i, i + 1))
        first = edge.point(along + radius * cos(a), bottom, outer + radius * sin(a))
        second = edge.point(along + radius * cos(b), bottom, outer + radius * sin(b))
        third = edge.point(along + radius * cos(b), top, inner + radius * sin(b))
        fourth = edge.point(along + radius * cos(a), top, inner + radius * sin(a))
        t = (a + b) / 2
        ny = (outer - inner) * sin(t) / (top - bottom)
        length = hypot(1, ny)
        normal = (
            (edge.dx * cos(t) + edge.normal[0] * sin(t)) / length,
            ny / length,
            (edge.dz * cos(t) + edge.normal[2] * sin(t)) / length,
        )
        surface.triangle((first, fourth, third), normal)
        surface.triangle((first, third, second), normal)
        surface.triangle((base_center, first, second), (0, -1, 0))
        surface.triangle((top_center, third, fourth), (0, 1, 0))


def draw_fibo_front(edge, surfaces, floors, storey):
    """The bowed glazed bay wraps only one part of the otherwise opaque frontage."""
    left, right = edge.length * 0.43, edge.length * 0.96
    divisions = 9

    def point(t, y, extra=0):
        return edge.point(
            left + (right - left) * t, y, 0.12 + 0.78 * sin(pi * t) + extra
        )

    def glazing(surface, t0, t1, low, high, offset):
        a, b = point(t0, low, offset), point(t1, low, offset)
        c, d = point(t1, high, offset), point(t0, high, offset)
        dx, dz = b[0] - a[0], b[2] - a[2]
        length = hypot(dx, dz)
        normal = (-dz / length, 0, dx / length)
        surface.triangle((a, b, c), normal)
        surface.triangle((a, c, d), normal)

    def rib(t0, t1, low, high, *, front=0.075):
        corners = [point(t, 0, depth) for t, depth in (
            (t0, 0.008), (t1, 0.008), (t1, front), (t0, front)
        )]
        solid(
            surfaces["mullion"], Polygon([(x, -z) for x, _, z in corners]), low, high
        )

    for index in range(divisions):
        t0, t1 = index / divisions, (index + 1) / divisions
        for y, vertical in ((storey, -1), (floors * storey, 1)):
            a = edge.point(left + (right - left) * t0, y, 0)
            b, c = point(t0, y), point(t1, y)
            d = edge.point(left + (right - left) * t1, y, 0)
            faces = ((a, b, c), (a, c, d))
            for face in faces:
                surfaces["metal"].triangle(
                    face if vertical > 0 else face[::-1], (0, vertical, 0)
                )
    for t, normal in ((0, (-edge.dx, 0, -edge.dz)), (1, (edge.dx, 0, edge.dz))):
        a = edge.point(left + (right - left) * t, storey, 0)
        b = point(t, storey)
        c = point(t, floors * storey)
        d = edge.point(left + (right - left) * t, floors * storey, 0)
        for face in ((a, b, c), (a, c, d)):
            surfaces["metal"].triangle(face if t == 0 else face[::-1], normal)

    edge.panel(
        surfaces["glass"],
        edge.length * 0.17,
        edge.length * 0.22,
        storey * 0.75,
        storey * (floors - 0.2),
        0.066,
    )
    edge.panel(
        surfaces["metal"],
        edge.length * 0.30,
        edge.length * 0.42,
        storey,
        storey * (floors - 0.36),
        0.08,
    )
    for floor in range(1, floors):
        base = storey * floor
        # The reference shows a vent stack beside the bowed curtain wall.
        if floor < floors - 1:
            vent_left, vent_right = edge.length * 0.315, edge.length * 0.405
            low, high = base + storey * 0.21, base + storey * 0.83
            edge.panel(surfaces["shadow"], vent_left, vent_right, low, high, 0.086)
            draw_louvres(edge, surfaces["metal"], vent_left, vent_right, low, high,
                         0.18, 0.16, offset=0.095)
            for x in (vent_left, (vent_left + vent_right) / 2, vent_right):
                edge.bar(surfaces["mullion"], x - 0.018, x + 0.018, low, high, 0.086, 0.17)
        # Floor-edge metal continues across the opaque part and the glazed bow.
        fascia_y = base + storey * 0.96
        solid(surfaces["metal"], edge.band(edge.length * 0.14, left, 0.082, 0.18),
              fascia_y, base + storey)
        for index in range(divisions):
            a, b = index / divisions, (index + 1) / divisions
            glazing(surfaces["spandrel"], a, b, base, base + storey * 0.36, 0)
            glazing(
                surfaces["glass"], a, b, base + storey * 0.36, base + storey * 0.96, 0
            )
            rib(a, b, base + storey * 0.96, base + storey, front=0.095)
            rib(a, a + 0.0028, base, base + storey)
        rib(1 - 0.0028, 1, base, base + storey)
        slot_left, slot_right = edge.length * 0.17, edge.length * 0.22
        edge.bar(surfaces["mullion"], slot_left, slot_right,
                 base - 0.025, base + 0.025, 0.068, 0.10)
    for fraction in (0.61, 0.86):
        draw_leaning_support(
            edge, surfaces["accent"], edge.length * fraction, storey * 1.27
        )


def fibo_front_edge(polygon, frontage):
    east, north = frontage.x - polygon.centroid.x, frontage.y - polygon.centroid.y
    return max(
        (
            segment
            for segment in itertools.pairwise(polygon.exterior.coords)
            if Wall(*segment).length >= 11
        ),
        key=lambda segment: (
            Wall(*segment).normal[0] * east - Wall(*segment).normal[2] * north
        ),
    )


def facade_mesh(
    glb,
    id_,
    props,
    footprint,
    frontage,
    *,
    entry_target,
    exterior_space,
    ground_clearance,
    round_wings=(),
    upper_wing=None,
    podium_floors=3,
):
    height = props["heightM"]
    profile = OBSERVED[id_]
    mode = profile.mode
    floor_count = props["floorCount"] or max(1, round(height / 3.75))
    storey = height / floor_count
    entry = ENTRIES.get(id_)
    entry_wall = None
    if entry is not None:
        entry_wall = select_entry_wall(
            footprint, entry_target, mapped_approach=entry.target is None
        )
    surfaces = defaultdict(Surface)
    base_floors = podium_floors if upper_wing is not None else floor_count
    if not 0 < base_floors <= floor_count:
        raise ValueError(f"{id_}: Invalid lower-wing level count")
    tower = None
    if mode == "lx":
        if floor_count <= PODIUM_FLOORS:
            raise ValueError("LX floor count must include the tower above the podium")
        tower = tower_footprint(footprint)
        base_floors = PODIUM_FLOORS
    base_height = base_floors * storey
    if id_ == "S14":
        base_height = S14_EAVE
        storey = base_height / floor_count
    service_front = None
    if id_ in SLOPED_ROOFS:
        service_front = select_entry_wall(footprint, frontage, mapped_approach=False)
        service_edge = Wall(*service_front)
        roof_profile, rise, overhang = SLOPED_ROOFS[id_]
        across = (
            (service_edge.dx, -service_edge.dz)
            if roof_profile == "gable"
            else (service_edge.normal[0], -service_edge.normal[2])
        )
        eave = height - rise
        base_height = eave - 0.13
    roof, wall = extrude(footprint, 0, base_height, sides=False)
    if service_front is not None:
        roof_outline = orient_polygons(
            footprint.union(
                footprint.buffer(overhang, join_style="mitre").intersection(
                    exterior_space
                )
            )
        )
        if roof_outline.geom_type != "Polygon" or not roof_outline.is_valid:
            raise ValueError(f"{id_}: Invalid roof outline after clearance clipping")
        roof, underside, gable = service_roof(
            footprint, roof_outline, height, eave, roof_profile, across
        )
        append_surface(wall, gable)
    if tower is not None:
        roof, _ = extrude(
            orient_polygons(footprint.difference(tower)), 0, base_height, sides=False
        )
        upper_roof, _ = extrude(tower, base_height, height, sides=False)
        append_surface(roof, upper_roof)
    surfaces["roof"], surfaces["wall"] = roof, wall
    if id_ == "S14":
        roof, gables = s14_roof(footprint)
        surfaces["roof"] = roof
        append_surface(wall, gables)
    if service_front is not None:
        surfaces["roof-metal"] = underside
    if upper_wing is not None:
        podium_roof = footprint.difference(
            union_all([upper_wing, *(wing for wing, _ in round_wings)])
        )
        roof, _ = extrude(orient_polygons(podium_roof), 0, base_height, sides=False)
        surfaces["roof"] = roof
        upper_roof, _ = extrude(upper_wing, base_height, height, sides=False)
        append_surface(roof, upper_roof)
    for round_wing, height_fraction in round_wings:
        crown = height * height_fraction
        upper_roof, upper_wall = extrude(round_wing, base_height - 0.02, crown)
        append_surface(roof, upper_roof)
        append_surface(wall, upper_wall)
        shell = round_wing.buffer(0.14).difference(round_wing.buffer(-0.09))
        solid(surfaces["trim"], shell, crown - 0.23, crown + 0.02)
    buildings = (
        footprint.geoms if footprint.geom_type == "MultiPolygon" else [footprint]
    )

    volumes = [(polygon, 0, base_floors) for polygon in buildings]
    if upper_wing is not None:
        volumes.append((upper_wing, base_floors, floor_count))
    if tower is not None:
        volumes.append((tower, base_floors, floor_count))
        draw_solar_arrays(tower, height, surfaces, solid)

    for polygon, first_floor, last_floor in volumes:
        volume_bottom, volume_top = first_floor * storey, last_floor * storey
        if service_front is not None or id_ == "S14":
            volume_top = base_height
        building_center = polygon.centroid
        interior = polygon.buffer(0.002)
        exterior = list(itertools.pairwise(polygon.exterior.coords))
        longest_wall = max(hypot(b[0] - a[0], b[1] - a[1]) for a, b in exterior)
        screen_edge = None
        if mode == "screen":
            candidates = [
                LineString(segment)
                for segment in itertools.pairwise(polygon.exterior.coords)
            ]
            screen_edge = min(
                candidates, key=lambda edge: (edge.distance(frontage), -edge.length)
            )
        fibo_front = None
        if mode == "fibo":
            fibo_front = fibo_front_edge(polygon, frontage)
        greenhouse_front = (
            select_entry_wall(polygon, frontage, mapped_approach=False)
            if id_ == "N13" else None
        )
        if mode == "lx":
            fascia = polygon.buffer(0.96, join_style="mitre").difference(
                polygon.buffer(-0.09, join_style="mitre")
            )
            for floor in range(first_floor + 1, last_floor + 1):
                y = floor * storey
                solid(surfaces["trim"], fascia, y - 0.48, y + 0.02)
        elif profile.eave:
            fascia = polygon.buffer(profile.eave, join_style="mitre").difference(
                polygon.buffer(-0.04, join_style="mitre")
            )
            solid(surfaces["trim"], fascia, height - 0.25, height + 0.04)
        for ring_index, ring in enumerate((polygon.exterior, *polygon.interiors)):
            coordinates = list(ring.coords)
            for start, end in itertools.pairwise(coordinates):
                edge = Wall(start, end)
                if edge.length < 0.35:
                    edge.panel(
                        surfaces["wall"], 0, edge.length, volume_bottom, volume_top
                    )
                    continue
                if first_floor == 0:
                    edge.panel(surfaces["base"], 0, edge.length, 0.035, 0.12, 0.027)
                if edge.length < 2.15:
                    edge.panel(
                        surfaces["wall"], 0, edge.length, volume_bottom, volume_top
                    )
                    continue
                front = ring_index == 0 and edge.length >= longest_wall * 0.46
                if frontage is not None:
                    east, north = (
                        frontage.x - building_center.x,
                        frontage.y - building_center.y,
                    )
                    facing = edge.normal[0] * east - edge.normal[2] * north
                    front = ring_index == 0 and facing > 0.35 * hypot(east, north)
                wall_mode = mode if front else profile.side or mode
                primary_entry = (
                    first_floor == 0 and ring_index == 0 and (start, end) == entry_wall
                )
                if (start, end) == greenhouse_front:
                    greenhouse(edge, surfaces, height, interior, solid)
                    continue
                door = None
                library_bay = None
                if primary_entry:
                    door = draw_entry(
                        edge,
                        entry,
                        storey,
                        interior,
                        exterior_space,
                        ground_clearance,
                        surfaces,
                        solid,
                    )
                    if mode == "hub":
                        wall_mode = mode
                    if id_ == "N10":
                        library_bay = library_stairs(
                            edge, surfaces, door, storey, interior, solid
                        )
                if mode == "fibo":
                    if (start, end) == fibo_front:
                        edge.panel(surfaces["wall"], 0, edge.length, 0, base_height)
                        draw_fibo_front(edge, surfaces, floor_count, storey)
                        continue
                    wall_mode = "ribbon" if edge.length >= 29 else "plain"
                if wall_mode == "plain":
                    if door is None:
                        edge.panel(
                            surfaces["wall"], 0, edge.length, volume_bottom, volume_top
                        )
                    else:
                        edge.story(surfaces, "wall", volume_bottom, storey, [door])
                        edge.panel(surfaces["wall"], 0, edge.length, storey, volume_top)
                    continue
                if service_front is not None or wall_mode == "service":
                    draw_service(
                        id_,
                        edge,
                        surfaces,
                        base_height,
                        (start, end) == service_front,
                        interior,
                    )
                    continue
                terrace = (
                    mode == "lx"
                    and first_floor == 0
                    and front
                    and edge.length >= 12
                    and edge.normal[2] > 0.7
                    and max(start[1], end[1]) < 35
                )
                if terrace:
                    draw_lx_terrace(edge, surfaces, ground_clearance)
                bays = max(1, round(edge.length / profile.bay))
                bay = edge.length / bays
                for floor in range(first_floor, last_floor):
                    base = floor * storey
                    story_mode = wall_mode
                    if floor > 0 and wall_mode == "lobby":
                        story_mode = "ribbon"
                    if floor == 0 and front and mode == "lx":
                        story_mode = "lobby"
                    margin, sill, head = WINDOWS[story_mode]
                    if terrace and floor == 0:
                        sill = 0.21
                    role = (
                        "accent"
                        if mode == "engineering" and (height < 18 or floor < 2)
                        else "wall"
                    )
                    if wall_mode == "shaft" and floor in (
                        floor_count - 2,
                        floor_count - 1,
                    ):
                        edge.panel(
                            surfaces["accent"],
                            0.12,
                            edge.length - 0.12,
                            base + 0.09,
                            base + storey * 0.18,
                            0.08,
                        )
                    if wall_mode in {
                        "ribbon",
                        "balcony",
                        "engineering",
                        "residence",
                        "garage",
                        "shaft",
                    }:
                        y = base + storey * 0.88
                        slab = edge.band(0.045, edge.length - 0.045, 0.005, 0.28)
                        solid(surfaces["trim"], slab, y, y + min(0.24, storey * 0.1))
                    if wall_mode == "balcony" and floor > 0:
                        deck = edge.band(0.16, edge.length - 0.16, -0.03, 0.62)
                        solid(surfaces["trim"], deck, base + 0.03, base + 0.22)
                        draw_guard(edge, surfaces["railing"], base + 0.20, 0.54)
                    if mode == "lx" and front and edge.length >= 8 and 1 <= floor <= 5:
                        draw_guard(edge, surfaces["railing"], base + 0.015, 0.77)
                    if polygon is tower and edge.normal[0] < -0.85 and edge.length > 12:
                        # Solid west service shaft with warm bars in the campus photos.
                        edge.story(surfaces, "wall", base, base + storey, [])
                        edge.panel(
                            surfaces["accent"],
                            edge.length * 0.24,
                            edge.length * 0.63,
                            base + storey * 0.67,
                            base + storey * 0.74,
                            0.055,
                        )
                        continue
                    openings = []
                    for col in range(bays):
                        if wall_mode == "shaft" and bays >= 3 and col == bays - 1:
                            continue
                        if (
                            wall_mode == "hub"
                            and bays >= 4
                            and abs(col - (bays - 1) / 2) > bays * 0.25
                        ):
                            continue
                        x = col * bay
                        inset = bay * margin
                        low, high = base + storey * sill, base + storey * head
                        left, right = x + inset, x + bay - inset
                        if library_bay is not None and floor < 3:
                            if right > door.left and left < library_bay[1]:
                                continue
                        if (
                            id_ == "N11" and primary_entry and floor == 1
                            and right > edge.length * 0.66 and left < edge.length * 0.86
                        ):
                            # Camera 16 shows a solid name-sign panel beside the tall entry.
                            continue
                        if (
                            floor == 0
                            and door is not None
                            and right > door.left
                            and left < door.right
                        ):
                            continue
                        setback = (
                            0.48
                            if story_mode in {"lobby", "balcony"}
                            else 0.32
                            if story_mode in {"garage", "lx", "library"}
                            else 0.21
                        )
                        depth = edge.recess_depth(interior, left, right, setback)
                        sit_screen = (
                            id_ == "N11" and primary_entry and floor >= floor_count - 2
                        )
                        finish = (
                            "shadow" if sit_screen else "frame"
                            if wall_mode == "garage" else "glass"
                        )
                        opening = Opening(left, right, low, high, depth, finish)
                        openings.append(opening)
                        if sit_screen:
                            draw_sit_screen(
                                edge, surfaces, opening,
                                braced=floor == floor_count - 1
                                and col < max(1, bays // 3),
                            )
                        if wall_mode == "garage":
                            draw_louvres(
                                edge,
                                surfaces["metal"],
                                left,
                                right,
                                low + 0.05,
                                high - 0.04,
                                0.16,
                                0.07,
                            )
                    if library_bay is not None and floor < 3:
                        low = max(door.bottom, base + 0.035)
                        high = base + storey - 0.035
                        openings.append(Opening(door.left, door.right, low, high, 0.18,
                                                "door" if floor == 0 else "glass"))
                        stair_left, stair_right, stair_depth = library_bay
                        openings.append(Opening(stair_left, stair_right, base + 0.035,
                                                high, stair_depth, "shadow"))
                        # Pale glazed spandrels in the photographed entrance box.
                        if floor in (1, 2):
                            band_low = base + (storey * 0.27 if floor == 1 else storey * 0.70)
                            band_top = base + (storey * 0.62 if floor == 1 else storey - 0.04)
                            edge.panel(surfaces["library-panel"], door.left, door.right,
                                       band_low, band_top, 0.030)
                        openings.sort(key=lambda item: item.left)
                    elif floor == 0 and door is not None:
                        openings.append(door)
                        openings.sort(key=lambda item: item.left)
                    edge.story(surfaces, role, base, base + storey, openings)
                if mode == "lx" and first_floor == 0 and front and edge.length >= 6:
                    count = max(1, round(edge.length / 8))
                    for i in range(count):
                        mid = (i + 0.5) * edge.length / count
                        east, _, south = edge.point(mid, 0, 0.69)
                        column = Point(east, -south).buffer(0.54, quad_segs=16)
                        solid(surfaces["accent"], column, 0.04, storey * 1.92)
                if wall_mode == "shaft" and bays >= 3 and id_ != "N12":
                    left, right = edge.length - bay * 0.94, edge.length - bay * 0.12
                    edge.panel(
                        surfaces["glass"],
                        left,
                        right,
                        storey * 0.46,
                        height - 0.25,
                        0.104,
                    )
                    for floor in range(1, floor_count):
                        y = storey * floor
                        edge.panel(
                            surfaces["mullion"],
                            left,
                            right,
                            y - 0.045,
                            y + 0.045,
                            0.126,
                        )
                if primary_entry and mode == "hub":
                    draw_hub_front(
                        edge, surfaces, height, door, exterior_space, ground_clearance
                    )
                if id_ == "N12" and front and bays >= 3:
                    draw_glazed_shaft(
                        edge, surfaces, (bays - 1) * bay + 0.03,
                        edge.length - 0.03, height, storey,
                    )
                if id_ == "N20" and primary_entry:
                    tapered_fins(edge, surfaces["trim"], volume_top - storey * 2,
                                 volume_top - 0.25)
                elif wall_mode == "fins" and edge.length >= 7:
                    count = max(1, round(edge.length / 1.75))
                    for i in range(count):
                        mid = (i + 0.5) * edge.length / count
                        fin = edge.band(mid - 0.10, mid + 0.10, 0.02, 0.49)
                        bottom = volume_top - storey * (1 if id_ in {"N3", "N4"} else 2)
                        solid(
                            surfaces["trim"],
                            fin,
                            bottom,
                            volume_top - 0.25,
                        )
                if id_ == "N13" and front and edge.length >= 10:
                    draw_louvres(
                        edge,
                        surfaces["screen"],
                        0.6,
                        edge.length - 0.6,
                        height * 0.61,
                        height * 0.84,
                        0.24,
                        0.17,
                    )
                if id_ == "S10" and primary_entry:
                    draw_louvres(
                        edge,
                        surfaces["frame"],
                        0.30,
                        edge.length - 0.30,
                        height * 0.76,
                        height - 0.12,
                        0.17,
                        0.20,
                    )
                if (
                    screen_edge is not None
                    and ring_index == 0
                    and screen_edge.equals(LineString([start, end]))
                ):
                    left, right = edge.length * 0.12, edge.length * 0.64
                    bottom, top = storey * 2.05, min(storey * 5, height - 0.6)
                    back = edge.band(left, right, 0.08, 0.20)
                    solid(surfaces["frame"], back, bottom, top)
                    louvre = edge.band(left, right, 0.20, 0.45)
                    for row in range(int((top - bottom) / 0.28)):
                        y = bottom + row * 0.28
                        solid(surfaces["screen"], louvre, y, y + 0.10)
        if polygon.area < 120 or profile.eave or service_front is not None or id_ in {"S14", "N13"}:
            continue
        inset = polygon.buffer(-0.42, join_style="mitre")
        if not inset.is_empty:
            solid(
                surfaces["trim"],
                polygon.difference(inset),
                volume_top,
                volume_top + min(0.74, storey * 0.19),
            )
    palette = {
        "roof": ("Sheet metal roof", "596467")
        if service_front is not None
        else ("Roof membrane", roof_finish(id_)),
        "wall": ("Facade", profile.wall),
        "base": ("Foundation", CONCRETE),
        "trim": ("Slab and coping", profile.trim),
        "reveal": ("Opening reveal", profile.wall),
        "frame": ("Window frame", "353d3d"),
        "glass": ("Glazing", profile.glass),
        "mullion": ("Aluminium mullion", "939d9a"),
        "metal": ("Satin aluminium", "a8b0a9"),
        "spandrel": ("Glazed spandrel", "243f43"),
        "accent": ("Facade accent", profile.accent),
        "screen": ("Exterior louvres", "c1ac79"),
        "service": ("Service shutter", "777e79"),
        "railing": ("Powder-coated railing", "dddcd1"),
        "terrace": ("Stone terrace", "b3a895"),
        "solar": ("Photovoltaic glass", "203447"),
        "portal": ("Entrance canopy and posts", profile.trim),
        "door-frame": ("Entrance door frame", "363f40"),
        "roof-metal": ("Roof soffit", "3d484b"),
        "shadow": ("Recess interior", "2b3739"),
        "timber": ("Timber-coloured cladding", "a98c72"),
        "hub-column": ("Ochre entrance pier", "d9a137"),
        "trellis": ("Painted exterior steel", "e1e4dc"),
        "vine": ("Climbing planting", "4f7044"),
        "vine-light": ("Climbing planting highlights", "6b8950"),
        "library-panel": ("Library glazed spandrel", "9cbcb0"),
    }
    primitives = []
    finishes = {
        "glass": (0.0, 0.19),
        "spandrel": (0.10, 0.29),
        "frame": (0.24, 0.39),
        "mullion": (0.42, 0.34),
        "metal": (0.72, 0.31),
        "railing": (0.16, 0.43),
        "solar": (0.20, 0.31),
        "door-frame": (0.35, 0.43),
        "trellis": (0.10, 0.53),
        "vine": (0.0, 0.87),
        "library-panel": (0.0, 0.38),
    }
    for role, surface in surfaces.items():
        label, color = palette[role]
        metallic, roughness = finishes.get(role, (0, 0.78))
        material = paint(
            glb,
            f"{label} #{color}",
            color,
            metallic=metallic,
            roughness=roughness,
        )
        primitives.append(glb.primitive(
            surface, material,
            derive_flat_normals=role == "reveal" and glb.compact_positions,
        ))
    return primitives
