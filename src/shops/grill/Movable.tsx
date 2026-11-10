// A piece of the shop's furnishing that can be moved by hand in edit mode (edit.ts): its children sit in a group offset by the piece's saved
// offset (in its parent's own units), and while editing a box of fine lines fitted to it shows it can be edited (brighter pointed at, amber
// when chosen); it's taken hold of by the piece itself (whatever's nearest under the pointer, so a small thing in front of a big one is never
// lost behind it) and dragged over the floor (Shift lifts it), or with the select tool (Q) only chosen. Wrap it round a StaticBatch, not inside one: the batch's baked meshes then move with the group.

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ALONG } from './bar'
import { holdVeil } from '@/scene/Later'
import { warmLater } from '@/scene/Prewarm'
import { beginChange, clickPick, groupFrame, commitOffsets, FIXED_SIZE, footSettled, getEdit, GIZMO, HANGS, setStats, groupTransformOf, isPicked, moveTo, offsetOf, outerTransformOf, pivotOf, positionOf, registerMovable, rotationOf, scaleOf, scaleTo, select, setFrame, setPivot, settleFoot, turnTo, useEdit, useListHot, type Group, type V3 } from './edit'

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

/**
 * While editing, each piece that can be moved is outlined by a box of fine lines fitted to the model (its drawn meshes, measured in the piece's
 * own frame, so it turns and grows with it): faint blue where it can be seen, brighter when pointed at and amber when chosen, those two drawn
 * over everything so a piece behind another still shows where it is; the piece itself is what's clicked.
 */
type Look = 'idle' | 'hover' | 'chosen'
const lineMat = (color: string, opacity: number, through: boolean) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: !through, depthWrite: false, toneMapped: false })
// (at rest only where it isn't hidden, so the room isn't a tangle of lines; pointed at or chosen, seen through whatever's in front)
const EDGE: Record<Look, THREE.LineBasicMaterial> = { idle: lineMat('#5fb4ff', 0.4, false), hover: lineMat('#9ad6ff', 0.9, true), chosen: lineMat('#ffb43c', 1, true) }
// (their program made as the shop loads, not in the frame G is pressed: one box's lines handed to the prewarm)
warmLater(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1, 0.1, 0.1)), EDGE.idle))

/** `yaw`: the turn inside it its object axes go by (Movable's inYaw); the box is squared to it, so it sits on the piece as its handles do
 * (the owner's: a turned piece's box stood square to the room, swollen round it) */
export function useEditBox(root: { current: THREE.Object3D | null }, on: boolean, look: Look, ready = true, yaw: number | null = null) {
  const edge = useRef<THREE.LineSegments | null>(null)
  useEffect(() => {
    if (!on) return
    const fit = () => {
      edge.current?.removeFromParent()
      edge.current?.geometry.dispose()
      edge.current = null
      const r = root.current
      if (!r) return
      r.updateWorldMatrix(true, true)
      const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
      const pts: THREE.Vector3[] = []
      r.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || m.userData.editHandle || m.name.endsWith('_outline')) return
        for (let p: THREE.Object3D | null = m; p && p !== r; p = p.parent) if (!p.visible && !m.userData.proxy) return
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        if (mats.every((x) => x.side === THREE.BackSide)) return
        if (!m.userData.proxy && mats.every((x) => !x.visible || x.opacity <= 0.02 || !x.colorWrite || x.blending === THREE.AdditiveBlending || (x.transparent && !x.depthWrite))) return
        const pos = m.geometry.getAttribute('position')
        if (!pos) return
        const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)
        const step = Math.max(1, Math.ceil(pos.count / 1500))
        for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat))
      })
      if (!pts.length) return
      // (turned about the vertical to whichever angle fits it tightest: a piece set at a slant gets a box at the same slant; but square to the
      // piece unless a slant fits it markedly tighter (a round lantern fits as well at any angle, and its box came out crooked: the owner's))
      let best = { a: 0, x0: 0, x1: 0, z0: 0, z1: 0, area: Infinity }
      let square = Infinity
      const angles = yaw !== null ? [yaw] : Array.from({ length: 45 }, (_, k) => (k / 45) * (Math.PI / 2))
      for (let k = 0; k < angles.length; k++) {
        const a = angles[k], co = Math.cos(a), si = Math.sin(a)
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
        for (const q of pts) {
          const x = q.x * co - q.z * si, z = q.x * si + q.z * co
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (z < z0) z0 = z
          if (z > z1) z1 = z
        }
        const area = (x1 - x0) * (z1 - z0)
        if (k === 0) square = area
        if (area < best.area && (k === 0 || area < square * 0.9)) best = { a, x0, x1, z0, z1, area }
      }
      let y0 = Infinity, y1 = -Infinity
      for (const q of pts) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y }
      const cx = (best.x0 + best.x1) / 2, cz = (best.z0 + best.z1) / 2, co = Math.cos(best.a), si = Math.sin(best.a)
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(Math.max(best.x1 - best.x0, 0.01), Math.max(y1 - y0, 0.01), Math.max(best.z1 - best.z0, 0.01))), EDGE[look])
      e.position.set(cx * co + cz * si, (y0 + y1) / 2, -cx * si + cz * co)
      e.rotation.y = best.a
      e.renderOrder = 998
      e.raycast = () => {}
      e.userData.editHandle = true
      r.add(e)
      edge.current = e
    }
    fit()
    const t = window.setTimeout(fit, 450)
    return () => { window.clearTimeout(t); edge.current?.removeFromParent(); edge.current?.geometry.dispose(); edge.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready, yaw])
  useEffect(() => { if (edge.current) edge.current.material = EDGE[look] }, [look, on])
}
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
/** a group's turn, about the room's axes (X along the bar, Y up, Z across it), as a matrix in the world */
/** scratch for laying a group's transform over its pieces each frame (the group's turn about the world's own axes) */
const GT = { world: new THREE.Matrix4(), local: new THREE.Matrix4(), m: new THREE.Matrix4(), g: new THREE.Matrix4(), e: new THREE.Euler() }
/** a group's move, turn and size about its pivot, as a matrix (into `out`: not GT.m, which it works in) */
function groupMatrix(gt: Group, out: THREE.Matrix4) {
  const r = gt.r ?? [0, gt.yaw, 0]
  return out.makeTranslation(gt.pivot[0] + gt.t[0], gt.pivot[1] + gt.t[1], gt.pivot[2] + gt.t[2])
    .multiply(GT.m.makeRotationFromEuler(GT.e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG)))
    .multiply(GT.m.makeScale(gt.s, gt.s, gt.s))
    .multiply(GT.m.makeTranslation(-gt.pivot[0], -gt.pivot[1], -gt.pivot[2]))
}
/** the groups a piece is in, laid over one another (the one holding it first, then the one that's in…), as one matrix in the world */
function chainMatrix(gs: Group[], out: THREE.Matrix4) {
  out.identity()
  for (const gt of gs) out.premultiply(groupMatrix(gt, GT.g))
  return out
}

