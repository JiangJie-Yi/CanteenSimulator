import * as THREE from 'three'
import { kindOf, type GuestKind } from '@/data/guests'

/*
 * A customer in 3D, toon-shaded with an ink outline, built in code: a torso turned on a lathe (shoulders, chest,
 * waist), a neck, arms and legs in two parts each (bending at the elbow and the knee), hands and shoes; a face with
 * eyes (and their catch-lights), brows, nose, mouth and ears, a fringe over the forehead. What they're dressed in
 * says what they are (data/guests.ts): the office worker's white shirt and tie, the schoolgirl's sailor collar and
 * pleated skirt, the old man's glasses, the yukata's crossed collar and sash, the student's hood…
 *
 * The figure stands (or sits) at its group's origin, facing +Z: sitting, the hips are on a stool top at 0.34.
 */

const INK = '#3b2a20'
const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0', '#c99470']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#5a3a2a']
const pick = <T,>(l: T[], n: number) => l[n % l.length]

type Look = { top: string; legs: string; hair: string; skin: string; shoes: string; size: number; wide: number }
function lookOf(id: number, kind: GuestKind): Look {
  const old = kind === 'grandma' || kind === 'grandpa'
  const top: Record<GuestKind, string> = {
    salaryman: '#2b3444', officeLady: '#6a6f78', highSchoolGirl: '#f4f1ea', highSchoolBoy: '#1c1e26', grandma: '#c9b48a',
    grandpa: '#7a5a3a', kid: pick(['#e85a4a', '#4a8ad8', '#f0c040'], id), uncle: pick(['#4a7a5a', '#a8432f', '#3d6a9a'], id),
    student: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), yukata: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
  }
  return {
    top: top[kind],
    legs: kind === 'highSchoolGirl' ? '#23324a' : kind === 'officeLady' ? '#4a4f58' : kind === 'kid' ? '#2a4a7a'
      : kind === 'student' ? '#3a4a6a' : kind === 'yukata' ? top[kind] : '#2f2f36',
    hair: old ? '#d4d4d4' : pick(HAIR, id * 3),
    skin: pick(SKIN, id * 7 + 1),
    shoes: kind === 'student' || kind === 'kid' ? '#f2f0ea' : kind === 'yukata' ? '#b08a5a' : '#2a2220',
    size: kind === 'kid' ? 0.72 : kind === 'grandma' ? 0.9 : 1,
    wide: kind === 'uncle' ? 1.2 : kind === 'grandpa' ? 1.04 : kind === 'highSchoolGirl' || kind === 'officeLady' || kind === 'yukata' ? 0.9 : 1,
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
/** an unshaded detail (eyes, brows, mouth…) */
const Flat = ({ geo, color, ...rest }: { geo: THREE.BufferGeometry; color: string } & Record<string, unknown>) => (
  <mesh geometry={geo} {...rest}><meshBasicMaterial color={color} /></mesh>
)

// the torso's outline, hips (y 0) to the base of the neck: hips, a waist, the chest, square shoulders
const TORSO_PROFILE = [[0, -0.005], [0.096, 0], [0.11, 0.015], [0.113, 0.04], [0.106, 0.08], [0.099, 0.12], [0.103, 0.17],
  [0.113, 0.22], [0.122, 0.26], [0.127, 0.29], [0.124, 0.315], [0.11, 0.337], [0.085, 0.355], [0.055, 0.366], [0.03, 0.371],
  [0, 0.373]].map(([x, y]) => new THREE.Vector2(x, y))

const GEO = {
  torso: new THREE.LatheGeometry(TORSO_PROFILE, 40),
  belly: new THREE.SphereGeometry(0.1, 16, 12),
  neck: new THREE.CylinderGeometry(0.034, 0.038, 0.07, 12),
  upperArm: new THREE.CapsuleGeometry(0.034, 0.1, 8, 16),
  foreArm: new THREE.CapsuleGeometry(0.03, 0.09, 8, 16),
  // the shoulder's round, where the sleeve turns down from the torso
  shoulder: new THREE.SphereGeometry(0.042, 16, 12),
  hand: new THREE.SphereGeometry(0.03, 16, 12),
  thumb: new THREE.CapsuleGeometry(0.009, 0.022, 4, 8),
  cuff: new THREE.TorusGeometry(0.03, 0.006, 6, 18),
  thigh: new THREE.CapsuleGeometry(0.048, 0.14, 8, 16),
  shin: new THREE.CapsuleGeometry(0.04, 0.15, 8, 16),
  shoe: new THREE.SphereGeometry(0.045, 16, 10),
  collar: new THREE.TorusGeometry(0.045, 0.01, 8, 24),
  skirt: new THREE.CylinderGeometry(0.115, 0.16, 0.13, 18, 1, true),
  head: new THREE.SphereGeometry(0.105, 28, 20),
  ear: new THREE.SphereGeometry(0.022, 10, 8),
  hair: new THREE.SphereGeometry(0.112, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
  fringe: new THREE.SphereGeometry(0.113, 24, 8, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.22, Math.PI * 0.16),
  bun: new THREE.SphereGeometry(0.045, 12, 8),
  cap: new THREE.SphereGeometry(0.118, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  brim: new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16, 1, false, -Math.PI / 2, Math.PI),
  eye: new THREE.SphereGeometry(0.014, 10, 8),
  glint: new THREE.SphereGeometry(0.0045, 6, 4),
  brow: new THREE.BoxGeometry(0.032, 0.006, 0.006),
  nose: new THREE.SphereGeometry(0.013, 8, 6),
  mouth: new THREE.TorusGeometry(0.018, 0.0035, 4, 12, Math.PI),
  blush: new THREE.CircleGeometry(0.016, 12),
  lens: new THREE.TorusGeometry(0.022, 0.0032, 6, 18),
  bridge: new THREE.BoxGeometry(0.022, 0.003, 0.003),
  tie: new THREE.BoxGeometry(0.026, 0.13, 0.008),
  shirt: new THREE.BoxGeometry(0.06, 0.1, 0.006),
  ribbon: new THREE.BoxGeometry(0.05, 0.022, 0.012),
  sailor: new THREE.BoxGeometry(0.2, 0.012, 0.13),
  lapel: new THREE.BoxGeometry(0.022, 0.15, 0.008),
  button: new THREE.SphereGeometry(0.008, 6, 4),
  sash: new THREE.CylinderGeometry(0.106, 0.106, 0.05, 18, 1, true),
  hood: new THREE.TorusGeometry(0.075, 0.025, 8, 16, Math.PI),
  bag: new THREE.BoxGeometry(0.12, 0.14, 0.06),
  bowl: new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
  stick: new THREE.CylinderGeometry(0.004, 0.003, 0.2, 5),
}

const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k) }

