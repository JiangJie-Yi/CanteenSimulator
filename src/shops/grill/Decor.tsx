// What stands about the grill besides the dishes: a crate of binchotan (a stick dragged from it onto the fire adds
// charcoal), a paper fan by the seasonings (waved over the fire, it fans the coals up), and a paper floor lantern (行燈)
// glowing behind the stones, which can be moved about like the dishes. Roasting does the carrying (see held); what's dragged across the table is pushed clear of
// them like anything else (DECOR is their footprint, for its settle()).
import { NO_RAY } from '@/scene/pickable'
import { getLights } from '@/scene/lightsStore'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { countedBatch, homeCopy, plainColours, StaticBatch, mergeByMaterial } from '@/scene/StaticBatch'
import { DRY_STORE, parOf, unitsShown } from '@/game/pantry'
import { NORI, supplyName } from '@/game/supplies'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { DISHES } from '@/data/menu'
import { storageOf } from '@/data/storage'
import { ONIGIRI_TRAY, OWNER_GRILL, RICE, SOUP, SAKE, SAKE_TASTED, tasteSake, ALONG, askPantry, shutPantry, COOK_NOTCH, FIRE_SHIFT, GRILL_OFFSET, KITCHEN_DROP, LAY, handOver, nameOver, SUPPLIES, anyInStock, batchOf, DRINK_BACK } from './bar'
import { ironSkewer } from './skewerShape'
import { FREEZER_DEFAULT, FREEZER_MAX, FREEZER_MIN, driftTemp, stepTemp } from '@/game/freezer'
import { setTip } from '@/scene/hoverTip'
import { Movable } from './Movable'
import { COOK_S, RICE_FULL, riceGoes, setOn } from '@/game/rice'
import { HEAT_S, heatNow, nextHeat, setSoup, soupGoes, SOUP_BOWLS } from '@/game/soup'
import { LowPlateRack, PlateRack } from './PlateRack'
import { SINK_SETS, STEP_STOOL_AT, SinkModel, SinkPart, StepStoolModel } from './Sink'
import { CharcoalSack, ProduceSacks, VegBasket, type VegNode } from './KitchenStores'
import { coolerDoorSound, lightSwitchSound } from './restroomSound'
import { getEdit } from './edit'
import { useBinchotan } from './binchotanModel'
import { inkModel } from '@/scene/inkHull'
import { warmLater } from '@/scene/Prewarm'
import { reflectStudio, useStudio } from '@/scene/studio'
import { bottleFrom, goOf, pour, poursLeft, SAKE_BOTTLE_ML, SAKE_SIDE } from '@/game/sakeStand'
import { canTaste, SAKE_NOTES, sideChance } from '@/game/sakeTasting'
import { SHOP } from '@/game/shopState'
import { Tokkuri, TOKKURI_H } from './Tokkuri'
import { AnchoredLight } from '@/scene/AnchoredLight'

type Spot = { at: [number, number]; r: number }
/** where each one stands (x, z) and how much room it takes */
export const DECOR = {
  crate: { at: [0.62, -2.0], r: 0.38 },
  // (lying at the table's back, left of the knives: the front middle is the notch cut in under the hearth, its right the tasting bowl)
  fan: { at: [-1.79, -0.68], r: 0.3 },
  // (drawn 1.8 times its own size, at the table's back, left of the middle, well in from the bar's lip (its corner, where it stood, had it
  // into the lip), clear of the hearth's frame and the crate; what's drawn is this and the edit's own offset for it (edit.ts BASES))
  // (moved 0.45 to the left along the table, as the owner drew: out of the hearth's corner)
  lantern: { at: [-1.612, -0.937], r: 0.34 },
  // (the cooked rice the rice balls are made from: a shop's big tub, on a side table of its own just past the cook's
  // table's right-hand end, by the other cooks)
  // (moved up toward the back and in toward the table, by its back corner, as the owner drew: the miso soup's pot where it stood)
  // (on the warming counter now, its first well (WARMER, below): along 5.2, lay 2.42, at the end toward the cook table)
  // (out of use (the owner's, 2026-11-11: the rice is taken from the cooker): put by on the floor past the kitchen, by the rice sacks, clear of
  // the way to the open one, along 6.45, lay 5.45)
  rice: { at: [8.440, 0.609], r: 1.1 },
} satisfies Record<string, Spot>

/** which way the warming counter and what's on it face: their fronts to the kitchen, back from its open end (toward minus ALONG) */
const WARMER_FACE = Math.atan2(-ALONG.x, -ALONG.z)

/** what's being carried from here: a stick of charcoal or the fan, where it is (Roasting sets it), and how far the
 * fan has been waved (it swings with it) */
export type Held = { kind: 'charcoal' | 'fan' | 'skewer'; at: THREE.Vector3; wave: number } | null

const INK = '#3b2a20'

/** a mesh with the shop's ink outline: the same shape again, a little bigger, drawn inside out */
function Inked({ geometry, color, map, grow = 1.04, sideOnly = false, position, rotation, children }: {
  geometry: THREE.BufferGeometry; color?: string; map?: THREE.Texture | null; grow?: number
  /** the outline grows round the sides only, along the y axis not at all (for a hollow tube, whose ends must stay open) */
  sideOnly?: boolean
  position?: [number, number, number]; rotation?: [number, number, number]; children?: ReactNode
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color={color ?? '#ffffff'} map={map ?? null} />
      </mesh>
      <mesh geometry={geometry} scale={sideOnly ? [grow, 1, grow] : grow}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {children}
    </group>
  )
}

// (painted again once the sign font has loaded: signFont)
const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => signTexture(w, h, (g) => draw(g))

/** the washi label pasted on the crate: 紀州備長炭 brushed in black, a red seal */
const CRATE_LABEL = canvas(128, 256, (g) => {
  g.fillStyle = '#efe6d2'
  g.fillRect(0, 0, 128, 256)
  ;['紀', '州', '備', '長', '炭'].forEach((ch, i) => brushText(g, ch, 64, 50 + i * 44, 44, { fill: '#1d1a18', shadow: 'rgba(120,90,50,0.25)' }))
  g.fillStyle = '#b8322a'
  g.fillRect(84, 214, 26, 26)
})

/** the fan's washi: a red sun over blue waves, on cream */
const FAN_PAPER = canvas(256, 256, (g) => {
  g.fillStyle = '#f3ead6'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#c8402e'
  g.beginPath()
  g.arc(150, 96, 46, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#2f5d8a'
  g.lineWidth = 7
  for (let row = 0; row < 4; row++) {
    for (let x = -32; x < 300; x += 52) {
      g.beginPath()
      g.arc(x + (row % 2) * 26, 170 + row * 24, 24, Math.PI, 0)
      g.stroke()
    }
  }
  // the bamboo ribs fanning out from the handle, showing through the paper
  g.strokeStyle = 'rgba(120,90,50,0.25)'
  g.lineWidth = 2
  for (let k = 0; k < 24; k++) {
    const a = (k / 23) * Math.PI
    g.beginPath()
    g.moveTo(128, 256)
    g.lineTo(128 - Math.cos(a) * 200, 256 - Math.sin(a) * 260)
    g.stroke()
  }
})

/** the fan's other side (the owner's: a fan has two sides; from behind it was a dark disc, its outline's back): the same paper, its bamboo ribs
 * plainer through it, the shop's mark (聞 in a red round seal) and a band of indigo waves along its foot */
const FAN_BACK = canvas(256, 256, (g) => {
  g.fillStyle = '#f1e7d2'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(120,90,50,0.38)'
  g.lineWidth = 2.4
  for (let k = 0; k < 24; k++) {
    const a = (k / 23) * Math.PI
    g.beginPath()
    g.moveTo(128, 256)
    g.lineTo(128 - Math.cos(a) * 200, 256 - Math.sin(a) * 260)
    g.stroke()
  }
  g.strokeStyle = '#2f5d8a'
  g.lineWidth = 5
  for (let x = -20; x < 290; x += 40) { g.beginPath(); g.arc(x, 212, 20, Math.PI, 0); g.stroke() }
  g.fillStyle = '#c8402e'
  g.beginPath(); g.arc(128, 104, 44, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#f1e7d2'; g.lineWidth = 3
  g.beginPath(); g.arc(128, 104, 37, 0, Math.PI * 2); g.stroke()
  brushText(g, '聞', 128, 106, 50, { fill: '#f6efe2' })
})

/** water-hyacinth plaiting: pale straw bands, each a row of slanted strands that flips direction from cell to cell */
const BASKET_WEAVE = canvas(256, 128, (g) => {
  g.fillStyle = '#c9a366'
  g.fillRect(0, 0, 256, 128)
  const rows = 8, cell = 16, h = 128 / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 256 / cell; c++) {
      const x = c * cell, y = r * h, flip = (c + r) % 2
      g.fillStyle = flip ? '#d8b878' : '#bf9658'
      g.fillRect(x + 0.5, y + 0.5, cell - 1, h - 1)
      g.strokeStyle = 'rgba(120,85,40,0.55)'
      g.lineWidth = 1.2
      for (let k = 1; k < 4; k++) {
        g.beginPath()
        if (flip) { g.moveTo(x + k * 4, y + 1); g.lineTo(x + k * 4 - 3, y + h - 1) } else { g.moveTo(x + k * 4 - 3, y + 1); g.lineTo(x + k * 4, y + h - 1) }
        g.stroke()
      }
    }
    g.fillStyle = 'rgba(90,60,30,0.5)'
    g.fillRect(0, r * h, 256, 1.5)
  }
})

/** the crate's sticks: how many are in it (36 packed; each one dragged to the fire is one fewer; the last gone, it's filled again from the
 * sack of binchotan on the floor by the table, as much as the sack has: with none left in the sack, it stays empty till some's bought) */
export const CRATE_FULL = 36
/** `tended`: the third cook keeps it filled while the shop's open (he carries an armful from the sack on the floor when it runs low:
 * GuestBar3D), so it isn't topped up of itself then */
export const CRATE = { left: CRATE_FULL, tended: false }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __crate: CRATE })
/** a stick taken up out of the crate in the hand: gone from it at once (item 109, the owner's, 2026-11-14: "picked up, there should be one
 * fewer"; it went only once it was on the fire), its gap there while it's carried */
/** the foods the freezer holds (data/storage's frozen ones on the menu): its contents drawn only while there's one of them (item 182) */
const FROZEN_FOODS = DISHES.flatMap((d) => d.items.map((x) => x.id)).filter((id) => storageOf(id) === 'frozen')
export function liftFromCrate() {
  CRATE.left = Math.max(0, CRATE.left - 1)
}
/** the stick carried put on the fire: the crate, emptied by it, filled again from the sack */
export function takeFromCrate() {
  if (CRATE.left <= 0) CRATE.left = SUPPLIES.refillCrate(CRATE_FULL)
}
/** the stick carried let go anywhere but the fire (or the heap full): back into the crate */
export function backToCrate() {
  CRATE.left = Math.min(CRATE_FULL, CRATE.left + 1)
}

/** A square plaited basket of white binchotan stood on end, packed full, its tag on the front. Only the sticks are taken hold of (pointed at,
 * dragged to the fire), not the basket; each one taken leaves a gap, taken from the front rows back. */
function Crate() {
  const W = 0.4, D = 0.4, H = 0.16, T = 0.02
  const geo = useMemo(() => ({
    side: new THREE.BoxGeometry(W, H, T),
    end: new THREE.BoxGeometry(T, H, D - 2 * T),
    floor: new THREE.BoxGeometry(W - 2 * T, T, D - 2 * T),
    rimSide: new THREE.BoxGeometry(W + 0.02, 0.03, 0.035),
    rimEnd: new THREE.BoxGeometry(0.035, 0.03, D - 0.05),
    label: new THREE.PlaneGeometry(0.075, 0.12),
  }), [])
  // (the sticks all about one length, a hand's breadth long: only a step or two between the shortest and the longest)
  const bin = useBinchotan()
  const stickGeos = useMemo(() => [0.26, 0.28, 0.3].flatMap((len) => [0, 1, 2, 3, 4, 5].map((k) => ({ geo: bin.stick(len, 0.026, k), len }))), [bin])
  // the sticks packed in a grid, each stood a little off true and turned about its own axis
  const sticks = useMemo(() => {
    const out: { p: [number, number, number]; r: [number, number, number]; g: number }[] = []
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    // (packed so that none, however it leans, reaches the basket's walls: the outer row's middle kept a stick's radius, its lean at the top and
    // a margin in from the inside of the wall; each stood on the floor, never sunk through it)
    const N = 6, R = 0.026, LEAN = 0.05, JIT = 0.003
    const inner = W / 2 - T
    const reach = inner - R - (LEAN / 2) * 0.15 - JIT - 0.004
    const step = (2 * reach) / (N - 1)
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < N; k++) {
        const g = Math.floor(rnd() * stickGeos.length)
        const len = stickGeos[g].len
        out.push({
          p: [(i - (N - 1) / 2) * step + (rnd() - 0.5) * 2 * JIT, T + len / 2 + rnd() * 0.012, (k - (N - 1) / 2) * step + (rnd() - 0.5) * 2 * JIT],
          r: [(rnd() - 0.5) * LEAN, rnd() * 6, (rnd() - 0.5) * LEAN], g,
        })
      }
    }
    return out
  }, [stickGeos])
  const weave = BASKET_WEAVE
  // (as many shown as are left in it: the last ones in the list (the front rows) go first; the basket and its sticks drawn as one batch
  // each, the sticks' made again only when one's taken)
  const [left, setLeft] = useState(CRATE.left)
  const lastLook = useRef(0)
  useFrame((st) => {
    // (empty, it's filled again as soon as there's charcoal in the sack: looked at now and then)
    if (CRATE.left <= 0 && !CRATE.tended && st.clock.elapsedTime - lastLook.current > 1) {
      lastLook.current = st.clock.elapsedTime
      if (SUPPLIES.coal() > 0) CRATE.left = SUPPLIES.refillCrate(CRATE_FULL)
    }
    if (CRATE.left !== left) setLeft(CRATE.left)
  })
  return (
    <group position={[DECOR.crate.at[0], 0, DECOR.crate.at[1]]} rotation-y={-0.35} name="coal-crate">
      <StaticBatch plain>
      <Inked geometry={geo.side} map={weave} position={[0, H / 2, D / 2 - T / 2]}>
        {/* the tag faces out of the front */}
        <mesh geometry={geo.label} position={[0.09, 0, T / 2 + 0.002]}>
          <meshToonMaterial map={CRATE_LABEL} />
        </mesh>
      </Inked>
      <Inked geometry={geo.side} map={weave} position={[0, H / 2, -D / 2 + T / 2]} />
      <Inked geometry={geo.end} map={weave} position={[W / 2 - T / 2, H / 2, 0]} />
      <Inked geometry={geo.end} map={weave} position={[-W / 2 + T / 2, H / 2, 0]} />
      {/* the rim, a thicker rolled edge of darker straw */}
      <Inked geometry={geo.rimSide} color="#a47b42" position={[0, H, D / 2 - 0.01]} />
      <Inked geometry={geo.rimSide} color="#a47b42" position={[0, H, -D / 2 + 0.01]} />
      <Inked geometry={geo.rimEnd} color="#a47b42" position={[W / 2 - 0.01, H, 0]} />
      <Inked geometry={geo.rimEnd} color="#a47b42" position={[-W / 2 + 0.01, H, 0]} />
      <mesh geometry={geo.floor} position={[0, T / 2, 0]} receiveShadow>
        <meshToonMaterial map={weave} />
      </mesh>
      </StaticBatch>
      <group userData={{ decor: 'charcoal' }}>
        {/* (what the pointer finds: the sticks' block, unseen; the sticks themselves are merged and take no pointing) */}
        <mesh position={[0, T + 0.15, 0]} visible={false}><boxGeometry args={[W - 2 * T, 0.3, D - 2 * T]} /></mesh>
        <StaticBatch key={left}>
          {sticks.slice(0, left).map((s, i) => (
            <Inked key={i} geometry={stickGeos[s.g].geo} map={bin.face ?? undefined} grow={1.07} sideOnly position={s.p} rotation={s.r} />
          ))}
        </StaticBatch>
      </group>
    </group>
  )
}

/** A round paper fan (団扇) lying by the seasoning boxes; picked up, it's held upright and swings as it's waved. */
/** the fan stood in its holder (団扇立て, on the seasonings' ledge's left end; the owner's: hung from a hook on a post, it looked odd): handle
 * down, its paper toward the cook (turned up off the table the other way, and round half a turn to face along the table's lay again) */
