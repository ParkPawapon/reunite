"""Compile walkable OpenStreetMap topology without inventing missing junctions."""

import json
from itertools import pairwise

from build import PUBLIC
from geometry import local_projection
from shapely import union_all
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

OPEN = {"yes", "designated", "permissive", "official"}
RESTRICTED = {"no", "private", "destination", "customers", "permit"}


def walking_allowed(tags):
    if (
        tags.get("locked") == "yes"
        or tags.get("indoor") == "yes"
        or tags.get("tunnel") not in (None, "no")
    ):
        return False
    if tags.get("foot:conditional") or tags.get("access:conditional"):
        return False
    if "foot" in tags:
        return tags["foot"] in OPEN
    return tags.get("access") not in RESTRICTED


def compile_network(snapshot, footprints, campus):
    source = json.loads((PUBLIC / "walking-network.json").read_text(encoding="utf-8"))
    project, _ = local_projection(
        snapshot["metadata"]["originWgs84"], snapshot["metadata"]["projectedCrs"]
    )
    raw_nodes = source["nodes"]
    nodes = {
        key: project(Point(value["lon"], value["lat"]))
        for key, value in raw_nodes.items()
    }
    obstacles = union_all(
        [
            geom
            for _, props, geom in footprints
            if props["kind"] in {"building", "water"}
        ]
    )
    campus_tolerance = campus.buffer(0.3)
    edges = []
    for way in source["ways"]:
        tags = way["tags"]
        if not walking_allowed(tags):
            continue
        mode = (
            "steps"
            if tags["highway"] == "steps"
            else "road"
            if tags["highway"] in {"service", "living_street", "residential"}
            else "walk"
        )
        direction = tags.get("oneway:foot", "no")
        if direction not in {"yes", "no", "-1"}:
            raise ValueError(f"Unknown foot direction on way {way['id']}")
        for start, end in pairwise(map(str, way["nodes"])):
            if not all(walking_allowed(raw_nodes[key]["tags"]) for key in (start, end)):
                continue
            segment = LineString([nodes[start], nodes[end]])
            if segment.length < 0.1 or not campus_tolerance.covers(segment):
                continue
            # Small slivers at a mapped building entrance are due to footprint alignment.
            if segment.intersection(obstacles).length > 0.3:
                continue
            edges.append((start, end, mode, direction, way["id"]))
    active = sorted(
        {node for start, end, *_ in edges for node in (start, end)}, key=int
    )
    indices = {key: index for index, key in enumerate(active)}
    preferred = {
        key for start, end, mode, *_ in edges if mode == "walk" for key in (start, end)
    }
    endpoints = {}
    for id_, props, footprint in footprints:
        if props["kind"] == "boundary":
            continue
        if entry := source["reviewedApproaches"].get(id_):
            key = str(entry["node"])
            if key not in indices or footprint.distance(nodes[key]) > 12:
                raise ValueError(f"Reviewed approach for {id_} has left the network")
            endpoints[id_] = {
                "node": indices[key],
                "basis": entry["basis"],
                "sourceNode": int(key),
                "gapMetres": round(footprint.distance(nodes[key]), 1),
            }
            continue
        # Terminate on a mapped path near the footprint. The gap to the door is not part of the route.
        candidates = sorted(
            active,
            key=lambda key: (
                footprint.distance(nodes[key]) + (0 if key in preferred else 3),
                int(key),
            ),
        )
        for key in candidates:
            point = nodes[key]
            if footprint.distance(point) > 18:
                continue
            boundary_point, _ = nearest_points(footprint, point)
            connector = LineString([boundary_point, point])
            if connector.length and (
                not campus_tolerance.covers(connector)
                or connector.intersection(obstacles).length > 0.3
            ):
                continue
            endpoints[id_] = {
                "node": indices[key],
                "basis": "approach",
                "sourceNode": int(key),
                "gapMetres": round(footprint.distance(point), 1),
            }
            break
    gate_features = []
    for gate in source["gates"]:
        key = str(gate["node"])
        point = nodes[key]
        if campus.boundary.distance(point) > 12:
            raise ValueError(f"Gate {gate['id']} is too far from the campus boundary")
        if key in indices:
            endpoints[gate["id"]] = {
                "node": indices[key],
                "basis": "mapped-gate",
                "sourceNode": int(key),
                "gapMetres": 0,
            }
        gate_features.append(
            {
                "id": gate["id"],
                "kind": "gate",
                "nameTh": gate["nameTh"],
                "world": [round(point.x, 2), 2.5, round(-point.y, 2)],
                "wgs84": [raw_nodes[key]["lat"], raw_nodes[key]["lon"]],
                "path": "",
                "footprintBasis": "mapped-gate",
                "source": f"https://www.openstreetmap.org/node/{key}",
            }
        )
    return gate_features, {
        "nodes": [
            [round(nodes[key].x, 2), round(-nodes[key].y, 2), int(key)]
            for key in active
        ],
        "edges": [
            [indices[a], indices[b], mode, direction, way]
            for a, b, mode, direction, way in edges
        ],
        "endpoints": endpoints,
    }
