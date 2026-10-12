// Who comes in: customers are told apart by how they look, the way staff would say it ("the office worker",
// "the old lady"), not by a number. Each guest's id picks one of these, and the drawing follows it.
import type { Lang } from './i18n'

export type GuestKind = 'salaryman' | 'officeLady' | 'highSchoolGirl' | 'highSchoolBoy' | 'grandma' | 'grandpa' | 'kid'
  | 'uncle' | 'student' | 'yukata' | 'yankee' | 'bosozoku'

/** who they are, and how often they come in (the weights against each other: the rough lot only now and then) */
export const KINDS: { kind: GuestKind; zh: string; ja: string; weight: number }[] = [
  { kind: 'salaryman', zh: '上班族', ja: 'サラリーマン', weight: 10 },
  { kind: 'highSchoolGirl', zh: '女高中生', ja: '女子高生', weight: 10 },
  { kind: 'grandma', zh: '老奶奶', ja: 'おばあちゃん', weight: 10 },
  { kind: 'uncle', zh: '中年大叔', ja: 'おじさん', weight: 10 },
  { kind: 'kid', zh: '小學生', ja: '小学生', weight: 10 },
  { kind: 'officeLady', zh: 'OL 小姐', ja: 'OLさん', weight: 10 },
  { kind: 'student', zh: '大學生', ja: '大学生', weight: 10 },
  { kind: 'grandpa', zh: '老爺爺', ja: 'おじいちゃん', weight: 10 },
  { kind: 'yukata', zh: '浴衣姐姐', ja: '浴衣のお姉さん', weight: 10 },
  { kind: 'highSchoolBoy', zh: '男高中生', ja: '男子高生', weight: 10 },
  { kind: 'yankee', zh: '不良少年', ja: 'ヤンキー', weight: 5 },
  { kind: 'bosozoku', zh: '暴走族', ja: '暴走族', weight: 3 },
]

const TOTAL = KINDS.reduce((n, k) => n + k.weight, 0)
/** each guest's kind, fixed by their id: drawn by weight, the ids scattered so neighbours seldom match */
export const kindOf = (id: number) => {
  let n = (Math.imul(id + 1, 2654435761) >>> 0) % TOTAL
  for (const k of KINDS) {
    if (n < k.weight) return k
    n -= k.weight
  }
  return KINDS[0]
}
/** what the staff call this customer */
export const guestLabel = (id: number, lang: Lang) => kindOf(id)[lang]