const FAN_HUNG = new THREE.Euler(Math.PI / 2, Math.atan2(-LAY.x, -LAY.z) + Math.PI, 0, 'YXZ')
/** how far above its holder's mouth the stood fan's middle is (the world's units): its handle (0.47 below its middle) 7 cm down in it */
const FAN_ABOVE_MOUTH = 0.4
/** scratch for the holder's mouth */
const MOUTH = new THREE.Vector3()
function Fan({ held, at }: { held: RefObject<Held>; at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  // (its holder, on the seasonings' ledge: it stands in the holder wherever the holder is, so it's never left in the air when the ledge, or
  // the fan, has been moved by hand in edit mode; the holder's mouth the middle of its top ring)
  const scene = useThree((st) => st.scene)
  const hook = useRef<{ mesh: THREE.Mesh; ring: number[] } | null>(null)
  const peg = useMemo(() => new THREE.Vector3(), [])
  const swing = useRef(0)
  const last = useRef(0)
  const beat = useRef(0)
  const phase = useRef(0)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    const h = held.current
    if (h?.kind === 'fan') {
      o.visible = true
      o.position.copy(h.at)
      swing.current += (Math.sin(h.wave * 6) * 0.55 - swing.current) * Math.min(1, dt * 14)
      // (the wrist's flick: the fan beats back and forth, harder the faster it's being waved, and settles when it's held still)
      const speed = Math.min(1, Math.abs(h.wave - last.current) / Math.max(dt, 1e-3) / 2.5)
      last.current = h.wave
      beat.current += (speed - beat.current) * Math.min(1, dt * 8)
      phase.current += dt * 22
      // face to the camera's side, handle down, rocking side to side as it fans
      o.rotation.set(1.45 + Math.sin(phase.current) * 0.35 * beat.current, -0.6, swing.current, 'XYZ')
    } else {
      // (back in its holder; not there while the owner has it in his hand, fanning (Boss, item 203))
      o.visible = !OWNER_GRILL.fanning
      let k = hook.current
      if (!k || !k.mesh.parent) {
        const mesh = scene.getObjectByName('FanHolder') as THREE.Mesh | undefined
        k = null
        if (mesh?.isMesh) {
          // (its mouth's ring: the vertices highest up it, in the world; their middle is the mouth)
          const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
          mesh.updateWorldMatrix(true, false)
          const ys = Array.from({ length: pos.count }, (_, i) => MOUTH.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y)
          const top = Math.max(...ys)
          k = { mesh, ring: ys.flatMap((y, i) => (y > top - 1e-3 ? [i] : [])) }
        }
        hook.current = k
      }
      if (k && o.parent) {
        // (the ring's middle in the world: the mouth, wherever the ledge has been moved)
        const pos = k.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
        k.mesh.updateWorldMatrix(true, false)
        peg.set(0, 0, 0)
        for (const i of k.ring) peg.add(MOUTH.fromBufferAttribute(pos, i).applyMatrix4(k.mesh.matrixWorld))
        peg.divideScalar(Math.max(1, k.ring.length))
        peg.y += FAN_ABOVE_MOUTH
        o.position.copy(o.parent.worldToLocal(peg))
      } else o.position.set(at[0], at[1], at[2])
      o.rotation.copy(FAN_HUNG)
    }
  })
  const geo = useMemo(() => {
    const face = new THREE.CircleGeometry(0.15, 40)
    face.rotateX(-Math.PI / 2)
    face.scale(1, 1, 0.92)
    // (its back: the same shape turned half round about the handle's line, so it faces the other way with its picture the right way round
    // from that side, the handle's end of it still at the handle (mirrored, its triangles turned inside out and it was never drawn))
    const back = face.clone().rotateZ(Math.PI)
    return {
      face,
      back,
      handle: new THREE.CylinderGeometry(0.011, 0.013, 0.17, 8).rotateX(Math.PI / 2),
      rim: new THREE.TorusGeometry(0.15, 0.006, 6, 48).rotateX(Math.PI / 2).scale(1, 1, 0.92),
      // (its outline: a fine dark ring round the rim, seen from either side; a disc's back faces pushed out, as other things are inked,
      // was a dark disc over its whole back)
      ink: new THREE.TorusGeometry(0.1535, 0.0042, 5, 48).rotateX(Math.PI / 2).scale(1, 1, 0.92),
    }
  }, [])
  useEffect(() => () => { for (const x of Object.values(geo)) x.dispose() }, [geo])
  return (
    // (a proper size for fanning a charcoal fire: about a hand and a half across)
    <group ref={g} userData={{ decor: 'fan' }} scale={1.6}>
      <mesh geometry={geo.face} position={[0, 0.0048, 0]} castShadow receiveShadow><meshToonMaterial color="#ffffff" map={FAN_PAPER} /></mesh>
      <mesh geometry={geo.back} position={[0, 0.0032, 0]} receiveShadow><meshToonMaterial color="#ffffff" map={FAN_BACK} /></mesh>
      <mesh geometry={geo.rim} position={[0, 0.004, 0]}>
        <meshToonMaterial color="#9a7444" />
      </mesh>
      <mesh geometry={geo.ink} position={[0, 0.004, 0]}><meshBasicMaterial color={INK} /></mesh>
      <Inked geometry={geo.handle} color="#b08a55" grow={1.12} position={[0, 0.012, 0.21]} />
    </group>
  )
}


/** a soft round glow, bright in the middle and fading to nothing, for the light round the lantern */
const GLOW = canvas(128, 128, (g) => {
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,200,120,0.9)')
  grad.addColorStop(0.25, 'rgba(255,170,80,0.45)')
  grad.addColorStop(0.6, 'rgba(255,140,50,0.12)')
  grad.addColorStop(1, 'rgba(255,120,40,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
})

/**
 * A floor lantern (行燈): a square wooden frame on four legs, washi panels lit from inside by a flame — the paper
 * brightens and dims a little as it flickers, a warm halo hangs round it, and (on a strong GPU) it throws a little
 * flickering light on what's near. A click puts it out or lights it again; it isn't moved by hand (only in edit mode).
 */
const LANTERN_SCALE = 1.8
const ANDON_URL = import.meta.env.BASE_URL + 'models/andon.glb'
/** the kumiko's tint lit (its own pale wood, warm against the glowing paper) and out (the frame's dark brown) */
const KUMIKO_LIT = new THREE.Color('#ffffff')
const KUMIKO_OUT = new THREE.Color('#5a3a26')
useGLTF.preload(ANDON_URL)
function Lantern({ at }: { at: [number, number, number] }) {
  const paper = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.Sprite>(null)
  const flame = useRef<THREE.Sprite>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const [lit, setLit] = useState(true)
  const glow = useRef(1)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // (lit or put out, the flame coming up or dying down over a moment)
    glow.current += ((lit ? 1 : 0) - glow.current) * Math.min(1, dt * 5)
    const k = glow.current
    // a flame's flicker: a slow breath and a quicker shiver, never quite repeating
    const f0 = 0.88 + 0.07 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.9 + 1.3) + 0.03 * Math.sin(t * 17.1)
    const f = f0 * k
    // (out, the paper is only paper (the owner's: it went a dead cold grey, its kumiko bright orange): a warm ivory washi lit by the room
    // alone, no glow of its own, and the kumiko the frame's dark brown; lit, the paper glows and the kumiko shows warm against it)
    if (paper.current) paper.current.color.setScalar(Math.max(f, 0.55))
    const out = k < 0.45
    if (model.out !== out) {
      model.out = out
      for (const m of model.papers) m.material = out ? model.paperOff : model.paperMat
    }
    for (const w of model.kumiko) w.color.copy(KUMIKO_LIT).lerp(KUMIKO_OUT, 1 - k)
    if (halo.current) halo.current.visible = k > 0.02
    if (flame.current) flame.current.visible = k > 0.02
    if (halo.current) {
      halo.current.material.opacity = (0.55 + (f0 - 0.88) * 2.2) * k
      halo.current.scale.setScalar(0.95 + (f0 - 0.88) * 0.6)
    }
    if (flame.current) flame.current.scale.setScalar(0.22 * (0.9 + (f0 - 0.88) * 1.8) * Math.max(0.05, k))
    // (with the room's lights out it's the light the cook works by: brighter, reaching further, the more so by night)
    const night = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    const boost = getLights().on ? 1 : night ? 3.2 : 1.8
    if (lamp.current) {
      lamp.current.intensity = 0.7 * f * boost
      lamp.current.distance = boost > 1 ? 3.2 : 1.8
    }
    if (halo.current && boost > 1) halo.current.scale.multiplyScalar(1 + (boost - 1) * 0.35)
  })
  // (the lantern itself, from Blender (blender/andon.py): on its four dark legs, its shade panelled in kumiko, its washi drawn lit (unshaded, the same by day or
  // night, brightening and dimming with the flame))
  const gltf = useGLTF(ANDON_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = gltf.scene.clone(true)
    const paperMat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide })
    // (out: plain washi in the room's light, no glow; its fibres the same picture)
    const paperOff = new THREE.MeshToonMaterial({ color: '#efeadf', side: THREE.DoubleSide })
    const woodMats = new Map<THREE.Material, THREE.Material>()
    const kumiko: THREE.MeshToonMaterial[] = []
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'AndonPaper') { paperMat.map = src.map; paperOff.map = src.map; m.material = paperMat; return }
      if (!woodMats.has(src)) {
        // (the kumiko panels one card each, their pattern cut out by its alpha (item 85): both sides, tested not blended; lit with the wood)
        const card = /Cutout/.test(src.name)
        const t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, ...(card ? { alphaTest: 0.5, side: THREE.DoubleSide } : {}) })
        woodMats.set(src, t)
        if (src.name === 'AndonWood' || card) kumiko.push(t)
      }
      m.material = woodMats.get(src)!
      m.castShadow = true
    })
    // (its two hundred little parts, a mesh each, folded into one per material: a few draws, not two hundred)
    mergeByMaterial(r)
    const papers: THREE.Mesh[] = []
    r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === paperMat) papers.push(m) })
    return { r, paperMat, paperOff, papers, kumiko, out: false }
  }, [gltf])
  useLayoutEffect(() => { (paper as { current: THREE.MeshBasicMaterial | null }).current = model.paperMat }, [model])
  // (the shade's middle, as modelled: on its legs, 0.16 up to its foot, 0.36 tall)
  const MID = 0.34, K = 1
  return (
    <group position={at} rotation-y={0.4} scale={LANTERN_SCALE} userData={{ container: 'lantern' }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '行燈', hint: lit ? '點一下點燈' : '點一下熄燈' }); setLit(!lit) }}
      onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; glowOnly(e.eventObject); setTip({ title: '行燈', hint: lit ? '點一下熄燈' : '點一下點燈' }) }}
      onPointerOut={(e) => { document.body.style.cursor = ''; glowLeave(e.eventObject); setTip(null) }}>
      <primitive object={model.r} scale={K} />
      {/* the flame inside, seen through the paper */}
      {/* (a soft glow, not a solid shape: a hard cone showing through the paper cut dark wedges across it) */}
      <sprite ref={flame} position={[0, MID * K * 0.9, 0]} scale={0.22} raycast={NO_RAY}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.7} color="#ffcf80" />
      </sprite>
      {/* the glow round it, always facing the camera, laid on additively */}
      <sprite ref={halo} position={[0, MID * K, 0]} scale={0.95} raycast={NO_RAY}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
      </sprite>
      {QUALITY.tier === 'high' && <AnchoredLight light={lamp} position={[0, MID * K, 0]} color="#ffb060" intensity={0.7} distance={1.8} decay={2} />}
    </group>
  )
}

/** the stick of binchotan being carried from the crate to the fire */
function HeldStick({ held }: { held: RefObject<Held> }) {
  const g = useRef<THREE.Group>(null)
  const bin = useBinchotan()
  const geo = useMemo(() => bin.stick(0.28, 0.045, 1), [bin])
  useFrame(() => {
    const o = g.current
    if (!o) return
    const h = held.current
    o.visible = h?.kind === 'charcoal'
    if (o.visible) o.position.copy(h!.at)
  })
  return (
    <group ref={g} visible={false} rotation={[0.3, 0.4, Math.PI / 2]}>
      <Inked geometry={geo} map={bin.face ?? undefined} grow={1.07} sideOnly />
    </group>
  )
}

/** a clean iron skewer taken from its holder while researching, carried over the board to be pushed through what's there (the owner's): a
 * steel rod lying level in the hand, the way the board's skewers lie */
/** (the skewer in hand: the one iron skewer (skewerShape), its middle at its origin) */
const HELD_ROD = (() => {
  const g = ironSkewer(0.73, 0.009, 0.004, 0.08, 0.03)
  g.translate(0, -0.395, 0)
  return g
})()
const HELD_ROD_MAT = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.85, roughness: 0.35 })
function HeldRod({ held }: { held: RefObject<Held> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const h = held.current
    o.visible = h?.kind === 'skewer'
    if (o.visible) o.position.copy(h!.at)
  })
  return (
    <group ref={g} visible={false} rotation={[0, Math.atan2(0.59, 0.81), Math.PI / 2]}>
      <mesh geometry={HELD_ROD} material={HELD_ROD_MAT} />
    </group>
  )
}

/** (the lantern can be moved about the table like a dish: Roasting says where it is) */
/**
 * The rice the rice balls are shaped from (おひつ): a round tub of pale sawara bound with copper hoops, heaped with
 * steaming white rice, the wooden paddle (しゃもじ) stood in it, its lid leant against its side.
 */
/** the tub as drawn below, made this much bigger (a shop's おひつ, wider than two plates, and deep) */
// (0.8 of the 2.0 it was on its own stand: in a row on the warming counter with the rest)
const RICE_SCALE = 1.6
/** the dining room's floor, past the kitchen's raised floor (where the tub and the old rice pot are put by) */
const ROOM_FLOOR = -1.16
/** the working counters' tops (the warming counter's and the rice-ball counter's: the sink's height, blender/warmer.py's H) */
const COUNTER_TOP = 0.236
/**
 * The rice the rice balls are shaped from (おひつ): a big round tub of pale sawara bound with copper hoops, heaped with
 * steaming white rice, the wooden paddle (しゃもじ) stood in it, on the warming counter (Warmer: it stood on a stand of its own), and its lid (the rice
 * bowls are kept in the dish cabinet with the rest).
 */
/** the rice tub's model (blender/ricetub.py) cut into its body, its lid (lifted off) and the rice with its paddle (shown with the lid off),
 * in the room's toon light, the copper keeping a little shine */
const RICETUB_URL = import.meta.env.BASE_URL + 'models/ricetub.glb'
let riceParts: { body: THREE.Object3D; lid: THREE.Object3D; rice: THREE.Object3D } | null = null
export function useRiceTub() {
  const gltf = useGLTF(RICETUB_URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    if (riceParts) return riceParts
    const root = gltf.scene.clone(true)
    const mats = new Map<THREE.Material, THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) {
        t = /Copper|Rivet/.test(src.name)
          ? new THREE.MeshStandardMaterial({ color: src.color.clone(), map: src.map, metalness: 0.7, roughness: 0.35 })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
        mats.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(root, (m) => /Rivet|Cord|Gap|Floor|Mound|Paddle|Hoop/.test(m.name), { width: 0.0016, weld: true })
    const get = (n: string) => { const o = root.getObjectByName(n)!; o.removeFromParent(); return o }
    riceParts = { body: get('RiceTubBody'), lid: get('RiceTubLid'), rice: get('RiceTubRice') }
    // (each of the three, which move only as a whole (the lid lifted off), drawn a few parts at a time)
    for (const part of Object.values(riceParts)) { plainColours(part); mergeByMaterial(part) }
    return riceParts
  }, [gltf])
}
useGLTF.preload(RICETUB_URL)

