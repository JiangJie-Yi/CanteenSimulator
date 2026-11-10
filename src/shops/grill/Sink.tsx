// The kitchen's sink (blender/sink.py): a Japanese one, as an old shop's kitchen has it, against the back by the freezer: its counter (one
// slab) and deep basin of terrazzo, its dark sugi cabinet with an indigo noren under the basin and a dish washer (洗碗機) let into its right, a
// steel tap, a bamboo draining basket of plates, a hinoki pail, a bin for the used sticks beside it. The customers' dirty plates are rinsed in
// it by a server (GuestBar3D sets SINK.washing while they are, and the tap runs into the basin) and stood in the washer, its door down while
// they do (DRYER.open). The player can work it too (the owner's, 2026-11-10): its door clicked down (not while it washes) and its basket slid
// out; the basket clicked, the sink's dirty plates put in it; the door clicked shut with plates in, it washes (game/plates DRY_S, about eight
// seconds: its lamp blue, a ring round on its panel, the spray heard), done with a chime, its door eased ajar and a breath of steam out of it.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { plainColours, mergeByMaterial } from '@/scene/StaticBatch'
import { reflectStudio, useStudio } from '@/scene/studio'
import { Steam } from '@/scene/Steam'
import { canOpen, DRAIN_CAP, DRY_S, DRYER_CAP, dryerPhase, playerLoad, shutStarts, type DryerPhase } from '@/game/plates'
import { DRAIN, DRYER, SINK, tipOver } from './bar'
import { aimTip, setTip } from '@/scene/hoverTip'
import { HOVER } from '@/scene/hoverGlow'
import { getEdit } from './edit'
import { coolerDoorSound, tapRunning, tapTurnSound, washerBeep, washerChime } from './restroomSound'

const URL = import.meta.env.BASE_URL + 'models/sink.glb'
/** the brass, the copper and the dryer's stainless: real metal, reflecting the studio (it only reads as metal by what it reflects) */
const METAL = /^Sink(Brass|Copper|Steel|SteelTap|DryerLiner)$/
/** too fine for an ink line, or cloth: the tap's arms and knobs, its bag and string, the rods, rims and pegs, the plates' rims, the slats */
const FINE = /^Sink(Tap(Arm|Knob|String|Bag|Cap|Stem|Screen|Mouth)|BasketRim|BasketFoot|NorenRod|Noren\d|Towel|Pull|RackPlateRim|DrainHole|Slat|PailWater|Dryer(Button|Lamp|Rail|Handle|Cavity|Glass)|Bin(Liner|Floor|Rim)|RackWire|Detergent(Soap|Collar|Pump|Head|Spout))/
/** cloth, seen from either side (and the bin's liner, seen from inside it) */
const CLOTH = /^Sink(Noren|Cloth|BinLiner)$/

/** what stands on it, each a piece of its own (the owner's: they're split off), placed by Decor's SinkAt each in its own Movable */
export const SINK_SETS = [
  { node: 'SinkBasketSet', id: 'sink-basket', label: '瀝水籃' },
  { node: 'SinkScrubSet', id: 'sink-scrub', label: '棕櫚刷' },
  { node: 'SinkSoapSet', id: 'sink-soap', label: '肥皂' },
  { node: 'SinkTowelSet', id: 'sink-towel', label: '布巾' },
  { node: 'SinkBinSet', id: 'sink-bin', label: '竹籤垃圾桶' },
  // (behind the tap to its left (the owner's): the dish soap's pump bottle and the sponge scourer)
  { node: 'SinkDetergentSet', id: 'sink-detergent', label: '洗碗精' },
  { node: 'SinkSpongeSet', id: 'sink-sponge', label: '菜瓜布' },
] as const
/** the washer's lamp: off, blue while it washes, green once its plates are clean (one material, lit by the frame) */
const DRYER_LAMP = new THREE.MeshBasicMaterial({ color: '#3a3a36', toneMapped: false })
const LAMP_OFF = new THREE.Color('#3a3a36'), LAMP_RUN = new THREE.Color('#4aa8ff'), LAMP_DONE = new THREE.Color('#52f07a')
/** the dish soap's bottle: a pale green, half see-through, the soap in it showing */
const SOAP_BOTTLE = (() => {
  const g = new THREE.MeshStandardMaterial({ color: '#d6eed6', transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0, depthWrite: false })
  reflectStudio(g)
  return g
})()
/** its window: dark glass, a little see-through (the plates standing in it show), catching the studio's light */
const DRYER_GLASS = (() => {
  const g = new THREE.MeshStandardMaterial({ color: '#3a4652', transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.25, envMapIntensity: 0.8 })
  reflectStudio(g)
  return g
})()
/** the sink's materials made over for the room, one for each of the model's (shared by the sink and what's split off it) */
const sinkMats = new Map<THREE.Material, THREE.Material>()
function sinkMat(src: THREE.MeshStandardMaterial) {
  let t = sinkMats.get(src)
  if (!t) {
    if (src.name === 'SinkLamp') t = DRYER_LAMP
    else if (src.name === 'SinkGlass') t = DRYER_GLASS
    else if (src.name === 'SinkSoapBottle') t = SOAP_BOTTLE
    else if (METAL.test(src.name)) {
      const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.85, roughness: Math.max(0.22, src.roughness), envMapIntensity: 0.9 })
      reflectStudio(g)
      t = g
    } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, side: CLOTH.test(src.name) ? THREE.DoubleSide : THREE.FrontSide })
    if (t !== DRYER_LAMP && t !== DRYER_GLASS && t !== SOAP_BOTTLE) t.name = src.name
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

