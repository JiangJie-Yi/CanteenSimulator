// A bright little room for polished metal to reflect (three's RoomEnvironment, rendered once): gold, brass and chrome only look like metal
// by what they reflect, so they're given this whatever the shop's own light.
import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

let studio: THREE.Texture | null = null
const waiting = new Set<THREE.MeshStandardMaterial>()

/** give these materials the studio to reflect (now, or as soon as a renderer's there to make it) */
export function reflectStudio(...mats: THREE.MeshStandardMaterial[]) {
  for (const m of mats) {
    if (studio) { m.envMap = studio; m.needsUpdate = true } else waiting.add(m)
  }
}

/** make the studio, once, with this renderer (call it from any component that shows polished metal) */
export function useStudio() {
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    if (!studio) {
      const pm = new THREE.PMREMGenerator(gl)
      studio = pm.fromScene(new RoomEnvironment(), 0.04).texture
      pm.dispose()
    }
    for (const m of waiting) { m.envMap = studio; m.needsUpdate = true }
    waiting.clear()
  }, [gl])
}
