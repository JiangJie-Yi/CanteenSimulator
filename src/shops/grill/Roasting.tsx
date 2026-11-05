import { memo, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Gripe, Visit } from '@/game/reputation'
import { BASE_MATERIAL } from '@/scene/baseMaterial'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { OUTLINE_WIDTH } from '@/scene/Dish'
import { colourVertices, StaticBatch } from '@/scene/StaticBatch'
import { glowOnly } from '@/scene/hoverGlow'
import { canCookByHand, modeOf, showsProgress } from '@/game/mode'
import { FLOWS, flowOf, wantOf, type FlowKind } from '@/game/flow'
import { COAL_MAX, COAL_PER_ADD, crumble, standStick, roomFor, surfaceY, type Lay, throwForce } from '@/game/coalPile'
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
import { sameProps } from '@/scene/sameProps'
import { StaffFigure, StaffWarm, TRAY_AT } from '@/scene/StaffFigure'
import { commuteOf, delayOf, paceOf } from '@/game/commute'
import { COMMUTERS, makeTrip, through, tripStep, type Trip } from './commuteWalk'
import { afterPhase, CHEF_PACE, nextTrip, PREP_S, TAKE_S, TEND_AT, tendOf, type ChefPhase, type Store } from '@/game/chefFlow'
import { SHAPE_S, takeRice } from '@/game/rice'
import { CubbyStock } from './KitchenStores'
import { QUALITY } from '@/scene/quality'
import { seasonSound, sprinkleTick } from './seasonSound'
import { biteSound, chewSound } from './chewSound'
import { comesIn, patienceIn, roomMood } from '@/game/roomLights'
import { getLights } from '@/scene/lightsStore'
import { kindOf, type GuestKind } from '@/data/guests'
import type { Look, Role } from '@/data/staff'
import { ROAST_STAGES, type Roast, type Seasoning } from '@/data/menu'
import { bestStage, PAIRING, PAIRING_DEFAULT, stageOf as seasonStage, timingLoss } from '@/game/taste'
import type { Step } from '@/game/types'
import type { GuestView } from '@/game/types'
import { DECOR, Decor, FRIDGE_KICK, takeFromCrate, type Held } from './Decor'
import { COAL_BRIDGE, DRAWER_HELD, SHRINE_FLOWERS, WC_GRUMBLE, setTissues, tissuesAt } from './bar'
import { BOX_SHEETS } from '@/game/tissues'
import { fireAmbience } from './fireAmbience'
import { fireSound } from '@/game/fireSound'
import { flowerBuffs } from '@/game/shrineFlowers'
import { Boss, BOSS_TASTE } from './Boss'
import { AxisGizmo, focusCamera, useEditBox } from './Movable'
import { ashMaterial, MODEL_LEN, MODEL_R, useBinchotan } from './binchotanModel'
import { coalLayer, coalLook, type CoalLook } from './coalLayer'
import { beginChange, commitOffsets, getEdit, moveTo, offsetOf, positionOf, registerMovable, settleOffset, useEdit, type V3 } from './edit'
import { setTip } from '@/scene/hoverTip'
import { slide as drawerSound } from './TillDesk'
import { tissuePull } from './paperSound'
import { reflectStudio, useStudio } from '@/scene/studio'
import { ColdMist } from '@/scene/ColdMist'
import { Movable } from './Movable'
import { BAMBOO_WARE, forPhone, PLUM_WARE, wareGeometry } from './ware'
import { wareDesign } from './wareDesigns'
import { SHOP } from '@/game/shopState'
import { STAFF_DOOR_HOLD, CUBBY_KICK, seatLabel, CHOPS_UP, GRIPES, gripe, CUBBY_OPEN, meterWater, KITCHEN_ROUTE, askPantry, shutPantry, SUPPLIES, PLACE, sharedAlong, SICK, LIP_H, PLATING, READY_SLOTS, readyAlong, PLATES_OUT, PLATER_OUT, SEAT_STICKS, SEAT_BONES, WHOLE_FISH, RICE, seatAlong, tipOver, ALONG, handOver, FLOOR_NEAR, staffWayOut, inKitchen, alongPath, pathLength, drinkFor, type DrinkId, sauceSide, POINTER_HINT, PLATES_SET, SEATS_TAKEN, SERVICE, PANTRY, KITCHEN_FOLK, platingOf, BAR_GATES, gateCut, gateOf, type Gate, TILL, GRILL_BAR_TOP, GRILL_COUNTERS, GRILL_OFFSET, GRILL_SCALE, GRILL_SEATS, SIDE_PULL, FIRE_SHIFT, KITCHEN_DROP, LAY, toGrillScene, CUBBY, CUBBY2, CUBBY_FLOOR_Y, CUBBY_SHELF_Y, COOK_NOTCH, type Counter } from './bar'
import { freshFactor, sickChance } from '@/game/freshness'
import { warmLater } from '@/scene/Prewarm'

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
/** how fast (per second) the heat that's been fanned up is let into the fire */
const FAN_RISE = 0.06
const FAN_BURN = 0.02
const FIRE_FANNED_MAX = 1.2
const FAN_OVER_BURN = 0.03
type Guest = { id: number; orders: string[]; ate: string[]; eaten: number[]; since: number; state: GuestView['state']; seat: number
  /** the one they came in with (a couple, sat side by side) */
  partner?: number
  /** (shop clock) when they got up; their plate and sticks are cleared away a moment later */
  leftAt?: number; cleared?: boolean
  /** (shop clock) when they ate their first piece: how long they waited for it */
  firstAte?: number }
/** at most this many AI customers seated at once; one gives up after waiting this long with nothing to eat */
const MAX_SEATED = GRILL_SEATS.length
/** who can come in as a couple: him, and her */
const COUPLE_HIM = new Set<GuestKind>(['salaryman', 'collegeStudent', 'schoolboy', 'delinquent', 'foreignTourist'])
const COUPLE_HER = new Set<GuestKind>(['officeLady', 'schoolgirl', 'yukataLady', 'maidCoser', 'collegeStudent'])
const PATIENCE = 150
/** the bar the customers sit at, behind the fire (away from the camera): its middle, length, top, and seats */
const BAR_AT = GRILL_COUNTERS[0].at.clone()
// (high enough for the customers sat at it: about a third of their height above the seat, as a real counter)
const BAR_TOP = GRILL_BAR_TOP
const BAR_SEATS = GRILL_SEATS.length
/** the same, as this one's drawn (GRILL_SCALE bigger; and this one's frame is the fire's, FIRE_SHIFT along from the bar's: without it the food
 * set at a customer's place lay 0.65 along the counter from their plate, and that carried on a server's tray beside the tray) */
const BAR_AT_SCENE = toGrillScene(BAR_AT).sub(FIRE_SHIFT)
const BAR_TOP_SCENE = BAR_TOP * GRILL_SCALE + GRILL_OFFSET.y
/** how big food is on the bar, next to the fire's: a skewer about as long as a customer's plate is wide */
const BAR_FOOD_SCALE = 0.5 * GRILL_SCALE
/** the chef's plating place (bar.ts's platingOf), on the cook table right beside him: what's grilled is plated there, ready (ORDER_READY), and
 * a server comes into the kitchen to him for it (the owner's: no pass on the bar between them any more); the table's top in the scene, and
 * the way across the table */
const PLATING_FRAME = platingOf()
const PLATING_TOP = PLATING_FRAME.top * GRILL_SCALE + GRILL_OFFSET.y
const PLATING_ACROSS = PLATING_FRAME.across.clone()
/** where a piece goes at the plating place: side by side in its slot (on the plate laid there, or loose on the table, for a plate already out),
 * three to a row, a full row with another on top; in this one's frame, the fire FIRE_SHIFT along from the bar's (fromBar, below) */
const readyFoodAt = (slot: number, row: number, plate: boolean) => toGrillScene(PLATING_FRAME.at.clone().addScaledVector(PLATING_FRAME.dir, readyAlong(slot))).sub(FIRE_SHIFT)
  .addScaledVector(PLATING_FRAME.across, ((row % 3) - 1) * 0.06 * GRILL_SCALE)
  .setY(PLATING_TOP + 0.04 + (plate ? 0.01 * GRILL_SCALE : 0) + Math.floor(row / 3) * 0.06)
const barSeat = (n: number) => toGrillScene(GRILL_SEATS[n].plate).sub(FIRE_SHIFT).setY(0)
const HOVER_GLOW = new THREE.Color('#ffb347').multiplyScalar(0.35)
/**
 * A stick of charcoal dropped on the heap: a dull, dry clatter, not a ring. A woody knock (noise through a mid band, gone in a few hundredths of
 * a second), a little rattle of smaller knocks after it as it settles against the others, a soft low thump under them. Several thrown at once
 * don't all sound: one in each little while.
 */
let coalAudio: AudioContext | null = null
let coalLast = 0
function coalClink(strength: number) {
  try {
    const now = performance.now()
    if (now - coalLast < 45) return
    coalLast = now
    coalAudio ??= new AudioContext()
    const ac = coalAudio
    const t0 = ac.currentTime
    const out = ac.createGain()
    out.gain.value = 0.5 * strength
    out.connect(ac.destination)
    const knock = (t: number, gain: number, freq: number, len: number) => {
      const n = Math.max(1, Math.floor(ac.sampleRate * len))
      const buf = ac.createBuffer(1, n, ac.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.18))
      const src = ac.createBufferSource()
      src.buffer = buf
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = freq
      bp.Q.value = 1.6
      const g = ac.createGain()
      g.gain.value = gain
      src.connect(bp).connect(g).connect(out)
      src.start(t)
    }
    // (the strike, then two or three smaller ones as it tips and settles)
    knock(t0, 1, 1100 + Math.random() * 500, 0.035)
    const rattles = 1 + Math.floor(Math.random() * 3 * strength)
    let t = t0
    for (let i = 0; i < rattles; i++) {
      t += 0.025 + Math.random() * 0.05
      knock(t, 0.35 + Math.random() * 0.3, 1400 + Math.random() * 900, 0.02)
    }
    // (the soft thump of its weight)
    const o = ac.createOscillator()
    const og = ac.createGain()
    o.frequency.setValueAtTime(170, t0)
    o.frequency.exponentialRampToValueAtTime(80, t0 + 0.05)
    og.gain.setValueAtTime(0.25, t0)
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
    o.connect(og).connect(out)
    o.start(t0)
    o.stop(t0 + 0.08)
  } catch { /* (no sound to be had) */ }
}

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
/** what a container on the table is called, and what can be done with it (by its key: plate-0, box, bin, tray...) */
const CONTAINER_TIP = (key: string) => {
  const kind = key.split('-')[0]
  const name = ({ plate: '餐盤', dish: '小碟', basket: '竹籃', box: '調味盒', bin: '水桶', tray: '大砧板', trash: '廚餘桶', rawdish: '生食碟', lantern: '行燈', bowl: '試吃碗' } as Record<string, string>)[kind] ?? '擺設'
  return { title: name, hint: '拖曳移動' }
}
/** where the tasting bowl stands on the table (a spot clear of the fire, the tray and the plates) */
const BOWL_TOP: [number, number, number] = [1.95, 0, 1.0]
const BOWL_R = 0.52
/** something on the table drawn only while `holds` says it holds something (a plate, a side dish: brought from the dish cabinet when it's
 * wanted), looked at every frame, drawn again only when that changes */
function WhenHeld({ holds, children }: { holds: () => boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(false)
  useFrame(() => { const h = holds(); if (h !== on) setOn(h) })
  return on ? <>{children}</> : null
}
/** how much room the bowl takes when the table's pieces are pushed clear of each other (less than it is: it sits among them) */
const BOWL_PUSH = 0.3
/** the bowl's rim above its foot: what's laid across it rests at this height */
const BOWL_RIM = 0.15
/** the table's pieces that edit mode moves by their nudge (the cutting board, the seasoning ledge, the water bucket, the basket, the tasting
 * bowl, the scraps bin, the rice balls' dish: the owner's, every one a piece of its own): the edit id of each */
const EDIT_PIECES: Record<string, string> = { tray: 'cutboard', box: 'seasoning', bin: 'bucket', 'basket-0': 'basket', 'bowl-0': 'tastebowl', trash: 'trash', rawdish: 'ricedish' }
/** whether the table's pieces (the plates, the seasoning box, the cutting board, the bowl...) can be dragged about by hand: not any more, they
 * stay where they're set (the owner moves them in developer mode); only the food, the tools and the charcoal are picked up */
const DRAG_PIECES = false
/** where the plates past the first start on the table's top, round the fire (the first is in the cubby under it) */
const PLATE_TOP: [number, number, number] = [1.45, 0.02, -1.24]
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

const TrashBin = memo(TrashBinImpl, sameProps)
function TrashBinImpl({ position, container, contents = 0 }: { position: [number, number, number]; container: string; contents?: number }) {
  const R = TRASH_R
  // a Japanese waste basket (屑籠): split bamboo woven in a twill (網代編み) round a slightly flaring body, its rim
  // and foot bound in dark rattan, a strip of washi on the front with ごみ brushed on it; open-topped, so the
  // woven inside shows
  const body = useMemo(() => {
    const g = new THREE.CylinderGeometry(R * 1.04, R * 0.86, TRASH_H, 24, 1, true)
    g.translate(0, TRASH_H / 2, 0)
    return g
  }, [R])
  const inner = useMemo(() => {
    const g = new THREE.CylinderGeometry(R * 0.99, R * 0.82, TRASH_H - 0.02, 24, 1, true)
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
  // (the heap one mesh, each thing's colour carried by its vertices, in the order they go in: as many drawn as are in (its draw range), one
  // draw where there were two dozen)
  const heapGeo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const ends: number[] = []
    let n = 0
    heap.forEach((h, i) => {
      const y = level(i + 1) - 0.02
      const src = h.kind === 'stick' ? new THREE.CylinderGeometry(0.005, 0.004, 0.32, 5) : h.geo!
      const g = src.index ? src.toNonIndexed() : src.clone()
      if (src !== h.geo) src.dispose()
      const rot = h.kind === 'stick' ? new THREE.Euler(h.tilt, h.rot[1], h.tilt * 0.6) : new THREE.Euler(...h.rot)
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(h.x, h.kind === 'stick' ? y + 0.08 : y, h.z), new THREE.Quaternion().setFromEuler(rot),
        new THREE.Vector3(1, 1, 1)))
      g.deleteAttribute('uv')
      colourVertices(g, new THREE.Color(h.kind === 'stick' ? '#c9a46a' : h.kind === 'paper' ? h.shade : '#2a1d14'))
      parts.push(g)
      ends.push(n += g.attributes.position.count)
    })
    const geo = mergeGeometries(parts)!
    for (const g of parts) g.dispose()
    return { geo, ends }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heap])
  useEffect(() => () => heapGeo.geo.dispose(), [heapGeo])
  heapGeo.geo.setDrawRange(0, shown ? heapGeo.ends[shown - 1] : 0)
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
        <torusGeometry args={[R * 1.04, 0.016, 6, 24]} />
        <meshToonMaterial color="#4a2e18" map={RATTAN} />
      </mesh>
      <mesh position-y={TRASH_H * 0.82} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 1.01, 0.007, 5, 24]} />
        <meshToonMaterial color="#5a3820" />
      </mesh>
      <mesh position-y={0.014} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R * 0.87, 0.014, 6, 24]} />
        <meshToonMaterial color="#4a2e18" map={RATTAN} />
      </mesh>
      {/* the washi strip with ごみ */}
      <mesh position={[LAY_DIR.x * fr * 0.97, TRASH_H * 0.48, LAY_DIR.z * fr * 0.97]} rotation-y={face}>
        <planeGeometry args={[0.09, 0.17]} />
        <meshToonMaterial map={TRASH_LABEL} />
      </mesh>
      <mesh geometry={heapGeo.geo} visible={shown > 0}>
        <meshToonMaterial vertexColors />
      </mesh>
    </group>
  )
}

/** the tray for raw food waiting to go on the fire: a row of sticks across it, a few more laid in the gaps on top; loose food in a row along
 * its back. It holds no more than that: the rest wait in the fridge until there's room, brought out as the tray's cleared */
const TRAY_ROWS = 5
const TRAY_CAP = TRAY_ROWS * 2 - 1
const LOOSE_CAP = 7
const TRAY_W = 1.6
const TRAY_D = 0.9
/** the seasoning box, as a round footprint for bumping into things */
const BOX_R = 0.46
/** where the seasoning ledge (blender/grilledfish.py: its middle) is hung: on the hearth's front face, over the cook's place in the notch
 * (along as the notch's middle; out from the frame's face by half the ledge's depth) */
const BOX_SPOT = { along: -0.04, lay: 1.222 + 0.1 }
/** the ledge's length, and the fan's peg at the end of the hook past its left end: how far along from the ledge's middle and how high above it
 * (blender/grilledfish.py: LEDGE_L, the hook's arm 0.2 past the end at 0.985 high, the ledge's middle at 0.19) */
const LEDGE_L = 1.62
const FAN_PEG = { along: -LEDGE_L / 2 + 0.045, up: 0.365 - 0.19 }
/** the fan hung on its peg: its paper's middle this far below the peg (its handle's length, 1.6 times its own, and the loop) */
const FAN_DROP = -0.4
/** the containers that stay where they're set, whatever's beside them: the ledge, fixed to the hearth */
const FIXED = new Set(['box'])
/** how many of the floating 美味 words can be up at once, and where an unused place waits */
const POP_SLOTS = 8
const POP_AWAY: [number, number, number] = [0, -50, 0]
/** how much bigger the fire pit (its ground and stones) is drawn than modelled */
const PIT_SCALE = 1.3
/**
 * The pit's ground texture is white salt inside and brown earth out to a fading rim: the earth is kept, but darkened and
 * browned further out like ground scorched by heat, and the disc drawn a little smaller (PIT_GROUND).
 */
const PIT_GROUND = 0.9
function scorchEarth(mesh: THREE.Mesh) {
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
      const i = (y * c.width + x) * 4
      // (the salt fills the ring right out under the stones, pure salt to r = 0.58 whatever tone the model's earth had; past it the earth goes
      // darker and redder-brown toward the rim, the way fired ground does, multiplied in as a stain, and never over the salt)
      const k = Math.min(1, Math.max(0, (r - 0.66) / 0.3))
      const grainS = 0.84 + 0.16 * ((px.data[i] + px.data[i + 1] + px.data[i + 2]) / 765)
      const saltness = 1 - Math.min(1, Math.max(0, (r - 0.58) / 0.08))
      const mul = 1 - k
      const er = px.data[i] * (mul + k * (px.data[i] / 255) * 0.75), eg = px.data[i + 1] * (mul + k * (px.data[i + 1] / 255) * 0.65), eb = px.data[i + 2] * (mul + k * (px.data[i + 2] / 255) * 0.6)
      px.data[i] = er + (236 * grainS - er) * saltness
      px.data[i + 1] = eg + (231 * grainS - eg) * saltness
      px.data[i + 2] = eb + (220 * grainS - eb) * saltness
      const edge = Math.min(1, Math.max(0, (r - 0.7) / 0.28))
      // (powdery: the ring's alpha grained with fine noise, thinning to scattered specks at its edge, not a hard disc)
      const grain = 0.55 + 0.9 * Math.random()
      px.data[i + 3] *= r < 0.66 ? 1 : Math.min(1, (1 - 0.3 * k) * (1 - edge * edge * (3 - 2 * edge)) * (edge > 0.2 ? grain : 1))
    }
  }
  g.putImageData(px, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.flipY = mat.map!.flipY
  t.colorSpace = mat.map!.colorSpace
  t.anisotropy = mat.map!.anisotropy
  mat.map = t
  mat.transparent = true
  // (the ground is drawn first and writes its depth, so the scene's shadow-only floor, which sits a hair under it, can never be drawn over the
  // salt from any angle: that was the net's and the coals' shadows laid across it as stripes)
  mat.depthWrite = true
  mat.alphaTest = 0.06
  mesh.renderOrder = -2
  mat.needsUpdate = true
}
/** the soft orange pool of light a heap of embers throws on what's round it: a radial gradient, drawn once */
const EMBER_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,140,50,0.9)'); gr.addColorStop(0.4, 'rgba(255,90,20,0.35)'); gr.addColorStop(1, 'rgba(255,60,10,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()
/**
 * The bed of ash between and under the sticks: grey granular clumps (blender/binchotan.py's BinAsh), lying flat on the salt (none on a point,
 * none in the air), some with a faint red in them while the fire's up (what's left of burnt sticks: not a blaze), and a pool of orange light on
 * the salt.
 */
const EmberBed = memo(EmberBedImpl)
function EmberBedImpl({ fuel }: { fuel: { current: number } }) {
  const lumps = useMemo(() => {
    let seed = 23
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const groups: { m: THREE.Matrix4[]; k: number }[] = [{ m: [], k: 0.35 }, { m: [], k: 0.12 }, { m: [], k: 0 }]
    // (fine and many, flatter, crumbled, heaped more toward the middle where the sticks burn down)
    for (let i = 0; i < 132; i++) {
      const a = rnd() * Math.PI * 2, r = 0.33 * rnd() ** 0.9
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.45 + rnd() * 0.85
      // (lying flat, only turned about the vertical, its flat underside a hair into the salt so no gap shows under it)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28)
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, surfaceY(x, z, PIT_LIFT) - 0.002, z), q, new THREE.Vector3(s * (0.85 + rnd() * 0.5), s * (0.35 + rnd() * 0.4), s * (0.85 + rnd() * 0.5)))
      groups[i % 3].m.push(m)
    }
    return groups
  }, [])
  const bin = useBinchotan()
  // (three greys: pale, ashen, and a darker one of half-burnt bits)
  const mats = useMemo(() => lumps.map((_, i) => { const m = ashMaterial(bin); m.emissive.set('#a8280a'); m.color.multiplyScalar([1.15, 0.9, 0.62][i]); return m }), [lumps, bin])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const pool = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => {
    lumps.forEach((gr, i) => { const im = refs.current[i]; if (im) { gr.m.forEach((m, j) => im.setMatrixAt(j, m)); im.instanceMatrix.needsUpdate = true } })
  }, [lumps])
  // (each lump set down on the salt as it's actually modelled (the fire pit's mesh, measured once it's there): a height map of its top in
  // the bed's own frame, every lump's foot put on it, so none floats over the salt or sinks out of sight)
  const settled = useRef(false)
  useFrame(({ scene }) => {
    if (settled.current) return
    const pit = scene.getObjectByName('FirePit') as THREE.Mesh | undefined
    const im0 = refs.current[0]
    if (!pit?.geometry || !im0) return
    settled.current = true
    const toLocal = im0.parent!.matrixWorld.clone().invert()
    const N = 48, R = 0.4, top = new Float32Array(N * N).fill(-Infinity)
    const pa = pit.geometry.attributes.position, v = new THREE.Vector3()
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(pit.matrixWorld).applyMatrix4(toLocal)
      const gx = Math.floor((v.x + R) / (2 * R) * N), gz = Math.floor((v.z + R) / (2 * R) * N)
      if (gx >= 0 && gz >= 0 && gx < N && gz < N) top[gz * N + gx] = Math.max(top[gz * N + gx], v.y)
    }
    const at = (x: number, z: number) => {
      const gx = Math.floor((x + R) / (2 * R) * N), gz = Math.floor((z + R) / (2 * R) * N)
      let h = -Infinity
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const k = (gz + dz) * N + gx + dx; if (k >= 0 && k < top.length) h = Math.max(h, top[k]) }
      return h
    }
    // (the salt's own level, the commonest height under the lumps: none set up on the rim's stones or the grate's feet, held to the salt)
    const hs = lumps.flatMap((gr) => gr.m.map((m) => at(m.elements[12], m.elements[14]))).filter(Number.isFinite).sort((a, b) => a - b)
    const salt = hs[hs.length >> 1] ?? 0
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
    lumps.forEach((gr, i) => {
      const im = refs.current[i]
      if (!im) return
      gr.m.forEach((m, j) => {
        m.decompose(p, q, sc)
        const h = Math.min(at(p.x, p.z), salt + 0.012)
        if (Number.isFinite(h)) { p.y = h - 0.003; m.compose(p, q, sc); im.setMatrixAt(j, m) }
      })
      im.instanceMatrix.needsUpdate = true
    })
  })
  useFrame(({ clock }) => {
    const f = Math.max(0, fuel.current), t = clock.elapsedTime
    mats.forEach((m, i) => {
      const flick = 0.85 + 0.15 * Math.sin(t * (2.1 + i) + i * 1.7)
      // (ash of what's burnt through: at most a faint red in it while the fire's up)
      m.emissiveIntensity = lumps[i].k * Math.min(1.2, f) * flick
    })
    if (pool.current) {
      pool.current.visible = f > 0.03
      ;(pool.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, 0.75 * Math.min(1.2, f) ** 1.2) * (0.9 + 0.1 * Math.sin(t * 3.1))
    }
  })
  return (
    <>
      {lumps.map((gr, i) => <instancedMesh key={i} ref={(m) => { refs.current[i] = m }} args={[bin.ash(i * 2), mats[i], gr.m.length]} frustumCulled={false} receiveShadow />)}
      <mesh ref={pool} position-y={surfaceY(0, 0, PIT_LIFT) + 0.03} rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={EMBER_GLOW} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  )
}
/** the most sticks of charcoal the bed holds at once, and how long one lasts once it's burning, in game seconds (it burns down to a third of its length, then it's ash) */
const UP_AXIS = new THREE.Vector3(0, 1, 0)
const COAL_LAST_S = 300
/** how long a fresh stick of charcoal takes to kindle to red-hot, in game seconds */
const COAL_KINDLE_S = 22
/** how much higher the salt is heaped in the pit than it was modelled */
const PIT_SALT_RISE = 2.4
/** how much higher the pit (its stones, coals and net) stands than it was modelled, with the flames and smoke over it */
export const PIT_LIFT = 0
const PIT_PARTS = /^(FirePit|Stone|Robuchi|Charcoal|BinchotanHeap)/
/** the stone ring's outer edge: nothing can be pushed into the fire */
const RING_CLEAR = 1.15 * PIT_SCALE
/** the square hearth's frame (炉縁, blender/grilledfish.py IRORI_IN + IRORI_W), its outer half-width as drawn: square to the table, along
 * ALONG and LAY; nothing is set down on it or inside it (sized so the table's front row of plates, bowls and the board stand clear of it) */
const HEARTH_HALF = (0.8 + 0.13) * PIT_SCALE
/** the hearth a little longer along the table than across it (an oblong 囲炉裏): its frame and bed stretched this much along */
const HEARTH_LONG = 1.15
/** a thing at `at` (from the fire's middle) of reach `r`, or a w x d board turned to the table, moved out of the square hearth the short way */
function clearOfHearth(at: THREE.Vector3, r: number, w = 0, d = 0) {
  for (let k = 0; k < 2; k++) {
    const u = at.dot(ALONG), v = at.dot(LAY)
    const hu = HEARTH_HALF * HEARTH_LONG + r + w / 2, hv = HEARTH_HALF + r + d / 2
    if (Math.abs(u) < hu && Math.abs(v) < hv) {
      if (hu - Math.abs(u) < hv - Math.abs(v)) at.addScaledVector(ALONG, Math.sign(u || 1) * hu - u)
      else at.addScaledVector(LAY, Math.sign(v || 1) * hv - v)
    }
    // (nor over the notch cut into the table's front: moved along to its nearer side, where there's table under it)
    const a = at.dot(ALONG) + FIRE_SHIFT.dot(ALONG), l = at.dot(LAY) + FIRE_SHIFT.dot(LAY)
    const [n0, n1] = COOK_NOTCH.along, ha = r + w / 2
    if (l + r + d / 2 > COOK_NOTCH.lay[0] && a + ha > n0 && a - ha < n1) at.addScaledVector(ALONG, a - n0 < n1 - a ? n0 - ha - a : n1 + ha - a)
  }
}

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
function BarImpl() {
  // (where the second counter butts against the first, the first's lip stops short of it, so nothing runs through)
  // (and a way through for the staff at the outer end of each: the first counter's far end by the till, the side
  // counter's near end)
  // (and one top over both, in one piece round the corner, its edges rounded and flush where they meet)
  return (
    <group position={GRILL_OFFSET} scale={GRILL_SCALE}>
      <StaticBatch plain>
        {GRILL_COUNTERS.map((c, i) => <BarCounter key={i} c={c} first={GRILL_COUNTERS.slice(0, i).reduce((s, x) => s + x.seats, 0)}
          trim={i === 0 && GRILL_COUNTERS.length > 1 ? 0.62 : 0} butt={i > 0}
          gate={BAR_GATES[i]} noTop={GRILL_COUNTERS.length > 1} />)}
        {GRILL_COUNTERS.length > 1 && <BarTop />}
      </StaticBatch>
      {GRILL_COUNTERS.map((c, i) => BAR_GATES[i] && <BarGate key={i} c={c} gate={BAR_GATES[i]} />)}
      {GRILL_COUNTERS.map((c, i) => <BarDrawers key={`drawers-${i}`} c={c} first={GRILL_COUNTERS.slice(0, i).reduce((s, x) => s + x.seats, 0)} />)}
      <BarChopsticks />
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
/** the cooks the boss's height (BOSS_SCALE, his figure 0.95 tall; theirs 0.97) */
const CHEF_SCALE = 1.05 * 0.8 * GRILL_SCALE * 0.98
/** the table as boxes (lay from–to, along from–to): all of it behind the cubby, and the front either side of it */
/** (and the notch's: its back wall, and the wall between it and the cubby) */
const COOK_TABLE_PARTS: [number, number, number, number][] = [
  [COOK_TABLE.lay[0], CUBBY.lay[0], COOK_TABLE.along[0], COOK_TABLE.along[1]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], COOK_TABLE.along[0], CUBBY2.along[0]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], CUBBY2.along[1], COOK_NOTCH.along[0]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], CUBBY.along[1], COOK_TABLE.along[1]],
  [CUBBY.lay[0], COOK_NOTCH.lay[0], COOK_NOTCH.along[0], COOK_NOTCH.along[1]],
  [CUBBY.lay[0], COOK_TABLE.lay[1], COOK_NOTCH.along[1], CUBBY.along[0]],
]
export type CrewMember = { id: string; role: Role; look: Look }
/** the shop's own head chef, at the grill while the shop's open when no chef's been hired (the kitchen cooks by itself: someone has to
 * fetch each order and bring it to the board) */