const SINK_AT_V = new THREE.Vector3()
const WATER = new THREE.MeshBasicMaterial({ color: '#cfeaf6', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })
const SPLASH = new THREE.MeshBasicMaterial({ color: '#e8f6fc', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })

/** the washer's progress ring, on its panel: a dark track, the arc round it as it washes (blue), whole once it's done (green), the seconds left
 * in its middle, a tick when it's done (drawn again only when what it shows changes) */
const RING_CANVAS = typeof document !== 'undefined' ? document.createElement('canvas') : null
if (RING_CANVAS) RING_CANVAS.width = RING_CANVAS.height = 128
const RING_TEX = RING_CANVAS ? new THREE.CanvasTexture(RING_CANVAS) : null
if (RING_TEX) RING_TEX.colorSpace = THREE.SRGBColorSpace
const RING_MAT = new THREE.MeshBasicMaterial({ map: RING_TEX, transparent: true, toneMapped: false, depthWrite: false })
let ringShown = ''
function paintRing(ph: DryerPhase, k: number, left: number) {
  const g = RING_CANVAS?.getContext('2d')
  const key = `${ph}|${Math.round(k * 60)}|${Math.ceil(left)}`
  if (!g || key === ringShown) return
  ringShown = key
  g.clearRect(0, 0, 128, 128)
  g.lineCap = 'round'
  g.lineWidth = 12
  g.strokeStyle = 'rgba(70,74,80,0.9)'; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke()
  if (ph === 'washing' || ph === 'clean') {
    g.strokeStyle = ph === 'clean' ? '#52f07a' : '#4aa8ff'
    g.beginPath(); g.arc(64, 64, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, k)); g.stroke()
  }
  g.fillStyle = ph === 'clean' ? '#52f07a' : '#cfe6ff'
  if (ph === 'washing') {
    g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(String(Math.max(1, Math.ceil(left))), 64, 67)
  } else if (ph === 'clean') {
    g.strokeStyle = '#52f07a'; g.lineWidth = 10
    g.beginPath(); g.moveTo(42, 66); g.lineTo(58, 82); g.lineTo(88, 48); g.stroke()
  }
  if (RING_TEX) RING_TEX.needsUpdate = true
}
const SOUND_V = new THREE.Vector3()
/** how far the washer's basket slides out once its door's right down */
const RACK_OUT = 0.16

/** the sink itself (what stands on it is SinkPart's), its tap's handle turned to run the water by hand (the owner's); the washer worked by hand
 * too (its door and its basket) */
