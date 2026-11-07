import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  Raycaster,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createDaylightEnvironment } from './daylight-environment';
import type { LiveFix } from './live-position';
import {
  layoutMapLabels,
  mapLabels,
  type MapLabelPlacement,
} from './map-labels';
import type { WalkSegment } from './walking';

export type View = 'perspective' | 'north';
export type CampusScene = {
  setView: (view: View) => void;
  rotate: (direction: -1 | 1) => void;
  zoom: (direction: -1 | 1) => void;
  setRoute: (segments: readonly WalkSegment[]) => void;
  focusRoute: (segments: readonly WalkSegment[]) => void;
  setLiveFix: (fix: LiveFix | null, following: boolean) => void;
  select: (id: string | null) => void;
  locate: (point: readonly [number, number, number] | null) => void;
  dispose: () => void;
};

export type PinPosition = { left: number; top: number } | null;

function featureId(object: Object3D): string | undefined {
  let node: Object3D | null = object;
  while (node) {
    const id: unknown = node.userData.featureId;
    if (typeof id === 'string') return id;
    node = node.parent;
  }
}

export async function mountCampusScene({
  canvas,
  assetUrl,
  knownIds,
  signal,
  onSelect,
  onPin,
  onLivePin,
  onRoutePins,
  onMapLabels,
  onContextLost,
}: {
  canvas: HTMLCanvasElement;
  assetUrl: string;
  knownIds: ReadonlySet<string>;
  signal: AbortSignal;
  onSelect: (id: string) => void;
  onPin: (position: PinPosition) => void;
  onLivePin: (position: PinPosition) => void;
  onRoutePins: (start: PinPosition, end: PinPosition) => void;
  onMapLabels: (labels: readonly MapLabelPlacement[]) => void;
  onContextLost: () => void;
}): Promise<CampusScene> {
  const context = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
  });
  if (!context) throw new Error('WebGL 2 unavailable');
  const renderer = new WebGLRenderer({ canvas, context });
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.17;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new Scene();
  const routeOverlay = new Group();
  const walkMaterial = new MeshBasicMaterial({
    color: '#176b60',
    side: DoubleSide,
  });
  const roadMaterial = new MeshBasicMaterial({
    color: '#87501e',
    side: DoubleSide,
  });
  const stepMaterial = new MeshBasicMaterial({
    color: '#704574',
    side: DoubleSide,
  });
  const endMaterial = new MeshBasicMaterial({ color: '#893623' });
  const routeHalo = new MeshBasicMaterial({
    color: '#ffffff',
    side: DoubleSide,
  });
  const accuracyDisc = new Mesh(
    new CircleGeometry(1, 48),
    new MeshBasicMaterial({
      color: '#2164ce',
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  accuracyDisc.visible = false;
  accuracyDisc.rotation.x = -Math.PI / 2;
  scene.add(accuracyDisc);
  scene.add(routeOverlay);
  const routeMeshes: Mesh[] = [];
  const clearRoute = () => {
    for (const mesh of routeMeshes) {
      mesh.geometry.dispose();
      routeOverlay.remove(mesh);
    }
    routeMeshes.length = 0;
  };
  scene.background = new Color('#edf0ee');
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 5000);
  const key = new DirectionalLight('#fff0dc', 2.15);
  const controls = new OrbitControls(camera, canvas);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = false;
  controls.minZoom = 0.65;
  controls.maxZoom = 18;
  controls.listenToKeyEvents(canvas);

  const modelGeometries = new Set<Mesh['geometry']>();
  const materials = new Set<MeshStandardMaterial>();
  const textures = new Set<Texture>();
  const pickable: Mesh[] = [];
  const parts = new Map<string, Mesh[]>();
  const highlights = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  const original = new Map<Mesh, Mesh['material']>();
  let selected: Mesh[] = [];
  let observer: ResizeObserver | undefined;
  let pointerStart: { x: number; y: number; id: number } | undefined;
  let disposed = false;
  let daylight: ReturnType<typeof createDaylightEnvironment> | undefined;
  let pin: Vector3 | null = null;
  let livePin: Vector3 | null = null;
  let routeStart: Vector3 | null = null;
  let routeEnd: Vector3 | null = null;
  let selectedId: string | null = null;
  const labelAnchors = mapLabels.map((label) => ({
    ...label,
    point: new Vector3(...label.world),
  }));
  const projectedPin = new Vector3();
  const projectPin = (point: Vector3 | null): PinPosition => {
    if (!point) return null;
    const { x, y, z } = projectedPin.copy(point).project(camera);
    return Math.abs(x) <= 0.99 && Math.abs(y) <= 0.99 && Math.abs(z) <= 1
      ? { left: (x + 1) * 50, top: (1 - y) * 50 }
      : null;
  };
  const render = () => {
    if (disposed) return;
    renderer.render(scene, camera);
    const selection = projectPin(pin);
    const live = projectPin(livePin);
    const start = projectPin(routeStart);
    const end = projectPin(routeEnd);
    onPin(selection);
    onLivePin(live);
    onRoutePins(start, end);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height || controls.getPolarAngle() > Math.PI * 0.44) {
      onMapLabels([]);
      return;
    }
    const toPixels = ({ left, top }: NonNullable<PinPosition>) => ({
      x: (left * width) / 100,
      y: (top * height) / 100,
    });
    const protectedPoints = [selection, live, start, end].flatMap((point) =>
      point ? [toPixels(point)] : [],
    );
    const candidates = labelAnchors.flatMap(({ id, code, point, caption }) => {
      const projected = projectPin(point);
      return id !== selectedId && projected
        ? [{ id, code, ...toPixels(projected), area: !caption }]
        : [];
    });
    onMapLabels(
      layoutMapLabels(
        candidates,
        protectedPoints,
        width,
        height,
        (width * camera.zoom) / (camera.right - camera.left) >= 2.2,
      ),
    );
  };
  const handleLoss = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };
  const handleDown = (event: PointerEvent) => {
    pointerStart =
      event.isPrimary && event.button === 0
        ? { x: event.clientX, y: event.clientY, id: event.pointerId }
        : undefined;
  };
  const handleCancel = () => {
    pointerStart = undefined;
  };
  const handleUp = (event: PointerEvent) => {
    const start = pointerStart;
    pointerStart = undefined;
    if (
      !start ||
      start.id !== event.pointerId ||
      Math.hypot(start.x - event.clientX, start.y - event.clientY) > 6
    )
      return;
    const rect = canvas.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(
      new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      ),
      camera,
    );
    const hit = ray.intersectObjects(pickable, false)[0];
    const id = hit && featureId(hit.object);
    if (id) onSelect(id);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    controls.dispose();
    canvas.removeEventListener('pointerdown', handleDown);
    canvas.removeEventListener('pointerup', handleUp);
    canvas.removeEventListener('pointercancel', handleCancel);
    canvas.removeEventListener('webglcontextlost', handleLoss);
    modelGeometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => {
      texture.dispose();
      const image: unknown = texture.source.data;
      if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
        image.close();
    });
    highlights.forEach((material) => material.dispose());
    clearRoute();
    walkMaterial.dispose();
    roadMaterial.dispose();
    stepMaterial.dispose();
    endMaterial.dispose();
    routeHalo.dispose();
    accuracyDisc.geometry.dispose();
    accuracyDisc.material.dispose();
    key.shadow.dispose();
    scene.environment = null;
    daylight?.dispose();
    renderer.dispose();
  };

  try {
    const response = await fetch(assetUrl, { signal });
    if (!response.ok) throw new Error('Campus model unavailable');
    const { scene: model } = await new GLTFLoader().parseAsync(
      await response.arrayBuffer(),
      '',
    );
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      modelGeometries.add(object.geometry);
      object.receiveShadow = true;
      const id = featureId(object);
      object.castShadow =
        Boolean(id && knownIds.has(id)) ||
        object.userData.castsShadow === true ||
        object.parent?.userData.castsShadow === true;
      for (const material of [object.material].flat()) {
        materials.add(material);
        if (material.map) textures.add(material.map);
      }
      if (!id || !knownIds.has(id)) return;
      const group = parts.get(id) ?? [];
      group.push(object);
      parts.set(id, group);
      pickable.push(object);
      original.set(object, object.material);
    });
    signal.throwIfAborted();
    if (parts.size !== knownIds.size)
      throw new Error('Campus catalog and model disagree');
    daylight = createDaylightEnvironment(renderer);
    scene.environment = daylight.texture;
    scene.environmentIntensity = 0.1;
    scene.add(model, new HemisphereLight('#e6efff', '#b0a899', 1.82));
    key.position.set(-320, 540, 220);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -430;
    key.shadow.camera.right = key.shadow.camera.top = 430;
    key.shadow.camera.far = 1500;
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.normalBias = 0.32;
    key.shadow.bias = -0.00012;
    scene.add(key, key.target);
    renderer.shadowMap.needsUpdate = true;
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    center.y = 0;
    const extent = bounds.getSize(new Vector3());
    const radius = Math.hypot(extent.x, extent.z) * 0.48;
    let halfWidth = radius;
    let halfHeight = radius;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      const fittedHeight = Math.max(halfHeight, halfWidth / aspect);
      camera.left = -fittedHeight * aspect;
      camera.right = fittedHeight * aspect;
      camera.top = fittedHeight;
      camera.bottom = -fittedHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      render();
    };
    const setView = (view: View) => {
      camera.zoom = 1;
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(
          view === 'north'
            ? new Vector3(0, radius * 2, 0.001)
            : new Vector3(radius * 0.78, radius * 1.18, radius * 1.4),
        );
      camera.updateProjectionMatrix();
      controls.update();
      camera.updateMatrixWorld();
      const vertex = new Vector3();
      halfWidth = 1;
      halfHeight = 1;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          vertex
            .fromBufferAttribute(positions, i)
            .applyMatrix4(object.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          halfWidth = Math.max(halfWidth, Math.abs(vertex.x) * 1.12);
          halfHeight = Math.max(halfHeight, Math.abs(vertex.y) * 1.12);
        }
      });
      resize();
    };
    const moveTarget = (x: number, z: number) => {
      const ground = new Vector3(x, 0, z);
      camera.position.add(ground.clone().sub(controls.target));
      controls.target.copy(ground);
    };
    controls.addEventListener('change', render);
    canvas.addEventListener('pointerdown', handleDown);
    canvas.addEventListener('pointerup', handleUp);
    canvas.addEventListener('pointercancel', handleCancel);
    canvas.addEventListener('webglcontextlost', handleLoss);
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    setView('perspective');
    return {
      setView,
      rotate(direction) {
        controls.rotateLeft((direction * Math.PI) / 4);
      },
      zoom(direction) {
        camera.zoom = Math.min(
          controls.maxZoom,
          Math.max(controls.minZoom, camera.zoom * 1.25 ** direction),
        );
        camera.updateProjectionMatrix();
        render();
      },
      setRoute(segments) {
        clearRoute();
        const start = segments[0]?.from;
        const end = segments.at(-1)?.to;
        routeStart = start ? new Vector3(start[0], 0.31, start[1]) : null;
        routeEnd = end ? new Vector3(end[0], 0.31, end[1]) : null;
        const paths: Record<WalkSegment['kind'], number[]> = {
          walk: [],
          road: [],
          steps: [],
        };
        const halo: number[] = [];
        for (const segment of segments) {
          const [x, z] = segment.from;
          const [endX, endZ] = segment.to;
          if (segment.metres <= 0) continue;
          for (const [vertices, width, y] of [
            [halo, 2.25, 0.26],
            [paths[segment.kind], 1.45, 0.28],
          ] as const) {
            const dx = ((endZ - z) / segment.metres) * width;
            const dz = ((x - endX) / segment.metres) * width;
            const a = [x + dx, y, z + dz];
            const b = [x - dx, y, z - dz];
            const c = [endX - dx, y, endZ - dz];
            const d = [endX + dx, y, endZ + dz];
            vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
          }
        }
        for (const [vertices, material] of [
          [halo, routeHalo],
          [paths.walk, walkMaterial],
          [paths.road, roadMaterial],
          [paths.steps, stepMaterial],
        ] as const) {
          if (!vertices.length) continue;
          const geometry = new BufferGeometry();
          geometry.setAttribute(
            'position',
            new Float32BufferAttribute(vertices, 3),
          );
          const mesh = new Mesh(geometry, material);
          routeOverlay.add(mesh);
          routeMeshes.push(mesh);
        }
        for (const [point, material] of [
          [routeStart, walkMaterial],
          [routeEnd, endMaterial],
        ] as const) {
          if (!point) continue;
          const marker = new Mesh(new CircleGeometry(2.8, 18), material);
          marker.rotation.x = -Math.PI / 2;
          marker.position.copy(point);
          routeOverlay.add(marker);
          routeMeshes.push(marker);
        }
        render();
      },
      focusRoute(segments) {
        if (!segments.length) return;
        const bounds = new Box3();
        for (const { from, to } of segments) {
          bounds.expandByPoint(new Vector3(from[0], 0, from[1]));
          bounds.expandByPoint(new Vector3(to[0], 0, to[1]));
        }
        const center = bounds.getCenter(new Vector3());
        const size = bounds.getSize(new Vector3());
        setView('north');
        moveTarget(center.x, center.z);
        camera.zoom = Math.min(
          controls.maxZoom,
          (camera.right * 2) / (size.x + 78),
          (camera.top * 2) / (size.z + 78),
        );
        camera.updateProjectionMatrix();
        render();
      },
      setLiveFix(fix, following) {
        livePin = fix ? new Vector3(fix.point[0], 0.4, fix.point[1]) : null;
        accuracyDisc.visible = Boolean(fix?.accuracy);
        if (fix && livePin) {
          accuracyDisc.position.copy(livePin);
          accuracyDisc.scale.setScalar(fix.accuracy);
          if (following) moveTarget(livePin.x, livePin.z);
        }
        render();
      },
      locate(point) {
        pin = point ? new Vector3(...point) : null;
        if (pin) {
          moveTarget(pin.x, pin.z);
          camera.zoom = 2.5;
          camera.updateProjectionMatrix();
          controls.update();
        }
        render();
      },
      select(id) {
        selectedId = id;
        for (const mesh of selected) {
          const material = original.get(mesh);
          if (material) mesh.material = material;
        }
        selected = id ? (parts.get(id) ?? []) : [];
        for (const mesh of selected) {
          const material = original.get(mesh);
          if (
            !(material instanceof MeshStandardMaterial) ||
            material.name.startsWith('Bangmod sign lettering') ||
            material.name.startsWith('Sign backing')
          )
            continue;
          let highlight = highlights.get(material);
          if (!highlight) {
            highlight = material.clone();
            highlight.emissive.set('#f49c3a');
            highlight.emissiveIntensity = 0.25;
            highlights.set(material, highlight);
          }
          mesh.material = highlight;
        }
        render();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