/**
 * How a customer moves while eating, over one bite (about three seconds): the skewer comes up to the mouth, the
 * head dips to meet it and bites, the arm goes down again while they chew, and a moment's rest looking at the
 * plate before the next. While waiting they look about now and then, and sway a little.
 */
function eatingPose(t: number, id: number) {
  const p = ((t + id * 0.73) % 3.2) / 3.2
  const lift = smooth(0, 0.28, p) * (1 - smooth(0.45, 0.68, p))
  const bite = smooth(0.26, 0.34, p) * (1 - smooth(0.36, 0.46, p))
  const chewing = p > 0.4 && p < 0.9
  return {
    shoulder: 0.7 + lift * 0.6,
    elbow: 0.92 + lift * 1.3,
    head: 0.08 + bite * 0.22 + (chewing ? Math.sin(t * 13) * 0.025 : 0),
    mouth: bite > 0.2 ? 1.6 : chewing ? 0.7 + 0.5 * Math.abs(Math.sin(t * 13)) : 0.8,
    lean: 0.18 + bite * 0.1,
  }
}

/** one customer, sitting on their stool (or walking), eating or waiting; t is their own clock (seconds) */
export function Person({ id, eating, walking, t }: { id: number; eating: boolean; walking: boolean; t: number }) {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const bald = kind === 'grandpa' || kind === 'uncle'
  const longHair = kind === 'highSchoolGirl' || kind === 'officeLady' || kind === 'yukata'
  const skirt = kind === 'highSchoolGirl' || kind === 'officeLady'
  const glasses = kind === 'grandpa' || (kind === 'salaryman' && id % 3 === 0) || (kind === 'student' && id % 2 === 0)
  const blush = kind === 'kid' || kind === 'highSchoolGirl' || kind === 'yukata'
  // sitting: hips on the stool top (0.34); walking: standing, the legs straight under them
  const hipY = walking ? 0.42 : 0.36
  const pose = eating ? eatingPose(t, id) : null
  const bob = walking ? Math.abs(Math.sin(t * 9)) * 0.02 : Math.sin(t * 1.6) * 0.004
  const lean = pose ? pose.lean : 0.05 + Math.sin(t * 0.8 + id) * 0.015
  // waiting, they glance about every so often (to the door, along the bar, at the fire)
  const look = !eating && !walking ? Math.sin(t * 0.45 + id * 1.7) * 0.5 * smooth(0.55, 0.85, Math.abs(Math.sin(t * 0.21 + id))) : 0
  const step = walking ? Math.sin(t * 9) * 0.5 : 0
  // a blink now and then
  const blink = (t * 0.9 + id * 0.37) % 4 < 0.12 ? 0.15 : 1
  const shinColor = skirt ? l.skin : l.legs
  return (
    <group scale={l.size}>
      {/* legs: thigh and shin, bent at the knee over the stool, or swinging as they walk; shoes at the end */}
      {[-1, 1].map((sd) => {
        const swing = walking ? sd * step : -1.5
        const knee = walking ? Math.max(0, -sd * step) * 0.9 : 1.5
        return (
          <group key={sd} position={[sd * 0.055 * l.wide, hipY, 0]} rotation-x={swing}>
            <Part geo={GEO.thigh} color={skirt ? l.skin : l.legs} position={[0, -0.1, 0]} />
            <group position-y={-0.2} rotation-x={knee}>
              <Part geo={GEO.shin} color={shinColor} position={[0, -0.1, 0]} />
              {kind === 'highSchoolGirl' && <Part geo={GEO.shin} color="#f4f1ea" outline={0} position={[0, -0.16, 0]} scale={[1.08, 0.35, 1.08]} />}
              <Part geo={GEO.shoe} color={l.shoes} position={[0, -0.215, 0.025]} scale={[0.9, 0.55, 1.5]} />
            </group>
          </group>
        )
      })}
      <group position-y={hipY + bob} rotation-x={lean}>
        {skirt && <Part geo={GEO.skirt} color={l.legs} outline={1.03} position={[0, 0.0, 0.02]} scale={[1, 1, 1.05]} rotation-x={walking ? 0 : -0.25} />}
        <Part geo={GEO.torso} color={l.top} outline={1.04} scale={[l.wide, 1, 0.78]} />
        {kind === 'uncle' && <Part geo={GEO.belly} color={l.top} outline={1.04} position={[0, 0.1, 0.03]} scale={[1.08, 0.95, 0.85]} />}
        {/* what marks each kind of customer */}
        {kind === 'salaryman' && (
          <>
            <Flat geo={GEO.shirt} color="#f4f2ec" position={[0, 0.29, 0.088]} rotation-x={-0.25} />
            <Flat geo={GEO.tie} color="#a8322a" position={[0, 0.24, 0.093]} rotation-x={-0.12} />
            {[-1, 1].map((sd) => <Flat key={sd} geo={GEO.lapel} color="#1e2532" position={[sd * 0.035, 0.27, 0.09]} rotation={[-0.2, 0, sd * 0.35]} />)}
            {[0.14, 0.09].map((y) => <Flat key={y} geo={GEO.button} color="#141820" position={[0.012, y, 0.084]} />)}
          </>
        )}
        {kind === 'officeLady' && (
          <>
            <Flat geo={GEO.shirt} color="#f4f2ec" position={[0, 0.3, 0.084]} rotation-x={-0.3} scale={[1.2, 0.8, 1]} />
            {[0.22, 0.16, 0.1].map((y) => <Flat key={y} geo={GEO.button} color="#e8e4da" position={[0, y, 0.082]} />)}
          </>
        )}
        {kind === 'highSchoolGirl' && (
          <>
            <Part geo={GEO.sailor} color="#23324a" outline={0} position={[0, 0.35, -0.035]} rotation-x={0.35} />
            {[-1, 1].map((sd) => <Flat key={sd} geo={GEO.lapel} color="#23324a" position={[sd * 0.04, 0.29, 0.088]} rotation={[-0.25, 0, sd * 0.5]} />)}
            <Flat geo={GEO.ribbon} color="#c4302a" position={[0, 0.255, 0.096]} />
          </>
        )}
        {kind === 'highSchoolBoy' && (
          <>
            <Part geo={GEO.neck} color="#0e0f14" outline={0} position={[0, 0.37, 0]} scale={[1.25, 0.7, 1.25]} />
            {[0.27, 0.2, 0.13, 0.06].map((y) => <Flat key={y} geo={GEO.button} color="#d4b04a" position={[0, y, 0.088]} />)}
          </>
        )}
        {kind === 'grandma' && [0.25, 0.18, 0.11].map((y) => <Flat key={y} geo={GEO.button} color="#7a5a3a" position={[0, y, 0.084]} />)}
        {kind === 'grandpa' && <Flat geo={GEO.shirt} color="#e8e0cc" position={[0, 0.3, 0.084]} rotation-x={-0.3} />}
        {kind === 'yukata' && (
          <>
            <Part geo={GEO.sash} color="#e8c45a" outline={0} position={[0, 0.13, 0]} scale={[l.wide * 1.02, 1, 0.8]} />
            {[-1, 1].map((sd) => <Flat key={sd} geo={GEO.lapel} color="#f4efe2" position={[sd * 0.025, 0.275, 0.088]} rotation={[-0.2, 0, -sd * 0.55]} />)}
          </>
        )}
        {kind === 'student' && <Part geo={GEO.hood} color={l.top} outline={0} position={[0, 0.355, -0.045]} rotation={[-0.4, 0, 0]} />}
        {kind === 'kid' && <Part geo={GEO.bag} color="#c4302a" position={[0, 0.2, -0.11]} />}
        {/* arms: upper arm and forearm, reaching onto the bar; the right one working the chopsticks while eating */}
        {[-1, 1].map((sd) => {
          // (the right hand holds the skewer and brings it up to bite; the left rests on the bar)
          const shoulder = walking ? -sd * step * 0.6 : pose && sd > 0 ? pose.shoulder : 0.7
          const elbow = walking ? 0.25 : pose && sd > 0 ? pose.elbow : 0.92
          return (
            <group key={sd} position={[sd * 0.128 * l.wide, 0.3, 0]} rotation={[-shoulder, 0, sd * 0.12]}>
              <Part geo={GEO.shoulder} color={l.top} outline={1.04} position={[0, -0.01, 0]} scale={[1, 0.9, 1]} />
              <Part geo={GEO.upperArm} color={l.top} position={[0, -0.07, 0]} />
              <group position-y={-0.15} rotation-x={-elbow}>
                <Part geo={GEO.foreArm} color={l.top} position={[0, -0.065, 0]} />
                {/* the cuff of the sleeve, then a hand with its thumb */}
                <mesh geometry={GEO.cuff} position={[0, -0.112, 0]} rotation-x={Math.PI / 2}><meshToonMaterial color={l.top} /></mesh>
                <Part geo={GEO.hand} color={l.skin} position={[0, -0.14, 0]} scale={[0.9, 1.1, 0.75]} />
                <Part geo={GEO.thumb} color={l.skin} outline={0} position={[-sd * 0.022, -0.132, 0.012]} rotation={[0.3, 0, sd * 0.6]} />
                {pose && sd > 0 && (
                  // the skewer in the hand, pointing up out of the fist, a bit of food on the end
                  <group position={[0, -0.15, 0.02]} rotation-x={-1.1}>
                    <mesh geometry={GEO.stick} position-y={0.08}><meshToonMaterial color="#c9a46a" /></mesh>
                    <mesh position-y={0.15}>
                      <boxGeometry args={[0.03, 0.05, 0.025]} />
                      <meshToonMaterial color="#c8743a" />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          )
        })}
        <Part geo={GEO.neck} color={l.skin} outline={0} position={[0, 0.39, 0]} />
        {/* a collar round the base of the neck, in the colour of what they wear */}
        {kind !== 'yukata' && kind !== 'highSchoolGirl' && (
          <mesh geometry={GEO.collar} position={[0, 0.367, 0.004]} rotation-x={Math.PI / 2 - 0.15} scale={[l.wide, 1, 0.9]}>
            <meshToonMaterial color={kind === 'salaryman' || kind === 'officeLady' || kind === 'grandpa' ? '#f4f2ec' : l.top} />
          </mesh>
        )}
        {/* the head */}
        <group position-y={0.48} rotation={[pose ? pose.head : Math.sin(t * 0.7 + id) * 0.04, look, 0]}>
          <Part geo={GEO.head} color={l.skin} scale={[1, 1.05, 0.97]} />
          {[-1, 1].map((sd) => <Part key={sd} geo={GEO.ear} color={l.skin} outline={1.1} position={[sd * 0.103, -0.005, 0]} scale={[0.5, 1, 0.8]} />)}
          {!bald && (
            <>
              <Part geo={GEO.hair} color={l.hair} outline={1.03} position={[0, 0.014, -0.008]} rotation-x={-0.25} />
              <Part geo={GEO.fringe} color={l.hair} outline={0} position={[0, 0.006, 0.004]} />
            </>
          )}
          {bald && <Part geo={GEO.hair} color={l.hair} outline={0} position={[0, -0.02, -0.03]} rotation-x={-1.2} scale={[1.02, 0.6, 1]} />}
          {longHair && (
            // long hair falling down the back of the head to the shoulders (behind it: from the front only its sides show)
            <Part geo={GEO.head} color={l.hair} outline={1.03} position={[0, -0.07, -0.05]}
              scale={[1.08, kind === 'highSchoolGirl' ? 1.45 : 1.2, 0.62]} />
          )}
          {(kind === 'grandma' || kind === 'yukata') && <Part geo={GEO.bun} color={l.hair} position={[0, 0.1, -0.06]} />}
          {kind === 'kid' && (
            <>
              <Part geo={GEO.cap} color="#f2c62a" position={[0, 0.01, 0]} />
              <Part geo={GEO.brim} color="#f2c62a" outline={0} position={[0, 0.02, 0.09]} />
            </>
          )}
          {/* the face */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 0.036, 0.002, 0.093]}>
              <Flat geo={GEO.eye} color="#2a1d16" scale={[1, blink * 1.15, 0.7]} />
              {blink === 1 && <Flat geo={GEO.glint} color="#ffffff" position={[0.004, 0.005, 0.009]} />}
              <Flat geo={GEO.brow} color={bald ? '#bdb6aa' : l.hair} position={[0, 0.034, -0.004]} rotation-z={sd * -0.12} />
              {blush && (
                <mesh geometry={GEO.blush} position={[sd * 0.016, -0.028, -0.002]} rotation-y={sd * 0.4}>
                  <meshBasicMaterial color="#f08a7a" transparent opacity={0.45} depthWrite={false} />
                </mesh>
              )}
            </group>
          ))}
          <Part geo={GEO.nose} color={l.skin} outline={0} position={[0, -0.014, 0.1]} scale={[0.9, 1, 0.8]} />
          <Flat geo={GEO.mouth} color="#8a3a2a" position={[0, -0.04, 0.091]} rotation-z={pose ? 0 : Math.PI} scale={pose ? [0.8, pose.mouth, 1] : 1} />
          {kind === 'uncle' && (
            <mesh position={[0, -0.028, 0.096]}>
              <boxGeometry args={[0.05, 0.01, 0.008]} />
              <meshBasicMaterial color="#3a2a1e" />
            </mesh>
          )}
          {glasses && (
            <group position={[0, 0.003, 0.1]}>
              {[-1, 1].map((sd) => <Flat key={sd} geo={GEO.lens} color="#2a2220" position={[sd * 0.036, 0, 0]} />)}
              <Flat geo={GEO.bridge} color="#2a2220" />
            </group>
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
