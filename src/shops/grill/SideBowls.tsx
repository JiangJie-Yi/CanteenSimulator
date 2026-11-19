/**
 * The rice and the miso soup as they're served (items 205, 206, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？我要看
 * 到好的動畫品質」): the bowls, the paddle and the ladle (blender/sidebowls.py), how they and the hands go through each beat of filling a
 * bowl (game/sides' RICE_BEATS, SOUP_BEATS), and the bowls at the customers' places, eaten down. GuestBar3D walks the one filling them and
 * the one carrying them out, and poses these from what's here; all in the bar's frame.
 */
import { memo, useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { warmLater } from '@/scene/Prewarm'
import { rimmedTray } from '@/scene/trayGeometry'
import { GAME_SPEED } from '@/scene/speed'
import { beatAt, fillAt, RICE_BEATS, SOUP_BEATS } from '@/game/sides'
import { BOWL_LIFT } from '@/scene/bowlLift'
import { BOWLS } from './bar'

export const SIDEBOWLS_URL = import.meta.env.BASE_URL + 'models/sidebowls.glb'
useGLTF.preload(SIDEBOWLS_URL)

const UP = new THREE.Vector3(0, 1, 0)
/** the paddle and the ladle drawn larger than life, to read beside the cooker and the pot (each drawn larger itself: the cooker half again
 * its size, the owner's) and in the staff's big hands; the paddle's blade's middle, out along it from the grip (blender/sidebowls.py), and
 * the ladle's cup from its grip (in its own frame), at that size */
export const PADDLE_SCALE = 1.8, LADLE_SCALE = 1.6
const BLADE = 0.058 * PADDLE_SCALE
const CUP = new THREE.Vector3(-0.185, -0.106, 0).multiplyScalar(LADLE_SCALE)
/** the ladle's handle as made (blender/sidebowls.py's OtamaHandle: from its cup's rim up and out to the grip), in the ladle's own frame
 * with its cup's bottom's middle at the origin (x out along the handle, y up), at the size it's drawn; the cup's radius and height; half
 * the handle's thickness; how steeply the line from its cup to its grip rises as made (rad) (item 253: where it lies on the pot's rim is
 * found along it) */
const HANDLE = ([[0.028, 0.02], [0.06, 0.06], [0.17, 0.11], [0.185, 0.106]] as const).map(([x, y]) => [x * LADLE_SCALE, y * LADLE_SCALE] as const)
const CUP_R = 0.028 * LADLE_SCALE, CUP_H = 0.022 * LADLE_SCALE, HANDLE_T = 0.003 * LADLE_SCALE
const HANDLE_LIFT = Math.atan2(0.106, 0.185)
/** how far round from the pot's open half's middle toward the one filling its handle lies as it rests in the pot (rad: past the lid's edge) */
const LADLE_TURN = 0.52
/** the paddle as made (blender/sidebowls.py): grip to its blade's tip, and half its blade's width, at the size it's drawn */
const PADDLE_LEN = 0.094 * PADDLE_SCALE, PADDLE_HALF_W = 0.028 * PADDLE_SCALE
/** the paddle's holder (しゃもじ立て, item 253, the owner's 「這個?」: the paddle hung beside the cooker from nothing, its blade's tip at the
 * counter's edge): a little indigo-glazed cup stood on the counter against the cooker's side, the paddle stood in it blade down; its
 * radius (its blade fits in it, a hair to spare), its height, how thick its wall and floor are */
export const HOLDER_R = PADDLE_HALF_W + 0.01, HOLDER_H = 0.07, HOLDER_T = 0.005
/** how far the paddle leans back toward the one filling as it stands in its holder (rad) */
const PADDLE_LEAN = 0.2
/** how long a bowl lasts a customer eating it (ms at the shop's own pace, as fast again at x2: Roasting's SIDE_EAT_S, they get up after),
 * and how much is left when they're done */
const EAT_MS = 12000
const LEFT_AT_END = 0.12

/** the props' own copies of their materials, once: the room's toon light, the steel too; the ladle's cup open, drawn both sides */
const dressed = new Map<THREE.Material, THREE.Material>()
/** (item 374) the bowls' materials as the seats' instanced bowls draw them: a copy of each of their own, the same program. Shared with the
 * bowls drawn one at a time (in hands, at the counter, on the trays), three switched each material's program between the two every frame
 * (instanced and not), its parameters worked out afresh each time, some 125 draws a second */
const instancedCopies = new Map<THREE.Material, THREE.Material>()
const forInstances = (m: THREE.Material) => {
  let c = instancedCopies.get(m)
  if (!c) { c = m.clone(); c.name = m.name; instancedCopies.set(m, c) }
  return c
}
function dress(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const one = (src: THREE.Material) => {
      let t = dressed.get(src)
      if (!t) {
        const s = src as THREE.MeshStandardMaterial
        // (the ladle's cup open, and the soup's face a single disc (its facing as Blender left it): both drawn from either side)
        t = new THREE.MeshToonMaterial({ color: s.color.clone(), map: s.map ?? null, side: s.name === 'OtamaSteel' || s.name === 'MisoSurface' ? THREE.DoubleSide : THREE.FrontSide })
        t.name = s.name
        dressed.set(src, t)
      }
      return t
    }
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material)
    m.castShadow = false
    m.receiveShadow = true
  })
}

