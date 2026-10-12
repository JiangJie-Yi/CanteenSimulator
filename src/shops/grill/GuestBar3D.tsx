import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { StaticBatch } from '@/scene/StaticBatch'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GuestView } from '@/game/types'
import { MoodFace } from '@/ui/MoodFace'
import { guestLabel } from '@/data/guests'
import { Person } from '@/scene/Person3D'
import type { Lang } from '@/data/i18n'
import { CLOUD_WARE, wareGeometry } from './ware'
import { DiningWall } from './DiningRoom'
import { LuckyCat } from './LuckyCat'
import { SAY_EACH, sayChunks } from '@/game/say'
import { FLOOR_FAR, FLOOR_NEAR, PLATES_SET, alongPath, doorOf, pathLength, pathTo, seatsOf, singleCounter, type Counter } from './bar'

/*
 * The customers, in 3D, at the bar behind the cooking (only while the shop is open). A long counter of pale hinoki
 * on a dark panelled front, stools along the far side; a customer walks in from the end of the bar, sits on a free
 * stool facing the cook, waits ("…"), eats (leaning in, chopsticks going), and when they're done gets up and walks
 * off — their face says how it was. They're dressed as what they are (guests.ts).
 *
 * The plates are handled for real: a stack of clean ones at the left end of the bar; as a customer sits down one is
 * lifted off the top and set in front of them; when they get up it's cleared onto the dirty stack at the right
 * end, which, once it's grown, is taken back to be washed and comes back to the clean stack plate by plate.
 */

const LAY = new THREE.Vector3(0.59, 0, 0.81)       // toward the camera (the cook's side)
const ALONG = new THREE.Vector3(0.81, 0, -0.59)    // along the first counter
const SPEED = 1.5                                   // how fast they walk in and out (per second)
const INK = '#3b2a20'

/** toon material, and its ink outline (a slightly bigger back-faced shell) */
function Part({ geo, color, outline = 1.06, ...rest }: { geo: THREE.BufferGeometry; color: string; outline?: number } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geo} castShadow>
        <meshToonMaterial color={color} />
      </mesh>
      {outline > 0 && (
        <mesh geometry={geo} scale={outline}>
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  )
}

const GEO = {
  seat: new THREE.CylinderGeometry(0.11, 0.1, 0.03, 20),
  stoolLeg: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
}

/** the customers (and their stools) at life size beside the bar, which is drawn to match them */
const PEOPLE_SCALE = 1.3

