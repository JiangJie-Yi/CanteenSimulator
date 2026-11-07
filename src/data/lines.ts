// What the chefs and the customers say, in three languages.
import type { Lang } from './i18n'

/** the part of the day an hour (0..23) is in, for what's said at the till: morning 6 to 13, afternoon 14 to 17, night the rest */
export const partOfDay = (hour: number): 'morning' | 'afternoon' | 'night' => (hour >= 6 && hour < 14 ? 'morning' : hour >= 14 && hour < 18 ? 'afternoon' : 'night')

const ZH = {
  // 炭火與料理動作
  addCharcoal: '炭火有點弱了，補兩塊備長炭！',
  noCharcoal: '木炭全空了！麻袋見底了，快叫貨啊！',
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
  done: (n: string) => `${n}烤得外酥內嫩，滋滋作響！起鍋！`,
  seasoned: (n: string, k: string) => {
    const map: Record<string, string> = {
      salt: '均勻撒上一層薄薄的岩鹽提味',
      soy: '刷上濃郁發亮的甘醇醬油',
      milk: '豪邁淋上香濃煉乳',
      peanut: '厚厚鋪滿現磨香濃花生粉',
      miso: '均勻抹上一層醇厚赤味噌',
      wasabi: '點綴現磨辛香山葵',
      shichimi: '灑落香辣開胃的七味粉',
      yuzu: '抹上一抹清香提鮮的柚子胡椒',
      lemon: '擠上兩滴新鮮爽口的檸檬汁',
    }
    return `${n}完成！${map[k] ?? ''}！`
  },
  onFire: (n: string) => `${n}下爐！油脂滴下去的香氣太誘人了！`,
  fanned: (n: string) => `${n}火力全開！啪嗒啪嗒搧起炭香！`,
  stickAway: '燙燙燙！竹籤俐落收掉！',
  noSkewer: '鐵串用光了！得先把髒鐵串洗好！',
  skewerWash: '把鐵串刷得亮晶晶！',
  burntAway: '哎呀焦黑了！這份不能砸了招牌，丟掉重烤！',
  orphanAway: '客人等不及先走了…先放進大碗保溫，等下一位點的客人！',
  orphanAgain: (n: string) => `運氣太好了！這份熱騰騰的${n}剛好有客人點，直接送上！`,

  // 客人點餐與反應（移除前置編號 #ID）
  order: (_id: number, names: string[]) => `老闆！先來一份${names.join('、')}，現烤最讚！`,
  nothing: (_id: number) => `看了一圈沒有特別對胃口的…下次路過再來試試！`,
  wcDirty: (_id: number) => `哇…這洗手間地板跟馬桶有點嚇人，該打掃啦！`,
  wcPaper: (_id: number) => `救命啊！廁所裡居然連一張衛生紙都沒有了？！`,
  noTissue: (_id: number) => `咦？桌邊抽屜裡的紙巾全空了，擦不了嘴呀…`,
  noReceipt: (_id: number) => `發票機沒紙了嗎？沒關係啦，心意收到就好！`,
  wcNice: (_id: number) => `這家店連洗手間都香香的、擦得發亮，細節真用心！`,
  wcGo: (_id: number, k: number) => [
    '喝太暢快了，先去洗手間釋放一下～',
    '稍微離席洗個手，馬上回來繼續吃！',
    '肚子有點滾…趕緊借個洗手間！',
  ][Math.abs(k) % 3],

  // 店員與迎賓
  welcome: 'いらっしゃいませ！歡迎光臨，裡面請坐！',
  serveSay: (k: number) => [
    '讓您久等了！剛出爐的現烤好料，小心鐵網燙口喔！',
    '熱騰騰上桌！香氣正濃，請趁熱慢用！',
    '招牌烤魚來囉！沾點調料風味更棒喔！',
  ][Math.abs(k) % 3],
  washSay: (k: number) => [
    '滿滿一疊油盤！看我洗得像新的一樣光亮！',
    '盤子交給我，泡泡洗淨、高溫烘乾歸位！',
    '洗碗也是基本功！唰唰唰兩下搞定！',
  ][Math.abs(k) % 3],
  riceDone: '[內場] 呼～新潟越光米剛炊熟！粒粒分明、米香撲鼻！',

  // 結帳與離店
  payGo: (_id: number, k: number) => [
    '肚子飽到不行！老闆，買單～！',
    '吃得太過癮了！來去櫃檯算一下帳！',
  ][Math.abs(k) % 2],
  payThanks: (_id: number, k: number) => [
    '多謝款待！烤魚油脂豐厚超下酒，下次一定揪朋友來！',
    'ごちそうさまでした！水準真的高，太美味了！',
  ][Math.abs(k) % 2],
  // (by the game's hour (the owner's: "late at night, mind the road" at half past eight in the morning): morning to 13:59, afternoon to
  // 17:59, night the rest)
  cashierThanks: (bill: string, hour = 20) => `非常感謝您的捧場！一共是 ${bill}，${partOfDay(hour) === 'morning' ? '祝您今天用餐愉快、上班加油喔！' : partOfDay(hour) === 'afternoon' ? '午後微風正好，慢走喔！' : '夜深了路上小心慢走喔！'}`,
  wcBack: (_id: number, k: number) => [
    '呼～神清氣爽！滿血復活，繼續開吃！',
    '洗完手了，這撲鼻的炭烤香氣真受不了！',
  ][Math.abs(k) % 2],
  angry: (_id: number) => `等得我都快餓暈了！到底還要多久？不吃了，退單！`,
  dark: (_id: number) => `怎麼瞬間眼前一片黑？！跳電還是打烊啦？`,
  darkGone: (_id: number) => `伸手不見五指黑漆漆的，連魚刺都看不見怎麼吃？走人了！`,
  verdict: (_id: number, n: string, stars: number) => {
    const comments = [
      '火候好像沒控制好…有點失望。',
      '普普通通，就是一般居酒屋的味道。',
      '烤得滿香的，吃起來挺順口！',
      '外酥內嫩、肉汁全鎖住了！好好吃！',
      '天啊這炭香跟肉質！簡直是極品神作！太幸福了！',
    ]
    return `這道${n}…${comments[Math.max(0, Math.min(4, stars - 1))]}`
  },
  sick: (_id: number, n: string) => `唔…這盤${n}味道怪怪的…肚子一陣絞痛！洗手間在哪裡啊啊！`,
  trial: (who: string, names: string[]) => `【試菜研發】${who}端出了全新私房菜：${names.join('、')}！已謄錄在研發秘笈！`,
  trialNone: (who: string) => `${who}嘆氣：食材庫存不夠豐富，得先進一批頂級貨才能試新菜！`,
}

