// Who comes in: customers are told apart by how they look, the way staff would say it ("the office worker",
// "the old lady"), not by a number. Each guest's id picks one of these, and the drawing follows it.
import type { Lang } from './i18n'

// (their keys nouns of a kind, as the owner set them out: the high schoolers schoolgirl and schoolboy, the university student collegeStudent,
// the lady in yukata yukataLady, the delinquent (once yankee), the foreign tourist, the maid cosplayer)
export type GuestKind =
  | 'salaryman' | 'schoolgirl' | 'grandma' | 'uncle' | 'kid'
  | 'officeLady' | 'collegeStudent' | 'grandpa' | 'yukataLady' | 'schoolboy'
  | 'delinquent' | 'bosozoku' | 'foreignTourist' | 'civilServant' | 'maidCoser' | 'gyaru'
  // (item 377, the owner's 「客人的種類需要多一點」: the early evening's mothers, the night's and the dawn's working people)
  | 'housewife' | 'taxiDriver' | 'nurse' | 'constructionWorker' | 'marketWorker' | 'bandman' | 'offShiftChef'

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
  // (item 377: the shopping done, a mother with the children's tea; and those whose work's at night, off it or on a break from it)
  { kind: 'housewife', zh: '家庭主婦', ja: '主婦', en: 'Homemaker', weight: 8 },
  { kind: 'constructionWorker', zh: '工地師傅', ja: '現場の職人', en: 'Construction Worker', weight: 7 },
  { kind: 'taxiDriver', zh: '計程車司機', ja: 'タクシー運転手', en: 'Taxi Driver', weight: 6 },
  { kind: 'nurse', zh: '夜班護理師', ja: '夜勤の看護師', en: 'Night Nurse', weight: 6 },
  { kind: 'bandman', zh: '樂團樂手', ja: 'バンドマン', en: 'Band Musician', weight: 5 },
  { kind: 'offShiftChef', zh: '收工的廚師', ja: '仕事帰りの板前', en: 'Off-duty Chef', weight: 5 },
  { kind: 'marketWorker', zh: '魚市場的人', ja: '市場の人', en: 'Fish Market Hand', weight: 5 },
]

const TOTAL = KINDS.reduce((n, k) => n + k.weight, 0)
/** who comes in as a delivery rider (the owner's riders, helmet and box: the sort who'd take the work, never a yukata lady or a child) */
export const RIDER_KINDS: ReadonlySet<GuestKind> = new Set(['collegeStudent', 'uncle', 'delinquent', 'bosozoku', 'bandman'])
/** whether customer number `id` could come in as a rider */
export const canRide = (id: number) => RIDER_KINDS.has(kindOf(id).kind)
/** who's under age: sold no alcohol (item 203: a pupil or a high-schooler was poured a tokkuri of sake like anyone, 12% of those sat in;
 * Taiwan's age is 18, Japan's 20). The delinquent (ヤンキー) is taken as a young adult: he rides the deliveries */
