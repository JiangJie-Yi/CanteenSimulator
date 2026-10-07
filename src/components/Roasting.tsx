import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playChew } from '../chew'
import { Steam } from './Steam'
import { ROAST_STAGES, type Roast } from '../menu'

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
/** seconds to eat one piece: a few bites, each taking a chunk out */
const EAT_SECONDS = 1.3
const UP = new THREE.Vector3(0, 1, 0)
/** the bamboo basket the foil-roasted potatoes are served in */
const BASKET_R = 0.36
const BASKET_STEP = 0.85
/**
 * Where each piece settles in a basket, as [ring radius, angle in turns, layer]: five round the bottom, four
 * nestled on top of them, one crowning the heap.
 */
const BASKET_SLOTS: [number, number, number][] = [
  [0.17, 0, 0], [0.17, 0.2, 0], [0.17, 0.4, 0], [0.17, 0.6, 0], [0.17, 0.8, 0],
  [0.09, 0.1, 1], [0.09, 0.35, 1], [0.09, 0.6, 1], [0.09, 0.85, 1], [0, 0, 2],
]
/** salt sprinkled from the pot: grains fall over the fire for a moment */
const SALT_GRAINS = 220
const SALT_SECONDS = 1.1
// skewer geometry from blender/grilledfish.py: foot radius, tip radius, tip height
const STICK_FOOT_R = 0.7
const STICK_TOP_R = 0.26
const STICK_TOP_Y = 1.15
const LAYER_HEIGHT = 0.1
const CHAR_COLOR = new THREE.Color(0.045, 0.035, 0.03)

/** A woven bamboo (ざる) texture: strips over and under in a twill, pale and honey-coloured. */
const weaveTexture = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const cell = 8
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const over = (i + j) % 4 < 2
      g.fillStyle = over ? '#d9b779' : '#b88f52'
      g.fillRect(i * cell, j * cell, cell, cell)
      // a dark seam between strips, and a light streak along the one on top
      g.fillStyle = 'rgba(80, 52, 22, 0.55)'
      if (over) g.fillRect(i * cell, j * cell, cell, 1)
      else g.fillRect(i * cell, j * cell, 1, cell)
      g.fillStyle = 'rgba(255, 240, 200, 0.35)'
      if (over) g.fillRect(i * cell, j * cell + 3, cell, 1)
      else g.fillRect(i * cell + 3, j * cell, 1, cell)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(14, 3)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/** Shallow woven bamboo basket with a rolled rim, inked like everything else. */
