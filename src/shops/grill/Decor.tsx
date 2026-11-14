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
import { plainColours, StaticBatch, mergeByMaterial } from '@/scene/StaticBatch'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { RICE, SOUP, ALONG, askPantry, shutPantry, COOK_NOTCH, FIRE_SHIFT, GRILL_OFFSET, KITCHEN_DROP, LAY, handOver, nameOver, SUPPLIES } from './bar'
import { ironSkewer } from './skewerShape'
import { FREEZER_DEFAULT, FREEZER_MAX, FREEZER_MIN, driftTemp, stepTemp } from '@/game/freezer'
import { setTip } from '@/scene/hoverTip'
import { Movable } from './Movable'
import { COOK_S, RICE_FULL, riceGoes, setOn } from '@/game/rice'
import { HEAT_S, heatNow, nextHeat } from '@/game/soup'
import { LowPlateRack, PlateRack } from './PlateRack'
import { SINK_SETS, SinkModel, SinkPart } from './Sink'
import { CharcoalSack, ProduceSacks } from './KitchenStores'
import { coolerDoorSound, lightSwitchSound } from './restroomSound'
import { getEdit } from './edit'
import { useBinchotan } from './binchotanModel'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'
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
/** a stick taken out of the crate (onto the fire) */
export function takeFromCrate() {
  CRATE.left -= 1
  if (CRATE.left <= 0) CRATE.left = SUPPLIES.refillCrate(CRATE_FULL)
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
      // (back in its holder)
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
    // (shut, nothing inside can be seen: not drawn)
    if (goods) goods.visible = !lid.current || lid.current.rotation.x < -0.02
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
const RACK_AT = { along: 1.12, lay: 5.05, apart: 0.62 }
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
      <Movable id="platerack" label="碗盤架 1" baseScale={1.12} ground={floor}><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={0} /></group></Movable>
      <Movable id="platerack2" label="碗盤架 2" baseScale={1.12} ground={floor}><group position={[q.x, floor, q.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={1} /></group></Movable>
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
function MisoPot() {
  useStudio()
  const gltf = useGLTF(MISOPOT_URL) as unknown as { scene: THREE.Group }
  const pot = useMemo(() => {
    const r = gltf.scene.getObjectByName('MisoPot')!.clone(true)
    r.position.set(0, 0, 0)
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
    mergeByMaterial(r, (o) => o === soup)
    return { root: r, soup, soupY: soup.position.y }
  }, [gltf])
  const steam = useRef<THREE.Group>(null)
  // (empty: no soup in it (shrunk to nothing, not hidden: its material drawn from the start), no steam; made, it fills and steams faintly as
  // it heats, fully once hot)
  useFrame(() => {
    const st = SOUP.pot.state
    const k = st === 'empty' ? 0.0001 : 1
    pot.soup.scale.set(k, 1, k)
    if (steam.current) {
      steam.current.visible = st !== 'empty'
      const s = st === 'hot' ? 1 : st === 'heating' ? 0.4 + 0.6 * (1 - SOUP.pot.left / HEAT_S) : 0
      steam.current.scale.setScalar(Math.max(0.01, s))
    }
  })
  const p = new THREE.Vector3().addScaledVector(ALONG, MISO_AT.along).addScaledVector(LAY, MISO_AT.lay)
  return (
    <group position={[p.x, 0, p.z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)} name="miso-pot">
      {/* (nothing to do with it: named when pointed at, no glow, no pointing hand (bar.ts's nameOver)) */}
      <group position-y={MISO_TOP} scale={MISO_SCALE} {...nameOver('味噌湯鍋', '一直保溫著的味噌湯（豆腐、海帶芽、蔥）')}>
        <primitive object={pot.root} />
        <group ref={steam} position={[0, 0.4, 0]} visible={false}>
          <Steam width={0.36} height={0.5} opacity={0.3} layers={2} />
        </group>
      </group>
    </group>
  )
}
/**
 * The rice pot on its little stove (blender/hagama.py: a plastered clay stove, its fire mouth at the front, an iron 羽釜 under a wooden lid),
 * beside the miso soup, on the side away from the rice tub (the owner's: the rice cooked in the shop for the rice balls, game/rice). While it
 * cooks (bar.ts's RICE.kama) the coals glow in the mouth, it steams and its lid rattles as it boils; cooked, a last wisp till it's scooped
 * into the tub. Pointed at, it says how it's getting on.
 */
const HAGAMA_URL = import.meta.env.BASE_URL + 'models/hagama.glb'
useGLTF.preload(HAGAMA_URL)
// (on the warming counter's third well (WARMER), smaller: it stood on the floor, in the middle of the kitchen's way)
// (out of use (the owner's, 2026-11-11): put by on the dining room's floor beside the old rice tub)
const HAGAMA_AT = { along: 6.05, lay: 4.55 }
const HAGAMA_SCALE = 0.6
const GLOW_OFF = new THREE.Color('#2a1a12')
function Hagama() {
  const gltf = useGLTF(HAGAMA_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = gltf.scene.getObjectByName('Hagama')!.clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      // (its fire out: the coals' glow in the mouth dark (the rice is cooked in the electric cooker now, the owner's))
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.name === 'KamaGlow' ? GLOW_OFF.clone() : src.color.clone(), map: src.map ?? null }); made.set(src, t) }
      m.material = t
      m.castShadow = src.name !== 'KamaGlow'
      m.receiveShadow = true
    })
    inkModel(r, (m) => m.name === 'KamaGlow', { width: 0.0016, weld: true })
    plainColours(r)
    mergeByMaterial(r)
    return { root: r }
  }, [gltf])
  const p = new THREE.Vector3().addScaledVector(ALONG, HAGAMA_AT.along).addScaledVector(LAY, HAGAMA_AT.lay)
  return (
    <group position={[p.x, ROOM_FLOOR, p.z]} rotation-y={WARMER_FACE} scale={HAGAMA_SCALE} {...nameOver('羽釜與爐灶', '老式的炊飯爐灶（已不用，現在用電鍋煮飯）')}>
      <primitive object={model.root} />
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
    return { root: r, lid, lidY: lid.position.y, lidZ: lid.position.z, lever, leverY: lever.position.y, lamp, rice, riceY: rice.position.y }
  }, [gltf])
  const steam = useRef<THREE.Group>(null)
  const was = useRef(RICE.kama.state)
  // (opened by a click (the owner's, 2026-11-11: the cooker to be used), its lid lifted up and back off the rim, the rice in it seen, as high as
  // what's left of the pot's twenty; empty and shut, a click washes a pot's rice and sets it on)
  const open = useRef(false), openK = useRef(0)
  const say = () => (RICE.kama.state === 'cooking' ? `煮飯中⋯⋯還要 ${Math.ceil(RICE.kama.left)} 秒`
    : RICE.kama.state === 'done' ? `保溫中，還有 ${RICE.rice}/${RICE_FULL} 份飯｜點一下${open.current ? '蓋上' : '掀開鍋蓋'}`
      : open.current ? '空了｜點一下蓋上' : '空了｜點一下洗米煮飯')
  const click = () => {
    if (riceGoes(RICE.kama) && !open.current && !RICE.washing) { RICE.kama = setOn(); lightSwitchSound(false) }
    else open.current = !open.current
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
    const o = openK.current * openK.current * (3 - 2 * openK.current)
    model.lid.position.y = model.lidY + boil * Math.max(0, Math.sin(t * 19)) * 0.004 + o * 0.06
    model.lid.position.z = model.lidZ - o * 0.13
    model.lid.rotation.x = -o * 1.05
    // (the rice in it: as high as what's left, nothing when it's empty (shrunk away: its material drawn from the start); cooking, a full pot)
    const left = k.state === 'cooking' ? 1 : k.state === 'done' ? RICE.rice / RICE_FULL : 0
    model.rice.position.y = model.riceY + Math.max(0, left) * 0.15
    model.rice.scale.setScalar(left > 0 ? 1 : 0.0001)
    if (steam.current) steam.current.visible = k.state !== 'empty'
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
          <Steam position={[0, 0.42, 0]} width={0.22} height={0.4} opacity={0.32} layers={2} />
        </group>
        {/* (where the rice goes in and comes out) */}
        <group name="cooker-top" position={[0, 0.3, 0]} />
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
function Warmer() {
  useStudio()
  const gltf = useGLTF(WARMER_URL) as unknown as { scene: THREE.Group }
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
    mergeByMaterial(r)
    const mats = [...made.values()] as THREE.MeshBasicMaterial[]
    return { root: r, glow: mats.find((m) => m.name === 'WarmerGlow'), lamp: mats.find((m) => m.name === 'WarmerLamp') }
  }, [gltf])
  // (its glow and pilot lamp as its heat is (game/soup's heatNow): dark off, a dull red low, bright high; eased, as a ring warms and cools)
  useFrame((_, dt) => {
    const n = heatNow(SOUP.heat, SOUP.pot), k = Math.min(1, dt * 1.5)
    model.glow?.color.lerp(GLOW_AT[n], k)
    model.lamp?.color.lerp(LAMP_AT[n], Math.min(1, dt * 8))
  })
  const heatSays = () => {
    const h = SOUP.heat, n = heatNow(h, SOUP.pot)
    return `${h === 'auto' ? `自動（${n ? '有湯，弱火' : '鍋子空的，不加熱'}）` : ['關', '弱火', '強火'][h]}｜點一下切換：自動、關、弱、強`
  }
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, WARMER_AT.along).addScaledVector(LAY, WARMER_AT.lay)
  return (
    <group position={[p.x, floor, p.z]} rotation-y={WARMER_FACE} {...nameOver('料理台', '味噌湯在加熱座上保溫；白飯從電鍋取，在砧板上捏飯糰')}>
      <primitive object={model.root} />
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
    // (no ink: only the counter's body had it, and that's the warmer's model now)
    plainColours(r)
    mergeByMaterial(r)
    return r
  }, [gltf])
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, PREP_AT.along).addScaledVector(LAY, PREP_AT.lay)
  return (
    <group position={[p.x, floor, p.z]} rotation-y={WARMER_FACE} {...nameOver('料理台', '味噌湯在加熱座上保溫；白飯從電鍋取，在砧板上捏飯糰')}>
      <primitive object={model} />
    </group>
  )
}
/**
 * The sake stand on the cook table (blender/sakestand.py, item 73, the owner's: "a sake stand in the red box, a few bottles of sake on it"):
 * a two-stepped hinoki stand with three 1.8-litre bottles up at the back and two 720 ml ones at the front, on the table's wood between the
 * lantern and the coal crate, its front to the bar. Low-poly, all in its pictures: the bottles' glass shiny with the studio's reflection
 * (standard, not toon: glass that didn't shine read as painted wood), the stand toon; the hang tag a card drawn both sides.
 */
