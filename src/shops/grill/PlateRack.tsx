// The dish racks (碗盤架): two low wooden stands side by side against the kitchen's wall with the customers' plates on them, standing on
// their edges in the slots along the lower shelf and in piles on the upper, each on a low cupboard of its own (blender/platecabinet.py: two
// drawers, two sliding doors); low enough that the kitchen's seen over them (the one tall cabinet stood in the way of the view). Each plate has
// one of the designs of wareDesigns.ts; every design is drawn as one instanced mesh.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PLATE_COUNT, PLATE_RACK } from './bar'
import { RACK_FULL } from '@/game/plates'
import { aimTip, setTip } from '@/scene/hoverTip'
import { HOVER } from '@/scene/hoverGlow'
import { wareGeometry } from './ware'
import { StaticBatch } from '@/scene/StaticBatch'
import { DESIGN_COUNT, wareDesign } from './wareDesigns'

// (each of the two: a metre across, two shelves, its 25 plates; low)
const W = 0.95, H = 0.86, D = 0.44
/** the cupboard it stands on (blender/platecabinet.py), its height: the rack's shelves start on its top */
const CAB = 0.56
/** how many plates each rack holds: the shop's (game/plates RACK_FULL) are shared between the two; those past what stands on its shelves
 * (PILE_N) are put away in the cupboard under it */
export const PER_RACK = 100
const CABINET_URL = import.meta.env.BASE_URL + 'models/platecabinet.glb'
/** the cupboard under the rack, in the room's toon light, its wood merged with the rack's */
function CabinetBase() {
  const gltf = useGLTF(CABINET_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const root = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = toon.get(src)
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map }); toon.set(src, t) }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    return root
  }, [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(CABINET_URL)
const PLATE_R = 0.17
const SHELVES = [0.1, 0.5]
const WOOD = '#a9774a'
const WOOD_DARK = '#7d5430'

/** a plate's section, out from the middle (x) and up (y), in its radius: a foot ring under it, a flat well, the rim sweeping up to a rounded
 * lip, and back down the inside a little thinner; all the way round (wareGeometry turns it). Ten points (it was eighteen: the rim's sweep in
 * three steps each side, which the outline and the toon light never showed from across the kitchen) */
function plateProfile(R: number): [number, number][] {
  const pts: [number, number][] = [[0, 0.018], [0.33, 0.004], [0.42, 0], [0.5, 0.02], [0.76, 0.065], [0.995, 0.165], [0.975, 0.172],
    [0.74, 0.088], [0.45, 0.042], [0, 0.04]]
  return pts.map(([x, y]) => [x * R, y * R])
}
// (sixteen round: fifty of them stand in the racks, each inked, seen from across the kitchen, stood on edge or stacked; 288 faces each,
// 680 before (the owner's: the racks drew 68,000 between them))
const GEO = wareGeometry(plateProfile(PLATE_R), PLATE_R, 16)
type Spot = { m: THREE.Matrix4; design: number }

/** how far each plate in a pile stands above the one under it: they nest, foot in the one below's well (the plate's well sits 0.04 R up,
 * its foot 0.02 R into the one below) */
const NEST = 0.045 * PLATE_R
/** the slots on the lowest shelf: how far apart the plates stand in them, and how many */
const SLOT = 0.075, SLOTS = 11
const slotX = (k: number) => -((SLOTS - 1) * SLOT) / 2 + k * SLOT
/** where the four show plates stand on the third shelf, and the four piles on the top one */
const PILE_X = [-0.22, 0.22]
/** how many plates in each pile on the top shelf (30 nested stand some 23 cm, under the rack's top; seven before, fifty plates in the shop) */
const PILE_N = 30
/** the bowls on the second shelf: piles turned over, as bowls are put away */
/** every plate on the rack: where it is, and which design. Set as they'd really stand, none through another: on the lowest shelf each stands
 * on its edge in its slot between the dowels, its face to the side, leaning back a touch; on the middle one three show their faces, leaning
 * against the back rail, well apart; on the top, three piles, each plate nested in the one under it, a little off true */
function platesOf(part: number) {
  const out: Spot[] = []
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
  let n = part * 3
  const shelfTop = (y: number) => y + 0.0175
  // (in the slots: turned on edge, face to the side (about z), leaning 8° toward the next; resting on its rim)
  const lean = 0.14
  for (let k = 0; k < SLOTS; k++) {
    e.set(0, 0, Math.PI / 2 - lean, 'ZYX')
    q.setFromEuler(e)
    p.set(slotX(k), shelfTop(SHELVES[0]) + PLATE_R * Math.cos(lean) + 0.002, 0)
    out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: n++ })
  }
  // (the piles on the upper shelf: nested, each turned and set a hair off the one under it)
  for (const [k, x] of PILE_X.entries()) {
    for (let j = 0; j < PILE_N; j++) {
      e.set(0, k * 1.3 + j * 0.7 + part, 0)
      q.setFromEuler(e)
      p.set(x + Math.sin(j * 2.1 + k) * 0.004, shelfTop(SHELVES[1]) + j * NEST, Math.cos(j * 1.7 + k) * 0.004)
      out.push({ m: new THREE.Matrix4().compose(p.clone(), q.clone(), s), design: k + 1 + part * 2 })
    }
  }
  return out
}

