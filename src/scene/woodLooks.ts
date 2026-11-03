import * as THREE from 'three'

/*
 * The shop's three grades of wood, one place for them (the owner's: the wood looked of a piece nowhere, some of it like cheap plastic film
 * or stretched): what each is like, and the material made from it, matte (no wood is a mirror or a metal: rough 0.35 to 0.7, metal 0).
 *  - counter: hinoki and thick solid wood, the counters' tops and the pass's shelf: a warm honey, fine straight grain, a soft sheen
 *  - floor: the shop's floorboards: a deep walnut brown, boards a real width with their seams, matte
 *  - rustic: old cedar, the buckets, the crates, the stools: a darker, smoked tone, its grain deeper
 * Pieces made elsewhere (Blender's, the game's own textures) take the look by its name; their grain stays theirs.
 */
export type WoodGrade = 'counter' | 'floor' | 'rustic'
export const WOOD_LOOK: Record<WoodGrade, { tint: string; roughness: number; boards?: string[] }> = {
  counter: { tint: '#ffffff', roughness: 0.35 },
  floor: { tint: '#ffffff', roughness: 0.65, boards: ['#6e4628', '#633e22', '#75502f', '#5c3a1f', '#6a4429'] },
  rustic: { tint: '#d9c7b4', roughness: 0.7 },
}

/** a wood's material over its grain `map`: lit as the room is (standard, not toon: its roughness is what makes it read as wood, not paint) */
export function woodMaterial(grade: WoodGrade, map: THREE.Texture | null, tint?: string) {
  const look = WOOD_LOOK[grade]
  return new THREE.MeshStandardMaterial({ color: tint ?? look.tint, map, roughness: look.roughness, metalness: 0 })
}
