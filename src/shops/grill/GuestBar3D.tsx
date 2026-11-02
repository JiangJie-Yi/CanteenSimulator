import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOX_SHEETS, sheetsFor, takeSheets, TISSUE } from '@/game/tissues'
import { drinksToOrder, stockerChore, type StockChore } from '@/game/stocker'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { StaticBatch } from '@/scene/StaticBatch'
import { FloorPiece } from '@/scene/FloorPiece'
import { QUALITY } from '@/scene/quality'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GuestView } from '@/game/types'
import { MoodFace } from '@/ui/MoodFace'
import { guestLabel, kindOf } from '@/data/guests'
import { Person } from '@/scene/Person3D'
import { FOLK_HEIGHT, FolkFigure, SEAT as FOLK_SEAT, folkSpec } from '@/scene/FolkFigure'
import { StaffFigure, TRAY_AT as HELD_AT } from '@/scene/StaffFigure'
import { BossModel } from './Boss'
import { Omamori } from './Omamori'
import { moodOf, walkSpeedOf } from '@/scene/people'
import { BlobShadow } from '@/scene/BlobShadow'
import { brushText, followSign, signTexture } from '@/scene/signFont'
import type { Look as StaffLook } from '@/data/staff'
import type { Lang } from '@/data/i18n'
import { inkModel } from '@/scene/inkHull'
import { setTip } from '@/scene/hoverTip'
import { Later } from '@/scene/Later'
import { wareGeometry } from './ware'
import { designOf, wareDesign } from './wareDesigns'
import { HAND_MS } from './Restroom'
import { DiningWall, DrinkBottle, DrinkFridge, FridgeDoor, FridgeStock, ShopProps } from './DiningRoom'
import { LuckyCat } from './LuckyCat'
import { IpadModel } from './Ipad'
import { TillBoxes } from './TillBoxes'
import { StoolModel, TillStoolModel } from './BarFurnish'

/** the boxes on the till's low shelf, each its own piece, and its name in the developer panel */
const TILL_BOXES = [['bags', '紙袋'], ['napkins', '紙巾'], ['rolls', '收銀紙捲'], ['coasters', '杯墊'], ['chopsticks', '割箸']] as const
import { TillCounter } from './TillCounter'
import { drawerOpens, paysByCard, tabletActive } from '@/game/till'
import { CAT_STAND_H, TillBellLive, TillDeskPiece, TillMatLive } from './TillDesk'
import { beep, behindBody, chime, DRAWER_FRONT, DRAWER_KEY, showKeyTip, turnKey, liftOn, rattle, RECEIPT_TEX, REGISTER, RegisterBody, RegisterDrawer, RegisterKeys, registerTag, registerText, useRegisterModel } from './cashRegister'
import { Movable } from './Movable'
import { getEdit, setLocked } from './edit'
import { changeOf, CoinPile, CoinStack, isNote, NoteStack, type CoinKind, type Note } from './Cash'
import { takeOut, type Denom } from '@/game/till'
import { DRY_S, DRYER_CAP, PASS_CAP, dryerStarts, dryerTick, dutyOf, nextChore, platerGoes, platesToBring, putBack, RACK_FULL, unload, washOne } from '@/game/plates'
import { kitchenPath, type Rect } from '@/game/kitchenPath'
import { PER_RACK } from './PlateRack'
import { SAY_EACH, sayChunks } from '@/game/say'
import { SHOP } from '@/game/shopState'
import { flowerBuffs } from '@/game/shrineFlowers'
import { murmur } from '@/game/fireSound'
import { crowdAmbience } from './fireAmbience'
import { LINES } from '@/data/lines'
import { looksOf, newRoll, openRoom, penaltyOf, visitRoom } from '@/game/restroom'
import { aisleCornerOf, DRAWER_HELD, SHOP_PURSE, STOCKER_WC, SUPPLIES, CHOPS_UP, gripe, setTissues, tissuesAt, meterWater, OWNER_OUT, OWNER_SPOT, OWNER_YAW, FIRE_SHIFT, KITCHEN_ROUTE, PLACE, SICK, SHRINE_FLOWERS, LIP_H, PASS, PASS_SHELF, PASS_SLOTS, PASS_STACK_ALONG, passSlotAlong, PLATES_OUT, PLATER_OUT, DRYER, SINK_BIN, SEAT_STICKS, takeDrink, KITCHEN_DROP, kitchenOf, kitchenGatesOf, AISLE, FLOOR_FAR, FLOOR_NEAR, PLATES_SET, SINK, KITCHEN_FOLK, GENKAN, inGenkan, sauceSide, SEATS_TAKEN, SERVICE, BAR_GATES, TILL, TILL_CASH, TILL_STATE, PLATE_RACK, billOf, yen, payOf, POINTER_HINT, tipOver, TOILETS, WC_GRUMBLE, DRINKS, DRINK_BACK, FRIDGE, FRIDGE_STATE, FRIDGE_STOCK, FRIDGE_UNITS, drinkFor, farOf, fridgesOf, fridgeUnitOf, gateOf, toiletsOf, type DrinkId, passOf, roomOf, alongPath, doorOf, pathLength, pathTo, seatsOf, singleCounter, type Counter } from './bar'
import { buyCase, caseCost, emptyFillable, restockRun } from '@/game/drinkStock'
import { tl } from '@/data/i18n'
import { Kabuto } from './Kabuto'

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
/** the customers drawn in the boss's style (scene/FolkFigure), his height; ?guests=old brings back the old figures (scene/Person3D) */
const FOLK_GUESTS = typeof location === 'undefined' || new URLSearchParams(location.search).get('guests') !== 'old'
/** the staff (the servers) drawn the boss's height, a head shorter than the customers: the boss (Roasting's BOSS_SCALE) is 0.95 tall at 1.68,
 * a figure here 0.97 tall at this and the shop's own scale of 2 */
const STAFF_SCALE = (1.05 * 0.8 * 2 * 0.95) / (0.97 * 2)
/** the owner's figure out serving, inside a server's frame (STAFF_SCALE): his own height (Roasting's BOSS_SCALE in the shop's frame) */
const OWNER_IN_STAFF = (1.05 * 0.8) / STAFF_SCALE
/** the owner out serving (no server hired): his figure with a rock and a bob as he walks, and a black-lacquered tray held in front */
function OwnerWalker({ moving }: { moving: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const o = g.current
    if (!o) return
    const t = clock.elapsedTime
    o.rotation.z = moving ? Math.sin(t * 9) * 0.05 : 0
    o.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.014 : 0
  })
  return (
    <group ref={g}>
      <group scale={OWNER_IN_STAFF}><BossModel /></group>
      <mesh position={[HELD_AT[0], HELD_AT[1] + 0.005, HELD_AT[2]]}>
        <cylinderGeometry args={[0.15, 0.14, 0.016, 28]} />
        <meshToonMaterial color="#1c1412" />
      </mesh>
    </group>
  )
}
/** the staff's door, along the first counter's wall: where the koi print hung, a little along from the bamboo in the corner (the owner's) */
const STAFF_DOOR_AT = -3.55
/** the koi print, moved (the owner's): on the toilets' wall past the drinks fridges, on the plain plaster there; once only, the same array
 * each time (the wall's memo compares it) */
const koiHangs = new Map<string, { z: number; print: 'koi' }[]>()
function koiHang(clear: [number, number][], from: number) {
  const lo = clear.length ? Math.min(...clear.map((r) => r[0])) : from + 1
  const z = Math.max(from + 0.4, lo - 0.55)
  const key = z.toFixed(3)
  let v = koiHangs.get(key)
  if (!v) { v = [{ z, print: 'koi' }]; koiHangs.set(key, v) }
  return v
}
/** a customer in the boss's style, drawn in the customers' frame (PEOPLE_SCALE): the staff's size */
const FOLK_FIT = STAFF_SCALE / PEOPLE_SCALE

/**
 * The way in's noren, in the manner of a modern shop's: unbleached cotton, plain, the shop's crest large in dark brown across the middle
 * (a rounded diamond, a fine one inside it, and in it the shop's first character in a rounded square), and its name in small spaced
 * capitals under it.
 */
const crestNorenTexture = (mark: string) => signTexture(384 * 3, 256 * 3, (g) => {
  // (drawn mirrored: the cloth's face is the side toward the room, so the crest and the name read right from inside)
  g.setTransform(-3, 0, 0, 3, 384 * 3, 0)
  const BROWN = '#3e2a1c'
  // (the cloth: warm off-white, a little darker toward the hem, a fine weave, the dye-free cotton's slubs)
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#efe8d8'); grad.addColorStop(1, '#ddd3bd')
  g.fillStyle = grad; g.fillRect(0, 0, 384, 256)
  g.strokeStyle = 'rgba(120,100,70,0.06)'
  for (let y = 0; y < 256; y += 2.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(384, y); g.stroke() }
  for (let x = 0; x < 384; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke() }
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = 'rgba(150,125,90,0.12)'
  for (let k = 0; k < 220; k++) g.fillRect(rnd() * 384, rnd() * 256, 3 + rnd() * 6, 0.8)
  // (the crest: a rounded diamond in a heavy line with a fine one inside it)
  const CX = 192, CY = 104
  const diamond = (r: number, round: number) => {
    g.beginPath()
    const pts: [number, number][] = [[CX, CY - r], [CX + r, CY], [CX, CY + r], [CX - r, CY]]
    g.moveTo((pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2)
    for (let i = 0; i < 4; i++) g.arcTo(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], round)
    g.closePath()
  }
  g.strokeStyle = BROWN
  g.lineWidth = 6; diamond(68, 14); g.stroke()
  g.lineWidth = 1.6; diamond(58, 11); g.stroke()
  // (in it, a rounded square with the character)
  g.lineWidth = 3.2
  g.beginPath(); g.roundRect(CX - 27, CY - 27, 54, 54, 9); g.stroke()
  brushText(g, [...mark][0] ?? '', CX, CY + 2, 40, { fill: BROWN })
  // (the name under it, small and spaced, in the brown)
  g.fillStyle = BROWN
  g.font = '700 12px Georgia, serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const name = 'K I K U N O   ·   Y A K I Z A K A N A'
  g.fillText(name, CX, CY + 92)
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
 * The stocker (倉儲), there only once one's hired and while the shop's open (drawn as that hire): stands by the crates of drinks at the
 * back (the back stock, DRINK_BACK) and, when a fridge is three or more short
 * of what the back can fill, carries a case over, opens it, fills its empty places from the back (game/drinkStock's restockRun, as many
 * as a trip carries) and goes back to the crates.
 */
const STOCK_CARRY = 8
// (he walks by his own frame loop: drawn again only if he or the room changes, not with every redraw of the bar)
const Stocker = memo(StockerImpl, (a, b) => a.counters === b.counters && a.fridges === b.fridges && a.who.id === b.who.id && a.who.look === b.who.look)
/**
 * The stock keeper (倉儲; the owner's: they order in and restock, and walk to do it), by game/stocker's chores: a toilet's roll running out,
 * changed for a new one (in through its door when nobody's using it, the guests leaving it till he's out); the drinks carried out of the back
 * to a fridge short of them; a place's box of tissues running low, changed for a spare (its drawer pulled out while he does, nobody sat
 * there); and, looking round, a case of a drink ordered in once the back's down to under half a case of it. From his place by the crates
 * along the aisles, round the corner for the long counter.
 */
function StockerImpl({ counters, fridges, who }: { counters: Counter[]; fridges: NonNullable<ReturnType<typeof fridgesOf>>; who: { id: string; look: StaffLook } }) {
  const g = useRef<THREE.Group>(null)
  const held = useRef<{ crate: THREE.Object3D | null; roll: THREE.Object3D | null; box: THREE.Object3D | null }>({ crate: null, roll: null, box: null })
  const c1 = counters[1]
  const home = useMemo(() => {
    const last = fridges[fridges.length - 1]
    return c1.at.clone().addScaledVector(c1.along, last.z - FRIDGE.W / 2 - 0.3).addScaledVector(c1.lay, farOf(c1) + 0.32 + 0.55)
  }, [c1, fridges])
  const seats = useMemo(() => seatsOf(counters), [counters])
  const wcs = useMemo(() => toiletsOf(counters), [counters])
  /** his way out into the side counter's aisle, across from his place */
  const homeAisle = useMemo(() => c1.at.clone().addScaledVector(c1.along, home.clone().sub(c1.at).dot(c1.along) / c1.along.lengthSq()).addScaledVector(c1.lay, -AISLE), [home, c1])
  const st = useRef({ phase: 'idle' as 'idle' | 'go' | 'work' | 'back', t: 0, chore: null as StockChore, path: [] as THREE.Vector3[], len: 0, d: 0,
    pos: home.clone(), yaw: 0, check: 0, done: false })
  const [moving, setMoving] = useState(false)
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __stocker?: typeof st }).__stocker = st
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.1)
    const s = st.current
    /** along his way, out or back (back: the same way, walked from its end) */
    const walk = () => {
      s.d = Math.min(s.len, s.d + dt * 1.0)
      const { p, dir } = alongPath(s.path, s.phase === 'back' ? s.len - s.d : s.d)
      s.pos.copy(p)
      if (dir.x || dir.z) s.yaw = s.phase === 'back' ? Math.atan2(-dir.x, -dir.z) : Math.atan2(dir.x, dir.z)
      return s.d >= s.len
    }
    const set = (path: THREE.Vector3[]) => { s.path = path; s.len = pathLength(path); s.d = 0 }
    const c = s.chore
    if (s.phase === 'idle') {
      s.check += dt
      s.yaw += (Math.atan2(-c1.lay.x, -c1.lay.z) - s.yaw) * Math.min(1, dt * 4)
      if (s.check > 1) {
        s.check = 0
        // (a case ordered in of whatever the back's running out of, one a look)
        const ids = FRIDGE_UNITS.flatMap((u) => u.shelves.flatMap((sh) => sh.ids))
        const want = drinksToOrder(DRINK_BACK.back, ids)[0]
        if (want) {
          const r = buyCase(DRINK_BACK.back, want, SHOP_PURSE.cash())
          if (r.ok) { DRINK_BACK.back = r.back; SHOP_PURSE.spend(caseCost(want)); DRINK_BACK.ver++ }
        }
        const busy = (w: 'm' | 'f') => TOILETS[w].passing > 0 || TOILETS[w].inside > 0
        const next = stockerChore({
          rolls: { m: TOILETS.m.room.paper, f: TOILETS.f.room.paper }, wcBusy: { m: busy('m'), f: busy('f') },
          fridgeShort: fridges.map((f) => emptyFillable(FRIDGE_STOCK.units[f.n], FRIDGE_UNITS[f.n].shelves.map((sh) => sh.ids), DRINK_BACK.back)),
          boxes: seats.map((_, i) => tissuesAt(i)), seatTaken: (n) => SEATS_TAKEN.has(n), spares: Math.max(0, SUPPLIES.has(TISSUE)),
        })
        if (next && !(next.kind === 'roll' && !wcs)) {
          s.chore = next
          s.done = false
          if (next.kind === 'drinks') set([home.clone(), fridges.find((f) => f.n === next.unit)!.front.clone()])
          else if (next.kind === 'roll') {
            const w = wcs![next.who]
            STOCKER_WC.who = next.who
            // (in at the door, past the washstand, round the corner to the toilet's paper)
            set([home.clone(), homeAisle.clone(), w.aisle.clone(), w.front.clone(), w.inside.clone(), w.turn.clone(), w.stall.clone()])
          } else {
            const seat = seats[next.seat]
            // (beside the stool, on the drawer's side, facing the bar)
            const beside = seat.aisle.clone().lerp(seat.stool, 0.55).addScaledVector(seat.along, -0.3)
            set([home.clone(), homeAisle.clone(), ...(seat.counter === 1 ? [] : [aisleCornerOf(counters, c1)]), seat.aisle.clone(), beside])
          }
          s.phase = 'go'
          setMoving(true)
        }
      }
    } else if (s.phase === 'go') {
      if (walk()) { s.phase = 'work'; s.t = 0; setMoving(false) }
    } else if (s.phase === 'work' && c) {
      s.t += dt
      if (c.kind === 'drinks') {
        const f = fridges.find((x) => x.n === c.unit)!
        s.yaw = Math.atan2(f.at.x - s.pos.x, f.at.z - s.pos.z)
        if (s.t < dt * 1.5) FRIDGE_STATE[c.unit].passing++
        if (s.t > 1.6) {
          const run = restockRun(FRIDGE_STOCK.units[c.unit], FRIDGE_UNITS[c.unit].shelves.map((sh) => sh.ids), DRINK_BACK.back, STOCK_CARRY)
          run.rows.forEach((r, i) => { FRIDGE_STOCK.units[c.unit][i] = r })
          DRINK_BACK.back = run.back
          DRINK_BACK.ver++
          FRIDGE_STOCK.ver++
          FRIDGE_STATE[c.unit].passing = Math.max(0, FRIDGE_STATE[c.unit].passing - 1)
          s.phase = 'back'
        }
      } else if (c.kind === 'roll') {
        // (in, the door shut behind him: the old roll off the holder, a new one on)
        if (s.t > 2.4 && !s.done) {
          s.done = true
          const t = TOILETS[c.who]
          t.room = newRoll(t.room)
          t.rollAt = performance.now()
        }
        if (s.t > 2.8) s.phase = 'back'
      } else {
        // (the drawer out, the box in it changed for a spare, the drawer back in)
        const seat = seats[c.seat]
        const at = seat.mid
        s.yaw = Math.atan2(at.x - s.pos.x, at.z - s.pos.z)
        if (!SEATS_TAKEN.has(c.seat)) DRAWER_HELD.add(c.seat)
        if (s.t > 1.3 && !s.done) {
          s.done = true
          if (SUPPLIES.take(TISSUE, 1)) setTissues(c.seat, BOX_SHEETS)
        }
        if (s.t > 2.0) { DRAWER_HELD.delete(c.seat); s.phase = 'back' }
      }
      if (s.phase === 'back') { s.d = 0; setMoving(true) }
    } else if (s.phase === 'back') {
      if (walk()) {
        s.phase = 'idle'
        s.pos.copy(home)
        if (c?.kind === 'roll') STOCKER_WC.who = null
        s.chore = null
        setMoving(false)
      }
    }
    // (at a toilet's door: near enough to have it open; in, past it)
    if (c?.kind === 'roll' && wcs) {
      const w = wcs[c.who]
      STOCKER_WC.near = s.pos.distanceTo(w.front) < 1.3 && !(s.phase === 'work')
      STOCKER_WC.inside = s.phase === 'work'
    } else { STOCKER_WC.near = false; STOCKER_WC.inside = false }
    if (g.current) {
      g.current.position.copy(s.pos)
      g.current.rotation.y = s.yaw
      // (unseen while he's in the toilet, the door shut)
      g.current.visible = !(c?.kind === 'roll' && s.phase === 'work')
    }
    // (in his arms: a case of drinks carried out; a new roll; a new box of tissues; back empty-handed)
    const out = s.phase === 'go' || s.phase === 'work'
    const h = held.current
    if (h.crate) h.crate.visible = out && c?.kind === 'drinks'
    if (h.roll) h.roll.visible = out && c?.kind === 'roll' && !s.done
    if (h.box) h.box.visible = out && c?.kind === 'tissue' && !s.done
  })
  // (shut, nothing of his left about: no drawer held out, no toilet waiting on him)
  useEffect(() => () => { STOCKER_WC.who = null; STOCKER_WC.near = false; STOCKER_WC.inside = false; DRAWER_HELD.clear() }, [])
  return (
    <group ref={g} position={home} scale={STAFF_SCALE}>
      <BlobShadow r={0.17} />
      <StaffFigure id={who.id} role="stock" look={who.look} moving={moving} />
      <mesh ref={(o) => { held.current.crate = o }} position={[0, HELD_AT[1] + 0.06, HELD_AT[2]]} visible={false}>
        <boxGeometry args={[0.22, 0.13, 0.16]} />
        <meshToonMaterial color="#b98a52" />
      </mesh>
      <mesh ref={(o) => { held.current.roll = o }} position={[0, HELD_AT[1] + 0.05, HELD_AT[2]]} rotation-z={Math.PI / 2} visible={false}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 14]} />
        <meshToonMaterial color="#f4f2ec" />
      </mesh>
      <mesh ref={(o) => { held.current.box = o }} position={[0, HELD_AT[1] + 0.04, HELD_AT[2]]} visible={false}>
        <boxGeometry args={[0.2, 0.06, 0.11]} />
        <meshToonMaterial color="#e9e3d4" />
      </mesh>
    </group>
  )
}

/**
 * The way in: a noren hanging just past the end of the bar, three panels that sway a little.
 */
