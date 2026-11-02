import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { kindOf, type GuestKind } from '@/data/guests'
import { inkTogether } from './inkHull'
import { Briefcase, airbrush, gradientMap, hash, lookOf } from './Person3D'
import { bakeable, colourVertices } from './StaticBatch'
import { cloth } from './patterns'
import type { Mood } from './people'

/*
 * A customer in the boss's style (blender/folk.py: public/models/folk.glb): an Overcooked cook's big round head on a short plump body, no
 * legs, floating mitten hands, the boss's height; low in faces and shaded smooth, the detail painted. What they wear is a picture round the
 * body (textures/folk/outfit_<kind>_<n>.png), their face a picture over the front of the head, one of eight expressions in a strip
 * (textures/folk/face_<type>.png: as they are, blinking, delighted, cross, sad, chewing, talking, surprised), slid along to the one they
 * show; their hair one of a dozen styles, and what some of them have about them (glasses, a hat, headphones, a randoseru...) shown as
 * their kind has it. Skin and hair in their own colours (lookOf, as the old figures had them).
 *
 * Each combination of hair and things about them is put together once (the body, the head and each hand merged by material, inked) and
 * copied for each customer, with their own materials (their colours, their clothes, their face; and their own so they can fade alone).
 * Sat, the round body sits up on the stool's seat; walking, it waddles; eating, the bowl's held up and the chopsticks go to the mouth.
 */
const URL = import.meta.env.BASE_URL + 'models/folk.glb'
const TEX = import.meta.env.BASE_URL + 'textures/folk/'
type FaceType = 'male' | 'female' | 'elder' | 'kid'
const EXPR = { neutral: 0, blink: 1, joy: 2, mad: 3, sad: 4, chew: 5, talk: 6, surprised: 7 } as const
type Expr = keyof typeof EXPR

/** how each kind wears its hair (one picked by id) and what it has about it */
const HAIR: Record<GuestKind, string[]> = {
  salaryman: ['part', 'crop'], officeLady: ['bob', 'bunLow'], highSchoolGirl: ['twin', 'long', 'pony'], highSchoolBoy: ['crop', 'spiky'],
  grandma: ['perm'], grandpa: ['bald'], kid: ['kid'], uncle: ['crop', 'bald'], student: ['crop', 'spiky'], yukata: ['bunHigh'],
  yankee: ['pomp'], bosozoku: ['pomp', 'spiky'], tourist: ['crop', 'pony'], civilServant: ['part'], maid: ['twin', 'long'], gyaru: ['gyaru'],
}
const ACC: Partial<Record<GuestKind, string[]>> = {
  kid: ['schoolhat', 'randoseru'], uncle: ['moustache', 'towel'], grandpa: ['moustache'], grandma: ['shawl'], student: ['backpack'],
  yukata: ['obibow', 'kanzashi'], yankee: ['collar'], highSchoolBoy: ['collar'], bosozoku: ['hachimaki'], tourist: ['sunhat', 'camera'],
  maid: ['maidcap'], gyaru: ['hoops'],
}
const FEMALE = new Set<GuestKind>(['officeLady', 'highSchoolGirl', 'yukata', 'maid', 'gyaru'])
/** what's worn on the head (turns with it) */
const ON_HEAD = new Set(['glasses', 'moustache', 'phones', 'sunhat', 'schoolhat', 'maidcap', 'hachimaki', 'hoops', 'kanzashi'])
/** where the head turns from (the neck), in the model's frame */
const NECK = new THREE.Vector3(0, 0.56, 0)
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }
/**
 * The pair of chopsticks in a customer's hand while they eat: the bar's own lacquered ones, picked up off their rest (the owner's: they ate with
 * none to be seen, the pair on the rest untouched; the brown sticks in their fist pointed back into them): black over the top third, a fine
 * gold band, deep red to the tips, along +y from a little behind the grip to the tips, coming together toward them. One shape for every
 * customer, its colours in its vertices; a bite at the tips going up to the mouth.
 */
