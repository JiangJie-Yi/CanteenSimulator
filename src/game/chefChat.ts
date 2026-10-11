// Talking with the second chef: what the owner typed, understood as a request (make this dish, try a few, what
// goes with that, how's the stock…), with the food and the seasonings picked out of it however it was put —
// 「幫我做鹽烤玉米」, 「鮭魚刷醬油烤一下」, 「玉米配什麼好？」, 「隨便試三道」, 「サーモンを塩で」.
import type { Dish } from '@/data/menu'
import { findItem, partName, SEASONINGS, TOPPINGS, type Seasoning } from '@/data/recipes'
import { breadTaste, PAIRING, PAIRING_DEFAULT } from '@/game/taste'

export type Intent =
  /** cook this (dabs null: the chef's choice) */
  | { kind: 'make'; id: string; dabs: Seasoning[] | null }
  /** wants something made, but the food wasn't recognised */
  | { kind: 'makeWhat' }
  /** try n dishes of the chef's choosing */
  | { kind: 'batch'; n: number }
  /** what to do with a food (or with anything, id undefined) */
  | { kind: 'advise'; id?: string }
  | { kind: 'stock' }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'hello' }
  | { kind: 'thanks' }
  | { kind: 'unknown' }

/** the words for each seasoning, in Chinese, Japanese and English */
const SEASON_WORDS: Record<Seasoning, string[]> = {
  salt: ['鹽', '塩', 'salt'],
  soy: ['醬油', '醬', '照燒', '醤油', '照り焼き', 'タレ', 'soy'],
  milk: ['煉乳', '練乳', '奶', 'milk'],
  peanut: ['花生', 'きな粉', 'ピーナッツ', 'peanut'],
  chocolate: ['巧克力', 'チョコ', 'chocolate'],
  almond: ['杏仁', 'アーモンド', 'almond'],
  cheese: ['起司', '乳酪', '起士', 'チーズ', 'cheese'],
  ham: ['火腿', 'ハム', 'ham'],
  custard: ['卡士達', '奶油餡', 'カスタード', 'custard'],
  garlic: ['蒜', 'ガーリック', 'にんにく', 'garlic'],
}
const NUMBERS: Record<string, number> = { 一: 1, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

/** what a shop's cook can make, one by one: the grill's foods, the bakery's doughs, the other shops' dishes */
export const cookable = (d: Dish) => d.roast ? d.items.filter((x) => x.id in d.roast!.times)
  : d.bake ? d.items
  : [...d.bases.filter((b) => !b.includes || d.id === 'beefnoodle'), ...d.items]

/** the seasonings a shop uses (none: its dishes come as they are) */
export const seasoningsOf = (d: Dish): Seasoning[] => (d.roast ? SEASONINGS : d.bake ? TOPPINGS : [])

const kindOf = (d: Dish) => (d.roast ? 'grill' : d.bake ? 'bake' : 'plain') as 'grill' | 'bake' | 'plain'

/** every way a food might be named in what's typed, longest first: its own names, and (where a seasoning makes it a
 * dish of its own) the dish's names, 鹽烤玉米 and the like */
function lexicon(d: Dish) {
  const out: { word: string; id: string; dabs: Seasoning[] | null }[] = []
  const kind = kindOf(d)
  const seas = seasoningsOf(d)
  for (const it of cookable(d)) {
    const short = d.roast?.names[it.id] ?? it.name
    const raw = [it.name, short, it.ja, (it as { en?: string }).en?.toLowerCase(), it.name.replace(/麵團$/, ''), (it.ja ?? '').replace(/生地$/, '')]
    for (const w of raw) if (w && w.length > 1) out.push({ word: w, id: it.id, dabs: null })
    if (kind === 'plain') continue
    const combos: Seasoning[][] = [[], ...seas.map((k) => [k])]
    for (const a of seas) for (const b of seas) if (seas.indexOf(a) < seas.indexOf(b)) combos.push([a, b])
    for (const dabs of combos) for (const lang of ['zh', 'ja'] as const) {
      const w = partName(it, short, it.id, dabs, lang, kind)
      if (w.length > 1) out.push({ word: w, id: it.id, dabs })
    }
  }
  return out.sort((a, b) => b.word.length - a.word.length)
}

/** what the owner wants, from what they typed */
export function understand(text: string, d: Dish): Intent {
  let s = text.trim().toLowerCase()
  if (!s) return { kind: 'unknown' }
  // the food (a dish's own name, 鹽烤玉米, also says what goes on it)
  const hit = lexicon(d).find((x) => s.includes(x.word.toLowerCase()))
  if (hit) s = s.replace(hit.word.toLowerCase(), ' ')
  const seas = seasoningsOf(d)
  const said = seas.filter((k) => SEASON_WORDS[k].some((w) => s.includes(w)))
  const plain = /原味|什麼都不加|不加|不要加|素烤|白燒|白焼|そのまま|何もつけ/.test(s)
  const dabs: Seasoning[] | null = hit?.dabs?.length ? [...new Set([...hit.dabs, ...said])]
    : said.length ? said : plain || hit?.dabs ? [] : null
  const asks = /推薦|建議|什麼好|配什麼|加什麼|怎麼(做|烤|弄)|意見|好吃嗎|適合|搭嗎|搭不搭|呢[？?]?$|おすすめ|何が(いい|合う)|どう(する|かな)|\?|？/.test(s)
  const wants = /做|烤|試|來|弄|煮|炸|作って|焼いて|お願い|ください|頼む|make|cook|try/.test(s)
  const count = s.match(/(\d+|[一兩二三四五六七八九十])\s*(道|樣|個|種|品|款)/)
  if (hit) {
    if (asks && !said.length && !(hit.dabs?.length)) return { kind: 'advise', id: hit.id }
    return { kind: 'make', id: hit.id, dabs: dabs?.slice(0, 3) ?? null }
  }
  if (/庫存|材料|食材|還有多少|夠不夠|在庫|仕入れ/.test(s)) return { kind: 'stock' }
  if (count && (wants || /隨便|你看|你決定|任せ/.test(s))) {
    const n = Number(count[1]) || NUMBERS[count[1]] || 3
    return { kind: 'batch', n: Math.max(1, Math.min(5, n)) }
  }
  if (/隨便|你看著辦|你決定|你挑|任せ/.test(s)) return { kind: 'batch', n: 3 }
  if (asks || /推薦|建議|おすすめ/.test(s)) return { kind: 'advise' }
  if (/^(好|好啊|好喔|好的|可以|做吧|來吧|拜託|麻煩了?|ok|okay|yes|うん|はい|お願い|頼む)[!！。~～]*$/.test(s)) return { kind: 'yes' }
  if (/^(不用|不要|算了|先不要|不了|no|いや|いいえ|やめ)/.test(s)) return { kind: 'no' }
  if (wants) return { kind: 'makeWhat' }
  if (/謝|辛苦|感恩|ありがと|お疲れ|thank/.test(s)) return { kind: 'thanks' }
  if (/你好|嗨|哈囉|早安|午安|晚安|こんにちは|おはよう|hello|hi\b/.test(s)) return { kind: 'hello' }
  return { kind: 'unknown' }
}

/** how good a dish ought to come out, made well: at the grill by how its seasonings suit the food (the first in
 * full, a second a little, past two overdone); a bread by its fillings; anything else as it comes */
export function expectedTaste(d: Dish, id: string, dabs: Seasoning[]) {
  if (d.roast) {
    let t = 62
    dabs.forEach((k, i) => {
      if (k in PAIRING) {
        const p = k as keyof typeof PAIRING
        t += (PAIRING[p][id] ?? PAIRING_DEFAULT[p]) * (i === 0 ? 1 : 0.6)
      }
    })
    if (dabs.length > 2) t -= (dabs.length - 2) * 12
    return Math.round(Math.max(5, Math.min(98, t)))
  }
  if (d.bake) return breadTaste(d.bake, id, dabs as Parameters<typeof breadTaste>[2], 1.1)
  return 72
}

/** the seasonings that suit a food best, best first (only those that do it good) */
export function bestDabs(d: Dish, id: string): Seasoning[] {
  return seasoningsOf(d).map((k) => ({ k, t: expectedTaste(d, id, [k]) }))
    .filter((x) => x.t > expectedTaste(d, id, []) + 4).sort((a, b) => b.t - a.t).map((x) => x.k)
}

/** the dish's name, as the chef would say it */
export const dishName = (d: Dish, id: string, dabs: Seasoning[], lang: 'zh' | 'ja') => {
  const it = findItem(d, id)!
  return partName(it, d.roast?.names[id] ?? it.name, id, dabs, lang, kindOf(d))
}