// (drawn again only if the door's place or the shop's mark changes: the bar above it redraws several times a second while the shop's open, and
// the way in is a dozen pieces, each in edit mode's wrapper)
export const Entrance = memo(EntranceImpl, (a, b) => a.mark === b.mark && a.at.equals(b.at))
function EntranceImpl({ at, mark }: { at: THREE.Vector3; mark: string }) {
  const lantern = mark === '聞野' ? '燒' : mark
  // (the grill's noren reads 烤魚, the shop's trade, with a fish on it; the other shops' name their own)
  const tex = useMemo(() => crestNorenTexture(mark), [mark])
  const panels = useRef<(THREE.Mesh | null)[]>([])
  const yaw = Math.atan2(ALONG.x, ALONG.z)
  // (hung high, its rod well over a customer's head: they duck through only its hem)
  // (the doorway wide, its middle a little off the way in toward the till: the wall's close on the other side)
  const W = 1.05, H = 2.14, DX = -0.12
  // (the rod and cloth hung out toward the doorway's own line, not back in the room)
  const NZ = 0.27
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    panels.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.05
    })
  })
  return (
    <group name="look-door" position={at} rotation-y={yaw}>
      {/* (in edit mode the cats' stand, the shoe cupboard and the like can each be moved: each its own batch inside its own Movable) */}
      <Movable id="doorcats" label="門口招財貓台"><StaticBatch>
      {/* just inside, against the wall: a two-tier stand of dark wood, the beckoning cats on it facing those coming in */}
      <group position={[0.4, 0, CAT_STAND_Z]}>
        {/* (its back against the wall, 0.1 behind its middle: the lower tier deep, the upper shallow and narrower) */}
        {[[-0.12, 0.44, 0.32, 0.84], [-0.02, 0.24, 0.6, 0.7]].map(([x, d, h, l], i) => (
          <group key={i}>
            <Part geo={REG_GEO.round} color={i ? '#4a2e1c' : '#5a3a24'} outline={1.02} position={[x, h / 2, 0]} scale={[d, h, l]} />
            {/* (a red felt (毛氈) laid over each tier, hanging a little down its front, as under a festival's dolls) */}
            <mesh position={[x, h + 0.004, 0]}><boxGeometry args={[d + 0.01, 0.008, l + 0.01]} /><meshToonMaterial color="#b8261c" /></mesh>
            <mesh position={[x - d / 2 - 0.004, h - 0.03, 0]}><boxGeometry args={[0.008, 0.06, l + 0.01]} /><meshToonMaterial color="#a8201a" /></mesh>
          </group>
        ))}
      </group>
      </StaticBatch></Movable>
      {/* (each cat its own piece in edit mode, on the stand's frame) */}
      <group position={[0.4, 0, CAT_STAND_Z]}>
        {DOOR_CATS.map((k, i) => (
          <Movable key={i} id={`doorcat${i}`} label={`招財貓 ${i + 1}`}><StaticBatch>
            <group position={[k.x, k.y, k.z]} rotation-y={-Math.PI / 2 + k.yaw}><LuckyCat kind={k.kind} height={k.h} still /></group>
          </StaticBatch></Movable>
        ))}
      </group>
      {/* a samurai helmet (兜) on its stand, set out on top of the shoe cupboard as a decoration, facing into the room */}
      <Movable id="kabuto" label="武士頭盔"><group position={[0.34, -GENKAN.depth + 0.87, SHOE_CAB_Z - 0.09]} rotation-y={Math.PI / 2} scale={0.82}><Kabuto /></group></Movable>
      <Movable id="genkan" label="玄關地墊"><StaticBatch>
      {/* just inside, the doormat set flush into its recess: a dark stone well, a frame round it, the coir mat in it */}
      {/* the coir mat lying on the genkan's stone, just inside */}
      <mesh position={[0, -GENKAN.depth + 0.009, -0.18]} rotation-x={-Math.PI / 2} scale={[-1, 1, 1]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshToonMaterial color="#ffffff" map={DOORMAT} />
      </mesh>
      </StaticBatch></Movable>
      <Movable id="shoecab" label="鞋櫃"><StaticBatch>
      {/* the shoe cupboard (下駄箱) against the wall in the genkan: dark wood, its doors in a grid of small panels, a
          vase of a sprig on top */}
      <group position={[0.34, -GENKAN.depth, SHOE_CAB_Z]}>
        <Part geo={REG_GEO.round} color="#4a2e1c" outline={1.02} position={[0, 0.42, 0]} scale={[0.3, 0.84, 0.42]} />
        {/* (its plinth, set back a little, dark) */}
        <mesh position={[0.01, 0.025, 0]}><boxGeometry args={[0.29, 0.05, 0.41]} /><meshToonMaterial color="#24160c" /></mesh>
        {[0, 1, 2].map((r) => [-1, 1].map((sd) => (
          <group key={`${r}${sd}`} position={[-0.152, 0.17 + r * 0.24, sd * 0.1]}>
            {/* (each door a frame round a kumiko lattice over pale paper, a brass pull) */}
            <mesh rotation-y={-Math.PI / 2}><planeGeometry args={[0.17, 0.21]} /><meshToonMaterial color="#5a3820" /></mesh>
            <mesh position-x={-0.002} rotation-y={-Math.PI / 2}><planeGeometry args={[0.13, 0.17]} /><meshToonMaterial color="#e8dcc0" /></mesh>
            {[-0.04, 0, 0.04].map((k) => (
              <mesh key={`v${k}`} position={[-0.004, 0, k]}><boxGeometry args={[0.004, 0.17, 0.006]} /><meshToonMaterial color="#6a4428" /></mesh>
            ))}
            {[-0.055, -0.0185, 0.0185, 0.055].map((k) => (
              <mesh key={`h${k}`} position={[-0.004, k, 0]}><boxGeometry args={[0.004, 0.006, 0.13]} /><meshToonMaterial color="#6a4428" /></mesh>
            ))}
            <mesh position={[-0.008, 0, -sd * 0.07]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.009, 0.009, 0.01, 10]} /><meshToonMaterial color="#c8a050" /></mesh>
          </group>
        )))}
        <Part geo={REG_GEO.round} color="#3a2416" outline={1.02} position={[0, 0.855, 0]} scale={[0.32, 0.03, 0.44]} />
        <mesh position={[0, 0.93, 0.15]}><cylinderGeometry args={[0.03, 0.04, 0.12, 12]} /><meshToonMaterial color="#e8e2d2" /></mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[Math.cos(k * 2) * 0.02, 1.04 + k * 0.02, 0.15 + Math.sin(k * 2) * 0.02]} rotation={[Math.sin(k * 2) * 0.4, 0, Math.cos(k * 2) * 0.4]}>
            <cylinderGeometry args={[0.003, 0.004, 0.16, 4]} /><meshToonMaterial color="#5a3a1e" />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((k) => (
          <mesh key={`b${k}`} position={[Math.cos(k * 1.7) * 0.05, 1.1 + (k % 2) * 0.03, 0.15 + Math.sin(k * 1.7) * 0.05]}><sphereGeometry args={[0.014, 6, 5]} /><meshToonMaterial color="#f2b0c0" /></mesh>
        ))}
      </group>
      </StaticBatch></Movable>
      <group position-x={DX}>
      {/* the doorway: the noren's rod, and the red lantern hung by the doorway on the bar's side */}
      {/* (the red lantern, its own piece: hung by its own cord) */}
      <Movable id="chochin" label="紅燈籠" baseTurn={[0, 45, 0]}><group position={[-(W / 2 * NOREN_WIDE + 0.12) + 0.26, H - 0.08 - 2.25, 0.47]} userData={{ fade: true }}><Chochin mark={lantern} /></group></Movable>
      {/* (and the grill's own, cream, 炭火焼 on it, hung on the doorway's other side) */}
      <Movable id="chochin2" label="燒烤燈籠" baseTurn={[0, 45, 0]}><group position={[(W / 2 * NOREN_WIDE + 0.12) + 0.26, H - 0.08 - 2.25, 0.47]} userData={{ fade: true }}><Chochin mark={lantern} style="cream" /></group></Movable>
      {/* (and beyond it the fish lantern, a round one with a fish hung under it (the owner's, after their photograph of one)) */}
      <Movable id="fishlantern" label="魚燈"><group position={[(W / 2 * NOREN_WIDE + 0.12) + FISH_LANTERN_OUT, H - 0.08, 0.47]} scale={0.85} userData={{ fade: true }}><FishLantern /></group></Movable>
      {/* the noren: three panels side by side, hung from a bamboo rod under the lintel, the rod by a cord at each end from the beam above */}
      <Movable id="noren" label="門簾">
        {/* (fades when it stands between the camera and what's looked at, as the other hangings do: see OccluderFade) */}
        <group userData={{ fade: true }}>
          {/* (the pole laid on the lintel's brackets, no cords; the cloth longer than it was, as wide as the doorway so it stays clear of the walls) */}
          <group position-y={NOREN_CORD}>
          <group position={[0, H - 0.05, NZ]} scale={[NOREN_WIDE, NOREN_BIG * 1.05, 1]}><NorenModel tex={tex} panels={panels} pole="wood" /></group>
          </group>
        </group>
      </Movable>
      </group>
    </group>
  )
}

/** the noren (blender/genkan.py): its lacquered rod with brass caps, and three cloth panels in soft folds with their tabs over the rod, each painted
 * with its third of the shop's cloth and swung from its top edge */
/** a natural wood pole's grain: pale peeled cedar, long streaks along it and a knot here and there */
const POLE_WOOD = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#c99f6e'; g.fillRect(0, 0, 256, 64)
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 70; k++) {
    const y = rnd() * 64
    g.strokeStyle = rnd() < 0.5 ? 'rgba(120,80,40,0.35)' : 'rgba(240,210,160,0.35)'
    g.lineWidth = 0.6 + rnd() * 1.4
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rnd() * 4 - 2, 170, y + rnd() * 4 - 2, 256, y); g.stroke()
  }
  for (const x of [60, 190]) { g.fillStyle = 'rgba(100,60,30,0.6)'; g.beginPath(); g.ellipse(x, 30, 5, 3, 0, 0, Math.PI * 2); g.fill() }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()
function NorenModel({ tex, panels, pole = 'lacquer' }: { tex: THREE.Texture | null; panels: React.MutableRefObject<(THREE.Mesh | null)[]>
  /** the rod: the old black lacquer with brass caps, or a plain pole of natural wood */
  pole?: 'lacquer' | 'wood' }) {
  const gltf = useGLTF(NOREN_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = gltf.scene.clone(true)
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      const k = /NorenPanel(\d)/.exec(m.name)
      if (k) {
        m.material = new THREE.MeshToonMaterial({ map: panelTex(tex, +k[1]), side: THREE.DoubleSide })
        panels.current[+k[1]] = m
      } else if (pole === 'wood') m.material = new THREE.MeshToonMaterial({ color: '#ffffff', map: POLE_WOOD })
      else m.material = src.name === 'NorenBrass' ? new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 1, roughness: 0.3 })
        : new THREE.MeshToonMaterial({ color: src.color.clone() })
    })
    return r
  }, [gltf, tex, panels, pole])
  return <primitive object={model} />
}


/** how much longer the way in's noren is drawn than it was made, and how much wider (kept to the doorway's width) */
const NOREN_BIG = 1.3
const NOREN_WIDE = 1.0
/** how long the noren's two cords are, from the beam down to its rod (the rod hung 0.18 higher than it was) */
const NOREN_CORD = 0.18

/** the coir doormat: tan bristle in ribs, a dark border, the shop's welcome (いらっしゃいませ) woven across it */
const DOORMAT = (() => signTexture(512, 280, (g) => {
  // (a coir mat: its bristles in tufts, a woven indigo border with a cream line, the welcome brushed in and a crest of waves at each end)
  g.setTransform(2, 0, 0, 2, 0, 0)
  g.fillStyle = '#1e2c4c'; g.fillRect(0, 0, 256, 140)
  g.fillStyle = '#f2e6c8'; g.fillRect(8, 8, 240, 124)
  g.fillStyle = '#a77d4c'; g.fillRect(11, 11, 234, 118)
  let seed = 5
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 3200; k++) {
    const x = 11 + rnd() * 234, y = 11 + rnd() * 118
    g.fillStyle = rnd() < 0.5 ? 'rgba(80,50,22,0.35)' : 'rgba(230,200,150,0.25)'
    g.fillRect(x, y, 1.2, 2.6)
  }
  for (const cx of [36, 220]) for (let r = 4; r <= 16; r += 4) { g.strokeStyle = 'rgba(40,24,10,0.55)'; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, 82, r, Math.PI, 0); g.stroke() }
  brushText(g, 'いらっしゃいませ', 128, 66, 24, { fill: '#2e1c0e', shadow: 'rgba(255,230,180,0.35)', spacing: 2 })
}))()

/**
 * A long lantern's skin (長提灯), its picture once round it: the washi lit from inside, the bamboo ribs it's wound on painted in (each a fine
 * dark line, the paper between them bellying a little, lit at its crown), its ends darker under the caps; and down its front and again round
 * its back the words in big brushed characters. `red`: the red one, the shop's mark in black edged with gold; `cream`: the grill's, cream
 * paper, 炭火焼 in black with a red band top and bottom.
 */
const chochinTexture = (mark: string, style: 'red' | 'cream' = 'red') => signTexture(512, 512, (g) => {
  const cream = style === 'cream'
  const grad = g.createLinearGradient(0, 0, 512, 0)
  // (brightest down the middle of each face, where the lamp's behind it)
  const [deep, mid] = cream ? ['#cbb894', '#fbf1d8'] : ['#8a1810', '#e8402e']
  for (const [k, c] of [[0, deep], [0.25, mid], [0.5, deep], [0.75, mid], [1, deep]] as [number, string][]) grad.addColorStop(k, c)
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 512)
  // (the ribs: a fine dark line each, the paper just above and below it a shade darker, between them a soft light)
  const RIBS = 26
  for (let k = 0; k <= RIBS; k++) {
    const y = (k / RIBS) * 512
    const band = g.createLinearGradient(0, y - 512 / RIBS / 2, 0, y + 512 / RIBS / 2)
    band.addColorStop(0, 'rgba(255,240,210,0)')
    band.addColorStop(0.5, cream ? 'rgba(90,60,30,0.16)' : 'rgba(60,8,4,0.22)')
    band.addColorStop(1, 'rgba(255,240,210,0)')
    g.fillStyle = band
    g.fillRect(0, y - 512 / RIBS / 2, 512, 512 / RIBS)
    g.fillStyle = cream ? 'rgba(80,50,25,0.45)' : 'rgba(50,6,3,0.5)'
    g.fillRect(0, y - 0.9, 512, 1.8)
  }
  // (darker at the ends, under the caps)
  const ends = g.createLinearGradient(0, 0, 0, 512)
  ends.addColorStop(0, 'rgba(20,6,2,0.45)'); ends.addColorStop(0.1, 'rgba(20,6,2,0)'); ends.addColorStop(0.9, 'rgba(20,6,2,0)'); ends.addColorStop(1, 'rgba(20,6,2,0.45)')
  g.fillStyle = ends
  g.fillRect(0, 0, 512, 512)
  if (cream) {
    // (the grill's: a red band round it near each end)
    for (const y of [56, 440]) { g.fillStyle = '#b8261c'; g.fillRect(0, y, 512, 16) }
  }
  // (the words, down the front and again round the back)
  const chars = [...(cream ? '炭火焼' : mark)]
  const size = chars.length === 1 ? 230 : chars.length === 2 ? 168 : 124
  const gap = chars.length === 1 ? 0 : size * 1.02
  for (const u of [128, 384]) chars.forEach((ch, i) =>
    brushText(g, ch, u, 256 + (i - (chars.length - 1) / 2) * gap, size, cream
      ? { fill: '#160a06', shadow: 'rgba(255,200,120,0.3)' }
      : { fill: '#160a06', edge: 'rgba(245,200,110,0.55)', shadow: 'rgba(255,170,90,0.35)' }))
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
const CHOCHIN_URL = import.meta.env.BASE_URL + 'models/chochin.glb'
const NOREN_URL = import.meta.env.BASE_URL + 'models/noren.glb'
useGLTF.preload(CHOCHIN_URL)
useGLTF.preload(NOREN_URL)

/**
 * A red paper lantern (赤提灯) hung at the door on a little arm off a post, the shop's name on it, lit from inside:
 * it sways a touch and its glow breathes like the flame in it.
 */
function Chochin({ mark, style = 'red' }: { mark: string; style?: 'red' | 'cream' }) {
  const tex = useMemo(() => chochinTexture(mark, style), [mark, style])
  const hang = useRef<THREE.Group>(null)
  const skin = useRef<THREE.MeshBasicMaterial>(null)
  // (blender/genkan.py's lantern: its paper lit from within and painted with the name, its caps lacquer, its bands and bail gold)
  const gltf = useGLTF(CHOCHIN_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = gltf.scene.clone(true)
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'ChochinPaper') {
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
        skin.current = mat
        m.material = mat
      } else m.material = src.name === 'ChochinGold' ? new THREE.MeshStandardMaterial({ color: '#d6a84a', metalness: 1, roughness: 0.3 })
        : new THREE.MeshToonMaterial({ color: src.color.clone() })
    })
    inkModel(r, (m) => /Band|Bail|Tassel/.test(m.name), { width: 0.0015, weld: true })
    return r
  }, [gltf, tex])
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
        {/* (the long lantern's middle: its cord, then half its height under it) */}
        <group position-y={-0.5}>
          <primitive object={model} />
          <sprite ref={halo} scale={[0.9, 1.25, 1]}>
            <spriteMaterial map={CHOCHIN_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.5} />
          </sprite>
        </group>
      </group>
    </group>
  )
}

/** how far beyond the grill's lantern the fish lantern hangs, along the doorway's face; the cord from the beam to its ring */
const FISH_LANTERN_OUT = 0.44
const FISH_LANTERN_CORD = 0.1
/** the arm it hangs from, out of the wall's end (its own frame's units, before its scale) */
const FISH_ARM = 0.42
const FISH_LANTERN_URL = import.meta.env.BASE_URL + 'models/fishlantern.glb'
useGLTF.preload(FISH_LANTERN_URL)
/** the fish's radius down its length (t 0 its head's top, 1 the root of its tail), as blender/fishlantern.py turns it: to paint its flowers
 * round wherever they are on it (the paper's u is the same width round its narrow tail as round its shoulders) */
const FISH_RT: [number, number][] = [[0, 0], [0.02, 0.026], [0.06, 0.047], [0.12, 0.063], [0.2, 0.076], [0.3, 0.085], [0.4, 0.086], [0.5, 0.081],
  [0.6, 0.072], [0.7, 0.059], [0.8, 0.044], [0.9, 0.031], [0.96, 0.026], [1, 0.024]]
const fishR = (t: number) => {
  for (let i = 1; i < FISH_RT.length; i++) if (t <= FISH_RT[i][0]) {
    const [t0, r0] = FISH_RT[i - 1], [t1, r1] = FISH_RT[i]
    return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0)
  }
  return FISH_RT[FISH_RT.length - 1][1]
}
/** the fish lantern's pictures, painted once: the fish's indigo washi, lit from within (brightest down the middle of its front and back, darker
 * to its sides and ends, mottled as dyed paper is), printed with white blossoms of four and five petals, its eyes gold-ringed; its fins and
 * tail ribbed, indigo at the root going pale to a scalloped edge (cut out: alphaTest); the round lantern's washi with 焼魚 on it front and
 * back. u round the fish reads left to right from its front, 0.75 the middle of its front; v from its head down */
const FISH_LANTERN_TEX = (() => {
  if (typeof document === 'undefined') return null
  const W = 1024, H = 1024, L = 0.56
  // (a little seeded stream of numbers, the same fish every time)
  let n = 97
  const rnd = () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646 }
  const body = document.createElement('canvas')
  body.width = W; body.height = H
  const g = body.getContext('2d')!
  const im = g.createImageData(W, H)
  const dark = [24, 38, 84], light = [96, 128, 196]
  for (let y = 0; y < H; y++) {
    const t = y / H, along = 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15))
    for (let x = 0; x < W; x++) {
      const u = x / W
      const face = Math.pow(Math.abs(Math.sin(2 * Math.PI * u)), 0.8)
      const mottle = 0.06 * Math.sin(u * 37 + t * 11) * Math.sin(u * 13 - t * 29) + 0.04 * Math.sin(u * 91 + t * 53)
      const k = Math.min(1, Math.max(0, 0.18 + 0.7 * face * along + mottle))
      const i = (y * W + x) * 4
      im.data[i] = dark[0] + (light[0] - dark[0]) * k
      im.data[i + 1] = dark[1] + (light[1] - dark[1]) * k
      im.data[i + 2] = dark[2] + (light[2] - dark[2]) * k
      im.data[i + 3] = 255
    }
  }
  g.putImageData(im, 0, 0)
  // (pixels to a metre round it at t, and down it)
  const across = (t: number) => W / (2 * Math.PI * Math.max(0.012, fishR(t)) * 0.914)
  const down = H / L
  const EYES: [number, number][] = [[1 - 35 / 360, 0.1], [1 - 145 / 360, 0.1]]
  /** a blossom (world radius `r` metres) at u, t: `petals` round petals, white, its heart a dot; drawn again across the seam if it runs over */
  const blossom = (u: number, t: number, r: number, petals: number, turn: number) => {
    for (const shift of [-W, 0, W]) {
      const x = u * W + shift, y = t * H
      const hs = across(t) * r, vs = down * r
      if (x + hs < 0 || x - hs > W) continue
      g.save()
      g.translate(x, y)
      g.scale(hs, vs)
      g.rotate(turn)
      g.fillStyle = '#f4f1e6'
      for (let k = 0; k < petals; k++) {
        const a = (k / petals) * Math.PI * 2
        g.beginPath(); g.ellipse(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.48, 0.4, a, 0, Math.PI * 2); g.fill()
      }
      g.fillStyle = petals === 5 ? '#e8c46a' : '#26386f'
      g.beginPath(); g.arc(0, 0, 0.17, 0, Math.PI * 2); g.fill()
      g.restore()
    }
  }
  for (let k = 0, made = 0; k < 400 && made < 110; k++) {
    const u = rnd(), t = 0.03 + rnd() * 0.94, r = 0.009 + rnd() * 0.014
    // (none over its eyes)
    if (EYES.some(([eu, et]) => Math.hypot(Math.min(Math.abs(u - eu), 1 - Math.abs(u - eu)) * W / across(et), (t - et) * L) < 0.03 + r)) continue
    blossom(u, t, r, rnd() < 0.6 ? 5 : 4, rnd() * Math.PI)
    made++
  }
  // (its eyes: a gold ring round a black eye, a glint in it)
  for (const [u, t] of EYES) {
    const x = u * W, y = t * H, hs = across(t), vs = down
    g.save(); g.translate(x, y); g.scale(hs, vs)
    g.fillStyle = '#1a1410'; g.beginPath(); g.arc(0, 0, 0.0185, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#e8b530'; g.beginPath(); g.arc(0, 0, 0.016, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#120c08'; g.beginPath(); g.arc(0, 0, 0.0095, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.003, -0.003, 0.0028, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  const bodyTex = new THREE.CanvasTexture(body)
  bodyTex.colorSpace = THREE.SRGBColorSpace
  bodyTex.wrapS = THREE.RepeatWrapping
  bodyTex.anisotropy = 4
  // (a fin: x from its root to its edge, y across it; seven ribs, the edge scalloped between them)
  const fin = document.createElement('canvas')
  fin.width = fin.height = 256
  const f = fin.getContext('2d')!
  const RIBS = 7, F = 256
  const edge = new Path2D()
  edge.moveTo(0, 0)
  edge.lineTo(F * 0.9, 0)
  for (let k = 0; k < RIBS; k++) {
    const y0 = (k / RIBS) * F, y1 = ((k + 1) / RIBS) * F, ym = (y0 + y1) / 2
    edge.quadraticCurveTo(F * 1.04, ym, F * 0.88, y1)
  }
  edge.lineTo(0, F)
  edge.closePath()
  const fill = f.createLinearGradient(0, 0, F, 0)
  fill.addColorStop(0, '#22336a'); fill.addColorStop(0.55, '#4d68ab'); fill.addColorStop(0.85, '#9fb2dc'); fill.addColorStop(1, '#e4e8f2')
  f.fillStyle = fill
  f.fill(edge)
  f.save()
  f.clip(edge)
  // (the ribs, pale, each with the dye pooled darker along its side)
  for (let k = 0; k < RIBS; k++) {
    const y = ((k + 0.5) / RIBS) * F
    f.strokeStyle = 'rgba(14,22,52,0.35)'; f.lineWidth = 5
    f.beginPath(); f.moveTo(0, y + 2); f.lineTo(F, y + 2); f.stroke()
    f.strokeStyle = '#eee9dc'; f.lineWidth = 2.4
    f.beginPath(); f.moveTo(0, y); f.lineTo(F, y); f.stroke()
  }
  // (a pale rim along its scalloped edge, and a few white spots)
  f.strokeStyle = 'rgba(240,238,230,0.9)'; f.lineWidth = 5
  f.stroke(edge)
  f.fillStyle = 'rgba(244,241,230,0.85)'
  for (let k = 0; k < 10; k++) { f.beginPath(); f.arc(F * (0.25 + rnd() * 0.5), F * rnd(), 3 + rnd() * 4, 0, Math.PI * 2); f.fill() }
  f.restore()
  const finTex = new THREE.CanvasTexture(fin)
  finTex.colorSpace = THREE.SRGBColorSpace
  return { bodyTex, finTex }
})()
/** the round lantern's paper: washi lit from within, ribbed, 焼魚 in black brush round its front and again round its back (u reads left to right
 * from the front, 0.75 its middle; v from its top down). Its lettering drawn wider than tall: the paper's u is a longer way round its belly
 * than its v is up it */
