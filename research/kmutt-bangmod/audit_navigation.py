"""Check mapped route geometry and export a building entrance survey register."""

import argparse
import csv
import json
from io import StringIO

from build import PUBLIC
from geometry import load_footprints
from shapely import union_all
from shapely.geometry import LineString
from walking_graph import compile_network


def generate():
    snapshot = json.loads((PUBLIC / "kmutt-bangmod.geojson").read_text(encoding="utf-8"))
    source = json.loads((PUBLIC / "walking-network.json").read_text(encoding="utf-8"))
    features, _ = load_footprints(snapshot)
    campus = next(polygon for id_, _, polygon in features if id_ == "campus")
    _, network = compile_network(snapshot, features, campus)
    obstacles = union_all([p for _, props, p in features if props["kind"] in {"building", "water"}])
    for start, end, *_ in network["edges"]:
        line = LineString([(network["nodes"][i][0], -network["nodes"][i][1]) for i in (start, end)])
        if not campus.buffer(0.3).covers(line) or line.intersection(obstacles).length > 0.3:
            raise ValueError("Walking edge crosses a mapped obstacle or campus boundary")
    stream = StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(["feature_id", "code", "name_th", "route_endpoint_basis", "gap_to_footprint_m", "latitude", "longitude", "source", "door_coordinate", "field_verification"])
    for id_, props, _ in features:
        if props["kind"] != "building":
            continue
        entry = network["endpoints"].get(id_)
        if entry:
            key = str(entry["sourceNode"])
            point = source["nodes"][key]
            values = [entry["basis"], entry["gapMetres"], point["lat"], point["lon"], f"https://www.openstreetmap.org/node/{key}"]
        else:
            values = ["missing-connection", "", "", "", ""]
        writer.writerow([id_, props["code"], props["nameTh"], *values,
                         "mapped-unverified" if entry and entry["basis"] == "mapped-entrance" else "requires-survey",
                         "required"])
    print(f"Checked {len(network['nodes'])} mapped nodes / {len(network['edges'])} edges; 39 building survey records")
    return stream.getvalue().encode("utf-8-sig")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = PUBLIC / "entrance-review.csv"
    result = generate()
    if args.check:
        if not output.exists() or output.read_bytes() != result:
            parser.exit(1, "Stale entrance review register\n")
    else:
        output.write_bytes(result)


if __name__ == "__main__":
    main()
