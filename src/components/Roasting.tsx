import { useEffect, useMemo, useRef, useState } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
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
const UP = new THREE.Vector3(0, 1, 0)
/**
 * Fill order for a pyramid pile, as [layer, position across in piece-widths]. It grows from the middle out and
 * only puts a piece on a layer once both pieces under it are down, so it's a pyramid at every count:
 * 2 side by side, 3 is 2 + 1 on top, then the base widens to 4, then up to 10.
 */
const PYRAMID: [number, number][] = [
  [0, -0.5], [0, 0.5], [1, 0], [0, -1.5], [0, 1.5], [1, -1], [1, 1], [2, -0.5], [2, 0.5], [3, 0],
]
// skewer geometry from blender/grilledfish.py: foot radius, tip radius, tip height
const STICK_FOOT_R = 0.86
const STICK_TOP_R = 0.32
const STICK_TOP_Y = 1.15
const LAYER_HEIGHT = 0.1
const CHAR_COLOR = new THREE.Color(0.045, 0.035, 0.03)

/**
 * Burn patches for over-roasted food: a value-noise mask over the texture that grows as uChar goes 0 → 1, so the
 * food blackens in spots first and ends up fully charred.
 */
function addCharring(mat: THREE.MeshToonMaterial, uChar: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uChar = uChar
    shader.uniforms.uCharColor = { value: CHAR_COLOR }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform float uChar;
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
        diffuseColor.rgb = mix(diffuseColor.rgb, uCharColor, charMask);`)
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
  mats: { mat: THREE.MeshToonMaterial; base: THREE.Color; emissive: THREE.Color }[]
  /** 0 → 1 how charred the texture is, shared by all of this piece's materials */
  uChar: { value: number }
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

type RoastingProps = {
  url: string
  roast: Roast
  /** ids the menu controls; anything else listed in roast.times is always there (the base fish) */
  itemIds: string[]
  quantities: Record<string, number>
  /** only the dish on stage roasts and shows its tags */
  active: boolean
  instant?: boolean
}

/**
 * Roasting over the fire: each skewer browns as it cooks (raw → half → done → slowly charring), shows a tag above
 * it, glows under the pointer, and a click on the tag or the food lifts it off the fire onto the plate.
 * Rendered as a sibling after <Dish>, so its per-frame transforms land after Dish's pop-in animation, and it picks
 * up the extra portions Dish clones in as they appear.
 */
export function Roasting({ url, roast, itemIds, quantities, active, instant = false }: RoastingProps) {
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
      pieces.current.push({
        key: obj.uuid, id, copy: (obj.userData.copy as number | undefined) ?? 0, loose: roast.loose.includes(id),
        node: obj, homeP: obj.position.clone(), homeQ: obj.quaternion.clone(), progress: 0, collected: false,
        flight: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), toP: new THREE.Vector3(),
        toQ: new THREE.Quaternion(), mats, uChar,
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
      // the bamboo skewer itself doesn't roast
      if ((m.material as THREE.Material).name === 'BambooSkewer') continue
      const mat = (m.material as THREE.MeshToonMaterial).clone()
      addCharring(mat, p.uChar)
      m.material = mat
      p.mats.push({ mat, base: mat.color.clone(), emissive: mat.emissive.clone() })
    }
  }

  const present = (p: Piece) => !menuIds.has(p.id) || p.copy < (quantities[p.id] ?? 0)

  const collect = (p: Piece) => {
    if (p.collected || !present(p)) return
    const pile = roast.piles?.[p.id]
    // count what's already gone to the same place: this item's pile, or the plate
    const slot = pieces.current.filter((q) => q.collected && present(q) &&
      (pile ? q.id === p.id : !roast.piles?.[q.id])).length
    p.collected = true
    // tells Dish to stop driving this node's position (its pop-in would pull it back up to skewer height)
    p.node.userData.onPlate = true
    p.flight = instant ? 1 : 0
    p.fromP.copy(p.node.position)
    p.fromQ.copy(p.node.quaternion)
    if (pile) {
      // stacked into a pyramid on the ground; a full pyramid starts another one behind it
      const [layer, offset] = PYRAMID[slot % PYRAMID.length]
      const heap = Math.floor(slot / PYRAMID.length)
      p.toP.set(...pile.at)
        .addScaledVector(STACK_DIR, offset * pile.spacing)
        .addScaledVector(LAY_DIR, -heap * pile.spacing * 2.6)
      p.toP.y += pile.spacing * (0.42 + layer * 0.8)
    } else {
      // side by side across the plate, centred; a full row starts a new layer on top
      const col = slot % PER_LAYER
      const layer = Math.floor(slot / PER_LAYER)
      const across = (col - (PER_LAYER - 1) / 2) * SLOT_GAP + (layer % 2) * (SLOT_GAP / 2)
      p.toP.set(...roast.plate).addScaledVector(STACK_DIR, across)
      // skewers are longer than the plate is wide, so the stick rests across the rim (top ≈ 0.08) instead of
      // cutting through it
      p.toP.y += (p.loose ? 0.075 : 0.105) + layer * LAYER_HEIGHT
    }
    // everything points the same way along LAY_DIR
    if (p.loose) {
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

  // pointer: hovering food on the fire makes it glow and turns the cursor into a hand; a click (not a drag that
  // orbits the camera) takes it off the fire
  const { gl, camera, raycaster } = useThree()
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
      const candidates = pieces.current.filter((p) => !p.collected && present(p))
      const hits = raycaster.intersectObjects(candidates.map((p) => p.node), true)
      if (!hits.length) return null
      let o: THREE.Object3D | null = hits[0].object
      while (o && !candidates.some((p) => p.node === o)) o = o.parent
      return candidates.find((p) => p.node === o) ?? null
    }
    let down: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      const p = pick(e)
      if (p !== hovered.current) setHover(p)
      el.style.cursor = p ? 'pointer' : ''
    }
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      const p = pick(e)
      if (p) collect(p)
    }
    const onLeave = () => {
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
  const since = useRef(0)
  const tint = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    if (scannedCount.current !== root.children.length) scan()
    const dt = Math.min(delta, 0.1)
    pieces.current.forEach((p, n) => {
      bindMaterials(p)
      if (!present(p)) {
        // taken off the order: next time it comes back raw, on its skewer
        p.progress = 0
        p.collected = false
        p.flight = 0
        p.node.userData.onPlate = false
        p.node.quaternion.copy(p.homeQ)
        p.node.position.copy(p.homeP)
        return
      }
      const time = roast.times[p.id]
      if (!p.collected) {
        if (active) p.progress += dt
        p.node.quaternion.copy(p.homeQ)
        p.node.position.x = p.homeP.x
        p.node.position.z = p.homeP.z
        if (!menuIds.has(p.id)) p.node.position.y = p.homeP.y   // the base fish has no pop-in driving y
      } else {
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
      for (const { mat, base, emissive } of p.mats) {
        mat.color.copy(base).multiply(tint)
        mat.emissive.copy(emissive)
        if (glow) mat.emissive.add(HOVER_GLOW)
      }
      // burnt food shrivels a little. Menu items get their scale from Dish's pop-in, which applies this factor;
      // the base fish has no pop-in, so set it directly.
      const shrink = 1 - 0.08 * THREE.MathUtils.smoothstep(r, 1.8, CHAR_FULL)
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
      <Plate position={roast.plate} />
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