const CHOP_LEN = 0.24
const CHOP_GRIP = 0.075
const CHOP_GEO = (() => {
  const parts: THREE.BufferGeometry[] = []
  const y0 = -CHOP_GRIP, y1 = CHOP_LEN - CHOP_GRIP, third = y0 + CHOP_LEN / 3
  const r = (y: number) => 0.0048 - (0.0026 * (y - y0)) / CHOP_LEN
  const seg = (a: number, b: number, c: string) => {
    const g = new THREE.CylinderGeometry(r(b), r(a), b - a, 6, 1)
    g.translate(0, (a + b) / 2, 0)
    const cc = new THREE.Color(c), n = g.attributes.position.count, col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }
  for (const sd of [-1, 1]) {
    for (const g of [seg(y0, third, '#151112'), seg(third, third + 0.007, '#d9b04a'), seg(third + 0.007, y1, '#7c2a1e')]) {
      g.rotateZ(sd * 0.024)
      g.translate(sd * 0.0055, 0, 0)
      parts.push(g)
    }
  }
  const all = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return all
})()
const CHOP_MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap })
const BITE_GEO = new THREE.SphereGeometry(0.014, 8, 6)
const BITE_MAT = new THREE.MeshToonMaterial({ color: '#c8743a', gradientMap })
/** where the chopsticks' tips go, in the figure's frame: down into the bowl in the left hand, or up to the mouth (the head's middle 0.8 up,
 * blender/folk.py's C) */
const CHOP_BOWL = new THREE.Vector3(-0.08, 0.47, 0.33)
const CHOP_MOUTH = new THREE.Vector3(0, 0.7, 0.26)
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
/** where they sit on the stool, in the customers' frame (blender/stools.py: its oak seat's top, 0.29, and on the cushion, pressed down) */
export const SEAT = 0.31
/** how tall the figure stands, to the top of its head (blender/folk.py: the head's top), in its own frame */
export const FOLK_HEIGHT = 1.07
/** parts with no ink line round them (by their material: the face's picture, the glasses' frames, gold, the little red ties and flowers) */
const UNINKED = /FolkFace|FolkFrame|FolkGold|FolkRed/
/** the materials kept as themselves: each customer's own skin and hair, the outfit's and the face's pictures, the knit's pattern, the gold */
const PAINTED = new Set(['FolkSkin', 'FolkHair', 'FolkBody', 'FolkFace', 'FolkKnit', 'FolkGold'])

/** in development, ?hair=<style> puts every customer in that hairstyle, to look at it */
const FORCE_HAIR = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hair') : null

export type FolkSpec = { kind: GuestKind; hair: string; acc: string[]; face: FaceType; outfit: string; size: number; skin: string; hairColor: string
  top: string; briefcase: boolean }
/** how this customer looks: their kind's hair and things, their colours */
export function folkSpec(id: number): FolkSpec {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const hairs = HAIR[kind]
  const hair = FORCE_HAIR ?? hairs[Math.floor(hash(id, 31) * hairs.length) % hairs.length]
  const acc = [...(ACC[kind] ?? [])]
  // (glasses and headphones as the old figures had them)
  if (kind === 'grandpa' || (kind === 'salaryman' && id % 3 === 0) || (kind === 'student' && id % 2 === 0) || (kind === 'civilServant' && id % 2 === 1)) acc.push('glasses')
  if (kind === 'student' && hash(id, 23) < 0.34) acc.push('phones')
  const face: FaceType = kind === 'kid' ? 'kid' : kind === 'grandma' || kind === 'grandpa' ? 'elder'
    : FEMALE.has(kind) || (kind === 'tourist' && hair === 'pony') ? 'female' : 'male'
  return { kind, hair, acc, face, outfit: `outfit_${kind}_${id % 2}`, size: l.size, skin: l.skin, hairColor: l.hair, top: l.top,
    briefcase: (kind === 'salaryman' && id % 2 === 0) || kind === 'civilServant' }
}

/** the pictures: every kind's clothes (two colours each) and the four faces, loaded together before any customer's drawn */
const KINDS: GuestKind[] = ['salaryman', 'officeLady', 'highSchoolGirl', 'highSchoolBoy', 'grandma', 'grandpa', 'kid', 'uncle', 'student', 'yukata',
  'yankee', 'bosozoku', 'tourist', 'civilServant', 'maid', 'gyaru']
