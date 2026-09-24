import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const FADE = 0.3;

/**
 * Standalone GLB viewer: orbit/drag/zoom the camera and cross-fade between the
 * model's own animation clips. Kept framework-agnostic so the React page only
 * has to mount/unmount it.
 */
export class TrudbotViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: string | null = null;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;

    // Soft studio IBL so the Tripo PBR materials read correctly without hunting
    // for HDR files; RoomEnvironment is generated procedurally.
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camera.position.set(0, 1.4, 3.2);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    const s = key.shadow.camera;
    s.near = 0.5;
    s.far = 30;
    s.left = s.bottom = -4;
    s.right = s.top = 4;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.6));

    // Shadow-catcher ground; invisible except for the drop shadow.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 12;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.8;
    // Keep the camera above the floor so orbiting never dips under the ground.
    this.controls.maxPolarAngle = Math.PI * 0.92;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.loop();
  }

  private resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    this.mixer?.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  async load(url: string): Promise<string[]> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    this.frame(model);
    this.scene.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set(clip.name, action);
    }
    const names = [...this.actions.keys()];
    const first = names.includes("idle") ? "idle" : names[0];
    if (first) this.play(first);
    return names;
  }

  /** Center the model on the origin, drop it onto the ground, and frame it. */
  private frame(model: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    const height = size.y || 1;
    this.controls.target.set(0, height * 0.5, 0);
    // The Tripo rig faces +X, so start the camera on +X for a head-on front view.
    const dist = height * 1.9;
    this.camera.position.set(dist, height * 0.62, 0);
    this.camera.near = dist / 100;
    this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  play(name: string) {
    const next = this.actions.get(name);
    if (!next || this.current === name) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    next.reset().fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    this.current = name;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
  }
}
