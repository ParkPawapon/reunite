import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildings } from '@/app/research/kmutt-bangmod/catalog';
import {
  readLiveFix,
  walkProgress,
} from '@/app/research/kmutt-bangmod/live-position';
import {
  findPlaces,
  placeSatelliteUrl,
  placesById,
} from '@/app/research/kmutt-bangmod/places';
import { findWalk } from '@/app/research/kmutt-bangmod/walking';

const publicDir = new URL(
  '../../apps/web/public/research/kmutt-bangmod/',
  import.meta.url,
);

it('distinguishes similar building codes and links to the selected outdoor anchor', () => {
  expect(findPlaces('N๑').map(({ id }) => id)).toEqual(['N1']);
  expect(findPlaces('N-๑๖').map(({ id }) => id)).toEqual(['N16']);
  expect(findPlaces('ฟีโบ้').map(({ id }) => id)).toEqual(['N9']);
  expect(findPlaces('S4 11').map(({ id }) => id)).toEqual(['S4-11-floors']);
  const pond = placesById.get('emerald-pond');
  expect(findPlaces('emerald pond')).toEqual([pond]);
  if (!pond) throw new Error('Missing Emerald Pond');
  const satellite = new URL(placeSatelliteUrl(pond));
  expect(satellite.origin).toBe('https://www.google.com');
  expect(satellite.searchParams.get('center')).toBe(pond.wgs84.join(','));
  expect(satellite.searchParams.get('basemap')).toBe('satellite');
});

it('routes from the mapped N7 approach to the S3 entrance on continuous mapped ways', () => {
  const route = findWalk('N7', 'S3');
  const reverse = findWalk('S3', 'N7');
  if (!route || !reverse) throw new Error('Missing N7–S3 route');
  expect(route.from).toMatchObject({
    basis: 'approach',
    sourceNode: 4202450897,
    gapMetres: 6.6,
  });
  expect(route.to).toMatchObject({
    basis: 'mapped-entrance',
    sourceNode: 4200363888,
  });
  expect(route.segments[0]).toMatchObject({ kind: 'walk', way: 420306209 });
  expect(route.segments.at(-1)).toMatchObject({ kind: 'walk', way: 420050693 });
  expect(route.segments.some(({ kind }) => kind === 'road')).toBe(true);
  expect(route.metres).toBeCloseTo(358.73, 2);
  expect(reverse.metres).toBeCloseTo(route.metres, 6);
  for (const [index, segment] of route.segments.entries()) {
    const next = route.segments[index + 1];
    if (next) expect(segment.to).toEqual(next.from);
    expect(segment.metres).toBeGreaterThan(0);
    expect(segment.way).not.toBe(935209108);
  }
});

it('shows Gate 2 in search without routing through its private access', () => {
  expect(placesById.get('gate-2')?.kind).toBe('gate');
  expect(findWalk('gate-2', 'S3')).toBeNull();
  expect(findWalk('S3', 'gate-2')).toBeNull();
  expect(findWalk('S3', 'S3')).toBeNull();
  expect(findWalk('constructor', 'S3')).toBeNull();
  for (const id of ['gate-1', 'gate-3', 'gate-4']) {
    expect(findWalk(id, 'S3')?.from.basis).toBe('mapped-gate');
  }
  expect(findWalk('learning-garden', 'S3')?.from).toMatchObject({
    basis: 'approach',
    sourceNode: 4202512546,
  });
  expect(findWalk('N19', 'S3')).toBeNull();
});

it('places live GPS fixes in the same metre grid as the mapped S3 entrance', () => {
  const route = findWalk('N7', 'S3');
  const destination = route?.segments.at(-1)?.to;
  const now = 1_000_000;
  const position = {
    timestamp: now,
    coords: {
      latitude: 13.65017,
      longitude: 100.4951709,
      accuracy: 4,
      speed: 1.1,
      heading: 72,
    },
  };
  const result = readLiveFix(position, now);
  if (!route || !destination || result.status !== 'live')
    throw new Error('Missing S3 position');
  expect(result.fix.point[0]).toBeCloseTo(destination[0], 1);
  expect(result.fix.point[1]).toBeCloseTo(destination[1], 1);
  expect(result.fix.heading).toBe(72);
  expect(walkProgress(route, result.fix).status).toBe('near-destination');
  expect(
    readLiveFix(
      { ...position, coords: { ...position.coords, speed: null } },
      now,
    ),
  ).toMatchObject({ status: 'live', fix: { heading: null } });
  expect(readLiveFix(position, now + 30_000).status).toBe('stale');
  expect(
    readLiveFix(
      { ...position, coords: { ...position.coords, longitude: Number.NaN } },
      now,
    ).status,
  ).toBe('stale');
  expect(
    readLiveFix(
      { ...position, coords: { ...position.coords, accuracy: 140 } },
      now,
    ).status,
  ).toBe('imprecise');
  expect(
    readLiveFix(
      { ...position, coords: { ...position.coords, latitude: 13.75 } },
      now,
    ).status,
  ).toBe('outside');
});

