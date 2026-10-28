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

/** every plate on the rack: where it is, and which design */
function platesOf() {
  const out: Spot[] = []
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
  let n = 0
  // (standing on edge along each shelf, leaning back a little against the back, the painted face to the front)
  for (const y of SHELVES.slice(0, 2)) {
    for (let k = 0; k < 7; k++) {
      e.set(Math.PI / 2 - 0.14, 0, 0)
      q.setFromEuler(e)
      p.set(-W / 2 + 0.17 + k * 0.16, y + 0.04 + PLATE_R, -0.02)
      out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: n++ })
    }
  }
  // (piles on the top shelf, each a stack of the one design)
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < 6; j++) {
      e.set(0, k * 1.3 + j * 0.2, 0)
      q.setFromEuler(e)
      p.set(-0.38 + k * 0.38, SHELVES[2] + 0.04 + j * 0.034, 0)
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
      {SHELVES.slice(0, 2).flatMap((y) => Array.from({ length: 8 }, (_, k) => (
        <mesh key={`d${y}${k}`} position={[-W / 2 + 0.09 + k * 0.16, y + 0.11, 0.06]}><cylinderGeometry args={[0.007, 0.007, 0.17, 8]} /><meshToonMaterial color="#5a3a1e" /></mesh>
      )))}
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
