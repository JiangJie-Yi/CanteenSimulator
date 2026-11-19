import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { rimmedTray } from './trayGeometry'
import { featuresOf, variantOf, type CrewVariant } from '@/data/crewLook'
import { footDust, newSteps } from './DustPuffs'
import type { Look as StaffLook, Role } from '@/data/staff'
import { atlasModel } from './atlasMerge'
import { airbrush, gradientMap } from './Person3D'
import { cloneFigure, paintable, releaseFigure, rigidFigure, thinWithFade, type SkinPiece } from './rigidSkin'
import { bakeable, colourVertices } from './StaticBatch'
import { warmLater } from './Prewarm'
import { holdVeil } from './Later'
import { crewFaceSheet, crewFrame, faceRange, markFace, ownShape, setFace, squash as jelly, type CrewFace } from './faceSheet'
import { faceNow, newFaceLife, type FaceLife } from '@/game/faceLife'
import { ATMOS, CREW_BONDS, CREW_LOAD, CREW_MOOD, RUSH, SPEAKERS, STAFF_IDLE, STAFF_SAY, STAFF_TALK, STAFF_TIRED, URGED } from '@/game/shopState'
import { crewMood, newCrewMood, type CrewEmote, type CrewMoodState } from '@/game/crewMood'
import { CREW_BUSY, CREW_TIRED } from '@/data/crewMoodLines'
import { makeEmote, type Emote } from './crewEmote'
import { activityOf } from '@/data/staff'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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
// (which model a job and a sex is dressed as, and each person's own skin, hair and glasses: data/crewLook, the list their picture in the
// office draws from too (item 321))
type Variant = CrewVariant
const url = (v: Variant) => import.meta.env.BASE_URL + `models/crew_${v}.glb`
const VARIANTS: Variant[] = ['chef', 'chefF', 'server', 'serverF', 'stock']

/** the small parts: no ink line round them */
/** the head and what's on it, which take no shadow (as the customers' don't): the face's and the glasses' patches are see-through
 * rectangles off the face, and the shadow pass (no alphaTest: they're hashed) cast them whole, black blocks over the eyes (the owner saw) */
const HEAD = /^Boss(Head|Face|Glass|Nose|Moustache|Ear|Hair|Tenugui|Knot|Sideburn|Comb|Cap|Pencil)/
const ROLE_TAG: Record<Role, string> = { chef: '二廚', sous: '三廚', server: '外場', cashier: '收銀', stock: '倉儲' }
const UNINKED = /(Eye|Shine|Brow|Cheek|Mouth|Tongue|Print|Collar|Knot|Cord|Nose|Thumb|Glass|Hem|Fan|Comb|Towel|Sideburn)/
/**
 * The broom a floor server sweeps up broken glass with (blender/broom.py, 1.2 m made; game/spills, GuestBar3D): how long it's drawn in a
 * figure's own frame, and its pose `t` seconds into sweeping: its foot on the floor before them, swept from side to side, its handle up
 * through their hands, the right (-x) above the left. The vectors are shared: read them at once
 */
const BROOM_URL = import.meta.env.BASE_URL + 'models/broom.glb'
const BROOM_LEN = 0.6
const SWEEP = { foot: new THREE.Vector3(), dir: new THREE.Vector3(), upper: new THREE.Vector3(), lower: new THREE.Vector3() }
const SWEEP_TOP = new THREE.Vector3()
/** how far forward of the figure the handle's top is (the figure's frame): a server's, slim, holds it back near the belly; the owner's belly is
 * broad, so his hands, on that line, were inside it and showed as a fist at his side (the owner's, 2026-11-12): his handle stands nearer upright,
 * its hands out where his tray is carried (TRAY_AT) */
export const SWEEP_LEAN = { server: 0.07, owner: 0.3 }
export function sweepPose(t: number, lean = SWEEP_LEAN.server) {
  const s = Math.sin(t * Math.PI * 1.8)
  // (the floor's top a little over their own foot's level, as they stand on the room's boards (measured: 4 of the figure's hundredths))
  SWEEP.foot.set(-0.04 + s * 0.11, 0.04, 0.36)
  SWEEP_TOP.set(-0.07 + s * 0.03, 0.5, lean)
  SWEEP.dir.copy(SWEEP_TOP).sub(SWEEP.foot).normalize()
  SWEEP.upper.copy(SWEEP.foot).addScaledVector(SWEEP.dir, BROOM_LEN * 0.84)
  SWEEP.lower.copy(SWEEP.foot).addScaledVector(SWEEP.dir, BROOM_LEN * 0.6)
  return SWEEP
}
/**
 * The owner sweeps stooped over a hand broom and a dustpan (the owner's, 2026-11-12: bent over, with a little broom; then "change the broom, and
 * his hands don't move": the long broom made smaller was a thin stick, and his hands, set by their bones' origins, stood out wide or inside
 * his belly). His whole figure tipped forward `OWNER_BEND` about his feet (GuestBar3D's OwnerWalker); a short hand broom (a straw fan bound
 * on a bamboo handle, 手箒) in his right hand, swept across toward the dustpan held flat on the floor in his left. Worked out in the room's
 * upright frame (the floor at y 0, forward +z; his right hand at +x) and carried back into his tipped one, so what's on the floor stays on it
 */
