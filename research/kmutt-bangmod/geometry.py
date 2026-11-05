"""Convert the reviewed Bangmod footprint snapshot into local-metre meshes."""

from itertools import combinations
from math import hypot, isfinite

from pyproj import Transformer
from shapely import (
    constrained_delaunay_triangles,
    orient_polygons,
    set_precision,
    transform,
)
from shapely.geometry import shape


def local_projection(origin, crs):
    project = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    e0, n0 = project(*origin)

    def apply(geometry):
        def coordinates(lon, lat):
            east, north = project(lon, lat)
            return east - e0, north - n0

        return orient_polygons(
            set_precision(transform(geometry, coordinates, interleaved=False), 0.001)
        )

    return apply, [e0, n0]


def load_footprints(snapshot):
    """Fail on missing codes, invalid geometry, or any geometry outside campus."""
    features = snapshot["features"]
    ids = [feature["id"] for feature in features]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate feature ID")
    codes = {
        f["properties"]["code"]
        for f in features
        if f["properties"]["kind"] == "building"
    }
    expected = {
        f"{zone}{i}"
        for zone, limit in [("N", 20), ("S", 15)]
        for i in range(1, limit + 1)
    }
    if codes != expected:
        raise ValueError(f"Master-plan codes changed: {sorted(codes ^ expected)}")
    if [f["id"] for f in features if f["properties"]["kind"] == "boundary"] != [
        "campus"
    ]:
        raise ValueError("Expected exactly one campus boundary")
    source = {f["id"]: shape(f["geometry"]) for f in features}
    project, origin = local_projection(
        snapshot["metadata"]["originWgs84"], snapshot["metadata"]["projectedCrs"]
    )
    campus = project(source["campus"])
    results = []
    for feature in features:
        id_ = feature["id"]
        props = feature["properties"]
        geom = source[id_]
        if (
            geom.geom_type not in ("Polygon", "MultiPolygon")
            or not geom.is_valid
            or geom.is_empty
        ):
            raise ValueError(f"{id_}: Invalid polygon")
        geom = project(geom)
        if not geom.is_valid or geom.is_empty or geom.area <= 0:
            raise ValueError(f"{id_}: Invalid projected polygon")
        # A millimetre of rounding at the campus boundary can shift coincident vertices.
        if not campus.buffer(0.002).covers(geom):
            raise ValueError(f"{id_}: Footprint leaves campus")
        if props["kind"] == "building":
            height = props["heightM"]
            if not isfinite(height) or not 0 < height < 150:
                raise ValueError(f"{id_}: Invalid study height")
            estimated = props["heightBasis"] == "assumed"
            if estimated != (props["floorCount"] is None) or estimated != (
                props["heightSource"] is None
            ):
                raise ValueError(f"{id_}: Height evidence is inconsistent")
            if (
                not estimated
                and abs(props["floorCount"] * props["floorHeightM"] - height) > 0.051
            ):
                raise ValueError(
                    f"{id_}: Model height does not match its documented calculation"
                )
        results.append((id_, props, geom))
    buildings = [
        (id_, geom) for id_, props, geom in results if props["kind"] == "building"
    ]
    for (a_id, a), (b_id, b) in combinations(buildings, 2):
        if a.intersection(b).area > 0.05:
            raise ValueError(f"{a_id} and {b_id}: Building footprints overlap")
    return results, origin


class Surface:
    def __init__(self):
        self.positions = []
        self.normals = []
        self.indices = []
        self._vertices = {}

    def triangle(self, vertices, normal):
        self.triangle_with_normals(vertices, (normal,) * 3)

    def triangle_with_normals(self, vertices, normals):
        for position, normal in zip(vertices, normals, strict=True):
            key = position, normal
            if key not in self._vertices:
                self._vertices[key] = len(self.positions)
                self.positions.append(position)
                self.normals.append(normal)
            self.indices.append(self._vertices[key])


def extrude(geometry, bottom, top, *, sides=True):
    """Build outward-facing roofs, bases and walls, including interior rings."""
    roof, walls = Surface(), Surface()
    polygons = [geometry] if geometry.geom_type == "Polygon" else geometry.geoms
    for polygon in polygons:
        triangles = orient_polygons(constrained_delaunay_triangles(polygon)).geoms
        if abs(sum(t.area for t in triangles) - polygon.area) > 0.001:
            raise ValueError("Triangulation does not cover the footprint")
        for triangle in triangles:
            a, b, c = list(triangle.exterior.coords)[:3]
            roof.triangle(tuple((e, top, -n) for e, n in (a, b, c)), (0, 1, 0))
            walls.triangle(tuple((e, bottom, -n) for e, n in (a, c, b)), (0, -1, 0))
        if not sides:
            continue
        for ring in (polygon.exterior, *polygon.interiors):
            for (e1, n1), (e2, n2) in zip(ring.coords, list(ring.coords)[1:]):
                length = hypot(e2 - e1, n2 - n1)
                normal = ((n2 - n1) / length, 0, (e2 - e1) / length)
                a, b = (e1, bottom, -n1), (e2, bottom, -n2)
                c, d = (e2, top, -n2), (e1, top, -n1)
                walls.triangle((a, b, c), normal)
                walls.triangle((a, c, d), normal)
    return roof, walls
