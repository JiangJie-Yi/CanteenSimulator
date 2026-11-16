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
import { canOpen, DRY_S, DRYER_CAP, drainSays, dryerPhase, handWashSays, playerLoad, shutStarts, type DryerPhase } from '@/game/plates'
import { EMPTY_AT } from '@/game/bins'
import { DRAIN, DRYER, HAND_WASH, IN_USE, POINTER_HINT, SINK, SINK_BIN, SUPPLIES, squeezeSoap, tipOver } from './bar'
import { DISH_SOAP } from '@/game/household'
import { basinSays, waterTick } from '@/game/sinkWater'
import { GUIDE_OF, HAND_STEP_SAYS, WASH_WET, handStep, pumpSoap, soapWith, washTips } from '@/game/handWash'
import { glowOff, glowOn } from '@/scene/hoverGlow'
import { aimTip, setTip } from '@/scene/hoverTip'
import { HOVER } from '@/scene/hoverGlow'
import { getEdit } from './edit'
import { coolerDoorSound, tapRunning, tapTurnSound, washerBeep, washerChime } from './restroomSound'

const URL = import.meta.env.BASE_URL + 'models/sink.glb'
/** the brass, the copper and the dryer's stainless: real metal, reflecting the studio (it only reads as metal by what it reflects) */
const METAL = /^Sink(Brass|Copper|Steel|SteelTap|DryerLiner)$/
/** too fine for an ink line, or cloth: the tap's arms and knobs, its bag and string, the rods, rims and pegs, the plates' rims, the slats */
const FINE = /^Sink(Tap(Arm|Knob|String|Bag|Cap|Stem|Screen|Mouth)|Basket(Rim|Foot|Slat|Rail|Post)|Plug|Drain(Bar|Pipe|Ring)|Overflow|Water|NorenRod|Noren\d|Towel|Pull|RackPlateRim|DrainHole|Slat|PailWater|Dryer(Button|Lamp|Rail|Handle|Cavity|Glass)|Bin(Liner|Floor|Rim|Label|Rec(Liner|Label|Mark|Heap)|Heap)|RackWire|Detergent(Soap|Collar|Pump|Head|Spout))/
/** cloth, seen from either side (and the bin's liner, seen from inside it) */
const CLOTH = /^Sink(Noren|Cloth|BinLiner)$/

