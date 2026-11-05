"""Encode checked local renders and package the editable campus study with hashes."""

import argparse
import hashlib
from collections import Counter
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public/research/kmutt-bangmod"
STUDY = Path(__file__).resolve().parent
RENDERS = (
    "campus", "lx", "lx-plaza", "lx-roof", "s3", "fibo", "s4", "s15",
    "n7", "n11", "s14", "loading",
)
ELEVATIONS = ("north", "east", "south", "west", "roof-oblique")


def encode_renders(folder):
    for name in RENDERS:
        path = folder / f"bangmod-{name}.png"
        with Image.open(path) as image:
            expected = (1200, 675) if name == "loading" else (3840, 2560)
            if image.size != expected:
                raise ValueError(f"Unexpected render dimensions: {path.name}")
            image = image.convert("RGB")
            image.save(PUBLIC / f"bangmod-{name}.webp", quality=82 if name == "loading" else 91, method=6)
            image.thumbnail((1440, 960))
            image.save(folder / f"bangmod-{name}-review.jpg", quality=89)
    for name in ELEVATIONS:
        path = folder / "building-elevations" / f"{name}.png"
        with Image.open(path) as image:
            if image.size != (5760, 5250):
                raise ValueError(f"Unexpected elevation dimensions: {name}")
            image = image.convert("RGB")
            for index in range(39):
                x, y = index % 6 * 960, index // 6 * 750
                cell = image.crop((x + 56, y + 45, x + 904, y + 647)).resize((56, 40))
                if len(Counter(cell.get_flattened_data())) <= 45:
                    raise ValueError(f"Empty or incomplete elevation cell: {name}, {index}")
            image.save(path.with_suffix(".webp"), quality=92, method=6)
            image.thumbnail((1110, 1050))
            image.save(path.with_name(f"{name}-review.jpg"), quality=89)
    print("Encoded 11 full-size renders and loading poster; checked all 195 elevation cells")


def package(folder):
    files = {"kmutt-bangmod.blend": folder / "kmutt-bangmod.blend"}
    for name in RENDERS:
        files[f"renders/bangmod-{name}.png"] = folder / f"bangmod-{name}.png"
    for name in ELEVATIONS:
        files[f"building-elevations/{name}.webp"] = folder / "building-elevations" / f"{name}.webp"
    for path in PUBLIC.iterdir():
        if path.suffix in {".glb", ".csv", ".geojson", ".json", ".txt"}:
            files[f"models/{path.name}"] = path
        if path.suffix in {".geojson", ".json"}:
            files[f"source/{path.relative_to(ROOT).as_posix()}"] = path
    for path in STUDY.rglob("*"):
        if path.is_file() and path.suffix in {".py", ".md", ".json", ".ttf", ".txt"}:
            files[f"source/{path.relative_to(ROOT).as_posix()}"] = path
    for name in ("catalog.generated.json", "anchors.generated.json"):
        path = ROOT / "apps/web/src/app/research/kmutt-bangmod" / name
        files[f"source/{path.relative_to(ROOT).as_posix()}"] = path
    for name in ("mobile-performance.json", "VERIFICATION.md"):
        path = folder / name
        if not path.exists():
            raise ValueError(f"Missing release verification: {name}")
        files[f"verification/{name}"] = path
    manifest = []
    archive = folder / "kmutt-bangmod-exterior-study.zip"
    with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=6) as bundle:
        for name, path in sorted(files.items()):
            data = path.read_bytes()
            manifest.append(f"{hashlib.sha256(data).hexdigest()}  {name}")
            bundle.writestr(name, data)
        bundle.writestr("SHA256SUMS.txt", "\n".join(manifest) + "\n")
    with ZipFile(archive) as bundle:
        if len(bundle.namelist()) != len(files) + 1 or bundle.testzip() is not None:
            raise ValueError("Delivery archive failed file count or CRC verification")
        for line in bundle.read("SHA256SUMS.txt").decode().splitlines():
            expected, name = line.split("  ", 1)
            if hashlib.sha256(bundle.read(name)).hexdigest() != expected:
                raise ValueError(f"Archived content hash mismatch: {name}")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n", encoding="ascii")
    print(f"Verified {len(files)} delivery files, CRC and SHA-256: {archive.stat().st_size:,} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--encode-only", action="store_true")
    parser.add_argument("--archive-only", action="store_true")
    args = parser.parse_args()
    if args.encode_only and args.archive_only:
        parser.error("Choose one output mode")
    if not args.archive_only:
        encode_renders(args.folder)
    if not args.encode_only:
        package(args.folder)


if __name__ == "__main__":
    main()