const HOUSE_CHEF: CrewMember = { id: 'house-chef', role: 'chef', look: { female: false, age: 'middle' } }
/**
 * Where each of the staff stands while the shop's open (the owner is the player, so isn't drawn): the second cook at
 * the fire in the bay cut into the cook's table, the third cook and the stock keeper at its right-hand end, facing in
 * along it; the cashier behind the till by the door; one server at
 * the near end of the bar by the till, the other at the dead end of the side counter's aisle (both out of the way the
 * customers walk). The first two of each job are shown.
 */
const KITCHEN_YAW = Math.atan2(-ALONG.x, -ALONG.z)
const kitchenAt = (lay: number) => new THREE.Vector3().addScaledVector(LAY, lay).addScaledVector(ALONG, 3.55).setY(GRILL_OFFSET.y - KITCHEN_DROP)
/** a place in the bar's plan (the first counter's frame) as the crew stand (Roasting's frame: the fire FIRE_SHIFT along from the bar's), and back */
const fromBar = (v: THREE.Vector3) => toGrillScene(v).sub(FIRE_SHIFT)
const toBar = (v: THREE.Vector3) => v.clone().add(FIRE_SHIFT).sub(GRILL_OFFSET).divideScalar(GRILL_SCALE)
/** the floor under a place (Roasting's frame): the kitchen's raised floor, or the customers' */
const floorAt = (v: THREE.Vector3) => (inKitchen(GRILL_COUNTERS, toBar(v)) ? GRILL_OFFSET.y - KITCHEN_DROP : GRILL_OFFSET.y)
/**
 * The crew's way home once the shop's shut and empty (Roasting's frame), each from their place: past the table's end (between it and the
 * rice tub) to the gate by the till, through it and out of the front door; the cook first out of his notch, along the table's front;
 * the cashier along behind the till to the gate.
 */
function crewWayOut(role: Role, at: THREE.Vector3) {
  const end = (lay: number) => new THREE.Vector3().addScaledVector(ALONG, 2.95).addScaledVector(LAY, lay)
  const via = role === 'chef' ? [end(2.62), end(-0.8)] : role === 'sous' ? [end(1.3), end(-0.8)]
    : role === 'cashier' ? [new THREE.Vector3().addScaledVector(ALONG, 5.35).addScaledVector(LAY, -0.3)] : []
  return [at.clone(), ...via, ...staffWayOut(GRILL_COUNTERS).map(fromBar)].map((v) => v.setY(floorAt(v)))
}
/**
 * One of the staff at their place; once the shop's shut and empty (SHOP.leaving) they walk their way out (`way`, from wherever they are)
 * and are gone. `seat`: the name of an unseen mark in the scene they sit on instead, facing its -z (the cashier's chair: it can be moved).
 */
/**
 * The head chef's round with the orders (game/chefFlow): what's being fetched (their pieces' keys), from where, and how far it's got; the
 * chef's CrewWalk walks it (and notes where his hands are, for what he carries), Roasting starts each trip and takes what he brings back
 * onto the board. `seenAt`: when a chef last walked it (with nobody drawn to, orders come out onto the board as they used to).
 */
export const CHEF_TRIP = {
  phase: 'idle' as ChefPhase, store: 'freezer' as Store, keys: [] as string[], t: 0, seenAt: -1e9, fanUntil: 0,
  /** where he stands to take it out, and what he faces there (Roasting's frame) */
  spot: new THREE.Vector3(), face: new THREE.Vector3(),
  /** where what he carries is held, in the world */
  hand: new THREE.Vector3(),
}
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __chefTrip?: typeof CHEF_TRIP }).__chefTrip = CHEF_TRIP
/** how long what he's brought is prepared on the board: a rice ball shaped in his hands (game/rice's SHAPE_S), else salted, scored, skewered */
const prepOf = (store: Store) => (store === 'ricetub' ? SHAPE_S : PREP_S)
/**
 * What the head chef has in his hands (the owner's: nothing flies across the kitchen by itself): a piece taken off the board to the fire,
 * or off the fire to the plating place. Its steps: reaching for it where it is, carrying it in his hands as he turns and steps to where
 * it's going, setting it there leaning in (the skewer pushed into the ash, or laid on the plate), and back to his place. Roasting moves the
 * piece and says where he stands and how far he leans (its frame); his CrewWalk stands him there and says where his hands are.
 */
export const CHEF_CARRY = {
  key: null as string | null, kind: 'toFire' as 'toFire' | 'toPlate', phase: 'idle' as 'idle' | 'reach' | 'carry' | 'place' | 'back', t: 0,
  from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), heldQ: new THREE.Quaternion(),
  stand: new THREE.Vector3(), face: new THREE.Vector3(), lean: 0, hold: false,
}
/** each step's seconds: reaching, carrying (a turn and a step or two), setting it down, back */
const CARRY_S = { reach: 0.3, carry: 0.5, place: 0.35, back: 0.3, idle: 0 }
/** how far he steps from his place toward what he's at (he's in the notch: the fire's right before him), and how far he leans setting it */
const CARRY_STEP = 0.08, CARRY_LEAN = 0.26
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __chefCarry?: typeof CHEF_CARRY }).__chefCarry = CHEF_CARRY
/** the Movable each store is, to find where it's been put (the cubby has none: it's the cook table's) */
const STORE_PIECE: Record<Exclude<Store, 'cubby'>, string> = { freezer: 'freezer', ricetub: 'ricetub', sacks: 'produce' }
/**
 * Where the chef stands to take something out of a store (Roasting's frame): before the fridge under the cook table on the left, its
 * doors' swing clear; else just off the side of the store (as it stands, wherever it's been moved) nearest his place, facing it.
 */
function storeSpot(store: Store, scene: THREE.Object3D, frame: THREE.Object3D, home: THREE.Vector3) {
  if (store === 'cubby') {
    const face = new THREE.Vector3().addScaledVector(ALONG, (CUBBY2.along[0] + CUBBY2.along[1]) / 2).addScaledVector(LAY, COOK_TABLE.lay[1] - 0.11).sub(FIRE_SHIFT)
    const spot = face.clone().addScaledVector(LAY, 0.95)
    return { spot: spot.setY(floorAt(spot)), face }
  }
  let piece: THREE.Object3D | undefined
  scene.traverse((o) => { if (!piece && o.userData.editId === STORE_PIECE[store]) piece = o })
  if (!piece) return null
  // (its box in the chef's frame, from the corners of its box in the world)
  const wb = new THREE.Box3().setFromObject(piece)
  if (wb.isEmpty()) return null
  const inv = frame.matrixWorld.clone().invert(), lb = new THREE.Box3()
  for (let i = 0; i < 8; i++) lb.expandByPoint(new THREE.Vector3(i & 1 ? wb.max.x : wb.min.x, i & 2 ? wb.max.y : wb.min.y, i & 4 ? wb.max.z : wb.min.z).applyMatrix4(inv))
  const face = lb.getCenter(new THREE.Vector3()), half = lb.getSize(new THREE.Vector3()).multiplyScalar(0.5)
  const d = home.clone().sub(face).setY(0)
  if (d.lengthSq() < 1e-6) d.set(1, 0, 0)
  d.normalize()
  const out = Math.min(Math.abs(d.x) > 1e-4 ? half.x / Math.abs(d.x) : 1e9, Math.abs(d.z) > 1e-4 ? half.z / Math.abs(d.z) : 1e9)
  const spot = face.clone().addScaledVector(d, out + 0.45)
  return { spot: spot.setY(floorAt(spot)), face }
}
/** the chef's way from his place to a spot (Roasting's frame): straight back out of the notch onto the aisle, then round all that stands on
 * the kitchen floor (GuestBar3D's route) */
function chefWay(home: THREE.Vector3, to: THREE.Vector3) {
  const out = home.clone().sub(new THREE.Vector3().addScaledVector(LAY, home.dot(LAY))).addScaledVector(LAY, WALK_LAY)
  out.setY(floorAt(out))
  const across = KITCHEN_ROUTE.route ? KITCHEN_ROUTE.route(toBar(out), toBar(to)) : null
  const mid = across ? across.slice(1, -1).map(fromBar).map((v) => v.setY(floorAt(v))) : []
  return [home.clone(), out, ...mid, to.clone()]
}
function CrewWalk({ id, role, at, yaw, way, seat, round, fetcher, children }: { id: string; role: Role; at: THREE.Vector3; yaw: number; way: THREE.Vector3[]; seat?: string; round?: boolean
  fetcher?: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const trip = useRef<{ way: THREE.Vector3[]; len: number; gone: number } | null>(null)
  /** the head chef's round (fetcher): walking to a store or back, taking it out there, preparing it at his place; whether he's away */
  const walkTrip = (o: THREE.Group, dt: number) => {
    const T = CHEF_TRIP
    T.seenAt = performance.now()
    o.userData.fetcher = true
    // (carrying a piece between the board, the fire and the plating place: stood where the carry has him, turned to it, leaning)
    const C = CHEF_CARRY
    o.userData.lean = C.phase === 'idle' ? 0 : C.lean
    if (C.phase !== 'idle' && (T.phase === 'idle' || T.phase === 'prepping')) {
      o.position.lerp(C.stand.clone().setY(at.y), Math.min(1, dt * 12))
      const want = Math.atan2(C.face.x - o.position.x, C.face.z - o.position.z)
      o.rotation.y += Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y)) * Math.min(1, dt * 10)
      o.userData.carry = C.hold
      o.userData.prep = false
      o.userData.fanNow = false
      o.updateMatrixWorld()
      T.hand.set(...TRAY_AT).applyMatrix4(o.matrixWorld)
      return true
    }
    o.userData.carry = T.phase === 'toBoard' || (T.phase === 'taking' && T.t > TAKE_S * 0.5)
    o.userData.prep = T.phase === 'prepping'
    o.userData.fanNow = performance.now() < T.fanUntil
    const hand = () => { o.updateMatrixWorld(); T.hand.set(...TRAY_AT).applyMatrix4(o.matrixWorld) }
    if (T.phase === 'toStore' || T.phase === 'toBoard') {
      if (!trip.current) {
        let w: THREE.Vector3[]
        if (T.phase === 'toStore') {
          const s = o.parent ? storeSpot(T.store, scene, o.parent, at) : null
          // (nowhere to be found: he brings it from where it was, at once)
          if (!s) { T.phase = 'prepping'; T.t = 0; return false }
          T.spot.copy(s.spot); T.face.copy(s.face)
          w = chefWay(at, T.spot)
        } else w = chefWay(at, T.spot).reverse()
        trip.current = { way: w, len: pathLength(w), gone: 0 }
      }
      const w = trip.current
      w.gone = Math.min(w.len, w.gone + dt * CHEF_PACE)
      const { p, dir } = alongPath(w.way, w.gone)
      o.position.copy(p)
      if (dir.x || dir.z) o.rotation.y = Math.atan2(dir.x, dir.z)
      if (w.gone >= w.len) {
        trip.current = null
        T.t = 0
        if (T.phase === 'toStore') {
          // (the lid lifted, the doors opened part way, as he reaches in)
          if (T.store === 'freezer') FRIDGE_KICK.at = performance.now()
          else if (T.store === 'cubby') CUBBY_KICK.left = performance.now()
        } else { o.position.copy(at); o.rotation.y = yaw }
        T.phase = afterPhase(T.phase)
      }
      hand()
      return T.phase !== 'prepping'
    }
    if (T.phase === 'taking') {
      o.position.copy(T.spot)
      o.rotation.y = Math.atan2(T.face.x - T.spot.x, T.face.z - T.spot.z)
      T.t += dt
      if (T.t >= TAKE_S) {
        // (a rice ball's rice out of the tub, for each one he's bringing (game/rice))
        if (T.store === 'ricetub') for (let i = 0; i < T.keys.length; i++) RICE.tub = takeRice(RICE.tub)
        T.phase = afterPhase(T.phase); T.t = 0
      }
      hand()
      return true
    }
    if (T.phase === 'prepping') {
      T.t += dt
      if (T.t >= prepOf(T.store)) { T.phase = afterPhase(T.phase); T.t = 0 }
    }
    return false
  }
  const gone = useRef(0)
  const path = useRef<{ way: THREE.Vector3[]; len: number } | null>(null)
  const scene = useThree((s) => s.scene)
  const mark = useRef<THREE.Object3D | null>(null)
  // (their walk home as the shop shuts, or in as it opens (game/commute, commuteWalk); whether they've come in yet today)
  const commute = useRef<Trip | null>(null)
  const arrived = useRef(false)
  useEffect(() => {
    const o = g.current
    if (!o) return
    KITCHEN_FOLK.add(o)
    return () => { KITCHEN_FOLK.delete(o); SHOP.walking.delete(id); COMMUTERS.delete(id) }
  }, [id])
  /**
   * Their way out from a place (this frame, on the floor), through the door and a step past it: a cook across the kitchen round all that
   * stands on its floor (GuestBar3D's route) to the gate, the cashier along behind the till; home through the front door; a cook who lives
   * upstairs (game/commute) from the gate across the aisle to the staff door and up the stair behind it.
   */
  const wayOf = (from: THREE.Vector3, o: THREE.Group) => {
    const out = staffWayOut(GRILL_COUNTERS)
    const across = round && KITCHEN_ROUTE.route ? KITCHEN_ROUTE.route(toBar(from), out[0]) : null
    const toGate = across ? [from, ...across.slice(1).map(fromBar)] : null
    const floor = (v: THREE.Vector3) => v.setY(floorAt(v))
    const sd = commuteOf(role) === 'dorm' && o.parent ? scene.getObjectByName('staff-door') : undefined
    if (sd && o.parent) {
      sd.updateWorldMatrix(true, false)
      const dW = sd.getWorldPosition(new THREE.Vector3()), room = sd.localToWorld(new THREE.Vector3(-1, 0, 0)).sub(dW).setY(0).normalize()
      const here = (v: THREE.Vector3) => floor(o.parent!.worldToLocal(v))
      const head = toGate ?? [from, ...way.slice(1, -2)]
      return [...head.map((v, i) => (i ? floor(v) : v)), floor(fromBar(out[1])), here(dW.clone().addScaledVector(room, 0.75)), here(dW.clone()),
        here(dW.clone().addScaledVector(room, -0.6))]
    }
    const w = (toGate ? [...toGate, ...out.slice(1).map(fromBar)] : [from, ...way.slice(1)]).map((v, i) => (i ? floor(v) : v))
    return [...w, floor(through(w[w.length - 2], w[w.length - 1], 0.55))]
  }
  /** a step along their walk: where they stand and face, how much of them shows, their stretch and nod; the stair's door slid open
   * for them as they near it; whether it's done */
  const stepCommute = (o: THREE.Group, dt: number) => {
    const tr = commute.current!
    const pose = tripStep(tr, Math.min(dt, 0.1), 1.6, (v) => (o.parent ? o.parent.localToWorld(v.clone()) : v.clone()))
    o.position.copy(pose.p)
    if (pose.yaw !== null) o.rotation.y = pose.yaw
    o.visible = pose.shown
    o.userData.fade = pose.vis
    o.userData.nod = pose.nod
    o.userData.stretch = pose.stretch
    if (commuteOf(role) === 'dorm' && tr.len - tr.d < 1.6 && tr.t > tr.wait) STAFF_DOOR_HOLD.until = performance.now() + 1500
    if (tr.done) { o.userData.fade = 1; o.userData.nod = 0; o.userData.stretch = false }
    return tr.done
  }
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (!SHOP.leaving) {
      gone.current = 0
      path.current = null
      // (off fetching plates for the plating place: GuestBar3D walks them meanwhile)
      o.visible = PLATER_OUT.id !== id
      // (coming in as the shop opens: in at the front door, or down the stair through the staff door, each at their own moment; unseen
      // before it)
      if (!arrived.current) {
        if (!commute.current || commute.current.dir !== 'in') {
          const w = performance.now() - SHOP.openedAt < 4000 ? wayOf(at.clone(), o) : null
          if (w && w.length > 2) commute.current = makeTrip(id, 'in', w.reverse(), delayOf(id, SHOP.day + 0.5) * 0.8, paceOf(id))
          else arrived.current = true
        }
        if (!arrived.current) {
          if (!stepCommute(o, dt)) return
          commute.current = null
          arrived.current = true
        }
      }
      if (fetcher && o.visible && walkTrip(o, Math.min(dt, 0.1))) return
      if (seat && o.parent) {
        if (!mark.current?.parent) mark.current = scene.getObjectByName(seat) ?? null
        const m = mark.current
        if (m) {
          const inv = o.parent.matrixWorld.clone().invert()
          o.position.setFromMatrixPosition(m.matrixWorld).applyMatrix4(inv)
          const dir = new THREE.Vector3(0, 0, -1).transformDirection(m.matrixWorld).transformDirection(inv)
          o.rotation.y = Math.atan2(dir.x, dir.z)
          return
        }
      }
      o.position.copy(at)
      o.rotation.y = yaw
      return
    }
    // (on their way: from where they are, down off a seat onto the floor, finishing up first, then home or upstairs)
    if (fetcher) { CHEF_TRIP.phase = 'idle'; CHEF_TRIP.keys = []; trip.current = null; o.userData.carry = o.userData.prep = false }
    if (!commute.current || commute.current.dir !== 'out') {
      commute.current = makeTrip(id, 'out', wayOf(o.position.clone().setY(way[0].y), o), delayOf(id, SHOP.day), paceOf(id))
      SHOP.walking.add(id)
    }
    if (stepCommute(o, dt)) SHOP.walking.delete(id)
  })
  return <group ref={g} name={`crew-${id}`} userData={{ staffId: id }} position={at} rotation-y={yaw} scale={CHEF_SCALE}>{children}</group>
}
function crewPlaces(crew: CrewMember[]) {
  const c0 = GRILL_COUNTERS[0]
  const onFloor = (v: THREE.Vector3) => toGrillScene(v).setY(GRILL_OFFSET.y)
  const spots: Record<Role, { at: THREE.Vector3; yaw: number }[]> = {
    // (up on the notch's step)
    chef: [{ at: CHEF_AT.clone().setY(CHEF_AT.y + NOTCH_STEP.h), yaw: CHEF_YAW }],
    sous: [{ at: kitchenAt(1.3), yaw: KITCHEN_YAW }],
    // (the stocker's GuestBar3D's: by the drinks' crates, carrying them to the fridges; drawn here too they stood in the rice tub)
    stock: [],
    // (stood back far enough that the register's drawer, run all the way out, stops short of them)
    cashier: [{ at: onFloor(c0.at.clone().addScaledVector(c0.along, c0.length / 2 + TILL.along).addScaledVector(c0.lay, TILL.lay + TILL.D / 2 + 0.5)),
      yaw: Math.atan2(-c0.lay.x, -c0.lay.z) }],
    // (the servers are on the floor with the customers, and walk: GuestBar3D draws them)
    server: [],
  }
  const used: Partial<Record<Role, number>> = {}
  return crew.flatMap((m) => {
    const k = used[m.role] ?? 0
    used[m.role] = k + 1
    const spot = spots[m.role][k]
    // (the first cashier sits on the till's chair: GuestBar3D's Register marks its seat)
    const seat = m.role === 'cashier' && k === 0 ? 'cashier-seat' : undefined
    return spot ? [{ m, ...spot, way: crewWayOut(m.role, spot.at), seat }] : []
  })
}
/** where the cook stands (on the floor, in the notch: in up to the hearth, as the owner drew; he stood out past the table's edge), and the
 * way he faces: in at the fire. In the middle of the notch, along: it's only a little wider than he is (1.3 to his 1.0), and set to one side
 * (it was 0.36 nearer its left-hand side) he stood into the table beside it, by the left-hand cubby (the owner saw it) */
// (and 2.2 out, not 2.0: up on the notch's step his chest and sleeves were level with the seasonings' ledge, its pots in them (clips.mjs
// found it; at 2.12 his sleeves still brushed the peanut bowl and the miso))
const CHEF_AT = new THREE.Vector3().addScaledVector(LAY, 2.3).addScaledVector(ALONG, (COOK_NOTCH.along[0] + COOK_NOTCH.along[1]) / 2 - FIRE_SHIFT.dot(ALONG))
  .setY(GRILL_OFFSET.y - KITCHEN_DROP)
/** the aisle in front of the cook table, where he stands while the shop's open */
const AISLE_LAY = 2.62
/** and the line he walks along it, a little further out (clear of his cook's back, at the fire), and how far along it either way (the
 * Roasting frame's along: in front of the table, short of its ends, clear of what stands by them) */
const WALK_LAY = AISLE_LAY + 0.38
const WALK_ALONG: [number, number] = [-1.24, 1.86]
const CHEF_YAW = Math.atan2(-CHEF_AT.x, -CHEF_AT.z)
/** the owner, smaller than the cooks (round and short, as Overcooked's), and how far down the cook's aisle his walk goes, in his own frame */
const BOSS_SCALE = 1.05 * 0.8 * GRILL_SCALE
/** where he stands while the shop's open: down the aisle from the grill, out of his chef's way (where it was when his place at the fire was
 * further to the left) */
const BOSS_OPEN_AT = new THREE.Vector3().addScaledVector(LAY, AISLE_LAY).addScaledVector(ALONG, 1.2).setY(CHEF_AT.y)
/** a step in the Roasting frame, in his own (turned with him, his size) */
const bossFrame = (v: THREE.Vector3, unit = false): [number, number] => {
  const w = v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -CHEF_YAW)
  if (unit) w.normalize(); else w.divideScalar(BOSS_SCALE)
  return [w.x, w.z]
}
/** his way about, from a place of his (BossAisle): straight back to the walking line, then along it */
const bossAisle = (home: THREE.Vector3) => {
  const h = home.dot(ALONG)
  return { mouth: bossFrame(LAY.clone().multiplyScalar(WALK_LAY - home.dot(LAY))), dir: bossFrame(ALONG, true),
    range: [(WALK_ALONG[0] - h) / BOSS_SCALE, (WALK_ALONG[1] - h) / BOSS_SCALE] as [number, number] }
}
/** the low wooden step on the notch's floor that he and his cook stand on at the fire (the owner's; blender/notchstep.py): its height, its
 * depth, and where it stands (its back to the notch's back, its front, the step up, a little out past the table's edge), turned with the
 * table */
const NOTCH_STEP = { h: 0.2, d: 1.05 }
// (its back 0.09 out from the notch's back, so its front's as far past the table's edge as he's stood back)
const NOTCH_STEP_AT = new THREE.Vector3().addScaledVector(ALONG, CHEF_AT.dot(ALONG)).addScaledVector(LAY, COOK_NOTCH.lay[0] + 0.09 + NOTCH_STEP.d / 2)
  .setY(CHEF_AT.y)
const NOTCH_STEP_YAW = Math.atan2(-ALONG.z, ALONG.x)
const BOSS_AISLE = { ...bossAisle(CHEF_AT),
  step: { to: (NOTCH_STEP_AT.dot(LAY) + NOTCH_STEP.d / 2 - CHEF_AT.dot(LAY)) / BOSS_SCALE, h: NOTCH_STEP.h / BOSS_SCALE } }
const BOSS_AISLE_OPEN = bossAisle(BOSS_OPEN_AT)
// (his walk on his round: out of the notch (straight back) and along the aisle)
const BOSS_WALK = bossFrame(ALONG.clone().multiplyScalar(1.7).addScaledVector(LAY, WALK_LAY - CHEF_AT.dot(LAY)))
/** a wood texture of blender/woodtex.py's, tiled every `w` x `h` of the table's units */
function woodTex(file: string, w: number, h: number) {
  if (typeof document === 'undefined') return null
  const t = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'textures/' + file)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / w, 1 / h)
  t.anisotropy = 8
  return t
}
/** the cook's table's top: keyaki planks, cathedral figure, a tile every 1.6 */
const COOK_TABLE_WOOD = woodTex('keyaki_top.jpg', 1.6, 1.6)
/** its body: cedar boards standing in framed panels, a panel every 0.6 across, one the body's height */
const COOK_PANEL_WOOD = woodTex('cedar_panel.jpg', 1, 1)
/** the bar's base: boards standing side by side, straight grain and flat-sawn in turn, their grain clear (the owner: it didn't show) */
const BAR_BASE_WOOD = woodTex('bar_base.jpg', 1, 1)
/** below its top: honed white marble with soft grey veining (blender/marbletex.py), a tile 1.2 across (the owner had it dark a while, and
 * wanted it white again) */
const COOK_MARBLE = woodTex('marble_panel.jpg', 1, 1)
/** a box whose sides carry the panel texture at its true size: each side's u stretched to how wide it is (a panel every `tile` across), v
 * the whole height */
function panelBox(w: number, h: number, d: number, tile = 0.6) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // (the faces in order +x, -x, +y, -y, +z, -z, four corners each: the x faces are d wide, the z faces w)
  for (let f = 0; f < 6; f++) {
    const across = f < 2 ? d : f >= 4 ? w : 0
    for (let k = 0; k < 4; k++) uv.setX(f * 4 + k, uv.getX(f * 4 + k) * (across ? across / tile : 1))
  }
  uv.needsUpdate = true
  return g
}
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
function CookTableImpl({ floor = true }: { floor?: boolean }) {
  // (and under it all the kitchen's floor, from the bar's cook's edges to the front, and on past the table's
  // right-hand end where the other cooks stand)
  const W = KITCHEN_FLOOR.along[1] - KITCHEN_FLOOR.along[0], D = KITCHEN_FLOOR.lay[1] - KITCHEN_FLOOR.lay[0]
  const mid = new THREE.Vector3().addScaledVector(ALONG, (KITCHEN_FLOOR.along[0] + KITCHEN_FLOOR.along[1]) / 2)
    .addScaledVector(LAY, (KITCHEN_FLOOR.lay[0] + KITCHEN_FLOOR.lay[1]) / 2).setY(GRILL_OFFSET.y - KITCHEN_DROP + 0.004 * GRILL_SCALE)
  return (
    <>
      {/* (set back under the top on their outer faces only: where they meet, they run into each other, no gap) */}
      {COOK_TABLE_PARTS.map((p, i) => <CookTableBox key={i} lay={[p[0], p[1]]} along={[p[2], p[3]]}
        inset={[[0.06, -0.01, 0.06, 0.06], [-0.01, 0.06, 0.06, -0.01], [-0.01, 0.06, -0.01, 0.06], [-0.01, 0.06, -0.01, 0.06], [-0.01, 0.06, -0.01, -0.01], [-0.01, 0.06, 0.06, -0.01]][i] as [number, number, number, number]} />)}
      <CubbyFrame />
      {/* (its far corners, marked for the servers' way round it to the dish racks: GuestBar3D) */}
      <group name="cook-table-c0" position={new THREE.Vector3().addScaledVector(ALONG, COOK_TABLE.along[0]).addScaledVector(LAY, COOK_TABLE.lay[0])} />
      <group name="cook-table-c1" position={new THREE.Vector3().addScaledVector(ALONG, COOK_TABLE.along[1]).addScaledVector(LAY, COOK_TABLE.lay[1])} />
      {/* (the cubbies either side a pair of doors each, opening out to the left and the right; under the hearth, at the back of the notch,
          no cupboard: the table's own face, the cook's knives hung upright on their rack on it (Decor's KnifeSet) */}
      <CubbyDoors along={CUBBY2.along as [number, number]} hinge="both" lit />
      <CubbyDoors along={CUBBY.along as [number, number]} hinge="both" lit />
      {/* (what's kept in them: the grill's own stores, no plates (blender/cubbystock.py)) */}
      {([['right', CUBBY.along], ['left', CUBBY2.along]] as const).map(([which, al]) => {
        const at = new THREE.Vector3().addScaledVector(ALONG, (al[0] + al[1]) / 2).addScaledVector(LAY, (CUBBY.lay[0] + COOK_TABLE.lay[1] - 0.06) / 2)
        return <group key={which} position={[at.x, CUBBY_FLOOR_Y, at.z]} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}><CubbyStock which={which} /></group>
      })}
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
  const { along: [n0, n1], lay: [nl] } = COOK_NOTCH
  // (the notch under the hearth cut in from its front: the outline runs in round it)
  const pts: [number, number][] = [[a0 + i, l0 + i], [a1 - i, l0 + i], [a1 - i, l1 - i], [n1 + i, l1 - i], [n1 + i, nl + i], [n0 - i, nl + i], [n0 - i, l1 - i], [a0 + i, l1 - i]]
  // (its corners rounded off, as a planed top would be; the outline, grown out, keeps to the same curves)
  const sh = roundedShape(pts, [0.16, 0.16, 0.16, 0.04, 0.1, 0.1, 0.04, 0.16].map((r) => r + grow))
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
        <meshToonMaterial color="#ffffff" map={COOK_TABLE_WOOD} />
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
      {/* (and the second, on the left: the same header, floor and a shelf the whole way across) */}
      <Block along={[CUBBY2.along[0], CUBBY2.along[1]]} lay={[CUBBY2.lay[0], front]} y={[-0.3, -0.08]} color={CUBBY_WOOD} />
      <Block along={[CUBBY2.along[0], CUBBY2.along[1]]} lay={[CUBBY2.lay[0], front]} y={[floor, CUBBY_FLOOR_Y]} color={CUBBY_WOOD} />
    </>
  )
}
/**
 * A cupboard's doors (開き戸) in the table's front, frame-and-panel in the body's own cedar a shade lighter: one leaf hung at its outer
 * end (`hinge` 'low' or 'high' along the table) or a pair hung at both ends meeting in the middle ('both'), a small oval pull let in
 * near each free edge. Shut, they close it off; a click swings them open outward so what's in it shows, another shuts them (the owner's:
 * pointed at, they lit up and swung open of themselves, and stayed open while the pointer was inside). `front`: the face they hang on (lay); `back`: how far in the cupboard goes (lay), its inside dark. `lit`: a strip of warm
 * light under its header inside, coming on as the doors open (and off as they shut, so none leaks out through them), lighting what's in it.
 */
