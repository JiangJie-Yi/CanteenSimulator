// What stands about the grill besides the dishes: a crate of binchotan (a stick dragged from it onto the fire adds
// charcoal), a paper fan by the seasonings (waved over the fire, it fans the coals up), and a paper floor lantern (行燈)
// glowing behind the stones, which can be moved about like the dishes. Roasting does the carrying (see held); what's dragged across the table is pushed clear of
// them like anything else (DECOR is their footprint, for its settle()).
import { getLights } from '@/scene/lightsStore'
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { StaticBatch, mergeByMaterial } from '@/scene/StaticBatch'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { ALONG, askPantry, COOK_NOTCH, FIRE_SHIFT, GRILL_OFFSET, KITCHEN_DROP, LAY, handOver, SUPPLIES } from './bar'
import { FREEZER_DEFAULT, FREEZER_MAX, FREEZER_MIN, driftTemp, stepTemp } from '@/game/freezer'
import { setTip } from '@/scene/hoverTip'
import { Movable } from './Movable'
import { PlateRack } from './PlateRack'
import { SinkModel } from './Sink'
import { CharcoalSack, ProduceSacks } from './KitchenStores'
import { getEdit } from './edit'
import { useBinchotan } from './binchotanModel'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'

type Spot = { at: [number, number]; r: number }
/** where each one stands (x, z) and how much room it takes */
export const DECOR = {
  crate: { at: [0.62, -2.0], r: 0.38 },
  // (lying at the table's back, left of the knives: the front middle is the notch cut in under the hearth, its right the tasting bowl)
  fan: { at: [-1.79, -0.68], r: 0.3 },
  // (drawn 1.8 times its own size, at the table's back, left of the middle, well in from the bar's lip (its corner, where it stood, had it
  // into the lip), clear of the hearth's frame and the crate; what's drawn is this and the edit's own offset for it (edit.ts BASES))
  lantern: { at: [-1.247, -1.202], r: 0.34 },
  // (the cooked rice the rice balls are made from: a shop's big tub, on a side table of its own just past the cook's
  // table's right-hand end, by the other cooks)
  rice: { at: [3.5, -2.12], r: 1.1 },
} satisfies Record<string, Spot>

/** what's being carried from here: a stick of charcoal or the fan, where it is (Roasting sets it), and how far the
 * fan has been waved (it swings with it) */
export type Held = { kind: 'charcoal' | 'fan'; at: THREE.Vector3; wave: number } | null

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
const CRATE_FULL = 36
export const CRATE = { left: CRATE_FULL }
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
    if (CRATE.left <= 0 && st.clock.elapsedTime - lastLook.current > 1) {
      lastLook.current = st.clock.elapsedTime
      if (SUPPLIES.coal() > 0) CRATE.left = SUPPLIES.refillCrate(CRATE_FULL)
    }
    if (CRATE.left !== left) setLeft(CRATE.left)
  })
  return (
    <group position={[DECOR.crate.at[0], 0, DECOR.crate.at[1]]} rotation-y={-0.35}>
      <StaticBatch>
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
/** the fan hung on its hook: handle up, its paper toward the cook (turned up off the table, then round to face along the table's lay) */
const FAN_HUNG = new THREE.Euler(-Math.PI / 2, Math.atan2(-LAY.x, -LAY.z), 0, 'YXZ')
function Fan({ held, at }: { held: RefObject<Held>; at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
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
      // (back on its hook)
      o.position.set(at[0], at[1], at[2])
      o.rotation.copy(FAN_HUNG)
    }
  })
  const geo = useMemo(() => {
    const face = new THREE.CircleGeometry(0.15, 40)
    face.rotateX(-Math.PI / 2)
    face.scale(1, 1, 0.92)
    return {
      face,
      handle: new THREE.CylinderGeometry(0.011, 0.013, 0.17, 8).rotateX(Math.PI / 2),
      rim: new THREE.TorusGeometry(0.15, 0.006, 6, 48).rotateX(Math.PI / 2).scale(1, 1, 0.92),
    }
  }, [])
  return (
    // (a proper size for fanning a charcoal fire: about a hand and a half across)
    <group ref={g} userData={{ decor: 'fan' }} scale={1.6}>
      <Inked geometry={geo.face} map={FAN_PAPER} grow={1.05} position={[0, 0.004, 0]} />
      <mesh geometry={geo.rim} position={[0, 0.006, 0]}>
        <meshToonMaterial color="#9a7444" />
      </mesh>
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
    // (out, the paper is only paper: dim, as the room's light leaves it)
    if (paper.current) paper.current.color.setScalar(Math.max(f, 0.32))
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
    const woodMats = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'AndonPaper') { paperMat.map = src.map; m.material = paperMat; return }
      if (!woodMats.has(src)) woodMats.set(src, new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map }))
      m.material = woodMats.get(src)!
      m.castShadow = true
    })
    // (its two hundred little parts, a mesh each, folded into one per material: a few draws, not two hundred)
    mergeByMaterial(r)
    return { r, paperMat }
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
      <sprite ref={flame} position={[0, MID * K * 0.9, 0]} scale={0.22}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.7} color="#ffcf80" />
      </sprite>
      {/* the glow round it, always facing the camera, laid on additively */}
      <sprite ref={halo} position={[0, MID * K, 0]} scale={0.95}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
      </sprite>
      {QUALITY.tier === 'high' && <pointLight ref={lamp} position={[0, MID * K, 0]} color="#ffb060" intensity={0.7} distance={1.8} decay={2} />}
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