export const OWNER_BEND = 0.5
/** the hand broom's whole length (the straw and the handle), in the figure's frame */
export const HAND_BROOM_LEN = 0.2
const OWNER_SWEEP = { foot: new THREE.Vector3(), dir: new THREE.Vector3(), upper: new THREE.Vector3(), lower: new THREE.Vector3(), pan: new THREE.Vector3() }
const OWNER_TOP = new THREE.Vector3()
const unbend = (v: THREE.Vector3) => {
  const c = Math.cos(OWNER_BEND), n = Math.sin(OWNER_BEND)
  return v.set(v.x, v.y * c + v.z * n, -v.y * n + v.z * c)
}
/**
 * Wiping a spill off the floor after sweeping its glass up (item 164, the owner's, 2026-11-15: "the cloth and the little broom out together?":
 * the stoop was the sweep's, and with it the broom and the dustpan): stooped the same, the broom and the pan put by; the right hand flat on
 * the cloth where it goes round on the floor (`at`: the cloth, in the figure's upright frame), the left on the knee. The same tipped frame as
 * the sweep's
 */
const WIPE_POSE = { right: new THREE.Vector3(), left: new THREE.Vector3() }
const WIPE_AT = new THREE.Vector3()
export function floorWipePose(at: THREE.Vector3) {
  // (the palm a hand's thickness over the cloth)
  unbend(WIPE_POSE.right.set(at.x, at.y + 0.03, at.z))
  unbend(WIPE_POSE.left.set(-0.13, 0.3, 0.36))
  return WIPE_POSE
}
/** `upper`: the right hand, on the broom's handle; `lower`: the left, on the dustpan's grip; `pan`: the dustpan's middle on the floor */
export function ownerSweepPose(t: number) {
  const s = Math.sin(t * Math.PI * 2.2)
  const f = OWNER_SWEEP
  // (the straw's tip on the floor out in front, swept from his right across toward the pan at his left, the handle up and back to his hand)
  f.foot.set(0.1 - (s * 0.5 + 0.5) * 0.14, 0.012, 0.66)
  OWNER_TOP.set(0.16 - (s * 0.5 + 0.5) * 0.06, 0.2, 0.58)
  f.dir.copy(OWNER_TOP).sub(f.foot).normalize()
  f.upper.copy(f.foot).addScaledVector(f.dir, HAND_BROOM_LEN * 0.9)
  f.pan.set(-0.12, 0.006, 0.68)
  f.lower.set(-0.15, 0.06, 0.6)
  unbend(f.foot); unbend(f.upper); unbend(f.lower); unbend(f.dir); unbend(f.pan)
  return f
}
/** the hand broom and the dustpan, made once in plain colours (a few dozen faces each; Low-Poly rule): the broom's straw tip at its origin, up +y */
const HAND_BROOM_MATS = {
  straw: new THREE.MeshToonMaterial({ color: '#c9a35c' }),
  cane: new THREE.MeshToonMaterial({ color: '#7a5230' }),
  cord: new THREE.MeshToonMaterial({ color: '#b3261e' }),
  tin: new THREE.MeshToonMaterial({ color: '#2f5f7a' }),
}
function makeHandBroom() {
  const g = new THREE.Group()
  // (the straw: a flat fan, wide at its tip, narrowing up to where it's bound)
  const W0 = 0.075, W1 = 0.016, T0 = 0.012, T1 = 0.01, H = 0.1
  const fan = new THREE.BufferGeometry()
  const v = [-W0, 0, -T0, W0, 0, -T0, W0, 0, T0, -W0, 0, T0, -W1, H, -T1, W1, H, -T1, W1, H, T1, -W1, H, T1]
  fan.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  fan.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7, 0, 3, 2, 0, 2, 1])
  fan.computeVertexNormals()
  const straw = new THREE.Mesh(fan, HAND_BROOM_MATS.straw)
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.014, 8), HAND_BROOM_MATS.cord)
  cord.scale.z = 0.7
  cord.position.y = H - 0.004
  const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.009, HAND_BROOM_LEN - H, 6), HAND_BROOM_MATS.cane)
  cane.position.y = H + (HAND_BROOM_LEN - H) / 2
  for (const m of [straw, cord, cane]) { m.castShadow = true; m.raycast = () => {}; g.add(m) }
  g.visible = false
  return g
}
function makeDustpan() {
  const g = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.006, 0.1), HAND_BROOM_MATS.tin)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.006), HAND_BROOM_MATS.tin)
  back.position.set(0, 0.022, -0.05)
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.1), HAND_BROOM_MATS.tin)
  sideL.position.set(-0.062, 0.015, 0)
  const sideR = sideL.clone()
  sideR.position.x = 0.062
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), HAND_BROOM_MATS.cane)
  grip.position.set(0, 0.05, -0.08)
  grip.rotation.x = -0.6
  for (const m of [floor, back, sideL, sideR, grip]) { m.castShadow = true; m.raycast = () => {}; g.add(m) }
  g.visible = false
  return g
}
const UP_Y = new THREE.Vector3(0, 1, 0)
/** the broom, made over for the room (its toon light; its straw, bamboo and cord as they're made), a copy for each who might hold it, hidden */
function makeBroom(src: THREE.Object3D) {
  const r = src.clone(true)
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const was = m.material as THREE.MeshStandardMaterial
    m.material = BROOM_MATS.get(was) ?? BROOM_MATS.set(was, new THREE.MeshToonMaterial({ color: was.color.clone(), map: was.map ?? null })).get(was)!
    m.castShadow = true
    m.raycast = () => {}
  })
  const g = new THREE.Group()
  g.add(r)
  r.scale.setScalar(BROOM_LEN / 1.2)
  g.visible = false
  return g
}
const BROOM_MATS = new Map<THREE.Material, THREE.Material>()
/**
 * The broom in the hands of whoever's holding it (its holder's userData: `sweep`, seconds into sweeping; `broom`, carried): swept with the
 * pose; carried upright at their side, its foot clear of the floor. For a figure that isn't a StaffFigure (the owner out serving, GuestBar3D's
 * OwnerWalker): it finds its holder's userData up the way
 */