// (the cupboards are fridges (the owner's): a cold white light in them, not a warm one)
const STRIP_OFF = new THREE.Color('#4a5058')
const STRIP_ON = new THREE.Color('#eef7ff')
/** a wire rack (a fridge's shelf, as the drinks fridges' are): a frame of round rod round it and thin wires across it from front to back,
 * `w` along x and `d` along z, its top at y 0; made once for each size */
const racks = new Map<string, THREE.BufferGeometry>()
function wireRack(w: number, d: number) {
  const key = `${w.toFixed(3)}x${d.toFixed(3)}`
  let g = racks.get(key)
  if (g) return g
  const parts: THREE.BufferGeometry[] = []
  const rod = (len: number, r: number, along: 'x' | 'z', x: number, z: number) => {
    const c = new THREE.CylinderGeometry(r, r, len, 6, 1, true)
    c.rotateZ(along === 'x' ? Math.PI / 2 : 0)
    if (along === 'z') c.rotateX(Math.PI / 2)
    c.translate(x, -r, z)
    parts.push(c)
  }
  rod(w, 0.005, 'x', 0, -d / 2); rod(w, 0.005, 'x', 0, d / 2)
  rod(d, 0.005, 'z', -w / 2, 0); rod(d, 0.005, 'z', w / 2, 0)
  const n = Math.max(2, Math.round(w / 0.035))
  for (let i = 1; i < n; i++) rod(d, 0.0025, 'z', -w / 2 + (w * i) / n, 0)
  rod(w, 0.0035, 'x', 0, 0)
  g = mergeGeometries(parts)!
  parts.forEach((q) => q.dispose())
  racks.set(key, g)
  return g
}
/** a fridge's white lining, its walls, ceiling, floor and shelf */
const FRIDGE_LINING = '#e3e9ee'
/** what a fridge's display says: its temperature */
const FRIDGE_READOUT = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128; c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#0d1418'; g.fillRect(0, 0, 128, 64)
  g.fillStyle = '#7fe8ff'; g.shadowColor = '#4ad0ff'; g.shadowBlur = 10
  g.font = 'bold 40px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('3.0℃', 64, 34)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/** how bright a cupboard's lamp is, its doors open */
const CUBBY_LAMP = 3.2
/** how far a leaf swings open (a little past square) */
const LEAF_SWING = 1.75
/** how near someone's middle may come to where a cupboard's doors swing (a body's half-width and a little), and how far ahead of a walker
 * that's looked for (seconds of their way: the doors swing shut in less) */
const DOOR_ROOM = 0.35
const DOOR_AHEAD = 0.2
/** and no further ahead than this (a run's pace would look past where they stop: the owner, back at his place by the left-hand cupboard) */
const DOOR_AHEAD_MAX = 0.12
/**
 * How far a point (x, z, in a leaf's own terms: its hinge at the origin, the leaf shut along +x, swinging out toward +z) is from all the
 * places the leaf passes through as it opens, its width `w` swung through LEAF_SWING.
 */
function fromSwing(x: number, z: number, w: number) {
  const a = Math.atan2(z, x)
  if (a >= 0 && a <= LEAF_SWING) return Math.max(0, Math.hypot(x, z) - w)
  // (outside the sweep: to the nearer of its edges, the leaf shut and the leaf open)
  return Math.min(fromLeaf(x, z, w, 1, 0), fromLeaf(x, z, w, SWUNG_X, SWUNG_Z))
}
const SWUNG_X = Math.cos(LEAF_SWING), SWUNG_Z = Math.sin(LEAF_SWING)
/** how far (x, z) is from a leaf `w` long lying from the origin along the unit (cx, cz) */
function fromLeaf(x: number, z: number, w: number, cx: number, cz: number) {
  const t = Math.min(w, Math.max(0, x * cx + z * cz))
  return Math.hypot(x - t * cx, z - t * cz)
}
function CubbyDoors({ along: [a0, a1], hinge, front = COOK_TABLE.lay[1] - 0.11, back = CUBBY.lay[0], lit = false }: { along: [number, number]
  hinge: 'low' | 'high' | 'both'; front?: number; back?: number; lit?: boolean }) {
  const floor = GRILL_OFFSET.y - KITCHEN_DROP
  const top = -0.3, bottom = floor + CUBBY.plinth
  const H = top - bottom, span = a1 - a0
  const leaves = hinge === 'both' ? [-1, 1] : [hinge === 'low' ? -1 : 1]
  const W = span / leaves.length - 0.006
  const mid = new THREE.Vector3().addScaledVector(ALONG, (a0 + a1) / 2).addScaledVector(LAY, front)
  const doors = useRef<(THREE.Group | null)[]>([])
  const frame = useRef<THREE.Group>(null)
  const st = useRef({ k: 0, kept: false, blocked: false })
  const lamp = useRef<THREE.SpotLight>(null)
  // (where the cupboard's lamp shines: straight down, onto its floor)
  const lampAim = useMemo(() => new THREE.Object3D(), [])
  const strip = useRef<THREE.MeshBasicMaterial>(null)
  // (how open it is, for the cold that spills out)
  const cold = useRef(0)
  const side = a0 < COOK_NOTCH.along[0] ? 'left' : 'right'
  if (import.meta.env?.DEV && typeof window !== 'undefined') ((window as unknown as { __cubbies?: Record<string, typeof st> }).__cubbies ??= {})[side] = st
  const geo = useMemo(() => panelBox(W, H, 0.025, 0.45), [W, H])
  const inv = useMemo(() => new THREE.Matrix4(), [])
  const who = useMemo(() => new THREE.Vector3(), [])
  const seen = useMemo(() => new Map<THREE.Object3D, THREE.Vector3>(), [])
  /** whether (x, z), in the doors' frame, is too near where either leaf swings (each in its own terms: hinged at its end of the opening, shut
   * toward the middle) */
  const inSwing = (x: number, z: number) => {
    for (const sd of leaves) if (fromSwing((x - sd * span / 2) * -sd, z, W) < DOOR_ROOM) return true
    return false
  }
  useFrame((_, dt) => {
    const s = st.current
    if (frame.current && (s.k > 0.01 || s.kept)) {
      inv.copy(frame.current.matrixWorld).invert()
      // (anyone stood or passing in front, where the doors swing, where they are or where they'll be a moment on at the pace they're going:
      // the doors don't open into them, and swing shut if they're open, opening again once they're by if they'd been left open)
      s.blocked = false
      for (const f of KITCHEN_FOLK) {
        if (!f.visible) continue
        who.setFromMatrixPosition(f.matrixWorld).applyMatrix4(inv)
        let last = seen.get(f)
        if (!last) seen.set(f, (last = who.clone()))
        const step = dt > 0 ? DOOR_AHEAD / Math.max(dt, 1 / 120) : 0
        const vx = (who.x - last.x) * step, vz = (who.z - last.z) * step
        const cut = Math.min(1, DOOR_AHEAD_MAX / Math.max(1e-6, Math.hypot(vx, vz)))
        const ax = who.x + vx * cut, az = who.z + vz * cut
        last.copy(who)
        if (inSwing(who.x, who.z) || inSwing(ax, az)) s.blocked = true
      }
      for (const f of seen.keys()) if (!KITCHEN_FOLK.has(f)) seen.delete(f)
    } else {
      s.blocked = false
      seen.clear()
    }
    // (the chef reaching in: part way open a moment, whoever's before them (he is))
    const want = performance.now() - CUBBY_KICK[side] < 1500 ? 0.6 : !s.blocked && s.kept ? 1 : 0
    s.k += (want - s.k) * Math.min(1, Math.min(dt, 0.1) * (s.blocked ? 16 : 5))
    CUBBY_OPEN[side] = s.k > 0.05
    // (each door about its hinge at its outer edge, its free edge swinging out toward the cook, a little past square)
    const e = s.k * s.k * (3 - 2 * s.k)
    doors.current.forEach((d, i) => { if (d) d.rotation.y = leaves[i] * e * LEAF_SWING })
    // (glass-fronted, its light's always on, a little brighter with its doors open)
    if (lamp.current) lamp.current.intensity = (0.55 + 0.45 * e) * CUBBY_LAMP
    strip.current?.color.copy(STRIP_ON)
    cold.current = e
  })
  // (a fridge's: 冷藏櫃門, the owner's name for them)
  const tip = () => setTip({ title: lit ? '冷藏櫃門' : '櫃門', hint: st.current.blocked ? '前面有人，打不開' : st.current.kept ? '點一下關上' : '點一下打開' })
  const over = (e: Parameters<typeof handOver.onPointerOver>[0]) => {
    handOver.onPointerOver(e)
    tip()
  }
  return (
    <group ref={frame} position={mid} rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      {lit && (
        <>
          <mesh name={`CubbyStrip-${side}`} position={[0, top - 0.007, -0.045]}>
            <boxGeometry args={[span - 0.12, 0.012, 0.022]} />
            <meshBasicMaterial ref={strip} color={STRIP_OFF} toneMapped={false} />
          </mesh>
          {/* (shining down only, a wide cone from just under its top, and no further than its floor: a lamp in all directions lit the
              table's top above it as well (no shadows, and the toon light lights even what faces away a little), the top and the plate on it
              glowing as the doors opened) */}
          {QUALITY.tier === 'high' && (
            <>
              <primitive object={lampAim} position={[0, bottom, (back - front) * 0.4]} />
              <spotLight ref={lamp} position={[0, top - 0.03, (back - front) * 0.4]} target={lampAim} color="#e6f2ff" intensity={0}
                angle={1.25} penumbra={0.55} distance={(top - bottom) * 1.8} decay={1.6} />
            </>
          )}
          {/* (a fridge's white lining: its back, its two ends, its ceiling, its floor; the shelf lined white too) */}
          <StaticBatch plain>
            <mesh position={[0, (top + bottom) / 2, back - front + 0.006]}><boxGeometry args={[span - 0.01, H, 0.008]} /><meshToonMaterial color={FRIDGE_LINING} /></mesh>
            {[-1, 1].map((e) => (
              <mesh key={e} position={[e * (span / 2 - 0.006), (top + bottom) / 2, (back - front) / 2]}><boxGeometry args={[0.008, H, front - back - 0.01]} /><meshToonMaterial color={FRIDGE_LINING} /></mesh>
            ))}
            <mesh position={[0, top - 0.005, (back - front) / 2 - 0.01]}><boxGeometry args={[span - 0.01, 0.008, front - back - 0.03]} /><meshToonMaterial color={FRIDGE_LINING} /></mesh>
            <mesh position={[0, bottom + 0.003, (back - front) / 2]}><boxGeometry args={[span - 0.01, 0.006, front - back - 0.01]} /><meshToonMaterial color={FRIDGE_LINING} /></mesh>
          </StaticBatch>
          {/* (the shelf a white wire rack, as the drinks fridges' are: the left-hand one the whole way, the right-hand one over its outer half
              only (the owner's), its other half by the cook's notch the whole height for the soy sauce and the seasonings (blender/cubbystock.py)) */}
          {(() => {
            const s0 = side === 'right' ? 0 : -span / 2, s1 = span / 2
            return <mesh position={[(s0 + s1) / 2, CUBBY_SHELF_Y - 0.006, (back - front) / 2]} geometry={wireRack(s1 - s0 - 0.02, front - back - 0.04)}>
              <meshToonMaterial color="#eef2f5" />
            </mesh>
          })()}
          {/* (its display, on the header above its doors: what it's keeping at) */}
          {FRIDGE_READOUT && (
            <mesh position={[span / 2 - 0.16, -0.19, 0.0515]}>
              <planeGeometry args={[0.1, 0.05]} />
              <meshBasicMaterial map={FRIDGE_READOUT} toneMapped={false} />
            </mesh>
          )}
          {/* (and the cold that spills out over its sill as its doors open, falling to the floor and rolling out across it) */}
          <group position={[0, floor, 0.03]}>
            <ColdMist width={span * 0.8} drop={bottom - floor + 0.16} reach={0.7} level={cold} opacity={0.28} />
          </group>
        </>
      )}
      {leaves.map((sd, i) => (
        <group key={i} ref={(g) => { doors.current[i] = g }} position={[sd * span / 2, 0, 0.0125]}
          onClick={(e) => {
            e.stopPropagation()
            if (getEdit().on) return
            st.current.kept = !st.current.kept
            // (a fridge: opened, the stock panel comes up on its tab; shut, it goes (the owner's))
            if (lit) { if (st.current.kept) askPantry('chilled', 'cubby', () => { st.current.kept = false }); else shutPantry() }
            tip()
          }}
          onPointerOver={over} onPointerOut={(e) => { handOver.onPointerOut(e); setTip(null) }}>
          {/* (a frame-and-panel door: a panel of the body's white marble set in a frame of dark cedar, its stiles and rails standing a little
              proud of it, so it reads as joinery of a piece with the table rather than a board stuck on) */}
          <group position={[-sd * (W / 2 + 0.003), bottom + H / 2, 0]}>
            {lit ? (
              // (a fridge's door: a pane of glass in the frame, a pale cold tint, a gleam of the room in it; what's inside seen through it)
              <mesh scale={[W - 0.1, H - 0.1, 1]}>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color="#dff1fb" transparent opacity={0.2} roughness={0.06} metalness={0.2} depthWrite={false} />
              </mesh>
            ) : (
              <mesh geometry={geo} scale={[1, 1, 0.7]}>
                <meshToonMaterial color="#ffffff" map={COOK_MARBLE} />
              </mesh>
            )}
            {/* (the frame's four pieces drawn as one: they swing as one) */}
            <StaticBatch plain>
            {[-1, 1].map((e) => (
              <group key={e}>
                <mesh position={[e * (W / 2 - 0.03), 0, 0.006]}><boxGeometry args={[0.06, H, 0.02]} /><meshToonMaterial color="#7a5638" map={COOK_PANEL_WOOD} /></mesh>
                <mesh position={[0, e * (H / 2 - 0.03), 0.006]}><boxGeometry args={[W - 0.12, 0.06, 0.02]} /><meshToonMaterial color="#7a5638" map={COOK_PANEL_WOOD} /></mesh>
              </group>
            ))}
            </StaticBatch>
          </group>
          {/* (the pull: a small oval let into the stile near the free edge, dark inside) */}
          <mesh position={[-sd * (W - 0.032), bottom + H * 0.55, 0.0172]} scale={[0.6, 1, 1]}>
            <circleGeometry args={[0.022, 20]} />
            <meshBasicMaterial color="#3a2616" />
          </mesh>
        </group>
      ))}
    </group>
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
      {/* the body, set back a little under the top: clad in honed white marble, a dark kick at its foot */}
      <mesh position-y={(floor - 0.08) / 2} geometry={useMemo(() => panelBox(W - 0.12, -floor - 0.08, D - 0.12, 1.2), [W, D, floor])}>
        <meshToonMaterial color="#ffffff" map={COOK_MARBLE} />
      </mesh>
      <mesh position-y={floor + 0.05}>
        <boxGeometry args={[W - 0.1, 0.1, D - 0.1]} />
        <meshToonMaterial color="#1e140d" />
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
function BarGateImpl({ c, gate }: { c: Counter; gate: Gate }) {
  const yaw = Math.atan2(-c.along.z, c.along.x)
  const end = gate.end
  // (the hinge: the inner edge of the gap, on the base's line; the leaf reaches from it across the doorway)
  const { hinge, mid: middle } = useMemo(() => gateOf(c, gate), [c, gate])
  const G = gate.leaf
  const leaf = useRef<THREE.Group>(null)
  const open = useRef(0)
  const body = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean; target?: THREE.Vector3; update?: () => void } | null
  const { on: editing, selected, space } = useEdit()
  const drag = useRef<{ at: THREE.Vector3; y: number; lift: boolean } | null>(null)
  const idx = BAR_GATES.indexOf(gate)
  // (its handles hang in the gate's own turned frame: for the world's axes they're turned back by that frame's turn; for its own, not at all)
  const gizmoFrame = useRef<THREE.Group>(null)
  const [gateWorld, setGateWorld] = useState(0)
  useEffect(() => {
    if (!editing) return
    const t = window.setTimeout(() => {
      const f = gizmoFrame.current
      if (f) setGateWorld(-new THREE.Euler().setFromQuaternion(f.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y)
    }, 50)
    return () => window.clearTimeout(t)
  }, [editing, selected])
  // (while editing, the leaf is outlined like any other piece that can be moved: brighter pointed at, amber chosen)
  const [hover, setHover] = useState(false)
  useEditBox(leaf, editing, selected === `gate${idx}` ? 'chosen' : hover ? 'hover' : 'idle')
  // (in edit mode, key G with the shop shut: the swing door by itself is moved by hand, the post and doorway staying; on the list of what can be moved)
  useEffect(() => registerMovable(`gate${idx}`, idx === 1 ? '水槽旁閘門門板' : '櫃檯尾閘門門板', () => {
    if (leaf.current) focusCamera(camera, controls, leaf.current.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0)))
  }), [idx, camera, controls])
  const hit = (e: PointerEvent, y: number, lift: boolean) => {
    const r = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    // (over the floor: the plane at the gate's height; lifted: a upright plane through it, facing the camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)
    if (lift) {
      plane.normal.copy(camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate())
      plane.constant = -plane.normal.dot(body.current!.getWorldPosition(new THREE.Vector3()))
    }
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3())
  }
  const down = (e: { stopPropagation: () => void; nativeEvent: PointerEvent; intersections?: { object: THREE.Object3D }[] }) => {
    if (!getEdit().on || !body.current) return
    // (an axis arrow under the pointer takes it: the box is only for the free move)
    if (e.intersections?.some((i) => i.object.userData.gizmo)) return
    e.stopPropagation()
    beginChange()
    moveTo(`gate${idx}`, offsetOf(`gate${idx}`))
    const wp = body.current.getWorldPosition(new THREE.Vector3())
    const lift = e.nativeEvent.shiftKey
    const p = hit(e.nativeEvent, wp.y, lift)
    if (!p) return
    drag.current = { at: p, y: wp.y, lift }
    if (controls) controls.enabled = false
    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const q = hit(ev, d.y, d.lift)
      if (!q) return
      // (the move in the world, taken into the bar's own frame and then the nudge's units: the bar is drawn GRILL_SCALE over its own size)
      const par = body.current!.parent!
      const a = par.worldToLocal(d.at.clone()), b = par.worldToLocal(q.clone())
      const dl = b.sub(a)
      const n = offsetOf(`gate${idx}`)
      // (the swing door's own offset, in the bar's units, its post and doorway staying where they are)
      moveTo(`gate${idx}`, [n[0] + dl.x, n[1] + dl.y, n[2] + dl.z])
      d.at.copy(q)
    }
    const up = () => {
      drag.current = null
      if (controls) controls.enabled = true
      commitOffsets()
      window.removeEventListener('pointermove', move)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }
  useFrame((_, dt) => {
    const near = SERVICE.walkers.some((w) => Math.hypot(w.x - middle.x, w.z - middle.z) < GATE_NEAR)
    open.current = THREE.MathUtils.clamp(open.current + (near ? 1 : -1) * Math.min(dt, 0.1) * GATE_SWING, 0, 1)
    const k = open.current
    if (leaf.current) leaf.current.rotation.y = -end * (Math.PI / 2) * k * k * (3 - 2 * k)
    // (the whole gate where it's been put, the moment it's moved)
    if (body.current) {
      const n = positionOf(`gate${idx}`)
      body.current.position.set(n[0], n[1], n[2])
    }
  })
  const H = BAR_TOP - 0.02
  return (
    <group position={c.at} rotation-y={yaw}>
      <group position={[hinge, 0, 0.08]}>
        {/* the swing door by itself: its own thing, apart from the post and the doorway, which stay where they are; it's this that's moved by hand */}
        <group ref={body} position={positionOf(`gate${idx}`)} onPointerDown={down}
          onPointerOver={editing ? (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(true) } : undefined} onPointerOut={editing ? () => setHover(false) : undefined}>
        {editing && <group ref={gizmoFrame}><AxisGizmo id={`gate${idx}`} at={[end * G / 2, H / 2, 0]} theta={space === 'world' ? gateWorld : 0} /></group>}
        <group ref={leaf} name="gate-leaf">
          {/* (its frame, panels, joints and hinge leaves, some forty parts, drawn as a handful: they swing together, as one) */}
          <StaticBatch plain>
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
          </StaticBatch>
        </group>
        {/* the hinges, top and bottom (they go with the door when it's moved by hand, so they're in its group): a brass knuckle on the hinge's line, a leaf screwed to the base's end and one to
            the door's stile (that one turns with it: GateHingeLeaf) */}
        {/* (some thirty parts, drawn as four: they never move apart) */}
        <StaticBatch plain>
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
        </StaticBatch>
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
  const ax1 = a.x1 - gateCut(BAR_GATES[0]), by1 = b.y1 - gateCut(BAR_GATES[1])
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
  // (a core of dark wood inside the plank, a little in from its faces: where the long top's triangles meet, a hair's crack between
  // them would let the cove light under the bar show through as a bright line; this keeps it shut)
  // (its top a little under the plank's: it came 4 mm out over it, a dark brown slab lying all along the bar top inside its pale rim)
  const core = useMemo(() => barTopShape(-0.02).translate(0, -BAR_TOP, 0).scale(1, 0.5, 1).translate(0, BAR_TOP - 0.012, 0), [])
  return (
    <group rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <mesh geometry={geo} castShadow receiveShadow><meshToonMaterial color="#ffffff" map={BAR_WOOD} /></mesh>
      <mesh geometry={core}><meshBasicMaterial color="#5a3c24" side={THREE.DoubleSide} /></mesh>
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
  // (faint, and mostly near the top: laid on as light it adds the same to dark grain and light alike, so much of it washed the boards' grain
  // out to one flat colour)
  grad.addColorStop(0, 'rgba(255,205,135,0.3)')
  grad.addColorStop(0.3, 'rgba(255,195,120,0.1)')
  grad.addColorStop(0.65, 'rgba(255,190,110,0)')
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
/** the log's bark (its fissures running down its length, v along it) and its cut end (the growth rings, the heartwood darker, a crack or two) */
const LOG_BARK = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256; c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#6e4a2c'; g.fillRect(0, 0, 256, 512)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // (plates of bark between long fissures, each plate its own shade, worn paler where feet rest)
  for (let k = 0; k < 26; k++) {
    const x = rnd() * 256, w = 6 + rnd() * 16
    g.fillStyle = `hsl(${24 + rnd() * 8}, ${30 + rnd() * 15}%, ${22 + rnd() * 14}%)`
    g.fillRect(x, 0, w, 512)
  }
  g.strokeStyle = 'rgba(25,14,6,0.8)'
  for (let k = 0; k < 40; k++) {
    let x = rnd() * 256, y = rnd() * 512
    g.lineWidth = 0.8 + rnd() * 2
    g.beginPath(); g.moveTo(x, y)
    const len = 60 + rnd() * 200
    for (let t = 0; t < len; t += 8) { x += (rnd() - 0.5) * 3; y += 8; g.lineTo(x, y) }
    g.stroke()
  }
  // (cross checks between the fissures)
  g.strokeStyle = 'rgba(30,18,8,0.5)'; g.lineWidth = 1
  for (let k = 0; k < 60; k++) { const x = rnd() * 256, y = rnd() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4 + rnd() * 8, y + (rnd() - 0.5) * 3); g.stroke() }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()
const LOG_END_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, '#b07a48'); gr.addColorStop(0.45, '#d8b07a'); gr.addColorStop(0.9, '#e2bf8a'); gr.addColorStop(1, '#5a3a20')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  g.strokeStyle = 'rgba(120,80,40,0.45)'
  for (let r = 4; r < 60; r += 3 + (r % 5)) { g.lineWidth = 0.8; g.beginPath(); g.ellipse(64 + Math.sin(r) * 1.5, 64, r, r * 0.97, 0, 0, Math.PI * 2); g.stroke() }
  g.strokeStyle = 'rgba(60,35,15,0.7)'; g.lineWidth = 1.2
  g.beginPath(); g.moveTo(64, 64); g.lineTo(100, 40); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const LOG_RING = new THREE.CylinderGeometry(FOOT_RAIL.r * 1.1, FOOT_RAIL.r * 1.1, 0.026, 9)
const LOG_END = new THREE.CircleGeometry(FOOT_RAIL.r * 1.03, 9)
/** the bark tiled along a log of this length, so its fissures keep their size whatever the length */
const BARK_BY_LEN = new Map<number, THREE.Texture>()
function logBarkFor(len: number) {
  const k = Math.round(len * 10) / 10
  let t = BARK_BY_LEN.get(k)
  if (!t && LOG_BARK) { t = LOG_BARK.clone(); t.repeat.set(1, Math.max(1, k * 2.2)); t.needsUpdate = true; BARK_BY_LEN.set(k, t) }
  return t ?? null
}
/** how high the raised lip along the bar's cook's side stands over its top */
/** how far the first counter's lip runs on towards the side counter's, so the two meet at the corner with no gap (the bar's own sizes) */
const LIP_JOIN = 0.29
/** a unit slab with rounded edges (scaled to each top), its grain still running the long way */
const ROUNDED_SLAB = new RoundedBoxGeometry(1, 1, 1, 3, 0.08)
/**
 * One counter of the bar: a long plank of pale hinoki with rounded edges on a dark base, a raised lip on the cook's
 * side, and at each seat the chopsticks on their rest and a dish of sauce. With a gate, the base stops short of one end
 * and that end of the top too: the staff's way between the kitchen and the floor, shut by a little swing door (BarGate).
 */
/**
 * Each place's number (the owner's: the bar's places numbered; round, and fixed on the wooden screen behind the place): a disc of black
 * lacquer on the screen's face toward the customer, half way up it, its number in gold inside a gold ring. A place with no screen behind it
 * has it standing on a little foot instead, its number on both faces. One picture for all the places, a cell each (the disc's round edge
 * its cut-out: a square of two triangles, no fan of them round a middle), its rim a short tube; batched with the bar.
 */
