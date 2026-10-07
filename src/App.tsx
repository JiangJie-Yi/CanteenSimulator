import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Loader, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { nameIn, UI, type Lang } from './i18n'
import { boilAmount, ROOM_TEMP, stepTemp, steamAmount } from './boil'
import { Bubbles } from './components/Bubbles'
import { Brand } from './components/Brand'
import { Dish } from './components/Dish'
import { DishSwitcher } from './components/DishSwitcher'
import { Fire } from './components/Fire'
import { GasFlame } from './components/GasFlame'
import { FireControl } from './components/FireControl'
import { Fullness } from './components/Fullness'
import { HeatControl } from './components/HeatControl'
import { Menu } from './components/Menu'
import { Roasting } from './components/Roasting'
import { Steam } from './components/Steam'
import { StoveControls } from './components/StoveControls'
import { DISHES, type Dish as DishInfo } from './menu'

// distance between dishes on the carousel
const SPACING = 6
/** most items that fit around the charcoal at once */
const FIRE_CAPACITY = 16
/** the charcoal burns down from full to out in 90 minutes (the fire level is stepped every 200ms) */
const FIRE_BURN_PER_TICK = 1 / (90 * 60 * 5)
// burner top on the cassette stove (blender/hotpot.py)
const BURNER_Y = 0.38
// the one camera pose every dish is framed from (blender/open_live.py matches Blender's camera to it)
// low enough (~19° above the dish) that the burner flames show under the hot pot's rim
const CAMERA_POSITION: [number, number, number] = [2.9, 2.2, 4.0]
const CAMERA_FOV = 40

const ITEM_IDS = Object.fromEntries(DISHES.map((d) => [d.id, d.items.map((it) => it.id)]))
/** every menu item by id (for its calories when it's eaten) */
const ALL_ITEMS = new Map(DISHES.flatMap((d) => d.items.map((it) => [it.id, it] as const)))
/** a comfortably full adult meal, and how fast it settles */
const FULL_KCAL = 1500
const DIGEST_KCAL_PER_SEC = 1.2
const FLOAT_IDS = Object.fromEntries(
  DISHES.map((d) => [d.id, d.items.filter((it) => it.entrance === 'float').map((it) => it.id)]),
)

type Theme = 'light' | 'dark'

