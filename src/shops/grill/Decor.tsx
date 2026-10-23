// What stands about the grill besides the dishes: a crate of binchotan (a stick dragged from it onto the fire adds
// charcoal), a paper fan by the seasonings (waved over the fire, it fans the coals up), and a paper floor lantern (行燈)
// glowing behind the stones, which can be moved about like the dishes. Roasting does the carrying (see held); what's dragged across the table is pushed clear of
// them like anything else (DECOR is their footprint, for its settle()).
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { ALONG, GRILL_OFFSET, KITCHEN_DROP, LAY } from './bar'
import { Movable } from './Movable'
import { binchotanGeo, binchotanMap } from './Binchotan'

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

/** pale cedar planks with a few grain lines */
const CRATE_WOOD = canvas(256, 128, (g) => {
  g.fillStyle = '#c99a62'
  g.fillRect(0, 0, 256, 128)
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 128
    g.strokeStyle = `rgba(110,70,35,${0.12 + Math.random() * 0.2})`
    g.lineWidth = 1 + Math.random() * 1.5
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3)
    g.stroke()
  }
})

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

/** A wooden crate of white binchotan, its label on the front, the sticks heaped inside it. */
function Crate() {
  const W = 0.62, D = 0.36, H = 0.2, T = 0.02
  const geo = useMemo(() => ({
    side: new THREE.BoxGeometry(W, H, T),
    end: new THREE.BoxGeometry(T, H, D - 2 * T),
    floor: new THREE.BoxGeometry(W - 2 * T, T, D - 2 * T),
    label: new THREE.PlaneGeometry(0.1, 0.17),
    stick: new THREE.CylinderGeometry(0.022, 0.024, W - 0.08, 7),
  }), [])
  // (each stick of the crate its own length (from a hand's breadth short of the crate's to its full) and thickness)
  const stickGeos = useMemo(() => Array.from({ length: 24 }, (_, k) => binchotanGeo(0.34 + ((k * 37) % 21) * 0.0095, 0.024 + ((k * 7) % 5) * 0.0018, k)), [])
  // the sticks heaped in rows, each turned and tilted a little differently
  const sticks = useMemo(() => {
    const out: { p: [number, number, number]; r: [number, number, number] }[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let row = 0; row < 3; row++) {
      const n = 6 - row
      for (let k = 0; k < n; k++) {
        const z = (k - (n - 1) / 2) * 0.05
        out.push({ p: [(rnd() - 0.5) * 0.04, T + 0.025 + row * 0.04, z], r: [rnd() * 3, (rnd() - 0.5) * 0.12, Math.PI / 2] })
      }
    }
    // two more laid along the top of the heap, inside the box (a stick is W - 0.08 long, the box's inside W - 0.04: none goes past
    // the ends, none stands above the rim)
    out.push({ p: [0, T + 0.025 + 3 * 0.04 + 0.012, 0.035], r: [0.6, 0.04, Math.PI / 2] })
    out.push({ p: [0.01, T + 0.025 + 3 * 0.04 + 0.012, -0.045], r: [2.1, -0.03, Math.PI / 2] })
    return out
  }, [])
  const wood = CRATE_WOOD
  return (
    <group position={[DECOR.crate.at[0], 0, DECOR.crate.at[1]]} rotation-y={-0.35} userData={{ decor: 'charcoal' }}>
      <Inked geometry={geo.side} map={wood} position={[0, H / 2, D / 2 - T / 2]}>
        {/* the label faces out of the front */}
        <mesh geometry={geo.label} position={[0.17, 0, T / 2 + 0.002]}>
          <meshToonMaterial map={CRATE_LABEL} />
        </mesh>
      </Inked>
      <Inked geometry={geo.side} map={wood} position={[0, H / 2, -D / 2 + T / 2]} />
      <Inked geometry={geo.end} map={wood} position={[W / 2 - T / 2, H / 2, 0]} />
      <Inked geometry={geo.end} map={wood} position={[-W / 2 + T / 2, H / 2, 0]} />
      <mesh geometry={geo.floor} position={[0, T / 2, 0]} receiveShadow>
        <meshToonMaterial map={wood} />
      </mesh>
      {sticks.map((s, i) => (
        <Inked key={i} geometry={stickGeos[(i * 5 + 3) % stickGeos.length]} map={binchotanMap()} grow={1.07} sideOnly position={s.p} rotation={s.r} />
      ))}
    </group>
  )
}

