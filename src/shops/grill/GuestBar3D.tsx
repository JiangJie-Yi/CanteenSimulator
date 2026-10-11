import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { GuestView } from '@/game/types'
import { MoodFace } from '@/ui/MoodFace'
import { guestLabel } from '@/data/guests'
import { Person } from '@/scene/Person3D'
import type { Lang } from '@/data/i18n'
import { CLOUD_WARE, wareGeometry } from './ware'
import { AISLE, alongPath, doorOf, pathLength, pathTo, seatsOf, singleCounter, type Counter } from './bar'

/*
 * The customers, in 3D, at the bar behind the cooking (only while the shop is open). A long counter of pale hinoki
 * on a dark panelled front, stools along the far side; a customer walks in from the end of the bar, sits on a free
 * stool facing the cook, waits ("…"), eats (leaning in, chopsticks going), and when they're done gets up and walks
 * off — their face says how it was. They're dressed as what they are (guests.ts).
 *
 * The plates are handled for real: a stack of clean ones at the left end of the bar; as a customer sits down one is
 * lifted off the top and set in front of them; when they get up it's cleared onto the dirty stack at the right
 * end, which, once it's grown, is taken back to be washed and comes back to the clean stack plate by plate.
 */

const LAY = new THREE.Vector3(0.59, 0, 0.81)       // toward the camera (the cook's side)
const ALONG = new THREE.Vector3(0.81, 0, -0.59)    // along the first counter
const SPEED = 1.5                                   // how fast they walk in and out (per second)
const INK = '#3b2a20'

/** toon material, and its ink outline (a slightly bigger back-faced shell) */
function Part({ geo, color, outline = 1.06, ...rest }: { geo: THREE.BufferGeometry; color: string; outline?: number } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geo} castShadow>
        <meshToonMaterial color={color} />
      </mesh>
      {outline > 0 && (
        <mesh geometry={geo} scale={outline}>
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  )
}

const GEO = {
  seat: new THREE.CylinderGeometry(0.11, 0.1, 0.03, 20),
  stoolLeg: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
}

/** the customers (and their stools) at life size beside the bar, which is drawn to match them */
const PEOPLE_SCALE = 1.3

