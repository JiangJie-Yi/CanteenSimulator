// What's kept where it's seen (items 274, 275, the owner's, 2026-11-17: 「調料有缺 跟庫存的對不上(比方說鹽巴、味精...)，這些可以放到料理台下的
// 系統櫃門」「這個遊戲是模擬真實世界，不是亂塞些模型的」): every package, bottle, tray and bundle in the cupboards stands for stock of its own,
// and as much of it is shown as there's stock: all of it at the usual stock and over, none at none, at least one while there's any.
import { PAR } from './economy'
import { GARNISH_PAR, NORI, SEASON_PAR, isSeasonId } from './supplies'

/** what's the usual stock of something: a seasoning's doses, nori's sheets, a food's portions */
export const parOf = (id: string) => (isSeasonId(id) ? SEASON_PAR : GARNISH_PAR[id] ?? PAR)

/**
 * How many of `all` (packages, bottles, skewers...) are shown for `have` in stock: every one at the usual stock (`par`) and over, none at
 * none, at least one while there's any (the last of it is still there), the rest in proportion; every one while the stock isn't known (no
 * shop running: -1).
 */
export function unitsShown(have: number, all: number, par: number): number {
  if (have < 0) return all
  if (have <= 0 || all <= 0) return 0
  return Math.max(1, Math.min(all, Math.ceil((all * have) / Math.max(1, par) - 1e-9)))
}

/**
 * The cook table's cupboards (the warming counter's, blender/pantry.py): what keeps dry, the seasonings, the nori and the rice for the onigiri,
 * each in its packages, as the stock panel has them. `all`: how many packages it holds at the usual stock.
 */
export const DRY_STORE: { id: string; all: number }[] = [
  { id: 'Onigiri', all: 2 },
  { id: 'season:salt', all: 3 },
  { id: 'season:shichimi', all: 3 },
  { id: 'season:peanut', all: 3 },
  { id: NORI, all: 3 },
]
