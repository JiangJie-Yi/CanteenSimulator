// The story behind the shop, told in the rating panel's 關於 tab (the owner's: the owner of it come alone to Osaka to open it, every day's
// costs high, the game a fight to survive): its title, the three short tellings around the money he came with, and the line it ends on.
import type { Lang } from '@/data/i18n'

export type Story = {
  title: string
  /** what it is, under the title */
  sub: string
  /** before the money he came with is set out */
  open: string
  /** the money, line by line: what he'd saved, what opening took, what was left (the amounts are the game's own: game/economy) */
  ledger: [string, string, string]
  /** after it */
  body: string[]
  /** the line it ends on */
  end: string
}

export const STORY: Record<Lang, Story> = {
  zh: {
    title: '一個人，一爐火',
    sub: '聞野開店記',
    open: '他拖著一只磨損的行李箱，隻身從台灣來到大阪天滿的窄巷深處。咬牙拿出所有的壓箱積蓄，付完店租與爐具，帳本上用熟悉的新台幣寫著僅剩的退路：',
    ledger: ['孤注一擲的積蓄', '押金、爐台與裝潢', '開門首日營運週轉金'],
    body: [
      '八張木吧台椅、一座燒得通紅的圍爐裏，門口那盞「聞野」白燈籠是他親手掛上的。他希望巷子裡匆忙的人們，遠遠就能聞到炭火的香氣。',
      '在異國開門，每一秒都是生存。備長炭一截截燒成灰，冷凍櫃裡的鮮魚一天天倒數著保鮮期；水錶、電錶與工讀生的時薪，從掀開暖簾那一刻就不曾停過。客人一口烤魚後的一句「うまい」，能撐起一整天的心力；而一張皺眉的臭臉，就足以讓這個月的帳本見紅。',
    ],
    end: '這從來不是一間悠閒的小居酒屋，而是一場真真切切的生存戰。顧好火候，算好銀兩，將每條魚烤出焦香——直到整座城市的夜歸人，都記住聞野的滋味。',
  },
  ja: {
    title: 'ひとり、ひとつの炉',
    sub: '聞野 開店記',
    open: 'スーツケースひとつで、彼は台湾からひとり大阪へやって来た。半生かけた蓄えは、開業費を払うとこれだけになった。帳簿だけは、今も台湾ドルでつけている。',
    ledger: ['半生の蓄え', '開業費', '開店の日、手元に'],
    body: [
      '店は天満の細い路地の突き当たり。カウンター八席に囲炉裏がひとつ、入口の提灯は自分の手で掛けた。名は「聞野」。路地の向こうまで、炭の香りが届くように。',
      '大阪では、毎日がお金との勝負だ。備長炭は一本ずつ灰になり、冷凍庫の魚は日ごとに鮮度を落とす。人の時給も、水道と電気のメーターも、暖簾を掛けたその瞬間から回り出す。「うまい」の一言が明日を支え、しかめっ面ひとつで今月の帳簿は赤く染まる。',
    ],
    end: 'ここは、のんびりした小さな店ではない。生き残りをかけた勝負だ。火を守り、帳簿を合わせ、一尾一尾をちょうどよく焼き上げる――この路地の誰もが、聞野の味を覚えるその日まで。',
  },
  en: {
    title: 'One Man, One Fire',
    sub: 'How Kikuno opened',
    open: 'He came from Taiwan to Osaka alone, with a single suitcase. Half a lifetime’s savings came to this once the opening costs were paid; he still keeps his books in Taiwan dollars.',
    ledger: ['Saved over half a lifetime', 'Opening costs', 'In hand on opening day'],
    body: [
      'The shop sits at the end of a narrow alley in Tenma: eight seats at the counter, one irori hearth, and lanterns at the door he hung himself. He named it Kikuno, so the smell of charcoal would carry down the alley.',
      'In Osaka, every day burns money. The binchotan turns to ash one stick at a time, the fish in the freezer lose their freshness day by day, and the wages, the water meter and the power meter start running the moment the noren goes up. One “delicious” carries him to tomorrow; one sour face can turn the month’s books red.',
    ],
    end: 'This is no easygoing little shop: it’s a fight to survive. Keep the fire, balance the books, grill every fish just right, until everyone in the alley knows the taste of Kikuno.',
  },
}
