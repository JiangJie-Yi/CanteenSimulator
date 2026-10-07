import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playChew } from '../chew'
import { Steam } from './Steam'
import { ROAST_STAGES, type Roast, type Seasoning } from '../menu'

/** GLTFLoader strips the dot from Blender's "Fish.001", so drop trailing digits to get the type. */
const baseName = (name: string) => name.replace(/\d+$/, '')

// colour multipliers over the (grilled-looking) textures: pale when raw, as authored when done, charred when burnt
const RAW_TINT = new THREE.Color(1.3, 1.28, 1.25)
const DONE_TINT = new THREE.Color(1, 1, 1)
const BURNT_TINT = new THREE.Color(0.22, 0.17, 0.14)
// past done, food keeps darkening slowly, reaching full char at this many cook-times
const CHAR_START = 1.15
const CHAR_FULL = 3
const HOVER_GLOW = new THREE.Color('#ffb347').multiplyScalar(0.35)
const FLIGHT_SECONDS = 0.7
// the plate: everything is laid pointing the same way (LAY_DIR), side by side across the plate (STACK_DIR) with
// enough room that neighbours don't overlap, then in a second layer on top
// LAY_DIR points at the camera and STACK_DIR runs across the screen, so the row reads left to right
const LAY_DIR = new THREE.Vector3(0.59, 0, 0.81).normalize()
const STACK_DIR = new THREE.Vector3(0.81, 0, -0.59).normalize()
const PLATE_R = 0.62
const SLOT_GAP = 0.2       // wider than the broadest piece (a fish lying flat)
const PER_LAYER = 5
/** a plate takes 20 (four layers of five); the next one is set down behind it */
const PER_PLATE = 20
/**
 * How far to brighten each charcoal material once it has burnt to ash. Its colour multiplies a very dark
 * texture, so scaling the colour up turns the black into a mottled pale grey while keeping the ridges and cracks.
 */
const ASH_GAIN: Record<string, number> = { Ember: 45, Binchotan: 18 }
const ASH_TINT = new THREE.Color('#d8d2c8')
const PLATE_STEP = 1.45
/** seconds to eat one piece: a few bites, each taking a chunk out and chewed before the next */
const EAT_SECONDS = 3
const BITES_PER_PIECE = 4
const UP = new THREE.Vector3(0, 1, 0)
const ZERO = new THREE.Vector3()
/** the pinching hand is drawn a little above the pinch of salt it holds */
const HAND_OFFSET = new THREE.Vector3(0, 0.07, 0)
/** the bin for bare sticks and burnt food */
const BIN_R = 0.24
const BIN_H = 0.36
/** the seasoning box, as a round footprint for bumping into things */
const BOX_R = 0.46
/** the stone ring's outer edge: nothing can be pushed into the fire */
const RING_CLEAR = 1.15

/** A small wooden bucket for the scraps, open at the top, with a dark inside. */
function Bin({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    const R = BIN_R
    // outside wall flaring a little toward the rim, a rolled lip, then the inside back down to a raised floor
    return new THREE.LatheGeometry([[0, 0.01], [R * 0.84, 0.01], [R * 0.86, 0.02], [R, BIN_H], [R * 1.04, BIN_H + 0.012],
      [R * 0.94, BIN_H + 0.004], [R * 0.82, 0.05], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 40)
  }, [])
  const staves = useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 16
    const g = c.getContext('2d')!
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#8a6038' : '#9a6c40'
      g.fillRect(i * 16, 0, 16, 16)
      g.fillStyle = 'rgba(40, 24, 10, 0.6)'
      g.fillRect(i * 16, 0, 1.5, 16)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(2, 1)
    return t
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={staves} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.02, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      {/* two iron hoops round the staves */}
      {[0.08, 0.27].map((y) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[BIN_R * (0.86 + 0.14 * (y / BIN_H)) + 0.004, 0.008, 6, 40]} />
          <meshToonMaterial color="#3c3c40" />
        </mesh>
      ))}
    </group>
  )
}

/** A pinching hand (for taking salt), drawn over the 3D view while salt is carried. */
function PinchHand() {
  return (
    <svg className="pinch-hand" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M22 60c-6-6-10-14-9-22 1-5 3-8 6-9l1-14c0-3 5-3 5 0v12l1-16c0-3 5-3 5 0v15l1-12c0-3 5-3 5 0v13l1-8c0-3 5-3 5 0v14c0 8-3 14-7 19-3 4-4 6-4 8z"
        fill="#f3d2b0" stroke="#3b2a20" strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 29c-4 1-8 4-8 8 0 3 3 4 6 2l5-4" fill="#f3d2b0" stroke="#3b2a20" strokeWidth="2"
        strokeLinejoin="round" />
      <circle cx="24" cy="46" r="1.2" fill="#fff" />
      <circle cx="27" cy="50" r="1" fill="#fff" />
    </svg>
  )
}

