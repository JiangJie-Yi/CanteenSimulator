import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import type { CopyLayout } from '../menu'

const INK = new THREE.Color('#3b2a20')
const OUTLINE_WIDTH = 0.007
// too small, thin or flat to look good with an ink line
const NO_OUTLINE = new Set(['Broth', 'FirePit', 'DriedChili', 'SichuanPepper', 'Scallion', 'Charcoal', 'PickledGreens',
  'Noodles', 'ExtraNoodles', 'GrillNet'])
// flat ground pieces: they catch shadows but shouldn't throw any
const NO_CAST = new Set(['Broth', 'FirePit'])

type Piece = {
  node: THREE.Object3D
  /** which portion this belongs to: 0 is the one authored in Blender, 1+ are clones */
  copy: number
  /** position among the pieces of one portion, for staggering the drop */
  index: number
  /** where this piece sits in the dish when it isn't animating or on the plate */
  homeP: THREE.Vector3
  homeQ: THREE.Quaternion
  baseScale: THREE.Vector3
  baseY: number
  /** currently ordered */
  on: boolean
  /** scale factor and its velocity (spring) */
  s: number
  v: number
  /** height above the resting spot and its velocity (drop + bounce) */
  y: number
  vy: number
}

// feel of the pop-in: a quick, bouncy spring and a short drop
const SPRING_K = 260
const SPRING_DAMPING = 11
const DROP_HEIGHT = 0.35
const GRAVITY = 9
const BOUNCE = 0.38
// extra portions are the authored pieces swung around the dish's centre by successive golden angles,
// which spreads them evenly without lining up
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const UP = new THREE.Vector3(0, 1, 0)
// "float" entrance: start a little below where it rests and drift up, easing out with no bounce
const FLOAT_DEPTH = 0.12
const FLOAT_EASE = 2.6

/**
 * Natural variation for one piece: ±15% in size and a random turn — about its own skewer (local X, the stick
 * axis in blender/grilledfish.py) for skewers, about the vertical for food lying in a pot or bowl.
 */
function jitter(node: THREE.Object3D, skewer: boolean, gentle = false) {
  if (gentle) {
    // shaped food (onigiri, mochi): the same proportions every time, just a touch bigger or smaller
    node.scale.multiplyScalar(0.95 + Math.random() * 0.1)
    node.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2))
    return
  }
  // size varies a lot, and not evenly: some pieces come out plumper, some longer
  node.scale.multiplyScalar(0.78 + Math.random() * 0.44)
  node.scale.y *= 0.88 + Math.random() * 0.24
  node.scale.z *= 0.88 + Math.random() * 0.24
  const q = skewer
    ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.5)
    : new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2)
  // (skewers stay standing on the salt: their height varies in the model, blender/grilledfish.py place())
  if (skewer) node.quaternion.multiply(q)
  else node.quaternion.premultiply(q)
}

/** GLTFLoader strips the dot from Blender's "Meatball.001", so drop trailing digits to get the type. */
const baseName = (name: string) => name.replace(/\d+$/, '')

// three-tone cel shading ramp
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

function toToon(src: THREE.MeshStandardMaterial): THREE.MeshToonMaterial {
  const toon = new THREE.MeshToonMaterial({
    name: src.name,
    color: src.color,
    map: src.map,
    normalMap: src.normalMap,
    normalScale: src.normalScale,
    emissive: src.emissive,
    emissiveMap: src.emissiveMap,
    emissiveIntensity: src.emissiveIntensity,
    // per-vertex tint from Blender (the soot on the fire side of the stones)
    vertexColors: src.vertexColors,
    // keep alpha-blended materials (the fire pit's faded edge) transparent
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    depthWrite: src.depthWrite,
    side: src.side,
    gradientMap,
  })
  // painted steel: a cool grey that reads as metal without needing reflections
  if (src.name === 'BrushedSteel') toon.color.set('#b9c4cc')
  return toon
}

const worldScale = new THREE.Vector3()

/**
 * Keep an outline's line the same width on screen as its piece grows. The width is in the mesh's own units, so it
 * is divided by the largest world scale the piece has reached: a piece popping in from nothing (or being eaten
 * away) gets a line that shrinks with it, instead of one sized for scale 0.0001 that would swallow the whole view.
 */
