// What the chefs and the customers say, in both languages.
import type { Lang } from './i18n'

const ZH = {
  addCharcoal: '火小了，添點炭',
  done: (n: string) => `${n}烤好了！`,
  seasoned: (n: string, k: string) => `${n}${({ salt: '撒點鹽', soy: '刷上醬油', milk: '淋上煉乳', peanut: '撒花生粉', miso: '抹上味噌', wasabi: '配上山葵', shichimi: '撒點七味', yuzu: '點上柚子胡椒', lemon: '擠點檸檬' } as Record<string, string>)[k] ?? ''}`,
  onFire: (n: string) => `${n}上火了`,
  stickAway: '竹籤收一下',
  burntAway: '這個烤焦了，丟掉吧',
  order: (id: number, names: string[]) => `#${id} 我要${names.join('、')}！`,
  nothing: (id: number) => `#${id} 沒有想吃的，下次再來`,
  angry: (id: number) => `#${id} 等太久了，不吃了！`,
  verdict: (id: number, n: string, stars: number) => `#${id} ${n}${['不太行…', '還可以', '不錯吃', '好吃！', '太好吃了！'][stars - 1]}`,
  trial: (who: string, names: string[]) => `${who}試做了：${names.join('、')}，記在試菜紀錄了`,
  trialNone: (who: string) => `${who}：沒有材料可以試，先進貨吧`,
}
const JA: typeof ZH = {
  addCharcoal: '火が弱いな、炭を足そう',
  done: (n) => `${n}、焼き上がり！`,
  seasoned: (n, k) => `${n}に${({ salt: '塩をひと振り', soy: '醤油を塗って', milk: '練乳をかけて', peanut: 'きな粉をまぶして', miso: '味噌を塗って', wasabi: 'わさびを添えて', shichimi: '七味を振って', yuzu: '柚子胡椒を添えて', lemon: 'レモンを搾って' } as Record<string, string>)[k] ?? ''}`,
  onFire: (n) => `${n}、火にかけます`,
  stickAway: '串を片付けます',
  burntAway: '焦げちゃった、下げよう',
  order: (id, names) => `#${id} ${names.join('と')}ください！`,
  nothing: (id) => `#${id} 食べたいものがないな、また来ます`,
  angry: (id) => `#${id} 遅すぎる、もう帰る！`,
  verdict: (id, n, stars) => `#${id} ${n}、${['いまいち…', 'まあまあ', 'おいしい', 'うまい！', '最高にうまい！'][stars - 1]}`,
  trial: (who, names) => `${who}が試作：${names.join('、')}（ノートに記録）`,
  trialNone: (who) => `${who}：材料がありません。先に仕入れを`,
}
export const LINES: Record<Lang, typeof ZH> = { zh: ZH, ja: JA }
