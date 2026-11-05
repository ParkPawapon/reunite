import catalog from './catalog.generated.json';

type Source = {
  kind: string;
  url: string;
  id?: string;
  upstream?: string;
};

export type Building = Omit<(typeof catalog)[number], 'footprintSources'> & {
  footprintSources: readonly Source[];
};
export const buildings: readonly Building[] = catalog;
export const assets = '/research/kmutt-bangmod';
export const modelUrl = `${assets}/kmutt-bangmod.glb`;
export const detailedModelUrl = `${assets}/kmutt-bangmod-detail.glb`;
export const detailedWebModelUrl = `${assets}/kmutt-bangmod-web.glb`;
export const campusTourUrl = 'https://www.kmutt.ac.th/virtual/bangmod/';
export const satelliteUrl =
  'https://www.google.com/maps/@?api=1&map_action=map&center=13.65145%2C100.49385&zoom=17&basemap=satellite';

export const heightBasis: Record<string, string> = {
  'published-levels': 'จำนวนชั้นจากมหาวิทยาลัย × ความสูงต่อชั้นโดยประมาณ',
  'mapped-levels': 'จำนวนชั้นจาก OpenStreetMap × ความสูงต่อชั้นโดยประมาณ',
  'at-least-levels': 'อ้างอิงชั้นสูงสุดที่ยืนยันได้ × ความสูงต่อชั้นโดยประมาณ',
  assumed: 'ค่าประมาณสำหรับแสดงมวลอาคาร',
};
