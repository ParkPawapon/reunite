"""Photo-interpreted height breaks shared by the basic and detailed models."""

from dataclasses import dataclass

from geometry import Surface, extrude
from shapely import orient_polygons
from shapely.geometry import Polygon, box

TOUR = "https://www.kmutt.ac.th/virtual/bangmod/"
N7_LEVEL_SOURCE = "https://chem.kmutt.ac.th/2019-09-19-03-23-40/th-contract"


@dataclass(frozen=True)
class Massing:
    lower_floors: int
    upper: Polygon
    source: str
    note: str

    def metadata(self):
        return {
            "podiumFloors": self.lower_floors,
            "massingSource": self.source,
            "massingBasis": self.note,
        }


def height_break(id_, footprint):
    if id_ == "N7":
        if footprint.geom_type != "MultiPolygon" or len(footprint.geoms) != 2:
            raise ValueError("N7 requires the two reviewed mapped components")
        upper = max(footprint.geoms, key=lambda polygon: polygon.centroid.y)
        result = Massing(
            3, upper, f"{TOUR}#media-index=104",
            "Northern laboratory bar: at least ten floors documented by Chemistry. "
            "Three-level lower wing interpreted from camera 65/104 photographs. "
            "Metre heights, floor spacing and the lower-wing level count are estimates.",
        )
    elif id_ == "S3":
        upper = orient_polygons(footprint.intersection(box(110, -161.2, 180, -130)))
        result = Massing(
            5, upper, f"{TOUR}#media-index=123",
            "Five-level lower podium with a taller northern wing. Roof use at level "
            "five is identified by the official tour; tower split and setbacks are "
            "photo interpretations from aerial cameras 102-106, not measured dimensions.",
        )
    else:
        return None
    if (
        result.upper.geom_type != "Polygon"
        or result.upper.is_empty
        or not result.upper.is_valid
        or not footprint.covers(result.upper)
        or footprint.difference(result.upper).area < 1
    ):
        raise ValueError(f"{id_}: Invalid photo-interpreted upper footprint")
    return result


def append_surface(target, source):
    for offset in range(0, len(source.indices), 3):
        indices = source.indices[offset : offset + 3]
        target.triangle(
            tuple(source.positions[index] for index in indices),
            source.normals[indices[0]],
        )


def massing_surfaces(footprint, height, floors, massing):
    if not 0 < massing.lower_floors < floors:
        raise ValueError("Lower mass must be below the upper roof")
    base = height * massing.lower_floors / floors
    roof, walls = Surface(), Surface()
    podium = orient_polygons(footprint.difference(massing.upper))
    _, low_walls = extrude(footprint, 0, base)
    visible_roof, _ = extrude(podium, 0, base, sides=False)
    high_roof, high_walls = extrude(massing.upper, base, height)
    append_surface(roof, visible_roof)
    append_surface(roof, high_roof)
    append_surface(walls, low_walls)
    append_surface(walls, high_walls)
    return roof, walls