/** the noren's cloth: deep indigo, a white band of the shop's mark across its three panels, faded at the hem */
const norenTexture = (mark: string) => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#1f2f55')
  grad.addColorStop(1, '#2b3f6e')
  g.fillStyle = grad
  g.fillRect(0, 0, 384, 256)
  // a fine weave
  g.strokeStyle = 'rgba(255,255,255,0.04)'
  for (let y = 0; y < 256; y += 3) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(384, y)
    g.stroke()
  }
  // the shop's name, one character on each outer panel, and a crest of waves in a ring on the middle one
  g.fillStyle = '#f4efe2'
  g.font = 'bold 76px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const [a, b] = [...mark]
  g.fillText(a ?? '', 64, 110)
  g.fillText(b ?? '', 320, 110)
  g.strokeStyle = '#f4efe2'
  g.lineWidth = 6
  g.beginPath()
  g.arc(192, 104, 40, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3
  for (let q = 0; q < 3; q++) {
    g.beginPath()
    g.arc(192, 122, 10 + q * 9, Math.PI, Math.PI * 2)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** one panel's third of the noren cloth (a clone of the texture, offset) */
const panelTex = (tex: THREE.Texture | null, i: number) => {
  if (!tex) return null
  const key = `p${i}`
  const cache = (tex.userData.panels ??= {}) as Record<string, THREE.Texture>
  if (!cache[key]) {
    const t = tex.clone()
    t.repeat.set(1 / 3, 1)
    t.offset.set(i / 3, 0)
    t.needsUpdate = true
    cache[key] = t
  }
  return cache[key]
}
/** wide old floorboards for the passage in */
const PLANKS = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  for (let b = 0; b < 4; b++) {
    g.fillStyle = ['#8a6440', '#7d5a3a', '#94704a', '#836040'][b]
    g.fillRect(b * 32, 0, 32, 512)
    g.strokeStyle = 'rgba(40,25,15,0.25)'
    for (let k = 0; k < 6; k++) {
      g.beginPath()
      g.moveTo(b * 32 + 4 + k * 5, 0)
      g.bezierCurveTo(b * 32 + 2 + k * 5, 170, b * 32 + 8 + k * 5, 340, b * 32 + 4 + k * 5, 512)
      g.stroke()
    }
    g.fillStyle = 'rgba(30,18,10,0.6)'
    g.fillRect(b * 32, 0, 1.5, 512)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/**
 * The way in: a noren hanging just past the end of the bar, three panels that sway a little.
 */
export function Entrance({ at, mark }: { at: THREE.Vector3; mark: string }) {
  const lantern = mark === '聞野' ? '炭火' : mark
  const tex = useMemo(() => norenTexture(mark), [mark])
  const panels = useRef<(THREE.Mesh | null)[]>([])
  const yaw = Math.atan2(ALONG.x, ALONG.z)
  const W = 0.78, H = 1.5, NOREN = 0.62
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    panels.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.05
    })
  })
  return (
    <group position={at} rotation-y={yaw}>
      <StaticBatch>
      {/* beckoning cats either side of the way in, on little stands: a big white one and smaller gold and black ones */}
      {DOOR_CATS.map((k, i) => (
        <group key={i} position={[k.x, 0, k.z]} rotation-y={k.yaw}>
          <Part geo={REG_GEO.body} color="#5a3a24" outline={1.03} position={[0, k.stand / 2, 0]} scale={[0.16 * k.s, k.stand, 0.14 * k.s]} />
          <group position-y={k.stand} scale={k.s * 2.2}><LuckyCat body={k.body} paw={k.paw} /></group>
        </group>
      ))}
      {/* just inside, the doormat set flush into its recess: a dark stone well, a frame round it, the coir mat in it */}
      <Part geo={REG_GEO.body} color="#2b2620" outline={0} position={[0, 0.007, -0.22]} scale={[0.78, 0.006, 0.46]} />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Part geo={REG_GEO.body} color="#3a2416" outline={0} position={[sd * 0.38, 0.012, -0.22]} scale={[0.03, 0.012, 0.46]} />
          <Part geo={REG_GEO.body} color="#3a2416" outline={0} position={[0, 0.012, -0.22 + sd * 0.215]} scale={[0.79, 0.012, 0.03]} />
        </group>
      ))}
      <mesh position={[0, 0.0115, -0.22]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.66, 0.36]} />
        <meshToonMaterial color="#ffffff" map={DOORMAT} />
      </mesh>
      </StaticBatch>
      {/* a red lantern hung just outside, on the bar's side (the back wall is too close on the other, the till inside) */}
      <group position={[-0.3, 0, 0.47]}><Chochin mark={lantern} /></group>
      {/* the noren: three panels side by side, hung from a bamboo rod (no frame: it hangs in the way in by itself) */}
      <mesh position={[0, H - 0.05, 0.03]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, W, 8]} />
        <meshToonMaterial color="#c9a46a" />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <group key={k} position={[k * (W / 3), H - 0.05, 0.035]}>
          <mesh ref={(m) => { panels.current[k + 1] = m }} position-y={-NOREN / 2}>
            <planeGeometry args={[W / 3 - 0.012, NOREN]} />
            <meshToonMaterial map={panelTex(tex, k + 1)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** the coir doormat: tan bristle in ribs, a dark border, the shop's welcome (いらっしゃいませ) woven across it */
const DOORMAT = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 140
  const g = c.getContext('2d')!
  g.fillStyle = '#4a3020'
  g.fillRect(0, 0, 256, 140)
  g.fillStyle = '#a77d4c'
  g.fillRect(12, 12, 232, 116)
  for (let x = 14; x < 244; x += 6) {
    g.fillStyle = x % 12 ? 'rgba(90,60,30,0.28)' : 'rgba(255,230,180,0.14)'
    g.fillRect(x, 12, 3, 116)
  }
  g.fillStyle = '#4a3020'
  g.font = 'bold 22px "Noto Serif TC", serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('いらっしゃいませ', 128, 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/** the red paper lantern's skin: red washi with its ribs, and the shop's name brushed down it in black */
const chochinTexture = (mark: string) => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#9e1d14')
  grad.addColorStop(0.5, '#d8362a')
  grad.addColorStop(1, '#9e1d14')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  // the bamboo ribs it's wound on
  g.strokeStyle = 'rgba(70,10,5,0.35)'
  g.lineWidth = 2
  for (let y = 8; y < 256; y += 14) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(512, y)
    g.stroke()
  }
  // the name, down the side facing out (and again round the back)
  g.fillStyle = '#1a0d08'
  g.font = 'bold 84px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const chars = [...mark]
  for (const u of [128, 384]) chars.forEach((ch, i) => g.fillText(ch, u, 128 + (i - (chars.length - 1) / 2) * 92))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const CHOCHIN_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,120,70,0.8)')
  grad.addColorStop(0.35, 'rgba(255,80,40,0.3)')
  grad.addColorStop(1, 'rgba(255,60,30,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()
const CHOCHIN_GEO = (() => {
  // a barrel of paper, round in the middle and drawn in at top and bottom
  const pts = Array.from({ length: 13 }, (_, i) => {
    const y = i / 12
    return new THREE.Vector2(0.07 + 0.09 * Math.sin(Math.PI * y), y * 0.42 - 0.21)
  })
  return new THREE.LatheGeometry(pts, 24)
})()

/**
 * A red paper lantern (赤提灯) hung at the door on a little arm off a post, the shop's name on it, lit from inside:
 * it sways a touch and its glow breathes like the flame in it.
 */
function Chochin({ mark }: { mark: string }) {
  const tex = useMemo(() => chochinTexture(mark), [mark])
  const hang = useRef<THREE.Group>(null)
  const skin = useRef<THREE.MeshBasicMaterial>(null)
  const halo = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = 0.9 + 0.06 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 7.3 + 1.1)
    if (hang.current) hang.current.rotation.z = Math.sin(t * 0.9) * 0.04
    if (skin.current) skin.current.color.setScalar(f)
    if (halo.current) halo.current.material.opacity = 0.5 + (f - 0.9) * 2
  })
  return (
    <group>
      {/* hung straight from above on a long cord (no post) */}
      <group ref={hang} position={[-0.26, 1.9, 0]}>
        <mesh position-y={-0.37}>
          <cylinderGeometry args={[0.003, 0.003, 0.74, 4]} />
          <meshBasicMaterial color="#1a0d08" />
        </mesh>
        <group position-y={-1.04}>
          <mesh geometry={CHOCHIN_GEO}>
            <meshBasicMaterial ref={skin} map={tex} toneMapped={false} />
          </mesh>
          {/* the black lacquered rings top and bottom */}
          {[0.215, -0.215].map((y) => (
            <mesh key={y} position-y={y}>
              <cylinderGeometry args={[0.075, 0.075, 0.035, 18]} />
              <meshToonMaterial color="#1a0d08" />
            </mesh>
          ))}
          <sprite ref={halo} scale={0.9}>
            <spriteMaterial map={CHOCHIN_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.5} />
          </sprite>
        </group>
      </group>
    </group>
  )
}

