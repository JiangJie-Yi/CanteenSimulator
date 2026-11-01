// The kitchen's sink (blender/sink.py): a Japanese one, as an old shop's kitchen has it, against the back past the freezer: its counter
// and deep basin of terrazzo, its dark sugi cabinet with an indigo noren under the basin and slatted sliding doors, a brass tap with a
// cloth bag tied over its mouth, a bamboo draining basket of plates, a hinoki pail. The customers' dirty plates are washed in it:
// GuestBar3D sets SINK.washing while they are, and the tap runs into the basin.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { reflectStudio, useStudio } from '@/scene/studio'
import { SINK, tipOver } from './bar'
import { getEdit } from './edit'

const URL = import.meta.env.BASE_URL + 'models/sink.glb'
/** the brass and the copper: real metal, reflecting the studio (it only reads as metal by what it reflects) */
const METAL = /^Sink(Brass|Copper)$/
/** too fine for an ink line, or cloth: the tap's arms and knobs, its bag and string, the rods, rims and pegs, the plates' rims, the slats */
const FINE = /^Sink(Tap(Arm|Knob|String|Bag|Cap|Stem)|BasketRim|BasketFoot|NorenRod|Noren\d|Towel|Pull|RackPlateRim|DrainHole|Slat|PailWater)/
/** cloth, seen from either side */
const CLOTH = /^Sink(Noren|Cloth)$/

/** what stands on it, each a piece of its own (the owner's: they're split off), placed by Decor's SinkAt each in its own Movable */
export const SINK_SETS = [
  { node: 'SinkBasketSet', id: 'sink-basket', label: '瀝水籃' },
  { node: 'SinkScrubSet', id: 'sink-scrub', label: '棕櫚刷' },
  { node: 'SinkSoapSet', id: 'sink-soap', label: '肥皂' },
  { node: 'SinkPailSet', id: 'sink-pail', label: '檜木手桶' },
  { node: 'SinkTowelSet', id: 'sink-towel', label: '布巾' },
] as const
/** the sink's materials made over for the room, one for each of the model's (shared by the sink and what's split off it) */
const sinkMats = new Map<THREE.Material, THREE.Material>()
function sinkMat(src: THREE.MeshStandardMaterial) {
  let t = sinkMats.get(src)
  if (!t) {
    if (METAL.test(src.name)) {
      const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.85, roughness: Math.max(0.22, src.roughness), envMapIntensity: 0.9 })
      reflectStudio(g)
      t = g
    } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, side: CLOTH.test(src.name) ? THREE.DoubleSide : THREE.FrontSide })
    t.name = src.name
    sinkMats.set(src, t)
  }
  return t
}
/** a part of the sink's model in the room's light: its materials made over, inked */
function dressSink(r: THREE.Object3D) {
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.material = sinkMat(m.material as THREE.MeshStandardMaterial)
    m.castShadow = !FINE.test(m.name)
    m.receiveShadow = true
  })
  inkModel(r, (m) => FINE.test(m.name), { width: 0.004, weld: true })
}

const WATER = new THREE.MeshBasicMaterial({ color: '#cfeaf6', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })
const SPLASH = new THREE.MeshBasicMaterial({ color: '#e8f6fc', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })

/** the sink itself (what stands on it is SinkPart's), its tap's handle turned to run the water by hand (the owner's) */
export function SinkModel() {
  useStudio()
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { root, tip, floor, handle } = useMemo(() => {
    const r = gltf.scene.clone(true)
    // (what stands on it taken off: each placed as a piece of its own)
    for (const set of SINK_SETS) r.getObjectByName(set.node)?.removeFromParent()
    // (and the tap's handle, turned as the water's turned on and off: in a group of its own, to take the pointer)
    const handle = r.getObjectByName('SinkTapHandle')!
    handle.removeFromParent()
    dressSink(r)
    dressSink(handle)
    r.updateMatrixWorld(true)
    const at = (n: string) => r.worldToLocal(r.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()))
    const tip = at('SinkSpoutTip'), floor = at('SinkBasinFloor')
    // (never moving: a mesh or two for each material, its ink one line; the marks the game reads (the tap's mouth, the basin's floor) kept)
    mergeByMaterial(r)
    mergeByMaterial(handle)
    return { root: r, tip, floor, handle }
  }, [gltf])
  // (the handle a quarter turn round while the water's on, turned there and back)
  const turn = useRef(0)
  // the tap running while the plates are being washed: a stream from its mouth to the basin's floor, wavering, a splash ring where it lands
  const stream = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const len = tip.y - floor.y
  useFrame(({ clock }, dt) => {
    const on = SINK.washing || SINK.tap
    turn.current += ((SINK.tap ? 1 : 0) - turn.current) * Math.min(1, Math.min(dt, 0.1) * 8)
    handle.rotation.y = turn.current * (Math.PI / 2)
    const t = clock.elapsedTime
    if (stream.current) {
      stream.current.visible = on
      if (on) stream.current.scale.set(1 + Math.sin(t * 31) * 0.12, 1, 1 + Math.cos(t * 27) * 0.12)
    }
    if (ring.current) {
      ring.current.visible = on
      if (on) { const k = 1 + ((t * 2.4) % 1) * 1.6; ring.current.scale.set(k, k, k); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((t * 2.4) % 1)) }
    }
  })
  const says = () => (SINK.tap ? '點一下關水' : SINK.washing ? '正在洗碗；點一下也能自己開水' : '點一下開水')
  return (
    <group>
      <primitive object={root} />
      {/* (the tap's handle: pointed at it lights and says so; clicked, the water's turned on, or off) */}
      <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('水龍頭', says()).onPointerOver(e) }}
        onPointerOut={(e) => { if (getEdit().on) return; tipOver('水龍頭', '').onPointerOut(e) }}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; SINK.tap = !SINK.tap; tipOver('水龍頭', says()).onPointerOver(e) }}>
        <primitive object={handle} />
      </group>
      <mesh ref={stream} position={[tip.x, floor.y + len / 2, tip.z]} material={WATER} visible={false}>
        <cylinderGeometry args={[0.007, 0.009, len, 8, 1, true]} />
      </mesh>
      <mesh ref={ring} position={[floor.x, floor.y + 0.004, floor.z]} rotation-x={-Math.PI / 2} material={SPLASH.clone()} visible={false}>
        <ringGeometry args={[0.012, 0.022, 20]} />
      </mesh>
    </group>
  )
}
/** one of what stands on the sink (SINK_SETS' node), in the sink's own frame: Decor's SinkAt sets it where the sink is, in a Movable of its own */
export function SinkPart({ node }: { node: string }) {
  useStudio()
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const src = gltf.scene.getObjectByName(node)
    if (!src) return new THREE.Group()
    const r = src.clone(true)
    dressSink(r)
    mergeByMaterial(r)
    return r
  }, [gltf, node])
  return <primitive object={obj} />
}
useGLTF.preload(URL)