// (moved onto the takeaway table by the till as its warming tub (the owner's, 2026-11-11): GuestBar3D's WarmTub)
export function RiceTub() {
  const tub = useRiceTub()
  const [x, z] = DECOR.rice.at
  // (the lid: on the tub, or lifted off and leant against its side; click the tub to lift it or put it back. It's out of use: empty)
  const [open, setOpen] = useState(false)
  const lid = useRef<THREE.Group>(null)
  const lidT = useRef(0)
  useFrame((_, dt) => {
    lidT.current = THREE.MathUtils.clamp(lidT.current + (open ? 1 : -1) * Math.min(dt, 0.1) * 2.2, 0, 1)
    const k = lidT.current * lidT.current * (3 - 2 * lidT.current)
    if (!lid.current) return
    lid.current.position.set(-0.32 * k, 0.42 - 0.1585 * k + Math.sin(k * Math.PI) * 0.22, 0)
    lid.current.rotation.z = k * 1.36
  })
  return (
    <group position={[x, 0, z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      {/* (put by on the dining room's floor) */}
      <group position-y={ROOM_FLOOR} scale={RICE_SCALE}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; glowOnly(e.eventObject); setTip({ title: '飯桶', hint: `已不用（白飯從電鍋取）｜${open ? '點一下蓋上蓋子' : '點一下掀開蓋子'}` }) }}
        onPointerOut={(e) => { document.body.style.cursor = ''; glowLeave(e.eventObject); setTip(null) }}>
        {/* the tub (blender/ricetub.py): pale staves bound in copper, an ear either side; its lid, lifted off and leant by it when it's open */}
        <primitive object={tub.body} />
        <group ref={lid} position={[0, 0.42, 0]}><primitive object={tub.lid} /></group>
      </group>
    </group>
  )
}

/** when something was last taken out of the ingredient fridge (Roasting sets it as an order is brought out raw to the tray) */
export const FRIDGE_KICK = { at: -1e9 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fridgeKick?: typeof FRIDGE_KICK }).__fridgeKick = FRIDGE_KICK
/** the freezer's lid, opened by hand (a click): it stays up till it's clicked shut */
export const FREEZER = { open: false }
const LID_AT = new THREE.Vector3()
const FREEZER_URL = import.meta.env.BASE_URL + 'models/freezer.glb'
/** a soft round glow, for a lit lamp */
const GLOW_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()
/** the freezer's thermostat: its setting (kept in the browser) and the cavity's temperature as it drifts (game/freezer) */
const TEMP_KEY = 'jgs-freezer-temp-1'
export const FREEZER_TEMP = (() => {
  let set = FREEZER_DEFAULT
  try { const v = Number(localStorage.getItem(TEMP_KEY)); if (v >= FREEZER_MIN && v <= FREEZER_MAX && Number.isInteger(v)) set = v } catch { /* (none kept) */ }
  return { set, now: set, shownAt: -1e9 }
})()
/** the display: the cavity's temperature in green on its dark glass, or the setting with SET beside it just after a button's pressed */
function drawTemp(g: CanvasRenderingContext2D, t: number, setting: boolean) {
  g.fillStyle = '#0e1a14'; g.fillRect(0, 0, 256, 96)
  g.fillStyle = '#5affb0'; g.textBaseline = 'middle'
  g.font = 'bold 66px monospace'; g.textAlign = 'right'
  g.fillText(`${t}`, setting ? 186 : 200, 52)
  g.font = 'bold 30px monospace'; g.textAlign = 'left'
  g.fillText('℃', setting ? 188 : 202, 40)
  if (setting) { g.font = 'bold 22px monospace'; g.fillText('SET', 190, 76) }
}
/** the thermostat knob's angle for a setting: from the coldest a quarter-and-a-half round to the left to the warmest as far right */
const knobTurn = (set: number) => -((set - FREEZER_MIN) / (FREEZER_MAX - FREEZER_MIN) - 0.5) * Math.PI * 1.5
/** the knob's ridges round its rim, for a grip */
const KNOB_RIDGES = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2)
useGLTF.preload(FREEZER_URL)
/**
 * The ingredient freezer (blender/freezer.py): a wide chest freezer along the kitchen's back wall by the staff door, pale blue-white on a
 * dark plinth, its compressor housing at the right end (louvres, the temperature display and the red lamp), the lid hinged on its back
 * edge, no ink lines round it. Inside, as a fish shop's freezer: whole fish glazed in ice, vacuum-packed fillets, a styrofoam fish box,
 * the saury in a wire basket, blocks of ice, the stock packed below. Its lid swings up for a moment each time something's taken out for an order, a cool light spilling out over what's in it,
 * and it can be opened by hand, a click (and shut again with another). Its display shows the temperature inside, and the knob under it sets the thermostat (game/freezer).
 */
function IngredientFridge() {
  const lid = useRef<THREE.Object3D | null>(null)
  const light = useRef<THREE.PointLight>(null)
  const fz = useGLTF(FREEZER_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const root = fz.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // (in the room's toon light: each part its own colour, the steel and the ice keeping a little gloss; one finish for each of the model's
      // materials, shared, so the parts can be merged)
      const src = m.material as THREE.MeshStandardMaterial
      const glossy = /Steel|Ice|Film|Wire|Plate/.test(src.name)
      const had = made.get(src)
      if (had) { m.material = had; m.castShadow = !/Goods/.test(m.name); return }
      m.material = glossy
        ? new THREE.MeshPhysicalMaterial({ color: src.color, metalness: src.metalness, roughness: Math.max(0.15, src.roughness), clearcoat: 0.6,
          transparent: /Ice|Film/.test(src.name), opacity: /Ice/.test(src.name) ? 0.22 : /Film/.test(src.name) ? 0.35 : 1 })
        : /Lcd|Lamp/.test(src.name) ? new THREE.MeshBasicMaterial({ color: src.emissive.clone().multiplyScalar(1.4), toneMapped: false })
          : new THREE.MeshToonMaterial({ color: src.color })
      made.set(src, m.material as THREE.Material)
      m.castShadow = !/Goods/.test(m.name)
    })
    // (no ink lines round it: plain and clean, as an appliance looks; the body and what's in it drawn a few parts at a time, the lid (which
    // swings up) on its own)
    // (what's in it kept apart too: drawn only while the lid's up, some thirty draws saved the rest of the time)
    plainColours(root)
    mergeByMaterial(root, (o) => /^FreezerLid|^FreezerGoods/.test(o.name))
    return root
  }, [fz])
  // (its lid and what's in it, looked up in the model as drawn)
  lid.current = model.getObjectByName('FreezerLid') ?? null
  const goods = model.getObjectByName('FreezerGoods') ?? null
  // (the display's own canvas, drawn again whenever what it shows changes)
  const temp = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 96
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext('2d')!, tex, last: '' }
  }, [])
  const knob = useRef<THREE.Group>(null)
  const knobCap = useRef<THREE.Group>(null)
  const press = (dir: 1 | -1) => {
    FREEZER_TEMP.set = stepTemp(FREEZER_TEMP.set, dir)
    FREEZER_TEMP.shownAt = performance.now()
    try { localStorage.setItem(TEMP_KEY, String(FREEZER_TEMP.set)) } catch { /* (not kept) */ }
  }
  // (the lid heard: its seal let go as it's lifted, a muffled knock as it comes down shut (the owner's), as loud as it's near)
  const lidHeard = useRef({ open: 0, down: true })
  useFrame(({ camera }, dt) => {
    const open = FREEZER.open || performance.now() - FRIDGE_KICK.at < 1800 ? 1 : 0
    const heard = lidHeard.current
    const near = () => (lid.current ? Math.max(0, 1 - lid.current.getWorldPosition(LID_AT).distanceTo(camera.position) / 12) : 1)
    if (open && !heard.open) coolerDoorSound(true, near(), true)
    heard.open = open
    if (lid.current) {
      if (lid.current.rotation.x < -0.3) heard.down = false
      else if (!heard.down && !open && lid.current.rotation.x > -0.04) { heard.down = true; coolerDoorSound(false, near(), true) }
    }
    FREEZER_TEMP.now = driftTemp(FREEZER_TEMP.now, FREEZER_TEMP.set, open > 0, Math.min(dt, 0.1))
    const setting = performance.now() - FREEZER_TEMP.shownAt < 2000
    const shows = setting ? FREEZER_TEMP.set : Math.round(FREEZER_TEMP.now)
    const key = `${shows}${setting}`
    if (key !== temp.last) { temp.last = key; drawTemp(temp.g, shows, setting); temp.tex.needsUpdate = true }
    // (the knob turns to its setting, a quick ease)
    if (knobCap.current) knobCap.current.rotation.z += (knobTurn(FREEZER_TEMP.set) - knobCap.current.rotation.z) * Math.min(1, dt * 12)
    // (the lid hinged on its back edge, swinging up and over)
    if (lid.current) lid.current.rotation.x += ((-open * 1.85) - lid.current.rotation.x) * 0.1
    // (shut, nothing inside can be seen: not drawn; open, empty with none of its foods in stock (item 182: full under a panel saying 0))
    if (goods) goods.visible = (!lid.current || lid.current.rotation.x < -0.02) && anyInStock(FROZEN_FOODS)
    if (light.current) light.current.intensity += (open * 0.45 - light.current.intensity) * 0.12
  })
  const W = 1.5, H = 0.86, HOUSE = 0.34
  return (
    <group>
      {/* (clicked open, the pantry's panel comes up with it, at the grill (App: askPantry)) */}
      <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; FREEZER.open = !FREEZER.open; if (FREEZER.open) askPantry('frozen', 'freezer', () => { FREEZER.open = false }); else shutPantry(); setTip({ title: '食材冷凍櫃', hint: FREEZER.open ? '點一下關上' : '點一下打開' }) }}
        onPointerOver={(e) => { handOver.onPointerOver(e); setTip({ title: '食材冷凍櫃', hint: FREEZER.open ? '點一下關上' : '點一下打開食材櫃' }) }}
        onPointerOut={(e) => { handOver.onPointerOut(e); setTip(null) }}>
        <primitive object={model} />
      </group>
      <AnchoredLight light={light} position={[-HOUSE / 2, H - 0.12, 0.15]} color="#cfe9ff" intensity={0} distance={2.4} decay={1.6} />
      {/* the temperature on the housing's display, and the thermostat's two buttons under it (up a degree, down a degree) */}
      <mesh position={[W / 2 - HOUSE / 2 - 0.03, 0.62, 0.74 / 2 + 0.009]}>
        <planeGeometry args={[0.1, 0.038]} />
        <meshBasicMaterial map={temp.tex} toneMapped={false} />
      </mesh>
      {/* the thermostat: a knob under the display, its white mark pointing to the setting; the left button turns it colder, the right
          warmer, a degree a time (the owner's: no wheel, nor which half of it's clicked) */}
      <group name="FreezerKnob" position={[W / 2 - HOUSE / 2 - 0.03, 0.562, 0.74 / 2 + 0.004]}>
        <group ref={knob}
          onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; press(-1) }}
          onContextMenu={(e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); if (getEdit().on) return; press(1) }}
          onPointerOver={(e) => { e.stopPropagation(); handOver.onPointerOver(e); setTip({ title: '溫控旋鈕', hint: `左鍵調冷、右鍵調暖，${FREEZER_MIN}～${FREEZER_MAX}℃` }) }}
          onPointerOut={(e) => { handOver.onPointerOut(e); setTip(null) }}>
          {/* (its skirt, chrome, and the black cap with ridges round it) */}
          <mesh rotation-x={Math.PI / 2} position-z={0.004}>
            <cylinderGeometry args={[0.024, 0.026, 0.008, 28]} />
            <meshStandardMaterial color="#c9d0d6" metalness={0.85} roughness={0.25} />
          </mesh>
          <group ref={knobCap}>
            {/* (its cap, sixteen ridges and mark drawn as three: they turn together, as one) */}
            <StaticBatch plain>
            <mesh rotation-x={Math.PI / 2} position-z={0.016}>
              <cylinderGeometry args={[0.018, 0.02, 0.018, 24]} />
              <meshStandardMaterial color="#22272c" metalness={0.1} roughness={0.45} />
            </mesh>
            {KNOB_RIDGES.map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.0195, Math.sin(a) * 0.0195, 0.016]} rotation-z={a}>
                <boxGeometry args={[0.003, 0.003, 0.016]} />
                <meshStandardMaterial color="#15191c" roughness={0.5} />
              </mesh>
            ))}
            {/* (the white mark on its face) */}
            <mesh position={[0, 0.011, 0.0255]}><boxGeometry args={[0.003, 0.012, 0.001]} /><meshBasicMaterial color="#f4f4ee" /></mesh>
            </StaticBatch>
          </group>
        </group>
        {/* (the scale round it: a dot at each end and the middle, blue for cold, red for warm) */}
        {[-1, 0, 1].map((k) => (
          <mesh key={k} position={[Math.sin(k * Math.PI * 0.75) * 0.033, Math.cos(k * Math.PI * 0.75) * 0.033, 0.001]}>
            <circleGeometry args={[0.003, 10]} />
            <meshBasicMaterial color={k < 0 ? '#3a7ad0' : k > 0 ? '#d04a3a' : '#e8eaec'} />
          </mesh>
        ))}
      </group>
      {/* the power lamp: a red glass bulb in the chrome bezel, lit from inside, a highlight on its glass and a soft glow round it */}
      <group position={[W / 2 - HOUSE / 2 + 0.07, 0.62, 0.74 / 2 + 0.008]}>
        <mesh scale={[1, 1, 0.7]}>
          <sphereGeometry args={[0.011, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {/* (glassy by its clear coat and its glint, not by transmission: a transmissive material anywhere makes three draw the whole
              room a second time every frame, for what shows through it) */}
          <meshPhysicalMaterial color="#ff3a2a" emissive="#ff2a18" emissiveIntensity={1.6} roughness={0.08} clearcoat={1} toneMapped={false} />
        </mesh>
        <mesh position={[-0.0035, 0.004, 0.0075]}><sphereGeometry args={[0.0022, 8, 6]} /><meshBasicMaterial color="#fff2ec" toneMapped={false} /></mesh>
        <sprite scale={[0.06, 0.06, 1]} position-z={0.004} raycast={NO_RAY}>
          <spriteMaterial map={GLOW_TEX} color="#ff5a3a" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
    </group>
  )
}
/** where it stands on the kitchen floor (along the first counter, across it): lying along the back wall, just to the cooks' side of the staff door, its back to the wall */
// (moved 0.75 further from the sink, which is a quarter as big again and wider)
const FRIDGE_AT = { along: 3.0, lay: 5.05 }
function FridgeAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, FRIDGE_AT.along).addScaledVector(LAY, FRIDGE_AT.lay)
  // (its front, local +z, toward the room, and its length along the wall: local x runs along the first counter)
  return <Movable id="freezer" label="冷藏櫃" baseScale={1.6} ground={floor}><group name="look-freezer" position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><IngredientFridge /></group></Movable>
}
// (two low racks side by side where the one tall cabinet stood, each half its width: their middles this far either side of where its was)
// (both a size up, 1.12 -> 1.22, taller and wider (item 93, the owner's, 2026-11-14: "the dish racks a little taller, a little bigger"): their
// middles as much further apart, the gap between them as it was; the pair moved along away from the ingredients' fridge by the second's
// growth toward it, clear of it as they were)
const RACK_SCALE = 1.22
const RACK_AT = { along: 1.12 - 0.11, lay: 5.05, apart: 0.62 * RACK_SCALE / 1.12 }
// (its size is taken about its middle: grown, its foot went 8 cm down into the floor; set back up on it, its foot where it was, measured)
const RACK_RISE = 0.078
/** the low rack by the cook table: its back 3 cm off the table's end (at along 2.52 here), beside the third cook's bay (its edge at lay 0) */
const LOW_AT = { along: 2.52 + 0.03 + (0.38 / 2) * 1.12, lay: 0.56 }
function RackAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const at = (k: number) => new THREE.Vector3().addScaledVector(ALONG, RACK_AT.along + k * RACK_AT.apart).addScaledVector(LAY, RACK_AT.lay)
  const p = at(-1), q = at(1)
  const lo = new THREE.Vector3().addScaledVector(ALONG, LOW_AT.along).addScaledVector(LAY, LOW_AT.lay)
  return (
    <>
      {/* (what the back room's view looks at: between the two, facing out with them) */}
      <group name="look-back" position={[(p.x + q.x) / 2, floor, (p.z + q.z) / 2]} rotation-y={Math.atan2(-LAY.x, -LAY.z)} />
      <Movable id="platerack" label="碗盤架 1" baseScale={RACK_SCALE} ground={floor}><group position={[p.x, floor + RACK_RISE, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={0} /></group></Movable>
      <Movable id="platerack2" label="碗盤架 2" baseScale={RACK_SCALE} ground={floor}><group position={[q.x, floor + RACK_RISE, q.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={1} /></group></Movable>
      {/* (the low rack by the cook table: against the table's end beside the third cook's bay, toward the plating place, its front out to the
          kitchen's floor (the owner's, 2026-11-11)) */}
      <Movable id="lowrack" label="矮碗盤架" baseScale={1.12} ground={floor}><group position={[lo.x, floor, lo.z]} rotation-y={Math.atan2(ALONG.x, ALONG.z)}><LowPlateRack /></group></Movable>
    </>
  )
}
/** where the sink stands: on the back wall past the freezer, its back to the wall, its front toward the cook's table (along and lay as the
 * freezer's); drawn a little over its own size (blender/sink.py, in metres) to the kitchen's, its deck level with the cook's table */
// (1.25 times as big as it was (the owner's), and deeper: drawn forward by as much as it's grown deeper, its back still at the wall; and right up
// against the freezer's end (the owner's: snug against it; a hand's width and more stood between them), the bin for the used sticks beside
// its other end)
const SINK_AT = { along: 3.75, lay: 5.68, scale: 1.15 * 1.25 }
function SinkAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, SINK_AT.along).addScaledVector(LAY, SINK_AT.lay)
  const place = { position: [p.x, floor, p.z] as [number, number, number], 'rotation-y': Math.atan2(-LAY.x, -LAY.z), scale: SINK_AT.scale }
  return (
    <>
      <Movable id="sink" label="流理台" ground={floor}><group name="look-sink" {...place}><SinkModel /></group></Movable>
      {/* (what stands on it, each a piece of its own, where it stands on it) */}
      {SINK_SETS.map((set) => <Movable key={set.id} id={set.id} label={set.label}><group {...place}><SinkPart node={set.node} /></group></Movable>)}
      {/* (the step stool before the basin, those washing stood on it (item 221)) */}
      <Movable id="stepstool" label="踏台" ground={floor}><group {...place}><group position={STEP_STOOL_AT}><StepStoolModel /></group></group></Movable>
    </>
  )
}
/** where the sacks of potatoes and sweet potatoes stand: on the kitchen's floor against the side counter's kitchen face, between its gate
 * and the cook's table, their mouths toward the kitchen (along and lay as the freezer's); far enough toward the gate that the left-hand
 * cupboard's doors swing open clear of them */
// (0.294 further out, off the counter's face (the owner's, 2026-11-11: through the wall): the sacks' backs reached 0.1 to 0.19 into it, the
// model's 0.21 at its 1.4 times)
// (then back toward it, 1.5 cm off it: against the wall (the owner's))
const SACKS_AT = { along: -2.36 + 0.21, lay: 3.42 }
function SacksAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, SACKS_AT.along).addScaledVector(LAY, SACKS_AT.lay)
  // (1.4 times the size they were modelled (the owner's), sized about their foot)
  return <Movable id="produce" label="常溫蔬菜" baseScale={1.4} ground={floor}><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(ALONG.x, ALONG.z)}><ProduceSacks /></group></Movable>
}
/** the two baskets of vegetables on the floor in front of the potatoes' and sweet potatoes' sacks (item 133, the owner's, 2026-11-15: in the
 * circle drawn there), in the sacks' own frame (x along the row, +z out toward the room, the model's units, 1.4 times in the room): the crate
 * in front of the potatoes, the wicker basket in front of the sweet potatoes, each turned a little */
