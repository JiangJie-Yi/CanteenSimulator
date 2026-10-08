import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/*
 * Cooking in the hot pot, by the broth's real temperature: food only cooks in liquid hot enough to cook it
 * (from about 70°C, fastest at a rolling boil), each kind taking about as long as it does at a real hot-pot table
 * — a slice of beef is done in seconds, taro takes minutes. Raw food can't be taken out; cooked food is picked
 * out with a click into the little bowl beside the pot, and eaten from there. While the soup boils, everything in
 * it bobs on the bubbles.
 *
 * With no soup in the pot the food isn't held up by anything: it drops to the floor of the pot and settles, the
 * pieces that overlap stacking on one another; pour a soup in and they float back up. A pot left on the flame dry
 * heats up and scorches: its floor browns and blackens (and stays that way), the food on it chars, and it smokes.
 */

/** seconds at a rolling boil until done (real hot-pot times, roughly halved) */
const COOK_TIME: Record<string, number> = {
  BeefSlice: 10, Shrimp: 45, Meatball: 90, Fishball: 75, NapaCabbage: 60, Tofu: 45, FriedTofu: 30, Taro: 180,
  Corn: 120, CrabStick: 30, ShiitakeCap: 60, Enoki: 30,
}
/** how each one's colour changes as it cooks: [raw, cooked] multipliers on its authored colour */
const LOOK: Record<string, [string, string]> = {
  BeefSlice: ['#ffffff', '#a8907f'],          // red-pink → grey-brown
  Shrimp: ['#8f9c9e', '#ffffff'],             // translucent grey → orange-red
  Meatball: ['#f2c2b8', '#ffffff'],
  Fishball: ['#f4ede6', '#ffffff'],
  CrabStick: ['#ffffff', '#f2e6dc'],
}
const LOOK_DEFAULT: [string, string] = ['#ffffff', '#d9d4c4']   // vegetables, tofu: wilting, going translucent
const COOK_FROM = 70
const BOIL = 100
/** the bowl beside the pot, in the dish's own coordinates (clear of the stove, toward the camera) */
const BOWL_AT = new THREE.Vector3(-0.75, 0, 1.55)
const BOWL_R = 0.3
const BOWL_H = 0.2

type Food = {
  node: THREE.Object3D
  id: string
  cook: number                 // 0 raw, 1 done, 2.5+ overdone
  inBowl: boolean
  flight: number               // 0..1 while being lifted into the bowl
  from: THREE.Vector3
  slot: number
  eat: number                  // 0 not eaten; counts up while it's being eaten
  fit: number                  // a big slice folds over to fit in the bowl
  homeP: THREE.Vector3
  homeQ: THREE.Quaternion
  mats: { mat: THREE.MeshToonMaterial; base: THREE.Color }[]
  phase: number
  /** taken out by an AI customer (theirs to eat, not the player's) */
  ai?: boolean
  drop: number                 // how far it has sunk from where it floats (to the floor of an empty pot)
  vy: number
  char: number                 // 0..1 burnt on a dry, hot pot
}

