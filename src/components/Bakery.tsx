import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Bake, MenuItem } from '../menu'
import { SEASON_NAME, TOPPINGS, type Part, type Topping } from '../recipes'
import type { Lang } from '../i18n'

/*
 * 麥田烘焙, a French-style bakery (boulangerie), drawn in code. A floured work table with a baking tray on it; along
 * its front, six bowls of what goes in or on a bread (chocolate, flaked almonds, cheese, ham, custard, garlic butter);
 * a deck oven at the back on the left, its window glowing while it bakes; a cooling rack at the back on the right.
 *
 * With the shop closed: dough taken from the 試做 board comes out raw onto the tray. Pick a bowl, then click a dough
 * to put that on it (again to take it off). Click the oven to slide everything on the tray in, and again to take it
 * all out onto the rack — pale if it's too soon, golden when it's right, black if it's been forgotten. A pale one
 * clicked on the rack goes back in to finish; any other is eaten (four bites), and the last bite is what's noted.
 * With the shop open: the kitchen bakes what's ordered (it's shown in the oven, then on the rack).
 */

const ALONG = new THREE.Vector3(0.81, 0, -0.59)
const YAW = Math.atan2(-ALONG.z, ALONG.x)
const INK = '#3b2a20'
const TABLE_TOP = 0.42
const BITES = 4
const OVEN_AT = new THREE.Vector3(-0.85, 0, -0.78)
const RACK_AT = new THREE.Vector3(0.88, 0, -0.7)
const TRAY_AT = new THREE.Vector3(0, TABLE_TOP + 0.012, 0.15)
const RAW = new THREE.Color('#f1e0c2')
const BAKED = new THREE.Color('#c9843a')
const BURNT = new THREE.Color('#3a2a1e')
const TOP_COLOR: Record<Topping, string> = { chocolate: '#4a2a1a', almond: '#ecd9b4', cheese: '#f3b733', ham: '#e89a96',
  custard: '#f2cc58', garlic: '#7cae4a' }

type Bread = { key: string; id: string; dabs: Topping[]; where: 'tray' | 'oven' | 'rack'; progress: number; left: number }

function Ink({ geo, color, s = 1.05, ...rest }: { geo: THREE.BufferGeometry; color: string; s?: number } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geo} castShadow receiveShadow><meshToonMaterial color={color} /></mesh>
      <mesh geometry={geo} scale={s}><meshBasicMaterial color={INK} side={THREE.BackSide} /></mesh>
    </group>
  )
}

