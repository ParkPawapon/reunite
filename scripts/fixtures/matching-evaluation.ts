import type { MatchAssessment } from '../../apps/web/src/modules/matching/domain/matching';
import type { ComparableReportText } from '../../apps/web/src/modules/matching/domain/text-similarity';

type Scenario = {
  id: string;
  sameItem: boolean;
  lost: ComparableReportText;
  found: ComparableReportText;
  assessment: MatchAssessment;
};
type Evidence = MatchAssessment['evidence'][number];

const lostDate = '2026-06-10T04:00:00Z';
const foundDate = '2026-06-10T06:00:00Z';
function scenario(
  id: string,
  sameItem: boolean,
  lost: [
    title: string,
    description: string | null,
    category: string,
    location: string,
  ],
  found: [
    title: string,
    description: string | null,
    category: string,
    location: string,
  ],
  decision: MatchAssessment['decision'],
  evidence: Evidence[] = [],
): Scenario {
  const [lostTitle, lostDescription, lostCategory, lostLocation] = lost;
  const [foundTitle, foundDescription, foundCategory, foundLocation] = found;
  return {
    id,
    sameItem,
    lost: {
      title: lostTitle,
      description: lostDescription,
      category: lostCategory,
      location: lostLocation,
      eventDatetime: lostDate,
    },
    found: {
      title: foundTitle,
      description: foundDescription,
      category: foundCategory,
      location: foundLocation,
      eventDatetime: foundDate,
    },
    assessment: {
      decision,
      summary:
        'Simulated provider response for an independently labelled fictional pair.',
      evidence,
      missingEvidence: [],
      imageComparison: 'none',
    },
  };
}

const agree = (attribute: Evidence['attribute'], detail: string): Evidence => ({
  attribute,
  detail,
  relation: 'agree',
});
const conflict = (
  attribute: Evidence['attribute'],
  detail: string,
): Evidence => ({ attribute, detail, relation: 'conflict' });