// (item 262, the owner's: 「菜籃要像一點…蔬菜木箱也是，大一點、多一個、品質提升些，然後都要裝不同的蔬菜」 and 「太大了! 然後比例很怪，我的木箱要兩個」:
// two crates and the basket, made at their real size (metres: a tomato 7 cm, the basket 0.4 across), side by side along the sacks, 6.5 cm
// apart, their backs 2 cm clear of the loose potatoes on the floor (measured, blender/produce.py))
const VEG_AT: { id: string, label: string, node: VegNode, x: number, z: number, turn: number }[] = [
  { id: 'vegcrate', label: '蔬菜木箱', node: 'VegCrate', x: -0.72, z: 0.7, turn: 0.04 },
  { id: 'vegcrate2', label: '根菜木箱', node: 'VegCrate2', x: -0.1, z: 0.7, turn: -0.04 },
  { id: 'vegbasket', label: '蔬菜提籃', node: 'VegBasket', x: 0.46, z: 0.72, turn: -0.15 },
]
function VegAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, SACKS_AT.along).addScaledVector(LAY, SACKS_AT.lay)
  return <>{VEG_AT.map((v) => (
    // (as made, at their real size (item 262: they were made small and drawn 1.9 times, "too small" at 1.4 beside sacks of a metre; made at
    // their size now, 1.9 times over they were far too big)), placed in metres
    <Movable key={v.id} id={v.id} label={v.label} baseScale={1} ground={floor}>
      <group position={[p.x, floor, p.z]} rotation-y={Math.atan2(ALONG.x, ALONG.z)}>
        <group position={[v.x, 0, v.z]} rotation-y={v.turn}><VegBasket node={v.node} /></group>
      </group>
    </Movable>
  ))}</>
}
/** where the sack of binchotan stands (the owner's: on the floor by the cook table's right-hand end, toward the cook's side, the rice tub
 * beyond it): along and across, in the fire's frame */
// (on the floor in the corner under the charcoal crate, past the cook table's end against the bar (the owner's, 2026-11-11): it stood by the
// table's right-hand end, toward the cook's side)
// (0.4 back along its own x, the table's along (the owner's, 2026-11-11, set so by hand and made its place))
const COAL_SACK_AT = { along: 2.6, lay: -2.0 }
function CharcoalSackAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, COAL_SACK_AT.along).addScaledVector(LAY, COAL_SACK_AT.lay)
  return <Movable id="coalsack" label="備長炭麻袋" baseScale={1.25} ground={floor}><group name="coal-sack" position={[p.x, floor, p.z]} rotation-y={Math.atan2(LAY.x, LAY.z)}><CharcoalSack /></group></Movable>
}
const KNIVES_URL = import.meta.env.BASE_URL + 'models/knives.glb'
/** the cook's knives on their folded cloth (blender/knives.py), laid along the table behind the hearth */
/** the knife board (blender/knives.py) on the hearth frame's right-hand face: how far along that face is, where along the side its middle is,
 * how high it's hung, and its size (the model's real size, drawn up a little to the hearth's) */
/** the rack's middle, how high (its handles just under the top's edge over the notch), and how big it's drawn */
const KNIFE_BOARD = { y: -0.51, scale: 1.3 }
/** what's metal on it: the blades' steel, the gyuto's nickel spacer, the brass screws (real metal, the studio in them, so the steel gleams) */
const KNIFE_METAL = /Steel|Silver|Screw/
function KnifeSet() {
  useStudio()
  const gltf = useGLTF(KNIVES_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        if (KNIFE_METAL.test(src.name)) {
          const blade = /Steel/.test(src.name) && !/Neck/.test(src.name)
          const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), map: src.map ?? null, metalness: blade ? 0.8 : 0.9,
            roughness: blade ? 0.26 : 0.32, envMapIntensity: 0.95 })
          reflectStudio(g)
          t = g
        } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, (m) => /Mark|Neck|Screw|Spacer/.test(m.name), { width: 0.0012, weld: true })
    // (the set never moves: drawn a few parts at a time)
    plainColours(r)
    mergeByMaterial(r)
    return r
  }, [gltf])
  // (screwed to the table's face at the back of the notch under the hearth (where its cupboard was, set 0.06 back from the notch's line),
  // facing the cook who stands there: the board's back to the face, its middle the notch's; in the fire's frame, FIRE_SHIFT back along
  // from the table's)
  const p = new THREE.Vector3().addScaledVector(ALONG, (COOK_NOTCH.along[0] + COOK_NOTCH.along[1]) / 2 - FIRE_SHIFT.dot(ALONG))
    .addScaledVector(LAY, COOK_NOTCH.lay[0] - 0.06 + 0.001)
  return <group position={[p.x, KNIFE_BOARD.y, p.z]} rotation-y={Math.atan2(LAY.x, LAY.z)} scale={KNIFE_BOARD.scale}><primitive object={obj} /></group>
}
useGLTF.preload(KNIVES_URL)
/** the miso soup's pot (blender/misopot.py), on a little stand of the rice tub's beside it (the owner's: where the tub stood), steaming; how
 * big the pot's drawn, and how high the stand's top is (a little lower than the tub's). (Taken away a while on a misreading, and put back:
 * the owner's.) */
const MISOPOT_URL = import.meta.env.BASE_URL + 'models/misopot.glb'
useGLTF.preload(MISOPOT_URL)
// (beside the rice tub, on its far side from the cook table, in a row with it (the owner's: it stood behind the tub, where the crew stand))
// (on the warming counter's second well (WARMER): it stood on a little stand of its own)
// (in the warming counter's one well (WARMER: its WELL_X, -0.4 along it), the counter moved up between the cook table and the till)
// (in the middle of the warmer cut to half, its well there (2026-11-11)); the counters moved up against the bar's back (WARMER_AT)
const MISO_AT = { along: 4.28, lay: -0.5 - 0.937 }
const MISO_SCALE = 1.05
const MISO_TOP = COUNTER_TOP
/** the soup's surface in the miso pot's model, brim-full, and the lowest it's drawn (blender/misopot.py's SOUP; its inside straight to 0.03) */
const SOUP_TOP = 0.31, SOUP_LOW = 0.05
function MisoPot() {
  useStudio()
  const gltf = useGLTF(MISOPOT_URL) as unknown as { scene: THREE.Group }
  const pot = useMemo(() => {
    const r = gltf.scene.getObjectByName('MisoPot')!.clone(true)
    r.position.set(0, 0, 0)
    // (one ladle in it: the one taken up to fill the bowls and put back (SideBowls' Otama), lying on its floor with its handle over the rim;
    // the one made standing in the model (blender/misopot.py's MisoLadleBowl and its handle) was a second ladle beside it (item 253))
    r.getObjectByName('MisoLadleBowl')?.removeFromParent()
    // (its lid a little further back over its far side: the open half wide enough for the ladle's cup to go in and out past its edge
    // (it was 0.42 of the pot's radius back; 0.56 now) (item 253))
    const lid = r.getObjectByName('MisoPotLid')
    if (lid) lid.position.z -= 0.042
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the hammered aluminium real metal, the studio in it; the rest in the room's toon light)
        if (/Alu|Inside/.test(src.name)) {
          const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), map: src.map ?? null, normalMap: src.normalMap ?? null, metalness: 0.8, roughness: 0.34, envMapIntensity: 0.9 })
          reflectStudio(g)
          t = g
        } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, (m) => /Soup|Inside/.test(m.name), { width: 0.0016, weld: true })
    // (it never moves: its parts and their ink lines folded together by material (they were some twenty draws)); the soup's surface kept apart,
    // drawn only when there's soup in it (game/soup: empty when the day starts)
    const soup = r.getObjectByName('MisoSoup')!
    plainColours(r)
    // (its lid kept out too, to be lifted off and back on a click (item 260))
    mergeByMaterial(r, (o) => o === soup || (!!lid && (o === lid || o.parent === lid)))
    return { root: r, soup, soupY: soup.position.y, lid, lidY: lid?.position.y ?? 0, lidZ: lid?.position.z ?? 0 }
  }, [gltf])
  // (item 260, the owner's, 2026-11-17: 「味僧湯鍋不能互動」: as the rice cooker is: pointed at, how it's getting on, kept up to date; clicked,
  // its lid lifted up and back to see the soup (and on again), or, empty with the makings in stock, a pot of it made)
  const open = useRef(false), openK = useRef(0), hov = useRef(false)
  const say = () => {
    const st = SOUP.pot.state, lidSays = `點一下${open.current ? '蓋上' : '掀開鍋蓋'}`
    if (st === 'heating') return `加熱中⋯⋯還要 ${Math.ceil(SOUP.pot.left)} 秒｜${lidSays}`
    if (st === 'hot') return `熱騰騰的，還有 ${SOUP.left}/${SOUP_BOWLS} 碗｜${lidSays}`
    return open.current ? '空的｜點一下蓋上' : anyInStock(['MisoSoup']) ? '空的｜點一下煮一鍋味噌湯' : '空的｜味噌湯的料沒了，到庫存訂貨'
  }
  const click = () => {
    if (soupGoes(SOUP.pot) && !open.current) {
      if (anyInStock(['MisoSoup'])) { SOUP.pot = setSoup(); SOUP.batch = batchOf('MisoSoup', SOUP_BOWLS); lightSwitchSound(false) }
    } else open.current = !open.current
    setTip({ title: '味噌湯鍋', hint: say() })
  }
  const steam = useRef<THREE.Group>(null)
  /** how much steam (item 242): a thread through the lid's slot with it on, the soup's own with it off, eased between */
  const steamLv = useRef(0.4)
  // (empty: no soup in it (shrunk to nothing, not hidden: its material drawn from the start), no steam; made, it fills and steams faintly as
  // it heats, fully once hot)
  useFrame((_, dt) => {
    if (hov.current) setTip({ title: '味噌湯鍋', hint: say() })
    // (the lid: lifted up off the rim and back over the far side, tipped back, eased; on again as eased)
    openK.current += ((open.current ? 1 : 0) - openK.current) * Math.min(1, dt * 7)
    if (pot.lid) {
      const o = openK.current * openK.current * (3 - 2 * openK.current)
      pot.lid.position.y = pot.lidY + o * 0.1
      pot.lid.position.z = pot.lidZ - o * 0.16
      pot.lid.rotation.x = -o * 0.95
    }
    const st = SOUP.pot.state
    const k = st === 'empty' ? 0.0001 : 1
    pot.soup.scale.set(k, 1, k)
    // (its surface as high as the bowls left in it (item 199: drawn brim-full till the last bowl was ladled): the pot's twelve at the brim,
    // from SOUP_TOP down to SOUP_LOW over the inside's straight walls (blender/misopot.py: the soup at 0.31, the walls straight to 0.03))
    const full = st === 'hot' ? SOUP.left : SOUP.batch
    pot.soup.position.y = pot.soupY - (SOUP_TOP - SOUP_LOW) * (1 - Math.min(1, full / SOUP_BOWLS))
    if (steam.current) {
      steam.current.visible = st !== 'empty'
      const s = st === 'hot' ? 1 : st === 'heating' ? 0.4 + 0.6 * (1 - SOUP.pot.left / HEAT_S) : 0
      steam.current.scale.setScalar(Math.max(0.01, s))
      const lidOff = openK.current * openK.current * (3 - 2 * openK.current)
      steamLv.current += (0.4 + 0.75 * lidOff - steamLv.current) * (1 - Math.exp(-dt * 4))
    }
  })
  const p = new THREE.Vector3().addScaledVector(ALONG, MISO_AT.along).addScaledVector(LAY, MISO_AT.lay)
  return (
    <group position={[p.x, 0, p.z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)} name="miso-pot">
      {/* (pointed at, how it's getting on; clicked, its lid off or on, or a pot made (item 260)) */}
      <group position-y={MISO_TOP} scale={MISO_SCALE}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; click() }}
        onPointerOver={(e) => { e.stopPropagation(); hov.current = true; setTip({ title: '味噌湯鍋', hint: say() }) }}
        onPointerOut={() => { hov.current = false; setTip(null) }}>
        <primitive object={pot.root} />
        <group ref={steam} position={[0, 0.4, 0]} visible={false}>
          <Steam width={0.36} height={0.5} opacity={0.3} layers={2} level={steamLv} face />
        </group>
      </group>
    </group>
  )
}
/**
 * The electric rice cooker (blender/denkinabe.py: a classic Taiwanese 電鍋, pastel green, stainless lid, its switch lever and lamp at the
 * front), on a small stand beside the iron pot (the owner's: the rice for the rice balls is cooked in it, scooped from the open sack and
 * washed at the sink first, game/rice). While it cooks (bar.ts's RICE.kama) its lever is down and its lamp red, it steams from under its
 * lid and the lid lifts a little as it boils; done, the lever clicks up and the lamp goes amber (keeping warm) till the rice is scooped out
 * into the tub. Pointed at, it says how it's getting on.
 */