const FISH_TOP_TEX = signTexture(1024, 256, (g) => {
  const W = 1024, H = 256
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#c9b58e'); grad.addColorStop(0.3, '#f6ecd4'); grad.addColorStop(0.5, '#fff8e8'); grad.addColorStop(0.7, '#f6ecd4'); grad.addColorStop(1, '#c9b58e')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let y = 4; y < H; y += 10.5) { g.fillStyle = 'rgba(120,90,50,0.22)'; g.fillRect(0, y, W, 1.6) }
  g.fillStyle = 'rgba(120,90,50,0.12)'
  for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 1.5, H)
  for (const cx of [W * 0.75, W * 0.25]) {
    g.save()
    g.translate(cx, H * 0.53)
    g.scale(1.36, 1)
    brushText(g, '焼', -54, 0, 104, { fill: '#140a06', shadow: 'rgba(255,200,120,0.3)' })
    brushText(g, '魚', 54, 0, 104, { fill: '#140a06', shadow: 'rgba(255,200,120,0.3)' })
    g.restore()
  }
})
/** a soft round glow, warm white, for round the lit papers */
const FISH_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,236,200,0.7)'); grad.addColorStop(0.4, 'rgba(255,220,170,0.22)'); grad.addColorStop(1, 'rgba(255,210,160,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()
/**
 * The fish lantern by the door (the owner's, after their photograph of one: blender/fishlantern.py): a round paper lantern with 焼魚 on it,
 * and under it on a short chain a fish lantern hung head up, its indigo washi printed with white blossoms, gold-ringed eyes, ribbed fins
 * spread out on either side and its tail fanned at the foot, lit from within. It hangs on a cord from the beam and sways a touch, the fish
 * on its chain a moment behind the lantern; its glow breathes like the flame in it.
 */
function FishLantern() {
  const gltf = useGLTF(FISH_LANTERN_URL) as unknown as { scene: THREE.Group }
  const hang = useRef<THREE.Group>(null)
  const { model, fish, papers } = useMemo(() => {
    const r = gltf.scene.clone(true)
    const papers: THREE.MeshBasicMaterial[] = []
    const lit = (map: THREE.Texture | null, fin = false) => {
      const m = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: fin ? THREE.DoubleSide : THREE.FrontSide, alphaTest: fin ? 0.5 : 0 })
      papers.push(m)
      return m
    }
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = (m.material as THREE.Material).name
      m.material = name === 'FishLanternTopPaper' ? lit(FISH_TOP_TEX)
        : name === 'FishLanternPaper' ? lit(FISH_LANTERN_TEX?.bodyTex ?? null)
          : name === 'FishLanternFinPaper' ? lit(FISH_LANTERN_TEX?.finTex ?? null, true)
            : name === 'FishLanternIron' ? new THREE.MeshToonMaterial({ color: '#2a2622' })
              : new THREE.MeshToonMaterial({ color: '#16110e' })
      m.castShadow = false
    })
    inkModel(r, (m) => /Fins|Chain/.test(m.name), { width: 0.0015, weld: true })
    // (the fish and its fins on a pivot at its head, where the chain holds it, to swing a little after the lantern)
    const body = r.getObjectByName('FishLanternBody') as THREE.Mesh | undefined
    const fins = r.getObjectByName('FishLanternFins')
    const fish = new THREE.Group()
    if (body && fins) {
      body.geometry.computeBoundingBox()
      const head = body.geometry.boundingBox!.max.y
      fish.position.y = head
      const holder = body.parent ?? r
      holder.add(fish)
      for (const o of [body, fins]) { fish.add(o); o.position.y -= head }
    }
    return { model: r, fish, papers }
  }, [gltf])
  useEffect(() => () => { for (const m of papers) m.dispose() }, [papers])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flame = 0.92 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 6.1 + 0.7)
    for (const m of papers) m.color.setScalar(flame)
    if (hang.current) { hang.current.rotation.z = Math.sin(t * 0.8) * 0.025; hang.current.rotation.x = Math.sin(t * 0.55 + 1) * 0.015 }
    fish.rotation.z = Math.sin(t * 0.8 - 0.7) * 0.045
  })
  return (
    <group>
      {/* (hung from the end of a wooden arm out of the wall's end beside the doorway, square to the street: there's no eave out there) */}
      <mesh position={[-FISH_ARM / 2 + 0.03, 0.03, 0]}>
        <boxGeometry args={[FISH_ARM, 0.045, 0.05]} />
        <meshToonMaterial color="#3a2416" />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.012, 0.0028, 5, 10]} /><meshToonMaterial color="#2a2622" /></mesh>
      <mesh position-y={-FISH_LANTERN_CORD / 2}>
        <cylinderGeometry args={[0.003, 0.003, FISH_LANTERN_CORD, 4]} />
        <meshBasicMaterial color="#1a0d08" />
      </mesh>
      <group ref={hang} position-y={-FISH_LANTERN_CORD}>
        <primitive object={model} />
        <sprite position-y={-0.16} scale={[0.62, 0.55, 1]}>
          <spriteMaterial map={FISH_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
        </sprite>
        <sprite position-y={-0.68} scale={[0.5, 0.95, 1]}>
          <spriteMaterial map={FISH_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.35} color="#bcd0ff" />
        </sprite>
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
/** where the cashier's chair stands behind the till (its frame: x along the bar, +z behind it), and its seat's height (the model's) */
const TILL_CHAIR: [number, number, number] = [0.05, 0, 0.64]
const TILL_SEAT = 0.452
// (the till and all on and about it, some thirty pieces: likewise drawn again only for its own changes)
export const Register = memo(RegisterImpl, (a, b) => a.yaw === b.yaw && a.top === b.top && a.lang === b.lang && a.at.equals(b.at))
function RegisterImpl({ at, yaw, top, lang }: { at: THREE.Vector3; yaw: number; top: number; lang: Lang }) {
  return (
    <>
      {/* (two seats of their own behind it (blender/tillstools.py), clear of its back: the cashier's walnut chair squarely behind the
          register, where the cashier sits (the unseen mark on its seat, which Roasting sits them on, the chair's way round), and a helper's
          stool of the same make along from it) */}
      <Movable id="till-stool-hi" label="收銀高腳凳">
        <StaticBatch>
          <group position={at} rotation-y={yaw}><group position={TILL_CHAIR} scale={PEOPLE_SCALE}><TillStoolModel which="High" /></group></group>
        </StaticBatch>
        <group position={at} rotation-y={yaw}><group name="cashier-seat" position={[TILL_CHAIR[0], TILL_SEAT * PEOPLE_SCALE, TILL_CHAIR[2]]} /></group>
      </Movable>
      <Movable id="till-stool-lo" label="收銀矮凳"><StaticBatch>
        <group position={at} rotation-y={yaw}><group position={[-0.44, 0, 0.68]} rotation-y={-0.28} scale={PEOPLE_SCALE}><TillStoolModel which="Low" /></group></group>
      </StaticBatch></Movable>
      <Movable id="till-counter" label="收銀櫃檯"><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* (local x along the bar, +z toward the cashier, behind it) */}
      {/* the counter itself, from blender/tillcounter.py: its dark body with the lit bamboo and the lantern window, the marble top, the walnut partition */}
      <TillCounter top={top} />
      </group>
      </StaticBatch></Movable>
      <Movable id="till-register" label="收銀機（含抽屜）">
        <StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* the register, an electronic one of the kind every shop has: a cream cash drawer (a lock and a label on its front)
          under a body whose sloped panel carries the keys (the coloured function keys to the left, the grey number pad, the
          big cream keys and the teal total key to the right), the till roll's cover at the back with its paper coming
          out, a small operator's display on a stalk, and over it all the customers' display, its green figures facing both ways */}
      <group position={[0.05, top, 0.06]} rotation-y={Math.PI} scale={REG_SC}>
        {/* the register itself, from blender/register.py: the drawer's case, the body on it with its keys, the displays' housings, the deck */}
        <RegisterBody />
        {/* the cables: one tidy bundle out of the back through a grommet, held to the counter by a clip, with the card reader's lead and the tablet's branching from it */}
        <mesh position={[0.05, 0.12, 0.151]}><boxGeometry args={[0.03, 0.018, 0.012]} /><meshToonMaterial color="#2a2c30" /></mesh>
        {/* (the cables go with the register: moved in edit mode, they come along) */}
        {/* the cables: the register's power, the card reader's and the tablet's leads, into the grommet in the top */}
        <mesh geometry={REG_CABLES.power}><meshToonMaterial color="#17171a" /></mesh>
        {/* (the grommet: a dark metal ring let into the top, the hole black inside it) */}
        <mesh position={[GROMMET[0], 0.0009, GROMMET[2]]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.0062, 0.012, 28]} /><meshToonMaterial color="#3a3c40" /></mesh>
        <mesh position={[GROMMET[0], 0.0007, GROMMET[2]]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.0062, 24]} /><meshBasicMaterial color="#060607" /></mesh>
      </group>
      </group>
        </StaticBatch>
        <RegisterLive at={at} yaw={yaw} top={top} lang={lang} />
      </Movable>
      <Movable id="till-card" label="刷卡機"><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* the card reader on its cradle, its face to the customers (blender/tilldesk.py), on the desk mat */}
      <group position={[-0.38, top, -0.1]}><TillDeskPiece name="TillCardReader" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-printer" label="明細印表機" baseTurn={[0, 180, 0]}><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* the receipt printer, its slip curling out (blender/tilldesk.py), on the desk mat */}
      <group position={[-0.38, top, 0.12]}><TillDeskPiece name="TillPrinter" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-tray" label="找零盤" baseTurn={[0, 90, 0]}><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* the change tray (カルトン, blender/tilldesk.py): black resin, its floor ribbed, ありがとうございました in gold along its edge */}
      <group position={[0.0, top, -0.4]}><TillDeskPiece name="TillTray" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-pens" label="筆筒"><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* the pen cup, full (blender/tilldesk.py), on the desk mat */}
      <group position={[-0.52, top, 0.12]}><TillDeskPiece name="TillPens" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-omamori" label="御守">
      <group position={at} rotation-y={yaw}>
      {/* an omamori, 開運招福 (the owner's, after their picture; blender/omamori.py): on the desk mat, leaning back on the pen cup */}
      <group position={[-0.46, top + 0.002, 0.16]} rotation={[-0.2, -0.35, 0]}><Omamori /></group>
      </group>
      </Movable>
      <Movable id="till-bell" label="服務鈴" baseTurn={[0, 25, 0]}>
      <group position={at} rotation-y={yaw}>
      {/* the service bell (blender/tilldesk.py): rung with a click */}
      <group position={[-0.52, top, -0.1]}>
        <TillBellLive tip={lang === 'ja' ? tipOver('呼び鈴', 'クリックで鳴らす') : tipOver('服務鈴', '點一下按鈴')} onRing={() => !getEdit().on} />
      </group>
      </group>
      </Movable>
      <Movable id="till-mat" label="木質台座（含抽屜）">
      <group position={at} rotation-y={yaw}>
      {/* the walnut stand the reader, the printer, the pens and the tablet stand on (blender/tilldesk.py); its drawers open with a click (not batched) */}
      <group position={[-0.21, top, -0.005]}>
        <TillMatLive editing={() => getEdit().on}
          tip={(open) => lang === 'ja' ? tipOver('引き出し', open ? 'クリックで閉める' : 'クリックで開ける') : tipOver('抽屜', open ? '點一下關上' : '點一下拉開')} />
      </group>
      </group>
      </Movable>
      <Movable id="till-ingot" label="元寶"><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* a gold ingot (元寶) on its red stand, for wealth, between the bell and the cat (blender/tilldesk.py) */}
      <group position={[-0.3, top, -0.34]} rotation-y={0.3} scale={1.5}><TillDeskPiece name="TillIngot" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-tree" label="招財樹"><StaticBatch>
      <group position={at} rotation-y={yaw}>
      {/* a money tree (pachira) in its red pot, by the cat (blender/tilldesk.py) */}
      <group position={[0.12, top, -0.34]}><TillDeskPiece name="TillMoneyTree" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-cat" label="櫃檯招財貓" baseTurn={[0, -45, 0]}>
      <group position={at} rotation-y={yaw}>
      <group position={[0.45, top, -0.21]} rotation-y={Math.PI}>
        {/* the beckoning cat, bigger, at the till's corner by the door, facing the customers, sat up on a river stone (blender/tilldesk.py);
            not batched: it waves its paw (a batch would take every pose of the wave at once, a fan of paws) */}
        <TillDeskPiece name="TillCatStand" />
        <group position-y={CAT_STAND_H}><LuckyCat kind={1} height={0.46} /></group>
      </group>
      </group>
      </Movable>
      {TILL_BOXES.map(([k, zh]) => (
        <Movable key={k} id={`till-box-${k}`} label={`紙箱（${zh}）`}>
          <group position={at} rotation-y={yaw}><TillBoxes part={k} lang={lang} /></group>
        </Movable>
      ))}
      <Movable id="till-manual" label="收銀機操作說明書">
        <group position={at} rotation-y={yaw}><TillBoxes part="manual" lang={lang} /></group>
      </Movable>
      <Movable id="till-cashbox" label="錢箱"><StaticBatch>
        <group position={at} rotation-y={yaw}>
          <Part geo={REG_GEO.body} color="#2a3442" outline={1.02} position={[0.3, top - 0.155, 0.08]} scale={[0.2, 0.065, 0.16]} />
        </group>
      </StaticBatch></Movable>
      <Movable id="till-ipad" label="平板（iPad）">
      <group position={at} rotation-y={yaw}>
        {/* the order tablet, an iPad on a folding stand, at the cashier's right hand, its screen toward the cashier, leaning back a little */}
        <group position={[0.5, top, 0.1]}>
          {/* (the model from blender/ipad.py: the tablet, its screen the order screen, on its folding stand; not batched: its screen is touched) */}
          <IpadModel lang={lang} />
        </group>
      </group>
      </Movable>
    </>
  )
}

/** the little plates on the notes' slots */
/** a cable run as a tube through the given points (in the register's own units), black rubber */
const cable = (pts: [number, number, number][], r = 0.0042) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4), 36, r, 6, false)
/** where the register's lead goes down through the counter's top: a grommet under the register's back, out of sight (the register's own units) */
const GROMMET: [number, number, number] = [0.05, 0, 0.13]
const REG_CABLES = {
  // (out of its back, held close down the case's back, under the case's back edge and into the grommet below: from above, none of it shows)
  power: cable([[0.05, 0.12, 0.158], [0.05, 0.104, 0.175], [0.05, 0.06, 0.178], [0.05, 0.006, 0.178], [0.05, 0.0026, 0.16], [GROMMET[0], -0.012, GROMMET[2]]], 0.0045),
}
/** the register's size in the till, its body and its working parts (drawer, keys, displays) alike: as it's modelled, at one with the tablet,
 * printer and card reader beside it (it had been 1.4 times larger, out of scale with them) */
const REG_SC = 1
/** where each kind of note lies in the drawer's insert, along its width (in the till's own units, from the insert's middle) */
/**
 * The insert's layout (blender/register.py's RegInsert), in the till's own units from the insert's middle: the notes' compartments along the
 * back (the 2000 one holds coin rolls), the six coin cups along the front, and how many coins lie in each
 */
const NOTE_X: Record<Note, number> = { 10000: 0.1754, 5000: 0.0585, 1000: -0.1754 }
const NOTE_Z = 0.108, NOTE_Y = 0.0049
const COIN_CUPS: [CoinKind, number, number][] = [[500, 0.1949, 14], [100, 0.1169, 24], [50, 0.039, 15], [10, -0.039, 26], [5, -0.1169, 11], [1, -0.1949, 18]]
const COIN_Z = -0.0966, COIN_Y = 0.0035
/** a point in the insert, in the till's frame, with the drawer out as far as `open` */
const insertToTill = (ix: number, iy: number, iz: number, top: number, open: number) => new THREE.Vector3(0.05 - ix, top + 0.0245 + iy, 0.074 - iz + 0.336 * open)
/** where the coin tray's middle is, and how far down the till's top its dish is, in the till's frame */
const TRAY_AT = { x: 0.0, z: -0.4, y: 0.0215 }
const smooth = (e0: number, e1: number, x: number) => THREE.MathUtils.smoothstep(x, e0, e1)
/**
 * the register's moving parts, apart from the batched till: its drawer, which slides out (by hand, a click on it, or on its own as a
 * customer pays), its displays, which read what's being paid, and the money going about: the note the customer lays on the coin tray, which
 * the cashier takes into the drawer, and the change that comes back out onto the tray for the customer to take
 */
