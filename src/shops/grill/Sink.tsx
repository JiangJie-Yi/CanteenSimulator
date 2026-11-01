// The kitchen's sink (blender/sink.py): a Japanese one, as an old shop's kitchen has it, against the back past the freezer: its counter
// and deep basin of terrazzo, its dark sugi cabinet with an indigo noren under the basin and slatted sliding doors, a brass tap with a
// cloth bag tied over its mouth, a bamboo draining basket of plates, a hinoki pail. The customers' dirty plates are washed in it:
// GuestBar3D sets SINK.washing while they are, and the tap runs into the basin.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { reflectStudio, useStudio } from '@/scene/studio'
import { SINK } from './bar'

const URL = import.meta.env.BASE_URL + 'models/sink.glb'
/** the brass and the copper: real metal, reflecting the studio (it only reads as metal by what it reflects) */
const METAL = /^Sink(Brass|Copper)$/
/** too fine for an ink line, or cloth: the tap's arms and knobs, its bag and string, the rods, rims and pegs, the plates' rims, the slats */
const FINE = /^Sink(Tap(Arm|Knob|String|Bag|Cap|Stem)|BasketRim|BasketFoot|NorenRod|Noren\d|Towel|Pull|RackPlateRim|DrainHole|Slat|PailWater)/
/** cloth, seen from either side */
const CLOTH = /^Sink(Noren|Cloth)$/

const WATER = new THREE.MeshBasicMaterial({ color: '#cfeaf6', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })
const SPLASH = new THREE.MeshBasicMaterial({ color: '#e8f6fc', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })

export function SinkModel() {
  useStudio()
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { root, tip, floor } = useMemo(() => {
    const r = gltf.scene.clone(true)
    const mats = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) {
        if (METAL.test(src.name)) {
          const g = new THREE.MeshStandardMaterial({ color: src.color.clone(), metalness: 0.85, roughness: Math.max(0.22, src.roughness), envMapIntensity: 0.9 })
          reflectStudio(g)
          t = g
        } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, side: CLOTH.test(src.name) ? THREE.DoubleSide : THREE.FrontSide })
        t.name = src.name
        mats.set(src, t)
      }
      m.material = t
      m.castShadow = !FINE.test(m.name)
      m.receiveShadow = true
    })
    inkModel(r, (m) => FINE.test(m.name), { width: 0.004, weld: true })
    r.updateMatrixWorld(true)
    const at = (n: string) => r.worldToLocal(r.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()))
    const tip = at('SinkSpoutTip'), floor = at('SinkBasinFloor')
    // (never moving: a mesh or two for each material, its ink one line; the marks the game reads (the tap's mouth, the basin's floor) kept)
    mergeByMaterial(r)
    return { root: r, tip, floor }
  }, [gltf])
  // the tap running while the plates are being washed: a stream from its mouth to the basin's floor, wavering, a splash ring where it lands
  const stream = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const len = tip.y - floor.y
  useFrame(({ clock }) => {
    const on = SINK.washing
    const t = clock.elapsedTime
    if (stream.current) {
      stream.current.visible = on
      if (on) stream.current.scale.set(1 + Math.sin(t * 31) * 0.12, 1, 1 + Math.cos(t * 27) * 0.12)
    }
    if (ring.current) {
      ring.current.visible = on
      if (on) { const k = 1 + ((t * 2.4) % 1) * 1.6; ring.current.scale.set(k, k, k); (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ((t * 2.4) % 1)) }
    }
  })
  return (
    <group>
      <primitive object={root} />
      <mesh ref={stream} position={[tip.x, floor.y + len / 2, tip.z]} material={WATER} visible={false}>
        <cylinderGeometry args={[0.007, 0.009, len, 8, 1, true]} />
      </mesh>
      <mesh ref={ring} position={[floor.x, floor.y + 0.004, floor.z]} rotation-x={-Math.PI / 2} material={SPLASH.clone()} visible={false}>
        <ringGeometry args={[0.012, 0.022, 20]} />
      </mesh>
    </group>
  )
}
useGLTF.preload(URL)