const JA: typeof ZH = {
  // 炭火と調理
  addCharcoal: '火が落ちてきたな、備長炭を足そう！',
  noCharcoal: '炭が完全に切れた！袋も底をついた、早く発注しないと！',
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
  done: (n: string) => `${n}、皮はパリッと身はふっくら焼き上がり！`,
  seasoned: (n: string, k: string) => {
    const map: Record<string, string> = {
      salt: '塩をサッと振って旨味を引き立てる',
      soy: '香ばしい秘伝の醤油ダレをひと塗り',
      milk: '贅沢に練乳をとろーりかけて',
      peanut: '香ばしいきな粉をたっぷりまぶして',
      miso: '特製赤味噌をまんべんなく塗って',
      wasabi: 'すりおろし生わさびを添えて',
      shichimi: '風味豊かな七味をピリリと利かせて',
      yuzu: '爽やかな柚子胡椒をちょこんと添えて',
      lemon: '新鮮なレモンをキュッと搾って',
    }
    return `${n}に${map[k] ?? ''}！完成！`
  },
  onFire: (n: string) => `${n}、火入れ開始！脂の落ちるいい香りがしてきた！`,
  fanned: (n: string) => `${n}、パタパタ扇いで炭火の火力を引き上げる！`,
  stickAway: 'アチチッ！串を手早く片付けるぞ！',
  noSkewer: '鉄串が切れた！使った串を先に洗わないと！',
  skewerWash: '鉄串をピカピカに磨くぞ！',
  burntAway: 'あちゃー、焦げちまった！店の看板に関わる、焼き直しだ！',
  orphanAway: 'お客さん帰っちゃったか…大鉢で保温して、次の注文に回そう！',
  orphanAgain: (n: string) => `ツイてる！${n}の注文がちょうど入った、出来立てをそのまま出そう！`,

  // 客の注文と反応（ID番号除去）
  order: (_id, names) => `大将！${names.join('と')}を焼いてくれ、楽しみにしてるよ！`,
  nothing: (_id) => `うーん、今日はピンとくるものがないな…また寄らせてもらうよ！`,
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
  welcome: 'いらっしゃいませ！炭火焼きのいい匂い、奥の席へどうぞ！',
  serveSay: (k) => [
    '大変お待たせしました！焼きたてアツアツ、火傷にご注意を！',
    'お待たせしました！一番美味しい焼き加減です、ごゆっくり！',
    '名物の炭火焼きです！熱いうちにどうぞ召し上がれ！',
  ][Math.abs(k) % 3],
  washSay: (k) => [
    '油汚れのお皿ドーンと来い！ピッカピカに磨き上げるぞ！',
    '洗い物は任せて！しっかり洗って乾かして元の棚へ！',
    '手際よくキュッキュッと！次のお客さんの準備完了！',
  ][Math.abs(k) % 3],
  riceDone: '[厨房] 新潟産コシヒカリがふっくら艶やかに炊き上がりました！',

  // 会計と退店
  payGo: (_id, k) => [
    'お腹いっぱい大満足！大将、お勘定頼むよ！',
    'いやあ食った食った！レジで会計しようか！',
  ][Math.abs(k) % 2],
  payThanks: (_id, k) => [
    'ごちそうさま！焼き魚の脂の乗りが最高だったよ、また来るね！',
    '大将、絶品だったよ！今度は仲間を連れて食べに来るよ！',
  ][Math.abs(k) % 2],
  cashierThanks: (bill, hour = 20) => `ありがとうございました！お会計は${bill}になります。${partOfDay(hour) === 'morning' ? 'いってらっしゃいませ、良い一日を！' : partOfDay(hour) === 'afternoon' ? '午後もどうぞお気をつけて！' : '夜道お気をつけて！'}`,
  wcBack: (_id, k) => [
    'ふぅ～すっきりした！さあ、焼き魚の続きを平らげるぞ！',
    'さっぱりした！香ばしい匂いに胃袋がまた刺激されるな！',
  ][Math.abs(k) % 2],
  angry: (_id) => `待たせすぎだ！腹ペコで倒れちまうよ！もう帰る、キャンセルだ！`,
  dark: (_id) => `うわっ、急に真っ暗？！停電か？それとも閉店かい？`,
  darkGone: (_id) => `一寸先も闇じゃ魚の骨も見えやしない！お暇させてもらうよ！`,
  verdict: (_id, n, stars) => {
    const comments = [
      'ちょっと焼き加減が微妙だったかな…',
      'まあ、普通の居酒屋クオリティだね。',
      '香ばしくてなかなか旨いよ！',
      '皮パリ中ジューシー！これはうまい！',
      '言葉が出ないほど絶品！炭火の魔術師かよ、最高だ！',
    ]
    return `この${n}…${comments[Math.max(0, Math.min(4, stars - 1))]}`
  },
  sick: (_id, n) => `うっ…この${n}、なんか傷んでないか…お腹が激痛だ、トイレどこだーっ！`,
  trial: (who, names) => `【新作開発】${who}が自慢の逸品を考案：${names.join('、')}！レシピ帖に記録完了！`,
  trialNone: (who) => `${who}：素材が足りないな。上質な仕入れがないと腕が振るえないぜ！`,
}

