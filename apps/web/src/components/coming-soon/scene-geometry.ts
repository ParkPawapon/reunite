import {
  Box3,
  BufferAttribute,
  Color,
  Group,
  Mesh,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function materialSignature(material: Material) {
  const entries: [string, unknown][] = [];
  for (const [key, value] of (
    Object.entries(material) as [string, unknown][]
  ).sort(([a], [b]) => a.localeCompare(b))) {
    if (['id', 'uuid', 'name', 'version', 'userData'].includes(key)) continue;
    if (
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value)
    )
      entries.push([key, value]);
    else if (value instanceof Texture) entries.push([key, value.uuid]);
    else if (
      value instanceof Color ||
      value instanceof Vector2 ||
      value instanceof Vector3 ||
      value instanceof Vector4
    )
      entries.push([key, value.toArray()]);
  }
  return JSON.stringify(entries);
}

/** Merge only static primitives with identical rendering properties. */
export function batchCampus(source: Object3D) {
  source.updateMatrixWorld(true);
  const before = new Box3().setFromObject(source);
  const groups = new Map<
    string,
    { material: Material; geometries: BufferGeometry[] }
  >();
  const temporary = new Set<BufferGeometry>();
  const result = new Group();
  let triangles = 0;
  try {
    source.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (
        'isSkinnedMesh' in object ||
        Array.isArray(object.material) ||
        Object.keys(object.geometry.morphAttributes).length
      )
        throw new Error('The launch model must contain static primitives.');
      const geometry: BufferGeometry = object.geometry.clone();
      temporary.add(geometry);
      // Applying matrices to quantized integer attributes would truncate positions.
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++)
          for (let j = 0; j < attribute.itemSize; j++)
            values[i * attribute.itemSize + j] = attribute.getComponent(i, j);
        geometry.setAttribute(
          name,
          new BufferAttribute(values, attribute.itemSize),
        );
      }
      geometry.applyMatrix4(object.matrixWorld);
      triangles +=
        (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
      const layout = Object.keys(geometry.attributes)
        .sort()
        .map((name) => `${name}:${geometry.getAttribute(name).itemSize}`)
        .join(',');
      const signature = `${materialSignature(object.material)}:${layout}:${Boolean(geometry.index)}`;
      let group = groups.get(signature);
      if (!group) {
        group = { material: object.material, geometries: [] };
        groups.set(signature, group);
      }
      group.geometries.push(geometry);
    });
    let mergedTriangles = 0;
    for (const { material, geometries } of groups.values()) {
      const geometry = mergeGeometries(geometries, false);
      if (!geometry) throw new Error('Incompatible campus geometry.');
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      result.add(mesh);
      mergedTriangles +=
        (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    }
    const after = new Box3().setFromObject(result);
    const error = Math.max(
      ...(['x', 'y', 'z'] as const).flatMap((axis) => [
        Math.abs(before.min[axis] - after.min[axis]),
        Math.abs(before.max[axis] - after.max[axis]),
      ]),
    );
    if (
      !triangles ||
      triangles !== mergedTriangles ||
      !Number.isFinite(error) ||
      error > 0.001
    )
      throw new Error('Batching changed the campus geometry.');
    return result;
  } catch (error) {
    result.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    throw error;
  } finally {
    temporary.forEach((geometry) => geometry.dispose());
  }
}

/** Resource sets prevent duplicate disposal of shared GLB textures/materials. */
export function disposeSceneResources(...roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<ImageBitmap>();
  for (const root of roots)
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof Texture) textures.add(value);
      }
    });
  textures.forEach((texture) => {
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
      images.add(image);
    texture.dispose();
  });
  images.forEach((image) => image.close());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
