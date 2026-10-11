// 研發菜單: each shop starts with nothing on its menu. With the shop closed the owner tries things out — at the
// grill, a food with this or that on it (salt on corn is 鹽烤玉米, soy brushed on it 醬刷玉米…); elsewhere, the dish
// itself — and what's been tried can be put on the menu at a price of the owner's choosing, alone or made up into
// a set. Customers only order what's on the menu.

import type { Lang } from './i18n'
import type { Dish, MenuItem } from './menu'

export type Seasoning = 'salt' | 'soy' | 'milk' | 'peanut' | Topping
export const SEASONINGS: Seasoning[] = ['salt', 'soy', 'milk', 'peanut']
/** what goes on (or in) a bread before it's baked, at the bakery */
export type Topping = 'chocolate' | 'almond' | 'cheese' | 'ham' | 'custard' | 'garlic'
export const TOPPINGS: Topping[] = ['chocolate', 'almond', 'cheese', 'ham', 'custard', 'garlic']
const ALL_DABS: Seasoning[] = [...SEASONINGS, ...TOPPINGS]

/** one dish as it's cooked: a food (or a soup, a bowl) and, at the grill, what goes on it */
export type Part = { id: string; dabs: Seasoning[]; name: string; ja: string }
/** a dish on the menu, or a set of them */
export type Entry = { key: string; shop: string; name: string; ja: string; price: number; parts: Part[] }

/** most dishes (and sets) a menu holds */
export const MENU_MAX = 40
/** fewest on the menu before the shop can open */
export const MENU_MIN: Record<string, number> = { grilledfish: 8, hotpot: 8, beefnoodle: 8, bakery: 8 }

/**
 * What a portion's seasoning costs, NT$, as in a Taiwanese stall: a pinch of salt next to nothing, a brush of soy
 * glaze a little more, peanut powder (with sugar) more, condensed milk most. At the bakery, what goes in or on a
 * bread: garlic butter is cheap, custard a little more, chocolate and almonds more, cheese and ham dearest.
 */
export const SEASON_COST: Record<Seasoning, number> = { salt: 1, soy: 2, peanut: 3, milk: 4,
  chocolate: 6, almond: 6, cheese: 7, ham: 8, custard: 5, garlic: 3 }
export const SEASON_NAME: Record<Lang, Record<Seasoning, string>> = {
  zh: { salt: '鹽', soy: '醬油', milk: '煉乳', peanut: '花生粉',
    chocolate: '巧克力', almond: '杏仁片', cheese: '起司', ham: '火腿', custard: '卡士達', garlic: '蒜香奶油' },
  ja: { salt: '塩', soy: '醤油', milk: '練乳', peanut: 'きな粉',
    chocolate: 'チョコ', almond: 'アーモンド', cheese: 'チーズ', ham: 'ハム', custard: 'カスタード', garlic: 'ガーリック' },
}

/** the seasonings that went on, in a fixed order (what makes it one recipe or another) */
export const signature = (dabs: Partial<Record<string, number>> | Seasoning[] | undefined): Seasoning[] =>
  Array.isArray(dabs) ? ALL_DABS.filter((k) => dabs.includes(k)) : ALL_DABS.filter((k) => (dabs?.[k] ?? 0) > 0)
export const recipeKey = (id: string, dabs: Seasoning[]) => (dabs.length ? `${id}|${dabs.join('+')}` : id)

// what such a dish is called in Taiwan, where it has a name of its own
const SPECIAL: Record<string, Partial<Record<string, string>>> = {
  GrilledCorn: { soy: '醬刷玉米', salt: '鹽烤玉米', milk: '奶香烤玉米', 'soy+peanut': '醬刷花生玉米' },
  Onigiri: { soy: '醬油烤飯糰', salt: '鹽烤飯糰' },
  Buri: { soy: '照燒鰤魚' },
  Salmon: { soy: '照燒鮭魚' },
  Gindara: { soy: '照燒銀鱈' },
  Hokke: { salt: '鹽烤花魚一夜干' },
  NetMochi: { '': '網烤年糕', soy: '醬油烤年糕', milk: '煉乳烤年糕', peanut: '花生年糕', 'milk+peanut': '花生煉乳年糕' },
  BloodCake: { peanut: '花生米血', soy: '醬烤米血', 'soy+peanut': '醬烤花生米血' },
  SweetPotato: { milk: '煉乳烤地瓜', peanut: '花生烤地瓜' },
  Squid: { soy: '醬烤魷魚', salt: '鹽烤魷魚' },
  GrilledShiitake: { soy: '醬烤香菇', salt: '鹽烤香菇' },
  Sausage: { peanut: '花生香腸' },
  Potato: { milk: '奶油馬鈴薯', salt: '鹽烤馬鈴薯' },
}

