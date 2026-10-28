// How a day's trade runs when the shop's open: each opening draws one of several patterns (a quiet rainy day, a lunch rush, a festival
// night, a tour bus...), each with its own rhythm of customers through the session, how many come in pairs, and how much they order.
// Pure rules, so they can be tested; the grill reads them (shops/grill/Roasting).

export type FlowKind = 'steady' | 'lunchRush' | 'eveningRush' | 'rainy' | 'festival' | 'tourBus' | 'regulars'

export interface Flow {
  /** what the chef says as the shop opens */
  say: { zh: string; ja: string; en: string }
  /** how many come in pairs (0..1) */
  pairs: number
  /** how much more each orders on average (added to the dishes they'd want) */
  appetite: number
  /** the gap between customers, against the usual, at `k` (0 the opening, 1 a full session and on): under 1 busier, over 1 quieter */
  gap: (k: number) => number
}

const bump = (k: number, at: number, w: number) => Math.exp(-(((k - at) / w) ** 2))

export const FLOWS: Record<FlowKind, Flow> = {
  steady: { say: { zh: '今天是平常日，客人會穩穩地來。', ja: '今日は普段どおり、お客さんは途切れず来るよ。', en: 'An ordinary day: customers will come steadily.' },
    pairs: 0.2, appetite: 0, gap: () => 1 },
  lunchRush: { say: { zh: '中午的上班族要來了，一開店就會很忙！', ja: '昼のサラリーマンが来るぞ、開店からすぐ忙しくなる！', en: 'The lunch crowd is coming: busy from the start!' },
    pairs: 0.15, appetite: -0.2, gap: (k) => 1 - 0.6 * bump(k, 0.2, 0.18) + 0.25 * (k > 0.5 ? 1 : 0) },
  eveningRush: { say: { zh: '晚上下班時間，後半段會越來越多人。', ja: '夕方の帰り時、後半ほど混んでくるよ。', en: 'The evening after work: busier and busier as it goes.' },
    pairs: 0.3, appetite: 0.3, gap: (k) => 1.3 - 0.75 * Math.min(1, k * 1.4) },
  rainy: { say: { zh: '外面下雨，客人可能比較少，慢慢烤吧。', ja: '外は雨、お客さんは少なめかも。じっくり焼こう。', en: 'It is raining: fewer customers, take your time.' },
    pairs: 0.35, appetite: 0.4, gap: () => 1.7 },
  festival: { say: { zh: '今晚有祭典！人潮會一波一波湧進來！', ja: '今夜はお祭り！人が波のように押し寄せるぞ！', en: 'Festival night: crowds in waves!' },
    pairs: 0.45, appetite: 0.5, gap: (k) => 0.75 - 0.35 * Math.max(0, Math.sin(k * Math.PI * 4)) },
  tourBus: { say: { zh: '聽說有觀光團，等一下會一次湧進一群人。', ja: '観光ツアーが来るらしい、一度にどっと入ってくるよ。', en: 'A tour bus is due: a crowd all at once in a while.' },
    pairs: 0.6, appetite: 0.2, gap: (k) => 1.2 - 0.85 * bump(k, 0.45, 0.1) },
  regulars: { say: { zh: '今天多是熟客，點得多、也比較有耐心。', ja: '今日は常連さんが多い、よく頼むし気長だよ。', en: 'Mostly regulars today: they order more and wait longer.' },
    pairs: 0.1, appetite: 0.6, gap: () => 1.15 },
}

export const FLOW_KINDS = Object.keys(FLOWS) as FlowKind[]

/** the pattern for the `n`th opening: never the same twice running, and every one of them turns up over a week of openings */
export function flowOf(n: number): FlowKind {
  const order: FlowKind[] = ['steady', 'lunchRush', 'rainy', 'eveningRush', 'tourBus', 'regulars', 'festival']
  const shuffle = (n * 5 + Math.floor(n / order.length) * 3) % order.length
  return order[shuffle]
}

/** how many dishes a customer wants, from a roll `r` (0..1) and a second roll `r2` for the day's appetite */
export const wantOf = (flow: FlowKind, r: number, r2: number) => 1 + Math.floor(r * 3) + (r2 < Math.max(0, FLOWS[flow].appetite) ? 1 : 0) - (r2 > 1 + FLOWS[flow].appetite ? 1 : 0)
