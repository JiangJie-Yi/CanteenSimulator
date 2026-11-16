// What the chefs and the customers say, in three languages.
import type { Lang } from './i18n'

/** one of a few ways of saying it, picked by a number (a customer's id, a count): the same customer says it the same way */
const pick = <T,>(k: number, ways: T[]) => ways[Math.abs(Math.trunc(k)) % ways.length]

/** the part of the day an hour (0..23) is in, for what's said at the till: morning 6 to 13, afternoon 14 to 17, night the rest */
export const partOfDay = (hour: number): 'morning' | 'afternoon' | 'night' => (hour >= 6 && hour < 14 ? 'morning' : hour >= 14 && hour < 18 ? 'afternoon' : 'night')

/** an order's dishes, each said once: one ordered twice or more with how many after it (item 52, from a whole day's log: 「外帶一份：
 * 味噌烤白蘿蔔、味噌烤白蘿蔔」 read as the same said twice), in the order they first come */
export const tallyNames = (items: string[], times = '×') => {
  const n = new Map<string, number>()
  for (const x of items) n.set(x, (n.get(x) ?? 0) + 1)
  return [...n].map(([x, k]) => (k > 1 ? `${x}${times}${k}` : x))
}
/** dishes said aloud (item 180): each once, how many after it; two of a dish said as two, not named twice (老闆，味噌烤茄子兩份！) */
const countOf = (names: string[]) => { const m = new Map<string, number>(); for (const n of names) m.set(n, (m.get(n) ?? 0) + 1); return [...m] }
const spokenZh = (names: string[]) => countOf(names).map(([n, k]) => (k > 1 ? `${n}${'零一兩三四五六七八九'[k] ?? k}份` : n)).join('、')
const spokenJa = (names: string[]) => countOf(names).map(([n, k]) => (k > 1 ? `${n}${k}つ` : n)).join('、')
const spokenEn = (names: string[]) => countOf(names).map(([n, k]) => (k > 1 ? `${k} ${n}` : n)).join(', ')
const ZH = {
  // 炭火與料理動作
  addCharcoal: '炭火有點弱了，補兩塊備長炭！',
  noCharcoal: '木炭全空了！麻袋見底了，快叫貨啊！',
  tooHot: '火太旺了！舀點水灑一下，退個火。',
  outOf: (k: string) => {
    const map: Record<string, string> = {
      salt: '岩鹽',
      soy: '特調醬油',
      milk: '煉乳',
      peanut: '花生粉',
      miso: '赤味噌',
      wasabi: '現磨山葵',
      shichimi: '七味唐辛子',
      yuzu: '柚子胡椒',
      lemon: '新鮮檸檬',
    }
    return `${map[k] ?? k}見底了！這份只能原味直上了！`
  },
  done: (n: string) => `${n}烤好了，起鍋！`,
  /** the owner calling a dish off the fire, over his head (item 180) */
  callDone: (n: string) => `${n}好了！`,
  seasoned: (n: string, k: string | string[]) => {
    const map: Record<string, string> = {
      salt: '撒上岩鹽', soy: '刷上醬油', milk: '淋上煉乳', peanut: '撒上花生粉', miso: '抹上赤味噌', wasabi: '點上山葵', shichimi: '撒上七味粉',
      yuzu: '抹上柚子胡椒', lemon: '擠上檸檬汁',
    }
    // (said as each seasoning goes on: not "done" (完成), which it isn't till it comes off the fire (`done`, after); those going on together
    // said together (item 46))
    return `${n}${[k].flat().map((x) => map[x] ?? '').join('、')}。`
  },
  onFire: (n: string) => `${n}上烤架。`,
  fanned: (n: string) => `${n}火力全開！啪嗒啪嗒搧起炭香！`,
  stickAway: '燙燙燙！竹籤俐落收掉！',
  noSkewer: '鐵串用光了！得先把髒鐵串洗好！',
  skewerWash: '把鐵串刷得亮晶晶！',
  burntAway: '哎呀焦黑了！這份不能砸了招牌，丟掉重烤！',
  orphanAway: '客人等不及先走了…先放進大碗保溫，等下一位點的客人！',
  // (the shop shut for the day: there's no next customer to keep it for)
  orphanMeal: (n: string) => `客人先走了…已經打烊囉，這份${n}就當員工餐吧！`,
  staffMeal: (n: number) => `打烊了，大碗裡剩下的 ${n} 份當大家的員工餐！`,
  // (a customer would have had a bowl of rice or miso soup with it, and there was none in stock (item 229): said, for it to be ordered in)
  noSide: (kind: 'rice' | 'soup'): string => kind === 'rice' ? '客人想加一碗白飯，可是米沒了！到庫存訂米。' : '客人想加一碗味噌湯，可是味噌湯沒了！到庫存訂味噌湯。',
  // (takeout, the owner's: someone at the till for a takeaway, a delivery rider for an order; the last half hour, only these)
  takeoutOrder: (items: string[], rider: boolean) => rider ? `外送單進來了：${tallyNames(items).join('、')}，外送員在收銀台等！` : `外帶一份：${tallyNames(items).join('、')}，客人在收銀台等！`,
  takeoutHand: (rider: boolean): string => rider ? '外送的餐好了，路上小心！' : '久等了！您的外帶，請慢用～',
  lastCall: '最後點餐囉！接下來只收外帶。' as string,
  orphanAgain: (n: string) => `運氣太好了！這份熱騰騰的${n}剛好有客人點，直接送上！`,

  // 客人點餐與反應（移除前置編號 #ID）
  order: (id: number, names: string[]) => { const l = spokenZh(names); return pick(id, [`老闆，${l}！`, `麻煩給我${l}。`, `我要${l}，謝謝！`]) },
  nothing: (_id: number) => `看了一圈沒有特別對胃口的…下次路過再來試試！`,
  dear: (_id: number) => `價錢有點高…今天先不點了。`,
  wcDirty: (_id: number) => `哇…這洗手間地板跟馬桶有點嚇人，該打掃啦！`,
  wcPaper: (_id: number) => `救命啊！廁所裡居然連一張衛生紙都沒有了？！`,
  noTissue: (_id: number) => `咦？桌邊抽屜裡的紙巾全空了，擦不了嘴呀…`,
  noReceipt: (_id: number) => `收據機沒紙了嗎？沒關係啦，心意收到就好！`,
  wcNice: (_id: number) => `這家店連洗手間都香香的、擦得發亮，細節真用心！`,
  wcGo: (_id: number, k: number) => [
    '喝太暢快了，先去洗手間釋放一下～',
    '稍微離席洗個手，馬上回來繼續吃！',
    '肚子有點滾…趕緊借個洗手間！',
  ][Math.abs(k) % 3],

  // 店員與迎賓
  welcome: 'いらっしゃいませ！歡迎光臨！',
  /** a customer's tokkuri of sake set at their place with its cup, by the server who carried it out (item 177) */
  sakeServe: (k: number) => [
    '久等了，您的冷酒，請慢用。',
    '清酒來了，酒杯放這邊，請慢用。',
    '您點的清酒一合，請慢慢喝。',
  ][Math.abs(k) % 3],
  /** a customer's rice and miso soup set at their place by the server who carried them out (item 205) */
  sideServe: (k: number, rice: boolean, soup: boolean) => (rice && soup
    ? ['白飯跟味噌湯來了，請慢用。', '您的白飯、味噌湯，小心燙。', '飯和湯幫您放這邊，請慢用。']
    : rice ? ['白飯來了，請慢用。', '您的白飯，剛盛的，請慢用。'] : ['味噌湯來了，小心燙。', '您的味噌湯，請慢用。'])[Math.abs(k) % (rice && soup ? 3 : 2)],
  serveSay: (k: number) => ['久等了，請慢用。', '小心燙，請慢用。', '烤魚來了，趁熱吃喔。'][Math.abs(k) % 3],
  washSay: (k: number) => ['盤子我來洗。', '洗好烘乾，馬上放回去。', '這疊交給我～'][Math.abs(k) % 3],
  /** a floor server come with a broom to glass broken on the floor (game/spills) */
  sweepSay: (k: number) => ['小心腳下，我來掃。', '破了，先別靠近喔！', '碎片我來清。'][Math.abs(k) % 3],
  riceDone: '[內場] 呼～新潟越光米剛炊熟！粒粒分明、米香撲鼻！',
  soupDone: '[內場] 味噌湯煮好了，豆腐、海帶芽都下鍋，保溫中！',
  fullHouse: '大入！今晚滿座，謝謝大家捧場！',

  // 結帳與離店
  payGo: (_id: number, k: number) => pick(k, [
    '肚子飽到不行！老闆，買單～！',
    '吃得太過癮了！來去櫃檯算一下帳！',
    '最後一口收工！差不多該結帳了。',
    '撐死我了……老闆，麻煩算一下！',
  ]),
  payThanks: (_id: number, k: number) => pick(k, ['謝謝招待，很好吃！', 'ごちそうさまでした！', '吃得好飽，謝謝老闆！', '下次再來！']),
  // (by the game's hour (the owner's: "late at night, mind the road" at half past eight in the morning): morning to 13:59, afternoon to
  // 17:59, night the rest)
  cashierThanks: (bill: string, hour = 20) => `謝謝，一共 ${bill}。${partOfDay(hour) === 'morning' ? '祝您今天順利！' : partOfDay(hour) === 'afternoon' ? '慢走喔！' : '晚了，路上小心！'}`,
  wcBack: (_id: number, k: number) => pick(k, [
    '呼～神清氣爽！滿血復活，繼續開吃！',
    '洗完手了，這撲鼻的炭烤香氣真受不了！',
    '回來啦～我的菜應該還熱著吧？',
    '輕鬆多了！再來一輪也沒問題！',
  ]),
  angry: (id: number) => pick(id, ['等太久了，不吃了。', '菜一直沒來，我先走了。', '算了，下次再說。']),
  dark: (_id: number) => `怎麼瞬間眼前一片黑？！跳電還是打烊啦？`,
  darkGone: (_id: number) => `伸手不見五指黑漆漆的，連魚刺都看不見怎麼吃？走人了！`,
  // (every stool taken: sat on the bench in the genkan to wait a turn; waited too long there, off)
  benchWait: (id: number) => pick(id, [`客滿了啊⋯⋯那我在這邊坐著等一下。`, `生意真好！我坐這裡排一下。`, `沒位子了？那我等等，一定要吃到！`]),
  benchGone: (id: number) => pick(id, [`等不到位子，下次再來吧。`, `還是沒空位……改天早點來好了。`, `肚子等不及了，先去別家！`]),
  verdict: (id: number, _n: string, stars: number) => pick(id, [
    ['有點焦了…', '跟想像的不太一樣。'],
    ['還可以。', '普普通通。'],
    ['不錯，挺香的。', '配啤酒剛好！'],
    ['外酥內嫩，好吃！', '火候剛好，好吃！'],
    ['太好吃了吧！', '這是我吃過最好吃的！'],
  ][Math.max(0, Math.min(4, stars - 1))]),
  sick: (_id: number, n: string) => `唔…這盤${n}味道怪怪的…肚子一陣絞痛！洗手間在哪裡啊啊！`,
  trial: (who: string, names: string[]) => `【試菜研發】${who}端出了全新私房菜：${names.join('、')}！已謄錄在研發秘笈！`,
  trialNone: (who: string) => `${who}嘆氣：食材庫存不夠豐富，得先進一批頂級貨才能試新菜！`,
}

