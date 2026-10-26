// 研發菜單: each shop starts with nothing on its menu. With the shop closed the owner tries things out — at the
// grill, a food with this or that on it (salt on corn is 鹽烤玉米, soy brushed on it 醬刷玉米…) — and what's been tried can be put on the menu at a price of the owner's choosing, alone or made up into
// a set. Customers only order what's on the menu.

import type { Lang } from './i18n'
import type { Dish, MenuItem } from './menu'

export type Seasoning = 'salt' | 'soy' | 'milk' | 'peanut' | 'miso' | 'wasabi' | 'shichimi' | 'yuzu' | 'lemon'
/** at the grill: salt and soy, the Taiwanese condensed milk and peanut powder, and what a Japanese yakitori counter
 * keeps besides — miso, wasabi, shichimi, yuzu kosho, and lemon to squeeze */
export const SEASONINGS: Seasoning[] = ['salt', 'soy', 'milk', 'peanut', 'miso', 'wasabi', 'shichimi', 'yuzu', 'lemon']

/** one dish as it's cooked: a food and what goes on it */
export type Part = { id: string; dabs: Seasoning[]; name: string; ja: string }
/** a dish on the menu, or a set of them */
export type Entry = { key: string; shop: string; name: string; ja: string; price: number; parts: Part[] }

/** most dishes (and sets) a menu holds */
export const MENU_MAX = 40
/** fewest on the menu before the shop can open */
export const MENU_MIN: Record<string, number> = { grilledfish: 10 }

/**
 * What a portion's seasoning costs, NT$, as in a Taiwanese stall: a pinch of salt next to nothing, a brush of soy
 * glaze a little more, peanut powder (with sugar) more, condensed milk most.
 */
