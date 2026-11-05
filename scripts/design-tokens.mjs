import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../apps/web/src/theme/colors.json', import.meta.url);
const output = new URL(
  '../apps/web/src/theme/colors.generated.css',
  import.meta.url,
);
const { primitives, semantic } = JSON.parse(readFileSync(source, 'utf8'));
const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const declarations = [];

for (const [name, value] of Object.entries(primitives)) {
  if (!namePattern.test(name) || !/^#[0-9A-F]{6}$/.test(value)) {
    throw new Error(`Invalid primitive colour: ${name}`);
  }
  declarations.push(`  --color-${name}: ${value.toLowerCase()};`);
}
for (const [name, reference] of Object.entries(semantic)) {
  if (!namePattern.test(name) || !Object.hasOwn(primitives, reference)) {
    throw new Error(`Invalid semantic colour reference: ${name}`);
  }
  declarations.push(`  --color-${name}: var(--color-${reference});`);
}

const css = `/* Generated from colors.json by scripts/design-tokens.mjs. */\n:root {\n${declarations.join('\n')}\n}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== css) {
    throw new Error('Stale colour variables. Run bun run design:tokens.');
  }
  process.stdout.write('Colour variables match the palette source.\n');
} else {
  writeFileSync(output, css);
  process.stdout.write(`Generated ${declarations.length} colour variables.\n`);
}
