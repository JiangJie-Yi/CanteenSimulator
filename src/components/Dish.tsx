import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

const INK = new THREE.Color('#3b2a20')
const OUTLINE_WIDTH = 0.007
// too small, thin or flat to look good with an ink line
const NO_OUTLINE = new Set(['Broth', 'FirePit', 'DriedChili', 'SichuanPepper', 'Scallion', 'Charcoal', 'PickledGreens',
  'Noodles', 'ExtraNoodles'])
// flat ground pieces: they catch shadows but shouldn't throw any
const NO_CAST = new Set(['Broth', 'FirePit'])

type Piece = {
  node: THREE.Object3D
  /** which portion this belongs to: 0 is the one authored in Blender, 1+ are clones */
  copy: number
  /** position among the pieces of one portion, for staggering the drop */
  index: number
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

/** Inverted-hull ink outline: back faces pushed out along the normals. */
function makeOutline(mesh: THREE.Mesh): THREE.Mesh {
  const scale = mesh.getWorldScale(new THREE.Vector3())
  const avg = (scale.x + scale.y + scale.z) / 3
  const material = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: OUTLINE_WIDTH / avg }, uColor: { value: INK } },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uWidth, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  })
  const outline = new THREE.Mesh(mesh.geometry, material)
  outline.name = `${mesh.name}_outline`
  outline.raycast = () => {}
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
  /** item ids that rise gently into place instead of dropping in */
  floatIds?: string[]
  /** skip the pop-in animation (prefers-reduced-motion) */
  instant?: boolean
}

/** A dish exported from blender/*.py, drawn in a hand-painted toon style, with menu items that pop in and out. */
export function Dish({ url, itemIds, quantities, broth, hidden, floatIds, instant = false, ...props }: DishProps) {
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
      list.push({ node: obj, copy: 0, index: list.length, baseScale: obj.scale.clone(), baseY: obj.position.y,
        on: true, s: 1, v: 0, y: 0, vy: 0 })
    })
    return groups
  }, [scene, ids])

  /** Clone one more portion of an item: every authored piece, swung around the dish's centre. */
  const addCopy = (id: string, pieces: Piece[], copy: number) => {
    const angle = copy * GOLDEN_ANGLE
    for (const src of pieces.filter((p) => p.copy === 0)) {
      const node = src.node.clone(true)
      node.userData = { itemId: id, copy }
      node.position.set(src.node.position.x, src.baseY, src.node.position.z).applyAxisAngle(UP, angle)
      node.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, angle))
      node.scale.setScalar(0.0001)
      node.visible = false
      src.node.parent!.add(node)
      pieces.push({ node, copy, index: src.index, baseScale: src.baseScale.clone(), baseY: node.position.y,
        on: false, s: 0, v: 0, y: 0, vy: 0 })
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

        const s = Math.max(p.s, 0.0001)
        p.node.scale.copy(p.baseScale).multiplyScalar(s)
        p.node.position.y = p.baseY + p.y
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
