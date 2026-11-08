import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { footDust, newSteps } from './DustPuffs'
import type { Look as StaffLook, Role } from '@/data/staff'
import { atlasModel } from './atlasMerge'
import { airbrush, gradientMap } from './Person3D'
import { cloneFigure, paintable, releaseFigure, rigidFigure, thinWithFade, type SkinPiece } from './rigidSkin'
import { bakeable, colourVertices } from './StaticBatch'
import { warmLater } from './Prewarm'
import { holdVeil } from './Later'
import { crewFaceSheet, faceRange, markFace, ownShape, setFace, squash as jelly, type CrewFace } from './faceSheet'
import { RUSH, SPEAKERS, STAFF_TALK } from '@/game/shopState'
import { FigureHit } from './FigureHit'

/*
 * The staff, made as the boss is (blender/boss.py with CREW=<variant>): an Overcooked cook's big round head on a short plump body rounding
 * off underneath, floating mitten hands, the boss's height. Dressed for the job: the cooks in the white kappōgi and cap, the men out front
 * in an indigo samue under a white hachimaki, the women in a plum kimono and gold obi with their hair up, the stock keeper in khaki work
 * clothes. Skin and hair as their pictures in the office have them (ui/Avatar.tsx, the same hash of their id), glasses on the same ones.
 *
 * Each figure is drawn in two draws (the owner's: a person in one or two; they were 17 to 22, then 9 to 11): all of it one material per
 * variant (scene/atlasMerge: the pictures on the clothes packed into one atlas, every plain colour carried by the vertices; the eyes flat,
 * unlit, by their vertices' paint), all of it one mesh, each part (the body, the eyes, the glasses, each hand, the fan, a server's tray, the
 * stock keeper's clipboard) moved by its own group as a bone (scene/rigidSkin), what comes and goes scaled to nothing; its ink one line
 * round its inked pieces, bending with it. Built once per variant, then copied. The skin and the hair, each person's own, are colours in
 * their vertices too: each figure has its own colours over the variant's shared shape (its positions, normals and UVs shared, its colours its own).
 */
type Variant = 'chef' | 'chefF' | 'server' | 'serverF' | 'stock'
const url = (v: Variant) => import.meta.env.BASE_URL + `models/crew_${v}.glb`
const VARIANTS: Variant[] = ['chef', 'chefF', 'server', 'serverF', 'stock']
const variantOf = (role: Role, female: boolean): Variant =>
  role === 'chef' || role === 'sous' ? (female ? 'chefF' : 'chef') : role === 'stock' ? 'stock' : female ? 'serverF' : 'server'

/** the small parts: no ink line round them */
/** the head and what's on it, which take no shadow (as the customers' don't): the face's and the glasses' patches are see-through
 * rectangles off the face, and the shadow pass (no alphaTest: they're hashed) cast them whole, black blocks over the eyes (the owner saw) */
const HEAD = /^Boss(Head|Face|Glass|Nose|Moustache|Ear|Hair|Tenugui|Knot|Sideburn|Comb|Cap|Pencil)/
const ROLE_TAG: Record<Role, string> = { chef: '二廚', sous: '三廚', server: '外場', cashier: '收銀', stock: '倉儲' }
const UNINKED = /(Eye|Shine|Brow|Cheek|Mouth|Tongue|Print|Collar|Knot|Cord|Nose|Thumb|Glass|Hem|Fan|Comb|Towel|Sideburn)/
/** where a server's tray is held, and the stock keeper's clipboard: on the hands, out in front of the belly (the figure's frame) */
export const TRAY_AT: [number, number, number] = [0, 0.4, 0.36]
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }

const AV_SKIN = ['#f3d2b0', '#eac39c', '#e2b48a', '#f6dcc0', '#d9a77e']
const AV_HAIR = ['#2b1d14', '#3a2a20', '#1c1c22', '#5a3a2a', '#4a3020', '#6b4a32']
const avHash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