/** the noren's cloth: deep indigo, a white band of the shop's mark across its three panels, faded at the hem */
const norenTexture = (mark: string) => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#1f2f55')
  grad.addColorStop(1, '#2b3f6e')
  g.fillStyle = grad
  g.fillRect(0, 0, 384, 256)
  // a fine weave
  g.strokeStyle = 'rgba(255,255,255,0.04)'
  for (let y = 0; y < 256; y += 3) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(384, y)
    g.stroke()
  }
  // the shop's name, one character on each outer panel, and a crest of waves in a ring on the middle one
  g.fillStyle = '#f4efe2'
  g.font = 'bold 76px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const [a, b] = [...mark]
  g.fillText(a ?? '', 64, 110)
  g.fillText(b ?? '', 320, 110)
  g.strokeStyle = '#f4efe2'
  g.lineWidth = 6
  g.beginPath()
  g.arc(192, 104, 40, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3
  for (let q = 0; q < 3; q++) {
    g.beginPath()
    g.arc(192, 122, 10 + q * 9, Math.PI, Math.PI * 2)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** one panel's third of the noren cloth (a clone of the texture, offset) */
const panelTex = (tex: THREE.Texture | null, i: number) => {
  if (!tex) return null
  const key = `p${i}`
  const cache = (tex.userData.panels ??= {}) as Record<string, THREE.Texture>
  if (!cache[key]) {
    const t = tex.clone()
    t.repeat.set(1 / 3, 1)
    t.offset.set(i / 3, 0)
    t.needsUpdate = true
    cache[key] = t
  }
  return cache[key]
}
/** wide old floorboards for the passage in */
const PLANKS = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  for (let b = 0; b < 4; b++) {
    g.fillStyle = ['#8a6440', '#7d5a3a', '#94704a', '#836040'][b]
    g.fillRect(b * 32, 0, 32, 512)
    g.strokeStyle = 'rgba(40,25,15,0.25)'
    for (let k = 0; k < 6; k++) {
      g.beginPath()
      g.moveTo(b * 32 + 4 + k * 5, 0)
      g.bezierCurveTo(b * 32 + 2 + k * 5, 170, b * 32 + 8 + k * 5, 340, b * 32 + 4 + k * 5, 512)
      g.stroke()
    }
    g.fillStyle = 'rgba(30,18,10,0.6)'
    g.fillRect(b * 32, 0, 1.5, 512)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/**
 * The way in: a noren hanging just past the end of the bar, three panels that sway a little.
 */
function Entrance({ at, mark }: { at: THREE.Vector3; mark: string }) {
  const tex = useMemo(() => norenTexture(mark), [mark])
  const panels = useRef<(THREE.Mesh | null)[]>([])
  const yaw = Math.atan2(ALONG.x, ALONG.z)
  const W = 0.78, H = 1.5, NOREN = 0.62
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    panels.current.forEach((m, i) => {
      if (m) m.rotation.x = Math.sin(t * 1.3 + i * 0.9) * 0.05
    })
  })
  return (
    <group position={at} rotation-y={yaw}>
      {/* the noren: three panels side by side, hung from a bamboo rod (no frame: it hangs in the way in by itself) */}
      <mesh position={[0, H - 0.05, 0.03]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, W, 8]} />
        <meshToonMaterial color="#c9a46a" />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <group key={k} position={[k * (W / 3), H - 0.05, 0.035]}>
          <mesh ref={(m) => { panels.current[k + 1] = m }} position-y={-NOREN / 2}>
            <planeGeometry args={[W / 3 - 0.012, NOREN]} />
            <meshToonMaterial map={panelTex(tex, k + 1)} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * The customers' side of the shop floored in wide old boards: one even rectangle under the whole bar, the row of
 * stools and the way along behind them to the noren, its boards running the length of the bar.
 */
function DiningFloor({ c, from, to }: { c: Counter; from: number; to: number }) {
  const yaw = Math.atan2(c.along.x, c.along.z)
  const at = c.at
  // (in the floor's own frame: z along the bar, x away from the cook, so lay is -x)
  const near = FLOOR_NEAR
  const far = FLOOR_FAR
  const w = near - far
  const l = to - from
  const map = useMemo(() => {
    if (!PLANKS) return null
    const t = PLANKS.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(w / 0.5, l / 2)
    t.needsUpdate = true
    return t
  }, [w, l])
  return (
    <group position={at} rotation-y={yaw}>
      <mesh rotation-x={-Math.PI / 2} position={[-(near + far) / 2, 0.004, (from + to) / 2]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshToonMaterial color="#ffffff" map={map} />
      </mesh>
      {/* a dark edging board round it, so it reads as a floor laid down, not a mat */}
      {[from, to].map((z) => (
        <mesh key={z} position={[-(near + far) / 2, 0.01, z]}>
          <boxGeometry args={[w + 0.04, 0.02, 0.04]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      ))}
      {[-near, -far].map((x) => (
        <mesh key={x} position={[x, 0.01, (from + to) / 2]}>
          <boxGeometry args={[0.04, 0.02, l + 0.04]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      ))}
    </group>
  )
}

/** the floor reaches this far under the counter, and back past the aisle */
const FLOOR_NEAR = 0.42
const FLOOR_FAR = -(AISLE + 0.5)

function Stool() {
  return (
    <group>
      <Part geo={GEO.seat} color="#8a5a30" position={[0, 0.33, 0]} />
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return <mesh key={k} geometry={GEO.stoolLeg} position={[Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07]}><meshToonMaterial color="#5a3a20" /></mesh>
      })}
    </group>
  )
}

/** the counter itself (for the shops that don't draw their own): hinoki top, panelled dark front, a lip */
function Counter({ length }: { length: number }) {
  const top = useMemo(() => new THREE.BoxGeometry(length + 0.3, 0.07, 0.62), [length])
  const front = useMemo(() => new THREE.BoxGeometry(length + 0.2, 0.4, 0.5), [length])
  return (
    <group rotation-y={Math.atan2(-ALONG.z, ALONG.x)}>
      <Part geo={top} color="#d9b884" outline={1.02} position={[0, 0.43, 0]} />
      <Part geo={front} color="#3a2a1e" outline={1.01} position={[0, 0.2, 0]} />
      {Array.from({ length: Math.round(length / 0.6) }, (_, k) => (
        <mesh key={k} position={[-length / 2 + 0.3 + k * 0.6, 0.2, 0.252]}>
          <boxGeometry args={[0.46, 0.3, 0.01]} />
          <meshToonMaterial color="#4a3626" />
        </mesh>
      ))}
    </group>
  )
}

type Shown = { id: number; seat: number; phase: 'enter' | 'sit' | 'leave'; t: number }

/** a plate on its way to a seat ('serve'), set at it ('set'), or being cleared away ('clear', after a pause) */
type PlateRun = { key: number; seat: number; guest: number; phase: 'serve' | 'set' | 'clear'; t: number; from: THREE.Vector3
  /** (clearing) its place on the dirty stack, taken when it sets off, so two cleared at once don't aim for the same one */
  to?: THREE.Vector3 }
const STACK_GAP = 0.026
const CLEAN_START = 8
/** the dirty stack goes to be washed once it's this high (and nothing's on its way to it) */
const WASH_AT = 5
const SERVE_S = 0.55
const CLEAR_S = 0.6
const CLEAR_DELAY = 1.0
const WASH_S = 0.9
// (the same shape as the big plate by the fire, smaller: a foot, a shallow well, a lifted rim)
const PLATE_R = 0.19
const PLATE_GEO = wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.012], [0.47, 0.03], [0.5, 0.038], [0.49, 0.042], [0.44, 0.026],
  [0.3, 0.01], [0, 0.01]] as [number, number][]).map(([x, y]) => [x * PLATE_R * 2, y] as [number, number]), PLATE_R)