export type SideProps = {
  chawan: THREE.Group; rice: THREE.Object3D; wan: THREE.Group; soup: THREE.Object3D
  shamoji: THREE.Group; lump: THREE.Object3D; otama: THREE.Group; ladleSoup: THREE.Object3D; stream: THREE.Mesh
  /** the paddle's holder by the cooker (item 253) */
  holder: THREE.Group
}
/** one set of the props for the one filling bowls and carrying them out: a rice bowl and its rice, a soup bowl and its soup, the paddle and
 * its lump of rice, the ladle and the soup in it, the soup's stream as it's poured; each a group at its origin, inked, made ready to draw */
export function useSideProps(): SideProps {
  const gltf = useGLTF(SIDEBOWLS_URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    const part = (name: string) => {
      const o = gltf.scene.getObjectByName(name)!.clone(true)
      o.position.set(0, 0, 0)
      o.rotation.set(0, 0, 0)
      dress(o)
      return o
    }
    const group = (...os: THREE.Object3D[]) => { const g = new THREE.Group(); for (const o of os) g.add(o); return g }
    const rice = part('ChawanRice'), soup = part('WanSoup'), lump = part('ShamojiRice'), ladleSoup = part('OtamaSoup')
    const chawan = group(part('ChawanBody'), rice), wan = group(part('WanBody'), soup)
    // (the lump on the blade's middle, a hair over its face)
    lump.position.set(0, 0.003, 0.058)
    const shamoji = group(part('Shamoji'), lump), otama = group(part('Otama'), ladleSoup)
    shamoji.scale.setScalar(PADDLE_SCALE)
    otama.scale.setScalar(LADLE_SCALE)
    // (the paddle's holder (item 253): an indigo glaze against the terrazzo and the cooker's pastel green; 16 round, its floor closed by rungs)
    const cupMesh = new THREE.Mesh(rimmedTray(HOLDER_R, HOLDER_H, HOLDER_T, 16), new THREE.MeshToonMaterial({ color: '#3b4a6b' }))
    cupMesh.name = 'ShamojiHolder'
    cupMesh.receiveShadow = true
    const holder = group(cupMesh)
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0025, 1, 6, 1, true).translate(0, -0.5, 0),
      new THREE.MeshToonMaterial({ color: '#a8713a' }))
    for (const g of [chawan, wan, shamoji, otama, holder]) {
      inkModel(g, () => false, { width: 0.0012, weld: true })
      g.visible = false
      warmLater(g)
    }
    stream.visible = false
    warmLater(stream)
    return { chawan, rice, wan, soup, shamoji, lump, otama, ladleSoup, stream, holder }
  }, [gltf])
}

/** the places a filling's poses are worked from (the bar's frame): the rice cooker's mouth, or the soup pot's rim's middle and its soup's
 * face; which way the one filling faces (level, toward it) and their right; how wide the cooker or the pot is across */
export type FillAt = { top: THREE.Vector3; face: THREE.Vector3; right: THREE.Vector3; r: number; surface?: number
  /** the counter's top it stands on, and where the one filling stands: the bowl's set down on the counter in front of it and filled
   * there, steadied by the left hand (the counters come up to the staff's chins: held up over it, it was at their faces) */
  low: number; stand: THREE.Vector3
  /** where on the counter the bowl's set down to be filled: beside it, on the side away from its neighbour (the cooker's front is up
   * against the counter's edge: no room there) */
  put: THREE.Vector3
  /** the soup pot: which way its open half lies (its lid's pushed half off across it): the ladle dips there and rests there */
  open?: THREE.Vector3
  /** the soup pot: how high its floor is inside (the ladle rests on it, item 253) */
  floor?: number
  /** the soup pot: how far its inside wall is from its middle, the way `dir` points (it's oval, not round: `r` is its narrowest), and how
   * high its rolled rim stands (item 253: the ladle set by the narrowest, or the widest, went through its wall) */
  rimR?: (dir: THREE.Vector3) => number
  rimTop?: number
  /** (the rice cooker) what stands beside it, the paddle's holder kept clear of: where, how wide (item 253) */
  keepOff?: { at: THREE.Vector3; r: number }[] }
