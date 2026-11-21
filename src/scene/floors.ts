import type * as THREE from 'three'

/**
 * One floor drawn at a time (item 457, the owner's 「說過了，要分開讀!」「不要一次讀兩層樓」「loading 時1層1層」, after item 350): the room
 * upstairs is on a layer of its own (DORM_LAYER, its every object on that one only), the shop on the first (0); the camera and the
 * pointer's ray on the floor being looked at, so the other isn't drawn, cast into the shadow map, or pointed at (and the shop's labels and
 * bubbles, the page's own, hidden: `data-floor` on the page). The lights are on both: the same lights lit either way, so no program is made
 * afresh going up or down (CLAUDE.md's rule 6: a change in the lights seen recompiles every material).
 */
export const DORM_LAYER = 7
export const DORM_MASK = 1 << DORM_LAYER
/** whether the floor upstairs is the one drawn (the shop's sun's shadow map not drawn again meanwhile: App's ShadowPacer) */
export const FLOOR = { up: false }
/** a subtree put on the room upstairs' layer, and only that one */
export function toDorm(root: THREE.Object3D) {
  root.traverse((o) => { if (o.layers.mask !== DORM_MASK) o.layers.mask = DORM_MASK })
}
/** every light on the room upstairs' layer as well as its own */
export function lightsBoth(scene: THREE.Object3D) {
  scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enable(DORM_LAYER) })
}