function Plates({ design, list, geo = GEO, ink: inked = true, map }: { design: number; list: Matrix4List; geo?: THREE.BufferGeometry; ink?: boolean; map?: THREE.Texture | null }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const ink = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    list.forEach((m, i) => { ref.current?.setMatrixAt(i, m); ink.current?.setMatrixAt(i, m.clone().scale(new THREE.Vector3(1.012, 1.012, 1.012))) })
    for (const r of [ref.current, ink.current]) if (r) r.instanceMatrix.needsUpdate = true
  }, [list])
  if (!list.length) return null
  return (
    <>
      <instancedMesh ref={ref} args={[geo, undefined, list.length]} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={map === undefined ? wareDesign(design) : map} />
      </instancedMesh>
      {/* (an ink line round each; not for the bowls, whose piles' rims would show it as dark bands) */}
      {inked && <instancedMesh ref={ink} args={[geo, undefined, list.length]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </instancedMesh>}
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

/** one of the two racks (`part` 0 or 1) and its plates, origin at the middle of its foot, its front toward +z. The plates on them are all
 * the shop's (game/plates): the first rack shows the first 25 of what's there, the second the rest (so the second empties first; on each
 * the piles on top go before the standing ones). A server comes to the front of it for a plate before each customer's first dish
 * (`rack-front-<part>`, where they stand; `rack-top-<part>`, where the plate's taken from), and the washed ones come back onto it from the sink */
/** what a rack says pointed at (the owner's, 2026-11-10: every plate counted): how many it holds, and where all the shop's are */
function rackSays(part: number) {
  const mine = Math.max(0, Math.min(PER_RACK, PLATE_COUNT.rack - part * PER_RACK))
  return `這一組 ${mine}/${PER_RACK}・全店 ${PLATE_COUNT.rack}/${RACK_FULL}｜使用中 ${PLATE_COUNT.out}・水槽 ${PLATE_COUNT.sink}・洗碗機 ${PLATE_COUNT.washer}・瀝水籃 ${PLATE_COUNT.basket}`
}
export function PlateRack({ part = 0 }: { part?: number }) {
  const all = useMemo(() => platesOf(part), [part])
  const [count, setCount] = useState(PLATE_RACK.n)
  useFrame(() => { if (PLATE_RACK.n !== count) setCount(PLATE_RACK.n) })
  const byDesign = useMemo(() => {
    const out: Matrix4List[] = Array.from({ length: DESIGN_COUNT }, () => [])
    const mine = Math.max(0, Math.min(PER_RACK, count - part * PER_RACK))
    for (const sp of all.slice(0, mine)) out[sp.design % DESIGN_COUNT].push(sp.m)
    return out
  }, [all, count, part])
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
  return (
    <group>
      {/* (what the editor's pointer finds: the whole rack and its cupboard, unseen; its wood is merged, a few draws, and takes no pointing) */}
      <mesh position={[0, (H + CAB) / 2, 0.02]} visible={false}
        onPointerOver={(e) => { e.stopPropagation(); if (HOVER.paused) return; aimTip(e); setTip({ title: '碗盤架', hint: rackSays(part) }) }}
        onPointerOut={() => { if (!HOVER.paused) setTip(null) }}>
        <boxGeometry args={[W + 0.06, H + CAB, D + 0.08]} />
      </mesh>
      {/* (where a server stands for a plate, and where it's lifted off) */}
      <group name={`rack-front-${part}`} position={[0, 0, D / 2 + 0.5]} />
      <group name={`rack-top-${part}`} position={[0, CAB + SHELVES[1] + 0.12, 0.04]} />
      <StaticBatch plain>
      <CabinetBase />
      {/* (the rack itself, up on the cupboard's top) */}
      <group position-y={CAB}>
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
        {/* (a low lip along the front of each shelf, so nothing slides off, kept low so it hides nothing that stands on it) */}
        {SHELVES.map((y) => (
          <mesh key={`r${y}`} position={[0, y + 0.03, D / 2 - 0.012]}><boxGeometry args={[W - 0.06, 0.03, 0.02]} /><meshToonMaterial map={wood(w.dark, 3, 0.2)} /></mesh>
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
        {/* (the sides: a frame with three rails across) */}
        {[-1, 1].flatMap((sd) => [0.32, 0.7].map((y) => (
          <mesh key={`s${sd}${y}`} position={[sd * W / 2, y, 0]}><boxGeometry args={[0.03, 0.03, D - 0.04]} /><meshToonMaterial map={wood(w.dark, 1, 0.2)} /></mesh>
        )))}
        {/* (the back, in tongue-and-groove boards, a dark line between each) */}
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={`b${k}`} position={[-W / 2 + 0.08 + k * ((W - 0.16) / 5), H / 2, -D / 2 + 0.01]} rotation-z={Math.PI / 2}><boxGeometry args={[H - 0.1, 0.152, 0.015]} /><meshToonMaterial map={wood(w.back, 1, 0.4)} /></mesh>
        ))}
      </group>
      </StaticBatch>
      <group position-y={CAB}>
        {byDesign.map((list, i) => <Plates key={`${i}-${list.length}`} design={i} list={list} />)}
      </group>
    </group>
  )
}
