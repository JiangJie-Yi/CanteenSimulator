// What the staff say as the shop shuts and opens (the owner's): those going home on their way to the door, the owner (and those who live
// upstairs) answering; in the morning, those coming down the stair and those coming in at the door
import type { Lang } from './i18n'

type Lines = Record<Lang, readonly string[]>
/** going home, on the way to the front door */
export const CLOSE_HOME: Lines = {
  zh: ['老闆，那我先走囉！大家辛苦了～', '今天客人真多，腳好痠啊…明天見！', '外面變冷了，大家路上小心喔！'],
  ja: ['じゃあ店長、お先に失礼します！お疲れさまでした～', '今日はお客さん多かったですね、足パンパン…また明日！', '外、冷えてきましたね。みなさん気をつけて！'],
  en: ["I'm off then, boss! Good work, everyone~", 'So many customers today, my feet ache... See you tomorrow!', "It's got cold out there, take care on the way home!"],
}
/** the owner, or one who lives upstairs, answering them or heading up */
export const CLOSE_DORM: Lines = {
  zh: ['辛苦啦！回去路上小心，早點休息。', '謝啦，明天食材我先確認好，我也準備上樓睡了。', '把爐火封好就上樓吧，今天大家表現很棒！'],
  ja: ['お疲れさん！帰り道気をつけて、早く休めよ。', 'ありがとな。明日の仕入れは確認しとくから、俺も上で寝るわ。', '炉の火を落としたら上がろう。今日はみんなよくやった！'],
  en: ['Good work! Mind how you go, and get some rest.', "Thanks. I'll check tomorrow's stock, then I'm off upstairs to bed.", "Bank the fire and we'll head up. Great work today, everyone!"],
}
/** the owner as the shop's shut for the day (closing time, 04:30): no one more comes in, those here finish. Said as it's shut, after the last
 * orders were called (04:00, the chef's): it said "nearly last orders" then, the other way round (the owner's item 39); the door's lanterns
 * are in by then (they go out at the last orders) */
export const LAST_ORDER: Lines = {
  zh: ['今天打烊囉～慢慢吃，不用急！', '各位，今天就到這裡，謝謝光臨！慢慢吃不用急。', '打烊囉～門口的燈籠已經收了，大家慢慢吃。'],
  ja: ['本日はこれで閉店です～ごゆっくりどうぞ！', '閉店のお時間です、ありがとうございました！お食事はごゆっくり。', '閉店です～提灯ももう下ろしました、ごゆっくり。'],
  en: ["We're closed for today~ take your time, no rush!", "That's closing time, everyone. Thank you for coming! No rush finishing up.", "We're closed~ the lanterns are already in, take your time."],
}
/** the owner, or one coming down the stair, in the morning */
export const OPEN_DORM: Lines = {
  zh: ['早安！先把炭火升起來，準備迎接今天的客人吧。', '昨晚睡得真好，今天也要大幹一場！'],
  ja: ['おはよう！まず炭を熾して、今日のお客さんを迎えよう。', 'よく寝た！今日もひと仕事いくか！'],
  en: ["Morning! Let's get the charcoal going and ready for today's customers.", 'Slept like a log. Big day today!'],
}
/** coming in at the front door in the morning */
export const OPEN_HOME: Lines = {
  zh: ['早安～！今天天氣真好，我來開外場囉！', '老闆早！路上買了咖啡，今天也請多指教！', '大家早安，我先去把桌上的調味瓶補滿。'],
  ja: ['おはようございます～！いい天気ですね、ホール開けます！', '店長おはようございます！コーヒー買ってきました、今日もよろしくお願いします！', 'みなさんおはようございます、卓の調味料を補充してきます。'],
  en: ["Morning~! Lovely day, I'll get the floor open!", 'Morning, boss! Picked up coffee on the way. Here we go again!', "Morning, all. I'll top up the condiments on the counters first."],
}
/** coming in at the front door to a dark shop, on the way to the switch by the door (the owner's) */
export const LIGHTS_ON: Lines = {
  zh: ['店裡好暗，來開燈吧！', '怎麼黑漆漆的，我先開個燈。'],
  ja: ['店が暗いな、電気つけよう！', '真っ暗ですね、先に電気つけます。'],
  en: ["It's dark in here, let's get the lights on!", "Pitch dark! I'll put the lights on first."],
}
