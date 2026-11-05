import { buildings } from './catalog';
import map from './anchors.generated.json';

type Anchor = Omit<(typeof map.features)[number], 'world' | 'wgs84'> & {
  world: readonly [number, number, number];
  wgs84: readonly [number, number];
};

export type Place = Anchor & {
  label: string;
  aliases: string;
  building?: (typeof buildings)[number];
};

const drawOrder: Record<string, number> = {
  boundary: 0,
  track: 1,
  sport: 2,
  green: 2,
  water: 3,
  building: 4,
};
export const outlines = [...map.features].sort(
  (a, b) => (drawOrder[a.kind] ?? 1) - (drawOrder[b.kind] ?? 1),
);
export const campusViewBox = map.viewBox.join(' ');
export const campusRoutes = map.routes;
const byId = new Map(
  buildings.map((building) => [building.featureId, building]),
);
const areaAliases: Record<string, string> = {
  'emerald-pond': 'Emerald Pond Sa Morakot',
  'monument-pond': 'Monument pond สระลานพระจอม',
  'learning-garden': 'Learning Garden LG',
  'commemoration-park': 'Commemoration Park',
  'sports-field': 'สนามฟุตบอล football sports field',
  'running-track': 'ลู่วิ่ง running track athletics',
};
const buildingAliases: Record<string, string> = {
  N9: 'ฟีโบ้ ฟิโบ้',
  N10: 'ห้องสมุด library lib',
  N16: 'แอลเอ็กซ์',
  S4: 'วิศวะวัฒนา วิศววัฒนะ witsawa wattana',
};

export const places: readonly Place[] = map.features
  .filter((feature) => feature.kind !== 'boundary')
  .map((feature) => {
    const building = byId.get(feature.id);
    const [x, y, z] = feature.world;
    const [lat, lon] = feature.wgs84;
    if (
      x === undefined ||
      y === undefined ||
      z === undefined ||
      lat === undefined ||
      lon === undefined
    ) {
      throw new Error(`Incomplete campus anchor: ${feature.id}`);
    }
    return {
      ...feature,
      world: [x, y, z],
      wgs84: [lat, lon],
      label: building ? `${building.code} · ${feature.nameTh}` : feature.nameTh,
      aliases: building
        ? `${building.nameEn} ${buildingAliases[building.code] ?? ''}`
        : (areaAliases[feature.id] ??
          (feature.kind === 'gate' ? feature.id.replace('-', ' ') : '')),
      building,
    };
  });
export const placesById = new Map(places.map((place) => [place.id, place]));

export function placeFragment(id: string) {
  return `#${new URLSearchParams({ place: id })}`;
}

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50))
    .replace(/\b([ns])[\s-]+(\d+)\b/g, '$1$2');

export function findPlaces(query: string) {
  const tokens = normalize(query)
    .trim()
    .split(/[\s·,]+/)
    .filter(Boolean);
  const exactCode = tokens.find((token) => /^[ns]\d+$/u.test(token));
  return places.filter((place) => {
    if (exactCode && normalize(place.building?.code ?? '') !== exactCode)
      return false;
    const description = normalize(`${place.label} ${place.aliases}`);
    return tokens.every((token) => description.includes(token));
  });
}

export function placeSatelliteUrl(place: Place) {
  const parameters = new URLSearchParams({
    api: '1',
    map_action: 'map',
    center: place.wgs84.join(','),
    zoom: '19',
    basemap: 'satellite',
  });
  return `https://www.google.com/maps/@?${parameters}`;
}
