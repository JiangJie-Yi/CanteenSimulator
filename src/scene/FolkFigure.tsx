import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GUEST_FACES, LOOKS, guestFaceStrip, guestFrame, type FaceKind, type GuestFace } from './faceSheet'
import { faceNow, newFaceLife, type FaceLife } from '@/game/faceLife'
import { GAZE, LATE } from '@/game/shopState'
/** (where one's looking at a thing in the room, worked out) */
const GZ_P = new THREE.Vector3()
/** how tall each shape stands in its own units, its copies sharing its position data (the key); and a vector for the world's scale on one */
const TALL_OF = new WeakMap<object, number>()
const TALL_SCALE = new THREE.Vector3()
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { BOWL_LIFT } from './bowlLift'
import { SOFT_DOT } from './softDot'
import { footDust, newSteps } from './DustPuffs'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { KINDS as GUEST_KINDS, kindOf, type GuestKind } from '@/data/guests'
import { airbrush, gradientMap, hash, lookOf } from './Person3D'
import { cloneFigure, paintable, releaseFigure, rigidFigure, thinWithFade, type SkinPiece } from './rigidSkin'
import { bakeable, colourVertices } from './StaticBatch'
import { cloth } from './patterns'
import type { Mood } from './people'
import { warmLater } from './Prewarm'

/*
 * A customer in the boss's style (blender/folk.py: public/models/folk.glb): an Overcooked cook's big round head on a short plump body, no
 * legs, floating mitten hands, the boss's height; low in faces and shaded smooth, the detail painted. What they wear is a picture round the
 * body (textures/folk/outfit_<kind>_<n>.jpg), their face a picture over the front of the head, one of eight expressions in a strip
 * (textures/folk/face_<type>.png: as they are, blinking, delighted, cross, sad, chewing, talking, surprised), slid along to the one they
 * show; their hair one of a dozen styles, and what some of them have about them (glasses, a hat, headphones, a randoseru...) shown as
 * their kind has it. Skin and hair in their own colours (lookOf, as the old figures had them).
 *
 * Each combination of hair and things about them is put together once and copied for each customer: all of it one mesh in one material
 * (scene/rigidSkin: two draws a customer, the owner's; they were 13 to 24), each vertex painted from its colour alone, the clothes' picture,
 * the face's strip (over the skin's colour, slid along to the expression) or the knit's, moved in parts by the groups that move them (the
 * body, the head, each hand, the chopsticks and their bite, the phone, the briefcase in hand and by the stool, each scaled to nothing while
 * it's not shown), its ink one line round its inked pieces; each customer their own colours over the shared shape, and their own material
 * (their clothes, their face, so they can fade alone).
 * Sat, the round body sits up on the stool's seat; walking, it waddles; eating, the chopsticks in the right hand go from the plate to the mouth.
 */
const URL = import.meta.env.BASE_URL + 'models/folk.glb'
const TEX = import.meta.env.BASE_URL + 'textures/folk/'
type FaceType = 'male' | 'female' | 'elder' | 'kid'
/** their faces (scene/faceSheet's strip, two rows of eight since item 368): the expression's place on it */
type Expr = GuestFace

/** how each kind wears its hair (one picked by id) and what it has about it */
const HAIR: Record<GuestKind, string[]> = {
  salaryman: ['part', 'crop'], officeLady: ['bob', 'bunLow'], schoolgirl: ['twin', 'long', 'pony'], schoolboy: ['crop', 'spiky'],
  grandma: ['perm'], grandpa: ['bald'], kid: ['kid'], uncle: ['crop', 'bald'], collegeStudent: ['crop', 'spiky'], yukataLady: ['bunHigh'],
  delinquent: ['pomp'], bosozoku: ['pomp', 'spiky'], foreignTourist: ['crop', 'pony'], civilServant: ['part'], maidCoser: ['twin', 'long'], gyaru: ['gyaru'],
  // (item 377: those in a hat with their hair cropped under it)
  housewife: ['bob', 'bunLow', 'pony'], taxiDriver: ['crop'], nurse: ['bunLow', 'bob', 'pony'], constructionWorker: ['crop'], marketWorker: ['crop', 'bald'],
  bandman: ['long', 'spiky'], offShiftChef: ['crop'],
}
const ACC: Partial<Record<GuestKind, string[]>> = {
  kid: ['schoolhat', 'randoseru'], uncle: ['moustache', 'towel'], grandpa: ['moustache'], grandma: ['shawl'], collegeStudent: ['backpack'],
  yukataLady: ['obibow', 'kanzashi'], delinquent: ['collar'], schoolboy: ['collar'], bosozoku: ['hachimaki'], foreignTourist: ['sunhat', 'camera'],
  maidCoser: ['maidcap'], gyaru: ['hoops'],
  // (item 377: the mother's shopping bag and its leek, the taxi driver's cap, the hard hat, the market hand's cap, the guitar, the cook's band)
  housewife: ['ecobag'], taxiDriver: ['drivercap'], constructionWorker: ['hardhat', 'towel'], marketWorker: ['cap', 'towel'], bandman: ['guitar'],
  offShiftChef: ['chefband'],
}
const FEMALE = new Set<GuestKind>(['officeLady', 'schoolgirl', 'yukataLady', 'maidCoser', 'gyaru', 'housewife', 'nurse'])
/** what's worn on the head (turns with it) */
const ON_HEAD = new Set(['glasses', 'moustache', 'phones', 'sunhat', 'schoolhat', 'maidcap', 'hachimaki', 'hoops', 'kanzashi', 'hardhat', 'drivercap', 'cap', 'chefband'])
/** where the head turns from (the neck), in the model's frame */
const NECK = new THREE.Vector3(0, 0.56, 0)
const REST = { L: new THREE.Vector3(-0.31, 0.26, 0.05), R: new THREE.Vector3(0.31, 0.26, 0.05) }
/**
 * The pair of chopsticks in a customer's hand while they eat: the bar's own lacquered ones, picked up off their rest (the owner's: they ate with
 * none to be seen, the pair on the rest untouched; the brown sticks in their fist pointed back into them): black over the top third, a fine
 * gold band, deep red to the tips, along +y from well behind the grip to the tips, coming together toward them: their black ends standing out
 * of the round fist (held at a quarter of their length they were all inside it, a red stick under the hand being all there was to see). One
 * shape for every customer, its colours in its vertices; a bite at the tips going up to the mouth.
 */
