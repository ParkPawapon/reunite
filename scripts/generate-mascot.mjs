import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const source = new URL(
  '../apps/web/public/illustrations/agent-honk.svg',
  import.meta.url,
);
const output = new URL(
  '../apps/web/src/components/loading/goose-illustration.generated.tsx',
  import.meta.url,
);
const { primitives } = JSON.parse(
  readFileSync(
    new URL('../apps/web/src/theme/colors.json', import.meta.url),
    'utf8',
  ),
);
const palette = new Map(
  Object.entries(primitives).map(([name, hex]) => [hex, name]),
);
let svg = readFileSync(source, 'utf8');
if (
  /<(?:script|foreignObject|image|use)\b|\bon\w+\s*=|\b(?:href|style)\s*=/i.test(
    svg,
  )
) {
  throw new Error('Mascot source must contain local vector geometry only.');
}
svg = svg
  .replace(/\srole="img"|\saria-labelledby="[^"]*"/g, '')
  .replace(/\s*<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, '')
  .replace(/class="([^"]+)"/g, 'data-honk-part="$1"')
  .replace(
    /\b(stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray)="/g,
    (_, name) =>
      `${name.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}="`,
  )
  .replace(/"(#[0-9A-F]{6})"/g, (_, hex) => {
    const name = palette.get(hex);
    if (!name)
      throw new Error(
        `Mascot colour is absent from the supplied palette: ${hex}`,
      );
    return `"var(--color-${name})"`;
  })
  .replace(
    '<svg ',
    '<svg className={className} data-honk-art aria-hidden="true" focusable="false" ',
  );
const code = await format(
  `// Generated from public/illustrations/agent-honk.svg. Run bun run design:mascot.\nexport function GooseIllustration({ className }: { className?: string }) { return (${svg}); }\n`,
  { ...(await resolveConfig(fileURLToPath(output))), parser: 'typescript' },
);
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== code)
    throw new Error('Stale mascot component. Run bun run design:mascot.');
  process.stdout.write(
    'Mascot component matches the editable SVG and palette.\n',
  );
} else {
  writeFileSync(output, code);
  process.stdout.write('Generated the palette-bound mascot component.\n');
}