/** the selected group's handles: the arrows, rings or boxes at its pivot (where it's been moved to), along the room's axes; they move, turn and
 * size the group as one, as a piece's own handles do it. A group inside another (the till's, in its view's area) has them inside that one's
 * move, turn and size, as what it holds is */
export function GroupGizmo() {
  const { on, selected, groups, space } = useEdit()
  const g = on && selected ? groups[selected] : null
  if (!g || !selected) return null
  const outer = chainMatrix(outerTransformOf(selected), new THREE.Matrix4())
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
  outer.decompose(p, q, s)
  return (
    <group name="group-gizmo" position={p} quaternion={q} scale={s}>
      <group>
        {/* (on the room's axes; or, in object space, the group's own: its first piece's turned by the group's) */}
        <AxisGizmo id={selected} at={[g.pivot[0] + g.t[0], g.pivot[1] + g.t[1], g.pivot[2] + g.t[2]]} theta={space === 'local' ? groupFrame(selected) : 0} />
      </group>
    </group>
  )
}

/** the materials' own wireframe settings while it's shown, kept for every view of it (the scene's and the character viewer's share materials) */
const WIRE_WAS = new Map<THREE.Material, boolean>()
let wireUsers = 0
/** what a surface writes to the depth only, drawn before the lines: the lines behind a surface are hidden by it */
const WIRE_DEPTH = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
/**
 * Developer mode's wireframe (Maya's 4): every material drawn as its edges, so each model's topology shows; 5 (or leaving) puts it back. Only
 * the edges that can be seen (a depth-only copy of each mesh drawn first, its lines over it): drawn all through, a figure's back and every
 * layer under its front showed through it, and its wiring read as parts all overlapping (the owner's). In each canvas it's put in.
 */
