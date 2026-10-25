import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { IndoorHDRI } from '@/scene/IndoorHDRI'
import { FpsMeter } from '@/scene/FpsMeter'
import { ContactShadows, Loader, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { nameIn, UI, type Lang } from '@/data/i18n'
import { boilAmount, ROOM_TEMP, stepTemp, steamAmount } from '@/shops/hotpot/boil'
import { Bubbles } from '@/shops/hotpot/Bubbles'
import { Brand } from '@/ui/Brand'
import { Dish } from '@/scene/Dish'
import { DishSwitcher } from '@/ui/DishSwitcher'
import { Fire } from '@/shops/grill/Fire'
import { GasFlame } from '@/shops/hotpot/GasFlame'
import { FireControl } from '@/shops/grill/FireControl'
import { Fullness } from '@/ui/Fullness'
import { bestOf, Notebook } from '@/ui/Notebook'
import { findItem, MENU_MAX, MENU_MIN, partEn, partName, recipeKey, SEASON_NAME, signature, type Entry, type Part, type Seasoning } from '@/data/recipes'
import { moodOf } from '@/game/taste'
import { idealSteps, trialIdeas } from '@/game/research'
import { bestDabs, cookable, dishName, expectedTaste, understand } from '@/game/chefChat'
import { CHEF_TALK } from '@/data/chefTalk'
import { menuPrice, restockOrder, topUpOrder, buyAllCost, afterCharcoal, canAddCharcoal, canServe, CAPITAL, CHARCOAL_COST, costOf, entryCost, GAS_PER_HOUR, goodsOf, needOf, partCost, partsOf,
  portionsLeft, SHOP_COST, takesOf } from '@/game/economy'
import { MoodFace } from '@/ui/MoodFace'
import { GuestCounter } from '@/ui/GuestCounter'
import { HeatControl } from '@/shops/hotpot/HeatControl'
import { Menu } from '@/ui/Menu'
import { Crash } from '@/ui/Crash'
import { PotCooking } from '@/shops/hotpot/PotCooking'
import { NoodleEating } from '@/shops/noodle/NoodleEating'
import { TaiwanTable } from '@/shops/noodle/TaiwanTable'
import { Bakery } from '@/shops/bakery/Bakery'
import { OpeningSpot } from '@/scene/OpeningSpot'
import { FramePacer } from '@/scene/FramePacer'
import { SHOP } from '@/game/shopState'
import { GAME_SPEED } from '@/scene/speed'
import { DRINKS, type DrinkId } from '@/shops/grill/bar'
import { offsetOf, registerMovable, rotationOf, select, setFrame, toggleEdit, useEdit } from '@/shops/grill/edit'
import { AxisGizmo, focusCamera } from '@/shops/grill/Movable'
import { ALONG } from '@/shops/grill/bar'
import { cameraOneOf } from '@/scene/camera1'
import { holdsCameraOne, modeOf } from '@/game/mode'
import { Bgm } from '@/ui/Bgm'
import { BAR_AT, BAR_TOP } from '@/shops/grill/Roasting'
import type { GuestView, Notes, Step, Talk } from '@/game/types'
import { GuestBar3D } from '@/shops/grill/GuestBar3D'
import { SAY_EACH, sayChunks } from '@/game/say'
import { FIRE_SHIFT, GRILL_COUNTERS, GRILL_OFFSET, GRILL_SCALE } from '@/shops/grill/bar'
import { CHEFS, type Chef } from '@/data/chefs'
import { LINES } from '@/data/lines'
import { guestLabel } from '@/data/guests'
import { useDrag } from '@/ui/useDrag'
import { effective, restPerMin, ROLES, tirePerMin, type Role } from '@/data/staff'
import { CANDIDATES, pickHires } from '@/game/hiring'
import { Office } from '@/ui/Office'
import { Fridge } from '@/ui/Fridge'
import { Welcome } from '@/ui/Welcome'
import { liteUrl, QUALITY, stepDown, webglReport } from '@/scene/quality'
import { PIT_LIFT, Roasting, type CrewMember } from '@/shops/grill/Roasting'
import { Grill2D } from '@/shops/grill/Grill2D'
import { Steam } from '@/scene/Steam'
import { StoveControls } from '@/shops/hotpot/StoveControls'
import { DISHES, WOK_KINDS, type Dish as DishInfo, type TableKind } from '@/data/menu'

// distance between dishes on the carousel
const SPACING = 6
/** most items that fit around the charcoal at once */
const FIRE_CAPACITY = 16
const SAVE_KEY = 'canteen-save'
/** a whole bowl of noodles, by the bowl (the set meals' parts count on their own) */
const BASE_KCAL: Record<string, number> = { braised: 650, clear: 560, plain: 380, dry: 520, sesame: 610, sanxianMian: 520,
  rousiMian: 480, daluMian: 560, suanlaMian: 500 }
type Saved = { v: number; ledger: { revenue: number; food: number; fuel: number; wage: number; bought: number; setup?: number; offering?: number }
  stock: Record<string, number>; hired: Record<string, Record<string, { fatigue: number }>>; notes: Notes; owner: string | null; opened: Record<string, boolean> }
// Nothing is kept between visits: a reload starts everything over (the name, the money, the shops, the staff).
// (Any save left by an older version is cleared.)
const SAVED: Saved | null = (() => {
  try {
    for (const k of [SAVE_KEY, 'canteen-theme', 'canteen-lang', 'canteen-pos-guests', 'canteen-pos-ledger', 'canteen-pos-chat',
      'canteen-pos-office', 'canteen-pos-notebook']) localStorage.removeItem(k)
  } catch {
    // storage blocked
  }
  return null
})()

/**
 * The renderer, asking for less each time if the browser won't give a WebGL context: first the usual, then
 * without antialiasing on the default GPU, then the low-power GPU even if it's slow. (A phone's browser that has
 * crashed its GPU on this site may refuse them all until it's restarted: see NO_WEBGL.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

const makeRenderer = ({ canvas }: { canvas: any }) => {
  const tries: THREE.WebGLRendererParameters[] = [
    { antialias: QUALITY.antialias, powerPreference: 'high-performance' },
    { antialias: false, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, precision: 'mediump' },
  ]
  let last: unknown
  for (const t of tries) {
    try {
      const r = new THREE.WebGLRenderer({ canvas, alpha: true, ...t })
      r.toneMapping = THREE.NoToneMapping
      return r
    } catch (e) {
      last = e
    }
  }
  throw last
}
/** whether this browser will give a WebGL2 context at all, checked once before the 3D view is put up */
const NO_WEBGL = (() => {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl2', { powerPreference: 'low-power' })
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !gl
  } catch {
    return true
  }
})()
/** the charcoal burns down from full to out in 90 minutes (the fire level is stepped every 200ms) */
const FIRE_BURN_PER_TICK = 1 / (90 * 60 * 5)
// burner top on the cassette stove (blender/hotpot.py)
const BURNER_Y = 0.38
// the one camera pose every dish is framed from (blender/open_live.py matches Blender's camera to it)
// low enough (~19° above the dish) that the burner flames show under the hot pot's rim
const CAMERA_POSITION: [number, number, number] = [2.9, 2.2, 4.0]
/** the second view the eye button gives (at the grill): from high up at 45 degrees, the whole shop in it */
const OVERVIEW_TARGET = new THREE.Vector3(0.0, 0.3, -1.2)
const OVERVIEW_POSITION = new THREE.Vector3(21.7, 15.5, 2.2)
const CAMERA_FOV = 40

const ITEM_IDS = Object.fromEntries(DISHES.map((d) => [d.id, d.items.map((it) => it.id)]))
/** every menu item by id (for its calories when it's eaten) */
const ALL_ITEMS = new Map(DISHES.flatMap((d) => d.items.map((it) => [it.id, it] as const)))
/** a comfortably full adult meal, and how fast it settles */
const FULL_KCAL = 1500
const DIGEST_KCAL_PER_SEC = 1.2
/** what's cooked in the hot pot (eating any of it is trying the soup too) */
const potItems = new Set(DISHES.find((d) => d.heatControl)?.items.map((x) => x.id) ?? [])
const FLOAT_IDS = Object.fromEntries(
  DISHES.map((d) => [d.id, d.items.filter((it) => it.entrance === 'float').map((it) => it.id)]),
)

type Theme = 'light' | 'dark'

const LIGHTING: Record<Theme, { sun: string; sunIntensity: number; sky: string; ground: string; hemi: number;
  spot: number; fire: number; shadow: string; shadowOpacity: number }> = {
  // golden-hour sun and a cool sky fill
  light: { sun: '#ffe7c2', sunIntensity: 1.8, sky: '#cfe0ff', ground: '#7a6450', hemi: 1.0, spot: 18, fire: 2,
    shadow: '#000000', shadowOpacity: 0.28 },
  // moonlight; the warm spot, fire and burners carry the scene
  dark: { sun: '#b8c4ff', sunIntensity: 0.9, sky: '#6a6274', ground: '#3a2c20', hemi: 1.35, spot: 30, fire: 4,
    shadow: '#000000', shadowOpacity: 0.45 },
}

// a warm lamp hanging above and in front of the dish, like over a stall counter
const SPOT_POSITION: [number, number, number] = [1.2, 4.2, 2.2]
const SPOT_SOFTNESS = 6

/**
 * How far to pull the camera back for this viewport. The dishes are framed for a landscape stage;
 * on portrait or narrow stages the horizontal field of view shrinks, so back off until they fit again.
 */
const cameraDistanceScale = (aspect: number) =>
  // (a portrait phone stage needs to stand well back, so the things laid out either side of the fire fit too)
  aspect >= 1.3 ? 1 : Math.min(3.4, (1.3 / aspect) * (aspect < 1 ? 1.4 : 1))

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** a phone (a touch screen, or a narrow one): the customers are shown in the 2D bar on the guest board instead of in 3D */
const PHONE_QUERY = '(hover: none) and (pointer: coarse), (max-width: 760px)'
/**
 * a phone by its screen's size (not a tablet, though that's a touch screen too): the short side under 600 css px.
 * Only a phone gets the grill drawn flat, without any 3D.
 */
const SMALL_SCREEN_QUERY = '(max-width: 599px), (max-height: 499px)'
function useMedia(query: string) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setOn(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return on
}
function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const onChange = () => setPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return phone
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      // (not remembered: every visit starts from the system preference)
    } catch {
      // nothing
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

/** Signed carousel slot of dish i relative to the active one, wrapping so neighbours are -1 / +1. */
function slot(i: number, active: number, n: number) {
  let d = (i - active) % n
  if (d > n / 2) d -= n
  if (d < -n / 2) d += n
  return d
}

/**
 * What's on the table: the ordered portions plus whatever the ordered sets include. Bases (soups, the noodle
 * bowl, set meals) are ordered like anything else, by their id in the same counts.
 */
const servings = (dish: DishInfo, order: Record<string, number>) => {
  const all = { ...order }
  for (const b of dish.bases) {
    const n = order[b.id] ?? 0
    if (!n || !b.includes) continue
    for (const [id, k] of Object.entries(b.includes)) all[id] = (all[id] ?? 0) + k * n
  }
  return all
}

/** The soup or bowl that's been ordered (hot pot and noodles take one at a time), or none: an empty pot. */
const orderedBase = (dish: DishInfo, order: Record<string, number>) => dish.bases.find((b) => (order[b.id] ?? 0) > 0)

/** The stage's centre and size in canvas pixels (the canvas fills the whole app). */
type Frame = { cx: number; cy: number; w: number; h: number }

/** the sake offered at the shrine stands (and brings its extra custom) this long (ms) */
const INCENSE_MS = 180000
/** what offering the sake costs (NT$) */
const OFFERING_COST = 1000
type SceneProps = {
  /** a customer took a drink from the grill's fridge */
  onDrink?: (guest: number, drink: DrinkId) => void
  /** the incense on the grill's altar: when it was lit (performance.now), and lighting a new one */
  incense: { litAt: number | null; onLight: () => void }
  /** the incense is burning: customers order more */
  blessed?: boolean
  active: number
  orders: Record<string, Record<string, number>>
  theme: Theme
  reducedMotion: boolean
  heat: number
  /** 0..1 charcoal fire strength for the grill */
  fire: RefObject<number>
  /** the stage's box inside the full-window canvas: the dish is framed in it */
  frame: Frame
  onOffFire: (count: number, loose: number) => void
  /** a piece of food has been eaten (for the fullness meter) */
  onEat: (id: string, taste: number, how?: { doneness?: number; dabs?: Record<string, number>; steps?: Step[]; dip?: string[] }) => void
  notes: Notes
  /** AI simulation on, and what it does through the app */
  ai: boolean
  /** the shop's shut and being worked by hand (研製料理) */
  research: boolean
  onOrder: (id: string, guest?: number) => boolean
  onAddCharcoal: () => boolean
  onSay: (who: 'chef' | 'guest', text: string) => void
  /** bumped by the 視角 button: glide back to the home view */
  resetView: number
  /** the eye button's second view, on: the whole shop from above at 45 degrees */
  overview: boolean
  onNotice: (what: 'notCooked' | 'burnt' | 'waste' | 'fireFull' | 'offTable' | 'heapFull') => void
  lang: Lang
  chefOf: (dishId: string) => Chef
  crowdOf: (dishId: string) => number
  crewOf: (dishId: string) => CrewMember[]
  onWalkOut: (ids: string[], dish: DishInfo, guest?: number) => void
  /** (shop open) what's on each shop's menu, and a customer ordering one of them */
  entriesOf: (dishId: string) => Entry[]
  onOrderEntry: (key: string, guest: number) => boolean
  onGuests: (dishId: string, g: GuestView[]) => void
  /** what the hot pot's AI customers are waiting for (they take it out of the pot themselves once it's cooked) */
  potAi: string[]
  spotOn: boolean
  guestsBy: Record<string, GuestView[]>
  speech: Record<number, { key: number; text: string }>
  onPotGuestEat: (id: string, taste: number) => void
  /** shops with food out on either table (tasting or open): they stay loaded, so nothing on them is lost */
  inUse: string[]
  /** on a phone the customers are drawn in 2D on the guest board, not at the bar in 3D */
  phone: boolean
  /** (noodle bar open) the kitchen is stir-frying an order at the wok */
  noodleWok: boolean
  /** (bakery open) what the kitchen is baking, or has set out */
  bakeKitchen: { phase: 'cook' | 'eat'; parts: Part[] } | null
}

/** the shop's own waiter, there when no one's been hired for the floor: the cooked food is always carried to the customers, never tossed over the bar */
const HOUSE_SERVER: CrewMember = { id: 'house-server', role: 'server', look: { female: false, age: 'middle' } }
/**
 * Camera 1 as it's drawn in edit mode: a small camera body with a lens, and the pyramid of what it sees, standing where the view is held (see Scene), so it
 * can be picked from the list or by a click, moved with the arrows, turned with the rings (a turn about the vertical, a tilt) and its numbers typed.
 */
function CameraRig({ home, target }: { home: { current: THREE.Vector3 }; target: THREE.Vector3 }) {
  const { selected, offsets, rotations } = useEdit()
  void offsets; void rotations
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Parameters<typeof focusCamera>[1]
  const pose = cameraOneOf(home.current, target, offsetOf('camera1'), rotationOf('camera1'))
  const body = useRef<THREE.Group>(null)
  const poseRef = useRef(pose)
  poseRef.current = pose
  useLayoutEffect(() => {
    const g = body.current
    if (!g) return
    g.position.copy(pose.position)
    g.lookAt(pose.target)
  })
  useEffect(() => {
    // (its numbers are in the room's own axes, like everything else's)
    setFrame('camera1', Math.atan2(ALONG.x, ALONG.z))
    return registerMovable('camera1', '攝影機 1（研製視角）', () => focusCamera(camera, controls, poseRef.current.position))
  }, [camera, controls])
  const hit = selected === 'camera1'
  const COL = hit ? '#8fd0ff' : '#3fa9ff'
  // (the pyramid of the view: from the lens out to 1.4 ahead, a rectangle there)
  const lines = useMemo(() => {
    const L = 1.4, w = 0.62, h = 0.36
    const c = [[-w, -h], [w, -h], [w, h], [-w, h]]
    const pts: number[] = []
    for (let i = 0; i < 4; i++) {
      pts.push(0, 0, 0.12, c[i][0], c[i][1], L)
      pts.push(c[i][0], c[i][1], L, c[(i + 1) % 4][0], c[(i + 1) % 4][1], L)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const pick = (e: { stopPropagation: () => void }) => { e.stopPropagation(); select('camera1') }
  return (
    <group>
      <group ref={body}>
        <mesh onPointerDown={pick} renderOrder={998} userData={{ editHandle: true }}>
          <boxGeometry args={[0.24, 0.16, 0.14]} /><meshBasicMaterial color="#2b3138" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.12]} rotation-x={Math.PI / 2} onPointerDown={pick} renderOrder={998} userData={{ editHandle: true }}>
          <cylinderGeometry args={[0.06, 0.075, 0.12, 16]} /><meshBasicMaterial color="#14171a" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, 0.181]} renderOrder={999} userData={{ editHandle: true }}>
          <circleGeometry args={[0.045, 16]} /><meshBasicMaterial color="#7fd8ff" depthTest={false} />
        </mesh>
        <mesh position={[0, 0.11, -0.01]} renderOrder={998} userData={{ editHandle: true }}>
          <boxGeometry args={[0.1, 0.05, 0.1]} /><meshBasicMaterial color="#2b3138" depthTest={false} />
        </mesh>
        <mesh position={[0.07, 0.05, -0.072]} renderOrder={999} userData={{ editHandle: true }}>
          <circleGeometry args={[0.012, 8]} /><meshBasicMaterial color="#ff3b30" depthTest={false} />
        </mesh>
        <lineSegments geometry={lines} renderOrder={997} userData={{ editHandle: true }}>
          <lineBasicMaterial color={COL} transparent opacity={hit ? 0.95 : 0.6} depthTest={false} />
        </lineSegments>
      </group>
      <AxisGizmo id="camera1" at={pose.position.toArray() as [number, number, number]} theta={Math.atan2(ALONG.x, ALONG.z)} />
    </group>
  )
}

