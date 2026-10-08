// What the chefs and the customers say, in both languages.
import type { Lang } from './i18n'

const ZH = {
  addCharcoal: '火小了，添點炭',
  done: (n: string) => `${n}烤好了！`,
  seasoned: (n: string, k: string) => `${n}${({ salt: '撒點鹽', soy: '刷上醬油', milk: '淋上煉乳', peanut: '撒花生粉' } as Record<string, string>)[k] ?? ''}`,
  onFire: (n: string) => `${n}上火了`,
  stickAway: '竹籤收一下',
  burntAway: '這個烤焦了，丟掉吧',
  order: (id: number, names: string[]) => `#${id} 我要${names.join('、')}！`,
  nothing: (id: number) => `#${id} 沒有想吃的，下次再來`,
  angry: (id: number) => `#${id} 等太久了，不吃了！`,
  verdict: (id: number, n: string, stars: number) => `#${id} ${n}${['不太行…', '還可以', '不錯吃', '好吃！', '太好吃了！'][stars - 1]}`,
  lightPot: '開火，湯滾了就可以下料',
  noodlesIn: (id: number) => `#${id} 的麵下鍋了`,
  noodlesUp: (id: number, n: string) => `#${id} 的${n}來了`,
}
const JA: typeof ZH = {
  addCharcoal: '火が弱いな、炭を足そう',
  done: (n) => `${n}、焼き上がり！`,
  seasoned: (n, k) => `${n}に${({ salt: '塩をひと振り', soy: '醤油を塗って', milk: '練乳をかけて', peanut: 'きな粉をまぶして' } as Record<string, string>)[k] ?? ''}`,
  onFire: (n) => `${n}、火にかけます`,
  stickAway: '串を片付けます',
  burntAway: '焦げちゃった、下げよう',
  order: (id, names) => `#${id} ${names.join('と')}ください！`,
  nothing: (id) => `#${id} 食べたいものがないな、また来ます`,
  angry: (id) => `#${id} 遅すぎる、もう帰る！`,
  verdict: (id, n, stars) => `#${id} ${n}、${['いまいち…', 'まあまあ', 'おいしい', 'うまい！', '最高にうまい！'][stars - 1]}`,
  lightPot: '火を点けます、煮立ったら具をどうぞ',
  noodlesIn: (id) => `#${id} さんの麺、茹でてます`,
  noodlesUp: (id, n) => `#${id} さん、${n}お待ち！`,
}
export const LINES: Record<Lang, typeof ZH> = { zh: ZH, ja: JA }
export const starsFor = (taste: number) => (taste >= 80 ? 5 : taste >= 65 ? 4 : taste >= 45 ? 3 : taste >= 25 ? 2 : 1)