const SAKESTAND_URL = import.meta.env.BASE_URL + 'models/sakestand.glb'
useGLTF.preload(SAKESTAND_URL)
/** where it stands on the cook table (the scene's frame: the strip between the lantern and the crate, half way, as far from the bar's lip
 * as from the hearth's frame (measured, item 73)), its turn (along that strip, its front to the bar) and its size (a 1.8 l bottle as tall as
 * the lantern's shade: the room's things are drawn larger than life) */
// (Decor's frame is the world's moved by (0.53, -0.38): the strip's middle measured at (-0.35, -1.79) in the world)
const SAKESTAND_AT: [number, number, number] = [-0.88, 0, -1.41]
const SAKESTAND_TURN = 3.75
const SAKESTAND_SCALE = 2.0
function SakeStand() {
  useStudio()
  const gltf = useGLTF(SAKESTAND_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = (gltf.scene.getObjectByName('SakeStand') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        if (/SakeBottles/.test(src.name)) {
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
        } else if (/SakeLiquid/.test(src.name)) {
          // (the sake: near clear, a pale straw gold, its top catching the light)
          // (not bright: the glass already carries the light; its part of the bottle only a little richer, its level a line)
          const g = new THREE.MeshStandardMaterial({ color: '#b89a52', transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.04 })
          reflectStudio(g)
          t = g
        } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        made.set(src, t)
      }
      m.material = t
      const see = /SakeGlass|SakeLiquid/.test(src.name)
      // (the sake drawn before its glass, the glass over it)
      if (see) m.renderOrder = /SakeLiquid/.test(src.name) ? 1 : 2
      m.castShadow = !see
      m.receiveShadow = !see
    })
    // (no ink round the sake inside: its outline would show through the glass)
    inkModel(r, (m) => /SakeLiquid/.test((m.material as THREE.Material).name) || /SakeLiquid/.test(m.name), { width: 0.0012, weld: true })
    // (the stand merged; each bottle kept its own, to be lifted and poured (item 89))
    mergeByMaterial(r, (o) => /^SakeBottle\d$/.test(o.name))
    return r
  }, [gltf])
  return (
    <group position={SAKESTAND_AT} rotation-y={SAKESTAND_TURN} scale={SAKESTAND_SCALE} {...nameOver('酒台', '店裡的日本酒：雪嶺錦、朝霞川、鶴汀、月汀桜')}>
      <primitive object={obj} />
    </group>
  )
}

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
      <Movable id="hagama" label="羽釜與爐灶"><Hagama /></Movable>
      <Movable id="denkinabe" label="電鍋"><DenkiNabe /></Movable>
      <Movable id="knives" label="刀具組"><KnifeSet /></Movable>
      <group position={[0, 0, 0]}><FridgeAt /><RackAt /><SinkAt /><SacksAt /><CharcoalSackAt /></group>
    </>
  )
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
export const Decor = memo(DecorImpl, (a, b) => a.held === b.held && a.lanternAt.every((v, i) => v === b.lanternAt[i]) && a.fanAt.every((v, i) => v === b.fanAt[i]))