/** (the lantern can be moved about the table like a dish: Roasting says where it is) */
/**
 * The rice the rice balls are shaped from (おひつ): a round tub of pale sawara bound with copper hoops, heaped with
 * steaming white rice, the wooden paddle (しゃもじ) stood in it, its lid leant against its side.
 */
/** the tub as drawn below, made this much bigger (a shop's おひつ, wider than two plates, and deep) */
const RICE_SCALE = 2.0
/** the side table it stands on: its top's height (the cook's table's top is the scene's y = 0), and its size */
const SIDE_TOP = -0.3
/**
 * The rice the rice balls are shaped from (おひつ): a big round tub of pale sawara bound with copper hoops, heaped with
 * steaming white rice, the wooden paddle (しゃもじ) stood in it, on a stand of its own (飯台, blender/ricestand.py), and its lid (the rice
 * bowls are kept in the dish cabinet with the rest).
 */
/** the rice tub's model (blender/ricetub.py) cut into its body, its lid (lifted off) and the rice with its paddle (shown with the lid off),
 * in the room's toon light, the copper keeping a little shine */
const RICETUB_URL = import.meta.env.BASE_URL + 'models/ricetub.glb'
let riceParts: { body: THREE.Object3D; lid: THREE.Object3D; rice: THREE.Object3D } | null = null
function useRiceTub() {
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
    for (const part of Object.values(riceParts)) mergeByMaterial(part)
    return riceParts
  }, [gltf])
}
useGLTF.preload(RICETUB_URL)

const RICESTAND_URL = import.meta.env.BASE_URL + 'models/ricestand.glb'
useGLTF.preload(RICESTAND_URL)
function RiceTub() {
  const tub = useRiceTub()
  const standGltf = useGLTF(RICESTAND_URL) as unknown as { scene: THREE.Group }
  const stand = useMemo(() => {
    const r = standGltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null }); made.set(src, t) }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, () => false, { width: 0.0016, weld: true })
    mergeByMaterial(r)
    return r
  }, [standGltf])
  const [x, z] = DECOR.rice.at
  // (the lid: on the tub, or lifted off and leant against its side; click the tub to lift it or put it back. Open, the rice shows,
  // steaming, with its paddle in it)
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
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  return (
    <group position={[x, 0, z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      {/* the stand (blender/ricestand.py): a hinoki top in a raised walnut border, tapered legs splayed a little, walnut aprons with a
          cloud-shaped arch cut from them, a shelf of bamboo slats low down; drawn its own height from the floor up to the top */}
      <primitive object={stand} position-y={floor} scale={[1, (SIDE_TOP - floor) / 1.08, 1]} />
      <group position-y={SIDE_TOP} scale={RICE_SCALE}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; glowOnly(e.eventObject); setTip({ title: '飯桶', hint: open ? '點一下蓋上蓋子' : '點一下掀開蓋子' }) }}
        onPointerOut={(e) => { document.body.style.cursor = ''; glowLeave(e.eventObject); setTip(null) }}>
        {/* the tub (blender/ricetub.py): pale staves bound in copper, an ear either side; its lid, lifted off and leant by it when it's open */}
        <primitive object={tub.body} />
        <group ref={lid} position={[0, 0.42, 0]}><primitive object={tub.lid} /></group>
        {open && (
          <>
            {/* the rice, heaped a little over the rim, the paddle stood in it */}
            <primitive object={tub.rice} />
            <Steam position={[0, 0.5, 0]} width={0.4} height={0.55} opacity={0.32} layers={2} />
          </>
        )}
      </group>
    </group>
  )
}