type Built = { root: THREE.Group }
/** the parts that move (the figure's bones), in the order the mesh's vertices name them */
const BONES = ['body', 'eyes', 'glasses', 'handL', 'handR', 'fan', 'tray', 'clip'] as const
type Part = (typeof BONES)[number]
/** where in a part's mesh the skin or the hair is (its vertices from `start`, `count` of them), coloured for each person */
type Tint = { start: number; count: number; tint: 'skin' | 'hair' | 'nose' }
const made = new Map<Variant, Built>()
/** a material's twin of their own, for fading someone out of (or into) a doorway: hashed from the start (as the customers' and the
 * owner's are: alphaHash at full opacity drops nothing), so only its opacity moves and no other program is ever wanted for it */
function fadeOf(m: THREE.Material) {
  const c = m.clone()
  c.onBeforeCompile = m.onBeforeCompile
  c.customProgramCacheKey = m.customProgramCacheKey
  return c
}

/** which part of the figure a mesh belongs to, by its node's name (or an ancestor's) */
function partOf(o: THREE.Object3D): Part | 'drop' {
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

/** a server's round lacquered tray with a cup of tea on it, and the stock keeper's clipboard with its list, in the figure's frame at rest
 * where they're held (they were meshes of their own, two draws each), their colours in their vertices */
function heldPieces(): { geo: THREE.BufferGeometry; part: Part }[] {
  const piece = (g: THREE.BufferGeometry, colour: string, m: THREE.Matrix4) => {
    const out = bakeable(g, m)
    colourVertices(out, new THREE.Color(colour))
    g.dispose()
    return out
  }
  const at = new THREE.Matrix4().makeTranslation(TRAY_AT[0], TRAY_AT[1], TRAY_AT[2])
  const clip = new THREE.Matrix4().makeTranslation(TRAY_AT[0], TRAY_AT[1] + 0.04, TRAY_AT[2] - 0.02).multiply(new THREE.Matrix4().makeRotationX(-0.6))
  return [
    { part: 'tray', geo: piece(new THREE.CylinderGeometry(0.1, 0.095, 0.014, 12), '#3a1a14', at) },
    { part: 'tray', geo: piece(new THREE.CylinderGeometry(0.024, 0.02, 0.05, 8), '#e8dcc0', at.clone().multiply(new THREE.Matrix4().makeTranslation(0.03, 0.03, 0))) },
    { part: 'clip', geo: piece(new THREE.BoxGeometry(0.12, 0.008, 0.16), '#c9a66b', clip) },
    { part: 'clip', geo: piece(new THREE.PlaneGeometry(0.1, 0.12), '#f7f3ea', clip.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.005, 0.01)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))) },
  ]
}

/** the variant's figure, built once: one material, one mesh moved in parts by its groups, one ink line round its inked pieces; only what
 * the variant ever holds in it (a cook's fan, a server's tray, the stock keeper's clipboard: hidden, they'd still be drawn, as nothing) */
