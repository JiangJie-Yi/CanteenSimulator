// The people who come to be hired: made up at random for each new game from the names, backgrounds and traits in
// data/people.ts, so the hiring list is never the same twice. Older hands are more skilled and tire sooner; young
// ones are quicker and tireless but still learning. Most ask a fair wage; now and then one is a bargain, now and
// then one asks too much.
import { BACKGROUNDS, INTRO, JP_GIVEN, JP_SURNAMES, PAY, TO_JA, TRAITS, TW_GIVEN, TW_SURNAMES } from '@/data/people'
import { DISHES } from '@/data/menu'
import { fair, type Look, type Role, type Worker } from '@/data/staff'

export type Rand = () => number

/** how many come for each job at each shop */
const COUNTS: Record<Role, number> = { chef: 4, sous: 3, cashier: 3, server: 3, stock: 3 }
/** how likely each job's applicants are women */
const WOMEN: Record<Role, number> = { chef: 0.3, sous: 0.4, cashier: 0.7, server: 0.55, stock: 0.35 }
const AGES: Look['age'][] = ['young', 'middle', 'old']
/** skill, speed and stamina ranges by age */
const STATS: Record<Look['age'], { skill: [number, number]; speed: [number, number]; stamina: [number, number] }> = {
  young: { skill: [45, 76], speed: [74, 96], stamina: [80, 96] },
  middle: { skill: [60, 88], speed: [62, 90], stamina: [64, 90] },
  old: { skill: [72, 96], speed: [52, 78], stamina: [48, 74] },
}

/** how old someone of each age group is: 19-29, 30-49, 50-68 */
const YEARS: Record<Look['age'], [number, number]> = { young: [19, 29], middle: [30, 49], old: [50, 68] }

/** a repeatable random sequence (for tests) */
export const seeded = (seed: number): Rand => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const pick = <T>(rand: Rand, list: readonly T[]) => list[Math.floor(rand() * list.length)]
const between = (rand: Rand, [lo, hi]: [number, number]) => Math.round(lo + rand() * (hi - lo))

/** a name, Chinese and Japanese: at the grill (a Japanese robata) mostly Japanese, elsewhere Taiwanese */
function nameOf(rand: Rand, shop: string, female: boolean, age: Look['age']) {
  const sex = female ? 'female' : 'male'
  if (shop === 'grilledfish' && rand() < 0.7) {
    const n = `${pick(rand, JP_SURNAMES)} ${pick(rand, JP_GIVEN[sex][age])}`
    return { zh: n, ja: n }
  }
  const [first, second] = TW_GIVEN[sex][age]
  const sur = pick(rand, TW_SURNAMES)
  let given = pick(rand, first) + pick(rand, second)
  while (given[0] === given[1]) given = pick(rand, first) + pick(rand, second)
  const ja = (s: string) => [...s].map((c) => TO_JA[c] ?? c).join('')
  return { zh: sur + given, ja: `${ja(sur)} ${ja(given)}` }
}

/** a line about them: where they're from, what they're like, and (if it's out of the ordinary) their pay */
function noteOf(rand: Rand, shop: string, role: Role, age: Look['age'], w: { skill: number; speed: number; stamina: number }, adj: number) {
  const bg = [...(BACKGROUNDS[shop]?.[role]?.[age] ?? []), ...(BACKGROUNDS['*'][role]?.[age] ?? [])]
  const traits: string[] = []
  const add = (k: keyof typeof TRAITS) => {
    const list = TRAITS[k][role] ?? TRAITS[k]['*']
    if (list) traits.push(pick(rand, list))
  }
  if (w.skill >= 84) add('skillHigh')
  else if (w.skill < 58) add('skillLow')
  if (w.speed >= 86) add('speedHigh')
  else if (w.speed < 58) add('speedLow')
  if (w.stamina >= 88) add('staminaHigh')
  else if (w.stamina < 58) add('staminaLow')
  const parts = [pick(rand, bg), ...traits.slice(0, 2)]
  if (adj <= 0.82) parts.push(pick(rand, w.skill >= 70 ? PAY.bargainGood : PAY.bargain))
  else if (adj >= 1.25) parts.push(pick(rand, age === 'young' ? PAY.dearNew : PAY.dear))
  return parts.join('，')
}

/** everyone who comes to be hired at a shop */
export function makeCandidates(shop: string, rand: Rand = Math.random, taken = new Set<string>()): Worker[] {
  const out: Worker[] = []
  for (const role of Object.keys(COUNTS) as Role[]) {
    const off = Math.floor(rand() * 3)
    for (let k = 0; k < COUNTS[role]; k++) {
      // (a shop's applicants for a job cover the ages: one of each first, then any)
      const age = k < 3 ? AGES[(k + off) % 3] : pick(rand, AGES)
      const female = rand() < (shop === 'bakery' && role === 'chef' ? 0.5 : WOMEN[role])
      let name = nameOf(rand, shop, female, age)
      for (let tries = 0; taken.has(name.zh) && tries < 20; tries++) name = nameOf(rand, shop, female, age)
      taken.add(name.zh)
      const s = STATS[age]
      const stats = { skill: between(rand, s.skill), speed: between(rand, s.speed), stamina: between(rand, s.stamina) }
      const r = rand()
      const adj = r < 0.15 ? 0.7 + rand() * 0.1 : r < 0.25 ? 1.25 + rand() * 0.15 : 0.92 + rand() * 0.16
      out.push({
        id: `${shop}-${out.length}`, look: { female, age }, ...name, role, ...stats,
        wage: Math.round((fair(role, stats.skill) * adj) / 5) * 5, note: noteOf(rand, shop, role, age, stats, adj),
        years: between(rand, YEARS[age]),
        intro: `${pick(rand, INTRO.why[age])}，${pick(rand, INTRO.likes)}，${pick(rand, INTRO.when)}。`,
      })
    }
  }
  return out
}

/** this game's applicants at every shop (made once, when the page loads: a new game, a new lot) */
export const CANDIDATES: Record<string, Worker[]> = (() => {
  const taken = new Set<string>()
  return Object.fromEntries(DISHES.map((d) => d.id).map((shop) => [shop, makeCandidates(shop, Math.random, taken)]))
})()

/** how much someone is worth for what they cost: skill counts most, then speed, then stamina, per NT$ an hour */
export const valueOf = (w: Worker) => (w.skill * 0.5 + w.speed * 0.3 + w.stamina * 0.2) / w.wage

/** 一鍵徵人: for every job still open, the applicant who's the best value */
export function pickHires(people: Worker[], roles: { role: Role; max: number }[], hired: Record<string, unknown>) {
  const out: Worker[] = []
  for (const r of roles) {
    const have = people.filter((w) => w.role === r.role && hired[w.id]).length
    const open = people.filter((w) => w.role === r.role && !hired[w.id]).sort((a, b) => valueOf(b) - valueOf(a))
    out.push(...open.slice(0, Math.max(0, r.max - have)))
  }
  return out
}