export function SweepBroom({ lean = SWEEP_LEAN.server, owner = false }: { lean?: number; owner?: boolean }) {
  const gltf = useGLTF(BROOM_URL) as unknown as { scene: THREE.Group }
  const broom = useMemo(() => (owner ? makeHandBroom() : makeBroom(gltf.scene)), [gltf, owner])
  // (the owner's dustpan, held flat on the floor in his left hand while he sweeps)
  const pan = useMemo(() => (owner ? makeDustpan() : null), [owner])
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    let job: { sweep?: number; broom?: boolean } | undefined
    for (let q = g.current?.parent ?? null, k = 0; q && k < 4; q = q.parent, k++) if ('broom' in q.userData) { job = q.userData; break }
    poseBroom(broom, job?.sweep, !!job?.broom, null, lean, owner)
    if (pan) {
      pan.visible = job?.sweep !== undefined
      if (pan.visible) { pan.position.copy(ownerSweepPose(job!.sweep!).pan); pan.rotation.set(-OWNER_BEND, 0, 0) }
    }
  })
  return <group ref={g}><primitive object={broom} />{pan && <primitive object={pan} />}</group>
}
/** the broom posed: swept (`sweep` seconds in), carried (by `hand`, or at the side), or put away */
function poseBroom(broom: THREE.Object3D, sweep: number | undefined, carried: boolean, hand: THREE.Object3D | null, lean = SWEEP_LEAN.server, owner = false) {
  broom.visible = sweep !== undefined || carried
  if (sweep !== undefined) {
    const p = owner ? ownerSweepPose(sweep) : sweepPose(sweep, lean)
    broom.position.copy(p.foot)
    broom.quaternion.setFromUnitVectors(UP_Y, p.dir)
  } else if (carried) {
    // (the hand broom carried hanging from the right hand at the side, its handle in it)
    if (owner) broom.position.set(hand ? hand.position.x : 0.31, (hand ? hand.position.y : 0.26) - HAND_BROOM_LEN * 0.9, (hand ? hand.position.z : 0.05) + 0.01)
    else if (hand) broom.position.set(hand.position.x, hand.position.y - 0.25, hand.position.z + 0.015)
    else broom.position.set(-0.3, 0.03, 0.12)
    broom.quaternion.identity()
  }
}
/** where a server's tray is held, and the stock keeper's clipboard: on the hands, out in front of the belly (the figure's frame) */
export const TRAY_AT: [number, number, number] = [0, 0.4, 0.36]
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }
const REACH_A = new THREE.Vector3(), REACH_B = new THREE.Vector3()
/** where a lean to their work bends them, a share of their height up from their feet (a counter's top on them) (item 387) */
const LEAN_WAIST = 0.55
/** (a scratch vector: the figure's scale, for its emotes' height in its own frame, item 381) */
const EMOTE_SCALE = new THREE.Vector3()
/** the hand wiping the bar down: up on the cloth, out in front (GuestBar3D lays the cloth under it, from the same reach) */
export const WIPE_HAND = { y: 0.83, z: 0.44 }
/** where the hand (and the cloth under it) is `p` (0..1) into a wipe of the bar, in the figure's own frame (x across, z out in front): three
 * strokes side to side, worked in from the far side of the place toward them, as crumbs are wiped (item 231, the owner's 「收東西跟擦桌子的動畫都還
 * 很不OK」: it went to and fro on one line, twice, in a second) */
export const wipeStroke = (p: number): [number, number] => [0.06 + 0.13 * Math.sin(p * Math.PI * 3 - Math.PI / 2), WIPE_HAND.z + 0.06 - 0.12 * Math.min(1, Math.max(0, p))]
/** the hands shaping a rice ball at the rice-ball counter: out over its board (GuestBar3D holds the ball between them, from the same reach) */
// (the counter's top is up at the chest: the board's at 0.98 of a figure's height units, a step out before them)
export const SHAPE_HAND = { y: 0.96, z: 0.55 }
/** a handheld game (the owner's: what one of the staff slacking has out, their thumbs at it): a dark body with its screen lit, a red grip on its
 * left and a blue one on its right, made once (its colours in its points, one draw), in the figure's frame where it's held up before the
 * chest, its screen tipped up toward the face (the owner's, 2026-11-10: it was held down at the belly, its screen to the ceiling, and they
 * looked straight ahead over it); `HANDHELD_TIP` how far its top's tipped back from upright */
