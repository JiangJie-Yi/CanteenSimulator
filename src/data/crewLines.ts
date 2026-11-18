// What the crew call out and say to each other on the floor (item 324, the owner's, 2026-11-18: 「老闆與員工說的話還是很不自然，然後員工多半
// 沉默?」), as a Japanese grill's floor really sounds: a customer in, the whole shop's welcome passed along; an order taken, said back; a
// customer out, thanks together; busy, calls to each other (the plates, the coal); quiet, a few words between two, warm or curt as they get
// on (game/affinity). Each in Chinese, Japanese and English; shops/grill/crewTalk picks who says what and never the same twice running.
import type { Lang } from './i18n'
import type { Role } from './staff'

/** the part of the night it is, as game/talkTime's talkPart says it (a type only: data imports no game) */
export type TalkPart = 'early' | 'peak' | 'night' | 'late' | 'last'
type Pool = Record<Lang, readonly string[]>

/** the welcome, each one's own way of calling it as it's passed along the floor */
export const CREW_WELCOME: Pool = {
  zh: ['歡迎光臨！', '歡迎光臨～', '您好，歡迎光臨！', '歡迎～裡面請！'],
  ja: ['いらっしゃいませー！', 'いらっしゃいませ！', 'らっしゃいませー！', 'いらっしゃいませ、どうぞー！'],
  en: ['Welcome!', 'Irasshaimase!', 'Welcome in!', 'Evening, welcome!'],
}
/** a customer gone out of the door: thanks together */
export const CREW_THANKS: Pool = {
  zh: ['謝謝光臨！', '謝謝～再來喔！', '謝謝您，路上小心！', '謝謝光臨，慢走！'],
  ja: ['ありがとうございましたー！', 'またお越しくださいませー！', 'ありがとうございました、お気をつけて！', 'まいどありがとうございます！'],
  en: ['Thank you!', 'Come again!', 'Thanks, take care!', 'Thank you, good night!'],
}
/** an order said back as it's taken (the dish's name put in) */
export const CREW_ECHO: Record<Lang, readonly ((dish: string) => string)[]> = {
  zh: [(d) => `${d}一份，好的！`, (d) => `好的～${d}！`, (d) => `${d}，馬上來！`],
  ja: [(d) => `${d}一丁、はいよー！`, (d) => `${d}、喜んでー！`, (d) => `${d}入りまーす！`],
  en: [(d) => `One ${d}, coming up!`, (d) => `${d}, you got it!`, (d) => `${d}, on its way!`],
}
/** a dish called ready at the grill, answered from the floor (item 372) */
export const CREW_ANSWER: Pool = {
  zh: ['來了！', '好，我來端！', '收到！'],
  ja: ['はーい！', '今行きます！', 'はい、持っていきます！'],
  en: ['Coming!', 'On my way!', 'Got it!'],
}
/** busy: the plates running short, the fire wanting coal */
export const CREW_PLATES: Pool = {
  zh: ['盤子快不夠了，我去拿！', '補盤子！', '碗盤不夠，先洗一輪！'],
  ja: ['お皿足りないです、取ってきます！', 'お皿補充しまーす！', '器が足りない、先に洗います！'],
  en: ['Plates are low, getting more!', 'Topping up the plates!', 'Short of plates, washing a round!'],
}
export const CREW_COAL: Pool = {
  zh: ['炭快沒了，補一把！', '火變弱了，加炭！', '炭來了！'],
  ja: ['炭足しまーす！', '火、弱くなってます！', '炭いきまーす！'],
  en: ['Coal is low, adding some!', 'The fire is dropping, more coal!', 'Coal coming!'],
}
/** a few words between two in a quiet moment, and the other's answer: as they get on (warm, as usual, cold) */
export const CREW_CHAT: Record<'warm' | 'usual' | 'cold', Record<Lang, readonly [string, string][]>> = {
  warm: {
    zh: [['剛那串烤得真漂亮。', '嘿嘿，跟老闆偷學的。'], ['好香，我都餓了。', '忍一下，等員工餐！'], ['收工去吃拉麵？', '好啊，你請客！'],
      ['今天手感不錯喔。', '因為有你幫忙啊。'], ['那桌客人好有趣。', '對啊，一直誇魚好吃。']],
    ja: [['今の串、きれいに焼けてるね。', 'へへ、店長の見て覚えた。'], ['いい匂い、お腹すいた。', 'まかないまで我慢！'], ['上がったらラーメン行く？', '行く行く、おごりね！'],
      ['今日調子いいね。', '手伝ってくれるからだよ。'], ['あのお客さん面白いね。', 'ね、魚ずっと褒めてた。']],
    en: [['That skewer came out beautifully.', 'Learned it watching the boss.'], ['Smells so good, I am starving.', 'Hold on till the staff meal!'],
      ['Ramen after close?', 'Sure, your treat!'], ['You are on form today.', 'Because you have my back.'], ['That table is fun.', 'Right? They keep praising the fish.']],
  },
  usual: {
    zh: [['那邊桌子我擦好了。', '好，謝了。'], ['醬油還夠嗎？', '剛補過了。'], ['三號的魚快好了。', '收到，我去端。'], ['這批串洗好了。', '放回架上吧。']],
    ja: [['あっちのテーブル拭いときました。', 'はい、ありがとう。'], ['醤油まだある？', 'さっき足しました。'], ['三番の魚、もうすぐです。', '了解、持っていきます。'], ['串、洗い終わりました。', '棚に戻しといて。']],
    en: [['Wiped that table down.', 'Thanks.'], ['Enough soy out there?', 'Just topped it up.'], ['The fish for three is nearly up.', 'Got it, I will take it.'], ['Skewers are washed.', 'Rack them, please.']],
  },
  cold: {
    zh: [['你那邊快一點。', '……知道啦。'], ['又是我洗？', '不然呢。'], ['……', '……嗯。']],
    ja: [['そっち、早くして。', '……わかってる。'], ['また私が洗うの？', '他に誰がいるの。'], ['……', '……うん。']],
    en: [['Hurry up over there.', '...I know.'], ['Me washing again?', 'Who else.'], ['...', '...yeah.']],
  },
}
/** busy (item 372, the owner's 「員工都沒說話很怪」: the shop full, they used to fall silent but for the welcome): calls between two at their
 * work, and the other's answer: the floor asking the kitchen, the kitchen calling the floor, the cooks to each other */