function RegisterLive({ at, yaw, top, lang }: { at: THREE.Vector3; yaw: number; top: number; lang: Lang }) {
  const drawer = useRef<THREE.Group>(null)
  const drawerHover = useRef(false)
  const keyHover = useRef(false)
  const setDrawerKeyHover = (on: boolean, ev: Event) => {
    if (keyHover.current === on) return
    keyHover.current = on
    const key = useRegisterModel.cached()?.drawerKey ?? null
    liftOn(key, on)
    showKeyTip(on ? 'DRAWER_KEY' : null, lang)
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand + (on ? 1 : -1))
    const el = ev.target as HTMLElement | null
    if (el?.style) el.style.cursor = on || POINTER_HINT.hand ? 'pointer' : ''
  }
  const setDrawerHover = (on: boolean, ev: Event) => {
    if (drawerHover.current === on) return
    drawerHover.current = on
    liftOn(useRegisterModel.cached()?.drawer ?? null, on)
    setTip(on ? { title: tl(lang, '收銀抽屜', 'レジのドロア', 'Till drawer'), hint: tl(lang, '點一下拉開／推回（上鎖時拉不開）', 'クリックで開閉（施錠中は開かない）', 'Click to open / close (won’t open locked)') } : null)
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand + (on ? 1 : -1))
    const el = ev.target as HTMLElement | null
    if (el?.style) el.style.cursor = on || POINTER_HINT.hand ? 'pointer' : ''
  }
  const cash = useRef<THREE.Group>(null)
  const tender = useRef<THREE.Group>(null)
  const change = useRef<THREE.Group>(null)
  const open = useRef(0)
  const vel = useRef(0)
  const innerShown = useRef<boolean | null>(null)
  /** (whether the drawer was last sent out: it rings as it's let go) */
  const sentOut = useRef(false)
  const [pay, setPay] = useState<{ tender: Note[]; change: (Note | CoinKind)[] }>({ tender: [], change: [] })
  // (what's in the drawer, drawn: follows TILL_CASH as customers pay in and the owner takes out)
  const [inDrawer, setInDrawer] = useState(TILL_CASH.drawer)
  const drawerSeen = useRef(TILL_CASH.drawer)
  /** the owner takes a compartment's money: only with the drawer out, and it goes to the shop's cash */
  const takeCash = (e: { stopPropagation: () => void }, k: Denom) => {
    e.stopPropagation()
    if (getEdit().on || open.current < 0.5) return
    const r = takeOut(TILL_CASH.drawer, k)
    if (!r.amount) return
    TILL_CASH.drawer = r.drawer
    TILL_CASH.onTake?.(r.amount)
    beep('ok')
  }
  const cashTip = (k: Denom) => tipOver(
    tl(lang, `${k.toLocaleString()} 円${k >= 1000 ? '鈔' : '硬幣'}`, `${k.toLocaleString()} 円${k >= 1000 ? '札' : '玉'}`, `¥${k.toLocaleString()} ${k >= 1000 ? 'notes' : 'coins'}`),
    tl(lang, `點一下取出 ¥${(k * inDrawer[k]).toLocaleString()}，加進現金`, `クリックで ¥${(k * inDrawer[k]).toLocaleString()} を取り出す`, `Click to take ¥${(k * inDrawer[k]).toLocaleString()} into cash`))
  const paySeen = useRef('')
  const led = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 40
    return new THREE.CanvasTexture(c)
  }, [])
  const shown = useRef('')
  const slip = useRef<THREE.Mesh>(null)
  const slipGeo = useMemo(() => new THREE.PlaneGeometry(0.054, 0.062).translate(0, 0.031, 0), [])
  useFrame((_, delta) => {
    // (the drawer: out while a customer's paying, or when it's been clicked open, easing out and in)
    // (a spring: opening, the latch lets go and it shoots out, runs a little past where it stops and settles back; shutting, it's pushed home and
    // meets its stop with a small bounce)
    // (pointed at while shut, it comes out a hair, as if a finger's on it)
    const want = Math.max(TILL_STATE.drawer, TILL_STATE.manual ? 1 : 0, drawerHover.current ? 0.025 : 0)
    if (want > 0.5 !== sentOut.current) {
      sentOut.current = want > 0.5
      if (sentOut.current) chime()
    }
    const dt2 = Math.min(delta, 0.03)
    const opening = want > open.current
    const stiff = opening ? 300 : 140, damp = opening ? 19 : 20
    vel.current += ((want - open.current) * stiff - vel.current * damp) * dt2
    open.current += vel.current * dt2
    // (it can't go in past shut: it stops there, with a little of its speed given back)
    if (open.current < 0) { open.current = 0; vel.current = Math.abs(vel.current) * 0.25 }
    // (locked, pulled at: it knocks out a hair against the lock and back, twice)
    const rt = (performance.now() - REGISTER.rattleAt) / 1000
    const knock = rt < 0.3 ? Math.abs(Math.sin(rt * Math.PI * 2 / 0.15)) * 0.0025 * (1 - rt / 0.3) : 0
    if (drawer.current) drawer.current.position.z = -open.current * 0.24 - knock
    if (cash.current) cash.current.visible = open.current > 0.15
    // (its inside drawn only once it's out a little: shut, it's all in the dark of the till)
    const inside = open.current > 0.02
    if (inside !== innerShown.current) {
      innerShown.current = inside
      for (const o of useRegisterModel.cached()?.inner ?? []) o.visible = inside
    }
    if (drawerSeen.current !== TILL_CASH.drawer) { drawerSeen.current = TILL_CASH.drawer; setInDrawer(TILL_CASH.drawer) }
    // (what's being paid, as notes and coins to draw: changes only with the customer)
    const key = `${TILL_STATE.tender}|${TILL_STATE.change}`
    if (paySeen.current !== key) {
      paySeen.current = key
      setPay({ tender: TILL_STATE.tender ? (changeOf(TILL_STATE.tender) as Note[]) : [], change: TILL_STATE.change ? changeOf(TILL_STATE.change) : [] })
    }
    const k = TILL_STATE.k
    // (the receipt: printed out of its window while the customer pays, torn off and gone as they take their change)
    const sl = slip.current
    if (sl && k >= 0) {
      sl.visible = k >= 0.3 && k < 0.95
      if (sl.visible) { sl.scale.y = Math.max(0.01, smooth(0.3, 0.52, k) * REGISTER.printLen); sl.position.y = 0.2185 + smooth(0.88, 0.95, k) * 0.05 }
    } else if (sl) {
      // (a receipt printed by hand at the keys: fed out over a moment, left hanging till it's torn off, a click, or a while has passed)
      const t = REGISTER.printAt < 0 ? -1 : (performance.now() - REGISTER.printAt) / 1000
      if (t > 20) REGISTER.printAt = -1
      sl.visible = t >= 0 && t <= 20
      if (sl.visible) { sl.scale.y = Math.max(0.01, smooth(0, 0.3 + 0.4 * REGISTER.printLen, t) * REGISTER.printLen); sl.position.y = 0.2185 }
    }
    // (the note laid on the tray, then taken into its place in the drawer)
    const tg = tender.current
    if (tg) {
      tg.visible = k >= 0.38 && k < 0.64
      if (tg.visible) {
        const t = smooth(0.54, 0.64, k)
        const kind = pay.tender[0] ?? 1000
        // (its slot in the drawer, in the till's frame: the drawer's own place, less how far out it's drawn)
        const slot = insertToTill(NOTE_X[kind], NOTE_Y + 0.016, NOTE_Z, top, open.current)
        const tray = new THREE.Vector3(TRAY_AT.x, top + TRAY_AT.y + (1 - smooth(0.38, 0.44, k)) * 0.1, TRAY_AT.z)
        tg.position.lerpVectors(tray, slot, t)
        tg.position.y += Math.sin(Math.PI * t) * 0.07
        tg.rotation.y = THREE.MathUtils.lerp(Math.PI + 0.12, Math.PI / 2, t)
      }
    }
    // (the change: taken out of the drawer's coin cups and notes while it's open, carried over to the tray, and taken away by the customer)
    const cg = change.current
    if (cg) {
      cg.visible = k >= 0.64 && k < 0.95
      if (cg.visible) {
        const t = smooth(0.64, 0.74, k)
        const from = insertToTill(COIN_CUPS[1][1], COIN_Y + 0.01, COIN_Z, top, open.current)
        const to = new THREE.Vector3(TRAY_AT.x, top + TRAY_AT.y, TRAY_AT.z)
        cg.position.lerpVectors(from, to, t)
        cg.position.y += Math.sin(Math.PI * t) * 0.06 + smooth(0.9, 0.95, k) * 0.12
      }
    }
    const text = registerText()
    const tag = registerTag()
    if (shown.current === `${tag}|${text}`) return
    shown.current = `${tag}|${text}`
    const g = (led.image as HTMLCanvasElement).getContext('2d')!
    g.fillStyle = '#07100a'
    g.fillRect(0, 0, 160, 40)
    g.font = 'bold 30px "Courier New", monospace'
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    g.fillStyle = '#5cff7a'
    g.shadowColor = '#5cff7a'
    g.shadowBlur = 7
    g.fillText(text, 152, 21)
    // (the word saying what the figures are, small, dimmer, at the left)
    g.font = 'bold 11px "Noto Sans TC", "Noto Sans JP", sans-serif'
    g.textAlign = 'left'
    g.shadowBlur = 3
    g.fillStyle = '#9dffb0'
    g.fillText(tag, 6, 9)
    led.needsUpdate = true
  })
  const coinList = pay.change.filter((v): v is CoinKind => !isNote(v))
  const noteList = pay.change.filter((v): v is Note => isNote(v))
  return (
    <group position={at} rotation-y={yaw}>
      {/* (the note the customer lays down: on the coin tray's dish) */}
      <group ref={tender} visible={false}>
        {pay.tender.map((v, i) => <NoteStack key={i} kind={v} n={1} position={[i * 0.006, i * 0.0016, i * 0.008]} rotation-y={0.07 * i} />)}
      </group>
      {/* (the change on the tray: the notes first, then the coins in rows) */}
      <group ref={change} visible={false}>
        {noteList.map((v, i) => <NoteStack key={`n${i}`} kind={v} n={1} position={[0.04, i * 0.0016, 0.0]} rotation-y={Math.PI + 0.1} />)}
        {coinList.map((v, j) => <CoinStack key={`c${j}`} kind={v} n={1} position={[-0.08 + (j % 4) * 0.032, 0, (Math.floor(j / 4) - 0.5) * 0.045]} />)}
      </group>
      <group position={[0.05, top, 0.06]} rotation-y={Math.PI} scale={REG_SC}>
        {/* the drawer: its front panel (a lock, the label, a pull slot) and its tray behind it, in one piece that comes out; clicked, it opens */}
        <group ref={drawer} onClick={(e) => {
          e.stopPropagation()
          if (getEdit().on || behindBody(e)) return
          // (its key: turned a quarter, locking it or unlocking it)
          if (DRAWER_KEY.test(e.object.name)) { turnKey(); return }
          if (!DRAWER_FRONT.test(e.object.name)) return
          // (opened by hand only if it isn't locked; pushed shut whether or not)
          if (!TILL_STATE.manual && REGISTER.state.drawerLocked) { rattle(); return }
          TILL_STATE.manual = !TILL_STATE.manual
        }} onPointerMove={(e) => {
          e.stopPropagation()
          // (only its front can be taken hold of, and only where it can be seen: not through the case from the side or behind)
          const seen = !getEdit().on && !behindBody(e)
          const onKey = seen && DRAWER_KEY.test(e.object.name)
          setDrawerKeyHover(onKey, e.nativeEvent)
          setDrawerHover(seen && !onKey && DRAWER_FRONT.test(e.object.name), e.nativeEvent)
        }} onPointerOut={(e) => { setDrawerHover(false, e.nativeEvent); setDrawerKeyHover(false, e.nativeEvent) }}>
          {/* (its front and its tray, from the model) */}
          <RegisterDrawer />
          {/* (the insert, laid out in the till's own units: the group is scaled back by the register's size) */}
          <group ref={cash} visible={false} position={[0, 0.0175, -0.01]} scale={1 / REG_SC}>
            {/* the money in the insert (the insert itself is the model's): the notes face up in their compartments under the weights, a stray one
                askew on top; the coins heaped loose in their cups */}
            {/* (as many as there are, a stack's worth at most; clicked, the owner takes them) */}
            {(Object.keys(NOTE_X).map(Number) as Note[]).map((kind, i) => {
              const n = Math.min(inDrawer[kind], 12)
              return (
                <group key={kind} position={[NOTE_X[kind], NOTE_Y, NOTE_Z]} onClick={(e) => takeCash(e, kind)} {...cashTip(kind)}>
                  {n > 1 && <NoteStack kind={kind} n={n - 1} rotation-y={Math.PI / 2 + (i - 1) * 0.012} />}
                  {n > 0 && <NoteStack kind={kind} n={1} position={[0.002 * (i - 1), 0.0012 * (n - 1) + 0.001, -0.004]} rotation-y={Math.PI / 2 + 0.05 - i * 0.03} />}
                  {/* (a touch area over the compartment, so even an empty one can be pointed at) */}
                  <mesh visible={false} position-y={0.01}><boxGeometry args={[0.1, 0.03, 0.16]} /></mesh>
                </group>
              )
            })}
            {COIN_CUPS.map(([kind, x]) => (
              <group key={kind} position={[x, COIN_Y, COIN_Z]} onClick={(e) => takeCash(e, kind)} {...cashTip(kind)}>
                {inDrawer[kind] > 0 && <CoinPile kind={kind} n={Math.min(inDrawer[kind], 40)} w={0.056} d={0.15} seed={kind} />}
                <mesh visible={false} position-y={0.008}><boxGeometry args={[0.06, 0.02, 0.15]} /></mesh>
              </group>
            ))}
          </group>
        </group>
        {/* the keys and the mode lock */}
        <RegisterKeys lang={lang} />
        {/* the receipt (clicked, it's torn off) */}
        <mesh ref={slip} geometry={slipGeo} visible={false} position={[-0.025, 0.2185, 0.076]} rotation={[0.2, Math.PI, 0]}
          {...tipOver(tl(lang, '發票', 'レシート', 'Receipt'), tl(lang, '點一下撕下', 'クリックで切り取る', 'Click to tear it off'))}
          onClick={(e) => { e.stopPropagation(); if (!getEdit().on && TILL_STATE.k < 0) REGISTER.printAt = -1 }}>
          <meshBasicMaterial map={RECEIPT_TEX} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        {/* the operator's display, in the housing's own pose: upright, facing straight out of the front */}
        <group position={[0.085, 0.252, 0.05]} rotation={[-0.04, 0, 0]}>
          <mesh position-z={-0.0086} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.13, 0.04]} /><meshBasicMaterial map={led} toneMapped={false} /></mesh>
        </group>
        {/* the customers' display on its stalk */}
        <group position={[0.085, 0.33, 0.12]} rotation-y={(24 * Math.PI) / 180}><group rotation-x={-0.18}>
          <mesh position-z={0.0113}><planeGeometry args={[0.15, 0.044]} /><meshBasicMaterial map={led} toneMapped={false} /></mesh>
        </group></group>
      </group>
    </group>
  )
}

/**
 * Along the wall from the way in (the entrance's frame, z toward the door): the cats' stand on the room's boards past the genkan's step,
 * clear of the door and under the altar's shelf; the shoe cupboard down on the genkan's stone, its end against the step, the helmet on it
 * (both moved along away from the door, the owner's wish, the doorway and the till's end left open)
 */
const CAT_STAND_Z = -1.92, SHOE_CAB_Z = -0.62
/**
 * The cats at the door, on their stand just inside it against the wall (the entrance's +x side; the till is on the
 * other), facing across the way in at those coming through
 */
