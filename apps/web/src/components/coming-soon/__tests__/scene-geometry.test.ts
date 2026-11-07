import { describe, expect, it } from 'vitest';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { batchCampus, disposeSceneResources } from '../scene-geometry';

function triangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Uint16Array([0, 0, 0, 1000, 0, 0, 0, 1000, 0]), 3),
  );
  geometry.setAttribute(
    'normal',
    new BufferAttribute(
      new Int8Array([0, 0, 127, 0, 0, 127, 0, 0, 127]),
      3,
      true,
    ),
  );
  geometry.setAttribute(
    'uv',
    new BufferAttribute(new Uint16Array([0, 0, 65535, 0, 0, 65535]), 2, true),
  );
  return geometry;
}

describe('launch model batching', () => {
  it('dequantizes before transforms, retaining shape, normalized normals and UVs', () => {
    const source = new Group();
    const material = new MeshStandardMaterial({
      color: '#FA4616',
      roughness: 0.4,
    });
    for (const x of [20.125, 22.375]) {
      const mesh = new Mesh(triangle(), material.clone());
      mesh.scale.setScalar(0.001);
      mesh.position.set(x, 2.25, -5.875);
      source.add(mesh);
    }
    source.rotation.y = Math.PI / 6;
    const merged = batchCampus(source);
    try {
      expect(merged.children).toHaveLength(1);
      const mesh = merged.children[0];
      expect(mesh).toBeInstanceOf(Mesh);
      if (!(mesh instanceof Mesh)) throw new Error('Expected a mesh');
      expect(mesh.geometry.getAttribute('position').count).toBe(6);
      expect(mesh.geometry.getAttribute('position').array).toBeInstanceOf(
        Float32Array,
      );
      expect(mesh.geometry.getAttribute('normal').getX(0)).toBeCloseTo(0.5, 5);
      expect(mesh.geometry.getAttribute('normal').getZ(0)).toBeCloseTo(
        Math.sqrt(3) / 2,
        5,
      );
      expect(mesh.geometry.getAttribute('uv').getX(1)).toBe(1);
      const before = new Box3().setFromObject(source);
      const after = new Box3().setFromObject(merged);
      expect(before.min.distanceTo(after.min)).toBeLessThan(0.00001);
      expect(before.max.distanceTo(after.max)).toBeLessThan(0.00001);
      const original = source.children[0];
      if (!(original instanceof Mesh))
        throw new Error('Expected original mesh');
      expect(original.geometry.getAttribute('position').array).toBeInstanceOf(
        Uint16Array,
      );
    } finally {
      disposeSceneResources(source, merged);
    }
  });
  it('keeps different physical materials separate', () => {
    const source = new Group();
    source.add(
      new Mesh(triangle(), new MeshStandardMaterial({ roughness: 0.2 })),
    );
    source.add(
      new Mesh(triangle(), new MeshStandardMaterial({ roughness: 0.8 })),
    );
    const merged = batchCampus(source);
    try {
      expect(merged.children).toHaveLength(2);
    } finally {
      disposeSceneResources(source, merged);
    }
  });
});
