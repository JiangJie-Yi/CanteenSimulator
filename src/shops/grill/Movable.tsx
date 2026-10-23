// A piece of the shop's furnishing that can be moved by hand in edit mode (edit.ts): its children sit in a group offset by the piece's saved
// offset (in its parent's own units), and while editing a pale blue box shows round it to be taken hold of and dragged over the floor
// (Shift lifts it). Wrap it round a StaticBatch, not inside one: the batch's baked meshes then move with the group.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { commitOffsets, moveTo, offsetOf, registerMovable, useEdit, type V3 } from './edit'

type Controls = { enabled: boolean; target?: THREE.Vector3; update?: () => void } | null

/** bring the camera round to look at a point, as far off as it was (but no further than six) */
export function focusCamera(camera: THREE.Camera, controls: Controls, p: THREE.Vector3) {
  if (!controls?.target) return
  const off = camera.position.clone().sub(controls.target)
  off.setLength(Math.min(off.length(), 6) || 4)
  controls.target.copy(p)
  camera.position.copy(p.clone().add(off))
  controls.update?.()
}

export function Movable({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, offsets, selected } = useEdit()
  const [box, setBox] = useState<{ c: V3; s: V3 } | null>(null)
  const o = offsets[id] ?? [0, 0, 0]

  /** its size as it is, in its own frame (the box round whatever's in it; the handle itself left out) */
  const measure = () => {
    const grp = g.current
    if (!grp) return null
    grp.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert()
    const b = new THREE.Box3()
    grp.traverse((m) => {
      if (!(m instanceof THREE.Mesh) || m.userData.editHandle) return
      m.geometry.computeBoundingBox()
      if (!m.geometry.boundingBox) return
      b.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)))
    })
    if (b.isEmpty()) return { c: [0, 0.3, 0] as V3, s: [0.5, 0.6, 0.5] as V3 }
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3())
    return { c: [c.x, c.y, c.z] as V3, s: [Math.max(s.x, 0.2) + 0.06, Math.max(s.y, 0.2) + 0.06, Math.max(s.z, 0.2) + 0.06] as V3 }
  }

  // (on the list of what can be moved, with a way to bring the camera to the middle of it)
  useEffect(() => registerMovable(id, label, () => {
    const m = measure()
    if (m && g.current) focusCamera(camera, controls, g.current.localToWorld(new THREE.Vector3(...m.c)))
  }), [id, label, camera, controls])

  // (its box, taken when editing begins)
  useEffect(() => { setBox(on ? measure() : null) }, [on])

  const down = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const grp = g.current
    if (!on || !grp || !grp.parent) return
    e.stopPropagation()
    const lift = e.nativeEvent.shiftKey
    const wp = grp.getWorldPosition(new THREE.Vector3())
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -wp.y)
    if (lift) {
      plane.normal.copy(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate())
      plane.constant = -plane.normal.dot(wp)
    }
    const at = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      return raycaster.ray.intersectPlane(plane, new THREE.Vector3())
    }
    let last = at(e.nativeEvent)
    if (!last) return
    moveTo(id, offsetOf(id))
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const q = at(ev)
      if (!q || !last || !grp.parent) return
      // (the move in the world, taken into the piece's parent's own frame)
      const d = grp.parent.worldToLocal(q.clone()).sub(grp.parent.worldToLocal(last.clone()))
      const n = offsetOf(id)
      moveTo(id, [n[0] + d.x, n[1] + d.y, n[2] + d.z])
      last = q
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  return (
    <group ref={g} position={o}>
      {children}
      {on && box && (
        <mesh userData={{ editHandle: true }} position={box.c} renderOrder={999} onPointerDown={down}>
          <boxGeometry args={box.s} />
          <meshBasicMaterial color={selected === id ? '#ffb23f' : '#3fa9ff'} transparent opacity={0.26} depthWrite={false} depthTest={false} />
        </mesh>
      )}
    </group>
  )
}
