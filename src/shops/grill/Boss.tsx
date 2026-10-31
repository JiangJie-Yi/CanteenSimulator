import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { airbrush, gradientMap } from '@/scene/Person3D'
import { getEdit } from './edit'
import type { Lang } from '@/data/i18n'
import { bossLineText, bossSituation, nextBossLine, tasteLineText, type BossSituation } from '@/data/bossLines'

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
const UNINKED = /(Eye|Shine|Brow|Cheek|Moustache|Mouth|Tongue|Print|Collar|Knot|Band|Cord|Nose|Thumb|Glass|Hem|Tongs|Fan)/
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
const RUN_SPEED = 2.4

/** `to`: the far end of his walk, in the frame he stands in (x, z), from his place at its origin, facing +z */
/** a taste he's been asked for (Roasting, as the owner clicks something in the tasting bowl): where it is (world), and whether he's there
 * to eat it yet; cleared when it's eaten */
export const BOSS_TASTE = { at: null as THREE.Vector3 | null, arrived: false, since: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __bossTaste?: typeof BOSS_TASTE }).__bossTaste = BOSS_TASTE
/** `to`: the far end of his walk; `open`: the shop's open (his chef has the grill, he stays put); he mutters in `lang` */
export function Boss({ to = [0, 0], open = false, lang = 'zh', children }: { to?: [number, number]; open?: boolean; lang?: Lang; children?: ReactNode }) {
  // ---- muttering to himself, always: a line every few seconds, by day or night, open or shut (data/bossLines), never the same twice running
  const [say, setSay] = useState<{ text: string; key: number } | null>(null)
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
  const root = useMemo(() => {
    if (!made) {
      const r = gltf.scene.clone(true)
      const mats = new Map<THREE.Material, THREE.Material>()
      r.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const src = m.material as THREE.MeshStandardMaterial
        let t = mats.get(src)
        if (!t) {
          t = /White|Dark/.test(src.name)
            ? new THREE.MeshBasicMaterial({ color: src.color.clone() })
            : airbrush(new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, gradientMap }))
          mats.set(src, t)
        }
        m.material = t
        m.castShadow = !UNINKED.test(m.name)
        m.receiveShadow = true
      })
      inkModel(r, (m) => UNINKED.test(m.name), { width: 0.006, weld: true })
      made = r
    }
    return made
  }, [gltf])
  const mover = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const parts = useMemo(() => ({
    handR: root.getObjectByName('BossHandR'),
    handL: root.getObjectByName('BossHandL'),
    tongs: root.getObjectByName('BossTongs'),
    fan: root.getObjectByName('BossFan'),
    smile: root.getObjectByName('BossMouth'),
    talk: ['BossMouthOpen', 'BossMouthTongue'].map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[],
    eyes: ['BossEye-1', 'BossEye1', 'BossEyeShine-1', 'BossEyeShine1', 'BossEyeShineB-1', 'BossEyeShineB1']
      .map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[],
  }), [root])
  const st = useRef({ last: 0, phase: 0, t: 0, x: 0, z: 0, yaw: 0, stride: 0, blinkAt: 2, blinks: 0, y: 0, vy: 0, ground: 0, probeAt: -1 })
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
    for (const h of ray.intersectObjects(scene.children, true)) {
      const o = h.object as THREE.Mesh
      if (!o.isMesh || !solid(o, m)) continue
      return frame.worldToLocal(h.point.clone()).y
    }
    return 0
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
      if (/outline/i.test(o.name) || (!Array.isArray(m) && m.side === THREE.BackSide)) { ink.push(o); return }
      for (const x of Array.isArray(m) ? m : [m]) set.add(x)
    })
    return { mats: [...set], inks: ink }
  }, [root])
  const controls = useThree((s) => s.controls) as unknown as { target?: THREE.Vector3 } | null
  const fadeClock = useRef(0)
  useFrame(({ camera: cam, clock }) => {
    const m = mover.current
    if (!m) return
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
    const want = !getEdit().on && !lookedAt && inView && over && along > 0 && along < lookD - 1.2 ? 0.35 : 1
    ghost.current += (want - ghost.current) * Math.min(1, Math.min(dt, 0.1) * 6)
    const k = ghost.current
    for (const o of inks) o.visible = k > 0.95
    const faded = k < 0.99
    // (faded by hashing, not blending: each pixel of him drawn or not by a fine dither as faint as he is, his nearest surface still hiding his
    // far side, so he's one see-through figure whatever's drawn first; blended, he went to a jumble or to black)
    for (const x of mats) {
      if (x.alphaHash !== faded) { x.alphaHash = faded; x.needsUpdate = true }
      x.opacity = k
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
    let act: Phase['act'] | 'taste' = ph.act
    let speed = 0
    // (asked to taste: down his aisle to where it passes nearest the bowl, turned to it, and there he eats it; then back to his round)
    const ask = !edit && BOSS_TASTE.at && m.parent ? m.parent.worldToLocal(BOSS_TASTE.at.clone()) : null
    if (ask) {
      const len = Math.hypot(to[0], to[1]) || 1
      const ux = to[0] / len, uz = to[1] / len
      const k = Math.max(-0.4, Math.min(len, ask.x * ux + ask.z * uz))
      const gx = ux * k, gz = uz * k
      const dx = gx - s.x, dz = gz - s.z
      const d = Math.hypot(dx, dz)
      if (d > 0.03) {
        speed = RUN_SPEED
        const stepL = Math.min(d, speed * dt)
        s.x += (dx / d) * stepL; s.z += (dz / d) * stepL
        s.stride += stepL
        turnTo(s, Math.atan2(dx, dz), dt * 9)
        BOSS_TASTE.arrived = false
      } else {
        turnTo(s, Math.atan2(ask.x - s.x, ask.z - s.z), dt * 7)
        if (!BOSS_TASTE.arrived) { BOSS_TASTE.arrived = true; BOSS_TASTE.since = T; setSay({ text: tasteLineText(Math.random(), lang), key: Date.now() }) }
        // (never left standing there: whatever it was is gone by now)
        if (T - BOSS_TASTE.since > 10) { BOSS_TASTE.at = null; BOSS_TASTE.arrived = false }
        act = 'taste'
      }
      s.t = 0
      // (and when he's done, he runs back to his place and starts his round again from there)
      const runIx = ROUNDS.findIndex((x) => x.act === 'run')
      s.phase = runIx >= 0 ? runIx : 0
    } else if (act === 'walk' || act === 'run') {
      const [gx, gz] = act === 'walk' ? to : [0, 0]
      const dx = gx - s.x, dz = gz - s.z
      const d = Math.hypot(dx, dz)
      speed = act === 'walk' ? WALK_SPEED : RUN_SPEED
      if (d < 0.02) {
        s.x = gx; s.z = gz
        s.phase = (s.phase + 1) % ROUNDS.length; s.t = 0
        speed = 0
      } else {
        const step = Math.min(d, speed * dt)
        s.x += (dx / d) * step; s.z += (dz / d) * step
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
    // little bounce
    if (T - s.probeAt > 0.2) { s.probeAt = T; s.ground = groundBelow(m, s.x, s.z) }
    const scale = m.parent?.getWorldScale(new THREE.Vector3()).y || 1
    if (s.y > s.ground + 1e-4 || s.vy > 0) {
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
    if (parts.tongs) {
      parts.tongs.visible = act === 'tongs'
      parts.tongs.position.copy(hand).add(new THREE.Vector3(-0.02, 0.0, 0.02))
      parts.tongs.rotation.set(0.5 - Math.max(0, Math.sin(s.t * 2.2)) ** 6 * 0.5, -0.25, 0)
    }
    if (parts.fan) {
      parts.fan.visible = act === 'fan'
      parts.fan.position.copy(hand).add(new THREE.Vector3(0, 0.0, 0.02))
      // (fanned to and fro at the fire, quick)
      parts.fan.rotation.set(-0.5 + Math.sin(T * 13) * 0.55, 0, -0.15)
    }

    // ---- his mouth: while a line's up over his head, it flaps open and shut as he says it, in syllables; the rest of the time his smile
    const talking = !!sayRef.current
    const munching = act === 'taste'
    const gape = (talking && Math.sin(T * 17) + Math.sin(T * 7.3) * 0.6 > 0.2) || (munching && Math.sin((T - BOSS_TASTE.since) * 7) > 0.3)
    if (parts.smile) parts.smile.visible = !gape
    for (const o of parts.talk) {
      o.visible = gape
      const sy = (o.userData.sy ??= o.scale.y) as number
      o.scale.y = sy * (0.7 + 0.3 * Math.abs(Math.sin(T * 17)))
    }
    // ---- a blink every few seconds, now and then twice
    let lid = 1
    const since = T - s.blinkAt
    if (since > 0 && since < 0.14) lid = 0.08 + 0.92 * Math.abs(since / 0.07 - 1)
    else if (since >= 0.14) {
      s.blinkAt = T + (s.blinks % 4 === 3 ? 0.12 : 2.2 + Math.random() * 3)
      s.blinks++
    }
    for (const e of parts.eyes) {
      const sy = (e.userData.sy ??= e.scale.y) as number
      e.scale.y = sy * (/Shine/.test(e.name) ? (lid < 0.5 ? 0 : 1) : lid)
    }
  })
  return (
    <group ref={mover} name="BossFollow">
      {children}
      {/* (what he's muttering, over his head) */}
      {say && !getEdit().on && (
        <Html position={[0, 1.42, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span key={say.key} className="g3-bubble g3-say boss-say">{say.text}</span>
        </Html>
      )}
      <group ref={body}><primitive object={root} /></group>
    </group>
  )
}

/** whether a mesh is something to stand on: shown (it and all above it), not see-through or a shadow, not part of him, not the editor's handles */
function solid(o: THREE.Object3D, self: THREE.Object3D) {
  const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[]
  // (nor a shadow: the floor's shadow-catching sheet, blob shadows and other see-through decals laid over things)
  for (const mm of Array.isArray(mat) ? mat : [mat]) {
    if (!mm.visible || !mm.colorWrite || (mm as THREE.ShadowMaterial).isShadowMaterial || (mm.transparent && (mm.opacity < 0.2 || !mm.depthWrite))) return false
  }
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p === self || !p.visible || p.userData.editHandle || p.name === 'edit-gizmo') return false
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
