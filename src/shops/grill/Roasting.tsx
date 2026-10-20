import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { BASE_MATERIAL } from '@/scene/baseMaterial'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { StaticBatch } from '@/scene/StaticBatch'
import { glowOnly } from '@/scene/hoverGlow'
import { inkModel } from '@/scene/inkHull'
import { BlobShadow } from '@/scene/BlobShadow'
import { GAME_SPEED } from '@/scene/speed'
import { brushText, signTexture } from '@/scene/signFont'
import { FloorPiece } from '@/scene/FloorPiece'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CHEFS, type Chef } from '@/data/chefs'
import { LINES } from '@/data/lines'
import type { Lang } from '@/data/i18n'
import { Steam } from '@/scene/Steam'
import { StaffFigure } from '@/scene/Person3D'
import { kindOf, type GuestKind } from '@/data/guests'
import type { Look, Role } from '@/data/staff'
import { ROAST_STAGES, type Roast, type Seasoning } from '@/data/menu'
import { bestStage, PAIRING, PAIRING_DEFAULT, stageOf as seasonStage, timingLoss } from '@/game/taste'
import type { Step } from '@/game/types'
import type { GuestView } from '@/game/types'
import { DECOR, Decor, type Held } from './Decor'
import { BAMBOO_WARE, CLOUD_WARE, forPhone, PLUM_WARE, wareGeometry } from './ware'
import { SHOP } from '@/game/shopState'
import { ALONG, FLOOR_NEAR, staffDoorAt, drinkFor, type DrinkId, sauceSide, POINTER_HINT, PLATES_SET, SEATS_TAKEN, SERVICE, passOf, BAR_GATES, gateOf, TILL, GRILL_BAR_TOP, GRILL_COUNTERS, GRILL_OFFSET, GRILL_SCALE, GRILL_SEATS, SIDE_PULL, FIRE_SHIFT, KITCHEN_DROP, LAY, toGrillScene, CUBBY, CUBBY2, CUBBY_FLOOR_Y, CUBBY_SHELF_Y, type Counter } from './bar'

export { BAR_AT, BAR_TOP }

/** GLTFLoader strips the dot from Blender's "Fish.001", so drop trailing digits to get the type. */
const baseName = (name: string) => name.replace(/\d+$/, '')

// colour multipliers over the (grilled-looking) textures: pale when raw, as authored when done, charred when burnt
const RAW_TINT = new THREE.Color(1.3, 1.28, 1.25)
const DONE_TINT = new THREE.Color(1, 1, 1)
const BURNT_TINT = new THREE.Color(0.22, 0.17, 0.14)
// past done, food keeps darkening slowly, reaching full char at this many cook-times
const CHAR_START = 1.15
const CHAR_FULL = 3
/** where the camera looks from (App CAMERA_POSITION), for food that turns its broad side toward it */
const FACE_CAMERA = new THREE.Vector3(2.9, 2.2, 4.0)
/** how many sips a bowl of soup takes, and how good it is (miso soup doesn't take seasoning) */
const SIPS = 3
const SOUP_TASTE = 78
// the fan (団扇): waved over the fire, how much hotter it gets per unit the fan travels, and at most; the extra heat
// dies back (per second) once the fanning stops, and while it lasts the coals burn away faster in proportion to it
// (per second, at the most it can add: the plain burn is about 0.0002 a second, so fanning flat out burns some 65 times
// as fast)
// (fanned hard, the fire goes past its full 100%, to FIRE_FANNED_MAX (120%), cooking faster still, and the coals burn away much faster
// for it: all the faster the further over 100% it is, FAN_OVER_BURN a second at the top)
const FAN_GAIN = 0.08
const FAN_MAX = 0.3
const FAN_FADE = 0.02
const FAN_BURN = 0.02
const FIRE_FANNED_MAX = 1.2
const FAN_OVER_BURN = 0.03
type Guest = { id: number; orders: string[]; ate: string[]; eaten: number[]; since: number; state: GuestView['state']; seat: number
  /** the one they came in with (a couple, sat side by side) */
  partner?: number
  /** (shop clock) when they got up; their plate and sticks are cleared away a moment later */
  leftAt?: number; cleared?: boolean }
/** at most this many AI customers seated at once; one gives up after waiting this long with nothing to eat */
const MAX_SEATED = GRILL_SEATS.length
/** who can come in as a couple: him, and her */
const COUPLE_HIM = new Set<GuestKind>(['salaryman', 'student', 'highSchoolBoy', 'yankee', 'tourist'])
const COUPLE_HER = new Set<GuestKind>(['officeLady', 'highSchoolGirl', 'yukata', 'maid', 'student'])
const PATIENCE = 150
/** the bar the customers sit at, behind the fire (away from the camera): its middle, length, top, and seats */
const BAR_AT = GRILL_COUNTERS[0].at.clone()
// (high enough for the customers sat at it: about a third of their height above the seat, as a real counter)
const BAR_TOP = GRILL_BAR_TOP
const BAR_SEATS = GRILL_SEATS.length
/** the same, in the scene as drawn (GRILL_SCALE bigger) */
const BAR_AT_SCENE = toGrillScene(BAR_AT)
const BAR_TOP_SCENE = BAR_TOP * GRILL_SCALE + GRILL_OFFSET.y
/** how big food is on the bar, next to the fire's: a skewer about as long as a customer's plate is wide */
const BAR_FOOD_SCALE = 0.5 * GRILL_SCALE
/** the pass, where what's grilled is put out for a server to carry */
const PASS_SCENE = toGrillScene(passOf(GRILL_COUNTERS)).setY(GRILL_BAR_TOP * GRILL_SCALE + GRILL_OFFSET.y + 0.04)
const barSeat = (n: number) => toGrillScene(GRILL_SEATS[n].plate).setY(0)
const HOVER_GLOW = new THREE.Color('#ffb347').multiplyScalar(0.35)
const FLIGHT_SECONDS = 0.7
// the plate: everything is laid pointing the same way (LAY_DIR), side by side across the plate (STACK_DIR) with
// enough room that neighbours don't overlap, then in a second layer on top
// LAY_DIR points at the camera and STACK_DIR runs across the screen, so the row reads left to right
const LAY_DIR = new THREE.Vector3(0.59, 0, 0.81).normalize()
const STACK_DIR = new THREE.Vector3(0.81, 0, -0.59).normalize()
const PLATE_R = 0.5
const SLOT_GAP = 0.2       // wider than the broadest piece (a fish lying flat)
const PER_LAYER = 5
/** a plate takes 20 (four layers of five); the next one is set down behind it */
const PER_PLATE = 20
/**
 * How far to brighten each charcoal material once it has burnt to ash. Its colour multiplies a very dark
 * texture, so scaling the colour up turns the black into a mottled pale grey while keeping the ridges and cracks.
 */
const ASH_GAIN: Record<string, number> = { Ember: 45, Binchotan: 18 }
const ASH_TINT = new THREE.Color('#d8d2c8')
const PLATE_STEP = 1.2
const DISH_TOP: [number, number, number] = [1.8, 0, -0.26]
const BASKET_TOP: [number, number, number] = [2.0, 0, 0.4]
/** where the plates past the first start on the table's top, round the fire (the first is in the cubby under it) */
const PLATE_TOP: [number, number, number] = [1.45, 0.02, -1.24]
/** what lives in the cubby under the table: kept there, not carried about (it's under the top, not on it) */
const CUBBY_KEYS = new Set(['plate-0', 'dish-0', 'rawdish', 'trash', 'basket-0'])
/**
 * Spare plates and dishes stacked where the first of each stands, as they are in a shop: the one in use sits on top
 * of the stack, and taken off it (dragged away), it leaves the rest standing. How many under each, and how high each
 * one stacks.
 */
const SPARES: Record<string, { n: number; step: number }> = { 'plate-0': { n: 3, step: 0.075 }, 'dish-0': { n: 3, step: 0.05 },
  rawdish: { n: 2, step: 0.05 } }
/** seconds to eat one piece: a few bites, each taking a chunk out and chewed before the next */
const EAT_SECONDS = 3
const BITES_PER_PIECE = 4
const UP = new THREE.Vector3(0, 1, 0)
const ZERO = new THREE.Vector3()
/** the pinching hand is drawn a little above the pinch of salt it holds */
const HAND_OFFSET = new THREE.Vector3(0, 0.07, 0)
/** the water bucket (bare sticks and burnt food go in it too) */
const BIN_R = 0.27 * 1.65
/** the water bucket drawn this much bigger than modelled */
const BUCKET_SCALE = 1.65
/** the trash bin for bare sticks and burnt food (the water bucket is only for water) */
const TRASH_R = 0.24
const TRASH_H = 0.36

/** split bamboo in a 2-over-2 twill (網代編み), honey-coloured and a little smoked, wrapped round the basket */
const TRASH_WEAVE = (() => {
  if (typeof document === 'undefined') return null
  const W = 512
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  let seed = 8
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = '#4a3420'
  g.fillRect(0, 0, W, H)
  const cell = 16
  for (let i = 0; i < W / cell; i++) {
    for (let j = 0; j < H / cell; j++) {
      const over = (i + j) % 4 < 2
      const tone = 0.85 + rnd() * 0.2
      const r = Math.round((over ? 214 : 186) * tone)
      const gg = Math.round((over ? 172 : 140) * tone)
      const b = Math.round((over ? 104 : 80) * tone)
      g.fillStyle = `rgb(${r}, ${gg}, ${b})`
      if (over) g.fillRect(i * cell, j * cell + 1.5, cell, cell - 3)
      else g.fillRect(i * cell + 1.5, j * cell, cell - 3, cell)
      // the bamboo's sheen and its fibres
      g.fillStyle = 'rgba(255, 240, 200, 0.25)'
      if (over) g.fillRect(i * cell, j * cell + 4, cell, 1.5)
      else g.fillRect(i * cell + 4, j * cell, 1.5, cell)
      g.fillStyle = 'rgba(80, 50, 20, 0.3)'
      if (over) g.fillRect(i * cell, j * cell + 10, cell, 1)
      else g.fillRect(i * cell + 10, j * cell, 1, cell)
    }
  }
  // smoked darker toward the foot
  const grad = g.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, 'rgba(60, 35, 15, 0.35)')
  grad.addColorStop(1, 'rgba(60, 35, 15, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  const t = new THREE.CanvasTexture(forPhone(c))
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 1.4)
  return t
})()
/** rattan wound round and round: diagonal dark-and-light bands */
const RATTAN = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 16
  const g = c.getContext('2d')!
  for (let x = -16; x < 128; x += 6) {
    g.fillStyle = (x / 6) % 2 ? '#7a4e2a' : '#3e2412'
    g.beginPath()
    g.moveTo(x, 16)
    g.lineTo(x + 6, 16)
    g.lineTo(x + 12, 0)
    g.lineTo(x + 6, 0)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(8, 1)
  return t
})()
const TRASH_LABEL = signTexture(96, 180, (g) => {
  // washi: off-white with fibres
  g.fillStyle = '#f3ecd9'
  g.fillRect(0, 0, 96, 180)
  g.strokeStyle = 'rgba(150, 130, 100, 0.25)'
  for (let i = 0; i < 40; i++) {
    g.beginPath()
    g.moveTo(Math.random() * 96, Math.random() * 180)
    g.lineTo(Math.random() * 96, Math.random() * 180)
    g.stroke()
  }
  brushText(g, 'ご', 48, 52, 52, { fill: '#1e1a16', shadow: 'rgba(120,90,50,0.25)' })
  brushText(g, 'み', 48, 112, 52, { fill: '#1e1a16', shadow: 'rgba(120,90,50,0.25)' })
  g.fillStyle = '#b4302a'
  g.fillRect(34, 148, 28, 22)
  brushText(g, '屑', 48, 160, 18, { fill: '#f3ecd9' })
})

function TrashBin({ position, container, contents = 0 }: { position: [number, number, number]; container: string; contents?: number }) {
  const R = TRASH_R
  // a Japanese waste basket (屑籠): split bamboo woven in a twill (網代編み) round a slightly flaring body, its rim
  // and foot bound in dark rattan, a strip of washi on the front with ごみ brushed on it; open-topped, so the
  // woven inside shows
  const body = useMemo(() => {
    const g = new THREE.CylinderGeometry(R * 1.04, R * 0.86, TRASH_H, 64, 1, true)
    g.translate(0, TRASH_H / 2, 0)
    return g
  }, [R])
  const inner = useMemo(() => {
    const g = new THREE.CylinderGeometry(R * 0.99, R * 0.82, TRASH_H - 0.02, 48, 1, true)
    g.translate(0, TRASH_H / 2 + 0.01, 0)
    return g
  }, [R])
  const floor = useMemo(() => new THREE.CircleGeometry(R * 0.84, 40), [R])
  // what's been thrown in: bare skewers, crumpled paper napkins, burnt scraps — heaped up as more goes in
  const heap = useMemo(() => {
    let seed = 21
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 24 }, (_, i) => {
      const kind = i % 3 === 0 ? 'stick' : i % 3 === 1 ? 'paper' : 'scrap'
      const a = rnd() * Math.PI * 2
      const d = R * 0.6 * Math.sqrt(rnd())
      const geo = kind === 'paper' ? new THREE.IcosahedronGeometry(0.045 + rnd() * 0.02, 1)
        : kind === 'scrap' ? new THREE.DodecahedronGeometry(0.03 + rnd() * 0.015, 0) : null
      if (geo) {
        const pp = geo.attributes.position
        for (let k = 0; k < pp.count; k++) pp.setXYZ(k, pp.getX(k) * (0.7 + rnd() * 0.5), pp.getY(k) * (0.6 + rnd() * 0.4), pp.getZ(k) * (0.7 + rnd() * 0.5))
        geo.computeVertexNormals()
      }
      return { kind, geo, x: Math.cos(a) * d, z: Math.sin(a) * d, rot: [rnd() * 3, rnd() * 3, rnd() * 3] as [number, number, number],
        tilt: (rnd() - 0.5) * 1.6, shade: ['#f4efe2', '#e6dcc4', '#efe8d6'][i % 3] }
    })
  }, [R])
  const shown = Math.min(contents, heap.length)
  const level = (n: number) => Math.min(TRASH_H - 0.03, 0.17 + n * 0.008)
  const face = Math.atan2(LAY_DIR.x, LAY_DIR.z)
  const fr = R * 1.04 + 0.004
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={TRASH_WEAVE} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={inner}>
        <meshToonMaterial color="#9a8058" map={TRASH_WEAVE} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={body} scale={[1.03, 1.01, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      <mesh geometry={floor} rotation-x={-Math.PI / 2} position-y={0.02}>
        <meshToonMaterial color="#6e5634" />
      </mesh>
      {/* the rattan-bound rim, a second band below it, and the foot */}
      <mesh position-y={TRASH_H} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 1.04, 0.016, 8, 64]} />
        <meshToonMaterial color="#4a2e18" map={RATTAN} />
      </mesh>
      <mesh position-y={TRASH_H * 0.82} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 1.01, 0.007, 6, 64]} />
        <meshToonMaterial color="#5a3820" />
      </mesh>
      <mesh position-y={0.014} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 0.87, 0.014, 8, 64]} />
        <meshToonMaterial color="#4a2e18" map={RATTAN} />
      </mesh>
      {/* the washi strip with ごみ */}
      <mesh position={[LAY_DIR.x * fr * 0.97, TRASH_H * 0.48, LAY_DIR.z * fr * 0.97]} rotation-y={face}>
        <planeGeometry args={[0.09, 0.17]} />
        <meshToonMaterial map={TRASH_LABEL} />
      </mesh>
      {heap.slice(0, shown).map((h, i) => {
        const y = level(i + 1) - 0.02
        if (h.kind === 'stick') {
          return (
            <mesh key={i} position={[h.x, y + 0.08, h.z]} rotation={[h.tilt, h.rot[1], h.tilt * 0.6]}>
              <cylinderGeometry args={[0.005, 0.004, 0.32, 5]} />
              <meshToonMaterial color="#c9a46a" />
            </mesh>
          )
        }
        return (
          <mesh key={i} geometry={h.geo!} position={[h.x, y, h.z]} rotation={h.rot}>
            <meshToonMaterial color={h.kind === 'paper' ? h.shade : '#2a1d14'} />
          </mesh>
        )
      })}
    </group>
  )
}

/** the tray for raw food waiting to go on the fire: a grid of spots */
const TRAY_ROWS = 4
const TRAY_W = 1.6
const TRAY_D = 0.9
/** the seasoning box, as a round footprint for bumping into things */
const BOX_R = 0.46
/** where the seasoning box's first half starts out: beside the cook, along and across the table */
const BOX_SPOT = { along: 1.55, lay: 1.3 }
/** how much bigger the fire pit (its ground and stones) is drawn than modelled */
const PIT_SCALE = 1.3
/**
 * The pit's ground texture is white salt inside and brown earth out to a fading rim: the earth is faded away, so only the salt
 * shows (nothing muddy round the stones, over the table).
 */
function saltOnly(mesh: THREE.Mesh) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  const img = mat.map?.image as CanvasImageSource & { width: number; height: number } | undefined
  if (!img || typeof document === 'undefined') return
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, c.width, c.height)
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const r = Math.hypot(x / c.width - 0.5, y / c.height - 0.5) * 2
      const k = Math.min(1, Math.max(0, (r - 0.5) / 0.08))
      px.data[(y * c.width + x) * 4 + 3] *= 1 - k * k * (3 - 2 * k)
    }
  }
  g.putImageData(px, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.flipY = mat.map!.flipY
  t.colorSpace = mat.map!.colorSpace
  t.anisotropy = mat.map!.anisotropy
  mat.map = t
  mat.needsUpdate = true
}
/** how much higher the pit (its stones, coals and net) stands than it was modelled, with the flames and smoke over it */
export const PIT_LIFT = 0.12
const PIT_PARTS = /^(FirePit|Stone|Charcoal|BinchotanHeap)/
/** the stone ring's outer edge: nothing can be pushed into the fire */
const RING_CLEAR = 1.15 * PIT_SCALE

/**
 * The tray's planed cedar: three boards with the grain running along them, drawn as wavering growth lines that
 * bunch round a knot or two, a dark seam between boards, and a few darker stains where wet food has sat. Mapped
 * in the tray's own units (one texture across 1.6 x 1.6).
 */
const TRAY_WOOD = (() => {
  if (typeof document === 'undefined') return null
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = '#c4935a'
  g.fillRect(0, 0, S, S)
  const boards = 3
  const bh = S / boards
  for (let b = 0; b < boards; b++) {
    const y0 = b * bh
    // each board its own shade
    g.fillStyle = `rgba(${150 + rnd() * 40}, ${100 + rnd() * 25}, ${55 + rnd() * 20}, 0.35)`
    g.fillRect(0, y0, S, bh)
    // a knot or two that the grain flows round
    const knots = Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => ({ x: rnd() * S, y: y0 + bh * (0.25 + rnd() * 0.5),
      r: 10 + rnd() * 14 }))
    for (let k = 0; k < 46; k++) {
      const base = y0 + (k / 46) * bh
      g.strokeStyle = `rgba(${90 + rnd() * 30}, ${55 + rnd() * 15}, 25, ${0.18 + rnd() * 0.32})`
      g.lineWidth = 0.8 + rnd() * 2.2
      g.beginPath()
      for (let x = 0; x <= S; x += 8) {
        let y = base + Math.sin(x * 0.006 + k * 0.7 + b) * 5 + Math.sin(x * 0.021 + k) * 1.5
        for (const kn of knots) {
          const dx = x - kn.x
          const dy = y - kn.y
          const d2 = dx * dx + dy * dy
          y += (dy / (Math.sqrt(d2) + 1)) * kn.r * 2.2 * Math.exp(-d2 / (kn.r * kn.r * 9))
        }
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
    for (const kn of knots) {
      const grad = g.createRadialGradient(kn.x, kn.y, 1, kn.x, kn.y, kn.r)
      grad.addColorStop(0, 'rgba(70, 38, 15, 0.95)')
      grad.addColorStop(0.6, 'rgba(110, 62, 28, 0.7)')
      grad.addColorStop(1, 'rgba(110, 62, 28, 0)')
      g.fillStyle = grad
      g.beginPath()
      g.ellipse(kn.x, kn.y, kn.r * 1.5, kn.r, 0, 0, Math.PI * 2)
      g.fill()
    }
    // the seam to the next board
    g.fillStyle = 'rgba(55, 32, 14, 0.75)'
    g.fillRect(0, y0 + bh - 2, S, 3)
    g.fillStyle = 'rgba(255, 230, 190, 0.25)'
    g.fillRect(0, y0 + bh + 1, S, 2)
  }
  // fine pores along the grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(80, 45, 20, ${0.15 + rnd() * 0.25})`
    g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 6, 1)
  }
  // stains where wet food has rested
  for (let i = 0; i < 5; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const r = 30 + rnd() * 60
    const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r)
    grad.addColorStop(0, 'rgba(90, 55, 25, 0.22)')
    grad.addColorStop(1, 'rgba(90, 55, 25, 0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const t = new THREE.CanvasTexture(forPhone(c))
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 1.6, 1 / 1.6)
  t.anisotropy = 8
  return t
})()

/**
 * The bar (カウンター) the customers sit at while the shop is open, behind the fire: a long plank of pale hinoki on
 * a dark base, a raised lip on the customers' side, and a little plate with chopsticks on a rest at every seat —
 * the chef serves each piece onto it straight off the grill.
 */
function Bar() {
  // (where the second counter butts against the first, the first's lip stops short of it, so nothing runs through)
  // (and a way through for the staff at the outer end of each: the first counter's far end by the till, the side
  // counter's near end)
  // (and one top over both, in one piece round the corner, its edges rounded and flush where they meet)
  return (
    <group position={GRILL_OFFSET} scale={GRILL_SCALE}>
      <StaticBatch>
        {GRILL_COUNTERS.map((c, i) => <BarCounter key={i} c={c} trim={i === 0 && GRILL_COUNTERS.length > 1 ? 0.62 : 0} butt={i > 0}
          gate={BAR_GATES[i]} noTop={GRILL_COUNTERS.length > 1} />)}
        {GRILL_COUNTERS.length > 1 && <BarTop />}
      </StaticBatch>
      {GRILL_COUNTERS.map((c, i) => BAR_GATES[i] && <BarGate key={i} c={c} gate={BAR_GATES[i]} />)}
    </group>
  )
}
/**
 * The cook's table everything stands on (the fire pit, the tray, the plates): a thick top of pale planks, its front
 * and sides boarded dark, down to the floor the customers walk on. Its back butts against the bar's cook's edges;
 * a bay is cut into its front, left of the tray, and the cook stands in there, close by the fire and the seasonings,
 * in full view (no table in front of him).
 */
// (the fire in the middle across it, the cook's whole side open: the front face is a straight run the cook stands along, the
// cubby for the plates cut into it under the top)
const COOK_TABLE = { lay: [-2.1, 2.1], along: [-2.4 + 2 * SIDE_PULL, 3.1] }
/** the cook, as big as the customers at the bar */
const CHEF_SCALE = 1.3 * GRILL_SCALE
/** the table as boxes (lay from–to, along from–to): all of it behind the cubby, and the front either side of it */
const COOK_TABLE_PARTS: [number, number, number, number][] = [
  [COOK_TABLE.lay[0], CUBBY.lay[0], COOK_TABLE.along[0], COOK_TABLE.along[1]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], COOK_TABLE.along[0], CUBBY2.along[0]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], CUBBY2.along[1], CUBBY.along[0]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], CUBBY.along[1], COOK_TABLE.along[1]],
]
export type CrewMember = { id: string; role: Role; look: Look }
/**
 * Where each of the staff stands while the shop's open (the owner is the player, so isn't drawn): the second cook at
 * the fire in the bay cut into the cook's table, the third cook and the stock keeper at its right-hand end, facing in
 * along it; the cashier behind the till by the door; one server at
 * the near end of the bar by the till, the other at the dead end of the side counter's aisle (both out of the way the
 * customers walk). The first two of each job are shown.
 */
