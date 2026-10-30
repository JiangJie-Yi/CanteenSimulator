// The dish rack (碗盤櫃架): a wooden stand against the kitchen's wall with the customers' plates on it, standing on their edges along the
// shelves, and in piles on the top one. Each plate has one of the designs of wareDesigns.ts; every design is drawn as one instanced mesh.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TAKE } from '@/game/plates'
import { PLATE_RACK, tipOver } from './bar'
import { getEdit } from './edit'
import { wareGeometry } from './ware'
import { DESIGN_COUNT, wareDesign } from './wareDesigns'

const W = 1.3, H = 1.75, D = 0.42
const PLATE_R = 0.17
const SHELVES = [0.12, 0.6, 1.06]
const WOOD = '#a9774a'
const WOOD_DARK = '#7d5430'

const GEO = wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.012], [0.47, 0.03], [0.5, 0.038], [0.49, 0.042], [0.44, 0.026], [0.3, 0.01], [0, 0.01]] as [number, number][])
  .map(([x, y]) => [x * PLATE_R * 2, y * PLATE_R * 2 / 0.26 * 0.26] as [number, number]), PLATE_R)

type Spot = { m: THREE.Matrix4; design: number }

/** a plate's height off what it sits on, rim to foot (the profile above, at this size) */
const PLATE_T = 0.042 * PLATE_R * 2
/** how far each plate in a pile stands above the one under it: they nest, foot in the one below's well */
const NEST = PLATE_T * 0.72
/** the slots on the lowest shelf: how far apart the plates stand in them, and how many */
const SLOT = 0.075, SLOTS = 14
const slotX = (k: number) => -((SLOTS - 1) * SLOT) / 2 + k * SLOT
/** where the three show plates stand on the middle shelf, and the three piles on the top one */
const SHOW_X = [-0.4, 0, 0.4]

/** every plate on the rack: where it is, and which design. Set as they'd really stand, none through another: on the lowest shelf each stands
 * on its edge in its slot between the dowels, its face to the side, leaning back a touch; on the middle one three show their faces, leaning
 * against the back rail, well apart; on the top, three piles, each plate nested in the one under it, a little off true */
function platesOf() {
  const out: Spot[] = []
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
  let n = 0
  const shelfTop = (y: number) => y + 0.0175
  // (in the slots: turned on edge, face to the side (about z), leaning 8° toward the next; resting on its rim)
  const lean = 0.14
  for (let k = 0; k < SLOTS; k++) {
    e.set(0, 0, Math.PI / 2 - lean, 'ZYX')
    q.setFromEuler(e)
    p.set(slotX(k), shelfTop(SHELVES[0]) + PLATE_R * Math.cos(lean) + 0.002, 0)
    out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: n++ })
  }
  // (on show: face front, leaning back against the rail behind, its foot in the groove in front)
  const back = 0.2
  for (const [k, x] of SHOW_X.entries()) {
    e.set(Math.PI / 2 - back, 0, 0)
    q.setFromEuler(e)
    p.set(x, shelfTop(SHELVES[1]) + PLATE_R * Math.cos(back) + 0.004, -0.02)
    out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: k + 2 })
  }
  // (the piles: nested, each turned and set a hair off the one under it)
  for (const [k, x] of SHOW_X.entries()) {
    for (let j = 0; j < 5; j++) {
      e.set(0, k * 1.3 + j * 0.7, 0)
      q.setFromEuler(e)
      p.set(x + Math.sin(j * 2.1 + k) * 0.004, shelfTop(SHELVES[2]) + j * NEST, Math.cos(j * 1.7 + k) * 0.004)
      out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: k + 1 })
    }
  }
  return out
}

function Plates({ design, list }: { design: number; list: Matrix4List }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const ink = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    list.forEach((m, i) => { ref.current?.setMatrixAt(i, m); ink.current?.setMatrixAt(i, m.clone().scale(new THREE.Vector3(1.03, 1.08, 1.03))) })
    for (const r of [ref.current, ink.current]) if (r) r.instanceMatrix.needsUpdate = true
  }, [list])
  if (!list.length) return null
  return (
    <>
      <instancedMesh ref={ref} args={[GEO, undefined, list.length]} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={wareDesign(design)} />
      </instancedMesh>
      <instancedMesh ref={ink} args={[GEO, undefined, list.length]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </instancedMesh>
    </>
  )
}
type Matrix4List = THREE.Matrix4[]