export function WireView() {
  const { wire, on } = useEdit()
  const scene = useThree((st) => st.scene)
  useEffect(() => {
    if (!wire || !on) return
    wireUsers++
    const shadows: THREE.Mesh[] = []
    const seen = new Set<THREE.Object3D>()
    // (every shape drawn as lines: three builds each one a line index for it, kept as long as the shape is; let go once it's shaded again)
    const wired = new Set<THREE.BufferGeometry>()
    const apply = () => scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.editHandle || m.userData.wireDepth || seen.has(m)) return
      seen.add(m)
      let any = false
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const w = mat as THREE.Material & { wireframe?: boolean }
        if (w.wireframe === undefined || !w.visible || (mat.transparent && !mat.depthWrite)) continue
        any = true
        if (!WIRE_WAS.has(mat)) WIRE_WAS.set(mat, !!w.wireframe)
        w.wireframe = true
      }
      if (!any) return
      wired.add(m.geometry)
      // (its depth-only copy: the same shape, bent the same way if it's skinned, set out the same way if instanced)
      const sk = m as THREE.SkinnedMesh, im = m as THREE.InstancedMesh
      let d: THREE.Mesh
      if (sk.isSkinnedMesh) { const s = new THREE.SkinnedMesh(m.geometry, WIRE_DEPTH); s.bind(sk.skeleton, sk.bindMatrix); d = s }
      else if (im.isInstancedMesh) { const i = new THREE.InstancedMesh(m.geometry, WIRE_DEPTH, im.count); i.instanceMatrix = im.instanceMatrix; d = i }
      else d = new THREE.Mesh(m.geometry, WIRE_DEPTH)
      d.userData.wireDepth = true
      d.renderOrder = -1
      // (culled as its mesh is: drawn for everything off screen too, it doubled the draws (the owner saw 3,000))
      d.frustumCulled = m.frustumCulled
      d.raycast = () => {}
      m.add(d)
      shadows.push(d)
    })
    apply()
    // (models still loading, or batches merging, are caught a moment later)
    const t = window.setInterval(apply, 1000)
    return () => {
      window.clearInterval(t)
      for (const d of shadows) d.removeFromParent()
      if (--wireUsers === 0) {
        for (const [mat, w] of WIRE_WAS) (mat as THREE.Material & { wireframe: boolean }).wireframe = w
        WIRE_WAS.clear()
        // (each shape's line index let go (three drops it with the shape's buffers; they're sent again as it's next drawn): kept, the heap
        // stayed 200 MB up after the wireframe was left (the owner saw 606 MB))
        for (const g of wired) g.dispose()
      }
    }
  }, [wire, on, scene])
  return null
}