const KITCHEN_YAW = Math.atan2(-ALONG.x, -ALONG.z)
const kitchenAt = (lay: number) => new THREE.Vector3().addScaledVector(LAY, lay).addScaledVector(ALONG, 3.55).setY(GRILL_OFFSET.y - KITCHEN_DROP)
/** one of the staff at their place; once the shop's shut and empty (SHOP.leaving) they walk out by the staff door and are gone */
function CrewWalk({ at, yaw, children }: { at: THREE.Vector3; yaw: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const exit = useMemo(() => toGrillScene(staffDoorAt(GRILL_COUNTERS[0])).setY(GRILL_OFFSET.y), [])
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (!SHOP.leaving) {
      o.position.copy(at)
      o.rotation.y = yaw
      o.visible = true
      return
    }
    const d = exit.clone().sub(o.position).setY(0)
    const len = d.length()
    if (len > 0.05) {
      o.position.addScaledVector(d.normalize(), Math.min(len, Math.min(dt, 0.1) * 1.6))
      o.rotation.y = Math.atan2(d.x, d.z)
    }
    o.position.y = at.y
    o.visible = len > 0.2
  })
  return <group ref={g} position={at} rotation-y={yaw} scale={CHEF_SCALE}>{children}</group>
}
function crewPlaces(crew: CrewMember[]) {
  const c0 = GRILL_COUNTERS[0]
  const onFloor = (v: THREE.Vector3) => toGrillScene(v).setY(GRILL_OFFSET.y)
  const spots: Record<Role, { at: THREE.Vector3; yaw: number }[]> = {
    chef: [{ at: CHEF_AT, yaw: CHEF_YAW }],
    sous: [{ at: kitchenAt(1.3), yaw: KITCHEN_YAW }],
    stock: [{ at: kitchenAt(-0.6), yaw: KITCHEN_YAW }],
    cashier: [{ at: onFloor(c0.at.clone().addScaledVector(c0.along, c0.length / 2 + TILL.along).addScaledVector(c0.lay, TILL.lay + TILL.D / 2 + 0.3)),
      yaw: Math.atan2(-c0.lay.x, -c0.lay.z) }],
    // (the servers are on the floor with the customers, and walk: GuestBar3D draws them)
    server: [],
  }
  const used: Partial<Record<Role, number>> = {}
  return crew.flatMap((m) => {
    const k = used[m.role] ?? 0
    used[m.role] = k + 1
    const spot = spots[m.role][k]
    return spot ? [{ m, ...spot }] : []
  })
}
/** where the cook stands (on the floor, in the notch), and the way he faces: in at the fire */
const CHEF_AT = new THREE.Vector3().addScaledVector(LAY, 2.62).addScaledVector(ALONG, -0.4).setY(GRILL_OFFSET.y - KITCHEN_DROP)
const CHEF_YAW = Math.atan2(-CHEF_AT.x, -CHEF_AT.z)
const COOK_TABLE_WOOD = (() => {
  if (!TRAY_WOOD) return null
  const t = TRAY_WOOD.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 1.6, 1 / 1.6)
  t.needsUpdate = true
  return t
})()
/**
 * The kitchen's floor, inside the counters: from the first counter's floor's edge (lay) and the side counter's (along)
 * to the side counter's near end and the first counter's far end, so it meets the customers' floors without a gap or
 * an overlap (worked out from the counters, in the scene's frame).
 */
const KITCHEN_FLOOR = (() => {
  const [c0, c1] = GRILL_COUNTERS
  const lay0 = toGrillScene(c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR)).dot(LAY)
  const along0 = c1 ? toGrillScene(c1.at.clone().addScaledVector(c1.lay, FLOOR_NEAR)).dot(ALONG) : COOK_TABLE.along[0] - 0.4
  const along1 = toGrillScene(c0.at.clone().addScaledVector(c0.along, c0.length / 2 + 0.15)).dot(ALONG)
  const lay1 = c1 ? toGrillScene(c1.at.clone().addScaledVector(c1.along, -c1.length / 2 - 0.35)).dot(LAY) : COOK_TABLE.lay[1] + 0.9
  return { lay: [lay0, lay1], along: [along0, along1] }
})()
function CookTable({ floor = true }: { floor?: boolean }) {
  // (and under it all the kitchen's floor, from the bar's cook's edges to the front, and on past the table's
  // right-hand end where the other cooks stand)
  const W = KITCHEN_FLOOR.along[1] - KITCHEN_FLOOR.along[0], D = KITCHEN_FLOOR.lay[1] - KITCHEN_FLOOR.lay[0]
  const mid = new THREE.Vector3().addScaledVector(ALONG, (KITCHEN_FLOOR.along[0] + KITCHEN_FLOOR.along[1]) / 2)
    .addScaledVector(LAY, (KITCHEN_FLOOR.lay[0] + KITCHEN_FLOOR.lay[1]) / 2).setY(GRILL_OFFSET.y - KITCHEN_DROP + 0.004 * GRILL_SCALE)
  return (
    <>
      {/* (set back under the top on their outer faces only: where they meet, they run into each other, no gap) */}
      {COOK_TABLE_PARTS.map((p, i) => <CookTableBox key={i} lay={[p[0], p[1]]} along={[p[2], p[3]]}
        inset={i === 0 ? [0.06, -0.01, 0.06, 0.06] : i === 1 ? [-0.01, 0.06, 0.06, -0.01] : i === 2 ? [-0.01, 0.06, -0.01, -0.01] : [-0.01, 0.06, -0.01, 0.06]} />)}
      <CubbyFrame />
      <CookTableTop />
      {/* (the same boards as the customers', laid the same way; with the shop open and the room drawn, its one floor
          runs under the kitchen too) */}
      {floor && (
        <group position={mid} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
          <FloorPiece w={W} l={D} />
        </group>
      )}
    </>
  )
}
/**
 * The cook's table's top, in one piece round its bay: a thick plank top with its edges rounded over (面取り), the
 * grain running on unbroken, its ink outline round the whole shape (no seams where the parts under it meet).
 */
