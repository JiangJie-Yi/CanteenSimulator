// Fewer shader programs (the owner's: on a Mac with 8 GB the GPU process crashed: Metal keeps 64 compiled pipelines, the scene needed 130+,
// and as they were thrown out and rebuilt the floor, the bar and the lanterns went black before it gave up). three compiles one program for
// every different set of features a material uses: a toon material with a map and one without are two, one with a gradient map and one with
// three's own steps are two, Physical and Standard are two. So before a material is first drawn (or compiled ahead), it's given the
// features it lacks in a form that changes nothing on screen, and the many kinds fall together into a few:
//   - no map, emissive map, roughness / metalness map: a 1x1 white one (multiplies by 1)
//   - no normal map: a 1x1 flat one (the normal it already had)
//   - a toon material without a gradient map: three's own steps as one (0.7 below, 1 above: the same light)
//   - alphaTest 0: a tiny one (only a pixel that's all but invisible is dropped)
//   - Physical: drawn as Standard (clearcoat, sheen, iridescence off: a slight gloss lost on a few pieces)
// Left alone: shader materials, points, sprites, lines; materials that change their own shader (onBeforeCompile: they're programs of their
// own anyway, and their code may read the maps; `userData.normalize` lets one in that doesn't mind); and any with `userData.keepProgram`.
// And one-sided and two-sided fall together (`oneProgramForSides`): which faces are drawn is the GL's cull state, not the program; the
// two-sided program only turns the normal of a face seen from behind, which is what a back-sided one's own program does to all of its.
// Two-sided transparent ones are drawn in one pass (three draws, and compiles, the back and the front apart).
// And a shadow's depth material is given the white map and the tiny alphaTest too (`shadowDepth`).
import * as THREE from 'three'
import { capMaterial } from './textureCap'