/** where a bowl's carried in front of one walking (GuestBar3D's: their hands out in front at a tray's height), from where they stand */
const carryAt = (W: FillAt) => W.stand.clone().addScaledVector(W.face, 0.315).setY(W.stand.y + 0.3)
/** a filling's pose at a moment: where each hand's to be, the bowl (shown or not, and how full), the tool's grip and how it's turned, what's
 * on it, the cooker's lid lifted (rice), the soup's stream (from where, to where) */
export type FillPose = { beat: string; left: THREE.Vector3; right: THREE.Vector3; bowl: THREE.Vector3 | null; fill: number
  tool: { grip: THREE.Vector3; q: THREE.Quaternion; held: boolean }; load: number; lid: number; stream: [THREE.Vector3, THREE.Vector3] | null
  /** (rice) the right hand on the cooker's lid's knob just now: GuestBar3D puts it where the knob really is (item 387: from the first of the
   * lid's beat it did, and the hand eased there from by the waist in a line through the cooker's front, 0.2 into it) */
  onKnob?: boolean }

const sm = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k) }
/** a point through keyframes ([k, point] in order, eased between) */
function keyed(k: number, keys: [number, THREE.Vector3][], out = new THREE.Vector3()) {
  if (k <= keys[0][0]) return out.copy(keys[0][1])
  for (let i = 1; i < keys.length; i++) {
    if (k <= keys[i][0]) return out.copy(keys[i - 1][1]).lerp(keys[i][1], sm((k - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])))
  }
  return out.copy(keys[keys.length - 1][1])
}
/** a turn that has a long thing's axis (its +z) along `dir`, its face (its +y) as near `ref` as it goes, then rolled about its axis */
function along(dir: THREE.Vector3, ref: THREE.Vector3, roll: number) {
  const z = dir.clone().normalize()
  const y = ref.clone().addScaledVector(z, -ref.dot(z))
  if (y.lengthSq() < 1e-8) y.set(1, 0, 0)
  y.normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll))
}

/** where the paddle's holder stands (on the counter's top): against the cooker's side, on the side away from where the bowl's set down,
 * turned toward the one filling as far as the counter's front leaves room (the gap between the cooker and the miso pot there is widest
 * nearer the front); clear of what stands beside it (W.keepOff) (item 253) */
export function holderAt(W: FillAt) {
  const sd = W.put.clone().sub(W.top).dot(W.right) > 0 ? -1 : 1
  const side = W.right.clone().multiplyScalar(sd), toward = W.face.clone().negate()
  const d = W.r + HOLDER_R + 0.004
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return W.top.clone().addScaledVector(side, d * Math.cos(a)).addScaledVector(toward, d * Math.sin(a)).setY(W.low)
  }
  const clear = (p: THREE.Vector3) => !(W.keepOff ?? []).some((o) => Math.hypot(p.x - o.at.x, p.z - o.at.z) < o.r + HOLDER_R + 0.01)
  return [35, 25, 45, 15, 0].map(at).find(clear) ?? at(35)
}
/** where the paddle stands in its holder (item 253: it hung beside the cooker from nothing): its blade's tip on the holder's floor a little
 * to the far side, leaning back toward the one filling, through the holder's middle; the grip a hand takes and how it's turned, its blade's
 * middle, which way it points (grip to tip), its face, and where its holder stands */
