import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Look, Role } from '@/data/staff'
import { commuteOf } from '@/game/commute'
import { CLIMB_S, downBeat, downLength, dormDoing, upBeat, upstairs } from '@/game/dormLife'
import { SHOP } from '@/game/shopState'
import { toDorm } from '@/scene/floors'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { setTip } from '@/scene/hoverTip'
import { SIGN_FONT, signTexture } from '@/scene/signFont'
import { StaffFigure } from '@/scene/StaffFigure'
import { getClock } from '@/ui/clockStore'
import { DORM_LIFE } from './bar'
import { slideDoorSound } from './restroomSound'
import { doorAlong } from './ServeCounter'
import { getEdit } from './edit'
import { makeAlleyView, type AlleySky } from '@/scene/alleyView'

/**
 * The staff room upstairs (二樓員工休息室兼宿舍, blender/dorm.py; item 325, the owner's, 2026-11-18: 「然後捏個2F小房間，會切換場景，可以上樓
 * 去」; remade, and those living in it shown there, for item 339: 「2樓有點太隨便，員工上樓也得呈現」): four and a half mats over the shop and a
 * strip of board floor where the stair comes up from the staff door. A scene of its own, set well off from the shop (out of every view of it,
 * so it costs nothing while they're looked at), in the dining room's scale (its metres twice the world's units); the view 二樓 looks at it.
 *
 * Those who live in (the cooks: game/commute's 'dorm') are up here while the shop's shut: through the staff door at the day's end, up the
 * stair step by step, across to their place; asleep under their quilt from four in the morning till eleven (the table folded away, the
 * futons laid), else sat on their cushion at the table; as the shop opens, up off it, over to the stair and down it (game/dormLife).
 */
/** what's out of the window (item 452, the owner's 「2樓窗外景色?」: it was the shop's doorway's street, its upper half, a pale nothing by
 * day): the view from up here over the back of the town, in depth (scene/alleyView: the neighbour's roof and the wires across, the town's
 * roofs and a bathhouse's chimney, the sky), on a pane at the window's glass (blender/dorm.py's WX0..WX1, WY0..WY1, 8.7 cm into the wall);
 * by the part of the day, painted again as it turns */
const ALLEY = makeAlleyView()
const ALLEY_AT = { x: -0.575, y: 1.22, z: -1.4375, w: 1.15, h: 0.88 }
const ALLEY_CAM = new THREE.Vector3()
/** the window's view to the part of the day (the page's data-sky) */
function alleyTo() {
  const s = typeof document === 'undefined' ? 'day' : document.documentElement.dataset.sky ?? 'day'
  ALLEY?.paint((['dawn', 'day', 'dusk', 'night'].includes(s) ? s : 'day') as AlleySky)
}
// (not fetched with the page (item 457, the owner's 「loading 時1層1層」): only as the room's first gone up to, under the cover's bar)
const DORM_URL = import.meta.env.BASE_URL + 'models/dorm.glb'
/** where it stands in the world: off to the side of the shop, on its floor's level (the dining room's floor, the staff door's foot) */
export const DORM_AT = new THREE.Vector3(60, -1.16, -1.69)
const DORM_SCALE = 2
/** the stair's well in the room's frame (blender/dorm.py: the board strip's front, 0.84 by 1.45), to be clicked */
const STAIR = { x: 1.35, z: 0.625, w: 0.8, d: 1.4 }
/** the bathroom's door (item 427, blender/dorm.py's DormBathDoor): the doorway's middle and size (the room's metres), how far the door
 * slides left into the wall's pocket, and how long it takes */
const BATH = { x: 1.36, y: 1.01, z: -1.4, w: 0.72, h: 1.68, slide: 0.7, s: 0.5 }
const BATH_TIP = (open: boolean) => ({ title: '衛浴', hint: `住在樓上的員工用的浴室與廁所｜點一下${open ? '拉上' : '拉開'}` })
/** the bath's half-noren over the way in from the room, as a house's changing room's is (item 447, the owner's 「衛浴設備是日式的哦！」;
 * blender/dorm.py's BD0, BD1, BDH): its rod's place (the room's metres: 4 cm before the wall, just under the doorway's head), its width (the
 * doorway's and its jambs') and its length (to over the work clothes' hooks on the door behind it) */