function Scene({ incense, active, orders, theme, reducedMotion, heat, fire, frame, onOffFire, onEat, onNotice, resetView, overview, ai, research, lang, spotOn, chefOf, crowdOf, crewOf, guestsBy, speech, onWalkOut, onGuests, potAi, onPotGuestEat, notes, inUse, phone, noodleWok, entriesOf, onOrderEntry, bakeKitchen,
  onOrder, onAddCharcoal, onSay, blessed = false, onDrink }: SceneProps) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const controls = useRef<OrbitControlsImpl>(null)
  // (in development, the view can be set from the console: __ctl.target, __cam.position)
  useEffect(() => { if (import.meta.env.DEV) Object.assign(window, { __ctl: controls.current }) })
  const camera = useThree((s) => s.camera)
  // while the kitchen's being tried out (the shop's closed) the view is held at camera 1; edit mode, and the shop being open, leave it free
  const { on: editing } = useEdit()
  const lockView = holdsCameraOne(modeOf(ai, research), editing) && !!DISHES[active].roast && !(import.meta.env.DEV && (window as unknown as { __freeCam?: boolean }).__freeCam)
  const lockRef = useRef(lockView)
  lockRef.current = lockView
  const wasLocked = useRef(false)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  // frame the dish on the stage rather than the whole canvas: shift the projection so the stage's centre is
  // the view's centre, and size the shot to the stage's shape
  const aspect = frame.w > 0 && frame.h > 0 ? frame.w / frame.h : size.width / size.height
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || frame.w <= 0) return
    const offX = size.width / 2 - frame.cx
    const offY = size.height / 2 - frame.cy
    camera.setViewOffset(size.width, size.height, offX, offY, size.width, size.height)
    camera.updateProjectionMatrix()
  }, [camera, size, frame])
  const look = LIGHTING[theme]

  // hot pot broth temperature -> steam and bubbles, so they lag the flame both ways (see boil.ts). The broth is
  // poured in cold: nothing until it heats up, wisps of steam close to the boil, bubbles only once it boils.
  // An empty pot has nothing to heat; a fresh soup starts from room temperature again.
  const potDish = DISHES.find((d) => d.heatControl)
  const hasSoup = !!potDish && !!orderedBase(potDish, orders[potDish.id])
  const brothTemp = useRef(ROOM_TEMP)
  // (each table's pot has its own temperature)
  const tempBy = useRef<Record<string, number>>({})
  const tempSpace = useRef(ai)
  useLayoutEffect(() => {
    if (tempSpace.current === ai) return
    tempBy.current[String(tempSpace.current)] = brothTemp.current
    brothTemp.current = tempBy.current[String(ai)] ?? ROOM_TEMP
    tempSpace.current = ai
  }, [ai])
  // (the open shop's soup comes from the kitchen's stock pot, already near the boil: customers aren't kept waiting
  // while a cold pot heats up)
  const openSoup = ai && potDish ? orderedBase(potDish, orders[potDish.id])?.id ?? null : null
  useEffect(() => {
    if (openSoup) brothTemp.current = Math.max(brothTemp.current, 88)
  }, [openSoup])
  // smoke off the grill: only once food on it is cooking through (Roasting sets it)
  const grillSmoke = useRef(0)
  const grillBlackSmoke = useRef(0)
  // black smoke off a hot pot left on the flame with nothing in it
  const potSmoke = useRef(0)
  const steamLevel = useRef(0)
  const boilLevel = useRef(0)
  useFrame((_, delta) => {
    brothTemp.current = hasSoup ? stepTemp(brothTemp.current, heat, Math.min(delta, 0.1)) : ROOM_TEMP
    steamLevel.current = steamAmount(brothTemp.current, heat)
    boilLevel.current = boilAmount(brothTemp.current, heat)
  })
  const dishLight = DISHES[active].light ?? {}

  // staged loading: once the light model of the dish on screen has been up a moment, and nothing's been ordered
  // from it yet, the full model is loaded behind it and takes over
  const [upgraded, setUpgraded] = useState<Set<string>>(() => new Set())
  const activeId = DISHES[active].id
  // (on neither table: swapping the model starts the dish over)
  const idle = !inUse.includes(activeId)
  useEffect(() => {
    if (!QUALITY.upgrade || !idle || upgraded.has(activeId)) return
    const t = window.setTimeout(() => setUpgraded((u) => new Set(u).add(activeId)), 1500)
    return () => window.clearTimeout(t)
  }, [activeId, idle, upgraded])

  // warm spot: per-dish position, strength and shadow softness, eased so switching dishes doesn't pop
  const spot = useRef<THREE.SpotLight>(null)
  const floor = useRef<THREE.ShadowMaterial>(null)
  useEffect(() => {
    const light = spot.current
    if (!light) return
    scene.add(light.target)
    return () => {
      scene.remove(light.target)
    }
  }, [scene])
  const spotGoal = useRef(new THREE.Vector3())

  // on every dish change (and when the viewport reshapes), glide the camera back to the home pose
  // so framing never drifts
  const homing = useRef(true)
  const home = useRef(new THREE.Vector3())
  const homeTarget = useMemo(() => new THREE.Vector3(), [])
  // (what the camera was last homed for: a change in the canvas's own shape alone (the menu folding or opening, edit mode folding it) isn't a reason to
  // glide it back: it stays as it is, and only a new dish, the reset button, the overview or a resized window homes it)
  const homedFor = useRef<{ active: number; resetView: number; overview: boolean; w: number; h: number } | null>(null)
  useEffect(() => {
    const was = homedFor.current
    homedFor.current = { active, resetView, overview, w: size.width, h: size.height }
    if (was && was.active === active && was.resetView === resetView && was.overview === overview && was.w === size.width && was.h === size.height && frame.w > 0 && frame.h > 0) return
    const focus = new THREE.Vector3(0, DISHES[active].focusY, 0)
    // (a phone's stage sits above the menu inside a full-height canvas: what fits it is the stage's width against
    // the canvas height, and it mustn't back off just because the menu was folded away)
    const phoneStage = frame.h > 0 && frame.h < size.height * 0.95 || (frame.w < 700 && size.height > size.width)
    const scale = phoneStage ? Math.min(3.4, (1.3 / (frame.w / size.height)) * 0.92) : cameraDistanceScale(aspect)
    const wide = overview && !!DISHES[active].roast && !phoneStage
    if (wide) {
      home.current.copy(OVERVIEW_POSITION)
      homeTarget.copy(OVERVIEW_TARGET)
    } else {
      home.current.set(...CAMERA_POSITION).sub(focus).multiplyScalar(scale).add(focus)
      homeTarget.copy(focus)
    }
    homing.current = true
    zoomGoal.current = null
  }, [active, aspect, resetView, overview, frame.w, frame.h, size.width, size.height])

  // smooth wheel zoom: each notch nudges a target distance and the camera eases toward it
  const gl = useThree((s) => s.gl)
  const zoomGoal = useRef<number | null>(null)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      const c = controls.current
      if (!c) return
      e.preventDefault()
      if (lockRef.current) return
      homing.current = false
      const now = zoomGoal.current ?? camera.position.distanceTo(c.target)
      zoomGoal.current = THREE.MathUtils.clamp(now * Math.exp(e.deltaY * 0.0011), 1.8, 20)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl, camera])
  const zoomDir = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    const k = reducedMotion ? 1 : Math.min(1, delta * 6)
    // slide dishes along X; a dish that wraps from one side to the other jumps instead of crossing the stage
    groups.current.forEach((g, i) => {
      if (!g) return
      const target = slot(i, active, DISHES.length) * SPACING
      if (Math.abs(target - g.position.x) > SPACING * 1.5) g.position.x = target
      else g.position.x += (target - g.position.x) * k
      g.visible = Math.abs(g.position.x) < SPACING * 0.98
    })

    const focusY = DISHES[active].focusY
    const s = spot.current
    if (s) {
      s.target.position.set(0, focusY, 0)
      s.position.lerp(spotGoal.current.set(...(dishLight.spotPosition ?? SPOT_POSITION)), k)
      s.intensity += (look.spot * (dishLight.spotIntensity ?? 1) - s.intensity) * k
      s.shadow.radius = dishLight.shadowSoftness ?? SPOT_SOFTNESS
    }
    if (floor.current) {
      const goal = dishLight.shadowOpacity ?? look.shadowOpacity
      floor.current.opacity += (goal - floor.current.opacity) * k
    }

    const c = controls.current
    if (c && lockView) {
      // (held at camera 1: it glides there, and the controls are off so nothing drags it away)
      const pose = cameraOneOf(home.current, homeTarget, offsetOf('camera1'), rotationOf('camera1'))
      c.enabled = false
      homing.current = false
      zoomGoal.current = null
      camera.position.lerp(pose.position, k)
      c.target.lerp(pose.target, k)
      c.update()
      wasLocked.current = true
    } else if (c && wasLocked.current) {
      // (let go: the view is where it was, free to be turned and moved again)
      c.enabled = true
      wasLocked.current = false
    } else if (c && homing.current) {
      camera.position.lerp(home.current, k)
      // (any panning is undone too: the target slides back to the middle of the dish)
      c.target.lerp(homeTarget, k)
      c.update()
      if (camera.position.distanceTo(home.current) < 0.002 && c.target.distanceTo(homeTarget) < 0.002) {
        homing.current = false
      }
    } else if (c && zoomGoal.current !== null) {
      const dir = zoomDir.current.copy(camera.position).sub(c.target)
      const dist = dir.length()
      const next = dist + (zoomGoal.current - dist) * (reducedMotion ? 1 : Math.min(1, delta * 7))
      camera.position.copy(c.target).addScaledVector(dir.normalize(), next)
      if (Math.abs(next - zoomGoal.current) < 0.002) zoomGoal.current = null
    }
  })

  return (
    <>
      <directionalLight position={[3, 5, 2]} intensity={look.sunIntensity} color={look.sun} />
      <hemisphereLight args={[look.sky, look.ground, look.hemi]} />
      <IndoorHDRI night={theme === 'dark'} intensity={theme === 'dark' ? 0.3 + look.hemi * 0.4 : 0.5 + look.hemi * 0.5} />
      <spotLight
        ref={spot}
        position={SPOT_POSITION}
        color="#ffbf7a"
        intensity={look.spot}
        angle={0.5}
        penumbra={0.9}
        distance={14}
        decay={1.6}
        castShadow
        shadow-mapSize={[QUALITY.shadowSize, QUALITY.shadowSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      <OpeningSpot on={spotOn} focusY={DISHES[active].focusY} />

      {/* invisible floor that only shows the spot's shadow, so there's still no background */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial ref={floor} color={look.shadow} transparent opacity={look.shadowOpacity} />
      </mesh>

      {DISHES.map((dish, i) => {
        const base = orderedBase(dish, orders[dish.id])
        // nothing ordered yet: an empty pot or bowl (the soup, noodles and garnish come with the base)
        const hidden = base ? base.hide : dish.emptyHide
        const soup = !!base || !dish.emptyHide
        // everything drawn from the dish's model (the full one, or its light version)
        const models = (url: string) => (
          <group position={dish.roast ? FIRE_SHIFT : undefined}>
              <Dish url={url} itemIds={ITEM_IDS[dish.id]} quantities={servings(dish, orders[dish.id])}
                broth={base?.broth} hidden={hidden} fill={base?.fill} tint={base?.tint}
                floatIds={FLOAT_IDS[dish.id]} layout={dish.layout}
                instant={reducedMotion} />
              {/* after <Dish>, so its transforms win over the pop-in each frame */}
              {dish.roast && (
                <Roasting url={url} roast={dish.roast} itemIds={ITEM_IDS[dish.id]} quantities={servings(dish, orders[dish.id])}
                  active={i === active} instant={reducedMotion} fire={fire} onOffFire={onOffFire} onEat={onEat}
                  onNotice={onNotice} smoke={grillSmoke} blackSmoke={grillBlackSmoke}
                  ai={ai} research={research} onOrder={onOrder} onAddCharcoal={onAddCharcoal} onSay={onSay} chef={chefOf(dish.id)} onGuests={(g) => onGuests(dish.id, g)} crowd={crowdOf(dish.id)} blessed={blessed} onDrink={onDrink}
                  crew={crewOf(dish.id)} bar={!phone}
                  onWalkOut={(ids, g) => onWalkOut(ids, dish, g)} lang={lang}
                  entries={ai ? entriesOf(dish.id) : undefined} onOrderEntry={onOrderEntry}
                  names={Object.fromEntries(dish.items.map((x) => [x.id, nameIn(lang, x)]))}
                  space={ai ? 'open' : 'closed'} locked={editing}
                  notes={Object.fromEntries(Object.entries(notes).map(([k, n]) => [k, bestOf(n)]))} />
              )}
              {dish.heatControl && <StoveControls url={url} heat={heat} />}
              {(ai || !!dish.roast) && i === active && !phone && (
                // the customers, in 3D (a phone has them in 2D on the guest board, and no 3D bar at all), at the bar behind (the grill's bar is drawn by Roasting, which serves onto it);
                // the grill's room is there before it opens too, empty
                <group position={dish.roast ? FIRE_SHIFT.clone().negate() : undefined}><GuestBar3D open={ai} guests={ai ? guestsBy[dish.id] ?? [] : []} lang={lang} drawCounter={!dish.roast} speech={speech}
                  servers={dish.roast && ai ? (() => { const hired = crewOf(dish.id).filter((w) => w.role === 'server'); return hired.length ? hired : [HOUSE_SERVER] })() : []}
                  mark={dish.roast ? '聞野' : dish.heatControl ? '鼎沸' : dish.bake ? '麵包' : '食堂'}
                  top={dish.roast ? BAR_TOP : 0.465} counters={dish.roast ? GRILL_COUNTERS : undefined} scale={dish.roast ? GRILL_SCALE : 1} offset={dish.roast ? GRILL_OFFSET : undefined}
                  at={dish.roast ? BAR_AT : new THREE.Vector3(-0.59, 0, -0.81).multiplyScalar(dish.heatControl ? 2.75 : 1.95)}
                  incense={dish.roast ? incense : undefined} onDrink={onDrink} /></group>
              )}
              {dish.id === 'beefnoodle' && (
                <TaiwanTable items={dish.items} quantities={servings(dish, orders[dish.id])} active={i === active} locked={ai}
                  onEat={onEat} wokBusy={noodleWok} cooked={ai} />
              )}
              {dish.id === 'beefnoodle' && (
                <NoodleEating url={url} base={base?.id ?? null} taste={base ? 70 + (base.broth || base.fill ? 4 : 0) : 0}
                  active={i === active} locked={ai} toppings={dish.items.map((x) => x.id)} onEat={onEat} />
              )}
              {dish.heatControl && (
                <PotCooking url={url} itemIds={ITEM_IDS[dish.id]} temp={brothTemp} active={i === active}
                  onEat={onEat} onNotice={onNotice} soup={soup} heat={heat} floorY={(dish.brothY ?? 0.81) - 0.27}
                  smoke={potSmoke} rice={servings(dish, orders[dish.id]).Rice ?? 0} lang={lang}
                  aiWanted={ai && i === active ? potAi : []} aiPace={chefOf(dish.id).pace} onGuestEat={onPotGuestEat}
                  space={ai ? 'open' : 'closed'} locked={ai} />
              )}
          </group>
        )
        return (
          <group key={dish.id} ref={(g) => { groups.current[i] = g }}
            position-x={slot(i, active, DISHES.length) * SPACING}>
            {/* (only the dish on screen is loaded, unless the device can hold all three; a shop with food out stays
                loaded though, or switching away and back would throw away everything on it and start it over) */}
            {(QUALITY.allDishes || i === active || inUse.includes(dish.id)) && <Suspense fallback={null}>
              {/* loaded in two steps where the device can take it: the light model shows at once, the full one
                  replaces it when it has loaded (only while nothing's ordered, so nothing being cooked is lost) */}
              {dish.procedural ? (
                dish.bake && <Bakery items={dish.items} bake={dish.bake} quantities={servings(dish, orders[dish.id])} active={i === active}
                  locked={ai} lang={lang} onEat={onEat} kitchen={ai && i === active ? bakeKitchen : null} />
              ) : QUALITY.lite && !(QUALITY.upgrade && upgraded.has(dish.id)) ? models(liteUrl(dish.model))
                : QUALITY.lite ? <Suspense fallback={models(liteUrl(dish.model))}>{models(dish.model)}</Suspense>
                  : models(dish.model)}
              {soup && dish.heatControl && dish.brothY !== undefined && (
                // inner radius of the pot at the broth line (blender/hotpot.py INNER_R)
                <Bubbles position-y={dish.brothY + 0.004} radius={0.74} boil={boilLevel} />
              )}
              {dish.heat === 'gas' && (
                <GasFlame position-y={BURNER_Y} heat={dish.heatControl ? heat / 100 : 1}
                  baseIntensity={theme === 'dark' ? 1.5 : 0.8} />
              )}
              {/* toon ramps blow out easily, so the firelight stays modest */}
              {dish.heat === 'fire' && <group position={dish.roast ? [FIRE_SHIFT.x, PIT_LIFT, FIRE_SHIFT.z] : undefined}><Fire width={0.6} height={0.42} baseIntensity={look.fire} level={fire} /></group>}
              {soup && dish.brothY !== undefined && dish.steam && (
                <Steam position={[0, dish.brothY + 0.02, 0]} width={dish.steam.width} height={dish.steam.height}
                  opacity={theme === 'dark' ? 0.5 : 0.7} level={dish.heatControl ? steamLevel : undefined} />
              )}
              <group position={dish.roast ? [FIRE_SHIFT.x, PIT_LIFT, FIRE_SHIFT.z] : undefined}>
              {dish.smoke && (
                // same white puffs as the soup steam, just taller and slower
                <Steam position={[0, dish.smoke.y, 0]} width={dish.smoke.width} height={dish.smoke.height}
                  opacity={theme === 'dark' ? 0.5 : 0.7} speed={0.05}
                  level={dish.heat === 'fire' ? grillSmoke : undefined} />
              )}
              {dish.heatControl && dish.brothY !== undefined && (
                <Steam position={[0, dish.brothY - 0.2, 0]} width={0.8} height={1.4} layers={4} opacity={0.7} speed={0.1}
                  color="#3a3430" shade="#1c1916" level={potSmoke} />
              )}
              {dish.smoke && dish.heat === 'fire' && (
                // burning food: thick dark smoke that boils up faster and rolls about more than the pale smoke
                <Steam position={[0, dish.smoke.y, 0]} width={dish.smoke.width * 1.25} height={dish.smoke.height * 1.2}
                  layers={5} opacity={0.75} speed={0.11} color="#3a3430" shade="#1c1916" level={grillBlackSmoke} />
              )}
              </group>
            </Suspense>}
          </group>
        )
      })}

      <ContactShadows position={[0, 0, 0]} opacity={look.shadowOpacity * 0.8} color={look.shadow} scale={6}
        blur={2.6} far={1.5} />

      {editing && <CameraRig home={home} target={homeTarget} />}
      <OrbitControls
        ref={controls}
        // shared as the scene's controls so dragging a seasoning onto food can hold the camera still
        makeDefault
        target={[0, DISHES[0].focusY, 0]}
        // the middle button (or the right) drags the view sideways; the left one turns it
        enablePan
        screenSpacePanning
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        // on a touch screen one finger swipes between dishes (App), so turning the view takes two fingers,
        // which also pinch to zoom
        touches={IS_TOUCH ? { ONE: -1 as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE } : undefined}
        minDistance={1.8}
        maxDistance={20}
        maxPolarAngle={Math.PI * 0.45}
        // the wheel is handled below for a smooth glide; rotation drifts to a stop instead of halting
        enableZoom={IS_TOUCH}
        enableDamping
        dampingFactor={0.08}
        onStart={() => { homing.current = false }}
      />
    </>
  )
}

export default function App() {
  const [active, setActive] = useState(0)
  // portions ordered per item (and per base: soup, bowl, set meal), per dish. Nothing to start with
  // two tables: what the player has out to try (shop closed) and what the shop has out for its customers (open);
  // switching keeps each as it was
  const [ordersBy, setOrdersBy] = useState<Record<'closed' | 'open', Record<string, Record<string, number>>>>(() => ({
    closed: Object.fromEntries(DISHES.map((d) => [d.id, {}])),
    open: Object.fromEntries(DISHES.map((d) => [d.id, {}])),
  }))
  // how full you are: every bite eaten adds its calories, and they slowly digest away
  const [kcal, setKcal] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setKcal((k) => Math.max(0, k - DIGEST_KCAL_PER_SEC)), 1000)
    return () => window.clearInterval(id)
  }, [])
  // 評價: the average 美味 of everything eaten
  const [rating, setRating] = useState({ sum: 0, n: 0 })
  // 試吃筆記: every food tried, how it tasted and how it was cooked; the last one is shown under the stomach
  const [notes, setNotes] = useState<Notes>(() => SAVED?.notes ?? {})
  const [lastTry, setLastTry] = useState<{ name: string; taste: number; key: number } | null>(null)
  const langRef = useRef<Lang>('zh')
  const phoneRef = useRef(false)
  const potSoupRef = useRef<string | null>(null)
  const onEat = useCallback((id: string, taste: number, how?: { doneness?: number; dabs?: Record<string, number>; steps?: Step[]; dip?: string[] }) => {
    const item = ALL_ITEMS.get(id) ?? DISHES.flatMap((d) => d.bases).find((b) => b.id === id)
    const cal = (item as { kcal?: number } | undefined)?.kcal ?? BASE_KCAL[id] ?? 0
    setKcal((k) => k + cal)
    setRating((r) => ({ sum: r.sum + taste, n: r.n + 1 }))
    const name = item ? nameIn(langRef.current, item) : id
    setNotes((all) => {
      const next = { ...all, [id]: { name, tries: [...(all[id]?.tries ?? []), { taste, ...how, at: Date.now() }] } }
      // (food out of the hot pot is the soup tried too: that's how a soup base gets worked out)
      const soup = potSoupRef.current
      if (soup && potItems.has(id)) {
        const b = DISHES.flatMap((d) => d.bases).find((x) => x.id === soup)
        if (b) next[soup] = { name: nameIn(langRef.current, b), tries: [...(all[soup]?.tries ?? []), { taste, at: Date.now() }] }
      }
      return next
    })
    setLastTry({ name, taste, key: Date.now() })
  }, [])
  // (dev only: the browser tests try dishes without cooking them in 3D)
  // the soup in the hot pot being tried, if any
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __eat?: typeof onEat }).__eat = onEat
  }, [onEat])
  // AI simulation: a chef and customers, and what they've said lately
  // (the running costs are ticked in a second-by-second effect further down)
  const [ai, setAi] = useState(false)
  // the shop's shut and being worked by hand (研製料理): the view is held at camera 1, food is cooked and seasoned by hand, the stock chiller is on the board
  const [research, setResearch] = useState(false)
  useEffect(() => { if (ai) setResearch(false) }, [ai])
  const hand = modeOf(ai, research) === 'research'
  // the game's speed: ×1, or ×2 with the button top right (the 3D scene's clock and the shop's own timers)
  const [speed, setSpeed] = useState(1)
  const { on: editOn } = useEdit()
  // edit mode is for the scene alone: no game action goes through (a click on the 3D view is swallowed before it reaches what's clicked; the menu and buttons are shut by CSS)
  useEffect(() => {
    if (!editOn) return
    const stop = (e: Event) => { e.stopPropagation() }
    const layer = document.querySelector('.canvas-layer')
    layer?.addEventListener('click', stop, true)
    layer?.addEventListener('dblclick', stop, true)
    layer?.addEventListener('contextmenu', stop, true)
    return () => {
      layer?.removeEventListener('click', stop, true)
      layer?.removeEventListener('dblclick', stop, true)
      layer?.removeEventListener('contextmenu', stop, true)
    }
  }, [editOn])
  useEffect(() => { GAME_SPEED.value = speed }, [speed])
  // the sake offered at the shrine by the door: for a minute more come in and they order more
  const [incenseAt, setIncenseAt] = useState<number | null>(null)
  const [blessed, setBlessed] = useState(false)
  // closing: shut by the owner, the last customers finishing; leaving: they've gone and the staff are walking out
  const [closing, setClosing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => { SHOP.closing = closing; SHOP.leaving = leaving }, [closing, leaving])
  const lightIncense = () => {
    if (incenseAt !== null && performance.now() - incenseAt < INCENSE_MS) return
    if (cash < OFFERING_COST) {
      say(lang === 'ja' ? 'お金が足りません：お神酒をお供えするには NT$1,000 かかります' : '現金不足：供清酒需要 NT$1,000')
      return
    }
    book('offering', OFFERING_COST)
    setIncenseAt(performance.now())
    setBlessed(true)
    window.setTimeout(() => setBlessed(false), INCENSE_MS)
    say(lang === 'ja' ? 'お神酒をお供えしました（NT$1,000）：三分間、お客さんが増えて、よく注文してくれます' : '供了一杯清酒（花費 NT$1,000）：這三分鐘客人會變多，也點得比較多')
  }
  const space: 'closed' | 'open' = ai ? 'open' : 'closed'
  // (opening is the start of a new day)
  useEffect(() => {
    if (ai) setDays((d) => ({ ...d, day: d.day + 1, today: 0 }))
  }, [ai])
  {
    const pot = DISHES.find((d) => d.heatControl)
    potSoupRef.current = pot && !ai ? orderedBase(pot, ordersBy.closed[pot.id])?.id ?? null : null
  }
  const orders = ordersBy[space]
  const setOrders = (fn: (all: Record<string, Record<string, number>>) => Record<string, Record<string, number>>) =>
    setOrdersBy((b) => ({ ...b, [space]: fn(b[space]) }))
  // three shops (the hot pot, the noodle bar, the grill): each its own chef and its own customers
  // the staff hired at each shop (by worker id) and how tired each is
  const [hired, setHired] = useState<Record<string, Record<string, { fatigue: number }>>>(() => SAVED?.hired ?? {})
  const staffOf = (dishId: string, role?: Role) =>
    (CANDIDATES[dishId] ?? []).filter((w) => hired[dishId]?.[w.id] && (!role || w.role === role))
  /** the kitchen's cooking as the simulation needs it: the owner is the head chef; a hired chef (or, failing that,
   * the sous chef) is the hand that works alongside, and every cook in the kitchen speeds things up */
  const chefOf = (dishId: string): Chef => {
    const all = [...staffOf(dishId, 'chef'), ...staffOf(dishId, 'sous')]
    const cooks = staffOf(dishId, 'chef').length ? staffOf(dishId, 'chef') : staffOf(dishId, 'sous')
    if (!cooks.length) return { ...CHEFS[1], id: 'owner', skill: 0.7, cooks: 1, wagePerHour: staffOf(dishId).reduce((n, w) => n + w.wage, 0) }
    const best = cooks.map((w) => ({ w, e: effective(w, hired[dishId][w.id].fatigue) })).sort((a, b) => b.e - a.e)[0]
    const sp = best.w.speed / 100
    return { id: best.w.id, zh: best.w.zh, ja: best.w.ja, pace: Math.max(0.35, 1.7 - best.e * 0.7 - sp * 0.6),
      pullAt: 1.25 - best.e * 0.25, seasonChance: Math.min(1, 0.25 + best.e * 0.8),
      wagePerHour: staffOf(dishId).reduce((n, w) => n + w.wage, 0), skill: best.e, cooks: all.length + 1 }
  }
  const chef = chefOf(DISHES[active].id)
  const [guestsBy, setGuestsBy] = useState<Record<string, GuestView[]>>({})
  const guests = guestsBy[DISHES[active].id] ?? []
  // how many have come in all (customers are numbered as they come; the list itself only keeps the latest)
  const visits = guests.reduce((n, g) => Math.max(n, g.id), 0)
  // the shop's days: each time it opens is a new one; and how many customers came in, today and all told
  const [days, setDays] = useState({ day: 0, today: 0, total: 0 })
  const seen = useRef(new Set<string>())
  const setShopGuests = useCallback((dishId: string, g: GuestView[]) => {
    setGuestsBy((b) => ({ ...b, [dishId]: g }))
    let fresh = 0
    for (const x of g) {
      const k = `${dishId}-${x.id}`
      if (seen.current.has(k)) continue
      seen.current.add(k)
      fresh++
    }
    if (fresh) setDays((d) => ({ ...d, today: d.today + fresh, total: d.total + fresh }))
  }, [])
  // revenue mode: what's been sold, and what it cost to make (ingredients, fuel, the chef's wages)
  const [ledgerOn, setLedgerOn] = useState(false)
  // customers' orders as they come in, for the menu to write them down
  const [feed, setFeed] = useState<{ key: number; id: string; guest: number }[]>([])
  const feedSeq = useRef(0)
  // (phone) the guest board and the books folded into a chip until tapped
  const [boardsOpen, setBoardsOpen] = useState(false)
  // the guest board and the books can be dragged anywhere on the screen
  const dragBoard = useDrag('guests')
  const dragLedger = useDrag('ledger')
  const dragChat = useDrag('chat')
  // (phone) the round switches at the top right folded into one button
  const [toolsOpen, setToolsOpen] = useState(false)
  // (a new game starts with the grill already set up: its opening cost is already paid)
  const [ledger, setLedger] = useState(() => ({ revenue: 0, food: 0, fuel: 0, wage: 0, bought: 0, offering: 0, setup: SAVED ? 0 : SHOP_COST, ...SAVED?.ledger }))
  // the money in hand: the opening capital, plus what's been taken, less what's been spent (stock, fuel, wages)
  const cash = CAPITAL + ledger.revenue - ledger.bought - ledger.fuel - ledger.wage - (ledger.setup ?? 0) - (ledger.offering ?? 0)
  // ingredients in stock, by portion; nothing until it's bought
  const [stock, setStock] = useState<Record<string, number>>(() => SAVED?.stock ?? {})
  // the owner's name ('' while they aren't asked it: they're 老闆); null until they've founded the business, while the
  // welcome is up and the sign is dark
  const [owner, setOwner] = useState<string | null>(() => SAVED?.owner ?? '老闆')
  const [ignite, setIgnite] = useState(0)
  // which shops have been opened (each costs SHOP_COST to set up); an unopened shop is greyed out until its sign is
  // clicked and the opening paid for
  const [opened, setOpened] = useState<Record<string, boolean>>(() => SAVED?.opened ?? Object.fromEntries(DISHES.map((d) => [d.id, true])))
  const [asking, setAsking] = useState(false)
  // the 開業 button is hovered: a spotlight swings onto the shop
  const [spotOn, setSpotOn] = useState(false)
  // the business is saved as it goes (every few seconds and when the page is left), and picked up next time
  const saveRef = useRef<Omit<Saved, 'v'>>({ ledger, stock, hired, notes, owner, opened })
  saveRef.current = { ledger, stock, hired, notes, owner, opened }
  useEffect(() => {
    const write = () => {
      try {
        void saveRef.current      // (nothing is saved: a reload starts over)
      } catch {
        // nothing
      }
    }
    const id = window.setInterval(write, 4000)
    window.addEventListener('pagehide', write)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pagehide', write)
    }
  }, [])
  const [office, setOffice] = useState<null | 'book' | 'staff' | 'fridge'>(null)
  // 研發菜單: what's on each shop's menu (nothing to begin with: it's worked out with the shop closed)
  const [menuBy, setMenuBy] = useState<Record<string, Entry[]>>({})
  const menuByRef = useRef(menuBy)
  menuByRef.current = menuBy
  const entriesOf = (id: string) => menuBy[id] ?? []
  // how many of each dish on the menu have been ordered (for the menu board while open)
  const [entryCount, setEntryCount] = useState<Record<string, number>>({})
  // what each customer has paid, and for how many things (a walk-out is refunded for what they didn't get)
  const bills = useRef<Record<string, Record<number, { paid: number; parts: number }>>>({})
  /**
   * The second chef cooks these, in turn, as many as there's food for (up to max): each uses up its food from stock,
   * costs its ingredients, and goes in the notebook as a try, like the owner's own. How it comes out is what it
   * ought to (plan.taste), better or worse by how good he is. Returns what he made.
   */
  const chefCook = (d: DishInfo, plans: { id: string; dabs: Seasoning[]; taste: number }[], max: number, skills: number | number[]) => {
    const left = { ...stock }
    const can = (id: string) => Object.entries(takesOf(d, id)).every(([k, q]) => (left[k] ?? 0) >= q)
    let spent = 0
    const made: { id: string; dabs: Seasoning[]; taste: number; name: string }[] = []
    for (const x of plans) {
      if (made.length >= max) break
      if (!can(x.id)) continue
      for (const [k, q] of Object.entries(takesOf(d, x.id))) left[k] = (left[k] ?? 0) - q
      spent += partCost(d, { id: x.id, dabs: x.dabs, name: '', ja: '' })
      // (several cooks take turns, dish by dish, each as able as they are)
      const skill = Array.isArray(skills) ? skills[made.length % skills.length] : skills
      const taste = Math.round(Math.max(5, Math.min(98, x.taste + (skill - 0.7) * 15 + (Math.random() - 0.5) * (1 - skill) * 30)))
      made.push({ id: x.id, dabs: x.dabs, taste, name: dishName(d, x.id, x.dabs, lang) })
    }
    if (!made.length) return made
    setStock(left)
    book('food', spent)
    setNotes((all) => {
      const next = { ...all }
      for (const tr of made) {
        const item = findItem(d, tr.id)!
        next[tr.id] = { name: nameIn(lang, item), tries: [...(next[tr.id]?.tries ?? []), { taste: tr.taste, doneness: 1.1,
          dabs: Object.fromEntries(tr.dabs.map((k) => [k, 1])), ...(d.roast ? { steps: idealSteps(tr.dabs) } : {}), at: Date.now() }] }
      }
      return next
    })
    return made
  }
  /** the dishes not yet tried, the best first (a less able chef is less sure which those are) */
  const untriedIdeas = (d: DishInfo, skill: number) => {
    const tried = (id: string, dabs: Seasoning[]) => !!notes[id]?.tries.some((tr) => signature(tr.dabs).join('+') === dabs.join('+'))
    return trialIdeas(d).filter((x) => !tried(x.id, x.dabs))
      .map((x) => ({ ...x, guess: x.taste + (Math.random() - 0.5) * (1 - skill) * 40 }))
      .sort((a, b) => b.guess - a.guess)
  }
  const chefNow = (d: DishInfo) => {
    const c = staffOf(d.id, 'chef')[0] ?? staffOf(d.id, 'sous')[0]
    return c ? { c, skill: effective(c, hired[d.id]?.[c.id]?.fatigue ?? 0) } : null
  }
  /** everyone in the kitchen who can try dishes out: the second chef and the third, each with how able they are now */
  const cooksNow = (d: DishInfo) => [...staffOf(d.id, 'chef'), ...staffOf(d.id, 'sous')]
    .map((c) => ({ c, skill: effective(c, hired[d.id]?.[c.id]?.fatigue ?? 0) }))
  /**
   * A whole menu at once: the kitchen (second and third chef taking turns) works out n dishes it hasn't put up yet —
   * not only the surest, a few of their own fancy among them, each food at most twice — and they go up at a sensible
   * price. Returns what went up, and who made it.
   */
  const makeMenu = (d: DishInfo, n: number) => {
    const cooks = cooksNow(d)
    const listed = new Set(entriesOf(d.id).map((e) => e.key))
    const pool = trialIdeas(d).filter((x) => !listed.has(recipeKey(x.id, x.dabs)) && (stock[x.id] ?? 0) > 0)
      .map((x) => ({ ...x, pick: x.taste + Math.random() * 18 })).sort((a, b) => b.pick - a.pick)
    const per = new Map<string, number>()
    const chosen = pool.filter((x) => {
      const n = per.get(x.id) ?? 0
      if (n >= 2) return false
      per.set(x.id, n + 1)
      return true
    })
    const made: { id: string; dabs: Seasoning[]; taste: number; name: string }[] = []
    // (they take turns, dish by dish)
    made.push(...chefCook(d, chosen, n, cooks.map((ck) => ck.skill)))
    const room = MENU_MAX - entriesOf(d.id).length
    const up = made.slice(0, Math.max(0, room))
    if (up.length) setMenuBy((m) => {
      const cur = m[d.id] ?? []
      const add = up.map((x) => {
        const item = findItem(d, x.id)!
        const part = { id: x.id, dabs: x.dabs, name: partName(item, d.roast?.names[x.id] ?? item.name, x.id, x.dabs, 'zh', d.roast ? 'grill' : d.bake ? 'bake' : 'plain'),
          ja: partName(item, d.roast?.names[x.id] ?? item.name, x.id, x.dabs, 'ja', d.roast ? 'grill' : d.bake ? 'bake' : 'plain') }
        return { key: recipeKey(x.id, x.dabs), shop: d.id, name: part.name, ja: part.ja, price: menuPrice(d, part), parts: [part] }
      }).filter((e) => !cur.some((c) => c.key === e.key))
      return { ...m, [d.id]: [...cur, ...add].slice(0, MENU_MAX) }
    })
    const who = cooks.length > 1 ? CHEF_TALK[lang].together(lang === 'ja' ? cooks[0].c.ja : cooks[0].c.zh, lang === 'ja' ? cooks[1].c.ja : cooks[1].c.zh) : lang === 'ja' ? cooks[0].c.ja : cooks[0].c.zh
    return { up, who }
  }
  // talking with the second chef, at each shop: what was said both ways, and the dish he last offered to make
  const [talkBy, setTalkBy] = useState<Record<string, Talk[]>>({})
  const talkSeq = useRef(0)
  const offered = useRef<Record<string, { id: string; dabs: Seasoning[] } | null>>({})
  const addTalk = (shop: string, from: Talk['from'], text: string) =>
    setTalkBy((b) => ({ ...b, [shop]: [...(b[shop] ?? []).slice(-40), { id: ++talkSeq.current, from, text }] }))
  /**
   * The owner says something to the second chef: he works out what's wanted (game/chefChat) and answers — cooks the
   * dish asked for (choosing the seasoning himself if none was said), tries a few of his own choosing, says what
   * suits a food (and offers to make it: a 「好」 next has him do it), or how the stock is.
   */
  const chefChat = (d: DishInfo, text: string) => {
    const now = chefNow(d)
    if (!now || !text.trim()) return
    addTalk(d.id, 'me', text.trim())
    const T = CHEF_TALK[lang]
    const { skill } = now
    let intent = understand(text, d)
    const offer = offered.current[d.id]
    offered.current[d.id] = null
    if (intent.kind === 'yes') intent = offer ? { kind: 'make', ...offer } : { kind: 'makeWhat' }
    const nameOf = (id: string, dabs: Seasoning[]) => dishName(d, id, dabs, lang)
    const foodOf = (id: string) => (d.roast?.names[id] && lang !== 'ja' ? d.roast.names[id] : nameIn(lang, findItem(d, id)!))
    // how he'd say what goes on (撒點鹽, 刷醬油…)
    const how = (k: Seasoning) => lang === 'ja' ? SEASON_NAME.ja[k]
      : d.bake ? `包${SEASON_NAME.zh[k]}` : ({ salt: '撒點鹽', soy: '刷醬油', milk: '淋煉乳', peanut: '撒花生粉', miso: '抹味噌', wasabi: '配山葵', shichimi: '撒七味粉',
        yuzu: '點柚子胡椒', lemon: '擠檸檬' } as Record<string, string>)[k] ?? SEASON_NAME.zh[k]
    let reply: string
    switch (intent.kind) {
      case 'make': {
        const chose = intent.dabs === null
        const best = bestDabs(d, intent.id)
        // (left to him, a less able chef sometimes reaches for the second best)
        const dabs = intent.dabs ?? (best.length ? [Math.random() < skill || best.length < 2 ? best[0] : best[1]] : [])
        const exp = expectedTaste(d, intent.id, dabs)
        const made = chefCook(d, [{ id: intent.id, dabs, taste: exp }], 1, skill)
        const name = nameOf(intent.id, dabs)
        reply = made.length ? (exp < 50 ? T.warn(name) : '') + T.made(name, made[0].taste, chose) : T.noStock(name)
        break
      }
      case 'batch': {
        const made = chefCook(d, untriedIdeas(d, skill), intent.n, skill)
        reply = made.length ? T.batch(made.map((m) => m.name)) : T.batchNone()
        break
      }
      case 'menu': {
        // a whole menu at once (see makeMenu)
        const { up, who } = makeMenu(d, intent.n)
        reply = up.length ? T.menuMade(up.map((m) => m.name), who) : T.menuNone()
        break
      }
      case 'advise': {
        if (intent.id) {
          const best = bestDabs(d, intent.id)
          const dabs = best.length ? [best[0]] : []
          offered.current[d.id] = { id: intent.id, dabs }
          reply = best.length ? T.advise(foodOf(intent.id), how(best[0]), nameOf(intent.id, dabs))
            : d.roast ? T.advisePlain(foodOf(intent.id)) : T.adviseAny(nameOf(intent.id, []))
        } else {
          const idea = untriedIdeas(d, skill)[0]
          if (idea) offered.current[d.id] = { id: idea.id, dabs: idea.dabs }
          reply = idea ? T.adviseAny(nameOf(idea.id, idea.dabs)) : T.adviseNone()
        }
        break
      }
      case 'stock': {
        const goods = goodsOf(d)
        const low = goods.filter((g) => (stock[g.id] ?? 0) < 3).map((g) => `${foodOf(g.id)}${lang === 'ja' ? '残り' : '剩'} ${stock[g.id] ?? 0}`)
        reply = goods.every((g) => !(stock[g.id] ?? 0)) ? T.stockEmpty() : T.stock(low.slice(0, 6))
        break
      }
      case 'byKind': {
        // a kind of food: the best of it there's food for (one not tried yet, if any); asked about, he offers it,
        // otherwise he just makes it
        const label = lang === 'ja' ? intent.food.ja : intent.food.zh
        const have = intent.ids.filter((id) => (stock[id] ?? 0) > 0)
        const idea = untriedIdeas(d, skill).find((x) => have.includes(x.id))
          ?? have.map((id) => ({ id, dabs: bestDabs(d, id).slice(0, 1) }))
            .sort((a, b) => expectedTaste(d, b.id, b.dabs) - expectedTaste(d, a.id, a.dabs))[0]
        if (!idea) {
          reply = T.byKindNone(label)
        } else if (intent.ask) {
          offered.current[d.id] = { id: idea.id, dabs: idea.dabs }
          reply = T.byKind(label, nameOf(idea.id, idea.dabs))
        } else {
          const exp = expectedTaste(d, idea.id, idea.dabs)
          const made = chefCook(d, [{ id: idea.id, dabs: idea.dabs, taste: exp }], 1, skill)
          reply = made.length ? T.made(nameOf(idea.id, idea.dabs), made[0].taste, true) : T.noStock(nameOf(idea.id, idea.dabs))
        }
        break
      }
      case 'chat': {
        const c = now.c
        const C = T.chat
        const fatigue = hired[d.id]?.[c.id]?.fatigue ?? 0
        const open = ai && DISHES[active].id === d.id
        const guests = (guestsBy[d.id] ?? []).filter((g) => g.state === 'waiting' || g.state === 'eating').length
        reply = intent.topic === 'confused' ? T.confused()
          : intent.topic === 'tired' ? C.tired(fatigue)
          : intent.topic === 'who' ? C.who(lang === 'ja' ? c.ja : c.zh, c.note ? `${c.note}。` : '')
          : intent.topic === 'business' ? C.business(open, guests)
          : C[intent.topic]()
        break
      }
      case 'makeWhat': reply = T.makeWhat(); break
      case 'no': reply = T.no(); break
      case 'thanks': reply = T.thanks(); break
      case 'hello': reply = T.hello(); break
      default: {
        // he didn't follow: he says so, and suggests something there's food for
        const idea = untriedIdeas(d, skill).find((x) => (stock[x.id] ?? 0) > 0) ?? untriedIdeas(d, skill)[0]
        if (idea) offered.current[d.id] = { id: idea.id, dabs: idea.dabs }
        reply = T.unknown(idea ? nameOf(idea.id, idea.dabs) : foodOf(cookable(d)[0]?.id ?? ''))
      }
    }
    // (a moment to answer, as a person would)
    window.setTimeout(() => addTalk(d.id, 'chef', reply), 350 + Math.random() * 300)
  }
  /** buy in n of something (paid from the cash in hand) */
  const buyIn = (d: DishInfo, id: string, n: number) => {
    const it = ALL_ITEMS.get(id) ?? d.bases.find((b) => b.id === id)
    const cost = costOf(it ?? { price: 0 }) * n
    if (cost > cash) return
    book('bought', cost)
    setStock((st) => ({ ...st, [id]: (st[id] ?? 0) + n }))
  }
  /** buy in n of everything this shop sells */
  const buyAll = (d: DishInfo, n: number) => {
    const goods = goodsOf(d)
    const cost = buyAllCost(d, n)
    if (cost > cash) return
    book('bought', cost)
    setStock((st) => {
      const next = { ...st }
      for (const g of goods) next[g.id] = (next[g.id] ?? 0) + n
      return next
    })
  }
  /** 一鍵補貨: top everything this shop sells up to 10 portions */
  const topUp = (d: DishInfo) => {
    const { buy, cost } = topUpOrder(d, stock)
    if (!cost || cost > cash) return
    book('bought', cost)
    setStock((st) => {
      const next = { ...st }
      for (const [k, n] of Object.entries(buy)) next[k] = (next[k] ?? 0) + n
      return next
    })
  }
  const book = (k: keyof typeof ledger, amount: number) => setLedger((l) => ({ ...l, [k]: l[k] + amount }))
  const [chat, setChat] = useState<{ id: number; who: 'chef' | 'guest' | 'stock' | 'order'; text: string }[]>([])
  /** what each customer's saying just now (over their head) */
  const [speech, setSpeech] = useState<Record<number, { key: number; text: string }>>({})
  const chatId = useRef(0)
  const talk = useCallback((who: 'chef' | 'guest' | 'stock' | 'order', raw: string) => {
    // what a customer says is shown in a bubble over their head, where there's a 3D bar to show it on
    const said = /^#(\d+) (.*)$/.exec(raw)
    if (who === 'guest' && said && !phoneRef.current) {
      const gid = +said[1]
      const key = ++chatId.current
      setSpeech((sp) => ({ ...sp, [gid]: { key, text: said[2] } }))
      // (long enough for a long line to be said a piece at a time)
      const ms = Math.max(4500, sayChunks(said[2]).length * SAY_EACH * 1000 + 1500)
      window.setTimeout(() => setSpeech((sp) => (sp[gid]?.key === key ? Object.fromEntries(Object.entries(sp).filter(([k]) => +k !== gid)) : sp)), ms)
      return
    }
    // customers are named by how they look (上班族, 老奶奶…), not by number
    const lg = langRef.current
    const text = raw.replace(/^#(\d+) /, (_, n) => `${guestLabel(+n, lg)}${lg === 'ja' ? '「' : '：'}`)
      .replace(/#(\d+) ?/g, (_, n) => guestLabel(+n, lg)) + (lg === 'ja' && /^#\d+ /.test(raw) ? '」' : '')
    const id = ++chatId.current
    setChat((all) => [...all.slice(-4), { id, who, text }])
    window.setTimeout(() => setChat((all) => all.filter((m) => m.id !== id)), 6000)
  }, [])
  const [theme, toggleTheme] = useTheme()
  // the menu can be folded away to give the food the whole screen
  const [menuFolded, setMenuFolded] = useState(false)
  // (in edit mode the menu is folded away first, to leave the room in view; it comes back as it was when editing ends)
  const foldedBeforeEdit = useRef<boolean | null>(null)
  useEffect(() => {
    if (editOn) {
      foldedBeforeEdit.current = menuFolded
      setMenuFolded(true)
    } else if (foldedBeforeEdit.current !== null) {
      setMenuFolded(foldedBeforeEdit.current)
      foldedBeforeEdit.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOn])
  // bumped to send the camera back to its home view
  const [resetView, setResetView] = useState(0)
  const [overview, setOverview] = useState(false)
  // the browser dropped the WebGL context (a phone out of GPU memory)
  const [glLost, setGlLost] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const phone = usePhone()
  const smallScreen = useMedia(SMALL_SCREEN_QUERY)
  phoneRef.current = phone
  // the stove starts switched off: the cook turns it up
  const [heatBy, setHeatBy] = useState({ closed: 0, open: 0 })
  const heat = heatBy[space]
  const setHeat = (h: number) => setHeatBy((b) => ({ ...b, [space]: h }))
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return 'zh'
    } catch {
      return 'zh'
    }
  })
  langRef.current = lang
  const toggleLang = () =>
    setLang((l) => {
      const next: Lang = l === 'zh' ? 'ja' : 'zh'
      try {
        void next
      } catch {
        // not remembered; the switch still works for this visit
      }
      return next
    })

  // where the stage sits inside the full-window canvas
  const appRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<Frame>({ cx: 0, cy: 0, w: 0, h: 0 })
  useEffect(() => {
    const app = appRef.current
    const stage = stageRef.current
    if (!app || !stage) return
    const measure = () => {
      const a = app.getBoundingClientRect()
      const s = stage.getBoundingClientRect()
      setFrame({ cx: s.left - a.left + s.width / 2, cy: s.top - a.top + s.height / 2, w: s.width, h: s.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(app)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])
  // charcoal grill: burns down by itself at about the pace of real binchotan on a grill (a full bed lasts about an
  // hour and a half; a handful of fresh charcoal, 添炭, about a quarter of an hour more)
  // the charcoal isn't lit to begin with: add charcoal to start the fire
  const fire = useRef(0)
  const [fireLevel, setFireLevel] = useState(0)
  // each table has its own fire: the player's test fire and the shop's
  const fireBy = useRef<Record<string, number>>({})
  const lastSpace = useRef(space)
  useLayoutEffect(() => {
    if (lastSpace.current === space) return
    fireBy.current[lastSpace.current] = fire.current
    fire.current = fireBy.current[space] ?? 0
    setFireLevel(Math.round(fire.current * 100))
    lastSpace.current = space
  }, [space])
  useEffect(() => {
    const id = window.setInterval(() => {
      fire.current = Math.max(0, fire.current - FIRE_BURN_PER_TICK * GAME_SPEED.value)
      setFireLevel(Math.round(fire.current * 100))
    }, 200)
    return () => window.clearInterval(id)
  }, [])
  /** puts charcoal on (and pays for it), unless the fire is already at 100%: then nothing is added; returns whether it went on */
  const addCharcoal = () => {
    if (!canAddCharcoal(fire.current)) { say(UI[lang].charcoalFull); return false }
    book('fuel', CHARCOAL_COST)
    fire.current = afterCharcoal(fire.current)
    setFireLevel(Math.round(fire.current * 100))
    return true
  }
  const dish = DISHES[active]
  // a phone at the grill has no 3D view: the fire pit and the customers' bar are drawn flat (Grill2D)
  // (by the screen's size: a tablet, touch screen or not, keeps the 3D grill)
  const flatGrill = smallScreen && !!dish.roast
  const sceneOffFire = (n: number, loose: number) => { setOffFire(n); setLoose(loose) }
  const sceneNotice = (what: 'notCooked' | 'burnt' | 'waste' | 'fireFull' | 'offTable' | 'heapFull') => say(what === 'fireFull' ? UI[lang].fireFull(FIRE_CAPACITY) : UI[lang][what])
  const sceneOrder = (id: string, guest?: number) => {
    const ok = changeQty(id, 1)
    // a customer's order is written onto the menu below, so you see it come in
    if (ok && guest) {
      const key = ++feedSeq.current
      setFeed((f) => [...f.slice(-2), { key, id, guest }])
      const it = findItem(dish, id)
      talk('order', `#${guest} ${lang === 'ja' ? 'から' : '點了'} ${it ? nameIn(lang, it) : id}`)
      window.setTimeout(() => setFeed((f) => f.filter((x) => x.key !== key)), 3200)
    }
    return ok
  }
  const base = orderedBase(dish, orders[dish.id])
  /** the menu board while open: the dishes on the menu (soups and bowls among the dark tags), at their prices */
  const menuDish = (d: DishInfo): DishInfo => {
    const asItem = (e: Entry) => ({ ...(findItem(d, e.parts[0].id) as object), id: e.key, name: e.name, ja: e.ja,
      en: e.parts.length === 1 ? partEn(findItem(d, e.parts[0].id)?.en, e.parts[0].dabs, d.roast ? 'grill' : d.bake ? 'bake' : 'plain') : undefined,
      price: e.price, icon: e.parts[0].id, includes: undefined, max: undefined })
    const isBase = (e: Entry) => d.bases.some((b) => b.id === e.parts[0].id)
    return { ...d, bases: entriesOf(d.id).filter(isBase).map(asItem) as DishInfo['bases'],
      items: entriesOf(d.id).filter((e) => !isBase(e)).map(asItem) as DishInfo['items'] }
  }
  /** (shop closed) what can be tried out: the shop's own foods (at the grill not ready-made sets: sets are made up
   * from what's been worked out) */
  const researchDish = (d: DishInfo): DishInfo => (d.roast ? { ...d, bases: d.bases.filter((b) => !b.includes) } : d)
  /** how many of each dish on the menu could be made from what's in stock */
  const entryStock = (d: DishInfo) => Object.fromEntries(entriesOf(d.id).map((e) =>
    [e.key, portionsLeft(e, stock)]))

  // dev only: mirror what's on screen into the open Blender (vite.config.ts -> blender/open_live.py)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const state = {
      dish: dish.id,
      blend: `${dish.id}.blend`,
      items: ITEM_IDS[dish.id],
      selected: Object.entries(servings(dish, orders[dish.id])).filter(([, n]) => n > 0).map(([id]) => id),
      hide: (base ? base.hide : dish.emptyHide) ?? [],
      broth: base?.broth ?? null,
      focusY: dish.focusY,
      camera: { position: CAMERA_POSITION, fov: CAMERA_FOV },
    }
    fetch('/__canteen/state', { method: 'POST', body: JSON.stringify(state) }).catch(() => {
      // Blender sync is a convenience; the page works without it
    })
  }, [dish, base, orders])

  // ← / → switch dishes, like the carousel arrows (but leave the 火候 slider its own arrow keys)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLInputElement) return
      if (document.querySelector('.welcome')) return
      const n = DISHES.length
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + n) % n)
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // running costs: the gas while the burner's on, the chef's wages while the AI chef is working
  const heatRef = useRef(heat)
  heatRef.current = heat
  const aiRef = useRef({ ai, wage: chef.wagePerHour, shop: DISHES[active].id })
  aiRef.current = { ai, wage: chef.wagePerHour, shop: DISHES[active].id }
  const stockRef = useRef(stock)
  stockRef.current = stock
  // the stock keeper (倉儲) at each shop goes round now and then and orders in whatever its menu is running low on:
  // a quicker one checks more often, a tired one less often, a skilled one gets a better price
  const restockRef = useRef({ cash, menuBy, hired, active, lang })
  restockRef.current = { cash, menuBy, hired, active, lang }
  const lastRound = useRef<Record<string, number>>({})
  useEffect(() => {
    const id = window.setInterval(() => {
      const { cash, menuBy, hired, active, lang } = restockRef.current
      let money = cash
      for (const d of DISHES) {
        const keeper = (CANDIDATES[d.id] ?? []).find((w) => w.role === 'stock' && hired[d.id]?.[w.id])
        if (!keeper) continue
        const fatigue = hired[d.id][keeper.id].fatigue
        const now = Date.now()
        if (now - (lastRound.current[d.id] ?? 0) < (45 - keeper.speed * 0.3) * (1 + fatigue / 100) * 1000) continue
        lastRound.current[d.id] = now
        const { buy, cost } = restockOrder(d, menuBy[d.id] ?? [], stockRef.current, money, effective(keeper, fatigue) * 100)
        if (!cost) continue
        money -= cost
        book('bought', cost)
        stockRef.current = { ...stockRef.current }
        for (const [k, n] of Object.entries(buy)) stockRef.current[k] = (stockRef.current[k] ?? 0) + n
        setStock((st) => {
          const next = { ...st }
          for (const [k, n] of Object.entries(buy)) next[k] = (next[k] ?? 0) + n
          return next
        })
        if (DISHES[active].id === d.id) {
          const names = Object.entries(buy).map(([k, n]) => {
            const it = ALL_ITEMS.get(k) ?? d.bases.find((b) => b.id === k)
            return `${(lang === 'ja' ? it?.ja : it?.name) ?? k} ${n}`
          })
          talk('stock', UI[lang].restocked(lang === 'ja' ? keeper.ja : keeper.zh, names.join('、')))
        }
      }
    }, 1000)
    return () => window.clearInterval(id)
    // (everything it reads is in restockRef; book and talk only set state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // tiredness: the open shop's staff tire as they work (the less stamina, the faster), everyone else rests
  useEffect(() => {
    const id = window.setInterval(() => {
      setHired((h) => {
        // (nothing changes for someone fully rested and resting: then nothing re-renders)
        let changed = false
        const next: typeof h = {}
        for (const [shop, ws] of Object.entries(h)) {
          next[shop] = {}
          for (const [wid, st] of Object.entries(ws)) {
            const w = CANDIDATES[shop].find((x) => x.id === wid)!
            const working = aiRef.current.ai && aiRef.current.shop === shop
            const fatigue = Math.max(0, Math.min(100, st.fatigue + (working ? tirePerMin(w) : -restPerMin) / 60 * GAME_SPEED.value))
            if (fatigue !== st.fatigue) changed = true
            next[shop][wid] = { fatigue }
          }
        }
        return changed ? next : h
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const id = window.setInterval(() => {
      if (heatRef.current > 0) book('fuel', (GAS_PER_HOUR * heatRef.current) / 100 / 3600 * GAME_SPEED.value)
      if (aiRef.current.ai) book('wage', aiRef.current.wage / 3600 * GAME_SPEED.value)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // touch gestures over the 3D view (not on the menu or a button):
  //  - one finger flicked left or right switches dishes
  //  - pulled down from the top half of the screen and let go, reloads the page, like other sites
  // A drag that picked up food or a tool (the page gets is-carrying) is neither.
  const [pull, setPull] = useState(0)
  useEffect(() => {
    if (!IS_TOUCH) return
    let s: { x: number; y: number; t: number; carrying: boolean } | null = null
    const skip = (t: EventTarget | null) => t instanceof Element && !!t.closest('.menu, button, input, .side-boards, .menu-fold')
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || skip(e.target)) {
        s = null
        return
      }
      const p = e.touches[0]
      s = { x: p.clientX, y: p.clientY, t: performance.now(), carrying: false }
    }
    const move = (e: TouchEvent) => {
      if (!s) return
      if (e.touches.length !== 1) {
        s = null
        setPull(0)
        return
      }
      if (document.body.classList.contains('is-carrying')) s.carrying = true
      const p = e.touches[0]
      const dx = p.clientX - s.x
      const dy = p.clientY - s.y
      const pulling = !s.carrying && s.y < window.innerHeight * 0.5 && dy > 0 && dy > Math.abs(dx) * 1.6
      setPull(pulling ? Math.min(1, dy / 140) : 0)
    }
    const end = (e: TouchEvent) => {
      const g = s
      s = null
      setPull((v) => {
        if (v >= 1 && g && !g.carrying) window.setTimeout(() => window.location.reload(), 120)
        return v >= 1 ? 1 : 0
      })
      if (!g || g.carrying || e.changedTouches.length !== 1 || document.body.classList.contains('is-carrying')) return
      const p = e.changedTouches[0]
      const dx = p.clientX - g.x
      const dy = p.clientY - g.y
      if (performance.now() - g.t > 1200 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
      const n = DISHES.length
      setActive((i) => (dx < 0 ? (i + 1) % n : (i - 1 + n) % n))
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', () => { s = null; setPull(0) })
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
  }, [])
  // sold out: once there's nothing left to sell, no new customers can order; when the last one has finished, the
  // shop closes by itself
  useEffect(() => {
    if (!ai) return
    const d = DISHES[active]
    if (!opened[d.id]) {
      // (switched over to a shop that hasn't opened yet: business stops)
      setAi(false)
      return
    }
    if (sellable(d)) return
    const seated = (guestsBy[d.id] ?? []).some((g) => g.state === 'waiting' || g.state === 'eating')
    if (seated) return
    setAi(false)
    say(UI[lang].soldOut)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, stock, guestsBy, active, opened])

  // 自動營運: the whole shop runs itself — hiring whoever's missing, buying in, having the kitchen work out a menu,
  // opening, ordering more as it sells, and shutting for a rest when the staff are worn out — one step every few
  // seconds (each step acts on the state as it is then, so it does one thing at a time)
  const [auto, setAuto] = useState(false)
  const resting = useRef(false)
  // (the last customer's gone: the staff walk out, and then the shop is shut)
  useEffect(() => {
    if (!closing || leaving) return
    if (!ai) {
      setClosing(false)
      return
    }
    if ((guestsBy[DISHES[active].id] ?? []).some((g) => g.state === 'waiting' || g.state === 'eating')) return
    setLeaving(true)
    // (a timer of its own, not the effect's: the effect runs again the moment `leaving` changes)
    window.setTimeout(() => {
      setAi(false)
      setClosing(false)
      setLeaving(false)
    }, 5000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, leaving, ai, guestsBy, active])
  const autoStep = useRef<() => void>(() => {})
  autoStep.current = () => {
    // (shut for the day by hand: it stays shut)
    if (closing || leaving) return
    const d = DISHES[active]
    const T = UI[lang]
    const mine = hired[d.id] ?? {}
    const tired = Math.max(0, ...Object.values(mine).map((w) => w.fatigue))
    const seated = (guestsBy[d.id] ?? []).some((g) => g.state === 'waiting' || g.state === 'eating')
    if (ai) {
      // worn out: no more customers in; shut once the last has eaten
      if (tired > 85 && !seated) {
        resting.current = true
        setAi(false)
        say(T.autoRest)
        return
      }
      // no stock keeper: order in what the menu's running low on, as one would
      const keeper = (CANDIDATES[d.id] ?? []).some((w) => w.role === 'stock' && mine[w.id])
      if (!keeper) {
        const { buy, cost } = restockOrder(d, entriesOf(d.id), stock, cash, 60)
        if (cost) {
          book('bought', cost)
          setStock((st) => {
            const next = { ...st }
            for (const [k, q] of Object.entries(buy)) next[k] = (next[k] ?? 0) + q
            return next
          })
        }
      }
      return
    }
    if (resting.current && tired > 25) return
    resting.current = false
    const hires = pickHires(CANDIDATES[d.id] ?? [], ROLES[d.id] ?? [], mine)
    if (hires.length) {
      setHired((h) => ({ ...h, [d.id]: { ...(h[d.id] ?? {}), ...Object.fromEntries(hires.map((w) => [w.id, { fatigue: 0 }])) } }))
      say(T.autoHired(hires.length))
      return
    }
    const order = topUpOrder(d, stock)
    if (order.cost && order.cost <= cash) {
      topUp(d)
      return
    }
    if (entriesOf(d.id).length < (MENU_MIN[d.id] ?? 1) && cooksNow(d).length) {
      const { up, who } = makeMenu(d, 10)
      if (up.length) addTalk(d.id, 'chef', CHEF_TALK[lang].menuMade(up.map((m) => m.name), who))
      return
    }
    if (entriesOf(d.id).length >= (MENU_MIN[d.id] ?? 1) && sellable(d)) {
      setAi(true)
      say(T.autoOpen)
    }
  }
  useEffect(() => {
    if (!auto) return
    autoStep.current()
    const id = window.setInterval(() => autoStep.current(), 2500)
    return () => window.clearInterval(id)
  }, [auto])

  /** whether a customer could order anything at this shop now: skewers at the grill, things to cook (and a soup,
   * or one already in the pot) at the hot pot, a bowl or a dish off the table at the noodle bar */
  function sellable(d: DishInfo) {
    // (only what's on the menu, and in stock)
    const es = entriesOf(d.id).filter((e) => canServe(e, stock))
    const isSoup = (e: Entry) => e.parts.every((p) => d.bases.some((b) => b.id === p.id))
    return d.id === 'hotpot' ? (es.some(isSoup) || !!orderedBase(d, ordersBy.open[d.id])) && es.some((e) => !isSoup(e))
      : es.length > 0
  }
  const MAX_PORTIONS = 99
  // the fire only holds so many skewers; past that, take something off before ordering more
  const [offFire, setOffFire] = useState(0)
  // potatoes and sweet potatoes still around (in the ash or the basket, not yet eaten)
  const [loose, setLoose] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef(0)
  const say = (text: string) => {
    setNotice(text)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600)
  }
  // skewers count toward the fire's limit; potatoes in the ash and mochi on the net have their own
  const isSkewer = (id: string) => !!dish.roast && id in dish.roast.times && !dish.roast.loose.includes(id)
  const onTheFire = () => {
    if (!dish.roast) return 0
    const served = servings(dish, orders[dish.id])
    const total = Object.entries(served).reduce((n, [id, q]) => n + (isSkewer(id) ? q : 0), 0)
    return total - offFire
  }

  const changeQty = (id: string, delta: number): boolean => {
    // a pot takes one soup and a bowl one serving of noodles: ordering another swaps it
    const isBase = dish.bases.some((b) => b.id === id)
    // what it sells for and what its ingredients cost (a set is priced as a whole)
    const priced = isBase ? dish.bases.find((b) => b.id === id)! : dish.items.find((i) => i.id === id)
    // (only paying customers bring money in; tasting with the shop closed only costs the ingredients)
    const sell = (n: number) => {
      if (!priced || !n) return
      if (ai) book('revenue', priced.price * n)
      book('food', costOf(priced) * n)
    }
    // what it uses up from stock: a set takes its parts, anything else one portion of itself
    const uses = (x: string): [string, number][] => {
      const b = dish.bases.find((bb) => bb.id === x)
      return b?.includes ? Object.entries(b.includes) : [[x, 1]]
    }
    const take = (x: string, n: number) => {
      const need = uses(x)
      if (n > 0) {
        const short = need.find(([k, q]) => (stock[k] ?? 0) < q * n)
        if (short) {
          const it = ALL_ITEMS.get(short[0]) ?? dish.bases.find((bb) => bb.id === short[0])
          if (!ai) say(UI[lang].outOfStock(it ? nameIn(lang, it) : short[0]))
          return false
        }
      }
      setStock((st) => {
        const next = { ...st }
        for (const [k, q] of need) next[k] = (next[k] ?? 0) - q * n
        return next
      })
      return true
    }
    if (isBase && dish.oneBase) {
      const had = dish.bases.find((b) => (orders[dish.id][b.id] ?? 0) > 0)
      if (delta > 0 && had?.id !== id && !take(id, 1)) return false
      if (had && had.id !== id && delta > 0) {
        if (ai) book('revenue', -had.price)
        book('food', -costOf(had))
        take(had.id, -1)
      }
      if (delta < 0 && had?.id === id) take(id, -1)
      if (delta > 0 ? had?.id !== id : had?.id === id) sell(delta > 0 ? 1 : -1)
      setOrders((all) => {
        const next = { ...all[dish.id] }
        for (const b of dish.bases) next[b.id] = 0
        next[id] = delta > 0 ? 1 : 0
        return { ...all, [dish.id]: next }
      })
      return true
    }
    // a set brings its own skewers, so check the fire's room for those too
    const adds = isBase ? dish.bases.find((b) => b.id === id)!.includes ?? {} : { [id]: 1 }
    const addsSkewers = Object.entries(adds).reduce((n, [k, q]) => n + (isSkewer(k) ? q : 0), 0)
    if (delta > 0 && addsSkewers && onTheFire() + addsSkewers > FIRE_CAPACITY) {
      say(UI[lang].fireFull(FIRE_CAPACITY))
      return false
    }
    // the bamboo basket only holds so many potatoes and sweet potatoes
    const basket = dish.roast?.basket
    const addsLoose = Object.entries(adds).reduce((n, [k, q]) => n + (dish.roast?.basketItems?.includes(k) ? q : 0), 0)
    if (delta > 0 && basket && addsLoose && loose + addsLoose > basket.capacity) {
      say(UI[lang].basketFull(basket.capacity))
      return false
    }
    // some things only fit so many at once
    const item = dish.items.find((i) => i.id === id)
    const max = item?.max ?? MAX_PORTIONS
    if (delta > 0 && (orders[dish.id][id] ?? 0) >= max) {
      say(UI[lang].itemFull(item ? nameIn(lang, item) : id, max))
      return false
    }
    if (delta < 0 && !(orders[dish.id][id] ?? 0)) return false
    if (!take(id, delta)) return false
    sell(delta)
    setOrders((all) => {
      const qty = Math.min(max, Math.max(0, (all[dish.id][id] ?? 0) + delta))
      return { ...all, [dish.id]: { ...all[dish.id], [id]: qty } }
    })
    return true
  }

  // ---- the hot pot shop and the noodle bar, while open (the grill runs its own, in Roasting) ----
  // A customer comes in while there's a stool free, orders, and waits. At the hot pot the chef lights the stove
  // and the customers fish their food out of the pot once it's cooked (PotCooking), each eating only what they
  // ordered; at the noodle bar the chef cooks one bowl at a time, sets it down in front of its customer, who
  // eats it and leaves. Kept waiting too long, a customer walks out.
  type ShopGuest = { id: number; orders: string[]; ate: string[]; eaten: number[]; since: number; state: GuestView['state'];
    base?: string
    /** (noodle bar) everything in what they ordered, and what it's called on the menu */
    parts?: string[]; label?: string; dishParts?: Part[] }
  // (each shop's own clock, in seconds of business: it only runs while the shop is open and on screen, so a customer
  // isn't kept waiting by the shop being closed or looked away from)
  const shop = useRef<Record<string, { guests: ShopGuest[]; seq: number; clock: number; time: number;
    kitchen: { guest: number; t: number; phase: 'cook' | 'eat' } | null }>>({})
  const shopOf = (id: string) => (shop.current[id] ??= { guests: [], seq: 0, clock: 0, time: 0, kitchen: null })
  const [potAi, setPotAi] = useState<string[]>([])
  const report = (dishId: string) => {
    const s = shopOf(dishId)
    setShopGuests(dishId, s.guests.map((g) => ({ id: g.id, state: g.state, items: g.orders.length, ate: [...g.ate],
      rating: g.eaten.length ? g.eaten.reduce((a, b) => a + b, 0) / g.eaten.length : null })))
  }
  const starsLine = (id: number, what: string, taste: number) => {
    const stars = taste >= 80 ? 5 : taste >= 65 ? 4 : taste >= 45 ? 3 : taste >= 25 ? 2 : 1
    // (the stars are kept, but customers show how they liked it in their faces and words, not a score)
    talk('guest', LINES[lang].verdict(id, what, stars))
  }
  const potGuestEat = (id: string, raw: number) => {
    // the back kitchen's prep and the floor staff's service count for something at the hot pot
    const taste = Math.max(5, Math.min(99, raw + ((chefOf('hotpot').skill ?? 0.6) - 0.7) * 20 + (staffOf('hotpot', 'server').length ? 2 : -8)))
    const s = shopOf('hotpot')
    const g = s.guests.find((x) => (x.state === 'waiting' || x.state === 'eating') &&
      x.orders.filter((o) => o === id).length > x.ate.filter((o) => o === id).length)
    if (!g) return
    g.ate.push(id)
    g.eaten.push(taste)
    g.state = g.ate.length >= g.orders.length ? 'done' : 'eating'
    const item = ALL_ITEMS.get(id)
    starsLine(g.id, item ? nameIn(lang, item) : id, taste)
    report('hotpot')
  }
  /** a customer walked out: take back the price of what they didn't eat */
  const refund = (ids: string[], d: DishInfo, guest?: number) => {
    // (what they paid for the menu's dishes, in proportion to what of it they didn't get)
    const bill = guest !== undefined ? bills.current[d.id]?.[guest] : undefined
    const total = bill ? Math.round((bill.paid * ids.length) / Math.max(1, bill.parts))
      : ids.reduce((n, id) => n + ((ALL_ITEMS.get(id) ?? d.bases.find((b) => b.id === id))?.price ?? 0), 0)
    if (total) book('revenue', -total)
  }
  /**
   * A customer orders a dish off the menu: its parts come out of stock, it's paid at the menu's price, its cost is
   * the food and the seasonings, and (except at the noodle bar, where the kitchen sets each bowl down) its food is
   * put out to be cooked. False if it can't be had now.
   */
  const orderEntry = (e: Entry, guest: number): boolean => {
    const d = DISHES.find((x) => x.id === e.shop)!
    const need = needOf(e)
    if (!canServe(e, stockRef.current)) return false
    if (d.roast) {
      const skewers = Object.entries(partsOf(e)).reduce((n, [k, q]) => n + (isSkewer(k) ? q : 0), 0)
      if (skewers && onTheFire() + skewers > FIRE_CAPACITY) return false
    }
    stockRef.current = { ...stockRef.current }
    for (const [k, q] of Object.entries(need)) stockRef.current[k] = (stockRef.current[k] ?? 0) - q
    setStock((st) => {
      const next = { ...st }
      for (const [k, q] of Object.entries(need)) next[k] = (next[k] ?? 0) - q
      return next
    })
    book('revenue', e.price)
    book('food', entryCost(e))
    // (the noodle bar's and the bakery's kitchens set each order out themselves)
    if (d.id !== 'beefnoodle' && d.id !== 'bakery') {
      setOrdersBy((b) => {
        const cur = { ...b.open[d.id] }
        for (const [k, q] of Object.entries(partsOf(e))) {
          if (d.oneBase && d.bases.some((bb) => bb.id === k)) {
            for (const bb of d.bases) cur[bb.id] = 0
            cur[k] = 1
          } else cur[k] = (cur[k] ?? 0) + q
        }
        return { ...b, open: { ...b.open, [d.id]: cur } }
      })
    }
    const bill = ((bills.current[d.id] ??= {})[guest] ??= { paid: 0, parts: 0 })
    bill.paid += e.price
    bill.parts += e.parts.length
    setEntryCount((c) => ({ ...c, [e.key]: (c[e.key] ?? 0) + 1 }))
    const key = ++feedSeq.current
    setFeed((fd) => [...fd.slice(-2), { key, id: e.key, guest }])
    talk('order', `#${guest} ${lang === 'ja' ? 'から' : '點了'} ${nameIn(lang, e)}`)
    window.setTimeout(() => setFeed((fd) => fd.filter((x) => x.key !== key)), 3200)
    return true
  }
  /** a customer helped themselves to a drink from the fridge: paid for at its price, a third of that its cost */
  const sellDrink = (guest: number, id: DrinkId) => {
    const d = DRINKS.find((x) => x.id === id)
    if (!d) return
    book('revenue', d.price)
    book('food', Math.round(d.price * 0.35))
    talk('order', `#${guest} ${lang === 'ja' ? 'が冷蔵庫から' : '從冰箱拿了'} ${lang === 'ja' ? d.ja : d.zh}`)
  }
  const sellDrinkRef = useRef(sellDrink)
  sellDrinkRef.current = sellDrink
  const onDrink = useCallback((guest: number, id: DrinkId) => sellDrinkRef.current(guest, id), [])
  const orderEntryRef = useRef(orderEntry)
  orderEntryRef.current = orderEntry
  const onOrderEntry = useCallback((key: string, guest: number) => {
    const e = Object.values(menuByRef.current).flat().find((x) => x.key === key)
    return !!e && orderEntryRef.current(e, guest)
  }, [])
  const potEatRef = useRef(potGuestEat)
  potEatRef.current = potGuestEat
  const onPotGuestEat = useCallback((id: string, taste: number) => potEatRef.current(id, taste), [])
  const simRef = useRef<() => void>(() => {})
  simRef.current = () => {
    if (!ai || !opened[DISHES[active].id]) return
    const d = DISHES[active]
    if (d.id !== 'hotpot' && d.id !== 'beefnoodle' && d.id !== 'bakery') return
    const s = shopOf(d.id)
    const cook = chefOf(d.id)
    s.time += 0.8
    const now = s.time
    const seated = s.guests.filter((g) => g.state === 'waiting' || g.state === 'eating')
    s.clock += 0.8
    // someone comes in
    // no cashier: nobody greets or takes the money, and fewer come in; floor staff bring them in faster
    const servers = staffOf(d.id, 'server').length
    const crowd = (staffOf(d.id, 'cashier').length ? 1 : 1.8) / (1 + servers * 0.15)
    if (seated.length < 4 && s.clock > ((d.id === 'beefnoodle' ? 14 : 8) + Math.random() * 6) * crowd) {
      s.clock = 0
      const id = ++s.seq
      const g: ShopGuest = { id, orders: [], ate: [], eaten: [], since: now, state: 'waiting' }
      const said: string[] = []
      if (d.id === 'hotpot') {
        // the first one in picks the soup; everyone orders a few things to cook in it
        // (off the menu: a soup on it, and the things to cook on it)
        const es = entriesOf(d.id)
        const isBase = (x: string) => d.bases.some((b) => b.id === x)
        const soups = es.filter((e) => e.parts.every((p) => isBase(p.id)) && canServe(e, stockRef.current))
        const foods = es.filter((e) => e.parts.some((p) => !isBase(p.id)))
        if (!orderedBase(d, orders[d.id])) {
          const e = soups[Math.floor(Math.random() * soups.length)]
          if (e && orderEntry(e, id)) said.push(nameIn(lang, e))
        }
        const want = 1 + Math.floor(Math.random() * 2)
        for (let k = 0; k < want; k++) {
          const e = foods[Math.floor(Math.random() * foods.length)]
          if (e && orderEntry(e, id)) {
            g.orders.push(...e.parts.filter((p) => !isBase(p.id)).map((p) => p.id))
            said.push(nameIn(lang, e))
          }
        }
      } else {
        // a bowl of noodles each, paid for now and cooked in turn
        // a bowl of noodles, or one of the other dishes (fried rice, dumplings, soup…) off the table
        // (a dish off the menu: a bowl, a plate off the table, or a set of them)
        const inStock = entriesOf(d.id).filter((e) => canServe(e, stockRef.current))
        const e = inStock[Math.floor(Math.random() * inStock.length)]
        if (e && orderEntry(e, id)) {
          g.parts = e.parts.map((p) => p.id)
          g.dishParts = e.parts
          g.base = g.parts[0]
          g.label = nameIn(lang, e)
          g.orders.push(...g.parts)
          said.push(g.label)
        }
      }
      if (g.orders.length) {
        s.guests.push(g)
        // (only those still here and the last few gone are kept: the list doesn't grow all day)
        s.guests = s.guests.filter((x, i, all) => x.state === 'waiting' || x.state === 'eating' || i >= all.length - 12)
        talk('guest', LINES[lang].order(id, said))
      }
      report(d.id)
    }
    // kept waiting too long with nothing to eat
    for (const g of seated) {
      if (g.eaten.length === 0 && now - g.since > (d.id === 'hotpot' ? 300 : 150) * (0.8 + servers * 0.2) && !(s.kitchen && s.kitchen.guest === g.id)) {
        g.state = 'angry'
        // they don't pay for what they didn't get (the ingredients are wasted)
        const owed = [...g.orders]
        for (const a of g.ate) owed.splice(owed.indexOf(a), 1)
        refund(owed, d, g.id)
        talk('guest', LINES[lang].angry(g.id))
        report(d.id)
      }
    }
    if (d.id === 'hotpot') {
      // the chef keeps the soup on the boil while anyone's eating, and turns the gas off when the shop's quiet
      const busy = s.guests.some((g) => g.state === 'waiting' || g.state === 'eating')
      // (only a hired hand minds the stove for you; on your own, the stove is yours to work)
      const minded = staffOf('hotpot', 'chef').length + staffOf('hotpot', 'sous').length > 0
      if (!minded) {
        // nothing
      } else if (busy && heatRef.current < 70) {
        setHeat(80)
        talk('chef', LINES[lang].lightPot)
      } else if (minded && !busy && heatRef.current > 0) {
        setHeat(0)
      }
      const owed: string[] = []
      for (const g of s.guests) {
        if (g.state !== 'waiting' && g.state !== 'eating') continue
        const left = [...g.orders]
        for (const a of g.ate) left.splice(left.indexOf(a), 1)
        owed.push(...left)
      }
      setPotAi((p) => (p.join() === owed.join() ? p : owed))
    } else {
      // the noodle bar: one bowl at a time, cooked, served, eaten
      const k = s.kitchen
      if (!k) {
        const next = s.guests.find((g) => g.state === 'waiting')
        if (next) {
          s.kitchen = { guest: next.id, t: 0, phase: 'cook' }
          setOrders((all) => ({ ...all, [d.id]: {} }))
          talk('chef', d.bake ? LINES[lang].bakeIn(next.id) : LINES[lang].noodlesIn(next.id))
        }
      } else {
        k.t += 0.8
        const g = s.guests.find((x) => x.id === k.guest)!
        if (k.phase === 'cook' && k.t > (12 * cook.pace) / Math.max(1, cook.cooks ?? 1) ** 0.6) {
          // the bowl goes in front of its customer
          k.phase = 'eat'
          k.t = 0
          // (all of what they ordered goes in front of them)
          const all = g.parts ?? [g.base!]
          setOrders((o) => ({ ...o, [d.id]: Object.fromEntries(all.map((p) => [p, all.filter((x) => x === p).length])) }))
          g.state = 'eating'
          talk('chef', (d.bake ? LINES[lang].bakeUp : LINES[lang].noodlesUp)(g.id, g.label ?? nameIn(lang, ([...d.bases, ...d.items] as { id: string; name: string }[]).find((b) => b.id === g.base)!)))
          report(d.id)
        } else if (k.phase === 'eat' && k.t > 12) {
          // a better (and less tired) cook makes a better bowl; a server bringing it hot helps too
          const bonus = ((cook.skill ?? 0.6) - 0.7) * 45 + (staffOf(d.id, 'server').length ? 3 : -3)
          const taste = Math.max(10, Math.min(98, 70 + bonus + (Math.random() - 0.5) * 16))
          g.eaten.push(taste)
          g.ate.push(...(g.parts ?? [g.base!]))
          g.state = 'done'
          starsLine(g.id, g.label ?? nameIn(lang, ([...d.bases, ...d.items] as { id: string; name: string }[]).find((b) => b.id === g.base)!), taste)
          s.kitchen = null
          setOrders((all) => ({ ...all, [d.id]: {} }))
          report(d.id)
        }
      }
    }
  }
  useEffect(() => {
    // (at ×2, twice each tick)
    const id = window.setInterval(() => { for (let i = 0; i < GAME_SPEED.value; i++) simRef.current() }, 800)
    return () => window.clearInterval(id)
  }, [])
  // the shop shutting: the hot pot's stove goes off
  useEffect(() => {
    if (!ai) setPotAi([])
  }, [ai])


  return (
    <div className={`app${menuFolded || (owner !== null && !opened[dish.id]) ? ' menu-folded' : ''}${toolsOpen ? ' tools-open' : ''}${ai ? ' is-open-shop' : ''}${owner !== null && !opened[dish.id] ? ' is-unopened' : ''}${!opened[dish.id] ? ' is-hushed' : ''}${spotOn && !opened[dish.id] ? ' is-spotlit' : ''}${flatGrill ? ' is-flatgrill' : ''}${editOn ? ' is-editing' : ''}`} ref={appRef}>
      {/* the 3D view fills the whole window behind the stage and the menu, so nothing is cut off at the menu's
          edge; the camera is offset so the dish still sits in the middle of the stage */}
      {glLost && (
        <div className="crash is-inline" role="alert">
          <b>3D 畫面中斷了</b>
          <p>手機的顯示記憶體不足，瀏覽器把 3D 畫面關掉了。可以先關掉其他分頁或 App 再重新載入。</p>
          <button type="button" onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}>重新載入</button>
        </div>
      )}
      {NO_WEBGL && (
        <div className="crash is-inline" role="alert">
          <b>這個瀏覽器現在打不開 3D 畫面</b>
          <p>多半是先前手機記憶體不足、3D 當掉過幾次，瀏覽器就暫時停用了這個網站的 3D。請把 Chrome（或這個 App）完全關掉再打開；不行的話重開手機，或改用右上角「在 Chrome 中開啟」。菜單一樣可以點。</p>
          <code>{webglReport()}</code>
          <button type="button" onClick={() => window.location.replace(window.location.pathname + '?v=' + Date.now())}>重新載入</button>
        </div>
      )}
      <div className="canvas-layer" style={glLost || NO_WEBGL ? { visibility: 'hidden' } : undefined}
>
        <Crash inline>
        {/* (a phone at the grill draws it all flat, in 2D: no 3D view at all) */}
        {!NO_WEBGL && !flatGrill && <Canvas
          shadows={QUALITY.shadows ? 'percentage' : false}
          // phones get a lighter canvas (their screens are sharp enough, and the GPU memory is tight)
          dpr={[1, QUALITY.dpr]}
          onCreated={({ gl, camera, scene }) => {
            // (in development, the renderer's counts are to hand for checking how heavy a view is)
            if (import.meta.env.DEV) Object.assign(window, { __gl: gl, __cam: camera, __scene: scene })
            // if the phone runs out of GPU memory the browser drops the 3D view and it would stay blank:
            // reload once to bring it back
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              stepDown()                 // (and start lighter next time)
              setGlLost(true)
            })
            gl.domElement.addEventListener('webglcontextrestored', () => setGlLost(false))
          }}
          camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
          gl={makeRenderer}
        >
          <FramePacer />
          <FpsMeter />
          <Scene active={active} orders={orders} theme={theme} reducedMotion={reducedMotion}
            heat={heat} fire={fire} frame={frame} onOffFire={sceneOffFire}
            onEat={onEat} onNotice={sceneNotice}
            resetView={resetView} overview={overview} ai={ai} research={research} onOrder={sceneOrder} onAddCharcoal={addCharcoal} onSay={talk}
            lang={lang} notes={notes} spotOn={spotOn && !opened[dish.id]} chefOf={chefOf} crowdOf={(id) => (staffOf(id, 'cashier').length ? 1 : 1.8) * (blessed ? 0.65 : 1)} blessed={blessed}
            incense={{ litAt: incenseAt, onLight: lightIncense }} onDrink={onDrink} onWalkOut={refund} entriesOf={entriesOf} onOrderEntry={onOrderEntry}
            guestsBy={guestsBy} speech={speech}
            crewOf={(id) => staffOf(id).map((w) => ({ id: w.id, role: w.role, look: w.look }))} onGuests={setShopGuests} potAi={potAi} onPotGuestEat={onPotGuestEat}
            bakeKitchen={(() => {
              const k = ai ? shop.current.bakery?.kitchen : null
              const g = k ? shop.current.bakery.guests.find((x) => x.id === k.guest) : undefined
              return k && g?.dishParts ? { phase: k.phase, parts: g.dishParts } : null
            })()}
            phone={phone} noodleWok={(() => {
              const k = ai ? shop.current.beefnoodle?.kitchen : null
              const g = k && k.phase === 'cook' ? shop.current.beefnoodle.guests.find((x) => x.id === k.guest) : undefined
              return !!g?.base && WOK_KINDS.includes(ALL_ITEMS.get(g.base)?.table as TableKind)
            })()} inUse={DISHES.map((d) => d.id).filter((id) => [ordersBy.closed[id], ordersBy.open[id]].some((o) => Object.values(o ?? {}).some((n) => n > 0)))} />
        </Canvas>}
        </Crash>
      </div>
      <div className="stage" ref={stageRef}>
        {flatGrill && dish.roast && (
          <Grill2D roast={dish.roast} itemIds={ITEM_IDS[dish.id]} quantities={servings(dish, orders[dish.id])} active fire={fire}
            onOffFire={sceneOffFire} onEat={onEat} onNotice={sceneNotice} ai={ai} research={research} onOrder={sceneOrder} onAddCharcoal={addCharcoal}
            onSay={talk} chef={chefOf(dish.id)} onGuests={(g) => setShopGuests(dish.id, g)}
            crowd={(staffOf(dish.id, 'cashier').length ? 1 : 1.8) * (blessed ? 0.65 : 1)} blessed={blessed} onDrink={onDrink}
            onWalkOut={(ids, g) => refund(ids, dish, g)} lang={lang} entries={ai ? entriesOf(dish.id) : undefined} onOrderEntry={onOrderEntry}
            names={Object.fromEntries(dish.items.map((x) => [x.id, nameIn(lang, x)]))} space={ai ? 'open' : 'closed'}
            notes={Object.fromEntries(Object.entries(notes).map(([k, n]) => [k, bestOf(n)]))}
            top={ai ? <GuestCounter guests={guests} shop={dish.id} lang={lang} staff={{ chef: staffOf(dish.id, 'chef').length,
              cashier: staffOf(dish.id, 'cashier').length, server: staffOf(dish.id, 'server').length }} /> : undefined} />
        )}
        <Brand night={theme === 'dark'} lang={lang} shop={dish.id} dark={!opened[dish.id]} ignite={ignite}
 />
        {dish.heatControl && <HeatControl heat={heat} onChange={setHeat} lang={lang} />}
        {dish.heat === 'fire' && <FireControl level={fireLevel} onAdd={addCharcoal} lang={lang} />}
        {/* (how full you are is about tasting with the shop shut: open, the customers do the eating) */}
        {!ai && <Fullness kcal={kcal} full={FULL_KCAL} lang={lang} rating={rating.n ? rating.sum / rating.n : null} lastTry={lastTry} />}
        <button type="button" className="office-toggle" onClick={() => setOffice((o) => (o ? null : 'book'))} aria-expanded={!!office}
          title={lang === 'ja' ? '開発ノート・人事' : '經營（廚房・人事）'}>
          <svg className="office-icon" viewBox="0 0 28 28" aria-hidden="true">
            {/* the shop front: a tiled eave, a noren split in three with the shop's mark, a lantern at the side */}
            <path d="M3 10.5 14 4l11 6.5z" fill="#3b2a20" />
            <path d="M4.5 10.5h19" stroke="#c79a5a" strokeWidth="1.2" />
            <rect x="5.5" y="11" width="17" height="13" rx="1" fill="#efe2c8" stroke="#3b2a20" strokeWidth="1.1" />
            <path d="M6.5 11.6h15v6.4c-1.3.6-2.6.6-3.75 0-1.3.6-2.6.6-3.75 0-1.3.6-2.6.6-3.75 0-1.3.6-2.6.6-3.75 0z" fill="#c4442f" />
            <path d="M10.25 11.6v6.6M14 11.6v6.6M17.75 11.6v6.6" stroke="#8f2a20" strokeWidth=".7" />
            <circle cx="14" cy="14.4" r="1.6" fill="none" stroke="#fbf3e4" strokeWidth=".9" />
            <rect x="11.5" y="19.5" width="5" height="4.5" fill="#5a3a26" />
            <ellipse cx="24.6" cy="15" rx="1.6" ry="2.2" fill="#f2b84b" stroke="#3b2a20" strokeWidth=".7" />
          </svg><em>{lang === 'ja' ? '経営' : '經營'}</em><b className="money">NT${Math.round(cash).toLocaleString()}</b>
        </button>
        <button type="button" className={`auto-toggle${auto ? ' is-on' : ''}`} aria-pressed={auto} title={UI[lang].autoLabel}
          onClick={() => {
            setAuto((v) => !v)
            say(auto ? UI[lang].autoOff : UI[lang].autoOn)
          }}>
          <span className="auto-lamp" aria-hidden="true" />{UI[lang].auto}
        </button>
        {office && (
          <Office dish={dish} lang={lang} cash={cash} owner={owner ?? ''} onClose={() => setOffice(null)}
            tab={office} onTab={setOffice}
            fridge={(
              <Fridge dish={dish} lang={lang} cash={cash} stock={stock}
                unitCost={(id) => costOf(ALL_ITEMS.get(id) ?? dish.bases.find((b) => b.id === id) ?? { price: 0 })}
                onBuy={(id, n) => buyIn(dish, id, n)} onBuyAll={(n) => buyAll(dish, n)} onTopUp={() => topUp(dish)}
                topUpCost={topUpOrder(dish, stock).cost} />
            )}
            book={(
              <Notebook dish={dish} lang={lang} notes={notes} entries={entriesOf(dish.id)}
                partCost={(p) => partCost(dish, p)}
                chef={(() => { const c = staffOf(dish.id, 'chef')[0]; return c ? (lang === 'ja' ? c.ja : c.zh) : null })()}
                talk={talkBy[dish.id] ?? []} onTalk={(text) => chefChat(dish, text)}
                onPublish={(e) => setMenuBy((m) => {
                  const cur = m[e.shop] ?? []
                  if (cur.length >= MENU_MAX || cur.some((x) => x.key === e.key)) return m
                  return { ...m, [e.shop]: [...cur, e] }
                })}
                onUnpublish={(key) => setMenuBy((m) => ({ ...m, [dish.id]: (m[dish.id] ?? []).filter((x) => x.key !== key) }))}
                onReprice={(key, price) => setMenuBy((m) => ({ ...m, [dish.id]: (m[dish.id] ?? []).map((x) => (x.key === key ? { ...x, price } : x)) }))} />
            )}
            onReset={() => {
              if (!window.confirm(lang === 'ja' ? '資金・在庫・スタッフ・ノートを全部リセットしますか？' : '確定要重新開始？資金、庫存、員工和試吃筆記都會清空。')) return
              try {
                localStorage.removeItem(SAVE_KEY)
              } catch {
                // storage blocked
              }
              saveRef.current = { ledger: { revenue: 0, food: 0, fuel: 0, wage: 0, bought: 0, offering: 0 }, stock: {}, hired: {}, notes: {}, owner: null, opened: {} }
              window.location.replace(window.location.pathname + '?v=' + Date.now())
            }}
            hired={hired[dish.id] ?? {}}
            onHire={(w) => setHired((h) => ({ ...h, [dish.id]: { ...(h[dish.id] ?? {}), [w.id]: { fatigue: 0 } } }))}
            onFire={(w) => setHired((h) => {
              const mine = { ...(h[dish.id] ?? {}) }
              delete mine[w.id]
              return { ...h, [dish.id]: mine }
            })} />
        )}
        <div className={`side-boards${boardsOpen ? ' is-open' : ''}`}>
          {/* on a phone the boards fold into one line at the top: tap it to open them */}
          {(ai || ledgerOn) && (
            <button type="button" className="boards-chip" onClick={() => setBoardsOpen((o) => !o)} aria-expanded={boardsOpen}>
              {ai && (() => {
                const here = guests.filter((g) => g.state === 'waiting' || g.state === 'eating')
                const rated = guests.filter((g) => g.rating !== null)
                const avg = rated.length ? rated.reduce((n, g) => n + (g.rating ?? 0), 0) / rated.length : null
                return (
                  <span className="chip-part">
                    {avg !== null && <MoodFace guest={{ id: 0, state: 'done', rating: avg, items: 0, ate: [] }} />}
                    {lang === 'ja' ? '客' : '客'} {here.length}/{visits}
                  </span>
                )
              })()}
              {ledgerOn && (() => {
                const profit = ledger.revenue - ledger.food - ledger.fuel - ledger.wage
                return <span className={`chip-part chip-profit${profit < 0 ? ' is-loss' : ''}`}>{UI[lang].profit} {profit < 0 ? '−' : ''}{Math.abs(profit).toFixed(0)}</span>
              })()}
              <span className="chip-caret">{boardsOpen ? '▲' : '▼'}</span>
            </button>
          )}
          {ai && (
            <section className="guest-board is-draggable" aria-label={UI[lang].guests(0, 0)} style={dragBoard.style}
              onPointerDown={dragBoard.onPointerDown} onDoubleClick={dragBoard.onDoubleClick}>
              <div className="chef-pick">
                <span>{UI[lang].chefPick}</span>
                <b>{[owner || (lang === 'ja' ? '店主' : '老闆'), ...staffOf(DISHES[active].id, 'chef'), ...staffOf(DISHES[active].id, 'sous')].map((w) => (typeof w === 'string' ? w : lang === 'ja' ? w.ja : w.zh)).filter(Boolean).join('、')}</b>
                <button type="button" onClick={() => setOffice('staff')}>{lang === 'ja' ? '人事' : '人事'}</button>
              </div>
              <p className="guest-count">
                {UI[lang].guests(visits, guests.filter((g) => g.state === 'waiting' || g.state === 'eating').length)}
              </p>
              {/* (on a computer the customers sit at the bar in 3D; a phone shows them here, in the 2D bar, which
                  stays sharp and clear of the rest on a small screen) */}
              {phone && !flatGrill && (
                <GuestCounter guests={guests} shop={DISHES[active].id} lang={lang} staff={{ chef: staffOf(DISHES[active].id, 'chef').length,
                  cashier: staffOf(DISHES[active].id, 'cashier').length, server: staffOf(DISHES[active].id, 'server').length }} />
              )}
              <ul className="guest-list">
                {guests.slice(-4).reverse().map((g) => {
                  return (
                    <li key={g.id} className={`guest-row is-${g.state}`}>
                      <span className="guest-id">{guestLabel(g.id, lang)}</span>
                      <MoodFace guest={g} />
                      {g.state === 'angry' ? <span className="guest-note">{UI[lang].leftAngry}</span>
                        : g.rating === null ? <span className="guest-note">{UI[lang].waiting}</span>
                          : <span className="guest-note">{UI[lang].moods[moodOf(g.rating)]}{g.state === 'eating' && <em>{UI[lang].eating}</em>}</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {ledgerOn && (
            <section className="ledger is-draggable" aria-label={UI[lang].ledgerLabel} style={dragLedger.style}
              onPointerDown={dragLedger.onPointerDown} onDoubleClick={dragLedger.onDoubleClick}>
              <p className="ledger-cash"><span>{lang === 'ja' ? '現金' : '現金'}</span><b className="money">NT${Math.round(cash).toLocaleString()}</b></p>
              <p><span>{lang === 'ja' ? '開業費' : '開業費用'}</span><b className="money">−{Math.round(ledger.setup ?? 0).toLocaleString()}</b></p>
              <p><span>{lang === 'ja' ? '仕入れ' : '採買支出'}</span><b className="money">−{Math.round(ledger.bought).toLocaleString()}</b></p>
              <p><span>{lang === 'ja' ? 'お供え' : '供品費用'}</span><b className="money">−{Math.round(ledger.offering ?? 0).toLocaleString()}</b></p>
              {([['revenue', ledger.revenue], ['foodCost', -ledger.food], ['fuel', -ledger.fuel], ['wage', -ledger.wage]] as const)
                .map(([k, v]) => (
                  <p key={k}><span>{UI[lang][k]}</span><b className="money">{v < 0 ? '−' : ''}{Math.abs(v).toFixed(k === 'revenue' || k === 'foodCost' ? 0 : 1)}</b></p>
                ))}
              {(() => {
                const profit = ledger.revenue - ledger.food - ledger.fuel - ledger.wage
                return (
                  <>
                    <p className={`ledger-profit${profit < 0 ? ' is-loss' : ''}`}><span>{UI[lang].profit}</span>
                      <b className={profit < 0 ? '' : 'money'}>{profit < 0 ? '−' : ''}NT${Math.abs(profit).toFixed(0)}</b></p>
                    <p className="ledger-margin"><span>{UI[lang].margin}</span>
                      <b>{ledger.revenue > 0 ? `${((profit / ledger.revenue) * 100).toFixed(1)}%` : '—'}</b></p>
                  </>
                )
              })()}
            </section>
          )}
        </div>
        {ai && chat.length > 0 && (
          <ul className="ai-chat is-draggable" aria-live="polite" style={{ ...dragChat.style, pointerEvents: 'auto' }}
            onPointerDown={dragChat.onPointerDown} onDoubleClick={dragChat.onDoubleClick}>
            {chat.map((m) => (
              <li key={m.id} className={`ai-line ai-${m.who}`}>
                <span className="ai-who">{m.who === 'chef' ? UI[lang].chef : m.who === 'stock' ? UI[lang].stock : m.who === 'order' ? (lang === 'ja' ? '注文' : '點單')
                  : UI[lang].guest}</span>{m.text}
              </li>
            ))}
          </ul>
        )}
        <DishSwitcher dishes={DISHES} index={active} onChange={setActive} lang={lang} />
        <button type="button" className="view-reset" onClick={() => { setOverview((v) => !v); setResetView((n) => n + 1) }}
          aria-label={UI[lang].resetView} title={UI[lang].resetView}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3.2" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
        </button>
        {owner !== null && !opened[dish.id] && (
          // not open yet: the whole shop is greyed out (see .is-unopened) until its sign is clicked and paid for
          <button type="button" className="unopened-hint" onClick={() => setAsking(true)}
            onPointerEnter={() => setSpotOn(true)} onPointerLeave={() => setSpotOn(false)}
            onFocus={() => setSpotOn(true)} onBlur={() => setSpotOn(false)}>
            <b>{lang === 'ja' ? '開業する' : '開業'}</b>
            <small>{lang === 'ja' ? `「${nameIn(lang, dish)}」・NT$${SHOP_COST.toLocaleString()}` : `「${nameIn(lang, dish)}」・NT$${SHOP_COST.toLocaleString()}`}</small>
          </button>
        )}
        <p className={`notice${notice ? ' is-shown' : ''}`} role="status" aria-live="polite">{notice}</p>
        {pull > 0 && (
          <div className={`pull-refresh${pull >= 1 ? ' is-ready' : ''}`} style={{ '--pull': pull } as React.CSSProperties}>
            <span>↻</span>{pull >= 1 ? UI[lang].pullGo : UI[lang].pullMore}
          </div>
        )}
      </div>
      {owner === null && (
        <Welcome lang={lang} capital={CAPITAL} shopCost={SHOP_COST} onStart={(name) => {
          setOwner(name)
          saveRef.current = { ...saveRef.current, owner: name }
          try {
            void saveRef.current
          } catch {
            // storage blocked
          }
        }} />
      )}
      {asking && (
        <div className="welcome" role="dialog" aria-modal="true">
          <div className="welcome-card">
            <h2>{lang === 'ja' ? '開業しますか？' : '要開業嗎？'}</h2>
            <p>{lang === 'ja' ? `「${nameIn(lang, dish)}」の開業費は NT$${SHOP_COST.toLocaleString()}` : `開一間「${nameIn(lang, dish)}」需要 NT$${SHOP_COST.toLocaleString()}`}</p>
            <p className="welcome-sub">{lang === 'ja' ? `手持ち NT$${Math.round(cash).toLocaleString()}` : `手上現金 NT$${Math.round(cash).toLocaleString()}`}</p>
            {cash < SHOP_COST && <p className="welcome-warn">{lang === 'ja' ? '資金が足りません' : '資金不足，還開不了'}</p>}
            <button type="button" className="welcome-go" disabled={cash < SHOP_COST} onClick={() => {
              book('setup', SHOP_COST)
              setOpened((o) => ({ ...o, [dish.id]: true }))
              setAsking(false)
              setIgnite((n) => n + 1)
              window.setTimeout(() => setIgnite(0), 3200)
              // first thing a new shop needs: stock, bought in right on the board
              window.setTimeout(() => say(UI[lang].buyOnBoard), 900)
            }}>{lang === 'ja' ? '開業' : '開業'}</button>
            <button type="button" className="welcome-back" onClick={() => setAsking(false)}>{lang === 'ja' ? 'やめる' : '先不要'}</button>
          </div>
        </div>
      )}
      <div className="menu-backing" aria-hidden="true" />
      <Menu key={dish.id + (hand ? '' : '-menu')} dish={hand ? researchDish(dish) : menuDish(dish)} research={hand}
        layoutLike={!hand ? { tags: researchDish(dish).bases.length + researchDish(dish).items.length, bases: researchDish(dish).bases.length } : undefined}
        cash={cash} unitCost={(id) => costOf(ALL_ITEMS.get(id) ?? dish.bases.find((b) => b.id === id) ?? { price: 0 })} days={days}
        onBuy={!hand ? undefined : (id, n) => buyIn(dish, id, n)} onBuyAll={!hand ? undefined : (n) => buyAll(dish, n)} onTopUp={!hand ? undefined : () => topUp(dish)} topUpCost={topUpOrder(dish, stock).cost}
         lang={lang} quantities={hand ? orders[dish.id] : entryCount}
        feed={feed} locked={!hand} stock={hand ? stock : entryStock(dish)}
        onAdd={(id) => changeQty(id, 1)} onRemove={(id) => changeQty(id, -1)}
        onClear={() => {
          // cancelling everything refunds it (nothing was made)
          for (const x of [...dish.bases, ...dish.items]) {
            const n = orders[dish.id][x.id] ?? 0
            if (!n) continue
            if (ai) book('revenue', -x.price * n)
            book('food', -costOf(x) * n)
            const parts = (x as { includes?: Record<string, number> }).includes ?? { [x.id]: 1 }
            setStock((st) => {
              const next = { ...st }
              for (const [k, q] of Object.entries(parts)) next[k] = (next[k] ?? 0) + q * n
              return next
            })
          }
          setOrders((all) => ({ ...all, [dish.id]: {} }))
        }} />
      <button type="button" className="menu-fold" onClick={() => setMenuFolded((f) => !f)} disabled={!!(owner !== null && !opened[dish.id])}
        aria-expanded={!menuFolded} aria-label={menuFolded ? UI[lang].showMenu : UI[lang].hideMenu}>
        <span>{menuFolded ? '‹' : '›'}</span>
      </button>
      <button type="button" className="tools-toggle" onClick={() => setToolsOpen((o) => !o)} aria-expanded={toolsOpen}
        aria-label={UI[lang].tools}>{toolsOpen ? '×' : '☰'}</button>
      <button type="button" className={`ledger-toggle${ledgerOn ? ' is-on' : ''}`} onClick={() => setLedgerOn((v) => !v)}
        aria-pressed={ledgerOn} title={UI[lang].ledgerLabel}>{UI[lang].ledger}</button>
      <button type="button" className={`ai-toggle${ai ? ' is-on' : ''}`} onClick={() => {
        // (opening with nothing a customer could order would only shut again at once: say what's missing instead)
        if (!ai && entriesOf(dish.id).length < (MENU_MIN[dish.id] ?? 1)) {
          say(UI[lang].menuShort(entriesOf(dish.id).length, MENU_MIN[dish.id] ?? 1))
          setOffice('book')
          return
        }
        if (!ai && !sellable(dish)) {
          say(UI[lang].cantOpen)
          return
        }
        // (at the grill the owner is the head chef: with no cooks hired, it's all theirs to do)
        if (!ai && dish.roast && !staffOf(dish.id, 'chef').length && !staffOf(dish.id, 'sous').length) say(UI[lang].ownerCooks)
        if (leaving) return
        if (!ai) setAi(true)
        else if (closing) setClosing(false)
        else {
          // (shutting up: no more customers come in, those here finish, and then the staff go out the back)
          setAuto(false)
          setClosing(true)
        }
      }}
        aria-pressed={ai} title={UI[lang].aiLabel}>
        {ai ? (closing ? (lang === 'ja' ? '閉店準備中' : '準備閉店') : UI[lang].shopOpen) : UI[lang].shopClosed}
      </button>
      <button type="button" className="lang-toggle" onClick={toggleLang} aria-label={UI[lang].langLabel}>
        {UI[lang].lang}
      </button>
      {/* (on a phone there's no 3D room and no shrine to click: the sake is offered from here) */}
      {phone && ai && !!dish.roast && (
        <button type="button" className={`incense-toggle${blessed ? ' is-on' : ''}`} onClick={lightIncense} disabled={blessed}
          title={lang === 'ja' ? 'お神酒を供える（NT$1,000、三分間、客足とご注文が増える）' : '供清酒（花 NT$1,000，三分鐘內客人變多、點得也多）'}>
          {blessed ? (lang === 'ja' ? 'お供え中' : '供酒中') : (lang === 'ja' ? 'お神酒' : '供酒')}
        </button>
      )}
      {/* (研製料理: only while the shop's shut: the view is held at camera 1 and the kitchen's worked by hand; the shop opening ends it) */}
      {!ai && !!dish.roast && !editOn && (
        <button type="button" className={`research-toggle${research ? ' is-on' : ''}`} onClick={() => setResearch((v) => !v)} aria-pressed={research}
          title={lang === 'ja' ? '研究モード（手で焼いて試す・食材の冷蔵庫・固定カメラ）' : '研製料理模式（手動烤魚與調味、食材冷藏櫃、固定視角）'}>
          研
        </button>
      )}
      {/* (the shop's edit mode, key G: only while it's shut, as it can't be switched on while customers are about) */}
      {!ai && !!dish.roast && !flatGrill && (
        <button type="button" className={`edit-toggle${editOn ? ' is-on' : ''}`} onClick={toggleEdit} aria-pressed={editOn}
          title={lang === 'ja' ? '配置を編集（Gキー）' : '編輯店內擺設（快捷鍵 G）'}>
          編
        </button>
      )}
      <button type="button" className={`speed-toggle${speed > 1 ? ' is-on' : ''}`} onClick={() => setSpeed((v) => (v > 1 ? 1 : 2))}
        aria-pressed={speed > 1} title={lang === 'ja' ? '早送り ×2' : '快速 ×2'}>
        {speed > 1 ? '×2' : '▶▶'}
      </button>
      <button type="button" className="theme-toggle" onClick={toggleTheme}
        aria-label={theme === 'light' ? '切換成深色模式' : '切換成淺色模式'}>
        {theme === 'light' ? '夜' : '晝'}
      </button>
      <Bgm />
      <Loader />
    </div>
  )
}

// (a phone loads each dish when it's switched to, to keep memory down)
for (const d of QUALITY.allDishes ? DISHES.filter((x) => !x.procedural) : []) {
  useGLTF.preload(QUALITY.lite ? liteUrl(d.model) : d.model)
  for (const b of d.bases) if (b.broth) useTexture.preload(b.broth)
}