/**
 * The till by the door (帳場): a counter of the bar's dark wood under a pale top with a rounded edge, set back on the
 * bar's side of the way in with room behind it for the cashier. On it the cash register (its keys, its drawer, the
 * customer's display), a card reader, a receipt printer with its paper curling out, a tray for the change, a cup of
 * pens, a little bell to ring, the お会計 sign facing the customers, and a beckoning cat (招き猫) for luck.
 */
const TILL = { W: 1.0, D: 0.5 }
function Register({ at, yaw, top }: { at: THREE.Vector3; yaw: number; top: number }) {
  const { W, D } = TILL
  return (
    <group position={at} rotation-y={yaw}>
      {/* (local x along the bar, +z toward the cashier, behind it) */}
      <Part geo={REG_GEO.body} color="#3a2a1e" outline={1.015} position={[0, (top - 0.05) / 2, 0.02]} scale={[W - 0.04, top - 0.05, D - 0.06]} />
      <Part geo={REG_GEO.round} color="#d9b884" outline={1.02} position={[0, top - 0.025, 0]} scale={[W + 0.06, 0.05, D + 0.04]} />
      {/* panels on its front, a kick board at its foot */}
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[k * (W / 3), (top - 0.05) / 2 + 0.02, -D / 2 + 0.028]} rotation-y={Math.PI}>
          <planeGeometry args={[W / 3 - 0.06, top - 0.2]} />
          <meshToonMaterial color="#4a3626" />
        </mesh>
      ))}
      <Part geo={REG_GEO.body} color="#22180f" outline={0} position={[0, 0.03, -D / 2 + 0.035]} scale={[W - 0.06, 0.06, 0.02]} />
      {/* the register: a sloped keyboard of keys, the drawer under it, the display turned to the customer */}
      <group position={[0.05, top, 0.06]} rotation-y={Math.PI}>
        <Part geo={REG_GEO.body} color="#5a6a66" position={[0, 0.035, 0]} scale={[0.26, 0.07, 0.24]} />
        <Part geo={REG_GEO.body} color="#3e4a46" outline={0} position={[0, 0.036, 0.121]} scale={[0.2, 0.03, 0.004]} />
        <Part geo={REG_GEO.body} color="#2f3634" outline={1.04} position={[0, 0.085, -0.03]} rotation-x={-0.35} scale={[0.22, 0.03, 0.15]} />
        {Array.from({ length: 12 }, (_, i) => (
          <Part key={i} geo={REG_GEO.body} color={i % 4 === 3 ? '#c8a050' : '#e8e2cf'} outline={0}
            position={[-0.07 + (i % 4) * 0.045, 0.103 + Math.floor(i / 4) * 0.016, -0.06 + Math.floor(i / 4) * 0.04]} rotation-x={-0.35}
            scale={[0.032, 0.008, 0.028]} />
        ))}
        <Part geo={REG_GEO.body} color="#2f3634" position={[0.06, 0.16, 0.08]} scale={[0.012, 0.09, 0.012]} />
        <group position={[0.06, 0.215, 0.08]} rotation-y={Math.PI}>
          <Part geo={REG_GEO.body} color="#2f3634" position={[0, 0, 0]} scale={[0.11, 0.05, 0.02]} />
          <mesh position-z={0.0105}><planeGeometry args={[0.09, 0.032]} /><meshBasicMaterial color="#7ad0a0" /></mesh>
        </group>
      </group>
      {/* the card reader, its screen and keys, by the register on the customers' side */}
      <group position={[-0.25, top, -0.1]} rotation-x={-0.25}>
        <Part geo={REG_GEO.round} color="#2a2c30" position-y={0.02} scale={[0.075, 0.04, 0.14]} />
        <mesh position={[0, 0.041, -0.03]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.055, 0.045]} /><meshBasicMaterial color="#9ad0f0" /></mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-0.016 + (i % 3) * 0.016, 0.041, 0.018 + Math.floor(i / 3) * 0.014]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.011, 0.009]} /><meshBasicMaterial color="#bfc4c8" />
          </mesh>
        ))}
      </group>
      {/* the receipt printer, a curl of paper out of its top */}
      <group position={[-0.25, top, 0.12]}>
        <Part geo={REG_GEO.round} color="#e8e6e0" position-y={0.04} scale={[0.12, 0.08, 0.13]} />
        <Part geo={REG_GEO.body} color="#2a2c30" outline={0} position={[0, 0.081, 0]} scale={[0.08, 0.002, 0.012]} />
        <mesh position={[0, 0.1, -0.012]} rotation-x={0.4}><planeGeometry args={[0.07, 0.05]} /><meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} /></mesh>
      </group>
      {/* the change tray, the cup of pens, the bell */}
      <Part geo={REG_GEO.round} color="#8a2a1e" outline={1.04} position={[0.05, top + 0.008, -0.17]} scale={[0.14, 0.012, 0.1]} />
      <group position={[-0.42, top, 0.12]}>
        <Part geo={REG_GEO.cup} color="#3a4a5a" position-y={0.03} />
        {[[-0.006, '#2a2a6a'], [0.007, '#a82a1e'], [0, '#2a2a2a']].map(([x, c], i) => (
          <mesh key={i} position={[x as number, 0.075, (i - 1) * 0.006]} rotation-z={(x as number) * 20}>
            <cylinderGeometry args={[0.003, 0.003, 0.09, 5]} /><meshToonMaterial color={c as string} />
          </mesh>
        ))}
      </group>
      <group position={[-0.42, top, -0.1]}>
        <Part geo={REG_GEO.ball} color="#d4b04a" position-y={0.012} scale={[0.6, 0.45, 0.6]} />
        <Part geo={REG_GEO.body} color="#2a2420" outline={0} position-y={0.004} scale={[0.06, 0.008, 0.06]} />
      </group>
      {/* the お会計 sign, in its little wooden stand, to the customers */}
      <group position={[0.3, top, -0.19]} rotation-y={Math.PI}>
        <Part geo={REG_GEO.body} color="#6a4428" position-y={0.006} scale={[0.14, 0.012, 0.05]} />
        <mesh position={[0, 0.05, 0]}><planeGeometry args={[0.12, 0.075]} /><meshToonMaterial color="#ffffff" map={PAY_SIGN} /></mesh>
      </group>
      {/* the beckoning cat, its paw up */}
      <group position={[0.4, top, 0.04]} rotation-y={Math.PI}><LuckyCat /></group>
    </group>
  )
}
/** the sign on the till: お会計 brushed on cream, with its Chinese under it */
const PAY_SIGN = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 100
  const g = c.getContext('2d')!
  g.fillStyle = '#f2e8d0'
  g.fillRect(0, 0, 160, 100)
  g.strokeStyle = '#6a4428'
  g.lineWidth = 6
  g.strokeRect(3, 3, 154, 94)
  g.fillStyle = '#1d140c'
  g.font = 'bold 40px "Zen Antique", "Noto Serif TC", serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('お会計', 80, 42)
  g.font = '20px "Noto Serif TC", serif'
  g.fillText('結帳', 80, 78)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/**
 * The cats at the door (in the entrance's frame: x across the way in, +x toward the back wall, which stands at x 0.5; +z out of the shop.
   The customers come in at x 0 and walk off down -z, so all of these sit just outside the noren, clear of them, the
 * wall and the till, which reaches out to z 0.26 between x -0.64 and -1.06)
 */
