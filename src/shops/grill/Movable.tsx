// A piece of the shop's furnishing that can be moved by hand in edit mode (edit.ts): its children sit in a group offset by the piece's saved
// offset (in its parent's own units), and while editing a pale blue box shows round it to be taken hold of and dragged over the floor
// (Shift lifts it). Wrap it round a StaticBatch, not inside one: the batch's baked meshes then move with the group.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ALONG } from './bar'
import { beginChange, commitOffsets, groupTransformOf, isPicked, moveTo, offsetOf, positionOf, registerMovable, rotationOf, scaleOf, scaleTo, setFrame, turnTo, useEdit, type V3 } from './edit'

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
/** how long the handles are on the screen, in pixels */
const GIZMO_PX = 130
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
export function AxisGizmo({ id, at, theta = 0 }: { id: string; at: V3; size?: number; theta?: number }) {
  const root = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, selected, tool } = useEdit()
  // (the handles keep one size on the screen, whatever the piece's size or how far the camera is, as in a modelling program: the group is scaled to fit,
  // undoing its parents' own scale so the arrows stay straight)
  useFrame(() => {
    const r = root.current
    if (!r?.parent) return
    const dist = camera.position.distanceTo(r.getWorldPosition(new THREE.Vector3()))
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45
    const world = dist * 2 * Math.tan((fov * DEG) / 2) * (GIZMO_PX / gl.domElement.clientHeight)
    const ps = r.parent.getWorldScale(new THREE.Vector3())
    r.scale.set(world / (ps.x || 1), world / (ps.y || 1), world / (ps.z || 1))
  })
  if (!on || selected !== id) return null
  const down = (axis: 0 | 1 | 2) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    // (the arrows of the move tool point along the room's axes: turned by theta into the parent's frame)
    const dir = new THREE.Vector3(...AXES[axis].v).applyAxisAngle(new THREE.Vector3(0, 1, 0), theta).transformDirection(par.matrixWorld).normalize()
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
      n[0] += d.x; n[1] += d.y; n[2] += d.z
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
    const normal = new THREE.Vector3(...AXES[axis].v).applyAxisAngle(new THREE.Vector3(0, 1, 0), theta).transformDirection(par.matrixWorld).normalize()
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
    const dir = new THREE.Vector3(...AXES[axis].v).applyAxisAngle(new THREE.Vector3(0, 1, 0), theta).transformDirection(par.matrixWorld).normalize()
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
  // ---- the middle cube: dragged right or up, the piece grows on all three axes together, left or down it shrinks
  const growAll = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    e.stopPropagation()
    const from = [...scaleOf(id)] as V3
    const x0 = e.nativeEvent.clientX, y0 = e.nativeEvent.clientY
    beginChange()
    scaleTo(id, from)
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const k = Math.max(0.05, Math.min(20, Math.exp((ev.clientX - x0 - (ev.clientY - y0)) / 160)))
      scaleTo(id, from.map((x) => Math.round(x * k * 100) / 100) as V3)
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  const L = 1
  if (tool === 'rotate') {
    // (as in Blender or Maya: a ring in each axis's colour round a faint ball, thin to look at and easy to catch)
    return (
      <group ref={root} position={at} rotation-y={theta}>
        <mesh renderOrder={1000} userData={{ editHandle: true, gizmo: false }}>
          <sphereGeometry args={[L * 0.8, 24, 16]} />
          <meshBasicMaterial color="#9aa7b4" transparent opacity={0.09} depthWrite={false} depthTest={false} />
        </mesh>
        {AXES.map((a, i) => (
          <group key={a.name} rotation={a.rot} onPointerDown={turn(i as 0 | 1 | 2)}>
            <mesh rotation-x={Math.PI / 2} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <torusGeometry args={[L * 0.8, L * 0.012, 6, 96]} />
              <meshBasicMaterial color={a.color} depthTest={false} toneMapped={false} />
            </mesh>
            <mesh rotation-x={Math.PI / 2} renderOrder={1001} userData={{ editHandle: true, gizmo: true }}>
              <torusGeometry args={[L * 0.8, L * 0.05, 4, 64]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} colorWrite={false} />
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
      <group ref={root} position={at} rotation-y={theta}>
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
        {/* (and the cube in the middle, to scale all three together) */}
        <mesh renderOrder={1002} onPointerDown={growAll} userData={{ editHandle: true, gizmo: true }}>
          <boxGeometry args={[L * 0.17, L * 0.17, L * 0.17]} />
          <meshBasicMaterial color="#e6e6e6" depthTest={false} />
        </mesh>
        <mesh renderOrder={1003} userData={{ editHandle: true, gizmo: true }} onPointerDown={growAll}>
          <boxGeometry args={[L * 0.17, L * 0.17, L * 0.17]} />
          <meshBasicMaterial color="#555" wireframe depthTest={false} />
        </mesh>
      </group>
    )
  }
  return (
    <group ref={root} position={at} rotation-y={theta}>
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

export function Movable({ id, label, children, baseScale = 1, baseTurn = [0, 0, 0] }: { id: string; label: string; children: ReactNode; baseScale?: number; baseTurn?: V3 }) {
  const g = useRef<THREE.Group>(null)
  /** the group this piece is in lays its transform here, outside the piece's own place */
  const gw = useRef<THREE.Group>(null)
  const laid = useRef(false)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, offsets, rotations, scales, selected, groups } = useEdit()
  const [box, setBox] = useState<{ c: V3; s: V3; yaw: number; theta: number } | null>(null)
  // (the piece's middle, in the frame of its own group as it stands untouched: what it turns and scales about; measured once it has been drawn)
  const [mid, setMid] = useState<V3>([0, 0, 0])
  const inner = useRef<THREE.Group>(null)
  // (the turn from the room's frame into the parent's, about the vertical; found once the piece is in place)
  const [theta, setTheta] = useState(0)
  void offsets; void rotations; void scales; void selected; void groups // (read so it redraws as it's moved, turned or scaled)
  const o = positionOf(id)
  const rot = rotationOf(id), sc = scaleOf(id)

  /** its size and middle as it stands untouched: taken of the inner group alone (the handle and arrows are not in it), in the frame of the group that carries the offset */
  /**
   * Its size and middle. In the piece's own (inner) frame, the turn and scale of the wrapper outside it not entering into it (that's the pivot they act
   * about); or, in the frame of the whole piece as it now stands, turned and scaled (that's what the box and the camera and a group see).
   */
  const measure = (frame: 'inner' | 'whole' = 'inner') => {
    const grp = g.current, inn = inner.current
    if (!grp || !inn) return null
    grp.updateWorldMatrix(true, true)
    const ref = frame === 'whole' ? grp : inn
    const toInner = new THREE.Matrix4().copy(ref.matrixWorld).invert()
    const pts: THREE.Vector3[] = []
    let yMin = Infinity, yMax = -Infinity
    inn.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return
      // (only what's drawn counts: not a hidden mesh (a batch's originals, a model's floor plane left out), nor an unseen hit-box or a clear glow)
      for (let o: THREE.Object3D | null = m; o && o !== inn; o = o.parent) if (!o.visible) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      // (nor the ink outlines (back faces drawn a little larger), nor decals and glows laid over a surface (clear, no depth write): they'd only fatten the box)
      if (mats.every((x) => !x.visible || x.opacity <= 0.02 || !x.colorWrite || x.blending === THREE.AdditiveBlending || x.side === THREE.BackSide || (x.transparent && !x.depthWrite))) return
      const pos = m.geometry.getAttribute('position')
      if (!pos) return
      const mat = new THREE.Matrix4().multiplyMatrices(toInner, m.matrixWorld)
      // (the model's own vertices, not its bounding box's corners: a tilted or round piece fits snugly; a big mesh is sampled)
      const stride = Math.max(1, Math.ceil(pos.count / 1500))
      for (let i = 0; i < pos.count; i += stride) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat)
        pts.push(v)
        yMin = Math.min(yMin, v.y); yMax = Math.max(yMax, v.y)
      }
    })
    if (!pts.length) return { c: [0, 0.3, 0] as V3, s: [0.5, 0.6, 0.5] as V3, yaw: 0, theta: 0 }
    // (the box is squared to the room, like the gates' and the cats' stand: turned about the vertical to the bar's own direction, whatever
    // way the piece's parent is turned, so none of them comes out a diamond)
    const fit = (a: number) => {
      const co = Math.cos(a), si = Math.sin(a)
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (const v of pts) {
        const x = v.x * co - v.z * si, z = v.x * si + v.z * co
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z)
      }
      return { a, x0, x1, z0, z1 }
    }
    const innYaw = new THREE.Euler().setFromQuaternion(ref.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    const best = fit(Math.atan2(ALONG.x, ALONG.z) - innYaw)
    // (the room's direction against the parent's own frame: what the move arrows and the position fields are turned by)
    const frameNode = gw.current ?? grp.parent
    const parentYaw = frameNode ? new THREE.Euler().setFromQuaternion(frameNode.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y : 0
    const theta = Math.atan2(ALONG.x, ALONG.z) - parentYaw
    const cx = (best.x0 + best.x1) / 2, cz = (best.z0 + best.z1) / 2
    const co = Math.cos(best.a), si = Math.sin(best.a)
    // (the middle back out of the turned frame)
    const c = [cx * co + cz * si, (yMin + yMax) / 2, -cx * si + cz * co] as V3
    return { c, s: [Math.max(best.x1 - best.x0, 0.06) + 0.02, Math.max(yMax - yMin, 0.06) + 0.02, Math.max(best.z1 - best.z0, 0.06) + 0.02] as V3, yaw: best.a, theta }
  }

  const frame = () => {
    const par = gw.current
    if (!par) return
    par.updateWorldMatrix(true, false)
    const t = Math.atan2(ALONG.x, ALONG.z) - new THREE.Euler().setFromQuaternion(par.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    setFrame(id, t)
    setTheta(t)
  }
  useLayoutEffect(frame, [])

  // (on the list of what can be moved, with a way to bring the camera to the middle of it)
  useEffect(() => registerMovable(id, label, () => {
    const m = measure('whole')
    if (m && g.current) focusCamera(camera, controls, g.current.localToWorld(new THREE.Vector3(...m.c)))
  }, () => {
    const m = measure('whole')
    return m && g.current ? (g.current.localToWorld(new THREE.Vector3(...m.c)).toArray() as V3) : null
  }), [id, label, camera, controls])

  // (the group this piece is in, if any: its move, turn and size laid over the piece as one, about the group's own middle, in the world)
  const gt = groupTransformOf(id)
  useFrame(() => {
    const w = gw.current
    if (!w) return
    if (!gt) {
      if (laid.current) { w.matrix.identity(); w.matrixWorldNeedsUpdate = true; laid.current = false; frame() }
      return
    }
    const par = w.parent
    if (!par) return
    par.updateWorldMatrix(true, false)
    const Y = new THREE.Vector3(0, 1, 0)
    const shift = new THREE.Vector3(...gt.t).applyAxisAngle(Y, Math.atan2(ALONG.x, ALONG.z))
    const pivot = new THREE.Vector3(...gt.pivot)
    const world = new THREE.Matrix4().makeTranslation(pivot.x + shift.x, pivot.y + shift.y, pivot.z + shift.z)
      .multiply(new THREE.Matrix4().makeRotationY(gt.yaw * DEG)).multiply(new THREE.Matrix4().makeScale(gt.s, gt.s, gt.s))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z))
    const local = new THREE.Matrix4().copy(par.matrixWorld).invert().multiply(world).multiply(par.matrixWorld)
    if (!laid.current || !w.matrix.equals(local)) { w.matrix.copy(local); w.matrixWorldNeedsUpdate = true; laid.current = true }
  })

  // (its middle, once it has been drawn (a frame later, for a batch that merges after mount), and its box when editing begins)
  useEffect(() => {
    const t = window.setTimeout(() => { const m = measure(); if (m) setMid(m.c) }, 400)
    return () => window.clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!on) { setBox(null); return }
    // (a batch merges its meshes a moment after mounting: measured at once and again a little later, so the box is there whenever it's switched on)
    const first = measure('whole')
    if (first) setFrame(id, first.theta)
    setBox(first)
    const t = window.setTimeout(() => { const m = measure('whole'), n = measure(); if (m) { setBox(m); setFrame(id, m.theta) } if (n) setMid(n.c) }, 300)
    return () => window.clearTimeout(t)
  }, [on])

  // (turned or sized by hand: the box is taken again to fit it as it now stands)
  const poseKey = `${rot.join()}|${sc.join()}`
  useEffect(() => {
    if (!on) return
    const m = measure('whole')
    if (m) setBox(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, poseKey])

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
    <group ref={gw} matrixAutoUpdate={false}>
    <group ref={g} position={o}>
      {/* (turned and scaled about the piece's own middle, not the group's origin, which may be far from it) */}
      {/* (the turn and the scale are about the room's axes, the same ones the arrows and rings show: the piece stood in the room's frame, turned and
          scaled there, and stood back) */}
      <group position={mid} rotation-y={theta}>
        <group rotation={[(rot[0] + baseTurn[0]) * DEG, (rot[1] + baseTurn[1]) * DEG, (rot[2] + baseTurn[2]) * DEG]} scale={[sc[0] * baseScale, sc[1] * baseScale, sc[2] * baseScale]}>
          <group rotation-y={-theta}>
            <group ref={inner} position={[-mid[0], -mid[1], -mid[2]]}>{children}</group>
          </group>
        </group>
      </group>
      {on && box && (
        <mesh userData={{ editHandle: true }} position={box.c} rotation-y={box.yaw} renderOrder={999} onPointerDown={down}>
          <boxGeometry args={box.s} />
          <meshBasicMaterial color={isPicked(id) ? '#8fd0ff' : '#3fa9ff'} transparent opacity={isPicked(id) ? 0.2 : 0.26} depthWrite={false} depthTest={false} />
        </mesh>
      )}
      {on && box && <AxisGizmo id={id} theta={theta} at={box.c} size={Math.min(0.9, Math.max(0.3, Math.max(...box.s) * 0.45))} />}
    </group>
    </group>
  )
}
