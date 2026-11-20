import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BAKE_COATS, coatPicture, SUZU_MAT, suzuAt, thicken, type Coat } from './catCoat'

/**
 * A beckoning cat (招き猫), about 0.2 tall, facing +z, from the model "Lucky cat with animation cute maneki neko" by Noth+
 * Studio (CC BY 4.0, via Sketchfab; see the credits in README.md): its paw waves, the shop's way.
 *
 * The model's skin is baked into a few plain poses along the wave (a skinned mesh can't be merged into a StaticBatch, and
 * costs more to draw); `still` shows one pose, the default plays the wave by stepping through them there and back.
 */
/** the three models (the first waves, the others are still ones), how much taller each comes out than asked for, and the turn that brings its face to +z (measured) */
/** (items 429, 432) each its own coat (catCoat's); the third's bell is part of its one mesh: where it is as made (its gold's middle and its
 * radius, measured on its picture's colour) */
const MODELS: { url: string; fudge: number; yaw?: number; coat: Coat; bell?: { at: [number, number, number]; r: number } }[] = [
  { url: import.meta.env.BASE_URL + 'models/luckycat1.glb', fudge: 0.5, coat: 'ginger' },
  { url: import.meta.env.BASE_URL + 'models/luckycat2.glb', fudge: 0.5, coat: 'saddle' },
  { url: import.meta.env.BASE_URL + 'models/luckycat3.glb', fudge: 0.5, yaw: -Math.PI / 2, coat: 'tux', bell: { at: [0.454, 0.554, -0.035], r: 0.09 } },
]
/** (item 429) how much thicker the coins they hold are made */
const COIN_THICK = 1.6
/** how tall each stands in the shop, unless said otherwise */
const HEIGHT = 0.2
/** the poses: the wave's lift, from its start up to the paw's highest, at these moments of the clip (seconds) */
const POSES = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3, 7.2, 8]
const STILL = 5.4

/**
 * The model's texture has three paw pads (pink, brown, brown) laid out for the soles of the paws, but on the raised arm they land on the arm's
 * outer side and show as a fan of brown streaks. Painted out here, in the white of the fur round them, once per texture. (The spots were measured on the first model's texture alone: on the others they would land on the face.)
 */
const cleaned = new WeakMap<THREE.Texture, THREE.Texture>()
function clean(tex: THREE.Texture): THREE.Texture {
  const hit = cleaned.get(tex)
  if (hit) return hit
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  if (!img || typeof document === 'undefined' || img.width < 256) return tex
  const k = img.width / 1024
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  // (the pads, as ellipses round each cluster of toes and the pad: x, y, half-width, half-height, in the 1024 square)
  for (const [x, y, w, h] of [[500, 72, 72, 66], [757, 380, 74, 70], [943, 498, 72, 70], [655, 764, 66, 70]] as number[][]) {
    g.fillStyle = '#f8f6f2'
    g.beginPath(); g.ellipse(x * k, y * k, w * k, h * k, 0, 0, Math.PI * 2); g.fill()
  }
  const out = new THREE.CanvasTexture(c)
  out.flipY = tex.flipY
  out.colorSpace = tex.colorSpace
  out.wrapS = tex.wrapS
  out.wrapT = tex.wrapT
  out.anisotropy = tex.anisotropy
  out.userData.cleanOf = tex
  cleaned.set(tex, out)
  return out
}

function bake(gltf: Pick<GLTF, 'scene' | 'animations'>, at: number, tint: THREE.Color | null, tidy: boolean) {
  const root = cloneSkinned(gltf.scene) as THREE.Group
  const mixer = new THREE.AnimationMixer(root)
  if (gltf.animations.length) mixer.clipAction(gltf.animations[0]).play()
  mixer.setTime(at)
  root.updateMatrixWorld(true)
  const out: { g: THREE.BufferGeometry; mat: THREE.Material }[] = []
  const v = new THREE.Vector3()
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isMesh) return
    const g = m.geometry.clone()
    const pos = g.attributes.position
    if (m.isSkinnedMesh) m.skeleton.update()
    for (let i = 0; i < pos.count; i++) {
      if (m.isSkinnedMesh) m.getVertexPosition(i, v)
      else v.fromBufferAttribute(pos, i)
      v.applyMatrix4(m.matrixWorld)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.deleteAttribute('skinIndex')
    g.deleteAttribute('skinWeight')
    g.computeVertexNormals()
    // (its bounds measured afresh from the posed points: the source's own were for the model's bind pose and units, and culled the cat away
    // as the camera came near, so that it flickered out)
    g.boundingBox = null
    g.boundingSphere = null
    g.computeBoundingSphere()
    const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial
    const mat = new THREE.MeshToonMaterial({ color: src.color?.clone() ?? new THREE.Color('#ffffff'), map: src.map ? (tidy ? clean(src.map) : src.map) : null, side: THREE.DoubleSide })
    mat.name = src.name ?? ''
    // (a differently coloured cat: the body's own material takes the tint)
    if (tint && src.map && !/coin|ring|red/i.test(src.name)) mat.color.lerp(tint, 0.85)
    out.push({ g, mat })
  })
  return out
}

