import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { StaticBatch } from '@/scene/StaticBatch'
import { FloorPiece } from '@/scene/FloorPiece'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GuestView } from '@/game/types'
import { MoodFace } from '@/ui/MoodFace'
import { guestLabel, kindOf } from '@/data/guests'
import { Person, StaffFigure } from '@/scene/Person3D'
import { moodOf, walkSpeedOf } from '@/scene/people'
import { BlobShadow } from '@/scene/BlobShadow'
import { brushText, followSign, signTexture } from '@/scene/signFont'
import type { Look as StaffLook } from '@/data/staff'
import type { Lang } from '@/data/i18n'
import { inkModel } from '@/scene/inkHull'
import { CLOUD_WARE, wareGeometry } from './ware'
import { DiningWall, DrinkBottle, DrinkFridge, FridgeDoor, FridgeStock, ShopProps } from './DiningRoom'
import { LuckyCat } from './LuckyCat'
import { SAY_EACH, sayChunks } from '@/game/say'
import { SHOP } from '@/game/shopState'
import { PLATE_STACK_Y, staffDoorAt, takeDrink, KITCHEN_DROP, kitchenOf, kitchenGatesOf, AISLE, FLOOR_FAR, FLOOR_NEAR, PLATES_SET, PLATE_STACKS, GENKAN, inGenkan, sauceSide, SEATS_TAKEN, SERVICE, BAR_GATES, TILL, TOILETS, DRINKS, FRIDGE, FRIDGE_STATE, drinkFor, farOf, fridgesOf, fridgeUnitOf, gateOf, toiletsOf, type DrinkId, passOf, roomOf, alongPath, doorOf, pathLength, pathTo, seatsOf, singleCounter, type Counter } from './bar'

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
const SERVER_SPEED = 2.1                            // and the servers, carrying (brisk)
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


/** the customers (and their stools) at life size beside the bar, which is drawn to match them */
const PEOPLE_SCALE = 1.3

/** the noren's cloth: deep indigo, a white band of the shop's mark across its three panels, faded at the hem */
const norenTexture = (mark: string) => signTexture(384, 256, (g) => {
  // indigo dyed cloth, darker at the top where it's hung, a fine weave, the dye gone uneven
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#17244a')
  grad.addColorStop(0.7, '#25396a')
  grad.addColorStop(1, '#31487c')
  g.fillStyle = grad
  g.fillRect(0, 0, 384, 256)
  g.strokeStyle = 'rgba(255,255,255,0.05)'
  for (let y = 0; y < 256; y += 3) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(384, y)
    g.stroke()
  }
  g.strokeStyle = 'rgba(0,0,10,0.12)'
  for (let x = 0; x < 384; x += 4) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, 256)
    g.stroke()
  }
  // the shop's name, one character on each outer panel, big and bold in the sign font, white dye with a soft
  // shadow in the cloth; and a crest of waves in a ring on the middle one
  const [a, b] = [...mark]
  brushText(g, a ?? '', 64, 116, 112, { fill: '#f6f0e0', shadow: 'rgba(5,10,30,0.6)' })
  brushText(g, b ?? '', 320, 116, 112, { fill: '#f6f0e0', shadow: 'rgba(5,10,30,0.6)' })
  g.strokeStyle = '#f4efe2'
  g.lineWidth = 7
  g.beginPath()
  g.arc(192, 108, 46, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3.4
  for (let q = 0; q < 4; q++) {
    g.beginPath()
    g.arc(192, 128, 9 + q * 8, Math.PI, Math.PI * 2)
    g.stroke()
  }
})
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
    followSign(tex, t)
    cache[key] = t
  }
  return cache[key]
}

/**
 * The way in: a noren hanging just past the end of the bar, three panels that sway a little.
 */
export function Entrance({ at, mark }: { at: THREE.Vector3; mark: string }) {
  const lantern = mark === '聞野' ? '炭火' : mark
  const tex = useMemo(() => norenTexture(mark), [mark])
  const panels = useRef<(THREE.Mesh | null)[]>([])
  const yaw = Math.atan2(ALONG.x, ALONG.z)
  // (hung high, its rod well over a customer's head: they duck through only its hem)
  // (the doorway wide, its middle a little off the way in toward the till: the wall's close on the other side)
  const W = 1.05, H = 1.95, NOREN = 0.68, DX = -0.12
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    panels.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.05
    })
  })
  return (
    <group name="look-door" position={at} rotation-y={yaw}>
      <StaticBatch>
      {/* just inside, against the wall: a two-tier stand of dark wood, the beckoning cats on it facing those coming in */}
      <group position={[0.4, 0, -0.75]}>
        {/* (its back against the wall, 0.1 behind its middle: the lower tier deep, the upper shallow and narrower) */}
        {[[-0.01, 0.22, 0.32, 0.62], [0.04, 0.12, 0.6, 0.5]].map(([x, d, h, l], i) => (
          <Part key={i} geo={REG_GEO.round} color={i ? '#4a2e1c' : '#5a3a24'} outline={1.02} position={[x, h / 2, 0]} scale={[d, h, l]} />
        ))}
        {DOOR_CATS.map((k, i) => (
          <group key={i} position={[k.x, k.y, k.z]} rotation-y={-Math.PI / 2 + k.yaw}><LuckyCat kind={k.kind} height={k.h} still /></group>
        ))}
      </group>
      {/* just inside, the doormat set flush into its recess: a dark stone well, a frame round it, the coir mat in it */}
      {/* the coir mat lying on the genkan's stone, just inside */}
      <mesh position={[0, -GENKAN.depth + 0.009, -0.18]} rotation-x={-Math.PI / 2} scale={[-1, 1, 1]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshToonMaterial color="#ffffff" map={DOORMAT} />
      </mesh>
      {/* the shoe cupboard (下駄箱) against the wall in the genkan: dark wood, its doors in a grid of small panels, a
          vase of a sprig on top */}
      <group position={[0.34, -GENKAN.depth, -0.24]}>
        <Part geo={REG_GEO.round} color="#4a2e1c" outline={1.02} position={[0, 0.42, 0]} scale={[0.3, 0.84, 0.42]} />
        {[0, 1, 2].map((r) => [-1, 1].map((sd) => (
          <group key={`${r}${sd}`} position={[-0.152, 0.16 + r * 0.25, sd * 0.1]}>
            <mesh rotation-y={-Math.PI / 2}><planeGeometry args={[0.17, 0.21]} /><meshToonMaterial color="#6a4428" /></mesh>
            <mesh position={[-0.004, 0, -sd * 0.06]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.008, 0.008, 0.008, 8]} /><meshToonMaterial color="#c8a050" /></mesh>
          </group>
        )))}
        <Part geo={REG_GEO.round} color="#3a2416" outline={1.02} position={[0, 0.855, 0]} scale={[0.32, 0.03, 0.44]} />
        <mesh position={[0, 0.93, 0.05]}><cylinderGeometry args={[0.03, 0.04, 0.12, 12]} /><meshToonMaterial color="#e8e2d2" /></mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[Math.cos(k * 2) * 0.02, 1.04 + k * 0.02, 0.05 + Math.sin(k * 2) * 0.02]} rotation={[Math.sin(k * 2) * 0.4, 0, Math.cos(k * 2) * 0.4]}>
            <cylinderGeometry args={[0.003, 0.004, 0.16, 4]} /><meshToonMaterial color="#5a3a1e" />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((k) => (
          <mesh key={`b${k}`} position={[Math.cos(k * 1.7) * 0.05, 1.1 + (k % 2) * 0.03, 0.05 + Math.sin(k * 1.7) * 0.05]}><sphereGeometry args={[0.014, 6, 5]} /><meshToonMaterial color="#f2b0c0" /></mesh>
        ))}
      </group>
      </StaticBatch>
      <group position-x={DX}>
      {/* the doorway: the noren's rod, and the red lantern hung by the doorway on the bar's side */}
      {/* (no posts: the rod hangs by a cord at each end from the beam above, and the lantern by its own) */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (W / 2), H - 0.05 + 0.18, 0.03]}><cylinderGeometry args={[0.004, 0.004, 0.36, 4]} /><meshBasicMaterial color="#2a1a10" /></mesh>
      ))}
      <group position={[-(W / 2 + 0.05) + 0.26, H - 0.08 - 2.25, 0.47]}><Chochin mark={lantern} /></group>
      {/* the noren: three panels side by side, hung from a bamboo rod under the lintel */}
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
    </group>
  )
}

/** the coir doormat: tan bristle in ribs, a dark border, the shop's welcome (いらっしゃいませ) woven across it */
const DOORMAT = (() => signTexture(256, 140, (g) => {
  g.fillStyle = '#4a3020'
  g.fillRect(0, 0, 256, 140)
  g.fillStyle = '#a77d4c'
  g.fillRect(12, 12, 232, 116)
  for (let x = 14; x < 244; x += 6) {
    g.fillStyle = x % 12 ? 'rgba(90,60,30,0.28)' : 'rgba(255,230,180,0.14)'
    g.fillRect(x, 12, 3, 116)
  }
  brushText(g, 'いらっしゃいませ', 128, 70, 26, { fill: '#3a2414', shadow: 'rgba(255,230,180,0.35)', spacing: 2 })
}))()

