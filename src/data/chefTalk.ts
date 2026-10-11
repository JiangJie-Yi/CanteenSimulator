// What the second chef says back when talked to (game/chefChat.ts works out what was asked). A few ways of
// saying each thing, picked at random, so it reads like someone talking rather than a form.
import type { Lang } from '@/data/i18n'

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]

/** a word on how a dish came out, by its taste (0-100) */
const verdict: Record<Lang, (taste: number) => string> = {
  zh: (t) => pick(t >= 85 ? ['這個好吃，我自己都想多吃一口。', '這道可以當招牌了。', '漂亮，客人一定喜歡。']
    : t >= 70 ? ['味道不錯，可以上菜單。', '還行，賣得出去。', '這道穩的。']
    : t >= 55 ? ['普普通通，能賣，但不會讓人記住。', '還可以，就是少了點什麼。']
    : ['老實說……這個不太搭。', '這味道我不太推，客人可能會皺眉。', '做是做了，但我不會推薦。']),
  ja: (t) => pick(t >= 85 ? ['これは旨い。看板にできますよ。', '上出来です。'] : t >= 70 ? ['悪くない、メニューに出せます。', 'いけますね。']
    : t >= 55 ? ['まあまあですね。'] : ['正直……合わないですね。', 'お勧めはしません。']),
}

export const CHEF_TALK = {
  zh: {
    hello: () => pick([`老闆好！今天想試什麼？`, `在呢，要做什麼跟我說。`, `老闆，有什麼吩咐？`]),
    thanks: () => pick(['應該的。', '不會不會，有事再叫我。', '老闆客氣了。']),
    unknown: () => pick(['老闆，我沒聽懂……你可以說「幫我做鹽烤玉米」或「鮭魚配什麼好？」',
      '嗯？你是想要我做什麼菜嗎？跟我說食材跟調味就行。']),
    makeWhat: () => pick(['要做哪一道？跟我說食材，要加什麼調味也可以講。', '好啊，做什麼？']),
    no: () => pick(['好，那先這樣。', '沒問題，需要再叫我。']),
    noStock: (dish: string) => pick([`${dish}的材料沒了，先進貨吧。`, `冰箱裡沒有做${dish}的料了，老闆要先叫貨。`]),
    unknownFood: () => '這個我們店裡沒有耶，換一樣吧。',
    made: (dish: string, taste: number, chose: boolean) =>
      `${chose ? pick([`我照我的方式做成${dish}了。`, `那我做成${dish}。`]) : pick([`${dish}好了，`, `來，${dish}。`, `${dish}做好了，`])}${verdict.zh(taste)}已經記進研發筆記。`,
    warn: (dish: string) => pick([`${dish}？……這個搭配有點冒險，`, `老闆確定？${dish}我是沒做過，`]),
    batch: (dishes: string[]) => `我試了${dishes.join('、')}，都記進筆記了，你看看哪些能上菜單。`,
    batchNone: () => '能試的都試過了，或是材料不夠了。',
    advise: (food: string, best: string, dish: string) => pick([`${food}的話，我會${best}，做成${dish}，要我做做看嗎？`,
      `${food}啊……${best}最對味，就是${dish}。要試嗎？`]),
    advisePlain: (food: string) => `${food}原味最好吃，什麼都別加。要我烤一份嗎？`,
    adviseAny: (dish: string) => pick([`我覺得可以試試${dish}，客人應該會喜歡。要做嗎？`, `還沒試過${dish}吧？我來做一份？`]),
    adviseNone: () => '該試的都試過了，老闆可以組些套餐。',
    stock: (low: string[]) => (low.length ? `${low.join('、')}快沒了，其他還夠。` : '材料都還夠，放心。'),
    stockEmpty: () => '冰箱是空的，什麼都沒有，要先進貨。',
    placeholder: '跟二廚說…（例：幫我做鹽烤玉米、鮭魚配什麼好？）',
    send: '說',
    chips: ['有什麼推薦？', '隨便試 3 道', '庫存還夠嗎？'],
  },
  ja: {
    hello: () => pick(['お疲れさまです。何を作りましょう？', 'はい、何でしょう？']),
    thanks: () => pick(['いえいえ。', 'また呼んでください。']),
    unknown: () => '……すみません、よく分かりません。「塩焼きとうもろこし」や「サーモンには何が合う？」のように言ってください。',
    makeWhat: () => '何を作りましょう？食材と味付けを教えてください。',
    no: () => '分かりました。',
    noStock: (dish: string) => `${dish}の材料が切れています。仕入れをお願いします。`,
    unknownFood: () => 'それはうちにはないですね。',
    made: (dish: string, taste: number, chose: boolean) => `${chose ? `私のやり方で${dish}にしました。` : `${dish}、できました。`}${verdict.ja(taste)}ノートに記録しました。`,
    warn: (dish: string) => `${dish}ですか……ちょっと冒険ですね。`,
    batch: (dishes: string[]) => `${dishes.join('、')}を試作してノートに付けました。`,
    batchNone: () => '試せるものはもうないか、材料が足りません。',
    advise: (food: string, best: string, dish: string) => `${food}なら${best}で、${dish}がいいですね。作りましょうか？`,
    advisePlain: (food: string) => `${food}は何もつけずに焼くのが一番。焼きましょうか？`,
    adviseAny: (dish: string) => `${dish}を試してみませんか？作りましょうか？`,
    adviseNone: () => 'もう全部試しました。セットを組んでみては。',
    stock: (low: string[]) => (low.length ? `${low.join('、')}が残り少ないです。` : '材料は足りています。'),
    stockEmpty: () => '冷蔵庫は空です。仕入れが先ですね。',
    placeholder: '二番手に話しかける…（例：塩焼きとうもろこしを作って）',
    send: '送る',
    chips: ['おすすめは？', '3品おまかせ', '在庫は？'],
  },
} satisfies Record<Lang, unknown>
