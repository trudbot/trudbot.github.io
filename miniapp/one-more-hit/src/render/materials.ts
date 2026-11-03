/*
 * Shared look: banded toon shading plus a view-space rim, and for breakable
 * targets a dent, glowing cracks that spread from the impact, and a separate
 * interior colour for fracture faces. All of it is injected into the stock
 * MeshToonMaterial so lights, shadows and fog keep working.
 */
import * as THREE from "three";

let ramp: THREE.DataTexture | null = null;
/** Three hard light bands; NearestFilter keeps the steps crisp. */
export function toonRamp() {
  if (ramp) return ramp;
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

export interface Look {
  color: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  rim?: number;
  rimColor?: THREE.ColorRepresentation;
  /** Colour of fracture faces (vertices with aInner = 1) and back faces. */
  interior?: THREE.ColorRepresentation;
  /** Enables dents and spreading cracks; the colour is the crack glow. */
  crack?: THREE.ColorRepresentation;
  /** Voronoi cell size of the crack pattern, in object units. */
  crackScale?: number;
  vertexColors?: boolean;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}

export interface FxUniforms {
  uRim: { value: number };
  uRimColor: { value: THREE.Color };
  uInterior: { value: THREE.Color };
  /** xyz: impact point in object space; w: crack reach in object units. */
  uCrack: { value: THREE.Vector4 };
  uCrackColor: { value: THREE.Color };
  uCrackGlow: { value: number };
  uCrackScale: { value: number };
  /** xyz: dent centre in object space; w: depth. */
  uDent: { value: THREE.Vector4 };
  uDentR: { value: number };
}

export type ToonMat = THREE.MeshToonMaterial & { fx: FxUniforms };

const VORONOI = /* glsl */ `
vec3 omhHash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
// Distance to the nearest Voronoi cell border: near zero reads as a crack.
float omhCrack(vec3 x) {
  vec3 p = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b + omhHash(p + b) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
`;

export function toon(look: Look): ToonMat {
  const m = new THREE.MeshToonMaterial({
    color: look.color,
    gradientMap: toonRamp(),
    emissive: look.emissive ?? 0x000000,
    emissiveIntensity: look.emissiveIntensity ?? 1,
    vertexColors: look.vertexColors ?? false,
    map: look.map ?? null,
    side: look.side ?? (look.interior ? THREE.DoubleSide : THREE.FrontSide),
    transparent: look.transparent ?? false,
    opacity: look.opacity ?? 1,
  }) as ToonMat;
  const crack = look.crack !== undefined;
  const interior = look.interior !== undefined;
  m.fx = {
    uRim: { value: look.rim ?? 0.5 },
    uRimColor: { value: new THREE.Color(look.rimColor ?? 0xffffff) },
    uInterior: { value: new THREE.Color(look.interior ?? 0x000000) },
    uCrack: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCrackColor: { value: new THREE.Color(look.crack ?? 0xffffff) },
    uCrackGlow: { value: 1 },
    uCrackScale: { value: 1 / (look.crackScale ?? 0.35) },
    uDent: { value: new THREE.Vector4(0, 0, 0, 0) },
    uDentR: { value: 0.3 },
  };
  m.customProgramCacheKey = () => `omh-${crack ? 1 : 0}${interior ? 1 : 0}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.fx);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${interior ? "attribute float aInner;" : "const float aInner = 0.0;"}
        varying float vInner;
        varying vec3 vObj;
        uniform vec4 uDent;
        uniform float uDentR;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vInner = aInner;
        vObj = position;
        ${crack ? "transformed -= normal * uDent.w * smoothstep(uDentR, 0.0, distance(position, uDent.xyz));" : ""}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vInner;
        varying vec3 vObj;
        uniform float uRim;
        uniform vec3 uRimColor;
        uniform vec3 uInterior;
        uniform vec4 uCrack;
        uniform vec3 uCrackColor;
        uniform float uCrackGlow;
        uniform float uCrackScale;
        ${crack ? VORONOI : ""}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        ${interior ? "float omhIn = max(vInner, gl_FrontFacing ? 0.0 : 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, uInterior, omhIn);" : ""}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        ${
          crack
            ? `float omhReach = smoothstep(uCrack.w, uCrack.w * 0.6, distance(vObj, uCrack.xyz)) * step(0.001, uCrack.w);
        float omhLine = 1.0 - smoothstep(0.02, 0.07, omhCrack(vObj * uCrackScale));
        float omhC = omhLine * omhReach;
        diffuseColor.rgb *= 1.0 - 0.75 * omhC;
        totalEmissiveRadiance += uCrackColor * omhC * uCrackGlow;
        ${interior ? "totalEmissiveRadiance += uCrackColor * omhIn * 0.35 * uCrackGlow;" : ""}`
            : ""
        }`,
      )
      .replace(
        "#include <opaque_fragment>",
        `float omhRim = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
        outgoingLight += uRimColor * omhRim * uRim;
        #include <opaque_fragment>`,
      );
  };
  return m;
}

/**
 * Interior materials read `aInner`; a geometry without it would pick up
 * whatever generic attribute value that slot last held, so give it zeros.
 */
export function withInner(geo: THREE.BufferGeometry) {
  if (!geo.attributes.aInner) geo.setAttribute("aInner", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
  return geo;
}

/** Inverted-hull outline: a back-face shell pushed out along the normals. */
export function outlineMat(width: number, color: THREE.ColorRepresentation = 0x1a1a2e) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.customProgramCacheKey = () => `omh-outline-${width}`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      transformed += normal * ${width.toFixed(4)};`,
    );
  };
  return m;
}

const outlineCache = new Map<string, THREE.MeshBasicMaterial>();
export function addOutline(mesh: THREE.Mesh, width = 0.025, color: THREE.ColorRepresentation = 0x1a1a2e) {
  const key = `${width}-${new THREE.Color(color).getHexString()}`;
  let m = outlineCache.get(key);
  if (!m) outlineCache.set(key, (m = outlineMat(width, color)));
  const o = new THREE.Mesh(mesh.geometry, m);
  o.name = "outline";
  mesh.add(o);
  return o;
}
