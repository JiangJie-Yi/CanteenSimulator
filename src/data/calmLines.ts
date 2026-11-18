// What's said as the owner sees to a customer kept waiting, urges one of the staff on, and what customers say of the room's things as they
// sit (item 348, the owner's 「要有設計思維，一些交互跟互動要有」). Each in Chinese, Japanese and English.
import type { Lang } from './i18n'

type Pool = Record<Lang, readonly string[]>

/** the owner to the one kept waiting: a word, an apology, a small dish on the house (game/calm's kinds) */
export const CALM_OWNER: Record<'greet' | 'sorry' | 'side', Pool> = {
  greet: {
    zh: ['您的魚馬上就好，請再稍等一下！', '快好了，再一下下喔！'],
    ja: ['お魚、もうすぐ焼き上がります！', 'もう少々お待ちください！'],
    en: ['Your fish is nearly done, just a moment!', 'Almost there, hang on!'],
  },
  sorry: {
    zh: ['真的很抱歉讓您久等了！', '不好意思，今天比較忙，馬上幫您催！'],
    ja: ['大変お待たせして申し訳ありません！', 'すみません、すぐ急がせます！'],
    en: ["I'm so sorry for the wait!", "Sorry, it's a busy night, I'll hurry it along!"],
  },
  side: {
    zh: ['這盤毛豆招待您，先墊墊肚子！', '先吃點小菜，這是店裡請的！'],
    ja: ['枝豆、サービスです。先にどうぞ！', 'お通し、店からのサービスです！'],
    en: ['Some edamame on the house while you wait!', "A little something on us, while you wait!"],
  },
}
/** the customer's answer, a little mollified (or delighted at the dish) */
export const CALM_GUEST: Record<'greet' | 'sorry' | 'side', Pool> = {
  greet: { zh: ['好，我再等一下。', '嗯，那我等等。'], ja: ['はい、もう少し待ちます。', 'うん、待ってる。'], en: ["Okay, I'll wait a bit.", 'Alright then.'] },
  sorry: { zh: ['沒關係啦，忙嘛。', '好吧，不急。'], ja: ['いえいえ、忙しそうですね。', 'まあ、いいですよ。'], en: ["It's fine, you're busy.", 'No rush, then.'] },
  side: { zh: ['哇，謝謝老闆！', '太好了，正好餓了。'], ja: ['わあ、ありがとうございます！', 'ちょうどお腹すいてた！'], en: ['Oh, thank you!', 'Perfect, I was starving.'] },
}
/** the owner urging one of the staff on, and their answer */
export const URGE_OWNER: Pool = {
  zh: ['手腳快一點喔！', '客人在等了，加油！', '再快一點，拜託！'],
  ja: ['もうちょい手早く！', 'お客さん待ってるぞ、頼む！', 'ペース上げていこう！'],
  en: ['A bit quicker, please!', "Customers are waiting, let's go!", 'Pick up the pace!'],
}
export const URGE_STAFF: Pool = {
  zh: ['是！馬上！', '好的，我加快！', '了解！'],
  ja: ['はい！すぐに！', '了解です、急ぎます！', 'はいっ！'],
  en: ['Yes! Right away!', "On it, I'll speed up!", 'Got it!'],
}
/** a customer, sat, of the room's things (by the name of the `look-*` it's at) */
export const PROP_TALK: Record<'altar' | 'window' | 'fridge' | 'cat', Pool> = {
  altar: {
    zh: ['這間店還有供神明呢，好有味道。', '神棚上還有供酒耶。'],
    ja: ['神棚があるお店っていいね。', 'お神酒が供えてある。'],
    en: ['A little shrine up there, how nice.', "There's sake offered at the shrine."],
  },
  window: {
    zh: ['那扇圓窗好漂亮。', '從圓窗看出去好有氣氛。'],
    ja: ['あの丸窓、素敵だね。', '丸窓の外、いい雰囲気。'],
    en: ['That round window is lovely.', 'The view through that round window, so nice.'],
  },
  fridge: {
    zh: ['冰箱裡飲料好多種。', '等一下來拿一瓶喝的。'],
    ja: ['飲み物、いろいろあるね。', 'あとで一本もらおう。'],
    en: ["So many drinks in that fridge.", "I'll grab a drink in a bit."],
  },
  cat: {
    zh: ['收銀台的招財貓好可愛。', '那隻招財貓一直在招手耶。'],
    ja: ['レジの招き猫、かわいい。', '招き猫が手招きしてる。'],
    en: ['The beckoning cat by the till is cute.', "That lucky cat keeps waving."],
  },
}