const YU = { x: 1.36, top: 1.872, z: -1.31, w: 0.8, l: 0.4 }
/** its cloth: persimmon-dyed (kakishibu), darker where it's sewn over the rod, a big white ゆ (the bath) across its two panels, a white line
 * along its hem, the weave; the slit between the panels let through (alpha-tested, not blended) */
const YU_TEX = signTexture(512, Math.round((512 * YU.l) / YU.w), (g, w, h) => {
  g.fillStyle = '#7a3420'; g.fillRect(0, 0, w, h)
  g.globalAlpha = 0.06
  g.fillStyle = '#ffffff'
  for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h)
  g.fillStyle = '#000000'
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1)
  g.globalAlpha = 1
  const band = Math.round(h * 0.07)
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, w, band)
  g.fillStyle = '#efe9dc'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `700 ${Math.round(h * 0.6)}px ${SIGN_FONT}`
  g.fillText('ゆ', w / 2, band + (h - band) * 0.47)
  g.fillRect(0, h - Math.round(h * 0.07), w, Math.max(2, Math.round(h * 0.012)))
  g.clearRect(Math.round(w / 2 - w * 0.008), band, Math.round(w * 0.016), h - band)
})
const YU_MAT = new THREE.MeshToonMaterial({ color: '#ffffff', map: YU_TEX, side: THREE.DoubleSide, alphaTest: 0.5 })
const YU_ROD = new THREE.MeshToonMaterial({ color: '#d9b884' })
const YU_BRACKET = new THREE.MeshToonMaterial({ color: '#3a2416' })
/** (dev) the bathroom's door worked by hand */
const BATH_STATE = { open: false, t0: -1, from: 0, cur: 0 }
/** where the owner's clothes are kept, in the room's frame (blender/dorm.py): the closet's sliding doors (its front at the left wall,
 * x = -1.8, from z -0.6 to 1.2, 1.8 high) and the chest of drawers in the back left corner (x -1.78 to -1.22, z -1.33 to -0.91, 0.95
 * high), each a box a little round it; pointed at, named; clicked, his clothes to choose (item 376) */
const WARDROBE = [
  { at: [-1.8 + 0.03, 0.92, 0.3], size: [0.06, 1.7, 1.76], zh: '押入（壁櫥）', ja: '押入れ', en: 'Closet' },
  { at: [-1.5, 0.5, -1.11], size: [0.6, 0.94, 0.48], zh: '衣櫃', ja: '箪笥', en: 'Chest of drawers' },
] as const
const wardrobeTip = (w: (typeof WARDROBE)[number]) => {
  const l = typeof document === 'undefined' ? 'zh' : document.documentElement.lang
  return l.startsWith('ja') ? { title: w.ja, hint: 'クリック：店主の服を着替える' } : l.startsWith('en') ? { title: w.en, hint: "Click: change the owner's clothes" }
    : { title: w.zh, hint: '點一下：換老闆的衣服' }
}
/** a cook's figure here as big as in the shop (measured there: 1.646 of the world) */
const FIG_SCALE = 1.646 / DORM_SCALE
/** the pieces shown or put away by what's going on: the table and its tea, the table folded away, each futon laid */
const PIECES = /^Dorm(Table|TableAway|Bedding\d)$/
const CAM_IN = new THREE.Vector3()

/** asks the app's views for one (the stair up behind the staff door, the stair down here) */
export const askView = (id: string) => window.dispatchEvent(new CustomEvent('jgs-view', { detail: id }))

type Living = { id: string; role: Role; look: Look }
/** the room's marks (blender/dorm.py's empties), in its own frame */
type Marks = { seats: THREE.Vector3[]; beds: THREE.Vector3[]; top: THREE.Vector3; foot: THREE.Vector3; table: THREE.Vector3 }

