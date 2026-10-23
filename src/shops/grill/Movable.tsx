// A piece of the shop's furnishing that can be moved by hand in edit mode (edit.ts): its children sit in a group offset by the piece's saved
// offset (in its parent's own units), and while editing a pale blue box shows round it to be taken hold of and dragged over the floor
// (Shift lifts it). Wrap it round a StaticBatch, not inside one: the batch's baked meshes then move with the group.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { beginChange, commitOffsets, moveTo, offsetOf, positionOf, registerMovable, rotationOf, scaleOf, scaleTo, turnTo, useEdit, type V3 } from './edit'

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

const DEG = Math.PI / 180
/** an axis's letter on a round disc in its colour, drawn once */
const LETTERS = new Map<string, THREE.Texture>()
function letterTex(name: string, color: string) {
  const hit = LETTERS.get(name)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#ffffff'; g.lineWidth = 3
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#ffffff'
  g.font = 'bold 38px sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(name, 32, 35)
  const t = new THREE.CanvasTexture(c)
  LETTERS.set(name, t)
  return t
}
const AXES = [
  { v: [1, 0, 0] as V3, color: '#ff3b30', rot: [0, 0, -Math.PI / 2] as V3, name: 'X' },
  { v: [0, 1, 0] as V3, color: '#34c759', rot: [0, 0, 0] as V3, name: 'Y' },
  { v: [0, 0, 1] as V3, color: '#0a84ff', rot: [Math.PI / 2, 0, 0] as V3, name: 'Z' },
]
/**
 * The three axes of the selected piece (red X, green Y, blue Z, along the same axes as its X, Y, Z fields): drag an arrow to move it along
 * that axis alone. It stands in the piece's own group, at `at`, so it moves with it.
 */
