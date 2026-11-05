import palette from './colors.json';

export const colorPrimitives = palette.primitives;

export function semanticColor(name: keyof typeof palette.semantic) {
  const reference = palette.semantic[name] as keyof typeof colorPrimitives;
  return colorPrimitives[reference];
}