const SEAT_TAG = { r: 0.032, d: 0.008, foot: 0.012 }
/** the screen's (the raised lip's) face toward the customer, across the counter, and how far in from its ends a disc keeps */
const LIP_FACE = 0.28 - 0.03
const SEAT_TAG_TEX = (() => {
  if (typeof document === 'undefined') return null
  const n = GRILL_SEATS.length, c = 128
  const cv = document.createElement('canvas')
  cv.width = c * n; cv.height = c
  const g = cv.getContext('2d')
  if (!g) return null
  for (let k = 0; k < n; k++) {
    const cx = k * c + c / 2, cy = c / 2, R = c / 2 - 1
    const gr = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
    gr.addColorStop(0, '#2c2523'); gr.addColorStop(0.5, '#161213'); gr.addColorStop(1, '#0d0b0b')
    g.fillStyle = gr
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#c9a24e'
    g.lineWidth = 3
    g.beginPath(); g.arc(cx, cy, R - 9, 0, Math.PI * 2); g.stroke()
    g.lineWidth = 1
    g.beginPath(); g.arc(cx, cy, R - 15, 0, Math.PI * 2); g.stroke()
    g.font = 'bold 66px Georgia, "Times New Roman", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = 'rgba(0,0,0,0.6)'
    g.fillText(String(seatLabel(k)), cx + 2, cy + 6)
    g.fillStyle = '#e6c26e'
    g.fillText(String(seatLabel(k)), cx, cy + 4)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
})()
/** a disc's face, its picture the k-th cell (cut round by the picture's clear corners) */
const seatTagFace = (k: number) => {
  const g = new THREE.PlaneGeometry(2 * SEAT_TAG.r, 2 * SEAT_TAG.r)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const n = GRILL_SEATS.length
  for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / n)
  return g
}
const SEAT_TAG_FACES = GRILL_SEATS.map((_, k) => seatTagFace(k))
/** the disc's rim: a short open tube, its axis across the counter */
const SEAT_TAG_RIM = new THREE.CylinderGeometry(SEAT_TAG.r * 0.985, SEAT_TAG.r * 0.985, SEAT_TAG.d, 20, 1, true).rotateX(Math.PI / 2)
const SEAT_TAG_FACE_MAT = typeof document === 'undefined' ? null : new THREE.MeshToonMaterial({ map: SEAT_TAG_TEX, alphaTest: 0.5, emissive: '#ffffff', emissiveMap: SEAT_TAG_TEX, emissiveIntensity: 0.18 })
const SEAT_TAG_RIM_MAT = typeof document === 'undefined' ? null : new THREE.MeshToonMaterial({ color: '#151112' })
/** the place's number: on the screen's face behind it (`onLip`), or standing on a foot there's no screen */
function SeatTag({ k, onLip }: { k: number; onLip: boolean }) {
  if (onLip) {
    const y = LIP_H / 2
    return (
      <group position={[0, y, LIP_FACE - SEAT_TAG.d / 2 - 0.001]}>
        <mesh geometry={SEAT_TAG_RIM} material={SEAT_TAG_RIM_MAT!} />
        {/* (its face toward the customer, -z) */}
        <mesh geometry={SEAT_TAG_FACES[k]} material={SEAT_TAG_FACE_MAT!} position-z={-SEAT_TAG.d / 2 - 0.0006} rotation-y={Math.PI} />
      </group>
    )
  }
  const y = SEAT_TAG.foot + SEAT_TAG.r
  return (
    <group position={[0, 0, LIP_FACE - 0.035]}>
      <mesh position={[0, SEAT_TAG.foot / 2, 0]}><boxGeometry args={[2 * SEAT_TAG.r * 0.8, SEAT_TAG.foot, 0.026]} /><meshToonMaterial color="#d6b88c" /></mesh>
      <group position-y={y}>
        <mesh geometry={SEAT_TAG_RIM} material={SEAT_TAG_RIM_MAT!} />
        {/* (the customer's face toward -z, the kitchen's toward +z, each reading the right way round from its side) */}
        <mesh geometry={SEAT_TAG_FACES[k]} material={SEAT_TAG_FACE_MAT!} position-z={-SEAT_TAG.d / 2 - 0.0006} rotation-y={Math.PI} />
        <mesh geometry={SEAT_TAG_FACES[k]} material={SEAT_TAG_FACE_MAT!} position-z={SEAT_TAG.d / 2 + 0.0006} />
      </group>
    </group>
  )
}
function BarCounterImpl({ c, first = 0, trim = 0, gate, noTop = false, butt = false }: { c: Counter; first?: number; trim?: number; gate?: Gate
  /** its far end runs into the first counter's side (its lip runs on into the first one's, so they meet with no gap) */
  butt?: boolean
  /** its top drawn with the others' as one piece (BarTop), not its own */
  noTop?: boolean }) {
  const yaw = Math.atan2(-c.along.z, c.along.x)
  const L = c.length
  const G = gate ? gateCut(gate) : 0
  const end = gate?.end ?? 1
  // (the base, short of the gate)
  const baseL = L + 0.2 - G
  const baseX = -end * G / 2
  // (a counter butting into another runs its base on into the other's, so no slot opens between them at the corner (the owner saw the
  // floor through one: the side counter's base stopped 8 cm short of the long one's back))
  const run = butt ? 0.12 : 0
  // (the raised lip's run along the counter: stopping short of where the other counter butts on, and of the gate's flap; the first counter's
  // starts where the side counter's now stands, drawn in from the wall by SIDE_PULL, the two running a little into each other at the corner)
  const lipSpan = (() => {
    let x0 = -(L + 0.3) / 2 + trim - (trim ? 0.02 : 0) + (trim ? SIDE_PULL - LIP_JOIN : 0), x1 = (L + 0.3) / 2 + (butt ? 0.05 : 0)
    if (gate) {
      if (end > 0) x1 -= G
      else x0 += G
    }
    return [x0, x1]
  })()
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
      {/* the cove light: a warm strip tucked into the inside corner where the top's underside meets the base, behind a little lip of the
          base's dark wood, so it's the base it lights and not the strip that's seen; its glow washing a little way down the base (it was
          out under the top's front edge, a bright bar in plain sight) */}
      <mesh name="bar-cove" position={[baseX, BAR_TOP - 0.066, -0.132]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[baseL, 0.012]} /><meshBasicMaterial color="#ffcf88" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[baseX, BAR_TOP - 0.074, -0.142]}>
        <boxGeometry args={[baseL, 0.022, 0.006]} /><meshToonMaterial color="#3a281a" />
      </mesh>
      {/* (held well off the base's face and drawn over it: a hair's breadth off, it fought the face for the same depth and flickered) */}
      <mesh position={[baseX, (BAR_TOP - 0.06) * 0.62, -0.127]} rotation-y={Math.PI}>
        <planeGeometry args={[baseL, (BAR_TOP - 0.06) * 0.76]} />
        {/* (laid on as light, added to the boards under it, not painted over them: their grain shows through the glow) */}
        <meshBasicMaterial map={COVE_GLOW} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
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
              <meshToonMaterial color="#ffffff" map={logBarkFor(len)} />
            </mesh>
            <mesh geometry={LOG_GEO} position={[0, FOOT_RAIL.y, FOOT_RAIL.z]} rotation-z={Math.PI / 2} scale={[1.16, len + 0.012, 1.16]}>
              <meshBasicMaterial color="#2a1a10" side={THREE.BackSide} />
            </mesh>
            {/* (the bark's rings along it, and the cut ends showing the pale wood; its knots taken off: the owner saw odd little dots under the legs) */}
            {Array.from({ length: Math.max(1, Math.round(len / 0.55)) }, (_, k) => (
              <mesh key={`r${k}`} geometry={LOG_RING} position={[-len / 2 + (len * (k + 0.5)) / Math.max(1, Math.round(len / 0.55)), FOOT_RAIL.y, FOOT_RAIL.z]}
                rotation-z={Math.PI / 2} rotation-y={k}><meshToonMaterial color="#4a3220" /></mesh>
            ))}
            {[-1, 1].map((sd) => (
              <mesh key={`e${sd}`} geometry={LOG_END} position={[sd * (len / 2 + 0.002), FOOT_RAIL.y, FOOT_RAIL.z]} rotation-y={sd * Math.PI / 2}>
                <meshToonMaterial color="#ffffff" map={LOG_END_TEX} />
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
      {/* the base stands back on the cook's side, so the customers' knees go under the top: dark cedar boards standing in a frame, their
          grain at one scale along it (the table's own panelling, darker), the cove light washing down them */}
      {/* (it stands in the top's shadow, lit by nothing but the cove light: its boards glow a little with it, grain and all, or they'd be black) */}
      <mesh position={[baseX + run / 2, (BAR_TOP - 0.06) / 2, 0.08]} castShadow geometry={panelBox(baseL + run, BAR_TOP - 0.06, 0.4, 0.55)}>
        <meshToonMaterial color="#d4c2b0" map={BAR_BASE_WOOD} emissive="#ffffff" emissiveMap={BAR_BASE_WOOD} emissiveIntensity={0.26} />
      </mesh>
      {/* the raised lip on the cook's side, the step the food is handed over */}
      {/* (stopping short of where the other counter butts on, and of the gate's flap) */}
      {(() => {
        // (where the two counters' lips meet at the corner, each runs a little into the other: no notch between their
        // rounded ends)
        // (the first counter's lip starts where the side counter's now stands, drawn in from the wall by SIDE_PULL)
        const [x0, x1] = lipSpan
        return (
          // (a tall one, a screen of wood between the customers and the kitchen, its top rounded)
          <group position={[(x0 + x1) / 2, BAR_TOP + LIP_H / 2, 0.28]}>
            <mesh geometry={ROUNDED_SLAB} scale={[x1 - x0, LIP_H, 0.06]} castShadow><meshToonMaterial color="#ffffff" map={TRAY_WOOD} /></mesh>
            <mesh geometry={ROUNDED_SLAB} scale={[(x1 - x0) * 1.003, LIP_H * 1.06, 0.07]}><meshBasicMaterial color="#3b2a20" side={THREE.BackSide} /></mesh>
          </group>
        )
      })()}
      {Array.from({ length: c.seats }, (_, n) => {
        const x = seatAlong(c, n)
        return (
          <group key={n} position={[x, BAR_TOP, 0]}>
            {/* (the case its drawer runs in, under the top's edge on the customer's side, to their right: BarDrawers draws the drawer) */}
            <group position={[DRAWER.x, -0.06, DRAWER.z]}><BarPiece name="BarDrawerCase" grain={n} /></group>
            {/* (each customer's plate is set down a little back of the middle of their place and cleared away by GuestBar3D) in front of it,
                nearest them, the pair of chopsticks laid across, their tips to the customer's left (+x) up on the rest, which lies across
                them; behind on the left the little soy dish (on the right instead at a seat where it'd be off the top, by the gate) */}
            <group position={[SETTING.restX, 0, PLACE.chop]} rotation-y={Math.PI / 2}><BarPiece name="BarHashioki" /></group>
            {/* (the chopsticks on it: BarChopsticks, out of the batch, so a pair can be picked up) */}
            {/* (the place's number, on the screen behind it; standing, where there's none) */}
            <SeatTag k={first + n} onLip={x - SEAT_TAG.r - 0.03 > lipSpan[0] && x + SEAT_TAG.r + 0.03 < lipSpan[1]} />
            <group position={[sauceSide(c, gate, x), 0.001, PLACE.sauce[1]]}>
              <BarPiece name="BarSoyDish" design={n} />
              {/* (empty till someone sits down there: GuestBar3D pours them their soy) */}
            </group>
          </group>
        )
      })}
      {/* the soy pot and the wasabi that each two places share, at the back between them */}
      {sharedAlong(c).map((x, k) => (
        <group key={`shared${k}`} position={[x, BAR_TOP + 0.001, PLACE.shared]}><BarPiece name="BarCondiments" /></group>
      ))}
    </group>
  )
}

/** each place's drawer under the top: where it is along the place (to the customer's left: the owner's; half as wide as it was, and for a
 * while on their right),
 * where its case's front edge stands (just behind the top's rounded edge, on the customers' side), how far the drawer slides out, and where its
 * box of tissues sits in it (lengthways) */
const DRAWER = { x: 0.17, z: -0.296, out: 0.15, tissue: [0, -0.105, 0.122] as [number, number, number] }
/**
 * Each place's drawer, a box of tissues in it (the owner's: one to each place, in its own drawer; they were a box between every two places,
 * on the top): pointed at, it lights up and says so; a click slides it out toward the customer, another back in, with the runners' rumble. Its
 * case is the counter's own (batched with it); the drawer moves, so it isn't, and the tissues in it are drawn only while it's out. Nothing
 * works in edit mode.
 */
const BarDrawers = memo(function BarDrawers({ c, first }: { c: Counter; first: number }) {
  return (
    <group position={c.at} rotation-y={Math.atan2(-c.along.z, c.along.x)}>
      {Array.from({ length: c.seats }, (_, n) => <BarDrawer key={n} x={seatAlong(c, n) + DRAWER.x} seat={first + n} grain={n} />)}
    </group>
  )
})
/** a place's drawer (its seat's number among all the bars': while someone sits there it's pushed home and stays shut, or it'd go into them; and
 * which of the walnut's boards it's made of) */
function BarDrawer({ x, seat, grain }: { x: number; seat: number; grain: number }) {
  const slider = useRef<THREE.Group>(null)
  const inside = useRef<THREE.Group>(null)
  const sheet = useRef<THREE.Group>(null)
  const box = useRef<THREE.Group>(null)
  const st = useRef({ open: false, at: 0, pulled: -1, used: false, sheets: null as null | { flat: THREE.Object3D; up: THREE.Object3D } })
  // (how many are left in its box, out of a new box's (the owner's: shown as 200/200))
  const left = () => `${tissuesAt(seat)}/${BOX_SHEETS}`
  const says = () => (st.current.open ? `衛生紙 ${left()}・點衛生紙抽一張・點抽屜推回去` : `一個座位一盒衛生紙（${left()}）・點一下拉開`)
  const tissueSays = () => (tissuesAt(seat) > 0 ? `剩 ${left()}・點一下抽一張` : `${left()}・空了，開店前會換新的一盒`)
  useFrame((_, dt) => {
    const s = st.current
    if (s.open && SEATS_TAKEN.has(seat)) { s.open = false; drawerSound(true) }
    // (a box that's been pulled from shows it: the next tissue left standing up out of the slot, the flat one only in a new box)
    if (s.at > 0.02 && box.current) {
      if (!s.sheets) {
        const flat = box.current.getObjectByName('BarTissueLowSheet'), up = box.current.getObjectByName('BarTissueLowPop')
        if (flat && up) s.sheets = { flat, up }
      }
      if (s.sheets) {
        const used = s.used || tissuesAt(seat) < BOX_SHEETS
        s.sheets.up.visible = used
        s.sheets.flat.visible = !used
      }
    }
    // (a tissue pulled, the owner's way: drawn up out of the slot, its foot in the slot till it's all out, leaning out toward whoever's
    // pulling it, then lifted on up and away, fading. The sheet hangs from its top edge, so it's stretched out of the slot from nothing
    // as its top rises (it hung its whole length below the box from the start, under the drawer, and looked to be falling))
    const g = sheet.current
    if (g && s.pulled >= 0) {
      s.pulled += dt
      const k = s.pulled / TISSUE_FLY
      if (k >= 1) { s.pulled = -1; g.visible = false } else {
        g.visible = true
        const rise = THREE.MathUtils.smoothstep(k, 0, 0.42)
        const free = THREE.MathUtils.smootherstep(k, 0.42, 1)
        const len = TISSUE_LEN * rise
        // (its top edge: up out of the slot and leaning out toward the customer as it comes, then on up and away)
        g.position.set(Math.sin(k * 7) * 0.006 * free, TISSUE_SLOT + len * 0.93 + free * 0.1, -(0.4 * len + free * 0.17))
        // (leaning back to the slot as it's drawn, its width along the slot's length; a little sway once it's free)
        g.rotation.set(-0.4 * rise + 0.15 * free, Math.PI / 2 + Math.sin(k * 4) * 0.25 * free, Math.sin(k * 6) * 0.1 * free)
        g.scale.set(0.72 + 0.28 * free, Math.max(0.02, rise), 1)
        const fade = 1 - THREE.MathUtils.smoothstep(k, 0.62, 1)
        g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.opacity = fade })
      }
    }
    // (out while the stock keeper changes its box of tissues, too)
    const want = s.open || DRAWER_HELD.has(seat) ? 1 : 0
    if (inside.current && want) inside.current.visible = true
    if (Math.abs(want - s.at) < 1e-4) return
    s.at = Math.abs(want - s.at) < 0.002 ? want : s.at + (want - s.at) * Math.min(1, dt * 7)
    if (slider.current) slider.current.position.z = -DRAWER.out * s.at
    if (inside.current) inside.current.visible = s.at > 0.02
  })
  /** the drawer clicked: out, or back in */
  const toggle = () => {
    if (SEATS_TAKEN.has(seat)) { setTip({ title: '抽屜', hint: '客人坐著，等他走了再開' }); return }
    st.current.open = !st.current.open
    drawerSound(!st.current.open)
    setTip({ title: '抽屜', hint: says() })
  }
  return (
    <group position={[x, BAR_TOP - 0.06, DRAWER.z]}>
      {/* (handlers on a group round it: a primitive's own aren't attached) */}
      <group ref={slider}
        onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; tipOver('抽屜', says()).onPointerOver(e) }}
        onPointerOut={(e) => { if (getEdit().on) return; tipOver('抽屜', says()).onPointerOut(e) }}
        onClick={(e) => {
          e.stopPropagation()
          if (getEdit().on) return
          toggle()
        }}>
        <BarPiece name="BarDrawer" grain={grain} />
        <group ref={inside} position={DRAWER.tissue} visible={false}>
          {/* (the box itself: a click on it pulls a tissue. Shut away it isn't drawn, but it's still in the pointer's way (the pointer's
              rays don't mind what's hidden): there it's the drawer, which a click opens) */}
          <group onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; if (st.current.open) tipOver('衛生紙', tissueSays()).onPointerOver(e); else tipOver('抽屜', says()).onPointerOver(e) }}
            onPointerOut={(e) => { if (getEdit().on) return; tipOver('衛生紙', '').onPointerOut(e) }}
            onClick={(e) => {
              e.stopPropagation()
              if (getEdit().on) return
              if (!st.current.open) { toggle(); return }
              // (one out of the box: it's counted, as the customers' are)
              if (st.current.pulled < 0 && tissuesAt(seat) > 0) {
                st.current.pulled = 0
                st.current.used = true
                setTissues(seat, tissuesAt(seat) - 1)
                tissuePull()
                setTip({ title: '衛生紙', hint: tissueSays() })
              }
            }}>
            <group ref={box}><BarPiece name="BarTissueLow" /></group>
          </group>
          <group ref={sheet} visible={false}><BarPiece name="BarTissuePull" fade /></group>
        </group>
      </group>
    </group>
  )
}

