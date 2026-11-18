// Living upstairs (item 361, the owner's, 2026-11-19: 「住宿需求有些員工會提(老闆可以決定要不要給他/她住)，或是老闆會指定(但員工不建得會接受)。
// 最多可住3人。」). Who lives in is each one's own matter now, not their job's (it was the cooks, all of them): some want to (their home far,
// saving, new to the city, no train home after closing), and in time ask; the owner says yes or no. Or he offers it, and they take it or
// not, as they want it and as fond of him as they are (one with family to look after, never). Three at most. Living in, those who wanted
// it are a little fonder each day; asked to move out when they wanted to stay, they're hurt; fallen out with him badly, they move out on
// their own. Pure rules; App keeps who's in on each hand's rota (`lives`) and the asking, the office has the buttons.
import { unit } from './commute'

/** how many can live upstairs (the staff; the owner's own room aside) */
export const DORM_CAP = 3
/** how many of those hired want to live in */
export const LODGE_WANT = 0.35
/** how fond they must be before they'll ask */
export const ASK_FROM = 40
/** days before asking again after a no, or after turning an offer down */
export const ASK_AGAIN = 7
/** a no to someone who asked: a little hurt */
export const NO_BOND = -4
/** asked to move out when they wanted to stay */
export const MOVE_OUT_BOND = -6
/** this unhappy, they move out by themselves */
export const LEAVES_UNDER = 20

type Words = { zh: string; ja: string; en: string }
/** why they want to live in */
export const WANT_WHY: Words[] = [
  { zh: '家住得遠，單程要一個多小時', ja: '家が遠く、片道1時間以上', en: 'Lives far out, over an hour each way' },
  { zh: '想存錢，省下房租', ja: '家賃を浮かせて貯金したい', en: 'Saving up, would rather not pay rent' },
  { zh: '剛搬來這座城市，還沒找到房子', ja: 'この街に来たばかりで部屋が見つからない', en: 'New to the city, nowhere found yet' },
  { zh: '收店太晚，已經沒有電車了', ja: '閉店が遅くて終電がない', en: 'No train home after closing' },
]
/** why they'd rather not */
export const NOT_WHY: Words[] = [
  { zh: '家就在附近，走路就到', ja: '家がすぐ近く', en: 'Lives just round the corner' },
  { zh: '要照顧家人', ja: '家族の世話がある', en: 'Has family to look after' },
  { zh: '習慣跟家人住', ja: '家族と暮らすのに慣れている', en: 'Used to living with family' },
]
/** whether they want to live in (theirs from the first: the same every time) */
export const wantsLodging = (id: string) => unit(id, 'lodge') < LODGE_WANT
/** looking after family: they never take it */
const hasFamily = (id: string) => !wantsLodging(id) && Math.floor(unit(id, 'lodgewhy') * NOT_WHY.length) === 1
/** their reason, either way */
export const lodgeWhy = (id: string): Words => (wantsLodging(id)
  ? WANT_WHY[Math.floor(unit(id, 'lodgewhy') * WANT_WHY.length)]
  : NOT_WHY[Math.floor(unit(id, 'lodgewhy') * NOT_WHY.length)])

/** what lodging keeps on a hand's rota: living in; the day they asked (and it's not been answered); the day they were last turned down or
 * turned an offer down */
export type Lodging = { lives?: boolean; lodgeAsk?: number; lodgeNo?: number; bond?: number }

/** whether they ask today: wanting it, not living in, not asked already, not turned down (or turning one down) within ASK_AGAIN days, fond
 * enough */
export function asksToday(id: string, r: Lodging, today: number) {
  if (!wantsLodging(id) || r.lives || r.lodgeAsk !== undefined) return false
  if (r.lodgeNo !== undefined && today - r.lodgeNo < ASK_AGAIN) return false
  return (r.bond ?? 50) >= ASK_FROM
}
/** room for one more: `living` how many live in now */
export const hasRoom = (living: number) => living < DORM_CAP
/** their answer to an offer, `roll` the dice (0..1): yes if they wanted it; one with family to look after, never; otherwise the fonder the
 * likelier, from none at 60 to a half at 100 */
export function takesOffer(id: string, bond: number, roll: number) {
  if (wantsLodging(id)) return true
  if (hasFamily(id)) return false
  return roll < Math.max(0, Math.min(0.5, ((bond - 60) / 40) * 0.5))
}
/** the day's end, living in: those who wanted it a point fonder */
export const lodgeDayBond = (id: string, lives: boolean | undefined) => (lives && wantsLodging(id) ? 1 : 0)
/** whether they move out by themselves: living in and this unhappy */
export const movesOut = (r: Lodging) => !!r.lives && (r.bond ?? 50) < LEAVES_UNDER
