import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { inkModel } from '@/scene/inkHull'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * A beckoning cat (招き猫), about 0.2 tall, facing +z, from the model "Lucky cat with animation cute maneki neko" by Noth+
 * Studio (CC BY 4.0, via Sketchfab; see the credits in README.md): its paw waves, the shop's way.
 *
 * The model's skin is baked into a few plain poses along the wave (a skinned mesh can't be merged into a StaticBatch, and
 * costs more to draw); `still` shows one pose, the default plays the wave by stepping through them there and back.
 */
/** the three models (the first waves, the others are still ones), how much taller each comes out than asked for, and the turn that brings its face to +z (measured) */
const MODELS = [
  { url: import.meta.env.BASE_URL + 'models/luckycat1.glb', fudge: 0.5 },
  { url: import.meta.env.BASE_URL + 'models/luckycat2.glb', fudge: 0.5 },
  { url: import.meta.env.BASE_URL + 'models/luckycat3.glb', fudge: 0.5, yaw: -Math.PI / 2 },
]
/** how tall each stands in the shop, unless said otherwise */
const HEIGHT = 0.2
/** the poses: the wave's lift, from its start up to the paw's highest, at these moments of the clip (seconds) */
const POSES = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3, 7.2, 8]
const STILL = 5.4

function bake(gltf: Pick<GLTF, 'scene' | 'animations'>, at: number, tint: THREE.Color | null) {
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
    const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial
    const mat = new THREE.MeshToonMaterial({ color: src.color?.clone() ?? new THREE.Color('#ffffff'), map: src.map ?? null, side: THREE.DoubleSide })
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
    const baked = times.map((t) => bake(gltf, t, tint))
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
    return baked.map((parts) => parts.map(({ g, mat }) => { g.applyMatrix4(place); return { g, mat } }))
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
          {parts.map(({ g, mat }, j) => <mesh key={j} geometry={g} material={mat} castShadow ref={(m) => { if (m) inkModel(m) }} />)}
        </group>
      ))}
    </group>
  )
}

for (const m of MODELS) useGLTF.preload(m.url)