function Basket({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(() => {
    const R = BASKET_R
    const profile = [[0, 0.01], [R * 0.55, 0.012], [R * 0.82, 0.04], [R * 0.97, 0.1], [R * 1.02, 0.13], [R * 0.99, 0.145],
      [R * 0.93, 0.12], [R * 0.78, 0.055], [R * 0.5, 0.028], [0, 0.026]].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(profile, 48)
  }, [])
  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#ffffff" map={weaveTexture} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometry} scale={[1.03, 1.08, 1.03]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/**
 * Burn patches for over-roasted food: a value-noise mask over the texture that grows as uChar goes 0 → 1, so the
 * food blackens in spots first and ends up fully charred.
 */
function addCharring(mat: THREE.MeshToonMaterial, uChar: { value: number }, uSalt: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uChar = uChar
    shader.uniforms.uSalt = uSalt
    shader.uniforms.uCharColor = { value: CHAR_COLOR }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uChar;
        uniform float uSalt;
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
        // coarse salt stuck to the surface: scattered white grains, more of them with every pinch
        #ifdef USE_MAP
          float saltN = charHash(floor(vMapUv * vec2(150.0, 90.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.98), step(1.0 - uSalt * 0.3, saltN));
        #endif`)
  }
  mat.customProgramCacheKey = () => 'charring'
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
  mats: { mat: THREE.MeshToonMaterial; base: THREE.Color; emissive: THREE.Color; foil: boolean }[]
  /** 0 → 1 how charred the texture is, shared by all of this piece's materials */
  uChar: { value: number }
  /** 0 → 1 how much salt has been sprinkled on it */
  uSalt: { value: number }
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
function Plate({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(() => {
    // profile drawn for a 0.5 radius plate, scaled up to PLATE_R
    const k = PLATE_R / 0.5
    const profile = [[0, 0], [0.32, 0], [0.4, 0.025], [0.47, 0.06], [0.5, 0.075], [0.49, 0.082], [0.44, 0.052],
      [0.3, 0.02], [0, 0.02]].map(([x, y]) => new THREE.Vector2(x * k, y))
    return new THREE.LatheGeometry(profile, 64)
  }, [])
  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color="#f4efe4" />
      </mesh>
      <mesh geometry={geometry} scale={[1.025, 1.06, 1.025]}>
        <meshBasicMaterial color="#3b2a20" side={THREE.BackSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.07}>
        <ringGeometry args={[PLATE_R * 0.91, PLATE_R * 0.94, 64]} />
        <meshBasicMaterial color="#3d5f9e" />
      </mesh>
    </group>
  )
}

/** pieces that steam for a moment when they're served (hot fish, potatoes out of the foil) */
const STEAMS = /^(Fish|ExtraFish|Saury|Mackerel|Potato|SweetPotato)$/
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
  onOffFire?: (count: number) => void
}

/** Roasting speed for a fire level: barely cooking on dying embers, about twice as fast at full blaze. */
const roastRate = (fire: number) => 0.25 + 1.75 * fire

/**
 * Roasting over the fire: each skewer browns as it cooks (raw → half → done → slowly charring), shows a tag above
 * it, glows under the pointer, and a click on the tag or the food lifts it off the fire onto the plate.
 * Rendered as a sibling after <Dish>, so its per-frame transforms land after Dish's pop-in animation, and it picks
 * up the extra portions Dish clones in as they appear.
 */
export function Roasting({ url, roast, itemIds, quantities, active, instant = false, fire, onOffFire }: RoastingProps) {
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
      const uChar = { value: 0 }
      const uSalt = { value: 0 }
      pieces.current.push({
        key: obj.uuid, id, copy: (obj.userData.copy as number | undefined) ?? 0, loose: roast.loose.includes(id),
        node: obj, homeP: obj.position.clone(), homeQ: obj.quaternion.clone(), progress: 0, collected: false,
        flight: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), toP: new THREE.Vector3(),
        toQ: new THREE.Quaternion(), mats, uChar, uSalt, landed: -1, slot: null, eat: 0, eaten: false,
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
    for (const m of meshes) {
      const mat = (m.material as THREE.MeshToonMaterial).clone()
      // the foil wrapped round potatoes in the ash doesn't brown or char; it comes off when they're served
      const foil = mat.name.startsWith('Foil')
      if (!foil) addCharring(mat, p.uChar, p.uSalt)
      m.material = mat
      p.mats.push({ mat, base: mat.color.clone(), emissive: mat.emissive.clone(), foil })
    }
  }

  const present = (p: Piece) => !menuIds.has(p.id) || p.copy < (quantities[p.id] ?? 0)

  /**
   * Plate n of the run. They go around the fire at the first plate's distance: the 2nd to its front-right, the
   * rest round the back (so none sits between the camera and the fire); a full lap moves out a ring.
   */
  const plateAt = (n: number) => {
    const [x, y, z] = roast.plate
    const r0 = Math.hypot(x, z)
    const a0 = Math.atan2(z, x)
    const step = 2 * Math.asin(Math.min(1, (PLATE_STEP / 2) / r0))     // angle between neighbouring plates
    const order = [0, 1, -1, -2, -3, -4, -5]                             // in steps, from the first plate
    const lap = Math.floor(n / order.length)
    const a = a0 + order[n % order.length] * step + lap * step / 2
    const r = r0 + lap * PLATE_STEP
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
  }
  const [plateCount, setPlateCount] = useState(1)
  const basketAt = (n: number) => {
    const [x, y, z] = roast.basket!.at
    return new THREE.Vector3(x, y, z).addScaledVector(LAY_DIR, -n * BASKET_STEP)
  }
  const [basketCount, setBasketCount] = useState(1)
  const [wisps, setWisps] = useState<{ key: string; at: [number, number, number] }[]>([])
  const inBasket = (p: Piece) => !!roast.basket && p.loose

  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    const basket = inBasket(p)
    // take the first free spot where it's going (the baskets, or the plates); eaten food frees its spot
    const taken = new Set(pieces.current.filter((q) => q.slot !== null && !q.eaten && present(q) &&
      inBasket(q) === basket).map((q) => q.slot))
    let slot = 0
    while (taken.has(slot)) slot++
    p.slot = slot
    p.collected = true
    // tells Dish to stop driving this node's position (its pop-in would pull it back up to skewer height)
    p.node.userData.onPlate = true
    p.flight = instant ? 1 : 0
    p.fromP.copy(p.node.position)
    p.fromQ.copy(p.node.quaternion)
    if (basket) {
      // heaped into the bamboo basket; a full basket (roast.basket.capacity) gets another set down behind it
      const cap = Math.min(roast.basket!.capacity, BASKET_SLOTS.length)
      const n = Math.floor(slot / cap)
      const [r, turn, layer] = BASKET_SLOTS[slot % cap]
      const a = turn * Math.PI * 2
      p.toP.copy(basketAt(n)).add(new THREE.Vector3(Math.cos(a) * r, 0.085 + layer * 0.075, Math.sin(a) * r))
      if (n + 1 > basketCount) setBasketCount(n + 1)
      // lying on its side round the basket, long way along the ring
      const along = new THREE.Vector3(-Math.sin(a + 0.4), 0, Math.cos(a + 0.4))
      p.toQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, UP, new THREE.Vector3().crossVectors(along, UP)))
    } else {
      // side by side across the plate, centred; a full row starts a new layer on top; a full plate, a new plate
      const plate = Math.floor(slot / PER_PLATE)
      const within = slot % PER_PLATE
      const col = within % PER_LAYER
      const layer = Math.floor(within / PER_LAYER)
      const across = (col - (PER_LAYER - 1) / 2) * SLOT_GAP + (layer % 2) * (SLOT_GAP / 2)
      p.toP.copy(plateAt(plate)).addScaledVector(STACK_DIR, across)
      if (plate + 1 > plateCount) setPlateCount(plate + 1)
      // skewers are longer than the plate is wide, so the stick rests across the rim (top ≈ 0.08) instead of
      // cutting through it
      p.toP.y += (p.loose ? 0.075 : 0.105) + layer * LAYER_HEIGHT
    }
    // everything points the same way along LAY_DIR
    if (basket) {
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

  /** Eat a piece that's sitting on the plate (or a pile): a few chewing bites and it's gone. */
  const eat = (p: Piece) => {
    if (!p.collected || p.flight < 1 || p.eat > 0 || p.eaten || !present(p)) return
    p.eat = 0.0001
    playChew(4, EAT_SECONDS)
  }

  // pointer: hovering food on the fire or the plate makes it glow and turns the cursor into a hand; a click (not
  // a drag that orbits the camera) takes it off the fire, or eats it once it's on the plate
  const { gl, camera, raycaster } = useThree()
  const saltPot = useMemo(() => (roast.salt ? root.getObjectByName(roast.salt) ?? null : null), [root, roast.salt])
  const saltHome = useMemo(() => saltPot?.position.clone() ?? null, [saltPot])
  const potHovered = useRef(false)
  const shake = useRef(0)
  const salt = useMemo(() => {
    const pos = new Float32Array(SALT_GRAINS * 3).fill(-10)
    const vel = new Float32Array(SALT_GRAINS * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { pos, vel, geometry, left: 0 }
  }, [])
  const saltMaterial = useMemo(() => new THREE.PointsMaterial({ color: '#ffffff', size: 0.022, sizeAttenuation: true }), [])
  const sprinkle = () => {
    shake.current = 1
    salt.left = SALT_SECONDS
    // everything on the fire gets a little more salt on it as the grains land
    window.setTimeout(() => {
      for (const p of pieces.current) if (present(p) && !p.collected) p.uSalt.value = Math.min(1, p.uSalt.value + 0.35)
    }, 450)
    const { pos, vel } = salt
    for (let i = 0; i < SALT_GRAINS; i++) {
      // a pinch thrown from up high, spreading as it falls over the skewers
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 0.25
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 1.45 + Math.random() * 0.35
      pos[i * 3 + 2] = Math.sin(a) * r
      vel[i * 3] = Math.cos(a) * (0.1 + Math.random() * 0.35)
      vel[i * 3 + 1] = -Math.random() * 0.6
      vel[i * 3 + 2] = Math.sin(a) * (0.1 + Math.random() * 0.35)
    }
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
    const pick = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const candidates = pieces.current.filter((p) => present(p) &&
        (!p.collected || (p.flight >= 1 && p.eat === 0 && !p.eaten)))
      const targets = candidates.map((p) => p.node)
      if (saltPot) targets.push(saltPot)
      const hits = raycaster.intersectObjects(targets, true)
      if (!hits.length) return null
      let o: THREE.Object3D | null = hits[0].object
      while (o && o !== saltPot && !candidates.some((p) => p.node === o)) o = o.parent
      if (o && o === saltPot) return 'salt' as const
      return candidates.find((p) => p.node === o) ?? null
    }
    let down: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      const hit = pick(e)
      potHovered.current = hit === 'salt'
      const p = hit === 'salt' ? null : hit
      if (p !== hovered.current) setHover(p)
      el.style.cursor = hit ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      const p = pick(e)
      if (!p) return
      if (p === 'salt') sprinkle()
      else if (p.collected) eat(p)
      else collect(p)
    }
    const onLeave = () => {
      potHovered.current = false
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

    // the salt pot glows under the pointer and gives a little hop and tip when you take a pinch
    if (saltPot && saltHome) {
      shake.current = Math.max(0, shake.current - dt * 2.2)
      const s = shake.current
      saltPot.position.copy(saltHome)
      saltPot.position.y += Math.sin(s * Math.PI) * 0.08
      saltPot.rotation.z = Math.sin(s * Math.PI * 3) * 0.18 * s
      saltPot.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
          o.material.emissive.set(potHovered.current && active ? HOVER_GLOW : 0x000000)
        }
      })
    }
    if (salt.left > 0) {
      salt.left -= dt
      const { pos, vel } = salt
      for (let i = 0; i < SALT_GRAINS; i++) {
        if (pos[i * 3 + 1] <= 0.01) continue
        vel[i * 3 + 1] -= 4.5 * dt
        pos[i * 3] += vel[i * 3] * dt
        pos[i * 3 + 1] = Math.max(0.01, pos[i * 3 + 1] + vel[i * 3 + 1] * dt)
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      }
      // grains that have landed vanish into the salt bed
      if (salt.left <= 0) pos.fill(-10)
      salt.geometry.attributes.position.needsUpdate = true
    }
    pieces.current.forEach((p, n) => {
      bindMaterials(p)
      if (!present(p)) {
        // taken off the order: next time it comes back raw, on its skewer
        p.progress = 0
        p.uSalt.value = 0
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
      if (!p.collected) {
        if (active) p.progress += dt * roastRate(fire?.current ?? 0.55)
        p.node.quaternion.copy(p.homeQ)
        p.node.position.x = p.homeP.x
        p.node.position.z = p.homeP.z
        if (!menuIds.has(p.id)) p.node.position.y = p.homeP.y   // the base fish has no pop-in driving y
      } else {
        if (p.flight >= 1) p.landed += dt
        else p.landed = -1
        if (p.flight < 1 && p.flight + dt / FLIGHT_SECONDS >= 1 && STEAMS.test(p.id) && !p.eaten) {
          p.landed = 0
          setWisps((all) => [...all.filter((w) => w.key !== p.key), { key: p.key, at: p.toP.toArray() as [number, number, number] }])
        }
        p.flight = Math.min(1, p.flight + dt / FLIGHT_SECONDS)
        const e = p.flight < 0.5 ? 2 * p.flight * p.flight : 1 - (-2 * p.flight + 2) ** 2 / 2
        p.node.position.lerpVectors(p.fromP, p.toP, e)
        p.node.position.y += Math.sin(p.flight * Math.PI) * 0.45   // a little arc through the air
        p.node.quaternion.slerpQuaternions(p.fromQ, p.toQ, e)
      }

      // browning, then a slow char: black patches spread across the texture and the whole piece darkens,
      // deepening the longer it's left on
      const r = p.progress / time
      const charred = THREE.MathUtils.smootherstep(r, CHAR_START, CHAR_FULL)
      p.uChar.value = charred
      if (r < 1) tint.copy(RAW_TINT).lerp(DONE_TINT, r)
      else tint.copy(DONE_TINT).lerp(BURNT_TINT, charred * 0.6)
      const glow = hovered.current === p
      for (const { mat, base, emissive, foil } of p.mats) {
        if (foil) mat.visible = !(p.collected && p.flight > 0.35)
        else mat.color.copy(base).multiply(tint)
        mat.emissive.copy(emissive)
        if (glow) mat.emissive.add(HOVER_GLOW)
      }
      // burnt food shrivels a little. Menu items get their scale from Dish's pop-in, which applies this factor;
      // the base fish has no pop-in, so set it directly.
      let shrink = 1 - 0.08 * THREE.MathUtils.smoothstep(r, 1.8, CHAR_FULL)
      // being eaten: shrinks a bite at a time, with a little squash on each chew
      if (p.eat > 0 && !p.eaten) {
        p.eat = Math.min(1, p.eat + dt / EAT_SECONDS)
        const bites = Math.floor(p.eat * 4)
        shrink *= (1 - bites * 0.22) * (1 - 0.06 * Math.abs(Math.sin(p.eat * Math.PI * 4)))
        if (p.eat >= 1) {
          p.eaten = true
          p.slot = null
        }
      }
      if (p.eaten) shrink = 0.0001
      if (menuIds.has(p.id)) p.node.userData.shrink = shrink
      else p.node.scale.setScalar(shrink)

      // tags sit above the food, staggered over three heights so neighbouring tags don't overlap
      const a = anchors.current[p.key]
      if (a) {
        a.position.copy(p.node.position)
        a.position.y += (p.loose ? 0.2 : 0.32) + (n % 3) * 0.15
      }
    })

    since.current += delta
    if (since.current < 0.25) return
    since.current = 0
    // keep as many plates out as the food on them needs (always at least one)
    let need = 1
    let needBaskets = 1
    const cap = Math.min(roast.basket?.capacity ?? BASKET_SLOTS.length, BASKET_SLOTS.length)
    for (const p of pieces.current) {
      if (p.slot === null || p.eaten || !present(p)) continue
      if (inBasket(p)) needBaskets = Math.max(needBaskets, Math.floor(p.slot / cap) + 1)
      else need = Math.max(need, Math.floor(p.slot / PER_PLATE) + 1)
    }
    if (need !== plateCount) setPlateCount(need)
    if (needBaskets !== basketCount) setBasketCount(needBaskets)
    const off = pieces.current.filter((p) => p.collected && present(p)).length
    if (off !== lastOff.current) {
      lastOff.current = off
      onOffFire?.(off)
    }
    const next: { key: string; id: string; state: TagState }[] = []
    for (const p of pieces.current) {
      if (!present(p) || p.collected) continue
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
        <Plate key={n} position={plateAt(n).toArray() as [number, number, number]} />
      ))}
      {roast.basket && Array.from({ length: basketCount }, (_, n) => (
        <Basket key={n} position={basketAt(n).toArray() as [number, number, number]} />
      ))}
      <points geometry={salt.geometry} material={saltMaterial} frustumCulled={false} renderOrder={3} />
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
