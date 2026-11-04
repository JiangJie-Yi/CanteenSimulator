import { useRef, type RefObject } from 'react'
import { createPortal, useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A point light that hangs in the scene itself, following a mark where it's placed: so hiding what it's in doesn't take it away. A piece
 * kept out of sight until it's been measured (Movable) hid its light with it, and the scene's count of lights changed as it came back: every
 * material compiled meanwhile was compiled again, about seventy programs kept for nothing. Its intensity and the rest are its own, set
 * through `light` as before.
 */
export function AnchoredLight({ light, position, ...props }: { light?: RefObject<THREE.PointLight | null>; position: [number, number, number] } & Omit<ThreeElements['pointLight'], 'position' | 'ref'>) {
  const mark = useRef<THREE.Group>(null)
  const own = useRef<THREE.PointLight>(null)
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const m = mark.current, l = own.current
    if (!m || !l) return
    m.getWorldPosition(l.position)
  })
  return (
    <>
      <group ref={mark} position={position} />
      {createPortal(<pointLight ref={(l: THREE.PointLight | null) => { own.current = l; if (light) light.current = l }} {...props} />, scene)}
    </>
  )
}