function scaleOutline(outline: THREE.Mesh) {
  // each outline needs its own uniform (clones would otherwise share the original's)
  outline.material = (outline.material as THREE.ShaderMaterial).clone()
  outline.userData.maxScale = 0
  outline.onBeforeRender = () => {
    // follow the piece's shape keys too (the mochi puffing up on the grill)
    const src = (outline.parent as THREE.Mesh | null)?.morphTargetInfluences
    if (src && outline.morphTargetInfluences) for (let i = 0; i < src.length; i++) outline.morphTargetInfluences[i] = src[i]
    outline.parent?.getWorldScale(worldScale)
    const avg = (worldScale.x + worldScale.y + worldScale.z) / 3
    if (avg > outline.userData.maxScale) {
      outline.userData.maxScale = avg
      ;(outline.material as THREE.ShaderMaterial).uniforms.uWidth.value = OUTLINE_WIDTH / avg
    }
  }
}

/** Inverted-hull ink outline: back faces pushed out along the normals. */
function makeOutline(mesh: THREE.Mesh): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: 0 }, uColor: { value: INK } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <morphtarget_pars_vertex>
      uniform float uWidth;
      void main() {
        #include <beginnormal_vertex>
        #include <morphnormal_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed + objectNormal * uWidth, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  })
  const outline = new THREE.Mesh(mesh.geometry, material)
  outline.name = `${mesh.name}_outline`
  outline.raycast = () => {}
  scaleOutline(outline)
  return outline
}

/** Keeps the broth surface showing the chosen soup base's texture. */
function BrothSurface({ scene, url }: { scene: THREE.Object3D; url: string }) {
  const texture = useTexture(url)
  useEffect(() => {
    texture.flipY = false   // glTF UV convention
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])
  // checked every frame because the parent swaps in toon materials after this mounts
  useFrame(() => {
    const broth = scene.getObjectByName('Broth') as THREE.Mesh | undefined
    const mat = broth?.material as THREE.MeshToonMaterial | undefined
    if (mat && mat.map !== texture) {
      mat.map = texture
      mat.needsUpdate = true
    }
  })
  return null
}

type DishProps = ThreeElements['group'] & {
  url: string
  /** every menu item id this model has */
  itemIds: string[]
  /** how many portions of each menu item are ordered */
  quantities: Record<string, number>
  /** broth texture for the chosen soup base */
  broth?: string
  /** object name prefixes to keep hidden (they don't go with the chosen base) */
  hidden?: string[]
  /** objects recoloured flat (texture dropped), and tinted over their texture, for the chosen base */
  fill?: Record<string, string>
  tint?: Record<string, string>
  /** item ids that rise gently into place instead of dropping in */
  floatIds?: string[]
  /** where extra portions go (see menu.ts CopyLayout); default spreads them evenly around the centre */
  layout?: CopyLayout
  /** skip the pop-in animation (prefers-reduced-motion) */
  instant?: boolean
}