const JA: typeof ZH = {
  // 炭火と調理
  addCharcoal: '火が落ちてきたな、備長炭を足そう！',
  noCharcoal: '炭が完全に切れた！袋も底をついた、早く発注しないと！',
  tooHot: '火が強すぎる！水を少し打って落ち着かせよう。',
  outOf: (k: string) => {
    const map: Record<string, string> = {
      salt: '天然塩',
      soy: '秘伝の醤油',
      milk: '練乳',
      peanut: 'きな粉',
      miso: '赤味噌',
      wasabi: '生わさび',
      shichimi: '七味唐辛子',
      yuzu: '柚子胡椒',
      lemon: '生レモン',
    }
    return `${map[k] ?? k}が切れた！これは素材の味で勝負だ！`
  },
  done: (n: string) => `${n}、焼き上がり！`,
  /** the owner calling a dish off the fire, over his head (item 180) */
  callDone: (n: string) => `${n}、あがり！`,
  seasoned: (n: string, k: string | string[]) => {
    const map: Record<string, string> = {
      salt: '岩塩をひと振り', soy: '醤油を塗る', milk: '練乳をかける', peanut: 'ピーナッツ粉をまぶす', miso: '赤味噌を塗る', wasabi: 'わさびをのせる',
      shichimi: '七味をふる', yuzu: '柚子胡椒を塗る', lemon: 'レモンを搾る',
    }
    return `${n}に${[k].flat().map((x) => map[x] ?? '').join('、')}。`
  },
  onFire: (n: string) => `${n}を焼き台へ。`,
  fanned: (n: string) => `${n}、パタパタ扇いで炭火の火力を引き上げる！`,
  stickAway: 'アチチッ！串を手早く片付けるぞ！',
  noSkewer: '鉄串が切れた！使った串を先に洗わないと！',
  skewerWash: '鉄串をピカピカに磨くぞ！',
  burntAway: 'あちゃー、焦げちまった！店の看板に関わる、焼き直しだ！',
  orphanAway: 'お客さん帰っちゃったか…大鉢で保温して、次の注文に回そう！',
  orphanMeal: (n: string) => `お客さん帰っちゃったか…もう閉店だし、この${n}はまかないにしよう！`,
  staffMeal: (n: number) => `閉店だ、大鉢に残った ${n} 人前はみんなのまかないに！`,
  noSide: (kind: 'rice' | 'soup') => kind === 'rice' ? 'お客さんがご飯を頼みたかったのに、米がない！在庫で米を注文して。' : 'お客さんが味噌汁を頼みたかったのに、切れてる！在庫で味噌汁を注文して。',
  takeoutOrder: (items: string[], rider: boolean) => rider ? `デリバリー注文：${tallyNames(items).join('、')}、配達員さんがレジで待ってます！` : `お持ち帰り：${tallyNames(items).join('、')}、お客さんがレジでお待ちです！`,
  takeoutHand: (rider: boolean) => rider ? 'お待たせしました、配達お気をつけて！' : 'お待たせしました！お持ち帰りです、どうぞ～',
  lastCall: 'ラストオーダーです！この後はお持ち帰りのみです。' as string,
  orphanAgain: (n: string) => `ツイてる！${n}の注文がちょうど入った、出来立てをそのまま出そう！`,

  // 客の注文と反応（ID番号除去）
  order: (id: number, names: string[]) => { const l = spokenJa(names); return pick(id, [`すみません、${l}！`, `${l}お願いします。`, `${l}ください！`]) },
  nothing: (_id) => `うーん、今日はピンとくるものがないな…また寄らせてもらうよ！`,
  dear: (_id) => `うーん、ちょっと高いな…今日はやめとくよ。`,
  wcDirty: (_id) => `おっと…トイレの床がちょっと汚れてるな。掃除した方がいいかも。`,
  wcPaper: (_id) => `大変だ！トイレットペーパーが完全に切れてるぞ？！`,
  noTissue: (_id) => `あれ？引き出しのティッシュが空っぽだ、口が拭けないや…`,
  noReceipt: (_id) => `レシートの紙切れかい？気にしないで、大丈夫だよ！`,
  wcNice: (_id) => `このお店、トイレまでピカピカで清潔感があって素晴らしいね。`,
  wcGo: (_id, k) => [
    '旨い酒を飲みすぎた、ちょっとお手洗いへ～',
    '手を洗いに少し失礼しますね、すぐ戻ります！',
    '急にお腹が…！トイレ借りまーす！',
  ][Math.abs(k) % 3],

  // スタッフと接客
  welcome: 'いらっしゃいませ！',
  sakeServe: (k) => [
    'お待たせしました、冷酒です。ごゆっくりどうぞ。',
    '日本酒一合お持ちしました。お猪口はこちらに。',
    'お待たせいたしました、お酒です。どうぞごゆっくり。',
  ][Math.abs(k) % 3],
  sideServe: (k: number, rice: boolean, soup: boolean) => (rice && soup
    ? ['ご飯とお味噌汁です、ごゆっくりどうぞ。', 'お待たせしました、ご飯とお味噌汁です。', 'ご飯とお汁、こちらに置きますね。']
    : rice ? ['ご飯お持ちしました。', 'お待たせしました、ご飯です。'] : ['お味噌汁です、熱いのでお気をつけて。', 'お待たせしました、お味噌汁です。'])[Math.abs(k) % (rice && soup ? 3 : 2)],
  serveSay: (k: number) => ['お待たせしました、ごゆっくりどうぞ。', '熱いのでお気をつけて。', '焼き魚です、熱いうちにどうぞ。'][Math.abs(k) % 3],
  washSay: (k: number) => ['お皿、洗います。', '洗って乾かして戻します。', 'この山、片付けます～'][Math.abs(k) % 3],
  sweepSay: (k: number) => ['足元お気をつけて、片付けます。', '割れちゃった、近づかないでくださいね！', '破片、片付けます。'][Math.abs(k) % 3],
  riceDone: '[厨房] 新潟産コシヒカリがふっくら艶やかに炊き上がりました！',
  soupDone: '[厨房] 味噌汁ができました！豆腐とわかめ入り、保温中です！',
  fullHouse: '大入り！満席です、ありがとうございます！',

  // 会計と退店
  payGo: (_id, k) => pick(k, [
    'お腹いっぱい大満足！大将、お勘定頼むよ！',
    'いやあ食った食った！レジで会計しようか！',
    '最後の一口ごちそうさま！そろそろお会計で。',
    'もう食べられない……大将、お勘定！',
  ]),
  payThanks: (_id: number, k: number) => pick(k, ['ごちそうさまでした！', 'おいしかったです！', 'お腹いっぱい、ありがとう！', 'また来ます！']),
  cashierThanks: (bill: string, hour = 20) => `ありがとうございます、${bill}になります。${partOfDay(hour) === 'morning' ? '良い一日を！' : partOfDay(hour) === 'afternoon' ? 'お気をつけて！' : '夜道、お気をつけて！'}`,
  wcBack: (_id, k) => pick(k, [
    'ふぅ～すっきりした！さあ、焼き魚の続きを平らげるぞ！',
    'さっぱりした！香ばしい匂いに胃袋がまた刺激されるな！',
    'ただいま～料理まだ温かいかな？',
    'すっきり！これでまだまだ食べられるぞ！',
  ]),
  angry: (id: number) => pick(id, ['待ちすぎ、もういいです。', '来ないから帰ります。', 'また今度にします。']),
  dark: (_id) => `うわっ、急に真っ暗？！停電か？それとも閉店かい？`,
  darkGone: (_id) => `一寸先も闇じゃ魚の骨も見えやしない！お暇させてもらうよ！`,
  benchWait: (id) => pick(id, [`満席かぁ⋯⋯じゃあここで座って待つよ。`, `繁盛してるね！ここで順番待ちするよ。`, `席がない？じゃあ待つよ、絶対食べたいし！`]),
  benchGone: (id) => pick(id, [`席が空かないな、また今度にするよ。`, `やっぱり空かないか……次は早めに来よう。`, `腹が限界だ、他を当たるよ！`]),
  verdict: (id: number, _n: string, stars: number) => pick(id, [
    ['ちょっと焦げてる…', '思ってたのと違うな。'],
    ['まあまあかな。', '普通だね。'],
    ['なかなか香ばしい。', 'ビールに合う！'],
    ['外はカリッと中はふっくら、おいしい！', '火加減ばっちり、おいしい！'],
    ['うますぎる！', '今まで食べた中で一番！'],
  ][Math.max(0, Math.min(4, stars - 1))]),
  sick: (_id, n) => `うっ…この${n}、なんか傷んでないか…お腹が激痛だ、トイレどこだーっ！`,
  trial: (who, names) => `【新作開発】${who}が自慢の逸品を考案：${names.join('、')}！レシピ帖に記録完了！`,
  trialNone: (who) => `${who}：素材が足りないな。上質な仕入れがないと腕が振るえないぜ！`,
}

