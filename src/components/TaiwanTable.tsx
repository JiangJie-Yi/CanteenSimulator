import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WOK_KINDS, type MenuItem, type TableKind } from '../menu'

/*
 * 台式小吃: beside the noodle bowl, a low wooden table the other dishes are set out on — fried rice, rice plates,
 * gravy rice, fried noodles and vermicelli, boiled dumplings, a bamboo steamer of xiaolongbao, soups and soup
 * dumplings — and, on the other side, a wok on a roaring burner. Anything stir-fried goes through the wok first:
 * the flame leaps up, the wok tosses, the spatula works, and then the plate is set down on the table. A click on a
 * dish takes a bite (four to finish it); the last one counts as eaten.
 */

const LAY = new THREE.Vector3(0.59, 0, 0.81)
const ALONG = new THREE.Vector3(0.81, 0, -0.59)
const TABLE_AT = ALONG.clone().multiplyScalar(0.95).addScaledVector(LAY, 1.3)
const WOK_AT = ALONG.clone().multiplyScalar(-1.55).addScaledVector(LAY, -0.1)
const TABLE_W = 1.9
const TABLE_D = 1.2
/** dishes drawn bigger than life next to the bowl, so they read */
const FOOD_SCALE = 1.7
const TABLE_H = 0.22
const COOK_S = 3.6
const BITES = 4
const INK = '#3b2a20'
const YAW = Math.atan2(-ALONG.z, ALONG.x)

