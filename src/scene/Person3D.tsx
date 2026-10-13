import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { kindOf, type GuestKind } from '@/data/guests'
import type { Look as StaffLook, Role } from '@/data/staff'
import { cloth, type Pattern } from './patterns'

/*
 * A customer in 3D, toon-shaded with an ink outline: a chibi figure from blender/guests.py (public/models/guests.glb),
 * one of fifteen kinds (data/guests.ts) on a shared rig, sitting, eating or walking by its actions there. What they're
 * dressed in says what they are: the office worker's suit and tie, the schoolgirl's sailor collar and pleated
 * skirt, the boy's black gakuran, the old man's knit vest and glasses, the kid's yellow cap and randoseru, the
 * yukata and its obi, the uncle's aloha shirt and headband, the student's hoodie, the delinquent's
 * long gakuran and pompadour, the biker's tokkō coat and hachimaki,
 * the tourist's backpack, the civil servant's staff pass, the maid's apron and headdress…
 *
 * Each customer gets their own colours (skin, hair, clothes, shoes) and their clothes' cloth (scene/patterns.ts).
 * They blink, chew, and while waiting look about now and then.
 *
 * The figure stands (or sits) at its group's origin, facing +Z: sitting, the hips are on a stool top at 0.34.
 */

const URL = import.meta.env.BASE_URL + 'models/guests.glb'
const INK = new THREE.Color('#3b2a20')
const OUTLINE = 0.0035
const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0', '#c99470']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#5a3a2a']
const pick = <T,>(l: T[], n: number) => l[n % l.length]

type Look = { top: string; legs: string; hair: string; skin: string; shoes: string; size: number
  /** the cloth of what they wear on top, and on their legs (or skirt) */
  topCloth?: Pattern; legCloth?: Pattern }
/** the cook at the fire (the same rig as the customers, in his own clothes and his own action) */
type Kind = GuestKind | 'chef' | 'staffM' | 'staffF'
const CHEF_LOOK: Look = { top: '#2c3a58', legs: '#263049', hair: '#2b1d14', skin: '#e2b48c', shoes: '#2a2220', size: 1 }
function lookOf(id: number, kind: Kind): Look {
  if (kind === 'chef' || kind === 'staffM' || kind === 'staffF') return CHEF_LOOK
  const old = kind === 'grandma' || kind === 'grandpa'
  const top: Record<GuestKind, string> = {
    salaryman: '#2b3444', officeLady: '#6a6f78', highSchoolGirl: '#f4f1ea', highSchoolBoy: '#1c1e26', grandma: '#c9b48a',
    grandpa: '#7a5a3a', kid: pick(['#e85a4a', '#4a8ad8', '#f0c040'], id), uncle: pick(['#4a7a5a', '#a8432f', '#3d6a9a'], id),
    student: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), yukata: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
    yankee: pick(['#15161c', '#1c2440'], id), bosozoku: pick(['#f2efe8', '#4a2a5e', '#1a1a20'], id),
    tourist: pick(['#e8d24a', '#4aa8d8', '#e86a4a', '#f2f0ea'], id), civilServant: pick(['#4a4e56', '#3a4250'], id), maid: '#1c1c24',
  }
  return {
    top: top[kind],
    legs: kind === 'highSchoolGirl' ? '#23324a' : kind === 'officeLady' ? '#4a4f58' : kind === 'kid' ? '#2a4a7a'
      : kind === 'student' ? '#3a4a6a' : kind === 'grandma' ? '#5a4a3e' : kind === 'yukata' || kind === 'bosozoku' ? top[kind]
        : kind === 'yankee' ? '#15161c' : kind === 'tourist' ? '#a8946a' : kind === 'civilServant' ? top[kind] : kind === 'maid' ? '#1c1c24' : '#2f2f36',
    // (the rough lot bleach it, or dye it red-brown, as often as not)
    hair: kind === 'tourist' ? pick(['#e8cc80', '#b07a40', '#c0602a', '#2b1d14'], id) : kind === 'maid' ? pick(['#e88ab0', '#1c1c22', '#8a5a3a', '#e8cc80', '#a8c8e8'], id)
      : old ? '#d4d4d4' : kind === 'yankee' || kind === 'bosozoku' ? pick(['#e2b85a', '#1c1c22', '#a8542a'], id) : pick(HAIR, id * 3),
    // (a visitor from abroad as like as not fairer, or darker, than anyone local)
    skin: kind === 'tourist' ? pick(['#f8e2d0', '#f6d8c4', '#8a5a3a', '#c99470'], id) : pick(SKIN, id * 7 + 1),
    shoes: kind === 'maid' ? '#1a1a1a' : kind === 'student' || kind === 'kid' || kind === 'tourist' ? '#f2f0ea' : kind === 'yukata' ? '#b08a5a' : '#2a2220',
    size: kind === 'kid' ? 0.78 : kind === 'grandma' ? 0.93 : 1,
    topCloth: ({ salaryman: 'pinstripe', officeLady: 'glen', grandma: 'floret', grandpa: 'knit', kid: 'border', uncle: 'hibiscus',
      student: 'plaid', yukata: 'asanoha' } as Partial<Record<GuestKind, Pattern>>)[kind],
    legCloth: ({ salaryman: 'pinstripe', officeLady: 'glen', yukata: 'asanoha' } as Partial<Record<GuestKind, Pattern>>)[kind],
  }
}

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