it('estimates remaining distance only for an unambiguous fix near the planned path', () => {
  const route = findWalk('N7', 'S3');
  const start = route?.segments[0]?.from;
  if (!route || !start) throw new Error('Missing N7 approach');
  const fix = { point: start, accuracy: 4, heading: null };
  const progress = walkProgress(route, fix);
  expect(progress).toEqual({ status: 'on-route', remaining: route.metres });
  expect(walkProgress(route, { ...fix, accuracy: 40 }).status).toBe(
    'imprecise',
  );
  expect(walkProgress(route, { ...fix, point: [-200, 30] }).status).toBe(
    'away',
  );
  const parallel = {
    ...route,
    metres: 205,
    segments: [
      { from: [0, 0], to: [100, 0], metres: 100, kind: 'walk', way: 1 },
      { from: [100, 0], to: [100, 5], metres: 5, kind: 'walk', way: 2 },
      { from: [100, 5], to: [0, 5], metres: 100, kind: 'walk', way: 3 },
    ],
  } satisfies typeof route;
  expect(walkProgress(parallel, { ...fix, point: [30, 2] }).status).toBe(
    'ambiguous',
  );
});

it.each([
  'kmutt-bangmod.glb',
  'kmutt-bangmod-detail.glb',
  'kmutt-bangmod-web.glb',
])(
  'ships %s with building nodes that match the reviewed geographic data',
  (filename) => {
    const compact = filename === 'kmutt-bangmod-web.glb';
    const file = readFileSync(new URL(filename, publicDir));
    expect(file.subarray(0, 4).toString()).toBe('glTF');
    expect(file.readUInt32LE(4)).toBe(2);
    expect(file.readUInt32LE(8)).toBe(file.length);
    expect(file.subarray(16, 20).toString()).toBe('JSON');
    const jsonEnd = 20 + file.readUInt32LE(12);
    const scene = JSON.parse(file.subarray(20, jsonEnd).toString());
    const binarySize = file.readUInt32LE(jsonEnd);
    expect(file.subarray(jsonEnd + 4, jsonEnd + 8).toString()).toBe('BIN\0');
    expect(file.length).toBe(jsonEnd + 8 + binarySize);
    expect(scene.buffers).toEqual([{ byteLength: expect.any(Number) }]);
    expect(scene.asset.copyright).toContain('© OpenStreetMap contributors');
    if (filename !== 'kmutt-bangmod.glb') {
      expect(scene.extensionsRequired).toEqual(['KHR_mesh_quantization']);
      expect(scene.images).toEqual([
        { bufferView: expect.any(Number), mimeType: 'image/png' },
      ]);
      const view = scene.bufferViews[scene.images[0].bufferView];
      expect(
        file
          .subarray(
            jsonEnd + 8 + view.byteOffset,
            jsonEnd + 16 + view.byteOffset,
          )
          .toString('hex'),
      ).toBe('89504e470d0a1a0a');
    } else {
      expect(scene.images).toBeUndefined();
    }

    const snapshot = JSON.parse(
      readFileSync(new URL('kmutt-bangmod.geojson', publicDir), 'utf8'),
    ) as {
      features: {
        id: string;
        properties: { kind: string; code: string; heightM: number };
      }[];
    };
    const footprints = snapshot.features.filter(
      (item) => item.properties.kind === 'building',
    );
    const buildingRoot = scene.nodes.find(
      (node: { name: string }) => node.name === 'Buildings',
    );
    expect(buildingRoot.children).toHaveLength(footprints.length);
    expect(new Set(buildings.map((item) => item.code)).size).toBe(35);
    expect(buildings.map((item) => item.featureId).sort()).toEqual(
      footprints.map((item) => item.id).sort(),
    );

    for (const [index, footprint] of footprints.entries()) {
      const node = scene.nodes[buildingRoot.children[index]];
      expect(node.extras.featureId).toBe(footprint.id);
      expect(node.extras.code).toBe(footprint.properties.code);
      if (filename !== 'kmutt-bangmod.glb') {
        expect(node.extras.facadeSource).toBe(
          `https://bgm.kmutt.ac.th/MapNavi/${footprint.properties.code}.html`,
        );
        expect(['photo-informed', 'complex-reference']).toContain(
          node.extras.facadeBasis,
        );
        expect(node.extras.facadeScope).toContain(
          'remaining sides and roofs are estimates',
        );
      }
      const roof = scene.meshes[node.mesh].primitives[0];
      const world = (bound: number[]) =>
        bound.map(
          (axis, i) =>
            axis * (node.scale?.[i] ?? 1) + (node.translation?.[i] ?? 0),
        );
      const digits = compact ? 2 : 4;
      if (footprint.id === 'N7' || footprint.id === 'S3') {
        const lowerFloors = footprint.id === 'N7' ? 3 : 5;
        const totalFloors = footprint.id === 'N7' ? 10 : 14;
        expect(node.extras.podiumFloors).toBe(lowerFloors);
        expect(
          world(scene.accessors[roof.attributes.POSITION].min)[1],
        ).toBeCloseTo(
          (footprint.properties.heightM * lowerFloors) / totalFloors,
          digits,
        );
        expect(node.extras.massingSource).toContain(
          'kmutt.ac.th/virtual/bangmod/',
        );
      }
      if (filename !== 'kmutt-bangmod.glb') {
        const normal = scene.accessors[roof.attributes.NORMAL];
        expect(normal).toMatchObject({ componentType: 5120, normalized: true });
        expect(scene.bufferViews[normal.bufferView].byteStride).toBe(4);
        expect(scene.accessors[roof.attributes.POSITION].componentType).toBe(
          compact ? 5123 : 5126,
        );
        if (compact) {
          const position = scene.accessors[roof.attributes.POSITION];
          expect(position.normalized).not.toBe(true);
          expect(scene.bufferViews[position.bufferView].byteStride).toBe(8);
          expect(node.scale[0]).toBeGreaterThan(0);
          expect(node.scale[0]).toBeLessThanOrEqual(0.002);
          expect(node.scale).toEqual([
            node.scale[0],
            node.scale[0],
            node.scale[0],
          ]);
        }
        if (footprint.id === 'N8' || footprint.id === 'N14') {
          expect(scene.materials[roof.material].name).toMatch(
            /^Sheet metal roof/,
          );
          expect(
            world(scene.accessors[roof.attributes.POSITION].min)[1],
          ).toBeLessThan(footprint.properties.heightM - 0.5);
        }
        if (footprint.id === 'S15') {
          const primitives = scene.meshes[node.mesh].primitives;
          const finishes = primitives.map(
            ({ material }: { material: number }) =>
              scene.materials[material].name.split(' #')[0],
          );
          expect(finishes).toContain('Entrance door frame');
          expect(finishes).toContain('Timber-coloured cladding');
          const signs = primitives.filter(
            ({ material }: { material: number }) =>
              scene.materials[material].name === 'Bangmod sign lettering',
          );
          expect(signs).toHaveLength(2);
          expect(signs[1].attributes.TEXCOORD_0).toEqual(expect.any(Number));
          expect(node.extras.signage[1].lines).toContain('ภาควิชาวิศวกรรมเคมี');
        }
        if (footprint.id === 'S14') {
          const bounds = scene.accessors[roof.attributes.POSITION];
          expect(world(bounds.max)[1] - world(bounds.min)[1]).toBeGreaterThan(
            3.8,
          );
          expect(node.extras.signage).toContainEqual({
            lines: ['KMUTT'],
            source: 'https://www.kmutt.ac.th/virtual/bangmod/#media-index=105',
            placement: 'curved roof',
          });
          expect(JSON.stringify(node.extras.signage)).not.toContain(
            'INDUSTRIAL EDUCATION',
          );
        }
        if (footprint.id === 'N16') {
          expect(node.extras).toMatchObject({
            podiumFloors: 6,
            publishedTotalHeightM: 70.75,
            publishedTotalHeightDatum: 'Includes basement and rooftop.',
          });
          const primitives = scene.meshes[node.mesh].primitives as {
            material: number;
            attributes: { POSITION: number };
          }[];
          const byFinish = (finish: string) =>
            primitives.find(({ material }) =>
              scene.materials[material].name.startsWith(finish),
            );
          for (const finish of [
            'Opening reveal',
            'Powder-coated railing',
            'Stone terrace',
          ]) {
            expect(byFinish(finish)).toBeDefined();
          }
          const podium = scene.accessors[roof.attributes.POSITION];
          expect(world(podium.min)[1]).toBeCloseTo(
            footprint.properties.heightM * (6 / 15),
            digits,
          );
          const solar = byFinish('Photovoltaic glass');
          if (!solar) throw new Error('Missing LX rooftop solar arrays');
          const panel = scene.accessors[solar.attributes.POSITION];
          expect(world(panel.min)[1]).toBeGreaterThan(
            footprint.properties.heightM,
          );
          expect(world(panel.max)[1] - world(panel.min)[1]).toBeGreaterThan(
            0.4,
          );
        }
      }
      const [east, up, south] = world(
        scene.accessors[roof.attributes.POSITION].max,
      );
      expect(up).toBeCloseTo(footprint.properties.heightM, digits);
      expect(Math.abs(east)).toBeLessThan(500);
      expect(Math.abs(south)).toBeLessThan(500);
    }
  },
);