/** the little side dishes for onigiri and mochi from the grill net */
const DISH_R = 0.3
const DISH_STEP = 0.7
/** the bamboo basket the foil-roasted potatoes are served in */
const BASKET_R = 0.48
/** the basket's inner floor as y = BOWL_CURVE * r², fitted to its lathe profile */
const BOWL_CURVE = 0.45
const BASKET_STEP = 0.85
/** grains and drops falling from a seasoning while it's held over food */
const GRAINS = 360
const GRAIN_COLORS: Record<Seasoning, THREE.Color> = {
  salt: new THREE.Color('#ffffff'),
  soy: new THREE.Color('#3a1a08'),
  milk: new THREE.Color('#fbf3dc'),
  peanut: new THREE.Color('#c99a5c'),
}
/** how much one dab of each seasoning adds (0 → 1 fully coated) */
const DAB = 0.35
/** label over a seasoning when pointed at */
const TOOL_NAMES: Record<Seasoning, string> = { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉' }
// skewer geometry from blender/grilledfish.py: foot radius, tip radius, tip height
const STICK_FOOT_R = 0.8
const STICK_TOP_R = 0.3
const STICK_TOP_Y = 1.15
const LAYER_HEIGHT = 0.1
const CHAR_COLOR = new THREE.Color(0.045, 0.035, 0.03)

/** A woven bamboo (ざる) texture: strips over and under in a twill, pale and honey-coloured. */
const weaveTexture = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const cell = 16
  // gaps between the strips show dark
  g.fillStyle = '#5a3d1c'
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const over = (i + j) % 4 < 2
      // broad, slightly uneven strips with a gap either side; the one on top is lighter, with a sheen and grain
      g.fillStyle = over ? '#d9b779' : '#b38a4d'
      if (over) g.fillRect(i * cell, j * cell + 2, cell, cell - 4)
      else g.fillRect(i * cell + 2, j * cell, cell - 4, cell)
      g.fillStyle = 'rgba(255, 240, 200, 0.3)'
      if (over) g.fillRect(i * cell, j * cell + 5, cell, 2)
      else g.fillRect(i * cell + 5, j * cell, 2, cell)
      g.fillStyle = 'rgba(90, 60, 25, 0.35)'
      if (over) g.fillRect(i * cell, j * cell + 10, cell, 1)
      else g.fillRect(i * cell + 10, j * cell, 1, cell)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  // mapped straight down onto the bowl (see Basket), so the strips run in two straight crossing directions
  // right across it, the way a woven zaru is made, instead of pinching into the centre. Few, broad strips:
  // a coarse, rustic weave
  t.repeat.set(3.2, 3.2)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/**
 * Painted ware: a top-down picture for a plate or dish, in indigo on cream — a rim band, and a motif in the
 * well: a stand of bamboo with its leaves (竹), or sprays of plum blossom (梅).
 */
function wareTexture(motif: 'bamboo' | 'plum') {
  if (typeof document === 'undefined') return null
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const ink = '#2c4c8c'
  g.fillStyle = '#f2ece0'
  g.fillRect(0, 0, S, S)
  // rim bands
  g.strokeStyle = ink
  g.lineWidth = 10
  g.beginPath()
  g.arc(S / 2, S / 2, S * 0.455, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3
  g.beginPath()
  g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = ink
  g.strokeStyle = ink
  g.lineCap = 'round'
  if (motif === 'bamboo') {
    // two leaning stalks with their joints, and leaves in pointed strokes
    for (const [x0, lean, h] of [[0.42, 0.06, 0.5], [0.56, -0.04, 0.42]]) {
      const bx = S * x0
      const by = S * 0.78
      const tx = bx + S * lean
      const ty = by - S * h
      g.lineWidth = 9
      g.beginPath()
      g.moveTo(bx, by)
      g.lineTo(tx, ty)
      g.stroke()
      for (let k = 1; k < 4; k++) {
        const t = k / 4
        const jx = bx + (tx - bx) * t
        const jy = by + (ty - by) * t
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(jx - 9, jy)
        g.lineTo(jx + 9, jy)
        g.stroke()
        for (const dir of [-1, 1]) {
          g.save()
          g.translate(jx, jy)
          g.rotate(dir * (0.7 + k * 0.15))
          g.beginPath()
          g.ellipse(dir * 30, 0, 32, 7, 0, 0, Math.PI * 2)
          g.fill()
          g.restore()
        }
      }
    }
  } else {
    // a branch with five-petalled plum blossoms, buds, and dotted centres
    g.lineWidth = 7
    g.beginPath()
    g.moveTo(S * 0.25, S * 0.72)
    g.quadraticCurveTo(S * 0.45, S * 0.5, S * 0.74, S * 0.36)
    g.stroke()
    const blossom = (x: number, y: number, r: number) => {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.beginPath()
        g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#f2ece0'
      g.beginPath()
      g.arc(x, y, r * 0.25, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = ink
    }
    blossom(S * 0.42, S * 0.56, 34)
    blossom(S * 0.62, S * 0.42, 28)
    blossom(S * 0.33, S * 0.38, 24)
    for (const [x, y] of [[0.52, 0.5], [0.72, 0.34], [0.28, 0.66]]) {
      g.beginPath()
      g.arc(S * x, S * y, 8, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const BAMBOO_WARE = wareTexture('bamboo')
const PLUM_WARE = wareTexture('plum')

/** Lathe geometry for ware, with UVs projected straight down so a painted picture lies flat in the well. */
function wareGeometry(profile: [number, number][], R: number) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, 0.5 - pos.getZ(i) / (2 * R))
  uv.needsUpdate = true
  return g
}

/** A small round side dish (小皿) for onigiri and mochi, painted with plum blossom, inked. */
function SideDish({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    const R = DISH_R
    return wareGeometry([[0, 0], [R * 0.55, 0], [R * 0.62, 0.012], [R * 0.85, 0.03], [R, 0.05], [R * 0.97, 0.056],
      [R * 0.82, 0.038], [R * 0.55, 0.018], [0, 0.018]], R)
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={PLUM_WARE} />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/** Shallow woven bamboo basket with a rolled rim, inked like everything else. */
function Basket({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    const R = BASKET_R
    const profile = [[0, 0.01], [R * 0.55, 0.012], [R * 0.82, 0.04], [R * 0.97, 0.1], [R * 1.02, 0.13], [R * 0.99, 0.145],
      [R * 0.93, 0.12], [R * 0.78, 0.055], [R * 0.5, 0.028], [0, 0.026]].map(([x, y]) => new THREE.Vector2(x, y))
    const g = new THREE.LatheGeometry(profile, 64)
    // top-down UVs: the weave lies across the bowl in straight lines
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getZ(i) / (2 * R) + 0.5)
    uv.needsUpdate = true
    // shade the inside: the rim throws a soft shadow down into the bowl, deepest low against the wall
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const j = i % profile.length
      const inner = j >= 6
      const r = Math.hypot(pos.getX(i), pos.getZ(i)) / R
      const k = inner ? 0.55 + 0.25 * (1 - r) + 0.25 * THREE.MathUtils.smoothstep(pos.getY(i), 0.03, 0.12) : 1
      col.set([k, k * 0.97, k * 0.92], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={weaveTexture} side={THREE.DoubleSide} vertexColors />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

type Uniform = { value: number }
/** per-piece look: how charred it is, and how much of each seasoning is on it (all 0 → 1) */
type Looks = { uChar: Uniform; uSalt: Uniform; uSoy: Uniform; uMilk: Uniform; uPeanut: Uniform }

/**
 * Burn patches for over-roasted food: a value-noise mask over the texture that grows as uChar goes 0 → 1, so the
 * food blackens in spots first and ends up fully charred. Seasonings show on top: salt and peanut powder as
 * specks, soy as a dark lacquer over everything, condensed milk in wavy drizzled ribbons.
 */
function addCharring(mat: THREE.MeshToonMaterial, looks: Looks, bites: Bites) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, looks, bites)
    shader.uniforms.uCharColor = { value: CHAR_COLOR }
    shader.vertexShader = BITE_VERTEX(shader.vertexShader)
    shader.fragmentShader = BITE_FRAGMENT(shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uChar;
        uniform float uSalt;
        uniform float uSoy;
        uniform float uMilk;
        uniform float uPeanut;
        uniform vec3 uCharColor;
        float charHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float charNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(charHash(i), charHash(i + vec2(1, 0)), f.x),
                     mix(charHash(i + vec2(0, 1)), charHash(i + vec2(1, 1)), f.x), f.y);
        }`)
      .replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        #ifdef USE_MAP
          float charN = charNoise(vMapUv * 9.0) * 0.65 + charNoise(vMapUv * 23.0) * 0.35;
        #else
          float charN = 0.5;
        #endif
        float charMask = smoothstep(1.0 - uChar * 1.15, 1.0 - uChar * 1.15 + 0.2, charN);
        diffuseColor.rgb = mix(diffuseColor.rgb, uCharColor, charMask);
        // soy brushed on: a dark, rich lacquer over the whole surface
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.3, 0.15) + vec3(0.05, 0.02, 0.0), uSoy * 0.85);
        #ifdef USE_MAP
          // coarse salt stuck to the surface: scattered white grains, more of them with every pinch
          float saltN = charHash(floor(vMapUv * vec2(150.0, 90.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.98), step(1.0 - uSalt * 0.3, saltN));
          // peanut powder: fine tan dust settled in specks
          float nutN = charHash(floor(vMapUv * vec2(110.0, 70.0)) + 17.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.67, 0.4), step(1.0 - uPeanut * 0.55, nutN));
          // condensed milk drizzled across in thin wavy ribbons, more of them the more is poured
          float ribbon = abs(fract(vMapUv.x * (4.0 + 4.0 * step(0.5, uMilk)) + sin(vMapUv.y * 9.0) * 0.25) - 0.5);
          float milk = (1.0 - smoothstep(0.04, 0.08, ribbon)) * step(0.3, charNoise(vMapUv * 5.0 + 3.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.99, 0.95, 0.84), milk * min(1.0, uMilk * 2.0));
        #endif`))
  }
  mat.customProgramCacheKey = () => 'charring'
}

/**
 * Bites taken out of food: up to MAX_BITES balls (centre + radius, in the piece's own space) where nothing is
 * drawn, their edges wobbled like tooth marks. Shared by a piece's materials and its ink outlines.
 */
const MAX_BITES = 6
type Bites = { uBites: { value: THREE.Vector4[] }; uBiteCount: { value: number } }
const newBites = (): Bites => ({
  uBites: { value: Array.from({ length: MAX_BITES }, () => new THREE.Vector4()) },
  uBiteCount: { value: 0 },
})
const BITE_VERTEX = (src: string) => 'varying vec3 vBitePos;\n' + src.replace('#include <begin_vertex>',
  '#include <begin_vertex>\n  vBitePos = transformed;')
const BITE_FRAGMENT = (src: string) => /* glsl */ `varying vec3 vBitePos;
  uniform vec4 uBites[${MAX_BITES}];
  uniform int uBiteCount;
` + src.replace(/void main\(\)\s*\{/, /* glsl */ `void main() {
  for (int i = 0; i < ${MAX_BITES}; i++) {
    if (i >= uBiteCount) break;
    vec3 d = vBitePos - uBites[i].xyz;
    float teeth = 0.86 + 0.14 * sin(atan(d.y, d.x) * 9.0 + float(i) * 2.3) * sin(atan(d.z, d.x) * 7.0);
    if (length(d) < uBites[i].w * teeth) discard;
  }`)

/** Let an ink outline (a ShaderMaterial from Dish) show the same bites as its food. */
function biteOutline(outline: THREE.Mesh, bites: Bites) {
  const mat = outline.material as THREE.ShaderMaterial
  if (!mat.vertexShader.includes('vBitePos')) {
    mat.vertexShader = BITE_VERTEX(mat.vertexShader)
    mat.fragmentShader = BITE_FRAGMENT(mat.fragmentShader)
    mat.needsUpdate = true
  }
  mat.uniforms.uBites = bites.uBites
  mat.uniforms.uBiteCount = bites.uBiteCount
}

/** A small repeatable random generator, so a piece always gets the same crumple. */
function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Crush a foil mesh a little differently: its own copy of the geometry, pushed in and out in random folds. */
function crumpleFoil(mesh: THREE.Mesh, rand: () => number) {
  const g = mesh.geometry.clone()
  const pos = g.attributes.position as THREE.BufferAttribute
  const f = Array.from({ length: 3 }, () => [3 + rand() * 6, rand() * 6.3])
  const amp = 0.03 + rand() * 0.06
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const fold = Math.sin(f[0][0] * v.x + f[0][1]) * Math.sin(f[1][0] * v.y + f[1][1]) * Math.sin(f[2][0] * v.z + f[2][1])
    v.multiplyScalar(1 + amp * fold)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  mesh.geometry = g
  for (const c of mesh.children) if (c instanceof THREE.Mesh && c.name.endsWith('_outline')) c.geometry = g
}

type Piece = {
  key: string
  id: string
  copy: number
  loose: boolean
  node: THREE.Object3D
  homeP: THREE.Vector3
  homeQ: THREE.Quaternion
  /** seconds spent over the fire */
  progress: number
  collected: boolean
  /** 0..1 along the flight to the plate */
  flight: number
  fromP: THREE.Vector3
  fromQ: THREE.Quaternion
  toP: THREE.Vector3
  toQ: THREE.Quaternion
  mats: { mat: THREE.MeshToonMaterial; mesh: THREE.Mesh; base: THREE.Color; emissive: THREE.Color; foil: boolean;
    show?: 'closed' | 'open' }[]
  /** in the basket: a simple rigid ball that falls in, rolls and settles against the others */
  body: { v: THREE.Vector3; r: number; live: boolean } | null
  /** how charred and how seasoned it is, shared by all of this piece's materials */
  looks: Looks
  /** the bites taken out of it so far */
  bites: Bites
  /** the bamboo skewer, and the food on it: eating takes the food and leaves the stick on the plate */
  sticks: THREE.Mesh[]
  food: THREE.Mesh[]
  /** meshes with a "Puffed" shape key (mochi swelling on the grill net) */
  puffs: THREE.Mesh[]
  /** eaten down to the bare stick, which stays on the plate until clicked away */
  stickOnly: boolean
  /** grill-net items: which spot on the net it has (null: waiting its turn, hidden and not cooking) */
  netSpot: number | null
  /** once served: the plate, dish or basket it's on (plate-n, dish-n, basket-n), and where on it */
  container: string | null
  local: THREE.Vector3
  /** being carried by the pointer (a bare stick or something burnt, on its way to the bin) */
  carried: boolean
  /** 0 → 1 while dropping into the bin (−1 otherwise), and where it fell from */
  trash: number
  trashFrom: THREE.Vector3
  /** seconds since it landed on the plate or in the basket (it steams a little at first) */
  landed: number
  /** where it sits once collected: index into its plate run (or its pile); null while on the fire */
  slot: number | null
  /** 0 → 1 while being eaten off the plate; eaten pieces are gone until re-ordered */
  eat: number
  eaten: boolean
}

type TagState = { stage: (typeof ROAST_STAGES)[number]['key']; label: string; pct: number }

const stageOf = (r: number) => ROAST_STAGES.find((s) => r < s.until)!

/** Plate the roasted pieces are served onto: a shallow cream dish with a blue rim line and an ink outline. */
function Plate({ position, container }: { position: [number, number, number]; container: string }) {
  const geometry = useMemo(() => {
    // profile drawn for a 0.5 radius plate, scaled up to PLATE_R
    const k = PLATE_R / 0.5
    return wareGeometry(([[0, 0], [0.32, 0], [0.4, 0.025], [0.47, 0.06], [0.5, 0.075], [0.49, 0.082], [0.44, 0.052],
      [0.3, 0.02], [0, 0.02]] as [number, number][]).map(([x, y]) => [x * k, y] as [number, number]), PLATE_R)
  }, [])
  return (
    <group position={position} userData={{ container }}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={BAMBOO_WARE} />
      </mesh>
      <mesh geometry={geometry} scale={[1.025, 1.06, 1.025]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/** pieces that steam for a moment when they're served (hot fish, potatoes out of the foil) */
const STEAMS = /^(Fish|ExtraFish|Saury|Mackerel|Potato|SweetPotato|NetMochi)$/
const WISP_SECONDS = 4.5

/** A little steam rising off food that's just been served, fading out after a few seconds. */
function Wisp({ at, onDone }: { at: [number, number, number]; onDone: () => void }) {
  const level = useRef(1)
  const t = useRef(0)
  const done = useRef(false)
  useFrame((_, delta) => {
    t.current += delta
    level.current = Math.max(0, 1 - t.current / WISP_SECONDS) ** 1.5
    if (!done.current && t.current > WISP_SECONDS) {
      done.current = true
      onDone()
    }
  })
  return <Steam position={[at[0], at[1] + 0.04, at[2]]} layers={2} width={0.3} height={0.7} opacity={0.6} speed={0.1}
    level={level} />
}

type RoastingProps = {
  url: string
  roast: Roast
  /** ids the menu controls; anything else listed in roast.times is always there (the base fish) */
  itemIds: string[]
  quantities: Record<string, number>
  /** only the dish on stage roasts and shows its tags */
  active: boolean
  instant?: boolean
  /** 0..1 how fierce the charcoal is, read every frame: food roasts faster on a hotter fire */
  fire?: RefObject<number>
  /** told how many pieces are off the fire (on a plate, in a pile or eaten), for the fire's capacity limit */
  onOffFire?: (count: number, loose: number) => void
  /** a piece has been eaten up (for 飽足) */
  onEat?: (id: string) => void
  /** something to tell the diner (it isn't cooked yet, it's burnt) */
  onNotice?: (what: 'notCooked' | 'burnt') => void
  /** written every frame: how much smoke is coming off the fire (0..1), from food that's cooked and still on it */
  smoke?: RefObject<number>
}

/** Roasting speed for a fire level: barely cooking on dying embers, about twice as fast at full blaze. */
const roastRate = (fire: number) => 0.25 + 1.75 * fire

/**
 * Roasting over the fire: each skewer browns as it cooks (raw → half → done → slowly charring), shows a tag above
 * it, glows under the pointer, and a click on the tag or the food lifts it off the fire onto the plate.
 * Rendered as a sibling after <Dish>, so its per-frame transforms land after Dish's pop-in animation, and it picks
 * up the extra portions Dish clones in as they appear.
 */
export function Roasting({ url, roast, itemIds, quantities, active, instant = false, fire, onOffFire, onEat,
  onNotice, smoke }: RoastingProps) {
  const { scene } = useGLTF(url)
  const menuIds = useMemo(() => new Set(itemIds), [itemIds])
  const root = scene.children[0]

  // pieces by node, found by scanning the model root; rescanned whenever Dish adds a cloned portion
  const pieces = useRef<Piece[]>([])
  const scannedCount = useRef(-1)
  const scan = () => {
    const known = new Set(pieces.current.map((p) => p.node))
    for (const obj of root.children) {
      const id = (obj.userData.itemId as string | undefined) ?? baseName(obj.name)
      if (!(id in roast.times) || known.has(obj)) continue
      const mats: Piece['mats'] = []
      const looks: Looks = { uChar: { value: 0 }, uSalt: { value: 0 }, uSoy: { value: 0 }, uMilk: { value: 0 },
        uPeanut: { value: 0 } }
      pieces.current.push({
        key: obj.uuid, id, copy: (obj.userData.copy as number | undefined) ?? 0, loose: roast.loose.includes(id),
        node: obj, homeP: obj.position.clone(), homeQ: obj.quaternion.clone(), progress: 0, collected: false,
        flight: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), toP: new THREE.Vector3(),
        toQ: new THREE.Quaternion(), mats, looks, bites: newBites(), sticks: [], food: [], puffs: [], stickOnly: false,
        netSpot: null, container: null, local: new THREE.Vector3(), carried: false, trash: -1,
        trashFrom: new THREE.Vector3(),
        landed: -1,
        body: null, slot: null, eat: 0, eaten: false,
      })
    }
    scannedCount.current = root.children.length
  }

  /**
   * Each piece browns and chars on its own, so it gets its own copies of its materials. Dish swaps in the toon
   * materials in an effect that can land after our first frame, so keep trying until they're there.
   */
  const bindMaterials = (p: Piece) => {
    if (p.mats.length) return
    const meshes: THREE.Mesh[] = []
    p.node.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.name.endsWith('_outline')) meshes.push(o)
    })
    if (!meshes.length || !meshes.every((m) => m.material instanceof THREE.MeshToonMaterial)) return
    const rand = seeded(p.key)
    // every piece its own shade: a touch lighter or darker, warmer or cooler, than the next
    const shade = { h: (rand() - 0.5) * 0.05, s: (rand() - 0.5) * 0.2, l: (rand() - 0.5) * 0.12 }
    for (const m of meshes) {
      const mat = (m.material as THREE.MeshToonMaterial).clone()
      // Potatoes roast inside foil ("Foil…") with their skin whole ("…Top" is the cap); served, the foil is shown
      // opened out ("Wrapper…") and the cap broken off to show the flesh. Foil doesn't brown or char.
      const foil = mat.name.startsWith('Foil') || mat.name.startsWith('Wrapper')
      const show = mat.name.startsWith('Wrapper') ? 'open' : foil || mat.name.endsWith('Top') ? 'closed' : undefined
      if (!foil) {
        // bites come out of the food only: the bamboo stick is never eaten (it gets bites that stay empty)
        const stick = mat.name.startsWith('BambooSkewer')
        const bites = stick ? newBites() : p.bites
        addCharring(mat, p.looks, bites)
        for (const c of m.children) if (c instanceof THREE.Mesh && c.name.endsWith('_outline')) biteOutline(c, bites)
        mat.color.offsetHSL(shade.h, shade.s, shade.l)
      } else {
        // no two sheets of foil crumple alike: give this one its own folds, sheen and grey
        crumpleFoil(m, rand)
        mat.normalScale.multiplyScalar(0.6 + rand() * 1.0)
        mat.color.multiplyScalar(0.9 + rand() * 0.14)
      }
      m.material = mat
      p.mats.push({ mat, mesh: m, base: mat.color.clone(), emissive: mat.emissive.clone(), foil, show })
      if (mat.name.startsWith('BambooSkewer')) p.sticks.push(m)
      else p.food.push(m)
      if (m.morphTargetInfluences?.length) p.puffs.push(m)
    }
  }

  const present = (p: Piece) => !menuIds.has(p.id) || p.copy < (quantities[p.id] ?? 0)

  /**
   * Plate n of the run. They go around the fire at the first plate's distance: the 2nd to its front-right, the
   * rest round the back (so none sits between the camera and the fire); a full lap moves out a ring.
   */
  // plates, side dishes and the basket can be dragged about the table: how far each has been moved
  const moved = useRef(new Map<string, THREE.Vector3>())
  const [, setMoveTick] = useState(0)
  const nudge = (key: string) => moved.current.get(key) ?? ZERO

  const plateAt = (n: number) => {
    const [x, y, z] = roast.plate
    const r0 = Math.hypot(x, z)
    const a0 = Math.atan2(z, x)
    const step = 2 * Math.asin(Math.min(1, (PLATE_STEP / 2) / r0))     // angle between neighbouring plates
    const order = [0, 1, -1, -2, -3, -4, -5]                             // in steps, from the first plate
    const lap = Math.floor(n / order.length)
    const a = a0 + order[n % order.length] * step + lap * step / 2
    const r = r0 + lap * PLATE_STEP
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).add(nudge(`plate-${n}`))
  }
  const [plateCount, setPlateCount] = useState(1)
  const basketAt = (n: number) => {
    const [x, y, z] = roast.basket!.at
    return new THREE.Vector3(x, y, z).addScaledVector(LAY_DIR, -n * BASKET_STEP).add(nudge(`basket-${n}`))
  }
  /** where a container (plate-n, dish-n, basket-n, the seasoning box, the bin) is now */
  const containerAt = (key: string): THREE.Vector3 => {
    const [kind, n] = key.split('-')
    if (kind === 'box') return (boxNodes[0]?.home.clone() ?? new THREE.Vector3()).add(nudge('box'))
    if (kind === 'bin') return new THREE.Vector3(...(roast.bin ?? [0, 0, 0])).add(nudge('bin'))
    return kind === 'plate' ? plateAt(+n) : kind === 'dish' ? dishAt(+n) : basketAt(+n)
  }
  const footprint = (key: string) => {
    const kind = key.split('-')[0]
    return { plate: PLATE_R, dish: DISH_R, basket: BASKET_R, box: BOX_R, bin: BIN_R }[kind] ?? 0.3
  }
  /** everything standing on the table that can be moved, for bumping into */
  const containerKeys = () => [
    ...Array.from({ length: plateCount }, (_, n) => `plate-${n}`),
    ...(roast.dish ? Array.from({ length: dishCount }, (_, n) => `dish-${n}`) : []),
    ...(roast.basket ? Array.from({ length: basketCount }, (_, n) => `basket-${n}`) : []),
    ...(boxNodes.length ? ['box'] : []),
    ...(roast.bin ? ['bin'] : []),
  ]
  /**
   * Keep a moved container from passing through things: out of the stone ring, and clear of every other
   * plate, dish, basket, the box and the bin (round footprints, pushed apart until they just touch).
   */
  const settle = (key: string, at: THREE.Vector3) => {
    const r = footprint(key)
    const others = containerKeys().filter((k) => k !== key).map((k) => ({ p: containerAt(k), r: footprint(k) }))
    for (let i = 0; i < 6; i++) {
      const d = Math.hypot(at.x, at.z) || 1e-6
      if (d < RING_CLEAR + r) {
        at.x *= (RING_CLEAR + r) / d
        at.z *= (RING_CLEAR + r) / d
      }
      for (const o of others) {
        const dx = at.x - o.p.x
        const dz = at.z - o.p.z
        const dd = Math.hypot(dx, dz) || 1e-6
        const min = r + o.r + 0.01
        if (dd < min) {
          at.x = o.p.x + (dx / dd) * min
          at.z = o.p.z + (dz / dd) * min
        }
      }
    }
    return at
  }
  const [basketCount, setBasketCount] = useState(1)
  const [wisps, setWisps] = useState<{ key: string; at: [number, number, number] }[]>([])
  const inBasket = (p: Piece) => !!roast.basket && !!roast.basketItems?.includes(p.id)
  // onigiri and mochi off the grill net go on little side dishes of their own
  const onDish = (p: Piece) => !!roast.dish && !!roast.net?.includes(p.id)
  const dishAt = (n: number) => {
    const [x, y, z] = roast.dish!.at
    return new THREE.Vector3(x, y, z).addScaledVector(STACK_DIR, -n * DISH_STEP).add(nudge(`dish-${n}`))
  }
  const [dishCount, setDishCount] = useState(1)
  const destination = (p: Piece) => (inBasket(p) ? 'basket' : onDish(p) ? 'dish' : 'plate')

  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    const basket = inBasket(p)
    const dish = onDish(p)
    // take the first free spot where it's going (basket, dishes or plates); eaten food frees its spot
    const taken = new Set(pieces.current.filter((q) => q.slot !== null && !q.eaten && present(q) &&
      destination(q) === destination(p)).map((q) => q.slot))
    let slot = 0
    while (taken.has(slot)) slot++
    p.slot = slot
    p.collected = true
    p.netSpot = null           // its place on the grill net goes to the next one waiting
    // tells Dish to stop driving this node's position (its pop-in would pull it back up to skewer height)
    p.node.userData.onPlate = true
    p.flight = instant ? 1 : 0
    p.fromP.copy(p.node.position)
    p.fromQ.copy(p.node.quaternion)
    if (basket) {
      // tossed in from just above the basket; from there the physics drops it in and lets it settle
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 0.1
      p.toP.copy(basketAt(0)).add(new THREE.Vector3(Math.cos(a) * r, 0.42, Math.sin(a) * r))
      p.body = null
      // lying on its side, broken-open top up, turned any which way
      const yaw = Math.random() * Math.PI * 2
      const along = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
      p.toQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, UP, new THREE.Vector3().crossVectors(along, UP)))
    } else if (dish) {
      // a side dish holds a few in a ring; a full one gets another set down beside it
      const cap = roast.dish!.capacity
      const n = Math.floor(slot / cap)
      const a = ((slot % cap) / cap) * Math.PI * 2 + 0.4
      const r = cap > 1 ? DISH_R * 0.48 : 0
      p.toP.copy(dishAt(n)).add(new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r))
      if (n + 1 > dishCount) setDishCount(n + 1)
      p.container = `dish-${n}`
      // lying flat, just as it sat on the net, turned any which way
      p.toQ.copy(p.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2))
    } else {
      // side by side across the plate, centred; a full row starts a new layer on top; a full plate, a new plate
      const plate = Math.floor(slot / PER_PLATE)
      const within = slot % PER_PLATE
      const col = within % PER_LAYER
      const layer = Math.floor(within / PER_LAYER)
      const across = (col - (PER_LAYER - 1) / 2) * SLOT_GAP + (layer % 2) * (SLOT_GAP / 2)
      p.toP.copy(plateAt(plate)).addScaledVector(STACK_DIR, across)
      if (plate + 1 > plateCount) setPlateCount(plate + 1)
      p.container = `plate-${plate}`
      // skewers are longer than the plate is wide, so the stick rests across the rim (top ≈ 0.08) instead of
      // cutting through it
      p.toP.y += (p.loose ? 0.075 : 0.105) + layer * LAYER_HEIGHT
    }
    if (basket) p.container = 'basket-0'
    // where it sits relative to its plate, dish or basket, so it goes along when that's dragged somewhere else
    p.local.copy(p.toP).sub(containerAt(p.container!))
    // everything points the same way along LAY_DIR
    if (basket || dish) {
      // already turned above
    } else if (p.loose) {
      // loose pieces lie on their bottom (local +Y up), long axis (local X) along the row
      const z = new THREE.Vector3().crossVectors(LAY_DIR, UP)
      p.toQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(LAY_DIR, UP, z))
    } else {
      // A skewer's local axes depend on how its parts were joined in Blender, so work from the stick itself: it
      // runs from its foot on the outer ring up and in to its tip (blender/grilledfish.py STICK_*), and the
      // food's broad side faces outward. Turn that frame so the stick lies along LAY_DIR, broad side up.
      const phi = Math.atan2(p.homeP.z, p.homeP.x)
      const outward = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi))
      const stick = new THREE.Vector3(-(STICK_FOOT_R - STICK_TOP_R) * Math.cos(phi), STICK_TOP_Y,
        -(STICK_FOOT_R - STICK_TOP_R) * Math.sin(phi)).normalize()
      const face = outward.addScaledVector(stick, -outward.dot(stick)).normalize()
      const from = new THREE.Matrix4().makeBasis(stick, face, new THREE.Vector3().crossVectors(stick, face))
      const to = new THREE.Matrix4().makeBasis(LAY_DIR, UP, new THREE.Vector3().crossVectors(LAY_DIR, UP))
      const turn = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()))
      p.toQ.copy(p.homeQ).premultiply(turn)
    }
  }

  /**
   * Eat a piece that's sitting on the plate (or in the basket): a few chewing bites and the food is gone. A skewer
   * leaves its bare stick behind; clicking that clears it away.
   */
  const eat = (p: Piece) => {
    if (!p.collected || p.flight < 1 || p.eaten || !present(p)) return
    if (p.stickOnly) {
      p.eaten = true
      p.slot = null
      return
    }
    if (p.eat > 0) return
    // only food that's properly done: not raw or half-cooked, and not burnt
    const stage = stageOf(p.progress / roast.times[p.id]).key
    if (stage === 'raw' || stage === 'half') {
      onNotice?.('notCooked')
      return
    }
    if (stage === 'burnt') {
      onNotice?.('burnt')
      return
    }
    p.eat = 0.0001
    playChew(BITES_PER_PIECE + 2, EAT_SECONDS)
  }

  /**
   * Take the next bite out of a piece: working in from the far end of the food along its longest side, each bite
   * a ball a bit wider than the food is thick, off-centre to alternate sides, so what's left looks gnawed.
   * Once bitten into, its inside faces are drawn too, so the bite shows the inside instead of a hollow.
   */
  const takeBite = (p: Piece) => {
    const k = p.bites.uBiteCount.value
    if (k >= MAX_BITES) return
    const box = new THREE.Box3()
    for (const { mesh: m, foil } of p.mats) {
      if (foil || p.sticks.includes(m)) continue
      m.geometry.computeBoundingBox()
      box.union(m.geometry.boundingBox!)
    }
    const size = box.getSize(new THREE.Vector3())
    const mid = box.getCenter(new THREE.Vector3())
    const axes = [0, 1, 2].sort((a, b) => size.getComponent(b) - size.getComponent(a))
    const [long, wide] = axes
    const len = size.getComponent(long)
    const c = mid.clone()
    c.setComponent(long, box.max.getComponent(long) - len * (0.05 + k * 0.95 / BITES_PER_PIECE))
    c.setComponent(wide, mid.getComponent(wide) + (k % 2 ? 1 : -1) * size.getComponent(wide) * 0.22)
    const r = Math.max(len / BITES_PER_PIECE * 0.85, size.getComponent(wide) * 0.62)
    p.bites.uBites.value[k].set(c.x, c.y, c.z, r)
    p.bites.uBiteCount.value = k + 1
    if (k === 0) {
      for (const { mat, foil } of p.mats) if (!foil) {
        mat.side = THREE.DoubleSide
        mat.needsUpdate = true
      }
    }
  }

  // pointer: hovering food on the fire or the plate makes it glow and turns the cursor into a hand; a click (not
  // a drag that orbits the camera) takes it off the fire, or eats it once it's on the plate
  const { gl, camera, raycaster, scene: world } = useThree()
  const shift = useRef<{ key: string; start: THREE.Vector3; from: THREE.Vector3 } | null>(null)
  const scrap = useRef<{ p: Piece; x: number; y: number; started: boolean } | null>(null)
  const [saltInHand, setSaltInHand] = useState(false)
  const hand = useRef<THREE.Group>(null)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  // seasonings beside the fire (salt, soy and brush, condensed milk, peanut powder): pick one up, carry it over a
  // piece of food and let go to season that piece
  const tools = useMemo(() => Object.entries(roast.tools ?? {}).flatMap(([name, kind]) => {
    const node = root.getObjectByName(name)
    return node ? [{ node, kind, home: node.position.clone(), home0: node.position.clone(),
      homeQ: node.quaternion.clone(), back: 1 }] : []
  }), [root, roast.tools])
  // the seasoning box and what stands in it (but not the utensils, which have their own homes), for dragging
  const boxNodes = useMemo(() => (roast.toolBox ?? []).flatMap((name) => {
    const node = root.getObjectByName(name)
    if (!node || Object.prototype.hasOwnProperty.call(roast.tools ?? {}, name)) return []
    return [{ node, home: node.position.clone() }]
  }), [root, roast.toolBox, roast.tools])
  useEffect(() => {
    // grabbing the box (not a pot or a utensil) drags the whole thing
    const box = boxNodes[0]?.node
    if (box) box.userData.container = 'box'
  }, [boxNodes])
  type Tool = (typeof tools)[number]
  // the pots they stand in: pointing at or grabbing a pot means its utensil
  const pots = useMemo(() => Object.entries(roast.toolPots ?? {}).flatMap(([potName, toolName]) => {
    const pot = root.getObjectByName(potName)
    const tool = tools.find((t) => t.node.name === toolName)
    return pot && tool ? [{ pot, tool }] : []
  }), [root, roast.toolPots, tools])
  const drag = useRef<{ tool: Tool; target: Piece | null; at: THREE.Vector3; pour: number } | null>(null)
  const hoveredTool = useRef<Tool | null>(null)
  const [toolLabel, setToolLabel] = useState<{ kind: Seasoning; at: [number, number, number] } | null>(null)

  // the grains and drops that fall while a seasoning is held over food
  const grains = useMemo(() => {
    const pos = new Float32Array(GRAINS * 3).fill(-10)
    const col = new Float32Array(GRAINS * 3)
    const vel = new Float32Array(GRAINS * 3)
    const life = new Float32Array(GRAINS)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { pos, col, vel, life, geometry, next: 0 }
  }, [])
  const grainMaterial = useMemo(() => new THREE.PointsMaterial({ size: 0.024, sizeAttenuation: true, vertexColors: true }), [])
  const emit = (kind: Seasoning, from: THREE.Vector3, count: number) => {
    const { pos, col, vel, life } = grains
    const c = GRAIN_COLORS[kind]
    for (let n = 0; n < count; n++) {
      const i = grains.next
      grains.next = (grains.next + 1) % GRAINS
      pos.set([from.x + (Math.random() - 0.5) * 0.06, from.y, from.z + (Math.random() - 0.5) * 0.06], i * 3)
      col.set([c.r, c.g, c.b], i * 3)
      // powders scatter, sauces fall in drops
      const spread = kind === 'salt' || kind === 'peanut' ? 0.25 : 0.05
      vel.set([(Math.random() - 0.5) * spread, -0.2 - Math.random() * 0.3, (Math.random() - 0.5) * spread], i * 3)
      life[i] = 0.9
    }
  }
  /** a seasoning lands on a piece: its look changes (more of it with every dab) */
  const season = (p: Piece, kind: Seasoning) => {
    const u = { salt: p.looks.uSalt, soy: p.looks.uSoy, milk: p.looks.uMilk, peanut: p.looks.uPeanut }[kind]
    u.value = Math.min(1, u.value + DAB)
  }

  const hovered = useRef<Piece | null>(null)
  // the hovered food's tag brightens too (tags sit at low opacity until pointed at)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const setHover = (p: Piece | null) => {
    hovered.current = p
    setHoveredKey(p?.key ?? null)
  }
  useEffect(() => {
    const el = gl.domElement
    if (!active) {
      hovered.current = null
      el.style.cursor = ''
      return
    }
    const pointer = { x: 0, y: 0 }
    const aim = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      raycaster.setFromCamera(new THREE.Vector2((pointer.x / rect.width) * 2 - 1, -(pointer.y / rect.height) * 2 + 1),
        camera)
    }
    /** a bare stick left on the plate is thin and hard to hit, so anywhere near it counts */
    const nearStick = () => {
      const rect = el.getBoundingClientRect()
      const v = new THREE.Vector3()
      let best: Piece | null = null
      let bestD = 30
      for (const p of pieces.current) {
        if (!p.stickOnly || p.eaten || !present(p)) continue
        for (const s of p.sticks) {
          s.getWorldPosition(v).project(camera)
          const d = Math.hypot((v.x + 1) / 2 * rect.width - pointer.x, (1 - v.y) / 2 * rect.height - pointer.y)
          if (d < bestD) {
            bestD = d
            best = p
          }
        }
      }
      return best
    }
    /** the food under the pointer: on the fire, or on the plate / in the basket once it's landed */
    const pickFood = (seasoning = false) => {
      const candidates = pieces.current.filter((p) => present(p) && !p.eaten &&
        !(roast.net?.includes(p.id) && !p.collected && p.netSpot === null) &&
        (!p.collected || (p.flight >= 1 && (p.eat === 0 || p.stickOnly))) && !(seasoning && p.stickOnly))
      const hits = raycaster.intersectObjects(candidates.map((p) => p.node), true)
      if (!hits.length) return seasoning ? null : nearStick()
      let o: THREE.Object3D | null = hits[0].object
      while (o && !candidates.some((p) => p.node === o)) o = o.parent
      return candidates.find((p) => p.node === o) ?? null
    }
    const pickTool = () => {
      const hits = raycaster.intersectObjects([...tools.map((t) => t.node), ...pots.map((p) => p.pot)], true)
      if (!hits.length) return null
      let o: THREE.Object3D | null = hits[0].object
      while (o && !tools.some((t) => t.node === o) && !pots.some((p) => p.pot === o)) o = o.parent
      return tools.find((t) => t.node === o) ?? pots.find((p) => p.pot === o)?.tool ?? null
    }
    // where a carried seasoning is held: on a level plane a little above the food, under the pointer
    const holdPlane = new THREE.Plane()
    const carry = (e: PointerEvent) => {
      const d = drag.current!
      aim(e)
      const y = root.localToWorld(new THREE.Vector3(0, 0.95, 0)).y
      holdPlane.set(UP, -y)
      const hit = raycaster.ray.intersectPlane(holdPlane, new THREE.Vector3())
      if (hit) d.at.copy(root.worldToLocal(hit))
      const target = pickFood(true)
      d.target = target
      if (target !== hovered.current) setHover(target)
    }

    let down: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (drag.current) return
      if (e.buttons) return
      aim(e)
      const tool = pickTool()
      const p = tool ? null : pickFood()
      if (tool !== hoveredTool.current) {
        hoveredTool.current = tool
        setToolLabel(tool ? { kind: tool.kind, at: [tool.home.x, tool.home.y + 0.32, tool.home.z] } : null)
      }
      if (p !== hovered.current) setHover(p)
      el.style.cursor = tool ? 'grab' : p ? 'pointer' : pickContainer() ? 'grab' : ''
    }
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
      if (e.button !== 0) return
      aim(e)
      const tool = pickTool()
      if (!tool) {
        // a bare stick or something burnt can be picked up and carried to the bin (a plain click still eats or
        // complains as usual: carrying only starts once the pointer moves)
        const food = pickFood()
        if (food && (food.stickOnly || stageOf(food.progress / roast.times[food.id]).key === 'burnt')) {
          scrap.current = { p: food, x: e.clientX, y: e.clientY, started: false }
          window.addEventListener('pointermove', haul)
          window.addEventListener('pointerup', dropScrap, { once: true })
          return
        }
        // otherwise grab a plate, side dish, the basket, the seasoning box or the bin (not the food on them)
        const key = food ? null : pickContainer()
        if (!key) return
        const start = groundHit()
        if (!start) return
        shift.current = { key, start, from: nudge(key).clone() }
        if (controls) controls.enabled = false
        document.body.classList.add('is-carrying')
        window.addEventListener('pointermove', slide)
        window.addEventListener('pointerup', release, { once: true })
        return
      }
      // pick it up: the camera holds still while it's carried, and the pointer is followed over the whole window
      // (it passes over the food tags, which sit above the canvas)
      drag.current = { tool, target: null, at: tool.node.position.clone(), pour: 0 }
      if (tool.kind === 'salt') setSaltInHand(true)
      if (controls) controls.enabled = false
      el.style.cursor = 'grabbing'
      document.body.classList.add('is-carrying')
      setToolLabel(null)
      carry(e)
      window.addEventListener('pointermove', carry)
      window.addEventListener('pointerup', drop, { once: true })
    }
    const drop = () => {
      const d = drag.current
      window.removeEventListener('pointermove', carry)
      document.body.classList.remove('is-carrying')
      if (!d) return
      // let go over food: season it; either way the seasoning goes back to its place
      if (d.target) {
        season(d.target, d.tool.kind)
        emit(d.tool.kind, d.at.clone().add(new THREE.Vector3(0, -0.1, 0)), 40)
      }
      d.tool.back = 0
      drag.current = null
      setSaltInHand(false)
      if (controls) controls.enabled = true
      el.style.cursor = ''
      setHover(null)
    }
    /** the plate / dish / basket under the pointer, by the container key its group carries */
    const pickContainer = () => {
      const groups: THREE.Object3D[] = []
      world.traverse((o) => { if (typeof o.userData.container === 'string') groups.push(o) })
      for (const hit of raycaster.intersectObjects(groups, true)) {
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
          if (typeof o.userData.container === 'string') return o.userData.container as string
        }
      }
      return null
    }
    /** where the pointer meets the table, in the dish's own coordinates */
    const groundHit = () => {
      const plane = new THREE.Plane(UP, -root.localToWorld(new THREE.Vector3()).y)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      return hit ? root.worldToLocal(hit) : null
    }
    const slide = (e: PointerEvent) => {
      const s = shift.current
      if (!s) return
      aim(e)
      const hit = groundHit()
      if (!hit) return
      const before = nudge(s.key).clone()
      // where it would go, kept clear of the fire and of everything else on the table
      const base = containerAt(s.key).sub(before)
      const want = base.clone().add(s.from).add(hit.sub(s.start))
      want.y = base.y
      const next = settle(s.key, want).sub(base)
      next.y = 0
      moved.current.set(s.key, next)
      if (s.key === 'box') {
        // the box carries its pots and utensils with it
        for (const b of boxNodes) b.node.position.copy(b.home).add(next)
        for (const t of tools) if (t.back >= 1 && drag.current?.tool !== t) t.node.position.copy(t.home0).add(next)
        for (const t of tools) t.home.copy(t.home0).add(next)
      }
      // potatoes rolling about in the basket go along with it
      const delta = next.clone().sub(before)
      for (const p of pieces.current) if (p.body?.live && p.container === s.key) p.node.position.add(delta)
      setMoveTick((t) => t + 1)
    }
    const release = () => {
      shift.current = null
      window.removeEventListener('pointermove', slide)
      document.body.classList.remove('is-carrying')
      if (controls) controls.enabled = true
    }
    // carrying scraps to the bin
    const haul = (e: PointerEvent) => {
      const q = scrap.current
      if (!q) return
      if (!q.started) {
        if (Math.hypot(e.clientX - q.x, e.clientY - q.y) < 6) return
        q.started = true
        q.p.carried = true
        q.p.node.userData.onPlate = true
        if (controls) controls.enabled = false
        document.body.classList.add('is-carrying')
      }
      aim(e)
      const plane = new THREE.Plane(UP, -root.localToWorld(new THREE.Vector3(0, 0.55, 0)).y)
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      if (hit) q.p.node.position.copy(root.worldToLocal(hit))
    }
    const dropScrap = () => {
      const q = scrap.current
      window.removeEventListener('pointermove', haul)
      scrap.current = null
      if (!q?.started) return
      document.body.classList.remove('is-carrying')
      if (controls) controls.enabled = true
      q.p.carried = false
      const bin = containerAt('bin')
      const pos = q.p.node.position
      if (roast.bin && Math.hypot(pos.x - bin.x, pos.z - bin.z) < BIN_R + 0.16) {
        // let go over the bin: it drops in
        q.p.trash = 0
        q.p.trashFrom.copy(pos)
      } else if (!q.p.collected) {
        q.p.node.userData.onPlate = false            // back onto its skewer spot
      }
    }
    const onUp = (e: PointerEvent) => {
      if (drag.current || shift.current || scrap.current?.started) return
      if (e.button !== 0 || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      aim(e)
      const p = pickFood()
      if (!p) return
      if (p.collected) eat(p)
      else collect(p)
    }
    const onLeave = () => {
      if (drag.current) return
      hoveredTool.current = null
      setToolLabel(null)
      setHover(null)
      el.style.cursor = ''
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
    }
  })

  /**
   * The basket's little physics: each potato is a ball under gravity, resting on the bowl (a paraboloid matching
   * the basket's shape) and pushed apart from its neighbours, so they tumble in, roll down to the middle and heap
   * up. Rolling turns them; friction and damping let them come to rest.
   */
  const settleBasket = (dt: number) => {
    const live = pieces.current.filter((p) => p.body?.live && present(p) && !p.eaten)
    if (!live.length) return
    const c = basketAt(0)
    const steps = 4
    const h = dt / steps
    const n = new THREE.Vector3()
    const d = new THREE.Vector3()
    for (let k = 0; k < steps; k++) {
      for (const p of live) {
        const b = p.body!
        const pos = p.node.position
        b.v.y -= 6 * h
        pos.addScaledVector(b.v, h)
        // the bowl: floor rising toward the rim
        const dx = pos.x - c.x
        const dz = pos.z - c.z
        const dist = Math.hypot(dx, dz) || 1e-6
        const slope = 2 * BOWL_CURVE * dist
        const floor = c.y + 0.03 + BOWL_CURVE * dist * dist
        n.set((-slope * dx) / dist, 1, (-slope * dz) / dist).normalize()
        const depth = floor + b.r / n.y - pos.y
        if (depth > 0) {
          pos.addScaledVector(n, depth * n.y)
          const vn = b.v.dot(n)
          if (vn < 0) b.v.addScaledVector(n, -vn * 1.25)
          b.v.multiplyScalar(0.96)
          // roll along the floor
          const speed = Math.hypot(b.v.x, b.v.z)
          if (speed > 1e-4) {
            d.set(b.v.z, 0, -b.v.x).divideScalar(speed)
            p.node.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(d, (speed * h) / b.r * 0.6))
          }
        }
        // the rim keeps them in
        const wall = BASKET_R * 0.9 - b.r * 0.6
        if (dist > wall) {
          pos.x = c.x + (dx / dist) * wall
          pos.z = c.z + (dz / dist) * wall
          const out = (b.v.x * dx + b.v.z * dz) / dist
          if (out > 0) {
            b.v.x -= (dx / dist) * out * 1.3
            b.v.z -= (dz / dist) * out * 1.3
          }
        }
      }
      // potatoes push each other apart
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]
          const o = live[j]
          d.subVectors(a.node.position, o.node.position)
          const dist = d.length() || 1e-6
          const min = a.body!.r + o.body!.r
          if (dist >= min) continue
          d.divideScalar(dist)
          const push = (min - dist) / 2
          a.node.position.addScaledVector(d, push)
          o.node.position.addScaledVector(d, -push)
          const rel = a.body!.v.dot(d) - o.body!.v.dot(d)
          if (rel < 0) {
            a.body!.v.addScaledVector(d, -rel * 0.6)
            o.body!.v.addScaledVector(d, rel * 0.6)
          }
        }
      }
    }
    for (const p of live) {
      p.body!.v.multiplyScalar(1 - 0.8 * dt)
      if (p.body!.v.lengthSq() < 0.0004) p.body!.v.multiplyScalar(0.5)
    }
  }

  const anchors = useRef<Record<string, THREE.Group | null>>({})
  const [tags, setTags] = useState<{ key: string; id: string; state: TagState }[]>([])
  const lastTags = useRef('')
  const lastOff = useRef(-1)
  const since = useRef(0)
  const tint = useMemo(() => new THREE.Color(), [])

  // glowing charcoal: mostly black at a low fire, more and more of it red-hot as the fire builds; as the fire
  // burns down the coals are used up and slowly turn to pale grey ash (fresh charcoal brings the black back)
  const embers = useRef<{ mat: THREE.MeshToonMaterial; base: number; color: THREE.Color }[] | null>(null)

  useFrame((_, delta) => {
    if (!embers.current || !embers.current.length) {
      const found = new Map<THREE.MeshToonMaterial, number>()
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial &&
          (o.material.name === 'Ember' || o.material.name === 'Binchotan')) {
          found.set(o.material, o.material.emissiveIntensity)
        }
      })
      embers.current = [...found].map(([mat, base]) => ({ mat, base, color: mat.color.clone() }))
    }
    const f = fire?.current ?? 0.55
    const ash = THREE.MathUtils.smoothstep(0.5 - f, 0, 0.45)

    for (const e of embers.current) {
      // no fire, no glow
      e.mat.emissiveIntensity = e.base * 1.23 * f ** 1.6
      const gain = 1 + ((ASH_GAIN[e.mat.name] ?? 1) - 1) * ash ** 1.5
      e.mat.color.copy(e.color).lerp(ASH_TINT, ash).multiplyScalar(gain)
    }
    if (scannedCount.current !== root.children.length) scan()
    const dt = Math.min(delta, 0.1)

    // seasonings: the one being carried follows the pointer, tipped to pour over the food beneath it (a little
    // sprinkle or drip falls while it's over something); the rest sit in their places, glowing when pointed at
    const d = drag.current
    for (const t of tools) {
      const held = d?.tool === t
      if (held && t.kind === 'salt' && hand.current) hand.current.position.copy(t.node.position).add(HAND_OFFSET)
      if (held) {
        t.node.position.lerp(d!.at, Math.min(1, dt * 14))
        d!.pour += ((d!.target ? 1 : 0) - d!.pour) * Math.min(1, dt * 8)
        t.node.quaternion.copy(t.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, -1).normalize(), 0.2 + d!.pour * 0.9))
        if (d!.target && Math.random() < dt * 30) emit(t.kind, t.node.position.clone().add(new THREE.Vector3(0, -0.05, 0)), 2)
      } else if (t.back < 1) {
        // carried back home in a little arc
        t.back = Math.min(1, t.back + dt * 2.5)
        t.node.position.lerp(t.home, Math.min(1, dt * 10))
        t.node.quaternion.slerp(t.homeQ, Math.min(1, dt * 10))
        if (t.back >= 1) {
          t.node.position.copy(t.home)
          t.node.quaternion.copy(t.homeQ)
        }
      }
      const lit = active && (held || hoveredTool.current === t)
      t.node.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
          o.material.emissive.set(lit ? HOVER_GLOW : 0x000000)
        }
      })
    }
    {
      const { pos, vel, life } = grains
      let any = false
      for (let i = 0; i < GRAINS; i++) {
        if (life[i] <= 0) continue
        any = true
        life[i] -= dt
        vel[i * 3 + 1] -= 4.5 * dt
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        if (life[i] <= 0) pos[i * 3 + 1] = -10
      }
      if (any) grains.geometry.attributes.position.needsUpdate = true
      grains.geometry.attributes.color.needsUpdate = true
    }
    // the grill net holds a few at a time: hand free spots to waiting pieces, first ordered first
    const spots = roast.netSpots ?? []
    if (spots.length) {
      const onNet = (p: Piece) => roast.net?.includes(p.id) && present(p) && !p.collected
      const taken = new Set(pieces.current.filter((p) => onNet(p) && p.netSpot !== null).map((p) => p.netSpot))
      for (const p of pieces.current.filter((q) => onNet(q) && q.netSpot === null).sort((a, b) => a.copy - b.copy)) {
        const free = spots.findIndex((_, i) => !taken.has(i))
        if (free < 0) break
        p.netSpot = free
        taken.add(free)
      }
    }
    const waiting = (p: Piece) => !!roast.net?.includes(p.id) && !p.collected && p.netSpot === null

    pieces.current.forEach((p, n) => {
      bindMaterials(p)
      if (!present(p)) {
        // taken off the order: next time it comes back raw, on its skewer
        p.progress = 0
        p.netSpot = null
        p.container = null
        p.carried = false
        p.trash = -1
        p.body = null
        for (const u of Object.values(p.looks)) u.value = 0
        p.stickOnly = false
        for (const m of p.food) m.visible = true
        if (p.bites.uBiteCount.value) {
          p.bites.uBiteCount.value = 0
          for (const { mat, foil } of p.mats) if (!foil && mat.side !== THREE.FrontSide) {
            mat.side = THREE.FrontSide
            mat.needsUpdate = true
          }
        }
        p.landed = -1
        p.collected = false
        p.flight = 0
        p.slot = null
        p.eat = 0
        p.eaten = false
        p.node.userData.onPlate = false
        p.node.quaternion.copy(p.homeQ)
        p.node.position.copy(p.homeP)
        return
      }
      const time = roast.times[p.id]
      if (p.trash >= 0) {
        // tossed into the bin: a short arc down into it, and gone
        p.trash = Math.min(1, p.trash + dt / 0.45)
        const k = p.trash
        const into = containerAt('bin')
        into.y += 0.12
        p.node.position.lerpVectors(p.trashFrom, into, k)
        p.node.position.y += Math.sin(k * Math.PI) * 0.12
        if (k >= 1) {
          p.trash = -1
          p.eaten = true
          p.slot = null
          p.collected = true
          p.stickOnly = false
        }
      } else if (p.carried) {
        // (held by the pointer, see haul)
      } else if (!p.collected) {
        if (active && !waiting(p)) p.progress += dt * roastRate(fire?.current ?? 0.55)
        p.node.quaternion.copy(p.homeQ)
        p.node.position.x = p.homeP.x
        p.node.position.z = p.homeP.z
        if (p.netSpot !== null) {
          p.node.position.x = spots[p.netSpot][0]
          p.node.position.z = spots[p.netSpot][1]
        }
        if (!menuIds.has(p.id)) p.node.position.y = p.homeP.y   // the base fish has no pop-in driving y
      } else {
        if (p.flight >= 1) p.landed += dt
        else p.landed = -1
        if (p.flight < 1 && p.flight + dt / FLIGHT_SECONDS >= 1 && STEAMS.test(p.id) && !p.eaten) {
          p.landed = 0
          const at = inBasket(p) ? basketAt(0).add(new THREE.Vector3(0, 0.06, 0)) : p.toP
          setWisps((all) => [...all.filter((w) => w.key !== p.key), { key: p.key, at: at.toArray() as [number, number, number] }])
        }
        p.flight = Math.min(1, p.flight + dt / FLIGHT_SECONDS)
        if (!p.body?.live) {
          const e = p.flight < 0.5 ? 2 * p.flight * p.flight : 1 - (-2 * p.flight + 2) ** 2 / 2
          // (its spot follows the plate or dish if that's been dragged somewhere)
          if (p.container) p.toP.copy(containerAt(p.container)).add(p.local)
          p.node.position.lerpVectors(p.fromP, p.toP, e)
          p.node.position.y += Math.sin(p.flight * Math.PI) * 0.45   // a little arc through the air
          p.node.quaternion.slerpQuaternions(p.fromQ, p.toQ, e)
          if (p.flight >= 1 && inBasket(p)) {
            // let go above the basket: size the ball from the potato's two shorter axes
            const s = [p.node.scale.x, p.node.scale.y, p.node.scale.z].sort((x, y) => x - y)
            p.body = { v: new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3),
              r: (s[0] + s[1]) / 2 * 1.05, live: true }
          }
        }
      }

      // browning, then a slow char: black patches spread across the texture and the whole piece darkens,
      // deepening the longer it's left on
      const r = p.progress / time
      const charred = THREE.MathUtils.smootherstep(r, CHAR_START, CHAR_FULL)
      p.looks.uChar.value = charred
      // mochi on the net swells up as it toasts, and breathes a little while it's still over the coals
      if (p.puffs.length) {
        const puff = THREE.MathUtils.smoothstep(r, 0.55, 1.15)
        const breathe = p.collected ? 0 : Math.sin(performance.now() / 380 + p.copy) * 0.05 * puff
        for (const m of p.puffs) m.morphTargetInfluences![0] = Math.min(1, puff + breathe)
      }
      if (r < 1) tint.copy(RAW_TINT).lerp(DONE_TINT, r)
      else tint.copy(DONE_TINT).lerp(BURNT_TINT, charred * 0.6)
      const glow = hovered.current === p
      // potatoes: wrapped and whole in the ash. Picked up, the foil is unwrapped on the way over — the sheet opens
      // out, swells and falls away — and the potato lands in the basket bare, broken open to show the flesh
      const peel = p.collected ? THREE.MathUtils.clamp((p.flight - 0.1) / 0.7, 0, 1) : -1
      for (const { mat, mesh, base, emissive, foil, show } of p.mats) {
        // (hide the mesh rather than the material, so its ink outline goes with it)
        if (show === 'closed') mesh.visible = !(p.collected && p.flight > (foil ? 0.1 : 0.35))
        if (show === 'open') {
          mesh.visible = peel > 0 && peel < 1
          if (mesh.visible) {
            if (!mat.transparent) {
              mat.transparent = true
              mat.needsUpdate = true
            }
            mat.opacity = 1 - peel * peel
            mesh.scale.setScalar(1 + peel * 0.9)
            mesh.position.y = -0.4 * peel * peel
          } else {
            mesh.scale.setScalar(1)
            mesh.position.y = 0
          }
        }
        if (!foil) mat.color.copy(base).multiply(tint)
        mat.emissive.copy(emissive)
        if (glow) mat.emissive.add(HOVER_GLOW)
      }
      // burnt food shrivels a little. Menu items get their scale from Dish's pop-in, which applies this factor;
      // the base fish has no pop-in, so set it directly.
      let shrink = 1 - 0.08 * THREE.MathUtils.smoothstep(r, 1.8, CHAR_FULL)
      // being eaten, a mouthful at a time: on each bite the piece is lifted a little as if picked up, a chunk with
      // tooth-marked edges disappears from the end, and it settles back while it's chewed (阿姆阿姆). On a skewer
      // only the food goes and the bare stick is left lying on the plate
      if (p.eat > 0 && !p.eaten && !p.stickOnly) {
        p.eat = Math.min(1, p.eat + dt / EAT_SECONDS)
        const phase = p.eat * BITES_PER_PIECE
        const wanted = Math.min(BITES_PER_PIECE, Math.floor(phase + 0.35))
        while (p.bites.uBiteCount.value < wanted) takeBite(p)
        if (!p.body?.live) {
          const lift = Math.max(0, Math.sin(Math.min(1, (phase % 1) * 1.6) * Math.PI))
          p.node.position.y += 0.06 * lift
          p.node.rotateOnWorldAxis(STACK_DIR, -0.12 * lift)
        }
        if (p.eat >= 1) {
          onEat?.(p.id)
          if (p.sticks.length) {
            p.stickOnly = true
            for (const m of p.food) m.visible = false
          } else {
            p.eaten = true
            p.slot = null
          }
        }
      }
      if (p.eaten || waiting(p)) shrink = 0.0001
      if (menuIds.has(p.id)) p.node.userData.shrink = shrink
      else p.node.scale.setScalar(shrink)

      // tags sit above the food, staggered over three heights so neighbouring tags don't overlap
      const a = anchors.current[p.key]
      if (a) {
        a.position.copy(p.node.position)
        a.position.y += (p.loose ? 0.2 : 0.32) + (n % 3) * 0.15
      }
    })

    if (roast.basket) settleBasket(dt)

    // smoke rises once food over the coals starts to cook through (fat and juices dripping onto the charcoal):
    // none from a bare fire, more with every done piece, most when it's charring
    if (smoke) {
      let s = 0
      for (const p of pieces.current) {
        if (!present(p) || p.collected || waiting(p)) continue
        const r = p.progress / roast.times[p.id]
        s += THREE.MathUtils.smoothstep(r, 0.7, 1.1) * 0.3 + THREE.MathUtils.smoothstep(r, 1.5, 2.5) * 0.3
      }
      const want = Math.min(1, s) * Math.min(1, (fire?.current ?? 0.55) * 1.5)
      smoke.current += (want - smoke.current) * Math.min(1, dt * 0.8)
    }

    since.current += delta
    if (since.current < 0.25) return
    since.current = 0
    // keep as many plates out as the food on them needs (always at least one)
    let need = 1
    let needBaskets = 1
    let needDishes = 1
    const cap = roast.basket?.capacity ?? 10
    for (const p of pieces.current) {
      if (p.slot === null || p.eaten || !present(p)) continue
      if (inBasket(p)) needBaskets = Math.max(needBaskets, Math.floor(p.slot / cap) + 1)
      else if (onDish(p)) needDishes = Math.max(needDishes, Math.floor(p.slot / roast.dish!.capacity) + 1)
      else need = Math.max(need, Math.floor(p.slot / PER_PLATE) + 1)
    }
    if (need !== plateCount) setPlateCount(need)
    if (needBaskets !== basketCount) setBasketCount(needBaskets)
    if (needDishes !== dishCount) setDishCount(needDishes)
    // skewers off the fire (for the fire's limit), and potatoes still around (for the basket's)
    const off = pieces.current.filter((p) => p.collected && present(p) && !p.loose).length
    const loose = pieces.current.filter((p) => inBasket(p) && present(p) && !p.eaten).length
    if (off * 1000 + loose !== lastOff.current) {
      lastOff.current = off * 1000 + loose
      onOffFire?.(off, loose)
    }
    const next: { key: string; id: string; state: TagState }[] = []
    for (const p of pieces.current) {
      if (!present(p) || p.collected || (roast.net?.includes(p.id) && p.netSpot === null)) continue
      const r = p.progress / roast.times[p.id]
      const s = stageOf(r)
      next.push({ key: p.key, id: p.id, state: { stage: s.key, label: s.label, pct: Math.round(Math.min(1, r) * 20) / 20 } })
    }
    const k = JSON.stringify(next)
    if (k !== lastTags.current) {
      lastTags.current = k
      setTags(next)
    }
  })

  const byKey = (key: string) => pieces.current.find((p) => p.key === key)

  return (
    <>
      {Array.from({ length: plateCount }, (_, n) => (
        <Plate key={n} container={`plate-${n}`} position={plateAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.basket && Array.from({ length: basketCount }, (_, n) => (
        <Basket key={n} container={`basket-${n}`} position={basketAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.dish && Array.from({ length: dishCount }, (_, n) => (
        <SideDish key={n} container={`dish-${n}`} position={dishAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.bin && <Bin container="bin" position={containerAt('bin').toArray() as [number, number, number]} />}
      {/* salt is taken with the fingers: a pinching hand follows the pinch while it's carried */}
      {saltInHand && (
        <group ref={hand}>
          <Html center zIndexRange={[40, 30]} style={{ pointerEvents: 'none' }}><PinchHand /></Html>
        </group>
      )}
      <points geometry={grains.geometry} material={grainMaterial} frustumCulled={false} renderOrder={3} />
      {active && toolLabel && (
        <Html position={toolLabel.at} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
          <span className="tool-tag">{TOOL_NAMES[toolLabel.kind]}<small>拖到食物上</small></span>
        </Html>
      )}
      {wisps.map((w) => (
        <Wisp key={w.key} at={w.at} onDone={() => setWisps((all) => all.filter((x) => x.key !== w.key))} />
      ))}
      {active && tags.map(({ key, id, state }) => (
        <group key={key} ref={(g) => { anchors.current[key] = g }}>
          <Html center zIndexRange={[30, 10]}>
            <button type="button"
              className={`roast-tag roast-${state.stage}${hoveredKey === key ? ' roast-tag-lit' : ''}`}
              aria-label={`${roast.names[id]}，${state.label}，點一下放到盤子上`}
              onClick={() => { const p = byKey(key); if (p) collect(p) }}>
              <svg className="roast-ring" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="8" className="roast-ring-track" />
                <circle cx="10" cy="10" r="8" className="roast-ring-fill" pathLength={100}
                  strokeDasharray={`${state.pct * 100} 100`} />
              </svg>
              <span className="roast-name">{roast.names[id]}</span>
              <span className="roast-state">{state.label}</span>
            </button>
          </Html>
        </group>
      ))}
    </>
  )
}