const DOOR_CATS = [
  // (on the stand: x out from the wall, y the tier's top, z along it; the big white pair on the upper tier)
  // (each its own model and size, in its own colours: two big ones on top, two smaller below)
  // (each with room round it: none touching the next, nor the shoe cupboard and the helmet beside the stand)
  { x: -0.05, y: 0.6, z: -0.17, yaw: 0.2, kind: 1 as const, h: 0.5 },
  { x: -0.05, y: 0.6, z: 0.17, yaw: -0.2, kind: 3 as const, h: 0.44 },
  { x: -0.27, y: 0.32, z: -0.29, yaw: 0.25, kind: 2 as const, h: 0.38 },
  { x: -0.27, y: 0.32, z: 0.29, yaw: -0.25, kind: 1 as const, h: 0.42 },
]
/** the register's figure tabs: the amount (¥ 1 2 8 0 as it might be), and its maker's plate */
/** the customers' display: green figures on black, the amount to pay */
/** a key of the register's keyboard */
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
function DiningFloorImpl({ c, from, to, near = FLOOR_NEAR, far = FLOOR_FAR, wall = true, bare = false }: { c: Counter; from: number; to: number; near?: number
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
  // (each piece of the base is cut exactly to the room's own outline: the floor's pieces and the genkan's corner, no more; its sides take no
  // shadow: what stands by the floor's edge threw its shadow out onto the plinth's face, hanging there below the floor)
  const layers = (al: [number, number], ly: [number, number], key: string) => {
    const cx = -(ly[0] + ly[1]) / 2, cz = (al[0] + al[1]) / 2
    const W = ly[1] - ly[0], L = al[1] - al[0]
    // (its rim board, its dark body in boards laid the long way, its toe board: each in timber, the grain running along it)
    return [[top, 0.06], [top - 0.06, 0.22], [top - 0.28, 0.05]].map(([y0, h], i) => (
      <mesh key={`${key}${i}`} position={[cx, (y0 as number) - (h as number) / 2, cz]} geometry={timberBox(W, h as number, L)}
        material={BASE_TIMBER[i]} />
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
/** the base's timber, dark: its rim board a shade lighter, its body boards with their seams, its toe board darkest; long grain, a few streaks */
const BASE_TIMBER = (() => {
  const make = (base: string, seams: boolean) => {
    if (typeof document === 'undefined') return new THREE.MeshToonMaterial({ color: base })
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = base
    g.fillRect(0, 0, 256, 64)
    let seed = base.charCodeAt(2) * 31 + 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 46; i++) {
      const y = rnd() * 64
      g.strokeStyle = rnd() < 0.7 ? `rgba(15,8,3,${0.18 + rnd() * 0.2})` : `rgba(200,150,100,${0.08 + rnd() * 0.08})`
      g.lineWidth = 0.5 + rnd() * 1.1
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(85, y + (rnd() - 0.5) * 3, 170, y + (rnd() - 0.5) * 3, 256, y + (rnd() - 0.5) * 2)
      g.stroke()
    }
    if (seams) { g.fillStyle = 'rgba(10,5,2,0.6)'; for (const y of [0, 21, 42]) g.fillRect(0, y, 256, 1.6) }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return new THREE.MeshToonMaterial({ color: '#ffffff', map: t })
  }
  return [make('#5c3a22', false), make('#3d2414', true), make('#2a180c', false)]
})()
/** raw timber for the steps: warm unplaned wood, its long grain wavering, a knot or two, and the dark rough of the cut */
const STEP_LOG = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  // (planed oak, as the floor's: a warm mid-brown, long straight fine grain with a few darker streaks, no knots)
  g.fillStyle = '#9a7650'
  g.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 40; i++) {
    const y = (i * 1.6 + (i % 5) * 0.4) % 64
    g.strokeStyle = i % 3 ? 'rgba(60,36,18,0.16)' : 'rgba(190,140,90,0.16)'
    g.lineWidth = 0.7 + (i % 4) * 0.25
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(256, y + ((i % 7) - 3) * 0.25)
    g.stroke()
  }
  g.fillStyle = 'rgba(40,22,10,0.18)'
  for (const y of [9, 31, 52]) g.fillRect(0, y, 256, 2.2)
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
 * The kitchen raised a step above the customers' floor (a dais, as a robatayaki's cooks stand on: so the cook's table comes to their
 * waist): its boards laid on a solid timber platform, its edges faced in the bar's dark wood, a single step of raw timber at each gate
 * and right across its end, up from the customers' floor.
 */
function KitchenDais({ counters, rise }: { counters: Counter[]; rise: number }) {
  const k = useMemo(() => kitchenOf(counters), [counters])
  const gates = useMemo(() => kitchenGatesOf(counters), [counters])
  const [kx0, kx1] = k.along, [ky0, ky1] = k.lay
  const S = 0.17
  // (in the floor's frame: x is minus lay, z is along)
  return (
    <>
      <mesh position={[-(ky0 + ky1) / 2, rise / 2, (kx0 + kx1) / 2]} geometry={timberBox(ky1 - ky0, rise, kx1 - kx0)} material={BASE_TIMBER[1]} receiveShadow />
      <FloorPiece w={ky1 - ky0} l={kx1 - kx0} tint="#d2c4b2" position={[-(ky0 + ky1) / 2, rise + 0.004, (kx0 + kx1) / 2]} />
      {/* (the steps: half its height, outside its edge at the first counter's gate, at the side counter's, and along its open end) */}
      <mesh position={[-(ky0 - S / 2), rise / 4, (gates.first[0] + gates.first[1]) / 2]} geometry={timberBox(S, rise / 2, gates.first[1] - gates.first[0] + 0.2)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />
      {gates.side && <mesh position={[-(gates.side[0] + gates.side[1]) / 2, rise / 4, kx0 - S / 2]} geometry={timberBox(gates.side[1] - gates.side[0] + 0.2, rise / 2, S)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />}
      <mesh position={[-(ky0 + ky1) / 2, rise / 4, kx1 + S / 2]} geometry={timberBox(ky1 - ky0, rise / 2, S)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />
    </>
  )
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
  const STEP_OVER = 0.1
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

/** a soft dark shadow, a rounded oblong blurred out to nothing at its edges, for the shop to stand on */
const GROUND_SHADOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 512; c.height = 512
  const g = c.getContext('2d')!
  g.filter = 'blur(38px)'
  g.fillStyle = 'rgba(0,4,12,0.85)'
  g.beginPath(); g.roundRect(90, 90, 332, 332, 40); g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
function RoomFloorImpl({ counters, drop }: { counters: Counter[]; drop: number }) {
  const c = counters[0]
  const { along: [a0, a1], lay: [l0, l1] } = useMemo(() => roomOf(counters), [counters])
  const kitchen = useMemo(() => kitchenOf(counters), [counters])
  // (the genkan's corner, by the door, is left out of the boards: it's a step down, in stone)
  const g0 = c.length / 2 + GENKAN.along[0], gl = GENKAN.lay[1], D = GENKAN.depth
  // (how far down the base's top lies: below the sunk kitchen's floor, or the genkan's stone, whichever's lower)
  const baseDrop = Math.max(drop, D + 0.02)
  // (the kitchen's cut out of the boards: it lies lower, KitchenPit)
  const piece = (al: [number, number], ly: [number, number], k: string) => minus(al, ly, kitchen).map(([a, l], i) => (
    <FloorPiece key={`${k}${i}`} w={l[1] - l[0]} l={a[1] - a[0]} position={[-(l[0] + l[1]) / 2, 0.004, (a[0] + a[1]) / 2]} />
  ))
  return (
    <group name="room-floor" position={c.at} rotation-y={Math.atan2(c.along.x, c.along.z)}>
      {piece([a0, g0], [l0, l1], 'a')}
      {piece([g0, a1], [gl, l1], 'b')}
      <ShopBase rects={[[[a0, g0], [l0, l1]], [[g0, a1], [gl, l1]]]} genkan={[[g0, a1], [l0, gl]]} step={D} drop={baseDrop} />
      {/* (the whole shop's soft shadow on the ground it stands on, under its base and spreading out past it a little) */}
      <mesh position={[-(l0 + l1) / 2 - 0.12, -baseDrop - 0.34, (a0 + a1) / 2 + 0.1]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[(l1 - l0) + 2.4, (a1 - a0) + 2.4]} />
        <meshBasicMaterial map={GROUND_SHADOW} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* (and a solid fill under the boards right down to the base: round the kitchen's well when it's sunk, under the kitchen's dais as
          well when it's raised; nothing to see through between the floor and the base) */}
      {[[[a0, g0], [l0, l1]], [[g0, a1], [gl, l1]]].flatMap(([al, ly], n) => (drop > 0 ? minus(al as [number, number], ly as [number, number], kitchen)
        : [[al, ly] as [[number, number], [number, number]]]).map(([a, l], i) => (
        // (its sides, showing as the step down into the kitchen, in the base's dark timber boards)
        <mesh key={`fill${n}${i}`} position={[-(l[0] + l[1]) / 2, 0.001 - (baseDrop + 0.004) / 2, (a[0] + a[1]) / 2]}
          geometry={timberBox(l[1] - l[0], baseDrop + 0.004, a[1] - a[0])} material={BASE_TIMBER[1]} />
      )))}
      {drop > 0 ? <KitchenPit counters={counters} drop={drop} /> : <KitchenDais counters={counters} rise={-drop} />}
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
/**
 * The genkan's stone: flagstones of grey granite and darker slate, each its own shape (cut on a jittered grid), its own shade and speckle,
 * set in a pale mortar with a fine pebble wash (洗い出し) between them; worn smoother and darker where feet go
 */
const GENKAN_STONE = (() => {
  if (typeof document === 'undefined') return null
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  let seed = 19
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // (the mortar and its pebbles)
  g.fillStyle = '#8a8478'; g.fillRect(0, 0, S, S)
  for (let k = 0; k < 2600; k++) { const v = 90 + rnd() * 90; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.8, 0, Math.PI * 2); g.fill() }
  // (the stones: a 4 x 4 grid of corners, each moved about, a stone in each cell inset from its neighbours)
  const N = 4, cell = S / N
  const corner: [number, number][][] = []
  for (let j = 0; j <= N; j++) { corner.push([]); for (let i = 0; i <= N; i++) corner[j].push([i * cell + (i % N ? (rnd() - 0.5) * cell * 0.4 : 0), j * cell + (j % N ? (rnd() - 0.5) * cell * 0.4 : 0)]) }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = [corner[j][i], corner[j][i + 1], corner[j + 1][i + 1], corner[j + 1][i]]
    const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4
    const pts = q.map(([x, y]) => [cx + (x - cx) * 0.92, cy + (y - cy) * 0.92] as [number, number])
    const dark = rnd() < 0.35
    const v = dark ? 46 + rnd() * 16 : 92 + rnd() * 26
    const path = () => { g.beginPath(); pts.forEach(([x, y], k) => { const [nx, ny] = pts[(k + 1) % 4]; const mx = (x + nx) / 2 + (rnd() - 0.5) * 8, my = (y + ny) / 2 + (rnd() - 0.5) * 8; if (!k) g.moveTo(x, y); g.quadraticCurveTo(mx, my, nx, ny) }); g.closePath() }
    path()
    const gr = g.createLinearGradient(cx - cell / 2, cy - cell / 2, cx + cell / 2, cy + cell / 2)
    gr.addColorStop(0, `rgb(${v + 10},${v + 8},${v + 4})`); gr.addColorStop(1, `rgb(${v - 8},${v - 9},${v - 12})`)
    g.fillStyle = gr; g.fill()
    g.save(); path(); g.clip()
    for (let k = 0; k < 260; k++) { const w = rnd() < 0.5; g.fillStyle = w ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)'; g.fillRect(cx + (rnd() - 0.5) * cell, cy + (rnd() - 0.5) * cell, 1.5, 1.5) }
    g.restore()
    path(); g.strokeStyle = 'rgba(30,26,22,0.6)'; g.lineWidth = 2; g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  t.repeat.set(1.2, 1.2)
  return t
})()

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

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave' | 'wcGo' | 'wcIn' | 'wcWash' | 'wcBack'; t: number
  /** how far along their way they'd come last frame, and whether they've stood still since (a pause: shoes, paying, getting up) */
  lastD?: number; still?: boolean
  /** (off to the toilet, or to the fridge for a drink) where, and the way there from their stool; told to go home
   * meanwhile, they do once they're back */
  wc?: { who: 'm' | 'f' | 'drink'; path: THREE.Vector3[]; len: number; unit?: number; pick?: DrinkId }
  /** what they've fetched from the fridge, stood by their plate */
  drink?: DrinkId
  leaving?: boolean
  /** what they've ordered, for their bill at the till on the way out */
  items?: number
  /** how much of them shows (fading out as they go out of the door) */
  fade?: number
  /** in the house's slippers (inside, past the genkan's step), or their own shoes */
  slippers?: boolean }
/** how long they stand at the genkan's step changing their shoes */
const SHOES_S = 1.2
/** how long they stand at the till paying: the bill rung up, the drawer out and in, the change given */
const PAY_S = 5.6
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
/** and how long they wash their hands at the washstand after, the tap running (Restroom's HAND_MS) */
const HAND_S = HAND_MS / 1000
/** and to go and get themselves a drink from the fridge (once), and how long they stand choosing */
const DRINK_RATE = 1 / 70
/** (in development, `__drinkRate` in the console makes them thirstier, for watching it) */
const drinkRate = () => (import.meta.env.DEV ? (window as unknown as { __drinkRate?: number }).__drinkRate : undefined) ?? DRINK_RATE
/** (and `__wcRate` readier for the toilet) */
const wcRate = () => (import.meta.env.DEV ? (window as unknown as { __wcRate?: number }).__wcRate : undefined) ?? WC_RATE
const DRINK_STAY = 2.25

/** a plate laid on the pass for a seat, its food put on it there ('pass'), carried to the seat by a server ('carry'), set at it ('set'), left
 * at it dirty till a server comes for it ('dirty') and on their tray to the sink ('taken'); with no server to carry anything (a bar with
 * nobody on its floor), off the racks to the seat by itself ('serve'), cleared away to the sink by itself ('clear', after a pause), and
 * washed, back to the racks ('home') */
type PlateRun = { key: number; seat: number; guest: number; phase: 'pass' | 'serve' | 'carry' | 'set' | 'dirty' | 'taken' | 'clear' | 'home'; t: number; from: THREE.Vector3
  /** (clearing) its place on the dirty stack in the sink, taken when it sets off, so two cleared at once don't aim for the same one; (going
   * home) where on the racks it goes */
  to?: THREE.Vector3
  /** (on the pass) its slot there */
  slot?: number
  /** (done with) the sticks left on it, of what was eaten off it: into the bin by the sink with them */
  sticks?: number }
const STACK_GAP = 0.026
const UP_Y = new THREE.Vector3(0, 1, 0)
/** how many used sticks the bin by the sink shows at most (a bundle standing up out of it) */
const BIN_SHOWN = 14
const SERVE_S = 0.55
const CLEAR_S = 0.6
const CLEAR_DELAY = 1.0
/** a plate's flight takes at least this long a unit of its way (the bar's): from the racks, or to the sink, it's across the room */
const FLY_PER = 0.3
const HOME_S = 0.8
/** what's set out on the pass goes once it's been all there this long (a moment for anything more for the seat to come off the fire) */
const READY_S = 1.2
/** a plate's size on the pass (its shelf is a plate's width deep), and how many of its stack are drawn at most (a few over what the kitchen
 * keeps there: those put back from a slot whose customer left) */
const ON_PASS = 0.92
const PASS_STACK_SHOWN = PASS_CAP + 3
/** a plate's size in the sink, against its own */
const IN_SINK = 0.78
/** the sink's tap running, a plate washed every this many seconds, lifted out and back to the racks */
const WASH_EACH = 0.5
/** what stands on the kitchen's floor that a server crossing it to the racks goes round (with the cook's table) */
const KITCHEN_BLOCKS = new Set(['ricetub', 'misopot', 'freezer', 'platerack', 'platerack2', 'sink', 'sink-bin', 'produce', 'coalsack'])
/** how much room is left round each of them for a server to pass (the bar's units) */
const PASS_ROOM = 0.13
// (the same shape as the big plate by the fire, smaller: a foot, a shallow well, a lifted rim)
const PLATE_R = 0.13
const PLATE_GEO = wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.012], [0.47, 0.03], [0.5, 0.038], [0.49, 0.042], [0.44, 0.026],
  [0.3, 0.01], [0, 0.01]] as [number, number][]).map(([x, y]) => [x * PLATE_R * 2, y] as [number, number]), PLATE_R)
const SMEAR_GEO = new THREE.CircleGeometry(0.058, 18)
const USED_STICK_GEO = new THREE.CylinderGeometry(0.004, 0.003, 0.18, 5)
/** where on a done-with plate its used sticks lie, criss-cross (as many as were eaten off it, up to four drawn) */
const STICKS_ON = [[-0.02, 0.6], [0.015, -0.4], [-0.035, 1.3], [0.03, 0.15]] as const

/** a customer's plate, of the shop's one set of painted ware (dirty: a smear of sauce and the sticks left on it, of what was eaten off it,
 * thrown away with it at the sink (the owner's)); drawn again only when it gets dirty */
const Plate = memo(PlateImpl)
function PlateImpl({ dirty = false, design = 0, sticks = 1 }: { dirty?: boolean; design?: number; sticks?: number }) {
  return (
    <group>
      <mesh geometry={PLATE_GEO} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={wareDesign(design)} />
      </mesh>
      <mesh geometry={PLATE_GEO} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {dirty && (
        <>
          <mesh geometry={SMEAR_GEO} position={[0.03, 0.013, -0.02]} rotation-x={-Math.PI / 2} scale={[1.2, 0.8, 1]}>
            <meshBasicMaterial color="#8a5a32" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          {STICKS_ON.slice(0, Math.min(4, sticks)).map(([x, yaw], i) => (
            <mesh key={i} geometry={USED_STICK_GEO} position={[x, 0.018 + i * 0.006, 0.03 - i * 0.012]} rotation={[0, yaw, Math.PI / 2]}>
              <meshToonMaterial color="#c9a46a" />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

export function GuestBar3D({ guests, at, length = 3.6, drawCounter = true, lang, top = 0.465, people = true, mark = '食堂', counters: given, scale = 1, offset,
  speech = {}, servers = [], plater = null, stocker = null, incense, onDrink, onSay, open = true }:
  { guests: GuestView[]; at: THREE.Vector3; length?: number; drawCounter?: boolean; lang: Lang
    /** where the customers sit (the first counter's middle is at, and its door past its far end); one of four if not given */
    counters?: Counter[]
    /** what's dyed on the noren at the door (its first character in the middle) */
    mark?: string
    /** a guest's word (what they made of the toilet) */
    onSay?: (who: 'chef' | 'guest', text: string) => void
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
    /** the servers on the floor: they carry what's plated at the pass to the customers, clear the plates done with, and wash them */
    servers?: { id: string; look: StaffLook }[]
    /** who plates in the kitchen, fetching plates from the racks for the pass (the third cook, or the second): none, the owner does */
    plater?: { id: string; role: 'chef' | 'sous'; look: StaffLook } | null
    /** the stocker, once one's hired (none: no one by the crates, and the fridges aren't filled from the back) */
    stocker?: { id: string; look: StaffLook } | null
    /** drawn this much bigger, all of it */
    scale?: number
    /** and moved by this (after scaling) */
    offset?: THREE.Vector3 }) {
  const [shown, setShown] = useState<Shown[]>([])
  const guestsRef = useRef(guests)
  guestsRef.current = guests
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __guestStates?: typeof guestsRef }).__guestStates = guestsRef
  const groups = useRef(new Map<number, THREE.Group>())
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __guestGroups?: typeof groups }).__guestGroups = groups
  const clock = useRef(0)
  const counters = useMemo(() => given ?? singleCounter(at, length), [given, at, length])
  const seats = useMemo(() => seatsOf(counters), [counters])
  const wcs = useMemo(() => (given ? toiletsOf(counters) : null), [counters, given])
  const fridges = useMemo(() => (given ? fridgesOf(counters) : null), [counters, given])
  // (the stretches of the side wall kept clear for the fridges: one array, so the wall (memo'd) isn't drawn again with every redraw here)
  const fridgeClear = useMemo(() => (fridges ? fridges.map((f) => [f.z - FRIDGE.W / 2 - 0.1, f.z + FRIDGE.W / 2 + 0.1] as [number, number]) : undefined), [fridges])
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
  // the way out: the same way back, but by the till, where they stop to pay (door first, like the way in)
  const leavePaths = useMemo(() => seats.map((st) => {
    const base = pathTo(counters, st)
    if (!given) return { path: base, len: pathLength(base), payD: 0 }
    const { spot, lane, aisle } = payOf(counters)
    const path = [base[0], spot, lane, aisle, ...base.slice(1)]
    return { path, len: pathLength(path), payD: base[0].distanceTo(spot) }
  }), [counters, seats, given])
  const plateAt = (n: number) => seats[n].plate.clone().setY(top)
  /** how far along a way in (from the door) the genkan's step up into the room is (found once for each way: it was walked out in a hundred
   * steps for every walker twice a frame) */
  const stepMemo = useMemo(() => new WeakMap<THREE.Vector3[], number>(), [counters, given])
  const stepAt = (path: THREE.Vector3[]) => {
    if (!given) return 0
    const known = stepMemo.get(path)
    if (known !== undefined) return known
    let at = 0
    for (let d = 0; d < 2; d += 0.02) if (!inGenkan(counters, alongPath(path, d).p)) { at = d; break }
    stepMemo.set(path, at)
    return at
  }
  /** the pass (bar's passOf): its shelf's top, where what's set out on it stands, and a place along it from its middle */
  const pass = useMemo(() => passOf(counters), [counters])
  const passTop = top + LIP_H + PASS_SHELF.t
  const passPlace = (along: number) => pass.at.clone().addScaledVector(pass.dir, along).setY(passTop)
  // where a server stands to take what's set out there: in the aisle across the bar from it
  const passSpot = useMemo(() => pass.out.clone().setY(0), [pass])
  /** where the first counter's aisle meets another's */
  const aisleCorner = (c: Counter) => aisleCornerOf(counters, c)
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
  /** no server hired: the owner serves (nothing flies); his place along the aisle in front of the cook table (in the bar's frame), his way
   * out across the kitchen to the first counter's gate and through it, found once a day */
  const ownerServes = !!given && servers.length === 0 && homes.length > 0
  const ownerHome = useRef<(typeof homes)[number] | null>(null)
  const ownerAt = () => OWNER_SPOT.clone().add(FIRE_SHIFT).sub(offset ?? new THREE.Vector3()).divideScalar(scale).setY(0)
  // (his way out found only once he first goes, the kitchen's floor and what's on it in the scene by then)
  const homeOf = (wi: number) => {
    if (!ownerServes) return homes[wi]
    if (!ownerHome.current) {
      const at = ownerAt()
      const g = homes[0]
      const across = g.way.length > 1 ? kitchenRoute(at, g.way[1]) : [at.clone()]
      ownerHome.current = { at, yaw: OWNER_YAW, counter: 0, way: [at.clone(), ...across.slice(1), ...g.way.slice(2).map((v) => v.clone())] }
    }
    return ownerHome.current
  }
  /** the corner turned going from one counter's aisle into another's (none along the same one) */
  const turnBetween = (a: number, b: number) => (a === b ? [] : [aisleCorner(counters[a === 0 ? b : a])])
  /** from a server's place to the pass: out through their gate, along the aisle(s) */
  const fetchPath = (wi: number) => {
    const h = homeOf(wi)
    if (h.way.length < 2) return [h.at.clone(), passSpot.clone()]
    return [...h.way.map((v) => v.clone()), ...turnBetween(h.counter, pass.counter), passSpot.clone()]
  }
  /** beside a customer, where a server stands to set their plate down */
  const besideSeat = (n: number) => {
    const st = seats[n]
    return st.aisle.clone().lerp(st.stool, 0.45).addScaledVector(st.along, 0.24)
  }
  /** from the pass to a seat: out into the aisle, along it (round the corner, for the other counter) and in beside them */
  const routeTo = (n: number) => {
    const st = seats[n]
    const out = passSpot.clone().addScaledVector(pass.across, -(AISLE - 0.75))
    const path = [passSpot.clone(), out, ...turnBetween(pass.counter, st.counter), st.aisle.clone(), besideSeat(n)]
    return { path, len: pathLength(path) }
  }
  /** from a server's place to a seat the shortest way (out through their gate): walked backwards, it's their way back */
  const backPath = (wi: number, n: number) => {
    const h = homeOf(wi), st = seats[n]
    if (h.way.length < 2) return routeTo(n).path
    const turn = st.counter === h.counter ? [] : [aisleCorner(counters[st.counter === 0 ? h.counter : st.counter])]
    return [...h.way.map((v) => v.clone()), ...turn, st.aisle.clone(), besideSeat(n)]
  }
  /** what a server's doing: out to the pass for what's plated there, to its seat with it, back; out to clear plates done with, to the sink with
   * them; at the sink washing them into the dryer; taking the dried ones out of it back to the racks */
  type WaiterPhase = 'idle' | 'fetch' | 'pickup' | 'go' | 'set' | 'back' | 'clearGo' | 'clearTake' | 'clearBack' | 'drop'
    | 'washGo' | 'wash' | 'unloadGo' | 'unloadTake' | 'unloadCarry' | 'unloadPut'
  const waiters = useRef<{ phase: WaiterPhase
    t: number; seat: number; keys: string[]; run: number | null
    /** (serving) the pass's slot they've come for */
    slot?: number
    /** (clearing) the dirty plates they've come for, on their tray once taken; (from the dryer) how many dried plates are on their tray */
    carry?: number[]; stack?: number
    path: THREE.Vector3[]; len: number; pos: THREE.Vector3; yaw: number
    /** their way home once the shop's shut, and how far along it they are */
    out?: { way: THREE.Vector3[]; len: number; d: number } }[]>([])
  const waiterObjs = useRef<(THREE.Group | null)[]>([])
  /** the kitchen's plater on their way to the racks for plates, and back with them to the pass ('idle': at their place in the kitchen,
   * drawn there by Roasting) */
  const platerRun = useRef<{ phase: 'idle' | 'toRack' | 'take' | 'toPass' | 'put' | 'home'; t: number; path: THREE.Vector3[]; len: number
    pos: THREE.Vector3; yaw: number; n: number }>({ phase: 'idle', t: 0, path: [], len: 0, pos: new THREE.Vector3(), yaw: 0, n: 0 })
  const platerObj = useRef<THREE.Group | null>(null)
  const [platerMoving, setPlaterMoving] = useState(false)
  const platerStack = useRef<THREE.Group>(null)
  /** the plates stacked at the pass, and those standing in the dryer (drawn as many as there are) */
  const passStack = useRef<THREE.Group>(null)
  const dryerPlates = useRef<THREE.Group>(null)
  /** the used sticks in the bin by the sink (as many as are in it, up to a handful drawn) */
  const binSticks = useRef<THREE.Group>(null)
  /** how long each of the pass's slots has been ready to go */
  const readyFor = useRef<number[]>(Array.from({ length: PASS_SLOTS }, () => 0))
  const kitchen = useMemo(() => kitchenOf(counters), [counters])
  const [moving, setMoving] = useState<boolean[]>([])
  useEffect(() => {
    ownerHome.current = null
    // (no server: the owner, from his place)
    waiters.current = ownerServes
      ? [{ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0, pos: ownerAt(), yaw: OWNER_YAW }]
      : servers.slice(0, homes.length).map((_, i) => ({ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0,
        pos: homes[i].at.clone(), yaw: homes[i].yaw }))
    SERVICE.servers = ownerServes ? 1 : Math.min(homes.length, servers.length)
    return () => {
      SERVICE.servers = 0
      OWNER_OUT.on = false
      SEATS_TAKEN.clear()
      CHOPS_UP.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length, homes, ownerServes])
  /** a point in the bar's frame, in the shop's (where Roasting has the food) */
  const toShop = (v: THREE.Vector3) => v.clone().multiplyScalar(scale).add(offset ?? new THREE.Vector3())
  // where the plates are kept (the dish racks, game/plates) and washed (the sink): found in the room and taken into the bar's own frame each
  // time, as they can be moved by hand in edit mode (a bar on its own, with no room round it, has them at its two ends)
  const frame = useRef<THREE.Group>(null)
  const scene = useThree((st) => st.scene)
  const marks = useRef(new Map<string, THREE.Object3D | null>())
  const markOf = (name: string) => {
    let o = marks.current.get(name)
    if (o === undefined || (o && !o.parent)) { o = scene.getObjectByName(name) ?? null; marks.current.set(name, o) }
    return o
  }
  const inBar = (name: string, or: THREE.Vector3) => {
    const o = markOf(name), f = frame.current
    if (!o || !f) return or.clone()
    f.updateWorldMatrix(true, false)
    return f.worldToLocal(o.getWorldPosition(new THREE.Vector3()))
  }
  const endOf = (sd: number) => counters[0].at.clone().addScaledVector(ALONG, sd * (counters[0].length / 2 - 0.25)).addScaledVector(LAY, 0.11).setY(top)
  /** where a plate's lifted off rack `i`, and where a server stands for it */
  const rackTop = (i: number) => inBar(`rack-top-${i}`, endOf(-1))
  const rackFront = (i: number) => inBar(`rack-front-${i}`, endOf(-1)).setY(0)
  /** the rack a plate comes off now, and goes back onto: the count is shown across the two, the second's emptying first */
  const rackNow = (n = PLATE_RACK.n) => (n > PER_RACK ? 1 : 0)
  /** the k-th plate up the dirty stack in the sink's basin (they're stacked there a little smaller: the customers' plates are drawn big, the
   * basin's a real sink's size) */
  const dirtyAt = (k: number) => inBar('SinkBasinFloor', endOf(1)).add(new THREE.Vector3(0, 0.004 + k * STACK_GAP * IN_SINK, 0))
  /** a place in the bar's frame as the first counter's (along it, across it): the kitchen's floor and all that stands on it lie square there */
  const flat = (v: THREE.Vector3): [number, number] => { const c0 = counters[0], d = v.clone().sub(c0.at); return [d.dot(c0.along), d.dot(c0.lay)] }
  /** what stands on the kitchen's floor, as rectangles in that frame, each grown by room to pass: the cook's table, the rice tub, the freezer,
   * the racks and the sink, from where their shapes really reach (worked out once a day: nothing's moved while the shop's open) */
  const blocksMade = useRef<Rect[] | null>(null)
  const kitchenBlocks = (): Rect[] => {
    const f = frame.current
    if (blocksMade.current) return blocksMade.current
    if (!f) return []
    f.updateWorldMatrix(true, false)
    const toBar = new THREE.Matrix4().copy(f.matrixWorld).invert()
    const out: Rect[] = []
    const grown = (fl: [number, number][]) => out.push({ x0: Math.min(...fl.map((q) => q[0])) - PASS_ROOM, z0: Math.min(...fl.map((q) => q[1])) - PASS_ROOM,
      x1: Math.max(...fl.map((q) => q[0])) + PASS_ROOM, z1: Math.max(...fl.map((q) => q[1])) + PASS_ROOM })
    const v = new THREE.Vector3(), m4 = new THREE.Matrix4()
    scene.traverse((o) => {
      if (!KITCHEN_BLOCKS.has(o.userData?.editId)) return
      let a0 = Infinity, a1 = -Infinity, l0 = Infinity, l1 = -Infinity
      o.updateWorldMatrix(true, true)
      o.traverse((q) => {
        const pos = (q as THREE.Mesh).isMesh ? (q as THREE.Mesh).geometry.attributes.position : null
        if (!pos) return
        m4.multiplyMatrices(toBar, q.matrixWorld)
        for (let i = 0; i < pos.count; i += 3) {
          const [a, l] = flat(v.fromBufferAttribute(pos, i).applyMatrix4(m4))
          a0 = Math.min(a0, a); a1 = Math.max(a1, a); l0 = Math.min(l0, l); l1 = Math.max(l1, l)
        }
      })
      if (a0 < a1) grown([[a0, l0], [a1, l1]])
    })
    const t0 = markOf('cook-table-c0'), t1 = markOf('cook-table-c1')
    if (t0 && t1) grown([flat(f.worldToLocal(t0.getWorldPosition(new THREE.Vector3()))), flat(f.worldToLocal(t1.getWorldPosition(new THREE.Vector3())))])
    blocksMade.current = out
    return out
  }
  /** a server's way across the kitchen's floor, round the cook's table and all that stands on it (game/kitchenPath) */
  const kitchenRoute = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] => {
    const c0 = counters[0], k = kitchenOf(counters)
    const back = ([a, l]: [number, number]) => c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
    const way = kitchenPath(flat(from), flat(to), { x0: k.along[0], z0: k.lay[0], x1: k.along[1], z1: k.lay[1] }, kitchenBlocks())
    return way ? way.map(back) : [from.clone().setY(0), to.clone().setY(0)]
  }
  // (the crew's way home goes round the same things: Roasting asks for it as they leave)
  useEffect(() => {
    KITCHEN_ROUTE.route = (from, to) => kitchenRoute(from, to)
    return () => { KITCHEN_ROUTE.route = null }
  })

  // the plates: those out at the seats (or on their way), and the two stacks
  const [, setTick] = useState(0)
  const redraw = () => setTick((n) => n + 1)
  const runs = useRef<PlateRun[]>([])
  const runSeq = useRef(0)
  const runObjs = useRef(new Map<number, THREE.Group>())
  /** the dirty plates in the sink, and the washing (time since the last plate came out; null while the tap's off) */
  const dirty = useRef(0)
  const wash = useRef<number | null>(null)
  /** customers sat down waiting for a plate: the racks were bare (they're being washed) */
  const waiting = useRef<{ seat: number; guest: number }[]>([])
  /** (no servers) a plate sent over from the racks to the seat, if there's one on them */
  const serve = (seat: number, guest: number) => {
    const ri = rackNow()
    if (PLATE_RACK.n <= 0) {
      waiting.current.push({ seat, guest })
      return
    }
    PLATE_RACK.n -= 1
    runs.current.push({ key: ++runSeq.current, seat, guest, phase: 'serve', t: 0, from: rackTop(ri) })
    redraw()
  }
  /** this customer's plate is cleared away (after a moment); one still waiting for a plate needn't get one */
  const clear = (guest: number) => {
    waiting.current = waiting.current.filter((w) => w.guest !== guest)
    const r = runs.current.find((x) => x.guest === guest && (x.phase === 'set' || x.phase === 'serve'))
    if (r) leftDirty(r)
    // (done eating: a few tissues from their place's box (game/tissues); none left, they mind it (the shop's rating) and say so)
    const at = shownRef.current.find((x) => x.id === guest)?.seat ?? r?.seat
    if (at !== undefined && at >= 0) {
      const t = takeSheets(tissuesAt(at), sheetsFor(guest))
      setTissues(at, t.box)
      if (t.short) { gripe(guest, 'tissue'); onSay?.('guest', LINES[lang].noTissue(guest)) }
    }
  }
  /** a plate done with: left at the seat for a server to clear (the owner's: nobody's plates fly), or, with none, away to the sink by itself */
  const leftDirty = (r: PlateRun) => {
    r.sticks = SEAT_STICKS.get(r.seat) ?? 0
    SEAT_STICKS.delete(r.seat)
    if (waiters.current.length) { r.phase = 'dirty'; r.t = 0 } else { r.phase = 'clear'; r.t = -CLEAR_DELAY }
  }
  /** (every second) the plates out at seats looked over for any left where nobody sits */
  const sweep = useRef(0)
  const sinkFront = () => inBar('SinkFront', endOf(1)).setY(0)
  /** where the k-th plate stands in the dish dryer (along its rack, from its first slot to its last), and the way its plates face */
  const dryerAt = (k: number) => inBar('SinkDryerRack0', endOf(1)).lerp(inBar('SinkDryerRack1', endOf(1)), DRYER_CAP > 1 ? k / (DRYER_CAP - 1) : 0)
  /** each server's stack of dried plates, drawn on their tray while they carry it to the racks */
  const stackObjs = useRef<(THREE.Group | null)[]>([])
  const shownRef = useRef<Shown[]>([])
  // (the shop open: its furnishings can't be moved about by hand; shut, they can: edit mode, key G)
  useEffect(() => { setLocked(open) }, [open])
  /** each shown guest's name tag, faded with them as they go out of the door */
  const labels = useRef(new Map<number, HTMLElement>())
  const labelEl = useCallback((id: number, el: HTMLElement | null) => { if (el) labels.current.set(id, el); else labels.current.delete(id) }, [])
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shown?: typeof shownRef }).__shown = shownRef
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __waiters: waiters, __dirty: dirty, __barFrame: frame, __passAt: pass.at, __passOut: pass.out, __platerRun: platerRun, __runs: runs })

  shownRef.current = shown
  // closing the shop empties the room at once: nobody at the stools, no plates out or being carried, the stacks as at the start
  useEffect(() => {
    if (open) return
    setShown([])
    runs.current = []
    runObjs.current.clear()
    waiting.current = []
    // (the kitchen's floor looked at again tomorrow: things may be moved about in the meantime)
    blocksMade.current = null
    // (every plate washed and back on the racks for the next day)
    PLATE_RACK.n = RACK_FULL
    dirty.current = 0
    wash.current = null
    SINK.washing = false
    // (the pass bare, the dryer empty and shut, the bin by the sink emptied, the plater at their place)
    PASS.stock = 0
    PASS.coming = 0
    PASS.slots.fill(null)
    PLATES_OUT.clear()
    SEAT_STICKS.clear()
    Object.assign(DRYER, { n: 0, left: null, open: 0 })
    SINK_BIN.sticks = 0
    platerRun.current = { phase: 'idle', t: 0, path: [], len: 0, pos: new THREE.Vector3(), yaw: 0, n: 0 }
    PLATER_OUT.id = null
    ownerHome.current = null
    OWNER_OUT.on = false
    waiters.current = waiters.current.map((w, i) => ({ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0,
      pos: (ownerServes ? ownerAt() : homes[i]?.at)?.clone() ?? w.pos, yaw: ownerServes ? OWNER_YAW : homes[i]?.yaw ?? w.yaw }))
    SERVICE.waiting.clear()
    SERVICE.carried.clear()
    SEATS_TAKEN.clear()
    PLATES_SET.clear()
    for (const f of FRIDGE_STATE) f.passing = 0
    // (the toilets swept before the day, nobody in them; the paper as it was left)
    for (const w of [TOILETS.m, TOILETS.f]) { w.passing = 0; w.inside = 0; w.room = openRoom(w.room) }
    WC_GRUMBLE.clear()
    redraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    // (the plates are seen to here, not in the state update below, which must stay free of side effects)
    for (const g of guests) {
      const s = shownRef.current.find((x) => x.id === g.id)
      if (s && g.state !== 'waiting' && g.state !== 'eating' && s.phase !== 'leave') clear(g.id)
    }
    // (the same list back when nobody comes or goes: then the bar isn't drawn again for it)
    setShown((cur) => {
      let next = cur
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          const taken = new Set(next.map((x) => x.seat))
          // (the shop may have given them a stool already: it only does once the last one there has gone)
          const seat = g.seat !== undefined ? g.seat : Array.from({ length: seats.length }, (_, i) => i).find((i) => !taken.has(i))
          if (seat !== undefined) next = [...next, { id: g.id, seat, phase: 'enter', t: 0 }]
        } else if (s && !seated && s.phase !== 'leave' && !s.leaving) {
          // (away at the toilet: they go once they're back at their stool)
          next = next.map((x) => (x.id === g.id ? (x.phase.startsWith('wc') ? { ...x, leaving: true } : { ...x, phase: 'leave', t: 0 }) : x))
        }
      }
      return next
    })
  }, [guests])

  useFrame(({ camera: cam }, dt) => {
    clock.current += Math.min(dt, 0.1)
    // (the room's murmur: by how many are sat at the bar; louder with the camera among them)
    if (people) {
      const sat = shown.filter((x) => x.phase === 'sit').length
      const mid = groups.current.values().next().value as THREE.Object3D | undefined
      const d = mid ? cam.position.distanceTo(mid.getWorldPosition(new THREE.Vector3())) : 8
      crowdAmbience(murmur(sat), THREE.MathUtils.clamp(1.4 - d / 12, 0.2, 1), Math.min(dt, 0.1))
    }
    let done: number[] = []
    let paying: { s: Shown; k: number } | null = null
    let queue = 0
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
        s.still = s.lastD !== undefined && Math.abs(d - s.lastD) < 1e-6 && d < len
        s.lastD = d
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
        if (guest) s.items = guest.items
        if (fridges && guest?.state === 'waiting' && !s.drink && Math.random() < drinkRate() * flowerBuffs(SHRINE_FLOWERS).drinks * Math.min(dt, 0.1)) {
          // (they choose what they want, and go to the fridge it's in)
          const pick = drinkFor(kindOf(s.id).kind, s.id)
          const fr = fridges[fridgeUnitOf(pick)]
          const turn = st.counter === 1 ? [] : [aisleCorner(counters[1])]
          const path = [st.stool.clone(), st.aisle.clone(), ...turn, fr.aisle.clone(), fr.front.clone()]
          s.wc = { who: 'drink', path, len: pathLength(path), unit: fr.n, pick }
          s.phase = 'wcGo'
          s.t = 0
        } else if (wcs && (SICK.has(s.id) || guest?.state === 'waiting' && Math.random() < wcRate() * Math.min(dt, 0.1))
          // (one at a time: a toilet someone's on their way to, in, or coming out of is left till they're done)
          && !shown.some((x) => x !== s && x.wc?.who === (HER.has(kindOf(s.id).kind) ? 'f' : 'm') && x.phase.startsWith('wc'))
          // (nor one the stock keeper's gone to change the roll in)
          && STOCKER_WC.who !== (HER.has(kindOf(s.id).kind) ? 'f' : 'm')) {
          const who = HER.has(kindOf(s.id).kind) ? 'f' : 'm'
          const w = wcs[who]
          const turn = st.counter === 1 ? [] : [aisleCorner(counters[1])]
          // (in at the door, past the washstand, round the corner to the toilet)
          const path = [st.stool.clone(), st.aisle.clone(), ...turn, w.aisle.clone(), w.front.clone(), w.inside.clone(), w.turn.clone(), w.stall.clone()]
          s.wc = { who, path, len: pathLength(path) }
          s.phase = 'wcGo'
          s.t = 0
        }
      } else if (s.phase === 'wcGo' || s.phase === 'wcBack') {
        // to the door, which slides open as they come up to it, in, and later back out to their stool
        const w = s.wc!
        // (out of a toilet they wait a moment first, for its door to slide open in front of them)
        const wait = s.phase === 'wcBack' && w.who !== 'drink' ? 0.6 : 0
        const d = Math.min(w.len, Math.max(0, s.t - wait) * SPEED * walkSpeedOf(kindOf(s.id).kind))
        const { p, dir } = alongPath(w.path, s.phase === 'wcGo' ? d : w.len - d)
        g?.position.copy(p)
        if (g) g.rotation.y = s.phase === 'wcGo' ? Math.atan2(dir.x, dir.z) : Math.atan2(-dir.x, -dir.z)
        if (d >= w.len) {
          if (s.phase === 'wcGo') SICK.delete(s.id)
          s.phase = s.phase === 'wcGo' ? 'wcIn' : s.leaving ? 'leave' : 'sit'
          s.t = 0
        }
      } else if (s.phase === 'wcIn') {
        // (at the fridge: facing it, choosing; then their drink in hand, back to their stool)
        if (s.wc?.who === 'drink' && g && fridges) g.rotation.y = fridges[s.wc.unit ?? 0].yaw + Math.PI
        if (s.t > (s.wc?.who === 'drink' ? DRINK_STAY : WC_STAY)) {
          // (out of the toilet: it flushes behind them, and they say what they thought of it, if it's worth saying)
          if (s.wc && s.wc.who !== 'drink') {
            const t = TOILETS[s.wc.who]
            const was = looksOf(t.room)
            const u = visitRoom(t.room)
            t.room = u.room
            t.flushAt = performance.now()
            if (u.complaint) WC_GRUMBLE.set(s.id, Math.max(WC_GRUMBLE.get(s.id) ?? 0, penaltyOf(u.complaint)))
            const L = LINES[lang]
            if (u.complaint === 'paper') onSay?.('guest', L.wcPaper(s.id))
            else if (u.complaint === 'dirty') onSay?.('guest', L.wcDirty(s.id))
            else if (was === 'fresh' && Math.random() < 0.3) onSay?.('guest', L.wcNice(s.id))
          }
          if (s.wc?.who === 'drink' && !s.drink) {
            s.drink = s.wc.pick ?? drinkFor(kindOf(s.id).kind, s.id)
            takeDrink(s.drink)
            onDrink?.(s.id, s.drink)
            redraw()
          }
          if (s.wc && s.wc.who !== 'drink' && wcs) {
            // (out round the corner to the washstand, to wash their hands, the tap running; then out the way they came in, from there)
            const who = s.wc.who
            const w = wcs[who]
            const turn = st.counter === 1 ? [] : [aisleCorner(counters[1])]
            const back = [st.stool.clone(), st.aisle.clone(), ...turn, w.aisle.clone(), w.front.clone(), w.inside.clone(), w.basin.clone()]
            s.wc = { ...s.wc, path: back, len: pathLength(back) }
            TOILETS[who].handAt = performance.now()
            s.phase = 'wcWash'
          } else s.phase = 'wcBack'
          s.t = 0
        }
      } else if (s.phase === 'wcWash') {
        // (at the washstand, facing it, washing their hands)
        const w = wcs![s.wc!.who as 'm' | 'f']
        g?.position.copy(w.basin)
        if (g) g.rotation.y = w.basinYaw
        s.still = true
        if (s.t > HAND_S) { s.phase = 'wcBack'; s.t = 0; s.still = false }
      } else {
        // a moment to get up, then off the way they came, by the till: they stop there to pay, and again at the genkan's step
        const lp = leavePaths[s.seat]
        const v = SPEED * walkSpeedOf(kindOf(s.id).kind)
        const raw = Math.max(0, (s.t - 0.8) * v)
        const payAt = lp.len - lp.payD
        const d = Math.max(0, Math.min(lp.len, withPause(withPause(raw, payAt, lp.payD ? PAY_S * v : 0), lp.len - stepAt(lp.path), SHOES_S * v)))
        const { p, dir } = alongPath(lp.path, lp.len - d)
        s.still = s.lastD !== undefined && Math.abs(d - s.lastD) < 1e-6 && d < lp.len
        s.lastD = d
        s.slippers = lp.len - d > stepAt(lp.path)
        g?.position.copy(p)
        if (g) g.rotation.y = s.t < 0.8 ? st.yaw : Math.atan2(-dir.x, -dir.z)
        // (at the till, facing it: the register's reading follows what they owe)
        // (waiting to pay: on the way out and not yet past the till)
        if (lp.payD && raw < payAt + PAY_S * v) queue++
        if (lp.payD && raw >= payAt && raw < payAt + PAY_S * v) {
          if (g) g.rotation.y = Math.atan2(counters[0].lay.x, counters[0].lay.z)
          paying = { s, k: (raw - payAt) / (PAY_S * v) }
        }
        // (and if they've somehow not got out in all the time it can take, they're gone all the same)
        if (d >= lp.len || raw > lp.len + (PAY_S + SHOES_S + 8) * v) done.push(s.id)
        // (out of the door they fade away, the last stretch)
        s.fade = Math.min(1, (lp.len - d) / 0.9)
      }
      // (the name tag goes with the body: gone a little before they are, so none is left hanging in the doorway)
      const tag = labels.current.get(s.id)
      if (tag) tag.style.opacity = s.phase === 'leave' ? String(Math.max(0, Math.min(1, (s.fade ?? 1) * 1.6 - 0.5))) : ''
      if (g) g.visible = !(s.phase === 'wcIn' && s.wc?.who !== 'drink')
      // (down a step, standing in the genkan)
      if (g && given) g.position.y = inGenkan(counters, g.position) ? -GENKAN.depth : 0
    }
    // (the register and the money follow what's being paid: each dish rung up in turn, the total, the note laid on the tray, the drawer out and
    // the note put in it, the change worked out and set on the tray, the drawer shut, the change taken)
    if (paying) {
      const { s: x, k } = paying
      const n = Math.max(1, x.items ?? 2)
      const parts = [...Array.from({ length: n }, () => billOf(1)), ...(x.drink ? [billOf(1, x.drink) - billOf(1)] : [])]
      const bill = parts.reduce((a, b) => a + b, 0)
      const given = Math.min(10000, Math.ceil(bill / 1000) * 1000)
      const rung = Math.min(parts.length, Math.floor(k / 0.32 * parts.length) + 1)
      TILL_STATE.text = yen(k < 0.32 ? parts.slice(0, rung).reduce((a, b) => a + b, 0) : k < 0.62 ? bill : Math.max(0, given - bill))
      // (a card: rung up and paid on the reader, the drawer staying shut and no money changing hands; cash: the cashier presses the cash key
      // at 0.44, the drawer shoots out, the note goes in, the change comes out, and at 0.78 it's pushed shut)
      const card = paysByCard(x.id)
      TILL_STATE.card = card
      TILL_STATE.drawer = drawerOpens(card) && k >= 0.44 && k < 0.78 ? 1 : 0
      TILL_STATE.k = k
      TILL_STATE.tender = card ? 0 : given
      TILL_STATE.change = card ? 0 : Math.max(0, given - bill)
      TILL_STATE.bill = bill
      TILL_STATE.payer = x.id
      TILL_STATE.parts = parts
      TILL_STATE.items = n
    } else {
      TILL_STATE.drawer = 0
      TILL_STATE.k = -1
      TILL_STATE.tender = 0
      TILL_STATE.change = 0
      TILL_STATE.card = false
    }
    TILL_STATE.queue = queue
    TILL_STATE.tablet = tabletActive(queue, TILL_STATE.k >= 0 && TILL_STATE.card)
    SEATS_TAKEN.clear()
    for (const x of shown) SEATS_TAKEN.add(x.seat)
    // (and whose chopsticks are up off their rest, in their hand: those sat eating)
    CHOPS_UP.clear()
    for (const x of shown) if (x.phase === 'sit' && guestsRef.current.find((g) => g.id === x.id)?.state === 'eating') CHOPS_UP.add(x.seat)
    // nobody walks through anybody: those walking (in, out, to the toilet or the fridge) keep a body's width apart,
    // stepping aside for each other and for the servers (who keep to their way, their trays held level)
    {
      const walkers: { p: THREE.Vector3; give: boolean }[] = []
      for (const x of shown) {
        if (x.phase === 'wcIn' && x.wc?.who !== 'drink') continue
        const gp = groups.current.get(x.id)?.position
        // (those sitting don't move aside, but nobody walks through them either: the ones going by step round them)
        if (gp) walkers.push({ p: gp, give: x.phase !== 'sit' })
      }
      for (const w of waiters.current) walkers.push({ p: waiterObjs.current[waiters.current.indexOf(w)]?.position ?? w.pos, give: false })
      // (a body's width, the round bodies' shoulders and all, so no two ever overlap)
      const R = 0.38
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
      // (and shut behind them while they're in: locked, its window showing 使用中)
      TOILETS[who].passing = shown.filter((x) => x.wc?.who === who && (x.phase === 'wcGo' || x.phase === 'wcBack')
        && (groups.current.get(x.id)?.position.distanceTo(wcs[who].front) ?? 9) < 1.3).length + (STOCKER_WC.who === who && STOCKER_WC.near ? 1 : 0)
      TOILETS[who].inside = shown.filter((x) => x.wc?.who === who && (x.phase === 'wcIn' || x.phase === 'wcWash')).length + (STOCKER_WC.who === who && STOCKER_WC.inside ? 1 : 0)
    }
    // (the ids held as they are now: the update may run later, once `done` below is a new empty list, and then it took nobody out; those out of
    // the door stayed listed, holding their stool's number, asking every frame to be taken out and drawing the bar again each time)
    if (done.length) {
      const gone = done
      setShown((cur) => { const next = cur.filter((x) => !gone.includes(x.id)); return next.length === cur.length ? cur : next })
    }
    done = []

    // anyone who sat down while the racks were bare gets a plate as soon as one's back on them
    if (waiting.current.length && PLATE_RACK.n > 0) {
      const w = waiting.current.shift()!
      serve(w.seat, w.guest)
    }

    // the plates on the move: lifted off the stack in an arc to the seat, and cleared away to the dirty stack
    const step = Math.min(dt, 0.1)
    sweep.current += step
    if (sweep.current > 1) {
      sweep.current = 0
      for (const r of runs.current) {
        if (r.phase !== 'set') continue
        if (!shownRef.current.some((x) => x.seat === r.seat && x.phase !== 'leave')) leftDirty(r)
      }
      // (a plate on a tray no server's holding any more (their round cut short: the staff changed, the shop shut) isn't left hanging in the
      // air where it was (the owner saw plates floating): one being carried to a customer goes back on the pass's stack (or the racks, with
      // that full); one cleared off the bar goes on into the sink as a dirty plate)
      const holding = new Set<number>()
      for (const x of waiters.current) {
        if (x.run !== null && x.run !== undefined) holding.add(x.run)
        for (const k of x.carry ?? []) holding.add(k)
      }
      for (const r of [...runs.current]) {
        if (r.phase === 'carry' && !holding.has(r.key)) {
          runs.current = runs.current.filter((x) => x !== r)
          if (PASS.stock < PASS_CAP) PASS.stock += 1
          else PLATE_RACK.n = putBack(PLATE_RACK.n, 1)
          redraw()
        } else if (r.phase === 'taken' && !holding.has(r.key)) {
          SINK_BIN.sticks += r.sticks ?? 0
          r.phase = 'clear'
          r.to = undefined
          r.t = 0
        }
      }
    }
    let finished = 0, homed = 0
    for (const r of runs.current) {
      r.t += step
      const o = runObjs.current.get(r.key)
      if (r.phase === 'set' || r.phase === 'dirty' || r.phase === 'taken' || (r.phase === 'clear' || r.phase === 'home') && r.t < 0 || r.phase === 'carry' || r.phase === 'pass') {
        if (r.phase === 'set' || r.phase === 'dirty') o?.position.copy(plateAt(r.seat))
        if (r.phase === 'pass' && o) { o.position.copy(passPlace(passSlotAlong(r.slot ?? 0))); o.scale.setScalar(ON_PASS) }
        continue
      }
      if (r.phase === 'clear' && !r.to) {
        // setting off: from where it is, to the next free place on the dirty stack
        if (o) r.from = o.position.clone()
        const flying = runs.current.filter((x) => x !== r && x.phase === 'clear' && x.to && x.t !== Infinity).length
        r.to = dirtyAt(dirty.current + flying)
      }
      const to = r.phase === 'clear' || r.phase === 'home' ? r.to! : plateAt(r.seat)
      // (the longer its way, the longer its flight and the higher its arc)
      const far = r.from.distanceTo(to)
      const k = Math.min(1, r.t / Math.max(r.phase === 'serve' ? SERVE_S : r.phase === 'home' ? HOME_S : CLEAR_S, far * FLY_PER))
      const e = k * k * (3 - 2 * k)
      if (o) {
        o.position.lerpVectors(r.from, to, e)
        o.position.y += Math.sin(Math.PI * k) * (0.22 + far * 0.12)
        o.rotation.z = Math.sin(Math.PI * k) * 0.12
        // (down to its size in the sink as it goes into it, and back up as it comes out)
        if (r.phase === 'clear') o.scale.setScalar(1 - (1 - IN_SINK) * e)
        else if (r.phase === 'home') o.scale.setScalar(IN_SINK + (1 - IN_SINK) * e)
      }
      if (k >= 1) {
        if (r.phase === 'serve') r.phase = 'set'
        else if (r.phase === 'home') {
          // (washed, back on the racks)
          r.t = Infinity
          PLATE_RACK.n = putBack(PLATE_RACK.n, 1)
          homed++
        } else {
          r.t = Infinity
          finished++
        }
      }
    }
    // the pass: a plate laid in one of its slots (Roasting lays it, for a seat's first food) is drawn there from then on; one whose slot's gone
    // without being taken up (its customer left before it went, the food binned, the plate put back on the stack) goes with it
    for (let k = 0; k < PASS_SLOTS; k++) {
      const sl = PASS.slots[k]
      const r = runs.current.find((x) => x.phase === 'pass' && x.slot === k)
      if (sl?.plate && !r) {
        const g = shownRef.current.find((x) => x.seat === sl.seat && x.phase !== 'leave')
        runs.current.push({ key: ++runSeq.current, seat: sl.seat, guest: g?.id ?? -1, phase: 'pass', slot: k, t: 0, from: passPlace(passSlotAlong(k)) })
        redraw()
      } else if (r && (!sl || !sl.plate || sl.seat !== r.seat)) {
        runs.current = runs.current.filter((x) => x !== r)
        redraw()
      }
      // (how long it's been ready to go: what's for it all down on it, nothing more on its way)
      readyFor.current[k] = sl && sl.landed > 0 && sl.flying === 0 ? readyFor.current[k] + step : 0
    }
    const sitting = (n: number) => shownRef.current.some((x) => x.seat === n && (x.phase === 'sit' || x.phase.startsWith('wc')))
    /** a slot of the pass ready to go, for a customer sat at their place, that no server's on their way for */
    const readySlot = () => {
      for (let k = 0; k < PASS_SLOTS; k++) {
        const sl = PASS.slots[k]
        if (sl && readyFor.current[k] >= READY_S && sitting(sl.seat) && !waiters.current.some((x) => x.slot === k)) return k
      }
      return -1
    }

    // the kitchen's plater (the third cook, or the second; with neither, the owner): when the pass's stack of clean plates runs low, across the
    // kitchen to the racks for a few and back with them to the pass, set down there for plating on, and back to their place
    {
      const pl = platerRun.current
      const home = () => (plater ? inBar(`crew-${plater.id}`, ownerAt()) : ownerAt()).setY(0)
      const walk = (then: () => void) => {
        const d = Math.min(pl.len, pl.t * SERVER_SPEED)
        const { p, dir } = alongPath(pl.path, d)
        pl.pos.copy(p)
        if (dir.x || dir.z) pl.yaw = Math.atan2(dir.x, dir.z)
        if (d >= pl.len) { pl.t = 0; then() }
      }
      const away = (on: boolean) => { if (plater) PLATER_OUT.id = on ? plater.id : null; else OWNER_OUT.on = on }
      pl.t += step
      if (!given || ownerServes) {
        // (nobody to plate: a bar on its own, or the owner out serving it all himself; the pass's stack kept up as it's used)
        if (open && PASS.stock < PASS_CAP && PLATE_RACK.n > 0) { PASS.stock += 1; PLATE_RACK.n -= 1 }
      } else if (pl.phase === 'idle') {
        if (pl.t > 0.5) {
          pl.t = 0
          if (open && !SHOP.leaving && platerGoes(PASS.stock, PASS.coming, PLATE_RACK.n)) {
            pl.pos.copy(home())
            pl.path = kitchenRoute(pl.pos, rackFront(rackNow()))
            pl.len = pathLength(pl.path)
            pl.phase = 'toRack'
            away(true)
          }
        }
      } else if (pl.phase === 'toRack') walk(() => {
        pl.phase = 'take'
        const at = rackTop(rackNow())
        pl.yaw = Math.atan2(at.x - pl.pos.x, at.z - pl.pos.z)
      })
      else if (pl.phase === 'take' && pl.t > 0.5) {
        // (off the racks into their hands, as many as the pass's stack wants)
        pl.n = platesToBring(PASS.stock, PLATE_RACK.n)
        PLATE_RACK.n -= pl.n
        PASS.coming = pl.n
        pl.path = kitchenRoute(pl.pos, pass.in.clone().setY(0))
        pl.len = pathLength(pl.path)
        pl.phase = 'toPass'
        pl.t = 0
      } else if (pl.phase === 'toPass') walk(() => {
        pl.phase = 'put'
        pl.yaw = Math.atan2(pass.at.x - pl.pos.x, pass.at.z - pl.pos.z)
      })
      else if (pl.phase === 'put' && pl.t > 0.5) {
        // (all of them set down, even with a plate or two put back on the stack meanwhile: none is ever lost)
        PASS.stock += pl.n
        PASS.coming = 0
        pl.n = 0
        pl.path = kitchenRoute(pl.pos, home())
        pl.len = pathLength(pl.path)
        pl.phase = 'home'
        pl.t = 0
      } else if (pl.phase === 'home') walk(() => {
        pl.phase = 'idle'
        away(false)
      })
      const mv = pl.phase === 'toRack' || pl.phase === 'toPass' || pl.phase === 'home'
      if (mv !== platerMoving) setPlaterMoving(mv)
      const o = platerObj.current
      if (o) {
        o.visible = pl.phase !== 'idle'
        o.position.copy(pl.pos)
        o.rotation.y = pl.yaw
        // (up on the kitchen's dais)
        if (KITCHEN_DROP < 0) o.position.y += -KITCHEN_DROP / scale
      }
      // (the plates in their hands, out in front of them)
      const ps = platerStack.current
      if (ps && o) {
        ps.visible = pl.n > 0 && pl.phase !== 'idle'
        if (ps.visible) {
          const k = pl.phase === 'take' ? Math.min(1, pl.t / 0.4) : pl.phase === 'put' ? 1 - Math.min(1, pl.t / 0.4) : 1
          const hands = o.position.clone().add(new THREE.Vector3(0, HELD_AT[1] * STAFF_SCALE + 0.02, HELD_AT[2] * STAFF_SCALE).applyAxisAngle(UP_Y, pl.yaw))
          const from = pl.phase === 'put' ? passPlace(PASS_STACK_ALONG) : rackTop(rackNow())
          ps.position.lerpVectors(from, hands, k * k * (3 - 2 * k))
          ps.children.forEach((c, i) => { c.visible = i < pl.n })
        }
      }
    }

    // the servers, each by their duty (game/plates: one on the floor, one at the dishes; a lone one does both): what's plated at the pass to
    // its customer; the plates done with, cleared to the sink, their sticks into the bin beside it; washed there into the dish dryer; dried,
    // back to the racks
    const nServers = waiters.current.length
    waiters.current.forEach((w, wi) => {
      const home = homeOf(wi)
      const duty = ownerServes ? 'all' : dutyOf(wi, nServers)
      const trayAt = () => w.pos.clone().add(new THREE.Vector3(...HELD_AT).setY(HELD_AT[1] + 0.02).multiplyScalar(STAFF_SCALE)
        .applyAxisAngle(UP_Y, w.yaw))
      const run = () => runs.current.find((x) => x.key === w.run)
      const setMove = (on: boolean) => setMoving((m) => { if (!!m[wi] === on) return m; const n = [...m]; n[wi] = on; return n })
      const go = (path: THREE.Vector3[], phase: WaiterPhase) => { w.path = path; w.len = pathLength(path); w.phase = phase; w.t = 0; setMove(true) }
      const walk = (then: () => void) => {
        const d = Math.min(w.len, w.t * SERVER_SPEED)
        const { p, dir } = alongPath(w.path, d)
        w.pos.copy(p)
        if (dir.x || dir.z) w.yaw = Math.atan2(dir.x, dir.z)
        if (d >= w.len) { w.t = 0; setMove(false); then() }
      }
      const face = (at: THREE.Vector3) => { w.yaw = Math.atan2(at.x - w.pos.x, at.z - w.pos.z) }
      w.t += step
      // (the customer gone meanwhile: what was being carried to them put down, and the server goes back)
      if ((w.phase === 'fetch' || w.phase === 'pickup' || w.phase === 'go' || w.phase === 'set') && !sitting(w.seat)) {
        for (const k of w.keys) {
          SERVICE.carried.delete(k)
          SERVICE.claimed.delete(k)
        }
        w.keys = []
        const r = run()
        // (a plate carried for them and never eaten off: back on the pass's stack, or the racks with that full)
        if (r && r.phase === 'carry') {
          runs.current = runs.current.filter((x) => x !== r)
          if (PASS.stock < PASS_CAP) PASS.stock += 1
          else PLATE_RACK.n = putBack(PLATE_RACK.n, 1)
          redraw()
        }
        w.run = null
        w.slot = undefined
        // (back over the corners already passed, from where they are: none still ahead of them)
        const walked = w.phase === 'go' || w.phase === 'fetch' ? Math.min(w.len, w.t * SERVER_SPEED) : w.len
        const passed: THREE.Vector3[] = []
        for (let i = 1, at = 0; i < w.path.length - 1; i++) {
          at += w.path[i].distanceTo(w.path[i - 1])
          if (at < walked) passed.push(w.path[i])
        }
        go(w.phase === 'set' ? backPath(wi, w.seat).slice(0, -1).concat(w.pos.clone())
          : w.phase === 'fetch' ? [home.at.clone(), ...passed, w.pos.clone()]
            : [...fetchPath(wi), ...(w.phase === 'go' ? passed : []), w.pos.clone()], 'back')
        w.seat = -1
      }
      if (w.phase === 'idle') {
        // (looked about every quarter of a second, not every frame)
        if (w.t >= 0.25) {
          w.t = 0
          const slot = readySlot()
          const spoken = new Set(waiters.current.flatMap((x) => x.carry ?? []))
          const dirtyNow = runs.current.filter((r) => r.phase === 'dirty' && !spoken.has(r.key))
          // (the sink and the dryer one server's at a time)
          const atSink = waiters.current.some((x) => x !== w && (x.phase === 'washGo' || x.phase === 'wash' || x.phase === 'unloadGo' || x.phase === 'unloadTake'))
          const chore = nextChore({ duty, serve: slot >= 0, dirty: dirtyNow.length, sink: atSink ? 0 : dirty.current, rack: PLATE_RACK.n,
            dryer: atSink ? { n: 0, left: null } : DRYER })
          if (chore === 'serve') {
            // (out through their gate to the pass for it)
            w.slot = slot
            w.seat = PASS.slots[slot]!.seat
            go(fetchPath(wi), 'fetch')
          } else if (chore === 'clear') {
            // (out through their gate to the dirty plates, the longest waiting first and up to two more at that counter, nearest first)
            const first = dirtyNow[0]
            const c = seats[first.seat].counter
            const more = dirtyNow.slice(1).filter((r) => seats[r.seat].counter === c)
              .sort((a, b) => seats[a.seat].mid.distanceTo(seats[first.seat].mid) - seats[b.seat].mid.distanceTo(seats[first.seat].mid)).slice(0, 2)
            w.carry = [first.key, ...more.map((r) => r.key)]
            w.seat = first.seat
            go(backPath(wi, first.seat), 'clearGo')
          } else if (chore === 'wash' || chore === 'unload') {
            // (across the kitchen to the sink: to wash what's in it, or to take the dried plates out of the dryer under it)
            go(kitchenRoute(home.at, sinkFront()), chore === 'wash' ? 'washGo' : 'unloadGo')
          }
        }
      } else if (w.phase === 'fetch') walk(() => { w.phase = 'pickup'; face(pass.at) })
      else if (w.phase === 'pickup' && w.t > 0.4 && !(PASS.slots[w.slot ?? -1]?.flying)) {
        // (what's set out for the seat taken up off the pass, once nothing more's flying to it: its plate, if one's laid there, onto the tray,
        // and the food with it; the slot free)
        const k = w.slot ?? -1
        w.keys = [...SERVICE.waiting.entries()].filter(([, n]) => n === w.seat).map(([key]) => key)
        for (const key of w.keys) {
          SERVICE.waiting.delete(key)
          SERVICE.claimed.add(key)
        }
        const r = runs.current.find((x) => x.phase === 'pass' && x.slot === k)
        if (r) {
          r.phase = 'carry'
          r.slot = undefined
          w.run = r.key
          runObjs.current.get(r.key)?.scale.setScalar(1)
        }
        if (k >= 0) PASS.slots[k] = null
        w.slot = undefined
        const rt = routeTo(w.seat)
        rt.path[0] = w.pos.clone()
        go(rt.path, 'go')
      } else if (w.phase === 'go') walk(() => { w.phase = 'set'; face(plateAt(w.seat)) })
      else if (w.phase === 'set' && w.t > 0.4) {
        // (down at their place: the plate, and what's on it with it)
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
        go(backPath(wi, w.seat).slice(0, -1).concat(w.pos.clone()), 'back')
      } else if (w.phase === 'back') {
        const d = Math.min(w.len, w.t * SERVER_SPEED)
        const { p, dir } = alongPath(w.path, w.len - d)
        w.pos.copy(p)
        w.yaw = Math.atan2(-dir.x, -dir.z)
        if (d >= w.len) {
          w.phase = 'idle'
          w.pos.copy(home.at)
          w.yaw = home.yaw
          w.t = 0
          w.seat = -1
          setMove(false)
        }
      } else if (w.phase === 'clearGo' || w.phase === 'clearBack') walk(() => {
        if (w.phase === 'clearGo') {
          // (at the seat: the plate up off the bar onto the tray)
          const r = runs.current.find((x) => x.key === (w.carry ?? []).find((k) => runs.current.find((y) => y.key === k)?.phase === 'dirty'))
          if (r) { r.phase = 'taken'; r.from = plateAt(r.seat); face(plateAt(r.seat)) }
          w.phase = 'clearTake'
        } else {
          face(inBar('SinkBasinFloor', endOf(1)))
          w.phase = 'drop'
        }
      })
      else if (w.phase === 'clearTake' && w.t > 0.4) {
        // (another dirty plate at this counter still to take: on along the aisle to it; or back in through their gate, across to the sink)
        const next = runs.current.find((x) => (w.carry ?? []).includes(x.key) && x.phase === 'dirty')
        const st = seats[w.seat]
        if (next) {
          const nt = seats[next.seat]
          w.seat = next.seat
          go([w.pos.clone(), st.aisle.clone(), nt.aisle.clone(), besideSeat(next.seat)], 'clearGo')
        } else {
          const back = backPath(wi, w.seat).reverse()
          back[0] = w.pos.clone()
          go([...back, ...kitchenRoute(home.at, sinkFront()).slice(1)], 'clearBack')
        }
      } else if (w.phase === 'drop' && w.t > 0.5) {
        // (into the sink with the dirty ones; the sticks left on them into the bin beside it (the owner's))
        const keys = new Set(w.carry ?? [])
        const taken = runs.current.filter((x) => keys.has(x.key) && x.phase === 'taken')
        SINK_BIN.sticks += taken.reduce((n, x) => n + (x.sticks ?? 0), 0)
        runs.current = runs.current.filter((x) => !keys.has(x.key))
        dirty.current += taken.length
        w.carry = []
        w.seat = -1
        go(kitchenRoute(home.at, w.pos), 'back')
        redraw()
      } else if (w.phase === 'washGo' || w.phase === 'unloadGo') walk(() => {
        face(inBar('SinkBasinFloor', endOf(1)))
        w.phase = w.phase === 'washGo' ? 'wash' : 'unloadTake'
      })
      else if (w.phase === 'wash' && w.t >= WASH_EACH) {
        // (at the sink, the tap running: a plate washed out of the sink and stood in the dryer, its door down, one at a time; the sink washed
        // empty or the dryer full, its door shut and it started, and back to their place)
        w.t = 0
        const before = dirty.current
        const r = washOne(before, DRYER)
        if (r.dirty !== before) {
          dirty.current = r.dirty
          DRYER.n = r.dryer.n
          meterWater('dish')
          redraw()
        }
        // (done: the sink washed empty or the dryer full; or nothing more could be washed)
        if (dryerStarts(dirty.current, DRYER) || r.dirty === before) {
          if (DRYER.n > 0) DRYER.left = DRY_S
          go(kitchenRoute(home.at, w.pos), 'back')
        }
      } else if (w.phase === 'unloadTake' && w.t > 0.6) {
        // (the dryer's door down: a trip's worth of the dried plates out onto the tray, and across to the racks with them)
        const u = unload(DRYER)
        DRYER.n = u.dryer.n
        DRYER.left = u.dryer.left
        w.stack = u.take
        go(kitchenRoute(w.pos, rackFront(rackNow(PLATE_RACK.n + 1))), 'unloadCarry')
        redraw()
      } else if (w.phase === 'unloadCarry') walk(() => { face(rackTop(rackNow(PLATE_RACK.n + 1))); w.phase = 'unloadPut' })
      else if (w.phase === 'unloadPut' && w.t > 0.5) {
        PLATE_RACK.n = putBack(PLATE_RACK.n, w.stack ?? 0)
        w.stack = 0
        go(kitchenRoute(home.at, w.pos), 'back')
      }
      // what's on the tray goes where the tray goes (and, being set down, from the tray to the bar)
      const tray = trayAt()
      if (w.carry?.length) {
        let i = 0
        for (const key of w.carry) {
          const r = runs.current.find((x) => x.key === key)
          const o = runObjs.current.get(key)
          if (!r || !o || r.phase !== 'taken') continue
          const on = tray.clone().setY(tray.y + 0.006 + i * STACK_GAP)
          // (lifted off the bar onto the tray; and at the sink, down off it into the basin)
          if (w.phase === 'clearTake' && key === runs.current.find((x) => x.key === key && x.seat === w.seat)?.key) {
            const k = Math.min(1, w.t / 0.4)
            o.position.lerpVectors(r.from, on, k * k * (3 - 2 * k))
          } else if (w.phase === 'drop') {
            const k = Math.min(1, w.t / 0.45)
            o.position.lerpVectors(on, dirtyAt(dirty.current + i), k * k * (3 - 2 * k))
            o.scale.setScalar(1 - (1 - IN_SINK) * k)
          } else o.position.copy(on)
          i++
        }
      }
      const so = stackObjs.current[wi]
      if (so) {
        const n = w.stack ?? 0
        const carrying = n > 0 && (w.phase === 'unloadCarry' || w.phase === 'unloadPut')
        so.visible = carrying
        if (carrying) {
          const k = w.phase === 'unloadPut' ? 1 - Math.min(1, w.t / 0.45) : 1
          so.position.lerpVectors(rackTop(rackNow(PLATE_RACK.n + 1)), tray.clone().setY(tray.y + 0.006), k * k * (3 - 2 * k))
          so.children.forEach((c, i) => { c.visible = i < n })
        }
      }
      const k = w.phase === 'set' ? Math.min(1, w.t / 0.4) : 0
      const plateTo = w.seat >= 0 ? plateAt(w.seat) : tray
      const hold = tray.clone().lerp(plateTo, k * k * (3 - 2 * k))
      hold.y += Math.sin(Math.PI * k) * 0.04
      if (w.phase === 'go' || w.phase === 'set') {
        const pr = runObjs.current.get(w.run ?? -1)
        // (the plate, carried on the tray; what's on it with it)
        if (pr && run()?.phase === 'carry') pr.position.copy(hold.clone().setY(hold.y + 0.006))
        w.keys.forEach((key, i) => SERVICE.carried.set(key, toShop(hold.clone().add(new THREE.Vector3((i % 3 - 1) * 0.05, 0.035 + Math.floor(i / 3) * 0.03, 0)))))
      }
      const o = waiterObjs.current[wi]
      if (ownerServes) OWNER_OUT.on = w.phase !== 'idle'
      if (o && SHOP.leaving && !ownerServes) {
        // (the shop's shut and empty: out through their gate, along the aisle (round the corner from the side counter's) and through the
        // front door, as the customers go, and gone)
        if (!w.out) {
          const h = homes[wi]
          const way = [w.pos.clone(), ...h.way.slice(1).map((v) => v.clone()), ...(h.counter ? [aisleCorner(counters[h.counter])] : []), doorOf(counters)]
          w.out = { way, len: pathLength(way), d: 0 }
        }
        const out = w.out
        out.d = Math.min(out.len, out.d + Math.min(dt, 0.1) * 1.1)
        const { p, dir } = alongPath(out.way, out.d)
        w.pos.copy(p)
        if (dir.x || dir.z) w.yaw = Math.atan2(dir.x, dir.z)
        o.position.copy(w.pos)
        o.rotation.y = w.yaw
        o.visible = out.d < out.len - 0.12
      } else if (o) {
        w.out = undefined
        // (the owner's figure here only while he's out: at his place, Roasting draws him)
        o.visible = !ownerServes || OWNER_OUT.on
        o.position.copy(w.pos)
        o.rotation.y = w.yaw
      }
      // (up on the kitchen's dais while they're over it)
      if (o && KITCHEN_DROP < 0) {
        const d = w.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
        if (a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]) o.position.y += -KITCHEN_DROP / scale
      }
    })
    SERVICE.walkers = waiters.current.map((w) => w.pos)
    // (which seats have their plate down, for what's being served to them; and which have it out, down or on its way)
    PLATES_SET.clear()
    PLATES_OUT.clear()
    for (const r of runs.current) {
      if (r.phase === 'set' || r.phase === 'clear' && r.t < 0) PLATES_SET.add(r.seat)
      if (r.phase === 'set' || r.phase === 'carry') PLATES_OUT.add(r.seat)
    }
    if (finished || homed) {
      runs.current = runs.current.filter((r) => r.t !== Infinity)
      dirty.current += finished
      redraw()
    }
    // (with nobody on the floor to wash them, the sink's plates wash themselves back onto the racks, a batch at a time)
    if (!nServers) {
      if (wash.current === null && dirty.current > 0 && !runs.current.some((r) => r.phase === 'clear' && r.t >= 0)) wash.current = 0
      if (wash.current !== null) {
        wash.current += step
        if (wash.current >= WASH_EACH && dirty.current > 0) {
          wash.current = 0
          dirty.current -= 1
          meterWater('dish')
          const going = runs.current.filter((r) => r.phase === 'home').length
          runs.current.push({ key: ++runSeq.current, seat: -1, guest: -1, phase: 'home', t: 0, from: dirtyAt(dirty.current), to: rackTop(rackNow(PLATE_RACK.n + going + 1)) })
          redraw()
        }
        if (dirty.current === 0) wash.current = null
      }
    }
    // the dryer drying (game/plates), its door down while someone's at it
    if (DRYER.left !== null && DRYER.left > 0) DRYER.left = dryerTick(DRYER, step).left
    DRYER.open = waiters.current.some((x) => x.phase === 'wash' || x.phase === 'unloadTake') ? 1 : 0
    SINK.washing = waiters.current.some((x) => x.phase === 'wash') || wash.current !== null
    // (the pass's stack of clean plates, the plates in the dryer, and the sticks in the bin: as many drawn as there are)
    passStack.current?.children.forEach((c, i) => { c.visible = i < PASS.stock })
    if (DRYER.n > 0 && dryerPlates.current) {
      const along = dryerAt(1).sub(dryerAt(0)).normalize()
      dryerPlates.current.children.forEach((c, i) => {
        c.visible = i < DRYER.n
        if (c.visible) { c.position.copy(dryerAt(i)); c.quaternion.setFromUnitVectors(UP_Y, along) }
      })
    } else dryerPlates.current?.children.forEach((c) => { c.visible = false })
    const bs = binSticks.current
    if (bs) {
      const shown = Math.min(SINK_BIN.sticks, BIN_SHOWN)
      if (shown > 0) bs.position.copy(inBar('SinkBinTop', endOf(1)))
      bs.children.forEach((c, i) => { c.visible = i < shown })
    }
  })

  return (
    <group ref={frame} name="bar-frame" scale={scale} position={offset}>
      {drawCounter && <group position={at}><Counter length={length} /></group>}
      {counters.map((c, i) => {
        // the first counter's floor runs on past its end to the door, and back to meet the others' aisles; each other
        // one's runs up to the first one's
        const c0 = counters[0]
        // (the walls' corner reckoned on unit directions, as the walls stand (on their yaw): the counters' along and lay are a shade over
        // unit length, and reckoned with them the two walls missed each other by a centimetre and more, a step across their tops at the
        // corner and a slot down its inside)
        const unit = (v: THREE.Vector3) => v.clone().normalize()
        if (i === 0) {
          const back = Math.min(-c.length / 2 - 0.35, ...counters.slice(1).map((o) =>
            o.at.clone().addScaledVector(o.lay, farOf(o)).sub(c.at).dot(c.along)))
          const wallBack = Math.min(-c.length / 2 - 0.35, ...counters.slice(1).map((o) =>
            o.at.clone().addScaledVector(unit(o.lay), farOf(o)).sub(c.at).dot(unit(c.along))))
          return (
            <group key={i}>
              <DiningFloor c={c} from={back} to={c.length / 2 + 1.45} bare={!!given} />
              {/* (and past the bar's end, a strip more behind the till for the cashier to stand on; a shop laid out
                  in full has one floor under all of it instead) */}
              {given && <RoomFloor counters={counters} drop={KITCHEN_DROP / scale} />}
              {given && <Later stage={2}><ShopProps counters={counters} /></Later>}
              {given && <DiningWall c={c} from={back} to={c.length / 2 + 1.45} far={FLOOR_FAR} lampId="barlamp" lampName="長吧台" top={top} altar={incense ?? true} corner={wallBack}
                staffDoor={STAFF_DOOR_AT} />}
            </group>
          )
        }
        const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
        // (where its wall's line reaches the first counter's wall)
        const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(unit(c0.lay))) / unit(c.along).dot(unit(c0.lay))
        return (
          <group key={i}>
            <DiningFloor c={c} from={-c.length / 2 - 0.35} to={meet} far={farOf(c)} bare={!!given} />
            {/* (its wall runs on into the corner, to meet the first counter's: the toilet's door in that stretch) */}
            {given && <DiningWall c={c} from={-c.length / 2 - 0.35} to={corner} far={farOf(c)} lampId="sidelamp" lampName="側吧台" top={top} door={wcs?.door ?? (meet + corner) / 2}
              clear={fridgeClear} hang={koiHang(fridgeClear ?? [], -c.length / 2 - 0.35)} />}
          </group>
        )
      })}
      {/* the way in, just past the end of the bar where the customers come and go */}
      <Entrance at={doorOf(counters)} mark={mark} />
      {/* the till, just inside the door on the bar's side of the way in (the shops that lay out their own counters) */}
      {given && (
        <Register lang={lang} top={top + TILL.rise} yaw={Math.atan2(-counters[0].along.z, counters[0].along.x)}
          at={counters[0].at.clone().addScaledVector(counters[0].along, counters[0].length / 2 + TILL.along).addScaledVector(counters[0].lay, TILL.lay)} />
      )}
      {/* (each stool its own Movable, so each can be moved, turned and made larger or smaller by hand when the shop's shut: only the stool's look; where its guest
          sits and the way to it stay as they are, so no one is put out of a seat) */}
      <Stools seats={seats} />
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
      {/* (the fridges' own light inside, always on: it lights the drinks whatever the room's light, and shows the more with the lamps out; one
          for the pair, between them, and here from the first, not with the fridges as they come in later: a light added to the scene has every
          material in it made again, a stall) */}
      {fridges && QUALITY.tier === 'high' && (
        <pointLight position={fridges[0].at.clone().lerp(fridges[1].at, 0.5).setY(FRIDGE.H * 0.55)} color="#eaf4ff" intensity={1.1} distance={FRIDGE.H * 2.4} decay={1.4} />
      )}
      {fridges && <Later stage={2}><Fridges fridges={fridges} /></Later>}
      {/* what each has fetched from the fridge, stood beside their plate, toward the cook */}
      {given && shown.filter((s) => s.drink && s.phase !== 'leave' && !(s.phase.startsWith('wc') && s.wc?.who === 'drink')).map((s) => {
        const st = seats[s.seat], c = counters[st.counter]
        const d = DRINKS.find((x) => x.id === s.drink)!
        const at = st.mid.clone().addScaledVector(c.along, PLACE.drink[0]).addScaledVector(c.lay, PLACE.drink[1]).setY(top)
        return (
          <group key={`drink${s.id}`} position={at}>
            <DrinkBottle id={d.id} wet />
          </group>
        )
      })}
      {/* each seated customer's soy, poured into the little dish at their place (empty till they sit), a dab of
          grated daikon in it */}
      {given && shown.filter((s) => s.phase !== 'enter' && s.phase !== 'leave').map((s) => {
        const st = seats[s.seat], c = counters[st.counter]
        const x = st.mid.clone().sub(c.at).dot(c.along)
        const at = st.mid.clone().addScaledVector(c.along, sauceSide(c, BAR_GATES[st.counter], x)).addScaledVector(c.lay, PLACE.sauce[1]).setY(top + 0.013)
        return (
          <group key={`soy${s.id}`} position={at}>
            <mesh geometry={AT_SEAT.soy} rotation-x={-Math.PI / 2}><meshToonMaterial color="#3a1c0c" /></mesh>
            <mesh geometry={AT_SEAT.daikon} position={[0.008, 0.004, 0.004]} scale={[1, 0.5, 1]}><meshToonMaterial color="#f2efe4" /></mesh>
          </group>
        )
      })}
      {/* the dirty plates waiting in the sink, and the plates out: on their way to a seat, at it, cleared away, washed and going back */}
      {Array.from({ length: dirty.current }, (_, i) => (
        <group key={`d${i}`} position={dirtyAt(i)} rotation-y={i * 0.9} scale={IN_SINK}><Plate dirty design={i} /></group>
      ))}
      {/* the pass's stack of clean plates (the kitchen brings them from the racks; one's laid for a seat as its first food comes off the fire) */}
      {given && (
        <group ref={passStack} position={passPlace(PASS_STACK_ALONG)}>
          {Array.from({ length: PASS_STACK_SHOWN }, (_, i) => (
            <group key={i} position={[0, i * STACK_GAP * ON_PASS, 0]} rotation-y={i * 1.1} scale={ON_PASS} visible={false}><Plate design={i + 5} /></group>
          ))}
        </group>
      )}
      {/* the washed plates standing in the dish dryer under the sink's counter (seen through its glass door), and the used sticks in the bin
          beside it (cleared off the customers' plates with them) */}
      {given && (
        <group ref={dryerPlates}>
          {Array.from({ length: DRYER_CAP }, (_, i) => <group key={i} scale={IN_SINK} visible={false}><Plate design={i + 1} /></group>)}
        </group>
      )}
      {given && (
        <group ref={binSticks}>
          {Array.from({ length: BIN_SHOWN }, (_, i) => {
            const a = i * 2.4, r = 0.012 + (i % 4) * 0.009, lean = 0.12 + (i % 3) * 0.08
            return (
              <mesh key={i} geometry={USED_STICK_GEO} position={[Math.cos(a) * r, -0.03 + (i % 5) * 0.006, Math.sin(a) * r]}
                rotation={[Math.sin(a) * lean, 0, -Math.cos(a) * lean]} visible={false}>
                <meshToonMaterial color="#c9a46a" />
              </mesh>
            )
          })}
        </group>
      )}
      {/* (the kitchen's plater, off their place on the way to the racks and back with plates for the pass; at their place, Roasting draws them;
          the plates in their hands) */}
      {given && !ownerServes && (
        <group ref={(o) => {
          const was = platerObj.current
          if (was && was !== o) KITCHEN_FOLK.delete(was)
          platerObj.current = o
          if (o) KITCHEN_FOLK.add(o)
        }} scale={STAFF_SCALE} visible={false}>
          <BlobShadow r={0.17} />
          {plater ? <StaffFigure id={plater.id} role={plater.role} look={plater.look} moving={platerMoving} /> : <OwnerWalker moving={platerMoving} />}
        </group>
      )}
      {given && (
        <group ref={platerStack} visible={false}>
          {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, i * STACK_GAP * IN_SINK, 0]} rotation-y={i * 1.1} scale={IN_SINK}><Plate design={i + 7} /></group>)}
        </group>
      )}
      {/* (a server's stack of dried plates, on their tray on the way from the dryer back to the racks) */}
      {waiters.current.map((_, wi) => (
        <group key={`stack${wi}`} ref={(o) => { stackObjs.current[wi] = o }} visible={false}>
          {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, i * STACK_GAP * IN_SINK, 0]} rotation-y={i * 1.1} scale={IN_SINK} name={`stack-plate-${i}`}><Plate design={i + 3} /></group>)}
        </group>
      ))}
      {runs.current.map((r) => (
        <group key={r.key} ref={(o) => {
          if (!o) return void runObjs.current.delete(r.key)
          runObjs.current.set(r.key, o)
          if (!o.userData.placed) {
            o.userData.placed = true
            o.position.copy(r.from)
          }
        }}>
          <Plate dirty={r.phase === 'clear' || r.phase === 'dirty' || r.phase === 'taken'} design={designOf(r.key)} sticks={r.sticks ?? 1} />
        </group>
      ))}
      <Later stage={3}>
      {given && fridges && stocker && <Stocker counters={counters} fridges={fridges} who={stocker} />}
      {ownerServes && (
        <group ref={(o) => {
          const was = waiterObjs.current[0]
          if (was && was !== o) KITCHEN_FOLK.delete(was)
          waiterObjs.current[0] = o
          if (o) KITCHEN_FOLK.add(o)
        }} position={ownerAt()} rotation-y={OWNER_YAW} scale={STAFF_SCALE} visible={false}>
          <BlobShadow r={0.2} />
          <OwnerWalker moving={!!moving[0]} />
        </group>
      )}
      {!ownerServes && servers.slice(0, homes.length).map((w, i) => (
        <group key={w.id} ref={(o) => {
          const was = waiterObjs.current[i]
          if (was && was !== o) KITCHEN_FOLK.delete(was)
          waiterObjs.current[i] = o
          if (o) KITCHEN_FOLK.add(o)
        }} position={homes[i].at} rotation-y={homes[i].yaw} scale={STAFF_SCALE}>
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
              <PersonClock s={s} phase={s.phase} drink={s.drink} eating={s.phase === 'sit' && guestsRef.current.find((x) => x.id === s.id)?.state === 'eating'}
                clock={clock} talk={talkSide(s)} mood={g ? moodOf(g) : null} />
            </group>
            {/* (their label just over their head: a figure in the boss's style is shorter than the old ones, and sits up on the seat) */}
            <GuestLabel id={s.id} y={FOLK_GUESTS ? ((walking ? 0 : FOLK_SEAT) + FOLK_HEIGHT * FOLK_FIT * folkSpec(s.id).size) * PEOPLE_SCALE + 0.15 : 1.05 * PEOPLE_SCALE}
              say={speech[s.id]} dots={!!g && !walking && g.state === 'waiting' && g.rating === null} rating={g?.rating ?? null} angry={g?.state === 'angry'}
              partner={g?.partner !== undefined} name={guestLabel(s.id, lang)} onEl={labelEl} />
          </group>
        )
      })}
      </Later>
    </group>
  )
}

