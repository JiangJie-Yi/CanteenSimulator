/**
 * What's kept in the two dish cabinets under the plate racks besides the plates (the owner's, 2026-11-11: the bowls in the cupboard, the
 * chopsticks and the spoons in the drawers, counted, in sensible proportion): each cabinet holds half. One guest's setting takes a rice
 * bowl, a soup bowl and its renge, and a pair of chopsticks; there are three settings' bowls and spoons for every seat (one in use, one in
 * the wash, one spare: two pots of miso soup's worth), and the chopsticks two and a half times that (they go out with the takeaways too).
 */
import { SOUP_BOWLS } from './soup'
import { SKEWER_POOL } from './skewers'
import { PLATES_ALL } from './plates'

export const TABLEWARE = { riceBowls: 24, soupBowls: 24, spoons: 24, chopsticks: 60 }
/** each cabinet's half: what's behind its doors and in its drawers */
export const PER_CABINET = { riceBowls: TABLEWARE.riceBowls / 2, soupBowls: TABLEWARE.soupBowls / 2, spoons: TABLEWARE.spoons / 2, chopsticks: TABLEWARE.chopsticks / 2 }
/** settings for this many seats: bowls and spoons three times over, enough for two pots of soup, chopsticks two and a half times the bowls */
export const enoughFor = (seats: number) =>
  TABLEWARE.soupBowls >= seats * 3 && TABLEWARE.riceBowls >= seats * 3 && TABLEWARE.soupBowls >= SOUP_BOWLS * 2 &&
  TABLEWARE.spoons === TABLEWARE.soupBowls && TABLEWARE.chopsticks >= TABLEWARE.soupBowls * 2.5

/** the stock's tableware tab (the owner's, 2026-11-13, item 83: "a tab for the tableware: chopsticks, plates, bowls for rice and soup, the
 * skewers... and what I haven't thought of"): everything the shop owns to serve with, how many, and where it's kept. Counted from the shop
 * itself: the plates from the racks (game/plates), the bowls, renge and chopsticks from the cabinets (above), the skewers from their pool
 * (game/skewers), what's laid at each place by the seats (`seats`); the rest a sensible number for the room */
export type Ware = { id: string; zh: string; ja: string; en: string; n: number; unit: [string, string, string]; where: [string, string, string] }
export const tablewareList = (seats: number): Ware[] => [
  { id: 'plates', zh: '盤子', ja: '皿', en: 'Plates', n: PLATES_ALL, unit: ['個', '枚', ''], where: ['碗盤架與吧台旁的矮架', '食器棚とカウンター脇の低い棚', 'The dish racks and the low rack'] },
  { id: 'riceBowls', zh: '飯碗', ja: '飯茶碗', en: 'Rice bowls', n: TABLEWARE.riceBowls, unit: ['個', '個', ''], where: ['碗盤櫃（左）', '食器棚（左）', 'Cabinet (left)'] },
  { id: 'soupBowls', zh: '湯碗', ja: '汁椀', en: 'Soup bowls', n: TABLEWARE.soupBowls, unit: ['個', '個', ''], where: ['碗盤櫃（右）', '食器棚（右）', 'Cabinet (right)'] },
  { id: 'spoons', zh: '湯匙', ja: 'れんげ', en: 'Renge spoons', n: TABLEWARE.spoons, unit: ['支', '本', ''], where: ['碗盤櫃抽屜（右）', '食器棚の引き出し（右）', 'Cabinet drawer (right)'] },
  { id: 'chopsticks', zh: '筷子', ja: '箸', en: 'Chopsticks', n: TABLEWARE.chopsticks, unit: ['雙', '膳', ' pairs'], where: ['碗盤櫃抽屜（左）', '食器棚の引き出し（左）', 'Cabinet drawer (left)'] },
  { id: 'rests', zh: '筷架', ja: '箸置き', en: 'Chopstick rests', n: seats, unit: ['個', '個', ''], where: ['每個座位', '各席', 'At every place'] },
  { id: 'soyDishes', zh: '醬油碟', ja: '醤油皿', en: 'Soy dishes', n: seats, unit: ['個', '枚', ''], where: ['每個座位', '各席', 'At every place'] },
  { id: 'skewers', zh: '鐵籤', ja: '鉄串', en: 'Iron skewers', n: SKEWER_POOL, unit: ['支', '本', ''], where: ['料理台的籤架', '調理台の串立て', 'The cook table holders'] },
  { id: 'teacups', zh: '茶杯', ja: '湯呑み', en: 'Teacups', n: seats * 2, unit: ['個', '個', ''], where: ['吧台下的櫃子', 'カウンター下の棚', 'Under the bar'] },
  { id: 'sakeCups', zh: '酒杯', ja: 'ぐい呑み', en: 'Sake cups', n: seats, unit: ['個', '個', ''], where: ['吧台下的櫃子', 'カウンター下の棚', 'Under the bar'] },
  { id: 'tokkuri', zh: '德利（酒壺）', ja: '徳利', en: 'Tokkuri', n: Math.ceil(seats / 2), unit: ['個', '本', ''], where: ['吧台下的櫃子', 'カウンター下の棚', 'Under the bar'] },
  { id: 'trays', zh: '托盤', ja: 'お盆', en: 'Trays', n: 4, unit: ['個', '枚', ''], where: ['出餐口', '出し口', 'The pass'] },
]