const white = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()
const flatNormal = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()
/** three's toon lighting without a gradient map: 0.7 up to 0.7 of the way, then 1 */
const toonSteps = (() => {
  const g = new Uint8Array(10 * 4)
  for (let i = 0; i < 10; i++) { const v = i < 7 ? 179 : 255; g.set([v, v, v, 255], i * 4) }
  const t = new THREE.DataTexture(g, 10, 1)
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

/** whether a texture is the white one given here to a material without a picture (not a picture of its own) */
export const isDummyMap = (t: THREE.Texture | null | undefined) => t === white
/** whether a normal map is the flat one given here to a material without one */
export const isFlatNormal = (t: THREE.Texture | null | undefined) => t === flatNormal

const done = new WeakSet<THREE.Material>()
const plainCompile = THREE.Material.prototype.onBeforeCompile


type Any = THREE.Material & Record<string, any>
export function normalizeMaterial(mat: THREE.Material) {
  if (done.has(mat)) return
  done.add(mat)
  // (its pictures within what the machine affords: scene/textureCap)
  capMaterial(mat)
  const m = mat as Any
  if (!(m.isMeshToonMaterial || m.isMeshStandardMaterial || m.isMeshBasicMaterial)) return
  // (one that changes its own shader is left alone, unless it says its code doesn't mind (`userData.normalize`: the food's charring))
  if (m.userData?.keepProgram || (m.onBeforeCompile !== plainCompile && !m.userData?.normalize)) return
  const lit = !m.isMeshBasicMaterial
  if (!m.map) m.map = white
  if (lit && !m.emissiveMap) m.emissiveMap = white
  if (lit && !m.normalMap) m.normalMap = flatNormal
  if (m.isMeshToonMaterial && !m.gradientMap) m.gradientMap = toonSteps
  if (m.isMeshStandardMaterial) {
    if (!m.roughnessMap) m.roughnessMap = white
    if (!m.metalnessMap) m.metalnessMap = white
  }
  if (m.isMeshPhysicalMaterial && !m.transmission) {
    m.clearcoat = 0
    m.sheen = 0
    m.iridescence = 0
    m.anisotropy = 0
    if (!m.dispersion) m.defines = { STANDARD: '' }
  }
  if (m.alphaTest === 0) m.alphaTest = 0.002
  m.needsUpdate = true
}

const normalizeAll = (m: THREE.Material | THREE.Material[]) => { if (Array.isArray(m)) m.forEach(normalizeMaterial); else normalizeMaterial(m) }

/**
 * Whether a material drawn with `side` is drawn with the two-sided program. It's the same picture: the two-sided program turns the normal of a
 * face the GL sees from behind (gl_FrontFacing false). A front-sided one is drawn with the back faces culled, so every face it draws is seen
 * from the front (three turns the GL's front face for a mirrored object); a back-sided one is drawn with the front faces culled (not, as three
 * does, with the GL's front face turned round, which would make its faces seen from the front and leave their normals unturned), so every face
 * it draws is seen from behind and turned, as its own program would. Built-in materials only: a shader of one's own might read the side its
 * own way.
 */
function oneProgramForSides(m: Any, side: THREE.Side) {
  if (side === THREE.DoubleSide || m.isShaderMaterial || m.userData?.keepProgram) return false
  return !!(m.isMeshToonMaterial || m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshDepthMaterial || m.isMeshDistanceMaterial)
}

/**
 * A shadow's depth material given the white map and the tiny alphaTest too: three draws the shadow of a material without a picture with a
 * depth material of its own (and one with a picture with a copy of it), each a program; it's handed the source material's map and alphaTest
 * just before each draw, so it's given the missing ones here every time, after.
 */
function shadowDepth(m: Any) {
  if (!(m.isMeshDepthMaterial || m.isMeshDistanceMaterial) || m.onBeforeCompile !== plainCompile) return
  if (!m.map) m.map = white
  if (m.alphaTest === 0) m.alphaTest = 0.002
}

/** every material the renderer draws or compiles, normalised the first time it's met */
export function normalizeRenderer(r: THREE.WebGLRenderer) {
  const draw = r.renderBufferDirect.bind(r)
  // (the material being drawn with the two-sided program, and the side it's really drawn with: the cull state is set from it)
  let held: Any | null = null
  let heldSide: THREE.Side = THREE.FrontSide
  const setMaterial = r.state.setMaterial.bind(r.state)
  r.state.setMaterial = (material, ...rest) => {
    // (any other back to culling back faces, after a back-sided one; not a two-sided one: setCullFace turns culling on)
    if (material !== held) { setMaterial(material, ...rest); if (material.side !== THREE.DoubleSide) r.state.setCullFace(THREE.CullFaceBack); return }
    // (culled as a front-sided one, the GL's front face as for it; then a back-sided one's front faces culled instead of its back)
    material.side = THREE.FrontSide
    setMaterial(material, ...rest)
    r.state.setCullFace(heldSide === THREE.BackSide ? THREE.CullFaceFront : THREE.CullFaceBack)
    material.side = THREE.DoubleSide
  }
  r.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    normalizeMaterial(material)
    shadowDepth(material as Any)
    const side = material.side
    const swap = oneProgramForSides(material as Any, side)
    if (swap) { held = material as Any; heldSide = side; material.side = THREE.DoubleSide }
    try { draw(camera, scene, geometry, material, object, group) } finally { if (swap) { material.side = side; held = null } }
    // (in development, `__progSeen = new Set()` gathers the programs actually drawn with, to set against all that are held)
    if (import.meta.env.DEV) { const seen = (window as { __progSeen?: Set<number> }).__progSeen; if (seen) { const pr = r.properties.get(material) as { currentProgram?: { id: number } }; if (pr.currentProgram) seen.add(pr.currentProgram.id) } }
  }
  // (a transparent two-sided material drawn in one pass, as ShadowPacer has them all now and then: three otherwise draws, and compiles, its
  // back and its front apart, with a back-sided program of its own besides)
  const single = (m: THREE.Material) => { if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true }
  const visit = (o: THREE.Object3D) => o.traverse((c) => { const m = (c as THREE.Mesh).material; if (m) { normalizeAll(m); ([] as THREE.Material[]).concat(m).forEach(single) } })
  // (and the scene gone through before it's drawn, now and then: the shadows are drawn first, and the depth material three makes for a
  // shadow follows the material's features as they are then: one met first there was made a shadow program of its own, kept for good)
  const render = r.render.bind(r)
  let frame = 0
  r.render = (scene, camera) => {
    if (frame++ % 20 === 0) visit(scene)
    render(scene, camera)
  }
  // (compiled ahead with the program it'll be drawn with: two-sided, in one pass: a transparent two-sided material is otherwise compiled for
  // its back and its front apart; compileAsync goes through compile)
  const compile = r.compile.bind(r)
  r.compile = (o, camera, target) => {
    visit(o)
    const was: [Any, THREE.Side, boolean][] = []
    o.traverse((c) => { for (const m of ([] as Any[]).concat((c as THREE.Mesh).material ?? [])) if (oneProgramForSides(m, m.side)) { was.push([m, m.side, m.forceSinglePass]); m.side = THREE.DoubleSide; m.forceSinglePass = true } })
    try { return compile(o, camera, target) } finally { for (const [m, side, single] of was) { m.side = side; m.forceSinglePass = single } }
  }
}
