/**
 * The owner's clothes as the player's chosen them (item 376): which colour each part is (data/bossOutfit), read from what's kept (anything
 * not a known part's known colour falling back to as he's made), a little store the 3D (Boss) and the panel share; and how a picture's pixel
 * is recoloured: by how light it is against the part's own colour, so the weave, the creases and the letters stay as they were drawn.
 */
import { OUTFIT_COLOURS, OUTFIT_PARTS, type OutfitPart } from '@/data/bossOutfit'

export type Outfit = Record<OutfitPart, string>
export const OUTFIT_DEFAULT: Outfit = Object.fromEntries(OUTFIT_PARTS.map((p) => [p, OUTFIT_COLOURS[p][0].id])) as Outfit
export const OUTFIT_KEY = 'jgs-boss-outfit-1'

/** what's kept made an outfit: each part a colour it has, else as he's made */
export function readOutfit(raw: unknown): Outfit {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(OUTFIT_PARTS.map((p) => [p, OUTFIT_COLOURS[p].some((c) => c.id === o[p]) ? (o[p] as string) : OUTFIT_DEFAULT[p]])) as Outfit
}
/** the part's chosen colour (0..1 sRGB), or null: as he's made */
export function colourOf(o: Outfit, part: OutfitPart): [number, number, number] | null {
  const hex = OUTFIT_COLOURS[part].find((c) => c.id === o[part])?.hex
  if (!hex) return null
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
/** one key for an outfit (what's made of it is kept by it) */
export const outfitKey = (o: Outfit) => OUTFIT_PARTS.map((p) => o[p]).join('|')

const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
/**
 * A pixel (0..1 sRGB) of a part whose own colour is `base`, in the colour `target`: the target, as much lighter or darker as the pixel is than
 * the part's colour (a crease darker, the weave's light threads lighter; letters far lighter than a dark cloth, white still)
 */
export function recolour(px: readonly number[], base: readonly number[], target: readonly number[]): [number, number, number] {
  const k = lum(px) / Math.max(1e-3, lum(base))
  // (far lighter than its cloth (letters, a print): toward white, not a brighter shade of the dye; on a light dye (a white headband) the
  // print in the cloth's own colour as it was painted, as a white tenugui's is printed: white on white it was gone (item 376))
  const w = Math.min(1, Math.max(0, (k - 1.6) / 2.4))
  const light = lum(target) > LIGHT_DYE
  return [0, 1, 2].map((i) => Math.min(1, target[i] * k) * (1 - w) + w * (light ? base[i] : Math.min(1, px[i] * 1.0 + 0.04))) as [number, number, number]
}
/** a dye this light or lighter takes its print dark (the cloth's own colour), not white */
export const LIGHT_DYE = 0.6

/** a part's recolouring: its own colour as painted, the colour it's to be (0..1 sRGB) */
export type Dye = { base: readonly number[]; target: readonly number[] }
/**
 * A picture's pixels (RGBA bytes, `src`) recoloured into `out` as `recolour` does each one, without a new array a pixel (half a million of
 * them at a click): pixel p by its part, `partOf[p]` (0: as it is; k: `dyes[k - 1]`, null: as it is), or all by `dyes[0]` with no `partOf`
 */
export function recolourPixels(src: ArrayLike<number>, out: { [i: number]: number; length: number }, partOf: ArrayLike<number> | null, dyes: ReadonlyArray<Dye | null>) {
  const ks = dyes.map((d) => d && { b: Math.max(1e-3, lum(d.base)), t0: d.target[0], t1: d.target[1], t2: d.target[2], light: lum(d.target) > LIGHT_DYE, b0: d.base[0], b1: d.base[1], b2: d.base[2] })
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    const part = partOf ? partOf[p] : 1
    const q = part ? ks[part - 1] : null
    const r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255
    out[i + 3] = src[i + 3]
    if (!q) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; continue }
    const k = (0.2126 * r + 0.7152 * g + 0.0722 * b) / q.b
    const w = Math.min(1, Math.max(0, (k - 1.6) / 2.4))
    out[i] = Math.round((Math.min(1, q.t0 * k) * (1 - w) + w * (q.light ? q.b0 : Math.min(1, r + 0.04))) * 255)
    out[i + 1] = Math.round((Math.min(1, q.t1 * k) * (1 - w) + w * (q.light ? q.b1 : Math.min(1, g + 0.04))) * 255)
    out[i + 2] = Math.round((Math.min(1, q.t2 * k) * (1 - w) + w * (q.light ? q.b2 : Math.min(1, b + 0.04))) * 255)
  }
}

// ---- the store: the outfit now, and who wants telling when it changes
let now: Outfit = OUTFIT_DEFAULT
const subs = new Set<() => void>()
export const getOutfit = () => now
export function setOutfit(o: Outfit) {
  if (outfitKey(o) === outfitKey(now)) return
  now = o
  for (const f of subs) f()
}
export function subscribeOutfit(f: () => void) { subs.add(f); return () => { subs.delete(f) } }