const PICTURES = [...KINDS.flatMap((k) => [`outfit_${k}_0`, `outfit_${k}_1`]), 'face_male', 'face_female', 'face_elder', 'face_kid']
const PICTURE_URLS = PICTURES.map((n) => TEX + n + '.png')
const prepared = new WeakSet<THREE.Texture>()
function usePictures() {
  const list = useLoader(THREE.TextureLoader, PICTURE_URLS)
  return useMemo(() => {
    const out = new Map<string, THREE.Texture>()
    list.forEach((t, i) => {
      if (!prepared.has(t)) {
        prepared.add(t)
        t.colorSpace = THREE.SRGBColorSpace
        // (as glTF has it: the picture's top row at the top of the UVs)
        t.flipY = false
        t.anisotropy = 4
        if (PICTURES[i].startsWith('outfit')) t.wrapS = THREE.RepeatWrapping
        t.needsUpdate = true
      }
      out.set(PICTURES[i], t)
    })
    return out
  }, [list])
}

type Template = { root: THREE.Group; mats: Map<string, THREE.Material> }
const templates = new Map<string, Template>()

/** one combination of hair and things, put together and inked once */
function template(scene: THREE.Group, hair: string, acc: string[]): Template {
  const key = `${hair}|${[...acc].sort().join(',')}`
  const hit = templates.get(key)
  if (hit) return hit
  scene.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
  const keep = (n: string) => n === 'FolkBody' || n === 'FolkHead' || n === 'FolkFace' || n === 'FolkHandL' || n === 'FolkHandR'
    || n === `Folk_hair_${hair}` || acc.some((a) => n === `Folk_acc_${a}`)
  const partOf = (n: string) => n === 'FolkHandL' ? 'handL' : n === 'FolkHandR' ? 'handR'
    : n === 'FolkHead' || n === 'FolkFace' || n.startsWith('Folk_hair_') || (n.startsWith('Folk_acc_') && ON_HEAD.has(n.slice(9))) ? 'head' : 'body'
  // (one material for each of the model's, by name: the game's toon paint; every plain-coloured one (no picture, not each customer's own
  // colour, not metal) the one material FolkPlain, its colour carried by the vertices, so all of them are one draw)
  const mats = new Map<string, THREE.Material>()
  const matOf = (src: THREE.MeshStandardMaterial) => {
    const name = PAINTED.has(src.name) ? src.name : 'FolkPlain'
    let m = mats.get(name)
    if (!m) {
      if (src.name === 'FolkFace') m = new THREE.MeshToonMaterial({ gradientMap, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      else if (src.name === 'FolkGold') m = new THREE.MeshStandardMaterial({ color: '#e0b040', metalness: 1, roughness: 0.3 })
      else if (name === 'FolkPlain') m = airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap }))
      else m = airbrush(new THREE.MeshToonMaterial({ color: src.color.clone(), gradientMap }))
      m.name = name
      mats.set(name, m)
    }
    return m
  }
  // (by part, by material, inked or not: the frame of the glasses and the red of a cap go uninked, merged apart from the rest)
  const groups = new Map<string, Map<string, { mat: THREE.Material; inked: boolean; geos: THREE.BufferGeometry[] }>>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    // (a part's own node, or a primitive under it: named for the node)
    const named = mesh.name.startsWith('Folk') ? mesh.name : mesh.parent?.name ?? ''
    const n = named.replace(/_\d+$/, '')
    if (!keep(n)) return
    const part = partOf(n)
    const src = mesh.material as THREE.MeshStandardMaterial
    const mat = matOf(src)
    const inked = !UNINKED.test(src.name) && !UNINKED.test(named)
    const byMat = groups.get(part) ?? new Map<string, { mat: THREE.Material; inked: boolean; geos: THREE.BufferGeometry[] }>()
    const key = `${mat.uuid}|${inked}`
    const g = byMat.get(key) ?? { mat, inked, geos: [] }
    const geo = bakeable(mesh.geometry, new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
    if (mat.name === 'FolkPlain') colourVertices(geo, src.color)
    g.geos.push(geo)
    byMat.set(key, g)
    groups.set(part, byMat)
  })
  const root = new THREE.Group()
  const body = new THREE.Group()
  body.name = 'body'
  root.add(body)
  for (const [part, byMat] of groups) {
    const g = new THREE.Group()
    g.name = part
    const at = part === 'handL' ? REST.L : part === 'handR' ? REST.R : part === 'head' ? NECK : null
    const inkedHere: THREE.Mesh[] = []
    for (const { mat, inked, geos } of byMat.values()) {
      const geo = mergeGeometries(geos)
      for (const x of geos) x.dispose()
      if (!geo) continue
      if (at) geo.translate(-at.x, -at.y, -at.z)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = mat.name
      mesh.castShadow = mat.name !== 'FolkFace'
      // (the head takes no shadows: the shop's one shadow map is too coarse for a face, and the hair's and the hat's fell on it in blotches
      // and streaks; its toon light shades it)
      mesh.receiveShadow = part !== 'head'
      g.add(mesh)
      if (inked) inkedHere.push(mesh)
    }
    // (one ink line round the whole part, whatever it's painted with)
    const hull = inkTogether(inkedHere, { width: 0.006, weld: true })
    if (hull) g.add(hull)
    if (at) g.position.copy(at)
    // (the head and the hands ride on the body: they bob and rock with it)
    if (part === 'body') { for (const c of [...g.children]) body.add(c) } else body.add(g)
  }
  const t = { root, mats }
  templates.set(key, t)
  return t
}

