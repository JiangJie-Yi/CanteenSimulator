import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Look as StaffLook, Role } from '@/data/staff'
import { inkTogether } from './inkHull'
import { airbrush, gradientMap } from './Person3D'
import { bakeable, keyOf } from './StaticBatch'

/*
 * The staff, made as the boss is (blender/boss.py with CREW=<variant>): an Overcooked cook's big round head on a short plump body rounding
 * off underneath, floating mitten hands, the boss's height. Dressed for the job: the cooks in the white kappōgi and cap, the men out front
 * in an indigo samue under a white hachimaki, the women in a plum kimono and gold obi with their hair up, the stock keeper in khaki work
 * clothes. Skin and hair as their pictures in the office have them (ui/Avatar.tsx, the same hash of their id), glasses on the same ones.
 *
 * Each figure is drawn in a handful of meshes: the body's parts merged by material, the eyes, the glasses and each hand on their own (they
 * move or come and go); inked once per variant, then copied. Every plain-coloured piece (no picture on it: the cord, the collar, the brows,
 * the towel...) is one material with its colour carried by its vertices, so they're a single draw; the skin and hair (each person's own)
 * and the printed cloth keep theirs. Each part's ink is one line round all of it.
 */
type Variant = 'chef' | 'chefF' | 'server' | 'serverF' | 'stock'
const url = (v: Variant) => import.meta.env.BASE_URL + `models/crew_${v}.glb`
const VARIANTS: Variant[] = ['chef', 'chefF', 'server', 'serverF', 'stock']
const variantOf = (role: Role, female: boolean): Variant =>
  role === 'chef' || role === 'sous' ? (female ? 'chefF' : 'chef') : role === 'stock' ? 'stock' : female ? 'serverF' : 'server'

/** the small parts: no ink line round them */
const UNINKED = /(Eye|Shine|Brow|Cheek|Mouth|Tongue|Print|Collar|Knot|Cord|Nose|Thumb|Glass|Hem|Fan|Comb|Towel)/
/** where a server's tray is held, and the stock keeper's clipboard: on the hands, out in front of the belly (the figure's frame) */
export const TRAY_AT: [number, number, number] = [0, 0.4, 0.36]
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }

const AV_SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const AV_HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020', '#6b4a32']
const avHash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

type Built = { root: THREE.Group; skin: THREE.MeshToonMaterial; hair: THREE.MeshToonMaterial }
const made = new Map<Variant, Built>()

/** which part of the figure a mesh belongs to, by its node's name (or an ancestor's) */
function partOf(o: THREE.Object3D): 'handL' | 'handR' | 'fan' | 'eyes' | 'glasses' | 'drop' | 'body' {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    const n = p.name
    if (/^BossHandL/.test(n)) return 'handL'
    if (/^BossHandR/.test(n)) return 'handR'
    if (/^BossFan/.test(n)) return 'fan'
    if (/^BossTongs|^BossMouthOpen|^BossMouthTongue/.test(n)) return 'drop'
    if (/^BossGlass/.test(n)) return 'glasses'
    if (/^BossEye/.test(n)) return 'eyes'
  }
  return 'body'
}

/** a geometry's every vertex given the colour (as the material has it: linear), for the one material all plain pieces share */
function colourVertices(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
}

