import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { bakeable } from '@/scene/StaticBatch'
import { atlasModel } from '@/scene/atlasMerge'
import { airbrush, gradientMap } from '@/scene/Person3D'
import { cloneFigure, paintable, releaseFigure, rigidFigure, type SkinPiece } from '@/scene/rigidSkin'
import { getEdit } from './edit'
import type { Lang } from '@/data/i18n'
import { bossLineText, bossSituation, cashLineText, drinkLineText, munchLineText, nextBossLine, tasteLineText, tasteVerdict, verdictLineText, type BossSituation } from '@/data/bossLines'
import { DrinkBottle } from './DiningRoom'
import { gulpSound } from './chewSound'
import { FRIDGE_STOCK, KITCHEN_FOLK, OWNER_OUT, type DrinkId } from './bar'
import { SPEAKERS } from '@/game/shopState'

/**
 * The owner (blender/boss.py): an Overcooked 2 cook (a big round head on a short plump body rounding off underneath, floating mitten
 * hands) with the face on his picture: glasses, moustache, headband, kappōgi and checked trousers. Drawn in the people's soft paint (the
 * same five-tone light and airbrush).
 *
 * While the shop's shut he keeps busy at his grill, moving as Overcooked's cooks do: a waddle when he walks (bobbing up at each step,
 * rocking side to side, leaning in, his hands swinging), a quick lean-forward scurry when he runs, and both hands out in front when he
 * holds something. His day goes round: turning things at the fire with his tongs, a walk down the aisle, fanning the fire from there
 * with his uchiwa, a run back, a wave, a breather. He blinks every few seconds (now and then twice). In developer mode he stands still
 * at his place.
 */
const URL = import.meta.env.BASE_URL + 'models/boss.glb'
/** the small parts: no ink line round them */
const UNINKED = /(Eye|Shine|Brow|Cheek|Moustache|Mouth|Tongue|Print|Collar|Knot|Band|Cord|Nose|Thumb|Glass|Hem|Tongs|Fan|Sideburn|Pencil|Pin|Towel)/
let made: THREE.Object3D | null = null

/** where his hands hang at rest (as modelled, the node's own frame) */
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }
type Phase = { act: 'tongs' | 'walk' | 'fan' | 'run' | 'wave' | 'idle'; len: number }
/** his round of the day, in seconds */
const ROUND: Phase[] = [
  { act: 'tongs', len: 7 }, { act: 'walk', len: 0 }, { act: 'fan', len: 5 }, { act: 'run', len: 0 }, { act: 'wave', len: 4 }, { act: 'idle', len: 4 },
]
/** and while the shop's open, out of his chef's way: a wave now and then, keeping an eye */
const ROUND_OPEN: Phase[] = [{ act: 'idle', len: 6 }, { act: 'wave', len: 3 }]
const WALK_SPEED = 0.9
/** how near the camera he may come, anywhere in the picture, before he fades (while it's looking past him at something else) */
const BOSS_CLOSE = 3.4
const RUN_SPEED = 2.4

/** `to`: the far end of his walk, in the frame he stands in (x, z), from his place at its origin, facing +z */
/** a taste he's been asked for (Roasting, as the owner clicks something in the tasting bowl): where it is (world), and whether he's there
 * to eat it yet; cleared when it's eaten */
export const BOSS_TASTE = { at: null as THREE.Vector3 | null, arrived: false, since: 0,
  /** he's biting into it now (Roasting, from the first bite): he says so, munching */
  chewing: false,
  /** its 美味 once he's swallowed it (Roasting): he says what he thinks of it, and it's cleared */
  verdict: null as number | null }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __bossTaste?: typeof BOSS_TASTE }).__bossTaste = BOSS_TASTE
/** a drink set down on a table near him (DiningRoom's FridgeStock, as it's let go there): where it stands (world) and which it is (the drink out of the
 * fridge, taken off the table as he picks it up); he goes over, drinks it and says so; cleared when it's drunk */
/**
 * How the boss answers what's done to him (the owner's): `hover`, a drink carried within his reach (he glows warm while it's held there);
 * `glowAt`, a drink set down for him (a flash of the same glow, fading over a second); `joyAt`, the till's money taken (a line of delight
 * over his head, a hop, coins and hearts rising). Times by performance.now().
 */
export const BOSS_FX = { hover: false, glowAt: -1e9, joyAt: -1e9 }
const GLOW = new THREE.Color('#ffb648')
const GLOW_LINE = new THREE.Color('#ffd24a')
/** the drink in his hand: its foot a little under his fist, a touch forward of it (the body's frame); and a scratch vector for the hand */
const DRINK_IN_PALM = new THREE.Vector3(0, -0.05, 0.015)
const HAND_AT = new THREE.Vector3()
export const BOSS_DRINK = { at: null as THREE.Vector3 | null, id: null as DrinkId | null, item: null as unknown, arrived: false, since: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __bossDrink?: typeof BOSS_DRINK }).__bossDrink = BOSS_DRINK
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __bossFx?: typeof BOSS_FX }).__bossFx = BOSS_FX
/** the parts of him that move on their own (his bones, after his body): his hands, what they hold, his eyes (to blink), his smile and his
 * open mouth (in turn as he talks) */