export function SinkModel() {
  useStudio()
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { root, tip, floor, handle, door, rack, rackZ, ringAt, steamAt } = useMemo(() => {
    const r = gltf.scene.clone(true)
    // (what stands on it taken off: each placed as a piece of its own)
    for (const set of SINK_SETS) r.getObjectByName(set.node)?.removeFromParent()
    // (and the tap's handle, turned as the water's turned on and off: in a group of its own, to take the pointer; and the washer's door,
    // turned down about its hinge as it's loaded and emptied, and its basket, slid out with it (the plates' marks in it go with it))
    const handle = r.getObjectByName('SinkTapHandle')!
    handle.removeFromParent()
    const door = r.getObjectByName('SinkDryerDoor')!
    const doorAt = door.position.clone()
    door.removeFromParent()
    const rack = r.getObjectByName('SinkDryerRack')!
    const rackAt = rack.position.clone()
    rack.removeFromParent()
    dressSink(r)
    dressSink(handle)
    dressSink(door)
    dressSink(rack)
    r.updateMatrixWorld(true)
    const at = (n: string) => r.worldToLocal(r.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()))
    const tip = at('SinkSpoutTip'), floor = at('SinkBasinFloor'), ringAt = at('SinkDryerRing'), steamAt = at('SinkDryerSteam')
    // (never moving: a mesh or two for each material, its ink one line; the marks the game reads (the tap's mouth, the basin's floor) kept)
    plainColours(r)
    mergeByMaterial(r)
    mergeByMaterial(handle)
    mergeByMaterial(door)
    mergeByMaterial(rack)
    door.position.copy(doorAt)
    rack.position.copy(rackAt)
    return { root: r, tip, floor, handle, door, rack, rackZ: rackAt.z, ringAt, steamAt }
  }, [gltf])
  // (the washer's door eased down and up; it drops forward, about its foot)
  const opened = useRef(0)
  // (what it was doing a moment ago, when it finished, and its steam's strength)
  const was = useRef<DryerPhase>(dryerPhase(DRYER))
  const doneAt = useRef(-1e9)
  const steam = useRef(0)
  // (the handle a quarter turn round while the water's on, turned there and back, heard as it's turned)
  const turn = useRef(0)
  const wasOn = useRef(SINK.tap)
  // the tap running while the plates are being washed: a stream from its mouth to the basin's floor, wavering, a splash ring where it lands
  const stream = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const len = tip.y - floor.y
  const says = () => (SINK.tap ? '點一下關水' : SINK.washing ? '正在洗碗；點一下也能自己開水' : '點一下開水')
  // (what the washer's door and its basket say, as it is now)
  const doorSays = () => {
    const ph = dryerPhase(DRYER), n = DRYER.n
    if (ph === 'washing') return `洗碗中⋯⋯還要 ${Math.max(1, Math.ceil(DRYER.left ?? 0))} 秒`
    if (ph === 'clean') return `洗好了（${n} 個），外場會收回碗盤櫃｜點一下${DRYER.manual ? '關門' : '開門'}`
    if (DRYER.manual) return n > 0 ? `裡面 ${n} 個髒盤｜點一下關門開始洗` : '點一下關門'
    return `點一下打開機門${n ? `（裡面 ${n} 個）` : ''}`
  }
  const rackSays = () => {
    if (!DRYER.manual && DRYER.open < 1) return '打開機門才放得進去'
    const k = playerLoad(SINK.dirty, DRYER)
    if (k > 0) return `點一下把流理台的 ${k} 個髒盤放進來`
    if (dryerPhase(DRYER) === 'clean') return '裡面是洗好的，要先拿出來'
    if (DRYER.n >= DRYER_CAP) return `放滿了（${DRYER_CAP} 個）`
    return '流理台沒有髒盤子'
  }
  // (which of the washer's is pointed at: its tag kept up to date as it counts down, and as it's loaded and emptied by the staff)
  const hov = useRef<'door' | 'rack' | null>(null)
  useFrame(({ clock, camera }, dt) => {
    if (hov.current === 'door') setTip({ title: '洗碗機', hint: doorSays() })
    else if (hov.current === 'rack') setTip({ title: '洗碗籃', hint: rackSays() })
    const on = SINK.washing || SINK.tap
    // (heard running, as loud as it's near)
    const near = Math.max(0, Math.min(1, 1 - (root.getWorldPosition(SINK_AT_V).distanceTo(camera.position) - 1.5) / 7))
    tapRunning('sink', on ? near : 0)
    if (SINK.tap !== wasOn.current) { wasOn.current = SINK.tap; tapTurnSound(SINK.tap, Math.max(0.35, near)) }
    turn.current += ((SINK.tap ? 1 : 0) - turn.current) * Math.min(1, Math.min(dt, 0.1) * 8)
    handle.rotation.y = turn.current * (Math.PI / 2)
    // (the washer: done just now, a chime and a breath of steam; its door down while someone's at it or the player's let it down, ajar
    // once it's done; its basket out once the door's right down; its lamp, its ring, its spray)
    const ph = dryerPhase(DRYER)
    if (ph === 'clean' && was.current === 'washing') { doneAt.current = performance.now(); washerChime(root.localToWorld(SOUND_V.copy(ringAt))) }
    was.current = ph
    const want = Math.max(DRYER.open, DRYER.manual ? 1 : 0, ph === 'clean' ? 0.15 : 0)
    opened.current += (want - opened.current) * Math.min(1, Math.min(dt, 0.1) * 5)
    door.rotation.x = opened.current * (Math.PI / 2)
    rack.position.z = rackZ + RACK_OUT * Math.min(1, Math.max(0, (opened.current - 0.55) / 0.45))
    DRYER_LAMP.color.copy(ph === 'washing' ? LAMP_RUN : ph === 'clean' ? LAMP_DONE : LAMP_OFF)
    const left = DRYER.left ?? 0
    paintRing(ph, ph === 'washing' ? 1 - left / DRY_S : ph === 'clean' ? 1 : 0, left)
    tapRunning('washer', ph === 'washing' ? near * 0.45 : 0)
    steam.current = Math.max(0, 1 - (performance.now() - doneAt.current) / 7000) * (0.5 + 0.5 * opened.current)
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
  const doorClick = (e: Parameters<NonNullable<ReturnType<typeof tipOver>['onPointerOver']>>[0] & { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (getEdit().on) return
    const at = door.getWorldPosition(SOUND_V)
    if (!canOpen(DRYER)) { washerBeep(at); tipOver('洗碗機', doorSays()).onPointerOver(e); return }
    if (DRYER.manual) {
      DRYER.manual = false
      if (shutStarts(DRYER)) DRYER.left = DRY_S
      coolerDoorSound(false, 0.5)
    } else {
      DRYER.manual = true
      coolerDoorSound(true, 0.5)
    }
    tipOver('洗碗機', doorSays()).onPointerOver(e)
  }
  const rackClick = (e: Parameters<NonNullable<ReturnType<typeof tipOver>['onPointerOver']>>[0] & { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (getEdit().on || (!DRYER.manual && DRYER.open < 1)) return
    DRYER.ask = 1
    window.setTimeout(() => tipOver('洗碗籃', rackSays()).onPointerOver(e), 60)
  }
  return (
    <group>
      <primitive object={root} />
      {/* (the washer's door: pointed at it lights and says what the washer's doing; clicked, down or up (not while it washes)) */}
      <group onPointerOver={(e) => { if (getEdit().on) return; hov.current = 'door'; tipOver('洗碗機', doorSays()).onPointerOver(e) }}
        onPointerOut={(e) => { if (hov.current === 'door') hov.current = null; if (getEdit().on) return; tipOver('洗碗機', '').onPointerOut(e) }}
        onClick={doorClick}>
        <primitive object={door} />
      </group>
      {/* (its basket, behind the door: once the door's down, clicked, the sink's dirty plates put in it) */}
      <group onPointerOver={(e) => { if (getEdit().on) return; hov.current = 'rack'; tipOver('洗碗籃', rackSays()).onPointerOver(e) }}
        onPointerOut={(e) => { if (hov.current === 'rack') hov.current = null; if (getEdit().on) return; tipOver('洗碗籃', '').onPointerOut(e) }}
        onClick={rackClick}>
        <primitive object={rack} />
      </group>
      {/* (its progress ring, lit on its panel) */}
      <mesh position={ringAt} material={RING_MAT} raycast={() => {}} renderOrder={2}>
        <planeGeometry args={[0.034, 0.034]} />
      </mesh>
      {/* (the breath of steam out of its door as it finishes) */}
      <Steam position={[steamAt.x, steamAt.y, steamAt.z]} level={steam} width={0.36} height={0.42} opacity={0.42} layers={3} speed={0.1} />
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
    // (the draining basket's three plates as it's made taken out: the plates washed by hand stand in it as many as there are (GuestBar3D))
    if (node === 'SinkBasketSet') {
      const made: THREE.Object3D[] = []
      r.traverse((o) => { if (/^SinkRackPlate/.test(o.name)) made.push(o) })
      for (const o of made) o.removeFromParent()
    }
    dressSink(r)
    plainColours(r)
    mergeByMaterial(r)
    return r
  }, [gltf, node])
  // (the draining basket says how many plates stand in it and whether they're dry (the owner's: every plate counted))
  if (node === 'SinkBasketSet') return (
    <group onPointerOver={(e) => { e.stopPropagation(); if (HOVER.paused) return; aimTip(e); setTip({ title: '瀝水籃', hint: basketSays() }) }}
      onPointerOut={() => { if (!HOVER.paused) setTip(null) }}>
      <primitive object={obj} />
    </group>
  )
  return <primitive object={obj} />
}
/** what the draining basket says pointed at */
function basketSays() {
  if (DRAIN.n <= 0) return `0/${DRAIN_CAP} 個盤子・空的`
  return `${DRAIN.n}/${DRAIN_CAP} 個盤子・` + (DRAIN.left !== null && DRAIN.left > 0 ? `還要 ${Math.ceil(DRAIN.left)} 秒瀝乾` : '乾了，等著搬回碗盤架')
}
useGLTF.preload(URL)