// Labels describe the physical identity in each fictional scenario. The
// assessments deliberately include provider mistakes to exercise the display gate.
export const matchingScenarios = [
  scenario(
    'bottle-scratch',
    true,
    ['กระบอกน้ำฟ้า', 'ลายหมี รอยขูดข้างฝา', 'ของใช้', 'N7'],
    ['ขวดน้ำสีฟ้า', 'รอยขูดข้างฝา มีลายหมี', 'ของใช้', 'N7'],
    'possible_match',
    [
      agree('color', 'ฟ้า'),
      agree('damage', 'รอยขูดข้างฝา'),
      agree('marking', 'ลายหมี'),
    ],
  ),
  scenario(
    'umbrella-tie',
    true,
    ['ร่มพับสีน้ำเงิน', 'สายรัดสีฟ้าเย็บด้ายขาว', 'ของใช้', 'N7'],
    ['พับร่มสีน้ำเงิน', 'สายรัดฟ้ามีด้ายสีขาว', 'ของใช้', 'S3'],
    'possible_match',
    [agree('color', 'สีน้ำเงิน'), agree('marking', 'สายรัดฟ้าเย็บด้ายขาว')],
  ),
  scenario(
    'calculator-typo',
    true,
    ['Casio fx-991ex', 'สติ๊กเกอร์ดาวสีเขียว', 'อิเล็กทรอนิกส์', 'LX'],
    ['Casio fx991EX', 'ดาวสีเขียวหลังฝา', 'อิเล็กทรอนิกส์', 'LX'],
    'possible_match',
    [
      agree('brand', 'Casio'),
      agree('model', 'fx-991ex'),
      agree('marking', 'ดาวสีเขียว'),
    ],
  ),
  scenario(
    'bilingual-pencil-case',
    true,
    ['กระเป๋าดินสอผ้าสีเขียว', null, 'เครื่องเขียน', 'LX'],
    ['Green canvas pencil pouch', null, 'ของใช้', 'LX'],
    'insufficient_evidence',
  ),
  scenario(
    'thin-description',
    true,
    ['กระเป๋าผ้าสีดำ', null, 'ของใช้', 'N7'],
    ['กระเป๋าผ้าดำ', null, 'ของใช้', 'N7'],
    'possible_match',
    [
      agree('color', 'ดำ'),
      agree('location', 'N7'),
      agree('object_type', 'กระเป๋าผ้า'),
    ],
  ),
  scenario(
    'wrong-category-model',
    true,
    ['คีย์บอร์ด K380', 'สติกเกอร์รูปแมวที่ปุ่ม Esc', 'อิเล็กทรอนิกส์', 'N10'],
    ['Logitech K380', 'cat sticker on Esc', 'ของใช้', 'N10'],
    'possible_match',
    [agree('model', 'K380'), agree('marking', 'สติกเกอร์แมวที่ Esc')],
  ),
  scenario(
    'key-cover',
    true,
    ['กุญแจหอ', 'ปอกซิลิโคนแดง มีรอยตัดมุม', 'กุญแจ', 'S3'],
    ['พวงกุญแจ', 'ปลอกแดงมุมมีรอยตัด', 'กุญแจ', 'S3'],
    'possible_match',
    [agree('color', 'แดง'), agree('damage', 'รอยตัดมุมปลอก')],
  ),
  scenario(
    'same-device-new-location',
    true,
    ['หูฟัง Galaxy Buds2', 'เคสมีรอยบิ่นด้านบานพับ', 'อิเล็กทรอนิกส์', 'N7'],
    ['Buds2 ขาว', 'บิ่นตรงบานพับ', 'อิเล็กทรอนิกส์', 'N10'],
    'possible_match',
    [agree('model', 'Buds2'), agree('damage', 'บิ่นตรงบานพับ')],
  ),
  scenario(
    'same-bottle-different-mark',
    false,
    ['ขวด Kinto ขาว', 'แปะเทปดำ', 'ของใช้', 'N7'],
    ['ขวด Kinto ขาว', 'แปะเทปแดง', 'ของใช้', 'N7'],
    'possible_match',
    [
      agree('brand', 'Kinto'),
      agree('color', 'ขาว'),
      conflict('marking', 'เทปคนละสี'),
    ],
  ),
  scenario(
    'near-model',
    false,
    ['ที่ชาร์จ Anker A2147', null, 'อิเล็กทรอนิกส์', 'LX'],
    ['ที่ชาร์จ Anker A2145', null, 'อิเล็กทรอนิกส์', 'LX'],
    'different_item',
    [conflict('model', 'A2147 กับ A2145')],
  ),
  scenario(
    'identical-units',
    false,
    ['เมาส์ M350 สีขาว', null, 'อิเล็กทรอนิกส์', 'LX'],
    ['เมาส์ Logitech M350 สีขาว', null, 'อิเล็กทรอนิกส์', 'LX'],
    'possible_match',
    [agree('color', 'ขาว'), agree('model', 'M350')],
  ),
  scenario(
    'same-kind-only',
    false,
    ['กระเป๋าเป้ดำ', null, 'ของใช้', 'N7'],
    ['เป้ดำ', 'มีช่องข้างสองช่อง', 'ของใช้', 'N7'],
    'possible_match',
    [agree('color', 'ดำ'), agree('object_type', 'กระเป๋าเป้')],
  ),
  scenario(
    'unrelated-items',
    false,
    ['หมวกไหมพรม', null, 'เสื้อผ้า', 'N10'],
    ['สาย HDMI', null, 'อิเล็กทรอนิกส์', 'S3'],
    'different_item',
  ),
  scenario(
    'opposite-contents',
    false,
    ['ซองผ้าสีน้ำเงิน', 'ข้างในมีไม้บรรทัด', 'เครื่องเขียน', 'S3'],
    ['ซองผ้าสีน้ำเงิน', 'ข้างในมีแว่นตา', 'ของใช้', 'S3'],
    'different_item',
    [conflict('contents', 'ไม้บรรทัดกับแว่นตา')],
  ),
  scenario(
    'similar-earbuds',
    false,
    ['หูฟัง Soundcore ขาว', 'เคสขีดรูปกากบาท', 'อิเล็กทรอนิกส์', 'N7'],
    ['Soundcore ดำ', 'มีเทปรูปกากบาท', 'อิเล็กทรอนิกส์', 'N7'],
    'different_item',
    [conflict('color', 'ขาวกับดำ')],
  ),
  scenario(
    'different-keysets',
    false,
    ['กุญแจสองดอกห่วงเงิน', 'พวงยางปลาวาฬ', 'กุญแจ', 'N7'],
    ['กุญแจสามดอกห่วงเงิน', 'พวงยางสิงโต', 'กุญแจ', 'N7'],
    'different_item',
    [conflict('marking', 'ปลาวาฬกับสิงโต')],
  ),
] satisfies Scenario[];
