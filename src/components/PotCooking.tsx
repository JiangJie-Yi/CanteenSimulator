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
}

const taste = (f: Food) => {
  const r = f.cook
  if (r < 1) return Math.round(10 + r * 30)
  if (r < 1.6) return Math.round(72 + (r - 1) * 25)           // just done: at its best
  if (r < 3) return Math.round(87 - (r - 1.6) * 22)           // falling apart, chewy, washed out
  return 55
}
const doneness = (f: Food) => (f.cook < 1 ? '生' : f.cook < 2.4 ? '熟' : '過熟')

/** a hand-thrown rice bowl, glazed inside, unglazed foot */
function Bowl() {
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
    <group position={BOWL_AT} name="bowl">
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

type Props = {
  url: string
  itemIds: string[]
  temp: MutableRefObject<number>
  active: boolean
  onEat?: (id: string, taste: number) => void
  onNotice?: (what: 'notCooked') => void
}

export function PotCooking({ url, itemIds, temp, active, onEat, onNotice }: Props) {
  const { scene } = useGLTF(url)
  const { camera, gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const foods = useRef(new Map<string, Food>())
  const ids = useMemo(() => new Set(itemIds), [itemIds])
  const [tip, setTip] = useState<{ at: [number, number, number]; text: string; taste: number } | null>(null)
  const hovered = useRef<Food | null>(null)

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
        eat: 0, fit: 1, homeP: o.position.clone(), homeQ: o.quaternion.clone(), mats, phase: Math.random() * Math.PI * 2 })
    })
  }

  const inBowl = () => [...foods.current.values()].filter((f) => f.inBowl && f.eat === 0)

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
      // (a click on the bowl itself takes the piece on top)
      const bowl = group.current?.getObjectByName('bowl')
      const f = pick() ?? (bowl && ray.intersectObject(bowl, true).length
        ? inBowl().filter((x) => x.flight >= 1).sort((a, b) => b.slot - a.slot)[0] ?? null : null)
      if (!f) return
      if (f.inBowl) {
        if (f.flight < 1) return
        f.eat = 0.0001
        onEat?.(f.id, taste(f))
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
      const f = pick()
      const bowl = group.current?.getObjectByName('bowl')
      const onBowl = !f && !!bowl && ray.intersectObject(bowl, true).length > 0 && inBowl().length > 0
      if (!f) el.style.cursor = onBowl ? 'pointer' : ''
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
  }, [active, gl, camera, onEat, onNotice])

  const raw = useMemo(() => new THREE.Color(), [])
  const done = useMemo(() => new THREE.Color(), [])
  const lastTip = useRef('')
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    sync()
    const g = group.current
    const T = temp.current
    // how fast things cook: nothing below ~70°C, full speed at the boil
    const rate = Math.max(0, (T - COOK_FROM) / (BOIL - COOK_FROM)) ** 1.5
    const boiling = T >= BOIL - 1
    const time = state.clock.elapsedTime
    for (const f of foods.current.values()) {
      const shown = f.node.visible && f.node.scale.x > 0.001
      if (!shown && !f.node.userData.onPlate) {
        f.cook = 0
        continue
      }
      // taken off the order: back into the pot, raw, for next time
      if (!f.node.visible && f.node.userData.onPlate) {
        f.inBowl = false
        f.eat = 0
        f.cook = 0
        f.node.userData.onPlate = false
        f.node.userData.shrink = 1
        f.node.position.copy(f.homeP)
        f.node.quaternion.copy(f.homeQ)
        continue
      }
      if (!f.inBowl) {
        f.cook += (rate * dt) / (COOK_TIME[f.id] ?? 60)
        // bobbing on the bubbles of a rolling boil
        f.node.userData.bob = boiling ? Math.sin(time * 5 + f.phase) * 0.012 : 0
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
      for (const { mat, base } of f.mats) mat.color.copy(base).multiply(mul)
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
      {active && tip && (
        <Html position={tip.at} center zIndexRange={[35, 25]} style={{ pointerEvents: 'none' }}>
          <span className="taste-tip">{tip.text}・美味 <b>{tip.taste}</b></span>
        </Html>
      )}
    </group>
  )
}