const taste = (f: Food) => {
  if (f.char > 0.35) return Math.round(Math.max(3, 30 - f.char * 30))     // burnt onto a dry pot
  const r = f.cook
  if (r < 1) return Math.round(10 + r * 30)
  if (r < 1.6) return Math.round(72 + (r - 1) * 25)           // just done: at its best
  if (r < 3) return Math.round(87 - (r - 1.6) * 22)           // falling apart, chewy, washed out
  return 55
}
const doneness = (f: Food) => (f.char > 0.35 ? '焦' : f.cook < 1 ? '生' : f.cook < 2.4 ? '熟' : '過熟')
const GRAVITY = 9.8
/** the rice bowl in front of the stove, and the bites a bowl of rice takes */
const RICE_AT = new THREE.Vector3(0.05, 0, 1.62)
const RICE_STEP = new THREE.Vector3(0.62, 0, 0.05)
const RICE_BITES = 4
const RICE_TASTE = 70
/** the self-serve sauce station on the left of the stove: what's in each little dish, and what it suits */
const SAUCE_AT = new THREE.Vector3(-1.85, 0, 0.35)
type Sauce = { id: string; zh: string; ja: string; color: string; bits?: string; suits: Record<string, number>; other: number }
const SAUCES: Sauce[] = [
  { id: 'shacha', zh: '沙茶醬', ja: 'サーチャージャン', color: '#7a4a24', bits: '#a8743f',
    suits: { BeefSlice: 12, Meatball: 9, Fishball: 6, Shrimp: 6, Taro: 4 }, other: 3 },
  { id: 'soy', zh: '醬油', ja: '醤油', color: '#2a140a', suits: { Tofu: 8, FriedTofu: 8, ShiitakeCap: 6, Enoki: 5, NapaCabbage: 5 },
    other: 3 },
  { id: 'garlic', zh: '蒜泥', ja: 'おろしにんにく', color: '#d9c48e', bits: '#b9a46c',
    suits: { BeefSlice: 7, Meatball: 5, Shrimp: 5, CrabStick: 4 }, other: 2 },
  { id: 'scallion', zh: '蔥花', ja: '刻みねぎ', color: '#6fa040', bits: '#a6cf6a', suits: { Tofu: 5, Fishball: 5, BeefSlice: 4 }, other: 3 },
  { id: 'chili', zh: '辣椒', ja: '唐辛子', color: '#c02818', bits: '#e8542e', suits: { BeefSlice: 6, Meatball: 5, Corn: -4 }, other: 2 },
]
/** the pot's inner floor (blender/hotpot.py Z0 + WALL) and its rounded corner into the wall */
const FLOOR_FLAT_R = 0.55
const FLOOR_CORNER = 0.17
const CHAR_COLOR = new THREE.Color('#2a1a10')
const SCORCH_COLOR = new THREE.Color('#3a2414')

/** a hand-thrown rice bowl, glazed inside, unglazed foot */
function Bowl({ inPlace = false }: { inPlace?: boolean }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push(new THREE.Vector2(0.12 + (BOWL_R - 0.12) * Math.sin((t * Math.PI) / 2) ** 0.7, t * BOWL_H))
    }
    // the rim, then back down the inside to the well
    pts.push(new THREE.Vector2(BOWL_R - 0.02, BOWL_H))
    for (let i = 16; i >= 0; i--) {
      const t = i / 16
      pts.push(new THREE.Vector2(Math.max(0.001, (0.1 + (BOWL_R - 0.14) * Math.sin((t * Math.PI) / 2) ** 0.7) * (t > 0 ? 1 : 0)),
        0.03 + t * (BOWL_H - 0.03)))
    }
    const g = new THREE.LatheGeometry(pts, 48)
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group position={inPlace ? undefined : BOWL_AT} name={inPlace ? 'ricebowl' : 'bowl'}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshToonMaterial color="#e9e1cf" />
      </mesh>
      <mesh geometry={geo} scale={1.03}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      {/* indigo bands round the outside */}
      <mesh position-y={BOWL_H * 0.72}>
        <cylinderGeometry args={[BOWL_R * 0.99, BOWL_R * 0.95, 0.018, 48, 1, true]} />
        <meshToonMaterial color="#3a5a8c" />
      </mesh>
    </group>
  )
}

/** a grainy white for cooked rice: little oval grains packed every which way */
const RICE_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#ece6d8'
  g.fillRect(0, 0, 256, 256)
  let seed = 4
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.5 ? '#fbf9f2' : '#e2dac8'
    g.beginPath()
    g.ellipse(rnd() * 256, rnd() * 256, 4 + rnd() * 2, 2 + rnd(), rnd() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 2)
  return t
})()