/** what stands on it, each a piece of its own (the owner's: they're split off), placed by Decor's SinkAt each in its own Movable */
export const SINK_SETS = [
  { node: 'SinkBasketSet', id: 'sink-basket', label: '瀝水籃' },
  { node: 'SinkScrubSet', id: 'sink-scrub', label: '棕櫚刷' },
  { node: 'SinkSoapSet', id: 'sink-soap', label: '肥皂' },
  { node: 'SinkTowelSet', id: 'sink-towel', label: '布巾' },
  // (the rubbish bin and the recycling bin behind it (the owner's, 2026-11-11: in place of the stainless bin for the sticks): one piece)
  { node: 'SinkBinSet', id: 'sink-bin', label: '垃圾桶與資源回收桶' },
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
/** the water standing in the basin (the plug in): clear, a little blue, catching the studio's light; see-through to nothing when it's empty */
const POOL = (() => {
  const g = new THREE.MeshStandardMaterial({ color: '#5f9fc0', transparent: true, opacity: 0, roughness: 0.05, metalness: 0.1, depthWrite: false, envMapIntensity: 1.2 })
  reflectStudio(g)
  return g
})()
/** where the plug lies out of the drain (the owner's, 2026-11-13, circled: on the counter by the tap's foot, to its left), in the model's frame
 * (blender/sink.py: the counter's top at 0.86, the basin's back wall at z -0.28 and its floor at 0.64, the tap at x -0.40 z -0.355) */
const SINK_TOP = 0.86, BASIN_BACK = -0.28, BASIN_FLOOR = 0.64
const PLUG_REST = new THREE.Vector3(-0.475, SINK_TOP, -0.35)
/**
 * The plug's chain (the owner's, 2026-11-13: "add a chain"): from a little eye on the basin's back rim before where the plug's laid, over the
 * rim, down the back wall and along the floor to the ring on the plug's top in the drain; drawn shorter as the plug comes out to lie by
 * it. Low-poly: each link one small card with a link drawn on it (see-through round it), each turned a quarter to the one before, as a
 * chain's links lie; one draw for all of them
 */
const CHAIN_STEP = 0.0125, CHAIN_MAX = 64
const CHAIN_EYE = new THREE.Vector3(-0.475, SINK_TOP + 0.003, BASIN_BACK - 0.01)
const CHAIN_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 32; c.height = 64
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 32, 64)
  g.strokeStyle = '#ffffff'; g.lineWidth = 7
  g.beginPath(); g.moveTo(9, 16); g.arc(16, 16, 7, Math.PI, 0); g.lineTo(23, 48); g.arc(16, 48, 7, 0, Math.PI); g.closePath(); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const CHAIN_MAT = (() => {
  const m = new THREE.MeshStandardMaterial({ color: '#c8cdd4', map: CHAIN_TEX, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.35 })
  reflectStudio(m)
  return m
})()
const CHAIN_GEO = new THREE.PlaneGeometry(0.0085, 0.0165)
const CHAIN_UP = new THREE.Vector3(0, 1, 0), CHAIN_Q = new THREE.Quaternion(), CHAIN_TWIST = new THREE.Quaternion(), CHAIN_M = new THREE.Matrix4()
const CHAIN_P = new THREE.Vector3(), CHAIN_D = new THREE.Vector3(), CHAIN_S = new THREE.Vector3(1, 1, 1), CHAIN_NONE = new THREE.Matrix4().makeScale(0, 0, 0)
const CHAIN_PTS = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
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
  const { root, tip, floor, handle, faucet, tapBox, door, rack, rackZ, ringAt, steamAt, plug, plugAt, plugOut, ringTop, chain, pool, poolY, base, rise } = useMemo(() => {
    const r = gltf.scene.clone(true)
    // (what stands on it taken off: each placed as a piece of its own)
    for (const set of SINK_SETS) r.getObjectByName(set.node)?.removeFromParent()
    // (the plug and its ring, lifted in and out of the drain as one, turned about the drain's middle; the water, raised as it fills)
    r.updateMatrixWorld(true)
    const lift = (n: string) => { const o = r.getObjectByName(n)!, m = o.matrixWorld.clone(); o.removeFromParent(); m.decompose(o.position, o.quaternion, o.scale); return o }
    const pool = lift('SinkWater') as THREE.Mesh
    const base = new THREE.Box3().setFromObject(pool).min.y, poolY = pool.position.y
    const plug = new THREE.Group()
    for (const n of ['SinkPlug', 'SinkPlugRing']) plug.add(lift(n))
    const plugBox = new THREE.Box3().setFromObject(plug)
    const plugAt = plugBox.getCenter(new THREE.Vector3())
    for (const o of plug.children) o.position.sub(plugAt)
    plug.position.copy(plugAt)
    // (out of the drain it stands on the counter by the tap: its foot on the counter's top; and its ring's top, where the chain's made fast)
    const plugOut = new THREE.Vector3(PLUG_REST.x - plugAt.x, PLUG_REST.y + (plugAt.y - plugBox.min.y) - plugAt.y, PLUG_REST.z - plugAt.z)
    const ringTop = plugBox.max.y - plugAt.y
    const chain = new THREE.InstancedMesh(CHAIN_GEO, CHAIN_MAT, CHAIN_MAX)
    chain.frustumCulled = false
    chain.raycast = () => {}
    chain.castShadow = false
    const top = r.getObjectByName('SinkWaterTop')!.getWorldPosition(new THREE.Vector3()).y
    // (and the tap's handle, turned as the water's turned on and off: in a group of its own, to take the pointer; and the washer's door,
    // turned down about its hinge as it's loaded and emptied, and its basket, slid out with it (the plates' marks in it go with it))
    const handle = r.getObjectByName('SinkTapHandle')!
    handle.removeFromParent()
    // (and the rest of the tap, its foot, body, spout and mouth, with it: the whole tap takes the pointer, not its lever alone (item 196, the
    // owner's 「我還是沒法用流理台桌來手動洗碗」: told to turn the water on, he clicked the tap, and its spout and body were the basin's, the
    // basin's hint again and the water never on; of the points on the tap, three in four were taken by the basin))
    const faucet = new THREE.Group()
    for (const n of ['SinkTapFoot', 'SinkTapBody', 'SinkTapSpout', 'SinkTapMouth', 'SinkTapScreen']) if (r.getObjectByName(n)) faucet.add(lift(n))
    // (the handle's box, a couple of centimetres over every way: more of it to point at (item 215); not the whole tap's, whose spout reaches
    // out over the middle of the basin, over the plug: a box round it all took the plug's, the basin's and the dirty plates' clicks)
    const tb = new THREE.Box3().setFromObject(handle)
    const tapBox = { at: tb.getCenter(new THREE.Vector3()), size: tb.getSize(new THREE.Vector3()).addScalar(0.03).toArray() as [number, number, number] }
    const door = r.getObjectByName('SinkDryerDoor')!
    const doorAt = door.position.clone()
    door.removeFromParent()
    const rack = r.getObjectByName('SinkDryerRack')!
    const rackAt = rack.position.clone()
    rack.removeFromParent()
    dressSink(r)
    dressSink(handle)
    dressSink(faucet)
    dressSink(door)
    dressSink(rack)
    r.updateMatrixWorld(true)
    const at = (n: string) => r.worldToLocal(r.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()))
    const tip = at('SinkSpoutTip'), floor = at('SinkBasinFloor'), ringAt = at('SinkDryerRing'), steamAt = at('SinkDryerSteam')
    dressSink(plug)
    mergeByMaterial(plug)
    pool.material = POOL
    pool.renderOrder = 2
    pool.raycast = () => {}
    // (never moving: a mesh or two for each material, its ink one line; the marks the game reads (the tap's mouth, the basin's floor) kept)
    plainColours(r)
    mergeByMaterial(r)
    mergeByMaterial(handle)
    plainColours(faucet)
    mergeByMaterial(faucet)
    mergeByMaterial(door)
    mergeByMaterial(rack)
    door.position.copy(doorAt)
    rack.position.copy(rackAt)
    return { root: r, tip, floor, handle, faucet, tapBox, door, rack, rackZ: rackAt.z, ringAt, steamAt, plug, plugAt, plugOut, ringTop, chain, pool, poolY, base, rise: top - base }
  }, [gltf])
  // (the plug's way out of the drain and back: 0 in, 1 lying beside it)
  const plugK = useRef(SINK.plug ? 0 : 1)
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
  const plugSays = () => (SINK.plug ? '塞著，可以蓄水｜點一下拔開，把水放掉' : '拔開著，水會直接流掉｜點一下塞上')
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
  const hov = useRef<'door' | 'rack' | 'basin' | null>(null)
  useFrame(({ clock, camera }, dt) => {
    // (a plate in the player's hand (item 224): it says how it's coming on, not what's under it)
    if (HAND_WASH.held) { /* (the plate's own) */ }
    else if (hov.current === 'door') setTip({ title: '洗碗機', hint: doorSays() })
    else if (hov.current === 'rack') setTip({ title: '洗碗籃', hint: rackSays() })
    else if (hov.current === 'basin') setTip({ title: '流理台', hint: basinHint() })
    const on = SINK.washing || SINK.tap
    // (the basin's water: filled by the tap with the plug in, let out by the drain without it, never over the overflow (game/sinkWater))
    const waterWas = SINK.water
    SINK.water = waterTick(SINK.water, on, SINK.plug, Math.min(dt, 0.1))
    // (the washing-up liquid goes with the water: the basin let out, none left in it (squeezed onto the sponge, with none standing, it stays))
    SINK.soap = soapWith(SINK.soap, waterWas, SINK.water)
    pool.position.y = poolY + rise * SINK.water
    POOL.opacity = SINK.water > 0.002 ? 0.38 : 0
    // (the plug lifted out and laid by the drain, or back in: up out of the hole first, then over)
    plugK.current += ((SINK.plug ? 0 : 1) - plugK.current) * Math.min(1, Math.min(dt, 0.1) * 6)
    const k = plugK.current
    // (up out of the hole and over the basin's back wall in an arc, down on the counter by the tap; a little tipped on the way)
    plug.position.set(plugAt.x + plugOut.x * k, plugAt.y + plugOut.y * k + Math.sin(Math.PI * k) * 0.12, plugAt.z + plugOut.z * k)
    plug.rotation.z = 0.15 * Math.sin(Math.PI * k)
    // (the chain from its eye on the rim over the edge, down the wall and along the floor to the plug's ring; the wall and floor runs drawn
    // in as the plug comes out, so it's the rim to the ring on the counter)
    {
      const [a, b, c, d] = CHAIN_PTS
      a.copy(CHAIN_EYE)
      b.set(CHAIN_EYE.x, SINK_TOP + 0.003, BASIN_BACK + 0.006)
      c.set(THREE.MathUtils.lerp(CHAIN_EYE.x, plug.position.x, 0.35), BASIN_FLOOR + 0.004, BASIN_BACK + 0.012).lerp(b, k)
      d.copy(plug.position).y += ringTop
      let n = 0, carry = 0
      for (let i = 0; i < 3 && n < CHAIN_MAX; i++) {
        const p0 = CHAIN_PTS[i], p1 = CHAIN_PTS[i + 1]
        const len = p0.distanceTo(p1)
        if (len < 1e-5) continue
        CHAIN_D.copy(p1).sub(p0).divideScalar(len)
        CHAIN_Q.setFromUnitVectors(CHAIN_UP, CHAIN_D)
        for (let s = carry; s < len && n < CHAIN_MAX; s += CHAIN_STEP, n++) {
          CHAIN_P.copy(p0).addScaledVector(CHAIN_D, s)
          CHAIN_TWIST.setFromAxisAngle(CHAIN_D, n % 2 ? Math.PI / 2 : 0).multiply(CHAIN_Q)
          chain.setMatrixAt(n, CHAIN_M.compose(CHAIN_P, CHAIN_TWIST, CHAIN_S))
        }
        carry = (carry + Math.ceil((len - carry) / CHAIN_STEP) * CHAIN_STEP) - len
      }
      for (let i = n; i < CHAIN_MAX; i++) chain.setMatrixAt(i, CHAIN_NONE)
      chain.instanceMatrix.needsUpdate = true
    }
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
    // (the owner rinsing a plate under it (item 174): the stream stops on the plate's face, no ring on the water under it)
    let stop: number | null = null
    if (on && HAND_WASH.stream && stream.current?.parent) {
      const y = stream.current.parent.worldToLocal(STOP_AT.copy(HAND_WASH.stream)).y
      if (y > floor.y && y < tip.y - 0.002) stop = y
    }
    if (stream.current) {
      stream.current.visible = on
      if (on) {
        const from = stop ?? floor.y
        stream.current.scale.set(1 + Math.sin(t * 31) * 0.12, (tip.y - from) / len, 1 + Math.cos(t * 27) * 0.12)
        stream.current.position.y = from + (tip.y - from) / 2
      }
    }
    if (ring.current) {
      ring.current.visible = on && stop === null
      if (on) { const k = 1 + ((t * 2.4) % 1) * 1.6; ring.current.scale.set(k, k, k); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((t * 2.4) % 1)) }
      // (where the stream lands: on the water once there's any)
      ring.current.position.y = SINK.water > 0.002 ? Math.max(floor.y + 0.004, base + rise * SINK.water + 0.002) : floor.y + 0.004
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
      {/* (the sink itself: pointed at, it says how much water's in its basin and whether the plug's in) */}
      <group onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on || HOVER.paused || HAND_WASH.held) return; hov.current = 'basin'; aimTip(e); const cur = e.nativeEvent?.target as HTMLElement | null; if (cur?.style && SINK.dirty > 0) cur.style.cursor = 'pointer'; setTip({ title: '流理台', hint: basinHint() }); if (SINK.dirty > 0) guideOn() }}
        onPointerOut={(e) => { if (hov.current === 'basin') hov.current = null; const cur = e.nativeEvent?.target as HTMLElement | null; if (cur?.style && cur.style.cursor === 'pointer' && !POINTER_HINT.hand) cur.style.cursor = ''; if (!HOVER.paused) setTip(null); guideOff() }}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '流理台', hint: basinHint() }); guideOn() }}>
        <primitive object={root} />
      </group>
      <primitive object={pool} />
      {/* (the plug: pointed at it lights and says so; clicked, it's pulled out and laid by the drain, or put back in) */}
      <group ref={(g) => { WASH_GUIDE.plug = g }} onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver('塞子', plugSays()).onPointerOver(e) }}
        onPointerOut={(e) => { if (getEdit().on) return; tipOver('塞子', '').onPointerOut(e) }}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; SINK.plug = !SINK.plug; tapTurnSound(SINK.plug, 0.4); guideOff(); tipOver('塞子', plugSays()).onPointerOver(e) }}>
        <primitive object={plug} />
        {/* (a box round it a little bigger than it, unseen, to point at: it's a coin's size down in the basin (item 215)) */}
        <mesh visible={false} position={plugAt}><boxGeometry args={[0.07, 0.04, 0.07]} /></mesh>
      </group>
      <primitive object={chain} />
      {/* (the washer's door: pointed at it lights and says what the washer's doing; clicked, down or up (not while it washes)) */}
      <group onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; hov.current = 'door'; tipOver('洗碗機', doorSays()).onPointerOver(e) }}
        onPointerOut={(e) => { if (hov.current === 'door') hov.current = null; if (getEdit().on) return; tipOver('洗碗機', '').onPointerOut(e) }}
        onClick={doorClick}>
        <primitive object={door} />
      </group>
      {/* (its basket, behind the door: once the door's down, clicked, the sink's dirty plates put in it) */}
      <group onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; hov.current = 'rack'; tipOver('洗碗籃', rackSays()).onPointerOver(e) }}
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
      {/* (the tap, its handle and the rest of it: pointed at it lights and says so; clicked, the water's turned on, or off) */}
      <group ref={(g) => { WASH_GUIDE.tap = g }} onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver('水龍頭', says()).onPointerOver(e) }}
        onPointerOut={(e) => { if (getEdit().on) return; tipOver('水龍頭', '').onPointerOut(e) }}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; SINK.tap = !SINK.tap; guideOff(); tipOver('水龍頭', says()).onPointerOver(e) }}>
        <primitive object={handle} />
        <primitive object={faucet} />
        {/* (a box round its handle, unseen, a little bigger, to point at (item 215: in the sink's view the tap's a thin rod, and the owner
            couldn't find where to click it; lit as the next step, it shows itself)) */}
        <mesh visible={false} position={tapBox.at}><boxGeometry args={tapBox.size} /></mesh>
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
/** the sink as washing up by hand sees it (game/handWash) */
/** where the tap's stream stops on a plate held under it (the owner's washing, or the player's own: item 224) */
const STOP_AT = new THREE.Vector3()
const handSink = () => ({ dirty: SINK.dirty, drain: DRAIN, plug: SINK.plug, water: SINK.water, soap: SINK.soap, sponge: SINK.sponge, tap: SINK.tap })
/** what lights up as the next thing to click to wash up by hand (item 215): the plug, the tap, the washing-up liquid, the sponge, the
 * draining basket (each set as it's drawn); lit while the dirty plates or the basin are pointed at, put out as the pointer leaves */