/** the way from the stair's head to a place (round the rail along the well, which only opens behind it; round the table): its corners */
function wayTo(m: Marks, to: THREE.Vector3, bed: boolean): THREE.Vector3[] {
  const out = new THREE.Vector3(0.6, m.top.y, m.top.z)
  if (bed) return [m.top, out, new THREE.Vector3(0.6, m.top.y, 1.1), new THREE.Vector3(to.x, m.top.y, 1.1), to]
  // (the cushion on the table's left from the front, the one behind it from behind, the one on its right from its right)
  if (to.x < m.table.x - 0.3) return [m.top, out, new THREE.Vector3(0.6, m.top.y, 0.72), new THREE.Vector3(to.x - 0.03, m.top.y, 0.72), to]
  if (to.z < m.table.z - 0.3) return [m.top, out, new THREE.Vector3(0.1, m.top.y, -0.72), to]
  return [m.top, out, new THREE.Vector3(0.6, m.top.y, to.z), to]
}
const lengthOf = (w: THREE.Vector3[]) => w.reduce((s, p, i) => (i ? s + p.distanceTo(w[i - 1]) : 0), 0)
/** a point `k` (0..1) of the way along a way, and the way it's going there */
function along(w: THREE.Vector3[], k: number, at: THREE.Vector3, dir: THREE.Vector3) {
  let left = Math.max(0, Math.min(1, k)) * lengthOf(w)
  for (let i = 1; i < w.length; i++) {
    const seg = w[i].distanceTo(w[i - 1])
    if (left <= seg || i === w.length - 1) {
      at.copy(w[i - 1]).lerp(w[i], seg > 1e-6 ? Math.min(1, left / seg) : 1)
      dir.copy(w[i]).sub(w[i - 1])
      return
    }
    left -= seg
  }
}
/** up (or down) the stair a step at a time: each step's lift quick, then a moment on it (k 0..1 over six steps) */
const stepped = (k: number) => { const s = Math.max(0, Math.min(1, k)) * 6, f = s - Math.floor(s); return (Math.floor(s) + THREE.MathUtils.smoothstep(f, 0, 0.55)) / 6 }

const AT = new THREE.Vector3(), DIR = new THREE.Vector3()

/**
 * One who lives in, up here as the clock and the shop have them (game/dormLife): coming up the stair and across to their place, sat at the
 * table or asleep in their futon under a quilt drawn up to the shoulders, or up and off down the stair as the shop opens.
 */
/** whether one living in is up here now (game/dormLife's upstairs), and how long since they came up the stair (null: up since before, or not) */
function upNow(id: string, open: boolean, walk: number, off = false) {
  const now = performance.now(), down = DORM_LIFE.downAt.get(id), up = DORM_LIFE.upAt.get(id)
  const downFor = down !== undefined && up === undefined && !off ? (now - down) / 1000 : null
  const upFor = up !== undefined ? (now - up) / 1000 : null
  // (off today: up here all day, resting, or asleep through its small hours; one just up the stair as the shift turned over to the next
  // day's still coming up it)
  return { here: off || upstairs(open, SHOP.walking.has(id), downFor, downLength(walk), up !== undefined), downFor, upFor }
}
/** (each sleeper's futon down: laid as they come to it, the table folded away with it) */
const BEDS_LAID: boolean[] = [false, false]
/** (in development, what each of them is doing up here this frame, to look at from the console: __dormSeen) */
const DORM_SEEN: Record<number, unknown> = {}
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __dormSeen: DORM_SEEN })