export const SEASON_COST: Record<Seasoning, number> = { salt: 1, soy: 2, peanut: 3, milk: 4, miso: 3, wasabi: 5, shichimi: 2, yuzu: 4, lemon: 3 }
export const SEASON_NAME: Record<Lang, Record<Seasoning, string>> = {
  zh: { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉', miso: '味噌', wasabi: '山葵', shichimi: '七味粉', yuzu: '柚子胡椒', lemon: '檸檬' },
  ja: { salt: '塩', soy: '醤油', milk: '練乳', peanut: 'きな粉', miso: '味噌', wasabi: 'わさび', shichimi: '七味', yuzu: '柚子胡椒', lemon: 'レモン' },
}

/** the seasonings that went on, in a fixed order (what makes it one recipe or another) */
export const signature = (dabs: Partial<Record<string, number>> | Seasoning[] | undefined): Seasoning[] =>
  Array.isArray(dabs) ? SEASONINGS.filter((k) => dabs.includes(k)) : SEASONINGS.filter((k) => (dabs?.[k] ?? 0) > 0)
export const recipeKey = (id: string, dabs: Seasoning[]) => (dabs.length ? `${id}|${dabs.join('+')}` : id)

// what such a dish is called in Taiwan, where it has a name of its own
const SPECIAL: Record<string, Partial<Record<string, string>>> = {
  GrilledCorn: { soy: '醬刷玉米', salt: '鹽烤玉米', milk: '奶香烤玉米', 'soy+peanut': '醬刷花生玉米' },
  Onigiri: { soy: '醬油烤飯糰', salt: '鹽烤飯糰', miso: '味噌烤飯糰' },
  Buri: { soy: '照燒鰤魚', miso: '味噌燒鰤魚' },
  Salmon: { soy: '照燒鮭魚', miso: '味噌燒鮭魚' },
  Gindara: { soy: '照燒銀鱈', miso: '西京味噌燒銀鱈' },
  Saury: { 'salt+lemon': '鹽烤秋刀魚佐檸檬' },
  Hokke: { salt: '鹽烤花魚一夜干' },
  NetMochi: { '': '網烤年糕', soy: '醬油烤年糕', milk: '煉乳烤年糕', peanut: '花生年糕', 'milk+peanut': '花生煉乳年糕' },
  BloodCake: { peanut: '花生米血', soy: '醬烤米血', 'soy+peanut': '醬烤花生米血' },
  SweetPotato: { milk: '煉乳烤地瓜', peanut: '花生烤地瓜' },
  Squid: { soy: '醬烤魷魚', salt: '鹽烤魷魚' },
  GrilledShiitake: { soy: '醬烤香菇', salt: '鹽烤香菇' },
  Sausage: { peanut: '花生香腸' },
  Potato: { milk: '奶油馬鈴薯', salt: '鹽烤馬鈴薯' },
}

/**
 * The name of a food cooked this way: 鹽烤 / 醬烤 before it (salt, soy), and 佐花生粉 / 淋煉乳 after it for what's
 * put on to finish, unless the dish has a name of its own; with nothing on it, 烤 and the food. Elsewhere than the
 * grill it's just the dish. (What's bought in is the bare food: 玉米, not 烤玉米.)
 */
export function partName(item: { name: string; ja?: string }, short: string, id: string, dabs: Seasoning[], lang: Lang,
  kind: 'grill' | 'plain' = 'grill') {
  const ja = item.ja ?? item.name
  if (kind === 'plain') return lang === 'ja' ? ja : item.name
  if (lang === 'ja') return (dabs.length ? dabs.map((k) => SEASON_NAME.ja[k]).join('・') : '') + '焼き' + ja
  const sig = dabs.join('+')
  const special = SPECIAL[id]?.[sig]
  if (special) return special
  if (!dabs.length) return '烤' + short
  const head = dabs.includes('soy') && dabs.includes('salt') ? '鹽醬烤' : dabs.includes('miso') ? '味噌烤' : dabs.includes('soy') ? '醬烤'
    : dabs.includes('salt') ? '鹽烤' : '烤'
  let name = head + short
  if (dabs.includes('peanut')) name += '佐花生粉'
  if (dabs.includes('milk')) name += '淋煉乳'
  // (what's added at the table, after: 佐山葵, 佐七味, 佐柚子胡椒, 佐檸檬)
  const after = ([['wasabi', '山葵'], ['shichimi', '七味'], ['yuzu', '柚子胡椒'], ['lemon', '檸檬']] as const).filter(([k]) => dabs.includes(k)).map(([, w]) => w)
  if (after.length) name += '佐' + after.join('・')
  return name
}

/**
 * A dish's English name, for the small line down its menu tag: how it's grilled, the food, and what it's served
 * with (Salt & Soy Grilled Saury with Wasabi & Lemon).
 */
export function partEn(en: string | undefined, dabs: Seasoning[], kind: 'grill' | 'plain' = 'grill') {
  if (!en) return undefined
  if (kind === 'plain') return en
  const W: Record<string, string> = { salt: 'Salt', soy: 'Soy', miso: 'Miso', milk: 'Condensed Milk', peanut: 'Peanut',
    wasabi: 'Wasabi', shichimi: 'Shichimi', yuzu: 'Yuzu Kosho', lemon: 'Lemon' }
  const head = (['salt', 'soy', 'miso'] as const).filter((k) => dabs.includes(k)).map((k) => W[k])
  const glaze = (['milk', 'peanut'] as const).filter((k) => dabs.includes(k)).map((k) => W[k])
  const after = (['wasabi', 'shichimi', 'yuzu', 'lemon'] as const).filter((k) => dabs.includes(k)).map((k) => W[k])
  const withs = [...glaze, ...after]
  return `${head.length ? head.join(' & ') + ' ' : ''}Grilled ${en}${withs.length ? ' with ' + withs.join(' & ') : ''}`
}

/** the food or bowl a part is cooked from, wherever it's listed */
export const findItem = (d: Dish, id: string): (MenuItem | Dish['bases'][number]) | undefined =>
  d.items.find((x) => x.id === id) ?? d.bases.find((b) => b.id === id)

/** a good price for something that costs this much to make: about three times over, rounded to NT$5 */
export const suggestPrice = (cost: number) => Math.max(10, Math.round((cost * 3) / 5) * 5)
