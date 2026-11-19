// What the staff say as their mood shows (item 381, the owner's 「員工也得有情緒」, game/crewMood): now and then as the shop gets on top of them,
// and as they wear out. Each in Chinese, Japanese and English.
import type { Lang } from './i18n'

type Pool = Record<Lang, readonly string[]>

/** pressed: the customers waiting, the orders piling up */
export const CREW_BUSY: Pool = {
  zh: ['忙不過來了！', '來了來了！', '馬上好，再等一下！', '今天客人好多啊！'],
  ja: ['手が回らない！', 'はい、ただいま！', 'すぐ行きます！', '今日はお客さん多いなあ！'],
  en: ['Swamped!', 'Coming, coming!', 'Right away!', 'So many customers today!'],
}
/** worn out */
export const CREW_TIRED: Pool = {
  zh: ['好累……', '腳好痠……', '再撐一下就好……', '有點撐不住了……'],
  ja: ['疲れた……', '足が棒みたい……', 'もうひと踏ん張り……', 'ちょっとしんどい……'],
  en: ['So tired...', 'My feet are killing me...', 'Just a little longer...', "I'm running on empty..."],
}