export function AxisGizmo({ id, at, size = 0.5 }: { id: string; at: V3; size?: number }) {
  const root = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, selected, tool } = useEdit()
  if (!on || selected !== id) return null
  const down = (axis: 0 | 1 | 2) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    const dir = new THREE.Vector3(...AXES[axis].v).transformDirection(par.matrixWorld).normalize()
    // (how far along the axis the pointer's ray comes nearest to it: where the two lines are closest)
    const along = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      const v = raycaster.ray.direction, w0 = origin.clone().sub(raycaster.ray.origin)
      const b = dir.dot(v), d = dir.dot(w0), ee = v.dot(w0)
      const den = 1 - b * b
      return Math.abs(den) < 1e-4 ? null : (b * ee - d) / den
    }
    let last = along(e.nativeEvent)
    if (last === null) return
    beginChange()
    moveTo(id, offsetOf(id))
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const s1 = along(ev)
      if (s1 === null || last === null) return
      // (the way along the axis in the world, taken into the piece's parent's own frame: it's the one axis that changes)
      const p0 = origin.clone().addScaledVector(dir, last), p1 = origin.clone().addScaledVector(dir, s1)
      const d = par.worldToLocal(p1).sub(par.worldToLocal(p0))
      const n = [...offsetOf(id)] as V3
      n[axis] += [d.x, d.y, d.z][axis]
      moveTo(id, n)
      last = s1
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  // ---- turning: a ring round each axis; dragging round it turns the piece about that axis (the angle the pointer sweeps round the ring, from the piece's middle)
  const turn = (axis: 0 | 1 | 2) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    const normal = new THREE.Vector3(...AXES[axis].v).transformDirection(par.matrixWorld).normalize()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
    // (the pointer's place on the ring's plane, as an angle about the axis)
    const u = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(normal).normalize() : new THREE.Vector3(1, 0, 0).cross(normal).normalize()
    const v = normal.clone().cross(u)
    const angleAt = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      if (!hit) return null
      const d = hit.sub(origin)
      return Math.atan2(d.dot(v), d.dot(u))
    }
    let last = angleAt(e.nativeEvent)
    if (last === null) return
    beginChange()
    turnTo(id, rotationOf(id))
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const a1 = angleAt(ev)
      if (a1 === null || last === null) return
      let d = a1 - last
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      const n = [...rotationOf(id)] as V3
      n[axis] = Math.round((n[axis] + (d * 180) / Math.PI) * 10) / 10
      turnTo(id, n)
      last = a1
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  // ---- scaling: a cube at the end of each axis; dragging it out along the axis makes the piece larger on that axis, in toward the middle smaller (Shift: all three together)
  const grow = (axis: 0 | 1 | 2) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    const dir = new THREE.Vector3(...AXES[axis].v).transformDirection(par.matrixWorld).normalize()
    const along = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      const vv = raycaster.ray.direction, w0 = origin.clone().sub(raycaster.ray.origin)
      const b = dir.dot(vv), d = dir.dot(w0), ee = vv.dot(w0)
      const den = 1 - b * b
      return Math.abs(den) < 1e-4 ? null : (b * ee - d) / den
    }
    const start = along(e.nativeEvent)
    if (start === null || Math.abs(start) < 1e-3) return
    const from = [...scaleOf(id)] as V3
    beginChange()
    scaleTo(id, from)
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const s1 = along(ev)
      if (s1 === null) return
      // (the handle's distance from the middle against where it began: the same ratio is the new size)
      const k = Math.max(0.05, Math.min(20, s1 / start))
      const n = (ev.shiftKey ? [from[0] * k, from[1] * k, from[2] * k] : from.map((x, j) => (j === axis ? x * k : x))) as V3
      scaleTo(id, n.map((x) => Math.round(x * 100) / 100) as V3)
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  const L = size
  if (tool === 'rotate') {
    return (
      <group ref={root} position={at}>
        {AXES.map((a, i) => (
          <group key={a.name} rotation={a.rot} onPointerDown={turn(i as 0 | 1 | 2)}>
            {/* (the ring, lying round its axis: a torus turned to stand in the plane at right angles to it; and a fatter, unseen one to take hold of) */}
            <mesh rotation-x={Math.PI / 2} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <torusGeometry args={[L * 0.8, L * 0.018, 8, 64]} />
              <meshBasicMaterial color={a.color} depthTest={false} />
            </mesh>
            <mesh rotation-x={Math.PI / 2} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <torusGeometry args={[L * 0.8, L * 0.075, 6, 48]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
            </mesh>
            <sprite position={[L * 0.8, 0, 0]} scale={[L * 0.2, L * 0.2, 1]} renderOrder={1002} userData={{ editHandle: true, gizmo: false }}>
              <spriteMaterial map={letterTex(a.name, a.color)} depthTest={false} transparent />
            </sprite>
          </group>
        ))}
      </group>
    )
  }
  if (tool === 'scale') {
    return (
      <group ref={root} position={at}>
        {AXES.map((a, i) => (
          <group key={a.name} rotation={a.rot} onPointerDown={grow(i as 0 | 1 | 2)}>
            <mesh position-y={L * 0.4} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <cylinderGeometry args={[L * 0.022, L * 0.022, L * 0.8, 8]} />
              <meshBasicMaterial color={a.color} depthTest={false} />
            </mesh>
            <mesh position-y={L * 0.9} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <boxGeometry args={[L * 0.14, L * 0.14, L * 0.14]} />
              <meshBasicMaterial color={a.color} depthTest={false} />
            </mesh>
            <mesh position-y={L * 0.9} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <boxGeometry args={[L * 0.3, L * 0.3, L * 0.3]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
            </mesh>
            <sprite position-y={L * 1.12} scale={[L * 0.2, L * 0.2, 1]} renderOrder={1002} userData={{ editHandle: true, gizmo: false }}>
              <spriteMaterial map={letterTex(a.name, a.color)} depthTest={false} transparent />
            </sprite>
          </group>
        ))}
      </group>
    )
  }
  return (
    <group ref={root} position={at}>
      {AXES.map((a, i) => (
        <group key={a.name} rotation={a.rot} onPointerDown={down(i as 0 | 1 | 2)}>
          <mesh position-y={L * 0.4} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
            <cylinderGeometry args={[L * 0.022, L * 0.022, L * 0.8, 8]} />
            <meshBasicMaterial color={a.color} depthTest={false} />
          </mesh>
          <mesh position-y={L * 0.9} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
            <coneGeometry args={[L * 0.07, L * 0.2, 12]} />
            <meshBasicMaterial color={a.color} depthTest={false} />
          </mesh>
          {/* (the axis's letter, set a little past its tip, always facing the camera) */}
          <sprite position-y={L * 1.12} scale={[L * 0.2, L * 0.2, 1]} renderOrder={1002} userData={{ editHandle: true, gizmo: false }}>
            <spriteMaterial map={letterTex(a.name, a.color)} depthTest={false} transparent />
          </sprite>
          {/* (a fatter, unseen one round it, so it's easy to take hold of) */}
          <mesh position-y={L * 0.5} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
            <cylinderGeometry args={[L * 0.09, L * 0.09, L, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Movable({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, offsets, rotations, scales, selected } = useEdit()
  const [box, setBox] = useState<{ c: V3; s: V3 } | null>(null)
  // (the piece's middle, in the frame of its own group as it stands untouched: what it turns and scales about; measured once it has been drawn)
  const [mid, setMid] = useState<V3>([0, 0, 0])
  const inner = useRef<THREE.Group>(null)
  void offsets; void rotations; void scales // (read so it redraws as it's moved, turned or scaled)
  const o = positionOf(id)
  const rot = rotationOf(id), sc = scaleOf(id)

  /** its size and middle as it stands untouched: taken of the inner group alone (the handle and arrows are not in it), in the frame of the group that carries the offset */
  const measure = () => {
    const grp = g.current, inn = inner.current
    if (!grp || !inn) return null
    // (taken in the inner group's own frame, so the turn and scale on the wrapper outside it don't enter into it)
    grp.updateWorldMatrix(true, true)
    const b = new THREE.Box3()
    inn.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return
      m.geometry.computeBoundingBox()
      if (!m.geometry.boundingBox) return
      b.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(inn.matrixWorld).invert(), m.matrixWorld)))
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

  // (its middle, once it has been drawn (a frame later, for a batch that merges after mount), and its box when editing begins)
  useEffect(() => {
    const t = window.setTimeout(() => { const m = measure(); if (m) setMid(m.c) }, 400)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!on) { setBox(null); return }
    // (a batch merges its meshes a moment after mounting: measured at once and again a little later, so the box is there whenever it's switched on)
    setBox(measure())
    const t = window.setTimeout(() => { const m = measure(); if (m) { setBox(m); setMid(m.c) } }, 300)
    return () => window.clearTimeout(t)
  }, [on])

  const down = (e: { stopPropagation: () => void; nativeEvent: PointerEvent; intersections?: { object: THREE.Object3D }[] }) => {
    const grp = g.current
    if (!on || !grp || !grp.parent) return
    // (an axis arrow under the pointer takes it: the box is only for the free move)
    if (e.intersections?.some((i) => i.object.userData.gizmo)) return
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
    beginChange()
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
      {/* (turned and scaled about the piece's own middle, not the group's origin, which may be far from it) */}
      <group position={mid} rotation={[rot[0] * DEG, rot[1] * DEG, rot[2] * DEG]} scale={sc}>
        <group ref={inner} position={[-mid[0], -mid[1], -mid[2]]}>{children}</group>
      </group>
      {on && box && (
        <mesh userData={{ editHandle: true }} position={box.c} renderOrder={999} onPointerDown={down}>
          <boxGeometry args={box.s} />
          <meshBasicMaterial color={selected === id ? '#ffb23f' : '#3fa9ff'} transparent opacity={0.26} depthWrite={false} depthTest={false} />
        </mesh>
      )}
      {on && box && <AxisGizmo id={id} at={box.c} size={Math.min(0.9, Math.max(0.3, Math.max(...box.s) * 0.45))} />}
    </group>
  )
}
