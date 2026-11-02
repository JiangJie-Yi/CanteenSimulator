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
      Promise.all([gl.compileAsync(scene, camera), ...[...later].map((o) => gl.compileAsync(o, camera, scene))])
        .catch(() => undefined)
        .then(() => {
          if (import.meta.env.DEV) console.info(`[prewarm] ${Math.round(performance.now() - t0)} ms, ${later.size} templates, ${gl.info.programs?.length ?? '?'} programs`)
          later.clear()
          warmNow = (o) => { gl.compileAsync(o, camera, scene).catch(() => undefined) }
          release()
        })
    }, 250)
    return () => { window.clearInterval(tick); release(); warmNow = null }
  }, [gl, scene, camera])
  return null
}
