"""Planar wall geometry with closed recesses and glazing in local wall coordinates."""

from dataclasses import dataclass
from math import hypot

from shapely.geometry import Polygon


@dataclass(frozen=True)
class Opening:
    left: float
    right: float
    bottom: float
    top: float
    depth: float
    finish: str = "glass"


class Wall:
    def __init__(self, start, end):
        self.east, self.north = start
        delta_e, delta_n = end[0] - start[0], end[1] - start[1]
        self.length = hypot(delta_e, delta_n)
        self.dx, self.dz = delta_e / self.length, -delta_n / self.length
        self.normal = (-self.dz, 0, self.dx)

    def point(self, along, height, offset):
        return (
            self.east + self.dx * along + self.normal[0] * offset,
            height,
            -self.north + self.dz * along + self.normal[2] * offset,
        )

    def panel(self, surface, left, right, bottom, top, offset=0):
        if right - left < 0.0001 or top - bottom < 0.0001:
            return
        self.quad(
            surface,
            self.point(left, bottom, offset),
            self.point(right, bottom, offset),
            self.point(right, top, offset),
            self.point(left, top, offset),
            self.normal,
        )

    @staticmethod
    def profiled_quad(surface, a, b, c, d):
        """A planar joinery face with a geometric normal, including bevels."""
        ab = tuple(y - x for x, y in zip(a, b, strict=True))
        ac = tuple(y - x for x, y in zip(a, c, strict=True))
        cross = (
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        )
        length = hypot(*cross)
        if length < 1e-10:
            raise ValueError("Degenerate joinery face")
        normal = tuple(axis / length for axis in cross)
        Wall.quad(surface, a, b, c, d, normal)

    def profiled_frame(self, surface, left, right, bottom, top, rim, offset):
        # A shallow folded profile replaces the flat rim, retaining its triangle count.
        # These are visualization dimensions, not surveyed aluminium section sizes.
        outer = [
            self.point(x, y, offset + 0.012)
            for x, y in ((left, bottom), (right, bottom), (right, top), (left, top))
        ]
        inner = [
            self.point(x, y, offset + 0.024)
            for x, y in (
                (left + rim, bottom + rim), (right - rim, bottom + rim),
                (right - rim, top - rim), (left + rim, top - rim),
            )
        ]
        for index in range(4):
            next_ = (index + 1) % 4
            self.profiled_quad(
                surface, outer[index], outer[next_], inner[next_], inner[index]
            )

    def bar(self, surface, left, right, bottom, top, back, front):
        """Close the four exposed returns of a rectangular glazing bar."""
        self.panel(surface, left, right, bottom, top, front)
        for a, b, c, d in (
            ((left, bottom, back), (right, bottom, back),
             (right, bottom, front), (left, bottom, front)),
            ((left, top, back), (left, top, front),
             (right, top, front), (right, top, back)),
            ((left, bottom, back), (left, bottom, front),
             (left, top, front), (left, top, back)),
            ((right, bottom, back), (right, top, back),
             (right, top, front), (right, bottom, front)),
        ):
            self.profiled_quad(
                surface, *(self.point(*point) for point in (a, b, c, d))
            )

    @staticmethod
    def quad(surface, a, b, c, d, normal):
        surface.triangle((a, b, c), normal)
        surface.triangle((a, c, d), normal)

    def band(self, left, right, inner, outer):
        corners = (
            self.point(left, 0, inner),
            self.point(right, 0, inner),
            self.point(right, 0, outer),
            self.point(left, 0, outer),
        )
        return Polygon([(east, -south) for east, _, south in corners])

    def recess_depth(self, interior, left, right, depth):
        for candidate in (depth, depth / 2):
            if interior.covers(self.band(left, right, -candidate, 0)):
                return candidate
        return 0

    def story(self, surfaces, role, bottom, top, openings):
        """Fill the wall around ordered apertures and close each aperture at its back."""
        cursor = previous = 0
        wall = surfaces[role]
        for opening in openings:
            left, right = opening.left, opening.right
            if not (
                previous <= left < right <= self.length
                and bottom <= opening.bottom < opening.top <= top
            ):
                raise ValueError("Apertures overlap or leave the facade panel")
            previous = right
            if opening.depth:
                self.panel(wall, cursor, left, bottom, top)
                self.panel(wall, left, right, bottom, opening.bottom)
                self.panel(wall, left, right, opening.top, top)
                self.reveals(surfaces["reveal"], opening)
                cursor = right
            self.infill(surfaces, opening)
        self.panel(wall, cursor, self.length, bottom, top)

    def reveals(self, surface, opening, *, front=0):
        left, right, bottom, top, depth = (
            opening.left,
            opening.right,
            opening.bottom,
            opening.top,
            opening.depth,
        )
        back = front - depth
        a, b = self.point(left, bottom, front), self.point(right, bottom, front)
        c, d = self.point(right, top, front), self.point(left, top, front)
        e, f = self.point(left, bottom, back), self.point(right, bottom, back)
        g, h = self.point(right, top, back), self.point(left, top, back)
        self.quad(surface, a, e, h, d, (self.dx, 0, self.dz))
        self.quad(surface, b, c, g, f, (-self.dx, 0, -self.dz))
        self.quad(surface, a, b, f, e, (0, 1, 0))
        self.quad(surface, d, h, g, c, (0, -1, 0))

    def infill(self, surfaces, opening):
        left, right = opening.left, opening.right
        bottom, top = opening.bottom, opening.top
        offset = -opening.depth if opening.depth else 0.019
        if opening.finish not in {"glass", "door"}:
            self.panel(surfaces[opening.finish], left, right, bottom, top, offset)
            return
        rim = min(0.046, (right - left) / 8, (top - bottom) / 8)
        frame = surfaces["door-frame" if opening.finish == "door" else "frame"]
        frame_face = offset + 0.024
        self.profiled_frame(frame, left, right, bottom, top, rim, offset)
        self.reveals(
            frame,
            Opening(left + rim, right - rim, bottom + rim, top - rim, 0.024),
            front=frame_face,
        )
        clear = right - left - 2 * rim
        panes = max(1, round(clear / 1.45))
        for i in range(panes):
            a = left + rim + clear * i / panes
            b = left + rim + clear * (i + 1) / panes
            gasket = min(0.028, (b - a) / 5) if i + 1 < panes else 0
            self.panel(
                surfaces["glass"], a, b - gasket, bottom + rim, top - rim, offset
            )
            if gasket:
                self.bar(
                    surfaces["mullion"],
                    b - gasket,
                    b,
                    bottom + rim,
                    top - rim,
                    offset,
                    frame_face - 0.004,
                )
        if opening.finish == "door":
            transom = min(top - 0.20, bottom + 2.15)
            self.panel(
                frame, left + rim, right - rim, transom, transom + 0.062, frame_face
            )
            center = (left + right) / 2
            self.panel(
                frame, center - 0.045, center + 0.045, bottom + rim, transom, frame_face
            )
            for handle in (center - 0.16, center + 0.16):
                self.bar(
                    surfaces["metal"],
                    handle - 0.022,
                    handle + 0.022,
                    bottom + 0.88,
                    bottom + 1.19,
                    frame_face,
                    frame_face + 0.045,
                )