const DENKI_URL = import.meta.env.BASE_URL + 'models/denkinabe.glb'
useGLTF.preload(DENKI_URL)
// (on the warming counter's last well (WARMER): it stood on a little stand of its own)
// (on the rice-ball counter (PREP_AT), at its sink end (its rice is washed there), larger (the owner's, 2026-11-11: the rice is taken from it))
// (at the rice-ball counter's left end, beside the miso pot (the owner's, 2026-11-11), 1.1 from its middle: blender/warmer.py's board and
// the rest moved right for it)
const DENKI_AT = { along: 4.3, lay: 1.742 - 1.1 - 0.937 }
const DENKI_SCALE = 1.45
const DENKI_TOP = COUNTER_TOP
const LAMP_OFF = new THREE.Color('#3a1a14'), LAMP_COOK = new THREE.Color('#ff3a20'), LAMP_WARM = new THREE.Color('#ffb030')
/** cooked rice from above: grains packed, each a little oval catching the light, a soft shadow between them; and lit a little from within,
 * so it reads white down in the pot's shadow (item 260, the owner's, 2026-11-17: 「電鍋打開沒飯」: five bowls' worth was there, a plain pale
 * disc on the pot's floor, and read as the empty floor) */
const COOKER_RICE_TEX = (() => {
  if (typeof document === 'undefined') return null
  const S = 256, c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#d6d0c0'
  g.fillRect(0, 0, S, S)
  let r = 260
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 1400; k++) {
    g.save()
    g.translate(rnd() * S, rnd() * S)
    g.rotate(rnd() * Math.PI)
    g.fillStyle = 'rgba(120, 108, 86, 0.35)'
    g.beginPath(); g.ellipse(0.8, 0.9, 4.6, 2.3, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = k % 3 ? '#f7f4ec' : '#fffdf8'
    g.beginPath(); g.ellipse(0, 0, 4.2, 2.0, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255, 255, 255, 0.9)'
    g.beginPath(); g.ellipse(-1.4, -0.6, 1.6, 0.7, 0, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()
const COOKER_RICE_MAT = new THREE.MeshToonMaterial({ color: '#ffffff', map: COOKER_RICE_TEX, emissive: '#fff8ec', emissiveMap: COOKER_RICE_TEX, emissiveIntensity: 0.35 })
function DenkiNabe() {
  const gltf = useGLTF(DENKI_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = gltf.scene.getObjectByName('DenkiNabe')!.clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    const lamp = new THREE.MeshBasicMaterial({ color: LAMP_OFF.clone() })
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the stainless rim and lid real metal, the studio in it; the lamp lit by the game; the rest in the room's toon light)
        if (src.name === 'DenkiLamp') t = lamp
        else if (src.name === 'DenkiSteel' || src.name === 'DenkiPot') { const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.85, roughness: 0.28, envMapIntensity: 0.9 }); reflectStudio(g); t = g }
        else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        made.set(src, t)
      }
      m.material = t
      m.castShadow = src.name !== 'DenkiLamp'
      m.receiveShadow = true
    })
    inkModel(r, (m) => m.name.startsWith('DenkiLamp'), { width: 0.0016, weld: true })
    const lid = r.getObjectByName('DenkiLid')!, lever = r.getObjectByName('DenkiLever')!, rice = r.getObjectByName('DenkiRice')!
    plainColours(r)
    mergeByMaterial(r, (o) => o === lid || o.parent === lid || o === lever || o.parent === lever || o === rice)
    // (the rice its grains (item 260): its picture laid flat from above over it, the grains big enough to read down in the pot)
    if ((rice as THREE.Mesh).isMesh) {
      const rm = rice as THREE.Mesh, pos = rm.geometry.attributes.position, uv = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) * 3.6; uv[i * 2 + 1] = pos.getZ(i) * 3.6 }
      rm.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      rm.material = COOKER_RICE_MAT
    }
    return { root: r, lid, lidY: lid.position.y, lidZ: lid.position.z, lever, leverY: lever.position.y, lamp, rice, riceY: rice.position.y }
  }, [gltf])
  const steam = useRef<THREE.Group>(null)
  /** how much steam (item 242: the same faint thread whatever it was doing; opened on a pot of hot rice, nothing to see): a thread from its
   * vent keeping warm, a jet as it boils, the rice's own steam with the lid up, and a billow as it's first lifted */
  const steamLv = useRef(0.25), billowed = useRef(false)
  const was = useRef(RICE.kama.state)
  // (opened by a click (the owner's, 2026-11-11: the cooker to be used), its lid lifted up and back off the rim, the rice in it seen, as high as
  // what's left of the pot's twenty; empty and shut, a click washes a pot's rice and sets it on)
  const open = useRef(false), openK = useRef(0)
  const say = () => (RICE.kama.state === 'cooking' ? `煮飯中⋯⋯還要 ${Math.ceil(RICE.kama.left)} 秒`
    : RICE.kama.state === 'done' ? `保溫中，還有 ${RICE.rice}/${RICE_FULL} 份飯｜點一下${open.current ? '蓋上' : '掀開鍋蓋'}`
      : open.current ? '空了｜點一下蓋上' : anyInStock(['Onigiri']) ? '空了｜點一下洗米煮飯' : '空了｜米袋沒米了，到庫存訂米')
  const click = () => {
    if (riceGoes(RICE.kama) && !open.current && !RICE.washing) {
      // (set on with washed rice only with rice in stock, as much as there is (item 199: a full pot from an empty sack); else it says so)
      if (anyInStock(['Onigiri'])) { RICE.kama = setOn(); RICE.batch = batchOf('Onigiri', RICE_FULL); lightSwitchSound(false) }
    } else open.current = !open.current
    setTip({ title: '電鍋', hint: say() })
  }
  // (pointed at, its tag kept up to date as it counts down: it was set once, as the pointer came over it, and stood still)
  const hov = useRef(false)
  useFrame(({ clock }, dt) => {
    if (hov.current) setTip({ title: '電鍋', hint: say() })
    const k = RICE.kama, t = clock.elapsedTime
    const cooking = k.state === 'cooking'
    model.lamp.color.copy(cooking ? LAMP_COOK : k.state === 'done' ? LAMP_WARM : LAMP_OFF)
    // (the lever down while it cooks; done, it clicks up)
    model.lever.position.y = model.leverY - (cooking ? 0.014 : 0)
    if (was.current === 'cooking' && k.state === 'done') lightSwitchSound(true)
    was.current = k.state
    // (boiling hard in the middle of its time: the lid lifting a little on the steam)
    const boil = cooking ? Math.max(0, Math.sin(Math.PI * (1 - k.left / COOK_S))) : 0
    // (opened: up and back off the rim, tipped back on its hinge side; shut while it cooks)
    if (cooking) open.current = false
    openK.current += ((open.current ? 1 : 0) - openK.current) * Math.min(1, dt * 7)
    // (or lifted off by the one scooping a bowl of rice from it, as far as they have it (item 206: GuestBar3D's scoop))
    const o = Math.max(openK.current * openK.current * (3 - 2 * openK.current), RICE.lid)
    model.lid.position.y = model.lidY + boil * Math.max(0, Math.sin(t * 19)) * 0.004 + o * 0.06
    model.lid.position.z = model.lidZ - o * 0.13
    model.lid.rotation.x = -o * 1.05
    // (the rice in it: as high as what's left, nothing when it's empty (shrunk away: its material drawn from the start); cooking, a full pot)
    const left = k.state === 'cooking' ? 1 : k.state === 'done' ? RICE.rice / RICE_FULL : 0
    model.rice.position.y = model.riceY + Math.max(0, left) * 0.15
    model.rice.scale.setScalar(left > 0 ? 1 : 0.0001)
    if (steam.current) steam.current.visible = k.state !== 'empty'
    const want = cooking ? 0.45 + 0.6 * boil : k.state === 'done' ? 0.25 + 0.6 * o : 0
    if (k.state === 'done' && o > 0.45 && !billowed.current) { billowed.current = true; steamLv.current = Math.max(steamLv.current, 1.35) }
    if (o < 0.15) billowed.current = false
    steamLv.current += (want - steamLv.current) * (1 - Math.exp(-dt * 2.5))
    // (from the vent on the lid's top shut, from the pot's mouth open, as wide as it is; wider still in the billow (measured: the rim 0.26 up
    // in its frame, the lid's top 0.36; the steam began at 0.42, floating clear of both))
    if (steam.current) {
      const wide = 1 + 0.9 * o + 0.6 * Math.max(0, steamLv.current - 1)
      steam.current.position.y = 0.36 - 0.09 * o
      steam.current.scale.set(wide, 1, wide)
    }
  })
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, DENKI_AT.along).addScaledVector(LAY, DENKI_AT.lay)
  return (
    <group position={[p.x, 0, p.z]} rotation-y={WARMER_FACE}>
      <group position-y={DENKI_TOP} scale={DENKI_SCALE}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; click() }}
        onPointerOver={(e) => { e.stopPropagation(); hov.current = true; setTip({ title: '電鍋', hint: say() }) }}
        onPointerOut={() => { hov.current = false; setTip(null) }}>
        <primitive object={model.root} />
        <group ref={steam} visible={false}>
          <Steam width={0.22} height={0.4} opacity={0.42} layers={2} level={steamLv} face />
        </group>
        {/* (where the rice goes in and comes out; and its foot, on the counter (the one scooping holds the bowl a little over it, item 206)) */}
        <group name="cooker-top" position={[0, 0.3, 0]} />
        <group name="cooker-foot" />
      </group>
      {/* (where whoever's cooking it stands, before it: a step out from the counter's front (the owner's: 0.35 from its edge)) */}
      <group name="cooker-front" position={[0, floor, WARMER_D / 2 + 0.35]} />
    </group>
  )
}
/**
 * The warming counter (blender/warmer.py; the owner's, 2026-11-09, 2026-11-11): only the soup's kept hot now, the miso pot in its one well;
 * made like the sink, its height (a terrazzo top with an upstand, a dark sugi cabinet on a black kick), before its well a knob, a thermometer
 * and a pilot lamp. Never moves: drawn by material, a few draws.
 */
const WARMER_URL = import.meta.env.BASE_URL + 'models/warmer.glb'
useGLTF.preload(WARMER_URL)
/** its middle (along, back from the table's line) and its depth, as blender/warmer.py has it (its length 1.4, its well in its middle) */
// (cut to half its length, its left end where it was (the owner's, 2026-11-11): its middle 0.7 to the left, its well where it stood)
// (up the floor between the cook table's end and the till, its front to the cook table (the owner's red box, 2026-11-11): it stood in the
// back of the kitchen beside the sink, where the rice-ball counter is now (PREP_AT))
// (the two counters moved together toward the bar until the warmer's top meets the bar's lip, 0.937 (measured: 1.0 to the bar's back, the
// lip 0.06 proud of it at the counter's height; the owner's, 2026-11-11: 貼合))
const WARMER_AT = { along: 4.3, lay: -0.5 - 0.937 }
const WARMER_D = 1.0
/**
 * The dry goods in the counter's two other cupboards (items 274, 275, the owner's: 「調料有缺 跟庫存的對不上(比方說鹽巴、味精...)，這些可以
 * 放到料理台下的系統櫃門」「這個遊戲是模擬真實世界，不是亂塞些模型的」): blender/pantry.py's packages, where warmer.py's plain-coloured salt
 * tub, nori box, miso tubs and rice bags stood with no stock behind them: in the middle cupboard two bags of rice and three of salt on its
 * floor, three tins of shichimi and three packs of nori on its shelf; three pouches of the peanut powder on the first's floor by the stock
 * pot. As many of each shown as there's stock of it (game/pantry's unitsShown: all at the usual stock, none at none, the last one while
 * there's any). Their print one picture painted here, a sixth each, in the stock panel's own names for them (game/supplies' supplyName, the
 * rice's data/storage's; the Japanese in English, as the shop's packaging would be). Drawn only while a door of its cupboard's open.
 */
