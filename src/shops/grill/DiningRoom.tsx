import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from '@/scene/quality'
import type { Counter } from './bar'

/**
 * The customers' side of the room, behind the aisle: a wall of cream plaster over a dark wooden wainscot, a row of
 * wooden menu tags brushed with the dishes and drinks, a shelf of sake bottles, crocks and a beckoning cat, and paper
 * pendant lamps hung low over the bar that light the customers warmly. Seen from behind (the camera swung round),
 * the wall isn't drawn, so it never hides the bar.
 */

const INK = '#2a1a10'
const WP = new THREE.Vector3()
const NORMAL = new THREE.Vector3()
const WALL_H = 2.3
const WAINSCOT = 0.85

/** what's brushed on the wall's menu tags (the drinks and sides a robatayaki has up) */
const TAGS = ['鹽烤鯖魚', '秋刀魚', '鮭魚', '香魚', '烤飯糰', '雞肉串', '味噌湯', '生啤酒', '清酒', '燒酎', '烏龍茶', '毛豆']

/** one tag's face: pale hinoki, the name brushed down it in black, a red price seal at the foot */
function tagTexture(name: string) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#ead6b0'
  g.fillRect(0, 0, 64, 256)
  g.strokeStyle = 'rgba(120,80,40,0.18)'
  for (let k = 0; k < 7; k++) {
    g.beginPath()
    g.moveTo(6 + k * 9, 0)
    g.bezierCurveTo(2 + k * 9, 90, 12 + k * 9, 170, 6 + k * 9, 256)
    g.stroke()
  }
  g.fillStyle = '#1d140c'
  const size = name.length > 3 ? 40 : 46
  g.font = `bold ${size}px "Zen Antique", "Noto Serif TC", serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const span = Math.min(200, name.length * (size + 4))
  ;[...name].forEach((ch, i) => g.fillText(ch, 32, 20 + size / 2 + (i * span) / name.length))
  g.fillStyle = '#b8261c'
  g.fillRect(22, 228, 20, 20)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
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

/** a beckoning cat (招き猫): white, a red collar and its paw up */
function LuckyCat({ x }: { x: number }) {
  return (
    <group position={[0, 0, x]} rotation-y={-Math.PI / 2}>
      <mesh position-y={0.07} scale={[1, 1.1, 0.85]}>
        <sphereGeometry args={[0.065, 14, 10]} />
        <meshToonMaterial color="#f7f3ea" />
      </mesh>
      <mesh position-y={0.17}>
        <sphereGeometry args={[0.058, 14, 10]} />
        <meshToonMaterial color="#f7f3ea" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.035, 0.22, 0]} rotation-z={-s * 0.3}>
          <coneGeometry args={[0.018, 0.035, 4]} />
          <meshToonMaterial color="#f7f3ea" />
        </mesh>
      ))}
      <mesh position-y={0.12} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.045, 0.008, 6, 16]} />
        <meshToonMaterial color="#c8281e" />
      </mesh>
      <mesh position={[0.06, 0.2, 0.01]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshToonMaterial color="#f7f3ea" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.02, 0.18, 0.052]}>
          <sphereGeometry args={[0.007, 6, 4]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      ))}
    </group>
  )
}

/** a paper pendant lamp over the bar, lit (and lighting the customers below it when it carries a light) */
function Pendant({ z, drop, light }: { z: number; drop: number; light: boolean }) {
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
        {light && QUALITY.tier !== 'low' && <pointLight color="#ffc37a" intensity={5} distance={5} decay={1} position-y={-0.1} />}
      </group>
    </group>
  )
}

/**
 * One counter's stretch of the room: the wall behind its aisle (from/to along it, in the counter's own frame), and
 * pendant lamps over it.
 */
export function DiningWall({ c, from, to, far, lamps }: { c: Counter; from: number; to: number; far: number; lamps: number }) {
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
  // (as many tags as fit across the wall's middle, a little apart)
  const tags = useMemo(() => {
    const n = Math.min(TAGS.length, Math.floor((l - 1.2) / 0.2))
    const start = Math.round(c.length * 7) % TAGS.length
    return Array.from({ length: n }, (_, i) => {
      const name = TAGS[(start + i) % TAGS.length]
      return { name, z: mid + (i - (n - 1) / 2) * 0.2, map: tagTexture(name) }
    })
  }, [l, mid, c.length])
  const shelfZ = mid + l * 0.3
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
        {[from, mid - l / 6, mid + l / 6, to].map((z) => (
          <Box key={z} size={[0.07, WALL_H, 0.08]} color="#3a2416" position={[-0.03, WALL_H / 2, z]} />
        ))}
        {/* the menu tags hung in a row on the plaster */}
        {tags.map((tg) => (
          <mesh key={tg.z} position={[-0.012, 1.55, tg.z]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[0.13, 0.52]} />
            <meshToonMaterial color="#ffffff" map={tg.map} />
          </mesh>
        ))}
        {/* the shelf: sake bottles, two crocks and the cat */}
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
          <LuckyCat x={0.3} />
        </group>
      </group>
      {/* pendant lamps over the bar's customer side, low */}
      {Array.from({ length: lamps }, (_, i) => {
        const z = (i - (lamps - 1) / 2) * (c.length / lamps)
        return <group key={i} position-x={0.05}><Pendant z={z} drop={0.5} light /></group>
      })}
    </group>
  )
}