/** the variant's figure, built once: its materials the people's soft paint, its parts merged, inked */
function build(scene: THREE.Group): Built {
  scene.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
  const mats = new Map<THREE.Material, THREE.Material>()
  let skin: THREE.MeshToonMaterial | null = null, hair: THREE.MeshToonMaterial | null = null
  // (the plain pieces' one material each way they're painted: soft toon, and flat for the eyes' whites and darks)
  const plainToon = airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap }))
  const plainFlat = new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true })
  const paint = (src: THREE.MeshStandardMaterial) => {
    let t = mats.get(src)
    if (!t) {
      t = /White|Dark/.test(src.name)
        ? new THREE.MeshBasicMaterial({ color: src.color.clone() })
        : airbrush(new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, gradientMap }))
      if (/CrewSkin/.test(src.name)) skin = t as THREE.MeshToonMaterial
      if (/CrewHair/.test(src.name)) hair = t as THREE.MeshToonMaterial
      mats.set(src, t)
    }
    return t
  }
  // (each part's meshes gathered by material, inked or not)
  const parts = new Map<string, Map<string, { mat: THREE.Material; inked: boolean; geos: THREE.BufferGeometry[] }>>()
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const part = partOf(m)
    if (part === 'drop') return
    const src = m.material as THREE.MeshStandardMaterial
    const mat = paint(src)
    const inked = !UNINKED.test(m.name)
    const plain = !src.map && !src.transparent && src.opacity === 1 && mat !== skin && mat !== hair
    const use = plain ? (mat instanceof THREE.MeshBasicMaterial ? plainFlat : plainToon) : mat
    const key = `${keyOf(use)}|${use.uuid}|${inked}`
    const byMat = parts.get(part) ?? new Map()
    const g = byMat.get(key) ?? { mat: use, inked, geos: [] }
    const geo = bakeable(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    if (plain) colourVertices(geo, (mat as THREE.MeshToonMaterial | THREE.MeshBasicMaterial).color)
    g.geos.push(geo)
    byMat.set(key, g)
    parts.set(part, byMat)
  })
  const root = new THREE.Group()
  for (const [part, byMat] of parts) {
    const holder = new THREE.Group()
    holder.name = part
    // (a hand is moved about its own middle: its meshes set round the place it hangs at rest; the eyes about theirs, to close)
    let at: THREE.Vector3 | null = part === 'handL' ? REST.L : part === 'handR' ? REST.R : null
    if (part === 'eyes') {
      const bb = new THREE.Box3()
      for (const { geos } of byMat.values()) for (const g of geos) { g.computeBoundingBox(); bb.union(g.boundingBox!) }
      at = bb.getCenter(new THREE.Vector3())
    }
    for (const { mat, inked, geos } of byMat.values()) {
      const geo = mergeGeometries(geos)
      for (const x of geos) x.dispose()
      if (!geo) continue
      if (at) geo.translate(-at.x, -at.y, -at.z)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = inked
      mesh.receiveShadow = true
      mesh.userData.uninked = !inked
      holder.add(mesh)
    }
    if (at) holder.position.copy(at)
    // (one ink line round the whole part, whatever it's painted with)
    const hull = inkTogether(holder.children.filter((o) => !o.userData.uninked) as THREE.Mesh[], { width: 0.006, weld: true })
    if (hull) holder.add(hull)
    root.add(holder)
  }
  return { root, skin: skin!, hair: hair! }
}

/**
 * Someone working in the shop at their place: a cook at the fire (fanning the coals now and then), a server holding a tray out on both
 * hands, the cashier with their hands together, the stock keeper with his clipboard; `moving`: walking somewhere (a server carrying a
 * plate, the stock keeper a case). Faces +z, stands on y 0.
 */
