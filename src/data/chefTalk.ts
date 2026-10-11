// What the second chef says back when talked to (game/chefChat.ts works out what was asked). He's a person, not a
// form: a few ways of saying each thing, picked at random, now and then a bit of what he's doing as he says it
// (（擦了擦手）), and some small talk — the weather, whether he's tired, who he is, how business is, a joke when
// asked — and when he doesn't follow, he says so and suggests something to make instead.
import type { Lang } from '@/data/i18n'

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
/** sometimes (chance p) a bit more */
const maybe = (p: number, s: string) => (Math.random() < p ? s : '')

/** what he's doing as he speaks, now and then */
const ASIDE: Record<Lang, string[]> = {
  zh: ['（擦了擦手）', '（把毛巾甩上肩）', '（翻了一下炭）', '（抬頭看了你一眼）', '（一邊切菜一邊說）', '（笑了笑）', '（壓低聲音）'],
  ja: ['（手を拭きながら）', '（炭を返しつつ）', '（ちらっと顔を上げて）', '（笑って）'],
}
const aside = (lang: Lang, p = 0.3) => maybe(p, pick(ASIDE[lang]))

/** a word on how a dish came out, by its taste (0-100) */
const verdict: Record<Lang, (taste: number) => string> = {
  zh: (t) => pick(t >= 85 ? ['這個好吃，我自己都想多吃一口。', '這道可以當招牌了。', '漂亮，客人一定喜歡。', '欸這個真的不錯，你嚐嚐看。', '這味道，我敢掛保證。']
    : t >= 70 ? ['味道不錯，可以上菜單。', '還行，賣得出去。', '這道穩的。', '中規中矩，不會出錯。', '嗯，有點意思。']
    : t >= 55 ? ['普普通通，能賣，但不會讓人記住。', '還可以，就是少了點什麼。', '說好吃嘛……也還好。']
    : ['老實說……這個不太搭。', '這味道我不太推，客人可能會皺眉。', '做是做了，但我不會推薦。', '呃，我自己吃了一口就放下了。']),
  ja: (t) => pick(t >= 85 ? ['これは旨い。看板にできますよ。', '上出来です。', 'いやあ、これはいい。'] : t >= 70 ? ['悪くない、メニューに出せます。', 'いけますね。']
    : t >= 55 ? ['まあまあですね。', '可もなく不可もなく、かな。'] : ['正直……合わないですね。', 'お勧めはしません。']),
}