const BOSS_BONES = ['BossHandL', 'BossHandR', 'BossTongs', 'BossFan', 'BossEyes', 'BossSmile', 'BossTalk']
/**
 * The owner as he's drawn, made once: his figure in the room is it, the character viewer a copy. Drawn in two draws (the owner's: a person
 * in one or two; he was 27, then 9): all of him one material (scene/atlasMerge: the pictures on his coat, apron, trousers, hair and towel
 * packed into one atlas, the plain parts' colours carried by their vertices, his eyes flat (unlit) by their vertices' paint), all of him one
 * mesh moved in parts by the groups that move them (scene/rigidSkin: his hands, the tongs and the fan, his eyes in a group at their middle
 * that closes as he blinks, his smile and his open mouth, each scaled to nothing while it's not shown), and one ink line round his inked
 * pieces, bending with him.
 */
function styledBoss(scene: THREE.Group) {
  if (!made) {
    const r = scene.clone(true)
    r.updateMatrixWorld(true)
    // ---- the groups that move his eyes and his mouth, at their middles (the rest are his own nodes)
    const holder = (name: string, test: RegExp) => {
      const meshes: THREE.Mesh[] = []
      r.traverse((o) => { if ((o as THREE.Mesh).isMesh && test.test(o.name)) meshes.push(o as THREE.Mesh) })
      if (!meshes.length) return
      const g = new THREE.Group()
      g.name = name
      const box = new THREE.Box3()
      for (const e of meshes) box.expandByObject(e)
      const at = meshes[0].parent!
      at.add(g)
      g.position.copy(at.worldToLocal(box.getCenter(new THREE.Vector3())))
      g.updateMatrixWorld(true)
      for (const e of meshes) g.attach(e)
    }
    holder('BossEyes', /^BossEye/)
    holder('BossSmile', /^BossMouth$/)
    holder('BossTalk', /^BossMouth(Open|Tongue)/)
    // ---- all of him one material: his eyes' whites and darks in it too, by their vertices, flat
    atlasModel(r, () => true, (atlas) => paintable(airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', map: atlas, vertexColors: true, gradientMap }))))
    // ---- each piece of him in his frame, with its part, inked or not, flat or not
    r.updateMatrixWorld(true)
    const inv = r.matrixWorld.clone().invert()
    const bones: THREE.Object3D[] = [r, ...BOSS_BONES.map((n) => r.getObjectByName(n) ?? (() => { const g = new THREE.Group(); g.name = n; r.add(g); return g })())]
    const boneOf = (o: THREE.Object3D) => {
      for (let q: THREE.Object3D | null = o; q && q !== r; q = q.parent) { const k = bones.indexOf(q); if (k > 0) return k }
      return 0
    }
    const pieces: SkinPiece[] = []
    const meshes: THREE.Mesh[] = []
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    let mat: THREE.Material | null = null
    for (const m of meshes) {
      mat = m.material as THREE.Material
      pieces.push({ geo: bakeable(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)), bone: boneOf(m),
        inked: !UNINKED.test(m.name), flat: /^BossEye/.test(m.name) && !/Glass/.test(m.name) })
      m.removeFromParent()
      m.geometry.dispose()
    }
    const { mesh } = rigidFigure(r, pieces, mat!, bones, 0.006)
    for (const p of pieces) p.geo.dispose()
    mesh.castShadow = true
    mesh.receiveShadow = true
    // (what's held starts put away)
    for (const n of ['BossTongs', 'BossFan', 'BossTalk']) r.getObjectByName(n)?.scale.setScalar(0)
    made = r
  }
  return made
}
/** the owner standing still, a copy of him (developer mode's character viewer) */
export function BossModel() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => cloneFigure(styledBoss(gltf.scene)), [gltf])
  useEffect(() => () => releaseFigure(obj), [obj])
  return <primitive object={obj} />
}
/** the way he walks (his own frame, from his place): out to the aisle behind him at `mouth` (straight back out of the cook table's notch,
 * where he stands at the fire), then along it, `dir`, as far as `range` either way: what he's sent to (a taste, a drink) he goes to the
 * nearest of it on the aisle, and back again by the same way (the owner saw him walk into the table, round the notch's corner and into the
 * cubby beside it) */
export type BossAisle = { mouth: [number, number]; dir: [number, number]; range: [number, number]
  /** the notch's wooden step, under his place: he's up on it (`h` high) till he's come `to` that far out along his way out */
  step?: { to: number; h: number } }
/** the next place to make for on his way to `goal` (his frame): coming out of the notch, straight back to its mouth first; going back into
 * it, along the aisle to the mouth first and then straight in; the goal itself otherwise. So he never cuts across the table's corner, and
 * never turns back and forth on the way (a target that flipped between the mouth and the goal as he passed it made him shake) */
