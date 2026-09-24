import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Character, CharacterState } from "./character";

export type { Character, CharacterState };

// Served from OSS CDN to keep the 1.6MB binary out of the repo. The bucket must
// allow cross-origin GET (Access-Control-Allow-Origin) for the site + localhost,
// or the browser blocks this fetch.
const MODEL_URL = "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/2026/09/24/1790242230220_trudbot.glb";

// The model's local bbox is ~1 unit tall; scale it to stand about as tall as the
// procedural character it replaces. Bump if trudbot looks too short/tall.
const MODEL_HEIGHT = 1.6;

// The engine yaws root by `facing`, where 0 points down +Z. The Tripo rig's
// forward axis (where the run animation and the face point) sits 90° clockwise
// from that, so add a quarter turn to line the run direction up with travel.
const FACING_OFFSET = -Math.PI / 2;

// Cross-fade time between animation states.
const FADE = 0.2;

type ClipName = "idle" | "run" | "jump" | "dance_02" | "bow";

// The Tripo clips (notably `run`) bake forward travel into the root bones, so the
// mesh would slide inside `root` and snap back when a non-travelling clip takes
// over. The engine owns world position, so pin any root-bone axis with sustained
// net displacement to its first frame — that drops locomotion while keeping the
// cyclic bob/sway (which nets to ~0 over a loop).
const ROOT_BONES = ["Root", "Hip"];
const DRIFT_THRESHOLD = 0.2;

function stripRootMotion(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    const node = track.name.slice(0, track.name.lastIndexOf("."));
    if (!track.name.endsWith(".position") || !ROOT_BONES.includes(node)) continue;
    const v = track.values;
    const frames = v.length / 3;
    for (let axis = 0; axis < 3; axis++) {
      const first = v[axis];
      if (Math.abs(v[(frames - 1) * 3 + axis] - first) <= DRIFT_THRESHOLD) continue;
      for (let f = 0; f < frames; f++) v[f * 3 + axis] = first;
    }
  }
}

export function createCharacter(): Character {
  const root = new THREE.Group();

  // The engine parents pickups (the flower) here before the GLB finishes loading,
  // so it must exist synchronously; it is reparented under the hand bone on load.
  const hand = new THREE.Group();
  root.add(hand);

  // A middle group absorbs the model's scale, facing offset and landing squash,
  // leaving root as a clean pivot the engine positions/rotates/scales.
  const rig = new THREE.Group();
  rig.rotation.y = FACING_OFFSET;
  root.add(rig);

  let mixer: THREE.AnimationMixer | null = null;
  const actions = new Map<ClipName, THREE.AnimationAction>();
  let current: ClipName | null = null;
  let runDuration = 1;
  let squash = 0;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const scale = MODEL_HEIGHT / (box.max.y - box.min.y || 1);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale; // feet on the ground plane
    rig.add(model);

    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        // Skinned-mesh bounds ignore the animated pose, so leaving culling on
        // pops the character out of view mid-animation.
        m.frustumCulled = false;
      }
    });

    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      stripRootMotion(clip);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions.set(clip.name as ClipName, action);
      if (clip.name === "run") runDuration = clip.duration;
    }
    const idle = actions.get("idle");
    if (idle) {
      idle.play();
      current = "idle";
    }

    const handBone = model.getObjectByName("R_Hand");
    if (handBone) handBone.add(hand); // add() detaches it from root automatically
  });

  const play = (name: ClipName, speed = 1) => {
    const next = actions.get(name);
    if (!next) return;
    next.timeScale = speed;
    if (current === name) return;
    const prev = current ? actions.get(current) : null;
    next.reset().fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    current = name;
  };

  const update = (dt: number, _t: number, s: CharacterState) => {
    if (!mixer) return;
    if (s.emote === "dance") play("dance_02");
    else if (s.emote === "wave") play("bow");
    else if (!s.grounded) play("jump");
    else if (s.speed > 0.6) play("run", THREE.MathUtils.clamp(0.6 + s.speed / 6, 0.8, 1.8));
    else play("idle");
    mixer.update(dt);

    squash += (0 - squash) * (1 - Math.exp(-9 * dt));
    rig.scale.set(1 + squash * 0.15, 1 - squash * 0.2, 1 + squash * 0.15);
  };

  return {
    root,
    hand,
    update,
    land(impact: number) {
      squash = Math.min(1, squash + impact);
    },
    stepPhase() {
      const run = current === "run" ? actions.get("run") : null;
      if (!run) return 0;
      return (((run.time / runDuration) % 1) + 1) % 1;
    },
  };
}