// (drawn again only when its own props change: the staff stand in parents that redraw several times a second, and they move by their own frames)
export const StaffFigure = memo(StaffFigureImpl)
function StaffFigureImpl({ id, role, look: who, moving = false, seated = false }: { id: string; role: Role; look: StaffLook; moving?: boolean
  /** sat (the cashier on the till's chair): leaning in a little, the hands up on the counter in front, now and then tapping at the keys */
  seated?: boolean }) {
  const h = avHash(id)
  const seed = h % 997
  const cook = role === 'chef' || role === 'sous'
  const v = variantOf(role, who.female)
  const gltf = useGLTF(url(v)) as unknown as { scene: THREE.Group }
  const fig = useMemo(() => {
    if (!made.has(v)) made.set(v, build(gltf.scene))
    const base = made.get(v)!
    const root = base.root.clone(true)
    // (their own skin and hair, the rest shared with the others in the same clothes)
    const old = who.age === 'old'
    const skin = base.skin.clone(), hair = base.hair.clone()
    skin.color.set(AV_SKIN[h % AV_SKIN.length])
    hair.color.set(old ? ((h >> 4) & 1 ? '#d6d1c8' : '#a9a49c') : AV_HAIR[(h >> 3) % AV_HAIR.length])
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (m.material === base.skin) m.material = skin
      else if (m.material === base.hair) m.material = hair
    })
    const glasses = (h >> 7) % 5 === 0 || (old && (h >> 7) % 2 === 0)
    const get = (n: string) => root.getObjectByName(n) ?? null
    const g = get('glasses')
    if (g) g.visible = glasses
    return { root, body: root, handL: get('handL'), handR: get('handR'), fan: get('fan'), eyes: get('eyes') }
  }, [gltf, v, h, who.age])
  // (a cook fans the fire only now and then: a spell of it, the fan in hand, then put down; each to their own times)
  const [fanning, setFanning] = useState(false)
  const clock = useRef(0)
  const outer = useRef<THREE.Group>(null)
  const last = useRef<THREE.Vector3 | null>(null)
  const pace = useRef(0)
  useEffect(() => { if (fig.fan) fig.fan.visible = false }, [fig])
  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta)
    const t = (clock.current += dt)
    const o = outer.current
    if (!o) return
    // (walking or not: by how far they've gone since the last frame)
    const at = o.getWorldPosition(new THREE.Vector3())
    const step = last.current ? Math.hypot(at.x - last.current.x, at.z - last.current.z) / Math.max(dt, 1e-3) : 0
    last.current = at
    pace.current += (Math.min(1, step / 0.6) - pace.current) * Math.min(1, dt * 8)
    const walk = pace.current
    if (cook) {
      const f = (t + seed * 3.7) % 17 < 6 && !moving
      if (f !== fanning) setFanning(f)
    }
    // (a waddle as they walk, as Overcooked's cooks do: bobbing at each step, rocking side to side; standing, breathing)
    const ph = t * 9
    fig.body.position.y = walk * Math.abs(Math.sin(ph)) * 0.035
    fig.body.rotation.z = walk * Math.sin(ph) * 0.07
    fig.body.rotation.x = walk * 0.08 + (seated ? 0.07 : 0)
    fig.body.scale.y = 1 + (1 - walk) * Math.sin(t * 2 + seed) * 0.008
    const hold = role === 'server' || role === 'stock' ? 1 : role === 'cashier' ? 0.6 : 0
    for (const [hand, rest, sd] of [[fig.handL, REST.L, -1], [fig.handR, REST.R, 1]] as const) {
      if (!hand) continue
      if (seated) {
        // (on the counter in front, a little apart; a spell of tapping at the keys every so often, a hand at a time)
        const tap = (t + seed) % 7 < 2.2 ? Math.max(0, Math.sin(t * 14 + (sd > 0 ? Math.PI : 0))) * 0.03 : 0
        hand.position.set(sd * 0.15, 0.4 + tap, 0.34)
        hand.rotation.set(-0.5, 0, 0)
        continue
      }
      // (held out in front (a tray, a clipboard), together at the front (the cashier), swinging as they walk, or the fan waved)
      const swing = walk * Math.sin(ph + (sd > 0 ? Math.PI : 0)) * 0.07
      const out = new THREE.Vector3(sd * (hold === 1 ? 0.13 : 0.12), hold === 1 ? TRAY_AT[1] - 0.04 : 0.22, hold === 1 ? TRAY_AT[2] - 0.02 : 0.26)
      hand.position.lerpVectors(rest, out, hold).add(new THREE.Vector3(0, 0, hold === 1 ? 0 : swing))
      hand.rotation.x = hold === 1 ? -1.1 : 0
      if (cook && fanning && sd > 0) {
        hand.position.set(0.3, 0.42 + Math.sin(t * 7) * 0.03, 0.18)
        hand.rotation.z = Math.sin(t * 7) * 0.4
      } else hand.rotation.z = 0
    }
    if (fig.fan && fig.handR) {
      fig.fan.visible = cook && fanning
      if (fig.fan.visible) { fig.fan.position.copy(fig.handR.position).add(new THREE.Vector3(0, 0.03, 0.02)); fig.fan.rotation.z = fig.handR.rotation.z }
    }
    // (a blink every few seconds)
    if (fig.eyes) fig.eyes.scale.y = (t + seed * 0.9) % 3.6 < 0.12 ? 0.1 : 1
  })
  return (
    <group ref={outer} userData={{ staffRole: role }}>
      <primitive object={fig.root} />
      {/* a server's round lacquered tray, a cup of tea on it, held level on the hands */}
      {role === 'server' && (
        <group position={TRAY_AT}>
          <mesh castShadow>
            <cylinderGeometry args={[0.1, 0.095, 0.014, 24]} />
            <meshToonMaterial color="#3a1a14" gradientMap={gradientMap} />
          </mesh>
          <mesh position={[0.03, 0.03, 0]}>
            <cylinderGeometry args={[0.024, 0.02, 0.05, 14]} />
            <meshToonMaterial color="#e8dcc0" gradientMap={gradientMap} />
          </mesh>
        </group>
      )}
      {/* the stock keeper's clipboard, held up in front, the stock list on it */}
      {role === 'stock' && !moving && (
        <group position={[TRAY_AT[0], TRAY_AT[1] + 0.04, TRAY_AT[2] - 0.02]} rotation-x={-0.6}>
          <mesh>
            <boxGeometry args={[0.12, 0.008, 0.16]} />
            <meshToonMaterial color="#c9a66b" gradientMap={gradientMap} />
          </mesh>
          <mesh position={[0, 0.005, 0.01]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.1, 0.12]} />
            <meshToonMaterial color="#f7f3ea" gradientMap={gradientMap} />
          </mesh>
        </group>
      )}
    </group>
  )
}

for (const v of VARIANTS) useGLTF.preload(url(v))