/** when something was last taken out of the ingredient fridge (Roasting sets it as an order is brought out raw to the tray) */
export const FRIDGE_KICK = { at: -1e9 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fridgeKick?: typeof FRIDGE_KICK }).__fridgeKick = FRIDGE_KICK
/** the freezer's lid, opened by hand (a click): it stays up till it's clicked shut */
export const FREEZER = { open: false }
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
  useFrame((_, dt) => {
    const open = FREEZER.open || performance.now() - FRIDGE_KICK.at < 1800 ? 1 : 0
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
      <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; FREEZER.open = !FREEZER.open; if (FREEZER.open) askPantry(); setTip({ title: '食材冷凍櫃', hint: FREEZER.open ? '點一下關上' : '點一下打開' }) }}
        onPointerOver={(e) => { e.stopPropagation(); glowOnly(e.eventObject); setTip({ title: '食材冷凍櫃', hint: FREEZER.open ? '點一下關上' : '點一下打開食材櫃' }) }}
        onPointerOut={(e) => { glowLeave(e.eventObject); setTip(null) }}>
        <primitive object={model} />
      </group>
      <pointLight ref={light} position={[-HOUSE / 2, H - 0.12, 0.15]} color="#cfe9ff" intensity={0} distance={2.4} decay={1.6} />
      {/* the temperature on the housing's display, and the thermostat's two buttons under it (up a degree, down a degree) */}
      <mesh position={[W / 2 - HOUSE / 2 - 0.03, 0.62, 0.74 / 2 + 0.009]}>
        <planeGeometry args={[0.1, 0.038]} />
        <meshBasicMaterial map={temp.tex} toneMapped={false} />
      </mesh>
      {/* the thermostat: a knob under the display, its white mark pointing to the setting; a click on its left turns it colder, on
          its right warmer (a degree a time), and the wheel turns it too */}
      <group name="FreezerKnob" position={[W / 2 - HOUSE / 2 - 0.03, 0.562, 0.74 / 2 + 0.004]}>
        <group ref={knob}
          onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; press(e.point.clone().sub(e.eventObject.getWorldPosition(new THREE.Vector3())).dot(new THREE.Vector3(1, 0, 0).applyQuaternion(e.eventObject.getWorldQuaternion(new THREE.Quaternion()))) < 0 ? -1 : 1) }}
          onWheel={(e) => { e.stopPropagation(); if (getEdit().on) return; press(e.deltaY > 0 ? -1 : 1) }}
          onPointerOver={(e) => { e.stopPropagation(); handOver.onPointerOver(e); setTip({ title: '溫控旋鈕', hint: `點左邊調冷、右邊調暖（或滾輪），${FREEZER_MIN}～${FREEZER_MAX}℃` }) }}
          onPointerOut={(e) => { handOver.onPointerOut(e); setTip(null) }}>
          {/* (its skirt, chrome, and the black cap with ridges round it) */}
          <mesh rotation-x={Math.PI / 2} position-z={0.004}>
            <cylinderGeometry args={[0.024, 0.026, 0.008, 28]} />
            <meshStandardMaterial color="#c9d0d6" metalness={0.85} roughness={0.25} />
          </mesh>
          <group ref={knobCap}>
            {/* (its cap, sixteen ridges and mark drawn as three: they turn together, as one) */}
            <StaticBatch>
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
        <sprite scale={[0.06, 0.06, 1]} position-z={0.004}>
          <spriteMaterial map={GLOW_TEX} color="#ff5a3a" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
    </group>
  )
}
/** where it stands on the kitchen floor (along the first counter, across it): lying along the back wall, just to the cooks' side of the staff door, its back to the wall */
const FRIDGE_AT = { along: 3.75, lay: 5.05 }
function FridgeAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, FRIDGE_AT.along).addScaledVector(LAY, FRIDGE_AT.lay)
  // (its front, local +z, toward the room, and its length along the wall: local x runs along the first counter)
  return <Movable id="freezer" label="冷藏櫃" baseScale={1.6} ground={floor}><group name="look-freezer" position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><IngredientFridge /></group></Movable>
}
// (two low racks side by side where the one tall cabinet stood, each half its width: their middles this far either side of where its was)
const RACK_AT = { along: 1.12, lay: 5.05, apart: 0.62 }
function RackAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const at = (k: number) => new THREE.Vector3().addScaledVector(ALONG, RACK_AT.along + k * RACK_AT.apart).addScaledVector(LAY, RACK_AT.lay)
  const p = at(-1), q = at(1)
  return (
    <>
      {/* (what the back room's view looks at: between the two, facing out with them) */}
      <group name="look-back" position={[(p.x + q.x) / 2, floor, (p.z + q.z) / 2]} rotation-y={Math.atan2(-LAY.x, -LAY.z)} />
      <Movable id="platerack" label="碗盤架 1" baseScale={1.12} ground={floor}><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={0} /></group></Movable>
      <Movable id="platerack2" label="碗盤架 2" baseScale={1.12} ground={floor}><group position={[q.x, floor, q.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack part={1} /></group></Movable>
    </>
  )
}
/** where the sink stands: on the back wall past the freezer, its back to the wall, its front toward the cook's table (along and lay as the
 * freezer's); drawn a little over its own size (blender/sink.py, in metres) to the kitchen's, its deck level with the cook's table */
const SINK_AT = { along: 4.41, lay: 5.85, scale: 1.15 }
function SinkAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, SINK_AT.along).addScaledVector(LAY, SINK_AT.lay)
  return <Movable id="sink" label="流理台" baseScale={SINK_AT.scale} ground={floor}><group name="look-sink" position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><SinkModel /></group></Movable>
}
/** where the sacks of potatoes and sweet potatoes stand: on the kitchen's floor against the side counter's kitchen face, between its gate
 * and the cook's table, their mouths toward the kitchen (along and lay as the freezer's); far enough toward the gate that the left-hand
 * cupboard's doors swing open clear of them */
