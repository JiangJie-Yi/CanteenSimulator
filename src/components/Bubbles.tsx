import { useMemo, useRef, type RefObject } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

type BubblesProps = ThreeElements['group'] & {
  /** radius of the soup surface */
  radius: number
  /** 0..1 how hard it's boiling, read every frame (0 = still, 1 = rolling boil) */
  boil: RefObject<number>
  max?: number
}

type Bubble = { x: number; z: number; age: number; life: number; size: number; alive: boolean }

const dummy = new THREE.Object3D()

/**
 * Bubbles breaking the soup surface while it boils: each one swells up as a little dome, then pops.
 * More of them, bigger and quicker, the harder the boil.
 */
export function Bubbles({ radius, boil, max = 90, ...props }: BubblesProps) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [])
  const material = useMemo(
    () => new THREE.MeshToonMaterial({ color: '#fff3e8', transparent: true, opacity: 0.75, depthWrite: false }),
    [],
  )
  const bubbles = useMemo<Bubble[]>(
    () => Array.from({ length: max }, () => ({ x: 0, z: 0, age: 0, life: 1, size: 0, alive: false })),
    [max],
  )
  const spawnDebt = useRef(0)

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    const b = boil.current ?? 0

    // spawn rate grows with the boil: a few lazy bubbles at a simmer, lots at a rolling boil
    spawnDebt.current += b > 0 ? (6 + 70 * b * b) * dt : 0
    for (const bub of bubbles) {
      if (spawnDebt.current < 1) break
      if (bub.alive) continue
      spawnDebt.current -= 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * radius * 0.9
      bub.x = Math.cos(a) * r
      bub.z = Math.sin(a) * r
      bub.age = 0
      bub.life = 0.35 + Math.random() * 0.5 * (1.2 - b)
      bub.size = (0.025 + Math.random() * 0.042) * (0.7 + 0.6 * b)
      bub.alive = true
    }
    spawnDebt.current = Math.min(spawnDebt.current, 3)

    bubbles.forEach((bub, i) => {
      let s = 0
      if (bub.alive) {
        bub.age += dt
        const t = bub.age / bub.life
        if (t >= 1) bub.alive = false
        else s = bub.size * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (t > 0.85 ? (1 - t) / 0.15 : 1)
      }
      dummy.position.set(bub.x, 0, bub.z)
      dummy.scale.set(s, s * 0.8, s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <group {...props}>
      <instancedMesh ref={mesh} args={[geometry, material, max]} frustumCulled={false} renderOrder={1} />
    </group>
  )
}
