// How good food is: the rules every shop and screen judge by, kept out of the components so they can be tested
// and shared without one shop importing another.
import type { Seasoning } from '@/data/menu'
import type { Stage } from '@/game/types'


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
  // 味噌焼き: Saikyo miso on black cod above all, then oily fish, rice balls, mushrooms and pork
  miso: { Gindara: 20, Mackerel: 14, Salmon: 14, Buri: 12, Onigiri: 16, GrilledShiitake: 12, KingOyster: 12, PorkBelly: 14,
    Yakitori: 8, Potato: 10, Scallop: 10, Squid: 10, GrilledCorn: 8, Okra: 6, NetMochi: 6, BloodCake: 4, SweetPotato: -4, Sausage: -4 },
  // fresh wasabi with chicken, scallop and the fattier fish; never with anything sweet
  wasabi: { Yakitori: 12, Scallop: 12, Salmon: 8, Nodoguro: 8, Buri: 8, PorkBelly: 6, Onigiri: 6, Gindara: 4,
    NetMochi: -12, SweetPotato: -12, Sausage: -6, BloodCake: -6, GrilledCorn: -6 },
  // 七味 on yakitori and pork, squid and shishito
  shichimi: { Yakitori: 14, PorkBelly: 14, Squid: 12, Sausage: 8, Shishito: 8, KingOyster: 6, GrilledShiitake: 4, Saury: 4,
    Mackerel: 4, GrilledCorn: 4, Onigiri: 2, NetMochi: -6, SweetPotato: -10 },
  // yuzu kosho with chicken and pork, and the richer fish
  yuzu: { Yakitori: 14, PorkBelly: 12, Nodoguro: 10, Buri: 10, Scallop: 10, Salmon: 8, Shishito: 8, Asparagus: 6, Squid: 6,
    NetMochi: -12, SweetPotato: -12, BloodCake: -8 },
  // a squeeze of lemon (or sudachi) over salt-grilled oily fish, shrimp and squid
  lemon: { Saury: 18, Shishamo: 14, Hokke: 14, ShrimpSkewer: 14, Squid: 14, Mackerel: 12, Aji: 10, Iwashi: 10, Salmon: 10,
    Nodoguro: 8, Scallop: 8, Yakitori: 6, Fish: 10, ExtraFish: 10, Onigiri: -8, NetMochi: -10, SweetPotato: -10, BloodCake: -8 },
  milk: { Salmon: -12, Buri: -14, Gindara: -12, Hokke: -14, Aji: -16, Iwashi: -16, Shishamo: -14, Nodoguro: -16, NetMochi: 18, SweetPotato: 15, GrilledCorn: 6, Potato: -8, BloodCake: -10 },
  peanut: { NetMochi: 18, BloodCake: 18, SweetPotato: 8, GrilledCorn: 4, Sausage: 6 },
}
/** what a seasoning does to a food the table doesn't list (condensed milk on a fish…) */
export const PAIRING_DEFAULT: Record<Exclude<Seasoning, 'water'>, number> = { salt: 4, soy: 3, milk: -18, peanut: -12, miso: 2,
  wasabi: -2, shichimi: 0, yuzu: -2, lemon: 0 }

/**
 * When each seasoning goes on best, as it's done at a Japanese grill, and how much is lost putting it on at another
 * time: salt before the fire (振り塩, it draws the flavour in; sprinkled late it just sits on top); soy and miso
 * glazes brushed on just before it's done (on early, their sugar burns black); condensed milk and peanut powder
 * at the end or once it's off; wasabi, shichimi, yuzu kosho and lemon at the table, after (cooked, they lose their
 * bite and turn bitter).
 */
export const TIMING: Record<Exclude<Seasoning, 'water'>, { best: Stage[]; off: number }> = {
  salt: { best: ['before', 'early'], off: 5 },
  soy: { best: ['late'], off: 8 },
  miso: { best: ['late'], off: 10 },
  milk: { best: ['late', 'after'], off: 6 },
  peanut: { best: ['after', 'late'], off: 4 },
  wasabi: { best: ['after'], off: 8 },
  shichimi: { best: ['after', 'late'], off: 4 },
  yuzu: { best: ['after'], off: 6 },
  lemon: { best: ['after'], off: 6 },
}
/** where a piece is in its cooking, as a share of its cook-time (null: it's off the fire) */
export const stageOf = (r: number | null): Stage => (r === null ? 'after' : r < 0.15 ? 'before' : r < 0.6 ? 'early' : r < 1.05 ? 'late' : 'after')
/** what putting a seasoning on at this point costs (0 at its best time) */
export const timingLoss = (k: string, at: Stage) => {
  const t = TIMING[k as keyof typeof TIMING]
  return !t || t.best.includes(at) ? 0 : t.off
}
/** the best moment for a seasoning */
export const bestStage = (k: string): Stage => TIMING[k as keyof typeof TIMING]?.best[0] ?? 'late'

/** 1-5 stars for a taste (0-100) */
export const starsOf = (taste: number) => Math.max(1, Math.min(5, Math.round(taste / 20)))
export const starText = (taste: number) => '★'.repeat(starsOf(taste)) + '☆'.repeat(5 - starsOf(taste))

/** which face a rating gets (the number itself isn't shown) */
export const moodOf = (r: number | null) => r === null ? 'wait' : r >= 80 ? 'love' : r >= 65 ? 'happy' : r >= 45 ? 'ok' : r >= 25 ? 'meh' : 'sad'
