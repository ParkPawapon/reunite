"""Visible entrance details from the KMUTT atlas and campus panoramas."""

from dataclasses import dataclass

from shapely.geometry import LineString, Point
from wall import Opening, Wall


@dataclass(frozen=True)
class Entry:
    target: str | None
    width: float
    projection: float
    depth: float = 0.5
    rise: float = 0.0
    posts: bool = False
    finish: str = "trim"
    position: float = 0.5
    round_posts: bool = False
    canopy_levels: int = 1


# Width, canopy projection, setback and rise are photo-informed estimates in metres.
# Targets orient a visible facade in the open map. They are independent of route pins.
ENTRIES = {
    "N1": Entry("N2", 4.0, 1.05, 0.65),
    "N2": Entry("emerald-pond", 8.4, 0.4, 1.40, position=0.63),
    "N4": Entry("N2", 8.5, 0.4, 0.65, 0.80),
    "N5": Entry("N6", 4.7, 1.30, 0.70, 0.28, True),
    "N6": Entry("N7", 4.4, 1.75, 0.95, 0.15, True),
    "N7": Entry(None, 6.2, 1.45, 0.90, 0.32, True),
    "N10": Entry("N16", 8.8, 0.35, 0.65, 0.48),
    "N11": Entry("N16", 11.2, 3.60, 0.75, 0.30, True, "metal", round_posts=True, canopy_levels=2),
    "N15": Entry("N16", 10.6, 1.75, 1.40, 0.18, True, "metal", round_posts=True),
    "N17": Entry("N19", 5.3, 1.35, 0.75, 0.24),
    "N19": Entry("learning-garden", 7.8, 1.35, 0.58),
    "N20": Entry("N19", 6.8, 1.10, 0.75, 0.76),
    "S1": Entry("learning-garden", 6.2, 1.65, 0.76, 0.30, True, "frame"),
    "S2-seminar": Entry("S1", 12.4, 3.00, 1.15, 0.35, True),
    "S3": Entry(None, 3.8, 0.85, 0.62, 0.80),
    "S4-11-floors": Entry("learning-garden", 13.0, 1.10, 1.15, 1.0, True),
    "S4-3-floors": Entry("S4-11-floors", 6.8, 0.75, 0.80, 0.40),
    "S4-4-floors": Entry("S4-11-floors", 8.0, 0.75, 0.80, 0.40),
    "S5": Entry("S6", 5.3, 1.20, 0.70, 0.30, True),
    "S7": Entry("S5", 6.8, 2.00, 0.60, 0.45, True, "accent"),
    "S9": Entry("S5", 7.1, 0.9, 1.05, 0.30),
    "S10": Entry("learning-garden", 6.7, 0.35, 0.45, finish="frame"),
    "S14": Entry("sports-field", 16.0, 2.30, 1.30, 0.92, True),
    "S15": Entry("learning-garden", 21.0, 1.50, 1.10, 0.62, True, "frame"),
}


def select_entry_wall(footprint, target, *, mapped_approach):
    polygons = footprint.geoms if footprint.geom_type == "MultiPolygon" else [footprint]
    walls = []
    for polygon in polygons:
        for start, end in zip(
            polygon.exterior.coords, list(polygon.exterior.coords)[1:]
        ):
            edge = Wall(start, end)
            if edge.length < 3.2:
                continue
            east, _, south = edge.point(edge.length / 2, 0, 0)
            facing = edge.normal[0] * (target.x - east) - edge.normal[2] * (
                target.y + south
            )
            if facing > 0:
                distance = LineString([start, end]).distance(target)
                if not mapped_approach:
                    distance += max(0, 13 - edge.length) * 1.5
                walls.append((distance, start, end))
    if not walls:
        raise ValueError("No exterior facade faces the entrance reference")
    _, start, end = min(walls)
    return start, end


def draw_entry(edge, entry, storey, interior, clear, ground, surfaces, solid):
    width = min(edge.length * 0.78, entry.width)
    margin = max(0.18, (edge.length - width) * 0.09)
    left = min(
        edge.length - width - margin,
        max(margin, entry.position * edge.length - width / 2),
    )
    right = left + width
    porch_left, porch_right = left - 0.12, right + 0.12
    head = min(storey - 0.28, 3.6)
    canopy_head = storey * entry.canopy_levels - 0.28
    rise = min(entry.rise, head - 1.95)
    depth = edge.recess_depth(interior, left, right, entry.depth)
    reach = next(
        (
            reach
            for reach in (entry.projection, entry.projection * 0.6, 0.13)
            if clear.covers(edge.band(porch_left, porch_right, 0.005, reach))
        ),
        0,
    )
    if reach:
        solid(
            surfaces["portal"],
            edge.band(porch_left, porch_right, -0.03, reach),
            canopy_head + 0.06,
            canopy_head + 0.26,
        )
        if entry.finish != "trim":
            edge.panel(
                surfaces[entry.finish],
                porch_left,
                porch_right,
                canopy_head + 0.08,
                canopy_head + 0.23,
                reach + 0.002,
            )
    tread = min(0.39, max(0.25, width * 0.043))
    steps = round(rise / 0.17)
    if steps and ground.covers(edge.band(left, right, 0.005, steps * tread + 0.02)):
        for level in range(steps):
            step_end = (steps - level) * tread
            solid(
                surfaces["terrace"],
                edge.band(left, right, -0.01, step_end),
                rise * level / steps,
                rise * (level + 1) / steps,
            )
    else:
        rise = 0
    if entry.posts and reach >= 0.8:
        for along in (porch_left + 0.25, porch_right - 0.25):
            if entry.round_posts:
                east, _, south = edge.point(along, 0, reach - 0.31)
                post = Point(east, -south).buffer(0.24, quad_segs=12)
            else:
                post = edge.band(along - 0.13, along + 0.13, reach - 0.34, reach - 0.08)
            if ground.covers(post):
                solid(surfaces["metal" if entry.round_posts else "portal"], post, 0.025, canopy_head + 0.08)
    return Opening(left, right, max(0.06, rise), head, depth, "door")
