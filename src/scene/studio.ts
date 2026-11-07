// A bright little room for polished metal to reflect (three's RoomEnvironment, rendered once): gold, brass and chrome only look like metal
// by what they reflect, so they're given this whatever the shop's own light.
import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

let studio: THREE.Texture | null = null
const waiting = new Set<THREE.MeshStandardMaterial>()
/** every material given the studio, with how strongly it reflects it at full light; and how much of the light there is now (setStudioLight) */
const given = new Map<THREE.MeshStandardMaterial, number>()
let level = 1

/** give these materials the studio to reflect (now, or as soon as a renderer's there to make it) */
export function reflectStudio(...mats: THREE.MeshStandardMaterial[]) {
  for (const m of mats) {
    if (!given.has(m)) given.set(m, m.envMapIntensity)
    m.envMapIntensity = given.get(m)! * level
    if (studio) { m.envMap = studio; m.needsUpdate = true } else waiting.add(m)
  }
}

/** how much of the studio's light the metal reflects (1 all of it): the room's light, so the gold and brass don't shine in the dark */
export function setStudioLight(k: number) {
  level = k
  for (const [m, base] of given) m.envMapIntensity = base * k
}

/** make the studio, once, with this renderer (call it from any component that shows polished metal) */
export function useStudio() {
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    if (!studio) {
      const pm = new THREE.PMREMGenerator(gl)
      // (blurred a little: polished metal shows the room's light as soft broad gleams, not the box lights' hard spots)
      const room = new RoomEnvironment()
      studio = pm.fromScene(room, 0.08).texture
      pm.dispose()
      // (its room's materials let go too: kept, their shader programs stayed held for good)
      room.dispose()
    }
    for (const m of waiting) { m.envMap = studio; m.needsUpdate = true }
    waiting.clear()
  }, [gl])
}