const LIGHTING: Record<Theme, { sun: string; sunIntensity: number; sky: string; ground: string; hemi: number;
  spot: number; fire: number; shadow: string; shadowOpacity: number }> = {
  // golden-hour sun and a cool sky fill
  light: { sun: '#ffe7c2', sunIntensity: 1.8, sky: '#cfe0ff', ground: '#7a6450', hemi: 1.0, spot: 18, fire: 2,
    shadow: '#3a4a5c', shadowOpacity: 0.3 },
  // moonlight; the warm spot, fire and burners carry the scene
  dark: { sun: '#a9bcff', sunIntensity: 0.6, sky: '#34405e', ground: '#1d1712', hemi: 0.7, spot: 30, fire: 4,
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
  aspect >= 1.3 ? 1 : Math.min(3.4, (1.3 / aspect) * (aspect < 1 ? 1.15 : 1))

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

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('canteen-theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      // storage unavailable: fall back to the system preference
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('canteen-theme', theme)
    } catch {
      // not persisted; the toggle still works for this visit
    }
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

type SceneProps = {
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
  onEat: (id: string) => void
  /** bumped by the 視角 button: glide back to the home view */
  resetView: number
  onNotice: (what: 'notCooked' | 'burnt' | 'waste') => void
}

function Scene({ active, orders, theme, reducedMotion, heat, fire, frame, onOffFire, onEat, onNotice, resetView }: SceneProps) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
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
  // smoke off the grill: only once food on it is cooking through (Roasting sets it)
  const grillSmoke = useRef(0)
  const grillBlackSmoke = useRef(0)
  const steamLevel = useRef(0)
  const boilLevel = useRef(0)
  useFrame((_, delta) => {
    brothTemp.current = hasSoup ? stepTemp(brothTemp.current, heat, Math.min(delta, 0.1)) : ROOM_TEMP
    steamLevel.current = steamAmount(brothTemp.current, heat)
    boilLevel.current = boilAmount(brothTemp.current, heat)
  })
  const dishLight = DISHES[active].light ?? {}

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
  useEffect(() => {
    const focus = new THREE.Vector3(0, DISHES[active].focusY, 0)
    home.current.set(...CAMERA_POSITION).sub(focus).multiplyScalar(cameraDistanceScale(aspect)).add(focus)
    homing.current = true
    zoomGoal.current = null
  }, [active, aspect, resetView])

  // smooth wheel zoom: each notch nudges a target distance and the camera eases toward it
  const gl = useThree((s) => s.gl)
  const zoomGoal = useRef<number | null>(null)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      const c = controls.current
      if (!c) return
      e.preventDefault()
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
    if (c && homing.current) {
      camera.position.lerp(home.current, k)
      // (any panning is undone too: the target slides back to the middle of the dish)
      c.target.lerp(homeTarget.set(0, focusY, 0), k)
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
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

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
        return (
          <group key={dish.id} ref={(g) => { groups.current[i] = g }}
            position-x={slot(i, active, DISHES.length) * SPACING}>
            <Suspense fallback={null}>
              <Dish url={dish.model} itemIds={ITEM_IDS[dish.id]} quantities={servings(dish, orders[dish.id])}
                broth={base?.broth} hidden={hidden} fill={base?.fill} tint={base?.tint}
                floatIds={FLOAT_IDS[dish.id]} layout={dish.layout}
                instant={reducedMotion} />
              {/* after <Dish>, so its transforms win over the pop-in each frame */}
              {dish.roast && (
                <Roasting url={dish.model} roast={dish.roast} itemIds={ITEM_IDS[dish.id]} quantities={servings(dish, orders[dish.id])}
                  active={i === active} instant={reducedMotion} fire={fire} onOffFire={onOffFire} onEat={onEat}
                  onNotice={onNotice} smoke={grillSmoke} blackSmoke={grillBlackSmoke} />
              )}
              {dish.heatControl && <StoveControls url={dish.model} heat={heat} />}
              {soup && dish.heatControl && dish.brothY !== undefined && (
                // inner radius of the pot at the broth line (blender/hotpot.py INNER_R)
                <Bubbles position-y={dish.brothY + 0.004} radius={0.74} boil={boilLevel} />
              )}
              {dish.heat === 'gas' && (
                <GasFlame position-y={BURNER_Y} heat={dish.heatControl ? heat / 100 : 1}
                  baseIntensity={theme === 'dark' ? 1.5 : 0.8} />
              )}
              {/* toon ramps blow out easily, so the firelight stays modest */}
              {dish.heat === 'fire' && <Fire width={0.6} height={0.42} baseIntensity={look.fire} level={fire} />}
              {soup && dish.brothY !== undefined && dish.steam && (
                <Steam position={[0, dish.brothY + 0.02, 0]} width={dish.steam.width} height={dish.steam.height}
                  opacity={theme === 'dark' ? 0.5 : 0.7} level={dish.heatControl ? steamLevel : undefined} />
              )}
              {dish.smoke && (
                // same white puffs as the soup steam, just taller and slower
                <Steam position={[0, dish.smoke.y, 0]} width={dish.smoke.width} height={dish.smoke.height}
                  opacity={theme === 'dark' ? 0.5 : 0.7} speed={0.05}
                  level={dish.heat === 'fire' ? grillSmoke : undefined} />
              )}
              {dish.smoke && dish.heat === 'fire' && (
                // burning food: thick dark smoke that boils up faster and rolls about more than the pale smoke
                <Steam position={[0, dish.smoke.y, 0]} width={dish.smoke.width * 1.25} height={dish.smoke.height * 1.2}
                  layers={5} opacity={0.75} speed={0.11} color="#3a3430" shade="#1c1916" level={grillBlackSmoke} />
              )}
            </Suspense>
          </group>
        )
      })}

      <ContactShadows position={[0, 0, 0]} opacity={look.shadowOpacity * 0.8} color={look.shadow} scale={6}
        blur={2.6} far={1.5} />

      <OrbitControls
        ref={controls}
        // shared as the scene's controls so dragging a seasoning onto food can hold the camera still
        makeDefault
        target={[0, DISHES[0].focusY, 0]}
        // the middle button (or the right) drags the view sideways; the left one turns it
        enablePan
        screenSpacePanning
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        minDistance={1.8}
        maxDistance={20}
        maxPolarAngle={Math.PI * 0.45}
        // the wheel is handled below for a smooth glide; rotation drifts to a stop instead of halting
        enableZoom={false}
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
  const [orders, setOrders] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(DISHES.map((d) => [d.id, {}])),
  )
  // how full you are: every bite eaten adds its calories, and they slowly digest away
  const [kcal, setKcal] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setKcal((k) => Math.max(0, k - DIGEST_KCAL_PER_SEC)), 1000)
    return () => window.clearInterval(id)
  }, [])
  const onEat = useCallback((id: string) => {
    const cal = ALL_ITEMS.get(id)?.kcal ?? 0
    setKcal((k) => k + cal)
  }, [])
  const [theme, toggleTheme] = useTheme()
  // the menu can be folded away to give the food the whole screen
  const [menuFolded, setMenuFolded] = useState(false)
  // bumped to send the camera back to its home view
  const [resetView, setResetView] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const [heat, setHeat] = useState(40)
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem('canteen-lang') === 'ja' ? 'ja' : 'zh'
    } catch {
      return 'zh'
    }
  })
  const toggleLang = () =>
    setLang((l) => {
      const next: Lang = l === 'zh' ? 'ja' : 'zh'
      try {
        localStorage.setItem('canteen-lang', next)
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
  const fire = useRef(0.6)
  const [fireLevel, setFireLevel] = useState(60)
  useEffect(() => {
    const id = window.setInterval(() => {
      fire.current = Math.max(0, fire.current - FIRE_BURN_PER_TICK)
      setFireLevel(Math.round(fire.current * 1000) / 10)
    }, 200)
    return () => window.clearInterval(id)
  }, [])
  const addCharcoal = () => {
    fire.current = Math.min(1, fire.current + 0.18)
    setFireLevel(Math.round(fire.current * 1000) / 10)
  }
  const dish = DISHES[active]
  const base = orderedBase(dish, orders[dish.id])

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
      const n = DISHES.length
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + n) % n)
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  const changeQty = (id: string, delta: number) => {
    // a pot takes one soup and a bowl one serving of noodles: ordering another swaps it
    const isBase = dish.bases.some((b) => b.id === id)
    if (isBase && dish.oneBase) {
      setOrders((all) => {
        const next = { ...all[dish.id] }
        for (const b of dish.bases) next[b.id] = 0
        next[id] = delta > 0 ? 1 : 0
        return { ...all, [dish.id]: next }
      })
      return
    }
    // a set brings its own skewers, so check the fire's room for those too
    const adds = isBase ? dish.bases.find((b) => b.id === id)!.includes ?? {} : { [id]: 1 }
    const addsSkewers = Object.entries(adds).reduce((n, [k, q]) => n + (isSkewer(k) ? q : 0), 0)
    if (delta > 0 && addsSkewers && onTheFire() + addsSkewers > FIRE_CAPACITY) {
      say(UI[lang].fireFull(FIRE_CAPACITY))
      return
    }
    // the bamboo basket only holds so many potatoes and sweet potatoes
    const basket = dish.roast?.basket
    const addsLoose = Object.entries(adds).reduce((n, [k, q]) => n + (dish.roast?.basketItems?.includes(k) ? q : 0), 0)
    if (delta > 0 && basket && addsLoose && loose + addsLoose > basket.capacity) {
      say(UI[lang].basketFull(basket.capacity))
      return
    }
    // some things only fit so many at once
    const item = dish.items.find((i) => i.id === id)
    const max = item?.max ?? MAX_PORTIONS
    if (delta > 0 && (orders[dish.id][id] ?? 0) >= max) {
      say(UI[lang].itemFull(item ? nameIn(lang, item) : id, max))
      return
    }
    setOrders((all) => {
      const qty = Math.min(max, Math.max(0, (all[dish.id][id] ?? 0) + delta))
      return { ...all, [dish.id]: { ...all[dish.id], [id]: qty } }
    })
  }

  return (
    <div className={`app${menuFolded ? ' menu-folded' : ''}`} ref={appRef}>
      {/* the 3D view fills the whole window behind the stage and the menu, so nothing is cut off at the menu's
          edge; the camera is offset so the dish still sits in the middle of the stage */}
      <div className="canvas-layer">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
          gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
        >
          <Scene active={active} orders={orders} theme={theme} reducedMotion={reducedMotion}
            heat={heat} fire={fire} frame={frame} onOffFire={(n, loose) => { setOffFire(n); setLoose(loose) }}
            onEat={onEat} onNotice={(what) => say(UI[lang][what])} resetView={resetView} />
        </Canvas>
      </div>
      <div className="stage" ref={stageRef}>
        <Brand night={theme === 'dark'} lang={lang} />
        {dish.heatControl && <HeatControl heat={heat} onChange={setHeat} lang={lang} />}
        {dish.heat === 'fire' && <FireControl level={fireLevel} onAdd={addCharcoal} lang={lang} />}
        <Fullness kcal={kcal} full={FULL_KCAL} lang={lang} />
        <DishSwitcher dishes={DISHES} index={active} onChange={setActive} lang={lang} />
        <button type="button" className="view-reset" onClick={() => setResetView((n) => n + 1)}
          aria-label={UI[lang].resetView} title={UI[lang].resetView}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /><circle cx="12" cy="12" r="2.2" /></svg>
        </button>
        <p className={`notice${notice ? ' is-shown' : ''}`} role="status" aria-live="polite">{notice}</p>
      </div>
      <div className="menu-backing" aria-hidden="true" />
      <Menu key={dish.id} dish={dish} lang={lang} quantities={orders[dish.id]}
        onAdd={(id) => changeQty(id, 1)} onRemove={(id) => changeQty(id, -1)}
        onClear={() => setOrders((all) => ({ ...all, [dish.id]: {} }))} />
      <button type="button" className="menu-fold" onClick={() => setMenuFolded((f) => !f)}
        aria-expanded={!menuFolded} aria-label={menuFolded ? UI[lang].showMenu : UI[lang].hideMenu}>
        {menuFolded ? '‹' : '›'}
      </button>
      <button type="button" className="lang-toggle" onClick={toggleLang} aria-label={UI[lang].langLabel}>
        {UI[lang].lang}
      </button>
      <button type="button" className="theme-toggle" onClick={toggleTheme}
        aria-label={theme === 'light' ? '切換成深色模式' : '切換成淺色模式'}>
        {theme === 'light' ? '夜' : '晝'}
      </button>
      <Loader />
    </div>
  )
}

for (const d of DISHES) {
  useGLTF.preload(d.model)
  for (const b of d.bases) if (b.broth) useTexture.preload(b.broth)
}