/** a closed outline through these corners, each rounded off to its radius (a curve cut in from both its sides) */
function roundedShape(pts: [number, number][], radii: number[]) {
  const sh = new THREE.Shape()
  pts.forEach(([x, y], k) => {
    const [px, py] = pts[(k + pts.length - 1) % pts.length], [nx, ny] = pts[(k + 1) % pts.length]
    const dp = Math.hypot(px - x, py - y), dn = Math.hypot(nx - x, ny - y)
    const r = Math.min(radii[k], dp / 2, dn / 2)
    const a: [number, number] = [x + (px - x) / dp * r, y + (py - y) / dp * r]
    const b: [number, number] = [x + (nx - x) / dn * r, y + (ny - y) / dn * r]
    if (k) sh.lineTo(a[0], a[1])
    else sh.moveTo(a[0], a[1])
    sh.quadraticCurveTo(x, y, b[0], b[1])
  })
  sh.closePath()
  return sh
}
function tableTopGeometry(grow: number, thick: number) {
  const { along: [a0, a1], lay: [l0, l1] } = COOK_TABLE
  const i = 0.025 - grow
  const pts: [number, number][] = [[a0 + i, l0 + i], [a1 - i, l0 + i], [a1 - i, l1 - i], [a0 + i, l1 - i]]
  // (its corners rounded off, as a planed top would be; the outline, grown out, keeps to the same curves)
  const sh = roundedShape(pts, [0.16, 0.16, 0.16, 0.16].map((r) => r + grow))
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08 - 2 * thick, bevelEnabled: true, bevelThickness: thick, bevelSize: 0.025 + grow * 0.6,
    bevelSegments: 3, curveSegments: 6 })
  g.rotateX(Math.PI / 2)
  g.translate(0, -thick, 0)
  return g
}
const TABLE_TOP = tableTopGeometry(0, 0.015)
const TABLE_TOP_INK = tableTopGeometry(0.012, 0.022)
function CookTableTop() {
  return (
    <group rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <mesh geometry={TABLE_TOP} receiveShadow>
        <meshToonMaterial color="#d8c4a6" map={COOK_TABLE_WOOD} />
      </mesh>
      <mesh geometry={TABLE_TOP_INK}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
/** a plain block of the table's body, by its extents (along, lay, and height from–to) */
function Block({ along: a, lay: l, y: [y0, y1], color }: { along: [number, number]; lay: [number, number]; y: [number, number]; color: string }) {
  const mid = new THREE.Vector3().addScaledVector(ALONG, (a[0] + a[1]) / 2).addScaledVector(LAY, (l[0] + l[1]) / 2)
  return (
    <group position={mid} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <mesh position-y={(y0 + y1) / 2} ref={(m) => { if (m) inkModel(m) }}>
        <boxGeometry args={[a[1] - a[0], y1 - y0, l[1] - l[0]]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  )
}
/** the cubby cut into the table's front: a header over it under the top, a plinth at its foot, a shelf over its right-hand part */
/** the cubby's boards, all one colour */
const CUBBY_WOOD = '#4a3524'
function CubbyFrame() {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const front = COOK_TABLE.lay[1] - 0.06
  return (
    <>
      <Block along={[CUBBY.along[0], CUBBY.along[1]]} lay={[CUBBY.lay[0], front]} y={[-0.3, -0.08]} color={CUBBY_WOOD} />
      <Block along={[CUBBY.along[0], CUBBY.along[1]]} lay={[CUBBY.lay[0], front]} y={[floor, CUBBY_FLOOR_Y]} color={CUBBY_WOOD} />
      <Block along={[CUBBY.shelfAlong, CUBBY.along[1]]} lay={[CUBBY.lay[0], front]} y={[CUBBY_SHELF_Y - CUBBY.shelfThick, CUBBY_SHELF_Y]} color={CUBBY_WOOD} />
      {/* (and the second, on the left: the same header, floor and a shelf the whole way across) */}
      <Block along={[CUBBY2.along[0], CUBBY2.along[1]]} lay={[CUBBY2.lay[0], front]} y={[-0.3, -0.08]} color={CUBBY_WOOD} />
      <Block along={[CUBBY2.along[0], CUBBY2.along[1]]} lay={[CUBBY2.lay[0], front]} y={[floor, CUBBY_FLOOR_Y]} color={CUBBY_WOOD} />
      <Block along={[CUBBY2.along[0], CUBBY2.along[1]]} lay={[CUBBY2.lay[0], front]} y={[CUBBY_SHELF_Y - CUBBY.shelfThick, CUBBY_SHELF_Y]} color={CUBBY_WOOD} />
    </>
  )
}
function CookTableBox({ lay: l, along: a, inset: [i0, i1, j0, j1] }: { lay: [number, number]; along: [number, number]
  /** how far each face is set back under the top: lay's low and high ends, along's low and high (less than 0: run on) */
  inset: [number, number, number, number] }) {
  const lay = [l[0] + i0, l[1] - i1], along = [a[0] + j0, a[1] - j1]
  const W = along[1] - along[0] + 0.12, D = lay[1] - lay[0] + 0.12
  const mid = new THREE.Vector3().addScaledVector(ALONG, (along[0] + along[1]) / 2).addScaledVector(LAY, (lay[0] + lay[1]) / 2)
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  // (the top is one piece over all of them: CookTableTop)
  return (
    <group position={mid} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      {/* the body, set back a little under the top */}
      <mesh position-y={(floor - 0.08) / 2}>
        <boxGeometry args={[W - 0.12, -floor - 0.08, D - 0.12]} />
        <meshToonMaterial color="#3a2a1e" />
      </mesh>
    </group>
  )
}
/**
 * The bar's top as one plank round the corner: each counter's top as a rectangle (along the first counter, across
 * it), the side counter's outer edge squared up with the first's end, joined into an L and given rounded edges.
 */
const BAR_DEPTH = 0.62
/** how near someone has to come for a gate to swing open for them (the bar's sizes), and how quickly it swings */
const GATE_NEAR = 0.75
const GATE_SWING = 4
/**
 * The swing door across a counter's gate: a leaf of slatted wood as high as the bar, its top capped in the bar's own
 * wood so it reads as the bar run on, hung on brass hinges on the base's end. It stands shut, flush with the bar, and
 * swings in toward the kitchen when one of the staff comes up to it (SERVICE.walkers), shutting again behind them.
 */
function BarGate({ c, gate }: { c: Counter; gate: (typeof BAR_GATES)[number] }) {
  const yaw = Math.atan2(-c.along.z, c.along.x)
  const end = gate.end
  // (the hinge: the inner edge of the gap, on the base's line; the leaf reaches from it across the doorway)
  const { hinge, mid: middle } = useMemo(() => gateOf(c, gate), [c, gate])
  const G = gate.leaf
  const leaf = useRef<THREE.Group>(null)
  const open = useRef(0)
  useFrame((_, dt) => {
    const near = SERVICE.walkers.some((w) => Math.hypot(w.x - middle.x, w.z - middle.z) < GATE_NEAR)
    open.current = THREE.MathUtils.clamp(open.current + (near ? 1 : -1) * Math.min(dt, 0.1) * GATE_SWING, 0, 1)
    const k = open.current
    if (leaf.current) leaf.current.rotation.y = -end * (Math.PI / 2) * k * k * (3 - 2 * k)
  })
  const H = BAR_TOP - 0.02
  return (
    <group position={c.at} rotation-y={yaw}>
      <group position={[hinge, 0, 0.08]}>
        <group ref={leaf} name="gate-leaf">
          <group position-x={end * (G / 2 - 0.005)}>
            {/* a framed door of planed wood: two stiles and three rails with rounded edges, the grain running up the
                stiles and across the rails, and a recessed board panel of upright planks between them */}
            <GateLeaf w={G - 0.02} h={H - 0.06} y={0.05} />
            {[0.16, BAR_TOP - 0.16].map((y) => [1, -1].map((sd) => (
              <group key={`${y}${sd}`} position={[-end * (G / 2 - 0.005) + end * 0.022, y, sd * 0.042]}>
                <mesh geometry={HINGE_GEO.plate}><meshToonMaterial color="#b89040" /></mesh>
                {[-1, 1].map((k) => (
                  <mesh key={k} geometry={HINGE_GEO.screw} position={[0, k * 0.02, sd * 0.0025]} rotation-x={Math.PI / 2}>
                    <meshToonMaterial color="#5a4220" />
                  </mesh>
                ))}
              </group>
            )))}
          </group>
        </group>
        {/* the door's post (柱): a jamb of pale planed wood standing up the base's end, its face rounded, the hinges on it,
            set apart from the dark base so the gate reads as a door hung on a post; and a thin dark shadow line down the
            gap between it and the door */}
        {/* (a hair wider, deeper and taller than the base it stands against, so its faces don't lie in the base's own planes and z-fight) */}
        <mesh position={[-end * 0.022, (BAR_TOP - 0.06) / 2 + 0.002, 0]} castShadow>
          <primitive object={gateGeo(0.056, BAR_TOP - 0.056, 0.436, 0.01)} attach="geometry" />
          <meshToonMaterial color="#d8b88a" map={GATE_WOOD.up} />
        </mesh>
        <mesh position={[-end * 0.022, (BAR_TOP - 0.06) / 2 + 0.002, 0]} scale={[1.12, 1.01, 1.03]}>
          <primitive object={gateGeo(0.056, BAR_TOP - 0.056, 0.436, 0.01)} attach="geometry" />
          <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
        </mesh>
        {/* the hinges, top and bottom: a brass knuckle on the hinge's line, a leaf screwed to the base's end and one to
            the door's stile (that one turns with it: GateHingeLeaf) */}
        {[0.16, BAR_TOP - 0.16].map((y) => (
          <group key={y} position-y={y}>
            <mesh geometry={HINGE_GEO.knuckle}><meshToonMaterial color="#c8a050" /></mesh>
            <mesh geometry={HINGE_GEO.knuckle} scale={[1.25, 1.03, 1.25]}><meshBasicMaterial color="#3b2a20" side={THREE.BackSide} /></mesh>
            {[1, -1].map((sd) => (
              <group key={sd}>
                <mesh geometry={HINGE_GEO.plate} position={[-end * 0.022, 0, sd * 0.024]}><meshToonMaterial color="#b89040" /></mesh>
                {[-1, 1].map((k) => (
                  <mesh key={k} geometry={HINGE_GEO.screw} position={[-end * 0.022, k * 0.02, sd * 0.0265]} rotation-x={Math.PI / 2}>
                    <meshToonMaterial color="#5a4220" />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}
/** a gate's hinge: its knuckle (a brass barrel on the hinge's line), its leaves, their screw heads */
const HINGE_GEO = {
  knuckle: new THREE.CylinderGeometry(0.009, 0.009, 0.075, 10),
  plate: new THREE.BoxGeometry(0.036, 0.07, 0.004),
  screw: new THREE.CylinderGeometry(0.004, 0.004, 0.003, 8),
}
/** rounded boxes for the gate's parts, made once per size */
const GATE_GEO = new Map<string, THREE.BufferGeometry>()
function gateGeo(w: number, h: number, d: number, r: number) {
  const k = [w, h, d, r].map((v) => v.toFixed(3)).join()
  if (!GATE_GEO.has(k)) GATE_GEO.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)))
  return GATE_GEO.get(k)!
}
/** the bar's wood for the gate, its grain turned to run up (the stiles, the panel) or across (the rails, the cap) */
const GATE_WOOD = (() => {
  const turn = (up: boolean) => {
    if (!TRAY_WOOD) return null
    const t = TRAY_WOOD.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.center.set(0.5, 0.5)
    t.rotation = up ? Math.PI / 2 : 0
    t.repeat.set(0.35, 0.35)
    t.needsUpdate = true
    return t
  }
  return { up: turn(true), across: turn(false) }
})()
/** the gate's door: a frame of stiles and rails, rounded, and a panel of planks set back in it, both sides alike */
function GateLeaf({ w, h, y }: { w: number; h: number; y: number }) {
  const S = 0.07, T = 0.075
  const parts: { at: [number, number, number]; size: [number, number, number]; up: boolean }[] = [
    { at: [-(w - S) / 2, h / 2, 0], size: [S, h, T], up: true },
    { at: [(w - S) / 2, h / 2, 0], size: [S, h, T], up: true },
    ...[S / 2, h * 0.52, h - S / 2].map((ry) => ({ at: [0, ry, 0] as [number, number, number], size: [w - 2 * S + 0.004, S, T * 0.9] as [number, number, number], up: false })),
  ]
  return (
    <group position-y={y}>
      {parts.map((pt, i) => (
        <group key={i} position={pt.at}>
          <mesh castShadow>
            <primitive object={gateGeo(...pt.size, 0.012)} attach="geometry" />
            <meshToonMaterial color="#e8cfa6" map={pt.up ? GATE_WOOD.up : GATE_WOOD.across} />
          </mesh>
          <mesh scale={[1 + 0.008 / pt.size[0], 1 + 0.008 / pt.size[1], 1.15]}>
            <primitive object={gateGeo(...pt.size, 0.012)} attach="geometry" />
            <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
      {/* the panels, upper and lower, of upright boards with dark joints between, set back in the frame */}
      {[[S, h * 0.52 - S / 2], [h * 0.52 + S / 2, h - S]].map(([a, b], i) => (
        <group key={i} position-y={(a + b) / 2}>
          <mesh>
            <boxGeometry args={[w - 2 * S, b - a, T * 0.4]} />
            <meshToonMaterial color="#d2b48a" map={GATE_WOOD.up} />
          </mesh>
          {[-1, 0, 1].map((k) => [1, -1].map((sd) => (
            <mesh key={`${k}${sd}`} position={[k * (w - 2 * S) / 4, 0, sd * T * 0.21]} rotation-y={sd > 0 ? 0 : Math.PI}>
              <planeGeometry args={[0.006, b - a]} />
              <meshBasicMaterial color="#5a3a22" />
            </mesh>
          )))}
        </group>
      ))}
    </group>
  )
}
function barTopShape(grow: number) {
  const box = (c: Counter) => {
    const hl = (c.length + 0.3) / 2, hd = BAR_DEPTH / 2
    const pts = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => c.at.clone().addScaledVector(c.along, a * hl).addScaledVector(c.lay, b * hd))
    const xs = pts.map((p) => p.dot(ALONG)), ys = pts.map((p) => p.dot(LAY))
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  }
  const a = box(GRILL_COUNTERS[0]), b = box(GRILL_COUNTERS[1])
  // (the side counter stands off the first's cook's side, at its start: its outer edge flush with the first's end)
  const i = 0.025 - grow
  const x0 = Math.min(a.x0, b.x0) + i
  // (short of each gate's flap, which is a piece of its own: at the first counter's far end, the side counter's near
  // one, which is its high-lay end here)
  const ax1 = a.x1 - BAR_GATES[0].w, by1 = b.y1 - BAR_GATES[1].w
  const pts: [number, number][] = [[x0, a.y0 + i], [ax1 - i, a.y0 + i], [ax1 - i, a.y1 - i], [b.x1 - i, a.y1 - i], [b.x1 - i, by1 - i],
    [x0, by1 - i]]
  const sh = new THREE.Shape()
  pts.forEach(([x, y], k) => (k ? sh.lineTo(x, y) : sh.moveTo(x, y)))
  const thick = 0.012 + grow * 0.6
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06 - 2 * thick, bevelEnabled: true, bevelThickness: thick, bevelSize: 0.025 + grow * 0.6,
    bevelSegments: 3, curveSegments: 4 })
  // (the boards on the top run along each arm of the L: along the first counter, and along the side counter, at one scale
  // over both: the faces' texture coordinates laid from where they are, not stretched over the shape)
  const pos = g.attributes.position, uv = g.attributes.uv
  for (let t = 0; t < pos.count; t += 3) {
    const nz = Math.abs((pos.getX(t + 1) - pos.getX(t)) * (pos.getY(t + 2) - pos.getY(t)) - (pos.getY(t + 1) - pos.getY(t)) * (pos.getX(t + 2) - pos.getX(t)))
    const flat = pos.getZ(t) === pos.getZ(t + 1) && pos.getZ(t) === pos.getZ(t + 2) && nz > 1e-9
    for (let k = 0; k < 3; k++) {
      const x = pos.getX(t + k), y = pos.getY(t + k)
      if (flat) uv.setXY(t + k, x, y)
      else uv.setXY(t + k, x + y, pos.getZ(t + k) * 4)
    }
  }
  g.rotateX(Math.PI / 2)
  g.translate(0, BAR_TOP - thick, 0)
  return g
}
const BAR_WOOD = (() => {
  if (!TRAY_WOOD) return null
  const t = TRAY_WOOD.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 1.6, 1 / 1.6)
  t.needsUpdate = true
  return t
})()
function BarTop() {
  const geo = useMemo(() => barTopShape(0), [])
  const ink = useMemo(() => barTopShape(0.01), [])
  return (
    <group rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <mesh geometry={geo} castShadow receiveShadow><meshToonMaterial color="#ffffff" map={BAR_WOOD} /></mesh>
      <mesh geometry={ink}><meshBasicMaterial color="#3b2a20" side={THREE.BackSide} /></mesh>
    </group>
  )
}
/** the cove light's glow down the bar's base: warm at the top, gone by the floor */
const COVE_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 64)
  grad.addColorStop(0, 'rgba(255,200,120,0.6)')
  grad.addColorStop(0.5, 'rgba(255,190,110,0.22)')
  grad.addColorStop(1, 'rgba(255,190,110,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 64)
  return new THREE.CanvasTexture(c)
})()
/** the foot rail along a counter's base (the counter's frame: height, how far out toward the customers, its radius) */
const FOOT_RAIL = { y: 0.186, z: -0.3, r: 0.034 }
/** the foot rail's log, a unit long: a round of timber a little uneven, its trunk a touch fatter at one end, the surface
 * roughened (the same every time) */
const LOG_GEO = (() => {
  const g = new THREE.CylinderGeometry(FOOT_RAIL.r, FOOT_RAIL.r * 1.07, 1, 9, 14, false)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const a = Math.atan2(z, x)
    const bump = 1 + 0.07 * Math.sin(a * 3 + y * 9) + 0.05 * Math.sin(a * 5 - y * 23 + 1.3) + 0.03 * Math.sin(y * 41 + a)
    p.setXYZ(i, x * bump, y, z * bump)
  }
  g.computeVertexNormals()
  return g
})()
const LOG_RING = new THREE.CylinderGeometry(FOOT_RAIL.r * 1.1, FOOT_RAIL.r * 1.1, 0.026, 9)
const LOG_END = new THREE.CircleGeometry(FOOT_RAIL.r * 1.03, 9)
const LOG_KNOT = new THREE.SphereGeometry(0.011, 7, 5)
/** how high the raised lip along the bar's cook's side stands over its top */
const LIP_H = 0.15
/** how far the first counter's lip runs on towards the side counter's, so the two meet at the corner with no gap (the bar's own sizes) */
const LIP_JOIN = 0.29
/** a unit slab with rounded edges (scaled to each top), its grain still running the long way */
const ROUNDED_SLAB = new RoundedBoxGeometry(1, 1, 1, 3, 0.08)
const SAUCE_DISH_GEO = wareGeometry([[0, 0], [0.028, 0], [0.034, 0.004], [0.042, 0.016], [0.045, 0.02], [0.043, 0.021],
  [0.036, 0.012], [0.026, 0.006], [0, 0.006]], 0.045)
/**
 * One counter of the bar: a long plank of pale hinoki with rounded edges on a dark base, a raised lip on the cook's
 * side, and at each seat the chopsticks on their rest and a dish of sauce. With a gate, the base stops short of one end
 * and that end of the top too: the staff's way between the kitchen and the floor, shut by a little swing door (BarGate).
 */
function BarCounter({ c, trim = 0, gate, noTop = false, butt = false }: { c: Counter; trim?: number; gate?: { end: 1 | -1; w: number; leaf: number }
  /** its far end runs into the first counter's side (its lip runs on into the first one's, so they meet with no gap) */
  butt?: boolean
  /** its top drawn with the others' as one piece (BarTop), not its own */
  noTop?: boolean }) {
  const yaw = Math.atan2(-c.along.z, c.along.x)
  const L = c.length
  const G = gate?.w ?? 0
  const end = gate?.end ?? 1
  // (the base, short of the gate)
  const baseL = L + 0.2 - G
  const baseX = -end * G / 2
  // (where the top starts, on the near end: short of a gate there)
  return (
    <group position={c.at} rotation-y={yaw}>
      {!noTop && (
        <>
          <mesh position-y={BAR_TOP - 0.03} scale={[L + 0.3, 0.06, 0.62]} castShadow receiveShadow geometry={ROUNDED_SLAB}>
            <meshToonMaterial color="#ffffff" map={TRAY_WOOD} />
          </mesh>
          <mesh position-y={BAR_TOP - 0.03} scale={[(L + 0.3) * 1.008, 0.06 * 1.25, 0.62 * 1.035]} geometry={ROUNDED_SLAB}>
            <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
          </mesh>
        </>
      )}
      {/* the cove light: a warm strip hidden under the top's front edge, its glow washing down the base toward the floor */}
      <mesh position={[baseX, BAR_TOP - 0.068, -0.27]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[baseL, 0.03]} /><meshBasicMaterial color="#ffcf88" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[baseX, (BAR_TOP - 0.06) * 0.62, -0.1215]} rotation-y={Math.PI}>
        <planeGeometry args={[baseL, (BAR_TOP - 0.06) * 0.76]} />
        <meshBasicMaterial map={COVE_GLOW} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* the foot rail: a log of raw timber along the base's front at the height of a sitting customer's soles, held out from
          the base on wooden brackets, so their feet rest on something */}
      {(() => {
        const x0 = -(L + 0.3) / 2 + (trim ? 0.34 : 0.1) + (gate && end < 0 ? G : 0)
        const x1 = (L + 0.3) / 2 - (butt ? 0.32 : 0.1) - (gate && end > 0 ? G : 0)
        const len = x1 - x0
        const n = Math.max(2, Math.round(len / 0.9) + 1)
        return (
          <group position-x={(x0 + x1) / 2}>
            <mesh geometry={LOG_GEO} position={[0, FOOT_RAIL.y, FOOT_RAIL.z]} rotation-z={Math.PI / 2} scale={[1, len, 1]}>
              <meshToonMaterial color="#7a5434" />
            </mesh>
            <mesh geometry={LOG_GEO} position={[0, FOOT_RAIL.y, FOOT_RAIL.z]} rotation-z={Math.PI / 2} scale={[1.16, len + 0.012, 1.16]}>
              <meshBasicMaterial color="#2a1a10" side={THREE.BackSide} />
            </mesh>
            {/* (the bark's rings and a few knots along it, and the cut ends showing the pale wood) */}
            {Array.from({ length: Math.max(1, Math.round(len / 0.55)) }, (_, k) => (
              <mesh key={`r${k}`} geometry={LOG_RING} position={[-len / 2 + (len * (k + 0.5)) / Math.max(1, Math.round(len / 0.55)), FOOT_RAIL.y, FOOT_RAIL.z]}
                rotation-z={Math.PI / 2} rotation-y={k}><meshToonMaterial color="#4a3220" /></mesh>
            ))}
            {Array.from({ length: Math.max(1, Math.round(len / 0.9)) }, (_, k) => (
              <mesh key={`k${k}`} geometry={LOG_KNOT} position={[-len / 2 + (len * (k + 0.3 + (k % 2) * 0.35)) / Math.max(1, Math.round(len / 0.9)),
                FOOT_RAIL.y + 0.012 + (k % 2) * 0.006, FOOT_RAIL.z - 0.026 - (k % 3) * 0.003]}><meshToonMaterial color="#9a6c44" /></mesh>
            ))}
            {[-1, 1].map((sd) => (
              <mesh key={`e${sd}`} geometry={LOG_END} position={[sd * (len / 2 + 0.002), FOOT_RAIL.y, FOOT_RAIL.z]} rotation-y={sd * Math.PI / 2}>
                <meshToonMaterial color="#d8b078" />
              </mesh>
            ))}
            {Array.from({ length: n }, (_, k) => (
              <mesh key={k} position={[-len / 2 + (len * k) / (n - 1), FOOT_RAIL.y, (FOOT_RAIL.z - 0.12) / 2]}>
                <boxGeometry args={[0.035, 0.035, Math.abs(FOOT_RAIL.z + 0.12)]} />
                <meshToonMaterial color="#4a3220" />
              </mesh>
            ))}
          </group>
        )
      })()}
      {/* the base stands back on the cook's side, so the customers' knees go under the top */}
      <mesh position={[baseX, (BAR_TOP - 0.06) / 2, 0.08]} castShadow>
        <boxGeometry args={[baseL, BAR_TOP - 0.06, 0.4]} />
        <meshToonMaterial color="#3a2a1e" />
      </mesh>
      {/* the raised lip on the cook's side, the step the food is handed over */}
      {/* (stopping short of where the other counter butts on, and of the gate's flap) */}
      {(() => {
        // (where the two counters' lips meet at the corner, each runs a little into the other: no notch between their
        // rounded ends)
        // (the first counter's lip starts where the side counter's now stands, drawn in from the wall by SIDE_PULL)
        let x0 = -(L + 0.3) / 2 + trim - (trim ? 0.02 : 0) + (trim ? SIDE_PULL - LIP_JOIN : 0), x1 = (L + 0.3) / 2 + (butt ? 0.05 : 0)
        if (gate) {
          if (end > 0) x1 -= G
          else x0 += G
        }
        return (
          // (a tall one, a screen of wood between the customers and the kitchen, its top rounded)
          <group position={[(x0 + x1) / 2, BAR_TOP + LIP_H / 2, 0.28]}>
            <mesh geometry={ROUNDED_SLAB} scale={[x1 - x0, LIP_H, 0.06]} castShadow><meshToonMaterial color="#ffffff" map={TRAY_WOOD} /></mesh>
            <mesh geometry={ROUNDED_SLAB} scale={[(x1 - x0) * 1.003, LIP_H * 1.06, 0.07]}><meshBasicMaterial color="#3b2a20" side={THREE.BackSide} /></mesh>
          </group>
        )
      })()}
      {Array.from({ length: c.seats }, (_, n) => {
        const x = (n - (c.seats - 1) / 2) * (L / c.seats) + (c.shift ?? 0)
        return (
          <group key={n} position={[x, BAR_TOP, 0]}>
            {/* (each customer's plate is set down and cleared away by GuestBar3D) beyond it, toward the cook (clear of
                the customer's hands, resting in front of it), chopsticks across on their rest, tips to the left; to the
                left a little dish of sauce */}
            <mesh position={[0.08, 0.012, 0.19]}>
              <boxGeometry args={[0.03, 0.02, 0.04]} />
              <meshToonMaterial color="#8a5a30" />
            </mesh>
            {[-0.012, 0.012].map((dz) => (
              <mesh key={dz} position={[0.0, 0.027, 0.19 + dz * 0.7]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.003, 0.0045, 0.2, 5]} />
                <meshToonMaterial color="#5a3a20" />
              </mesh>
            ))}
            {/* (on the right instead at a seat where the left would be off the top, by the gate) */}
            <group position={[sauceSide(c, gate, x), 0.002, 0.13]}>
              <mesh geometry={SAUCE_DISH_GEO} castShadow>
                <meshToonMaterial color="#ffffff" map={CLOUD_WARE} />
              </mesh>
              <mesh geometry={SAUCE_DISH_GEO} scale={[1.06, 1.15, 1.06]}>
                <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
              </mesh>
              {/* (empty till someone sits down there: GuestBar3D pours them their soy) */}
            </group>
          </group>
        )
      })}
      {/* a box of tissues between each pair of seats, back by the lip clear of their plates */}
      {Array.from({ length: Math.floor(c.seats / 2) }, (_, k) => (
        <group key={k} position={[(2 * k + 1 - c.seats / 2) * (L / c.seats) + (c.shift ?? 0), BAR_TOP, 0.2]}><TissueBox /></group>
      ))}
    </group>
  )
}

/** a box of tissues in a wooden case, one pulled up out of the slot on top */
function TissueBox() {
  return (
    <group>
      <mesh position-y={0.028} castShadow>
        <boxGeometry args={[0.13, 0.056, 0.07]} />
        <meshToonMaterial color="#6a4428" />
      </mesh>
      <mesh position-y={0.028} scale={[1.05, 1.1, 1.08]}>
        <boxGeometry args={[0.13, 0.056, 0.07]} />
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      {/* the slot, and the tissue puffed up out of it */}
      <mesh position-y={0.0565} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.08, 0.016]} />
        <meshBasicMaterial color="#2a1a10" />
      </mesh>
      {[-0.012, 0.01].map((x, i) => (
        <mesh key={x} position={[x, 0.082, 0]} rotation={[0, i ? 0.3 : -0.2, i ? -0.25 : 0.2]} scale={[1, 1, 0.25]}>
          <coneGeometry args={[0.03, 0.056, 6, 1, true]} />
          <meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** A shallow wooden tray (盛り板) where ordered food waits raw, to be carried onto the fire. */
function Tray({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    // a low board with a lip all round
    const shape = new THREE.Shape()
    const w = TRAY_W / 2
    const d = TRAY_D / 2
    const r = 0.06
    shape.moveTo(-w + r, -d)
    shape.lineTo(w - r, -d)
    shape.quadraticCurveTo(w, -d, w, -d + r)
    shape.lineTo(w, d - r)
    shape.quadraticCurveTo(w, d, w - r, d)
    shape.lineTo(-w + r, d)
    shape.quadraticCurveTo(-w, d, -w, d - r)
    shape.lineTo(-w, -d + r)
    shape.quadraticCurveTo(-w, -d, -w + r, -d)
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01,
      bevelSegments: 2 })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  // in front of the fire, its long side running across the screen
  const yaw = Math.atan2(-STACK_DIR.z, STACK_DIR.x)
  return (
    <group position={position} rotation-y={yaw} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={TRAY_WOOD} />
      </mesh>
      <mesh geometry={geometry} scale={[1.02, 1.1, 1.02]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
/** A pinching hand (for taking salt), drawn over the 3D view while salt is carried. */
function PinchHand() {
  return (
    <svg className="pinch-hand" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M22 60c-6-6-10-14-9-22 1-5 3-8 6-9l1-14c0-3 5-3 5 0v12l1-16c0-3 5-3 5 0v15l1-12c0-3 5-3 5 0v13l1-8c0-3 5-3 5 0v14c0 8-3 14-7 19-3 4-4 6-4 8z"
        fill="#f3d2b0" stroke="#3b2a20" strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 29c-4 1-8 4-8 8 0 3 3 4 6 2l5-4" fill="#f3d2b0" stroke="#3b2a20" strokeWidth="2"
        strokeLinejoin="round" />
      <circle cx="24" cy="46" r="1.2" fill="#fff" />
      <circle cx="27" cy="50" r="1" fill="#fff" />
    </svg>
  )
}

/** the little side dishes for onigiri and mochi from the grill net */
const DISH_R = 0.25
const DISH_STEP = 0.6
/** the bamboo basket the foil-roasted potatoes are served in */
const BASKET_R = 0.48
/** the basket's inner floor as y = BOWL_CURVE * r², fitted to its lathe profile */
const BOWL_CURVE = 0.45
const BASKET_STEP = 0.85
/** grains and drops falling from a seasoning while it's held over food */
const GRAINS = 360
const GRAIN_COLORS: Record<Seasoning, THREE.Color> = {
  salt: new THREE.Color('#ffffff'),
  soy: new THREE.Color('#3a1a08'),
  milk: new THREE.Color('#fbf3dc'),
  peanut: new THREE.Color('#c99a5c'),
  miso: new THREE.Color('#a8662a'),
  wasabi: new THREE.Color('#9fc25a'),
  shichimi: new THREE.Color('#c8401f'),
  yuzu: new THREE.Color('#b7c43a'),
  lemon: new THREE.Color('#fff29a'),
  water: new THREE.Color('#bfe2f2'),
}
/** the seasonings that go on food (all but water), in the order they're tasted */
const DABS = ['salt', 'soy', 'milk', 'peanut', 'miso', 'wasabi', 'shichimi', 'yuzu', 'lemon'] as const
/** how much one dab of each seasoning adds (0 → 1 fully coated) */
const DAB = 0.35
/** label over a seasoning when pointed at */
const TOOL_NAMES: Record<Seasoning, string> = { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉', miso: '味噌', wasabi: '山葵',
  shichimi: '七味粉', yuzu: '柚子胡椒', lemon: '檸檬', water: '水' }
/** most skewers over the coals at once */
const FIRE_SKEWERS = 16

// skewer geometry from blender/grilledfish.py: foot radius, tip radius, tip height
const STICK_FOOT_R = 0.74
const STICK_TOP_R = 0.3
const STICK_TOP_Y = 1.15
const LAYER_HEIGHT = 0.1
const CHAR_COLOR = new THREE.Color(0.045, 0.035, 0.03)

/**
 * A woven bamboo (ざる) texture: strips over and under in a twill, pale and honey-coloured — and well used. One
 * picture across the whole basket (not tiled), so the wear can be where it would be: the middle darkened by
 * oil and ash from the potatoes, brown stains and a smudge or two of charcoal, strips bleached and worn toward
 * the rim, a few frayed or split, and the bamboo greyed unevenly with age.
 */
const weaveTexture = (() => {
  if (typeof document === 'undefined') return null
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const n = 26                       // strips across (the old tile was 8 strips, repeated 3.2 times)
  const cell = S / n
  const k = cell / 16
  // gaps between the strips show dark
  g.fillStyle = '#5a3d1c'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const over = (i + j) % 4 < 2
      const x = i * cell
      const y = j * cell
      // each strip piece a touch different in shade: older bamboo greys and darkens unevenly
      const age = rnd()
      const top = over ? [217, 183, 121] : [179, 138, 77]
      const grey = age * 0.18
      const col = top.map((v, q) => Math.round(v * (1 - grey) + [150, 140, 120][q] * grey))
      g.fillStyle = `rgb(${col[0]}, ${col[1]}, ${col[2]})`
      if (over) g.fillRect(x, y + 2 * k, cell, cell - 4 * k)
      else g.fillRect(x + 2 * k, y, cell - 4 * k, cell)
      g.fillStyle = 'rgba(255, 240, 200, 0.3)'
      if (over) g.fillRect(x, y + 5 * k, cell, 2 * k)
      else g.fillRect(x + 5 * k, y, 2 * k, cell)
      g.fillStyle = 'rgba(90, 60, 25, 0.35)'
      if (over) g.fillRect(x, y + 10 * k, cell, k)
      else g.fillRect(x + 10 * k, y, k, cell)
      // now and then a split along the strip, or a frayed end lifting
      if (rnd() < 0.05) {
        g.strokeStyle = 'rgba(60, 38, 16, 0.7)'
        g.lineWidth = 1.2
        g.beginPath()
        if (over) {
          g.moveTo(x + cell * 0.1, y + cell * (0.35 + rnd() * 0.3))
          g.lineTo(x + cell * 0.9, y + cell * (0.35 + rnd() * 0.3))
        } else {
          g.moveTo(x + cell * (0.35 + rnd() * 0.3), y + cell * 0.1)
          g.lineTo(x + cell * (0.35 + rnd() * 0.3), y + cell * 0.9)
        }
        g.stroke()
      }
      if (rnd() < 0.025) {
        g.fillStyle = 'rgba(240, 220, 175, 0.75)'
        for (let q = 0; q < 4; q++) g.fillRect(x + rnd() * cell, y + rnd() * cell, 1.5, 4 + rnd() * 6)
      }
    }
  }
  const blot = (x: number, y: number, r: number, rgba: string, rgba0: string) => {
    const grad = g.createRadialGradient(x, y, r * 0.1, x, y, r)
    grad.addColorStop(0, rgba)
    grad.addColorStop(1, rgba0)
    g.fillStyle = grad
    g.beginPath()
    // a ragged edge: a wobbly ring rather than a circle
    for (let q = 0; q <= 24; q++) {
      const a = (q / 24) * Math.PI * 2
      const rr = r * (0.75 + 0.25 * Math.sin(a * 3 + x) + rnd() * 0.15)
      if (q === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    g.fill()
  }
  // the middle, where hot potatoes have sat for years: oil and ash worked into it
  blot(S / 2, S / 2, S * 0.3, 'rgba(70, 42, 18, 0.38)', 'rgba(70, 42, 18, 0)')
  // stains here and there
  for (let q = 0; q < 9; q++) {
    const a = rnd() * Math.PI * 2
    const d = rnd() * S * 0.32
    blot(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 25 + rnd() * 55, 'rgba(95, 55, 20, 0.3)', 'rgba(95, 55, 20, 0)')
  }
  // a couple of charcoal smudges from sooty foil
  for (let q = 0; q < 3; q++) {
    const a = rnd() * Math.PI * 2
    const d = rnd() * S * 0.22
    blot(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 18 + rnd() * 26, 'rgba(25, 20, 18, 0.35)', 'rgba(25, 20, 18, 0)')
  }
  // toward the rim the bamboo is rubbed paler by hands
  const rim = g.createRadialGradient(S / 2, S / 2, S * 0.33, S / 2, S / 2, S * 0.5)
  rim.addColorStop(0, 'rgba(255, 240, 210, 0)')
  rim.addColorStop(1, 'rgba(255, 240, 210, 0.22)')
  g.fillStyle = rim
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(forPhone(c))
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  // mapped straight down onto the bowl (see Basket), so the strips run in two straight crossing directions
  // right across it, the way a woven zaru is made, instead of pinching into the centre
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
})()

/** A small round side dish (小皿) for onigiri and mochi, of the same set as the plates (plum blossom), inked. */
function SideDish({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    const R = DISH_R
    return wareGeometry([[0, 0], [R * 0.55, 0], [R * 0.62, 0.012], [R * 0.85, 0.03], [R, 0.05], [R * 0.97, 0.056],
      [R * 0.82, 0.038], [R * 0.55, 0.018], [0, 0.018]], R)
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={PLUM_WARE} />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/** Shallow woven bamboo basket with a rolled rim, inked like everything else. */
function Basket({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    const R = BASKET_R
    const profile = [[0, 0.01], [R * 0.55, 0.012], [R * 0.82, 0.04], [R * 0.97, 0.1], [R * 1.02, 0.13], [R * 0.99, 0.145],
      [R * 0.93, 0.12], [R * 0.78, 0.055], [R * 0.5, 0.028], [0, 0.026]].map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(profile, 64)
    // top-down UVs: the weave lies across the bowl in straight lines
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getZ(i) / (2 * R) + 0.5)
    uv.needsUpdate = true
    // shade the inside: the rim throws a soft shadow down into the bowl, deepest low against the wall
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const j = i % profile.length
      const inner = j >= 6
      const r = Math.hypot(pos.getX(i), pos.getZ(i)) / R
      const k = inner ? 0.55 + 0.25 * (1 - r) + 0.25 * THREE.MathUtils.smoothstep(pos.getY(i), 0.03, 0.12) : 1
      col.set([k, k * 0.97, k * 0.92], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={weaveTexture} side={THREE.DoubleSide} vertexColors />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

type Uniform = { value: number }
/** per-piece look: how charred it is, and how much of each seasoning is on it (all 0 → 1) */
type Looks = { uChar: Uniform; uSalt: Uniform; uSoy: Uniform; uMilk: Uniform; uPeanut: Uniform
  /** miso glaze; green dabs (wasabi, yuzu kosho); red flakes (shichimi); a glisten of lemon juice */
  uMiso: Uniform; uGreen: Uniform; uRed: Uniform; uLemon: Uniform }

/**
 * Burn patches for over-roasted food: a value-noise mask over the texture that grows as uChar goes 0 → 1, so the
 * food blackens in spots first and ends up fully charred. Seasonings show on top: salt and peanut powder as
 * specks, soy as a dark lacquer over everything, condensed milk in wavy drizzled ribbons.
 */
/** a fish's eyes neither brown, char nor take the seasoning: they stay a clear white with a dark pupil */
const EYE_LOOKS: Looks = { uChar: { value: 0 }, uSalt: { value: 0 }, uSoy: { value: 0 }, uMilk: { value: 0 },
  uPeanut: { value: 0 }, uMiso: { value: 0 }, uGreen: { value: 0 }, uRed: { value: 0 }, uLemon: { value: 0 } }

function addCharring(mat: THREE.MeshToonMaterial, looks: Looks, bites: Bites) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, looks, bites)
    shader.uniforms.uCharColor = { value: CHAR_COLOR }
    shader.vertexShader = BITE_VERTEX(shader.vertexShader)
    shader.fragmentShader = BITE_FRAGMENT(shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uChar;
        uniform float uSalt;
        uniform float uSoy;
        uniform float uMilk;
        uniform float uPeanut;
        uniform float uMiso;
        uniform float uGreen;
        uniform float uRed;
        uniform float uLemon;
        uniform vec3 uCharColor;
        float charHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float charNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(charHash(i), charHash(i + vec2(1, 0)), f.x),
                     mix(charHash(i + vec2(0, 1)), charHash(i + vec2(1, 1)), f.x), f.y);
        }`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        #ifdef USE_MAP
          float charN = charNoise(vMapUv * 9.0) * 0.65 + charNoise(vMapUv * 23.0) * 0.35;
        #else
          float charN = 0.5;
        #endif
        float charMask = smoothstep(1.0 - uChar * 1.15, 1.0 - uChar * 1.15 + 0.2, charN);
        diffuseColor.rgb = mix(diffuseColor.rgb, uCharColor, charMask);
        // soy brushed on: a dark, rich lacquer over the whole surface
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.3, 0.15) + vec3(0.05, 0.02, 0.0), uSoy * 0.85);
        // miso spread on: a thick golden-brown paste, caught darker where it's bubbled
        #ifdef USE_MAP
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.42, 0.18) * (0.8 + 0.3 * charNoise(vMapUv * 14.0)), uMiso * 0.8);
        #else
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.42, 0.18) * 0.95, uMiso * 0.8);
        #endif
        // lemon squeezed over: a pale, bright sheen
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.08 + vec3(0.05, 0.05, 0.0), uLemon * 0.6);
        #ifdef USE_MAP
          // coarse salt stuck to the surface: scattered white grains, more of them with every pinch
          float saltN = charHash(floor(vMapUv * vec2(150.0, 90.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.98), step(1.0 - uSalt * 0.3, saltN));
          // peanut powder: fine tan dust settled in specks
          float nutN = charHash(floor(vMapUv * vec2(110.0, 70.0)) + 17.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.67, 0.4), step(1.0 - uPeanut * 0.55, nutN));
          // wasabi or yuzu kosho: a few soft green dabs
          float dabN = charNoise(vMapUv * 7.0 + 11.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.76, 0.3), smoothstep(1.0 - uGreen * 0.28, 1.02 - uGreen * 0.28, dabN));
          // shichimi: red and dark flakes
          float redN = charHash(floor(vMapUv * vec2(120.0, 80.0)) + 41.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.22, 0.1), step(1.0 - uRed * 0.35, redN));
          // condensed milk drizzled across in thin wavy ribbons, more of them the more is poured
          float ribbon = abs(fract(vMapUv.x * (4.0 + 4.0 * step(0.5, uMilk)) + sin(vMapUv.y * 9.0) * 0.25) - 0.5);
          float milk = (1.0 - smoothstep(0.04, 0.08, ribbon)) * step(0.3, charNoise(vMapUv * 5.0 + 3.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.99, 0.95, 0.84), milk * min(1.0, uMilk * 2.0));
        #endif`))
  }
  mat.customProgramCacheKey = () => 'charring'
}

/**
 * Bites taken out of food: up to MAX_BITES balls (centre + radius, in the piece's own space) where nothing is
 * drawn, their edges wobbled like tooth marks. Shared by a piece's materials and its ink outlines.
 */
const MAX_BITES = 6
type Bites = { uBites: { value: THREE.Vector4[] }; uBiteCount: { value: number } }
const newBites = (): Bites => ({
  uBites: { value: Array.from({ length: MAX_BITES }, () => new THREE.Vector4()) },
  uBiteCount: { value: 0 },
})
const BITE_VERTEX = (src: string) => 'varying vec3 vBitePos;\n' + src.replace('#include <begin_vertex>',
  '#include <begin_vertex>\n  vBitePos = transformed;')
const BITE_FRAGMENT = (src: string) => /* glsl */ `varying vec3 vBitePos;
  uniform vec4 uBites[${MAX_BITES}];
  uniform int uBiteCount;
` + src.replace(/void main\(\)\s*\{/, /* glsl */ `void main() {
  for (int i = 0; i < ${MAX_BITES}; i++) {
    if (i >= uBiteCount) break;
    vec3 d = vBitePos - uBites[i].xyz;
    float teeth = 0.86 + 0.14 * sin(atan(d.y, d.x) * 9.0 + float(i) * 2.3) * sin(atan(d.z, d.x) * 7.0);
    if (length(d) < uBites[i].w * teeth) discard;
  }`)

/** Let an ink outline (a ShaderMaterial from Dish) show the same bites as its food. */
function biteOutline(outline: THREE.Mesh, bites: Bites) {
  const mat = outline.material as THREE.ShaderMaterial
  if (!mat.vertexShader.includes('vBitePos')) {
    mat.vertexShader = BITE_VERTEX(mat.vertexShader)
    mat.fragmentShader = BITE_FRAGMENT(mat.fragmentShader)
    mat.needsUpdate = true
  }
  mat.uniforms.uBites = bites.uBites
  mat.uniforms.uBiteCount = bites.uBiteCount
}

/** A small repeatable random generator, so a piece always gets the same crumple. */
function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Crush a foil mesh a little differently: its own copy of the geometry, pushed in and out in random folds. */
function crumpleFoil(mesh: THREE.Mesh, rand: () => number) {
  const g = mesh.geometry.clone()
  const pos = g.attributes.position as THREE.BufferAttribute
  const f = Array.from({ length: 3 }, () => [3 + rand() * 6, rand() * 6.3])
  const amp = 0.03 + rand() * 0.06
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const fold = Math.sin(f[0][0] * v.x + f[0][1]) * Math.sin(f[1][0] * v.y + f[1][1]) * Math.sin(f[2][0] * v.z + f[2][1])
    v.multiplyScalar(1 + amp * fold)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  mesh.geometry = g
  for (const c of mesh.children) if (c instanceof THREE.Mesh && c.name.endsWith('_outline')) c.geometry = g
}

type Piece = {
  key: string
  id: string
  copy: number
  loose: boolean
  node: THREE.Object3D
  homeP: THREE.Vector3
  homeQ: THREE.Quaternion
  /** as authored, before any turn to face the camera (how it's laid flat on a plate) */
  homeQ0: THREE.Quaternion
  /** seconds spent over the fire */
  progress: number
  collected: boolean
  /** 0..1 along the flight to the plate */
  flight: number
  /** (served by a server) out at the pass, or on its way: it goes on to the customer's plate when it's set down */
  via?: 'pass'
  /** drawn at the bar's size: it's been out on it (at the pass), so it doesn't grow back on the last hop */
  small?: boolean
  fromP: THREE.Vector3
  fromQ: THREE.Quaternion
  toP: THREE.Vector3
  toQ: THREE.Quaternion
  mats: { mat: THREE.MeshToonMaterial; mesh: THREE.Mesh; base: THREE.Color; emissive: THREE.Color; foil: boolean;
    show?: 'closed' | 'open'; eye?: boolean }[]
  /** in the basket: a simple rigid ball that falls in, rolls and settles against the others */
  body: { v: THREE.Vector3; r: number; live: boolean } | null
  /** how charred and how seasoned it is, shared by all of this piece's materials */
  looks: Looks
  /** the bites taken out of it so far */
  bites: Bites
  /** the bamboo skewer, and the food on it: eating takes the food and leaves the stick on the plate */
  sticks: THREE.Mesh[]
  food: THREE.Mesh[]
  /** meshes with a "Puffed" shape key (mochi swelling on the grill net) */
  puffs: THREE.Mesh[]
  /** eaten down to the bare stick, which stays on the plate until clicked away */
  stickOnly: boolean
  /** grill-net items: which spot on the net it has (null: waiting its turn, hidden and not cooking) */
  netSpot: number | null
  /** once served: the plate, dish or basket it's on (plate-n, dish-n, basket-n), and where on it */
  container: string | null
  local: THREE.Vector3
  /** dabs of each seasoning (and splashes of water) it's had, for its 美味 */
  dabs: Record<Seasoning, number>
  /** each seasoning as it went on, and when (for its timing, and the recipe) */
  steps: Step[]
  /** ordered and waiting raw on the tray (carried or clicked onto the fire from there), and when it arrived */
  staged: boolean
  stagedAt: number
  /** was it on order last frame (a fresh order goes to the tray) */
  wasPresent: boolean
  /** 0 → 1 while moving from the tray onto the fire (1 once it's there) */
  homeFlight: number
  /** foil-roasted potatoes: unwrapped in the basket with a click, and 0 → 1 while the foil comes off */
  unwrapped: boolean
  unwrapT: number
  /** the AI chef has seen to its seasoning */
  chefSeasoned: boolean
  /** being carried by the pointer (a bare stick or something burnt, on its way to the bin) */
  carried: boolean
  /** 0 → 1 while dropping into the bin (−1 otherwise), and where it fell from */
  trash: number
  trashFrom: THREE.Vector3
  /** seconds since it landed on the plate or in the basket (it steams a little at first) */
  landed: number
  /** where it sits once collected: index into its plate run (or its pile); null while on the fire */
  slot: number | null
  /** 0 → 1 while being eaten off the plate; eaten pieces are gone until re-ordered */
  eat: number
  eaten: boolean
  /** (shop open) the customer it was served to, and their seat at the bar; -1 for none */
  guest: number
  seat: number
  /** (shop open) the dish on the menu it was ordered as: what goes on it, and its name */
  want: { dabs: string[]; name: string } | null
}

type TagState = { stage: (typeof ROAST_STAGES)[number]['key']; label: string; pct: number }

const stageOf = (r: number) => ROAST_STAGES.find((s) => r < s.until)!

/** Plate the roasted pieces are served onto: a shallow cream dish with a blue rim line and an ink outline. */
function Plate({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    // profile drawn for a 0.5 radius plate, scaled up to PLATE_R
    const k = PLATE_R / 0.5
    return wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.025], [0.47, 0.06], [0.5, 0.075], [0.49, 0.082], [0.44, 0.052],
      [0.3, 0.02], [0, 0.02]] as [number, number][]).map(([x, y]) => [x * k, y] as [number, number]), PLATE_R)
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={BAMBOO_WARE} />
      </mesh>
      <mesh geometry={geometry} scale={[1.025, 1.06, 1.025]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/** pieces that steam for a moment when they're served (hot fish, potatoes out of the foil) */
const STEAMS = /^(Fish|ExtraFish|Saury|Mackerel|Potato|SweetPotato|NetMochi)$/
const WISP_SECONDS = 4.5

/** A little steam rising off food that's just been served, fading out after a few seconds. */
function Wisp({ at, onDone }: { at: [number, number, number]; onDone: () => void }) {
  const level = useRef(1)
  const t = useRef(0)
  const done = useRef(false)
  useFrame((_, delta) => {
    t.current += delta
    level.current = Math.max(0, 1 - t.current / WISP_SECONDS) ** 1.5
    if (!done.current && t.current > WISP_SECONDS) {
      done.current = true
      onDone()
    }
  })
  return <Steam position={[at[0], at[1] + 0.04, at[2]]} layers={2} width={0.3} height={0.7} opacity={0.6} speed={0.1}
    level={level} />
}

type RoastingProps = {
  url: string
  roast: Roast
  /** ids the menu controls; anything else listed in roast.times is always there (the base fish) */
  itemIds: string[]
  quantities: Record<string, number>
  /** only the dish on stage roasts and shows its tags */
  active: boolean
  instant?: boolean
  /** 0..1 how fierce the charcoal is, read every frame: food roasts faster on a hotter fire */
  fire?: RefObject<number>
  /** told how many pieces are off the fire (on a plate, in a pile or eaten), for the fire's capacity limit */
  onOffFire?: (count: number, loose: number) => void
  /** a piece has been eaten up (for 飽足) */
  onEat?: (id: string, taste: number, how?: { doneness?: number; dabs?: Record<string, number>; steps?: Step[] }) => void
  /** the player's best way with each food, from the tasting notes: the chef may cook to it */
  notes?: Record<string, { doneness?: number; dabs?: Record<string, number> }>
  /** something to tell the diner (it isn't cooked yet, it's burnt) */
  onNotice?: (what: 'notCooked' | 'burnt' | 'waste' | 'fireFull') => void
  /** written every frame: how much smoke is coming off the fire (0..1), from food that's cooked and still on it */
  smoke?: RefObject<number>
  /** likewise for black smoke, from food left on until it burns */
  blackSmoke?: RefObject<number>
  /** AI simulation: a chef who works the grill and customers who order and eat */
  ai?: boolean
  /** the AI customers order from the menu, and the chef adds charcoal, through the app */
  /** order something; false if it couldn't be (the fire or the basket is full) */
  onOrder?: (id: string, guest?: number) => boolean
  onAddCharcoal?: () => void
  /** something the chef or a customer says */
  onSay?: (who: 'chef' | 'guest', text: string) => void
  /** which table is out: the player's tasting (closed) or the shop's (open); each keeps its own food */
  space?: 'closed' | 'open'
  /** draw the bar (with the shop open) the food is served onto; a phone shows its customers in 2D, without it */
  bar?: boolean
  /** who's hired to help the owner (the head chef): a second chef, a sous chef */
  helpers?: { chef: boolean; sous: boolean }
  /** who's on the staff here (each drawn at their place while the shop is open) */
  crew?: CrewMember[]
  /** what's said is in this language, with these names for the food */
  lang?: Lang
  names?: Record<string, string>
  /** a customer walked out: what they'd ordered and not eaten (to be refunded) */
  onWalkOut?: (ids: string[], guest: number) => void
  /** (shop open) what's on the menu, each dish's parts (a food and what goes on it); customers order from this */
  entries?: { key: string; name: string; parts: { id: string; dabs: string[]; name: string }[] }[]
  /** a customer orders this dish off the menu: false if it can't be had (out of stock, the fire's full) */
  onOrderEntry?: (key: string, guest: number) => boolean
  /** how slowly customers come in (no cashier: fewer) */
  crowd?: number
  /** the incense is burning: each customer orders a little more */
  blessed?: boolean
  /** (on a phone, with no 3D room) a waiting customer's had a drink from the fridge */
  onDrink?: (guest: number, drink: DrinkId) => void
  /** the shop is open: the chef works the grill, the player only watches */
  locked?: boolean
  /** who's at the grill in the AI simulation */
  chef?: Chef
  /** every AI customer so far: what they ordered, what they've eaten, how they rated it */
  onGuests?: (guests: GuestView[]) => void
}

/** Roasting speed for a fire level: barely cooking on dying embers, about twice as fast at full blaze. */
const roastRate = (fire: number) => 0.25 + 1.75 * fire

/**
 * Roasting over the fire: each skewer browns as it cooks (raw → half → done → slowly charring), shows a tag above
 * it, glows under the pointer, and a click on the tag or the food lifts it off the fire onto the plate.
 * Rendered as a sibling after <Dish>, so its per-frame transforms land after Dish's pop-in animation, and it picks
 * up the extra portions Dish clones in as they appear.
 */
export function Roasting({ url, roast, itemIds, quantities, active, instant = false, fire, onOffFire, onEat,
  onNotice, smoke, blackSmoke, ai = false, onOrder, onAddCharcoal, onSay, chef = CHEFS[1], onGuests, space = 'closed',
  locked = false, notes = {}, crowd = 1, blessed = false, onDrink, onWalkOut, lang = 'zh', names = {}, helpers = { chef: false, sous: false }, crew = [], bar = true,
  entries, onOrderEntry }: RoastingProps) {
  const L = () => LINES[lang]
  const nameOf = (id: string) => names[id] ?? roast.names[id] ?? id
  const { scene } = useGLTF(url)
  const menuIds = useMemo(() => new Set(itemIds), [itemIds])
  const root = scene.children[0]
  // the fire pit drawn bigger than it was modelled (its stones further out, the coals heaped wider), the skewers
  // still planted where they were, now well inside the ring
  useMemo(() => {
    for (const o of root.children) {
      if (!PIT_PARTS.test(o.name) || o.userData.pitScaled) continue
      o.userData.pitScaled = true
      o.position.x *= PIT_SCALE
      o.position.z *= PIT_SCALE
      o.position.y += PIT_LIFT
      o.scale.multiplyScalar(PIT_SCALE)
      if (o.name === 'FirePit') saltOnly(o as THREE.Mesh)
    }
    // (the net a hand's width higher too)
    const net = root.getObjectByName('GrillNet')
    if (net && !net.userData.lifted) {
      net.userData.lifted = true
      net.position.y += PIT_LIFT
    }
  }, [root])

  // pieces by node, found by scanning the model root; rescanned whenever Dish adds a cloned portion
  const pieces = useRef<Piece[]>([])
  /** (on a phone) who's had their drink from the fridge */
  const drank = useRef(new Set<number>())
  const scannedCount = useRef(-1)
  const scan = () => {
    const known = new Set(pieces.current.map((p) => p.node))
    for (const obj of root.children) {
      const id = (obj.userData.itemId as string | undefined) ?? baseName(obj.name)
      if (!(id in roast.times) || known.has(obj)) continue
      const mats: Piece['mats'] = []
      // (where Dish has it standing at home: the scene's cached, so after a remount it may be anywhere, on a plate)
      const home = obj.userData.home as { p: THREE.Vector3; q: THREE.Quaternion } | undefined
      if (home) {
        obj.position.copy(home.p)
        obj.quaternion.copy(home.q)
      }
      const looks: Looks = { uChar: { value: 0 }, uSalt: { value: 0 }, uSoy: { value: 0 }, uMilk: { value: 0 },
        uPeanut: { value: 0 }, uMiso: { value: 0 }, uGreen: { value: 0 }, uRed: { value: 0 }, uLemon: { value: 0 } }
      pieces.current.push({
        key: obj.uuid, id, copy: (obj.userData.copy as number | undefined) ?? 0, loose: roast.loose.includes(id),
        node: obj, homeP: obj.position.clone(), homeQ: faceCamera(id, obj), homeQ0: obj.quaternion.clone(),
        progress: 0, collected: false,
        flight: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), toP: new THREE.Vector3(),
        toQ: new THREE.Quaternion(), mats, looks, bites: newBites(), sticks: [], food: [], puffs: [], stickOnly: false,
        netSpot: null, container: null, local: new THREE.Vector3(), carried: false, trash: -1,
        dabs: { salt: 0, soy: 0, milk: 0, peanut: 0, miso: 0, wasabi: 0, shichimi: 0, yuzu: 0, lemon: 0, water: 0 }, steps: [], staged: false, stagedAt: 0, wasPresent: false, homeFlight: 1,
        unwrapped: false, unwrapT: 0, chefSeasoned: false,
        trashFrom: new THREE.Vector3(),
        landed: -1,
        body: null, slot: null, eat: 0, eaten: false, guest: -1, seat: -1, want: null,
      })
    }
    scannedCount.current = root.children.length
  }

  /**
   * A skewer whose food is flat (a pair of curled shrimp) turns on its stick to show its broad side to the
   * camera wherever it stands on the ring, the way a cook sets it facing the diners; others keep their turn.
   */
  function faceCamera(id: string, obj: THREE.Object3D) {
    const q = obj.quaternion.clone()
    if (!roast.faceCamera?.includes(id)) return q
    const stick = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    // (the food's broad face: Blender's local Y, which the glTF export turns into local Z)
    const side = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    const toCam = FACE_CAMERA.clone().sub(obj.position)
    toCam.addScaledVector(stick, -toCam.dot(stick)).normalize()
    side.addScaledVector(stick, -side.dot(stick)).normalize()
    const angle = Math.atan2(new THREE.Vector3().crossVectors(side, toCam).dot(stick), side.dot(toCam))
    return q.premultiply(new THREE.Quaternion().setFromAxisAngle(stick, angle))
  }

  /**
   * Each piece browns and chars on its own, so it gets its own copies of its materials. Dish swaps in the toon
   * materials in an effect that can land after our first frame, so keep trying until they're there.
   */
  const bindMaterials = (p: Piece) => {
    if (p.mats.length) return
    const meshes: THREE.Mesh[] = []
    p.node.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.name.endsWith('_outline')) meshes.push(o)
    })
    if (!meshes.length || !meshes.every((m) => m.material instanceof THREE.MeshToonMaterial)) return
    const rand = seeded(p.key)
    // every piece its own shade: a touch lighter or darker, warmer or cooler, than the next
    const shade = { h: (rand() - 0.5) * 0.05, s: (rand() - 0.5) * 0.2, l: (rand() - 0.5) * 0.12 }
    for (const m of meshes) {
      const mat = (m.material as THREE.MeshToonMaterial).clone()
      // Potatoes roast inside foil ("Foil…") with their skin whole ("…Top" is the cap); served, the foil is shown
      // opened out ("Wrapper…") and the cap broken off to show the flesh. Foil doesn't brown or char.
      const foil = mat.name.startsWith('Foil') || mat.name.startsWith('Wrapper')
      const eye = /^Fish(Eye|Pupil)/.test(mat.name)
      const show = mat.name.startsWith('Wrapper') ? 'open' : foil || mat.name.endsWith('Top') ? 'closed' : undefined
      if (!foil) {
        // bites come out of the food only: the bamboo stick is never eaten (it gets bites that stay empty)
        const stick = mat.name.startsWith('BambooSkewer')
        const bites = stick ? newBites() : p.bites
        addCharring(mat, eye ? EYE_LOOKS : p.looks, bites)
        for (const c of m.children) if (c instanceof THREE.Mesh && c.name.endsWith('_outline')) biteOutline(c, bites)
        if (!eye) mat.color.offsetHSL(shade.h, shade.s, shade.l)
      } else {
        // no two sheets of foil crumple alike: give this one its own folds, sheen and grey
        crumpleFoil(m, rand)
        mat.normalScale.multiplyScalar(0.6 + rand() * 1.0)
        mat.color.multiplyScalar(0.9 + rand() * 0.14)
      }
      if (!BASE_MATERIAL.has(m)) BASE_MATERIAL.set(m, m.material)
      m.material = mat
      p.mats.push({ mat, mesh: m, base: mat.color.clone(), emissive: mat.emissive.clone(), foil, show, eye })
      if (mat.name.startsWith('BambooSkewer')) p.sticks.push(m)
      else p.food.push(m)
      if (m.morphTargetInfluences?.length) p.puffs.push(m)
    }
  }

  const present = (p: Piece) => !menuIds.has(p.id) || p.copy < (quantities[p.id] ?? 0)

  /**
   * 美味 (0..100): how good it is to eat right now. Doneness first — raw is poor, done is best (a touch past done
   * is better still), past that it dries out and burnt is bad — then each seasoning by how well it suits the
   * food, and a splash of water makes it soggy.
   */
  const tasteOf = (p: Piece) => {
    const r = p.progress / roast.times[p.id]
    let t = r < 0.5 ? 10 + r * 20
      : r < 1 ? 20 + (r - 0.5) * 70
      : r < 1.3 ? 55 + (r - 1) * 30
      : r < 2.2 ? 64 - (r - 1.3) * 26
      : 12
    for (const k of DABS) {
      const n = p.dabs[k]
      if (!n) continue
      const w = PAIRING[k][p.id] ?? PAIRING_DEFAULT[k]
      // one dab in full, a second a little more, then it's too much
      const amount = n === 1 ? 1 : n === 2 ? 1.4 : 1.4 - (n - 2) * 0.9
      t += w > 0 ? w * amount : w * n
      // and put on at the wrong time (soy early, so it burns; lemon cooked; salt sprinkled at the end) it loses some
      const first = p.steps.find((x) => x.k === k)
      if (first) t -= timingLoss(k, first.at)
    }
    t -= p.dabs.water * 6
    return Math.round(THREE.MathUtils.clamp(t, 0, 100))
  }

  /** how a piece lies on a plate or the tray: loose ones on their bottom, skewers flat with the food face up */
  const flatQ = (p: Piece, out: THREE.Quaternion, dir = LAY_DIR) => {
    if (p.loose) {
      const z = new THREE.Vector3().crossVectors(dir, UP)
      return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, UP, z))
    }
    const phi = Math.atan2(p.homeP.z, p.homeP.x)
    const outward = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi))
    const stick = new THREE.Vector3(-(STICK_FOOT_R - STICK_TOP_R) * Math.cos(phi), STICK_TOP_Y,
      -(STICK_FOOT_R - STICK_TOP_R) * Math.sin(phi)).normalize()
    const face = outward.addScaledVector(stick, -outward.dot(stick)).normalize()
    const from = new THREE.Matrix4().makeBasis(stick, face, new THREE.Vector3().crossVectors(stick, face))
    const to = new THREE.Matrix4().makeBasis(dir, UP, new THREE.Vector3().crossVectors(dir, UP))
    const turn = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()))
    return out.copy(p.homeQ0).premultiply(turn)
  }

  /** the tray where ordered food waits raw: where it is, and the n-th spot on it */
  const trayAt = () => new THREE.Vector3(...(roast.tray ?? [0, 0, 0])).add(nudge('tray'))
  // skewers lie along the tray's long side, in rows from back to front, a second layer across the first when full
  /** loose food (potatoes, rice balls, mochi) waits in a row along the back of the tray, clear of the sticks */
  const trayLooseSpot = (n: number) => trayAt()
    .addScaledVector(STACK_DIR, ((n % 7) - 3) * 0.2)
    .addScaledVector(LAY_DIR, -(TRAY_D / 2 - 0.13))
    .add(new THREE.Vector3(0, 0.07 + Math.floor(n / 7) * 0.12, 0))
  const traySpot = (n: number) => {
    const row = n % TRAY_ROWS
    const layer = Math.floor(n / TRAY_ROWS)
    return trayAt()
      .addScaledVector(LAY_DIR, 0.1 + (row - (TRAY_ROWS - 1) / 2) * (TRAY_D - 0.34) / (TRAY_ROWS - 1))
      .addScaledVector(STACK_DIR, 0.05 + ((layer % 2) - 0.5) * 0.06)
      .add(new THREE.Vector3(0, 0.07 + layer * 0.06, 0))
  }

  /**
   * Plate n of the run. They go around the fire at the first plate's distance: the 2nd to its front-right, the
   * rest round the back (so none sits between the camera and the fire); a full lap moves out a ring.
   */
  // plates, side dishes and the basket can be dragged about the table: how far each has been moved
  const moved = useRef(new Map<string, THREE.Vector3>())
  const [, setMoveTick] = useState(0)
  const nudge = (key: string) => moved.current.get(key) ?? ZERO
  // empty plates and dishes can be stacked, any on any: what each one sits on (its nudge then carries the lift too)
  const stackOn = useRef(new Map<string, string>())
  const STACKABLE = (k: string) => /^(plate|dish)-\d+$|^rawdish$/.test(k)
  const stackRoot = (k: string) => {
    let r = k
    for (let i = 0; i < 20 && stackOn.current.has(r); i++) r = stackOn.current.get(r)!
    return r
  }
  const sameStack = (a: string, b: string) => stackRoot(a) === stackRoot(b)
  /** the one on top of whatever stack this is in */
  const stackTop = (k: string) => {
    let t = k
    for (let i = 0; i < 20; i++) {
      const up = [...stackOn.current].find(([, under]) => under === t)?.[0]
      if (!up) break
      t = up
    }
    return t
  }
  /** how far above its own foot the next one stacked on this container rests */
  const stackStep = (k: string) => (k.startsWith('plate') ? 0.075 : 0.05)
  /** whether anything is lying on (or in) this container */
  const holds = (k: string) => pieces.current.some((q) => q.container === k && present(q) && !q.eaten)

  const plateAt = (n: number) => {
    // (the first plate is the one in the cubby; the rest, as more are needed, go round the fire on the table's top)
    if (n === 0) return onSpares('plate-0', new THREE.Vector3(...roast.plate))
    const [x, y, z] = PLATE_TOP
    const m = n - 1
    const r0 = Math.hypot(x, z)
    const a0 = Math.atan2(z, x)
    const step = 2 * Math.asin(Math.min(1, (PLATE_STEP / 2) / r0))     // angle between neighbouring plates
    const order = [0, 1, -1, -2, -3, -4, -5]                             // in steps, from the first plate
    const lap = Math.floor(m / order.length)
    const a = a0 + order[m % order.length] * step + lap * step / 2
    const r = r0 + lap * PLATE_STEP
    return onSpares(`plate-${n}`, new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  const boxPlaced = useRef(false)
  const [plateCount, setPlateCount] = useState(1)
  const carriedOut = useRef(false)
  /** the kitchen's floor, where a dish let go off the table lands (the scene's y) */
  const FLOOR_Y = GRILL_OFFSET.y - KITCHEN_DROP
  const LIFT = 0.25
  /** whether a place (the scene's x, z) is off the cook's table (past its edges, less the thing's own radius) */
  const outsideTable = (at: THREE.Vector3, r: number) => {
    const a = at.dot(ALONG) + FIRE_SHIFT.dot(ALONG), l = at.dot(LAY) + FIRE_SHIFT.dot(LAY)
    return a < COOK_TABLE.along[0] - 0.05 || a > COOK_TABLE.along[1] + 0.05 || l < COOK_TABLE.lay[0] - 0.05 || l > COOK_TABLE.lay[1] + 0.05 - 0 * r
  }
  /** a container at home, moved by its nudge — lifted onto its stack of spares while it's still standing over it */
  function onSpares(key: string, home: THREE.Vector3) {
    const at = home.clone().add(nudge(key))
    const sp = SPARES[key]
    if (sp && !stackOn.current.has(key) && Math.hypot(at.x - home.x, at.z - home.z) < 0.12) at.y += sp.n * sp.step
    return at
  }
  /** where each stack of spares stands (the container's home), for drawing them and for bumping into */
  const spareHome = (key: string) => {
    if (key === 'plate-0') return onSparesHome(plateAt, 0, 'plate-0')
    if (key === 'dish-0') return roast.dish ? onSparesHome(dishAt, 0, 'dish-0') : null
    return roast.rawDish ? new THREE.Vector3(...roast.rawDish.at) : null
  }
  const onSparesHome = (at: (n: number) => THREE.Vector3, n: number, key: string) => {
    const p = at(n).sub(nudge(key))
    p.y = 0
    return p
  }
  const basketAt = (n: number) => {
    // (the first lives in the left cubby, on its shelf; more, as they're needed, stand on the table's top in a row)
    const [x, y, z] = n === 0 ? roast.basket!.at : BASKET_TOP
    return new THREE.Vector3(x, y, z).addScaledVector(LAY_DIR, -Math.max(0, n - 1) * BASKET_STEP).add(nudge(`basket-${n}`))
  }
  /** where a container (plate-n, dish-n, basket-n, the seasoning box, the bin) is now */
  const containerAt = (key: string): THREE.Vector3 => {
    const [kind, n] = key.split('-')
    if (kind === 'box' || kind === 'bin') return (carriers[kind]?.[0]?.home.clone() ?? new THREE.Vector3()).add(nudge(kind))
    if (kind === 'tray') return trayAt()
    if (kind === 'bar') return BAR_AT_SCENE.clone()
    if (kind === 'lantern') return new THREE.Vector3(DECOR.lantern.at[0], 0, DECOR.lantern.at[1]).add(nudge('lantern'))
    if (kind === 'trash') return new THREE.Vector3(...(roast.trash ?? [0, 0, 0])).add(nudge('trash'))
    if (kind === 'rawdish') return onSpares('rawdish', new THREE.Vector3(...(roast.rawDish?.at ?? [0, 0, 0])))
    return kind === 'plate' ? plateAt(+n) : kind === 'dish' ? dishAt(+n) : basketAt(+n)
  }
  const footprint = (key: string) => {
    const kind = key.split('-')[0]
    return { plate: PLATE_R, dish: DISH_R, basket: BASKET_R, box: BOX_R, bin: BIN_R, tray: 0.6, trash: TRASH_R, rawdish: DISH_R, lantern: DECOR.lantern.r }[kind] ?? 0.3
  }
  /** a container's footprint as circles: one for most, three in a row along the long tray */
  const circlesOf = (key: string, at: THREE.Vector3) => key === 'tray'
    ? [-1, 0, 1].map((k) => ({ p: at.clone().addScaledVector(STACK_DIR, k * (TRAY_W - TRAY_D) / 2), r: TRAY_D / 2 + 0.02 }))
    : [{ p: at.clone(), r: footprint(key) }]
  /** everything standing on the table that can be moved, for bumping into */
  const containerKeys = () => [
    ...Array.from({ length: plateCount }, (_, n) => `plate-${n}`),
    ...(roast.dish ? Array.from({ length: dishCount }, (_, n) => `dish-${n}`) : []),
    ...(roast.basket ? Array.from({ length: basketCount }, (_, n) => `basket-${n}`) : []),
    ...Object.keys(carriers),
    ...(roast.tray ? ['tray'] : []),
    ...(roast.trash ? ['trash'] : []),
    ...(roast.rawDish ? ['rawdish'] : []),
    'lantern',
  ]
  /**
   * Keep a moved container from passing through things: out of the stone ring, and clear of every other
   * plate, dish, basket, the box and the bin (round footprints, pushed apart until they just touch).
   */
  const settle = (key: string, at: THREE.Vector3, stacking = false) => {
    const r = footprint(key)
    // (what it's stacked with doesn't push it away; nor, while an empty one is carried, other empty ones it could go on)
    const others = containerKeys().filter((k) => k !== key && !sameStack(k, key) && !(stacking && STACKABLE(k) && !holds(k)))
      .flatMap((k) => circlesOf(k, containerAt(k)))
    for (const k of Object.keys(SPARES)) {
      const h = k !== key && spareHome(k)
      if (h) others.push({ p: h, r: footprint(k) })
    }
    // the crate and the fan
    for (const d of [DECOR.crate, DECOR.fan, DECOR.rice]) others.push({ p: new THREE.Vector3(d.at[0], 0, d.at[1]), r: d.r })
    // the bar behind the fire (shop open) is in the way too
    if (bar) for (const c of GRILL_COUNTERS) for (let k = -2; k <= 2; k++) others.push({ p: toGrillScene(c.at.clone().addScaledVector(c.along, k * c.length / 4.5)).sub(FIRE_SHIFT), r: 0.42 * GRILL_SCALE })
    // the soup bowls on the table are in the way too
    root.traverse((o) => {
      const id = o.userData.itemId as string | undefined
      if (id && roast.drinks?.includes(id) && o.visible && o.scale.x > 0.01) others.push({ p: o.position.clone(), r: id === 'Sake' ? 0.22 : 0.19 })
    })
    for (let i = 0; i < 8; i++) {
      // (nothing on the table's drawn-in end hangs over the side counter's lip: kept a plank in from it)
      // (the seasoning box, with its pots, reaches further than its round footprint: held a little further in)
      const edge = COOK_TABLE.along[0] - FIRE_SHIFT.dot(ALONG) + r + 0.16 + (key === 'box' ? 0.1 : 0)
      const here = at.dot(ALONG)
      if (here < edge) at.addScaledVector(ALONG, edge - here)
      // (nor hanging over the table's right-hand end, its back or its front)
      const farEnd = COOK_TABLE.along[1] - FIRE_SHIFT.dot(ALONG) - r - 0.16
      if (here > farEnd) at.addScaledVector(ALONG, farEnd - here)
      const across = at.dot(LAY)
      const acrossMax = COOK_TABLE.lay[1] - FIRE_SHIFT.dot(LAY) - r - 0.16, acrossMin = COOK_TABLE.lay[0] - FIRE_SHIFT.dot(LAY) + r + 0.16
      if (across > acrossMax) at.addScaledVector(LAY, acrossMax - across)
      else if (across < acrossMin) at.addScaledVector(LAY, acrossMin - across)
      const d = Math.hypot(at.x, at.z) || 1e-6
      if (d < RING_CLEAR + r) {
        at.x *= (RING_CLEAR + r) / d
        at.z *= (RING_CLEAR + r) / d
      }
      // (the tray is long: each of its circles is pushed clear, carrying the whole tray)
      for (const own of circlesOf(key, at)) {
        for (const o of others) {
          const dx = own.p.x - o.p.x
          const dz = own.p.z - o.p.z
          const dd = Math.hypot(dx, dz) || 1e-6
          const min = own.r + o.r + 0.02
          if (dd < min) {
            at.x += (dx / dd) * (min - dd)
            at.z += (dz / dd) * (min - dd)
            own.p.x += (dx / dd) * (min - dd)
            own.p.z += (dz / dd) * (min - dd)
          }
        }
      }
    }
    // (and last of all, never off the table's top, whatever pushed it: the edges are hard)
    {
      const edge = COOK_TABLE.along[0] - FIRE_SHIFT.dot(ALONG) + 0.16
      const a1 = at.dot(ALONG), l1 = at.dot(LAY)
      const aMax = COOK_TABLE.along[1] - FIRE_SHIFT.dot(ALONG) - 0.16
      const lMin = COOK_TABLE.lay[0] - FIRE_SHIFT.dot(LAY) + 0.16, lMax = COOK_TABLE.lay[1] - FIRE_SHIFT.dot(LAY) - 0.16
      if (a1 < edge + r * 0.5) at.addScaledVector(ALONG, edge + r * 0.5 - a1)
      if (a1 > aMax - r * 0.5) at.addScaledVector(ALONG, aMax - r * 0.5 - a1)
      if (l1 < lMin + r * 0.5) at.addScaledVector(LAY, lMin + r * 0.5 - l1)
      if (l1 > lMax - r * 0.5) at.addScaledVector(LAY, lMax - r * 0.5 - l1)
    }
    return at
  }
  const [basketCount, setBasketCount] = useState(1)
  const [wisps, setWisps] = useState<{ key: string; at: [number, number, number] }[]>([])
  // (with the shop open nothing goes in the basket or on the side dishes: it's all served at the bar, unwrapped)
  const inBasket = (p: Piece) => space !== 'open' && !!roast.basket && !!roast.basketItems?.includes(p.id)
  // onigiri and mochi off the grill net go on little side dishes of their own
  const onDish = (p: Piece) => space !== 'open' && !!roast.dish && !!roast.net?.includes(p.id)
  const dishAt = (n: number) => {
    // (the first is in the cubby, on its shelf; the rest, as more are needed, in a row on the table's top)
    const [x, y, z] = n === 0 ? roast.dish!.at : DISH_TOP
    return onSpares(`dish-${n}`, new THREE.Vector3(x, y, z).addScaledVector(STACK_DIR, -Math.max(0, n - 1) * DISH_STEP))
  }
  const [dishCount, setDishCount] = useState(1)
  // nothing on the table overlaps: every plate, dish, basket, box, bucket, bin and tray is pushed clear of the
  // fire and of each other where it stands — at the start, and whenever another plate or basket is put out
  useLayoutEffect(() => {
    // (the seasoning box starts beside the cook, in the table's corner by where they stand, not out against the counter's edge)
    if (carriers.bin && !moved.current.has('bin')) {
      // (the water bucket stands where the lantern was, along the back)
      const h = carriers.bin[0].home
      moved.current.set('bin', new THREE.Vector3(1.35 - h.x, 0, -1.45 - h.z))
    }
    if (carriers.box && !boxPlaced.current && !moved.current.has('box')) {
      boxPlaced.current = true
      const want = new THREE.Vector3().addScaledVector(ALONG, BOX_SPOT.along).addScaledVector(LAY, BOX_SPOT.lay)
      moved.current.set('box', new THREE.Vector3(want.x - carriers.box[0].home.x, 0, want.z - carriers.box[0].home.z))
    }
    for (let pass = 0; pass < 3; pass++) {
      for (const key of containerKeys()) {
        // (a stack stays where it was put; what's kept in the cubby under the table stays there till it's taken out)
        if (stackOn.current.has(key) || CUBBY_KEYS.has(key) || key === 'bin' || key === 'tray' || outsideTable(containerAt(key), footprint(key))) continue
        const at = containerAt(key)
        const ok = settle(key, at.clone())
        const shift = ok.sub(at)
        shift.y = 0
        if (shift.lengthSq() > 1e-6) moved.current.set(key, nudge(key).clone().add(shift))
      }
    }
    // (and what settle moved is moved on the table: the box with its pots and utensils, the bucket with its dipper)
    for (const [key, nodes] of Object.entries(carriers)) {
      const next = nudge(key)
      for (const b of nodes) b.node.position.copy(b.home).add(next)
      for (const t of tools) {
        if (carrierOf(t.node.name) !== key) continue
        t.home.copy(t.home0).add(next)
        if (t.back >= 1) t.node.position.copy(t.home)
      }
    }
    setMoveTick((t) => t + 1)
    // (settle and friends read the current counts and nudges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateCount, dishCount, basketCount, root, space])
  // (with the shop open, everything cooked is served to the customers along the bar behind the fire)
  // (only what a customer ordered: cooked for no one, it stays with the cook, on a plate of their own, not sent off to some seat)
  const ownerOf = (p: Piece) => guests.current.find((g) => (g.state === 'waiting' || g.state === 'eating') &&
    g.orders.filter((o) => o === p.id).length > pieces.current.filter((q) => q !== p && q.guest === g.id && q.id === p.id).length)
  const destination = (p: Piece) => (space === 'open' && (p.container === 'bar' || (!p.collected && ownerOf(p))) ? 'bar' : inBasket(p) ? 'basket' : onDish(p) ? 'dish' : 'plate')

  /** take this container out of its stack (or what's on it off it), set down clear of the rest */
  const unstack = (key: string) => {
    for (const k of [stackTop(key), key]) {
      if (!stackOn.current.has(k)) continue
      stackOn.current.delete(k)
      const n = nudge(k).clone()
      n.y = 0
      moved.current.set(k, n)
      const base = containerAt(k).sub(n)
      const ok = settle(k, containerAt(k)).sub(base)
      ok.y = 0
      moved.current.set(k, ok)
    }
    setMoveTick((t) => t + 1)
  }
  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    const basket = inBasket(p)
    const dish = onDish(p)
    // take the first free spot where it's going (basket, dishes or plates); eaten food frees its spot
    const taken = new Set(pieces.current.filter((q) => q.slot !== null && !q.eaten && present(q) &&
      destination(q) === destination(p)).map((q) => q.slot))
    let slot = 0
    while (taken.has(slot)) slot++
    p.slot = slot
    p.collected = true
    p.netSpot = null           // its place on the grill net goes to the next one waiting
    // tells Dish to stop driving this node's position (its pop-in would pull it back up to skewer height)
    p.node.userData.onPlate = true
    p.flight = instant ? 1 : 0
    p.fromP.copy(p.node.position)
    p.fromQ.copy(p.node.quaternion)
    const owner = space === 'open' ? ownerOf(p) : undefined
    if (space === 'open' && owner) {
      // served at the bar, onto the plate of the customer who ordered it (one still owed one of these); pieces
      // already on that plate push the new one along
      const seat = owner.seat
      p.guest = owner.id
      p.seat = seat
      const row = pieces.current.filter((q) => q !== p && q.collected && q.container === 'bar' && q.seat === seat && present(q) && !q.eaten).length
      p.toP.copy(barSeat(seat)).addScaledVector(GRILL_SEATS[seat].along, ((row % 3) - 1) * 0.07 * GRILL_SCALE).add(new THREE.Vector3(0, BAR_TOP_SCENE + 0.04 + Math.floor(row / 3) * 0.06, 0))
      // (with a server on the floor it's put out at the pass instead, to be carried over with a plate)
      if (SERVICE.servers && bar) {
        const n = pieces.current.filter((q) => q !== p && q.via === 'pass' && !q.eaten).length
        p.via = 'pass'
        p.toP.copy(PASS_SCENE).addScaledVector(ALONG, ((n % 4) - 1.5) * 0.08 * GRILL_SCALE).addScaledVector(LAY, -Math.floor(n / 4) * 0.09 * GRILL_SCALE)
      }
      p.container = 'bar'
      p.body = null
      if (p.loose) flatQ(p, p.toQ, LAY_DIR)
      else flatQ(p, p.toQ, STACK_DIR)
      p.local.copy(p.toP).sub(containerAt('bar'))
      return
    }
    if (basket) {
      // tossed in from just above the basket; from there the physics drops it in and lets it settle
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.1
      p.toP.copy(basketAt(0)).add(new THREE.Vector3(Math.cos(a) * r, 0.42, Math.sin(a) * r))
      p.body = null
      // lying on its side, broken-open top up, turned any which way
      const yaw = Math.random() * Math.PI * 2
      const along = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
      p.toQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, UP, new THREE.Vector3().crossVectors(along, UP)))
    } else if (dish) {
      // a side dish holds a few in a ring; a full one gets another set down beside it
      const cap = roast.dish!.capacity
      const n = Math.floor(slot / cap)
      const a = ((slot % cap) / cap) * Math.PI * 2 + 0.4
      const r = cap > 1 ? DISH_R * 0.48 : 0
      p.toP.copy(dishAt(n)).add(new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r))
      if (n + 1 > dishCount) setDishCount(n + 1)
      p.container = `dish-${n}`
      // lying flat, just as it sat on the net, turned any which way
      p.toQ.copy(p.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2))
    } else {
      // side by side across the plate, centred; a full row starts a new layer on top; a full plate, a new plate
      const plate = Math.floor(slot / PER_PLATE)
      const within = slot % PER_PLATE
      const col = within % PER_LAYER
      const layer = Math.floor(within / PER_LAYER)
      const across = (col - (PER_LAYER - 1) / 2) * SLOT_GAP + (layer % 2) * (SLOT_GAP / 2)
      p.toP.copy(plateAt(plate)).addScaledVector(STACK_DIR, across)
      if (plate + 1 > plateCount) setPlateCount(plate + 1)
      p.container = `plate-${plate}`
      // skewers are longer than the plate is wide, so the stick rests across the rim (top ≈ 0.08) instead of
      // cutting through it
      p.toP.y += (p.loose ? 0.075 : 0.105) + layer * LAYER_HEIGHT
    }
    if (basket) p.container = 'basket-0'
    // (onto a plate that's under another, or one stacked up: it's set down on its own first)
    if (p.container && STACKABLE(p.container) && (stackOn.current.has(p.container) || stackTop(p.container) !== p.container)) {
      const offset = p.toP.clone().sub(containerAt(p.container))
      unstack(p.container)
      p.toP.copy(containerAt(p.container)).add(offset)
    }
    // where it sits relative to its plate, dish or basket, so it goes along when that's dragged somewhere else
    p.local.copy(p.toP).sub(containerAt(p.container!))
    // everything points the same way along LAY_DIR
    // A skewer's local axes depend on how its parts were joined in Blender, so flatQ works from the stick itself
    // (it runs from its foot on the outer ring up and in to its tip, the food's broad side facing out) and turns
    // it to lie along LAY_DIR, broad side up; loose pieces just lie on their bottom
    if (!basket && !dish) flatQ(p, p.toQ)
  }

  /**
   * Eat a piece that's sitting on the plate (or in the basket): a few chewing bites and the food is gone. A skewer
   * leaves its bare stick behind; clicking that clears it away.
   */
  /** carry a piece from the tray onto the fire (skewers only while there's room among the coals) */
  const putOnFire = (p: Piece) => {
    if (!p.staged) return false
    const skewer = !p.loose
    const onFire = pieces.current.filter((q) => present(q) && !q.loose && !q.collected && !q.staged && !q.eaten).length
    if (skewer && onFire >= FIRE_SKEWERS) {
      onNotice?.('fireFull')
      p.node.userData.onPlate = true
      return false
    }
    p.staged = false
    p.homeFlight = instant ? 1 : 0
    p.fromP.copy(p.node.position)
    p.fromQ.copy(p.node.quaternion)
    p.node.userData.onPlate = true
    // it lights up as it goes on, so you see it took
    flashUntil.current.set(p.key, performance.now() + 900)
    return true
  }

  const eat = (p: Piece) => {
    if (!p.collected || p.flight < 1 || p.eaten || !present(p) || p.via) return
    // potatoes in the basket are unwrapped first, with a click of their own
    if (inBasket(p) && !p.unwrapped) {
      p.unwrapped = true
      return
    }
    if (p.stickOnly) {
      p.eaten = true
      p.slot = null
      return
    }
    if (p.eat > 0) return
    // only food that's properly done: not raw or half-cooked, and not burnt
    const stage = stageOf(p.progress / roast.times[p.id]).key
    if (stage === 'raw' || stage === 'half') {
      onNotice?.('notCooked')
      return
    }
    if (stage === 'burnt') {
      onNotice?.('burnt')
      return
    }
    p.eat = 0.0001
  }

  /**
   * Take the next bite out of a piece: working in from the far end of the food along its longest side, each bite
   * a ball a bit wider than the food is thick, off-centre to alternate sides, so what's left looks gnawed.
   * Once bitten into, its inside faces are drawn too, so the bite shows the inside instead of a hollow.
   */
  const takeBite = (p: Piece) => {
    const k = p.bites.uBiteCount.value
    if (k >= MAX_BITES) return
    const box = new THREE.Box3()
    for (const { mesh: m, foil } of p.mats) {
      if (foil || p.sticks.includes(m)) continue
      m.geometry.computeBoundingBox()
      box.union(m.geometry.boundingBox!)
    }
    const size = box.getSize(new THREE.Vector3())
    const mid = box.getCenter(new THREE.Vector3())
    const axes = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a))
    const [long, wide] = axes
    const len = size.getComponent(long)
    const c = mid.clone()
    c.setComponent(long, box.max.getComponent(long) - len * (0.05 + k * 0.95 / BITES_PER_PIECE))
    c.setComponent(wide, mid.getComponent(wide) + (k % 2 ? 1 : -1) * size.getComponent(wide) * 0.22)
    const r = Math.max(len / BITES_PER_PIECE * 0.85, size.getComponent(wide) * 0.62)
    p.bites.uBites.value[k].set(c.x, c.y, c.z, r)
    p.bites.uBiteCount.value = k + 1
    if (k === 0) {
      for (const { mat, foil } of p.mats) if (!foil) {
        mat.side = THREE.DoubleSide
        mat.needsUpdate = true
      }
    }
  }

  // pointer: hovering food on the fire or the plate makes it glow and turns the cursor into a hand; a click (not
  // a drag that orbits the camera) takes it off the fire, or eats it once it's on the plate
  const { gl, camera, raycaster, scene: world } = useThree()
  const shift = useRef<{ key: string; start: THREE.Vector3; from: THREE.Vector3 } | null>(null)
  /** soup bowls: sips left, and how full it looks (eased toward what's left) */
  const sips = useRef(new Map<string, { left: number; level: number }>())
  /** a stick of charcoal or the fan in hand (see Decor), and the heat the fanning has added */
  const held = useRef<Held>(null)
  const fanned = useRef({ extra: 0, last: 0 })
  const [decorTip, setDecorTip] = useState<'charcoal' | 'fan' | null>(null)
  // how many things have gone in the bin (it starts empty), and the fire glowing as raw food is carried over it
  const trashedRef = useRef(0)
  const flashUntil = useRef(new Map<string, number>())
  const [trashed, setTrashed] = useState(0)
  const [fireHint, setFireHint] = useState(0)
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  // ---- two tables: the player's tasting (shop closed) and the shop's own (open). Switching puts one table's
  // food away exactly as it was and brings the other's back, each piece where it was and as cooked as it was.
  type Snap = { pieces: Map<string, Record<string, unknown>>; counts: [number, number, number];
    moved: Map<string, THREE.Vector3>; sips: Map<string, { left: number; level: number }>; trashed: number
    stacks: Map<string, string> }
  const snaps = useRef(new Map<string, Snap>())
  const lastSpace = useRef(space)
  const SCALARS = ['progress', 'collected', 'flight', 'stickOnly', 'netSpot', 'container', 'staged', 'stagedAt', 'wasPresent',
    'homeFlight', 'unwrapped', 'unwrapT', 'chefSeasoned', 'trash', 'landed', 'slot', 'eat', 'eaten', 'guest', 'seat'] as const
  const VECS = ['fromP', 'fromQ', 'toP', 'toQ', 'local', 'trashFrom'] as const
  const save = (): Snap => {
    const out = new Map<string, Record<string, unknown>>()
    for (const p of pieces.current) {
      const r: Record<string, unknown> = {}
      for (const k of SCALARS) r[k] = p[k]
      for (const k of VECS) r[k] = p[k].clone()
      r.body = p.body ? { v: p.body.v.clone(), r: p.body.r, live: p.body.live } : null
      r.dabs = { ...p.dabs }
      r.steps = [...p.steps]
      r.looks = Object.fromEntries(Object.entries(p.looks).map(([k, u]) => [k, u.value]))
      r.want = p.want
      r.bites = { n: p.bites.uBiteCount.value, v: p.bites.uBites.value.map((b) => b.clone()) }
      r.pos = p.node.position.clone()
      r.quat = p.node.quaternion.clone()
      r.ud = { onPlate: p.node.userData.onPlate, shrink: p.node.userData.shrink, byGuest: p.node.userData.byGuest }
      r.food = p.food.map((m) => m.visible)
      r.puffs = p.puffs.map((m) => [...(m.morphTargetInfluences ?? [])])
      out.set(p.key, r)
    }
    return { pieces: out, counts: [plateCount, dishCount, basketCount], moved: new Map([...moved.current].map(([k, v]) => [k, v.clone()])),
      sips: new Map([...sips.current].map(([k, v]) => [k, { ...v }])), trashed: trashedRef.current,
      stacks: new Map(stackOn.current) }
  }
  const fresh = (p: Piece) => {
    p.wasPresent = false
    p.staged = false
    p.homeFlight = 1
    p.unwrapped = false
    p.unwrapT = 0
    p.chefSeasoned = false
    for (const k of Object.keys(p.dabs) as Seasoning[]) p.dabs[k] = 0
    p.steps = []
    p.progress = 0
    p.netSpot = null
    p.container = null
    p.carried = false
    p.trash = -1
    p.body = null
    for (const u of Object.values(p.looks)) u.value = 0
    p.stickOnly = false
    for (const m of p.food) m.visible = true
    p.bites.uBiteCount.value = 0
    p.landed = -1
    p.collected = false
    p.flight = 0
    p.slot = null
    p.eat = 0
    p.eaten = false
    p.guest = -1
    p.seat = -1
    p.want = null
    p.node.userData.onPlate = false
    p.node.userData.shrink = 1
    p.node.userData.byGuest = false
    p.node.userData.follow = undefined
    p.node.quaternion.copy(p.homeQ)
    p.node.position.copy(p.homeP)
  }
  const load = (snap: Snap | undefined) => {
    for (const p of pieces.current) {
      const r = snap?.pieces.get(p.key)
      if (!r) {
        fresh(p)
      } else {
        const w = p as unknown as Record<string, unknown>
        for (const k of SCALARS) w[k] = r[k]
        for (const k of VECS) (p[k] as THREE.Vector3 & THREE.Quaternion).copy(r[k] as THREE.Vector3 & THREE.Quaternion)
        const b = r.body as { v: THREE.Vector3; r: number; live: boolean } | null
        p.body = b ? { v: b.v.clone(), r: b.r, live: b.live } : null
        Object.assign(p.dabs, r.dabs)
        p.steps = [...((r.steps as Step[] | undefined) ?? [])]
        p.want = (r.want as Piece['want']) ?? null
        for (const [k, v] of Object.entries(r.looks as Record<string, number>)) (p.looks as Record<string, { value: number }>)[k].value = v
        const bites = r.bites as { n: number; v: THREE.Vector4[] }
        p.bites.uBiteCount.value = bites.n
        bites.v.forEach((v, i) => p.bites.uBites.value[i].copy(v))
        p.node.position.copy(r.pos as THREE.Vector3)
        p.node.quaternion.copy(r.quat as THREE.Quaternion)
        Object.assign(p.node.userData, r.ud)
        ;(r.food as boolean[]).forEach((v, i) => { if (p.food[i]) p.food[i].visible = v })
        ;(r.puffs as number[][]).forEach((v, i) => { const m = p.puffs[i]?.morphTargetInfluences; if (m) v.forEach((x, j) => (m[j] = x)) })
        p.carried = false
      }
      // a bitten piece shows its inside
      for (const { mat, foil } of p.mats) {
        const side = !foil && p.bites.uBiteCount.value ? THREE.DoubleSide : THREE.FrontSide
        if (mat.side !== side) {
          mat.side = side
          mat.needsUpdate = true
        }
      }
    }
    setPlateCount(snap?.counts[0] ?? 1)
    setDishCount(snap?.counts[1] ?? 1)
    setBasketCount(snap?.counts[2] ?? 1)
    moved.current = new Map(snap?.moved ?? [])
    stackOn.current = new Map(snap?.stacks ?? [])
    sips.current = new Map(snap?.sips ?? [])
    trashedRef.current = snap?.trashed ?? 0
    setTrashed(trashedRef.current)
    setMoveTick((t) => t + 1)
  }
  useLayoutEffect(() => {
    if (lastSpace.current === space) return
    snaps.current.set(lastSpace.current, save())
    load(snaps.current.get(space))
    lastSpace.current = space
    // (shut: the customers are gone, and what they'd ordered with them)
    if (space === 'closed') {
      guests.current = []
      wants.current = []
      onGuests?.([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space])
  const scrap = useRef<{ p: Piece; x: number; y: number; started: boolean } | null>(null)
  const stageSeq = useRef(0)
  const aiClock = useRef(0)
  const guestClock = useRef(0)
  const guestTime = useRef(0)
  const chefClock = useRef(0)
  const guests = useRef<Guest[]>([])
  /** what's been ordered off the menu and not yet brought out: each food, as which dish */
  const wants = useRef<{ id: string; dabs: string[]; name: string }[]>([])
  const nameOfP = (p: Piece) => p.want?.name ?? nameOf(p.id)
  const guestSeq = useRef(0)
  const report = () => onGuests?.(guests.current.map((g) => ({ id: g.id, state: g.state, items: g.orders.length, ate: [...g.ate],
    rating: g.eaten.length ? g.eaten.reduce((a, b) => a + b, 0) / g.eaten.length : null, seat: g.seat, partner: g.partner })))
  const chefSaid = useRef(0)

  /** the best seasoning for a food by the PAIRING table (null if nothing suits it) */
  const bestSeasoning = (id: string) => {
    let best: Exclude<Seasoning, 'water'> | null = null
    let score = 5
    for (const k of DABS) {
      const w = PAIRING[k][id] ?? PAIRING_DEFAULT[k]
      if (w > score) {
        score = w
        best = k
      }
    }
    return best
  }

  /**
   * The AI chef, a step at a time: keeps the fire up, puts what's waiting on the tray onto the fire, seasons each
   * piece as it comes good (once, with what suits it best), takes it off when it's done, unwraps the potatoes,
   * and clears burnt food and bare sticks into the bucket.
   */
  const runChef = () => {
    const say = (text: string) => {
      if (performance.now() - chefSaid.current > 2500) {
        chefSaid.current = performance.now()
        onSay?.('chef', text)
      }
    }
    // the owner is the head chef and works the grill by hand; a hired chef cooks alongside (takes things off when
    // done, seasons them), the sous chef does the rest (keeps the fire up, puts what's waiting on, clears away)
    const { chef: hasChef, sous: hasSous } = helpers
    if (!hasChef && !hasSous) return
    if (fire && fire.current < 0.35) {
      onAddCharcoal?.()
      say(L().addCharcoal)
      return
    }
    const live = pieces.current.filter((p) => present(p) && !p.eaten && p.trash < 0 && !p.carried)
    const stageOfP = (p: Piece) => stageOf(p.progress / roast.times[p.id]).key
    const scrapIt = live.find((p) => p.stickOnly || (!p.collected && !p.staged && stageOfP(p) === 'burnt'))
    if (scrapIt && roast.trash && (hasSous || !hasChef)) {
      scrapIt.trashFrom.copy(scrapIt.node.position)
      scrapIt.trash = 0
      scrapIt.node.userData.onPlate = true
      say(scrapIt.stickOnly ? L().stickAway : L().burntAway)
      return
    }
    // the chef cooks to the notes when they choose to (a better hand follows them more often), else by eye
    const follows = (p: Piece) => {
      const n = notes[p.id]
      if (!n) return null
      if (p.node.userData.follow === undefined) p.node.userData.follow = Math.random() < chef.seasonChance * 0.85
      return p.node.userData.follow ? n : null
    }
    const pullOf = (p: Piece) => {
      const n = follows(p)
      return n?.doneness !== undefined ? Math.min(1.45, Math.max(0.95, n.doneness)) : chef.pullAt
    }
    const ready = hasChef ? live.find((p) => !p.collected && !p.staged && p.homeFlight >= 1 &&
      p.progress / roast.times[p.id] >= pullOf(p)) : undefined
    // what the chef means to put on a piece: what it was ordered with, else what the notes say worked best, else
    // what suits it (a less practised hand now and then forgets: decided once per piece)
    const planOf = (p: Piece): Exclude<Seasoning, 'water'>[] => {
      if (p.want) return p.want.dabs as Exclude<Seasoning, 'water'>[]
      if (p.node.userData.seasonOk === undefined) p.node.userData.seasonOk = Math.random() < chef.seasonChance
      if (!p.node.userData.seasonOk) return []
      const noted = follows(p)?.dabs
      const k = noted ? (Object.entries(noted).filter(([x, n]) => n > 0 && x !== 'water').sort((m, n) => n[1] - m[1])[0]?.[0] as
        Exclude<Seasoning, 'water'> | undefined) ?? null : bestSeasoning(p.id)
      return k ? [k] : []
    }
    // each seasoning at its own time, as a cook does: salt as it goes on, glazes just before it's done, wasabi,
    // shichimi, yuzu kosho and lemon once it's off
    const dueOnFire = (k: string, r: number) => {
      const at = bestStage(k)
      return at === 'before' || at === 'early' ? r < 0.6 : at === 'late' ? r >= 0.85 : false
    }
    const dab = (p: Piece, k: Exclude<Seasoning, 'water'>) => {
      season(p, k)
      emit(k, p.node.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 30)
      say(L().seasoned(nameOfP(p), k))
    }
    if (ready) {
      collect(ready)
      say(L().done(nameOfP(ready)))
      for (const k of planOf(ready)) if (!ready.dabs[k] && bestStage(k) === 'after') dab(ready, k)
      return
    }
    const toSeason = hasChef && live.find((p) => !p.collected && !p.staged && p.homeFlight >= 1 &&
      planOf(p).some((k) => !p.dabs[k] && dueOnFire(k, p.progress / roast.times[p.id])))
    if (toSeason) {
      const r = toSeason.progress / roast.times[toSeason.id]
      for (const k of planOf(toSeason)) if (!toSeason.dabs[k] && dueOnFire(k, r)) dab(toSeason, k)
      return
    }
    const wrapped = live.find((p) => p.collected && inBasket(p) && !p.unwrapped && p.flight >= 1)
    if (wrapped) {
      wrapped.unwrapped = true
      return
    }
    // (the sous chef puts things on; with no sous chef, the second chef does it too)
    const next = hasSous || hasChef ? live.filter((p) => p.staged).sort((a, b) => a.stagedAt - b.stagedAt)[0] : undefined
    if (next && putOnFire(next)) say(L().onFire(nameOfP(next)))
  }

  /**
   * AI customers, each one followed from the door to the bill: now and then one comes in (while there's a seat),
   * orders one to three things off the menu, eats only what they ordered as it comes off the grill (one piece at
   * a time), and when they've had it all leaves with their rating, the average of how good each was. Kept
   * waiting too long with nothing to eat, they walk out.
   */
  const runGuests = () => {
    // (patience is counted on the shop's own clock: it stops while the shop's closed or not on screen)
    guestTime.current += 0.8
    const now = guestTime.current
    guestClock.current += 0.8
    const seated = guests.current.filter((g) => g.state === 'waiting' || g.state === 'eating')
    // (no room drawn, on a phone: nobody walks to the fridge, but they still help themselves to a drink, once each)
    if (!bar && onDrink) for (const g of seated) {
      if (g.state !== 'waiting' || drank.current.has(g.id) || Math.random() > 0.8 / 70) continue
      drank.current.add(g.id)
      onDrink(g.id, drinkFor(kindOf(g.id).kind, g.id))
    }
    if (onOrder && !SHOP.closing && seated.length < MAX_SEATED && guestClock.current > (7 + Math.random() * 6) * crowd) {
      guestClock.current = 0
      // (someone still getting up counts as there: the stool's not free till they've gone and their plate's cleared)
      const used = new Set(guests.current.filter((g) => g.state === 'waiting' || g.state === 'eating' || !g.cleared).map((g) => g.seat))
      // (nor one the room still has somebody at: getting up and going, or away at the toilet)
      for (const n of SEATS_TAKEN) used.add(n)
      const free = (n: number) => n < BAR_SEATS && !used.has(n)
      // now and then a couple comes in together, if two stools side by side on one counter are free: a young man and
      // a young woman (the next ids that are), sat next to each other
      const pairAt = Math.random() < 0.2
        ? Array.from({ length: BAR_SEATS - 1 }, (_, n) => n).find((n) => free(n) && free(n + 1) && GRILL_SEATS[n].counter === GRILL_SEATS[n + 1].counter)
        : undefined
      let ids = [guestSeq.current + 1]
      if (pairAt !== undefined) {
        let i = guestSeq.current + 1
        while (!(COUPLE_HIM.has(kindOf(i).kind) && COUPLE_HER.has(kindOf(i + 1).kind)) && i < guestSeq.current + 400) i++
        if (i < guestSeq.current + 400) ids = [i, i + 1]
      }
      const couple = ids.length === 2
      for (const [k, id] of ids.entries()) {
        // (a stool for them, before they order: with every one taken, or someone still at it, they don't come in)
        const seatFor = couple ? pairAt! + k : Array.from({ length: BAR_SEATS }, (_, n) => n).find((n) => !used.has(n))
        if (seatFor === undefined || used.has(seatFor)) continue
        const want = 1 + Math.floor(Math.random() * 3) + (blessed && Math.random() < 0.6 ? 1 : 0)
        const orders: string[] = []
        const said: string[] = []
        for (let j = 0; j < (entries ? Math.min(want, blessed ? 3 : 2) : want); j++) {
          if (entries) {
            // a dish (or a set) off the menu, made the way it's listed
            const e = entries[Math.floor(Math.random() * entries.length)]
            if (!e || !e.parts.every((pt) => pt.id in roast.times)) continue
            wants.current.push(...e.parts)
            if (onOrderEntry?.(e.key, id)) {
              orders.push(...e.parts.map((pt) => pt.id))
              said.push(e.name)
            } else {
              wants.current.splice(wants.current.length - e.parts.length, e.parts.length)
            }
            continue
          }
          const pick = itemIds.filter((x) => x in roast.times)[Math.floor(Math.random() * itemIds.filter((x) => x in roast.times).length)]
          if (pick && onOrder(pick, id)) {
            orders.push(pick)
            said.push(nameOf(pick))
          }
        }
        guestSeq.current = Math.max(guestSeq.current, id)
        if (orders.length) {
          const seat = seatFor
          used.add(seat)
          guests.current.push({ id, orders, ate: [], eaten: [], since: now, state: 'waiting', seat, partner: couple ? ids[1 - k] : undefined })
          onSay?.('guest', L().order(id, said))
        } else {
          onSay?.('guest', L().nothing(id))
        }
      }
      // (a couple only if both of them stayed: one who found nothing to order went, and the other sits alone)
      if (couple) {
        const both = ids.every((x) => guests.current.some((g) => g.id === x))
        if (!both) for (const g of guests.current) if (ids.includes(g.id)) g.partner = undefined
      }
      // (only those still here and the last few gone are kept: the list doesn't grow all day)
      guests.current = guests.current.filter((g, i, all) => g.state === 'waiting' || g.state === 'eating' || !g.cleared ||
        i >= all.length - 12)
      report()
    }
    // someone kept waiting too long goes
    for (const g of seated) {
      if (g.eaten.length === 0 && now - g.since > PATIENCE) {
        g.state = 'angry'
        const owed = [...g.orders]
        for (const a of g.ate) owed.splice(owed.indexOf(a), 1)
        onWalkOut?.(owed, g.id)
        onSay?.('guest', L().angry(g.id))
        report()
      }
    }
    // someone who's finished (or walked out): once the last piece is eaten they get up and their plate is taken away
    // (GuestBar3D: it's told when they're done, after that last piece, and clears the plate a moment later), and
    // the bare sticks on it go with it
    for (const g of guests.current) {
      if (g.state === 'waiting' || g.state === 'eating' || g.cleared) continue
      if (pieces.current.some((p) => p.guest === g.id && p.eat > 0 && !p.stickOnly && !p.eaten)) continue
      g.leftAt ??= now
      if (now - g.leftAt < 1.6) continue
      g.cleared = true
      for (const p of pieces.current) {
        if (p.guest !== g.id || p.container !== 'bar') continue
        p.eaten = true
        p.slot = null
      }
    }
    if (pieces.current.some((p) => p.eat > 0 && !p.eaten && !p.stickOnly)) return
    // a guest eats a piece of what they ordered, if it's ready
    for (const g of guests.current) {
      if (g.state !== 'waiting' && g.state !== 'eating') continue
      const owed = [...g.orders]
      for (const id of g.ate) owed.splice(owed.indexOf(id), 1)
      const dish = pieces.current.find((p) => present(p) && p.collected && p.flight >= 1 && !p.eaten && !p.stickOnly &&
        p.trash < 0 && owed.includes(p.id) && (p.guest === g.id || p.guest < 0) && stageOf(p.progress / roast.times[p.id]).key === 'done')
      if (!dish) continue
      if (inBasket(dish) && !dish.unwrapped) {
        dish.unwrapped = true
        return
      }
      // (not made the way it's on the menu: not what they ordered)
      const asOrdered = !dish.want || dish.want.dabs.slice().sort().join() ===
        Object.entries(dish.dabs).filter(([k, n]) => n > 0 && k !== 'water').map(([k]) => k).sort().join()
      const taste = Math.max(0, tasteOf(dish) - (asOrdered ? 0 : 15))
      dish.node.userData.byGuest = true
      eat(dish)
      g.eaten.push(taste)
      g.ate.push(dish.id)
      g.state = g.eaten.length >= g.orders.length ? 'done' : 'eating'
      const stars = taste >= 80 ? 5 : taste >= 65 ? 4 : taste >= 45 ? 3 : taste >= 25 ? 2 : 1
      window.setTimeout(() => {
        onSay?.('guest', L().verdict(g.id, nameOfP(dish), stars))
        report()
      }, EAT_SECONDS * 1000)
      return
    }
  }
  const [saltInHand, setSaltInHand] = useState(false)
  const hand = useRef<THREE.Group>(null)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  // seasonings beside the fire (salt, soy and brush, condensed milk, peanut powder): pick one up, carry it over a
  // piece of food and let go to season that piece
  const tools = useMemo(() => Object.entries(roast.tools ?? {}).flatMap(([name, kind]) => {
    const node = root.getObjectByName(name)
    return node ? [{ node, kind, home: node.position.clone(), home0: node.position.clone(),
      homeQ: node.quaternion.clone(), back: 1 }] : []
  }), [root, roast.tools])
  // the seasoning box and what stands in it (but not the utensils, which have their own homes), for dragging
  // the seasoning box and the water bucket: each moves as one with whatever stands in it (the utensils have their
  // own homes, which move along)
  const carriers = useMemo(() => {
    const group = (names: string[] | undefined) => (names ?? []).flatMap((name) => {
      const node = root.getObjectByName(name)
      if (!node || Object.prototype.hasOwnProperty.call(roast.tools ?? {}, name)) return []
      return [{ node, home: node.position.clone() }]
    })
    const out: Record<string, { node: THREE.Object3D; home: THREE.Vector3 }[]> = {}
    const box = group(roast.toolBox)
    const bucket = group(roast.bucket)
    if (box.length) out.box = box
    if (bucket.length) out.bin = bucket
    return out
  }, [root, roast.toolBox, roast.bucket, roast.tools])
  useLayoutEffect(() => {
    // (the seasoning box turned right round, about its own middle: its pots and spoons swung with it)
    const bx = root.getObjectByName('SeasoningBox')
    if (bx && !bx.userData.turned) {
      bx.userData.turned = true
      const n = nudge('box')
      const c = (carriers.box?.[0]?.home ?? bx.position).clone()
      const flip = (v: THREE.Vector3) => new THREE.Vector3(2 * c.x - v.x, v.y, 2 * c.z - v.z)
      for (const k of carriers.box ?? []) {
        k.home.copy(flip(k.home))
        k.node.position.copy(k.home).add(n)
        k.node.rotation.y += Math.PI
      }
      for (const t of tools) if (carrierOf(t.node.name) === 'box') {
        t.home0.copy(flip(t.home0))
        t.home.copy(t.home0).add(n)
        if (t.back >= 1) t.node.position.copy(t.home)
      }
    }
  }, [root, carriers, tools])
  useLayoutEffect(() => {
    // (the water bucket and its dipper, drawn bigger: scaled about the bucket's own place)
    const b = root.getObjectByName('WaterBucket'), d = root.getObjectByName('WaterDipper')
    if (b && !b.userData.scaled) {
      b.userData.scaled = true
      const c = b.position.clone()
      for (const n of [b, d]) if (n) {
        n.scale.multiplyScalar(BUCKET_SCALE)
        n.position.sub(c).multiplyScalar(BUCKET_SCALE).add(c)
      }
      const nd = nudge('bin')
      for (const t of tools) if (t.node === d) { t.home.copy(d!.position); t.home0.copy(d!.position).sub(nd) }
    }
  }, [root, carriers, tools])
  useEffect(() => {
    // grabbing the box or the bucket itself (not a pot or a utensil) drags the whole thing
    for (const [key, nodes] of Object.entries(carriers)) if (nodes[0]) nodes[0].node.userData.container = key
  }, [carriers])
  /** which group a utensil belongs to (it moves when that group is dragged) */
  const carrierOf = (name: string) =>
    (roast.toolBox ?? []).includes(name) ? 'box' : (roast.bucket ?? []).includes(name) ? 'bin' : null
  type Tool = (typeof tools)[number]
  // the pots they stand in: pointing at or grabbing a pot means its utensil
  const pots = useMemo(() => Object.entries(roast.toolPots ?? {}).flatMap(([potName, toolName]) => {
    const pot = root.getObjectByName(potName)
    const tool = tools.find((t) => t.node.name === toolName)
    return pot && tool ? [{ pot, tool }] : []
  }), [root, roast.toolPots, tools])
  const drag = useRef<{ tool: Tool; target: Piece | null; at: THREE.Vector3; pour: number } | null>(null)
  const hoveredTool = useRef<Tool | null>(null)
  const [toolLabel, setToolLabel] = useState<{ kind: Seasoning; at: [number, number, number] } | null>(null)

  // the grains and drops that fall while a seasoning is held over food
  const grains = useMemo(() => {
    const pos = new Float32Array(GRAINS * 3)
    for (let i = 0; i < GRAINS; i++) pos[i * 3 + 1] = -1e4
    const col = new Float32Array(GRAINS * 3)
    const vel = new Float32Array(GRAINS * 3)
    const life = new Float32Array(GRAINS)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { pos, col, vel, life, geometry, next: 0 }
  }, [])
  const grainMaterial = useMemo(() => new THREE.PointsMaterial({ size: 0.024, sizeAttenuation: true, vertexColors: true }), [])
  const emit = (kind: Seasoning, from: THREE.Vector3, count: number) => {
    const { pos, col, vel, life } = grains
    const c = GRAIN_COLORS[kind]
    for (let n = 0; n < count; n++) {
      const i = grains.next
      grains.next = (grains.next + 1) % GRAINS
      pos.set([from.x + (Math.random() - 0.5) * 0.06, from.y, from.z + (Math.random() - 0.5) * 0.06], i * 3)
      col.set([c.r, c.g, c.b], i * 3)
      // powders scatter, sauces fall in drops
      const spread = kind === 'salt' || kind === 'peanut' ? 0.25 : 0.05
      vel.set([(Math.random() - 0.5) * spread, -0.2 - Math.random() * 0.3, (Math.random() - 0.5) * spread], i * 3)
      life[i] = 0.9
    }
  }
  /** a seasoning lands on a piece: its look changes (more of it with every dab) */
  const season = (p: Piece, kind: Seasoning) => {
    const before = tasteOf(p)
    p.dabs[kind]++
    if (kind === 'water') {
      // a splash of water cools it (it stops short of charring for a while) — and leaves it soggy
      p.progress = Math.max(0, p.progress - roast.times[p.id] * 0.15)
    } else {
      const u = { salt: p.looks.uSalt, soy: p.looks.uSoy, milk: p.looks.uMilk, peanut: p.looks.uPeanut, miso: p.looks.uMiso,
        wasabi: p.looks.uGreen, yuzu: p.looks.uGreen, shichimi: p.looks.uRed, lemon: p.looks.uLemon }[kind]
      u.value = Math.min(1, u.value + DAB)
      // (when it went on: before the fire, while cooking, just before it's done, or once it's off)
      p.steps.push({ k: kind, at: seasonStage(p.collected ? null : p.progress / roast.times[p.id]) })
    }
    const delta = tasteOf(p) - before
    pop(p.node.position.clone().add(new THREE.Vector3(0, 0.3, 0)), delta)
  }

  // little floating words: how a seasoning changed a piece's 美味
  const [pops, setPops] = useState<{ id: number; at: [number, number, number]; text: string; good: boolean }[]>([])
  const popId = useRef(0)
  const pop = (at: THREE.Vector3, delta: number) => {
    if (!delta) return
    const id = ++popId.current
    const text = delta > 0 ? `美味 +${delta}` : `美味 ${delta}`
    setPops((all) => [...all, { id, at: at.toArray() as [number, number, number], text, good: delta > 0 }])
    window.setTimeout(() => setPops((all) => all.filter((x) => x.id !== id)), 1500)
  }
  // the 美味 of whatever's pointed at
  const [tasteTip, setTasteTip] = useState<{ at: [number, number, number]; taste: number } | null>(null)

  const hovered = useRef<Piece | null>(null)
  // the hovered food's tag brightens too (tags sit at low opacity until pointed at)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const setHover = (p: Piece | null) => {
    hovered.current = p
    setHoveredKey(p?.key ?? null)
  }
  useEffect(() => {
    const el = gl.domElement
    if (!active) {
      hovered.current = null
      el.style.cursor = ''
      return
    }
    const pointer = { x: 0, y: 0 }
    const aim = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      raycaster.setFromCamera(new THREE.Vector2((pointer.x / rect.width) * 2 - 1, -(pointer.y / rect.height) * 2 + 1),
        camera)
    }
    /** a bare stick left on the plate is thin and hard to hit, so anywhere near it counts */
    const nearStick = () => {
      const rect = el.getBoundingClientRect()
      const v = new THREE.Vector3()
      let best: Piece | null = null
      let bestD = 30
      for (const p of pieces.current) {
        if (!p.stickOnly || p.eaten || !present(p)) continue
        for (const s of p.sticks) {
          s.getWorldPosition(v).project(camera)
          const d = Math.hypot((v.x + 1) / 2 * rect.width - pointer.x, (1 - v.y) / 2 * rect.height - pointer.y)
          if (d < bestD) {
            bestD = d
            best = p
          }
        }
      }
      return best
    }
    /** the food under the pointer: on the fire, or on the plate / in the basket once it's landed */
    const pickFood = (seasoning = false) => {
      const candidates = pieces.current.filter((p) => present(p) && !p.eaten &&
        !(roast.net?.includes(p.id) && !p.collected && p.netSpot === null) &&
        (!p.collected || (p.flight >= 1 && (p.eat === 0 || p.stickOnly))) && !(seasoning && p.stickOnly))
      const hits = raycaster.intersectObjects(candidates.map((p) => p.node), true)
      if (!hits.length) return seasoning ? null : nearStick()
      let o: THREE.Object3D | null = hits[0].object
      while (o && !candidates.some((p) => p.node === o)) o = o.parent
      return candidates.find((p) => p.node === o) ?? null
    }
    const pickTool = () => {
      const hits = raycaster.intersectObjects([...tools.map((t) => t.node), ...pots.map((p) => p.pot)], true)
      if (!hits.length) return null
      let o: THREE.Object3D | null = hits[0].object
      while (o && !tools.some((t) => t.node === o) && !pots.some((p) => p.pot === o)) o = o.parent
      return tools.find((t) => t.node === o) ?? pots.find((p) => p.pot === o)?.tool ?? null
    }
    // where a carried seasoning is held: on a level plane a little above the food, under the pointer
    const holdPlane = new THREE.Plane()
    const carry = (e: PointerEvent) => {
      const d = drag.current!
      aim(e)
      const y = root.localToWorld(new THREE.Vector3(0, 0.95, 0)).y
      holdPlane.set(UP, -y)
      const hit = raycaster.ray.intersectPlane(holdPlane, new THREE.Vector3())
      if (hit) d.at.copy(root.worldToLocal(hit))
      const target = pickFood(true)
      d.target = target
      if (target !== hovered.current) setHover(target)
    }

    /** soup on the table (miso soup): the bowl under the pointer, if it still has any in it */
    const pickDrink = () => {
      const bowls: THREE.Object3D[] = []
      root.traverse((o) => {
        const id = o.userData.itemId as string | undefined
        if (id && roast.drinks?.includes(id) && o.visible && o.scale.x > 0.01) bowls.push(o)
      })
      for (const hit of raycaster.intersectObjects(bowls, true)) {
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (bowls.includes(o) && (sips.current.get(o.uuid)?.left ?? SIPS) > 0) return o
        }
      }
      return null
    }

    let down: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (drag.current || held.current) return
      if (e.buttons) return
      aim(e)
      const tool = pickTool()
      const p = tool ? null : pickFood()
      if (tool !== hoveredTool.current) {
        hoveredTool.current = tool
        setToolLabel(tool ? { kind: tool.kind, at: [tool.home.x, tool.home.y + 0.32, tool.home.z] } : null)
      }
      if (p !== hovered.current) {
        setHover(p)
        // pointing at a piece shows how good it'd be to eat right now
        setTasteTip(p ? { at: p.node.position.clone().add(new THREE.Vector3(0, 0.42, 0)).toArray() as [number, number, number],
          taste: tasteOf(p) } : null)
      }
      const soup = tool || p ? null : pickDrink()
      if (!soup && !p && !hovered.current) setTasteTip(null)
      if (soup && !p) setTasteTip({ at: soup.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.32, 0)).toArray() as [number, number, number], taste: SOUP_TASTE })
      const dec = tool || p || soup ? null : pickDecor()
      setDecorTip(dec)
      // (what's under the pointer, other than the food (which shows its own taste tip), lights up)
      const cont = tool || p || soup || dec ? null : pickContainer()
      let lit: THREE.Object3D | null = null
      if (tool) lit = tool.node
      else if (soup) lit = soup
      else if (dec) world.traverse((o) => { if (!lit && o.userData.decor === dec) lit = o })
      else if (cont) world.traverse((o) => { if (!lit && o.userData.container === cont) lit = o })
      glowOnly(lit)
      el.style.cursor = tool || dec ? 'grab' : p || soup ? 'pointer' : pickContainer() ? 'grab' : pickCoal() ? 'pointer' : POINTER_HINT.hand ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      glowOnly(null)
      if (e.button !== 0 || lockedRef.current) return
      aim(e)
      const tool = pickTool()
      if (!tool) {
        // any skewer or piece of food can be picked up and carried to the bin (a plain click still eats or
        // complains as usual: carrying only starts once the pointer moves)
        const food = pickFood()
        if (food) {
          // the camera holds still from the press on (otherwise the first few pixels, before the carry starts,
          // turn the view a little and it keeps drifting after)
          if (controls) controls.enabled = false
          scrap.current = { p: food, x: e.clientX, y: e.clientY, started: false }
          window.addEventListener('pointermove', haul)
          window.addEventListener('pointerup', dropScrap, { once: true })
          return
        }
        // a stick of binchotan from the crate, or the fan
        const dec = pickDecor()
        if (dec) {
          held.current = { kind: dec, at: new THREE.Vector3(), wave: -1 }
          setDecorTip(null)
          if (controls) controls.enabled = false
          document.body.classList.add('is-carrying')
          el.style.cursor = 'grabbing'
          holdDecor(e)
          window.addEventListener('pointermove', holdDecor)
          window.addEventListener('pointerup', dropDecor, { once: true })
          return
        }
        // otherwise grab a plate, side dish, the basket, the seasoning box or the bin (not the food on them)
        const picked = food ? null : pickContainer()
        if (!picked) {
          // (a click on the coals themselves puts more charcoal on)
          if (pickCoal()) {
            onAddCharcoal?.()
          }
          return
        }
        // (from a stack, the one on top comes off)
        const key = STACKABLE(picked) ? stackTop(picked) : picked
        if (stackOn.current.has(key)) {
          stackOn.current.delete(key)
          const n = nudge(key).clone()
          n.y = 0
          moved.current.set(key, n)
        }
        const start = groundHit()
        if (!start) return
        shift.current = { key, start, from: nudge(key).clone() }
        lightContainer(key)
        if (controls) controls.enabled = false
        document.body.classList.add('is-carrying')
        window.addEventListener('pointermove', slide)
        window.addEventListener('pointerup', release, { once: true })
        return
      }
      // pick it up: the camera holds still while it's carried, and the pointer is followed over the whole window
      // (it passes over the food tags, which sit above the canvas)
      drag.current = { tool, target: null, at: tool.node.position.clone(), pour: 0 }
      if (tool.kind === 'salt') setSaltInHand(true)
      if (controls) controls.enabled = false
      el.style.cursor = 'grabbing'
      document.body.classList.add('is-carrying')
      setToolLabel(null)
      carry(e)
      window.addEventListener('pointermove', carry)
      window.addEventListener('pointerup', drop, { once: true })
    }
    const drop = () => {
      const d = drag.current
      window.removeEventListener('pointermove', carry)
      document.body.classList.remove('is-carrying')
      if (!d) return
      // let go over food: season it; either way the seasoning goes back to its place
      if (d.target) {
        season(d.target, d.tool.kind)
        emit(d.tool.kind, d.at.clone().add(new THREE.Vector3(0, -0.1, 0)), 40)
      } else if (d.tool.kind === 'water' && Math.hypot(d.at.x, d.at.z) < RING_CLEAR * 0.7) {
        // water thrown on the coals: they hiss and steam, and the fire drops right down
        emit('water', d.at.clone().add(new THREE.Vector3(0, -0.1, 0)), 60)
        if (fire) fire.current = Math.max(0, fire.current - 0.3)
        setWisps((all) => [...all.filter((w) => w.key !== 'douse'), { key: 'douse', at: [0, 0.15, 0] }])
      }
      d.tool.back = 0
      drag.current = null
      setSaltInHand(false)
      if (controls) controls.enabled = true
      el.style.cursor = ''
      setHover(null)
    }
    /** the crate of charcoal or the fan under the pointer */
    const pickDecor = () => {
      const groups: THREE.Object3D[] = []
      world.traverse((o) => { if (typeof o.userData.decor === 'string') groups.push(o) })
      const hit = raycaster.intersectObjects(groups, true)[0]
      for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
        if (typeof o.userData.decor === 'string') return o.userData.decor as 'charcoal' | 'fan'
      }
      return null
    }
    // carried a little above the fire; the fan, waved over a lit fire, fans the coals up
    const holdDecor = (e: PointerEvent) => {
      const h = held.current
      if (!h) return
      aim(e)
      const y = root.localToWorld(new THREE.Vector3(0, h.kind === 'fan' ? 0.62 : 0.5, 0)).y
      holdPlane.set(UP, -y)
      const hit = raycaster.ray.intersectPlane(holdPlane, new THREE.Vector3())
      if (!hit) return
      const at = root.worldToLocal(hit)
      if (h.wave < 0) {
        h.at.copy(at)
        h.wave = 0
        return
      }
      const moved = at.distanceTo(h.at)
      h.at.copy(at)
      if (h.kind !== 'fan') return
      h.wave += moved
      if (fire && fire.current > 0.02 && Math.hypot(at.x, at.z) < RING_CLEAR + 0.1) {
        const gain = Math.min(moved * FAN_GAIN, FAN_MAX - fanned.current.extra, FIRE_FANNED_MAX - fire.current)
        if (gain > 0) {
          fire.current += gain
          fanned.current.extra += gain
        }
        fanned.current.last = performance.now()
      }
    }
    const dropDecor = () => {
      const h = held.current
      window.removeEventListener('pointermove', holdDecor)
      document.body.classList.remove('is-carrying')
      // the charcoal let go over the fire goes on it
      if (h?.kind === 'charcoal' && Math.hypot(h.at.x, h.at.z) < RING_CLEAR) onAddCharcoal?.()
      held.current = null
      if (controls) controls.enabled = true
      el.style.cursor = ''
    }
    /** the plate / dish / basket under the pointer, by the container key its group carries */
    /** the charcoal (and the logs) in the fire, under the pointer, with nothing nearer in the way */
    const pickCoal = () => {
      const hit = raycaster.intersectObject(root, true)[0]
      if (!hit || !(hit.object instanceof THREE.Mesh)) return false
      const mats = ([] as THREE.Material[]).concat(hit.object.material)
      return mats.some((m) => /^(Ember|Binchotan|Bark)/.test(m.name))
    }
    const pickContainer = () => {
      const groups: THREE.Object3D[] = []
      world.traverse((o) => { if (typeof o.userData.container === 'string') groups.push(o) })
      for (const hit of raycaster.intersectObjects(groups, true)) {
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (typeof o.userData.container === 'string') return o.userData.container as string
        }
      }
      return null
    }
    /** where the pointer meets the table, in the dish's own coordinates */
    const groundHit = () => {
      const plane = new THREE.Plane(UP, -root.localToWorld(new THREE.Vector3()).y)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      return hit ? root.worldToLocal(hit) : null
    }
    /** while a plate, the basket, the box or the bucket is being dragged, it (and whatever it carries) glows */
    const lit: { mat: THREE.MeshToonMaterial; was: THREE.Color }[] = []
    const lightContainer = (key: string | null) => {
      for (const { mat, was } of lit) mat.emissive.copy(was)
      lit.length = 0
      if (!key) return
      const roots: THREE.Object3D[] = []
      world.traverse((o) => { if (o.userData.container === key) roots.push(o) })
      for (const b of carriers[key] ?? []) roots.push(b.node)
      const seen = new Set<THREE.Material>()
      for (const r of roots) r.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!(mat instanceof THREE.MeshToonMaterial) || seen.has(mat)) continue
          seen.add(mat)
          lit.push({ mat, was: mat.emissive.clone() })
          mat.emissive.add(HOVER_GLOW)
        }
      })
    }
    const slide = (e: PointerEvent) => {
      const s = shift.current
      if (!s) return
      aim(e)
      const hit = groundHit()
      if (!hit) return
      const before = nudge(s.key).clone()
      // where it would go, kept clear of the fire and of everything else on the table
      const base = containerAt(s.key).sub(before)
      const want = base.clone().add(s.from).add(hit.sub(s.start))
      want.y = base.y
      // (a plate or dish carried past the table's edge goes where it's taken, off the table; let go there, it falls to the floor below)
      const out = outsideTable(want, footprint(s.key))
      const next = out ? want.clone().sub(base) : settle(s.key, want, STACKABLE(s.key) && !holds(s.key)).sub(base)
      next.y = 0
      carriedOut.current = out
      if (carriedOut.current) next.y = LIFT - base.y
      // (taken out of the cubby, it comes up onto the table's top)
      if (!carriedOut.current && CUBBY_KEYS.has(s.key)) next.y = (s.key === 'plate-0' ? PLATE_TOP[1] : s.key === 'trash' || s.key === 'basket-0' ? 0 : DISH_TOP[1]) - base.y
      moved.current.set(s.key, next)
      if (carriers[s.key]) {
        // the box carries its pots and utensils with it, the bucket its dipper
        for (const b of carriers[s.key]) b.node.position.copy(b.home).add(next)
        for (const t of tools) {
          if (carrierOf(t.node.name) !== s.key) continue
          t.home.copy(t.home0).add(next)
          if (t.back >= 1 && drag.current?.tool !== t) t.node.position.copy(t.home)
        }
      }
      // potatoes rolling about in the basket go along with it
      const delta = next.clone().sub(before)
      for (const p of pieces.current) if (p.body?.live && p.container === s.key) p.node.position.add(delta)
      setMoveTick((t) => t + 1)
    }
    const release = () => {
      const s = shift.current
      if (s && carriedOut.current) {
        // (let go off the table: it falls under gravity to the floor, a small bounce, and lies there)
        const key = s.key
        const n0 = nudge(key).clone()
        const baseY = containerAt(key).y - n0.y
        let y = n0.y, vy = 0, last = performance.now()
        const fall = () => {
          const now = performance.now()
          const d = Math.min(0.05, (now - last) / 1000)
          last = now
          vy -= 9.8 * d
          y += vy * d
          const floorN = FLOOR_Y - baseY + 0.0
          if (y <= floorN) {
            y = floorN
            if (vy < -1) vy = -vy * 0.2
            else vy = 0
          }
          const cur = nudge(key).clone()
          cur.y = y
          moved.current.set(key, cur)
          // (the box carries its pots and utensils down with it, the bucket its dipper)
          for (const b of carriers[key] ?? []) b.node.position.copy(b.home).add(cur)
          for (const t of tools) {
            if (carrierOf(t.node.name) !== key) continue
            t.home.copy(t.home0).add(cur)
            if (t.back >= 1) t.node.position.copy(t.home)
          }
          setMoveTick((t) => t + 1)
          if (vy !== 0 || y > floorN) requestAnimationFrame(fall)
        }
        requestAnimationFrame(fall)
      } else if (s && STACKABLE(s.key)) {
        const at = containerAt(s.key)
        // the nearest other empty one it's been let go over (the top of its stack), if any
        const target = containerKeys()
          .filter((k) => k !== s.key && STACKABLE(k) && !holds(k) && stackTop(k) === k && !sameStack(k, s.key))
          .map((k) => ({ k, d: Math.hypot(containerAt(k).x - at.x, containerAt(k).z - at.z) }))
          .filter((o) => o.d < footprint(o.k) * 0.75)
          .sort((a, b) => a.d - b.d)[0]
        const base = at.clone().sub(nudge(s.key))
        if (!holds(s.key) && target) {
          // set square on top of it
          const there = containerAt(target.k)
          stackOn.current.set(s.key, target.k)
          const n = there.clone().sub(base)
          n.y = there.y + stackStep(target.k) - base.y
          moved.current.set(s.key, n)
        } else {
          // not over one: it's pushed clear of whatever it was carried across
          const n = settle(s.key, at.clone()).sub(base)
          n.y = 0
          moved.current.set(s.key, n)
        }
        setMoveTick((t) => t + 1)
      }
      shift.current = null
      lightContainer(null)
      window.removeEventListener('pointermove', slide)
      document.body.classList.remove('is-carrying')
      if (controls) controls.enabled = true
    }
    // carrying scraps to the bin
    const haul = (e: PointerEvent) => {
      const q = scrap.current
      if (!q) return
      if (!q.started) {
        if (Math.hypot(e.clientX - q.x, e.clientY - q.y) < 6) return
        q.started = true
        setTasteTip(null)
        q.p.carried = true
        q.p.node.userData.onPlate = true
        if (controls) controls.enabled = false
        document.body.classList.add('is-carrying')
        setHover(q.p)                  // what's being carried glows
      }
      aim(e)
      const plane = new THREE.Plane(UP, -root.localToWorld(new THREE.Vector3(0, 0.55, 0)).y)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      if (hit) q.p.node.position.copy(root.worldToLocal(hit))
      // raw food being carried: the fire lights up to say it can go there, brighter right over it
      if (q.p.staged) setFireHint(Math.hypot(q.p.node.position.x, q.p.node.position.z) < RING_CLEAR ? 2 : 1)
    }
    const dropScrap = () => {
      const q = scrap.current
      window.removeEventListener('pointermove', haul)
      scrap.current = null
      setFireHint(0)
      if (controls) controls.enabled = true
      if (!q?.started) return
      document.body.classList.remove('is-carrying')
      if (controls) controls.enabled = true
      q.p.carried = false
      setHover(null)
      setTasteTip(null)
      const bin = containerAt('trash')
      const pos = q.p.node.position
      // over the bin is judged where the pointer meets the height of its rim, not where the carried food floats
      const rim = raycaster.ray.intersectPlane(new THREE.Plane(UP, -root.localToWorld(new THREE.Vector3(0, TRASH_H, 0)).y),
        new THREE.Vector3())
      const atRim = rim ? root.worldToLocal(rim) : pos
      if (roast.trash && Math.hypot(atRim.x - bin.x, atRim.z - bin.z) < TRASH_R + 0.12) {
        // let go over the trash bin: it drops in — and throwing away good food draws a word
        const stage = stageOf(q.p.progress / roast.times[q.p.id]).key
        if (!q.p.stickOnly && stage === 'done') onNotice?.('waste')
        q.p.trash = 0
        q.p.trashFrom.copy(pos)
        q.p.staged = false
      } else if (q.p.staged && Math.hypot(pos.x, pos.z) < RING_CLEAR) {
        // raw food from the tray, let go over the fire: onto its skewer spot (or the net, or the ash)
        putOnFire(q.p)
      } else if (!q.p.collected && !q.p.staged) {
        q.p.node.userData.onPlate = false            // back onto its skewer spot
      }
    }
    const onUp = (e: PointerEvent) => {
      if (lockedRef.current) return
      if (drag.current || shift.current || scrap.current?.started) return
      if (e.button !== 0 || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      aim(e)
      const p = pickFood()
      if (!p) {
        // a sip of soup: it goes down a little each time, and the last sip counts as having had it
        const bowl = pickDrink()
        if (!bowl) return
        const s = sips.current.get(bowl.uuid) ?? { left: SIPS, level: 1 }
        s.left -= 1
        sips.current.set(bowl.uuid, s)
        if (s.left === 0) onEat?.(bowl.userData.itemId as string, SOUP_TASTE)
        return
      }
      if (p.staged) putOnFire(p)
      else if (p.collected && space === 'open') return      // (served at the bar: it's the customers')
      else if (p.collected && inBasket(p) && !p.unwrapped) p.unwrapped = true      // unwrap the foil first
      else if (p.collected) eat(p)
      else collect(p)
    }
    const onLeave = () => {
      if (drag.current) return
      hoveredTool.current = null
      setToolLabel(null)
      setHover(null)
      el.style.cursor = ''
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
    }
  })

  /**
   * The basket's little physics: each potato is a ball under gravity, resting on the bowl (a paraboloid matching
   * the basket's shape) and pushed apart from its neighbours, so they tumble in, roll down to the middle and heap
   * up. Rolling turns them; friction and damping let them come to rest.
   */
  const settleBasket = (dt: number) => {
    const live = pieces.current.filter((p) => p.body?.live && present(p) && !p.eaten)
    if (!live.length) return
    const c = basketAt(0)
    const steps = 4
    const h = dt / steps
    const n = new THREE.Vector3()
    const d = new THREE.Vector3()
    for (let k = 0; k < steps; k++) {
      for (const p of live) {
        const b = p.body!
        const pos = p.node.position
        b.v.y -= 6 * h
        pos.addScaledVector(b.v, h)
        // the bowl: floor rising toward the rim
        const dx = pos.x - c.x
        const dz = pos.z - c.z
        const dist = Math.hypot(dx, dz) || 1e-6
        const slope = 2 * BOWL_CURVE * dist
        const floor = c.y + 0.03 + BOWL_CURVE * dist * dist
        n.set((-slope * dx) / dist, 1, (-slope * dz) / dist).normalize()
        const depth = floor + b.r / n.y - pos.y
        if (depth > 0) {
          pos.addScaledVector(n, depth * n.y)
          const vn = b.v.dot(n)
          if (vn < 0) b.v.addScaledVector(n, -vn * 1.25)
          b.v.multiplyScalar(0.96)
          // roll along the floor
          const speed = Math.hypot(b.v.x, b.v.z)
          if (speed > 1e-4) {
            d.set(b.v.z, 0, -b.v.x).divideScalar(speed)
            p.node.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(d, (speed * h) / b.r * 0.6))
          }
        }
        // the rim keeps them in
        const wall = BASKET_R * 0.9 - b.r * 0.6
        if (dist > wall) {
          pos.x = c.x + (dx / dist) * wall
          pos.z = c.z + (dz / dist) * wall
          const out = (b.v.x * dx + b.v.z * dz) / dist
          if (out > 0) {
            b.v.x -= (dx / dist) * out * 1.3
            b.v.z -= (dz / dist) * out * 1.3
          }
        }
      }
      // potatoes push each other apart
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]
          const o = live[j]
          d.subVectors(a.node.position, o.node.position)
          const dist = d.length() || 1e-6
          const min = a.body!.r + o.body!.r
          if (dist >= min) continue
          d.divideScalar(dist)
          const push = (min - dist) / 2
          a.node.position.addScaledVector(d, push)
          o.node.position.addScaledVector(d, -push)
          const rel = a.body!.v.dot(d) - o.body!.v.dot(d)
          if (rel < 0) {
            a.body!.v.addScaledVector(d, -rel * 0.6)
            o.body!.v.addScaledVector(d, rel * 0.6)
          }
        }
      }
    }
    for (const p of live) {
      p.body!.v.multiplyScalar(1 - 0.8 * dt)
      if (p.body!.v.lengthSq() < 0.0004) p.body!.v.multiplyScalar(0.5)
    }
  }

  const anchors = useRef<Record<string, THREE.Group | null>>({})
  const [tags, setTags] = useState<{ key: string; id: string; name?: string; state: TagState }[]>([])
  const lastTags = useRef('')
  const lastOff = useRef(-1)
  const since = useRef(0)
  const tint = useMemo(() => new THREE.Color(), [])

  // glowing charcoal: mostly black at a low fire, more and more of it red-hot as the fire builds; as the fire
  // burns down the coals are used up and slowly turn to pale grey ash (fresh charcoal brings the black back)
  const embers = useRef<{ mat: THREE.MeshToonMaterial; base: number; color: THREE.Color }[] | null>(null)

  useFrame((_, delta) => {
    if (!embers.current || !embers.current.length) {
      const found = new Map<THREE.MeshToonMaterial, number>()
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial &&
          (o.material.name === 'Ember' || o.material.name === 'Binchotan')) {
          found.set(o.material, o.material.emissiveIntensity)
        }
      })
      embers.current = [...found].map(([mat, base]) => ({ mat, base, color: mat.color.clone() }))
    }
    const f = fire?.current ?? 0.55
    const ash = THREE.MathUtils.smoothstep(0.5 - f, 0, 0.45)

    for (const e of embers.current) {
      // no fire, no glow
      e.mat.emissiveIntensity = e.base * 1.23 * f ** 1.6
      const gain = 1 + ((ASH_GAIN[e.mat.name] ?? 1) - 1) * ash ** 1.5
      e.mat.color.copy(e.color).lerp(ASH_TINT, ash).multiplyScalar(gain)
    }
    if (scannedCount.current !== root.children.length) scan()
    const dt = Math.min(delta, 0.1)
    // fanned-up heat burns the coals faster while it lasts (more the hotter it's been fanned), and dies back once the
    // fanning stops
    const fan = fanned.current
    if (fan.extra > 0 && fire) {
      fire.current = Math.max(0, fire.current - dt * GAME_SPEED.value * FAN_BURN * (fan.extra / FAN_MAX))
      if (performance.now() - fan.last > 600) {
        const back = Math.min(fan.extra, dt * FAN_FADE)
        fan.extra -= back
        fire.current = Math.max(0, fire.current - back)
      }
      if (fire.current <= 0.02) fan.extra = 0
    }
    // (past 100% the coals are going up fast: the more over, the faster they're used up)
    if (fire && fire.current > 1) fire.current = Math.max(1, fire.current - dt * GAME_SPEED.value * FAN_OVER_BURN * ((fire.current - 1) / (FIRE_FANNED_MAX - 1)))
    // soup going down as it's drunk: the surface sinks into the bowl and narrows with it; a bowl taken off the
    // order comes back full next time
    root.traverse((o) => {
      const id = o.userData.itemId as string | undefined
      if (!id || !roast.drinks?.includes(id)) return
      const liquid = o.children.find((c) => /^(Miso|Sake)Liquid/.test(c.name))
      if (!liquid) return
      if (!liquid.userData.full) liquid.userData.full = { y: liquid.position.y }
      if (!o.visible || o.scale.x < 0.01) {
        sips.current.delete(o.uuid)
        return
      }
      const s = sips.current.get(o.uuid)
      if (!s) {
        liquid.position.y = liquid.userData.full.y
        liquid.scale.set(1, 1, 1)
        liquid.visible = true
        return
      }
      s.level += (s.left / SIPS - s.level) * Math.min(1, dt * 4)
      const gone = 1 - s.level
      // (the sake cup is much shallower than the soup bowl)
      const cup = liquid.name.startsWith('Sake')
      liquid.position.y = liquid.userData.full.y - gone * (cup ? 0.022 : 0.07)
      liquid.scale.set(1 - gone * (cup ? 0.5 : 0.42), 1, 1 - gone * (cup ? 0.5 : 0.42))
      liquid.visible = s.level > 0.03
    })
    // seasonings: the one being carried follows the pointer, tipped to pour over the food beneath it (a little
    // sprinkle or drip falls while it's over something); the rest sit in their places, glowing when pointed at
    const d = drag.current
    for (const t of tools) {
      const held = d?.tool === t
      if (held && t.kind === 'salt' && hand.current) hand.current.position.copy(t.node.position).add(HAND_OFFSET)
      if (held) {
        t.node.position.lerp(d!.at, Math.min(1, dt * 14))
        d!.pour += ((d!.target ? 1 : 0) - d!.pour) * Math.min(1, dt * 8)
        t.node.quaternion.copy(t.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, -1).normalize(), 0.2 + d!.pour * 0.9))
        if (d!.target && Math.random() < dt * 30) emit(t.kind, t.node.position.clone().add(new THREE.Vector3(0, -0.05, 0)), 2)
      } else if (t.back < 1) {
        // carried back home in a little arc
        t.back = Math.min(1, t.back + dt * 2.5)
        t.node.position.lerp(t.home, Math.min(1, dt * 10))
        t.node.quaternion.slerp(t.homeQ, Math.min(1, dt * 10))
        if (t.back >= 1) {
          t.node.position.copy(t.home)
          t.node.quaternion.copy(t.homeQ)
        }
      }
      const lit = active && (held || hoveredTool.current === t ||
        (!!shift.current && carrierOf(t.node.name) === shift.current.key))
      t.node.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
          // (the spoons' and brushes' handles share one wood material: each gets its own, so only this one glows)
          if (!o.userData.ownMaterial) {
            o.material = o.material.clone()
            o.userData.ownMaterial = true
          }
          o.material.emissive.set(lit ? HOVER_GLOW : 0x000000)
        }
      })
    }
    {
      const { pos, vel, life } = grains
      let any = false
      for (let i = 0; i < GRAINS; i++) {
        if (life[i] <= 0) continue
        any = true
        life[i] -= dt
        vel[i * 3 + 1] -= 4.5 * dt
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        // (a grain that reaches the table top is gone into it; one that's done is put far out of sight: parked just
        // under the table it would show on the floors, which lie below it)
        if (pos[i * 3 + 1] < 0.004) life[i] = 0
        if (life[i] <= 0) pos.set([0, -1e4, 0], i * 3)
      }
      if (any) grains.geometry.attributes.position.needsUpdate = true
      grains.geometry.attributes.color.needsUpdate = true
    }
    // the grill net holds a few at a time: hand free spots to waiting pieces, first ordered first
    const spots = roast.netSpots ?? []
    if (spots.length) {
      const onNet = (p: Piece) => roast.net?.includes(p.id) && present(p) && !p.collected && !p.staged
      const taken = new Set(pieces.current.filter((p) => onNet(p) && p.netSpot !== null).map((p) => p.netSpot))
      for (const p of pieces.current.filter((q) => onNet(q) && q.netSpot === null).sort((a, b) => a.copy - b.copy)) {
        const free = spots.findIndex((_, i) => !taken.has(i))
        if (free < 0) break
        p.netSpot = free
        taken.add(free)
      }
    }
    const waiting = (p: Piece) => !!roast.net?.includes(p.id) && !p.collected && !p.staged && p.netSpot === null
    // what's waiting on the tray, in the order it arrived
    const onTray = pieces.current.filter((p) => p.staged && present(p) && !p.carried && p.trash < 0)
      .sort((a, b) => a.stagedAt - b.stagedAt)
    // (those on the raw dish don't take a place on the tray)
    const onBoard = onTray.filter((p) => !roast.rawDish?.items.includes(p.id))

    pieces.current.forEach((p, n) => {
      bindMaterials(p)
      if (present(p) && !p.wasPresent) {
        // just ordered: it's brought out raw on the tray (the base fish, not on the menu, starts on the fire)
        p.wasPresent = true
        // (in the open shop: the next one of these ordered, as what dish)
        if (space === 'open') {
          const i = wants.current.findIndex((w) => w.id === p.id)
          p.want = i >= 0 ? wants.current.splice(i, 1)[0] : null
        }
        if (menuIds.has(p.id) && roast.tray) {
          p.staged = true
          p.stagedAt = ++stageSeq.current
          p.node.userData.onPlate = true
        }
      }
      if (!present(p)) {
        // taken off the order: next time it comes back raw, on the tray
        p.wasPresent = false
        p.staged = false
        p.homeFlight = 1
        p.unwrapped = false
        p.unwrapT = 0
        p.chefSeasoned = false
        for (const k of Object.keys(p.dabs) as Seasoning[]) p.dabs[k] = 0
        p.steps = []
        p.progress = 0
        p.netSpot = null
        p.container = null
        p.carried = false
        p.trash = -1
        p.body = null
        for (const u of Object.values(p.looks)) u.value = 0
        p.stickOnly = false
        for (const m of p.food) m.visible = true
        if (p.bites.uBiteCount.value) {
          p.bites.uBiteCount.value = 0
          for (const { mat, foil } of p.mats) if (!foil && mat.side !== THREE.FrontSide) {
            mat.side = THREE.FrontSide
            mat.needsUpdate = true
          }
        }
        p.landed = -1
        p.via = undefined
        p.small = false
        p.collected = false
        p.flight = 0
        p.slot = null
        p.eat = 0
        p.eaten = false
        p.want = null
        p.node.userData.onPlate = false
        p.node.userData.follow = undefined
        p.node.quaternion.copy(p.homeQ)
        p.node.position.copy(p.homeP)
        return
      }
      // eaten and gone (or in the bin): nothing more to work out for it, every frame, however many there have been
      // (and nothing of it left for a server to carry; nor anything left told of one that isn't going through the
      // pass, should the floor have set it down just as it was taken away)
      if (!p.via && SERVICE.delivered.size) SERVICE.delivered.delete(p.key)
      if (p.eaten && p.via) {
        p.via = undefined
        SERVICE.waiting.delete(p.key)
        SERVICE.carried.delete(p.key)
        SERVICE.claimed.delete(p.key)
        SERVICE.delivered.delete(p.key)
      }
      if (p.eaten && p.trash < 0) {
        if (menuIds.has(p.id)) p.node.userData.shrink = 0.0001
        else p.node.scale.setScalar(0.0001)
        return
      }
      const time = roast.times[p.id]
      if (p.trash >= 0) {
        // tossed into the bin: a short arc down into it, and gone
        p.trash = Math.min(1, p.trash + dt / 0.45)
        const k = p.trash
        const into = containerAt('trash')
        into.y += 0.12
        p.node.position.lerpVectors(p.trashFrom, into, k)
        p.node.position.y += Math.sin(k * Math.PI) * 0.12
        if (k >= 1) {
          p.trash = -1
          p.eaten = true
          // it's in the bin now: one more thing lying in it
          trashedRef.current += 1
          setTrashed(trashedRef.current)
          p.slot = null
          p.collected = true
          p.stickOnly = false
        }
      } else if (p.carried) {
        // (held by the pointer, see haul)
      } else if (p.staged && roast.rawDish?.items.includes(p.id)) {
        // rice balls wait raw on their own little dish, sitting the way they'll go on the net
        const mine = onTray.filter((q) => roast.rawDish!.items.includes(q.id))
        const k = Math.max(0, mine.indexOf(p))
        const a = (k / 3) * Math.PI * 2 + 0.4
        const at = containerAt('rawdish').add(new THREE.Vector3(Math.cos(a) * (k < 3 ? 0.1 : 0), 0.05 + Math.floor(k / 3) * 0.08,
          Math.sin(a) * (k < 3 ? 0.1 : 0)))
        p.node.position.lerp(at, Math.min(1, dt * 10))
        p.node.quaternion.copy(p.homeQ)
      } else if (p.staged) {
        // waiting raw on the tray, laid flat in its spot
        const at = p.loose ? trayLooseSpot(Math.max(0, onBoard.filter((q) => q.loose).indexOf(p)))
          : traySpot(Math.max(0, onBoard.filter((q) => !q.loose).indexOf(p)))
        p.node.position.lerp(at, Math.min(1, dt * 10))
        // (lying along the tray's long side, which runs across the front)
        flatQ(p, p.node.quaternion, STACK_DIR)
      } else if (!p.collected) {
        if (active && !waiting(p) && p.homeFlight >= 1) p.progress += dt * roastRate(fire?.current ?? 0.55)
        p.node.quaternion.copy(p.homeQ)
        p.node.position.x = p.homeP.x
        p.node.position.z = p.homeP.z
        if (p.netSpot !== null) {
          p.node.position.x = spots[p.netSpot][0]
          p.node.position.z = spots[p.netSpot][1]
        }
        if (p.homeFlight < 1) {
          // carried from the tray onto the fire: a little arc to its spot, turning upright onto the stick
          p.homeFlight = Math.min(1, p.homeFlight + dt / 0.6)
          const e = p.homeFlight < 0.5 ? 2 * p.homeFlight ** 2 : 1 - (-2 * p.homeFlight + 2) ** 2 / 2
          const to = new THREE.Vector3(p.node.position.x, p.homeP.y, p.node.position.z)
          p.node.position.lerpVectors(p.fromP, to, e)
          p.node.position.y += Math.sin(p.homeFlight * Math.PI) * 0.35
          p.node.quaternion.slerpQuaternions(p.fromQ, p.homeQ, e)
          if (p.homeFlight >= 1) p.node.userData.onPlate = false
        }
        if (!menuIds.has(p.id)) p.node.position.y = p.homeP.y   // the base fish has no pop-in driving y
      } else {
        if (p.flight >= 1) p.landed += dt
        else p.landed = -1
        if (p.flight < 1 && p.flight + dt / FLIGHT_SECONDS >= 1 && STEAMS.test(p.id) && !p.eaten) {
          p.landed = 0
          const at = inBasket(p) ? basketAt(0).add(new THREE.Vector3(0, 0.06, 0)) : p.toP
          setWisps((all) => [...all.filter((w) => w.key !== p.key), { key: p.key, at: at.toArray() as [number, number, number] }])
        }
        // (served at the bar, it waits in the cook's hand by the fire till the customer's plate is set down for it)
        const plateless = p.container === 'bar' && bar && !SERVICE.servers && !p.via && p.flight === 0 && !PLATES_SET.has(p.seat)
        // (served through the pass: out there till a server takes it, then on the tray with them, then onto the plate)
        if (p.via === 'pass') {
          if (SERVICE.delivered.has(p.key)) {
            SERVICE.delivered.delete(p.key)
            const row = pieces.current.filter((q) => q !== p && q.collected && q.container === 'bar' && q.seat === p.seat && !q.via && present(q) && !q.eaten).length
            p.fromP.copy(p.node.position)
            p.fromQ.copy(p.node.quaternion)
            p.toP.copy(barSeat(p.seat)).addScaledVector(GRILL_SEATS[p.seat].along, ((row % 3) - 1) * 0.07 * GRILL_SCALE)
              .add(new THREE.Vector3(0, BAR_TOP_SCENE + 0.04 + Math.floor(row / 3) * 0.06, 0))
            p.via = undefined
            p.flight = 0.6
          } else if (SERVICE.carried.has(p.key)) {
            p.fromP.copy(SERVICE.carried.get(p.key)!)
            p.toP.copy(p.fromP)
            p.flight = 1
          } else if (p.flight >= 1) {
            p.small = true
            if (!SERVICE.waiting.has(p.key) && !SERVICE.claimed.has(p.key)) SERVICE.waiting.set(p.key, p.seat)
          }
        }
        if (!plateless) p.flight = Math.min(1, p.flight + dt / FLIGHT_SECONDS)
        if (!p.body?.live) {
          const e = p.flight < 0.5 ? 2 * p.flight * p.flight : 1 - (-2 * p.flight + 2) ** 2 / 2
          // (its spot follows the plate or dish if that's been dragged somewhere)
          if (p.container) p.toP.copy(containerAt(p.container)).add(p.local)
          p.node.position.lerpVectors(p.fromP, p.toP, e)
          p.node.position.y += Math.sin(p.flight * Math.PI) * 0.45   // a little arc through the air
          p.node.quaternion.slerpQuaternions(p.fromQ, p.toQ, e)
          if (p.flight >= 1 && inBasket(p)) {
            // let go above the basket: size the ball from the potato's two shorter axes
            const s = [p.node.scale.x, p.node.scale.y, p.node.scale.z].sort((x, y) => x - y)
            p.body = { v: new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3),
              r: (s[0] + s[1]) / 2 * 1.05, live: true }
          }
        }
        // (no bar drawn, on a phone: what's served is carried off to the customers, who are on the 2D board; and with
        // the shop shut there's no bar at all, so nothing left served on it hangs in the air where it was)
        if (!bar && p.container === 'bar') p.node.visible = p.flight < 1
        if (space !== 'open' && p.container === 'bar') p.node.visible = false
      }

      // browning, then a slow char: black patches spread across the texture and the whole piece darkens,
      // deepening the longer it's left on
      const r = p.progress / time
      const charred = THREE.MathUtils.smootherstep(r, CHAR_START, CHAR_FULL)
      p.looks.uChar.value = charred
      // mochi on the net swells up as it toasts, and breathes a little while it's still over the coals
      if (p.puffs.length) {
        const puff = THREE.MathUtils.smoothstep(r, 0.55, 1.15)
        const breathe = p.collected ? 0 : Math.sin(performance.now() / 380 + p.copy) * 0.05 * puff
        for (const m of p.puffs) m.morphTargetInfluences![0] = Math.min(1, puff + breathe)
      }
      if (r < 1) tint.copy(RAW_TINT).lerp(DONE_TINT, r)
      else tint.copy(DONE_TINT).lerp(BURNT_TINT, charred * 0.6)
      const glow = hovered.current === p || (flashUntil.current.get(p.key) ?? 0) > performance.now()
      // potatoes: wrapped and whole in the ash. Picked up, the foil is unwrapped on the way over — the sheet opens
      // out, swells and falls away — and the potato lands in the basket bare, broken open to show the flesh
      // potatoes in the basket keep their foil until clicked; then it opens out, swells and falls away
      if (p.unwrapped) p.unwrapT = Math.min(1, p.unwrapT + dt / 0.7)
      const peel = p.unwrapped ? p.unwrapT : -1
      for (const { mat, mesh, base, emissive, foil, show, eye } of p.mats) {
        // (hide the mesh rather than the material, so its ink outline goes with it)
        if (show === 'closed') mesh.visible = !(p.unwrapped && p.unwrapT > (foil ? 0.05 : 0.35))
        if (show === 'open') {
          mesh.visible = peel > 0 && peel < 1
          if (mesh.visible) {
            if (!mat.transparent) {
              mat.transparent = true
              mat.needsUpdate = true
            }
            mat.opacity = 1 - peel * peel
            mesh.scale.setScalar(1 + peel * 0.9)
            mesh.position.y = -0.4 * peel * peel
          } else {
            mesh.scale.setScalar(1)
            mesh.position.y = 0
          }
        }
        if (!foil && !eye) mat.color.copy(base).multiply(tint)
        mat.emissive.copy(emissive)
        if (glow) mat.emissive.add(HOVER_GLOW)
      }
      // burnt food shrivels a little. Menu items get their scale from Dish's pop-in, which applies this factor;
      // the base fish has no pop-in, so set it directly.
      let shrink = 1 - 0.08 * THREE.MathUtils.smoothstep(r, 1.8, CHAR_FULL)
      // being eaten, a mouthful at a time: on each bite the piece is lifted a little as if picked up, a chunk with
      // tooth-marked edges disappears from the end, and it settles back while it's chewed (阿姆阿姆). On a skewer
      // only the food goes and the bare stick is left lying on the plate
      if (p.eat > 0 && !p.eaten && !p.stickOnly) {
        p.eat = Math.min(1, p.eat + dt / EAT_SECONDS)
        const phase = p.eat * BITES_PER_PIECE
        const wanted = Math.min(BITES_PER_PIECE, Math.floor(phase + 0.35))
        while (p.bites.uBiteCount.value < wanted) takeBite(p)
        // (only what's eaten off your own plate hops up to be bitten: at the bar it's the customer you see eating, so
        // the piece just lies there getting smaller)
        if (!p.body?.live && p.container !== 'bar') {
          const lift = Math.max(0, Math.sin(Math.min(1, (phase % 1) * 1.6) * Math.PI))
          p.node.position.y += 0.06 * lift
          p.node.rotateOnWorldAxis(STACK_DIR, -0.12 * lift)
        }
        if (p.eat >= 1) {
          // (what an AI customer eats fills their stomach, not yours)
          if (!p.node.userData.byGuest) onEat?.(p.id, tasteOf(p), { doneness: p.progress / roast.times[p.id], dabs: { ...p.dabs }, steps: [...p.steps] })
          if (p.sticks.length) {
            p.stickOnly = true
            for (const m of p.food) m.visible = false
          } else {
            p.eaten = true
            p.slot = null
          }
        }
      }
      // served at the bar it comes down to the size of the customers and their plates (the fire is drawn big, to
      // cook on; the bar is in the people's own scale), shrinking as it's carried over
      if (p.container === 'bar' && p.collected) shrink *= p.small ? BAR_FOOD_SCALE : THREE.MathUtils.lerp(1, BAR_FOOD_SCALE, THREE.MathUtils.smoothstep(p.flight, 0, 1))
      if (p.eaten || waiting(p)) shrink = 0.0001
      if (menuIds.has(p.id)) p.node.userData.shrink = shrink
      else p.node.scale.setScalar(shrink)

      // tags sit above the food, staggered over three heights so neighbouring tags don't overlap
      const a = anchors.current[p.key]
      if (a) {
        a.position.copy(p.node.position)
        a.position.y += (p.loose ? 0.2 : 0.32) + (n % 3) * 0.15
      }
    })

    if (roast.basket) settleBasket(dt)

    // AI simulation: the chef works the grill, customers order and eat
    if (ai && active) {
      aiClock.current += dt
      chefClock.current += dt
      if (chefClock.current > chef.pace) {
        chefClock.current = 0
        runChef()
      }
      if (aiClock.current > 0.8) {
        aiClock.current = 0
        runGuests()
      }
    }

    // smoke rises once food over the coals starts to cook through (fat and juices dripping onto the charcoal):
    // none from a bare fire, more with every done piece, most when it's charring
    if (smoke) {
      let s = 0
      let b = 0
      for (const p of pieces.current) {
        if (!present(p) || p.collected || waiting(p)) continue
        const r = p.progress / roast.times[p.id]
        // (pale smoke while it cooks; once it's burning there's only the black)
        s += THREE.MathUtils.smoothstep(r, 0.7, 1.1) * 0.35 * (1 - THREE.MathUtils.smoothstep(r, 1.8, 2.2))
        // food left to burn sends up thick black smoke
        b += THREE.MathUtils.smoothstep(r, 2.0, 2.8) * 0.45
      }
      const heat = Math.min(1, (fire?.current ?? 0.55) * 1.5)
      smoke.current += (Math.min(1, s) * heat - smoke.current) * Math.min(1, dt * 0.8)
      if (blackSmoke) blackSmoke.current += (Math.min(1, b) * heat - blackSmoke.current) * Math.min(1, dt * 0.6)
    }

    since.current += delta
    if (since.current < 0.25) return
    since.current = 0
    // keep as many plates out as the food on them needs (always at least one)
    let need = 1
    let needBaskets = 1
    let needDishes = 1
    const cap = roast.basket?.capacity ?? 10
    for (const p of pieces.current) {
      // (what's served at the bar has a slot too, but it's the customers' and needs no plate out by the fire)
      if (p.slot === null || p.eaten || !present(p) || p.container === 'bar') continue
      if (inBasket(p)) needBaskets = Math.max(needBaskets, Math.floor(p.slot / cap) + 1)
      else if (onDish(p)) needDishes = Math.max(needDishes, Math.floor(p.slot / roast.dish!.capacity) + 1)
      else need = Math.max(need, Math.floor(p.slot / PER_PLATE) + 1)
    }
    if (need !== plateCount) setPlateCount(need)
    if (needBaskets !== basketCount) setBasketCount(needBaskets)
    if (needDishes !== dishCount) setDishCount(needDishes)
    // skewers off the fire (for the fire's limit), and potatoes still around (for the basket's)
    const off = pieces.current.filter((p) => (p.collected || p.staged) && present(p) && !p.loose).length
    const loose = pieces.current.filter((p) => inBasket(p) && present(p) && !p.eaten).length
    if (off * 1000 + loose !== lastOff.current) {
      lastOff.current = off * 1000 + loose
      onOffFire?.(off, loose)
    }
    const next: { key: string; id: string; name?: string; state: TagState }[] = []
    for (const p of pieces.current) {
      if (!present(p) || p.collected || p.staged || (roast.net?.includes(p.id) && p.netSpot === null)) continue
      const r = p.progress / roast.times[p.id]
      const s = stageOf(r)
      next.push({ key: p.key, id: p.id, name: p.want?.name, state: { stage: s.key, label: s.label, pct: Math.round(Math.min(1, r) * 20) / 20 } })
    }
    const k = JSON.stringify(next)
    if (k !== lastTags.current) {
      lastTags.current = k
      setTags(next)
    }
  })

  const byKey = (key: string) => pieces.current.find((p) => p.key === key)

  return (
    <>
      {Array.from({ length: plateCount }, (_, n) => (
        <Plate key={n} container={`plate-${n}`} position={plateAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.basket && Array.from({ length: basketCount }, (_, n) => (
        <Basket key={n} container={`basket-${n}`} position={basketAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.dish && Array.from({ length: dishCount }, (_, n) => (
        <SideDish key={n} container={`dish-${n}`} position={dishAt(n).toArray() as [number, number, number]} />
      ))}
      {Object.entries(SPARES).map(([k, sp]) => {
        const h = spareHome(k)
        if (!h) return null
        const base = k === 'plate-0' ? roast.plate[1] ?? 0 : k === 'dish-0' ? roast.dish!.at[1] : roast.rawDish!.at[1]
        return Array.from({ length: sp.n }, (_, i) => {
          // (stacked by hand: each a little off true)
          const j = Math.sin(i * 7.3 + k.length) * 0.012
          const at: [number, number, number] = [h.x + j, base + i * sp.step, h.z - j * 0.7]
          return k === 'plate-0' ? <Plate key={`${k}-${i}`} container="" position={at} />
            : <SideDish key={`${k}-${i}`} container="" position={at} />
        })
      })}
      <Decor held={held} lanternAt={containerAt('lantern').toArray() as [number, number, number]} />
      {active && decorTip && (
        <Html position={decorTip === 'fan' ? [DECOR.fan.at[0], 0.35, DECOR.fan.at[1]] : [DECOR.crate.at[0], 0.5, DECOR.crate.at[1]]}
          center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <span className="tool-tag">{decorTip === 'fan' ? '團扇' : '備長炭'}<small>{decorTip === 'fan' ? '拿到火上來回搧' : '拖到火上添炭'}</small></span>
        </Html>
      )}
      {roast.tray && <Tray container="tray" position={trayAt().toArray() as [number, number, number]} />}
      {/* (the table, the crew and the bar stay where they were drawn: the fire and all round it stand FIRE_SHIFT along from them, to the table's middle) */}
      <group position={[-FIRE_SHIFT.x, 0, -FIRE_SHIFT.z]}>
      <CookTable floor={!bar} />
      {/* (the crew keep their own places on the kitchen floor: carried back by the shift) */}
      <group position={[FIRE_SHIFT.x, 0, FIRE_SHIFT.z]}>
      {space === 'open' && bar && crewPlaces(crew).map(({ m, at, yaw }) => (
        <CrewWalk key={m.id} at={at} yaw={yaw}><BlobShadow r={0.17} /><StaffFigure id={m.id} role={m.role} look={m.look} /></CrewWalk>
      ))}
      </group>
      {bar && <Bar />}
      </group>
      {roast.rawDish && <SideDish container="rawdish" position={containerAt('rawdish').toArray() as [number, number, number]} />}
      {roast.trash && <TrashBin container="trash" contents={trashed}
        position={containerAt('trash').toArray() as [number, number, number]} />}
      {fireHint > 0 && (
        // where carried food can be set down: the fire bed glows
        <mesh rotation-x={-Math.PI / 2} position-y={0.07}>
          <ringGeometry args={[0.18, RING_CLEAR - 0.18, 64]} />
          <meshBasicMaterial color="#ff8a1e" transparent opacity={fireHint === 2 ? 0.5 : 0.22} depthWrite={false} />
        </mesh>
      )}
      {/* salt is taken with the fingers: a pinching hand follows the pinch while it's carried */}
      {saltInHand && (
        <group ref={hand}>
          <Html center zIndexRange={[40, 30]} style={{ pointerEvents: 'none' }}><PinchHand /></Html>
        </group>
      )}
      <points geometry={grains.geometry} material={grainMaterial} frustumCulled={false} renderOrder={3} />
      {active && tasteTip && (
        <Html position={tasteTip.at} center zIndexRange={[35, 25]} style={{ pointerEvents: 'none' }}>
          <span className="taste-tip">美味 <b>{tasteTip.taste}</b></span>
        </Html>
      )}
      {pops.map((x) => (
        <Html key={x.id} position={x.at} center zIndexRange={[36, 26]} style={{ pointerEvents: 'none' }}>
          <span className={`taste-pop${x.good ? '' : ' is-bad'}`}>{x.text}</span>
        </Html>
      ))}
      {active && toolLabel && (
        <Html position={toolLabel.at} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <span className="tool-tag">{TOOL_NAMES[toolLabel.kind]}<small>拖到食物上</small></span>
        </Html>
      )}
      {wisps.map((w) => (
        <Wisp key={w.key} at={w.at} onDone={() => setWisps((all) => all.filter((x) => x.key !== w.key))} />
      ))}
      {active && tags.map(({ key, id, name, state }) => (
        <group key={key} ref={(g) => { anchors.current[key] = g }}>
          <Html center zIndexRange={[30, 10]}>
            <button type="button"
              className={`roast-tag roast-${state.stage}${hoveredKey === key ? ' roast-tag-lit' : ''}`}
              aria-label={`${roast.names[id]}，${state.label}，點一下放到盤子上`}
              onClick={() => { const p = byKey(key); if (p) collect(p) }}>
              <svg className="roast-ring" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8" className="roast-ring-track" />
                <circle cx="10" cy="10" r="8" className="roast-ring-fill" pathLength={100}
                  strokeDasharray={`${state.pct * 100} 100`} />
              </svg>
              <span className="roast-name">{name ?? roast.names[id]}</span>
              <span className="roast-state">{state.label}</span>
            </button>
          </Html>
        </group>
      ))}
    </>
  )
}
