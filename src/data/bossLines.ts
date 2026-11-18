// What the owner mutters to himself as he goes about his grill: never quite quiet. By the game's clock (game/talkTime's bossSituation, item
// 372, the owner's 「老闆的話要能對得上時間」: it went by the page's dark or light theme, 「午餐時間要快」 at a quarter past five in the evening):
// shut, from the dawn after closing (tired, squaring the till) through the morning's fish and stock and the afternoon's getting ready, to a
// shop that should be open and isn't; open, from the first customers through the dinner rush, the drinkers' evening and the deep night to
// the last orders. No welcome or thanks among them: those are the shop's, as a customer comes in or goes (shops/grill/crewTalk).
import type { Lang } from './i18n'

export type BossSituation = 'closedDawn' | 'closedMorning' | 'closedPrep' | 'closedEvening' | 'closedLate' | 'openEarly' | 'openPeak' | 'openNight'
  | 'openLate' | 'openLast'
type Line = { zh: string; ja: string; en: string }

export const BOSS_LINES: Record<BossSituation, Line[]> = {
  // (04:30-08:00, just shut: tidying up, tired, the day summed up, the dawn coming)
  closedDawn: [
    { zh: '呼……今天也辛苦了。', ja: 'ふう……今日もお疲れさん。', en: 'Phew… another day done.' },
    { zh: '收銀機的帳對一下……', ja: 'レジの締め、合わせとくか……', en: 'Better square the till…' },
    { zh: '炭火要確實熄掉才能上樓。', ja: '火の始末だけはしっかりな。', en: "Make sure the fire's out before bed." },
    { zh: '天都快亮了……', ja: 'もうすぐ夜が明けるな……', en: 'Nearly dawn already…' },
    { zh: '肩膀好痠喔……', ja: '肩が凝ったなあ……', en: 'My shoulders ache…' },
    { zh: '收工的一杯最好喝。', ja: '仕事上がりの一杯が一番うまい。', en: 'The drink after closing is the best one.' },
    { zh: '今天那位客人笑得真開心。', ja: '今日のあのお客さん、いい顔してたな。', en: 'That customer today really smiled.' },
    { zh: '呵～欠～', ja: 'ふぁ～あ……', en: 'Yaaawn…' },
    { zh: '鐵串泡一下，明天再刷。', ja: '串は浸けといて、明日洗おう。', en: 'Soak the skewers; scrub them tomorrow.' },
    { zh: '麻雀開始叫了。', ja: 'スズメが鳴き出したな。', en: 'The sparrows are starting up.' },
  ],
  // (08:00-12:00: the market's fish, the stock, the shrine)
  closedMorning: [
    { zh: '今天的魚看起來不錯喔。', ja: '今日の魚はいい顔してるな。', en: 'The fish look good today.' },
    { zh: '冷藏櫃再看一次，別缺貨。', ja: '冷蔵庫、もう一回見とこう。', en: "One more look in the fridge. Can't run out." },
    { zh: '神明保佑，今天生意興隆。', ja: '神様、今日も商売繁盛で頼みます。', en: 'Gods, a good trade today, please.' },
    { zh: '魚市場今天的鯖魚很肥。', ja: '今日の市場、鯖が脂のってたな。', en: 'The mackerel at the market was fat today.' },
    { zh: '早上的空氣真舒服。', ja: '朝の空気は気持ちいいな。', en: 'Lovely morning air.' },
    { zh: '鹽……鹽放哪去了？', ja: '塩……塩はどこやった？', en: 'Salt… where did I put the salt?' },
    { zh: '這把扇子該換了吧……', ja: 'この団扇もそろそろ替え時か……', en: 'This fan needs replacing…' },
    { zh: '哼～哼哼～', ja: 'ふんふ～ん', en: 'Hmm-hm-hmm~' },
    { zh: '先喝杯茶再說。', ja: 'まずはお茶を一杯。', en: 'A cup of tea first.' },
  ],
  // (12:00-16:30: getting ready: the coals, the skewers, the sauce, the floor)
  closedPrep: [
    { zh: '炭要先燒透，急不得……', ja: '炭はじっくり熾さんとな……', en: 'Coals need time to catch…' },
    { zh: '嗯～先試烤一串看看。', ja: 'よし、試しに一本焼いてみるか。', en: "Right, let's grill one to try." },
    { zh: '開店前地板要拖乾淨。', ja: '開ける前に床を拭いとかんと。', en: 'Floor needs mopping before we open.' },
    { zh: '串子穿好了沒……', ja: '串打ち、終わったかな……', en: 'Are the skewers all threaded…' },
    { zh: '再過一會兒就開店了。', ja: 'もうすぐ開店だな。', en: 'Not long till we open.' },
    { zh: '醬汁再熬一下。', ja: 'タレ、もう少し煮詰めよう。', en: 'The sauce wants a little longer.' },
    { zh: '燈籠的紙有沒有破……', ja: '提灯の紙、破れてないか……', en: 'Is the lantern paper torn anywhere…' },
    { zh: '今天的客人應該會多。', ja: '今日は客が来そうだ。', en: "There'll be a crowd today." },
    { zh: '米洗好了，等一下來煮。', ja: '米は研いだ、あとで炊こう。', en: 'Rice is washed; cook it in a bit.' },
  ],
  // (16:30-23:00 and still shut: a shop that should be open)
  closedEvening: [
    { zh: '該開店了吧……', ja: 'そろそろ開けるか……', en: 'Time we opened…' },
    { zh: '門口有人在看菜單呢。', ja: '表で品書き見てる人がいるな。', en: "Someone's reading the menu outside." },
    { zh: '燈籠還沒點……', ja: '提灯、まだ灯してないな……', en: "The lanterns aren't lit yet…" },
    { zh: '隔壁都開門了。', ja: '隣の店はもう開いてるな。', en: 'The places next door are open already.' },
    { zh: '今天要不要休息一天呢……', ja: '今日は休みにするか……', en: 'Maybe a day off today…' },
    { zh: '肚子有點餓了。', ja: 'ちょっと腹が減ったな。', en: 'Getting a bit peckish.' },
    { zh: '炭都燒好了，就等開門。', ja: '炭はできてる、あとは開けるだけ。', en: 'The coals are ready; just open up.' },
    { zh: '外面越來越熱鬧了。', ja: '外がにぎやかになってきた。', en: "It's getting lively out there." },
  ],
  // (23:00-04:30 and shut: too late to open)
  closedLate: [
    { zh: '這麼晚了，今天就休息吧。', ja: 'こんな時間か、今日は休みだな。', en: 'This late? A day off, then.' },
    { zh: '外面好安靜啊。', ja: '外は静かだねえ。', en: 'So quiet outside.' },
    { zh: '來一杯清酒犒賞自己吧。', ja: '一杯だけ、自分にご褒美だ。', en: 'Just one sake for me.' },
    { zh: '明天要進什麼魚呢……', ja: '明日はなにを仕入れるか……', en: 'What fish tomorrow…' },
    { zh: '燈籠記得關。', ja: '提灯、消すの忘れんように。', en: "Don't forget the lanterns." },
    { zh: '野貓又在叫了。', ja: 'また野良猫が鳴いてる。', en: "That stray's yowling again." },
    { zh: '睡前再看一下火。', ja: '寝る前に火を見とこう。', en: 'One more look at the fire before bed.' },
    { zh: '呼～好睏。', ja: 'ふあ、眠い。', en: 'Mm, sleepy.' },
  ],
  // (open, 16:30-18:30: the doors just open, the first customers)
  openEarly: [
    { zh: '開門囉！今天也請多指教。', ja: '開店だ！今日もよろしく頼むよ。', en: "We're open! Here's to today." },
    { zh: '第一位客人快來了吧。', ja: '一人目のお客さん、そろそろかな。', en: 'The first customer should be along soon.' },
    { zh: '火候剛剛好。', ja: '火加減、ちょうどいい。', en: "The heat's just right." },
    { zh: '晚餐時間快到了，先多烤幾串。', ja: '晩飯時が来るぞ、先に何本か焼いとこう。', en: 'Dinner rush is coming; grill a few ahead.' },
    { zh: '天色暗下來了。', ja: '日が暮れてきたな。', en: "It's getting dark." },
    { zh: '炭要補了嗎？', ja: '炭、足しとくか？', en: 'Need more charcoal?' },
    { zh: '好香啊～', ja: 'いい匂いだ～', en: 'Smells good~' },
    { zh: '下班的人開始多了。', ja: '仕事帰りの人が増えてきた。', en: "The after-work crowd's starting." },
  ],
  // (18:30-21:30: the dinner rush)
  openPeak: [
    { zh: '晚餐時間，要快、要快！', ja: '晩飯時だ、手早く、手早く！', en: 'Dinner rush, quick, quick!' },
    { zh: '那桌的魚翻面了沒？', ja: 'あの魚、ひっくり返したか？', en: 'Did that fish get turned?' },
    { zh: '盤子夠不夠啊？', ja: '皿、足りてるか？', en: 'Enough plates?' },
    { zh: '客人等太久會生氣喔。', ja: 'お客さん待たせすぎるなよ。', en: "Don't keep them waiting." },
    { zh: '火再旺一點，再一點……', ja: '火、もうちょい強く……', en: 'More heat… a bit more…' },
    { zh: '熱鬧起來囉～', ja: 'にぎやかになってきたな～', en: 'Getting lively~' },
    { zh: '鹽烤最好吃，相信我。', ja: '塩焼きが一番うまいんだ。', en: 'Salt-grilled is best, trust me.' },
    { zh: '一串一串來，別慌。', ja: '一本ずつ、慌てるな。', en: 'One skewer at a time, no panic.' },
    { zh: '這串烤得剛剛好。', ja: 'この串、ちょうどいい焼き加減だ。', en: 'This one is just right.' },
  ],
  // (21:30-24:00: the rush over, the drinkers' evening)
  openNight: [
    { zh: '晚上就是要配一杯啊。', ja: '夜はやっぱり一杯だよな。', en: 'Night calls for a drink.' },
    { zh: '清酒還夠嗎？', ja: '酒はまだあるか？', en: 'Enough sake left?' },
    { zh: '燈籠亮著，客人就會來。', ja: '提灯が灯れば、客が来る。', en: 'Light the lantern and they come.' },
    { zh: '喝第二攤的客人來了。', ja: '二軒目のお客さんが来る頃だ。', en: 'Here come the second-round drinkers.' },
    { zh: '這個時間，烤飯糰最受歡迎。', ja: 'この時間は焼きおにぎりが出るんだよな。', en: "This time of night, it's the grilled rice balls." },
    { zh: '尖峰過了，喘口氣。', ja: 'ピークは過ぎた、ひと息だ。', en: 'Rush is over; breathe.' },
    { zh: '吧台的客人聊得真開心。', ja: 'カウンターの客、楽しそうだな。', en: "The counter's having a good time." },
    { zh: '魚還剩幾條……', ja: '魚、あと何尾だ……', en: 'How many fish left…' },
  ],
  // (00:00-04:00: the deep night)
  openLate: [
    { zh: '夜深了，火別太大。', ja: '夜も更けた、火は控えめに。', en: 'Late now, easy on the fire.' },
    { zh: '末班車都走了，還有客人呢。', ja: '終電も行ったのに、まだ客がいる。', en: "The last train's gone and they're still here." },
    { zh: '深夜的客人都很安靜。', ja: '深夜の客は静かだな。', en: "The late crowd's a quiet one." },
    { zh: '肚子餓了，等下來碗茶泡飯。', ja: '腹減った、あとで茶漬けにしよう。', en: 'Hungry; tea over rice later.' },
    { zh: '呵……不能睏。', ja: 'ふぁ……寝ちゃいかん。', en: "Mm… mustn't nod off." },
    { zh: '這個時間還有人點魚，真好。', ja: 'この時間に魚が出るのはありがたい。', en: 'Fish orders at this hour, lovely.' },
    { zh: '計程車在門口等客人了。', ja: '表でタクシーが客待ちしてる。', en: "A taxi's waiting out front." },
    { zh: '再撐幾個小時。', ja: 'あと何時間か、踏ん張ろう。', en: 'A few more hours.' },
  ],
  // (04:00 on: the last orders, the shop shutting)
  openLast: [
    { zh: '最後點餐囉。', ja: 'ラストオーダーだ。', en: 'Last orders now.' },
    { zh: '今天的最後一條魚！', ja: '今日最後の一尾だ！', en: 'Last fish of the day!' },
    { zh: '再撐一下就打烊了。', ja: 'もうひと踏ん張りで店じまいだ。', en: 'Nearly closing time.' },
    { zh: '爐子可以慢慢收了。', ja: '炉はそろそろ落としていい。', en: 'We can let the fire down now.' },
    { zh: '小心慢走喔～', ja: 'お気をつけて～', en: 'Mind how you go~' },
    { zh: '收拾一下，準備打烊。', ja: '片付けて、店じまいの支度だ。', en: 'Tidy up; time to shut.' },
    { zh: '今天辛苦大家了。', ja: '今日もみんなご苦労さん。', en: 'Good work today, everyone.' },
    { zh: '剩下的炭留到明天。', ja: '残りの炭は明日に回そう。', en: 'Save the rest of the coal for tomorrow.' },
  ],
}

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