export const WASH_GUIDE: Record<'plug' | 'tap' | 'soap' | 'sponge' | 'basket', THREE.Object3D | null> = { plug: null, tap: null, soap: null, sponge: null, basket: null }
let guideLit: THREE.Object3D | null = null
export function guideOn() {
  const want = GUIDE_OF[handStep(handSink())]
  const o = want ? WASH_GUIDE[want] : null
  if (o === guideLit) return
  guideOff()
  if (o) { glowOn(o); guideLit = o }
}
export function guideOff() {
  if (guideLit) glowOff(guideLit)
  guideLit = null
}
/** what the basin says pointed at: its water and plug, then the next step of washing up by hand (item 103), how many plates are waiting */
export const basinHint = () => {
  const st = handStep(handSink())
  // (the owner at it: say so, not the next step)
  if (HAND_WASH.boss) return `${basinSays(SINK.water, SINK.plug)}｜老闆在洗（髒盤 ${SINK.dirty}）`
  if (HAND_WASH.ask === 'wash') return `${basinSays(SINK.water, SINK.plug)}｜老闆忙完就來洗（髒盤 ${SINK.dirty}）`
  // (and, ready to wash, the player's choices said as advice (item 217): the liquid, the plug)
  const tips = st === 'scrub' ? washTips(handSink()) : []
  return `${basinSays(SINK.water, SINK.plug)}｜${st === 'none' ? handWashSays(SINK.dirty, DRAIN) : `${HAND_STEP_SAYS[st]}（髒盤 ${SINK.dirty}）`}${tips.map((t) => `｜${t}`).join('')}`
}
/** how far a bin's lid lifts (rad); how far it stands open with the bin heaped over full (it won't shut on it) */
const BIN_LID_OPEN = 1.75
const BIN_LID_AJAR = 0.16
/** each bin's own parts (item 208): its lid on its hinge, its bag and what's in it (raised as it fills, taken out with the bag), and the bags
 * carried out and the new one brought back (copies for the stock keeper's hands, GuestBar3D: hidden here) */