export const CREW_BUSY: Record<'ask' | 'call' | 'kitchen', Record<Lang, readonly [string, string][]>> = {
  ask: {
    zh: [['三號的魚好了嗎？', '馬上好！'], ['白飯還有嗎？', '剛煮好一鍋！'], ['客人問今天推薦什麼。', '跟他說紅喉很肥！'], ['清酒一合，幫我溫一下！', '好，溫上了！'],
      ['外帶兩份，要快一點喔。', '收到，排前面！'], ['吧台那位要加一碗飯。', '好，馬上盛！']],
    ja: [['三番の魚、上がりますか？', 'すぐ上がるよ！'], ['ご飯まだありますか？', '今炊けたとこ！'], ['お客さんがおすすめ聞いてます。', 'のどぐろが脂のってるって！'],
      ['お酒一合、燗お願いします！', 'はいよ、つけた！'], ['お持ち帰り二つ、急ぎで！', '了解、先にやる！'], ['カウンターの方、ご飯おかわりです。', 'はい、すぐよそう！']],
    en: [['Is the fish for three ready?', 'Coming right up!'], ['Any rice left?', 'Fresh pot just done!'], ['They want to know what is good today.', 'Tell them the rosy seabass is rich!'],
      ['One flask of sake, warmed please!', 'On it, warming!'], ['Two takeaways, quick as you can.', 'Got it, they go first!'], ['Counter wants another bowl of rice.', 'Scooping it now!']],
  },
  call: {
    zh: [['鹽烤好了，端出去！', '來了！'], ['這盤小心燙！', '好！'], ['吧台那位的味噌湯！', '馬上送！'], ['盤子！盤子！', '來了來了！'], ['一號桌可以收了。', '我去收！']],
    ja: [['塩焼き上がり、お願い！', 'はーい！'], ['これ熱いから気をつけて！', 'はい！'], ['カウンターの方の味噌汁！', 'すぐ持っていきます！'], ['皿！皿！', '今行きます！'],
      ['一番さん、下げていいよ。', '下げてきます！']],
    en: [['Salt-grilled is up, take it out!', 'Coming!'], ['Careful, this one is hot!', 'Right!'], ['Miso soup for the counter!', 'On its way!'], ['Plates! Plates!', 'Coming, coming!'],
      ['Table one can be cleared.', 'I will clear it!']],
  },
  kitchen: {
    zh: [['炭再加一點！', '好，馬上！'], ['串子還有嗎？', '剛洗好一批！'], ['這條翻面了嗎？', '翻了！'], ['飯還要多久？', '再五分鐘！'], ['鹽遞給我一下。', '給你！']],
    ja: [['炭、もう少し！', 'はい、すぐ！'], ['串、まだある？', '今洗ったのがある！'], ['これ、返した？', '返しました！'], ['ご飯あとどれくらい？', 'あと五分！'], ['塩、取って。', 'はい！']],
    en: [['Bit more coal!', 'Right away!'], ['Any skewers left?', 'Just washed a batch!'], ['Has this one been turned?', 'Turned!'], ['How long on the rice?', 'Five more minutes!'],
      ['Pass the salt.', 'Here!']],
  },
}
/** a word to themselves at their own work (item 372), each job its own */
export const CREW_SELF: Record<Role, Pool> = {
  chef: {
    zh: ['這條魚真肥。', '串好了，下一批。', '冰箱的蔥快用完了。', '刀要再磨一下。'],
    ja: ['この魚、脂のってるな。', '串打ち完了、次。', 'ネギ、そろそろなくなる。', '包丁、研ぎ直さないと。'],
    en: ['Fat one, this fish.', 'Skewered; next batch.', 'Running low on spring onion.', 'This knife wants honing.'],
  },
  sous: {
    zh: ['飯快好了。', '炭火還很旺。', '這盤擺得漂亮。', '串子洗好了。'],
    ja: ['ご飯、もうすぐ炊ける。', '炭はまだ元気。', 'この盛り付け、きれいにできた。', '串、洗い終わり。'],
    en: ['Rice is nearly done.', 'The coals are still going strong.', 'That plate looks good.', 'Skewers washed.'],
  },
  server: {
    zh: ['今天客人好多喔。', '那桌的茶要加了。', '筷子要補了。', '笑容、笑容。'],
    ja: ['今日はお客さん多いなあ。', 'あの卓、お茶足さなきゃ。', 'お箸、補充しとこう。', '笑顔、笑顔。'],
    en: ['Busy today.', 'That table needs more tea.', 'Chopsticks need topping up.', 'Keep smiling.'],
  },
  cashier: {
    zh: ['零錢要補了。', '收據紙還夠。', '今天的帳很漂亮。', '十元的快沒了。'],
    ja: ['小銭、補充しないと。', 'レシートの紙はまだある。', '今日の売上、いい感じ。', '十円玉がなくなりそう。'],
    en: ['Need more change.', 'Plenty of receipt roll.', "Today's takings look good.", 'Running out of small coins.'],
  },
  stock: {
    zh: ['啤酒剩兩箱了。', '冷藏櫃該整理了。', '明天要記得叫貨。', '米還夠撐到週末。'],
    ja: ['ビール、あと二ケース。', '冷蔵庫、整理しないと。', '明日、発注忘れずに。', '米は週末までもつな。'],
    en: ['Two crates of beer left.', 'The fridge needs sorting.', "Don't forget tomorrow's order.", 'Rice will last to the weekend.'],
  },
}
/** a word to themselves about the part of the night it is (item 372; game/talkTime's talkPart): the opening, the rush, the drinkers' evening,
 * the deep night, the last orders */
