import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StaticBatch } from '@/scene/StaticBatch'
import { TOILETS, WC_W, type Counter } from './bar'
import { LuckyCat } from './LuckyCat'
import { Steam } from '@/scene/Steam'

/**
 * The customers' side of the room, behind the aisle: a wall of cream plaster over a dark wooden wainscot, a frieze of
 * seigaiha waves under the beam, prints and hanging scrolls along the plaster, a shelf of sake bottles, crocks and a beckoning cat, and paper
 * pendant lamps hung low over the bar, their warm light painted on it. Seen from behind (the camera swung round),
 * the wall isn't drawn, so it never hides the bar.
 */

const INK = '#2a1a10'
const WP = new THREE.Vector3()
const NORMAL = new THREE.Vector3()
const WALL_H = 2.3
const WAINSCOT = 0.85

/** a canvas texture of the given size, drawn by `draw` */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** a red seal stamped in a corner */
const seal = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = '#b8261c'
  g.fillRect(x, y, s, s)
  g.strokeStyle = '#f4e6cc'
  g.lineWidth = 1.5
  g.strokeRect(x + 3, y + 3, s - 6, s - 6)
}

/** the frieze under the beam: seigaiha, overlapping waves of rings in indigo on cream */
const SEIGAIHA = canvasTex(64, 32, (g) => {
  g.fillStyle = '#e9dcc0'
  g.fillRect(0, 0, 64, 32)
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col < 3; col++) {
      const cx = col * 32 + (row % 2 ? 16 : 0), cy = 8 + row * 12
      for (let r = 16; r > 0; r -= 4) {
        g.beginPath()
        g.arc(cx, cy + 8, r, Math.PI, 0)
        g.fillStyle = r % 8 ? '#e9dcc0' : '#3a5578'
        g.fill()
      }
    }
  }
}, true)

/** the pictures on the wall, each drawn here (no outside pictures): prints in frames and hanging scrolls */
const ART = {
  // Fuji under a red sun, bands of cloud across it
  fuji: canvasTex(256, 180, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 180)
    sky.addColorStop(0, '#e8c99a')
    sky.addColorStop(1, '#f3e6c8')
    g.fillStyle = sky
    g.fillRect(0, 0, 256, 180)
    g.fillStyle = '#c8402c'
    g.beginPath(); g.arc(196, 46, 22, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#34507a'
    g.beginPath(); g.moveTo(10, 180); g.lineTo(112, 52); g.lineTo(144, 52); g.lineTo(246, 180); g.fill()
    g.fillStyle = '#f6f2ea'
    g.beginPath(); g.moveTo(112, 52); g.lineTo(144, 52); g.lineTo(166, 80)
    for (let k = 0; k < 6; k++) g.lineTo(160 - k * 11, k % 2 ? 92 : 80)
    g.lineTo(90, 80); g.fill()
    g.fillStyle = 'rgba(255,250,240,0.85)'
    for (const [x, y, w] of [[20, 120, 90], [150, 136, 80], [60, 150, 120]]) g.fillRect(x, y, w, 7)
    seal(g, 14, 14, 16)
  }),
  // a great wave curling over, its crest breaking into claws of foam
  wave: canvasTex(256, 180, (g) => {
    g.fillStyle = '#efe2c4'
    g.fillRect(0, 0, 256, 180)
    g.fillStyle = '#25406a'
    g.beginPath(); g.moveTo(0, 180); g.bezierCurveTo(30, 60, 150, 10, 200, 60); g.bezierCurveTo(170, 50, 140, 70, 150, 100)
    g.bezierCurveTo(170, 130, 230, 150, 256, 140); g.lineTo(256, 180); g.fill()
    g.strokeStyle = '#f6f2ea'
    g.lineWidth = 3
    for (let k = 0; k < 7; k++) {
      g.beginPath(); g.arc(70 + k * 20, 48 + Math.abs(k - 3) * 8, 7, Math.PI, Math.PI * 1.9); g.stroke()
    }
    for (let k = 0; k < 5; k++) {
      g.beginPath(); g.moveTo(10 + k * 30, 170); g.bezierCurveTo(30 + k * 30, 120, 70 + k * 25, 100, 90 + k * 25, 110); g.stroke()
    }
    g.fillStyle = '#34507a'
    g.beginPath(); g.moveTo(170, 140); g.lineTo(186, 116); g.lineTo(202, 140); g.fill()
    seal(g, 226, 14, 16)
  }),
  // two koi, red and white, in dark water, rings spreading
  koi: canvasTex(256, 180, (g) => {
    g.fillStyle = '#1f3440'
    g.fillRect(0, 0, 256, 180)
    g.strokeStyle = 'rgba(200,230,240,0.25)'
    g.lineWidth = 2
    for (const [x, y] of [[60, 50], [190, 130]]) for (let r = 10; r < 50; r += 12) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke() }
    const fish = (x: number, y: number, a: number, spots: string) => {
      g.save(); g.translate(x, y); g.rotate(a)
      g.fillStyle = '#f6f0e4'
      g.beginPath(); g.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.moveTo(-30, 0); g.lineTo(-52, -12); g.lineTo(-48, 0); g.lineTo(-52, 12); g.fill()
      g.fillStyle = spots
      g.beginPath(); g.ellipse(8, -2, 14, 8, 0.3, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.ellipse(-14, 3, 9, 6, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    fish(110, 70, 0.4, '#d8432a')
    fish(150, 120, -2.6, '#e8902a')
    seal(g, 14, 150, 16)
  }),
  // calligraphy: 一期一會 brushed down the paper
  calligraphy: canvasTex(96, 256, (g) => {
    g.fillStyle = '#f4ead4'
    g.fillRect(0, 0, 96, 256)
    g.fillStyle = '#1a120c'
    g.font = 'bold 46px "Zen Antique", "Noto Serif TC", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    ;['一', '期', '一', '會'].forEach((ch, i) => g.fillText(ch, 48, 34 + i * 50))
    seal(g, 56, 226, 18)
  }),
  // a branch of plum in blossom, in ink with pink flowers
  plum: canvasTex(96, 256, (g) => {
    g.fillStyle = '#f4ead4'
    g.fillRect(0, 0, 96, 256)
    g.strokeStyle = '#2a1d16'
    g.lineCap = 'round'
    g.lineWidth = 5
    g.beginPath(); g.moveTo(10, 250); g.bezierCurveTo(40, 190, 20, 140, 60, 90); g.stroke()
    g.lineWidth = 3
    g.beginPath(); g.moveTo(32, 170); g.bezierCurveTo(60, 160, 70, 140, 84, 128); g.stroke()
    g.beginPath(); g.moveTo(60, 90); g.lineTo(76, 40); g.stroke()
    g.fillStyle = '#e48a9a'
    for (const [x, y] of [[60, 90], [76, 40], [84, 128], [50, 120], [66, 150], [40, 196], [70, 66]]) {
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 3.4, 0, Math.PI * 2); g.fill() }
    }
    seal(g, 8, 12, 14)
  }),
}
type ArtKey = keyof typeof ART
const PRINTS: ArtKey[] = ['fuji', 'wave', 'koi']
const SCROLLS: ArtKey[] = ['calligraphy', 'plum']

