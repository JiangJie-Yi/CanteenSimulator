import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Loader, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Brand } from './components/Brand'
import { Dish } from './components/Dish'
import { DishSwitcher } from './components/DishSwitcher'
import { Fire } from './components/Fire'
import { GasFlame } from './components/GasFlame'
import { HeatControl } from './components/HeatControl'
import { Menu } from './components/Menu'
import { Roasting } from './components/Roasting'
import { Steam } from './components/Steam'
import { DISHES, type Dish as DishInfo } from './menu'

// distance between dishes on the carousel
const SPACING = 6
// burner top on the cassette stove (blender/hotpot.py)
const BURNER_Y = 0.34
// the one camera pose every dish is framed from (blender/open_live.py matches Blender's camera to it)
// low enough (~19° above the dish) that the burner flames show under the hot pot's rim
const CAMERA_POSITION: [number, number, number] = [2.9, 2.2, 4.0]
const CAMERA_FOV = 40

const ITEM_IDS = Object.fromEntries(DISHES.map((d) => [d.id, d.items.map((it) => it.id)]))
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
const cameraDistanceScale = (aspect: number) => (aspect >= 1.3 ? 1 : Math.min(2.4, 1.3 / aspect))

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

const baseOf = (dish: DishInfo, baseId: string) => dish.bases.find((b) => b.id === baseId) ?? dish.bases[0]

type SceneProps = {
  active: number
  orders: Record<string, Record<string, number>>
  bases: Record<string, string>
  theme: Theme
  reducedMotion: boolean
  heat: number
}

function Scene({ active, orders, bases, theme, reducedMotion, heat }: SceneProps) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const controls = useRef<OrbitControlsImpl>(null)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const look = LIGHTING[theme]
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
  useEffect(() => {
    const focus = new THREE.Vector3(0, DISHES[active].focusY, 0)
    home.current.set(...CAMERA_POSITION).sub(focus).multiplyScalar(cameraDistanceScale(aspect)).add(focus)
    homing.current = true
  }, [active, aspect])

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
      c.target.set(0, c.target.y + (focusY - c.target.y) * k, 0)
      c.update()
      if (camera.position.distanceTo(home.current) < 0.002 && Math.abs(c.target.y - focusY) < 0.002) {
        homing.current = false
      }
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
        const base = baseOf(dish, bases[dish.id])
        return (
          <group key={dish.id} ref={(g) => { groups.current[i] = g }}
            position-x={slot(i, active, DISHES.length) * SPACING}>
            <Suspense fallback={null}>
              <Dish url={dish.model} itemIds={ITEM_IDS[dish.id]} quantities={orders[dish.id]} broth={base.broth}
                hidden={base.hide} floatIds={FLOAT_IDS[dish.id]} instant={reducedMotion} />
              {/* after <Dish>, so its transforms win over the pop-in each frame */}
              {dish.roast && (
                <Roasting url={dish.model} roast={dish.roast} itemIds={ITEM_IDS[dish.id]} quantities={orders[dish.id]}
                  active={i === active} instant={reducedMotion} />
              )}
              {dish.heat === 'gas' && (
                <GasFlame position-y={BURNER_Y} heat={dish.heatControl ? heat / 100 : 1}
                  baseIntensity={theme === 'dark' ? 1.5 : 0.8} />
              )}
              {/* toon ramps blow out easily, so the firelight stays modest */}
              {dish.heat === 'fire' && <Fire width={0.7} height={0.95} baseIntensity={look.fire} />}
              {dish.brothY !== undefined && dish.steam && (
                <Steam position={[0, dish.brothY + 0.02, 0]} width={dish.steam.width} height={dish.steam.height}
                  opacity={(theme === 'dark' ? 0.5 : 0.7) * (dish.heatControl ? Math.min(1, heat / 40) : 1)} />
              )}
              {dish.smoke && (
                // same white puffs as the soup steam, just taller and slower
                <Steam position={[0, dish.smoke.y, 0]} width={dish.smoke.width} height={dish.smoke.height}
                  opacity={theme === 'dark' ? 0.5 : 0.7} speed={0.05} />
              )}
            </Suspense>
          </group>
        )
      })}

      <ContactShadows position={[0, 0, 0]} opacity={look.shadowOpacity * 0.8} color={look.shadow} scale={6}
        blur={2.6} far={1.5} />

      <OrbitControls
        ref={controls}
        target={[0, DISHES[0].focusY, 0]}
        enablePan={false}
        minDistance={1.8}
        maxDistance={12}
        maxPolarAngle={Math.PI * 0.45}
        onStart={() => { homing.current = false }}
      />
    </>
  )
}

export default function App() {
  const [active, setActive] = useState(0)
  // portions ordered per item, per dish
  const [orders, setOrders] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(DISHES.map((d) => [d.id, Object.fromEntries(d.defaults.map((id) => [id, 1]))])),
  )
  const [bases, setBases] = useState<Record<string, string>>(() =>
    Object.fromEntries(DISHES.map((d) => [d.id, d.bases[0].id])),
  )
  const [theme, toggleTheme] = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const [heat, setHeat] = useState(40)
  const dish = DISHES[active]
  const base = baseOf(dish, bases[dish.id])

  // dev only: mirror what's on screen into the open Blender (vite.config.ts -> blender/open_live.py)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const state = {
      dish: dish.id,
      blend: `${dish.id}.blend`,
      items: ITEM_IDS[dish.id],
      selected: Object.keys(orders[dish.id]).filter((id) => orders[dish.id][id] > 0),
      hide: base.hide ?? [],
      broth: base.broth ?? null,
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

  const MAX_PORTIONS = 9
  const changeQty = (id: string, delta: number) =>
    setOrders((all) => {
      const qty = Math.min(MAX_PORTIONS, Math.max(0, (all[dish.id][id] ?? 0) + delta))
      return { ...all, [dish.id]: { ...all[dish.id], [id]: qty } }
    })

  return (
    <div className="app">
      <div className="stage">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
          gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
        >
          <Scene active={active} orders={orders} bases={bases} theme={theme} reducedMotion={reducedMotion}
            heat={heat} />
        </Canvas>
        <Brand night={theme === 'dark'} />
        {dish.heatControl && <HeatControl heat={heat} onChange={setHeat} />}
        <DishSwitcher dishes={DISHES} index={active} onChange={setActive} />
      </div>
      <Menu key={dish.id} dish={dish} baseId={base.id} quantities={orders[dish.id]}
        onBase={(id) => setBases((all) => ({ ...all, [dish.id]: id }))}
        onAdd={(id) => changeQty(id, 1)} onRemove={(id) => changeQty(id, -1)}
        onClear={() => setOrders((all) => ({ ...all, [dish.id]: {} }))} />
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