/** A dish exported from blender/*.py, drawn in a hand-painted toon style, with menu items that pop in and out. */
export function Dish({ url, itemIds, quantities, broth, hidden, fill, tint, floatIds, layout, instant = false,
  ...props }: DishProps) {
  const { scene } = useGLTF(url)
  const ids = useMemo(() => new Set(itemIds), [itemIds])
  const floats = useMemo(() => new Set(floatIds), [floatIds])

  // menu-item nodes grouped by id, with their authored transform and animation state. The model has one
  // portion of each item (copy 0); extra portions are cloned on demand in the frame loop.
  const items = useMemo(() => {
    const groups = new Map<string, Piece[]>()
    scene.traverse((obj) => {
      const id = baseName(obj.name)
      if (!ids.has(id) || obj.userData.copy) return
      if (!groups.has(id)) groups.set(id, [])
      const list = groups.get(id)!
      obj.userData.itemId = id
      obj.userData.copy = 0
      // once per node (the scene is cached across remounts): remember the authored scale, then vary it
      if (!obj.userData.authoredScale) {
        obj.userData.authoredScale = obj.scale.clone()
        jitter(obj, isSkewer(id), !!layout?.slots?.[id])
      }
      list.push({ node: obj, copy: 0, index: list.length, baseScale: obj.scale.clone(), baseY: obj.position.y,
        homeP: obj.position.clone(), homeQ: obj.quaternion.clone(), on: true, s: 1, v: 0, y: 0, vy: 0 })
    })
    return groups
  }, [scene, ids])

  /** Skewers around a fire get spun about their own stick; everything else turns about the vertical. */
  // (a hoisted declaration: the items memo above calls it during the first render)
  function isSkewer(id: string) {
    return layout?.mode === 'ring' && layout.spread?.[id] === undefined && !layout.slots?.[id]
  }

  /** Every portion's pieces currently placed in the dish (for finding free spots on the fire ring). */
  const occupiedAzimuths = () => {
    // every skewer spot that exists, ordered or not, including clones made a moment ago; pieces that shuffle
    // along in the ash (layout.spread) aren't on the ring
    const out: number[] = []
    for (const [id, pieces] of items) {
      if (layout?.spread?.[id] !== undefined || layout?.slots?.[id]) continue
      for (const p of pieces) out.push(Math.atan2(p.homeP.z, p.homeP.x))
    }
    // the base fish isn't a menu item, but it takes up a spot too
    for (const name of layout?.fixed ?? []) {
      scene.traverse((o) => {
        if (baseName(o.name) === name && o.parent?.parent === scene) out.push(Math.atan2(o.position.z, o.position.x))
      })
    }
    return out
  }

  /** How far to swing a new portion of `id` around the dish's centre, by the dish's layout rule. */
  const swingFor = (id: string, src: Piece, copy: number) => {
    const spread = layout?.spread?.[id]
    if (spread !== undefined) return spread * copy                  // shuffle along beside the original
    if (layout?.mode !== 'ring') return copy * GOLDEN_ANGLE           // pots and bowls: spread evenly around
    // skewers around a fire: the free spot on the ring farthest from every other skewer, keeping clear of
    // the camera's line of sight and the plate
    const from = Math.atan2(src.homeP.z, src.homeP.x)
    const taken = occupiedAzimuths()
    const avoid = (layout.avoid ?? []).map((d) => (d * Math.PI) / 180)
    const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
    let best = 0
    let bestScore = -1
    for (let deg = 10; deg < 360; deg += 5) {
      const swing = (deg * Math.PI) / 180
      const at = from - swing                     // rotating about +Y by θ moves the azimuth by -θ
      if (avoid.some((a) => gap(at, a) < (28 * Math.PI) / 180)) continue
      const score = Math.min(...taken.map((t) => gap(at, t)))
      if (score > bestScore) {
        bestScore = score
        best = swing
      }
    }
    return best
  }

  /** Clone one more portion of an item from its authored pieces, swung around the dish's centre. */
  const addCopy = (id: string, pieces: Piece[], copy: number) => {
    const originals = pieces.filter((p) => p.copy === 0)
    const spots = layout?.slots?.[id]
    // (more portions than spots reuse them; Roasting moves waiting ones into whichever spot frees up)
    const slot = spots?.length ? spots[(copy - 1) % spots.length] : undefined
    const angle = slot ? 0 : swingFor(id, originals[0], copy)
    const swing = new THREE.Quaternion().setFromAxisAngle(UP, angle)
    for (const src of originals) {
      // start from where the piece was authored, not where it is now (it may be on the plate)
      const node = src.node.clone(true)
      node.traverse((o) => { if (o instanceof THREE.Mesh && o.name.endsWith('_outline')) scaleOutline(o) })
      node.userData = { itemId: id, copy }
      node.position.copy(src.homeP).applyAxisAngle(UP, angle)
      node.quaternion.copy(src.homeQ).premultiply(swing)
      // or set down at its own spot (the grill net), level, just turned a little
      if (slot) {
        node.position.set(slot[0], src.homeP.y, slot[1])
        node.quaternion.copy(src.homeQ).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, (Math.random() - 0.5) * 0.6))
      }
      // every portion is a little different: its own size and turn
      node.scale.copy(src.node.userData.authoredScale ?? src.baseScale)
      jitter(node, isSkewer(id), !!layout?.slots?.[id])
      const baseScale = node.scale.clone()
      node.scale.setScalar(0.0001)
      node.visible = false
      src.node.parent!.add(node)
      pieces.push({ node, copy, index: src.index, baseScale, baseY: node.position.y,
        homeP: node.position.clone(), homeQ: node.quaternion.clone(), on: false, s: 0, v: 0, y: 0, vy: 0 })
    }
  }

  useEffect(() => {
    scene.updateMatrixWorld(true)
    const toonCache = new Map<string, THREE.MeshToonMaterial>()
    const meshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !obj.name.endsWith('_outline')) meshes.push(obj)
    })
    for (const mesh of meshes) {
      mesh.castShadow = !NO_CAST.has(baseName(mesh.name))
      mesh.receiveShadow = true
      const src = mesh.material as THREE.MeshStandardMaterial
      if (!(src instanceof THREE.MeshToonMaterial)) {
        if (!toonCache.has(src.uuid)) toonCache.set(src.uuid, toToon(src))
        mesh.material = toonCache.get(src.uuid)!
      }
      // multi-material objects load as a group of meshes; use the group's name for the type
      const owner = mesh.parent && mesh.parent !== scene && !mesh.name ? mesh.parent : mesh
      const type = baseName(owner.name.replace(/_\d+$/, ''))
      if (!NO_OUTLINE.has(type) && !mesh.children.some((c) => c.name.endsWith('_outline'))) {
        mesh.add(makeOutline(mesh))
      }
    }
  }, [scene])

  // objects hidden by the chosen base
  useEffect(() => {
    const hide = new Set(hidden ?? [])
    scene.traverse((obj) => {
      const type = baseName(obj.name)
      // menu items are shown/hidden by the order in the frame loop below
      if (!ids.has(type)) obj.visible = !hide.has(type)
    })
  }, [scene, hidden, ids])

  // colours that change with the base: a different soup, sauce-coated noodles. Checked each frame because the toon
  // materials are swapped in by an effect; each material remembers its own colour and texture to go back to.
  const fillKey = JSON.stringify([fill, tint])
  useFrame(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || obj.name.endsWith('_outline')) return
      const mat = obj.material
      if (!(mat instanceof THREE.MeshToonMaterial)) return
      const owner = obj.parent && obj.parent !== scene && !obj.name ? obj.parent : obj
      const type = baseName(owner.name.replace(/_\d+$/, ''))
      if (mat.userData.fillKey === fillKey) return
      if (!mat.userData.original) mat.userData.original = { color: mat.color.clone(), map: mat.map }
      const orig = mat.userData.original as { color: THREE.Color; map: THREE.Texture | null }
      const flat = fill?.[type]
      const over = tint?.[type]
      const map = flat ? null : orig.map
      if (mat.map !== map) {
        mat.map = map
        mat.needsUpdate = true
      }
      mat.color.copy(flat ? new THREE.Color(flat) : over ? orig.color.clone().multiply(new THREE.Color(over)) : orig.color)
      mat.userData.fillKey = fillKey
    })
  })

  // items drop in from above, bounce on landing and spring up to size; taking one out shrinks it away
  const first = useRef(true)
  useFrame((_, delta) => {
    const snap = instant || first.current
    first.current = false
    const dt = Math.min(delta, 1 / 30)
    for (const [id, pieces] of items) {
      const qty = quantities[id] ?? 0
      let copies = 1 + Math.max(0, ...pieces.map((p) => p.copy))
      while (copies < qty) addCopy(id, pieces, copies++)
      const float = floats.has(id)
      pieces.forEach((p) => {
        const wanted = p.copy < qty
        const i = p.index
        if (snap) {
          p.on = wanted
          p.s = wanted ? 1 : 0
          p.v = p.y = p.vy = 0
        } else if (wanted && !p.on) {
          // start the entrance, staggering pieces of the same item
          p.on = true
          p.v = 0
          p.vy = 0
          p.s = float ? 0.85 : 0.15
          p.y = float ? -FLOAT_DEPTH : DROP_HEIGHT + i * 0.07
        } else if (!wanted && p.on) {
          p.on = false
        }

        if (!snap) {
          if (p.on && float) {
            // drift up out of the soup and ease to size
            const e = Math.min(1, dt * FLOAT_EASE)
            p.y += (0 - p.y) * e
            p.s += (1 - p.s) * e
          } else if (p.on) {
            // underdamped spring toward full size: overshoots, then settles
            p.v += (SPRING_K * (1 - p.s) - SPRING_DAMPING * p.v) * dt
            p.s += p.v * dt
            // fall, then bounce off the landing spot with some energy lost
            if (p.y > 0 || p.vy !== 0) {
              p.vy -= GRAVITY * dt
              p.y += p.vy * dt
              if (p.y <= 0) {
                p.y = 0
                p.vy = Math.abs(p.vy) > 0.25 ? -p.vy * BOUNCE : 0
              }
            }
          } else {
            p.s += (0 - p.s) * Math.min(1, dt * 12)
            p.v = 0
          }
        }

        // (userData.shrink: Roasting shrivels burnt food a little)
        const s = Math.max(p.s, 0.0001) * ((p.node.userData.shrink as number | undefined) ?? 1)
        p.node.scale.copy(p.baseScale).multiplyScalar(s)
        // once Roasting has moved a piece to the plate it owns the position
        if (!p.node.userData.onPlate) p.node.position.y = p.baseY + p.y
        p.node.visible = p.s > 0.01
      })
    }
  })

  return (
    <>
      <primitive object={scene} {...props} />
      {broth && <BrothSurface scene={scene} url={broth} />}
    </>
  )
}