const EN: typeof ZH = {
  // Grilling & Kitchen Action
  addCharcoal: 'The flame is dying down. Adding two fresh Binchotan coals!',
  noCharcoal: 'We’re completely out of charcoal! The sack is empty—place an order quick!',
  tooHot: 'Too hot! A splash of water to calm the coals down.',
  outOf: (k: string) => {
    const map: Record<string, string> = {
      salt: 'rock salt',
      soy: 'special soy sauce',
      milk: 'condensed milk',
      peanut: 'peanut powder',
      miso: 'red miso',
      wasabi: 'fresh wasabi',
      shichimi: 'shichimi chili',
      yuzu: 'yuzu kosho',
      lemon: 'fresh lemon',
    }
    return `Out of ${map[k] ?? k}! We will have to serve this one unseasoned!`
  },
  done: (n: string) => `${n}, done!`,
  /** the owner calling a dish off the fire, over his head (item 180) */
  callDone: (n: string) => `${n}, up!`,
  seasoned: (n: string, k: string | string[]) => {
    const map: Record<string, string> = {
      salt: 'rock salt', soy: 'soy glaze', milk: 'condensed milk', peanut: 'peanut powder', miso: 'red miso', wasabi: 'wasabi', shichimi: 'shichimi',
      yuzu: 'yuzu kosho', lemon: 'lemon',
    }
    // (two or more said in one, the last after an 'and' (item 46))
    const xs = [k].flat().map((x) => map[x] ?? '')
    return `${n}, with ${xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]}.`
  },
  onFire: (n: string) => `${n} on the grill.`,
  fanned: (n: string) => `Fanning the embers for ${n}! Fanning up the aroma!`,
  stickAway: 'Hot skewers cleared with chef speed!',
  noSkewer: 'Out of skewers! The used ones need washing first!',
  skewerWash: 'Scrubbing the skewers till they shine!',
  burntAway: 'Blast, it charred! Can’t serve this to valued guests—toss it and restart!',
  orphanAway: 'The patron left... Into the big bowl to keep warm for the next order!',
  orphanMeal: (n: string) => `They've gone, and we're closed: this ${n} is the staff's supper!`,
  staffMeal: (n: number) => `Closing time: the ${n} left in the big bowl make the staff's supper!`,
  noSide: (kind: 'rice' | 'soup') => kind === 'rice' ? "A customer wanted a bowl of rice, but we're out of rice! Order some in from the stock." : "A customer wanted miso soup, but we're out! Order some in from the stock.",
  takeoutOrder: (items: string[], rider: boolean) => rider ? `Delivery order: ${tallyNames(items, ' ×').join(', ')}. The rider's waiting at the till!` : `Takeaway: ${tallyNames(items, ' ×').join(', ')}. They're waiting at the till!`,
  takeoutHand: (rider: boolean) => rider ? 'Here you go. Ride safe!' : 'Thanks for waiting! Your takeaway, enjoy~',
  lastCall: 'Last orders! Takeaway only from now.' as string,
  orphanAgain: (n: string) => `What luck! An order just rolled in for ${n}—send it out piping hot!`,

  // Customer Ordering & Feedback (Stripped #ID prefix)
  order: (id: number, names: string[]) => { const l = spokenEn(names); return pick(id, [`Excuse me, ${l}!`, `${l}, please.`, `Could I get ${l}?`]) },
  nothing: (_id) => `Nothing catching my eye right now... Catch you next time!`,
  dear: (_id) => `A bit pricey for me... maybe another time.`,
  wcDirty: (_id) => `Yikes... the restroom floor is rather grimy. Needs a scrub!`,
  wcPaper: (_id) => `Emergency! There is not a single scrap of toilet paper in here?!`,
  noTissue: (_id) => `Wait, the napkin drawer on the table is bone dry... Can’t wipe up!`,
  noReceipt: (_id) => `Receipt printer out of paper? Don’t worry about it, all good!`,
  wcNice: (_id) => `Even the restroom here is sparkling clean and fresh. Love the attention to detail!`,
  wcGo: (_id, k) => [
    'Drank a little too much sake, popping to the loo~',
    'Pardon me, just stepping away to wash up!',
    'Oof, rumbling belly... heading to the restroom!',
  ][Math.abs(k) % 3],

  // Staff & Greeting
  welcome: 'Irasshaimase! Welcome!',
  sakeServe: (k) => [
    'Here is your sake, chilled. Please enjoy.',
    'Your sake, and the cup right here. Enjoy.',
    'One go of sake for you. Take your time.',
  ][Math.abs(k) % 3],
  sideServe: (k: number, rice: boolean, soup: boolean) => (rice && soup
    ? ['Your rice and miso soup. Enjoy.', 'Rice and miso soup, right here.', 'Rice and soup for you. Careful, it is hot.']
    : rice ? ['Your rice, fresh from the pot.', 'Here is your rice. Enjoy.'] : ['Your miso soup. Careful, it is hot.', 'Miso soup for you. Enjoy.'])[Math.abs(k) % (rice && soup ? 3 : 2)],
  serveSay: (k: number) => ['Thanks for waiting, enjoy!', 'Careful, it is hot. Enjoy!', 'Grilled fish, best while hot!'][Math.abs(k) % 3],
  washSay: (k: number) => ['Dishes, on it.', 'Washed, dried, back on the rack.', 'Leave this pile to me.'][Math.abs(k) % 3],
  sweepSay: (k: number) => ['Mind your step, sweeping up.', 'Broken! Keep clear, please.', 'Got the shards.'][Math.abs(k) % 3],
  riceDone: '[Kitchen] Freshly steamed Koshihikari rice is ready! Fluffy and fragrant!',
  soupDone: '[Kitchen] The miso soup is hot, tofu and wakame in, kept warm!',
  fullHouse: 'Full house! Every seat taken, thank you all!',

  // Checkout & Departure
  payGo: (_id, k) => pick(k, [
    'Bursting at the seams! Check please, Chef!',
    'What a feast! Let’s head to the register and settle up!',
    'Last bite done! Time to pay up.',
    'I can’t eat another thing… check, please!',
  ]),
  payThanks: (_id: number, k: number) => pick(k, ['Thanks, that was great!', 'Gochisousama!', 'So full, thank you!', 'We will be back!']),
  cashierThanks: (bill: string, hour = 20) => `Thank you, that is ${bill}. ${partOfDay(hour) === 'morning' ? 'Have a good day!' : partOfDay(hour) === 'afternoon' ? 'Take care!' : 'Safe home tonight!'}`,
  wcBack: (_id, k) => pick(k, [
    'Whew, refreshed and recharged! Back to the grilled fish feast!',
    'All washed up! That charcoal smoke aroma has my appetite roaring again!',
    'I’m back~ hope my food’s still warm!',
    'Much better! Ready for another round!',
  ]),
  angry: (id: number) => pick(id, ['Too long a wait. I am off.', 'Still nothing... I am leaving.', 'Never mind, another time.']),
  dark: (_id) => `Whoa, lights out?! Did a breaker flip or are we closing?!`,
  darkGone: (_id) => `Pitch black in here—can’t even see the fish bones! I’m out!`,
  benchWait: (id) => pick(id, [`Full up, huh… I’ll sit here and wait my turn.`, `Busy place! I’ll wait here in line.`, `No seats? I’ll wait, I really want to eat here!`]),
  benchGone: (id) => pick(id, [`No seat coming free. Another time, then.`, `Still nothing… I’ll come earlier next time.`, `I’m too hungry to wait, trying elsewhere!`]),
  verdict: (id: number, _n: string, stars: number) => pick(id, [
    ['A bit burnt...', 'Not what I hoped.'],
    ['It is okay.', 'Pretty average.'],
    ['Nice and smoky.', 'Great with a beer!'],
    ['Crisp outside, tender inside!', 'Grilled just right!'],
    ['Incredible!', 'The best I have ever had!'],
  ][Math.max(0, Math.min(4, stars - 1))]),
  sick: (_id, n) => `Ugh... that ${n} tasted funky... My stomach is cramping! Restroom, stat!`,
  trial: (who, names) => `[Culinary R&D] ${who} concocted an inventive new recipe: ${names.join(', ')}! Saved to notebook!`,
  trialNone: (who) => `${who}: Not enough ingredients in stock. Order fresh supplies before testing new dishes!`,
}

export const LINES: Record<Lang, typeof ZH> = { zh: ZH, ja: JA, en: EN }
