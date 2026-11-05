"""Building signs transcribed from exterior photos and placed on the model."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from entries import select_entry_wall
from facades import fibo_front_edge, paint, solid
from geometry import Surface
from roof_studies import s14_lettering
from PIL import Image, ImageDraw, ImageFont, features
from shapely.geometry import Point
from wall import Wall

ATLAS = "https://bgm.kmutt.ac.th/MapNavi/"


@dataclass(frozen=True)
class Sign:
    lines: tuple[str, ...]
    target: str | tuple[float, float] | None
    width: float
    height: float
    center: float
    along: float = 0.5
    offset: float = 0.055
    ink: str = "232c2c"
    backing: str | None = None
    pole: bool = False
    source: str | None = None
    roof: bool = False


ORANGE = "ad420e"
YELLOW = "ebb837"
WHITE = "f4f0df"

# Center is the modeled sign center above grade. Position and dimensions are photo estimates.
# Targets select the outward facade. An omitted target uses the existing frontage reference.
SIGNS = {
    "N1": (Sign(("N1",), "N2", 1.55, 0.65, 4.5, 0.72),),
    "N2": (
        Sign(("สำนักงานอธิการบดี", "OFFICE OF THE PRESIDENT"), None, 6.4, 0.97, 7.3, 0.71),
    ),
    "N3": (Sign(("N3",), "N2", 1.75, 0.72, 10.35, 0.82),),
    "N4": (Sign(("N4",), "N2", 1.8, 0.72, 13.75, 0.82),),
    "N5": (
        Sign(("N5",), "N6", 1.35, 0.52, 3.35, 0.58, backing=YELLOW),
        Sign(
            (
                "ศูนย์เครื่องมือวิทยาศาสตร์เพื่อมาตรฐานและอุตสาหกรรม",
                "Scientific Instrument Center for Standard and Industry",
            ),
            "N6",
            6.5,
            1.32,
            0.67,
            0.28,
            0.56,
            "d9b66a",
            "383735",
        ),
    ),
    "N6": (
        Sign(("ภาควิชาจุลชีววิทยา",), "N7", 3.9, 0.60, 3.12, ink=WHITE, backing="423329"),
    ),
    "N7": (
        Sign(
            ("อาคารปฏิบัติการทางวิทยาศาสตร์", "SCIENCE LABORATORIES BUILDING"),
            None,
            7.5,
            1.16,
            6.48,
        ),
        Sign(
            ("สำนักงานคณบดี คณะวิทยาศาสตร์", "OFFICE OF THE DEAN FACULTY OF SCIENCE"),
            None,
            5.5,
            0.84,
            3.30,
            backing="d6bf6c",
        ),
    ),
    "N8": (Sign(("N8",), None, 1.30, 0.62, 2.68, 0.82, backing=YELLOW),),
    "N9": (Sign(("FIBO",), None, 4.6, 1.30, 28.20, 0.70, 0.94, ink="ac4827"),),
    "N10": (Sign(("หอสมุด",), None, 5.8, 1.32, 5.15),),
    "N11": (
        Sign(("คณะเทคโนโลยีสารสนเทศ", "School of Information Technology"), None, 6.2, 0.97, 5.05, 0.76,
             ink="656b62", source="https://www.kmutt.ac.th/virtual/bangmod/#media-index=16"),
        Sign(("N11",), None, 1.8, 0.73, 17.55, 0.24),
    ),
    "N12": (Sign(("N12",), "N15", 2.1, 0.96, 20.5, 0.26),),
    "N14": (Sign(("N14",), "N15", 1.6, 0.75, 3.9, 0.23),),
    "N15": (
        Sign(("N15",), None, 2.0, 0.90, 31.25, 0.87),
        Sign(
            ("คณะศิลปศาสตร์", "SCHOOL OF LIBERAL ARTS"),
            None,
            7.2,
            1.02,
            3.36,
            ink="303738",
            backing="dddcd4",
        ),
    ),
    "N16": (
        Sign(
            ("LX", "LEARNING EXCHANGE"),
            "emerald-pond",
            7.2,
            0.72,
            10.55,
            0.45,
            1.02,
            ink="9a3d23",
            source="https://commons.wikimedia.org/wiki/File:KMUTT_Bangmod_6.jpg",
        ),
    ),
    "N17": (Sign(("N17",), "N19", 1.52, 0.65, 3.67, 0.30, backing=YELLOW),),
    "N18": (Sign(("N18",), "learning-garden", 1.5, 0.65, 2.92, 0.43, backing=YELLOW),),
    "N19": (
        Sign(("GMI+",), None, 2.8, 1.20, 5.75, 0.27, ink="274677"),
        Sign(
            (
                "Graduate School of Management and Innovation",
                "บัณฑิตวิทยาลัยการจัดการและนวัตกรรม",
            ),
            None,
            8.8,
            1.15,
            5.68,
            0.54,
        ),
    ),
    "N20": (Sign(("N20",), None, 1.65, 0.63, 5.75, 0.26, backing=YELLOW),),
    "S2-seminar": (
        Sign(("S2",), "S1", 1.34, 0.55, 2.7, 0.23, backing=ORANGE, ink=WHITE),
    ),
    "S3": (
        Sign(
            ("innovative learning institute",),
            None,
            7.6,
            0.74,
            5.08,
            ink="2b5750",
            backing="d8e0db",
        ),
        Sign(("S3",), None, 1.35, 0.60, 3.05, 0.22, ink=WHITE, backing=ORANGE),
    ),
    "S5": (Sign(("S", "5"), "S6", 0.65, 1.05, 2.42, 0.76, 1.10, WHITE, ORANGE, True),),
    "S6": (Sign(("S", "6"), "S5", 0.65, 1.05, 2.42, 0.24, 1.10, WHITE, ORANGE, True),),
    "S7": (Sign(("S7",), "S5", 0.9, 0.48, 3.40, 0.24, 0.61, WHITE, ORANGE),),
    "S8": (
        Sign(("S8",), (85, -274), 1.08, 0.49, 2.45, 0.30, 1.20, WHITE, ORANGE, True),
    ),
    "S9": (Sign(("S9",), None, 1.5, 0.62, 3.72, 0.56, ink=WHITE, backing=ORANGE),),
    "S10": (Sign(("S10",), "learning-garden", 2.65, 0.98, 3.15, 0.75, 0.24, "a43f2d"),),
    "S4-11-floors": (
        Sign(
            ("อาคารวิศววัฒนะ",),
            "learning-garden",
            5.1,
            0.72,
            7.3,
            0.31,
            ink="e0be72",
            backing="4d4443",
        ),
        Sign(
            ("ภาควิชาวิศวกรรมคอมพิวเตอร์", "Department of Computer Engineering"),
            "learning-garden",
            8.2,
            1.15,
            4.65,
            0.61,
            ink=WHITE,
        ),
    ),
    "S4-4-floors": (Sign(("S4",), "learning-garden", 1.65, 0.72, 13.45, 0.20),),
    "S11": (Sign(("S11",), "S15", 2.1, 0.92, 33.80, 0.75),),
    "S13": (Sign(("S13",), "sports-field", 2.3, 1.02, 26.25, 0.75),),
    "S14": (
        Sign(("S14",), None, 1.15, 0.60, 3.65, 0.26, backing=ORANGE, ink=WHITE),
        Sign(
            ("KMUTT",), (-216, -63), 43.0, 12.0, 13.0, ink="b86148",
            source="https://www.kmutt.ac.th/virtual/bangmod/#media-index=105", roof=True,
        ),
    ),
    "S15": (
        Sign(("S15",), None, 2.0, 0.79, 11.78, 0.24, 0.47),
        Sign(
            ("ภาควิชาวิศวกรรมเคมี", "DEPARTMENT OF CHEMICAL ENGINEERING"),
            None,
            12.0,
            1.27,
            10.62,
            0.82,
            0.47,
        ),
    ),
}


def sign_atlas(glb):
    if not features.check_feature("raqm"):
        raise RuntimeError("Pillow with RAQM is required to shape Thai lettering")
    signs = [sign for records in SIGNS.values() for sign in records]
    slots = 4
    slot_width, slot_height = 512, 144
    width = slots * slot_width
    height = 1 << (((len(signs) + slots - 1) // slots * slot_height) - 1).bit_length()
    atlas = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(atlas)
    fonts = Path(__file__).parent / "fonts"
    outfit = ImageFont.truetype(str(fonts / "Outfit.ttf"), 84)
    thai = ImageFont.truetype(str(fonts / "NotoSansThai.ttf"), 84)
    for font in (outfit, thai):
        font.set_variation_by_name("SemiBold")
    uv = {}
    for i, sign in enumerate(signs):
        ratio = sign.width / sign.height
        span_x = min(slot_width - 16, round((slot_height - 16) * ratio))
        span_y = round(span_x / ratio)
        x, y = (i % slots) * slot_width + 8, (i // slots) * slot_height + 8
        line_height = (span_y - 12) / len(sign.lines)
        for index, line in enumerate(sign.lines):
            font = (
                thai if any("\u0e00" <= char <= "\u0e7f" for char in line) else outfit
            )
            bounds = font.getbbox(line)
            scale = min(
                (span_x - 14) / (bounds[2] - bounds[0]),
                line_height * 0.92 / (bounds[3] - bounds[1]),
            )
            scaled = font.font_variant(size=max(1, int(font.size * scale)))
            scaled.set_variation_by_name("SemiBold")
            left, top, right, bottom = scaled.getbbox(line)
            draw.text(
                (
                    x + (span_x - right + left) / 2 - left,
                    y + 6 + (index + 0.5) * line_height - (top + bottom) / 2,
                ),
                line,
                font=scaled,
                fill="#" + sign.ink,
            )
        uv[sign] = (x / width, y / height, (x + span_x) / width, (y + span_y) / height)
    data = BytesIO()
    atlas.save(data, format="PNG", optimize=True)
    return glb.lettering(data.getvalue()), uv


def sign_post(edge, center, offset):
    return edge.band(center - 0.044, center + 0.044, offset - 0.077, offset - 0.003)


def building_signs(
    glb,
    id_,
    code,
    footprint,
    frontage,
    entry_target,
    footprints,
    exterior,
    ground,
    atlas,
):
    material, regions = atlas
    boards, labels, evidence = {}, [], []
    for sign in SIGNS.get(id_, ()):
        if sign.roof:
            if id_ != "S14":
                raise ValueError("No reviewed roof projection for this sign")
            letters = s14_lettering(sign)
            u1, v1, u2, v2 = regions[sign]
            east, north = sign.target
            uvs = [
                (u1 + (u2 - u1) * ((-z - north) / sign.width + 0.5),
                 v1 + (v2 - v1) * ((x - east) / sign.height + 0.5))
                for x, _, z in letters.positions
            ]
            labels.append(glb.primitive(letters, material, uvs=uvs))
            evidence.append({"lines": sign.lines, "source": sign.source, "placement": "curved roof"})
            continue
        target = frontage or entry_target
        if isinstance(sign.target, str):
            target = footprints[sign.target].representative_point()
        elif sign.target:
            target = Point(sign.target)
        segment = (
            fibo_front_edge(footprint, target)
            if id_ == "N9"
            else select_entry_wall(
                footprint, target, mapped_approach=id_ in {"N7", "S3"}
            )
        )
        edge = Wall(*segment)
        center = edge.length * sign.along
        half = min(sign.width / 2, edge.length * 0.43)
        center = max(half + 0.12, min(center, edge.length - half - 0.12))
        left, right = center - half, center + half
        bottom, top = sign.center - sign.height / 2, sign.center + sign.height / 2
        offset = next(
            (
                value
                for value in (sign.offset, 0.66 * sign.offset, 0.10, 1.5 * sign.offset)
                if exterior.covers(
                    edge.band(left, right, max(0.004, value - 0.067), value + 0.014)
                )
                and (not sign.pole or ground.covers(sign_post(edge, center, value)))
            ),
            None,
        )
        if offset is None:
            raise ValueError(f"{id_}: Sign position overlaps adjacent geometry")
        if sign.backing:
            board = boards.setdefault(sign.backing, Surface())
            plate = edge.band(left, right, offset - 0.065, offset)
            solid(board, plate, bottom, top)
            if sign.pole:
                solid(
                    boards.setdefault("757b78", Surface()),
                    sign_post(edge, center, offset),
                    0.02,
                    top,
                )
        letters = Surface()
        edge.panel(letters, left, right, bottom, top, offset + 0.004)
        u1, v1, u2, v2 = regions[sign]
        labels.append(
            glb.primitive(
                letters, material, uvs=((u1, v2), (u2, v2), (u2, v1), (u1, v1))
            )
        )
        evidence.append(
            {"lines": sign.lines, "source": sign.source or f"{ATLAS}{code}.html"}
        )
    return [
        *(
            glb.primitive(board, paint(glb, f"Sign backing #{color}", color))
            for color, board in boards.items()
        ),
        *labels,
    ], evidence