/** a print behind glass in a thin dark frame */
function Framed({ art }: { art: ArtKey }) {
  const W = 0.5, H = 0.36
  return (
    <group>
      <mesh position-x={-0.012}>
        <boxGeometry args={[0.02, H + 0.05, W + 0.05]} />
        <meshToonMaterial color="#2e1d12" />
      </mesh>
      <mesh position-x={-0.024} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
    </group>
  )
}

/** a hanging scroll: the painting on paper mounted in brocade, its cord over a nail, a weighted rod at the foot */
function Scroll({ art }: { art: ArtKey }) {
  const W = 0.26, H = 0.62
  return (
    <group>
      <mesh position-x={-0.006} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W + 0.06, H + 0.26]} />
        <meshToonMaterial color="#6a4a3a" />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[-0.007, s * (H / 2 + 0.06), 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W + 0.06, 0.03]} />
          <meshToonMaterial color="#b0904a" />
        </mesh>
      ))}
      <mesh position-x={-0.008} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
      {/* the rod at the foot with its knobs, and the thin one at the top */}
      <mesh position={[-0.014, -H / 2 - 0.14, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.011, 0.011, W + 0.12, 8]} />
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      <mesh position={[-0.01, H / 2 + 0.13, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.007, 0.007, W + 0.07, 6]} />
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.006, H / 2 + 0.2, s * 0.06]} rotation-x={s * 0.9}>
          <cylinderGeometry args={[0.002, 0.002, 0.16, 4]} />
          <meshBasicMaterial color="#5a2a1a" />
        </mesh>
      ))}
    </group>
  )
}

