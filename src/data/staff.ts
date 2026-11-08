// The jobs at each shop, and what the people hired for them are worth. (Who comes to be hired is made up afresh
// for each game: see game/hiring.ts.)
//
// Each shop is staffed the way such a place really is:
//   聞野燒烤 (a robata counter): the chef grills right in front of the customers and takes their orders himself, so
//     there's one chef (板前) and one cashier, no floor staff
//
// Everyone has 手藝 (skill), 速度 (speed) and 體力 (stamina), from 1 to 100, and a wage by the hour. Better people
// cost more — mostly. Now and then someone is a bargain (good and cheap), and now and then someone is overpaid. While
// the shop is open they tire (faster with less stamina), and a tired worker works worse; with the shop closed they
// rest.

export type Role = 'chef' | 'sous' | 'cashier' | 'server' | 'stock'
/** how someone looks, for their picture: a woman or a man, young, middle-aged or older */
export type Look = { female: boolean; age: 'young' | 'middle' | 'old' }
export type Worker = {
  id: string
  look: Look
  zh: string
  ja: string
  role: Role
  skill: number
  speed: number
  stamina: number
  /** NT$ an hour */
  wage: number
  /** a line about them, for the hiring list */
  note: string
  /** how old they are, and a few words of their own (why they want the job, what they like, when they can work) */
  years: number
  intro: string
}

// The owner is the head chef (大廚) of every shop, at the fire while it's open. Each can take on two more cooks — a second chef (二廚)
// fetching each order and skewering it at the board, and a third (三廚) plating, keeping the fire's charcoal and clearing — two people on the floor (外場), one at the till (收銀), and a stock keeper
// (倉儲) who watches what's running low and orders it in before it runs out.
const STAFFING = (chef: string, sous: string, chefJa: string, sousJa: string) => [
  { role: 'chef' as Role, max: 1, zh: chef, ja: chefJa },
  { role: 'sous' as Role, max: 1, zh: sous, ja: sousJa },
  { role: 'server' as Role, max: 2, zh: '外場', ja: 'ホール' },
  { role: 'cashier' as Role, max: 1, zh: '收銀', ja: 'レジ' },
  { role: 'stock' as Role, max: 1, zh: '倉儲（叫貨・補貨）', ja: '仕入れ' },
]
export const ROLES: Record<string, { role: Role; max: number; zh: string; ja: string }[]> = {
  grilledfish: STAFFING('二廚（取料・穿串）', '三廚（擺盤・顧火・收拾）', '二番手', '追い回し'),
}

// a fair wage for someone this good at this job (NT$/h): from about minimum wage (NT$196) up
export const fair = (role: Role, skill: number) =>
  Math.round((role === 'chef' ? 200 + skill * 4.2 : role === 'sous' ? 196 + skill * 2.4 : role === 'server' ? 196 + skill * 1.4 : role === 'stock' ? 196 + skill * 1.2 : 196 + skill * 1.1) / 5) * 5

/** fatigue (0..100) from which they're worn out (the owner's: then they work at half, and it shows beside them) */
export const TIRED_AT = 80
export const isTired = (fatigue: number) => fatigue >= TIRED_AT
/** how well they work right now: at their skill, halved once they're worn out */
export const effective = (w: Worker, fatigue: number) => (w.skill / 100) * (isTired(fatigue) ? 0.5 : 1)
/** how fast they get about and get things done, against fresh: half, worn out */
export const paceOf = (fatigue: number) => (isTired(fatigue) ? 0.5 : 1)

/** fatigue gained per hour at work, of the game's clock (from opening till they've gone home: the shop's hours (game/hours) are twelve of
 * them, and the closing up after; the owner's: as in the real world, all the time they're on the clock): the lower the stamina, the faster;
 * one of stamina 30 worn out under six hours in, by the end of the shift even one of 90 */
export const tirePerHour = (w: Worker) => 6 + (100 - w.stamina) * 0.12
/** fatigue shed per hour with the shop shut: the twelve hours between closing and opening rest anyone fully */
export const restPerHour = 12
