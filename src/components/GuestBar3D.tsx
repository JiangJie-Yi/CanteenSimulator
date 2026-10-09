import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { GuestView } from './Roasting'
import { MoodFace } from './MoodFace'
import { guestLabel, kindOf, type GuestKind } from '../guests'
import type { Lang } from '../i18n'

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
const ALONG = new THREE.Vector3(0.81, 0, -0.59)    // along the bar
const SEATS = 4
const WALK = 1.8                                    // seconds to walk to or from a seat
const INK = '#3b2a20'
const FACE_YAW = Math.atan2(LAY.x, LAY.z)

const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0', '#c99470']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#5a3a2a']
const pick = <T,>(l: T[], n: number) => l[n % l.length]

type Look = { top: string; legs: string; hair: string; skin: string; size: number; wide: number }
function lookOf(id: number, kind: GuestKind): Look {
  const old = kind === 'grandma' || kind === 'grandpa'
  const top: Record<GuestKind, string> = {
    salaryman: '#2b3444', officeLady: '#6a6f78', highSchoolGirl: '#f4f1ea', highSchoolBoy: '#1c1e26', grandma: '#c9b48a',
    grandpa: '#7a5a3a', kid: pick(['#e85a4a', '#4a8ad8', '#f0c040'], id), uncle: pick(['#4a7a5a', '#a8432f', '#3d6a9a'], id),
    student: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), yukata: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
  }
  return {
    top: top[kind],
    legs: kind === 'highSchoolGirl' ? '#23324a' : kind === 'officeLady' ? '#4a4f58' : kind === 'kid' ? '#2a4a7a' : '#2f2f36',
    hair: old ? '#d4d4d4' : pick(HAIR, id * 3),
    skin: pick(SKIN, id * 7 + 1),
    size: kind === 'kid' ? 0.72 : kind === 'grandma' ? 0.9 : 1,
    wide: kind === 'uncle' ? 1.25 : kind === 'grandpa' ? 1.06 : kind === 'highSchoolGirl' || kind === 'officeLady' ? 0.9 : 1,
  }
}

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
  torso: new THREE.CapsuleGeometry(0.11, 0.16, 6, 16),
  arm: new THREE.CapsuleGeometry(0.035, 0.16, 4, 10),
  leg: new THREE.CapsuleGeometry(0.045, 0.2, 4, 10),
  head: new THREE.SphereGeometry(0.105, 24, 16),
  hair: new THREE.SphereGeometry(0.112, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  bun: new THREE.SphereGeometry(0.045, 12, 8),
  cap: new THREE.SphereGeometry(0.118, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  brim: new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16, 1, false, -Math.PI / 2, Math.PI),
  tie: new THREE.BoxGeometry(0.03, 0.12, 0.012),
  collar: new THREE.CylinderGeometry(0.13, 0.12, 0.05, 16, 1, true),
  sash: new THREE.CylinderGeometry(0.118, 0.118, 0.05, 16, 1, true),
  bag: new THREE.BoxGeometry(0.12, 0.14, 0.06),
  eye: new THREE.SphereGeometry(0.012, 8, 6),
  seat: new THREE.CylinderGeometry(0.11, 0.1, 0.03, 20),
  stoolLeg: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
  bowl: new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  stick: new THREE.CylinderGeometry(0.004, 0.003, 0.2, 5),
}

