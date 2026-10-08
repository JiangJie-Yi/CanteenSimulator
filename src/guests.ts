// Who comes in: customers are told apart by how they look, the way staff would say it ("the office worker",
// "the old lady"), not by a number. Each guest's id picks one of these, and the drawing follows it.
import type { Lang } from './i18n'

export type GuestKind = 'salaryman' | 'officeLady' | 'highSchoolGirl' | 'highSchoolBoy' | 'grandma' | 'grandpa' | 'kid'
  | 'uncle' | 'student' | 'yukata'

export const KINDS: { kind: GuestKind; zh: string; ja: string }[] = [
  { kind: 'salaryman', zh: '上班族', ja: 'サラリーマン' },
  { kind: 'highSchoolGirl', zh: '女高中生', ja: '女子高生' },
  { kind: 'grandma', zh: '老奶奶', ja: 'おばあちゃん' },
  { kind: 'uncle', zh: '中年大叔', ja: 'おじさん' },
  { kind: 'kid', zh: '小學生', ja: '小学生' },
  { kind: 'officeLady', zh: 'OL 小姐', ja: 'OLさん' },
  { kind: 'student', zh: '大學生', ja: '大学生' },
  { kind: 'grandpa', zh: '老爺爺', ja: 'おじいちゃん' },
  { kind: 'yukata', zh: '浴衣姐姐', ja: '浴衣のお姉さん' },
  { kind: 'highSchoolBoy', zh: '男高中生', ja: '男子高生' },
]

export const kindOf = (id: number) => KINDS[(id * 7 + 3) % KINDS.length]
/** what the staff call this customer */
export const guestLabel = (id: number, lang: Lang) => kindOf(id)[lang]