/** the red paper lantern's skin: red washi with its ribs, and the shop's name brushed down it in black */
const chochinTexture = (mark: string) => signTexture(512, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#8a1810')
  grad.addColorStop(0.5, '#e03a2c')
  grad.addColorStop(1, '#8a1810')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  // the bamboo ribs it's wound on
  g.strokeStyle = 'rgba(70,10,5,0.4)'
  g.lineWidth = 2
  for (let y = 8; y < 256; y += 14) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(512, y)
    g.stroke()
  }
  // the name, down the side facing out (and again round the back): a signwriter's black, edged in gold leaf, with a
  // glow of the lamp behind it
  const chars = [...mark]
  for (const u of [128, 384]) chars.forEach((ch, i) =>
    brushText(g, ch, u, 128 + (i - (chars.length - 1) / 2) * 100, 104, { fill: '#160a06', edge: 'rgba(245,200,110,0.55)', shadow: 'rgba(255,170,90,0.35)' }))
})
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
      <group ref={hang} name="look-chochin" position={[-0.26, 2.25, 0]}>
        <mesh position-y={-0.075}>
          <cylinderGeometry args={[0.003, 0.003, 0.15, 4]} />
          <meshBasicMaterial color="#1a0d08" />
        </mesh>
        <group position-y={-0.36}>
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
 * customers' display), a card reader, a receipt printer with its paper curling out, a tray for the change, a cup of
 * pens, a little bell to ring, the お会計 sign facing the customers, and a beckoning cat (招き猫) for luck.
 */
/** the warm light washing down the till's front from under its top: bright at the top, fading out */
const TILL_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, 'rgba(255,214,150,0.55)')
  grad.addColorStop(1, 'rgba(255,214,150,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 64)
  return new THREE.CanvasTexture(c)
})()
export function Register({ at, yaw, top }: { at: THREE.Vector3; yaw: number; top: number }) {
  const { W, D } = TILL
  return (
    <group position={at} rotation-y={yaw}>
      {/* (local x along the bar, +z toward the cashier, behind it) */}
      {/* its body hollow, open on the cashier's side: the front, the two ends, a shelf low inside and one under the top,
          for the till roll, the bags and the cash box */}
      <Part geo={REG_GEO.body} color="#3a2a1e" outline={1.015} position={[0, (top - 0.05) / 2, -D / 2 + 0.06]} scale={[W - 0.04, top - 0.05, 0.08]} />
      {[-1, 1].map((sd) => (
        <Part key={sd} geo={REG_GEO.body} color="#3a2a1e" outline={1.015} position={[sd * (W / 2 - 0.05), (top - 0.05) / 2, 0.02]} scale={[0.06, top - 0.05, D - 0.06]} />
      ))}
      <Part geo={REG_GEO.body} color="#4a3626" outline={0} position={[0, 0.1, 0.03]} scale={[W - 0.14, 0.03, D - 0.14]} />
      <Part geo={REG_GEO.body} color="#4a3626" outline={0} position={[0, top - 0.2, 0.04]} scale={[W - 0.14, 0.025, D - 0.2]} />
      {/* on the shelves: a stack of paper bags, a box of till rolls, the cash box */}
      <Part geo={REG_GEO.body} color="#c8a878" outline={1.02} position={[-0.3, 0.17, 0.12]} scale={[0.22, 0.11, 0.16]} />
      <Part geo={REG_GEO.body} color="#e8e2d2" outline={1.02} position={[0.05, 0.16, 0.1]} scale={[0.14, 0.09, 0.12]} />
      <Part geo={REG_GEO.body} color="#2a3442" outline={1.02} position={[0.3, top - 0.155, 0.08]} scale={[0.2, 0.065, 0.16]} />
      {/* a thick top of pale hinoki, overhanging its front, a warm light hidden under the overhang washing down the front */}
      <Part geo={REG_GEO.round} color="#d9b884" outline={1.02} position={[0, top - 0.03, -0.03]} scale={[W + 0.1, 0.06, D + 0.1]} />
      <mesh position={[0, top - 0.075, -D / 2 - 0.0]} rotation-y={Math.PI}><planeGeometry args={[W - 0.1, 0.025]} /><meshBasicMaterial color="#ffd89a" toneMapped={false} /></mesh>
      <mesh position={[0, top - 0.22, -D / 2 + 0.018]} rotation-y={Math.PI}><planeGeometry args={[W - 0.06, 0.3]} /><meshBasicMaterial map={TILL_GLOW} transparent depthWrite={false} toneMapped={false} /></mesh>
      {/* its front: upright battens of hinoki over the dark body, close set, a dark kick board at the foot */}
      {Array.from({ length: 15 }, (_, k) => (
        <Part key={k} geo={REG_GEO.body} color={k % 2 ? '#c49a64' : '#b88c58'} outline={0} position={[(k - 7) * (W - 0.08) / 15, (top - 0.06) / 2 + 0.04, -D / 2 + 0.014]}
          scale={[0.036, top - 0.14, 0.024]} />
      ))}
      <Part geo={REG_GEO.body} color="#22180f" outline={0} position={[0, 0.03, -D / 2 + 0.035]} scale={[W - 0.06, 0.06, 0.02]} />
      {/* and at its end, toward the door, a round window (丸窓) in its side with a lattice in it, lit from within */}
      <group position={[W / 2 - 0.018, (top - 0.05) / 2 + 0.03, 0.02]} rotation-y={Math.PI / 2}>
        <mesh><circleGeometry args={[0.2, 28]} /><meshBasicMaterial color="#f2dcb0" toneMapped={false} /></mesh>
        <mesh position-z={0.002}><ringGeometry args={[0.2, 0.235, 28]} /><meshToonMaterial color="#5a3a22" /></mesh>
        {[-1, 0, 1].map((k) => (
          <group key={k}>
            <mesh position={[k * 0.1, 0, 0.003]}><planeGeometry args={[0.012, 0.4 * Math.sqrt(1 - (k * 0.1 / 0.2) ** 2)]} /><meshToonMaterial color="#5a3a22" /></mesh>
            <mesh position={[0, k * 0.1, 0.003]}><planeGeometry args={[0.4 * Math.sqrt(1 - (k * 0.1 / 0.2) ** 2), 0.012]} /><meshToonMaterial color="#5a3a22" /></mesh>
          </group>
        ))}
      </group>
      {/* the register, an electronic one of the kind every shop has: a cream cash drawer (a lock and a label on its front)
          under a body whose sloped panel carries the keys (the coloured function keys to the left, the grey number pad, the
          big cream keys and the teal total key to the right), the till roll's cover at the back with its paper coming
          out, a small operator's display on a stalk, and over it all the customers' display, its green figures facing both ways */}
      <group position={[0.05, top, 0.06]} rotation-y={Math.PI} scale={1.12}>
        {/* drawer */}
        <Part geo={REG_GEO.round} color="#d9d3c6" outline={1.03} position={[0, 0.04, 0]} scale={[0.36, 0.08, 0.3]} />
        <Part geo={REG_GEO.body} color="#bdb7a9" outline={0} position={[0, 0.04, -0.1515]} scale={[0.33, 0.056, 0.004]} />
        <Part geo={REG_GEO.body} color="#8a8478" outline={0} position={[-0.02, 0.058, -0.154]} scale={[0.12, 0.008, 0.004]} />
        <mesh position={[0.11, 0.04, -0.155]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.009, 0.009, 0.006, 14]} /><meshToonMaterial color="#c8ccd0" /></mesh>
        <mesh position={[0.11, 0.04, -0.1585]}><planeGeometry args={[0.012, 0.0025]} /><meshBasicMaterial color="#2a2c30" /></mesh>
        <Part geo={REG_GEO.body} color="#f2e28a" outline={0} position={[-0.11, 0.024, -0.1535]} scale={[0.045, 0.014, 0.002]} />
        {/* the body: a deep base, set back a little */}
        <Part geo={REG_GEO.round} color="#d6d0c2" outline={1.03} position={[0, 0.125, 0.03]} scale={[0.34, 0.09, 0.25]} />
        {/* the sloped key panel */}
        <group position={[0, 0.172, -0.07]} rotation-x={-0.34}>
          <Part geo={REG_GEO.round} color="#cbc5b7" outline={1.04} scale={[0.335, 0.026, 0.16]} />
          {Array.from({ length: 16 }, (_, i) => {
            const col = i % 4, row = Math.floor(i / 4)
            const cap = ['#5e86c8', '#5e86c8', '#e07a9a', col === 3 ? '#7a5fa8' : '#e07a9a'][row]
            return <mesh key={`f${i}`} geometry={REG_KEY} position={[-0.138 + col * 0.025, 0.018, -0.052 + row * 0.03]}><meshToonMaterial color={cap} /></mesh>
          })}
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={`n${i}`} geometry={REG_KEY} position={[-0.03 + (i % 3) * 0.025, 0.018, -0.052 + Math.floor(i / 3) * 0.03]}><meshToonMaterial color="#4a4e54" /></mesh>
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={`c${i}`} geometry={REG_KEY} position={[0.07 + (i % 2) * 0.03, 0.018, -0.052 + Math.floor(i / 2) * 0.03]} scale={[1.25, 1, 1.25]}>
              <meshToonMaterial color="#f4efe2" />
            </mesh>
          ))}
          {[0, 1].map((j) => (
            <mesh key={`t${j}`} geometry={REG_KEY} position={[0.14, 0.018, -0.052 + j * 0.03]} scale={[1, 1, 1.15]}><meshToonMaterial color="#3aa79a" /></mesh>
          ))}
        </group>
        {/* the till roll's cover at the back left, a strip of paper coming out of it */}
        <Part geo={REG_GEO.round} color="#c9c3b5" outline={1.04} position={[-0.1, 0.19, 0.085]} scale={[0.1, 0.03, 0.08]} />
        <mesh position={[-0.1, 0.225, 0.09]} rotation-x={-0.5}><planeGeometry args={[0.05, 0.07]} /><meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} /></mesh>
        {/* the operator's display: a small tilted screen on a stalk, at the back right */}
        <mesh position={[0.09, 0.225, 0.075]}><cylinderGeometry args={[0.006, 0.007, 0.07, 8]} /><meshToonMaterial color="#8a8e92" /></mesh>
        <group position={[0.09, 0.27, 0.07]} rotation-x={-0.55}>
          <Part geo={REG_GEO.round} color="#b8bcc0" outline={1.05} scale={[0.075, 0.04, 0.012]} />
          <mesh position-z={-0.0072}><planeGeometry args={[0.06, 0.026]} /><meshBasicMaterial color="#b8d090" toneMapped={false} /></mesh>
        </group>
        {/* the customers' display: a dark housing on a tall stalk, lit green figures on both faces */}
        <mesh position={[-0.02, 0.28, 0.1]}><cylinderGeometry args={[0.005, 0.006, 0.19, 8]} /><meshToonMaterial color="#6a6e72" /></mesh>
        <group position={[-0.02, 0.38, 0.1]}>
          <Part geo={REG_GEO.round} color="#1c1e22" outline={1.04} scale={[0.15, 0.05, 0.03]} />
          {[1, -1].map((sd) => (
            <mesh key={sd} position-z={sd * 0.0155} rotation-y={sd > 0 ? 0 : Math.PI}>
              <planeGeometry args={[0.13, 0.034]} /><meshBasicMaterial map={REG_LED} toneMapped={false} />
            </mesh>
          ))}
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
      <group position={[0.4, top, 0.04]} rotation-y={Math.PI}><LuckyCat kind={1} height={0.3} /></group>
    </group>
  )
}
/** the sign on the till: お会計 brushed on cream, with its Chinese under it */
const PAY_SIGN = (() => signTexture(160, 100, (g) => {
  g.fillStyle = '#f2e8d0'
  g.fillRect(0, 0, 160, 100)
  g.strokeStyle = '#6a4428'
  g.lineWidth = 6
  g.strokeRect(3, 3, 154, 94)
  g.strokeStyle = '#b8261c'
  g.lineWidth = 1.6
  g.strokeRect(10, 10, 140, 80)
  brushText(g, 'お会計', 80, 40, 44, { fill: '#b8261c', edge: '#f8f0dc', shadow: 'rgba(60,30,10,0.4)', spacing: 3 })
  brushText(g, '結帳', 80, 76, 22, { fill: '#1d140c', weight: 'normal', spacing: 6 })
}))()

