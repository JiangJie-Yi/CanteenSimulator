/**
 * The flowers in the two vases by the shrine, and what each kind brings while it stands there (clicked through in the room, one vase
 * at a time). Each vase counts on its own, so the same flowers in both bring twice as much:
 * - 榊與小菊 (sakaki with small chrysanthemums) — 平安: guests wait longer before they give up and walk out;
 * - 白金菊 (white and gold chrysanthemums) — 金運: guests go to the drinks fridge more often;
 * - 紅粉花 (peonies, camellias, bellflowers) — 良緣: couples come in together more often.
 */
export type Flower = 0 | 1 | 2

export const FLOWERS: { name: string; ja: string; buff: string; buffJa: string }[] = [
  { name: '榊與小菊', ja: '榊と小菊', buff: '平安：客人更有耐心，等比較久才走', buffJa: '平安：お客さんが長く待ってくれる' },
  { name: '白金菊', ja: '白と金の菊', buff: '金運：客人更常去拿飲料', buffJa: '金運：飲み物がよく売れる' },
  { name: '紅粉花', ja: '紅と桃の花', buff: '良緣：情侶更常一起來', buffJa: '良縁：カップルがよく来る' },
]

/** each vase of a kind: how much more patient, thirsty or paired the guests are */
export const PATIENCE_PER_VASE = 0.25
export const DRINKS_PER_VASE = 0.4
export const PAIRS_PER_VASE = 0.5

/** what the two vases bring together, as multipliers (1 = nothing) */
export function flowerBuffs(vases: readonly Flower[]) {
  const n = (f: Flower) => vases.filter((v) => v === f).length
  return {
    patience: 1 + PATIENCE_PER_VASE * n(0),
    drinks: 1 + DRINKS_PER_VASE * n(1),
    pairs: 1 + PAIRS_PER_VASE * n(2),
  }
}

/** the next flowers when a vase is clicked */
export const nextFlower = (f: Flower): Flower => ((f + 1) % FLOWERS.length) as Flower
