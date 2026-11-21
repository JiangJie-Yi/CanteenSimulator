// The dishes made off the fire (items 461, 469, 470, the owner's, 2026-11-21: 「需要蛋有蛋料理，蛋花湯、玉子燒、蛋包飯等等..」「以及飯糰多手卷，也需
// 要蛋」「料理台在增加油炸台，可以炸薯條、天婦羅」「菜單在整合一下」): made at the work counter's gas stove (in its frying pan, its square
// tamagoyaki pan or a little pot), in the fryer's basket, or at the rice-ball board; what each is called, what it sells for, how long it
// takes, and what it uses beside its own food (eggs, frying oil, nori: game/supplies' GARNISH); and the menu's sections, as a real
// grilled-fish shop's menu has them (焼き物, 揚げ物, 玉子料理, ご飯もの, 汁物, 飲み物).
import type { Lang } from './i18n'
import type { MenuItem } from './menu'

/** where a dish is made */
export type Station = 'stove' | 'fryer' | 'board'
/** what it's made in: the frying pan, the square tamagoyaki pan, a little pot (on the stove); the fryer's basket; the board */
export type Cookware = 'fry' | 'square' | 'pot' | 'basket' | 'board'
export type KitchenDish = MenuItem & {
  station: Station
  ware: Cookware
  /** how long it takes at its station, the game's seconds (a middling cook's) */
  cookS: number
  /** what it uses besides its own food, a portion each: eggs, frying oil (a portion's share of the fryer's), sheets of nori */
  eggs: number
  oil: number
  nori: number
}

export const KITCHEN_DISHES: KitchenDish[] = [
  // (玉子料理: the rolled omelette, three eggs beaten with dashi, rolled up layer on layer in the square pan)
  { id: 'Tamagoyaki', name: '玉子燒', ja: '玉子焼き', en: 'Tamagoyaki', price: 120, kcal: 180, station: 'stove', ware: 'square', cookS: 45, eggs: 3, oil: 0, nori: 0 },
  // (ご飯もの: omurice, the fried chicken rice wrapped in two eggs' omelette in the frying pan, ketchup over it; the hand roll at the board)
  { id: 'Omurice', name: '蛋包飯', ja: 'オムライス', en: 'Omurice', price: 180, kcal: 650, station: 'stove', ware: 'fry', cookS: 55, eggs: 2, oil: 0, nori: 0 },
  { id: 'HandRoll', name: '手卷', ja: '手巻き寿司', en: 'Hand Roll', price: 90, kcal: 200, station: 'board', ware: 'board', cookS: 20, eggs: 1, oil: 0, nori: 1 },
  // (汁物: egg-drop soup, dashi brought up in the little pot and an egg drizzled in)
  { id: 'EggDropSoup', name: '蛋花湯', ja: 'かき玉汁', en: 'Egg-drop Soup', price: 60, kcal: 60, station: 'stove', ware: 'pot', cookS: 25, eggs: 1, oil: 0, nori: 0 },
  // (揚げ物: chips and tempura (prawns, sweet potato, shiso) in the fryer)
  { id: 'Fries', name: '薯條', ja: 'フライドポテト', en: 'Fries', price: 80, kcal: 380, station: 'fryer', ware: 'basket', cookS: 35, eggs: 0, oil: 1, nori: 0 },
  { id: 'Tempura', name: '天婦羅', ja: '天ぷら', en: 'Tempura', price: 220, kcal: 420, station: 'fryer', ware: 'basket', cookS: 45, eggs: 0, oil: 1, nori: 0 },
]
export const KITCHEN_IDS: ReadonlySet<string> = new Set(KITCHEN_DISHES.map((d) => d.id))
export const kitchenDish = (id: string) => KITCHEN_DISHES.find((d) => d.id === id)

/** the menu's sections, in their order */
export type Section = 'grill' | 'fried' | 'egg' | 'rice' | 'soup' | 'drink'
export const SECTIONS: { id: Section; zh: string; ja: string; en: string }[] = [
  { id: 'grill', zh: '烤物', ja: '焼き物', en: 'Grilled' },
  { id: 'fried', zh: '炸物', ja: '揚げ物', en: 'Fried' },
  { id: 'egg', zh: '玉子・蛋料理', ja: '玉子料理', en: 'Egg Dishes' },
  { id: 'rice', zh: '飯物', ja: 'ご飯もの', en: 'Rice' },
  { id: 'soup', zh: '湯', ja: '汁物', en: 'Soup' },
  { id: 'drink', zh: '飲料', ja: '飲み物', en: 'Drinks' },
]
/** what's not in the grilled section: the rice (the grilled rice ball with the hand roll and the omurice, the bowl of rice), the soups, the
 * drinks, the new dishes by their kind */
const SECTION_OF: Record<string, Section> = {
  Tamagoyaki: 'egg', Omurice: 'rice', HandRoll: 'rice', Onigiri: 'rice', Rice: 'rice', EggDropSoup: 'soup', MisoSoup: 'soup',
  Fries: 'fried', Tempura: 'fried', Sake: 'drink',
}
/** which section of the menu a dish is in (anything grilled, and anything not named, in the grilled) */
export const sectionOf = (id: string): Section => SECTION_OF[id] ?? 'grill'
/** ids put in the menu's order: section by section, each section's in the order they came */
export const bySection = <T extends string>(ids: readonly T[]): T[] =>
  SECTIONS.flatMap((s) => ids.filter((id) => sectionOf(id) === s.id))
export const sectionName = (s: Section, lang: Lang) => {
  const x = SECTIONS.find((v) => v.id === s)!
  return lang === 'ja' ? x.ja : lang === 'en' ? x.en : x.zh
}