const G = {
  bun: new THREE.SphereGeometry(0.085, 20, 12),
  loaf: new THREE.BoxGeometry(0.22, 0.15, 0.14, 2, 2, 2),
  croissant: new THREE.TorusGeometry(0.075, 0.036, 10, 18, Math.PI * 1.25),
  baguette: new THREE.CapsuleGeometry(0.04, 0.3, 6, 12),
  cap: new THREE.SphereGeometry(0.09, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
  bit: new THREE.BoxGeometry(0.016, 0.01, 0.012),
  slice: new THREE.BoxGeometry(0.1, 0.008, 0.1),
  bowl: new THREE.LatheGeometry([[0.001, 0], [0.06, 0], [0.09, 0.05], [0.095, 0.07], [0.088, 0.07], [0.08, 0.052], [0.001, 0.012]]
    .map(([x, y]) => new THREE.Vector2(x, y)), 24),
  disc: new THREE.CircleGeometry(0.078, 20),
}

/** a bread's colour as it bakes: raw dough, golden, then burnt */
const bakeColor = (r: number, out: THREE.Color) =>
  r < 1 ? out.copy(RAW).lerp(BAKED, Math.max(0, r)) : out.copy(BAKED).lerp(BURNT, THREE.MathUtils.smoothstep(r, 1.35, 2.1))

/** 美味: doneness first (doughy, golden best, burnt bad), then how the fillings suit the dough */
export function breadTaste(bake: Bake, id: string, dabs: Topping[], r: number) {
  let t = r < 0.6 ? 12 : r < 0.9 ? 25 + (r - 0.6) * 100 : r < 1.3 ? 58 + (1 - Math.abs(r - 1.1) * 4) * 8 : r < 1.8 ? 55 - (r - 1.3) * 60 : 10
  const pair = bake.pairing[id] ?? {}
  dabs.forEach((k, i) => { t += (pair[k] ?? -6) * (i === 0 ? 1 : 0.6) })
  if (dabs.length > 2) t -= (dabs.length - 2) * 12
  return Math.round(THREE.MathUtils.clamp(t, 0, 100))
}

function BreadShape({ b, color }: { b: { id: string; dabs: Topping[] }; color: THREE.Color }) {
  const c = `#${color.getHexString()}`
  // (a sourdough is a big round boule, a brioche a little glossy bun)
  const geo = b.id === 'CroissantDough' ? G.croissant : b.id === 'BaguetteDough' ? G.baguette : G.bun
  const lift = b.id === 'SourdoughDough' ? 0.07 : b.id === 'BaguetteDough' ? 0.04 : b.id === 'CroissantDough' ? 0.036 : 0.05
  return (
    <group>
      <Ink geo={geo} color={c} position-y={lift} userData={{ dough: true }} scale={b.id === 'SourdoughDough' ? [1.35, 0.8, 1.35] : b.id === 'BriocheDough' ? [1, 0.75, 1] : 1}
        rotation={b.id === 'CroissantDough' ? [Math.PI / 2, 0, -Math.PI * 0.12] : b.id === 'BaguetteDough' ? [0, 0, Math.PI / 2] : [0, 0, 0]} />
      {b.dabs.map((k) => {
        const top = lift * 2 - 0.004
        // cheese and ham lie on top in slices, custard in a pool, chocolate in a drizzled bar
        if (k === 'cheese' || k === 'ham') return <mesh key={k} geometry={G.slice} position-y={top + (k === 'ham' ? 0.006 : 0)} rotation-y={k === 'ham' ? 1.1 : 0.4}
          scale={k === 'ham' ? [0.9, 1, 0.8] : 1}><meshToonMaterial color={TOP_COLOR[k]} /></mesh>
        if (k === 'custard') return <mesh key={k} geometry={G.disc} position-y={top + 0.004} rotation-x={-Math.PI / 2} scale={0.55}><meshToonMaterial color={TOP_COLOR.custard} /></mesh>
        if (k === 'chocolate') return <mesh key={k} position-y={top + 0.004}><boxGeometry args={[0.13, 0.01, 0.025]} /><meshToonMaterial color={TOP_COLOR.chocolate} /></mesh>
        // flaked almonds and garlic-butter herbs: bits strewn over the top
        return Array.from({ length: 9 }, (_, i) => (
          <mesh key={`${k}${i}`} geometry={G.bit} position={[Math.cos(i * 2.4) * 0.04 * ((i % 3) + 1) / 3, top + 0.003, Math.sin(i * 2.4) * 0.04 * ((i % 3) + 1) / 3]}
            rotation-y={i} scale={k === 'almond' ? [1.4, 0.6, 1.2] : 0.8}>
            <meshToonMaterial color={TOP_COLOR[k]} />
          </mesh>
        ))
      })}
    </group>
  )
}

type Props = {
  items: MenuItem[]
  bake: Bake
  /** portions taken from the board (the shop closed) */
  quantities: Record<string, number>
  active: boolean
  /** the shop is open: the kitchen bakes, the owner watches */
  locked: boolean
  lang: Lang
  onEat?: (id: string, taste: number, how?: { doneness?: number; dabs?: Record<string, number> }) => void
  /** (shop open) what the kitchen is baking or has just set out, and which */
  kitchen?: { phase: 'cook' | 'eat'; parts: Part[] } | null
}

export function Bakery({ items, bake, quantities, active, locked, lang, onEat, kitchen = null }: Props) {
  const [breads, setBreads] = useState<Bread[]>([])
  const [pick, setPick] = useState<Topping | null>(null)
  const seq = useRef(0)
  const ja = lang === 'ja'
  // what's taken from the board comes out raw on the tray; taken back, the newest raw ones go
  useEffect(() => {
    if (locked) return
    setBreads((cur) => {
      let next = [...cur]
      for (const it of items) {
        const want = quantities[it.id] ?? 0
        const mine = next.filter((b) => b.id === it.id)
        for (let k = mine.length; k < want; k++) next.push({ key: `${it.id}-${++seq.current}`, id: it.id, dabs: [], where: 'tray', progress: 0, left: BITES })
        if (mine.length > want) {
          const drop = new Set(mine.filter((b) => b.where === 'tray').slice(-(mine.length - want)).map((b) => b.key))
          next = next.filter((b) => !drop.has(b.key))
        }
      }
      return next
    })
  }, [quantities, items, locked])

  // baking: what's in the oven cooks on (and the colours are worked out each frame, without re-rendering for it)
  const progress = useRef(new Map<string, number>())
  const objs = useRef(new Map<string, THREE.Group>())
  const [, setTick] = useState(0)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const kitchenT = useRef(0)
  const lastTick = useRef(0)
  const col = useMemo(() => new THREE.Color(), [])
  const inOven = breads.filter((b) => b.where === 'oven')
  const baking = inOven.length > 0 || kitchen?.phase === 'cook'
  useFrame((st, dt) => {
    const d = Math.min(dt, 0.1)
    for (const b of breads) {
      if (b.where !== 'oven') continue
      progress.current.set(b.key, (progress.current.get(b.key) ?? b.progress) + d / (bake.times[b.id] ?? 20))
    }
    kitchenT.current = kitchen?.phase === 'cook' ? kitchenT.current + d : kitchen ? 1.1 : 0
    const k = baking ? 0.75 + Math.sin(st.clock.elapsedTime * 7) * 0.08 : 0.05
    if (glow.current) glow.current.opacity = k
    if (light.current) light.current.intensity = baking ? 1.6 : 0
    // (the label over the oven only needs redrawing now and then)
    if (baking && st.clock.elapsedTime - lastTick.current > 0.5) {
      lastTick.current = st.clock.elapsedTime
      setTick((n) => n + 1)
    }
    for (const b of breads) {
      const o = objs.current.get(b.key)
      if (!o) continue
      bakeColor(progress.current.get(b.key) ?? b.progress, col)
      o.traverse((m) => {
        if (m instanceof THREE.Mesh && m.material instanceof THREE.MeshToonMaterial && m.parent?.userData.dough) m.material.color.copy(col)
      })
    }
  })

  // clicks: a bowl picks what goes on; a dough on the tray gets it; the oven takes things in or out; a bread is eaten
  const { camera, gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const stateRef = useRef({ breads, pick })
  stateRef.current = { breads, pick }
  useEffect(() => {
    if (!active || locked) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || !group.current) return
      down = null
      const r = el.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      for (const h of ray.intersectObject(group.current, true)) {
        let o: THREE.Object3D | null = h.object
        while (o && !o.userData.bowl && !o.userData.bread && !o.userData.oven) o = o.parent
        if (!o) continue
        const { breads: all, pick: p } = stateRef.current
        if (o.userData.bowl) {
          const k = o.userData.bowl as Topping
          setPick((cur) => (cur === k ? null : k))
          return
        }
        if (o.userData.oven) {
          const inside = all.filter((b) => b.where === 'oven')
          setBreads((cur) => cur.map((b) => {
            if (inside.length && b.where === 'oven') return { ...b, where: 'rack', progress: progress.current.get(b.key) ?? b.progress }
            if (!inside.length && b.where === 'tray') return { ...b, where: 'oven' }
            return b
          }))
          return
        }
        const key = o.userData.bread as string
        const b = all.find((x) => x.key === key)
        if (!b) return
        if (b.where === 'tray' && p) {
          setBreads((cur) => cur.map((x) => (x.key !== key ? x : { ...x, dabs: x.dabs.includes(p) ? x.dabs.filter((d) => d !== p)
            : [...x.dabs, p].sort((a, c) => TOPPINGS.indexOf(a) - TOPPINGS.indexOf(c)) })))
          return
        }
        // (taken out too soon, not yet bitten into: back in the oven to finish)
        if (b.where === 'rack' && b.left === BITES && (progress.current.get(b.key) ?? b.progress) < 0.9) {
          setBreads((cur) => cur.map((x) => (x.key === key ? { ...x, where: 'oven' } : x)))
          return
        }
        if (b.where === 'rack' && b.left > 0) {
          const left = b.left - 1
          if (left === 0) onEat?.(b.id, breadTaste(bake, b.id, b.dabs, b.progress), { doneness: b.progress,
            dabs: Object.fromEntries(b.dabs.map((d) => [d, 1])) })
          setBreads((cur) => cur.map((x) => (x.key === key ? { ...x, left } : x)))
        }
        return
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [active, locked, camera, gl, onEat, bake])

  // where each bread sits: on the tray in rows, in the oven on its rack, on the cooling rack's shelves
  const spot = (b: Bread, n: number): [number, number, number] => {
    if (b.where === 'tray') return [TRAY_AT.x - 0.42 + (n % 4) * 0.28, TRAY_AT.y, TRAY_AT.z - 0.12 + Math.floor(n / 4) * 0.24]
    if (b.where === 'oven') return [OVEN_AT.x - 0.26 + (n % 3) * 0.26, 0.47, OVEN_AT.z + 0.02 + Math.floor(n / 3) % 2 * 0.14]
    return [RACK_AT.x - 0.28 + (n % 3) * 0.28, 0.52 + Math.floor(n / 3) % 2 * 0.32, RACK_AT.z + 0.05]
  }
  // (with the shop open, the kitchen's batch is drawn instead: in the oven while it bakes, then on the rack)
  const shown: Bread[] = locked
    ? (kitchen?.parts ?? []).map((p, i) => ({ key: `k${i}-${p.id}`, id: p.id, dabs: p.dabs as Topping[], where: kitchen!.phase === 'cook' ? 'oven' : 'rack',
      progress: kitchen!.phase === 'cook' ? Math.min(1.05, kitchenT.current / 8) : 1.05, left: BITES }))
    : breads.filter((b) => b.left > 0)
  const counts = { tray: 0, oven: 0, rack: 0 }
  const ovenPct = inOven.length ? Math.round(Math.min(...inOven.map((b) => progress.current.get(b.key) ?? 0)) * 100) : 0

  return (
    <group rotation-y={YAW} ref={group}>
      {/* the work table, floured, and the baking tray on it */}
      <Ink geo={useMemo(() => new THREE.BoxGeometry(2.7, 0.06, 1.15), [])} color="#c99a62" position={[0, TABLE_TOP - 0.03, 0.3]} s={1.015} />
      <mesh position={[0, TABLE_TOP + 0.001, 0.3]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#fffaf0" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {[[-1.25, -0.2], [1.25, -0.2], [-1.25, 0.8], [1.25, 0.8]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (TABLE_TOP - 0.06) / 2, z]} castShadow>
          <boxGeometry args={[0.07, TABLE_TOP - 0.06, 0.07]} />
          <meshToonMaterial color="#7a5232" />
        </mesh>
      ))}
      <Ink geo={useMemo(() => new THREE.BoxGeometry(1.2, 0.02, 0.56), [])} color="#9aa3a8" position={[TRAY_AT.x, TRAY_AT.y - 0.004, TRAY_AT.z]} s={1.02} />

      {/* the bowls of fillings and toppings along the front */}
      {TOPPINGS.map((k, i) => (
        <group key={k} position={[-1.05 + i * 0.42, TABLE_TOP, 0.72]} userData={{ bowl: k }}>
          <Ink geo={G.bowl} color={pick === k ? '#fff1c8' : '#efe8d8'} s={1.06} />
          <mesh geometry={G.disc} position-y={0.05} rotation-x={-Math.PI / 2}><meshToonMaterial color={TOP_COLOR[k]} /></mesh>
          {active && (
            <Html position={[0, 0.17, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
              <span className={`bake-bowl${pick === k ? ' is-picked' : ''}`}>{SEASON_NAME[lang][k]}</span>
            </Html>
          )}
        </group>
      ))}

      {/* the deck oven: steel, a window that glows while it bakes, a dial; it stands on legs */}
      <group position={OVEN_AT} userData={{ oven: true }}>
        <Ink geo={useMemo(() => new THREE.BoxGeometry(1.0, 0.62, 0.62), [])} color="#5c5f63" position-y={0.62} s={1.02} />
        {[[-0.44, -0.26], [0.44, -0.26], [-0.44, 0.26], [0.44, 0.26]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.155, z]}><boxGeometry args={[0.05, 0.31, 0.05]} /><meshToonMaterial color="#2e2c2a" /></mesh>
        ))}
        <mesh position={[0, 0.6, 0.312]}><planeGeometry args={[0.74, 0.3]} /><meshToonMaterial color="#221d1a" /></mesh>
        <mesh position={[0, 0.6, 0.313]}>
          <planeGeometry args={[0.72, 0.28]} />
          <meshBasicMaterial ref={glow} color="#ff9a3a" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, 0.8, 0.315]}><boxGeometry args={[0.6, 0.03, 0.03]} /><meshToonMaterial color="#c9ccd0" /></mesh>
        <mesh position={[0.38, 0.86, 0.315]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.035, 0.035, 0.03, 16]} /><meshToonMaterial color="#d8d2c4" /></mesh>
        <pointLight ref={light} position={[0, 0.6, 0.5]} color="#ff9a3a" intensity={0} distance={1.8} decay={1.6} />
        {active && !locked && (
          <Html position={[0, 1.08, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
            <span className={`bake-oven${inOven.length ? ' is-on' : ''}`}>
              {inOven.length ? (ja ? `焼成中 ${ovenPct}%・押して出す` : `烘烤中 ${ovenPct}%・點一下出爐`)
                : breads.some((b) => b.where === 'tray') ? (ja ? '押して窯へ' : '點烤箱：放進去烤') : (ja ? 'オーブン' : '烤箱')}
            </span>
          </Html>
        )}
      </group>

      {/* the cooling rack: two wire shelves on a stand */}
      <group position={RACK_AT}>
        {[0.5, 0.82].map((y) => (
          <mesh key={y} position={[0, y, 0.05]}><boxGeometry args={[0.92, 0.015, 0.36]} /><meshToonMaterial color="#b9bdc2" /></mesh>
        ))}
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.45, 0.05]}><boxGeometry args={[0.03, 0.9, 0.36]} /><meshToonMaterial color="#8a8e93" /></mesh>
        ))}
      </group>

      {/* the breads */}
      {shown.map((b) => {
        const n = counts[b.where]++
        const at = spot(b, n)
        return (
          <group key={b.key} position={at} userData={{ bread: b.key }}
            ref={(o) => { if (o) objs.current.set(b.key, o); else objs.current.delete(b.key) }}
            scale={1.5 * (b.left < BITES ? 0.55 + 0.45 * (b.left / BITES) : 1)}>
            <BreadShape b={b} color={bakeColor(locked ? b.progress : progress.current.get(b.key) ?? b.progress, new THREE.Color())} />
          </group>
        )
      })}

      {active && !locked && breads.some((b) => b.where === 'tray') && (
        <Html position={[TRAY_AT.x, TRAY_AT.y + 0.35, TRAY_AT.z]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span className="bake-hint">{pick ? (ja ? `${SEASON_NAME.ja[pick]}をのせる生地を押す` : `點麵團放上${SEASON_NAME.zh[pick]}`)
            : (ja ? '具を選んで生地を押す' : '先點下面的餡料，再點麵團')}</span>
        </Html>
      )}
    </group>
  )
}