const BIN_OWN = new Set(['SinkBinLid', 'SinkBinRecLid', 'SinkBinLiner', 'SinkBinRecLiner', 'SinkBinHeap', 'SinkBinRecHeap', 'SinkBinBag', 'SinkBinRecBag', 'SinkBinNewBag'])
/** the bags tied up and carried out of the bins, and the new one brought back folded (item 208): each a copy of the model's own, dressed as
 * the sink is, its knot (its origin) at the hands, for the stock keeper to carry */
export function useBinBags() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    const one = (name: string) => {
      const src = gltf.scene.getObjectByName(name)
      const o = src ? src.clone(true) : new THREE.Group()
      o.position.set(0, 0, 0)
      o.rotation.set(0, 0, 0)
      o.visible = false
      dressSink(o)
      return o
    }
    return { rubbish: one('SinkBinBag'), recycle: one('SinkBinRecBag'), fresh: one('SinkBinNewBag') }
  }, [gltf])
}
/** what a bin says pointed at: how full each is and with what, whose bag is out (item 208) */
const pctOf = (k: number) => Math.min(100, Math.round(k * 100))
function binSays() {
  const b = SINK_BIN.b
  const r = b.rubbish <= 0 ? '一般垃圾：空的' : b.rubbish >= EMPTY_AT ? `一般垃圾滿了 ${pctOf(b.rubbish)}%，等倉儲來倒` : `一般垃圾 ${pctOf(b.rubbish)}%（竹籤、魚骨、衛生紙）`
  const c = b.recycle <= 0 ? '資源回收：空的' : b.recycle >= EMPTY_AT ? `資源回收滿了 ${pctOf(b.recycle)}%，等倉儲來倒` : `資源回收 ${pctOf(b.recycle)}%（空罐 ${b.cans}、空瓶 ${b.bottles}）`
  const out = SINK_BIN.out === 'rubbish' ? '｜倉儲正在倒一般垃圾' : SINK_BIN.out === 'recycle' ? '｜倉儲正在倒資源回收' : ''
  return `${r}｜${c}${out}｜${SINK_BIN.lids.rubbish.open || SINK_BIN.lids.recycle.open ? '點一下蓋上' : '點一下掀開蓋子'}`
}
/** the sponge taken up: lifted off its dish this far */
const SPONGE_UP = 0.05
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
    // (the bins' lids left whole, each on its hinge, to be lifted (items 136, 208); their bags and what's in them their own, to be raised as
    // they fill and taken out; the bags for carrying hidden (item 208))
    mergeByMaterial(r, (o) => BIN_OWN.has(o.name))
    for (const nm of ['SinkBinBag', 'SinkBinRecBag', 'SinkBinNewBag']) { const o = r.getObjectByName(nm); if (o) o.visible = false }
    return r
  }, [gltf, node])
  // (a box a little bigger than it, in its own frame, to point at (item 215): the washing-up liquid and the sponge are small)
  const hit = useMemo(() => {
    obj.updateMatrixWorld(true)
    const b = new THREE.Box3().setFromObject(obj)
    return { at: b.getCenter(new THREE.Vector3()), size: b.getSize(new THREE.Vector3()).addScalar(0.04).toArray() as [number, number, number] }
  }, [obj])
  // (each bin's lid: lifted while it's asked open, for a moment as something's thrown in, or held up by the stock keeper at it; standing a
  // little open on a bin heaped over full; eased up and back down. Its bag and what's in it: what's in it raised from the bin's floor toward
  // its mouth as it fills, none of it there while its bag's out (item 208))
  const bins = useMemo(() => {
    if (node !== 'SinkBinSet') return null
    const get = (n: string) => obj.getObjectByName(n) ?? null
    const floor = get('SinkBinFloor'), top = get('SinkBinTop')
    const one = (lid: string, liner: string, heap: string) => {
      const h = get(heap)
      return { lid: get(lid), liner: get(liner), heap: h, y0: h?.position.y ?? 0, k: 0 }
    }
    // (from its floor to a few centimetres under its mouth, the heap's crown just under the lid with it full)
    const span = floor && top ? Math.max(0, top.position.y - 0.03 - floor.position.y) : 0.4
    return { span, rubbish: one('SinkBinLid', 'SinkBinLiner', 'SinkBinHeap'), recycle: one('SinkBinRecLid', 'SinkBinRecLiner', 'SinkBinRecHeap') }
  }, [obj, node])
  useFrame((_, dt) => {
    if (!bins) return
    const now = performance.now()
    for (const kind of ['rubbish', 'recycle'] as const) {
      const b = bins[kind], L = SINK_BIN.lids[kind], fill = SINK_BIN.b[kind], out = SINK_BIN.out === kind
      const want = L.open || now < L.until ? 1 : fill > 1 ? BIN_LID_AJAR / BIN_LID_OPEN : 0
      b.k += (want - b.k) * Math.min(1, dt * 7)
      if (b.lid) b.lid.rotation.x = -BIN_LID_OPEN * b.k * b.k * (3 - 2 * b.k)
      if (b.liner) b.liner.visible = !out
      if (b.heap) {
        b.heap.visible = !out && fill > 0.01
        b.heap.position.y = b.y0 + Math.min(1.08, fill) * bins.span
      }
    }
  })
  // (the draining basket says how many plates stand in it and whether they're dry (the owner's: every plate counted))
  const name = SINK_SETS.find((s) => s.node === node)?.label ?? ''
  // (the sponge, taken up to wash with (item 103): lifted off its dish while it's held)
  const lift = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!lift.current) return
    lift.current.position.y += ((node === 'SinkSpongeSet' && SINK.sponge ? SPONGE_UP : 0) - lift.current.position.y) * 0.25
    // (taken up by the owner to wash with (item 174): his hand has it, drawn there)
    lift.current.visible = !(node === 'SinkSpongeSet' && HAND_WASH.spongeHeld)
  })
  // (the washing-up liquid squeezed into the water, the sponge taken up or put down: steps of washing up by hand (item 103), clicked)
  if (node === 'SinkDetergentSet' || node === 'SinkSpongeSet') return (
    <group ref={(g) => { lift.current = g; WASH_GUIDE[node === 'SinkDetergentSet' ? 'soap' : 'sponge'] = g }} onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver(name, partSays(node)).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver(name, '').onPointerOut(e) }}
      onClick={(e) => {
        e.stopPropagation(); if (getEdit().on) return
        // (out of the bottle in use, a new one opened from stock as it runs out: none at all, nothing comes (item 203))
        if (node === 'SinkDetergentSet') { if (squeezeSoap()) { SINK.soap = pumpSoap(SINK.soap); tapTurnSound(true, 0.25) } } else SINK.sponge = !SINK.sponge
        guideOff()
        window.setTimeout(() => setTip({ title: name, hint: partSays(node) }), 60)
      }}>
      <primitive object={obj} />
      {/* (a box a little bigger than it, unseen, to point at (item 215)) */}
      <mesh visible={false} position={hit.at}><boxGeometry args={hit.size} /></mesh>
    </group>
  )
  if (node === 'SinkBinSet') return (
    // (the bins: pointed at, what's in them; clicked, the lid of the one clicked lifted or shut (items 136, 208))
    <group onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver(name, partSays(node)).onPointerOver(e) }}
      onPointerOut={(e) => { tipOver(name, '').onPointerOut(e) }}
      onClick={(e) => {
        e.stopPropagation(); if (getEdit().on) return
        // (which of the two: the nearer of their mouths to where it was clicked)
        const a = obj.getObjectByName('SinkBinTop'), b = obj.getObjectByName('SinkBinRecTop')
        const kind = a && b && e.point.distanceTo(b.getWorldPosition(new THREE.Vector3())) < e.point.distanceTo(a.getWorldPosition(new THREE.Vector3())) ? 'recycle' : 'rubbish'
        const L = SINK_BIN.lids[kind]
        L.open = !L.open
        tapTurnSound(L.open, 0.3)
        window.setTimeout(() => setTip({ title: name, hint: partSays(node) }), 60)
      }}>
      <primitive object={obj} />
    </group>
  )
  if (node !== 'SinkBasketSet') return (
    // (the rest name themselves pointed at (the owner's, 2026-11-11: every one of them), the bin with how many sticks are in it)
    <group onPointerOver={(e) => { e.stopPropagation(); if (HOVER.paused) return; aimTip(e); setTip({ title: name, hint: partSays(node) }) }}
      onPointerOut={() => { if (!HOVER.paused) setTip(null) }}
      // (a click is theirs, to do nothing with but say what they are: it went on through the soap or the brush to the basin behind, and
      // washed a plate (the owner, 2026-11-15, item 166: "why does clicking the soap and the brush clean the plates?"))
      onClick={(e) => { if (getEdit().on) return; e.stopPropagation(); setTip({ title: name, hint: partSays(node) }) }}>
      <primitive object={obj} />
    </group>
  )
  return (
    // (clickable now (the player takes its dry plates back to the racks): the pointing hand and its glow, as everything that can be clicked)
    <group ref={(g) => { WASH_GUIDE.basket = g }} onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver('瀝水籃', drainSays(DRAIN)).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver('瀝水籃', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; HAND_WASH.ask = 'take'; window.setTimeout(() => setTip({ title: '瀝水籃', hint: drainSays(DRAIN) }), 80) }}>
      <primitive object={obj} />
    </group>
  )
}
/** what each of the rest of what stands on the sink says pointed at */
function partSays(node: string) {
  switch (node) {
    case 'SinkScrubSet': return '棕櫚刷，刷鍋子和烤網'
    case 'SinkSoapSet': return '洗手用的肥皂'
    case 'SinkTowelSet': return '擦乾碗盤的布巾'
    // (each its own short line: run together it broke onto two)
    case 'SinkBinSet': return binSays()
    // (the name's the tip's title already: not said again at the head of its hint)
    case 'SinkDetergentSet': return IN_USE.soap <= 0 && SUPPLIES.has(DISH_SOAP) === 0 ? '用完了，庫存也沒有：到庫存的耗材訂洗碗精'
      : `點一下擠一點${SINK.water >= WASH_WET ? '到水裡' : '在菜瓜布上'}（夠洗 ${SINK.soap} 個；這瓶還能擠 ${IN_USE.soap} 次）`
    case 'SinkSpongeSet': return SINK.sponge ? '拿著了，洗盤子刷得快一倍｜點一下放回去' : '黃的那面軟，綠的那面刷｜點一下拿起來，洗盤子刷得快'
    default: return ''
  }
}
useGLTF.preload(URL)
