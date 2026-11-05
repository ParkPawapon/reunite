"""Generate navigation markers and a north-up fallback map from campus geometry."""

import argparse
import json

from build import PUBLIC, ROOT
from geometry import load_footprints, local_projection
from pyproj import Transformer
from shapely import get_parts, union_all
from shapely.geometry import shape
from walking_graph import compile_network

OUTPUT = ROOT / "apps/web/src/app/research/kmutt-bangmod/anchors.generated.json"


def number(value):
    return round(value, 2)


def outline(geometry):
    polygons = geometry.geoms if geometry.geom_type == "MultiPolygon" else [geometry]
    return "".join(
        "M"
        + "L".join(f"{number(e)},{number(-n)}" for e, n in list(ring.coords)[:-1])
        + "Z"
        for polygon in polygons
        for ring in (polygon.exterior, *polygon.interiors)
    )


def mapped_routes(snapshot, footprints, boundaries):
    project, _ = local_projection(
        snapshot["metadata"]["originWgs84"], snapshot["metadata"]["projectedCrs"]
    )
    context = json.loads((PUBLIC / "site-context.geojson").read_text(encoding="utf-8"))
    obstacles = union_all(
        [
            geometry
            for _, props, geometry in footprints
            if props["kind"] in {"building", "water"}
        ]
    )
    routes = {"road": [], "walk": []}
    for feature in context["features"]:
        if feature["geometry"]["type"] != "LineString":
            continue
        route = (
            project(shape(feature["geometry"]))
            .intersection(boundaries)
            .difference(obstacles)
        )
        group = "road" if feature["properties"]["kind"] == "service" else "walk"
        for line in get_parts(route):
            if line.geom_type == "LineString" and line.length > 1:
                routes[group].append(
                    "M" + "L".join(f"{number(x)},{number(-y)}" for x, y in line.coords)
                )
    return {group: "".join(paths) for group, paths in routes.items()}


def live_projection(metadata, origin, view_box, geographic):
    """Linearize the UTM projection for the small displayed campus extent."""
    lon, lat = metadata["originWgs84"]
    forward = Transformer.from_crs(
        "EPSG:4326", metadata["projectedCrs"], always_xy=True
    )
    delta = 0.002
    metres_per_degree = []
    for dx, dy in ((delta, 0), (0, delta)):
        a = forward.transform(lon + dx, lat + dy)
        b = forward.transform(lon - dx, lat - dy)
        metres_per_degree.append(
            [(a[0] - b[0]) / (2 * delta), -(a[1] - b[1]) / (2 * delta)]
        )
    east, south, width, height = view_box
    for i in range(9):
        for j in range(9):
            x, z = east + width * i / 8, south + height * j / 8
            p, q = geographic.transform(origin[0] + x, origin[1] - z)
            estimate = [
                (p - lon) * metres_per_degree[0][axis]
                + (q - lat) * metres_per_degree[1][axis]
                for axis in (0, 1)
            ]
            if max(abs(estimate[0] - x), abs(estimate[1] - z)) > 0.05:
                raise ValueError("Live location projection exceeds campus tolerance")
    (lon_x, lon_z), (lat_x, lat_z) = metres_per_degree
    return {
        "origin": {"lon": lon, "lat": lat},
        "longitude": {"x": round(lon_x, 6), "z": round(lon_z, 6)},
        "latitude": {"x": round(lat_x, 6), "z": round(lat_z, 6)},
    }


def generate():
    snapshot = json.loads(
        (PUBLIC / "kmutt-bangmod.geojson").read_text(encoding="utf-8")
    )
    footprints, origin = load_footprints(snapshot)
    geographic = Transformer.from_crs(
        snapshot["metadata"]["projectedCrs"], "EPSG:4326", always_xy=True
    )
    boundaries = next(polygon for key, _, polygon in footprints if key == "campus")
    min_e, min_n, max_e, max_n = boundaries.bounds
    view_box = [min_e - 18, -max_n - 18, max_e - min_e + 36, max_n - min_n + 36]
    features = []
    for key, props, geometry in footprints:
        # Point on surface gives a marker inside the largest footprint of a complex.
        part = (
            max(geometry.geoms, key=lambda item: item.area)
            if geometry.geom_type == "MultiPolygon"
            else geometry
        )
        point = part.representative_point()
        lon, lat = geographic.transform(point.x + origin[0], point.y + origin[1])
        features.append(
            {
                "id": key,
                "kind": props["kind"],
                "nameTh": props["nameTh"],
                "world": [
                    number(point.x),
                    number(props.get("heightM", 0) + 2.5),
                    number(-point.y),
                ],
                "wgs84": [round(lat, 6), round(lon, 6)],
                "path": outline(geometry),
                "footprintBasis": props["footprintBasis"],
                "source": props["footprintSources"][0]["url"],
            }
        )
    gates, walking = compile_network(snapshot, footprints, boundaries)
    return {
        "viewBox": [number(v) for v in view_box],
        "liveProjection": live_projection(
            snapshot["metadata"], origin, view_box, geographic
        ),
        "features": [*features, *gates],
        "routes": mapped_routes(snapshot, footprints, boundaries),
        "walking": walking,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    check = parser.parse_args().check
    payload = (
        json.dumps(generate(), ensure_ascii=False, separators=(",", ":")) + "\n"
    ).encode("utf-8")
    if check:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != payload:
            parser.exit(1, "Stale navigation anchors\n")
    else:
        OUTPUT.write_bytes(payload)
    print(f"{OUTPUT.name} ({len(payload):,} bytes)")


if __name__ == "__main__":
    main()
