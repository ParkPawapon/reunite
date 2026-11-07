"""Generate a per-building accuracy register from the reviewed source records."""

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from struct import unpack_from

ROOT = Path(__file__).resolve().parents[2]
STUDY = Path(__file__).resolve().parent
PUBLIC = ROOT / "apps/web/public/research/kmutt-bangmod"
CATALOG = ROOT / "apps/web/src/app/research/kmutt-bangmod/catalog.generated.json"
BASES = {
    "published-levels": "จำนวนชั้นตามเอกสาร; เมตรคำนวณ",
    "mapped-levels": "จำนวนชั้นตามแผนที่; เมตรคำนวณ",
    "at-least-levels": "พบการใช้ถึงชั้นนี้; เมตรคำนวณ",
    "assumed": "ความสูงสมมติ; ชั้นยังไม่ยืนยัน",
}


def generate():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    captures = json.loads((STUDY / "VIRTUAL-TOUR-CAPTURES.json").read_text(encoding="utf-8"))
    coverage = {row["featureId"]: row for row in captures["buildingReferenceCoverage"]}
    with (PUBLIC / "entrance-review.csv").open(encoding="utf-8-sig", newline="") as stream:
        entrances = {row["feature_id"]: row for row in csv.DictReader(stream)}
    raw = (PUBLIC / "kmutt-bangmod-detail.glb").read_bytes()
    length = unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20 + length])
    extras = {
        node["extras"]["featureId"]: node["extras"] for node in document["nodes"]
        if "featureId" in node.get("extras", {})
    }
    ids = {row["featureId"] for row in catalog}
    if len(ids) != 39 or ids != coverage.keys() or ids != entrances.keys() or ids != extras.keys():
        raise ValueError("Catalog, photos, entrance review and GLB must agree on 39 records")
    if any(row["heightBasis"] not in BASES for row in catalog):
        raise ValueError("New height evidence type needs explicit review")
    if any(row["field_verification"] != "required" for row in entrances.values()):
        raise ValueError("New field-verification evidence needs explicit review")
    counts = Counter(row["heightBasis"] for row in catalog)
    nominal = ", ".join(row["featureId"] for row in catalog if row["heightBasis"] == "assumed")
    schematic = ", ".join(row["featureId"] for row in catalog if row["footprintBasis"] != "mapped")
    missing_signs = ", ".join(row["featureId"] for row in catalog if not extras[row["featureId"]].get("signage"))
    lines = [
        "# ทะเบียนความแม่นยำรายอาคาร",
        "",
        "สร้างจาก catalog, GLB, ทะเบียนภาพ และทะเบียนทางเข้าใน repository โดย `audit_accuracy.py`",
        "ตัวเลขเมตรในตารางคือค่าที่โมเดลใช้อยู่ ไม่ใช่ผลวัดหน้างาน และไม่มีอาคารใดได้รับการรับรองความแม่นยำเชิงสำรวจ",
        "",
        f"จำนวนชั้นตามเอกสาร {counts['published-levels']} รายการ ตามแผนที่ {counts['mapped-levels']} รายการ "
        f"พบหลักฐานการใช้ถึงชั้นหนึ่งเป็นอย่างน้อย {counts['at-least-levels']} รายการ และความสูงสมมติ {counts['assumed']} รายการ",
        "",
        f"ความสูงสมมติ: {nominal}",
        "",
        f"ฐานอาคารที่ตีความจากผัง: {schematic}",
        "",
        f"ยังไม่มีหลักฐานเพียงพอสำหรับป้ายจริงในโมเดล: {missing_signs}",
        "",
        "| อาคาร | ชื่อ | สูงในโมเดล (ม.) | ชั้นที่มีหลักฐาน | ฐานความสูง | ฐานอาคาร | หลักฐาน |",
        "| --- | --- | ---: | ---: | --- | --- | --- |",
    ]
    for row in catalog:
        id_ = row["featureId"]
        source = f"[ภาพ]({coverage[id_]['atlasSource']})"
        if row["heightSource"]:
            source += f" / [ชั้น]({row['heightSource']})"
        levels = row["floorCount"] or "—"
        footprint = "ตามแผนที่เปิด" if row["footprintBasis"] == "mapped" else "ตีความจากผัง"
        lines.append(
            f"| {id_} | {row['nameTh']} | {row['heightM']:g} | {levels} | "
            f"{BASES[row['heightBasis']]} | {footprint} | {source} |"
        )
    lines += [
        "",
        "## ช่องว่างของหลักฐานภาพ",
        "",
        f"ทะเบียนมี {captures['registeredFrames']:,} ภาพจาก {captures['distinctCameras']} กล้อง "
        f"ซึ่งเป็นบริบทภายนอก/หลังคา/มุมสูง {captures['exteriorContextCameras']} กล้อง "
        "จำนวนนี้ไม่เท่ากับการมีภาพรูปด้านครบสี่ทิศทุกอาคาร กล้องหลายจุดเห็นเพียงบริเวณเดียวและมีต้นไม้หรืออาคารอื่นบัง",
        "วันที่เก็บภาพจากเว็บไม่ใช่วันที่ถ่ายภาพต้นฉบับ และการเปิดภาพได้ไม่ใช่ใบอนุญาตให้นำภาพมาทำ texture หรือเผยแพร่ซ้ำ",
        "ด้านหลัง ความลึกช่องเปิด ป้าย ท่อ/อุปกรณ์บนหลังคา และตำแหน่งต้นไม้ที่ไม่เห็นยังต้องตรวจหลักฐานเพิ่มเติม",
        "แม้มีภาพแล้ว รูปด้านหลายส่วนยังใช้จังหวะช่องเปิดตามโปรไฟล์ซ้ำ ไม่ใช่การถอดตำแหน่งหน้าต่างทุกบานจากแบบจริง "
        "รอบล่าสุดเพิ่มโครงระแนงโค้งของ N13 โถงกระจกและบันได N10 ครีบกันแดด N20 และโครงถัก S14 ตามภาพสารบบแล้ว "
        "มิติและจำนวนซี่ยังคงเป็นการตีความจากภาพ ไม่ใช่แบบสำรวจ และส่วนอื่นยังไม่ได้ถอดช่องเปิดทุกบาน",
        "ต้นไม้ในฉากมีทั้งตำแหน่งจากข้อมูลเปิดและตำแหน่งจัดประกอบเพื่อแสดงบริบท จึงยังใช้ยืนยันภูมิทัศน์จริงทั้งหมดไม่ได้",
        "",
        "## จุดปลายทางเดิน",
        "",
        "ระยะช่องว่างด้านล่างวัดจากข้อมูลแผนที่ถึงฐานอาคารในโมเดล ไม่ใช่ค่าคลาดเคลื่อน GPS หรือระยะถึงประตูจริง",
        "",
        "| อาคาร | จุดปลายทางปัจจุบัน | ห่างฐานในแผนที่ (ม.) | การยืนยันหน้างาน |",
        "| --- | --- | ---: | --- |",
    ]
    for row in catalog:
        entry = entrances[row["featureId"]]
        kind = {
            "mapped-entrance": "ประตูที่มี tag ในแผนที่เปิด",
            "approach": "จุดเข้าถึงใกล้อาคาร",
            "missing-connection": "ยังไม่มีทางเชื่อมในโครงข่าย",
        }.get(entry["route_endpoint_basis"], entry["route_endpoint_basis"])
        gap = entry["gap_to_footprint_m"] or "—"
        lines.append(f"| {row['featureId']} | {kind} | {gap} | ยังต้องตรวจ |")
    lx = extras["N16"]
    lines += [
        "",
        "## ระยะที่ต้องวัดเพื่อยืนยันความเหมือนจริง",
        "",
        "- พิกัดมุมอาคารและทิศจริง โดยใช้จุดควบคุมร่วมกับระบบพิกัดของโครงการ",
        "- ระดับพื้นอ้างอิง ความสูงแต่ละชั้น ระดับหลังคาและขอบ parapet แยกกัน",
        "- ความกว้าง/สูง/ลึกของช่องเปิด ช่วงเสา ระยะยื่นชายคาและขั้นลาน",
        "- ภาพทั้งสี่ด้านที่ระบุทิศและวันที่ รวมถึงหลังคาจากมุมที่เข้าถึงได้อย่างถูกต้อง",
        "- พิกัดประตูจริง ทางลาด บันได จุดข้ามถนน และเงื่อนไขการเข้าใช้งานทางเดิน",
        "",
        f"LX ใช้ความสูงในโมเดล {lx['heightM']:g} ม. ขณะที่ข้อมูลเดิมของโครงการบันทึกความสูงเผยแพร่ "
        f"{lx['publishedTotalHeightM']:g} ม. พร้อมคำอธิบายว่ารวมชั้นใต้ดินและหลังคา "
        "ค่าทั้งสองยังใช้ระดับอ้างอิงต่างกัน จึงยังนำมาแทนกันโดยตรงไม่ได้ ต้องยืนยัน datum ก่อนแก้สัดส่วนจากตัวเลขนี้",
        "",
        "ความคลาดเคลื่อนการบีบอัด GLB ไม่เกิน 2 มม. เป็นการเทียบไฟล์เว็บกับโมเดลต้นฉบับ "
        "ไม่ใช่การรับรองตำแหน่งหรือขนาดอาคารจริง การเพิ่มความเร็วอินเทอร์เน็ตไม่ทำให้หลักฐานด้านนี้แม่นยำขึ้น",
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = STUDY / "ACCURACY-REGISTER.md"
    result = generate()
    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != result:
            parser.exit(1, "Stale building accuracy register\n")
    else:
        output.write_text(result, encoding="utf-8", newline="\n")
    print("Checked 39 building records against catalog, GLB, image and entrance registers")


if __name__ == "__main__":
    main()
