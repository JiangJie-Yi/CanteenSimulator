import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SKEWER_WASH_S, WASH_LOW, pickUpDirty, putBackClean, washAll, washGoes, washUrgent } from '@/game/skewers'
import { newStepTurn, stepFrame, waitsForStep } from '@/game/genkanStep'
import { rattleSound } from './skewerSound'
import { useSaid } from '@/ui/speechStore'
import { getClock, minutesNow } from '@/ui/clockStore'
import { crewCall, crewThanks, crewWelcome } from './crewTalk'
import { NO_RAY } from '@/scene/pickable'
import { heard } from '@/scene/sfx'
import { nextClean, sweeps, SWEEP_S, WIPE_S as FLOOR_WIPE_S } from '@/game/spills'
import { FigureHit, GRABBING } from '@/scene/FigureHit'
import { CALM, calmLeft, canCalm, type CalmKind } from '@/game/calm'
import { glowLeave, glowOff, glowOnly } from '@/scene/hoverGlow'
import { BOX_SHEETS, sheetsFor, takeSheets, TISSUE } from '@/game/tissues'
import { drinksToOrder, ROLL_LOW, stockerChore, type StockChore } from '@/game/stocker'
import { bagGoes, bagOut, binToEmpty, toss, type BinKind, type Waste } from '@/game/bins'
import { ROLL, SOAP, SOAP_FULL, SOAP_REFILL_AT, takeOne, takesTowel, topUp, TOWEL, TOWEL_FULL, TOWEL_REFILL_AT } from '@/game/washroom'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { homeCopy, StaticBatch, mergeByMaterial } from '@/scene/StaticBatch'
import { warmLater } from '@/scene/Prewarm'
import { FloorPiece } from '@/scene/FloorPiece'
import { QUALITY } from '@/scene/quality'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { GuestView } from '@/game/types'
import { MoodFace } from '@/ui/MoodFace'
import { Glyph, StarIcon } from '@/ui/GameIcons'
import { joySound, usePanelSound } from '@/ui/uiSound'
import { guestLabel, kindOf } from '@/data/guests'
import { FOLK_HEIGHT, FolkFigure, FolkWarm, SEAT as FOLK_SEAT, folkSpec } from '@/scene/FolkFigure'
import { delayOf, FADE_S, paceOf } from '@/game/commute'
import { DOOR_OPEN_S, DOOR_SHUT_S, doorClicked, doorShown, doorShut, doorStep, doorWantOpen, type DoorState, type DoorWalker } from '@/game/slideDoor'
import { makeTrip, tripStep, turnSmooth, turnToward, type Trip } from './commuteWalk'
import { latheSolid, rimmedTray } from '@/scene/trayGeometry'
import { StaffWords, TiredBadges } from './StaffWords'
import { STAFF_IDLE, STAFF_SAY, STAFF_TALK, idleTick, paceOfStaff } from '@/game/shopState'
import { PILE_LINE, bossCleans, pileLeft, staffSink } from '@/game/sinkPile'
import { HAND_WASH_LINES, SPONGE_S, WASH_WET, beatLength, handClean, handSays, handStops, scrubbed, washBeat, washPlateS, type HandAt } from '@/game/handWash'
import { POUR_TOTAL, SAKE_SET_S, SAKE_UP_S, pourBeat, pouredBy, streaming } from '@/game/sakePour'
import { SAKE_BOTTLE_ML, STATION_GO, TOKKURI_ML, stationGo } from '@/game/sakeStand'
import { PLATE_NAME, plateSays } from '@/game/plateTip'
import { newWashPose, spongePose, washPose, type WashPoints } from '@/scene/washMotion'
import { PLATE_DIMS, PLATE_SPREAD, plateSide, type PlateKind } from '@/game/plateSize'
import { PathMap } from './PathMap'
import { Drips } from '@/scene/Drips'
import { ServeCounter } from './ServeCounter'
import { PathVias, PathZones } from './PathZone'
import { unlitShade } from '@/game/roomLights'
import { StaffFigure, TRAY_AT as HELD_AT, wipeStroke, SHAPE_HAND, SweepBroom, ownerSweepPose, floorWipePose, OWNER_BEND } from '@/scene/StaffFigure'
import { CRATE, CRATE_FULL, useRiceTub } from './Decor'
import { COAL_PER_ADD } from '@/game/coalPile'
import { BossModel, drawnCentre } from './Boss'
import { Omamori } from './Omamori'
import { moodOf, walkSpeedOf } from '@/scene/people'
import { BlobShadow } from '@/scene/BlobShadow'
import { brushText, followSign, signTexture } from '@/scene/signFont'
import { activityOf, type Look as StaffLook } from '@/data/staff'
import type { Lang } from '@/data/i18n'
import { inkModel, inkTogether } from '@/scene/inkHull'
import { aimTip, setTip, shownOver } from '@/scene/hoverTip'
import { shrineDoor } from './shrineSound'
import { getLights, setLightSwitch } from '@/scene/lightsStore'
import { Later } from '@/scene/Later'
import { wareGeometry } from './ware'
import { designOf } from './wareDesigns'
import { mameGlaze, oribeLong, roundGlaze } from './wareGlazes'
import { HAND_MS } from './Restroom'
import { DiningWall, DrinkBottle, DrinkFridge, FridgeDoor, FridgeStock, DrinkWarm, ShopProps, SakeCup, DrinkCup, cupped } from './DiningRoom'
import { Tokkuri } from './Tokkuri'
import { SakeStation, SERVE_TOP, STATION, STATION_OBJ, newStationPose, stationPose, STATION_STREAM_TO } from './SakeStation'
import { Koban } from './Koban'
import { OwnLuckyCat } from './OwnLuckyCat'
import { LuckyCat } from './LuckyCat'
import { IpadModel } from './Ipad'
import { TillBoxes } from './TillBoxes'
import { StoolModel, TillStoolModel } from './BarFurnish'

/** the boxes on the till's low shelf, each its own piece, and its name in the developer panel */
const TILL_BOXES = [['bags', '紙袋'], ['napkins', '紙巾'], ['rolls', '收銀紙捲'], ['coasters', '杯墊'], ['chopsticks', '割箸']] as const
import { TillCounter } from './TillCounter'
import { drawerOpens, paysByCard, tabletActive, tenderOf } from '@/game/till'
import { CAT_STAND_H, TillBellLive, TillDeskPiece, TillMatLive } from './TillDesk'
import { beep, behindBody, chime, DRAWER_FRONT, DRAWER_KEY, showKeyTip, turnKey, liftOn, rattle, RECEIPT_TEX, REGISTER, RegisterBody, RegisterDrawer, RegisterKeys, registerTag, registerText, useRegisterModel } from './cashRegister'
import { Movable } from './Movable'
import { getEdit, offsetOf, setLocked } from './edit'
import { basinHint, guideOff, guideOn, useBinBags } from './Sink'
import { changeOf, CoinPile, CoinStack, isNote, NoteStack, type CoinKind, type Note } from './Cash'
import { dishLines, paysAtTill, takeOut, type Denom } from '@/game/till'
import { DRY_S, DRYER_CAP, LOW_FULL, PLATES_ALL, STACK_CAP, dryerStarts, dryerTick, dutyOf, lowGoes, lowToBring, nextChore, onTheWay, plateSource, platerGoes, platesToBring, playerLoad, putBack, rackAtStart, START_DIRTY, START_DRAIN, unload, washOne, DRAIN_CAP, drainTick, handOne, unbasket, CLEAN_AT, DIRT_BASE, handTime, plateDirt, soakStep } from '@/game/plates'
import { kitchenPath, outOfPieces, reachSpot, standClear, type Rect } from '@/game/kitchenPath'
import { PER_RACK } from './PlateRack'
import { RICE_FULL, SCOOP_S, SHAPE_EACH, TRAY_MAX, WASH_S, emptyKama, kamaTick, riceGoes, setOn, takeRice, trayWants } from '@/game/rice'
import { WARM_TUB_HOLDS, keptWarm } from '@/game/takeout'
import { MAKE_S, SOUP_BOWLS, emptyPot, heatNow, heatRate, potTick, setSoup, soupGoes, soupReady, takeBowl, topUpGoes } from '@/game/soup'
import { RICE_BEATS, SOUP_BEATS, beatsLength } from '@/game/sides'
import { SeatBowls, fillRice, fillSoup, ladleRest, leftOf, paddleRest, riceFillPose, soupFillPose, useSideProps, type FillAt, type FillPose } from './SideBowls'
import { bottleClink, lightSwitchSound, plateClink, plateDownSound, scrubSound, slideDoorSound, stoolSound, tapTurnSound, washSplash } from './restroomSound'
import { LAST_CALL, ON_DUTY, SHOP, clockIn } from '@/game/shopState'
import { flowerBuffs } from '@/game/shrineFlowers'
import { murmur } from '@/game/fireSound'
import { crowdAmbience } from './fireAmbience'
import { LINES } from '@/data/lines'
import { looksOf, newRoll, openRoom, penaltyOf, visitRoom } from '@/game/restroom'
import { platerFree } from '@/game/kitchenCrew'
import { plateGoes } from '@/game/tray'
import { CALM_ASK, FUMING, DRAIN_KINDS, EAT_PHASE, PLATE_FACES, SEATS_SAT, DRAWER_KICK, TISSUE_REACH_MS, seatTurn, GRATING, ONIGIRI_TRAY, HAND_WASH, FIGURES, CARRIED, SOY_DISH_AT, FETCHER, FIRE_TEND, SKEWERS, SEAT_MOVE, SEAT_PULL, STOOL_TUCK, SHOE_CELLS, aisleCornerOf, aisleOf, DRAWER_HELD, SHOP_PURSE, STOCKER_WC, SUPPLIES, CHOPS_UP, FED, BENCH, BENCH_SEATS, BENCH_EACH, BENCH_PLACE, BENCH2_ALONG, TAKEOUT_STAND, STAND_AT, cashierIn, nameOver, gripe, setTissues, tissuesAt, meterWater, OWNER_OUT, OWNER_SPOT, OWNER_YAW, FIRE_SHIFT, KITCHEN_ROUTE, PATH_MAP, type PathRoute, SERVE_COUNTER, PLACE, SICK, SHRINE_FLOWERS, PLATING, READY_SLOTS, PLATE_STACK_ALONG, PLATE_STACK_ACROSS, readyAlong, PLATES_OUT, PLATER_OUT, DRYER, DRAIN, PLATE_COUNT, SINK_BIN, SEAT_STICKS, SEAT_BONES, WC_W, WC_ROOM, RICE, SOUP, SOUP_SEATS, SAKE, SAKE_SEATS, LOW_RACK, takeDrink, KITCHEN_DROP, kitchenOf, kitchenGatesOf, AISLE, FLOOR_FAR, FLOOR_NEAR, PLATES_SET, SINK, PILE, KITCHEN_FOLK, GENKAN, inGenkan, sauceSide, SEATS_TAKEN, SERVICE, BAR_GATES, TILL, TILL_CASH, anyInStock, batchOf, payIn, TILL_STATE, PLATE_RACK, billOf, GUEST_BILLS, DRINKS, yen, payOf, TAKEOUT, takeoutOf, POINTER_HINT, tipOver, TOILETS, WC_GRUMBLE, DRINK_BACK, FRIDGE, FRIDGE_AT, FRIDGE_STATE, isCan, FRIDGE_STOCK, placesOf, FRIDGE_UNITS, drinkFor, farOf, fridgesOf, fridgeUnitOf, gateOf, toiletsOf, type DrinkId, platingOf, roomOf, alongPath, doorOf, wayInOf, doorAt, doorOutOf, DOOR_LANE, pathLength, pathTo, seatsOf, singleCounter, type Counter, SPILLS, IRONS, type Spill, genkanY, soapPlate, scrubDose, SAY_SEATED, BOWLS, RICE_SEATS, STAFF_DOOR_HOLD, sakeLeft, ownerAway, ownerFree, ownerBack, DRINK_COMING } from './bar'
import { BONES_GEO, HEAD_GEO } from './fishBones'
import { arrivals, buyCase, caseCost, emptyFillable, orderCase, restockRun } from '@/game/drinkStock'
import { tl } from '@/data/i18n'
import { NO_POINTER, zr } from '@/scene/htmlProps'
/** where a sound's heard from, worked out in place */
const SOUND_AT = new THREE.Vector3()

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
const SPEED = 1.32                                  // how fast they walk in and out (per second: unhurried, the owner's)
/** how long the third cook rakes the fire over with the irons (item 108) */
const RAKE_S = 1.6
const SERVER_SPEED = 2.1                            // and the servers, carrying (brisk)
/** how far along a server's way they've got `t` seconds in (item 183): up to their pace over the first fifth of a second (a start from a
 * standstill), then at it; never past its end `len` */
const SERVER_RAMP = 0.2
const rampedAlong = (t: number, len: number) => Math.min(len, t < SERVER_RAMP ? (SERVER_SPEED * t * t) / (2 * SERVER_RAMP) : SERVER_SPEED * (t - SERVER_RAMP / 2))
// (stepping aside for each other (the owner's item 45): how far ahead they see someone coming (seconds), how quick a step aside is (per
// second: about a walk), the fastest anyone walks (a quicker move between two frames is a leap, a phase begun elsewhere, not a walk))
const AHEAD_S = 0.6, ASIDE_V = 1.5, WALK_MOST = 3.2
const STOCKER_KEY = -99
/** those waiting on the genkan's bench, among those stepping aside for each other: keyed apart from the customers (SITTER_KEY less their id) */
const SITTER_KEY = -1000
/** the pieces standing against the first counter's wall, behind its aisle: the waiting benches, the helmet's stand and the helmet on it; and
 * the cats' stand by the door with its cats (item 387: moved along the wall into the aisle (the owner's, item 96), the cat at its front
 * 0.42 from the stools' backs, those going by walked into it: aisleSqueeze) */
const WALL_PIECES = ['bench', 'bench2', 'kabutostand', 'kabuto', 'doorcats', 'owncat', 'koban', 'doorcat0', 'doorcat1', 'doorcat2', 'doorcat3']
const WALL_V = new THREE.Vector3(), WALL_INV = new THREE.Matrix4()
/** (and where they stood when last measured, `sig`; when that was, `full`; when those not found were last looked for, `looked`) */
type WallKeep = { at: number; boxes: { a0: number; a1: number; front: number }[]; roots: Map<string, THREE.Object3D>; sig: number; full: number; looked: number }
/**
 * Each of WALL_PIECES' footprints in the first counter's frame (item 193), from its own meshes' vertices between the floor and a body's
 * shoulders: along the counter from its middle (`a0` to `a1`), and how far toward the aisle its front comes (`front`, lay). Measured now and
 * then, not laid down here, so it follows a piece moved by hand.
 */
function measureWall(scene: THREE.Object3D, frame: THREE.Object3D, c: { at: THREE.Vector3; along: THREE.Vector3; lay: THREE.Vector3 }, keep: WallKeep) {
  // (measured again only when one of them has moved (by hand in edit mode, the benches put back as the shop shuts), or a minute on (item 374:
  // every 3 s it was, its sums over thousands of vertices each time, run too seldom to be made quick: a number made for each, some 23 MB of
  // garbage every 30 s); and those not in the shop looked for at most every 10 s, a walk through the whole scene for each)
  const now = performance.now(), look = now - keep.looked > 10000
  if (look) keep.looked = now
  let sig = 0
  for (const id of WALL_PIECES) {
    let root = keep.roots.get(id)
    if ((!root || !root.parent) && look) {
      let found: THREE.Object3D | undefined
      scene.traverse((o) => { if (!found && o.userData?.editId === id) found = o })
      if (found) keep.roots.set(id, (root = found))
    }
    if (!root || !root.parent) continue
    const e = root.matrixWorld.elements
    sig = (Math.imul(sig, 31) + id.length) | 0
    for (let k = 0; k < 16; k++) sig = (Math.imul(sig, 31) + Math.round(e[k] * 1e4)) | 0
  }
  if (sig === keep.sig && now - keep.full < 60000) return
  keep.sig = sig; keep.full = now
  keep.boxes.length = 0
  WALL_INV.copy(frame.matrixWorld).invert()
  for (const id of WALL_PIECES) {
    const root = keep.roots.get(id)
    if (!root || !root.parent) continue
    let a0 = Infinity, a1 = -Infinity, front = -Infinity
    root.traverse((o) => {
      const m = o as THREE.Mesh
      const pos = m.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh ? m.geometry?.attributes.position : undefined
      if (!pos || !m.visible || m.userData?.editHandle) return
      // (a big one sampled: its outline's there in every few thousandth vertex)
      const stride = Math.max(1, Math.floor(pos.count / 3000))
      for (let i = 0; i < pos.count; i += stride) {
        WALL_V.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(WALL_INV)
        if (WALL_V.y < 0.02 || WALL_V.y > 0.75) continue
        const dx = WALL_V.x - c.at.x, dz = WALL_V.z - c.at.z
        const al = dx * c.along.x + dz * c.along.z, ly = dx * c.lay.x + dz * c.lay.z
        if (al < a0) a0 = al
        if (al > a1) a1 = al
        if (ly > front) front = ly
      }
    })
    if (front > -Infinity) keep.boxes.push({ a0, a1, front })
  }
}
/** a server's half width (their round body; their hands hanging out past it as they walk): the bar's measure */
const SERVER_HALF = 0.22
/** how far along the aisle one comes in toward the counter before what stands out from its wall, and goes back out after it */
const SQUEEZE_RAMP = 0.35
type Squeeze = { a0: number; a1: number; lay: number }
/**
 * (item 387, the owner's 「有個致命的問題動作都會深陷進模型去」) the stretches of the first counter's aisle where what stands against its wall
 * comes out into the way of those walking it (`half` across, keeping to its line `line`, the lay from the counter's middle, + toward it):
 * there they keep in toward the counter, just clear of its front if there's room; if there isn't, half way between it and the stools'
 * backs (`stools`): by the cats' stand there's 0.42 between them, a server's round body 0.44 across, and kept to the aisle's line they went
 * 0.14 to 0.2 into its lower tier and their heads through the cat on it (tests/e2e/sinkin.mjs). Each stretch with the line to keep to;
 * those that overlap one, kept to the nearer the counter
 */
function aisleSqueeze(boxes: WallKeep['boxes'], line: number, stools: number, half: number): Squeeze[] {
  const out: Squeeze[] = []
  for (const b of boxes) {
    const clear = b.front + half + 0.02
    if (clear <= line + 0.01) continue
    const lay = Math.min(clear, (b.front + stools) / 2)
    if (lay > line + 0.01) out.push({ a0: b.a0 - half, a1: b.a1 + half, lay })
  }
  out.sort((p, q) => p.a0 - q.a0)
  const merged: Squeeze[] = []
  for (const z of out) {
    const m = merged.at(-1)
    if (m && z.a0 <= m.a1 + SQUEEZE_RAMP) { m.a1 = Math.max(m.a1, z.a1); m.lay = Math.max(m.lay, z.lay) } else merged.push({ ...z })
  }
  return merged
}
/** where in the aisle one keeps to at a place along it (`a`, the first counter's): its own line, or in toward the counter by a stretch
 * (over SQUEEZE_RAMP before and after it) */
function squeezeLay(zones: Squeeze[], line: number, a: number) {
  let l = line
  for (const z of zones) {
    const k = a < z.a0 ? 1 - (z.a0 - a) / SQUEEZE_RAMP : a > z.a1 ? 1 - (a - z.a1) / SQUEEZE_RAMP : 1
    if (k > 0) l = Math.max(l, line + (z.lay - line) * Math.min(1, k))
  }
  return l
}
/** a way (the bar's frame) bent in round those stretches where it runs along the first counter's aisle (`c`): its corners where each
 * stretch's ramps begin and end, and its own points on the aisle's line in a stretch drawn in; its first point (where they are now) as
 * it is, and if that's in a stretch, a step on from it drawn in already (set off from a stool by the cats' stand, they'd have come in
 * across the whole of it, and gone into its end) */
function squeezePath(path: THREE.Vector3[], c: Counter, line: number, zones: Squeeze[]) {
  if (!zones.length || path.length < 2) return path
  const A = (v: THREE.Vector3) => (v.x - c.at.x) * c.along.x + (v.z - c.at.z) * c.along.z
  const L = (v: THREE.Vector3) => (v.x - c.at.x) * c.lay.x + (v.z - c.at.z) * c.lay.z
  const onLine = (v: THREE.Vector3) => Math.abs(L(v) - line) < 0.06
  const drawn = (a: number) => squeezeLay(zones, line, a) > line + 1e-3
  const put = (a: number, y: number) => c.at.clone().addScaledVector(c.along, a).addScaledVector(c.lay, squeezeLay(zones, line, a)).setY(y)
  const out = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i]
    if (!onLine(p) || !onLine(q)) { out.push(onLine(q) && drawn(A(q)) ? put(A(q), q.y) : q); continue }
    const ap = A(p), aq = A(q), dir = Math.sign(aq - ap) || 1
    const first = i === 1 && drawn(ap) && Math.abs(aq - ap) > 0.2
    if (first) out.push(put(ap + dir * 0.12, p.y))
    for (const a of zones.flatMap((z) => [z.a0 - SQUEEZE_RAMP, z.a0, z.a1, z.a1 + SQUEEZE_RAMP]).filter((x) => (x - ap) * dir > (first ? 0.13 : 0.01) && (aq - x) * dir > 0.01)
      .sort((x, y) => (x - y) * dir)) out.push(put(a, q.y))
    out.push(drawn(aq) ? put(aq, q.y) : q)
  }
  return out
}
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
/** the staff (the servers) drawn the boss's height, a head shorter than the customers: the boss (Roasting's BOSS_SCALE) is 0.95 tall at 1.68,
 * a figure here 0.97 tall at this and the shop's own scale of 2 */
const STAFF_SCALE = (1.05 * 0.8 * 2 * 0.95) / (0.97 * 2)
/** the rice ball in the third cook's hands (item 129): a squashed icosphere (no pole), and a band of nori round its foot */
const BALL_GEO = new THREE.IcosahedronGeometry(0.03, 1).scale(1, 0.95, 0.68)
const BALL_NORI_GEO = new THREE.BoxGeometry(0.034, 0.022, 0.044)
/** the owner's figure out serving, inside a server's frame (STAFF_SCALE): his own height (Roasting's BOSS_SCALE in the shop's frame) */
const OWNER_IN_STAFF = (1.05 * 0.8) / STAFF_SCALE
const OWNER_HAND = new THREE.Vector3()
/** the sake station's pour as it's drawn this frame (item 177): the bottle and the tokkuri's poses, and the pourer's hands in the world (on
 * while the pour's on); where the tokkuri's server holds their tray, and the way they face */
const STATION_POSE = newStationPose()
const SAKE_HANDS = { left: new THREE.Vector3(), right: new THREE.Vector3() }
const SAKE_HANDS_ON = { v: false }
/** the hands of the one filling a bowl of rice or of soup (items 205, 206: SideBowls' poses), in the world, and whether one's filling now */
const BOWL_HANDS = { left: new THREE.Vector3(), right: new THREE.Vector3() }
const BOWL_HANDS_ON = { v: false }
/** (item 387) the plater's hands stirring the soup (the world's): the right on the dipper over the pot's near half, the left on its rim */
const STIR_HANDS = { left: new THREE.Vector3(), right: new THREE.Vector3() }
const STIR_HANDS_ON = { v: false }
/** (item 392) the plater's hands grating daikon at the rice-ball counter's grater (the world's): the right on the daikon, up and down the
 * grater, the left holding the grater's near end */
const GRATE_HANDS = { left: new THREE.Vector3(), right: new THREE.Vector3() }
const GRATE_ON = { v: false }
/** a customer's bowls left at the serving counter for a server (the counter's own frame: its left end, clear of the takeaways in its middle
 * and the sake at its right), and where the one setting them down or taking them up stands */
// (0.04 further left since the counter's 0.1 longer (items 254, 286))
const BOWL_PASS = { rice: new THREE.Vector3(-0.39, SERVE_TOP, -0.035), soup: new THREE.Vector3(-0.26, SERVE_TOP, -0.035), front: new THREE.Vector3(-0.32, 0, 0.47) }
const RICE_LEN = beatsLength(RICE_BEATS), SOUP_LEN = beatsLength(SOUP_BEATS)
/** seconds: the bowls set down at the counter; taken up onto a tray; set down at a place */
const BOWL_PUT_S = 0.5, BOWL_UP_S = 0.45, BOWL_SET_S = 0.6
/** (item 207) how many customers' bowls wait at the counter at most (in rows at its left end: the counter's frame, z of each), and how many
 * sets a server takes out on one tray (the second to a seat along the same counter after the first): one at a time, the plater waited for
 * each customer's to be carried out before he could fill the next, and in a rush those who'd asked for rice and soup sat on half an hour
 * after their fish, waiting for them */
const PASS_MAX = 2
/** (item 207) how long (the shop's minutes) customers' bowls wait at the counter before they're taken ahead of food ready at the plating place */
const BOWLS_LATE = 6
const PASS_Z = [-0.07, 0.08]
const TRAY_SETS = 2
const SAKE_TRAY = new THREE.Vector3()
const SAKE_TRAY_YAW = { v: 0 }
const OWNER_BONE = new THREE.Vector3()
/** the owner's tray: a server's rimmed lacquered one (scene/trayGeometry, item 249: a flat black disc, it read as "a black plate") */
const OWNER_TRAY_GEO = rimmedTray(0.15, 0.024, 0.008)
/** the owner out serving (no server hired): his figure with a rock and a bob as he walks, and a lacquered tray held in front */
// (item 374: never drawn again with the bar. His rock and bob by how far he's gone since the last frame, eased in and out as he sets off
// and stops: a walking flag the bar kept for him (and each server, and the plater), set as they set off and stopped, had his figure drawn
// again each time, and the rock came and went at once)
const OWNER_AT = new THREE.Vector3()
const OwnerWalker = memo(OwnerWalkerImpl)
function OwnerWalkerImpl() {
  const g = useRef<THREE.Group>(null)
  const last = useRef<THREE.Vector3 | null>(null)
  const pace = useRef(0)
  const tray = useRef<THREE.Mesh>(null)
  /** his hands (the model's own nodes) and where they rest, found once he's drawn */
  const hands = useRef<{ node: THREE.Object3D; at: THREE.Vector3; q: THREE.Quaternion; upper: boolean }[] | null>(null)
  useFrame(({ clock }, delta) => {
    const o = g.current
    if (!o) return
    const t = clock.elapsedTime, dt = Math.min(0.1, delta)
    // (how fast he's going, 0 to 1 at a walk (as the staff's figures have it); from nothing while he's out of sight, not from where he was
    // put away)
    if (o.parent && !o.parent.visible) { last.current = null; pace.current = 0 }
    else {
      const at = o.getWorldPosition(OWNER_AT)
      const sp = last.current ? Math.hypot(at.x - last.current.x, at.z - last.current.z) / Math.max(dt, 1e-3) : 0
      ;(last.current ??= new THREE.Vector3()).copy(at)
      pace.current += (Math.min(1, sp / 0.6) - pace.current) * Math.min(1, dt * 8)
    }
    const k = pace.current
    o.rotation.z = Math.sin(t * 9) * 0.05 * k
    o.position.y = Math.abs(Math.sin(t * 9)) * 0.014 * k
    // (sweeping up broken glass, or the broom carried: the tray put by)
    // (nor while he's down sweeping or wiping the floor (item 116: the tray showed in his hands as he wiped, a black disc on the floor))
    // (nor on an errand, the till, the skewers, the sink or sweeping up, there and back (trayDown, item 249: back from sweeping up broken glass
    // he had it in his hands again, an empty black disc, "a black plate"))
    if (tray.current) tray.current.visible = !o.parent?.userData.broom && o.parent?.userData.scrub === undefined && o.parent?.userData.sweep === undefined
      && o.parent?.userData.floorWipe === undefined && o.parent?.userData.washHands === undefined && o.parent?.userData.handsAt === undefined
      && !o.parent?.userData.trayDown
    // (sweeping: both his hands on the broom's handle, going with it from side to side, as a server's are (the owner's, 2026-11-11: his hands
    // stood still at his sides while the broom swept); back where they rest after)
    if (!hands.current) {
      const l = o.getObjectByName('BossHandL'), r = o.getObjectByName('BossHandR')
      // (each hand's palm, where it's drawn, from its bone's origin (in the bone's parent's frame): the bone's origin isn't in the hand, so it's
      // the palm that's put on the handle (the owner's, 2026-11-12: set by its origin, his hands stood out wide at his sides, off the broom).
      // Worked out each frame he's at a job (below), not kept from the first)
      if (l && r && l.parent && r.parent) hands.current = [l, r].map((node, k) => ({ node, at: node.position.clone(), q: node.quaternion.clone(), upper: k === 1 }))
    }
    const sweep = o.parent?.userData.sweep as number | undefined
    // (wiping a spill off the floor after (item 164): stooped as for the sweep, the broom put by, a hand on the cloth)
    const floorWipe = o.parent?.userData.floorWipe as number | undefined
    const wipeAt = o.parent?.userData.wipeAt as [number, number, number] | undefined
    // (washing up at the sink (item 103): leant a little over the basin, both hands down in it, the right scrubbing round on the plate)
    const scrub = o.parent?.userData.scrub as number | undefined
    // (washing a plate up by hand (item 174): each hand where the washing has it, in the world: the left on the plate, the right with the sponge)
    // (or both at a job's places in the world: the open sake bottle as he pours a customer's tokkuri at the sake station (item 177))
    const washHands = (o.parent?.userData.washHands ?? o.parent?.userData.handsAt) as { left: THREE.Vector3; right: THREE.Vector3 } | undefined
    // (stooped over the small broom while he sweeps, upright after)
    o.rotation.x += ((sweep !== undefined || floorWipe !== undefined ? OWNER_BEND : scrub !== undefined || washHands ? OWNER_BEND * 0.35 : 0) - o.rotation.x) * 0.2
    const posing = sweep !== undefined || scrub !== undefined || floorWipe !== undefined || !!washHands
    // (each hand's palm, where it's drawn, from its bone's origin, in the bone's parent's frame: worked out afresh each frame he's at a job,
    // his whole figure's matrices and its skin's brought up to date first (item 174: worked out once, as he came to a job and leant in, it
    // came out a hand's width off, and stayed so: his hands a hand's width off the plate and the sponge, the broom's handle, the cloth))
    if (posing && hands.current) { o.updateWorldMatrix(true, false); o.updateMatrixWorld(true) }
    if (hands.current) for (const h of hands.current) {
      if (!posing || !h.node.parent) { h.node.position.copy(h.at); h.node.quaternion.copy(h.q); continue }
      const parent = h.node.parent
      const palm = parent.worldToLocal(h.node.localToWorld(drawnCentre(o, h.node))).sub(parent.worldToLocal(h.node.getWorldPosition(OWNER_BONE)))
      if (washHands) {
        h.node.position.copy(parent.worldToLocal(OWNER_HAND.copy(h.upper ? washHands.right : washHands.left))).sub(palm)
        continue
      }
      if (scrub !== undefined) {
        const k = scrub * Math.PI * 10
        OWNER_HAND.set(h.upper ? 0.09 + Math.cos(k) * 0.035 : -0.08, 0.36 + (h.upper ? Math.sin(k) * 0.02 : 0), 0.3 + (h.upper ? Math.sin(k) * 0.03 : 0))
        h.node.position.copy(parent.worldToLocal(o.localToWorld(OWNER_HAND))).sub(palm)
        continue
      }
      if (floorWipe !== undefined) {
        // (his own frame is the server's he stands in for, scaled up to his height: the cloth's place brought into it)
        const w = floorWipePose(OWNER_HAND.set(...(wipeAt ?? [0.05, 0.004, 0.62])).divideScalar(OWNER_IN_STAFF))
        h.node.position.copy(parent.worldToLocal(o.localToWorld(OWNER_HAND.copy(h.upper ? w.right : w.left)))).sub(palm)
        continue
      }
      const p = ownerSweepPose(sweep!)
      h.node.position.copy(parent.worldToLocal(o.localToWorld(OWNER_HAND.copy(h.upper ? p.upper : p.lower)))).sub(palm)
    }
  })
  return (
    <group ref={g}>
      <group scale={OWNER_IN_STAFF}><BossModel /></group>
      {/* (the broom, when he sweeps up broken glass in a server's stead) */}
      <SweepBroom owner />
      <mesh ref={tray} position={[HELD_AT[0], HELD_AT[1] - 0.003, HELD_AT[2]]} geometry={OWNER_TRAY_GEO}>
        <meshToonMaterial color="#3a1a14" />
      </mesh>
    </group>
  )
}
/** the staff's door, along the first counter's wall: where the koi print hung, a little along from the bamboo in the corner (the owner's) */
const STAFF_DOOR_AT = -3.55
/** the koi print, moved (the owner's): on the toilets' wall past the drinks fridges, on the plain plaster there; once only, the same array
 * each time (the wall's memo compares it) */
const koiHangs = new Map<string, { z: number; print: 'koi' }[]>()
// (by the men's toilet now, on the wall between the drinks fridges and its doorway, over the supplies' stack (the owner's, 2026-11-11): it hung on
// the fridges' other side)
function koiHang(clear: [number, number][], from: number, door?: number) {
  const g0 = door === undefined ? undefined : door - WC_W - 0.12
  const below = g0 === undefined ? [] : clear.filter((r) => r[1] <= g0)
  const lo = clear.length ? Math.min(...clear.map((r) => r[0])) : from + 1
  const z = g0 !== undefined && below.length ? (Math.max(...below.map((r) => r[1])) + g0) / 2 : Math.max(from + 0.4, lo - 0.55)
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
/** (item 208) the stock keeper's ways for a bin's bag (StockerImpl's binWays), and how long he's gone down the stair with it (the shop's seconds) */
type BinWays = { toBin: THREE.Vector3[]; toDoor: THREE.Vector3[]; door: THREE.Vector3; mouths: Record<BinKind, THREE.Vector3>; scale: number }
const BIN_AWAY_S = 6
/** the stock keeper's figure (in the bar's frame, as the customers' are): they step round him as they do the servers (the owner's item 45) */
const STOCKER_FIG: { o: THREE.Object3D | null } = { o: null }
// (he walks by his own frame loop: drawn again only if he or the room changes, not with every redraw of the bar)
/** a washroom's paper towels or soap down to where they're topped up, with a spare in stock for it: the stock keeper goes round to it */
const wcLow = (w: 'm' | 'f') => {
  const t = TOILETS[w]
  return (t.towels < TOWEL_REFILL_AT && SUPPLIES.has(TOWEL) > 0) || (t.soap < SOAP_REFILL_AT && SUPPLIES.has(SOAP) > 0)
}
/** whether it's a roll he's going to change there (else he's topping up the towels or the soap) */
const rolling = (w: 'm' | 'f') => TOILETS[w].room.paper < ROLL_LOW && SUPPLIES.has(ROLL) > 0
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
  const held = useRef<{ crate: THREE.Object3D | null; roll: THREE.Object3D | null; box: THREE.Object3D | null; bag: THREE.Group | null }>({ crate: null, roll: null, box: null, bag: null })
  const scene = useThree((st3) => st3.scene)
  // (a bin's bag tied up and carried out, and the new one brought back (item 208): copies of the sink's own)
  const bags = useBinBags()
  const statusEl = useRef<HTMLSpanElement>(null)
  const c1 = counters[1]
  const home = useMemo(() => {
    const last = fridges[fridges.length - 1]
    // (out from the crates and the cartons into the aisle (the owner's: stood against them, he read as staring at the wall), clear of the
    // fridge's front and its doors, a little along from it (the owner's: squeezed half into the gap by it). The wall's at farOf (the crates
    // 0.32 in from it): a move into the room is +lay (the last move went the other way, and stood him in the middle of the beer crates: the
    // owner saw him sunk in a red box, 2026-11-10))
    return c1.at.clone().addScaledVector(c1.along, last.z - FRIDGE.W / 2 - 0.42).addScaledVector(c1.lay, farOf(c1) + 0.32 + 0.95)
  }, [c1, fridges])
  const seats = useMemo(() => seatsOf(counters), [counters])
  const wcs = useMemo(() => toiletsOf(counters), [counters])
  /** his way out into the side counter's aisle, across from his place */
  const homeAisle = useMemo(() => c1.at.clone().addScaledVector(c1.along, home.clone().sub(c1.at).dot(c1.along) / c1.along.lengthSq()).addScaledVector(c1.lay, -AISLE), [home, c1])
  const st = useRef({ phase: 'idle' as 'idle' | 'take' | 'go' | 'work' | 'back', t: 0, chore: null as StockChore, path: [] as THREE.Vector3[], len: 0, d: 0,
    pos: home.clone(), yaw: 0, check: 0, done: false,
    /** (a bin's bag, item 208) which part of the round he's at (0 to the bins, 1 out to the staff door with it, 2 gone down the stair, 3 back
     * to the bins with a new one), his ways, and what's in his hands */
    leg: 0, ways: null as BinWays | null, bag: null as BinKind | 'new' | null })
  /** (item 208) his ways for a bin's bag, in the bar's frame on the floor: from his place along the aisles to the first counter's gate, through
   * it into the kitchen and across to before the bins; and from them back out through the gate, along the aisle to the staff door and in
   * through it, to the stair behind (the rubbish goes down it to be put out). Null while the bins or the door aren't there to be found */
  const binWays = (): BinWays | null => {
    const o = g.current, par = o?.parent, route = KITCHEN_ROUTE.route
    if (!o || !par || !route) return null
    let front: THREE.Object3D | null = null, mouth: THREE.Object3D | null = null, recMouth: THREE.Object3D | null = null
    scene.traverse((q) => {
      if (!front && q.name === 'SinkBinFront') front = q
      if (!mouth && q.name === 'SinkBinTop') mouth = q
      if (!recMouth && q.name === 'SinkBinRecTop') recMouth = q
    })
    const sd = scene.getObjectByName('staff-door')
    if (!front || !mouth || !recMouth || !sd) return null
    const local = (q: THREE.Object3D) => par.worldToLocal(q.getWorldPosition(new THREE.Vector3())).setY(0)
    const c0 = counters[0], gate = gateOf(c0, BAR_GATES[0]).mid.clone().setY(0)
    const gateIn = gate.clone().addScaledVector(c0.lay, 0.45), gateOut = gate.clone().addScaledVector(c0.lay, -aisleOf(c0))
    const bin = local(front)
    const inner = route(gateIn, bin)
    if (!inner.length || inner[inner.length - 1].distanceTo(bin) > 0.02) inner.push(bin.clone())
    const toBin = [home.clone(), homeAisle.clone(), aisleCornerOf(counters, c1), gateOut.clone(), gate.clone(), gateIn.clone(), ...inner.slice(1)]
    sd.updateWorldMatrix(true, false)
    const dW = sd.getWorldPosition(new THREE.Vector3()), room = sd.localToWorld(new THREE.Vector3(-1, 0, 0)).sub(dW).setY(0).normalize()
    const at = (k: number) => par.worldToLocal(dW.clone().addScaledVector(room, k)).setY(0)
    const toDoor = [...[...inner].reverse(), gateIn.clone(), gate.clone(), gateOut.clone(), aisleCornerOf(counters, c1), at(1.6), at(0.75), at(0), at(-0.6)]
    // (the bags in his hands at the sink's own size: his figure's drawn smaller than the room)
    const sk = (mouth as THREE.Object3D).getWorldScale(new THREE.Vector3()).x, gs = o.getWorldScale(new THREE.Vector3()).x
    return { toBin, toDoor, door: at(0), mouths: { rubbish: local(mouth), recycle: local(recMouth) }, scale: gs > 0 ? sk / gs : 1 }
  }
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __stocker?: typeof st }).__stocker = st
  // (his walk in as the shop opens and home as it shuts (commuteWalk): out along the side counter's aisle, round the corner, to the front door)
  const cm = useRef<{ trip: Trip | null; arrived: boolean }>({ trip: null, arrived: false })
  useEffect(() => () => { SHOP.walking.delete(who.id) }, [who.id])
  useFrame((_, dt0) => {
    // (worn out, at half pace (the owner's))
    const dt = Math.min(dt0, 0.1) * paceOfStaff(who.id)
    const s = st.current
    const o = g.current
    if (o) {
      const c = cm.current
      // (his status put away while he walks in or home: shown again below once he's at work)
      if ((!c.arrived || SHOP.leaving) && statusEl.current) statusEl.current.style.visibility = 'hidden'
      const wayFrom = (from: THREE.Vector3) => {
        // (on out through the sliding door's open way and down its steps (item 410: a step past the door, through its shut middle))
        return [from.clone(), homeAisle.clone(), aisleCornerOf(counters, c1), doorOf(counters), ...doorOutOf(counters)]
      }
      const apply = (tr: Trip) => {
        const pose = tripStep(tr, dt, 1.0, (v) => (o.parent ? o.parent.localToWorld(v.clone()) : v.clone()))
        s.pos.copy(pose.p)
        if (pose.yaw !== null) s.yaw = turnToward(s.yaw, pose.yaw, dt)
        o.position.copy(s.pos)
        // (down on the genkan's stone as he crosses it, as the customers are (item 203: a step's height over it))
        o.position.y += genkanY(counters, s.pos)
        o.rotation.y = s.yaw
        o.visible = pose.shown
        o.userData.fade = tr.done ? 1 : pose.vis
        o.userData.nod = pose.nod
        o.userData.stretch = pose.stretch
      }
      if (!c.arrived) {
        if (!c.trip) {
          if (performance.now() - SHOP.openedAt < 4000) c.trip = makeTrip(who.id, 'in', wayFrom(home).reverse(), delayOf(who.id, SHOP.day + 0.5) * 0.8 + 1.2, paceOf(who.id))
          else { c.arrived = true; clockIn(who.id, minutesNow()) }
        }
        if (c.trip) {
          apply(c.trip)
          if (!c.trip.done) return
          c.trip = null
          c.arrived = true
          s.pos.copy(home)
        }
      }
      // (shut: once back from what he was about, finishing up, then home)
      if (SHOP.leaving) {
        SHOP.walking.add(who.id)
        if (s.phase === 'idle' || c.trip) {
          if (!c.trip) c.trip = makeTrip(who.id, 'out', wayFrom(s.pos), delayOf(who.id, SHOP.day), paceOf(who.id))
          apply(c.trip)
          if (c.trip.done) SHOP.walking.delete(who.id)
          return
        }
      }
    }
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
    idleTick(who.id, s.phase === 'idle' && !SHOP.leaving, dt, true)
    if (s.phase === 'idle') {
      s.check += dt
      s.t += dt
      // (standing by: facing the room most of the while, now and then turned to the stock behind him, bent over his clipboard counting it)
      // (slacking at his game instead, past a while with nothing to do: the only one who does (the owner's), his status plate put away for
      // its own badge over him)
      const slacking = activityOf(STAFF_IDLE.get(who.id)) === 'slack'
      const counting = !slacking && s.t % 14 > 9
      const face = counting ? Math.atan2(c1.lay.x, c1.lay.z) : Math.atan2(-c1.lay.x, -c1.lay.z)
      s.yaw += Math.atan2(Math.sin(face - s.yaw), Math.cos(face - s.yaw)) * Math.min(1, dt * 4)
      if (g.current) { g.current.userData.lean = counting ? 0.18 : 0; g.current.userData.prep = undefined }
      if (s.check > 1) {
        s.check = 0
        // (a case ordered from the liquor shop of whatever the back, with what's on its way, is running out of, one a look (item 243: it came
        // that moment); brought round DELIVERY_MIN later, paid for then)
        const ids = FRIDGE_UNITS.flatMap((u) => u.shelves.flatMap((sh) => sh.ids))
        const want = drinksToOrder(DRINK_BACK.back, ids, DRINK_COMING.list)[0]
        if (want && SHOP_PURSE.cash() >= caseCost(want)) {
          DRINK_COMING.list = orderCase(DRINK_COMING.list, want, getClock().day * 1440 + getClock().minute)
          DRINK_BACK.ver++
        }
        const busy = (w: 'm' | 'f') => TOILETS[w].passing > 0 || TOILETS[w].inside > 0
        const next = stockerChore({
          rolls: { m: TOILETS.m.room.paper, f: TOILETS.f.room.paper }, wcBusy: { m: busy('m'), f: busy('f') },
          fridgeShort: fridges.map((f) => emptyFillable(placesOf(f.n), FRIDGE_UNITS[f.n].shelves.map((sh) => sh.ids), DRINK_BACK.back)),
          boxes: seats.map((_, i) => tissuesAt(i)), seatTaken: (n) => SEATS_TAKEN.has(n), spares: Math.max(0, SUPPLIES.has(TISSUE)),
          // (a roll changed only with a spare in stock; and the washrooms' paper towels and soap topped up from theirs, on the same round)
          rollSpares: Math.max(0, SUPPLIES.has(ROLL)), wcLow: { m: wcLow('m'), f: wcLow('f') },
          // (a bin by the sink full enough to empty (item 208), none of its bags out already)
          bin: SINK_BIN.out ? null : binToEmpty(SINK_BIN.b),
        })
        const ways = next?.kind === 'bin' ? binWays() : null
        if (next && !(next.kind === 'roll' && !wcs) && !(next.kind === 'bin' && !ways)) {
          s.chore = next
          s.done = false
          if (next.kind === 'drinks') set([home.clone(), fridges.find((f) => f.n === next.unit)!.front.clone()])
          else if (next.kind === 'bin') {
            s.ways = ways
            s.leg = 0
            set(ways!.toBin)
            if (held.current.bag) held.current.bag.scale.setScalar(ways!.scale)
          }
          else if (next.kind === 'roll') {
            const w = wcs![next.who]
            STOCKER_WC.who = next.who
            // (in at the door, past the washstand, round the corner to the toilet's paper)
            set([home.clone(), homeAisle.clone(), w.aisle.clone(), w.front.clone(), w.inside.clone(), w.turn.clone(), w.stall.clone()])
          } else {
            const seat = seats[next.seat]
            // (beside the stool, on the drawer's side (the customer's left, + along), facing the bar)
            const beside = seat.aisle.clone().lerp(seat.stool, 0.55).addScaledVector(seat.along, 0.3)
            set([home.clone(), homeAisle.clone(), ...(seat.counter === 1 ? [] : [aisleCornerOf(counters, c1)]), seat.aisle.clone(), beside])
          }
          // (the drinks: first bent to the cartons for a case, then off with it)
          if (next.kind === 'drinks') { s.phase = 'take'; s.t = 0 } else { s.phase = 'go' }
        }
      }
    } else if (s.phase === 'take') {
      s.t += dt
      const face = Math.atan2(c1.lay.x, c1.lay.z)
      s.yaw += Math.atan2(Math.sin(face - s.yaw), Math.cos(face - s.yaw)) * Math.min(1, dt * 6)
      if (g.current) g.current.userData.lean = 0.4 * Math.sin(Math.min(1, s.t / 0.9) * Math.PI)
      if (s.t > 0.9) { if (g.current) g.current.userData.lean = 0; s.phase = 'go'; s.t = 0 }
    } else if (s.phase === 'go') {
      if (walk()) { s.phase = 'work'; s.t = 0 }
    } else if (s.phase === 'work' && c) {
      s.t += dt
      if (c.kind === 'drinks') {
        const f = fridges.find((x) => x.n === c.unit)!
        s.yaw = Math.atan2(f.at.x - s.pos.x, f.at.z - s.pos.z)
        // (its door open while he fills it: his own mark, as the bar counts those at it afresh each frame (a count added to here was lost to
        // that, and he filled it through the shut glass))
        FRIDGE_STATE[c.unit].stocker = true
        if (s.t > 1.6) {
          const run = restockRun(placesOf(c.unit), FRIDGE_UNITS[c.unit].shelves.map((sh) => sh.ids), DRINK_BACK.back, STOCK_CARRY)
          run.rows.forEach((r, i) => { FRIDGE_STOCK.units[c.unit][i] = r; FRIDGE_STOCK.counts[c.unit][i] = run.counts[i] })
          DRINK_BACK.back = run.back
          DRINK_BACK.ver++
          FRIDGE_STOCK.ver++
          bottleClink(false, FRIDGE_AT[c.unit])
          FRIDGE_STATE[c.unit].stocker = false
          s.phase = 'back'
        }
      } else if (c.kind === 'roll') {
        // (in, the door shut behind him: the old roll off the holder, a new one on, from the spares in stock; and the towel box and the soap
        // topped up from theirs while he's there)
        if (s.t > 2.4 && !s.done) {
          s.done = true
          const t = TOILETS[c.who]
          if (t.room.paper < ROLL_LOW && SUPPLIES.take(ROLL, 1)) {
            t.room = newRoll(t.room)
            t.rollAt = performance.now()
          }
          if (topUp(t.towels, TOWEL_FULL, TOWEL_REFILL_AT, 1).level !== t.towels && SUPPLIES.take(TOWEL, 1)) t.towels = TOWEL_FULL
          if (topUp(t.soap, SOAP_FULL, SOAP_REFILL_AT, 1).level !== t.soap && SUPPLIES.take(SOAP, 1)) t.soap = SOAP_FULL
        }
        if (s.t > 2.8) s.phase = 'back'
      } else if (c.kind === 'bin') {
        const w = s.ways!
        if (s.leg === 0 || s.leg === 3) {
          // (at the bins, bent to the one he's come for, its lid held up: the full bag lifted out and its neck tied (0), or the new one shaken
          // out and set in over its rim (3))
          const m = w.mouths[c.which]
          s.yaw = Math.atan2(m.x - s.pos.x, m.z - s.pos.z)
          SINK_BIN.lids[c.which].until = performance.now() + 450
          if (g.current) g.current.userData.lean = 0.38 * Math.sin(Math.min(1, s.t / 1.4) * Math.PI)
          if (s.leg === 0 && s.t > 0.7 && !s.done) {
            s.done = true
            SINK_BIN.b = bagOut(SINK_BIN.b, c.which)
            if (c.which === 'rubbish') SINK_BIN.sticks = 0
            SINK_BIN.out = c.which
            s.bag = c.which
          }
          // (with customers about, not out through the staff door with it (item 318): turned to the sink's cupboard beside the bins, the bag
          // stowed in it and a new one taken out; with none, out by the staff door as before)
          if (s.leg === 0 && s.t > 1.4) {
            if (bagGoes(!SHOP.leaving) === 'underSink') { s.leg = 4; s.t = 0 }
            else { s.leg = 1; set(w.toDoor); s.phase = 'go' }
          }
          if (s.leg === 3 && s.t > 0.7 && s.bag) { s.bag = null; SINK_BIN.out = null }
          if (s.leg === 3 && s.t > 1.3) { if (g.current) g.current.userData.lean = 0; set(w.toBin); s.phase = 'back' }
        } else if (s.leg === 4) {
          // (bent to the cupboard under the sink, the other side of the bins from the recycling's (the rubbish bin stands against the sink): the
          // full bag in, a new one out of the roll kept there; then back to the bin to set it in (leg 3))
          const toSink = w.mouths.rubbish.clone().sub(w.mouths.recycle).setY(0)
          if (toSink.lengthSq() > 1e-6) s.yaw += Math.atan2(Math.sin(Math.atan2(toSink.x, toSink.z) - s.yaw), Math.cos(Math.atan2(toSink.x, toSink.z) - s.yaw)) * Math.min(1, dt * 8)
          if (g.current) g.current.userData.lean = 0.5 * Math.sin(Math.min(1, s.t / 1.1) * Math.PI)
          if (s.t > 0.55 && s.bag && s.bag !== 'new') { SINK_BIN.stowed[s.bag] += 1; s.bag = 'new' }
          if (s.t > 1.1) { if (g.current) g.current.userData.lean = 0; s.leg = 3; s.t = 0 }
        } else if (s.leg === 1) {
          // (through the staff door with it and down the stair behind, to put it out with the shop's rubbish)
          s.leg = 2
          s.t = 0
        } else if (s.leg === 2 && s.t > BIN_AWAY_S) {
          // (back up with a new bag for it, out through the door again and back to the bins)
          s.bag = 'new'
          s.leg = 3
          set([...w.toDoor].reverse())
          s.phase = 'go'
        }
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
      if (s.phase === 'back') { s.d = 0 }
    } else if (s.phase === 'back') {
      if (walk()) {
        s.phase = 'idle'
        s.t = 0
        s.pos.copy(home)
        if (c?.kind === 'roll') STOCKER_WC.who = null
        if (c?.kind === 'bin') { s.ways = null; s.leg = 0 }
        s.chore = null
      }
    }
    // (on his way to a chore or back from it, for his figure: his clipboard put by as he goes (item 374: it was his state, and all of him was
    // drawn again each time he set off or stopped))
    if (g.current) g.current.userData.walking = s.phase === 'go' || s.phase === 'back'
    // (at a toilet's door: near enough to have it open; in, past it)
    if (c?.kind === 'roll' && wcs) {
      const w = wcs[c.who]
      STOCKER_WC.near = s.pos.distanceTo(w.front) < 1.3 && !(s.phase === 'work')
      STOCKER_WC.inside = s.phase === 'work'
    } else { STOCKER_WC.near = false; STOCKER_WC.inside = false }
    let fade = 1
    if (c?.kind === 'bin' && s.ways) {
      const toDoor = s.pos.distanceTo(s.ways.door)
      if ((s.leg === 1 || s.leg === 3) && toDoor < 1.6) STAFF_DOOR_HOLD.until = performance.now() + 1200
      // (past the door, in the stair: fading out going in, in coming back out)
      if ((s.leg === 1 && s.phase === 'go' && s.len - s.d < 0.6) || (s.leg === 3 && s.phase === 'go' && s.d < 0.6)) fade = Math.max(0, Math.min(1, (s.leg === 1 ? s.len - s.d : s.d) / 0.6))
      if (s.leg === 2 || (s.leg === 1 && s.phase === 'work')) fade = 0
    }
    if (g.current) {
      g.current.position.copy(s.pos)
      // (turned toward the way he's to face a frame at a time: set at once, he spun round at each corner and at the fridge, 130° in a frame)
      g.current.rotation.y = turnToward(g.current.rotation.y, s.yaw, dt)
      // (seen all the way in the toilet's stall changing the roll, as the customers are since the owner's 2026-11-12 (item 203: he alone still
      // faded out in there); faded only through the staff door, taking a bin's bag out (item 208))
      g.current.userData.fade = fade
      g.current.visible = fade > 0.02
    }
    // (in his arms: a case of drinks carried out; a new roll; a new box of tissues; back empty-handed)
    const out = s.phase === 'go' || s.phase === 'work'
    const h = held.current
    if (h.crate) h.crate.visible = (out || (s.phase === 'take' && s.t > 0.45)) && c?.kind === 'drinks'
    // (what he's at, over his head (the owner's: standing about, nobody could tell): as words, the run's share done while it's under way)
    const el = statusEl.current
    if (el) {
      const zh = document.documentElement.lang !== 'ja' && document.documentElement.lang !== 'en', ja = document.documentElement.lang === 'ja'
      const tl3 = (a: string, b: string, e: string) => (ja ? b : zh ? a : e)
      const pct = (k: number) => ` ${Math.round(Math.min(1, k) * 100)}%`
      const slacking = s.phase === 'idle' && activityOf(STAFF_IDLE.get(who.id)) === 'slack'
      const text = s.phase === 'idle' ? (s.t % 14 > 9 && !slacking ? tl3('庫存清點中', '在庫チェック中', 'Counting stock') : tl3('待命', '待機中', 'Standing by'))
        : s.phase === 'take' ? tl3('取貨中', '荷出し中', 'Picking up a case')
        : s.phase === 'back' ? tl3('返回待命', '戻り中', 'Heading back')
        : c?.kind === 'drinks' ? (s.phase === 'work' ? tl3('補貨中', '補充中', 'Restocking') + pct(s.t / 1.6) : tl3('搬運飲料中', '飲み物運搬中', 'Carrying drinks'))
        : c?.kind === 'roll' ? (rolling(c.who) ? tl3('更換衛生紙', 'トイレ紙交換', 'Changing the toilet roll') : tl3('補充洗手間用品', 'トイレ用品の補充', 'Restocking the washroom'))
          + (s.phase === 'work' ? pct(s.t / 2.8) : '')
        : c?.kind === 'bin' ? (s.leg === 3 ? tl3('換新垃圾袋', 'ゴミ袋の交換', 'Putting in a new bag')
          : s.leg === 4 ? tl3('垃圾袋收到水槽下', 'ゴミ袋をシンク下へ', 'Stowing the bag under the sink')
          : c.which === 'rubbish' ? tl3('倒垃圾', 'ゴミ出し', 'Taking out the rubbish') : tl3('倒資源回收', '資源ごみ出し', 'Taking out the recycling'))
        : tl3('補充面紙', 'ティッシュ補充', 'Refilling tissues') + (s.phase === 'work' ? pct(s.t / 2.0) : '')
      if (el.textContent !== text) el.textContent = text
      el.style.visibility = slacking || g.current?.visible === false || (g.current?.userData.fade ?? 1) < 0.5 ? 'hidden' : ''
    }
    if (h.roll) h.roll.visible = out && c?.kind === 'roll' && !s.done && rolling(c.who)
    if (h.box) h.box.visible = out && c?.kind === 'tissue' && !s.done
    // (a bin's bag: the full one tied up and carried out, the new one brought back folded (item 208))
    if (h.bag) {
      h.bag.visible = c?.kind === 'bin' && s.bag !== null
      // (the group's three, in the order they're hung in it: the rubbish's, the recycling's, the new one)
      const [rub, rec, fresh] = h.bag.children
      if (rub) rub.visible = s.bag === 'rubbish'
      if (rec) rec.visible = s.bag === 'recycle'
      if (fresh) fresh.visible = s.bag === 'new'
    }
  })
  // (shut, nothing of his left about: no drawer held out, no toilet waiting on him)
  useEffect(() => () => {
    STOCKER_WC.who = null; STOCKER_WC.near = false; STOCKER_WC.inside = false; DRAWER_HELD.clear(); for (const f of FRIDGE_STATE) f.stocker = false
    // (a bin's bag he had out: put back in as it was (gone home or let go mid-round), the bin as he left it)
    SINK_BIN.out = null
  }, [])
  return (
    <group ref={(o) => { g.current = o; STOCKER_FIG.o = o; if (o) FIGURES.set(o, 'other') }} position={home} scale={STAFF_SCALE} userData={{ staffId: who.id, role: 'stock' }}>
      <BlobShadow r={0.17} />
      <StaffFigure id={who.id} role="stock" look={who.look} />
      <Html position={[0, 1.95, 0]} center zIndexRange={zr(19, 9)} style={NO_POINTER}>
        <span ref={statusEl} className="staff-status" />
      </Html>
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
      {/* (a bin's bag by its knot in his hands, hanging below them; or the new one folded (item 208)) */}
      <group ref={(o) => { held.current.bag = o }} position={[0, HELD_AT[1] + 0.02, HELD_AT[2]]} visible={false}>
        <primitive object={bags.rubbish} />
        <primitive object={bags.recycle} />
        <primitive object={bags.fresh} />
      </group>
    </group>
  )
}

/**
 * The shop's front over the way in (item 300, the owner's, 2026-11-17: 「玄關門的門改成，這樣。」「指屋頂」, after a picture of an izakaya's
 * front: a wooden eave over its door, a big red lantern hung under it in the middle, lit menu boards either side, wooden lattice). The
 * model (blender/facade.py, in the doorway's own frame): the head beam over the doorway on a post (the noren's rod just under it); the eave
 * low over it, tiled, its eave-end tiles along its edge, its rafters out from the wall, a strip of lattice along the wall under it; the band
 * on the wall over the eave (over it and not under it, as the picture's are: this camera never looks up, and from over it an eave hides
 * what's under it), from one end of the eave to the other, its middle bay lattice, and either side of it two rows of little lanterns (item
 * 349, the owner's 「有缺口、牌子換成一排排的燈籠」: they were the menu's boards, and the band stopped short of the eave's end); the bar the red
 * and the grill's lanterns hang from. The lanterns' paper lit here with the door lanterns (the door's switch: no light of their own (rule 6)).
 */
const FACADE_URL = import.meta.env.BASE_URL + 'models/facade.glb'
useGLTF.preload(FACADE_URL)
/** the band's little lanterns' paper (item 349, the owner's 「牌子換成一排排的燈籠」: the menu's boards gone for two rows of them): lit with
 * the door lanterns (their switch, their breath), no light of its own (rule 6); made at load, its colour all that changes */
const LANTERN_PAPER = new THREE.MeshBasicMaterial({ toneMapped: false })
/** (item 385, the owner's 「燈籠要有些黃光」) the warm light the band's lanterns throw on the dark board behind them: a soft yellow halo round
 * each (blender/facade.py's FacadeLanternGlow), laid on as light (added, not painted over), as strong as they're lit */
const LANTERN_GLOW = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0,
  side: THREE.DoubleSide })
function FacadeModel() {
  const gltf = useGLTF(FACADE_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    const toon = (src0: THREE.Material) => {
      const src = src0 as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the lattice's gaps cut out (tested, not blended), seen from either side, as the other lattices are)
        // (the lanterns' paper lit as the door's lanterns are (item 349); the tiles' painted relief given its normal map too (item 357))
        if (/LanternPaper/.test(src.name)) {
          LANTERN_PAPER.map = src.map ?? null
          LANTERN_PAPER.needsUpdate = true
          t = LANTERN_PAPER
        } else if (/LanternGlow/.test(src.name)) {
          LANTERN_GLOW.map = src.map ?? null
          LANTERN_GLOW.needsUpdate = true
          t = LANTERN_GLOW
        } else t = /Lattice/.test(src.name) ? new THREE.MeshToonMaterial({ color: '#ffffff', map: src.map ?? null, alphaTest: 0.5, side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.map ? '#ffffff' : src.color.clone(), map: src.map ?? null, normalMap: src.normalMap ?? null })
        t.name = src.name
        made.set(src, t)
      }
      return t
    }
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material) ? m.material.map(toon) : toon(m.material)
      // (the eave throws its shadow down on the step; the rest, under it, none)
      m.castShadow = /Roof/.test(m.name)
      m.receiveShadow = !/Roof|EaveTiles|Glow/.test(m.name)
    })
    inkModel(r, (m) => !/Lattice|EaveTiles|Roof|Glow/.test(m.name), { width: 0.002, weld: true })
    return r
  }, [gltf])
  return <primitive object={obj} />
}
function ShopFrontImpl() {
  const lit = useRef(getLights().door ? 1 : 0)
  useFrame(({ clock }, dt) => {
    // (the band's lanterns lit with the door lanterns, their switch's way over some 0.4 s; their light breathing a little as theirs does)
    // (item 385, the owner's 「燈籠要有些黃光」: lit, their paper a warm candle yellow (it was white, '#fff3dc': red and white, nothing of a
    // flame in it), and their halos on the board behind them as bright as they're lit)
    lit.current += ((getLights().door ? 1 : 0) - lit.current) * Math.min(1, Math.min(dt, 0.1) * 7)
    const flame = 0.95 + 0.03 * Math.sin(clock.elapsedTime * 1.9)
    paperColour(LANTERN_PAPER, lit.current, flame, '#ffd88a')
    LANTERN_GLOW.opacity = 0.95 * lit.current * flame
  })
  return <StaticBatch><FacadeModel /></StaticBatch>
}
const ShopFront = memo(ShopFrontImpl)
/** the big red lantern under the eave: hung in the doorway's middle, out in front of the noren, from the eave's boards (its cord's top: the
 * eave's underside there, blender/facade.py's `under`) */
const BIG_HANG: [number, number] = [2.469, 0.64]
/** the big one's size against the door lanterns': fat and round, a little shorter */
const BIG_CHOCHIN: [number, number, number] = [1.8, 0.95, 1.8]

/**
 * What's seen out through the doorway (item 306, the owner's: 「光照跟陰影感還不行，尤其是白天，不太真實」: the open doorway showed the dark
 * behind the shop, black under the noren at noon): the street's light out there, a card past the doorway facing in (from outside it isn't
 * there), pale sky over it and the street's warm stone under; and the day spilling in on the genkan's stones, brightest at the sill. Both
 * by the part of the day: bright by day, amber at dusk, rose at dawn, the night's dark blue (the street's own lanterns are the door's)
 */
const DOOR_LIGHT = (() => {
  if (typeof document === 'undefined') return { spill: null }
  const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
  // (no street out there (item 397, the owner's 「戶外景拿掉好了」): it was StreetOutside's, with depth (item 386), a card before (item 360))
  const s = document.createElement('canvas')
  s.width = 64; s.height = 128
  const h = s.getContext('2d')!
  // (brightest at the sill (the picture's foot: laid flat it's toward the doorway), fading in over the stones; soft at either side)
  for (let y = 0; y < 128; y++) {
    const k = Math.pow(y / 127, 1.6)
    const row = h.createLinearGradient(0, 0, 64, 0)
    row.addColorStop(0, 'rgba(255,255,255,0)'); row.addColorStop(0.18, `rgba(255,255,255,${k})`); row.addColorStop(0.82, `rgba(255,255,255,${k})`)
    row.addColorStop(1, 'rgba(255,255,255,0)')
    h.fillStyle = row; h.fillRect(0, y, 64, 1)
  }
  return { spill: tex(s) }
})()
const DOOR_SPILL = new THREE.MeshBasicMaterial({ map: DOOR_LIGHT.spill, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
/** the street's light and the spill on the stones, by the part of the day (the page's data-sky): colour, and the spill's strength */
const DOOR_LOOKS: Record<string, [string, string, number]> = {
  day: ['#ffffff', '#fff0d6', 0.34], dawn: ['#ffffff', '#ffd6c8', 0.16], dusk: ['#ffffff', '#ffb46e', 0.3], night: ['#ffffff', '#8fa6d8', 0.07],
}
let doorSky = ''
function doorLight() {
  const s = typeof document === 'undefined' ? 'day' : document.documentElement.dataset.sky ?? 'day'
  if (s === doorSky) return
  doorSky = s
  const [, sc, so] = DOOR_LOOKS[s] ?? DOOR_LOOKS.day
  DOOR_SPILL.color.set(sc)
  DOOR_SPILL.opacity = so
}

/**
 * The sliding door at the way in (item 410, the owner's 「玄關試著做和式拉門」「客人進來的時候會先開拉門再脫鞋」): blender/genkandoor.py's three
 * leaves of dark wood and frosted glass on the stone sill, in the doorway's own frame (this group's); the middle and the north ones slid south
 * over the south one when someone wants through (game/slideDoor: one out on the step, one walking out toward it, one just put in at it),
 * shut once no one does. Whoever's going through is kept to its open way where they're drawn (as the hearth's guard keeps them off the fire,
 * after every walk's frame and before it's drawn), so none walks through a leaf's edge. The glass seen through a little, from either side;
 * a wooden rumble as it runs, a knock as it shuts.
 */
const DOOR_URL = import.meta.env.BASE_URL + 'models/genkandoor.glb'
useGLTF.preload(DOOR_URL)
/** frosted glass: a pale grey-blue, seen through a little (the noren and the night behind it), from either side; no transmission (rule 5) */
const DOOR_GLASS = new THREE.MeshToonMaterial({ color: '#e4e9ec', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
/** how far the moving leaf runs open (x): the north one over the south one, to the post (item 415: two leaves, the owner's 「拉門我要兩節」;
 * item 410's three ran -0.34 and -0.675) */
const DOOR_RUN: Record<string, number> = { GenkanDoorN: -0.56 }
/** the open way's sides (x) for the middle of one going through: the way's 0.56 open (the stacked leaves' edge -0.131 to the wall's end
 * 0.429), a customer about 0.6 across at the leaves' line (0.3 either side, tests/e2e/_doorwidth415.mjs): kept to its middle, as they were
 * kept 2 cm off the wall before; and how far in and out of the leaves' line they're kept to it, full within its middle (two come together,
 * stood side by side out on the step (the crowd's stepping aside), go through it one after the other) */
const DOOR_WAY = { x: [0.144, 0.154] as const, z: [0.08, 0.78] as const, ease: 0.2 }
/** what the door's called by the pointer, and what a click does now */
const DOOR_TIP = '玄關拉門'
const doorHint = (open: boolean) => (open ? '點一下關上（客人進出時照樣自己開關）' : '點一下拉開，一直開著')
const DOOR_INV = new THREE.Matrix4(), DOOR_P = new THREE.Vector3(), DOOR_W = new THREE.Vector3(), DOOR_SHIFT = new THREE.Vector3(), DOOR_HELD = new THREE.Vector3()
function GenkanDoorImpl() {
  const gltf = useGLTF(DOOR_URL) as unknown as { scene: THREE.Group }
  const ref = useRef<THREE.Group>(null)
  const scene = useThree((s) => s.scene)
  const { obj, moving, leaves } = useMemo(() => {
    const r = gltf.scene.clone(true)
    const wood = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (/Glass/.test(src.name)) { m.material = DOOR_GLASS; m.renderOrder = 2 }
      else {
        let t = wood.get(src)
        // (the wood its picture; the pulls their own dark bronze, no picture)
        if (!t) { t = new THREE.MeshToonMaterial({ color: src.map ? '#ffffff' : src.color, map: src.map ?? null }); t.name = src.name; wood.set(src, t) }
        m.material = t
      }
      m.castShadow = false
      m.receiveShadow = true
    })
    inkModel(r, (m) => m.material === DOOR_GLASS, { width: 0.0015, weld: true })
    // (the two leaves together under one group of their own, to light up under the pointer, the frame over them not)
    const leaves = new THREE.Group()
    leaves.name = 'GenkanDoorLeaves'
    const s0 = r.getObjectByName('GenkanDoorS')
    s0?.parent?.add(leaves)
    for (const n of ['GenkanDoorS', 'GenkanDoorN']) { const o = r.getObjectByName(n); if (o) leaves.add(o) }
    const moving = Object.entries(DOOR_RUN).flatMap(([n, run]) => { const o = r.getObjectByName(n); return o ? [{ o, run, x0: o.position.x }] : [] })
    return { obj: r, moving, leaves }
  }, [gltf])
  const st = useRef<DoorState>(doorShut())
  const wanted = useRef(false)
  /** held open by the player (clicked open: it stays open till it's clicked again; item 415, the owner's 「我也可以互動」) */
  const held = useRef(false)
  /** the game's own time (its frames' deltas, at the game's pace: x2, paused), for how long each one's been seen */
  const clock = useRef(0)
  /** each one about, where they were last (the doorway's frame), when, and since when they've been seen; and each frame's list of them for
   * game/slideDoor, its entries kept from frame to frame (nothing made each frame: it runs before every frame's drawing) */
  const seen = useMemo(() => new Map<THREE.Object3D, { z: number; t: number; since: number }>(), [])
  const walkers = useMemo(() => ({ list: [] as DoorWalker[], pool: [] as DoorWalker[] }), [])
  useEffect(() => {
    const was = scene.onBeforeRender
    // (each figure in turn by the map's own forEach, and the same function each frame: its for-of made a pair for each one (item 374))
    let g: THREE.Group | null = null, now = 0
    const ws = walkers.list
    const pass = (_role: unknown, o: THREE.Object3D) => {
      if (!o.parent || !o.visible || !g) return
      o.getWorldPosition(DOOR_W)
      DOOR_P.copy(DOOR_W).applyMatrix4(DOOR_INV)
      let was1 = seen.get(o)
      if (!was1) { was1 = { z: DOOR_P.z, t: now, since: now }; seen.set(o, was1) }
      const dz = now > was1.t ? (DOOR_P.z - was1.z) / (now - was1.t) : 0
      const age = now - was1.since
      if (now > was1.t) { was1.z = DOOR_P.z; was1.t = now }
      const wk = walkers.pool[ws.length] ?? (walkers.pool[ws.length] = { x: 0, z: 0, dz: 0, age: 0 })
      wk.x = DOOR_P.x; wk.z = DOOR_P.z; wk.dz = dz; wk.age = age
      ws.push(wk)
      // (going through: kept to its open way, eased in and out of it either side of the leaves' line; only where they're drawn)
      const z0 = DOOR_WAY.z[0], z1 = DOOR_WAY.z[1]
      if (DOOR_P.z <= z0 || DOOR_P.z >= z1 || DOOR_P.x < -0.75 || DOOR_P.x > 0.6) return
      const w = Math.min(1, (DOOR_P.z - z0) / DOOR_WAY.ease, (z1 - DOOR_P.z) / DOOR_WAY.ease)
      const to = Math.min(DOOR_WAY.x[1], Math.max(DOOR_WAY.x[0], DOOR_P.x))
      const nx = DOOR_P.x + (to - DOOR_P.x) * w
      if (Math.abs(nx - DOOR_P.x) < 1e-4) return
      DOOR_P.x = nx
      DOOR_P.applyMatrix4(g.matrixWorld)
      DOOR_SHIFT.subVectors(DOOR_P, DOOR_W)
      o.parent.worldToLocal(DOOR_P)
      o.position.copy(DOOR_P)
      o.updateMatrixWorld(true)
      const held = CARRIED.get(o)
      if (held) for (const c of held) {
        if (!c.parent || !c.visible) continue
        c.getWorldPosition(DOOR_HELD).add(DOOR_SHIFT)
        c.parent.worldToLocal(DOOR_HELD)
        c.position.copy(DOOR_HELD)
        c.updateMatrixWorld(true)
      }
    }
    // (those gone: forgotten, so one put in again is new)
    const forget = (_v: unknown, o: THREE.Object3D) => { if (!FIGURES.has(o) || !o.visible) seen.delete(o) }
    scene.onBeforeRender = function (...args) {
      was.apply(this, args)
      g = ref.current
      if (!g) return
      g.updateWorldMatrix(true, false)
      DOOR_INV.copy(g.matrixWorld).invert()
      now = clock.current
      ws.length = 0
      FIGURES.forEach(pass)
      seen.forEach(forget)
      wanted.current = doorWantOpen(ws, held.current)
    }
    return () => { scene.onBeforeRender = was }
  }, [scene, seen, walkers])
  const soundAt = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt0) => {
    clock.current += Math.min(dt0, 0.1)
    const was = st.current, now = doorStep(was, wanted.current, Math.min(dt0, 0.1))
    st.current = now
    const k = doorShown(now.k, now.opening)
    for (const m of moving) m.o.position.x = m.x0 + m.run * k
    // (a rumble as it starts to run either way, its knock home at the end of it shutting)
    // (the shop's sliding doors' own sound (restroomSound's), as loud as it's near, as long as it runs)
    if (now.opening !== was.opening && ref.current) slideDoorSound(now.opening, heard(ref.current.localToWorld(soundAt.set(DOOR_LANE.x, 1.0, DOOR_LANE.line))).near, now.opening ? DOOR_OPEN_S : DOOR_SHUT_S)
  })
  // (the player's: pointed at, its leaves light up and the pointer's a hand, its tag says what a click does; clicked, it's slid open and kept
  // open, or let go (doorClicked); in edit mode nothing: the piece is picked as any other)
  return (
    <group ref={ref}>
      <primitive object={obj}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (getEdit().on) return
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          glowOnly(leaves)
          aimTip(e)
          setTip({ title: DOOR_TIP, hint: doorHint(st.current.opening) })
        }}
        onPointerOut={() => { glowLeave(leaves); document.body.style.cursor = ''; setTip(null) }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (getEdit().on) return
          e.stopPropagation()
          held.current = doorClicked(st.current)
          setTip({ title: DOOR_TIP, hint: doorHint(held.current) })
        }} />
    </group>
  )
}
const GenkanDoor = memo(GenkanDoorImpl)

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
  // (pushed aside by whoever walks through under it, the panels they pass swung away from them and back after (item 203: it hung on, still,
  // as they went through it); which way each was pushed kept while someone's under it, set by the side they came from)
  const swing = useRef([0, 0, 0])
  const side = useRef([0, 0, 0])
  const at3 = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }, dt0) => {
    const t = clock.elapsedTime
    const dt = Math.min(dt0, 0.1)
    doorLight()
    panels.current.forEach((m, i) => {
      if (!m) return
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      const bb = m.geometry.boundingBox!
      // (in the panel's own frame: across it, and out in front of it or behind; how near the nearest one under it is)
      let near = 0, from = 0
      for (const o of FIGURES.keys()) {
        if (!o.visible) continue
        const q = m.worldToLocal(o.getWorldPosition(at3))
        if (q.x < bb.min.x - NOREN_REACH * 0.5 || q.x > bb.max.x + NOREN_REACH * 0.5) continue
        const k = 1 - Math.min(1, Math.abs(q.z) / NOREN_REACH)
        if (k > near) { near = k; from = q.z }
      }
      if (near <= 0) side.current[i] = 0
      else if (side.current[i] === 0) side.current[i] = from >= 0 ? 1 : -1
      // (pushed the way they're going, the hem swung away from them: quickly as they come, slowly falling back)
      const want = side.current[i] * NOREN_PUSH * near
      swing.current[i] += (want - swing.current[i]) * Math.min(1, dt * (Math.abs(want) > Math.abs(swing.current[i]) ? 9 : 2.5))
      // (its hem kept in from the sliding door's leaves, 8 cm out past it (item 410): swung out no more than 0.07)
      m.rotation.x = Math.max(-0.07, Math.sin(t * 1.3 + i * 0.9) * 0.05 + swing.current[i])
    })
  })
  return (
    <group name="look-door" position={at} rotation-y={yaw}>
      {/* the shop's front over the way in: its eave, the beam and post, the band of the menu's lit boards, the lanterns' bar (item 300) */}
      <Movable id="facade" label="門面"><ShopFront /></Movable>
      {/* the sliding door in the doorway (item 410) */}
      <Movable id="genkandoor" label="玄關拉門"><GenkanDoor /></Movable>
      {/* (in edit mode the cats' stand, the shoe cupboard and the like can each be moved: each its own batch inside its own Movable) */}
      <Movable id="doorcats" label="門口招財貓台"><StaticBatch plain>
      {/* just inside, against the wall: a two-tier stand of dark wood, the beckoning cats on it facing those coming in */}
      <group position={[0.4, 0, CAT_STAND_Z]}>
        {/* (its back against the wall, 0.1 behind its middle: the lower tier deep, the upper shallow and narrower; and a third, the top, a
            step at the back of the upper one, for the koban (the owner's, 2026-11-12); that step deeper and shorter along the wall (the
            owner's, 2026-11-12: 'the third step thicker, its width shorter, the cats moved to either side of it'): 0.2 deep, 0.26 long, the
            two big cats either side of it); and lower, 0.14 over the upper tier where it was 0.24 (the owner's, 2026-11-14, item 96) */}
        {[[-0.12, 0.44, 0.32, 0.84], [-0.02, 0.24, 0.6, 0.7], [0, 0.2, CAT_TOP, 0.26]].map(([x, d, h, l], i) => (
          <group key={i}>
            <Part geo={REG_GEO.round} color={i === 1 ? '#4a2e1c' : i === 2 ? '#3e2616' : '#5a3a24'} outline={1.02} position={[x, h / 2, 0]} scale={[d, h, l]} />
            {/* (a red felt (毛氈) laid over each tier, hanging down its front, as under a festival's dolls: one soft piece, its front edge
                rounded over as cloth drapes (item 379: two thin sheets, 8 mm, their edges sharp), an ink line round it) */}
            <group position={[x, 0, 0]}>
              <mesh geometry={feltGeo(d, h, l, 0)}><meshToonMaterial color="#b3241b" /></mesh>
              <mesh geometry={feltGeo(d, h, l, 0.003)}><meshBasicMaterial color={INK} side={THREE.BackSide} /></mesh>
            </group>
          </group>
        ))}
      </group>
      </StaticBatch></Movable>
      {/* (each cat its own piece in edit mode, on the stand's frame) */}
      <group position={[0.4, 0, CAT_STAND_Z]}>
        {DOOR_CATS.map((k, i) => (
          <Movable key={i} id={`doorcat${i}`} label={`招財貓 ${i + 1}`}><StaticBatch plain>
            <group position={[k.x, k.y + FELT_TOP - 0.008, k.z]} rotation-y={-Math.PI / 2 + k.yaw}><LuckyCat kind={k.kind} height={k.h} still /></group>
          </StaticBatch></Movable>
        ))}
        {/* (a koban, the old oval gold coin, on its little stand, up on the top step (the owner's, 2026-11-12: a step more, the coin on top);
            bigger, the step lower (item 96)) */}
        <Movable id="koban" label="小判金幣"><group position={[0, CAT_TOP + FELT_TOP + 0.0005, 0]} rotation-y={-Math.PI / 2} scale={1.35}><Koban /></group></Movable>
        {/* (the shop's own beckoning cat, its paw going, in the middle of the first step between the two small ones, facing the way in
            (item 97, the owner's, 2026-11-14)) */}
        <Movable id="owncat" label="招財貓（招手）"><group position={[-0.22, 0.32 + FELT_TOP, 0]} rotation-y={-Math.PI / 2} scale={1.15}
          {...nameOver('招財貓', '本店的招財貓，舉著左手招客人進門')}><OwnLuckyCat /></group></Movable>
      </group>
      {/* (the samurai helmet (兜) that sat on the lower tier between the two small cats is on its own little stand by the staff's door now
          (the owner's, 2026-11-12): DiningRoom's) */}
      {/* (the coir doormat that lay on the genkan's stone is gone (the owner's, 2026-11-17: 「紅圈地毯移除要換成地毯，做成一片就好、大片一點、日式風格」,
          item 264): one larger rush rug in its place, part of the floor's model (blender/genkanfloor.py's GenkanRug)) */}
      <Movable id="shoecab" label="鞋櫃">
      {/* the shoe cupboard (下駄箱) against the wall in the genkan (blender/shoecab.py; the owner's: low, broad, walnut, louvred doors that
          open, sunk pulls): its doors swing open at a click to its empty cubbies; a vase of a sprig on its top */}
      {/* (7 mm up: the genkan's stones are domed now (item 265), their tops 6 mm over their joints, and its foot sat into them) */}
      <group position={[SHOE_CAB_X, -GENKAN.depth + 0.007, SHOE_CAB_Z]}>
        <group rotation-y={-Math.PI / 2}><ShoeCupboard /></group>
        {/* (three vases on its top, as a genkan's flowers are set (item 297, the owner's, 2026-11-17: 「上面多幾個花瓶」): the tall cream one with
            its plum a little off the middle, a squat celadon pot with a camellia toward the bench's end, a slim indigo bud vase with narcissus
            toward the door's; each flower a picture on one card (item 257's way), facing the room as the cupboard does) */}
        <ShoeVases />
      </group>
      </Movable>
      <group position-x={DX}>
      {/* (the street's light out through the doorway, facing in only; and the day spilling in on the genkan's stones (item 306)) */}
      {/* (past the door, nothing: the street that stood out there (items 360, 386) taken away, item 397 (the owner's 「戶外景拿掉好了」): from out
          round the shop its power pole stood up out of the night past the restrooms (item 396, 「這是甚麼? 2F嗎?」)) */}
      <mesh position={[0, -GENKAN.depth + 0.012, NZ - 0.6]} rotation-x={-Math.PI / 2} material={DOOR_SPILL} renderOrder={2} raycast={NO_RAY}><planeGeometry args={[W * 0.95, 1.2]} /></mesh>
      {/* the doorway: the noren's rod, and the red lantern hung by the doorway on the bar's side */}
      {/* (the red lantern, its own piece: hung by its own cord) */}
      {/* (the lanterns at the door don't fade when they're in the way, as the room's hangings do: they're outside, and it left them a ghost
          from inside (the owner's)) */}
      {/* (the pair 5 cm further from the doorway than they were, for the sliding door's two leaves (item 415): the red one's paper bulged into the
          doorway, and the leaves had to stop short of it, the way left open narrower than a customer) */}
      <Movable id="chochin" label="紅燈籠"><group position={[-(W / 2 * NOREN_WIDE + 0.12) + 0.26 - CHOCHIN_OFF, H - 0.08 - 2.25, 0.47]}><Chochin mark={lantern} /></group></Movable>
      {/* (and the grill's own, cream, 炭火 on it, hung right beside the red one, on its far side from the doorway (the owner's: it hung on the
          doorway's other side)) */}
      <Movable id="chochin2" label="燒烤燈籠"><group position={[-(W / 2 * NOREN_WIDE + 0.12) + 0.26 - CHOCHIN_OFF - CHOCHIN_PAIR, H - 0.08 - 2.25, 0.47]}><Chochin mark={lantern} style="cream" /></group></Movable>
      {/* (and under the eave in the doorway's middle the big one, the shop's name 聞野 on it (item 300)) */}
      <Movable id="chochin-big" label="大紅燈籠"><group position={[0.26, BIG_HANG[0] - 2.25, BIG_HANG[1]]}><Chochin mark={mark} big /></group></Movable>
      {/* (and beyond it the fish lantern, a round one with a fish hung under it (the owner's, after their photograph of one)) */}
      {/* (turned a quarter round, its fish's side to the street, and a little bigger: 1.15 times (the owner's: 1.3, then a little smaller)) */}
      <Movable id="fishlantern" label="魚燈" baseTurn={[0, -90, 0]} baseScale={1.15}><group position={[(W / 2 * NOREN_WIDE + 0.12) + FISH_LANTERN_OUT, H - 0.08, 0.47]} scale={0.85}><FishLantern /></group></Movable>
      {/* the noren: three panels side by side, hung from a bamboo rod under the lintel, the rod by a cord at each end from the beam above */}
      <Movable id="noren" label="門簾" blocks>
        {/* (fades when it stands between the camera and what's looked at, as the other hangings do: see OccluderFade) */}
        <group userData={{ fadeOccluder: true }}>
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
      } else if (pole === 'wood') m.material = new THREE.MeshToonMaterial({ color: '#ffffff', map: POLE_WOOD })
      else m.material = src.name === 'NorenBrass' ? new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 1, roughness: 0.3 })
        : new THREE.MeshToonMaterial({ color: src.color.clone() })
    })
    return r
  }, [gltf, tex, pole])
  // (the panels handed over from the model as it's drawn, not as it's made: made twice in development (React's strict mode), the second copy
  // was the one handed over and the one drawn never swung (item 203))
  useLayoutEffect(() => {
    model.traverse((o) => { const k = /NorenPanel(\d)/.exec(o.name); if (k && (o as THREE.Mesh).isMesh) panels.current[+k[1]] = o as THREE.Mesh })
  }, [model, panels])
  return <primitive object={model} />
}


/** how near (the panel's own units, out from its face) someone walking through comes before they push it, and how far they push its hem (rad) */
const NOREN_REACH = 0.5
const NOREN_PUSH = 1.0
/** how much longer the way in's noren is drawn than it was made, and how much wider (kept to the doorway's width) */
/**
 * The plum sprig in the shoe cupboard's vase, painted on one card (item 257): a dark branch forking up out of the vase's mouth, white-pink
 * five-petalled blossoms along it with their yellow stamens, a few buds still shut; the rest of the card clear (cut out by alphaTest)
 */
const UME_CARD = signTexture(256, 320, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // (the branch: from the vase's mouth at the foot of the card, forking twice, tapering, a little crooked as plum is)
  const twig = (x: number, y: number, a: number, len: number, wd: number, depth: number, out: [number, number][]) => {
    let px = x, py = y
    const n = 5
    for (let i = 1; i <= n; i++) {
      const t = i / n, nx = px + Math.sin(a) * (len / n) + (rnd() - 0.5) * 6, ny = py - Math.cos(a) * (len / n)
      g.strokeStyle = '#4a2c1a'; g.lineCap = 'round'; g.lineWidth = Math.max(1.4, wd * (1 - t * 0.6))
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke()
      px = nx; py = ny
      out.push([px, py])
      if (depth > 0 && i === 3) twig(px, py, a + (rnd() < 0.5 ? -0.6 : 0.6), len * 0.55, wd * 0.6, depth - 1, out)
    }
  }
  const pts: [number, number][] = []
  twig(w * 0.5, h, -0.12, h * 0.78, 9, 2, pts)
  twig(w * 0.5, h, 0.32, h * 0.55, 7, 1, pts)
  // (the blossoms: five round petals about a yellow heart, white flushed pink, here and there along the twigs; a few buds)
  const bloom = (x: number, y: number, r: number) => {
    const turn = rnd() * Math.PI
    for (let k = 0; k < 5; k++) {
      const a = turn + (k / 5) * Math.PI * 2
      const grd = g.createRadialGradient(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 0, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.62)
      grd.addColorStop(0, '#fff6f7'); grd.addColorStop(0.75, '#f9d3db'); grd.addColorStop(1, '#e79aab')
      g.fillStyle = grd
      g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.6, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#d8a13a'; g.beginPath(); g.arc(x, y, r * 0.28, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#b8782a'; g.lineWidth = 1
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.stroke() }
  }
  pts.forEach(([x, y], i) => {
    if (y > h * 0.86) return
    if (i % 2 === 0) bloom(x + (rnd() - 0.5) * 10, y + (rnd() - 0.5) * 8, 9 + rnd() * 5)
    else { g.fillStyle = '#c4566e'; g.beginPath(); g.ellipse(x + (rnd() - 0.5) * 8, y, 3.2, 4.4, rnd(), 0, Math.PI * 2); g.fill() }
  })
})
const UME_CARD_MAT = new THREE.MeshToonMaterial({ map: UME_CARD, alphaTest: 0.5, side: THREE.DoubleSide })
/** a camellia (椿) for the squat celadon pot (item 297): a short dark stem, glossy dark-green leaves in pairs, one open red flower with its
 * yellow boss and a bud; the rest of the card clear */
const TSUBAKI_CARD = signTexture(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  g.strokeStyle = '#3a2416'; g.lineCap = 'round'; g.lineWidth = 7
  g.beginPath(); g.moveTo(w * 0.5, h); g.quadraticCurveTo(w * 0.47, h * 0.7, w * 0.55, h * 0.42); g.stroke()
  const leaf = (x: number, y: number, a: number, s: number) => {
    g.save(); g.translate(x, y); g.rotate(a)
    const grd = g.createLinearGradient(0, -s * 0.3, 0, s * 0.3)
    grd.addColorStop(0, '#2f5a2c'); grd.addColorStop(1, '#173a1c')
    g.fillStyle = grd
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.5, -s * 0.32, s, 0); g.quadraticCurveTo(s * 0.5, s * 0.32, 0, 0); g.fill()
    g.strokeStyle = 'rgba(160, 200, 140, 0.55)'; g.lineWidth = 1.6
    g.beginPath(); g.moveTo(s * 0.06, 0); g.lineTo(s * 0.9, 0); g.stroke()
    g.restore()
  }
  leaf(w * 0.5, h * 0.74, -2.5, 70); leaf(w * 0.49, h * 0.7, -0.55, 74); leaf(w * 0.53, h * 0.52, -2.75, 60); leaf(w * 0.54, h * 0.5, -0.3, 64)
  // (the flower: five broad overlapping petals, deep red, a little lighter at their edges; the yellow boss in its middle)
  const fx = w * 0.56, fy = h * 0.36, R = 40
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * Math.PI * 2 + 0.3
    const px = fx + Math.cos(a) * R * 0.48, py = fy + Math.sin(a) * R * 0.48
    const grd = g.createRadialGradient(fx, fy, R * 0.1, px, py, R * 0.62)
    grd.addColorStop(0, '#8e1020'); grd.addColorStop(0.7, '#c4202e'); grd.addColorStop(1, '#de4a52')
    g.fillStyle = grd
    g.beginPath(); g.ellipse(px, py, R * 0.6, R * 0.5, a, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = '#f2d24a'; g.beginPath(); g.arc(fx, fy, R * 0.26, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#d8a828'; g.lineWidth = 1.4
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * R * 0.3, fy + Math.sin(a) * R * 0.3); g.stroke() }
  // (a bud, still shut, red showing at its tip through its green)
  g.fillStyle = '#2c5a2a'; g.beginPath(); g.ellipse(w * 0.36, h * 0.48, 9, 13, -0.5, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#b81c2a'; g.beginPath(); g.ellipse(w * 0.345, h * 0.455, 5, 7, -0.5, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#3a2416'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.49, h * 0.62); g.lineTo(w * 0.37, h * 0.5); g.stroke()
})
/** narcissus (水仙) for the slim bud vase (item 297): long flat leaves standing up, a stem with a few small white six-petalled flowers, each
 * with its little yellow cup, nodding a little */
const SUISEN_CARD = signTexture(160, 320, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  const blade = (x: number, top: number, lean: number, wd: number) => {
    const grd = g.createLinearGradient(0, h, 0, top)
    grd.addColorStop(0, '#4c7a46'); grd.addColorStop(1, '#7aa86a')
    g.fillStyle = grd
    g.beginPath(); g.moveTo(x - wd / 2, h); g.quadraticCurveTo(x + lean * 0.4, (h + top) / 2, x + lean, top)
    g.quadraticCurveTo(x + lean * 0.4 + wd * 0.3, (h + top) / 2, x + wd / 2, h); g.fill()
  }
  blade(w * 0.42, h * 0.18, -16, 11); blade(w * 0.58, h * 0.26, 18, 10); blade(w * 0.5, h * 0.4, 6, 9)
  // (the flower stem, a little above the leaves, its head bent over)
  g.strokeStyle = '#5c8a50'; g.lineWidth = 4; g.lineCap = 'round'
  g.beginPath(); g.moveTo(w * 0.5, h); g.quadraticCurveTo(w * 0.52, h * 0.3, w * 0.6, h * 0.12); g.stroke()
  const flower = (x: number, y: number, r: number) => {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.2
      const grd = g.createRadialGradient(x, y, 0, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55)
      grd.addColorStop(0, '#fffdf4'); grd.addColorStop(1, '#efe8d4')
      g.fillStyle = grd
      g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#f0b62a'; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#d88a1a'; g.beginPath(); g.arc(x, y, r * 0.14, 0, Math.PI * 2); g.fill()
  }
  flower(w * 0.62, h * 0.11, 22); flower(w * 0.38, h * 0.16, 19); flower(w * 0.7, h * 0.24, 17)
})
const TSUBAKI_MAT = new THREE.MeshToonMaterial({ map: TSUBAKI_CARD, alphaTest: 0.5, side: THREE.DoubleSide })
const SUISEN_MAT = new THREE.MeshToonMaterial({ map: SUISEN_CARD, alphaTest: 0.5, side: THREE.DoubleSide })
/** the shoe cupboard's three vases (item 297), turned (latheSolid: open mouths, their feet closed by rungs, round bodies smooth): where each
 * stands along the cupboard's top (its length runs along z here, the room at -x), its outline across, its glaze; and its flower's card: how
 * big, how high its foot stands over the vase's foot */
// (the three set together as one arrangement in the top's middle (the owner's, 「花看起來都太平，幫我放一起」): the tall one in front, the squat pot
// behind it to one side, the bud vase behind to the other, a centimetre or so between them)
const SHOE_VASES: { x: number; z: number; prof: [number, number][]; color: string; card: THREE.Material; size: [number, number]; at: number }[] = [
  // (the tall cream one, the plum's: a shouldered body narrowing to a short neck)
  { x: -0.015, z: 0, color: '#ebe4d2', card: UME_CARD_MAT, size: [0.24, 0.3], at: 0.185,
    prof: [[0.03, 0], [0.037, 0.008], [0.042, 0.045], [0.04, 0.078], [0.03, 0.1], [0.019, 0.112], [0.017, 0.122], [0.0195, 0.126], [0.0145, 0.126], [0.0125, 0.11]] },
  // (a squat celadon pot, wide-mouthed, toward the bench's end: the camellia)
  { x: 0.02, z: -0.1, color: '#a6c6b0', card: TSUBAKI_MAT, size: [0.17, 0.17], at: 0.115,
    prof: [[0.036, 0], [0.046, 0.007], [0.054, 0.028], [0.053, 0.046], [0.046, 0.06], [0.041, 0.064], [0.043, 0.068], [0.037, 0.068], [0.035, 0.055]] },
  // (a slim indigo bud vase toward the door's end: the narcissus)
  { x: 0.025, z: 0.075, color: '#2f3b55', card: SUISEN_MAT, size: [0.12, 0.24], at: 0.23,
    prof: [[0.021, 0], [0.026, 0.008], [0.026, 0.05], [0.021, 0.09], [0.012, 0.125], [0.0095, 0.15], [0.012, 0.158], [0.0075, 0.158], [0.006, 0.14]] },
]
const ShoeVases = memo(function ShoeVases() {
  const vases = useMemo(() => {
    const g = new THREE.Group()
    for (const v of SHOE_VASES) {
      const m = new THREE.Mesh(latheSolid(v.prof, 20, true), new THREE.MeshToonMaterial({ color: v.color }))
      // (a millimetre over the cupboard's top: its foot's underside not in the top's own plane)
      m.position.set(v.x, SHOE_TOP + 0.001, v.z)
      m.castShadow = true
      g.add(m)
    }
    inkModel(g, () => false, { width: 0.0012, weld: true })
    return g
  }, [])
  return (
    <group {...nameOver('花瓶', '玄關的插花：梅花、山茶、水仙')}>
      <primitive object={vases} />
      {/* (each flower three cards crossed, a third of a turn apart, every other one turned over: never a flat picture from the side (the owner's,
          「花看起來都太平」), and not the same picture twice side by side) */}
      {SHOE_VASES.flatMap((v, i) => [0, 1, 2].map((k) => (
        <mesh key={`${i}-${k}`} position={[v.x, SHOE_TOP + v.at, v.z]} rotation-y={-Math.PI / 2 + (k * Math.PI) / 3} scale-x={k % 2 ? -1 : 1} material={v.card}>
          <planeGeometry args={v.size} />
        </mesh>
      )))}
    </group>
  )
})
const NOREN_BIG = 1.3
const NOREN_WIDE = 1.0
/** how long the noren's two cords are, from the beam down to its rod (the rod hung 0.18 higher than it was) */
const NOREN_CORD = 0.18

/**
 * A long lantern's skin (長提灯), its picture once round it: the washi lit from inside, the bamboo ribs it's wound on painted in (each a fine
 * dark line, the paper between them bellying a little, lit at its crown), its ends darker under the caps; and down its front and again round
 * its back the words in big brushed characters. `red`: the red one, the shop's mark in black edged with gold (a white band near each end
 * was tried: the owner had it taken off); `cream`: the grill's, cream paper, 炭火 in black (the owner had its 焼 taken off: the red one
 * beside it says it) with a red band top and bottom.
 */
const chochinTexture = (mark: string, style: 'red' | 'cream' = 'red', wide = 1) => signTexture(512, 512, (g) => {
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
  const chars = [...(cream ? '炭火' : mark)]
  const size = (chars.length === 1 ? 230 : chars.length === 2 ? 168 : 124) * (cream ? 0.82 : 1)
  const gap = chars.length === 1 ? 0 : size * 1.02
  // (on a lantern drawn wider round than tall (the big one, `wide`), each character narrowed by as much, to stand true on it)
  for (const u of [128, 384]) chars.forEach((ch, i) => {
    g.save()
    g.translate(u, 256 + (i - (chars.length - 1) / 2) * gap)
    g.scale(1 / wide, 1)
    brushText(g, ch, 0, 0, size, cream
      ? { fill: '#160a06', shadow: 'rgba(255,200,120,0.3)' }
      : { fill: '#160a06', edge: 'rgba(245,200,110,0.55)', shadow: 'rgba(255,170,90,0.35)' })
    g.restore()
  })
})
/**
 * A door lantern's paper (items 120, 125, the owner's, 2026-11-15): drawn as the room's own lamps are (lampShades): not shaded by the room's
 * lights (lit by them, put out it stood dark and heavily shadowed, the owner saw), its flame's light when lit, in `tint` (warm white for the
 * cream papers: "the 炭火 one a yellow-white light"); put out, the plain grey-white the room's lamps are by day, a dim grey by night
 * (game/roomLights' unlitShade, by the hour: the page's data-theme)
 */
const paperMat = (map: THREE.Texture | null, fin = false) => new THREE.MeshBasicMaterial({ map, toneMapped: false, side: fin ? THREE.DoubleSide : THREE.FrontSide,
  alphaTest: fin ? 0.5 : 0 })
const PAPER_OFF = new THREE.Color(), PAPER_ON = new THREE.Color()
/** a paper's colour, lit `k` of the way (0 out .. 1 lit), its flame `flame`, in `tint` */
const paperColour = (m: THREE.MeshBasicMaterial, k: number, flame: number, tint: string) => {
  PAPER_OFF.set(unlitShade(typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'))
  PAPER_ON.set(tint).multiplyScalar(flame)
  m.color.copy(PAPER_OFF).lerp(PAPER_ON, k)
}
/** how far apart the two lanterns by the doorway hang, the red and the grill's beside it (middle to middle) */
const CHOCHIN_PAIR = 0.32  // (0.3: their paper just touched, clips.mjs)
/** how much further from the doorway the pair hangs than at first (item 415: the sliding door's two leaves reach right to the post; item 420:
 * 0.05, the red one's paper a centimetre over the leaves' south edge, into the south leaf's stile as it swayed toward the door, 51 frames of
 * 541 and 17 mm deep; tests/e2e/_chochin420.mjs) */
const CHOCHIN_OFF = 0.08
const chochinGlow = (inner: string, mid: string, outer: string) => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.35, mid)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
/** the red lantern's glow round it, and the cream (炭火) one's, yellow-white (item 120: it glowed the red one's red) */
const CHOCHIN_GLOW = chochinGlow('rgba(255,120,70,0.8)', 'rgba(255,80,40,0.3)', 'rgba(255,60,30,0)')
const CHOCHIN_GLOW_CREAM = chochinGlow('rgba(255,240,205,0.8)', 'rgba(255,222,160,0.3)', 'rgba(255,210,140,0)')
const CHOCHIN_URL = import.meta.env.BASE_URL + 'models/chochin.glb'
const NOREN_URL = import.meta.env.BASE_URL + 'models/noren.glb'
useGLTF.preload(CHOCHIN_URL)
useGLTF.preload(NOREN_URL)

/**
 * A red paper lantern (赤提灯) hung at the door on a little arm off a post, the shop's name on it, lit from inside:
 * it sways a touch and its glow breathes like the flame in it.
 */
function Chochin({ mark, style = 'red', big = false }: { mark: string; style?: 'red' | 'cream'
  /** the big one under the eave (item 300): fat and round, BIG_CHOCHIN its size against these */
  big?: boolean }) {
  const tex = useMemo(() => chochinTexture(mark, style, big ? BIG_CHOCHIN[0] / BIG_CHOCHIN[1] : 1), [mark, style, big])
  const hang = useRef<THREE.Group>(null)
  // (blender/genkan.py's lantern: its paper lit from within and painted with the name, its caps lacquer, its bands and bail gold; its paper's
  // material handed back with it, the one that's drawn (kept aside in a ref while it was made, it was a copy made and thrown away by React's
  // second run in development: the lit or unlit paper was set on that, and the lanterns shone on with their switch off: the owner saw it))
  const gltf = useGLTF(CHOCHIN_URL) as unknown as { scene: THREE.Group }
  const { model, skin } = useMemo(() => {
    const r = gltf.scene.clone(true)
    let paper: THREE.MeshBasicMaterial | null = null
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'ChochinPaper') {
        paper = paperMat(tex)
        m.material = paper
      } else m.material = src.name === 'ChochinGold' ? new THREE.MeshStandardMaterial({ color: '#d6a84a', metalness: 1, roughness: 0.3 })
        : new THREE.MeshToonMaterial({ color: src.color.clone() })
    })
    inkModel(r, (m) => /Band|Bail|Tassel/.test(m.name), { width: 0.0015, weld: true })
    return { model: r, skin: paper as THREE.MeshBasicMaterial | null }
  }, [gltf, tex])
  const halo = useRef<THREE.Sprite>(null)
  /** how lit it is (0 out .. 1 lit), going to its switch's way over some 0.4 s, as a flame's lit or put out */
  const lit = useRef(getLights().door ? 1 : 0)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // (lit, its glow breathing like the flame; out (the door lanterns' switch by the way in: thrown by the shop at its opening and its last
    // order, App), the paper as daylight or the dark finds it)
    lit.current += ((getLights().door ? 1 : 0) - lit.current) * Math.min(1, Math.min(dt, 0.1) * 7)
    const k = lit.current, flame = 0.9 + 0.06 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 7.3 + 1.1)
    if (hang.current) hang.current.rotation.z = Math.sin(t * 0.9) * 0.04
    if (skin) paperColour(skin, k, flame, style === 'cream' ? '#fff1cc' : '#ffffff')
    if (halo.current) halo.current.material.opacity = k * (0.5 + (flame - 0.9) * 2)
  })
  return (
    <group>
      {/* hung straight from above on a long cord (no post) */}
      <group ref={hang} name="look-chochin" position={[-0.26, 2.25, 0]} scale={big ? BIG_CHOCHIN : 1}>
        <mesh position-y={-0.075}>
          <cylinderGeometry args={[0.003, 0.003, 0.15, 4]} />
          <meshBasicMaterial color="#1a0d08" />
        </mesh>
        {/* (the long lantern's middle: its cord, then half its height under it) */}
        <group position-y={-0.5}>
          <primitive object={model} />
          <sprite ref={halo} scale={[0.9, 1.25, 1]} raycast={NO_RAY}>
            <spriteMaterial map={style === 'cream' ? CHOCHIN_GLOW_CREAM : CHOCHIN_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.5} />
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
/** the round lantern's paper: washi lit from within, ribbed, 焼魚 in black brush round it twice, a quarter round from the fish's front and
 * back (u reads left to right; its words at u 0 and 0.5, so with the fish's side to the street (the lantern turned a quarter) they face the
 * street too, the owner's; v from its top down). Its lettering drawn wider than tall: the paper's u is a longer way round its belly than its
 * v is up it */
const FISH_TOP_TEX = signTexture(1024, 256, (g) => {
  const W = 1024, H = 256
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#c9b58e'); grad.addColorStop(0.3, '#f6ecd4'); grad.addColorStop(0.5, '#fff8e8'); grad.addColorStop(0.7, '#f6ecd4'); grad.addColorStop(1, '#c9b58e')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let y = 4; y < H; y += 10.5) { g.fillStyle = 'rgba(120,90,50,0.22)'; g.fillRect(0, y, W, 1.6) }
  g.fillStyle = 'rgba(120,90,50,0.12)'
  for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 1.5, H)
  // (the one at u 0 drawn at both edges, half of it each side of the seam)
  for (const cx of [W * 0.5, 0, W]) {
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
  const fishGlow = useRef<THREE.Sprite>(null)
  /** the pale glow under the fish (it was lit whatever the switch: the owner saw the fish shine on with the lanterns out) */
  const fishUnder = useRef<THREE.Sprite>(null)
  /** how lit it is (0 out .. 1 lit), going to its switch's way over some 0.4 s */
  const lit = useRef(getLights().door ? 1 : 0)
  const { model, fish, papers } = useMemo(() => {
    const r = gltf.scene.clone(true)
    const papers: THREE.MeshBasicMaterial[] = []
    const lit = (map: THREE.Texture | null, fin = false) => {
      const m = paperMat(map, fin)
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
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    lit.current += ((getLights().door ? 1 : 0) - lit.current) * Math.min(1, Math.min(dt, 0.1) * 7)
    const k = lit.current, flame = 0.92 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 6.1 + 0.7)
    for (const m of papers) paperColour(m, k, flame, '#fff4dc')
    if (fishGlow.current) fishGlow.current.material.opacity = 0.55 * k
    if (fishUnder.current) fishUnder.current.material.opacity = 0.35 * k
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
        <sprite ref={fishGlow} position-y={-0.16} scale={[0.62, 0.55, 1]} raycast={NO_RAY}>
          <spriteMaterial map={FISH_GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
        </sprite>
        <sprite ref={fishUnder} position-y={-0.68} scale={[0.5, 0.95, 1]} raycast={NO_RAY}>
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
        <StaticBatch plain>
          <group position={at} rotation-y={yaw}><group position={TILL_CHAIR} scale={PEOPLE_SCALE}><TillStoolModel which="High" /></group></group>
        </StaticBatch>
        <group position={at} rotation-y={yaw}><group name="cashier-seat" position={[TILL_CHAIR[0], TILL_SEAT * PEOPLE_SCALE, TILL_CHAIR[2]]} /></group>
      </Movable>
      <Movable id="till-stool-lo" label="收銀矮凳"><StaticBatch plain>
        <group position={at} rotation-y={yaw}><group position={[-0.44, 0, 0.68]} rotation-y={-0.28} scale={PEOPLE_SCALE}><TillStoolModel which="Low" /></group></group>
      </StaticBatch></Movable>
      <Movable id="till-counter" label="收銀櫃檯" blocks><StaticBatch plain>
      <group position={at} rotation-y={yaw}>
      {/* (local x along the bar, +z toward the cashier, behind it) */}
      {/* the counter itself, from blender/tillcounter.py: its dark body with the lit bamboo and the lantern window, the marble top, the walnut partition */}
      <TillCounter top={top} />
      </group>
      </StaticBatch></Movable>
      <Movable id="till-register" label="收銀機（含抽屜）">
        <StaticBatch plain>
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
      <Movable id="till-card" label="刷卡機"><StaticBatch plain>
      <group position={at} rotation-y={yaw}>
      {/* the card reader on its cradle, its face to the customers (blender/tilldesk.py), on the desk mat */}
      <group position={[-0.38, top, -0.1]}><TillDeskPiece name="TillCardReader" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-printer" label="明細印表機" baseTurn={[0, 180, 0]}><StaticBatch plain>
      <group position={at} rotation-y={yaw}>
      {/* the receipt printer, its slip curling out (blender/tilldesk.py), on the desk mat */}
      <group position={[-0.38, top, 0.12]}><TillDeskPiece name="TillPrinter" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-tray" label="找零盤" baseTurn={[0, 90, 0]}><StaticBatch plain>
      <group position={at} rotation-y={yaw}>
      {/* the change tray (カルトン, blender/tilldesk.py): black resin, its floor ribbed, ありがとうございました in gold along its edge */}
      <group position={[0.0, top, -0.4]}><TillDeskPiece name="TillTray" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-pens" label="筆筒"><StaticBatch plain>
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
      <Movable id="till-ingot" label="元寶"><StaticBatch plain>
      <group position={at} rotation-y={yaw}>
      {/* a gold ingot (元寶) on its red stand, for wealth, between the bell and the cat (blender/tilldesk.py) */}
      <group position={[-0.3, top, -0.34]} rotation-y={0.3} scale={1.5}><TillDeskPiece name="TillIngot" /></group>
      </group>
      </StaticBatch></Movable>
      <Movable id="till-tree" label="招財樹"><StaticBatch plain>
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
/**
 * The insert's layout (blender/register.py's RegInsert), in the register's own units, in the drawer's frame: the middles of the notes'
 * compartments along the back (the 2000 one holds coin rolls) and of the six coin cups along the front, their floors' heights, the cups'
 * floors' slope, and how many coins lie in each. The money in them is drawn at the till's own scale (1 / REG_SC). When the register was
 * brought down from 1.4 times its model's size these stayed in the old, 1.4 times larger units: the outer cups' coins lay outside the drawer
 * on either side and the 10000s stuck out over it (the owner: "the till's burst")
 */
const NOTE_X: Record<Note, number> = { 10000: 0.1253, 5000: 0.0418, 1000: -0.1253 }
const NOTE_Z = 0.067, NOTE_Y = 0.021
const COIN_CUPS: [CoinKind, number, number][] = [[500, 0.1392, 14], [100, 0.0835, 24], [50, 0.0278, 15], [10, -0.0278, 26], [5, -0.0835, 11], [1, -0.1392, 18]]
const COIN_Z = -0.079, COIN_Y = 0.02, COIN_TILT = -0.12
/** a point in the insert (the drawer's frame), in the till's frame, with the drawer out as far as `open` */
const insertToTill = (ix: number, iy: number, iz: number, top: number, open: number) =>
  new THREE.Vector3(0.05 - ix * REG_SC, top + iy * REG_SC, 0.06 - (iz - 0.24 * open) * REG_SC)
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
  const warmFrames = useRef(0)
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
    inDrawer[k] ? tl(lang, `點一下取出 ¥${(k * inDrawer[k]).toLocaleString()}，加進現金`, `クリックで ¥${(k * inDrawer[k]).toLocaleString()} を取り出す`, `Click to take ¥${(k * inDrawer[k]).toLocaleString()} into cash`)
      : tl(lang, '這格是空的', 'この仕切りは空', 'This one is empty'))
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
    if (cash.current) cash.current.visible = open.current > 0.15 || warmFrames.current < 40
    // (its inside drawn only once it's out a little: shut, it's all in the dark of the till; and its first few dozen frames, unseen inside
    // the shut till, so the programs it's drawn with (its shadow's too) are made as the shop loads, not at the first pull a minute in)
    const inside = open.current > 0.02 || ++warmFrames.current < 40
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
      sl.visible = TILL_STATE.slip && k >= 0.3 && k < 0.95
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
        const slot = insertToTill(NOTE_X[kind], NOTE_Y + 0.011, NOTE_Z, top, open.current)
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
        const from = insertToTill(COIN_CUPS[1][1], COIN_Y + 0.007, COIN_Z, top, open.current)
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
          // (and the till's own panel with it, the drawer's money in sight to take (App's, item 366))
          window.dispatchEvent(new CustomEvent('jgs-till', { detail: TILL_STATE.manual }))
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
          {/* (the insert: each compartment and cup where the model has it, the money in it at the till's own scale) */}
          <group ref={cash} visible={false}>
            {/* the money in the insert (the insert itself is the model's): the notes face up in their compartments under the weights, a stray one
                askew on top; the coins heaped loose in their cups, on their floors' slope */}
            {/* (as many as there are, a stack's worth at most; clicked, the owner takes them) */}
            {(Object.keys(NOTE_X).map(Number) as Note[]).map((kind, i) => {
              const n = Math.min(inDrawer[kind], 12)
              return (
                <group key={kind} position={[NOTE_X[kind], NOTE_Y, NOTE_Z]} onClick={(e) => takeCash(e, kind)} {...cashTip(kind)}>
                  <group scale={1 / REG_SC}>
                    {n > 1 && <NoteStack kind={kind} n={n - 1} rotation-y={Math.PI / 2 + (i - 1) * 0.012} />}
                    {n > 0 && <NoteStack kind={kind} n={1} position={[0.002 * (i - 1), 0.0012 * (n - 1) + 0.001, -0.004]} rotation-y={Math.PI / 2 + 0.05 - i * 0.03} />}
                  </group>
                  {/* (a touch area over the compartment, so even an empty one can be pointed at) */}
                  <mesh visible={false} position-y={0.007}><boxGeometry args={[0.072, 0.021, 0.114]} /></mesh>
                </group>
              )
            })}
            {COIN_CUPS.map(([kind, x]) => (
              <group key={kind} position={[x, COIN_Y, COIN_Z]} rotation-x={COIN_TILT} onClick={(e) => takeCash(e, kind)} {...cashTip(kind)}>
                {inDrawer[kind] > 0 && <CoinPile kind={kind} n={Math.min(inDrawer[kind], 40)} w={0.04 * REG_SC} d={0.11 * REG_SC} seed={kind} scale={1 / REG_SC} />}
                <mesh visible={false} position-y={0.006}><boxGeometry args={[0.044, 0.014, 0.12]} /></mesh>
              </group>
            ))}
          </group>
        </group>
        {/* the keys and the mode lock */}
        <RegisterKeys lang={lang} />
        {/* the receipt (clicked, it's torn off) */}
        <mesh ref={slip} geometry={slipGeo} visible={false} position={[-0.025, 0.2185, 0.076]} rotation={[0.2, Math.PI, 0]}
          {...tipOver(tl(lang, '收據', 'レシート', 'Receipt'), tl(lang, '點一下撕下', 'クリックで切り取る', 'Click to tear it off'))}
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
/** (the shoe cupboard's end toward the step where the old one's was, now it's 0.9 long, not 0.71: its middle that much nearer the door) */
const CAT_STAND_Z = -1.92, SHOE_CAB_Z = -0.62 - (0.56 * 1.27) / 2 + 0.9 / 2
/** the shoe cupboard's middle off the wall: its back 5 cm in from where the first one's was (0.51), now it's 1.27 times as deep (at 0.51 the
 * floor's edge strip along the wall ran 4 cm into its back) */
// (half as deep since (the owner's, 2026-11-10): its back stays on the wall at 0.46)
const SHOE_CAB_X = 0.46 - 0.2 / 2
/** the shoe cupboard's top (blender/shoecab.py's H): what stands on it stands there */
const SHOE_TOP = 0.56
/** its cubbies (two rows of four: one to each of the eight places) */
const SHOE_CUBBIES = 8
const SHOE_URL = import.meta.env.BASE_URL + 'models/shoecab.glb'
useGLTF.preload(SHOE_URL)
/**
 * The genkan's shoe cupboard (blender/shoecab.py; the owner's): a low, long walnut cabinet, two rows of four shoji-latticed doors over empty
 * cubbies, one to each place (the guests' own shoes go in them). Pointed at, it says what it is; a click swings all eight open 75 degrees or
 * shut, a wooden knock as they go.
 */
/** the shoe cupboard's materials: its parts' colours on their points; its wood's grain (blender/shoecab.py's walnut: the owner's, 2026-11-10,
 * it was flat colour) under its boards' colours, made once with the model's picture */
const SHOE_MAT = new THREE.MeshToonMaterial({ vertexColors: true })
let SHOE_WOOD_MAT: THREE.MeshToonMaterial | null = null
// (pale: its picture is pale ash and washi now (blender/shoecab.py, item 264: 「鞋櫃木紋感太重，要日和風 有紙糊的那種感覺，不要通透」); walnut before)
// (its colours were traded with the waiting bench's a while (item 291), and put back (item 297, the owner's, 2026-11-17: 「鞋櫃幫我換回原本的顏色
// 好了」): the bench kept its new pale ash)
// (a medium brown with a natural grain since item 305 (the owner's, 2026-11-17: 「鞋櫃改回剛剛的深色，但別太深，記得木紋要自然」): the colour in
// its picture (blender/shoecab.py), the tints near white, the top a shade deeper)
const SHOE_TINT: Record<string, THREE.Color> = { ShoeWood: new THREE.Color('#fbf6ef'), ShoeTop: new THREE.Color('#ece0d0'), ShoeSlat: new THREE.Color('#ffffff') }
/** one of a pair of shoes put away in a cubby */
const SHOE_PAIR_GEO = new RoundedBoxGeometry(0.07, 0.052, 0.17, 2, 0.02)
/** the cupboard's shoes, all of them one instanced mesh in this material, each shoe its customer's colour (item 227) */
const SHOES_IN_MAT = new THREE.MeshToonMaterial({ color: '#ffffff' })
const SHOE_NONE = new THREE.Matrix4().makeScale(0, 0, 0)
const SHOE_M = new THREE.Matrix4()
const SHOE_C = new THREE.Color()
function ShoeCupboard() {
  const gltf = useGLTF(SHOE_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const root = gltf.scene.clone(true)
    // (each door, and the carcass, drawn once: its parts' colours written on their points, one material for all of it, its pieces put
    // together; an ink line round only its wood, not round the lattice's thin bars (they'd go black). Nine doors of four materials each,
    // each inked, were 47 draws; now two a door)
    const parts = (node: THREE.Object3D) => {
      const out: THREE.Mesh[] = []
      node.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== node) out.push(o as THREE.Mesh) })
      if ((node as THREE.Mesh).isMesh) out.push(node as THREE.Mesh)
      return out
    }
    const together = (node: THREE.Object3D) => {
      const ms = parts(node)
      if (!ms.length) return
      node.updateWorldMatrix(true, true)
      const inv = node.matrixWorld.clone().invert()
      // (the grained wood apart from the rest: its points' uvs kept, drawn with the grain)
      const grained = (m: THREE.Mesh) => !!(m.material as THREE.MeshStandardMaterial).map
      const woodGrain = ms.find(grained)
      if (woodGrain && !SHOE_WOOD_MAT) SHOE_WOOD_MAT = new THREE.MeshToonMaterial({ vertexColors: true, map: (woodGrain.material as THREE.MeshStandardMaterial).map })
      const geoOf = (m: THREE.Mesh) => {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', m.geometry.attributes.position.clone())
        g.setAttribute('normal', m.geometry.attributes.normal.clone())
        if (grained(m) && m.geometry.attributes.uv) g.setAttribute('uv', m.geometry.attributes.uv.clone())
        if (m.geometry.index) g.setIndex(m.geometry.index.clone())
        // (the grained boards' own colours (the model's are white over their grain picture: the colour's in the picture there))
        const c = SHOE_TINT[(m.material as THREE.Material).name] ?? (m.material as THREE.MeshStandardMaterial).color
        const n = g.attributes.position.count, col = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.applyMatrix4(inv.clone().multiply(m.matrixWorld))
        return g
      }
      const geos = ms.filter((m) => !grained(m)).map(geoOf)
      const woodGeos = ms.filter(grained).map(geoOf)
      const wood = ms.filter((m) => /^Shoe(Wood|Top)$/.test((m.material as THREE.Material).name))
      const hull = inkTogether(wood.map((m) => { const k = new THREE.Mesh(m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld))); return k }), { width: 0.0015, weld: true })
      for (const m of ms) if (m !== node) m.removeFromParent()
      if (geos.length) {
        const one = new THREE.Mesh(mergeGeometries(geos)!, SHOE_MAT)
        one.name = node.name + 'Drawn'
        node.add(one)
      }
      if (woodGeos.length && SHOE_WOOD_MAT) {
        const wood = new THREE.Mesh(mergeGeometries(woodGeos)!, SHOE_WOOD_MAT)
        wood.name = node.name + 'Wood'
        node.add(wood)
      }
      if (hull) node.add(hull)
    }
    const doors: { o: THREE.Object3D; s: number; cell: number; k: number }[] = []
    root.traverse((o) => { const m = /^ShoeDoor([LR])(\d+)$/.exec(o.name); if (m) doors.push({ o, s: m[1] === 'L' ? -1 : 1, cell: +m[2], k: 0 }) })
    // (each cubby's floor, from its door and the carcass's depth (the model as it stands, unturned): where its shoes go)
    root.updateWorldMatrix(true, true)
    const cab = root.getObjectByName('ShoeCab')
    const cabBox = cab ? new THREE.Box3().setFromObject(cab) : new THREE.Box3()
    const cells: THREE.Vector3[] = []
    for (const d of doors) {
      const b = new THREE.Box3().setFromObject(d.o), c = b.getCenter(new THREE.Vector3())
      // (the shoes in the middle of its depth: it's shallow now, a pair just fits)
      cells[d.cell] = new THREE.Vector3(c.x, b.min.y + 0.004, (cabBox.min.z + cabBox.max.z) / 2)
    }
    for (const d of doors) together(d.o)
    if (cab) together(cab)
    // (all eight shut, drawn as one with one ink line, two draws not eighteen; any of them swinging, each its own again)
    const shut = homeCopy(root, doors.map((d) => d.o))
    return { root, doors, cells, shut }
  }, [gltf])
  /** the cubbies opened by a click, each on its own (item 256, the owner's: 「這櫃子我點一下就全開，能否一個一個開」) */
  const st = useRef({ cells: new Set<number>() })
  const g = useRef<THREE.Group>(null)
  // (every cubby's pair of shoes one instanced mesh, each shoe its customer's colour (item 227: two meshes a pair, a material each, some
  // thirty draws with the cupboard full); a cubby with none, its two drawn at nothing; made with the rest, its program at load)
  const shoes = useMemo(() => {
    const m = new THREE.InstancedMesh(SHOE_PAIR_GEO, SHOES_IN_MAT, Math.max(1, model.cells.length * 2))
    m.name = 'shoe-pairs'
    m.frustumCulled = false
    m.raycast = () => {}
    for (let i = 0; i < m.count; i++) { m.setMatrixAt(i, SHOE_NONE); m.setColorAt(i, SHOE_C.set('#444444')) }
    return m
  }, [model])
  useEffect(() => () => shoes.dispose(), [shoes])
  /** each cubby's colour as last drawn ('' none): the instances written only when one changes */
  const drawn = useRef<string[]>([])
  useFrame((_, dt) => {
    const s = st.current
    const now = performance.now()
    // (each cubby's door by a click on it; and as a customer puts their shoes in or takes them out, open a moment)
    model.doors.forEach((d) => {
      const want = s.cells.has(d.cell) || now - (SHOE_CELLS.kick.get(d.cell) ?? -1e9) < 1400 ? 1 : 0
      d.k += Math.sign(want - d.k) * Math.min(Math.abs(want - d.k), Math.min(dt, 0.1) * 3.2)
      const e = d.k * d.k * (3 - 2 * d.k)
      d.o.rotation.y = d.s * e * (75 * Math.PI / 180)
    })
    // (shut, the one drawing of them all; the doors themselves hidden (still pointed at: the pointer's rays don't mind))
    model.shut.home(model.doors.every((d) => d.o.rotation.y === 0))
    let changed = false
    model.cells.forEach((at, i) => {
      const c = SHOE_CELLS.shoes.get(i) ?? ''
      if (drawn.current[i] === c || !at) return
      drawn.current[i] = c
      changed = true
      for (let sd = 0; sd < 2; sd++) {
        if (c) { SHOE_M.makeTranslation(at.x + (sd ? 0.045 : -0.045), at.y + 0.026, at.z); shoes.setMatrixAt(i * 2 + sd, SHOE_M); shoes.setColorAt(i * 2 + sd, SHOE_C.set(c)) }
        else shoes.setMatrixAt(i * 2 + sd, SHOE_NONE)
      }
    })
    if (changed) { shoes.instanceMatrix.needsUpdate = true; if (shoes.instanceColor) shoes.instanceColor.needsUpdate = true }
    if (g.current) { g.current.getWorldPosition(SHOE_CELLS.at); SHOE_CELLS.ready = true }
  })
  return (
    <group onClick={(e) => {
      e.stopPropagation()
      if (getEdit().on) return
      // (the cubby whose door was clicked opened or shut, that one alone; a click on the cupboard itself shuts any that are open)
      let cell = -1
      for (let o: THREE.Object3D | null = e.object; o && cell < 0; o = o.parent) { const m = /^ShoeDoor[LR](\d+)$/.exec(o.name); if (m) cell = +m[1] }
      const cells = st.current.cells
      if (cell >= 0) { if (cells.has(cell)) cells.delete(cell); else cells.add(cell) } else cells.clear()
      const open = cell >= 0 && cells.has(cell)
      shrineDoor(open)
      setTip({ title: '【下駄箱】', hint: open ? '再點一下關上這一格' : '點一格的門，開那一格' })
    }}
      {...tipOver('【下駄箱】', '點一格的門，開那一格')}>
      <primitive object={model.root} />
      <group ref={g}>
        {/* (the shoes in each cubby: a pair, the customer's colour, toes out; all of them one instanced mesh) */}
        <primitive object={shoes} />
      </group>
    </group>
  )
}
/** the shoes of those waiting on the bench, on the genkan's stone where they stepped up (item 203): a pair each, their colour, at the
 * cupboard's shoes' size; placed each frame from the sitters' own (nothing re-rendered for it) */
// (item 374: its pairs placed frame by frame; drawn again only if its list's ref changes)
const BenchShoes = memo(BenchShoesImpl)
function BenchShoesImpl({ sitters }: { sitters: { current: Map<number, { id: number; shoes?: { at: THREE.Vector3; yaw: number } }> } }) {
  const pairs = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => Array.from({ length: BENCH_SEATS }, () => new THREE.MeshToonMaterial({ color: '#444444' })), [])
  useEffect(() => () => { for (const m of mats) m.dispose() }, [mats])
  useFrame(() => {
    const shod = [...sitters.current.values()].filter((v) => v.shoes)
    pairs.current.forEach((p, i) => {
      if (!p) return
      const v = shod[i]
      p.visible = !!v
      if (!v?.shoes) return
      p.position.copy(v.shoes.at)
      p.rotation.y = v.shoes.yaw
      mats[i].color.set(SHOE_COLOURS[v.id % 5])
    })
  })
  return (
    <>
      {mats.map((m, i) => (
        <group key={i} name={`bench-shoes-${i}`} ref={(o) => { pairs.current[i] = o }} visible={false}>
          {[-1, 1].map((sd) => <mesh key={sd} geometry={SHOE_PAIR_GEO} material={m} position={[sd * 0.045, 0.026, 0]} castShadow raycast={() => {}} />)}
        </group>
      ))}
    </>
  )
}
/**
 * The cats at the door, on their stand just inside it against the wall (the entrance's +x side; the till is on the
 * other), facing across the way in at those coming through
 */
/** the cats' stand's top step's height, the koban on it (0.84 once: item 96) */
const CAT_TOP = 0.74
/**
 * The felt over one of the cats' stand's tiers (`d` deep, its top at `h`, `l` long; grown `g` all round for its ink): one piece of cloth
 * across the top and down the front, its front edge rounded over as cloth drapes (the cats stand in it a little, as on a cushion), its
 * ends softened (item 379, docs/MODELING.md's 造型感). Its faces against the tier sit 2 mm inside it (no two faces in one plane); made once
 * for each tier
 */
const FELT_T = 0.012, FELT_DROP = 0.075
/** the felt's top over its tier (its thickness and its bevel's swell): what stands on it stands this high */
const FELT_TOP = FELT_T + 0.0018
const FELTS = new Map<string, THREE.BufferGeometry>()
function feltGeo(d: number, h: number, l: number, g: number) {
  const key = [d, h, l, g].join('|')
  let geo = FELTS.get(key)
  if (geo) return geo
  // (its section across the tier, x out from the wall (its front at -d/2), y up; the outer corners rounded, the cloth's fold at the front
  // fullest)
  const xb = d / 2 + 0.004 + g, xf = -d / 2 - FELT_T - g, yt = h + FELT_T + g, yb = h - FELT_DROP - g, xi = -d / 2 + 0.002, yi = h - 0.002
  const sh = new THREE.Shape()
  const rf = 0.016 + g, rb = 0.006 + g
  sh.moveTo(xb, yi)
  sh.lineTo(xb, yt)
  sh.lineTo(xf + rf, yt)
  sh.absarc(xf + rf, yt - rf, rf, Math.PI / 2, Math.PI, false)
  sh.lineTo(xf, yb + rb)
  sh.absarc(xf + rb, yb + rb, rb, Math.PI, Math.PI * 1.5, false)
  sh.lineTo(xi, yb)
  sh.lineTo(xi, yi)
  sh.closePath()
  const b = 0.003
  geo = new THREE.ExtrudeGeometry(sh, { depth: l + 0.008 + 2 * g - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.6, bevelSegments: 1, curveSegments: 2 })
  geo.translate(0, 0, -(l + 0.008 + 2 * g - 2 * b) / 2)
  FELTS.set(key, geo)
  return geo
}
const DOOR_CATS = [
  // (on the stand: x out from the wall, y the tier's top, z along it; the big white pair on the upper tier)
  // (each its own model and size, in its own colours: two big ones on top, two smaller below)
  // (each with room round it: none touching the next, nor the shoe cupboard and the helmet beside the stand)
  // (the big pair on the upper tier either side of the top step, clear of it (the owner's, 2026-11-12: they sat in front of it, their backs
  // in it); each 0.18 across, 2 cm off the step's ends, inside the tier's)
  { x: -0.075, y: 0.6, z: -0.24, yaw: 0.2, kind: 1 as const, h: 0.5 },
  { x: -0.075, y: 0.6, z: 0.24, yaw: -0.2, kind: 3 as const, h: 0.44 },
  { x: -0.27, y: 0.32, z: -0.3, yaw: 0.25, kind: 2 as const, h: 0.38 },
  { x: -0.27, y: 0.32, z: 0.3, yaw: -0.25, kind: 1 as const, h: 0.42 },
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
/**
 * The genkan's footing in stone (item 287, the owner's, 2026-11-17: 「門口的厚度要改成石造」: seen from above, the edge of the genkan was a
 * dark board), in the genkan floor's crazy paving (item 395); every face of the way in's stone its own course of whole stones (item 404, the
 * owner's 「切得很怪」: one picture of the paving laid over them all at one scale, its stones cut off wherever a face ended): the steps, the
 * footing's band over them, the footing's sides and the genkan's side by the wall, each a part of blender/stonesteps.py's
 * made to its measure (STONE_MADE), scaled to it as it stands
 */
/** how far out each of the doorway's stone steps reaches (the bar's units: a tread a third of a metre deep, the dining room's metres) */
const STEP_GO = 0.17
/** the steps themselves (item 352, the owner's 「石階梯太假了吧」: they were boxes in the base's masonry picture, bricks stacked): a slab of
 * granite each, its edges eased and its tread's front worn (blender/stonesteps.py); made at the doorway's measure as it stood, each scaled
 * to it as it stands (within a percent) */
const STEPS_URL = import.meta.env.BASE_URL + 'models/stonesteps.glb'
useGLTF.preload(STEPS_URL)
/** each part's size as made (blender/stonesteps.py's SLABS): the footing's band over the upper step (item 404: a riser of its own, laid on the
 * footing's face), the upper step, the lower; the genkan's side by the wall, the footing */
const STONE_MADE: Record<string, [number, number, number]> = { StoneStep0: [1.2369, 0.1123, 0.012], StoneStep1: [1.2329, 0.2247, 0.168],
  StoneStep2: [1.2289, 0.1123, 0.168], StoneSide: [0.02, 0.112, 1.3155], StoneFoot: [1.2369, 0.337, 1.3155] }
/** the way in's stone in the room's toon light, made once for the model's material and shared by all its parts */
const PAVING = new Map<THREE.Material, THREE.MeshToonMaterial>()
function pavingOf(sm: THREE.MeshStandardMaterial) {
  let t = PAVING.get(sm)
  if (!t) { t = new THREE.MeshToonMaterial({ color: '#ffffff', map: sm.map ?? null, normalMap: sm.normalMap ?? null }); PAVING.set(sm, t) }
  return t
}
/** the way in's stone parts by name, each a copy of its own in the room's light (each piece of the scene its own object) */
function useStoneParts(names: string[]) {
  const gltf = useGLTF(STEPS_URL) as unknown as { scene: THREE.Group }
  const key = names.join()
  return useMemo(() => {
    const out: Record<string, THREE.Mesh> = {}
    for (const n of key.split(',')) {
      const src = gltf.scene.getObjectByName(n) as THREE.Mesh
      const m = src.clone()
      m.material = pavingOf(src.material as THREE.MeshStandardMaterial)
      m.position.set(0, 0, 0)
      m.receiveShadow = true
      out[n] = m
    }
    return out
  }, [gltf, key])
}
/** a part laid in the box from (x0, y0, z0) to (x1, y1, z1) of its parent's frame: its middle there, scaled from its made size to fit */
function laid(part: THREE.Mesh, made: [number, number, number], [x0, y0, z0]: number[], [x1, y1, z1]: number[]) {
  return { object: part, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] as [number, number, number],
    scale: [Math.abs(x1 - x0) / made[0], Math.abs(y1 - y0) / made[1], Math.abs(z1 - z0) / made[2]] as [number, number, number] }
}
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
      <mesh key={`${key}${i}`} position={[cx, (y0 as number) - (h as number) / 2, cz]} geometry={timberBox(W, h as number, L, BASE_TILE.along, BASE_TILE.across)}
        material={BASE_TIMBER[i]} />
    ))
  }
  const [gal, gly] = genkan
  // (under the genkan's stone, solid up to it, and in stone: granite courses from its stones down to the base's foot (item 287), where the
  // rest of the base is timber)
  const gTop = -step - GENKAN_SUNK - 0.004, gFoot = top - 0.33
  // (its street side in steps (item 342, the owner's: 「這邊做成石階」: it stood a sheer wall of three courses at the door): two treads of the
  // same granite down from the genkan's stone toward the street, each a third of the way down and STEP_GO further out, the doorway's width)
  const rise = (gTop - gFoot) / 3
  const stone = useStoneParts(['StoneStep0', 'StoneStep1', 'StoneStep2', 'StoneFoot'])
  return (
    <>
      {rects.flatMap(([al, ly], i) => layers(al, ly, `r${i}`))}
      <primitive {...laid(stone.StoneFoot, STONE_MADE.StoneFoot, [-gly[1], gFoot, gal[0]], [-gly[0], gTop, gal[1]])} />
      {[1, 2].map((k) => {
        const yTop = gTop - rise * k, z0 = gal[1] + STEP_GO * (k - 1) + 0.002, z1 = gal[1] + STEP_GO * k, xc = -(gly[0] + gly[1]) / 2
        const w = (gly[1] - gly[0] - 0.004 * k) / 2
        return <primitive key={`step${k}`} {...laid(stone[`StoneStep${k}`], STONE_MADE[`StoneStep${k}`], [xc - w, gFoot, z0], [xc + w, yTop, z1])} />
      })}
      {/* (the footing's face over the upper step, one course of whole stones laid on it (item 404, the owner's 「切得很怪」: the paving's one
          picture went on over it and the steps, its stones cut off wherever a face ended): from the upper step's tread up to the genkan's stone,
          1.5 mm proud of the footing's face, its foot a hair over the tread) */}
      <primitive {...laid(stone.StoneStep0, STONE_MADE.StoneStep0, [-gly[1], gTop - rise + 0.0005, gal[1] + 0.0015], [-gly[0], gTop, gal[1] + 0.0135])} />
    </>
  )
}
/** the floor's edging strip: how wide (in from the edge) and how high over the boards */
const EDGE_W = 0.04, EDGE_H = 0.02
/** the toilets' rooms out past the room's back edge (item 423, measured in the game, tests/e2e/_floorout423.mjs): their back wall's outer face
 * this far past WC_ROOM.D, their end walls' outer faces this far past their rooms' ends */
const WC_BACK_PAST = 0.032, WC_SIDE_WALL = 0.102
/**
 * A strip laid along a run of points (x, z) on the floor, `w` wide inward (to the left of the way it runs) and `h` high, its corners
 * mitred (each piece's inner edge cut back where it turns, so the two meet on the diagonal) and its two ends square: each piece a
 * four-sided slab, the lot one geometry.
 */
function mitredRun(pts: [number, number][], w: number, h: number) {
  const n = pts.length - 1
  const nrm = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz)
    return [-dz / l, dx / l]
  }
  // (each point's inner point: in square at the two ends, where the two pieces' inner lines cross at a corner)
  const ins = pts.map(([x, z], i): [number, number] => {
    if (i === 0 || i === n) { const m = i === 0 ? nrm(pts[0], pts[1]) : nrm(pts[n - 1], pts[n]); return [x + m[0] * w, z + m[1] * w] }
    const m0 = nrm(pts[i - 1], pts[i]), m1 = nrm(pts[i], pts[i + 1])
    const bx = m0[0] + m1[0], bz = m0[1] + m1[1], dot = m0[0] * bx + m0[1] * bz
    return [x + (bx / dot) * w, z + (bz / dot) * w]
  })
  const pieces = pts.slice(0, n).map((a, i) => {
    // (the slab's plan, in the shape's own plane (x, -z), stood up h: an extrusion winds its own faces outward)
    const shape = new THREE.Shape([a, pts[i + 1], ins[i + 1], ins[i]].map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  })
  const g = mergeGeometries(pieces)!
  pieces.forEach((q) => q.dispose())
  return g
}
const EDGING = new THREE.MeshToonMaterial({ color: '#3a2416' })
/** how much of the base's timber one repeat of its picture covers (BASE_TIMBER): four along, half across, a pixel as long as it's wide */
const BASE_TILE = { along: 4, across: 0.5 }
/**
 * The base's timber, dark: its rim board a shade lighter, its body boards laid the long way in courses, its toe board darkest. Real boards
 * (the owner's: it looked stretched, the same long streaks the whole way along): each course of boards of their own lengths (a metre or so
 * to nearly two), their butt joints staggered course to course, each board its own shade; the grain in each wavers and comes and goes
 * (lines start and stop along it, closer and wider), now and then a knot with its rings, a fine shine along some lines. Four along by half
 * across a repeat (BASE_TILE), 256 pixels a unit both ways; its ends meet (the boards and their grain wrap round), so it runs on unseamed.
 */
const BASE_TIMBER = (() => {
  const W = 1024, H = 128, PX = W / BASE_TILE.along
  const make = (base: string, courses: number, seed0: number) => {
    if (typeof document === 'undefined') return new THREE.MeshToonMaterial({ color: base })
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    let seed = seed0
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const ch = H / courses
    g.fillStyle = base
    g.fillRect(0, 0, W, H)
    for (let k = 0; k < courses; k++) {
      const y0 = k * ch
      // (the course's boards: lengths from 0.9 to 1.9 units, the first joint somewhere along, wrapping round the picture's ends)
      const joints: number[] = []
      let x = rnd() * PX
      while (joints.length === 0 || x < joints[0] + W - 0.9 * PX) { joints.push(x); x += (0.9 + rnd()) * PX }
      for (let b = 0; b < joints.length; b++) {
        const xa = joints[b], xb = b + 1 < joints.length ? joints[b + 1] : joints[0] + W
        // (the board's own: its shade, its grain's lines (each wavering, starting and stopping, some dark, a few with a shine), maybe a knot;
        // chosen once, drawn twice a picture's width apart, so a board over the right end comes back in at the left the same)
        const sh = (rnd() - 0.5) * 0.22
        const nl = Math.round(ch / 2.6)
        const lines = Array.from({ length: nl }, (_, i) => ({
          y: y0 + ((i + 0.3 + rnd() * 0.4) / nl) * ch, x0: xa - 20 + rnd() * (xb - xa) * 0.5, len: (0.35 + rnd() * 0.9) * (xb - xa),
          amp: 0.4 + rnd() * 1.8, f: (2 + rnd() * 5) / PX, ph: rnd() * 6.28, dark: rnd() < 0.78, a: rnd(), lw: 0.6 + rnd() * 1.2 }))
        const knot = rnd() < 0.35 ? { x: xa + (0.2 + rnd() * 0.6) * (xb - xa), y: y0 + (0.3 + rnd() * 0.4) * ch, r: Math.min(ch * 0.32, 4 + rnd() * 7),
          rings: Array.from({ length: 6 }, () => rnd()) } : null
        for (const off of [0, -W]) {
          g.save()
          g.beginPath(); g.rect(xa + off, y0, xb - xa, ch); g.clip()
          g.fillStyle = sh > 0 ? `rgba(255,220,180,${sh * 0.45})` : `rgba(0,0,0,${-sh * 0.8})`
          g.fillRect(xa + off, y0, xb - xa, ch)
          for (const ln of lines) {
            g.strokeStyle = ln.dark ? `rgba(12,6,2,${0.16 + ln.a * 0.24})` : `rgba(235,190,140,${0.07 + ln.a * 0.09})`
            g.lineWidth = ln.lw
            g.beginPath()
            for (let xx = ln.x0; xx <= ln.x0 + ln.len; xx += 6) {
              const yy = ln.y + ln.amp * Math.sin(xx * ln.f * 6.28 + ln.ph) + 0.6 * Math.sin(xx * ln.f * 17 + ln.ph * 2)
              if (xx === ln.x0) g.moveTo(xx + off, yy); else g.lineTo(xx + off, yy)
            }
            g.stroke()
          }
          // (a knot: a dark eye in a few rings)
          if (knot) {
            let n = 0
            for (let r = knot.r * 2.2; r > knot.r; r -= 2.2) {
              g.strokeStyle = `rgba(12,6,2,${0.12 + knot.rings[n++ % 6] * 0.1})`; g.lineWidth = 0.8
              g.beginPath(); g.ellipse(knot.x + off, knot.y, r * 1.9, r, 0, 0, 6.29); g.stroke()
            }
            g.fillStyle = 'rgba(10,5,2,0.55)'
            g.beginPath(); g.ellipse(knot.x + off, knot.y, knot.r * 1.5, knot.r * 0.75, 0, 0, 6.29); g.fill()
          }
          g.restore()
        }
        // (the butt joint: a dark line, a hair of light on one side of it)
        const jx = xa % W
        g.fillStyle = 'rgba(8,4,1,0.75)'; g.fillRect(jx - 1, y0, 2, ch)
        g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(jx + 1, y0, 1, ch)
      }
      // (the course's seam with the next: dark, a light edge under it)
      if (courses > 1) {
        g.fillStyle = 'rgba(8,4,1,0.7)'; g.fillRect(0, y0, W, 1.6)
        g.fillStyle = 'rgba(255,220,180,0.1)'; g.fillRect(0, y0 + 1.6, W, 1)
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return new THREE.MeshToonMaterial({ color: '#ffffff', map: t })
  }
  // (the rim board a single board deep; the body six courses to the half unit; the toe a single board)
  return [make('#5c3a22', 1, 9157), make('#3d2414', 6, 4271), make('#2a180c', 1, 7331)]
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
function timberBox(w: number, h: number, d: number, along = 1, across = 0.25) {
  const key = [w, h, d, along, across].map((v) => v.toFixed(3)).join()
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
      // (the longer side takes the grain, the texture's u; one repeat of the picture `along` long and `across` wide)
      if (du >= dv) uv.setXY(i, (u * du) / along, (v * dv) / across)
      else uv.setXY(i, (v * dv) / along, (u * du) / across)
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
      <mesh position={[-(ky0 + ky1) / 2, rise / 2, (kx0 + kx1) / 2]} geometry={timberBox(ky1 - ky0, rise, kx1 - kx0, BASE_TILE.along, BASE_TILE.across)} material={BASE_TIMBER[1]} receiveShadow />
      <FloorPiece w={ky1 - ky0} l={kx1 - kx0} tint="#d2c4b2" position={[-(ky0 + ky1) / 2, rise + 0.004, (kx0 + kx1) / 2]} />
      {/* (one step: half its height, outside its edge at the side counter's gate; the first counter's gate's and the one along its open end
          taken away (the owner's: pale planks lying across the aisle by the stools' feet)) */}
      {gates.side && <mesh name="dais-step-side" position={[-(gates.side[0] + gates.side[1]) / 2, rise / 4, kx0 - S / 2]} geometry={timberBox(gates.side[1] - gates.side[0] + 0.2, rise / 2, S)} material={TIMBER} castShadow receiveShadow ref={(m) => { if (m) inkModel(m) }} />}
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
  const stone = useStoneParts(['StoneSide'])
  const c = counters[0]
  const { along: [a0, a1], lay: [l0, l1] } = useMemo(() => roomOf(counters), [counters])
  const kitchen = useMemo(() => kitchenOf(counters), [counters])
  // (the genkan's corner, by the door, is left out of the boards: it's a step down, in stone)
  const g0 = c.length / 2 + GENKAN.along[0], gl = GENKAN.lay[1], D = GENKAN.depth
  // (how far down the base's top lies: below the sunk kitchen's floor, or the genkan's stone, whichever's lower)
  const baseDrop = Math.max(drop, D + 0.02)
  // (the edging's run, in the floor's frame (x = -lay, z = along): from the kamachi's end at the door round to the genkan's other side)
  const edging = useMemo(() => mitredRun([[-gl, a1], [-l1, a1], [-l1, a0], [-l0, a0], [-l0, g0]], EDGE_W, EDGE_H), [gl, a1, l1, a0, l0, g0])
  useEffect(() => () => edging.dispose(), [edging])
  // (and out behind the room's back edge (item 423, the owner's 「模型地板延伸到這邊」「廁所地板也得有」): the toilets' rooms stood out past it with
  // nothing under them, the base and the boards stopping at the back wall. A strip all along the back now, out to just past their back wall:
  // the base and its fill under all of it, the boards where their own floors aren't (beside them, behind the drinks fridges' wall), its own
  // edging round its three open sides. Along, from `al[0]` to the room's back edge; lay, `ly`; the toilets' rooms' own lay, `wc`)
  const back = useMemo(() => {
    const t = toiletsOf(counters)
    if (!t || counters.length < 2) return null
    const c1 = counters[1], half = WC_W + 0.06 + WC_ROOM.E + WC_SIDE_WALL
    const ends = [t.door - half, t.door + half].map((z) => c1.at.clone().addScaledVector(c1.along, z).sub(c.at).dot(c.lay))
    const wc: [number, number] = [Math.min(...ends), Math.max(...ends)]
    const ly: [number, number] = [Math.min(l0, wc[0] - EDGE_W - 0.005), Math.max(l1, wc[1] + EDGE_W + 0.005)]
    return { al: [a0 - (WC_ROOM.D + WC_BACK_PAST + EDGE_W + 0.003), a0] as [number, number], ly, wc }
  }, [counters, c, a0, l0, l1])
  const backEdging = useMemo(() => back && mitredRun([[-back.ly[1], back.al[1]], [-back.ly[1], back.al[0]], [-back.ly[0], back.al[0]], [-back.ly[0], back.al[1]]],
    EDGE_W, EDGE_H), [back])
  useEffect(() => () => backEdging?.dispose(), [backEdging])
  const A0 = back?.al[0] ?? a0, L0 = back?.ly[0] ?? l0, L1 = back?.ly[1] ?? l1
  const bases = useMemo(() => [[[a0, g0], [l0, l1]], [[g0, a1], [gl, l1]], ...(back ? [[back.al, back.ly]] : [])] as [[number, number], [number, number]][],
    [a0, g0, l0, l1, a1, gl, back])
  // (the kitchen's cut out of the boards: it lies lower, KitchenPit)
  const piece = (al: [number, number], ly: [number, number], k: string) => minus(al, ly, kitchen).map(([a, l], i) => (
    <FloorPiece key={`${k}${i}`} w={l[1] - l[0]} l={a[1] - a[0]} position={[-(l[0] + l[1]) / 2, 0.004, (a[0] + a[1]) / 2]} />
  ))
  return (
    <group name="room-floor" position={c.at} rotation-y={Math.atan2(c.along.x, c.along.z)}>
      {/* (none of it ever moves: folded together by material, it was some thirty-five draws; made again only if the room's shape changes) */}
      <StaticBatch key={`${a0}|${a1}|${l0}|${l1}|${drop}`}>
      {piece([a0, g0], [l0, l1], 'a')}
      {piece([g0, a1], [gl, l1], 'b')}
      {back && ([[back.ly[0], back.wc[0]], [back.wc[1], back.ly[1]]] as [number, number][]).filter(([p, q]) => q - p > 0.02).map(([p, q], i) => piece(back.al, [p, q], `k${i}`))}
      <ShopBase rects={bases} genkan={[[g0, a1], [l0, gl]]} step={D} drop={baseDrop} />
      {/* (the floor's edge, dark, all the way round but where the genkan's kamachi is: from the kamachi's end by the door, round the
          room's open end, along its open side, up the side wall and along the back wall to the genkan, each corner mitred (the owner's: the
          strip along the side wall stopped short of the corner, and the open edges had none)) */}
      <mesh geometry={edging} material={EDGING} />
      {backEdging && <mesh geometry={backEdging} material={EDGING} />}
      {/* (the whole shop's soft shadow on the ground it stands on, under its base and spreading out past it a little) */}
      <mesh position={[-(L0 + L1) / 2 - 0.12, -baseDrop - 0.34, (A0 + a1) / 2 + 0.1]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[(L1 - L0) + 2.4, (a1 - A0) + 2.4]} />
        <meshBasicMaterial map={GROUND_SHADOW} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* (and a solid fill under the boards right down to the base: round the kitchen's well when it's sunk, under the kitchen's dais as
          well when it's raised; nothing to see through between the floor and the base) */}
      {bases.flatMap(([al, ly], n) => (drop > 0 ? minus(al as [number, number], ly as [number, number], kitchen)
        : [[al, ly] as [[number, number], [number, number]]]).map(([a, l], i) => (
        // (its sides, showing as the step down into the kitchen, in the base's dark timber boards)
        <mesh key={`fill${n}${i}`} position={[-(l[0] + l[1]) / 2, 0.001 - (baseDrop + 0.004) / 2, (a[0] + a[1]) / 2]}
          geometry={timberBox(l[1] - l[0], baseDrop + 0.004, a[1] - a[0], BASE_TILE.along, BASE_TILE.across)} material={BASE_TIMBER[1]} />
      )))}
      {drop > 0 ? <KitchenPit counters={counters} drop={drop} /> : <KitchenDais counters={counters} rise={-drop} />}
      {/* (the wall's foot, and the room's open end, down to the genkan's pebble-wash (its stones, step and threshold: GenkanFloor, below)) */}
      {/* (in the genkan's stone, as its footing is (item 287): they were dark boards, the doorway's edge read as wood from above) */}
      <primitive {...laid(stone.StoneSide, STONE_MADE.StoneSide, [-l0 - 0.01, -(D + GENKAN_SUNK), g0], [-l0 + 0.01, 0, a1])} />
      {/* (the room's open end at the door, from the boards down to the footing, is gone (item 407, the owner's 「這片到底是甚麼? 拿掉」): the
          genkan's stone lies 10 cm under the boards, and at the door it stood up over the genkan's stone like a low wall) */}
      </StaticBatch>
      {/* the genkan: its stones laid crazy-paving in pebble-wash, the shoe-off stone at the step, the threshold, the polished keyaki step
          (item 185: one flat picture of stones and two thin boards before) */}
      <GenkanFloor x={[-gl, -l0]} z={[g0, a1]} />
    </group>
  )
}
/**
 * The genkan's floor and step (blender/genkanfloor.py, item 185, the owner's, 2026-11-15: "the genkan's doorway, its stone step and floor,
 * too plain"; it was one flat picture of a grid of grey slabs in thick pale joints, and the step two thin dark boards): natural stones laid
 * crazy-paving, each its own outline, tint (its points' colour) and chamfer, each a little domed (item 265), in a pebble-wash (洗い出し) seen in
 * the joints; a rush rug lying on it (item 264: the doormat and the shoe-off stone that stood at the step are gone; people stand on the rug:
 * bar.ts's GENKAN_RUG, genkanY); a dark granite threshold across the
 * doorway; and the step's edge (上框), a polished keyaki beam along both open sides, mitred at the corner. Modelled in RoomFloor's own frame,
 * the genkan as it is (x 0.42..1.6569, z 2.4..3.7155); fitted to it as it is now, if that's changed. Toon-shaded as the room is, its pictures'
 * relief in their normal maps; one draw for each of its three materials (stone, pebbles, wood)
 */
const GENKAN_FLOOR_URL = import.meta.env.BASE_URL + 'models/genkanfloor.glb'
useGLTF.preload(GENKAN_FLOOR_URL)
/** how far under the genkan's stone its pebble-wash lies (the model's), for the walls' foot and the base to reach down to */
const GENKAN_SUNK = 0.012
const GENKAN_MODELLED = { x: [0.42, 1.6569], z: [2.4, 3.7155] }
const GenkanFloor = memo(function GenkanFloor({ x, z }: { x: [number, number]; z: [number, number] }) {
  const gltf = useGLTF(GENKAN_FLOOR_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = (gltf.scene.getObjectByName('GenkanRoot') ?? gltf.scene).clone(true)
    // (the shoe-off stone and the threshold their own material (the same pictures), so they're drawn apart from the flat stones and take the
    // room's ink line round them as the step does: a raised stone the floor's colour, unlined, didn't show as one)
    const made = new Map<string, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      const raised = /Kutsunugi|Sill/.test(m.name)
      const key = `${src.uuid}|${raised}`
      let t = made.get(key)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: '#ffffff', map: src.map ?? null, normalMap: src.normalMap ?? null, vertexColors: !!m.geometry.attributes.color })
        if (src.normalMap) (t as THREE.MeshToonMaterial).normalScale.set(0.8, 0.8)
        t.name = src.name + (raised ? 'Raised' : '')
        made.set(key, t)
      }
      m.material = t
      m.receiveShadow = true
      // (what stands up off the floor throws its shadow: the shoe-off stone, the threshold and the step; the flat stones don't)
      m.castShadow = raised || /Kamachi/.test(m.name)
    })
    inkModel(r, (m) => !/Kutsunugi|Sill|Kamachi/.test(m.name), { width: 0.0008, weld: true })
    return mergeByMaterial(r)
  }, [gltf])
  // (fitted to the genkan as it is: the same as modelled, unless the room's been laid out otherwise)
  const sx = (x[1] - x[0]) / (GENKAN_MODELLED.x[1] - GENKAN_MODELLED.x[0]), sz = (z[1] - z[0]) / (GENKAN_MODELLED.z[1] - GENKAN_MODELLED.z[0])
  return (
    <group position={[x[0] - GENKAN_MODELLED.x[0] * sx, 0, z[0] - GENKAN_MODELLED.z[0] * sz]} scale={[sx, 1, sz]}>
      <primitive object={obj} />
    </group>
  )
})

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

/** a stool pulled out and pushed in (the bar's frame): where its customer stops behind it, how far it's pulled out, how far they push it back
 * getting up; how long pulling it out, stepping onto it, sliding in (or home) take, and when, getting up, they push it home before they go */
const STOOL_STAND = 0.42, STOOL_OUT = 0.25, STOOL_LEAVE = 0.22
/**
 * Where each stool's seat and each place on the waiting bench are as they've been moved by hand (edit mode): a marker hung in each, where it
 * was laid out (the owner's, 2026-11-10: a seat goes with its chair; moved, its customer sat where it had been). A customer near their own
 * stool is moved by as much as it has been (all of it within 0.4 of it, none from 1.2: the way to it bends to it); one on the bench sits
 * where the bench is
 */
const SEAT_MARKS = new Map<number, THREE.Object3D>()
const BENCH_MARKS = new Map<number, THREE.Object3D>()
const SEAT_SHIFT = new THREE.Vector3()
const BENCH_AT = Array.from({ length: BENCH_SEATS }, () => new THREE.Vector3())
const BENCH_A = new THREE.Vector3(), BENCH_B = new THREE.Vector3()
const STOOL_PULL_S = 0.25, STOOL_STEP_S = 0.3, STOOL_SLIDE_S = 0.4, STOOL_HOME_AT = 0.4
/** the way back from a place's stool toward the aisle (level) */
const backOf = (st: { stool: THREE.Vector3; aisle: THREE.Vector3 }) => st.aisle.clone().sub(st.stool).setY(0).normalize()
type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave' | 'wcGo' | 'wcIn' | 'wcWash' | 'wcBack'; t: number
  /** (in a toilet) sat on it just now; whether they switched its light on going in (and so put it out after, if they're the last); their
   * way out from it to the washstand once they're up (and how far along it, in seconds walked) */
  wcSit?: boolean; wcLit?: boolean; wcOut?: { path: THREE.Vector3[]; len: number; t: number }
  /** past the toilet's door on the way in (its light's switch on the post between the two doors, outside: item 203) */
  wcPast?: boolean
  /** done eating, a tissue to their mouth a moment before they get up (the owner's): since when */
  wipeAt?: number
  /** their drink, sipped now and then as they sit (the bar's clock): when this sip began (none under way: undefined), when the next is
   * due; how much of it's gone (0 to 1) */
  sipAt?: number; sipNext?: number; drunk?: number
  /** (a mouthful of their miso soup under way since (the bar's clock), and when the next is due (item 345)) */
  soupSipAt?: number; soupNext?: number
  /** how many drinks they've had from the fridge (item 210: another when one's drunk, up to DRINKS_MAX) */
  drinks?: number
  /** at their stool: seconds into pulling it out and stepping up onto it (coming in), into sliding in with it (sat) */
  pullT?: number; slideT?: number; pulledSound?: boolean
  /** called to their stool off the genkan's bench: where they sat, and their way in from there */
  from?: THREE.Vector3
  fromWay?: { path: THREE.Vector3[]; len: number }
  /** their shoes in a cubby of the cupboard; welcomed in */
  shoesIn?: boolean; welcomed?: boolean
  /** (leaving) how long they've stood in the queue for the till, or for the genkan's step; what's been said on the way out (getting up,
   * paying, thanks) */
  hold?: number; said?: number
  /** (coming in) how long they've waited for the genkan's step, someone else on it (item 414) */
  stepHold?: number
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
  /** going out of the door: how long (s) they've been fading */
  fadeT?: number
  /** in the house's slippers (inside, past the genkan's step), or their own shoes */
  slippers?: boolean
  /** the height they were last shown at (item 410: eased up and down the sliding door's steps) */
  shownY?: number }
/** how long they stand at the genkan's step changing their shoes */
const SHOES_S = 1.2
/** (item 410) how long one coming stands on the step at the sliding door while it's slid open (game/slideDoor: it's wanted open DOOR_SEEN_S
 * after they show out there, and open in DOOR_OPEN_S; a beat more); one going, just in from it as they slide it */
const DOOR_WAIT_S = 0.9, DOOR_SLIDE_S = 0.35
/** how fast a customer's height may change (a second, the bar's units): a step's 0.13 in a little over a tenth of a second (item 410) */
const STEP_Y_RATE = 1.2
/** (their shoes go into the cupboard now: none left out on the genkan's stones) */
const NO_SHOES: { at: THREE.Vector3; turn: number; colour: string }[] = []
/** the money a customer's just paid, over their head: rising a hand's width and fading in 1.6 s, following them */
function PayFloat({ text, follow, done }: { text: string; follow: () => THREE.Object3D | undefined; done: () => void }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const at = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const o = g.current, who = follow()
    t.current += Math.min(dt, 0.1)
    if (t.current > 1.6) { done(); return }
    if (!o || !who || !o.parent) return
    o.position.copy(o.parent.worldToLocal(who.getWorldPosition(at))).add(new THREE.Vector3(0, 0.62 + t.current * 0.12, 0))
  })
  return (
    <group ref={g}>
      <Html center zIndexRange={LABEL_Z} style={LABEL_STYLE}><span className="pay-float">{text}</span></Html>
    </group>
  )
}
/** how long they stand at the till paying: the bill rung up, the drawer out and in, the change given */
const PAY_S = 5.6
/** how far back the next one waits while someone's paying */
const QUEUE_GAP = 0.6
/** the genkan's step, one at a time changing their shoes, the next a body's length (QUEUE_GAP) back till they've stepped on (item 414:
 * game/genkanStep) */
const STEP_TURN = newStepTurn()
/** what one paying at the till is rung up for, a line a dish and then their drink (item 182: at the menu's prices, as App's books have it;
 * the old flat price only for one whose bill isn't known; item 195: as their bill stands, less what was given back for what they didn't
 * get, and the drink on it) */
function billFor(x: { id: number; items?: number; drink?: DrinkId }) {
  const n = Math.max(1, x.items ?? 2), owed = GUEST_BILLS.of(x.id)
  const each = owed ? dishLines(owed.paid, n) : Array.from({ length: n }, () => billOf(1))
  const drink = owed ? owed.drink ?? 0 : x.drink ? (DRINKS.find((d) => d.id === x.drink)?.price ?? billOf(1, x.drink) - billOf(1)) : 0
  // (and a line each side: the miso soup or the sake with their dishes, item 203)
  const sides = owed?.side?.map((q) => q.price) ?? []
  const parts = drink ? [...each, ...sides, drink] : [...each, ...sides]
  return { parts, items: each.length, bill: parts.reduce((a, b) => a + b, 0) }
}
/** a server's errands, for which their tray's put down (item 249): sweeping up and wiping the floor, the till, the takeaway's bag, the skewers,
 * washing up and their hands at the sink. The rest (fetching what's plated, carrying it, setting it down, clearing, the dried plates, the sake)
 * is carried on it, and at their place they hold it */
const TRAY_ERRANDS = new Set(['washGo', 'wash', 'handGo', 'handwash', 'toBox', 'boxTake', 'toTill', 'hand', 'toStand', 'standPut', 'skTrayGo', 'skTake',
  'skSinkGo', 'skWash', 'skHolderGo', 'skPut', 'tillGo', 'tillAt', 'sweepGo', 'sweep', 'wipeFloor'])
/** figures placed where they are at least once since they were put in the scene (till then hidden, item 242) */
const placedOnce = new WeakSet<THREE.Object3D>()
/** a walk that stops a while at a point along it: how far along, at a time when it would have been `d` */
const withPause = (d: number, at: number, hold: number) => (d < at ? d : d < at + hold ? at : d - hold)
/**
 * A customer's moment at the genkan's step (`f` 0..1 through it; outside it, nothing): turned to the shoe cupboard, a little bow; their
 * cubby (by their seat) opened a moment, their shoes put in it coming in (`entering`), taken out of it going
 */
function shoeStep(s: Shown, g: THREE.Object3D | undefined, f: number, entering: boolean) {
  if (!g) return
  if (f < 0 || f > 1) { g.rotation.x = 0; return }
  const cell = s.seat % SHOE_CUBBIES
  if (SHOE_CELLS.ready && g.parent) {
    const at = g.parent.worldToLocal(SHOE_CELLS.at.clone())
    g.rotation.y = Math.atan2(at.x - g.position.x, at.z - g.position.z)
  }
  g.rotation.x = 0.16 * Math.sin(Math.PI * f)
  // (its door open while they're at it, shut a moment after)
  if (f > 0.12 && f < 0.85) SHOE_CELLS.kick.set(cell, performance.now())
  if (f > 0.55 && entering && !s.shoesIn) { s.shoesIn = true; SHOE_CELLS.shoes.set(cell, SHOE_COLOURS[s.id % 5]) }
  if (f > 0.55 && !entering && s.shoesIn !== false) { s.shoesIn = false; SHOE_CELLS.shoes.delete(cell) }
}
/** what's set at a customer's place (their soy, their drink) and their shoes left in the genkan: shared shapes */
/** the miso soup's bowl at a customer's place: how tall */
const SOUP_BOWL_H = 0.045
const NO_SOUPS: THREE.Vector3[] = []
const AT_SEAT = {
  soy: new THREE.CircleGeometry(0.03, 16),
  daikon: new THREE.SphereGeometry(0.011, 8, 6),
  shoe: new THREE.SphereGeometry(1, 8, 6),
  // (a lacquered soup bowl, its foot ring narrower, open at the top, and the miso soup in it)
  // (open at its top, its inside drawn too: closed, its lid hid the soup)
  bowl: new THREE.CylinderGeometry(0.048, 0.03, SOUP_BOWL_H, 16, 1, true).translate(0, SOUP_BOWL_H / 2, 0),
  broth: new THREE.CircleGeometry(0.045, 16),
}
/** the colours of the shoes left at the door, by the customer's id */
const SHOE_COLOURS = ['#2a2220', '#5a3a22', '#f2f0ea', '#1c1c22', '#7a2a22']
/** how many of each SeatBits holds at most */
const BITS_MAX = 24
const BIT_MATS = {
  shoe: new THREE.MeshToonMaterial({ color: '#ffffff' }),
  soy: new THREE.MeshToonMaterial({ color: '#3a1c0c' }),
  daikon: new THREE.MeshToonMaterial({ color: '#f2efe4' }),
  bowl: new THREE.MeshToonMaterial({ color: '#7a1a14', side: THREE.DoubleSide }),
  broth: new THREE.MeshToonMaterial({ color: '#b07a3a' }),
}
const BIT_M = new THREE.Matrix4(), BIT_N = new THREE.Matrix4(), BIT_Q = new THREE.Quaternion(), BIT_C = new THREE.Color()
const BIT_ID = new THREE.Quaternion()
const BIT_UP = new THREE.Vector3(0, 1, 0), BIT_X = new THREE.Vector3(1, 0, 0), BIT_P = new THREE.Vector3(), BIT_S = new THREE.Vector3()
/**
 * The customers' little things, each kind one draw for all of them (they were two meshes a customer, a draw each: some thirty a frame with
 * the bar full): the pairs of shoes left on the genkan's stone, and the soy in the dish at each seated customer's place with its dab of
 * daikon. Laid out as they were, each the shape and colour it had.
 */
const SeatBits = memo(function SeatBits({ shoes, soys, soups = NO_SOUPS }: { shoes: { at: THREE.Vector3; turn: number; colour: string }[]; soys: THREE.Vector3[]; soups?: THREE.Vector3[] }) {
  const shoe = useRef<THREE.InstancedMesh>(null), soy = useRef<THREE.InstancedMesh>(null), daikon = useRef<THREE.InstancedMesh>(null)
  const bowl = useRef<THREE.InstancedMesh>(null), broth = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const a = bowl.current, b = broth.current
    if (!a || !b) return
    const n = Math.min(BITS_MAX, soups.length)
    for (let i = 0; i < n; i++) {
      a.setMatrixAt(i, BIT_M.compose(soups[i], BIT_ID, BIT_S.set(1, 1, 1)))
      b.setMatrixAt(i, BIT_M.compose(BIT_P.copy(soups[i]).setY(soups[i].y + SOUP_BOWL_H - 0.008), BIT_Q.setFromAxisAngle(BIT_X, -Math.PI / 2), BIT_S.set(1, 1, 1)))
    }
    a.count = n; b.count = n
    a.instanceMatrix.needsUpdate = true; b.instanceMatrix.needsUpdate = true
  }, [soups])
  useLayoutEffect(() => {
    const m = shoe.current
    if (!m) return
    // (its colours there from the first, the empty shop: made with the first pair, the program it was warmed with as the shop loaded wasn't
    // the one it then wanted, a hitch as the first customer came in)
    if (!m.instanceColor) m.setColorAt(0, BIT_C.set('#000000'))
    let n = 0
    for (const sh of shoes) {
      BIT_M.compose(sh.at, BIT_Q.setFromAxisAngle(BIT_UP, sh.turn), BIT_S.set(1, 1, 1))
      for (const sd of [-1, 1]) {
        if (n >= BITS_MAX) break
        BIT_N.compose(BIT_P.set(sd * 0.028, 0.018, 0), BIT_ID, BIT_S.set(0.025, 0.018, 0.06)).premultiply(BIT_M)
        m.setMatrixAt(n, BIT_N)
        m.setColorAt(n, BIT_C.set(sh.colour))
        n++
      }
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [shoes])
  useLayoutEffect(() => {
    const a = soy.current, b = daikon.current
    if (!a || !b) return
    const n = Math.min(BITS_MAX, soys.length)
    for (let i = 0; i < n; i++) {
      a.setMatrixAt(i, BIT_M.compose(soys[i], BIT_Q.setFromAxisAngle(BIT_X, -Math.PI / 2), BIT_S.set(1, 1, 1)))
      b.setMatrixAt(i, BIT_M.compose(BIT_P.copy(soys[i]).add(BIT_S.set(0.008, 0.004, 0.004)), BIT_ID, BIT_S.set(1, 0.5, 1)))
    }
    a.count = n; b.count = n
    a.instanceMatrix.needsUpdate = true; b.instanceMatrix.needsUpdate = true
  }, [soys])
  // (never culled as a whole: their bounds would be the first few's)
  return (
    <>
      <instancedMesh ref={shoe} args={[AT_SEAT.shoe, BIT_MATS.shoe, BITS_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={soy} args={[AT_SEAT.soy, BIT_MATS.soy, BITS_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={daikon} args={[AT_SEAT.daikon, BIT_MATS.daikon, BITS_MAX]} count={0} frustumCulled={false} />
      <instancedMesh ref={bowl} args={[AT_SEAT.bowl, BIT_MATS.bowl, BITS_MAX]} count={0} frustumCulled={false} castShadow />
      <instancedMesh ref={broth} args={[AT_SEAT.broth, BIT_MATS.broth, BITS_MAX]} count={0} frustumCulled={false} />
    </>
  )
})
/** the women's kinds, who use the women's toilet */
const HER = new Set(['officeLady', 'schoolgirl', 'yukataLady', 'grandma', 'maidCoser', 'gyaru', 'housewife', 'nurse'])
/** how often one sat waiting gets up to go to the toilet (per second), and how long they're in there */
const WC_RATE = 1 / 240
const WC_STAY = 6
/** seconds from the stall's way in to sat on the toilet; and how far a customer sat on it is lowered from a stool's seat (FolkFigure's SEAT,
 * 0.31) to its seat (blender/wc.py's bowl, 0.40 up) */
const WC_TO_SEAT = 1.0, WC_SIT_LIFT = 0.40 - 0.31
/** how long each one's in the toilet: 4 to 6 seconds, their own (the owner's) */
const wcStayOf = (id: number) => WC_STAY - 2 + ((id * 7919) % 100) / 50
/** and how long they wash their hands at the washstand after, the tap running (Restroom's HAND_MS) */
const HAND_S = HAND_MS / 1000
/** after washing, their hands held under the hand dryer on the wall by the washstand (the owner's: no towel; Restroom's WcDryer blows) */
const HAND_DRY_S = 1.5
/** and to go and get themselves a drink from the fridge: soon after they've sat down, waiting or eating (item 210: an izakaya in Osaka, とりあえず
 * ビール: about half of them had one, once), and another once it's drunk, up to DRINKS_MAX; how long they stand choosing */
const DRINK_RATE = 1 / 12
const REFILL_RATE = 1 / 10
const DRINKS_MAX = 3
/** (in development, `__drinkRate` in the console makes them thirstier, for watching it) */
const drinkRate = () => (import.meta.env.DEV ? (window as unknown as { __drinkRate?: number }).__drinkRate : undefined) ?? DRINK_RATE
/** (and `__wcRate` readier for the toilet) */
const wcRate = () => (import.meta.env.DEV ? (window as unknown as { __wcRate?: number }).__wcRate : undefined) ?? WC_RATE
const DRINK_STAY = 2.25

/** a plate laid on the plating place for a seat, its food put on it there ('ready'), carried to the seat by a server ('carry'), set at it ('set'), left
 * at it dirty till a server comes for it ('dirty') and on their tray to the sink ('taken'); with no server to carry anything (a bar with
 * nobody on its floor), off the racks to the seat by itself ('serve'), cleared away to the sink by itself ('clear', after a pause), and
 * washed, back to the racks ('home') */
type PlateRun = { key: number; seat: number; guest: number; phase: 'ready' | 'serve' | 'carry' | 'set' | 'dirty' | 'taken' | 'clear' | 'home'; t: number; from: THREE.Vector3
  /** which plate it is (game/plateSize, item 228: by what its seat ordered), for all its run, to the seat and back */
  kind?: PlateKind
  /** (clearing) its place on the dirty stack in the sink, taken when it sets off, so two cleared at once don't aim for the same one; (going
   * home) where on the racks it goes */
  to?: THREE.Vector3
  /** (on the plating place) its slot there */
  slot?: number
  /** (done with) the crumpled tissue they wiped their mouth with, beside it, from its middle: cleared with it (the owner's) */
  tissue?: [number, number, number]
  /** (done with) the sticks left on it, of what was eaten off it: into the bin by the sink with them */
  sticks?: number
  /** (done with) the whole fish eaten off it, their bones left on it; and the customer's emptied glass beside it, cleared with it */
  bones?: number; glass?: [number, number, number]
  /** (done with) what they drank, its bottle or can left where it stood (and a sake's cup), and how much was left in it */
  drink?: DrinkId; level?: number
  /** (done with) how dirty it's been left (game/plates' plateDirt: by how much was eaten off it) */
  dirt?: number }
const STACK_GAP = 0.026
/** the step between two round plates nested in a stack (item 358, the owner's 「漂浮?」: at STACK_GAP each stood a plate's whole depth and
 * more over the one under it, a gap of air between every two, a stack of plates floating over one another): a real stack's, about a third
 * of a plate's depth (the round one 0.0198 deep, its outline 0.0207: clear of the one under's outline and its smear) */
const NEST_GAP = 0.0055
/** (a ray down onto one surface, made once: the counter's top under the sink's stack) */
const SURFACE_RAY = new THREE.Raycaster(), SURFACE_HITS: THREE.Intersection[] = [], TOP_FROM = new THREE.Vector3(), DOWN_Y = new THREE.Vector3(0, -1, 0)
const UP_Y = new THREE.Vector3(0, 1, 0)
/** what was left on cleared plates thrown into the bins by the sink (item 208, game/bins): the sticks, the fish's bones and the crumpled
 * tissues into the rubbish bin, the bottles and cans into the recycling bin; each bin's lid lifted a moment for what goes in it */
function binThrow(plates: readonly PlateRun[]) {
  let b = SINK_BIN.b
  const was = { ...b }
  for (const x of plates) {
    b = toss(b, 'stick', x.sticks ?? 0)
    b = toss(b, 'bone', x.bones ?? 0)
    if (x.tissue) b = toss(b, 'tissue')
    if (x.drink) b = toss(b, (isCan(x.drink) ? 'can' : 'bottle') as Waste)
  }
  SINK_BIN.b = b
  const now = performance.now()
  if (b.rubbish > was.rubbish) SINK_BIN.lids.rubbish.until = now + 1400
  if (b.recycle > was.recycle) SINK_BIN.lids.recycle.until = now + 1400
}
const SERVE_S = 0.55
const CLEAR_S = 0.6
const CLEAR_DELAY = 1.0
/** a plate's flight takes at least this long a unit of its way (the bar's): from the racks, or to the sink, it's across the room */
const FLY_PER = 0.3
const HOME_S = 0.8
/** what's set out on the plating place goes once it's been all there this long (a moment for anything more for the seat to come off the fire) */
const READY_S = 1.2
/** a plate's size on the cook table at the plating place (a little smaller: the room there's between the tasting bowl and the bin), and how many of its stack are drawn at most (a few over what the kitchen
 * keeps there: those put back from a slot whose customer left) */
const ON_TABLE = 0.85
/** the plater's rice bowl (a wooden rice-washing bowl, open), and the rice in it */
/** the plater's hand props for the fire and the soup: binchotan sticks, a wooden dipper (made once) */
const X_AXIS = new THREE.Vector3(1, 0, 0)
const COAL_STICK_GEO = new THREE.CylinderGeometry(0.009, 0.01, 0.15, 6)
const COAL_STICK_MAT = new THREE.MeshToonMaterial({ color: '#2b2b2e' })
const DIPPER_CUP_GEO = new THREE.CylinderGeometry(0.04, 0.034, 0.05, 12, 1, true)
const DIPPER_HANDLE_GEO = new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6)
const DIPPER_MAT = new THREE.MeshToonMaterial({ color: '#c8a273' })
const DIPPER_WATER_GEO = new THREE.CircleGeometry(0.037, 12)
const DIPPER_WATER_MAT = new THREE.MeshToonMaterial({ color: '#9ccbe0', transparent: true, opacity: 0.8 })
/** how often (seconds) the plater goes to stir the miso soup when there's nothing else, and for how long */
const SOUP_EVERY = 40, STIR_S = 3
/** (item 392) how often the plater, with nothing else wanting, grates daikon for the fish's plates (s), and how long at it */
const GRATE_EVERY = 55, GRATE_S = 4.2
/** the water bucket up on the cook table by the third cook's bay (Roasting's TABLE_BIN): a plater whose place is nearer it than DIP_NEAR
 * (the third cook, in his bay) steps toward it in his place till it's DIP_REACH off and dips it from there, his arm and the dipper the rest
 * (the bar's units) */
const DIP_NEAR = 0.7, DIP_REACH = 0.21
const RICE_BOWL_GEO = new THREE.CylinderGeometry(0.1, 0.07, 0.07, 16, 1, true).translate(0, 0.035, 0)
const RICE_IN_GEO = new THREE.CylinderGeometry(0.092, 0.08, 0.025, 16)
/** how long a server wipes the bar down where a plate was cleared: two strokes along and back */
const WIPE_S = 1.6
/**
 * Clearing a place by hand (item 231, the owner's 「收東西跟擦桌子的動畫都還很不OK」: the plate slid off the bar onto the tray by itself, no hand
 * near it, and the bar was wiped on one line twice in a second): from their arriving at the seat, the right hand goes out to the plate's
 * rim and the left to the tray's side (CLEAR_REACH), the plate's lifted with the hand in a little arc onto the tray (CLEAR_LIFT) and let go
 * (CLEAR_SET); then the cloth's out and the place wiped where it stood (WIPE_S), the tray still in the left hand. The shop's seconds.
 */
const CLEAR_REACH = 0.35, CLEAR_LIFT = 0.4, CLEAR_SET = 0.15
const CLEAR_WIPE_AT = CLEAR_REACH + CLEAR_LIFT + CLEAR_SET
/** each server's two hands while clearing (the world), and the scratch for finding them */
const CLEAR_HANDS = [0, 1, 2, 3].map(() => ({ left: new THREE.Vector3(), right: new THREE.Vector3() }))
const CLEAR_SIDE = new THREE.Vector3()
/** how far out in front the wiping hand is in the figure's frame (StaffFigure's WIPE_HAND.z): the stroke's middle, for the cloth over the place */
const WIPE_HAND_Z = 0.44
const CLEAR_TOWARD = new THREE.Vector3()
/** where they stand to wipe it: along the bar from the seat's middle (between its stool and the next), and back from the bar's middle line
 * (a step back from its edge, reaching to it: right up against it, their face was just over the top, at their shoulders) */
const WIPE_STAND = [0.34, 0.53] as const
/** the cloth they wipe it with: a folded white towel */
const RAG_GEO = new RoundedBoxGeometry(0.085, 0.007, 0.05, 1, 0.003)
const PASS_STACK_SHOWN = STACK_CAP + 3
/** a plate's size in the sink, against its own: its own (item 203, the owner's 「盤子進水槽變小」: 0.78 when every plate was the one big round
 * plate and the sink's stack had to fit; the plates sized to what's on them since (item 228), none shrinks on its way in or grows on its way
 * out) */
const IN_SINK = 1
/** the most of the sink's dirty plates drawn stacked in it: as many as stand clear under the tap's spout (cleared on the way back (item 53),
 * the sink took up to twenty-five on an ordinary evening, a stack up through the tap); the rest are counted and washed, the stack no higher */
const SINK_SHOWN = 12
/** a plate standing in the draining basket: its size, a third of its depth */
const IN_DRAIN: [number, number, number] = [IN_SINK, IN_SINK * 0.3, IN_SINK]
/** the sink's tap running, a plate washed every this many seconds, lifted out and back to the racks */
const WASH_EACH = 0.5
/**
 * Where one stands before a counter across from something on it (`at`), as far out from the counter's front as one stands at another thing on
 * it (`stand`, before `thing`): on the line through `stand` square across the counter (the way from `stand` to `thing` is into it), across
 * from `at`. (Item 387: moved back from `at` as far as `stand` is from `thing`, a thing further in on the counter put them in it)
 */
function frontOf(at: THREE.Vector3, stand: THREE.Vector3, thing: THREE.Vector3) {
  const into = thing.clone().sub(stand).setY(0)
  if (into.lengthSq() < 1e-8) return at.clone().setY(0)
  into.normalize()
  return at.clone().setY(0).addScaledVector(into, -at.clone().sub(stand).setY(0).dot(into))
}
/** what stands on the kitchen's floor that a server crossing it to the racks goes round (with the cook's table) */
const KITCHEN_BLOCKS = new Set(['warmer', 'prepcounter', 'ricetub', 'misopot', 'denkinabe', 'freezer', 'platerack', 'platerack2', 'lowrack', 'sink', 'sink-bin', 'produce', 'vegcrate', 'vegcrate2', 'vegbasket', 'coalsack', 'servecounter'])
/** how much room is left round each of them for a server to pass (the bar's units) */
const PASS_ROOM = 0.13
/** with no cashier at the till (item 203: the register rang them up by itself): how long (the bar's clock, s) one waits there for a server to
 * come round to it before paying as before (no one stuck at the door all night: the shop closing, every server tied up). At 30, on an
 * ordinary evening x2 a server came for 12 of 20 (4 to 27 s); 45, a busy shop's wait */
const TILL_WAIT_MAX = 45
/** (the till's call taken by the third cook, not a server: tillCall's `staff`) */
const TILL_BY_PLATER = 99
/** where a takeaway waits in the genkan, off the line those paying walk out along (item 203): this far to its side, toward the till, and a
 * second this much further (the genkan's stone reaches 0.6 that way: tests/e2e/_genkan203.mjs) */
// (item 410: in a little from the sliding door, its leaves on the sill (-0.25 stood one's head in the shut south leaf); a second along the
// line toward the till rather than out beside the first, where the door is)
const TAKEOUT_ASIDE = -0.22, TAKEOUT_NEXT = 0.25
/** those waiting for a stool, at the genkan's step: how long they stop there to step out of their shoes (or into them going), and how far
 * the pair's left on the stone back from where they stepped up, toes out (item 203: the bench is on the room's boards, and they walked up
 * onto them in their shoes) */
const SHOE_OFF_S = 0.8
const SHOES_BACK = 0.13
/** the step stool's half its width and its depth, in its own frame (blender/stepstool.py: 0.66 by 0.40), and the ramp at its edges over
 * which one stepping onto it comes up to its top (the bar's units) */
const STOOL_HALF = [0.33, 0.2] as const
const STOOL_STEP = 0.045
/** how fast one goes up onto it or down off it (the bar's units a second: its 0.16 in about a quarter of a second) */
const STOOL_CLIMB = 0.6
// (the same shape as the big plate by the fire, smaller: a foot, a shallow well, a lifted rim)
const PLATE_R = 0.13
const PLATE_GEO = wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.012], [0.47, 0.03], [0.5, 0.038], [0.49, 0.042], [0.44, 0.026],
  [0.3, 0.01], [0, 0.01]] as [number, number][]).map(([x, y]) => [x * PLATE_R * 2, y] as [number, number]), PLATE_R)
const SMEAR_GEO = new THREE.CircleGeometry(0.058, 18)
/** the long plate (長角皿, blender/longplate.py, item 228): made in the bar's units at the size it's drawn, its length along x; its lip a band
 * of thickness, a foot ring under it (item 251, the owner's: 「盤子造型再精美些有點太簡陋，厚度感要出來」「但模型要簡易」) */
const LONG_PLATE_URL = import.meta.env.BASE_URL + 'models/longplate.glb'
useGLTF.preload(LONG_PLATE_URL)
let LONG_GEO: THREE.BufferGeometry | null = null
/** the round plate (blender/roundplate.py, item 251): the shop's round plate as PLATE_GEO was, 2 x PLATE_R across its rim, now with a lip of
 * some thickness and a foot ring, 20 round (it was a lathe in code, 384 triangles); its picture's UVs straight down, as wareGeometry's */
const ROUND_PLATE_URL = import.meta.env.BASE_URL + 'models/roundplate.glb'
useGLTF.preload(ROUND_PLATE_URL)
let ROUND_GEO: THREE.BufferGeometry | null = null
/** the round plate's geometry as loaded, its picture's v the way wareGeometry has it (0.5 - z / 2R: through glTF it may come the other way) */
const roundGeoOf = (scene: THREE.Object3D) => {
  const g = (scene.getObjectByName('RoundPlate') as THREE.Mesh | undefined)?.geometry
  if (!g) return null
  const pos = g.attributes.position, uv = g.attributes.uv
  if (uv) {
    let i = 0
    while (i < pos.count && Math.abs(pos.getZ(i)) < PLATE_R * 0.5) i++
    if (i < pos.count && Math.sign(uv.getY(i) - 0.5) === Math.sign(pos.getZ(i))) {
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - uv.getY(k))
      uv.needsUpdate = true
    }
  }
  return g
}
/** how high a plate's floor is in its own units (where what's left on it lies): the long one's and the round one's (item 251's) */
const FLOOR_LONG = 0.008, FLOOR_ROUND = 0.009
/** each kind of plate's size against the shop's round plate as it's drawn (PLATE_GEO, 2 x PLATE_R across its rim): the long one's own */
const KIND_SCALE: Record<PlateKind, number> = { round: PLATE_DIMS.round.w / (2 * PLATE_R), mame: PLATE_DIMS.mame.w / (2 * PLATE_R), long: 1 }
/** the way the plates at the plating place lie (their length back across the cook table, as what's on them does), as a turn about up in
 * the bar's frame: the long plate's length (its x) that way */
const PASS_YAW = (() => { const d = platingOf().dir; return Math.atan2(-d.z, d.x) })()
/** where a fish's bones are left on the long plate, along it, the head the way the fish's was (x, z, its turn) */
const BONES_ON_LONG = [[0.0, -0.014, Math.PI + 0.05], [0.012, 0.024, Math.PI - 0.08]] as const
/** the owner washing a plate up by hand (item 174): the suds on its face, a few small white blobs (x, z on it, how big), and the drops
 * running off its edge into the water; low-poly, made once */
const FOAM_AT: [number, number, number][] = [[0.01, 0, 1], [-0.035, 0.025, 0.85], [0.04, -0.03, 0.9], [-0.02, -0.045, 0.75], [0.05, 0.035, 0.7],
  [-0.055, -0.005, 0.8], [0, 0.05, 0.7]]
const FOAM_GEO = new THREE.IcosahedronGeometry(0.016, 1)
const FOAM_MAT = new THREE.MeshToonMaterial({ color: '#f6f9fc' })
const DRIP_GEO = new THREE.IcosahedronGeometry(0.0045, 0).scale(1, 1.7, 1)
const DRIP_MAT = new THREE.MeshBasicMaterial({ color: '#d6ecf7' })
/** how far along the sink's front the owner stands over toward the basket to wash (the bar's units), and where he works a plate: in from the
 * basin's middle toward him, and up over the water */
const WASH_SHIFT = 0.22
// (0.16 in, the plate's edge came over the basin's near wall onto the counter)
const WORK_IN = 0.05
const WORK_UP = 0.035
// (scratch, kept)
const WASH_FWD = new THREE.Vector3()
const SPOUT_AT = new THREE.Vector3()
const STREAM_W = new THREE.Vector3()
/** the player's plate in hand (items 224, 234): where it's to be held (the scratch), and how long it takes washed into the basket (s) */
const HAND_TO = new THREE.Vector3()
const HAND_TO_BASKET_S = 0.35
const HAND_STREAM = new THREE.Vector3()
const DRIP_LOW = new THREE.Vector3()
/** a smear's opacity by how dirty the plate is: as dark as it ever was (0.6) from a plate of two dishes on, a plate of one a little lighter,
 * fading smoothly to nothing as it soaks clean */
const smearOpacity = (dirt: number) => 0.62 * Math.min(1, dirt * 1.6)
const USED_STICK_GEO = new THREE.CylinderGeometry(0.004, 0.003, 0.18, 5)
/** where on a done-with plate its used sticks lie, criss-cross (as many as were eaten off it, up to four drawn) */
const STICKS_ON = [[-0.02, 0.6], [0.015, -0.4], [-0.035, 1.3], [0.03, 0.15]] as const
/** where the bones lie on a done-with plate (as many fish as were eaten off it, up to two drawn) */
const BONES_ON = [[0.0, -0.025, 0.25], [0.01, 0.03, -0.35]] as const
/** where it rides once the plate's up on the tray: on the plate, at its middle */
const GLASS_ON: [number, number, number] = [0.02, 0, 0.02]
/** a used tissue crumpled into a ball (a lumpy little ball, its points pushed in and out); on the plate once it's taken up with it */
const CRUMPLE_GEO = (() => {
  const g = new THREE.IcosahedronGeometry(0.018, 1)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const k = 0.72 + 0.5 * Math.abs((Math.sin(i * 12.9898 + p.getX(i) * 311) * 43758.5453) % 1)
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
})()
const CRUMPLE_MAT = new THREE.MeshToonMaterial({ color: '#f7f5ef' })
const TISSUE_ON: [number, number, number] = [-0.035, 0.006, 0.025]
/** how long a customer wipes their mouth with a tissue before getting up */
// (the reach down to their drawer for the tissue first (item 269), then the wipe)
const WIPE_MOUTH_MS = 900 + TISSUE_REACH_MS
/** a sip of their drink: how long (the bar's clock), about how long between sips, how many to a drink */
const SIP_S = 2.4
/** how long a mouthful of miso soup takes, the bowl taken up in both hands and put down again (item 345) */
const SOUP_SIP_S = 3.2
/** (item 210: a drink went down in about fifty minutes, so few had a second; an izakaya's customers have two or three in an evening) */
const SIP_GAP = 6
const SIPS = 4
// (a done-with plate's bones, and the plater's rice bowl, first shown mid-shift: their shaders made with the rest at load (scene/Prewarm))
{
  const g = new THREE.Group()
  g.add(new THREE.Mesh(BONES_GEO, new THREE.MeshToonMaterial({ color: '#efe6cf' })))
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0255, 0.0255, 0.006, 14), new THREE.MeshToonMaterial({ color: '#b98b56', side: THREE.DoubleSide })))
  warmLater(g)
}

/**
 * What's set on a plate with the food (item 272, the owner's, 2026-11-17: 「擺盤跟比例也是，會讓人覺得遊戲有點隨便做的感覺」): at the front
 * and to the right of the one it's set before (前盛り, as a Japanese grill plates it), on a long plate a shiso leaf, a little mound of grated
 * daikon on it and a stick of pickled ginger shoot (はじかみ) leaning on that, pink at its foot; on a round one a half-moon of lemon and a
 * pinch of daikon; nothing on a little one. Left when the food's eaten: the leaf and the ginger (the daikon's eaten with the fish). Each set
 * one mesh in its colours (one draw a plate), in the plate's own units, the customer's side its -z and their right its -x (measured)
 */
const GARNISH_MAT = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })
const tint = (g: THREE.BufferGeometry, hex: string) => {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  const out = g.index ? g.toNonIndexed() : g
  if (out !== g) { const m = out.attributes.position.count, b = new Float32Array(m * 3); for (let i = 0; i < m; i++) { b[i * 3] = c.r; b[i * 3 + 1] = c.g; b[i * 3 + 2] = c.b } out.setAttribute('color', new THREE.BufferAttribute(b, 3)); out.deleteAttribute('uv'); return out }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  g.deleteAttribute('uv')
  return g
}
/** a shiso leaf lying flat, its edge toothed, cupped a little along its midrib; `len` long, its tip toward +x */
function shisoLeaf(len: number) {
  const s = new THREE.Shape(), N = 12, pts: [number, number][] = []
  for (let k = 0; k <= N; k++) {
    const t = k / N, w = len * 0.36 * Math.sin(Math.PI * t) ** 0.8 * (k % 2 && k < N ? 1.08 : 1)
    pts.push([len * (t - 0.5), w])
  }
  for (let k = N - 1; k >= 1; k--) { const [x, w] = pts[k]; pts.push([x, -w]) }
  s.moveTo(pts[0][0], pts[0][1])
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y)
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getZ(i)) / (len * 0.36) * len * 0.07)
  g.computeVertexNormals()
  return g
}
/** a little lumpy mound (grated daikon), `r` across */
function mound(r: number, seed: number) {
  const g = new THREE.IcosahedronGeometry(r, 1)
  const p = g.attributes.position
  let k = seed
  for (let i = 0; i < p.count; i++) {
    k = (k * 16807) % 2147483647
    const j = 0.85 + 0.3 * (k / 2147483647)
    p.setXYZ(i, p.getX(i) * j, Math.max(0, p.getY(i)) * 0.6 * j, p.getZ(i) * j)
  }
  g.computeVertexNormals()
  return g
}
const GARNISHES = (() => {
  if (typeof document === 'undefined') return null
  // (the long plate's: the leaf front right, its tip out toward the plate's end, the daikon on its middle, the ginger leaning on it)
  const leaf = tint(shisoLeaf(0.06), '#3d7a35').rotateY(0.5).translate(-0.085, FLOOR_LONG + 0.0015, -0.03)
  const dai = tint(mound(0.012, 7), '#f3f0e6').translate(-0.085, FLOOR_LONG + 0.004, -0.03)
  const stem = (from: number, to: number, hex: string) => tint(new THREE.CylinderGeometry(0.0016, 0.0019, to - from, 6).translate(0, (from + to) / 2, 0), hex)
  const ginger = mergeGeometries([stem(0, 0.016, '#e5839c'), stem(0.016, 0.05, '#e9ecd2')])!.rotateZ(-1.15).rotateY(0.35).translate(-0.066, FLOOR_LONG + 0.003, -0.022)
  const leftLong = mergeGeometries([leaf.clone(), ginger.clone()])!
  const fullLong = mergeGeometries([leaf, dai, ginger])!
  // (the round plate's: a half-moon of lemon lying on its side front right, its rind yellow, its flesh paler; a pinch of daikon by it)
  const half = new THREE.Shape()
  half.absarc(0, 0, 0.017, 0, Math.PI, false)
  half.lineTo(0.017, 0)
  const lemon = new THREE.ExtrudeGeometry(half, { depth: 0.008, bevelEnabled: false, curveSegments: 8 })
  const lemonC = tint(lemon, '#efd65a')
  lemonC.rotateX(-Math.PI / 2).rotateY(-0.6).translate(-0.04, FLOOR_ROUND + 0.0015, -0.032)
  const pinch = tint(mound(0.008, 11), '#f3f0e6').translate(-0.018, FLOOR_ROUND + 0.003, -0.045)
  const fullRound = mergeGeometries([lemonC, pinch])!
  const leftRound = lemonC.clone()
  return { long: { full: fullLong, left: leftLong }, round: { full: fullRound, left: leftRound } }
})()
// (made with the rest at load: shown only once there's food out)
if (GARNISHES) { const g = new THREE.Group(); g.add(new THREE.Mesh(GARNISHES.long.full, GARNISH_MAT)); warmLater(g) }

/** a customer's plate, of the shop's one set of painted ware (dirty: a smear of sauce and the sticks left on it, of what was eaten off it,
 * thrown away with it at the sink (the owner's)); drawn again only when it gets dirty */
const Plate = memo(PlateImpl)
function PlateImpl({ kind = 'round', dirty = false, dirt = 1, design = 0, sticks = 1, bones = 0, glass, tissue, drink, level = 0, garnish }: { dirty?: boolean; dirt?: number; design?: number; sticks?: number; bones?: number
  /** what's set with the food (item 272): all of it with the food on it, what's left of it once it's eaten, none on a plate with nothing */
  garnish?: 'full' | 'left'
  /** which of the shop's plates it is (game/plateSize, item 228): the long one, a round one, a little one; it and what's left on it, not
   * what stands beside it */
  kind?: PlateKind
  /** where what they drank was left, from the plate's middle (on the bar where it was drunk, or on the plate being cleared): its own bottle or
   * can (the owner's, 2026-11-10: a glass from nowhere stood there), as much left in it as they left, and a sake's cup by it */
  glass?: readonly [number, number, number]
  drink?: DrinkId
  level?: number
  /** the crumpled tissue left by it, from its middle (on the bar, or on the plate being cleared) */
  tissue?: readonly [number, number, number] }) {
  const gltf = useGLTF(LONG_PLATE_URL) as unknown as { scene: THREE.Group }
  const roundGltf = useGLTF(ROUND_PLATE_URL) as unknown as { scene: THREE.Group }
  if (!LONG_GEO) LONG_GEO = (gltf.scene.getObjectByName('LongPlate') as THREE.Mesh | undefined)?.geometry ?? null
  if (!ROUND_GEO) ROUND_GEO = roundGeoOf(roundGltf.scene)
  const long = kind === 'long' && !!LONG_GEO
  const geo = long ? LONG_GEO! : ROUND_GEO ?? PLATE_GEO
  // (what's left on it lies on its floor, not over it: the smear, the sticks and the bones were set for the plates before item 251's)
  const floor = long ? FLOOR_LONG : FLOOR_ROUND
  return (
    <group>
      <group scale={KIND_SCALE[long ? 'long' : kind === 'long' ? 'round' : kind]}>
      <mesh geometry={geo} castShadow receiveShadow>
        {/* (each kind its own glaze (item 278): the long ones Oribe, the round ones white crackle with iron and green, the little ones Kiseto) */}
        <meshToonMaterial color="#ffffff" map={long ? oribeLong(design) : kind === 'mame' ? mameGlaze(design) : roundGlaze(design)} />
      </mesh>
      <mesh geometry={geo} scale={long ? [1.012, 1.05, 1.03] : [1.03, 1.05, 1.03]}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {garnish && GARNISHES && kind !== 'mame' && (
        <mesh geometry={GARNISHES[long ? 'long' : 'round'][garnish]} material={GARNISH_MAT} raycast={() => {}} />
      )}
      {dirty && (
        <>
          {/* (its smear, as dirty as it was left (game/plates' plateDirt): the more eaten off it, the bigger and the darker; in the sink it
              fades as it soaks, GuestBar3D setting its opacity frame by frame; on the long plate drawn out along it) */}
          <mesh name="plate-smear" geometry={SMEAR_GEO} position={long ? [0.02, floor + 0.0015, 0] : [0.03, floor + 0.0015, -0.02]} rotation-x={-Math.PI / 2}
            scale={long ? [1.9 * (0.7 + 0.4 * dirt), 0.65 * (0.7 + 0.4 * dirt), 1] : [1.2 * (0.7 + 0.4 * dirt), 0.8 * (0.7 + 0.4 * dirt), 1]} visible={dirt > CLEAN_AT}>
            <meshBasicMaterial color="#8a5a32" transparent opacity={smearOpacity(dirt)} depthWrite={false} />
          </mesh>
          {STICKS_ON.slice(0, Math.min(4, sticks)).map(([x, yaw], i) => (
            <mesh key={i} geometry={USED_STICK_GEO} position={[x, floor + 0.0042 + i * 0.006, 0.03 - i * 0.012]} rotation={[0, yaw, Math.PI / 2]}>
              <meshToonMaterial color="#c9a46a" />
            </mesh>
          ))}
          {/* (the bones of each fish eaten off it, picked clean, the head browned) */}
          {(long ? BONES_ON_LONG : BONES_ON).slice(0, Math.min(2, bones)).map(([x, z, yaw], i) => (
            <group key={`b${i}`} name="plate-bones" position={[x, floor + 0.006 + i * 0.004, z]} rotation-y={yaw}>
              <mesh geometry={BONES_GEO}><meshToonMaterial color="#efe6cf" /></mesh>
              <mesh geometry={HEAD_GEO}><meshToonMaterial color="#8a5a30" /></mesh>
            </group>
          ))}
        </>
      )}
      </group>
      {dirty && (
        <>
          {/* (the tissue they wiped their mouth with, crumpled up) */}
          {tissue && <mesh name="plate-tissue" geometry={CRUMPLE_GEO} position={[tissue[0], tissue[1] + 0.016, tissue[2]]} material={CRUMPLE_MAT} />}
          {/* (what they drank, its bottle or can left, drunk down (and a sake's cup by it)) */}
          {glass && drink && (
            <group name="plate-glass" position={[glass[0], glass[1], glass[2]]}>
              <DrinkBottle id={drink} level={level} />
              {cupped(drink) && <group position={[0.05, 0, -0.03]}><DrinkCup id={drink} level={0} /></group>}
            </group>
          )}
        </>
      )}
    </group>
  )
}

/** a plate of each kind drawn at one place (item 228), the one it is shown by showKind: for the plates whose kind changes as they're used
 * (the sink's stack, the basket's slots, the plates being washed in hand), so a change is a flag, not a redraw */
// (memo: its two numbers the same, it isn't drawn again with whatever holds it (item 374: 167 times a second while the shop was open))
const PlateKinds = memo(function PlateKinds({ design = 0, dirty = false }: { design?: number; dirty?: boolean }) {
  return (
    <>
      <group name="kind-round"><Plate kind="round" design={design} dirty={dirty} sticks={0} /></group>
      <group name="kind-long" visible={false}><Plate kind="long" design={design} dirty={dirty} sticks={0} /></group>
    </>
  )
})
const MAME_OF_ROUND = KIND_SCALE.mame / KIND_SCALE.round
/** show the kind of plate it is, of a PlateKinds' two (its parts found once, kept on it) */
const showKind = (g: THREE.Object3D | null | undefined, kind: PlateKind) => {
  if (!g) return
  const k = (g.userData.kinds ??= [g.getObjectByName('kind-round'), g.getObjectByName('kind-long')]) as (THREE.Object3D | undefined)[]
  if (k[1]) k[1].visible = kind === 'long'
  if (k[0]) { k[0].visible = kind !== 'long'; k[0].scale.setScalar(kind === 'mame' ? MAME_OF_ROUND : 1) }
}
/** every smear drawn on a plate (or a PlateKinds' two), found once, kept on it */
const smearsOf = (g: THREE.Object3D | null | undefined): THREE.Mesh[] => {
  if (!g) return []
  if (!g.userData.smears) { const out: THREE.Mesh[] = []; g.traverse((q) => { if (q.name === 'plate-smear') out.push(q as THREE.Mesh) }); g.userData.smears = out }
  return g.userData.smears as THREE.Mesh[]
}

/**
 * A server at the plating place for a plate (item 317, the owner's): they take the tongs up, and what's for it on the tray by the fire is
 * lifted onto it a piece at a time (Roasting); they take the plate up once it's all on it and nothing's in the air on its way (and a moment
 * after they're there, as before)
 */
function pickupReady(slot: number | undefined, t: number) {
  const sl = PLATING.slots[slot ?? -1]
  if (sl) sl.tongs = true
  return t > 0.4 && plateGoes(sl?.onTray ?? 0, sl?.flying ?? 0)
}

function GuestBar3DImpl({ guests, at, length = 3.6, drawCounter = true, lang, top = 0.465, people = true, mark = '食堂', counters: given, scale = 1, offset,
  servers = [], plater = null, stocker = null, omiki, onDrink, onSay, open = true }:
  { guests: GuestView[]; at: THREE.Vector3; length?: number; drawCounter?: boolean; lang: Lang
    /** where the customers sit (the first counter's middle is at, and its door past its far end); one of four if not given */
    counters?: Counter[]
    /** what's dyed on the noren at the door (its first character in the middle) */
    mark?: string
    /** a guest's word (what they made of the toilet) */
    onSay?: (who: 'chef' | 'guest', text: string, guest?: number) => void
    /** the height of the bar top, where the plates go */
    top?: number
    /** draw the customers themselves (a phone shows them in 2D instead; the plates still come and go) */
    people?: boolean
    /** a customer's taken a drink from the fridge (it's paid for) */
    onDrink?: (guest: number, drink: DrinkId) => void
    /** the shop's open: shut, nobody's in the room and the plates are back where they started */
    open?: boolean
    /** the omiki (御神酒) offered at the shrine by the door (poured when, and offering it again) */
    omiki?: { pouredAt: number | null; onPour: () => void }
    /** the servers on the floor: they carry what's plated at the plating place to the customers, clear the plates done with, and wash them */
    servers?: { id: string; look: StaffLook }[]
    /** who plates in the kitchen, fetching plates from the racks for the plating place (the third cook, or the second): none, the owner does */
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
  /** two customers passing each other: which way each steps aside, as they first met (keyed by their ids, low|high) */
  const passing = useRef(new Map<string, { x: number; z: number }>())
  /** how far each walker's stepped aside off their way just now (eased to what's needed), and where their way had them the frame before
   * (keyed by id: a customer's, a server's -1 - i, the stock keeper's) */
  const aside = useRef(new Map<number, { x: number; z: number; f: number }>())
  /** what stands against the first counter's wall behind its aisle, that nobody stepping aside for another goes into (measureWall) */
  const wallKeep = useRef<WallKeep>({ at: -9, boxes: [], roots: new Map(), sig: NaN, full: 0, looked: -1e9 })
  const lastAt = useRef(new Map<number, { x: number; z: number; f: number }>())
  const asideTick = useRef(0)
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __guestGroups?: typeof groups }).__guestGroups = groups
  const clock = useRef(0)
  const counters = useMemo(() => given ?? singleCounter(at, length), [given, at, length])
  const seats = useMemo(() => seatsOf(counters), [counters])
  /** the first counter's stools as they stand sat at, for those passing behind them (item 193): the stretch of its aisle they're along (a
   * stool's half width past the end ones) and how far toward the aisle their backs come (a stool's half width, 0.21, behind where it stands:
   * tests/e2e/_clash193.mjs's hits on them, -0.79) */
  const stoolLine = useMemo(() => {
    const c = counters[0], at = seats.filter((st) => st.counter === 0).map((st) => st.stool.clone().sub(c.at))
    if (!at.length) return null
    const al = at.map((d) => d.dot(c.along))
    return { a0: Math.min(...al) - 0.21, a1: Math.max(...al) + 0.21, back: Math.min(...at.map((d) => d.dot(c.lay))) - 0.21 }
  }, [counters, seats])
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
  /** where the customers come in at the door: where a customer's figure stands as it's put in the scene (one called off the bench, where they
   * sat), till their walk puts it on their way (put at the frame's middle, it stood there, in the kitchen, between being put in and its first
   * frame: tests/e2e/paths.mjs saw it, and one called off the bench was drawn there for a frame, put in after the walk's frame was done:
   * dayaudit.mjs RUSH=1, 13 of them, from the door to the bench when it was the door) */
  const wayIn = useMemo(() => wayInOf(counters), [counters])
  /** in from outside (item 410, the owner's 「客人進來的時候會先開拉門再脫鞋」): shown out on the step past the sliding door, where they stand while
   * it's slid open (game/slideDoor: a moment after they show), then just in through its open way; put before the way in from the door's place
   * (doorOf), walked back going out. `len` its length (going out, they slide it open just in from it) */
  const doorLead = useMemo(() => {
    const pts = given ? [doorAt(counters, DOOR_LANE.x, DOOR_LANE.wait), doorAt(counters, DOOR_LANE.x, DOOR_LANE.in)] : []
    // (where they're first put: there, at its step's height (item 410: put at the floor's, they dropped onto the step the next frame))
    const start = pts[0]?.clone().setY(genkanY(counters, pts[0]))
    return { pts, len: pathLength(pts), start }
  }, [counters, given])
  const paths = useMemo(() => seats.map((st) => {
    const path = [...doorLead.pts.map((v) => v.clone()), ...pathTo(counters, st)]
    return { path, len: pathLength(path) }
  }), [counters, seats, doorLead])
  // the way out: the same way back, but by the till, where they stop to pay (door first, like the way in)
  const leavePaths = useMemo(() => seats.map((st) => {
    const base = pathTo(counters, st)
    if (!given) return { path: base, len: pathLength(base), payD: 0 }
    const { spot, lane, aisle } = payOf(counters)
    const path = [...doorLead.pts.map((v) => v.clone()), base[0], spot, lane, aisle, ...base.slice(1)]
    return { path, len: pathLength(path), payD: pathLength([...doorLead.pts, base[0], spot]) }
  }), [counters, seats, given, doorLead])
  const plateAt = (n: number) => seats[n].plate.clone().setY(top)
  /** how far along a way in (from the door) the genkan's step up into the room is (found once for each way: it was walked out in a hundred
   * steps for every walker twice a frame) */
  const stepMemo = useMemo(() => new WeakMap<THREE.Vector3[], number>(), [counters, given])
  const stepAt = (path: THREE.Vector3[]) => {
    if (!given) return 0
    const known = stepMemo.get(path)
    if (known !== undefined) return known
    // (from out past the sliding door now (item 410): where it leaves the genkan having come into it)
    let at = 0, seen = false
    for (let d = 0; d < 3; d += 0.02) {
      if (inGenkan(counters, alongPath(path, d).p)) seen = true
      else if (seen) { at = d; break }
    }
    stepMemo.set(path, at)
    return at
  }
  /** the chef's plating place on the cook table beside him (bar's platingOf; the owner's: no pass on the bar): the table's top, where a plate
   * ready for a server stands, its stack of clean plates; a place in it from the ready plate's */
  const plating = useMemo(() => platingOf(), [])
  const platingTop = plating.top
  const platingPlace = (along: number) => plating.at.clone().addScaledVector(plating.dir, along).setY(platingTop)
  // where a server stands to take what's set out there: in the aisle across the bar from it
  /** where a server stands in the kitchen, in front of the chef's plating place, to take a ready plate up */
  const pickupSpot = useMemo(() => plating.out.clone().setY(0), [plating])
  /** where the first counter's aisle meets another's */
  const aisleCorner = (c: Counter) => aisleCornerOf(counters, c)
  // the servers wait in the kitchen, each just inside a gate in the bar (the first counter's, by the till, and the side
  // counter's), so they go out through it on every trip and come back in by it, the door swinging for them; a shop
  // without gates has them waiting by the plating place
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
      const way = [at, mid.clone().addScaledVector(c.lay, 0.42), mid.clone().addScaledVector(c.lay, -0.5), mid.clone().addScaledVector(c.lay, -aisleOf(c) - 0.08)]
      return { at, yaw: Math.atan2(-c.lay.x, -c.lay.z), counter: i, way }
    })
  }, [counters, given])
  /** no server hired: the owner serves (nothing flies); his place along the aisle in front of the cook table (in the bar's frame), his way
   * out across the kitchen to the first counter's gate and through it, found once a day */
  const ownerServes = !!given && servers.length === 0 && homes.length > 0
  const ownerHome = useRef<(typeof homes)[number] | null>(null)
  const ownerAt = () => OWNER_SPOT.clone().add(FIRE_SHIFT).sub(offset ?? new THREE.Vector3()).divideScalar(scale).setY(0)
  // (a server's place stood clear of what's on the kitchen's floor, as it is today (the miso pot by the rice tub was on one, the owner saw her
  // standing in it); worked out once the floor's been looked at, and again the next day)
  const clearHomes = useRef(new Map<number, (typeof homes)[number]>())
  const clearHome = (wi: number) => {
    const h = homes[wi]
    if (!h) return h
    const kept = clearHomes.current.get(wi)
    if (kept) return kept
    const blocks = kitchenBlocks()
    if (!blocks.length) return h
    const [a, l] = standClear(flat(h.at), blocks)
    const c0 = counters[0]
    const at = c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(h.at.y)
    const made = { ...h, at, way: [at, ...h.way.slice(1)] }
    clearHomes.current.set(wi, made)
    return made
  }
  // (his way out found only once he first goes, the kitchen's floor and what's on it in the scene by then)
  const homeOf = (wi: number) => {
    if (!ownerServes) return clearHome(wi)
    if (!ownerHome.current) {
      const at = ownerAt()
      const g = homes[0]
      const across = g.way.length > 1 ? kitchenRoute(at, g.way[1]) : [at.clone()]
      ownerHome.current = { at, yaw: OWNER_YAW, counter: 0, way: [at.clone(), ...across.slice(1), ...g.way.slice(2).map((v) => v.clone())] }
    }
    return ownerHome.current
  }
  /** from a server's place (inside their gate) across the kitchen to the chef, for a plate he's set out ready: round what stands on its floor */
  const fetchPath = (wi: number) => kitchenRoute(homeOf(wi).at, pickupSpot)
  /** a takeaway's way (the owner's: the customer, or the rider, waits in the genkan in their shoes, by the till): in from the front door to just
   * short of the step up into the room (`wait`); where the server stands on the step to give them their box (`hand`); and the server's way from
   * their place out through their gate, along the aisle by the till to the step (the way customers walk out to pay, backwards) */
  const takeoutWay = useMemo(() => {
    if (!given || !seats.length) return null
    const door = pathTo(counters, seats[0])[0], { spot, lane, aisle } = payOf(counters)
    const line = [door, spot], len = pathLength(line)
    let edge = 0
    for (let d = 0; d < len; d += 0.02) if (!inGenkan(counters, alongPath(line, d).p)) { edge = d; break }
    // (across the line in, for a second one waiting beside the first)
    const side = new THREE.Vector3(-(spot.z - door.z), 0, spot.x - door.x).normalize()
    // (to one side of it, the till's (item 203: they stood on it, those paying and going out walking into them); the genkan's stone runs
    // 0.6 that way from it, and the shoe cupboard is the other way)
    const wait = alongPath(line, Math.max(0.3, edge - 0.32)).p.setY(0).addScaledVector(side, TAKEOUT_ASIDE), hand = alongPath(line, Math.min(len, edge + 0.3)).p.setY(0)
    // (the waiting bench (BENCH): against the wall by the genkan, where BENCH_PLACE has it; its places along it, those sat there facing into the room)
    // (and the second along the wall from it (BENCH2_ALONG); three places on each, the first bench's filled first)
    const bench = new THREE.Vector3(BENCH_PLACE.x, 0, BENCH_PLACE.z), u = new THREE.Vector3(Math.cos(BENCH_PLACE.yaw), 0, -Math.sin(BENCH_PLACE.yaw))
    const bench2 = bench.clone().addScaledVector(u, BENCH2_ALONG)
    const benchSpots = Array.from({ length: BENCH_SEATS }, (_, k) => (k < BENCH_EACH ? bench : bench2).clone()
      .addScaledVector(u, ((k % BENCH_EACH) - (BENCH_EACH - 1) / 2) * BENCH_PLACE.pitch))
    const next = wait.clone().addScaledVector(spot.clone().sub(door).setY(0).normalize(), TAKEOUT_NEXT)
    return { door: door.clone(), wait, next, hand, side, out: [aisle.clone(), lane.clone(), spot.clone(), hand.clone()], bench, bench2, benchYaw: BENCH_PLACE.yaw, benchSpots }
  }, [counters, seats, given])
  /** the cashier's chair (its seat's mark, Register's: it may be moved) in the bar's frame: where their hands are, turned round `turn` of the
   * way to the takeaway stand behind them (0: facing the till) */
  const seatMark = useRef<THREE.Object3D | null>(null)
  /** a customer waiting at the till with no cashier sat at it (item 203): who, since when (the bar's clock), the server on their way to ring
   * them up (their place in the line) and whether they're there behind it */
  const tillCall = useRef<{ who: number; since: number; staff: number; there: boolean }>({ who: -1, since: 0, staff: -1, there: false })
  /** when the liquor shop's deliveries were last looked for (the bar's clock) */
  const deliveryLook = useRef(0)
  /** where a server stands behind the till to ring someone up: the cashier's chair's place on the floor */
  const tillStaffSpot = () => {
    const fb = frame.current, m = seatMark.current
    if (m && fb) { m.updateWorldMatrix(true, false); return fb.worldToLocal(m.getWorldPosition(new THREE.Vector3())).setY(0) }
    return cashierHands(0).setY(0)
  }
  const cashierHands = (turn: number) => {
    const fb = frame.current
    if (!seatMark.current?.parent && fb) { let root: THREE.Object3D = fb; while (root.parent) root = root.parent; seatMark.current = root.getObjectByName('cashier-seat') ?? null }
    const m = seatMark.current
    if (!m || !fb) return new THREE.Vector3(1.25, 0.7, -2.79)
    m.updateWorldMatrix(true, false)
    const at = fb.worldToLocal(m.getWorldPosition(new THREE.Vector3()))
    const ahead = fb.worldToLocal(new THREE.Vector3(0, 0, -1).applyMatrix4(m.matrixWorld)).sub(at).setY(0).normalize()
    return at.addScaledVector(ahead.applyAxisAngle(UP_Y, turn * Math.PI * 0.8), 0.28).setY(at.y + 0.12)
  }
  /** where a takeaway's customer comes up to the till from where they waited: toward the cashier's chair, as far as the genkan goes */
  const tillSide = (from: THREE.Vector3) => {
    const to = cashierHands(0).setY(0), dir = to.clone().sub(from).setY(0)
    const len = dir.length()
    dir.normalize()
    let d = 0
    while (d < len && inGenkan(counters, from.clone().addScaledVector(dir, d + 0.02))) d += 0.02
    return from.clone().addScaledVector(dir, Math.max(0, d - 0.08))
  }
  /** the takeaway stand (where it's been put): its middle on the floor, where a server stands at its side nearest the kitchen to set a bag on
   * it, and the kitchen's edge nearest that (the route there) */
  const standSpots = () => {
    const fb = frame.current, top = standTop.current
    const at = top && fb ? fb.worldToLocal(top.getWorldPosition(new THREE.Vector3())).setY(0) : new THREE.Vector3(STAND_AT.x, 0, STAND_AT.z)
    // (0.53 out from its middle: at 0.45 their round body was 7 cm into its top as they set a bag on it, item 387)
    const reach = at.clone().add(pickupSpot.clone().sub(at).setY(0).setLength(0.53))
    const c0 = counters[0], d = reach.clone().sub(c0.at)
    const a = THREE.MathUtils.clamp(d.dot(c0.along), kitchen.along[0] + 0.2, kitchen.along[1] - 0.2)
    const l = THREE.MathUtils.clamp(d.dot(c0.lay), kitchen.lay[0] + 0.2, kitchen.lay[1] - 0.2)
    return { at, reach, edge: c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0) }
  }
  /** from a server's place out to the step where the takeaway's handed over (walked backwards, the way back) */
  const tillPath = (wi: number) => {
    const h = homeOf(wi), way = takeoutWay!
    return [...h.way.map((v) => v.clone()), ...(h.counter ? [aisleCorner(counters[h.counter])] : []), ...way.out.map((v) => v.clone())]
  }
  /** beside a customer, where a server stands to set their plate down */
  const besideSeat = (n: number) => {
    const st = seats[n]
    return st.aisle.clone().lerp(st.stool, 0.45).addScaledVector(st.along, 0.24)
  }
  /** from the chef to a seat, the plate in their hands: back across the kitchen to their place, out through their gate, along the aisle
   * (round the corner, for the other counter) and in beside the customer */
  const routeTo = (n: number, wi: number) => {
    const h = homeOf(wi)
    const out = h.way.length < 2 ? [seats[n].aisle.clone(), besideSeat(n)] : backPath(wi, n).slice(1)
    const path = [...kitchenRoute(pickupSpot, h.at), ...out]
    return { path, len: pathLength(path) }
  }
  /** from a server's place to a seat the shortest way (out through their gate): walked backwards, it's their way back */
  const backPath = (wi: number, n: number) => {
    const h = homeOf(wi), st = seats[n]
    if (h.way.length < 2) return [h.at.clone(), st.aisle.clone(), besideSeat(n)]
    const turn = st.counter === h.counter ? [] : [aisleCorner(counters[st.counter === 0 ? h.counter : st.counter])]
    return [...h.way.map((v) => v.clone()), ...turn, st.aisle.clone(), besideSeat(n)]
  }
  /**
   * From a server's place to glass broken on the floor (bar.ts's SPILLS, in the scene's frame): out through their gate, along the aisle to the
   * seat nearest it, and over to stand before it, the broom's reach short of its middle (StaffFigure's sweepPose: its foot that far out); walked
   * backwards, it's their way back
   */
  /** the seat whose place on the aisle is nearest a point (the bar's frame) */
  const nearestSeat = (p: THREE.Vector3) => {
    let best = 0, bd = Infinity
    seats.forEach((st, n) => { const d = Math.hypot(st.aisle.x - p.x, st.aisle.z - p.z); if (d < bd) { bd = d; best = n } })
    return best
  }
  const spillPath = (wi: number, s: Spill) => {
    const f = frame.current
    if (!f || !seats.length) return null
    const p = f.worldToLocal(new THREE.Vector3(s.at[0], s.at[1], s.at[2]))
    let best = 0, bd = Infinity
    seats.forEach((st, n) => { const d = Math.hypot(st.aisle.x - p.x, st.aisle.z - p.z); if (d < bd) { bd = d; best = n } })
    const a = seats[best].aisle
    const to = new THREE.Vector3(p.x - a.x, 0, p.z - a.z)
    const len = to.length(), reach = 0.36 * STAFF_SCALE
    const stand = len > reach ? a.clone().addScaledVector(to, (len - reach) / len) : a.clone()
    stand.y = a.y
    return [...backPath(wi, best).slice(0, -1), stand]
  }
  /** what a server's doing: across the kitchen to the chef for what he's plated, out to its seat with it, back; out to clear plates done with, to the sink with
   * them; at the sink washing them into the dryer; taking the dried ones out of it back to the racks */
  type WaiterPhase = 'idle' | 'fetch' | 'pickup' | 'go' | 'set' | 'back' | 'clearGo' | 'clearTake' | 'clearBack' | 'drop'
    | 'washGo' | 'wash' | 'unloadGo' | 'unloadTake' | 'unloadCarry' | 'unloadPut' | 'handGo' | 'handwash' | 'basketGo' | 'basketTake'
    | 'toBox' | 'boxTake' | 'toTill' | 'hand' | 'toStand' | 'standPut'
    | 'skTrayGo' | 'skTake' | 'skSinkGo' | 'skWash' | 'skHolderGo' | 'skPut'
    | 'tillGo' | 'tillAt'
    | 'sweepGo' | 'sweep' | 'wipeFloor'
    | 'toSakePass' | 'sakePour' | 'sakeUp' | 'sakeGo' | 'sakeSet'
    | 'toBowlPass' | 'bowlUp' | 'toRiceFill' | 'bowlRice' | 'toSoupFill' | 'bowlSoup' | 'bowlGo' | 'bowlSet'
    | 'toBowlWith' | 'bowlWith'
  const waiters = useRef<{ phase: WaiterPhase
    t: number; seat: number; keys: string[]; run: number | null
    /** the way they're drawn facing, turned toward `yaw` a frame at a time (set at once, they spun round at each corner of their way, by as
     * much as 150° in a frame) */
    look?: number
    /** (serving) the plating place's slot they've come for */
    slot?: number
    /** (clearing) the dirty plates they've come for, on their tray once taken; (from the dryer) how many dried plates are on their tray */
    carry?: number[]; stack?: number
    /** (a takeaway) the order whose box they've gone for, and carry out to its customer waiting in the genkan */
    box?: number
    /** (glass broken on the floor, bar.ts's SPILLS) the one they've gone to sweep up; and the broom in their hand, there and back */
    spill?: number; broom?: boolean
    /** their tray put down for an errand (TRAY_ERRANDS), till they're back at their place (item 249) */
    trayDown?: boolean
    path: THREE.Vector3[]; len: number; pos: THREE.Vector3; yaw: number
    /** their walk home once the shop's shut, and in as it opens (commuteWalk); whether they're in yet */
    out?: Trip; in?: Trip; arrived?: boolean }[]>([])
  const waiterObjs = useRef<(THREE.Group | null)[]>([])
  /** the takeaway boxes in servers' hands, one for each server */
  const waiterBoxes = useRef<(THREE.Group | null)[]>([])
  /** the takeaway stand (bar.ts's TAKEOUT_STAND): its top's mark, the bags drawn on it, the one in the cashier's hands as it's handed over */
  const standTop = useRef<THREE.Object3D | null>(null)
  const standBags = useRef<(THREE.Group | null)[]>([])
  const handBag = useRef<THREE.Group | null>(null)
  /**
   * takeaway customers and delivery riders (game/takeout, the owner's): in at the front door to the edge of the genkan, by the till, where
   * they wait in their shoes (no seat, no shoes off) for a server to bring their box out to them; and out again with it, fading through the door
   */
  type Visitor = { id: number; rider: boolean; order: (typeof TAKEOUT.orders)[number]; phase: 'in' | 'wait' | 'toTill' | 'atTill' | 'out'; t: number; fade: number; fadeT: number; pos: THREE.Vector3; yaw: number
    /** where they wait: two side by side in the genkan, not in one another; and where they come up to the till for their bag from the cashier */
    wait: THREE.Vector3; till?: THREE.Vector3 }
  const visitors = useRef(new Map<number, Visitor>())
  const [visitorList, setVisitorList] = useState<{ id: number; rider: boolean; has: boolean }[]>([])
  const visitorObjs = useRef(new Map<number, THREE.Group>())
  /** those waiting on the genkan's bench for a stool (bar.ts's BENCH): in from the door to their place on it, sat there, and when called (`up`)
   * handed over to the way in to their stool from where they sat (`benchFrom`); given up, out of the door again */
  type Sitter = { id: number; phase: 'in' | 'sit' | 'out'; t: number; fade: number; fadeT: number; pos: THREE.Vector3; yaw: number; spot: number; handed?: boolean
    /** their place on the bench and the way it faces, as last found from its marks: kept while the marks aren't there for a frame */
    at?: THREE.Vector3; face?: THREE.Vector3
    /** sent away (the shop shutting) before they'd sat: where they were on their way in, the way out from there */
    outFrom?: THREE.Vector3; outVia?: boolean
    /** at the genkan's step (item 203): how far through stepping out of (or into) their shoes, 0..1, -1 not at it; and their pair left on the
     * stone, where and which way */
    bow?: number; shoes?: { at: THREE.Vector3; yaw: number }
    /** how far along their way in, and their way out, the genkan's step is (found once each, not every frame); and how long they stop at it
     * going out, fixed as they set off (item 411: worked out each frame from whether their shoes were still on the stone, it went to nothing
     * halfway into the stop as they stepped into them, and they were put where the walk would have been without it: 0.75 to 1.7 on in a frame) */
    stepIn?: number; stepOut?: number; outHold?: number
    /** where their pair's to stand on the stone (their place's in the row), found as they come in: they stop on it both ways, out of their
     * shoes there coming in and back into them going (item 412: they stopped at the step's edge and the pair came and went in the row 0.16 to
     * 0.41 from them, a stride off, never stood in); going out, the place they stop at (null: no pair down there, not stopping) */
    shoeAt?: THREE.Vector3; outShoe?: THREE.Vector3 | null }
  const sitters = useRef(new Map<number, Sitter>())
  /** where the bench's sitters leave their shoes on the genkan's stone (item 203): found from the first one's way up the step, kept */
  const shoeRow = useRef<{ at: THREE.Vector3; toes: THREE.Vector3; across: THREE.Vector3 } | null>(null)
  /** the k-th place's pair's place in the row (shoeRow), the row found the first time from `walk`, a way in from the door: SHOES_BACK back
   * toward the door from where it steps up out of the genkan, toes that way, its pairs off to the side away from the shoe cupboard (kept
   * only once the cupboard's there to keep away from); null with no step on the way to find it from */
  const shoeSpotOf = (k: number, walk: THREE.Vector3[]) => {
    let r = shoeRow.current
    if (!r) {
      const at0 = stepAt(walk)
      if (!(at0 > 0)) return null
      const back = alongPath(walk, Math.max(0, at0 - SHOES_BACK)), toes = back.dir.clone().negate().setY(0).normalize()
      const across = new THREE.Vector3(-toes.z, 0, toes.x), fr = frame.current
      const cab = fr && SHOE_CELLS.ready ? fr.worldToLocal(SHOE_CELLS.at.clone()) : null
      if (cab && across.dot(cab.setY(0).sub(back.p.clone().setY(0))) > 0) across.negate()
      r = { at: back.p.clone().setY(0), toes, across }
      if (cab) shoeRow.current = r
    }
    // (a neat row of them, not each pair where the last was (three at one spot, one in another): two side by side along the step's edge, two
    // more behind them toward the door, the fifth and sixth squeezed between; all on the stone and away from the shoe cupboard (its front a
    // step from where they cross: tests/e2e/_shoerow203.mjs))
    return r.at.clone().addScaledVector(r.across, 0.1 + 0.17 * (k % 2) + (k >= 4 ? 0.085 : 0)).addScaledVector(r.toes, 0.18 * (Math.floor(k / 2) % 2) + (k >= 4 ? 0.09 : 0))
  }
  /** those called off the bench whose shoes have been put in their place's cubby (item 203), for their seated self to take out going */
  const benchShoesIn = useRef(new Set<number>())
  const [sitterList, setSitterList] = useState<{ id: number; sat: boolean }[]>([])
  const sitterObjs = useRef(new Map<number, THREE.Group>())
  const benchFrom = useRef(new Map<number, THREE.Vector3>())
  /** the orders whose boxes a server's on the way with */
  const boxClaimed = useRef(new Set<number>())
  /** the kitchen's plater on their way to the racks for plates, and back with them to the plating place ('idle': at their place in the kitchen,
   * drawn there by Roasting) */
  // (and the kitchen's rice (game/rice): to the open sack of rice to scoop a pot's worth ('toSack', 'scoopRaw'), to the sink to wash it, to the
  // electric cooker to set it on ('toSink', 'wash', 'toKama', 'load'); cooked, it keeps the rice warm and the rice balls' rice is taken from it)
  const platerRun = useRef<{ phase: 'idle' | 'toRack' | 'take' | 'toPass' | 'put' | 'home' | 'settle' | 'toSack' | 'scoopRaw' | 'toSink' | 'wash' | 'toKama' | 'load'
    | 'toRackLow' | 'takeLow' | 'toLow' | 'putLow'
    | 'toSkTray' | 'takeSk' | 'toSkSink' | 'washSk' | 'toHolder' | 'putSk'
    | 'toTillBack' | 'atTill'
    | 'toCrate' | 'takeCoal' | 'toBucket' | 'scoopWater' | 'toHearth' | 'feedCoal' | 'sprinkle' | 'toSoup' | 'stir' | 'rake'
    | 'turnCrate' | 'turnBack' | 'toCoalSack' | 'liftSack' | 'toFill' | 'fillCrate' | 'toSake' | 'pourSake' | 'toShape' | 'shape'
    | 'toRiceBowl' | 'riceBowl' | 'toSoupBowl' | 'soupBowl' | 'toBowlPass' | 'bowlPut' | 'toGrate' | 'grate'
    t: number; path: THREE.Vector3[]; len: number
    pos: THREE.Vector3; yaw: number; n: number
    /** what they've gone for for the fire: the charcoal or the water (what's in their hands to the hearth, whatever the grill asks meanwhile) */
    fire?: 'coal' | 'water' | 'tidy'
    /** at the soup's pot to make it (the pot empty), not just to stir it */
    making?: boolean
    /** where the plating place's plates are taken from this time: the low rack by the table, or the dish racks (game/plates' plateSource) */
    src?: 'low' | 'rack'
    /** the way they're to face; `yaw` (the way they face, and what's in their hands with them) turned to it a frame at a time (item 242) */
    yawTo?: number }>({ phase: 'idle', t: 0, path: [], len: 0, pos: new THREE.Vector3(), yaw: 0, n: 0 })
  /**
   * A customer's tokkuri of sake (item 177, the owner's, 2026-11-15: "that sake stand: the way it goes looks odd, and not professional"): taken
   * off SAKE.want by the plater (the third cook; with no plater, a server), poured by hand at the sake station on the serving counter
   * (SakeStation: the open bottle kept there in reach), set down there with its cup; a server comes for it, lifts it onto their tray, carries
   * it out and sets it down at the customer's place, and only then is it theirs (SAKE.ready, SAKE_SEATS). One at a time: the station has the
   * one bottle and the one place to pour at.
   */
  const sakeJob = useRef<{ guest: number; seat: number
    /** who pours it: the plater, or a server (their index) */
    pourer: 'plater' | number
    /** how far into the pour (s of the shop's clock): -1 not begun, POUR_TOTAL poured */
    t: number
    /** the open bottle's level as the pour began; whether its sake's been taken from it */
    was?: number; poured?: boolean
    /** the server taking it out (index); lifting it onto their tray (0..1); setting it down at the customer's place (0..1) */
    server?: number; up?: number; down?: number } | null>(null)
  /** the tokkuri and the cup as they're poured, wait at the pass and are carried out (the bar's frame) */
  const sakeJugObj = useRef<THREE.Group>(null)
  const sakeCupObj = useRef<THREE.Group>(null)
  /** a customer's seat, by who they are (-1: not sat at the bar); and whether they're still sat at that one (or away at the toilet from it) */
  const guestSeat = (id: number) => shownRef.current.find((x) => x.id === id)?.seat ?? -1
  const guestSits = (id: number, seat: number) => shownRef.current.some((x) => x.id === id && x.seat === seat && (x.phase === 'sit' || x.phase.startsWith('wc')))
  /** a point of the sake station's (the serving counter's own frame) in the bar's; where the one pouring stands, and the way they face there */
  const stationIn = (v: THREE.Vector3, out = new THREE.Vector3()) => {
    const g = STATION_OBJ.group, f = frame.current
    if (!g || !f) return out.copy(v)
    g.updateWorldMatrix(true, false)
    return f.worldToLocal(g.localToWorld(out.copy(v)))
  }
  const stationSpot = () => stationIn(STATION.front).setY(0)
  const stationYaw = () => {
    const a = stationIn(STATION.front), b = stationIn(new THREE.Vector3(STATION.front.x, 0, 0))
    return Math.atan2(b.x - a.x, b.z - a.z)
  }
  /**
   * A customer's bowl of rice and of miso soup (items 205, 206, the owner's: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？我要看到好的動畫品
   * 質」): filled at the counter, the rice scooped out of the cooker and the soup ladled out of its pot (SideBowls' poses, beat by beat), by
   * the plater (the third cook, or the second, or the owner with none); left at the serving counter's left end for a server, who lifts them
   * onto their tray and sets them at the customer's place. With no server (the owner serving), the one serving fills them and takes them
   * straight out. One customer's at a time.
   */
  type BowlJob = { guest: number; seat: number; rice: boolean; soup: boolean
    /** who fills them: the plater, or a server (index) who takes them straight out */
    by: 'plater' | number
    /** where it's got to: the rice being scooped, the soup ladled; to the counter with them (then they're the counter's: passQ) */
    stage: 'rice' | 'soup' | 'toPass'
    /** the row at the counter they're to be set down in (the plater's) */
    row?: number
    /** seconds into the filling's beats; how full each bowl is; the places the filling's posed from */
    t: number; riceFill: number; soupFill: number; W: FillAt | null
    /** the server carrying them out; lifting them onto the tray (0..1); setting them down at the place (0..1) */
    server?: number; up?: number; down?: number }
  const bowlJob = useRef<BowlJob | null>(null)
  // (in development, the bowl being filled and who's at it, to look at from the console)
  if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __bowlJob: bowlJob, __waiters: waiters, __platerRun: platerRun })
  /** (item 207) customers' bowls filled and set at the counter (each in its `row` there), or out on a server's tray (`server`; `up`, how far
   * they're lifted onto it, `down`, how far set down at the place; `row` -1: filled by the server and taken straight out): the oldest first */
  type PassBowls = { guest: number; seat: number; rice: boolean; soup: boolean; row: number; server?: number; up: number; down: number
    /** taken out with their food, on the same tray beside its plate (item 207) */
    with?: boolean
    /** how long they've waited at the counter for a server (as the plating place's slots count it: readyFor) */
    wait: number }
  const passQ = useRef<PassBowls[]>([])
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __passQ: passQ })
  /** each server's tray as they carry bowls out: where it is, which way they face */
  const bowlTrays = useRef(new Map<number, { at: THREE.Vector3; yaw: number }>())
  /** the bowls on the move, drawn as the seats' are (SeatBowls): those at the counter and on the trays, laid out afresh every frame */
  const movingBowls = useRef<{ rice: { key: string; at: THREE.Vector3; yaw: number }[]; soup: { key: string; at: THREE.Vector3; yaw: number }[] }>({ rice: [], soup: [] })
  const side = useSideProps()
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __bowlJob: bowlJob, __side: side })
  /** the cooker's mouth and the way one stands at it (SideBowls' FillAt); where they stand */
  const riceStand = () => { marks.current.delete('cooker-front'); return inBar('cooker-front', new THREE.Vector3()).setY(0) }
  /** the cooker: its mouth, how wide, the counter's top under it, where one stands at it and faces */
  const cookerAt = () => {
    marks.current.delete('cooker-top')
    marks.current.delete('cooker-foot')
    const stand = riceStand(), top = inBar('cooker-top', stand), foot = inBar('cooker-foot', top.clone().setY(top.y - 0.2))
    const face = top.clone().sub(stand).setY(0).normalize()
    // (how wide the cooker is, from its own model beside the marker (its steam not counted), in the bar's units)
    let r = 0.17
    const model = markOf('cooker-top')?.parent?.children.find((c) => c.name === 'DenkiNabe'), f = frame.current
    if (model && f) {
      const sz = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
      r = Math.min(sz.x, sz.z) / 2 / f.getWorldScale(new THREE.Vector3()).x
    }
    return { top, face, right: new THREE.Vector3(-face.z, 0, face.x), r, low: foot.y, stand }
  }
  /** the soup pot: its rim's middle, how wide it is inside, its floor, its soup's face; how wide it is over all (its lid too) (the pot's own
   * model: the steam over it isn't the pot (its box with the steam had the rim up in the air, and the ladle there)) */
  const potAt = () => {
    // (the one in the miso pot's own group on the counter (another of the name stands elsewhere))
    marks.current.delete('miso-pot')
    const o = markOf('miso-pot')?.getObjectByName('MisoPot') ?? null, f = frame.current
    if (!o || !f) return null
    f.updateWorldMatrix(true, false)
    const all = new THREE.Box3()
    o.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.name !== 'MisoSoup') all.expandByObject(m) })
    // (its rim and its width from its inside alone (item 253: from everything in it, the lid pushed half over and the pot's own ladle
    // standing up out of it, the rim was put in the air over the lid, and the ladle rested there)), measured along the pot's own two axes
    // from its vertices in the bar's frame: it's oval and stands turned, and a box of it square to the world was wider than it is (the
    // ladle went through its wall)
    o.updateWorldMatrix(true, true)
    const toBar = new THREE.Matrix4().copy(f.matrixWorld).invert()
    const o0 = o.localToWorld(new THREE.Vector3()).applyMatrix4(toBar)
    const ux = o.localToWorld(new THREE.Vector3(1, 0, 0)).applyMatrix4(toBar).sub(o0).setY(0).normalize()
    const uz = o.localToWorld(new THREE.Vector3(0, 0, 1)).applyMatrix4(toBar).sub(o0).setY(0).normalize()
    const span = (mesh: THREE.Object3D | undefined) => {
      const g = (mesh as THREE.Mesh | undefined)?.geometry?.attributes.position
      if (!mesh || !g) return null
      const m4 = new THREE.Matrix4().multiplyMatrices(toBar, mesh.matrixWorld), v = new THREE.Vector3()
      const s = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity }
      for (let i = 0; i < g.count; i++) {
        v.fromBufferAttribute(g, i).applyMatrix4(m4)
        const d = v.clone().sub(o0), px = d.dot(ux), pz = d.dot(uz)
        s.x0 = Math.min(s.x0, px); s.x1 = Math.max(s.x1, px); s.z0 = Math.min(s.z0, pz); s.z1 = Math.max(s.z1, pz); s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y)
      }
      return s
    }
    const ins = span(o.getObjectByName('MisoPotInside')), body = span(o.getObjectByName('MisoPotBody'))
    const alo = f.worldToLocal(all.min.clone()), ahi = f.worldToLocal(all.max.clone())
    if (!ins) return null
    const ax = (ins.x1 - ins.x0) / 2, az = (ins.z1 - ins.z0) / 2
    const top = o0.clone().addScaledVector(ux, (ins.x0 + ins.x1) / 2).addScaledVector(uz, (ins.z0 + ins.z1) / 2).setY(ins.y1)
    const lo = { y: ins.y0 }, hi = { x: ax * 2, z: az * 2 }
    /** how far its inside wall is from its middle the way `dir` points (an oval's) */
    const rimR = (dir: THREE.Vector3) => { const c = dir.dot(ux), s = dir.dot(uz); return (ax * az) / Math.max(1e-6, Math.hypot(az * c, ax * s)) }
    // (the soup's face where it's drawn (its node's origin is the pot's floor: the soup's at its height in the model))
    const soupFace = o.getObjectByName('MisoSoup')
    const soupBox = soupFace ? new THREE.Box3().setFromObject(soupFace) : null
    // (its lid's pushed half off toward its own -z (blender/misopot.py): the open half its +z, in the bar's frame)
    o.updateWorldMatrix(true, false)
    const open = f.worldToLocal(o.localToWorld(new THREE.Vector3(0, 0, 1))).sub(f.worldToLocal(o.localToWorld(new THREE.Vector3()))).setY(0).normalize()
    return { top, r: Math.min(hi.x, hi.z) / 2, floor: lo.y, open, rimR, rimTop: body ? body.y1 : undefined,
      outer: Math.min(Math.abs(ahi.x - alo.x), Math.abs(ahi.z - alo.z)) / 2 * 0.92,
      surface: soupBox && !soupBox.isEmpty() ? f.worldToLocal(soupBox.max.clone()).y : top.y - 0.03 }
  }
  // (in development, `__potAt()`: the soup pot as measured, in the bar's frame (item 253))
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __potAt: () => potAt() })
  /** a bowl's place on the counter beside something round (`at`, `r` across), on the side away from its neighbour (`other`) */
  const counterTops = useRef<{ at: number; boxes: THREE.Box3[] }>({ at: -1e9, boxes: [] })
  const onPrepTop = (p: THREE.Vector3) => {
    const f = frame.current
    if (!f) return true
    if (performance.now() - counterTops.current.at > 1000) {
      counterTops.current.at = performance.now()
      let root: THREE.Object3D = f
      while (root.parent) root = root.parent
      const boxes: THREE.Box3[] = []
      root.traverse((o) => {
        if (o.userData?.editId !== 'warmer' && o.userData?.editId !== 'prepcounter') return
        const b = new THREE.Box3().setFromObject(o)
        boxes.push(new THREE.Box3(f.worldToLocal(b.min.clone()), f.worldToLocal(b.max.clone())))
      })
      counterTops.current.boxes = boxes
    }
    const bs = counterTops.current.boxes
    if (!bs.length) return true
    // (a bowl's width in from every edge of the counter's top)
    return bs.some((b) => {
      const x0 = Math.min(b.min.x, b.max.x) + 0.06, x1 = Math.max(b.min.x, b.max.x) - 0.06
      const z0 = Math.min(b.min.z, b.max.z) + 0.06, z1 = Math.max(b.min.z, b.max.z) - 0.06
      return p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1
    })
  }
  /** a bowl's place on the counter beside something round (`at`, `r` across): the side away from its neighbour (`other`, `or` across)
   * first, else the side toward it if there's room between them; always on the counter's top */
  const besideOf = (at: THREE.Vector3, r: number, right: THREE.Vector3, face: THREE.Vector3, low: number, other: THREE.Vector3 | null, or = 0) => {
    const sd = other && other.clone().sub(at).dot(right) > 0 ? -1 : 1
    const spots = [sd, -sd].flatMap((s) => [0, -0.06, 0.05].map((df) => at.clone().addScaledVector(right, s * (r + 0.075)).addScaledVector(face, df).setY(low)))
    const clear = (p: THREE.Vector3) => onPrepTop(p) && (!other || p.clone().setY(0).distanceTo(other.clone().setY(0)) > or + 0.065)
    return spots.find(clear) ?? spots[0]
  }
  /** the cooker's places for filling a bowl of rice (SideBowls' FillAt) */
  const riceFillAt = (): FillAt => {
    const c = cookerAt(), p = potAt()
    // (the paddle's holder kept clear of the pot's body, its rolled rim (item 253))
    return { ...c, put: besideOf(c.top, c.r, c.right, c.face, c.low, p?.top ?? null, p?.outer ?? 0), keepOff: p ? [{ at: p.top, r: p.r * 1.06 }] : [] }
  }
  /** the soup pot's, and where one stands at it: in front of it as one stands at the cooker */
  const soupFillAt = (): FillAt => {
    const c = cookerAt(), p = potAt()
    if (!p) return { ...c, put: besideOf(c.top, c.r, c.right, c.face, c.low, null) }
    // (across from the pot before the counter's front, as far out as at the cooker (item 387: moved back from the pot as far as the cooker's
    // place is from the cooker, it stood in the counter: the pot's further in))
    const stand = frontOf(p.top, c.stand, c.top)
    // (the counter's top the one it stands in: the cooker's (one counter, the two joined))
    return { top: p.top, face: c.face, right: c.right, r: p.r, surface: p.surface, floor: p.floor, rimR: p.rimR, rimTop: p.rimTop, stand, low: c.low, open: p.open,
      put: besideOf(p.top, p.outer, c.right, c.face, c.low, c.top, c.r) }
  }
  /** a customer's bowls' place at the counter in its row (the bar's frame) */
  const passAt = (row: number, kind: 'rice' | 'soup') => stationIn((kind === 'rice' ? BOWL_PASS.rice : BOWL_PASS.soup).clone().setZ(PASS_Z[row] ?? BOWL_PASS.rice.z))
  /** a row at the counter with no bowls in it (none there, or being lifted off it), or -1 */
  const freeRow = () => {
    for (let r = 0; r < PASS_MAX; r++) if (!passQ.current.some((b) => b.row === r && (b.server === undefined || b.up < 1))) return r
    return -1
  }
  const passSpot = () => stationIn(BOWL_PASS.front).setY(0)
  /** the job's next customer: the first whose bowls can be filled now (the rice cooked and some in the pot; the soup hot), sat at the bar */
  const nextBowls = () => {
    const riceOk = RICE.kama.state === 'done' && RICE.rice > 0, soupOk = soupReady(SOUP.pot, SOUP.left)
    // (what can be had of it now taken out first, the rest left asked for: the soup while the rice is still cooking, or the other way; one
    // not at the bar just now (in the toilet) passed over for the next, not keeping everyone after them waiting)
    const k = BOWLS.want.findIndex((x) => ((x.rice && riceOk) || (x.soup && soupOk)) && guestSeat(x.guest) >= 0)
    if (k < 0) return null
    const w = BOWLS.want[k], seat = guestSeat(w.guest)
    const rice = w.rice && riceOk, soup = w.soup && soupOk
    if ((w.rice && !rice) || (w.soup && !soup)) BOWLS.want[k] = { ...w, rice: w.rice && !rice, soup: w.soup && !soup }
    else BOWLS.want.splice(k, 1)
    return { guest: w.guest, rice, soup, seat }
  }
  /** whether there's a customer's bowls to be filled now (nextBowls would give one): the rice cooked and some in the pot, or the soup hot, for
   * one sat at the bar (item 207: asked for while neither was ready, the plater took it for his job, found none to fill, and stood idle; the
   * plates, the soup's making and the rice's cooking under it never came to: the plating place bare, the fish done waited all evening) */
  const bowlsNow = () => {
    const riceOk = RICE.kama.state === 'done' && RICE.rice > 0, soupOk = soupReady(SOUP.pot, SOUP.left)
    return BOWLS.want.some((x) => ((x.rice && riceOk) || (x.soup && soupOk)) && guestSeat(x.guest) >= 0)
  }
  /** the bowls set down at their place: theirs (Roasting has them eat), drawn there and eaten down */
  const setBowls = (j: { guest: number; seat: number; rice: boolean; soup: boolean }) => {
    const now = performance.now()
    if (j.rice) { RICE_SEATS.add(j.seat); BOWLS.setAt.set(`rice:${j.seat}`, now); BOWLS.got.add(`rice:${j.guest}`) }
    if (j.soup) { SOUP_SEATS.add(j.seat); SOUP.served++; BOWLS.setAt.set(`soup:${j.seat}`, now); BOWLS.got.add(`soup:${j.guest}`) }
    BOWLS.ver++
  }
  /** the paddle's and the ladle's rests (hung on the cooker's handle, in the pot), looked at again a second at a time (moved in edit mode) */
  const restsAt = useRef<{ at: number; paddle: { grip: THREE.Vector3; q: THREE.Quaternion } | null; ladle: { grip: THREE.Vector3; q: THREE.Quaternion } | null }>({ at: -1e9, paddle: null, ladle: null })
  /** what stands on the bar's top that a tokkuri mustn't be set into (item 177: at one place of each pair it stood in the soy pot and the
   * wasabi the two share): the shared condiments, the little baskets, the soy dishes and the chopsticks, each its box on the top (the bar's
   * frame, x and z), looked at again a second at a time (they're moved in edit mode) */
  const barThings = useRef<{ at: number; boxes: THREE.Box2[] }>({ at: -1e9, boxes: [] })
  const thingsOnBar = () => {
    const now = performance.now(), f = frame.current
    if (now - barThings.current.at < 1000 || !f) return barThings.current.boxes
    barThings.current.at = now
    let root: THREE.Object3D = f
    while (root.parent) root = root.parent
    const boxes: THREE.Box2[] = []
    root.traverse((o) => {
      const id = o.userData?.editId
      if (typeof id !== 'string' || !/^(condiments|tablebasket|soydish|chopsticks|chopstickpair)/.test(id)) return
      const bb = new THREE.Box3().setFromObject(o)
      if (bb.isEmpty()) return
      const lo = f.worldToLocal(bb.min.clone()), hi = f.worldToLocal(bb.max.clone())
      boxes.push(new THREE.Box2(new THREE.Vector2(Math.min(lo.x, hi.x), Math.min(lo.z, hi.z)), new THREE.Vector2(Math.max(lo.x, hi.x), Math.max(lo.z, hi.z))))
    })
    barThings.current.boxes = boxes
    return boxes
  }
  /**
   * Where a seat's tokkuri and its cup are set (item 177; as the server sets them down, and as they're drawn there after): the first of a few
   * places that's clear of everything at that place and its neighbours': the shared soy pot and wasabi, the little basket, the soy dish, the
   * chopsticks (as they stand, moved or not), their plate, and where their soup bowl and their drink (bottle and cup) go whether they're there
   * yet or not; and the next places' tokkuri. Past the soup on the side away from their soy dish (as it was, item 89: at every other place it
   * stood in the soy pot, and beside the soup bowl and the drink it touched both), the other side past the soy dish, before the plate on
   * either side, or behind it. Worked out once for each tokkuri (kept in sakeSpots till it's cleared), so it's drawn where it was set
   */
  const sakeSpots = useRef(new Map<number, { at: THREE.Vector3; cup: THREE.Vector3 }>())
  const sakeSpotOf = (n: number) => {
    const kept = sakeSpots.current.get(n)
    if (kept) return kept
    const st = seats[n], c = counters[st.counter]
    const x = st.mid.clone().sub(c.at).dot(c.along)
    const side = -sauceSide(c, BAR_GATES[st.counter], x)
    const boxes = thingsOnBar()
    // (round things kept clear of: each place's plate, soup bowl and drink, this one's and its neighbours'; the tokkuri already set)
    const rounds: { p: THREE.Vector3; r: number }[] = []
    for (const m of [n - 1, n, n + 1]) {
      const sm = seats[m]
      if (!sm || sm.counter !== st.counter) continue
      const cm = counters[sm.counter], xm = sm.mid.clone().sub(cm.at).dot(cm.along)
      rounds.push({ p: sm.plate.clone(), r: 0.16 })
      rounds.push({ p: sm.mid.clone().addScaledVector(cm.along, -sauceSide(cm, BAR_GATES[sm.counter], xm) * 1.15).addScaledVector(cm.lay, PLACE.sauce[1]), r: 0.07 })
      rounds.push({ p: new THREE.Vector3(...drinkSpot(m, false)), r: 0.045 })
      rounds.push({ p: new THREE.Vector3(...drinkSpot(m, true)), r: 0.032 })
      const other = m === n ? null : sakeSpots.current.get(m)
      if (other) { rounds.push({ p: other.at, r: 0.04 }); rounds.push({ p: other.at.clone().add(other.cup), r: 0.03 }) }
    }
    const clear = (p: THREE.Vector3, r: number) => !boxes.some((bx) => p.x > bx.min.x - r && p.x < bx.max.x + r && p.z > bx.min.y - r && p.z < bx.max.y + r)
      && !rounds.some((o) => Math.hypot(p.x - o.p.x, p.z - o.p.z) < o.r + r)
    // (each try: the tokkuri along and across from the place's middle, its cup from it, along and across)
    const tries: [number, number, number, number][] = [
      [side * 1.55, PLACE.sauce[1] - 0.02, -Math.sign(side) * 0.07, 0.06], [-side * 1.55, PLACE.sauce[1] - 0.02, Math.sign(side) * 0.07, 0.06],
      [-0.25, -0.02, 0.07, -0.06], [0.25, -0.02, -0.07, -0.06], [-0.06, 0.26, 0.085, 0]]
    let pick: { at: THREE.Vector3; cup: THREE.Vector3 } | null = null
    for (const [a, l, ca, cl] of tries) {
      const at = st.mid.clone().addScaledVector(c.along, a).addScaledVector(c.lay, l).setY(top + 0.002)
      const cup = c.along.clone().multiplyScalar(ca).addScaledVector(c.lay, cl)
      pick ??= { at, cup }
      if (clear(at, 0.04) && clear(at.clone().add(cup), 0.03)) { pick = { at, cup }; break }
    }
    sakeSpots.current.set(n, pick!)
    return pick!
  }
  const platerObj = useRef<THREE.Group | null>(null)
  const platerStack = useRef<THREE.Group>(null)
  /** the bowl of rice in the plater's hands (washing it, carrying it to the pot, and the cooked rice to the tub) */
  const platerBowl = useRef<THREE.Group>(null)
  /** the rice ball in the third cook's hands as they shape it (item 129) */
  const platerBall = useRef<THREE.Group>(null)
  /** the bundle of iron skewers the plater carries to the sink and back to the holder */
  const platerSkewers = useRef<THREE.Group>(null)
  /** the same in a server's hands (one at a time washes them) */
  const serverSkewers = useRef<THREE.Group>(null)
  /** the fire kept by the plater (bar.ts's FIRE_TEND): a handful of charcoal from the crate, a dipper of water from the bucket (and the
   * dipper stirring the miso soup) */
  const platerCoal = useRef<THREE.Group>(null)
  const platerDipper = useRef<THREE.Group>(null)
  /** when the plater last stirred the soup (seconds, performance clock) */
  const soupAt = useRef(0)
  /** and when they last grated daikon (item 392; not straight away as the shop opens) */
  const grateAt = useRef(performance.now() / 1000)
  /** the plates stacked at the plating place, and those standing in the dryer (drawn as many as there are) */
  const plateStack = useRef<THREE.Group>(null)
  const dryerPlates = useRef<THREE.Group>(null)
  /** the used sticks in the bin by the sink (as many as are in it, up to a handful drawn) */
  /** the plates standing in the draining basket by the sink (washed by hand while the washer was busy) */
  const drainPlates = useRef<THREE.Group>(null)
  /** how long each of the plating place's slots has been ready to go */
  const readyFor = useRef<number[]>(Array.from({ length: READY_SLOTS }, () => 0))
  const kitchen = useMemo(() => kitchenOf(counters), [counters])
  /** the money just paid, rising over the one who paid it (the owner's: +NT$ in green) */
  const [payFloats, setPayFloats] = useState<{ key: number; id: number; text: string }[]>([])
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
      SAKE.station = false
      ownerBack()
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
  /** a seat's plate's middle, in the world (where the customer there puts their chopsticks: FolkFigure's `plate`) */
  const plateWorldAt = useRef(new THREE.Vector3())
  const plateWorld = useCallback((seat: number) => {
    const f = frame.current, st = seats[seat]
    return f && st ? f.localToWorld(plateWorldAt.current.copy(st.plate).setY(top + 0.015)) : null
  }, [seats, top])
  /** where a seat's drink stands on the bar, in the bar's frame (its sake cup a little nearer the customer than the bottle) */
  const drinkSpot = useCallback((seat: number, cup: boolean) => {
    const st = seats[seat], c = counters[st.counter]
    return st.mid.clone().addScaledVector(c.along, PLACE.drink[0] + (cup ? CUP_SIDE : 0)).addScaledVector(c.lay, PLACE.drink[1] - (cup ? CUP_AHEAD : 0)).setY(top).toArray() as [number, number, number]
  }, [seats, counters, top])
  /** the same in the world (for the customer's hand to go to) */
  const drinkWorldAt = useRef(new THREE.Vector3())
  const drinkWorld = useCallback((seat: number, cup: boolean) => {
    const f = frame.current
    return f && seats[seat] ? f.localToWorld(drinkWorldAt.current.fromArray(drinkSpot(seat, cup))) : null
  }, [seats, drinkSpot])
  /** where a seat's bowl of miso soup stands, in the world (its foot), for their hands to go to (item 345) */
  const soupWorldAt = useRef(new THREE.Vector3())
  const soupSpot = useRef<(n: number) => THREE.Vector3>(() => new THREE.Vector3())
  const soupWorld = useCallback((seat: number) => {
    const f = frame.current
    return f && seats[seat] ? f.localToWorld(soupWorldAt.current.copy(soupSpot.current(seat))) : null
  }, [seats])
  const scene = useThree((st) => st.scene)
  const camera = useThree((st) => st.camera)
  const marks = useRef(new Map<string, THREE.Object3D | null>())
  /** when each mark was last looked for and not found: looked for again a second later (the owner, 2026-11-15: the dirty stack and the
   * draining basket's plates hung in the air over the cook table's end: their marks first looked for before the sink's model was in, the
   * miss was kept for good and they stood at the fallback all day) */
  const missed = useRef(new Map<string, number>())
  /** whether a mark is still in the scene (a piece rebuilt leaves its old one in a subtree no longer drawn: its place was a stale one) */
  /** a mark of the sink's: looked for only in the sink's own pieces (the sink and what stands on it, `sink`, `sink-*`), never by its name over
   * the whole room; and only if it's within a few metres of the sink (the owner, 2026-11-15: the dirty stack and a row of plates stood by the
   * cook table's lantern, over the fire bed, in their game; never found so here, but never to be possible: they wait for the sink instead) */
  const sinkMark = (name: string): THREE.Object3D | null => {
    let home: THREE.Object3D | null = null, hit: THREE.Object3D | null = null
    scene.traverse((q) => {
      const id = q.userData?.editId
      // (the sink's own place: the group it's set out in (Decor's look-sink); its piece's root is at the room's origin)
      if (id === 'sink') home = q.getObjectByName('look-sink') ?? q
      if (!hit && (id === 'sink' || (typeof id === 'string' && id.startsWith('sink-')))) hit = q.getObjectByName(name) ?? null
    })
    if (!hit || !home) return null
    const h = (home as THREE.Object3D).getWorldPosition(new THREE.Vector3())
    return (hit as THREE.Object3D).getWorldPosition(new THREE.Vector3()).distanceTo(h) < 3 ? hit : null
  }
  const inScene = (o: THREE.Object3D) => { let q: THREE.Object3D = o; while (q.parent) q = q.parent; return q === scene }
  /** when each mark found was last made sure of (twice a second at most: it's asked for many times a frame) */
  const sure = useRef(new Map<string, number>())
  const markOf = (name: string) => {
    let o = marks.current.get(name)
    const now = performance.now()
    let stale = false
    if (o && now - (sure.current.get(name) ?? 0) > 500) { sure.current.set(name, now); stale = !inScene(o) }
    if (o === undefined || stale || (o === null && now - (missed.current.get(name) ?? 0) > 1000)) {
      o = name.startsWith('Sink') ? sinkMark(name) : scene.getObjectByName(name) ?? null
      marks.current.set(name, o)
      if (o === null) missed.current.set(name, now)
    }
    return o
  }
  const inBar = (name: string, or: THREE.Vector3) => {
    const o = markOf(name), f = frame.current
    if (!o || !f) return or.clone()
    f.updateWorldMatrix(true, false)
    return f.worldToLocal(o.getWorldPosition(new THREE.Vector3()))
  }
  const endOf = (sd: number) => counters[0].at.clone().addScaledVector(ALONG, sd * (counters[0].length / 2 - 0.25)).addScaledVector(LAY, 0.11).setY(top)
  /** the step stool before the basin (item 221; Sink's StepStoolModel): its top's middle on the kitchen's floor (the bar's frame), its own
   * across and depth there, its half sizes and its height, looked at again a second at a time (it's moved in edit mode); none drawn, null */
  const stool = useRef<{ at: number; mid: THREE.Vector3; ax: THREE.Vector3; az: THREE.Vector3; hx: number; hz: number; h: number } | null>(null)
  const stoolAt = useRef(-1e9)
  const stoolNow = () => {
    const now = performance.now()
    if (now - stoolAt.current < 1000) return stool.current
    stoolAt.current = now
    const o = markOf('StepStoolTop'), f = frame.current
    if (!o || !f || !o.parent) return (stool.current = null)
    f.updateWorldMatrix(true, false)
    o.updateWorldMatrix(true, false)
    const m = f.matrixWorld.clone().invert().multiply(o.matrixWorld)
    const topAt = new THREE.Vector3().setFromMatrixPosition(m), foot = f.worldToLocal(o.parent.getWorldPosition(new THREE.Vector3()))
    const ex = new THREE.Vector3().setFromMatrixColumn(m, 0), ez = new THREE.Vector3().setFromMatrixColumn(m, 2)
    return (stool.current = { at: now, mid: topAt.clone().setY(0), ax: ex.clone().setY(0).normalize(), az: ez.clone().setY(0).normalize(),
      hx: ex.length() * STOOL_HALF[0], hz: ez.length() * STOOL_HALF[1], h: Math.max(0, topAt.y - foot.y) })
  }
  /** how high one standing there (the bar's frame, on the kitchen's floor) stands: up on the stool's top over it, a step's ramp at its edges
   * (stepping up onto it and down off it, not a jump) */
  const stoolY = (p: THREE.Vector3) => {
    const st = stoolNow()
    if (!st) return 0
    const d = p.clone().sub(st.mid).setY(0)
    const e = Math.max(Math.abs(d.dot(st.ax)) - (st.hx - STOOL_STEP), Math.abs(d.dot(st.az)) - (st.hz - STOOL_STEP)) / STOOL_STEP
    if (e >= 1) return 0
    const k = Math.min(1, Math.max(0, e))
    return st.h * (1 - k * k * (3 - 2 * k))
  }
  /** how high a figure stands for the stool, eased (the day's audit, item 221: at x2, a frame a tenth of a second, a server crossed its edge's
   * ramp in a frame and went 0.32 up in it, 46 times a day): toward what stoolY has there, no faster than a step's climb (STOOL_CLIMB), kept
   * on the figure */
  // (kept in a map of its own, not on the figure's userData: React hands a waiter's group a new userData each time the bar redraws, and the
  // second day's audit still saw seven of them go 0.32 up in a frame)
  const stoolLifts = useRef(new WeakMap<THREE.Object3D, number>())
  /** each customer's facing as shown and the one it's turning to (item 242: on their userData, lost each time the bar redrew) */
  const facings = useRef(new WeakMap<THREE.Object3D, { shown: number; want: number }>())
  const stoolLift = (o: THREE.Object3D, p: THREE.Vector3, dt: number) => {
    const want = stoolY(p)
    const was = stoolLifts.current.get(o)
    const now = was === undefined ? want : was + THREE.MathUtils.clamp(want - was, -STOOL_CLIMB * dt, STOOL_CLIMB * dt)
    stoolLifts.current.set(o, now)
    return now
  }
  /** a place before the sink brought onto the stool's top, clear of its edges (where those washing stand: up on it, item 221) */
  const ontoStool = (p: THREE.Vector3) => {
    const st = stoolNow()
    if (!st) return p
    const d = p.clone().sub(st.mid).setY(0)
    const x = THREE.MathUtils.clamp(d.dot(st.ax), -(st.hx - STOOL_STEP * 1.5), st.hx - STOOL_STEP * 1.5)
    const z = THREE.MathUtils.clamp(d.dot(st.az), -(st.hz - STOOL_STEP * 1.5), st.hz - STOOL_STEP * 1.5)
    return st.mid.clone().addScaledVector(st.ax, x).addScaledVector(st.az, z).setY(p.y)
  }
  /** where a plate's lifted off rack `i`, and where a server stands for it */
  const rackTop = (i: number) => inBar(`rack-top-${i}`, endOf(-1))
  const rackFront = (i: number) => inBar(`rack-front-${i}`, endOf(-1)).setY(0)
  /** the low rack by the cook table: where the plates are lifted off it, and where the plater stands at it (looked for afresh: it's moved by hand) */
  const lowTop = () => { marks.current.delete('lowrack-top'); return inBar('lowrack-top', endOf(-1)) }
  const lowFront = () => { marks.current.delete('lowrack-front'); return inBar('lowrack-front', endOf(-1)).setY(0) }
  /** the rack a plate comes off now, and goes back onto: the count is shown across the two, the second's emptying first */
  const rackNow = (n = PLATE_RACK.n) => (n > PER_RACK ? 1 : 0)
  /** the k-th plate up the dirty stack in the sink's basin (they're stacked there a little smaller: the customers' plates are drawn big, the
   * basin's a real sink's size) */
  const dirtyAt = (k: number) => {
    const c = onCounter.current
    if (k < c) return counterAt(k)
    return inBar('SinkBasinFloor', endOf(1)).add(new THREE.Vector3(0, 0.004 + sinkStackUp(c, k), 0))
  }
  /** how far up the k-th of the sink's dirty plates stands over the first of its stack (`from`, the counter's 0, the basin's the first in
   * it): a round one on a round one nested into it (NEST_GAP), a long one on or under any other on its rim (STACK_GAP) (item 358) */
  const sinkStackUp = (from: number, k: number) => {
    let y = 0
    const K = SINK.kinds
    for (let i = from + 1; i <= Math.min(k, from + SINK_SHOWN - 1); i++) y += K[i] === 'long' || K[i - 1] === 'long' ? STACK_GAP : NEST_GAP
    return y * IN_SINK
  }
  /** the k-th plate up the stack waiting on the counter (item 82, the owner's circle): in front of the draining basket toward the counter's
   * front, a little toward its far end from the basin, on the counter's top (found from the sink's own marks, again now and then: it's moved
   * by hand in edit mode) */
  const counterAt = (k: number) => {
    const now = performance.now()
    if (!counterSpot.current || now - counterSpot.current.t > 2000) {
      const b = markOf('SinkBasket'), fr = markOf('SinkFront'), top = markOf('SinkTop'), f = frame.current
      if (!b || !fr || !top || !f) return inBar('SinkBasinFloor', endOf(1))
      const bw = b.getWorldPosition(new THREE.Vector3()), front = fr.getWorldPosition(new THREE.Vector3()).sub(bw).setY(0).normalize()
      const side = new THREE.Vector3(front.z, 0, -front.x)
      let y = new THREE.Box3().setFromObject(top).max.y
      f.updateWorldMatrix(true, false)
      let at = bw.addScaledVector(front, 0.52).addScaledVector(side, 0.25).setY(y)
      // (worked out in the counter top's own frame (the owner's, 2026-11-15: the stack hung half off the counter's corner, over the palm
      // brush's dish, the sink moved since those offsets were measured): in the clear space in front of the draining basket, between its
      // front edge and the counter's, a plate's width and a centimetre in from every edge)
      const tm = top as THREE.Mesh
      if (tm.isMesh) {
        if (!tm.geometry.boundingBox) tm.geometry.computeBoundingBox()
        const tb = tm.geometry.boundingBox!, ts = tm.getWorldScale(new THREE.Vector3()).x, fs = f.getWorldScale(new THREE.Vector3()).x
        // (a plate's own reach measured off one of the drawn ones (its rim reaches past PLATE_R), and a centimetre)
        const one = sinkPlates.current.find((q) => q)
        const reach = one ? (() => { const sz = new THREE.Box3().setFromObject(one).getSize(new THREE.Vector3()); return Math.max(sz.x, sz.z) / 2 })() : PLATE_R * IN_SINK * fs * 1.2
        const r = (reach + 0.01) / ts
        const bb = new THREE.Box3()
        const wb = new THREE.Box3().setFromObject(b)
        for (const cx of [wb.min.x, wb.max.x]) for (const cy of [wb.min.y, wb.max.y]) for (const cz of [wb.min.z, wb.max.z]) bb.expandByPoint(tm.worldToLocal(new THREE.Vector3(cx, cy, cz)))
        // (the basket against the back (-z) or the front: the clear strip on the other side of it; along it, its far end's half)
        const back = (bb.min.z + bb.max.z) / 2 < (tb.min.z + tb.max.z) / 2
        const z = back ? (bb.max.z + tb.max.z) / 2 : (bb.min.z + tb.min.z) / 2
        // (along it, the basket's own middle (the owner, 2026-11-15, circled: right in front of it, not off at the counter's end))
        const x = (bb.min.x + bb.max.x) / 2
        const l = new THREE.Vector3(THREE.MathUtils.clamp(x, tb.min.x + r, tb.max.x - r), 0, THREE.MathUtils.clamp(z, tb.min.z + r, tb.max.z - r))
        at = tm.localToWorld(l).setY(y)
        // (on the counter's top where the stack stands, found by a ray down onto it alone (item 358, the owner's 「漂浮?」: its box's top
        // was the splashback's along its back edge, the stack 10.5 cm over the counter, in the air))
        SURFACE_RAY.set(TOP_FROM.set(at.x, y + 0.5, at.z), DOWN_Y)
        const hit = SURFACE_RAY.intersectObject(tm, false, SURFACE_HITS)
        if (hit.length) at.y = y = hit[0].point.y
        SURFACE_HITS.length = 0
      }
      counterSpot.current = { at: f.worldToLocal(at), t: now }
    }
    return counterSpot.current.at.clone().add(new THREE.Vector3(0, 0.002 + sinkStackUp(0, k), 0))
  }
  /** a place in the bar's frame as the first counter's (along it, across it): the kitchen's floor and all that stands on it lie square there */
  const flat = (v: THREE.Vector3): [number, number] => { const c0 = counters[0], d = v.clone().sub(c0.at); return [d.dot(c0.along), d.dot(c0.lay)] }
  /** what stands on the kitchen's floor, as rectangles in that frame, each grown by room to pass: the cook's table, the rice tub, the freezer,
   * the racks and the sink, from where their shapes really reach (worked out once a day: nothing's moved while the shop's open) */
  const blocksMade = useRef<Rect[] | null>(null)
  /** which piece each of them is (the cook's table 'cooktable'), for the paths' map (item 168) */
  const blockIds = useRef<string[]>([])
  const kitchenBlocks = (): Rect[] => {
    const f = frame.current
    if (blocksMade.current) return blocksMade.current
    if (!f) return []
    f.updateWorldMatrix(true, false)
    const toBar = new THREE.Matrix4().copy(f.matrixWorld).invert()
    const out: Rect[] = []
    const ids: string[] = []
    const grown = (fl: [number, number][], id = '') => ids.push(id) && out.push({ x0: Math.min(...fl.map((q) => q[0])) - PASS_ROOM, z0: Math.min(...fl.map((q) => q[1])) - PASS_ROOM,
      x1: Math.max(...fl.map((q) => q[0])) + PASS_ROOM, z1: Math.max(...fl.map((q) => q[1])) + PASS_ROOM })
    const v = new THREE.Vector3(), m4 = new THREE.Matrix4()
    scene.traverse((o) => {
      // (and the keep-clear patches put down in edit mode (item 168))
      const id = o.userData?.editId
      if (!KITCHEN_BLOCKS.has(id) && !(typeof id === 'string' && id.startsWith('pathzone-'))) return
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
      if (a0 < a1) grown([[a0, l0], [a1, l1]], o.userData.editId as string)
    })
    const t0 = markOf('cook-table-c0'), t1 = markOf('cook-table-c1')
    if (t0 && t1) grown([flat(f.worldToLocal(t0.getWorldPosition(new THREE.Vector3()))), flat(f.worldToLocal(t1.getWorldPosition(new THREE.Vector3())))], 'cooktable')
    blocksMade.current = out
    blockIds.current = ids
    return out
  }
  /** where the waypoints set by hand are counted from (item 189): the kitchen's middle (not the keep-clear patches' first place, which goes
   * with the serving counter: a waypoint stays where it was put) */
  const viaHome = useMemo(() => {
    const k = kitchenOf(counters), c0 = counters[0]
    return c0.at.clone().addScaledVector(c0.along, (k.along[0] + k.along[1]) / 2).addScaledVector(c0.lay, (k.lay[0] + k.lay[1]) / 2).setY(0)
  }, [counters])
  /** the staff's places a way's ends are known by (item 189): each server's own place, the owner's, the sink, the racks, the plating place's
   * two sides; looked at afresh at most twice a second */
  const placesMemo = useRef({ at: -1e9, list: [] as { key: string; at: THREE.Vector3 }[] })
  const placesNow = () => {
    const now = performance.now()
    if (now - placesMemo.current.at > 500) {
      const pl = platingOf()
      placesMemo.current = { at: now, list: [...homes.map((h, i) => ({ key: `server-${i}`, at: h.at.clone().setY(0) })), { key: 'owner', at: ownerAt() },
        { key: 'sink', at: sinkFront() }, { key: 'rack-0', at: rackFront(0) }, { key: 'rack-1', at: rackFront(1) },
        { key: 'plate-out', at: pl.out.clone().setY(0) }, { key: 'plate-in', at: pl.in.clone().setY(0) }] }
    }
    return placesMemo.current.list
  }
  /** the waypoints set by hand for the way between the places `from` and `to` stand at (each within a step of one), nearest `from` first; none
   * for a way between any other two points */
  const viaStops = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] => {
    const vias = getEdit().vias
    if (!Object.keys(vias).length) return []
    const places = placesNow()
    const near = (p: THREE.Vector3) => {
      let best: string | null = null, d = 0.35
      for (const q of places) { const e = Math.hypot(q.at.x - p.x, q.at.z - p.z); if (e < d) { d = e; best = q.key } }
      return best
    }
    const a = near(from), b = near(to)
    const ids = a && b && a !== b ? vias[`${a}>${b}`] ?? vias[`${b}>${a}`] : undefined
    if (!ids?.length) return []
    const dx = to.x - from.x, dz = to.z - from.z
    const along = (p: THREE.Vector3) => (p.x - from.x) * dx + (p.z - from.z) * dz
    return ids.map((id) => { const o = offsetOf(id); return viaHome.clone().add(new THREE.Vector3(o[0], 0, o[2])) }).sort((p, q) => along(p) - along(q))
  }
  /** a server's way across the kitchen's floor, round the cook's table and all that stands on it (game/kitchenPath); one between two of the
   * staff's places given waypoints by hand in edit mode goes through them in turn (item 189), each leg still round what's in the way */
  const kitchenRoute = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] => {
    const c0 = counters[0], k = kitchenOf(counters)
    const back = ([a, l]: [number, number]) => c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
    const area = { x0: k.along[0], z0: k.lay[0], x1: k.along[1], z1: k.lay[1] }, blocks = kitchenBlocks()
    // (its two ends, where one's set inside a piece itself, moved out to stand up against it (game/kitchenPath's outOfPieces, item 333): no
    // way walks into or out of the middle of the warmer, the low rack or the cook table)
    const end = (v: THREE.Vector3) => { const q = flat(v), o = outOfPieces(q, blocks, PASS_ROOM); return o === q ? v : back(o) }
    const start = end(from)
    const stops = [start, ...viaStops(from, to), end(to)]
    let out: THREE.Vector3[] = []
    for (let i = 1; i < stops.length; i++) {
      const way = kitchenPath(flat(stops[i - 1]), flat(stops[i]), area, blocks)
      const leg = way ? way.map(back) : [stops[i - 1].clone().setY(0), stops[i].clone().setY(0)]
      out = i === 1 ? leg : [...out, ...leg.slice(1)]
    }
    // (and from just where they stand: one at their place in a piece's reach (the third cook in his bay at the cook table) moved out to the
    // clear floor at the way's start, they set off from there, 0.7 away, a jump each time (item 411))
    if (start !== from && out.length && out[0].distanceTo(from.clone().setY(0)) > 0.02) out.unshift(from.clone().setY(0))
    return out
  }
  /** the paths' map (item 168, PathMap) filled: what's in the way, looked at afresh (it may have been moved in edit mode); the staff's usual
   * ways (from each one's place, and the owner's, to the sink, the racks and the plating place), worked out again only when that's changed;
   * the ways being walked; the customers' from the door to each seat */
  const pathsMap = useRef({ at: 0, sig: '', staff: [] as PathRoute[] })
  /** when the serving counter's marks were last read */
  const serveRead = useRef(0)
  const mapPaths = (now: number) => {
    if (now - pathsMap.current.at < 500) return
    pathsMap.current.at = now
    blocksMade.current = null
    const blocks = kitchenBlocks()
    const c0 = counters[0]
    const back = (a: number, l: number) => c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
    PATH_MAP.blocks = blocks.map((r, i) => ({ id: blockIds.current[i] ?? '', pts: [back(r.x0, r.z0), back(r.x1, r.z0), back(r.x1, r.z1), back(r.x0, r.z1)] }))
    // (and the waypoints set by hand, where each stands: a way given one, or one moved, is worked out again (item 189))
    const vias = getEdit().vias
    const sig = blocks.map((r) => [r.x0, r.z0, r.x1, r.z1].map((v) => v.toFixed(2)).join()).join('|') + '#'
      + Object.entries(vias).map(([key, ids]) => `${key}:${ids.map((id) => offsetOf(id).map((v) => v.toFixed(2)).join()).join(';')}`).join('|')
    if (sig !== pathsMap.current.sig) {
      pathsMap.current.sig = sig
      placesMemo.current.at = -1e9
      const pl = platingOf()
      // (each named: whose, from where to where (item 189))
      // (from where each server really stands: their place stepped clear of what's on the floor (clearHome), as they walk from it; the place
      // as set (under the warmer, item 333) drew a way through it that nobody walked)
      const from = [...homes.map((h, i) => ({ who: `server-${i}`, at: (clearHome(i) ?? h).at })), { who: 'owner', at: ownerAt() }]
      const to = [{ key: 'sink', at: sinkFront() }, { key: 'rack-0', at: rackFront(0) }, { key: 'rack-1', at: rackFront(1) }, { key: 'plate-out', at: pl.out }, { key: 'plate-in', at: pl.in }]
      pathsMap.current.staff = from.flatMap((a) => to.map((b): PathRoute => ({ kind: 'staff', who: a.who, from: a.who, to: b.key, key: `${a.who}>${b.key}`, pts: kitchenRoute(a.at, b.at) })))
    }
    const live: PathRoute[] = []
    const walking = (who: string, pts: THREE.Vector3[]) => { if (pts.length > 1) live.push({ kind: 'live', who, from: '', to: '', pts }) }
    waiters.current.forEach((w, i) => { if (w.phase !== 'idle') walking(ownerServes ? 'owner' : `server-${i}`, w.path) })
    if (platerRun.current.phase !== 'idle') walking('plater', platerRun.current.path)
    if (bossWash.current) walking('owner', bossWash.current.path)
    const guestWays = seats.map((st, n): PathRoute => ({ kind: 'guest', who: 'guest', from: 'door', to: `seat-${n}`, pts: pathTo(counters, st) }))
    PATH_MAP.routes = [...pathsMap.current.staff, ...live, ...guestWays]
    // (the places named on the floor: the staff's own and where they go, the door, each seat at its way's end)
    PATH_MAP.places = [...placesNow(), ...(guestWays.length ? [{ key: 'door', at: guestWays[0].pts[0] }] : []), ...guestWays.map((g) => ({ key: g.to, at: g.pts[g.pts.length - 1] }))]
    PATH_MAP.home = viaHome
    PATH_MAP.v++
  }
  /**
   * The serving counter's place (item 167, the owner's red box): in the corridor between the cook table and the freezer, its middle midway
   * across between the two (as they really reach, not the room left round them) and along at the freezer's middle, square to the cook table;
   * measured once both are found (not a number set blind), then kept (moved by hand in edit mode, it's the edit's)
   */
  const [servePlace, setServePlace] = useState<{ at: THREE.Vector3; yaw: number } | null>(null)
  /** the keep-clear patches (item 168), and where a new one's first put down: the serving counter's side, toward the cook table, else the
   * kitchen's middle */
  const zoneHome = useMemo(() => {
    if (servePlace) return servePlace.at.clone().add(new THREE.Vector3(Math.sin(servePlace.yaw), 0, Math.cos(servePlace.yaw)).multiplyScalar(0.45))
    const k = kitchenOf(counters), c0 = counters[0]
    return c0.at.clone().addScaledVector(c0.along, (k.along[0] + k.along[1]) / 2).addScaledVector(c0.lay, (k.lay[0] + k.lay[1]) / 2).setY(0)
  }, [servePlace, counters])
  /** when it was last measured, and how many times running it's come out the same */
  const placeTry = useRef({ at: 0, same: 0 })
  const placeServe = () => {
    // (measured once a second till it's come out the same twice (the freezer's own place is put on it a moment after the page comes
    // up: measured at once, the counter stood by the sink, a quarter under the floor), and all the while in edit mode, where they may move)
    const now = performance.now()
    if (now - placeTry.current.at < 1000 || (placeTry.current.same >= 2 && !getEdit().on)) return
    placeTry.current.at = now
    blocksMade.current = null
    const blocks = kitchenBlocks(), ids = blockIds.current
    const t = blocks[ids.indexOf('cooktable')], fz = blocks[ids.indexOf('freezer')]
    // (not both found yet: looked at again in a second, not kept so for the day)
    if (!t || !fz) { blocksMade.current = null; return }
    // (the floor it stands on: the dais the freezer stands on, as high as the freezer's foot)
    let fo: THREE.Object3D | null = null
    scene.traverse((o) => { if (!fo && o.userData?.editId === 'freezer') fo = o })
    const f = frame.current
    if (!fo || !f) return
    const foot = f.worldToLocal(new THREE.Box3().setFromObject(fo).min).y
    const c0 = counters[0]
    // (which side of the cook table the freezer's on, across it: the corridor's between the table's edge and the freezer's front)
    const tableEdge = fz.z0 > t.z1 ? t.z1 - PASS_ROOM : t.z0 + PASS_ROOM, freezerFront = fz.z0 > t.z1 ? fz.z0 + PASS_ROOM : fz.z1 - PASS_ROOM
    const a = (fz.x0 + fz.x1) / 2, l = (tableEdge + freezerFront) / 2
    const at = c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(foot)
    // (its long side along the table, its front (+z) toward the cook table: the side the servers come by)
    const toTable = c0.lay.clone().multiplyScalar(fz.z0 > t.z1 ? -1 : 1)
    const yaw = Math.atan2(toTable.x, toTable.z)
    if (servePlace && servePlace.at.distanceTo(at) < 0.005 && Math.abs(servePlace.yaw - yaw) < 1e-3) { placeTry.current.same++; return }
    placeTry.current.same = 0
    setServePlace({ at, yaw })
  }
  // (the crew's way home goes round the same things: Roasting asks for it as they leave)
  useEffect(() => {
    KITCHEN_ROUTE.route = (from, to) => kitchenRoute(from, to)
    // (and where to stand clear of it all: the third cook's place was under the warming counter put where he stood)
    KITCHEN_ROUTE.clear = (at) => {
      const blocks = kitchenBlocks()
      if (!blocks.length) return at.clone()
      const [a, l] = standClear(flat(at), blocks), c0 = counters[0]
      return c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(at.y)
    }
    return () => { KITCHEN_ROUTE.route = null; KITCHEN_ROUTE.clear = null }
  })

  // the plates: those out at the seats (or on their way), and the two stacks
  const [, setTick] = useState(0)
  const redraw = () => setTick((n) => n + 1)
  /** the places with soy in their dish just now, a bit a seat (seatSoys) */
  const soyMask = useRef(0)
  const runs = useRef<PlateRun[]>([])
  if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __plateRuns: runs })
  /** the plating place's carrier dishes (one a slot) */
  const carriers = useRef<(THREE.Group | null)[]>([])
  const runSeq = useRef(0)
  const runObjs = useRef(new Map<number, THREE.Group>())
  /** the dirty plates in the sink, and the washing (time since the last plate came out; null while the tap's off) */
  const dirty = useRef(0)
  /** how many of those are waiting on the counter in front of the draining basket, not in the basin (the day's first, item 82): the bottom of
   * the dirty stack, so the basin's are washed first */
  const onCounter = useRef(0)
  const counterSpot = useRef<{ at: THREE.Vector3; t: number } | null>(null)
  /** each sink plate's group, the bottom one first (its smear faded as it soaks) */
  const sinkPlates = useRef<(THREE.Group | null)[]>([])
  /** when the sink's plates were last put where the sink is (item 113) */
  const sinkPlaced = useRef(0)
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
    runs.current.push({ key: ++runSeq.current, seat, guest, phase: 'serve', t: 0, from: rackTop(ri), kind: kindFor(guest) })
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
      if (t.short) { gripe(guest, 'tissue'); onSay?.('guest', LINES[lang].noTissue(guest), guest) }
      // (one of them crumpled up and left by their plate, on its right (the owner's), for the server who clears it)
      if (r && tissuesAt(at) < BOX_SHEETS && !t.short) {
        const st = seats[r.seat], c = counters[st.counter]
        r.tissue = st.mid.clone().addScaledVector(c.along, -0.13).addScaledVector(c.lay, -0.06).setY(top).sub(plateAt(r.seat)).toArray() as [number, number, number]
      }
    }
  }
  /** a plate done with: left at the seat for a server to clear (the owner's: nobody's plates fly), or, with none, away to the sink by itself */
  const leftDirty = (r: PlateRun) => {
    r.sticks = SEAT_STICKS.get(r.seat) ?? 0
    SEAT_STICKS.delete(r.seat)
    r.bones = SEAT_BONES.get(r.seat) ?? 0
    SEAT_BONES.delete(r.seat)
    // (dirty by what was eaten off it: a skewer's stick or a fish's bones for each, at least the one dish)
    r.dirt = plateDirt(Math.max(1, r.sticks + r.bones))
    // (where their drink stood, from the plate: the glass is left there till the plate's taken, then rides on it)
    if (shownRef.current.find((x) => x.id === r.guest)?.drink) {
      const st = seats[r.seat], c = counters[st.counter]
      r.glass = st.mid.clone().addScaledVector(c.along, PLACE.drink[0]).addScaledVector(c.lay, PLACE.drink[1]).setY(top).sub(plateAt(r.seat)).toArray() as [number, number, number]
      const who = shownRef.current.find((x) => x.id === r.guest)!
      r.drink = who.drink as DrinkId
      r.level = 1 - (who.drunk ?? 0)
    } else { r.glass = undefined; r.drink = undefined }
    if (waiters.current.length) { r.phase = 'dirty'; r.t = 0 } else { r.phase = 'clear'; r.t = -CLEAR_DELAY }
  }
  /** (every second) the plates out at seats looked over for any left where nobody sits */
  const sweep = useRef(0)
  const sinkFront = () => ontoStool(inBar('SinkFront', endOf(1)).setY(0))
  /**
   * The owner going to wash the stack of dirty plates left on the sink's counter (game/sinkPile, item 103, the owner's, 2026-11-14): nobody
   * washes it but the player, till the third day; then, a few seconds into the day, if it's still there, he says so (over his head and in
   * the log) and walks from the fire to the sink, scrubs it plate by plate into the draining basket, and walks back. Out serving himself (no
   * server hired), it's simply his to wash as a server's chore from then; out on another errand, he goes once he's back.
   */
  const bossWash = useRef<{ phase: 'go' | 'wash' | 'back'; path: THREE.Vector3[]; len: number; t: number; pos: THREE.Vector3; yaw: number
    /** sent by the player (item 166): every dirty plate washed, a plate's worth of the liquid each, not only the counter's stack; and where he
     * came from, to go back to */
    manual?: boolean; home?: THREE.Vector3
    /** washing (item 174): the sponge being taken up (`grab`), a plate being washed (`plate`), the sponge put back (`stow`); the plate in hand:
     * how dirty, its pattern, how it lay turned on the stack and where it was taken from; the left hand where the last plate left it (the bar's
     * frame); the way he faces the basin; the beats' sounds made */
    sub?: 'grab' | 'plate' | 'stow'; dirt?: number; design?: number; spin?: number; inHand?: boolean; from?: THREE.Vector3; fromL?: THREE.Vector3
    base?: number; sounds?: number
    /** whether the plate in hand's washed with the liquid (item 217: without, scrubbed longer and no suds) */
    soapy?: boolean
    /** the plate in hand's kind (item 228) */
    kind?: PlateKind } | null>(null)
  const bossObj = useRef<THREE.Group | null>(null)
  /** where the owner is just now, in the bar's frame: his own figure's place (at the fire while the shop's shut, along the aisle while it's
   * open), so he walks off from where he's seen and comes back there */
  const bossNow = () => {
    const b = scene.getObjectByName('BossFollow'), f = frame.current
    return b && f ? f.worldToLocal(b.getWorldPosition(new THREE.Vector3())).setY(0) : ownerAt()
  }
  // ---- the owner washing up by hand, beat by beat (item 174, the owner's, 2026-11-15: 「別再讓我看到這麼低水平的動畫」: a plate a second went
  // out of the stack and into the basket by itself while his hands circled inside the counter, the sponge left on its dish): he takes the
  // sponge up, takes the top plate off the stack, scrubs it over the water as he turns it, rinses it under the tap (or swishes it in the
  // water with the tap shut), stands it in the basket's next slot, and so on; the sponge put back after the last. The plate leaves the stack
  // as it's taken up, and joins the basket as it's let go (game/handWash's washBeat; scene/washMotion's pose)
  const WASH_POSE = useMemo(newWashPose, [])
  /** his hands in the world, for his figure (OwnerWalker reads them off his group) */
  const WASH_HANDS = useMemo(() => ({ left: new THREE.Vector3(), right: new THREE.Vector3() }), [])
  const washPts = useRef<WashPoints | null>(null)
  /** the plate in his hand, its scaled inside (the plate drawn), the suds on it, the drops off it */
  const washHeld = useRef<THREE.Group>(null)
  const washPlateIn = useRef<THREE.Group>(null)
  const washFoam = useRef<THREE.Group>(null)
  const washDrips = useRef<THREE.Group>(null)
  /**
   * The plate the player's washing by hand (item 224, the owner's, 2026-11-16: 「自己洗盤子的時候老闆不用來，可以拖曳盤子泡水or給水龍頭直接沖，用菜瓜布+洗碗精清潔
   * 更快」; item 234: 「流理台洗碗玩法還是很不順」: each plate was taken up, carried to a spot under the tap the size of a plate, held, carried to
   * the basket and let go, four moves a plate). Now a press on the dirty stack or the basin takes the top one up and it goes where the water
   * is by itself: under the running tap (the tap turned on if there's no water at all), or into the water standing in the basin; held down,
   * the pointer's to and fro scrubs it, faster with the sponge and the liquid (game/handWash's handClean); clean, it goes into the draining
   * basket by itself, and while the press is held the next one's taken up; let go, one not yet clean goes back on the stack. How dirty it is,
   * its pattern, where it is (`at`), how hard it's being scrubbed, whether it's had the liquid on it; the pointer's last place and time; when it
   * was last said of, whether it's been splashed into the water; whether the press is still held; washing it, or on its way into the basket
   * (`t` along, from `from`); how many washed this press
   */
  const hand = useRef<{ dirt: number; design: number; kind: PlateKind; at: HandAt; scrub: number; soaped: boolean; px: number; py: number; pt: number; said: number
    wet: boolean; heard: number; down: boolean; phase: 'wash' | 'toBasket'; t: number; from: THREE.Vector3; done: number } | null>(null)
  const handObj = useRef<THREE.Group>(null)
  const handIn = useRef<THREE.Group>(null)
  const handFoam = useRef<THREE.Group>(null)
  /** what's listened for while the washing's going on (the press held), to be let go of if the bar's gone meanwhile */
  const handListen = useRef<(() => void) | null>(null)
  useEffect(() => () => handListen.current?.(), [])
  const handCtl = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  /** the sponge for his hand: a copy of the sink's (its meshes, shared), made once; where it lies on its dish, measured as he takes it up */
  const washSponge = useRef<{ g: THREE.Group; q: THREE.Quaternion; home: THREE.Vector3 } | null>(null)
  /** where he stands to wash: before the sink, along its front toward the basket (from before the basin's middle the stack lay a metre off
   * at his right, the basket behind it: out of his reach) */
  const washSpot = () => {
    const s0 = sinkFront(), mid = inBar('SinkWaterTop', endOf(1)).setY(0), side = basketAt(0).setY(0)
    const fwd = mid.clone().sub(s0)
    if (fwd.lengthSq() < 1e-8) return s0
    fwd.normalize()
    const off = side.sub(mid)
    off.addScaledVector(fwd, -off.dot(fwd))
    const d = off.length()
    // (kept up on the stool's top (item 221))
    return ontoStool(d > 1e-3 ? s0.addScaledVector(off.divideScalar(d), Math.min(WASH_SHIFT, d * 0.5)) : s0)
  }
  /** the sponge's copy (made the first time) and where it lies now on its dish (taken up off it by the player: a little over it) */
  const spongeHome = () => {
    let piece: THREE.Object3D | null = null
    scene.traverse((q) => { if (!piece && q.userData?.editId === 'sink-sponge') piece = q })
    const f = frame.current
    if (!piece || !f) return null
    const pc = piece as THREE.Object3D
    pc.updateWorldMatrix(true, true)
    const meshes: THREE.Mesh[] = []
    pc.traverse((m) => { const q = m as THREE.Mesh; if (q.isMesh && !q.userData.proxy && !q.userData.editHandle) meshes.push(q) })
    const box = new THREE.Box3()
    for (const m of meshes) box.expandByObject(m)
    if (box.isEmpty()) return null
    const c = box.getCenter(new THREE.Vector3())
    if (!washSponge.current) {
      const q = (pc.getObjectByName('SinkSpongeSet') ?? pc).getWorldQuaternion(new THREE.Quaternion())
      const inv = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)).invert()
      const g = new THREE.Group()
      g.name = 'wash-sponge'
      for (const m of meshes) {
        const k = new THREE.Mesh(m.geometry, m.material)
        k.matrixAutoUpdate = false
        k.matrix.multiplyMatrices(inv, m.matrixWorld)
        k.raycast = () => {}
        g.add(k)
      }
      g.visible = false
      scene.add(g)
      washSponge.current = { g, q, home: new THREE.Vector3() }
    }
    washSponge.current.home.copy(f.worldToLocal(c))
    return washSponge.current
  }
  useEffect(() => () => { const w = washSponge.current; if (w) { w.g.removeFromParent(); washSponge.current = null } }, [])
  // (dev: the washing as it's posed, for the probes (tests/e2e/_washanim.mjs, _washdbg.mjs))
  useEffect(() => {
    if (!import.meta.env.DEV) return
    Object.assign(window, { __wash: { pose: WASH_POSE, hands: WASH_HANDS, state: () => bossWash.current, sponge: () => washSponge.current, frame: () => frame.current, hand: () => hand.current } })
  }, [WASH_POSE, WASH_HANDS])
  /** everything of the washing put by: the plate, the drops, his copy of the sponge (the sink's shown on its dish again), the stream */
  const washDone = () => {
    HAND_WASH.spongeHeld = false
    HAND_WASH.stream = null
    if (washHeld.current) washHeld.current.visible = false
    washDrips.current?.children.forEach((c) => { c.visible = false })
    if (washSponge.current) washSponge.current.g.visible = false
  }
  const sinkNow = () => ({ dirty: dirty.current, drain: DRAIN, plug: SINK.plug, water: SINK.water, soap: SINK.soap, sponge: true, tap: SINK.tap })
  /** a plate's pattern put on a drawn plate (its first mesh with one): the plate in hand takes the stack's top plate's, the basket's slot the
   * one let go of in it, so neither changes as it moves from one to the other */
  const setPattern = (g: THREE.Object3D | null | undefined, design: number) => {
    // (every plate drawn there: a PlateKinds has a round one and a long one (item 228))
    g?.traverse((q) => {
      const m = q as THREE.Mesh
      // (the round plate's own shape too (item 251's ROUND_GEO): it was left out, and a round plate kept its old pattern in hand)
      if (!m.isMesh || (m.geometry !== PLATE_GEO && m.geometry !== ROUND_GEO && m.geometry !== LONG_GEO)) return
      const mat = m.material as THREE.MeshToonMaterial
      if (!mat.map) return
      const t = m.geometry === LONG_GEO ? oribeLong(design) : roundGlaze(design)
      if (mat.map !== t) mat.map = t
    })
  }
  /** the next plate, or why he stops: all washed, the basket full, the water or the liquid gone (said, when the player sent him); the counter's
   * stack only, when he went of himself */
  const nextPlate = (b: NonNullable<typeof bossWash.current>) => {
    b.t = 0; b.sounds = 0; b.inHand = false
    const why = b.manual ? handStops(sinkNow()) : PILE.n > 0 && dirty.current > 0 && DRAIN.n < DRAIN_CAP ? null : 'done'
    if (why) { b.sub = 'stow'; if (b.manual) STAFF_SAY.say('owner', HAND_WASH_LINES[why]); return }
    const n = Math.min(dirty.current, SINK_SHOWN)
    b.sub = 'plate'
    // (washing up for the player with no liquid in the water or on the sponge: scrubbed longer, no suds (item 217))
    b.soapy = !b.manual || SINK.soap > 0
    b.dirt = SINK.dirt.at(-1) ?? 1
    b.design = n - 1
    b.spin = (n - 1) * 0.9
  }
  /** how near a sound is (as the restroom's): loud close by, gone 8.5 away */
  const nearCam = (at: THREE.Vector3) => Math.max(0, Math.min(1, 1 - (at.distanceTo(camera.position) - 1.5) / 7))
  /** how hard the pointer's going to and fro while the press is held: the scrubbing (item 234) */
  const scrubHand = (x: number, y: number) => {
    const h = hand.current
    if (!h) return
    const now = performance.now(), dt = Math.max(8, now - h.pt)
    h.scrub = Math.min(1, h.scrub * 0.6 + (Math.hypot(x - h.px, y - h.py) / dt) * 0.5)
    h.px = x; h.py = y; h.pt = now
  }
  /** the washing over (the press let go of, or nothing left to wash): the view's to be turned again, the pointer and the tap's stream as they were */
  const endWash = () => {
    handListen.current?.()
    HAND_WASH.held = false
    if (handCtl) handCtl.enabled = true
    document.body.style.cursor = ''
    document.body.classList.remove('is-carrying')
    if (!bossWash.current) HAND_WASH.stream = null
  }
  /**
   * The top dirty plate taken up to be washed (a press on the stack or the basin; or the next, the press still held, as the last went into the
   * basket): it goes where the water is by itself; with none in the basin and the tap off, the tap's turned on. Whether it was.
   */
  const startWash = (x: number, y: number, next = false) => {
    if (getEdit().on || (hand.current && !next) || dirty.current <= 0 || DRAIN.n >= DRAIN_CAP) return false
    const n = dirty.current
    const dirt = SINK.dirt[n - 1] ?? DIRT_BASE
    SINK.dirt.length = Math.min(SINK.dirt.length, n - 1)
    const kind = SINK.kinds[n - 1] ?? 'round'
    SINK.kinds.length = Math.min(SINK.kinds.length, n - 1)
    dirty.current = n - 1
    PILE.n = pileLeft(PILE.n, dirty.current)
    const design = Math.min(n, SINK_SHOWN) - 1
    const done = next ? hand.current?.done ?? 0 : 0
    hand.current = { dirt, design, kind, at: null, scrub: 0, soaped: false, px: x, py: y, pt: performance.now(), said: 0, wet: false, heard: 0, down: true,
      phase: 'wash', t: 0, from: new THREE.Vector3(), done }
    HAND_WASH.held = true
    setPattern(handIn.current, design)
    showKind(handIn.current, kind)
    // (off the top of the stack: it goes from there to where the water is)
    if (handObj.current) { handObj.current.position.copy(dirtyAt(Math.max(0, Math.min(n, SINK_SHOWN) - 1))); handObj.current.visible = true }
    // (no water to wash in: the tap turned on, as anyone would)
    if (!SINK.tap && SINK.water < WASH_WET) { SINK.tap = true; tapTurnSound(true, 0.5) }
    if (!next) {
      if (handCtl) handCtl.enabled = false
      document.body.style.cursor = 'grabbing'
      document.body.classList.add('is-carrying')
      guideOff()
      const move = (ev: PointerEvent) => scrubHand(ev.clientX, ev.clientY)
      const up = () => letGoWash()
      const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); handListen.current = null }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      handListen.current = stop
    }
    redraw()
    return true
  }
  HAND_WASH.take = (x, y) => startWash(x, y)
  /** the press on the dirty stack (or one of its plates): the washing started */
  const takeUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return
    if (startWash(e.nativeEvent.clientX, e.nativeEvent.clientY)) e.stopPropagation()
  }
  /** the press let go of: a plate not yet clean back on the stack, as clean as it's got (it soaks there with the rest); one on its way into
   * the basket goes on into it */
  const letGoWash = () => {
    const h = hand.current
    if (!h) { endWash(); return }
    h.down = false
    if (h.phase === 'toBasket') return
    hand.current = null
    SINK.dirt.push(h.dirt)
    SINK.kinds.push(h.kind)
    dirty.current += 1
    if (handObj.current) handObj.current.visible = false
    setTip(h.done ? { title: '盤子', hint: `洗好 ${h.done} 個` } : null)
    endWash()
    redraw()
  }
  /** the washing's beats: the sponge taken up, then a plate after another (off the stack as it's taken up, into the basket as it's let go),
   * the sponge put back, and home */
  const washTick = (b: NonNullable<typeof bossWash.current>) => {
    const f = frame.current
    if (b.sub === 'grab') { if (b.t >= SPONGE_S) nextPlate(b); return }
    if (b.sub === 'stow') {
      if (b.t < SPONGE_S) return
      washDone()
      b.phase = 'back'; b.t = 0
      b.path = kitchenRoute(b.pos, b.home ?? ownerAt()); b.len = pathLength(b.path)
      return
    }
    const dirt = b.dirt ?? 1
    if (!b.inHand && b.t >= beatLength('take', dirt)) {
      // (taken up: off the stack (where it lay kept, for the way it comes over))
      if (dirty.current <= 0) { b.sub = 'stow'; b.t = 0; return }
      b.inHand = true
      b.from = dirtyAt(Math.max(0, Math.min(dirty.current, SINK_SHOWN) - 1))
      b.kind = SINK.kinds[dirty.current - 1] ?? 'round'
      SINK.kinds.length = Math.min(SINK.kinds.length, dirty.current - 1)
      showKind(washPlateIn.current, b.kind)
      dirty.current -= 1
      PILE.n = pileLeft(PILE.n, dirty.current)
      setPattern(washPlateIn.current, b.design ?? 0)
      redraw()
    }
    const { beat } = washBeat(b.t, dirt, b.soapy ?? true)
    const at = washPts.current?.work
    if (f && at && beat === 'scrub' && !((b.sounds ?? 0) & 1)) { b.sounds = (b.sounds ?? 0) | 1; f.localToWorld(SOUND_AT.copy(at)); washSplash(SOUND_AT); scrubSound(nearCam(SOUND_AT)) }
    if (f && at && beat === 'rinse' && !((b.sounds ?? 0) & 2)) { b.sounds = (b.sounds ?? 0) | 2; washSplash(f.localToWorld(SOUND_AT.copy(at))) }
    if (b.t >= washPlateS(dirt, b.soapy ?? true)) {
      // (let go of, standing in the basket's next slot: the basket's plate there drawn with its pattern)
      const r = handOne(1, DRAIN)
      DRAIN.n = r.drain.n
      DRAIN.left = r.drain.left
      if (b.manual) SINK.soap = scrubbed(SINK.soap)
      else soapPlate()
      meterWater('dish')
      setPattern(drainPlates.current?.children[DRAIN.n - 1], b.design ?? 0)
      DRAIN_KINDS[DRAIN.n - 1] = b.kind ?? 'round'
      if (f) plateClink(f.localToWorld(SOUND_AT.copy(WASH_POSE.plate)))
      b.fromL = (b.fromL ?? new THREE.Vector3()).copy(WASH_POSE.left)
      nextPlate(b)
    }
  }
  /** the points the washing moves between, in the bar's frame, now (the water's top as it stands, the tap running or not, the basket's next slot) */
  const washPoints = (b: NonNullable<typeof bossWash.current>) => {
    const p = washPts.current ?? (washPts.current = { stack: new THREE.Vector3(), stackSpin: 0, work: new THREE.Vector3(), waterY: 0, spout: null,
      slot: new THREE.Vector3(), along: new THREE.Vector3(), toward: new THREE.Vector3(), left: new THREE.Vector3(), spongeHome: new THREE.Vector3(),
      fromL: new THREE.Vector3(), restL: new THREE.Vector3(), restR: new THREE.Vector3(), r: (PLATE_DIMS.round.w / 2) * IN_SINK })
    const top = inBar('SinkWaterTop', endOf(1)), floor = inBar('SinkBasinFloor', endOf(1))
    p.waterY = floor.y + (top.y - floor.y) * Math.min(1, Math.max(0, SINK.water))
    p.toward.copy(b.pos).sub(top).setY(0).normalize()
    const fwd = WASH_FWD.copy(p.toward).negate()
    p.left.crossVectors(UP_Y, fwd)
    p.work.copy(top).addScaledVector(p.toward, WORK_IN).setY(Math.max(p.waterY, floor.y + 0.03) + WORK_UP)
    p.spout = SINK.tap || SINK.washing ? SPOUT_AT.copy(inBar('SinkSpoutTip', endOf(1))) : null
    p.slot.copy(basketAt(DRAIN.n))
    p.along.copy(inBar('SinkRackSlot1', endOf(1)).sub(inBar('SinkRackSlot0', endOf(1)))).normalize()
    if (b.inHand && b.from) p.stack.copy(b.from)
    else p.stack.copy(dirtyAt(Math.max(0, Math.min(dirty.current, SINK_SHOWN) - 1)))
    p.stackSpin = b.spin ?? 0
    if (washSponge.current) p.spongeHome.copy(washSponge.current.home)
    // (his hands at rest: in front of him at his waist, either side)
    p.restL.copy(b.pos).addScaledVector(p.left, 0.15).addScaledVector(fwd, 0.16).setY(b.pos.y + 0.5)
    p.restR.copy(b.pos).addScaledVector(p.left, -0.15).addScaledVector(fwd, 0.16).setY(b.pos.y + 0.5)
    p.fromL.copy(b.fromL ?? p.restL)
    return p
  }
  /** the washing posed this frame: his hands, the plate (its smear, its suds), the drops off it, the sponge, the tap's stream on the plate, his
   * body turned a little toward what his hands are at */
  const washShow = (b: NonNullable<typeof bossWash.current>, step: number) => {
    const f = frame.current
    const p = washPoints(b), P = WASH_POSE, dirt = b.dirt ?? 1
    const beat = b.sub === 'plate' ? washBeat(b.t, dirt, b.soapy ?? true) : null
    if (!beat) spongePose(Math.min(1, b.t / SPONGE_S), b.sub === 'stow', p, P)
    else washPose(beat.beat, beat.k, p, P)
    if (f) { f.localToWorld(WASH_HANDS.left.copy(P.left)); f.localToWorld(WASH_HANDS.right.copy(P.right)) }
    const h = washHeld.current
    if (h) {
      h.visible = !!beat && P.held
      if (h.visible) {
        h.position.copy(P.plate)
        h.quaternion.copy(P.plateQ)
        washPlateIn.current?.scale.set(IN_SINK, IN_SINK * (0.3 + 0.7 * P.deep), IN_SINK)
        for (const sm of smearsOf(washPlateIn.current)) { const d = dirt * P.smear; (sm.material as THREE.MeshBasicMaterial).opacity = smearOpacity(d); sm.visible = d > CLEAN_AT }
        washFoam.current?.children.forEach((c, i) => { const k = FOAM_AT[i][2] * P.foam * (b.soapy === false ? 0 : 1); c.scale.set(k, k * 0.6, k); c.visible = k > 0.03 })
      }
    }
    // (the drops running off its lowest edge down into the water, three, one after another)
    const dr = washDrips.current
    if (dr) {
      const on = !!beat && P.held && P.wet > 0.3
      if (on) {
        WASH_FWD.copy(UP_Y).applyQuaternion(P.plateQ)
        DRIP_LOW.copy(UP_Y).addScaledVector(WASH_FWD, -WASH_FWD.y).normalize()
        DRIP_LOW.multiplyScalar(-p.r * 0.97).add(P.plate)
      }
      const fall = DRIP_LOW.y - p.waterY
      dr.children.forEach((c, i) => {
        c.visible = on && fall > 0.006
        if (!c.visible) return
        const k = (performance.now() / 1000 * 2.6 + i / 3) % 1
        c.position.set(DRIP_LOW.x, DRIP_LOW.y - fall * k * k, DRIP_LOW.z)
      })
    }
    // (the sponge: his copy where his hand has it, the one on the dish hidden meanwhile)
    const sp = washSponge.current
    HAND_WASH.spongeHeld = !!sp
    if (sp && f) {
      sp.g.visible = true
      f.localToWorld(sp.g.position.copy(P.sponge))
      sp.g.quaternion.copy(P.spongeQ).multiply(sp.q)
    }
    HAND_WASH.stream = P.stream && f ? f.localToWorld(STREAM_W.copy(P.stream)) : null
    // (his body turned a little toward what his hands are at: the stack as he takes a plate, the basket as he stands it in, the sponge's dish)
    const aim = !beat ? p.spongeHome : beat.beat === 'take' ? p.stack : beat.beat === 'rack' ? p.slot : p.work
    const base = b.base ?? b.yaw
    const want = Math.atan2(aim.x - b.pos.x, aim.z - b.pos.z)
    const turn = Math.max(-0.5, Math.min(0.5, Math.atan2(Math.sin(want - base), Math.cos(want - base)))) * 0.6
    b.yaw += Math.atan2(Math.sin(base + turn - b.yaw), Math.cos(base + turn - b.yaw)) * Math.min(1, step * 6)
  }
  const bossWashTick = (step: number) => {
    // (the player's washing up handed to him (item 166, Sink's scrubOnce): he goes once he's free; at the counter's stack already, he washes
    // the lot)
    if (HAND_WASH.ask === 'wash' && !SHOP.leaving && !(open && ownerServes)) {
      if (bossWash.current) { bossWash.current.manual = true; HAND_WASH.ask = null }
      else if (ownerFree('wash')) {
        HAND_WASH.ask = null
        const from = bossNow(), path = kitchenRoute(from, washSpot())
        bossWash.current = { phase: 'go', path, len: pathLength(path), t: 0, pos: from.clone(), yaw: OWNER_YAW, manual: true, home: from }
        ownerAway('wash', true)
        STAFF_SAY.say('owner', HAND_WASH_LINES.start)
      }
    }
    HAND_WASH.boss = (!!bossWash.current?.manual && bossWash.current.phase !== 'back')
      || (open && ownerServes && waiters.current.some((x) => x.phase === 'handGo' || x.phase === 'handwash'))
    if (open && !SHOP.leaving && !bossWash.current && PILE.saidDay !== SHOP.day && bossCleans(SHOP.day, PILE.n)
      && performance.now() - SHOP.openedAt > 9000 && (ownerServes || ownerFree('wash'))) {
      PILE.saidDay = SHOP.day
      STAFF_SAY.say('owner', PILE_LINE)
      if (ownerServes) PILE.n = 0
      else {
        const from = ownerAt(), path = kitchenRoute(from, washSpot())
        bossWash.current = { phase: 'go', path, len: pathLength(path), t: 0, pos: from.clone(), yaw: OWNER_YAW }
        ownerAway('wash', true)
      }
    }
    const b = bossWash.current, o = bossObj.current
    if (o) o.visible = !!b
    if (!b) { if (HAND_WASH.spongeHeld) washDone(); return }
    b.t += step
    if (b.phase === 'go' || b.phase === 'back') {
      const d = Math.min(b.len, b.t * SERVER_SPEED)
      const { p, dir } = alongPath(b.path, d)
      b.pos.copy(p)
      if (dir.x || dir.z) { const want = Math.atan2(dir.x, dir.z); b.yaw += Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw)) * Math.min(1, step * 12) }
      if (d >= b.len) {
        if (b.phase === 'go') {
          // (at the sink, facing the basin: the sponge taken up first (item 174))
          b.phase = 'wash'; b.t = 0; b.sub = 'grab'; b.inHand = false; b.fromL = undefined
          const at = inBar('SinkWaterTop', endOf(1)).sub(b.pos)
          b.yaw = b.base = Math.atan2(at.x, at.z)
          spongeHome()
        } else { bossWash.current = null; ownerAway('wash', false); if (o) o.visible = false; washDone(); return }
      }
    } else {
      washTick(b)
      if (bossWash.current === b && b.phase === 'wash') washShow(b, step)
    }
    if (o) {
      o.position.copy(b.pos)
      // (up on the kitchen's dais, as the servers are over it (he stood its height down in it, his feet under its boards), and on the sink's
      // step stool over that (item 221))
      const d = b.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
      const dais = KITCHEN_DROP < 0 && a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1] ? -KITCHEN_DROP / scale : 0
      o.position.y += dais + stoolLift(o, b.pos, Math.min(step, 0.1))
      o.rotation.y = b.yaw
      o.userData.scrub = undefined
      o.userData.washHands = b.phase === 'wash' ? WASH_HANDS : undefined
    }
  }
  /** where one stands on the kitchen's floor to reach something on (or by) the cook table: the nearest spot clear of it */
  const reachClear = (v: THREE.Vector3) => {
    const blocks = kitchenBlocks()
    if (!blocks.length) return v.clone().setY(0)
    const [a, l] = standClear(flat(v), blocks)
    const c0 = counters[0]
    return c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
  }
  /** where one stands at the skewer buckets on the cook table's front (the used ones', the clean ones'), measured afresh */
  const skewerSpot = (name: 'skewer-tray' | 'skewer-holder', or: THREE.Vector3) => { marks.current.delete(name); return reachClear(inBar(name, or)) }
  /** the skewers being washed: by a server (a floor one with nothing else to do), or by the plater when there's no server */
  const SK_PHASES = new Set<string>(['skTrayGo', 'skTake', 'skSinkGo', 'skWash', 'skHolderGo', 'skPut'])
  /** where the k-th plate stands in the dish dryer (along its rack, from its first slot to its last), and the way its plates face */
  const dryerAt = (k: number) => inBar('SinkDryerRack0', endOf(1)).lerp(inBar('SinkDryerRack1', endOf(1)), DRYER_CAP > 1 ? k / (DRYER_CAP - 1) : 0)
  /** where the k-th plate stands in the draining basket: along its slots (blender/sink.py's SinkRackSlot0, 1, 6 cm apart as it's made), from
   * the first notch on (blender/sink.py's notched rails: SinkRackSlot0 and 1 are two notches apart), each in its own notch, a gap between them
   * (the owner's, 2026-11-12) */
  const basketAt = (k: number) => { const a = inBar('SinkRackSlot0', endOf(1)), b = inBar('SinkRackSlot1', endOf(1)); return a.clone().add(b.sub(a).multiplyScalar(k / 2)) }
  /** each server's stack of dried plates, drawn on their tray while they carry it to the racks */
  const stackObjs = useRef<(THREE.Group | null)[]>([])
  const ragObjs = useRef<(THREE.Mesh | null)[]>([])
  const shownRef = useRef<Shown[]>([])
  /** whether a guest's plate is the small one (item 169): what they ordered all small things, as Roasting says; unknown, the big one */
  const guestsNow = useRef(guests)
  guestsNow.current = guests
  const kindFor = (id: number | undefined): PlateKind => guestsNow.current.find((x) => x.id === id)?.plate ?? 'round'
  // (the shop open: its furnishings can't be moved about by hand; shut, they can: edit mode, key G)
  useEffect(() => { setLocked(open) }, [open])
  // (the day's rice and soup made fresh: the cooker and the soup's pot empty as the shop opens, the third cook to cook them (the owner's,
  // 2026-11-11))
  useEffect(() => {
    if (!open) return
    RICE.rice = 0
    RICE.kama = emptyKama()
    SOUP.pot = emptyPot()
    SOUP.left = 0
    SOUP_SEATS.clear()
    SOUP.served++
    SAKE_SEATS.clear()
    SAKE.served++
    SAKE.want = []
    SAKE.ready.clear()
    sakeJob.current = null
  }, [open])
  /** each shown guest's name tag, faded with them as they go out of the door */
  const labels = useRef(new Map<number, HTMLElement>())
  const labelEl = useCallback((id: number, el: HTMLElement | null) => { if (el) labels.current.set(id, el); else labels.current.delete(id) }, [])
  if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shown?: typeof shownRef }).__shown = shownRef
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __waiters: waiters, __visitors: visitors, __visitorObjs: visitorObjs, __waiterBoxes: waiterBoxes, __takeoutWay: takeoutWay, __inGenkan: (v: THREE.Vector3) => inGenkan(counters, v), __dirty: dirty, __barFrame: frame, __platingAt: plating.at, __platingOut: plating.out, __platerRun: platerRun, __sakeJob: sakeJob, __sakeSpot: (n: number) => sakeSpotOf(n), __sakeAround: (n: number) => { const st = seats[n], c = counters[st.counter], x = st.mid.clone().sub(c.at).dot(c.along); return { plate: st.plate.clone(), soup: st.mid.clone().addScaledVector(c.along, -sauceSide(c, BAR_GATES[st.counter], x) * 1.15).addScaledVector(c.lay, PLACE.sauce[1]), drink: new THREE.Vector3(...drinkSpot(n, false)), cup: new THREE.Vector3(...drinkSpot(n, true)) } }, __runs: runs, __sitters: sitters, __tillCall: tillCall, __kitchenBlocks: () => kitchenBlocks(), __kitchenRoute: (a: THREE.Vector3, b: THREE.Vector3) => kitchenRoute(a, b), __kitchenRoom: () => kitchenOf(counters), __pickupSpot: () => pickupSpot, __homeOf: (wi: number) => homeOf(wi), __flat: (v: THREE.Vector3) => flat(v), __shown: shownRef, __guestGroups: groups, __guestClock: clock, __grateNow: () => { grateAt.current = -1e9 } })

  shownRef.current = shown
  // (how many are still in the room: the shop shuts only once they're all out of the door)
  useEffect(() => { SHOP.inRoom = shown.length + visitorList.length + sitterList.length; return () => { SHOP.inRoom = 0 } }, [shown, visitorList, sitterList])
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __shown: shownRef })
  // (dev: each walker's step aside as it stands, and the pairs passing, for tests/e2e/_jump203.mjs)
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __aside: aside, __passing: passing })
  // closing the shop empties the room at once: nobody at the stools, no plates out or being carried, the stacks as at the start
  // (and looked at as the shop opens: measured while it was shut, the room may still have been coming in (the miso pot by the rice tub wasn't
  // there yet, and the whole day the servers' places and ways went through it))
  useEffect(() => {
    if (!open) return
    blocksMade.current = null
    clearHomes.current.clear()
  }, [open])
  useEffect(() => {
    if (open) return
    setShown([])
    // (the benches emptied as the shop's shut: no one left sat there into the next day (item 328))
    BENCH.ids = []
    BENCH.since.clear()
    BENCH.up.clear()
    BENCH.gone.clear()
    sitters.current.clear()
    setSitterList([])
    runs.current = []
    runObjs.current.clear()
    waiting.current = []
    // (the kitchen's floor looked at again tomorrow: things may be moved about in the meantime; the servers' places with it)
    blocksMade.current = null
    clearHomes.current.clear()
    // (the racks full for the next day but for the day's first washing up (game/plates START_DIRTY, START_DRAIN: the owner's, item 82), the
    // low rack by the table full besides; the dirty ones waiting on the counter by the sink)
    // (the stack on the counter only what's left of it: a new game's, kept from day to day till it's washed (game/sinkPile, item 103))
    PLATE_RACK.n = rackAtStart() + START_DIRTY - PILE.n
    LOW_RACK.n = LOW_FULL
    LOW_RACK.coming = 0
    dirty.current = PILE.n
    onCounter.current = PILE.n
    SINK.dirt.length = 0
    SINK.kinds.length = 0
    wash.current = null
    SINK.washing = false
    // (the plating place bare, the dryer empty and shut, the bin by the sink emptied, the plater at their place)
    PLATING.stock = 0
    PLATING.coming = 0
    PLATING.slots.fill(null)
    PLATES_OUT.clear()
    SEAT_STICKS.clear()
    SEAT_BONES.clear()
    Object.assign(DRYER, { n: 0, left: null, open: 0 })
    // (the basket with the day's first washed plates in it, dry already: taken back to the racks as any dry ones are)
    Object.assign(DRAIN, { n: START_DRAIN, left: START_DRAIN ? 0 : null })
    SINK_BIN.sticks = 0
    SINK_BIN.b = { rubbish: 0, recycle: 0, cans: 0, bottles: 0 }
    SINK_BIN.out = null
    // (the bags stowed under the sink through the evening put out after closing (item 318))
    SINK_BIN.stowed = { rubbish: 0, recycle: 0 }
    platerRun.current = { phase: 'idle', t: 0, path: [], len: 0, pos: new THREE.Vector3(), yaw: 0, n: 0 }
    PLATER_OUT.id = null
    ownerHome.current = null
    ownerBack()
    waiters.current = waiters.current.map((w, i) => ({ phase: 'idle', t: 0, seat: -1, keys: [], run: null, path: [], len: 0,
      pos: (ownerServes ? ownerAt() : homes[i]?.at)?.clone() ?? w.pos, yaw: ownerServes ? OWNER_YAW : homes[i]?.yaw ?? w.yaw }))
    SERVICE.waiting.clear()
    SERVICE.carried.clear()
    SEATS_TAKEN.clear()
    PLATES_SET.clear()
    for (const f of FRIDGE_STATE) { f.passing = 0; f.stocker = false }
    SAY_SEATED.lines.clear()
    // (no bowls asked for or out, the cooker's lid down (items 205, 206))
    bowlJob.current = null
    passQ.current = []
    bowlTrays.current.clear()
    BOWLS.want = []; BOWLS.asked.clear(); BOWLS.got.clear(); BOWLS.setAt.clear(); BOWLS.ver++
    RICE_SEATS.clear()
    RICE.lid = 0
    // (the toilets swept before the day, nobody in them; the paper as it was left)
    // (both scrubbed before the day, a dose of the cleaner each that was used at all (item 203; one clean already, as on a new page, isn't
    // scrubbed again): none left, brushed with water)
    for (const w of [TOILETS.m, TOILETS.f]) { w.passing = 0; w.inside = 0; w.room = openRoom(w.room, w.room.clean < 0.999 ? scrubDose() : true) }
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
    // (one done, or gone off in a huff: away at the toilet, they go once they're back at their stool; done and satisfied, a tissue to the
    // mouth first, then up (the frame's 'sit'); in a huff, straight up. Marked on their own entry, as the frame loop marks it: a copy put in
    // the list in their place was made from them as the list was next drawn, and the frame loop walked them on a few frames more before it
    // had the copy, which put them back by those frames along their way, a jump back on the way out of the toilet (item 45))
    let marked = false
    for (const g of guests) {
      const s = shownRef.current.find((x) => x.id === g.id)
      if (!s || g.state === 'waiting' || g.state === 'eating' || s.phase === 'leave' || s.leaving || s.wipeAt) continue
      if (s.phase.startsWith('wc')) s.leaving = true
      // (done: first down to their drawer for a tissue, then it to their mouth (item 269))
      else if (s.phase === 'sit' && g.state === 'done') { s.wipeAt = performance.now(); DRAWER_KICK.set(s.seat, s.wipeAt) }
      else { s.phase = 'leave'; s.t = 0 }
      marked = true
    }
    if (marked) redraw()
    // (the same list back when nobody comes: then the bar isn't drawn again for it)
    setShown((cur) => {
      let next = cur
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          const taken = new Set(next.map((x) => x.seat))
          // (the shop may have given them a stool already: it only does once the last one there has gone)
          const seat = g.seat !== undefined ? g.seat : Array.from({ length: seats.length }, (_, i) => i).find((i) => !taken.has(i))
          // (off the bench (BENCH): their way in starts where they sat, welcomed already)
          // (called this moment, the bench's walk not yet round to it: from where they sit there now)
          const from = benchFrom.current.get(g.id) ?? (BENCH.up.has(g.id) ? sitters.current.get(g.id)?.pos.clone() : undefined)
          if (from) benchFrom.current.delete(g.id)
          const shod = benchShoesIn.current.delete(g.id)
          if (seat !== undefined) next = [...next, from ? { id: g.id, seat, phase: 'enter', t: 0, from, welcomed: true, ...(shod ? { shoesIn: true } : {}) } : { id: g.id, seat, phase: 'enter', t: 0 }]
        }
      }
      return next
    })
  }, [guests])

  // ---- a customer dragged to another stool (the owner's: customers only; the owner and the staff keep to their work): picked up off
  // their stool while they wait, carried under the pointer over the floor, set down on a free stool if nothing's on the way to them yet
  // (Roasting answers: SEAT_MOVE), else back onto their own
  const getThree = useThree((st) => st.get)
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __guestGroups: groups, __barSeats: seats })
  const drag = useRef<{ id: number; at: THREE.Vector3; asked: number } | null>(null)
  const canMove = (s: Shown) => {
    const g = guestsRef.current.find((x) => x.id === s.id)
    return s.phase === 'sit' && !s.leaving && g?.state === 'waiting' && !runs.current.some((r) => r.seat === s.seat) && !PLATES_SET.has(s.seat)
      && !PLATING.slots.some((sl) => sl?.seat === s.seat) && ![...SERVICE.waiting.values()].includes(s.seat)
  }
  const grab = (s: Shown) => (e: ThreeEvent<PointerEvent>) => {
    if (getEdit().on || e.button !== 0 || drag.current || !canMove(s)) return
    const grp = groups.current.get(s.id)
    if (!grp?.parent) return
    e.stopPropagation()
    const st = getThree()
    const ctl = st.controls as unknown as { enabled: boolean } | null
    if (ctl) ctl.enabled = false
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -grp.getWorldPosition(new THREE.Vector3()).y)
    drag.current = { id: s.id, at: grp.position.clone(), asked: 0 }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3()
    const el = st.gl.domElement
    // (held: the closed hand, and they go on glowing till they're let go)
    el.style.cursor = 'grabbing'
    GRABBING.on = true
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, st.camera)
      const d = drag.current
      if (d && !d.asked && grp.parent && ray.ray.intersectPlane(plane, hit)) d.at.copy(grp.parent.worldToLocal(hit))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (ctl) ctl.enabled = true
      el.style.cursor = ''
      GRABBING.on = false
      glowOff(grp)
      const d = drag.current
      if (!d) return
      // (the nearest stool to where they're let go, if it's close; free of anyone, their plate, their bones)
      let to = -1, best = 0.5
      seats.forEach((p, i) => { const k = Math.hypot(p.stool.x - d.at.x, p.stool.z - d.at.z); if (k < best) { best = k; to = i } })
      const free = to >= 0 && to !== s.seat && !shownRef.current.some((x) => x.seat === to) && !runs.current.some((r) => r.seat === to)
        && !PLATES_SET.has(to) && !guestsRef.current.some((x) => x.id !== s.id && x.seat === to && (x.state === 'waiting' || x.state === 'eating'))
      if (free && canMove(s)) { SEAT_MOVE.ask = { guest: s.id, from: s.seat, to }; d.asked = performance.now() }
      else drag.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  useFrame(() => {
    const d = drag.current
    if (!d) return
    const s = shownRef.current.find((x) => x.id === d.id)
    const a = SEAT_MOVE.answer
    if (d.asked && a?.guest === d.id) {
      SEAT_MOVE.answer = null
      drag.current = null
      if (a.ok && s) {
        // (their shoes into the cubby of the stool they're on now: they're taken out of it on the way home)
        const shoes = SHOE_CELLS.shoes.get(s.seat % SHOE_CUBBIES)
        if (shoes) { SHOE_CELLS.shoes.delete(s.seat % SHOE_CUBBIES); SHOE_CELLS.shoes.set(a.to % SHOE_CUBBIES, shoes) }
        s.seat = a.to
      }
      return
    }
    if (d.asked && performance.now() - d.asked > 1500) { drag.current = null; return }
    // (held up a little under the pointer, over the floor, while they're carried; their stool's frame put back by the bar's clock once let go)
    if (!s || s.phase !== 'sit') { drag.current = null; return }
    groups.current.get(d.id)?.position.set(d.at.x, d.at.y + 0.18, d.at.z)
  })
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
    stepFrame(STEP_TURN)
    let paying: { s: Shown; k: number } | null = null
    let queue = 0
    for (const s of shown) {
      s.t += Math.min(dt, 0.1)
      // (they come and go whether or not they're drawn: on a phone they aren't, but their plates still follow them)
      const g = groups.current.get(s.id)
      const st = seats[s.seat]
      if (!st) continue
      // (one called off the bench walks in from it, not from the door)
      // (a step straight out from it onto the first counter's aisle first, then along it: cut across from their place to the corner, one from
      // the first bench went through the second and those sat on it (item 193, tests/e2e/_clash193.mjs))
      if (s.from && !s.fromWay) {
        const c0 = counters[0], back = s.from.clone().sub(c0.at).dot(c0.lay) + aisleOf(c0)
        const p = [s.from.clone(), ...(back < -0.02 ? [s.from.clone().addScaledVector(c0.lay, -back)] : []), ...paths[s.seat].path.slice(1 + doorLead.pts.length)]
        s.fromWay = { path: p, len: pathLength(p) }
      }
      const { path, len } = s.phase === 'enter' && s.fromWay ? s.fromWay : paths[s.seat]
      if (s.phase === 'enter') {
        // in through the noren, along the aisle behind the stools (round the corner, for the other counter), and
        // in to their own stool
        // (stopping at the genkan's step a moment, to step out of their shoes and up into slippers)
        const v = SPEED * walkSpeedOf(kindOf(s.id).kind), raw0 = Math.max(0, (s.t - (s.stepHold ?? 0)) * v)
        // (stood out on the step at the sliding door while it's slid open (item 410), then in; one off the bench is in already)
        const raw = s.from || !doorLead.len ? raw0 : withPause(raw0, 0, DOOR_WAIT_S * v)
        // (behind their stool they stop, pull it out, step up onto it (the owner's), then sit and slide in with it)
        const stand = len - STOOL_STAND
        // (the genkan's step one at a time (item 414): someone else on it changing their shoes, they wait a body's length back, that time
        // out of their walk)
        const stepD = stepAt(path)
        if (!s.from && waitsForStep(STEP_TURN, s.id, raw, stepD, stepD + SHOES_S * v, QUEUE_GAP)) s.stepHold = (s.stepHold ?? 0) + Math.min(dt, 0.1)
        const d = Math.min(stand, withPause(raw, stepD, SHOES_S * v))
        const { p, dir } = alongPath(path, d)
        if (d >= stand) {
          s.pullT = (s.pullT ?? 0) + dt
          const k1 = Math.min(1, s.pullT / STOOL_PULL_S), k2 = Math.min(1, Math.max(0, s.pullT - STOOL_PULL_S) / STOOL_STEP_S)
          // (out from under the counter, where it's put away)
          SEAT_PULL.set(s.seat, -STOOL_TUCK + (STOOL_OUT + STOOL_TUCK) * k1 * k1 * (3 - 2 * k1))
          if (k1 >= 1 && !s.pulledSound) { s.pulledSound = true; if (g) stoolSound(g.getWorldPosition(new THREE.Vector3())) }
          // (stepping from where they stood onto the stool where it's been pulled to)
          p.copy(alongPath(path, stand + (STOOL_STAND - STOOL_OUT) * k2).p)
        }
        s.still = s.lastD !== undefined && Math.abs(d - s.lastD) < 1e-6 && (d < stand || (s.pullT ?? 0) < STOOL_PULL_S)
        s.lastD = d
        // (in through the door faded in, as the takeaways are (they were there at once, whole, in the doorway); one off the bench is in already)
        if (!s.from) s.fade = d >= 0.6 && s.t >= FADE_S ? undefined : Math.min(1, d / 0.6 + s.t / FADE_S)
        g?.position.copy(p)
        // (turned to their way quickly but not at once: at each corner of it they snapped round in a frame)
        if (g) g.rotation.y = s.t < dt * 1.5 ? Math.atan2(dir.x, dir.z) : turnToward(g.rotation.y, d < stand ? Math.atan2(dir.x, dir.z) : st.yaw, dt * 1.5)
        // (welcomed in as they come through the noren: the owner's call passed along by those in (crewTalk, item 324: only the owner and
        // the first server had said it))
        if (!s.welcomed && s.t > 0.5) {
          s.welcomed = true
          crewWelcome(lang)
        }
        // (at the step: their shoes off and into a cubby of the cupboard, turned to it, a little bow)
        shoeStep(s, g, (raw - stepAt(path)) / (SHOES_S * v), true)
        s.slippers = d > stepAt(path)
        if (d >= stand && (s.pullT ?? 0) >= STOOL_PULL_S + STOOL_STEP_S) {
          s.phase = 'sit'
          s.slideT = 0
          // (what they're having said now they're sat (item 203: it was called out from the doorway))
          const said = SAY_SEATED.lines.get(s.id)
          if (said !== undefined) { SAY_SEATED.lines.delete(s.id); SAY_SEATED.say(s.id, said) }
          // a plate is set in front of them (or, with a server, brought with the first thing they ordered)
          if (!SERVICE.servers) serve(s.seat, s.id)
        }
      } else if (s.phase === 'sit') {
        // (sliding in to the bar with their stool, then sat where it's always stood)
        if (s.slideT !== undefined && s.slideT < STOOL_SLIDE_S) {
          s.slideT += dt
          const k = Math.min(1, s.slideT / STOOL_SLIDE_S)
          SEAT_PULL.set(s.seat, STOOL_OUT * (1 - k * k * (3 - 2 * k)))
        } else SEAT_PULL.set(s.seat, 0)
        g?.position.copy(st.stool).addScaledVector(backOf(st), SEAT_PULL.get(s.seat) ?? 0)
        if (g) g.rotation.y = st.yaw
        if (s.wipeAt && performance.now() - s.wipeAt > WIPE_MOUTH_MS) { s.phase = 'leave'; s.t = 0; redraw() }
        // (their drink, sipped now and then as they sit (the owner's, 2026-11-10: it stood untouched, gone the moment they left): one every
        // SIP_GAP seconds or so, SIP_S long, SIPS to a drink; none while they wipe their mouth to go)
        if (s.drink && !s.wipeAt && (s.drunk ?? 0) < 1) {
          const now = clock.current
          if (s.sipNext === undefined) s.sipNext = now + 2.5 + (s.id % 4)
          if (s.sipAt !== undefined && now - s.sipAt >= SIP_S) {
            s.sipAt = undefined
            s.drunk = Math.min(1, (s.drunk ?? 0) + 1 / SIPS)
            s.sipNext = now + SIP_GAP * (0.75 + ((s.id * 7 + Math.round(now)) % 6) / 10)
            redraw()
          } else if (s.sipAt === undefined && now >= s.sipNext) s.sipAt = now
        } else if (s.sipAt !== undefined && clock.current - s.sipAt >= SIP_S) s.sipAt = undefined
        // (their miso soup, a mouthful now and then as they eat (item 345, the owner's: 「然後喝湯是怎喝?」): both hands to the bowl, up to the
        // mouth, drunk, down (FolkFigure's soup); never while a sip of their drink's under way, nor once they're wiping their mouth to go)
        const soupKey = `soup:${s.seat}`
        if (SOUP_SEATS.has(s.seat) && BOWLS.setAt.has(soupKey) && !s.wipeAt && leftOf(soupKey) > 0.15) {
          const now = clock.current
          if (s.soupNext === undefined) s.soupNext = now + 3 + (s.id % 5)
          if (s.soupSipAt !== undefined && now - s.soupSipAt >= SOUP_SIP_S) { s.soupSipAt = undefined; s.soupNext = now + 8 + ((s.id * 5 + Math.round(now)) % 7) }
          else if (s.soupSipAt === undefined && s.sipAt === undefined && now >= s.soupNext) s.soupSipAt = now
        } else if (s.soupSipAt !== undefined && clock.current - s.soupSipAt >= SOUP_SIP_S) s.soupSipAt = undefined
        // (now and then, while they wait, off to the toilet: their kind's own)
        const guest = guestsRef.current.find((x) => x.id === s.id)
        if (guest) s.items = guest.items
        // (not once the shop's shut for the day (the owner's item 40: a customer helped themselves to a drink, and paid for it, past closing
        // time); what they've got they drink up)
        // (their first soon after they've sat down, waiting or eating; another once that's drunk, up to three, not after last orders (item 210))
        const thirsty = !s.drink ? drinkRate() : (s.drunk ?? 0) >= 1 && (s.drinks ?? 1) < DRINKS_MAX && !s.wipeAt && !LAST_CALL.on ? REFILL_RATE : 0
        if (fridges && !SHOP.closing && (guest?.state === 'waiting' || guest?.state === 'eating') && thirsty > 0
          && Math.random() < thirsty * flowerBuffs(SHRINE_FLOWERS).drinks * Math.min(dt, 0.1)) {
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
          // (a word as they get up (the owner's): off to the restroom a moment)
          if (!SICK.has(s.id)) onSay?.('guest', LINES[lang].wcGo(s.id, s.id + Math.floor(performance.now() / 7000)), s.id)
        }
      } else if (s.phase === 'wcGo' || s.phase === 'wcBack') {
        // to the door, which slides open as they come up to it, in, and later back out to their stool
        const w = s.wc!
        // (out of a toilet they wait a moment first, for its door to slide open in front of them)
        const wait = s.phase === 'wcBack' && w.who !== 'drink' ? 0.6 : 0
        const d = Math.min(w.len, Math.max(0, s.t - wait) * SPEED * walkSpeedOf(kindOf(s.id).kind))
        // (stood while it does, not treading on the spot (item 50))
        s.still = s.t < wait
        const { p, dir } = alongPath(w.path, s.phase === 'wcGo' ? d : w.len - d)
        g?.position.copy(p)
        if (g) g.rotation.y = turnToward(g.rotation.y, s.phase === 'wcGo' ? Math.atan2(dir.x, dir.z) : Math.atan2(-dir.x, -dir.z), dt * 1.5)
        // (the light switched at its switch, on the post between the two doors outside, as they pass the door: on going in if it's off, off
        // coming out if they put it on and nobody else is in there (item 203: on as they got to the toilet, off as they dried their hands,
        // inside, in the dark either side of it))
        if (w.who !== 'drink' && wcs) {
          const who = w.who as 'm' | 'f'
          const front = pathLength(w.path.slice(0, w.path.length - (s.phase === 'wcGo' ? 3 : 2)))
          if (s.phase === 'wcGo' && !s.wcPast && d >= front) {
            s.wcPast = true
            if (!getLights().wc[who]) { setLightSwitch(who === 'm' ? 'wcM' : 'wcF', true); lightSwitchSound(true); s.wcLit = true }
          } else if (s.phase === 'wcBack' && s.wcPast && w.len - d <= front) {
            s.wcPast = false
            if (s.wcLit && !shown.some((x) => x !== s && x.wc?.who === who && (x.phase === 'wcIn' || x.phase === 'wcWash' || (x.phase === 'wcGo' && x.wcPast)))) {
              setLightSwitch(who === 'm' ? 'wcM' : 'wcF', false)
              lightSwitchSound(false)
            }
            s.wcLit = false
          }
        }
        // (into the stall round the corner, faded out over the last step: put out of sight there at once, they went in a blink, seen from above
        // through the slats of its ceiling)
        // (to a third of themselves at the stall's door, the rest just inside it (below): at x2 the last step was two or three frames, and
        // they still went in a blink)
        // (not faded out any more: seen all the way in, round the corner to the toilet, and sat on it (the owner's, 2026-11-12))
        if (d >= w.len) {
          if (s.phase === 'wcGo') SICK.delete(s.id)
          s.phase = s.phase === 'wcGo' ? 'wcIn' : s.leaving ? 'leave' : 'sit'
          s.t = 0
        }
      } else if (s.phase === 'wcIn') {
        // (in a toilet (the owner's, 2026-11-12: its light switched on going in, and seen using it): its light on if it's off, the last steps
        // from the stall's way in to the toilet, turned round, sat on it a while; up again, it flushes behind them, they say what they
        // thought (below), and walk out round the corner to the washstand)
        let toiletDone = true
        if (s.wc && s.wc.who !== 'drink' && wcs) {
          const who = s.wc.who as 'm' | 'f'
          const w = wcs[who]
          if (s.t - Math.min(dt, 0.1) <= 0 && !getLights().wc[who]) { setLightSwitch(who === 'm' ? 'wcM' : 'wcF', true); lightSwitchSound(true); s.wcLit = true }
          const seat = inBar(`wc-seat-${who}`, w.stall), face = inBar(`wc-seatface-${who}`, w.stall)
          s.fade = undefined
          toiletDone = false
          if (s.wcOut) {
            // (on the way out to the washstand: there, washing their hands)
            const o = s.wcOut
            o.t += Math.min(dt, 0.1)
            const d = Math.min(o.len, o.t * SPEED * walkSpeedOf(kindOf(s.id).kind))
            const { p: at, dir } = alongPath(o.path, d)
            g?.position.copy(at)
            if (g) g.rotation.y = turnToward(g.rotation.y, Math.atan2(dir.x, dir.z), dt * 3)
            if (d >= o.len) { s.wcOut = undefined; TOILETS[who].handAt = performance.now(); s.phase = 'wcWash'; s.t = 0 }
          } else if (s.t < WC_TO_SEAT) {
            g?.position.lerpVectors(w.stall, seat, s.t / WC_TO_SEAT)
            if (g) g.rotation.y = turnToward(g.rotation.y, Math.atan2(seat.x - w.stall.x, seat.z - w.stall.z), dt * 3)
          } else if (s.t < WC_TO_SEAT + wcStayOf(s.id)) {
            g?.position.copy(seat)
            if (g) g.rotation.y = turnToward(g.rotation.y, Math.atan2(face.x - seat.x, face.z - seat.z), dt * 4)
            if (!s.wcSit) { s.wcSit = true; s.still = true; redraw() }
          } else {
            // (up off it: what's done as they leave it, below, and the way out)
            s.wcSit = false
            s.still = false
            toiletDone = true
            const out = [seat.clone(), w.stall.clone(), w.turn.clone(), w.basin.clone()]
            s.wcOut = { path: out, len: pathLength(out), t: 0 }
            redraw()
          }
        }
        // (at the fridge: facing it, choosing; then their drink in hand, back to their stool. Stood where their way ends each frame, the
        // stepping aside for others on top of it: left where it was, that piled up while someone stood by them, and they jumped back as
        // they set off)
        if (s.wc?.who === 'drink' && g && fridges) {
          g.rotation.y = fridges[s.wc.unit ?? 0].yaw + Math.PI
          g.position.copy(s.wc.path[s.wc.path.length - 1])
          // (stood there choosing, their feet still: left walking, they trod on the spot the whole while, a hand in the fridge (item 50))
          s.still = true
        }
        if (toiletDone && (s.wc?.who === 'drink' ? s.t > DRINK_STAY : s.wcOut?.t === 0)) {
          // (out of the toilet: it flushes behind them, and they say what they thought of it, if it's worth saying)
          if (s.wc && s.wc.who !== 'drink') {
            const t = TOILETS[s.wc.who]
            const was = looksOf(t.room)
            const u = visitRoom(t.room)
            t.room = u.room
            t.flushAt = performance.now()
            if (u.complaint) WC_GRUMBLE.set(s.id, Math.max(WC_GRUMBLE.get(s.id) ?? 0, penaltyOf(u.complaint)))
            const L = LINES[lang]
            // (no complaint: relieved, as they come out (the owner's); a clean one said so now and then)
            if (u.complaint === 'paper') onSay?.('guest', L.wcPaper(s.id), s.id)
            else if (u.complaint === 'dirty') onSay?.('guest', L.wcDirty(s.id), s.id)
            else if (was === 'fresh' && Math.random() < 0.4) onSay?.('guest', L.wcNice(s.id), s.id)
            else onSay?.('guest', L.wcBack(s.id, s.id + Math.floor(performance.now() / 5000)), s.id)
          }
          // (the empty, brought back, put in the crate of empties by the fridges; the next taken (item 210))
          if (s.wc?.who === 'drink' && (!s.drink || (s.drunk ?? 0) >= 1)) {
            s.drink = s.wc.pick ?? drinkFor(kindOf(s.id).kind, s.id)
            s.drunk = 0
            s.sipAt = undefined
            s.sipNext = undefined
            s.drinks = (s.drinks ?? 0) + 1
            // (taken from among the others on its shelf: its clink, glass or a can, heard at the fridge)
            const u = takeDrink(s.drink)
            if (u >= 0) bottleClink(isCan(s.drink), FRIDGE_AT[u])
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
          } else {
            s.phase = 'wcBack'
            s.t = 0
            s.still = false
          }
        }
      } else if (s.phase === 'wcWash') {
        // (at the washstand, facing it, washing their hands)
        const w = wcs![s.wc!.who as 'm' | 'f']
        g?.position.copy(w.basin)
        if (g) g.rotation.y = w.basinYaw
        s.still = true
        // (walked out to it from the toilet, seen all the way)
        s.fade = undefined
        if (s.t > HAND_S) {
          // (then a step to the hand dryer on the wall beside, turned to it, hands under it while it blows)
          const who = s.wc!.who as 'm' | 'f'
          if (s.t - dt <= HAND_S) {
            const t = TOILETS[who]
            t.dryAt = performance.now()
            // (one in two takes a paper towel too, while there's one (game/washroom))
            if (takesTowel(s.id)) { const took = takeOne(t.towels); t.towels = took.left; if (took.got) t.towelAt = t.dryAt }
          }
          const dry = inBar(`wc-dryer-${who}`, w.basin)
          const k = Math.min(1, (s.t - HAND_S) / 0.3)
          const to = w.basin.clone().lerp(dry.clone().setY(w.basin.y), 0.55)
          g?.position.lerpVectors(w.basin, to, k * k * (3 - 2 * k))
          if (g) g.rotation.y = w.basinYaw + Math.atan2(Math.sin(Math.atan2(dry.x - w.basin.x, dry.z - w.basin.z) - w.basinYaw), Math.cos(Math.atan2(dry.x - w.basin.x, dry.z - w.basin.z) - w.basinYaw)) * k
        }
        if (s.t > HAND_S + HAND_DRY_S) {
          // (out of the toilet: its light put out at the switch outside as they pass it, above)
          s.phase = 'wcBack'; s.t = 0; s.still = false; s.fade = undefined
        }
      } else {
        // a moment to get up, then off the way they came, by the till: they stop there to pay, and again at the genkan's step
        const lp = leavePaths[s.seat]
        const v = SPEED * walkSpeedOf(kindOf(s.id).kind)
        const raw = Math.max(0, (s.t - 0.8 - (s.hold ?? 0)) * v)
        const payAt = lp.len - lp.payD
        // (one with nothing to pay (gone before anything came, and nothing drunk) goes by the till without stopping (item 195: they paid the
        // whole bill, given back to them, into the drawer)); the money taken as the cash key's pressed, once
        const payD = lp.payD && paysAtTill(GUEST_BILLS.of(s.id)) ? lp.payD : 0
        // (the stops on the way out taken in the order they come along it (item 414): since the genkan's step was drawn back toward the bar
        // (item 410) it's the step first, their shoes on, then the till down in the genkan, then the sliding door; the till's stop was taken
        // first, as it had come first, and they paid stood at the step, 1.5 from the till, 6.8 s on it. Where each begins in the walk's own
        // terms (`raw`, the time stood at the stops in it): its place along it, and the stops before it)
        const shoeAt = lp.len - stepAt(lp.path), shoeHold = SHOES_S * v, payHold = payD ? PAY_S * v : 0
        const payFirst = payAt <= shoeAt
        const payRaw = payAt + (payFirst ? 0 : shoeHold), shoeRaw = shoeAt + (payFirst ? payHold : 0)
        // (no cashier sat at the till: they wait at it, a server called round to ring them up (item 203: the register took their money by itself),
        // and pay once one's behind it; at most TILL_WAIT_MAX, then as before)
        {
          const tc = tillCall.current
          if (payD && raw >= payRaw && raw < payRaw + payHold && !cashierIn()) {
            if (tc.who < 0) { tc.who = s.id; tc.since = clock.current; tc.there = false }
            if (tc.who === s.id && !tc.there && clock.current - tc.since < TILL_WAIT_MAX) s.hold = (s.hold ?? 0) + dt
          } else if (tc.who === s.id) { tc.who = -1; tc.there = false }
        }
        if (payD && raw >= payRaw + 0.44 * payHold && !TILL_CASH.paid.has(s.id)) payIn(s.id, billFor(s).bill, paysByCard(s.id), tenderOf(billFor(s).bill, s.id))
        // (in the queue for the till (the owner's): someone else at it paying, they wait a body's length back till it's free)
        // (or the cashier handing a takeaway's bag over it, item 203)
        if (lp.payD && ((TILL_STATE.k >= 0 && TILL_STATE.payer !== s.id) || TAKEOUT_STAND.handing) && raw >= payRaw - QUEUE_GAP && raw < payRaw) s.hold = (s.hold ?? 0) + dt
        // (and for the genkan's step, one at a time (item 414): someone else on it changing their shoes, they wait a body's length back)
        else if (waitsForStep(STEP_TURN, s.id, payFirst ? withPause(raw, payAt, payHold) : raw, shoeAt, shoeAt + shoeHold, QUEUE_GAP)) s.hold = (s.hold ?? 0) + Math.min(dt, 0.1)
        // (a word getting up, if they ate; at the till, the cashier's thanks and the bill; the money handed over, theirs)
        const said = s.said ?? 0
        if (said < 1 && s.t > 0.3) {
          s.said = 1
          if (payD && guestsRef.current.find((x) => x.id === s.id)?.state !== 'angry') onSay?.('guest', LINES[lang].payGo(s.id, s.id), s.id)
        }
        // (getting up: their stool pushed back with them first, then pushed home by them, stood behind it, before they walk off (item 203: it
        // slid home by itself, 0.3 s after they'd gone, their back to it 0.6 off down the aisle))
        const back = STOOL_LEAVE * Math.min(1, s.t / STOOL_PULL_S)
        // (and last, just in from the sliding door, a moment as they slide it open (item 410))
        const toDoor = payFirst ? withPause(withPause(raw, payAt, payHold), shoeAt, shoeHold) : withPause(withPause(raw, shoeAt, shoeHold), payAt, payHold)
        const d = Math.max(0, Math.min(lp.len, Math.max(back, withPause(toDoor, lp.len - doorLead.len, doorLead.len ? DOOR_SLIDE_S * v : 0))))
        const { p, dir } = alongPath(lp.path, lp.len - d)
        const home = Math.max(0, s.t - STOOL_HOME_AT)
        // (pushed home in under the counter, done as they turn to go at 0.8)
        if (home < STOOL_SLIDE_S) SEAT_PULL.set(s.seat, s.t < STOOL_HOME_AT ? back : STOOL_LEAVE - (STOOL_LEAVE + STOOL_TUCK) * (home / STOOL_SLIDE_S))
        else SEAT_PULL.delete(s.seat)
        s.still = s.lastD !== undefined && Math.abs(d - s.lastD) < 1e-6 && d < lp.len
        s.lastD = d
        s.slippers = lp.len - d > stepAt(lp.path)
        g?.position.copy(p)
        if (g) g.rotation.y = s.t < 0.8 ? st.yaw : turnToward(g.rotation.y, Math.atan2(-dir.x, -dir.z), dt * 1.5)
        // (at the step on the way out: their shoes out of their cubby and on)
        shoeStep(s, g, (raw - shoeRaw) / shoeHold, false)
        // (at the till, facing it: the register's reading follows what they owe)
        // (waiting to pay: on the way out and not yet past the till)
        if (payD && raw < payRaw + payHold) queue++
        if (payD && raw >= payRaw && raw < payRaw + payHold) {
          if (g) g.rotation.y = Math.atan2(counters[0].lay.x, counters[0].lay.z)
          paying = { s, k: (raw - payRaw) / payHold }
          const k = paying.k
          // (once the register's on their bill: the frame they step up it's still the last one's)
          if ((s.said ?? 0) < 2 && k > 0.12 && TILL_STATE.payer === s.id) {
            s.said = 2
            const bill = TILL_STATE.bill
            const tcs = tillCall.current.staff
            const by = cashierIn() || tcs < 0 ? 'role:cashier' : tcs === TILL_BY_PLATER ? plater?.id ?? 'role:cashier' : ownerServes ? 'owner' : servers[tcs]?.id ?? 'role:cashier'
            STAFF_TALK.push({ key: performance.now() + s.id, id: by, text: LINES[lang].cashierThanks(`NT$${yen(bill)}`, Math.floor(getClock().minute / 60)), until: performance.now() + 3800 })
            // (and thanks from one or two more of those in (item 324))
            crewThanks(lang, by)
          }
          if ((s.said ?? 0) < 3 && k > 0.62 && TILL_STATE.payer === s.id) {
            s.said = 3
            setPayFloats((all) => [...all, { key: performance.now() + s.id, id: s.id, text: `+NT$${yen(TILL_STATE.bill)}` }])
          }
          if ((s.said ?? 0) < 4 && k > 0.86) {
            s.said = 4
            onSay?.('guest', LINES[lang].payThanks(s.id, s.id + 1), s.id)
          }
        }
        // (out of the door they fade away, the last stretch, and no quicker than FADE_S: through it, they stand on there till they're gone
        // (let go at its end, a long stride at ×2 left them a third seen, a blink out of sight))
        // (past the sliding door they fade, down its step (item 410): over the last 0.3, not the last 0.9, which began in front of it)
        const leaveFade = doorLead.len ? 0.3 : 0.9
        if (lp.len - d < leaveFade) s.fadeT = (s.fadeT ?? 0) + dt
        s.fade = Math.max(0, Math.min(1, Math.max((lp.len - d) / leaveFade, 1 - (s.fadeT ?? 0) / FADE_S)))
        // (and if they've somehow not got out in all the time it can take, they're gone all the same)
        if ((d >= lp.len && s.fade <= 0) || raw > lp.len + (PAY_S + SHOES_S + DOOR_SLIDE_S + 8) * v) done.push(s.id)
      }
      // (their stool where it's been moved to by hand: sat on it there, and stepped up to it and away from it there)
      const mk = SEAT_MARKS.get(s.seat), fr = frame.current
      if (g && mk && fr) {
        fr.worldToLocal(mk.getWorldPosition(SEAT_SHIFT)).sub(st.stool)
        if (SEAT_SHIFT.lengthSq() > 1e-8) {
          const w = THREE.MathUtils.clamp((1.2 - Math.hypot(g.position.x - st.stool.x, g.position.z - st.stool.z)) / 0.8, 0, 1)
          g.position.addScaledVector(SEAT_SHIFT, w * w * (3 - 2 * w))
        }
      }
      // (the name tag goes with the body: gone a little before they are, so none is left hanging in the doorway)
      const tag = labels.current.get(s.id)
      // (seen in the toilet now, sat on it (the owner's, 2026-11-12): hidden only if faded right out)
      const hidden = s.phase === 'wcIn' && s.wc?.who !== 'drink' && s.fade !== undefined && s.fade <= 0
      if (g) g.visible = !hidden
      // (drei's Html draws its page bit whether its group's shown or not: inside the stall, their words hung on the toilet's wall with no
      // one under them, the owner's ghost bubble; hidden here with the body)
      if (tag) {
        tag.style.opacity = s.fade !== undefined ? String(Math.max(0, Math.min(1, s.fade * 1.6 - 0.5))) : ''
        const vis = hidden ? 'hidden' : ''
        if (tag.style.visibility !== vis) tag.style.visibility = vis
      }
      // (turned toward the way they're to face a frame at a time: each step above sets it outright (along their way, to their seat, to the
      // till), and they spun round at every corner, up to 180° in a frame. A facing set this frame is the one to turn to; one left alone,
      // the last such is still)
      // (kept by the figure, not on its userData: React puts a new userData on it each time the bar redraws, and with it gone the facing
      // was taken afresh from the one set this frame, up to 2.5 rad in a frame (item 242; the step stool's lift had the same, item 220))
      if (g) {
        const u = facings.current.get(g)
        if (!u) facings.current.set(g, { shown: g.rotation.y, want: g.rotation.y })
        else {
          if (g.rotation.y !== u.shown) u.want = g.rotation.y
          u.shown = turnToward(u.shown, u.want, dt)
          g.rotation.y = u.shown
        }
      }
      // (down a step, standing in the genkan)
      // (sat on a toilet: lowered so the seat they're lifted onto is its seat's height (FolkFigure's SEAT, a stool's))
      // (going up or down the sliding door's steps (item 410) no faster than STEP_Y_RATE: a slow frame at x2 took two steps at once, a drop
      // of 0.24 in a frame; put in the scene, where they're shown, at once)
      if (g && given) {
        // (from the height they were shown at last: their walk puts them back on the floor's each frame)
        const ty = s.wcSit ? WC_SIT_LIFT : genkanY(counters, g.position)
        const most = STEP_Y_RATE * Math.min(dt, 0.1), was = s.shownY
        s.shownY = was === undefined || s.t <= Math.min(dt, 0.1) * 1.5 ? ty : was + Math.max(-most, Math.min(most, ty - was))
        g.position.y = s.shownY
      }
    }
    // (the register and the money follow what's being paid: each dish rung up in turn, the total, the note laid on the tray, the drawer out and
    // the note put in it, the change worked out and set on the tray, the drawer shut, the change taken)
    if (paying) {
      const { s: x, k } = paying
      const { parts, items, bill } = billFor(x)
      // (the note they hand over (game/till's tenderOf, item 210: it went no higher than ten thousand, a bill over it short))
      const given = tenderOf(bill, x.id)
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
      TILL_STATE.items = items
    } else {
      TILL_STATE.drawer = 0
      TILL_STATE.k = -1
      TILL_STATE.tender = 0
      TILL_STATE.change = 0
      TILL_STATE.card = false
    }
    // (the liquor shop's deliveries come in (item 243): each case due paid for and put in the back; no cash for it, sent back; a word as they
    // come, from the stocker if there's one)
    if (clock.current - deliveryLook.current > 1) {
      deliveryLook.current = clock.current
      const { arrived, still } = arrivals(DRINK_COMING.list, getClock().day * 1440 + getClock().minute)
      if (arrived.length) {
        DRINK_COMING.list = still
        for (const d of arrived) {
          const r = buyCase(DRINK_BACK.back, d.id, SHOP_PURSE.cash())
          if (r.ok) { DRINK_BACK.back = r.back; SHOP_PURSE.spend(caseCost(d.id)) }
        }
        DRINK_BACK.ver++
        const names = [...new Set(arrived.map((d) => d.id))].map((id) => { const x = DRINKS.find((q) => q.id === id); return x ? (lang === 'ja' ? x.ja : lang === 'en' ? x.en : x.zh) : id })
        if (stocker) STAFF_TALK.push({ key: performance.now() + 0.3, id: stocker.id, text: LINES[lang].deliveryIn(names.join('、'), arrived.length), until: performance.now() + 3200 })
      }
    }
    TILL_STATE.queue = queue
    TILL_STATE.tablet = tabletActive(queue, TILL_STATE.k >= 0 && TILL_STATE.card)
    SEATS_TAKEN.clear()
    for (const x of shown) SEATS_TAKEN.add(x.seat)
    SEATS_SAT.clear()
    for (const x of shown) if (x.phase === 'sit') SEATS_SAT.add(x.seat)
    // (and whose chopsticks are up off their rest, in their hand: those sat eating)
    CHOPS_UP.clear()
    for (const x of shown) if (x.phase === 'sit' && FED.has(x.id)) CHOPS_UP.add(x.seat)
    // nobody walks through anybody: those walking (in, out, to the toilet or the fridge) keep a body's width apart,
    // stepping aside for each other, and for the servers and the stock keeper (who keep to their way, their trays and cases held level)
    // (seen coming, and stepped aside at a walk (the owner's item 45, 2026-11-13): pushed apart only once they'd walked into each other, a
    // customer met head on by a server with a tray stood half in them for a frame, and in the next was thrown up to half a body's width
    // aside at x2 (tests/e2e/_pushjump.mjs); and the stock keeper they walked right through. Now how near each two will pass is seen from how
    // they're going (where their ways had them this frame and the last): the nearest they'll come within AHEAD_S seconds. The step aside
    // that needs is taken as they come up, the more the nearer they are to passing, and each one's step aside is eased to that, and back
    // onto their way once they're by, no quicker than ASIDE_V)
    {
      const step = Math.min(dt, 0.1)
      const stamp = ++asideTick.current
      const walkers: { p: THREE.Vector3; give: boolean; id: number; vx: number; vz: number; ax: number; az: number; s?: Shown }[] = []
      const add = (p: THREE.Vector3, give: boolean, id: number, s?: Shown) => {
        // (how they're going: from where their way had them the frame before; a leap (a phase begun somewhere else) is no walk)
        const was = lastAt.current.get(id)
        let vx = 0, vz = 0
        if (was && step > 0) { vx = (p.x - was.x) / step; vz = (p.z - was.z) / step }
        if (vx * vx + vz * vz > WALK_MOST * WALK_MOST) { vx = 0; vz = 0 }
        walkers.push({ p, give, id, vx, vz, ax: 0, az: 0, s })
      }
      for (const x of shown) {
        if (x.phase === 'wcIn' && x.wc?.who !== 'drink') continue
        const gp = groups.current.get(x.id)?.position
        // (those sitting don't move aside, but nobody walks through them either: the ones going by step round them)
        if (gp) add(gp, x.phase !== 'sit', x.id, x)
      }
      waiters.current.forEach((w, wi) => add(waiterObjs.current[wi]?.position ?? w.pos, false, -1 - wi))
      if (STOCKER_FIG.o?.visible) add(STOCKER_FIG.o.position, false, STOCKER_KEY)
      // (and those waiting on the bench, on their way to it, sat there or on their way out: they keep to their way, the rest step round them
      // (item 193: going by in the aisle, customers walked through one stood before their place on it))
      // (on their way in or out they step aside as everyone walking does (item 414: one on their way in to the bench and one on their way out
      // of it walked through each other at the genkan's step, neither giving way); sat, they keep to their place)
      sitters.current.forEach((v) => { const o = sitterObjs.current.get(v.id); if (o && !v.handed) add(o.position, v.phase !== 'sit', SITTER_KEY - v.id) })
      // (a body's width, the round bodies' shoulders and all, so no two ever overlap)
      const R = 0.38
      // (what stands against the first counter's wall, measured every few seconds)
      const wallC = counters[0], keep = wallKeep.current, nowS = performance.now() / 1000
      if (given && wallC && frame.current && (nowS - keep.at > 3 || nowS < keep.at)) { keep.at = nowS; measureWall(scene, frame.current, wallC, keep) }
      /** how far one can step that way (sx, sz) from where their way has them before they'd touch what stands against the first counter's
       * wall, or, the other way, the first counter's stools (a body's half width and 2 cm from either); no end to it if neither is that way */
      const roomToward = (p: THREE.Vector3, sx: number, sz: number) => {
        if (!wallC || !keep.boxes.length) return Infinity
        const toWall = -(sx * wallC.lay.x + sz * wallC.lay.z)
        if (Math.abs(toWall) <= 1e-3) return Infinity
        const dx = p.x - wallC.at.x, dz = p.z - wallC.at.z
        const al = dx * wallC.along.x + dz * wallC.along.z, ly = dx * wallC.lay.x + dz * wallC.lay.z
        let room = Infinity
        if (toWall > 0) { for (const b of keep.boxes) if (al >= b.a0 - R / 2 && al <= b.a1 + R / 2) room = Math.min(room, Math.max(0, ly - (b.front + R / 2 + 0.02)) / toWall) }
        else if (stoolLine && ly < stoolLine.back && al >= stoolLine.a0 && al <= stoolLine.a1) room = Math.max(0, stoolLine.back - R / 2 - 0.02 - ly) / -toWall
        return room
      }
      // (and those walking the first counter's aisle past what stands out from its wall keep in toward the counter, eased in and out as a
      // step aside is (item 387: by the cats' stand, kept to the aisle's line, customers went into the cat at its front: aisleSqueeze))
      if (wallC && stoolLine && keep.boxes.length) {
        const line = -aisleOf(wallC), zones = aisleSqueeze(keep.boxes, line, stoolLine.back, R / 2)
        if (zones.length) for (const w of walkers) {
          if (!w.give) continue
          const dx = w.p.x - wallC.at.x, dz = w.p.z - wallC.at.z
          const al = dx * wallC.along.x + dz * wallC.along.z, ly = dx * wallC.lay.x + dz * wallC.lay.z
          if (ly > line + 0.12 || ly < line - 0.3) continue
          const want = squeezeLay(zones, line, al) - ly
          if (want > 0) { w.ax += wallC.lay.x * want; w.az += wallC.lay.z * want }
        }
      }
      const met = new Set<string>()
      for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j]
        if (!a.give && !b.give) continue
        const lo = a.id < b.id ? a : b, hi = lo === a ? b : a
        const rx = lo.p.x - hi.p.x, rz = lo.p.z - hi.p.z, d = Math.hypot(rx, rz)
        // (the nearest they'll pass, and how soon: lo from hi then)
        const ux = lo.vx - hi.vx, uz = lo.vz - hi.vz, uu = ux * ux + uz * uz
        const tc = uu > 1e-6 ? THREE.MathUtils.clamp(-(rx * ux + rz * uz) / uu, 0, AHEAD_S) : 0
        const cx = rx + ux * tc, cz = rz + uz * tc, dc = Math.hypot(cx, cz)
        const need = Math.max(R - d, (R - dc) * (1 - tc / AHEAD_S))
        if (need <= 0) continue
        const key = `${lo.id}|${hi.id}`
        met.add(key)
        // (which way lo steps from hi (and hi from lo): to the side they'd pass each other on, as it was when they first saw it coming,
        // kept till they're by (it doesn't turn about as they pass, nor as one turns a corner). Pushed apart along the line between them,
        // two head on stood stuck in the aisle till their ways crossed, and the push turned about with it: they swapped places in a frame
        // (tests/e2e/_poptrail.mjs); dead on, to one side of the way they're coming)
        let side = passing.current.get(key)
        if (!side) {
          let sx = cx, sz = cz, s = dc
          if (s < 0.02) { sx = -uz; sz = ux; s = Math.sqrt(uu) }
          if (s < 1e-4) { sx = 1; sz = 0; s = 1 }
          side = { x: sx / s, z: sz / s }
          // (and passed the other way round if that's where there's room: with the benches or the helmet's stand that way of whichever has to
          // step aside, they go round each other on the room's side (item 193: held off the benches, a customer met there by a server, who
          // keeps to his way, stood in him as they passed))
          const fits = (x: number, z: number) => Math.min(need, (lo.give ? roomToward(lo.p, x, z) : 0) + (hi.give ? roomToward(hi.p, -x, -z) : 0))
          if (fits(-side.x, -side.z) > fits(side.x, side.z) + 1e-3) { side.x = -side.x; side.z = -side.z }
          // (and two going the same way with no room abreast (the benches one side of the aisle, the stools the other) go one behind the
          // other: whichever's ahead a step on, the other a step back (item 193: two leaving together walked the aisle in each other))
          if (fits(side.x, side.z) < need - 1e-3) {
            const vx = lo.vx + hi.vx, vz = lo.vz + hi.vz, vv = Math.hypot(vx, vz)
            if (vv > 0.3 && uu < 0.25 * vv * vv) { const ahead = rx * vx + rz * vz >= 0 ? 1 : -1; side.x = (ahead * vx) / vv; side.z = (ahead * vz) / vv }
          }
          passing.current.set(key, side)
        }
        // (two walking: half of it each; one into someone who doesn't give (sat, or a server with a tray): all of it, round them)
        // (and one with the benches or the helmet's stand behind them steps back toward it only as far as there's room: the other takes the
        // rest, into the room behind the stools if it's there (item 193: held off the benches, the two passing went into each other))
        let sl = lo.give ? (hi.give ? need * 0.5 : need) : 0, sh = hi.give ? (lo.give ? need * 0.5 : need) : 0
        const rl = lo.give ? roomToward(lo.p, side.x, side.z) : 0, rh = hi.give ? roomToward(hi.p, -side.x, -side.z) : 0
        if (sl > rl) { if (hi.give) sh += sl - rl; sl = rl }
        if (sh > rh) { if (lo.give) sl = Math.min(rl, sl + sh - rh); sh = rh }
        if (lo.give) { lo.ax += side.x * sl; lo.az += side.z * sl }
        if (hi.give) { hi.ax -= side.x * sh; hi.az -= side.z * sh }
      }
      for (const k of passing.current.keys()) if (!met.has(k)) passing.current.delete(k)
      // (each one's step aside eased to what it should be now: out as they come up, back once they're by)
      const most = ASIDE_V * step
      for (const w of walkers) {
        const was = lastAt.current.get(w.id)
        if (was) { was.x = w.p.x; was.z = w.p.z; was.f = stamp } else lastAt.current.set(w.id, { x: w.p.x, z: w.p.z, f: stamp })
        let off = aside.current.get(w.id)
        if (!off) {
          if (w.ax === 0 && w.az === 0) continue
          off = { x: 0, z: 0, f: stamp }
          aside.current.set(w.id, off)
        }
        off.f = stamp
        const tx = w.ax - off.x, tz = w.az - off.z, t = Math.hypot(tx, tz)
        const k = t > most ? most / t : 1
        off.x += tx * k; off.z += tz * k
        w.p.x += off.x; w.p.z += off.z
        // (and never stepped aside into what stands against the first counter's wall, the benches and the helmet's stand (item 193: stepping
        // aside for someone, customers went 0.11 to 0.24 into a bench's seat): a step toward it goes no nearer it than just short of
        // touching it (a body's half width and 2 cm from its front), or than their own way has them, if that runs nearer it (to a place on
        // the bench, and up from it)
        if (w.give && wallC && keep.boxes.length) {
          const dx = w.p.x - wallC.at.x, dz = w.p.z - wallC.at.z
          const al = dx * wallC.along.x + dz * wallC.along.z
          let ly = dx * wallC.lay.x + dz * wallC.lay.z
          const own = ly - (off.x * wallC.lay.x + off.z * wallC.lay.z)
          for (const b of keep.boxes) {
            if (al < b.a0 - R / 2 || al > b.a1 + R / 2) continue
            const near = Math.min(b.front + R / 2 + 0.02, own)
            if (ly >= near) continue
            // (back no quicker than a step aside: come up to it stepped aside further, they'd have jumped back in a frame; its ends are
            // reached a body's half width early, so they're back by then)
            const back = Math.min(near - ly, most)
            w.p.x += wallC.lay.x * back; w.p.z += wallC.lay.z * back; off.x += wallC.lay.x * back; off.z += wallC.lay.z * back
            ly += back
          }
        }
        // (a step aside is a step: stood in a queue or at the genkan's step, eased aside they slid across the floor, their feet still (item 50))
        if (w.s && w.give && t * k > 0.002) w.s.still = false
        if (w.ax === 0 && w.az === 0 && Math.abs(off.x) + Math.abs(off.z) < 1e-4) aside.current.delete(w.id)
      }
      // (those gone, or into a toilet's stall, forgotten: out of it, they're stood where they come out and set off from there)
      aside.current.forEach((v, id) => { if (v.f !== stamp) aside.current.delete(id) })
      lastAt.current.forEach((v, id) => { if (v.f !== stamp) lastAt.current.delete(id) })
    }
    // the fridge's door opens for whoever's at it (as they come up to it, while they take their drink, as they leave it)
    if (fridges) for (const fr of fridges) {
      FRIDGE_STATE[fr.n].passing = shown.filter((x) => x.wc?.who === 'drink' && (x.wc.unit ?? 0) === fr.n && (x.phase === 'wcIn'
        || ((x.phase === 'wcGo' || x.phase === 'wcBack') && (groups.current.get(x.id)?.position.distanceTo(fr.front) ?? 9) < 0.7))).length
        + (FRIDGE_STATE[fr.n].stocker ? 1 : 0)
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
      // air where it was (the owner saw plates floating): one being carried to a customer goes back on the plating place's stack (or the racks, with
      // that full); one cleared off the bar goes on into the sink as a dirty plate)
      const holding = new Set<number>()
      for (const x of waiters.current) {
        if (x.run !== null && x.run !== undefined) holding.add(x.run)
        for (const k of x.carry ?? []) holding.add(k)
      }
      for (const r of [...runs.current]) {
        if (r.phase === 'carry' && !holding.has(r.key)) {
          runs.current = runs.current.filter((x) => x !== r)
          if (PLATING.stock < STACK_CAP) PLATING.stock += 1
          else PLATE_RACK.n = putBack(PLATE_RACK.n, 1)
          redraw()
        } else if (r.phase === 'taken' && !holding.has(r.key)) {
          SINK_BIN.sticks += r.sticks ?? 0
          binThrow([r])
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
      if (r.phase === 'set' || r.phase === 'dirty' || r.phase === 'taken' || (r.phase === 'clear' || r.phase === 'home') && r.t < 0 || r.phase === 'carry' || r.phase === 'ready') {
        if (r.phase === 'set' || r.phase === 'dirty') o?.position.copy(plateAt(r.seat))
        if (r.phase === 'ready' && o) { o.position.copy(platingPlace(readyAlong(r.slot ?? 0))); o.scale.setScalar(ON_TABLE); o.rotation.y = PASS_YAW }
        // (set down, turned to lie along its customer's counter (item 228: seatTurn); on the tray, the server's turning it as they set it down)
        if (o && (r.phase === 'set' || r.phase === 'dirty')) o.rotation.y = PASS_YAW + seatTurn(r.seat)
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
        // (one handed over the bar from the racks (no one on the floor): lying along its customer's counter all the way (item 228))
        if (r.phase === 'serve') o.rotation.y = PASS_YAW + seatTurn(r.seat)
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
    // the plating place: a plate laid in one of its slots (Roasting lays it, for a seat's first food) is drawn there from then on; one whose slot's gone
    // without being taken up (its customer left before it went, the food binned, the plate put back on the stack) goes with it
    for (let k = 0; k < READY_SLOTS; k++) {
      const sl = PLATING.slots[k]
      const r = runs.current.find((x) => x.phase === 'ready' && x.slot === k)
      if (sl?.plate && !r) {
        const g = shownRef.current.find((x) => x.seat === sl.seat && x.phase !== 'leave')
        runs.current.push({ key: ++runSeq.current, seat: sl.seat, guest: g?.id ?? -1, phase: 'ready', slot: k, t: 0, from: platingPlace(readyAlong(k)), kind: kindFor(g?.id) })
        redraw()
      } else if (r && (!sl || !sl.plate || sl.seat !== r.seat)) {
        runs.current = runs.current.filter((x) => x !== r)
        redraw()
      }
      // (a later dish's carrier dish while it waits there)
      const cr = carriers.current[k]
      if (cr) cr.visible = !!sl && !sl.plate && sl.landed + sl.flying > 0
      // (how long it's been ready to go: what's for it all down on it, nothing more on its way)
      readyFor.current[k] = sl && sl.landed > 0 && sl.flying === 0 ? readyFor.current[k] + step : 0
    }
    for (const b of passQ.current) if (b.server === undefined) b.wait += step
    const sitting = (n: number) => shownRef.current.some((x) => x.seat === n && (x.phase === 'sit' || x.phase.startsWith('wc')))
    /** a slot of the plating place ready to go, for a customer sat at their place, that no server's on their way for */
    // (the one that's waited the longest, not the first along: in a rush the plating place's last slot waited behind the others coming
    // ready again and again, its food holding two of the tray's four places (item 317))
    const readySlot = () => {
      let best = -1
      for (let k = 0; k < READY_SLOTS; k++) {
        const sl = PLATING.slots[k]
        if (sl && readyFor.current[k] >= READY_S && sitting(sl.seat) && !waiters.current.some((x) => x.slot === k) &&
          (best < 0 || readyFor.current[k] > readyFor.current[best])) best = k
      }
      return best
    }

    // the kitchen's plater (the third cook, or with none the second, between his rounds of the orders; the owner's at the fire): when the plating place's stack of clean plates runs low, across the
    // kitchen to the racks for a few and back with them to the plating place, set down there for plating on, and back to their place
    {
      const pl = platerRun.current
      // (the third cook at their place with nothing to do (the second cook doing it is Roasting's to tell: he may be off fetching))
      if (plater?.role === 'sous') idleTick(plater.id, pl.phase === 'idle' && FIRE_TEND.want === null && !SHOP.leaving, dt)
      // (someone to keep the fire: the grill asks them rather than dropping the coals in itself)
      FIRE_TEND.tender = !!given && !ownerServes && open
      CRATE.tended = FIRE_TEND.tender
      const home = () => (plater ? inBar(`crew-${plater.id}`, ownerAt()) : ownerAt()).setY(0)
      /** which way the one at their place faces, in the bar's frame (null: no one there to match) */
      const yawOfCrew = () => {
        const o = plater ? markOf(`crew-${plater.id}`) : null, f = frame.current
        if (!o || !f) return null
        const q = f.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion()))
        const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
        return Math.atan2(z.x, z.z)
      }
      const walk = (then: () => void) => {
        const d = Math.min(pl.len, pl.t * SERVER_SPEED)
        const { p, dir } = alongPath(pl.path, d)
        pl.pos.copy(p)
        // (turned to the way quickly but not at once: setting off from their place, they snapped round from how they stood there)
        if (dir.x || dir.z) pl.yawTo = Math.atan2(dir.x, dir.z)
        if (d >= pl.len) { pl.t = 0; then() }
      }
      // (going: stood in for from just how the one at their place stands)
      const away = (on: boolean) => {
        if (on) { const y = yawOfCrew(); if (y !== null) pl.yaw = pl.yawTo = y }
        if (plater) PLATER_OUT.id = on ? plater.id : null; else ownerAway('plate', on)
      }
      // (worn out, at half pace (the owner's))
      pl.t += step * paceOfStaff(plater?.id)
      // (the cooker cooking, by the game's clock; cooked, full and keeping warm, said in the kitchen's log (the owner's))
      {
        const r = kamaTick(RICE.kama, step)
        RICE.kama = r.kama
        if (r.cooked) { RICE.rice = RICE.batch; onSay?.('chef', LINES[lang].riceDone) }
        // (the soup's pot heating up in its well, the same)
        // (as fast as the well's heat has it: not at all with it off)
        const s = potTick(SOUP.pot, step * heatRate(heatNow(SOUP.heat, SOUP.pot)))
        SOUP.pot = s.pot
        if (s.hot) { SOUP.left = SOUP.batch; onSay?.('chef', LINES[lang].soupDone) }
      }
      /** where they stand at the cooker; its top, where the rice goes in */
      const kamaSpot = () => { marks.current.delete('cooker-front'); return inBar('cooker-front', home()).setY(0) }
      const kamaTop = () => { marks.current.delete('cooker-top'); return inBar('cooker-top', home()) }
      /** where they stand at the rice-ball counter's board, and the board (Decor's PrepCounter, item 129) */
      const prepSpot = () => { marks.current.delete('prep-front'); return inBar('prep-front', home()).setY(0) }
      const prepBoard = () => { marks.current.delete('prep-board'); return inBar('prep-board', home()) }
      // (item 392: the garnishes' grater on the rice-ball counter, and where one stands at it; none drawn, null)
      const graterAt = () => (markOf('prep-grater') ? inBar('prep-grater', home()) : null)
      const garnishSpot = () => { marks.current.delete('prep-garnish-front'); return inBar('prep-garnish-front', home()).setY(0) }
      /** the open sack of rice (by the sake, just past the kitchen's edge): its middle, the kitchen's edge nearest it (the route there), and
       * where they stand at it, stepped down off the kitchen's floor to it */
      const sackSpots = () => {
        marks.current.delete('RiceSackOpenSet')
        const at = inBar('RiceSackOpenSet', home()).setY(0)
        const c0 = counters[0], d = at.clone().sub(c0.at)
        const a = THREE.MathUtils.clamp(d.dot(c0.along), kitchen.along[0] + 0.2, kitchen.along[1] - 0.2)
        const l = THREE.MathUtils.clamp(d.dot(c0.lay), kitchen.lay[0] + 0.2, kitchen.lay[1] - 0.2)
        const edge = c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
        return { at, edge, front: at.clone().add(edge.clone().sub(at).setY(0).setLength(0.34)) }
      }
      /** where they stand at the two skewer holders on the cook table's front (the used ones' right of the notch, the clean ones' left of it):
       * the nearest spot on the floor clear of the table (right under one, they stood half in the table's face) */
      const skTraySpot = () => skewerSpot('skewer-tray', home())
      const skHolderSpot = () => skewerSpot('skewer-holder', home())
      const faceTo = (v: THREE.Vector3) => { pl.yawTo = Math.atan2(v.x - pl.pos.x, v.z - pl.pos.z) }
      /** where they stand on the kitchen's floor to reach something on (or by) the cook table: the nearest spot clear of it that a way reaches
       * from where they are (game/kitchenPath's reachSpot; the nearest side alone (standClear) could be one no way reaches: the sake stand,
       * moved along the table's back by the owner, was reached from the gap between the table and the bar, the way there none, and the
       * second cook walked the straight line through the table and the fire bed and back, the hearth's guard throwing him out of it a metre
       * and more each frame (the owner, 2026-11-15: the dayaudit, 193 pushes, 20 jumps of 1.7 m)) */
      const reachOf = (v: THREE.Vector3) => {
        const blocks = kitchenBlocks()
        if (!blocks.length) return v.clone().setY(0)
        const k = kitchenOf(counters)
        const [a, l] = reachSpot(flat(v), flat(pl.pos), { x0: k.along[0], z0: k.lay[0], x1: k.along[1], z1: k.lay[1] }, blocks)
        const c0 = counters[0]
        return c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
      }
      /** the middle of what's drawn of something (its node's origin is wherever its model put it: the bucket's is the cook table's) */
      const middleOf = (name: string) => {
        marks.current.delete(name)
        const o = markOf(name), f = frame.current
        if (!o || !f) return home()
        f.updateWorldMatrix(true, false)
        return f.worldToLocal(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()))
      }
      const crateAt = () => middleOf('coal-crate')
      const bucketAt = () => middleOf('WaterBucket')
      /** where the bucket's dipped from: a step toward it in his own place when it's by it (the third cook's bay), or null: from further off
       * (the second cook plating from the board, the bucket moved in edit mode), the floor by it, as for anything on the table */
      const dipFrom = () => {
        const b = bucketAt(), h = home()
        const d = Math.hypot(b.x - h.x, b.z - h.z)
        return d < DIP_NEAR ? h.clone().lerp(b.setY(h.y), Math.max(0, d - DIP_REACH) / d) : null
      }
      /** a step or two straight to a spot in his own place: no way round the table to find (the kitchen's ways go round it, out of his bay) */
      const stepTo = (to: THREE.Vector3, phase: typeof pl.phase) => { pl.path = [pl.pos.clone(), to.clone()]; pl.len = pathLength(pl.path); pl.phase = phase; pl.t = 0 }
      const soupPot = () => middleOf('miso-pot')
      /** where one stands to stir the soup: before the counter's front across from the pot, as far out from it as at the cooker (on the line
       * through the cooker's own place square across the counter). Item 387: it was the pot's middle moved by the cooker's step back from
       * its own; the pot stands further in on the counter than the cooker, and that put them in the counter to the chest, the top through
       * them (the owner's 「有個致命的問題動作都會深陷進模型去」) */
      const soupStand = () => frontOf(soupPot(), kamaSpot(), kamaTop())
      const hearthAt = () => { marks.current.delete('FirePit'); return inBar('FirePit', home()) }
      /** where the water's thrown from: his own bay at the table's far end (Roasting's SOUS_AT), facing in over the hearth's near side */
      const hearthSpot = () => home()
      /** the sack of binchotan on the floor past the table's far end, where the crate's filled from */
      const coalSackAt = () => middleOf('coal-sack')
      /** where he stands to lift an armful out of it: the side of it a way reaches from where he is, the shortest walk (game/kitchenPath's
       * reachSpot): out of his bay past the table's end, on the sack's kitchen side. (Its nearest clear spot was between the table's side and
       * the counter, off the kitchen's floor: no way found there, he walked the straight line through the table's end, and the table's guard
       * put him out of it a frame at a time, to one side and then the other, four leaps a trip (item 54).) */
      const sackReach = () => {
        const blocks = kitchenBlocks()
        if (!blocks.length) return coalSackAt().setY(0)
        const c0 = counters[0], k = kitchenOf(counters)
        const [a, l] = reachSpot(flat(coalSackAt()), flat(pl.pos), { x0: k.along[0], z0: k.lay[0], x1: k.along[1], z1: k.lay[1] }, blocks)
        return c0.at.clone().addScaledVector(c0.along, a).addScaledVector(c0.lay, l).setY(0)
      }
      /** turned to face something where they stand, quickly but not at once, for `dur` seconds; then on */
      const turnTo = (v: THREE.Vector3, dur: number, then: () => void) => {
        pl.yawTo = Math.atan2(v.x - pl.pos.x, v.z - pl.pos.z)
        if (pl.t > dur) { pl.t = 0; then() }
      }
      const setOff = (to: THREE.Vector3, phase: typeof pl.phase) => {
        pl.path = kitchenRoute(pl.pos, to)
        // (home: the last step onto just where they stand at their place (the route stops at the nearest clear floor, as much as 0.7 off:
        // the one at their place shown again there, they jumped))
        if ((phase === 'home' || phase === 'toFill' || phase === 'toHearth' || phase === 'toSake') && pl.path.length && pl.path[pl.path.length - 1].distanceTo(to) > 0.02) pl.path.push(to.clone())
        pl.len = pathLength(pl.path)
        pl.phase = phase
        pl.t = 0
      }
      /** off for plates for the plating place's stack: off the low rack by the table while it has any (a few steps), else across the kitchen
       * to the racks */
      const goPlates = () => {
        // (called out as they go: the plates short (item 324))
        if (plater) crewCall(lang, 'plates', plater.id)
        pl.pos.copy(home())
        pl.src = plateSource(LOW_RACK.n)
        pl.path = kitchenRoute(pl.pos, pl.src === 'low' ? lowFront() : rackFront(rackNow()))
        pl.len = pathLength(pl.path)
        pl.phase = 'toRack'
        away(true)
      }
      if (!given || ownerServes) {
        // (nobody to plate: a bar on its own, or the owner out serving it all himself; the plating place's stack kept up as it's used, and
        // the rice cooked by itself)
        // (the low rack kept full off the racks, and the plating place's stack off it first)
        if (open && LOW_RACK.n < LOW_FULL && PLATE_RACK.n > 0) { LOW_RACK.n += 1; PLATE_RACK.n -= 1 }
        if (open && PLATING.stock < STACK_CAP) {
          if (LOW_RACK.n > 0) { PLATING.stock += 1; LOW_RACK.n -= 1 } else if (PLATE_RACK.n > 0) { PLATING.stock += 1; PLATE_RACK.n -= 1 }
        }
        // (a pot set on only with rice (or the soup's makings) in stock, and only as much as there is (item 199: made full from nothing))
        if (open && riceGoes(RICE.kama) && anyInStock(['Onigiri'])) { RICE.kama = setOn(); RICE.batch = batchOf('Onigiri', RICE_FULL) }
        if (open && soupGoes(SOUP.pot) && anyInStock(['MisoSoup'])) { SOUP.pot = setSoup(); SOUP.batch = batchOf('MisoSoup', SOUP_BOWLS) }
        if (open && washGoes(SKEWERS.s)) SKEWERS.s = washAll(SKEWERS.s)
      } else if (pl.phase === 'idle') {
        // (the second cook, plating with no third cook to: not while he's fetching an order or skewering it at the board)
        // (the owner doing it, with no third cook: not while he's off on another job, the washing up (item 216: two of him at once))
        // (and not with the shop open till the third cook's in at his place (game/shopState's ON_DUTY: his walk in from the door done): sent off
        // from his place while he was still out at the door or on his way, which was where his mark was, and home to it, he went out to the
        // steps and jumped back (item 411))
        if (pl.t > 0.5 && (!!plater || ownerFree('plate')) && platerFree(!!plater && FETCHER.id === plater.id, FETCHER.busy) && !(plater && open && !ON_DUTY.in.has(plater.id))) {
          pl.t = 0
          if (open && !SHOP.leaving && FIRE_TEND.want && !FIRE_TEND.done) {
            // (the fire's asked for: charcoal from the crate, or water from the bucket on the table by his bay, first of all)
            pl.pos.copy(home())
            pl.fire = FIRE_TEND.want
            away(true)
            if (pl.fire === 'tidy') {
              // (the irons at his right hand in his bay: taken up and the bed raked over where he stands, none of it walked (item 108))
              pl.path = []; pl.len = 0; pl.phase = 'rake'; faceTo(hearthAt())
              IRONS.until = performance.now() + RAKE_S * 1000
            } else if (pl.fire === 'coal') {
              // (in his bay the crate's at his right hand: turned to it, a handful taken, turned back and tipped in, none of it walked (the
              // owner's); with too little in it for a handful, first out to the sack on the floor for an armful to fill it)
              if (CRATE.left >= COAL_PER_ADD.max || SUPPLIES.coal() < 1) { pl.path = []; pl.len = 0; pl.phase = 'turnCrate' }
              else setOff(sackReach(), 'toCoalSack')
              // (called out: the fire wanting coal (item 324))
              if (plater) crewCall(lang, 'coal', plater.id)
            } else { const near = dipFrom(); if (near) stepTo(near, 'toBucket'); else setOff(reachOf(bucketAt()), 'toBucket') }
          } else if (open && !SHOP.leaving && SAKE.want.length && !sakeJob.current && STATION_OBJ.group) {
            // (a customer's tokkuri of sake (item 177, the owner's: "the way it goes looks odd, and not professional"): over to the sake station
            // on the serving counter, the open bottle kept there in reach, and poured by hand; left there with its cup for a server to carry out
            // (the stand on the cook table is out of everyone's reach: its bottle lifted and poured itself, and the tokkuri appeared at the seat))
            const guest = SAKE.want.shift()!, seat = guestSeat(guest)
            // (not at the bar to be found just now: back in the queue for a little later)
            if (seat < 0) SAKE.want.push(guest)
            else {
              sakeJob.current = { guest, seat, pourer: 'plater', t: -1 }
              sakeSpots.current.delete(seat)
              sakeSpotOf(seat)
              pl.pos.copy(home())
              setOff(stationSpot(), 'toSake')
              away(true)
            }
          } else if (open && !SHOP.leaving && PLATING.stock + PLATING.coming === 0 && platerGoes(PLATING.stock, PLATING.coming, PLATE_RACK.n + LOW_RACK.n)) {
            // (the plating place bare: plates before anything else but the fire and a pour of sake, nothing done coming off the fire can be
            // served without one (item 207))
            goPlates()
          } else if (open && !SHOP.leaving && !bowlJob.current && STATION_OBJ.group && freeRow() >= 0 && bowlsNow()) {
            // (a customer's rice and soup (items 205, 206): over to the cooker for the rice, to the pot for the soup, both filled by hand,
            // then to the serving counter with them; only with some ready to fill (bowlsNow, item 207), and a place at the counter to set
            // them down in (another customer's may wait there already: item 207))
            const b = nextBowls()
            if (b) {
              bowlJob.current = { ...b, by: 'plater', stage: b.rice ? 'rice' : 'soup', t: 0, riceFill: 0, soupFill: 0, W: null, row: freeRow() }
              pl.pos.copy(home())
              setOff(b.rice ? riceStand() : soupFillAt().stand, b.rice ? 'toRiceBowl' : 'toSoupBowl')
              away(true)
            }
          } else if (tillCall.current.who >= 0 && tillCall.current.staff < 0 && !cashierIn() && given) {
            // (someone waiting at the till with no cashier sat at it, no server free for it: round to the back of it to ring them up (item 203);
            // the till's back reached from the kitchen as the takeaway stand behind it is (standSpots))
            tillCall.current.staff = TILL_BY_PLATER
            pl.pos.copy(home())
            setOff(standSpots().edge, 'toTillBack')
            pl.path.push(tillStaffSpot())
            pl.len = pathLength(pl.path)
            away(true)
          } else if (open && !SHOP.leaving && washGoes(SKEWERS.s) && !waiters.current.some((x) => SK_PHASES.has(x.phase))
            && (SKEWERS.s.clean <= WASH_LOW || !platerGoes(PLATING.stock, PLATING.coming, PLATE_RACK.n + LOW_RACK.n))) {
            // (the used skewers piling up, or the clean ones' bucket nearly empty, and no server already on it: to the used bucket by the plating
            // place for all of them. The skewers are the third cook's to wash (CLAUDE.md's kitchen crew: 三廚…洗串); it was only with no server
            // hired, and the servers, always serving first, never got to them: on an ordinary evening 38 lay dirty and none were washed in 200 s,
            // and the bucket ran dry (item 237, tests/e2e/_skewerflow220.mjs))
            pl.pos.copy(home())
            setOff(skTraySpot(), 'toSkTray')
            away(true)
          // (made before the plates are seen to when someone's waiting for a bowl of it (item 205: in a rush the plates always wanted, and the
          // soup and the rice were never made: the bowls waited all evening))
          // (the rice first when both are empty (item 346): the cooker's the longest to come (washed, then a quarter minute cooking), and the soup
          // heats in its well by itself once it's made; soup first, the first bowls of rice came half a minute after the doors opened)
          } else if (open && !SHOP.leaving && riceGoes(RICE.kama) && anyInStock(['Onigiri']) && (BOWLS.want.some((x) => x.rice) || !platerGoes(PLATING.stock, PLATING.coming, PLATE_RACK.n + LOW_RACK.n))) {
            // (the cooker's empty: to the open sack for the next pot's rice, over the kitchen's edge to it, then to the sink to wash it)
            pl.pos.copy(home())
            const sk = sackSpots()
            pl.path = [...kitchenRoute(pl.pos, sk.edge), sk.front]
            pl.len = pathLength(pl.path)
            pl.phase = 'toSack'
            pl.t = 0
            away(true)
          } else if (open && !SHOP.leaving && (soupGoes(SOUP.pot) || topUpGoes(SOUP.pot, SOUP.left)) && anyInStock(['MisoSoup']) && (BOWLS.want.some((x) => x.soup) || topUpGoes(SOUP.pot, SOUP.left) || !platerGoes(PLATING.stock, PLATING.coming, PLATE_RACK.n + LOW_RACK.n))) {
            // (or run low, hot: the next pot's worth made and added, the pot kept hot (item 207))
            // (the soup's pot empty (the day's start): to it to make it, water and dashi in and the miso stirred in, then it heats in its well)
            pl.pos.copy(home())
            pl.making = true
            setOff(soupStand(), 'toSoup')
            away(true)
          } else if (open && !SHOP.leaving && platerGoes(PLATING.stock, PLATING.coming, PLATE_RACK.n + LOW_RACK.n)) {
            goPlates()
          } else if (open && !SHOP.leaving && lowGoes(LOW_RACK.n, LOW_RACK.coming, PLATE_RACK.n)) {
            // (the low rack by the table run low, nothing else wanting: across to the racks for a carry of plates to fill it)
            pl.pos.copy(home())
            pl.path = kitchenRoute(pl.pos, rackFront(rackNow()))
            pl.len = pathLength(pl.path)
            pl.phase = 'toRackLow'
            pl.t = 0
            away(true)
          } else if (open && !SHOP.leaving && trayWants(ONIGIRI_TRAY.n, RICE.rice, RICE.kama)) {
            // (nothing else wanting and the rice cooked: to the rice-ball counter to shape rice balls onto its tray, up to its three (item
            // 129, the owner's, 2026-11-15: the third cook shaping them, seen))
            pl.pos.copy(home())
            setOff(prepSpot(), 'toShape')
            away(true)
          } else if (open && !SHOP.leaving && performance.now() / 1000 - soupAt.current > SOUP_EVERY) {
            // (nothing else wanting: to the miso soup now and then, to stir it as it's kept warm)
            soupAt.current = performance.now() / 1000
            pl.pos.copy(home())
            // (before it, as at the cooker beside it on the warming counter: the nearest clear spot to its middle was round its back, on the
            // counter's edge of the kitchen's floor, and the way there went through the counter)
            setOff(soupStand(), 'toSoup')
            away(true)
          } else if (open && !SHOP.leaving && performance.now() / 1000 - grateAt.current > GRATE_EVERY && graterAt()) {
            // (nothing else wanting: to the garnishes' corner of the rice-ball counter, to grate daikon for what goes out with the fish (item
            // 392, the owner's 「不見得只能料理飯糰」), a few strokes on the grater, and back)
            grateAt.current = performance.now() / 1000
            pl.pos.copy(home())
            setOff(garnishSpot(), 'toGrate')
            away(true)
          }
        }
      } else if (pl.phase === 'toCrate') walk(() => { pl.phase = 'takeCoal'; faceTo(crateAt()) })
      else if (pl.phase === 'turnCrate') turnTo(crateAt(), 0.35, () => { pl.phase = 'takeCoal' })
      else if (pl.phase === 'takeCoal' && pl.t > 0.6) { pl.phase = 'turnBack'; pl.t = 0 }
      else if (pl.phase === 'turnBack') turnTo(hearthAt(), 0.35, () => { pl.phase = 'feedCoal' })
      // (the crate low: an armful out of the sack on the floor, carried back into his bay and into the crate (paid for out of the stock as
      // it goes in: SUPPLIES.refillCrate), then the handful out of it)
      else if (pl.phase === 'toCoalSack') walk(() => { pl.phase = 'liftSack'; faceTo(coalSackAt()) })
      else if (pl.phase === 'liftSack' && pl.t > 0.9) setOff(home(), 'toFill')
      else if (pl.phase === 'toFill') walk(() => { pl.phase = 'fillCrate' })
      else if (pl.phase === 'fillCrate') {
        if (pl.t < 0.3) pl.yawTo = Math.atan2(crateAt().x - pl.pos.x, crateAt().z - pl.pos.z)
        else if (pl.t > 0.9) {
          CRATE.left += SUPPLIES.refillCrate(Math.max(0, CRATE_FULL - CRATE.left))
          pl.phase = 'takeCoal'
          pl.t = 0
        }
      }
      else if (pl.phase === 'rake' && pl.t > RAKE_S) {
        // (raked: the ash knocked off and the coals drawn together (Roasting does it on seeing it done); turned back as he stands)
        FIRE_TEND.done = 'tidy'
        FIRE_TEND.want = null
        pl.phase = 'settle'
        pl.t = 0
      }
      else if (pl.phase === 'toBucket') walk(() => { pl.phase = 'scoopWater'; faceTo(bucketAt()) })
      // (back from a step in his bay straight to where he stands; from the floor by the table, the way round to it)
      else if (pl.phase === 'scoopWater' && pl.t > 0.8) { if (dipFrom()) stepTo(hearthSpot(), 'toHearth'); else setOff(hearthSpot(), 'toHearth') }
      else if (pl.phase === 'toHearth') walk(() => { pl.phase = pl.fire === 'water' ? 'sprinkle' : 'feedCoal'; faceTo(hearthAt()) })
      else if ((pl.phase === 'feedCoal' || pl.phase === 'sprinkle') && pl.t > 0.8) {
        // (the sticks in, or the water splashed on: the grill does the rest; he's in his bay already, turned back as he stands there. What
        // was asked for done: not asked again before the grill's seen it's done (he went straight back for a second handful))
        FIRE_TEND.done = pl.phase === 'feedCoal' ? 'coal' : 'water'
        FIRE_TEND.want = null
        pl.path = []; pl.len = 0
        pl.phase = 'settle'
        pl.t = 0
      } else if (pl.phase === 'toSake') walk(() => { pl.phase = 'pourSake'; pl.yawTo = stationYaw() })
      // (at the station, square on to it: a tokkuri set out, the bottle taken up in both hands, poured, set back, a cup put by it (the
      // beats, game/sakePour; the bottle and the hands posed from them below); poured, left there for a server, and home)
      else if (pl.phase === 'pourSake') {
        const j = sakeJob.current
        if (j && j.pourer === 'plater') j.t = Math.min(POUR_TOTAL, pl.t)
        if (!j || j.pourer !== 'plater' || pl.t >= POUR_TOTAL) setOff(home(), 'home')
      }
      // (a customer's bowls: at the cooker, square on to it, the rice scooped beat by beat; at the pot the soup ladled; to the counter with
      // them, set down there for a server; they gone meanwhile, the bowls put by, and home)
      else if (pl.phase === 'toRiceBowl') walk(() => { const j = bowlJob.current; if (j) { j.W = riceFillAt(); j.t = 0; pl.yawTo = Math.atan2(j.W.face.x, j.W.face.z) } pl.phase = 'riceBowl' })
      else if (pl.phase === 'riceBowl') {
        const j = bowlJob.current
        if (!j) setOff(home(), 'home')
        else {
          j.t = Math.min(RICE_LEN, pl.t)
          if (pl.t >= RICE_LEN) {
            const r = takeRice(RICE.rice, RICE.kama)
            RICE.rice = r.rice; RICE.kama = r.kama; RICE.lid = 0
            j.riceFill = 1
            if (j.soup) { j.stage = 'soup'; setOff(soupFillAt().stand, 'toSoupBowl') }
            else { j.stage = 'toPass'; setOff(passSpot(), 'toBowlPass') }
          }
        }
      }
      else if (pl.phase === 'toSoupBowl') walk(() => { const j = bowlJob.current; if (j) { j.W = soupFillAt(); j.t = 0; pl.yawTo = Math.atan2(j.W.face.x, j.W.face.z) } pl.phase = 'soupBowl' })
      else if (pl.phase === 'soupBowl') {
        const j = bowlJob.current
        if (!j) setOff(home(), 'home')
        else {
          j.t = Math.min(SOUP_LEN, pl.t)
          if (pl.t >= SOUP_LEN) {
            const b = takeBowl(SOUP.pot, SOUP.left)
            SOUP.pot = b.pot; SOUP.left = b.left
            j.soupFill = 1
            j.stage = 'toPass'
            setOff(passSpot(), 'toBowlPass')
          }
        }
      }
      else if (pl.phase === 'toBowlPass') walk(() => { pl.phase = 'bowlPut'; pl.yawTo = stationYaw() })
      else if (pl.phase === 'bowlPut' && pl.t > BOWL_PUT_S) {
        // (left at the counter in their row for a server, and the plater free for the next customer's (item 207); they gone meanwhile,
        // put by)
        const j = bowlJob.current
        if (j && guestSits(j.guest, j.seat)) passQ.current.push({ guest: j.guest, seat: j.seat, rice: j.rice, soup: j.soup, row: j.row ?? 0, up: 0, down: 0, wait: 0 })
        bowlJob.current = null
        setOff(home(), 'home')
      }
      else if (pl.phase === 'toSoup') walk(() => { pl.phase = 'stir'; faceTo(soupPot()) })
      else if (pl.phase === 'stir' && pl.t > (pl.making ? MAKE_S : STIR_S)) {
        // (made: in its well heating up (the water for it metered as the rice's is))
        // (or a hot pot run low topped up with as much as it takes to fill it, still hot (item 207))
        if (pl.making && SOUP.pot.state === 'hot') { SOUP.left += batchOf('MisoSoup', Math.max(0, SOUP_BOWLS - SOUP.left)); meterWater('cooking', 6); pl.making = false }
        else if (pl.making) { SOUP.pot = setSoup(); SOUP.batch = batchOf('MisoSoup', SOUP_BOWLS); meterWater('cooking', 10); pl.making = false; soupAt.current = performance.now() / 1000 }
        setOff(home(), 'home')
      }
      else if (pl.phase === 'toRack') walk(() => {
        pl.phase = 'take'
        const at = pl.src === 'low' ? lowTop() : rackTop(rackNow())
        pl.yawTo = Math.atan2(at.x - pl.pos.x, at.z - pl.pos.z)
      })
      else if (pl.phase === 'take' && pl.t > 0.5) {
        // (off the racks into their hands, as many as the plating place's stack wants)
        if (pl.src === 'low') { pl.n = platesToBring(PLATING.stock, LOW_RACK.n); LOW_RACK.n -= pl.n }
        else { pl.n = platesToBring(PLATING.stock, PLATE_RACK.n); PLATE_RACK.n -= pl.n }
        PLATING.coming = pl.n
        pl.path = kitchenRoute(pl.pos, plating.in.clone().setY(0))
        pl.len = pathLength(pl.path)
        pl.phase = 'toPass'
        pl.t = 0
      } else if (pl.phase === 'toPass') walk(() => {
        pl.phase = 'put'
        pl.yawTo = Math.atan2(plating.at.x - pl.pos.x, plating.at.z - pl.pos.z)
      })
      else if (pl.phase === 'put' && pl.t > 0.5) {
        // (all of them set down, even with a plate or two put back on the stack meanwhile: none is ever lost)
        PLATING.stock += pl.n
        PLATING.coming = 0
        pl.n = 0
        pl.path = kitchenRoute(pl.pos, home())
        pl.len = pathLength(pl.path)
        pl.phase = 'home'
        pl.t = 0
      }
      // ---- the low rack by the table filled: a carry off the racks, across to it, set down on it
      else if (pl.phase === 'toRackLow') walk(() => { pl.phase = 'takeLow'; faceTo(rackTop(rackNow())) })
      else if (pl.phase === 'takeLow' && pl.t > 0.5) {
        pl.n = lowToBring(LOW_RACK.n, PLATE_RACK.n)
        PLATE_RACK.n -= pl.n
        LOW_RACK.coming = pl.n
        setOff(lowFront(), 'toLow')
      } else if (pl.phase === 'toLow') walk(() => { pl.phase = 'putLow'; faceTo(lowTop()) })
      else if (pl.phase === 'putLow' && pl.t > 0.5) {
        LOW_RACK.n += pl.n
        LOW_RACK.coming = 0
        pl.n = 0
        setOff(home(), 'home')
      } else if (pl.phase === 'home') walk(() => { pl.phase = 'settle' })
      else if (pl.phase === 'settle') {
        // (turned to face as they do at their place, then they're themselves again there: turned at once, they snapped round)
        const want = yawOfCrew()
        const turn = want === null ? 0 : Math.atan2(Math.sin(want - pl.yaw), Math.cos(want - pl.yaw))
        if (want !== null) pl.yawTo = want
        if (Math.abs(turn) < 0.03 || pl.t > 0.6) {
          if (want !== null) pl.yaw = pl.yawTo = want
          pl.phase = 'idle'
          away(false)
        }
      }
      else if (pl.phase === 'toSack') walk(() => { pl.phase = 'scoopRaw'; faceTo(sackSpots().at) })
      // ---- the iron skewers (game/skewers): the used tray's all picked up, washed at the sink, put back in the holder by the board
      else if (pl.phase === 'toSkTray') walk(() => { pl.phase = 'takeSk'; faceTo(inBar('skewer-tray', pl.pos)) })
      else if (pl.phase === 'takeSk' && pl.t > 0.6) {
        SKEWERS.s = pickUpDirty(SKEWERS.s)
        setOff(sinkFront(), 'toSkSink')
      } else if (pl.phase === 'toSkSink') walk(() => {
        pl.phase = 'washSk'
        SINK.washing = true
        faceTo(inBar('SinkBasinFloor', endOf(1)))
        if (plater) STAFF_TALK.push({ key: performance.now() + 0.7, id: plater.id, text: LINES[lang].skewerWash, until: performance.now() + 2400 })
      })
      else if (pl.phase === 'washSk' && pl.t > SKEWER_WASH_S) {
        SINK.washing = false
        soapPlate(); meterWater('dish')
        setOff(skHolderSpot(), 'toHolder')
      } else if (pl.phase === 'toHolder') walk(() => { pl.phase = 'putSk'; faceTo(inBar('skewer-holder', pl.pos)) })
      // (ringing someone up at the till (item 203): behind it, facing them, till they've paid; then home)
      else if (pl.phase === 'toTillBack') walk(() => { pl.phase = 'atTill'; tillCall.current.there = tillCall.current.who >= 0; faceTo(payOf(counters).spot) })
      else if (pl.phase === 'atTill') {
        const tc = tillCall.current
        if (tc.who >= 0 && !tc.there) tc.there = true
        if (tc.who < 0 && pl.t > 0.6) { tc.staff = -1; tc.there = false; setOff(home(), 'home') }
      }
      else if (pl.phase === 'putSk' && pl.t > 0.5) {
        SKEWERS.s = putBackClean(SKEWERS.s)
        rattleSound()
        setOff(home(), 'home')
      }
      else if (pl.phase === 'scoopRaw' && pl.t > SCOOP_S) {
        // (a pot's worth scooped into the bowl; back up onto the kitchen's floor and to the sink with it)
        const sk = sackSpots()
        pl.path = [pl.pos.clone(), sk.edge, ...kitchenRoute(sk.edge, sinkFront()).slice(1)]
        pl.len = pathLength(pl.path)
        pl.phase = 'toSink'
        pl.t = 0
      } else if (pl.phase === 'toSink') walk(() => { pl.phase = 'wash'; RICE.washing = true; faceTo(inBar('SinkBasinFloor', endOf(1))) })
      else if (pl.phase === 'wash' && pl.t > WASH_S) {
        // (washed, the water run off it, to the stove with it)
        RICE.washing = false
        meterWater('cooking', 20)
        setOff(kamaSpot(), 'toKama')
      } else if (pl.phase === 'toKama') walk(() => { pl.phase = 'load'; faceTo(kamaTop()) })
      else if (pl.phase === 'load' && pl.t > 0.8) {
        // (into the pot, its lid on, the fire under it: cooking, as much as was in stock)
        RICE.kama = setOn()
        RICE.batch = batchOf('Onigiri', RICE_FULL)
        setOff(home(), 'home')
      }
      else if (pl.phase === 'toShape') walk(() => { pl.phase = 'shape'; faceTo(prepBoard()) })
      else if (pl.phase === 'toGrate') walk(() => { pl.phase = 'grate'; const g = graterAt(); if (g) faceTo(g) })
      else if (pl.phase === 'grate' && (pl.t > GRATE_S || (FIRE_TEND.want && !FIRE_TEND.done) || SAKE.want.length)) setOff(home(), 'home')
      else if (pl.phase === 'shape' && pl.t > SHAPE_EACH) {
        // (one shaped, its rice out of the cooker, set on the tray; another while it wants more and nothing's called them, else back)
        const r = takeRice(RICE.rice, RICE.kama)
        RICE.rice = r.rice
        RICE.kama = r.kama
        ONIGIRI_TRAY.n = Math.min(TRAY_MAX, ONIGIRI_TRAY.n + 1)
        if (open && !SHOP.leaving && trayWants(ONIGIRI_TRAY.n, RICE.rice, RICE.kama) && !(FIRE_TEND.want && !FIRE_TEND.done) && !SAKE.want.length) pl.t = 0
        else setOff(home(), 'home')
      }
      // (the way they face turned to the way they're to face, by time (commuteWalk's turnEase): set at once, they snapped round, over a
      // hundred times a minute at double speed (item 242))
      if (pl.yawTo !== undefined) pl.yaw = pl.phase === 'idle' ? pl.yawTo : turnToward(pl.yaw, pl.yawTo, step)
      const o = platerObj.current
      if (o) {
        o.visible = pl.phase !== 'idle'
        o.position.copy(pl.pos)
        // (down on the genkan's stone where their way crosses it, item 203)
        o.position.y += genkanY(counters, pl.pos) + stoolLift(o, pl.pos, Math.min(dt, 0.1))
        o.rotation.y = pl.yaw
        // (never the idle fanning of a cook at his place: his hands are full with the work here; bent forward to it: well down to the
        // sack on the floor, over the bucket on the table and the hearth to tip the coals in or splash the water, a little over the crate and
        // the soup)
        o.userData.fetcher = true
        o.userData.fanNow = false
        const bend = (k: number) => Math.sin(Math.PI * Math.min(1, pl.t / k))
        o.userData.lean = pl.phase === 'liftSack' ? 0.5 * bend(0.8) : pl.phase === 'feedCoal' || pl.phase === 'sprinkle' || pl.phase === 'scoopWater' ? 0.32 * bend(0.8)
          : pl.phase === 'rake' ? 0.26 * bend(RAKE_S)
          : pl.phase === 'takeCoal' ? 0.18 * bend(0.6) : pl.phase === 'fillCrate' ? 0.22 * Math.sin(Math.PI * Math.max(0, Math.min(1, (pl.t - 0.2) / 0.7))) : pl.phase === 'stir' ? 0.14
          : pl.phase === 'shape' ? 0.12 : pl.phase === 'grate' ? 0.16 : pl.phase === 'pourSake' ? 0.06 : 0
        // (shaping a rice ball: both hands cupped round it before them, pressed together and turned, three presses to one (StaffFigure))
        o.userData.shape = pl.phase === 'shape' ? pl.t / SHAPE_EACH : undefined
        // (pouring the sake: both hands on the open bottle, a tokkuri, a cup, where the pour has them (item 177))
        o.userData.handsAt = pl.phase === 'pourSake' && SAKE_HANDS_ON.v ? SAKE_HANDS
          : (pl.phase === 'riceBowl' || pl.phase === 'soupBowl') && BOWL_HANDS_ON.v ? BOWL_HANDS
            : pl.phase === 'stir' && STIR_HANDS_ON.v ? STIR_HANDS : pl.phase === 'grate' && GRATE_ON.v ? GRATE_HANDS : undefined
        // (grating: the right hand with the daikon up and down the grater's length, pressed down on the way out, eased back; the left holding
        // the grater's near end; their places on the grater the world's (item 392))
        GRATE_ON.v = false
        GRATING.on = false
        if (pl.phase === 'grate') {
          const gm = markOf('prep-grater'), fr = frame.current
          if (gm && fr) {
            // (the daikon's cut end down the grater and up it again, pressed down going away from them, lifted a little coming back; held by
            // its top, slanted back toward them at 51 degrees over the grater (its 13 cm); the left hand on the grater's near end. In the
            // world, in the counter's own measure (S: its scale in the world), the daikon's: in the bar's, it came 10 cm short of the grater)
            const gW = gm.getWorldPosition(new THREE.Vector3()), S = gm.getWorldScale(new THREE.Vector3()).y
            const dir = gW.clone().sub(fr.localToWorld(pl.pos.clone())).setY(0).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x)
            const k = (pl.t * 1.7) % 1, out = k < 0.62 ? k / 0.62 : 1 - (k - 0.62) / 0.38
            const s0 = Math.min(1, pl.t / 0.4)
            GRATING.cut.copy(gW).addScaledVector(dir, (-0.04 + 0.08 * out) * s0 * S)
              .add(new THREE.Vector3(0, (k < 0.62 ? 0.002 : 0.012 * Math.sin(Math.PI * (k - 0.62) / 0.38)) * S, 0))
            GRATING.hand.copy(GRATING.cut).add(new THREE.Vector3(0, 0.101 * S, 0)).addScaledVector(dir, -0.082 * S).addScaledVector(side, -0.008 * S)
            GRATE_HANDS.right.copy(GRATING.hand)
            GRATE_HANDS.left.copy(gW).addScaledVector(dir, -0.085 * S).addScaledVector(side, 0.05 * S).add(new THREE.Vector3(0, 0.016 * S, 0))
            GRATE_ON.v = true
            GRATING.on = true
          }
        }
        // (up on the kitchen's dais)
        // (up on the kitchen's dais while they're over it: stepped down off it at the rice sack)
        if (KITCHEN_DROP < 0) {
          const d = pl.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
          if (a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]) o.position.y += -KITCHEN_DROP / scale
        }
      }
      // (what's in their hands is held at the height a server's tray is: as it's held up on the kitchen's dais, a step lower off it (their
      // figure's own place has the dais's height in it already, and what they held rode 16 cm over their hands))
      const heldBase = () => {
        const d = pl.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
        const on = a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]
        return pl.pos.clone().setY(pl.pos.y + (KITCHEN_DROP < 0 && !on ? KITCHEN_DROP / scale : 0))
      }
      // (the rice in its bowl in their hands: washing it, to the pot with it (going in at 'load'); scooped out of the pot, to the tub with it)
      const pb = platerBowl.current
      if (pb && o) {
        const holding = ['scoopRaw', 'toSink', 'wash', 'toKama', 'load'].includes(pl.phase)
        pb.visible = holding
        // (both hands out in front, holding it (or the plates))
        o.userData.carry = holding || (pl.n > 0 && pl.phase !== 'idle') || pl.phase === 'toBowlPass' || pl.phase === 'bowlPut'
          || (bowlJob.current?.by === 'plater' && (pl.phase === 'toSoupBowl'))
        if (holding) {
          const hands = heldBase().add(new THREE.Vector3(0, HELD_AT[1] * STAFF_SCALE + 0.02, HELD_AT[2] * STAFF_SCALE).applyAxisAngle(UP_Y, pl.yaw))
          // (swirled in the water as it's washed)
          if (pl.phase === 'wash') hands.add(new THREE.Vector3(Math.sin(pl.t * 9) * 0.02, -0.03, Math.cos(pl.t * 9) * 0.02))
          const k = pl.phase === 'load' ? Math.min(1, pl.t / 0.6) : pl.phase === 'scoopRaw' ? Math.min(1, pl.t / SCOOP_S) : 0
          const over = pl.phase === 'scoopRaw' ? inBar('RiceSackOpenSet', hands).setY(hands.y - 0.1) : kamaTop()
          pb.position.lerpVectors(hands, over, Math.sin(Math.PI * k) * 0.6)
          pb.rotation.z = pl.phase === 'load' ? Math.sin(Math.PI * k) * 1.1 : 0
          const rice = pb.getObjectByName('bowl-rice')
          if (rice) rice.scale.setScalar(pl.phase === 'load' ? Math.max(0.01, 1 - k) : pl.phase === 'scoopRaw' ? Math.max(0.01, k) : 1)
        }
      }
      // (the rice ball between their hands as they shape it, turned a little with each press; its nori wrapped on at the last)
      const ball = platerBall.current
      if (ball && o) {
        const on = pl.phase === 'shape'
        ball.visible = on
        if (on) {
          const k = pl.t / SHAPE_EACH
          ball.position.copy(heldBase()).add(new THREE.Vector3(0, (SHAPE_HAND.y + 0.03) * STAFF_SCALE, (SHAPE_HAND.z + 0.01) * STAFF_SCALE).applyAxisAngle(UP_Y, pl.yaw))
          ball.rotation.set(0, pl.yaw + Math.sin(k * Math.PI * 6) * 0.25, 0)
          const nori = ball.getObjectByName('ball-nori')
          if (nori) nori.visible = k > 0.75
        }
      }
      // (the bundle of skewers in their hands, from the tray to the holder; scrubbed to and fro at the sink)
      const sk = platerSkewers.current
      if (sk && o) {
        const has = pl.phase === 'toSkSink' || pl.phase === 'washSk' || pl.phase === 'toHolder' || pl.phase === 'putSk' || (pl.phase === 'takeSk' && pl.t > 0.3)
        sk.visible = has
        if (has) {
          o.userData.carry = true
          sk.position.copy(heldBase()).add(new THREE.Vector3(pl.phase === 'washSk' ? Math.sin(pl.t * 12) * 0.03 : 0, HELD_AT[1] * STAFF_SCALE + 0.02, HELD_AT[2] * STAFF_SCALE).applyAxisAngle(UP_Y, pl.yaw))
          sk.rotation.set(0, pl.yaw, 0)
        }
      }
      // (the charcoal in both hands, crate to hearth, tipped in; the dipper of water, bucket to hearth, splashed; the dipper stirring the soup)
      const pc = platerCoal.current, pd = platerDipper.current
      if (o && pc && pd) {
        // (where the hands are, bent forward with them (from the waist: drawn back as far as StaffFigure draws them, item 387))
        const hands = heldBase().add(new THREE.Vector3(0, HELD_AT[1] * STAFF_SCALE + 0.02, HELD_AT[2] * STAFF_SCALE)
          .applyAxisAngle(X_AXIS, o.userData.lean ?? 0).add(new THREE.Vector3(0, 0, (o.userData.leanBack ?? 0) * STAFF_SCALE)).applyAxisAngle(UP_Y, pl.yaw))
        const coal = (pl.phase === 'takeCoal' && pl.t > 0.3) || (pl.phase === 'toHearth' && pl.fire === 'coal') || pl.phase === 'feedCoal' || pl.phase === 'turnBack'
        // (an armful out of the sack, carried to the crate and set into it)
        const armful = (pl.phase === 'liftSack' && pl.t > 0.45) || pl.phase === 'toFill' || (pl.phase === 'fillCrate' && pl.t < 0.75)
        pc.visible = coal || armful
        if (coal) {
          o.userData.carry = true
          // (leant over and tipped in towards the coals)
          const k = pl.phase === 'feedCoal' ? Math.min(1, pl.t / 0.5) : 0
          pc.position.copy(hands).lerp(hearthAt().setY(hands.y), k * 0.35)
          pc.rotation.set(k * 1.2, pl.yaw, 0, 'YXZ')
          pc.scale.setScalar(pl.phase === 'feedCoal' && pl.t > 0.55 ? Math.max(0.01, 1 - (pl.t - 0.55) / 0.25) : 1)
        } else if (armful) {
          o.userData.carry = true
          // (bigger, held in both arms; lowered into the crate as it's filled)
          const k = pl.phase === 'fillCrate' ? Math.max(0, Math.min(1, (pl.t - 0.3) / 0.45)) : 0
          pc.position.copy(hands).lerp(crateAt().setY(hands.y - 0.08), k * 0.5)
          pc.rotation.set(0, pl.yaw, 0, 'YXZ')
          pc.scale.setScalar(1.7 * (pl.phase === 'fillCrate' && pl.t > 0.6 ? Math.max(0.01, 1 - (pl.t - 0.6) / 0.15) : 1))
        }
        const dip = (pl.phase === 'scoopWater' && pl.t > 0.3) || (pl.phase === 'toHearth' && pl.fire === 'water') || pl.phase === 'sprinkle' || pl.phase === 'stir'
        pd.visible = dip
        if (dip) {
          o.userData.carry = true
          let tip = 0, at = hands
          if (pl.phase === 'sprinkle') {
            // (a flick out over the hearth, the water thrown)
            const k = Math.min(1, pl.t / 0.6)
            at = hands.clone().lerp(hearthAt().setY(hands.y + 0.05), Math.sin(Math.PI * k) * 0.4)
            tip = Math.sin(Math.PI * k) * 1.4
          } else if (pl.phase === 'stir') {
            // (round and round in the pot: the dipper and the hands up over its near half, over the counter's top (item 387: at the hands' rest,
            // under the top, they went into the counter's front); the left on its rim)
            const W = soupFillAt(), fr = frame.current
            const over = W.top.clone().addScaledVector(W.face, -0.7 * W.r).setY((W.rimTop ?? W.top.y) + 0.06)
            const turn = new THREE.Vector3(Math.sin(pl.t * 5) * 0.04, 0, Math.cos(pl.t * 5) * 0.04)
            at = over.clone().lerp(W.top.clone().setY(over.y), 0.45).add(turn).add(new THREE.Vector3(0, -0.04, 0))
            tip = 0.6
            if (fr) {
              fr.localToWorld(STIR_HANDS.right.copy(over).add(turn))
              const nearR = W.rimR ? W.rimR(W.face.clone().negate()) : W.r
              fr.localToWorld(STIR_HANDS.left.copy(W.top).addScaledVector(W.face, -(nearR + 0.05)).addScaledVector(W.right, 0.12).setY((W.rimTop ?? W.top.y) + 0.01))
              STIR_HANDS_ON.v = true
            }
          }
          pd.position.copy(at)
          pd.rotation.set(tip, pl.yaw, 0, 'YXZ')
          const w = pd.getObjectByName('dipper-water')
          if (w) w.visible = pl.phase !== 'stir' && !(pl.phase === 'sprinkle' && pl.t > 0.35)
        }
      }
      // (the plates in their hands, out in front of them)
      const ps = platerStack.current
      if (ps && o) {
        ps.visible = pl.n > 0 && pl.phase !== 'idle'
        if (ps.visible) {
          const k = pl.phase === 'take' || pl.phase === 'takeLow' ? Math.min(1, pl.t / 0.4) : pl.phase === 'put' || pl.phase === 'putLow' ? 1 - Math.min(1, pl.t / 0.4) : 1
          const hands = heldBase().add(new THREE.Vector3(0, HELD_AT[1] * STAFF_SCALE + 0.02, HELD_AT[2] * STAFF_SCALE).applyAxisAngle(UP_Y, pl.yaw))
          const from = pl.phase === 'put' ? platingPlace(PLATE_STACK_ALONG).addScaledVector(plating.across, PLATE_STACK_ACROSS)
            : pl.phase === 'putLow' || (pl.phase === 'take' && pl.src === 'low') ? lowTop() : rackTop(rackNow())
          ps.position.lerpVectors(from, hands, k * k * (3 - 2 * k))
          ps.children.forEach((c, i) => { c.visible = i < pl.n })
        }
      }
    }

    // the servers, each by their duty (game/plates: one on the floor, one at the dishes; a lone one does both): what's plated at the plating place to
    // its customer; the plates done with, cleared to the sink, their sticks into the bin beside it; washed there into the dish dryer; dried,
    // back to the racks
    const nServers = waiters.current.length
    /** a server's walk in or out a step on: their place and facing, how much of them shows, their stretch and nod */
    const walkCommute = (o: THREE.Group, tr: Trip, w: { pos: THREE.Vector3; yaw: number }) => {
      const pose = tripStep(tr, Math.min(dt, 0.1), 1.1, (v) => (o.parent ? o.parent.localToWorld(v.clone()) : v.clone()))
      w.pos.copy(pose.p)
      if (pose.yaw !== null) w.yaw = turnToward(w.yaw, pose.yaw, Math.min(dt, 0.1))
      o.position.copy(w.pos)
      // (down on the genkan's stone crossing it, item 203; up on the sink's step stool over it, item 221)
      o.position.y += genkanY(counters, w.pos) + stoolLift(o, w.pos, Math.min(dt, 0.1))
      o.rotation.y = w.yaw
      ;(w as { look?: number }).look = w.yaw
      o.visible = pose.shown
      o.userData.fade = tr.done ? 1 : pose.vis
      o.userData.nod = pose.nod
      o.userData.stretch = pose.stretch
      if (KITCHEN_DROP < 0) {
        const d = w.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
        if (a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]) o.position.y += -KITCHEN_DROP / scale
      }
    }
    // takeaways (game/takeout): each order's customer in at the door to the genkan's edge, waiting there, and once their box is in their
    // hands out again; the box in a server's hands as they carry it out
    {
      const way = takeoutWay
      let changed = false
      for (const o of TAKEOUT.orders) {
        if (visitors.current.has(o.id) || o.handed) continue
        if (!way || !open) { if (o.ready) { o.taken = true; o.handed = true; o.gone = true } continue }
        const taken = new Set([...visitors.current.values()].filter((v) => v.phase !== 'out').map((v) => v.wait.distanceTo(way.wait) > 0.1 ? 1 : 0))
        // (a second one by the first, along toward the till (item 410: beside it, out toward the door, they stood in the sliding door))
        const wait = (taken.has(0) ? way.next : way.wait).clone()
        visitors.current.set(o.id, { id: o.id, rider: o.rider, order: o, phase: 'in', t: 0, fade: 0, fadeT: 0, pos: way.door.clone(), yaw: 0, wait })
        changed = true
      }
      for (const v of visitors.current.values()) {
        v.t += step
        const sp = SPEED * walkSpeedOf(kindOf(v.id).kind)
        if (!way || !open) { v.order.gone = true; visitors.current.delete(v.id); changed = true; continue }
        if (v.phase === 'in') {
          const len = way.door.distanceTo(v.wait), d = Math.min(len, v.t * sp)
          v.pos.lerpVectors(way.door, v.wait, len ? d / len : 1)
          v.yaw = Math.atan2(v.wait.x - way.door.x, v.wait.z - way.door.z)
          v.fade = Math.min(1, d / 0.6 + v.t / FADE_S)
          if (d >= len) { v.phase = 'wait'; v.t = 0 }
        } else if (v.phase === 'toTill' || v.phase === 'atTill') {
          // (called up by the cashier with their bag: along the genkan's edge to the till, as near as the genkan goes; there, their face to the till)
          v.fade = 1
          // (there, stood there: their time put back to nought on arriving, the walk from their place was walked again, from it (item 51:
          // up to the till, back a body's length at a step to where they'd waited, and up to the till again))
          const to = (v.till ??= tillSide(v.wait)), len = v.wait.distanceTo(to), d = v.phase === 'atTill' ? len : Math.min(len, v.t * sp)
          v.pos.lerpVectors(v.wait, to, len ? d / len : 1)
          if (v.phase === 'toTill') v.yaw = Math.atan2(to.x - v.wait.x, to.z - v.wait.z)
          if (d >= len && v.phase === 'toTill') { v.phase = 'atTill'; v.t = 0 }
          if (v.phase === 'atTill') { const at = cashierHands(0); v.yaw += Math.atan2(Math.sin(Math.atan2(at.x - v.pos.x, at.z - v.pos.z) - v.yaw), Math.cos(Math.atan2(at.x - v.pos.x, at.z - v.pos.z) - v.yaw)) * Math.min(1, step * 6) }
          if (v.order.handed) {
            v.wait = v.pos.clone()
            v.phase = 'out'; v.t = 0; changed = true
            onSay?.('guest', LINES[lang].payThanks(v.id, v.id + 1), v.id)
          }
        } else if (v.phase === 'wait' && v.order.gone && !v.order.handed) {
          // (given up waiting for it (Roasting's patience, item 203): off out of the door without it)
          v.wait = v.pos.clone()
          v.phase = 'out'; v.t = 0; changed = true
        } else if (v.phase === 'wait') {
          v.fade = 1
          // (turned to the step, where the box comes from)
          const yaw = Math.atan2(way.hand.x - v.pos.x, way.hand.z - v.pos.z)
          v.yaw += Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) * Math.min(1, step * 6)
          // (no one to bring it (no server, the owner busy with nothing to walk), the box is at the till for them a moment after it's packed)
          if (!waiters.current.length && v.order.ready && v.t > 1.5) { v.order.taken = true; v.order.handed = true }
          if (v.order.handed) {
            v.phase = 'out'; v.t = 0; changed = true
            onSay?.('guest', LINES[lang].payThanks(v.id, v.id + 1), v.id)
          }
        } else {
          // (back out of the door with it, fading on the last stretch, and no quicker than FADE_S)
          const len = v.wait.distanceTo(way.door), d = Math.min(len, v.t * sp)
          v.pos.lerpVectors(v.wait, way.door, len ? d / len : 1)
          v.yaw = Math.atan2(way.door.x - v.wait.x, way.door.z - v.wait.z)
          if (len - d < 0.9) v.fadeT += step
          v.fade = Math.max(0, Math.min(1, Math.max((len - d) / 0.9, 1 - v.fadeT / FADE_S)))
          if (d >= len && v.fade <= 0) { v.order.gone = true; visitors.current.delete(v.id); changed = true }
        }
        const g = visitorObjs.current.get(v.id)
        if (g) {
          g.position.copy(v.pos)
          g.position.y = genkanY(counters, v.pos)
          // (turned to the way they face a moment at a time: set at once, they spun round as they took their bag and went)
          g.rotation.y = turnToward(g.rotation.y, v.yaw, step * 1.5)
        }
      }
      // (the stand: with the cashier at the till, the first bag on it whose customer's waiting turned round for, taken up, turned back with and held
      // out over the till to them, called up to it; no cashier, what's on it given out at once)
      {
        const S = TAKEOUT_STAND
        if (!cashierIn()) {
          for (const id of S.bags) { const v = visitors.current.get(id); if (v) v.order.handed = true }
          if (S.handing) { const v = visitors.current.get(S.handing.id); if (v) v.order.handed = true }
          S.bags = []; S.handing = null; S.turn = 0; S.carry = false
        } else {
          // (not while someone's paying at the till (item 203: she turned round for a bag in the middle of ringing someone up, the drawer open
          // behind her))
          if (!S.handing && TILL_STATE.k < 0) {
            const id = S.bags.find((x) => visitors.current.get(x)?.phase === 'wait')
            if (id !== undefined) { S.handing = { id, t: 0 }; S.bags = S.bags.filter((x) => x !== id) }
          }
          // (one whose customer's gone meanwhile (the shop shut): off the stand)
          S.bags = S.bags.filter((x) => visitors.current.has(x))
          const h = S.handing
          if (h) {
            const v = visitors.current.get(h.id)
            h.t += step
            if (!v) { S.handing = null; S.turn = 0; S.carry = false }
            else {
              S.turn = h.t < STAND_TURN ? h.t / STAND_TURN : h.t < STAND_TURN + STAND_LIFT ? 1 : Math.max(0, 1 - (h.t - STAND_TURN - STAND_LIFT) / STAND_TURN)
              S.carry = h.t > STAND_TURN
              if (v.phase === 'wait' && h.t > STAND_TURN) { v.phase = 'toTill'; v.t = 0 }
              // (turned back and holding it out, the customer there: over the till into their hands)
              if (S.turn === 0 && v.phase === 'atTill' && h.t > STAND_TURN * 2 + STAND_LIFT + STAND_GIVE) {
                v.order.handed = true
                S.handing = null; S.carry = false
              }
            }
          }
        }
        // (the bags: those on the stand in a row on its top; the one handed over from its place there into the cashier's hands, held, and over
        // the till to the customer's)
        const top = standTop.current, fb = frame.current
        standBags.current.forEach((b, k) => { if (b) b.visible = k < S.bags.length })
        const hb = handBag.current
        if (hb) {
          hb.visible = !!S.handing && !!top && !!fb
          if (S.handing && top && fb) {
            const t = S.handing.t, v = visitors.current.get(S.handing.id)
            const from = fb.worldToLocal(top.getWorldPosition(new THREE.Vector3()))
            const held = cashierHands(S.turn)
            const k = THREE.MathUtils.clamp((t - STAND_TURN) / STAND_LIFT, 0, 1)
            hb.position.lerpVectors(from, held, k * k * (3 - 2 * k))
            const give = THREE.MathUtils.clamp((t - STAND_TURN * 2 - STAND_LIFT) / STAND_GIVE, 0, 1)
            if (give > 0 && v?.phase === 'atTill') {
              const to = v.pos.clone().setY(held.y)
              hb.position.lerpVectors(held, to, give * 0.6).y += Math.sin(Math.PI * give) * 0.06
            }
            hb.rotation.y = STAND_AT.yaw + S.turn * Math.PI * 0.8
          }
        }
      }
      if (changed) setVisitorList([...visitors.current.values()].map((v) => ({ id: v.id, rider: v.rider, has: v.phase === 'out' })))
      // (the bench: in to a free place on it and sat down; called to a stool, handed over where they sit; given up, out of the door)
      let benchChanged = false
      if (way) {
        for (const id of BENCH.ids) {
          if (sitters.current.has(id)) continue
          // (a place no one's sat in or on their way to: those going out are up off theirs, and with every place counted (the bench full, one
          // going) the next in was sat on the first, on someone's lap (item 411); one just called away is still sat there till they're on
          // their way to their stool (a frame or two): theirs only if there's no other)
          const places = Array.from({ length: BENCH_SEATS }, (_, k) => k), on = [...sitters.current.values()].filter((x) => x.phase !== 'out')
          const taken = new Set(on.map((x) => x.spot)), held = new Set(on.filter((x) => !x.handed).map((x) => x.spot))
          const free = places.findIndex((k) => !taken.has(k)), spot = Math.max(0, free >= 0 ? free : places.findIndex((k) => !held.has(k)))
          sitters.current.set(id, { id, phase: 'in', t: 0, fade: 0, fadeT: 0, pos: way.door.clone(), yaw: 0, spot })
          benchChanged = true
        }
      }
      for (const v of sitters.current.values()) {
        v.t += step
        const sp = SPEED * walkSpeedOf(kindOf(v.id).kind)
        // (its place on the bench where the bench is now, moved by hand or not)
        // (the marks not there for a frame (the bench put back as the shop shuts): their place as last found, not the bench's place as laid
        // before it was moved, a step off (the day's audit, 2026-11-15: one on the bench 0.84 across in a frame at 04:01))
        const laid = way?.benchSpots[v.spot], bm = BENCH_MARKS.get(v.spot), fb = frame.current
        const found = !!(laid && bm && fb)
        if (found) v.at = (v.at ?? new THREE.Vector3()).copy(fb!.worldToLocal(bm!.getWorldPosition(BENCH_AT[v.spot])))
        const at = v.at ?? laid
        if (!way || !at) { sitters.current.delete(v.id); benchChanged = true; continue }
        // (which way the bench faces, as it stands now: across its row of places, away from the wall; and a step out in front of their place, the
        // way to it and from it bending there, clear of the shoe cupboard by the wall)
        // (the bench their place is on: its first place and its last)
        const b0 = v.spot - (v.spot % BENCH_EACH), m0 = BENCH_MARKS.get(b0), m1 = BENCH_MARKS.get(b0 + BENCH_EACH - 1)
        if (m0 && m1 && fb) {
          fb.worldToLocal(m0.getWorldPosition(BENCH_A)); fb.worldToLocal(m1.getWorldPosition(BENCH_B)); BENCH_B.sub(BENCH_A)
          BENCH_B.set(-BENCH_B.z, 0, BENCH_B.x).normalize()
          v.face = (v.face ?? new THREE.Vector3()).copy(BENCH_B)
        } else if (v.face) BENCH_B.copy(v.face)
        // (never found yet: across the bench as it's laid, its yaw turned a quarter)
        else BENCH_B.set(Math.sin(BENCH_PLACE.yaw), 0, Math.cos(BENCH_PLACE.yaw))
        const before = at.clone().addScaledVector(BENCH_B, 0.42)
        // (in by way of where their pair's to stand: stopped on it, out of their shoes, and up the step (item 412))
        if (v.phase === 'in' && !v.shoeAt) v.shoeAt = shoeSpotOf(v.spot, [way.door, before, at]) ?? undefined
        const walk = v.shoeAt ? [way.door, v.shoeAt, before, at] : [way.door, before, at]
        if (BENCH.up.has(v.id)) {
          // (called: up off the bench and on in to their stool from here (setShown's way in starts where they sat))
          BENCH.up.delete(v.id)
          benchFrom.current.set(v.id, v.pos.clone())
          // (their shoes off the stone into the cubby of the place they're called to, put away for them (item 203))
          const seat = guestsNow.current.find((x) => x.id === v.id)?.seat
          if (v.shoes && seat !== undefined) { SHOE_CELLS.shoes.set(seat % SHOE_CUBBIES, SHOE_COLOURS[v.id % 5]); benchShoesIn.current.add(v.id) }
          v.shoes = undefined
          v.handed = true; v.t = 0
        }
        // (kept, sat as they were, till the one walking in to the stool is there in their place: let go at once, there was a frame or two of
        // no one on the bench between)
        if (v.handed) {
          if (shownRef.current.some((x) => x.id === v.id) || v.t > 3) { sitters.current.delete(v.id); benchChanged = true }
          continue
        }
        // (sat there, or on their way to it, on none of the bench's lists (its list made afresh under them: a live update of the code, or lost),
        // or the shop shutting or past its last call: sent out, not left sat there for good (item 328, the owner's, 2026-11-18: 「還一堆客人坐著?」:
        // six still sat on the benches the next day, the shop kept from shutting by them till its last minute))
        if ((v.phase === 'sit' || v.phase === 'in') && !BENCH.gone.has(v.id) && !BENCH.up.has(v.id) &&
          (!BENCH.ids.includes(v.id) || SHOP.closing || LAST_CALL.on)) {
          BENCH.ids = BENCH.ids.filter((x) => x !== v.id)
          BENCH.since.delete(v.id)
          BENCH.gone.add(v.id)
        }
        // (sent away still on their way in: out from where they are, not from the place they never reached (the day's audit, 2026-11-15: one
        // 2.22 across in a frame at 04:01, the shop shutting, back to their place on the bench and out from there))
        if (BENCH.gone.has(v.id) && v.phase !== 'out') {
          // (back the way they came: round the corner in front of the bench again if they'd passed it)
          // (how far in they'd got, the stop at their pair as it went; past the corner in front of the bench or not)
          if (v.phase === 'in') {
            v.outFrom = v.pos.clone()
            const got = Math.min(pathLength(walk), withPause(v.t * sp, v.stepIn ?? 0, SHOE_OFF_S * sp))
            v.outVia = got > pathLength(walk.slice(0, walk.length - 1))
          }
          v.phase = 'out'; v.t = 0; v.fadeT = 0
        }
        if (v.phase === 'in') {
          // (stopped at the genkan's step a moment, out of their shoes and up onto the boards in their socks, the pair left on the stone toes out
          // (item 203: the bench is on the room's boards))
          const len = pathLength(walk), hold = SHOE_OFF_S * sp, at0 = (v.stepIn ??= v.shoeAt ? way.door.distanceTo(v.shoeAt) : stepAt(walk)), raw = v.t * sp
          const d = Math.min(len, withPause(raw, at0, hold)), { p, dir } = alongPath(walk, d)
          v.bow = at0 > 0 && raw >= at0 && raw < at0 + hold ? (raw - at0) / hold : -1
          if (at0 > 0 && raw >= at0 + hold * 0.55 && !v.shoes) {
            // (the pair left where they stood, toes out, in their place in the row)
            const spot = v.shoeAt ?? shoeSpotOf(v.spot, walk), r = shoeRow.current
            if (spot) v.shoes = { at: spot.clone().setY(0), yaw: r ? Math.atan2(r.toes.x, r.toes.z) : v.yaw + Math.PI }
          }
          v.pos.copy(p)
          v.yaw = turnSmooth(v.yaw, Math.atan2(dir.x, dir.z), Math.min(step, 0.1))
          v.fade = Math.min(1, d / 0.6 + v.t / FADE_S)
          if (raw >= len + hold) { v.phase = 'sit'; v.t = 0; v.bow = -1; benchChanged = true }
        } else if (v.phase === 'sit') {
          v.fade = 1
          v.pos.copy(at)
          // (sat facing into the room, their back to the wall)
          const yaw = Math.atan2(BENCH_B.x, BENCH_B.z)
          v.yaw += Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw)) * Math.min(1, step * 6)
        } else {
          // (going: down onto the stone to their own pair, a moment there stepping back into them, and out of the door (item 412: they stopped
          // at the step's edge, the pair a stride off going from the row); with none down there (never got out of them), straight out)
          if (v.outShoe === undefined) v.outShoe = v.shoes ? v.shoes.at.clone().setY(0) : null
          const sh = v.outShoe
          const back = v.outFrom ? [v.outFrom, ...(v.outVia ? [before] : []), ...(sh ? [sh] : []), way.door] : [at, before, ...(sh ? [sh] : []), way.door]
          const len0 = pathLength(back)
          v.stepOut ??= sh ? pathLength(back.slice(0, back.length - 1)) : len0
          const on = v.stepOut
          const hold = (v.outHold ??= sh ? SHOE_OFF_S * sp : 0), raw = v.t * sp, len = len0 + hold
          const d = Math.min(len0, withPause(raw, on, hold)), { p, dir } = alongPath(back, d)
          v.bow = hold > 0 && raw >= on && raw < on + hold ? (raw - on) / hold : -1
          if (v.shoes && raw >= on + hold * 0.55) v.shoes = undefined
          v.pos.copy(p)
          v.yaw = turnSmooth(v.yaw, Math.atan2(dir.x, dir.z), Math.min(step, 0.1))
          if (len - raw < 0.9) v.fadeT += step
          v.fade = Math.max(0, Math.min(1, Math.max((len - raw) / 0.9, 1 - v.fadeT / FADE_S)))
          if (raw >= len && v.fade <= 0) { BENCH.gone.delete(v.id); sitters.current.delete(v.id); benchChanged = true }
        }
        const g = sitterObjs.current.get(v.id)
        if (g) {
          g.position.copy(v.pos)
          // (and as far aside as they've stepped for whoever they're passing (the crowd's, above, from where they were drawn last frame); sat
          // down, what's left of it eases back to nothing there, not snapped away)
          const off = aside.current.get(SITTER_KEY - v.id)
          if (off) { g.position.x += off.x; g.position.z += off.z }
          g.position.y = genkanY(counters, v.pos)
          // (shown once they're where they are: put in the scene between this and the frame's drawing, they were drawn a frame at the
          // bar's middle first, a flash there as each came (item 242))
          if (!placedOnce.has(g)) { placedOnce.add(g); g.visible = true; g.rotation.y = v.yaw }
          // (and those on the bench as they sit down, get up and go)
          g.rotation.y = turnToward(g.rotation.y, v.yaw, step * 1.5)
          // (a little bow at the step, down to their shoes)
          g.rotation.x = v.bow !== undefined && v.bow >= 0 ? 0.16 * Math.sin(Math.PI * v.bow) : 0
        }
      }
      if (benchChanged) setSitterList([...sitters.current.values()].map((v) => ({ id: v.id, sat: v.phase === 'sit' })))
      waiters.current.forEach((w, wi) => {
        const b = waiterBoxes.current[wi]
        if (!b) return
        b.visible = w.phase === 'toTill' || w.phase === 'hand' || w.phase === 'toStand' || w.phase === 'standPut'
        if (b.visible) {
          // (on their tray, where a plate rides (trayAt, below): up on the kitchen's dais as it's held, a step lower off it; it was 2 cm into
          // the tray and never came down off the dais)
          const d = w.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
          const onDais = a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]
          b.position.copy(w.pos).add(new THREE.Vector3(...HELD_AT).setY(HELD_AT[1] + 0.02).multiplyScalar(STAFF_SCALE).applyAxisAngle(UP_Y, w.look ?? w.yaw))
          // (not down into the genkan with the step's edge under them: they stand on the step up, the room's floor, as they hand it over)
          if (KITCHEN_DROP < 0 && !onDais) b.position.y += KITCHEN_DROP / scale
          b.rotation.y = w.look ?? w.yaw
        }
      })
    }
    // (glass broken on the floor whose sweeper's no longer on it (gone home, let go): free for the next)
    for (const sp of SPILLS.list) {
      const by = sp.by === null ? null : waiters.current[sp.by]
      if (sp.by !== null && (!by || by.spill !== sp.key || (by.phase !== 'sweepGo' && by.phase !== 'sweep' && by.phase !== 'wipeFloor'))) sp.by = null
    }
    waiters.current.forEach((w, wi) => {
      const home = homeOf(wi)
      // (coming in as the shop opens: in at the front door, along the aisle and through their gate to their place, each at their own
      // moment, unseen before it; no work till they're there)
      if (!ownerServes && !w.arrived) {
        const o = waiterObjs.current[wi], id = servers[wi]?.id ?? `server${wi}`
        if (!w.in) {
          if (o && performance.now() - SHOP.openedAt < 4000) {
            const way = [home.at.clone(), ...home.way.slice(1).map((v) => v.clone()), ...(home.counter ? [aisleCorner(counters[home.counter])] : []), doorOf(counters)]
            way.push(...doorOutOf(counters))
            w.in = makeTrip(id, 'in', way.reverse(), delayOf(id, SHOP.day + 0.5) * 0.8 + 0.8, paceOf(id))
          } else { w.arrived = true; clockIn(id, minutesNow()) }
        }
        if (w.in && o) {
          walkCommute(o, w.in, w)
          if (!w.in.done) return
          w.in = undefined
          w.arrived = true
          w.pos.copy(home.at)
          w.yaw = home.yaw
        }
      }
      // (nothing to do just now, or at something: for how they tire (game/shopState's STAFF_IDLE, data/staff's activityOf))
      if (!ownerServes) idleTick(servers[wi]?.id, w.phase === 'idle' && w.run === null && !SHOP.leaving, dt)
      const duty = ownerServes ? 'all' : dutyOf(wi, nServers)
      // (the tray at their hands wherever they are: its height is as it's held standing up on the kitchen's dais, so down on the customers'
      // floor it comes down the dais's step with them (it stayed up, a plate riding 14 cm over their hands out on the floor))
      const rise = KITCHEN_DROP < 0 ? -KITCHEN_DROP / scale : 0
      const onDais = () => {
        const d = w.pos.clone().sub(counters[0].at), a = d.dot(counters[0].along), l = d.dot(counters[0].lay)
        return a > kitchen.along[0] && a < kitchen.along[1] && l > kitchen.lay[0] && l < kitchen.lay[1]
      }
      const trayAt = () => w.pos.clone().add(new THREE.Vector3(...HELD_AT).setY(HELD_AT[1] + 0.02).multiplyScalar(STAFF_SCALE)
        .applyAxisAngle(UP_Y, w.look ?? w.yaw)).add(new THREE.Vector3(0, onDais() ? 0 : -rise, 0))
      const run = () => runs.current.find((x) => x.key === w.run)
      // (their way bent in past what stands out from the first counter's wall (item 387: aisleSqueeze); the way back's walked from its end,
      // where they are: bent from there)
      const go = (path: THREE.Vector3[], phase: WaiterPhase) => {
        const c0 = counters[0], line = -aisleOf(c0)
        const zones = stoolLine && wallKeep.current.boxes.length ? aisleSqueeze(wallKeep.current.boxes, line, stoolLine.back, SERVER_HALF) : []
        const back = phase === 'back'
        const bent = squeezePath(back ? [...path].reverse() : path, c0, line, zones)
        w.path = back && bent !== path ? bent.reverse() : bent; w.len = pathLength(w.path); w.phase = phase; w.t = 0
      }
      const walk = (then: () => void) => {
        // (from a standstill they pick up their pace over the first fifth of a second, not off at full speed at once (item 183, the owner's:
        // "the staff are far too stiff"))
        const d = rampedAlong(w.t, w.len)
        const { p, dir } = alongPath(w.path, d)
        w.pos.copy(p)
        if (dir.x || dir.z) w.yaw = Math.atan2(dir.x, dir.z)
        if (d >= w.len) { w.t = 0; then() }
      }
      const face = (at: THREE.Vector3) => { w.yaw = Math.atan2(at.x - w.pos.x, at.z - w.pos.z) }
      w.t += step * paceOfStaff(servers[wi]?.id)
      // (the customer gone meanwhile: what was being carried to them put down, and the server goes back)
      if ((w.phase === 'fetch' || w.phase === 'pickup' || w.phase === 'go' || w.phase === 'set' || w.phase === 'toBowlWith' || w.phase === 'bowlWith') && !sitting(w.seat)) {
        passQ.current = passQ.current.filter((b) => !(b.server === wi && b.with))
        for (const k of w.keys) {
          SERVICE.carried.delete(k)
          SERVICE.claimed.delete(k)
        }
        w.keys = []
        const r = run()
        // (a plate carried for them and never eaten off: back on the plating place's stack, or the racks with that full)
        if (r && r.phase === 'carry') {
          runs.current = runs.current.filter((x) => x !== r)
          if (PLATING.stock < STACK_CAP) PLATING.stock += 1
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
      /** (item 207) what a server's filled themself, on their tray at once (no counter between), and the filling done */
      const trayFilled = (j: BowlJob) => {
        passQ.current.push({ guest: j.guest, seat: j.seat, rice: j.rice, soup: j.soup, row: -1, server: wi, up: 1, down: 0, wait: 0 })
        bowlJob.current = null
      }
      /** (item 207) customers' bowls waiting at the counter taken out: the oldest set, and one more for a seat at the same counter on the same
       * tray; over to the counter for them. Whether they went */
      const takeBowls = () => {
        const waiting = passQ.current.filter((b) => b.server === undefined && guestSits(b.guest, b.seat)).sort((a, b) => b.wait - a.wait)
        if (!waiting.length) return false
        const first = waiting[0], c = seats[first.seat]?.counter
        const more = waiting.filter((b) => b !== first && seats[b.seat]?.counter === c).slice(0, TRAY_SETS - 1)
        for (const b of [first, ...more]) b.server = wi
        const to = passSpot(), path = kitchenRoute(w.pos, to)
        if (!path.length || path[path.length - 1].distanceTo(to) > 0.02) path.push(to.clone())
        go(path, 'toBowlPass')
        return true
      }
      if (w.phase === 'idle') {
        // (looked about every quarter of a second, not every frame; the owner serving with no server hired: not while he's off washing up
        // (item 216))
        if (w.t >= 0.25 && !(ownerServes && !ownerFree('serve'))) {
          w.t = 0
          // (not at their place: the day's first moment, stood where it was before the kitchen's floor was looked at (in the miso pot): over to it)
          if (open && !SHOP.leaving && Math.hypot(w.pos.x - home.at.x, w.pos.z - home.at.z) > 0.05) { go(kitchenRoute(home.at, w.pos), 'back'); return }
          // (a takeaway's box packed and its customer waiting for it in the genkan: out to them with it before anything else, no one
          // else's on the way with it)
          const box = takeoutWay && !SHOP.leaving ? TAKEOUT.orders.find((o) => o.ready && !o.taken && !boxClaimed.current.has(o.id) &&
            visitors.current.get(o.id)?.phase === 'wait') : undefined
          if (box && (duty !== 'dish' || nServers < 2)) {
            boxClaimed.current.add(box.id)
            w.box = box.id
            // (from the serving counter, once it's there (item 167): to its front; else the plating place, as before)
            go(SERVE_COUNTER.out ? kitchenRoute(homeOf(wi).at, SERVE_COUNTER.out) : fetchPath(wi), 'toBox')
            return
          }
          // (a customer's food set out at the plating place, ready, or their bowls of rice and soup waiting at the counter: whichever's waited
          // the longer carried out first, by either server, before a tokkuri or anything of their own (item 207: the bowls first, and the floor's
          // server went from them to the sake and back while the food done off the fire waited at the plating place a quarter of an hour, as
          // long as three quarters; the food first always, and in a rush the bowls were never taken: three of twenty-one who'd asked for rice
          // had it, one of ten their soup))
          const ready = SHOP.leaving ? -1 : readySlot()
          const bowlsWait = SHOP.leaving || !STATION_OBJ.group ? -1
            : passQ.current.reduce((m, b) => (b.server === undefined && guestSits(b.guest, b.seat) ? Math.max(m, b.wait) : m), -1)
          // (the food first, as long as the bowls haven't waited BOWLS_LATE: a calm evening's food waited behind the bowls (item 207))
          if (bowlsWait >= 0 && (ready < 0 || (bowlsWait >= BOWLS_LATE && bowlsWait > readyFor.current[ready])) && takeBowls()) return
          if (ready >= 0) {
            w.slot = ready
            w.seat = PLATING.slots[ready]!.seat
            go(fetchPath(wi), 'fetch')
            return
          }
          // (a customer's rice and soup waiting at the serving counter (items 205, 206): over for them and out to them on the tray; with no one
          // in the kitchen to fill them (the owner serving it all), filled by the server, at the cooker and the pot, and taken straight out)
          if (STATION_OBJ.group && !SHOP.leaving && (duty !== 'dish' || nServers < 2)) {
            const j = bowlJob.current
            if (!j && open && (!given || ownerServes) && BOWLS.want.length) {
              const b = nextBowls()
              if (b) {
                bowlJob.current = { ...b, by: wi, server: wi, stage: b.rice ? 'rice' : 'soup', t: 0, riceFill: 0, soupFill: 0, W: null }
                const to = b.rice ? riceStand() : soupFillAt().stand, path = kitchenRoute(w.pos, to)
                if (!path.length || path[path.length - 1].distanceTo(to) > 0.02) path.push(to.clone())
                go(path, b.rice ? 'toRiceFill' : 'toSoupFill')
                return
              }
            }
          }
          // (a customer's tokkuri poured and waiting at the sake station (item 177): over for it, no one else on it, and out to them with it on
          // the tray; with no plater to pour it, poured by the server themself first)
          if (STATION_OBJ.group && !SHOP.leaving && (duty !== 'dish' || nServers < 2)) {
            let j = sakeJob.current
            if (!j && open && (!given || ownerServes) && SAKE.want.length) {
              const guest = SAKE.want.shift()!, seat = guestSeat(guest)
              if (seat < 0) SAKE.want.push(guest)
              else { j = sakeJob.current = { guest, seat, pourer: wi, t: -1, server: wi }; sakeSpots.current.delete(seat); sakeSpotOf(seat) }
            }
            if (j && ((j.pourer === wi && j.t < 0) || (j.server === undefined && j.t >= POUR_TOTAL && guestSits(j.guest, j.seat)))) {
              j.server = wi
              const to = stationSpot(), path = kitchenRoute(w.pos, to)
              if (!path.length || path[path.length - 1].distanceTo(to) > 0.02) path.push(to.clone())
              go(path, 'toSakePass')
              return
            }
          }
          const slot = readySlot()
          // (glass broken on the floor (game/spills; the owner's): a floor server with no plate ready to carry out goes with a broom and sweeps
          // it up, no one else on it)
          const spill = !SHOP.leaving && sweeps(duty, slot >= 0) ? SPILLS.list.find((x) => x.by === null) : undefined
          const toSpill = spill ? spillPath(wi, spill) : null
          if (spill && toSpill) {
            spill.by = wi
            w.spill = spill.key
            w.broom = true
            go(toSpill, 'sweepGo')
            return
          }
          const spoken = new Set(waiters.current.flatMap((x) => x.carry ?? []))
          const dirtyNow = runs.current.filter((r) => r.phase === 'dirty' && !spoken.has(r.key))
          // (the sink and the dryer one server's at a time)
          const atSink = waiters.current.some((x) => x !== w && (x.phase === 'washGo' || x.phase === 'wash' || x.phase === 'unloadGo' || x.phase === 'unloadTake'
            || x.phase === 'handGo' || x.phase === 'handwash' || x.phase === 'basketGo' || x.phase === 'basketTake' || x.phase === 'skSinkGo' || x.phase === 'skWash'))
          // (the used skewers due a wash and no one on it already)
          const skewersDue = washGoes(SKEWERS.s) && !atSink && !waiters.current.some((x) => SK_PHASES.has(x.phase)) && !['toSkTray', 'takeSk', 'toSkSink', 'washSk', 'toHolder', 'putSk'].includes(platerRun.current.phase)
          // (the shop shut and going home: nothing new taken on; what's left is put away overnight with the closing)
          // (the player's washing up handed to the owner while he serves the floor himself (item 166): his next chore, once there's nothing
          // ready to carry out; the counter's stack in with the rest)
          const asked = open && ownerServes && HAND_WASH.ask === 'wash' && slot < 0 && dirty.current > 0 && !SHOP.leaving
          if (asked) { HAND_WASH.ask = null; PILE.n = 0 }
          // (someone waiting at the till with no cashier: round to the back of it to ring them up, before anything else (item 203))
          const tc = tillCall.current
          if (tc.who >= 0 && tc.staff < 0 && !cashierIn() && given) {
            tc.staff = wi
            const st = standSpots(), to = tillStaffSpot()
            const path = [...kitchenRoute(home.at, st.edge), to]
            path[0] = w.pos.clone()
            go(path, 'tillGo')
            return
          }
          const chore = SHOP.leaving ? null : asked ? 'handwash' : nextChore({ duty, serve: slot >= 0, dirty: dirtyNow.length, sink: atSink ? 0 : staffSink(dirty.current, PILE.n), rack: PLATE_RACK.n,
            // (the draining basket left as it is till the shop opens (the owner, 2026-11-15: "four clean ones in the basket to start, right?":
            // the day's first four, dry already, were carried off to the racks the moment the page came up, the basket bare); the player may)
            dryer: atSink ? { n: 0, left: null } : DRYER, drain: atSink || !open ? { n: 0, left: null } : DRAIN, skewers: skewersDue && (washUrgent(SKEWERS.s) ? 'urgent' : true),
            dirtyAge: dirtyNow.reduce((m, r) => Math.max(m, r.t), 0) })
          if (chore === 'serve') {
            // (across the kitchen to the chef for it)
            w.slot = slot
            w.seat = PLATING.slots[slot]!.seat
            go(fetchPath(wi), 'fetch')
          } else if (chore === 'clear') {
            // (out through their gate to the dirty plates, the longest waiting first and up to two more at that counter, nearest first)
            // (the longest left first: the list is in the order they were set, not left)
            const first = dirtyNow.reduce((a, r) => (r.t > a.t ? r : a), dirtyNow[0])
            const c = seats[first.seat].counter
            const more = dirtyNow.filter((r) => r !== first && seats[r.seat].counter === c)
              .sort((a, b) => seats[a.seat].mid.distanceTo(seats[first.seat].mid) - seats[b.seat].mid.distanceTo(seats[first.seat].mid)).slice(0, 2)
            w.carry = [first.key, ...more.map((r) => r.key)]
            w.seat = first.seat
            go(backPath(wi, first.seat), 'clearGo')
          } else if (chore === 'wash' || chore === 'unload' || chore === 'handwash' || chore === 'unbasket') {
            // (across the kitchen to the sink: to wash what's in it into the washer under it (or by hand into the draining basket while the washer's
            // busy: the owner's, 2026-11-10), or to take the washer's clean plates, or the basket's dry ones, back to the racks)
            go(kitchenRoute(home.at, sinkFront()), chore === 'wash' ? 'washGo' : chore === 'unload' ? 'unloadGo' : chore === 'handwash' ? 'handGo' : 'basketGo')
          } else if (chore === 'skewers') {
            // (across the kitchen to the used skewers' bucket on the cook table's front, all of them out of it, to the sink with them)
            go(kitchenRoute(home.at, skewerSpot('skewer-tray', home.at)), 'skTrayGo')
          }
        }
      } else if (w.phase === 'fetch') walk(() => { w.phase = 'pickup'; face(plating.at) })
      // ---- ringing up at the till with no cashier (item 203): behind it facing the customer, the register theirs till the customer's paid
      else if (w.phase === 'tillGo') walk(() => {
        w.phase = 'tillAt'
        const tc = tillCall.current
        tc.there = tc.who >= 0
        face(payOf(counters).spot)
      })
      else if (w.phase === 'tillAt') {
        const tc = tillCall.current
        if (tc.who >= 0 && !tc.there) tc.there = true
        // (paid and gone, or no one waiting any more: back the way they came)
        if (tc.who < 0 && w.t > 0.6) {
          tc.staff = -1
          tc.there = false
          const st = standSpots()
          go([...kitchenRoute(home.at, st.edge), w.pos.clone()], 'back')
        }
      }
      // ---- the iron skewers (game/skewers): the used bucket emptied into their hands, washed at the sink, put back in the clean ones' bucket
      else if (w.phase === 'skTrayGo') walk(() => { w.phase = 'skTake'; face(inBar('skewer-tray', w.pos)) })
      else if (w.phase === 'skTake' && w.t > 0.6) { SKEWERS.s = pickUpDirty(SKEWERS.s); go(kitchenRoute(w.pos, sinkFront()), 'skSinkGo') }
      else if (w.phase === 'skSinkGo') walk(() => {
        w.phase = 'skWash'
        face(inBar('SinkBasinFloor', endOf(1)))
        const id = ownerServes ? 'owner' : servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + 0.7 + wi, id, text: LINES[lang].skewerWash, until: performance.now() + 2400 })
      })
      else if (w.phase === 'skWash' && w.t > SKEWER_WASH_S) { soapPlate(); meterWater('dish'); go(kitchenRoute(w.pos, skewerSpot('skewer-holder', w.pos)), 'skHolderGo') }
      else if (w.phase === 'skHolderGo') walk(() => { w.phase = 'skPut'; face(inBar('skewer-holder', w.pos)) })
      // ('back' walks its way from its end to its start, so it's given from their place to where they are, as every other way back is: given the
      // other way round, they were at their place the moment they set off, walked back out to the holder and were at their place again)
      else if (w.phase === 'skPut' && w.t > 0.5) { SKEWERS.s = putBackClean(SKEWERS.s); rattleSound(); go(kitchenRoute(home.at, w.pos), 'back') }
      else if (w.phase === 'sweepGo') walk(() => {
        // (at the broken glass: facing it, broom down, a word to the room)
        w.phase = 'sweep'
        const sp = SPILLS.list.find((x) => x.key === w.spill)
        if (sp && frame.current) face(frame.current.worldToLocal(new THREE.Vector3(sp.at[0], sp.at[1], sp.at[2])))
        const id = ownerServes ? 'owner' : servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + wi, id, text: LINES[lang].sweepSay(wi + (w.spill ?? 0)), until: performance.now() + 2800 })
      })
      else if (w.phase === 'sweep') {
        // (the glass swept up as they go (the shards drawn in: Spills), the drink left on the floor; swept, the broom put by and the cloth out
        // to wipe it dry (item 116: the glass first, then the wet))
        const sp = SPILLS.list.find((x) => x.key === w.spill)
        if (sp) sp.left = Math.max(0, 1 - w.t / SWEEP_S)
        if (sp && nextClean(sp.left, sp.wet) === 'wipe') { w.phase = 'wipeFloor'; w.t = 0; w.broom = false }
        else if (!sp) w.phase = 'wipeFloor'
      }
      else if (w.phase === 'wipeFloor') {
        // (down on the floor with the cloth, wiping round and round over the drink till it's dry; done, gone, and back the way they came)
        const sp = SPILLS.list.find((x) => x.key === w.spill)
        if (sp) sp.wet = Math.max(0, 1 - w.t / FLOOR_WIPE_S)
        if (!sp || nextClean(sp.left, sp.wet) === 'done') {
          SPILLS.list = SPILLS.list.filter((x) => x.key !== w.spill)
          w.spill = undefined
          // (any more glass broken that no one's on: straight on to it along the aisle, and only then back (the owner's, 2026-11-11: he went
          // back to his place after each and came out again for the next))
          const next = SHOP.leaving ? undefined : SPILLS.list.find((x) => x.by === null)
          const to = next ? spillPath(wi, next) : null
          const here = nearestSeat(w.pos)
          if (next && to && to.length >= 2) {
            next.by = wi
            w.spill = next.key
            w.broom = true
            const there = nearestSeat(to[to.length - 2])
            const turn = seats[here].counter === seats[there].counter ? [] : [aisleCorner(counters[seats[here].counter === 0 ? seats[there].counter : seats[here].counter])]
            go([w.pos.clone(), seats[here].aisle.clone(), ...turn, ...to.slice(-2)], 'sweepGo')
          } else go([...backPath(wi, here).slice(0, -1), w.pos.clone()], 'back')
        }
      }
      else if (w.phase === 'toBox') walk(() => { w.phase = 'boxTake'; face(takeoutOf().at) })
      else if (w.phase === 'boxTake' && w.t > 0.45) {
        // (the bag up off the cook table (Roasting lets its food go with it): with a cashier at the till, across the kitchen and down off its
        // floor to the takeaway stand behind them; else back across the kitchen, out through their gate to the step)
        const o = TAKEOUT.orders.find((x) => x.id === w.box)
        if (o) o.taken = true
        if (cashierIn()) {
          const st = standSpots()
          const path = [...kitchenRoute(SERVE_COUNTER.out ?? pickupSpot, st.edge), st.reach]
          path[0] = w.pos.clone()
          go(path, 'toStand')
        } else {
          const path = [...kitchenRoute(SERVE_COUNTER.out ?? pickupSpot, home.at), ...tillPath(wi).slice(1)]
          path[0] = w.pos.clone()
          go(path, 'toTill')
        }
      } else if (w.phase === 'toStand') walk(() => { w.phase = 'standPut'; face(standSpots().at) })
      else if (w.phase === 'standPut' && w.t > 0.45) {
        // (set down on it for the cashier; back the way they came)
        if (w.box !== undefined) TAKEOUT_STAND.bags.push(w.box)
        boxClaimed.current.delete(w.box ?? -1)
        w.box = undefined
        // (the way they came, from their place to here: walked from its end, here, back to its start (the owner's item 36: given from here,
        // they were back inside their gate the moment they set off, walked out to the stand again, and were at their place again, at a jump
        // each time, every takeaway the cashier handed over)
        // (and from where that way began to their place round what's in the kitchen (item 173): the way out began at the serving counter
        // (item 167), and their place put straight before it, the last of it went straight through the low rack, the warmer and the cook
        // table's corner: pushed out of the table, a jump each time, a dozen a night)
        go([...kitchenRoute(home.at, w.path[0] ?? w.pos).slice(0, -1), ...w.path.slice(0, -1).map((v) => v.clone()), w.pos.clone()], 'back')
      } else if (w.phase === 'toTill') walk(() => {
        w.phase = 'hand'
        const v = visitors.current.get(w.box ?? -1)
        if (v) face(v.pos)
        const id = ownerServes ? 'owner' : servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + wi, id, text: LINES[lang].takeoutHand(!!v?.rider), until: performance.now() + 3000 })
      })
      else if (w.phase === 'hand' && w.t > 0.6) {
        // (into their hands; back the way they came, in through their gate)
        const v = visitors.current.get(w.box ?? -1)
        if (v) v.order.handed = true
        boxClaimed.current.delete(w.box ?? -1)
        w.box = undefined
        go(tillPath(wi).slice(0, -1).concat(w.pos.clone()), 'back')
      }
      // (the sake station (item 177): there, square on to it; their own to pour first (no plater), or lifted onto the tray as it waits)
      else if (w.phase === 'toSakePass') walk(() => {
        w.yaw = stationYaw()
        const j = sakeJob.current
        if (!j || j.server !== wi) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else if (j.pourer === wi && j.t < POUR_TOTAL) { w.phase = 'sakePour'; j.t = 0 }
        else w.phase = 'sakeUp'
      })
      else if (w.phase === 'sakePour') {
        const j = sakeJob.current
        if (j) j.t = Math.min(POUR_TOTAL, w.t)
        if (!j) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else if (w.t >= POUR_TOTAL) { w.phase = 'sakeUp'; w.t = 0 }
      }
      else if (w.phase === 'sakeUp') {
        const j = sakeJob.current
        if (!j || !guestSits(j.guest, j.seat)) { sakeJob.current = null; go(kitchenRoute(homeOf(wi).at, w.pos), 'back') }
        else {
          j.up = Math.min(1, w.t / SAKE_UP_S)
          if (w.t >= SAKE_UP_S) {
            // (on the tray: back across the kitchen to their place, out through their gate, along the aisle and in beside the customer)
            const h = homeOf(wi)
            const out = h.way.length < 2 ? [seats[j.seat].aisle.clone(), besideSeat(j.seat)] : backPath(wi, j.seat).slice(1)
            go([...kitchenRoute(w.pos, h.at), ...out], 'sakeGo')
          }
        }
      }
      else if (w.phase === 'sakeGo') walk(() => {
        const j = sakeJob.current
        if (!j) { go(kitchenRoute(homeOf(wi).at, w.pos), 'back'); return }
        w.phase = 'sakeSet'
        face(sakeSpotOf(j.seat).at)
        const id = ownerServes ? 'owner' : servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + wi, id, text: LINES[lang].sakeServe(j.guest), until: performance.now() + 2600 })
      })
      else if (w.phase === 'sakeSet') {
        const j = sakeJob.current
        if (j) j.down = Math.min(1, w.t / SAKE_SET_S)
        if (!j || w.t >= SAKE_SET_S) {
          // (down at their place, the cup by it: theirs (Roasting has them drink it); they gone meanwhile, it's taken back with the server)
          if (j && guestSits(j.guest, j.seat)) { SAKE_SEATS.add(j.seat); SAKE.ready.add(j.guest); SAKE.served++ }
          const seat = j?.seat ?? nearestSeat(w.pos)
          sakeJob.current = null
          go(backPath(wi, seat).slice(0, -1).concat(w.pos.clone()), 'back')
        }
      }
      // (a customer's bowls: at the counter, taken up onto the tray; or filled by the server themself at the cooker and the pot; out to the
      // customer's place and set down there, rice on their left, soup on their right)
      else if (w.phase === 'toBowlPass') walk(() => {
        const b = passQ.current.find((x) => x.server === wi)
        if (!b) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else { w.phase = 'bowlUp'; w.t = 0; face(passAt(Math.max(0, b.row), 'rice').lerp(passAt(Math.max(0, b.row), 'soup'), 0.5)) }
      })
      else if (w.phase === 'toRiceFill') walk(() => { const j = bowlJob.current; if (!j) { go(kitchenRoute(homeOf(wi).at, w.pos), 'back'); return } j.W = riceFillAt(); j.t = 0; w.yaw = Math.atan2(j.W.face.x, j.W.face.z); w.phase = 'bowlRice'; w.t = 0 })
      else if (w.phase === 'bowlRice') {
        const j = bowlJob.current
        if (!j) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else {
          j.t = Math.min(RICE_LEN, w.t)
          if (w.t >= RICE_LEN) {
            const r = takeRice(RICE.rice, RICE.kama)
            RICE.rice = r.rice; RICE.kama = r.kama; RICE.lid = 0
            j.riceFill = 1
            if (j.soup) { j.stage = 'soup'; const to = soupFillAt().stand, path = kitchenRoute(w.pos, to); if (!path.length || path[path.length - 1].distanceTo(to) > 0.02) path.push(to.clone()); go(path, 'toSoupFill') }
            else { trayFilled(j); w.phase = 'bowlUp'; w.t = BOWL_UP_S }
          }
        }
      }
      else if (w.phase === 'toSoupFill') walk(() => { const j = bowlJob.current; if (!j) { go(kitchenRoute(homeOf(wi).at, w.pos), 'back'); return } j.W = soupFillAt(); j.t = 0; w.yaw = Math.atan2(j.W.face.x, j.W.face.z); w.phase = 'bowlSoup'; w.t = 0 })
      else if (w.phase === 'bowlSoup') {
        const j = bowlJob.current
        if (!j) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else {
          j.t = Math.min(SOUP_LEN, w.t)
          if (w.t >= SOUP_LEN) {
            const b = takeBowl(SOUP.pot, SOUP.left)
            SOUP.pot = b.pot; SOUP.left = b.left
            j.soupFill = 1
            trayFilled(j)
            w.phase = 'bowlUp'; w.t = BOWL_UP_S
          }
        }
      }
      else if (w.phase === 'bowlUp') {
        // (those whose customer's gone meanwhile put by; the rest lifted onto the tray)
        passQ.current = passQ.current.filter((b) => b.server !== wi || guestSits(b.guest, b.seat))
        const mine = passQ.current.filter((b) => b.server === wi)
        if (!mine.length) go(kitchenRoute(homeOf(wi).at, w.pos), 'back')
        else {
          for (const b of mine) b.up = Math.min(1, w.t / BOWL_UP_S)
          if (w.t >= BOWL_UP_S) {
            // (on the tray: back across the kitchen to their place, out through their gate, along the aisle and in beside the first customer)
            const h = homeOf(wi), seat = mine[0].seat
            const out = h.way.length < 2 ? [seats[seat].aisle.clone(), besideSeat(seat)] : backPath(wi, seat).slice(1)
            go([...kitchenRoute(w.pos, h.at), ...out], 'bowlGo')
          }
        }
      }
      else if (w.phase === 'bowlGo') walk(() => {
        const b = passQ.current.find((x) => x.server === wi)
        if (!b) { go(kitchenRoute(homeOf(wi).at, w.pos), 'back'); return }
        w.phase = 'bowlSet'
        face(seats[b.seat].plate)
        const id = ownerServes ? 'owner' : servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + wi, id, text: LINES[lang].sideServe(b.guest, b.rice, b.soup), until: performance.now() + 2600 })
      })
      else if (w.phase === 'bowlSet') {
        const b = passQ.current.find((x) => x.server === wi)
        if (b) b.down = Math.min(1, w.t / BOWL_SET_S)
        if (!b || w.t >= BOWL_SET_S) {
          // (down at their place: theirs (Roasting has them eat them); they gone meanwhile, taken back with the server)
          if (b && guestSits(b.guest, b.seat)) setBowls(b)
          passQ.current = passQ.current.filter((x) => x !== b)
          const seat = b?.seat ?? nearestSeat(w.pos)
          // (the next set on the tray: along the aisle to its place, at the same counter (item 207)); their customer gone, put by
          const next = passQ.current.find((x) => x.server === wi && guestSits(x.guest, x.seat))
          passQ.current = passQ.current.filter((x) => x.server !== wi || x === next)
          if (next) go([w.pos.clone(), seats[seat].aisle.clone(), seats[next.seat].aisle.clone(), besideSeat(next.seat)], 'bowlGo')
          else go(backPath(wi, seat).slice(0, -1).concat(w.pos.clone()), 'back')
        }
      }
      else if (w.phase === 'pickup' && pickupReady(w.slot, w.t)) {
        // (what's set out for the seat taken up off the plating place, once nothing more's flying to it: its plate, if one's laid there, onto the tray,
        // and the food with it; the slot free)
        const k = w.slot ?? -1
        w.keys = [...SERVICE.waiting.entries()].filter(([, n]) => n === w.seat).map(([key]) => key)
        for (const key of w.keys) {
          SERVICE.waiting.delete(key)
          SERVICE.claimed.add(key)
        }
        const r = runs.current.find((x) => x.phase === 'ready' && x.slot === k)
        if (r) {
          r.phase = 'carry'
          r.slot = undefined
          w.run = r.key
          runObjs.current.get(r.key)?.scale.setScalar(1)
        }
        if (k >= 0) PLATING.slots[k] = null
        w.slot = undefined
        // (that customer's bowls waiting at the counter taken out with it, on the same tray beside the plate: a meal goes out together (item
        // 207: a trip of their own each, the bowls had both servers going all evening, the food left waiting at the plating place behind them))
        const withIt = passQ.current.find((b) => b.server === undefined && b.seat === w.seat && guestSits(b.guest, b.seat))
        if (withIt) {
          withIt.server = wi
          withIt.with = true
          const to = passSpot(), path = kitchenRoute(w.pos, to)
          if (!path.length || path[path.length - 1].distanceTo(to) > 0.02) path.push(to.clone())
          go(path, 'toBowlWith')
        } else {
          const rt = routeTo(w.seat, wi)
          rt.path[0] = w.pos.clone()
          go(rt.path, 'go')
        }
      } else if (w.phase === 'toBowlWith') walk(() => {
        const b = passQ.current.find((x) => x.server === wi && x.with)
        w.phase = 'bowlWith'
        w.t = 0
        if (b && b.row >= 0) face(passAt(b.row, 'rice').lerp(passAt(b.row, 'soup'), 0.5))
      })
      else if (w.phase === 'bowlWith') {
        const b = passQ.current.find((x) => x.server === wi && x.with)
        if (b) b.up = Math.min(1, w.t / BOWL_UP_S)
        if (!b || w.t >= BOWL_UP_S) {
          // (on the tray with the food: out through their gate, along the aisle, in beside the customer)
          const h = homeOf(wi)
          const out = h.way.length < 2 ? [seats[w.seat].aisle.clone(), besideSeat(w.seat)] : backPath(wi, w.seat).slice(1)
          go([...kitchenRoute(w.pos, h.at), ...out], 'go')
        }
      } else if (w.phase === 'go') walk(() => {
        w.phase = 'set'; face(plateAt(w.seat))
        const id = servers[wi]?.id
        if (id) STAFF_TALK.push({ key: performance.now() + wi, id, text: LINES[lang].serveSay(Math.floor(Math.random() * 3)), until: performance.now() + 2600 })
      })
      else if (w.phase === 'set' && w.t > 0.4) {
        // (down at their place: the plate, and what's on it with it; their bowls brought with it too (item 207)); heard as it's set down (item 320)
        const r = run()
        if (r && frame.current) plateDownSound(frame.current.localToWorld(plateAt(w.seat).clone()))
        if (r && r.phase === 'carry') r.phase = 'set'
        for (const b of passQ.current) if (b.server === wi && b.with && guestSits(b.guest, b.seat)) setBowls(b)
        passQ.current = passQ.current.filter((b) => !(b.server === wi && b.with))
        for (const k of w.keys) {
          SERVICE.carried.delete(k)
          SERVICE.claimed.delete(k)
          SERVICE.delivered.add(k)
        }
        // (its turn kept for Roasting to lay what's on it by, till it's laid (item 228))
        w.keys = []
        w.run = null
        // (on the way back, the dirty plates left along this counter that nobody's gone for, the nearest first, a tray's three: taken up as
        // they go by, to the sink with them (item 53: only the floor's server cleared, and only with nothing to carry, and on an ordinary
        // evening nearly three of the eight seats stood with a dirty plate on them at any time, not to be sat at till it's cleared))
        const spoken = new Set(waiters.current.flatMap((x) => x.carry ?? []))
        const here = seats[w.seat]
        const by = SHOP.leaving ? [] : onTheWay(here.counter, runs.current.filter((x) => x.phase === 'dirty' && !spoken.has(x.key))
          .map((x) => ({ run: x, counter: seats[x.seat].counter, far: seats[x.seat].mid.distanceTo(here.mid) })))
        if (by.length) {
          w.carry = by.map((x) => x.run.key)
          w.seat = by[0].run.seat
          go([w.pos.clone(), here.aisle.clone(), seats[by[0].run.seat].aisle.clone(), besideSeat(by[0].run.seat)], 'clearGo')
        }
        // (back the shortest way to their place, in through their gate)
        else go(backPath(wi, w.seat).slice(0, -1).concat(w.pos.clone()), 'back')
      } else if (w.phase === 'back') {
        // (picking up their pace on the way back too (item 183))
        const d = rampedAlong(w.t, w.len)
        const { p, dir } = alongPath(w.path, w.len - d)
        w.pos.copy(p)
        w.yaw = Math.atan2(-dir.x, -dir.z)
        if (d >= w.len) {
          w.phase = 'idle'
          w.pos.copy(home.at)
          w.yaw = home.yaw
          w.t = 0
          w.seat = -1
          w.broom = false
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
      else if (w.phase === 'clearTake' && w.t > CLEAR_WIPE_AT + WIPE_S) {
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
        // (into the sink with the dirty ones; the sticks left on them into the bin beside it (the owner's); the bones and the tissues with
        // them, and the bottles and cans into the recycling bin (item 208))
        const keys = new Set(w.carry ?? [])
        const taken = runs.current.filter((x) => keys.has(x.key) && x.phase === 'taken')
        SINK_BIN.sticks += taken.reduce((n, x) => n + (x.sticks ?? 0), 0)
        binThrow(taken)
        for (const x of taken) { SINK.dirt.push(x.dirt ?? DIRT_BASE); SINK.kinds.push(x.kind ?? 'round') }
        runs.current = runs.current.filter((x) => !keys.has(x.key))
        dirty.current += taken.length
        w.carry = []
        w.seat = -1
        go(kitchenRoute(home.at, w.pos), 'back')
        redraw()
      } else if (w.phase === 'washGo' || w.phase === 'unloadGo' || w.phase === 'handGo' || w.phase === 'basketGo') walk(() => {
        face(inBar(w.phase === 'basketGo' ? 'SinkRackSlot0' : 'SinkBasinFloor', endOf(1)))
        if ((w.phase === 'washGo' || w.phase === 'handGo') && servers[wi]?.id && Math.random() < 0.6) STAFF_TALK.push({ key: performance.now() + wi, id: servers[wi].id, text: LINES[lang].washSay(Math.floor(Math.random() * 3)), until: performance.now() + 2600 })
        w.phase = w.phase === 'washGo' ? 'wash' : w.phase === 'handGo' ? 'handwash' : w.phase === 'basketGo' ? 'basketTake' : 'unloadTake'
      })
      // (the dirtier the plate on top, the longer it's scrubbed: one soaked, a rinse (game/plates' handTime))
      else if (w.phase === 'handwash' && w.t >= handTime(SINK.dirt.at(-1) ?? 1)) {
        // (the washer busy: a plate scrubbed by hand under the running tap and stood in the draining basket beside the sink, one at a time; the
        // sink washed empty or the basket full, back to their place)
        w.t = 0
        // (not the stack left on the counter (item 103): only what's over it)
        const pile = pileLeft(PILE.n, dirty.current), before = dirty.current
        const r = handOne(before - pile, DRAIN)
        r.dirty += pile
        if (r.dirty !== before) {
          dirty.current = r.dirty
          DRAIN.n = r.drain.n
          DRAIN.left = r.drain.left
          soapPlate(); meterWater('dish')
          const o = waiterObjs.current[wi]
          if (o) { washSplash(o.getWorldPosition(SOUND_AT)); window.setTimeout(() => plateClink(SOUND_AT), 520) }
          redraw()
        }
        if (dirty.current <= pile || DRAIN.n >= DRAIN_CAP || r.dirty === before) go(kitchenRoute(home.at, w.pos), 'back')
      } else if (w.phase === 'basketTake' && w.t > 0.6) {
        // (the basket's drained plates onto the tray, a trip's worth, and across to the racks with them)
        const u = unbasket(DRAIN)
        DRAIN.n = u.drain.n
        DRAIN.left = u.drain.left
        w.stack = u.take
        go(kitchenRoute(w.pos, rackFront(rackNow(PLATE_RACK.n + 1))), 'unloadCarry')
        redraw()
      }
      else if (w.phase === 'wash' && w.t >= WASH_EACH) {
        // (at the sink, the tap running: a plate washed out of the sink and stood in the dryer, its door down, one at a time; the sink washed
        // empty or the dryer full, its door shut and it started, and back to their place)
        w.t = 0
        const pile = pileLeft(PILE.n, dirty.current), before = dirty.current
        const r = washOne(before - pile, DRYER)
        r.dirty += pile
        if (r.dirty !== before) {
          dirty.current = r.dirty
          DRYER.n = r.dryer.n
          soapPlate(); meterWater('dish')
          // (heard: the splash and scrub in the soapy water, the plate stood in the dryer with a clink)
          const o = waiterObjs.current[wi]
          if (o) { washSplash(o.getWorldPosition(SOUND_AT)); window.setTimeout(() => plateClink(SOUND_AT), 330) }
          redraw()
        }
        // (done: the sink washed empty or the dryer full; or nothing more could be washed)
        if (dryerStarts(dirty.current - pile, DRYER) || r.dirty === before) {
          // (started: its door shut, whoever had let it down)
          if (DRYER.n > 0) { DRYER.left = DRY_S; DRYER.manual = false }
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
        // (set down on the rack's stack: a clink or two)
        const o = waiterObjs.current[wi]
        if (o && w.stack) { plateClink(o.getWorldPosition(SOUND_AT)); window.setTimeout(() => plateClink(SOUND_AT), 120) }
        PLATE_RACK.n = putBack(PLATE_RACK.n, w.stack ?? 0)
        w.stack = 0
        go(kitchenRoute(home.at, w.pos), 'back')
      }
      // what's on the tray goes where the tray goes (and, being set down, from the tray to the bar)
      const tray = trayAt()
      // (the bundle of skewers in their hands, from the used bucket to the clean one; scrubbed to and fro at the sink)
      const sb = serverSkewers.current
      if (sb && (SK_PHASES.has(w.phase) || sb.userData.by === wi)) {
        const has = w.phase === 'skSinkGo' || w.phase === 'skWash' || w.phase === 'skHolderGo' || w.phase === 'skPut' || (w.phase === 'skTake' && w.t > 0.3)
        sb.visible = has
        sb.userData.by = has ? wi : undefined
        if (has) { sb.position.copy(tray).add(new THREE.Vector3(w.phase === 'skWash' ? Math.sin(w.t * 12) * 0.03 : 0, 0.01, 0)); sb.rotation.set(0, w.look ?? w.yaw, 0) }
      }
      if (w.carry?.length) {
        let i = 0
        for (const key of w.carry) {
          const r = runs.current.find((x) => x.key === key)
          const o = runObjs.current.get(key)
          if (!r || !o || r.phase !== 'taken') continue
          const on = tray.clone().setY(tray.y + 0.006 + i * STACK_GAP)
          // (lifted off the bar onto the tray; and at the sink, down off it into the basin)
          if (w.phase === 'clearTake' && key === runs.current.find((x) => x.key === key && x.seat === w.seat)?.key) {
            // (lifted with the right hand once it's reached it, in a little arc onto the tray (item 231))
            const k = Math.min(1, Math.max(0, (w.t - CLEAR_REACH) / CLEAR_LIFT))
            const sm = k * k * (3 - 2 * k)
            o.position.lerpVectors(r.from, on, sm)
            o.position.y += Math.sin(Math.PI * sm) * 0.05
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
      // (their bowls, brought with the food, set down as it is)
      if (w.phase === 'set') for (const b of passQ.current) if (b.server === wi && b.with) b.down = Math.min(1, w.t / 0.4)
      if (w.phase === 'go' || w.phase === 'set' || w.phase === 'toBowlWith' || w.phase === 'bowlWith') {
        const pr = runObjs.current.get(w.run ?? -1)
        // (the plate, carried on the tray as it lay at the plating place, and turned as it's set down to lie along its customer's counter
        // (item 228: seatTurn); what's on it with it, side by side across it as far apart as the plate's kind has them, turned with it)
        const turn = w.seat >= 0 ? seatTurn(w.seat) * k * k * (3 - 2 * k) : 0
        if (pr && run()?.phase === 'carry') { pr.position.copy(hold.clone().setY(hold.y + 0.006)); pr.rotation.y = PASS_YAW + turn }
        const spread = PLATE_SPREAD[run()?.kind ?? 'round'], across = plating.across.clone().applyAxisAngle(UP_Y, turn)
        w.keys.forEach((key, i) => {
          const sd = plateSide(i)
          SERVICE.carried.set(key, toShop(hold.clone().addScaledVector(across, sd.across * spread).add(new THREE.Vector3(0, 0.035 + sd.layer * 0.03, 0))))
          SERVICE.turn.set(key, turn)
        })
      }
      const o = waiterObjs.current[wi]
      // (out on the floor, or gone to wash up for the player while the shop's shut (item 166): out either way, not at his place)
      if (ownerServes) ownerAway('serve', w.phase !== 'idle')
      // (the plate up on the tray, the bar where it was wiped down with a cloth, twice along and back (the owner's))
      const wiping = w.phase === 'clearTake' && w.t > CLEAR_WIPE_AT && w.t < CLEAR_WIPE_AT + WIPE_S && w.seat >= 0
      if (o) o.userData.wipe = wiping ? (w.t - CLEAR_WIPE_AT) / WIPE_S : undefined
      // (sweeping up broken glass: how long into it; the broom in hand there and back (StaffFigure, the owner's SweepBroom))
      // (wiping the floor after: stooped as they sweep, the broom put by, the cloth in their hand on the floor (item 116))
      // (wiping the floor its own: stooped as for the sweep, but the broom and the dustpan put by and the cloth in hand (item 164: the three
      // were out together, the sweep's flag kept on for the stoop))
      if (o) { o.userData.sweep = w.phase === 'sweep' ? w.t : undefined; o.userData.floorWipe = w.phase === 'wipeFloor' ? w.t : undefined; o.userData.broom = !!w.broom }
      // (their tray down for an errand, and on the way back from one; up again for what's carried on it and at their place)
      if (TRAY_ERRANDS.has(w.phase)) w.trayDown = true
      else if (w.phase !== 'back') w.trayDown = false
      if (o) o.userData.trayDown = !!w.trayDown
      // (washing up at the sink, by hand or into the washer: the scrubbing motion (StaffFigure's scrub))
      if (o) o.userData.scrub = w.phase === 'wash' || w.phase === 'handwash' ? w.t : undefined
      // (pouring a customer's sake themself (no plater): both hands where the pour has them (item 177)); and the tray it's carried out on
      // (clearing a place: the right hand on the plate's rim as it's taken up and set on the tray, the left on the tray (item 231))
      const clearHands = () => {
        const f = frame.current
        if (!f || wi >= CLEAR_HANDS.length) return false
        const r = runs.current.find((x) => (w.carry ?? []).includes(x.key) && x.seat === w.seat && x.phase === 'taken')
        const po = r ? runObjs.current.get(r.key) : undefined
        if (!po) return false
        const yaw = w.look ?? w.yaw
        CLEAR_SIDE.set(Math.cos(yaw), 0, -Math.sin(yaw))
        CLEAR_TOWARD.copy(w.pos).sub(po.position).setY(0)
        if (CLEAR_TOWARD.lengthSq() < 1e-8) CLEAR_TOWARD.set(-Math.sin(yaw), 0, -Math.cos(yaw)); else CLEAR_TOWARD.normalize()
        const H = CLEAR_HANDS[wi], tr = trayAt()
        f.localToWorld(H.right.copy(po.position).addScaledVector(CLEAR_TOWARD, PLATE_R * 0.8 * (po.scale.x || 1)).setY(po.position.y + 0.012))
        f.localToWorld(H.left.copy(tr).addScaledVector(CLEAR_SIDE, -0.11 * STAFF_SCALE).setY(tr.y + 0.01))
        return true
      }
      if (o) o.userData.handsAt = w.phase === 'sakePour' && SAKE_HANDS_ON.v ? SAKE_HANDS
        : (w.phase === 'bowlRice' || w.phase === 'bowlSoup') && BOWL_HANDS_ON.v ? BOWL_HANDS
        : w.phase === 'clearTake' && w.t < CLEAR_WIPE_AT && clearHands() ? CLEAR_HANDS[wi] : undefined
      if (sakeJob.current?.server === wi) { SAKE_TRAY.copy(trayAt()); SAKE_TRAY_YAW.v = w.look ?? w.yaw }
      if (passQ.current.some((b) => b.server === wi)) bowlTrays.current.set(wi, { at: trayAt(), yaw: w.look ?? w.yaw })
      else bowlTrays.current.delete(wi)
      // (they step in to the bar's edge between the stools for it, facing it, and back out: the cloth's under their hand (StaffFigure's
      // wipe: the right hand out on the top, along and back), on the near edge of the top where the plate was)
      let wipeAt: { p: THREE.Vector3; yaw: number; k: number } | null = null
      const rag = ragObjs.current[wi]
      if (rag) rag.visible = wiping || w.phase === 'wipeFloor'
      // (the cloth on the floor over the drink, wiped round and round in front of them (item 116))
      if (rag && w.phase === 'wipeFloor' && frame.current) {
        const sp = SPILLS.list.find((x) => x.key === w.spill)
        if (sp) {
          const at = frame.current.worldToLocal(new THREE.Vector3(sp.at[0], sp.at[1], sp.at[2]))
          const a = w.t * 7
          rag.position.set(at.x + Math.cos(a) * 0.07, at.y + 0.004, at.z + Math.sin(a) * 0.07)
          rag.rotation.y = a
          // (and where it is from the one wiping, in their own upright frame, for their hand to be on it)
          if (o) {
            const d = rag.position.clone().sub(w.pos).applyAxisAngle(UP_Y, -w.yaw).divideScalar(STAFF_SCALE)
            o.userData.wipeAt = [d.x, rag.position.y / STAFF_SCALE, d.z]
          }
        }
      }
      if (wiping) {
        const st = seats[w.seat], c = counters[st.counter], p = (w.t - CLEAR_WIPE_AT) / WIPE_S
        const stand = st.mid.clone().addScaledVector(c.lay, -WIPE_STAND[1]).addScaledVector(c.along, WIPE_STAND[0]).setY(w.pos.y)
        const yaw = Math.atan2(c.lay.x, c.lay.z)
        const k = Math.min(1, p / 0.15, (1 - p) / 0.15)
        wipeAt = { p: stand, yaw, k: k * k * (3 - 2 * k) }
        if (rag) {
          // (the cloth over where the plate stood (item 231: it wiped the bar in front of where they stood, beside the place), worked along it
          // and in toward them (StaffFigure's wipeStroke), the right hand on it, the left on the tray)
          const [wx, wz] = wipeStroke(p)
          const place = plateAt(w.seat)
          rag.position.copy(place).addScaledVector(c.along, (wx - 0.06) * STAFF_SCALE * 1.15).addScaledVector(c.lay, (wz - WIPE_HAND_Z) * STAFF_SCALE * 1.15).setY(top + 0.006)
          rag.rotation.y = yaw + Math.PI / 2 + Math.cos(p * Math.PI * 3 - Math.PI / 2) * 0.3
          const f = frame.current
          if (f && wi < CLEAR_HANDS.length) {
            const H = CLEAR_HANDS[wi], tr = trayAt()
            f.localToWorld(H.right.copy(rag.position).setY(top + 0.03))
            CLEAR_SIDE.set(Math.cos(yaw), 0, -Math.sin(yaw))
            f.localToWorld(H.left.copy(tr).addScaledVector(CLEAR_SIDE, -0.11 * STAFF_SCALE).setY(tr.y + 0.01))
            if (o) o.userData.handsAt = H
          }
        }
      }
      // (going home only once what's in hand is put down: a plate carried to the sink, a stack to the racks; the owner saw the plates of a
      // server who'd set off for the door float on without them along the way they'd have walked, in mid-air)
      if (o && SHOP.leaving && !ownerServes && (w.out || w.phase === 'idle')) {
        // (the shop's shut and empty: finishing up a moment where they are, then out through their gate, along the aisle (round the corner
        // from the side counter's) to the front door, a nod back in, and through it fading, as the customers go (commuteWalk))
        const id = servers[wi]?.id ?? `server${wi}`
        if (!w.out) {
          const h = homeOf(wi)
          const way = [w.pos.clone(), ...h.way.slice(1).map((v) => v.clone()), ...(h.counter ? [aisleCorner(counters[h.counter])] : []), doorOf(counters)]
          way.push(...doorOutOf(counters))
          w.out = makeTrip(id, 'out', way, delayOf(id, SHOP.day), paceOf(id))
          SHOP.walking.add(id)
        }
        walkCommute(o, w.out, w)
        if (w.out.done) SHOP.walking.delete(id)
      } else if (o) {
        w.out = undefined
        // (still finishing as the others go: the shop waits for them too)
        if (SHOP.leaving && !ownerServes) SHOP.walking.add(servers[wi]?.id ?? `server${wi}`)
        // (the owner's figure here only while he's out serving: at his place, Roasting draws him; out washing up, his washing figure (item 216:
        // this one was shown whenever he was out for anything, a second owner standing by the pass while he washed at the sink))
        o.visible = !ownerServes || OWNER_OUT.by === 'serve'
        o.position.copy(w.pos)
        o.position.y += genkanY(counters, w.pos) + stoolLift(o, w.pos, Math.min(dt, 0.1))
        // (the facing shown eased to the way they're going, never more than a little a frame (turnSmooth, item 183))
        w.look = turnSmooth(w.look ?? w.yaw, w.yaw, step)
        o.rotation.y = w.look
        if (wipeAt) {
          o.position.lerp(wipeAt.p, wipeAt.k)
          o.rotation.y = w.look + Math.atan2(Math.sin(wipeAt.yaw - w.look), Math.cos(wipeAt.yaw - w.look)) * wipeAt.k
        }
      }
      // (up on the kitchen's dais while they're over it; not again for one on their way home: walkCommute has put them up on it (twice up, they
      // stood a step's height over the dais as they finished up to go, and dropped to the floor as they set off: the owner's item 42))
      if (o && KITCHEN_DROP < 0 && !w.out) {
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
    // (the places with soy in their dish: one sat at it, or their plate still down after they've gone, till it's cleared (item 203: it came
    // as they sat and went as they stood, the plate still there)); drawn again only as that changes
    {
      let mask = 0
      for (const x of shown) if (x.seat >= 0 && x.phase !== 'enter' && x.phase !== 'leave') mask |= 1 << x.seat
      for (const n of PLATES_SET) if (n >= 0) mask |= 1 << n
      if (mask !== soyMask.current) { soyMask.current = mask; redraw() }
    }
    if (finished || homed) {
      // (those come to the sink by themselves (no one on the floor), each as dirty as it was left)
      for (const r of runs.current) if (r.t === Infinity && r.phase !== 'home') { SINK.dirt.push(r.dirt ?? DIRT_BASE); SINK.kinds.push(r.kind ?? 'round') }
      runs.current = runs.current.filter((r) => r.t !== Infinity)
      dirty.current += finished
      redraw()
    }
    // (with nobody on the floor to wash them, the sink's plates wash themselves back onto the racks, a batch at a time)
    if (!nServers) {
      if (wash.current === null && staffSink(dirty.current, PILE.n) > 0 && !runs.current.some((r) => r.phase === 'clear' && r.t >= 0)) wash.current = 0
      if (wash.current !== null) {
        wash.current += step
        if (wash.current >= WASH_EACH && staffSink(dirty.current, PILE.n) > 0) {
          wash.current = 0
          dirty.current -= 1
          soapPlate(); meterWater('dish')
          const going = runs.current.filter((r) => r.phase === 'home').length
          runs.current.push({ key: ++runSeq.current, seat: -1, guest: -1, phase: 'home', t: 0, from: dirtyAt(dirty.current), to: rackTop(rackNow(PLATE_RACK.n + going + 1)) })
          redraw()
        }
        if (staffSink(dirty.current, PILE.n) === 0) wash.current = null
      }
    }
    // the dryer drying (game/plates), its door down while someone's at it
    if (DRYER.left !== null && DRYER.left > 0) DRYER.left = dryerTick(DRYER, step).left
    // (the basket's plates draining dry)
    if (DRAIN.left !== null && DRAIN.left > 0) DRAIN.left = drainTick(DRAIN, step).left
    // (the player's put the sink's dirty plates in it, its door down (Sink): as many as there's room for, with a clink or two; the sink's count
    // told for its label)
    if (DRYER.ask) {
      DRYER.ask = 0
      const k = playerLoad(dirty.current, DRYER)
      if (k > 0) {
        dirty.current -= k
        DRYER.n += k
        const at = inBar('SinkDryerRack0', endOf(1))
        const f = frame.current
        if (f) { plateClink(f.localToWorld(SOUND_AT.copy(at))); window.setTimeout(() => plateClink(SOUND_AT), 140) }
        redraw()
      }
    }
    // (the player's washing up by hand is the owner's to do (item 166: a plate went clean at a click, nothing seen done): bossWashTick sends
    // him, or out serving himself he takes it as his next chore; the shop shutting meanwhile, asked no more. The basket's dry plates back to
    // the racks at a click, as before)
    if (HAND_WASH.ask === 'wash' && SHOP.leaving) HAND_WASH.ask = null
    if (HAND_WASH.ask === 'take') {
      HAND_WASH.ask = null
      const u = unbasket(DRAIN)
      if (u.take > 0) {
        DRAIN.n = u.drain.n
        DRAIN.left = u.drain.left
        PLATE_RACK.n = putBack(PLATE_RACK.n, u.take)
        const f = frame.current
        if (f) { plateClink(f.localToWorld(SOUND_AT.copy(inBar('SinkBasinFloor', endOf(1))))); window.setTimeout(() => plateClink(SOUND_AT), 140) }
        redraw()
      }
    }
    // (the owner gone to wash the stack the player left on the counter (item 103): from the third day; washed into the draining basket)
    bossWashTick(step)
    // (the sake station (item 177): the open bottle posed by the pour, in the pourer's hands; its stream and its level; the tokkuri and the cup
    // where they are: set out and poured into, waiting at the pass, lifted onto the server's tray, carried, set down at the customer's place)
    {
      SAKE.station = !!STATION_OBJ.group && !!given && waiters.current.length > 0
      const j0 = sakeJob.current
      // (poured and not yet taken, the customer gone meanwhile: not wanted)
      if (j0 && j0.server === undefined && j0.t >= POUR_TOTAL && !guestSits(j0.guest, j0.seat)) sakeJob.current = null
      const j = sakeJob.current
      if (j && j.t >= 0 && j.was === undefined) j.was = SAKE.open
      // (poured: a tokkuri's worth out of the open bottle; finished, a new one opened only with sake left (item 199: it stood full again
      // whether there was sake in stock or none))
      if (j && j.t >= POUR_TOTAL && !j.poured) {
        j.poured = true
        SAKE.unpoured.delete(j.guest)
        SAKE.open = stationGo(Math.round((j.was ?? SAKE.open) * STATION_GO) - 1, sakeLeft()) / STATION_GO
      }
      const pouring = !!j && j.t >= 0 && j.t < POUR_TOTAL
      // (and between pours, the open bottle as there's sake for: sold out, the bottle poured empty stands empty; sake bought, a new one's
      // opened; stock thrown out, never more in it than there is)
      if (!pouring) SAKE.open = stationGo(Math.round(SAKE.open * STATION_GO), sakeLeft()) / STATION_GO
      const beat = pouring ? pourBeat(j!.t) : null
      const P = STATION_POSE
      if (beat) stationPose(beat.beat, beat.k, P)
      else { P.foot.copy(STATION.bottle); P.q.copy(STATION_OBJ.q0) }
      if (STATION_OBJ.bottle) { STATION_OBJ.bottle.position.copy(P.foot); STATION_OBJ.bottle.quaternion.copy(P.q) }
      if (STATION_OBJ.liquid) STATION_OBJ.liquid.scale.y = Math.max(0.02, pouring ? (j!.was ?? SAKE.open) - pouredBy(j!.t) * (TOKKURI_ML / SAKE_BOTTLE_ML[0]) : SAKE.open)
      const sm = STATION_OBJ.stream
      if (sm) {
        if (pouring && streaming(j!.t)) { const to = STATION_STREAM_TO(); sm.position.copy(P.mouth); sm.scale.set(1, Math.max(1e-4, P.mouth.y - to.y), 1) }
        else sm.scale.set(1, 1e-4, 1)
      }
      SAKE_HANDS_ON.v = !!beat && !!STATION_OBJ.group
      if (SAKE_HANDS_ON.v) { STATION_OBJ.group!.localToWorld(SAKE_HANDS.left.copy(P.left!)); STATION_OBJ.group!.localToWorld(SAKE_HANDS.right.copy(P.right!)) }
      const jo = sakeJugObj.current, co = sakeCupObj.current
      if (jo && co) {
        let jug: THREE.Vector3 | null = null, cup: THREE.Vector3 | null = null
        if (j && pouring) { jug = P.jug ? stationIn(P.jug) : null; cup = P.cup ? stationIn(P.cup) : null }
        else if (j && j.t >= POUR_TOTAL) {
          const e = (x: number) => x * x * (3 - 2 * x)
          // (on the tray side by side, the tokkuri toward their left hand)
          const side = new THREE.Vector3(Math.cos(SAKE_TRAY_YAW.v), 0, -Math.sin(SAKE_TRAY_YAW.v))
          const trayJug = SAKE_TRAY.clone().addScaledVector(side, -0.035).setY(SAKE_TRAY.y + 0.006)
          const trayCup = SAKE_TRAY.clone().addScaledVector(side, 0.045).setY(SAKE_TRAY.y + 0.006)
          if ((j.down ?? 0) > 0) {
            const k = e(j.down!), spot = sakeSpotOf(j.seat)
            jug = trayJug.lerp(spot.at, k)
            cup = trayCup.lerp(spot.at.clone().add(spot.cup), k)
            jug.y += Math.sin(Math.PI * k) * 0.03; cup.y += Math.sin(Math.PI * k) * 0.03
          } else {
            const k = e(j.up ?? 0)
            jug = stationIn(STATION.jug).lerp(trayJug, k)
            cup = stationIn(STATION.cup).lerp(trayCup, k)
            jug.y += Math.sin(Math.PI * k) * 0.04; cup.y += Math.sin(Math.PI * k) * 0.04
          }
        }
        jo.visible = !!jug
        if (jug) jo.position.copy(jug)
        co.visible = !!cup
        if (cup) co.position.copy(cup)
      }
    }
    // (a customer's rice and soup (items 205, 206): in the hands of the one filling them, beat by beat (SideBowls' poses: the paddle and the
    // ladle with them, the cooker's lid lifted); carried to the counter in front of them; waiting there; lifted onto a server's tray, out on it
    // and set down at the place; the paddle hung on the cooker and the ladle in the pot meanwhile)
    {
      // (a customer's bowls left at the counter, or not yet carried out, they gone meanwhile: not to be taken out (it stayed there for them,
      // and every customer's after it waited behind it))
      passQ.current = passQ.current.filter((b) => b.server !== undefined || guestSits(b.guest, b.seat))
      const j = bowlJob.current, f = frame.current
      const now = performance.now()
      if (now - restsAt.current.at > 1000 && STATION_OBJ.group) {
        restsAt.current.at = now
        const R = riceFillAt(), S = soupFillAt()
        const pr = paddleRest(R)
        restsAt.current.paddle = pr
        restsAt.current.ladle = ladleRest(S)
        // (the paddle's holder where it stands in it (item 253))
        side.holder.position.copy(pr.holder)
        side.holder.visible = true
      }
      let pose: FillPose | null = null
      if (j && j.W && (j.stage === 'rice' || j.stage === 'soup')) {
        const filling = j.by === 'plater' ? (platerRun.current.phase === 'riceBowl' || platerRun.current.phase === 'soupBowl')
          : (waiters.current[j.by]?.phase === 'bowlRice' || waiters.current[j.by]?.phase === 'bowlSoup')
        if (filling) pose = j.stage === 'rice' ? riceFillPose(j.W, j.t) : soupFillPose(j.W, j.t)
      }
      BOWL_HANDS_ON.v = !!pose && !!f
      if (pose && f) { f.localToWorld(BOWL_HANDS.left.copy(pose.left)); f.localToWorld(BOWL_HANDS.right.copy(pose.right)) }
      // (lifting the cooker's lid off and putting it back on: the right hand on its knob where it really is, as it lifts and tips back; on
      // its way there, where the pose has it (item 387: up and over the cooker's front, not through it))
      if (pose && f && j?.stage === 'rice' && pose.onKnob) {
        const lid = markOf('DenkiLid')
        if (lid) { const b = new THREE.Box3().setFromObject(lid); BOWL_HANDS.right.set((b.min.x + b.max.x) / 2, b.max.y + 0.01, (b.min.z + b.max.z) / 2) }
      }
      RICE.lid = pose && j?.stage === 'rice' ? pose.lid : 0
      // (where each bowl is, and how full)
      let riceAt: THREE.Vector3 | null = null, soupAt: THREE.Vector3 | null = null
      if (j) {
        if (pose && j.stage === 'rice') { j.riceFill = pose.fill; riceAt = pose.bowl }
        if (pose && j.stage === 'soup') { j.soupFill = pose.fill; soupAt = pose.bowl; if (j.rice) riceAt = null }
        // (in front of them, in their hands, as they go to the counter, or to the pot with the rice)
        const holder = j.by === 'plater' ? platerRun.current : waiters.current[j.by]
        const carrying = j.stage === 'toPass' || (j.stage === 'soup' && !pose)
        if (holder && carrying) {
          const fwd = new THREE.Vector3(Math.sin(holder.yaw), 0, Math.cos(holder.yaw)), rt = new THREE.Vector3(-fwd.z, 0, fwd.x)
          const hands = holder.pos.clone().addScaledVector(fwd, HELD_AT[2] * STAFF_SCALE + 0.02).setY(holder.pos.y + HELD_AT[1] * STAFF_SCALE - 0.03)
          if (j.rice) riceAt = hands.clone().addScaledVector(rt, j.soup && j.stage === 'toPass' ? -0.065 : 0)
          if (j.soup && j.stage === 'toPass') soupAt = hands.clone().addScaledVector(rt, 0.065)
        }
        // (set down at the counter in their row, from their hands)
        if (j.by === 'plater' && platerRun.current.phase === 'bowlPut') {
          const k = Math.min(1, platerRun.current.t / BOWL_PUT_S), row = j.row ?? 0
          if (j.rice) riceAt = (riceAt ?? passAt(row, 'rice')).clone().lerp(passAt(row, 'rice'), k * k * (3 - 2 * k))
          if (j.soup) soupAt = (soupAt ?? passAt(row, 'soup')).clone().lerp(passAt(row, 'soup'), k * k * (3 - 2 * k))
        }
      }
      // (customers' bowls at the counter, lifted onto a tray, out on it two sets side by side, and down at the place: rice on the customer's
      // left, soup on their right (item 207: drawn as the seats' are, instanced, as many as there are))
      const mv = movingBowls.current
      mv.rice.length = 0
      mv.soup.length = 0
      const ez = (x: number) => x * x * (3 - 2 * x)
      for (const b of passQ.current) {
        const tray = b.server !== undefined ? bowlTrays.current.get(b.server) : undefined
        const nth = b.server === undefined ? 0 : passQ.current.filter((x) => x.server === b.server).indexOf(b)
        const place = (kind: 'rice' | 'soup') => {
          const pass = b.row >= 0 ? passAt(b.row, kind) : null
          if (!tray) return pass
          const sideV = new THREE.Vector3(Math.cos(tray.yaw), 0, -Math.sin(tray.yaw)), fwdV = new THREE.Vector3(Math.sin(tray.yaw), 0, Math.cos(tray.yaw))
          // (two sets side by side, or with the food's plate the bowls either side of it, a little behind (item 207))
          const onTray = b.with ? tray.at.clone().addScaledVector(sideV, kind === 'rice' ? -0.11 : 0.11).addScaledVector(fwdV, -0.04).setY(tray.at.y + 0.006)
            : tray.at.clone().addScaledVector(sideV, kind === 'rice' ? -0.06 : 0.06).addScaledVector(fwdV, nth === 0 ? 0.045 : -0.045).setY(tray.at.y + 0.006)
          if (b.down > 0) {
            const k = ez(b.down), at = onTray.lerp(kind === 'rice' ? riceSpotOf(b.seat) : soupSpotOf(b.seat), k)
            at.y += Math.sin(Math.PI * k) * 0.03
            return at
          }
          if (pass && b.up < 1) {
            const k = ez(b.up), at = pass.clone().lerp(onTray, k)
            at.y += Math.sin(Math.PI * k) * 0.04
            return at
          }
          return onTray
        }
        if (b.rice) { const at = place('rice'); if (at) mv.rice.push({ key: `pass:rice:${b.guest}`, at, yaw: 0 }) }
        if (b.soup) { const at = place('soup'); if (at) mv.soup.push({ key: `pass:soup:${b.guest}`, at, yaw: 0 }) }
      }
      side.chawan.visible = !!riceAt
      if (riceAt) { side.chawan.position.copy(riceAt); fillRice(side.rice, j!.riceFill) }
      side.wan.visible = !!soupAt
      if (soupAt) { side.wan.position.copy(soupAt); fillSoup(side.soup, j!.soupFill) }
      // (the paddle in the hand scooping, else hung on the cooker; the ladle likewise in the pot)
      const paddle = pose && j?.stage === 'rice' ? pose.tool : restsAt.current.paddle
      side.shamoji.visible = !!paddle
      if (paddle) { side.shamoji.position.copy(paddle.grip); side.shamoji.quaternion.copy(paddle.q) }
      side.lump.visible = !!pose && j?.stage === 'rice' && pose.load > 0.02
      if (side.lump.visible) side.lump.scale.setScalar(Math.max(0.05, pose!.load))
      const ladle = pose && j?.stage === 'soup' ? pose.tool : restsAt.current.ladle
      side.otama.visible = !!ladle
      if (ladle) { side.otama.position.copy(ladle.grip); side.otama.quaternion.copy(ladle.q) }
      side.ladleSoup.visible = !!pose && j?.stage === 'soup' && pose.load > 0.02
      if (side.ladleSoup.visible) side.ladleSoup.scale.set(Math.max(0.1, pose!.load), 1, Math.max(0.1, pose!.load))
      const st = pose?.stream ?? null
      side.stream.visible = !!st
      if (st) { side.stream.position.copy(st[0]); side.stream.scale.set(1, Math.max(1e-3, st[0].y - st[1].y), 1) }
    }
    // (the serving counter (item 167): placed once the floor's measured; where its top and its front are, read again every second)
    if (given) placeServe()
    if (servePlace && performance.now() - serveRead.current > 1000) {
      serveRead.current = performance.now()
      const top = markOf('ServeCounterTop'), front = markOf('ServeCounterFront'), f = frame.current
      if (top && front && f) {
        SERVE_COUNTER.at = f.worldToLocal(top.getWorldPosition(SERVE_COUNTER.at ?? new THREE.Vector3()))
        SERVE_COUNTER.out = f.worldToLocal(front.getWorldPosition(SERVE_COUNTER.out ?? new THREE.Vector3())).setY(0)
      }
    }
    // (the paths' map, while it's shown in edit mode (item 168))
    { const e = getEdit(); if (e.on && e.paths) mapPaths(performance.now()) }
    SINK.dirty = dirty.current
    PILE.n = pileLeft(PILE.n, dirty.current)
    // (the counter's stack only ever the bottom of the dirty plates: those washed off the top come from the basin first, then from it)
    if (onCounter.current > dirty.current) onCounter.current = dirty.current
    // (the sink's plates put where the sink is now, once a second (item 113, the owner's, 2026-11-14: six dirty plates stood by the lantern on
    // the cook table before the shop had opened: drawn before the sink's model was in, its marks not found, they took the bar's end, and
    // nothing redrew them till the shop opened); moved in edit mode, they follow it too)
    {
      const now = performance.now()
      if (now - sinkPlaced.current > 1000) {
        sinkPlaced.current = now
        const n = Math.min(dirty.current, SINK_SHOWN)
        // (not drawn till the sink's in: put at the fallback meanwhile, the bar's end, they hung in the air over the cook table)
        const there = !!markOf('SinkTop') && !!markOf('SinkBasinFloor') && !!markOf('SinkBasket') && !!markOf('SinkFront')
        for (let i = 0; i < n; i++) { const q = sinkPlates.current[i]; if (q) { q.position.copy(dirtyAt(i)); q.visible = there } }
      }
    }
    // (the sink's plates, each as dirty as it came: as many as there are (any come by another way counted dirty as the first dish leaves one;
    // those washed off the top gone); under water each comes clean a little at a time, the top one under the running tap the faster, and
    // rinsed by it with no water standing (game/plates' soakStep); their smears faded with it)
    {
      const D = SINK.dirt, K = SINK.kinds
      while (D.length < dirty.current) D.push(DIRT_BASE)
      if (D.length > dirty.current) D.length = dirty.current
      while (K.length < dirty.current) K.push('round')
      if (K.length > dirty.current) K.length = dirty.current
      const standing = SINK.water > 0.12, running = SINK.tap || SINK.washing
      for (let i = 0; i < D.length; i++) {
        const top = i === D.length - 1
        // (those waiting on the counter (item 82) out of the water: they don't soak)
        if (i >= onCounter.current) D[i] = soakStep(D[i], step, standing || (top && running), top && running)
        for (const smear of smearsOf(sinkPlates.current[i])) { (smear.material as THREE.MeshBasicMaterial).opacity = smearOpacity(D[i]); smear.visible = D[i] > CLEAN_AT }
        showKind(sinkPlates.current[i], K[i])
      }
    }
    // (the plate the player's washing by hand (items 224, 234): where the water is, under the tap tipped to the stream, or in the water at its
    // top; coming clean there, the faster with the sponge and the liquid, and scrubbed; its smear fading, its suds; heard and said of; clean,
    // into the draining basket, and the next taken up while the press is held)
    {
      const h = hand.current, o = handObj.current, f = frame.current
      if (h && o && f && h.phase === 'toBasket') {
        // (a little arc from where it was washed into the basket's next slot, stood up on its edge as it goes)
        h.t += step
        const k = Math.min(1, h.t / HAND_TO_BASKET_S), sm = k * k * (3 - 2 * k)
        o.position.lerpVectors(h.from, basketAt(DRAIN.n), sm)
        o.position.y += Math.sin(Math.PI * sm) * 0.06
        o.rotation.set(0.5 + sm * 1.0, 0, 0)
        if (k >= 1) {
          const r = handOne(1, DRAIN)
          DRAIN.n = r.drain.n
          DRAIN.left = r.drain.left
          setPattern(drainPlates.current?.children[DRAIN.n - 1], h.design)
          DRAIN_KINDS[DRAIN.n - 1] = h.kind
          plateClink(o.getWorldPosition(SOUND_AT))
          o.visible = false
          const done = h.done + 1
          hand.current = null
          // (the press still held, more to wash and room in the basket: the next one, at once)
          if (h.down && startWash(h.px, h.py, true)) { if (hand.current) (hand.current as { done: number }).done = done }
          else { if (h.down) setTip({ title: '盤子', hint: DRAIN.n >= DRAIN_CAP ? `洗好 ${done} 個｜瀝水籃滿了，先把乾的收回碗盤架` : `洗好 ${done} 個，都洗完了` }); if (!h.down || dirty.current <= 0 || DRAIN.n >= DRAIN_CAP) endWash() }
          redraw()
        }
      } else if (h && o && f) {
        const floor = inBar('SinkBasinFloor', endOf(1)), wtop = inBar('SinkWaterTop', endOf(1)), spout = inBar('SinkSpoutTip', endOf(1))
        const running = SINK.tap || SINK.washing
        const water = SINK.water > 0.12
        h.at = running ? 'tap' : water ? 'water' : null
        // (where it's held: under the tap halfway down to the basin's floor, tipped to the stream; in the water over the drain at its top; with
        // no water, just over the basin's floor)
        if (h.at === 'tap') HAND_TO.set(spout.x, floor.y + (spout.y - floor.y) * 0.45, spout.z)
        else if (h.at === 'water') HAND_TO.set(floor.x, floor.y + (wtop.y - floor.y) * Math.min(1, Math.max(0, SINK.water)) - 0.004, floor.z)
        else HAND_TO.set(floor.x, floor.y + 0.05, floor.z)
        o.position.lerp(HAND_TO, Math.min(1, step * 12))
        o.rotation.set(h.at === 'tap' ? 0.5 : 0, 0, h.at ? 0.15 * Math.sin(performance.now() / 160) * h.scrub : 0)
        o.visible = true
        // (coming clean; the washing-up liquid on the sponge, or in the water it's in, used once as a plate comes clean with it)
        const soap = SINK.soap > 0 && (SINK.sponge || h.at === 'water')
        const was = h.dirt
        h.dirt = handClean(h.dirt, step, h.at, { sponge: SINK.sponge, soap, scrub: h.scrub })
        if (soap && h.at) h.soaped = true
        if (was > CLEAN_AT && h.dirt <= CLEAN_AT && h.soaped) SINK.soap = scrubbed(SINK.soap)
        h.scrub *= Math.max(0, 1 - step * 2.5)
        for (const sm of smearsOf(handIn.current)) { (sm.material as THREE.MeshBasicMaterial).opacity = smearOpacity(h.dirt); sm.visible = h.dirt > CLEAN_AT }
        const suds = !!h.at && SINK.sponge && soap && h.dirt > CLEAN_AT
        handFoam.current?.children.forEach((c, i) => { const k = suds ? FOAM_AT[i][2] * (0.65 + 0.35 * h.scrub) : 0; c.scale.set(k, k * 0.6, k); c.visible = k > 0.03 })
        // (the tap's stream stopped on it, unless the owner's at the sink with his own)
        if (!bossWash.current) HAND_WASH.stream = h.at === 'tap' ? f.localToWorld(HAND_STREAM.copy(o.position)) : null
        // (heard: a splash as it goes into the water or under the stream, the sponge as it's scrubbed)
        const now = performance.now()
        if (!!h.at !== h.wet) { h.wet = !!h.at; if (h.wet) washSplash(o.getWorldPosition(SOUND_AT)) }
        if (h.at && SINK.sponge && h.scrub > 0.25 && now - h.heard > 650) { h.heard = now; scrubSound(nearCam(o.getWorldPosition(SOUND_AT))) }
        // (said of, a few times a second)
        if (now - h.said > 200) {
          h.said = now
          setTip({ title: '盤子', hint: handSays(h.at, h.dirt, { sponge: SINK.sponge, soap, basketFull: DRAIN.n >= DRAIN_CAP }) })
        }
        // (clean: into the basket, by itself; the basket full, held clean till it's let go of)
        if (h.dirt <= CLEAN_AT && DRAIN.n < DRAIN_CAP) { h.phase = 'toBasket'; h.t = 0; h.from.copy(o.position) }
      }
    }
    DRYER.open = waiters.current.some((x) => x.phase === 'wash' || x.phase === 'unloadTake') ? 1 : 0
    SINK.washing = waiters.current.some((x) => x.phase === 'wash' || x.phase === 'handwash' || x.phase === 'skWash') || wash.current !== null || RICE.washing
    // (every plate told over: the racks', the sink's, the washer's, the basket's, and the rest out (at the plating place, on their way, at the
    // seats))
    PLATE_COUNT.rack = PLATE_RACK.n
    PLATE_COUNT.low = LOW_RACK.n
    PLATE_COUNT.sink = dirty.current
    PLATE_COUNT.washer = DRYER.n
    PLATE_COUNT.basket = DRAIN.n
    PLATE_COUNT.out = Math.max(0, PLATES_ALL - PLATE_RACK.n - LOW_RACK.n - dirty.current - DRYER.n - DRAIN.n)
    if (drainPlates.current) {
      // (nor the basket's till its marks are found (as the sink's own))
      if (DRAIN.n > 0 && markOf('SinkRackSlot0') && markOf('SinkRackSlot1')) {
        const along = inBar('SinkRackSlot1', endOf(1)).sub(inBar('SinkRackSlot0', endOf(1))).normalize()
        drainPlates.current.children.forEach((c, i) => {
          c.visible = i < DRAIN.n
          if (c.visible) { c.position.copy(basketAt(i)); c.quaternion.setFromUnitVectors(UP_Y, along); showKind(c, DRAIN_KINDS[i] ?? 'round') }
        })
      } else drainPlates.current.children.forEach((c) => { c.visible = false })
    }
    // (the plating place's stack of clean plates, the plates in the dryer, and the sticks in the bin: as many drawn as there are)
    plateStack.current?.children.forEach((c, i) => { c.visible = i < PLATING.stock })
    // (nor the dryer's till its marks are found (the owner, 2026-11-15: a row of plates stood in the air over the fire bed, at the bar's end))
    if (DRYER.n > 0 && dryerPlates.current && markOf('SinkDryerRack0') && markOf('SinkDryerRack1')) {
      const along = dryerAt(1).sub(dryerAt(0)).normalize()
      dryerPlates.current.children.forEach((c, i) => {
        c.visible = i < DRYER.n
        if (c.visible) { c.position.copy(dryerAt(i)); c.quaternion.setFromUnitVectors(UP_Y, along) }
      })
    } else dryerPlates.current?.children.forEach((c) => { c.visible = false })
    // (what each of the kitchen's people has in hand, laid out above: for the hearth's guard to move with them if it puts them out of the cook
    // table (bar's CARRIED; each one's list kept and refilled, nothing made a frame))
    const heldBy = (o: THREE.Object3D) => { let a = CARRIED.get(o); if (!a) { a = []; CARRIED.set(o, a) } a.length = 0; return a }
    const po = platerObj.current
    if (po) {
      const h = heldBy(po)
      if (platerStack.current) h.push(platerStack.current)
      if (platerCoal.current) h.push(platerCoal.current)
      if (platerDipper.current) h.push(platerDipper.current)
      if (platerBowl.current) h.push(platerBowl.current)
      if (platerBall.current) h.push(platerBall.current)
    }
    waiters.current.forEach((w, wi) => {
      const o = waiterObjs.current[wi]
      if (!o) return
      const h = heldBy(o)
      const so = stackObjs.current[wi], rag = ragObjs.current[wi], sb = serverSkewers.current
      if (so) h.push(so)
      if (rag) h.push(rag)
      if (sb && sb.userData.by === wi) h.push(sb)
      if (w.carry) for (const key of w.carry) { const r = runObjs.current.get(key); if (r) h.push(r) }
      const pr = runObjs.current.get(w.run ?? -1)
      if (pr) h.push(pr)
    })
  })

  // (the customers' shoes at the door and the soy at their places, for SeatBits: worked out again only when who's in, and where, changes)
  const seatSoys = useMemo(() => seats.map((_, n) => n).filter((n) => soyMask.current & (1 << n)).map((n) => {
      const st = seats[n], c = counters[st.counter]
      // (into the dish where it stands (it may have been moved in edit mode: Roasting's BarTableware notes it), else where it's laid)
      const dish = SOY_DISH_AT.get(n), f = frame.current
      if (dish && f) return f.worldToLocal(dish.clone()).setY(top + 0.013)
      const x = st.mid.clone().sub(c.at).dot(c.along)
      return st.mid.clone().addScaledVector(c.along, sauceSide(c, BAR_GATES[st.counter], x)).addScaledVector(c.lay, PLACE.sauce[1]).setY(top + 0.013)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [soyMask.current, seats, counters, top])

  // (the bowls of miso soup set at their places (bar.ts's SOUP_SEATS: Roasting ladles them out): on the other side of their plate from the soy)
  const [soupVer, setSoupVer] = useState(SOUP.served)
  useFrame(() => { if (SOUP.served !== soupVer) setSoupVer(SOUP.served) })
  /** where a place's bowl of soup is set (the plate's other side from its soy), and its rice: in front of the plate toward the soy's side,
   * on the customer's left of it or right as there's room, clear of the plate and of whatever stands on the bar (item 205) */
  // (kept for the customers' hands: soupWorld above)
  soupSpot.current = (n: number) => soupSpotOf(n)
  function soupSpotOf(n: number) {
    const st = seats[n], c = counters[st.counter]
    const x = st.mid.clone().sub(c.at).dot(c.along)
    return st.mid.clone().addScaledVector(c.along, -sauceSide(c, BAR_GATES[st.counter], x) * 1.15).addScaledVector(c.lay, PLACE.sauce[1]).setY(top + 0.002)
  }
  const riceSpotOf = (n: number) => {
    const st = seats[n], c = counters[st.counter]
    const x = st.mid.clone().sub(c.at).dot(c.along), sd = sauceSide(c, BAR_GATES[st.counter], x)
    const boxes = thingsOnBar(), soupAt = soupSpotOf(n)
    // (clear of the plate as it is (item 228): the long one lies along the counter, its length and width; a round one its round)
    const kind = guestsNow.current.find((g) => g.seat === n && (g.state === 'waiting' || g.state === 'eating'))?.plate ?? 'round'
    const dims = PLATE_DIMS[kind]
    const offPlate = (p: THREE.Vector3) => {
      const d = p.clone().sub(st.plate).setY(0)
      return kind === 'long' ? Math.abs(d.dot(c.along)) > dims.l / 2 + 0.06 || Math.abs(d.dot(c.lay)) > dims.w / 2 + 0.06 : d.length() > dims.w / 2 + 0.07
    }
    const clear = (p: THREE.Vector3) => offPlate(p) && p.distanceTo(soupAt.clone().setY(p.y)) > 0.12
      && !boxes.some((b) => b.distanceToPoint(new THREE.Vector2(p.x, p.z)) < 0.058)
    // (beside the plate toward the soy's side as there's room; with the long plate along the counter, in front of it, nearer the customer)
    for (const [a, l] of [[sd * 0.13, -0.05], [sd * 0.17, -0.03], [-sd * 0.13, -0.05], [sd * 0.22, 0.0], [0, -0.07], [sd * 0.08, -0.12], [-sd * 0.08, -0.12], [sd * 0.26, -0.04]] as const) {
      const p = st.mid.clone().addScaledVector(c.along, a).addScaledVector(c.lay, l).setY(top + 0.002)
      if (clear(p)) return p
    }
    return st.mid.clone().addScaledVector(c.along, sd * 0.13).addScaledVector(c.lay, -0.05).setY(top + 0.002)
  }
  const [bowlVer, setBowlVer] = useState(BOWLS.ver)
  useFrame(() => { if (BOWLS.ver !== bowlVer) setBowlVer(BOWLS.ver) })
  const seatBowls = useMemo(() => ({
    rice: [...RICE_SEATS].filter((n) => seats[n]).map((n) => ({ key: `rice:${n}`, at: riceSpotOf(n), yaw: 0 })),
    soup: [...SOUP_SEATS].filter((n) => seats[n] && BOWLS.setAt.has(`soup:${n}`)).map((n) => ({ key: `soup:${n}`, at: soupSpotOf(n), yaw: 0 })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bowlVer, soupVer, seats, counters, top])
  if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __seatBowls: seatBowls })
  const seatSoups = useMemo(() => [...SOUP_SEATS].filter((n) => seats[n] && !BOWLS.setAt.has(`soup:${n}`)).map((n) => {
    const st = seats[n], c = counters[st.counter]
    const x = st.mid.clone().sub(c.at).dot(c.along)
    return st.mid.clone().addScaledVector(c.along, -sauceSide(c, BAR_GATES[st.counter], x) * 1.15).addScaledVector(c.lay, PLACE.sauce[1]).setY(top + 0.002)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [soupVer, bowlVer, seats, counters, top])
  // (the tokkuri of sake and its cup set at their places (bar.ts's SAKE_SEATS: Roasting pours them, item 89): past the soup, further out
  // along the bar from their plate)
  const [sakeVer, setSakeVer] = useState(SAKE.served)
  useFrame(() => { if (SAKE.served !== sakeVer) setSakeVer(SAKE.served) })
  const seatSakes = useMemo(() => {
    for (const n of [...sakeSpots.current.keys()]) if (!SAKE_SEATS.has(n) && sakeJob.current?.seat !== n) sakeSpots.current.delete(n)
    return [...SAKE_SEATS].filter((n) => seats[n]).map((n) => {
      const { at, cup } = sakeSpotOf(n)
      return { at, cup }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sakeVer, seats, counters, top])

  // (item 374) what's here from the first and never changes with what goes on: the plating place's carrier dishes and its spare stack, the
  // dryer's and the draining basket's plates, the plate washed by hand and its suds; and what the kitchen carries (coal, the dipper, the
  // skewers, a rice ball, the rice bowl, a stack of plates): hidden or shown, moved and filled frame by frame through their refs. Made once:
  // made afresh each time the bar was drawn (several times a second while the shop's open), some two hundred elements went through React
  // again each time for nothing
  const sinkKit = useMemo(() => (<>
        {/* (a carrier dish under a later dish at the plating place, its seat's plate out already: never the bare table (the owner's); not one
            of the shop's plates, it goes with the food) */}
        {given && Array.from({ length: READY_SLOTS }, (_, k) => (
          <group key={`carrier${k}`} name={`plating-carrier-${k}`} ref={(o) => { carriers.current[k] = o }} position={platingPlace(readyAlong(k))} scale={ON_TABLE * 0.8} visible={false}
            {...shownOver('盤子', '裝盤處｜下一道菜放在這裡等')}><Plate design={k + 3} /></group>
        ))}
        {/* the plating place's stack of clean plates (the kitchen brings them from the racks; one's laid for a seat as its first food comes off the fire) */}
        {given && (
          <group ref={plateStack} name="plating-stack" position={platingPlace(PLATE_STACK_ALONG).addScaledVector(plating.across, PLATE_STACK_ACROSS)}
            {...shownOver('乾淨的盤子', '裝盤處的備用盤｜菜一烤好就拿一個來裝')}>
            {Array.from({ length: PASS_STACK_SHOWN }, (_, i) => (
              <group key={i} position={[0, i * NEST_GAP * ON_TABLE, 0]} rotation-y={i * 1.1} scale={ON_TABLE} visible={false}><Plate design={i + 5} /></group>
            ))}
          </group>
        )}
        {/* the washed plates standing in the dish dryer under the sink's counter (seen through its glass door), and the used sticks in the bin
            beside it (cleared off the customers' plates with them) */}
        {given && (
          <group ref={dryerPlates} {...shownOver('洗好的盤子', '在烘碗機裡烘乾｜乾了外場搬回碗盤架')}>
            {Array.from({ length: DRYER_CAP }, (_, i) => <group key={i} scale={IN_SINK} visible={false}><Plate design={i + 1} /></group>)}
          </group>
        )}
        {/* (and those washed by hand while the washer was busy, standing in the draining basket on the sink's counter) */}
        {given && (
          <group ref={drainPlates} name="drain-plates" {...shownOver('洗好的盤子', '手洗的，立在瀝水籃裡瀝乾')}>
            {/* (drawn shallower than they are, so thirty stood in their notches show a gap between each (the owner's, 2026-11-12): the shop's
                plates are deep, and at the notches' pitch they lay nested into one another) */}
            {Array.from({ length: DRAIN_CAP }, (_, i) => <group key={i} scale={IN_DRAIN} visible={false}><PlateKinds design={i + 2} /></group>)}
          </group>
        )}
        {/* (the owner washing up by hand (item 174): the plate in his hand, the suds on it; the drops off its edge) */}
        {given && (
          <group ref={washHeld} name="wash-plate" visible={false}>
            <group ref={washPlateIn} scale={IN_SINK}>
              <PlateKinds dirty design={0} />
              <group ref={washFoam}>
                {FOAM_AT.map(([x, z], i) => <mesh key={i} geometry={FOAM_GEO} material={FOAM_MAT} position={[x, 0.016, z]} visible={false} raycast={() => {}} />)}
              </group>
            </group>
          </group>
        )}
        {/* (the plate the player's washing by hand (item 224): at the pointer, under the tap or in the water; its suds) */}
        <group ref={handObj} name="hand-plate" visible={false}>
          <group ref={handIn} scale={IN_SINK}>
            <PlateKinds dirty design={0} />
            <group ref={handFoam}>
              {FOAM_AT.map(([x, z], i) => <mesh key={i} geometry={FOAM_GEO} material={FOAM_MAT} position={[x, 0.016, z]} visible={false} raycast={() => {}} />)}
            </group>
          </group>
        </group>
        {given && (
          <group ref={washDrips} name="wash-drips">
            {[0, 1, 2].map((i) => <mesh key={i} geometry={DRIP_GEO} material={DRIP_MAT} visible={false} raycast={() => {}} />)}
          </group>
        )}
  </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [given])
  const carryKit = useMemo(() => (<>
        {given && (
          <group ref={platerCoal} name="plater-coal" visible={false}>
            {/* (a handful of binchotan held across both hands) */}
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} position={[(i - 2) * 0.018, (i % 2) * 0.012, 0]} rotation={[Math.PI / 2, 0, (i - 2) * 0.12]} geometry={COAL_STICK_GEO} material={COAL_STICK_MAT} />
            ))}
          </group>
        )}
        {given && (
          <group ref={platerDipper} name="plater-dipper" visible={false}>
            {/* (a wooden dipper: its cup out front, its handle back to the hands) */}
            <mesh position={[0, 0, 0.12]} geometry={DIPPER_CUP_GEO} material={DIPPER_MAT} />
            <mesh name="dipper-water" position={[0, 0.022, 0.12]} rotation-x={-Math.PI / 2} geometry={DIPPER_WATER_GEO} material={DIPPER_WATER_MAT} />
            <mesh position={[0, 0.02, 0.04]} rotation-x={Math.PI / 2 - 0.25} geometry={DIPPER_HANDLE_GEO} material={DIPPER_MAT} />
          </group>
        )}
        {given && [platerSkewers, serverSkewers].map((ref, k) => (
          <group key={k} ref={ref} visible={false}>
            {/* (a bundle of iron skewers held across the hands) */}
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} position={[(i - 3) * 0.008, (i % 2) * 0.006, 0]} rotation={[Math.PI / 2, 0, (i - 3) * 0.03]}>
                <cylinderGeometry args={[0.0022, 0.0022, 0.17, 5]} /><meshStandardMaterial color="#c9ccd1" metalness={0.85} roughness={0.35} />
              </mesh>
            ))}
          </group>
        ))}
        {given && (
          <group ref={platerBall} visible={false}>
            {/* (a rice ball in the making, and its band of nori) */}
            <mesh geometry={BALL_GEO}><meshToonMaterial color="#f6f3ea" /></mesh>
            <mesh name="ball-nori" geometry={BALL_NORI_GEO} position={[0, -0.012, 0]}><meshToonMaterial color="#1d2a1e" /></mesh>
          </group>
        )}
        {given && (
          <group ref={platerBowl} name="plater-bowl" visible={false}>
            {/* (a wooden rice-washing bowl, the rice in it) */}
            <mesh geometry={RICE_BOWL_GEO}><meshToonMaterial color="#b98b56" side={THREE.DoubleSide} /></mesh>
            <mesh name="bowl-rice" geometry={RICE_IN_GEO} position={[0, 0.045, 0]}><meshToonMaterial color="#f6f2e8" /></mesh>
          </group>
        )}
        {given && (
          <group ref={platerStack} visible={false} {...shownOver('乾淨的盤子', '從碗盤櫃補到裝盤處')}>
            {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, i * NEST_GAP * IN_SINK, 0]} rotation-y={i * 1.1} scale={IN_SINK}><Plate design={i + 7} /></group>)}
          </group>
        )}
  </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [given])
  // (item 374) each customer's hit box given the same callbacks each time the bar's drawn: made once for each of them, reading them (and the
  // language) as they are when called; made afresh each time, every customer's hit box was drawn again with the bar, several times a second
  const langNow = useRef(lang)
  langNow.current = lang
  const moveNow = useRef(canMove)
  moveNow.current = canMove
  const grabNow = useRef(grab)
  grabNow.current = grab
  const hits = useRef(new Map<number, { title: () => string; hint: () => string; onPointerDown: (e: ThreeEvent<PointerEvent>) => void; grabbable: () => boolean }>())
  const hitOf = (id: number) => {
    let h = hits.current.get(id)
    if (h) return h
    const now = () => shownRef.current.find((x) => x.id === id)
    h = {
      title: () => guestLabel(id, langNow.current),
      hint: () => {
        const v = now(), l = langNow.current
        return v && moveNow.current(v) ? (l === 'ja' ? 'ドラッグして空席へ' : l === 'en' ? 'Drag to a free seat' : '拖曳到空位換座位') : ''
      },
      onPointerDown: (e) => { const v = now(); if (v) grabNow.current(v)(e) },
      grabbable: () => { const v = now(); return !getEdit().on && !!v && moveNow.current(v) },
    }
    hits.current.set(id, h)
    return h
  }
  // (and the bench's and the genkan's waiting customers' fading and standing still read through callbacks made once for each of them)
  const benchFades = useRef(new Map<number, () => number>())
  const benchFadeOf = (id: number) => {
    let f = benchFades.current.get(id)
    if (!f) benchFades.current.set(id, (f = () => sitters.current.get(id)?.fade ?? 0))
    return f
  }
  const visitorCalls = useRef(new Map<number, { fade: () => number; still: () => boolean }>())
  const visitorOf = (id: number) => {
    let c = visitorCalls.current.get(id)
    if (!c) visitorCalls.current.set(id, (c = { fade: () => visitors.current.get(id)?.fade ?? 0, still: () => visitors.current.get(id)?.phase === 'wait' }))
    return c
  }
  // (those gone let go of)
  useEffect(() => { for (const id of [...hits.current.keys()]) if (!shown.some((x) => x.id === id)) hits.current.delete(id) }, [shown])
  useEffect(() => { for (const id of [...benchFades.current.keys()]) if (!sitterList.some((x) => x.id === id)) benchFades.current.delete(id) }, [sitterList])
  useEffect(() => { for (const id of [...visitorCalls.current.keys()]) if (!visitorList.some((x) => x.id === id)) visitorCalls.current.delete(id) }, [visitorList])

  // (what mounts a stage later, made once for what it's made with: it was made again with every redraw of the bar, three times a second,
  // its stage's wrappers drawn again each time (item 374))
  const shopPropsLater = useMemo(() => <Later stage={2}><ShopProps counters={counters} /></Later>, [counters])
  const fridgesLater = useMemo(() => (fridges ? <Later stage={2}><Fridges fridges={fridges} /></Later> : null), [fridges])
  // (the serving counter, the takeaway stand and the benches, made once for what they're made with (item 374): drawn in the bar's own
  // render, they and all in them were drawn again with every redraw of the bar, 3.4 times a second (Movable 13.5 a second))
  const servePiece = useMemo(() => servePlace && (
    <Movable id="servecounter" label="備餐檯" ground={0} blocks>
      <group name="look-servecounter" position={servePlace.at.toArray()} rotation-y={servePlace.yaw}><ServeCounter /><SakeStation /></group>
    </Movable>
  ), [servePlace])
  const standPiece = useMemo(() => given && (
    <Movable id="takeoutstand" label="外帶桌">
      <group position={[STAND_AT.x, 0, STAND_AT.z]} rotation-y={STAND_AT.yaw}>
        <TakeoutStandModel />
        <group ref={standTop} name="takeout-stand-top" position-y={STAND_TOP} userData={{ marker: true }} />
        {STAND_SLOTS.map(([x, z, a], k) => (
          <group key={k} ref={(o) => { standBags.current[k] = o }} position={[x, STAND_TOP, z]} rotation-y={a} visible={false}><KraftBag /></group>
        ))}
        {/* (the old rice tub on its back half, as the warming tub (the owner's, 2026-11-11)) */}
        <group position={[0, STAND_TOP, WARM_TUB_Z]}><WarmTub /></group>
      </group>
    </Movable>
  ), [given])
  const benchPieces = useMemo(() => given && takeoutWay && (
    <>
      <Movable id="bench" label="候位長凳">
        <group position={[takeoutWay.bench.x, BENCH_PLACE.y, takeoutWay.bench.z]} rotation-y={takeoutWay.benchYaw}>
          {/* (drawn at the customers' size, as the stools are, the same every way (it was squashed along and across to fit, its
              proportions off: the owner's, 2026-11-11)) */}
          <group scale={PEOPLE_SCALE}><WaitingBench /></group>
        </group>
        {/* (its places, where those waiting sit: they go with it, moved by hand) */}
        {takeoutWay.benchSpots.slice(0, BENCH_EACH).map((p, k) => (
          <group key={k} name={`bench-place-${k}`} position={p} userData={{ marker: true }} ref={(o) => { if (o) BENCH_MARKS.set(k, o); else BENCH_MARKS.delete(k) }} />
        ))}
      </Movable>
      {/* (the second bench, along the wall toward the cat stand, under the shrine: the same bench, its own three places (the owner's, 2026-11-12)) */}
      <Movable id="bench2" label="候位長凳（二）">
        <group position={[takeoutWay.bench2.x, BENCH_PLACE.y, takeoutWay.bench2.z]} rotation-y={takeoutWay.benchYaw}>
          <group scale={PEOPLE_SCALE}><WaitingBench /></group>
        </group>
        {takeoutWay.benchSpots.slice(BENCH_EACH).map((p, j) => {
          const k = BENCH_EACH + j
          return <group key={k} name={`bench-place-${k}`} position={p} userData={{ marker: true }} ref={(o) => { if (o) BENCH_MARKS.set(k, o); else BENCH_MARKS.delete(k) }} />
        })}
      </Movable>
    </>
  ), [given, takeoutWay])
  return (
    <group ref={frame} name="bar-frame" scale={scale} position={offset}>
      {/* (the walking paths' map, in edit mode when asked for (item 168)) */}
      <PathMap />
      {/* (what a press of the soap or a squeeze of the washing-up liquid gives out, seen (item 289): one small pool of them for the shop) */}
      <Drips />
      {/* (the keep-clear patches (item 168): put down by the serving counter, moved and sized by hand) */}
      <PathZones home={zoneHome} />
      <PathVias home={viaHome} />
      {/* (the serving counter, in the corridor between the cook table and the freezer (item 167)) */}
      {servePiece}
      {/* (one customer made with the page, never shown: their program linked while it loads) */}
      {people && <Suspense fallback={null}><FolkWarm /></Suspense>}
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
              <DiningFloor c={c} from={back} to={c.length / 2 + 1.45} bare={!!given} wall={!given} />
              {/* (and past the bar's end, a strip more behind the till for the cashier to stand on; a shop laid out
                  in full has one floor under all of it instead) */}
              {given && <RoomFloor counters={counters} drop={KITCHEN_DROP / scale} />}
              {given && shopPropsLater}
              {given && <DiningWall c={c} from={back} to={c.length / 2 + 1.45} far={FLOOR_FAR} lampId="barlamp" lampName="長吧台" top={top} altar={omiki ?? true} corner={wallBack}
                staffDoor={STAFF_DOOR_AT} />}
            </group>
          )
        }
        const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
        // (where its wall's line reaches the first counter's wall)
        const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(unit(c0.lay))) / unit(c.along).dot(unit(c0.lay))
        return (
          <group key={i}>
            <DiningFloor c={c} from={-c.length / 2 - 0.35} to={meet} far={farOf(c)} bare={!!given} wall={!given} />
            {/* (its wall runs on into the corner, to meet the first counter's: the toilet's door in that stretch) */}
            {given && <DiningWall c={c} from={-c.length / 2 - 0.35} to={corner} far={farOf(c)} lampId="sidelamp" lampName="側吧台" top={top} door={wcs?.door ?? (meet + corner) / 2}
              clear={fridgeClear} hang={koiHang(fridgeClear ?? [], -c.length / 2 - 0.35, wcs?.door ?? (meet + corner) / 2)} />}
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
      {/* their shoes, left in pairs on the genkan's stone by the step, a pair for each of them inside (all of them one draw: SeatBits) */}
      {given && <SeatBits shoes={NO_SHOES} soys={seatSoys} soups={seatSoups} />}
      {/* (the rice and soup bowls at the places, eaten down; and the bowls, the paddle and the ladle of the one filling and serving them (items 205, 206)) */}
      {given && <SeatBowls rice={seatBowls.rice} soup={seatBowls.soup} />}
      {/* (the bowls at the counter and out on the trays (item 207): the same lists every frame, refilled) */}
      {given && <SeatBowls rice={movingBowls.current.rice} soup={movingBowls.current.soup} />}
      {given && <><primitive object={side.chawan} /><primitive object={side.wan} /><primitive object={side.shamoji} /><primitive object={side.holder} /><primitive object={side.otama} /><primitive object={side.stream} /></>}
      {given && seatSakes.map((k, i) => (
        <group key={i} position={k.at}><Tokkuri /><group position={k.cup}><SakeCup level={0.8} /></group></group>
      ))}
      {/* (a customer's tokkuri and its cup on their way: poured into at the sake station, waiting at the pass, on a server's tray (item 177)) */}
      {given && <group ref={sakeJugObj} name="sake-going-jug" visible={false}><Tokkuri /></group>}
      {given && <group ref={sakeCupObj} name="sake-going-cup" visible={false}><SakeCup level={0} /></group>}
      {/* (the fridges' own light inside, always on: it lights the drinks whatever the room's light, and shows the more with the lamps out; one
          for the pair, between them, and here from the first, not with the fridges as they come in later: a light added to the scene has every
          material in it made again, a stall) */}
      {fridges && QUALITY.tier === 'high' && (
        <pointLight position={fridges[0].at.clone().lerp(fridges[1].at, 0.5).setY(FRIDGE.H * 0.55)} color="#eaf4ff" intensity={1.1} distance={FRIDGE.H * 2.4} decay={1.4} />
      )}
      {fridges && fridgesLater}
      {/* what each has fetched from the fridge, stood beside their plate, toward the cook (a sake's cup a little nearer them): drunk down sip by
          sip, off the bar in their hand while it's up at their mouth */}
      {given && shown.filter((s) => s.drink && s.phase !== 'leave' && !(s.phase.startsWith('wc') && s.wc?.who === 'drink')).map((s) => (
        <SeatDrink key={`drink${s.id}`} s={s} id={s.drink as DrinkId} at={drinkSpot(s.seat, false)} cupAt={cupped(s.drink!) ? drinkSpot(s.seat, true) : null}
          clock={clock} level={1 - (s.drunk ?? 0)} />
      ))}
      {/* (each seated customer's soy in the little dish at their place, a dab of grated daikon in it: drawn with the shoes, SeatBits) */}
      {/* the dirty plates waiting in the sink, and the plates out: on their way to a seat, at it, cleared away, washed and going back */}
      {Array.from({ length: Math.min(dirty.current, SINK_SHOWN) }, (_, i) => (
        <group key={`d${i}`} name={`sink-dirty-${i}`} ref={(o) => { sinkPlates.current[i] = o }} position={dirtyAt(i)} rotation-y={i * 0.9} scale={IN_SINK}
          // (the dirty plates taken up to wash one (the owner, 2026-11-15: "I can't wash up by hand": the stack did nothing))
          // (and the thing to click next for washing up by hand lit up while they're pointed at (item 215))
          onPointerOver={(e) => { if (getEdit().on || HAND_WASH.held) return; e.stopPropagation(); tipOver('髒盤子', basinHint()).onPointerOver(e); guideOn() }}
          onPointerOut={(e) => { if (getEdit().on || HAND_WASH.held) return; tipOver('髒盤子', '').onPointerOut(e); guideOff() }}
          // (a press takes the top one up in the player's own hand, to be washed under the tap or in the water (item 224))
          onPointerDown={takeUp}><PlateKinds dirty design={i} /></group>
      ))}
      {sinkKit}
      {/* (the kitchen's plater, off their place on the way to the racks and back with plates for the plating place; at their place, Roasting draws them;
          the plates in their hands) */}
      {given && !ownerServes && (
        <group ref={(o) => {
          const was = platerObj.current
          if (was && was !== o) { KITCHEN_FOLK.delete(was); FIGURES.delete(was) }
          platerObj.current = o
          // (out from his place and back to it: the third cook's is his bay, the second cook's his board; none, the owner)
          if (o) { KITCHEN_FOLK.add(o); FIGURES.set(o, !plater ? 'owner' : plater.role === 'sous' ? 'sous' : 'other') }
        }} name="plater-walker" scale={STAFF_SCALE} visible={false}>
          <BlobShadow r={0.17} />
          {plater ? <StaffFigure id={plater.id} role={plater.role} look={plater.look} /> : <OwnerWalker />}
        </group>
      )}
      {carryKit}
      {/* (a server's stack of dried plates, on their tray on the way from the dryer back to the racks) */}
      {waiters.current.map((_, wi) => (
        <group key={`stack${wi}`} ref={(o) => { stackObjs.current[wi] = o }} visible={false} {...shownOver('洗好的盤子', '外場搬回碗盤架')}>
          {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, i * NEST_GAP * IN_SINK, 0]} rotation-y={i * 1.1} scale={IN_SINK} name={`stack-plate-${i}`}><Plate design={i + 3} /></group>)}
        </group>
      ))}
      {/* (each server's cloth, out on the bar as they wipe it down) */}
      {waiters.current.map((_, wi) => (
        <mesh key={`rag${wi}`} name={`bar-rag-${wi}`} ref={(o) => { ragObjs.current[wi] = o }} geometry={RAG_GEO} visible={false} raycast={() => {}}>
          <meshToonMaterial color="#f2efe6" />
        </mesh>
      ))}
      {runs.current.map((r) => (
        // (pointed at, it says whose it is and where it is in its round (item 279): read as the pointer comes onto it, the run as it is then)
        <group key={r.key} name={`plate-run-${r.key}`}
          {...shownOver(PLATE_NAME[r.kind ?? 'round'], () => plateSays({ phase: r.phase, seat: r.seat, bones: r.bones, sticks: r.sticks, tissue: !!r.tissue, drink: !!r.glass }))}
          ref={(o) => {
          if (!o) { const was = runObjs.current.get(r.key); if (was) PLATE_FACES.delete(was); return void runObjs.current.delete(r.key) }
          runObjs.current.set(r.key, o)
          // (a plate a piece can be rested on, its face found by a ray (Roasting, item 258))
          PLATE_FACES.add(o)
          if (!o.userData.placed) {
            o.userData.placed = true
            o.position.copy(r.from)
          }
        }}>
          <Plate kind={r.kind ?? 'round'} dirty={r.phase === 'clear' || r.phase === 'dirty' || r.phase === 'taken'} dirt={r.dirt ?? 1} design={designOf(r.key)} sticks={r.sticks ?? 1} bones={r.bones ?? 0} glass={r.glass && (r.phase === 'taken' ? GLASS_ON : r.glass)} drink={r.drink} level={r.level}
            garnish={r.phase === 'home' ? undefined : r.phase === 'clear' || r.phase === 'dirty' || r.phase === 'taken' ? 'left' : 'full'}
            tissue={r.tissue && (r.phase === 'taken' ? TISSUE_ON : r.tissue)} />
        </group>
      ))}
      <Later stage={3}>
      {given && fridges && stocker && <Stocker counters={counters} fridges={fridges} who={stocker} />}
      {/* (what the staff and the owner say as the day ends and begins, over their heads) */}
      {given && <StaffWords />}
      {/* (the worn out among the staff, while the shop's open: a debuff beside each (the owner's)) */}
      {given && open && <TiredBadges />}
      {/* (what's just been paid, rising green over the one who paid it, and gone) */}
      {payFloats.map((f) => <PayFloat key={f.key} text={f.text} follow={() => groups.current.get(f.id)} done={() => setPayFloats((all) => all.filter((x) => x.key !== f.key))} />)}
      {/* (the owner gone to wash the stack left on the sink's counter (item 103), or the player's washing up (item 166): only while he's at it;
          there with nobody hired too, as he's at the fire while the shop's shut and it's him who goes then) */}
      {(
        <group ref={(o) => {
          const was = bossObj.current
          if (was && was !== o) { KITCHEN_FOLK.delete(was); FIGURES.delete(was) }
          bossObj.current = o
          if (o) { KITCHEN_FOLK.add(o); FIGURES.set(o, 'owner') }
        }} scale={STAFF_SCALE} visible={false} userData={{ broom: false }}>
          <BlobShadow r={0.2} />
          <OwnerWalker />
        </group>
      )}
      {ownerServes && (
        <group ref={(o) => {
          const was = waiterObjs.current[0]
          if (was && was !== o) { KITCHEN_FOLK.delete(was); FIGURES.delete(was) }
          waiterObjs.current[0] = o
          if (o) { KITCHEN_FOLK.add(o); FIGURES.set(o, 'owner') }
        }} position={ownerAt()} rotation-y={OWNER_YAW} scale={STAFF_SCALE} visible={false}>
          <BlobShadow r={0.2} />
          <OwnerWalker />
        </group>
      )}
      {!ownerServes && servers.slice(0, homes.length).map((w, i) => (
        <group key={w.id} ref={(o) => {
          const was = waiterObjs.current[i]
          if (was && was !== o) { KITCHEN_FOLK.delete(was); FIGURES.delete(was) }
          waiterObjs.current[i] = o
          if (o) { KITCHEN_FOLK.add(o); FIGURES.set(o, 'other') }
        }} position={homes[i].at} rotation-y={homes[i].yaw} scale={STAFF_SCALE} userData={{ staffId: w.id }}>
          <BlobShadow r={0.17} />
          <StaffFigure id={w.id} role="server" look={w.look} />
        </group>
      ))}
      {people && shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const walking = s.phase !== 'sit'
        return (
          <group key={s.id} position={s.from ?? doorLead.start ?? wayIn} userData={{ guest: s.id }} ref={(o) => { if (o) { groups.current.set(s.id, o); FIGURES.set(o, 'other') } else groups.current.delete(s.id) }}>
            {/* (a soft shadow under them, sat or walking) */}
            <BlobShadow r={0.17 * PEOPLE_SCALE} />
            <group scale={PEOPLE_SCALE}>
              <PersonClock s={s} phase={s.wcSit ? 'wcSit' : s.phase === 'sit' && s.wipeAt ? 'wipe' : s.phase} drink={s.drink} eating={s.phase === 'sit' && FED.has(s.id)}
                clock={clock} talk={talkSide(s)} mood={g ? moodOf(g) : null} plateOf={plateWorld} drinkOf={drinkWorld} soupOf={soupWorld} drunk={s.drunk} />
              {/* (named as the pointer's over them; picked up and carried to another stool while they wait) */}
              <FigureHit {...hitOf(s.id)} />
            </group>
            {/* (their label just over their head, sat up on the seat or standing) */}
            <GuestLabel id={s.id} y={((walking ? 0 : FOLK_SEAT) + FOLK_HEIGHT * FOLK_FIT * folkSpec(s.id).size) * PEOPLE_SCALE + 0.08}
              dots={!!g && !walking && g.state === 'waiting' && g.rating === null} rating={g?.rating ?? null} angry={g?.state === 'angry'}
              partner={g?.partner !== undefined && !g?.family} name={guestLabel(s.id, lang)} onEl={labelEl}  lang={lang} />
          </group>
        )
      })}
      {/* the takeaway stand behind the cashier's chair (bar.ts's TAKEOUT_STAND): its bags on its top, set there by the servers */}
      {standPiece}
      {/* the waiting bench in the genkan, and those sat on it waiting for a stool */}
      {benchPieces}
      {/* (gone from the bench's list, faded out: drawn so until React takes them away, never back at full (it was ?? 1: a blink of them whole in the
          doorway as they went, the last frame)) */}
      {people && sitterList.map((v) => (
        <group key={`bench${v.id}`} name={`bench-sitter-${v.id}`} ref={(o) => { if (o) { if (!placedOnce.has(o)) o.visible = false; sitterObjs.current.set(v.id, o); FIGURES.set(o, 'other') } else sitterObjs.current.delete(v.id) }}>
          <BlobShadow r={0.17 * PEOPLE_SCALE} />
          <group scale={PEOPLE_SCALE}>
            <Suspense fallback={null}>
              <FolkFigure id={v.id} eating={false} walking={!v.sat} clock={clock} fade={benchFadeOf(v.id)} fit={FOLK_FIT} />
            </Suspense>
          </group>
        </group>
      ))}
      {/* (the shoes of those waiting on the bench, left on the genkan's stone at the step, toes out (item 203)) */}
      {people && given && <BenchShoes sitters={sitters} />}
      {/* takeaway customers and riders waiting in the genkan, and the boxes the servers carry out to them */}
      {people && visitorList.map((v) => (
        <group key={`takeout${v.id}`} ref={(o) => { if (o) { visitorObjs.current.set(v.id, o); FIGURES.set(o, 'other') } else visitorObjs.current.delete(v.id) }}>
          <BlobShadow r={0.17 * PEOPLE_SCALE} />
          <group scale={PEOPLE_SCALE}>
            <Suspense fallback={null}>
              <FolkFigure id={v.id} eating={false} walking still={visitorOf(v.id).still} clock={clock}
                fade={visitorOf(v.id).fade} fit={FOLK_FIT} held={v.has ? <TakeoutBag /> : undefined} />
            </Suspense>
            {v.rider && <RiderGear id={v.id} size={folkSpec(v.id).size} fade={visitorOf(v.id).fade} />}
          </group>
        </group>
      ))}
      {people && homes.map((_, i) => (
        <group key={`box${i}`} ref={(o) => { waiterBoxes.current[i] = o }} visible={false}><KraftBag /></group>
      ))}
      {/* the bag being handed over by the cashier, from the stand over the till */}
      {people && <group ref={handBag} visible={false}><KraftBag /></group>}
      </Later>
    </group>
  )
}
/** (item 374) the bar drawn again only when what it's given has changed: the page draws it a few times a second while the shop's open (its
 * clock, its log), each time with its crew made afresh (the same people in new objects) and its place a new vector; drawn again with them,
 * all of the bar (some five hundred elements) went through React again for nothing. Its crew compared by who they are, a place by where */
type BarProps = Parameters<typeof GuestBar3DImpl>[0]
type BarWorker = { id: string; role?: string; look: unknown } | null | undefined
const sameWorker = (a: BarWorker, b: BarWorker) => a === b || (!!a && !!b && a.id === b.id && a.role === b.role && a.look === b.look)
function sameBar(a: BarProps, b: BarProps) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof BarProps>
  for (const k of keys) {
    const x = a[k] as unknown, y = b[k] as unknown
    if (Object.is(x, y)) continue
    if (k === 'servers') {
      const p = (x ?? []) as BarWorker[], q = (y ?? []) as BarWorker[]
      if (p.length === q.length && p.every((w, i) => sameWorker(w, q[i]))) continue
      return false
    }
    if (k === 'plater' || k === 'stocker') { if (sameWorker(x as BarWorker, y as BarWorker)) continue; return false }
    if (x instanceof THREE.Vector3 && y instanceof THREE.Vector3 && x.equals(y)) continue
    // (no one in yet, either time: a new empty list)
    if (Array.isArray(x) && Array.isArray(y) && !x.length && !y.length) continue
    return false
  }
  return true
}
export const GuestBar3D = memo(GuestBar3DImpl, sameBar)

/**
 * A takeaway: in a kraft paper bag (KraftBag, below), in a server's hands, on the stand behind the till, in the cashier's; and in the
 * customer's hand going out. A rider wears a helmet and carries the insulated box of
 * a delivery on their back. Shared shapes and materials, made once.
 */
/** what goes out of the door with a customer, fading with them: hashed from the start (as the figures' own materials, so a fade only moves
 * its opacity, no program made then: the bag in a hand was switched to hashed by the figure's fade as they went, a 100 ms hitch the first
 * time), its own copy for each customer (the fade sets the opacity: shared, one fading out faded every other bag), the hashed program made at
 * loading (warmLater) */
const fading = (color: string) => { const m = new THREE.MeshToonMaterial({ color, alphaHash: true }); m.userData.hashed = true; return m }
const TO_LOOKS = { bag: '#c9a274', seal: '#b3241c', helmet: '#2a2d33', band: '#e0a21c', dark: '#3a3a3e', stripe: '#f2f2ee', strap: '#26282c' }
const ownLooks = () => Object.fromEntries(Object.entries(TO_LOOKS).map(([k, c]) => [k, fading(c)])) as Record<keyof typeof TO_LOOKS, THREE.MeshToonMaterial>
if (typeof document !== 'undefined') {
  const warm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), fading('#ffffff'))
  warmLater(warm)
  // (and the rider's box, its picture on it: a program of its own, made at loading too)
  const pic = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  pic.needsUpdate = true
  const withPic = fading('#ffffff')
  withPic.map = pic
  warmLater(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), withPic))
}
/** the rider's insulated box (blender/deliverybag.py, item 77, the owner's: like Japan's delivery platforms' bags): four made-up platforms'
 * looks in the four quarters of its picture (Torutto teal, モグゴー black, パクッと便 pink, とどけ丸 red); the model's on the first, each rider's
 * own copy of the picture shifted to theirs (picked by the rider), its material their own to fade with them */
const BAG_URL = import.meta.env.BASE_URL + 'models/deliverybag.glb'
useGLTF.preload(BAG_URL)
const BAG_LOOKS: [number, number][] = [[0, 0], [0.5, 0], [0, -0.5], [0.5, -0.5]]
function useRiderBag(id: number, strap: THREE.Material) {
  const gltf = useGLTF(BAG_URL) as unknown as { scene: THREE.Group }
  const made = useMemo(() => {
    const root = (gltf.scene.getObjectByName('DeliveryBag') ?? gltf.scene).clone(true)
    root.position.set(0, 0, 0)
    let mat: THREE.MeshToonMaterial | null = null
    let pic: THREE.Texture | null = null
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.map) {
        pic = src.map.clone()
        const [u, v] = BAG_LOOKS[((id % 4) + 4) % 4]
        pic.offset.set(u, v)
        pic.needsUpdate = true
        mat = fading('#ffffff')
        mat.map = pic
        m.material = mat
      } else m.material = strap
    })
    return { root, mat: mat as THREE.MeshToonMaterial | null, pic: pic as THREE.Texture | null }
  }, [gltf, id, strap])
  useEffect(() => () => { made.mat?.dispose(); made.pic?.dispose() }, [made])
  return made
}
function useOwnLooks() {
  const mats = useMemo(ownLooks, [])
  useEffect(() => () => { for (const m of Object.values(mats)) m.dispose() }, [mats])
  return mats
}
/** the waiting bench (blender/bench.py): two cedar planks on six dark legs, its seat a stool's height, long enough for four */
const BENCH_URL = import.meta.env.BASE_URL + 'models/bench.glb'
useGLTF.preload(BENCH_URL)
const WaitingBench = memo(function WaitingBench() {
  const gltf = useGLTF(BENCH_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const r = (gltf.scene.getObjectByName('Bench') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null }); t.name = src.name; made.set(src, t) }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, () => false, { width: 0.0016, weld: true })
    return mergeByMaterial(r)
  }, [gltf])
  return <group {...nameOver('候位長凳', '客滿時客人坐在這裡等位子')}><primitive object={model} /></group>
})
/** the takeaway stand and the kraft bag (blender/takeout.py): each stood on its foot at its origin, in the room's toon light */
const TAKEOUT_URL = import.meta.env.BASE_URL + 'models/takeout.glb'
useGLTF.preload(TAKEOUT_URL)
const takeoutPart = (scene: THREE.Group, name: string) => {
  const r = scene.getObjectByName(name)!.clone(true)
  r.position.set(0, 0, 0)
  const made = new Map<THREE.Material, THREE.Material>()
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = made.get(src)
    if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null }); t.name = src.name; made.set(src, t) }
    m.material = t
    m.castShadow = true
    m.receiveShadow = true
  })
  inkModel(r, () => false, { width: 0.0016, weld: true })
  const merged = mergeByMaterial(r)
  // (its foot on its origin, whatever the export left under it)
  const b = new THREE.Box3().setFromObject(merged)
  const g = new THREE.Group()
  merged.position.y -= b.min.y
  merged.position.x -= (b.min.x + b.max.x) / 2
  merged.position.z -= (b.min.z + b.max.z) / 2
  g.add(merged)
  return g
}
/** (made once, every bag a copy of it sharing its shapes and paints) */
const BAGS = new WeakMap<THREE.Object3D, THREE.Group>()
const KraftBag = memo(function KraftBag() {
  const gltf = useGLTF(TAKEOUT_URL) as unknown as { scene: THREE.Group }
  const bag = useMemo(() => {
    let base = BAGS.get(gltf.scene)
    if (!base) { base = takeoutPart(gltf.scene, 'KraftBag'); BAGS.set(gltf.scene, base) }
    return base.clone(true)
  }, [gltf])
  return <primitive object={bag} />
})
const TakeoutStandModel = memo(function TakeoutStandModel() {
  const gltf = useGLTF(TAKEOUT_URL) as unknown as { scene: THREE.Group }
  const stand = useMemo(() => takeoutPart(gltf.scene, 'TakeoutStand'), [gltf])
  return <group {...nameOver('外帶桌', '外帶的牛皮紙袋放這裡，收銀員轉身拿給客人')}><primitive object={stand} /></group>
})
/** the stand's top's height (blender/takeout.py's STAND_H), and its bags' places along it */
const STAND_TOP = 0.34
/** where the bags stand on the round table (its top's radius 0.31, blender/takeout.py's TOP_R): along its front half, side by side (x, z) */
// (round the warming tub's front, each turned to face out (the owner's, 2026-11-11: the tub in the table's middle): x, z, and its turn)
const STAND_SLOTS: [number, number, number][] = [-0.75, 0, 0.75].map((a) => [Math.sin(a) * 0.29, Math.cos(a) * 0.29, a])
/** the warming tub on its back half: its middle back from the table's, and how big it's drawn (the rice tub's model (blender/ricetub.py, 0.27
 * round its staves, 0.42 high) a little under half its size: some 25 across, beside the bags, on a table 62 across) */
// (1.65 times what it was drawn (the owner's, 2026-11-11): some 39 across; forward a little to stay on the table, the bags clear of it)
// (then 1.1 times again, in the table's middle (the owner's): some 43 across)
const WARM_TUB_Z = 0, WARM_TUB_SCALE = 0.44 * 1.65 * 1.1
/** the warming tub (保溫桶; the owner's, 2026-11-11: the old rice tub, put on the takeaway table): the sawara tub bound in copper, its lid on */
// (opened by a click as the rice tub was: its lid lifted off and leant against its side, the rice kept warm in it seen; another, shut)
/** the takeaways kept warm in the tub (the owner's, 2026-11-11: it holds the takeaways, not rice): kraft paper boxes, a red band round each, two
 * to a layer, up from its floor; as many shown as are packed and waiting (game/takeout keptWarm), the rest shrunk to nothing (drawn from the
 * start, so none is new to the renderer when it's shown) */
const WARM_PACK_GEO = new THREE.BoxGeometry(0.18, 0.055, 0.125)
const WARM_BAND_GEO = new THREE.BoxGeometry(0.03, 0.058, 0.128)
const WARM_PACK_MAT = new THREE.MeshToonMaterial({ color: '#c79d66' })
const WARM_BAND_MAT = new THREE.MeshToonMaterial({ color: '#b3362c' })
const WARM_PACKS: [number, number, number][] = Array.from({ length: WARM_TUB_HOLDS }, (_, i) => [(i % 2 ? 1 : -1) * 0.094, 0.028 + 0.0275 + Math.floor(i / 2) * 0.057, (i % 4 < 2 ? 1 : -1) * 0.01])
/** what keeps them warm in it, as a shop does (item 80, the owner's, 2026-11-13: "put some real warming things in it"): a silver insulating
 * liner (保温シート) inside the wall, its top folded out over the rim; and a cotton tenugui laid over the packs, riding on the topmost layer. The
 * tub's own units (blender/ricetub.py: the wall 0.255 round at its foot, 0.27 at its rim, 0.42 tall); drawn from the start, as the tub is */
const LINER_GEO = new THREE.LatheGeometry([[0.236, 0.03], [0.25, 0.4], [0.252, 0.425], [0.268, 0.43], [0.281, 0.418], [0.284, 0.385]]
  .map(([r, y]) => new THREE.Vector2(r, y)), 24)
const crinkle = (paint: (g: CanvasRenderingContext2D, w: number) => void, size = 128) => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  paint(g, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
// (the liner's foil: smooth silver, broad soft sheens over it, crossed by fine creases, each a bright line with its dark side beside it (item
// 102, the owner's, 2026-11-14: 'the foil far too rough': it was big hard triangles of grey, like broken stone); it tiles, so the creases wrap)
const LINER_TEX = crinkle((g, w) => {
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  g.fillStyle = '#c4c8cd'
  g.fillRect(0, 0, w, w)
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w, y = rnd() * w, r = w * (0.15 + rnd() * 0.25), v = rnd() < 0.5 ? 255 : 150
    for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -w], [0, w]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
      gr.addColorStop(0, `rgba(${v},${v},${v + 4},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v + 4},0)`)
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2)
    }
  }
  g.lineCap = 'round'
  for (let i = 0; i < 90; i++) {
    let x = rnd() * w, y = rnd() * w, a = rnd() * Math.PI * 2
    const pts: [number, number][] = [[x, y]]
    for (let k = 0; k < 2; k++) { a += (rnd() - 0.5) * 0.8; const l = 6 + rnd() * 12; x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]) }
    for (const [dx, col, lw] of [[1.2, 'rgba(120,124,130,0.22)', 2.2], [0, 'rgba(255,255,255,0.4)', 1.4]] as const) {
      for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -w], [0, w]]) {
        g.strokeStyle = col; g.lineWidth = lw
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo : g.moveTo).call(g, px + ox + dx, py + oy + dx)); g.stroke()
      }
    }
  }
}, 256)
if (LINER_TEX) LINER_TEX.repeat.set(4, 2)
const LINER_MAT = new THREE.MeshToonMaterial({ color: '#ffffff', map: LINER_TEX, side: THREE.DoubleSide })
// (the tenugui: cotton, indigo stripes across it, its ends a little frayed)
const TENUGUI_TEX = crinkle((g, w) => {
  g.fillStyle = '#efe9dc'
  g.fillRect(0, 0, w, w)
  g.fillStyle = '#2d4f86'
  for (let i = 0; i < 6; i++) g.fillRect(0, 8 + i * 21, w, 7)
  g.fillStyle = '#7d95bd'
  for (let i = 0; i < 6; i++) g.fillRect(0, 17 + i * 21, w, 2)
})
const TENUGUI_MAT = new THREE.MeshToonMaterial({ color: '#ffffff', map: TENUGUI_TEX, side: THREE.DoubleSide })
/** the tenugui's cloth: a little over the packs' two-wide layer, its edges drooping over them */
const TENUGUI_GEO = (() => {
  const g = new THREE.PlaneGeometry(0.42, 0.3, 8, 6).rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i)
    const ex = Math.max(0, Math.abs(x) - 0.17) / 0.04, ez = Math.max(0, Math.abs(z) - 0.06) / 0.09
    p.setY(i, -0.05 * Math.min(1, ex * ex + ez * ez) + 0.004 * Math.sin(x * 50 + z * 30))
  }
  g.computeVertexNormals()
  return g
})()
const WarmTub = memo(function WarmTub() {
  const tub = useRiceTub()
  const [open, setOpen] = useState(false)
  const lid = useRef<THREE.Group>(null)
  const packs = useRef<(THREE.Group | null)[]>([])
  const cloth = useRef<THREE.Mesh>(null)
  const lidT = useRef(0)
  const says = () => {
    const n = keptWarm(TAKEOUT.orders)
    return `外型像盛白飯的木飯桶（おひつ），裡面保溫著打包好的外帶（${n} 份）｜點一下${open ? '蓋上' : '打開'}`
  }
  useFrame((_, dt) => {
    lidT.current = THREE.MathUtils.clamp(lidT.current + (open ? 1 : -1) * Math.min(dt, 0.1) * 2.2, 0, 1)
    const k = lidT.current * lidT.current * (3 - 2 * lidT.current)
    if (lid.current) {
      lid.current.position.set(-0.32 * k, 0.42 - 0.1585 * k + Math.sin(k * Math.PI) * 0.22, 0)
      lid.current.rotation.z = k * 1.36
    }
    const n = keptWarm(TAKEOUT.orders)
    packs.current.forEach((g, i) => { if (g) g.scale.setScalar(i < n ? 1 : 0.0001) })
    // (the cloth over the topmost layer; with none in the tub, put away (item 102, the owner's: folded small on its floor it read as nothing
    // anyone could name, a striped scrap))
    if (cloth.current) {
      const layers = Math.ceil(n / 2)
      cloth.current.position.y = layers ? 0.028 + layers * 0.057 + 0.004 : 0.034
      cloth.current.scale.setScalar(layers ? 1 : 0.0001)
    }
  })
  return (
    <group scale={WARM_TUB_SCALE}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v) }}
      onPointerOver={(e) => nameOver('保溫桶', says()).onPointerOver(e)} onPointerOut={() => nameOver('保溫桶', '').onPointerOut()}>
      <primitive object={tub.body} />
      <mesh geometry={LINER_GEO} material={LINER_MAT} receiveShadow />
      <mesh ref={cloth} geometry={TENUGUI_GEO} material={TENUGUI_MAT} position={[0, 0.034, 0.005]} rotation-y={0.12} castShadow receiveShadow />
      {WARM_PACKS.map((at, i) => (
        <group key={i} ref={(g) => { packs.current[i] = g }} position={at} scale={0.0001}>
          <mesh geometry={WARM_PACK_GEO} material={WARM_PACK_MAT} castShadow />
          <mesh geometry={WARM_BAND_GEO} material={WARM_BAND_MAT} />
        </group>
      ))}
      <group ref={lid} position={[0, 0.42, 0]}><primitive object={tub.lid} /></group>
    </group>
  )
})
/** seconds: the cashier turning round to the stand (and back), taking the bag up, holding it out over the till to the customer */
const STAND_TURN = 0.7, STAND_LIFT = 0.4, STAND_GIVE = 0.5
/** (in the figure's hand: its fade reaches these, as it does everything it holds) */
function TakeoutBag() {
  const m = useOwnLooks()
  return (
    <group position-y={-0.1}>
      <mesh position-y={-0.02} material={m.bag}><boxGeometry args={[0.13, 0.12, 0.07]} /></mesh>
      <mesh position-y={0.045} rotation-x={Math.PI / 2} material={m.bag}><torusGeometry args={[0.03, 0.006, 4, 10, Math.PI]} /></mesh>
      <mesh position={[0, -0.02, 0.036]} material={m.seal}><boxGeometry args={[0.02, 0.12, 0.002]} /></mesh>
    </group>
  )
}
/** (beside the figure, not in it: faded here with them) */
// (item 374: drawn again only as its own props change: it was with every redraw of the bar, 6.8 times a second with riders in)
const RiderGear = memo(function RiderGear({ id, size, fade }: { id: number; size: number; fade: () => number }) {
  // (blender/folk.py's measure: the head a ball of 0.27 about 0.8 up, the body 0.26 round at its widest; all as the figure's scaled)
  const k = FOLK_FIT * size
  const m = useOwnLooks()
  const bag = useRiderBag(id, m.strap)
  useFrame(() => { const f = fade(); for (const x of Object.values(m)) x.opacity = f; if (bag.mat) bag.mat.opacity = f })
  return (
    <group scale={k}>
      {/* (the helmet over the crown of the head, clear of the hair, down to the brow; a band round its rim) */}
      <mesh position-y={0.8} material={m.helmet}><sphereGeometry args={[0.34, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.4]} /></mesh>
      <mesh position-y={0.8 + 0.34 * Math.cos(Math.PI * 0.4) - 0.01} material={m.band}><cylinderGeometry args={[0.326, 0.328, 0.035, 16, 1, true]} /></mesh>
      {/* (the insulated box of a delivery on their back, worn as a backpack (the owner's, 2026-11-12: a strange brown bag floating behind
          them): its two straps over the shoulders and down the chest; the box itself the platform's, its mark facing away behind them
          (useRiderBag)) */}
      <group position={[0, 0.36, -0.42]} rotation-y={Math.PI}><primitive object={bag.root} /></group>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position={[sd * 0.11, 0.56, -0.1]} rotation-x={-0.25} material={m.strap}><boxGeometry args={[0.05, 0.02, 0.36]} /></mesh>
          <mesh position={[sd * 0.11, 0.42, 0.235]} rotation-x={0.25} material={m.strap}><boxGeometry args={[0.05, 0.26, 0.02]} /></mesh>
        </group>
      ))}
    </group>
  )
})

/** the drinks fridges, each its own piece for edit mode: drawn again only if they move */
const Fridges = memo(function Fridges({ fridges }: { fridges: NonNullable<ReturnType<typeof fridgesOf>> }) {
  return (
    <>
      {fridges.map((f) => (
        <Movable key={f.n} id={`drinkfridge${f.n}`} label={`飲料櫃 ${f.n + 1}`}><group name={f.n ? 'look-fridge-b' : 'look-fridge'} position={f.at} rotation-y={f.yaw}><DrinkFridge n={f.n} /><FridgeStock n={f.n} /><FridgeDoor n={f.n} />{f.n === 0 && <DrinkWarm />}</group></Movable>
      ))}
    </>
  )
})

/** the stools, each its own piece for edit mode: drawn again only if the seats change */
const Stools = memo(function Stools({ seats }: { seats: ReturnType<typeof seatsOf> }) {
  // (each stool where it's been pulled out to, back toward the aisle (SEAT_PULL): its customer pulling it out and sliding in with it)
  const pulls = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    seats.forEach((st, n) => {
      const o = pulls.current[n]
      if (!o) return
      const k = SEAT_PULL.get(n) ?? -STOOL_TUCK
      const b = backOf(st)
      if (Math.abs(o.position.x - b.x * k) > 1e-5 || Math.abs(o.position.z - b.z * k) > 1e-5) o.position.set(b.x * k, 0, b.z * k)
    })
  })
  return (
    <>
      {/* (each stool its own Movable, so each can be moved, turned and made larger or smaller by hand when the shop's shut; its customer sits on it
          where it's been moved to (SEAT_MARKS)) */}
      {seats.map((st, n) => (
        <Movable key={`${seats.length}-${n}`} id={`stool${n}`} label={`座位 ${n + 1}`}>
          <group ref={(o) => { pulls.current[n] = o }}>
          <StaticBatch plain>
            <group position={st.stool} rotation-y={st.yaw} scale={PEOPLE_SCALE}><StoolModel red={n % 2 === 1} /></group>
          </StaticBatch>
          </group>
          <group name={`stool-seat-${n}`} position={st.stool} userData={{ marker: true }} ref={(o) => { if (o) SEAT_MARKS.set(n, o); else SEAT_MARKS.delete(n) }} />
        </Movable>
      ))}
    </>
  )
})

/** the whole line at once (the owner's: said a piece at a time, each piece ended in …, and looked cut short), wrapping inside the bubble */
// (faded out over its last 0.3 s: `ms`, how long it's up)
function Say({ text, who, heart, ms }: { text: string; who: string; heart?: boolean; ms: number }) {
  return <span className="g3-bubble g3-say" style={{ '--out': `${Math.max(0, ms - 300)}ms` } as CSSProperties}><b className="say-who">{heart && <i className="say-heart"><Glyph id="heart" size="0.9em" /></i>}{who}</b>{text}</span>
}

const LABEL_STYLE = { pointerEvents: 'none' } as const
const LABEL_Z = [20, 10]
/** a customer's rating at or over which they loved it (MoodFace's 超滿意), and what bursts out of their face then (item 209) */
const LOVED_AT = 80
const JOY_BITS = ['heart', 'star', 'heart', 'star', 'heart', 'star'] as const
/** one customer's label over their head (what they're saying, or the dots while they wait; their face once they've eaten; their number): drawn
 * again only when one of those changes. Each is a page of its own (drei's Html renders its children into a root of their own), so drawn again
 * with every redraw of the bar, several times a second, every label was laid out again each time */
const GuestLabel = memo(function GuestLabel({ id, y, dots, rating, angry, partner, name, onEl, lang }: { id: number; y: number
  dots: boolean; rating: number | null; angry: boolean; partner: boolean; name: string
  onEl: (id: number, el: HTMLElement | null) => void; lang: Lang }) {
  // (what they're saying, read here from ui/speechStore: only this label drawn again as it changes, not the bar, nor the page)
  const say = useSaid(id)
  const at = useMemo(() => [0, y, 0] as [number, number, number], [y])
  // (loved it (item 209): a burst of hearts and stars out of their face as it shows, and a little bell's ding heard)
  const loved = rating !== null && rating >= LOVED_AT && !angry
  useEffect(() => { if (loved) joySound() }, [loved])
  return (
    <Html position={at} center zIndexRange={LABEL_Z} style={LABEL_STYLE}>
      <div className="g3-label" ref={(el) => onEl(id, el)}>
        {/* (a bubble only while there's something to say (the owner's): a line, or the dots of waiting to order; their kind over it in
            yellow, no number; nothing at all over someone just sitting there, not even their name) */}
        {say ? <Say key={say.key} text={say.text} who={name} heart={partner} ms={say.ms} />
          : dots && <span className="g3-bubble"><b className="say-who">{partner && <i className="say-heart"><Glyph id="heart" size="0.9em" /></i>}{name}</b>…</span>}
        {rating !== null && <MoodFace guest={{ rating, state: angry ? 'angry' : 'done' }} />}
        {rating === null && !angry && <CalmButton id={id} lang={lang} />}
        {loved && (
          <span className="boss-joy guest-joy" aria-hidden="true">
            {JOY_BITS.map((c, i) => <i key={i} className={`is-${c}`} style={{ '--i': i } as CSSProperties}>{c === 'star' ? <StarIcon size={17} /> : <Glyph id="heart" size={17} />}</i>)}
          </span>
        )}
      </div>
    </Html>
  )
})

/**
 * (item 348) a customer kept waiting, getting cross (game/calm's canCalm: a third and more of their patience gone): a button by their label
 * to see to them, opening its ways (a word, an apology, a dish on the house), each once; asked of the kitchen (bar's CALM_ASK), done there.
 * Its own little clock (FUMING, what they've been given), so only it is drawn again as those change
 */
// (item 374: drawn again only as its own props or state change: it was with every redraw of the label it's in)
const CalmButton = memo(function CalmButton({ id, lang }: { id: number; lang: Lang }) {
  const [st, setSt] = useState<{ f: number; used: CalmKind[] }>({ f: 0, used: [] })
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = window.setInterval(() => {
      const f = FUMING.get(id) ?? 0, used = CALM_ASK.used.get(id) ?? []
      setSt((s) => (Math.abs(s.f - f) < 0.02 && s.used.length === used.length ? s : { f, used }))
    }, 300)
    return () => window.clearInterval(t)
  }, [id])
  const shown = canCalm(st.f, st.used)
  usePanelSound(open && shown)
  if (!shown) return null
  const t3 = (zh: string, ja: string, en: string) => tl(lang, zh, ja, en)
  const pct = (k: CalmKind) => Math.round(CALM[k].back * 100)
  const label: Record<CalmKind, string> = { greet: t3('招呼', '声かけ', 'A word'), sorry: t3('道歉', 'お詫び', 'Apologise'),
    side: t3(`送小菜 NT$${CALM.side.cost}`, `お通し NT$${CALM.side.cost}`, `A dish NT$${CALM.side.cost}`) }
  const tip: Record<CalmKind, string> = {
    greet: t3(`跟他說馬上就好：可以多等 ${pct('greet')}%`, `すぐですと声をかける：${pct('greet')}% 長く待てる`, `Tell them it's nearly done: ${pct('greet')}% more patience`),
    sorry: t3(`跟他道歉：可以多等 ${pct('sorry')}%`, `お詫びする：${pct('sorry')}% 長く待てる`, `Apologise: ${pct('sorry')}% more patience`),
    side: t3(`招待一盤毛豆（NT$${CALM.side.cost}）：可以多等 ${pct('side')}%`, `枝豆をサービス（NT$${CALM.side.cost}）：${pct('side')}% 長く待てる`,
      `Edamame on the house (NT$${CALM.side.cost}): ${pct('side')}% more patience`),
  }
  return (
    <span className="calm">
      <button type="button" className="calm-btn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title={t3('客人等太久了：安撫他', 'お待たせしすぎ：なだめる', 'Kept waiting too long: calm them')}>{t3('安撫', 'なだめる', 'Calm')}</button>
      {open && calmLeft(st.used).map((k) => (
        <button key={k} type="button" className="calm-opt" title={tip[k]} onClick={(e) => { e.stopPropagation(); CALM_ASK.q.push({ id, kind: k }); setOpen(false) }}>
          {label[k]}</button>
      ))}
    </span>
  )
})

/** a sake's cup beside its bottle: this much nearer the customer (lay) and along to their right */
const CUP_AHEAD = 0.07
const CUP_SIDE = -0.03
/**
 * A seated customer's drink on the bar (its sake cup by it): as much left in it as they've not drunk; the one they sip from (the cup, or the
 * bottle) off the bar while it's up in their hand (FolkFigure's sip)
 */
const SeatDrink = memo(function SeatDrink({ s, id, at, cupAt, clock, level }: { s: Shown; id: DrinkId; at: [number, number, number]
  cupAt: [number, number, number] | null; clock: { current: number }; level: number }) {
  const bottle = useRef<THREE.Group>(null)
  const cup = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = s.sipAt === undefined ? -1 : (clock.current - s.sipAt) / SIP_S
    const up = k >= 0.2 && k < 0.86
    const sipped = cupAt ? cup.current : bottle.current
    if (sipped && sipped.visible === up) sipped.visible = !up
  })
  return (
    <>
      <group ref={bottle} position={at}><DrinkBottle id={id} wet level={level} /></group>
      {cupAt && <group ref={cup} position={cupAt}><DrinkCup id={id} level={level > 0.01 ? 0.8 : 0} /></group>}
    </>
  )
}, (a, b) => a.s === b.s && a.id === b.id && a.level === b.level && a.at.every((v, i) => v === b.at[i]) && (a.cupAt === null) === (b.cupAt === null))

/** one customer's figure, moved by the bar's clock each frame (read from the ref: nothing re-renders for it) */
// (drawn again only when what's shown of them changes (their phase, eating or not, the drink in hand, who they turn to, how they're
// getting on), not each time the bar above them redraws, several times a second; `phase` and `drink` are passed only so it notices them)
const PersonClock = memo(PersonClockImpl)
function PersonClockImpl({ s, eating, clock, talk, mood, plateOf, drinkOf, soupOf }: { s: Shown; phase: string; drink?: string; eating: boolean; clock: { current: number }
  talk: number; mood: ReturnType<typeof moodOf>; plateOf: (seat: number) => THREE.Vector3 | null; drinkOf: (seat: number, cup: boolean) => THREE.Vector3 | null
  soupOf?: (seat: number) => THREE.Vector3 | null
  drunk?: number }) {
  // (a drink in hand: carried back from the fridge, or up off the bar for a sip (a sake's cup for it, not its bottle); at the size it stands on
  // the bar (the hand's frame is the figure's, smaller), held round its middle)
  const cup = !!s.drink && cupped(s.drink)
  const sipK = () => (s.sipAt === undefined ? -1 : (clock.current - s.sipAt) / SIP_S)
  const sat = s.phase === 'sit'
  // (and the empty taken along to the fridge for the next one (item 210))
  const refill = s.phase === 'wcGo' && s.wc?.who === 'drink'
  const inHand = s.drink && (s.phase === 'wcBack' || sat || refill) ? (
    <group scale={1 / (1.1 * STAFF_SCALE * folkSpec(s.id).size)}>
      <group position-y={cup && sat ? (s.drink === 'beer' ? -0.04 : -0.012) : -0.07}>{cup && sat ? <DrinkCup id={s.drink!} level={0.8} /> : <DrinkBottle id={s.drink as DrinkId} wet level={1 - (s.drunk ?? 0)} />}</group>
    </group>
  ) : undefined
  const atFridge = s.phase === 'wcIn' && s.wc?.who === 'drink'
  // (their own boundary: a customer still loading shows nothing a moment, never blanks the shop round them)
  return <Suspense fallback={null}><FolkFigure id={s.id} eating={eating} walking={s.phase !== 'sit' && !s.wcSit} still={() => !!s.still} clock={clock} talk={talk} mood={mood}
    fade={() => s.fade ?? 1} slippers={() => s.slippers ?? true} pose={atFridge ? 'Fetch' : s.phase === 'wcWash' ? 'Wash' : s.phase === 'sit' && s.wipeAt ? 'Wipe' : undefined} fit={FOLK_FIT}
    held={inHand} heldShown={() => s.phase === 'wcBack' || (s.phase === 'wcGo' && s.wc?.who === 'drink') || (sipK() >= 0.2 && sipK() < 0.86)} cup={cup}
    sip={() => (s.phase === 'sit' && s.drink ? sipK() : -1)} drinkAt={() => (s.drink ? drinkOf(s.seat, cup) : null)} bite={() => EAT_PHASE.get(s.id)}
    soup={() => (s.phase === 'sit' && s.soupSipAt !== undefined ? (clock.current - s.soupSipAt) / SOUP_SIP_S : -1)} soupAt={() => soupOf?.(s.seat) ?? null}
    soupKey={s.phase === 'sit' ? `soup:${s.seat}` : undefined} fume={() => FUMING.get(s.id) ?? 0}
    plate={() => (s.phase === 'sit' ? plateOf(s.seat) : null)} /></Suspense>
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
const DiningFloor = memo(DiningFloorImpl)
const RoomFloor = memo(RoomFloorImpl)