/** an ink outline that bends with the figure: its back faces pushed out along the (skinned) normals */
const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: { uWidth: { value: OUTLINE }, uColor: { value: INK } },
  vertexShader: /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    uniform float uWidth;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed + normalize(objectNormal) * uWidth, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  side: THREE.BackSide,
})

/** a skinned part's geometry, ready to merge with the others: the same attributes, of the same types, all indexed */
function skinnable(o: THREE.SkinnedMesh, into: THREE.SkinnedMesh) {
  const src = o.geometry
  const g = new THREE.BufferGeometry()
  const n = src.attributes.position.count
  g.setAttribute('position', src.attributes.position.clone())
  g.setAttribute('normal', src.attributes.normal ? src.attributes.normal.clone() : new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const uv = src.attributes.uv
  g.setAttribute('uv', uv ? uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  const si = src.attributes.skinIndex, sw = src.attributes.skinWeight
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from({ length: n * 4 }, (_, i) => si.getComponent(Math.floor(i / 4), i % 4)), 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from({ length: n * 4 }, (_, i) => sw.getComponent(Math.floor(i / 4), i % 4)), 4))
  g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i))
  // (into the bind space of the one it's merged with, should theirs differ)
  if (!o.bindMatrix.equals(into.bindMatrix)) g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(into.bindMatrixInverse, o.bindMatrix))
  return g
}
/** the parts swapped in and out as they blink and chew (kept apart, not merged) */
const SWAPPED = new Set(['eyes', 'eyesShut', 'mouth', 'mouthOpen'])
/** the parts drawn without an outline (things lying on the surface, and fine ones) */
const FLAT = /^(eyes|eyesShut|face|mouth|mouthOpen|details|cuffs|glasses|pin)/

const UP = new THREE.Vector3(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion()

const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k) }

type Rigged = {
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  actions: Record<string, THREE.AnimationAction>
  head?: THREE.Bone
  handL?: THREE.Bone
  hand?: THREE.Bone
  eyes: THREE.Object3D[]
  shut: THREE.Object3D[]
  mouth: THREE.Object3D[]
  open: THREE.Object3D[]
  /** the head as the action left it, and as it was turned to look about */
  posed: THREE.Quaternion
  looked: THREE.Quaternion
}

/** a soft round glow, for a phone's screen */
const SCREEN_GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.3)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()

