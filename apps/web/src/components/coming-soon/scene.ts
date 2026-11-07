import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { batchCampus, disposeSceneResources } from './scene-geometry';
import { addLaunchProps, readLaunchPalette } from './scene-props';

export type LaunchScene = {
  ready: Promise<void>;
  setRunning: (running: boolean, resumeOrbit?: boolean) => void;
  rotate: (direction: -1 | 1) => void;
  reset: () => void;
  dispose: () => void;
};

const assetUrl = '/research/kmutt-bangmod/kmutt-bangmod-web.glb';

/** Owns one WebGL context; all listeners, requests and GPU resources share its lifetime. */
export function mountLaunchScene({
  canvas,
  container,
  signal,
  running,
  onFailure,
}: {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  signal: AbortSignal;
  running: boolean;
  onFailure: () => void;
}): LaunchScene {
  const loadAbort = new AbortController();
  const cleanup: (() => void)[] = [];
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-10, 10, 7, -7, 0.1, 150);
  let renderer: T.WebGLRenderer | undefined;
  let controls: OrbitControls | undefined;
  let environment: T.WebGLRenderTarget | undefined;
  let source: T.Object3D | undefined;
  let disposed = false;
  let ready = false;
  let visible = true;
  let requestedRunning = running;
  let interacted = false;
  let frame = 0;
  let previous = 0;
  let time = 0;
  let cinematicProgress = 1;
  let animateProps = (_time: number) => {};

  function listen(target: EventTarget, name: string, listener: EventListener) {
    target.addEventListener(name, listener);
    cleanup.push(() => target.removeEventListener(name, listener));
  }
  function moving() {
    return (
      ready && !disposed && requestedRunning && visible && !document.hidden
    );
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    loadAbort.abort();
    cleanup.forEach((release) => release());
    controls?.dispose();
    scene.traverse((object) => {
      if (object instanceof T.DirectionalLight) object.shadow.dispose();
    });
    disposeSceneResources(...(source ? [scene, source] : [scene]));
    environment?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  function fail() {
    if (!disposed) {
      dispose();
      onFailure();
    }
  }
  function render() {
    if (!ready || disposed) return;
    try {
      renderer?.render(scene, camera);
    } catch {
      fail();
    }
  }
  function schedule() {
    if (!frame && moving()) frame = requestAnimationFrame(animate);
  }
  function animate(now: number) {
    frame = 0;
    if (!moving()) return;
    if (previous && now - previous < 1000 / 30) {
      schedule();
      return;
    }
    const delta = previous ? Math.min((now - previous) / 1000, 0.08) : 1 / 30;
    previous = now;
    time += delta;
    if (!interacted && controls) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(T.Object3D.DEFAULT_UP, delta * 0.027);
      camera.position.copy(controls.target).add(offset);
    }
    animateProps(time);
    if (cinematicProgress < 1) {
      cinematicProgress = Math.min(1, cinematicProgress + delta / 2.4);
      camera.zoom = 0.91 + 0.09 * (1 - Math.pow(1 - cinematicProgress, 3));
      camera.updateProjectionMatrix();
    }
    controls?.update();
    render();
    schedule();
  }
  function syncMotion() {
    stop();
    if (!moving()) {
      if (cinematicProgress < 1) {
        cinematicProgress = 1;
        camera.zoom = 1;
        camera.updateProjectionMatrix();
      }
      render();
    } else schedule();
  }
  function resize() {
    if (disposed || !renderer) return;
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, innerWidth < 761 ? 1.25 : 1.5),
    );
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const vertical = Math.max(9.2, 15.8 / aspect);
    camera.left = (-vertical * aspect) / 2;
    camera.right = (vertical * aspect) / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2;
    camera.updateProjectionMatrix();
    render();
  }
  function rotate(direction: -1 | 1) {
    if (!ready || disposed || !controls) return;
    interacted = true;
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(T.Object3D.DEFAULT_UP, (direction * Math.PI) / 8);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  }
  function reset() {
    if (!ready || disposed || !controls) return;
    interacted = false;
    cinematicProgress = 1;
    camera.position.set(10, 11, 15);
    controls.target.set(0, 0.1, 0);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    render();
    schedule();
  }
  try {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    listen(signal, 'abort', dispose);
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!context) throw new Error('WebGL 2 unavailable.');
    const palette = readLaunchPalette(container);
    renderer = new T.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(palette.deep, 0);
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    camera.position.set(10, 11, 15);
    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.1, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = false;
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.rotateSpeed = 0.52;
    controls.update();
    const interaction = () => {
      interacted = true;
    };
    const change = () => {
      if (!moving()) render();
    };
    controls.addEventListener('start', interaction);
    controls.addEventListener('change', change);
    cleanup.push(() => {
      controls?.removeEventListener('start', interaction);
      controls?.removeEventListener('change', change);
    });
    listen(canvas, 'keydown', (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        rotate(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        reset();
      }
    });
    listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      fail();
    });
    listen(document, 'visibilitychange', syncMotion);
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.2;
    } finally {
      pmrem.dispose();
      room.dispose();
    }
    scene.add(new T.HemisphereLight(palette.cream, palette.brown, 1.55));
    const light = new T.DirectionalLight(palette.white, 1.9);
    light.position.set(-7, 14, 10);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -9,
      right: 9,
      top: 9,
      bottom: -9,
      near: 1,
      far: 45,
    });
    light.shadow.bias = -0.00035;
    light.shadow.normalBias = 0.025;
    scene.add(light);
    const rim = new T.DirectionalLight(palette.pale, 0.7);
    rim.position.set(9, 5, -8);
    scene.add(rim);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    cleanup.push(() => observer.disconnect());
    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        syncMotion();
      },
      { threshold: [0, 0.08] },
    );
    intersection.observe(container);
    cleanup.push(() => intersection.disconnect());
    resize();
    const loaded = (async () => {
      const response = await fetch(assetUrl, {
        signal: AbortSignal.any([
          signal,
          loadAbort.signal,
          AbortSignal.timeout(45000),
        ]),
      });
      if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
      const gltf = await new GLTFLoader().parseAsync(
        await response.arrayBuffer(),
        '',
      );
      if (disposed) {
        disposeSceneResources(gltf.scene);
        return;
      }
      source = gltf.scene;
      const model = batchCampus(source);
      const bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3());
      const center = bounds.getCenter(new T.Vector3());
      const scale = 11.7 / Math.max(size.x, size.z);
      model.position.sub(center);
      const campus = new T.Group();
      campus.add(model);
      campus.scale.setScalar(scale);
      campus.position.y = 0.35;
      scene.add(campus);
      animateProps = addLaunchProps(scene, palette);
      const plinth = new T.Mesh(
        new T.CylinderGeometry(6.05, 6, 0.1, 128),
        new T.MeshStandardMaterial({
          color: palette.deep,
          roughness: 0.88,
          metalness: 0.12,
        }),
      );
      plinth.scale.z = 0.78;
      plinth.position.y = -((size.y * scale) / 2) + 0.22;
      plinth.receiveShadow = true;
      scene.add(plinth);
      ready = true;
      if (renderer) renderer.shadowMap.needsUpdate = true;
      cinematicProgress = moving() ? 0 : 1;
      if (!cinematicProgress) {
        camera.zoom = 0.91;
        camera.updateProjectionMatrix();
      }
      resize();
      render();
      schedule();
    })().catch((error: unknown) => {
      dispose();
      throw error;
    });
    return {
      ready: loaded,
      setRunning(value, resumeOrbit = false) {
        requestedRunning = value;
        if (resumeOrbit) interacted = false;
        syncMotion();
      },
      rotate,
      reset,
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