/** the plaster: warm cream, faintly mottled */
const PLASTER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#efe3cb'
  g.fillRect(0, 0, 128, 128)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 260; k++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '150,120,80' : '255,250,235'},${0.05 + rnd() * 0.08})`
    g.beginPath()
    g.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 7, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()

function Box({ size, color, ...rest }: { size: [number, number, number]; color: string } & Record<string, unknown>) {
  return (
    <mesh {...rest}>
      <boxGeometry args={size} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}

/** an isshōbin of sake: a tall bottle, its label */
function Bottle({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <group position={[0, 0, x]}>
      <mesh position-y={0.11}>
        <cylinderGeometry args={[0.04, 0.042, 0.22, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.25}>
        <cylinderGeometry args={[0.014, 0.036, 0.08, 10]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.3}>
        <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
        <meshToonMaterial color="#d8c8a0" />
      </mesh>
      <mesh position={[-0.041, 0.11, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.05, 0.1]} />
        <meshToonMaterial color={label} />
      </mesh>
    </group>
  )
}

/** the plaque over the toilet door: お手洗い, and 廁所 under it */
/** the plaque over each toilet's door: 男 in indigo with a man's figure, 女 in red with a woman's, and the word under */
const wcSign = (who: 'm' | 'f') => canvasTex(160, 96, (g) => {
  const ink = who === 'm' ? '#24407a' : '#b8262a'
  g.fillStyle = '#3a2416'
  g.fillRect(0, 0, 160, 96)
  g.fillStyle = '#efe2c4'
  g.fillRect(4, 4, 152, 88)
  // the figure: a head, and a body (a woman's in a skirt)
  g.fillStyle = ink
  g.beginPath()
  g.arc(36, 24, 9, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  if (who === 'm') {
    g.rect(26, 36, 20, 26)
    g.rect(28, 62, 6, 22)
    g.rect(38, 62, 6, 22)
  } else {
    g.moveTo(36, 34)
    g.lineTo(52, 66)
    g.lineTo(20, 66)
    g.closePath()
    g.rect(29, 66, 5, 18)
    g.rect(38, 66, 5, 18)
  }
  g.fill()
  g.font = 'bold 50px "Zen Antique", "Noto Serif TC", serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(who === 'm' ? '男' : '女', 104, 44)
  g.fillStyle = '#1d140c'
  g.font = '15px "Noto Serif TC", serif'
  g.fillText(who === 'm' ? '男廁 · MEN' : '女廁 · WOMEN', 104, 80)
})
const WC_SIGNS = { m: wcSign('m'), f: wcSign('f') }
/** shoji paper, faintly fibred */
const SHOJI = canvasTex(64, 64, (g) => {
  g.fillStyle = '#f4ecd8'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = 'rgba(150,120,80,0.12)'
  for (let k = 0; k < 30; k++) {
    g.beginPath()
    const x = (k * 37) % 64, y = (k * 23) % 64
    g.moveTo(x, y)
    g.lineTo(x + 6, y + 3)
    g.stroke()
  }
})

/**
 * The way through to the toilet: one sliding door (引き戸) in a dark wooden frame, shut, wood below and shoji paper on
 * a lattice above, a short indigo noren over it, and the plaque.
 */
/**
 * A toilet's door itself: one whole sliding panel, wood below, shoji paper on a lattice above. It slides aside into
 * the wall when someone goes in or comes out, or when it's clicked (and back again with another click).
 */
function ToiletPanel({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = 1.85
  const g = useRef<THREE.Group>(null)
  const k = useRef(0)
  // (the men's slides off one way, the women's the other, away from each other)
  const away = who === 'm' ? -1 : 1
  useFrame((_, dt) => {
    const d = TOILETS[who]
    const want = d.passing > 0 || d.open ? 1 : 0
    k.current += Math.sign(want - k.current) * Math.min(Math.abs(want - k.current), Math.min(dt, 0.1) * 1.8)
    const e = k.current * k.current * (3 - 2 * k.current)
    if (g.current) g.current.position.z = away * e * (W - 0.1)
  })
  return (
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); TOILETS[who].open = !TOILETS[who].open }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      <group position={[-0.03, H / 2, 0]}>
        <mesh position-y={0.2} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W - 0.02, H - 0.44]} />
          <meshToonMaterial color="#ffffff" map={SHOJI} />
        </mesh>
        <Box size={[0.02, 0.4, W - 0.02]} color="#6a4428" position={[-0.002, -H / 2 + 0.2, 0]} />
        {[-1, 1].map((sd) => <Box key={sd} size={[0.024, H - 0.02, 0.03]} color="#5a3a22" position={[-0.006, 0, sd * (W / 2 - 0.025)]} />)}
        {[-0.5, -0.17, 0.17, 0.5].map((k) => <Box key={k} size={[0.016, H - 0.46, 0.014]} color="#5a3a22" position={[-0.008, 0.2, k * (W - 0.06) / 1.1]} />)}
        {[0, 1, 2, 3, 4].map((k) => <Box key={k} size={[0.016, 0.018, W - 0.04]} color="#5a3a22" position={[-0.008, -H / 2 + 0.41 + k * (H - 0.46) / 4, 0]} />)}
        {/* the hand-hold, sunk in the wood */}
        <mesh position={[-0.014, -0.1, W / 2 - 0.09]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.006, 12]} />
          <meshToonMaterial color="#2a1a10" />
        </mesh>
      </group>
    </group>
  )
}
function ToiletDoor({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = 1.85
  return (
    <group>
      {/* the frame round the opening */}
      {[-1, 1].map((sd) => <Box key={sd} size={[0.06, H + 0.06, 0.06]} color="#3a2416" position={[-0.03, H / 2, sd * (W / 2 + 0.03)]} />)}
      <Box size={[0.07, 0.07, W + 0.12]} color="#3a2416" position={[-0.035, H + 0.035, 0]} />
      <Box size={[0.05, 0.025, W + 0.12]} color="#3a2416" position={[-0.03, 0.012, 0]} />
      {/* (the sliding panel: ToiletPanel, not merged) and the dark little room behind it */}
      <mesh position={[0.45, H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="#1e1a18" />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0.22, H / 2, sd * W / 2]} rotation-y={sd > 0 ? Math.PI : 0}>
          <planeGeometry args={[0.45, H]} />
          <meshBasicMaterial color="#2a2420" />
        </mesh>
      ))}
      {/* the short noren, and the plaque over it */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[-0.075, H - 0.2, sd * W / 4.2]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W / 2.2, 0.36]} />
          <meshToonMaterial color={who === 'm' ? '#2c3e66' : '#9a2a2a'} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[-0.075, H + 0.16, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.4, 0.24]} />
        <meshToonMaterial color="#ffffff" map={WC_SIGNS[who]} />
      </mesh>
    </group>
  )
}

/**
 * The household shrine (神棚) up on the wall: a shelf on two brackets, a little shrine of pale hinoki under its
 * roof, a vase of sakaki either side, the cups of rice, salt and water before it, and the sacred rope (注連縄) with its
 * paper streamers hung across the front.
 */
function Kamidana() {
  const HIN = '#e2c89a'
  return (
    <group>
      <Box size={[0.26, 0.03, 0.78]} color="#c9a46a" position={[-0.13, 0, 0]} />
      {[-0.3, 0.3].map((z) => <Box key={z} size={[0.16, 0.12, 0.03]} color="#a8844e" position={[-0.07, -0.07, z]} />)}
      {/* the shrine: its base, body, doors and roof */}
      <group position={[-0.14, 0.015, 0]}>
        <Box size={[0.16, 0.03, 0.34]} color={HIN} position-y={0.015} />
        <Box size={[0.12, 0.16, 0.24]} color={HIN} position-y={0.11} />
        <mesh position={[-0.061, 0.11, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.1, 0.12]} />
          <meshToonMaterial color="#c8a868" />
        </mesh>
        <mesh position={[-0.0615, 0.11, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.004, 0.12]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.05, 0.215, 0]} rotation-z={sd * 0.55}>
            <boxGeometry args={[0.13, 0.014, 0.3]} />
            <meshToonMaterial color="#6a5038" />
          </mesh>
        ))}
        <Box size={[0.02, 0.02, 0.32]} color="#d4b04a" position-y={0.245} />
      </group>
      {/* the sakaki in their vases, and the cups */}
      {[-0.3, 0.3].map((z) => (
        <group key={z} position={[-0.15, 0.015, z]}>
          <mesh position-y={0.04}>
            <cylinderGeometry args={[0.02, 0.016, 0.08, 10]} />
            <meshToonMaterial color="#f4f1ea" />
          </mesh>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[0, 0.11 + Math.abs(k) * -0.01, k * 0.02]} rotation-x={k * 0.4} scale={[0.6, 1, 1]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshToonMaterial color="#3a6a3a" />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.13, 0, 0.13].map((z) => (
        <mesh key={z} position={[-0.23, 0.03, z * 0.6]}>
          <cylinderGeometry args={[0.012, 0.01, 0.025, 10]} />
          <meshToonMaterial color="#f4f1ea" />
        </mesh>
      ))}
      {/* the rope across the front, sagging, and its zigzag paper shide */}
      {Array.from({ length: 9 }, (_, i) => {
        const z = -0.36 + i * 0.09
        return (
          <mesh key={i} position={[-0.27, -0.02 - 0.03 * (1 - (z / 0.36) ** 2), z]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.014, 0.014, 0.095, 8]} />
            <meshToonMaterial color="#d8c08a" />
          </mesh>
        )
      })}
      {[-0.2, 0, 0.2].map((z) => (
        <mesh key={z} position={[-0.275, -0.1, z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.035, 0.11]} />
          <meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** the glow round a lit lamp, and the pool of its light on what's under it: a soft warm disc, bright in the middle */
const GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,200,130,0.9)')
  grad.addColorStop(0.4, 'rgba(255,170,90,0.35)')
  grad.addColorStop(1, 'rgba(255,150,70,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

/**
 * A paper pendant lamp over the bar, lit. Its light is painted, not cast: a halo round the shade and a warm pool on
 * the bar top under it (added on, so it brightens what it falls on). Six real lights would cost every lit surface in
 * the room on every frame; these cost two quads each.
 */
function Pendant({ z, drop, pool }: { z: number; drop: number; pool: number }) {
  return (
    <group position={[0, WALL_H, z]}>
      <mesh position-y={-drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <group position-y={-drop - 0.09}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 10]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
        <mesh scale={1.06}>
          <sphereGeometry args={[0.11, 16, 10]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
        {[0.1, -0.1].map((y) => (
          <mesh key={y} position-y={y}>
            <cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
            <meshToonMaterial color={INK} />
          </mesh>
        ))}
        <sprite scale={0.75}>
          <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
        </sprite>
      </group>
      {/* (the pool of light on the bar top below, down from the lamp's height) */}
      <mesh position-y={pool - WALL_H + 0.004} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.32} />
      </mesh>
    </group>
  )
}

/**
 * One counter's stretch of the room: the wall behind its aisle (from/to along it, in the counter's own frame), and
 * pendant lamps over it.
 */
export function DiningWall({ c, from, to, far, lamps, top, door, shrine, altar = false }: { c: Counter; from: number; to: number; far: number
  /** its shelf an altar instead (by the door): a command flag in the censer, and incense (lit when, and lighting more) */
  altar?: boolean | { litAt: number | null; onLight: () => void }
  lamps: number
  /** the bar top's height, where the lamps' light falls */
  top: number
  /** where along it the sliding door to the toilet is, if it has one */
  door?: number
  /** where along it the little household shrine (神棚) is put up, if it has one */
  shrine?: number }) {
  const yaw = Math.atan2(c.along.x, c.along.z)
  const l = to - from
  const mid = (from + to) / 2
  const plaster = useMemo(() => {
    if (!PLASTER) return null
    const t = PLASTER.clone()
    t.repeat.set(l / 1.2, (WALL_H - WAINSCOT) / 1.2)
    t.needsUpdate = true
    return t
  }, [l])
  // (pictures along the wall, a print then a scroll in turn, about a metre apart, leaving the shelf's stretch clear)
  // (the shelf in the far third of the wall, or the near one if the door's in the far one)
  const shelfZ = door !== undefined && Math.abs(door - (mid + l * 0.3)) < 1.3 ? mid - l * 0.3 : mid + l * 0.3
  const art = useMemo(() => {
    // (in the bays between the posts, spaced evenly in each, never over a post or the shelf)
    const posts = [from, mid - l / 6, mid + l / 6, to]
    const start = Math.round(c.length * 3)
    const spots: number[] = []
    for (let b = 0; b < 3; b++) {
      const w = posts[b + 1] - posts[b]
      const n = Math.max(0, Math.floor(w / 0.95))
      for (let i = 0; i < n; i++) spots.push(posts[b] + (w / n) * (i + 0.5))
    }
    return spots.filter((z) => Math.abs(z - shelfZ) > 0.85 && (door === undefined || Math.abs(z - door) > 0.95)
      && (shrine === undefined || Math.abs(z - shrine) > 0.75) && (door === undefined || Math.abs(z - door) > WC_W + 0.55))
      .map((z, k) => ({ z, scroll: k % 2 ? SCROLLS[(start + k) % SCROLLS.length] : undefined, print: PRINTS[(start + k) % PRINTS.length] }))
  }, [l, from, to, mid, shelfZ, c.length, door, shrine])
  const frieze = useMemo(() => {
    if (!SEIGAIHA) return null
    const t = SEIGAIHA.clone()
    t.repeat.set(l / 0.4, 1)
    t.needsUpdate = true
    return t
  }, [l])
  // (the wall and all on it are hidden while the camera is round behind it)
  const wall = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    const w = wall.current
    if (!w) return
    w.getWorldPosition(WP)
    const facing = NORMAL.set(-1, 0, 0).transformDirection(w.matrixWorld)
    w.visible = camera.position.clone().sub(WP).dot(facing) > 0
  })
  return (
    <group position={c.at} rotation-y={yaw}>
      {/* (local x is away from the cook: the wall stands at the floor's far edge, facing back toward the bar) */}
      <group ref={wall} position-x={-far}>
        {/* (all of it standing still: drawn merged, a few meshes for the whole wall) */}
        <StaticBatch key={`${from}|${to}|${door}|${shrine}|${!!altar}`}>
        <mesh position={[0, WAINSCOT + (WALL_H - WAINSCOT) / 2, mid]} rotation-y={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[l, WALL_H - WAINSCOT]} />
          <meshToonMaterial color="#ffffff" map={plaster} />
        </mesh>
        <mesh position={[0, WAINSCOT / 2, mid]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[l, WAINSCOT]} />
          <meshToonMaterial color="#5e4029" />
        </mesh>
        {/* posts, the rail over the wainscot and the beam along the top */}
        <Box size={[0.05, 0.05, l]} color="#3a2416" position={[-0.02, WAINSCOT, mid]} />
        <Box size={[0.08, 0.1, l]} color="#3a2416" position={[-0.03, WALL_H - 0.05, mid]} />
        {[from, mid - l / 6, mid + l / 6, to].filter((z) => z === from || z === to || door === undefined || Math.abs(z - door) > WC_W + 0.1).map((z) => (
          <Box key={z} size={[0.07, WALL_H, 0.08]} color="#3a2416" position={[-0.03, WALL_H / 2, z]} />
        ))}
        {/* a frieze of seigaiha waves under the beam, and the pictures hung along the plaster */}
        <mesh position={[-0.004, WALL_H - 0.2, mid]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[l, 0.2]} />
          <meshToonMaterial color="#ffffff" map={frieze} />
        </mesh>
        <Box size={[0.03, 0.025, l]} color="#3a2416" position={[-0.01, WALL_H - 0.31, mid]} />
        {art.map((a) => (
          <group key={a.z} position={[0, a.scroll ? 1.42 : 1.5, a.z]}>
            {a.scroll ? <Scroll art={a.scroll} /> : <Framed art={a.print} />}
          </group>
        ))}
        {/* the toilets, the men's and the women's, side by side */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletDoor who={who} /></group>
        ))}
        {shrine !== undefined && <group position={[0, 1.78, shrine]}><Kamidana /></group>}
        {/* the shelf: sake bottles, two crocks and the cat; or, by the door, the altar */}
        {altar ? <group position={[-0.1, 1.08, shelfZ]}><Box size={[0.2, 0.03, 0.9]} color="#6a4428" position-y={-0.015} />
          {[-0.35, 0.35].map((z) => <Box key={z} size={[0.18, 0.08, 0.025]} color="#3a2416" position={[0.04, -0.06, z]} />)}</group>
          : <>
        <group position={[-0.1, 1.08, shelfZ]}>
          <Box size={[0.2, 0.03, 0.9]} color="#6a4428" position-y={-0.015} />
          {[-0.35, 0.35].map((z) => <Box key={z} size={[0.18, 0.08, 0.025]} color="#3a2416" position={[0.04, -0.06, z]} />)}
          <Bottle x={-0.32} color="#2f5a3a" label="#f2ead8" />
          <Bottle x={-0.22} color="#5a3a22" label="#f2ead8" />
          <Bottle x={-0.12} color="#2f5a3a" label="#e8d06a" />
          <mesh position={[0, 0.06, 0.04]}>
            <cylinderGeometry args={[0.05, 0.06, 0.12, 12]} />
            <meshToonMaterial color="#8a5a34" />
          </mesh>
          <mesh position={[0, 0.06, 0.15]}>
            <cylinderGeometry args={[0.04, 0.05, 0.1, 12]} />
            <meshToonMaterial color="#3e4a5a" />
          </mesh>
          <group position={[0, 0, 0.3]} rotation-y={-Math.PI / 2}><LuckyCat /></group>
        </group>
          </>}
        </StaticBatch>
        {/* (the toilets' doors slide: not merged) */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} name={`look-wc-${who}`} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletPanel who={who} /></group>
        ))}
        {/* (the altar's flag stirs, its incense smokes: not merged) */}
        {altar && <group name="look-altar" position={[-0.1, 1.08, shelfZ]}><Altar incense={altar === true ? undefined : altar} /></group>}
      </group>
      {/* pendant lamps over the bar's customer side, low */}
      {Array.from({ length: lamps }, (_, i) => {
        const z = (i - (lamps - 1) / 2) * (c.length / lamps)
        return <group key={i} position-x={0.05}><Pendant z={z} drop={0.5} pool={top} /></group>
      })}
    </group>
  )
}

/**
 * A command flag (令旗), as a temple's is made: a pennant of yellow silk, woven (the threads show), edged with a
 * border of red flames cut in points, a thin gold line inside it, and a tiger (虎爺) embroidered on it.
 * Its long side is against the pole (u = 0), its point at u = 1.
 */
const LINGQI = canvasTex(256, 256, (g) => {
  const tri = (inset: number) => {
    g.beginPath()
    g.moveTo(inset * 0.5, inset)
    g.lineTo(256 - inset * 1.9, 128)
    g.lineTo(inset * 0.5, 256 - inset)
    g.closePath()
  }
  // the red border cloth under it all
  g.fillStyle = '#b8201c'
  tri(0)
  g.fill()
  // the silk
  g.fillStyle = '#f0c232'
  tri(26)
  g.fill()
  // its weave: fine threads both ways, lighter and darker
  g.save()
  tri(26)
  g.clip()
  for (let i = 0; i < 256; i += 3) {
    g.fillStyle = i % 6 ? 'rgba(255,240,170,0.18)' : 'rgba(150,100,10,0.16)'
    g.fillRect(i, 0, 1, 256)
    g.fillStyle = i % 6 ? 'rgba(120,80,0,0.12)' : 'rgba(255,245,200,0.14)'
    g.fillRect(0, i, 256, 1)
  }
  // a soft sheen down its middle, as silk catches the light
  const sheen = g.createLinearGradient(0, 40, 0, 216)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,250,220,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sheen
  g.fillRect(0, 0, 256, 256)
  g.restore()
  // the flames between the red and the silk: points cut into the yellow
  g.fillStyle = '#b8201c'
  for (let k = 0; k < 10; k++) {
    const t = (k + 0.5) / 10
    for (const sd of [1, -1]) {
      const x = 13 + (230 - 13) * t, y = 128 - sd * (115 - 102 * t)
      g.beginPath()
      g.moveTo(x - 9, y - sd * 2)
      g.lineTo(x + 9, y - sd * 2)
      g.lineTo(x, y + sd * 16)
      g.closePath()
      g.fill()
    }
  }
  // a gold line just inside the border
  g.strokeStyle = '#e8b830'
  g.lineWidth = 3
  tri(40)
  g.stroke()
  // a tiger (虎爺) embroidered on it, prowling toward the pole: orange, striped in black, outlined in gold thread
  g.save()
  g.translate(80, 132)
  g.lineJoin = 'round'
  const tiger = () => {
    g.beginPath()
    // body, haunch to shoulder
    g.ellipse(4, 4, 40, 19, -0.08, 0, Math.PI * 2)
    g.moveTo(-34, 0)
    // tail, curling up behind
    g.bezierCurveTo(-56, -6, -58, -34, -40, -40)
    g.lineTo(-37, -34)
    g.bezierCurveTo(-50, -28, -48, -10, -32, -6)
    // legs, one pair striding
    g.rect(-30, 14, 10, 24)
    g.rect(-14, 16, 10, 22)
    g.rect(16, 16, 10, 22)
    g.rect(30, 12, 10, 26)
    // the head, its ears
    g.moveTo(66, -10)
    g.arc(50, -10, 17, 0, Math.PI * 2)
    g.moveTo(38, -24)
    g.arc(40, -24, 6, 0, Math.PI * 2)
    g.moveTo(62, -24)
    g.arc(60, -24, 6, 0, Math.PI * 2)
  }
  tiger()
  g.lineWidth = 6
  g.strokeStyle = '#e8b830'
  g.stroke()
  g.fillStyle = '#e2701c'
  tiger()
  g.fill()
  // stripes over the back, on the haunch and tail, on the brow
  g.strokeStyle = '#1c120a'
  g.lineWidth = 3.5
  g.lineCap = 'round'
  for (const [x, top, len] of [[-22, -14, 14], [-10, -18, 16], [2, -19, 17], [14, -18, 16], [26, -15, 13], [-30, 8, 8], [-44, -30, 7]]) {
    g.beginPath()
    g.moveTo(x, top)
    g.quadraticCurveTo(x + 4, top + len / 2, x - 1, top + len)
    g.stroke()
  }
  for (const k of [-6, 0, 6]) {
    g.beginPath()
    g.moveTo(50 + k, -24)
    g.lineTo(50 + k * 0.6, -17)
    g.stroke()
  }
  // its eye and nose, a pale muzzle
  g.fillStyle = '#f6ecd0'
  g.beginPath()
  g.ellipse(58, -4, 9, 6, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1c120a'
  g.beginPath()
  g.arc(54, -13, 2.6, 0, Math.PI * 2)
  g.arc(64, -6, 2.4, 0, Math.PI * 2)
  g.fill()
  g.restore()
})
/** the pennant: a triangle of cloth in strips from the pole out to its point, to ripple */
const FLAG_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 12, 6)
  const p = g.attributes.position, uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i), v = uv.getY(i)
    // (narrowing to the point: the long side at the pole, x = 0)
    p.setXYZ(i, u, (v - 0.5) * (1 - u), 0)
  }
  g.userData.rest = Float32Array.from(p.array as Float32Array)
  return g
})()
const ALTAR_GEO = {
  censer: new THREE.CylinderGeometry(0.075, 0.06, 0.08, 20),
  foot: new THREE.SphereGeometry(0.014, 8, 6),
  ash: new THREE.CircleGeometry(0.068, 20),
  stick: new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 5),
  tip: new THREE.SphereGeometry(0.005, 6, 4),
  pole: new THREE.CylinderGeometry(0.004, 0.0045, 0.34, 8),
  finial: new THREE.ConeGeometry(0.008, 0.026, 8),
  knob: new THREE.SphereGeometry(0.008, 10, 8),
  tassel: new THREE.CylinderGeometry(0.004, 0.0015, 0.03, 6),
  fruit: new THREE.SphereGeometry(0.03, 12, 8),
  dish: new THREE.CylinderGeometry(0.08, 0.06, 0.015, 18),
}
/**
 * The altar on the shelf by the door: a bronze censer on three feet full of ash, a command flag (令旗) of yellow silk
 * stood in it on a black pole with a gold tip, rippling a little, and one stick of incense burning, its tip glowing and
 * a thread of smoke going up; a dish of oranges set out as an offering.
 */
/** how long a stick of incense burns (ms) */
const INCENSE_MS = 60000
function Altar({ incense }: { incense?: { litAt: number | null; onLight: () => void } }) {
  const tip = useRef<THREE.MeshBasicMaterial>(null)
  const stick = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.Group>(null)
  const ember = useRef<THREE.Mesh>(null)
  const flag = useMemo(() => FLAG_GEO.clone(), [])
  useEffect(() => () => flag.dispose(), [flag])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // (the stick burns down over its minute, from its tip; burnt out, it's gone, and another can be lit)
    const lit = incense?.litAt ?? null
    const left = lit === null ? 1 : Math.max(0, 1 - (performance.now() - lit) / INCENSE_MS)
    const burning = lit !== null && left > 0
    const len = 0.06 + 0.94 * left
    if (stick.current) {
      stick.current.scale.y = len
      stick.current.visible = burning
    }
    if (ember.current) {
      ember.current.visible = burning
      ember.current.position.y = 0.2 * len
    }
    if (smoke.current) {
      smoke.current.visible = burning
      smoke.current.position.y = 0.2 * len + 0.12
    }
    if (tip.current) tip.current.color.setRGB(1, 0.35 + 0.15 * Math.sin(t * 3.1), 0.1)
    // the silk stirring in the air: a slow ripple from the pole out to the point, more the further out
    const p = flag.attributes.position, rest = FLAG_GEO.userData.rest as Float32Array
    for (let i = 0; i < p.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1]
      p.setXYZ(i, x, y - x * x * 0.03, Math.sin(x * 5 - t * 1.6) * 0.035 * x + Math.sin(y * 7 + t) * 0.006 * x)
    }
    p.needsUpdate = true
    flag.computeVertexNormals()
  })
  return (
    <group>
      <Inked geometry={ALTAR_GEO.censer} color="#8a6a3a" position-y={0.05} />
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={ALTAR_GEO.foot} position={[Math.cos(k * 2.1) * 0.05, 0.008, Math.sin(k * 2.1) * 0.05]}>
          <meshToonMaterial color="#6a4e2a" />
        </mesh>
      ))}
      <mesh geometry={ALTAR_GEO.ash} position-y={0.091} rotation-x={-Math.PI / 2}><meshToonMaterial color="#d8d0c0" /></mesh>
      {/* the packet of incense beside the censer: click it (or the censer) to stand a stick in the ash and light it */}
      <group position={[-0.01, 0, -0.14]} rotation-y={0.3} onClick={(e) => { e.stopPropagation(); incense?.onLight() }}
        onPointerOver={() => { if (incense) document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
        <mesh position-y={0.035}><boxGeometry args={[0.035, 0.07, 0.06]} /><meshToonMaterial color="#c4302a" /></mesh>
        <mesh position={[-0.0181, 0.04, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.04, 0.03]} /><meshToonMaterial color="#f2c62a" /></mesh>
        {[-0.012, -0.004, 0.006, 0.014].map((z, k) => (
          <mesh key={z} position={[0, 0.07 + 0.03, z]} rotation-x={(k - 1.5) * 0.06}>
            <cylinderGeometry args={[0.0022, 0.0022, 0.06 + k * 0.006, 4]} /><meshToonMaterial color="#8a2a1a" />
          </mesh>
        ))}
        <mesh position-y={0.06} visible={false}><boxGeometry args={[0.12, 0.16, 0.14]} /></mesh>
      </group>
      {/* the stick in the censer, in front, burning down; none there till one's lit, and gone again once it's out */}
      <group position={[-0.03, 0.09, 0]} rotation-z={0.06}
        onClick={(e) => { e.stopPropagation(); incense?.onLight() }}
        onPointerOver={() => { if (incense) document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = '' }}>
        <group ref={stick}>
          <mesh geometry={ALTAR_GEO.stick} position-y={0.1}><meshToonMaterial color="#8a2a1a" /></mesh>
        </group>
        <mesh ref={ember} geometry={ALTAR_GEO.tip} position-y={0.2}><meshBasicMaterial ref={tip} color="#ff6a1a" toneMapped={false} /></mesh>
        {/* (a bigger, unseen target round it all, so it's easy to click) */}
        <mesh position-y={0.1} visible={false}><boxGeometry args={[0.16, 0.3, 0.3]} /></mesh>
        <group ref={smoke}>
          <Steam width={0.06} height={0.4} opacity={0.32} layers={1} color="#e8e4dc" shade="#c8c4bc" speed={0.04} />
        </group>
      </group>
      {/* the command flag, stood at the back of the censer: its pole, a gold tip on it, the silk on the pole's upper
          part, a red tassel hanging from its point */}
      <group position={[0.035, 0.09, 0.03]}>
        <mesh geometry={ALTAR_GEO.pole} position-y={0.17}><meshToonMaterial color="#1a120c" /></mesh>
        <mesh geometry={ALTAR_GEO.knob} position-y={0.342}><meshToonMaterial color="#d4b04a" /></mesh>
        <mesh geometry={ALTAR_GEO.finial} position-y={0.36}><meshToonMaterial color="#d4b04a" /></mesh>
        <group position={[0, 0.25, -0.004]} rotation-y={Math.PI / 2} scale={[0.17, 0.15, 1]}>
          <mesh geometry={flag}>
            <meshToonMaterial color="#ffffff" map={LINGQI} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh geometry={ALTAR_GEO.tassel} position={[0, 0.235, -0.17]}><meshToonMaterial color="#c4302a" /></mesh>
      </group>
      {/* the oranges on their dish */}
      <group position={[0, 0, 0.3]}>
        <mesh geometry={ALTAR_GEO.dish} position-y={0.008}><meshToonMaterial color="#e8e2d2" /></mesh>
        {[[0, 0.035, -0.02], [-0.02, 0.035, 0.025], [0.025, 0.035, 0.02], [0, 0.085, 0.008]].map((pt, k) => (
          <mesh key={k} geometry={ALTAR_GEO.fruit} position={pt as [number, number, number]}><meshToonMaterial color="#f08a1a" /></mesh>
        ))}
      </group>
    </group>
  )
}

/** straw wrapping round a sake barrel (菰), the brewer's mark in red and black on its front (the middle, -z) */
const KOMO = canvasTex(256, 96, (g) => {
  g.fillStyle = '#d8c48e'
  g.fillRect(0, 0, 256, 96)
  for (let x = 0; x < 256; x += 3) {
    g.strokeStyle = x % 6 ? 'rgba(120,90,40,0.35)' : 'rgba(250,240,200,0.4)'
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + 1, 96)
    g.stroke()
  }
  // the mark: a red disc, the name brushed in black over it, and a band of black either side
  g.fillStyle = '#f4ead2'
  g.fillRect(96, 10, 64, 76)
  g.fillStyle = '#b8261c'
  g.beginPath()
  g.arc(128, 40, 22, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1c1410'
  g.font = 'bold 30px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('聞', 128, 41)
  g.font = 'bold 15px serif'
  g.fillText('銘酒', 128, 74)
})
const PROP_GEO = {
  barrel: new THREE.CylinderGeometry(0.2, 0.2, 0.42, 24, 1, true),
  barrelTop: new THREE.CircleGeometry(0.2, 24),
  rope: new THREE.TorusGeometry(0.203, 0.012, 5, 28),
  pot: new THREE.CylinderGeometry(0.15, 0.12, 0.26, 16),
  stalk: new THREE.CylinderGeometry(0.014, 0.017, 1, 6),
  leaf: new THREE.ConeGeometry(0.035, 0.2, 4),
  crate: new THREE.BoxGeometry(0.3, 0.2, 0.24),
  bottle: new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8),
}
function Inked({ geometry, color, map, grow = 1.04, side, ...rest }: { geometry: THREE.BufferGeometry; color: string; map?: THREE.Texture | null
  grow?: number; side?: THREE.Side } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color={color} map={map ?? null} side={side ?? THREE.FrontSide} />
      </mesh>
      <mesh geometry={geometry} scale={grow}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
/** a straw-wrapped sake barrel (菰樽), its lid and its two ropes, standing on its end; its mark faces `-z` */
function SakeBarrel() {
  return (
    <group>
      <Inked geometry={PROP_GEO.barrel} color="#ffffff" map={KOMO} position-y={0.21} grow={1.03} side={THREE.DoubleSide} />
      <mesh geometry={PROP_GEO.barrelTop} position-y={0.42} rotation-x={-Math.PI / 2}><meshToonMaterial color="#c9a46a" /></mesh>
      {[0.07, 0.35].map((y) => (
        <mesh key={y} geometry={PROP_GEO.rope} position-y={y} rotation-x={Math.PI / 2}><meshToonMaterial color="#5a3a1e" /></mesh>
      ))}
    </group>
  )
}
/** a clump of bamboo in a glazed pot: a few stalks, leaves in tufts at their joints */
function PottedBamboo() {
  const stalks = [[0.04, 0.02, 1.25, 0.05], [-0.05, 0.03, 1.05, -0.08], [0.0, -0.06, 0.9, 0.1]]
  return (
    <group>
      <Inked geometry={PROP_GEO.pot} color="#2c4a5c" position-y={0.13} />
      <mesh position-y={0.255} rotation-x={-Math.PI / 2}><circleGeometry args={[0.14, 16]} /><meshToonMaterial color="#4a3020" /></mesh>
      {stalks.map(([x, z, h, lean], i) => (
        <group key={i} position={[x, 0.25, z]} rotation-z={lean}>
          <mesh geometry={PROP_GEO.stalk} position-y={h / 2} scale={[1, h, 1]}><meshToonMaterial color="#6f8a3a" /></mesh>
          {[0.55, 0.75, 0.95].filter((k) => k * h < h).map((k) => (
            <group key={k} position-y={k * h}>
              {[0, 2.1, 4.2].map((a) => (
                <mesh key={a} geometry={PROP_GEO.leaf} position={[Math.cos(a + i) * 0.09, 0.02, Math.sin(a + i) * 0.09]}
                  rotation={[Math.sin(a + i) * 1.1, 0, -Math.cos(a + i) * 1.1]}>
                  <meshToonMaterial color={i % 2 ? '#4f7a32' : '#5f8c3a'} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}
/** plastic crates of empty bottles (P箱), stacked by the kitchen's end, where the stock's seen to */
function BottleCrates() {
  return (
    <group>
      {[0, 1].map((k) => (
        <group key={k} position={[k * 0.04 - 0.02, k * 0.2, 0]} rotation-y={k * 0.12}>
          <Inked geometry={PROP_GEO.crate} color={k ? '#b8322a' : '#c0442e'} position-y={0.1} />
          {[-0.1, 0, 0.1].flatMap((x) => [-0.06, 0.06].map((z) => (
            <mesh key={`${x}${z}`} geometry={PROP_GEO.bottle} position={[x, 0.17, z]}><meshToonMaterial color="#3a2a1a" /></mesh>
          )))}
        </group>
      ))}
    </group>
  )
}
/**
 * What stands about the room besides the counters (the shop's own frame): sake barrels stacked in the open corner past
 * the kitchen, a pot of bamboo at the dead end of the side counter's aisle, and the empty-bottle crates at the
 * kitchen's end — all of it on the floor out of everyone's way, and facing the room.
 */
export function ShopProps({ counters }: { counters: Counter[] }) {
  const c0 = counters[0]
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(c0.along, along).addScaledVector(c0.lay, lay)
  // (their fronts toward the room's open side, where the camera is)
  const face = Math.atan2(-c0.lay.x, -c0.lay.z)
  return (
    <StaticBatch>
      <group position={at(3.3, 3.2)} rotation-y={face + 0.3}>
        <group position-x={-0.21}><SakeBarrel /></group>
        <group position-x={0.21} rotation-y={0.4}><SakeBarrel /></group>
        <group position-y={0.43} rotation-y={-0.2}><SakeBarrel /></group>
      </group>
      <group position={at(-3.6, 3.6)}><PottedBamboo /></group>
      <group position={at(1.45, 0.62)} rotation-y={face}><BottleCrates /></group>
    </StaticBatch>
  )
}
