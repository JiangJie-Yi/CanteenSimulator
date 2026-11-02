// The lamps themselves, lit or not: the paper pendants' shades, the string's globes and bulbs, the till's lantern window and the light
// behind its bamboo. Each shows its light while the room's lights are on; with them off, the plain stuff it's made of (game/roomLights'
// unlitShade: grey-white by day, a dim grey by night), by the time of day (the page's data-theme), followed as either changes.
import * as THREE from 'three'
import { unlitShade } from '@/game/roomLights'
import { getLights, onLights } from '@/scene/lightsStore'
import { replaces } from '@/scene/hot'

type Shade = { m: THREE.MeshBasicMaterial; lit: THREE.Color; litMap: THREE.Texture | null; offMap: THREE.Texture | null; dim: number }
const SHADES: Shade[] = []
const isNight = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'

function show(s: Shade, on: boolean, night: boolean) {
  if (on) s.m.color.copy(s.lit)
  else s.m.color.set(unlitShade(night)).multiplyScalar(s.dim)
  // (a lit picture painted with its light, a lamp's paper: swapped for the plain paper while it's out; both pictures, so no new shader)
  const map = on || !s.offMap ? s.litMap : s.offMap
  if (s.m.map !== map) s.m.map = map
}

/**
 * A lamp's material, lit while the room's lights are on: with them off, the unlit grey-white (`dim` of it: a bulb's glass is darker than
 * paper, the wall behind the till's bamboo dark) laid over `offMap`, a plain paper picture in place of its lit one (or its own, if none).
 */
export function lampLit<M extends THREE.MeshBasicMaterial>(m: M, { offMap = null, dim = 1 }: { offMap?: THREE.Texture | null; dim?: number } = {}): M {
  const s: Shade = { m, lit: m.color.clone(), litMap: m.map, offMap, dim }
  SHADES.push(s)
  show(s, getLights().on, isNight())
  return m
}

function lampsNow() {
  const on = getLights().on, night = isNight()
  for (const s of SHADES) show(s, on, night)
}
if (typeof document !== 'undefined') {
  const o = new MutationObserver(lampsNow)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const off = onLights(lampsNow)
  // (undone when a hot update swaps this module for a new copy, or each copy left behind kept repainting its old shades)
  replaces(import.meta.hot, () => { o.disconnect(); off() })
}