export const CREW_SELF_TIME: Record<TalkPart, Pool> = {
  early: {
    zh: ['今天也加油！', '天黑得好快。', '第一桌客人來囉。'],
    ja: ['今日も頑張ろう！', '日が暮れるの早いなあ。', '最初のお客さんだ。'],
    en: ['Here we go again!', 'Gets dark so early.', 'First table of the night.'],
  },
  peak: {
    zh: ['好忙好忙！', '腳都不用停。', '尖峰時間到了。'],
    ja: ['忙しい忙しい！', '足が止まらない。', 'ピークだ。'],
    en: ['Busy, busy!', 'Never stop moving.', 'Here comes the rush.'],
  },
  night: {
    zh: ['尖峰總算過了。', '喝酒的客人變多了。', '肚子有點餓。'],
    ja: ['やっとピーク過ぎた。', '飲みのお客さんが増えてきた。', 'ちょっとお腹すいた。'],
    en: ['Rush is finally over.', 'More drinkers now.', 'Bit hungry.'],
  },
  late: {
    zh: ['好睏……再撐一下。', '深夜了，外面好安靜。', '撐住，還有幾個小時。'],
    ja: ['眠い……もうちょっと。', '深夜だ、外静か。', 'あと何時間か、頑張ろう。'],
    en: ['Sleepy… hang on.', 'Late now, so quiet outside.', 'A few more hours, keep going.'],
  },
  last: {
    zh: ['最後點餐了，加油。', '快收工了！', '等一下要把桌子都擦一遍。'],
    ja: ['ラストオーダーだ、もう少し。', 'もうすぐ上がりだ！', 'あとでテーブル全部拭かなきゃ。'],
    en: ['Last orders, nearly there.', 'Almost home time!', 'All the tables to wipe after this.'],
  },
}
/** the owner, the air gone cold: a word to lift it */
export const OWNER_LIFT: Pool = {
  zh: ['大家辛苦了，忙完一起吃個員工餐吧。', '再撐一下，今天大家都很棒！'],
  ja: ['みんなお疲れ、落ち着いたらまかない食べよう。', 'もうひと踏ん張り、今日はみんないい感じだよ！'],
  en: ['Good work, everyone. Staff meal once it calms down.', 'Hang in there, you are all doing great today!'],
}
