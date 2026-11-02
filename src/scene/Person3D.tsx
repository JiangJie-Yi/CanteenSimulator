import * as THREE from 'three'
import type { GuestKind } from '@/data/guests'
import type { Pattern } from './patterns'

/*
 * What the people in the shop share (the customers, scene/FolkFigure; the staff, scene/StaffFigure; the owner, shops/grill/Boss): each
 * customer's colours by their id and kind (lookOf), the soft five-tone shading and the painter's airbrush over it, the id's hash, the
 * briefcase. (The chibi customers once drawn here, blender/guests.py's public/models/guests.glb on a shared rig, the URL's ?guests=old, are
 * gone: the owner's.)
 */

const INK = new THREE.Color('#3b2a20')
const SKIN = ['#f3d2b0', '#eac39c', '#d9a77e', '#f6dcc0', '#c99470']
const HAIR = ['#2b1d14', '#4a3020', '#1c1c22', '#7a5a3a', '#5a3a2a']
const pick = <T,>(l: T[], n: number) => l[n % l.length]

export type Look = { top: string; legs: string; hair: string; skin: string; shoes: string; size: number
  /** the cloth of what they wear on top, and on their legs (or skirt) */
  topCloth?: Pattern; legCloth?: Pattern }
/** the cook at the fire (the same rig as the customers, in his own clothes and his own action) */
type Kind = GuestKind | 'chef' | 'staffM' | 'staffF'
const CHEF_LOOK: Look = { top: '#2c3a58', legs: '#263049', hair: '#2b1d14', skin: '#e2b48c', shoes: '#2a2220', size: 1 }
export function lookOf(id: number, kind: Kind): Look {
  if (kind === 'chef' || kind === 'staffM' || kind === 'staffF') return CHEF_LOOK
  const old = kind === 'grandma' || kind === 'grandpa'
  const top: Record<GuestKind, string> = {
    salaryman: '#2b3444', officeLady: '#6a6f78', schoolgirl: '#f4f1ea', schoolboy: '#1c1e26', grandma: '#c9b48a',
    grandpa: '#7a5a3a', kid: pick(['#e85a4a', '#4a8ad8', '#f0c040'], id), uncle: pick(['#4a7a5a', '#a8432f', '#3d6a9a'], id),
    collegeStudent: pick(['#6d7f8c', '#8a4a3a', '#4a6a4a'], id), yukataLady: pick(['#3a5a8c', '#a84a6a', '#5a7a5a'], id),
    delinquent: pick(['#15161c', '#1c2440'], id), bosozoku: pick(['#f2efe8', '#4a2a5e', '#1a1a20'], id),
    foreignTourist: pick(['#e8d24a', '#4aa8d8', '#e86a4a', '#f2f0ea'], id), civilServant: pick(['#4a4e56', '#3a4250'], id), maidCoser: '#1c1c24',
    gyaru: pick(['#f06aa0', '#f2f0ea', '#1c1c22', '#f2c62a'], id),
  }
  return {
    top: top[kind],
    legs: kind === 'schoolgirl' ? '#23324a' : kind === 'officeLady' ? '#4a4f58' : kind === 'kid' ? '#2a4a7a'
      : kind === 'collegeStudent' ? '#3a4a6a' : kind === 'grandma' ? '#5a4a3e' : kind === 'yukataLady' || kind === 'bosozoku' ? top[kind]
        : kind === 'delinquent' ? '#15161c' : kind === 'foreignTourist' ? '#a8946a' : kind === 'civilServant' ? top[kind] : kind === 'maidCoser' ? '#1c1c24' : kind === 'gyaru' ? pick(['#2a2a32', '#3a5a8a', '#c43a6a'], id + 1) : '#2f2f36',
    // (the rough lot bleach it, or dye it red-brown, as often as not)
    hair: kind === 'gyaru' ? pick(['#f0d090', '#e8b860', '#c8884a', '#f2e2b8'], id) : kind === 'foreignTourist' ? pick(['#e8cc80', '#b07a40', '#c0602a', '#2b1d14'], id) : kind === 'maidCoser' ? pick(['#e88ab0', '#1c1c22', '#8a5a3a', '#e8cc80', '#a8c8e8'], id)
      : old ? '#d4d4d4' : kind === 'delinquent' || kind === 'bosozoku' ? pick(['#e2b85a', '#1c1c22', '#a8542a'], id) : pick(HAIR, id * 3),
    // (a visitor from abroad as like as not fairer, or darker, than anyone local)
    skin: kind === 'gyaru' ? pick(['#c99470', '#b8805a', '#d8a880'], id) : kind === 'foreignTourist' ? pick(['#f8e2d0', '#f6d8c4', '#8a5a3a', '#c99470'], id) : pick(SKIN, id * 7 + 1),
    shoes: kind === 'maidCoser' ? '#1a1a1a' : kind === 'gyaru' ? '#f2f0ea' : kind === 'collegeStudent' || kind === 'kid' || kind === 'foreignTourist' ? '#f2f0ea' : kind === 'yukataLady' ? '#b08a5a' : '#2a2220',
    size: kind === 'kid' ? 0.78 : kind === 'grandma' ? 0.93 : 1,
    topCloth: ({ salaryman: 'pinstripe', officeLady: 'glen', grandma: 'floret', grandpa: 'knit', kid: 'border', uncle: 'hibiscus',
      collegeStudent: 'plaid', yukataLady: 'asanoha' } as Partial<Record<GuestKind, Pattern>>)[kind],
    legCloth: ({ salaryman: 'pinstripe', officeLady: 'glen', yukataLady: 'asanoha' } as Partial<Record<GuestKind, Pattern>>)[kind],
  }
}