const DOOR_CATS = [
  { x: -0.36, z: 0.14, yaw: -0.3, s: 1.2, stand: 0.14, body: '#f6f3ea', paw: 'right' as const },
  { x: 0.34, z: 0.14, yaw: 0.3, s: 1.1, stand: 0.14, body: '#f6f3ea', paw: 'left' as const },
  { x: -0.46, z: 0.38, yaw: -0.2, s: 0.8, stand: 0.06, body: '#d9b04a', paw: 'left' as const },
  { x: 0.3, z: 0.38, yaw: 0.25, s: 0.75, stand: 0.06, body: '#2a2420', paw: 'right' as const },
]
const REG_GEO = {
  body: new THREE.BoxGeometry(1, 1, 1),
  round: new RoundedBoxGeometry(1, 1, 1, 3, 0.12),
  cup: new THREE.CylinderGeometry(0.025, 0.022, 0.06, 14),
  ball: new THREE.SphereGeometry(0.04, 14, 10),
  ear: new THREE.ConeGeometry(0.012, 0.026, 6),
  paw: new THREE.CapsuleGeometry(0.01, 0.03, 4, 8),
}

/**
 * The customers' side of the shop floored in wide old boards: one even rectangle under the whole bar, the row of
 * stools and the way along behind them to the noren, its boards running the length of the bar.
 */
