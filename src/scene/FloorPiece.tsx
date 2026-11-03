import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { boardUVs, plankTexture } from './floorBoards'
import { WOOD_LOOK, woodMaterial } from './woodLooks'

/** the shop's floorboards (woodLooks' floor: a deep walnut, five boards to the texture) */
export const SHOP_BOARDS = plankTexture(WOOD_LOOK.floor.boards!, 5)
/** how they're laid: the way they run (along the first counter), a board's width and a texture's length (world units): wide boards as
 * before (the owner's: at 15 cm they read as a bamboo mat) */
export const BOARD_LAY = { along: new THREE.Vector3(0.81, 0, -0.59), board: 0.26, boards: 5, run: 4.2 }
/** the floor's material, one for every piece (matte; a tint, the kitchen's darker, its own copy) */
const FLOOR_MATS = new Map<string, THREE.Material>()
const floorMat = (tint: string) => {
  let m = FLOOR_MATS.get(tint)
  if (!m) { m = woodMaterial('floor', SHOP_BOARDS, tint); FLOOR_MATS.set(tint, m) }
  return m
}

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
    <mesh ref={mesh} rotation-x={-Math.PI / 2} receiveShadow material={floorMat(tint)} {...rest}>
      <planeGeometry args={[w, l]} />
    </mesh>
  )
}