/** a black leather briefcase hanging from its handle (the handle at the origin, the case below along +y) */
function Briefcase() {
  return (
    <group>
      <mesh position-y={0.012} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.012, 0.003, 6, 12, Math.PI]} />
        <meshToonMaterial color="#1a1410" gradientMap={gradientMap} />
      </mesh>
      <mesh position-y={0.065}>
        <boxGeometry args={[0.028, 0.1, 0.14]} />
        <meshToonMaterial color="#2a1e16" gradientMap={gradientMap} />
      </mesh>
      <mesh position-y={0.065} scale={[1.15, 1.05, 1.04]}>
        <boxGeometry args={[0.028, 0.1, 0.14]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {[-0.035, 0.035].map((z) => (
        <mesh key={z} position={[0, 0.024, z]}>
          <boxGeometry args={[0.031, 0.012, 0.014]} />
          <meshToonMaterial color="#c8b070" gradientMap={gradientMap} />
        </mesh>
      ))}
    </group>
  )
}

/** a number from 0 to 1 that's always the same for this id (and this salt), spread so neighbours differ */
const hash = (id: number, salt: number) => {
  let h = Math.imul(id ^ Math.imul(salt + 1, 0x9e3779b1), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000
}

/**
 * One customer's copy of the figures: only their kind kept, in their colours, with outlines; one of the kind's ways
 * of wearing its hair (the parts named "<part>_<style>": the style picked by id, or given), and their head a touch
 * wider or narrower, longer or shorter than the next one's.
 */
function useRigged(id: number, kind: Kind, glasses: boolean,
  given?: { look?: Look; style?: (styles: string[]) => string; show?: (part: string) => boolean }): Rigged {
  const gltf = useGLTF(URL)
  const lookGiven = given?.look
  const styleGiven = given?.style
  const showGiven = given?.show
  const r = useMemo(() => {
    const l = lookGiven ?? lookOf(id, kind)
    // (clone only this kind's figure: the others' parts are lifted off the source for the moment of the copy, and
    // put back. A copy of all eighteen kinds would be thrown mostly away at once, at every customer that came in)
    const others: [THREE.Object3D, THREE.Object3D][] = []
    gltf.scene.traverse((o) => {
      const p = o.parent
      if (p && (p.name === 'Rig' || p.name === 'Guests') && !(o instanceof THREE.Bone) && o.name !== 'Rig' && !o.name.startsWith(kind)
        && (o instanceof THREE.Mesh || o.children.some((c) => c instanceof THREE.Mesh))) others.push([o, p])
    })
    for (const [o] of others) o.removeFromParent()
    const root = cloneSkinned(gltf.scene)
    for (const [o, p] of others) p.add(o)
    // (three drops the dots from glTF names: "salaryman.body" is "salarymanbody")
    const partOf = (o: THREE.Object3D): string | null => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) {
        if (p.name.startsWith(kind)) return p.name.slice(kind.length)
        if (p.name === 'Rig' || p.name === 'Guests') return null
      }
      return null
    }
    const drop: THREE.Object3D[] = []
    const keep: { o: THREE.SkinnedMesh; inked: boolean }[] = []
    const eyes: THREE.Object3D[] = [], shut: THREE.Object3D[] = [], mouth: THREE.Object3D[] = [], open: THREE.Object3D[] = []
    const mats = new Map<string, THREE.MeshToonMaterial>()
    const toon = (src: THREE.MeshStandardMaterial) => {
      const name = src.name
      if (!mats.has(name)) {
        const m = new THREE.MeshToonMaterial({ name, color: src.color.clone(), gradientMap, transparent: src.transparent, opacity: src.opacity,
          depthWrite: !src.transparent })
        const pattern = name === 'Top' ? l.topCloth : name === 'Bottom' ? l.legCloth : undefined
        const colour = ({ Skin: l.skin, Hair: l.hair, Top: l.top, Bottom: l.legs, Shoes: l.shoes } as Record<string, string>)[name]
        if (colour) m.color.set(colour)
        if (pattern) {
          m.map = cloth(pattern, colour!, [1, 1])
          m.color.set('#ffffff')
        }
        mats.set(name, m)
      }
      return mats.get(name)!
    }
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o) })
    // (a part's name is "<part>", or "<part>_<style>" for one of the hair styles; three adds "_<n>" to each piece of a
    // mesh of several materials)
    const nameOf = (o: THREE.Object3D) => partOf(o)?.replace(/_\d+$/, '') ?? null
    const styles = [...new Set(meshes.map(nameOf).filter((p): p is string => !!p && p.includes('_')).map((p) => p.split('_')[1]))].sort()
    const style = styles.length ? (styleGiven ? styleGiven(styles) : styles[Math.floor(hash(id, 11) * styles.length)]) : null
    for (const o of meshes) {
      const part = nameOf(o)
      if (part === null || (part === 'glasses' && !glasses) || (part.includes('_') && part.split('_')[1] !== style)
        || (showGiven && !showGiven(part.split('_')[0]))) {
        drop.push(o)
        continue
      }
      o.material = toon(o.material as THREE.MeshStandardMaterial)
      o.castShadow = true
      o.frustumCulled = false
      if (part === 'eyes') eyes.push(o)
      if (part === 'eyesShut') shut.push(o)
      if (part === 'mouth') mouth.push(o)
      if (part === 'mouthOpen') open.push(o)
      if (o instanceof THREE.SkinnedMesh && !SWAPPED.has(part)) keep.push({ o, inked: !FLAT.test(part) })
    }
    for (const o of drop) o.removeFromParent()
    // (drawn as few meshes as can be: every part in one material merged into one mesh, and one ink outline round all
    // the parts that have one; the eyes and mouth, swapped as they blink and chew, stay as they are)
    const skinned = keep.map((k) => k.o)
    if (skinned.length) {
      const first = skinned[0]
      const parent = first.parent!
      const byMat = new Map<THREE.Material, THREE.SkinnedMesh[]>()
      for (const o of skinned) byMat.set(o.material as THREE.Material, [...(byMat.get(o.material as THREE.Material) ?? []), o])
      const bake = (list: THREE.SkinnedMesh[], mat: THREE.Material) => {
        const g = mergeGeometries(list.map((o) => skinnable(o, first)))
        if (!g) return null
        const m = new THREE.SkinnedMesh(g, mat)
        m.bind(first.skeleton, first.bindMatrix)
        m.frustumCulled = false
        m.castShadow = mat !== outlineMaterial
        m.userData.own = true
        if (mat === outlineMaterial) m.raycast = () => {}
        parent.add(m)
        return m
      }
      for (const [mat, list] of byMat) bake(list, mat)
      bake(keep.filter((k) => k.inked).map((k) => k.o), outlineMaterial)
      for (const o of skinned) o.removeFromParent()
    }
    for (const o of [...shut, ...open]) o.visible = false
    const mixer = new THREE.AnimationMixer(root)
    const actions: Record<string, THREE.AnimationAction> = {}
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip)
    let head: THREE.Bone | undefined, hand: THREE.Bone | undefined, handL: THREE.Bone | undefined
    root.traverse((o) => {
      if (o instanceof THREE.Bone && o.name === 'head') head = o
      if (o instanceof THREE.Bone && o.name === 'handR') hand = o
      if (o instanceof THREE.Bone && o.name === 'handL') handL = o
    })
    // (no two heads quite the same: a few percent wider or narrower, longer or shorter; the actions never scale it)
    head?.scale.set(0.95 + 0.1 * hash(id, 3), 0.97 + 0.06 * hash(id, 5), 0.97 + 0.06 * hash(id, 3))
    return { root, mixer, actions, head, hand, handL, eyes, shut, mouth, open, posed: new THREE.Quaternion(), looked: new THREE.Quaternion(0, 0, 0, 0) }
  }, [gltf, id, kind, glasses, lookGiven, styleGiven, showGiven])
  // (when they've gone, let go of what the GPU holds for them: each skeleton's bone texture, their own materials;
  // left alone these pile up over a day of customers until the browser drops the 3D)
  useEffect(() => () => {
    r.mixer.stopAllAction()
    r.root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose()
      if (o instanceof THREE.Mesh && o.material !== outlineMaterial) (o.material as THREE.Material).dispose()
      // (the merged meshes are this customer's own: the rest share the model's geometry)
      if (o instanceof THREE.Mesh && o.userData.own) o.geometry.dispose()
    })
  }, [r])
  return r
}