const Resident = memo(function Resident({ m, k, marks, open, quilt, off }: { m: Living; k: number; marks: Marks; open: boolean; quilt: THREE.Material | null; off: boolean }) {
  const g = useRef<THREE.Group>(null), cover = useRef<THREE.Mesh>(null)
  const [pose, setPose] = useState({ moving: false, seated: false, asleep: false })
  const QUILT = useMemo(() => new RoundedBoxGeometry(0.92, 0.36, 1.25, 2, 0.12), [])
  /** (from one place to the other as the time of day turns (to bed at four in the morning, up at eleven): up off it, across, down onto the
   * other; the place they're going from and when they set off) */
  const move = useRef<{ was: boolean; from: THREE.Vector3; at: number } | null>(null)
  const doingWas = useRef<boolean | null>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const asleepNow = dormDoing(getClock().minute) === 'sleep'
    const spot = asleepNow ? marks.beds[k] : marks.seats[k]
    const way = wayTo(marks, spot, asleepNow), walk = lengthOf(way)
    const { here, downFor, upFor } = upNow(m.id, open, walk, off)
    o.visible = here
    if (cover.current) cover.current.visible = false
    BEDS_LAID[k] = false
    if (!here) { doingWas.current = null; move.current = null; return }
    // (the time of day turned while they were settled: off from the one place to the other)
    if (doingWas.current !== null && doingWas.current !== asleepNow && (upFor === null || upFor > 30) && downFor === null)
      move.current = { was: doingWas.current, from: (doingWas.current ? marks.beds[k] : marks.seats[k]).clone(), at: performance.now() }
    doingWas.current = asleepNow
    let moving = false, settled = 0, climb = -1
    const mv = move.current
    const mvFor = mv ? (performance.now() - mv.at) / 1000 : 0, mvLen = mv ? mv.from.distanceTo(spot) / 0.8 : 0
    if (mv && mvFor > 0.5 + mvLen + 0.5) move.current = null
    if (mv && move.current) {
      // (up off where they were (out from under the quilt, or up off the cushion), across to the other place, and down onto it)
      if (mvFor < 0.5) { settled = 1 - mvFor / 0.5; AT.copy(mv.from) }
      else if (mvFor < 0.5 + mvLen) { AT.copy(mv.from).lerp(spot, (mvFor - 0.5) / mvLen); DIR.copy(spot).sub(mv.from); moving = true }
      else settled = (mvFor - 0.5 - mvLen) / 0.5
      if (mvFor < 0.5 && mv.was) {
        // (getting up out of bed: the lying pose unwound where they lay)
        const e = THREE.MathUtils.smoothstep(settled, 0, 1), len = 0.95 * FIG_SCALE / 0.823
        o.position.set(mv.from.x, mv.from.y + 0.08 * e, mv.from.z + len * e)
        o.rotation.set(-Math.PI / 2 * e, e > 0.5 ? 0 : Math.PI, 0)
        BEDS_LAID[k] = true
        const want = { moving: false, seated: false, asleep: false }
        if (want.moving !== pose.moving || want.seated !== pose.seated || want.asleep !== pose.asleep) setPose(want)
        return
      }
      if (mvFor < 0.5) {
        // (getting up off the cushion, still turned to the table)
        o.position.copy(mv.from)
        o.position.y -= 0.03 * settled
        o.rotation.set(0, Math.atan2(marks.table.x - mv.from.x, marks.table.z - mv.from.z), 0)
        const want = { moving: false, seated: settled > 0.5, asleep: false }
        if (want.moving !== pose.moving || want.seated !== pose.seated || want.asleep !== pose.asleep) setPose(want)
        return
      }
    } else if (downFor !== null) {
      const b = downBeat(downFor, walk)
      if (b.phase === 'rise') settled = 1 - b.k
      else if (b.phase === 'walk') { along(way, 1 - b.k, AT, DIR); DIR.negate(); moving = true }
      else { climb = 1 - b.k; moving = true }
    } else {
      // (up since before (the page opened with the shop shut): there already)
      const b = upBeat(upFor ?? 1e9, walk)
      if (b.phase === 'climb') { climb = b.k; moving = true }
      else if (b.phase === 'walk') { along(way, b.k, AT, DIR); moving = true }
      else settled = b.phase === 'settle' ? b.k : 1
    }
    // (their futon laid as they come to it to lie down, not as they come up the stair)
    BEDS_LAID[k] = asleepNow && !moving
    if (import.meta.env.DEV) DORM_SEEN[k] = { id: m.id, upFor, downFor, climb, moving, settled, y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3) }
    if (climb >= 0) {
      // (on the stair: from its foot, out of sight down the well, up to its head, rising a step at a time)
      AT.copy(marks.foot).lerp(marks.top, Math.max(0, Math.min(1, climb)))
      AT.y = marks.foot.y + (marks.top.y - marks.foot.y) * stepped(climb)
      DIR.copy(marks.top).sub(marks.foot)
      if (downFor !== null) DIR.negate()
    }
    if (moving) {
      o.position.copy(AT)
      o.rotation.set(0, Math.atan2(DIR.x, DIR.z), 0)
    } else if (asleepNow) {
      // (lying down: from standing by the futon's foot onto their back, the head on the pillow, the quilt over them up to the shoulders)
      const e = THREE.MathUtils.smoothstep(settled, 0, 1), len = 0.95 * FIG_SCALE / 0.823
      o.position.set(spot.x, spot.y + 0.08 * e, spot.z + len * e)
      o.rotation.set(-Math.PI / 2 * e, e > 0.5 ? 0 : Math.PI, 0)
      if (cover.current) { cover.current.visible = e > 0.9; cover.current.position.set(spot.x, spot.y + 0.12, spot.z + 0.25 + 0.62) }
    } else {
      // (sat on their cushion, turned to the table; settling onto it a moment)
      o.position.copy(spot)
      o.position.y -= 0.03 * settled
      o.rotation.set(0, Math.atan2(marks.table.x - spot.x, marks.table.z - spot.z), 0)
    }
    const want = { moving, seated: !moving && !asleepNow && settled > 0.5, asleep: !moving && asleepNow && settled > 0.5 }
    if (want.moving !== pose.moving || want.seated !== pose.seated || want.asleep !== pose.asleep) setPose(want)
  })
  return (
    <>
      <group ref={g} visible={false}>
        <group scale={FIG_SCALE}>
          <StaffFigure id={m.id} role={m.role} look={m.look} moving={pose.moving} seated={pose.seated} face={pose.asleep ? 'blink' : undefined} />
        </group>
      </group>
      {quilt && <mesh ref={cover} geometry={QUILT} material={quilt} visible={false} raycast={() => {}} />}
    </>
  )
})

