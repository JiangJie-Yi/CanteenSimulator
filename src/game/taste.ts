// How good food is: the rules every shop and screen judge by, kept out of the components so they can be tested
// and shared without one shop importing another.
import type { Bake, Seasoning } from '@/data/menu'
import type { Topping } from '@/data/recipes'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 美味: how well each seasoning goes with each food, from the way they're eaten in Japan and Taiwan — salt on
 * fish, meat and plain vegetables; sweet soy on rice, mochi, mushrooms, corn and squid; condensed milk and
 * peanut powder on mochi and sweet potato (Taiwanese style); none of them suit everything. The first dab counts
 * in full, a second adds a little more, and from the third it's overdone.
 */
export const PAIRING: Record<Exclude<Seasoning, 'water'>, Record<string, number>> = {
  salt: { Fish: 18, ExtraFish: 18, Saury: 18, Mackerel: 16, Aji: 18, Iwashi: 16, Shishamo: 14, Salmon: 18, Hokke: 16, Buri: 10,
    Gindara: 8, Nodoguro: 20,  ShrimpSkewer: 10, Yakitori: 12, PorkBelly: 10, Shishito: 8,
    Asparagus: 10, Okra: 8, KingOyster: 8, GrilledShiitake: 8, GrilledCorn: 6, Potato: 14, Scallop: 8, Onigiri: 4,
    Sausage: -4, NetMochi: -10, SweetPotato: -6, Squid: 4, BloodCake: -6 },
  soy: { Buri: 18, Salmon: 12, Gindara: 16, Hokke: 6, Aji: 4, Iwashi: 8, Shishamo: 4, Nodoguro: 4, Onigiri: 18, NetMochi: 15, GrilledCorn: 15, GrilledShiitake: 15, KingOyster: 12, Scallop: 14, Squid: 15,
    Yakitori: 10, PorkBelly: 8, Fish: 4, ExtraFish: 4, Saury: 6, Mackerel: 6, Asparagus: 6, Okra: 8, Shishito: 8,
    Potato: 5, SweetPotato: -5, Sausage: -2, ShrimpSkewer: 5, BloodCake: 12 },
  milk: { Salmon: -12, Buri: -14, Gindara: -12, Hokke: -14, Aji: -16, Iwashi: -16, Shishamo: -14, Nodoguro: -16, NetMochi: 18, SweetPotato: 15, GrilledCorn: 6, Potato: -8, BloodCake: -10 },
  peanut: { NetMochi: 18, BloodCake: 18, SweetPotato: 8, GrilledCorn: 4, Sausage: 6 },
}
/** what a seasoning does to a food the table doesn't list (condensed milk on a fish…) */
export const PAIRING_DEFAULT: Record<Exclude<Seasoning, 'water'>, number> = { salt: 4, soy: 3, milk: -18, peanut: -12 }

/** 美味: doneness first (doughy, golden best, burnt bad), then how the fillings suit the dough */
export function breadTaste(bake: Bake, id: string, dabs: Topping[], r: number) {
  let t = r < 0.6 ? 12 : r < 0.9 ? 25 + (r - 0.6) * 100 : r < 1.3 ? 58 + (1 - Math.abs(r - 1.1) * 4) * 8 : r < 1.8 ? 55 - (r - 1.3) * 60 : 10
  const pair = bake.pairing[id] ?? {}
  dabs.forEach((k, i) => { t += (pair[k] ?? -6) * (i === 0 ? 1 : 0.6) })
  if (dabs.length > 2) t -= (dabs.length - 2) * 12
  return Math.round(clamp(t, 0, 100))
}

/** 1-5 stars for a taste (0-100) */
export const starsOf = (taste: number) => Math.max(1, Math.min(5, Math.round(taste / 20)))
export const starText = (taste: number) => '★'.repeat(starsOf(taste)) + '☆'.repeat(5 - starsOf(taste))

/** which face a rating gets (the number itself isn't shown) */
export const moodOf = (r: number | null) => r === null ? 'wait' : r >= 80 ? 'love' : r >= 65 ? 'happy' : r >= 45 ? 'ok' : r >= 25 ? 'meh' : 'sad'