const EN: typeof ZH = {
  // Grilling & Kitchen Action
  addCharcoal: 'The flame is dying down. Adding two fresh Binchotan coals!',
  noCharcoal: 'We’re completely out of charcoal! The sack is empty—place an order quick!',
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
  done: (n: string) => `${n} is sizzling to perfection with crisp skin! Plating up!`,
  seasoned: (n: string, k: string) => {
    const map: Record<string, string> = {
      salt: 'sprinkled with fine rock salt',
      soy: 'glazed with rich, glossy soy sauce',
      milk: 'drizzled generously with condensed milk',
      peanut: 'dusted with fragrant peanut powder',
      miso: 'coated in savoury red miso',
      wasabi: 'garnished with freshly grated wasabi',
      shichimi: 'dusted with zesty shichimi pepper',
      yuzu: 'topped with a dab of aromatic yuzu kosho',
      lemon: 'squeezed with a burst of tart lemon',
    }
    return `${n} seasoned: ${map[k] ?? ''}! Ready!`
  },
  onFire: (n: string) => `${n} hits the grill! Listen to that mouthwatering sizzle!`,
  fanned: (n: string) => `Fanning the embers for ${n}! Fanning up the aroma!`,
  stickAway: 'Hot skewers cleared with chef speed!',
  noSkewer: 'Out of skewers! The used ones need washing first!',
  skewerWash: 'Scrubbing the skewers till they shine!',
  burntAway: 'Blast, it charred! Can’t serve this to valued guests—toss it and restart!',
  orphanAway: 'The patron left... Into the big bowl to keep warm for the next order!',
  orphanAgain: (n: string) => `What luck! An order just rolled in for ${n}—send it out piping hot!`,

  // Customer Ordering & Feedback (Stripped #ID prefix)
  order: (_id, names) => `Chef! We’ll start with ${names.join(', ')}, fresh off the coals!`,
  nothing: (_id) => `Nothing catching my eye right now... Catch you next time!`,
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
  welcome: 'Irasshaimase! Welcome in! Mind the smoke and take a seat!',
  serveSay: (k) => [
    'Pardon the wait! Piping hot off the charcoal—watch the grill bars!',
    'Hot and fresh! Best enjoyed while sizzling!',
    'Signature grilled dish arriving! Dip it while it’s hot!',
  ][Math.abs(k) % 3],
  washSay: (k) => [
    'A fresh stack of greasy plates! Time to make them sparkle!',
    'Leave the dishes to me—soaped, sanitized, and stacked!',
    'Squeaky clean dishes ready for the next round!',
  ][Math.abs(k) % 3],
  riceDone: '[Kitchen] Freshly steamed Koshihikari rice is ready! Fluffy and fragrant!',

  // Checkout & Departure
  payGo: (_id, k) => [
    'Bursting at the seams! Check please, Chef!',
    'What a feast! Let’s head to the register and settle up!',
  ][Math.abs(k) % 2],
  payThanks: (_id, k) => [
    'Thanks for the feast! The fish was grilled to perfection, definitely coming back!',
    'Gochisousama! Top-notch grilling, bringing the whole crew next time!',
  ][Math.abs(k) % 2],
  cashierThanks: (bill, hour = 20) => `Thank you so much! Your total comes to ${bill}. ${partOfDay(hour) === 'morning' ? 'Have a great day!' : partOfDay(hour) === 'afternoon' ? 'Enjoy the rest of your afternoon!' : 'Get home safe tonight!'}`,
  wcBack: (_id, k) => [
    'Whew, refreshed and recharged! Back to the grilled fish feast!',
    'All washed up! That charcoal smoke aroma has my appetite roaring again!',
  ][Math.abs(k) % 2],
  angry: (_id) => `This is ridiculous, I’m starving here! Cancel my order, I’m out!`,
  dark: (_id) => `Whoa, lights out?! Did a breaker flip or are we closing?!`,
  darkGone: (_id) => `Pitch black in here—can’t even see the fish bones! I’m out!`,
  verdict: (_id, n, stars) => {
    const comments = [
      'Heat control was a bit off... disappointing.',
      'Pretty average, standard tavern fare.',
      'Nicely charred and tasty enough!',
      'Crispy skin, tender and juicy inside! Delicious!',
      'Out of this world! Pure grilling magic, absolute perfection!',
    ]
    return `This ${n}... ${comments[Math.max(0, Math.min(4, stars - 1))]}`
  },
  sick: (_id, n) => `Ugh... that ${n} tasted funky... My stomach is cramping! Restroom, stat!`,
  trial: (who, names) => `[Culinary R&D] ${who} concocted an inventive new recipe: ${names.join(', ')}! Saved to notebook!`,
  trialNone: (who) => `${who}: Not enough ingredients in stock. Order fresh supplies before testing new dishes!`,
}

export const LINES: Record<Lang, typeof ZH> = { zh: ZH, ja: JA, en: EN }