export function bossStep(at: [number, number], goal: [number, number], aisle?: BossAisle): [number, number] {
  if (!aisle) return goal
  const [mx, mz] = aisle.mouth
  const mo = Math.hypot(mx, mz)
  if (mo < 0.01) return goal
  const ox = mx / mo, oz = mz / mo
  const inside = (x: number, z: number) => x * ox + z * oz < mo - 0.06
  const a = inside(at[0], at[1])
  if (a === inside(goal[0], goal[1])) return goal
  if (a) return [mx, mz]
  return Math.abs(at[0] * oz - at[1] * ox) > 0.04 ? [mx, mz] : goal
}
/** `to`: the far end of his walk; `aisle`: the way he walks (BossAisle); `open`: the shop's open (his chef has the grill, he stays put); he
 * mutters in `lang` */
export function Boss({ to = [0, 0], aisle, open = false, lang = 'zh', children }: { to?: [number, number]; aisle?: BossAisle; open?: boolean; lang?: Lang
  children?: ReactNode }) {
  // ---- muttering to himself, always: a line every few seconds, by day or night, open or shut (data/bossLines), never the same twice running
  const [say, setSay] = useState<{ text: string; key: number } | null>(null)
  /** (he's said he's munching, this taste) */
  const chewSaid = useRef(false)
  // (a drink he's been handed, in his hand while he drinks it)
  const [drinkId, setDrinkId] = useState<DrinkId | null>(null)
  const drinkRef = useRef<THREE.Group>(null)
  useEffect(() => {
    let last: { s: BossSituation; i: number } | null = null
    let n = 0
    let h = 0
    const next = () => {
      const s = bossSituation(document.documentElement.dataset.theme === 'dark', open)
      const i = nextBossLine(s, last?.s === s ? last.i : null, Math.random())
      last = { s, i }
      setSay({ text: bossLineText(s, i, lang), key: ++n })
      h = window.setTimeout(() => { setSay(null); h = window.setTimeout(next, 1000 + Math.random() * 1800) }, 4200)
    }
    h = window.setTimeout(next, 1500)
    return () => window.clearTimeout(h)
  }, [open, lang])
  const sayRef = useRef(say)
  sayRef.current = say
  const openRef = useRef(open)
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => styledBoss(gltf.scene), [gltf])
  const mover = useRef<THREE.Group>(null)
  useEffect(() => {
    const m = mover.current
    if (!m) return
    KITCHEN_FOLK.add(m)
    return () => { KITCHEN_FOLK.delete(m) }
  }, [])
  const body = useRef<THREE.Group>(null)
  const parts = useMemo(() => ({
    handR: root.getObjectByName('BossHandR'),
    handL: root.getObjectByName('BossHandL'),
    tongs: root.getObjectByName('BossTongs'),
    fan: root.getObjectByName('BossFan'),
    smile: root.getObjectByName('BossSmile'),
    talk: root.getObjectByName('BossTalk'),
    eyes: root.getObjectByName('BossEyes'),
  }), [root])
  /** where his right hand is really drawn, in the hand bone's own frame (worked out once): the bone's origin isn't at the hand (he's one
   * skinned mesh, his parts' vertices hung from their bones some way off), so what he holds hangs from this */
  const palm = useRef<THREE.Vector3 | null>(null)
  const st = useRef({ last: 0, phase: 0, t: 0, x: 0, z: 0, yaw: 0, stride: 0, blinkAt: 2, blinks: 0, y: 0, vy: 0, ground: 0, probeAt: -1, probeX: 0, probeZ: 0, probeEdit: false })
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  /** what's under him (in his frame's height): the first solid surface straight down from his middle, anything drawn but himself and the
   * editor's handles; the floor where he stands if nothing's found */
  const groundBelow = (m: THREE.Object3D, x: number, z: number) => {
    const frame = m.parent
    if (!frame) return 0
    const from = frame.localToWorld(new THREE.Vector3(x, 0.5, z))
    ray.set(from, new THREE.Vector3(0, -1, 0))
    // (the camera too: the scene's sprites (labels, glints) need it to be tested at all)
    ray.camera = camera
    // (only what could be under his feet, each tested on its own: what's shown (not the originals a batch has hidden, thousands of them),
    // solid, not him, and no one else (a character's skinned body is costly to test, each vertex posed by its bones, and never the ground).
    // Through the whole room as it was, tested and then thrown out, it was a fifth of a frame a time)
    const hits: THREE.Intersection[] = []
    const look = (o: THREE.Object3D) => {
      if (!o.visible || o === m || o.userData.editHandle || o.name === 'edit-gizmo') return
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && solidStuff(mesh)) ray.intersectObject(mesh, false, hits)
      for (const c of o.children) look(c)
    }
    look(scene)
    hits.sort((a, b) => a.distance - b.distance)
    return hits.length ? frame.worldToLocal(hits[0].point.clone()).y : 0
  }
  // ---- out of the way of the camera: standing between it and what it's on (the grill, from camera 1 right behind him), he fades to a ghost
  // of himself, as a game's characters do; his own materials, so nothing else fades with him
  const ghost = useRef(1)
  const { mats, inks } = useMemo(() => {
    const set = new Set<THREE.Material>()
    const ink: THREE.Object3D[] = []
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material
      if (!m) return
      // (the ink line round him is drawn on its own back faces: it goes while he's faded, or it would hang there as a dark ring)
      if (/outline/i.test(o.name) || (!Array.isArray(m) && m.side === THREE.BackSide)) {
        ink.push(o)
        // (his own copy of the line's material (it's shared by width with everyone's), so it can turn gold round him alone as he glows)
        const sm = m as THREE.ShaderMaterial
        if (!Array.isArray(m) && sm.isShaderMaterial && sm.uniforms?.uColor) (o as THREE.Mesh).material = sm.clone()
        return
      }
      for (const x of Array.isArray(m) ? m : [m]) set.add(x)
    })
    // (hashed from the start: a fade only moves their opacity (at full, nothing's cut); switched on and off with each, the program each way
    // was let go and linked again, a hitch every time he stepped in front of the camera or out of its way. One that's blended already
    // fades by its blending: hashed, its soft edges would be cut to a dither for good)
    for (const x of set) if (!x.transparent) { x.alphaHash = true; x.needsUpdate = true }
    return { mats: [...set], inks: ink }
  }, [root])
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null
  const fadeClock = useRef(0)
  const glowWas = useRef(0)
  const glowBase = useMemo(() => new Map<THREE.Material, { c: THREE.Color; i: number }>(), [])
  // (what floats up over his head: his gulps while he drinks, his coins and hearts at the till's money)
  const [gulu, setGulu] = useState(0)
  const [joy, setJoy] = useState(0)
  const gulps = useRef({ next: 0, n: 0 })
  const joySeen = useRef(BOSS_FX.joyAt)
  useFrame(({ camera: cam, clock }) => {
    const m = mover.current
    if (!m) return
    // (out on the floor serving, drawn there by GuestBar3D: not here at his place meanwhile)
    m.visible = !OWNER_OUT.on
    // (the step from the clock itself, as for his walk: the frame's delta runs short while the frames are paced)
    const dt = Math.min(Math.max(0, clock.elapsedTime - fadeClock.current), 0.1)
    fadeClock.current = clock.elapsedTime
    // (his head: what shows first at the foot of the picture)
    const at = m.localToWorld(new THREE.Vector3(0, 0.8, 0))
    const fwd = cam.getWorldDirection(new THREE.Vector3())
    const along = at.clone().sub(cam.position).dot(fwd)
    // (what the camera's on: its controls' target, or where its line of sight meets the floor; he fades only standing well in front of it,
    // between it and the camera, never when it's him that's looked at)
    const tgt = controls?.target
    const lookD = tgt ? tgt.clone().sub(cam.position).dot(fwd) : fwd.y < -0.05 ? cam.position.y / -fwd.y : 6
    const ndc = at.clone().project(cam)
    const inView = Math.abs(ndc.x) < 1.1 && ndc.y > -1.3 && ndc.y < 1.05 && ndc.z < 1
    const lookedAt = tgt ? tgt.distanceTo(m.getWorldPosition(new THREE.Vector3())) < 1.6 : false
    // (and only when he's actually over it in the picture: near where the camera's looking on screen, not merely somewhere in front of it,
    // standing off to one side, which is no reason to turn him to a ghost)
    const over = tgt ? Math.hypot(...(() => { const a = tgt.clone().project(cam); const b = m.localToWorld(new THREE.Vector3(0, 0.45, 0)).project(cam); return [a.x - b.x, a.y - b.y] })()) < 0.45 : true
    // (and only from close by, the grill's own views: from a view of the whole room (far back) he's just one of the things in it)
    const near = lookD < 9
    // (or right by the camera anywhere in the picture, while it looks past him at something else: the back room's view had his face filling
    // a third of it as he went by)
    const close = inView && along > 0 && along < BOSS_CLOSE
    const want = !getEdit().on && !lookedAt && ((near && inView && over && along > 0 && along < lookD - 1.2) || close) ? 0.35 : 1
    ghost.current += (want - ghost.current) * Math.min(1, Math.min(dt, 0.1) * 6)
    const k = ghost.current
    for (const o of inks) o.visible = k > 0.95
    // (faded by hashing, not blending: each pixel of him drawn or not by a fine dither as faint as he is, his nearest surface still hiding his
    // far side, so he's one see-through figure whatever's drawn first; blended, he went to a jumble or to black)
    for (const x of mats) x.opacity = k
    // (the glow: steady and breathing while a drink's held over him, a flash fading over a second when one's set down for him)
    const since = (performance.now() - BOSS_FX.glowAt) / 1000
    const flash = since < 0 ? 0 : since < 0.15 ? since / 0.15 * 0.8 : Math.max(0, 0.8 * (1 - (since - 0.15) / 0.85))
    const g = Math.max(BOSS_FX.hover && !getEdit().on ? 0.75 + 0.25 * Math.sin(clock.elapsedTime * 6) : 0, flash / 0.8)
    if (g !== glowWas.current) {
      glowWas.current = g
      // (his body only a little lifted with the warm light; the glow's in his line, gone a bright gold and thicker, round him)
      for (const x of mats) {
        const t = x as THREE.MeshToonMaterial
        if (!t.emissive) continue
        if (!glowBase.has(t)) glowBase.set(t, { c: t.emissive.clone(), i: t.emissiveIntensity })
        const base = glowBase.get(t)!
        if (g > 0) { t.emissive.copy(GLOW); t.emissiveIntensity = 0.14 * g } else { t.emissive.copy(base.c); t.emissiveIntensity = base.i }
      }
      for (const o of inks) {
        const sm = (o as THREE.Mesh).material as THREE.ShaderMaterial
        if (!sm.uniforms?.uColor) continue
        if (!glowBase.has(sm)) glowBase.set(sm, { c: sm.uniforms.uColor.value.clone(), i: sm.uniforms.uWidth.value })
        const base = glowBase.get(sm)!
        sm.uniforms.uColor.value.copy(base.c).lerp(GLOW_LINE, g)
        sm.uniforms.uWidth.value = base.i * (1 + 1.4 * g)
      }
    }
  })
  useFrame(({ clock }) => {
    const s = st.current
    const T = clock.elapsedTime
    // (the step from the clock itself, as the frame's delta runs short while the frames are paced)
    const dt = Math.min(Math.max(0, T - s.last), 0.1)
    s.last = T
    if (import.meta.env.DEV) root.userData.st = s
    const m = mover.current, b = body.current
    if (!m || !b) return
    const edit = getEdit().on
    // (the shop opening or shutting: he starts his round over, from his place)
    if (openRef.current !== open) { openRef.current = open; s.phase = 0; s.t = 0; s.x = 0; s.z = 0 }
    const ROUNDS = open ? ROUND_OPEN : ROUND
    if (edit) { s.phase = 0; s.t = 0; s.x = 0; s.z = 0; s.yaw = 0 }
    const ph = ROUNDS[s.phase % ROUNDS.length]
    s.t += edit ? 0 : dt
    // (where he's going: the far end on the walk out, home on the run back; what he's doing when he's there)
    // (swallowed: what he thinks of it, said as he turns back)
    if (BOSS_TASTE.verdict !== null) {
      setSay({ text: verdictLineText(tasteVerdict(BOSS_TASTE.verdict), Math.random(), lang), key: Date.now() })
      BOSS_TASTE.verdict = null
      chewSaid.current = false
    }
    let act: Phase['act'] | 'taste' | 'drink' = ph.act
    let speed = 0
    // (asked to taste: down his aisle to where it passes nearest the bowl, turned to it, and there he eats it; then back to his round)
    // (or handed a drink: the same, and he drinks it)
    const drinking = !BOSS_TASTE.at && !!BOSS_DRINK.at
    const want = BOSS_TASTE.at ?? BOSS_DRINK.at
    const ask = !edit && want && m.parent ? m.parent.worldToLocal(want.clone()) : null
    if (ask) {
      // (the nearest he can come to it: on the aisle, by way of the notch's mouth; with no aisle given, along his walk's line, not behind it)
      let goal: [number, number]
      if (aisle) {
        const [mx, mz] = aisle.mouth, [ax, az] = aisle.dir
        const k = Math.max(aisle.range[0], Math.min(aisle.range[1], (ask.x - mx) * ax + (ask.z - mz) * az))
        goal = [mx + ax * k, mz + az * k]
      } else {
        const len = Math.hypot(to[0], to[1]) || 1
        const k = Math.max(0, Math.min(len, (ask.x * to[0] + ask.z * to[1]) / len))
        goal = [(to[0] / len) * k, (to[1] / len) * k]
      }
      const [wx, wz] = bossStep([s.x, s.z], goal, aisle)
      const dx = wx - s.x, dz = wz - s.z
      const d = Math.hypot(dx, dz)
      if (Math.hypot(goal[0] - s.x, goal[1] - s.z) > 0.03) {
        speed = RUN_SPEED
        const stepL = Math.min(d, speed * dt)
        if (d > 1e-6) { s.x += (dx / d) * stepL; s.z += (dz / d) * stepL }
        s.stride += stepL
        turnTo(s, Math.atan2(dx, dz), dt * 9)
        if (drinking) BOSS_DRINK.arrived = false
        else BOSS_TASTE.arrived = false
      } else if (drinking) {
        turnTo(s, Math.atan2(ask.x - s.x, ask.z - s.z), dt * 7)
        if (!BOSS_DRINK.arrived) {
          // (he picks it up off the table: it's in his hand now)
          BOSS_DRINK.arrived = true; BOSS_DRINK.since = T
          const i = FRIDGE_STOCK.out.indexOf(BOSS_DRINK.item as (typeof FRIDGE_STOCK.out)[number])
          if (i >= 0) { FRIDGE_STOCK.out.splice(i, 1); FRIDGE_STOCK.ver++ }
          setDrinkId(BOSS_DRINK.id)
        }
        if (T - BOSS_DRINK.since > 1.6 && T - BOSS_DRINK.since - dt <= 1.6) setSay({ text: drinkLineText(Math.random(), lang), key: Date.now() })
        if (T - BOSS_DRINK.since > 4.2) { BOSS_DRINK.at = null; BOSS_DRINK.id = null; BOSS_DRINK.item = null; BOSS_DRINK.arrived = false; setDrinkId(null) }
        act = 'drink'
      } else {
        turnTo(s, Math.atan2(ask.x - s.x, ask.z - s.z), dt * 7)
        if (!BOSS_TASTE.arrived) { BOSS_TASTE.arrived = true; BOSS_TASTE.since = T; BOSS_TASTE.chewing = false; setSay({ text: tasteLineText(Math.random(), lang), key: Date.now() }) }
        // (once he bites in, what he says turns to munching)
        if (BOSS_TASTE.chewing && !chewSaid.current) { chewSaid.current = true; setSay({ text: munchLineText(Math.random(), lang), key: Date.now() }) }
        // (never left standing there: whatever it was is gone by now)
        if (T - BOSS_TASTE.since > 10) { BOSS_TASTE.at = null; BOSS_TASTE.arrived = false }
        act = 'taste'
      }
      s.t = 0
      // (and when he's done, he runs back to his place and starts his round again from there)
      const runIx = ROUNDS.findIndex((x) => x.act === 'run')
      s.phase = runIx >= 0 ? runIx : 0
    } else if (act === 'walk' || act === 'run') {
      // (out along the aisle and back home, by way of the notch's mouth)
      const [gx, gz] = act === 'walk' ? to : [0, 0]
      const [wx, wz] = bossStep([s.x, s.z], [gx, gz], aisle)
      const dx = wx - s.x, dz = wz - s.z
      const d = Math.hypot(dx, dz)
      speed = act === 'walk' ? WALK_SPEED : RUN_SPEED
      if (Math.hypot(gx - s.x, gz - s.z) < 0.02) {
        s.x = gx; s.z = gz
        s.phase = (s.phase + 1) % ROUNDS.length; s.t = 0
        speed = 0
      } else {
        const step = Math.min(d, speed * dt)
        if (d > 1e-6) { s.x += (dx / d) * step; s.z += (dz / d) * step }
        s.stride += step
        turnTo(s, Math.atan2(dx, dz), dt * 9)
      }
    } else {
      // (at a stop he turns back to face the fire)
      turnTo(s, 0, dt * 5)
      if (s.t > ph.len) { s.phase = (s.phase + 1) % ROUNDS.length; s.t = 0 }
    }
    if (edit) act = 'idle'
    // ---- gravity: he stands on whatever's under him, and if he's left in the air (put up high in the editor) he drops onto it, with a
    // little bounce; walking, on the floor itself (his frame's), not on what the ray finds under him as he passes (a step's edge, a sack, a
    // door swung open), which had him bob up and down (the owner's); in the notch, on its wooden step, and stepping up onto it and down off
    // it smoothly as he walks
    const deck = aisle?.step
    const out = deck ? (s.x * aisle!.mouth[0] + s.z * aisle!.mouth[1]) / (Math.hypot(aisle!.mouth[0], aisle!.mouth[1]) || 1) : 0
    if (deck && out < deck.to) s.ground = deck.h
    else if (speed > 0) s.ground = 0
    // (looked for again only when it may have changed: he's stopped somewhere new, or the editor's on (anything under him may be moved) or
    // has just gone off; standing at his place all through business, it was five rays a second through the room for the same answer)
    else if (s.probeAt < 0 || Math.hypot(s.x - s.probeX, s.z - s.probeZ) > 0.005 || edit !== s.probeEdit || (edit && T - s.probeAt > 0.2)) {
      s.probeAt = T; s.probeX = s.x; s.probeZ = s.z; s.probeEdit = edit
      s.ground = groundBelow(m, s.x, s.z)
    }
    const scale = m.parent?.getWorldScale(new THREE.Vector3()).y || 1
    if (speed > 0) { s.y += (s.ground - s.y) * Math.min(1, dt * 14); s.vy = 0 }
    else if (s.y > s.ground + 1e-4 || s.vy > 0) {
      s.vy -= (9 / scale) * dt
      s.y += s.vy * dt
      if (s.y <= s.ground) { s.y = s.ground; s.vy = s.vy < -1.2 ? -s.vy * 0.28 : 0 }
    } else { s.y = s.ground; s.vy = 0 }
    m.position.set(s.x, s.y, s.z)
    m.rotation.y = s.yaw

    // ---- the body: a waddle (up at each step, rocking, leaning in) when moving, breathing when not
    const step = s.stride * (speed > 1 ? 2.6 : 3.4)
    const moving = speed > 0
    const run = speed > 1
    const bob = moving ? Math.abs(Math.sin(step * Math.PI)) * (run ? 0.055 : 0.035) : 0
    const squash = moving ? 1 - Math.abs(Math.cos(step * Math.PI)) * 0.04 : 1 + Math.sin(T * 1.6) * 0.012
    b.position.y = bob
    b.scale.set(2 - squash, squash, 2 - squash)
    const lean = moving ? (run ? 0.26 : 0.09) : act === 'fan' ? 0.06 : 0
    b.rotation.x += (lean - b.rotation.x) * Math.min(1, dt * 8)
    b.rotation.z = moving ? Math.sin(step * Math.PI) * (run ? 0.13 : 0.09) : Math.sin(T * 0.7) * 0.025
    // (a little hop of joy as he waves)
    if (act === 'wave') b.position.y += Math.max(0, Math.sin(s.t * 5)) * 0.015

    // ---- the hands
    const R = new THREE.Vector3(), L = new THREE.Vector3()
    if (moving) {
      // (swinging, opposite each other, forward and back with each step, a little up as they come forward)
      const sw = Math.sin(step * Math.PI) * (run ? 0.13 : 0.08)
      R.set(0, Math.max(0, sw) * 0.6 + (run ? 0.05 : 0), sw)
      L.set(0, Math.max(0, -sw) * 0.6 + (run ? 0.05 : 0), -sw)
    } else if (act === 'tongs') {
      // (both hands out in front, the tongs in the right; every so often a quick turn of whatever's on the fire)
      const flip = Math.max(0, Math.sin(s.t * 2.2)) ** 6
      R.set(-0.08, 0.12 + flip * 0.06, 0.3 + flip * 0.04)
      L.set(0.1, 0.1, 0.28)
    } else if (act === 'fan') {
      R.set(-0.06, 0.18, 0.3)
      L.set(0.08, 0.06 + Math.sin(T * 1.6) * 0.01, 0.2)
    } else if (act === 'taste') {
      // (a piece held up to his mouth in the right hand, bitten and chewed, the left on his belly)
      const chew = Math.max(0, Math.sin((T - BOSS_TASTE.since) * 7))
      R.set(-0.04, 0.3 + chew * 0.03, 0.18)
      L.set(0.04, 0.02, 0.1)
    } else if (act === 'drink') {
      // (the bottle up to his mouth in the right hand, tipped up as he drinks, then down with a sigh; the left on his belly)
      const u = T - BOSS_DRINK.since
      const up = Math.min(1, u / 0.4) * (1 - Math.max(0, Math.min(1, (u - 3.4) / 0.6)))
      R.set(-0.05, 0.12 + up * 0.2, 0.2 - up * 0.04)
      L.set(0.04, 0.02, 0.1)
    } else if (act === 'wave') {
      const w = Math.sin(s.t * 9)
      R.set(0.02 + w * 0.04, 0.32, 0.06)
      L.set(0, 0.012 * Math.sin(T * 1.6 + 1), 0)
    } else {
      R.set(0, 0.012 * Math.sin(T * 1.6), 0)
      L.set(0, 0.012 * Math.sin(T * 1.6 + 1), 0)
    }
    if (parts.handR) parts.handR.position.lerp(R, Math.min(1, dt * 12))
    if (parts.handL) parts.handL.position.lerp(L, Math.min(1, dt * 12))
    // ---- what's in his hand: the tongs at the fire, the fan down the aisle; held at the right hand, swinging with it
    const hand = REST.R.clone().add(parts.handR?.position ?? new THREE.Vector3())
    // (the drink in his hand, tipped up to his mouth as he drinks)
    // (gulping while the bottle's tipped up: a glug every half second or so, and 咕嚕咕嚕～♪ floating up, once a drink)
    if (act === 'drink') {
      const u = T - BOSS_DRINK.since
      const gp = gulps.current
      if (u < 0.1) { gp.next = 0.45; gp.n = 0 }
      if (u > gp.next && u < 3.4) { gp.next = u + 0.42 + Math.random() * 0.12; gulpSound(); if (gp.n++ === 0) setGulu((v) => v + 1) }
    }
    // (the till's money taken: a line of delight, a hop, coins and hearts)
    if (BOSS_FX.joyAt !== joySeen.current) {
      joySeen.current = BOSS_FX.joyAt
      setSay({ text: cashLineText(Math.random(), lang), key: Date.now() })
      setJoy((v) => v + 1)
      if (s.vy === 0 && speed === 0) s.vy = 1.9 / scale
    }
    const joyU = (performance.now() - BOSS_FX.joyAt) / 1000
    if (joyU < 1.2) b.position.y += Math.abs(Math.sin(joyU * Math.PI * 3)) * 0.04 * (1 - joyU / 1.2)
    if (drinkRef.current) {
      drinkRef.current.visible = act === 'drink'
      if (act === 'drink') {
        const u = T - BOSS_DRINK.since
        const up = Math.min(1, u / 0.4) * (1 - Math.max(0, Math.min(1, (u - 3.4) / 0.6)))
        // (in his right hand, where the hand really is (the hand's place in the model's own units was a body's width off it, up in his
        // head: he drank from an empty hand, the owner saw); stood in his palm, tipped back toward his mouth some 55 degrees as he drinks)
        const dr = drinkRef.current
        if (parts.handR && dr.parent) {
          parts.handR.updateWorldMatrix(true, false)
          palm.current ??= drawnCentre(root, parts.handR)
          dr.position.copy(dr.parent.worldToLocal(parts.handR.localToWorld(HAND_AT.copy(palm.current)))).add(DRINK_IN_PALM)
        } else dr.position.copy(hand).add(DRINK_IN_PALM)
        dr.rotation.x = -up * 0.95
      }
    }
    if (parts.tongs) {
      parts.tongs.scale.setScalar(act === 'tongs' ? 1 : 0)
      parts.tongs.position.copy(hand).add(new THREE.Vector3(-0.02, 0.0, 0.02))
      parts.tongs.rotation.set(0.5 - Math.max(0, Math.sin(s.t * 2.2)) ** 6 * 0.5, -0.25, 0)
    }
    if (parts.fan) {
      parts.fan.scale.setScalar(act === 'fan' ? 1 : 0)
      parts.fan.position.copy(hand).add(new THREE.Vector3(0, 0.0, 0.02))
      // (fanned to and fro at the fire, quick)
      parts.fan.rotation.set(-0.5 + Math.sin(T * 13) * 0.55, 0, -0.15)
    }

    // ---- his mouth: while a line's up over his head, it flaps open and shut as he says it, in syllables; the rest of the time his smile
    const talking = !!sayRef.current
    const munching = act === 'taste'
    const gape = (talking && Math.sin(T * 17) + Math.sin(T * 7.3) * 0.6 > 0.2) || (munching && Math.sin((T - BOSS_TASTE.since) * 7) > 0.3)
    // (each shown by its part of the one mesh being its size, hidden by its being nothing)
    parts.smile?.scale.setScalar(gape ? 0 : 1)
    if (parts.talk) {
      if (gape) parts.talk.scale.set(1, 0.7 + 0.3 * Math.abs(Math.sin(T * 17)), 1)
      else parts.talk.scale.setScalar(0)
    }
    // ---- a blink every few seconds, now and then twice
    let lid = 1
    const since = T - s.blinkAt
    if (since > 0 && since < 0.14) lid = 0.08 + 0.92 * Math.abs(since / 0.07 - 1)
    else if (since >= 0.14) {
      s.blinkAt = T + (s.blinks % 4 === 3 ? 0.12 : 2.2 + Math.random() * 3)
      s.blinks++
    }
    if (parts.eyes) parts.eyes.scale.y = lid
  })
  return (
    <group ref={mover} name="BossFollow">
      {children}
      {/* (what he's muttering, over his head) */}
      {say && !getEdit().on && (
        <Html position={[0, 1.42, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span key={say.key} className="g3-bubble g3-say boss-say"><b className="say-who">{SPEAKERS.get('owner') ?? '老闆'}</b>{say.text}</span>
        </Html>
      )}
      {gulu > 0 && !getEdit().on && (
        <Html position={[0.18, 1.2, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span key={gulu} className="boss-float boss-gulu">{lang === 'ja' ? 'ゴクゴク〜♪' : lang === 'en' ? 'Glug glug~ ♪' : '咕嚕咕嚕～♪'}</span>
        </Html>
      )}
      {joy > 0 && !getEdit().on && (
        <Html position={[0, 1.3, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span key={joy} className="boss-joy" aria-hidden="true">
            {['🪙', '❤️', '🪙', '💖', '🪙', '❤️'].map((c, i) => <i key={i} style={{ '--i': i } as React.CSSProperties}>{c}</i>)}
          </span>
        </Html>
      )}
      <group ref={body}><primitive object={root} />
        <group ref={drinkRef} name="boss-drink-held" visible={false}>{drinkId && <DrinkBottle id={drinkId} wet />}</group>
      </group>
    </group>
  )
}

/** the middle of the vertices a bone carries as they're drawn, in the bone's own frame (a rigidly skinned figure: each vertex one bone's) */
function drawnCentre(root: THREE.Object3D, bone: THREE.Object3D) {
  let sm: THREE.SkinnedMesh | null = null
  root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!sm && m.isSkinnedMesh && m.skeleton.bones.includes(bone as THREE.Bone)) sm = m })
  const out = new THREE.Vector3()
  if (!sm) return out
  const m = sm as THREE.SkinnedMesh
  m.updateWorldMatrix(true, false)
  m.skeleton.update()
  const bi = m.skeleton.bones.indexOf(bone as THREE.Bone), si = m.geometry.attributes.skinIndex, pos = m.geometry.attributes.position
  const v = new THREE.Vector3()
  let n = 0
  for (let i = 0; i < pos.count; i++) {
    if (si.getX(i) !== bi) continue
    v.fromBufferAttribute(pos, i)
    m.applyBoneTransform(i, v)
    out.add(v.applyMatrix4(m.matrixWorld))
    n++
  }
  return n ? bone.worldToLocal(out.divideScalar(n)) : out
}
/** whether a mesh is something to stand on: shown (it and all above it), not see-through or a shadow, not part of him, not the editor's handles */
/** whether a mesh's material is something to stand on: not a shadow (the floor's shadow-catching sheet, blob shadows and other see-through
 * decals laid over things), not unseen */
function solidStuff(o: THREE.Mesh) {
  const mat = o.material as THREE.Material | THREE.Material[]
  for (const mm of Array.isArray(mat) ? mat : [mat]) {
    if (!mm.visible || !mm.colorWrite || (mm as THREE.ShadowMaterial).isShadowMaterial || (mm.transparent && (mm.opacity < 0.2 || !mm.depthWrite))) return false
  }
  return true
}
/** turn toward a heading, the short way round, at most `k` of the way this frame */
function turnTo(s: { yaw: number }, to: number, k: number) {
  let d = to - s.yaw
  d = Math.atan2(Math.sin(d), Math.cos(d))
  s.yaw += d * Math.min(1, k)
}
useGLTF.preload(URL)