const PANTRY_URL = import.meta.env.BASE_URL + 'models/pantry.glb'
useGLTF.preload(PANTRY_URL)
/** which package is which sixth of the picture (blender/pantry.py's: three across, two down), and its cupboard (the first or the middle) */
const PANTRY_KINDS: { id: string; prefix: string; cell: [number, number]; cup: 0 | 1 }[] = [
  { id: 'Onigiri', prefix: 'PantryRice', cell: [2, 1], cup: 1 },
  { id: 'season:salt', prefix: 'PantrySalt', cell: [0, 1], cup: 1 },
  { id: 'season:shichimi', prefix: 'PantryShichimi', cell: [1, 1], cup: 1 },
  { id: NORI, prefix: 'PantryNori', cell: [1, 0], cup: 1 },
  { id: 'season:peanut', prefix: 'PantryPeanut', cell: [0, 0], cup: 0 },
]
/** the packages' print: each sixth its label (its left 72%: a bag's front, a pack's top, a tin's round), its side's colour and its top's */
function paintPantry(g: CanvasRenderingContext2D, lang: string) {
  const S = 256, ja = lang === 'ja' || lang === 'en', L = (ja ? 'ja' : 'zh') as 'ja' | 'zh'
  const font = (px: number, w = 900) => `${w} ${px}px "Noto Sans TC", "Noto Sans JP", "Microsoft JhengHei", "Yu Gothic", sans-serif`
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, S * 3, S * 2)
  for (const k of PANTRY_KINDS) {
    const x0 = k.cell[0] * S, y0 = (1 - k.cell[1]) * S, LW = Math.round(S * 0.72)
    const name = k.id === 'Onigiri' ? (ja ? 'コシヒカリ' : '越光米') : supplyName(k.id, L) ?? ''
    const fill = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, w, h) }
    const say = (t: string, x: number, y: number, px: number, c: string, w = 900) => {
      g.font = font(px, w); g.fillStyle = c; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x0 + x, y0 + y)
    }
    const down = (t: string, x: number, y: number, px: number, c: string) => [...t].forEach((ch, i) => say(ch, x, y + i * px * 1.02, px, c))
    if (k.id === 'season:salt') {
      // (a white bag, a blue band across its top, the salt's name big in blue, its weight under it, a red seal)
      fill('#f4f3ee', 0, 0, S, S)
      fill('#2a4f9a', 0, 34, LW, 22)
      fill('#c9d6ee', 0, 56, LW, 6)
      say(name, LW / 2, 140, name.length > 1 ? 64 : 104, '#1f3f86')
      say('500g', LW / 2, 214, 26, '#2a2a2a', 700)
      g.fillStyle = '#c0281d'; g.beginPath(); g.arc(x0 + LW - 26, y0 + 92, 14, 0, Math.PI * 2); g.fill()
      fill('#e6e5df', LW + 10, 133, S - LW - 10, S - 133)
      fill('#dcdad2', LW + 10, 0, S - LW - 10, 123)
    } else if (k.id === 'season:shichimi') {
      // (a tin: red-orange, a gold band at each end, the name down its front in black on a cream panel, the lid brass)
      fill('#c8371f', 0, 0, S, S)
      fill('#d9b25a', 0, 14, LW, 12)
      fill('#d9b25a', 0, S - 26, LW, 12)
      const n = [...name].length, px = Math.min(52, Math.floor(170 / Math.max(1, n)))
      fill('#f3e7cc', LW / 2 - px * 0.7, 40, px * 1.4, S - 80)
      down(name, LW / 2, 128 - ((n - 1) * px * 1.02) / 2, px, '#1c120c')
      fill('#b8913f', LW + 10, 133, S - LW - 10, S - 133)
      fill('#c9a24f', LW + 10, 0, S - LW - 10, 123)
    } else if (k.id === 'Onigiri') {
      // (a kraft rice bag, its top read from the doors: a red band, the rice's name, where it's from, 5 kg; its edges kraft, a red stripe)
      fill('#c9a46e', 0, 0, S, S)
      for (let y = 0; y < S; y += 3) fill(`rgba(110,80,40,${0.05 + 0.04 * ((y / 3) % 2)})`, 0, y, LW, 1)
      fill('#b3261e', 0, 30, LW, 26)
      say(name, LW / 2, 118, [...name].length > 3 ? 34 : 46, '#2a1a0c')
      say(ja ? '新潟県産' : '日本新潟產', LW / 2, 166, 20, '#5a3a18', 700)
      say('5kg', LW / 2, 206, 28, '#b3261e', 900)
      fill('#b8925c', LW + 10, 133, S - LW - 10, S - 133)
      fill('#b3261e', LW + 10, 180, S - LW - 10, 14)
      fill('#a8844f', LW + 10, 0, S - LW - 10, 123)
    } else if (k.id === 'season:peanut') {
      // (a kraft pouch, a cream window with the name in brown, its weight)
      fill('#b98e5a', 0, 0, S, S)
      for (let y = 0; y < S; y += 4) fill(`rgba(90,60,30,${0.05 + 0.05 * ((y / 4) % 3)})`, 0, y, LW, 2)
      fill('#f2e4c6', 18, 82, LW - 36, 110)
      say(name, LW / 2, 128, [...name].length > 2 ? 44 : 56, '#5a3618')
      say('300g', LW / 2, 172, 22, '#7a4a20', 700)
      fill('#a87d4b', LW + 10, 133, S - LW - 10, S - 133)
      fill('#9a7042', LW + 10, 0, S - LW - 10, 123)
    } else {
      // (nori: a black pack, a gold band, the name in gold, a red seal, how many sheets)
      fill('#121812', 0, 0, S, S)
      fill('#c6a24c', 0, 60, LW, 10)
      say(name, LW / 2, 132, [...name].length > 2 ? 46 : 64, '#d9b860')
      say(ja ? '全形10枚' : '10片裝', LW / 2, 200, 22, '#e7d6a6', 700)
      g.fillStyle = '#b8261c'; g.fillRect(x0 + LW - 46, y0 + 20, 26, 26)
      fill('#1a201a', LW + 10, 133, S - LW - 10, S - 133)
      fill('#202820', LW + 10, 0, S - LW - 10, 123)
    }
  }
}
let PANTRY_LANG = ''
const PANTRY_TEX = signTexture(768, 512, (g) => paintPantry(g, PANTRY_LANG))
// (laid on as the model's own pictures are: a glTF's v runs down from the picture's top)
if (PANTRY_TEX) PANTRY_TEX.flipY = false
/** the picture's own canvas (the texture's may be a smaller copy of it: scene/textureCap) */
const PANTRY_CANVAS = PANTRY_TEX?.image as HTMLCanvasElement | undefined
const PANTRY_LABEL = new THREE.MeshToonMaterial({ color: '#ffffff', map: PANTRY_TEX })
function Warmer() {
  useStudio()
  const gltf = useGLTF(WARMER_URL) as unknown as { scene: THREE.Group }
  const pantryGltf = useGLTF(PANTRY_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = (gltf.scene.getObjectByName('Warmer') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the stainless real metal, the studio in it; the wells' warm glow and the pilot lamps lit; the rest in the room's toon light)
        if (src.name === 'WarmerSteel' || src.name === 'WarmerWell' || src.name === 'WarmerBrass') {
          const g = new THREE.MeshStandardMaterial({ color: src.name === 'WarmerSteel' ? '#ffffff' : src.color.clone(), map: src.map ?? null,
            metalness: 0.7, roughness: src.name === 'WarmerSteel' ? 0.25 : 0.35, envMapIntensity: 0.9 })
          reflectStudio(g)
          t = g
        } else if (src.name === 'WarmerGlow') t = new THREE.MeshBasicMaterial({ color: GLOW_AT[0].clone() })
        else if (src.name === 'WarmerLamp') t = new THREE.MeshBasicMaterial({ color: LAMP_AT[0].clone(), toneMapped: false })
        else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = /Sugi|Terrazzo|Kick/.test(src.name)
      m.receiveShadow = true
    })
    inkModel(r, (m) => m.name !== 'WarmerBody', { width: 0.0016, weld: true })
    plainColours(r)
    // (its cupboards' doors left whole, each on its hinge, to be opened (item 130, the owner's, 2026-11-15: "the doors under the counter all
    // open"); the rest drawn by material)
    const isDoor = (o: THREE.Object3D) => /^WarmerDoor\d$/.test(o.name)
    mergeByMaterial(r, isDoor)
    const doors: THREE.Object3D[] = []
    r.traverse((o) => { if (isDoor(o)) doors.push(o) })
    doors.sort((a, b) => a.name.localeCompare(b.name))
    const mats = [...made.values()] as THREE.MeshBasicMaterial[]
    // (all shut, the six drawn as one (item 135: two draws and a line each)); let go as one starts to swing
    const shut = homeCopy(r, doors)
    shut.home(true)
    // (each cupboard (two doors to it) dark inside till its doors open, and then its lamp on (items 263 and 277, the owner's, 2026-11-17:
    // 「料理台的櫃門裡面應該是黑漆漆的，打開會有燈，這系統跟灶台的一樣」): a dark veil across its opening just inside the face frame, and a lamp
    // strip under its top; as its doors open the strip lights, flickering on as a tube does, and the veil thins away: its inside seen lit. No
    // light of its own (a light more is every material's cost, and lights aren't added as the game runs): only drawn while a door of it's open)
    r.updateMatrixWorld(true)
    const toR = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const boxOf = (d: THREE.Object3D) => new THREE.Box3().setFromObject(d).applyMatrix4(toR)
    const cells = [0, 1, 2].map((j) => {
      const a = doors[2 * j], b = doors[2 * j + 1]
      if (!a || !b) return null
      const box = boxOf(a).union(boxOf(b))
      const w = box.max.x - box.min.x, h = box.max.y - box.min.y
      const veilMat = new THREE.MeshBasicMaterial({ color: '#0b0806', transparent: true, opacity: CAB_DARK, depthWrite: false })
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(w, h), veilMat)
      // (just inside the face frame, behind the doors' backs: the frame 2 cm deep in front of the opening)
      veil.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.min.z - 0.0035 - 0.024)
      veil.name = `WarmerVeil${j}`
      const stripMat = new THREE.MeshBasicMaterial({ color: CAB_STRIP_OFF.clone(), toneMapped: false })
      const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, w - 0.12), 0.012, 0.02), stripMat)
      strip.position.set(veil.position.x, box.max.y + 0.11, veil.position.z - 0.05)
      strip.name = `WarmerLampStrip${j}`
      for (const m of [veil, strip]) { m.visible = false; m.raycast = () => {}; r.add(m) }
      warmLater(veil)
      warmLater(strip)
      return { veil, veilMat, strip, stripMat, on: 0, since: -1 }
    })
    // (the dry goods (items 274, 275): each kind's packages, in its cupboard's group, one mesh and one ink line a kind cut to as many as
    // there's stock for (countedBatch))
    const pr = (pantryGltf.scene.getObjectByName('Pantry') ?? pantryGltf.scene).clone(true)
    pr.position.set(0, 0, 0)
    pr.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = PANTRY_LABEL
      m.castShadow = false
      m.receiveShadow = true
      m.raycast = () => {}
    })
    inkModel(pr, () => false, { width: 0.0014, weld: true })
    r.add(pr)
    const cups = [0, 1].map((j) => {
      const g = new THREE.Group()
      g.name = `PantryCup${j}`
      g.visible = false
      pr.add(g)
      return g
    })
    const stores = PANTRY_KINDS.map((k) => {
      const pieces = [0, 1, 2].map((i) => pr.getObjectByName(`${k.prefix}${i}`) as THREE.Mesh | undefined).filter((x): x is THREE.Mesh => !!x)
      for (const p of pieces) cups[k.cup].attach(p)
      return { id: k.id, all: DRY_STORE.find((d) => d.id === k.id)?.all ?? pieces.length, b: countedBatch(cups[k.cup], pieces), shown: -1 }
    })
    // (its program made at load, as the veils' are: shown only once a door's opened)
    warmLater(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), PANTRY_LABEL))
    const pantry = { cups, stores, at: -1, lang: '' }
    return { root: r, doors, shut, cells, glow: mats.find((m) => m.name === 'WarmerGlow'), lamp: mats.find((m) => m.name === 'WarmerLamp'), pantry }
  }, [gltf, pantryGltf])
  /** each door: whether it's to be open, and how far it is (0 shut .. 1 open) */
  const open = useRef<boolean[]>([])
  const swing = useRef<number[]>([])
  /** the door under the pointer (-1: none): its own drawn while it is, so its hover glow is seen (the owner, 2026-11-15: the doors drawn as
   * one copy while shut, the glow went on the hidden door) */
  const hovered = useRef(-1)
  // (its glow and pilot lamp as its heat is (game/soup's heatNow): dark off, a dull red low, bright high; eased, as a ring warms and cools)
  useFrame((_, dt) => {
    const n = heatNow(SOUP.heat, SOUP.pot), k = Math.min(1, dt * 1.5)
    model.glow?.color.lerp(GLOW_AT[n], k)
    model.lamp?.color.lerp(LAMP_AT[n], Math.min(1, dt * 8))
    // (the doors on their hinges: the even ones hung on their left, the odd on their right, each swinging out toward whoever opened it)
    let still = true
    model.doors.forEach((d, i) => {
      let k = (swing.current[i] ?? 0) + (((open.current[i] ? 1 : 0) - (swing.current[i] ?? 0)) * Math.min(1, dt * 6))
      // (settled shut: exactly shut, so the copy drawn for them all fits)
      if (!open.current[i] && k < 0.002) k = 0
      swing.current[i] = k
      if (open.current[i] || k > 0) still = false
      d.rotation.y = (i % 2 === 0 ? -1 : 1) * DOOR_OPEN * k * k * (3 - 2 * k)
    })
    model.shut.home(still && hovered.current < 0)
    // (each cupboard's lamp: on once a door of it's a little open, a tube's flicker as it comes on (a flash, dark, a dim flash, on); off at
    // once as they shut; its veil thinning as it lights)
    const now = performance.now()
    model.cells.forEach((c, j) => {
      if (!c) return
      const e = Math.max(swing.current[2 * j] ?? 0, swing.current[2 * j + 1] ?? 0)
      const shown = e > 0.001
      c.veil.visible = shown
      c.strip.visible = shown
      if (!shown) { c.since = -1; c.on = 0; return }
      if (e > CAB_LAMP_AT && c.since < 0) c.since = now
      if (e < CAB_LAMP_AT * 0.6) c.since = -1
      const t = c.since < 0 ? -1 : (now - c.since) / 1000
      c.on = t < 0 ? 0 : t < 0.06 ? 0.8 : t < 0.13 ? 0.1 : t < 0.2 ? 0.55 : t < 0.26 ? 0.25 : 1
      c.veilMat.opacity = CAB_DARK + (CAB_LIT - CAB_DARK) * c.on
      c.stripMat.color.copy(CAB_STRIP_OFF).lerp(CAB_STRIP_ON, c.on)
    })
    // (the dry goods: each cupboard's drawn only while a door of it's open; how many of each there are, as the stock has it, every half second;
    // their print in the page's language)
    const P = model.pantry
    const openOf = (j: number) => Math.max(swing.current[2 * j] ?? 0, swing.current[2 * j + 1] ?? 0) > 0.001
    const o0 = openOf(0), o1 = openOf(1)
    P.cups[0].visible = o0
    P.cups[1].visible = o1
    if ((o0 || o1) && now - P.at > 500) {
      P.at = now
      for (const s of P.stores) {
        const n = unitsShown(SUPPLIES.has(s.id), s.all, parOf(s.id))
        if (n !== s.shown) { s.shown = n; s.b.show(n) }
      }
      const lang = document.documentElement.lang
      if (lang !== P.lang && PANTRY_TEX && PANTRY_CANVAS) {
        P.lang = PANTRY_LANG = lang
        paintPantry(PANTRY_CANVAS.getContext('2d')!, lang)
        PANTRY_TEX.needsUpdate = true
      }
    }
  })
  const doorOf = (o: THREE.Object3D | null) => { for (let q = o; q; q = q.parent) { const m = /^WarmerDoor(\d)$/.exec(q.name); if (m) return +m[1] } return -1 }
  const doorSays = (i: number) => (open.current[i] ? '點一下關上' : '點一下打開')
  const heatSays = () => {
    const h = SOUP.heat, n = heatNow(h, SOUP.pot)
    return `${h === 'auto' ? `自動（${n ? '有湯，弱火' : '鍋子空的，不加熱'}）` : ['關', '弱火', '強火'][h]}｜點一下切換：自動、關、弱、強`
  }
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, WARMER_AT.along).addScaledVector(LAY, WARMER_AT.lay)
  return (
    <group position={[p.x, floor, p.z]} rotation-y={WARMER_FACE} {...nameOver('料理台', '味噌湯在加熱座上保溫；白飯從電鍋取，在砧板上捏飯糰')}>
      <primitive object={model.root}
        onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          const i = doorOf(e.object)
          if (i < 0 || getEdit().on) return
          e.stopPropagation()
          open.current[i] = !open.current[i]
          coolerDoorSound(open.current[i], 0.35)
          setTip({ title: '櫃門', hint: doorSays(i) })
        }}
        onPointerOver={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          const i = doorOf(e.object)
          if (i < 0 || getEdit().on) return
          e.stopPropagation()
          hovered.current = i
          document.body.style.cursor = 'pointer'
          // (lit as everything that can be clicked is (the owner, 2026-11-15: "it should light when pointed at"))
          glowOnly(model.doors[i])
          setTip({ title: '櫃門', hint: doorSays(i) })
        }}
        onPointerOut={() => { if (hovered.current >= 0) glowLeave(model.doors[hovered.current]); hovered.current = -1; document.body.style.cursor = '' }} />
      {/* (the warming well's knob, its dial and pilot lamp under the top's front: clicked, its heat turned on round (the owner's)) */}
      <mesh position={[0, 1.091, 0.49]} visible={false}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; SOUP.heat = nextHeat(SOUP.heat); setTip({ title: '加熱座旋鈕', hint: heatSays() }) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; setTip({ title: '加熱座旋鈕', hint: heatSays() }) }}
        onPointerOut={() => { document.body.style.cursor = ''; setTip(null) }}>
        <boxGeometry args={[0.36, 0.11, 0.06]} />
      </mesh>
    </group>
  )
}
/** how far the counter's cupboard doors swing open (rad) */
const DOOR_OPEN = 1.45
/** a cupboard's inside: how dark its veil is unlit, and lit (items 263, 277); how far open its doors are when its lamp comes on; its lamp
 * strip off and on */
const CAB_DARK = 0.9, CAB_LIT = 0.06, CAB_LAMP_AT = 0.18
const CAB_STRIP_OFF = new THREE.Color('#2a2622'), CAB_STRIP_ON = new THREE.Color('#fff1d0')
/** the warming well's glow and its pilot lamp at each heat (off, low, high) */
const GLOW_AT = [new THREE.Color('#2e2a28'), new THREE.Color('#6a2814'), new THREE.Color('#b8461e')]
const LAMP_AT = [new THREE.Color('#3a1a14'), new THREE.Color('#ff7a3a'), new THREE.Color('#ffb060')]
/**
 * The rice-ball counter (blender/warmer.py's prepcounter.glb; the owner's, 2026-11-11: where the warming counter stood, a counter for making
 * the rice balls): made like the sink, its height; on it a hinoki board with rice balls and their nori, a bowl of hand water, a box of nori
 * and a salt pot, and the electric cooker at its sink end (DENKI_AT): the cook takes the rice from the cooker and shapes them here. Never
 * moves: drawn by material.
 */
