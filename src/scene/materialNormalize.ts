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
import * as THREE from 'three'

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

const done = new WeakSet<THREE.Material>()
const plainCompile = THREE.Material.prototype.onBeforeCompile


type Any = THREE.Material & Record<string, any>
export function normalizeMaterial(mat: THREE.Material) {
  if (done.has(mat)) return
  done.add(mat)
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

/** every material the renderer draws or compiles, normalised the first time it's met */
export function normalizeRenderer(r: THREE.WebGLRenderer) {
  const draw = r.renderBufferDirect.bind(r)
  r.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    normalizeMaterial(material)
    draw(camera, scene, geometry, material, object, group)
    // (in development, `__progSeen = new Set()` gathers the programs actually drawn with, to set against all that are held)
    if (import.meta.env.DEV) { const seen = (window as { __progSeen?: Set<number> }).__progSeen; if (seen) { const pr = r.properties.get(material) as { currentProgram?: { id: number } }; if (pr.currentProgram) seen.add(pr.currentProgram.id) } }
  }
  const visit = (o: THREE.Object3D) => o.traverse((c) => { const m = (c as THREE.Mesh).material; if (m) normalizeAll(m) })
  // (and the scene gone through before it's drawn, now and then: the shadows are drawn first, and the depth material three makes for a
  // shadow follows the material's features as they are then: one met first there was made a shadow program of its own, kept for good)
  const render = r.render.bind(r)
  let frame = 0
  r.render = (scene, camera) => {
    if (frame++ % 20 === 0) visit(scene)
    render(scene, camera)
  }
  const compile = r.compile.bind(r)
  r.compile = (o, camera, target) => { visit(o); return compile(o, camera, target) }
  const compileAsync = r.compileAsync.bind(r)
  r.compileAsync = (o, camera, target) => { visit(o); return compileAsync(o, camera, target) }
}