export function paddleRest(W: FillAt) {
  const holder = holderAt(W)
  const dir = W.face.clone().multiplyScalar(Math.sin(PADDLE_LEAN)).addScaledVector(UP, -Math.cos(PADDLE_LEAN))
  const tip = holder.clone().addScaledVector(W.face, HOLDER_H * 0.5 * Math.tan(PADDLE_LEAN)).setY(W.low + HOLDER_T + 0.002)
  const grip = tip.clone().addScaledVector(dir, -PADDLE_LEN)
  const face = W.face.clone().negate()
  return { grip, q: along(dir, face, 0), blade: grip.clone().addScaledVector(dir, BLADE), dir, face, holder }
}
/** which way the ladle's handle runs as it's held (level): back toward the one filling, a little to their right */
const ladleBack = (W: FillAt) => W.face.clone().negate().addScaledVector(W.right, 0.35).normalize()
/** where the ladle's cup goes in and out of the pot: in its open half, its cup clear of the wall and past the lid's edge (item 253) */
const mouthOf = (W: FillAt) => { const d = W.open ?? W.right; return W.top.clone().addScaledVector(d, rimOf(W, d) - CUP_R - 0.012) }
/** how far the pot's inside wall is from its middle the way `dir` points (its oval's; round, `r`) */
const rimOf = (W: FillAt, dir: THREE.Vector3) => W.rimR?.(dir) ?? W.r
/** how high the ladle's handle is (over its cup's bottom) where it's `D` out from its cup, its handle's line rising `lift`; the lowest of
 * where it crosses there (its end hooks down), or null: none of it reaches out that far */
function handleAt(D: number, lift: number) {
  const phi = lift - HANDLE_LIFT, c = Math.cos(phi), s = Math.sin(phi)
  let lo: number | null = null
  for (let i = 0; i < HANDLE.length - 1; i++) {
    const [ax, ay] = HANDLE[i], [bx, by] = HANDLE[i + 1]
    const x1 = ax * c - ay * s, y1 = ax * s + ay * c, x2 = bx * c - by * s, y2 = bx * s + by * c
    if ((x1 - D) * (x2 - D) > 0 || x1 === x2) continue
    const y = y1 + ((y2 - y1) * (D - x1)) / (x2 - x1)
    lo = lo === null ? y : Math.min(lo, y)
  }
  return lo
}
/** how steeply the ladle's handle must rise (ladleAt's `lift`) with its cup at `cup` and its handle running out along `back` for it to clear
 * the pot's rim, lying on it; never less than `min` (item 253: dipped in the soup its handle at 0.35 ran through the pot's side) */
function clearLift(W: FillAt, cup: THREE.Vector3, back: THREE.Vector3, min: number) {
  // (how far out along `back` from the cup the rim is, past its inside edge, its oval's wherever it's crossed; the cup out of the pot
  // (pouring): nothing to clear)
  const out = (p: THREE.Vector3) => { const d = p.clone().sub(W.top).setY(0); const l = d.length(); return l > rimOf(W, l > 1e-6 ? d.divideScalar(l) : back) + 0.004 }
  if (out(cup) || W.open === undefined) return min
  let D = 0
  while (D < 0.5 && !out(cup.clone().addScaledVector(back, D))) D += 0.002
  // (over its rolled rim, where there is one, not its inside's top)
  const over = (W.rimTop ?? W.top.y + 0.004) + 0.003 + HANDLE_T - cup.y
  for (let lift = min; lift < 1.55; lift += 0.02) {
    const h = handleAt(D, lift)
    if (h === null || h >= over) return lift
  }
  return 1.55
}
/** where the ladle rests (item 253, the owner's 「這個?」: it was set from a height worked out with the lid and the pot's own ladle in the
 * pot's box, and hung in the air over the lid): in the soup on the pot's floor in its open half, its handle out over the rim toward the one
 * filling, lying on it, tipped up just so far as that; its grip and how it's turned, where its cup is, which way its handle runs, how steeply */
export function ladleRest(W: FillAt) {
  const open = W.open ?? W.right, toward = W.face.clone().negate()
  const across = new THREE.Vector3(-open.z, 0, open.x)
  if (across.dot(toward) < 0) across.negate()
  const back = open.clone().multiplyScalar(Math.cos(LADLE_TURN)).addScaledVector(across, Math.sin(LADLE_TURN)).normalize()
  // (its cup a little up off the floor: tipped as it lies, its far edge goes down)
  const cup = W.top.clone().addScaledVector(back, rimOf(W, back) - CUP_R - 0.012).setY((W.floor ?? W.top.y - 0.15) + 0.016)
  const lift = clearLift(W, cup, back, HANDLE_LIFT - 0.3)
  return { ...ladleAt(W, cup, lift, 0, back), cup, lift, back }
}
/** the ladle with its cup's middle at `cup`, its handle rising back toward the one filling (`lift`, rad up from level, along `back`), tipped
 * over its handle's line by `tip` (rad: pouring); its grip */
function ladleAt(W: FillAt, cup: THREE.Vector3, lift: number, tip: number, back = ladleBack(W)) {
  // (the model's handle runs from the cup up and along +x to the grip: turned so it runs along `back`)
  const yaw = Math.atan2(-back.z, back.x)
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), lift - 0.52))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tip))
  const grip = cup.clone().sub(CUP.clone().applyQuaternion(q))
  return { grip, q }
}