/** A round paper fan (団扇) lying by the seasoning boxes; picked up, it's held upright and swings as it's waved. */
function Fan({ held }: { held: RefObject<Held> }) {
  const g = useRef<THREE.Group>(null)
  const swing = useRef(0)
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    const h = held.current
    if (h?.kind === 'fan') {
      o.position.copy(h.at)
      swing.current += (Math.sin(h.wave * 6) * 0.55 - swing.current) * Math.min(1, dt * 14)
      // face to the camera's side, handle down, rocking side to side as it fans
      o.rotation.set(1.45, -0.6, swing.current)
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

/** washi on the lantern: warm, a little uneven, a faint grid of the frame's cross-bars behind it */
const LANTERN_PAPER = canvas(128, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#ffe2a8')
  grad.addColorStop(0.55, '#ffd48a')
  grad.addColorStop(1, '#f4b868')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(180,120,60,${Math.random() * 0.08})`
    g.fillRect(Math.random() * 128, Math.random() * 256, 2 + Math.random() * 6, 1)
  }
  g.fillStyle = 'rgba(70,40,20,0.2)'
  g.fillRect(0, 84, 128, 3)
  g.fillRect(0, 170, 128, 3)
  g.fillRect(62, 0, 3, 256)
})

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
 * flickering light on what's near.
 */
const LANTERN_SCALE = 1.8
function Lantern({ at }: { at: [number, number, number] }) {
  const paper = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.Sprite>(null)
  const flame = useRef<THREE.Sprite>(null)
  const lamp = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // a flame's flicker: a slow breath and a quicker shiver, never quite repeating
    const f = 0.88 + 0.07 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.9 + 1.3) + 0.03 * Math.sin(t * 17.1)
    if (paper.current) paper.current.color.setScalar(f)
    if (halo.current) {
      halo.current.material.opacity = 0.55 + (f - 0.88) * 2.2
      halo.current.scale.setScalar(0.95 + (f - 0.88) * 0.6)
    }
    if (flame.current) flame.current.scale.setScalar(0.22 * (0.9 + (f - 0.88) * 1.8))
    if (lamp.current) lamp.current.intensity = 0.7 * f
  })
  const S = 0.2, H = 0.36, LEG = 0.16
  const geo = useMemo(() => ({
    post: new THREE.BoxGeometry(0.022, H + LEG + 0.04, 0.022),
    rail: new THREE.BoxGeometry(S + 0.03, 0.02, 0.02),
    shade: new THREE.BoxGeometry(S, H, S),
    shelf: new THREE.BoxGeometry(S, 0.012, S),
    handle: new THREE.TorusGeometry(S * 0.35, 0.008, 6, 20, Math.PI),
  }), [])
  const posts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * S / 2, b * S / 2] as const)
  const top = LEG + H
  return (
    <group position={at} rotation-y={0.4} scale={LANTERN_SCALE} userData={{ container: 'lantern' }}>
      {posts.map(([x, z], i) => (
        <Inked key={i} geometry={geo.post} color="#3a2416" grow={1.12} position={[x, (H + LEG + 0.04) / 2, z]} />
      ))}
      {/* rails top and bottom of the shade, both ways */}
      {[LEG, top].flatMap((y) => [0, 1].flatMap((turn) => [-1, 1].map((side) => (
        <Inked key={`${y}-${turn}-${side}`} geometry={geo.rail} color="#3a2416" grow={1.1}
          position={turn ? [side * S / 2, y, 0] : [0, y, side * S / 2]} rotation={[0, turn * Math.PI / 2, 0]} />
      ))))}
      {/* the lit paper: unshaded, it glows the same by day or night */}
      <mesh geometry={geo.shade} position={[0, LEG + H / 2, 0]}>
        <meshBasicMaterial ref={paper} map={LANTERN_PAPER} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.shelf} position={[0, LEG * 0.45, 0]}>
        <meshToonMaterial color="#4a2e1c" />
      </mesh>
      <mesh geometry={geo.handle} position={[0, top + 0.02, 0]}>
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      {/* the flame inside, seen through the paper */}
      {/* (a soft glow, not a solid shape: a hard cone showing through the paper cut dark wedges across it) */}
      <sprite ref={flame} position={[0, LEG + H * 0.4, 0]} scale={0.22}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.7} color="#ffcf80" />
      </sprite>
      {/* the glow round it, always facing the camera, laid on additively */}
      <sprite ref={halo} position={[0, LEG + H / 2, 0]} scale={0.95}>
        <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
      </sprite>
      {QUALITY.tier === 'high' && <pointLight ref={lamp} position={[0, LEG + H / 2, 0]} color="#ffb060" intensity={0.7} distance={1.8} decay={2} />}
    </group>
  )
}

/** the stick of binchotan being carried from the crate to the fire */
function HeldStick({ held }: { held: RefObject<Held> }) {
  const g = useRef<THREE.Group>(null)
  const geo = useMemo(() => binchotanGeo(0.5, 0.03, 7), [])
  useFrame(() => {
    const o = g.current
    if (!o) return
    const h = held.current
    o.visible = h?.kind === 'charcoal'
    if (o.visible) o.position.copy(h!.at)
  })
  return (
    <group ref={g} visible={false} rotation={[0.3, 0.4, Math.PI / 2]}>
      <Inked geometry={geo} map={binchotanMap()} grow={1.07} sideOnly />
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
/** pale cypress staves round the tub, each its own tone, fine grain running up, a dark joint between */
const STAVES = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const g = c.getContext('2d')!
  const tones = ['#ecd2a2', '#e3c593', '#f0d8ab', '#dfbf8c', '#e8cd9b', '#e1c28f', '#efd5a6', '#e5c898']
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i]
    g.fillRect(i * 16, 0, 16, 64)
    g.strokeStyle = 'rgba(150,100,50,0.28)'
    g.lineWidth = 1
    for (let k = 0; k < 5; k++) {
      g.beginPath()
      g.moveTo(i * 16 + 2 + k * 3, 0)
      g.bezierCurveTo(i * 16 + 3 + k * 3, 20, i * 16 + 1 + k * 3, 44, i * 16 + 2 + k * 3, 64)
      g.stroke()
    }
  }
  g.fillStyle = 'rgba(120,80,40,0.55)'
  for (let i = 0; i < 8; i++) g.fillRect(i * 16, 0, 1, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(2, 1)
  return t
})()
const RICE_GEO = {
  tub: new THREE.CylinderGeometry(0.27, 0.255, 0.42, 32, 1, true),
  lidTop: new THREE.CylinderGeometry(0.255, 0.285, 0.035, 32),
  ear: new THREE.BoxGeometry(0.1, 0.12, 0.05),
  band: new THREE.TorusGeometry(0.268, 0.01, 6, 40),
  floor: new THREE.CircleGeometry(0.25, 28),
  hoop: new THREE.TorusGeometry(0.272, 0.012, 6, 32),
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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; glowOnly(e.eventObject) }}
        onPointerOut={() => { document.body.style.cursor = ''; glowOnly(null) }}>
        {/* the tub: pale staves, an ear at each side to lift it by, a band of woven cane round the lower body, and its lid (a bar across
            the top) */}
        <Inked geometry={g.tub} color="#ffffff" map={STAVES} position={[0, 0.21, 0]} grow={1.03} />
        {/* (hollow: its inside wall and floor, so the rice fills it rather than lying on a lid) */}
        <mesh geometry={g.tub} position-y={0.21} scale={0.985}><meshToonMaterial color="#b88f58" side={THREE.BackSide} /></mesh>
        <mesh geometry={g.floor} position-y={0.012} rotation-x={-Math.PI / 2}><meshToonMaterial color="#b88f58" /></mesh>
        <group ref={lid} position={[0, 0.4375, 0]}>
          <Inked geometry={g.lidTop} color="#ffffff" map={STAVES} grow={1.05} />
          <mesh geometry={g.slab} position={[0, 0.0375, 0]} scale={[0.22, 0.03, 0.05]} castShadow><meshToonMaterial color="#e0a868" /></mesh>
          <mesh geometry={g.slab} position={[0, 0.022, 0]} scale={[0.19, 0.03, 0.03]}><meshToonMaterial color="#d09858" /></mesh>
        </group>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.285, 0.365, 0]} rotation-z={-sd * 0.22}>
            <Inked geometry={g.ear} color="#ffffff" map={STAVES} grow={1.06} />
          </group>
        ))}
        {[0.1, 0.12, 0.14].map((y, k) => (
          <mesh key={y} geometry={g.band} position-y={y} rotation={[Math.PI / 2 + (k - 1) * 0.05, 0, 0]}>
            <meshToonMaterial color={k === 1 ? '#c2a368' : '#a98a52'} />
          </mesh>
        ))}
        {open && (
          <>
            {/* the rice, heaped a little over the rim, the paddle stood in it */}
            <mesh geometry={g.cylRice} position-y={0.21}>
              <meshToonMaterial color="#fbf8f0" />
            </mesh>
            <mesh geometry={g.rice} position-y={0.338} scale={[1.17, 0.6, 1.17]}>
              <meshToonMaterial color="#fbf8f0" />
            </mesh>
            <group position={[0.08, 0.57, -0.04]} rotation={[0.25, 0, -0.35]}>
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
  const BODY = '#dce9f1', TRIM = '#b6cad8', DARK = '#46576a', INNER = '#eef6fb'
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
      {/* (the front's plate: 食材, a thin trim round the cabinet's foot, and the bottom edge's shadow line) */}
      <mesh position={[-W / 2 + 0.34, 0.5, D / 2 + 0.003]}><planeGeometry args={[0.46, 0.17]} /><meshBasicMaterial map={FRIDGE_SIGN} toneMapped={false} /></mesh>
      <mesh position={[-HOUSE / 2, PLINTH + 0.005, 0]}><boxGeometry args={[W + 0.01, 0.012, D + 0.01]} /><meshToonMaterial color={TRIM} /></mesh>
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
const FRIDGE_SIGN = canvas(184, 64, (g) => {
  g.fillStyle = '#f4f8fb'
  g.fillRect(0, 0, 184, 64)
  g.strokeStyle = '#3f7ca8'
  g.lineWidth = 4
  g.strokeRect(3, 3, 178, 58)
  brushText(g, '食材', 92, 34, 40, { fill: '#2a5a80', spacing: 8 })
})
/** where it stands on the kitchen floor (along the first counter, across it): lying along the back wall, just to the cooks' side of the staff door, its back to the wall */
const FRIDGE_AT = { along: 3.4, lay: 5.05 }
function FridgeAt() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const p = new THREE.Vector3().addScaledVector(ALONG, FRIDGE_AT.along).addScaledVector(LAY, FRIDGE_AT.lay)
  // (its front, local +z, toward the room, and its length along the wall: local x runs along the first counter)
  return <Movable id="freezer" label="食材冷凍櫃"><group position={[p.x, floor, p.z]} rotation-y={Math.atan2(-LAY.x, -LAY.z)}><IngredientFridge /></group></Movable>
}
export function Decor({ held, lanternAt }: { held: RefObject<Held>; lanternAt: [number, number, number] }) {
  return (
    <>
      <Crate />
      <Fan held={held} />
      <HeldStick held={held} />
      <Lantern at={lanternAt} />
      <RiceTub />
      <group position={[0, 0, 0]}><FridgeAt /></group>
    </>
  )
}
