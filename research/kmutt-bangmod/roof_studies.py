"""Roof finishes and the photographed barrel vault of the S14 memorial gym."""

from math import sqrt

from geometry import Surface, extrude
from service_roofs import face_normal
from shapely import constrained_delaunay_triangles, orient_polygons
from shapely.geometry import Point, box

TOUR = "https://www.kmutt.ac.th/virtual/bangmod/"
# Colours describe photographed surfaces, not a product colour palette.
GREEN_MEMBRANES = {"N3", "N4", "N5", "N6", "S4-3-floors", "S4-4-floors", "S13"}
S14_MAIN = box(-251.0, -94.0, -203.5, -33.5)
S14_CENTER = -227.25
S14_HALF_SPAN = 23.75
S14_EAVE = 9.1
S14_RISE = 3.9


def roof_finish(id_):
    if id_ == "S14":
        return "b5c9b4"
    return "819b74" if id_ in GREEN_MEMBRANES else "858e8b"


def s14_height(east):
    radius = (S14_HALF_SPAN ** 2 + S14_RISE ** 2) / (2 * S14_RISE)
    return S14_EAVE + sqrt(radius ** 2 - (east - S14_CENTER) ** 2) - (radius - S14_RISE)


def s14_roof(footprint):
    if not footprint.covers(S14_MAIN):
        raise ValueError("S14 barrel roof leaves the reviewed footprint")
    roof, _ = extrude(orient_polygons(footprint.difference(S14_MAIN)), 0, S14_EAVE, sides=False)
    gables = Surface()
    for column in range(32):
        step = 2 * S14_HALF_SPAN / 32
        left = S14_MAIN.bounds[0] + column * step
        right = left + step
        strip = box(left, S14_MAIN.bounds[1], right, S14_MAIN.bounds[3])
        for triangle in orient_polygons(constrained_delaunay_triangles(strip)).geoms:
            top = tuple((e, s14_height(e), -n) for e, n in list(triangle.exterior.coords)[:3])
            roof.triangle(top, face_normal(*top))
        for north, sign in ((S14_MAIN.bounds[1], 1), (S14_MAIN.bounds[3], -1)):
            a, b = (left, S14_EAVE, -north), (right, S14_EAVE, -north)
            c, d = (right, s14_height(right), -north), (left, s14_height(left), -north)
            # At the springing ends one triangle collapses; omit zero-area faces.
            if c[1] > S14_EAVE + 1e-6:
                gables.triangle((a, b, c) if sign == 1 else (a, c, b), (0, 0, sign))
            if d[1] > S14_EAVE + 1e-6:
                gables.triangle((a, c, d) if sign == 1 else (a, d, c), (0, 0, sign))
    return roof, gables


def s14_lettering(sign):
    """Conform the photographed KMUTT roof lettering to the curved east roof face."""
    if not isinstance(sign.target, tuple):
        raise ValueError("A roof sign requires a local-metre centre")
    east, north = sign.target
    surface = Surface()
    for strip in range(24):
        x0 = east - sign.height / 2 + strip * sign.height / 24
        x1 = x0 + sign.height / 24
        n0, n1 = north - sign.width / 2, north + sign.width / 2
        corners = [(x0, n0), (x0, n1), (x1, n1), (x1, n0)]
        if not all(S14_MAIN.covers(Point(*point)) for point in corners):
            raise ValueError("Roof lettering leaves the S14 barrel")
        vertices = [(x, s14_height(x) + 0.012, -n) for x, n in corners]
        for indices in ((0, 2, 1), (0, 3, 2)):
            triangle = tuple(vertices[i] for i in indices)
            surface.triangle(triangle, face_normal(*triangle))
    return surface
