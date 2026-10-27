import * as THREE from 'three'

/**
 * The "you're pointing at this" glow for anything that can be clicked or carried: while the pointer is over it, the object
 * (every mesh under it) is lifted in brightness and given a warm glow. Each mesh gets copies of its materials for the
 * duration, so something that shares a material with others lights alone; the originals are put back when the pointer leaves.
 */
const GLOW = new THREE.Color('#ff9a40')
const WAS = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>()
const LIT = new Set<THREE.Object3D>()

function brighten(m: THREE.Material): THREE.Material {
  const c = m.clone()
  const mm = c as THREE.MeshToonMaterial & THREE.MeshBasicMaterial
  if ('emissive' in c) {
    // (lit materials: a warm emissive, and the colour itself a little lighter)
    mm.emissive = GLOW.clone()
    // (more on a physically lit one: dark wood under the room's light hardly shows a little)
    mm.emissiveIntensity = Math.max(mm.emissiveIntensity ?? 0, 0) + ((c as THREE.MeshStandardMaterial).isMeshStandardMaterial ? 0.5 : 0.32)
    if (mm.color) mm.color = mm.color.clone().multiplyScalar(1.04)
  } else if (mm.color) {
    // (unlit ones, which have no emissive: the colour lifted and warmed)
    mm.color = mm.color.clone().lerp(GLOW, 0.14).multiplyScalar(1.12)
  }
  return c
}

/** while edit mode is on, nothing in the room lights up under the pointer (edit.ts sets it) */
export const HOVER = { paused: false }

export function glowOn(root: THREE.Object3D | null | undefined) {
  if (!root || LIT.has(root) || HOVER.paused) return
  LIT.add(root)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.material || WAS.has(m)) return
    // (the ink outlines, drawn inside out, stay as they were)
    const mats = ([] as THREE.Material[]).concat(m.material)
    if (mats.every((x) => x.side === THREE.BackSide)) return
    WAS.set(m, m.material)
    m.material = Array.isArray(m.material) ? m.material.map(brighten) : brighten(m.material)
  })
}

export function glowOff(root: THREE.Object3D | null | undefined) {
  if (!root || !LIT.has(root)) return
  LIT.delete(root)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    const was = WAS.get(m)
    if (!was) return
    const now = ([] as THREE.Material[]).concat(m.material)
    for (const x of now) x.dispose()
    m.material = was
    WAS.delete(m)
  })
}

/** the one thing lit by the pointer just now (moving to another puts the last one out) */
let current: THREE.Object3D | null = null
export function glowOnly(root: THREE.Object3D | null | undefined) {
  if (root === current) return
  glowOff(current)
  current = root ?? null
  glowOn(current)
}
/** the pointer has left this one: put it out, and only it (what's lit now may be something else, lit since, that stays lit) */
export function glowLeave(root: THREE.Object3D | null | undefined) {
  if (!root) return
  if (root === current) glowOnly(null)
  else glowOff(root)
}