const toon = (c: string) => <meshToonMaterial color={c} />
function Ink({ geo, color, s = 1.05, ...rest }: { geo: THREE.BufferGeometry; color: string; s?: number } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geo} castShadow receiveShadow>{toon(color)}</mesh>
      <mesh geometry={geo} scale={s}><meshBasicMaterial color={INK} side={THREE.BackSide} /></mesh>
    </group>
  )
}

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const G = {
  plate: new THREE.CylinderGeometry(0.2, 0.15, 0.025, 32),
  deep: new THREE.LatheGeometry([[0.001, 0], [0.11, 0], [0.16, 0.06], [0.17, 0.08], [0.155, 0.08], [0.14, 0.06], [0.1, 0.012],
    [0.001, 0.012]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
  bowl: new THREE.LatheGeometry([[0.001, 0], [0.06, 0], [0.065, 0.01], [0.12, 0.08], [0.13, 0.11], [0.12, 0.11], [0.11, 0.085],
    [0.055, 0.02], [0.001, 0.018]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
  dome: new THREE.SphereGeometry(0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  disc: new THREE.CircleGeometry(0.115, 28),
  grain: new THREE.BoxGeometry(0.018, 0.01, 0.012),
  dumpling: (() => {
    const g = new THREE.SphereGeometry(0.035, 14, 10)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      // a half-moon: flattened underneath, a pinched ridge along the top
      p.setXYZ(i, x * 1.5, Math.max(-0.008, y) * (1 + 0.6 * Math.max(0, 1 - Math.abs(z) / 0.02)), z * 0.8)
    }
    g.computeVertexNormals()
    return g
  })(),
  bun: (() => {
    const g = new THREE.SphereGeometry(0.04, 16, 10)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const a = Math.atan2(z, x)
      const pleat = 1 + 0.06 * Math.cos(a * 12) * Math.max(0, y / 0.04)
      p.setXYZ(i, x * pleat, y > 0 ? y * 0.9 + Math.max(0, y - 0.02) * 0.8 : y * 0.45, z * pleat)
    }
    g.computeVertexNormals()
    return g
  })(),
  steamer: new THREE.CylinderGeometry(0.17, 0.17, 0.08, 32, 1, true),
  steamerFloor: new THREE.CircleGeometry(0.165, 28),
  noodle: new THREE.TorusGeometry(0.03, 0.006, 5, 16),
  vermicelli: new THREE.TorusGeometry(0.035, 0.0025, 4, 18),
  slice: new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12),
  chunk: new THREE.BoxGeometry(0.03, 0.022, 0.025),
}

/** what goes on top / in among, by kind, and its colours */
function Food({ item, left }: { item: MenuItem; left: number }) {
  const k = item.table!
  const hue = item.hue ?? '#d8b060'
  const fill = left / BITES                         // eaten down as it goes
  const bits = useMemo(() => {
    seed = item.id.length * 97 + 13
    return Array.from({ length: 26 }, () => ({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()), rot: rnd() * 3, c: rnd() }))
  }, [item.id])
  if (k === 'friedRice' || k === 'quick' || k === 'saucyRice') {
    return (
      <group>
        <Ink geo={G.plate} color="#f4f0e6" position-y={0.012} />
        <mesh geometry={G.dome} position-y={0.024} scale={[0.95 * (0.5 + 0.5 * fill), 0.6 * fill + 0.05, 0.95 * (0.5 + 0.5 * fill)]}>
          {toon(k === 'saucyRice' ? '#f4efe2' : hue)}
        </mesh>
        {/* gravy over the rice: a glossy pool spreading to the plate's rim */}
        {k === 'saucyRice' && (
          <mesh geometry={G.disc} rotation-x={-Math.PI / 2} position-y={0.03 + 0.04 * fill} scale={0.9 + 0.5 * fill}>
            <meshToonMaterial color={hue} transparent opacity={0.92} />
          </mesh>
        )}
        {/* egg, meat, scallion, carrot… through the rice (or the topping on a rice plate) */}
        {bits.slice(0, Math.round(26 * fill)).map((b, i) => (
          <mesh key={i} geometry={k === 'quick' && i < 8 ? G.slice : G.grain}
            position={[Math.cos(b.a) * b.r * 0.1, 0.035 + (1 - b.r) * 0.06 * fill, Math.sin(b.a) * b.r * 0.1]} rotation={[b.rot, b.rot * 2, 0]}>
            {toon(k === 'quick' && i < 8 ? hue : b.c < 0.3 ? '#f2d24a' : b.c < 0.55 ? '#7a4a2a' : b.c < 0.8 ? '#5fa040' : '#e8743a')}
          </mesh>
        ))}
      </group>
    )
  }
  if (k === 'friedNoodles' || k === 'vermicelli') {
    return (
      <group>
        <Ink geo={G.plate} color="#f4f0e6" position-y={0.012} />
        {bits.slice(0, Math.round(26 * fill)).map((b, i) => (
          <mesh key={i} geometry={k === 'vermicelli' ? G.vermicelli : G.noodle}
            position={[Math.cos(b.a) * b.r * 0.1, 0.03 + (1 - b.r) * 0.05, Math.sin(b.a) * b.r * 0.1]} rotation={[Math.PI / 2 + b.rot * 0.3, b.rot, 0]}>
            {toon(i % 7 === 0 ? '#5fa040' : i % 9 === 0 ? '#7a4a2a' : hue)}
          </mesh>
        ))}
      </group>
    )
  }
  if (k === 'dumplings') {
    const n = Math.min(10, Math.ceil((item.pieces ?? 10) * fill / ((item.pieces ?? 10) / 10)))
    return (
      <group>
        <Ink geo={G.plate} color="#f4f0e6" position-y={0.012} />
        {Array.from({ length: n }, (_, i) => {
          const ring = i < 6 ? 0 : 1
          const a = ring ? ((i - 6) / 4) * Math.PI * 2 + 0.4 : (i / 6) * Math.PI * 2
          const r = ring ? 0.045 : 0.12
          return (
            <mesh key={i} geometry={G.dumpling} position={[Math.cos(a) * r, 0.04 + ring * 0.025, Math.sin(a) * r]} rotation-y={-a}>
              {toon('#f6f1e2')}
            </mesh>
          )
        })}
      </group>
    )
  }
  if (k === 'xiaolongbao') {
    const n = Math.ceil((item.pieces ?? 8) * fill)
    return (
      <group>
        <Ink geo={G.steamer} color="#c8a064" position-y={0.04} s={1.03} />
        <mesh geometry={G.steamerFloor} rotation-x={-Math.PI / 2} position-y={0.006}>{toon('#a88050')}</mesh>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / Math.max(1, Math.min(n, 7))) * Math.PI * 2
          const r = i < 7 ? 0.1 : 0
          return <Ink key={i} geo={G.bun} color="#f8f3e6" s={1.06} position={[Math.cos(a) * r, 0.03, Math.sin(a) * r]} />
        })}
      </group>
    )
  }
  // soups (and soup dumplings): a bowl with the soup in it and what's floating in it
  return (
    <group>
      <Ink geo={G.bowl} color="#efe8d8" s={1.04} />
      <mesh geometry={G.disc} rotation-x={-Math.PI / 2} position-y={0.02 + 0.07 * fill} scale={0.62 + 0.42 * fill}>
        {toon(hue)}
      </mesh>
      {k === 'soupDumplings'
        ? Array.from({ length: Math.ceil(6 * fill) }, (_, i) => (
          <mesh key={i} geometry={G.dumpling} position={[Math.cos(i * 1.05) * 0.06, 0.025 + 0.07 * fill, Math.sin(i * 1.05) * 0.06]}
            rotation-y={i}>{toon('#f6f1e2')}</mesh>
        ))
        : bits.slice(0, Math.round(10 * fill)).map((b, i) => (
          <mesh key={i} geometry={G.chunk} position={[Math.cos(b.a) * b.r * 0.08, 0.025 + 0.07 * fill, Math.sin(b.a) * b.r * 0.08]}
            rotation-y={b.rot} scale={[1, 0.4, 1]}>{toon(b.c < 0.4 ? '#f4f0dc' : b.c < 0.7 ? '#5fa040' : '#e8c060')}</mesh>
        ))}
    </group>
  )
}