/** a bowl of rice filled at the cooker, at a time `t` through RICE_BEATS (item 206): the lid lifted off by its knob and held back, a bowl
 * taken up from the shelf under the counter into the left hand, the paddle off its hook, two scoops lifted out and tipped into the bowl, the
 * heap patted round, the paddle hung back, the lid down on */
export function riceFillPose(W: FillAt, t: number): FillPose {
  const { beat, k, n } = beatAt(RICE_BEATS, t)
  const C = W.top, f = W.face, r = W.right
  const at = (dr: number, df: number, du: number) => C.clone().addScaledVector(r, dr).addScaledVector(f, df).addScaledVector(UP, du)
  const B = W.put.clone()
  const rim = B.clone().addScaledVector(f, -0.05).addScaledVector(UP, 0.05)
  const shelf = carryAt(W).addScaledVector(r, -0.08).setY(W.low - 0.32)
  const knob = (lid: number) => at(0, -0.035 * lid, 0.085 + 0.06 * lid)
  const restL = carryAt(W).addScaledVector(r, -0.08), restR = carryAt(W).addScaledVector(r, 0.1)
  const hang = paddleRest(W)
  const held = { grip: hang.grip.clone(), q: hang.q.clone(), held: false }
  // (its blade's middle just out of the holder, drawn up along its own length (its blade was through the holder's side, item 253))
  const outOfHolder = hang.blade.clone().addScaledVector(hang.dir, -(HOLDER_H + 0.015))
  let left = restL, right = restR, bowl: THREE.Vector3 | null = B.clone(), lid = 1, load = 0, onKnob = false
  // (the paddle held: its blade's middle at `blade`, pointing along `dir`, its face toward `face`, rolled `roll`)
  const holdQ = (blade: THREE.Vector3, q: THREE.Quaternion) => {
    held.q.copy(q)
    held.grip.copy(blade).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(q), -BLADE)
    held.held = true
    right = held.grip.clone()
  }
  const hold = (blade: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, roll = 0) => holdQ(blade, along(dir, face, roll))
  const inPot = at(0.005, 0.0, -0.025), outPot = at(0.0, -0.02, 0.1), overBowl = B.clone().addScaledVector(UP, 0.1)
  const down = UP.clone().negate().addScaledVector(f, 0.45), level = f.clone().multiplyScalar(0.6).addScaledVector(r, -0.55).addScaledVector(UP, 0.15)
  switch (beat) {
    case 'lid': {
      lid = sm((k - 0.35) / 0.65)
      // (up in front of the counter's edge from by the waist, over the cooker's front and down onto its knob (item 387: straight there, the
      // hand went through the counter's edge and the cooker's front))
      const upFront = restR.clone().setY(W.low + 0.12), overFront = at(0, -W.r - 0.05, 0.14)
      right = keyed(k, [[0, restR], [0.12, upFront], [0.25, overFront], [0.35, knob(0)], [1, knob(1)]])
      onKnob = k >= 0.35
      bowl = null
      break
    }
    case 'bowl':
      right = at(W.r * 0.7, -W.r - 0.06, 0).setY(W.low + 0.1)
      // (down to the shelf under the counter for one, up and set down on the counter before the cooker)
      left = keyed(k, [[0, restL], [0.4, shelf], [0.85, rim], [1, rim]])
      bowl = k < 0.4 ? null : k < 0.85 ? left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05) : B.clone()
      break
    case 'paddle':
      left = rim
      if (k < 0.5) right = keyed(k, [[0, at(W.r * 0.7, -W.r - 0.06, 0).setY(W.low + 0.1)], [0.5, hang.grip]])
      else {
        // (drawn straight up out of its holder, then over the cooker's mouth, turning to point down into it, its face up, as the scoop
        // begins (item 242: it turned to lie level, and the scoop began pointing down: snapped round in one frame))
        // (turned the shortest way from how it hung to how the scoop begins: the two ways it points eased between, a face crossed the line
        // it points along and it flipped right round)
        const kk = (k - 0.5) / 0.5, e = sm((kk - 0.1) / 0.9)
        holdQ(keyed(kk, [[0, hang.blade], [0.3, outOfHolder], [1, outPot]]), hang.q.clone().slerp(along(down, UP, 0), e))
      }
      break
    case 'scoop': {
      left = rim
      // (down into the rice, the blade turned to cut under it, up out with a lump on it, over to the bowl and tipped off it, with a little
      // shake as it goes; the first scoop then back over the pot, pointing down again, for the second (item 242: it ended over the bowl,
      // lying level, and the second began over the pot pointing down: the paddle jumped across and snapped round 2 rad in one frame))
      const back = n === 0 ? 0.8 : 1, u = k / back
      const blade = u <= 1 ? keyed(u, [[0, outPot], [0.28, inPot], [0.42, at(-0.02, -0.015, -0.015)], [0.58, outPot], [0.72, overBowl], [1, overBowl]])
        : overBowl.clone().lerp(outPot, sm((k - back) / (1 - back)))
      const dir = u < 0.5 ? down.clone().lerp(level, sm((u - 0.3) / 0.2)) : u <= 1 ? level : level.clone().lerp(down, sm((k - back) / (1 - back)))
      const roll = u < 0.72 || u > 1 ? 0 : 1.95 * Math.sin(Math.PI * Math.min(1, (u - 0.72) / 0.28)) + Math.sin(u * 60) * 0.05 * (u > 0.8 ? 1 : 0)
      hold(blade, dir, UP, roll)
      load = u > 0.38 && u < 0.86 ? 1 - sm((u - 0.76) / 0.1) : 0
      break
    }
    case 'pat': {
      left = rim
      // (eased down from over the bowl into the pats and up again to where it's taken back from (item 242: it jumped to the pats' tilt and
      // back, half a radian each way in a frame))
      const e = sm(k / 0.2) * (1 - sm((k - 0.8) / 0.2))
      const pat = B.clone().addScaledVector(UP, 0.066 + 0.014 * Math.abs(Math.sin(k * Math.PI * 2)))
      const from = B.clone().addScaledVector(UP, k < 0.5 ? 0.1 : 0.09)
      hold(from.lerp(pat, e), level.clone().lerp(level.clone().addScaledVector(UP, -0.5), e), UP, 0)
      break
    }
    case 'paddleBack':
      left = rim
      // (over the holder, stood up as it goes, and down into it)
      if (k < 0.75) {
        const kk = k / 0.75, e = sm(kk / 0.7)
        holdQ(keyed(kk, [[0, B.clone().addScaledVector(UP, 0.09)], [0.7, outOfHolder], [1, hang.blade]]), along(level, UP, 0).slerp(hang.q, e))
      } else right = hang.grip.clone()
      break
    case 'lidOn':
      // (the bowl taken up off the counter as the lid goes on, into their hands to carry)
      left = keyed(k, [[0, rim], [0.45, rim], [1, carryAt(W).addScaledVector(r, -0.03)]])
      bowl = k < 0.45 ? B.clone() : left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05)
      lid = 1 - sm((k - 0.3) / 0.7)
      right = keyed(k, [[0, hang.grip], [0.3, knob(1)], [1, knob(0)]])
      onKnob = k >= 0.3
      break
  }
  if (beat === 'lid') lid = Math.max(lid, 0)
  return { beat, left, right, bowl, fill: fillAt(RICE_BEATS, 'scoop', t), tool: held, load, lid, stream: null, onKnob }
}