// what a bakery (French and Viennese breads) calls each one
const BREAD: Record<string, Partial<Record<string, string>>> = {
  CroissantDough: { '': '原味可頌', chocolate: '巧克力可頌', almond: '杏仁可頌', cheese: '起司可頌', custard: '卡士達可頌',
    'cheese+ham': '火腿起司可頌', 'chocolate+almond': '杏仁巧克力可頌' },
  BaguetteDough: { '': '法國長棍', garlic: '蒜香法國', cheese: '起司法國', ham: '火腿法國', 'cheese+garlic': '蒜香起司法國',
    'cheese+ham': '火腿起司長棍' },
  BriocheDough: { '': '布里歐', chocolate: '巧克力布里歐', custard: '卡士達布里歐', almond: '杏仁布里歐', cheese: '起司布里歐',
    'chocolate+custard': '巧克力卡士達布里歐' },
  SourdoughDough: { '': '鄉村酸種', cheese: '起司酸種', garlic: '蒜香酸種', 'cheese+ham': '火腿起司酸種', almond: '杏仁酸種' },
}
const TOP_SHORT: Record<string, string> = { chocolate: '巧克力', almond: '杏仁', cheese: '起司', ham: '火腿', custard: '卡士達', garlic: '蒜香' }
const BREAD_SHORT: Record<string, string> = { CroissantDough: '可頌', BaguetteDough: '法國', BriocheDough: '布里歐', SourdoughDough: '酸種' }

/**
 * The name of a food cooked this way: 鹽烤 / 醬烤 before it (salt, soy), and 佐花生粉 / 淋煉乳 after it for what's
 * put on to finish, unless the dish has a name of its own; with nothing on it, 烤 and the food. Elsewhere than the
 * grill it's just the dish. (What's bought in is the bare food: 玉米, not 烤玉米.)
 */
export function partName(item: { name: string; ja?: string }, short: string, id: string, dabs: Seasoning[], lang: Lang,
  kind: 'grill' | 'bake' | 'plain' = 'grill') {
  const ja = item.ja ?? item.name
  if (kind === 'plain') return lang === 'ja' ? ja : item.name
  if (kind === 'bake') {
    // a bread: its own name if it has one, else what's on it and the bread (紅豆起司可頌)
    if (lang === 'ja') return dabs.map((k) => SEASON_NAME.ja[k]).join('・') + (BREAD_SHORT[id] ? ja.replace('生地', '') : ja)
    return BREAD[id]?.[dabs.join('+')] ?? dabs.map((k) => TOP_SHORT[k] ?? '').join('') + (BREAD_SHORT[id] ?? short)
  }
  if (lang === 'ja') return (dabs.length ? dabs.map((k) => SEASON_NAME.ja[k]).join('・') : '') + '焼き' + ja
  const sig = dabs.join('+')
  const special = SPECIAL[id]?.[sig]
  if (special) return special
  if (!dabs.length) return '烤' + short
  const head = dabs.includes('soy') && dabs.includes('salt') ? '鹽醬烤' : dabs.includes('soy') ? '醬烤' : dabs.includes('salt') ? '鹽烤' : '烤'
  let name = head + short
  if (dabs.includes('peanut')) name += '佐花生粉'
  if (dabs.includes('milk')) name += '淋煉乳'
  return name
}

/** the food or bowl a part is cooked from, wherever it's listed */
export const findItem = (d: Dish, id: string): (MenuItem | Dish['bases'][number]) | undefined =>
  d.items.find((x) => x.id === id) ?? d.bases.find((b) => b.id === id)

/** a good price for something that costs this much to make: about three times over, rounded to NT$5 */
export const suggestPrice = (cost: number) => Math.max(10, Math.round((cost * 3) / 5) * 5)