const PREP_URL = import.meta.env.BASE_URL + 'models/prepcounter.glb'
useGLTF.preload(PREP_URL)
// (up against the warmer's right end, in line with it (the owner's, 2026-11-11: 併桌): their tops' ends 2 mm apart (each 0.02 proud of its
// cabinet); it stood back in the kitchen at along 5.19, lay 3.4)
/** the board's middle along the counter and the counter's top, in its own frame (blender/warmer.py's BOARD_X, H + the board) */
const PREP_BOARD_X = 0.35, PREP_TOP = 1.236 + 0.035
const PREP_AT = { along: 4.3, lay: -0.5 + 0.7 + 0.02 + 0.002 + 0.02 + 1.5 - 0.937 }
function PrepCounter() {
  const gltf = useGLTF(PREP_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = (gltf.scene.getObjectByName('PrepCounter') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        t = /Brass/.test(src.name) ? new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.7, roughness: 0.35 })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = /Sugi|Terrazzo|Kick/.test(src.name)
      m.receiveShadow = true
    })
    // (inked as the room's things are (item 254, the owner's, 2026-11-17: 「這風格明顯不符」: the rice-ball set was plain colour with no line,
    // unlike all round it), the kitchen counters' line; not what lies flat on another (the towel's stripe, the box's label, the water in
    // the bowl, the fillings in their dishes, the pickles, the nori's bands and sheets, the leaves under the finished ones))
    // (item 353: each thing its own node now, all of one picture (blender/atlas_kit): the water, the inside of the bowl, the heaps in the dishes,
    // the pickles, the leaves and the nori still without a line)
    inkModel(r, (m) => /water|bowlin|fill\d|takuan|sasa|nori/i.test(m.name), { width: 0.0016, weld: true })
    plainColours(r)
    // (the finished rice balls on the tray left whole, shown as many as it holds (item 129))
    mergeByMaterial(r, (o) => /^PrepDone/.test(o.name))
    return r
  }, [gltf])
  const done = useMemo(() => [0, 1, 2].map((k) => model.getObjectByName(`PrepDone${k}`)).filter((o): o is THREE.Object3D => !!o), [model])
  const shown = useRef(-1)
  useFrame(() => {
    if (ONIGIRI_TRAY.n === shown.current) return
    shown.current = ONIGIRI_TRAY.n
    done.forEach((o, k) => { o.visible = k < ONIGIRI_TRAY.n })
  })
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, PREP_AT.along).addScaledVector(LAY, PREP_AT.lay)
  return (
    <group position={[p.x, floor, p.z]} rotation-y={WARMER_FACE}
      {...nameOver('料理台', '味噌湯在加熱座上保溫；白飯從電鍋取，三廚在砧板上捏飯糰，捏好的放竹盤')}>
      <primitive object={model} />
      {/* (where the third cook shapes the rice balls: the board's middle, and a step out from the counter's front before it (item 129)) */}
      <group name="prep-board" position={[PREP_BOARD_X, PREP_TOP + 0.06, 0.04]} />
      <group name="prep-front" position={[PREP_BOARD_X, 0, WARMER_D / 2 + 0.35]} />
    </group>
  )
}
/**
 * The sake stand on the cook table (blender/sakestand.py, item 73, the owner's: "a sake stand in the red box, a few bottles of sake on it"):
 * a two-stepped hinoki stand with three 1.8-litre bottles up at the back and two 720 ml ones at the front, on the table's wood between the
 * lantern and the coal crate, its front to the bar. Low-poly, all in its pictures: the bottles' glass shiny with the studio's reflection
 * (standard, not toon: glass that didn't shine read as painted wood), the stand toon; the hang tag a card drawn both sides.
 */
/** glass, the drink in it, and the rest, as the stand's own materials are made (shared by the sake and the shochu; and the open bottle at the
 * sake station on the serving counter, item 177) */
export function dressSake(r: THREE.Object3D, made: Map<THREE.Material, THREE.Material>) {
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = made.get(src)
    if (!t) {
      if (/SakeBottles|ShochuLabel/.test(src.name)) {
        // (the labels, the shoulder labels and the caps: paper and foil, opaque, a soft sheen)
        const g = new THREE.MeshStandardMaterial({ map: src.map ?? null, roughness: 0.42, metalness: 0.02, envMapIntensity: 0.6, side: THREE.DoubleSide })
        reflectStudio(g)
        t = g
      } else if (/SakeGlass/.test(src.name)) {
        // (the glass between them (item 88, the owner's: "glass the light comes through, real"): its colour from the picture, seen through
        // (the sake in it and what's behind), the studio's gleams sharp on it, and lit a little from within by its own colour: the light
        // through coloured glass; no transmission (it draws the whole shop again every frame))
        const g = new THREE.MeshStandardMaterial({ map: src.map ?? null, transparent: true, opacity: 0.72, depthWrite: false, roughness: 0.05,
          metalness: 0.1, envMapIntensity: 1.5, emissive: '#ffffff', emissiveMap: src.map ?? null, emissiveIntensity: 0.9 })
        // (see-through fades its gleams with it, and glass is not evenly clear: where it shines it's the shine that's seen, and toward its
        // edges, looked through at a slant, the glass is thick and its colour deep; so there less see-through)
        g.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{
            float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);
            float glint = smoothstep(0.55, 1.0, max(max(outgoingLight.r, outgoingLight.g), outgoingLight.b));
            diffuseColor.a = clamp(max(diffuseColor.a + rim * 0.3, glint), diffuseColor.a, 1.0);
          }
          #include <opaque_fragment>`)
        }
        g.customProgramCacheKey = () => 'sake-glass'
        reflectStudio(g)
        t = g
      } else if (/ShochuGlass|ShochuCupGlass/.test(src.name)) {
        // (the shochu's green glass and the shot glasses: see-through, shining, a little lit by their own colour; no transmission)
        const green = /ShochuGlass/.test(src.name)
        // (the cups a pale blue-white, thicker and lit a little more within (item 131): over the black tray they read as dark grey stubs)
        const g = new THREE.MeshStandardMaterial({ color: green ? '#3f9a5e' : '#e4f2f8', transparent: true, opacity: green ? 0.62 : 0.5,
          depthWrite: false, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.5, emissive: green ? '#1f5a34' : '#6a8088' })
        reflectStudio(g)
        t = g
      } else if (/Nigori/.test(src.name)) {
        // (the cloudy sake (雪見舟, item 285): milk-white, little seen through)
        const g = new THREE.MeshStandardMaterial({ color: '#f1eee6', transparent: true, opacity: 0.86, depthWrite: false, roughness: 0.3 })
        reflectStudio(g)
        t = g
      } else if (/SakeLiquid|ShochuLiquid/.test(src.name)) {
        // (the drink: near clear, sake a pale straw gold, shochu clearer still; its top catching the light)
        const g = new THREE.MeshStandardMaterial({ color: /Shochu/.test(src.name) ? '#e6efe4' : '#b89a52', transparent: true,
          opacity: /Shochu/.test(src.name) ? 0.42 : 0.32, depthWrite: false, roughness: 0.04 })
        reflectStudio(g)
        t = g
      } else if (/ShochuCap/.test(src.name)) {
        const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.9, roughness: 0.3 })
        reflectStudio(g)
        t = g
      } else if (/SakeShoji/.test(src.name)) {
        // (the risers' shoji (item 383): its paper lit softly from within, as an andon's, whatever the room's light (no light added): the
        // picture its own glow, its keyaki bars dark in it)
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, emissive: '#ffd08f', emissiveMap: src.map ?? null, emissiveIntensity: 0.32 })
      } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
      made.set(src, t)
    }
    m.material = t
    const see = /Glass|Liquid/.test(src.name)
    // (the drink drawn before its glass, the glass over it)
    if (see) m.renderOrder = /Liquid/.test(src.name) ? 1 : 2
    m.castShadow = !see
    m.receiveShadow = !see
  })
  // (no ink round the drink inside: its outline would show through the glass)
  inkModel(r, (m) => /Liquid/.test((m.material as THREE.Material).name) || /Liquid|Cord/.test(m.name), { width: 0.0012, weld: true })
}
const SAKESTAND_URL = import.meta.env.BASE_URL + 'models/sakestand.glb'
useGLTF.preload(SAKESTAND_URL)
/** where it stands on the cook table (the scene's frame: the strip between the lantern and the crate, half way, as far from the bar's lip
 * as from the hearth's frame (measured, item 73)), its turn (along that strip, its front to the bar) and its size (a 1.8 l bottle as tall as
 * the lantern's shade: the room's things are drawn larger than life) */
// (Decor's frame is the world's moved by (0.53, -0.38): the strip's middle measured at (-0.35, -1.79) in the world)
const SAKESTAND_AT: [number, number, number] = [-0.88, 0, -1.41]
const SAKESTAND_TURN = 3.75
const SAKESTAND_SCALE = 2.0
const SHOCHU_URL = import.meta.env.BASE_URL + 'models/shochu.glb'
useGLTF.preload(SHOCHU_URL)
/** the shochu's tray beside the stand, in the stand's frame: right of it, between it and the lantern (item 107, measured clear of both) */
// (the stand 0.92 long now (item 285): its end board and brass to 0.483, the tray's middle 0.11 past them and a little; its plinth to
// 0.511 since item 380, the tray moved along with it)
const SHOCHU_AT = new THREE.Vector3(0.655, 0, 0)
/** the tokkuri, set on the stand's front step at its right-hand end, at the bottles' own size (item 107: it stood at half their size down
 * on the table under where a tipped bottle's mouth came, the stream long and the jug tiny) */
// (item 285: the front step's last place, between the two bottles behind it, as the front's bottles are; item 380: on its coaster, the
// front step's top now 0.098 up (the plinth under the steps) and the coaster 0.006)
const JUG_AT = new THREE.Vector3(2.5 * 0.131, 0.104, 0.07)
/** how long a pour into a cup or the tokkuri takes, held over it (s); how high a bottle's carried, its foot over the table (the stand's
 * frame); how far it's tipped to pour; a cup's pours out of a bottle of shochu */
const POUR_S = 1.2
// (over the back step's coasters (0.164, item 380), the bottle clear of them as it's taken up)
const CARRY_Y = 0.22
const TIP_MAX = 1.9
const SHOCHU_CUPS = 8
/** the shochu left in its bottle (1 full); a new one put out when it's empty, from the spares in the back (item 199) */
const SHOCHU_LEVEL = { v: 1 }
/** the shochu's bottle among the stand's (after the sake's) */
const SHOCHU_K = SAKE_BOTTLE_ML.length
/** a new bottle of sake for the stand from the stock (item 199, the owner's 「庫存的東西沒對上」: poured empty, it stood full again, sake in
 * stock or none): as full as there's sake for, a bottle at most, that much taken out of the stock; how full (0: there's none) */
const standBottle = (k: number) => {
  const n = bottleFrom(k, SUPPLIES.has('Sake'))
  return n > 0 && SUPPLIES.take('Sake', n) ? n / goOf(k) : 0
}
/** a bottle of shochu for the tray from the spares in the back (game/drinkStock's back stock, item 199): whether there was one */
const spareShochu = () => {
  const have = DRINK_BACK.back.shochu ?? 0
  if (have <= 0) return false
  DRINK_BACK.back = { ...DRINK_BACK.back, shochu: have - 1 }
  DRINK_BACK.ver++
  return true
}
/** a bottle on the stand that's empty: it pours nothing */
const dryAt = (k: number) => (k === SHOCHU_K ? SHOCHU_LEVEL.v <= 0.01 : poursLeft(k, SAKE.levels[k]) === 0)
/** what's said of a bottle poured empty, or taken up empty (item 199): a new one opened (`fresh`), or none to be had */
const dryTip = (shochu: boolean, fresh: boolean, done: boolean) => ({
  title: shochu ? '燒酒' : '清酒',
  hint: `${done ? '倒完了' : '空瓶'}｜${fresh ? (shochu ? '從後場拿了一瓶新的' : '從庫存開了一瓶新的') : shochu ? '後場沒有燒酒了，到飲料庫存訂貨' : '清酒沒有庫存了，到庫存訂貨'}`,
})
/** the stand's words in the page's language (item 363: each make's notes are its own, not in the tips' table) */
const pick3 = (t: readonly [string, string, string]) => {
  const l = typeof document === 'undefined' ? 'zh' : document.documentElement.lang
  return l === 'ja' ? t[1] : l === 'en' ? t[2] : t[0]
}
/** what's said of bottle `k` pointed at (item 363): its make and grade; tasted, its notes and what it goes with; how to taste it, or, the
 * shop open, that the customers' is poured at the pass */
