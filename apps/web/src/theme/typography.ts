export const fontFamily =
  'var(--font-outfit), var(--font-noto-sans-thai), Arial, sans-serif';
// Values live in tokens.css; both Tailwind and MUI reference those properties.
export function textToken(name: string) {
  return {
    fontSize: `var(--type-${name}-size)`,
    lineHeight: `var(--type-${name}-line)`,
    fontWeight: `var(--type-${name}-weight)`,
    letterSpacing: 'normal',
  };
}
