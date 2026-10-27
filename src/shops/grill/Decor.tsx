// What stands about the grill besides the dishes: a crate of binchotan (a stick dragged from it onto the fire adds
// charcoal), a paper fan by the seasonings (waved over the fire, it fans the coals up), and a paper floor lantern (行燈)
// glowing behind the stones, which can be moved about like the dishes. Roasting does the carrying (see held); what's dragged across the table is pushed clear of
// them like anything else (DECOR is their footprint, for its settle()).
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { ALONG, GRILL_OFFSET, KITCHEN_DROP, LAY } from './bar'
import { setTip } from '@/scene/hoverTip'
import { Movable } from './Movable'
import { PlateRack } from './PlateRack'
import { getEdit } from './edit'
import { useBinchotan } from './binchotanModel'

type Spot = { at: [number, number]; r: number }
/** where each one stands (x, z) and how much room it takes */
export const DECOR = {
  crate: { at: [0.62, -2.0], r: 0.38 },
  // (lying on the table by the seasoning boxes, at their front end)
  fan: { at: [0.85, 1.68], r: 0.3 },
  // (drawn 1.8 times its own size, at the table's back right, well in from the bar's edge (a lantern's feet and shade need the table's room), clear of the stones, the crate and the plates)
  lantern: { at: [-2.12, -0.81], r: 0.34 },
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

/** A square plaited basket of white binchotan stood on end, packed full, its tag on the front. */
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
  return (
    <group position={[DECOR.crate.at[0], 0, DECOR.crate.at[1]]} rotation-y={-0.35} userData={{ decor: 'charcoal' }}>
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
      {sticks.map((s, i) => (
        <Inked key={i} geometry={stickGeos[s.g].geo} map={bin.face ?? undefined} grow={1.07} sideOnly position={s.p} rotation={s.r} />
      ))}
    </group>
  )
}