const SACKS_AT = { along: -2.36, lay: 3.42 }
function SacksAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, SACKS_AT.along).addScaledVector(LAY, SACKS_AT.lay)
  // (1.4 times the size they were modelled (the owner's), sized about their foot)
  return <Movable id="produce" label="地瓜馬鈴薯" baseScale={1.4} ground={floor}><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(ALONG.x, ALONG.z)}><ProduceSacks /></group></Movable>
}
/** where the sack of binchotan stands (the owner's: on the floor by the cook table's right-hand end, toward the cook's side, the rice tub
 * beyond it): along and across, in the fire's frame */
const COAL_SACK_AT = { along: 2.72, lay: 1.7 }
function CharcoalSackAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, COAL_SACK_AT.along).addScaledVector(LAY, COAL_SACK_AT.lay)
  return <Movable id="coalsack" label="備長炭麻袋" baseScale={1.25} ground={floor}><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(LAY.x, LAY.z)}><CharcoalSack /></group></Movable>
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
function DecorImpl({ held, lanternAt, fanAt }: { held: RefObject<Held>; lanternAt: [number, number, number]; fanAt: [number, number, number] }) {
  return (
    <>
      <Movable id="crate" label="備長炭籃" baseScale={1.75} baseTurn={[0, 44, 0]}><Crate /></Movable>
      <Movable id="fan" label="團扇"><Fan held={held} at={fanAt} /></Movable>
      <HeldStick held={held} />
      <Movable id="lantern" label="行燈" baseTurn={[0, -12, 0]}><Lantern at={lanternAt} /></Movable>
      <Movable id="ricetub" label="飯桶"><RiceTub /></Movable>
      <Movable id="knives" label="刀具組"><KnifeSet /></Movable>
      <group position={[0, 0, 0]}><FridgeAt /><RackAt /><SinkAt /><SacksAt /><CharcoalSackAt /></group>
    </>
  )
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
export const Decor = memo(DecorImpl, (a, b) => a.held === b.held && a.lanternAt.every((v, i) => v === b.lanternAt[i]) && a.fanAt.every((v, i) => v === b.fanAt[i]))