export const CHEF_TALK = {
  zh: {
    hello: () => pick(['老闆好！今天想試什麼？', '在呢，要做什麼跟我說。', '老闆，有什麼吩咐？', '來了來了，今天想吃點什麼？', '老闆，炭我先顧著，要做什麼喊一聲。']),
    thanks: () => pick(['應該的。', '不會不會，有事再叫我。', '老闆客氣了。', '哈，這是我的工作嘛。', '有你這句話就夠了。']) + aside('zh'),
    unknown: (suggest: string) => pick([
      `老闆，這句我沒聽懂耶……要不要我先烤個${suggest}？`,
      '嗯？你是說……？（歪頭）不然跟我說想吃魚、肉還是蔬菜，我來配。',
      `我腦袋轉不過來了，哈哈。說個食材，像「${suggest}」，或說「你決定」也行。`,
      `這個我不太懂，我只會烤東西啦。要不要來份${suggest}？`,
    ]),
    confused: () => pick(['（看了看你）怎麼了？想到什麼就說，我都聽著。', '哈，老闆你這表情……是想吃什麼又說不出來吧？', '別急，慢慢說。想吃魚、肉，還是要我決定？']),
    makeWhat: () => pick(['要做哪一道？跟我說食材，要加什麼調味也可以講。', '好啊，做什麼？', '你說，我來烤。魚、肉、蔬菜都有。', '想吃什麼？說不出名字的話，說「魚」或「肉」也行。']),
    no: () => pick(['好，那先這樣。', '沒問題，需要再叫我。', '了解，我去顧火。', '行，那我先備料。']),
    noStock: (dish: string) => pick([`${dish}的材料沒了，先進貨吧。`, `冰箱裡沒有做${dish}的料了，老闆要先叫貨。`, `欸，${dish}的料剛好用完了，要先補貨。`]),
    unknownFood: () => pick(['這個我們店裡沒有耶，換一樣吧。', '這個沒進貨喔，要不要看看別的？']),
    made: (dish: string, taste: number, chose: boolean) =>
      `${aside('zh', 0.25)}${chose ? pick([`我照我的方式做成${dish}了。`, `那我做成${dish}。`, `交給我就對了，${dish}，`]) : pick([`${dish}好了，`, `來，${dish}。`, `${dish}做好了，`, `${dish}出爐，小心燙。`])}${verdict.zh(taste)}已經記進料理研製。`,
    warn: (dish: string) => pick([`${dish}？……這個搭配有點冒險，`, `老闆確定？${dish}我是沒做過，`, `${dish}啊……好吧，你是老闆，`]),
    batch: (dishes: string[]) => pick([`我試了${dishes.join('、')}，都記進筆記了，你看看哪些能上菜單。`,
      `好，一口氣做了${dishes.join('、')}，你挑挑看。`, `${dishes.join('、')}都做好了，筆記上有評語。`]),
    batchNone: () => pick(['能試的都試過了，或是材料不夠了。', '欸，沒東西可試了，要嘛都試過了，要嘛缺料。']),
    advise: (food: string, best: string, dish: string) => pick([`${food}的話，我會${best}，做成${dish}，要我做做看嗎？`,
      `${food}啊……${best}最對味，就是${dish}。要試嗎？`, `${food}我推${best}，${dish}，簡單又好吃。來一份？`]),
    advisePlain: (food: string) => pick([`${food}原味最好吃，什麼都別加。要我烤一份嗎？`, `${food}吃的是原味，加東西反而可惜。烤一份？`]),
    adviseAny: (dish: string) => pick([`我覺得可以試試${dish}，客人應該會喜歡。要做嗎？`, `還沒試過${dish}吧？我來做一份？`, `今天的料不錯，${dish}怎麼樣？`]),
    adviseNone: () => '該試的都試過了，老闆可以組些套餐。',
    /** asked for a kind of food (魚, 肉, 蔬菜…): what he'd make of it */
    byKind: (kind: string, dish: string) => pick([`想吃${kind}啊，那我推${dish}。要做嗎？`, `${kind}的話……今天做${dish}最好，來一份？`, `${kind}喔？${dish}怎麼樣？`]),
    byKindNone: (kind: string) => pick([`${kind}的料現在沒有耶，先進點貨吧。`, `我們這沒有${kind}可以做，換一樣？`]),
    stock: (low: string[]) => (low.length ? pick([`${low.join('、')}快沒了，其他還夠。`, `我看一下……${low.join('、')}剩不多，要補一下。`]) : pick(['材料都還夠，放心。', '冰箱滿滿的，安心啦。'])),
    stockEmpty: () => pick(['冰箱是空的，什麼都沒有，要先進貨。', '老闆，冰箱空空的，連根蔥都沒有。']),
    /** small talk */
    chat: {
      weather: () => pick(['這種天氣最適合來點熱的。', '外面再怎麼樣，爐子前面永遠是夏天，哈。', '天氣好客人就多，我得多備點料。']),
      tired: (fatigue: number) => fatigue > 60 ? pick(['老實說有點累了……不過撐得住。', '腰有點痠，等等收店我要好好躺一下。'])
        : pick(['不累不累，精神好得很！', '還行，炭火前面待習慣了。', '才剛開始呢，放心交給我。']),
      praise: () => pick(['嘿嘿，被老闆誇獎，今天幹勁滿滿。', '別誇了，我會驕傲的。', '（不好意思地抓抓頭）謝謝老闆。']),
      complain: () => pick(['真的嗎？那我再調整一下火候。', '抱歉……下一份我特別注意。', '哪裡不對你跟我說，鹹了還是焦了？']),
      who: (name: string, about: string) => pick([`我是${name}啊，老闆你忘了？${about}`, `${name}，你的二廚。${about}`, `叫我${name}就好。${about}`]),
      joke: () => pick(['為什麼秋刀魚考試都考很好？因為牠很「秋」……好啦，我烤魚比較在行。', '我跟炭火最熟了，它每天都對我很「熱情」。', '客人說我烤的魚有靈魂，我說那是鹽。']),
      business: (open: boolean, guests: number) => open ? (guests ? pick([`現在有 ${guests} 位客人，手腳要快了。`, '生意不錯喔，老闆笑一個。']) : pick(['還沒什麼客人，正好先備料。', '慢慢來，客人會來的。']))
        : pick(['還沒開店呢，先把菜色定好吧。', '先試幾道拿手的，開店時就不怕了。']),
      bye: () => pick(['好，有事再叫我。', '我把爐子顧好，你去忙。', '慢走，我在這。']),
    },
    placeholder: '跟二廚說…（例：幫我做鹽烤玉米、想吃魚、你決定）',
    send: '說',
    chips: ['有什麼推薦？', '隨便試 3 道', '庫存還夠嗎？'],
  },
  ja: {
    hello: () => pick(['お疲れさまです。何を作りましょう？', 'はい、何でしょう？', '炭は見てますよ。何にします？']),
    thanks: () => pick(['いえいえ。', 'また呼んでください。', '仕事ですから。']),
    unknown: (suggest: string) => pick([`……すみません、よく分かりません。${suggest}でも焼きましょうか？`, '魚、肉、野菜、どれがいいです？おまかせでもいいですよ。']),
    confused: () => pick(['どうしました？ゆっくりでいいですよ。', '何か食べたいけど名前が出てこない、って顔ですね。']),
    makeWhat: () => pick(['何を作りましょう？食材と味付けを教えてください。', '魚、肉、野菜、なんでもどうぞ。']),
    no: () => pick(['分かりました。', 'じゃあ仕込みに戻ります。']),
    noStock: (dish: string) => `${dish}の材料が切れています。仕入れをお願いします。`,
    unknownFood: () => 'それはうちにはないですね。',
    made: (dish: string, taste: number, chose: boolean) => `${aside('ja', 0.2)}${chose ? `私のやり方で${dish}にしました。` : `${dish}、できました。`}${verdict.ja(taste)}ノートに記録しました。`,
    warn: (dish: string) => `${dish}ですか……ちょっと冒険ですね。`,
    batch: (dishes: string[]) => `${dishes.join('、')}を試作してノートに付けました。`,
    batchNone: () => '試せるものはもうないか、材料が足りません。',
    advise: (food: string, best: string, dish: string) => `${food}なら${best}で、${dish}がいいですね。作りましょうか？`,
    advisePlain: (food: string) => `${food}は何もつけずに焼くのが一番。焼きましょうか？`,
    adviseAny: (dish: string) => `${dish}を試してみませんか？作りましょうか？`,
    adviseNone: () => 'もう全部試しました。セットを組んでみては。',
    byKind: (kind: string, dish: string) => `${kind}なら${dish}がおすすめです。作りましょうか？`,
    byKindNone: (kind: string) => `${kind}は今切らしてます。`,
    stock: (low: string[]) => (low.length ? `${low.join('、')}が残り少ないです。` : '材料は足りています。'),
    stockEmpty: () => '冷蔵庫は空です。仕入れが先ですね。',
    chat: {
      weather: () => pick(['こういう日は温かいものに限りますね。', '炉の前はいつでも夏ですよ。']),
      tired: (fatigue: number) => (fatigue > 60 ? '正直ちょっと疲れました……でも大丈夫です。' : 'まだまだ元気ですよ。'),
      praise: () => pick(['照れますね。', 'ありがとうございます、励みになります。']),
      complain: () => pick(['すみません、火加減を見直します。', 'どこがダメでした？しょっぱい？焦げ？']),
      who: (name: string, about: string) => `${name}です。${about}`,
      joke: () => '炭とは毎日熱い関係でして……すみません、焼くほうが得意です。',
      business: (open: boolean, guests: number) => (open ? (guests ? `今お客さんが${guests}人です。` : 'まだ静かですね。') : 'まだ開店前です。'),
      bye: () => 'はい、また呼んでください。',
    },
    placeholder: '二番手に話しかける…（例：塩焼きとうもろこしを作って、魚が食べたい、おまかせ）',
    send: '送る',
    chips: ['おすすめは？', '3品おまかせ', '在庫は？'],
  },
} satisfies Record<Lang, unknown>
