-- Reunite reference catalog for lost and found reports at KMUTT Bangmod.
-- Building, area and gate names follow the checked-in campus map catalog and anchors.
-- Campus reference: https://www.kmutt.ac.th/about-kmutt/campus/
-- Apply as the release operator after migrations. Names are the seed's natural keys.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.categories, public.locations IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO public.categories (category_name)
SELECT seed.name
FROM (VALUES
    (1, 'อุปกรณ์อิเล็กทรอนิกส์ (Electronics)'),
    (2, 'บัตรนักศึกษาและเอกสารสำคัญ (Student ID & Documents)'),
    (3, 'กระเป๋าและสิ่งของพกพา (Bags & Accessories)'),
    (4, 'กุญแจและคีย์การ์ด (Keys & Access Cards)'),
    (5, 'ขวดน้ำและของใช้ส่วนตัว (Personal Items)'),
    (6, 'อื่น ๆ (Other items)')
) AS seed(sort_order, name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories AS existing WHERE existing.category_name = seed.name
)
ORDER BY seed.sort_order;

INSERT INTO public.locations (location_name, detail)
SELECT seed.name, seed.detail
FROM (VALUES
    (1, 'N16 · อาคารการเรียนรู้พหุวิทยาการ (LX)', 'มจธ. บางมด · Learning Exchange (LX)'),
    (2, 'N10 · อาคารสำนักหอสมุด', 'มจธ. บางมด · KMUTT Library'),
    (3, 'N17 · อาคารเรียนรวม 2 (CB2)', 'มจธ. บางมด · Classroom Building 2'),
    (4, 'N7 · อาคารปฏิบัติการพื้นฐานทางวิทยาศาสตร์', 'มจธ. บางมด · Fundamental Science Laboratory'),
    (5, 'N9 · อาคารสถาบันวิทยาการหุ่นยนต์ภาคสนาม (FIBO)', 'มจธ. บางมด · Institute of Field Robotics (FIBO)'),
    (6, 'S3 · อาคารสถาบันนวัตกรรมการเรียนรู้เฉลิมพระเกียรติ 80 พรรษา', 'มจธ. บางมด · Innovation Learning Institute (Darunsikkhalai)'),
    (7, 'N1 · อาคารศูนย์ต้อนรับ', 'มจธ. บางมด · Welcome Center'),
    (8, 'N2 · อาคารสำนักงานอธิการบดี', 'มจธ. บางมด · Office of the President'),
    (9, 'N3 · อาคารภาควิชาเคมี', 'มจธ. บางมด · Chemistry'),
    (10, 'N4 · อาคารภาควิชาฟิสิกส์–คณิตศาสตร์', 'มจธ. บางมด · Physics and Mathematics'),
    (11, 'N5 · อาคารศูนย์เครื่องมือวิทยาศาสตร์เพื่อมาตรฐานและอุตสาหกรรม', 'มจธ. บางมด · Scientific Instrument Center'),
    (12, 'N6 · อาคารภาควิชาจุลชีววิทยา', 'มจธ. บางมด · Microbiology'),
    (13, 'N8 · สถานีสูบน้ำ', 'มจธ. บางมด · Water Pump Station'),
    (14, 'N11 · อาคารคณะเทคโนโลยีสารสนเทศ', 'มจธ. บางมด · School of Information Technology'),
    (15, 'N12 · อาคารอเนกประสงค์', 'มจธ. บางมด · Utility Exchange (UX)'),
    (16, 'N13 · อาคาร Workshop และเรือนกระจก', 'มจธ. บางมด · Workshop and Greenhouse'),
    (17, 'N14 · อาคารไฟฟ้าแรงสูง', 'มจธ. บางมด · High Voltage Laboratory'),
    (18, 'N15 · อาคารเรียนและปฏิบัติการทางศิลปศาสตร์', 'มจธ. บางมด · School of Liberal Arts'),
    (19, 'N18 · อาคารปฏิบัติการวิศวกรรมการผลิต 4', 'มจธ. บางมด · Production Engineering Laboratory 4'),
    (20, 'N19 · อาคารปฏิบัติการวิศวกรรมการผลิต 5', 'มจธ. บางมด · Production Engineering Laboratory 5'),
    (21, 'N20 · อาคารเรียนรวม 1 (CB1)', 'มจธ. บางมด · Classroom Building 1'),
    (22, 'S1 · อาคารวิศวกรรมเครื่องกล 4', 'มจธ. บางมด · Mechanical Engineering Building 4'),
    (23, 'S2 · อาคารจอดรถ', 'มจธ. บางมด · Parking Building'),
    (24, 'S2 · อาคารสัมมนา', 'มจธ. บางมด · Seminar Building'),
    (25, 'S4 · อาคารวิศววัฒนะ 3 ชั้น', 'มจธ. บางมด · Wissawa Wattana – 3 floors'),
    (26, 'S4 · อาคารวิศววัฒนะ 4 ชั้น', 'มจธ. บางมด · Wissawa Wattana – 4 floors'),
    (27, 'S4 · อาคารวิศววัฒนะ 8 ชั้น', 'มจธ. บางมด · Wissawa Wattana – 8 floors'),
    (28, 'S4 · อาคารวิศววัฒนะ 11 ชั้น', 'มจธ. บางมด · Wissawa Wattana – 11 floors'),
    (29, 'S5 · บ้านธรรมรักษา 2', 'มจธ. บางมด · Dhammaraksa Residence Hall 2'),
    (30, 'S6 · บ้านธรรมรักษา 1', 'มจธ. บางมด · Dhammaraksa Residence Hall 1'),
    (31, 'S7 · อาคารพัฒนาเด็กเล็ก มจธ.', 'มจธ. บางมด · KMUTT Child Development Building'),
    (32, 'S8 · อาคารวิจัยและพัฒนาเทคโนโลยีวัสดุ', 'มจธ. บางมด · Materials Technology Research and Development'),
    (33, 'S9 · อาคารเรียนและปฏิบัติการคณะพลังงาน สิ่งแวดล้อมและวัสดุ', 'มจธ. บางมด · Energy, Environment and Materials'),
    (34, 'S10 · อาคารสังคมสีเขียว มจธ.', 'มจธ. บางมด · Green Society Building'),
    (35, 'S11 · อาคารเรียนรวม 5', 'มจธ. บางมด · Classroom Building 5 (CB5)'),
    (36, 'S12 · อาคารเรียนรวม 4', 'มจธ. บางมด · Classroom Building 4'),
    (37, 'S13 · อาคารเรียนรวม 3', 'มจธ. บางมด · Classroom Building 3'),
    (38, 'S14 · อาคารพระจอมเกล้าราชานุสรณ์ 190 ปี', 'มจธ. บางมด · King Mongkut 190th Anniversary Memorial'),
    (39, 'S15 · อาคารภาควิชาวิศวกรรมเคมี', 'มจธ. บางมด · Chemical Engineering'),
    (40, 'สระมรกต', 'มจธ. บางมด'),
    (41, 'สระน้ำหลังลานพระจอม', 'มจธ. บางมด'),
    (42, 'สวนการเรียนรู้', 'มจธ. บางมด'),
    (43, 'สวนเฉลิมพระเกียรติ', 'มจธ. บางมด'),
    (44, 'สนามกีฬา', 'มจธ. บางมด'),
    (45, 'ลู่วิ่ง', 'มจธ. บางมด'),
    (46, 'ประตู 1 ถนนประชาอุทิศ', 'มจธ. บางมด'),
    (47, 'ประตู 2 ถนนพุทธบูชา', 'มจธ. บางมด'),
    (48, 'ประตู 3 ถนนพุทธบูชา', 'มจธ. บางมด'),
    (49, 'ประตู 4 ถนนพุทธบูชา', 'มจธ. บางมด'),
    (50, 'บริเวณศูนย์อาหาร', 'มจธ. บางมด')
) AS seed(sort_order, name, detail)
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations AS existing WHERE existing.location_name = seed.name
)
ORDER BY seed.sort_order;

COMMIT;