const bottleSays = (k: number) => {
  const n = SAKE_NOTES[k], open = !canTaste(!!SHOP.open), shochu = k === SHOCHU_K
  const known = SAKE_TASTED.list.includes(k)
  const notes = known ? `${pick3(n.grade)}｜${pick3(n.taste)}｜${pick3(['配', '合う料理：', 'With '])}${pick3(n.with)}` : `${pick3(n.grade)}｜${pick3(['還沒試飲', 'まだ試飲していない', 'Not tasted yet'])}`
  const how = open ? pick3(['營業中｜客人的清酒由三廚在出餐口倒', '営業中｜お客さんの酒は三番手が出し口で注ぐ', 'Open｜The customers’ sake is poured at the pass'])
    : shochu ? pick3(['按住拖到燒酒杯上方倒一杯，再點杯子喝掉', 'グラスの上へドラッグして一杯注ぎ、グラスをクリックして飲む', 'Drag it over a glass to pour, then click the glass to drink'])
      : pick3(['按住拖到德利或燒酒杯上方倒一杯，再點一下喝掉', '徳利か杯の上へドラッグして注ぎ、クリックして飲む', 'Drag it over the tokkuri or a glass to pour, then click to drink'])
  return { title: pick3(n.name), hint: `${notes}｜${how}` }
}
function SakeStand() {
  useStudio()
  const gltf = useGLTF(SAKESTAND_URL) as unknown as { scene: THREE.Group }
  const sho = useGLTF(SHOCHU_URL) as unknown as { scene: THREE.Group }
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const obj = useMemo(() => {
    const r = (gltf.scene.getObjectByName('SakeStand') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    dressSake(r, new Map())
    // (the stand merged; each bottle kept its own, to be lifted and poured (item 89))
    mergeByMaterial(r, (o) => /^SakeBottle\d+$/.test(o.name))
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf])
  const shochu = useMemo(() => {
    const r = (sho.scene.getObjectByName('ShochuSet') ?? sho.scene).clone(true)
    r.position.copy(SHOCHU_AT)
    dressSake(r, new Map())
    // (the tray merged; the bottle and the glasses each their own, the bottle to be carried, the glasses to be filled)
    mergeByMaterial(r, (o) => /^Shochu(Bottle|Cup\d)$/.test(o.name))
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sho])
  // (every bottle, the twelve sake and the shochu: where it stands and how it's turned in its own parent, that parent's place in the stand,
  // how tall, the drink inside)
  const bottles = useMemo(() => {
    const one = (node: THREE.Object3D, liquid: THREE.Object3D | null, off: THREE.Vector3, shochu_: boolean) => {
      const box = new THREE.Box3().setFromObject(node)
      const s = node.parent?.getWorldScale(new THREE.Vector3()).y || 1
      return { node, pos: node.position.clone(), q: node.quaternion.clone(), h: (box.max.y - box.min.y) / s - 0.0005, liquid, off, shochu: shochu_ }
    }
    const list = Array.from({ length: SAKE_BOTTLE_ML.length }, (_, k) => one(obj.getObjectByName(`SakeBottle${k}`)!, obj.getObjectByName(`SakeLiquid${k}`) ?? null, new THREE.Vector3(), false))
    const sb = shochu.getObjectByName('ShochuBottle')
    if (sb) list.push(one(sb, shochu.getObjectByName('ShochuLiquid') ?? null, SHOCHU_AT.clone(), true))
    return list
  }, [obj, shochu])
  /** where each can be poured into, in the stand's frame (its lip's middle) and how near its middle the bottle's mouth must come: the
   * tokkuri, then the three glasses */
  const targets = useMemo(() => {
    const t = [{ top: JUG_AT.clone().add(new THREE.Vector3(0, TOKKURI_H, 0)), r: 0.07, cup: -1, liquid: null as THREE.Object3D | null }]
    for (let k = 0; k < 3; k++) {
      const c = shochu.getObjectByName(`ShochuCup${k}`)
      if (c) t.push({ top: SHOCHU_AT.clone().add(c.position).add(new THREE.Vector3(0, 0.05, 0)), r: 0.045, cup: k, liquid: shochu.getObjectByName(`ShochuCupLiquid${k}`) ?? null })
    }
    return t
  }, [shochu])
  /** what's full of what's been poured: the tokkuri (till it's taken to a customer, or emptied), and each glass (till it's clicked empty) */
  const full = useRef<boolean[]>([false, false, false, false])
  /** which bottle each of them was poured from (the tokkuri, the three glasses): drunk, that make's tasted (item 363) */
  const pouredFrom = useRef<number[]>([-1, -1, -1, -1])
  const stream = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  /**
   * The player's pour by hand (item 107, the owner's, 2026-11-14: "not poured like that: the pointer turns into a hand and drags it"): the
   * bottle taken up and carried at `aim` (its foot, the stand's frame); over the tokkuri or a glass not yet full it tips and pours, POUR_S
   * to fill it; let go, it goes back to its place
   */
  const drag = useRef<{ b: number; aim: THREE.Vector3; ray: THREE.Ray | null; tip: number; over: number; t: number; back: number; from: THREE.Vector3; fromQ: THREE.Quaternion } | null>(null)
  useEffect(() => { bottles.forEach((b, k) => { if (b.liquid) b.liquid.scale.y = Math.max(0.02, b.shochu ? SHOCHU_LEVEL.v : SAKE.levels[k]) }) }, [bottles])
  useEffect(() => { targets.forEach((t) => { if (t.liquid) t.liquid.scale.y = 0.001 }) }, [targets])
  const TIP_Q = useMemo(() => new THREE.Quaternion(), [])
  /** a bottle posed: tipped by `tip` (0 upright .. 1 right over), its mouth where `mouth` is (or, upright, its foot at `foot`) */
  const pose = (b: (typeof bottles)[number], tip: number, foot: THREE.Vector3, mouth: THREE.Vector3 | null) => {
    const q = b.q.clone().multiply(TIP_Q.setFromAxisAngle(X_AXIS, TIP_MAX * tip))
    const m = new THREE.Vector3(0, b.h, 0).applyQuaternion(q)
    const at = mouth ? foot.clone().lerp(mouth.clone().sub(m), tip) : foot.clone()
    b.node.quaternion.copy(q)
    b.node.position.copy(at).sub(b.off)
    return at.add(m)
  }
  const showStream = (mouth: THREE.Vector3 | null, to: THREE.Vector3 | null) => {
    const s = stream.current
    if (!s) return
    if (!mouth || !to) { s.scale.set(1, 0.0001, 1); return }
    s.position.copy(mouth)
    s.scale.set(1, Math.max(0.0001, mouth.y - to.y), 1)
  }
  // (the twelve sake bottles drawn as one while none of them is moving (item 135: the stand was 73 draws, each bottle its glass, its sake,
  // its label and its line): a copy of them made as they come to rest, with their levels as they are then; let go as one's taken up)
  const homeAt = useRef<ReturnType<typeof homeCopy> | null>(null)
  const sakeNodes = useMemo(() => bottles.filter((b) => !b.shochu).map((b) => b.node), [bottles])
  const dropHome = () => {
    homeAt.current?.home(false)
    homeAt.current = null
    const old = obj.children.find((c) => c.name === 'home-copy')
    if (old) { old.removeFromParent(); old.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).geometry.dispose() }) }
  }
  useEffect(() => dropHome, [obj])
  useFrame((_, dt) => {
    const still = !drag.current
    if (!still && homeAt.current) dropHome()
    else if (still && !homeAt.current) { homeAt.current = homeCopy(obj, sakeNodes); homeAt.current.home(true) }
    const d = drag.current
    if (d) {
      const b = bottles[d.b]
      if (d.back >= 0) {
        // (let go: back to its place, set down upright)
        d.back = Math.min(1, d.back + Math.min(dt, 0.05) / 0.3)
        const k = d.back * d.back * (3 - 2 * d.back)
        b.node.position.lerpVectors(d.from, b.pos, k)
        b.node.quaternion.slerpQuaternions(d.fromQ, b.q, k)
        showStream(null, null)
        if (d.back >= 1) drag.current = null
        return
      }
      // (over the tokkuri (sake only) or a glass not yet full: tipped and poured, the drink in it rising; done, it's full; an empty bottle
      // pours nothing (item 199))
      let over = -1, best = Infinity
      const dry = dryAt(d.b)
      targets.forEach((t, i) => {
        if (dry || full.current[i] || (t.cup < 0 && b.shochu)) return
        // (judged by how near the pointer's ray passes the lip, not where it meets the carrying height: looked at from the side, that was
        // well off the lip of a low glass)
        const dd = d.ray ? d.ray.distanceToPoint(t.top) : Math.hypot(d.aim.x - t.top.x, d.aim.z - t.top.z)
        if (dd < t.r * 1.4 && dd < best) { best = dd; over = i }
      })
      if (over !== d.over) { d.over = over; d.t = 0 }
      d.tip += ((over >= 0 ? 1 : 0) - d.tip) * Math.min(1, dt * 6)
      const tg = over >= 0 ? targets[over] : null
      const mouth = pose(b, d.tip, d.aim, tg ? tg.top.clone().add(new THREE.Vector3(0, 0.03, 0)) : null)
      const pouring = !!tg && d.tip > 0.85
      showStream(pouring ? mouth : null, pouring ? tg!.top.clone().add(new THREE.Vector3(0, -0.02, 0)) : null)
      if (pouring) {
        d.t += Math.min(dt, 0.05)
        if (tg!.liquid) tg!.liquid.scale.y = Math.max(0.001, Math.min(1, d.t / POUR_S))
        if (b.liquid) b.liquid.scale.y = Math.max(0.02, (b.shochu ? SHOCHU_LEVEL.v : SAKE.levels[d.b]) - (d.t / POUR_S) * (b.shochu ? 1 / SHOCHU_CUPS : 0.1))
        if (d.t >= POUR_S) {
          full.current[over] = true
          pouredFrom.current[over] = d.b
          // (poured empty: a new one in its place only from the stock (item 199: it stood full again, sake in stock or none), the sake's
          // as full as there's sake for, the shochu a bottle from the spares in the back; none, it's left standing empty)
          if (b.shochu) {
            const left = SHOCHU_LEVEL.v - 1 / SHOCHU_CUPS
            if (left > 0.01) SHOCHU_LEVEL.v = left
            else {
              const fresh = spareShochu()
              SHOCHU_LEVEL.v = fresh ? 1 : 0
              setTip(dryTip(true, fresh, true))
            }
          } else {
            const r = pour(SAKE.levels, d.b, () => standBottle(d.b))
            SAKE.levels = r.levels
            if (r.opened || dryAt(d.b)) setTip(dryTip(false, r.opened, true))
          }
          if (b.liquid) b.liquid.scale.y = Math.max(0.02, b.shochu ? SHOCHU_LEVEL.v : SAKE.levels[d.b])
          d.over = -1; d.t = 0
        }
      }
      return
    }
    showStream(null, null)
  })
  /** which bottle a pointer's on (its node up the tree), or -1 */
  const bottleOf = (o: THREE.Object3D | null) => {
    for (let q = o; q; q = q.parent) {
      const m = /^SakeBottle(\d+)$/.exec(q.name)
      if (m) return +m[1]
      if (q.name === 'ShochuBottle') return SAKE_BOTTLE_ML.length
    }
    return -1
  }
  const RAY = useMemo(() => new THREE.Raycaster(), [])
  const aimAt = (x: number, y: number, out: THREE.Vector3) => {
    const g = group.current
    if (!g) return false
    const rect = gl.domElement.getBoundingClientRect()
    RAY.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera)
    g.updateWorldMatrix(true, false)
    const h = g.localToWorld(new THREE.Vector3(0, CARRY_Y, 0)).y
    const hit = RAY.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), new THREE.Vector3())
    if (!hit) return false
    out.copy(g.worldToLocal(hit))
    const d = drag.current
    if (d) {
      const o = g.worldToLocal(RAY.ray.origin.clone())
      d.ray = new THREE.Ray(o, g.worldToLocal(RAY.ray.origin.clone().add(RAY.ray.direction)).sub(o).normalize())
    }
    return true
  }
  const onDown = (e: { stopPropagation: () => void; object: THREE.Object3D; nativeEvent: PointerEvent }) => {
    if (getEdit().on || drag.current) return
    const k = bottleOf(e.object)
    if (k < 0 || !bottles[k]) return
    e.stopPropagation()
    // (the shop open, it's only to look at: the customers' is poured at the pass, and the owner's at the fire (item 363))
    if (!canTaste(!!SHOP.open)) { setTip(bottleSays(k)); return }
    const b = bottles[k]
    // (an empty one taken up: a new one in its place from the stock, if there's any now (item 199); none, it's carried empty, pouring nothing)
    if (dryAt(k)) {
      let fresh = false
      if (b.shochu) { fresh = spareShochu(); if (fresh) SHOCHU_LEVEL.v = 1 } else {
        const n = standBottle(k)
        fresh = n > 0
        if (fresh) SAKE.levels = SAKE.levels.map((l, i) => (i === k ? n : l))
      }
      if (b.liquid) b.liquid.scale.y = Math.max(0.02, b.shochu ? SHOCHU_LEVEL.v : SAKE.levels[k])
      setTip(dryTip(b.shochu, fresh, false))
    }
    const aim = b.pos.clone().add(b.off).setY(CARRY_Y)
    drag.current = { b: k, aim, ray: null, tip: 0, over: -1, t: 0, back: -1, from: new THREE.Vector3(), fromQ: new THREE.Quaternion() }
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    document.body.classList.add('is-carrying')
    const move = (ev: PointerEvent) => { const d = drag.current; if (d && d.back < 0) aimAt(ev.clientX, ev.clientY, d.aim) }
    const up = () => {
      window.removeEventListener('pointermove', move)
      const d = drag.current
      if (d) { d.back = 0; d.from.copy(bottles[d.b].node.position); d.fromQ.copy(bottles[d.b].node.quaternion) }
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
      document.body.classList.remove('is-carrying')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  // (pointed at, a bottle shows the hand that takes it up; a full glass, that it's emptied with a click)
  const onOver = (e: { stopPropagation: () => void; object: THREE.Object3D }) => {
    if (getEdit().on || drag.current) return
    const k = bottleOf(e.object)
    if (k >= 0) {
      e.stopPropagation()
      document.body.style.cursor = 'grab'
      const shochu_ = k === SHOCHU_K
      // (an empty one: whether there's a new one to be had (item 199))
      const more = shochu_ ? (DRINK_BACK.back.shochu ?? 0) > 0 : SUPPLIES.has('Sake') !== 0
      setTip(dryAt(k) ? { title: shochu_ ? '燒酒' : '清酒', hint: more ? `空瓶｜${shochu_ ? '拿起來從後場拿一瓶新的' : '拿起來從庫存開一瓶新的'}` : dryTip(shochu_, false, false).hint }
        : bottleSays(k))
    }
  }
  const onOut = () => { if (!drag.current) { document.body.style.cursor = ''; setTip(null) } }
  const cupOf = (o: THREE.Object3D | null) => { for (let q = o; q; q = q.parent) { const m = /^ShochuCup(\d)$/.exec(q.name); if (m) return +m[1] } return -1 }
  const onCupClick = (e: { stopPropagation: () => void; object: THREE.Object3D }) => {
    const c = cupOf(e.object)
    if (c < 0 || getEdit().on) return
    e.stopPropagation()
    const i = targets.findIndex((t) => t.cup === c)
    if (i < 0 || !full.current[i]) return
    full.current[i] = false
    const l = targets[i].liquid
    if (l) l.scale.y = 0.001
    drunk(i)
  }
  /** what was poured into target `i` drunk (item 363): the first of its make a tasting, its notes written down and said, the staff to speak
   * for it; after, just drunk */
  const drunk = (i: number) => {
    const k = pouredFrom.current[i]
    pouredFrom.current[i] = -1
    if (k < 0 || !SAKE_NOTES[k]) return
    const n = SAKE_NOTES[k], name = pick3(n.name)
    if (tasteSake(k)) {
      const pct = Math.round(sideChance(SAKE_SIDE, SAKE_TASTED.list) * 100)
      setTip({ title: `${pick3(['試飲', '試飲', 'Tasted'])}：${name}`,
        hint: `${pick3(n.grade)}｜${pick3(n.taste)}｜${pick3(['配', '合う料理：', 'With '])}${pick3(n.with)}${k === SHOCHU_K ? '' : `｜${pick3(['外場會推薦給客人：加點清酒的客人', 'ホールが勧める：お酒を頼む人', 'The floor will recommend it: customers adding sake'])} ${pct}%`}` })
      window.dispatchEvent(new CustomEvent('jgs-owner-says', { detail: pick3([`試飲了${name}：${pick3(n.taste)}，配${pick3(n.with)}。`,
        `${name}を試飲：${pick3(n.taste)}。${pick3(n.with)}に合う。`, `Tasted ${name}: ${pick3(n.taste)}. Good with ${pick3(n.with)}.`]) }))
    } else setTip({ title: name, hint: `${pick3(['喝掉了', '飲み干した', 'Drunk'])}｜${pick3(n.taste)}` })
  }
  // (the tokkuri on the step: full after a pour, a click empties it; pointed at, what it holds and what to do)
  const onJugClick = (e: { stopPropagation: () => void }) => {
    if (getEdit().on || drag.current) return
    e.stopPropagation()
    if (!full.current[0]) return
    full.current[0] = false
    drunk(0)
  }
  const onJugOver = (e: { stopPropagation: () => void }) => {
    if (getEdit().on || drag.current) return
    e.stopPropagation()
    setTip({ title: '德利', hint: full.current[0] ? '倒滿了｜點一下喝掉（試飲）' : '空的｜閉店時拖一支清酒到上方倒一杯' })
  }
  const onCupOver = (e: { stopPropagation: () => void; object: THREE.Object3D }) => {
    const c = cupOf(e.object)
    if (c < 0 || getEdit().on || drag.current) return
    const i = targets.findIndex((t) => t.cup === c)
    // (the owner's own glasses, for tasting (item 235, the owner's 「小酒杯放在那要怎到給客人?」): the customers' cups are at the sake station)
    setTip({ title: '燒酒杯', hint: `${full.current[i] ? '倒滿了｜點一下喝掉（試飲）' : '空的｜閉店時拖一支酒到上方倒一杯'}｜老闆試飲用，客人的酒杯在出餐口` })
  }
  return (
    <group ref={group} position={SAKESTAND_AT} rotation-y={SAKESTAND_TURN} scale={SAKESTAND_SCALE} {...nameOver('酒台', '店裡賣的清酒，擺給客人看｜閉店時老闆可以試飲：拖一支倒一杯、點一下喝掉，記下風味與適合的菜｜試飲過的酒外場會推薦，加點清酒的客人變多｜營業中客人的清酒由三廚在出餐口倒')}>
      <primitive object={obj} onPointerDown={onDown} onPointerOver={onOver} onPointerOut={onOut} />
      <primitive object={shochu} onPointerDown={onDown} onPointerOver={(e: { stopPropagation: () => void; object: THREE.Object3D }) => { onOver(e); onCupOver(e) }}
        onPointerOut={onOut} onClick={onCupClick} />
      {/* (the tokkuri on the front step, poured into by hand (item 107); full, a click empties it (item 177: a customer's is poured at the sake
          station on the serving counter and carried out, not this one, out of everyone's reach)) */}
      <group position={JUG_AT} onClick={onJugClick} onPointerOver={onJugOver} onPointerOut={onOut}><Tokkuri /></group>
      <mesh geometry={STREAM_GEO} material={STREAM_MAT} scale={[1, 0.0001, 1]} ref={stream} />
    </group>
  )
}
const X_AXIS = new THREE.Vector3(1, 0, 0)
/** the sake's stream: a thin straw-gold thread, its top at its origin, a unit long downward (scaled to the drop) */
export const STREAM_GEO = new THREE.CylinderGeometry(0.0022, 0.0018, 1, 6, 1, true).translate(0, -0.5, 0)
export const STREAM_MAT = new THREE.MeshStandardMaterial({ color: '#e9dcae', transparent: true, opacity: 0.75, roughness: 0.05, emissive: '#3a3018' })

function DecorImpl({ held, lanternAt, fanAt }: { held: RefObject<Held>; lanternAt: [number, number, number]; fanAt: [number, number, number] }) {
  return (
    <>
      <Movable id="crate" label="備長炭籃" baseScale={1.75} baseTurn={[0, 44, 0]}><Crate /></Movable>
      <Movable id="fan" label="團扇"><Fan held={held} at={fanAt} /></Movable>
      <HeldStick held={held} />
      <HeldRod held={held} />
      <Movable id="lantern" label="行燈" baseTurn={[0, -12, 0]}><Lantern at={lanternAt} /></Movable>
      <Movable id="sakestand" label="酒台"><SakeStand /></Movable>
      <Movable id="warmer" label="料理台（保溫座）"><Warmer /></Movable>
      <Movable id="prepcounter" label="料理台（飯糰）"><PrepCounter /></Movable>
      <Movable id="misopot" label="味噌湯鍋"><MisoPot /></Movable>
      <Movable id="denkinabe" label="電鍋"><DenkiNabe /></Movable>
      <Movable id="knives" label="刀具組"><KnifeSet /></Movable>
      <group position={[0, 0, 0]}><FridgeAt /><RackAt /><SinkAt /><SacksAt /><VegAt /><CharcoalSackAt /></group>
    </>
  )
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
export const Decor = memo(DecorImpl, (a, b) => a.held === b.held && a.lanternAt.every((v, i) => v === b.lanternAt[i]) && a.fanAt.every((v, i) => v === b.fanAt[i]))
