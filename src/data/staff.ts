// The jobs at each shop, and what the people hired for them are worth. (Who comes to be hired is made up afresh
// for each game: see game/hiring.ts.)
//
// Each shop is staffed the way such a place really is:
//   聞野燒烤 (a robata counter): the chef grills right in front of the customers and takes their orders himself, so
//     there's one chef (板前) and one cashier, no floor staff
//   鼎沸火鍋 (a hot pot restaurant): back-kitchen cooks prepare the plates, one cashier, and floor staff who seat
//     people and carry the food out
//   甲粗飽食堂 (a noodle shop): one or two noodle cooks at the pot, one cashier, perhaps one server
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
}

// The owner is the head chef (大廚) of every shop. Each can take on two more cooks — a second chef (二廚) and a
// third (三廚) to prep, put on and clear — one person on the floor (外場), one at the till (收銀), and a stock keeper
// (倉儲) who watches what's running low and orders it in before it runs out.
const STAFFING = (chef: string, sous: string, chefJa: string, sousJa: string) => [
  { role: 'chef' as Role, max: 1, zh: chef, ja: chefJa },
  { role: 'sous' as Role, max: 1, zh: sous, ja: sousJa },
  { role: 'server' as Role, max: 1, zh: '外場', ja: 'ホール' },
  { role: 'cashier' as Role, max: 1, zh: '收銀', ja: 'レジ' },
  { role: 'stock' as Role, max: 1, zh: '倉儲（叫貨・補貨）', ja: '仕入れ' },
]
export const ROLES: Record<string, { role: Role; max: number; zh: string; ja: string }[]> = {
  grilledfish: STAFFING('二廚（板前）', '三廚（備料・上火・收拾）', '二番手', '追い回し'),
  hotpot: STAFFING('二廚（顧湯）', '三廚（備料）', '二番手', '仕込み'),
  beefnoodle: STAFFING('二廚（煮麵・快炒）', '三廚（顧湯・配料）', '二番手', '仕込み'),
  bakery: STAFFING('二廚（麵包師傅）', '三廚（備料・整形）', 'パン職人', '仕込み'),
}

// a fair wage for someone this good at this job (NT$/h): from about minimum wage (NT$196) up
export const fair = (role: Role, skill: number) =>
  Math.round((role === 'chef' ? 200 + skill * 4.2 : role === 'sous' ? 196 + skill * 2.4 : role === 'server' ? 196 + skill * 1.4 : role === 'stock' ? 196 + skill * 1.2 : 196 + skill * 1.1) / 5) * 5

/** how well they work right now: tired people work worse (at 100 fatigue, down to 55%) */
export const effective = (w: Worker, fatigue: number) => (w.skill * (1 - fatigue * 0.0045)) / 100

/** fatigue gained per minute open (0..100): the lower the stamina, the faster */
export const tirePerMin = (w: Worker) => 1.2 + (100 - w.stamina) * 0.05
/** fatigue shed per minute with the shop closed */
export const restPerMin = 6
