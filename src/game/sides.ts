/**
 * The rice and the miso soup had with the dishes (items 205, 206, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？
 * 我要看到好的動畫品質」): who adds them, and how a bowl of each is filled at the counter, beat by beat (the hands, the paddle, the ladle
 * and the bowl follow these in the scene).
 */
import { FISH } from '@/data/foodKinds'

/** how likely one sat in adds a bowl of rice, and of miso soup, to what they've ordered: most of those having a fish (a grilled fish with
 * rice and soup is the meal), fewer having only skewers or mochi (the soup was added by one in three, whatever they had; rice by no one) */
export function sideChance(kind: 'rice' | 'soup', orders: readonly string[]) {
  const fish = orders.some((x) => FISH.includes(x))
  return kind === 'rice' ? (fish ? 0.7 : 0.35) : (fish ? 0.6 : 0.3)
}

export type Beats = readonly (readonly [string, number])[]
/** a bowl of rice at the cooker, beat by beat (seconds): its lid lifted off and held up back, a bowl taken up in the left hand, the paddle in
 * the right, two scoops from the pot into the bowl, the heap patted round, the paddle back in its stand, the lid down on */
export const RICE_BEATS: Beats = [['lid', 0.45], ['bowl', 0.4], ['paddle', 0.35], ['scoop', 0.8], ['scoop', 0.8], ['pat', 0.45], ['paddleBack', 0.35], ['lidOn', 0.45]]
/** a bowl of miso soup at the pot: a bowl taken up, the ladle, two ladlefuls dipped and poured in, the ladle back on the pot's rim */
export const SOUP_BEATS: Beats = [['bowl', 0.4], ['ladle', 0.35], ['dip', 0.5], ['pour', 0.55], ['dip', 0.5], ['pour', 0.55], ['ladleBack', 0.35]]
export const beatsLength = (b: Beats) => b.reduce((s, [, d]) => s + d, 0)

/** where in its beats a time is: the beat, how far through it (0..1), which of its kind it is (0 the first scoop, 1 the second), its index */
export function beatAt(b: Beats, t: number): { beat: string; k: number; n: number; i: number } {
  let at = 0
  const seen: Record<string, number> = {}
  for (let i = 0; i < b.length; i++) {
    const [beat, d] = b[i]
    const n = seen[beat] ?? 0
    seen[beat] = n + 1
    if (t < at + d || i === b.length - 1) return { beat, k: Math.max(0, Math.min(1, (t - at) / d)), n, i }
    at += d
  }
  return { beat: b[b.length - 1][0], k: 1, n: 0, i: b.length - 1 }
}

/** how full the bowl is at a time: each beat of the filling kind (`fills`: the scoops, the pours) adding its share as it goes in, the rice's
 * as it's tipped off the paddle over the bowl (the scoop's last quarter or so), the soup's as the ladle's tipped (the pour's middle) */
export function fillAt(b: Beats, fills: string, t: number) {
  const all = b.filter(([x]) => x === fills).length
  if (!all) return 0
  let at = 0, got = 0
  for (const [beat, d] of b) {
    if (beat === fills) {
      const k = Math.max(0, Math.min(1, (t - at) / d))
      got += fills === 'scoop' ? Math.max(0, Math.min(1, (k - 0.72) / 0.2)) : Math.max(0, Math.min(1, (k - 0.4) / 0.45))
    }
    at += d
  }
  return Math.min(1, got / all)
}