/** a bowl of rice: the rounded heap goes down with every bite */
function RiceBowl({ index, left, at }: { index: number; left: number; at: THREE.Vector3 }) {
  const k = left / RICE_BITES
  return (
    <group position={at} userData={{ rice: index }} scale={0.82}>
      <Bowl inPlace />
      {left > 0 && (
        <mesh position-y={BOWL_H * 0.82} scale={[0.92 * (0.6 + 0.4 * k), 0.85 * k + 0.12, 0.92 * (0.6 + 0.4 * k)]}>
          <sphereGeometry args={[BOWL_R * 0.86, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshToonMaterial color="#ffffff" map={RICE_TEX} />
        </mesh>
      )}
    </group>
  )
}

/** the self-serve sauce station: a dark wooden tray of little dishes, each with a sauce or a garnish in it */
function SauceStation({ chosen }: { chosen: string[] }) {
  return (
    <group position={SAUCE_AT} name="sauces">
      <mesh position-y={0.02} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.04, 1.3]} />
        <meshToonMaterial color="#5a3a22" />
      </mesh>
      <mesh position-y={0.02} scale={[1.04, 1.25, 1.02]}>
        <boxGeometry args={[0.42, 0.04, 1.3]} />
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      {SAUCES.map((s, i) => (
        <group key={s.id} position={[0, 0.04, -0.52 + i * 0.26]} userData={{ sauce: s.id }}>
          <mesh castShadow>
            <cylinderGeometry args={[0.1, 0.075, 0.05, 24]} />
            <meshToonMaterial color={chosen.includes(s.id) ? '#fff3d6' : '#f1ece0'} />
          </mesh>
          <mesh scale={[1.05, 1.15, 1.05]}>
            <cylinderGeometry args={[0.1, 0.075, 0.05, 24]} />
            <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
          </mesh>
          {/* the sauce in it, and for the chunky ones a few bits on top */}
          <mesh position-y={0.022} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.085, 24]} />
            <meshToonMaterial color={s.color} />
          </mesh>
          {s.bits && Array.from({ length: 9 }, (_, k) => (
            <mesh key={k} position={[Math.cos(k * 2.4) * 0.05 * ((k % 3) / 2 + 0.3), 0.026,
              Math.sin(k * 2.4) * 0.05 * ((k % 3) / 2 + 0.3)]}>
              <boxGeometry args={[0.014, 0.006, 0.01]} />
              <meshToonMaterial color={s.bits} />
            </mesh>
          ))}
          {/* a little spoon resting in it */}
          <mesh position={[0.04, 0.05, 0.02]} rotation={[0, 0.6, 0.9]}>
            <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
            <meshToonMaterial color="#c8ccd0" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

type Props = {
  url: string
  itemIds: string[]
  temp: MutableRefObject<number>
  active: boolean
  onEat?: (id: string, taste: number) => void
  onNotice?: (what: 'notCooked') => void
  /** whether there's a soup in the pot, the burner (0..100), and the pot's inner floor height */
  soup: boolean
  heat: number
  floorY: number
  /** black smoke off a dry pot (0..1), for App's smoke */
  smoke?: MutableRefObject<number>
  /** bowls of rice ordered */
  rice: number
  lang: 'zh' | 'ja'
  /** (shop open) what the customers are waiting for: they take it out of the pot once it's cooked, and eat it */
  aiWanted?: string[]
  aiPace?: number
  onGuestEat?: (id: string, taste: number) => void
}

export function PotCooking({ url, itemIds, temp, active, onEat, onNotice, soup, heat, floorY, smoke, rice, lang, aiWanted = [], aiPace = 0.8, onGuestEat }: Props) {
  const { scene } = useGLTF(url)
  const { camera, gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const foods = useRef(new Map<string, Food>())
  const ids = useMemo(() => new Set(itemIds), [itemIds])
  const [tip, setTip] = useState<{ at: [number, number, number]; text: string; taste: number } | null>(null)
  const hovered = useRef<Food | null>(null)
  // the dipping sauce mixed in your bowl, and the bites left in each bowl of rice
  const [dip, setDip] = useState<string[]>([])
  const [riceLeft, setRiceLeft] = useState<number[]>([])
  useEffect(() => {
    setRiceLeft((r) => Array.from({ length: rice }, (_, i) => r[i] ?? RICE_BITES))
  }, [rice])
  const dipRef = useRef(dip)
  dipRef.current = dip
  const riceRef = useRef(riceLeft)
  riceRef.current = riceLeft
  const [sauceTip, setSauceTip] = useState<{ at: [number, number, number]; text: string } | null>(null)

  /** everything ordered that's in the pot or the bowl right now (Dish makes the extra portions as it goes) */
  const sync = () => {
    scene.traverse((o) => {
      const id = o.userData.itemId as string | undefined
      if (!id || !ids.has(id) || foods.current.has(o.uuid)) return
      const mats: Food['mats'] = []
      o.traverse((m) => {
        if (!(m instanceof THREE.Mesh) || m.name.endsWith('_outline') || !(m.material instanceof THREE.MeshToonMaterial)) return
        // its own material, so one piece can be raw while the next is done
        // (a later portion is cloned from a piece that may already be cooked: start from the uncooked colour)
        const base = (m.material.userData.cookBase as THREE.Color | undefined)?.clone() ?? m.material.color.clone()
        const mat = m.material.clone()
        mat.userData = { fillKey: m.material.userData.fillKey, cookBase: base }
        m.material = mat
        mats.push({ mat, base })
      })
      foods.current.set(o.uuid, { node: o, id, cook: 0, inBowl: false, flight: 0, from: new THREE.Vector3(), slot: 0,
        eat: 0, fit: 1, homeP: o.position.clone(), homeQ: o.quaternion.clone(), mats, phase: Math.random() * Math.PI * 2,
        drop: 0, vy: 0, char: 0 })
    })
  }

  const inBowl = () => [...foods.current.values()].filter((f) => f.inBowl && f.eat === 0)
  /** how good it is dipped in what's in your bowl: each sauce that suits it adds, three or more muddle it */
  const withDip = (f: Food) => {
    const base = taste(f)
    const mix = dipRef.current
    if (!mix.length || f.cook < 1 || f.char > 0.35) return base
    let bonus = mix.reduce((n, id) => {
      const s = SAUCES.find((x) => x.id === id)!
      return n + (s.suits[f.id] ?? s.other)
    }, 0)
    if (mix.length > 3) bonus -= (mix.length - 3) * 8
    return Math.max(0, Math.min(100, base + Math.min(18, bonus)))
  }

  // clicks: cooked food in the pot goes into the bowl, food in the bowl is eaten; raw food stays where it is
  useEffect(() => {
    const el = gl.domElement
    if (!active) return
    const ray = new THREE.Raycaster()
    const aim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    }
    const pick = () => {
      const live = [...foods.current.values()].filter((f) => f.node.visible && f.eat === 0 && f.node.scale.x > 0.01)
      const hits = ray.intersectObjects(live.map((f) => f.node), true)
      for (const h of hits) {
        for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
          const f = live.find((x) => x.node === o)
          if (f) return f
        }
      }
      return null
    }
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
      down = null
      aim(e)
      // the sauce station: a click adds that sauce to your dipping bowl (again takes it out)
      const sauceHit = ray.intersectObjects(group.current?.getObjectByName('sauces')?.children ?? [], true)[0]
      if (sauceHit) {
        let o: THREE.Object3D | null = sauceHit.object
        while (o && !o.userData.sauce) o = o.parent
        const id = o?.userData.sauce as string | undefined
        if (id) setDip((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
        return
      }
      // a bite of rice
      const riceHit = ray.intersectObjects(group.current?.getObjectByName('rice')?.children ?? [], true)[0]
      if (riceHit) {
        let o: THREE.Object3D | null = riceHit.object
        while (o && o.userData.rice === undefined) o = o.parent
        const n = o?.userData.rice as number | undefined
        if (n !== undefined && (riceRef.current[n] ?? 0) > 0) {
          const left = riceRef.current[n] - 1
          setRiceLeft((r) => r.map((x, i) => (i === n ? left : x)))
          if (left === 0) onEat?.('Rice', RICE_TASTE)
        }
        return
      }
      // (a click on the bowl itself takes the piece on top)
      const bowl = group.current?.getObjectByName('bowl')
      const f = pick() ?? (bowl && ray.intersectObject(bowl, true).length
        ? inBowl().filter((x) => x.flight >= 1).sort((a, b) => b.slot - a.slot)[0] ?? null : null)
      if (!f) return
      if (f.inBowl) {
        // (a customer's piece is theirs)
        if (f.flight < 1 || f.ai) return
        f.eat = 0.0001
        onEat?.(f.id, withDip(f))
      } else if (f.cook < 1) {
        onNotice?.('notCooked')
      } else {
        f.inBowl = true
        f.flight = 0
        f.from.copy(f.node.position)
        const taken = new Set(inBowl().map((x) => x.slot))
        let s = 0
        while (taken.has(s)) s++
        f.slot = s
        f.node.userData.onPlate = true
        // a slice too wide for the bowl folds over on itself as it's lifted out
        const size = new THREE.Box3().setFromObject(f.node).getSize(new THREE.Vector3())
        const wide = Math.max(size.x, size.z) / ((f.node.userData.shrink as number | undefined) ?? 1)
        f.fit = Math.min(1, 0.26 / wide)
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      aim(e)
      const sh = ray.intersectObjects(group.current?.getObjectByName('sauces')?.children ?? [], true)[0]
      let so: THREE.Object3D | null = sh?.object ?? null
      while (so && !so.userData.sauce) so = so.parent
      const sauce = SAUCES.find((x) => x.id === so?.userData.sauce)
      setSauceTip(sauce && so ? { at: so.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0)).toArray() as [number, number, number],
        text: (lang === 'ja' ? sauce.ja : sauce.zh) + (dipRef.current.includes(sauce.id) ? ' ✓' : '') } : null)
      const riceH = ray.intersectObjects(group.current?.getObjectByName('rice')?.children ?? [], true).length > 0
      const f = pick()
      const bowl = group.current?.getObjectByName('bowl')
      const onBowl = !f && !!bowl && ray.intersectObject(bowl, true).length > 0 && inBowl().length > 0
      if (!f) el.style.cursor = onBowl || sauce || riceH ? 'pointer' : ''
      if (f !== hovered.current) {
        hovered.current = f
        if (f) el.style.cursor = 'pointer'
        else setTip(null)
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      hovered.current = null
      setTip(null)
    }
  }, [active, gl, camera, onEat, onNotice, lang])

  // the pot's own surfaces, for scorching when it's heated dry
  const potMats = useMemo(() => {
    const out: { mat: THREE.MeshToonMaterial; base: THREE.Color }[] = []
    const pot = scene.getObjectByName('Pot')
    pot?.traverse((m) => {
      if (m instanceof THREE.Mesh && !m.name.endsWith('_outline') && m.material instanceof THREE.MeshToonMaterial) {
        const mat = m.material.clone()
        m.material = mat
        out.push({ mat, base: mat.color.clone() })
      }
    })
    return out
  }, [scene])
  /** how hot the empty pot has got (0..1), and how scorched its floor is (stays) */
  const dry = useRef(0)
  const scorch = useRef(0)
  const box = useMemo(() => new THREE.Box3(), [])

  const raw = useMemo(() => new THREE.Color(), [])
  const done = useMemo(() => new THREE.Color(), [])
  const lastTip = useRef('')
  const aiClock = useRef(0)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    sync()
    const g = group.current
    const T = temp.current
    // how fast things cook: nothing below ~70°C, full speed at the boil
    const rate = Math.max(0, (T - COOK_FROM) / (BOIL - COOK_FROM)) ** 1.5
    const boiling = T >= BOIL - 1
    const time = state.clock.elapsedTime
    // an empty pot on the flame heats fast (nothing to soak the heat up) and cools slowly off it
    dry.current = soup ? Math.max(0, dry.current - dt * 0.2)
      : Math.min(1, Math.max(0, dry.current + (heat / 100) * dt * 0.06 - (heat === 0 ? dt * 0.01 : 0)))
    if (!soup && dry.current > 0.45) scorch.current = Math.min(1, scorch.current + (dry.current - 0.45) * dt * 0.05)
    // (the soup does cover it up, though: a scorched floor shows only in an empty pot)
    for (const { mat, base } of potMats) mat.color.copy(base).lerp(SCORCH_COLOR, soup ? 0 : scorch.current * 0.75)
    if (smoke) smoke.current = !soup && dry.current > 0.5 ? (dry.current - 0.5) * 2 * Math.min(1, heat / 40) : 0

    // where each piece comes to rest in an empty pot: on the floor (rising at the rounded edge), or on top of a
    // piece already lying under it
    const resting: { minX: number; maxX: number; minZ: number; maxZ: number; top: number }[] = []
    const settleOrder = [...foods.current.values()].filter((f) => !f.inBowl && f.node.visible && f.node.scale.x > 0.001)
      .sort((a, b) => (a.node.position.y - a.drop) - (b.node.position.y - b.drop))
    const support = new Map<Food, number>()
    for (const f of settleOrder) {
      box.setFromObject(f.node)
      const py = f.node.parent!.getWorldPosition(new THREE.Vector3()).y
      const rel = box.min.y - py - f.node.position.y                    // the piece's underside below its origin
      const r = Math.hypot(f.node.position.x, f.node.position.z)
      const edge = r > FLOOR_FLAT_R ? FLOOR_CORNER - Math.sqrt(Math.max(0, FLOOR_CORNER ** 2 - (r - FLOOR_FLAT_R) ** 2)) : 0
      let under = floorY + edge
      const half = { x: (box.max.x - box.min.x) / 2, z: (box.max.z - box.min.z) / 2 }
      const cx = (box.min.x + box.max.x) / 2
      const cz = (box.min.z + box.max.z) / 2
      for (const q of resting) {
        if (cx + half.x * 0.7 > q.minX && cx - half.x * 0.7 < q.maxX && cz + half.z * 0.7 > q.minZ && cz - half.z * 0.7 < q.maxZ) {
          under = Math.max(under, q.top)
        }
      }
      const height = box.max.y - box.min.y
      // the drop that puts its underside on what's below
      const want = under - (f.node.position.y - f.drop + rel)
      support.set(f, want)
      resting.push({ minX: cx - half.x, maxX: cx + half.x, minZ: cz - half.z, maxZ: cz + half.z, top: under + height * 0.85 })
    }
    for (const f of foods.current.values()) {
      const shown = f.node.visible && f.node.scale.x > 0.001
      if (!shown && !f.node.userData.onPlate) {
        f.cook = 0
        f.char = 0
        continue
      }
      // taken off the order: back into the pot, raw, for next time
      if (!f.node.visible && f.node.userData.onPlate) {
        f.inBowl = false
        f.eat = 0
        f.cook = 0
        f.char = 0
        f.ai = false
        f.node.userData.onPlate = false
        f.node.userData.shrink = 1
        f.node.position.copy(f.homeP)
        f.node.quaternion.copy(f.homeQ)
        continue
      }
      if (!f.inBowl) {
        f.cook += (rate * dt) / (COOK_TIME[f.id] ?? 60)
        if (soup) {
          // floating: carried back up to the surface, bobbing on the bubbles of a rolling boil
          const bob = boiling ? Math.sin(time * 5 + f.phase) * 0.012 : 0
          f.drop += (bob - f.drop) * Math.min(1, dt * 2.5)
          f.vy = 0
        } else {
          // nothing to float in: it falls, lands on the floor or on another piece, bounces a little and lies there
          const want = support.get(f) ?? f.drop
          if (f.drop > want + 1e-4) {
            f.vy -= GRAVITY * dt
            f.drop += f.vy * dt
            if (f.drop <= want) {
              f.drop = want
              f.vy = Math.abs(f.vy) > 0.4 ? -f.vy * 0.2 : 0
            }
          } else {
            f.drop = want
            if (f.vy < 0) f.vy = 0
            else if (f.vy > 0) f.drop += f.vy * dt
          }
          // lying on a dry, hot pot it fries, then burns
          if (dry.current > 0.35) {
            f.char = Math.min(1, f.char + (dry.current - 0.35) * dt * 0.12)
            f.cook += dry.current * dt * 0.05
          }
        }
        f.node.userData.bob = f.drop
      } else if (g) {
        f.node.userData.bob = 0
        // lifted out of the soup in a little arc into the bowl, where the pieces sit side by side
        f.flight = Math.min(1, f.flight + dt * 2.2)
        const a = f.slot * 2.4
        const rr = f.slot === 0 ? 0 : 0.09
        const local = BOWL_AT.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0.07 + Math.floor(f.slot / 6) * 0.04, Math.sin(a) * rr))
        const to = f.node.parent!.worldToLocal(g.localToWorld(local))
        const k = f.flight * f.flight * (3 - 2 * f.flight)
        f.node.position.lerpVectors(f.from, to, k)
        f.node.position.y += Math.sin(k * Math.PI) * 0.35
        if (f.eat === 0) f.node.userData.shrink = 1 + (f.fit - 1) * k
        // being eaten: a couple of quick bites' worth of squash, then gone
        if (f.eat > 0) {
          f.eat += dt
          const chew = Math.max(0, 1 - f.eat / 0.5)
          f.node.userData.shrink = f.fit * Math.max(0.0001, chew) * (1 + Math.sin(f.eat * 40) * 0.08 * chew)
        }
      }
      const c = Math.min(1, f.cook)
      const look = LOOK[f.id] ?? LOOK_DEFAULT
      raw.set(look[0])
      done.set(look[1])
      const mul = raw.lerp(done, c)
      for (const { mat, base } of f.mats) mat.color.copy(base).multiply(mul).lerp(CHAR_COLOR, f.char * 0.85)
    }
    // customers fish out what they ordered once it's cooked, one piece at a time, and eat it from the bowl
    aiClock.current += dt
    if (aiWanted.length && aiClock.current > aiPace * 1.8) {
      aiClock.current = 0
      const busy = [...foods.current.values()].some((f) => f.ai && f.eat === 0)
      const pick = busy ? null : [...foods.current.values()].find((f) => !f.inBowl && f.eat === 0 && f.node.visible &&
        f.node.scale.x > 0.01 && aiWanted.includes(f.id) && f.cook >= 1 && f.cook < 2.3 && f.char < 0.35)
      if (pick && g) {
        pick.inBowl = true
        pick.ai = true
        pick.flight = 0
        pick.from.copy(pick.node.position)
        const taken = new Set(inBowl().map((x) => x.slot))
        let n = 0
        while (taken.has(n)) n++
        pick.slot = n
        pick.node.userData.onPlate = true
        const size = new THREE.Box3().setFromObject(pick.node).getSize(new THREE.Vector3())
        pick.fit = Math.min(1, 0.26 / Math.max(size.x, size.z))
      }
    }
    for (const f of foods.current.values()) {
      if (f.ai && f.inBowl && f.flight >= 1 && f.eat === 0) {
        f.eat = 0.0001
        onGuestEat?.(f.id, taste(f))
      }
    }

    const h = hovered.current
    if (h) {
      const text = doneness(h)
      const key = `${h.node.uuid}:${text}:${taste(h)}`
      if (key !== lastTip.current) {
        lastTip.current = key
        const at = h.node.getWorldPosition(new THREE.Vector3())
        if (g) g.worldToLocal(at)
        setTip({ at: [at.x, at.y + 0.3, at.z], text, taste: taste(h) })
      }
    } else lastTip.current = ''
  })

  return (
    <group ref={group}>
      <Bowl />
      {/* what's been mixed into your bowl to dip in: a little pool at the bottom, its colour from the sauces */}
      {dip.length > 0 && (
        <mesh position={[BOWL_AT.x, 0.075, BOWL_AT.z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.17, 32]} />
          <meshToonMaterial color={dip.reduce((c, id) => c.lerp(new THREE.Color(SAUCES.find((x) => x.id === id)!.color), 0.5),
            new THREE.Color(SAUCES.find((x) => x.id === dip[0])!.color))} />
        </mesh>
      )}
      <group name="rice">
        {riceLeft.map((left, i) => (
          <RiceBowl key={i} index={i} left={left} at={RICE_AT.clone().addScaledVector(RICE_STEP, i)} />
        ))}
      </group>
      <SauceStation chosen={dip} />
      {active && sauceTip && (
        <Html position={sauceTip.at} center zIndexRange={[35, 25]} style={{ pointerEvents: 'none' }}>
          <span className="taste-tip">{sauceTip.text}</span>
        </Html>
      )}
      {active && tip && (
        <Html position={tip.at} center zIndexRange={[35, 25]} style={{ pointerEvents: 'none' }}>
          <span className="taste-tip">{tip.text}・美味 <b>{tip.taste}</b></span>
        </Html>
      )}
    </group>
  )
}