/** the drinks fridges, each its own piece for edit mode: drawn again only if they move */
const Fridges = memo(function Fridges({ fridges }: { fridges: NonNullable<ReturnType<typeof fridgesOf>> }) {
  return (
    <>
      {fridges.map((f) => (
        <Movable key={f.n} id={`drinkfridge${f.n}`} label={`飲料櫃 ${f.n + 1}`}><group name={f.n ? 'look-fridge-b' : 'look-fridge'} position={f.at} rotation-y={f.yaw}><DrinkFridge n={f.n} /><FridgeStock n={f.n} /><FridgeDoor n={f.n} /></group></Movable>
      ))}
    </>
  )
})

/** the stools, each its own piece for edit mode: drawn again only if the seats change */
const Stools = memo(function Stools({ seats }: { seats: ReturnType<typeof seatsOf> }) {
  return (
    <>
      {/* (each stool its own Movable, so each can be moved, turned and made larger or smaller by hand when the shop's shut: only the stool's look; where its guest
          sits and the way to it stay as they are, so no one is put out of a seat) */}
      {seats.map((st, n) => (
        <Movable key={`${seats.length}-${n}`} id={`stool${n}`} label={`座位 ${n + 1}`}>
          <StaticBatch>
            <group position={st.stool} rotation-y={st.yaw} scale={PEOPLE_SCALE}><StoolModel red={n % 2 === 1} /></group>
          </StaticBatch>
        </Movable>
      ))}
    </>
  )
})

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