function build(scene: THREE.Group, v: Variant): Built {
  const holds: Part[] = v === 'chef' || v === 'chefF' ? ['fan'] : v === 'stock' ? ['clip'] : ['tray']
  const s = scene.clone(true)
  s.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(s.matrixWorld).invert()
  // (the eyes' whites and darks flat, unlit; the skin and hair marked, to be each person's own)
  s.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const n = (m.material as THREE.Material).name
    m.userData.flat = /White|Dark/.test(n)
    m.userData.tint = /CrewSkin|CrewFace/.test(n) ? 'skin' : /CrewHair/.test(n) ? 'hair' : /CrewNose/.test(n) ? 'nose' : undefined
    // (the face's sheet of expressions and the glasses' frames painted, for the atlas to take in)
    // (the face is the head's own front: its sheet over each person's skin (their tint), where nothing's drawn the skin)
    if (n === 'CrewFace') (m.material as THREE.MeshStandardMaterial).map = crewFaceSheet(v === 'chefF' || v === 'serverF' ? 'female' : 'male')
  })
  const mat = atlasModel(s, (m) => partOf(m) !== 'drop', (atlas) => paintable(airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', map: atlas, vertexColors: true, gradientMap, alphaHash: true })), { decal: true }))!
  // (every piece of it in the figure's frame, its part, inked or not, flat or not, skin or hair)
  const pieces: (SkinPiece & { tint?: Tint['tint'] })[] = []
  let face = -1
  s.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const part = partOf(m)
    if (part === 'drop' || (part === 'fan' && !holds.includes('fan'))) return
    if (m.name === 'BossFace') face = pieces.length
    pieces.push({ geo: bakeable(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)), bone: BONES.indexOf(part),
      inked: !UNINKED.test(m.name), flat: !!m.userData.flat, shadowless: HEAD.test(m.name), decal: m.name === 'BossFace', tint: m.userData.tint })
  })
  for (const h of heldPieces()) {
    if (holds.includes(h.part)) pieces.push({ geo: h.geo, bone: BONES.indexOf(h.part) })
    else h.geo.dispose()
  }
  // (the parts' groups, each at the place it's moved about: a hand at where it hangs, the eyes at their middle (to close), the rest at the
  // figure's)
  const root = new THREE.Group()
  root.name = 'body'
  const bones: THREE.Object3D[] = [root]
  for (const name of BONES.slice(1)) {
    const g = new THREE.Group()
    g.name = name
    if (name === 'handL') g.position.copy(REST.L)
    else if (name === 'handR') g.position.copy(REST.R)
    else if (name === 'eyes') {
      const bb = new THREE.Box3()
      for (const p of pieces) if (p.bone === BONES.indexOf('eyes')) { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox!) }
      if (!bb.isEmpty()) bb.getCenter(g.position)
    }
    root.add(g)
    bones.push(g)
  }
  // (where the skin and hair fall in the one mesh, by the order its pieces go in)
  const tints: Tint[] = []
  let start = 0
  for (const p of pieces) {
    const n = p.geo.attributes.position.count
    if (p.tint) tints.push({ start, count: n, tint: p.tint })
    start += n
  }
  const { mesh } = rigidFigure(root, pieces, mat, bones, 0.006)
  markFace(mesh, faceRange(pieces, face))
  for (const p of pieces) p.geo.dispose()
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (tints.length) mesh.userData.tints = tints
  return { root }
}

/**
 * Someone working in the shop at their place: a cook at the fire (fanning the coals now and then), a server holding a tray out on both
 * hands, the cashier with their hands together, the stock keeper with his clipboard; `moving`: walking somewhere (a server carrying a
 * plate, the stock keeper a case). Faces +z, stands on y 0.
 */