const HANDHELD_AT = new THREE.Vector3(0, 0.58, 0.31)
const HANDHELD_TIP = -0.6
const HANDHELD_GEO = (() => {
  const box = (w: number, h: number, d: number, x: number, colour: string, z = 0) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed()
    g.translate(x, 0, z)
    colourVertices(g, new THREE.Color(colour))
    return g
  }
  const parts = [box(0.11, 0.07, 0.012, 0, '#2b2d31'), box(0.09, 0.055, 0.002, 0, '#7fb8e6', 0.007),
    box(0.028, 0.07, 0.016, -0.069, '#ff4554'), box(0.028, 0.07, 0.016, 0.069, '#00b3e3')]
  const g = mergeGeometries(parts)!
  for (const x of parts) x.dispose()
  return g
})()
const HANDHELD_MAT = new THREE.MeshToonMaterial({ vertexColors: true })


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
    // (a tray with a rim standing round it (scene/trayGeometry, item 248): a flat disc it was, read as a plate; its underside where the
    // disc's was, the cup on its floor)
    { part: 'tray', geo: piece(rimmedTray(0.1, 0.02, 0.006), '#3a1a14', at.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.007, 0))) },
    { part: 'tray', geo: piece(new THREE.CylinderGeometry(0.024, 0.02, 0.05, 8), '#e8dcc0', at.clone().multiply(new THREE.Matrix4().makeTranslation(0.03, 0.024, 0))) },
    { part: 'clip', geo: piece(new THREE.BoxGeometry(0.12, 0.008, 0.16), '#c9a66b', clip) },
    { part: 'clip', geo: piece(new THREE.PlaneGeometry(0.1, 0.12), '#f7f3ea', clip.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.005, 0.01)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))) },
    // (its steel clip across the top, holding the list's top edge; the list's lines, written in pencil)
    { part: 'clip', geo: piece(new THREE.BoxGeometry(0.056, 0.01, 0.022), '#5b6168', clip.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.0105, 0.066))) },
    ...[[0.035, 0.07], [0.017, 0.058], [-0.001, 0.07], [-0.019, 0.05], [-0.037, 0.064]].map(([z, len]) => ({ part: 'clip' as Part,
      geo: piece(new THREE.PlaneGeometry(len, 0.0035), '#8a96a3', clip.clone().multiply(new THREE.Matrix4().makeTranslation(0.006 - (0.07 - len) / 2, 0.0058, z)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))) })),
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
  // (their clothes' folds and weave in the light (item 375), as the owner's: blender/boss.py's _body_normals, packed beside their picture)
  const mat = atlasModel(s, (m) => partOf(m) !== 'drop', (atlas, normals) => paintable(airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', map: atlas, vertexColors: true, gradientMap,
    alphaHash: true, ...(normals ? { normalMap: normals } : {}) })), { decal: true }))!
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
  // (what's held is plain colours: its UVs on the atlas's white patch (they ran over the whole atlas, a little picture of it on the clipboard's
  // list: the owner's, 2026-11-10, a strange pattern on it))
  const [wu, wv] = (mat.userData.whiteUv as [number, number] | undefined) ?? [0, 0]
  for (const h of heldPieces()) {
    if (!holds.includes(h.part)) { h.geo.dispose(); continue }
    const uv = h.geo.attributes.uv as THREE.BufferAttribute | undefined
    if (uv) { for (let i = 0; i < uv.count; i++) uv.setXY(i, wu, wv); uv.needsUpdate = true }
    pieces.push({ geo: h.geo, bone: BONES.indexOf(h.part) })
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
/** when one of the staff last said they were swamped, or worn out (performance.now): one at a time, not a chorus as the shop gets busy (item
 * 381); and each one's own last word of it */
const MOOD_SAID = { busy: -1e9, tired: -1e9, by: new Map<string, number>() }
/** (in development, `__crewFeel`: each one's mood as last reckoned, for the checks) */
const CREW_FEEL = new Map<string, unknown>()
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __crewFeel: CREW_FEEL })
export const StaffFigure = memo(StaffFigureImpl)
function StaffFigureImpl({ id, role, look: who, moving = false, seated = false, face: faceAsked }: { id: string; role: Role; look: StaffLook; moving?: boolean
  /** a face to make, whatever they're doing (the character viewer's buttons) */
  face?: CrewFace
  /** sat (the cashier on the till's chair): leaning in a little, the hands up on the counter in front, now and then tapping at the keys */
  seated?: boolean }) {
  const own = featuresOf(id, who)
  const h = own.h
  const seed = h % 997
  const cook = role === 'chef' || role === 'sous'
  const v = variantOf(role, who.female)
  const gltf = useGLTF(url(v)) as unknown as { scene: THREE.Group }
  const fig = useMemo(() => {
    if (!made.has(v)) made.set(v, build(gltf.scene, v))
    const base = made.get(v)!
    // (a copy whose one mesh is bound to the copy's own parts)
    const root = cloneFigure(base.root) as THREE.Group
    const glasses = own.glasses
    const get = (n: string) => root.getObjectByName(n) ?? null
    // (what they don't have scaled to nothing: their part of the one mesh drawn as nothing)
    get('glasses')?.scale.setScalar(glasses ? 1 : 0)
    get('tray')?.scale.setScalar(role === 'server' ? 1 : 0)
    get('clip')?.scale.setScalar(0)
    return { root, body: root, handL: get('handL'), handR: get('handR'), fan: get('fan'), eyes: get('eyes'), clip: get('clip'), tray: get('tray') }
  }, [gltf, v, own.glasses, role])
  // (their skeleton's picture let go as they go)
  useEffect(() => () => releaseFigure(fig.root), [fig])
  // (their own skin and hair: colours over the variant's shape, in a colour attribute of their own, the shape's other attributes shared.
  // Made as they're shown and undone as they go: the shared shape put back on their meshes, only their own colours let go. They were made
  // with the figure and let go in an effect, and the effect's let-go ran once before they were ever drawn (React's strict checks unmount
  // and mount again): it took the shared shape off the meshes still drawn, and they drew nothing but their ink, black (the owner saw it))
  useLayoutEffect(() => {
    // (their own, as their picture has them: data/crewLook (a hash past 2^31 once picked no hair colour, the model's own brown kept))
    const skin = new THREE.Color(own.skin)
    const hair = new THREE.Color(own.hair)
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
  }, [fig, own.skin, own.hair])
  // (their name tag's words (App keeps who's who); their role alone before it's known)
  const nameTag = useMemo(() => () => SPEAKERS.get(id) ?? ROLE_TAG[role], [id, role])
  /** (what a click on them does, in the page's language (item 348)) */
  const staffHint = useMemo(() => () => {
    const l = document.documentElement.lang
    return l.startsWith('ja') ? 'クリック：褒める・急かす' : l.startsWith('en') ? 'Click: praise or hurry them' : '點一下：稱讚或催促'
  }, [])
  // (their face (setExpression): what they're doing says it; a squash and stretch as it changes, or as they start to say something)
  const faceWas = useRef<{ face: CrewFace; at: number; said: number; saidAt: number; carry: boolean; wipe: boolean }>({ face: 'idle', at: -1e9, said: 0, saidAt: -1e9, carry: false, wipe: false })
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
  // (their handheld game, put away till they slack (in the scene from the first, hidden: its program made with the rest at loading))
  const handheld = useMemo(() => {
    const m = new THREE.Mesh(HANDHELD_GEO, HANDHELD_MAT)
    m.position.copy(HANDHELD_AT)
    m.rotation.x = HANDHELD_TIP
    m.visible = false
    m.castShadow = false
    m.raycast = () => {}
    return m
  }, [])
  useEffect(() => { fig.root.add(handheld); return () => { fig.root.remove(handheld) } }, [fig, handheld])
  // (and a broom, put away till they sweep up broken glass (in the scene from the first, hidden, as the game is))
  // (a hand broom and a dustpan (the owner's, 2026-11-12: whoever sweeps stoops over a little broom; the long one put their hands, on its
  // handle near the body, inside the round belly, and they looked to hang still at their sides))
  const bend = useRef(0)
  /** how far their hands are at a job's places (handsAt: eased there and back), and those places in their own frame, each to the hand on its side */
  const reachK = useRef(0)
  /** their face's life (game/faceLife, item 368), and which way they faced last frame (for the eyes to go first where they're turning) */
  const life = useRef<FaceLife | null>(null)
  const yawWas = useRef(0)
  const reachAt = useRef({ L: new THREE.Vector3(), R: new THREE.Vector3() })
  // (item 381, game/crewMood: how they feel, over their head (scene/crewEmote, made once their height's known), in their bearing (shoulders
  // down worn out, a spring in the step glad, leaning in pressed: eased in and out) and their step's own beat)
  const moodS = useRef<CrewMoodState | null>(null)
  const emoteRef = useRef<Emote | null>(null)
  const bearing = useRef({ slump: 0, bounce: 0, hurry: 0 })
  const stepPh = useRef(0)
  const emoteWas = useRef<CrewEmote>('none')
  const pressedWas = useRef(false)
  useEffect(() => () => { emoteRef.current?.g.removeFromParent(); emoteRef.current = null }, [fig])
  const broom = useMemo(() => makeHandBroom(), [])
  const pan = useMemo(() => makeDustpan(), [])
  useEffect(() => { fig.root.add(broom, pan); return () => { fig.root.remove(broom, pan) } }, [fig, broom, pan])
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
    if (tall.current && o.visible && !id.startsWith('viewer-')) footDust(steps.current, at, walk, tall.current, dt, 'staff')
    // (how they feel (item 381): not the character viewer's turntable, nor while they come and go through the door (faded))
    const nowMs = performance.now()
    const viewer = id.startsWith('viewer-')
    const feeling = viewer ? null : crewMood((moodS.current ??= newCrewMood(nowMs, seed)), { now: nowMs, tired: STAFF_TIRED.has(id), load: CREW_LOAD.value,
      bond: CREW_BONDS.get(id) ?? 50, atmos: ATMOS.value, rushAt: RUSH.at, urgedAt: URGED.get(id), feel: CREW_MOOD.get(id) }, seed)
    const B = bearing.current, ease = Math.min(1, dt * 4)
    B.slump += ((feeling?.slump ?? 0) - B.slump) * ease
    B.bounce += ((feeling?.bounce ?? 0) - B.bounce) * ease
    B.hurry += ((feeling?.hurry ?? 0) - B.hurry) * ease
    if (!emoteRef.current && tall.current && !viewer) {
      // (their head's top in their own frame: their height over the scale they're drawn at)
      const sy = fig.root.getWorldScale(EMOTE_SCALE).y || 1
      const top = tall.current / sy
      emoteRef.current = makeEmote(top, top * 0.36)
      fig.root.add(emoteRef.current.g)
    }
    const shows: CrewEmote = feeling && ((o.parent?.userData as { fade?: number } | undefined)?.fade ?? 1) > 0.5 && o.visible ? feeling.emote : 'none'
    if (import.meta.env.DEV && feeling) CREW_FEEL.set(id, { ...feeling, shows, state: moodS.current })
    emoteRef.current?.update(t, shows, feeling?.level ?? 0)
    // (and now and then a word of it: swamped as the shop gets on top of them, worn out as it comes over them; one of the staff at a time, each
    // not again for a good while)
    if (feeling && moodS.current) {
      const said = MOOD_SAID.by.get(id) ?? -1e9
      if (moodS.current.pressed && !pressedWas.current && nowMs - MOOD_SAID.busy > 30000 && nowMs - said > 90000 && Math.random() < 0.35) {
        MOOD_SAID.busy = nowMs
        MOOD_SAID.by.set(id, nowMs)
        STAFF_SAY.say(id, CREW_BUSY)
      }
      if (shows === 'gloom' && feeling.level >= 1 && emoteWas.current !== 'gloom' && nowMs - MOOD_SAID.tired > 45000 && nowMs - said > 120000 && Math.random() < 0.4) {
        MOOD_SAID.tired = nowMs
        MOOD_SAID.by.set(id, nowMs)
        STAFF_SAY.say(id, CREW_TIRED)
      }
      pressedWas.current = moodS.current.pressed
      emoteWas.current = shows
    }
    // (what their walk says they're doing just now: the chef carrying food back in both hands, preparing it on the board, fanning the coals
    // for something on the fire (Roasting's CrewWalk); anyone finishing up for the day with a stretch, nodding back in at the door, fading
    // through it (commuteWalk))
    const job = o.parent?.userData as { carry?: boolean; prep?: boolean; pierce?: number; fanNow?: boolean; fetcher?: boolean; stretch?: boolean; nod?: number; fade?: number; lean?: number; leanBack?: number; wipe?: number
      sweep?: number; broom?: boolean; scrub?: number; shape?: number
      /** wiping the floor (item 164): how long at it, and where the cloth is in their own upright frame */
      floorWipe?: number; wipeAt?: [number, number, number]
      /** both hands where a job wants them, in the world (item 177: on the open sake bottle as it's poured, a tokkuri, a cup) */
      handsAt?: { left: THREE.Vector3; right: THREE.Vector3 }
      /** (a server on an errand: their tray put down, item 249) */
      trayDown?: boolean } | undefined
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
    // (their step's beat: quicker pressed, slower worn out (its own phase, so a change of pace never jumps it))
    stepPh.current += dt * 9 * (1 + 0.25 * B.hurry - 0.22 * B.slump)
    const ph = stepPh.current
    // (the bob of each step bigger glad, flatter worn out; and glad standing, a little bounce on their toes)
    fig.body.position.y = walk * Math.abs(Math.sin(ph)) * 0.035 * (1 + 0.9 * B.bounce - 0.45 * B.slump) + (1 - walk) * B.bounce * Math.max(0, Math.sin(t * 7.5)) * 0.016
    // (and standing, never quite still (item 183, the owner's: "the staff are far too stiff"): their weight shifted from foot to foot, slowly)
    fig.body.rotation.z = walk * Math.sin(ph) * 0.07 + (1 - walk) * Math.sin(t * 0.8 + seed * 2.1) * 0.022
    // (a bow of the head and shoulders at the door)
    const workLean = job?.lean ?? 0
    fig.body.rotation.x = walk * 0.08 + (seated ? 0.07 : 0) + (job?.nod ?? 0) * 0.28 + workLean + (!id.startsWith('viewer-') && walk < 0.2 && activityOf(STAFF_IDLE.get(id)) === 'slack' ? 0.1 : 0)
      // (worn out, their head and shoulders down; pressed, leaning into their stride)
      + 0.13 * B.slump + 0.07 * B.hurry * walk
    // (a lean to their work bent at the waist, about where a counter's top comes on them, not from their feet: what's under it drawn back as
    // what's over it goes forward, so they bend over the counter and not into it (item 387, the owner's 「有個致命的問題動作都會深陷進模型去」:
    // tipped from their feet, the belly went into the counter's front))
    if (tall.current) {
      const own = tall.current / (fig.root.getWorldScale(EMOTE_SCALE).y || 1)
      fig.body.position.z = -LEAN_WAIST * own * Math.sin(workLean)
      // (for whoever puts things in their hands as they lean (GuestBar3D's plater): how far back they've been drawn, in their own measure)
      if (job) job.leanBack = fig.body.position.z
    }
    // ---- their face: focused at the board, the fan or the till's keys; glad carrying a dish out; alarmed as a customer complains of the
    // wait (RUSH); talking while a word of theirs is up (STAFF_TALK); a blink every few seconds; the viewer's face over all of it
    const now = performance.now()
    // (slacking, a good while with nothing to do (data/staff's activityOf): their handheld game out before their chest, head down over it,
    // thumbs going, the face of one deep in a game; not as they walk)
    const slack = !id.startsWith('viewer-') && walk < 0.2 && activityOf(STAFF_IDLE.get(id)) === 'slack' && job?.sweep === undefined && !job?.broom
    const word = STAFF_TALK.find((w) => w.id === id)
    const tapping = seated && (t + seed) % 7 < 2.2
    let face: CrewFace = faceAsked ?? (now - RUSH.at < 2500 ? 'panic' : job?.prep || job?.fanNow || (cook && fanning) || tapping || job?.wipe !== undefined || job?.sweep !== undefined || job?.floorWipe !== undefined || slack ? 'focused'
      : job?.carry || job?.stretch || (job?.nod ?? 0) > 0.2 ? 'happy' : 'idle')
    // (item 368: the shop's mood on them a while (praise, a raise, a cut, a word with a colleague: CREW_MOOD) over their idle or their work's
    // face but a fright; worn out, a tired face for their idle one)
    const mood = CREW_MOOD.get(id)
    if (!faceAsked && mood && mood.until > now && face !== 'panic') face = mood.face
    else if (!faceAsked && face === 'idle' && STAFF_TIRED.has(id)) face = 'tired'
    // (and their mood's face over their idle one (item 381): set to it pressed, glad humming, a sigh, cross with it)
    else if (!faceAsked && face === 'idle' && feeling) face = feeling.emote === 'sweat' ? 'focused' : feeling.emote === 'note' ? 'happy' : feeling.emote === 'gloom' ? 'tired' : feeling.emote === 'anger' ? 'mad' : face
    // (and the face's life over it (game/faceLife): a blink at no fixed beat that closes and opens, a new face through a blink, the mouth in
    // syllables while a word's up, a glance aside now and then while they're free, the eyes first where the head's turning)
    const fl = (life.current ??= newFaceLife(seed * 7.31 + 1, face, t))
    const yawNow = Math.atan2(fig.root.matrixWorld.elements[8], fig.root.matrixWorld.elements[10])
    const turn = dt > 0 ? Math.atan2(Math.sin(yawNow - yawWas.current), Math.cos(yawNow - yawWas.current)) / dt : 0
    yawWas.current = yawNow
    const lifeNow = faceNow(fl, t, face, { free: !faceAsked && walk < 0.2 && !slack && face === 'idle', turn, talk: !faceAsked && !!word })
    face = crewFrame(lifeNow.face as CrewFace, lifeNow)
    const fw = faceWas.current
    const settled = (f: CrewFace) => (f === 'blink' || f === 'half' || f === 'talk' || f === 'talkWide' || f === 'lookL' || f === 'lookR' ? 'idle' : f)
    // (not as they set to wiping the bar down or leave off it: the squash took their head a fifth of a metre down, and the bar's top is
    // at their shoulders, their face went under it (the owner saw a server's face in the bar))
    const wiping = job?.wipe !== undefined
    if ((settled(face) !== settled(fw.face) && wiping === fw.wipe) || (word && word.key !== fw.said) || (!!job?.carry && !fw.carry)) fw.at = t
    if (word && word.key !== fw.said) fw.saidAt = t
    if (wiping) fw.at = Math.min(fw.at, t - 1)
    fw.wipe = wiping
    fw.face = face
    fw.said = word?.key ?? fw.said
    fw.carry = !!job?.carry
    setFace(fig.root, face)
    // (a little nod of the head and shoulders as they start to say something, as one does greeting or serving (item 183))
    if (word) fig.body.rotation.x += Math.max(0, Math.sin(Math.min(1, (t - fw.saidAt) / 0.55) * Math.PI)) * 0.16
    // (and, standing free (not at a task that holds them: the till, a wipe, a sweep, a reach, the handheld), looking about now and then)
    const free = !seated && !slack && !job?.handsAt && job?.wipe === undefined && job?.sweep === undefined && job?.floorWipe === undefined && !id.startsWith('viewer-')
    fig.body.rotation.y = free ? (1 - walk) * (Math.sin(t * 0.31 + seed * 1.7) * 0.13 + Math.sin(t * 0.73 + seed) * 0.04) : 0
    // (no squash and stretch while they sweep, stooped: it pushed the broom's straw and the dustpan into the floor and lifted them off it)
    const stooped = job?.sweep !== undefined || job?.floorWipe !== undefined
    const [jw, jh] = stooped ? [1, 1] : jelly(t - fw.at)
    fig.body.scale.set(jw, (1 + (1 - walk) * Math.sin(t * 2 + seed) * 0.008) * jh, jw)
    const hold = role === 'server' || role === 'stock' || job?.carry ? 1 : role === 'cashier' ? 0.6 : 0
    // (both hands where a job wants them in the world (item 177: the open sake bottle held at its foot and its neck as it's poured, a tokkuri
    // brought up onto the counter, a cup set down): eased to them and back as it begins and ends; each place to the hand on its side (the one
    // further along their +x to the +x hand), so the two never cross)
    const reach = job?.handsAt
    reachK.current += ((reach ? 1 : 0) - reachK.current) * Math.min(1, dt * 12)
    if (reach) {
      fig.root.updateWorldMatrix(true, false)
      const a = fig.root.worldToLocal(REACH_A.copy(reach.left)), b = fig.root.worldToLocal(REACH_B.copy(reach.right))
      if (a.x > b.x) { reachAt.current.R.copy(a); reachAt.current.L.copy(b) } else { reachAt.current.R.copy(b); reachAt.current.L.copy(a) }
    }
    handheld.visible = slack
    if (slack) handheld.position.y = HANDHELD_AT.y + Math.sin(t * 2.2 + seed) * 0.004
    for (const [hand, rest, sd] of [[fig.handL, REST.L, -1], [fig.handR, REST.R, 1]] as const) {
      if (!hand) continue
      // (wiping the floor: the right hand on the cloth, going round with it, the left on the knee)
      if (job?.floorWipe !== undefined) {
        const p = floorWipePose(WIPE_AT.set(...(job.wipeAt ?? [0.05, 0.004, 0.62])))
        hand.position.copy(sd > 0 ? p.right : p.left)
        hand.rotation.set(sd > 0 ? -1.2 : -0.5, 0, 0)
        continue
      }
      // (sweeping up broken glass: both hands on the broom's handle, the right above the left, going with it from side to side)
      if (job?.sweep !== undefined) {
        // (stooped (the body tipped below): the right hand on the hand broom's handle, the left on the dustpan's grip, both out in front)
        const p = ownerSweepPose(job.sweep)
        hand.position.copy(sd > 0 ? p.upper : p.lower)
        hand.rotation.set(-0.5, 0, 0)
        continue
      }
      if (slack) {
        const thumb = Math.max(0, Math.sin(t * (sd > 0 ? 13 : 11) + seed + (sd > 0 ? 1.7 : 0))) * 0.012
        hand.position.set(sd * 0.085, HANDHELD_AT.y + thumb, HANDHELD_AT.z - 0.01)
        hand.rotation.set(HANDHELD_TIP, 0, 0)
        continue
      }
      if (seated) {
        // (on the counter in front, a little apart; a spell of tapping at the keys every so often, a hand at a time) (0.45 up: at 0.4 they
        // rested 6 cm down in the till's counter all the while the cashier sat, item 387)
        const tap = (t + seed) % 7 < 2.2 ? Math.max(0, Math.sin(t * 14 + (sd > 0 ? Math.PI : 0))) * 0.03 : 0
        hand.position.set(sd * 0.15, 0.45 + tap, 0.34)
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
        // (a skewer pushed through what's on the board (Roasting's CHEF_TRIP.pierceAt): the left hand holding it down, the right pushing the
        // rod in from the side, in two shoves)
        if (job.pierce !== undefined) {
          const k = job.pierce, shove = Math.min(1, k * 2) * 0.5 + Math.max(0, Math.min(1, k * 2 - 1)) * 0.5
          if (sd < 0) hand.position.set(-0.06, 0.28, 0.32)
          else hand.position.set(0.3 - 0.2 * shove, 0.3, 0.3)
        }
      }
      if (job?.shape !== undefined) {
        // (shaping a rice ball at the counter (item 129): the hands cupped round it out over the board, the right on top pressing down on it and
        // the left under it, coming together and easing apart three times over, the ball turned a little each time)
        const k = job.shape * Math.PI * 2 * 3, press = 0.5 - 0.5 * Math.cos(k)
        if (sd > 0) hand.position.set(0.02 + 0.015 * Math.sin(k * 0.5), SHAPE_HAND.y + 0.075 - 0.03 * press, SHAPE_HAND.z)
        else hand.position.set(-0.03, SHAPE_HAND.y - 0.01, SHAPE_HAND.z + 0.01)
        hand.rotation.x = sd > 0 ? -1.5 : -0.3
      }
      if (job?.scrub !== undefined) {
        // (washing up at the sink (the owner's, 2026-11-12: the servers had no washing motion): both hands down in front into the basin, the
        // right scrubbing round on the plate, the left holding it, a little dip of the head's height in the arms' reach)
        const k = job.scrub * Math.PI * 10 + (sd > 0 ? 0 : 1.6)
        // (at the basin's height (the counter's top a little over the waist) and out in it, over the plate under the tap: at 0.27 they were
        // down at the knees, on the floor as seen; 0.36 out, they stopped at the counter's front edge)
        hand.position.set(sd * 0.1 + Math.sin(k) * (sd > 0 ? 0.07 : 0.02), 0.64 + (sd > 0 ? Math.abs(Math.sin(k * 0.5)) * 0.03 : 0), 0.6 + Math.cos(k) * (sd > 0 ? 0.04 : 0.01))
        hand.rotation.x = -0.9
      }
      if (job?.wipe !== undefined && sd > 0) {
        // (wiping the bar down: the hand out in front, its palm down on the cloth on the bar's top (0.79 the cloth at a server's height, the
        // hand's middle a hand's thickness up from it: at 0.79 half of it was in the bar), along and back twice)
        const [wx, wz] = wipeStroke(job.wipe)
        hand.position.set(wx, WIPE_HAND.y, wz)
        hand.rotation.x = -1.3
      }
      if (cook && fanning && sd > 0) {
        hand.position.set(0.3, 0.42 + Math.sin(t * 7) * 0.03, 0.18)
        hand.rotation.z = Math.sin(t * 7) * 0.4
      } else hand.rotation.z = 0
    }
    if (reachK.current > 0.002) {
      for (const [hand, sd] of [[fig.handL, -1], [fig.handR, 1]] as const) {
        if (!hand) continue
        hand.position.lerp(sd > 0 ? reachAt.current.R : reachAt.current.L, reachK.current)
        hand.rotation.x += (-0.9 - hand.rotation.x) * reachK.current
        hand.rotation.z *= 1 - reachK.current
      }
    }
    if (fig.fan && fig.handR) {
      const shown = cook && fanning
      fig.fan.scale.setScalar(shown ? 1 : 0)
      if (shown) { fig.fan.position.copy(fig.handR.position).add(new THREE.Vector3(0, 0.03, 0.02)); fig.fan.rotation.z = fig.handR.rotation.z }
    }
    // (the stock keeper's clipboard, held up while they stand)
    fig.clip?.scale.setScalar(role === 'stock' && !moving && !slack ? 1 : 0)
    // (a server's broom: swept, or carried at their side in their right hand, there and back; their tray put by meanwhile)
    // (stooped over it while they sweep, upright after: the whole figure tipped about its feet, the broom and pan in its frame with it)
    bend.current += ((stooped ? OWNER_BEND : 0) - bend.current) * Math.min(1, dt * 8)
    fig.body.rotation.x += bend.current
    poseBroom(broom, job?.sweep, !!job?.broom, fig.handR, undefined, true)
    pan.visible = job?.sweep !== undefined
    if (pan.visible) { pan.position.copy(ownerSweepPose(job!.sweep!).pan); pan.rotation.set(-OWNER_BEND, 0, 0) }
    // (nor while they're down wiping the floor)
    // (nor while both hands are at a job (pouring the sake, item 177))
    // (nor while they're on an errand (GuestBar3D's trayDown: the till, the skewers, the sink, sweeping up): the tray's put down for it, picked
    // up again at their place, item 249)
    fig.tray?.scale.setScalar(role === 'server' && !job?.broom && job?.floorWipe === undefined && !job?.trayDown && reachK.current < 0.5 ? 1 : 0)
  })
  // (clicked: the owner's ways with them (App's popover, item 348); the same handler from one redraw to the next (item 374: a new one each
  // time, their hit box was drawn again with them, 6 times a second))
  const onHit = useCallback((e: ThreeEvent<PointerEvent>) => {
    if ((e.nativeEvent as PointerEvent).button !== 0) return
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('jgs-staff', { detail: { id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } }))
  }, [id])
  return (
    <group ref={outer} userData={{ staffRole: role }}>
      {/* (named as the pointer's over them: their role and name; never to be dragged, they keep to their work. Not in the viewer) */}
      {/* (and clicked: the owner's ways with them, praise or a push (App's popover, item 348)) */}
      {!id.startsWith('viewer-') && <FigureHit title={nameTag} hint={staffHint} onPointerDown={onHit} />}
      {/* (a server's tray with a cup of tea on it, the stock keeper's clipboard: parts of the one mesh, shown as they're held) */}
      <primitive object={fig.root} />
    </group>
  )
}

for (const v of VARIANTS) useGLTF.preload(url(v))
useGLTF.preload(BROOM_URL)

/**
 * Every outfit built and drawn as the shop loads, out of sight under the kitchen's floor, a few frames, then gone (the loading veil held
 * meanwhile): the staff only come in once it opens, and the programs they're drawn with, their shadows' among them (only drawing a thing
 * into the shadow's picture makes its program), were made as they first walked in, a frame stopped each.
 */
export function StaffWarm() {
  // (all the outfits in one call, the hook asked once (item 193: one call per outfit in a loop broke the rules of hooks, lint's one error))
  const gltfs = useGLTF(VARIANTS.map(url)) as unknown as { scene: THREE.Group }[]
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