function DiningFloor({ c, from, to, near = FLOOR_NEAR, far = FLOOR_FAR }: { c: Counter; from: number; to: number; near?: number; far?: number }) {
  const yaw = Math.atan2(c.along.x, c.along.z)
  const at = c.at
  // (in the floor's own frame: z along the bar, x away from the cook, so lay is -x)
  const w = near - far
  const l = to - from
  const map = useMemo(() => {
    if (!PLANKS) return null
    const t = PLANKS.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(w / 0.5, l / 2)
    t.needsUpdate = true
    return t
  }, [w, l])
  return (
    <group position={at} rotation-y={yaw}>
      <mesh rotation-x={-Math.PI / 2} position={[-(near + far) / 2, 0.004, (from + to) / 2]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshToonMaterial color="#ffffff" map={map} />
      </mesh>
      {/* a dark edging board round it, so it reads as a floor laid down, not a mat */}
      {[from, to].map((z) => (
        <mesh key={z} position={[-(near + far) / 2, 0.01, z]}>
          <boxGeometry args={[w + 0.04, 0.02, 0.04]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      ))}
      {[-near, -far].map((x) => (
        <mesh key={x} position={[x, 0.01, (from + to) / 2]}>
          <boxGeometry args={[0.04, 0.02, l + 0.04]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      ))}
    </group>
  )
}

/** the floor reaches this far under the counter, and back past the aisle */

function Stool() {
  return (
    <group>
      <Part geo={GEO.seat} color="#8a5a30" position={[0, 0.33, 0]} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return <mesh key={k} geometry={GEO.stoolLeg} position={[Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07]}><meshToonMaterial color="#5a3a20" /></mesh>
      })}
    </group>
  )
}

/** the counter itself (for the shops that don't draw their own): hinoki top, panelled dark front, a lip */
function Counter({ length }: { length: number }) {
  const top = useMemo(() => new THREE.BoxGeometry(length + 0.3, 0.07, 0.62), [length])
  const front = useMemo(() => new THREE.BoxGeometry(length + 0.2, 0.4, 0.5), [length])
  return (
    <group rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <Part geo={top} color="#d9b884" outline={1.02} position={[0, 0.43, 0]} />
      <Part geo={front} color="#3a2a1e" outline={1.01} position={[0, 0.2, 0]} />
      {Array.from({ length: Math.round(length / 0.6) }, (_, k) => (
        <mesh key={k} position={[-length / 2 + 0.3 + k * 0.6, 0.2, 0.252]}>
          <boxGeometry args={[0.46, 0.3, 0.01]} />
          <meshToonMaterial color="#4a3626" />
        </mesh>
      ))}
    </group>
  )
}

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave'; t: number }

/** a plate on its way to a seat ('serve'), set at it ('set'), or being cleared away ('clear', after a pause) */
type PlateRun = { key: number; seat: number; guest: number; phase: 'serve' | 'set' | 'clear'; t: number; from: THREE.Vector3
  /** (clearing) its place on the dirty stack, taken when it sets off, so two cleared at once don't aim for the same one */
  to?: THREE.Vector3 }
const STACK_GAP = 0.026
const CLEAN_START = 8
/** the dirty stack goes to be washed once it's this high (and nothing's on its way to it) */
const WASH_AT = 5
const SERVE_S = 0.55
const CLEAR_S = 0.6
const CLEAR_DELAY = 1.0
const WASH_S = 0.9
// (the same shape as the big plate by the fire, smaller: a foot, a shallow well, a lifted rim)
const PLATE_R = 0.13
const PLATE_GEO = wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.012], [0.47, 0.03], [0.5, 0.038], [0.49, 0.042], [0.44, 0.026],
  [0.3, 0.01], [0, 0.01]] as [number, number][]).map(([x, y]) => [x * PLATE_R * 2, y] as [number, number]), PLATE_R)
const SMEAR_GEO = new THREE.CircleGeometry(0.058, 18)
const USED_STICK_GEO = new THREE.CylinderGeometry(0.004, 0.003, 0.18, 5)

/** a customer's plate, of the shop's one set of painted ware (dirty: a smear of sauce and a used stick) */
function Plate({ dirty = false }: { dirty?: boolean }) {
  return (
    <group>
      <mesh geometry={PLATE_GEO} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={CLOUD_WARE} />
      </mesh>
      <mesh geometry={PLATE_GEO} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {dirty && (
        <>
          <mesh geometry={SMEAR_GEO} position={[0.03, 0.013, -0.02]} rotation-x={-Math.PI / 2} scale={[1.2, 0.8, 1]}>
            <meshBasicMaterial color="#8a5a32" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh geometry={USED_STICK_GEO} position={[-0.02, 0.018, 0.03]} rotation={[0, 0.6, Math.PI / 2]}>
            <meshToonMaterial color="#c9a46a" />
          </mesh>
        </>
      )}
    </group>
  )
}