/** one customer, sitting on their stool (or walking), eating or waiting; t is their own clock (seconds) */
export function Person({ id, eating, walking, t: tGiven, clock, talk = 0, idle: idleGiven }: { id: number; eating: boolean; walking: boolean
  /** their own clock (seconds): given as a number (re-rendered each frame), or read each frame from a ref, which
   * moves the figure without re-rendering it (only a change of what they're doing re-renders) */
  t?: number; clock?: { current: number }
  /** sat beside the one they came with: +1 if they're on this one's left, -1 on the right (they talk, turned to them) */
  talk?: number
  /** (to look at one) what they do while they wait, instead of passing the time by turns */
  idle?: 'Sit' | 'Phone' | 'Chin' }) {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const glasses = kind === 'grandpa' || (kind === 'salaryman' && id % 3 === 0) || (kind === 'student' && id % 2 === 0)
    || (kind === 'civilServant' && id % 2 === 1)
  const r = useRigged(id, kind, glasses)
  const playing = useRef<string | null>(null)
  const last = useRef<number | null>(null)
  const skewer = useRef<THREE.Group>(null)
  const carried = useRef<THREE.Group>(null)
  // (half the office workers, and every civil servant, come with a briefcase: carried in, set down by the stool)
  const briefcase = (kind === 'salaryman' && id % 2 === 0) || kind === 'civilServant'

  const phone = useRef<THREE.Group>(null)
  // what they're doing: walking in or out, eating, or sat waiting; waiting, they talk to the one they came with, or
  // (alone) pass the time one way and then another every half a minute or so: look about, look at their phone, sit
  // with their chin in their hand
  const timeNow = () => tGiven ?? clock?.current ?? 0
  const spellOf = (t: number) => Math.floor((t + id * 9) / 24)
  const [spell, setSpell] = useState(() => spellOf(timeNow()))
  const idle = (['Sit', 'Phone', 'Chin', 'Phone', 'Sit', 'Chin'] as const)[Math.floor(hash(id, spell) * 6)]
  const now = walking ? 'Walk' : eating ? 'Eat' : talk > 0 ? 'TalkL' : talk < 0 ? 'TalkR' : idleGiven ?? idle
  useEffect(() => {
    const next = r.actions[now]
    if (!next) return
    const prev = playing.current ? r.actions[playing.current] : null
    next.reset().play()
    // (each customer a little out of step with the next)
    if (!prev) next.time = (id * 0.37) % next.getClip().duration
    if (prev && prev !== next) next.crossFadeFrom(prev, 0.3, false)
    playing.current = now
  }, [now, r, id])

  // the chopsticks they eat with, in the right hand
  useEffect(() => {
    const s = skewer.current
    if (!s || !r.hand) return
    r.hand.add(s)
    const b = carried.current
    if (b) r.hand.add(b)
    const ph = phone.current
    if (ph && r.handL) r.handL.add(ph)
    return () => { s.removeFromParent(); b?.removeFromParent(); ph?.removeFromParent() }
  }, [r])

  // their own clock moves the figure: the action, then a look about (waiting), a blink, chewing
  const step = () => {
    const t = timeNow()
    if (spellOf(t) !== spell) setSpell(spellOf(t))
    const dt = last.current === null ? 0 : Math.min(0.1, Math.max(0, t - last.current))
    last.current = t
    r.mixer.update(dt)
    if (r.head && !walking && !eating && now === 'Sit') {
      // (now and then a slow look round the room, not a shake of the head)
      const look = Math.sin(t * 0.3 + id * 1.7) * 0.35 * smooth(0.7, 0.95, Math.abs(Math.sin(t * 0.13 + id)))
      // (about the figure's own up, in the neck's frame)
      // (the mixer only writes a bone that changed: start from its own pose, not last frame's look)
      if (r.head.quaternion.equals(r.looked)) r.head.quaternion.copy(r.posed)
      else r.posed.copy(r.head.quaternion)
      const up = UP.set(0, 1, 0).applyQuaternion(r.root.getWorldQuaternion(QA))
      up.applyQuaternion(r.head.parent!.getWorldQuaternion(QB).invert())
      r.head.quaternion.premultiply(QA.setFromAxisAngle(up.normalize(), look))
      r.looked.copy(r.head.quaternion)
    }
    const blink = (t * 0.9 + id * 0.37) % 4 < 0.12
    for (const o of r.eyes) o.visible = !blink
    for (const o of r.shut) o.visible = blink
    const chewing = eating && Math.sin(t * 11) > 0.2 && ((t + id * 0.7) % 3) > 1.2
    for (const o of r.mouth) o.visible = !chewing
    for (const o of r.open) o.visible = chewing
  }
  useFrame(step)

  return (
    // (a smaller figure sits up on the stool, its legs dangling, rather than sinking into it)
    <group scale={l.size} position-y={walking ? 0 : 0.35 * (1 - l.size)}>
      <primitive object={r.root} />
      {/* the chopsticks, along the hand from the fist: their tips (with a bite) in the bowl, then at the mouth */}
      <group ref={skewer} visible={eating} position={[0, 0.02, 0.004]}>
        {[-0.004, 0.004].map((x) => (
          <mesh key={x} position={[x, 0.06, 0]} rotation-z={x * 4}>
            <cylinderGeometry args={[0.0018, 0.0026, 0.13, 5]} />
            <meshToonMaterial color="#6a4226" gradientMap={gradientMap} />
          </mesh>
        ))}
        <mesh position-y={0.124} scale={[1, 0.7, 0.8]}>
          <sphereGeometry args={[0.009, 8, 6]} />
          <meshToonMaterial color="#c8743a" gradientMap={gradientMap} />
        </mesh>
      </group>
      {/* a phone in the left hand while they look at it, its screen lit */}
      <group ref={phone} visible={now === 'Phone'} position={[-0.012, 0.05, 0.016]} rotation-x={-0.3}>
        <mesh>
          <boxGeometry args={[0.042, 0.076, 0.006]} />
          <meshToonMaterial color="#22252a" gradientMap={gradientMap} />
        </mesh>
        <mesh scale={[1.12, 1.07, 1.6]}>
          <boxGeometry args={[0.042, 0.076, 0.006]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
        {[1, -1].map((sd) => (
          <mesh key={sd} position-z={sd * 0.0032} rotation-y={sd > 0 ? 0 : Math.PI}>
            <planeGeometry args={[0.036, 0.066]} />
            <meshBasicMaterial color="#b8e2ff" toneMapped={false} />
          </mesh>
        ))}
        {/* (the screen's cold light round it, so it shows from behind them too) */}
        <sprite scale={0.12}>
          <spriteMaterial map={SCREEN_GLOW} color="#9fd8ff" transparent opacity={0.55} depthWrite={false}
            blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      {/* the briefcase: in the hand, hanging from its handle, walking; on the floor by the stool, sitting */}
      {briefcase && (
        <>
          <group ref={carried} visible={walking} position={[0, 0.035, 0]}><Briefcase /></group>
          {!walking && <group position={[-0.17, 0, 0.1]} rotation-y={0.3}><group position-y={0.105} rotation-z={Math.PI}><Briefcase /></group></group>}
        </>
      )}
      {/* the rice bowl held up in the left hand (where guests.py's BOWL is) */}
      {eating && (
        <group position={[0.025, 0.6, 0.21]}>
          <mesh rotation-x={Math.PI}>
            <sphereGeometry args={[0.05, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
            <meshToonMaterial color="#e9e1cf" side={THREE.DoubleSide} gradientMap={gradientMap} />
          </mesh>
          <mesh position-y={-0.012} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.046, 20]} />
            <meshToonMaterial color="#fbf8f0" gradientMap={gradientMap} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/**
 * The cook, standing at the fire while the shop is open and busy at it: fanning the coals with an uchiwa in his left
 * hand, turning a skewer low over them with his right, then holding it up high to shake salt down. Faces +Z.
 */
/*
 * The staff dressed and coloured just as their pictures in the office have them (ui/Avatar.tsx): the same skin and
 * hair (picked by the same hash of their id), glasses on the same ones, a woman's hair long, in a bob or tied up as
 * there. It's a Japanese shop, so everyone the customers see dresses Japanese: the cooks in white or navy samue under a
 * hachimaki (a woman in the low white cap); on the floor and at the till the men in samue (deep red for the floor,
 * indigo at the till, brown for the stock keeper in the kitchen, with his clipboard), the women in kimono of the
 * same colours, their hair put up.
 */
const AV_SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const AV_HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020', '#6b4a32']
const avHash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const TOPS: Record<Role, string> = { chef: '#f4f1ea', sous: '#2c3a58', server: '#7a2a22', cashier: '#2c3e66', stock: '#6a5236' }
/** which of the job's things each wears (the parts of the staff figures in guests.glb) */
const WEARS: Record<Role, string[]> = { chef: ['wacap'], sous: ['wacap'], server: [], cashier: [], stock: [] }
const JOB_PARTS = new Set(['toque', 'wacap', 'workcap', 'buttons', 'bowtie', 'apron', 'bib', 'badge'])

/**
 * Someone working in the shop, standing at their place: a cook at the fire (fanning the coals, turning skewers,
 * salting), a server holding a tray, the cashier at the till with their hands together, the stock keeper with his
 * clipboard.
 */
export function StaffFigure({ id, role, look: who, moving = false }: { id: string; role: Role; look: StaffLook
  /** walking somewhere with the tray held out (a server carrying a plate) */
  moving?: boolean }) {
  const h = avHash(id)
  const seed = h % 997
  const cook = role === 'chef' || role === 'sous'
  // (the samue's crossed collar for the men in the kitchen and out front; a kimono for the women out front; the women
  // cooks in their white kappōgi and cap; the stock keeper in his work clothes)
  const front = role === 'server' || role === 'cashier' || role === 'stock'
  const kind: Kind = who.female ? (front ? 'yukata' : 'staffF') : 'chef'
  const old = who.age === 'old'
  const glasses = (h >> 7) % 5 === 0 || (old && (h >> 7) % 2 === 0)
  const cut = (h >> 13) % 3
  // (a woman at the fire in the white kappōgi, whatever the job's colour)
  const look = useMemo<Look>(() => ({ top: cook && who.female ? '#f4f1ea' : TOPS[role],
    // (a samue is a matching set, jacket and trousers of one cloth)
    legs: front ? TOPS[role] : cook ? '#263049' : '#2a2a30',
    hair: old ? ((h >> 4) & 1 ? '#d6d1c8' : '#a9a49c') : AV_HAIR[(h >> 3) % AV_HAIR.length],
    skin: AV_SKIN[h % AV_SKIN.length], shoes: front && who.female ? '#b08a5a' : '#2a2220', size: 1 }), [role, old, h, cook, who.female, front])
  // (hair put up for work: a woman out front in an updo, the men cropped, the floor's under a hachimaki too)
  const style = useMemo(() => () => (who.female ? (cook ? 'bun' : front ? 'updo' : ['long', 'bob', 'bun'][cut])
    : cook || role === 'server' || role === 'stock' ? 'crop' : 'short'), [who.female, cut, cook, front, role])
  const show = useMemo(() => (part: string) => !JOB_PARTS.has(part) || WEARS[role].includes(part), [role])
  const r = useRigged(1000 + seed, kind, glasses, { look, style, show })
  const fan = useRef<THREE.Group>(null)
  const clock = useRef(0)
  const action = moving ? 'Carry' : cook ? 'Cook' : role === 'cashier' ? 'Stand' : 'Hold'
  useEffect(() => {
    const a = r.actions[action]
    if (!a) return
    a.reset().play()
    // (each a little out of step with the others)
    a.time = (seed * 0.61) % a.getClip().duration
    const f = fan.current
    if (f && r.handL) r.handL.add(f)
    return () => { f?.removeFromParent(); a.stop() }
  }, [r, action, seed])
  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta)
    clock.current += dt
    r.mixer.update(dt)
    const blink = (clock.current + seed * 0.9) % 3.6 < 0.12
    for (const o of r.eyes) o.visible = !blink
    for (const o of r.shut) o.visible = blink
  })
  return (
    <group>
      <primitive object={r.root} />
      {/* the uchiwa: a round paper fan on a bamboo handle, along the hand from the fist */}
      <group ref={fan} position={[0, 0.03, 0]} visible={cook}>
        <mesh position-y={0.03}>
          <cylinderGeometry args={[0.003, 0.003, 0.07, 5]} />
          <meshToonMaterial color="#c9a46a" gradientMap={gradientMap} />
        </mesh>
        <mesh position-y={0.105} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, 0.003, 20]} />
          <meshToonMaterial color="#f2ead8" gradientMap={gradientMap} />
        </mesh>
        <mesh position-y={0.105} rotation-x={Math.PI / 2} scale={[1.08, 1.6, 1.08]}>
          <cylinderGeometry args={[0.05, 0.05, 0.003, 20]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, 0.11, 0.002]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.022, 0.022, 0.0035, 16]} />
          <meshToonMaterial color="#c8281e" gradientMap={gradientMap} />
        </mesh>
      </group>
      {/* a server's round lacquered tray, a cup of tea on it, held level on the hands */}
      {role === 'server' && (
        <group position={[0, 0.548, 0.18]}>
          <mesh>
            <cylinderGeometry args={[0.085, 0.08, 0.012, 24]} />
            <meshToonMaterial color="#3a1a14" gradientMap={gradientMap} />
          </mesh>
          <mesh scale={[1.04, 1.4, 1.04]}>
            <cylinderGeometry args={[0.085, 0.08, 0.012, 24]} />
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          <mesh position={[0.02, 0.028, 0]}>
            <cylinderGeometry args={[0.022, 0.018, 0.045, 14]} />
            <meshToonMaterial color="#e8dcc0" gradientMap={gradientMap} />
          </mesh>
        </group>
      )}
      {/* the stock keeper's clipboard, held up at the waist, the stock list on it */}
      {role === 'stock' && (
        <group position={[0, 0.56, 0.17]} rotation-x={-0.9}>
          <mesh>
            <boxGeometry args={[0.1, 0.006, 0.13]} />
            <meshToonMaterial color="#c9a66b" gradientMap={gradientMap} />
          </mesh>
          <mesh scale={[1.06, 1.6, 1.05]}>
            <boxGeometry args={[0.1, 0.006, 0.13]} />
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          <mesh position={[0, 0.0035, 0.008]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.08, 0.1]} />
            <meshToonMaterial color="#f7f3ea" gradientMap={gradientMap} />
          </mesh>
          {[0.03, 0.01, -0.01, -0.03].map((z) => (
            <mesh key={z} position={[0, 0.004, z]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.06, 0.004]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          ))}
          <mesh position={[0, 0.006, -0.062]}>
            <boxGeometry args={[0.03, 0.008, 0.012]} />
            <meshToonMaterial color="#8a8a8a" gradientMap={gradientMap} />
          </mesh>
        </group>
      )}
    </group>
  )
}


useGLTF.preload(URL)