/** the bathroom's door slid the other way from wherever it is along its track (item 427), heard as it goes */
function bathToggle() {
  // (from where it is along its track now, if it was still sliding)
  BATH_STATE.from = BATH_STATE.cur
  BATH_STATE.open = !BATH_STATE.open
  BATH_STATE.t0 = performance.now() / 1000
  slideDoorSound(BATH_STATE.open, 0.6, BATH.s)
}
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __bathDoor: bathToggle })
export function DormRoom({ crew = [], open = false, fallback, working }: { crew?: readonly Living[]; open?: boolean; fallback?: Living
  /** the ids of those on today's shift (the rest of those living in are off: up here all day); none given, all of them are */
  working?: readonly string[] }) {
  const gltf = useGLTF(DORM_URL) as unknown as { scene: THREE.Group }
  const { root, look, marks, pieces, quilts, leftCut, leftX, bathDoor, bathX, bathCut, bathCutX, mats } = useMemo(() => {
    const r = (gltf.scene.getObjectByName('DormRoot') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the lamp's shade a warm glow of its own (unlit); the model's painted night in the window not drawn (the view's its own pane now,
        // item 452); the rest the room's toon, a little of the lamp's warmth on it (it's off the shop's lamps and its shadows: by night it
        // went near black))
        t = src.name === 'DormLampShade' ? new THREE.MeshBasicMaterial({ color: '#ffe6b8' })
          : src.name === 'DormNightView' ? new THREE.MeshBasicMaterial({ visible: false })
            : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, emissive: new THREE.Color('#2a1f14'), emissiveIntensity: 1 })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = src.name !== 'DormLampShade' && src.name !== 'DormNightView'
      m.receiveShadow = true
    })
    // (the room's line, in its own metres: the dining room's 0.0016 a metre; none round the glow, the night, the screen)
    // (nor round the bathroom's water, its mirror, its frosted pane (item 427))
    inkModel(r, (m) => /DormLampShade|DormNightView|DormScreen|DormBathWater|DormMirror|DormFrosted/.test((m.material as THREE.Material).name), { width: 0.0016, weld: true })
    // (the left wall, its trims and the closet's shell, a piece of their own (blender/dorm.py's DormLeftCut), not merged: the view turned round
    // to that side (item 426), they're taken away as a doll's house's near wall is, the closet's floor, shelf and what's in it left; the
    // wall's inner face's x (the piece's furthest in less its trims' 2.2 cm))
    const leftCut = r.getObjectByName('DormLeftCut') ?? new THREE.Group()
    const leftX = new THREE.Box3().setFromObject(leftCut).max.x - 0.022
    // (and the bathroom's door, which slides (item 427); and the bathroom's right wall, its cap and what hangs on it, and the wall between
    // its toilet and its bath with all on that (its DormBathCut, item 447), taken away as the left wall is while the view's turned round
    // past it: the bathroom looked into from that side as one, not a blank wall as tall as the room; the right wall's inner face's x (the
    // piece's furthest out less the wall's 10 cm and its cap's 4 mm over))
    const bathDoor = r.getObjectByName('DormBathDoor') ?? null
    const bathCut = r.getObjectByName('DormBathCut') ?? new THREE.Group()
    const bathCutX = new THREE.Box3().setFromObject(bathCut).max.x - 0.104
    mergeByMaterial(r, (o) => PIECES.test(o.name) || o === leftCut || o === bathDoor || o === bathCut)
    const at = (n: string, d: THREE.Vector3) => r.getObjectByName(n)?.position.clone() ?? d
    const mk: Marks = {
      seats: [0, 1, 2].map((k) => at(`DormSeat${k}`, new THREE.Vector3(-0.9 + k * 0.6, 0.125, 0))),
      beds: [0, 1].map((k) => at(`DormBed${k}`, new THREE.Vector3(-1.1 + k * 1.1, 0.125, -0.55))),
      top: at('DormStairTop', new THREE.Vector3(1.35, 0.055, -0.35)),
      foot: at('DormStairFoot', new THREE.Vector3(1.35, -1.145, 1.22)),
      table: new THREE.Vector3(-0.45, 0.055, 0),
    }
    const ps: Record<string, THREE.Object3D | undefined> = {}
    for (const n of ['DormTable', 'DormTableAway', 'DormBedding0', 'DormBedding1']) ps[n] = r.getObjectByName(n)
    const byName = (n: string) => [...made.values()].find((x) => x.name === n) ?? null
    const lk = r.getObjectByName('DormLook')
    return { root: r, look: lk ? lk.position.clone() : new THREE.Vector3(0.15, 0.6, 0.1), marks: mk, pieces: ps, quilts: [byName('DormFutonBlue'), byName('DormFutonPink')],
      leftCut, leftX, bathDoor, bathX: bathDoor?.position.x ?? 0, bathCut, bathCutX, mats: [...made.values()] }
  }, [gltf])
  // (those living in: the cooks hired (the shop's own second cook when none is), two at most, the futons' and the cushions' number)
  // (the same list while it's the same people: a new array each time the scene's drawn)
  const key = crew.map((m) => `${m.id}:${m.role}`).join(',')
  const living = useMemo(() => {
    const r = crew.filter((m) => commuteOf(m.role, m.id) === 'dorm')
    return (r.length ? r : fallback ? [fallback] : []).slice(0, 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback])
  // (off today: not on today's shift; the shop's own second cook, when none's hired, works every day it's open)
  const offToday = (id: string) => !!working && !working.includes(id) && id !== fallback?.id
  // (the shop shut with one of them still not up the stair (cut short on their way out, or the shop shut by hand): up it now, from its foot)
  const wasOpen = useRef(open)
  const alley = useRef<THREE.Mesh>(null)
  // (item 457: the room on a layer of its own, and only that (scene/floors): drawn, cast into shadows and pointed at only while the camera's up
  // here; what comes into it later (its residents' figures) put there too, a few times a second)
  const outer = useRef<THREE.Group>(null)
  const layered = useRef(0)
  useLayoutEffect(() => { if (outer.current) toDorm(outer.current) })
  // (gone down from, the room let go of the GPU (item 457: the shop alone loaded downstairs): every geometry in it (the model's, kept by the
  // loader, sent up again as it's next gone up to; its ink lines' and its merges', made again) and its own materials and their pictures; not
  // the ink's one material, nor anything the shop shares)
  useEffect(() => () => {
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() })
    for (const mat of mats) {
      for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose()
      mat.dispose()
    }
  }, [root, mats])
  useEffect(() => {
    if (wasOpen.current && !open) for (const m of living) if (DORM_LIFE.downAt.has(m.id) && !DORM_LIFE.upAt.has(m.id)) { DORM_LIFE.upAt.set(m.id, performance.now()); DORM_LIFE.downAt.delete(m.id) }
    wasOpen.current = open
  }, [open, living])
  // (asleep: the table folded away, each sleeper's futon laid; else the table out, the futons in the closet)
  useFrame(({ camera }) => {
    if (++layered.current % 20 === 0 && outer.current) toDorm(outer.current)
    // (the left wall and the closet's shell away while the camera's out past it (item 426), back as it comes round)
    CAM_IN.copy(camera.position)
    root.worldToLocal(CAM_IN)
    const out = CAM_IN.x < leftX - 0.05
    if (leftCut.visible === out) leftCut.visible = !out
    // (and the bathroom's right wall while it's out past that (item 427))
    const outR = CAM_IN.x > bathCutX + 0.05
    if (bathCut.visible === outR) bathCut.visible = !outR
    // (the bathroom's door sliding (item 427): a little pull the other way first, along into the wall's pocket, a few millimetres past and
    // back as it stops)
    if (bathDoor && BATH_STATE.t0 >= 0) {
      const p = Math.min(1, (performance.now() / 1000 - BATH_STATE.t0) / BATH.s)
      BATH_STATE.cur = doorAlong(p, BATH_STATE.from, BATH_STATE.open ? BATH.slide : 0)
      bathDoor.position.x = bathX - BATH_STATE.cur
      if (p >= 1) BATH_STATE.t0 = -1
    }
    // (the window's view: the camera in its pane's frame, for the depth through it; its picture to the part of the day)
    if (alley.current && ALLEY) {
      alley.current.worldToLocal(ALLEY_CAM.copy(camera.position))
      ALLEY.mat.uniforms.uCam.value.copy(ALLEY_CAM)
    }
    alleyTo()
    const asleep = dormDoing(getClock().minute) === 'sleep'
    let anyone = false
    living.forEach((m, k) => {
      const laid = asleep && BEDS_LAID[k] && upNow(m.id, open, CLIMB_S + 12, offToday(m.id)).here
      const bed = pieces[`DormBedding${k}`]
      if (bed) bed.visible = laid
      anyone ||= laid
    })
    for (const k of [living.length, 2]) { const bed = pieces[`DormBedding${k}`]; if (bed && k >= living.length) bed.visible = false }
    if (pieces.DormTable) pieces.DormTable.visible = !anyone
    if (pieces.DormTableAway) pieces.DormTableAway.visible = anyone
  })
  return (
    <group ref={outer} position={DORM_AT} scale={DORM_SCALE}>
      <primitive object={root} />
      {living.map((m, k) => <Resident key={m.id} m={m} k={k} marks={marks} open={open} quilt={quilts[k % 2]} off={offToday(m.id)} />)}
      {/* (what the view 二樓 looks at: over the table; its +z the room's open front, which the view faces) */}
      <group name="look-dorm" position={look} />
      {/* (the window's view, in depth (item 452)) */}
      {ALLEY && <mesh ref={alley} position={[ALLEY_AT.x, ALLEY_AT.y, ALLEY_AT.z]} material={ALLEY.mat} raycast={() => {}}>
        <planeGeometry args={[ALLEY_AT.w, ALLEY_AT.h]} />
      </mesh>}
      {/* (the stair's well: pointed at, it says where it goes; clicked, down to the shop) */}
      <mesh position={[STAIR.x, 0.08, STAIR.z]} visible={false}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip(null); askView('down') }}
        onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; setTip({ title: '樓梯', hint: '點一下下樓，回到店裡' }) }}
        onPointerOut={() => { document.body.style.cursor = ''; setTip(null) }}>
        <boxGeometry args={[STAIR.w, 0.16, STAIR.d]} />
      </mesh>
      {/* (the bathroom's door (item 427): pointed at, what's behind it; clicked, slid open or shut) */}
      <mesh position={[BATH.x, BATH.y, BATH.z + 0.06]} visible={false}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; bathToggle(); setTip(BATH_TIP(BATH_STATE.open)) }}
        onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; setTip(BATH_TIP(BATH_STATE.open)) }}
        onPointerOut={() => { document.body.style.cursor = ''; setTip(null) }}>
        <boxGeometry args={[BATH.w, BATH.h, 0.04]} />
      </mesh>
      {/* (the bath's half-noren of ゆ over the way in (item 447): its rod on two brackets off the wall, the cloth from it; a click goes
          through it to the door behind) */}
      <mesh position={[YU.x, YU.top, YU.z]} rotation-z={Math.PI / 2} material={YU_ROD} raycast={() => {}}>
        <cylinderGeometry args={[0.008, 0.008, YU.w + 0.06, 10]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[YU.x + k * (YU.w / 2 + 0.02), YU.top, YU.z - 0.014]} material={YU_BRACKET} raycast={() => {}}>
          <boxGeometry args={[0.012, 0.012, 0.03]} />
        </mesh>
      ))}
      <mesh position={[YU.x, YU.top - 0.008 - YU.l / 2, YU.z]} material={YU_MAT} raycast={() => {}}>
        <planeGeometry args={[YU.w, YU.l]} />
      </mesh>
      {/* (the closet's doors and the chest: pointed at, named; clicked, the owner's clothes to choose (App's panel, as a click on him opens)) */}
      {WARDROBE.map((w) => (
        <mesh key={w.en} position={w.at as unknown as THREE.Vector3Tuple} visible={false}
          onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip(null); window.dispatchEvent(new CustomEvent('jgs-outfit')) }}
          onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; setTip(wardrobeTip(w)) }}
          onPointerOut={() => { document.body.style.cursor = ''; setTip(null) }}>
          <boxGeometry args={w.size as unknown as THREE.Vector3Tuple} />
        </mesh>
      ))}
    </group>
  )
}
