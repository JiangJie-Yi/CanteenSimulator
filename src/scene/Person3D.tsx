import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { kindOf, type GuestKind } from '@/data/guests'
import { cloth, type Pattern } from './patterns'

/*
 * A customer in 3D, toon-shaded with an ink outline: a chibi figure from blender/guests.py (public/models/guests.glb),
 * one of ten kinds (data/guests.ts) on a shared rig, sitting, eating or walking by its actions there. What they're
 * dressed in says what they are: the office worker's suit and tie, the schoolgirl's sailor collar and pleated
 * skirt, the boy's black gakuran, the old man's knit vest and glasses, the kid's yellow cap and randoseru, the
 * yukata and its obi, the uncle's aloha shirt and headband, the student's hoodie…
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
function lookOf(id: number, kind: GuestKind): Look {
  const old = kind === 'grandma' || kind === 'grandpa'
  const top: Record<GuestKind, string> = {
    salaryman: '#2b3444', officeLady: '#6a6f78', highSchoolGirl: '#f4f1ea', highSchoolBoy: '#1c1e26', grandma: '#c9b48a',
    grandpa: '#7a5a3a', kid: pick(['#e85a4a', '#4a8ad8', '#f0c040'], id), uncle: pick(['#4a7a5a', '#a8432f', '#3d6a9a'], id),
    student: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), yukata: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
  }
  return {
    top: top[kind],
    legs: kind === 'highSchoolGirl' ? '#23324a' : kind === 'officeLady' ? '#4a4f58' : kind === 'kid' ? '#2a4a7a'
      : kind === 'student' ? '#3a4a6a' : kind === 'grandma' ? '#5a4a3e' : kind === 'yukata' ? top[kind] : '#2f2f36',
    hair: old ? '#d4d4d4' : pick(HAIR, id * 3),
    skin: pick(SKIN, id * 7 + 1),
    shoes: kind === 'student' || kind === 'kid' ? '#f2f0ea' : kind === 'yukata' ? '#b08a5a' : '#2a2220',
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

/** the parts drawn without an outline (things lying on the surface, and fine ones) */
const FLAT = /^(eyes|eyesShut|face|mouth|mouthOpen|details|cuffs|glasses|pin)/

const UP = new THREE.Vector3(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion()

const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k) }

type Rigged = {
  root: THREE.Object3D
  mixer: THREE.AnimationMixer
  actions: Record<string, THREE.AnimationAction>
  head?: THREE.Bone
  hand?: THREE.Bone
  eyes: THREE.Object3D[]
  shut: THREE.Object3D[]
  mouth: THREE.Object3D[]
  open: THREE.Object3D[]
  /** the head as the action left it, and as it was turned to look about */
  posed: THREE.Quaternion
  looked: THREE.Quaternion
}

/** one customer's copy of the figures: only their kind kept, in their colours, with outlines */
function useRigged(id: number, kind: GuestKind, glasses: boolean): Rigged {
  const gltf = useGLTF(URL)
  return useMemo(() => {
    const l = lookOf(id, kind)
    const root = cloneSkinned(gltf.scene)
    // (three drops the dots from glTF names: "salaryman.body" is "salarymanbody")
    const partOf = (o: THREE.Object3D): string | null => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) {
        if (p.name.startsWith(kind)) return p.name.slice(kind.length)
        if (p.name === 'Rig' || p.name === 'Guests') return null
      }
      return null
    }
    const drop: THREE.Object3D[] = []
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
    for (const o of meshes) {
      const part = partOf(o)
      if (part === null || (part === 'glasses' && !glasses)) {
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
      if (!FLAT.test(part) && o instanceof THREE.SkinnedMesh) {
        const line = new THREE.SkinnedMesh(o.geometry, outlineMaterial)
        line.bind(o.skeleton, o.bindMatrix)
        line.frustumCulled = false
        line.raycast = () => {}
        o.add(line)
      }
    }
    for (const o of drop) o.removeFromParent()
    for (const o of [...shut, ...open]) o.visible = false
    const mixer = new THREE.AnimationMixer(root)
    const actions: Record<string, THREE.AnimationAction> = {}
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip)
    let head: THREE.Bone | undefined, hand: THREE.Bone | undefined
    root.traverse((o) => {
      if (o instanceof THREE.Bone && o.name === 'head') head = o
      if (o instanceof THREE.Bone && o.name === 'handR') hand = o
    })
    return { root, mixer, actions, head, hand, eyes, shut, mouth, open, posed: new THREE.Quaternion(), looked: new THREE.Quaternion(0, 0, 0, 0) }
  }, [gltf, id, kind, glasses])
}

/** one customer, sitting on their stool (or walking), eating or waiting; t is their own clock (seconds) */
export function Person({ id, eating, walking, t }: { id: number; eating: boolean; walking: boolean; t: number }) {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const glasses = kind === 'grandpa' || (kind === 'salaryman' && id % 3 === 0) || (kind === 'student' && id % 2 === 0)
  const r = useRigged(id, kind, glasses)
  const playing = useRef<string | null>(null)
  const last = useRef<number | null>(null)
  const skewer = useRef<THREE.Group>(null)

  // what they're doing: walking in or out, eating, or sat waiting
  const now = walking ? 'Walk' : eating ? 'Eat' : 'Sit'
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
    return () => { s.removeFromParent() }
  }, [r])

  // their own clock moves the figure: the action, then a look about (waiting), a blink, chewing
  const dt = last.current === null ? 0 : Math.min(0.1, Math.max(0, t - last.current))
  last.current = t
  r.mixer.update(dt)
  if (r.head && !walking && !eating) {
    const look = Math.sin(t * 0.45 + id * 1.7) * 0.5 * smooth(0.55, 0.85, Math.abs(Math.sin(t * 0.21 + id)))
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

useGLTF.preload(URL)