/**
 * The cats at the door, on their stand just inside it against the wall (the entrance's +x side; the till is on the
 * other), facing across the way in at those coming through
 */
const DOOR_CATS = [
  // (on the stand: x out from the wall, y the tier's top, z along it; the big white pair on the upper tier)
  // (each its own model and size, in its own colours: two big ones on top, two smaller below)
  { x: 0.04, y: 0.6, z: -0.15, yaw: 0.2, kind: 1 as const, h: 0.5 },
  { x: 0.04, y: 0.6, z: 0.15, yaw: -0.2, kind: 3 as const, h: 0.42 },
  { x: -0.07, y: 0.32, z: -0.2, yaw: 0.25, kind: 2 as const, h: 0.34 },
  { x: -0.07, y: 0.32, z: 0.2, yaw: -0.25, kind: 1 as const, h: 0.3 },
]
/** the register's figure tabs: the amount (¥ 1 2 8 0 as it might be), and its maker's plate */
/** the customers' display: green figures on black, the amount to pay */
const REG_LED = signTexture(128, 34, (g) => {
  g.fillStyle = '#0a120a'
  g.fillRect(0, 0, 128, 34)
  g.font = 'bold 26px "Courier New", monospace'
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillStyle = '#5cff7a'
  g.shadowColor = '#5cff7a'
  g.shadowBlur = 6
  g.fillText('0.85', 118, 18)
  g.font = 'bold 12px "Courier New", monospace'
  g.textAlign = 'left'
  g.fillText('TOTAL', 8, 18)
})
/** a key of the register's keyboard */
const REG_KEY = new RoundedBoxGeometry(0.021, 0.008, 0.021, 2, 0.003)
const REG_GEO = {
  body: new THREE.BoxGeometry(1, 1, 1),
  key: new THREE.CylinderGeometry(0.004, 0.004, 0.016, 6),
  cap: new THREE.CylinderGeometry(0.012, 0.012, 0.006, 12),
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
function DiningFloor({ c, from, to, near = FLOOR_NEAR, far = FLOOR_FAR, wall = true, bare = false }: { c: Counter; from: number; to: number; near?: number
  far?: number
  /** a dark edging board along its far side, where it meets the wall */
  wall?: boolean
  /** only the edging board (the floor itself laid as one, under the whole room) */
  bare?: boolean }) {
  const yaw = Math.atan2(c.along.x, c.along.z)
  // (in the floor's own frame: z along the bar, x away from the cook, so lay is -x; its boards are laid from the
  // world, so they run straight on into the next piece's and the kitchen's, no seam between)
  const w = near - far
  const l = to - from
  return (
    <group position={c.at} rotation-y={yaw}>
      {!bare && <FloorPiece w={w} l={l} position={[-(near + far) / 2, 0.004, (from + to) / 2]} />}
      {wall && (
        <mesh position={[-far, 0.01, (from + to) / 2]}>
          <boxGeometry args={[0.04, 0.02, l]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      )}
    </group>
  )
}

/** the whole room's floor in one piece, a rectangle under the counters, the kitchen and the way in (roomOf) */
/** what's left of a rectangle (along, lay) when another is cut out of it */
function minus(al: [number, number], ly: [number, number], h: { along: [number, number]; lay: [number, number] }) {
  const ha0 = Math.max(al[0], h.along[0]), ha1 = Math.min(al[1], h.along[1])
  const hl0 = Math.max(ly[0], h.lay[0]), hl1 = Math.min(ly[1], h.lay[1])
  if (ha0 >= ha1 || hl0 >= hl1) return [[al, ly] as [[number, number], [number, number]]]
  const out: [[number, number], [number, number]][] = []
  if (ha0 > al[0]) out.push([[al[0], ha0], ly])
  if (ha1 < al[1]) out.push([[ha1, al[1]], ly])
  if (hl0 > ly[0]) out.push([[ha0, ha1], [ly[0], hl0]])
  if (hl1 < ly[1]) out.push([[ha0, ha1], [hl1, ly[1]]])
  return out
}
const RISER = '#3a2416'
/** the base's whole thickness, one dark colour all the way down (its sides show as a single band) */
const BASE_COLOR = '#3d2414'
/**
 * The shop's base: a thick plinth of wood under the whole room (the customers' floor on a solid fill, the kitchen's lower
 * floor in a well in it), a pale rim of boards round its top edge, a dark body, a toe board at its foot, standing
 * out past the room all round: so it all sits on something solid, not on nothing.
 */
function ShopBase({ rects, genkan, drop, step }: { rects: [[number, number], [number, number]][]; genkan: [[number, number], [number, number]]
  /** how far down the genkan's stone lies */
  step: number; drop: number }) {
  const top = -drop - 0.003
  // (each piece of the base is cut exactly to the room's own outline: the floor's pieces and the genkan's corner, no more)
  const layers = (al: [number, number], ly: [number, number], key: string) => {
    const cx = -(ly[0] + ly[1]) / 2, cz = (al[0] + al[1]) / 2
    const W = ly[1] - ly[0], L = al[1] - al[0]
    return [[top, 0.06], [top - 0.06, 0.22], [top - 0.28, 0.05]].map(([y0, h], i) => (
      <mesh key={`${key}${i}`} position={[cx, (y0 as number) - (h as number) / 2, cz]} receiveShadow>
        <boxGeometry args={[W, h as number, L]} />
        <meshToonMaterial color={BASE_COLOR} />
      </mesh>
    ))
  }
  const [gal, gly] = genkan
  return (
    <>
      {rects.flatMap(([al, ly], i) => layers(al, ly, `r${i}`))}
      {/* (and under the genkan's stone, solid up to it) */}
      {layers(gal, gly, 'g')}
      <mesh position={[-(gly[0] + gly[1]) / 2, (top + 0.0 - step) / 2 - 0.0015, (gal[0] + gal[1]) / 2]}>
        <boxGeometry args={[gly[1] - gly[0], -step - top - 0.003, gal[1] - gal[0]]} />
        <meshToonMaterial color={BASE_COLOR} />
      </mesh>
    </>
  )
}
/** raw timber for the steps: warm unplaned wood, its long grain wavering, a knot or two, and the dark rough of the cut */
const STEP_LOG = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#9a6c3c'
  g.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 26; i++) {
    const y = 2 + i * 2.4 + (i % 3)
    g.strokeStyle = i % 4 ? 'rgba(70,40,18,0.35)' : 'rgba(215,170,110,0.28)'
    g.lineWidth = 1 + (i % 3) * 0.4
    g.beginPath()
    g.moveTo(0, y)
    g.bezierCurveTo(70, y + 3 * Math.sin(i), 170, y - 3 * Math.cos(i * 1.7), 256, y + 2)
    g.stroke()
  }
  for (const [x, y] of [[60, 20], [190, 44]]) {
    g.fillStyle = 'rgba(55,30,12,0.7)'
    g.beginPath(); g.ellipse(x, y, 9, 4.5, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgba(55,30,12,0.4)'
    g.beginPath(); g.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()
/**
 * A timber block w × h × d whose grain runs the long way on every face and is laid at one scale all over (a texture one metre
 * long, a quarter of a metre across), however the block is shaped: nothing stretched.
 */
const TIMBER_GEO = new Map<string, THREE.BufferGeometry>()
const TIMBER = new THREE.MeshToonMaterial({ color: '#ffffff', map: STEP_LOG })
function timberBox(w: number, h: number, d: number) {
  const key = [w, h, d].map((v) => v.toFixed(3)).join()
  const have = TIMBER_GEO.get(key)
  if (have) return have
  const g = new THREE.BoxGeometry(w, h, d)
  TIMBER_GEO.set(key, g)
  const uv = g.attributes.uv
  // (BoxGeometry's faces, four vertices each: +x, -x, +y, -y, +z, -z; the two sizes across each face along its u and v)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) {
    const [du, dv] = dims[f]
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      const u = uv.getX(i), v = uv.getY(i)
      // (the longer side takes the grain, the texture's u)
      if (du >= dv) uv.setXY(i, u * du, v * dv * 4)
      else uv.setXY(i, v * dv, u * du * 4)
    }
  }
  return g
}
/**
 * The kitchen, sunk below the customers' floor: its own floor lower down, a riser of the bar's dark wood round its
 * edges (the counters' bases run on down into it), and at each gate two steps to tread on, down from the customers' floor.
 */
function KitchenPit({ counters, drop }: { counters: Counter[]; drop: number }) {
  const k = useMemo(() => kitchenOf(counters), [counters])
  const gates = useMemo(() => kitchenGatesOf(counters), [counters])
  const [kx0, kx1] = k.along, [ky0, ky1] = k.lay
  // (in the floor's frame: x is minus lay, z is along)
  const wall = (xa: number, xb: number, zl: number, zr: number, key: string) => (
    <mesh key={key} position={[-(xa + xb) / 2, -drop / 2, (zl + zr) / 2]}>
      <boxGeometry args={[xb - xa || 0.02, drop, zr - zl || 0.02]} />
      <meshToonMaterial color={RISER} />
    </mesh>
  )
  // (the steps are blocks stood in the kitchen against its edge, each a third lower than the last)
  const [g0, g1] = gates.first
  // (each step a block of raw timber, its grain along it at one scale; run a way on past the gate's way through along the kitchen's
  // edge, to fill the corner of the well beside it, but never past the kitchen's own bounds)
  const STEP_OVER = 0.02
  const stepAt = (a: number, b: number, edgeLay: number, key: string) => [1, 2].map((n) => {
    const h = drop * (3 - n) / 3
    const lo = Math.max(kx0, a - STEP_OVER), hi = Math.min(kx1, b + STEP_OVER)
    return (
      <mesh key={`${key}${n}`} position={[-(edgeLay + 0.17 * n - 0.085), -drop + h / 2, (lo + hi) / 2]} geometry={timberBox(0.17, h, hi - lo)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />
    )
  })
  const stepSide = (a: number, b: number, edgeAlong: number, key: string) => [1, 2].map((n) => {
    const h = drop * (3 - n) / 3
    const lo = Math.max(ky0, a - STEP_OVER), hi = Math.min(ky1, b + STEP_OVER)
    return (
      <mesh key={`${key}${n}`} position={[-(lo + hi) / 2, -drop + h / 2, edgeAlong + 0.17 * n - 0.085]} geometry={timberBox(hi - lo, h, 0.17)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />
    )
  })
  return (
    <>
      <FloorPiece w={ky1 - ky0} l={kx1 - kx0} tint="#d2c4b2" position={[-(ky0 + ky1) / 2, 0.004 - drop, (kx0 + kx1) / 2]} />
      {/* (down the cook's face of the first counter, but the gate's way through) */}
      {wall(ky0 - 0.01, ky0 + 0.01, kx0, g0, 'f1')}
      {wall(ky0 - 0.01, ky0 + 0.01, g1, kx1, 'f2')}
      {/* (down the kitchen's end past the first counter, steps across the whole of it: a way in from the door's side) */}
      {wall(ky0, ky1, kx1 - 0.01, kx1 + 0.01, 'e')}
      {/* (and down by the side counter, the gate's way through) */}
      {gates.side ? (
        <>
          {wall(ky0, gates.side[0], kx0 - 0.01, kx0 + 0.01, 's1')}
          {wall(gates.side[1], ky1, kx0 - 0.01, kx0 + 0.01, 's2')}
          {stepSide(gates.side[0], gates.side[1], kx0, 'sg')}
        </>
      ) : wall(ky0, ky1, kx0 - 0.01, kx0 + 0.01, 's')}
      {/* (the steps at the first counter's gate) */}
      {stepAt(g0, g1, ky0, 'g')}
    </>
  )
}

function RoomFloor({ counters, drop }: { counters: Counter[]; drop: number }) {
  const c = counters[0]
  const { along: [a0, a1], lay: [l0, l1] } = useMemo(() => roomOf(counters), [counters])
  const kitchen = useMemo(() => kitchenOf(counters), [counters])
  // (the genkan's corner, by the door, is left out of the boards: it's a step down, in stone)
  const g0 = c.length / 2 + GENKAN.along[0], gl = GENKAN.lay[1], D = GENKAN.depth
  // (the kitchen's cut out of the boards: it lies lower, KitchenPit)
  const piece = (al: [number, number], ly: [number, number], k: string) => minus(al, ly, kitchen).map(([a, l], i) => (
    <FloorPiece key={`${k}${i}`} w={l[1] - l[0]} l={a[1] - a[0]} position={[-(l[0] + l[1]) / 2, 0.004, (a[0] + a[1]) / 2]} />
  ))
  return (
    <group position={c.at} rotation-y={Math.atan2(c.along.x, c.along.z)}>
      {piece([a0, g0], [l0, l1], 'a')}
      {piece([g0, a1], [gl, l1], 'b')}
      <ShopBase rects={[[[a0, g0], [l0, l1]], [[g0, a1], [gl, l1]]]} genkan={[[g0, a1], [l0, gl]]} step={D} drop={drop} />
      {/* (and a solid fill under the customers' boards, down to the base, round the kitchen's well) */}
      {[[[a0, g0], [l0, l1]], [[g0, a1], [gl, l1]]].flatMap(([al, ly], n) => minus(al as [number, number], ly as [number, number], kitchen).map(([a, l], i) => (
        <mesh key={`fill${n}${i}`} position={[-(l[0] + l[1]) / 2, -(drop + 0.006) / 2 - 0.004, (a[0] + a[1]) / 2]}>
          <boxGeometry args={[l[1] - l[0], drop - 0.002, a[1] - a[0]]} /><meshToonMaterial color={BASE_COLOR} />
        </mesh>
      )))}
      <KitchenPit counters={counters} drop={drop} />
      {/* the genkan: its stone, the step's riser round its two inner sides, and the polished kamachi on the edge */}
      <mesh position={[-(l0 + gl) / 2, -D + 0.004, (g0 + a1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[gl - l0, a1 - g0]} />
        <meshToonMaterial color="#ffffff" map={GENKAN_STONE} />
      </mesh>
      <mesh position={[-(l0 + gl) / 2, -D / 2, g0]}><boxGeometry args={[gl - l0, D, 0.012]} /><meshToonMaterial color="#3a2416" /></mesh>
      <mesh position={[-gl, -D / 2, (g0 + a1) / 2]}><boxGeometry args={[0.012, D, a1 - g0]} /><meshToonMaterial color="#3a2416" /></mesh>
      <mesh position={[-(l0 + gl) / 2 - 0.0, 0.007, g0 + 0.03]}><boxGeometry args={[gl - l0 + 0.06, 0.008, 0.06]} /><meshToonMaterial color="#4a2a18" /></mesh>
      <mesh position={[-gl + 0.03, 0.007, (g0 + a1) / 2]}><boxGeometry args={[0.06, 0.008, a1 - g0]} /><meshToonMaterial color="#4a2a18" /></mesh>
      {/* (the wall's foot, and the room's open end, down to the stone) */}
      <mesh position={[-l0, -D / 2, (g0 + a1) / 2]}><boxGeometry args={[0.02, D, a1 - g0]} /><meshToonMaterial color="#2a1a10" /></mesh>
      <mesh position={[-(l0 + gl) / 2, -D / 2, a1]}><boxGeometry args={[gl - l0, D, 0.012]} /><meshToonMaterial color="#2a1a10" /></mesh>
    </group>
  )
}
/** the genkan's stone: dark grey slate laid in rough rectangles */
const GENKAN_STONE = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#2e2c2a'
  g.fillRect(0, 0, 128, 128)
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
    const v = 52 + ((i * 7 + j * 13) % 5) * 6
    g.fillStyle = `rgb(${v},${v - 2},${v - 5})`
    g.fillRect(i * 43 + (j % 2) * 20 - 20 + 2, j * 32 + 2, 39, 28)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1.5, 1.5)
  return t
})()

/**
 * A Japanese bar stool (丸椅子): a thick round seat of pale wood with a rounded edge and a flat indigo cushion tied on,
 * four square legs splayed out a little, and a ring of rails low between them to rest the feet on.
 */
const STOOL_GEO = {
  seat: new THREE.CylinderGeometry(0.115, 0.105, 0.035, 24),
  cushion: new THREE.CylinderGeometry(0.1, 0.1, 0.018, 24),
  leg: new THREE.BoxGeometry(0.022, 0.32, 0.022),
  rail: new THREE.BoxGeometry(0.012, 0.012, 1),
}
function Stool() {
  const legs = [0, 1, 2, 3].map((k) => (k / 4) * Math.PI * 2 + Math.PI / 4)
  return (
    <group>
      <Part geo={STOOL_GEO.seat} color="#c49a64" position={[0, 0.322, 0]} outline={1.05} />
      <Part geo={STOOL_GEO.cushion} color="#2c3e66" position={[0, 0.347, 0]} outline={1.04} />
      {legs.map((a) => (
        // (each leg leans out, its foot further out than its top)
        <mesh key={a} geometry={STOOL_GEO.leg} position={[Math.cos(a) * 0.082, 0.155, Math.sin(a) * 0.082]}
          rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]}>
          <meshToonMaterial color="#8a5a30" />
        </mesh>
      ))}
      {/* the foot rails, a square of them between the legs */}
      {legs.map((a, k) => {
        const b = legs[(k + 1) % 4], r = 0.093
        const p = [(Math.cos(a) + Math.cos(b)) / 2 * r, (Math.sin(a) + Math.sin(b)) / 2 * r]
        const len = Math.hypot(Math.cos(a) - Math.cos(b), Math.sin(a) - Math.sin(b)) * r
        return (
          <mesh key={k} geometry={STOOL_GEO.rail} position={[p[0], 0.1, p[1]]} rotation-y={Math.atan2(Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a))} scale={[1, 1, len]}>
            <meshToonMaterial color="#7a4e2a" />
          </mesh>
        )
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

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave' | 'wcGo' | 'wcIn' | 'wcBack'; t: number
  /** (off to the toilet, or to the fridge for a drink) where, and the way there from their stool; told to go home
   * meanwhile, they do once they're back */
  wc?: { who: 'm' | 'f' | 'drink'; path: THREE.Vector3[]; len: number; unit?: number; pick?: DrinkId }
  /** what they've fetched from the fridge, stood by their plate */
  drink?: DrinkId
  leaving?: boolean
  /** how much of them shows (fading out as they go out of the door) */
  fade?: number
  /** in the house's slippers (inside, past the genkan's step), or their own shoes */
  slippers?: boolean }
/** how long they stand at the genkan's step changing their shoes */
const SHOES_S = 1.2
/** a walk that stops a while at a point along it: how far along, at a time when it would have been `d` */
const withPause = (d: number, at: number, hold: number) => (d < at ? d : d < at + hold ? at : d - hold)
/** what's set at a customer's place (their soy, their drink) and their shoes left in the genkan: shared shapes */
const AT_SEAT = {
  soy: new THREE.CircleGeometry(0.03, 16),
  daikon: new THREE.SphereGeometry(0.011, 8, 6),
  shoe: new THREE.SphereGeometry(1, 8, 6),
}
/** the women's kinds, who use the women's toilet */
const HER = new Set(['officeLady', 'highSchoolGirl', 'yukata', 'grandma', 'maid', 'gyaru'])
/** how often one sat waiting gets up to go to the toilet (per second), and how long they're in there */
const WC_RATE = 1 / 240
const WC_STAY = 6
/** and to go and get themselves a drink from the fridge (once), and how long they stand choosing */
const DRINK_RATE = 1 / 70
/** (in development, `__drinkRate` in the console makes them thirstier, for watching it) */
const drinkRate = () => (import.meta.env.DEV ? (window as unknown as { __drinkRate?: number }).__drinkRate : undefined) ?? DRINK_RATE
const DRINK_STAY = 2.25

/** a plate on its way to a seat ('serve'), set at it ('set'), or being cleared away ('clear', after a pause) */
type PlateRun = { key: number; seat: number; guest: number; phase: 'serve' | 'carry' | 'set' | 'clear'; t: number; from: THREE.Vector3
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
  speech = {}, servers = [], incense, onDrink, open = true }:
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
    /** a customer's taken a drink from the fridge (it's paid for) */
    onDrink?: (guest: number, drink: DrinkId) => void
    /** the shop's open: shut, nobody's in the room and the plates are back where they started */
    open?: boolean
    /** the incense on the altar by the door (lit when, and lighting another) */
    incense?: { litAt: number | null; onLight: () => void }
    /** the servers on the floor: they carry what's put out at the pass to the customers, a plate with it */
    servers?: { id: string; look: StaffLook }[]
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
  const wcs = useMemo(() => (given ? toiletsOf(counters) : null), [counters, given])
  const fridges = useMemo(() => (given ? fridgesOf(counters) : null), [counters, given])
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
  /** how far along a way in (from the door) the genkan's step up into the room is */
  const stepAt = (path: THREE.Vector3[]) => {
    if (!given) return 0
    for (let d = 0; d < 2; d += 0.02) if (!inGenkan(counters, alongPath(path, d).p)) return d
    return 0
  }
  // where a server stands at the pass to take what's put out there (on the floor, by the first counter's start)
  const pass = useMemo(() => passOf(counters), [counters])
  const passSpot = useMemo(() => {
    const c0 = counters[0]
    return c0.at.clone().addScaledVector(c0.along, -c0.length / 2 - 0.25).addScaledVector(c0.lay, -0.75)
  }, [counters])
  /** where the first counter's aisle meets another's */
  const aisleCorner = (c: Counter) => {
    const c0 = counters[0]
    const p0 = c0.at.clone().addScaledVector(c0.lay, -AISLE)
    return p0.clone().addScaledVector(c0.along, c.at.clone().addScaledVector(c.lay, -AISLE).sub(p0).dot(c0.along))
  }
  // the servers wait in the kitchen, each just inside a gate in the bar (the first counter's, by the till, and the side
  // counter's), so they go out through it on every trip and come back in by it, the door swinging for them; a shop
  // without gates has them waiting by the pass
  const homes = useMemo(() => {
    if (!given) {
      const c0 = counters[0]
      return [0, 1].map((k) => {
        const at = c0.at.clone().addScaledVector(c0.along, -c0.length / 2 - 0.25 - k * 0.42).addScaledVector(c0.lay, -0.75 - k * 0.12)
        return { at, yaw: Math.atan2(c0.lay.x, c0.lay.z), counter: 0, way: [at] }
      })
    }
    return counters.slice(0, BAR_GATES.length).map((c, i) => {
      const g = BAR_GATES[i]
      const { mid } = gateOf(c, g)
      const at = mid.clone().addScaledVector(c.lay, 0.85).addScaledVector(c.along, -g.end * 0.3)
      // (in to the doorway square on, through it, and out to the aisle)
      const way = [at, mid.clone().addScaledVector(c.lay, 0.42), mid.clone().addScaledVector(c.lay, -0.5), mid.clone().addScaledVector(c.lay, -AISLE - 0.08)]
      return { at, yaw: Math.atan2(-c.lay.x, -c.lay.z), counter: i, way }
    })
  }, [counters, given])
  /** from a server's place to the pass: out through their gate, along the aisle(s) */
  const fetchPath = (wi: number) => {
    const h = homes[wi]
    if (h.way.length < 2) return [h.at.clone(), passSpot.clone()]
    const c0 = counters[0]
    const via = h.counter === 0 ? c0.at.clone().addScaledVector(c0.along, -c0.length / 2 - 0.25).addScaledVector(c0.lay, -AISLE)
      : aisleCorner(counters[h.counter])
    return [...h.way.map((v) => v.clone()), via, passSpot.clone()]
  }
  /** beside a customer, where a server stands to set their plate down */
  const besideSeat = (n: number) => {
    const st = seats[n]
    return st.aisle.clone().lerp(st.stool, 0.45).addScaledVector(st.along, 0.24)
  }
  /** from the pass to a seat: out into the aisle, along it (round the corner for the side counter) and in beside them */
  const routeTo = (n: number) => {
    const c0 = counters[0], st = seats[n]
    const out = passSpot.clone().addScaledVector(c0.lay, -(AISLE - 0.75))
    const path = [passSpot.clone(), out, ...pathTo(counters, st).slice(1, -1), besideSeat(n)]
    return { path, len: pathLength(path) }
  }
  /** from a server's place to a seat the shortest way (out through their gate): walked backwards, it's their way back */
  const backPath = (wi: number, n: number) => {
    const h = homes[wi], st = seats[n]
    if (h.way.length < 2) return routeTo(n).path
    const turn = st.counter === h.counter ? [] : [aisleCorner(counters[st.counter === 0 ? h.counter : st.counter])]
    return [...h.way.map((v) => v.clone()), ...turn, st.aisle.clone(), besideSeat(n)]
  }
  const waiters = useRef<{ phase: 'idle' | 'fetch' | 'pickup' | 'go' | 'set' | 'back'; t: number; seat: number; keys: string[]; run: number | null
    path: THREE.Vector3[]; len: number; pos: THREE.Vector3; yaw: number }[]>([])
  const waiterObjs = useRef<(THREE.Group | null)[]>([])
  const [moving, setMoving] = useState<boolean[]>([])
  useEffect(() => {
    waiters.current = servers.slice(0, homes.length).map((_, i) => ({ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0,
      pos: homes[i].at.clone(), yaw: homes[i].yaw }))
    SERVICE.servers = Math.min(homes.length, servers.length)
    return () => {
      SERVICE.servers = 0
      SEATS_TAKEN.clear()
    }
  }, [servers.length, homes])
  /** a point in the bar's frame, in the shop's (where Roasting has the food) */
  const toShop = (v: THREE.Vector3) => v.clone().multiplyScalar(scale).add(offset ?? new THREE.Vector3())
  // (the shop laid out in full keeps its plates inside, on the cook's table by the pass: they're handed over the bar)
  const cleanAt = (k: number) => (given ? PLATE_STACKS.clean.clone().setY(PLATE_STACK_Y + k * STACK_GAP)
    : counters[0].at.clone().addScaledVector(ALONG, -counters[0].length / 2 + 0.25).addScaledVector(LAY, 0.11).setY(top + k * STACK_GAP))
  // (in from the first counter's far end, clear of the staff's gate there)
  const dirtyAt = (k: number) => (given ? PLATE_STACKS.dirty.clone().setY(PLATE_STACK_Y + k * STACK_GAP)
    : counters[0].at.clone().addScaledVector(ALONG, counters[0].length / 2 - 0.25).addScaledVector(LAY, 0.11).setY(top + k * STACK_GAP))

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
  // closing the shop empties the room at once: nobody at the stools, no plates out or being carried, the stacks as at the start
  useEffect(() => {
    if (open) return
    setShown([])
    runs.current = []
    runObjs.current.clear()
    waiting.current = []
    clean.current = Array.from({ length: CLEAN_START }, () => -9)
    dirty.current = 0
    wash.current = null
    waiters.current = waiters.current.map((w, i) => ({ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0,
      pos: homes[i]?.at.clone() ?? w.pos, yaw: homes[i]?.yaw ?? w.yaw }))
    SERVICE.waiting.clear()
    SERVICE.carried.clear()
    SEATS_TAKEN.clear()
    PLATES_SET.clear()
    for (const f of FRIDGE_STATE) f.passing = 0
    TOILETS.m.passing = 0
    TOILETS.f.passing = 0
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
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
        } else if (s && !seated && s.phase !== 'leave' && !s.leaving) {
          // (away at the toilet: they go once they're back at their stool)
          next = next.map((x) => (x.id === g.id ? (x.phase.startsWith('wc') ? { ...x, leaving: true } : { ...x, phase: 'leave', t: 0 }) : x))
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
        // (stopping at the genkan's step a moment, to step out of their shoes and up into slippers)
        const d = Math.min(len, withPause(s.t * SPEED * walkSpeedOf(kindOf(s.id).kind), stepAt(path), SHOES_S * SPEED * walkSpeedOf(kindOf(s.id).kind)))
        const { p, dir } = alongPath(path, d)
        g?.position.copy(p)
        if (g) g.rotation.y = d < len ? Math.atan2(dir.x, dir.z) : st.yaw
        s.slippers = d > stepAt(path)
        if (d >= len) {
          s.phase = 'sit'
          // a plate is set in front of them (or, with a server, brought with the first thing they ordered)
          if (!SERVICE.servers) serve(s.seat, s.id)
        }
      } else if (s.phase === 'sit') {
        g?.position.copy(st.stool)
        if (g) g.rotation.y = st.yaw
        // (now and then, while they wait, off to the toilet: their kind's own)
        const guest = guestsRef.current.find((x) => x.id === s.id)
        if (fridges && guest?.state === 'waiting' && !s.drink && Math.random() < drinkRate() * Math.min(dt, 0.1)) {
          // (they choose what they want, and go to the fridge it's in)
          const pick = drinkFor(kindOf(s.id).kind, s.id)
          const fr = fridges[fridgeUnitOf(pick)]
          const turn = st.counter === 1 ? [] : [aisleCorner(counters[1])]
          const path = [st.stool.clone(), st.aisle.clone(), ...turn, fr.aisle.clone(), fr.front.clone()]
          s.wc = { who: 'drink', path, len: pathLength(path), unit: fr.n, pick }
          s.phase = 'wcGo'
          s.t = 0
        } else if (wcs && guest?.state === 'waiting' && Math.random() < WC_RATE * Math.min(dt, 0.1)) {
          const who = HER.has(kindOf(s.id).kind) ? 'f' : 'm'
          const w = wcs[who]
          const turn = st.counter === 1 ? [] : [aisleCorner(counters[1])]
          const path = [st.stool.clone(), st.aisle.clone(), ...turn, w.aisle.clone(), w.front.clone(), w.inside.clone()]
          s.wc = { who, path, len: pathLength(path) }
          s.phase = 'wcGo'
          s.t = 0
        }
      } else if (s.phase === 'wcGo' || s.phase === 'wcBack') {
        // to the door, which slides open as they come up to it, in, and later back out to their stool
        const w = s.wc!
        const d = Math.min(w.len, s.t * SPEED * walkSpeedOf(kindOf(s.id).kind))
        const { p, dir } = alongPath(w.path, s.phase === 'wcGo' ? d : w.len - d)
        g?.position.copy(p)
        if (g) g.rotation.y = s.phase === 'wcGo' ? Math.atan2(dir.x, dir.z) : Math.atan2(-dir.x, -dir.z)
        if (d >= w.len) {
          s.phase = s.phase === 'wcGo' ? 'wcIn' : s.leaving ? 'leave' : 'sit'
          s.t = 0
        }
      } else if (s.phase === 'wcIn') {
        // (at the fridge: facing it, choosing; then their drink in hand, back to their stool)
        if (s.wc?.who === 'drink' && g && fridges) g.rotation.y = fridges[s.wc.unit ?? 0].yaw + Math.PI
        if (s.t > (s.wc?.who === 'drink' ? DRINK_STAY : WC_STAY)) {
          if (s.wc?.who === 'drink' && !s.drink) {
            s.drink = s.wc.pick ?? drinkFor(kindOf(s.id).kind, s.id)
            takeDrink(s.drink)
            onDrink?.(s.id, s.drink)
            redraw()
          }
          s.phase = 'wcBack'
          s.t = 0
        }
      } else {
        // a moment to get up, then off the way they came
        const v = SPEED * walkSpeedOf(kindOf(s.id).kind)
        const d = Math.max(0, Math.min(len, withPause((s.t - 0.8) * v, len - stepAt(path), SHOES_S * v)))
        const { p, dir } = alongPath(path, len - d)
        s.slippers = len - d > stepAt(path)
        g?.position.copy(p)
        if (g) g.rotation.y = s.t < 0.8 ? st.yaw : Math.atan2(-dir.x, -dir.z)
        if (d >= len) done.push(s.id)
        // (out of the door they fade away, the last stretch)
        s.fade = Math.min(1, (len - d) / 0.9)
      }
      if (g) g.visible = !(s.phase === 'wcIn' && s.wc?.who !== 'drink')
      // (down a step, standing in the genkan)
      if (g && given) g.position.y = inGenkan(counters, g.position) ? -GENKAN.depth : 0
    }
    SEATS_TAKEN.clear()
    for (const x of shown) SEATS_TAKEN.add(x.seat)
    // nobody walks through anybody: those walking (in, out, to the toilet or the fridge) keep a body's width apart,
    // stepping aside for each other and for the servers (who keep to their way, their trays held level)
    {
      const walkers: { p: THREE.Vector3; give: boolean }[] = []
      for (const x of shown) {
        if (x.phase === 'sit' || x.phase === 'wcIn' && x.wc?.who !== 'drink') continue
        const gp = groups.current.get(x.id)?.position
        if (gp) walkers.push({ p: gp, give: true })
      }
      for (const w of waiters.current) walkers.push({ p: waiterObjs.current[waiters.current.indexOf(w)]?.position ?? w.pos, give: false })
      const R = 0.3
      for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j]
        const dx = a.p.x - b.p.x, dz = a.p.z - b.p.z, d = Math.hypot(dx, dz)
        if (d >= R || (!a.give && !b.give)) continue
        // (straight on into each other: aside to the left)
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0
        const push = R - d
        const ka = a.give ? (b.give ? 0.5 : 1) : 0, kb = b.give ? (a.give ? 0.5 : 1) : 0
        a.p.x += nx * push * ka
        a.p.z += nz * push * ka
        b.p.x -= nx * push * kb
        b.p.z -= nz * push * kb
      }
    }
    // the fridge's door opens for whoever's at it (as they come up to it, while they take their drink, as they leave it)
    if (fridges) for (const fr of fridges) {
      FRIDGE_STATE[fr.n].passing = shown.filter((x) => x.wc?.who === 'drink' && (x.wc.unit ?? 0) === fr.n && (x.phase === 'wcIn'
        || ((x.phase === 'wcGo' || x.phase === 'wcBack') && (groups.current.get(x.id)?.position.distanceTo(fr.front) ?? 9) < 0.7))).length
      // (a door left open by hand shuts as soon as anyone else has to go by it: the door swings out over the way, so nobody
      // walks through it)
      if (FRIDGE_STATE[fr.n].open && !FRIDGE_STATE[fr.n].passing) {
        const near = (v: THREE.Vector3 | undefined) => !!v && v.distanceTo(fr.front) < 1.5
        const byCustomer = shown.some((x) => x.phase !== 'sit' && near(groups.current.get(x.id)?.position))
        const byServer = waiterObjs.current.some((o) => near(o?.position))
        if (byCustomer || byServer) FRIDGE_STATE[fr.n].open = false
      }
    }
    // the toilets' doors open for whoever's going through them just now
    if (wcs) for (const who of ['m', 'f'] as const) {
      TOILETS[who].passing = shown.filter((x) => x.wc?.who === who && (x.phase === 'wcGo' || x.phase === 'wcBack' || x.phase === 'wcIn')
        && (groups.current.get(x.id)?.position.distanceTo(wcs[who].front) ?? 9) < 0.9).length
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
      if (r.phase === 'set' || r.phase === 'clear' && r.t < 0 || r.phase === 'carry') {
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
    // the servers: one that's free goes out to the pass for what's put out there for one seat (and a clean plate, if
    // the customer hasn't one yet), carries it along the aisle on the tray, sets it down beside them, and goes back
    const sitting = (n: number) => shownRef.current.some((x) => x.seat === n && (x.phase === 'sit' || x.phase.startsWith('wc')))
    waiters.current.forEach((w, wi) => {
      const home = homes[wi]
      const trayAt = () => w.pos.clone().add(new THREE.Vector3(0, 0.548, 0.18).multiplyScalar(PEOPLE_SCALE)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), w.yaw))
      const run = () => runs.current.find((x) => x.key === w.run)
      const setMove = (on: boolean) => setMoving((m) => { const n = [...m]; n[wi] = on; return n })
      w.t += step
      // (the customer gone meanwhile: what was being carried to them is taken away, and the server goes back)
      if ((w.phase === 'fetch' || w.phase === 'pickup' || w.phase === 'go' || w.phase === 'set') && !sitting(w.seat)) {
        for (const k of w.keys) {
          SERVICE.carried.delete(k)
          SERVICE.claimed.delete(k)
        }
        w.keys = []
        const r = run()
        if (r && r.phase === 'carry') { r.phase = 'clear'; r.t = 0 }
        w.run = null
        // (back over the corners already passed, from where they are: none still ahead of them; from the pass or
        // beyond, the way they came out to it first)
        const walked = w.phase === 'go' || w.phase === 'fetch' ? Math.min(w.len, w.t * SERVER_SPEED) : w.len
        const passed: THREE.Vector3[] = []
        for (let i = 1, at = 0; i < w.path.length - 1; i++) {
          at += w.path[i].distanceTo(w.path[i - 1])
          if (at < walked) passed.push(w.path[i])
        }
        w.path = w.phase === 'set' ? backPath(wi, w.seat).slice(0, -1).concat(w.pos.clone())
          : w.phase === 'fetch' ? [home.at.clone(), ...passed, w.pos.clone()]
            : [...fetchPath(wi), ...(w.phase === 'go' ? passed : []), w.pos.clone()]
        w.len = pathLength(w.path)
        w.phase = 'back'
        w.t = 0
        setMove(true)
        w.seat = -1
      }
      if (w.phase === 'idle') {
        const job = [...SERVICE.waiting.entries()].find(([, n]) => sitting(n))
        const needPlate = job && !runs.current.some((r) => r.seat === job[1] && (r.phase === 'set' || r.phase === 'carry' || r.phase === 'serve'))
        if (job && (!needPlate || clean.current.length > 0)) {
          w.seat = job[1]
          w.keys = [...SERVICE.waiting.entries()].filter(([, n]) => n === job[1]).map(([k]) => k)
          for (const k of w.keys) {
            SERVICE.waiting.delete(k)
            SERVICE.claimed.add(k)
          }
          w.run = null
          if (needPlate) {
            const from = cleanAt(clean.current.length - 1)
            clean.current = clean.current.slice(0, -1)
            const key = ++runSeq.current
            const g = shownRef.current.find((x) => x.seat === w.seat && x.phase === 'sit')
            runs.current.push({ key, seat: w.seat, guest: g?.id ?? -1, phase: 'carry', t: 0, from })
            w.run = key
            redraw()
          }
          // (out to the pass for it)
          w.path = fetchPath(wi)
          w.len = pathLength(w.path)
          w.phase = 'fetch'
          w.t = 0
          setMove(true)
        }
      } else if (w.phase === 'fetch') {
        const d = Math.min(w.len, w.t * SERVER_SPEED)
        const { p, dir } = alongPath(w.path, d)
        w.pos.copy(p)
        w.yaw = Math.atan2(dir.x, dir.z)
        if (d >= w.len) {
          w.phase = 'pickup'
          w.t = 0
          w.yaw = Math.atan2(pass.x - w.pos.x, pass.z - w.pos.z)
          setMove(false)
        }
      } else if (w.phase === 'pickup' && w.t > 0.4) {
        const r = routeTo(w.seat)
        // (from wherever this one stands by the pass)
        r.path[0] = w.pos.clone()
        Object.assign(w, { path: r.path, len: pathLength(r.path), phase: 'go', t: 0 })
        setMove(true)
      } else if (w.phase === 'go' || w.phase === 'back') {
        const d = Math.min(w.len, w.t * SERVER_SPEED)
        const { p, dir } = alongPath(w.path, w.phase === 'go' ? d : w.len - d)
        w.pos.copy(p)
        w.yaw = w.phase === 'go' ? Math.atan2(dir.x, dir.z) : Math.atan2(-dir.x, -dir.z)
        if (d >= w.len) {
          if (w.phase === 'go') {
            w.phase = 'set'
            const pl = plateAt(w.seat)
            w.yaw = Math.atan2(pl.x - w.pos.x, pl.z - w.pos.z)
          } else {
            w.phase = 'idle'
            w.pos.copy(home.at)
            w.yaw = home.yaw
            setMove(false)
          }
          w.t = 0
          if (w.phase === 'set') setMove(false)
        }
      } else if (w.phase === 'set' && w.t > 0.4) {
        // (down at their place: the plate, and what's on it with it; unless they've gone meanwhile, and it's cleared)
        const r = run()
        if (r && r.phase === 'carry') r.phase = 'set'
        for (const k of w.keys) {
          SERVICE.carried.delete(k)
          SERVICE.claimed.delete(k)
          SERVICE.delivered.add(k)
        }
        w.keys = []
        w.run = null
        // (back the shortest way to their place, in through their gate)
        w.path = backPath(wi, w.seat).slice(0, -1).concat(w.pos.clone())
        w.len = pathLength(w.path)
        w.phase = 'back'
        w.t = 0
        setMove(true)
      }
      // what's on the tray goes where the tray goes (and, being set down, from the tray to the bar)
      const tray = trayAt()
      const k = w.phase === 'set' ? Math.min(1, w.t / 0.4) : 0
      const plateTo = w.seat >= 0 ? plateAt(w.seat) : tray
      const hold = tray.clone().lerp(plateTo, k * k * (3 - 2 * k))
      hold.y += Math.sin(Math.PI * k) * 0.04
      if (w.phase === 'pickup' || w.phase === 'go' || w.phase === 'set') {
        const r = run()
        const pr = runObjs.current.get(w.run ?? -1)
        if (pr && r?.phase === 'carry') pr.position.copy(w.phase === 'pickup' ? cleanAt(clean.current.length).lerp(tray, Math.min(1, w.t / 0.4)) : hold.clone().setY(hold.y + 0.006))
        w.keys.forEach((key, i) => SERVICE.carried.set(key, toShop(hold.clone().add(new THREE.Vector3((i % 3 - 1) * 0.05, 0.035 + Math.floor(i / 3) * 0.03, 0)))))
      }
      const o = waiterObjs.current[wi]
      if (o && SHOP.leaving) {
        // (the shop's shut and empty: out by the staff door, and gone)
        const gate = staffDoorAt(counters[0])
        const d = gate.clone().sub(w.pos).setY(0)
        const len = d.length()
        if (len > 0.05) {
          w.pos.addScaledVector(d.normalize(), Math.min(len, Math.min(dt, 0.1) * 1.1))
          w.yaw = Math.atan2(d.x, d.z)
        }
        o.position.copy(w.pos)
        o.rotation.y = w.yaw
        o.visible = len > 0.12
      } else if (o) {
        o.visible = true
        o.position.copy(w.pos)
        o.rotation.y = w.yaw
      }
    })
    SERVICE.walkers = waiters.current.map((w) => w.pos)
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
            o.at.clone().addScaledVector(o.lay, farOf(o)).sub(c.at).dot(c.along)))
          return (
            <group key={i}>
              <DiningFloor c={c} from={back} to={c.length / 2 + 1.45} bare={!!given} />
              {/* (and past the bar's end, a strip more behind the till for the cashier to stand on; a shop laid out
                  in full has one floor under all of it instead) */}
              {given && <RoomFloor counters={counters} drop={KITCHEN_DROP / scale} />}
              {given && <ShopProps counters={counters} lang={lang} />}
              {given && <DiningWall c={c} from={back} to={c.length / 2 + 1.45} far={FLOOR_FAR} lamps={4} top={top} altar={incense ?? true} corner />}
            </group>
          )
        }
        const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
        // (where its wall's line reaches the first counter's wall)
        const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(c0.lay)) / c.along.dot(c0.lay)
        return (
          <group key={i}>
            <DiningFloor c={c} from={-c.length / 2 - 0.35} to={meet} far={farOf(c)} bare={!!given} />
            {/* (its wall runs on into the corner, to meet the first counter's: the toilet's door in that stretch) */}
            {given && <DiningWall c={c} from={-c.length / 2 - 0.35} to={corner} far={farOf(c)} lamps={2} top={top} door={wcs?.door ?? (meet + corner) / 2}
              clear={fridges ? fridges.map((f) => [f.z - FRIDGE.W / 2 - 0.1, f.z + FRIDGE.W / 2 + 0.1] as [number, number]) : undefined} />}
          </group>
        )
      })}
      {/* the way in, just past the end of the bar where the customers come and go */}
      <Entrance at={doorOf(counters)} mark={mark} />
      {/* the till, just inside the door on the bar's side of the way in (the shops that lay out their own counters) */}
      {given && (
        <StaticBatch>
          <Register top={top + TILL.rise} yaw={Math.atan2(-counters[0].along.z, counters[0].along.x)}
            at={counters[0].at.clone().addScaledVector(counters[0].along, counters[0].length / 2 + TILL.along).addScaledVector(counters[0].lay, TILL.lay)} />
        </StaticBatch>
      )}
      <StaticBatch key={seats.length}>
        {seats.map((st, n) => (
          <group key={n} position={st.stool} rotation-y={st.yaw} scale={PEOPLE_SCALE}><Stool /></group>
        ))}
      </StaticBatch>
      {/* their shoes, left in pairs on the genkan's stone by the step, a pair for each of them inside */}
      {given && (() => {
        const c0 = counters[0]
        const inside = shown.filter((s) => s.slippers)
        return inside.slice(0, 9).map((s, k) => {
          // (three pairs abreast, on the till's side of the way in, out of everyone's feet and clear of the doorpost)
          const at = c0.at.clone().addScaledVector(c0.along, c0.length / 2 + GENKAN.along[0] + 0.08 + Math.floor(k / 3) * 0.12)
            .addScaledVector(c0.lay, -0.7 - (k % 3) * 0.12).setY(-GENKAN.depth)
          const col = ['#2a2220', '#5a3a22', '#f2f0ea', '#1c1c22', '#7a2a22'][s.id % 5]
          return (
            <group key={`shoe${s.id}`} position={at} rotation-y={Math.atan2(c0.along.x, c0.along.z) + Math.PI + (s.id % 3 - 1) * 0.15}>
              {[-1, 1].map((sd) => (
                <mesh key={sd} geometry={AT_SEAT.shoe} position={[sd * 0.028, 0.018, 0]} scale={[0.025, 0.018, 0.06]}><meshToonMaterial color={col} /></mesh>
              ))}
            </group>
          )
        })
      })()}
      {fridges && fridges.map((f) => (
        <group key={f.n} name={f.n ? 'look-fridge-b' : 'look-fridge'} position={f.at} rotation-y={f.yaw}><DrinkFridge n={f.n} /><FridgeStock n={f.n} /><FridgeDoor n={f.n} /></group>
      ))}
      {/* what each has fetched from the fridge, stood beside their plate, toward the cook */}
      {given && shown.filter((s) => s.drink && s.phase !== 'leave' && !(s.phase.startsWith('wc') && s.wc?.who === 'drink')).map((s) => {
        const st = seats[s.seat], c = counters[st.counter]
        const d = DRINKS.find((x) => x.id === s.drink)!
        const at = st.plate.clone().addScaledVector(c.along, 0.17).addScaledVector(c.lay, 0.1).setY(top)
        return (
          <group key={`drink${s.id}`} position={at}>
            <DrinkBottle id={d.id} />
          </group>
        )
      })}
      {/* each seated customer's soy, poured into the little dish at their place (empty till they sit), a dab of
          grated daikon in it */}
      {given && shown.filter((s) => s.phase !== 'enter' && s.phase !== 'leave').map((s) => {
        const st = seats[s.seat], c = counters[st.counter]
        const x = st.plate.clone().sub(c.at).dot(c.along)
        const at = st.plate.clone().addScaledVector(c.along, sauceSide(c, BAR_GATES[st.counter], x)).addScaledVector(c.lay, 0.13).setY(top + 0.013)
        return (
          <group key={`soy${s.id}`} position={at}>
            <mesh geometry={AT_SEAT.soy} rotation-x={-Math.PI / 2}><meshToonMaterial color="#3a1c0c" /></mesh>
            <mesh geometry={AT_SEAT.daikon} position={[0.008, 0.004, 0.004]} scale={[1, 0.5, 1]}><meshToonMaterial color="#f2efe4" /></mesh>
          </group>
        )
      })}
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
      {servers.slice(0, homes.length).map((w, i) => (
        <group key={w.id} ref={(o) => { waiterObjs.current[i] = o }} position={homes[i].at} rotation-y={homes[i].yaw} scale={PEOPLE_SCALE}>
          <BlobShadow r={0.17} />
          <StaffFigure id={w.id} role="server" look={w.look} moving={!!moving[i]} />
        </group>
      ))}
      {people && shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const walking = s.phase !== 'sit'
        return (
          <group key={s.id} ref={(o) => { if (o) groups.current.set(s.id, o); else groups.current.delete(s.id) }}>
            {/* (a soft shadow under them, sat or walking) */}
            <BlobShadow r={0.17 * PEOPLE_SCALE} />
            <group scale={PEOPLE_SCALE}>
              <PersonClock s={s} eating={() => s.phase === 'sit' && guestsRef.current.find((x) => x.id === s.id)?.state === 'eating'} clock={clock}
                talk={talkSide(s)} guest={g} />
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
function PersonClock({ s, eating, clock, talk, guest }: { s: Shown; eating: () => boolean; clock: { current: number }; talk: number
  guest?: GuestView }) {
  const atFridge = s.phase === 'wcIn' && s.wc?.who === 'drink'
  return <Person id={s.id} eating={eating()} walking={s.phase !== 'sit'} clock={clock} talk={talk} mood={guest ? moodOf(guest) : null}
    fade={() => s.fade ?? 1} slippers={() => s.slippers ?? true} pose={atFridge ? 'Fetch' : undefined}
    held={s.drink && s.phase === 'wcBack' ? <DrinkBottle id={s.drink} /> : undefined} />
}
