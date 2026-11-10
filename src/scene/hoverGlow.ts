import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { isInk } from './inkHull'
import { warmLater } from './Prewarm'

/**
 * The "you're pointing at this" glow for anything that can be clicked or carried: while the pointer is over it, a soft warm halo round its
 * outline (the owner's, 2026-11-10: it used to give every mesh a copy of its materials with a warm emissive, which flattened the thing into a
 * plain orange or white block and lost its own shading; now its own materials are left as they are). Each mesh under it gets a hull: its back
 * faces pushed out a few pixels on the screen along their normals (as wide near or far), a warm colour fading out toward the halo's outer
 * edge; drawn behind the thing's own faces, only the rim round it shows. Taken away when the pointer leaves.
 */
const GLOW = new THREE.ShaderMaterial({
  uniforms: {
    uWidth: { value: 4 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uColor: { value: new THREE.Color('#ffb24a') },
    uOpacity: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    uniform float uWidth;
    uniform vec2 uRes;
    varying float vFacing;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <defaultnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
      // (the normal, out of the surface (three turns it round for a back-sided material)); pushed that way on the screen, uWidth pixels
      vec3 n = normalize(transformedNormal);
      #ifdef FLIP_SIDED
        n = -n;
      #endif
      vec2 d = (projectionMatrix * vec4(n, 0.0)).xy;
      float l = length(d);
      if (l > 1e-5) gl_Position.xy += d / l * uWidth * 2.0 / uRes * gl_Position.w;
      vFacing = abs(dot(n, normalize(-mvPosition.xyz)));
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vFacing;
    void main() {
      // (strongest where it meets the thing, fading toward its outer edge, where the hull turns edge on)
      gl_FragColor = vec4(uColor, uOpacity * (0.25 + 0.75 * smoothstep(0.0, 0.5, vFacing)));
    }`,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
})
GLOW.name = 'HoverGlow'
// (the glow's own: not to be given the shop's usual white maps and the like (scene/materialNormalize))
GLOW.userData.keepProgram = true
/** its second layer, wider and fainter round the first: the halo soft, not a hard line (the same program: only its uniforms differ) */
const SOFT = GLOW.clone()
SOFT.uniforms.uColor = { value: new THREE.Color('#ffd27a') }
SOFT.uniforms.uOpacity = { value: 0.32 }
SOFT.name = 'HoverGlowSoft'
SOFT.userData.keepProgram = true
const RES = new THREE.Vector2()
/** each layer's width in CSS pixels */
const WIDTH = new Map<THREE.ShaderMaterial, number>([[GLOW, 2.6], [SOFT, 7]])

/** the shape a hull's made of: hard-edged ones welded (their normals averaged where faces meet, so pushed out the hull stays closed round the
 * corners); a skinned one's own (it carries the bones' weights); each made once */
const WELDED = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()
function hullShape(m: THREE.Mesh) {
  const g = m.geometry
  if ((m as THREE.SkinnedMesh).isSkinnedMesh) return g
  let w = WELDED.get(g)
  if (!w) {
    const p = new THREE.BufferGeometry()
    p.setAttribute('position', g.attributes.position)
    if (g.index) p.setIndex(g.index)
    // (a draw range kept: a counted batch draws only some of its shape)
    w = mergeVertices(p, 1e-5)
    w.computeVertexNormals()
    WELDED.set(g, w)
  }
  return w
}
/** whether a mesh gets a halo: not an ink line, not an unseen hit box (a see-through or colourless material), not one whose own shader cuts
 * it to a shape (the round window's panes slide into the wall: a hull would show them whole) */
function glows(m: THREE.Mesh) {
  const mats = ([] as THREE.Material[]).concat(m.material)
  if (!mats.length || mats.some((x) => !x)) return false
  if (mats.every((x) => isInk(x) || x === GLOW || x === SOFT)) return false
  if (mats.every((x) => !x.visible || !x.colorWrite || (x.transparent && x.opacity < 0.05))) return false
  if (mats.some((x) => x.userData?.noGlowHull)) return false
  return !!m.geometry?.attributes?.position && !!m.geometry.attributes.normal
}
/** a hull for the mesh in one of the glow's layers: a mesh of the same kind (skinned on its skeleton, instanced over its instances) of its
 * shape */
function hullFor(m: THREE.Mesh, mat: THREE.ShaderMaterial) {
  const shape = hullShape(m)
  let h: THREE.Mesh
  if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
    const s = m as THREE.SkinnedMesh
    const k = new THREE.SkinnedMesh(shape, mat)
    k.bind(s.skeleton, s.bindMatrix)
    k.bindMode = s.bindMode
    h = k
  } else if ((m as THREE.InstancedMesh).isInstancedMesh) {
    const src = m as THREE.InstancedMesh
    const k = new THREE.InstancedMesh(shape, mat, src.count)
    k.instanceMatrix = src.instanceMatrix
    k.count = src.count
    h = k
  } else h = new THREE.Mesh(shape, mat)
  // (a skinned or instanced mesh's own bounds may not cover where it's drawn: the hull drawn whenever its mesh is)
  h.frustumCulled = false
  h.raycast = () => {}
  h.castShadow = false
  h.receiveShadow = false
  // (the soft layer first, the line over it)
  h.renderOrder = mat === SOFT ? 2 : 3
  h.userData.glowHull = true
  h.userData.inked = true
  h.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(RES)
    mat.uniforms.uRes.value.copy(RES)
    mat.uniforms.uWidth.value = (WIDTH.get(mat) ?? 3) * renderer.getPixelRatio()
  }
  return h
}

/** the hulls round each lit thing's meshes */
const HULLS = new Map<THREE.Object3D, THREE.Mesh[]>()

/** while edit mode is on, nothing in the room lights up under the pointer (edit.ts sets it) */
export const HOVER = { paused: false }

export function glowOn(root: THREE.Object3D | null | undefined) {
  if (!root || HULLS.has(root) || HOVER.paused) return
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !m.userData.glowHull && glows(m)) meshes.push(m)
  })
  const hulls: THREE.Mesh[] = []
  for (const m of meshes) for (const mat of [SOFT, GLOW]) {
    const h = hullFor(m, mat)
    m.add(h)
    hulls.push(h)
  }
  HULLS.set(root, hulls)
}

export function glowOff(root: THREE.Object3D | null | undefined) {
  if (!root) return
  const hulls = HULLS.get(root)
  if (!hulls) return
  HULLS.delete(root)
  for (const h of hulls) h.removeFromParent()
}

/** the one thing lit by the pointer just now (moving to another puts the last one out) */
let current: THREE.Object3D | null = null
export function glowOnly(root: THREE.Object3D | null | undefined) {
  if (root === current) return
  glowOff(current)
  current = root ?? null
  glowOn(current)
}
/** the pointer has left this one: put it out, and only it (what's lit now may be something else, lit since, that stays lit) */
export function glowLeave(root: THREE.Object3D | null | undefined) {
  if (!root) return
  if (root === current) glowOnly(null)
  else glowOff(root)
}

// (its programs made while the shop loads, not the first time something's pointed at: one for a plain mesh, one for a skinned one (the
// customers, lit as they're picked up), one for an instanced one)
if (typeof document !== 'undefined') {
  const box = new THREE.BoxGeometry(0.01, 0.01, 0.01)
  const plain = new THREE.Mesh(box, GLOW)
  const sg = box.clone()
  const n = sg.attributes.position.count
  sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4))
  sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => (i % 4 ? 0 : 1)), 4))
  const skinned = new THREE.SkinnedMesh(sg, GLOW)
  const bone = new THREE.Bone()
  skinned.add(bone)
  skinned.bind(new THREE.Skeleton([bone]))
  const inst = new THREE.InstancedMesh(box, GLOW, 1)
  const warm = new THREE.Group()
  warm.add(plain, skinned, inst)
  warmLater(warm)
}
