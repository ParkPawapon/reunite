"""Validate a local CUA capture collection and produce a traceable reference gallery.

Source photographs remain local research references, outside the public web assets.
This audits saved files, not real-world dimensions or unseen elevations.
"""

import argparse
import csv
import hashlib
import html
import io
import json
from collections import Counter
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "research/kmutt-bangmod/VIRTUAL-TOUR-CAPTURES.json"
TOUR = "https://www.kmutt.ac.th/virtual/bangmod/"
# Verified against the visible camera caption. Menu category clicks did not always navigate.
INITIAL_CAMERAS = [102, 90, 90, 65, 17, 15, 16, 20, 83, 4, 107, 43, 3, 64, 35, 34, 3, 4, 1, 2]
INDOOR_CONTEXT = {33, 34, 35, 40, 41, 42}
CORRECTIONS = {
    "03-S4-engineering": "SoLA camera 90; the menu category only expanded. Replaced for engineering evidence by P018.",
    "10-ddct": "Health Park camera 4; the DDCT category did not navigate. No DDCT exterior assertion.",
    "13-memorial": "Football field camera 3, not the indoor memorial gym camera 5.",
    "06-S14-fiet": "FIET camera 15 is not proof of a facade/sign on the S14 memorial gym.",
}
DIRECT_CAMERAS = {
    "N7": [65, 104], "N9": [83], "N10": [43], "N11": [16],
    "N15": [90], "N16": [64], "N19": [20],
    "S3": [107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 119, 120, 121, 122, 123],
    "S9": [17, 24], "S14": [3, 105],
    **{f"S4-{levels}-floors": [18] for levels in (3, 4, 8, 11)},
}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def audit(folder):
    records = json.loads((folder / "index.json").read_text(encoding="utf-8"))
    catalog = json.loads((folder / "camera-catalog.json").read_text(encoding="utf-8"))
    cameras = {item["index"]: item for item in catalog}
    if len(cameras) != 147 or len(records) != 52:
        raise ValueError("Capture/catalog counts changed; review the explicit camera mapping")
    rows, sets, paths, digests = [], [], set(), Counter()
    gallery = [
        '<!doctype html><html lang="th"><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>KMUTT Bangmod — captured reference gallery</title>',
        '<style>body{max-width:1300px;margin:2rem auto;padding:0 1rem;font-family:system-ui}img{max-width:100%;height:auto}section{margin:2rem 0}a{overflow-wrap:anywhere}li{display:inline-block;margin:.4rem}</style>',
        '<h1>KMUTT Bangmod — ภาพอ้างอิงจาก Virtual Tour</h1>',
        '<p>ภาพหน้าจอจากเว็บมหาวิทยาลัย ไม่ใช่ภาพสำรวจหน้างาน ทิศจากการลากเป็นทิศสัมพัทธ์ ไม่ได้ยืนยันมุมทิศจริง ภาพซ้ำและภาพภายในไม่นับเป็นมุมด้านนอกเพิ่ม สิทธิ์ภาพเป็นของเจ้าของแหล่งที่มา ไม่ได้ยืนยันใบอนุญาตเผยแพร่ภาพต่อ</p>',
    ]
    for number, record in enumerate(records):
        station = record["station"]
        index = record.get("mediaIndex")
        if index is None:
            if number >= len(INITIAL_CAMERAS):
                raise ValueError(f"Missing verified camera index: {station}")
            index = INITIAL_CAMERAS[number]
        camera = cameras[index]
        label = camera["label"] or camera["subtitle"] or f"Camera {index}"
        if record.get("mediaId", camera["id"]) != camera["id"]:
            raise ValueError(f"Camera ID mismatch: {station}")
        images = record["images"]
        if len(images) not in (24, 32):
            raise ValueError(f"Incomplete registered sweep: {station}")
        for relative in images:
            file = (folder / relative).resolve()
            if not file.is_relative_to(folder.resolve()) or relative in paths:
                raise ValueError("Duplicate path or capture escapes its collection")
            paths.add(relative)
            data = file.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            digests[digest] += 1
            with Image.open(file) as picture:
                picture.load()
                if picture.format != "JPEG" or picture.size != (1920, 1080):
                    raise ValueError(f"Unexpected screenshot format/size: {relative}")
            rows.append({
                "path": relative, "cameraIndex": index, "mediaId": camera["id"],
                "capturedAt": record["capturedAt"], "bytes": len(data),
                "sha256": digest, "width": 1920, "height": 1080,
            })
        source = f"{TOUR}#media-index={index}"
        note = CORRECTIONS.get(station, "")
        sets.append({
            "station": station, "cameraIndex": index, "mediaId": camera["id"],
            "label": label, "subtitle": camera["subtitle"],
            "source": source, "frameCount": len(images),
            "use": "indoor-context-only" if index in INDOOR_CONTEXT else "exterior-roof-aerial-context",
            "correction": note,
        })
        escape = html.escape
        gallery.extend([
            f'<section><h2>{escape(station)} · camera {index} · {escape(label)}</h2>',
            f'<p>{escape(note)} <a href="{escape(source, quote=True)}">เปิดกล้องต้นทาง</a></p>',
            f'<img loading="lazy" src="review/{escape(station, quote=True)}.jpg" alt="ภาพรวมมุมที่จับไว้ของ {escape(station, quote=True)}">',
            '<details><summary>ภาพเต็ม 1920 × 1080</summary><ul>',
            *[f'<li><a href="{escape(relative, quote=True)}">{escape(Path(relative).stem)}</a></li>' for relative in images],
            '</ul></details></section>',
        ])
    indices = {entry["cameraIndex"] for entry in sets}
    snapshot = json.loads((ROOT / "apps/web/public/research/kmutt-bangmod/kmutt-bangmod.geojson").read_text(encoding="utf-8"))
    coverage = [
        {
            "featureId": feature["id"],
            "atlasSource": f'https://bgm.kmutt.ac.th/MapNavi/{feature["properties"]["code"]}.html',
            "contextCameras": DIRECT_CAMERAS.get(feature["id"], [102, 103, 104, 105, 106]),
            "scope": "Complex/neighboring context only; not every elevation or each S4 block is visible." if feature["id"].startswith("S4-") else "Visible portions only; no four-elevation coverage certification.",
            "dimensions": "not-surveyed",
        }
        for feature in snapshot["features"] if feature["properties"]["kind"] == "building"
    ]
    report = {
        "source": TOUR, "captureDate": "2026-11-05", "publishedCameraCount": len(cameras),
        "registeredSets": len(sets), "registeredFrames": len(rows),
        "distinctCameras": len(indices), "exteriorContextCameras": len(indices - INDOOR_CONTEXT),
        "indoorContextCameras": sorted(indices & INDOOR_CONTEXT),
        "byteIdenticalDuplicateFrames": sum(count - 1 for count in digests.values()),
        "orientation": "Relative UI drags, not surveyed azimuths. Repeated rotations and sky frames do not add building coverage.",
        "rights": "Public university tour; image ownership retained. No redistribution or texture-use license confirmed.",
        "excludedIncompleteSet": "P066: interrupted sweep, retained locally and excluded from totals.",
        "sets": sets, "buildingReferenceCoverage": coverage,
    }
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return {
        REPORT: encoded(report),
        folder / "capture-manifest.csv": stream.getvalue().encode("utf-8-sig"),
        folder / "index.html": ("\n".join(gallery) + "\n</html>\n").encode("utf-8"),
    }, paths, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--archive", action="store_true")
    args = parser.parse_args()
    outputs, images, report = audit(args.folder)
    for path, data in outputs.items():
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                parser.exit(1, f"Stale reference audit: {path.name}\n")
        else:
            path.write_bytes(data)
    if args.archive:
        archive = args.folder.parent / "kmutt-bangmod-virtual-tour-captures.zip"
        names = sorted(images | {"index.html", "index.json", "camera-catalog.json", "capture-manifest.csv", "source-map.png", "source-map-capture.jpg"})
        names.extend(f'review/{entry["station"]}.jpg' for entry in report["sets"])
        with ZipFile(archive, "w", compression=ZIP_STORED) as bundle:
            for relative in names:
                bundle.write(args.folder / relative, relative)
            bundle.write(REPORT, REPORT.name)
        with ZipFile(archive) as bundle:
            if len(bundle.namelist()) != len(set(bundle.namelist())) or bundle.testzip() is not None:
                raise ValueError("Reference archive failed CRC or contains duplicate paths")
        print(f"Archive verified: {archive.stat().st_size:,} bytes")
    print(f'{report["registeredFrames"]} frames, {report["distinctCameras"]} distinct cameras, '
          f'{report["exteriorContextCameras"]} exterior/roof/aerial cameras; 39 building reference records')


if __name__ == "__main__":
    main()