/** A round paper fan (団扇) lying by the seasoning boxes; picked up, it's held upright and swings as it's waved. */
function Fan({ held }: { held: RefObject<Held> }) {
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
      o.rotation.set(1.45 + Math.sin(phase.current) * 0.35 * beat.current, -0.6, swing.current)
    } else {
      o.position.set(DECOR.fan.at[0], 0.01, DECOR.fan.at[1])
      o.rotation.set(0, 2.1, 0)
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
    if (lamp.current) lamp.current.intensity = 0.7 * f
  })
  // (the lantern itself, from Blender (blender/andon.py): a kumiko cube of pale hinoki, its washi drawn lit (unshaded, the same by day or
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
    return { r, paperMat }
  }, [gltf])
  useLayoutEffect(() => { (paper as { current: THREE.MeshBasicMaterial | null }).current = model.paperMat }, [model])
  // (the cube's middle, as modelled: 0.22 across on a thin base, drawn a quarter larger than that)
  const MID = 0.123, K = 1.25
  return (
    <group position={at} rotation-y={0.4} scale={LANTERN_SCALE} userData={{ container: 'lantern' }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '行燈', hint: lit ? '點一下點燈' : '點一下熄燈' }); setLit(!lit) }}
      onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; glowOnly(e.eventObject); setTip({ title: '行燈', hint: lit ? '點一下熄燈' : '點一下點燈' }) }}
      onPointerOut={(e) => { document.body.style.cursor = ''; glowLeave(e.eventObject); setTip(null) }}>
      <primitive object={model.r} scale={K} />
      {/* the flame inside, seen through the paper */}
      {/* (a soft glow, not a solid shape: a hard cone showing through the paper cut dark wedges across it) */}
      <sprite ref={flame} position={[0, MID * K * 0.85, 0]} scale={0.16}>
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
const SIDE_W = 1.35
/** pale cypress staves round the tub: twenty-four of them, each its own tone, fine grain running up and a knot or two, a dark joint between */
const STAVES = (() => {
  if (typeof document === 'undefined') return null
  const N = 24, SW = 16
  const c = document.createElement('canvas')
  c.width = N * SW
  c.height = 128
  const g = c.getContext('2d')!
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const tones = ['#ecd2a2', '#e3c593', '#f0d8ab', '#dfbf8c', '#e8cd9b', '#e1c28f', '#efd5a6', '#e5c898']
  for (let i = 0; i < N; i++) {
    g.fillStyle = tones[(i * 5) % tones.length]
    g.fillRect(i * SW, 0, SW, 128)
    // (the grain: long wavering lines, a few darker)
    for (let k = 0; k < 9; k++) {
      const x = i * SW + 1.5 + k * 1.6
      g.strokeStyle = rnd() < 0.25 ? 'rgba(120,76,36,0.4)' : 'rgba(150,100,50,0.22)'
      g.lineWidth = 0.6 + rnd() * 0.5
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + (rnd() - 0.5) * 3, 40, x + (rnd() - 0.5) * 3, 88, x + (rnd() - 0.5) * 2, 128)
      g.stroke()
    }
    // (a knot now and then, the grain bending round it)
    if (rnd() < 0.3) {
      const x = i * SW + 4 + rnd() * 8, y = 14 + rnd() * 100
      g.strokeStyle = 'rgba(110,70,30,0.55)'
      for (let r = 1; r <= 3; r++) { g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, y, 1.2 * r, 2.4 * r, 0, 0, Math.PI * 2); g.stroke() }
      g.fillStyle = 'rgba(90,56,24,0.6)'; g.beginPath(); g.ellipse(x, y, 1, 2, 0, 0, Math.PI * 2); g.fill()
    }
    // (a wet, darker foot where the tub has stood in water)
    const wet = g.createLinearGradient(0, 100, 0, 128)
    wet.addColorStop(0, 'rgba(120,80,40,0)'); wet.addColorStop(1, 'rgba(120,80,40,0.28)')
    g.fillStyle = wet; g.fillRect(i * SW, 100, SW, 28)
  }
  g.fillStyle = 'rgba(100,66,32,0.7)'
  for (let i = 0; i < N; i++) g.fillRect(i * SW, 0, 1.4, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(1, 1)
  t.anisotropy = 4
  return t
})()
/** a flat band of metal round the tub (a strip, not a rod): a lathe of a thin rectangle, its upper edge a little proud */
const flatBand = (R: number, h: number, t = 0.007) => new THREE.LatheGeometry([[R - t, -h / 2], [R, -h / 2], [R + 0.0025, 0], [R, h / 2], [R - t, h / 2], [R - t, -h / 2]].map(([x, y]) => new THREE.Vector2(x, y)), 72)
/** the tub's radius at a height up it (it widens toward the rim): what a hoop must stand clear of to lie on the staves, not sink in them */
const tubR = (y: number) => 0.255 + 0.015 * (y / 0.42)
/** steamed rice seen close: short plump grains, each with a soft shadow along one side, over warm white */
const RICE_GRAIN = (() => {
  if (typeof document === 'undefined') return null
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = '#efe6d2'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 1100; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 7 + rnd() * 3, w = 3.6 + rnd()
    for (const [ox, oy] of [[-S, 0], [0, 0], [S, 0], [0, -S], [0, S]]) {
      g.save()
      g.translate(x + ox, y + oy)
      g.rotate(a)
      g.fillStyle = 'rgba(150,128,90,0.35)'
      g.beginPath(); g.ellipse(0.9, 1.2, l, w, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = `rgb(${250 - rnd() * 8},${246 - rnd() * 10},${236 - rnd() * 14})`
      g.beginPath(); g.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2.2, 2.2)
  t.anisotropy = 4
  return t
})()
/** the heap of rice in the open tub: a low mound, lumpy, level with the rim at its edge, planar UVs for the grain */
const RICE_HEAP = (() => {
  const R = 0.252, h = 0.075
  const th = 2 * Math.atan(h / R)
  const Rs = R / Math.sin(th)
  const g = new THREE.SphereGeometry(Rs, 48, 18, 0, Math.PI * 2, 0, th)
  g.translate(0, -Rs * Math.cos(th), 0)
  const p = g.attributes.position, uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i)
    const edge = 1 - Math.min(1, Math.hypot(x, z) / R) ** 2
    p.setY(i, p.getY(i) + edge * (0.007 * Math.sin(x * 38 + z * 21) + 0.006 * Math.sin(z * 47 - x * 17) + 0.004 * Math.sin((x + z) * 71)))
    uv.setXY(i, x / (2 * R) + 0.5, z / (2 * R) + 0.5)
  }
  g.computeVertexNormals()
  return g
})()
/** a lug on the tub's side to lift it by: a rounded plate of wood with a hole through it */
const EAR = (() => {
  const sh = new THREE.Shape()
  const w = 0.05, h = 0.06, r = 0.022
  sh.moveTo(-w, -h + r); sh.lineTo(-w, h - r); sh.quadraticCurveTo(-w, h, -w + r, h); sh.lineTo(w - r, h); sh.quadraticCurveTo(w, h, w, h - r)
  sh.lineTo(w, -h + r); sh.quadraticCurveTo(w, -h, w - r, -h); sh.lineTo(-w + r, -h); sh.quadraticCurveTo(-w, -h, -w, -h + r)
  const hole = new THREE.Path()
  hole.absarc(0.012, 0.012, 0.017, 0, Math.PI * 2, true)
  sh.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 10 })
  g.translate(0, 0, -0.015)
  return g
})()
const RICE_GEO = {
  tub: new THREE.CylinderGeometry(0.27, 0.255, 0.42, 48, 1, true),
  lidTop: new THREE.CylinderGeometry(0.255, 0.285, 0.035, 32),
  ear: EAR,
  band: flatBand(tubR(0.3) + 0.0035, 0.03),
  band2: flatBand(tubR(0.2) + 0.0035, 0.03),
  bandWide: flatBand(tubR(0.07) + 0.0035, 0.045),
  lap: new THREE.BoxGeometry(0.004, 1, 0.035),
  floor: new THREE.CircleGeometry(0.25, 28),
  hoop: new THREE.TorusGeometry(0.272, 0.012, 6, 32),
  grain: new THREE.SphereGeometry(1, 7, 5),
  rice: new THREE.SphereGeometry(0.255, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.32),
  cylRice: new THREE.CylinderGeometry(0.258, 0.248, 0.44, 28, 1, false),
  lid: new THREE.CylinderGeometry(0.29, 0.29, 0.03, 28),
  paddle: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
  blade: new THREE.SphereGeometry(0.06, 12, 8),
  slab: new THREE.BoxGeometry(1, 1, 1),
  bowl: new THREE.SphereGeometry(0.11, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
}
/**
 * The rice the rice balls are shaped from (おひつ): a big round tub of pale sawara bound with copper hoops, heaped with
 * steaming white rice, the wooden paddle (しゃもじ) stood in it, on a plain side table of its own (作業台); its lid and
 * a stack of rice bowls on the shelf under it.
 */
function RiceTub() {
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
    lid.current.position.set(-0.32 * k, 0.4375 - 0.1585 * k + Math.sin(k * Math.PI) * 0.22, 0)
    lid.current.rotation.z = k * 1.36
  })
  const g = RICE_GEO
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const legH = SIDE_TOP - 0.05 - floor
  return (
    <group position={[x, 0, z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      {/* the table: a thick top, four square legs, a shelf low between them */}
      <mesh geometry={g.slab} position-y={SIDE_TOP - 0.025} scale={[SIDE_W, 0.05, SIDE_W]} castShadow receiveShadow>
        <meshToonMaterial color="#b98a58" />
      </mesh>
      <mesh geometry={g.slab} position-y={SIDE_TOP - 0.025} scale={[SIDE_W * 1.015, 0.065, SIDE_W * 1.015]}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, k]) => (
        <mesh key={`${i}${k}`} geometry={g.slab} position={[i * (SIDE_W / 2 - 0.08), floor + legH / 2, k * (SIDE_W / 2 - 0.08)]} scale={[0.09, legH, 0.09]}>
          <meshToonMaterial color="#7a5434" />
        </mesh>
      ))}
      <mesh geometry={g.slab} position-y={floor + 0.28} scale={[SIDE_W - 0.12, 0.035, SIDE_W - 0.12]} receiveShadow>
        <meshToonMaterial color="#9a7046" />
      </mesh>
      {/* on the shelf: the rice bowls, stacked upside down */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={g.bowl} position={[0.5, floor + 0.3 + k * 0.07, 0.35]} rotation-x={Math.PI} scale={[1.6, 1.4, 1.6]}>
          <meshToonMaterial color="#e8e2d2" />
        </mesh>
      ))}
      <group position-y={SIDE_TOP} scale={RICE_SCALE}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; glowOnly(e.eventObject); setTip({ title: '飯桶', hint: open ? '點一下蓋上蓋子' : '點一下掀開蓋子' }) }}
        onPointerOut={(e) => { document.body.style.cursor = ''; glowLeave(e.eventObject); setTip(null) }}>
        {/* the tub: pale staves, an ear at each side to lift it by, a band of woven cane round the lower body, and its lid (a bar across
            the top) */}
        <Inked geometry={g.tub} color="#ffffff" map={STAVES} position={[0, 0.21, 0]} grow={1.03} />
        {/* (hollow: its inside wall and floor, so the rice fills it rather than lying on a lid) */}
        <mesh geometry={g.tub} position-y={0.21} scale={0.985}><meshToonMaterial color="#b88f58" side={THREE.BackSide} /></mesh>
        <mesh geometry={g.floor} position-y={0.012} rotation-x={-Math.PI / 2}><meshToonMaterial color="#b88f58" /></mesh>
        <group ref={lid} position={[0, 0.4375, 0]}>
          <Inked geometry={g.lidTop} color="#ffffff" map={STAVES} grow={1.05} />
          {/* (the lid's grain: rings turned into the top, and a pale edge band) */}
          {[0.1, 0.17, 0.225].map((r) => <mesh key={r} position-y={0.0182} rotation-x={Math.PI / 2}><torusGeometry args={[r, 0.0011, 4, 40]} /><meshToonMaterial color="#b8955c" /></mesh>)}
          <mesh position-y={0.0} rotation-x={Math.PI / 2}><torusGeometry args={[0.285, 0.004, 4, 40]} /><meshToonMaterial color="#c8a86e" /></mesh>
          <mesh geometry={g.slab} position={[0, 0.0375, 0]} scale={[0.22, 0.03, 0.05]} castShadow><meshToonMaterial color="#e0a868" /></mesh>
          <mesh geometry={g.slab} position={[0, 0.022, 0]} scale={[0.19, 0.03, 0.03]}><meshToonMaterial color="#d09858" /></mesh>
        </group>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.292, 0.355, 0]} rotation-y={sd > 0 ? 0 : Math.PI} rotation-z={0}>
            <Inked geometry={g.ear} color="#e9cf9e" grow={1.08} />
            {/* (a loop of cord through the hole) */}
            <mesh position={[0.012, 0.012, 0]} rotation-x={0}><torusGeometry args={[0.019, 0.0045, 5, 14]} /><meshToonMaterial color="#8a6a3c" /></mesh>
          </group>
        ))}
        {/* the copper hoops: three flat bands (a wide one low, a narrow pair above), each riveted at its lap, a foot ring below, a lip of dark wood at the rim */}
        {[[0.07, 'bandWide'], [0.2, 'band2'], [0.3, 'band']].map(([y, kind], k) => (
          <group key={k} position-y={y as number}>
            <mesh geometry={g[kind as 'band' | 'band2' | 'bandWide']}><meshToonMaterial color={k === 0 ? '#b8743a' : '#c58a4a'} /></mesh>
            {/* (where the strip's two ends overlap: a paler seam, standing a hair proud of the band) */}
            <mesh geometry={g.lap} position={[(tubR(y as number) + 0.0075) * Math.cos(0.5), 0, (tubR(y as number) + 0.0075) * Math.sin(0.5)]}
              rotation-y={-0.5} scale={[1, k === 0 ? 0.045 : 0.03, 1]}><meshToonMaterial color="#d9a066" /></mesh>
          </group>
        ))}
        <mesh position-y={0.012} rotation-x={Math.PI / 2}><torusGeometry args={[0.26, 0.012, 6, 36]} /><meshToonMaterial color="#c7a56c" /></mesh>
        <mesh position-y={0.4175} rotation-x={Math.PI / 2}><torusGeometry args={[0.2645, 0.0075, 6, 40]} /><meshToonMaterial color="#d8b87c" /></mesh>
        {open && (
          <>
            {/* the rice, heaped level with the rim and mounded a little in the middle, the paddle stood in it */}
            <mesh geometry={g.cylRice} position-y={0.2} scale={[1, 0.91, 1]}>
              <meshToonMaterial color="#f6f0e2" />
            </mesh>
            <mesh geometry={RICE_HEAP} position-y={0.41}>
              <meshToonMaterial color="#ffffff" map={RICE_GRAIN} emissive="#4d4535" />
            </mesh>
            <group position={[0.08, 0.55, -0.04]} rotation={[0.25, 0, -0.35]}>
              <mesh geometry={g.paddle} position-y={0.06}><meshToonMaterial color="#e2c89a" /></mesh>
              <mesh geometry={g.blade} position-y={-0.12} scale={[1, 1.3, 0.25]}><meshToonMaterial color="#e2c89a" /></mesh>
            </group>
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
const CUTFISH_URL = import.meta.env.BASE_URL + 'models/cut_fish.glb'
/**
 * The ingredient freezer: a wide chest freezer lying along the kitchen's back wall by the staff door, pale blue-white on a dark plinth, its
 * hinged lid on the back edge with a chrome handle, a compressor housing at its right end (vent louvres, a dial and a red lamp), and a plate
 * on its front that says 食材. Its lid swings up for a moment each time something is brought out of it for an order, a cool light spilling
 * out over the frozen packs inside, and on the housing's top lies the cut fish (the downloaded hand-painted model, kept in its own colours).
 */
function IngredientFridge() {
  const lid = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const gltf = useGLTF(CUTFISH_URL) as unknown as { scene: THREE.Group }
  const fish = useMemo(() => {
    const root = gltf.scene.clone(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      // (its painted colours as they are: the map straight into a toon material, no tint, so its soft airbrushed shading survives)
      m.material = new THREE.MeshToonMaterial({ color: '#ffffff', map: src.map ?? null })
      m.castShadow = true
    })
    const b = new THREE.Box3().setFromObject(root)
    const d = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3())
    const k = 0.5 / Math.max(d.x, d.z)
    const wrap = new THREE.Group()
    root.position.set(-c.x, -b.min.y, -c.z)
    wrap.add(root)
    wrap.scale.setScalar(k)
    return wrap
  }, [gltf])
  useFrame(() => {
    const open = performance.now() - FRIDGE_KICK.at < 1800 ? 1 : 0
    // (the lid hinged on its back edge, swinging up and over)
    if (lid.current) lid.current.rotation.x += ((-open * 1.85) - lid.current.rotation.x) * 0.1
    if (light.current) light.current.intensity += (open * 1.1 - light.current.intensity) * 0.12
  })
  // (its size: along the wall, deep, and tall as a worktop; the compressor housing takes the right-hand end)
  const W = 1.5, D = 0.74, H = 0.86, HOUSE = 0.34, PLINTH = 0.1, WALL = 0.05, LID = 0.09
  const BODY = '#dce9f1', DARK = '#46576a', INNER = '#eef6fb'
  const STEEL = '#cdd5db'
  const LW = W - HOUSE
  // (the frozen packs inside: blocks and trays in cool whites and blues, heaped in the cavity)
  const packs = useMemo(() => {
    let seed = 5
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const tones = ['#f2f8fc', '#cfe3f1', '#e4eef6', '#bcd6ea', '#f8fbfd']
    return Array.from({ length: 16 }, (_, i) => ({
      p: [(rnd() - 0.5) * (LW - 0.3), PLINTH + 0.1 + Math.floor(i / 8) * 0.07 + 0.03, (rnd() - 0.5) * (D - 0.25)] as [number, number, number],
      s: [0.14 + rnd() * 0.12, 0.06 + rnd() * 0.03, 0.12 + rnd() * 0.08] as [number, number, number], r: (rnd() - 0.5) * 0.5, c: tones[i % tones.length],
    }))
  }, [LW])
  return (
    <group>
      {/* the plinth, and the cabinet's four walls and floor round the cavity */}
      <mesh position={[0, PLINTH / 2, 0]}><boxGeometry args={[W - 0.04, PLINTH, D - 0.04]} /><meshToonMaterial color={DARK} /></mesh>
      <mesh position={[-HOUSE / 2, PLINTH + 0.03, 0]}><boxGeometry args={[LW - 0.02, 0.06, D - 0.02]} /><meshToonMaterial color={INNER} /></mesh>
      {/* (front and back walls, left end, and the wall between the cavity and the housing) */}
      <mesh position={[-HOUSE / 2, (H - LID + PLINTH) / 2, D / 2 - WALL / 2]} castShadow><boxGeometry args={[LW, H - LID - PLINTH, WALL]} /><meshToonMaterial color={BODY} /></mesh>
      <mesh position={[-HOUSE / 2, (H - LID + PLINTH) / 2, -D / 2 + WALL / 2]}><boxGeometry args={[LW, H - LID - PLINTH, WALL]} /><meshToonMaterial color={BODY} /></mesh>
      <mesh position={[-W / 2 + WALL / 2, (H - LID + PLINTH) / 2, 0]} castShadow><boxGeometry args={[WALL, H - LID - PLINTH, D]} /><meshToonMaterial color={BODY} /></mesh>
      <mesh position={[W / 2 - HOUSE, (H - LID + PLINTH) / 2, 0]}><boxGeometry args={[WALL, H - LID - PLINTH, D]} /><meshToonMaterial color={INNER} /></mesh>
      {/* (the inside faces, paler, seen when the lid is up) */}
      <mesh position={[-HOUSE / 2, (H - LID + PLINTH) / 2, D / 2 - WALL - 0.002]} rotation-y={Math.PI}><planeGeometry args={[LW - 0.1, H - LID - PLINTH]} /><meshToonMaterial color={INNER} /></mesh>
      <mesh position={[-HOUSE / 2, (H - LID + PLINTH) / 2, -D / 2 + WALL + 0.002]}><planeGeometry args={[LW - 0.1, H - LID - PLINTH]} /><meshToonMaterial color={INNER} /></mesh>
      {/* (the frozen packs) */}
      <group position={[-HOUSE / 2, 0, 0]}>
        {packs.map((k, i) => <mesh key={i} position={k.p} rotation-y={k.r}><boxGeometry args={k.s} /><meshToonMaterial color={k.c} /></mesh>)}
      </group>
      {/* the chrome rim all round the opening, and the gasket's dark line inside it */}
      <mesh position={[-HOUSE / 2, H - LID - 0.006, 0]}><boxGeometry args={[LW + 0.03, 0.012, D + 0.03]} /><meshToonMaterial color={STEEL} /></mesh>
      {/* the compressor housing at the right end: a solid block, a top of its own, louvres, a dial and a lamp on its front */}
      <mesh position={[W / 2 - HOUSE / 2, (H + PLINTH) / 2, 0]} castShadow><boxGeometry args={[HOUSE, H - PLINTH, D]} /><meshToonMaterial color={BODY} /></mesh>
      <mesh position={[W / 2 - HOUSE / 2, H + 0.006, 0]}><boxGeometry args={[HOUSE + 0.02, 0.014, D + 0.02]} /><meshToonMaterial color={STEEL} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((k) => <mesh key={k} position={[W / 2 - HOUSE / 2, 0.22 + k * 0.034, D / 2 + 0.003]}><boxGeometry args={[0.22, 0.012, 0.006]} /><meshToonMaterial color={DARK} /></mesh>)}
      <mesh position={[W / 2 - HOUSE / 2 + 0.07, 0.58, D / 2 + 0.012]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.026, 0.028, 0.02, 16]} /><meshToonMaterial color="#2c3640" /></mesh>
      <mesh position={[W / 2 - HOUSE / 2 + 0.07, 0.58, D / 2 + 0.023]}><boxGeometry args={[0.004, 0.034, 0.002]} /><meshBasicMaterial color="#f4f1e6" /></mesh>
      <mesh position={[W / 2 - HOUSE / 2 - 0.07, 0.58, D / 2 + 0.008]}><sphereGeometry args={[0.011, 10, 8]} /><meshBasicMaterial color="#ff4a3a" toneMapped={false} /></mesh>
      {/* the lid, hinged along its back edge: a thick slab with a chrome handle at the front and a lock, its underside's gasket dark */}
      <group ref={lid} position={[-HOUSE / 2, H - LID, -D / 2]}>
        <mesh position={[0, LID / 2, D / 2]} castShadow><boxGeometry args={[LW, LID, D]} /><meshToonMaterial color="#eaf3f9" /></mesh>
        <mesh position={[0, LID / 2 - 0.02, D / 2]}><boxGeometry args={[LW + 0.012, 0.012, D + 0.012]} /><meshToonMaterial color={STEEL} /></mesh>
        {/* (the underside: a pale liner with the gasket's dark line all round its edge) */}
        <mesh position={[0, 0.003, D / 2]}><boxGeometry args={[LW - 0.06, 0.006, D - 0.06]} /><meshToonMaterial color="#e4eef5" /></mesh>
        {[-1, 1].map((sd) => <mesh key={`a${sd}`} position={[0, 0.0045, D / 2 + sd * (D / 2 - 0.045)]}><boxGeometry args={[LW - 0.06, 0.008, 0.016]} /><meshToonMaterial color="#2a3138" /></mesh>)}
        {[-1, 1].map((sd) => <mesh key={`b${sd}`} position={[sd * (LW / 2 - 0.045), 0.0045, D / 2]}><boxGeometry args={[0.016, 0.008, D - 0.06]} /><meshToonMaterial color="#2a3138" /></mesh>)}
        <mesh position={[0, LID * 0.62, D - 0.03]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.011, 0.011, 0.5, 10]} /><meshToonMaterial color={STEEL} /></mesh>
        {[-0.22, 0.22].map((x) => <mesh key={x} position={[x, LID * 0.62, D - 0.014]}><boxGeometry args={[0.02, 0.03, 0.028]} /><meshToonMaterial color={STEEL} /></mesh>)}
        <mesh position={[LW / 2 - 0.1, LID * 0.5, D + 0.002]}><boxGeometry args={[0.03, 0.03, 0.006]} /><meshToonMaterial color="#8a8e92" /></mesh>
        {/* (the two hinges at the back) */}
        {[-LW / 2 + 0.16, LW / 2 - 0.16].map((x) => <mesh key={x} position={[x, LID / 2, -0.004]}><boxGeometry args={[0.1, 0.05, 0.012]} /><meshToonMaterial color="#8a8e92" /></mesh>)}
      </group>
      <pointLight ref={light} position={[-HOUSE / 2, H - 0.12, 0.15]} color="#cfe9ff" intensity={0} distance={2.4} decay={1.6} />
      {/* the cut fish on the housing's top, laid across it */}
      <group position={[W / 2 - HOUSE / 2, H + 0.014, 0]} rotation-y={Math.PI / 2 + 0.2}><primitive object={fish} /></group>
    </group>
  )
}
/** where it stands on the kitchen floor (along the first counter, across it): lying along the back wall, just to the cooks' side of the staff door, its back to the wall */
const FRIDGE_AT = { along: 3.4, lay: 5.05 }
function FridgeAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, FRIDGE_AT.along).addScaledVector(LAY, FRIDGE_AT.lay)
  // (its front, local +z, toward the room, and its length along the wall: local x runs along the first counter)
  return <Movable id="freezer" label="冷藏櫃" baseScale={1.6}><group name="look-freezer" position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><IngredientFridge /></group></Movable>
}
const RACK_AT = { along: 2.0, lay: 5.05 }
function RackAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, RACK_AT.along).addScaledVector(LAY, RACK_AT.lay)
  return <Movable id="platerack" label="碗盤櫃架" baseScale={1.03}><group name="look-back" position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><PlateRack /></group></Movable>
}
export function Decor({ held, lanternAt }: { held: RefObject<Held>; lanternAt: [number, number, number] }) {
  return (
    <>
      <Movable id="crate" label="備長炭籃" baseScale={1.75} baseTurn={[0, 44, 0]}><Crate /></Movable>
      <Movable id="fan" label="團扇"><Fan held={held} /></Movable>
      <HeldStick held={held} />
      <Movable id="lantern" label="行燈" baseTurn={[0, -12, 0]}><Lantern at={lanternAt} /></Movable>
      <Movable id="ricetub" label="飯桶"><RiceTub /></Movable>
      <group position={[0, 0, 0]}><FridgeAt /><RackAt /></group>
    </>
  )
}