export function LuckyCat({ kind = 1, height = HEIGHT, still = false }: { kind?: 1 | 2 | 3; height?: number; still?: boolean }) {
  const model = MODELS[kind - 1]
  const gltf = useGLTF(model.url)
  const frames = useMemo(() => {
    const tint = null
    // (only the first has a wave to play; the others are one pose)
    const times = still || kind !== 1 ? [STILL] : POSES
    const baked = times.map((t) => bake(gltf, t, tint, kind === 1))
    // (its size and where it stands: scaled to HEIGHT tall, centred, its feet on the ground, by a middle pose's extent)
    const box = new THREE.Box3()
    for (const { g } of baked[Math.min(baked.length - 1, 4)]) {
      g.computeBoundingBox()
      box.union(g.boundingBox!)
    }
    const size = box.getSize(new THREE.Vector3())
    const k = (height * model.fudge) / size.y
    const centre = box.getCenter(new THREE.Vector3())
    const place = new THREE.Matrix4().makeRotationY((model as { yaw?: number }).yaw ?? 0).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z))
    // (and its bounds measured again where it now stands: carried through the placing they came out a speck (1 cm across), and the cat was
    // culled away whenever that speck's place went off the edge of the picture, so it vanished now and then)
    const placed = baked.map((parts) => parts.map(({ g, mat }) => {
      g.applyMatrix4(place)
      g.boundingBox = null
      g.boundingSphere = null
      g.computeBoundingSphere()
      return { g, mat }
    }))
    // (items 429, 432: each one's bell (theirs a plain gold ball) put away and the made one set where it was, a little bigger round it; their
    // coins made thicker; their coats worked on their pictures)
    const isBell = (m: THREE.Material) => /^(Bell|Ring)$/.test(m.name)
    const isCoin = (m: THREE.Material) => /coin/i.test(m.name)
    const first = placed[0]
    const bells: { at: THREE.Vector3; r: number }[] = []
    for (const { g, mat } of first) if (isBell(mat)) {
      g.computeBoundingBox()
      const bb = g.boundingBox!, sz = bb.getSize(new THREE.Vector3())
      bells.push({ at: bb.getCenter(new THREE.Vector3()), r: Math.max(sz.x, sz.y, sz.z) / 2 * 1.08 })
    }
    if (model.bell) bells.push({ at: new THREE.Vector3(...model.bell.at).applyMatrix4(place), r: model.bell.r * 1.1 * k })
    const box0 = new THREE.Box3()
    for (const { g, mat } of first) if (!isBell(mat) && !isCoin(mat) && mat.name !== 'RedMat') { g.computeBoundingBox(); box0.union(g.boundingBox!) }
    // (their coats are in their models' pictures (scripts/bake-cat-coats.mjs); worked out here only for that script)
    const coats = new Map<THREE.Texture, THREE.Texture>()
    if (BAKE_COATS) for (const { mat } of first) {
      const map = (mat as THREE.MeshToonMaterial).map
      if (!map || coats.has(map) || isBell(mat) || isCoin(mat) || mat.name === 'RedMat') continue
      coats.set(map, coatPicture(map, first.filter((q) => (q.mat as THREE.MeshToonMaterial).map === map).map((q) => q.g), box0, model.coat))
    }
    return placed.map((parts) => [
      ...parts.filter(({ mat }) => !isBell(mat)).map(({ g, mat }) => {
        if (isCoin(mat)) thicken(g, COIN_THICK)
        const tm = mat as THREE.MeshToonMaterial
        if (tm.map && coats.has(tm.map)) tm.map = coats.get(tm.map)!
        return { g, mat }
      }),
      ...bells.map((b) => ({ g: suzuAt(b.at, b.r), mat: SUZU_MAT as THREE.Material })),
    ])
  }, [gltf, kind, height, model, still])
  const group = useRef<THREE.Group>(null)
  const t = useRef(Math.random() * 10)
  useFrame((_, dt) => {
    if (still || kind !== 1 || !group.current) return
    // (up and down the wave, a few poses a second)
    t.current += Math.min(dt, 0.1) * 5
    const n = frames.length
    const cycle = 2 * (n - 1)
    const i = Math.floor(t.current) % cycle
    const shown = i < n ? i : cycle - i
    group.current.children.forEach((c, k) => { c.visible = k === shown })
  })
  return (
    <group ref={group} name="lucky-cat">
      {frames.map((parts, i) => (
        <group key={i} visible={still || kind !== 1 || i === 0}>
          {parts.map(({ g, mat }, j) => <mesh key={j} geometry={g} material={mat} castShadow  />)}
        </group>
      ))}
    </group>
  )
}

for (const m of MODELS) useGLTF.preload(m.url)
