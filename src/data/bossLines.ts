// What the owner mutters to himself as he goes about his grill: never quite quiet. Different by day and by night, and whether the shop's
// open or shut: in the morning with the place to himself he fusses over the charcoal and the stock, at night after closing he's tired and
// sums up the day; open, he frets over the customers and the fire.
import type { Lang } from './i18n'

export type BossSituation = 'dayClosed' | 'nightClosed' | 'dayOpen' | 'nightOpen'
type Line = { zh: string; ja: string; en: string }

export const BOSS_LINES: Record<BossSituation, Line[]> = {
  dayClosed: [
    { zh: '早上的炭要先燒透，急不得……', ja: '朝の炭はじっくり熾さんとな……', en: "Morning coals need time to catch…" },
    { zh: '今天的魚看起來不錯喔。', ja: '今日の魚はいい顔してるな。', en: 'The fish look good today.' },
    { zh: '鹽……鹽放哪去了？', ja: '塩……塩はどこやった？', en: 'Salt… where did I put the salt?' },
    { zh: '冷藏櫃再看一次，別缺貨。', ja: '冷蔵庫、もう一回見とこう。', en: "One more look in the fridge. Can't run out." },
    { zh: '神明保佑，今天生意興隆。', ja: '神様、今日も商売繁盛で頼みます。', en: 'Gods, a good trade today, please.' },
    { zh: '這把扇子該換了吧……', ja: 'この団扇もそろそろ替え時か……', en: 'This fan needs replacing…' },
    { zh: '嗯～先試烤一串看看。', ja: 'よし、試しに一本焼いてみるか。', en: "Right, let's grill one to try." },
    { zh: '開店前地板要拖乾淨。', ja: '開ける前に床を拭いとかんと。', en: 'Floor needs mopping before we open.' },
    { zh: '天氣這麼好，客人應該會多。', ja: 'いい天気だ、客も来るだろう。', en: "Fine day. They'll come." },
    { zh: '哼～哼哼～♪', ja: 'ふんふ～ん♪', en: 'Hmm-hm-hmm~♪' },
  ],
  nightClosed: [
    { zh: '呼……今天也辛苦了。', ja: 'ふう……今日もお疲れさん。', en: 'Phew… another day done.' },
    { zh: '收銀機的帳對一下……', ja: 'レジの締め、合わせとくか……', en: 'Better square the till…' },
    { zh: '炭火要確實熄掉才能回家。', ja: '火の始末だけはしっかりな。', en: 'Make sure the fire is out before going home.' },
    { zh: '明天要進什麼魚呢……', ja: '明日はなにを仕入れるか……', en: 'What fish tomorrow…' },
    { zh: '肩膀好痠喔……', ja: '肩が凝ったなあ……', en: 'My shoulders ache…' },
    { zh: '來一杯清酒犒賞自己吧。', ja: '一杯だけ、自分にご褒美だ。', en: 'Just one sake for me.' },
    { zh: '外面好安靜啊。', ja: '外は静かだねえ。', en: "So quiet outside." },
    { zh: '燈籠記得關。', ja: '提灯、消すの忘れんように。', en: "Don't forget the lantern." },
    { zh: '今天那位客人笑得真開心。', ja: '今日のあのお客さん、いい顔してたな。', en: 'That customer today really smiled.' },
    { zh: '呵～欠～', ja: 'ふぁ～あ……', en: 'Yaaawn…' },
  ],
  dayOpen: [
    { zh: '歡迎光臨～！', ja: 'いらっしゃい！', en: 'Welcome!' },
    { zh: '火再旺一點，再一點……', ja: '火、もうちょい強く……', en: 'More heat… a bit more…' },
    { zh: '那桌的魚翻面了沒？', ja: 'あの魚、ひっくり返したか？', en: 'Did that fish get turned?' },
    { zh: '午餐時間要快、要快！', ja: '昼時は手早く、手早く！', en: 'Lunch rush, quick, quick!' },
    { zh: '盤子夠不夠啊？', ja: '皿、足りてるか？', en: 'Enough plates?' },
    { zh: '鹽烤最好吃，相信我。', ja: '塩焼きが一番うまいんだ。', en: 'Salt-grilled is best, trust me.' },
    { zh: '客人等太久會生氣喔。', ja: 'お客さん待たせすぎるなよ。', en: "Don't keep them waiting." },
    { zh: '好香啊～', ja: 'いい匂いだ～', en: 'Smells good~' },
    { zh: '謝謝光臨，再來喔！', ja: 'ありがとうございました、またどうぞ！', en: 'Thanks, come again!' },
    { zh: '炭要補了嗎？', ja: '炭、足しとくか？', en: 'Need more charcoal?' },
  ],
  nightOpen: [
    { zh: '晚上就是要配一杯啊。', ja: '夜はやっぱり一杯だよな。', en: 'Night calls for a drink.' },
    { zh: '歡迎～裡面請！', ja: 'いらっしゃい、奥へどうぞ！', en: 'Welcome, come on in!' },
    { zh: '燈籠亮了，客人就來了。', ja: '提灯が灯れば、客が来る。', en: 'Light the lantern and they come.' },
    { zh: '這串烤得剛剛好。', ja: 'この串、ちょうどいい焼き加減だ。', en: 'This one is just right.' },
    { zh: '熱鬧起來囉～', ja: 'にぎやかになってきたな～', en: 'Getting lively~' },
    { zh: '清酒還夠嗎？', ja: '酒はまだあるか？', en: 'Enough sake left?' },
    { zh: '夜深了，火別太大。', ja: '夜も更けた、火は控えめに。', en: 'Late now, easy on the fire.' },
    { zh: '今天的最後一條魚！', ja: '今日最後の一尾だ！', en: "Last fish of the day!" },
    { zh: '小心慢走喔～', ja: 'お気をつけて～', en: 'Mind how you go~' },
    { zh: '再撐一下就打烊了。', ja: 'もうひと踏ん張りで店じまいだ。', en: 'Nearly closing time.' },
  ],
}

/** which lines he's on: by the light outside and whether the doors are open */
export const bossSituation = (night: boolean, open: boolean): BossSituation =>
  night ? (open ? 'nightOpen' : 'nightClosed') : (open ? 'dayOpen' : 'dayClosed')

/** the next thing he says (an index into the situation's lines), `r` in 0..1: any but the one he's just said */
export function nextBossLine(s: BossSituation, last: number | null, r: number): number {
  const n = BOSS_LINES[s].length
  if (n < 2 || last === null || last >= n) return Math.min(n - 1, Math.floor(r * n))
  const k = Math.min(n - 2, Math.floor(r * (n - 1)))
  return k >= last ? k + 1 : k
}

export const bossLineText = (s: BossSituation, i: number, lang: Lang) => {
  const l = BOSS_LINES[s][i]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}

/** what he says as he comes over to taste something from the tasting bowl */
export const TASTE_LINES: Line[] = [
  { zh: '我嚐嚐看～', ja: 'どれどれ、味見～', en: 'Let me taste…' },
  { zh: '來，試吃一口！', ja: '一口いただき！', en: 'One bite to try!' },
  { zh: '嗯……這火候如何呢？', ja: 'うむ……焼き加減はどうかな？', en: "Hm… how's it done?" },
]
export const tasteLineText = (r: number, lang: Lang) => {
  const l = TASTE_LINES[Math.floor(r * TASTE_LINES.length) % TASTE_LINES.length]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}