/** the wok on its burner: dark seasoned steel, a long handle, the spatula, and the flame */
function Wok({ cooking }: { cooking: boolean }) {
  const wok = useMemo(() => new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => {
    const t = i / 13
    return new THREE.Vector2(0.001 + Math.sin(t * Math.PI / 2) * 0.32, (1 - Math.cos(t * Math.PI / 2)) * 0.16)
  }), 40), [])
  const flame = useMemo(() => new THREE.ConeGeometry(1, 1, 16, 1, true), [])
  const pan = useRef<THREE.Group>(null)
  const spat = useRef<THREE.Group>(null)
  const fires = useRef<THREE.Mesh[]>([])
  const grains = useRef<THREE.InstancedMesh>(null)
  const heat = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    heat.current += ((cooking ? 1 : 0.18) - heat.current) * Math.min(1, dt * 4)
    const h = heat.current
    // tossing: the wok jerks forward and up, the rice flies and falls back
    const toss = cooking ? Math.max(0, Math.sin(t * 7)) : 0
    if (pan.current) {
      pan.current.position.set(0, 0.42 + toss * 0.05, toss * 0.04)
      pan.current.rotation.x = -toss * 0.18
    }
    if (spat.current) {
      spat.current.rotation.z = cooking ? Math.sin(t * 9) * 0.5 : 0.2
      spat.current.rotation.y = cooking ? Math.cos(t * 5) * 0.4 : 0
    }
    fires.current.forEach((m, i) => {
      if (!m) return
      // big roaring tongues of flame round the wok, flickering, far taller while cooking
      const f = 0.25 + h * (0.9 + 0.35 * Math.sin(t * 13 + i * 2.1) + 0.2 * Math.sin(t * 29 + i))
      m.scale.set(0.07 + h * 0.05, f * 0.55, 0.07 + h * 0.05)
      m.position.y = 0.3 + f * 0.27
    })
    const g = grains.current
    if (g) {
      for (let i = 0; i < g.count; i++) {
        const ph = (t * 1.4 + i * 0.137) % 1
        const a = i * 2.4
        const up = cooking ? Math.sin(ph * Math.PI) * (0.15 + (i % 5) * 0.03) : 0
        dummy.position.set(Math.cos(a) * 0.12 * (i % 3 === 0 ? 0.5 : 1), 0.5 + up + toss * 0.05, Math.sin(a) * 0.12 + toss * 0.04)
        dummy.scale.setScalar(cooking ? 1 : 0.001)
        dummy.updateMatrix()
        g.setMatrixAt(i, dummy.matrix)
      }
      g.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group position={WOK_AT}>
      {/* the burner: a heavy cast-iron stand */}
      <Ink geo={useMemo(() => new THREE.CylinderGeometry(0.3, 0.36, 0.3, 24), [])} color="#2e2c2a" position-y={0.15} s={1.03} />
      <mesh position-y={0.31} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.12, 0.28, 24]} />
        <meshToonMaterial color="#1a1918" />
      </mesh>
      {/* the flames: an inner blue ring and big orange tongues */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh key={i} ref={(m) => { if (m) fires.current[i] = m }} geometry={flame} position={[Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2]}>
            <meshBasicMaterial color={i % 2 ? '#ff8a1e' : '#ffcc3a'} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )
      })}
      <pointLight position={[0, 0.5, 0]} color="#ff9a3a" intensity={cooking ? 2.2 : 0.4} distance={2.4} decay={1.6} />
      <group ref={pan}>
        <Ink geo={wok} color="#2a2826" s={1.03} />
        <mesh position={[0, 0.16, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.3, 32]} />
          <meshToonMaterial color="#3a3836" side={THREE.DoubleSide} transparent opacity={0.0} />
        </mesh>
        {/* the long handle and the helper loop */}
        <mesh position={[0.5, 0.16, 0]} rotation-z={Math.PI / 2 - 0.15}>
          <cylinderGeometry args={[0.022, 0.026, 0.4, 10]} />
          <meshToonMaterial color="#5a3a20" />
        </mesh>
        <mesh position={[-0.33, 0.15, 0]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} />
          <meshToonMaterial color="#2a2826" />
        </mesh>
        <instancedMesh ref={grains} args={[G.grain, undefined, 40]}>
          <meshToonMaterial color="#efd890" />
        </instancedMesh>
      </group>
      {/* the spatula (鍋鏟) working in the wok */}
      <group ref={spat} position={[-0.05, 0.62, 0.1]}>
        <mesh position={[0, 0.16, 0]} rotation-z={0.5}>
          <cylinderGeometry args={[0.012, 0.012, 0.38, 8]} />
          <meshToonMaterial color="#6a4a2a" />
        </mesh>
        <mesh position={[0.1, -0.03, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.1, 0.008, 0.09]} />
          <meshToonMaterial color="#b8bec4" />
        </mesh>
      </group>
    </group>
  )
}