/** a bowl of miso soup filled at the pot, at a time through SOUP_BEATS: a bowl up from the shelf into the left hand, the ladle taken from
 * the pot, two ladlefuls dipped and poured into the bowl (its stream running as it's tipped), the ladle put back */
export function soupFillPose(W: FillAt, t: number): FillPose {
  const { beat, k } = beatAt(SOUP_BEATS, t)
  const Q = W.top, f = W.face, r = W.right
  const B = W.put.clone()
  const rim = B.clone().addScaledVector(f, -0.05).addScaledVector(UP, 0.05)
  const shelf = carryAt(W).addScaledVector(r, -0.08).setY(W.low - 0.32)
  const restL = carryAt(W).addScaledVector(r, -0.08), restR = carryAt(W).addScaledVector(r, 0.1)
  const surf = (W.surface ?? Q.y - 0.04) - Q.y
  const rest = ladleRest(W), BACK = ladleBack(W)
  const tool = { grip: rest.grip.clone(), q: rest.q.clone(), held: false }
  let left = restL, right = restR, bowl: THREE.Vector3 | null = B.clone(), load = 0
  let stream: [THREE.Vector3, THREE.Vector3] | null = null
  // (held: its cup at `cup`, its handle along `back`, rising `lift`, or as steeply as it must to clear the pot's rim (item 253))
  const hold = (cup: THREE.Vector3, lift: number, tip: number, back = BACK) => {
    const p = ladleAt(W, cup, clearLift(W, cup, back, lift), tip, back)
    tool.grip.copy(p.grip); tool.q.copy(p.q); tool.held = true
    right = p.grip.clone()
  }
  // (in and out through the pot's open half, past its lid's edge; dipped till the soup's over its cup (on the floor when there's little):
  // its surface where it is now (item 253: it was the soup's own origin, the pot's floor))
  const mouth = mouthOf(W), above = mouth.clone().setY(Q.y + 0.09)
  const inSoup = mouth.clone().setY(Math.max((W.floor ?? Q.y - 0.15) + 0.016, Q.y + surf - CUP_H * 0.9)), overBowl = B.clone().addScaledVector(UP, 0.085)
  switch (beat) {
    case 'bowl':
      left = keyed(k, [[0, restL], [0.4, shelf], [0.85, rim], [1, rim]])
      bowl = k < 0.4 ? null : k < 0.85 ? left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05) : B.clone()
      break
    case 'ladle':
      left = rim
      if (k < 0.5) right = keyed(k / 0.5, [[0, restR], [1, rest.grip]])
      else {
        // (drawn straight up out of the soup off the pot's floor as it lay, then its handle laid back toward the one filling over the rim)
        const kk = (k - 0.5) / 0.5, e = sm((kk - 0.45) / 0.55)
        hold(keyed(kk, [[0, rest.cup], [0.55, above]]), rest.lift + (0.35 - rest.lift) * e, 0, rest.back.clone().lerp(BACK, e).normalize())
      }
      break
    case 'dip':
      left = rim
      hold(keyed(k, [[0, above], [0.45, inSoup], [0.7, inSoup], [1, above]]), 0.35, 0)
      load = k > 0.55 ? 1 : 0
      break
    case 'pour': {
      left = rim
      // (over to the bowl, tipped and poured, and up level again back over the pot's mouth, where the next dip or the putting back begins
      // (item 242: it ended over the bowl, tipped, and the next beat began over the pot: the ladle jumped a pot's width in one frame))
      const tip = 1.75 * sm((k - 0.25) / 0.3) * (1 - sm((k - 0.72) / 0.24))
      hold(keyed(k, [[0, above], [0.25, overBowl], [0.72, overBowl], [1, above]]), 0.35, -tip)
      load = 1 - sm((k - 0.32) / 0.33)
      if (k > 0.34 && k < 0.68) {
        const lip = overBowl.clone().addScaledVector(r, -0.022)
        stream = [lip, B.clone().addScaledVector(UP, 0.02 + 0.03 * fillAt(SOUP_BEATS, 'pour', t))]
      }
      break
    }
    case 'ladleBack':
      // (the bowl taken up off the counter as the ladle goes back, into their hands to carry)
      left = keyed(k, [[0, rim], [0.4, rim], [1, carryAt(W).addScaledVector(r, -0.03)]])
      bowl = k < 0.4 ? B.clone() : left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05)
      // (its handle turned out over the rim the way it lies, and down onto the pot's floor)
      if (k < 0.75) {
        const kk = k / 0.75, e = sm(kk / 0.45)
        hold(keyed(kk, [[0, above], [0.45, above], [1, rest.cup]]), 0.35 + (rest.lift - 0.35) * e, 0, BACK.clone().lerp(rest.back, e).normalize())
      } else right = rest.grip.clone()
      break
  }
  return { beat, left, right, bowl, fill: fillAt(SOUP_BEATS, 'pour', t), tool, load, lid: 0, stream }
}