const LABEL_STYLE = { pointerEvents: 'none' } as const
const LABEL_Z = [20, 10]
/** one customer's label over their head (what they're saying, or the dots while they wait; their face once they've eaten; their number): drawn
 * again only when one of those changes. Each is a page of its own (drei's Html renders its children into a root of their own), so drawn again
 * with every redraw of the bar, several times a second, every label was laid out again each time */
const GuestLabel = memo(function GuestLabel({ id, y, say, dots, rating, angry, partner, name, onEl }: { id: number; y: number
  say?: { key: number; text: string }; dots: boolean; rating: number | null; angry: boolean; partner: boolean; name: string
  onEl: (id: number, el: HTMLElement | null) => void }) {
  const at = useMemo(() => [0, y, 0] as [number, number, number], [y])
  return (
    <Html position={at} center zIndexRange={LABEL_Z} style={LABEL_STYLE}>
      <div className="g3-label" ref={(el) => onEl(id, el)}>
        {say ? <Say key={say.key} text={say.text} /> : dots && <span className="g3-bubble">…</span>}
        {rating !== null && <MoodFace guest={{ rating, state: angry ? 'angry' : 'done' }} />}
        <span>{partner && <i className="g3-heart">♥</i>}{name}</span>
      </div>
    </Html>
  )
})