/**
 * A customer, as Person3D's Person has them (the same props): sat on their stool or walking, eating, talking to the one they came with,
 * passing the time (looking about, at their phone, chin in hand), their mood on their face, a hop of delight when their food comes,
 * fading as they go; `fit`: their size in the frame they're drawn in (the boss's height there).
 */
export function FolkFigure({ id, eating, walking, still, clock, talk = 0, mood = null, fade, pose, held, fit = 1, ground = false }: {
  id: number; eating: boolean; walking: boolean; still?: () => boolean; clock?: { current: number }; talk?: number; mood?: Mood | null
  fade?: () => number; slippers?: () => boolean; pose?: string; held?: ReactNode; fit?: number
  /** stood on the floor, not sat on a stool's seat, when not walking (the character viewer's turntable: there's no stool there, and sat
   * at the seat's height over it they floated, the briefcase set down by them on the floor) */
  ground?: boolean }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const pictures = usePictures()
  const spec = useMemo(() => folkSpec(id), [id])
  const fig = useMemo(() => {
    const base = template(gltf.scene, spec.hair, spec.acc)
    const root = base.root.clone(true)
    // (their own materials: their skin, hair and clothes, their face; theirs alone, to fade)
    const own = new Map<THREE.Material, THREE.Material>()
    let face: THREE.MeshToonMaterial | null = null
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.Material
      let t = own.get(src)
      if (!t) {
        t = src.clone()
        const tm = t as THREE.MeshToonMaterial
        if (src.name === 'FolkSkin') tm.color.set(spec.skin)
        else if (src.name === 'FolkHair') tm.color.set(spec.hairColor)
        else if (src.name === 'FolkBody') { tm.color.set('#ffffff'); tm.map = pictures.get(spec.outfit) ?? null }
        else if (src.name === 'FolkFace') {
          // (their own copy of the strip, the same picture, slid along to the expression they show)
          const ft = pictures.get(`face_${spec.face}`)!.clone()
          ft.needsUpdate = true
          tm.map = ft
          face = tm
        }
        else if (src.name === 'FolkKnit') tm.map = cloth('knit', '#8a6a9a', [6, 2])
        // (the ink lines are the hull's own, shared: not copied)
        if ((src as THREE.MeshBasicMaterial).side === THREE.BackSide && src.type !== 'MeshToonMaterial') t = src
        own.set(src, t)
      }
      m.material = t
    })
    const get = (n: string) => root.getObjectByName(n) ?? null
    // (what's theirs alone, to let go when they've gone: their copies, not the ink lines all of them share)
    const mine = [...new Set([...own.entries()].filter(([src, t]) => t !== src).map(([, t]) => t))]
    return { root, body: get('body')!, head: get('head'), handL: get('handL'), handR: get('handR'), face: face as THREE.MeshToonMaterial | null, mats: [...new Set(own.values())], mine }
  }, [gltf, spec, pictures])
  // (a customer gone: their own materials and their face's copy let go (the shapes are the template's, shared, kept))
  useEffect(() => () => {
    for (const m of fig.mine) {
      if (m.name === 'FolkFace') (m as THREE.MeshToonMaterial).map?.dispose()
      m.dispose()
    }
  }, [fig])

  const chop = useRef<THREE.Group>(null)
  const bowl = useRef<THREE.Group>(null)
  const phone = useRef<THREE.Group>(null)
  const heldRef = useRef<THREE.Group>(null)
  const carried = useRef<THREE.Group>(null)
  // (the things in their hands ride with the hands)
  useEffect(() => {
    const pairs: [React.RefObject<THREE.Group | null>, THREE.Object3D | null][] = [[chop, fig.handR], [heldRef, fig.handR], [carried, fig.handR], [phone, fig.handL], [bowl, fig.handL]]
    for (const [r, hand] of pairs) if (r.current && hand) hand.add(r.current)
    return () => { for (const [r] of pairs) r.current?.removeFromParent() }
  }, [fig])

  const timeNow = () => clock?.current ?? 0
  // (alone at the counter, passing the time one way and another, each their own pace)
  const spellOf = (t: number) => Math.floor((t + id * 9) / (12 + 18 * hash(id, 7)))
  const [spell, setSpell] = useState(() => spellOf(timeNow()))
  const idle = (['look', 'phone', 'chin', 'phone', 'look', 'chin'] as const)[Math.floor(hash(id, spell) * 6)]
  const showPhone = !walking && !eating && !talk && !pose && idle === 'phone'
  const last = useRef<number | null>(null)
  const served = useRef<{ was: boolean; at: number }>({ was: eating, at: -99 })
  const faded = useRef(1)
  const look = useRef({ yaw: 0, pitch: 0 })
  const pace = useRef(0)
  const lastPos = useRef<THREE.Vector3 | null>(null)
  const outer = useRef<THREE.Group>(null)
  const exprNow = useRef<Expr>('neutral')
  const v3 = useMemo(() => new THREE.Vector3(), [])
  const chopDir = useMemo(() => new THREE.Vector3(), [])
  const chopQ = useMemo(() => new THREE.Quaternion(), [])
  const bite = useRef<THREE.Mesh>(null)

  const applyFade = (f: number) => {
    if (Math.abs(f - faded.current) < 0.01 && (f < 1) === (faded.current < 1)) return
    const was = faded.current < 1
    faded.current = f
    fig.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.Material
      if ((mat as THREE.MeshBasicMaterial).side === THREE.BackSide && mat.type !== 'MeshToonMaterial') { m.visible = f >= 1; return }
      if (mat.userData.base === undefined) mat.userData.base = { opacity: mat.opacity, transparent: mat.transparent }
      const base = mat.userData.base as { opacity: number; transparent: boolean }
      if (was !== f < 1) { if (!base.transparent) mat.alphaHash = f < 1; mat.needsUpdate = true }
      mat.opacity = base.opacity * f
    })
  }
  const setExpr = (e: Expr) => {
    if (exprNow.current === e || !fig.face?.map) return
    exprNow.current = e
    fig.face.map.offset.x = EXPR[e] / 8
  }

  useFrame(() => {
    const t = timeNow()
    const dt = last.current === null ? 0 : Math.min(0.1, Math.max(0, t - last.current))
    last.current = t
    if (spellOf(t) !== spell) setSpell(spellOf(t))
    applyFade(fade?.() ?? 1)
    const o = outer.current
    if (!o) return
    // (walking: how fast they're going, from how far they've come since the last frame; stood still on the way, they stand)
    o.getWorldPosition(v3)
    const moved = lastPos.current ? Math.hypot(v3.x - lastPos.current.x, v3.z - lastPos.current.z) / Math.max(dt, 1e-3) : 0
    lastPos.current = (lastPos.current ?? new THREE.Vector3()).copy(v3)
    const going = walking && !still?.()
    pace.current += ((going ? Math.min(1, Math.max(0.6, moved / 0.5)) : 0) - pace.current) * Math.min(1, dt * 8)
    const walk = pace.current
    // (the food's come: a crouch, a hop up stretched tall and down again squashed, half a second; their eyes shut happy a moment)
    if (eating !== served.current.was) { served.current.was = eating; if (eating && !walking) { served.current.at = t; fig.root.userData.served = (fig.root.userData.served ?? 0) + 1 } }
    const since = t - served.current.at
    const yay = since >= 0 && since < 0.55 ? since / 0.55 : -1
    const lift = yay >= 0 ? Math.max(0, Math.sin(yay * Math.PI)) * 0.08 : 0
    const squash = yay >= 0 ? (yay < 0.15 ? -0.08 * Math.sin((yay / 0.15) * Math.PI) : yay < 0.8 ? 0.07 * Math.sin(((yay - 0.15) / 0.65) * Math.PI) : -0.05 * Math.sin(((yay - 0.8) / 0.2) * Math.PI)) : 0
    const hop = mood === 'joy' && !walking ? Math.max(0, Math.sin(t * 9 + id)) * 0.02 * Math.max(0, Math.sin(t * 0.7 + id * 2)) : 0
    const ph = t * 9 + id
    const b = fig.body
    b.position.y = walk * Math.abs(Math.sin(ph)) * 0.035 + lift + hop
    b.rotation.z = walk * Math.sin(ph) * 0.07
    b.rotation.x = walk * 0.08
    // (talking to the one they came with: turned toward them)
    const turn = !walking && talk && !eating ? talk * 0.35 : 0
    b.rotation.y += (turn - b.rotation.y) * Math.min(1, dt * 4)
    b.scale.y = 1 + (walking ? 0 : Math.sin(t * 1.7 + id) * 0.008) + squash
    b.scale.x = b.scale.z = 1 - squash * 0.5
    // (the head: looking about by beats while they sit, down at the phone or the bowl, nodding as they talk)
    if (fig.head) {
      let yaw = 0, pitch = 0
      if (!walking) {
        const beat = 2.5 + 4 * hash(id, 11)
        const n = Math.floor((t + id * 3.1) / beat)
        yaw = (hash(id * 7 + n, 1) - 0.5) * 0.9
        pitch = (hash(id * 7 + n, 2) - 0.6) * 0.3
        if (showPhone || eating) { pitch = -0.28 + (eating && hash(id * 7 + n, 3) > 0.7 ? 0.3 : 0); yaw *= 0.3 }
        if (idle === 'chin' && !eating && !talk) { yaw *= 0.4; pitch = 0.06 }
        if (talk && !eating) { yaw = talk * 0.25; pitch = 0.05 + Math.sin(t * 7 + id) * 0.05 * (Math.sin(t * 1.3 + id) > 0 ? 1 : 0) }
      }
      const ease = 1 - Math.exp(-dt * 3)
      look.current.yaw += (yaw - look.current.yaw) * ease
      look.current.pitch += (pitch - look.current.pitch) * ease
      fig.head.rotation.set(-look.current.pitch, look.current.yaw, 0, 'YXZ')
    }
    // (the hands: swinging as they walk; at the table, the bowl held up in the left and the chopsticks going to the mouth in the right; the phone
    // up in the left; the chin on the right; reaching into the fridge; a drink held)
    const L = fig.handL, Rh = fig.handR
    const chew = eating && ((t * 0.7 + id * 0.3) % 1) > 0.55
    if (L && Rh) {
      const swing = walk * Math.sin(ph) * 0.08
      const lp = REST.L.clone(), rp = REST.R.clone()
      let lr = 0, rr = 0
      if (walking) { lp.z += swing; rp.z -= swing }
      if (eating) {
        lp.set(-0.12, 0.42, 0.3)
        lr = -0.6
        const k = chew ? 1 : 0
        // (up beside the face, out in front of it, the tips toward the mouth: right at it, the sticks went into the head)
        rp.set(0.12 + 0.05 * k, 0.4 + 0.26 * k, 0.32 + 0.08 * k)
        rr = -0.9 - 0.4 * k
      } else if (showPhone) {
        lp.set(-0.06, 0.44, 0.32)
        lr = -1.1
      } else if (!walking && idle === 'chin' && !talk && !pose) {
        rp.set(0.08, 0.5, 0.27)
        rr = -1.4
      }
      if (pose === 'Fetch') { rp.set(0.16, 0.52, 0.38); rr = -1.2 }
      if (held && !eating) { rp.set(0.22, 0.34, 0.2); rr = -0.3 }
      L.position.lerp(lp, Math.min(1, dt * 10))
      Rh.position.lerp(rp, Math.min(1, dt * 10))
      L.rotation.x += (lr - L.rotation.x) * Math.min(1, dt * 10)
      Rh.rotation.x += (rr - Rh.rotation.x) * Math.min(1, dt * 10)
    }
    if (chop.current) {
      chop.current.visible = eating
      // (the tips at the bowl, or at the mouth: their way from the hand in the figure's frame, taken into the hand's (turned about x))
      if (eating && Rh) {
        const to = chew ? CHOP_MOUTH : CHOP_BOWL
        chopDir.copy(to).sub(Rh.position).normalize().applyAxisAngle(X_AXIS, -Rh.rotation.x)
        chopQ.setFromUnitVectors(UP, chopDir)
        chop.current.quaternion.slerp(chopQ, Math.min(1, dt * 12))
      }
      if (bite.current) bite.current.visible = eating && !chew
    }
    if (bowl.current) bowl.current.visible = eating
    if (phone.current) phone.current.visible = showPhone
    if (carried.current) carried.current.visible = spec.briefcase && walking
    // (the face: their mood; blinking now and then; delighted when the food's just come; chewing; talking)
    const delighted = since >= 0 && since < 1.2
    const joy = mood === 'joy' || delighted
    const blink = !joy && (t * 0.9 + id * 0.37) % 4 < 0.12
    const talking = !!talk && !eating && Math.sin(t * 11 + id) > 0.1 && Math.sin(t * 1.3 + id) > -0.2
    setExpr(chew ? 'chew' : joy ? 'joy' : blink ? 'blink' : mood === 'mad' ? 'mad' : mood === 'sad' ? 'sad' : talking ? 'talk' : 'neutral')
  })

  const k = fit * spec.size
  const seatLift = walking || ground ? 0 : SEAT
  return (
    // (sat, the round body sits on the stool's seat; standing or walking, on the floor)
    <group ref={outer} position-y={seatLift}>
      <group scale={k}>
        <primitive object={fig.root} />
        {/* the chopsticks in the right hand (the place's own, off their rest), a bite at their tips on its way up */}
        <group ref={chop} visible={false}>
          <mesh geometry={CHOP_GEO ?? undefined} material={CHOP_MAT} />
          <mesh ref={bite} geometry={BITE_GEO} material={BITE_MAT} position={[0, CHOP_LEN - CHOP_GRIP - 0.01, 0]} scale={[1, 0.7, 0.8]} />
        </group>
        {/* the rice bowl on the left hand */}
        <group ref={bowl} visible={false} position={[0.02, 0.05, 0.02]}>
          <mesh rotation-x={Math.PI}>
            <sphereGeometry args={[0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
            <meshToonMaterial color="#e9e1cf" side={THREE.DoubleSide} gradientMap={gradientMap} />
          </mesh>
          <mesh position-y={-0.018} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.068, 16]} />
            <meshToonMaterial color="#fbf8f0" gradientMap={gradientMap} />
          </mesh>
        </group>
        {/* a phone in the left hand, its screen lit toward them */}
        <group ref={phone} visible={false} position={[0, 0.05, 0.02]} rotation-x={-0.3}>
          <mesh><boxGeometry args={[0.06, 0.11, 0.009]} /><meshToonMaterial color="#22252a" gradientMap={gradientMap} /></mesh>
          <mesh position-z={-0.005} rotation-y={Math.PI}><planeGeometry args={[0.052, 0.096]} /><meshBasicMaterial color="#b8e2ff" toneMapped={false} /></mesh>
        </group>
        {/* a drink held in the right hand */}
        <group ref={heldRef} visible={!!held} position={[0, 0.02, 0.03]} scale={1.1}>{held}</group>
        {/* the briefcase: in the right hand while they walk; by the stool while they sit */}
        {spec.briefcase && <group ref={carried} position={[0, 0.0, 0.02]} rotation-z={Math.PI} scale={1.4}><Briefcase /></group>}
      </group>
      {spec.briefcase && !walking && <group position={[-0.22, -seatLift, 0.12]} rotation-y={0.3} scale={1.4 * fit}><group position-y={0.105} rotation-z={Math.PI}><Briefcase /></group></group>}
    </group>
  )
}
useGLTF.preload(URL)
// (and the pictures, from the start: a customer coming in never waits on them, so never holds up what's drawn round them)
if (typeof window !== 'undefined') useLoader.preload(THREE.TextureLoader, PICTURE_URLS)