// (soft shading, as a hand-painted model's: five tones blended into one another rather than three hard bands)
export const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 158, 196, 230, 255]), 5, 1, THREE.RedFormat)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
})()
/**
 * A painter's airbrush over the figure, as on a hand-painted model: a shade darker toward the feet and lighter up to the head and shoulders
 * (by the model's own height, so it moves with them), and a soft pale rim where a surface turns away from the eye
 */
export function airbrush(m: THREE.MeshToonMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying float vHgt;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vHgt = position.y;`)
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vHgt;`).replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= mix(0.8, 1.07, smoothstep(0.0, 0.95, vHgt));`).replace('#include <opaque_fragment>', `float rimK = pow(1.0 - clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0);
outgoingLight += vec3(1.0, 0.95, 0.88) * rimK * 0.16;
#include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => 'airbrush'
  return m
}

/** a black leather briefcase hanging from its handle (the handle at the origin, the case below along +y) */
export function Briefcase() {
  return (
    <group>
      <mesh position-y={0.012} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.012, 0.003, 6, 12, Math.PI]} />
        <meshToonMaterial color="#1a1410" gradientMap={gradientMap} />
      </mesh>
      <mesh position-y={0.065}>
        <boxGeometry args={[0.028, 0.1, 0.14]} />
        <meshToonMaterial color="#2a1e16" gradientMap={gradientMap} />
      </mesh>
      <mesh position-y={0.065} scale={[1.15, 1.05, 1.04]}>
        <boxGeometry args={[0.028, 0.1, 0.14]} />
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
      {[-0.035, 0.035].map((z) => (
        <mesh key={z} position={[0, 0.024, z]}>
          <boxGeometry args={[0.031, 0.012, 0.014]} />
          <meshToonMaterial color="#c8b070" gradientMap={gradientMap} />
        </mesh>
      ))}
    </group>
  )
}

/** a number from 0 to 1 that's always the same for this id (and this salt), spread so neighbours differ */
export const hash = (id: number, salt: number) => {
  let h = Math.imul(id ^ Math.imul(salt + 1, 0x9e3779b1), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000
}
