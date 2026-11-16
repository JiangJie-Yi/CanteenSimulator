/**
 * The rice and the miso soup as they're served (items 205, 206, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？我要看
 * 到好的動畫品質」): the bowls, the paddle and the ladle (blender/sidebowls.py), how they and the hands go through each beat of filling a
 * bowl (game/sides' RICE_BEATS, SOUP_BEATS), and the bowls at the customers' places, eaten down. GuestBar3D walks the one filling them and
 * the one carrying them out, and poses these from what's here; all in the bar's frame.
 */
import { useMemo, useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { warmLater } from '@/scene/Prewarm'
import { GAME_SPEED } from '@/scene/speed'
import { beatAt, fillAt, RICE_BEATS, SOUP_BEATS } from '@/game/sides'
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
/** how long a bowl lasts a customer eating it (ms at the shop's own pace, as fast again at x2: Roasting's SIDE_EAT_S, they get up after),
 * and how much is left when they're done */
const EAT_MS = 12000
const LEFT_AT_END = 0.12

/** the props' own copies of their materials, once: the room's toon light, the steel too; the ladle's cup open, drawn both sides */
const dressed = new Map<THREE.Material, THREE.Material>()
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
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0025, 1, 6, 1, true).translate(0, -0.5, 0),
      new THREE.MeshToonMaterial({ color: '#a8713a' }))
    for (const g of [chawan, wan, shamoji, otama]) {
      inkModel(g, () => false, { width: 0.0012, weld: true })
      g.visible = false
      warmLater(g)
    }
    stream.visible = false
    warmLater(stream)
    return { chawan, rice, wan, soup, shamoji, lump, otama, ladleSoup, stream }
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
  open?: THREE.Vector3 }
/** where a bowl's carried in front of one walking (GuestBar3D's: their hands out in front at a tray's height), from where they stand */
const carryAt = (W: FillAt) => W.stand.clone().addScaledVector(W.face, 0.315).setY(W.stand.y + 0.3)
/** a filling's pose at a moment: where each hand's to be, the bowl (shown or not, and how full), the tool's grip and how it's turned, what's
 * on it, the cooker's lid lifted (rice), the soup's stream (from where, to where) */
export type FillPose = { beat: string; left: THREE.Vector3; right: THREE.Vector3; bowl: THREE.Vector3 | null; fill: number
  tool: { grip: THREE.Vector3; q: THREE.Quaternion; held: boolean }; load: number; lid: number; stream: [THREE.Vector3, THREE.Vector3] | null }

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

/** where the paddle hangs from the cooker's handle, on the side away from where the bowl's set down, blade down; the grip a hand takes */
export function paddleRest(W: FillAt) {
  const sd = W.put.clone().sub(W.top).dot(W.right) > 0 ? -1 : 1
  const out = W.right.clone().multiplyScalar(sd)
  const grip = W.top.clone().addScaledVector(out, W.r + 0.03).setY(W.low + (W.top.y - W.low) * 0.62 + BLADE)
  return { grip, q: along(UP.clone().negate(), out, 0) }
}
/** where the ladle rests, its cup in the pot by its right wall, its handle up over the rim toward the one filling */
export function ladleRest(W: FillAt) {
  const cup = W.top.clone().addScaledVector(W.open ?? W.right, W.r * 0.5).addScaledVector(UP, -0.03)
  return ladleAt(W, cup, 0.35, 0)
}
/** the ladle with its cup's middle at `cup`, its handle rising back toward the one filling (`lift`, rad up from level), tipped over its
 * handle's line by `tip` (rad: pouring); its grip */
