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
  /** their special skills (the owner's: given at random now and then, each of a quality, shown as an icon in its colour; SKILLS) */
  skills?: SkillId[]
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

/**
 * Special skills (the owner's): now and then an applicant has one, at random, of a quality: 特殊 green, 菁英 blue, 稀有 purple, 極品 a dark
 * gold. Each works on what the staff already have: how well they work (`skill`, all day, or only before midnight `early`, or only in the
 * deep night `late`), how fast they get about (`pace`, and `latePace` in the deep night), how fast they tire (`tire`), and whether the deep
 * night wears them faster (`lateTire` false: not).
 */
export type Tier = 'special' | 'elite' | 'rare' | 'legend'
export type SkillId = 'quick' | 'earlyBird' | 'sturdy' | 'nightOwl' | 'craftsman' | 'ironMan' | 'whirlwind' | 'prodigy'
export type Skill = {
  tier: Tier; icon: string; zh: string; ja: string; en: string; zhSays: string; jaSays: string; enSays: string
  skill?: number; early?: number; late?: number; pace?: number; latePace?: number; tire?: number; lateTire?: boolean
}
export const TIERS: Record<Tier, { zh: string; ja: string; en: string }> = {
  special: { zh: '特殊', ja: '特殊', en: 'Special' }, elite: { zh: '菁英', ja: '精鋭', en: 'Elite' },
  rare: { zh: '稀有', ja: 'レア', en: 'Rare' }, legend: { zh: '極品', ja: '極上', en: 'Legendary' },
}
export const SKILLS: Record<SkillId, Skill> = {
  quick: { tier: 'special', icon: '⚡', zh: '手腳俐落', ja: '手際よし', en: 'Nimble', pace: 1.1,
    zhSays: '動作速度 ×1.1', jaSays: '動きの速さ ×1.1', enSays: 'Moves ×1.1 as fast' },
  earlyBird: { tier: 'special', icon: '🌅', zh: '早鳥', ja: '朝型', en: 'Early bird', early: 1.1,
    zhSays: '午夜前工作效率 ×1.1', jaSays: '深夜前は効率 ×1.1', enSays: 'Before midnight: works ×1.1' },
  sturdy: { tier: 'special', icon: '💪', zh: '好體力', ja: 'タフ', en: 'Sturdy', tire: 0.85,
    zhSays: '疲勞累積 ×0.85', jaSays: '疲れのたまり方 ×0.85', enSays: 'Tires ×0.85 as fast' },
  nightOwl: { tier: 'elite', icon: '🦉', zh: '夜貓子', ja: '夜型', en: 'Night owl', late: 1.25, latePace: 1.25, lateTire: false,
    zhSays: '深夜工作效率與速度 ×1.25，疲勞不受深夜加劇', jaSays: '深夜は効率・速さ ×1.25、深夜の疲れが増えない', enSays: 'Deep night: works and moves ×1.25, not tired faster by it' },
  craftsman: { tier: 'elite', icon: '🔪', zh: '職人魂', ja: '職人気質', en: 'Craftsman', skill: 1.15,
    zhSays: '工作能力 ×1.15', jaSays: '腕前 ×1.15', enSays: 'Works ×1.15 as well' },
  ironMan: { tier: 'rare', icon: '🛡', zh: '鐵人', ja: '鉄人', en: 'Iron man', tire: 0.6,
    zhSays: '疲勞累積 ×0.6', jaSays: '疲れのたまり方 ×0.6', enSays: 'Tires ×0.6 as fast' },
  whirlwind: { tier: 'rare', icon: '🌪', zh: '疾風', ja: '疾風', en: 'Whirlwind', pace: 1.25,
    zhSays: '動作速度 ×1.25', jaSays: '動きの速さ ×1.25', enSays: 'Moves ×1.25 as fast' },
  prodigy: { tier: 'legend', icon: '👑', zh: '天才', ja: '天才', en: 'Prodigy', skill: 1.3, pace: 1.15, tire: 0.8,
    zhSays: '工作能力 ×1.3、動作速度 ×1.15、疲勞累積 ×0.8', jaSays: '腕前 ×1.3・速さ ×1.15・疲れ ×0.8', enSays: 'Works ×1.3, moves ×1.15, tires ×0.8' },
}
/** how likely an applicant has a skill of each quality (the rest, about seven in ten, none) */
export const TIER_ODDS: Record<Tier, number> = { special: 0.15, elite: 0.09, rare: 0.045, legend: 0.015 }
export const hasSkill = (w: Pick<Worker, 'skills'>, k: SkillId) => !!w.skills?.includes(k)
const skillsOf = (w: Pick<Worker, 'skills'>) => (w.skills ?? []).map((k) => SKILLS[k])
const product = (xs: (number | undefined)[]) => xs.reduce<number>((a, x) => a * (x ?? 1), 1)
/** fatigue (0..100) from which they're worn out (the owner's: then they work at half, and it shows beside them; raised a little, 80 → 85) */
export const TIRED_AT = 85
export const isTired = (fatigue: number) => fatigue >= TIRED_AT
/** how much faster the deep night (game/hours' isLate) wears them (but those whose skill says not: the night owl) */
export const LATE_TIRE = 1.5
/** what their skills make of how well they work just now (×; 1 with none) */
export const skillBoost = (w: Pick<Worker, 'skills'>, late: boolean) => product(skillsOf(w).flatMap((k) => [k.skill, late ? k.late : k.early]))
/** what their skills make of how fast they get about just now (×; 1 with none) */
export const paceBoost = (w: Pick<Worker, 'skills'>, late: boolean) => product(skillsOf(w).flatMap((k) => [k.pace, late ? k.latePace : undefined]))
/** how well they work right now: at their skill, halved once they're worn out, and as their skills make it */
export const effective = (w: Pick<Worker, 'skill' | 'skills'>, fatigue: number, late = false) =>
  (w.skill / 100) * (isTired(fatigue) ? 0.5 : 1) * skillBoost(w, late)
/** how fast they get about and get things done, against fresh: half, worn out, and as their skills make it (`boost`, paceBoost) */
export const paceOf = (fatigue: number, boost = 1) => (isTired(fatigue) ? 0.5 : 1) * boost

/** fatigue gained per hour at work, of the game's clock (from opening till they've gone home: the shop's hours (game/hours) are twelve of
 * them, and the closing up after; the owner's: as in the real world, all the time they're on the clock): the lower the stamina, the faster;
 * one of stamina 30 worn out under six hours in, by the end of the shift even one of 90 */
export const tirePerHour = (w: Pick<Worker, 'stamina'>) => 6 + (100 - w.stamina) * 0.12
/** fatigue gained per hour at work just now: faster in the deep night (LATE_TIRE, but not for those whose skill says not), and as their
 * skills make it */
export const tireNow = (w: Pick<Worker, 'stamina' | 'skills'>, late: boolean) =>
  tirePerHour(w) * (late && skillsOf(w).every((k) => k.lateTire !== false) ? LATE_TIRE : 1) * product(skillsOf(w).map((k) => k.tire))
/** fatigue shed per hour with the shop shut: the twelve hours between closing and opening rest anyone fully */
export const restPerHour = 12
