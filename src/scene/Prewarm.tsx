import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { holdVeil, laterPending, laterSeen, sceneDrawn } from './Later'

/**
 * Shader programs linked while the page loads, not the first time each thing is drawn. A dish's food (once it's ordered), the first
 * customer, the coins in the drawer, the coal in the fire: each, the first time it showed, stopped the picture for a tenth of a second to
 * over half a second while its program was linked (ANGLE turns each into Direct3D's on the spot). Once the whole shop is in (every stage
 * mounted, the scene drawn), every material in it, the hidden ones too, is compiled, and so is each template warmLater() was given (what
 * things made only later are copied from); the loading veil waits till they're ready. The programs are kept as long as their materials
 * are: the ones the later things use.
 */
const later = new Set<THREE.Object3D>()
/** once the page's compiling is done: compiles what's given it straight away (a template that came after) */
let warmNow: ((o: THREE.Object3D) => void) | null = null
/** a template of things made only later (copies of it, on its materials), to compile with the scene while the page loads */
export function warmLater(o: THREE.Object3D) {
  if (warmNow) warmNow(o)
  else later.add(o)
}

/** a material whose customProgramCacheKey isn't a function (given a string, or not a material at all) stops three's compile with
 * "material.customProgramCacheKey is not a function": compile goes through the hidden meshes too, so one there held the loading veil
 * for good. Such a one is put back to three's own key (or none) and named in the console, so where it was set can be found. */
function mendKeys(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.material) return
    for (const x of ([] as THREE.Material[]).concat(m.material)) {
      if (!x || typeof x.customProgramCacheKey === 'function') continue
      console.warn(`[prewarm] ${o.name || o.type}: material "${x.name}" (${x.type}) had a customProgramCacheKey that isn't a function:`, x.customProgramCacheKey)
      delete (x as { customProgramCacheKey?: unknown }).customProgramCacheKey
      if (typeof x.customProgramCacheKey !== 'function') x.customProgramCacheKey = () => ''
    }
  })
}

/** compiles what it's given, a throw (a material three can't take) caught here: it mustn't keep the veil down */
function compileSafe(gl: THREE.WebGLRenderer, o: THREE.Object3D, camera: THREE.Camera, scene?: THREE.Scene) {
  try {
    mendKeys(o)
    return gl.compileAsync(o, camera, scene ?? null).catch((e) => { console.error('[prewarm]', e) })
  } catch (e) {
    console.error('[prewarm]', e)
    return Promise.resolve()
  }
}

export function Prewarm() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const release = holdVeil('prewarm')
    let started = false
    const tick = window.setInterval(() => {
      // (everything else in: the stages mounted and the shop drawn, nothing held but this)
      if (started || !laterSeen() || laterPending() > 1 || !sceneDrawn()) return
      started = true
      window.clearInterval(tick)
      const t0 = performance.now()
      Promise.all([compileSafe(gl, scene, camera), ...[...later].map((o) => compileSafe(gl, o, camera, scene))])
        .catch(() => undefined)
        .then(() => {
          if (import.meta.env.DEV) console.info(`[prewarm] ${Math.round(performance.now() - t0)} ms, ${later.size} templates, ${gl.info.programs?.length ?? '?'} programs`)
          later.clear()
          warmNow = (o) => { void compileSafe(gl, o, camera, scene) }
        })
        .finally(release)
    }, 250)
    return () => { window.clearInterval(tick); release(); warmNow = null }
  }, [gl, scene, camera])
  return null
}