/** one customer, sitting on their stool (or walking), built from simple rounded shapes */
function Person({ id, eating, walking, t }: { id: number; eating: boolean; walking: boolean; t: number }) {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const bald = kind === 'grandpa' || kind === 'uncle'
  // sitting: hips on the stool top (0.34), the torso above; walking: standing on the ground
  const hipY = walking ? 0.32 : 0.36
  const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.02 : eating ? Math.max(0, Math.sin(t * 6)) * 0.03 : 0
  const lean = eating ? 0.25 + Math.sin(t * 6) * 0.06 : 0.05
  const step = walking ? Math.sin(t * 9) * 0.5 : 0
  return (
    <group scale={l.size}>
      {/* legs: bent over the stool when sitting, swinging when walking */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.055 * l.wide, hipY, 0]} rotation-x={walking ? sd * step : -1.35}>
          <Part geo={GEO.leg} color={l.legs} position={[0, -0.14, 0]} />
        </group>
      ))}
      <group position-y={hipY + bob} rotation-x={lean}>
        <Part geo={GEO.torso} color={l.top} position={[0, 0.2, 0]} scale={[l.wide, 1, 0.85]} />
        {/* what marks each kind of customer */}
        {kind === 'salaryman' && <Part geo={GEO.tie} color="#a8322a" outline={0} position={[0, 0.27, 0.1]} />}
        {kind === 'highSchoolGirl' && (
          <>
            <Part geo={GEO.collar} color="#23324a" outline={0} position={[0, 0.34, 0]} />
            <Part geo={GEO.tie} color="#c4302a" outline={0} position={[0, 0.3, 0.11]} scale={[1.6, 0.5, 1]} />
          </>
        )}
        {kind === 'highSchoolBoy' && <Part geo={GEO.collar} color="#0e0f14" outline={0} position={[0, 0.35, 0]} scale={[1, 0.6, 1]} />}
        {kind === 'yukata' && <Part geo={GEO.sash} color="#e8c45a" outline={0} position={[0, 0.14, 0]} scale={[l.wide, 1, 0.85]} />}
        {kind === 'kid' && <Part geo={GEO.bag} color="#c4302a" position={[0, 0.22, -0.11]} />}
        {/* arms: reaching onto the bar, the right one working the chopsticks while eating */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.13 * l.wide, 0.3, 0]}
            rotation={[-(walking ? -sd * step * 0.6 : 1.1 + (eating && sd > 0 ? Math.sin(t * 6) * 0.35 : 0)), 0, sd * 0.15]}>
            <Part geo={GEO.arm} color={l.top} position={[0, -0.1, 0]} />
          </group>
        ))}
        {eating && (
          <group position={[0.06, 0.33, 0.24]} rotation-x={-0.6 + Math.sin(t * 6) * 0.3}>
            <mesh geometry={GEO.stick}><meshToonMaterial color="#8a5a30" /></mesh>
          </group>
        )}
        {/* the head */}
        <group position-y={0.47} rotation-x={eating ? 0.15 : 0}>
          <Part geo={GEO.head} color={l.skin} />
          {!bald && <Part geo={GEO.hair} color={l.hair} outline={0} position={[0, 0.012, -0.008]} rotation-x={-0.25} />}
          {bald && <Part geo={GEO.hair} color={l.hair} outline={0} position={[0, -0.02, -0.03]} rotation-x={-1.2} scale={[1.02, 0.6, 1]} />}
          {(kind === 'highSchoolGirl' || kind === 'officeLady' || kind === 'yukata') && (
            <Part geo={GEO.hair} color={l.hair} outline={0} position={[0, -0.06, -0.03]} rotation-x={Math.PI * 0.75}
              scale={[1, kind === 'highSchoolGirl' ? 1.4 : 1, 1]} />
          )}
          {(kind === 'grandma' || kind === 'yukata') && <Part geo={GEO.bun} color={l.hair} position={[0, 0.1, -0.06]} />}
          {kind === 'kid' && (
            <>
              <Part geo={GEO.cap} color="#f2c62a" position={[0, 0.01, 0]} />
              <Part geo={GEO.brim} color="#f2c62a" outline={0} position={[0, 0.02, 0.09]} />
            </>
          )}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={GEO.eye} position={[sd * 0.035, 0.01, 0.095]}>
              <meshBasicMaterial color="#2a1d16" />
            </mesh>
          ))}
          {kind === 'uncle' && (
            <mesh position={[0, -0.035, 0.1]}>
              <boxGeometry args={[0.06, 0.014, 0.01]} />
              <meshBasicMaterial color="#3a2a1e" />
            </mesh>
          )}
        </group>
      </group>
      {eating && (
        <mesh geometry={GEO.bowl} position={[0, 0.5, 0.3]} rotation-x={Math.PI}>
          <meshToonMaterial color="#e9e1cf" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

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
type PlateRun = { key: number; seat: number; phase: 'serve' | 'set' | 'clear'; t: number; from: THREE.Vector3 }
const STACK_GAP = 0.026
const CLEAN_START = 8
/** the dirty stack goes to be washed once it's this high (and nothing's on its way to it) */
const WASH_AT = 5
const SERVE_S = 0.55
const CLEAR_S = 0.6
const CLEAR_DELAY = 1.0
const WASH_S = 0.9
const PLATE_GEO = new THREE.CylinderGeometry(0.19, 0.15, 0.024, 28)
const RIM_GEO = new THREE.TorusGeometry(0.172, 0.007, 6, 36)
const SMEAR_GEO = new THREE.CircleGeometry(0.085, 18)
const USED_STICK_GEO = new THREE.CylinderGeometry(0.004, 0.003, 0.26, 5)

/** a small white plate with an indigo line round its rim (dirty: a smear of sauce and a used stick) */
function Plate({ dirty = false }: { dirty?: boolean }) {
  return (
    <group>
      <Part geo={PLATE_GEO} color="#f4efe4" outline={1.05} position-y={0.012} />
      <mesh geometry={RIM_GEO} position-y={0.0245} rotation-x={Math.PI / 2}>
        <meshToonMaterial color="#3d5a8c" />
      </mesh>
      {dirty && (
        <>
          <mesh geometry={SMEAR_GEO} position={[0.03, 0.0255, -0.02]} rotation-x={-Math.PI / 2} scale={[1.2, 0.8, 1]}>
            <meshBasicMaterial color="#8a5a32" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh geometry={USED_STICK_GEO} position={[-0.02, 0.03, 0.03]} rotation={[0, 0.6, Math.PI / 2]}>
            <meshToonMaterial color="#c9a46a" />
          </mesh>
        </>
      )}
    </group>
  )
}

export function GuestBar3D({ guests, at, length = 3.6, drawCounter = true, lang, top = 0.465, people = true }:
  { guests: GuestView[]; at: THREE.Vector3; length?: number; drawCounter?: boolean; lang: Lang
    /** the height of the bar top, where the plates go */
    top?: number
    /** draw the customers themselves (a phone shows them in 2D instead; the plates still come and go) */
    people?: boolean }) {
  const [shown, setShown] = useState<Shown[]>([])
  const guestsRef = useRef(guests)
  guestsRef.current = guests
  const groups = useRef(new Map<number, THREE.Group>())
  const clock = useRef(0)
  const seatAt = (n: number) => at.clone().addScaledVector(ALONG, (n - (SEATS - 1) / 2) * (length / SEATS)).addScaledVector(LAY, -0.5)
  const plateAt = (n: number) => at.clone().addScaledVector(ALONG, (n - (SEATS - 1) / 2) * (length / SEATS)).setY(top)
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
  const serve = (seat: number) => {
    const from = cleanAt(Math.max(0, clean.current.length - 1))
    clean.current = clean.current.slice(0, -1)
    runs.current.push({ key: ++runSeq.current, seat, phase: 'serve', t: 0, from })
    redraw()
  }
  const clear = (seat: number) => {
    const r = runs.current.find((x) => x.seat === seat && x.phase !== 'clear')
    if (r) {
      r.phase = 'clear'
      r.t = -CLEAR_DELAY
    }
  }
  const doorAt = (n: number) => at.clone().addScaledVector(ALONG, length / 2 + 0.8).addScaledVector(LAY, -0.5 - n * 0.05)

  useEffect(() => {
    setShown((cur) => {
      let next = [...cur]
      for (const g of guests) {
        const s = next.find((x) => x.id === g.id)
        const seated = g.state === 'waiting' || g.state === 'eating'
        if (!s && seated) {
          const taken = new Set(next.map((x) => x.seat))
          // (the shop may have given them a stool already)
          const seat = g.seat !== undefined && !taken.has(g.seat) ? g.seat : Array.from({ length: SEATS }, (_, i) => i).find((i) => !taken.has(i))
          if (seat !== undefined) next.push({ id: g.id, seat, phase: 'enter', t: 0 })
        } else if (s && !seated && s.phase !== 'leave') {
          clear(s.seat)
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
      const g = groups.current.get(s.id)
      if (!g) continue
      const seat = seatAt(s.seat)
      const door = doorAt(s.seat)
      const k = Math.min(1, s.t / WALK)
      const e = k * k * (3 - 2 * k)
      if (s.phase === 'enter') {
        g.position.lerpVectors(door, seat, e)
        g.rotation.y = k < 1 ? Math.atan2(-ALONG.x, -ALONG.z) : FACE_YAW
        if (k >= 1) {
          s.phase = 'sit'
          // a plate is set in front of them
          serve(s.seat)
        }
      } else if (s.phase === 'sit') {
        g.position.copy(seat)
        g.rotation.y = FACE_YAW
      } else {
        // a moment to get up, then off the way they came
        const k2 = Math.max(0, Math.min(1, (s.t - 0.8) / WALK))
        g.position.lerpVectors(seat, door, k2 * k2 * (3 - 2 * k2))
        g.rotation.y = s.t < 0.8 ? FACE_YAW : Math.atan2(ALONG.x, ALONG.z)
        if (k2 >= 1) done.push(s.id)
      }
    }
    if (done.length) setShown((cur) => cur.filter((x) => !done.includes(x.id)))
    done = []

    // the plates on the move: lifted off the stack in an arc to the seat, and cleared away to the dirty stack
    const step = Math.min(dt, 0.1)
    let finished = 0
    for (const r of runs.current) {
      r.t += step
      const o = runObjs.current.get(r.key)
      const to = r.phase === 'clear' ? dirtyAt(dirty.current + finished) : plateAt(r.seat)
      if (r.phase === 'set' || r.phase === 'clear' && r.t < 0) {
        o?.position.copy(r.phase === 'set' ? to : o.position)
        continue
      }
      if (r.phase === 'clear' && r.t >= 0 && r.t - step < 0 && o) r.from = o.position.clone()
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
    if (wash.current === null && dirty.current >= WASH_AT && !runs.current.some((r) => r.phase === 'clear' && r.t >= 0)) wash.current = 0
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
      {Array.from({ length: SEATS }, (_, n) => (
        <group key={n} position={seatAt(n)}><Stool /></group>
      ))}
      {/* the clean stack, the dirty one, and the plates out at the seats */}
      {clean.current.map((_, i) => (
        <group key={`c${i}`} ref={(o) => { cleanObjs.current[i] = o }} position={cleanAt(i)}><Plate /></group>
      ))}
      <group ref={dirtyStack}>
        {Array.from({ length: dirty.current }, (_, i) => (
          <group key={`d${i}`} position={dirtyAt(i)} rotation-y={i * 0.9}><Plate dirty /></group>
        ))}
      </group>
      {runs.current.map((r) => (
        <group key={r.key} ref={(o) => { if (o) runObjs.current.set(r.key, o); else runObjs.current.delete(r.key) }} position={r.from}>
          <Plate dirty={r.phase === 'clear'} />
        </group>
      ))}
      {people && shown.map((s) => {
        const g = guests.find((x) => x.id === s.id)
        const walking = s.phase !== 'sit'
        return (
          <group key={s.id} ref={(o) => { if (o) groups.current.set(s.id, o); else groups.current.delete(s.id) }}>
            <PersonClock s={s} eating={() => s.phase === 'sit' && guestsRef.current.find((x) => x.id === s.id)?.state === 'eating'} clock={clock} />
            <Html position={[0, 0.98, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
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