/** what he says while he chews it (the bites crunching, his cheeks going) */
export const MUNCH_LINES: Line[] = [
  { zh: '（嚼嚼）嗯……', ja: '（もぐもぐ）うむ……', en: '*munch munch* hm…' },
  { zh: '咔滋……唔……', ja: 'カリッ……んー……', en: '*crunch*… mm…' },
  { zh: '（嚼）……嗯嗯。', ja: '（もぐ）……ふむふむ。', en: '*chew*… mm-hm.' },
]
export const munchLineText = (r: number, lang: Lang) => {
  const l = MUNCH_LINES[Math.floor(r * MUNCH_LINES.length) % MUNCH_LINES.length]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}

/** how he finds what he's tasted, by its 美味 (0..100): very good from 80, good from 60, so-so from 35, else bad */
export type TasteVerdict = 'great' | 'good' | 'meh' | 'bad'
export const tasteVerdict = (taste: number): TasteVerdict => (taste >= 80 ? 'great' : taste >= 60 ? 'good' : taste >= 35 ? 'meh' : 'bad')
/** what he says once he's swallowed it */
export const VERDICT_LINES: Record<TasteVerdict, Line[]> = {
  great: [
    { zh: '好吃！就是這個味道！', ja: 'うまい！これだよ、これ！', en: "Delicious! That's the one!" },
    { zh: '完美，可以上菜單了！', ja: '完璧だ、品書きに載せられる！', en: 'Perfect. Menu-worthy!' },
  ],
  good: [
    { zh: '嗯，不錯吃。', ja: 'うん、悪くない。', en: 'Mm, not bad at all.' },
    { zh: '好吃，再調一下會更好。', ja: 'うまい、もう一工夫でもっと良くなる。', en: 'Good. A tweak and it’s great.' },
  ],
  meh: [
    { zh: '普通……還差一點。', ja: 'まあまあ……もう一歩だな。', en: 'So-so… not quite there.' },
    { zh: '嗯……味道有點淡。', ja: 'うーん……ちょっと物足りない。', en: 'Hm… a bit flat.' },
  ],
  bad: [
    { zh: '不行，這個不能端給客人。', ja: 'だめだ、これは客に出せん。', en: "No. Can't serve this." },
    { zh: '唔……烤壞了吧。', ja: 'うっ……焼き損じたな。', en: 'Ugh… that one went wrong.' },
  ],
}
export const verdictLineText = (v: TasteVerdict, r: number, lang: Lang) => {
  const ls = VERDICT_LINES[v]
  const l = ls[Math.floor(r * ls.length) % ls.length]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}

