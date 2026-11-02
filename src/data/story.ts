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
    open: '他拖著一只行李箱，從台灣隻身來到大阪。半輩子的積蓄，付完開業的費用就只剩這些；帳本上，他還是習慣用新台幣記。',
    ledger: ['存了半輩子', '開業費用', '開門那天，手上'],
    body: [
      '店開在天滿一條窄巷的盡頭：八個吧台座位、一座圍爐裏，門口的燈籠是他親手掛上的。他替它取名「聞野」，讓人隔著巷子，就聞得到炭火的香。',
      '在大阪，每一天都在燒錢。備長炭一根根燒成灰，冷凍櫃裡的魚一天天不再新鮮；員工的時薪、水錶和電錶，從掛上暖簾的那一刻就開始轉。客人一句「好吃」，撐得起明天；一張臭臉，就可能讓這個月的帳變紅。',
    ],
    end: '這不是一間悠閒的小店，是一場生存。顧好火，算好帳，把每一條魚烤得恰到好處——直到整條巷子都記得聞野的味道。',
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
