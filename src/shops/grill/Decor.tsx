// What stands about the grill besides the dishes: a crate of binchotan (a stick dragged from it onto the fire adds
// charcoal), a paper fan by the seasonings (waved over the fire, it fans the coals up), and a paper floor lantern (行燈)
// glowing behind the stones, which can be moved about like the dishes. Roasting does the carrying (see held); what's dragged across the table is pushed clear of
// them like anything else (DECOR is their footprint, for its settle()).
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from '@/scene/quality'
import { Steam } from '@/scene/Steam'
import { brushText, signTexture } from '@/scene/signFont'
import { ALONG, GRILL_OFFSET } from './bar'

type Spot = { at: [number, number]; r: number }
/** where each one stands (x, z) and how much room it takes */
export const DECOR = {
  crate: { at: [0.62, -2.0], r: 0.38 },
  // (lying on the table by the seasoning boxes, at their front end)
  fan: { at: [-0.62, 1.85], r: 0.3 },
  // (drawn 1.8 times its own size, behind the fire's stones, clear of the plate stacks and the bucket on the left)
  lantern: { at: [-0.45, -2.5], r: 0.34 },
  // (the cooked rice the rice balls are made from: a shop's big tub, on a side table of its own just past the cook's
  // table's right-hand end, by the other cooks)
  rice: { at: [4.93, -0.12], r: 1.1 },
} satisfies Record<string, Spot>

/** what's being carried from here: a stick of charcoal or the fan, where it is (Roasting sets it), and how far the
 * fan has been waved (it swings with it) */
export type Held = { kind: 'charcoal' | 'fan'; at: THREE.Vector3; wave: number } | null

const INK = '#3b2a20'

/** a mesh with the shop's ink outline: the same shape again, a little bigger, drawn inside out */
function Inked({ geometry, color, map, grow = 1.04, position, rotation, children }: {
  geometry: THREE.BufferGeometry; color?: string; map?: THREE.Texture | null; grow?: number
  position?: [number, number, number]; rotation?: [number, number, number]; children?: ReactNode
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color={color ?? '#ffffff'} map={map ?? null} />
      </mesh>
      <mesh geometry={geometry} scale={grow}>
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

/** A wooden crate of white binchotan, its label on the front, a few sticks leaning out. */
function Crate() {
  const W = 0.62, D = 0.36, H = 0.2, T = 0.02
  const geo = useMemo(() => ({
    side: new THREE.BoxGeometry(W, H, T),
    end: new THREE.BoxGeometry(T, H, D - 2 * T),
    floor: new THREE.BoxGeometry(W - 2 * T, T, D - 2 * T),
    label: new THREE.PlaneGeometry(0.1, 0.17),
    stick: new THREE.CylinderGeometry(0.022, 0.024, W - 0.08, 7),
  }), [])
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
    // two pulled half out, resting on the rim
    out.push({ p: [0.1, H + 0.02, 0.04], r: [0, 0.3, Math.PI / 2 - 0.28] })
    out.push({ p: [-0.06, H + 0.01, -0.06], r: [0, -0.5, Math.PI / 2 + 0.22] })
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
        <Inked key={i} geometry={geo.stick} color="#8d8a86" grow={1.08} position={s.p} rotation={s.r} />
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
  g.fillStyle = 'rgba(70,40,20,0.35)'
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
  const flame = useRef<THREE.Mesh>(null)
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
    if (flame.current) flame.current.scale.set(1, 0.85 + (f - 0.88) * 2.5, 1)
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
        <meshBasicMaterial ref={paper} map={LANTERN_PAPER} toneMapped={false} transparent opacity={0.94} />
      </mesh>
      <mesh geometry={geo.shelf} position={[0, LEG * 0.45, 0]}>
        <meshToonMaterial color="#4a2e1c" />
      </mesh>
      <mesh geometry={geo.handle} position={[0, top + 0.02, 0]}>
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      {/* the flame inside, seen through the paper */}
      <mesh ref={flame} position={[0, LEG + H * 0.38, 0]}>
        <coneGeometry args={[0.028, 0.09, 10]} />
        <meshBasicMaterial color="#ffb347" toneMapped={false} transparent opacity={0.85} />
      </mesh>
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
  const geo = useMemo(() => new THREE.CylinderGeometry(0.024, 0.026, 0.5, 7), [])
  useFrame(() => {
    const o = g.current
    if (!o) return
    const h = held.current
    o.visible = h?.kind === 'charcoal'
    if (o.visible) o.position.copy(h!.at)
  })
  return (
    <group ref={g} visible={false} rotation={[0.3, 0.4, Math.PI / 2]}>
      <Inked geometry={geo} color="#8d8a86" grow={1.08} />
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
const RICE_GEO = {
  tub: new THREE.CylinderGeometry(0.27, 0.25, 0.3, 28, 1, true),
  floor: new THREE.CircleGeometry(0.25, 28),
  hoop: new THREE.TorusGeometry(0.272, 0.012, 6, 32),
  rice: new THREE.SphereGeometry(0.255, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.32),
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
  const g = RICE_GEO
  const floor = GRILL_OFFSET.y
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
      {/* on the shelf: the tub's lid laid flat, and the rice bowls stacked upside down beside it */}
      <mesh geometry={g.lid} position={[-0.25, floor + 0.28 + 0.018 + 0.04, 0]} scale={RICE_SCALE * 0.95}>
        <meshToonMaterial color="#d9b47a" />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={g.bowl} position={[0.5, floor + 0.3 + k * 0.07, 0.35]} rotation-x={Math.PI} scale={[1.6, 1.4, 1.6]}>
          <meshToonMaterial color="#e8e2d2" />
        </mesh>
      ))}
      <group position-y={SIDE_TOP} scale={RICE_SCALE}>
        <Inked geometry={g.tub} color="#d9b47a" position={[0, 0.15, 0]} grow={1.03} />
        <mesh geometry={g.tub} position-y={0.15} scale={0.98}>
          <meshToonMaterial color="#c49a5e" side={THREE.BackSide} />
        </mesh>
        <mesh geometry={g.floor} position-y={0.01} rotation-x={-Math.PI / 2}>
          <meshToonMaterial color="#c49a5e" />
        </mesh>
        {[0.05, 0.25].map((y) => (
          <mesh key={y} geometry={g.hoop} position-y={y} rotation-x={Math.PI / 2}>
            <meshToonMaterial color="#b0683a" />
          </mesh>
        ))}
        {/* the rice, heaped a little over the rim */}
        <mesh geometry={g.rice} position-y={0.15} scale={[1, 0.55, 1]}>
          <meshToonMaterial color="#fbf8f0" />
        </mesh>
        {/* the paddle stood in it */}
        <group position={[0.08, 0.36, -0.04]} rotation={[0.25, 0, -0.35]}>
          <mesh geometry={g.paddle} position-y={0.06}><meshToonMaterial color="#e2c89a" /></mesh>
          <mesh geometry={g.blade} position-y={-0.12} scale={[1, 1.3, 0.25]}><meshToonMaterial color="#e2c89a" /></mesh>
        </group>
        <Steam position={[0, 0.22, 0]} width={0.4} height={0.55} opacity={0.32} layers={2} />
      </group>
    </group>
  )
}

export function Decor({ held, lanternAt }: { held: RefObject<Held>; lanternAt: [number, number, number] }) {
  return (
    <>
      <Crate />
      <Fan held={held} />
      <HeldStick held={held} />
      <Lantern at={lanternAt} />
      <RiceTub />
    </>
  )
}