export function AxisGizmo({ id, at, theta = 0, own, pivotGroup, tilt }: { id: string; at: V3; size?: number; theta?: number; own?: number; pivotGroup?: { current: THREE.Group | null }
  /** (object axes) the piece's whole turn in the parent's frame, pitch and roll too: the move arrows stand on it, as Maya's object axes do */
  tilt?: THREE.Quaternion }) {
  // (sizing always goes by the piece's own axes, as Maya's does: its handles stand on them whichever axes the rest go by)
  const sizeTheta = own ?? theta
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
    const world = dist * 2 * Math.tan((fov * DEG) / 2) * ((GIZMO_PX * GIZMO.size) / gl.domElement.clientHeight)
    const ps = r.parent.getWorldScale(new THREE.Vector3())
    r.scale.set(world / (ps.x || 1), world / (ps.y || 1), world / (ps.z || 1))
  })
  if (!on || selected !== id || tool === 'select') return null
  // the orange box in the middle: moved freely in the plane facing the camera, all three axes at once (as Maya's middle square)
  const downFree = (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), origin)
    const hit = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      return raycaster.ray.intersectPlane(plane, new THREE.Vector3())
    }
    let last = hit(e.nativeEvent)
    if (!last) return
    beginChange()
    moveTo(id, offsetOf(id))
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const p1 = hit(ev)
      if (!p1 || !last) return
      const d = par.worldToLocal(p1.clone()).sub(par.worldToLocal(last.clone()))
      const n = [...offsetOf(id)] as V3
      n[0] += d.x; n[1] += d.y; n[2] += d.z
      moveTo(id, n)
      last = p1
    }
    const up = () => {
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  const down = (axis: 0 | 1 | 2) => (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
    const r0 = root.current
    const par = r0?.parent?.parent
    if (!r0 || !par) return
    e.stopPropagation()
    par.updateWorldMatrix(true, false)
    const origin = r0.getWorldPosition(new THREE.Vector3())
    // (the arrows of the move tool point along the room's axes: turned by theta into the parent's frame; or, on the piece's own axes, by its whole turn)
    const local = tilt ? new THREE.Vector3(...AXES[axis].v).applyQuaternion(tilt) : new THREE.Vector3(...AXES[axis].v).applyAxisAngle(new THREE.Vector3(0, 1, 0), theta)
    const dir = local.transformDirection(par.matrixWorld).normalize()
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
    // (in pivot mode (D) the arrows carry the pivot, not the piece: the piece's place is moved by what turning and sizing about the new pivot
    // would shift it, so it stays put)
    const pg = pivotGroup?.current
    const turnScale = new THREE.Matrix3()
    if (pg && pg.children[0]?.children[0]) {
      pg.updateMatrix(); pg.children[0].updateMatrix(); pg.children[0].children[0].updateMatrix()
      turnScale.setFromMatrix4(new THREE.Matrix4().multiplyMatrices(pg.matrix, pg.children[0].matrix).multiply(pg.children[0].children[0].matrix))
    }
    const move = (ev: PointerEvent) => {
      const s1 = along(ev)
      if (s1 === null || last === null) return
      // (the way along the axis in the world, taken into the piece's parent's own frame: it's the one axis that changes)
      const p0 = origin.clone().addScaledVector(dir, last), p1 = origin.clone().addScaledVector(dir, s1)
      const d = par.worldToLocal(p1).sub(par.worldToLocal(p0))
      if (getEdit().pivotMode && pg) {
        const pv = pivotOf(id)
        const shift = d.clone().applyMatrix3(turnScale).sub(d)
        setPivot(id, [pv[0] + d.x, pv[1] + d.y, pv[2] + d.z], [shift.x, shift.y, shift.z])
      } else {
        const n = [...offsetOf(id)] as V3
        n[0] += d.x; n[1] += d.y; n[2] += d.z
        moveTo(id, n)
      }
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
    const dir = new THREE.Vector3(...AXES[axis].v).applyAxisAngle(new THREE.Vector3(0, 1, 0), sizeTheta).transformDirection(par.matrixWorld).normalize()
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
      <group ref={root} name="edit-gizmo" position={at} rotation-y={theta}>
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
  if (tool === 'scale' && !FIXED_SIZE.has(id)) {
    return (
      <group ref={root} name="edit-gizmo" position={at} rotation-y={sizeTheta}>
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
        {/* (and the box in the middle, as Maya has it, to scale all three together: orange, as the move handles' middle box, an unseen larger one round
            it to catch) */}
        <mesh renderOrder={1002} userData={{ editHandle: true, gizmo: true }}>
          <boxGeometry args={[L * 0.16, L * 0.16, L * 0.16]} />
          <meshBasicMaterial color="#f2a33a" depthTest={false} toneMapped={false} transparent opacity={0.9} />
        </mesh>
        <mesh renderOrder={1002} onPointerDown={growAll} userData={{ editHandle: true, gizmo: true }}>
          <boxGeometry args={[L * 0.2, L * 0.2, L * 0.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} colorWrite={false} />
        </mesh>
      </group>
    )
  }
  return (
    <group ref={root} name="edit-gizmo" position={at} {...(tilt ? { quaternion: tilt } : { "rotation-y": theta })}>
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
      {/* (the middle: an orange box, dragged to move it freely in the plane facing the camera) */}
      <mesh renderOrder={1002} onPointerDown={downFree} userData={{ editHandle: true, gizmo: true }}>
        <boxGeometry args={[L * 0.16, L * 0.16, L * 0.16]} />
        <meshBasicMaterial color="#f2a33a" depthTest={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

/** the Movable a piece sits inside, if any: the outliner lists it under that one */
const ParentPiece = createContext<string | null>(null)

export function Movable({ id, label, children, baseScale = 1, baseTurn = [0, 0, 0], ground }: { id: string; label: string; children: ReactNode; baseScale?: number; baseTurn?: V3
  /** it stands on the floor, this high in its own frame: sized about the middle of its foot there, not about its own middle, so made bigger
   * it grows up from the floor and doesn't sink into it (the dish cabinet's and the freezer's feet went down through the kitchen's dais and
   * out past its edge) */
  ground?: number }) {
  const g = useRef<THREE.Group>(null)
  /** the group this piece is in lays its transform here, outside the piece's own place */
  const gw = useRef<THREE.Group>(null)
  const laid = useRef(false)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls
  const { on, offsets, rotations, scales, selected, groups, tool, pivots, space } = useEdit()
  void pivots
  /** the group the turn and scale act about (the pivot): its matrix, with what's inside it, is what moving the pivot must make up for */
  const pg = useRef<THREE.Group>(null)
  const [box, setBox] = useState<{ c: V3; s: V3; yaw: number; theta: number } | null>(null)
  // (the point it turns and scales about, in the frame of its own group as it stands untouched (its pivot, before any moved by hand); measured
  // once it has been drawn)
  const [mid, setMid] = useState<V3>([0, 0, 0])
  /** it hangs or is fixed to a wall (edit's HANGS): turned and sized about its middle; anything else stands on something, about its foot */
  const hangs = HANGS.test(id)
  /** its pivot brought down to its foot by its measure (not given a floor's height of its own, `ground`, and not hanging) */
  const footed = !hangs && ground === undefined
  /**
   * The point it's turned and sized about: the middle of its foot (the owner's, 2026-11-10: the handles at the middle of a piece's base, not
   * half way up it), at the floor's height it's given (`ground`) or where its lowest point is; a hanging one's middle
   */
  const footOf = (m: { c: V3; s: V3; y0: number }): V3 => (ground !== undefined ? [m.c[0], ground, m.c[2]] : hangs ? m.c : [m.c[0], m.y0, m.c[2]])
  /**
   * What its own turn and size as made (baseTurn, baseScale) were laid out about (its middle, before its pivot came down to its foot) made up
   * for: added to its place, always, so it stands where it was laid out (the charcoal crate, made 1.75 times as big about its middle)
   */
  const [madeShift, setMadeShift] = useState<V3>([0, 0, 0])
  const inner = useRef<THREE.Group>(null)
  // (the turn from the room's frame into the parent's, about the vertical; found once the piece is in place)
  const [thetaRoom, setTheta] = useState(0)
  // (the axes gone by: the room's turned into this frame, or (the piece's own) none)
  const rot0 = rotationOf(id)
  /** its own turn about the vertical: what the object axes add to the world's */
  // (and the turn its contents carry inside it (a group turned to face its way, a model's own root): the object axes follow what's seen,
  // not only the turn given here)
  const [inYaw, setInYaw] = useState(0)
  // (and its whole turn inside, pitch and roll too, for the move arrows on its own axes)
  const [inQuat, setInQuat] = useState<THREE.Quaternion | null>(null)
  const ownYaw = (rot0[1] + baseTurn[1]) * DEG + inYaw
  // (the frame its turn is kept in is always the world's; the handles and the place fields go by the world's axes, or (object space) its own)
  const thetaW = thetaRoom
  // (both turns are in the parent's own frame, which the handles hang in: the world's axes are the parent's turned back by its own turn (thetaW);
  // the piece's own axes are simply its turn there)
  const theta = space === 'local' ? ownYaw : thetaW
  useEffect(() => { setFrame(id, thetaW, ownYaw) }, [id, thetaW, ownYaw])
  void offsets; void rotations; void scales; void selected; void groups // (read so it redraws as it's moved, turned or scaled)
  const o0 = positionOf(id)
  const o: V3 = [o0[0] + madeShift[0], o0[1] + madeShift[1], o0[2] + madeShift[2]]
  const rot = rotationOf(id), sc = scaleOf(id)
  // (the pivot: the piece's middle, moved by hand if it has been (D))
  const pvo = pivotOf(id)
  const piv: V3 = [mid[0] + pvo[0], mid[1] + pvo[1], mid[2] + pvo[2]]
  // (turned or sized about its middle, it can't be shown until that middle's known: drawn about the wrong point first, it would jump into place)
  const pivoted = baseScale !== 1 || baseTurn.some((v) => v) || rot.some((v) => v) || sc.some((v) => v !== 1)
  const [ready, setReady] = useState(false)
  // (the loading veil waits till it's measured and shown: a piece held back till then came in after the veil had gone. Taken once it's
  // mounted, not as it's drawn: a drawing put aside while a model loads would hold it for ever)
  useLayoutEffect(() => (ready ? undefined : holdVeil(`piece ${id}`)), [ready, id])

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
      // (an edit proxy's unseen box is the piece, though)
      if (!m.userData.proxy && mats.every((x) => !x.visible || x.opacity <= 0.02 || !x.colorWrite || x.blending === THREE.AdditiveBlending || x.side === THREE.BackSide || (x.transparent && !x.depthWrite))) return
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
    if (!pts.length) return { c: [0, 0.3, 0] as V3, s: [0.5, 0.6, 0.5] as V3, yaw: 0, theta: 0, y0: 0, empty: true }
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
    // (the world's axes against the parent's own frame)
    const theta = -parentYaw
    const cx = (best.x0 + best.x1) / 2, cz = (best.z0 + best.z1) / 2
    const co = Math.cos(best.a), si = Math.sin(best.a)
    // (the middle back out of the turned frame)
    const c = [cx * co + cz * si, (yMin + yMax) / 2, -cx * si + cz * co] as V3
    return { c, s: [Math.max(best.x1 - best.x0, 0.06) + 0.02, Math.max(yMax - yMin, 0.06) + 0.02, Math.max(best.z1 - best.z0, 0.06) + 0.02] as V3, yaw: best.a, theta,
      y0: yMin, empty: false }
  }
  /**
   * The turn and size it's given about its pivot, as one matrix (its pivot group down to its contents' group: the room's turn, its own, its
   * size along its own axes): as drawn now, or (`made`) with only what it's made with (baseTurn, baseScale), none given by hand
   */
  const turnAndSize = (made = false) => {
    const p = pg.current
    const chain: THREE.Object3D[] = []
    for (let n: THREE.Object3D | undefined = p ?? undefined; n && n !== inner.current; n = n.children[0]) chain.push(n)
    if (!p || chain.length !== 6) return null
    const a = new THREE.Matrix4()
    chain.forEach((n, k) => {
      n.updateMatrix()
      if (made && k === 1) a.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(baseTurn[0] * DEG, baseTurn[1] * DEG, baseTurn[2] * DEG)))
      else if (made && k === 3) a.multiply(new THREE.Matrix4().makeScale(baseScale, baseScale, baseScale))
      else a.multiply(n.matrix)
    })
    return a.setPosition(0, 0, 0)
  }
  /**
   * Its pivot set from its measure (`m`, in its own frame), and, a standing piece's having come down from its middle to its foot by d: what
   * it's made with made up for (madeShift, every time), and, the first time, what's been saved for it (settleFoot: its turn and size by hand,
   * or a pivot moved by hand), so it stands just where it did
   */
  const poseFrom = (m: { c: V3; s: V3; y0: number; empty: boolean }) => {
    const foot = footOf(m)
    setMid((was) => (was[0] === foot[0] && was[1] === foot[1] && was[2] === foot[2] ? was : foot))
    if (!footed || m.empty) return
    const d = new THREE.Vector3(0, foot[1] - m.c[1], 0)
    const now = turnAndSize(), made = turnAndSize(true)
    if (!now || !made) return
    const madeD = d.clone().applyMatrix4(made).sub(d)
    setMadeShift((was) => (Math.abs(was[0] - madeD.x) + Math.abs(was[1] - madeD.y) + Math.abs(was[2] - madeD.z) < 1e-7 ? was : [madeD.x, madeD.y, madeD.z]))
    if (footSettled(id)) return
    const nowD = d.clone().applyMatrix4(now).sub(d)
    const moved = pivotOf(id).some((v) => Math.abs(v) > 1e-9)
    // (with a pivot moved by hand, that pivot stays where it is (counted from the foot now): nothing to make up for but madeShift's; else
    // all of the difference, less madeShift's)
    const shift: V3 = moved ? [-madeD.x, -madeD.y, -madeD.z] : [nowD.x - madeD.x, nowD.y - madeD.y, nowD.z - madeD.z]
    settleFoot(id, [0, d.y, 0], shift)
  }

  /** the turn about the vertical its contents carry: down the chain of single groups inside it to where it branches or a mesh is */
  const contentYaw = () => {
    const inn = inner.current
    if (!inn) return 0
    let n: THREE.Object3D = inn
    // (the editor's own wire box hung in it is not part of what's seen; nor what a batch merged its parts into: its originals, under the
    // batch's other group, are where the turn is (a piece turned inside its batch had the world's axes for its own, the willow, the till))
    // (nor a marker hung in it for something to find it by (a stool's seat): nothing to see)
    const kids = (o: THREE.Object3D) => o.children.filter((c) => !(c as THREE.LineSegments).isLineSegments && !c.userData.batchMade && !c.userData.marker)
    while (kids(n).length === 1 && !(kids(n)[0] as THREE.Mesh).isMesh) n = kids(n)[0]
    inn.updateWorldMatrix(true, true)
    const yaw = (o: THREE.Object3D) => new THREE.Euler().setFromQuaternion(o.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    const d = yaw(n) - yaw(inn)
    // (the whole turn, relative to the piece's own frame: kept only if it leans (a camera looking down), else the yaw alone does)
    const q = inn.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(n.getWorldQuaternion(new THREE.Quaternion()))
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
    setInQuat(Math.abs(e.x) > 0.02 || Math.abs(e.z) > 0.02 ? q : null)
    return Math.atan2(Math.sin(d), Math.cos(d))
  }
  /**
   * The way it faces, for its object axes (the move arrows, the place fields, the scale handles), as a turn in its inner frame. The turn its
   * contents carry (contentYaw) if they carry one, else the room's direction (the bar's: the whole shop is laid out along it, a slant of
   * 36° to the world's axes, which had been every unturned piece's own); and for anything squared off (its footprint a box, not a round), the
   * box's own direction as it lies, which can be turned against both (a carton set down askew, a stool turned on its spot), unless it's
   * within a few degrees of one of them (then that one, exactly: a model's footprint is seldom a perfect box). The owner's: the till's
   * group's and many a piece's axes stood across them.
   */
  const faceYaw = () => {
    const inn = inner.current
    if (!inn) return 0
    const chain = contentYaw()
    inn.updateWorldMatrix(true, false)
    const yawW = (o: THREE.Object3D) => new THREE.Euler().setFromQuaternion(o.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    // (the room's direction, turned with the piece's own turn: in the inner frame, the room's against the frame the piece stands in)
    const own = (rotationOf(id)[1] + baseTurn[1]) * DEG
    const roomIn = Math.atan2(-ALONG.z, ALONG.x) - (yawW(inn) - own)
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
    const quarter = (a: number) => { const x = wrap(a * 4) / 4; return x }
    const ref = Math.abs(chain) > 0.002 ? chain : wrap(roomIn)
    const box = footprint()
    if (!box) return ref
    const SNAP = 6 * DEG
    if (Math.abs(quarter(box - ref)) <= SNAP) return ref
    if (Math.abs(quarter(box - roomIn)) <= SNAP) return wrap(ref + quarter(roomIn - ref))
    return wrap(ref + quarter(box - ref))
  }
  /** the direction its footprint's tightest box lies along, in the inner frame (a quarter turn either way the same), if it's squared off at all:
   * null for a round (whose box fits about as well any way it's turned) */
  const footprint = () => {
    const inn = inner.current
    if (!inn) return null
    inn.updateWorldMatrix(true, true)
    const toInner = new THREE.Matrix4().copy(inn.matrixWorld).invert()
    const xs: number[] = [], zs: number[] = []
    const v = new THREE.Vector3(), mat = new THREE.Matrix4()
    const meshes: THREE.Mesh[] = []
    inn.traverse((m) => {
      if (!(m instanceof THREE.Mesh) || (m as THREE.InstancedMesh).isInstancedMesh) return
      for (let o: THREE.Object3D | null = m; o && o !== inn; o = o.parent) if (!o.visible) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      if (!m.userData.proxy && mats.every((x) => !x.visible || x.opacity <= 0.02 || !x.colorWrite || x.blending === THREE.AdditiveBlending || x.side === THREE.BackSide || (x.transparent && !x.depthWrite))) return
      if (m.geometry.getAttribute('position')) meshes.push(m)
    })
    const total = meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0)
    if (!total) return null
    // (a few hundred of its points are enough to tell how it lies)
    const stride = Math.max(1, Math.ceil(total / 600))
    for (const m of meshes) {
      const pos = m.geometry.getAttribute('position')
      mat.multiplyMatrices(toInner, m.matrixWorld)
      for (let i = 0; i < pos.count; i += stride) { v.fromBufferAttribute(pos, i).applyMatrix4(mat); xs.push(v.x); zs.push(v.z) }
    }
    const area = (a: number) => {
      const c = Math.cos(a), s = Math.sin(a)
      let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity
      for (let i = 0; i < xs.length; i++) {
        const u = xs[i] * c - zs[i] * s, w = xs[i] * s + zs[i] * c
        if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < w0) w0 = w; if (w > w1) w1 = w
      }
      return (u1 - u0) * (w1 - w0)
    }
    let best = 0, low = Infinity, high = 0
    for (let d = 0; d < 90; d += 2) { const a = area(d * DEG); if (a < low) { low = a; best = d * DEG } high = Math.max(high, a) }
    for (let d = -2; d <= 2; d += 0.25) { const a = area(best + d * DEG); if (a < low) { low = a; best = best + d * DEG } }
    // (squared off: turned the worst way, its box a quarter bigger than the tightest; a round one's hardly changes)
    return low > 1e-9 && (high - low) / low >= 0.25 ? best : null
  }
  /** the turn its object axes go by: the way it faces (faceYaw); one stretched unevenly keeps the turn its stretch was made along (the
   * contents' own), so it isn't stretched another way */
  const facing = () => { const s = scaleOf(id); return s[0] !== s[1] || s[1] !== s[2] ? contentYaw() : faceYaw() }
  const frame = () => {
    const par = gw.current
    if (!par) return
    par.updateWorldMatrix(true, false)
    const t = -new THREE.Euler().setFromQuaternion(par.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    setFrame(id, t, ownYaw)
    setTheta(t)
  }
  useLayoutEffect(frame, [])

  // (on the list of what can be moved, with a way to bring the camera to the middle of it)
  const parentPiece = useContext(ParentPiece)
  useEffect(() => registerMovable(id, label, () => {
    const m = measure('whole')
    if (m && g.current) focusCamera(camera, controls, g.current.localToWorld(new THREE.Vector3(...m.c)))
  }, () => {
    const m = measure('whole')
    return m && g.current ? (g.current.localToWorld(new THREE.Vector3(...m.c)).toArray() as V3) : null
  }, parentPiece, () => {
    // (the middle of its foot in the world: where a group of it has its pivot)
    const m = measure('whole')
    return m && !m.empty && g.current ? (g.current.localToWorld(new THREE.Vector3(m.c[0], m.y0, m.c[2])).toArray() as V3) : null
  }), [id, label, camera, controls, parentPiece])

  // (the groups this piece is in, if any has been moved, turned or sized: their moves, turns and sizes laid over the piece as one, each about its
  // own middle, in the world; one in a view's area that's as it was made changes nothing, and costs nothing a frame)
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
    // (worked out in the module's scratch matrices: this runs every frame for each piece in a group, and made new ones each time)
    chainMatrix(gt, GT.world)
    GT.local.copy(par.matrixWorld).invert().multiply(GT.world).multiply(par.matrixWorld)
    if (!laid.current || !w.matrix.equals(GT.local)) { w.matrix.copy(GT.local); w.matrixWorldNeedsUpdate = true; laid.current = true }
  })

  // (its middle, once it has been drawn (a frame later, for a batch that merges after mount), and its box when editing begins)
  // (tried every tenth of a second until there's something to measure: a model may still be loading)
  // (shown as soon as it can be measured at all; measured on till something's drawn in it, its pivot set again then: measured empty, a model
  // still loading, it was turned and sized about the empty box's middle till edit mode came round to measure it again)
  useEffect(() => {
    let tries = 0, shown = false
    const t = window.setInterval(() => {
      const m = measure()
      if (m) poseFrom(m)
      if (m && !shown) { setInYaw(facing()); setReady(true); shown = true }
      if ((m && !m.empty) || ++tries > 80) {
        if (!shown) { setInYaw(facing()); setReady(true) }
        window.clearInterval(t)
      }
    }, 100)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!on) { setBox(null); return }
    // (the parent's turn measured again now: taken at mount, a parent still being laid out could give the wrong one, and the world's axes with it)
    frame()
    setInYaw(facing())
    // (a batch merges its meshes a moment after mounting: measured at once and again a little later, so the box is there whenever it's switched on)
    const first = measure('whole')
    if (first) setFrame(id, first.theta, ownYaw)
    // (what it's made of, for the panel: its triangles, vertices and meshes as drawn)
    const countIt = () => {
      let tris = 0, verts = 0, meshes = 0
      inner.current?.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        for (let q: THREE.Object3D | null = m; q && q !== inner.current; q = q.parent) if (!q.visible) return
        const geo = m.geometry, n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1
        tris += ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * n
        verts += geo.attributes.position.count * n
        meshes++
      })
      setStats(id, { tris: Math.round(tris), verts, meshes })
    }
    countIt()
    setBox(first)
    const t = window.setTimeout(() => { const m = measure('whole'), n = measure(); if (m) { setBox(m); setFrame(id, m.theta, ownYaw); setTheta(m.theta) } if (n) poseFrom(n); countIt() }, 300)
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
    // (a piece in a group is picked as its group, and the group's own handles move, turn and size it all together; Alt picks the piece alone.
    // A view's whole area isn't picked so (that's from the list, or its tag): the piece in it is)
    const grpId = clickPick(id)
    if (grpId !== id && !e.nativeEvent.altKey) { select(grpId); return }
    if (tool === 'select') { moveTo(id, offsetOf(id)); return }
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

  const [hover, setHover] = useState(false)
  const listed = useListHot(id)
  useEditBox(inner, on, selected === id || isPicked(id) ? 'chosen' : hover || listed ? 'hover' : 'idle', ready, inYaw)
  useEffect(() => { if (!on) setHover(false) }, [on])

  return (
    <group ref={gw} matrixAutoUpdate={false}>
    <group ref={g} position={o} userData={{ editId: id }}>
      {/* (turned and scaled about the piece's own middle, not the group's origin, which may be far from it) */}
      {/* (the turn and the scale are about the room's axes, the same ones the arrows and rings show: the piece stood in the room's frame, turned and
          scaled there, and stood back) */}
      <group ref={pg} position={piv} rotation-y={thetaW} visible={ready || !pivoted}
        onPointerDown={on ? down : undefined}
        onPointerOver={on ? (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(true) } : undefined}
        onPointerOut={on ? () => setHover(false) : undefined}>
        <group rotation={[(rot[0] + baseTurn[0]) * DEG, (rot[1] + baseTurn[1]) * DEG, (rot[2] + baseTurn[2]) * DEG]}>
          {/* (sized along the piece's own axes, the way its own X, Y, Z handles point: turned from the room's into the content's own, scaled,
              turned back) */}
          <group rotation-y={inYaw - thetaW}><group scale={[sc[0] * baseScale, sc[1] * baseScale, sc[2] * baseScale]}><group rotation-y={thetaW - inYaw}>
            <group rotation-y={-thetaW}>
              <group ref={inner} position={[-piv[0], -piv[1], -piv[2]]}><ParentPiece.Provider value={id}>{children}</ParentPiece.Provider></group>
            </group>
          </group></group></group>
        </group>
      </group>
      {on && box && <AxisGizmo id={id} theta={theta} own={ownYaw} at={piv} pivotGroup={pg} size={Math.min(0.9, Math.max(0.3, Math.max(...box.s) * 0.45))}
        tilt={space === 'local' && inQuat ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rot0[1] + baseTurn[1]) * DEG).multiply(inQuat) : undefined} />}
    </group>
    </group>
  )
}
