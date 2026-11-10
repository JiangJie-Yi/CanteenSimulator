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

// (the owner's, 2026-11-10: pared down, each line short and hard; a line break within a paragraph is its own line, as he set them)
export const STORY: Record<Lang, Story> = {
  zh: {
    title: '一個人，一爐火',
    sub: '聞野 開店記',
    open: '帶著一隻舊行李箱，隻身落腳大阪天滿的深巷。\n押上手頭最後的積蓄，只求一座燒得通紅的圍炉裏。',
    ledger: ['孤注一擲的積蓄', '押金、爐台與裝潢', '開門首日營運金'],
    body: [
      '八張吧台椅，一盞手掛的「聞野」白燈籠。\n掀開暖簾那一刻，炭火、水電、時薪與鮮魚的保鮮期，每分每秒都在倒數。',
    ],
    end: '這不是悠閒的小酒館，而是一場真切的生存戰。\n顧好火候，算好銀兩——直到整座城市的夜歸人，都記住這縷焦香。',
  },
  ja: {
    title: 'ひとり、ひとつの炉',
    sub: '聞野 開店記',
    open: '古いスーツケースひとつで、大阪・天満の路地の奥に流れ着いた。\n手元の蓄えを残らず賭けて、真っ赤に燃える囲炉裏をひとつ。',
    ledger: ['すべてを賭けた蓄え', '保証金、炉と内装', '開店初日の運転資金'],
    body: [
      'カウンター八席、自分で掛けた「聞野」の白い提灯。\n暖簾を掛けたその瞬間から、炭も、水道と電気も、時給も、魚の鮮度も、刻一刻と減っていく。',
    ],
    end: 'のんびりした小さな店ではない。本物の生き残りをかけた勝負だ。\n火を守り、銭を合わせる――この街の夜帰りの誰もが、この焦げた香りを覚えるまで。',
  },
  en: {
    title: 'One Man, One Fire',
    sub: 'How Kikuno opened',
    open: 'One old suitcase, and he came to rest alone in a back alley of Tenma, Osaka.\nHe staked the last of his savings on one irori hearth, burning red.',
    ledger: ['Savings, all staked', 'Deposit, hearth and fit-out', 'Running money for day one'],
    body: [
      'Eight stools at the counter, one white Kikuno lantern hung by his own hand.\nThe moment the noren goes up, the charcoal, the water and power, the wages and the fish all start counting down.',
    ],
    end: 'This is no easygoing little bar: it’s a real fight to survive.\nMind the fire, mind the money, until every late walker in the city knows this smell of charcoal.',
  },
}