/** the chopsticks' ink, drawn for each of their instances: BarPiece's hull (their back faces pushed out along their welded normals) */
const CHOP_INK = new THREE.ShaderMaterial({
  uniforms: { uWidth: { value: 0.0008 }, uColor: { value: new THREE.Color('#3b2a20') } },
  vertexShader: /* glsl */ `
    uniform float uWidth;
    void main() {
      vec4 p = vec4(position + normalize(normal) * uWidth, 1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  side: THREE.BackSide,
})
const CHOP_GONE = new THREE.Matrix4().makeScale(0, 0, 0)
/**
 * Every place's chopsticks at once, one draw and one for their ink (instanced): lying across the place on their rest until its customer starts
 * eating, when they're picked up (FolkFigure has the same lacquered pair in the hand) and gone from the rest till they've done (the owner's:
 * the customers ate with the pair on the rest untouched). Out of the bar's batch, so a pair can go.
 */
const BarChopsticks = memo(function BarChopsticks() {
  const gltf = useGLTF(SETTING_URL) as unknown as { scene: THREE.Group }
  const made = useMemo(() => {
    const src = gltf.scene.getObjectByName('BarChopstick')
    let mesh: THREE.Mesh | null = null
    src?.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh })
    if (!src || !mesh) return null
    const m0 = mesh as THREE.Mesh
    // (its shape in the piece's own frame, its root at the origin, as BarPiece lays it)
    src.updateMatrixWorld(true)
    const geo = m0.geometry.clone().applyMatrix4(new THREE.Matrix4().copy(src.matrixWorld).invert().multiply(m0.matrixWorld))
    const was = m0.material as THREE.MeshStandardMaterial
    const mat = new THREE.MeshToonMaterial({ color: was.color.clone(), map: was.map })
    const shape = new THREE.BufferGeometry()
    shape.setAttribute('position', geo.attributes.position)
    if (geo.index) shape.setIndex(geo.index)
    const hull = mergeVertices(shape, 1e-5)
    hull.computeVertexNormals()
    // (each place's two sticks where they lie, in the bars' frame: its counter, its place along it, and each stick on the rest)
    const places: THREE.Matrix4[][] = []
    const e = new THREE.Euler(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1)
    for (const c of GRILL_COUNTERS) {
      const bar = new THREE.Matrix4().compose(c.at, q.setFromEuler(e.set(0, Math.atan2(-c.along.z, c.along.x), 0)), one)
      for (let n = 0; n < c.seats; n++) {
        const at = bar.clone().multiply(new THREE.Matrix4().makeTranslation(seatAlong(c, n), BAR_TOP, 0))
        places.push([-1, 1].map((sd) => at.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(-SETTING.chopL / 2, 0.0015, PLACE.chop + sd * 0.0075),
          q.setFromEuler(e.set(0, sd * 0.012, SETTING.chopTilt)), one))))
      }
    }
    const sticks = new THREE.InstancedMesh(geo, mat, places.length * 2)
    const ink = new THREE.InstancedMesh(hull, CHOP_INK, places.length * 2)
    ink.instanceMatrix = sticks.instanceMatrix
    sticks.receiveShadow = true
    sticks.frustumCulled = ink.frustumCulled = false
    return { sticks, ink, places, geo, hull, mat }
  }, [gltf])
  useEffect(() => () => { if (made) { made.geo.dispose(); made.hull.dispose(); made.mat.dispose(); made.sticks.dispose(); made.ink.dispose() } }, [made])
  // (which places' pairs are up, last laid out: laid out again only when that changes)
  const shown = useRef('-')
  useFrame(() => {
    if (!made) return
    const key = [...CHOPS_UP].sort((a, b) => a - b).join()
    if (key === shown.current) return
    shown.current = key
    made.places.forEach((pair, i) => pair.forEach((m, k) => made.sticks.setMatrixAt(i * 2 + k, CHOPS_UP.has(i) ? CHOP_GONE : m)))
    made.sticks.instanceMatrix.needsUpdate = true
  })
  if (!made) return null
  return (
    <>
      <primitive object={made.sticks} />
      <primitive object={made.ink} />
    </>
  )
})
/** where a place's chopsticks lie (across it, nearest the customer), how long they are, how far along their rest stands under their tips, and the
 * slope they lie at from the table up onto it */
// (the rest lies across the chopsticks now (the owner's): they cross its drawn-in waist, lower than its ends, so they slope less)
const SETTING = { chopL: 0.22, restX: 0.088, chopTilt: Math.atan2(0.0075, 0.198) }
/** how long a pulled tissue takes to come out and drift off, fading; how long it is (BarTissuePull hangs this far from its top edge); and how
 * high the box's slot stands over the box's foot */
const TISSUE_FLY = 1.8
const TISSUE_LEN = 0.17
const TISSUE_SLOT = 0.06
const SETTING_URL = import.meta.env.BASE_URL + 'models/barsetting.glb'
const settingPieces = new Map<string, THREE.Object3D>()
/** the polished brass of the drawers' pulls (real metal, the studio in it), made once */
let barBrass: THREE.MeshStandardMaterial | null = null
const barBrassOf = () => {
  if (!barBrass) {
    barBrass = new THREE.MeshStandardMaterial({ color: '#c99a40', metalness: 1, roughness: 0.22, envMapIntensity: 1.1 })
    reflectStudio(barBrass)
  }
  return barBrass
}
/**
 * One of a place's things (blender/barsetting.py): the soy dish (in the plates' design `design`), a chopstick, the rest, the tissues, the
 * drawer and its case (in the walnut's board `grain`, one of four: the places' drawers aren't all cut from one), the shared soy pot and wasabi.
 * `fade`: its own materials, to be faded out (a pulled tissue).
 */
function BarPiece({ name, design, grain, fade }: { name: string; design?: number; grain?: number; fade?: boolean }) {
  useStudio()
  const gltf = useGLTF(SETTING_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const board = grain === undefined ? undefined : grain % 4
    const key = `${name}|${design ?? ''}|${board ?? ''}`
    let base = settingPieces.get(key)
    if (!base) {
      const src = gltf.scene.getObjectByName(name)!
      // (the board: the picture on its swatch)
      const swatch = board === undefined ? null
        : ((gltf.scene.getObjectByName(`BarWalnutSwatchMesh${board}`) as THREE.Mesh | undefined)?.material as THREE.MeshStandardMaterial | undefined)?.map ?? null
      base = src.clone(true)
      base.position.set(0, 0, 0)
      base.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const was = m.material as THREE.MeshStandardMaterial
        const map = design !== undefined && /Dish/.test(was.name) ? wareDesign(design) : swatch && /Walnut/.test(was.name) ? swatch : was.map
        // (the walnut glowing a little with its own grain: under the bar's top it's in shadow, and it went a dark brown block there)
        const wood = /Walnut/.test(was.name)
        m.material = /Brass/.test(was.name) ? barBrassOf()
          : new THREE.MeshToonMaterial({ color: was.color.clone(), map,
            ...(wood ? { emissive: new THREE.Color('#ffffff'), emissiveMap: map, emissiveIntensity: 0.2 } : {}),
            side: /Paper/.test(was.name) ? THREE.DoubleSide : THREE.FrontSide })
        m.castShadow = /Tissue/.test(name)
        m.receiveShadow = true
      })
      inkModel(base, (m) => /Slot|Sheet|Spoon/.test(m.name), { width: 0.0008, weld: true })
      settingPieces.set(key, base)
    }
    const made = base.clone(true)
    // (to fade: its own materials, see-through)
    if (fade) made.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { const t = (m.material as THREE.Material).clone(); t.transparent = true; t.depthWrite = false; m.material = t }
    })
    return made
  }, [gltf, name, design, grain, fade])
  // (a faded copy's materials are its own: let go of with it)
  useEffect(() => () => {
    if (fade) obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose() })
  }, [obj, fade])
  return <primitive object={obj} />
}
useGLTF.preload(SETTING_URL)


/**
 * What edit mode shows for a piece that is moved by the table's nudge rather than by wrapping it: a block of its size that is never drawn, standing
 * where the piece is less the edit's own offset, in a Movable, so the box, the arrows and the fields work as for any other piece.
 */
// (drawn again only when its place or size changes, not with every redraw of the kitchen: `at` is worked out afresh each time)
const EditProxy = memo(EditProxyImpl, (a, b) => a.id === b.id && a.label === b.label && a.yaw === b.yaw && a.at.equals(b.at) && a.size.every((v, i) => v === b.size[i]))
function EditProxyImpl({ id, label, at, size, yaw }: { id: string; label: string; at: THREE.Vector3; size: V3; yaw: number }) {
  useEdit()
  const o = positionOf(id)
  return (
    <Movable id={id} label={label}>
      {/* (unseen, but there to be pointed at in edit mode, where its glow shows the piece's place) */}
      <mesh position={[at.x - o[0], at.y - o[1] + size[1] / 2, at.z - o[2]]} rotation-y={yaw} userData={{ proxy: true }}>
        <boxGeometry args={size} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
    </Movable>
  )
}

const STEP_URL = import.meta.env.BASE_URL + 'models/notchstep.glb'
useGLTF.preload(STEP_URL)
/** the notch's wooden step (blender/notchstep.py, the owner's 木台階: one block): its top in the table's keyaki, its sides the bar's standing
 * boards; inked, merged, standing still */
const NotchStep = memo(function NotchStep() {
  const gltf = useGLTF(STEP_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('NotchStep')!.clone(true)
    r.position.set(0, 0, 0)
    const top = new THREE.MeshToonMaterial({ color: '#ffffff', map: COOK_TABLE_WOOD })
    const skirt = new THREE.MeshToonMaterial({ color: '#e0c8a8', map: BAR_BASE_WOOD })
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const n = (m.material as THREE.Material).name
      m.material = n === 'StepTop' ? top : skirt
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, () => false, { width: 0.004, weld: true })
    return r
  }, [gltf])
  return (
    <Movable id="notchstep" label="木台階"><StaticBatch plain>
      <group position={NOTCH_STEP_AT} rotation-y={NOTCH_STEP_YAW}><primitive object={obj} /></group>
    </StaticBatch></Movable>
  )
})

/** the owner in his place (at the grill while the shop's shut, along the aisle while it's open): drawn again only when that or the language
 * changes, not with every redraw of the kitchen (he walks, turns and fades by his own frame loop) */
const BossSpot = memo(function BossSpot({ open, lang }: { open: boolean; lang: Lang }) {
  return (
    <Movable id="boss" label="老闆"><group position={open ? BOSS_OPEN_AT : CHEF_AT} rotation-y={CHEF_YAW} scale={BOSS_SCALE}>
      <Boss to={BOSS_WALK} aisle={open ? BOSS_AISLE_OPEN : BOSS_AISLE} open={open} lang={lang}><BlobShadow r={0.24} /></Boss>
    </group></Movable>
  )
})

/**
 * The big chopping board (blender/cutboard.py): thick warm wood, four planks edge-glued along its length, its corners rounded and edges
 * eased, the knife's fine scratches over its middle; drawn in the room's toon light, with the ink line round it.
 */
const CUTBOARD_URL = import.meta.env.BASE_URL + 'models/cutboard.glb'
useGLTF.preload(CUTBOARD_URL)
/** A shallow wooden tray (盛り板) where ordered food waits raw, to be carried onto the fire. */
const Tray = memo(TrayImpl, sameProps)
function TrayImpl({ position, container }: { position: [number, number, number]; container: string }) {
  const gltf = useGLTF(CUTBOARD_URL) as unknown as { scene: THREE.Group }
  const { geometry, map } = useMemo(() => {
    gltf.scene.updateMatrixWorld(true)
    const m = gltf.scene.getObjectByName('CutBoard') as THREE.Mesh
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld)
    const map = (m.material as THREE.MeshStandardMaterial).map
    if (map) map.anisotropy = 8
    return { geometry: g, map }
  }, [gltf])
  // in front of the fire, its long side running across the screen
  const yaw = Math.atan2(-STACK_DIR.z, STACK_DIR.x)
  return (
    <group position={position} rotation-y={yaw} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={map} />
      </mesh>
      <mesh geometry={geometry} scale={[1.012, 1.08, 1.02]}>
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
/** a seasoning held over the food goes on no more than once every this many seconds (whichever piece it's over), and only once it's been
 * over the piece a moment */
const DAB_EVERY = 0.7
const DAB_FIRST = 0.25
/**
 * How each seasoning is worked over the food while it's held there, at time `t` (s): where it moves to from where it's held (in the
 * table's frame), how much more it tips, and how many grains or drops a second fall. A pinch of salt rubbed between the fingers (a quick
 * small jitter), the powders shaken off their spoons (a bob), the sauces brushed along (a stroke back and forth), the pastes dabbed on (a
 * dip), the lemon squeezed (a press and twist).
 */
function toolAction(kind: Seasoning, t: number) {
  const tau = Math.PI * 2
  switch (kind) {
    case 'salt': return { off: new THREE.Vector3(Math.sin(t * tau * 9) * 0.004, Math.sin(t * tau * 13) * 0.003, Math.cos(t * tau * 11) * 0.004), tilt: 0, rate: 46 }
    case 'peanut':
    case 'shichimi': return { off: new THREE.Vector3(0, Math.max(0, Math.sin(t * tau * 5.5)) * 0.022, 0), tilt: Math.sin(t * tau * 5.5) * 0.12, rate: 40 }
    case 'soy':
    case 'milk': return { off: STACK_DIR.clone().multiplyScalar(Math.sin(t * tau * 1.8) * 0.06).add(new THREE.Vector3(0, -0.015, 0)), tilt: 0.15, rate: 9 }
    case 'lemon': return { off: new THREE.Vector3(0, -Math.abs(Math.sin(t * tau * 1.6)) * 0.02, 0), tilt: Math.sin(t * tau * 1.6) * 0.25, rate: 14 }
    case 'water': return { off: new THREE.Vector3(), tilt: 0, rate: 0 }
    default: return { off: new THREE.Vector3(0, -Math.max(0, Math.sin(t * tau * 2.2)) * 0.03, 0), tilt: 0.1, rate: 6 }
  }
}
/** the rings that spread from a piece as a seasoning goes on: how many can be out at once, and how long each lasts (s) */
const RINGS = 6
const RING_LIFE = 0.45
/** a seasoned piece's bounce: how long (s) and how much bigger at its height */
const BOUNCE_TIME = 0.3
const BOUNCE = 0.13
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
const STICK_FOOT_R = 0.76
const STICK_TOP_R = 0.42
const STICK_TOP_Y = 1.15
const LAYER_HEIGHT = 0.1
const CHAR_COLOR = new THREE.Color(0.045, 0.035, 0.03)


/** the table's ware's shapes, each made once and shared by every one set out (they come and go as something's put on them: one made each
 * time stayed on the GPU, never let go) */
const WARE_GEO = new Map<string, THREE.BufferGeometry>()
const wareOnce = (key: string, make: () => THREE.BufferGeometry) => {
  let g = WARE_GEO.get(key)
  if (!g) { g = make(); WARE_GEO.set(key, g) }
  return g
}
/** A small round side dish (小皿) for onigiri and mochi, of the same set as the plates (plum blossom), inked. */
const SideDish = memo(SideDishImpl, sameProps)
function SideDishImpl({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = wareOnce('dish', () => {
    const R = DISH_R
    return wareGeometry([[0, 0], [R * 0.55, 0], [R * 0.62, 0.012], [R * 0.85, 0.03], [R, 0.05], [R * 0.97, 0.056],
      [R * 0.82, 0.038], [R * 0.55, 0.018], [0, 0.018]], R)
  })
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

/** The tasting bowl (試食碗): a deep round bowl of the same plum-blossom ware, where whatever's cooked by hand to try is put. */
const TasteBowl = memo(TasteBowlImpl, sameProps)
function TasteBowlImpl({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = wareOnce('bowl', () => {
    const R = BOWL_R
    return wareGeometry([[0, 0], [R * 0.4, 0], [R * 0.46, 0.012], [R * 0.7, 0.04], [R * 0.92, 0.1], [R, 0.15], [R * 0.98, 0.158],
      [R * 0.9, 0.11], [R * 0.66, 0.05], [R * 0.4, 0.024], [0, 0.024]], R)
  })
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={PLUM_WARE} />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.06, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

const ZARU_URL = import.meta.env.BASE_URL + 'models/zaru.glb'
/** the basket's model, made once: its weave and its bound rim in the room's toon light (their relief maps kept), an ink line round it */
let zaruBase: THREE.Object3D | null = null
/** The woven bamboo basket (竹ざる) the foil-roasted potatoes are served into (blender/zaru.py): a plain weave of split bamboo, a rolled rim
 * bound with cane. */
const Basket = memo(BasketImpl, sameProps)
function BasketImpl({ position, container }: { position: [number, number, number]; container: string }) {
  const gltf = useGLTF(ZARU_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    if (!zaruBase) {
      const r = gltf.scene.clone(true)
      r.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const src = m.material as THREE.MeshStandardMaterial
        m.material = new THREE.MeshToonMaterial({ color: '#ffffff', map: src.map, normalMap: src.normalMap, side: THREE.DoubleSide })
        m.castShadow = true
        m.receiveShadow = true
      })
      inkModel(r, () => false, { width: 0.004, weld: true })
      zaruBase = r
    }
    return zaruBase.clone(true)
  }, [gltf])
  return (
    <group position={position} userData={{ container }}>
      <primitive object={obj} />
    </group>
  )
}
useGLTF.preload(ZARU_URL)

type Uniform = { value: number }
/** per-piece look: how charred it is, and how much of each seasoning is on it (all 0 → 1) */
type Looks = { uChar: Uniform; uSear?: Uniform; uSalt: Uniform; uSoy: Uniform; uMilk: Uniform; uPeanut: Uniform
  /** miso glaze; green dabs (wasabi, yuzu kosho); red flakes (shichimi); a glisten of lemon juice */
  uMiso: Uniform; uGreen: Uniform; uRed: Uniform; uLemon: Uniform }

/**
 * Burn patches for over-roasted food: a value-noise mask over the texture that grows as uChar goes 0 → 1, so the
 * food blackens in spots first and ends up fully charred. Seasonings show on top: salt and peanut powder as
 * specks, soy as a dark lacquer over everything, condensed milk in wavy drizzled ribbons.
 */
/** a fish's eyes neither brown, char nor take the seasoning: they stay a clear white with a dark pupil */
const EYE_LOOKS: Looks = { uChar: { value: 0 }, uSear: { value: 0 }, uSalt: { value: 0 }, uSoy: { value: 0 }, uMilk: { value: 0 },
  uPeanut: { value: 0 }, uMiso: { value: 0 }, uGreen: { value: 0 }, uRed: { value: 0 }, uLemon: { value: 0 } }

function addCharring(mat: THREE.MeshToonMaterial, looks: Looks, bites: Bites) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, looks, bites)
    shader.uniforms.uCharColor = { value: CHAR_COLOR }
    shader.vertexShader = BITE_VERTEX(shader.vertexShader)
    shader.fragmentShader = BITE_FRAGMENT(shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uChar;
        uniform float uSear;
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
        // the grill's bars seared across it as it cooks (none on it raw): dark brown, blistered and broken up, deepening as it roasts
        #ifdef USE_MAP
          float searBar = smoothstep(0.84, 0.95, 0.5 + 0.5 * sin((vMapUv.y * 11.0 + vMapUv.x * 1.5) * 6.2831853))
            * smoothstep(0.55, 0.8, charNoise(vMapUv * 8.0) + 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.12, 0.06), clamp(searBar * 0.75, 0.0, 1.0) * uSear);
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

/**
 * The charring programs made with the page (scene/Prewarm), not when the first piece of a kind is ordered: every food mesh once on its own
 * charring copy of its material (its browning, seasonings and bites) and its ink on its bitten copy, compiled while the page loads, kept,
 * never drawn. The first of each kind, ordered, stopped the picture a quarter to half a second while its program was linked. False till
 * Dish has made the food over into its toon materials (bindMaterials waits for the same).
 */
function warmCharring(root: THREE.Object3D, isFood: (id: string) => boolean) {
  const meshes: THREE.Mesh[] = []
  for (const obj of root.children) {
    if (!isFood((obj.userData.itemId as string | undefined) ?? baseName(obj.name))) continue
    obj.traverse((o) => { if (o instanceof THREE.Mesh && !o.name.endsWith('_outline')) meshes.push(o) })
  }
  if (!meshes.length || !meshes.every((m) => m.material instanceof THREE.MeshToonMaterial)) return false
  const group = new THREE.Group()
  for (const m of meshes) {
    const src = m.material as THREE.MeshToonMaterial
    if (src.name.startsWith('Foil') || src.name.startsWith('Wrapper')) continue
    // (both of its sides: a piece cooks front side only, and shows its inside, both, once it's bitten)
    for (const side of [THREE.FrontSide, THREE.DoubleSide]) {
      const mat = src.clone()
      mat.side = side
      addCharring(mat, EYE_LOOKS, newBites())
      const w = m.clone(false) as THREE.Mesh
      w.material = mat
      group.add(w)
    }
    for (const c of m.children) {
      if (!(c instanceof THREE.Mesh) || !c.name.endsWith('_outline')) continue
      const o = c.clone(false) as THREE.Mesh
      o.material = (c.material as THREE.ShaderMaterial).clone()
      biteOutline(o, newBites())
      group.add(o)
    }
  }
  warmLater(group)
  return true
}

const inkScale = new THREE.Vector3()
/**
 * A piece's food drawn with one ink line round all its parts, not one for each (a fish's body, fins and eyes, a rice ball's rice and its
 * seaweed: the grill's food was some eighty draws of ink alone). The parts lying in one frame (a model's several materials, one node) have
 * their hulls merged into one mesh beside them, on a copy of their bitten ink (its bites the piece's own); their own hulls are kept but
 * hidden (a portion's copy is made from the first's node, and builds its own from them). Not the stick (its bites stay empty), nor foil,
 * nor what swells (its hull follows its shape keys).
 */
function inkOneLine(p: Piece) {
  const groups = new Map<THREE.Object3D, THREE.Mesh[]>()
  const hullOf = (m: THREE.Mesh) => m.children.find((c) => c instanceof THREE.Mesh && c.name.endsWith('_outline')) as THREE.Mesh | undefined
  for (const { mesh: m, foil } of p.mats) {
    if (foil || p.sticks.includes(m) || m.morphTargetInfluences?.length || !m.parent || !hullOf(m)) continue
    const list = groups.get(m.parent) ?? []
    list.push(m)
    groups.set(m.parent, list)
  }
  for (const [parent, ms] of groups) {
    // (one copied from another portion's node: its line rebuilt from these parts, on this piece's bites)
    for (const c of [...parent.children]) if (c.userData.oneInk) c.removeFromParent()
    if (ms.length < 2 || !ms.every((m) => m.matrix.equals(ms[0].matrix))) continue
    const hulls = ms.map(hullOf) as THREE.Mesh[]
    const geos = hulls.map((h) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', h.geometry.attributes.position)
      g.setAttribute('normal', h.geometry.attributes.normal)
      if (h.geometry.index) g.setIndex(h.geometry.index)
      return g
    })
    if (!geos.every((g) => !!g.index === !!geos[0].index)) continue
    const geo = mergeGeometries(geos)
    if (!geo) continue
    const mat = (hulls[0].material as THREE.ShaderMaterial).clone()
    mat.uniforms.uBites = p.bites.uBites
    mat.uniforms.uBiteCount = p.bites.uBiteCount
    const ink = new THREE.Mesh(geo, mat)
    ink.matrix.copy(ms[0].matrix)
    ink.matrixAutoUpdate = false
    ink.userData.oneInk = true
    ink.raycast = () => {}
    let most = 0
    // (its width kept the same on screen however big the piece has been (as Dish's lines do))
    ink.onBeforeRender = () => {
      parent.getWorldScale(inkScale)
      const avg = (inkScale.x + inkScale.y + inkScale.z) / 3
      if (avg > most) { most = avg; mat.uniforms.uWidth.value = OUTLINE_WIDTH / avg }
    }
    parent.add(ink)
    for (const h of hulls) h.visible = false
    p.ink = ink
    p.inkOf = ms
  }
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
  /** (served by a server) set out ready at the chef's plating place, or on its way: it goes on to the customer's plate when it's set down */
  via?: 'plated'
  /** (the owner tasting it: time since his last munch) */
  chewAt?: number
  /** which of the plating place's slots it's put out in */
  readyAt?: number
  /** drawn at the bar's size: it's been out at the plating place, so it doesn't grow back on the last hop */
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
  /** its food's ink lines as one (inkOneLine), and the parts it's the lines of: shown while they are */
  ink?: THREE.Mesh
  inkOf?: THREE.Mesh[]
  /** grill-net items: which spot on the net it has (null: waiting its turn, hidden and not cooking) */
  netSpot: number | null
  /** when the owner asked to taste it (performance.now()), the boss on his way to eat it; 0 if not */
  awaitBoss: number
  /** it's the boss eating it: carried from the bowl to his hand at his mouth */
  byBoss?: boolean
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
  /** just put out on the tray: it appears in its spot there rather than sliding in from where it stood on the fire */
  fresh: boolean
  /** ordered in the open shop and not yet brought to the board: still where it's kept, or in the chef's hands (CHEF_TRIP) */
  fetching?: boolean
  /** being prepared on the board till then (performance.now()): not yet to the fire */
  prepUntil?: number
  /** tended half way through its grilling (fanned, or its glaze): once */
  tended?: boolean
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
const Plate = memo(PlateImpl, sameProps)
function PlateImpl({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = wareOnce('plate', () => {
    // profile drawn for a 0.5 radius plate, scaled up to PLATE_R
    const k = PLATE_R / 0.5
    return wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.025], [0.47, 0.06], [0.5, 0.075], [0.49, 0.082], [0.44, 0.052],
      [0.3, 0.02], [0, 0.02]] as [number, number][]).map(([x, y]) => [x * k, y] as [number, number]), PLATE_R)
  })
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
  onNotice?: (what: 'notCooked' | 'burnt' | 'waste' | 'fireFull' | 'offTable' | 'heapFull') => void
  /** written every frame: how much smoke is coming off the fire (0..1), from food that's cooked and still on it */
  smoke?: RefObject<number>
  /** likewise for black smoke, from food left on until it burns */
  blackSmoke?: RefObject<number>
  /** AI simulation: a chef who works the grill and customers who order and eat */
  ai?: boolean
  /** the shop's shut and being worked by hand (see game/mode) */
  research?: boolean
  /** the AI customers order from the menu, and the chef adds charcoal, through the app */
  /** order something; false if it couldn't be (the fire or the basket is full) */
  /** `reuse`: made from a portion already put out and eaten (Roasting's revived it): paid for, but no new portion put out */
  onOrder?: (id: string, guest?: number, reuse?: boolean) => boolean
  onAddCharcoal?: (sticks?: number, byHand?: boolean) => boolean
  /** something the chef or a customer says */
  onSay?: (who: 'chef' | 'guest', text: string) => void
  /** which table is out: the player's tasting (closed) or the shop's (open); each keeps its own food */
  space?: 'closed' | 'open'
  /** draw the bar (with the shop open) the food is served onto; a phone shows its customers in 2D, without it */
  bar?: boolean
  /** who's hired to help the owner (the head chef): a second chef, a sous chef */
  /** who's on the staff here (each drawn at their place while the shop is open) */
  crew?: CrewMember[]
  /** what's said is in this language, with these names for the food */
  lang?: Lang
  names?: Record<string, string>
  /** a customer walked out: what they'd ordered and not eaten (to be refunded) */
  onWalkOut?: (ids: string[], guest: number) => void
  /** a customer's visit, scored as they go (game/reputation): App keeps them for the shop's rating */
  onVisit?: (v: Visit) => void
  /** (shop open) what's on the menu, each dish's parts (a food and what goes on it); customers order from this */
  entries?: { key: string; name: string; parts: { id: string; dabs: string[]; name: string }[] }[]
  /** a customer orders this dish off the menu: false if it can't be had (out of stock, the fire's full) */
  onOrderEntry?: (key: string, guest: number, reuse?: Record<string, number>) => boolean
  /** how slowly customers come in (no cashier: fewer) */
  crowd?: number
  /** the omiki's been offered at the shrine: each customer orders a little more */
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
/** how many times the shop has opened since the page was loaded (each opening draws the next pattern of trade) */
const OPENINGS = { n: 0 }
/** a session of trade, on the shop's clock (runGuests counts 0.8 a beat): what the day's pattern is laid over */
const SESSION_LEN = 420

export function Roasting({ url, roast, itemIds, quantities, active, instant = false, fire, onOffFire, onEat,
  onNotice, smoke, blackSmoke, ai = false, research = false, onOrder, onAddCharcoal, onSay, chef = CHEFS[1], onGuests, space = 'closed',
  locked = false, notes = {}, crowd = 1, blessed = false, onDrink, onWalkOut, onVisit, lang = 'zh', names = {}, crew = [], bar = true,
  entries, onOrderEntry }: RoastingProps) {
  const L = () => LINES[lang]
  const nameOf = (id: string) => names[id] ?? roast.names[id] ?? id
  const { scene } = useGLTF(url)
  /** the whole room's scene (the boss is in it, not in the model) */
  const room = useThree((st) => st.scene)
  const menuIds = useMemo(() => new Set(itemIds), [itemIds])
  const root = scene.children[0]
  // the water bucket's two hoops, made as flat bands (片) rather than round rods: the model's hoops are found by their material and each ring is
  // measured (where along the bucket it stands, how wide it is), then the mesh is given two thin bands of the same height, flat in section
  useMemo(() => {
    root.getObjectByName('WaterBucket')?.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.flatHoops || o.name.endsWith('_outline')) return
      if ((o.material as THREE.Material).name !== 'BucketHoop') return
      o.userData.flatHoops = true
      const pos = o.geometry.getAttribute('position')
      o.geometry.computeBoundingBox()
      const bb = o.geometry.boundingBox!, sz = bb.getSize(new THREE.Vector3())
      // (the bucket's own axis is the one the hoops are shortest along)
      const ax = sz.x <= sz.y && sz.x <= sz.z ? 0 : sz.y <= sz.z ? 1 : 2
      const get = (i: number, k: number) => (k === 0 ? pos.getX(i) : k === 1 ? pos.getY(i) : pos.getZ(i))
      const mid = (bb.min.getComponent(ax) + bb.max.getComponent(ax)) / 2
      const rings = [{ lo: Infinity, hi: -Infinity, r: 0 }, { lo: Infinity, hi: -Infinity, r: 0 }]
      const u = (ax + 1) % 3, v = (ax + 2) % 3
      for (let i = 0; i < pos.count; i++) {
        const a = get(i, ax), ring = rings[a < mid ? 0 : 1]
        ring.lo = Math.min(ring.lo, a); ring.hi = Math.max(ring.hi, a)
        ring.r = Math.max(ring.r, Math.hypot(get(i, u), get(i, v)))
      }
      const bands = rings.map((r) => {
        const h = Math.min((r.hi - r.lo) * 0.9, 0.05), t = 0.012, R = r.r
        const prof = [[R - t, -h / 2], [R, -h / 2], [R + 0.003, h / 2], [R - t, h / 2], [R - t, -h / 2]].map(([x, y]) => new THREE.Vector2(x, y))
        const g = new THREE.LatheGeometry(prof, 56)
        g.translate(0, (r.lo + r.hi) / 2, 0)
        return g
      })
      let merged = mergeGeometries(bands, false) as THREE.BufferGeometry
      // (the lathe stands along Y: laid along the bucket's own axis if that's another)
      if (ax === 2) merged.rotateX(Math.PI / 2)
      else if (ax === 0) merged.rotateZ(-Math.PI / 2)
      merged = merged.toNonIndexed()
      merged.computeVertexNormals()
      o.geometry = merged
      for (const c of o.children) if (c instanceof THREE.Mesh && c.name.endsWith('_outline')) c.geometry = merged
    })
  }, [root])
  // the fire pit drawn bigger than it was modelled (its stones further out, the coals heaped wider), the skewers
  // still planted where they were, now well inside the ring
  useMemo(() => {
    for (const o of root.children) {
      if (!PIT_PARTS.test(o.name) || o.userData.pitScaled) continue
      o.userData.pitScaled = true
      o.position.x *= PIT_SCALE
      o.position.z *= PIT_SCALE
      o.position.y += PIT_LIFT
      o.scale.multiplyScalar(o.name === 'FirePit' ? PIT_SCALE * PIT_GROUND : PIT_SCALE)
      // (the square hearth (its bed, its frame and the stones round it) turned square to the table; the round things in it don't mind)
      if (/^(FirePit|Robuchi|Stone)/.test(o.name)) {
        // (the stones, set round the square, carried round with it about the fire's middle)
        const turn = Math.atan2(-ALONG.z, ALONG.x)
        if (/^Stone/.test(o.name)) o.position.applyAxisAngle(UP_AXIS, turn)
        // (the bed drawn longer along the table: its own x is the table's length once turned. The frame's made that long already
        // (blender/grilledfish.py's IRORI_LONG): stretched here, its bars along the table were wider than the others and its brass corner
        // caps lopsided)
        if (/^FirePit/.test(o.name)) o.scale.x *= HEARTH_LONG
        o.rotateOnWorldAxis(UP_AXIS, turn)
      }
      // (the salt heaped higher, filling the ring)
      if (o.name === 'FirePit') { o.scale.y *= PIT_SALT_RISE; scorchEarth(o as THREE.Mesh) }
    }
    // (no striped shadow acne on the salt and no lattice shadow of the net laid over the coals: the ground doesn't take shadows, the net casts none)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (/^FirePit/.test(o.name)) m.receiveShadow = false
      if (/^GrillNet/.test(o.name) || /^GrillNet/.test(o.parent?.name ?? '')) m.castShadow = false
    })
    // (the net a hand's width higher too)
    const net = root.getObjectByName('GrillNet')
    if (net && !net.userData.lifted) {
      net.userData.lifted = true
      net.position.y += PIT_LIFT
    }
  }, [root])

  // pieces by node, found by scanning the model root; rescanned whenever Dish adds a cloned portion
  const pieces = useRef<Piece[]>([])
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __pieces?: typeof pieces }).__pieces = pieces
  /** (on a phone) who's had their drink from the fridge */
  const drank = useRef(new Set<number>())
  const scannedCount = useRef(-1)
  // (the charring programs, made while the page loads: warmCharring)
  const charWarm = useRef(false)
  useFrame(() => { if (!charWarm.current) charWarm.current = warmCharring(root, (id) => id in roast.times) })
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
      const looks: Looks = { uChar: { value: 0 }, uSear: { value: 0 }, uSalt: { value: 0 }, uSoy: { value: 0 }, uMilk: { value: 0 },
        uPeanut: { value: 0 }, uMiso: { value: 0 }, uGreen: { value: 0 }, uRed: { value: 0 }, uLemon: { value: 0 } }
      pieces.current.push({
        key: obj.uuid, id, copy: (obj.userData.copy as number | undefined) ?? 0, loose: roast.loose.includes(id),
        node: obj, homeP: obj.position.clone(), homeQ: faceCamera(id, obj), homeQ0: obj.quaternion.clone(),
        progress: 0, collected: false,
        flight: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), toP: new THREE.Vector3(),
        toQ: new THREE.Quaternion(), mats, looks, bites: newBites(), sticks: [], food: [], puffs: [], stickOnly: false,
        netSpot: null, awaitBoss: 0, container: null, local: new THREE.Vector3(), carried: false, trash: -1,
        dabs: { salt: 0, soy: 0, milk: 0, peanut: 0, miso: 0, wasabi: 0, shichimi: 0, yuzu: 0, lemon: 0, water: 0 }, steps: [], staged: false, stagedAt: 0, fresh: false, wasPresent: false, homeFlight: 1,
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
    inkOneLine(p)
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
  // (where each thing stands, kept off the hearth's frame as it's dragged and as it's first set out: the hearth grew, and things set out
  // round the old one would sit on its frame)
  const trayAt = () => { const v = new THREE.Vector3(...(roast.tray ?? [0, 0, 0])).add(nudge('tray')); clearOfHearth(v, 0.04, TRAY_W, TRAY_D); return v }
  // skewers lie along the tray's long side, in a row from back to front, then a few laid on top in the gaps between them (TRAY_CAP)
  /** loose food (potatoes, rice balls, mochi) waits in a row along the back of the tray, clear of the sticks (LOOSE_CAP) */
  const trayLooseSpot = (n: number) => trayAt()
    .addScaledVector(STACK_DIR, ((n % LOOSE_CAP) - 3) * 0.2)
    .addScaledVector(LAY_DIR, -(TRAY_D / 2 - 0.13))
    .add(new THREE.Vector3(0, 0.07, 0))
  const traySpot = (n: number) => {
    const top = n >= TRAY_ROWS
    const row = top ? n - TRAY_ROWS + 0.5 : n
    return trayAt()
      .addScaledVector(LAY_DIR, 0.1 + (row - (TRAY_ROWS - 1) / 2) * (TRAY_D - 0.34) / (TRAY_ROWS - 1))
      .addScaledVector(STACK_DIR, 0.05)
      .add(new THREE.Vector3(0, top ? 0.115 : 0.07, 0))
  }
  /** how many more are waiting in the fridge for room on the tray (shown by it) */
  const [trayMore, setTrayMore] = useState(0)

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

  const plateAt = (n: number) => atHome(`plate-${n}`, clearSpot('plate', n, PLATE_R, (m) => {
    // (as many as are needed go round the fire on the table's top, the first where the others start)
    const [x, y, z] = PLATE_TOP
    const r0 = Math.hypot(x, z)
    const a0 = Math.atan2(z, x)
    const step = 2 * Math.asin(Math.min(1, (PLATE_STEP / 2) / r0))     // angle between neighbouring plates
    const order = [0, 1, -1, -2, -3, -4, -5]                             // in steps, from the first plate
    const lap = Math.floor(m / order.length)
    const a = a0 + order[m % order.length] * step + lap * step / 2
    const r = r0 + lap * PLATE_STEP
    const v = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    clearOfHearth(v, PLATE_R)
    return v
  }))
  /**
   * Where the n-th of a row of spots (`spot(m)`, the m-th of them) is that's clear of all that stands on the table and on it, not off its
   * edge: a plate or a dish set out goes there (the owner saw grilled food on a plate half under the bucket: the plates went round the fire
   * one after another whatever stood there). Worked out again only every half second (nothing on the table moves faster).
   */
  const spotCache = useRef(new Map<string, { t: number; v: THREE.Vector3 }>())
  const clearSpot = (kind: string, n: number, r: number, spot: (m: number) => THREE.Vector3) => {
    const key = `${kind}-${n}`, now = performance.now()
    const hit = spotCache.current.get(key)
    if (hit && now - hit.t < 500) return hit.v.clone()
    const things = standing()
    const a0 = COOK_TABLE.along[0] - FIRE_SHIFT.dot(ALONG) + r + 0.16, a1 = COOK_TABLE.along[1] - FIRE_SHIFT.dot(ALONG) - r - 0.16
    const l0 = COOK_TABLE.lay[0] - FIRE_SHIFT.dot(LAY) + r + 0.16, l1 = COOK_TABLE.lay[1] - FIRE_SHIFT.dot(LAY) - r - 0.16
    let free = -1, v = spot(n)
    for (let m = 0; m < 48; m++) {
      const c = spot(m)
      const a = c.dot(ALONG), l = c.dot(LAY)
      if (a < a0 || a > a1 || l < l0 || l > l1) continue
      if (things.some((t) => Math.hypot(t.p.x - c.x, t.p.z - c.z) < t.r + r * 0.85)) continue
      if (++free === n) { v = c; break }
    }
    spotCache.current.set(key, { t: now, v })
    return v.clone()
  }
  /** what stands on the table that a plate or a dish set out mustn't go under or into: the bucket, the bin, the tray, the lantern, the
   * baskets, the rice balls' dish, the tasting bowl, the crate (round footprints) */
  const standing = () => {
    const out: { p: THREE.Vector3; r: number }[] = []
    const keys = ['tray', 'lantern', 'bowl-0', ...(carriers.bin ? ['bin'] : []), ...(roast.trash ? ['trash'] : []), ...(roast.rawDish ? ['rawdish'] : []),
      ...(roast.basket ? Array.from({ length: basketCount }, (_, n) => `basket-${n}`) : [])]
    for (const k of keys) out.push(...circlesOf(k, containerAt(k)))
    out.push({ p: new THREE.Vector3(DECOR.crate.at[0], 0, DECOR.crate.at[1]), r: DECOR.crate.r })
    return out
  }
  const boxPlaced = useRef(false)
  const [plateCount, setPlateCount] = useState(1)
  const carriedOut = useRef(false)
  const shattered = useRef(new Set<string>())
  // charcoal added is thrown in: a few sticks leave the hand (or the crate), fly in an arc, land on the heap, bounce, tip and lie
  // where they land, a burst of sparks and ash where each strikes. Each stick starts black and kindles on its own, over some
  // seconds, to red-hot (its glow reddening, its face going ashy grey), as binchotan does
  type Coal = { g: THREE.Object3D; mat: CoalLook; x: number; y: number; z: number; vx: number; vz: number; vy: number; rx: number; rz: number; ry: number
    sx: number; sz: number; settled: boolean; top: number; delay: number; heat: number; bounced: boolean
    /** how hard it was thrown (0 dropped gently .. 1 flung): how high it bounces; and a hop it's been jolted into by another landing hard by it */
    force?: number; hopY?: number; hopV?: number
    /** seconds since it landed, whether it's burnt out, and how long it's been going out when it's pushed out by the new */
    age: number; gone: boolean; dying: boolean; dyT: number
    /** where it lies in plan (its landing), the way it points, how steeply it tips, and the pose it settles to */
    tx: number; tz: number; yaw: number; slope: number; lx: number; lz: number; ly: number; qEnd: THREE.Quaternion
    /** which of the six sticks it is, and its size against the model's (its pose is `g`: the fire's drawn instanced, coalLayer) */
    shape: number; wide: number; long: number }
  const coals = useRef<Coal[]>([])
  /** whether the bed has been laid with its first sticks */
  const bedSeeded = useRef(false)
  // (the same sticks as the crate's, from Blender (blender/binchotan.py): each thrown one its own of the six, its own length and thickness)
  const bin = useBinchotan()
  /** a stick from the crate: one of the six, its own length and thickness */
  const stickSize = () => ({ shape: Math.floor(Math.random() * 6), wide: (0.03 + Math.random() * 0.006) / MODEL_R, long: (0.28 + Math.random() * 0.12) / MODEL_LEN })
  // (the sticks on the fire and the crumbs they break into, all drawn by a few instanced meshes: their poses and looks written in each frame)
  const coalDraw = useMemo(() => coalLayer(bin), [bin])
  useEffect(() => () => coalDraw.dispose(), [coalDraw])
  /** the pieces of sticks that burnt through and broke: falling onto what's under them, lying there as grey ash a while, then gone */
  type Crumb = { id: number; shape: number; sy: number; mat: CoalLook; x: number; y: number; z: number; ty: number; vy: number; q: THREE.Quaternion; age: number; m: THREE.Object3D }
  const crumbs = useRef<Crumb[]>([])
  const crumbSeq = useRef(0)
  /** a stick burnt through gives way: it's gone from the heap (what lay on it comes down) and its pieces fall */
  const breakStick = (c: Coal) => {
    c.gone = true
    if (c.g) c.g.visible = false
    const below: Lay[] = []
    for (const o of coals.current) if (o && o !== c && !o.gone && !o.dying && o.top < c.top + 0.01) below.push({ x: o.tx, z: o.tz, yaw: o.yaw, y: o.top, slope: o.slope })
    const parts = crumble({ x: c.tx, z: c.tz, yaw: c.yaw, y: c.top, slope: c.slope }, below, Math.random, PIT_LIFT)
    const made = parts.map((p) => {
      // (burnt through: grey ash, granular, the pieces' shapes but the ash's own face)
      const mat = coalLook()
      // (lying on its side the way it fell, a little askew)
      const q = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, new THREE.Vector3(Math.cos(p.yaw), (Math.random() - 0.5) * 0.4, Math.sin(p.yaw)).normalize())
        .multiply(new THREE.Quaternion().setFromAxisAngle(UP_AXIS, Math.random() * 6))
      const shape = Math.floor(Math.random() * 6), m = new THREE.Object3D()
      m.position.set(p.x, c.y + 0.004, p.z)
      m.quaternion.copy(q)
      return { id: crumbSeq.current++, shape, sy: Math.max(0.02, p.len) / bin.chunkShape(shape).len, mat, x: p.x, y: c.y + 0.004, z: p.z, ty: p.y, vy: 0, q, age: 0, m } as Crumb
    })
    crumbs.current = [...crumbs.current, ...made].slice(-40)
    burst(c.x, c.top, c.z)
    restack()
  }
  // sparks and ash flung up where the sticks land: two little point clouds, each particle with its own life
  const SPARKS = 80
  const sparkPts = useRef<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; ash: boolean }[]>([])
  const sparkGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)); return g }, [])
  const ashGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3)); return g }, [])
  const burst = (x: number, y: number, z: number) => {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.15 + Math.random() * 0.35
      sparkPts.current.push({ x, y, z, vx: Math.cos(a) * v, vy: 0.5 + Math.random() * 0.9, vz: Math.sin(a) * v, life: 0.5 + Math.random() * 0.7, ash: i % 3 === 0 })
    }
    if (sparkPts.current.length > SPARKS * 2) sparkPts.current.splice(0, sparkPts.current.length - SPARKS * 2)
  }
  /** each stick's pose as it stands in the bundle (game/coalPile's standStick: upright, its foot on the bed, leaning in) */
  const restack = () => {
    for (const c of coals.current) {
      if (!c || c.gone || c.dying) continue
      c.qEnd.setFromUnitVectors(UP_AXIS, new THREE.Vector3(Math.cos(c.yaw), c.slope, Math.sin(c.yaw)).normalize())
    }
  }
  /** a stick that has burnt down to ash: the only kind that's cleared to make room (a burning one isn't pushed out by new charcoal) */
  const ashedOut = (c: Coal) => c.age / COAL_LAST_S > 0.72
  /** whether there's room on the bed for more: under the most sticks it holds, or some already ash to be cleared */
  const roomForCoal = () => {
    const alive = coals.current.filter((c) => c && !c.gone && !c.dying)
    return roomFor(alive.length, alive.filter(ashedOut).length, COAL_MAX)
  }
  /** whether one more stick can go on: the bed has room for it, and there's a place on the heap for it to lie (not just a count: a heap piled
   * as high as it goes has none) */
  const canPlaceCoal = () => {
    if (!roomForCoal()) return false
    const lying: Lay[] = []
    for (const c of coals.current) if (c && !c.gone && !c.dying) lying.push({ x: c.tx, z: c.tz, yaw: c.yaw, y: c.top, slope: c.slope })
    return !!standStick(lying, Math.random, PIT_LIFT) || coals.current.some((c) => c && !c.gone && !c.dying && ashedOut(c))
  }
  /** charcoal onto the fire: a load (the chef, the button), or `count` sticks (one, dragged from the crate by hand) */
  /** a handful of charcoal: six or seven sticks */
  const coalPortion = () => COAL_PER_ADD.min + Math.floor(Math.random() * (COAL_PER_ADD.max - COAL_PER_ADD.min + 1))
  const dropCoals = (from?: { x: number; y: number; z: number }, count?: number, force = 0) => {
    // (only as many as the bed has room for: the most it holds, less those still burning; ones burnt to ash are cleared to make room)
    const aliveNow = coals.current.filter((c) => c && !c.gone && !c.dying)
    const n = Math.min(count ?? COAL_PER_ADD.min + Math.floor(Math.random() * (COAL_PER_ADD.max - COAL_PER_ADD.min + 1)), COAL_MAX - aliveNow.length + aliveNow.filter(ashedOut).length)
    if (n <= 0) return 0
    const base = coals.current.length
    // (a bed only holds so many sticks: when the new ones would take it past the most, the oldest burn out at once, shrinking away)
    const alive = coals.current.filter((c) => c && !c.gone && !c.dying)
    for (const c of alive.filter(ashedOut).slice(0, Math.max(0, alive.length + n - COAL_MAX))) c.dying = true
    // (always out of the crate of binchotan, whether it's clicked or a stick let go over the fire: thrown from there across the table)
    const crateAt = positionOf('crate')
    const start = from ?? { x: DECOR.crate.at[0] + crateAt[0], y: 0.34 + crateAt[1], z: DECOR.crate.at[1] + crateAt[2] }
    const lying: Lay[] = []
    for (const c of coals.current) if (c && !c.gone && !c.dying) lying.push({ x: c.tx, z: c.tz, yaw: c.yaw, y: c.top, slope: c.slope })
    let placed = 0
    for (let k = 0; k < n; k++) {
      // (each stood in its own place in the bundle, one after another, from the middle out, as charcoal's built round a robatayaki's fire;
      // when every place is taken, the oldest stick that's burnt to ash is cleared to make one, and when even that leaves none, the rest stay
      // in the crate)
      let spot = standStick(lying, Math.random, PIT_LIFT)
      for (let tries = 0; !spot && tries < 3; tries++) {
        const oldest = coals.current.find((c) => c && !c.gone && !c.dying && ashedOut(c))
        if (!oldest) break
        oldest.dying = true
        const at = lying.findIndex((l) => l.x === oldest.tx && l.z === oldest.tz)
        if (at >= 0) lying.splice(at, 1)
        spot = standStick(lying, Math.random, PIT_LIFT)
      }
      if (!spot) break
      const { x: tx, z: tz, yaw, rest } = spot
      // (stood straight into its place in the bundle)
      const ly = rest.y
      lying.push({ x: tx, z: tz, yaw, y: rest.y, slope: rest.slope })
      // (the charcoal as it came from the crate; the cracks light up only as it heats (the emissive map))
      const mat = coalLook(), g = new THREE.Object3D()
      g.visible = false
      coals.current[base + k] = { g, mat, x: start.x + (Math.random() - 0.5) * 0.06, y: start.y, z: start.z + (Math.random() - 0.5) * 0.06, vx: 0, vz: 0, vy: 0,
        rx: Math.random() * 3, rz: Math.random() * 3, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14 * (1 + 1.5 * force), sz: (Math.random() - 0.5) * 14 * (1 + 1.5 * force), force,
        settled: false, top: rest.y, delay: k * 0.11 + Math.random() * 0.05, heat: 0, bounced: false, age: 0, gone: false, dying: false, dyT: 0,
        tx, tz, yaw, slope: rest.slope, lx: spot.from.x, lz: spot.from.z, ly, qEnd: new THREE.Quaternion(), ...stickSize() }
      placed++
    }
    if (!placed) return 0
    restack()
    // (the flight to each one's place: about two thirds of a second)
    for (let k = 0; k < placed; k++) {
      // (thrown harder, it gets there sooner, flatter and faster)
      const c = coals.current[base + k], T = (0.5 + Math.random() * 0.25) * (1 - 0.55 * force)
      c.vx = (c.lx - c.x) / T
      c.vz = (c.lz - c.z) / T
      c.vy = (c.ly - c.y + 0.5 * 9.8 * T * T) / T
    }
    return placed
  }
  // (the fire bar's button, in App: a portion out of the crate, as many as the bed takes; it pays for those)
  useEffect(() => {
    if (!active || !bar) return
    COAL_BRIDGE.place = () => (fire && fire.current >= 1 - 1e-6 ? 0 : dropCoals(undefined, Math.min(SUPPLIES.coal(), coalPortion())))
    return () => { COAL_BRIDGE.place = null }
  })
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __dropCoals: dropCoals, __fire: fire, __coals: coals, __pieces: pieces })
  const [shards, setShards] = useState<{ id: number; x: number; y: number; z: number; s: number; r: number; t: number }[]>([])
  /** the kitchen's floor, where a dish let go off the table lands (the scene's y) */
  const FLOOR_Y = GRILL_OFFSET.y - KITCHEN_DROP
  const LIFT = 0.25
  /** whether a place (the scene's x, z) is off the cook's table (past its edges, less the thing's own radius) */
  const outsideTable = (at: THREE.Vector3, r: number) => {
    const a = at.dot(ALONG) + FIRE_SHIFT.dot(ALONG), l = at.dot(LAY) + FIRE_SHIFT.dot(LAY)
    // (and over the notch cut into its front: nothing to stand on there)
    const inNotch = a > COOK_NOTCH.along[0] + 0.05 && a < COOK_NOTCH.along[1] - 0.05 && l > COOK_NOTCH.lay[0] + 0.05
    return inNotch || a < COOK_TABLE.along[0] - 0.05 || a > COOK_TABLE.along[1] + 0.05 || l < COOK_TABLE.lay[0] - 0.05 || l > COOK_TABLE.lay[1] + 0.05 - 0 * r
  }
  /** a container at home, moved by its nudge (no spare plates or dishes stacked on the table any more: they're all in the dish cabinet, but
   * for the tasting bowl; a plate or a side dish is on the table only while something's on it) */
  function atHome(key: string, home: THREE.Vector3) {
    return home.clone().add(nudge(key))
  }
  const bowlAt = () => { const v = new THREE.Vector3(...BOWL_TOP).add(nudge('bowl-0')); clearOfHearth(v, BOWL_R); return v }
  const basketAt = (n: number) => {
    // (the first stands at the table's left end; more, as they're needed, stand on the table's top in a row)
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
    if (kind === 'rawdish') return atHome('rawdish', new THREE.Vector3(...(roast.rawDish?.at ?? [0, 0, 0])))
    if (kind === 'bowl') return bowlAt()
    return kind === 'plate' ? plateAt(+n) : kind === 'dish' ? dishAt(+n) : basketAt(+n)
  }
  /** where the fan hangs: from its peg past the ledge's left end, its paper's middle below it (Decor turns it to face the cook) */
  const fanAt = () => containerAt('box').addScaledVector(ALONG, FAN_PEG.along).add(new THREE.Vector3(0, FAN_PEG.up - FAN_DROP, 0))
  const footprint = (key: string) => {
    const kind = key.split('-')[0]
    return { plate: PLATE_R, dish: DISH_R, basket: BASKET_R, box: BOX_R, bin: BIN_R, tray: 0.6, trash: TRASH_R, rawdish: DISH_R, bowl: BOWL_PUSH, lantern: DECOR.lantern.r }[kind] ?? 0.3
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
    'bowl-0',
    'lantern',
  ]
  /**
   * Keep a moved container from passing through things: out of the stone ring, and clear of every other
   * plate, dish, basket, the box and the bin (round footprints, pushed apart until they just touch).
   */
  const settle = (key: string, at: THREE.Vector3, stacking = false) => {
    // (the ledge is fixed to the hearth: nothing pushes it, and it pushes nothing (it's up off the table, over the cook's place))
    if (FIXED.has(key)) return at
    const r = footprint(key)
    // (what it's stacked with doesn't push it away; nor, while an empty one is carried, other empty ones it could go on)
    const others = containerKeys().filter((k) => k !== key && !FIXED.has(k) && !sameStack(k, key) && !(stacking && STACKABLE(k) && !holds(k)))
      .flatMap((k) => circlesOf(k, containerAt(k)))
    // the crate (the fan hangs on its hook, up off the table)
    for (const d of [DECOR.crate, DECOR.rice]) others.push({ p: new THREE.Vector3(d.at[0], 0, d.at[1]), r: d.r })
    // the bar behind the fire (shop open) is in the way too
    if (bar) for (const c of GRILL_COUNTERS) for (let k = -2; k <= 2; k++) others.push({ p: toGrillScene(c.at.clone().addScaledVector(c.along, k * c.length / 4.5)).sub(FIRE_SHIFT), r: 0.42 * GRILL_SCALE })
    // the soup bowls on the table are in the way too
    root.traverse((o) => {
      const id = o.userData.itemId as string | undefined
      if (id && roast.drinks?.includes(id) && o.visible && o.scale.x > 0.01) others.push({ p: o.position.clone(), r: id === 'Sake' ? 0.22 : 0.19 })
    })
    // (what's kept in the cubbies under the top isn't in the way of anything on it)
    for (let k = others.length - 1; k >= 0; k--) if (others[k].p.y < -0.1) others.splice(k, 1)
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
      // (kept off the square hearth: a round thing by its reach, the tray (a long board, square to the table) by its whole length and width)
      // (the tasting bowl by its whole rim, as where it's drawn is worked out: else the two disagree and it creeps a little each time)
      if (key === 'tray') clearOfHearth(at, 0.04, TRAY_W, TRAY_D)
      else clearOfHearth(at, key === 'bowl-0' ? BOWL_R : r)
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
  /** while the shop's closed and the cook's at it by hand, everything that comes off the fire goes into the tasting bowl */
  const inBowl = (p: Piece) => (p.collected ? !!p.container?.startsWith('bowl') : space !== 'open' && byHandRef.current)
  const inBasket = (p: Piece) => !inBowl(p) && space !== 'open' && !!roast.basket && !!roast.basketItems?.includes(p.id)
  // onigiri and mochi off the grill net go on little side dishes of their own
  const onDish = (p: Piece) => !inBowl(p) && space !== 'open' && !!roast.dish && !!roast.net?.includes(p.id)
  const dishAt = (n: number) => {
    // (as many as are needed in a row on the table's top, clear of what stands there)
    const [x, y, z] = DISH_TOP
    return atHome(`dish-${n}`, clearSpot('dish', n, DISH_R, (m) => new THREE.Vector3(x, y, z).addScaledVector(STACK_DIR, -Math.max(0, m - 1) * DISH_STEP)))
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
    // (and back on its hearth if it was ever let fall off the table, as it could be before it was fixed in place)
    const ledge = moved.current.get('box')
    if (ledge && (Math.abs(ledge.y) > 1e-4 || outsideTable(containerAt('box'), footprint('box')))) { moved.current.delete('box'); boxPlaced.current = false }
    if (carriers.box && !boxPlaced.current && !moved.current.has('box')) {
      boxPlaced.current = true
      const want = new THREE.Vector3().addScaledVector(ALONG, BOX_SPOT.along).addScaledVector(LAY, BOX_SPOT.lay)
      moved.current.set('box', new THREE.Vector3(want.x - carriers.box[0].home.x, 0, want.z - carriers.box[0].home.z))
    }
    for (let pass = 0; pass < 3; pass++) {
      for (const key of containerKeys()) {
        // (a stack stays where it was put; what's kept in the cubby under the table stays there till it's taken out)
        if (stackOn.current.has(key) || key === 'bin' || key === 'tray' || outsideTable(containerAt(key), footprint(key))) continue
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
  const destination = (p: Piece) => (space === 'open' && (p.container === 'bar' || (!p.collected && ownerOf(p))) ? 'bar' : inBowl(p) ? 'bowl' : inBasket(p) ? 'basket' : onDish(p) ? 'dish' : 'plate')

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
  /**
   * A piece for the plating place put to a slot there: the seat's own, if one's set out for it; else a free one, a plate laid in it off the plating place's stack
   * if the seat's plate isn't out yet (else the piece goes loose, to be added to the plate at the seat). None to be had (no slot free, or no
   * plate stacked there yet: the kitchen's gone for some), false: it stays held where it is, and is asked for again
   */
  const plateReady = (p: Piece) => {
    let k = PLATING.slots.findIndex((sl) => sl?.seat === p.seat)
    if (k < 0) {
      const plated = PLATES_OUT.has(p.seat)
      const free = PLATING.slots.findIndex((sl) => sl === null)
      if (free < 0 || (!plated && PLATING.stock <= 0)) return false
      k = free
      PLATING.slots[k] = { seat: p.seat, plate: !plated, flying: 1, landed: 0 }
      if (!plated) PLATING.stock -= 1
    }
    const row = pieces.current.filter((q) => q !== p && q.via === 'plated' && q.readyAt === k && !q.eaten && q.trash < 0 &&
      !SERVICE.claimed.has(q.key) && !SERVICE.carried.has(q.key)).length
    p.readyAt = k
    p.toP.copy(readyFoodAt(k, row, PLATING.slots[k]!.plate))
    p.local.copy(p.toP).sub(containerAt('bar'))
    return true
  }
  /**
   * The open shop: a cooked piece goes to the customer who's owed one of these, onto their plate at the bar (pieces already on it push the
   * new one along), or, with a server on the floor, out to the plating place, plated there for them to carry over (the owner's: the kitchen plates,
   * the floor only carries)
   */
  const serveTo = (p: Piece, owner: Guest) => {
    const seat = owner.seat
    p.guest = owner.id
    p.seat = seat
    const row = pieces.current.filter((q) => q !== p && q.collected && q.container === 'bar' && q.seat === seat && present(q) && !q.eaten).length
    p.toP.copy(barSeat(seat)).addScaledVector(GRILL_SEATS[seat].along, ((row % 3) - 1) * 0.07 * GRILL_SCALE).add(new THREE.Vector3(0, BAR_TOP_SCENE + 0.04 + Math.floor(row / 3) * 0.06, 0))
    p.container = 'bar'
    p.body = null
    if (p.loose) flatQ(p, p.toQ, LAY_DIR)
    // (across the plating place, side by side; on a customer's plate along it)
    else flatQ(p, p.toQ, SERVICE.servers && bar ? PLATING_ACROSS : STACK_DIR)
    p.local.copy(p.toP).sub(containerAt('bar'))
    if (SERVICE.servers && bar) {
      p.via = 'plated'
      p.readyAt = undefined
      plateReady(p)
    }
  }
  /** the chef says something, now and then (not more often than every two and a half seconds) */
  const chefSay = (text: string) => {
    if (performance.now() - chefSaid.current > 2500) {
      chefSaid.current = performance.now()
      onSay?.('chef', text)
    }
  }
  /** into the bin with it: a short arc down into the cook table's bin (the frame loop flies it), and gone */
  const binIt = (p: Piece) => {
    SERVICE.waiting.delete(p.key)
    p.via = undefined
    p.readyAt = undefined
    p.trashFrom.copy(p.node.position)
    p.trash = 0
    p.node.userData.onPlate = true
  }
  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    const bowl = inBowl(p)
    const basket = inBasket(p)
    const dish = onDish(p)
    // take the first free spot where it's going (basket, dishes or plates); eaten food frees its spot
    const taken = new Set(pieces.current.filter((q) => q.slot !== null && !q.eaten && present(q) &&
      destination(q) === destination(p)).map((q) => q.slot))
    let slot = 0
    while (taken.has(slot)) slot++
    // (food comes off the fire onto a plate only if that plate is on the cook's table: a plate carried off it, or fallen to the floor, takes nothing)
    if (bowl) {
      if (outsideTable(bowlAt(), BOWL_R)) { onNotice?.('offTable'); return }
    } else if (space !== 'open' && !basket && !dish) {
      const pl = plateAt(Math.floor(slot / PER_PLATE))
      if (outsideTable(pl, PLATE_R)) { onNotice?.('offTable'); return }
    }
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
      serveTo(p, owner)
      return
    }
    // (the shop open and cooked for nobody, its customer gone before it was done: straight into the bin (the owner's: what nobody wants is
    // thrown away), not onto a plate on the cook's table, where it looked as if someone were eating there, tasting it)
    if (space === 'open' && roast.trash) {
      binIt(p)
      chefSay(L().orphanAway)
      return
    }
    if (bowl) {
      // laid side by side across the bowl like on a plate, the skewers' sticks resting across its rim; a full row starts a layer on top
      const within = slot % PER_PLATE
      const col = within % PER_LAYER
      const layer = Math.floor(within / PER_LAYER)
      const across = (col - (PER_LAYER - 1) / 2) * SLOT_GAP + (layer % 2) * (SLOT_GAP / 2)
      p.toP.copy(bowlAt()).addScaledVector(STACK_DIR, across)
      p.toP.y += (p.loose ? 0.07 : BOWL_RIM + 0.02) + layer * LAYER_HEIGHT
      p.container = 'bowl-0'
    } else if (basket) {
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
    if (basket && !bowl) p.container = 'basket-0'
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
    // (tasting by hand: the boss goes over to it and eats it there, one at a time; at the bar the customers eat for themselves)
    if (space !== 'open') {
      if (BOSS_TASTE.at || pieces.current.some((q) => q.awaitBoss)) return
      p.awaitBoss = performance.now()
      BOSS_TASTE.at = p.node.getWorldPosition(new THREE.Vector3())
      BOSS_TASTE.arrived = false
      return
    }
    p.eat = 0.0001
  }

  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __eat: eat, __collect: collect, __times: roast.times })
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
  const fanned = useRef({ extra: 0, last: 0, pending: 0 })
  const [decorTip, setDecorTip] = useState<'charcoal' | 'fan' | null>(null)
  // how many things have gone in the bin (it starts empty), and the fire glowing as raw food is carried over it
  const trashedRef = useRef(0)
  const flashUntil = useRef(new Map<string, number>())
  const [trashed, setTrashed] = useState(0)
  const [fireHint, setFireHint] = useState(0)
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  // (with the shop open nothing is cooked or seasoned by hand: the cooks do it; see game/mode)
  const byHand = canCookByHand(modeOf(ai, research))
  const byHandRef = useRef(byHand)
  byHandRef.current = byHand

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
  /** a portion of `id` the open shop's kitchen can make a new order from: put out before, eaten (or binned) and cleared away, and out of
   * everyone's hands (not `taken` already for this order) */
  const recyclable = (id: string, taken: Set<Piece>) => pieces.current.find((q) => q.id === id && menuIds.has(q.id) && present(q) && q.eaten &&
    q.trash < 0 && !q.carried && !q.via && !taken.has(q) && !SERVICE.waiting.has(q.key) && !SERVICE.carried.has(q.key) && !SERVICE.claimed.has(q.key))
  /** made again: back as it was before it was ever cooked, to be brought out raw on the tray as the order's (next frame: present, not yet seen) */
  const revive = (p: Piece) => {
    fresh(p)
    p.via = undefined
    p.readyAt = undefined
    p.small = false
    SERVICE.delivered.delete(p.key)
    for (const { mat, foil } of p.mats) {
      if (foil || mat.side === THREE.FrontSide) continue
      mat.side = THREE.FrontSide
      mat.needsUpdate = true
    }
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
    // (each opening a clean kitchen: the last day's leftovers (raw skewers set out, half-cooked ones, a plate nobody came for) aren't
    // brought back onto the table (the owner saw skewers there that nobody had ordered); the shut shop's table comes back as it was left.
    // What stands on the table stays where it stood, though: the seasoning ledge, the board, the bucket, the bin, the basket and the bowl
    // keep their places (and what edit mode did to them), only the plates and dishes put out going; cleared with the rest, the ledge went
    // back to the model's own place at every opening (placed once, by boxPlaced) and the edit's moves were lost (the owner saw it shift))
    const stands = [...moved.current].filter(([k]) => !STACKABLE(k)).map(([k, v]) => [k, v.clone()] as const)
    load(space === 'open' ? undefined : snaps.current.get(space))
    if (space === 'open') for (const [k, v] of stands) moved.current.set(k, v)
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
  // (the day's pattern of trade, drawn as the shop opens (game/flow), and when it opened on the shop's clock; the chef says what kind of day it is)
  const flow = useRef<FlowKind>('steady')
  const openedAt = useRef(0)
  useEffect(() => {
    if (!ai || !bar) return
    flow.current = flowOf(OPENINGS.n++)
    openedAt.current = guestTime.current
    const t = window.setTimeout(() => onSay?.('chef', FLOWS[flow.current].say[lang]), 1500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai])
  const chefClock = useRef(0)
  const guests = useRef<Guest[]>([])
  /** the customers who've said how dark it is (once each) */
  const darkSaid = useRef(new Set<number>())
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
    const say = chefSay
    // (the head chef's next trip, first come first fetched, while he's at his place: with something on the fire he goes meanwhile)
    const T = CHEF_TRIP
    // (the chef walking the orders and carrying what's cooked: one thing at a time with his hands; away fetching, or carrying, nothing else
    // is put on or taken off till he's back (with nobody walking (shut, a phone) pieces go across by themselves, as they did))
    const chefLive = performance.now() - T.seenAt < 1000
    // (asked each time: a trip begun just now, or a piece taken up just now, makes him busy for what comes after in the same step)
    const busy = () => chefLive && (T.phase === 'toStore' || T.phase === 'taking' || T.phase === 'toBoard' || CHEF_CARRY.key !== null)
    const carry = (p: Piece, kind: 'toFire' | 'toPlate') => {
      const C = CHEF_CARRY
      C.key = p.key; C.kind = kind; C.phase = 'reach'; C.t = 0
      C.from.copy(p.node.position); C.fromQ.copy(p.node.quaternion)
    }
    if (T.phase === 'idle' && chefLive && CHEF_CARRY.key === null) {
      const trip = nextTrip(pieces.current.filter((p) => p.fetching && present(p)).map((p) => ({ key: p.key, id: p.id, at: p.stagedAt })))
      if (trip) { T.store = trip.store; T.keys = trip.keys; T.t = 0; T.phase = 'toStore' }
    }
    // the owner is the head chef and works the grill by hand; a hired chef cooks alongside (takes things off when
    // done, seasons them), the sous chef does the rest (keeps the fire up, puts what's waiting on, clears away)
    // (with the shop open the kitchen cooks by itself: the owner's own cook does all of it, a hired chef or sous chef working alongside)
    const hasChef = true, hasSous = true
    if (fire && fire.current < 0.35) {
      // (a handful out of the crate, as many as the bed takes; paid for only those, and none at all when it's full)
      if (!roomForCoal()) return
      // (no more than the sack has: none left, the chef says so now and then)
      const left = SUPPLIES.coal()
      if (left < 1) { say(L().noCharcoal); return }
      const placed = dropCoals(undefined, Math.min(left, coalPortion()))
      if (!placed || onAddCharcoal?.(placed) === false) return
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
    // (cooked for someone who's since gone: left on the cook's table with no one to go to, or out on the plating place for a customer who's left;
    // the next customer owed one of these has it at once, and if nobody is, after a while it's cold and it's binned)
    if (space === 'open') {
      const here = (id: number) => guests.current.some((g) => g.id === id && (g.state === 'waiting' || g.state === 'eating'))
      const stray = live.find((p) => p.collected && (p.flight >= 1 || (p.via === 'plated' && p.readyAt === undefined)) && !p.stickOnly &&
        !SERVICE.claimed.has(p.key) && !SERVICE.carried.has(p.key) && (p.container !== 'bar' || (p.via === 'plated' && !here(p.guest))))
      if (stray) {
        const was = stray.guest
        stray.guest = -1
        const owner = ownerOf(stray)
        if (owner) {
          SERVICE.waiting.delete(stray.key)
          stray.via = undefined
          stray.readyAt = undefined
          stray.slot = null
          stray.flight = 0
          stray.fromP.copy(stray.node.position)
          stray.fromQ.copy(stray.node.quaternion)
          serveTo(stray, owner)
          say(L().orphanAgain(nameOfP(stray)))
          return
        }
        stray.guest = was
        if (roast.trash) {
          binIt(stray)
          say(L().orphanAway)
          return
        }
      }
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
      // (none left in stock: it goes without, and the cook says so)
      if (!season(p, k)) { say(L().outOf(k)); return }
      emit(k, p.node.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 30)
      say(L().seasoned(nameOfP(p), k))
    }
    if (ready && !busy()) {
      collect(ready)
      // (off the fire in his hands to the plating place, when it's going there and has a place)
      if (chefLive && ready.collected && ready.via === 'plated' && ready.readyAt !== undefined) carry(ready, 'toPlate')
      say(L().done(nameOfP(ready)))
      for (const k of planOf(ready)) if (!ready.dabs[k] && bestStage(k) === 'after') dab(ready, k)
      return
    }
    // (half way through, the chef tends what's on: the salted ones' coals fanned a moment (a little heat banked for the fire), a glaze
    // brushed on at its own time below)
    const toTend = live.find((p) => !p.collected && !p.staged && p.homeFlight >= 1 && !p.tended && p.progress / roast.times[p.id] >= TEND_AT)
    if (toTend) {
      toTend.tended = true
      if (tendOf(planOf(toTend)) === 'fan' && (T.phase === 'idle' || T.phase === 'prepping') && fire && fire.current > 0.02) {
        T.fanUntil = performance.now() + 2200
        fanned.current.pending = Math.min(FAN_MAX - fanned.current.extra, fanned.current.pending + FAN_MAX * 0.25)
        fanned.current.last = performance.now()
        say(L().fanned(nameOfP(toTend)))
        return
      }
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
    const next = hasSous || hasChef ? live.filter((p) => p.staged && !p.fetching && !((p.prepUntil ?? 0) > performance.now()))
      .sort((a, b) => a.stagedAt - b.stagedAt)[0] : undefined
    if (next && !busy() && putOnFire(next)) {
      // (in his hands from the board to its place in the fire)
      if (chefLive) carry(next, 'toFire')
      say(L().onFire(nameOfP(next)))
    }
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
    // (how far into the session it is, a session being some minutes of the shop's clock, and so how busy the day's pattern runs just now)
    const dayK = (now - openedAt.current) / SESSION_LEN
    const fl = FLOWS[flow.current]
    // (the room's light: nobody comes into a dark shop, those in it say so once, and wait less long in a dim one, much less in the dark)
    const mood = roomMood(getLights().on, typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark')
    if (mood !== 'lit') {
      for (const g of seated) {
        if (darkSaid.current.has(g.id)) continue
        darkSaid.current.add(g.id)
        onSay?.('guest', L().dark(g.id))
        break
      }
    }
    if (onOrder && !SHOP.closing && comesIn(mood) && seated.length < MAX_SEATED && guestClock.current > (7 + Math.random() * 6) * crowd * fl.gap(dayK)) {
      guestClock.current = 0
      // (someone still getting up counts as there: the stool's not free till they've gone and their plate's cleared)
      const used = new Set(guests.current.filter((g) => g.state === 'waiting' || g.state === 'eating' || !g.cleared).map((g) => g.seat))
      // (nor one the room still has somebody at: getting up and going, or away at the toilet)
      for (const n of SEATS_TAKEN) used.add(n)
      const free = (n: number) => n < BAR_SEATS && !used.has(n)
      // now and then a couple comes in together, if two stools side by side on one counter are free: a young man and
      // a young woman (the next ids that are), sat next to each other
      const pairAt = Math.random() < Math.min(0.9, fl.pairs * flowerBuffs(SHRINE_FLOWERS).pairs)
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
        const want = Math.max(1, wantOf(flow.current, Math.random(), Math.random())) + (blessed && Math.random() < 0.6 ? 1 : 0)
        const orders: string[] = []
        const said: string[] = []
        for (let j = 0; j < (entries ? Math.min(want, blessed ? 3 : 2) : want); j++) {
          if (entries) {
            // a dish (or a set) off the menu, made the way it's listed
            const e = entries[Math.floor(Math.random() * entries.length)]
            if (!e || !e.parts.every((pt) => pt.id in roast.times)) continue
            wants.current.push(...e.parts)
            // (its parts made from portions already used and cleared, where there are any)
            const again: Piece[] = []
            for (const pt of e.parts) {
              const q = recyclable(pt.id, new Set(again))
              if (q) again.push(q)
            }
            const reuse: Record<string, number> = {}
            for (const q of again) reuse[q.id] = (reuse[q.id] ?? 0) + 1
            if (onOrderEntry?.(e.key, id, reuse)) {
              // (its prep: rice washed and cooked, the soup, what's rinsed)
              meterWater('cooking', e.parts.length)
              for (const q of again) revive(q)
              orders.push(...e.parts.map((pt) => pt.id))
              said.push(e.name)
            } else {
              wants.current.splice(wants.current.length - e.parts.length, e.parts.length)
            }
            continue
          }
          const pick = itemIds.filter((x) => x in roast.times)[Math.floor(Math.random() * itemIds.filter((x) => x in roast.times).length)]
          const again = pick ? recyclable(pick, new Set()) : undefined
          if (pick && onOrder(pick, id, !!again)) {
            if (again) revive(again)
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
          // (came in and found nothing they could have: a visit of its own, and not a happy one)
          onVisit?.({ id, taste: null, waited: 0, walkedOut: true, gripes: ['nothing'] })
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
      if (g.eaten.length === 0 && now - g.since > PATIENCE * flowerBuffs(SHRINE_FLOWERS).patience * patienceIn(mood)) {
        g.state = 'angry'
        if (mood === 'dark') gripe(g.id, 'dark')
        const owed = [...g.orders]
        for (const a of g.ate) owed.splice(owed.indexOf(a), 1)
        onWalkOut?.(owed, g.id)
        onSay?.('guest', mood === 'dark' ? L().darkGone(g.id) : L().angry(g.id))
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
      // (their visit, scored: the food, the wait for it, what put them out (the tissues, the toilet, the dark, their stomach))
      const gr = GRIPES.get(g.id) ?? new Set<Gripe>()
      if (SICK.has(g.id)) gr.add('sick')
      if (WC_GRUMBLE.has(g.id)) gr.add('toilet')
      const waited = (g.firstAte ?? now) - g.since
      if (waited > 180) gr.add('wait')
      onVisit?.({ id: g.id, taste: g.eaten.length ? g.eaten.reduce((a, b) => a + b, 0) / g.eaten.length : null, waited, walkedOut: g.state === 'angry', gripes: [...gr] })
      GRIPES.delete(g.id)
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
      // (and as fresh as what it was made from: a tired fish tastes of it)
      // (and as they're feeling: a dirty toilet, or one with no paper, sours what they eat after it)
      const fresh = PANTRY.fresh[dish.id] ?? 100
      const taste = Math.max(0, tasteOf(dish) * freshFactor(fresh) - (asOrdered ? 0 : 15) - (WC_GRUMBLE.get(g.id) ?? 0))
      // (made with what wasn't fit to eat: likely as not it upsets their stomach, and they're off to the toilet)
      const sick = Math.random() < sickChance(fresh)
      dish.node.userData.byGuest = true
      eat(dish)
      g.firstAte ??= now
      g.eaten.push(taste)
      g.ate.push(dish.id)
      g.state = g.eaten.length >= g.orders.length ? 'done' : 'eating'
      const stars = taste >= 80 ? 5 : taste >= 65 ? 4 : taste >= 45 ? 3 : taste >= 25 ? 2 : 1
      window.setTimeout(() => {
        if (sick) SICK.add(g.id)
        onSay?.('guest', sick ? L().sick(g.id, nameOfP(dish)) : L().verdict(g.id, nameOfP(dish), stars))
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
  // (the utensils' thin handles cast no shadow: from the spot high over the bar they only laid thin dark stripes across the table)
  useEffect(() => {
    for (const t of tools) t.node.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false })
  }, [tools])
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
  // (the cutting board, the seasoning box and the water bucket are moved in edit mode by the same nudge a hand moves them by: the change in what
  // the edit says is added to it, and the box's pots and the bucket's dipper go along)
  const { offsets: editOffsets } = useEdit()
  const editSeen = useRef<Record<string, THREE.Vector3>>({})
  useLayoutEffect(() => {
    let any = false
    for (const [key, id] of Object.entries(EDIT_PIECES)) {
      const at = new THREE.Vector3(...positionOf(id))
      const was = editSeen.current[key] ?? new THREE.Vector3()
      const d = at.clone().sub(was)
      if (d.lengthSq() < 1e-10) continue
      editSeen.current[key] = at
      const next = nudge(key).clone().add(d)
      moved.current.set(key, next)
      // (it can't be set down in the stones or through another piece: pushed clear, as when it's moved by hand)
      const here = containerAt(key)
      const clear = settle(key, here.clone())
      clear.y = here.y
      const push = clear.sub(here)
      next.add(push)
      moved.current.set(key, next)
      // (and the edit's place goes where it's ended up, so its box and handles stay on it, not where it couldn't go)
      if (push.lengthSq() > 1e-8) {
        const o = offsetOf(id)
        editSeen.current[key] = at.clone().add(push)
        settleOffset(id, [o[0] + push.x, o[1] + push.y, o[2] + push.z])
      }
      for (const b of carriers[key] ?? []) b.node.position.copy(b.home).add(next)
      for (const t of tools) {
        if (carrierOf(t.node.name) !== key) continue
        t.home.copy(t.home0).add(next)
        if (t.back >= 1) t.node.position.copy(t.home)
      }
      any = true
    }
    if (any) setMoveTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOffsets, carriers, tools])
  // the pots they stand in: pointing at or grabbing a pot means its utensil
  const pots = useMemo(() => Object.entries(roast.toolPots ?? {}).flatMap(([potName, toolName]) => {
    const pot = root.getObjectByName(potName)
    const tool = tools.find((t) => t.node.name === toolName)
    return pot && tool ? [{ pot, tool }] : []
  }), [root, roast.toolPots, tools])
  const drag = useRef<{ tool: Tool; target: Piece | null; at: THREE.Vector3; pour: number; scoop: number
    /** where it's held, eased after the pointer; its own clock (its working motion); the piece it's over and how long it's been there; the
     * time since it last went on; the pieces it's put some on this time; the grains owed; the time since the last patter */
    base: THREE.Vector3; t: number; on: Piece | null; dwell: number; since: number; dabbed: Set<Piece>; acc: number; tick: number } | null>(null)
  /** the pieces just seasoned, each bouncing a little (how far through, 0..1) */
  const bounces = useRef(new Map<Piece, number>())
  /** the rings spreading where a seasoning's just gone on */
  const ringObjs = useRef<(THREE.Mesh | null)[]>([])
  const ringLife = useRef<number[]>(Array(RINGS).fill(0))
  const ringNext = useRef(0)
  /** a seasoning goes on: the piece seasoned, a burst of it falling, the piece bouncing a little, a ring spreading from it in its colour,
   * and its sound */
  const dabNow = (p: Piece, kind: Seasoning, from: THREE.Vector3) => {
    season(p, kind)
    emit(kind, from.clone().add(new THREE.Vector3(0, -0.04, 0)), kind === 'salt' || kind === 'peanut' || kind === 'shichimi' ? 22 : 10)
    bounces.current.set(p, 0)
    const k = ringNext.current
    ringNext.current = (k + 1) % RINGS
    const ring = ringObjs.current[k]
    if (ring) {
      ring.position.copy(p.node.position).add(new THREE.Vector3(0, 0.03, 0))
      ;(ring.material as THREE.MeshBasicMaterial).color.copy(GRAIN_COLORS[kind])
      ringLife.current[k] = RING_LIFE
    }
    seasonSound(kind)
  }
  /** the dipper pouring out what it scooped, where it was let go: how long it has left (s) */
  const pouring = useRef<{ tool: Tool; left: number; at: THREE.Vector3 } | null>(null)
  /** the water standing in the dipper's cup (shown once it's scooped some up, gone as it's poured out) */
  const dipperWater = useMemo(() => root.getObjectByName('DipperWater') ?? null, [root])
  useLayoutEffect(() => { if (dipperWater) dipperWater.visible = false }, [dipperWater])
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
    // (a dose of it from stock, unless it's one the dish was ordered with, the first time: that went with the order. None left, it doesn't
    // go on)
    const paid = !!p.want?.dabs.includes(kind) && !p.dabs[kind]
    if (kind !== 'water' && !paid && !SUPPLIES.dab(kind)) return false
    const before = tasteOf(p)
    p.dabs[kind]++
    if (kind === 'water') {
      meterWater('dipper')
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
    return true
  }

  // little floating words: how a seasoning changed a piece's 美味
  // (shown in a few places kept mounted, each word taking the next free one: one mounted for each word, a React root and its page element
  // made and thrown away two or three times a second while the chef seasoned, kept in development (the heap rose with them))
  const [pops, setPops] = useState<({ id: number; at: [number, number, number]; text: string; good: boolean } | null)[]>(() => Array(POP_SLOTS).fill(null))
  const popId = useRef(0)
  const pop = (at: THREE.Vector3, delta: number) => {
    if (!delta) return
    const id = ++popId.current
    const text = delta > 0 ? `美味 +${delta}` : `美味 ${delta}`
    setPops((all) => {
      // (the first free place, or the oldest's)
      let k = all.findIndex((x) => !x)
      if (k < 0) k = all.reduce((o, x, i) => (x!.id < all[o]!.id ? i : o), 0)
      const next = all.slice()
      next[k] = { id, at: at.toArray() as [number, number, number], text, good: delta > 0 }
      return next
    })
    window.setTimeout(() => setPops((all) => (all.some((x) => x?.id === id) ? all.map((x) => (x?.id === id ? null : x)) : all)), 1500)
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
      if (!byHandRef.current) return null
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
      if (!byHandRef.current) return null
      // (the whole water bucket is a handle on its dipper: pointing anywhere on it takes the dipper, to scoop up water)
      const bucket = root.getObjectByName('WaterBucket')
      const dipper = tools.find((t) => t.kind === 'water') ?? null
      const hits = raycaster.intersectObjects([...tools.map((t) => t.node), ...pots.map((p) => p.pot), ...(bucket && dipper ? [bucket] : [])], true)
      if (!hits.length) return null
      let o: THREE.Object3D | null = hits[0].object
      while (o && !tools.some((t) => t.node === o) && !pots.some((p) => p.pot === o) && o !== bucket) o = o.parent
      if (o && o === bucket) return pouring.current ? null : dipper
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
    let ownTip = false
    // (only what this lit is put out here: the glow is shared, and the till's drawers, the shrine and the rest light their own through the pointer events)
    let ownGlow = false
    const onMove = (e: PointerEvent) => {
      if (lockedRef.current) { if (ownGlow) { glowOnly(null); ownGlow = false } if (ownTip) { setTip(null); ownTip = false } return }
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
      if (lit || ownGlow) { glowOnly(lit); ownGlow = !!lit }
      // (what's under the pointer, named by a tag, for what isn't food or a tool (those have their own): a dish or the table's boxes, dragged about)
      // (only its own tag is cleared here: the scene's other things set theirs through the pointer events)
      if (!tool && !p && !soup && !dec && cont) { setTip(CONTAINER_TIP(cont)); ownTip = true } else if (ownTip) { setTip(null); ownTip = false }
      el.style.cursor = tool || dec ? 'grab' : p || soup ? 'pointer' : pickContainer() ? 'grab' : POINTER_HINT.hand ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      if (ownGlow) { glowOnly(null); ownGlow = false }
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
        // (charcoal goes on only by dragging a stick from the crate: a click on the fire does nothing)
        // (nor the seasoning ledge, hung on the hearth's frame: dragged past the table's edge it fell to the kitchen floor, its pots and
        // the fan in its holder with it (the owner found it lying by the sink); its pots and utensils are still taken up one by one)
        if (!picked || FIXED.has(picked)) return
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
      if (pouring.current?.tool === tool) return
      drag.current = { tool, target: null, at: tool.node.position.clone(), pour: 0, scoop: tool.kind === 'water' ? 0 : 1,
        base: tool.node.position.clone(), t: 0, on: null, dwell: 0, since: DAB_EVERY, dabbed: new Set(), acc: 0, tick: 0 }
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
      // (the dipper, once it's scooped, pours where it's let go first, tipping its water out over a moment, then goes back)
      const scooped = d.tool.kind === 'water' && d.scoop >= 1
      const overCoals = d.tool.kind === 'water' && Math.hypot(d.at.x, d.at.z) < RING_CLEAR * 0.7
      if (d.target) {
        if (d.tool.kind === 'water') season(d.target, 'water')
        else if (!d.dabbed.has(d.target)) dabNow(d.target, d.tool.kind, d.tool.node.position)
      } else if (overCoals && scooped) {
        // water thrown on the coals: they hiss and steam, and the fire drops right down
        if (fire) fire.current = Math.max(0, fire.current - 0.3)
        meterWater('dipper')
        setWisps((all) => [...all.filter((w) => w.key !== 'douse'), { key: 'douse', at: [0, 0.15, 0] }])
      }
      // (scooped, it's always poured out where it's let go: on the food, the coals, or just the table)
      if (scooped) pouring.current = { tool: d.tool, left: 0.8, at: d.tool.node.position.clone() }
      else {
        d.tool.back = 0
        if (d.tool.kind === 'water' && dipperWater) dipperWater.visible = false
      }
      drag.current = null
      setSaltInHand(false)
      if (controls) controls.enabled = true
      el.style.cursor = ''
      setHover(null)
    }
    /** the crate of charcoal or the fan under the pointer */
    const pickDecor = () => {
      // (the crate's charcoal and the fan are only taken up by hand while researching, as the food and the tools are)
      if (!byHandRef.current) return null
      const groups: THREE.Object3D[] = []
      world.traverse((o) => { if (typeof o.userData.decor === 'string') groups.push(o) })
      const hit = raycaster.intersectObjects(groups, true)[0]
      for (let o: THREE.Object3D | null = hit?.object ?? null; o; o = o.parent) {
        if (typeof o.userData.decor === 'string') return o.userData.decor as 'charcoal' | 'fan'
      }
      return null
    }
    // carried a little above the fire; the fan, waved over a lit fire, fans the coals up
    /** the stick or fan in hand: how fast it's moving (scene units a second) and when it last moved */
    const swing = { v: 0, t: 0 }
    /** whether the 'heap full' tag is showing over the fire while a stick's held */
    let heapWarn = false
    const holdDecor = (e: PointerEvent) => {
      const h = held.current
      if (!h) return
      const tNow = performance.now()
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
      // (a stick held over a fire that has no room for it: its tag says so before it's let go)
      if (h.kind === 'charcoal') {
        const over = Math.hypot(at.x, at.z) < RING_CLEAR
        const full = over && !canPlaceCoal()
        if (full !== heapWarn) { heapWarn = full; setTip(full ? { title: '炭堆已滿', hint: '放不下了，等底下的炭燒成灰再加' } : null) }
      }
      // (how fast it's being swung (eased over the last few moves): let go, that's how hard it's thrown)
      const dt = Math.max(0.008, (tNow - swing.t) / 1000)
      swing.v = swing.v * 0.5 + (moved / dt) * 0.5
      swing.t = tNow
      h.at.copy(at)
      if (h.kind !== 'fan') return
      h.wave += moved
      if (fire && fire.current > 0.02 && Math.hypot(at.x, at.z) < RING_CLEAR + 0.1) {
        // (the heat the fanning calls up is banked and let into the fire a little at a time: the fire rises, it doesn't jump)
        const gain = Math.min(moved * FAN_GAIN, FAN_MAX - fanned.current.extra - fanned.current.pending)
        if (gain > 0) fanned.current.pending += gain
        fanned.current.last = performance.now()
      }
    }
    const dropDecor = () => {
      const h = held.current
      // (a swing stopped before letting go is no throw: only what's moving at the moment of release counts)
      const force = throwForce(swing.v, performance.now() - swing.t)
      if (heapWarn) { heapWarn = false; setTip(null) }
      swing.v = 0
      window.removeEventListener('pointermove', holdDecor)
      document.body.classList.remove('is-carrying')
      // the charcoal let go over the fire goes on it
      // (one stick, from where it's let go; the crate is a stick the fewer)
      if (h?.kind === 'charcoal' && Math.hypot(h.at.x, h.at.z) < RING_CLEAR) {
        // (full, it isn't taken from the crate or paid for: it goes back, with a word why)
        if (!canPlaceCoal()) onNotice?.('heapFull')
        else if (fire && fire.current >= 1 - 1e-6) onNotice?.('heapFull')
        else if (dropCoals({ x: h.at.x, y: h.at.y, z: h.at.z }, 1, force) > 0) { onAddCharcoal?.(1, true); takeFromCrate() }
      }
      held.current = null
      if (controls) controls.enabled = true
      el.style.cursor = ''
    }
    /** the plate / dish / basket under the pointer, by the container key its group carries */
    const pickContainer = () => {
      if (!DRAG_PIECES || !byHandRef.current) return null
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
            // (a plate or dish that falls this far (the table's top is well over a metre up) is ceramic on a hard floor: it shatters,
            // shards scattered on the floor, and a fresh one is set out in the cubby a moment later)
            if (vy < -2.5 && /^(plate|dish|rawdish)/.test(key) && !shattered.current.has(key)) {
              shattered.current.add(key)
              const at = containerAt(key)
              setShards((all) => [...all, ...Array.from({ length: 9 }, (_, n) => ({ id: Math.random(), x: at.x + (Math.random() - 0.5) * 0.5, y: at.y + 0.005, z: at.z + (Math.random() - 0.5) * 0.5, s: 0.03 + Math.random() * 0.05, r: Math.random() * 6, t: performance.now() + n * 0 }))].slice(-40))
              y = -20   // (the broken plate is gone from the floor at once)
              vy = 0
              window.setTimeout(() => {
                moved.current.delete(key)
                stackOn.current.delete(key)
                shattered.current.delete(key)
                setMoveTick((t) => t + 1)
              }, 1800)
              window.setTimeout(() => setShards((all) => all.filter((sh) => performance.now() - sh.t < 6000)), 6200)
            }
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
          if (y < -10) return
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
      if (lockedRef.current || !byHandRef.current) return
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
  // (starts at the fire's own level, so a cold pit is ash from the first frame, not charcoal easing down to it)
  const fuel = useRef(fire?.current ?? 0.55)

  useFrame(({ clock: clk, camera: frameCam }, delta) => {
    const clock = clk.elapsedTime
    const cdt = Math.min(delta, 0.05)
    for (const c of coals.current) {
      if (!c || !c.g) continue
      // (the glow: black at first, then a deep red creeping in, orange, and the face going grey under it as it kindles)
      if (c.gone) continue
      if (c.bounced) {
        c.age += delta * GAME_SPEED.value
        // (burning down: a stick of binchotan keeps its length and shape as it goes, only a little slimmer, its glow dying back at the end as it
        // greys over with ash and lies there pale until it's pushed out; pushed out by new ones, it crumbles to a puff of ash, fading away in a second and a half)
        const burnt = c.dying ? (c.dyT += delta) / 1.5 : Math.min(1, c.age / COAL_LAST_S)
        if (c.dying) {
          if (c.dyT <= delta) {
            c.mat.transparent = true
            burst(c.x, c.y, c.z)
          }
          // (its ink fading with it: the same instance's alpha, coalLayer)
          c.mat.opacity = Math.max(0, 1 - burnt)
        } else {
          const slim = 1 - 0.1 * burnt * burnt
          c.g.scale.set(slim, 1, slim)
        }
        if (c.dying && burnt >= 1) { c.gone = true; c.g.visible = false; restack(); continue }
        // (burnt through near the end of its life, it gives way and breaks, the pieces falling)
        if (!c.dying && c.age / COAL_LAST_S >= 0.95) { breakStick(c); continue }
        c.heat = Math.min(1, c.heat + delta * GAME_SPEED.value / COAL_KINDLE_S)
        // (the last third of its life: the glow dies back and the ash coat takes over)
        const ashed = Math.max(0, Math.min(1, (Math.min(1, c.age / COAL_LAST_S) - 0.72) / 0.28))
        const h = c.heat * (1 - ashed * ashed * (3 - 2 * ashed)) * (c.dying ? Math.max(0, 1 - burnt) : 1)
        // (charcoal-dark under the fire's light, only its cracks glowing; greying with ash at the end)
        c.mat.color.set('#6a6a6a').lerp(ASH_TINT, ashed).multiplyScalar(1 + 2.2 * ashed ** 1.5)
        const flick = 0.9 + 0.1 * Math.sin(clock * 9 + c.top * 90) * Math.sin(clock * 4.3 + c.rx)
        // (only the fractures light up (the emissive map): an orange that goes yellower and brighter as the stick kindles, a dull red while it's still catching)
        c.mat.emissive.setRGB(1, 0.32 + 0.4 * h ** 1.6, 0.06 + 0.2 * h ** 3)
        c.mat.emissiveIntensity = 0.8 * h ** 1.3 * flick
      }
      if (c.settled) {
        // (what lay on it comes down as sticks beneath burn away; it eases to its pose)
        // (and slides down the heap to where it lies, if it landed where the ground fell away)
        if (Math.abs(c.y - c.top) > 0.0005 || Math.abs(c.x - c.tx) > 0.0005 || Math.abs(c.z - c.tz) > 0.0005) {
          const k = Math.min(1, delta * 6), sl = Math.min(1, delta * 3)
          c.x += (c.tx - c.x) * sl; c.z += (c.tz - c.z) * sl; c.y += (c.top - c.y) * k
          c.g.position.set(c.x, c.y, c.z)
        }
        if (c.g.quaternion.angleTo(c.qEnd) > 0.002) c.g.quaternion.slerp(c.qEnd, Math.min(1, delta * 8))
        // (jolted by one landing hard beside it: a little hop, falling back with a smaller bounce or two)
        if (c.hopV || c.hopY) {
          c.hopV = (c.hopV ?? 0) - 9.8 * cdt
          c.hopY = (c.hopY ?? 0) + c.hopV * cdt
          if (c.hopY <= 0) { c.hopY = 0; c.hopV = c.hopV < -0.35 ? -c.hopV * 0.3 : 0 }
          c.g.position.set(c.x, c.y + c.hopY, c.z)
        }
        continue
      }
      if (c.delay > 0) {
        c.delay -= cdt
        c.g.visible = c.delay <= 0
        if (c.delay > 0) continue
      }
      c.vy -= 9.8 * cdt
      c.x += c.vx * cdt
      c.z += c.vz * cdt
      c.y += c.vy * cdt
      // (tumbling in the air, then turning to the way it lies as it lands)
      if (!c.bounced) { c.rx += c.sx * cdt; c.rz += c.sz * cdt; c.g.rotation.set(c.rx, c.ry, c.rz) }
      else c.g.quaternion.slerp(c.qEnd, Math.min(1, delta * 14))
      if (c.y <= c.ly && c.vy < 0) {
        c.y = c.ly
        if (!c.bounced) burst(c.x, c.y, c.z)
        // (it clatters as it lands: loud on the first strike, softer on the bounce)
        const f = c.force ?? 0
        if (c.vy < -0.4) coalClink(Math.min(1, (-c.vy / 4) * (c.bounced ? 0.5 : 1)))
        // (landing hard, it jolts the sticks lying by it: each hops a little, more the nearer and the harder)
        if (!c.bounced && f > 0.15) {
          for (const o of coals.current) {
            if (!o || o === c || !o.settled || o.gone) continue
            const d = Math.hypot(o.x - c.x, o.z - c.z)
            if (d < 0.25) o.hopV = (o.hopV ?? 0) + f * 1.4 * (1 - d / 0.25)
          }
        }
        c.bounced = true
        if (c.vy < -0.9) { c.vy = -c.vy * (0.3 + 0.3 * f); c.vx *= 0.35 + 0.3 * f; c.vz *= 0.35 + 0.3 * f }
        else { c.vy = 0; c.x = c.lx; c.z = c.lz; c.vx = 0; c.vz = 0; c.settled = true }
      }
      c.g.position.set(c.x, c.y, c.z)
    }
    // (the broken pieces: falling to rest, a faint red in them dying out (it's burnt nearly through), then lying grey until they fade)
    for (const k of crumbs.current) {
      if (!k.m) continue
      k.age += delta * GAME_SPEED.value
      if (k.y > k.ty || k.vy > 0) {
        k.vy -= 9.8 * cdt
        k.y += k.vy * cdt
        if (k.y <= k.ty) { k.y = k.ty; k.vy = k.vy < -0.6 ? -k.vy * 0.2 : 0 }
        k.m.position.y = k.y
      }
      const glowLeft = Math.max(0, 1 - k.age / 12)
      k.mat.emissive.setRGB(0.9, 0.22, 0.05)
      k.mat.emissiveIntensity = 0.35 * glowLeft * (0.85 + 0.15 * Math.sin(clock * 3 + k.id))
      if (k.age > 40) {
        k.mat.transparent = true
        k.mat.opacity = Math.max(0, 1 - (k.age - 40) / 3)
      }
    }
    if (crumbs.current.some((k) => k.age > 43)) crumbs.current = crumbs.current.filter((k) => k.age <= 43)
    // (the sticks and the crumbs drawn as they now are)
    coalDraw.draw(coals.current, crumbs.current)
    // (sparks and ash from the landings: thrown up, falling back, fading out)
    {
      const sp = sparkPts.current
      const pa = sparkGeo.attributes.position as THREE.BufferAttribute, ca = sparkGeo.attributes.color as THREE.BufferAttribute
      const pb = ashGeo.attributes.position as THREE.BufferAttribute, cb = ashGeo.attributes.color as THREE.BufferAttribute
      let ns = 0, na = 0
      for (let i = sp.length - 1; i >= 0; i--) {
        const q = sp[i]
        q.life -= cdt
        if (q.life <= 0) { sp.splice(i, 1); continue }
        q.vy -= (q.ash ? 0.9 : 3.2) * cdt
        q.x += q.vx * cdt
        q.y += q.vy * cdt
        q.z += q.vz * cdt
        const k = Math.min(1, q.life / 0.5)
        if (q.ash) {
          if (na >= SPARKS) continue
          pb.setXYZ(na, q.x, q.y, q.z); cb.setXYZ(na, 0.8 * k, 0.78 * k, 0.74 * k); na++
        } else {
          if (ns >= SPARKS) continue
          pa.setXYZ(ns, q.x, q.y, q.z); ca.setXYZ(ns, k, 0.45 * k * k, 0.08 * k ** 3); ns++
        }
      }
      for (let i = ns; i < SPARKS; i++) { pa.setXYZ(i, 0, -9, 0); ca.setXYZ(i, 0, 0, 0) }
      for (let i = na; i < SPARKS; i++) { pb.setXYZ(i, 0, -9, 0); cb.setXYZ(i, 0, 0, 0) }
      pa.needsUpdate = ca.needsUpdate = pb.needsUpdate = cb.needsUpdate = true
    }
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
    // (Dish sets every mesh to cast and receive shadows as it loads, so the ground and net are put right here, once it has)
    if (!root.userData.shadowsFixed) {
      const g = root.getObjectByName('FirePit') as THREE.Mesh | undefined
      const n = root.getObjectByName('GrillNet') as THREE.Mesh | undefined
      if (g && n && g.receiveShadow && n.castShadow) {
        g.receiveShadow = false
        n.castShadow = false
        root.userData.shadowsFixed = true
      }
    }
    const target = fire?.current ?? 0.55
    // (the fire's sound: its crackle by how hot, its sizzle by what's over it; loud with the camera near the fire, faint across the room)
    if (active) {
      const over = pieces.current.filter((p) => present(p) && !p.collected && !p.staged && !p.carried).length
      const snd = fireSound(Math.min(1, target), over)
      const camD = frameCam.position.distanceTo(root.getWorldPosition(new THREE.Vector3()))
      fireAmbience(snd.crackle, snd.sizzle, THREE.MathUtils.clamp(1.4 - camD / 12, 0.15, 1), Math.min(delta, 0.1))
    }
    // (the coals' own state eases toward the fire: charcoal added swells up and kindles over a moment, the pile shrinks back slowly as it burns)
    const ease = target > fuel.current ? 0.05 : 0.35
    fuel.current += (target - fuel.current) * Math.min(1, delta * ease)
    const f = fuel.current
    const ash = THREE.MathUtils.smoothstep(0.5 - f, 0, 0.45)
    // (no fire: only a few lumps of grey ash and slag; charcoal is what swells the heap, kindles and glows)
    // (the ash bed stays as it is under the charcoal, lit or not: the first sticks go on over it, and it isn't swapped away)
    const burning = f > 0.02
    // (the model's own heap of orange lumps is never shown: the bed is the sticks thrown on it, all one kind, and a fire lit with none gets a few laid on it)
    for (const nm of ['Charcoal', 'BinchotanHeap']) {
      const o = root.getObjectByName(nm)
      if (o) o.visible = false
    }
    if (burning && !bedSeeded.current && !coals.current.some((c) => c && !c.gone && !c.dying)) { bedSeeded.current = true; dropCoals() }

    embers.current.forEach((e, i) => {
      // no fire, no glow; as the heap kindles its glow goes from a deep red, through orange, toward a yellower white at the full blaze, and it breathes
      const flick = 0.93 + 0.07 * Math.sin(clock * 6.1 + i * 2.3) * Math.sin(clock * 2.7 + i)
      e.mat.emissiveIntensity = e.base * 1.23 * f ** 1.6 * flick
      e.mat.emissive.setRGB(0.55 + 0.45 * Math.min(1, f * 1.3), 0.1 + 0.5 * Math.min(1, f) ** 1.5, 0.02 + 0.18 * Math.min(1, f) ** 3)
      const gain = 1 + ((ASH_GAIN[e.mat.name] ?? 1) - 1) * ash ** 1.5
      e.mat.color.copy(e.color).lerp(ASH_TINT, ash).multiplyScalar(gain)
    })
    if (scannedCount.current !== root.children.length) scan()
    const dt = Math.min(delta, 0.1)
    // fanned-up heat burns the coals faster while it lasts (more the hotter it's been fanned), and dies back once the
    // fanning stops
    const fan = fanned.current
    if (fan.pending > 0 && fire) {
      const rise = Math.min(fan.pending, dt * FAN_RISE, Math.max(0, FIRE_FANNED_MAX - fire.current))
      fire.current += rise
      fan.extra += rise
      fan.pending -= rise
      if (rise <= 0) fan.pending = 0
    }
    if (fan.extra > 0 && fire) {
      fire.current = Math.max(0, fire.current - dt * GAME_SPEED.value * FAN_BURN * (fan.extra / FAN_MAX))
      if (performance.now() - fan.last > 600) {
        const back = Math.min(fan.extra, dt * FAN_FADE)
        fan.extra -= back
        fire.current = Math.max(0, fire.current - back)
      }
      if (fire.current <= 0.02) { fan.extra = 0; fan.pending = 0 }
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
      const pour = pouring.current?.tool === t ? pouring.current : null
      if (held && t.kind === 'water' && d!.scoop < 1) {
        // (the dipper first goes down into the bucket and comes up full: down to the water, a dip under it, and up out again)
        d!.scoop = Math.min(1, d!.scoop + dt / 0.55)
        const k = d!.scoop
        const down = Math.sin(Math.min(1, k * 1.25) * Math.PI)
        t.node.position.copy(t.home).add(new THREE.Vector3(0, -0.11 * down + 0.06 * Math.max(0, k - 0.6) / 0.4, 0))
        t.node.quaternion.copy(t.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, -1).normalize(), -0.25 * down))
        if (k > 0.45 && dipperWater) { dipperWater.visible = true; dipperWater.scale.setScalar(1) }
        if (Math.random() < dt * 12 * down) emit('water', t.node.position.clone().add(new THREE.Vector3(0, 0.02, 0)), 2)
      } else if (held) {
        const dd = d!
        dd.t += dt
        // (the dipper, full, held level so as not to spill until it's let go; the rest tip toward the food they're over, and work it there)
        const want = t.kind === 'water' ? 0 : dd.target ? 1 : 0
        dd.pour += (want - dd.pour) * Math.min(1, dt * 8)
        dd.base.lerp(dd.at, Math.min(1, dt * 14))
        const act = toolAction(t.kind, dd.t)
        t.node.position.copy(dd.base).addScaledVector(act.off, dd.pour)
        t.node.quaternion.copy(t.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, -1).normalize(), (t.kind === 'water' ? 0 : 0.2) + dd.pour * (0.9 + act.tilt)))
        // (its grains or drops falling evenly, as fast as it's worked: none while it's only being carried)
        if (t.kind !== 'water' && dd.target) {
          dd.acc += dt * act.rate * dd.pour
          for (; dd.acc >= 1; dd.acc -= 1) emit(t.kind, t.node.position.clone().add(new THREE.Vector3(0, -0.05, 0)), 1)
          dd.tick += dt
          if (dd.tick > 0.16) { dd.tick = 0; sprinkleTick(t.kind) }
          // (held over a piece, it goes on every so often: a moment after it's come over the piece, and no sooner after the last time than
          // DAB_EVERY, however the hand wavers between pieces)
          if (dd.on !== dd.target) { dd.on = dd.target; dd.dwell = 0 }
          dd.dwell += dt
          if (dd.dwell >= DAB_FIRST && dd.since >= DAB_EVERY) {
            dd.since = 0
            dabNow(dd.target, t.kind, t.node.position)
            dd.dabbed.add(dd.target)
          }
        } else {
          dd.on = null
          dd.dwell = 0
        }
        dd.since += dt
      } else if (pour) {
        // (pouring: the dipper tips over where it was let go, its water running out in a stream, then it's carried back)
        pour.left -= dt
        const k = 1 - Math.max(0, pour.left) / 0.8
        t.node.position.lerp(pour.at, Math.min(1, dt * 14))
        t.node.quaternion.copy(t.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, -1).normalize(), Math.min(1, k * 2) * 1.9))
        if (k > 0.2 && k < 0.95) emit('water', t.node.position.clone().add(new THREE.Vector3(0.03, -0.04, 0.03)), 4)
        if (dipperWater) dipperWater.scale.setScalar(Math.max(0.01, 1 - Math.max(0, k - 0.25) / 0.6))
        if (pour.left <= 0) {
          pouring.current = null
          t.back = 0
          if (dipperWater) dipperWater.visible = false
        }
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
    // (the seasoned pieces' bounces run on; the rings spread and fade)
    for (const [p, k] of bounces.current) {
      if (k + dt / BOUNCE_TIME >= 1) bounces.current.delete(p)
      else bounces.current.set(p, k + dt / BOUNCE_TIME)
    }
    ringObjs.current.forEach((ring, k) => {
      if (!ring) return
      const left = ringLife.current[k]
      ring.visible = left > 0
      if (left <= 0) return
      ringLife.current[k] = left - dt
      const u = 1 - Math.max(0, ringLife.current[k]) / RING_LIFE
      ring.scale.setScalar(0.6 + u * 1.6)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - u)
    })
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
    // (what the chef has brought back to his place: onto the board, from his hands, and prepared there a moment before it can go on;
    // with no chef walking the orders (the shop shut, a phone), what's waiting comes out as it used to)
    const T = CHEF_TRIP
    const fetchLive = space === 'open' && bar && performance.now() - T.seenAt < 1000
    if (T.phase === 'prepping' && T.keys.length) {
      for (const p of pieces.current) if (p.fetching && T.keys.includes(p.key)) {
        p.fetching = false
        p.fresh = false
        p.node.userData.shrink = undefined
        p.prepUntil = performance.now() + Math.max(0, prepOf(T.store) - T.t) * 1000
      }
      T.keys = []
    }
    if (!fetchLive) for (const p of pieces.current) if (p.fetching) { p.fetching = false; p.fresh = true; p.node.userData.shrink = undefined; FRIDGE_KICK.at = performance.now() }
    const onTray = pieces.current.filter((p) => p.staged && !p.fetching && present(p) && !p.carried && p.trash < 0)
      .sort((a, b) => a.stagedAt - b.stagedAt)
    // (those on the raw dish don't take a place on the tray)
    const onBoard = onTray.filter((p) => !roast.rawDish?.items.includes(p.id))
    // (the tray takes so many: the rest wait in the fridge, unseen, until there's room)
    const boardSticks = onBoard.filter((q) => !q.loose), boardLoose = onBoard.filter((q) => q.loose)
    const inFridge = new Set([...boardSticks.slice(TRAY_CAP), ...boardLoose.slice(LOOSE_CAP)])
    if (inFridge.size !== trayMore) setTrayMore(inFridge.size)

    pieces.current.forEach((p, n) => {
      bindMaterials(p)
      // (its one ink line shown while its food is)
      if (p.ink && p.inkOf) p.ink.visible = p.inkOf[0].visible
      if (present(p) && !p.wasPresent) {
        // just ordered: it's brought out raw on the tray (the base fish, not on the menu, starts on the fire)
        p.wasPresent = true
        p.node.userData.shrink = undefined
        // (in the open shop: the next one of these ordered, as what dish)
        if (space === 'open') {
          const i = wants.current.findIndex((w) => w.id === p.id)
          p.want = i >= 0 ? wants.current.splice(i, 1)[0] : null
        }
        if (menuIds.has(p.id) && roast.tray) {
          p.staged = true
          p.fresh = true
          p.stagedAt = ++stageSeq.current
          p.tended = false
          p.prepUntil = undefined
          // (in the open shop the chef goes and gets it: it stays where it's kept till he brings it; else it's out on the board at once)
          p.fetching = fetchLive
          if (!fetchLive) FRIDGE_KICK.at = performance.now()
          p.node.userData.onPlate = true
        }
      }
      if (!present(p)) {
        // taken off the order: next time it comes back raw, on the tray
        // (sent home to the fire's place but kept at no size, so it isn't seen there for the moment it takes Dish to shrink it away)
        if (menuIds.has(p.id)) p.node.userData.shrink = 0.0001
        p.wasPresent = false
        p.staged = false
        p.fetching = false
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
      } else if (p.staged && p.fetching) {
        // (still where it's kept, unseen; then in the chef's hands as he takes it out and carries it back, side by side)
        const i = T.keys.indexOf(p.key)
        const held = i >= 0 && (T.phase === 'toBoard' || (T.phase === 'taking' && T.t > TAKE_S * 0.5))
        if (held && p.node.parent) {
          const at = p.node.parent.worldToLocal(T.hand.clone()).addScaledVector(STACK_DIR, (i - (T.keys.length - 1) / 2) * 0.07)
          if (p.node.userData.shrink !== undefined) p.node.position.copy(at)
          else p.node.position.lerp(at, Math.min(1, dt * 14))
          p.node.userData.shrink = undefined
          flatQ(p, p.node.quaternion, STACK_DIR)
        } else p.node.userData.shrink = 0.0001
      } else if (p.staged && roast.rawDish?.items.includes(p.id)) {
        // rice balls wait raw on their own little dish, sitting the way they'll go on the net
        const mine = onTray.filter((q) => roast.rawDish!.items.includes(q.id))
        const k = Math.max(0, mine.indexOf(p))
        const a = (k / 3) * Math.PI * 2 + 0.4
        const at = containerAt('rawdish').add(new THREE.Vector3(Math.cos(a) * (k < 3 ? 0.1 : 0), 0.05 + Math.floor(k / 3) * 0.08,
          Math.sin(a) * (k < 3 ? 0.1 : 0)))
        p.node.position.lerp(at, Math.min(1, dt * 10))
        p.node.quaternion.copy(p.homeQ)
      } else if (p.staged && inFridge.has(p)) {
        // (still in the fridge: set straight down in its spot when it's brought out)
        p.fresh = true
      } else if (p.staged) {
        // waiting raw on the tray, laid flat in its spot
        const at = p.loose ? trayLooseSpot(Math.max(0, boardLoose.indexOf(p))) : traySpot(Math.max(0, boardSticks.indexOf(p)))
        if (p.fresh) { p.node.position.copy(at); p.fresh = false } else p.node.position.lerp(at, Math.min(1, dt * 10))
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
        // (served through the plating place: out there till a server takes it, then on the tray with them, then onto the plate)
        if (p.via === 'plated') {
          if (SERVICE.delivered.has(p.key)) {
            SERVICE.delivered.delete(p.key)
            // (its stick left on the plate once it's eaten: cleared with it, into the bin by the sink)
            if (!p.loose) SEAT_STICKS.set(p.seat, (SEAT_STICKS.get(p.seat) ?? 0) + 1)
            if (WHOLE_FISH.has(p.id)) SEAT_BONES.set(p.seat, (SEAT_BONES.get(p.seat) ?? 0) + 1)
            const row = pieces.current.filter((q) => q !== p && q.collected && q.container === 'bar' && q.seat === p.seat && !q.via && present(q) && !q.eaten).length
            p.fromP.copy(p.node.position)
            p.fromQ.copy(p.node.quaternion)
            p.toP.copy(barSeat(p.seat)).addScaledVector(GRILL_SEATS[p.seat].along, ((row % 3) - 1) * 0.07 * GRILL_SCALE)
              .add(new THREE.Vector3(0, BAR_TOP_SCENE + 0.04 + Math.floor(row / 3) * 0.06, 0))
            // (its spot is kept as where it is from the bar (the frame below puts it there each frame): moved to the plate, or it went back to
            // the plating place every frame, and lay there, on the plating place, while its customer's plate went out empty (the owner saw two skewers
            // left on the board))
            p.local.copy(p.toP).sub(containerAt('bar'))
            p.via = undefined
            p.flight = 0.6
          } else if (SERVICE.carried.has(p.key)) {
            // (on the server's tray, where they hold it: its spot moved with it, as above; the bar hands it in its own frame)
            p.fromP.copy(SERVICE.carried.get(p.key)!).sub(FIRE_SHIFT)
            p.toP.copy(p.fromP)
            p.local.copy(p.toP).sub(containerAt('bar'))
            p.flight = 1
          } else if (p.readyAt === undefined) {
            // (held by the fire: a slot on the plating place, and a plate in it, asked for again)
            plateReady(p)
          } else if (!SERVICE.claimed.has(p.key) && PLATING.slots[p.readyAt]?.seat !== p.seat) {
            // (its slot taken up, or freed, without it: it goes to a slot of its own again, from where it is)
            p.readyAt = undefined
            SERVICE.waiting.delete(p.key)
            p.fromP.copy(p.node.position)
            p.fromQ.copy(p.node.quaternion)
            p.flight = 0
            plateReady(p)
          } else if (p.flight >= 1) {
            p.small = true
            if (!SERVICE.waiting.has(p.key) && !SERVICE.claimed.has(p.key)) SERVICE.waiting.set(p.key, p.seat)
          }
        }
        const held = p.via === 'plated' && p.readyAt === undefined
        if (!plateless && !held) p.flight = Math.min(1, p.flight + dt / FLIGHT_SECONDS)
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
      // (the grill's marks come on as it browns: none raw, full by the time it's done)
      if (p.looks.uSear) p.looks.uSear.value = THREE.MathUtils.smoothstep(r, 0.25, 0.9)
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
      // (the boss come over to taste it: the bites begin; if he can't get there, it's eaten anyway after a while)
      if (p.awaitBoss && (BOSS_TASTE.arrived || performance.now() - p.awaitBoss > 6000)) {
        p.byBoss = BOSS_TASTE.arrived
        p.awaitBoss = 0
        p.eat = 0.0001
      }
      if (p.eat > 0 && !p.eaten && !p.stickOnly) {
        p.eat = Math.min(1, p.eat + dt / EAT_SECONDS)
        const phase = p.eat * BITES_PER_PIECE
        const wanted = Math.min(BITES_PER_PIECE, Math.floor(phase + 0.35))
        while (p.bites.uBiteCount.value < wanted) {
          takeBite(p)
          // (the owner's own taste: each bite crunches, and he's chewing)
          if (p.byBoss) { biteSound(); BOSS_TASTE.chewing = true }
        }
        // (and between bites the soft munching)
        if (p.byBoss) {
          p.chewAt = (p.chewAt ?? 0) + dt
          if (p.chewAt > 0.24 + Math.random() * 0.08) { p.chewAt = 0; chewSound() }
        }
        // (only what's eaten off your own plate hops up to be bitten: at the bar it's the customer you see eating, so
        // the piece just lies there getting smaller)
        if (!p.body?.live && p.container !== 'bar') {
          const lift = Math.max(0, Math.sin(Math.min(1, (phase % 1) * 1.6) * Math.PI))
          p.node.position.y += 0.06 * lift
          p.node.rotateOnWorldAxis(STACK_DIR, -0.12 * lift)
        }
        // (the boss's: up out of the bowl into his hand, held at his mouth while he eats it)
        const hand = p.byBoss ? room.getObjectByName('BossHandR') : null
        if (hand && p.node.parent) {
          const to = p.node.parent.worldToLocal(hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0)))
          p.node.position.lerp(to, THREE.MathUtils.smoothstep(p.eat, 0, 0.15))
        }
        if (p.eat >= 1) {
          // (he's had it: what he thinks of it, then off back to his round)
          if (p.byBoss) { BOSS_TASTE.verdict = tasteOf(p); BOSS_TASTE.chewing = false }
          if (!p.node.userData.byGuest) BOSS_TASTE.at = null
          p.byBoss = false
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
      if (p.eaten || waiting(p) || inFridge.has(p)) shrink = 0.0001
      const bounce = bounces.current.get(p)
      if (bounce !== undefined) shrink *= 1 + BOUNCE * Math.sin(Math.PI * bounce)
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
    // the plating place's slots: how many of each one's pieces are flying to it and are down on it (GuestBar3D sends a server once it's all there); one
    // left with nothing (its customer gone, what was on it binned) freed, its plate back on the stack
    if (space === 'open') for (let k = 0; k < READY_SLOTS; k++) {
      const sl = PLATING.slots[k]
      if (!sl) continue
      let flying = 0, landed = 0
      for (const q of pieces.current) {
        if (q.via !== 'plated' || q.readyAt !== k || q.eaten || q.trash >= 0 || SERVICE.claimed.has(q.key) || SERVICE.carried.has(q.key)) continue
        if (q.flight >= 1) landed++
        else flying++
      }
      sl.flying = flying
      sl.landed = landed
      if (!flying && !landed) {
        if (sl.plate) PLATING.stock += 1
        PLATING.slots[k] = null
      }
    }

    // (what the chef's carrying: where it is through each step, and where he stands; it holds still in its own flight meanwhile)
    {
      const C = CHEF_CARRY
      const p = C.key ? pieces.current.find((q) => q.key === C.key) : undefined
      if (C.key && (!p || !present(p) || p.eaten || p.trash >= 0 || performance.now() - CHEF_TRIP.seenAt > 1000)) {
        // (gone meanwhile, or nobody to carry it: let go, it goes on by itself)
        C.key = null; C.phase = 'idle'; C.lean = 0; C.hold = false
      } else if (p && C.phase !== 'idle') {
        C.t += dt
        // (where it's going: its place in the fire (on the net, if it's one for the net), or where it lands at the plating place)
        const dest = C.kind === 'toFire'
          ? new THREE.Vector3(p.netSpot !== null ? spots[p.netSpot][0] : p.homeP.x, p.homeP.y, p.netSpot !== null ? spots[p.netSpot][1] : p.homeP.z)
          : (p.container ? containerAt(p.container).add(p.local) : p.toP.clone())
        const destQ = C.kind === 'toFire' ? p.homeQ : p.toQ
        if (C.kind === 'toFire') { p.homeFlight = 0; p.node.userData.onPlate = true } else p.flight = 0
        const home = CHEF_AT.clone().setY(CHEF_AT.y + NOTCH_STEP.h)
        // (to the nearest he can stand to it in the notch: along it either way as far as it's wide, and hardly forward (the seasoning ledge
        // hangs before him there))
        const toward = (v: THREE.Vector3) => {
          const fs = FIRE_SHIFT.dot(ALONG)
          const a = THREE.MathUtils.clamp(v.dot(ALONG), COOK_NOTCH.along[0] + 0.32 - fs, COOK_NOTCH.along[1] - 0.32 - fs)
          const l = THREE.MathUtils.clamp(v.dot(LAY), home.dot(LAY) - CARRY_STEP, home.dot(LAY))
          return new THREE.Vector3().addScaledVector(ALONG, a).addScaledVector(LAY, l).setY(home.y)
        }
        const hand = p.node.parent ? p.node.parent.worldToLocal(CHEF_TRIP.hand.clone()) : CHEF_TRIP.hand.clone()
        const k = Math.min(1, C.t / CARRY_S[C.phase]), e = k * k * (3 - 2 * k)
        if (C.phase === 'reach') {
          // (his hands to it where it is: on the board, or standing in the fire)
          p.node.position.copy(C.from); p.node.quaternion.copy(C.fromQ)
          // (leaning in further the further it is from him)
          const far = Math.min(1, C.from.clone().sub(home).setY(0).length() / 1.2)
          C.stand.copy(toward(C.from)); C.face.copy(C.from); C.lean = CARRY_LEAN * (0.6 + 0.8 * far) * Math.sin(Math.PI * k); C.hold = false
          C.heldQ.copy(p.homeQ)
        } else if (C.phase === 'carry') {
          // (in his hands, upright on its stick, as he turns and steps to where it's going)
          p.node.position.lerpVectors(C.from, hand, Math.min(1, e * 2.2))
          p.node.quaternion.slerpQuaternions(C.fromQ, C.heldQ, e)
          C.stand.copy(toward(dest)); C.face.copy(dest); C.lean = 0; C.hold = true
        } else if (C.phase === 'place') {
          // (leaning in, the skewer pushed into the ash at its place, or the fish laid on the plate)
          p.node.position.lerpVectors(hand, dest, e)
          p.node.quaternion.slerpQuaternions(C.heldQ, destQ, e)
          C.lean = CARRY_LEAN * Math.sin(Math.PI * Math.min(1, k * 1.2)); C.hold = true
        } else {
          // (set: it's in its place; he straightens and steps back)
          p.node.position.copy(dest); p.node.quaternion.copy(destQ)
          C.stand.copy(home); C.lean = 0; C.hold = false
        }
        if (k >= 1) {
          C.t = 0
          if (C.phase === 'reach') C.phase = 'carry'
          else if (C.phase === 'carry') C.phase = 'place'
          else if (C.phase === 'place') {
            C.phase = 'back'
            // (it's where it goes now: on the fire it begins to cook; on the plating place it lands (the steam, the plate's count))
            if (C.kind === 'toFire') { p.homeFlight = 1; p.node.userData.onPlate = false } else p.flight = 0.999
            // (a puff of ash and sparks where the skewer goes in)
            if (C.kind === 'toFire') emit('salt', dest.clone().add(new THREE.Vector3(0, 0.05, 0)), 8)
          } else { C.phase = 'idle'; C.key = null; C.lean = 0; C.hold = false }
        }
        if (C.phase === 'back' || C.phase === 'idle') { if (C.kind === 'toFire') p.homeFlight = 1 }
      }
    }
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
      if (p.slot === null || p.eaten || !present(p) || p.container === 'bar' || p.container?.startsWith('bowl')) continue
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
    // (the progress tags worked out only while they're shown (by hand at the fire): with the shop open they aren't, and each piece passing a
    // step redrew the whole kitchen, several times a second, for tags nobody saw)
    if (!active || !showsProgress(modeOf(ai, research))) {
      if (lastTags.current !== '[]') {
        lastTags.current = '[]'
        setTags([])
      }
      return
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
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __pieces: pieces, __collect: collect, __moved: moved,
    __table: () => containerKeys().map((k) => ({ k, at: containerAt(k).toArray().map((v) => +v.toFixed(3)), r: footprint(k) })) })

  return (
    <>
      {Array.from({ length: plateCount }, (_, n) => (
        <WhenHeld key={n} holds={() => holds(`plate-${n}`)}><Plate container={`plate-${n}`} position={plateAt(n).toArray() as [number, number, number]} /></WhenHeld>
      ))}
      {roast.basket && Array.from({ length: basketCount }, (_, n) => (
        <Basket key={n} container={`basket-${n}`} position={basketAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.dish && Array.from({ length: dishCount }, (_, n) => (
        <WhenHeld key={n} holds={() => holds(`dish-${n}`)}><SideDish container={`dish-${n}`} position={dishAt(n).toArray() as [number, number, number]} /></WhenHeld>
      ))}
      <TasteBowl container="bowl-0" position={bowlAt().toArray() as [number, number, number]} />
      <EmberBed fuel={fuel} />
      {/* (the sticks on the fire, their ink, and the crumbs they break into: a few instanced meshes, written each frame) */}
      <primitive object={coalDraw.group} />
      <points geometry={sparkGeo} frustumCulled={false}><pointsMaterial size={0.024} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></points>
      <points geometry={ashGeo} frustumCulled={false}><pointsMaterial size={0.05} vertexColors transparent opacity={0.6} depthWrite={false} toneMapped={false} /></points>
      {shards.map((sh) => (
        <mesh key={sh.id} position={[sh.x, sh.y, sh.z]} rotation={[-Math.PI / 2, 0, sh.r]}>
          <circleGeometry args={[sh.s, 3]} /><meshToonMaterial color="#efece4" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Decor held={held} lanternAt={containerAt('lantern').toArray() as [number, number, number]} fanAt={fanAt().toArray() as [number, number, number]} />
      {active && decorTip && (
        <Html position={decorTip === 'fan' ? (fanAt().add(new THREE.Vector3(0, 0.3, 0)).toArray() as [number, number, number]) : [DECOR.crate.at[0], 0.5, DECOR.crate.at[1]]}
          center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <span className="tool-tag">{decorTip === 'fan' ? '團扇' : '備長炭'}<small>{decorTip === 'fan' ? '拿到火上來回搧' : '拖到火上添炭'}</small></span>
        </Html>
      )}
      {roast.tray && <Tray container="tray" position={trayAt().toArray() as [number, number, number]} />}
      {/* (edit mode's boxes for what the nudge moves: an unseen block the size of each, in a group the edit moves; the pieces themselves follow by the nudge) */}
      {roast.tray && <EditProxy id="cutboard" label="大砧板" at={containerAt('tray')} size={[TRAY_W, 0.12, TRAY_D]} yaw={-Math.atan2(STACK_DIR.z, STACK_DIR.x)} />}
      {carriers.box && <EditProxy id="seasoning" label="調味架" at={containerAt('box').add(new THREE.Vector3(0, -0.12, 0))} size={[LEDGE_L, 0.42, 0.22]} yaw={-Math.atan2(STACK_DIR.z, STACK_DIR.x)} />}
      {carriers.bin && <EditProxy id="bucket" label="水桶" at={containerAt('bin')} size={[BIN_R * 2, 0.45, BIN_R * 2]} yaw={0} />}
      {roast.basket && <EditProxy id="basket" label="竹簍" at={containerAt('basket-0')} size={[BASKET_R * 2, 0.14, BASKET_R * 2]} yaw={0} />}
      <EditProxy id="tastebowl" label="試吃碗" at={containerAt('bowl-0')} size={[BOWL_R * 2, BOWL_RIM, BOWL_R * 2]} yaw={0} />
      {roast.trash && <EditProxy id="trash" label="廚餘桶" at={containerAt('trash')} size={[TRASH_R * 2, 0.4, TRASH_R * 2]} yaw={0} />}
      {roast.rawDish && <EditProxy id="ricedish" label="飯糰小碟" at={containerAt('rawdish')} size={[DISH_R * 2, 0.06, DISH_R * 2]} yaw={0} />}
      {/* (the table, the crew and the bar stay where they were drawn: the fire and all round it stand FIRE_SHIFT along from them, to the table's middle) */}
      <group position={[-FIRE_SHIFT.x, 0, -FIRE_SHIFT.z]}>
      <CookTable floor={!bar} />
      {/* (the crew keep their own places on the kitchen floor: carried back by the shift) */}
      <group position={[FIRE_SHIFT.x, 0, FIRE_SHIFT.z]}>
      {/* the owner: at his grill while the shop's shut; open, his chef has the grill and he stands along the aisle from it, keeping an eye  (he fades himself out of the way when he stands between the camera and what it looks at: Boss.tsx) */}
      {bar && (<>
        <BossSpot open={space === 'open'} lang={lang} />
        {/* (and the notch's wooden step he and his cook stand on) */}
        <NotchStep />
        {/* (the staff's outfits drawn a moment under the notch's floor as the shop loads: their programs made then, not as they first walk in) */}
        <Suspense fallback={null}><group position={CHEF_AT}><StaffWarm /></group></Suspense>
      </>)}
      {space === 'open' && bar && crewPlaces(crew.some((m) => m.role === 'chef') ? crew : [HOUSE_CHEF, ...crew]).map(({ m, at, yaw, way, seat }, i, all) => (
        <CrewWalk key={m.id} id={m.id} role={m.role} at={at} yaw={yaw} way={way} seat={seat} round={m.role === 'chef' || m.role === 'sous'}
          fetcher={m.role === 'chef' && all.findIndex((x) => x.m.role === 'chef') === i}>
          {!seat && <BlobShadow r={0.17} />}<StaffFigure id={m.id} role={m.role} look={m.look} seated={!!seat} />
        </CrewWalk>
      ))}
      </group>
      {bar && <Bar />}
      </group>
      {/* (the rice balls' own little dish, set out while some wait raw on it) */}
      {roast.rawDish && (
        <WhenHeld holds={() => holds('rawdish') || pieces.current.some((q) => q.staged && !!roast.rawDish?.items.includes(q.id) && present(q))}>
          <SideDish container="rawdish" position={containerAt('rawdish').toArray() as [number, number, number]} />
        </WhenHeld>
      )}
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
      {active && trayMore > 0 && roast.tray && (
        <Html position={trayAt().addScaledVector(STACK_DIR, TRAY_W / 2 - 0.1).addScaledVector(LAY_DIR, TRAY_D / 2 - 0.05).add(new THREE.Vector3(0, 0.12, 0))}
          center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <span className="tray-more" title="冷藏櫃裡還有，砧板空出位置就會拿出來">+{trayMore}<small>冷藏</small></span>
        </Html>
      )}
      {Array.from({ length: RINGS }, (_, k) => (
        <mesh key={`ring${k}`} ref={(m) => { ringObjs.current[k] = m }} visible={false} rotation-x={-Math.PI / 2} renderOrder={4}>
          <ringGeometry args={[0.07, 0.085, 32]} />
          <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {active && tasteTip && (
        <Html position={tasteTip.at} center zIndexRange={[35, 25]} style={{ pointerEvents: 'none' }}>
          <span className="taste-tip">美味 <b>{tasteTip.taste}</b></span>
        </Html>
      )}
      {pops.map((x, k) => (
        <Html key={k} position={x?.at ?? POP_AWAY} center zIndexRange={[36, 26]} style={{ pointerEvents: 'none' }}>
          {/* (the word's own key: a new one starts its rise again) */}
          {x && <span key={x.id} className={`taste-pop${x.good ? '' : ' is-bad'}`}>{x.text}</span>}
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
      {active && showsProgress(modeOf(ai, research)) && tags.map(({ key, id, name, state }) => (
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

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
const Bar = memo(BarImpl)
const CookTable = memo(CookTableImpl)
const BarCounter = memo(BarCounterImpl)
const BarGate = memo(BarGateImpl)