// (drawn again only when its own props change: the staff stand in parents that redraw several times a second, and they move by their own frames)
export const StaffFigure = memo(StaffFigureImpl)
function StaffFigureImpl({ id, role, look: who, moving = false, seated = false, face: faceAsked }: { id: string; role: Role; look: StaffLook; moving?: boolean
  /** a face to make, whatever they're doing (the character viewer's buttons) */
  face?: CrewFace
  /** sat (the cashier on the till's chair): leaning in a little, the hands up on the counter in front, now and then tapping at the keys */
  seated?: boolean }) {
  const h = avHash(id)
  const seed = h % 997
  const cook = role === 'chef' || role === 'sous'
  const v = variantOf(role, who.female)
  const gltf = useGLTF(url(v)) as unknown as { scene: THREE.Group }
  const fig = useMemo(() => {
    if (!made.has(v)) made.set(v, build(gltf.scene, v))
    const base = made.get(v)!
    // (a copy whose one mesh is bound to the copy's own parts)
    const root = cloneFigure(base.root) as THREE.Group
    const old = who.age === 'old'
    const glasses = (h >> 7) % 5 === 0 || (old && (h >> 7) % 2 === 0)
    const get = (n: string) => root.getObjectByName(n) ?? null
    // (what they don't have scaled to nothing: their part of the one mesh drawn as nothing)
    get('glasses')?.scale.setScalar(glasses ? 1 : 0)
    get('tray')?.scale.setScalar(role === 'server' ? 1 : 0)
    get('clip')?.scale.setScalar(0)
    return { root, body: root, handL: get('handL'), handR: get('handR'), fan: get('fan'), eyes: get('eyes'), clip: get('clip') }
  }, [gltf, v, h, who.age, role])
  // (their skeleton's picture let go as they go)
  useEffect(() => () => releaseFigure(fig.root), [fig])
  // (their own skin and hair: colours over the variant's shape, in a colour attribute of their own, the shape's other attributes shared.
  // Made as they're shown and undone as they go: the shared shape put back on their meshes, only their own colours let go. They were made
  // with the figure and let go in an effect, and the effect's let-go ran once before they were ever drawn (React's strict checks unmount
  // and mount again): it took the shared shape off the meshes still drawn, and they drew nothing but their ink, black (the owner saw it))
  useLayoutEffect(() => {
    const old = who.age === 'old'
    // (a hash past 2^31 makes `h >> 3` negative and its pick nothing: their hair then stays the model's own, as it always has)
    const pickHair = old ? ((h >> 4) & 1 ? '#d6d1c8' : '#a9a49c') : AV_HAIR[(h >> 3) % AV_HAIR.length]
    const skin = new THREE.Color(AV_SKIN[h % AV_SKIN.length])
    const hair = pickHair ? new THREE.Color(pickHair) : null
    // (the nose their skin, a little rosy)
    const nose = skin.clone().multiply(new THREE.Color('#ffd2c4'))
    // (their face their own too: its UVs, slid from one expression to the next (scene/faceSheet))
    return ownShape(fig.root, (m, col) => {
      const tints = m.userData.tints as Tint[] | undefined
      if (!tints) return false
      for (const t of tints) {
        const c = t.tint === 'skin' ? skin : t.tint === 'nose' ? nose : hair
        if (c) for (let i = t.start; i < t.start + t.count; i++) col.setXYZ(i, c.r, c.g, c.b)
      }
      return true
    })
  }, [fig, h, who.age])
  // (their name tag's words (App keeps who's who); their role alone before it's known)
  const nameTag = useMemo(() => () => SPEAKERS.get(id) ?? ROLE_TAG[role], [id, role])
  // (their face (setExpression): what they're doing says it; a squash and stretch as it changes, or as they start to say something)
  const faceWas = useRef<{ face: CrewFace; at: number; said: number; carry: boolean }>({ face: 'idle', at: -1e9, said: 0, carry: false })
  // (a cook fans the fire only now and then: a spell of it, the fan in hand, then put down; each to their own times)
  const [fanning, setFanning] = useState(false)
  const clock = useRef(0)
  const outer = useRef<THREE.Group>(null)
  const last = useRef<THREE.Vector3 | null>(null)
  const pace = useRef(0)
  // (their footfalls' puffs of dust (scene/DustPuffs), and how tall they stand in the world, measured once)
  const steps = useRef(newSteps())
  const tall = useRef(0)
  const faded = useRef<{ was: Map<THREE.Mesh, THREE.Material | THREE.Material[]>; mats: THREE.Material[] } | null>(null)
  const inks = useRef<THREE.Mesh[]>([])
  useEffect(() => () => { if (faded.current) { for (const [m, mat] of faded.current.was) m.material = mat; for (const c of faded.current.mats) c.dispose(); faded.current = null } }, [fig])
  useEffect(() => { fig.fan?.scale.setScalar(0) }, [fig])
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
    if (!tall.current) { const b = new THREE.Box3().setFromObject(fig.root); if (!b.isEmpty()) tall.current = b.max.y - b.min.y }
    // (not on the character viewer's turntable: its own little canvas, the puffs are the room's)
    if (tall.current && o.visible && !id.startsWith('viewer-')) footDust(steps.current, at, walk, tall.current, dt)
    // (what their walk says they're doing just now: the chef carrying food back in both hands, preparing it on the board, fanning the coals
    // for something on the fire (Roasting's CrewWalk); anyone finishing up for the day with a stretch, nodding back in at the door, fading
    // through it (commuteWalk))
    const job = o.parent?.userData as { carry?: boolean; prep?: boolean; fanNow?: boolean; fetcher?: boolean; stretch?: boolean; nod?: number; fade?: number; lean?: number; wipe?: number } | undefined
    // (how much of them shows: their own copies of the materials while they're fading, the shared ones back after; their ink line thinned
    // with them to nothing (as the customers' is: put away at once, it went in a blink before the rest of them))
    const fade = job?.fade ?? 1
    if (fade < 0.999 && !faded.current) {
      const was = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>(), mats: THREE.Material[] = []
      fig.root.traverse((q) => {
        const m = q as THREE.Mesh
        if (!m.isMesh) return
        if ((m.material as THREE.Material).type === 'ShaderMaterial') { thinWithFade(m); inks.current.push(m); return }
        was.set(m, m.material)
        const one = (x: THREE.Material) => { const c = fadeOf(x); mats.push(c); return c }
        m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material)
      })
      faded.current = { was, mats }
    }
    if (faded.current) {
      if (fade >= 0.999) {
        for (const [m, mat] of faded.current.was) m.material = mat
        for (const m of inks.current) { m.userData.fade = 1; m.visible = true }
        inks.current = []
        for (const c of faded.current.mats) c.dispose()
        faded.current = null
      } else {
        for (const c of faded.current.mats) c.opacity = fade
        for (const m of inks.current) { m.userData.fade = fade; m.visible = fade > 0.04 }
      }
    }
    if (cook) {
      const f = job?.fetcher ? !!job.fanNow : (t + seed * 3.7) % 17 < 6 && !moving
      if (f !== fanning) setFanning(f)
    }
    // (a waddle as they walk, as Overcooked's cooks do: bobbing at each step, rocking side to side; standing, breathing)
    const ph = t * 9
    fig.body.position.y = walk * Math.abs(Math.sin(ph)) * 0.035
    fig.body.rotation.z = walk * Math.sin(ph) * 0.07
    // (a bow of the head and shoulders at the door)
    fig.body.rotation.x = walk * 0.08 + (seated ? 0.07 : 0) + (job?.nod ?? 0) * 0.28 + (job?.lean ?? 0)
    // ---- their face: focused at the board, the fan or the till's keys; glad carrying a dish out; alarmed as a customer complains of the
    // wait (RUSH); talking while a word of theirs is up (STAFF_TALK); a blink every few seconds; the viewer's face over all of it
    const now = performance.now()
    const word = STAFF_TALK.find((w) => w.id === id)
    const tapping = seated && (t + seed) % 7 < 2.2
    let face: CrewFace = faceAsked ?? (now - RUSH.at < 2500 ? 'panic' : job?.prep || job?.fanNow || (cook && fanning) || tapping || job?.wipe !== undefined ? 'focused'
      : job?.carry || job?.stretch || (job?.nod ?? 0) > 0.2 ? 'happy' : 'idle')
    if (!faceAsked && word && Math.sin(t * 17) + Math.sin(t * 7.3) * 0.6 > 0.2) face = 'talk'
    if ((t + seed * 0.9) % 3.4 < 0.15 && (face === 'idle' || face === 'focused' || face === 'talk')) face = 'blink'
    const fw = faceWas.current
    const settled = (f: CrewFace) => (f === 'blink' || f === 'talk' ? 'idle' : f)
    if (settled(face) !== settled(fw.face) || (word && word.key !== fw.said) || (!!job?.carry && !fw.carry)) fw.at = t
    fw.face = face
    fw.said = word?.key ?? fw.said
    fw.carry = !!job?.carry
    setFace(fig.root, face)
    const [jw, jh] = jelly(t - fw.at)
    fig.body.scale.set(jw, (1 + (1 - walk) * Math.sin(t * 2 + seed) * 0.008) * jh, jw)
    const hold = role === 'server' || role === 'stock' || job?.carry ? 1 : role === 'cashier' ? 0.6 : 0
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
      if (job?.stretch) {
        // (finishing up: both arms up over the head in a long stretch, swaying a little)
        hand.position.set(sd * 0.16, 0.95 + Math.sin(t * 1.6) * 0.03, 0.02)
        hand.rotation.x = 0
      }
      if (job?.prep) {
        // (working at the board: both hands down in front, the knife hand cutting, the other holding it)
        hand.position.set(sd * 0.12, 0.3 + (sd > 0 ? Math.abs(Math.sin(t * 11)) * 0.05 : 0), 0.3)
        hand.rotation.x = -0.6
      }
      if (job?.wipe !== undefined && sd > 0) {
        // (wiping the bar down: the hand out in front on the cloth on the bar's top (0.79: the bar at a server's height), along and back twice)
        hand.position.set(0.06 + Math.sin(job.wipe * Math.PI * 4) * 0.12, 0.79, 0.4)
        hand.rotation.x = -1.3
      }
      if (cook && fanning && sd > 0) {
        hand.position.set(0.3, 0.42 + Math.sin(t * 7) * 0.03, 0.18)
        hand.rotation.z = Math.sin(t * 7) * 0.4
      } else hand.rotation.z = 0
    }
    if (fig.fan && fig.handR) {
      const shown = cook && fanning
      fig.fan.scale.setScalar(shown ? 1 : 0)
      if (shown) { fig.fan.position.copy(fig.handR.position).add(new THREE.Vector3(0, 0.03, 0.02)); fig.fan.rotation.z = fig.handR.rotation.z }
    }
    // (the stock keeper's clipboard, held up while they stand)
    fig.clip?.scale.setScalar(role === 'stock' && !moving ? 1 : 0)
  })
  return (
    <group ref={outer} userData={{ staffRole: role }}>
      {/* (named as the pointer's over them: their role and name; never to be dragged, they keep to their work. Not in the viewer) */}
      {!id.startsWith('viewer-') && <FigureHit title={nameTag} />}
      {/* (a server's tray with a cup of tea on it, the stock keeper's clipboard: parts of the one mesh, shown as they're held) */}
      <primitive object={fig.root} />
    </group>
  )
}