const CHOP_LEN = 0.3
const CHOP_GRIP = 0.13
const CHOP_GEO = (() => {
  const parts: THREE.BufferGeometry[] = []
  const y0 = -CHOP_GRIP, y1 = CHOP_LEN - CHOP_GRIP, third = y0 + CHOP_LEN / 3
  const r = (y: number) => 0.0062 - (0.0032 * (y - y0)) / CHOP_LEN
  const SIDES = 6
  // (a band of a stick: an open six-sided tube from a to b, its colour in its vertices; the back end shut by a cap fanned from its rim (no
  // point in its middle), the tips left open (3 mm across): 40 triangles a stick, they were 72)
  const band = (a: number, b: number, c: string, shut: boolean) => {
    const pos: number[] = [], nrm: number[] = [], idx: number[] = []
    for (const y of [a, b]) for (let k = 0; k < SIDES; k++) {
      const t = (k / SIDES) * Math.PI * 2
      pos.push(Math.cos(t) * r(y), y, Math.sin(t) * r(y))
      nrm.push(Math.cos(t), 0, Math.sin(t))
    }
    for (let k = 0; k < SIDES; k++) {
      const k1 = (k + 1) % SIDES
      idx.push(k, k1 + SIDES, k1, k, k + SIDES, k1 + SIDES)
    }
    if (shut) {
      const o = pos.length / 3
      for (let k = 0; k < SIDES; k++) {
        const t = (k / SIDES) * Math.PI * 2
        pos.push(Math.cos(t) * r(a), a, Math.sin(t) * r(a))
        nrm.push(0, -1, 0)
      }
      for (let k = 1; k < SIDES - 1; k++) idx.push(o, o + k, o + k + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
    g.setIndex(idx)
    const cc = new THREE.Color(c), n = pos.length / 3, col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([cc.r, cc.g, cc.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }
  for (const sd of [-1, 1]) {
    for (const g of [band(y0, third, '#151112', true), band(third, third + 0.007, '#d9b04a', false), band(third + 0.007, y1, '#7c2a1e', false)]) {
      g.rotateZ(sd * 0.034)
      g.translate(sd * 0.0075, 0, 0)
      parts.push(g)
    }
  }
  const all = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return all
})()
const BITE_GEO = new THREE.OctahedronGeometry(0.014, 0)
/** where the chopsticks' tips go, in the figure's frame: down to their plate on the bar in front of them (measured: the bar's top 0.3 up from
 * the seat, the plate 0.72 out), or up to the mouth (the head's middle 0.8 up, blender/folk.py's C) */
const CHOP_PLATE = new THREE.Vector3(-0.03, 0.3, 0.72)
/** reaching their own plate (the owner's, 2026-11-10: the tips stopped short of the food, a grandmother picking at the air): the right
 * shoulder, in the body's frame, and how far the arm reaches from it; the chopsticks' tips beyond the hand (in it a little: the tips in the
 * food); how far forward they lean in at most when it's further */
// (their hands are round mitts with no arm drawn to them: one goes as far as it must, and the body leans in past the arm's own reach)
const SHOULDER_R = new THREE.Vector3(-0.2, 0.6, 0.08)
const ARM = 0.42
const ARM_MOST = 0.66
const TIP_IN = (CHOP_LEN - CHOP_GRIP) * 0.93
const LEAN_MAX = 0.32
const REACH = new THREE.Vector3()
/** a sip: the hand at the drink on the bar (from its foot up to where it's held), at the mouth with a bottle or can (tipped up, its top at the
 * lips) or with a sake cup (nearer, tipped less); with no drink to go to, just out in front */
const SIP_AT = new THREE.Vector3()
const SIP_GRIP = new THREE.Vector3(0, 0.06, 0)
const SIP_REST = new THREE.Vector3(-0.12, 0.36, 0.42)
const SIP_MOUTH = new THREE.Vector3(-0.03, 0.74, 0.36)
const SIP_MOUTH_CUP = new THREE.Vector3(-0.02, 0.68, 0.33)
const REACH_U = new THREE.Vector3()
const CHOP_MOUTH = new THREE.Vector3(0, 0.7, 0.26)
/** a bite's places for the hand with the chopsticks, in the body's frame (item 242): at the food (found each frame, BITE_FOOD; with no plate
 * known, out in front), up by the mouth (out in front of it: right at it the sticks went into the head), and resting between bites, a little
 * up and back from the food toward the mouth, the tips over the plate */
const BITE_FOOD = new THREE.Vector3()
const BITE_FRONT = new THREE.Vector3(-0.07, 0.38, 0.5)
const BITE_MOUTH = new THREE.Vector3(-0.15, 0.64, 0.36)
const BITE_REST = new THREE.Vector3()
const BITE_UP = new THREE.Vector3(0, 0.05, 0)
/** a mouthful of miso soup (item 345), in the body's frame: the bowl's middle with nothing on the bar to go to, at the mouth (a little out in
 * front of it and below, the rim at the lips), where the right hand and the left hold it from its middle; the bowl's foot is that far under
 * its middle (its place on the bar is its foot) */
/** the anger mark (怒りマーク, item 347): four red veins bulging toward a middle, white-edged, drawn, not a character; the steam's puffs soft
 * white dots; both drawn as sprites facing the camera, their program made at load */
const VEIN_TEX = (() => {
  if (typeof document === 'undefined') return null
  const n = 64, c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  g.lineCap = 'round'
  for (const [w, col] of [[11, '#ffffff'], [6, '#d4253a']] as const) {
    g.strokeStyle = col
    g.lineWidth = w
    // (four veins, one in each corner, each the quarter of a circle nearest the middle: together a star of four points with its sides
    // curved in, mirrored left to right and top to bottom (never turning one way round: drawn so, it read as a 卍))
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
      const cx = 32 + sx * 17, cy = 32 + sy * 17
      const a0 = Math.atan2(0, -sx), a1 = Math.atan2(-sy, 0)
      g.beginPath()
      // (the short way round from the one to the other, a gap left at each point)
      const d = ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
      g.arc(cx, cy, 14, a0 + d * 0.1, a0 + d * 0.9, d < 0)
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
// (drawn over everything, as an emote is: by the head it stood inside the hair and was never seen)
const VEIN_MAT = new THREE.SpriteMaterial({ map: VEIN_TEX, transparent: true, depthWrite: false, depthTest: false })
const PUFF_MAT = new THREE.SpriteMaterial({ map: SOFT_DOT, color: '#f6f3ee', transparent: true, depthWrite: false, depthTest: false, opacity: 0.85 })
if (typeof document !== 'undefined') { const g = new THREE.Group(); g.add(new THREE.Sprite(VEIN_MAT), new THREE.Sprite(PUFF_MAT)); warmLater(g) }
const SOUP_REST = new THREE.Vector3(0.05, 0.36, 0.46)
const SOUP_MOUTH = new THREE.Vector3(-0.01, 0.6, 0.3)
const SOUP_GRIP_R = new THREE.Vector3(-0.075, 0.015, 0)
const SOUP_GRIP_L = new THREE.Vector3(0.05, -0.035, 0.01)
const SOUP_UP = new THREE.Vector3(0, 0.03, 0)
const SOUP_AT = new THREE.Vector3(), BOWL_C = new THREE.Vector3(), BOWL_SIDE = new THREE.Vector3()
const BOWL_DOWN = new THREE.Vector3(0, -0.035, 0), BOWL_TIP = new THREE.Quaternion()
/** how a hand, the lean and the head follow where they're to be: so much of the way a second, the same whatever the frame rate (item 242: a
 * share of it each frame, dt x 10, which at double speed or on a slow frame was all of it at once) */
const follow = (dt: number, rate: number) => 1 - Math.exp(-dt * rate)
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
/** where they sit on the stool, in the customers' frame (blender/stools.py: its oak seat's top, 0.29, and on the cushion, pressed down) */
export const SEAT = 0.31
/** how long getting up onto a stool's seat or down off it takes (s) (item 242) */
const SIT_T = 0.32
/** (their wipe's first part, the reach down to the drawer for a tissue (ms): the bar's TISSUE_REACH_MS, which scene/ can't import) */
const WIPE_REACH_MS = 800
/** how tall the figure stands, to the top of its head (blender/folk.py: the head's top), in its own frame */
export const FOLK_HEIGHT = 1.07
/** parts with no ink line round them (by their material: the face's picture, the glasses' frames, gold, the little red ties and flowers; the
 * randoseru's piping, its silver and the light on it) */
const UNINKED = /FolkFrame|FolkGold|FolkRed|FolkBagTrim|FolkSilver|FolkGloss|FolkGuitarTop|FolkGuitarRing|FolkGuitarHole|FolkGuitarBoard/
/** parts drawn flat, unlit, as they're coloured (the light caught on the randoseru's leather: its gloss painted, the figure one toon material) */
const FLAT = /FolkGloss/
/** which picture a vertex is painted from (its `paint`'s z): its colour alone, the clothes', the face's strip over the skin's colour, the knit's */
const PIC = { none: 0, outfit: 1, face: 2, knit: 3 } as const
/** the parts that move, in the order the vertices name them: the body, the head and the hands, what's in the hands, the briefcase by the stool */
const FOLK_BONES = ['body', 'head', 'handL', 'handR', 'chop', 'bite', 'phone', 'carried', 'parked'] as const

/** in development, ?hair=<style> puts every customer in that hairstyle, to look at it */
const FORCE_HAIR = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hair') : null

export type FolkSpec = { kind: GuestKind; hair: string; acc: string[]; face: FaceType; outfit: string; size: number; skin: string; hairColor: string
  top: string; briefcase: boolean
  /** which of their face type's designs their face is (scene/faceSheet's LOOKS; item 466, the owner's 「你的臉都豆子臉??」) */
  faceLook: number }
/** a customer's face's picture's name: their face type's, and its design's number after it but for the first */
export const faceKey = (s: Pick<FolkSpec, 'face' | 'faceLook'>) => `face_${s.face}${s.faceLook ? `_${s.faceLook}` : ''}`
/** how this customer looks: their kind's hair and things, their colours */
export function folkSpec(id: number): FolkSpec {
  const kind = kindOf(id).kind
  const l = lookOf(id, kind)
  const hairs = HAIR[kind]
  const hair = FORCE_HAIR ?? hairs[Math.floor(hash(id, 31) * hairs.length) % hairs.length]
  const acc = [...(ACC[kind] ?? [])]
  // (glasses and headphones as the old figures had them)
  if (kind === 'grandpa' || (kind === 'salaryman' && id % 3 === 0) || (kind === 'collegeStudent' && id % 2 === 0) || (kind === 'civilServant' && id % 2 === 1)
    || (kind === 'taxiDriver' && id % 3 === 0) || (kind === 'nurse' && id % 4 === 1) || (kind === 'offShiftChef' && id % 4 === 2)) acc.push('glasses')
  if (kind === 'collegeStudent' && hash(id, 23) < 0.34) acc.push('phones')
  const face: FaceType = kind === 'kid' ? 'kid' : kind === 'grandma' || kind === 'grandpa' ? 'elder'
    : FEMALE.has(kind) || (kind === 'foreignTourist' && hair === 'pony') ? 'female' : 'male'
  // (item 377, the owner's 「服裝樣式也多變些」: each kind two ways of dressing (its pictures 0 and 1, 2 and 3), each in two colours)
  const style = hash(id, 41) < 0.5 ? 0 : 2
  // (dressed as a shrine maiden, no maid's frilled cap)
  if (kind === 'maidCoser' && style === 2) acc.splice(acc.indexOf('maidcap'), 1)
  return { kind, hair, acc, face, outfit: `outfit_${kind}_${style + (id % 2)}`, size: l.size, skin: l.skin, hairColor: l.hair, top: l.top,
    briefcase: (kind === 'salaryman' && id % 2 === 0) || kind === 'civilServant', faceLook: Math.floor(hash(id, 59) * LOOKS[face].length) % LOOKS[face].length }
}

/** the pictures: every kind's clothes (two ways, two colours each: item 377) and the four faces, loaded together before any customer's drawn */
const KINDS: GuestKind[] = GUEST_KINDS.map((k) => k.kind)
const PICTURES = [...KINDS.flatMap((k) => [0, 1, 2, 3].map((n) => `outfit_${k}_${n}`)), 'face_male', 'face_female', 'face_elder', 'face_kid', 'outfit_normal']
/** the clothes' folds and weave as a normal map (item 375, blender/folk.py's fold_normals): one for every customer's clothes, set as the
 * pictures load, on every customer's material (one program for them all) */
const FOLD_N: { t: THREE.Texture | null } = { t: null }
// (the clothes JPEGs (item 347: at twice the pixels, PNGs were four times the bytes), the faces PNGs (their strip's painted afresh anyway))
const PICTURE_URLS = PICTURES.map((n) => TEX + n + (n.startsWith('outfit_') && n !== 'outfit_normal' ? '.jpg' : '.png'))
const prepared = new WeakSet<THREE.Texture>()
const otherFaces = new Map<string, THREE.Texture>()
/** a face type's other design's strip, as a picture set up as the loaded faces are */
function otherFace(kind: FaceKind, n: number) {
  const key = `${kind}_${n}`
  let t = otherFaces.get(key)
  if (!t) {
    t = new THREE.CanvasTexture(guestFaceStrip(kind, n))
    t.colorSpace = THREE.SRGBColorSpace
    t.flipY = false
    t.anisotropy = 4
    otherFaces.set(key, t)
  }
  return t
}
function usePictures() {
  const list = useLoader(THREE.TextureLoader, PICTURE_URLS)
  return useMemo(() => {
    const out = new Map<string, THREE.Texture>()
    list.forEach((t, i) => {
      if (!prepared.has(t)) {
        prepared.add(t)
        t.colorSpace = THREE.SRGBColorSpace
        // (as glTF has it: the picture's top row at the top of the UVs)
        t.flipY = false
        t.anisotropy = 4
        if (PICTURES[i].startsWith('outfit')) t.wrapS = THREE.RepeatWrapping
        // (the folds' normal map: data, not a colour)
        if (PICTURES[i] === 'outfit_normal') { t.colorSpace = THREE.NoColorSpace; FOLD_N.t = t }
        // (the faces painted afresh, as the owner's and the staff's are (scene/faceSheet: Overcooked's bold eyes, brows and mouths), in the
        // file's strip of eight and its order)
        if (PICTURES[i].startsWith('face_')) (t as THREE.Texture<unknown>).image = guestFaceStrip(PICTURES[i].slice(5) as FaceKind)
        t.needsUpdate = true
      }
      out.set(PICTURES[i], t)
    })
    // (each face type's other designs (item 466): their strips painted as the first's are, made once for the page)
    for (const kind of ['male', 'female', 'elder', 'kid'] as const) for (let n = 1; n < LOOKS[kind].length; n++) out.set(`face_${kind}_${n}`, otherFace(kind, n))
    return out
  }, [list])
}

/** where in the one mesh the skin or the hair is (its vertices from `start`, `count` of them), coloured for each customer */
type Tint = { start: number; count: number; tint: 'skin' | 'hair' }
type Template = { root: THREE.Group; tints: Tint[] }
const templates = new Map<string, Template>()

/**
 * A customer's own material: toon light with the people's airbrush, its vertices' paint (scene/rigidSkin), and three pictures picked by it:
 * the clothes' (`map`), the face's strip (slid along by `faceOffset`, laid over the skin's colour by its own alpha: no see-through sheet,
 * so its soft edges stay soft), the knit's (tiled as it says). Made fresh for each, its uniforms its own.
 */
function folkMaterial(outfit: THREE.Texture | null, face: THREE.Texture | null, knit: THREE.Texture | null) {
  const u = { faceMap: { value: face }, faceOffset: { value: new THREE.Vector2() }, knitMap: { value: knit }, knitRepeat: { value: knit?.repeat ?? new THREE.Vector2(1, 1) } }
  // (hashed from the start, so a fade (theirs as they come in and go) only moves its opacity: switched on and off for each, the last fade
  // over let the hashed program go and the next one linked it again, a hitch at every customer's coming and going; at full opacity nothing's
  // cut)
  const m = paintable(airbrush(new THREE.MeshToonMaterial({ color: '#ffffff', map: outfit, vertexColors: true, gradientMap, alphaHash: true,
    // (the clothes' folds and weave in the light (item 375): on the clothes alone, below)
    ...(FOLD_N.t ? { normalMap: FOLD_N.t, normalScale: new THREE.Vector2(1, 1) } : {}) })))
  m.userData.hashed = true
  const before = m.onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r)
    Object.assign(sh.uniforms, u)
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D faceMap;\nuniform vec2 faceOffset;\nuniform sampler2D knitMap;\nuniform vec2 knitRepeat;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  if (vPaint.z > 0.5 && vPaint.z < 1.5) diffuseColor *= texture2D(map, vMapUv);
  else if (vPaint.z > 2.5) diffuseColor *= texture2D(knitMap, vMapUv * knitRepeat);
#endif`)
      // (the face over the skin once the skin's colour and the airbrush are in (the face's own colours not shaded by them, as its own sheet
      // had them), its faintest edges cut as they were (that sheet's alpha test))
      // (the folds' normal map on the clothes alone (their paint's 1): the face and the head, on the same UVs' other pictures, left smooth)
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP_TANGENTSPACE
  if (vPaint.z > 0.5 && vPaint.z < 1.5) {
    vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale;
    normal = normalize( tbn * mapN );
  }
#endif`)
      .replace('#include <alphamap_fragment>', `#ifdef USE_MAP
  if (vPaint.z > 1.5 && vPaint.z < 2.5) { vec4 fc = texture2D(faceMap, vec2(vMapUv.x + faceOffset.x, vMapUv.y * 0.5 + faceOffset.y)); diffuseColor.rgb = mix(diffuseColor.rgb, fc.rgb, fc.a < 0.35 ? 0.0 : fc.a); }
#endif
#include <alphamap_fragment>`)
  }
  const key = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${key()}|folk`
  return { material: m, face: u.faceOffset }
}

/** what's held in the hands, at rest in its part's own frame: the chopsticks, their bite, the phone (its screen lit), the briefcase */
function heldShapes(briefcase: boolean): { part: (typeof FOLK_BONES)[number]; geo: THREE.BufferGeometry; colour?: string; flat?: boolean; inked?: boolean }[] {
  const at = (g: THREE.BufferGeometry, m: THREE.Matrix4) => { g.applyMatrix4(m); return g }
  const out: { part: (typeof FOLK_BONES)[number]; geo: THREE.BufferGeometry; colour?: string; flat?: boolean; inked?: boolean }[] = [
    { part: 'chop', geo: CHOP_GEO!.clone() },
    { part: 'bite', geo: BITE_GEO.clone(), colour: '#c8743a' },
    { part: 'phone', geo: new THREE.BoxGeometry(0.06, 0.11, 0.009), colour: '#22252a' },
    { part: 'phone', geo: at(new THREE.PlaneGeometry(0.052, 0.096), new THREE.Matrix4().makeTranslation(0, 0, -0.005).multiply(new THREE.Matrix4().makeRotationY(Math.PI))), colour: '#b8e2ff', flat: true },
  ]
  if (briefcase) {
    // (as Person3D's Briefcase: its handle, its body (inked), two latches; in hand as it hangs, by the stool stood on its end)
    const bag = (): { geo: THREE.BufferGeometry; colour: string; inked?: boolean }[] => [
      { geo: at(new THREE.TorusGeometry(0.012, 0.003, 3, 6, Math.PI), new THREE.Matrix4().makeTranslation(0, 0.012, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))), colour: '#1a1410' },
      { geo: at(new THREE.BoxGeometry(0.028, 0.1, 0.14), new THREE.Matrix4().makeTranslation(0, 0.065, 0)), colour: '#2a1e16', inked: true },
      ...[-0.035, 0.035].map((z) => ({ geo: at(new THREE.BoxGeometry(0.031, 0.012, 0.014), new THREE.Matrix4().makeTranslation(0, 0.024, z)), colour: '#c8b070' })),
    ]
    for (const b of bag()) out.push({ part: 'carried', ...b })
    for (const b of bag()) out.push({ part: 'parked', ...b, geo: at(b.geo, new THREE.Matrix4().makeTranslation(0, 0.105, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI))) })
  }
  return out
}

/** one combination of hair, things and a briefcase or not, put together and inked once */
function template(scene: THREE.Group, hair: string, acc: string[], briefcase: boolean): Template {
  const key = `${hair}|${[...acc].sort().join(',')}|${briefcase}`
  const hit = templates.get(key)
  if (hit) return hit
  scene.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
  const keep = (n: string) => n === 'FolkBody' || n === 'FolkHead' || n === 'FolkFace' || n === 'FolkHandL' || n === 'FolkHandR'
    || n === `Folk_hair_${hair}` || acc.some((a) => n === `Folk_acc_${a}`)
  const partOf = (n: string) => n === 'FolkHandL' ? 'handL' : n === 'FolkHandR' ? 'handR'
    : n === 'FolkHead' || n === 'FolkFace' || n.startsWith('Folk_hair_') || (n.startsWith('Folk_acc_') && ON_HEAD.has(n.slice(9))) ? 'head' : 'body'
  // ---- the parts' groups, at the places they're moved about
  const root = new THREE.Group()
  const groups = new Map<string, THREE.Group>()
  const group = (name: (typeof FOLK_BONES)[number], parent: THREE.Object3D, at?: THREE.Vector3) => {
    const g = new THREE.Group()
    g.name = name
    if (at) g.position.copy(at)
    parent.add(g)
    groups.set(name, g)
    return g
  }
  const body = group('body', root)
  group('head', body, NECK)
  const handL = group('handL', body, REST.L)
  const handR = group('handR', body, REST.R)
  const chop = group('chop', handL)
  const bite = group('bite', chop, new THREE.Vector3(0, CHOP_LEN - CHOP_GRIP - 0.01, 0))
  bite.scale.set(1, 0.7, 0.8)
  const phone = group('phone', handR, new THREE.Vector3(0, 0.05, 0.02))
  phone.rotation.x = -0.3
  const carried = group('carried', handR, new THREE.Vector3(0, 0, 0.02))
  carried.rotation.z = Math.PI
  carried.scale.setScalar(1.4)
  group('parked', root)
  root.updateMatrixWorld(true)
  const bones = FOLK_BONES.map((n) => groups.get(n)!)
  // ---- every piece of the figure in its frame, with its part, its picture or its colour, inked or not, shadowed or not
  const pieces: (SkinPiece & { tint?: 'skin' | 'hair' })[] = []
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    // (a part's own node, or a primitive under it: named for the node)
    const named = mesh.name.startsWith('Folk') ? mesh.name : mesh.parent?.name ?? ''
    const n = named.replace(/_\d+$/, '')
    if (!keep(n)) return
    const part = partOf(n)
    const src = mesh.material as THREE.MeshStandardMaterial
    const geo = bakeable(mesh.geometry, new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
    const tint = src.name === 'FolkSkin' || src.name === 'FolkFace' ? 'skin' : src.name === 'FolkHair' ? 'hair' : undefined
    const pic = src.name === 'FolkBody' ? PIC.outfit : src.name === 'FolkFace' ? PIC.face : src.name === 'FolkKnit' ? PIC.knit : PIC.none
    // (the clothes' picture white under it; the knit over its own colour, as its material had it; the plain ones' colours, the gold's too, in
    // their vertices)
    colourVertices(geo, pic === PIC.outfit ? new THREE.Color('#ffffff') : src.name === 'FolkGold' ? new THREE.Color('#e0b040') : src.color)
    // (the head takes no shadows: the shop's one shadow map is too coarse for a face, and the hair's and the hat's fell on it in blotches and
    // streaks; its toon light shades it)
    pieces.push({ geo, bone: FOLK_BONES.indexOf(part), inked: !UNINKED.test(src.name) && !UNINKED.test(named), pic, tint, shadowless: part === 'head',
      flat: FLAT.test(src.name) })
  })
  for (const h of heldShapes(briefcase)) {
    const b = groups.get(h.part)!
    const geo = bakeable(h.geo, b.matrixWorld)
    h.geo.dispose()
    if (h.colour) colourVertices(geo, new THREE.Color(h.colour))
    pieces.push({ geo, bone: FOLK_BONES.indexOf(h.part), inked: !!h.inked, flat: h.flat })
  }
  // (where the skin and hair fall in the one mesh, by the order its pieces go in)
  const tints: Tint[] = []
  let start = 0
  for (const p of pieces) {
    const k = p.geo.attributes.position.count
    if (p.tint) tints.push({ start, count: k, tint: p.tint })
    start += k
  }
  const { mesh } = rigidFigure(root, pieces, folkMaterial(null, null, null).material, bones, 0.006)
  for (const p of pieces) p.geo.dispose()
  mesh.name = 'FolkMesh'
  mesh.castShadow = true
  mesh.receiveShadow = true
  // (what's held starts put away)
  for (const n of ['chop', 'bite', 'phone', 'carried', 'parked']) groups.get(n)!.scale.setScalar(0)
  const t = { root, tints }
  templates.set(key, t)
  return t
}

/**
 * One customer made with the page and never shown: their program (the customers' material on their skinned figure) linked while the page
 * loads (scene/Prewarm), not when the first one comes in (a hitch of a tenth of a second or more), and kept (this one's material is never
 * let go), so it isn't let go and linked again when the shop has emptied and the next one comes.
 */
const folkWarmed = new WeakSet<object>()
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const FolkWarm = memo(FolkWarmImpl)
function FolkWarmImpl() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const pictures = usePictures()
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    // (once for the page: the bar mounted again (or twice, in development) makes no more of it)
    if (folkWarmed.has(gltf.scene)) return
    folkWarmed.add(gltf.scene)
    // (every face's strip, every design of it (item 466), sent to the GPU now, not as the first customer with that face comes in)
    for (const [k, t] of pictures) if (k.startsWith('face_')) gl.initTexture(t)
    const spec = folkSpec(0)
    const root = cloneFigure(template(gltf.scene, spec.hair, spec.acc, spec.briefcase).root) as THREE.Group
    const mesh = root.getObjectByName('FolkMesh') as THREE.SkinnedMesh
    mesh.material = folkMaterial(pictures.get(spec.outfit) ?? null, pictures.get(faceKey(spec)) ?? null, null).material
    warmLater(root)
  }, [gltf, pictures, gl])
  return null
}

/**
 * A customer, as Person3D's Person has them (the same props): sat on their stool or walking, eating, talking to the one they came with,
 * passing the time (looking about, at their phone, chin in hand), their mood on their face, a hop of delight when their food comes,
 * fading as they go; `fit`: their size in the frame they're drawn in (the boss's height there).
 */
// (item 374: drawn again only when its own props change: what it does frame by frame it reads through its callbacks)
export const FolkFigure = memo(FolkFigureImpl)
function FolkFigureImpl({ id, eating, walking, still, clock, talk = 0, mood = null, fade, pose, held, fit = 1, ground = false, plate, sip, drinkAt, heldShown, cup = false, bite, soup, soupAt, soupKey, fume }: {
  id: number; eating: boolean; walking: boolean; still?: () => boolean; clock?: { current: number }; talk?: number; mood?: Mood | null
  fade?: () => number; slippers?: () => boolean; pose?: string; held?: ReactNode; fit?: number
  /** (sat eating) where their food is, in the world: their plate's middle, for the chopsticks to come down on */
  plate?: () => THREE.Vector3 | null
  /** (sat with a drink) how far into a sip they are (0 to 1; below 0, not sipping), and where their drink stands on the bar, in the world:
   * a sip is the hand out to it, up to the mouth with it, drunk, and back down (the owner's, 2026-11-10: it was never drunk); and whether
   * what's in their hand is showing (a drink in hand only while it's up off the bar) */
  sip?: () => number
  drinkAt?: () => THREE.Vector3 | null
  heldShown?: () => boolean
  /** (what's sipped is a sake cup: held nearer the mouth and tipped less) */
  cup?: boolean
  /** (sat with a bowl of miso soup at their place, item 345) how far into a mouthful of it they are (0 to 1; below 0, not), where the bowl
   * stands on the bar (the world's), and its key there: as the Japanese drink it, the chopsticks put down, both hands to the bowl (the left
   * under it, the right at its side), up to the mouth, tipped and drunk, and down again; the bowl in their hands meanwhile (scene/bowlLift) */
  soup?: () => number
  soupAt?: () => THREE.Vector3 | null
  soupKey?: string
  /** (sat waiting) how near the end of their patience they are (0..1, item 347): past a half, an anger mark beside the head, pulsing; past
   * seven tenths the cross face; past eight, steam off the top of the head, more as it goes on */
  fume?: () => number
  /** (eating) how far into their dish they are, in bites, a bite taken out of it as each passes x.65 (none known: their own pace) */
  bite?: () => number | undefined
  /** stood on the floor, not sat on a stool's seat, when not walking (the character viewer's turntable: there's no stool there, and sat
   * at the seat's height over it they floated, the briefcase set down by them on the floor) */
  ground?: boolean }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const pictures = usePictures()
  const spec = useMemo(() => folkSpec(id), [id])
  // (their figure: the template's, put together for them (its shapes and ink shared); made while drawing, so nothing in it that must be let
  // go: a copy made and thrown away (React's strict checks make two) leaves nothing behind)
  const fig = useMemo(() => {
    const t = template(gltf.scene, spec.hair, spec.acc, spec.briefcase)
    // (a copy whose one mesh is bound to the copy's own parts)
    const root = cloneFigure(t.root) as THREE.Group
    const get = (n: string) => root.getObjectByName(n) ?? null
    return { root, tints: t.tints, body: get('body')!, head: get('head'), handL: get('handL'), handR: get('handR'), chop: get('chop'), bite: get('bite'),
      phone: get('phone'), carried: get('carried'), parked: get('parked'), mesh: root.getObjectByName('FolkMesh') as THREE.SkinnedMesh,
      face: null as { value: THREE.Vector2 } | null }
  }, [gltf, spec])
  // (their skeleton's picture let go as they go)
  useEffect(() => () => releaseFigure(fig.root), [fig])
  // (their own material (their clothes, their face, their knit; theirs alone, to fade) and their own colours (skin and hair over the shared
  // shape): made as they're shown and let go as they go, the template's put back (in development every customer left a set behind: the copy
  // that was made twice and dropped))
  useLayoutEffect(() => {
    const m = fig.mesh
    const was = m.material
    const { material, face } = folkMaterial(pictures.get(spec.outfit) ?? null, pictures.get(faceKey(spec)) ?? null,
      spec.acc.includes('shawl') ? cloth('knit', '#8a6a9a', [6, 2]) : null)
    m.material = material
    fig.face = face
    const src = m.geometry
    const g = new THREE.BufferGeometry()
    for (const [k, a] of Object.entries(src.attributes)) if (k !== 'color') g.setAttribute(k, a)
    const col = (src.attributes.color as THREE.BufferAttribute).clone()
    const skin = new THREE.Color(spec.skin), hairC = new THREE.Color(spec.hairColor)
    for (const t of fig.tints) {
      const c = t.tint === 'skin' ? skin : hairC
      for (let i = t.start; i < t.start + t.count; i++) col.setXYZ(i, c.r, c.g, c.b)
    }
    g.setAttribute('color', col)
    m.geometry = g
    // (their new material opaque, with no expression yet: their fading and their face set afresh)
    faded.current = 1
    exprNow.current = null
    return () => {
      m.material = was
      m.geometry = src
      for (const k of Object.keys(g.attributes)) if (k !== 'color') g.deleteAttribute(k)
      g.dispose()
      material.dispose()
      fig.face = null
    }
  }, [fig, spec, pictures])

  const heldRef = useRef<THREE.Group>(null)
  // (the anger mark and the steam: on the head, made with the figure, shown as they get cross (item 347))
  const fx = useMemo(() => {
    const g = new THREE.Group()
    const vein = new THREE.Sprite(VEIN_MAT)
    // (up at the head's top corner, out past the hair)
    vein.position.set(0.3, 0.42, 0.1)
    vein.renderOrder = 20
    const puffs = [0, 1, 2].map(() => new THREE.Sprite(PUFF_MAT))
    g.add(vein, ...puffs)
    g.visible = false
    return { g, vein, puffs }
  }, [])
  // (a drink in their hand rides with it: handL is at the figure's -x, which facing +z is its right hand (the chopsticks and a drink in the
  // right, the phone and the briefcase in the left: parts of the one mesh))
  useEffect(() => {
    if (heldRef.current && fig.handL) fig.handL.add(heldRef.current)
    return () => { heldRef.current?.removeFromParent() }
  }, [fig])

  const timeNow = () => clock?.current ?? 0
  // (alone at the counter, passing the time one way and another, each their own pace)
  const spellOf = (t: number) => Math.floor((t + id * 9) / (12 + 18 * hash(id, 7)))
  const [spell, setSpell] = useState(() => spellOf(timeNow()))
  const idle = (['look', 'phone', 'chin', 'phone', 'look', 'chin'] as const)[Math.floor(hash(id, spell) * 6)]
  const showPhone = !walking && !eating && !talk && !pose && idle === 'phone'
  const last = useRef<number | null>(null)
  const served = useRef<{ was: boolean; at: number }>({ was: eating, at: -99 })
  const eatLean = useRef(0)
  const leanWant = useRef(0)
  const faded = useRef(1)
  const look = useRef({ yaw: 0, pitch: 0 })
  const pace = useRef(0)
  // (their footfalls' puffs of dust (scene/DustPuffs), and how tall they stand in the world, measured once)
  const steps = useRef(newSteps())
  const tall = useRef(0)
  const lastPos = useRef<THREE.Vector3 | null>(null)
  const outer = useRef<THREE.Group>(null)
  /** how far up they're lifted, eased to the seat's height as they sit (null till first drawn) */
  const lifted = useRef<number | null>(null)
  /** when their wipe began (performance.now()): its first part the reach down to their drawer for the tissue (item 269) */
  const wipeFrom = useRef<number | null>(null)
  /** up onto the stool or down off it under way: from what height to what, how far through (0..1) (item 242) */
  const sitMove = useRef<{ from: number; to: number; t: number } | null>(null)
  const exprNow = useRef<Expr | null>('idle')
  const v3 = useMemo(() => new THREE.Vector3(), [])
  const chopDir = useMemo(() => new THREE.Vector3(), [])
  const chopQ = useMemo(() => new THREE.Quaternion(), [])

  const applyFade = (f: number) => {
    if (Math.abs(f - faded.current) < 0.01 && (f < 1) === (faded.current < 1)) return
    const was = faded.current < 1
    faded.current = f
    fig.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.Material
      // (their outline: thinned with them as they fade, to nothing (hidden at once as a fade began, it was gone in a blink before the rest of
      // them, the owner saw them vanish); its material's shared, so its width is set just for their draw and put back after)
      if ((mat as THREE.MeshBasicMaterial).side === THREE.BackSide && mat.type !== 'MeshToonMaterial') { m.visible = f > 0.04; m.userData.fade = f; thinWithFade(m); return }
      if (mat.userData.base === undefined) mat.userData.base = { opacity: mat.opacity, transparent: mat.transparent }
      const base = mat.userData.base as { opacity: number; transparent: boolean }
      if (was !== f < 1 && !base.transparent && !mat.userData.hashed) { mat.alphaHash = f < 1; mat.needsUpdate = true }
      mat.opacity = base.opacity * f
    })
  }
  const setExpr = (e: Expr) => {
    if (exprNow.current === e || !fig.face) return
    exprNow.current = e
    // (its frame on the strip: eight across, two rows (the face's UVs halved in height in the shader))
    const i = GUEST_FACES.indexOf(e)
    fig.face.value.set((i % 8) / 8, Math.floor(i / 8) / 2)
  }
  /** their face's life (game/faceLife, item 368), and their head's turn last frame (the eyes go first where it's turning) */
  const life = useRef<FaceLife | null>(null)
  const headYaw = useRef(0)

  useFrame(() => {
    const t = timeNow()
    const dt = last.current === null ? 0 : Math.min(0.1, Math.max(0, t - last.current))
    last.current = t
    if (spellOf(t) !== spell) setSpell(spellOf(t))
    applyFade(fade?.() ?? 1)
    const o = outer.current
    if (!o) return
    // (up onto the stool's seat as they sit, down off it as they stand, over SIT_T: it was put there at once, a hop of 0.8 in a frame
    // (tests/e2e/_popguest.mjs found it); then a share of what was left each frame, which at double speed did seven tenths of it in the first
    // frame (item 242): now eased in and out over its time, whatever the frames, with a bob of the body (below) as they hop up or step down;
    // the first time, where they are already)
    let sitBob = 0
    {
      const want = walking || ground ? 0 : SEAT
      if (lifted.current === null) lifted.current = want
      if ((sitMove.current ? sitMove.current.to : lifted.current) !== want) sitMove.current = { from: lifted.current, to: want, t: 0 }
      const m = sitMove.current
      if (m) {
        m.t = Math.min(1, m.t + dt / SIT_T)
        const k = m.t
        lifted.current = m.from + (m.to - m.from) * k * k * (3 - 2 * k)
        // (hopping up: down a little into the knees first, stretched as they rise, squashed a touch as they land on the seat; stepping
        // down: stretched off the seat, squashed as their feet meet the floor)
        sitBob = m.to > m.from
          ? (k < 0.2 ? -0.06 * Math.sin((k / 0.2) * Math.PI) : k < 0.75 ? 0.05 * Math.sin(((k - 0.2) / 0.55) * Math.PI) : -0.04 * Math.sin(((k - 0.75) / 0.25) * Math.PI))
          : (k < 0.6 ? 0.03 * Math.sin((k / 0.6) * Math.PI) : -0.04 * Math.sin(((k - 0.6) / 0.4) * Math.PI))
        if (m.t >= 1) { lifted.current = m.to; sitMove.current = null }
      }
      o.position.y = lifted.current
    }
    // (walking: how fast they're going, from how far they've come since the last frame; stood still on the way, they stand)
    o.getWorldPosition(v3)
    const moved = lastPos.current ? Math.hypot(v3.x - lastPos.current.x, v3.z - lastPos.current.z) / Math.max(dt, 1e-3) : 0
    lastPos.current = (lastPos.current ?? new THREE.Vector3()).copy(v3)
    const going = walking && !still?.()
    pace.current += ((going ? Math.min(1, Math.max(0.6, moved / 0.5)) : 0) - pace.current) * follow(dt, 8)
    const walk = pace.current
    // (how tall they stand, for the dust a running child kicks up (DustPuffs' footDust: a grown-up customer never does, and it's never
    // asked of them): a child's measured once for each shape, its copies sharing it (item 374: every customer's skinned mesh was posed vertex
    // by vertex for it as they came in, three's bone sums for each vertex garbage, the most the shop made after the door's sound)
    const kid = spec.kind === 'kid'
    if (kid && !tall.current) {
      const key = fig.mesh?.geometry?.attributes.position, sc = fig.root.getWorldScale(TALL_SCALE).y, known = key ? TALL_OF.get(key) : undefined
      if (known !== undefined) tall.current = known * sc
      else { const bx = new THREE.Box3().setFromObject(fig.root); if (!bx.isEmpty()) { tall.current = bx.max.y - bx.min.y; if (key && sc > 0) TALL_OF.set(key, tall.current / sc) } }
    }
    // (not on the character viewer's turntable (`ground`): its own little canvas, the puffs are the room's)
    if ((tall.current || !kid) && going && !ground) footDust(steps.current, v3, walk, tall.current, dt, kid ? 'kid' : 'guest')
    // (the food's come: a crouch, a hop up stretched tall and down again squashed, half a second; their eyes shut happy a moment)
    if (eating !== served.current.was) { served.current.was = eating; if (eating && !walking) { served.current.at = t; fig.root.userData.served = (fig.root.userData.served ?? 0) + 1 } }
    const since = t - served.current.at
    const yay = since >= 0 && since < 0.55 ? since / 0.55 : -1
    const lift = yay >= 0 ? Math.max(0, Math.sin(yay * Math.PI)) * 0.08 : 0
    const squash = sitBob + (yay >= 0 ? (yay < 0.15 ? -0.08 * Math.sin((yay / 0.15) * Math.PI) : yay < 0.8 ? 0.07 * Math.sin(((yay - 0.15) / 0.65) * Math.PI) : -0.05 * Math.sin(((yay - 0.8) / 0.2) * Math.PI)) : 0)
    const hop = mood === 'joy' && !walking ? Math.max(0, Math.sin(t * 9 + id)) * 0.02 * Math.max(0, Math.sin(t * 0.7 + id * 2)) : 0
    // (a sip under way: the chopsticks put down meanwhile, the head tipped back a little as it's drunk)
    const sipK = !walking && sip ? sip() : -1
    // (or a mouthful of soup: the chopsticks put down, as for a sip; `sipping` covers both, as all that waits on it waits on either)
    const soupK = !walking && soup ? soup() : -1
    const souping = soupK >= 0 && soupK < 1 && !(sipK >= 0 && sipK < 1)
    const sipping = (sipK >= 0 && sipK < 1) || souping
    const sipCup = sipping && cup && !souping
    const ph = t * 9 + id
    const b = fig.body
    b.position.y = walk * Math.abs(Math.sin(ph)) * 0.035 + lift + hop
    b.rotation.z = walk * Math.sin(ph) * 0.07
    // (leaning in to reach their plate, if it's further than the arm goes (below))
    eatLean.current += ((eating && !walking ? leanWant.current : 0) - eatLean.current) * follow(dt, 4)
    b.rotation.x = walk * 0.08 + eatLean.current
    // (talking to the one they came with: turned toward them)
    const turn = !walking && talk && !eating ? talk * 0.35 : 0
    b.rotation.y += (turn - b.rotation.y) * follow(dt, 4)
    b.scale.y = 1 + (walking ? 0 : Math.sin(t * 1.7 + id) * 0.008) + squash
    b.scale.x = b.scale.z = 1 - squash * 0.5
    // (a bite's beats (item 242): the hand out from where it rests to the food, the tips down into it and up with a bite, up to the mouth (the
    // head coming up to meet it), the bite, back down to rest over the plate, and chewing there a while; each their own pace, 2.6 to 4 s a
    // bite, and every third or fourth one a longer chew. It was the hand put at the plate or at the mouth by turns, 1.4 s round, all evening:
    // pecking, the chewing face only while the hand was up)
    // (with the dish's own bites known, in step with them: the tips down in the food (0.27 of a beat) as a bite goes from it (x.65); before
    // the first, the hand resting over the plate; with none known, their own pace, 2 to 2.8 s a bite, every third or fourth a longer chew)
    const dish = eating && !sipping ? bite?.() : undefined
    const biteS = 2 + 0.8 * hash(id, 21)
    const biteN = Math.floor((t + id * 1.7) / biteS)
    const biteK = ((t + id * 1.7) / biteS) % 1
    const bq = !eating || sipping ? 0
      : dish !== undefined ? (dish < 0.38 ? 0.72 + (dish / 0.38) * 0.28 : (dish + 0.62) % 1)
      : hash(id * 5 + biteN, 9) > 0.72 ? Math.min(1, biteK / 0.6) : biteK
    const chewing = eating && !sipping && bq >= 0.52 && !(dish !== undefined && dish < 0.38)
    // (the jaw going while they chew: the chewing face's two halves by turns (item 368: it was the chewing face and their idle one))
    const jaw = ((t * 5.5 + id) % 1) < 0.5
    // (the head: looking about by beats while they sit, down at the phone or the plate, nodding as they talk)
    if (fig.head) {
      let yaw = 0, pitch = 0
      if (!walking) {
        const beat = 2.5 + 4 * hash(id, 11)
        const n = Math.floor((t + id * 3.1) / beat)
        yaw = (hash(id * 7 + n, 1) - 0.5) * 0.9
        pitch = (hash(id * 7 + n, 2) - 0.6) * 0.3
        if (showPhone || eating) { pitch = -0.28 + (eating && hash(id * 7 + n, 3) > 0.7 ? 0.3 : 0); yaw *= 0.3 }
        // (eating: down at the food as they pick it up, up a little to meet it as it comes, level while they chew, a look about now and then)
        if (eating && !sipping) {
          pitch = bq < 0.3 ? -0.3 : bq < 0.6 ? -0.16 : -0.08 + (hash(id * 7 + n, 3) > 0.7 ? 0.2 : 0)
          if (chewing) pitch += Math.sin(t * 11 + id) * 0.012
        }
        if (idle === 'chin' && !eating && !talk) { yaw *= 0.4; pitch = 0.06 }
        if (talk && !eating) { yaw = talk * 0.25; pitch = 0.05 + Math.sin(t * 7 + id) * 0.05 * (Math.sin(t * 1.3 + id) > 0 ? 1 : 0) }
        if (sipping && sipK > 0.36 && sipK < 0.72) { yaw *= 0.2; pitch = sipCup ? 0.12 : 0.28 }
        if (souping && soupK > 0.36 && soupK < 0.7) { yaw *= 0.2; pitch = 0.16 }
        if (pose === 'Wipe' && wipeFrom.current !== null && performance.now() - wipeFrom.current < WIPE_REACH_MS) { yaw *= 0.2; pitch = -0.42 }
        // (looking at a thing in the room as they speak of it (item 348, GAZE): their head turned to it as far as a neck goes, a little up)
        const gz = GAZE.get(id)
        if (gz && gz.until > performance.now() && !eating) {
          fig.body.getWorldPosition(GZ_P)
          const e = fig.body.matrixWorld.elements
          const by = Math.atan2(e[8], e[10]), ty = Math.atan2(gz.x - GZ_P.x, gz.z - GZ_P.z)
          yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(ty - by), Math.cos(ty - by))))
          pitch = 0.08
        }
      }
      const ease = 1 - Math.exp(-dt * 3)
      look.current.yaw += (yaw - look.current.yaw) * ease
      look.current.pitch += (pitch - look.current.pitch) * ease
      fig.head.rotation.set(-look.current.pitch, look.current.yaw, 0, 'YXZ')
    }
    // (the hands: swinging as they walk; at the table, the left on the bar and the chopsticks from the plate to the mouth in the right; the phone
    // up in the left; the chin on the left hand; reaching into the fridge; a drink held in the right)
    const L = fig.handL, Rh = fig.handR
    // (their food, in the body's frame)
    const where = eating && !walking && !sipping ? plate?.() : null
    if (import.meta.env?.DEV) fig.root.userData.reach = where ? where.clone() : null
    const reach = where ? fig.body.worldToLocal(REACH.copy(where)) : null
    let tipsUp = false
    if (L && Rh) {
      const swing = walk * Math.sin(ph) * 0.08
      const lp = REST.L.clone(), rp = REST.R.clone()
      let lr = 0, rr = 0
      if (walking) { lp.z += swing; rp.z -= swing }
      if (eating && !sipping) {
        // (the right hand, the chopsticks in it, through a bite's beats (above): the food on their plate, by the mouth, resting between; the
        // left resting on the bar's edge (it held up a bowl, which nobody could make out))
        // (at the food: put out from the shoulder toward it, so the tips come down in it, as far as the arm goes; past that they lean in,
        // while the hand's out there)
        BITE_FOOD.copy(BITE_FRONT)
        leanWant.current = 0
        if (reach) {
          REACH_U.copy(SHOULDER_R).sub(reach).normalize()
          BITE_FOOD.copy(reach).addScaledVector(REACH_U, TIP_IN)
          const d = BITE_FOOD.distanceTo(SHOULDER_R)
          if (bq < 0.34) leanWant.current = Math.min(LEAN_MAX, Math.max(0, (d - ARM) * 1.2))
          if (d > ARM_MOST) BITE_FOOD.sub(SHOULDER_R).setLength(ARM_MOST).add(SHOULDER_R)
        }
        BITE_REST.copy(BITE_FOOD).lerp(BITE_MOUTH, 0.3).add(BITE_UP)
        const ss = THREE.MathUtils.smoothstep
        // (how far up toward the mouth the tips point, 0 down at the plate to 1 up at the mouth)
        let up = 0
        if (bq < 0.18) lp.copy(BITE_REST).lerp(BITE_FOOD, ss(bq, 0, 0.18))
        else if (bq < 0.3) { lp.copy(BITE_FOOD); lp.y -= 0.025 * Math.sin(((bq - 0.18) / 0.12) * Math.PI) }
        else if (bq < 0.48) { up = ss(bq, 0.3, 0.48); lp.copy(BITE_FOOD).lerp(BITE_MOUTH, up) }
        else if (bq < 0.56) { up = 1; lp.copy(BITE_MOUTH) }
        else if (bq < 0.72) { up = 1 - ss(bq, 0.56, 0.72); lp.copy(BITE_MOUTH).lerp(BITE_REST, 1 - up) }
        else { lp.copy(BITE_REST); lp.y += Math.sin(t * 11 + id) * 0.003 }
        tipsUp = up > 0.5
        lr = -0.7 - 0.6 * up
        rp.set(0.17, 0.31, 0.36)
        rr = -0.3
      } else if (showPhone) {
        // (in the left hand, held up in front)
        rp.set(0.06, 0.44, 0.32)
        rr = -1.1
      } else if (!walking && idle === 'chin' && !talk && !pose) {
        rp.set(0.08, 0.5, 0.27)
        rr = -1.4
      }
      if (pose === 'Fetch') { rp.set(0.16, 0.52, 0.38); rr = -1.2 }
      // (washing their hands at a basin: both out in front, rubbing round each other under the tap)
      if (pose === 'Wash') {
        const r = Math.sin(t * 11 + id) * 0.025, q = Math.cos(t * 11 + id) * 0.015
        lp.set(-0.045 + r, 0.5 + q, 0.4); rp.set(0.045 - r, 0.5 - q, 0.4)
        lr = rr = -1.25
      }
      // (done eating: first the right hand down under the bar's edge to their drawer for a tissue, the head bowed to it (item 269: the drawer
      // slides out to it, GuestBar3D's DRAWER_KICK); then a tissue to the mouth in both hands, wiped side to side a few times)
      if (pose === 'Wipe') wipeFrom.current ??= performance.now()
      else wipeFrom.current = null
      const reachK = pose === 'Wipe' ? (performance.now() - (wipeFrom.current ?? 0)) / WIPE_REACH_MS : 1
      if (pose === 'Wipe' && reachK < 1) {
        const dip = Math.sin(reachK * Math.PI)
        lp.set(-0.06, 0.34 - 0.13 * dip, 0.42 + 0.1 * dip)
        rp.set(0.12, 0.33, 0.38)
        lr = -0.5 * dip
        rr = -0.3
      } else if (pose === 'Wipe') {
        const w = Math.sin(t * 13 + id) * 0.03
        lp.set(-0.03 + w, 0.64, 0.34); rp.set(0.05 + w, 0.62, 0.34)
        lr = rr = -1.4
      }
      // (a sip: the right hand out to the drink on the bar, up to the mouth with it, tipped up and drunk, and down to the bar again)
      if (sipping && !souping) {
        const k = sipK
        const at = drinkAt?.()
        const on = at ? fig.body.worldToLocal(SIP_AT.copy(at)).add(SIP_GRIP) : SIP_REST
        const mouth = sipCup ? SIP_MOUTH_CUP : SIP_MOUTH, tip = sipCup ? 0.9 : 1.3, more = sipCup ? 0.5 : 0.75
        if (k < 0.2) { lp.copy(REST.L).lerp(on, THREE.MathUtils.smoothstep(k, 0, 0.2)); lr = 0 }
        else if (k < 0.42) { lp.copy(on).lerp(mouth, THREE.MathUtils.smoothstep(k, 0.2, 0.42)); lr = -THREE.MathUtils.smoothstep(k, 0.2, 0.42) * tip }
        else if (k < 0.66) { lp.copy(mouth); lr = -tip - Math.sin(((k - 0.42) / 0.24) * Math.PI) * more }
        else if (k < 0.86) { lp.copy(mouth).lerp(on, THREE.MathUtils.smoothstep(k, 0.66, 0.86)); lr = -(1 - THREE.MathUtils.smoothstep(k, 0.66, 0.86)) * tip }
        else { lp.copy(on).lerp(REST.L, THREE.MathUtils.smoothstep(k, 0.86, 1)); lr = 0 }
      }
      if (souping) {
        // (a mouthful of miso soup: both hands out to the bowl, the right at its side, the left under it; up to the mouth with it, tipped
        // toward them as it's drunk, and down to its place again; then the hands back)
        const k = soupK, at = soupAt?.()
        const on = at ? fig.body.worldToLocal(SOUP_AT.copy(at)).add(SOUP_UP) : SOUP_REST
        const up = k < 0.2 ? 0 : k < 0.42 ? THREE.MathUtils.smoothstep(k, 0.2, 0.42) : k < 0.68 ? 1 : k < 0.86 ? 1 - THREE.MathUtils.smoothstep(k, 0.68, 0.86) : 0
        const reach = k < 0.2 ? THREE.MathUtils.smoothstep(k, 0, 0.2) : k < 0.86 ? 1 : 1 - THREE.MathUtils.smoothstep(k, 0.86, 1)
        const tip = k > 0.42 && k < 0.68 ? Math.sin(((k - 0.42) / 0.26) * Math.PI) * 0.5 : 0
        BOWL_C.copy(on).lerp(SOUP_MOUTH, up)
        lp.copy(REST.L).lerp(BOWL_SIDE.copy(BOWL_C).add(SOUP_GRIP_R), reach)
        rp.copy(REST.R).lerp(BOWL_SIDE.copy(BOWL_C).add(SOUP_GRIP_L), reach)
        lr = rr = -tip
      }
      if (held && !eating && !sipping) { lp.set(-0.22, 0.34, 0.2); lr = -0.3 }
      if (heldRef.current) heldRef.current.visible = !!held && (heldShown ? heldShown() : true)
      // (closely, through a bite's or a sip's beats, which are eased themselves; more loosely from one thing to the next)
      const kL = follow(dt, eating || sipping ? 24 : 10)
      L.position.lerp(lp, kL)
      Rh.position.lerp(rp, follow(dt, souping ? 24 : 10))
      L.rotation.x += (lr - L.rotation.x) * kL
      Rh.rotation.x += (rr - Rh.rotation.x) * follow(dt, souping ? 24 : 10)
      // (the bowl in their hands, from when they've hold of it till it's down again: midway between them, as they are, tipped with them)
      if (soupKey) {
        if (souping && soupK > 0.17 && soupK < 0.89) {
          BOWL_C.copy(L.position).sub(SOUP_GRIP_R).add(BOWL_SIDE.copy(Rh.position).sub(SOUP_GRIP_L)).multiplyScalar(0.5)
          const lifted = BOWL_LIFT.get(soupKey) ?? { p: new THREE.Vector3(), q: new THREE.Quaternion() }
          L.parent!.localToWorld(lifted.p.copy(BOWL_C)).add(BOWL_DOWN)
          b.getWorldQuaternion(lifted.q).multiply(BOWL_TIP.setFromAxisAngle(X_AXIS, L.rotation.x * 0.8))
          BOWL_LIFT.set(soupKey, lifted)
        } else BOWL_LIFT.delete(soupKey)
      }
    }
    // (what's in their hands, shown by its part of the one mesh being its size, hidden by its being nothing)
    if (fig.chop) {
      fig.chop.scale.setScalar(eating && !sipping ? 1 : 0)
      // (the tips at the plate, or at the mouth: their way from the hand in the figure's frame, taken into the hand's (turned about x))
      if (eating && L && !sipping) {
        const to = tipsUp ? CHOP_MOUTH : reach ?? CHOP_PLATE
        chopDir.copy(to).sub(L.position).normalize().applyAxisAngle(X_AXIS, -L.rotation.x)
        chopQ.setFromUnitVectors(UP, chopDir)
        fig.chop.quaternion.slerp(chopQ, follow(dt, 14))
      }
      // (a bite in the tips from the plate till they're at the mouth)
      // (a bite in the tips from when they've picked it up till it's eaten at the mouth)
      if (eating && !sipping && bq > 0.24 && bq < 0.52) fig.bite?.scale.set(1, 0.7, 0.8)
      else fig.bite?.scale.setScalar(0)
    }
    fig.phone?.scale.setScalar(showPhone ? 1 : 0)
    fig.carried?.scale.setScalar(spec.briefcase && walking ? 1.4 : 0)
    // (by the stool while they sit: in the figure's frame, which is scaled to their size and lifted to the seat)
    if (fig.parked) {
      // (on the floor by the stool, however far up onto the seat they've got)
      const kk = fit * spec.size, lift = lifted.current ?? (walking || ground ? 0 : SEAT)
      if (spec.briefcase && !walking) {
        fig.parked.position.set(-0.22 / kk, -lift / kk, 0.12 / kk)
        fig.parked.rotation.y = 0.3
        fig.parked.scale.setScalar(1.4 / spec.size)
      } else fig.parked.scale.setScalar(0)
    }
    // (the face: their mood; blinking now and then; delighted when the food's just come; chewing; talking)
    const delighted = since >= 0 && since < 1.2
    const joy = mood === 'joy' || delighted
    // (a word of theirs up: said in phrases, a breath between (the mouth's syllables are the face's life's))
    const talking = !!talk && !eating && Math.sin(t * 1.3 + id) > -0.2
    // (the deep night: some, sat with nothing to do, sleepy (item 368))
    const sleepy = !walking && !eating && LATE.on && hash(id, 31) < 0.45
    // (getting cross, sat waiting: the mark by the head, the face, the steam (item 347); walked out angry, all of it)
    const f = Math.max(fume?.() ?? 0, mood === 'mad' ? 1 : 0)
    if (fig.head && fx.g.parent !== fig.head) fig.head.add(fx.g)
    fx.g.visible = f > 0.55
    if (fx.g.visible) {
      const beat = Math.max(0, Math.sin(t * (f > 0.8 ? 9 : 6)))
      fx.vein.scale.setScalar((0.1 + 0.08 * Math.min(1, (f - 0.55) / 0.3)) * (1 + 0.18 * beat))
      fx.puffs.forEach((p, i) => {
        const k = (t * 0.85 + i / 3) % 1
        p.visible = f > 0.8
        p.position.set(Math.sin((t + i) * 2.3) * 0.03 * k + (i - 1) * 0.04, 0.3 + 0.32 * k, 0)
        p.scale.setScalar((0.05 + 0.11 * Math.sin(Math.PI * k)) * (0.7 + 0.6 * Math.min(1, (f - 0.8) / 0.2)))
      })
    }
    // (their mood's face (the food just come, cross, sad, sleepy, chewing), through the face's life (game/faceLife, item 368): a blink at no
    // fixed beat that closes and opens, now and then twice; a new face through a blink; the mouth in syllables while a word's up, a laugh
    // between a delighted one's words; a glance aside now and then while they sit at ease, the eyes first where the head's turning)
    const want: Expr = chewing ? 'chew' : joy ? 'happy' : mood === 'mad' || (f >= 0.7 && !eating) ? 'mad' : mood === 'sad' ? 'sad' : sleepy ? 'tired' : 'idle'
    const fl = (life.current ??= newFaceLife(id * 1.618 + 0.5, want, t))
    const yawNow = look.current.yaw
    const headTurn = dt > 0 ? (yawNow - headYaw.current) / dt : 0
    headYaw.current = yawNow
    const lifeNow = faceNow(fl, t, want, { free: !walking && !eating && !talking && want === 'idle', turn: headTurn, talk: talking })
    setExpr(guestFrame(lifeNow.face as Expr, lifeNow, jaw))
  })

  const k = fit * spec.size
  return (
    // (sat, the round body sits on the stool's seat; standing or walking, on the floor: its height eased there each frame (lifted))
    <group ref={outer}>
      <group scale={k}>
        {/* (the chopsticks and their bite, the phone, the briefcase in hand and by the stool: parts of the one mesh) */}
        <primitive object={fig.root} />
        {/* a drink held in the right hand */}
        <group ref={heldRef} visible={!!held} position={[0, 0.02, 0.03]} scale={1.1}>{held}</group>
      </group>
    </group>
  )
}
useGLTF.preload(URL)
// (and the pictures, from the start: a customer coming in never waits on them, so never holds up what's drawn round them)
if (typeof window !== 'undefined') useLoader.preload(THREE.TextureLoader, PICTURE_URLS)
