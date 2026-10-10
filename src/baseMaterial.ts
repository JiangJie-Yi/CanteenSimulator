import type * as THREE from 'three'

/**
 * The material each mesh had before a piece of food was given its own (Roasting browns and chars every skewer on
 * its own copy). When Dish clones a piece for another portion it starts from these, not from the copy the first
 * portion has been cooked, bitten into and lit up on.
 */
export const BASE_MATERIAL = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>()