/** what he says as he drinks what he's been handed */
export const DRINK_LINES: Line[] = [
  { zh: '噗哈～冰得剛好！', ja: 'ぷはーっ、よく冷えてる！', en: 'Ahh, nice and cold!' },
  { zh: '謝啦，正渴呢！', ja: 'ありがとよ、ちょうど喉が渇いてた！', en: 'Thanks, I was parched!' },
  { zh: '工作中來一口，最棒了。', ja: '仕事中の一杯、最高だね。', en: 'A sip on the job — the best.' },
]
export const drinkLineText = (r: number, lang: Lang) => {
  const l = DRINK_LINES[Math.floor(r * DRINK_LINES.length) % DRINK_LINES.length]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}
/** what the owner says, delighted, as the money's taken out of the till's drawer (the owner's) */
export const CASH_LINES: Line[] = [
  { zh: '喔喔！今天收成真好！', ja: 'おおっ！今日は大漁だ！', en: 'Ooh! A good haul today!' },
  { zh: '太棒了！有錢賺囉！', ja: 'やった！儲かったぞ！', en: "Brilliant! We're making money!" },
  { zh: '嘿嘿，今天也是大豐收～', ja: 'へへっ、今日も大漁だね〜', en: 'Heh heh, another bumper day~' },
]
export const cashLineText = (r: number, lang: Lang) => {
  const l = CASH_LINES[Math.floor(r * CASH_LINES.length) % CASH_LINES.length]
  return lang === 'ja' ? l.ja : lang === 'en' ? l.en : l.zh
}
