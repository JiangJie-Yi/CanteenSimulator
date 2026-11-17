// What the crew call out and say to each other on the floor (item 324, the owner's, 2026-11-18: 「老闆與員工說的話還是很不自然，然後員工多半
// 沉默?」), as a Japanese grill's floor really sounds: a customer in, the whole shop's welcome passed along; an order taken, said back; a
// customer out, thanks together; busy, calls to each other (the plates, the coal); quiet, a few words between two, warm or curt as they get
// on (game/affinity). Each in Chinese, Japanese and English; shops/grill/crewTalk picks who says what and never the same twice running.
import type { Lang } from './i18n'

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
/** the owner, the air gone cold: a word to lift it */
export const OWNER_LIFT: Pool = {
  zh: ['大家辛苦了，忙完一起吃個員工餐吧。', '再撐一下，今天大家都很棒！'],
  ja: ['みんなお疲れ、落ち着いたらまかない食べよう。', 'もうひと踏ん張り、今日はみんないい感じだよ！'],
  en: ['Good work, everyone. Staff meal once it calms down.', 'Hang in there, you are all doing great today!'],
}