type Props = {
  items: MenuItem[]
  quantities: Record<string, number>
  active: boolean
  locked: boolean
  onEat?: (id: string, taste: number) => void
  /** the kitchen (the shop's chef) is at the wok right now */
  wokBusy?: boolean
  /** (shop open) what's ordered has been cooked by the kitchen already (at the wok, see wokBusy): it comes straight out */
  cooked?: boolean
}

type Dish = { key: string; id: string; left: number; ready: number }

export function TaiwanTable({ items, quantities, active, locked, onEat, wokBusy = false, cooked = false }: Props) {
  const tableItems = useMemo(() => items.filter((x) => x.table), [items])
  const [dishes, setDishes] = useState<Dish[]>([])
  const seq = useRef(0)
  // portions ordered and taken off: add dishes (stir-fried ones wait their turn at the wok), drop the extras
  useEffect(() => {
    setDishes((cur) => {
      let next = [...cur]
      const now = performance.now() / 1000
      let wokFree = Math.max(now, ...next.filter((d) => d.ready > now).map((d) => d.ready))
      for (const it of tableItems) {
        const want = quantities[it.id] ?? 0
        const have = next.filter((d) => d.id === it.id)
        for (let k = have.length; k < want; k++) {
          const wok = WOK_KINDS.includes(it.table as TableKind)
          const ready = wok && !cooked ? (wokFree += COOK_S) : now + 0.4
          next.push({ key: `${it.id}-${++seq.current}`, id: it.id, left: BITES, ready })
        }
        if (have.length > want) {
          const drop = new Set(have.slice(want).map((d) => d.key))
          next = next.filter((d) => !drop.has(d.key))
        }
      }
      return next
    })
  }, [quantities, tableItems, cooked])

  // (the clock only ticks while something's still at the wok or on its way to the table, not every frame for nothing)
  const [now, setNow] = useState(() => performance.now() / 1000)
  useFrame(() => {
    const t = performance.now() / 1000
    if (dishes.some((d) => d.ready > now)) setNow(t)
  })
  const cooking = wokBusy || dishes.some((d) => d.ready > now && d.ready - now < COOK_S && WOK_KINDS.includes(tableItems.find((x) => x.id === d.id)?.table as TableKind))
  const served = dishes.filter((d) => d.ready <= now && d.left > 0)

  // a click on a dish on the table takes a bite
  const { camera, gl } = useThree()
  const group = useRef<THREE.Group>(null)
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
        while (o && !o.userData.dish) o = o.parent
        const key = o?.userData.dish as string | undefined
        if (!key) continue
        setDishes((all) => all.map((d) => {
          if (d.key !== key || d.left <= 0) return d
          const left = d.left - 1
          if (left === 0) onEat?.(d.id, 72 + Math.round(Math.random() * 10))
          return { ...d, left }
        }))
        return
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [active, locked, camera, gl, onEat])

  return (
    <group>
      <Wok cooking={cooking} />
      {/* the low wooden table */}
      <group position={TABLE_AT} rotation-y={YAW} ref={group}>
        <Ink geo={useMemo(() => new THREE.BoxGeometry(TABLE_W, 0.05, TABLE_D), [])} color="#b07a44" position-y={TABLE_H} s={1.02} />
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
          <mesh key={i} position={[x * (TABLE_W / 2 - 0.08), TABLE_H / 2, z * (TABLE_D / 2 - 0.08)]} castShadow>
            <boxGeometry args={[0.06, TABLE_H, 0.06]} />
            <meshToonMaterial color="#6a4628" />
          </mesh>
        ))}
        {served.slice(0, 9).map((d, i) => {
          const it = tableItems.find((x) => x.id === d.id)!
          const col = i % 3
          const row = Math.floor(i / 3)
          return (
            <group key={d.key} userData={{ dish: d.key }} position={[(col - 1) * 0.6, TABLE_H + 0.026, (row - 1) * 0.38]} scale={FOOD_SCALE}>
              <Food item={it} left={d.left} />
            </group>
          )
        })}
      </group>
    </group>
  )
}
