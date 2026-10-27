// Where each food is kept in the kitchen: the fish and seafood frozen (−18℃), the meat, vegetables and made things chilled (4℃), and what
// keeps at room temperature (the sake, potatoes) in the larder. The ingredients panel is laid out by these.
import type { Lang } from './i18n'

export type Storage = 'frozen' | 'chilled' | 'ambient'

const FROZEN = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Salmon', 'Hokke', 'Buri', 'Gindara', 'Nodoguro',
  'ShrimpSkewer', 'Squid', 'Scallop'])
const AMBIENT = new Set(['Sake', 'Potato', 'SweetPotato'])

/** where a food is kept (anything not named frozen or at room temperature is chilled) */
export const storageOf = (id: string): Storage => (FROZEN.has(id) ? 'frozen' : AMBIENT.has(id) ? 'ambient' : 'chilled')

/** the panel's sections, in order: their names and the temperature on each one's display */
export const STORAGES: { id: Storage; zh: string; ja: string; temp: string }[] = [
  { id: 'frozen', zh: '冷凍', ja: '冷凍', temp: '−18℃' },
  { id: 'chilled', zh: '冷藏', ja: '冷蔵', temp: '4℃' },
  { id: 'ambient', zh: '常溫', ja: '常温', temp: '22℃' },
]
export const storageName = (s: (typeof STORAGES)[number], lang: Lang) => (lang === 'ja' ? s.ja : s.zh)