/** a wood's face with its grain running along u (a canvas, once per tone): streaks, the odd knot, a satin sheen */
function grain(base: string, line: string) {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = base; g.fillRect(0, 0, 256, 256)
  let seed = base.length * 97 + line.charCodeAt(1)
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.strokeStyle = line
  for (let k = 0; k < 70; k++) {
    const y0 = rnd() * 256, a = 0.08 + rnd() * 0.22
    g.globalAlpha = a; g.lineWidth = 0.6 + rnd() * 1.6
    g.beginPath()
    for (let x = 0; x <= 256; x += 8) { const y = y0 + Math.sin(x / (30 + rnd() * 4) + k) * 2.5; if (x) g.lineTo(x, y); else g.moveTo(x, y) }
    g.stroke()
  }
  for (let k = 0; k < 2; k++) { const x = 40 + rnd() * 180, y = 30 + rnd() * 200; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(x, y, 7, 3.5, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(x, y, 3, 1.5, 0, 0, Math.PI * 2); g.fill() }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
let woods: { light: THREE.Texture; dark: THREE.Texture; back: THREE.Texture } | null = null
const TILED = new Map<string, THREE.Texture>()
const woodsOf = () => (woods ??= { light: grain(WOOD, '#6a4426'), dark: grain(WOOD_DARK, '#4a2e16'), back: grain('#8b5e38', '#5a3a1e') })

/** the stand and its plates, origin at the middle of its foot, its front toward +z. The plates on it are the shop's supply (game/plates):
 * as many show as are on it (the piles on top go first), and clicked, a stack's worth is carried over to the pass for the customers */
export function PlateRack() {
  const all = useMemo(() => {
    // (the standing ones first, the piles on top last: the piles are taken first)
    return platesOf()
  }, [])
  const [count, setCount] = useState(PLATE_RACK.n)
  useFrame(() => { if (PLATE_RACK.n !== count) setCount(PLATE_RACK.n) })
  const byDesign = useMemo(() => {
    const out: Matrix4List[] = Array.from({ length: DESIGN_COUNT }, () => [])
    for (const sp of all.slice(0, Math.max(0, Math.min(all.length, count)))) out[sp.design % DESIGN_COUNT].push(sp.m)
    return out
  }, [all, count])
  const w = woodsOf()
  const wood = (tex: THREE.Texture, rx: number, ry: number) => {
    // (each tiling made once and kept)
    const key = `${tex.uuid}|${rx}|${ry}`
    let t = TILED.get(key)
    if (!t) { t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; TILED.set(key, t) }
    return t
  }
  const post = (x: number, z: number) => (
    <mesh key={`${x}${z}`} position={[x, H / 2, z]} rotation-z={Math.PI / 2} castShadow><boxGeometry args={[H, 0.06, 0.06]} /><meshToonMaterial map={wood(w.dark, 2, 0.3)} /></mesh>
  )
  const tip = tipOver('碗盤櫃', `點一下拿一疊盤子到出餐口（櫃裡還有 ${count} 個）`)
  return (
    <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; PLATE_RACK.want += TAKE }} {...tip}>
      {post(-W / 2, -D / 2)}{post(W / 2, -D / 2)}{post(-W / 2, D / 2)}{post(W / 2, D / 2)}
      {/* (the shelves, their front edges a darker lip) */}
      {SHELVES.map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[W, 0.035, D]} /><meshToonMaterial map={wood(w.light, 2, 1)} /></mesh>
          <mesh position={[0, y, D / 2 - 0.005]}><boxGeometry args={[W, 0.045, 0.02]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
        </group>
      ))}
      {/* (the crown: a cornice over the top, stepped, and a kick board at the foot) */}
      <mesh position={[0, H - 0.02, 0]} castShadow><boxGeometry args={[W + 0.06, 0.05, D + 0.06]} /><meshToonMaterial map={wood(w.dark, 2, 0.4)} /></mesh>
      <mesh position={[0, H + 0.025, 0.01]} castShadow><boxGeometry args={[W + 0.12, 0.04, D + 0.1]} /><meshToonMaterial map={wood(w.dark, 2, 0.4)} /></mesh>
      <mesh position={[0, 0.05, D / 2 - 0.02]}><boxGeometry args={[W - 0.06, 0.1, 0.02]} /><meshToonMaterial map={wood(w.dark, 3, 0.3)} /></mesh>
      {/* (a rail across the front of each shelf, so the plates can't slide off, and thin dowels between the standing plates) */}
      {SHELVES.map((y) => (
        <mesh key={`r${y}`} position={[0, y + 0.07, D / 2 - 0.015]}><boxGeometry args={[W - 0.06, 0.035, 0.025]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
      ))}
      {/* (the lowest shelf's slots: a dowel either side of each plate, a row at the front and one at the back, set in a rail along the foot) */}
      {[-1, 1].flatMap((zs) => Array.from({ length: SLOTS + 1 }, (_, k) => (
        <mesh key={`d${zs}${k}`} position={[slotX(k) - SLOT / 2, SHELVES[0] + 0.0175 + 0.07, zs * 0.12]} castShadow>
          <cylinderGeometry args={[0.006, 0.007, 0.14, 8]} /><meshToonMaterial color="#5a3a1e" />
        </mesh>
      )))}
      {[-1, 1].map((zs) => (
        <mesh key={`dr${zs}`} position={[0, SHELVES[0] + 0.0175 + 0.008, zs * 0.12]}><boxGeometry args={[SLOTS * SLOT + 0.02, 0.016, 0.03]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
      ))}
      {/* (the middle shelf's show: a rail behind for the plates to lean on, a groove strip in front to hold their feet) */}
      <mesh position={[0, SHELVES[1] + 0.25, -0.17]}><boxGeometry args={[W - 0.06, 0.03, 0.03]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
      <mesh position={[0, SHELVES[1] + 0.0175 + 0.008, 0.06]}><boxGeometry args={[W - 0.06, 0.016, 0.02]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
      {/* (the sides: a frame with three rails across) */}
      {[-1, 1].flatMap((sd) => [0.36, 0.84, 1.3].map((y) => (
        <mesh key={`s${sd}${y}`} position={[sd * W / 2, y, 0]}><boxGeometry args={[0.03, 0.03, D - 0.04]} /><meshToonMaterial map={wood(w.dark, 1, 0.2)} /></mesh>
      )))}
      {/* (the back, in tongue-and-groove boards, a dark line between each) */}
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={`b${k}`} position={[-W / 2 + 0.08 + k * ((W - 0.16) / 7), H / 2, -D / 2 + 0.01]} rotation-z={Math.PI / 2}><boxGeometry args={[H - 0.1, 0.152, 0.015]} /><meshToonMaterial map={wood(w.back, 1.5, 0.4)} /></mesh>
      ))}
      {byDesign.map((list, i) => <Plates key={`${i}-${list.length}`} design={i} list={list} />)}
    </group>
  )
}