export function GuestBar3D({ guests, at, length = 3.6, drawCounter = true, lang, top = 0.465, people = true, mark = '食堂', counters: given, scale = 1, offset,
  speech = {} }:
  { guests: GuestView[]; at: THREE.Vector3; length?: number; drawCounter?: boolean; lang: Lang
    /** where the customers sit (the first counter's middle is at, and its door past its far end); one of four if not given */
    counters?: Counter[]
    /** what's dyed on the noren at the door (its first character in the middle) */
    mark?: string
    /** the height of the bar top, where the plates go */
    top?: number
    /** draw the customers themselves (a phone shows them in 2D instead; the plates still come and go) */
    people?: boolean
    /** what each customer's saying just now, shown over their head */
    speech?: Record<number, { key: number; text: string }>
    /** drawn this much bigger, all of it */
    scale?: number
    /** and moved by this (after scaling) */
    offset?: THREE.Vector3 }) {
  const [shown, setShown] = useState<Shown[]>([])
  const guestsRef = useRef(guests)
  guestsRef.current = guests
  const groups = useRef(new Map<number, THREE.Group>())
  const clock = useRef(0)
  const counters = useMemo(() => given ?? singleCounter(at, length), [given, at, length])
  const seats = useMemo(() => seatsOf(counters), [counters])
  /** a couple sat side by side turn to talk: the one at the next stool along is on the left (+1), the one before on
   * the right (-1); 0 while the other isn't sat there yet (or has gone) */
  const talkSide = (s: Shown) => {
    const g = guests.find((x) => x.id === s.id)
    const o = g?.partner !== undefined ? shown.find((x) => x.id === g.partner && x.phase === 'sit') : undefined
    return s.phase === 'sit' && o ? Math.sign(o.seat - s.seat) : 0
  }
  const paths = useMemo(() => seats.map((st) => {
    const path = pathTo(counters, st)
    return { path, len: pathLength(path) }
  }), [counters, seats])
  const plateAt = (n: number) => seats[n].plate.clone().setY(top)
  const cleanAt = (k: number) => counters[0].at.clone().addScaledVector(ALONG, -counters[0].length / 2 + 0.25).addScaledVector(LAY, 0.11).setY(top + k * STACK_GAP)
  const dirtyAt = (k: number) => counters[0].at.clone().addScaledVector(ALONG, counters[0].length / 2 - 0.25).addScaledVector(LAY, 0.11).setY(top + k * STACK_GAP)

  // the plates: those out at the seats (or on their way), and the two stacks
  const [, setTick] = useState(0)
  const redraw = () => setTick((n) => n + 1)
  const runs = useRef<PlateRun[]>([])
  const runSeq = useRef(0)
  const runObjs = useRef(new Map<number, THREE.Group>())
  /** when each clean plate (bottom up) came back to the stack: it drops onto it */
  const clean = useRef<number[]>(Array.from({ length: CLEAN_START }, () => -9))
  const cleanObjs = useRef<(THREE.Group | null)[]>([])
  const dirty = useRef(0)
  const dirtyStack = useRef<THREE.Group>(null)
  const wash = useRef<number | null>(null)
  /** customers sat down waiting for a plate: there wasn't a clean one on the stack (they're being washed) */
  const waiting = useRef<{ seat: number; guest: number }[]>([])
  const serve = (seat: number, guest: number) => {
    // only a plate that's actually on the stack (not one still on its way back from the wash)
    const top = clean.current[clean.current.length - 1]
    if (top === undefined || clock.current < top + 0.25) {
      waiting.current.push({ seat, guest })
      return
    }
    const from = cleanAt(clean.current.length - 1)
    clean.current = clean.current.slice(0, -1)
    runs.current.push({ key: ++runSeq.current, seat, guest, phase: 'serve', t: 0, from })
    redraw()
  }
  /** this customer's plate is cleared away (after a moment); one still waiting for a plate needn't get one */
  const clear = (guest: number) => {
    waiting.current = waiting.current.filter((w) => w.guest !== guest)
    const r = runs.current.find((x) => x.guest === guest && x.phase !== 'clear')
    if (r) {
      r.phase = 'clear'
      r.t = -CLEAR_DELAY
    }
  }
  const shownRef = useRef<Shown[]>([])

  shownRef.current = shown
  useEffect(() => {
    // (the plates are seen to here, not in the state update below, which must stay free of side effects)
    for (const g of guests) {
      const s = shownRef.current.find((x) => x.id === g.id)
      if (s && g.state !== 'waiting' && g.state !== 'eating' && s.phase !== 'leave') clear(g.id)
    }
    setShown((cur) => {
      let next = [...cur]
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          const taken = new Set(next.map((x) => x.seat))
          // (the shop may have given them a stool already: it only does once the last one there has gone)
          const seat = g.seat !== undefined ? g.seat : Array.from({ length: seats.length }, (_, i) => i).find((i) => !taken.has(i))
          if (seat !== undefined) next.push({ id: g.id, seat, phase: 'enter', t: 0 })
        } else if (s && !seated && s.phase !== 'leave') {
          next = next.map((x) => (x.id === g.id ? { ...x, phase: 'leave', t: 0 } : x))
        }
      }
      return next
    })
  }, [guests])

  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.1)
    let done: number[] = []
    for (const s of shown) {
      s.t += Math.min(dt, 0.1)
      // (they come and go whether or not they're drawn: on a phone they aren't, but their plates still follow them)
      const g = groups.current.get(s.id)
      const st = seats[s.seat]
      if (!st) continue
      const { path, len } = paths[s.seat]
      if (s.phase === 'enter') {
        // in through the noren, along the aisle behind the stools (round the corner, for the other counter), and
        // in to their own stool
        const d = Math.min(len, s.t * SPEED)
        const { p, dir } = alongPath(path, d)
        g?.position.copy(p)
        if (g) g.rotation.y = d < len ? Math.atan2(dir.x, dir.z) : st.yaw
        if (d >= len) {
          s.phase = 'sit'
          // a plate is set in front of them
          serve(s.seat, s.id)
        }
      } else if (s.phase === 'sit') {
        g?.position.copy(st.stool)
        if (g) g.rotation.y = st.yaw
      } else {
        // a moment to get up, then off the way they came
        const d = Math.max(0, Math.min(len, (s.t - 0.8) * SPEED))
        const { p, dir } = alongPath(path, len - d)
        g?.position.copy(p)
        if (g) g.rotation.y = s.t < 0.8 ? st.yaw : Math.atan2(-dir.x, -dir.z)
        if (d >= len) done.push(s.id)
      }
    }
    if (done.length) setShown((cur) => cur.filter((x) => !done.includes(x.id)))
    done = []

    // anyone who sat down while the stack was empty gets a plate as soon as there's one back on it
    const top = clean.current[clean.current.length - 1]
    if (waiting.current.length && top !== undefined && clock.current >= top + 0.25) {
      const w = waiting.current.shift()!
      serve(w.seat, w.guest)
    }

    // the plates on the move: lifted off the stack in an arc to the seat, and cleared away to the dirty stack
    const step = Math.min(dt, 0.1)
    let finished = 0
    for (const r of runs.current) {
      r.t += step
      const o = runObjs.current.get(r.key)
      if (r.phase === 'set' || r.phase === 'clear' && r.t < 0) {
        if (r.phase === 'set') o?.position.copy(plateAt(r.seat))
        continue
      }
      if (r.phase === 'clear' && !r.to) {
        // setting off: from where it is, to the next free place on the dirty stack
        if (o) r.from = o.position.clone()
        const flying = runs.current.filter((x) => x !== r && x.phase === 'clear' && x.to && x.t !== Infinity).length
        r.to = dirtyAt(dirty.current + flying)
      }
      const to = r.phase === 'clear' ? r.to! : plateAt(r.seat)
      const k = Math.min(1, r.t / (r.phase === 'serve' ? SERVE_S : CLEAR_S))
      const e = k * k * (3 - 2 * k)
      if (o) {
        o.position.lerpVectors(r.from, to, e)
        o.position.y += Math.sin(Math.PI * k) * 0.22
        o.rotation.z = Math.sin(Math.PI * k) * 0.12
      }
      if (k >= 1) {
        if (r.phase === 'serve') r.phase = 'set'
        else {
          r.t = Infinity
          finished++
        }
      }
    }
    // (which seats have their plate down, for what's being served to them)
    PLATES_SET.clear()
    for (const r of runs.current) if (r.phase === 'set' || r.phase === 'clear' && r.t < 0) PLATES_SET.add(r.seat)
    if (finished) {
      runs.current = runs.current.filter((r) => r.t !== Infinity)
      dirty.current += finished
      redraw()
    }
    // the dirty stack, once it's grown, goes back to be washed (toward the kitchen and down out of sight); it comes
    // back clean, one plate at a time, onto the clean stack
    // (and straight away when the clean stack has run out)
    if (wash.current === null && (dirty.current >= WASH_AT || dirty.current > 0 && !clean.current.length) &&
      !runs.current.some((r) => r.phase === 'clear' && r.t >= 0)) wash.current = 0
    if (wash.current !== null) {
      wash.current += step
      const k = Math.min(1, wash.current / WASH_S)
      const e = k * k * (3 - 2 * k)
      dirtyStack.current?.position.set(0, -0.5 * e, 0).addScaledVector(LAY, 0.7 * e)
      if (k >= 1) {
        const n = dirty.current
        dirty.current = 0
        wash.current = null
        dirtyStack.current?.position.set(0, 0, 0)
        const now = clock.current
        clean.current = [...clean.current, ...Array.from({ length: n }, (_, i) => now + 1.2 + i * 0.35)]
        redraw()
      }
    }
    // clean plates coming back drop onto the stack
    clean.current.forEach((born, i) => {
      const o = cleanObjs.current[i]
      if (!o) return
      const k = Math.max(0, Math.min(1, (clock.current - born) / 0.25))
      o.visible = clock.current >= born
      o.position.copy(cleanAt(i)).y += (1 - k * k) * 0.3
    })
  })

  return (
    <group scale={scale} position={offset}>
      {drawCounter && <group position={at}><Counter length={length} /></group>}
      {counters.map((c, i) => {
        // the first counter's floor runs on past its end to the door, and back to meet the others' aisles; each other
        // one's runs up to the first one's
        const c0 = counters[0]
        if (i === 0) {
          const back = Math.min(-c.length / 2 - 0.35, ...counters.slice(1).map((o) =>
            o.at.clone().addScaledVector(o.lay, FLOOR_FAR).sub(c.at).dot(c.along)))
          return (
            <group key={i}>
              <DiningFloor c={c} from={back} to={c.length / 2 + 1.45} />
              {/* (and past the bar's end, a strip more behind the till for the cashier to stand on) */}
              {given && <DiningFloor c={c} from={c.length / 2 + 0.15} to={c.length / 2 + 1.45} near={1.1} far={FLOOR_NEAR} />}
              {given && <DiningWall c={c} from={back} to={c.length / 2 + 1.45} far={FLOOR_FAR} lamps={4} top={top} shrine={back + 1.0} />}
            </group>
          )
        }
        const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
        // (where its wall's line reaches the first counter's wall)
        const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(c0.lay)) / c.along.dot(c0.lay)
        return (
          <group key={i}>
            <DiningFloor c={c} from={-c.length / 2 - 0.35} to={meet} />
            {/* (its wall runs on into the corner, to meet the first counter's: the toilet's door in that stretch) */}
            {given && <DiningWall c={c} from={-c.length / 2 - 0.35} to={corner} far={FLOOR_FAR} lamps={2} top={top} door={(meet + corner) / 2} />}
          </group>
        )
      })}
      {/* the way in, just past the end of the bar where the customers come and go */}
      <Entrance at={doorOf(counters)} mark={mark} />
      {/* the till, just inside the door on the bar's side of the way in (the shops that lay out their own counters) */}
      {given && (
        <StaticBatch>
          <Register top={top} yaw={Math.atan2(-counters[0].along.z, counters[0].along.x)}
            at={counters[0].at.clone().addScaledVector(counters[0].along, counters[0].length / 2 + 0.95).addScaledVector(counters[0].lay, 0.1)} />
        </StaticBatch>
      )}
      <StaticBatch key={seats.length}>
        {seats.map((st, n) => (
          <group key={n} position={st.stool} rotation-y={st.yaw} scale={PEOPLE_SCALE}><Stool /></group>
        ))}
      </StaticBatch>
      {/* the clean stack, the dirty one, and the plates out at the seats */}
      {clean.current.map((_, i) => (
        <group key={`c${i}`} ref={(o) => { cleanObjs.current[i] = o; if (o && !o.userData.placed) { o.userData.placed = true; o.position.copy(cleanAt(i)) } }}>
          <Plate />
        </group>
      ))}
      <group ref={dirtyStack}>
        {Array.from({ length: dirty.current }, (_, i) => (
          <group key={`d${i}`} position={dirtyAt(i)} rotation-y={i * 0.9}><Plate dirty /></group>
        ))}
      </group>
      {runs.current.map((r) => (
        <group key={r.key} ref={(o) => {
          if (!o) return void runObjs.current.delete(r.key)
          runObjs.current.set(r.key, o)
          if (!o.userData.placed) {
            o.userData.placed = true
            o.position.copy(r.from)
          }
        }}>
          <Plate dirty={r.phase === 'clear'} />
        </group>
      ))}
      {people && shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const walking = s.phase !== 'sit'
        return (
          <group key={s.id} ref={(o) => { if (o) groups.current.set(s.id, o); else groups.current.delete(s.id) }}>
            <group scale={PEOPLE_SCALE}>
              <PersonClock s={s} eating={() => s.phase === 'sit' && guestsRef.current.find((x) => x.id === s.id)?.state === 'eating'} clock={clock}
                talk={talkSide(s)} />
            </group>
            <Html position={[0, 1.05 * PEOPLE_SCALE, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
              <div className="g3-label">
                {speech[s.id] ? <Say key={speech[s.id].key} text={speech[s.id].text} />
                  : g && !walking && g.state === 'waiting' && g.rating === null && <span className="g3-bubble">…</span>}
                {g && g.rating !== null && <MoodFace guest={g} />}
                <span>{g?.partner !== undefined && <i className="g3-heart">♥</i>}{guestLabel(s.id, lang)}</span>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/** a short line at a time, so a long one says itself in turn over their head rather than in a tall thin column */
function Say({ text }: { text: string }) {
  const chunks = useMemo(() => sayChunks(text), [text])
  const [i, setI] = useState(0)
  useEffect(() => {
    if (i >= chunks.length - 1) return
    const h = window.setTimeout(() => setI(i + 1), SAY_EACH * 1000)
    return () => window.clearTimeout(h)
  }, [i, chunks.length])
  return <span key={i} className="g3-bubble g3-say">{chunks[i]}{i < chunks.length - 1 ? '…' : ''}</span>
}

/** one customer's figure, moved by the bar's clock each frame (read from the ref: nothing re-renders for it) */
function PersonClock({ s, eating, clock, talk }: { s: Shown; eating: () => boolean; clock: { current: number }; talk: number }) {
  return <Person id={s.id} eating={eating()} walking={s.phase !== 'sit'} clock={clock} talk={talk} />
}
