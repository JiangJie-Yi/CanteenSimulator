// The views the eye button (bottom left) offers, and the numbered spots edit mode marks them with (as Sketchfab's annotations): each a part of
// the shop, what it's called, a line on what's there, and what in the room it looks at (a named group, `look-…`; the grill's own view and
// the whole shop's have their own framing).
import type { Lang } from './i18n'

export type ViewId = 'free' | 'grill' | 'till' | 'genkan' | 'altar' | 'drinks' | 'toilet' | 'back' | 'window' | 'boss'
export type ViewSpot = {
  id: ViewId
  zh: string
  ja: string
  en: string
  /** what the view's on, a line for the numbered spot's tag */
  about: Record<Lang, string>
  /** the named group in the room it looks at (none: the grill's own view, or the whole shop) */
  anchor?: string
  /** how far back the camera stands from it, and how high above it */
  back?: number
  up?: number
  /** the point looked at moved this far across the room (x, z) from the anchor: for a part by the room's open side, so the frame
   * keeps to the room and not the empty outside */
  shift?: [number, number]
  /** the way (x, z) the camera stands off from what it looks at, in place of the overview's */
  from?: [number, number]
  /** seen from straight in front of what it looks at (its own +z), not from the room's open side */
  faceOn?: boolean
  /** seen through the eyes of what it's on (the owner), following him as he goes, a wide lens */
  follow?: boolean
  /** (with follow) not through his eyes but of him: a three-quarter portrait at his eyes' height, following him */
  portrait?: boolean
  /** its lens (degrees, vertical): each view its own, as a cameraman would pick (the owner's) */
  fov?: number
}

export const VIEW_SPOTS: ViewSpot[] = [
  { id: 'free', zh: '自由視角', ja: '全体', en: 'Overview', fov: 35, about: { zh: '從高處斜看整間店', ja: '店全体を高いところから', en: 'The whole shop from up high' } },
  { id: 'grill', zh: '火烤灶台', ja: '炉端', en: 'Grill', fov: 40, about: { zh: '圍爐燒烤的灶台：炭火、烤魚、調味', ja: '囲炉裏の炉端：炭火、焼き魚、味付け', en: 'The hearth grill: charcoal, fish, seasoning' } },
  { id: 'till', zh: '櫃檯', ja: 'レジ', en: 'Till', anchor: 'TillMarble', back: 3.0, up: 1.6, fov: 42,
    about: { zh: '收銀櫃檯：收銀機、平板、刷卡機、服務鈴', ja: 'レジカウンター：レジ、タブレット、カード端末、呼び鈴', en: 'The till counter: register, tablet, card reader, bell' } },
  { id: 'genkan', zh: '玄關', ja: '玄関', en: 'Entrance', anchor: 'look-door', back: 3.9, up: 2.6, shift: [-1.5, 0], from: [0.59, 0.81], fov: 45,
    about: { zh: '入口：門簾、紅燈籠、鞋櫃、招財貓台', ja: '入口：暖簾、赤提灯、下駄箱、招き猫の台', en: 'The entrance: noren, red lantern, shoe rack, lucky cats' } },
  { id: 'altar', zh: '小神龕', ja: '神棚', en: 'Shrine', anchor: 'look-altar', back: 2.6, up: -0.3, fov: 35,
    about: { zh: '神棚與供桌：點御神酒供酒，可招來更多客人', ja: '神棚と供え台：御神酒を供えると客が増える', en: 'The household shrine: offer sake to bring more customers' } },
  { id: 'drinks', zh: '飲品櫃', ja: '飲み物', en: 'Drinks', anchor: 'look-fridge', back: 6.2, up: 1.6, from: [0.808, -0.589], shift: [0.53, 0.72], fov: 38,
    about: { zh: '飲料冷藏櫃：客人自己拿飲料', ja: '飲み物の冷蔵庫：客がセルフで取る', en: 'The drinks fridge: customers help themselves' } },
  { id: 'toilet', zh: '廁所', ja: 'お手洗い', en: 'Toilets', anchor: 'look-wc-m', back: 5.8, up: 2.3, from: [0.808, -0.589], shift: [-0.55, -0.76], fov: 45,
    about: { zh: '男女廁所的拉門與洗手台', ja: '男女のお手洗いの引き戸と手洗い', en: 'The toilets: sliding doors and wash basins' } },
  { id: 'back', zh: '後台區', ja: '裏方', en: 'Back room', anchor: 'look-back', back: 4.4, up: 5.4, faceOn: true, fov: 40,
    about: { zh: '後場：碗盤架、飯桶與作業台', ja: '裏方：食器ラック、飯びつと作業台', en: 'Behind the scenes: dish racks, rice tub, work table' } },
  { id: 'window', zh: '窗口', ja: '丸窓', en: 'Window', anchor: 'look-window', back: 4.6, up: 0.6, faceOn: true, fov: 40,
    about: { zh: '牆上的圓窗：白天是竹影，夜晚有月光與飄浮的塵埃', ja: '丸窓：昼は竹の影、夜は月明かりと舞う塵', en: 'The round window: bamboo shadows by day, moonlight and drifting dust by night' } },
  { id: 'boss', zh: '老闆', ja: '店主', en: 'Owner', anchor: 'BossFollow', follow: true, portrait: true, fov: 35,
    about: { zh: '老闆的肖像：3/4 側臉，跟著他走（閉店時）', ja: '店主の肖像：斜め前から、ついて回る（閉店中）', en: 'The owner, a three-quarter portrait following him (while closed)' } },
]

export const viewName = (v: ViewSpot, lang: Lang) => (lang === 'ja' ? v.ja : lang === 'en' ? v.en : v.zh)
