// Who comes in: customers are told apart by how they look, the way staff would say it ("the office worker",
// "the old lady"), not by a number. Each guest's id picks one of these, and the drawing follows it.
import type { Lang } from './i18n'

// (their keys nouns of a kind, as the owner set them out: the high schoolers schoolgirl and schoolboy, the university student collegeStudent,
// the lady in yukata yukataLady, the delinquent (once yankee), the foreign tourist, the maid cosplayer)
export type GuestKind =
  | 'salaryman' | 'schoolgirl' | 'grandma' | 'uncle' | 'kid'
  | 'officeLady' | 'collegeStudent' | 'grandpa' | 'yukataLady' | 'schoolboy'
  | 'delinquent' | 'bosozoku' | 'foreignTourist' | 'civilServant' | 'maidCoser' | 'gyaru'

/** who they are, and how often they come in (the weights against each other: the rough lot only now and then), grouped as the owner set
 * them out */
export const KINDS: { kind: GuestKind; zh: string; ja: string; en: string; weight: number }[] = [
  // (the working public)
  { kind: 'salaryman', zh: '上班族', ja: 'サラリーマン', en: 'Salaryman', weight: 10 },
  { kind: 'officeLady', zh: 'OL 小姐', ja: 'OLさん', en: 'Office Lady', weight: 10 },
  { kind: 'civilServant', zh: '公務員', ja: '公務員', en: 'Civil Servant', weight: 7 },
  // (students)
  { kind: 'schoolboy', zh: '男高中生', ja: '男子高生', en: 'High School Boy', weight: 10 },
  { kind: 'schoolgirl', zh: '女高中生', ja: '女子高生', en: 'High School Girl', weight: 10 },
  { kind: 'collegeStudent', zh: '大學生', ja: '大学生', en: 'University Student', weight: 10 },
  { kind: 'kid', zh: '小學生', ja: '小学生', en: 'Elementary Student', weight: 10 },
  // (the neighbourhood, the elderly)
  { kind: 'uncle', zh: '中年大叔', ja: 'おじさん', en: 'Middle-aged Regular', weight: 10 },
  { kind: 'grandpa', zh: '老爺爺', ja: 'おじいちゃん', en: 'Elderly Gentleman', weight: 10 },
  { kind: 'grandma', zh: '老奶奶', ja: 'おばあちゃん', en: 'Elderly Lady', weight: 10 },
  // (a style of their own)
  { kind: 'yukataLady', zh: '大和撫子', ja: 'やまとなでしこ', en: 'Lady in Yukata', weight: 10 },
  { kind: 'foreignTourist', zh: '外國觀光客', ja: '外国人観光客', en: 'Foreign Tourist', weight: 6 },
  { kind: 'gyaru', zh: '澀谷辣妹', ja: 'ギャル', en: 'Gyaru', weight: 7 },
  { kind: 'maidCoser', zh: '次元少女', ja: 'メイドさん', en: 'Maid Cosplayer', weight: 3 },
  // (the night's regulars, the rough lot)
  { kind: 'delinquent', zh: '不良少年', ja: 'ヤンキー', en: 'Delinquent', weight: 5 },
  { kind: 'bosozoku', zh: '暴走族', ja: '暴走族', en: 'Biker Gang', weight: 3 },
]

const TOTAL = KINDS.reduce((n, k) => n + k.weight, 0)
/** each guest's kind, fixed by their id: drawn by weight, the ids scattered so neighbours seldom match */
export const kindOf = (id: number) => {
  let h = Math.imul(id ^ (id >>> 16) ^ 0x2c1b3c6d, 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  let n = ((h ^ (h >>> 16)) >>> 0) % TOTAL
  for (const k of KINDS) {
    if (n < k.weight) return k
    n -= k.weight
  }
  return KINDS[0]
}
/** what the staff call this customer */
export const guestLabel = (id: number, lang: Lang) => kindOf(id)[lang]

/**
 * The deep night's crowd (深夜, the owner's: game/hours' isLate): no children, no schoolkids and no old folk after midnight; the night's
 * regulars and the rough lot, the gyaru, the office workers off a late shift and the old regulars more often. A weight against each kind's
 * own (0: not at all); a guest the shop's next number would make is let in by it (comesLate), else the number after is tried.
 */
export const LATE_WEIGHT: Partial<Record<GuestKind, number>> = {
  kid: 0, schoolboy: 0, schoolgirl: 0, grandpa: 0, grandma: 0,
  delinquent: 3, bosozoku: 3, gyaru: 2, salaryman: 1.5, uncle: 1.5, officeLady: 1.2, collegeStudent: 1.2,
}
const LATE_MAX = Math.max(1, ...Object.values(LATE_WEIGHT).map((v) => v ?? 1))
/** whether this guest (by their number) comes in in the deep night: by their kind's weight then, fixed for each number */
export const comesLate = (id: number) => {
  const w = LATE_WEIGHT[kindOf(id).kind] ?? 1
  if (w <= 0) return false
  let h = Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x165667b1)
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000 < w / LATE_MAX
}
/** the deep night's customers order more: one more dish, about half of them */
export const LATE_MORE = 0.5