/** how much is left of a bowl set at a place (0..1): full as it's set down, eaten down over EAT_MS at the shop's pace, a little left */
export function leftOf(key: string, now = performance.now()) {
  const at = BOWLS.setAt.get(key)
  if (at === undefined) return 1
  const k = Math.min(1, ((now - at) * GAME_SPEED.value) / EAT_MS)
  return 1 - (1 - LEFT_AT_END) * k
}

/** the rice heap and the soup's face in their bowls as full as `fill` (0..1): the heap down into the bowl and narrower as it goes, the
 * soup's face lower; at the places, and in the hands as they're filled */
export function fillRice(rice: THREE.Object3D, fill: number) {
  rice.visible = fill > 0.02
  const s = Math.max(0.02, fill)
  rice.scale.set(0.55 + 0.45 * s, s, 0.55 + 0.45 * s)
  rice.position.y = 0.014 + 0.036 * s
}
export function fillSoup(soup: THREE.Object3D, fill: number) {
  soup.visible = fill > 0.02
  const s = Math.max(0.02, fill)
  soup.scale.set(0.62 + 0.38 * s, 1, 0.62 + 0.38 * s)
  soup.position.y = 0.014 + 0.028 * s
}

const SEAT_MAX = 12
type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; kind: 'body' | 'rice' | 'soup' }
/**
 * The bowls set at the customers' places, eaten down (item 205: the soup's bowl stood full till it was cleared): each part of the rice bowl
 * and the soup bowl one draw for all of them (instanced), laid out where GuestBar3D says (the bar's frame), as full as each has been eaten to.
 */
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const SeatBowls = memo(SeatBowlsImpl)
function SeatBowlsImpl({ rice, soup }: { rice: { key: string; at: THREE.Vector3; yaw: number }[]; soup: { key: string; at: THREE.Vector3; yaw: number }[] }) {
  const gltf = useGLTF(SIDEBOWLS_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const grab = (name: string, kind: Part['kind']) => {
      const o = gltf.scene.getObjectByName(name)!.clone(true)
      dress(o)
      const out: Part[] = []
      o.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) out.push({ geo: me.geometry, mat: forInstances(me.material as THREE.Material), kind }) })
      return out
    }
    return { rice: [...grab('ChawanBody', 'body'), ...grab('ChawanRice', 'rice')], soup: [...grab('WanBody', 'body'), ...grab('WanSoup', 'soup')] }
  }, [gltf])
  const meshes = useRef<Record<'rice' | 'soup', (THREE.InstancedMesh | null)[]>>({ rice: [], soup: [] })
  const M = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), lp: new THREE.Vector3(), lq: new THREE.Quaternion(), wq: new THREE.Quaternion() }), [])
  useLayoutEffect(() => { for (const k of ['rice', 'soup'] as const) for (const m of meshes.current[k]) if (m) warmLater(m) }, [])
  useFrame(() => {
    const now = performance.now()
    for (const k of ['rice', 'soup'] as const) {
      const list = k === 'rice' ? rice : soup
      parts[k].forEach((pt, i) => {
        const m = meshes.current[k][i]
        if (!m) return
        const n = Math.min(SEAT_MAX, list.length)
        for (let j = 0; j < n; j++) {
          const b = list[j], left = leftOf(b.key, now)
          // (a bowl up in someone's hands for a mouthful (item 345, scene/bowlLift): where they hold it, tipped as they hold it)
          const lift = BOWL_LIFT.get(b.key)
          if (lift) {
            m.worldToLocal(M.lp.copy(lift.p))
            M.lq.copy(m.getWorldQuaternion(M.wq).invert()).multiply(lift.q)
            if (pt.kind === 'body') M.m.compose(M.lp, M.lq, M.s.set(1, 1, 1))
            else {
              const s = Math.max(0.02, left)
              const up = pt.kind === 'rice' ? 0.014 + 0.036 * s : 0.014 + 0.028 * s
              M.m.compose(M.p.set(0, up, 0).applyQuaternion(M.lq).add(M.lp), M.lq, pt.kind === 'rice' ? M.s.set(0.55 + 0.45 * s, s, 0.55 + 0.45 * s) : M.s.set(0.62 + 0.38 * s, 1, 0.62 + 0.38 * s))
            }
            m.setMatrixAt(j, M.m)
            continue
          }
          M.q.setFromAxisAngle(UP, b.yaw)
          if (pt.kind === 'body') M.m.compose(b.at, M.q, M.s.set(1, 1, 1))
          else if (pt.kind === 'rice') {
            const s = Math.max(0.02, left)
            M.m.compose(M.p.copy(b.at).add(new THREE.Vector3(0, 0.014 + 0.036 * s, 0)), M.q, M.s.set(0.55 + 0.45 * s, s, 0.55 + 0.45 * s))
          } else {
            const s = Math.max(0.02, left)
            M.m.compose(M.p.copy(b.at).add(new THREE.Vector3(0, 0.014 + 0.028 * s, 0)), M.q, M.s.set(0.62 + 0.38 * s, 1, 0.62 + 0.38 * s))
          }
          m.setMatrixAt(j, M.m)
        }
        m.count = n
        m.instanceMatrix.needsUpdate = true
      })
    }
  })
  return (
    <>
      {(['rice', 'soup'] as const).map((k) => parts[k].map((pt, i) => (
        <instancedMesh key={`${k}${i}`} ref={(o) => { meshes.current[k][i] = o }} args={[pt.geo, pt.mat, SEAT_MAX]} count={0} frustumCulled={false} receiveShadow />
      )))}
    </>
  )
}
