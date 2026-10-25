// The dish rack (碗盤櫃架): a wooden stand against the kitchen's wall with the customers' plates on it, standing on their edges along the
// shelves, and in piles on the top one. Each plate has one of the designs of wareDesigns.ts; every design is drawn as one instanced mesh.
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
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

/** the stand and its plates, origin at the middle of its foot, its front toward +z */
export function PlateRack() {
  const byDesign = useMemo(() => {
    const out: Matrix4List[] = Array.from({ length: DESIGN_COUNT }, () => [])
    for (const sp of platesOf()) out[sp.design % DESIGN_COUNT].push(sp.m)
    return out
  }, [])
  const post = (x: number, z: number) => (
    <mesh key={`${x}${z}`} position={[x, H / 2, z]} castShadow><boxGeometry args={[0.06, H, 0.06]} /><meshToonMaterial color={WOOD_DARK} /></mesh>
  )
  return (
    <group>
      {post(-W / 2, -D / 2)}{post(W / 2, -D / 2)}{post(-W / 2, D / 2)}{post(W / 2, D / 2)}
      {SHELVES.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow><boxGeometry args={[W, 0.04, D]} /><meshToonMaterial color={WOOD} /></mesh>
      ))}
      <mesh position={[0, H - 0.02, 0]} castShadow><boxGeometry args={[W + 0.06, 0.05, D + 0.06]} /><meshToonMaterial color={WOOD_DARK} /></mesh>
      {/* (a low rail across the front of each shelf, so the plates can't slide off) */}
      {SHELVES.map((y) => (
        <mesh key={`r${y}`} position={[0, y + 0.07, D / 2 - 0.015]}><boxGeometry args={[W - 0.06, 0.05, 0.03]} /><meshToonMaterial color={WOOD_DARK} /></mesh>
      ))}
      {/* (the back, in slats) */}
      {Array.from({ length: 8 }, (_, k) => (
        <mesh key={`b${k}`} position={[-W / 2 + 0.08 + k * ((W - 0.16) / 7), H / 2, -D / 2 + 0.01]}><boxGeometry args={[0.1, H - 0.1, 0.015]} /><meshToonMaterial color="#8b5e38" /></mesh>
      ))}
      {byDesign.map((list, i) => <Plates key={i} design={i} list={list} />)}
    </group>
  )
}