export const MINORS: ReadonlySet<GuestKind> = new Set(['kid', 'schoolboy', 'schoolgirl'])
export const isMinor = (id: number) => MINORS.has(kindOf(id).kind)
/** who's on duty and driving: no alcohol either (the taxi driver on his break, item 377) */
export const ON_DUTY: ReadonlySet<GuestKind> = new Set(['taxiDriver'])
/** whether customer number `id` may be served alcohol: of age and not driving */
export const drinksAlcohol = (id: number) => !MINORS.has(kindOf(id).kind) && !ON_DUTY.has(kindOf(id).kind)
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
 * Who comes in when (item 377, the owner's 「晝夜變換時也得很明顯是不同客群 (EX: 小孩不會出現在深夜)」): the shop's night in six parts, each its
 * own crowd. After school (16:30) the schoolchildren, the high schoolers, mothers with the shopping done, the old folk at their early supper
 * and the building sites' crews off at five; the dinner hour (18:30) families and the offices let out; the evening (21:00) the drinkers, the
 * office workers, the students, the couples; round midnight (23:30) those off the last train and the night's trades just done (the
 * restaurants' cooks, the bands off the stage, the nurses off the late shift); the deep night (01:30) the taxi drivers on their break, the
 * night road crews, the bikers; the dawn (03:30) the fish market's hands before the auction and the taxis' last fares. A weight against each
 * kind's own (KINDS), by the part (0: not at all); and the young and the old not out past their hour at all (CURFEW).
 */
export type CrowdPart = 'afterSchool' | 'dinner' | 'evening' | 'midnight' | 'deep' | 'dawn'
export const CROWD_PARTS: readonly { part: CrowdPart; from: number; zh: string; ja: string; en: string }[] = [
  { part: 'afterSchool', from: 16 * 60 + 30, zh: '放學後', ja: '放課後', en: 'After school' },
  { part: 'dinner', from: 18 * 60 + 30, zh: '晚餐時間', ja: '夕食どき', en: 'Dinner' },
  { part: 'evening', from: 21 * 60, zh: '晚上', ja: '夜', en: 'Evening' },
  { part: 'midnight', from: 23 * 60 + 30, zh: '午夜', ja: '真夜中', en: 'Midnight' },
  { part: 'deep', from: 1 * 60 + 30, zh: '深夜', ja: '深夜', en: 'Deep night' },
  { part: 'dawn', from: 3 * 60 + 30, zh: '清晨', ja: '明け方', en: 'Dawn' },
]
/** the part of the night it is (minutes from midnight; the hours before the opening count as after school, those after the closing as dawn) */
export function crowdPart(minute: number): CrowdPart {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  if (m >= 23 * 60 + 30) return 'midnight'
  if (m >= 21 * 60) return 'evening'
  if (m >= 18 * 60 + 30) return 'dinner'
  if (m >= 12 * 60) return 'afterSchool'
  if (m >= 3 * 60 + 30) return 'dawn'
  if (m >= 1 * 60 + 30) return 'deep'
  return 'midnight'
}
/** each kind's weight in each part, in CROWD_PARTS' order: after school, dinner, evening, midnight, deep night, dawn */
export const CROWD: Record<GuestKind, readonly [number, number, number, number, number, number]> = {
  salaryman: [0.4, 1.3, 1.8, 1.5, 0.3, 0.1],
  officeLady: [0.4, 1.4, 1.5, 0.6, 0.1, 0],
  civilServant: [1.2, 1.3, 0.5, 0.1, 0, 0],
  schoolboy: [2.2, 1.0, 0.3, 0, 0, 0],
  schoolgirl: [2.2, 1.0, 0.3, 0, 0, 0],
  collegeStudent: [0.8, 1.0, 1.6, 1.6, 0.8, 0.2],
  kid: [2.5, 1.0, 0, 0, 0, 0],
  uncle: [0.7, 1.0, 1.5, 1.2, 0.6, 0.3],
  grandpa: [2.0, 0.8, 0.1, 0, 0, 0],
  grandma: [2.0, 0.8, 0.1, 0, 0, 0],
  yukataLady: [0.6, 1.3, 1.4, 0.4, 0, 0],
  foreignTourist: [1.0, 1.2, 1.2, 0.8, 0.3, 0.3],
  gyaru: [0.6, 0.8, 1.5, 1.8, 1.2, 0.3],
  maidCoser: [0.6, 1.0, 1.3, 0.6, 0.1, 0],
  delinquent: [0.2, 0.3, 1.0, 2.0, 2.5, 1.0],
  bosozoku: [0, 0.1, 0.6, 2.0, 3.0, 1.5],
  housewife: [2.5, 0.8, 0.1, 0, 0, 0],
  constructionWorker: [1.6, 1.0, 0.5, 0.8, 1.5, 1.5],
  taxiDriver: [0, 0.2, 0.6, 1.5, 2.5, 2.5],
  nurse: [0.2, 0.3, 0.4, 1.2, 2.0, 1.2],
  bandman: [0, 0.2, 0.8, 2.2, 1.5, 0.3],
  offShiftChef: [0, 0, 0.4, 2.2, 1.6, 0.6],
  marketWorker: [0, 0, 0, 0.2, 1.2, 5.0],
}
/** the young and the old not coming in after then (minutes from midnight, the evening's): the children after half past seven (a visit's an
 * hour or two of the game's clock: so they've gone home by nine, as the evening's word in the log has it; at eight, one in at 19:59 was still at
 * the bar at half past nine), the high schoolers after ten (Japan's youth ordinances keep them in from eleven), the old folk and the mothers
 * after half past nine */
export const CURFEW: Partial<Record<GuestKind, number>> = {
  kid: 19 * 60 + 30, schoolboy: 22 * 60, schoolgirl: 22 * 60, grandpa: 21 * 60 + 30, grandma: 21 * 60 + 30, housewife: 21 * 60 + 30,
}
const PART_INDEX = Object.fromEntries(CROWD_PARTS.map((p, i) => [p.part, i])) as Record<CrowdPart, number>
const PART_MAX = CROWD_PARTS.map((_, i) => Math.max(...Object.values(CROWD).map((w) => w[i])))
/** whether customer number `id` is past their hour now (CURFEW: from it on through the night, till the next afternoon): one waiting on the
 * bench since before it goes home rather than sit down (item 377: a child called to a stool at seven past ten) */
export function pastHour(id: number, minute: number) {
  const home = CURFEW[kindOf(id).kind]
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return home !== undefined && (m >= home || m < 12 * 60)
}
/** whether customer number `id` is one who'd come in at this minute: their kind's weight then (fixed for each number), and their hour */
export function comesAt(id: number, minute: number) {
  const kind = kindOf(id).kind
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  if (pastHour(id, m)) return false
  const i = PART_INDEX[crowdPart(m)]
  const w = CROWD[kind][i]
  if (w <= 0) return false
  let h = Math.imul(id ^ 0x5bd1e995, 0x27d4eb2d)
  h = Math.imul(h ^ (h >>> 15), 0x165667b1)
  return (((h ^ (h >>> 13)) >>> 0) % 1000) / 1000 < w / PART_MAX[i]
}
/** who comes in with a child in the early evening and at dinner (a parent, a grandparent), instead of as a couple */
export const WITH_CHILD: ReadonlySet<GuestKind> = new Set(['housewife', 'salaryman', 'officeLady', 'grandpa', 'grandma', 'uncle', 'civilServant'])
/** how many of the pairs coming in now are a grown-up and a child rather than a couple: after school 60%, at dinner 40%, later none */
export const familyShare = (minute: number) => {
  const p = crowdPart(minute)
  return p === 'afterSchool' ? 0.6 : p === 'dinner' ? 0.4 : 0
}
/** the deep night's customers order more: one more dish, about half of them */
export const LATE_MORE = 0.5