function ladleAt(W: FillAt, cup: THREE.Vector3, lift: number, tip: number) {
  // (the model's handle runs from the cup up and along +x to the grip: turned so it runs back and a little right, toward the one filling)
  const back = W.face.clone().negate().addScaledVector(W.right, 0.35).normalize()
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
  const { beat, k } = beatAt(RICE_BEATS, t)
  const C = W.top, f = W.face, r = W.right
  const at = (dr: number, df: number, du: number) => C.clone().addScaledVector(r, dr).addScaledVector(f, df).addScaledVector(UP, du)
  const B = W.put.clone()
  const rim = B.clone().addScaledVector(f, -0.05).addScaledVector(UP, 0.05)
  const shelf = carryAt(W).addScaledVector(r, -0.08).setY(W.low - 0.32)
  const knob = (lid: number) => at(0, -0.035 * lid, 0.085 + 0.06 * lid)
  const restL = carryAt(W).addScaledVector(r, -0.08), restR = carryAt(W).addScaledVector(r, 0.1)
  const hang = paddleRest(W)
  const held = { grip: hang.grip.clone(), q: hang.q.clone(), held: false }
  let left = restL, right = restR, bowl: THREE.Vector3 | null = B.clone(), lid = 1, load = 0
  // (the paddle held: its blade's middle at `blade`, pointing along `dir`, its face toward `face`, rolled `roll`)
  const hold = (blade: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, roll = 0) => {
    held.q.copy(along(dir, face, roll))
    held.grip.copy(blade).addScaledVector(dir.clone().normalize(), -BLADE)
    held.held = true
    right = held.grip.clone()
  }
  const inPot = at(0.005, 0.0, -0.025), outPot = at(0.0, -0.02, 0.1), overBowl = B.clone().addScaledVector(UP, 0.1)
  const down = UP.clone().negate().addScaledVector(f, 0.45), level = f.clone().multiplyScalar(0.6).addScaledVector(r, -0.55).addScaledVector(UP, 0.15)
  switch (beat) {
    case 'lid':
      lid = sm((k - 0.35) / 0.65)
      right = keyed(k, [[0, restR], [0.35, knob(0)], [1, knob(1)]])
      bowl = null
      break
    case 'bowl':
      right = at(W.r * 0.7, -W.r - 0.06, 0).setY(W.low + 0.1)
      // (down to the shelf under the counter for one, up and set down on the counter before the cooker)
      left = keyed(k, [[0, restL], [0.4, shelf], [0.85, rim], [1, rim]])
      bowl = k < 0.4 ? null : k < 0.85 ? left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05) : B.clone()
      break
    case 'paddle':
      left = rim
      if (k < 0.5) right = keyed(k, [[0, at(W.r * 0.7, -W.r - 0.06, 0).setY(W.low + 0.1)], [0.5, hang.grip]])
      else hold(keyed((k - 0.5) / 0.5, [[0, hang.grip.clone().addScaledVector(UP.clone().negate(), BLADE)], [1, outPot]]),
        down.clone().lerp(level, sm((k - 0.5) / 0.5)), r.clone().negate())
      break
    case 'scoop': {
      left = rim
      // (down into the rice, the blade turned to cut under it, up out with a lump on it, over to the bowl and tipped off it, with a little
      // shake as it goes)
      const blade = keyed(k, [[0, outPot], [0.28, inPot], [0.42, at(-0.02, -0.015, -0.015)], [0.58, outPot], [0.72, overBowl], [1, overBowl]])
      const dir = k < 0.5 ? down.clone().lerp(level, sm((k - 0.3) / 0.2)) : level
      const roll = k < 0.72 ? 0 : 1.95 * Math.sin(Math.PI * Math.min(1, (k - 0.72) / 0.28)) + Math.sin(k * 60) * 0.05 * (k > 0.8 ? 1 : 0)
      hold(blade, dir, UP, roll)
      load = k > 0.38 && k < 0.86 ? 1 - sm((k - 0.76) / 0.1) : 0
      break
    }
    case 'pat':
      left = rim
      hold(B.clone().addScaledVector(UP, 0.066 + 0.014 * Math.abs(Math.sin(k * Math.PI * 2))), level.clone().addScaledVector(UP, -0.5), UP, 0)
      break
    case 'paddleBack':
      left = rim
      if (k < 0.75) hold(keyed(k / 0.75, [[0, B.clone().addScaledVector(UP, 0.09)], [1, hang.grip.clone().addScaledVector(UP.clone().negate(), BLADE)]]),
        level.clone().lerp(UP.clone().negate(), sm(k / 0.75)), UP.clone().lerp(r, sm(k / 0.75)))
      else right = hang.grip.clone()
      break
    case 'lidOn':
      // (the bowl taken up off the counter as the lid goes on, into their hands to carry)
      left = keyed(k, [[0, rim], [0.45, rim], [1, carryAt(W).addScaledVector(r, -0.03)]])
      bowl = k < 0.45 ? B.clone() : left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05)
      lid = 1 - sm((k - 0.3) / 0.7)
      right = keyed(k, [[0, hang.grip], [0.3, knob(1)], [1, knob(0)]])
      break
  }
  if (beat === 'lid') lid = Math.max(lid, 0)
  return { beat, left, right, bowl, fill: fillAt(RICE_BEATS, 'scoop', t), tool: held, load, lid, stream: null }
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
  const rest = ladleRest(W)
  const tool = { grip: rest.grip.clone(), q: rest.q.clone(), held: false }
  let left = restL, right = restR, bowl: THREE.Vector3 | null = B.clone(), load = 0
  let stream: [THREE.Vector3, THREE.Vector3] | null = null
  const hold = (cup: THREE.Vector3, lift: number, tip: number) => {
    const p = ladleAt(W, cup, lift, tip)
    tool.grip.copy(p.grip); tool.q.copy(p.q); tool.held = true
    right = p.grip.clone()
  }
  // (in the open half of the pot, its lid pushed half off over the other)
  const open = W.open ?? r
  const restCup = Q.clone().addScaledVector(open, W.r * 0.5).addScaledVector(UP, -0.03), above = Q.clone().addScaledVector(open, W.r * 0.45).addScaledVector(UP, 0.09)
  const inSoup = Q.clone().addScaledVector(open, W.r * 0.45).addScaledVector(UP, surf - 0.012), overBowl = B.clone().addScaledVector(UP, 0.085)
  switch (beat) {
    case 'bowl':
      left = keyed(k, [[0, restL], [0.4, shelf], [0.85, rim], [1, rim]])
      bowl = k < 0.4 ? null : k < 0.85 ? left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05) : B.clone()
      break
    case 'ladle':
      left = rim
      if (k < 0.5) right = keyed(k / 0.5, [[0, restR], [1, rest.grip]])
      else hold(keyed((k - 0.5) / 0.5, [[0, restCup], [1, above]]), 0.35, 0)
      break
    case 'dip':
      left = rim
      hold(keyed(k, [[0, above], [0.45, inSoup], [0.7, inSoup], [1, above]]), 0.35, 0)
      load = k > 0.55 ? 1 : 0
      break
    case 'pour': {
      left = rim
      const tip = 1.75 * sm((k - 0.35) / 0.45)
      hold(keyed(k, [[0, above], [0.35, overBowl], [1, overBowl]]), 0.35, -tip)
      load = 1 - sm((k - 0.4) / 0.45)
      if (k > 0.42 && k < 0.85) {
        const lip = overBowl.clone().addScaledVector(r, -0.022)
        stream = [lip, B.clone().addScaledVector(UP, 0.02 + 0.03 * fillAt(SOUP_BEATS, 'pour', t))]
      }
      break
    }
    case 'ladleBack':
      // (the bowl taken up off the counter as the ladle goes back, into their hands to carry)
      left = keyed(k, [[0, rim], [0.4, rim], [1, carryAt(W).addScaledVector(r, -0.03)]])
      bowl = k < 0.4 ? B.clone() : left.clone().addScaledVector(UP, -0.05).addScaledVector(r, 0.05)
      if (k < 0.75) hold(keyed(k / 0.75, [[0, above], [1, restCup]]), 0.35, 0)
      else right = rest.grip.clone()
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
export function SeatBowls({ rice, soup }: { rice: { key: string; at: THREE.Vector3; yaw: number }[]; soup: { key: string; at: THREE.Vector3; yaw: number }[] }) {
  const gltf = useGLTF(SIDEBOWLS_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const grab = (name: string, kind: Part['kind']) => {
      const o = gltf.scene.getObjectByName(name)!.clone(true)
      dress(o)
      const out: Part[] = []
      o.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) out.push({ geo: me.geometry, mat: me.material as THREE.Material, kind }) })
      return out
    }
    return { rice: [...grab('ChawanBody', 'body'), ...grab('ChawanRice', 'rice')], soup: [...grab('WanBody', 'body'), ...grab('WanSoup', 'soup')] }
  }, [gltf])
  const meshes = useRef<Record<'rice' | 'soup', (THREE.InstancedMesh | null)[]>>({ rice: [], soup: [] })
  const M = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])
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
