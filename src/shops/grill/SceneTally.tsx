import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { getEdit, setSceneTris } from './edit'

/**
 * While edit mode is on, the whole scene's triangles counted every second and a half for the panel: every mesh drawn (it and everything
 * over it shown, on a layer the camera sees), instanced ones times their count, the ink outlines included (they're drawn too).
 */
export function SceneTally() {
  const scene = useThree((s) => s.scene)
  const t = useRef(0)
  useFrame(({ camera }, dt) => {
    if (!getEdit().on) { t.current = 1.5; return }
    t.current += dt
    if (t.current < 1.5) return
    t.current = 0
    let tris = 0
    const walk = (o: THREE.Object3D) => {
      if (!o.visible) return
      const m = o as THREE.Mesh
      if (m.isMesh && m.geometry && camera.layers.test(m.layers)) {
        const g = m.geometry
        const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1
        tris += ((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3) * n
      }
      for (const c of o.children) walk(c)
    }
    walk(scene)
    setSceneTris(Math.round(tris))
  })
  return null
}
