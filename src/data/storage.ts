// Where each food is kept in the kitchen: the fish and seafood frozen (−18℃), the meat, vegetables and made things chilled (4℃), and what
// keeps at room temperature (the sake, potatoes) in the larder. The ingredients panel is laid out by these.
import type { Lang } from './i18n'

export type Storage = 'frozen' | 'chilled' | 'ambient'

const FROZEN = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Salmon', 'Hokke', 'Buri', 'Gindara', 'Nodoguro',
  'ShrimpSkewer', 'Squid', 'Scallop'])
// (and the seasonings that keep dry: salt, the peanut powder, shichimi; the sauces, once opened, go in the fridge)
// (the rice balls' rice too: white rice keeps at room temperature, in its sacks by the sake (the owner's))
// (the onions and burdock in their sacks on the floor too; the leeks, the daikon and the carrots chilled (the carrots moved to the fridge, the
// owner's, 2026-11-12); the summer vegetables in their wooden baskets at room temperature)
const AMBIENT = new Set(['Sake', 'Potato', 'SweetPotato', 'Onigiri', 'Onion', 'Gobo', 'Tomato', 'Cucumber', 'Eggplant', 'Piman', 'Paprika',
  'season:salt', 'season:peanut', 'season:shichimi', 'charcoal'])

/** where a food is kept (anything not named frozen or at room temperature is chilled) */
export const storageOf = (id: string): Storage => (FROZEN.has(id) ? 'frozen' : AMBIENT.has(id) ? 'ambient' : 'chilled')

/** the panel's sections, in order: their names and the temperature on each one's display */
export const STORAGES: { id: Storage; zh: string; ja: string; en: string; temp: string }[] = [
  { id: 'frozen', zh: '冷凍', ja: '冷凍', en: 'Frozen', temp: '−18℃' },
  { id: 'chilled', zh: '冷藏', ja: '冷蔵', en: 'Chilled', temp: '4℃' },
  { id: 'ambient', zh: '常溫', ja: '常温', en: 'Room temp', temp: '22℃' },
]
export const storageName = (s: (typeof STORAGES)[number], lang: Lang) => (lang === 'ja' ? s.ja : lang === 'en' ? s.en : s.zh)

/** what a food is called where it's kept, where that's other than the dish (the rice balls are kept as the white rice they're made of, the
 * owner's: grilled with soy sauce) */
const STOCK_NAMES: Record<string, { zh: string; ja: string; en: string }> = {
  Onigiri: { zh: '越光米（袋裝）', ja: 'コシヒカリ（袋）', en: 'Koshihikari rice (bag)' },
  // (the vegetables as they're kept, raw: the dish is the grilled one)
  Onion: { zh: '洋蔥', ja: '玉ねぎ', en: 'Onion' },
  Negi: { zh: '日本大蔥', ja: '長ねぎ', en: 'Negi (Japanese leek)' },
  Carrot: { zh: '紅蘿蔔', ja: '人参', en: 'Carrot' },
  Gobo: { zh: '牛蒡', ja: 'ごぼう', en: 'Burdock root' },
  Daikon: { zh: '白蘿蔔', ja: '大根', en: 'Daikon' },
  Tomato: { zh: '小番茄', ja: 'ミニトマト', en: 'Cherry tomatoes' },
  Cucumber: { zh: '小黃瓜', ja: 'きゅうり', en: 'Cucumber' },
  Eggplant: { zh: '茄子', ja: 'なす', en: 'Eggplant' },
  Piman: { zh: '青椒', ja: 'ピーマン', en: 'Green pepper' },
  Paprika: { zh: '甜椒', ja: 'パプリカ', en: 'Bell pepper' },
}
export const stockNameOf = (id: string, lang: Lang): string | null => {
  const n = STOCK_NAMES[id]
  return n ? (lang === 'ja' ? n.ja : lang === 'en' ? n.en : n.zh) : null
}