const SMEAR_GEO = new THREE.CircleGeometry(0.085, 18)
const USED_STICK_GEO = new THREE.CylinderGeometry(0.004, 0.003, 0.26, 5)

/** a customer's plate, of the shop's one set of painted ware (dirty: a smear of sauce and a used stick) */
function Plate({ dirty = false }: { dirty?: boolean }) {
  return (
    <group>
      <mesh geometry={PLATE_GEO} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={CLOUD_WARE} />
      </mesh>
      <mesh geometry={PLATE_GEO} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {dirty && (
        <>
          <mesh geometry={SMEAR_GEO} position={[0.03, 0.013, -0.02]} rotation-x={-Math.PI / 2} scale={[1.2, 0.8, 1]}>
            <meshBasicMaterial color="#8a5a32" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh geometry={USED_STICK_GEO} position={[-0.02, 0.018, 0.03]} rotation={[0, 0.6, Math.PI / 2]}>
            <meshToonMaterial color="#c9a46a" />
          </mesh>
        </>
      )}
    </group>
  )
}

export function GuestBar3D({ guests, at, length = 3.6, drawCounter = true, lang, top = 0.465, people = true, mark = '食堂', counters: given }:
  { guests: GuestView[]; at: THREE.Vector3; length?: number; drawCounter?: boolean; lang: Lang
    /** where the customers sit (the first counter's middle is at, and its door past its far end); one of four if not given */
    counters?: Counter[]
    /** what's dyed on the noren at the door (its first character in the middle) */
    mark?: string
    /** the height of the bar top, where the plates go */
    top?: number
    /** draw the customers themselves (a phone shows them in 2D instead; the plates still come and go) */
    people?: boolean }) {
  const [shown, setShown] = useState<Shown[]>([])
  const guestsRef = useRef(guests)
  guestsRef.current = guests
  const groups = useRef(new Map<number, THREE.Group>())
  const clock = useRef(0)
  const counters = useMemo(() => given ?? singleCounter(at, length), [given, at, length])
  const seats = useMemo(() => seatsOf(counters), [counters])
  const paths = useMemo(() => seats.map((st) => {
    const path = pathTo(counters, st)
    return { path, len: pathLength(path) }
  }), [counters, seats])
  const plateAt = (n: number) => seats[n].plate.clone().setY(top)
  const cleanAt = (k: number) => at.clone().addScaledVector(ALONG, -length / 2 + 0.02).addScaledVector(LAY, 0.06).setY(top + k * STACK_GAP)
  const dirtyAt = (k: number) => at.clone().addScaledVector(ALONG, length / 2 - 0.02).addScaledVector(LAY, 0.06).setY(top + k * STACK_GAP)

  // the plates: those out at the seats (or on their way), and the two stacks
  const [, setTick] = useState(0)
  const redraw = () => setTick((n) => n + 1)
  const runs = useRef<PlateRun[]>([])
  const runSeq = useRef(0)
  const runObjs = useRef(new Map<number, THREE.Group>())
  /** when each clean plate (bottom up) came back to the stack: it drops onto it */
  const clean = useRef<number[]>(Array.from({ length: CLEAN_START }, () => -9))
  const cleanObjs = useRef<(THREE.Group | null)[]>([])
  const dirty = useRef(0)
  const dirtyStack = useRef<THREE.Group>(null)
  const wash = useRef<number | null>(null)
  /** customers sat down waiting for a plate: there wasn't a clean one on the stack (they're being washed) */
  const waiting = useRef<{ seat: number; guest: number }[]>([])
  const serve = (seat: number, guest: number) => {
    // only a plate that's actually on the stack (not one still on its way back from the wash)
    const top = clean.current[clean.current.length - 1]
    if (top === undefined || clock.current < top + 0.25) {
      waiting.current.push({ seat, guest })
      return
    }
    const from = cleanAt(clean.current.length - 1)
    clean.current = clean.current.slice(0, -1)
    runs.current.push({ key: ++runSeq.current, seat, guest, phase: 'serve', t: 0, from })
    redraw()
  }
  /** this customer's plate is cleared away (after a moment); one still waiting for a plate needn't get one */
  const clear = (guest: number) => {
    waiting.current = waiting.current.filter((w) => w.guest !== guest)
    const r = runs.current.find((x) => x.guest === guest && x.phase !== 'clear')
    if (r) {
      r.phase = 'clear'
      r.t = -CLEAR_DELAY
    }
  }
  const shownRef = useRef<Shown[]>([])

  shownRef.current = shown
  useEffect(() => {
    // (the plates are seen to here, not in the state update below, which must stay free of side effects)
    for (const g of guests) {
      const s = shownRef.current.find((x) => x.id === g.id)
      if (s && g.state !== 'waiting' && g.state !== 'eating' && s.phase !== 'leave') clear(g.id)
    }
    setShown((cur) => {
      let next = [...cur]
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          const taken = new Set(next.map((x) => x.seat))
          // (the shop may have given them a stool already: it only does once the last one there has gone)
          const seat = g.seat !== undefined ? g.seat : Array.from({ length: seats.length }, (_, i) => i).find((i) => !taken.has(i))
          if (seat !== undefined) next.push({ id: g.id, seat, phase: 'enter', t: 0 })
        } else if (s && !seated && s.phase !== 'leave') {
          next = next.map((x) => (x.id === g.id ? { ...x, phase: 'leave', t: 0 } : x))
        }
      }
      return next
    })
  }, [guests])

  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.1)
    let done: number[] = []
    for (const s of shown) {
      s.t += Math.min(dt, 0.1)
      // (they come and go whether or not they're drawn: on a phone they aren't, but their plates still follow them)
      const g = groups.current.get(s.id)
      const st = seats[s.seat]
      if (!st) continue
      const { path, len } = paths[s.seat]
      if (s.phase === 'enter') {
        // in through the noren, along the aisle behind the stools (round the corner, for the other counter), and
        // in to their own stool
        const d = Math.min(len, s.t * SPEED)
        const { p, dir } = alongPath(path, d)
        g?.position.copy(p)
        if (g) g.rotation.y = d < len ? Math.atan2(dir.x, dir.z) : st.yaw
        if (d >= len) {
          s.phase = 'sit'
          // a plate is set in front of them
          serve(s.seat, s.id)
        }
      } else if (s.phase === 'sit') {
        g?.position.copy(st.stool)
        if (g) g.rotation.y = st.yaw
      } else {
        // a moment to get up, then off the way they came
        const d = Math.max(0, Math.min(len, (s.t - 0.8) * SPEED))
        const { p, dir } = alongPath(path, len - d)
        g?.position.copy(p)
        if (g) g.rotation.y = s.t < 0.8 ? st.yaw : Math.atan2(-dir.x, -dir.z)
        if (d >= len) done.push(s.id)
      }
    }
    if (done.length) setShown((cur) => cur.filter((x) => !done.includes(x.id)))
    done = []

    // anyone who sat down while the stack was empty gets a plate as soon as there's one back on it
    const top = clean.current[clean.current.length - 1]
    if (waiting.current.length && top !== undefined && clock.current >= top + 0.25) {
      const w = waiting.current.shift()!
      serve(w.seat, w.guest)
    }

    // the plates on the move: lifted off the stack in an arc to the seat, and cleared away to the dirty stack
    const step = Math.min(dt, 0.1)
    let finished = 0
    for (const r of runs.current) {
      r.t += step
      const o = runObjs.current.get(r.key)
      if (r.phase === 'set' || r.phase === 'clear' && r.t < 0) {
        if (r.phase === 'set') o?.position.copy(plateAt(r.seat))
        continue
      }
      if (r.phase === 'clear' && !r.to) {
        // setting off: from where it is, to the next free place on the dirty stack
        if (o) r.from = o.position.clone()
        const flying = runs.current.filter((x) => x !== r && x.phase === 'clear' && x.to && x.t !== Infinity).length
        r.to = dirtyAt(dirty.current + flying)
      }
      const to = r.phase === 'clear' ? r.to! : plateAt(r.seat)
      const k = Math.min(1, r.t / (r.phase === 'serve' ? SERVE_S : CLEAR_S))
      const e = k * k * (3 - 2 * k)
      if (o) {
        o.position.lerpVectors(r.from, to, e)
        o.position.y += Math.sin(Math.PI * k) * 0.22
        o.rotation.z = Math.sin(Math.PI * k) * 0.12
      }
      if (k >= 1) {
        if (r.phase === 'serve') r.phase = 'set'
        else {
          r.t = Infinity
          finished++
        }
      }
    }
    if (finished) {
      runs.current = runs.current.filter((r) => r.t !== Infinity)
      dirty.current += finished
      redraw()
    }
    // the dirty stack, once it's grown, goes back to be washed (toward the kitchen and down out of sight); it comes
    // back clean, one plate at a time, onto the clean stack
    // (and straight away when the clean stack has run out)
    if (wash.current === null && (dirty.current >= WASH_AT || dirty.current > 0 && !clean.current.length) &&
      !runs.current.some((r) => r.phase === 'clear' && r.t >= 0)) wash.current = 0
    if (wash.current !== null) {
      wash.current += step
      const k = Math.min(1, wash.current / WASH_S)
      const e = k * k * (3 - 2 * k)
      dirtyStack.current?.position.set(0, -0.5 * e, 0).addScaledVector(LAY, 0.7 * e)
      if (k >= 1) {
        const n = dirty.current
        dirty.current = 0
        wash.current = null
        dirtyStack.current?.position.set(0, 0, 0)
        const now = clock.current
        clean.current = [...clean.current, ...Array.from({ length: n }, (_, i) => now + 1.2 + i * 0.35)]
        redraw()
      }
    }
    // clean plates coming back drop onto the stack
    clean.current.forEach((born, i) => {
      const o = cleanObjs.current[i]
      if (!o) return
      const k = Math.max(0, Math.min(1, (clock.current - born) / 0.25))
      o.visible = clock.current >= born
      o.position.copy(cleanAt(i)).y += (1 - k * k) * 0.3
    })
  })

  return (
    <group>
      {drawCounter && <group position={at}><Counter length={length} /></group>}
      {counters.map((c, i) => {
        // the first counter's floor runs on past its end to the door, and back to meet the others' aisles; each other
        // one's runs up to the first one's
        const c0 = counters[0]
        if (i === 0) {
          const back = Math.min(-c.length / 2 - 0.35, ...counters.slice(1).map((o) =>
            o.at.clone().addScaledVector(o.lay, FLOOR_FAR).sub(c.at).dot(c.along)))
          return <DiningFloor key={i} c={c} from={back} to={c.length / 2 + 1.45} />
        }
        const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
        return <DiningFloor key={i} c={c} from={-c.length / 2 - 0.35} to={meet} />
      })}
      {/* the way in, just past the end of the bar where the customers come and go */}
      <Entrance at={doorOf(counters)} mark={mark} />
      {seats.map((st, n) => (
        <group key={n} position={st.stool} rotation-y={st.yaw} scale={PEOPLE_SCALE}><Stool /></group>
      ))}
      {/* the clean stack, the dirty one, and the plates out at the seats */}
      {clean.current.map((_, i) => (
        <group key={`c${i}`} ref={(o) => { cleanObjs.current[i] = o; if (o && !o.userData.placed) { o.userData.placed = true; o.position.copy(cleanAt(i)) } }}>
          <Plate />
        </group>
      ))}
      <group ref={dirtyStack}>
        {Array.from({ length: dirty.current }, (_, i) => (
          <group key={`d${i}`} position={dirtyAt(i)} rotation-y={i * 0.9}><Plate dirty /></group>
        ))}
      </group>
      {runs.current.map((r) => (
        <group key={r.key} ref={(o) => {
          if (!o) return void runObjs.current.delete(r.key)
          runObjs.current.set(r.key, o)
          if (!o.userData.placed) {
            o.userData.placed = true
            o.position.copy(r.from)
          }
        }}>
          <Plate dirty={r.phase === 'clear'} />
        </group>
      ))}
      {people && shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const walking = s.phase !== 'sit'
        return (
          <group key={s.id} ref={(o) => { if (o) groups.current.set(s.id, o); else groups.current.delete(s.id) }}>
            <group scale={PEOPLE_SCALE}>
              <PersonClock s={s} eating={() => s.phase === 'sit' && guestsRef.current.find((x) => x.id === s.id)?.state === 'eating'} clock={clock} />
            </group>
            <Html position={[0, 0.98 * PEOPLE_SCALE, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
              <div className="g3-label">
                {g && !walking && g.state === 'waiting' && g.rating === null && <span className="g3-bubble">…</span>}
                {g && g.rating !== null && <MoodFace guest={g} />}
                <span>{guestLabel(s.id, lang)}</span>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/** re-renders the figure each frame (its little movements), without re-rendering the whole bar */
function PersonClock({ s, eating, clock }: { s: Shown; eating: () => boolean; clock: { current: number } }) {
  const [t, setT] = useState(0)
  useFrame(() => setT(clock.current))
  return <Person id={s.id} eating={eating()} walking={s.phase !== 'sit'} t={t} />
}
