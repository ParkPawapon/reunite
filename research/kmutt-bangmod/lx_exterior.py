"""LX podium, tower and fixed rooftop arrays interpreted from published views."""

from math import cos, radians, sin, tan

from shapely import orient_polygons
from shapely.geometry import Polygon, box

PODIUM_FLOORS = 6
SOLAR_STUDY = (
    "https://directivepublications.org/journal-of-environmental-and-sciences/"
    "analysis-of-solar-power-generation-system-for-green-building-prototype-"
    "in-king-mongkuts-university-of-technology-thonburi"
)


def tower_footprint(footprint):
    # Local UTM metres. The pond and campus photos establish the visible setback
    # and chamfered silhouette. The offsets are estimates, without a survey.
    outline = Polygon([(5, 54), (46, 56.4), (52, 58), (62, 74), (61, 78), (5, 76)])
    tower = orient_polygons(outline.buffer(-1.2).buffer(1.2, quad_segs=4))
    if not footprint.covers(tower):
        raise ValueError("LX tower leaves the mapped podium footprint")
    return tower


def draw_solar_arrays(tower, height, surfaces, solid):
    """Build raised rows with tilted modules, frames and roof-mounted supports."""
    angle = radians(15)
    normal = (0, cos(angle), sin(angle))
    width, depth, gap = 1.66, 1.88, 0.045
    # Figure 2 establishes the parallel rows. Counts, tilt and offsets are illustrative.
    clear_roof = tower.buffer(-0.8)
    for row, count in enumerate((13, 17, 18, 18, 16)):
        east = 12.9 + 0.7 * (row % 2)
        north = 56.7 + row * 3.35
        end = east + count * (width + gap) - gap
        if not clear_roof.covers(box(east, north, end, north + depth)):
            raise ValueError("LX solar array overlaps the roof perimeter")

        def face(surface, left, right, south, north_edge, offset, *, row_north=north):
            def point(x, n):
                return x, height + 0.25 + (n - row_north) * tan(angle) + offset, -n

            a, b = point(left, south), point(right, south)
            c, d = point(right, north_edge), point(left, north_edge)
            surface.triangle((a, b, c), normal)
            surface.triangle((a, c, d), normal)

        for i in range(count):
            left = east + i * (width + gap)
            right = left + width
            face(surfaces["metal"], left, right, north, north + depth, 0)
            face(
                surfaces["solar"],
                left + 0.035,
                right - 0.035,
                north + 0.035,
                north + depth - 0.035,
                0.009,
            )
            if i % 3 == 0:
                for offset in (0.20, depth - 0.20):
                    support = box(
                        left + 0.10, north + offset, left + 0.22, north + offset + 0.10
                    )
                    solid(
                        surfaces["metal"],
                        support,
                        height,
                        height + 0.25 + (offset + 0.1) * tan(angle),
                    )
