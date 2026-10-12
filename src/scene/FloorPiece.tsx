import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { boardUVs, plankTexture } from './floorBoards'

/** the shop's floorboards: warm brown, four boards to the texture */
export const SHOP_BOARDS = plankTexture(['#8a6440', '#7d5a3a', '#94704a', '#836040'])
/** how they're laid: the way they run (along the first counter), a board's width and a texture's length (world units) */
export const BOARD_LAY = { along: new THREE.Vector3(0.81, 0, -0.59), board: 0.26, boards: 4, run: 4.2 }

/**
 * One piece of a floor laid in the shop's boards: a w × l rectangle (in its own frame, flat), its boards placed from
 * where it is in the world, so they run straight on into the next piece's. `tint` darkens it (the kitchen's).
 */
export function FloorPiece({ w, l, tint = '#ffffff', ...rest }: { w: number; l: number; tint?: string } & Record<string, unknown>) {
  const mesh = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    m.updateWorldMatrix(true, false)
    boardUVs(m.geometry, m.matrixWorld, BOARD_LAY.along, BOARD_LAY)
  })
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} receiveShadow {...rest}>
      <planeGeometry args={[w, l]} />
      <meshToonMaterial color={tint} map={SHOP_BOARDS} />
    </mesh>
  )
}
