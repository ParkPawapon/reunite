import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/** Local daylight for PBR reflections; no remote imagery or texture requests. */
export function createDaylightEnvironment(renderer: WebGLRenderer) {
  const environment = new Scene();
  const sky = new Sky();
  sky.scale.setScalar(200);
  const ground = new Mesh(
    new PlaneGeometry(400, 400),
    new MeshBasicMaterial({ color: '#b0a899' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -10;
  environment.add(sky, ground);
  const generator = new PMREMGenerator(renderer);
  try {
    // The directional light supplies the sun; avoid a second specular disc.
    for (const [name, value] of Object.entries({
      turbidity: 3.5,
      rayleigh: 1.2,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.7,
      sunPosition: new Vector3(-320, 540, 220).normalize(),
      showSunDisc: false,
    })) {
      const uniform = sky.material.uniforms[name];
      if (!uniform) throw new Error(`Missing daylight uniform: ${name}`);
      uniform.value = value;
    }
    return generator.fromScene(environment, 0.04, 0.1, 300, { size: 256 });
  } finally {
    generator.dispose();
    sky.geometry.dispose();
    sky.material.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
  }
}
