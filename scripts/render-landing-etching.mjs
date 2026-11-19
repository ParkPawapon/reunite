import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = new URL(
  '../apps/web/src/app/research/kmutt-bangmod/anchors.generated.json',
  import.meta.url,
);
const destination = new URL(
  '../apps/web/public/landing/bangmod-etching.webp',
  import.meta.url,
);
const { features, routes, viewBox } = JSON.parse(
  await readFile(source, 'utf8'),
);
const buildings = features
  .filter(({ kind, path }) => kind === 'building' && path)
  .map(({ path }) => `<path d="${path}"/>`)
  .join('');

// Attribution is linked from the campus scene via its existing NOTICE.txt.
const drawing = `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1275" viewBox="${viewBox.join(' ')}">
  <g fill="none" stroke="#F5AA78" stroke-linecap="round" stroke-linejoin="round">
    <path d="${routes.road}" stroke-width="1.8" opacity=".67" />
    <path d="${routes.walk}" stroke-width=".95" stroke-dasharray="1.6 3.2" opacity=".65" />
    <g fill="#A5593D" fill-opacity=".2" stroke-width="1.25">${buildings}</g>
  </g>
</svg>`;

await sharp(Buffer.from(drawing))
  .webp({ quality: 80 })
  .toFile(fileURLToPath(destination));
