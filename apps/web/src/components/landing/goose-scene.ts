import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  type Object3D,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { disposeSceneResources } from '@/components/scene-resources';

export type GooseScene = {
  ready: Promise<void>;
  setRunning: (running: boolean) => void;
  setFocus: (focus: GooseFocus) => void;
  dispose: () => void;
};
export type GooseFocus = 'team' | 'Agent' | 'Scout' | 'Keeper';

const asset = '/landing/finding-party.glb';
const cameraTarget = [0.15, 1.3, 0] as const;

export function mountGooseScene(
  canvas: HTMLCanvasElement,
  area: HTMLElement,
  signal: AbortSignal,
  onFailure: () => void,
): GooseScene {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-3, 3, 2.5, -2.5, 0.1, 60);
  const ambient = new HemisphereLight(0xfff0d7, 0x375360, 1.58);
  const key = new DirectionalLight(0xffe4c6, 2.42);
  key.position.set(-4.5, 7.2, 5.4);
  const fill = new DirectionalLight(0xbddeed, 0.92);
  fill.position.set(4, 4.7, 3);
  const rim = new DirectionalLight(0xffb87e, 1.55);
  rim.position.set(1.4, 5.7, -4.2);
  scene.add(ambient, key, fill, rim);

  let disposed = false;
  let loaded = false;
  let running = false;
  let frame = 0;
  let lastFrame = 0;
  let time = 0;
  let pointer = 0;
  let orbit = 0;
  let clueProgress = 0;
  let focus: GooseFocus = 'team';
  let umbrella: Object3D | undefined;
  let binoculars: Object3D | undefined;
  const actors: { object: Object3D; angle: number; phase: number }[] = [];
  const aim = new Vector3(...cameraTarget);
  const target = aim.clone();
  const shotTarget = aim.clone();
  let zoomTarget = 1;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
  }

  function draw() {
    const angle = 0.45 + orbit;
    camera.position.set(
      aim.x - cameraTarget[0] + Math.sin(angle) * 12.66,
      aim.y - cameraTarget[1] + 6.3,
      aim.z + Math.cos(angle) * 12.66,
    );
    camera.lookAt(aim);
    renderer.render(scene, camera);
  }

  function resize() {
    if (disposed) return;
    const { clientWidth: width, clientHeight: height } = area;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(2.455, 2.875 / aspect);
    renderer.setPixelRatio(
      Math.min(width < 550 ? 1.15 : 1.55, window.devicePixelRatio || 1),
    );
    renderer.setSize(width, height, false);
    camera.left = -halfHeight * aspect;
    camera.right = -camera.left;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    if (loaded) renderSafely();
  }

  function renderSafely() {
    try {
      draw();
    } catch {
      fail();
    }
  }

  function tick(timestamp: number) {
    frame = 0;
    if (disposed || !running || !loaded) return;
    if (!lastFrame || timestamp - lastFrame >= 1000 / 30) {
      time += lastFrame
        ? Math.min((timestamp - lastFrame) / 1000, 0.06)
        : 1 / 30;
      lastFrame = timestamp;
      const clue = focus === 'team' ? clueProgress : 0;
      const closeUp = smoothstep((clue - 0.38) / 0.62);
      const turn = smoothstep(clue / 0.56);
      orbit +=
        ((pointer * 0.17 + Math.sin(time * 0.45) * 0.08) * (1 - closeUp) -
          orbit) *
        0.09;
      shotTarget.copy(target);
      if (umbrella) shotTarget.lerp(umbrella.position, closeUp * 0.94);
      aim.lerp(shotTarget, 0.12);
      camera.zoom += (zoomTarget + closeUp * 1.72 - camera.zoom) * 0.12;
      camera.updateProjectionMatrix();
      for (const { object, angle, phase } of actors) {
        const agentTurn = object.name === 'Agent' ? turn * 0.3 : 0;
        object.rotation.y =
          angle + agentTurn + Math.sin(time * 0.82 + phase) * 0.035;
      }
      if (binoculars) binoculars.rotation.x = 0.54 * turn;
      renderSafely();
    }
    schedule();
  }

  function schedule() {
    if (!frame && !disposed && running && loaded)
      frame = requestAnimationFrame(tick);
  }

  function move(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !running) return;
    const bounds = area.getBoundingClientRect();
    pointer = Math.max(
      -1,
      Math.min(1, (2 * (event.clientX - bounds.left)) / bounds.width - 1),
    );
  }

  function leave() {
    pointer = 0;
  }
  function readClue() {
    clueProgress = Number(area.dataset.clueProgress ?? 0);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    fail();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(area);
  area.addEventListener('pointermove', move, { passive: true });
  area.addEventListener('pointerleave', leave);
  area.addEventListener('reunite:clue', readClue);
  readClue();
  canvas.addEventListener('webglcontextlost', contextLost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    area.removeEventListener('pointermove', move);
    area.removeEventListener('pointerleave', leave);
    area.removeEventListener('reunite:clue', readClue);
    canvas.removeEventListener('webglcontextlost', contextLost);
    disposeSceneResources(scene);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  function fail() {
    if (disposed) return;
    dispose();
    onFailure();
  }

  const ready = (async () => {
    const response = await fetch(asset, { signal });
    if (!response.ok) throw new Error('Landing stage unavailable');
    const bytes = await response.arrayBuffer();
    if (signal.aborted || disposed) throw new Error('Landing stage stopped');
    const model = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(bytes, '');
    if (signal.aborted || disposed) {
      disposeSceneResources(model.scene);
      throw new Error('Landing stage stopped');
    }
    scene.add(model.scene);
    umbrella = model.scene.getObjectByName('Umbrella');
    binoculars = model.scene.getObjectByName('Binoculars');
    ['Agent', 'Scout', 'Keeper'].forEach((name, phase) => {
      const object = model.scene.getObjectByName(name);
      if (object) actors.push({ object, angle: object.rotation.y, phase });
    });
    resize();
    draw();
    loaded = true;
    schedule();
  })();

  return {
    ready,
    setRunning(next) {
      running = next;
      if (next) schedule();
      else stop();
    },
    setFocus(name) {
      focus = name;
      const actor = actors.find(({ object }) => object.name === name)?.object;
      if (actor) {
        target.copy(actor.position);
        target.y += actor.scale.y * 1.48;
        zoomTarget = actor.name === 'Agent' ? 1.29 : 1.54;
      } else {
        target.set(...cameraTarget);
        zoomTarget = 1;
      }
      if (!running && loaded && !disposed) {
        aim.copy(target);
        camera.zoom = zoomTarget;
        camera.updateProjectionMatrix();
        renderSafely();
      }
    },
    dispose,
  };
}

function smoothstep(value: number) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}