/** how much lower the stool's seat is than the one the old figures (guests.glb) were made to sit on */
const OLD_STOOL_DROP = 0.343 - FOLK_SEAT
/** one customer's figure, moved by the bar's clock each frame (read from the ref: nothing re-renders for it) */
// (drawn again only when what's shown of them changes (their phase, eating or not, the drink in hand, who they turn to, how they're
// getting on), not each time the bar above them redraws, several times a second; `phase` and `drink` are passed only so it notices them)
const PersonClock = memo(PersonClockImpl)
function PersonClockImpl({ s, eating, clock, talk, mood }: { s: Shown; phase: string; drink?: string; eating: boolean; clock: { current: number }
  talk: number; mood: ReturnType<typeof moodOf> }) {
  const atFridge = s.phase === 'wcIn' && s.wc?.who === 'drink'
  const Figure = FOLK_GUESTS ? FolkFigure : Person
  // (their own boundary: a customer still loading shows nothing a moment, never blanks the shop round them; the old figures, made to sit on
  // the old, taller stool, sat down by the difference)
  return <Suspense fallback={null}><group position-y={!FOLK_GUESTS && s.phase === 'sit' ? -OLD_STOOL_DROP : 0}><Figure id={s.id} eating={eating} walking={s.phase !== 'sit'} still={() => !!s.still} clock={clock} talk={talk} mood={mood}
    fade={() => s.fade ?? 1} slippers={() => s.slippers ?? true} pose={atFridge ? 'Fetch' : s.phase === 'wcWash' ? 'Wash' : undefined} fit={FOLK_FIT}
    held={s.drink && s.phase === 'wcBack' ? <DrinkBottle id={s.drink} wet /> : undefined} /></group></Suspense>
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
const DiningFloor = memo(DiningFloorImpl)
const RoomFloor = memo(RoomFloorImpl)
