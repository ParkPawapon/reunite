import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type LaunchPalette = {
  cream: string;
  pale: string;
  orange: string;
  brown: string;
  deep: string;
  yellow: string;
  white: string;
};
export function readLaunchPalette(element: HTMLElement): LaunchPalette {
  const style = getComputedStyle(element);
  const color = (name: string) => {
    const value = style.getPropertyValue(`--color-${name}`).trim();
    if (!value) throw new Error(`Missing launch color token: ${name}`);
    return value;
  };
  return {
    cream: color('orange-50'),
    pale: color('orange-200'),
    orange: color('brand-orange'),
    brown: color('orange-900'),
    deep: color('orange-950'),
    yellow: color('brand-yellow'),
    white: color('neutral-white'),
  };
}

function box(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: T.Material,
) {
  return new T.Mesh(
    new RoundedBoxGeometry(width, height, depth, 3, radius),
    material,
  );
}

export function addLaunchProps(scene: T.Scene, palette: LaunchPalette) {
  const gold = new T.MeshStandardMaterial({
    color: palette.yellow,
    metalness: 0.72,
    roughness: 0.26,
  });
  const cream = new T.MeshStandardMaterial({
    color: palette.cream,
    roughness: 0.45,
  });
  const orange = new T.MeshStandardMaterial({
    color: palette.orange,
    roughness: 0.37,
    metalness: 0.15,
  });
  const dark = new T.MeshStandardMaterial({
    color: palette.brown,
    roughness: 0.5,
  });
  const key = new T.Group();
  key.add(new T.Mesh(new T.TorusGeometry(0.3, 0.095, 12, 48), gold));
  const stem = box(0.13, 0.78, 0.16, 0.04, gold);
  stem.position.set(0, -0.6, 0);
  key.add(stem);
  for (const y of [-0.72, -0.96]) {
    const tooth = box(0.32, 0.13, 0.16, 0.025, gold);
    tooth.position.set(0.14, y, 0);
    key.add(tooth);
  }
  key.position.set(-4.5, 2.2, 1.8);
  key.rotation.set(-0.22, -0.4, -0.48);
  key.scale.setScalar(1.2);
  scene.add(key);

  const card = new T.Group();
  card.add(box(0.9, 1.2, 0.065, 0.07, cream));
  const hole = box(0.27, 0.055, 0.075, 0.02, dark);
  hole.position.set(0, 0.47, 0.03);
  card.add(hole);
  const portrait = new T.Mesh(
    new T.CylinderGeometry(0.14, 0.14, 0.045, 32),
    orange,
  );
  portrait.rotation.x = Math.PI / 2;
  portrait.position.set(-0.17, 0.13, 0.045);
  card.add(portrait);
  for (const [width, y] of [
    [0.22, 0.18],
    [0.18, 0.05],
    [0.62, -0.21],
    [0.42, -0.36],
  ] as const) {
    const line = box(width, 0.035, 0.04, 0.01, orange);
    line.position.set(y > 0 ? 0.2 : 0, y, 0.06);
    card.add(line);
  }
  card.position.set(4.2, 1.7, -0.8);
  card.rotation.set(0.1, -0.6, 0.16);
  scene.add(card);
  const floats = [key, card].map((object) => ({
    object,
    baseY: object.position.y,
    baseAngle: object.rotation.y,
  }));
  const beads: { mesh: T.Mesh; radius: number; phase: number }[] = [];
  const ringMaterial = new T.MeshBasicMaterial({
    color: palette.orange,
    transparent: true,
    opacity: 0.48,
  });
  for (const [index, radius] of [6.1, 6.8].entries()) {
    const ring = new T.Mesh(
      new T.TorusGeometry(radius, 0.012, 5, 160),
      ringMaterial,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 0.76;
    ring.position.y = -0.38 - index * 0.03;
    scene.add(ring);
    const mesh = new T.Mesh(
      new T.SphereGeometry(0.055, 12, 8),
      new T.MeshBasicMaterial({
        color: index ? palette.yellow : palette.orange,
      }),
    );
    scene.add(mesh);
    beads.push({ mesh, radius, phase: index * 2 });
  }
  return (time: number) => {
    floats.forEach(({ object, baseY, baseAngle }, index) => {
      object.position.y = baseY + Math.sin(time * 0.7 + index * 2) * 0.18;
      object.rotation.y = baseAngle + Math.sin(time * 0.28 + index) * 0.18;
      object.rotation.z = Math.sin(time * 0.45 + index) * 0.1;
    });
    beads.forEach(({ mesh, radius, phase }) => {
      const angle = time * 0.13 + phase;
      mesh.position.set(
        Math.cos(angle) * radius,
        -0.36 + Math.sin(angle * 2) * 0.08,
        Math.sin(angle) * radius * 0.76,
      );
    });
  };
}