for (const v of VARIANTS) useGLTF.preload(url(v))

/**
 * Every outfit built and drawn as the shop loads, out of sight under the kitchen's floor, a few frames, then gone (the loading veil held
 * meanwhile): the staff only come in once it opens, and the programs they're drawn with, their shadows' among them (only drawing a thing
 * into the shadow's picture makes its program), were made as they first walked in, a frame stopped each.
 */
export function StaffWarm() {
  const gltfs = VARIANTS.map((v) => useGLTF(url(v)) as unknown as { scene: THREE.Group })
  const roots = useMemo(() => VARIANTS.map((v, i) => {
    if (!made.has(v)) made.set(v, build(gltfs[i].scene, v))
    const r = cloneFigure(made.get(v)!.root) as THREE.Group
    warmLater(r)
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])
  const [on, setOn] = useState(true)
  const frames = useRef(0)
  useEffect(() => (on ? holdVeil('staff-warm') : undefined), [on])
  useEffect(() => () => { for (const r of roots) releaseFigure(r) }, [roots])
  useFrame(() => { if (on && ++frames.current > 40) setOn(false) })
  return on ? <group position={[0, -0.6, 0]}>{roots.map((r, i) => <primitive key={i} object={r} position={[i * 0.3, 0, 0]} />)}</group> : null
}
